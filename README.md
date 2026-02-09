# Verbum Digital Web Radio

## Struttura del Progetto

```
verbumdigital-web-radio/
├── backend/                    # Go API
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── handlers/           # HTTP handlers per ruolo
│   │   ├── middleware/         # Auth JWT, CORS, logging
│   │   ├── models/             # Structs DB (GORM)
│   │   ├── services/           # Business logic
│   │   └── config/             # Config & env
│   ├── migrations/             # SQL migration files
│   ├── go.mod
│   └── go.sum
│
├── frontend/
│   ├── shared/                 # Codice condiviso tra le 3 PWA
│   │   ├── api/                # API client (fetch wrapper, tipi)
│   │   ├── components/         # Componenti UI comuni
│   │   └── utils/
│   ├── admin/                  # PWA Admin
│   ├── priest/                 # PWA Priest
│   └── user/                   # PWA User (fedeli)
│
├── docs/                       # Documentazione architettura
├── scripts/                    # Deploy, build scripts
├── .env.example
└── README.md
```

## Tecnologie

### Backend
- **Go** - API REST
- **GORM** - ORM per database
- **JWT** - Autenticazione

### Frontend
- **PWA** - Progressive Web Apps
- 3 applicazioni separate per Admin, Priest e User

## Setup

TODO: Istruzioni di setup

## License

TODO: Licenza
