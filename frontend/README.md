# VerbumDigital Frontend Ecosystem

Questo repository contiene l'intero ecosistema frontend del sistema **VerbumDigital**, composto da tre Progressive Web Apps (PWA) indipendenti e una directory di logica condivisa.

## 📱 Applicazioni

L'architettura è suddivisa per ruoli, garantendo sicurezza e ottimizzando l'esperienza utente su ogni dispositivo.

| App | Descrizione | Porta Sviluppo | Standard Design |
| :-- | :-- | :-- | :-- |
| **[Admin](./admin)** | Pannello di controllo globale per amministratori di sistema. | `3002` | Desktop-First |
| **[Priest](./priest)** | Dashboard per sacerdoti per gestire lo streaming ST1 e sessioni. | `3001` | Mobile-Optimized |
| **[User](./user)** | Portale per i fedeli: ricerca chiese, ascolto live e notifiche. | `3000` | Mobile-First |

## 🛠️ Architettura Tecnica

Tutte le app condividono lo stesso stack tecnologico moderno per garantire prestazioni e manutenibilità:

- **Core**: [React 18](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Linguaggio**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) con Design System **"Deep Luxury"**
- **Stato**: React Context API
- **Networking**: Fetch API (Client custom in `@shared/api`)
- **PWA**: `vite-plugin-pwa` per supporto offline, caching e installazione su Homescreen.

## 🔗 Logica Condivisa (@shared)

La directory `frontend/shared` contiene codice critico utilizzato da tutte e tre le applicazioni:
- **API Client**: Gestione centralizzata di endpoint, token JWT e chiamate all'hardware ST1.
- **Types**: Definizioni TypeScript condivise con il backend Go.
- **Utils**: Helper grafici e di formattazione.

## 🚀 Guida Rapida allo Sviluppo

### Prerequisiti
1. Node.js (v18+) e npm.
2. Backend Go attivo sulla porta `8081`.

### Avvio in locale
Per avviare un'applicazione specifica (es. User):

```bash
cd frontend/user
npm install
npm run dev
```

## 🏗️ Build per Produzione

Tutte le app vengono compilate in file statici ottimizzati nella rispettiva cartella `dist/`:

```bash
# Esempio per Admin
cd frontend/admin
npm run build
```

---
*VerbumDigital - Portando la voce del Signore ovunque.*
