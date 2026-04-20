import pandas as pd
import qrcode
from fpdf import FPDF
import os
import re
import unicodedata

CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vR29_TOKQ4hOFSq8_cJEfi3spPQyoJGeetOVlTy40dv-uncETN_DfKFY38BMsnBvhcVNx6NVv4vrOZg"
    "/pub?output=csv"
)
PAGE_URL = "https://hicomsrl.github.io/Etichette/"


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^A-Za-z0-9]+', '_', s).strip('_') or 'tutti'


try:
    df = pd.read_csv(CSV_URL)
except Exception as e:
    print(f"Errore: impossibile scaricare il Google Sheet. ({e})")
    exit()

colonne_richieste = ['QRID', 'Ditta', 'Ente', 'Comune', 'CellulaID',
                     'Posizione', 'Descrizione', 'ProtocolloEnte',
                     'DataRilascio', 'DataScadenza']
mancanti = [c for c in colonne_richieste if c not in df.columns]
if mancanti:
    print(f"Errore: colonne mancanti nel Sheet: {', '.join(mancanti)}")
    exit()

for col in df.columns:
    if df[col].dtype == 'object':
        df[col] = df[col].astype(str).str.strip()

# Scarta righe senza QRID (non ancora processate dall'Apps Script del Sheet)
senza_qrid = df['QRID'].isna() | (df['QRID'].astype(str).str.strip() == '')
if senza_qrid.any():
    print(f"Attenzione: {senza_qrid.sum()} righe senza QRID verranno saltate.")
    df = df[~senza_qrid].reset_index(drop=True)

filtro = input("Filtro Comune (invio per stampare tutte le cellule): ").strip()
if filtro:
    df = df[df['Comune'].str.lower() == filtro.lower()].reset_index(drop=True)
    if df.empty:
        print(f"Nessuna cellula trovata per il comune '{filtro}'.")
        exit()

print(f"Righe da stampare: {len(df)}")

pdf = FPDF(orientation='P', unit='mm', format='A4')
pdf.set_auto_page_break(auto=True, margin=10)
pdf.add_page()

if not os.path.exists('temp_qr'):
    os.makedirs('temp_qr')

x_attuale, y_attuale = 5, 10
contatore_colonna = 0

for index, row in df.iterrows():
    ditta = str(row['Ditta'])
    cellula_info = f"{row['CellulaID']} - {row['Posizione']}"
    descrizione = str(row['Descrizione'])

    # Il QR contiene SOLO il QRID stabile (univoco per riga, assegnato e
    # mai modificato dall'Apps Script del Sheet). Gli altri dati li recupera
    # la scheda web via fetch al momento della scansione.
    qrid = str(row['QRID']).strip()
    if qrid.endswith('.0'):  # pandas interpreta numeri interi come float
        qrid = qrid[:-2]
    link = f"{PAGE_URL}?id={qrid}"

    img = qrcode.make(link)
    qr_path = f"temp_qr/qr_{index}.png"
    img.save(qr_path)

    pdf.rect(x_attuale, y_attuale, 40, 100)

    if os.path.exists('logo.jpg'):
        pdf.image('logo.jpg', x=x_attuale + 7, y=y_attuale + 3, w=26)

    pdf.set_font("Helvetica", 'B', 8)
    pdf.set_xy(x_attuale + 2, y_attuale + 18)
    pdf.multi_cell(36, 4, text=ditta, align='R')
    y_dopo_ditta = pdf.get_y() + 2

    pdf.set_font("Helvetica", 'B', 10)
    pdf.set_xy(x_attuale + 2, y_dopo_ditta)
    pdf.multi_cell(36, 5, text=f"Ente: {row['Ente']}", align='L')
    y_dopo_ente = pdf.get_y() + 1

    pdf.set_font("Helvetica", 'B', 10)
    pdf.set_xy(x_attuale + 2, y_dopo_ente)
    pdf.multi_cell(36, 5, text=f"Comune: {row['Comune']}", align='L')
    y_dopo_comune = pdf.get_y() + 1

    pdf.set_font("Helvetica", 'B', 10)
    pdf.set_xy(x_attuale + 2, y_dopo_comune)
    pdf.cell(36, 5, text=f"Cellula: {cellula_info}", align='L')

    pdf.set_font("Helvetica", '', 8)
    pdf.set_xy(x_attuale + 2, pdf.get_y() + 6)
    pdf.multi_cell(36, 3.5, text=descrizione, align='L')

    pdf.set_font("Helvetica", 'I', 6)
    pdf.set_xy(x_attuale, y_attuale + 60)
    pdf.multi_cell(40, 2.5, text="Scansionare il QR-Code per i dati autorizzativi", align='C')

    pdf.image(qr_path, x=x_attuale + 5, y=y_attuale + 68, w=30)

    contatore_colonna += 1
    if contatore_colonna < 5:
        x_attuale += 40
    else:
        contatore_colonna = 0
        x_attuale = 5
        y_attuale += 100
        if y_attuale + 100 > 280:
            pdf.add_page()
            y_attuale = 10

nome_base = slug(filtro) if filtro else 'tutti'
nome_output = f"etichette_{nome_base}.pdf"
pdf.output(nome_output)
print(f"PDF GENERATO: {nome_output}")
