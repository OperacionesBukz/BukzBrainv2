import { read, utils, writeFile } from "xlsx";
import type {
  DirectoryEntry,
  DirectoryType,
  PersonEntry,
  SupplierEntry,
} from "./types";
import { isPerson } from "./types";

// ── Export ──

export function exportDirectory(
  entries: DirectoryEntry[],
  type: DirectoryType
) {
  const isPersonType = type === "empleado" || type === "temporal";
  const today = new Date().toISOString().slice(0, 10);
  const label =
    type === "empleado"
      ? "empleados"
      : type === "temporal"
        ? "temporales"
        : "proveedores";

  let data: Record<string, string | number>[];

  if (isPersonType) {
    data = (entries.filter(isPerson) as PersonEntry[]).map((e) => ({
      Nombre: e.nombre,
      Apellido: e.apellido,
      "Cédula": e.cedula,
      Celular: e.celular,
      Correo: e.correo,
      Estado: e.estado,
    }));
  } else {
    data = (entries as SupplierEntry[]).map((e) => ({
      Empresa: e.empresa,
      "Razón Social": e.razonSocial,
      NIT: e.nit,
      "Margen %": e.margen,
      Correo: e.correo || "",
      "Correos CC": (e.correos_cc || []).join("; "),
      Estado: e.estado,
    }));
  }

  const ws = utils.json_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, label);
  writeFile(wb, `directorio_${label}_${today}.xlsx`);
}

// ── Import ──

export interface ParsedPersonRow {
  nombre: string;
  apellido: string;
  cedula: string;
  celular: string;
  correo: string;
}

export interface ParsedSupplierRow {
  empresa: string;
  razonSocial: string;
  nit: string;
  margen: number;
  correo: string;
  correos_cc: string[];
}

export interface ParseError {
  row: number;
  message: string;
}

export interface ParseResult<T> {
  valid: T[];
  errors: ParseError[];
}

// Special key for "nombre completo" columns that need splitting
const NOMBRE_COMPLETO_KEY = "_nombreCompleto" as const;

const PERSON_COLUMN_MAP: Record<string, keyof ParsedPersonRow | typeof NOMBRE_COMPLETO_KEY> = {
  nombre: "nombre",
  apellido: "apellido",
  cedula: "cedula",
  celular: "celular",
  correo: "correo",
  email: "correo",
  "nombre completo": NOMBRE_COMPLETO_KEY,
  "nombre completo del empleado": NOMBRE_COMPLETO_KEY,
  "numero de documento de identidad": "cedula",
  "documento": "cedula",
  "correo electronico": "correo",
};

/** Split a full name into nombre + apellido (heuristic: half words each) */
function splitFullName(fullName: string): { nombre: string; apellido: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { nombre: parts[0] || "", apellido: "" };
  const mid = Math.ceil(parts.length / 2);
  return {
    nombre: parts.slice(0, mid).join(" "),
    apellido: parts.slice(mid).join(" "),
  };
}

const SUPPLIER_COLUMN_MAP: Record<string, keyof ParsedSupplierRow> = {
  empresa: "empresa",
  "razon social": "razonSocial",
  nit: "nit",
  margen: "margen",
  "margen %": "margen",
  correo: "correo",
  email: "correo",
  "correos cc": "correos_cc",
};

function normalizeHeader(header: string): string {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function parsePersonExcel(
  file: File
): Promise<ParseResult<ParsedPersonRow>> {
  const buffer = await file.arrayBuffer();
  const wb = read(new Uint8Array(buffer));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (raw.length === 0) {
    return {
      valid: [],
      errors: [{ row: 0, message: "El archivo está vacío" }],
    };
  }

  const rawHeaders = Object.keys(raw[0]);
  const headerMap: Record<string, keyof ParsedPersonRow | typeof NOMBRE_COMPLETO_KEY> = {};
  let hasNombreCompleto = false;
  for (const h of rawHeaders) {
    const normalized = normalizeHeader(h);
    if (normalized in PERSON_COLUMN_MAP) {
      const mapped = PERSON_COLUMN_MAP[normalized];
      headerMap[h] = mapped;
      if (mapped === NOMBRE_COMPLETO_KEY) hasNombreCompleto = true;
    }
  }

  // "nombre completo" satisfies both nombre + apellido
  const hasNombre = hasNombreCompleto || Object.values(headerMap).includes("nombre");
  if (!hasNombre) {
    return {
      valid: [],
      errors: [
        {
          row: 0,
          message: `Columnas faltantes: nombre. Se esperan al menos: Nombre y Apellido, o Nombre Completo`,
        },
      ],
    };
  }

  const valid: ParsedPersonRow[] = [];
  const errors: ParseError[] = [];

  raw.forEach((row, i) => {
    const rowNum = i + 2;
    const mapped: Record<string, string> = {};
    for (const [rawKey, field] of Object.entries(headerMap)) {
      mapped[field] = String(row[rawKey] ?? "").trim();
    }

    // If we have "nombre completo", split it into nombre + apellido
    if (hasNombreCompleto && mapped[NOMBRE_COMPLETO_KEY]) {
      const { nombre, apellido } = splitFullName(mapped[NOMBRE_COMPLETO_KEY]);
      if (!mapped.nombre) mapped.nombre = nombre;
      if (!mapped.apellido) mapped.apellido = apellido;
    }

    if (!mapped.nombre) {
      errors.push({ row: rowNum, message: "Nombre vacío" });
      return;
    }

    valid.push({
      nombre: mapped.nombre,
      apellido: mapped.apellido || "",
      cedula: mapped.cedula || "",
      celular: mapped.celular || "",
      correo: mapped.correo || "",
    });
  });

  return { valid, errors };
}

export async function parseSupplierExcel(
  file: File
): Promise<ParseResult<ParsedSupplierRow>> {
  const buffer = await file.arrayBuffer();
  const wb = read(new Uint8Array(buffer));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (raw.length === 0) {
    return {
      valid: [],
      errors: [{ row: 0, message: "El archivo está vacío" }],
    };
  }

  const rawHeaders = Object.keys(raw[0]);
  const headerMap: Record<string, keyof ParsedSupplierRow> = {};
  for (const h of rawHeaders) {
    const normalized = normalizeHeader(h);
    if (normalized in SUPPLIER_COLUMN_MAP) {
      headerMap[h] = SUPPLIER_COLUMN_MAP[normalized];
    }
  }

  const requiredFields: (keyof ParsedSupplierRow)[] = ["empresa"];
  const missing = requiredFields.filter(
    (f) => !Object.values(headerMap).includes(f)
  );
  if (missing.length > 0) {
    return {
      valid: [],
      errors: [
        {
          row: 0,
          message: `Columna faltante: Empresa`,
        },
      ],
    };
  }

  const valid: ParsedSupplierRow[] = [];
  const errors: ParseError[] = [];

  raw.forEach((row, i) => {
    const rowNum = i + 2;
    const mapped: Record<string, string> = {};
    for (const [rawKey, field] of Object.entries(headerMap)) {
      mapped[field] = String(row[rawKey] ?? "").trim();
    }

    if (!mapped.empresa) {
      errors.push({ row: rowNum, message: "Empresa vacía" });
      return;
    }

    let margen = parseFloat(mapped.margen || "0");
    // Normalize: if value < 1, assume it's a decimal ratio (e.g., 0.30 → 30)
    if (margen > 0 && margen < 1) {
      margen = Math.round(margen * 100);
    }

    valid.push({
      empresa: mapped.empresa,
      razonSocial: mapped.razonSocial || "",
      nit: mapped.nit || "",
      margen,
      correo: mapped.correo || "",
      correos_cc: (mapped.correos_cc || "")
        .split(";")
        .map((s: string) => s.trim())
        .filter(Boolean),
    });
  });

  return { valid, errors };
}
