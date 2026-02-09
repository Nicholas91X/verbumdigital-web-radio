# Architettura Verbum Digital Web Radio

## Overview

Il sistema è composto da:
- **Backend API** in Go
- **3 PWA Frontend** (Admin, Priest, User)

## Backend

### Stack Tecnologico
- Go 1.21+
- GORM (ORM)
- JWT per autenticazione
- PostgreSQL come database

### Struttura
```
backend/
├── cmd/server/          # Entry point
├── internal/
│   ├── handlers/        # HTTP handlers
│   ├── middleware/      # Middleware (auth, cors, logging)
│   ├── models/          # Database models
│   ├── services/        # Business logic
│   └── config/          # Configuration
└── migrations/          # Database migrations
```

## Frontend

### Stack Tecnologico
- TypeScript
- Vite (build tool)
- PWA capabilities

### Struttura
```
frontend/
├── shared/              # Codice condiviso
│   ├── api/             # API client
│   ├── components/      # UI components
│   └── utils/           # Utilities
├── admin/               # PWA Admin
├── priest/              # PWA Priest
└── user/                # PWA User
```

## Database Schema

TODO: Definire schema database

## API Endpoints

TODO: Documentare endpoints

## Deployment

TODO: Istruzioni deployment
