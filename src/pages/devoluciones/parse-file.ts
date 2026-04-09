import { read, utils } from "xlsx";
import type { DevolucionItem } from "./types";

/** Normaliza nombre de columna para detectar ISBN, titulo, cantidad */
function normalizeHeader(h: string): string {
  const lower = h.toLowerCase().trim();
  if (/isbn|ean|código|codigo|sku|barcode/.test(lower)) return "isbn";
  if (/tít|tit|titulo|título|nombre|book|name/.test(lower)) return "titulo";
  if (/cant|qty|quantity|unidades|units/.test(lower)) return "cantidad";
  return lower;
}

export async function parseDevolucionFile(file: File): Promise<DevolucionItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const rawRows: Record<string, unknown>[] = utils.sheet_to_json(sheet, { defval: "" });
  if (rawRows.length === 0) return [];

  // Detectar headers y normalizar
  const originalHeaders = Object.keys(rawRows[0]);
  const headerMap: Record<string, string> = {};
  for (const h of originalHeaders) {
    headerMap[h] = normalizeHeader(h);
  }

  return rawRows.map((row, idx) => {
    const item: DevolucionItem = { fila: idx + 2, cantidad: 1 }; // fila 2 = primera data row
    const extras: Record<string, string> = {};

    for (const [original, normalized] of Object.entries(headerMap)) {
      const val = String(row[original] ?? "").trim();
      if (!val) continue;

      if (normalized === "isbn") {
        item.isbn = val;
      } else if (normalized === "titulo") {
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
