package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// ============================================
// CONFIG
// ============================================

type Profile struct {
	Name              string
	Churches          int
	ListenersPerChurch int
}

var defaultProfiles = []Profile{
	{Name: "light", Churches: 5, ListenersPerChurch: 20},
	{Name: "medium-wide", Churches: 10, ListenersPerChurch: 100},
	{Name: "many-churches", Churches: 50, ListenersPerChurch: 20},
	{Name: "few-heavy", Churches: 5, ListenersPerChurch: 500},
	{Name: "full", Churches: 50, ListenersPerChurch: 100},
}

// ============================================
// METRICS
// ============================================

type EndpointMetrics struct {
	mu       sync.Mutex
	Name     string
	Latencies []time.Duration
	Errors    int64
	Total     int64
}

func (m *EndpointMetrics) Record(d time.Duration, err bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Total++
	m.Latencies = append(m.Latencies, d)
	if err {
		m.Errors++
	}
}

func (m *EndpointMetrics) Report() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.Total == 0 {
		return fmt.Sprintf("  %-35s  (no requests)\n", m.Name)
	}
	sort.Slice(m.Latencies, func(i, j int) bool { return m.Latencies[i] < m.Latencies[j] })
	p50 := m.Latencies[len(m.Latencies)*50/100]
	p95 := m.Latencies[len(m.Latencies)*95/100]
	p99 := m.Latencies[len(m.Latencies)*99/100]
	errRate := float64(m.Errors) / float64(m.Total) * 100
	return fmt.Sprintf("  %-35s  total=%-6d err=%.1f%%  p50=%-8s p95=%-8s p99=%s\n",
		m.Name, m.Total, errRate,
		p50.Round(time.Millisecond), p95.Round(time.Millisecond), p99.Round(time.Millisecond))
}

type MetricsCollector struct {
	endpoints map[string]*EndpointMetrics

	icecastConnected  atomic.Int64
	icecastFailed     atomic.Int64
	icecastBytesTotal atomic.Int64
}

func NewMetrics() *MetricsCollector {
	return &MetricsCollector{
		endpoints: make(map[string]*EndpointMetrics),
	}
}

func (mc *MetricsCollector) Endpoint(name string) *EndpointMetrics {
	if m, ok := mc.endpoints[name]; ok {
		return m
	}
	m := &EndpointMetrics{Name: name}
	mc.endpoints[name] = m
	return m
}

// ============================================
// API CLIENT
// ============================================

type APIClient struct {
	BaseURL    string
	DeviceKey  string
	HTTPClient *http.Client
	Metrics    *MetricsCollector
}

type authToken struct {
	Token string `json:"token"`
}

func (c *APIClient) doJSON(method, path string, body interface{}, headers map[string]string) ([]byte, int, error) {
	var bodyReader io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequest(method, c.BaseURL+path, bodyReader)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	start := time.Now()
	resp, err := c.HTTPClient.Do(req)
	latency := time.Since(start)

	// Record metrics
	endpoint := method + " " + simplifyPath(path)
	m := c.Metrics.Endpoint(endpoint)
	if err != nil {
		m.Record(latency, true)
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	isErr := resp.StatusCode >= 400
	m.Record(latency, isErr)

	return respBody, resp.StatusCode, nil
}

func simplifyPath(path string) string {
	// Collapse IDs to :id for grouping
	parts := strings.Split(path, "/")
	for i, p := range parts {
		if len(p) > 0 && p[0] >= '0' && p[0] <= '9' {
			parts[i] = ":id"
		}
	}
	return strings.Join(parts, "/")
}

func (c *APIClient) adminLogin(email, password string) (string, error) {
	body, status, err := c.doJSON("POST", "/auth/admin/login", map[string]string{
		"email": email, "password": password,
	}, nil)
	if err != nil {
		return "", err
	}
	if status != 200 {
		return "", fmt.Errorf("admin login failed (%d): %s", status, body)
	}
	var t authToken
	json.Unmarshal(body, &t)
	return t.Token, nil
}

func (c *APIClient) userRegister(name, email, password string) (string, error) {
	body, status, err := c.doJSON("POST", "/auth/user/register", map[string]string{
		"name": name, "email": email, "password": password,
	}, nil)
	if err != nil {
		return "", err
	}
	if status != 201 && status != 200 {
		return "", fmt.Errorf("register failed (%d): %s", status, body)
	}
	var t authToken
	json.Unmarshal(body, &t)
	return t.Token, nil
}

func (c *APIClient) userLogin(email, password string) (string, error) {
	body, status, err := c.doJSON("POST", "/auth/user/login", map[string]string{
		"email": email, "password": password,
	}, nil)
	if err != nil {
		return "", err
	}
	if status != 200 {
		return "", fmt.Errorf("user login failed (%d): %s", status, body)
	}
	var t authToken
	json.Unmarshal(body, &t)
	return t.Token, nil
}

func (c *APIClient) adminCreateMachine(machineID, token string) (int32, error) {
	body, status, err := c.doJSON("POST", "/admin/machines", map[string]string{
		"machine_id": machineID,
	}, map[string]string{"Authorization": "Bearer " + token})
	if err != nil {
		return 0, err
	}
	if status != 201 && status != 200 {
		return 0, fmt.Errorf("create machine failed (%d): %s", status, body)
	}
	var resp map[string]interface{}
	json.Unmarshal(body, &resp)
	// Try wrapped {"machine": {...}} first, then top-level
	if m, ok := resp["machine"].(map[string]interface{}); ok {
		return int32(m["id"].(float64)), nil
	}
	if id, ok := resp["id"].(float64); ok {
		return int32(id), nil
	}
	return 0, fmt.Errorf("unexpected response: %s", body)
}

func (c *APIClient) adminActivateMachine(id int32, token string) error {
	_, status, err := c.doJSON("PUT", fmt.Sprintf("/admin/machines/%d/activate", id), nil,
		map[string]string{"Authorization": "Bearer " + token})
	if err != nil {
		return err
	}
	if status != 200 {
		return fmt.Errorf("activate failed: %d", status)
	}
	return nil
}

func (c *APIClient) adminCreateChurch(name string, machineID int32, token string) (int32, string, error) {
	body, status, err := c.doJSON("POST", "/admin/churches", map[string]interface{}{
		"name":       name,
		"address":    "Stress Test Address",
		"machine_id": machineID,
	}, map[string]string{"Authorization": "Bearer " + token})
	if err != nil {
		return 0, "", err
	}
	if status != 201 && status != 200 {
		return 0, "", fmt.Errorf("create church failed (%d): %s", status, body)
	}
	var resp map[string]interface{}
	json.Unmarshal(body, &resp)

	var churchID int32
	var streamID string

	if ch, ok := resp["church"].(map[string]interface{}); ok {
		churchID = int32(ch["id"].(float64))
	}
	// credentials key (from CreateChurch response)
	if cred, ok := resp["credentials"].(map[string]interface{}); ok {
		streamID = cred["stream_id"].(string)
	}
	return churchID, streamID, nil
}

func (c *APIClient) adminDeleteChurch(id int32, token string) error {
	_, status, err := c.doJSON("DELETE", fmt.Sprintf("/admin/churches/%d", id), nil,
		map[string]string{"Authorization": "Bearer " + token})
	if err != nil {
		return err
	}
	if status != 200 {
		return fmt.Errorf("delete church failed: %d", status)
	}
	return nil
}

func (c *APIClient) adminDeleteMachine(id int32, token string) error {
	_, status, err := c.doJSON("DELETE", fmt.Sprintf("/admin/machines/%d", id), nil,
		map[string]string{"Authorization": "Bearer " + token})
	if err != nil {
		return err
	}
	if status != 200 {
		return fmt.Errorf("delete machine failed: %d", status)
	}
	return nil
}

func (c *APIClient) deviceStreamStarted(serialNumber string) error {
	_, status, err := c.doJSON("POST", "/device/stream/started", map[string]string{
		"serial_number": serialNumber,
	}, map[string]string{"X-Device-Key": c.DeviceKey})
	if err != nil {
		return err
	}
	if status != 200 {
		return fmt.Errorf("stream started failed: %d", status)
	}
	return nil
}

func (c *APIClient) deviceStreamStopped(serialNumber string) error {
	_, status, err := c.doJSON("POST", "/device/stream/stopped", map[string]string{
		"serial_number": serialNumber,
	}, map[string]string{"X-Device-Key": c.DeviceKey})
	if err != nil {
		return err
	}
	if status != 200 {
		return fmt.Errorf("stream stopped failed: %d", status)
	}
	return nil
}

func (c *APIClient) deviceHeartbeat(serialNumber string) {
	c.doJSON("POST", "/device/heartbeat", map[string]string{
		"serial_number": serialNumber,
	}, map[string]string{"X-Device-Key": c.DeviceKey})
}

func (c *APIClient) userSubscribe(churchID int32, token string) error {
	_, status, err := c.doJSON("POST", fmt.Sprintf("/user/churches/%d/subscribe", churchID), nil,
		map[string]string{"Authorization": "Bearer " + token})
	if err != nil {
		return err
	}
	if status != 200 && status != 201 {
		return fmt.Errorf("subscribe failed: %d", status)
	}
	return nil
}

func (c *APIClient) userGetChurches(token string) {
	c.doJSON("GET", "/user/churches", nil,
		map[string]string{"Authorization": "Bearer " + token})
}

func (c *APIClient) userGetChurchStream(churchID int32, token string) {
	c.doJSON("GET", fmt.Sprintf("/user/churches/%d/stream", churchID), nil,
		map[string]string{"Authorization": "Bearer " + token})
}

// ============================================
// MOCK DATA
// ============================================

type MockChurch struct {
	ID         int32
	MachineID  int32
	SerialNum  string
	StreamID   string
	Name       string
	FFmpegProc *exec.Cmd
}

type MockUser struct {
	Email    string
	Password string
	Token    string
}

// ============================================
// FFMPEG STREAMER
// ============================================

func startFFmpeg(icecastURL, sourcePassword, streamID string) (*exec.Cmd, error) {
	mountURL := fmt.Sprintf("icecast://source:%s@%s/%s.mp3",
		sourcePassword, strings.TrimPrefix(icecastURL, "http://"), streamID)

	cmd := exec.Command("ffmpeg",
		"-re",
		"-f", "lavfi",
		"-i", "anullsrc=r=44100:cl=stereo",
		"-c:a", "libmp3lame",
		"-b:a", "128k",
		"-f", "mp3",
		"-content_type", "audio/mpeg",
		mountURL,
	)
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("ffmpeg start failed for %s: %v", streamID, err)
	}
	return cmd, nil
}

// ============================================
// ICECAST LISTENER
// ============================================

func simulateListener(ctx <-chan struct{}, icecastURL, streamID string, metrics *MetricsCollector, wg *sync.WaitGroup) {
	defer wg.Done()

	listenURL := fmt.Sprintf("%s/%s.mp3", icecastURL, streamID)

	resp, err := http.Get(listenURL)
	if err != nil {
		metrics.icecastFailed.Add(1)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		metrics.icecastFailed.Add(1)
		return
	}

	metrics.icecastConnected.Add(1)
	buf := make([]byte, 4096)

	for {
		select {
		case <-ctx:
			return
		default:
		}

		n, err := resp.Body.Read(buf)
		if n > 0 {
			metrics.icecastBytesTotal.Add(int64(n))
		}
		if err != nil {
			return
		}
	}
}

// ============================================
// API POLLER
// ============================================

func simulateAPIPoll(ctx <-chan struct{}, client *APIClient, churchID int32, token string, wg *sync.WaitGroup) {
	defer wg.Done()

	ticker := time.NewTicker(5*time.Second + time.Duration(rand.Intn(3000))*time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx:
			return
		case <-ticker.C:
			client.userGetChurchStream(churchID, token)
			// Occasionally also list churches
			if rand.Intn(5) == 0 {
				client.userGetChurches(token)
			}
		}
	}
}

// ============================================
// MAIN
// ============================================

func main() {
	apiURL := flag.String("api", "https://api.verbumdigital.it/api/v1", "Backend API base URL")
	icecastURL := flag.String("icecast", "http://vdserv.com:8000", "Icecast base URL")
	icecastPassword := flag.String("icecast-password", "r0j1e0A8bx", "Icecast source password")
	deviceKey := flag.String("device-key", "", "Device API key (X-Device-Key header)")
	adminEmail := flag.String("admin-email", "", "Admin email for login")
	adminPassword := flag.String("admin-password", "", "Admin password")
	profileName := flag.String("profile", "", "Test profile: light, medium-wide, many-churches, few-heavy, full")
	churches := flag.Int("churches", 0, "Number of mock churches (overrides profile)")
	listeners := flag.Int("listeners", 0, "Listeners per church (overrides profile)")
	duration := flag.Duration("duration", 2*time.Minute, "Test duration")
	rampUp := flag.Duration("ramp-up", 30*time.Second, "Ramp-up time for listeners")
	cleanupFlag := flag.Bool("cleanup", true, "Cleanup mock data after test")
	skipIcecast := flag.Bool("skip-icecast", false, "Skip Icecast streaming (API-only test)")

	flag.Parse()

	if *adminEmail == "" || *adminPassword == "" || *deviceKey == "" {
		fmt.Println("Uso: go run main.go --admin-email=... --admin-password=... --device-key=...")
		fmt.Println()
		fmt.Println("Flag obbligatori:")
		fmt.Println("  --admin-email       Email admin per creare dati mock")
		fmt.Println("  --admin-password    Password admin")
		fmt.Println("  --device-key        Device API key (da .env del server)")
		fmt.Println()
		fmt.Println("Profili disponibili (--profile):")
		for _, p := range defaultProfiles {
			fmt.Printf("  %-16s  %d chiese × %d listener = %d connessioni\n",
				p.Name, p.Churches, p.ListenersPerChurch, p.Churches*p.ListenersPerChurch)
		}
		fmt.Println()
		fmt.Println("Oppure valori custom: --churches=N --listeners=N")
		os.Exit(1)
	}

	numChurches := *churches
	numListeners := *listeners

	if *profileName != "" {
		for _, p := range defaultProfiles {
			if p.Name == *profileName {
				if numChurches == 0 {
					numChurches = p.Churches
				}
				if numListeners == 0 {
					numListeners = p.ListenersPerChurch
				}
				break
			}
		}
	}

	if numChurches == 0 || numListeners == 0 {
		fmt.Println("Specifica --profile oppure --churches e --listeners")
		os.Exit(1)
	}

	totalConns := numChurches * numListeners
	fmt.Println("╔═══════════════════════════════════════════════════════╗")
	fmt.Println("║          VERBUMDIGITAL — STRESS TEST                 ║")
	fmt.Println("╚═══════════════════════════════════════════════════════╝")
	fmt.Println()
	fmt.Printf("  Chiese:             %d\n", numChurches)
	fmt.Printf("  Listener/chiesa:    %d\n", numListeners)
	fmt.Printf("  Connessioni totali: %d\n", totalConns)
	fmt.Printf("  Durata:             %s\n", *duration)
	fmt.Printf("  Ramp-up:            %s\n", *rampUp)
	fmt.Printf("  Icecast:            %v\n", !*skipIcecast)
	fmt.Println()

	metrics := NewMetrics()

	client := &APIClient{
		BaseURL:    *apiURL,
		DeviceKey:  *deviceKey,
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
		Metrics:    metrics,
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// ─── PHASE 1: ADMIN LOGIN ────────────────────────
	fmt.Print("[1/6] Login admin... ")
	adminToken, err := client.adminLogin(*adminEmail, *adminPassword)
	if err != nil {
		fmt.Printf("ERRORE: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("OK")

	// Track mock data for cleanup
	var mockChurches []MockChurch
	var mockUsers []MockUser

	// Cleanup function — called on success or failure
	doCleanup := func() {
		if !*cleanupFlag || len(mockChurches) == 0 {
			return
		}
		fmt.Printf("  Pulizia dati mock (%d chiese + macchine)... ", len(mockChurches))
		for _, ch := range mockChurches {
			if ch.FFmpegProc != nil && ch.FFmpegProc.Process != nil {
				ch.FFmpegProc.Process.Kill()
				ch.FFmpegProc.Wait()
			}
			client.deviceStreamStopped(ch.SerialNum)
			client.adminDeleteChurch(ch.ID, adminToken)
			client.adminDeleteMachine(ch.MachineID, adminToken)
		}
		fmt.Println("OK")
		fmt.Println()
		fmt.Println("  NOTA: gli utenti mock (stressuser*@test.local) restano nel DB.")
		fmt.Println("  Per pulirli: DELETE FROM users WHERE email LIKE 'stressuser%@test.local';")
	}

	// ─── PHASE 2: CREATE MOCK DATA ──────────────────
	fmt.Printf("[2/6] Creazione %d macchine + chiese... ", numChurches)
	for i := 0; i < numChurches; i++ {
		serial := fmt.Sprintf("STRESS-%04d", i+1)

		machineID, err := client.adminCreateMachine(serial, adminToken)
		if err != nil {
			fmt.Printf("\n  ERRORE macchina %s: %v\n", serial, err)
			doCleanup()
			return
		}

		if err := client.adminActivateMachine(machineID, adminToken); err != nil {
			fmt.Printf("\n  ERRORE attivazione %s: %v\n", serial, err)
			doCleanup()
			return
		}

		churchName := fmt.Sprintf("StressTest Church %d", i+1)
		churchID, streamID, err := client.adminCreateChurch(churchName, machineID, adminToken)
		if err != nil {
			fmt.Printf("\n  ERRORE chiesa %s: %v\n", churchName, err)
			doCleanup()
			return
		}

		mockChurches = append(mockChurches, MockChurch{
			ID: churchID, MachineID: machineID, SerialNum: serial,
			StreamID: streamID, Name: churchName,
		})
	}
	fmt.Printf("OK (%d create)\n", len(mockChurches))

	// ─── PHASE 3: CREATE MOCK USERS ─────────────────
	fmt.Printf("[3/6] Creazione %d utenti e iscrizioni... ", totalConns)
	for i := 0; i < totalConns; i++ {
		email := fmt.Sprintf("stressuser%d@test.local", i+1)
		password := "stress123"

		token, err := client.userRegister(fmt.Sprintf("StressUser %d", i+1), email, password)
		if err != nil {
			token, err = client.userLogin(email, password)
			if err != nil {
				fmt.Printf("\n  ERRORE utente %d: %v\n", i+1, err)
				doCleanup()
				return
			}
		}

		mockUsers = append(mockUsers, MockUser{Email: email, Password: password, Token: token})

		churchIdx := i / numListeners
		if churchIdx < len(mockChurches) {
			client.userSubscribe(mockChurches[churchIdx].ID, token)
		}
	}
	fmt.Printf("OK (%d utenti)\n", len(mockUsers))

	// ─── PHASE 4: START ICECAST STREAMS ─────────────
	if !*skipIcecast {
		fmt.Printf("[4/6] Avvio %d stream ffmpeg... ", numChurches)
		for i := range mockChurches {
			cmd, err := startFFmpeg(*icecastURL, *icecastPassword, mockChurches[i].StreamID)
			if err != nil {
				fmt.Printf("\n  ERRORE ffmpeg %s: %v\n", mockChurches[i].StreamID, err)
				doCleanup()
				return
			}
			mockChurches[i].FFmpegProc = cmd
		}
		time.Sleep(3 * time.Second)
		fmt.Println("OK")
	} else {
		fmt.Println("[4/6] Icecast skip (--skip-icecast)")
	}

	// Notify backend that streams started
	fmt.Print("[5/6] Notifica stream/started al backend... ")
	for _, ch := range mockChurches {
		if err := client.deviceStreamStarted(ch.SerialNum); err != nil {
			fmt.Printf("\n  ERRORE started %s: %v\n", ch.SerialNum, err)
		}
	}
	fmt.Println("OK")

	// ─── PHASE 6: RAMP UP LISTENERS ─────────────────
	fmt.Printf("[6/6] Avvio %d listener (ramp-up %s)...\n", totalConns, *rampUp)

	stopCh := make(chan struct{})
	var listenerWg sync.WaitGroup
	var pollerWg sync.WaitGroup

	var heartbeatWg sync.WaitGroup
	for _, ch := range mockChurches {
		heartbeatWg.Add(1)
		go func(serial string) {
			defer heartbeatWg.Done()
			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-stopCh:
					return
				case <-ticker.C:
					client.deviceHeartbeat(serial)
				}
			}
		}(ch.SerialNum)
	}

	listenerDelay := *rampUp / time.Duration(totalConns)
	if listenerDelay < time.Millisecond {
		listenerDelay = time.Millisecond
	}

	rampDone := make(chan struct{})

	go func() {
		for i, ch := range mockChurches {
			for j := 0; j < numListeners; j++ {
				select {
				case <-stopCh:
					close(rampDone)
					return
				default:
				}

				userIdx := i*numListeners + j
				if userIdx >= len(mockUsers) {
					break
				}

				if !*skipIcecast {
					listenerWg.Add(1)
					go simulateListener(stopCh, *icecastURL, ch.StreamID, metrics, &listenerWg)
				}

				pollerWg.Add(1)
				go simulateAPIPoll(stopCh, client, ch.ID, mockUsers[userIdx].Token, &pollerWg)

				time.Sleep(listenerDelay)
			}
		}
		close(rampDone)
	}()

	// Print live stats while running
	statsTicker := time.NewTicker(10 * time.Second)
	testTimer := time.NewTimer(*duration)
	startTime := time.Now()

	fmt.Println()
	fmt.Println("  [LIVE] In esecuzione... (Ctrl+C per terminare anticipatamente)")
	fmt.Println()

RunLoop:
	for {
		select {
		case <-statsTicker.C:
			elapsed := time.Since(startTime).Round(time.Second)
			connected := metrics.icecastConnected.Load()
			bytesTotal := metrics.icecastBytesTotal.Load()
			mbReceived := float64(bytesTotal) / 1024 / 1024

			var totalAPIReqs int64
			var totalAPIErrs int64
			for _, m := range metrics.endpoints {
				m.mu.Lock()
				totalAPIReqs += m.Total
				totalAPIErrs += m.Errors
				m.mu.Unlock()
			}

			fmt.Printf("  [%s] Icecast: %d connessi | API: %d req (%d err) | %.1f MB ricevuti\n",
				elapsed, connected, totalAPIReqs, totalAPIErrs, mbReceived)

		case <-testTimer.C:
			fmt.Println()
			fmt.Println("  Durata raggiunta. Arresto...")
			break RunLoop

		case <-sigCh:
			fmt.Println()
			fmt.Println("  Interruzione manuale. Arresto...")
			break RunLoop
		}
	}

	statsTicker.Stop()
	testTimer.Stop()

	// Stop everything
	close(stopCh)
	<-rampDone
	listenerWg.Wait()
	pollerWg.Wait()
	heartbeatWg.Wait()

	// Notify backend that streams stopped
	fmt.Print("  Chiusura stream... ")
	for _, ch := range mockChurches {
		client.deviceStreamStopped(ch.SerialNum)
	}
	fmt.Println("OK")

	// Kill ffmpeg processes
	if !*skipIcecast {
		for _, ch := range mockChurches {
			if ch.FFmpegProc != nil && ch.FFmpegProc.Process != nil {
				ch.FFmpegProc.Process.Kill()
				ch.FFmpegProc.Wait()
			}
		}
	}

	// ─── REPORT ──────────────────────────────────────
	fmt.Println()
	fmt.Println("╔═══════════════════════════════════════════════════════╗")
	fmt.Println("║                    RISULTATI                         ║")
	fmt.Println("╚═══════════════════════════════════════════════════════╝")
	fmt.Println()

	fmt.Println("── API Endpoints ──")
	var names []string
	for n := range metrics.endpoints {
		names = append(names, n)
	}
	sort.Strings(names)
	for _, n := range names {
		fmt.Print(metrics.endpoints[n].Report())
	}

	fmt.Println()
	fmt.Println("── Icecast ──")
	fmt.Printf("  Connessioni riuscite:   %d\n", metrics.icecastConnected.Load())
	fmt.Printf("  Connessioni fallite:    %d\n", metrics.icecastFailed.Load())
	finalBytes := metrics.icecastBytesTotal.Load()
	fmt.Printf("  Dati ricevuti totali:   %.1f MB\n", float64(finalBytes)/1024/1024)
	fmt.Println()

	// ─── CLEANUP ─────────────────────────────────────
	doCleanup()

	fmt.Println()
	fmt.Println("  Test completato.")
}
