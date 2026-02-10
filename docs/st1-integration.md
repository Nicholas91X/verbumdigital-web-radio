Integrazione ST1
Overview
La scheda ST1 è il componente hardware nel mixer S-Mix che gestisce lo streaming audio verso Icecast. Esegue il firmware smixRest che espone un'API REST sulla porta 8080 in rete locale.
Firmware: smixRest
Binario fornito da Svilen. Ultima versione: smixRest (2026-02-06).
Endpoint locali (porta 8080)
MetodoEndpointDescrizioneGET/api/device/st1/statusStato correnteGET/api/device/st1/setupLeggi configurazione streamPOST/api/device/st1/setupConfigura URL streamPOST/api/device/st1/playAvvia streamingPOST/api/device/st1/stopFerma streaming
Stati possibili
StatoSignificatonoidNessuna configurazione stream impostatastoppedConfigurato ma fermostreamingStream attivo verso Icecast
Formato stream URL
icecast://source:{stream_key}@vdserv.com:8000/{stream_id}.mp3
Esempio reale dal test di Svilen:
icecast://source:r0j1e0A8bx@vdserv.com:8000/stream123.mp3
Comunicazione ST1 ↔ Backend
La ST1 comunica con il backend su Hetzner per:

Validare credenziali prima di iniziare lo stream
Notificare che lo stream è partito/fermato

Autenticazione
Header: X-Device-Key: <chiave_condivisa>
Flusso completo
1. Priest PWA → Backend:  POST /priest/churches/:id/stream/start
   Backend crea sessione, ritorna stream_id + stream_key

2. Priest PWA → ST1:      POST /api/device/st1/setup
   Body: { "stream_url": "icecast://source:{key}@vdserv.com:8000/{id}.mp3" }

3. Priest PWA → ST1:      POST /api/device/st1/play

4. ST1 → Backend:         POST /device/validate
   Body: { "stream_id": "...", "stream_key": "..." }
   Backend verifica credenziali + macchina attivata

5. ST1 → Backend:         POST /device/stream/started
   Body: { "stream_id": "..." }
   Backend conferma streaming_active = true

6. Audio fluisce: ST1 → Icecast (vdserv.com:8000)

7. Per fermare:
   Priest PWA → ST1:      POST /api/device/st1/stop
   ST1 → Backend:         POST /device/stream/stopped
   Priest PWA → Backend:  POST /priest/churches/:id/stream/stop
Safety net
L'endpoint POST /device/stream/stopped funge da safety net: se lo stream si interrompe inaspettatamente (connessione persa, ST1 riavviata), la notifica assicura che il DB sia consistente (streaming_active = false, sessione chiusa).
Hardware

CPU: Allwinner A13
Interfaccia: LAN (Ethernet)
Audio: 2 canali output (stereo) dalla matrice S-Mix
Bus interno: SPI (per identificazione schede e comandi semplici play/stop)
Formato output: MP3
Bitrate: ~1MB/min (~60MB/ora)

SD Card Image
Ultima immagine SD: smixST1_20260206.7z
Download: http://78.83.222.98/musicare/smixST1_20260206.7z
Note per lo sviluppo

smixRest gira su porta 8080 — il backend API usa porta 8081 per evitare conflitti in dev
In produzione ST1 e backend sono su reti diverse (ST1 in locale nella chiesa, backend su Hetzner)
La Priest PWA deve poter comunicare con entrambi: ST1 in LAN e backend via internet
Il campo current_time in /status indica i secondi di streaming dall'avvio