# API Reference

Base URL: `http://{server}:8081/api/v1`

---

## Autenticazione

### Public endpoints (no auth)

#### POST `/auth/admin/login`
```json
// Request
{ "email": "admin@verbumdigital.com", "password": "secret" }

// Response 200
{
  "token": "eyJhbG...",
  "user": { "id": 1, "username": "admin", "email": "admin@verbumdigital.com", "role": "admin" }
}
```

#### POST `/auth/priest/login`
```json
// Request
{ "email": "don.mario@email.com", "password": "secret" }

// Response 200
{
  "token": "eyJhbG...",
  "user": { "id": 1, "name": "Don Mario", "email": "don.mario@email.com", "role": "priest" }
}
```

#### POST `/auth/user/login`
```json
// Request
{ "email": "fedele@email.com", "password": "secret" }

// Response 200
{
  "token": "eyJhbG...",
  "user": { "id": 1, "name": "Marco Rossi", "email": "fedele@email.com", "role": "user" }
}
```

#### POST `/auth/user/register`
```json
// Request
{ "name": "Marco Rossi", "email": "fedele@email.com", "password": "secret" }

// Response 201
{
  "token": "eyJhbG...",
  "user": { "id": 1, "name": "Marco Rossi", "email": "fedele@email.com", "role": "user" }
}
```

**Errori comuni (tutti gli auth):**
- `400` — Validazione fallita (email non valida, password < 6 chars)
- `401` — Credenziali non valide
- `409` — Email già registrata (solo register)

---

## Admin endpoints

Header richiesto: `Authorization: Bearer <admin_token>`

### Machines

#### GET `/admin/machines`
```json
// Response 200
{
  "machines": [
    {
      "id": 1,
      "machine_id": "SMIX-12345",
      "activated": true,
      "activation_code": "A7K3NP2X",
      "created_at": "2026-02-06T10:00:00Z",
      "church": { "id": 1, "name": "San Pietro" }
    }
  ]
}
```

#### POST `/admin/machines`
```json
// Request
{ "machine_id": "SMIX-12345" }

// Response 201
{
  "machine": {
    "id": 1,
    "machine_id": "SMIX-12345",
    "activated": false,
    "activation_code": "A7K3NP2X"
  }
}
```

#### PUT `/admin/machines/:id`
```json
// Request
{ "machine_id": "SMIX-67890" }

// Response 200
{ "machine": { ... } }
```

#### PUT `/admin/machines/:id/activate`
```json
// Response 200
{ "message": "Machine activated", "machine": { ... } }
```

#### PUT `/admin/machines/:id/deactivate`
```json
// Response 200
{ "message": "Machine deactivated", "machine": { ... } }
```

### Churches

#### GET `/admin/churches`
```json
// Response 200
{
  "churches": [
    {
      "id": 1,
      "name": "Parrocchia San Pietro",
      "address": "Via Roma 1, Milano",
      "logo_url": "https://...",
      "streaming_active": false,
      "machine": { "id": 1, "machine_id": "SMIX-12345" },
      "streaming_credential": { "stream_id": "streamab3xk9f2m7p4" },
      "priests": [{ "id": 1, "name": "Don Mario" }]
    }
  ]
}
```

#### POST `/admin/churches`
Crea la chiesa e auto-genera `streaming_credentials`.
```json
// Request
{
  "name": "Parrocchia San Pietro",
  "address": "Via Roma 1, Milano",
  "logo_url": "https://...",
  "machine_id": 1
}

// Response 201
{
  "church": { ... },
  "streaming_credentials": {
    "stream_id": "streamab3xk9f2m7p4"
  }
}
```

#### PUT `/admin/churches/:id`
```json
// Request (tutti i campi opzionali)
{ "name": "Nuovo nome", "address": "Nuovo indirizzo", "logo_url": "...", "machine_id": 2 }

// Response 200
{ "church": { ... } }
```

### Priests

#### GET `/admin/priests`
```json
// Response 200
{
  "priests": [
    {
      "id": 1,
      "name": "Don Mario",
      "email": "don.mario@email.com",
      "churches": [{ "id": 1, "name": "San Pietro" }]
    }
  ]
}
```

#### POST `/admin/priests`
```json
// Request
{
  "name": "Don Mario",
  "email": "don.mario@email.com",
  "password": "secret123",
  "church_ids": [1, 3]
}

// Response 201
{ "priest": { ... } }
```

### Sessions

#### GET `/admin/sessions?limit=50`
```json
// Response 200
{
  "sessions": [
    {
      "id": 1,
      "church_id": 1,
      "started_at": "2026-02-06T14:00:00Z",
      "ended_at": "2026-02-06T15:30:00Z",
      "duration_seconds": 5400,
      "max_listener_count": 42,
      "church": { "name": "San Pietro" },
      "priest": null
    }
  ]
}
```
Nota: `priest` è `null` per sessioni avviate dall'hardware ST1.

---

## Priest endpoints (read-only)

Header richiesto: `Authorization: Bearer <priest_token>`

Lo streaming è controllato dall'hardware ST1 tramite av-control. La Priest PWA è solo monitoring.

#### GET `/priest/churches`
```json
// Response 200
{
  "churches": [
    {
      "id": 1,
      "name": "Parrocchia San Pietro",
      "streaming_active": false,
      "machine": { "machine_id": "SMIX-12345" }
    }
  ]
}
```

#### GET `/priest/churches/:id/stream/status`
```json
// Response 200 (stream attivo)
{
  "church_id": 1,
  "church_name": "San Pietro",
  "streaming_active": true,
  "session": { "id": 5, "started_at": "2026-02-06T14:00:00Z" }
}

// Response 200 (stream inattivo)
{
  "church_id": 1,
  "church_name": "San Pietro",
  "streaming_active": false
}
```

#### GET `/priest/churches/:id/sessions?limit=20`
```json
// Response 200
{
  "sessions": [ { ... }, { ... } ]
}
```

---

## User endpoints

Header richiesto: `Authorization: Bearer <user_token>`

#### GET `/user/churches?search=san`
```json
// Response 200
{
  "churches": [
    {
      "id": 1,
      "name": "Parrocchia San Pietro",
      "logo_url": "...",
      "address": "Via Roma 1",
      "streaming_active": true
    }
  ]
}
```

#### GET `/user/churches/:id`
```json
// Response 200
{
  "id": 1,
  "name": "Parrocchia San Pietro",
  "logo_url": "...",
  "address": "Via Roma 1",
  "streaming_active": true,
  "subscriber_count": 156
}
```

#### POST `/user/churches/:id/subscribe`
```json
// Response 201
{
  "message": "Subscribed successfully",
  "subscription": { "id": 1, "user_id": 1, "church_id": 1, "notifications_enabled": true }
}
```

#### DELETE `/user/churches/:id/subscribe`
```json
// Response 200
{ "message": "Unsubscribed successfully" }
```

#### PUT `/user/churches/:id/notifications`
```json
// Request
{ "enabled": false }

// Response 200
{ "message": "Notification preference updated" }
```

#### GET `/user/subscriptions`
```json
// Response 200
{
  "subscriptions": [
    {
      "subscription_id": 1,
      "church_id": 1,
      "church_name": "San Pietro",
      "church_logo_url": "...",
      "streaming_active": true,
      "notifications_enabled": true,
      "subscribed_at": "2026-02-01T10:00:00Z"
    }
  ]
}
```

#### GET `/user/stream/:stream_id`
Richiede subscription attiva alla chiesa.
```json
// Response 200
{
  "church_id": 1,
  "church_name": "San Pietro",
  "streaming_active": true,
  "stream_url": "http://vdserv.com:8000/streamab3xk9f2m7p4.mp3"
}
```
Errori: `403` non iscritto, `404` stream non trovato

---

## Device endpoints (ST1 → Server)

Header richiesto: `X-Device-Key: <device_api_key>`

La ST1 identifica sé stessa tramite `serial_number` (corrisponde a `machine_id` nel DB).

#### POST `/device/validate`
ST1 chiama per ottenere la configurazione Icecast prima di iniziare lo stream.
```json
// Request
{ "serial_number": "SMIX-12345" }

// Response 200
{
  "valid": true,
  "church_id": 1,
  "stream_id": "streamab3xk9f2m7p4",
  "icecast_url": "http://vdserv.com:8000",
  "mount": "/streamab3xk9f2m7p4.mp3"
}

// Response 404
{ "error": "Machine not found" }

// Response 403
{ "error": "Machine not activated" }

// Response 404
{ "error": "No church linked to this machine" }
```

#### POST `/device/stream/started`
ST1 notifica che lo stream è partito. Il backend **crea la sessione** nel DB.
```json
// Request
{ "serial_number": "SMIX-12345" }

// Response 200 (nuova sessione)
{ "success": true, "session_id": 5, "church_id": 1 }

// Response 200 (idempotente — già in streaming)
{ "success": true, "session_id": 5, "church_id": 1 }
```

#### POST `/device/stream/stopped`
ST1 notifica che lo stream si è fermato. Il backend **chiude la sessione** nel DB.
Safety net per consistenza DB (stop manuale, connessione persa, riavvio ST1).
```json
// Request
{ "serial_number": "SMIX-12345" }

// Response 200
{ "success": true, "church_id": 1 }

// Response 200 (idempotente — nessuno stream attivo)
{ "success": true, "church_id": 1 }
```

---

## ST1 Local endpoints (smixRest, porta 8080)

Questi endpoint sono sul dispositivo ST1 locale, NON sul backend. Sono chiamati da **av-control** (PWA locale sulla ST1), non dalla Priest PWA.

#### POST `/api/device/st1/play`
```json
// Response
{ "success": true }
```

#### POST `/api/device/st1/stop`
```json
// Response
{ "success": true }
```

#### GET `/api/device/st1/status`
```json
// Response
{ "state": "streaming|stopped|noid", "current_time": 125 }
```

#### GET `/api/device/st1/setup`
```json
// Response
{ "stream_url": "icecast://source:key@vdserv.com:8000/streamid.mp3" }
```

#### POST `/api/device/st1/setup`
```json
// Request
{ "stream_url": "icecast://source:key@vdserv.com:8000/streamid.mp3" }
```