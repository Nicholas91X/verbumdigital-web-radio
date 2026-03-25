# VerbumDigital — Riferimento Operativo

Guida rapida per compilazione, deploy, gestione server e database.

---

## Connessione al Server

```bash
ssh -i ~/.ssh/id_ed25519_vdserv -p 2200 nicholas@vdserv.com
```

**Dati server:**
- Host: `vdserv.com` (IP: 195.201.138.249)
- Porta SSH: `2200`
- Utente: `nicholas`
- Auth: chiave `id_ed25519_vdserv`

---

## Backend Go — Compilazione e Deploy

### 1. Compila per Linux (da PowerShell Windows)

```powershell
cd C:\Users\Principale\Desktop\Progetti\verbumdigital-web-radio\backend
$env:GOOS="linux"; $env:GOARCH="amd64"; go build -o vd-server ./cmd/server
```

### 2. Copia il binario sul server

```powershell
scp -i $env:USERPROFILE\.ssh\id_ed25519_vdserv -P 2200 vd-server nicholas@vdserv.com:/home/nicholas/vd-server-new
```

### 3. Sostituisci il binario e riavvia il servizio (sul server)

```bash
sudo systemctl stop verbumdigital
sudo mv /home/nicholas/vd-server-new /opt/verbumdigital/backend/vd-server
sudo chmod +x /opt/verbumdigital/backend/vd-server
sudo systemctl start verbumdigital
```

### 4. Verifica stato servizio

```bash
sudo systemctl status verbumdigital
```

### 5. Guarda i log in tempo reale

```bash
sudo journalctl -u verbumdigital -f
```

### 6. Guarda gli ultimi 100 log

```bash
sudo journalctl -u verbumdigital -n 100 --no-pager
```

---

## Gestione Servizio systemd

| Azione | Comando |
|--------|---------|
| Avvia | `sudo systemctl start verbumdigital` |
| Ferma | `sudo systemctl stop verbumdigital` |
| Riavvia | `sudo systemctl restart verbumdigital` |
| Stato | `sudo systemctl status verbumdigital` |
| Log live | `sudo journalctl -u verbumdigital -f` |
| Abilita all'avvio | `sudo systemctl enable verbumdigital` |

**Percorsi importanti sul server:**
- Binario: `/opt/verbumdigital/backend/vd-server`
- Config `.env`: `/opt/verbumdigital/backend/.env`
- Definizione servizio: `/etc/systemd/system/verbumdigital.service`

---

## Modifica .env sul Server

```bash
sudo nano /opt/verbumdigital/backend/.env
```

Salva: `Ctrl+O` → `Enter` → `Ctrl+X`

Poi riavvia:
```bash
sudo systemctl restart verbumdigital
```

---

## Database MySQL

### Connessione

```bash
mysql -u st1stream -p'4ifK(E)OrrQ-pi6y' st1
```

### Query utili

```sql
-- Lista chiese con stato Stripe
SELECT id, name, stripe_account_id, stripe_onboarding_complete FROM churches;

-- Reset account Stripe per una chiesa
UPDATE churches SET stripe_account_id = NULL, stripe_onboarding_complete = 0 WHERE id = X;

-- Lista sessioni attive
SELECT id, church_id, started_at, ended_at, donation_active FROM streaming_sessions WHERE ended_at IS NULL;

-- Chiudi manualmente una sessione bloccata
UPDATE streaming_sessions SET ended_at = NOW(), duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW()) WHERE id = X;
UPDATE churches SET streaming_active = 0, current_session_id = NULL WHERE id = X;

-- Lista donazioni
SELECT id, church_id, amount, status, donor_email, created_at FROM donations ORDER BY created_at DESC;

-- Lista preset donazione
SELECT id, church_id, name, amounts, is_default FROM donation_presets;
```

---

## Frontend — Deploy

Il frontend si deploya automaticamente su **Vercel** ad ogni `git push` su `main`.

```bash
git add .
git commit -m "descrizione"
git push
```

Vercel builderà e pubblicherà automaticamente tutte e tre le PWA:
- Admin: `https://admin.verbumdigital.it`
- Priest: `https://priest.verbumdigital.it`
- User: `https://app.verbumdigital.it`

---

## Stripe — Operazioni

### Crea webhook classico V1 via API (bypass Workbench)

```bash
curl https://api.stripe.com/v1/webhook_endpoints \
  -u sk_test_XXXX_CHIAVE_NEL_ENV_DEL_SERVER: \
  -d url="https://api.verbumdigital.it/api/v1/stripe/webhook" \
  -d "enabled_events[]"="checkout.session.completed"
```

> La risposta contiene `"secret": "whsec_..."` — aggiornarlo nel `.env` come `STRIPE_WEBHOOK_SECRET`.

### Lista webhook esistenti

```bash
curl https://api.stripe.com/v1/webhook_endpoints \
  -u sk_test_XXXX_CHIAVE_NEL_ENV_DEL_SERVER:
```

### Elimina un webhook

```bash
curl -X DELETE https://api.stripe.com/v1/webhook_endpoints/we_XXXXX \
  -u sk_test_XXXX_CHIAVE_NEL_ENV_DEL_SERVER:
```

### Carta di test Stripe

| Campo | Valore |
|-------|--------|
| Numero carta | `4242 4242 4242 4242` |
| Scadenza | qualsiasi data futura |
| CVV | qualsiasi 3 cifre |
| Nome | qualsiasi |

---

## Apache — Comandi Utili

```bash
# Verifica config Apache
sudo apache2ctl configtest

# Riavvia Apache
sudo systemctl restart apache2

# Guarda config sito API
sudo cat /etc/apache2/sites-enabled/api-verbumdigital-it-le-ssl.conf

# Log Apache
sudo tail -f /var/log/apache2/error.log
sudo tail -f /var/log/apache2/access.log
```

---

## Flusso Completo Deploy Backend

```
1. Modifica codice in locale
2. go build (Windows → Linux)
3. scp binario → server
4. systemctl stop → mv → chmod → systemctl start
5. systemctl status (verifica)
6. journalctl -f (controlla log)
```

## Flusso Completo Deploy Frontend

```
1. Modifica codice in locale
2. git add + git commit + git push
3. Attendi build Vercel (~2 min)
4. Testa sulla PWA
```
