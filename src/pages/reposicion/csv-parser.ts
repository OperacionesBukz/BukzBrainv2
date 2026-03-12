import type { SedeInfo } from "./types";

/**
 * Parser CSV que maneja campos con comillas y escaped quotes.
 * Soporta delimitadores ',' y ';'.
 */
function parseCSV(text: string, delimiter: string): string[][] {
  const lines: string[][] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === delimiter || ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === delimiter) {
        if (!lines.length) lines.push([current]);
        else lines[lines.length - 1].push(current);
        current = "";
      } else if (ch === "\n") {
        if (lines.length) lines[lines.length - 1].push(current);
        else lines.push([current]);
        current = "";
        lines.push([]);
      }
    } else {
      current += ch;
    }
  }

  if (current || (lines.length && lines[lines.length - 1])) {
    if (!lines.length) lines.push([]);
    lines[lines.length - 1].push(current);
  }

  return lines.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim()));
}

export interface ParsedSales {
  header: string[];
  data: string[][];
  months: Set<string>;
  skuIdx: number;
  titleIdx: number;
  vendorIdx: number;
  qtyIdx: number;
  monthIdx: number;
}

export function parseSalesCsv(text: string): ParsedSales {
  const rows = parseCSV(text, ",");
  const header = rows[0] || [];
  const data = rows.slice(1);

  const skuIdx = header.findIndex((h) => h.toLowerCase().includes("sku"));
  const titleIdx = header.findIndex((h) => h.toLowerCase().includes("title"));
  const vendorIdx = header.findIndex((h) => h.toLowerCase().includes("vendor"));
  const qtyIdx = header.findIndex((h) => h.toLowerCase().includes("net items"));
  const monthIdx = header.findIndex((h) => h.toLowerCase().includes("month"));

  if (skuIdx === -1 || qtyIdx === -1) {
    throw new Error("No se encontraron columnas SKU o Net items sold en el archivo de ventas.");
  }

  const months = new Set<string>();
  data.forEach((row) => {
    const month = row[monthIdx] || "";
    if (month) months.add(month);
  });

  return { header, data, months, skuIdx, titleIdx, vendorIdx, qtyIdx, monthIdx };
}

export interface ParsedInventory {
  header: string[];
  data: string[][];
  sedes: SedeInfo[];
  skuIdx: number;
  titleIdx: number;
  vendorIdx: number;
}

export function parseInventoryCsv(text: string): ParsedInventory {
  const delimiter = text.includes(";") ? ";" : ",";
  const rows = parseCSV(text, delimiter);
  const header = rows[0] || [];
  const data = rows.slice(1);

  const skuIdx = header.findIndex((h) => h.toLowerCase().includes("sku"));
  const titleIdx = header.findIndex((h) => h.toLowerCase().includes("title"));
  const vendorIdx = header.findIndex((h) => h.toLowerCase().includes("vendor"));

  const sedes: SedeInfo[] = header
    .map((h, i) => ({ name: h, index: i }))
    .filter((h) => h.name.startsWith("Inventory Available:"))
    .map((h) => ({ label: h.name.replace("Inventory Available: ", "").trim(), index: h.index }));

  return { header, data, sedes, skuIdx, titleIdx, vendorIdx };
}

/**
 * Detecta sedes disponibles del header del CSV de inventario sin parsear todo el archivo.
 */
export function detectSedes(text: string): SedeInfo[] {
  const delimiter = text.includes(";") ? ";" : ",";
  const firstLine = text.split("\n")[0] || "";
  const rows = parseCSV(firstLine + "\n", delimiter);
  const header = rows[0] || [];

  return header
    .map((h, i) => ({ name: h, index: i }))
    .filter((h) => h.name.startsWith("Inventory Available:"))
    .map((h) => ({ label: h.name.replace("Inventory Available: ", "").trim(), index: h.index }));
}
