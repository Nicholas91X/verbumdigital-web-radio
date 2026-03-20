Integrazione ST1

## Overview

La scheda ST1 è il componente hardware nel mixer S-Mix che gestisce lo streaming audio verso Icecast. Esegue il firmware smixRest che espone un'API REST sulla porta 8080 in rete locale. La ST1 è l'**iniziatore** dello streaming: av-control (PWA locale sulla ST1, porta 80) gestisce setup/play/stop, e la ST1 notifica il backend VerbumDigital tramite callback HTTP.

## Firmware: smixRest

Binario fornito da Svilen. Ultima versione: smixRest (2026-02-06).

### Endpoint locali (porta 8080)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | /api/device/st1/status | Stato corrente |
| GET | /api/device/st1/setup | Leggi configurazione stream |
| POST | /api/device/st1/setup | Configura URL stream |
| POST | /api/device/st1/play | Avvia streaming |
| POST | /api/device/st1/stop | Ferma streaming |

### Stati possibili

| Stato | Significato |
|-------|-------------|
| noid | Nessuna configurazione stream impostata |
| stopped | Configurato ma fermo |
| streaming | Stream attivo verso Icecast |

### Formato stream URL

```
icecast://source:{global_password}@vdserv.com:8000/{stream_id}.mp3
```

Esempio reale dal test di Svilen:
```
icecast://source:r0j1e0A8bx@vdserv.com:8000/stream123.mp3
```

**Nota:** La password Icecast è globale (una sola per tutti i mount) e pre-configurata sulla ST1. Il backend non la conosce e non la gestisce.

## Comunicazione ST1 → Backend

La ST1 comunica con il backend su Hetzner per:
1. **Validare** il serial number e ottenere la configurazione Icecast
2. **Notificare** che lo stream è partito (→ crea sessione nel DB)
3. **Notificare** che lo stream è terminato (→ chiude sessione nel DB)

### Autenticazione

Header: `X-Device-Key: <chiave_condivisa>`

## Flusso completo (ST1-driven)

```
1. av-control → ST1:     POST /api/device/st1/setup
   Body: { "stream_url": "icecast://source:{password}@vdserv.com:8000/{stream_id}.mp3" }

2. av-control → ST1:     POST /api/device/st1/play

3. ST1 → Backend:        POST /device/validate
   Body: { "serial_number": "SMIX-12345" }
   Backend: lookup serial → machine → church → streaming_credentials
   Response: { "valid": true, "church_id": 1, "stream_id": "...", "icecast_url": "...", "mount": "..." }

4. ST1 → Backend:        POST /device/stream/started
   Body: { "serial_number": "SMIX-12345" }
   Backend: CREA sessione streaming (started_by_priest_id = null)
   Response: { "success": true, "session_id": 5, "church_id": 1 }

5. Audio fluisce: ST1 → Icecast (vdserv.com:8000)
   Priest PWA monitora lo stato in tempo reale (polling GET /stream/status)

6. Per fermare:
   av-control → ST1:     POST /api/device/st1/stop
   ST1 → Backend:        POST /device/stream/stopped
   Body: { "serial_number": "SMIX-12345" }
   Backend: chiude sessione (ended_at, duration), reset church status
```

**Differenze rispetto al vecchio flusso:**
- La Priest PWA **non** controlla più ST1 (era: PWA → setup → play → start session)
- Le sessioni sono create dal callback `stream/started`, non dalla Priest PWA
- Il backend identifica la chiesa tramite `serial_number` (era: `stream_id` + `stream_key`)
- La Priest PWA è ora **read-only** (monitoring + storico sessioni)

## Safety net

L'endpoint `POST /device/stream/stopped` funge da safety net: se lo stream si interrompe inaspettatamente (connessione persa, ST1 riavviata), la notifica assicura che il DB sia consistente (streaming_active = false, sessione chiusa).

Entrambi gli endpoint started/stopped sono **idempotenti**:
- `started` con stream già attivo → ritorna session_id esistente
- `stopped` senza stream attivo → ritorna success senza errore

## Hardware

- CPU: Allwinner A13
- Interfaccia: LAN (Ethernet)
- Audio: 2 canali output (stereo) dalla matrice S-Mix
- Bus interno: SPI (per identificazione schede e comandi semplici play/stop)
- Formato output: MP3
- Bitrate: ~1MB/min (~60MB/ora)

## SD Card Image

Ultima immagine SD: smixST1_20260206.7z
Download: http://78.83.222.98/musicare/smixST1_20260206.7z

## Note per lo sviluppo

- smixRest gira su porta 8080, av-control su porta 80 — il backend API usa porta 8081
- In produzione ST1 e backend sono su reti diverse (ST1 in locale nella chiesa, backend su Hetzner)
- La ST1 deve poter raggiungere il backend via internet per i callback
- Il campo `current_time` in /status indica i secondi di streaming dall'avvio
- `serial_number` corrisponde al campo `machine_id` nella tabella `machines`