# Deployment Guide — VerbumDigital Web Radio

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Hetzner VPS                                             │
│  ┌───────────────────┐  ┌────────────────────────────┐  │
│  │ MySQL (st1stream)  │  │ Go Backend (:8081)         │  │
│  │                    │←─│ api.verbumdigital.it       │  │
│  └───────────────────┘  │ (Apache reverse proxy+SSL) │  │
│                          └────────────────────────────┘  │
│  ┌────────────────────────────┐                          │
│  │ Icecast (:8000)            │                          │
│  │ vdserv.com:8000            │                          │
│  └────────────────────────────┘                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Vercel (3 separate projects, same repo)                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────────┐       │
│  │ User PWA  │  │ Admin PWA │  │ Priest PWA    │       │
│  │ app.vd.it │  │ admin.vd  │  │ priest.vd     │       │
│  └───────────┘  └───────────┘  └───────────────┘       │
│  All → api.verbumdigital.it/api/v1                      │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Vercel Setup (Frontend PWAs)

### Monorepo: 3 Vercel projects, 1 GitHub repo

Each PWA is a **separate Vercel project** pointing to the same Git repo, but with a different **Root Directory**.

| Vercel Project | Root Directory    | Domain (suggested)        |
| -------------- | ----------------- | ------------------------- |
| `vd-user`      | `frontend/user`   | `app.verbumdigital.it`    |
| `vd-admin`     | `frontend/admin`  | `admin.verbumdigital.it`  |
| `vd-priest`    | `frontend/priest` | `priest.verbumdigital.it` |

### Steps per project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the `verbumdigital-web-radio` repo
3. Set **Root Directory** to `frontend/user` (or `/admin` or `/priest`)
4. Set **Framework Preset** to `Vite`
5. **Environment Variables** — add in Vercel dashboard (Settings → Environment Variables):

   | Key                     | Value                                       |
   | ----------------------- | ------------------------------------------- |
   | `VITE_API_BASE_URL`     | `https://api.verbumdigital.it/api/v1`       |
   | `VITE_VAPID_PUBLIC_KEY` | `BIk3q_zf8FaTcIfWx1-z46TEJJgPfQCb0_t90R...` |

   > ⚠️ `VITE_VAPID_PUBLIC_KEY` is only needed for the **User** PWA.

6. Click **Deploy**

### Important: `@shared` dependency

All three PWAs import from `../shared` via the `@shared` alias in `vite.config.ts`.
Vercel includes parent directories when building in a monorepo, so this works out of the box as long as the **Root Directory is set correctly** (e.g., `frontend/user` NOT `./`).

---

## 2. Backend (Hetzner)

The backend is a Go binary served behind Apache reverse proxy with SSL.

### Update & Redeploy

```bash
# SSH into Hetzner
ssh nicholas@vdservice

# Backup database FIRST
mysqldump -u st1stream -p st1stream > ~/backup_$(date +%Y%m%d_%H%M).sql

# Pull latest code
cd ~/verbumdigital-web-radio
git pull origin main

# Build new binary
cd backend
go build -o server cmd/server/main.go

# Update .env if needed (check for new variables)
nano .env

# Restart service
sudo systemctl restart vd-backend
```

### Adding CORS for new Vercel domains

When you add Admin/Priest Vercel domains, update `main.go` CORS:

```go
AllowOrigins: []string{
    "https://app.verbumdigital.it",
    "https://admin.verbumdigital.it",
    "https://priest.verbumdigital.it",
},
```

---

## 3. ST1-less Smoke Test

Test the full flow without ST1 hardware using `curl`:

```bash
# 1. Start a fake live session
curl -X POST https://api.verbumdigital.it/api/v1/device/stream/started \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: YOUR_DEVICE_API_KEY" \
  -d '{"serial_number": "SMIX-PROD-TEST"}'

# 2. Check User PWA → go to the church → should show "In Diretta"

# 3. Stop the session
curl -X POST https://api.verbumdigital.it/api/v1/device/stream/stopped \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: YOUR_DEVICE_API_KEY" \
  -d '{"serial_number": "SMIX-PROD-TEST"}'
```

---

## Environment Variables Reference

### Backend (.env on Hetzner)

| Variable               | Description                |
| ---------------------- | -------------------------- |
| `PORT`                 | Server port (8081)         |
| `DB_HOST`              | MySQL host                 |
| `DB_PORT`              | MySQL port (3306)          |
| `DB_USER`              | MySQL user                 |
| `DB_PASSWORD`          | MySQL password             |
| `DB_NAME`              | MySQL database name        |
| `JWT_SECRET`           | JWT signing key            |
| `JWT_EXPIRATION_HOURS` | Token lifetime             |
| `ICECAST_BASE_URL`     | Icecast server URL         |
| `DEVICE_API_KEY`       | Shared secret for ST1 auth |
| `VAPID_PUBLIC_KEY`     | Web Push public key        |
| `VAPID_PRIVATE_KEY`    | Web Push private key       |
| `VAPID_EMAIL`          | VAPID contact email        |

### Frontend (Vercel dashboard)

| Variable                | Required By    |
| ----------------------- | -------------- |
| `VITE_API_BASE_URL`     | All three PWAs |
| `VITE_VAPID_PUBLIC_KEY` | User PWA only  |
