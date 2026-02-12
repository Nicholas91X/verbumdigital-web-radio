CLAUDE.md — VerbumDigital Web Radio Platform
Project Overview
VerbumDigital is a church live streaming platform. Churches install an ST1 hardware encoder that streams audio to an Icecast server. The ST1 hardware is the stream initiator — controlled locally by av-control (a PWA running on the ST1 itself). Priests monitor streaming status via a read-only PWA, users (fedeli) listen via another PWA, and admins manage the system via a third PWA.
Architecture
av-control (ST1, port 80) ──→ smixRest (ST1, port 8080) ──→ Icecast (vdserv.com:8000)
                                        │ (callbacks)
                                        ▼
                               Backend API (Hetzner:8081) ←── Priest PWA (read-only monitoring)
                                        │                 ←── User PWA (listen)
                                        │                 ←── Admin PWA (manage)
                                     MySQL DB
Critical: The Priest PWA does NOT control ST1. It is read-only (monitoring + session history). Stream control happens entirely through av-control → smixRest locally. The backend receives callbacks from ST1 for session lifecycle (validate, started, stopped).
Tech Stack
Backend (Go)

Framework: Gin + GORM
Database: MySQL 8
Auth: JWT + RBAC (3 roles: admin, priest, user) + API Key (ST1 devices)
REST endpoints: See docs/api-reference.md

Frontend (3 PWAs, all React + Vite + TypeScript + Tailwind)

Admin PWA (port 3000): Machine/church/priest CRUD, dashboard, session overview
Priest PWA (port 3001): Read-only — stream status monitoring, session history
User PWA (port 3002): Browse churches, subscribe, listen to live audio

Infrastructure

Server: Hetzner VPS (Svilen manages)
Icecast: vdserv.com:8000 — accepts dynamic mounts, single global source password
ST1 hardware: Runs smixRest firmware on port 8080, av-control on port 80

Key Credentials & Config
SSH (Hetzner VPS)

Host: vdserv.com (IP: 195.201.138.249)
Port: 2200
User: nicholas
Auth: key-based (id_ed25519_vdserv)
sudo: group membership confirmed, password TBD

MySQL (Hetzner — localhost only)

Host: localhost:3306
User: st1stream
Password: 4ifK(E)OrrQ-pi6y
Database: st1

Icecast (vdserv.com:8000)

Global source password: r0j1e0A8bx
One password for ALL mounts (not per-church)
Mount format: /{stream_id}.mp3 (dynamic, no pre-registration needed)
Stream URL format: icecast://source:r0j1e0A8bx@vdserv.com:8000/{stream_id}.mp3
Listen URL format: http://vdserv.com:8000/{stream_id}.mp3

ST1 / smixRest API (port 8080, LAN access)

GET /api/device/st1/status → { "state": "streaming|stopped|noid", "current_time": 125 }
GET /api/device/st1/setup → { "stream_url": "..." } (read current config)
POST /api/device/st1/setup body { "stream_url": "icecast://source:r0j1e0A8bx@vdserv.com:8000/stream123.mp3" }
POST /api/device/st1/play → { "success": true }
POST /api/device/st1/stop → { "success": true }

Streaming Flow (ST1-driven, end-to-end)

av-control (local PWA on ST1) → smixRest: POST /setup with Icecast URL, then POST /play
ST1 → Backend: POST /device/validate { "serial_number": "SMIX-12345" }
Backend looks up: serial → machine → church → streaming_credentials
Returns: { icecast_url, stream_id, mount }
ST1 → Backend: POST /device/stream/started { "serial_number": "SMIX-12345" }
Backend creates session (started_by_priest_id = null)
ST1 pushes audio to Icecast at vdserv.com:8000/{stream_id}.mp3
Priest PWA polls GET /stream/status — sees live timer
User PWA detects live status, plays http://vdserv.com:8000/{stream_id}.mp3
av-control → smixRest: POST /stop
ST1 → Backend: POST /device/stream/stopped — backend closes session

Database Schema (MySQL)
10 tables: machines, churches, streaming_credentials, priests, priest_churches, users, user_subscriptions, admins, streaming_sessions, active_listeners
Migration files:

migrations/001_initial_schema.sql (MySQL syntax)
migrations/002_st1_architecture.sql (stream_key nullable, ST1 changes)

Key relationships:

churches → machines (1:1)
churches → streaming_credentials (1:1, stream_key deprecated/nullable)
priests ↔ churches via priest_churches (N:N)
users ↔ churches via user_subscriptions (N:N)
streaming_sessions → churches (started_by_priest_id nullable for ST1 sessions)

Project Structure
backend/
├── cmd/server/main.go          # Entry point, router setup
├── internal/
│   ├── config/config.go        # Env loading, DSN (MySQL)
│   ├── models/models.go        # GORM models (all 10 tables)
│   ├── middleware/middleware.go # JWT auth + RBAC + device auth
│   ├── handlers/               # HTTP handlers per role
│   │   ├── admin_handler.go
│   │   ├── auth_handler.go
│   │   ├── device_handler.go   # ST1 callbacks (validate, started, stopped)
│   │   ├── priest_handler.go   # Read-only (status, sessions)
│   │   └── user_handler.go
│   └── services/               # Business logic per role
│       ├── admin_service.go
│       ├── auth_service.go
│       ├── priest_service.go   # Read-only (no start/stop)
│       └── user_service.go
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 001_initial_schema_down.sql
│   └── 002_st1_architecture.sql
├── go.mod
├── go.sum
└── .env

frontend/
├── shared/
│   ├── api/
│   │   ├── client.ts           # API client (backend only, no ST1Client)
│   │   └── types.ts            # TypeScript types (no ST1 types)
│   ├── components/
│   └── utils/
├── admin/                      # PWA Admin
├── priest/                     # PWA Priest (read-only monitoring)
└── user/                       # PWA User (fedeli)

docs/
├── architecture.md
├── api-reference.md
├── database.md
├── setup.md
├── deployment.md
└── st1-integration.md
.env Required Variables
envPORT=8081
DB_HOST=localhost
DB_PORT=3306
DB_USER=st1stream
DB_PASSWORD=4ifK(E)OrrQ-pi6y
DB_NAME=st1
JWT_SECRET=<min 32 chars>
JWT_EXPIRATION_HOURS=72
ICECAST_BASE_URL=http://vdserv.com:8000
DEVICE_API_KEY=<shared secret for ST1 auth>
Note: ICECAST_SOURCE_PASSWORD removed — the Icecast global password is pre-configured on ST1 hardware by Svilen. The backend doesn't need it.
Collaboration Notes

Svilen handles server infrastructure (Hetzner VPS, Icecast, ST1 hardware/firmware, av-control)
Nicholas handles all software development (backend, PWAs, deployment)
Svilen's server has MySQL pre-installed
ST1 is accessible remotely (not just LAN)

What's Done vs TODO
✅ Done

Backend API: JWT+RBAC, all handlers/services, ST1-driven architecture
Database schema: 10 tables, MySQL migration ready + 002 ST1 migration
Priest PWA: Auth, dashboard (read-only monitoring), session history
User PWA: Auth, browse churches, subscribe, live audio player
Mock ST1 server for local testing
Documentation (architecture, API ref, DB, setup, deployment, ST1 integration)
ST1-driven refactoring: device handler (serial lookup), priest handler (read-only), shared types/client cleanup

🔲 TODO

Admin PWA implementation
Deploy backend to Hetzner
Run 002 migration on production MySQL
End-to-end test with real ST1 hardware
Test tool simulating ST1 callbacks for dev without hardware
Push notifications
Recording management
Active listener tracking (heartbeat)