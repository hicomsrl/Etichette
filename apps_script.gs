/**
 * Google Apps Script per il Sheet delle autorizzazioni Etichette QR.
 *
 * Funzione:
 *   Assegna automaticamente un QRID numerico progressivo e univoco nella
 *   colonna A a ogni nuova riga compilata. I QRID assegnati NON cambiano
 *   mai piu: garantiscono che i QR code stampati restino validi anche se
 *   altri campi (Posizione, Descrizione, ecc.) vengono modificati.
 *
 * ---------------------------------------------------------------------
 * INSTALLAZIONE (una tantum, ~5 minuti):
 *
 *   1. Apri il Google Sheet in modalita modifica
 *   2. Menu: Estensioni -> Apps Script
 *   3. Cancella il codice di default presente (una funzione vuota
 *      "myFunction")
 *   4. Copia e incolla TUTTO questo file nell'editor
 *   5. Clicca l'icona "disco" per salvare (o Ctrl+S). Dai un nome al
 *      progetto, es. "Etichette QR - QRID"
 *   6. Chiudi la scheda dell'editor Apps Script
 *   7. Ricarica (F5) la pagina del Google Sheet
 *   8. Appare un nuovo menu "QR" nella barra del Sheet
 *   9. Clicca QR -> "Inizializza QRID (backfill)"
 *  10. Google chiede di autorizzare. Clicca "Continua", scegli il tuo
 *      account, poi "Avanzate -> Apri (non verificato)", poi "Consenti".
 *      (E' normale: Google chiede conferma per script non certificati)
 *  11. Terminata l'autorizzazione, lo script popola la colonna A con
 *      QRID da 1 a N per le righe esistenti
 *
 * ---------------------------------------------------------------------
 * USO QUOTIDIANO:
 *
 *   Il collega aggiunge righe normalmente. Appena compila una qualunque
 *   cella di una nuova riga, il QRID viene scritto automaticamente nella
 *   colonna A. Non e necessario fare niente di speciale.
 *
 *   REGOLA D'ORO: non modificare mai manualmente un QRID gia assegnato.
 *   Un QRID modificato rende invalido il QR code gia stampato su quella
 *   etichetta.
 *
 * ---------------------------------------------------------------------
 * STRUTTURA ATTESA DEL SHEET:
 *
 *   Riga 1: intestazioni. Colonna A = "QRID", seguita dalle altre colonne
 *           dati (Ditta, CellulaID, Posizione, Descrizione, Comune,
 *           ProtocolloEnte, DataScadenza).
 *   Riga 2+: dati. Il QRID viene compilato dallo script.
 */

const QRID_COL = 1;     // Colonna A
const HEADER_ROW = 1;   // Riga 1

/** Aggiunge il menu "QR" quando il Sheet viene aperto. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('QR')
    .addItem('Inizializza QRID (backfill)', 'initializeQRIDs')
    .addToUi();
}

/**
 * Trigger automatico su ogni modifica del Sheet. Se una riga e stata
 * compilata ma non ha ancora un QRID, gliene assegna uno nuovo progressivo.
 */
function onEdit(e) {
  if (!e) return;
  const sheet = e.source.getActiveSheet();
  const startRow = e.range.getRow();
  const numRows = e.range.getNumRows();
  const lastCol = sheet.getLastColumn();

  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    if (row <= HEADER_ROW) continue;

    const qridCell = sheet.getRange(row, QRID_COL);
    const current = qridCell.getValue();
    if (current !== '' && current !== null) continue;

    // Assegna QRID solo se la riga ha almeno un'altra cella compilata
    // (evita di marcare righe completamente vuote)
    const rowValues = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
    const hasContent = rowValues.some(function (v, idx) {
      return idx !== QRID_COL - 1 && v !== '' && v !== null;
    });
    if (!hasContent) continue;

    qridCell.setValue(nextQRID_(sheet));
  }
}

/** Calcola il prossimo QRID disponibile (max esistente + 1). */
function nextQRID_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROW) return 1;
  const values = sheet
    .getRange(HEADER_ROW + 1, QRID_COL, lastRow - HEADER_ROW, 1)
    .getValues();
  let max = 0;
  for (const [v] of values) {
    if (typeof v === 'number' && v > max) max = v;
  }
  return max + 1;
}

/**
 * Esegue il backfill dei QRID sulle righe gia esistenti. Da eseguire
 * una volta sola dal menu "QR -> Inizializza QRID (backfill)".
 * Righe che hanno gia un QRID non vengono toccate.
 */
function initializeQRIDs() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= HEADER_ROW) {
    ui.alert('Nessuna riga dati da inizializzare.');
    return;
  }

  const numRows = lastRow - HEADER_ROW;
  const all = sheet.getRange(HEADER_ROW + 1, 1, numRows, lastCol).getValues();

  let nextId = 1;
  for (const row of all) {
    const v = row[QRID_COL - 1];
    if (typeof v === 'number' && v >= nextId) nextId = v + 1;
  }

  let assegnati = 0;
  const updated = all.map(function (row) {
    const v = row[QRID_COL - 1];
    const hasContent = row.some(function (c, idx) {
      return idx !== QRID_COL - 1 && c !== '' && c !== null;
    });
    if ((v === '' || v === null) && hasContent) {
      assegnati++;
      return [nextId++];
    }
    return [v];
  });

  sheet
    .getRange(HEADER_ROW + 1, QRID_COL, numRows, 1)
    .setValues(updated);

  ui.alert(
    'Inizializzazione completata.\n\n' +
    assegnati + ' nuovi QRID assegnati.\n' +
    (numRows - assegnati) + ' righe gia avevano un QRID (non modificate).'
  );
}
