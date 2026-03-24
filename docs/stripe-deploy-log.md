# VerbumDigital — Deploy Stripe Connect: Log e Riferimento

**Data:** 24 marzo 2026
**Autore:** Nicholas
**Stato:** Completato ✅

---

## 1. Contesto

Implementazione del sistema donazioni con **Stripe Connect (direct charges)** sulla piattaforma VerbumDigital. Ogni chiesa ha il proprio account Stripe Express; i fondi vanno direttamente alla chiesa senza passare per VerbumDigital.

---

## 2. Bug e mismatch corretti nel codice (prima del deploy)

### 2.1 Migrazione DB mancante
**Problema:** Non esisteva `migrations/003_stripe_donations.sql`. Le nuove colonne e tabelle non erano applicate in produzione.
**Fix:** Creato `backend/migrations/003_stripe_donations.sql` con ALTER TABLE e CREATE TABLE completi.

### 2.2 Variabili d'ambiente mancanti nel `.env` locale
**Problema:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_BASE_URL` assenti.
**Fix:** Aggiunti nel `backend/.env` locale (con placeholder per webhook).

### 2.3 `admin_handler.go` — chiave JSON errata
**Problema:** Il backend restituiva `total_amount`, il frontend si aspettava `total_amount_cents`.
**Fix:** `backend/internal/handlers/admin_handler.go` → chiave rinominata in `total_amount_cents`.

### 2.4 `shared/api/types.ts` — tipi non allineati al modello Go
**Problema:**
- `DonationPreset.amount_cents: number` → il backend ha `amounts: []int` (array)
- `DonationPreset.currency` e `updated_at` non esistono nel modello Go
- `Donation.amount_cents` → il backend ha `amount`
- `Donation.donor_name` / `donor_email` → non esistono nel modello Go (il backend espone `user` preloaded)

**Fix:** `frontend/shared/api/types.ts` aggiornato:
```typescript
interface DonationPreset {
    amounts: number[];   // era amount_cents: number
    // rimossi currency, updated_at
}
interface Donation {
    amount: number;      // era amount_cents
    user?: { id, name, email };  // erano donor_name/donor_email flat
    status: 'pending' | 'completed' | 'failed';
}
```

### 2.5 `priest/SettingsPage.tsx` — payload e display errati
**Problema:** Creazione preset inviava `{ amount_cents, currency }`, backend si aspetta `{ amounts: [] }`.
**Fix:**
```typescript
// Prima
{ amount_cents: amountCents, currency: "eur", is_default: isDefault }

// Dopo
{ amounts: [amountCents], is_default: isDefault }
```
Display: da `p.amount_cents` a `p.amounts.map(a => €${(a/100).toFixed(2)}).join(' · ')`.

### 2.6 `admin/ChurchesPage.tsx` — tre mismatch
| Riga | Prima | Dopo |
|------|-------|------|
| Amount display | `d.amount_cents / 100` | `d.amount / 100` |
| Status check | `d.status === "succeeded"` | `d.status === "completed"` |
| Donor info | `d.donor_name` / `d.donor_email` | `d.user?.name` / `d.user?.email` |

### 2.7 `go.mod` — dipendenza stripe-go
**Problema:** `github.com/stripe/stripe-go/v76` segnalata come indiretta.
**Fix:** `go mod tidy` eseguito localmente.

---

## 3. Database — migrazione su Hetzner

### 3.1 Stato iniziale verificato
```bash
mysql -u st1stream -p'PASSWORD' st1 -e "SHOW COLUMNS FROM churches LIKE 'stripe%'; ..."
```
→ Nessuna colonna/tabella Stripe esistente.

### 3.2 Problema FK incompatibili
Le tabelle esistenti usano `BIGINT UNSIGNED` per i PK (es. `churches.id`), ma la migration iniziale usava `INT`. Causava `Error 3780: Referencing column incompatible`.

**Soluzione:** Usare `BIGINT UNSIGNED` per tutte le colonne FK nelle nuove tabelle.

### 3.3 Comandi ALTER TABLE eseguiti (successo)
```sql
ALTER TABLE churches
    ADD COLUMN stripe_account_id VARCHAR(255) NULL,
    ADD COLUMN stripe_onboarding_complete TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE users
    ADD COLUMN stripe_customer_id VARCHAR(255) NULL;

ALTER TABLE streaming_sessions
    ADD COLUMN donation_active TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN donation_preset_id INT NULL;
```

### 3.4 Tabelle create
```sql
CREATE TABLE donation_presets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    church_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    amounts JSON NOT NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_preset_church FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
    INDEX idx_preset_church (church_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE donations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    church_id BIGINT UNSIGNED NOT NULL,
    session_id BIGINT UNSIGNED NULL,
    amount INT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'eur',
    stripe_payment_intent_id VARCHAR(255) NULL,
    stripe_checkout_session_id VARCHAR(255) NULL,
    status ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ...indici e FK...
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.5 Problema FK con AutoMigrate
**Problema:** AutoMigrate (GORM) tenta di modificare `donation_preset_id` da `BIGINT UNSIGNED` a `int` (perché il modello Go usa `int32`), ma i FK constraint manuali lo bloccano.
**Causa root:** Il progetto ha `db.DisableForeignKeyConstraintWhenMigrating = true` proprio per questo motivo (PK `BIGINT UNSIGNED` vs modelli `int32`).
**Fix:** Rimossi tutti i FK constraint manuali prima del riavvio:
```sql
ALTER TABLE streaming_sessions DROP FOREIGN KEY fk_session_donation_preset;
ALTER TABLE donation_presets DROP FOREIGN KEY fk_preset_church;
ALTER TABLE donations DROP FOREIGN KEY fk_donation_user;
ALTER TABLE donations DROP FOREIGN KEY fk_donation_church;
ALTER TABLE donations DROP FOREIGN KEY fk_donation_session;
```
AutoMigrate ha poi normalizzato i tipi senza errori.

---

## 4. Deploy binario su Hetzner

### 4.1 Info server
- **Host:** vdserv.com (195.201.138.249)
- **Porta SSH:** 2200
- **User:** nicholas
- **Chiave SSH:** `~/.ssh/id_ed25519_vdserv`
- **Binario:** `/opt/verbumdigital/backend/vd-server`
- **Env file:** `/opt/verbumdigital/backend/.env`
- **Servizio systemd:** `verbumdigital`

### 4.2 Compilazione per Linux (da Windows PowerShell)
```powershell
cd C:/Users/Principale/Desktop/Progetti/verbumdigital-web-radio/backend
$env:GOOS="linux"; $env:GOARCH="amd64"; go build -o vd-server ./cmd/server
```

### 4.3 Upload binario
```powershell
scp -P 2200 -i ~/.ssh/id_ed25519_vdserv vd-server nicholas@vdserv.com:/tmp/vd-server
```

### 4.4 Installazione sul server
```bash
sudo systemctl stop verbumdigital
sudo cp /opt/verbumdigital/backend/vd-server /opt/verbumdigital/backend/vd-server.BAK2
sudo mv /tmp/vd-server /opt/verbumdigital/backend/vd-server
sudo chmod +x /opt/verbumdigital/backend/vd-server
sudo systemctl start verbumdigital
```

---

## 5. Configurazione Stripe

### 5.1 Variabili aggiunte al `.env` di produzione
```env
STRIPE_SECRET_KEY=sk_test_51TE5Ih...   # chiave test, da sostituire con live in produzione
STRIPE_WEBHOOK_SECRET=whsec_zqZEyL4r1IywlP3Jdp9Oshiw0EdK7AX1
APP_BASE_URL=https://api.verbumdigital.it
```

### 5.2 Webhook configurato su Stripe Dashboard
- **Modalità:** Test mode
- **Tipo eventi:** Account connessi e v2 (necessario per direct charges su connected accounts)
- **Evento:** `checkout.session.completed`
- **URL endpoint:** `https://api.verbumdigital.it/api/v1/stripe/webhook`

> ⚠️ **Importante:** scegliere "Account connessi e v2" (non "Il tuo account") perché con direct charges il pagamento avviene sull'account della chiesa, non sulla piattaforma.

---

## 6. Comandi di riferimento per operazioni future

### Stato del servizio
```bash
sudo systemctl status verbumdigital --no-pager
```

### Log in tempo reale
```bash
sudo journalctl -u verbumdigital -f
```

### Log ultimi N messaggi
```bash
sudo journalctl -u verbumdigital -n 100 --no-pager
```

### Riavvio servizio
```bash
sudo systemctl restart verbumdigital
```

### Stop / Start
```bash
sudo systemctl stop verbumdigital
sudo systemctl start verbumdigital
```

### Verifica .env attuale
```bash
cat /opt/verbumdigital/backend/.env
```

### Aggiornare una variabile nel .env
```bash
sudo sed -i 's/VECCHIO_VALORE/NUOVO_VALORE/' /opt/verbumdigital/backend/.env
sudo systemctl restart verbumdigital
```

### Aggiornare il webhook secret Stripe
```bash
sudo sed -i 's/STRIPE_WEBHOOK_SECRET=.*/STRIPE_WEBHOOK_SECRET=whsec_NUOVO/' /opt/verbumdigital/backend/.env
sudo systemctl restart verbumdigital
```

### Deploy nuovo binario (procedura completa)
```powershell
# 1. Compila (PowerShell locale)
cd C:/Users/Principale/Desktop/Progetti/verbumdigital-web-radio/backend
$env:GOOS="linux"; $env:GOARCH="amd64"; go build -o vd-server ./cmd/server

# 2. Upload
scp -P 2200 -i ~/.ssh/id_ed25519_vdserv vd-server nicholas@vdserv.com:/tmp/vd-server
```
```bash
# 3. Installa sul server (terminale Hetzner)
sudo systemctl stop verbumdigital
sudo cp /opt/verbumdigital/backend/vd-server /opt/verbumdigital/backend/vd-server.BAK2
sudo mv /tmp/vd-server /opt/verbumdigital/backend/vd-server
sudo chmod +x /opt/verbumdigital/backend/vd-server
sudo systemctl start verbumdigital
sudo systemctl status verbumdigital --no-pager
```

### Connessione SSH al server
```bash
ssh -p 2200 -i ~/.ssh/id_ed25519_vdserv nicholas@vdserv.com
```

### Query DB — verifica donazioni
```bash
mysql -u st1stream -p'4ifK(E)OrrQ-pi6y' st1 -e \
  "SELECT id, church_id, amount, currency, status, created_at FROM donations ORDER BY id DESC LIMIT 10;" 2>/dev/null
```

### Query DB — verifica onboarding chiese
```bash
mysql -u st1stream -p'4ifK(E)OrrQ-pi6y' st1 -e \
  "SELECT id, name, stripe_account_id, stripe_onboarding_complete FROM churches;" 2>/dev/null
```

### Query DB — verifica preset donazione
```bash
mysql -u st1stream -p'4ifK(E)OrrQ-pi6y' st1 -e \
  "SELECT id, church_id, name, amounts, is_default FROM donation_presets;" 2>/dev/null
```

### Backup DB manuale
```bash
mysqldump -u st1stream -p'4ifK(E)OrrQ-pi6y' st1 > ~/backup_$(date +%Y%m%d_%H%M).sql
```

---

## 7. Note importanti per il futuro

### Passaggio da test a live (produzione Stripe)
1. Creare account Stripe live (o attivare il test account)
2. Ottenere `sk_live_...` dalla Dashboard Stripe
3. Aggiornare `STRIPE_SECRET_KEY` nel `.env` di produzione
4. Creare nuovo webhook endpoint in **live mode** su Stripe Dashboard (stesso URL)
5. Aggiornare `STRIPE_WEBHOOK_SECRET` con il nuovo `whsec_...`
6. Restart del servizio

### Problema FK e AutoMigrate
Il progetto usa `int32` nei modelli Go ma il DB ha `BIGINT UNSIGNED` per i PK. Per questo:
- `DisableForeignKeyConstraintWhenMigrating = true` è impostato in `main.go`
- **Non aggiungere FK constraint manuali** nelle migrazioni future — AutoMigrate non li gestisce e causano errori all'avvio
- Le migrazioni future devono usare solo `ALTER TABLE` e `CREATE TABLE` senza FOREIGN KEY constraint

### Struttura del deploy
Il deploy è **binary-only** (non git pull sul server):
- Il codice sorgente è solo in locale / GitHub
- Il server ha solo il binario compilato `vd-server`
- Ogni modifica al backend richiede: compile locale → scp → restart
