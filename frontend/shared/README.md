# VerbumDigital - Shared Library

Questa directory contiene la logica di business, i tipi e le utility condivise tra le tre applicazioni frontend del sistema VerbumDigital.

## 📦 Contenuti

### 1. `api/`
- **`client.ts`**: Axios-like wrapper (usando Fetch) che gestisce:
    - Autenticazione automatica tramite JWT (Bearer token).
    - Base URL configurabile tramite ambiente.
    - Metodi helper per chiamate al Backend e alle API locali dell'hardware ST1.
- **`types.ts`**: La "Single Source of Truth" per i tipi TypeScript. Qui sono definiti i modelli per:
    - `User`, `Priest`, `Admin`
    - `Church`, `Machine`, `Session`
    - Risposte API e DTO per i form.

### 2. `utils/`
- Funzioni di utility per la formattazione di date, durate e validazione dati.

### 3. `components/` (Opzionale)
- Componenti UI estremamente generici (es. Spinner, Badge) che non dipendono dai temi specifici delle singole app.

## ⚙️ Come usarlo

Le applicazioni accedono a questo modulo tramite l'alias `@shared` configurato nei rispettivi `vite.config.ts` e `tsconfig.json`.

```typescript
import { api } from '@shared/api/client';
import type { Church } from '@shared/api/types';
```

## ⚠️ Manutenzione

Qualsiasi modifica a `shared/api/types.ts` deve essere coordinata con il backend in Go (modulo `backend/internal/models`) per garantire la consistenza dei dati.
