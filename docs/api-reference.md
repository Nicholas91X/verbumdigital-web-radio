# VerbumDigital API Reference

Backend Base URL: `http://localhost:8081/api/v1`

## Authentication

### Auth Methods

1. **JWT (Bearer Token)**: Used by Admin, Priest, and User PWAs.
   - Header: `Authorization: Bearer <token>`
2. **Device API Key**: Used by ST1 Hardware.
   - Header: `X-Device-Key: <DEVICE_API_KEY>`

---

## Device API (ST1)

Endpoints for hardware communication. Auth via `X-Device-Key`.

### POST /device/validate

ST1 identifies itself on boot.

- **Request Body**: `{ "serial_number": "SMIX-001" }`
- **Response**:
  ```json
  {
    "valid": true,
    "church_id": 1,
    "church_name": "San Pietro",
    "stream_id": "san-pietro-mix",
    "icecast_url": "http://vdserv.com:8000",
    "mount": "/san-pietro-mix.mp3"
  }
  ```

### POST /device/stream/started

Notify that actual audio streaming has begun. Triggers push notifications to subscribers.

- **Request Body**: `{ "serial_number": "SMIX-001" }`
- **Response**: `{ "success": true, "session_id": 12, "church_id": 1 }`

### POST /device/stream/stopped

Notify that streaming has ended.

- **Request Body**: `{ "serial_number": "SMIX-001" }`

---

## User API

Endpoints for the User PWA. Auth via JWT.

### GET /user/churches/:id/stream

Get current stream URL and session info.

- **Response**:
  ```json
  {
    "church_id": 1,
    "church_name": "San Pietro",
    "streaming_active": true,
    "stream_url": "http://vdserv.com:8000/san-pietro.mp3",
    "started_at": "2024-05-20T10:00:00Z"
  }
  ```

### POST /user/churches/:id/subscribe

Follow a church.

### PUT /user/churches/:id/notifications

Toggle notifications for a followed church.

- **Request Body**: `{ "enabled": true }`

### POST /user/push/subscribe

Register browser Web Push subscription.

- **Request Body**:
  ```json
  {
    "endpoint": "https://fcm.googleapis.com/...",
    "p256dh": "...",
    "auth": "..."
  }
  ```

### DELETE /user/push/unsubscribe

Unregister browser Web Push subscription.

- **Request Body**:
  ```json
  {
    "endpoint": "https://fcm.googleapis.com/..."
  }
  ```

---

## Admin API

Endpoints for machine and church management. Auth via JWT (Admin role).

### GET /admin/churches

List all churches with hardware assignments.

### POST /admin/churches

Create church and auto-generate streaming credentials.

### GET /admin/machines

List all hardware units.

---

## Priest API

Endpoints for the Priest dashboard. Auth via JWT (Priest role).

### GET /priest/churches

List churches managed by the priest.
