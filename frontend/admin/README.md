# VerbumDigital - Admin PWA

Questo modulo costituisce il pannello di controllo centrale per gli amministratori del sistema **VerbumDigital**. È progettato principalmente per l'uso da desktop.

## 🏛️ Funzionalità Principali

- **Dashboard Globale**: Monitoraggio in tempo reale dello stato del sistema, numero di chiese live e sessioni attive.
- **Gestione Chiese**: Censimento delle parrocchie, assegnazione di loghi, indirizzi e gestione delle credenziali di streaming (Icecast).
- **Controllo Hardware ST1**: Generazione e gestione dei codici di attivazione per i dispositivi locali.
- **Gestione Sacerdoti**: Creazione account, reset password e associazione sacerdoti-chiese.
- **Monitoraggio Sessioni**: Storico globale di tutti gli streaming effettuati nel sistema.

## 🚀 Sviluppo

```bash
# Installa le dipendenze
npm install

# Avvia il server di sviluppo (Porta 3002)
npm run dev
```

## 🎨 Design System

L'app utilizza il preset **"Deep Luxury"** di Tailwind CSS, caratterizzato da:
- Temi scuri profondi (`surface-950`).
- Accenti colorati per stato (Emerald per attivo, Amber per attesa, Red per live).
- Componenti in stile Glassmorphism.

## 📂 Struttura Cartelle

- `src/pages`: Implementazione delle viste amministrative.
- `src/components`: Componenti UI riutilizzabili (Layout sidebar, tabelle).
- `src/context`: Gestione autenticazione Admin.

## 🔗 Integrazioni

Comunica direttamente con il backend tramite `@shared/api` utilizzando il prefisso `/admin/*`.
