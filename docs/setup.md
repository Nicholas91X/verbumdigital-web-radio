# Setup Locale — Guida Dettagliata

## Prerequisiti

| Tool | Versione | Verifica |
|:--|:--|:--|
| Go | 1.23+ | `go version` |
| Node.js | 22+ | `node --version` |
| Docker Desktop | 28+ | `docker --version` |

## 1. Database (Docker Compose)

Il file `docker-compose.yml` nella root del progetto avvia un container PostgreSQL 16 e applica automaticamente la migrazione `001_initial_schema.sql` al primo avvio.

```bash
# Avvia il database
docker compose up -d

# Verifica che sia in esecuzione
docker compose ps

# Verifica le tabelle
docker exec vd-postgres psql -U st1stream -d st1stream -c "\dt"
```

### Reset completo del database

```bash
docker compose down -v   # Elimina anche il volume dati
docker compose up -d     # Ricrea tutto da zero
```

### Connessione diretta

```
Host:     localhost
Port:     5432 (o come definito in .env → DB_PORT)
User:     st1stream
Password: (vedi .env)
Database: st1stream
```

## 2. Configurazione Backend

```bash
# Copia il template
cp .env.example backend/.env

# Modifica con le tue credenziali
# Importante: DB_PORT deve corrispondere a docker-compose.yml
```

| Variabile | Descrizione | Default |
|:--|:--|:--|
| `PORT` | Porta del backend | `8081` |
| `DB_HOST` | Host PostgreSQL | `localhost` |
| `DB_PORT` | Porta PostgreSQL | `5432` |
| `DB_USER` | Utente database | `st1stream` |
| `DB_PASSWORD` | Password database | — |
| `DB_NAME` | Nome database | `st1stream` |
| `DB_SSLMODE` | SSL mode | `disable` |
| `JWT_SECRET` | Chiave JWT (min 32 char) | — |
| `JWT_EXPIRATION_HOURS` | Durata token | `720` |
| `ICECAST_BASE_URL` | Server Icecast | `http://vdserv.com:8000` |
| `DEVICE_API_KEY` | Chiave autenticazione ST1 | — |

## 3. Seed Admin

Al primo avvio bisogna creare un utente admin:

```bash
# Genera hash bcrypt
cd backend
go run ../tools/gen-hash.go <tua-password>

# Modifica tools/seed-admin.sql con l'hash generato
# Poi esegui:
docker exec -i vd-postgres psql -U st1stream -d st1stream < ../tools/seed-admin.sql
```

## 4. Avvio Servizi

```bash
# Backend Go (terminale 1)
cd backend && go run ./cmd/server

# Mock ST1 — opzionale (terminale 2)
node tools/mock-st1.js

# Admin PWA (terminale 3)
cd frontend/admin && npm i && npm run dev

# Priest PWA (terminale 4)
cd frontend/priest && npm i && npm run dev

# User PWA (terminale 5)
cd frontend/user && npm i && npm run dev
```

## 5. Variabili Frontend

Le PWA usano variabili Vite nel file `.env` nella rispettiva cartella:

| Variabile | Descrizione | Default |
|:--|:--|:--|
| `VITE_API_BASE_URL` | URL del backend | `http://localhost:8081/api/v1` |
| `VITE_ST1_BASE_URL` | URL del Mock ST1 (solo Priest) | `http://localhost:8080` |

## 6. Test del flusso completo

1. Apri Admin PWA → Login con le credenziali admin
2. Crea una macchina → Attivala
3. Crea una chiesa → Associa la macchina
4. Crea un sacerdote → Associa alla chiesa
5. Apri Priest PWA → Login con il sacerdote creato
6. Clicca "Avvia Stream" → Verifica Mock ST1 in console
7. Apri User PWA → Registra un utente → Iscriviti alla chiesa
8. Verifica che lo stream risulti "Live"