Architettura VerbumDigital Web Radio
Overview
Sistema di streaming audio per chiese, basato su hardware S-Mix con scheda ST1.
L'hardware ST1 è l'iniziatore dello streaming: av-control (PWA locale sulla ST1) gestisce setup e play/stop, la ST1 notifica il backend tramite callback HTTP. I sacerdoti monitorano lo stato in tempo reale tramite la Priest PWA (read-only). I fedeli ascoltano tramite la User PWA.
Componenti principali

Backend API — Go (Gin + GORM), REST, JWT auth
3 PWA Frontend — React + Vite + Tailwind CSS (Admin, Priest, User)
Hardware — Scheda ST1 (CPU A13 + LAN) nel mixer S-Mix, firmware smixRest
av-control — PWA locale sulla ST1 (porta 80), controlla smixRest
Streaming Server — Icecast su Hetzner (formato MP3, ~1MB/min)
Database — MySQL su Hetzner

Divisione del lavoro

Svilen → Hardware ST1, firmware smixRest, av-control, DB setup su Hetzner, Icecast
Nicholas → Backend API, tutte e 3 le PWA

Architettura di sistema
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Admin PWA  │────▶│              │     │                 │
└─────────────┘     │              │     │     MySQL       │
┌─────────────┐     │  Backend API │────▶│   (Hetzner)     │
│ Priest PWA  │────▶│  (Go/Gin)    │     │                 │
│ (read-only) │     │  port 8081   │     └─────────────────┘
└─────────────┘     │              │
┌─────────────┐     │              │     ┌─────────────────┐
│  User PWA   │────▶│              │     │  Icecast Server │
└─────────────┘     └──────┬───────┘     │  vdserv.com:8000│
                           │             └────────▲────────┘
┌─────────────┐            │                      │
│  ST1 Board  │────────────┘ (callbacks)          │
│ (smixRest)  │───────────────────────────────────┘
│  port 8080  │         audio stream (MP3)
├─────────────┤
│ av-control  │  ← PWA locale, controlla smixRest
│  port 80    │
└─────────────┘
Flusso Streaming (ST1-driven)
av-control (locale)              ST1 (smixRest)              BACKEND API
    │                              │                              │
    ├── POST /setup ──────────────▶│ configura stream_url         │
    ├── POST /play  ──────────────▶│ avvia encoding               │
    │                              │                              │
    │                              ├── POST /device/validate ────▶│ lookup serial → church
    │                              │◄── { icecast config }        │
    │                              │                              │
    │                              ├── POST /device/stream/started▶│ CREA sessione DB
    │                              │◄── { session_id }            │
    │                              │                              │
    │         ... streaming attivo (audio → Icecast) ...          │
    │                              │                              │
    ├── POST /stop  ──────────────▶│ ferma encoding               │
    │                              ├── POST /device/stream/stopped▶│ chiude sessione DB
Punti chiave:

La Priest PWA non controlla più ST1 — è solo monitoring/dashboard
Le sessioni sono create dal callback stream/started (non dalla Priest PWA)
started_by_priest_id è nil per sessioni avviate dall'hardware
La password Icecast è pre-configurata sulla ST1, il backend non la gestisce

Backend
Stack

Go 1.22+
Gin — HTTP router
GORM — ORM per MySQL
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
│   │   ├── priest_handler.go # Monitoraggio stream (read-only), storico sessioni
│   │   ├── user_handler.go   # Browse chiese, subscribe, stream URL
│   │   └── device_handler.go # Callback ST1 → server (validate, started, stopped)
│   ├── middleware/
│   │   └── middleware.go     # JWT auth, RBAC, Device API key auth
│   ├── models/
│   │   └── models.go        # Structs GORM (10 tabelle)
│   └── services/
│       ├── auth_service.go   # Login/register logic, bcrypt
│       ├── admin_service.go  # Machine activation, church/priest CRUD
│       ├── priest_service.go # Stream status (read-only), session history
│       └── user_service.go   # Subscriptions, stream URL builder
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 001_initial_schema_down.sql
│   └── 002_st1_architecture.sql
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
DB_PORT=3306
DB_USER=st1stream
DB_PASSWORD=***
DB_NAME=st1
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
│   │   ├── client.ts        # Fetch wrapper con auth header (solo backend API)
│   │   └── types.ts         # TypeScript types (da models Go)
│   ├── components/          # Componenti UI comuni
│   └── utils/
│       └── index.ts
├── admin/                   # PWA Admin
├── priest/                  # PWA Priest (monitoring read-only)
└── user/                    # PWA User (fedeli)
PWA Priest (read-only monitoring)

Login
Lista chiese assegnate con stato LIVE/STBY
Timer durata diretta in tempo reale
Storico sessioni
Non controlla ST1 — lo streaming è gestito da av-control

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
Schema (MySQL)
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
Priest ↔ Church: N:N tramite priest_churches
User ↔ Church: N:N tramite user_subscriptions (con preferenze notifiche)
Church → StreamingCredential: 1:1 (stream_id per mount Icecast)
Church → StreamingSessions: 1:N (storico sessioni)

Streaming Credentials

stream_id — Identificativo univoco, usato come mount Icecast (es. streamab3xk9f2m7p4)
stream_key — Deprecato (nullable). La password Icecast è globale e pre-configurata su ST1
Generati automaticamente dall'Admin quando crea una chiesa
URL stream risultante: http://vdserv.com:8000/{stream_id}.mp3