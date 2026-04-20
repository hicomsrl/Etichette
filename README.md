# Etichette QR

Sistema di etichette adesive con QR code per cellule/impianti: i dati
autorizzativi vivono su un **Google Sheet** condiviso e le etichette stampate
contengono solo un identificatore stabile. Scansionando il QR, la scheda web
legge i dati aggiornati in tempo reale — **aggiornare il Sheet aggiorna
automaticamente la scheda mostrata agli utenti**, senza ristampare le etichette.

## Architettura

```
Google Sheet (fonte unica dei dati) ◀── collega non tecnico aggiorna qui
        ▲
        │ CSV pubblicato
        ├──▶ generatore.py  ──▶  PDF con QR che puntano a ?id=<CellulaID>
        │                         (stampa una tantum o per nuove cellule)
        │
        └──▶ index.html (GitHub Pages)
              ── fetch CSV al momento della scansione
              ── cerca la riga con CellulaID corrispondente
              ── mostra Ditta / Comune / Cellula / Protocollo / Scadenza
```

**Il QR code non cambia mai**: trasporta solo un ID. I dati autorizzativi che
scadono/cambiano (ProtocolloEnte, DataScadenza) vengono letti dal Sheet a ogni
scansione.

## Google Sheet

Il Sheet è pubblicato come CSV ed esposto alla scheda web via:

```
https://docs.google.com/spreadsheets/d/e/<PUB_ID>/pub?output=csv
```

Per cambiare sorgente: modifica `CSV_URL` in [`index.html`](./index.html) e
[`generatore.py`](./generatore.py).

### Colonne richieste

| Colonna          | Esempio                    |
|------------------|----------------------------|
| `Ditta`          | Rossi S.r.l.               |
| `CellulaID`      | C-001 (univoco globalmente)|
| `Posizione`      | Settore A, ripiano 2       |
| `Descrizione`    | Cellula frigorifera 2–8 °C |
| `Comune`         | Torino                     |
| `ProtocolloEnte` | 12345/2025                 |
| `DataScadenza`   | 31/12/2026                 |

### Aggiornamento dati (workflow operativo)

1. Il collega apre il Google Sheet.
2. Modifica le celle necessarie (es. rinnovo scadenza, nuovo protocollo).
3. Salva — fine. Le modifiche sono visibili alla prossima scansione (cache CDN
   di Google ≈ 5 min; il front-end aggira la cache browser con un cache-bust
   sul query-string).

## Stampa etichette

Serve solo al primo setup o quando si aggiunge una nuova cellula al Sheet.

```bash
pip install pandas qrcode fpdf2
python generatore.py
```

Lo script chiede un filtro sul Comune (invio per stampare tutte). Output:
`etichette_<comune>.pdf` nella cartella corrente. La cartella `temp_qr/`
contiene i PNG intermedi (ignorata da git).

## Scheda web pubblica

Servita da GitHub Pages all'indirizzo
`https://hicomsrl.github.io/Etichette/?id=<CellulaID>`.

Stati possibili:
- **Caricamento** → fetch CSV in corso
- **Scheda popolata** → record trovato
- **Errore** → id mancante, cellula non trovata, o Sheet non raggiungibile
