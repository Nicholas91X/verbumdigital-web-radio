# AI Context & Production Handover (VerbumDigital Web Radio)

> **ATTENTION AI AGENTS**: Read this document first if you are assigned tasks related to deployment, architecture, or backend modifications in the VerbumDigital Web Radio project.

## Production Environment Overview

The application is split across two main hosting providers:

1. **Frontend (Vercel)**: Hosts three separate Progressive Web Apps (PWAs) from the same monorepo.
2. **Backend (Hetzner VPS)**: Hosts the Go backend, the MySQL database, and the Apache reverse proxy.

## 1. Frontend (Vercel)

The project is a monorepo containing three PWAs under the `frontend/` directory.

### Domains & Projects

- **User PWA** (`frontend/user`): `https://app.verbumdigital.it`
- **Admin PWA** (`frontend/admin`): `https://admin.verbumdigital.it`
- **Priest PWA** (`frontend/priest`): `https://priest.verbumdigital.it`

### Framework & Build

- Built with React, Vite, and `vite-plugin-pwa` (using `injectManifest` strategy).
- All three apps share code from `frontend/shared/` via the `@shared` alias.
- **Environment Variables**:
  - `VITE_API_BASE_URL` = `https://api.verbumdigital.it/api/v1` (in all projects)
  - `VITE_VAPID_PUBLIC_KEY` = (Only in User PWA, used for Push Notifications)
  - _Note_: `.env.*` files are gitignored (except `.env.example`). Variables are set directly in the Vercel dashboard.

## 2. Backend (Hetzner VPS)

### Architecture

- **API Domain**: `https://api.verbumdigital.it`
- **Reverse Proxy**: Apache2 handles SSL (Let's Encrypt) and proxies requests to `http://localhost:8081`.
- **Backend Service**: Written in Go (Gin framework), runs on port `8081`.

### Server Configuration (CRITICAL FOR DEPLOYMENTS)

- **Go Compiler**: The Go compiler (`go` command) is **NOT INSTALLED** on the Hetzner server.
- **Source Code**: The git repository is **NOT CLONED** on the Hetzner server.
- **Process Management**: The backend runs as a systemd service named **`verbumdigital.service`**.

**Consequence for Deployments**:
You cannot build the code on the server. You MUST cross-compile the Go binary on your local machine and upload it via SCP.

#### Deployment Workflow

1. Locally build internal Linux AMD64 binary:
   ```powershell
   $env:GOOS='linux'; $env:GOARCH='amd64'; go build -o vd-server cmd/server/main.go; $env:GOOS=''; $env:GOARCH=''
   ```
2. Upload via SCP:
   ```bash
   scp backend/vd-server nicholas@195.201.138.249:/tmp/vd-server-new
   ```
3. SSH into Hetzner and restart the service:
   ```bash
   cp /tmp/vd-server-new /opt/verbumdigital/backend/vd-server
   chmod +x /opt/verbumdigital/backend/vd-server
   sudo systemctl restart verbumdigital.service
   ```
   _(Do NOT try to manually run `nohup ./vd-server`, as `verbumdigital.service` will keep running and port 8081 will throw `address already in use`)_.

### Database (MySQL)

- The backend uses MySQL (switched from PostgreSQL). GORM `AutoMigrate` is used, utilizing `int32` types to match MySQL's 32-bit `INT` auto-increment primary keys.
- **Database Name in Production**: `st1` (User: `st1stream`). Note this differs from the local `.env` which often uses `st1stream` as both user and DB name.
- **Backups**: MUST be performed before pushing any schema changes.
  ```bash
  mysqldump --no-tablespaces -u st1stream -p'...' st1 > ~/backup_$(date +%Y%m%d_%H%M).sql
  ```

### External Services

- **Icecast**: Hosted externally at `http://vdserv.com:8000`. The backend proxies stream URLs from here.
- **Push Notifications (VAPID)**: keys must be matched between backend `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) and Vercel User PWA (`VITE_VAPID_PUBLIC_KEY`).

## Default Production Credentials

The system auto-seeds these on a fresh database:

- **Admin**: `admin@verbumdigital.it` / `adminpassword`
- **Priest**: `priest@church.com` / `priestpassword`
- **User**: `user@example.com` / `userpassword`
