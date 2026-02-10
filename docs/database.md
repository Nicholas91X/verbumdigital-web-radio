# Database Schema

## Connessione

```
Host:     vdserv.com (o localhost se tunnel SSH)
Port:     5432
Database: st1stream
User:     st1stream
```

## Tabelle

### machines
Rappresenta l'hardware S-Mix con scheda ST1.

| Colonna | Tipo | Note |
|---------|------|------|
| id | SERIAL PK | |
| machine_id | VARCHAR(50) UNIQUE | Es: "SMIX-12345" |
| activated | BOOLEAN | Default false |
| activation_code | VARCHAR(20) | Auto-generato (es: "A7K3NP2X") |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### churches
Una chiesa è associata a una macchina (1:1).

| Colonna | Tipo | Note |
|---------|------|------|
| id | SERIAL PK | |
| machine_id | INTEGER UNIQUE FK→machines | |
| name | VARCHAR(200) NOT NULL | |
| logo_url | VARCHAR(500) | |
| address | TEXT | |
| streaming_active | BOOLEAN | Flag real-time |
| current_session_id | INTEGER FK→streaming_sessions | Sessione attiva |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### streaming_credentials
Credenziali Icecast per ogni chiesa. Permanenti, generate dall'admin.

| Colonna | Tipo | Note |
|---------|------|------|
| id | SERIAL PK | |
| church_id | INTEGER UNIQUE FK→churches | |
| stream_id | VARCHAR(100) UNIQUE | Es: "streamab3xk9f2m7p4" |
| stream_key | VARCHAR(255) | Chiave segreta 32 chars |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**URL Icecast risultante:** `http://vdserv.com:8000/{stream_id}.mp3`

**URL setup ST1:** `icecast://source:{stream_key}@vdserv.com:8000/{stream_id}.mp3`

### priests

| Colonna | Tipo | Note |
|---------|------|------|
| id | SERIAL PK | |
| name | VARCHAR(200) NOT NULL | |
| email | VARCHAR(200) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### priest_churches
Join table N:N. Un prete può gestire più chiese.

| Colonna | Tipo | Note |
|---------|------|------|
| id | SERIAL PK | |
| priest_id | INTEGER FK→priests | ON DELETE CASCADE |
| church_id | INTEGER FK→churches | ON DELETE CASCADE |
| role | VARCHAR(20) | "owner" o "assistant" |
| created_at | TIMESTAMP | |

UNIQUE(priest_id, church_id)

### users
I fedeli che ascoltano gli streaming.

| Colonna | Tipo | Note |
|---------|------|------|
| id | SERIAL PK | |
| name | VARCHAR(200) NOT NULL | |
| email | VARCHAR(200) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### user_subscriptions
Un utente può seguire più chiese, con preferenze notifiche individuali.

| Colonna | Tipo | Note |
|---------|------|------|
| id | SERIAL PK | |
| user_id | INTEGER FK→users | ON DELETE CASCADE |
| church_id | INTEGER FK→churches | ON DELETE CASCADE |
| notifications_enabled | BOOLEAN | Default true |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

UNIQUE(user_id, church_id)

### admins
Account interni (noi).

| Colonna | Tipo | Note |
|---------|------|------|
| id | SERIAL PK | |
| username | VARCHAR(100) UNIQUE | |
| email | VARCHAR(200) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt |
| created_at | TIMESTAMP | |

### streaming_sessions
Storico di ogni sessione di streaming con statistiche.

| Colonna | Tipo | Note |
|---------|------|------|
| id | SERIAL PK | |
| church_id | INTEGER FK→churches | |
| started_by_priest_id | INTEGER FK→priests | Nullable |
| started_at | TIMESTAMP NOT NULL | |
| ended_at | TIMESTAMP | Null se in corso |
| duration_seconds | INTEGER | Calcolato al termine |
| recording_url | VARCHAR(500) | Futuro |
| max_listener_count | INTEGER | Default 0, da PWA connections |
| created_at | TIMESTAMP | |

### active_listeners
Tracking real-time dei listener connessi (basato su heartbeat PWA).

| Colonna | Tipo | Note |
|---------|------|------|
| id | SERIAL PK | |
| session_id | INTEGER FK→streaming_sessions | ON DELETE CASCADE |
| user_id | INTEGER FK→users | Nullable (anonimi) |
| connected_at | TIMESTAMP | |
| last_heartbeat | TIMESTAMP | Per cleanup disconnessi |

## Indici

```sql
idx_churches_streaming_active       -- Query "chi sta streamando?"
idx_churches_machine_id             -- Lookup machine → church
idx_streaming_credentials_stream_id -- Validazione ST1
idx_priest_churches_priest_id       -- Chiese di un prete
idx_priest_churches_church_id       -- Preti di una chiesa
idx_user_subscriptions_user_id      -- Iscrizioni di un utente
idx_user_subscriptions_church_id    -- Iscritti a una chiesa
idx_streaming_sessions_church_id    -- Storico per chiesa
idx_active_listeners_session_id     -- Listener di una sessione
idx_active_listeners_last_heartbeat -- Cleanup listener disconnessi
```

## Migrazioni

```bash
# Applicare
psql -h vdserv.com -U st1stream -d st1stream -f migrations/001_initial_schema.sql

# Rollback
psql -h vdserv.com -U st1stream -d st1stream -f migrations/001_initial_schema_down.sql
```

## Seed admin iniziale

```sql
-- Genera hash con: go run -e 'services.HashPassword("your_password")'
-- Oppure usa bcrypt online

INSERT INTO admins (username, email, password_hash)
VALUES ('admin', 'admin@verbumdigital.com', '$2a$10$...');
```