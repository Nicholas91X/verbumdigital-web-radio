# VerbumDigital — Production Deployment & Smoke Test Plan

## Panoramica

Questo piano copre il deploy del backend aggiornato (ST1-driven + Push Notifications) su Hetzner e la strategia di verifica completa **senza hardware ST1**.

---

## Pre-Deploy Checklist

### 1. Backup Database

```bash
# Dal server Hetzner (SSH porta 2200, user nicholas)
ssh -p 2200 nicholas@vdserv.com

# Dump completo
mysqldump -u st1stream -p'4ifK(E)OrrQ-pi6y' st1 > /opt/verbumdigital/backups/st1_pre_deploy_$(date +%Y%m%d_%H%M%S).sql
```

> ⚠️ **Obbligatorio.** Il nuovo backend esegue `AutoMigrate` all'avvio che modifica lo schema (aggiunge tabella `push_subscriptions`, rende `stream_key` nullable). Se qualcosa va storto, questo dump è l'unica via di rollback.

### 2. Generare VAPID Keys (una tantum)

Le Push Notifications richiedono una coppia di chiavi VAPID. Generarle **una sola volta** per la produzione:

```bash
# In locale (richiede Node.js)
npx web-push generate-vapid-keys
```

Output:
```
Public Key:  BLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Annotare entrambe. La chiave pubblica va sia nel backend `.env` che nel frontend User PWA `.env.production`.

### 3. Certificato HTTPS

Le Push Notifications **funzionano solo sotto HTTPS**. Verificare che Caddy sia attivo e che `api.verbumdigital.com` abbia un certificato SSL valido:

```bash
curl -I https://api.verbumdigital.com
# Deve restituire HTTP/2 200 (o 404 se il backend non è ancora attivo)
```

Se il dominio non è ancora configurato in Caddy, aggiungerlo al Caddyfile prima di procedere.

---

## Deploy Backend

### 4. Compilare il binario

In locale, nella cartella `backend/`:

```powershell
# Windows (PowerShell)
$Env:GOOS = "linux"
$Env:GOARCH = "amd64"
go build -o vd-server ./cmd/server

# macOS/Linux
GOOS=linux GOARCH=amd64 go build -o vd-server ./cmd/server
```

### 5. Upload e configurazione

```bash
# Upload binario
scp -P 2200 backend/vd-server nicholas@vdserv.com:/opt/verbumdigital/backend/vd-server.new

# SSH sul server
ssh -p 2200 nicholas@vdserv.com
```

### 6. Configurare `.env` produzione

Editare `/opt/verbumdigital/backend/.env`:

```ini
PORT=8081

# Database (MySQL locale su Hetzner)
DB_HOST=localhost
DB_PORT=3306
DB_USER=st1stream
DB_PASSWORD=4ifK(E)OrrQ-pi6y
DB_NAME=st1

# JWT
JWT_SECRET=<stringa_random_almeno_32_chars>
JWT_EXPIRATION_HOURS=720

# Icecast (solo URL base — la source password è sull'ST1)
ICECAST_BASE_URL=http://vdserv.com:8000

# ST1 Device Authentication
DEVICE_API_KEY=<chiave_segreta_per_st1>

# Push Notifications (VAPID — generati allo step 2)
VAPID_PUBLIC_KEY=<chiave_pubblica_dal_passo_2>
VAPID_PRIVATE_KEY=<chiave_privata_dal_passo_2>
VAPID_EMAIL=admin@verbumdigital.com
```

> **Nota:** Non esiste `DB_DSN` — il backend compone il DSN MySQL internamente a partire dalle variabili `DB_*` separate.

### 7. Swap e riavvio

```bash
cd /opt/verbumdigital/backend

# Swap atomico
sudo systemctl stop verbumdigital
mv vd-server vd-server.old
mv vd-server.new vd-server
chmod +x vd-server
sudo systemctl start verbumdigital

# Verifica
sudo systemctl status verbumdigital
sudo journalctl -u verbumdigital -f --no-pager -n 50
```

Nei log dovresti vedere:
```
Database migrated successfully
Server starting on :8081
```

Se ci sono errori, rollback immediato:
```bash
sudo systemctl stop verbumdigital
mv vd-server vd-server.broken
mv vd-server.old vd-server
sudo systemctl start verbumdigital
```

---

## Deploy Frontend User PWA

### 8. Configurare `.env.production`

In `frontend/user/.env.production`:

```ini
VITE_API_BASE_URL=https://api.verbumdigital.com/api/v1
VITE_VAPID_PUBLIC_KEY=<stessa_chiave_pubblica_del_backend>
```

### 9. Build e upload

```bash
cd frontend/user
npm run build

# Upload dist
scp -P 2200 -r dist/* nicholas@vdserv.com:/var/www/user/
```

Ripetere per `frontend/priest` e `frontend/admin` (senza VAPID, hanno solo `VITE_API_BASE_URL`).

---

## Smoke Test — Verifica Senza ST1

Questo test simula l'intero ciclo di vita di una diretta usando solo `curl`, validando: risoluzione serial → sessione DB → push notification → UI real-time.

### 10. Preparare i dati di test

Dall'Admin PWA (`https://admin.verbumdigital.com`):

1. Creare una **Macchina** con ID: `SMIX-PROD-TEST`
2. **Attivare** la macchina
3. Creare una **Chiesa di test** (es. "Test Push Notification") assegnata a questa macchina
4. Verificare che la chiesa abbia streaming credentials create automaticamente

### 11. Test Step 1 — Validate

Verifica che il backend risolva correttamente serial → church:

```bash
curl -s -X POST https://api.verbumdigital.com/api/v1/device/validate \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: <TUO_DEVICE_API_KEY>" \
  -d '{"serial_number": "SMIX-PROD-TEST"}' | jq .
```

**Risposta attesa:**
```json
{
  "valid": true,
  "church_id": <N>,
  "stream_id": "stream...",
  "icecast_url": "http://vdserv.com:8000",
  "mount": "/stream....mp3"
}
```

> Se errore 404: la macchina non esiste o non è collegata a una chiesa.
> Se errore 403: la macchina non è attivata.

### 12. Test Step 2 — Iscrizione Push

Prima di simulare la diretta, assicurati di avere un utente iscritto alla chiesa di test con notifiche abilitate:

1. Apri la User PWA (`https://app.verbumdigital.com`) su smartphone/browser
2. Login con un account utente
3. Iscriviti alla chiesa "Test Push Notification"
4. Accetta la richiesta di notifiche push del browser

### 13. Test Step 3 — Stream Started

Simula l'avvio della diretta:

```bash
curl -s -X POST https://api.verbumdigital.com/api/v1/device/stream/started \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: <TUO_DEVICE_API_KEY>" \
  -d '{"serial_number": "SMIX-PROD-TEST"}' | jq .
```

**Risposta attesa:**
```json
{
  "success": true,
  "church_id": <N>,
  "session_id": <M>
}
```

**Verifiche immediate:**
- [ ] **Push notification** ricevuta su smartphone/browser ("Chiesa Test Push Notification è in diretta")
- [ ] **User PWA**: la chiesa mostra stato **IN DIRETTA** con timer che scorre
- [ ] **Priest PWA**: la chiesa mostra badge **LIVE** con durata
- [ ] **Database**: `SELECT * FROM streaming_sessions ORDER BY id DESC LIMIT 1` mostra la sessione attiva con `started_by_priest_id = NULL`

> **Nota:** Non ci sarà audio reale su Icecast (nessun encoder sta mandando dati). La UI mostrerà "in diretta" ma il player audio non riprodurrà nulla. Questo è normale per lo smoke test.

### 14. Test Step 4 — Stream Stopped

Chiudi la diretta simulata:

```bash
curl -s -X POST https://api.verbumdigital.com/api/v1/device/stream/stopped \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: <TUO_DEVICE_API_KEY>" \
  -d '{"serial_number": "SMIX-PROD-TEST"}' | jq .
```

**Verifiche:**
- [ ] User PWA: la chiesa torna a stato **non in diretta** (entro 10-15 secondi, polling)
- [ ] Priest PWA: badge torna a **STBY**
- [ ] Database: la sessione ha `ended_at` e `duration_seconds` valorizzati

### 15. Test Step 5 — Idempotenza

Verifica che chiamate duplicate non causino problemi:

```bash
# Doppio started (deve restituire successo con "Stream already active")
curl -s -X POST .../device/stream/started ... -d '{"serial_number": "SMIX-PROD-TEST"}' | jq .
curl -s -X POST .../device/stream/started ... -d '{"serial_number": "SMIX-PROD-TEST"}' | jq .

# Doppio stopped (deve restituire successo con "No active stream")
curl -s -X POST .../device/stream/stopped ... -d '{"serial_number": "SMIX-PROD-TEST"}' | jq .
curl -s -X POST .../device/stream/stopped ... -d '{"serial_number": "SMIX-PROD-TEST"}' | jq .
```

---

## Checklist di Verifica Completa

| # | Test | Risultato |
|---|------|-----------|
| 1 | Backend avviato senza errori | ☐ |
| 2 | AutoMigrate completato (push_subscriptions creata) | ☐ |
| 3 | `/device/validate` risolve serial → church | ☐ |
| 4 | `/device/stream/started` crea sessione | ☐ |
| 5 | Push notification ricevuta | ☐ |
| 6 | User PWA mostra LIVE con timer | ☐ |
| 7 | Priest PWA mostra LIVE | ☐ |
| 8 | `/device/stream/stopped` chiude sessione | ☐ |
| 9 | UI torna a stato non-live | ☐ |
| 10 | Chiamate idempotenti funzionano | ☐ |

---

## Rollback Plan

**Se il backend non parte (errore AutoMigrate o altro):**

```bash
# 1. Stoppa il backend
sudo systemctl stop verbumdigital

# 2. Ripristina il binario precedente
mv vd-server vd-server.broken
mv vd-server.old vd-server

# 3. Ripristina il database (se AutoMigrate ha corrotto qualcosa)
mysql -u st1stream -p'4ifK(E)OrrQ-pi6y' st1 < /opt/verbumdigital/backups/st1_pre_deploy_XXXXXXXX.sql

# 4. Ripristina il vecchio .env (se modificato)
cp .env.backup .env

# 5. Riavvia
sudo systemctl start verbumdigital
sudo systemctl status verbumdigital
```

**Se le push notification non funzionano:**
- Verificare che le VAPID keys siano identiche tra backend `.env` e frontend `.env.production`
- Verificare HTTPS attivo (le push non funzionano su HTTP)
- Controllare i log: `sudo journalctl -u verbumdigital | grep Push`
- Il backend non si blocca se le push falliscono (invio asincrono con `go`)

---

## Post-Deploy

Dopo aver completato lo smoke test con successo:

1. **Rimuovere la macchina di test** (`SMIX-PROD-TEST`) dall'Admin PWA o lasciarla per test futuri
2. **Aggiornare CLAUDE.md** — segnare Push Notifications come ✅ Done
3. **Comunicare a Svilen** la `DEVICE_API_KEY` scelta, da configurare sulle ST1 reali