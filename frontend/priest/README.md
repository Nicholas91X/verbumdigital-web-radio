# VerbumDigital - Priest PWA

L'applicazione dedicata ai sacerdoti e conduttori per la gestione operativa dello streaming e dell'hardware locale **ST1**.

## 🎙️ Funzionalità Principali

- **Controllo ST1**: Avvio e arresto dello streaming audio fisico tramite collegamento locale al dispositivo ST1.
- **Sincronizzazione Backend**: Gestione automatica della sessione di streaming (Icecast) e aggiornamento dello stato "Live" per i fedeli.
- **Visualizzazione Sessioni**: Consultazione dello storico delle trasmissioni passate per le proprie chiese.
- **Statistiche Live**: Visualizzazione del tempo di trasmissione trascorso in tempo reale.

## 🚀 Sviluppo

```bash
# Installa le dipendenze
npm install

# Avvia il server di sviluppo (Porta 3001)
npm run dev
```

## 🔌 Integrazione ST1

Questa app comunica con due endpoint diversi:
1. **Backend Centrale**: Per l'autenticazione e il database.
2. **Dispositivo Locale (8080)**: Per inviare comandi di `play/stop/setup` direttamente all'hardware ST1 presente in chiesa.

## 📂 Struttura Cartelle

- `src/pages`: `DashboardPage` (controllo live) e `SessionsPage`.
- `src/components`: Componenti per il monitoraggio dello stato hardware.
- `src/context`: Autenticazione sacerdote e gestione sessione.
