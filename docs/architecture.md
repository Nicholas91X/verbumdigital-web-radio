Architettura VerbumDigital Web Radio
Overview
Sistema di streaming audio per chiese, basato su hardware S-Mix con scheda ST1.
Permette ai sacerdoti di trasmettere in streaming (messe, eventi) e ai fedeli di ascoltare tramite PWA.
Componenti principali

Backend API — Go (Gin + GORM), REST, JWT auth
3 PWA Frontend — React + Vite + Tailwind CSS (Admin, Priest, User)
Hardware — Scheda ST1 (CPU A13 + LAN) nel mixer S-Mix, firmware smixRest
Streaming Server — Icecast su Hetzner (formato MP3, ~1MB/min)
Database — PostgreSQL su Hetzner

Divisione del lavoro

Svilen → Hardware ST1, firmware smixRest, DB setup su Hetzner, Icecast
Nicholas → Backend API, tutte e 3 le PWA


Architettura di sistema
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Admin PWA  │────▶│              │     │                 │
└─────────────┘     │              │     │   PostgreSQL    │
┌─────────────┐     │  Backend API │────▶│   (Hetzner)     │
│ Priest PWA  │────▶│  (Go/Gin)    │     │                 │
└─────────────┘     │  port 8081   │     └─────────────────┘
┌─────────────┐     │              │
│  User PWA   │────▶│              │     ┌─────────────────┐
└─────────────┘     └──────┬───────┘     │  Icecast Server │
                           │             │  vdserv.com:8000│
┌─────────────┐            │             └────────▲────────┘
│  ST1 Board  │────────────┘                      │
│ (smixRest)  │───────────────────────────────────┘
│  port 8080  │         audio stream (MP3)
└─────────────┘

Flusso Streaming
PRIEST PWA                    BACKEND API                    ST1 (smixRest:8080)
    │                              │                              │
    ├── POST /priest/../start ────▶│ crea session DB              │
    │◄── { session, credentials }  │                              │
    │                              │                              │
    ├── POST /api/device/st1/setup ──────────────────────────────▶│ configura stream_url
    ├── POST /api/device/st1/play  ──────────────────────────────▶│ avvia encoding
    │                              │                              │
    │                              │◄── POST /device/validate ────│ verifica credenziali
    │                              │◄── POST /device/stream/started│ conferma avvio
    │                              │                              │
    │         ... streaming attivo (audio → Icecast) ...          │
    │                              │                              │
    ├── POST /api/device/st1/stop  ──────────────────────────────▶│ ferma encoding
    │                              │◄── POST /device/stream/stopped│ conferma stop
    ├── POST /priest/../stop ─────▶│ chiude session DB            │
Nota: La Priest PWA comunica con ST1 in rete locale (smixRest su porta 8080) e con il Backend API in remoto (Hetzner). Le due comunicazioni sono separate.

Backend
Stack

Go 1.22+
Gin — HTTP router
GORM — ORM per PostgreSQL
golang-jwt/v5 — Autenticazione JWT
bcrypt — Hashing password
godotenv — Configurazione da .env

Struttura
backend/
├── cmd/server/
│   └── main.go              # Entry point, router, DI
├── internal/
│   ├── config/
│   │   └── config.go        # Env loader, DSN builder
│   ├── handlers/
│   │   ├── auth_handler.go   # Login (admin/priest/user) + registrazione user
│   │   ├── admin_handler.go  # CRUD macchine, chiese, preti, sessioni
│   │   ├── priest_handler.go # Gestione stream, storico sessioni
│   │   ├── user_handler.go   # Browse chiese, subscribe, stream URL
│   │   └── device_handler.go # Comunicazione ST1 → server
│   ├── middleware/
│   │   └── middleware.go     # JWT auth, RBAC, Device API key auth
│   ├── models/
│   │   └── models.go        # Structs GORM (10 tabelle)
│   └── services/
│       ├── auth_service.go   # Login/register logic, bcrypt
│       ├── admin_service.go  # Machine activation, church/priest CRUD
│       ├── priest_service.go # Stream start/stop, session management
│       └── user_service.go   # Subscriptions, stream URL builder
├── migrations/
│   ├── 001_initial_schema.sql
│   └── 001_initial_schema_down.sql
├── go.mod
├── go.sum
└── .env.example
Autenticazione
Due meccanismi separati:

JWT (per le 3 PWA)

Login → ricevi token con { user_id, email, role }
Header: Authorization: Bearer <token>
Ruoli: admin, priest, user
Scadenza configurabile (default 72h)


API Key (per ST1)

Header: X-Device-Key: <key>
Chiave condivisa configurata nel .env
Più semplice di JWT — i device non hanno sessioni utente



Configurazione (.env)
PORT=8081
DB_HOST=localhost
DB_PORT=5432
DB_USER=st1stream
DB_PASSWORD=***
DB_NAME=st1stream
DB_SSLMODE=disable
JWT_SECRET=***
JWT_EXPIRATION_HOURS=72
ICECAST_BASE_URL=http://vdserv.com:8000
DEVICE_API_KEY=***

Frontend
Stack

React 18+ con TypeScript
Vite — Build tool
Tailwind CSS — Styling
PWA — Service worker, manifest, installabilità

Struttura
frontend/
├── shared/
│   ├── api/
│   │   ├── client.ts        # Fetch wrapper con auth header
│   │   └── types.ts         # TypeScript types (da models Go)
│   ├── components/          # Componenti UI comuni
│   └── utils/
│       └── index.ts
├── admin/                   # PWA Admin
├── priest/                  # PWA Priest (priorità sviluppo)
└── user/                    # PWA User (fedeli)
PWA Priest (priorità)

Login
Lista chiese assegnate
Start/stop streaming (comunica con ST1 locale + backend remoto)
Storico sessioni

PWA User

Registrazione / login
Browse chiese con ricerca
Subscribe / unsubscribe con preferenze notifiche
Ascolto stream live (URL Icecast)

PWA Admin

Login
CRUD macchine (con activation code)
CRUD chiese (auto-genera streaming credentials)
CRUD preti (con assegnazione chiese)
Overview sessioni streaming


Database
Schema (PostgreSQL)
10 tabelle, relazioni chiave:
machines (1)──────(1) churches (1)──────(1) streaming_credentials
                       │
                  (N:N) │ (N:N)
                       │
              priest_churches          user_subscriptions
                  │                         │
             priests                      users

churches (1)──────(N) streaming_sessions (1)──────(N) active_listeners

Machine ↔ Church: 1:1 (macchina fissa in una chiesa)
Priest ↔ Church: N:N tramite priest_churches (un prete può gestire più chiese)
User ↔ Church: N:N tramite user_subscriptions (con preferenze notifiche)
Church → StreamingCredential: 1:1 (stream_id + stream_key permanenti)
Church → StreamingSessions: 1:N (storico sessioni)

Streaming Credentials

stream_id — Identificativo univoco, codificato nell'URL Icecast (es. streamab3xk9f2m7p4)
stream_key — Chiave segreta per autenticazione stream
Generati automaticamente dall'Admin quando crea una chiesa
Permanenti (non cambiano per sessione)
URL stream risultante: http://vdserv.com:8000/{stream_id}.mp3


Stato implementazione
✅ Completato

Database schema + migrazioni (up/down)
Backend API completo (30 endpoint, 0 placeholder)

Auth: login 3 ruoli + registrazione user
Admin: CRUD macchine, chiese, preti + overview sessioni
Priest: lista chiese, start/stop stream, storico
User: browse, subscribe, notifiche, stream URL
Device: validate credentials, notify start/stop


Middleware JWT + RBAC + Device auth
Modelli GORM con relazioni

🔲 Da fare

PWA Priest
PWA User
PWA Admin
CORS middleware
Push notifications
Sistema messaggistica Priest → User
Recording management (auto-delete previous)
Active listener tracking (heartbeat)
Deploy scripts
Test suite