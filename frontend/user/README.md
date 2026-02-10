# VerbumDigital - User PWA

L'applicazione rivolta ai fedeli per l'ascolto delle funzioni religiose e la connessione con la propria comunità. Ottimizzata per l'uso mobile come app installabile.

## ⛪ Funzionalità Principali

- **Listen-Live**: Player audio integrato per l'ascolto in tempo reale con gestione sticky player.
- **Ricerca Chiese**: Esplorazione dell'elenco delle chiese disponibili nel sistema.
- **Iscrizioni**: Possibilità di seguire le proprie chiese preferite per averle in home page.
- **Notifiche**: Sistema di alert per essere informati quando una chiesa seguita inizia una trasmissione (in fase di sviluppo).
- **Personalizzazione**: Gestione del profilo utente e preferenze di ascolto.

## 🚀 Sviluppo

```bash
# Installa le dipendenze
npm install

# Avvia il server di sviluppo (Porta 3000)
npm run dev
```

## 🎧 Esperienza Audio

L'app implementa una UX fluida dove il flusso audio persiste durante la navigazione tra le diverse pagine, permettendo al fedele di continuare l'ascolto mentre consulta altre informazioni.

## 📂 Struttura Cartelle

- `src/pages`: Home, Ricerca, Chiesa Singola, Profilo.
- `src/components`: UI components e il Player centrale.
- `src/context`: Stato globale del player ed autenticazione utente.
