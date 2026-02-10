# Guida Deployment

## Infrastruttura

Tutto su **Hetzner** (stesso server di Icecast e PostgreSQL):
- OS: Linux (Ubuntu)
- Server: vdserv.com
- PostgreSQL: porta 5432
- Icecast: porta 8000
- Backend API: porta 8081

## Backend (Go)

### Build

```bash
cd backend

# Build binario per Linux
GOOS=linux GOARCH=amd64 go build -o bin/webradio-api cmd/server/main.go
```

### Deploy

```bash
# Upload binario
scp bin/webradio-api user@vdserv.com:/opt/webradio/

# Upload .env di produzione
scp .env.production user@vdserv.com:/opt/webradio/.env
```

### Systemd service

```ini
# /etc/systemd/system/webradio-api.service

[Unit]
Description=VerbumDigital WebRadio API
After=network.target postgresql.service

[Service]
Type=simple
User=webradio
WorkingDirectory=/opt/webradio
ExecStart=/opt/webradio/webradio-api
EnvironmentFile=/opt/webradio/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable webradio-api
sudo systemctl start webradio-api
sudo systemctl status webradio-api

# Logs
sudo journalctl -u webradio-api -f
```

## Frontend (PWA)

### Build

```bash
cd frontend/admin && npm run build
cd frontend/priest && npm run build
cd frontend/user && npm run build
```

Ogni build produce una cartella `dist/` con file statici.

### Deploy con Nginx

```nginx
# /etc/nginx/sites-available/webradio

# Admin PWA
server {
    listen 443 ssl;
    server_name admin.verbumdigital.com;

    root /var/www/webradio/admin;
    index index.html;

    # PWA: tutte le route servono index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/admin.verbumdigital.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.verbumdigital.com/privkey.pem;
}

# Priest PWA
server {
    listen 443 ssl;
    server_name priest.verbumdigital.com;

    root /var/www/webradio/priest;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    ssl_certificate /etc/letsencrypt/live/priest.verbumdigital.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/priest.verbumdigital.com/privkey.pem;
}

# User PWA (ogni chiesa potrebbe avere un sottodominio — TBD)
server {
    listen 443 ssl;
    server_name app.verbumdigital.com;

    root /var/www/webradio/user;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    ssl_certificate /etc/letsencrypt/live/app.verbumdigital.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.verbumdigital.com/privkey.pem;
}

# API Proxy
server {
    listen 443 ssl;
    server_name api.verbumdigital.com;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    ssl_certificate /etc/letsencrypt/live/api.verbumdigital.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.verbumdigital.com/privkey.pem;
}
```

### Upload

```bash
# Upload build artifacts
scp -r frontend/admin/dist/* user@vdserv.com:/var/www/webradio/admin/
scp -r frontend/priest/dist/* user@vdserv.com:/var/www/webradio/priest/
scp -r frontend/user/dist/* user@vdserv.com:/var/www/webradio/user/
```

## SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx

sudo certbot --nginx -d admin.verbumdigital.com
sudo certbot --nginx -d priest.verbumdigital.com
sudo certbot --nginx -d app.verbumdigital.com
sudo certbot --nginx -d api.verbumdigital.com
```

## Database migration (produzione)

```bash
# Da locale via SSH tunnel
ssh -L 5432:localhost:5432 user@vdserv.com

psql -h localhost -U st1stream -d st1stream -f backend/migrations/001_initial_schema.sql
```

## Checklist pre-deploy

- [ ] .env di produzione con password sicure
- [ ] JWT_SECRET generato (almeno 32 chars random)
- [ ] DEVICE_API_KEY generato e comunicato a Svilen
- [ ] DB migrato
- [ ] Admin account seed inserito
- [ ] SSL certificati attivi
- [ ] Firewall: porte 443, 8000 (Icecast) aperte
- [ ] Firewall: porta 5432 (PostgreSQL) chiusa dall'esterno
- [ ] Nginx configurato e testato
- [ ] Systemd service attivo
- [ ] Backup DB configurato