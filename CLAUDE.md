CLAUDE.md — VerbumDigital Web Radio Platform
Project Overview
VerbumDigital is a church live streaming platform. Churches install an ST1 hardware encoder that streams audio to an Icecast server. Priests control streaming via a PWA, users (fedeli) listen via another PWA, and admins manage the system via a third PWA.
Architecture
Priest PWA ──→ ST1 (LAN, smixRest API) ──→ Icecast (vdserv.com:8000)
     │                                              │
     └──→ Backend API (Hetzner) ←── User PWA listens from Icecast
              │
           MySQL DB
Critical: The Priest PWA talks to ST1 directly over LAN (same WiFi). The backend does NOT proxy ST1 commands. The backend only manages sessions, auth, and metadata.
Tech Stack
Backend (Go)

Framework: Gin + GORM
Database: MySQL 8 (migrated from PostgreSQL — Feb 2026)
Auth: JWT + RBAC (3 roles: admin, priest, user)
30 REST endpoints: See docs/api-reference.md

Frontend (3 PWAs, all React + Vite + TypeScript + Tailwind)

Admin PWA (port 3000): Machine/church/priest CRUD, dashboard, session overview
Priest PWA (port 3001): Stream control (start/stop via ST1), session history
User PWA (port 3002): Browse churches, subscribe, listen to live audio

Infrastructure

Server: Hetzner VPS (Svilen manages)
Icecast: vdserv.com:8000 — accepts dynamic mounts, single global source password
ST1 hardware: Runs smixRest firmware on port 8080

Key Credentials & Config
MySQL (Hetzner — localhost only)

Host: localhost:3306
User: st1stream
Password: 4ifK(E)OrrQ-pi6yH
Database: st1stream

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

Streaming Flow (end-to-end)

Priest opens PWA → logs in → selects church
PWA calls GET /api/v1/priest/churches/:id/stream/status → gets stream_id + stream_key
PWA calls ST1 directly (LAN): POST /setup with Icecast URL, then POST /play
PWA calls backend: POST /api/v1/priest/churches/:id/stream/start → creates session
ST1 pushes audio to Icecast at vdserv.com:8000/{stream_id}.mp3
User PWA detects live status, plays http://vdserv.com:8000/{stream_id}.mp3
Priest stops: PWA calls ST1 POST /stop, then backend POST /stream/stop

Database Schema (MySQL)
10 tables: machines, churches, streaming_credentials, priests, priest_churches, users, user_subscriptions, admins, streaming_sessions, active_listeners
Migration file: migrations/001_initial_schema.sql (MySQL syntax)
Key relationships:

churches → machines (1:1)
churches → streaming_credentials (1:1)
priests ↔ churches via priest_churches (N:N)
users ↔ churches via user_subscriptions (N:N)
streaming_sessions → churches, → priests

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
│   │   ├── device_handler.go
│   │   ├── priest_handler.go
│   │   └── user_handler.go
│   └── services/               # Business logic per role
│       ├── admin_service.go
│       ├── auth_service.go
│       ├── priest_service.go
│       └── user_service.go
├── migrations/
│   ├── 001_initial_schema.sql
│   └── 001_initial_schema_down.sql
├── go.mod
├── go.sum
└── .env

priest-pwa/                     # React + Vite + TS + Tailwind
user-pwa/                       # React + Vite + TS + Tailwind
admin-pwa/                      # React + Vite + TS + Tailwind (TBD)
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
DB_PASSWORD=4ifK(E)OrrQ-pi6yH
DB_NAME=st1stream
JWT_SECRET=<min 32 chars>
JWT_EXPIRATION_HOURS=72
ICECAST_BASE_URL=http://vdserv.com:8000
ICECAST_SOURCE_PASSWORD=r0j1e0A8bx
DEVICE_API_KEY=<shared secret for ST1 auth>
Recent Changes (Feb 11, 2026)
MySQL Migration (from PostgreSQL)
Files changed:

go.mod: gorm.io/driver/postgres → gorm.io/driver/mysql v1.5.7
config.go: DSN format changed to user:pass@tcp(host:port)/db?charset=utf8mb4&parseTime=True&loc=Local, default port 3306, removed DBSSLMode, added IcecastSourcePassword
main.go: import gorm.io/driver/mysql, call mysql.Open()
001_initial_schema.sql: SERIAL → INT AUTO_INCREMENT, BOOLEAN → TINYINT(1), DEFAULT NOW() → DEFAULT CURRENT_TIMESTAMP, added ENGINE=InnoDB DEFAULT CHARSET=utf8mb4

After pulling changes: run go mod tidy to download mysql driver and clean postgres deps.
Icecast Global Password

config.go now has IcecastSourcePassword field (env: ICECAST_SOURCE_PASSWORD)
priest_service.go GetStreamStatus() still returns stream_key from DB — TODO: update to return global Icecast password instead, or handle in Priest PWA

Collaboration Notes

Svilen handles server infrastructure (Hetzner VPS, Icecast, ST1 hardware/firmware)
Nicholas handles all software development (backend, PWAs, deployment)
Svilen's server has MySQL pre-installed. PostgreSQL was originally planned but we adapted to MySQL to simplify deployment.
ST1 is accessible remotely (not just LAN)
Deployment responsibility: Nicholas (SSH access TBD)

What's Done vs TODO
✅ Done

Backend API: 30 endpoints, JWT+RBAC, all handlers/services
Database schema: 10 tables, MySQL migration ready
Priest PWA: Auth, dashboard, stream control, session history
User PWA: Auth, browse churches, subscribe, live audio player
Mock ST1 server for local testing
Documentation (architecture, API ref, DB, setup, deployment, ST1 integration)

🔲 TODO
Priority: Icecast Global Password Adaptation
Icecast uses a single global source password (r0j1e0A8bx) for ALL mounts. The current code still returns a per-church stream_key from the DB. This needs fixing:

priest_service.go:

Add IcecastSourcePassword string and IcecastBaseURL string fields to PriestService struct
Update NewPriestService() to accept these two params
In GetStreamStatus(): replace res["stream_key"] = church.StreamingCredential.StreamKey with res["icecast_source_password"] = s.IcecastSourcePassword and add res["icecast_url"] built from IcecastBaseURL + "/" + stream_id + ".mp3"


main.go:

Update NewPriestService(db) call to NewPriestService(db, cfg.IcecastBaseURL, cfg.IcecastSourcePassword)



Other TODO

Run go mod tidy after MySQL migration
Run migration SQL on Hetzner MySQL
Test backend startup with MySQL connection
Admin PWA implementation
Deploy backend to Hetzner
End-to-end test with real ST1 hardware
Verify/obtain SSH credentials for Hetzner server