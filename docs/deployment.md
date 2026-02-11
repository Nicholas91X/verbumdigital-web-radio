# Guida al Deployment su Hetzner

Questa guida illustra i passaggi per portare l'applicazione VerbumDigital in produzione su un server Linux (Ubuntu/Debian) di Hetzner.

## 1. Prerequisiti

*   **Server VPS**: Accesso SSH `root` al server.
*   **Domini**: Domini puntati all'IP del server (es. `api.verbumdigital.com`, `admin.verbumdigital.com`, ecc.).
*   **Docker & Docker Compose**: Installati sul server.

### Installazione Docker (se non presente)
```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt install -y docker-compose-plugin
```

## 2. Preparazione Database (MySQL)

Su Hetzner, useremo Docker per gestire il database in modo semplice e isolato, simile all'ambiente locale.

1.  **Crea una directory per il progetto**:
    ```bash
    mkdir -p /opt/verbumdigital/database
    cd /opt/verbumdigital/database
    ```

2.  **Crea `docker-compose.yml` per il DB**:
    ```yaml
    version: '3.8'
    services:
      mysql:
        image: mysql:8.0
        container_name: vd-mysql
        restart: always
        environment:
          MYSQL_ROOT_PASSWORD: <PASSWORD_SICURA_DB>
          MYSQL_DATABASE: st1stream
          MYSQL_USER: st1stream
          MYSQL_PASSWORD: <PASSWORD_SICURA_DB>
        ports:
          - "3306:3306"
        volumes:
          - mysqldata:/var/lib/mysql
        command: --default-authentication-plugin=mysql_native_password --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    volumes:
      mysqldata:
        driver: local
    ```

3.  **Avvia il database**:
    ```bash
    docker compose up -d
    ```

4.  **Copia lo schema iniziale**:
    Dalla tua macchina locale, copia il file SQL sul server:
    ```bash
    scp backend/migrations/001_initial_schema.sql root@<IP_HETZNER>:/opt/verbumdigital/database/
    ```

5.  **Esegui la migrazione**:
    Sul server:
    ```bash
    docker exec -i vd-mysql mysql -ust1stream -p<PASSWORD_SICURA_DB> st1stream < /opt/verbumdigital/database/001_initial_schema.sql
    ```

## 3. Preparazione e Compilazione Backend (Go)

Dobbiamo compilare l'eseguibile Go per l'architettura Linux del server (generalmente `amd64`).

1.  **Compilazione Cross-Platform** (Locale):
    Apri un terminale nella cartella `backend` del tuo progetto locale:
    ```powershell
    # Windows (PowerShell)
    $Env:GOOS = "linux"
    $Env:GOARCH = "amd64"
    go build -o vd-server ./cmd/server
    # (Dopo la compilazione, rimuovi le variabili d'ambiente se necessario o riavvia il terminale)
    ```

2.  **Upload dei file**:
    Crea la cartella app sul server: `mkdir -p /opt/verbumdigital/backend`.
    Copia l'eseguibile e crea il file `.env`.
    ```bash
    scp backend/vd-server root@<IP_HETZNER>:/opt/verbumdigital/backend/
    ```

3.  **Configurazione `.env` Produzione**:
    Sul server, crea `/opt/verbumdigital/backend/.env`:
    ```bash
    nano /opt/verbumdigital/backend/.env
    ```
    Incolla e personalizza:
    ```ini
    PORT=8080
    DB_HOST=localhost
    DB_PORT=3306
    DB_USER=st1stream
    DB_PASSWORD=<PASSWORD_SICURA_DB_SCELTA_PRIMA>
    DB_NAME=st1stream
    
    JWT_SECRET=<GENERA_UNA_STRINGA_LUNGA_E_CASUALE>
    JWT_EXPIRATION_HOURS=720
    
    # URL Server Icecast (di produzione)
    ICECAST_BASE_URL=http://<IP_O_DOMINIO_ICECAST>:8000
    
    DEVICE_API_KEY=<GENERA_UNA_CHIAVE_PER_ST1>
    ```

## 4. Configurazione Systemd (Service)

Per far girare il backend come servizio background che si riavvia automaticamente.

1.  **Crea il file di servizio**:
    ```bash
    nano /etc/systemd/system/verbumdigital.service
    ```

2.  **Contenuto**:
    ```ini
    [Unit]
    Description=VerbumDigital Backend API
    After=network.target docker.service

    [Service]
    User=root
    WorkingDirectory=/opt/verbumdigital/backend
    ExecStart=/opt/verbumdigital/backend/vd-server
    Restart=always
    RestartSec=5
    EnvironmentFile=/opt/verbumdigital/backend/.env
    LimitNOFILE=10000

    [Install]
    WantedBy=multi-user.target
    ```

3.  **Attivazione**:
    ```bash
    systemctl daemon-reload
    systemctl enable verbumdigital
    systemctl start verbumdigital
    systemctl status verbumdigital
    ```

## 5. Reverse Proxy & HTTPS (Caddy)

Caddy è consigliato per gestire automaticamente i certificati SSL.

1.  **Installazione Caddy**:
    (Segui le istruzioni ufficiali per la tua distro, su Ubuntu:)
    ```bash
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update
    sudo apt install caddy
    ```

2.  **Configurazione `/etc/caddy/Caddyfile`**:
    ```caddyfile
    api.verbumdigital.com {
        reverse_proxy localhost:8080
    }
    
    # Se ospiti anche i frontend qui:
    # app.verbumdigital.com {
    #     root * /var/www/user_pwa
    #     file_server
    # }
    ```

3.  **Riavvia Caddy**:
    ```bash
    systemctl restart caddy
    ```

## 6. Hosting Frontend (PWAs)

Per le PWA (React/Vite), devi fare la build locale e caricare i file statici (`dist`).

1.  **Build Locale**:
    Nelle cartelle `frontend/admin`, `frontend/priest`, `frontend/user`:
    Assicurati che `.env.production` abbia:
    ```
    VITE_API_BASE_URL=https://api.verbumdigital.com/api/v1
    ```
    Poi esegui:
    ```bash
    npm run build
    ```

2.  **Upload**:
    Carica il contenuto delle cartelle `dist` sul server in `/var/www/` (es. `/var/www/admin`, `/var/www/user`, ecc.) e configura Caddy per servirle.