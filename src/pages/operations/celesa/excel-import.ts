import { read, utils } from "xlsx";

export interface ParsedCelesaRow {
  numeroPedido: string;
  cliente: string;
  producto: string;
  isbn: string;
  fechaPedido: string;
}

export interface ParseError {
  row: number;
  message: string;
}

export interface ParseResult {
  valid: ParsedCelesaRow[];
  errors: ParseError[];
}

const COLUMN_MAP: Record<string, keyof ParsedCelesaRow> = {
  pedido: "numeroPedido",
  cliente: "cliente",
  producto: "producto",
  isbn: "isbn",
  fecha: "fechaPedido",
};

function normalizeHeader(header: string): string {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function excelDateToString(value: unknown): string {
  if (typeof value === "number") {
    // Excel serial date number
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }

  const str = String(value ?? "").trim();
  if (!str) return "";

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Try YYYY-MM-DD (already correct)
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return str;

  return str;
}

function isValidDate(dateStr: string): boolean {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(dateStr + "T00:00:00");
  return !isNaN(date.getTime());
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = read(new Uint8Array(buffer));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (raw.length === 0) {
    return { valid: [], errors: [{ row: 0, message: "El archivo está vacío" }] };
  }

  // Map headers
  const rawHeaders = Object.keys(raw[0]);
  const headerMap: Record<string, keyof ParsedCelesaRow> = {};
  for (const h of rawHeaders) {
    const normalized = normalizeHeader(h);
    if (normalized in COLUMN_MAP) {
      headerMap[h] = COLUMN_MAP[normalized];
    }
  }

  const missingColumns = Object.values(COLUMN_MAP).filter(
    (field) => !Object.values(headerMap).includes(field)
  );

  if (missingColumns.length > 0) {
    return {
      valid: [],
      errors: [
        {
          row: 0,
          message: `Columnas faltantes: ${missingColumns.join(", ")}. Se esperan: Pedido, Cliente, Producto, ISBN, Fecha`,
        },
      ],
    };
  }

  const valid: ParsedCelesaRow[] = [];
  const errors: ParseError[] = [];

  raw.forEach((row, i) => {
    const rowNum = i + 2; // +2 because row 1 is header, data starts at 2

    const mapped: Record<string, string> = {};
    for (const [rawKey, field] of Object.entries(headerMap)) {
      const val = row[rawKey];
      mapped[field] = field === "fechaPedido"
        ? excelDateToString(val)
        : String(val ?? "").trim();
    }

    // Validate required fields
    if (!mapped.numeroPedido) {
      errors.push({ row: rowNum, message: "Pedido vacío" });
      return;
    }
    if (!mapped.cliente) {
      errors.push({ row: rowNum, message: "Cliente vacío" });
      return;
    }
    if (!mapped.producto) {
      errors.push({ row: rowNum, message: "Producto vacío" });
      return;
    }

    // Validate date
    if (mapped.fechaPedido && !isValidDate(mapped.fechaPedido)) {
      errors.push({ row: rowNum, message: `Fecha inválida: "${mapped.fechaPedido}"` });
      return;
    }

    // Normalize numeroPedido with # prefix
    const numPedido = mapped.numeroPedido.startsWith("#")
      ? mapped.numeroPedido
      : `#${mapped.numeroPedido}`;

    valid.push({
      numeroPedido: numPedido,
      cliente: mapped.cliente,
      producto: mapped.producto,
      isbn: mapped.isbn || "",
      fechaPedido: mapped.fechaPedido || "",
    });
  });

  return { valid, errors };
}
