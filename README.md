# Etichette QR

Sistema di etichette adesive con QR code per cellule/impianti: i dati
autorizzativi vivono su un **Google Sheet** condiviso e le etichette stampate
contengono solo un identificatore stabile (`QRID`). Scansionando il QR, la
scheda web legge i dati aggiornati in tempo reale — **aggiornare il Sheet
aggiorna automaticamente la scheda mostrata agli utenti**, senza ristampare
le etichette.

## Architettura

```
Google Sheet (fonte unica dei dati) ◀── collega non tecnico aggiorna qui
   │  Apps Script assegna QRID
   │  automatici alle nuove righe
   ▼
   │ CSV pubblicato
   ├──▶ generatore.py  ──▶  PDF con QR che puntano a ?id=<QRID>
   │                         (stampa una tantum o per nuove righe)
   │
   └──▶ index.html (GitHub Pages)
         ── fetch CSV al momento della scansione
         ── cerca la riga con QRID corrispondente
         ── mostra Ditta / Ente / Comune / Indirizzo / Cellula /
            N° autorizzazione / Data rilascio / Scadenza
```

**Il QR code non cambia mai**: trasporta solo il `QRID`. I dati autorizzativi
che scadono/cambiano (ProtocolloEnte, DataScadenza) vengono letti dal Sheet a
ogni scansione.

Ogni riga del Sheet = un QR code univoco. La stessa `CellulaID` può comparire
in più righe (più posizioni fisiche), ma ciascuna riga ha il proprio `QRID`.

## Google Sheet

Il Sheet è pubblicato come CSV ed esposto alla scheda web via:

```
https://docs.google.com/spreadsheets/d/e/<PUB_ID>/pub?output=csv
```

Per cambiare sorgente: modifica `CSV_URL` in [`index.html`](./index.html) e
[`generatore.py`](./generatore.py).

### Colonne richieste

Il Sheet deve avere queste colonne, con la **colonna A riservata al QRID**:

| Colonna          | Esempio                    | Note                           |
|------------------|----------------------------|--------------------------------|
| `QRID`           | 42                         | Colonna A, gestita dall'Apps Script — **non modificare a mano** |
| `Ditta`          | Hi-Com srl - Foro …        |                                |
| `Ente`           | Comune / Provincia / ANAS  | Tipo di ente autorizzante      |
| `Comune`         | Torino                     | Comune di localizzazione       |
| `CellulaID`      | 365                        | Non univoco: puo ripetersi su piu righe |
| `Posizione`      | A                          |                                |
| `Descrizione`    | CORSO PESCHIERA LATO CIV.… | Indirizzo fisico               |
| `ProtocolloEnte` | 24R00343                   | N° autorizzazione              |
| `DataRilascio`   | 7/3/2024                   |                                |
| `DataScadenza`   | 7/3/2027                   |                                |

Colonne extra tollerate ma ignorate: `dbo_StatiAmm.Descrizione`,
`dbo_GruppiImpianti.Descrizione` (retaggi di export database, innocui).

### Apps Script per la gestione automatica dei QRID

Il file [`apps_script.gs`](./apps_script.gs) contiene lo script Google da
installare **una volta sola** nel Sheet (istruzioni nel commento in testa al
file). Una volta installato:

- Ogni nuova riga compilata dal collega riceve automaticamente un `QRID`
  numerico progressivo nella colonna A.
- I QRID esistenti non vengono mai toccati — garanzia che i QR stampati
  restino sempre validi.
- Menu "QR → Inizializza QRID" per popolare le righe gia esistenti al
  momento dell'installazione.

### Aggiornamento dati (workflow operativo)

1. Il collega apre il Google Sheet.
2. Modifica le celle necessarie (es. rinnovo scadenza, nuovo protocollo) o
   aggiunge una nuova riga (il QRID compare da solo).
3. Salva — fine. Le modifiche sono visibili alla prossima scansione (cache
   CDN di Google ≈ 5 min; il front-end aggira la cache browser con un
   cache-bust sul query-string).

**Regola d'oro:** non modificare mai un `QRID` gia assegnato. Un QRID
modificato rende invalido il QR code stampato su quella etichetta.

## Stampa etichette

Serve solo al primo setup o quando si aggiungono nuove righe al Sheet.

```bash
pip install pandas qrcode fpdf2
python generatore.py
```

Lo script chiede un filtro sul Comune (invio per stampare tutte). Output:
`etichette_<comune>.pdf` nella cartella corrente. La cartella `temp_qr/`
contiene i PNG intermedi (ignorata da git).

Le righe senza `QRID` (non ancora processate dall'Apps Script) vengono
saltate con un avviso a video.

## Scheda web pubblica

Servita da GitHub Pages all'indirizzo
`https://hicomsrl.github.io/Etichette/?id=<QRID>`.

Stati possibili:
- **Caricamento** → fetch CSV in corso
- **Scheda popolata** → QRID trovato
- **Errore** → id mancante, etichetta non trovata, o Sheet non raggiungibile
