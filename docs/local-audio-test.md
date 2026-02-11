# Test Audio Locale (End-to-End)

Questa guida spiega come testare l'intero flusso audio (Streaming -> Server -> Ascolto) in ambiente locale usando Docker e il simulatore ST1.

## Prerequisiti

1. **Docker Desktop** attivo.
2. **FFmpeg** installato e disponibile nel PATH di sistema.
3. Repository clonata e dipendenze installate (`npm install`, `go mod download`).

## Setup Ambiente

### 1. Avviare i Servizi Docker

Assicurati che il database e il server Icecast siano attivi:

```bash
docker compose up -d mysql icecast
```


Il server Icecast sarà accessibile su `http://localhost:8000`.

### 2. Configurazione Backend

Modifica `backend/.env` per usare Icecast locale invece di produzione:

```ini
# Icecast streaming server
# --- PRODUCTION (Hetzner Icecast) ---
# ICECAST_BASE_URL=http://vdserv.com:8000
# ICECAST_SOURCE_PASSWORD=r0j1e0A8bx

# --- LOCAL TESTING (Docker Icecast) ---
ICECAST_BASE_URL=http://localhost:8000
ICECAST_SOURCE_PASSWORD=hackme
```

Aggiorna anche la password nel database:
```bash
docker exec vd-mysql mysql -ust1stream -p"4ifK(E)OrrQ-pi6y" -e "UPDATE streaming_credentials SET stream_key = 'hackme';" st1stream
```

Riavvia il backend:
```bash
cd backend
go run cmd/server/main.go
```

### 3. Avvio Tool di Simulazione (Mock ST1)

Avvia il simulatore ST1 in modalità **LIVE** per abilitare l'invio di audio reale tramite FFmpeg:

```bash
node tools/mock-st1.js --live
```

Dovresti vedere: `🔴 LIVE AUDIO MODE ARMED (FFmpeg)`.

## Esecuzione del Test

1. **Accedi alla Priest PWA** (`http://localhost:3001`) con le credenziali (es. `padre@test.com`).
2. Clicca su **Avvia Stream**.
   - Il mock ST1 loggherà: `[ST1] Starting FFmpeg to icecast://...`
3. **Accedi alla User PWA** (`http://localhost:3002`).
4. Vai alla chiesa che sta trasmettendo (es. "San Marco").
5. Verifica che lo stato sia **LIVE**.
6. Clicca per ascoltare.

> 🔊 **Dovresti sentire un tono continuo a 440Hz (fischio).**

## Risoluzione Problemi

- **Errore 404 su User PWA**: Il server Icecast non sta ricevendo lo stream. Controlla i log di `mock-st1.js`.
- **Nessun audio**: Verifica che FFmpeg sia installato (`ffmpeg -version`).
- **Credenziali Errate**: Assicurati che nel DB `streaming_credentials` la `stream_key` sia `hackme` (default per l'immagine Docker di Icecast).
  ```sql
  UPDATE streaming_credentials SET stream_key = 'hackme' WHERE id = 1;
  ```

## Ripristino Configurazione Produzione

Dopo aver completato i test locali, ripristina la configurazione di produzione:

1. **Modifica `backend/.env`:**
   ```ini
   # Icecast streaming server
   # --- PRODUCTION (Hetzner Icecast) ---
   ICECAST_BASE_URL=http://vdserv.com:8000
   ICECAST_SOURCE_PASSWORD=r0j1e0A8bx

   # --- LOCAL TESTING (Docker Icecast) ---
   # ICECAST_BASE_URL=http://localhost:8000
   # ICECAST_SOURCE_PASSWORD=hackme
   ```

2. **Aggiorna la password nel database:**
   ```bash
   docker exec vd-mysql mysql -ust1stream -p"4ifK(E)OrrQ-pi6y" -e "UPDATE streaming_credentials SET stream_key = 'r0j1e0A8bx';" st1stream
   ```

3. **Riavvia il backend:**
   ```bash
   cd backend
   go run cmd/server/main.go
   ```

