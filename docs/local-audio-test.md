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

Modifica `backend/.env` per puntare al server Icecast locale:

```ini
# ICECAST_BASE_URL=http://vdserv.com:8000
ICECAST_BASE_URL=http://localhost:8000
```

Riavvia il backend:
```bash
cd backend
go run cmd/server/main.go
```

### 3. Configurazione Frontend (Priest PWA)

Modifica `frontend/priest/src/pages/DashboardPage.tsx` (temporaneamente) per usare l'URL locale nel metodo `handleStartStream`:

```typescript
// LOCAL TESTING:
const streamUrl = `icecast://source:${status.stream_key}@localhost:8000/${status.stream_id}.mp3`;
```

*Nota: Ricordati di ripristinare il codice per la produzione dopo il test.*

### 4. Avvio Tool di Simulazione (Mock ST1)

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
