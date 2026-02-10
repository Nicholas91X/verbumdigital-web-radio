# Guida Setup Sviluppo

## Prerequisiti

- **Go** 1.22+
- **Node.js** 18+ e npm
- **PostgreSQL** 15+ (locale per dev, oppure tunnel SSH a Hetzner)
- **Git**

## 1. Clone e struttura

```bash
git clone <repo-url>
cd verbumdigital-web-radio
```

## 2. Backend

```bash
cd backend

# Copia e configura environment
cp .env.example .env
# Modifica .env con le tue credenziali DB

# Scarica dipendenze
go mod tidy

# Esegui migrazione DB
psql -h localhost -U st1stream -d st1stream -f migrations/001_initial_schema.sql

# Avvia server
go run cmd/server/main.go
```

Il server parte su `http://localhost:8081`.

### Verifica

```bash
# Health check
curl http://localhost:8081/health

# Dovrebbe rispondere:
# {"status":"ok"}
```

### Creare il primo admin

```bash
# Genera un bcrypt hash per la password
# Puoi usare: https://bcrypt-generator.com/ oppure un tool Go

# Inserisci nel DB
psql -h localhost -U st1stream -d st1stream -c "
INSERT INTO admins (username, email, password_hash)
VALUES ('admin', 'admin@verbumdigital.com', '\$2a\$10\$YOUR_HASH_HERE');
"
```

### Test login admin

```bash
curl -X POST http://localhost:8081/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@verbumdigital.com","password":"your_password"}'
```

## 3. Frontend

```bash
cd frontend

# Per ogni PWA (admin, priest, user):
cd priest
npm install
npm run dev
```

## 4. Test del flusso completo

### Prerequisiti
1. Backend in esecuzione su :8081
2. Admin creato nel DB
3. Almeno una macchina, chiesa e prete creati via API admin

### Flusso di test

```bash
# 1. Login admin
TOKEN=$(curl -s -X POST http://localhost:8081/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@verbumdigital.com","password":"secret"}' | jq -r '.token')

# 2. Crea macchina
curl -X POST http://localhost:8081/api/v1/admin/machines \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"machine_id":"SMIX-TEST-001"}'

# 3. Attiva macchina
curl -X PUT http://localhost:8081/api/v1/admin/machines/1/activate \
  -H "Authorization: Bearer $TOKEN"

# 4. Crea chiesa (auto-genera streaming credentials)
curl -X POST http://localhost:8081/api/v1/admin/churches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Parrocchia Test","address":"Via Test 1","machine_id":1}'

# 5. Crea prete e assegna alla chiesa
curl -X POST http://localhost:8081/api/v1/admin/priests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Don Test","email":"don.test@email.com","password":"secret123","church_ids":[1]}'

# 6. Login come prete
PRIEST_TOKEN=$(curl -s -X POST http://localhost:8081/api/v1/auth/priest/login \
  -H "Content-Type: application/json" \
  -d '{"email":"don.test@email.com","password":"secret123"}' | jq -r '.token')

# 7. Verifica chiese del prete
curl http://localhost:8081/api/v1/priest/churches \
  -H "Authorization: Bearer $PRIEST_TOKEN"

# 8. Avvia stream
curl -X POST http://localhost:8081/api/v1/priest/churches/1/stream/start \
  -H "Authorization: Bearer $PRIEST_TOKEN"

# 9. Ferma stream
curl -X POST http://localhost:8081/api/v1/priest/churches/1/stream/stop \
  -H "Authorization: Bearer $PRIEST_TOKEN"
```

## 5. Connessione al DB Hetzner (remoto)

```bash
# Via SSH tunnel
ssh -L 5432:localhost:5432 user@vdserv.com

# Poi connettiti come se fosse localhost
psql -h localhost -U st1stream -d st1stream
```

## Struttura porte

| Servizio | Porta | Note |
|----------|-------|------|
| Backend API | 8081 | Go/Gin |
| smixRest (ST1) | 8080 | Solo rete locale |
| Icecast | 8000 | vdserv.com |
| PostgreSQL | 5432 | Hetzner |