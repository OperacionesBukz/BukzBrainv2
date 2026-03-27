"""
Formatea los resultados de scraping en la estructura de Creacion_productos.xlsx.

Genera un Excel con:
- Sheet "Products": 18 columnas en el orden exacto de la plantilla
- Sheet "opciones": listas de validación (Formato, Idioma, Vendor)
"""
from __future__ import annotations

import io
from typing import Optional

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

from services.scrap.base import MergedBook

# ── Columnas destino (orden exacto de la plantilla) ──────────────────────────

PRODUCTS_COLUMNS = [
    "Titulo",
    "Sipnosis",
    "Vendor",
    "SKU",
    "peso (kg)",
    "Precio",
    "Precio de comparacion",
    "Portada (URL)",
    "Numero de paginas",
    "Idioma",
    "Autor",
    "Editorial",
    "Formato",
    "Alto",
    "Ancho",
    "Ilustrador",
    "Categoria",
    "Subcategoria",
]

# ── Mapeo de idioma: código/variante → nombre español ────────────────────────

_IDIOMA_MAP: dict[str, str] = {
    "es": "Español", "spa": "Español", "español": "Español",
    "castellano": "Español", "spanish": "Español",
    "en": "Ingles", "eng": "Ingles", "inglés": "Ingles",
    "english": "Ingles", "ingles": "Ingles",
    "fr": "Frances", "fre": "Frances", "fra": "Frances",
    "francés": "Frances", "frances": "Frances", "french": "Frances",
    "it": "Italiano", "ita": "Italiano", "italiano": "Italiano",
    "italian": "Italiano",
    "pt": "Portugues", "por": "Portugues", "portugués": "Portugues",
    "portugues": "Portugues", "portuguese": "Portugues",
    "de": "Aleman", "ger": "Aleman", "deu": "Aleman",
    "alemán": "Aleman", "aleman": "Aleman", "german": "Aleman",
    "ru": "Ruso", "rus": "Ruso", "ruso": "Ruso", "russian": "Ruso",
    "ar": "Arabe", "ara": "Arabe", "árabe": "Arabe", "arabe": "Arabe",
    "arabic": "Arabe",
    "zh": "Chino", "chi": "Chino", "zho": "Chino", "chino": "Chino",
    "chinese": "Chino",
    "ja": "Japones", "jpn": "Japones", "japonés": "Japones",
    "japones": "Japones", "japanese": "Japones",
    "eu": "Vasco", "eus": "Vasco", "baq": "Vasco", "vasco": "Vasco",
    "basque": "Vasco",
    "gl": "Gallego", "glg": "Gallego", "gallego": "Gallego",
    "galician": "Gallego",
    "la": "Latin", "lat": "Latin", "latín": "Latin", "latin": "Latin",
    "ca": "Catalan", "cat": "Catalan", "catalán": "Catalan",
    "catalan": "Catalan",
    "ro": "Rumano", "ron": "Rumano", "rum": "Rumano", "rumano": "Rumano",
    "romanian": "Rumano",
    "nl": "Holandes", "nld": "Holandes", "dut": "Holandes",
    "holandés": "Holandes", "holandes": "Holandes", "dutch": "Holandes",
    "bg": "Bulgaro", "bul": "Bulgaro", "búlgaro": "Bulgaro",
    "bulgaro": "Bulgaro", "bulgarian": "Bulgaro",
    "el": "Griego", "gre": "Griego", "ell": "Griego", "griego": "Griego",
    "greek": "Griego",
    "pl": "Polaco", "pol": "Polaco", "polaco": "Polaco", "polish": "Polaco",
    "cs": "Checo", "ces": "Checo", "cze": "Checo", "checo": "Checo",
    "czech": "Checo",
    "sv": "Sueco", "swe": "Sueco", "sueco": "Sueco", "swedish": "Sueco",
}

# ── Mapeo de encuadernación → formato ────────────────────────────────────────

_FORMATO_MAP: dict[str, str] = {
    "hardcover": "Tapa Dura", "hard cover": "Tapa Dura",
    "tapa dura": "Tapa Dura", "cartoné": "Tapa Dura",
    "cartone": "Tapa Dura", "cartonado": "Tapa Dura",
    "hardback": "Tapa Dura",
    "paperback": "Tapa Blanda", "soft cover": "Tapa Blanda",
    "tapa blanda": "Tapa Blanda", "rústica": "Tapa Blanda",
    "rustica": "Tapa Blanda", "softcover": "Tapa Blanda",
    "book": "Tapa Blanda",
    "pocket": "Bolsillo", "bolsillo": "Bolsillo",
    "mass market paperback": "Bolsillo",
    "spiral": "Espiral", "espiral": "Espiral",
    "spiral-bound": "Espiral", "wire-o": "Espiral",
    "board book": "Tapa Dura", "board": "Tapa Dura",
    "cloth": "Tela", "tela": "Tela",
    "stapled": "Grapado", "grapado": "Grapado",
    "troquelado": "Troquelado",
    "anillas": "Anillas", "ring": "Anillas",
}

# ── Listas para la hoja "opciones" ───────────────────────────────────────────

FORMATOS = [
    "Tapa Dura", "Tapa Blanda", "Bolsillo", "Libro de lujo", "Espiral",
    "Tela", "Grapado", "Fasciculo Encuadernable", "Troquelado", "Anillas",
    "Otros",
]

IDIOMAS = [
    "Español", "Ingles", "Frances", "Italiano", "Portugues", "Aleman",
    "Bilingue (Español-Ingles)", "Bilingue (Español-Portugues)", "Vasco",
    "Gallego", "Latin", "Ruso", "Arabe", "Chino", "Japones", "Catalan",
    "Rumano", "Holandes", "Bulgaro", "Griego", "Polaco", "Checo", "Sueco",
]


def _map_idioma(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    return _IDIOMA_MAP.get(raw.strip().lower(), raw)


def _map_formato(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    return _FORMATO_MAP.get(raw.strip().lower(), raw)


def format_creacion(books: list[MergedBook]) -> bytes:
    """Genera un Excel en formato Creacion_productos a partir de los MergedBook."""
    wb = Workbook()

    # ── Sheet "Products" ─────────────────────────────────────────────────
    ws = wb.active
    ws.title = "Products"

    # Headers
    header_font = Font(bold=True)
    for col_idx, header in enumerate(PRODUCTS_COLUMNS, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font

    # Data rows
    for row_idx, book in enumerate(books, 2):
        ws.cell(row=row_idx, column=1, value=book.titulo)
        ws.cell(row=row_idx, column=2, value=book.descripcion)
        # col 3: Vendor — vacío (se llena manualmente)
        ws.cell(row=row_idx, column=4, value=book.isbn)            # SKU
        # col 5: peso (kg) — vacío
        # col 6: Precio — vacío
        # col 7: Precio de comparacion — vacío
        ws.cell(row=row_idx, column=8, value=book.portada_url)
        ws.cell(row=row_idx, column=9, value=book.paginas)
        ws.cell(row=row_idx, column=10, value=_map_idioma(book.idioma))
        ws.cell(row=row_idx, column=11, value=book.autor)
        ws.cell(row=row_idx, column=12, value=book.editorial)
        ws.cell(row=row_idx, column=13, value=_map_formato(book.encuadernacion))
        # col 14: Alto — vacío
        # col 15: Ancho — vacío
        # col 16: Ilustrador — vacío
        ws.cell(row=row_idx, column=17, value=book.categoria)
        # col 18: Subcategoria — vacío
        # Columnas de revisión (19-21)
        ws.cell(row=row_idx, column=19, value=book.fuente_primaria)
        ws.cell(row=row_idx, column=20, value=book.campos_encontrados)
        ws.cell(row=row_idx, column=21, value=book.alertas)

    last_row = len(books) + 1

    # Headers de revisión en rojo
    red_fill = PatternFill(start_color="FF0000", end_color="FF0000", fill_type="solid")
    white_bold = Font(bold=True, color="FFFFFF")
    for col_idx, header in enumerate(["Fuente primaria", "Campos encontrados", "Alertas"], 19):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill = red_fill
        cell.font = white_bold

    # ── Sheet "opciones" ─────────────────────────────────────────────────
    ws_opt = wb.create_sheet("opciones")
    ws_opt.cell(row=1, column=1, value="Formato")
    ws_opt.cell(row=1, column=3, value="Idioma")
    for i, fmt in enumerate(FORMATOS, 2):
        ws_opt.cell(row=i, column=1, value=fmt)
    for i, idioma in enumerate(IDIOMAS, 2):
        ws_opt.cell(row=i, column=3, value=idioma)

    # ── Data validations (dropdowns) en Products ─────────────────────────
    if last_row >= 2:
        fmt_formula = f'"{ ",".join(FORMATOS) }"'
        dv_formato = DataValidation(type="list", formula1=fmt_formula, allow_blank=True)
        dv_formato.error = "Seleccione un formato válido"
        dv_formato.errorTitle = "Formato inválido"
        ws.add_data_validation(dv_formato)
        dv_formato.add(f"M2:M{last_row}")

        idioma_formula = f'"{ ",".join(IDIOMAS) }"'
        dv_idioma = DataValidation(type="list", formula1=idioma_formula, allow_blank=True)
        dv_idioma.error = "Seleccione un idioma válido"
        dv_idioma.errorTitle = "Idioma inválido"
        ws.add_data_validation(dv_idioma)
        dv_idioma.add(f"J2:J{last_row}")

    # ── Generar bytes ────────────────────────────────────────────────────
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
