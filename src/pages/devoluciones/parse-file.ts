import { read, utils } from "xlsx";
import type { DevolucionItem } from "./types";

/** Limpia caracteres invisibles (BOM, zero-width spaces) de un string */
function cleanInvisible(s: string): string {
  return s.replace(/[\uFEFF\u200B\u200C\u200D\u00A0]/g, "").trim();
}

/** Normaliza nombre de columna para detectar ISBN, titulo, cantidad */
function normalizeHeader(raw: string): string {
  const lower = cleanInvisible(raw).toLowerCase();
  if (
    /isbn|ean|sku|barcode|código.*barr|codigo.*barr|cod\.?\s*barr|referencia|ref\.?$|artículo|articulo/.test(
      lower,
    )
  )
    return "isbn";
  if (/tít|tit|titulo|título|nombre|book|name/.test(lower)) return "titulo";
  if (/cant|qty|quantity|unidades|units/.test(lower)) return "cantidad";
  return lower;
}

/** Convierte un valor raw de Excel a string ISBN, manejando números y notación científica */
function toIsbnString(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "number") {
    // Evitar notación científica y preservar dígitos
    const str = raw.toFixed(0);
    // Pad con 0 al inicio si tiene 12 dígitos (EAN-13 sin leading zero)
    if (str.length === 12) return "0" + str;
    return str;
  }
  const str = String(raw).trim();
  // Si viene como notación científica en string, convertir
  if (/^\d[\d.]*[eE]\+?\d+$/.test(str)) {
    try {
      const num = Number(str);
      if (Number.isFinite(num)) return num.toFixed(0);
    } catch {
      /* usar string original */
    }
  }
  return str;
}

/** Detecta si un valor parece un ISBN/EAN (10 o 13 dígitos, con o sin guiones) */
function looksLikeIsbn(val: unknown): boolean {
  const str = toIsbnString(val).replace(/[-\s]/g, "");
  return /^\d{10}$|^\d{13}$/.test(str);
}

export async function parseDevolucionFile(
  file: File,
): Promise<DevolucionItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const rawRows: Record<string, unknown>[] = utils.sheet_to_json(sheet, {
    defval: "",
  });
  if (rawRows.length === 0) return [];

  // Detectar headers y normalizar
  const originalHeaders = Object.keys(rawRows[0]);
  const headerMap: Record<string, string> = {};
  for (const h of originalHeaders) {
    headerMap[h] = normalizeHeader(h);
  }

  // Fallback: si ningún header mapeó a "isbn", buscar por patrón en valores
  const hasIsbnCol = Object.values(headerMap).includes("isbn");
  if (!hasIsbnCol) {
    const unmappedCols = originalHeaders.filter(
      (h) => !["isbn", "titulo", "cantidad"].includes(headerMap[h]),
    );
    const sampleSize = Math.min(5, rawRows.length);

    for (const col of unmappedCols) {
      let isbnLikeCount = 0;
      for (let i = 0; i < sampleSize; i++) {
        if (looksLikeIsbn(rawRows[i][col])) isbnLikeCount++;
      }
      // Si más de la mitad de los samples parecen ISBN, promover esta columna
      if (isbnLikeCount > sampleSize / 2) {
        headerMap[col] = "isbn";
        break;
      }
    }
  }

  return rawRows.map((row, idx) => {
    const item: DevolucionItem = { fila: idx + 2, cantidad: 1 };
    const extras: Record<string, string> = {};

    for (const [original, normalized] of Object.entries(headerMap)) {
      const rawVal = row[original];

      if (normalized === "isbn") {
        const isbn = toIsbnString(rawVal);
        if (isbn) item.isbn = isbn;
        continue;
      }

      const val = String(rawVal ?? "").trim();
      if (!val) continue;

      if (normalized === "titulo") {
        item.titulo = val;
      } else if (normalized === "cantidad") {
        const n = Number(val);
        if (!isNaN(n) && n > 0) item.cantidad = n;
      } else {
        extras[original] = val;
      }
    }

    if (Object.keys(extras).length > 0) item.extras = extras;
    return item;
  });
}
