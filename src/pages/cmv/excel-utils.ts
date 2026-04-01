import { read, utils, write } from "xlsx";
import type { RawSaleRecord, CreditNote, CmvProduct } from "./types";

// --- Normalización de headers ---

function normalizeHeader(header: string): string {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remover acentos
    .replace(/\s+/g, " ");
}

// --- Parseo del Excel de ventas ---

// Keywords que esperamos encontrar en la fila de headers real
const HEADER_KEYWORDS = [
  "comprobante", "factura", "fecha", "tercero", "bodega",
  "concepto", "referencia", "cantidad", "precio", "valor",
  "secuencia", "tipo", "observaciones", "descuento",
];

export function parseSalesExcel(file: ArrayBuffer): RawSaleRecord[] {
  const wb = read(new Uint8Array(file));
  const sheet = wb.Sheets[wb.SheetNames[0]];

  // Fix: ERPs exportan con celdas mergeadas en las primeras filas (título, empresa, etc.)
  // Esto hace que xlsx calcule !ref como A1:A{N} (una sola columna).
  // Corregimos el rango usando la info de merges para saber cuántas columnas hay realmente.
  const merges = sheet["!merges"] || [];
  if (merges.length > 0) {
    const maxCol = Math.max(...merges.map((m: { e: { c: number } }) => m.e.c));
    const ref = sheet["!ref"] || "A1:A1";
    const lastRow = ref.match(/:[A-Z]+(\d+)$/)?.[1] || "1";
    const colLetter = colToLetter(maxCol);
    sheet["!ref"] = `A1:${colLetter}${lastRow}`;
  }

  // Leer filas como arrays crudos
  const allRows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

  // Encontrar fila de headers: primera fila con 5+ celdas no vacías
  let headerRow = 0;
  for (let i = 0; i < Math.min(allRows.length, 50); i++) {
    const row = allRows[i];
    if (!Array.isArray(row)) continue;
    const nonEmpty = row.filter((c) => String(c).trim() !== "").length;
    if (nonEmpty >= 5) {
      headerRow = i;
      break;
    }
  }

  const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    range: headerRow,
  });

  if (raw.length === 0) {
    throw new Error("El archivo de ventas está vacío");
  }

  // Normalizar headers
  return raw.map((row) => {
    const normalized: RawSaleRecord = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = value;
    }
    return normalized;
  });
}

/** Extrae ISBNs únicos del Excel de ventas sin procesar todo el archivo */
export function extractUniqueIsbns(file: ArrayBuffer): string[] {
  const records = parseSalesExcel(file);
  const isbns = new Set<string>();
  for (const row of records) {
    const isbn = String(
      row[normalizeHeader("Código")] ||
      row[normalizeHeader("Referencia")] ||
      row[normalizeHeader("ISBN")] ||
      row[normalizeHeader("SKU")] ||
      ""
    ).trim();
    if (isbn) isbns.add(isbn);
  }
  return Array.from(isbns);
}

/** Convierte índice de columna (0-based) a letras Excel (0=A, 25=Z, 26=AA, etc.) */
function colToLetter(col: number): string {
  let s = "";
  let c = col;
  while (c >= 0) {
    s = String.fromCharCode((c % 26) + 65) + s;
    c = Math.floor(c / 26) - 1;
  }
  return s;
}

// --- Parseo del Excel de notas crédito ---

export function parseNotesExcel(file: ArrayBuffer): CreditNote[] {
  const wb = read(new Uint8Array(file));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return raw
    .map((row) => {
      const normalized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[normalizeHeader(key)] = value;
      }

      // Buscar columna de comprobante relacionado
      const comprobante =
        normalized["comprobante relacionado"] ||
        normalized["comprobante_relacionado"] ||
        normalized["comp. relacionado"] ||
        normalized["factura relacionada"] ||
        "";

      return {
        comprobanteRelacionado: String(comprobante).trim(),
        tipo: String(normalized["tipo"] || normalized["tipo documento"] || "").trim(),
        valor: Number(normalized["valor"] || normalized["total"] || 0),
      };
    })
    .filter((note) => note.comprobanteRelacionado !== "");
}

// --- Mapeo de columnas del ERP a estructura interna ---

function findField(row: RawSaleRecord, ...candidates: string[]): string {
  for (const c of candidates) {
    const key = normalizeHeader(c);
    if (row[key] !== undefined && row[key] !== "") {
      return String(row[key]);
    }
  }
  return "";
}

function findNumber(row: RawSaleRecord, ...candidates: string[]): number {
  for (const c of candidates) {
    const key = normalizeHeader(c);
    if (row[key] !== undefined && row[key] !== "") {
      const val = Number(row[key]);
      if (!isNaN(val)) return val;
    }
  }
  return 0;
}

// Extraer número de pedido de observaciones
function extractPedido(obs: string): { pedido: string; numeroPedido: string } {
  if (!obs) return { pedido: "", numeroPedido: "" };

  // Buscar patrones como #187120, Pedido 187120, Pedido #187120
  const match = obs.match(/#(\d+)/);
  if (match) {
    return { pedido: "Sí", numeroPedido: match[1] };
  }

  const matchPedido = obs.match(/[Pp]edido\s*#?\s*(\d+)/);
  if (matchPedido) {
    return { pedido: "Sí", numeroPedido: matchPedido[1] };
  }

  return { pedido: "", numeroPedido: "" };
}

export function mapRawToProduct(row: RawSaleRecord): Partial<CmvProduct> {
  const obs = findField(row, "observaciones", "observacion", "obs");
  const { pedido, numeroPedido } = extractPedido(obs);

  return {
    factura: findField(row, "numero comprobante", "comprobante", "factura", "numero factura", "no. factura"),
    fecha: findField(row, "fecha elaboracion", "fecha creacion", "fecha", "fecha factura", "fecha comprobante"),
    tercero: findField(row, "identificacion", "tercero", "nit"),
    terceroNombre: findField(row, "nombre tercero", "nombre contacto", "tercero nombre", "cliente", "razon social"),
    bodega: findField(row, "bodega", "almacen", "sede"),
    concepto: findField(row, "tipo transaccion", "concepto", "tipo concepto"),
    isbn: findField(row, "codigo", "referencia", "isbn", "ref", "sku"),
    producto: findField(row, "nombre", "referencia nombre", "producto", "nombre producto", "descripcion"),
    cantidad: findNumber(row, "cantidad", "cant", "qty"),
    valorUnitario: findNumber(row, "valor unitario", "precio unitario", "precio", "vr unitario"),
    descuentoPct: findNumber(row, "valor desc.", "descuento", "% descuento", "desc", "descuento %"),
    valorTotal: findNumber(row, "total", "valor total", "subtotal", "vr total"),
    observaciones: obs,
    pedido,
    numeroPedido,
    descuento: "VACIO" as const,
    formaPago: findField(row, "forma pago", "medio pago", "forma de pago"),
    tipoDocumento: findField(row, "tipo transaccion", "tipo documento", "tipo doc", "tipo comprobante"),
    secuencia: findField(row, "tipo de registro", "secuencia", "sec"),
    tipoItem: findField(row, "tipo clasificacion", "tipo item", "tipo producto"),
    vendor: "",
    margen: 0,
    costo: 0,
    costoTotal: 0,
  };
}

// --- Filtros ---

export function isProductRecord(row: RawSaleRecord): boolean {
  // Columnas del ERP: "Tipo de registro" = Secuencia/Totales, "Tipo clasificación" = Producto/Servicio
  const tipoRegistro = findField(row, "tipo de registro", "secuencia", "sec").toLowerCase();
  const tipoClasificacion = findField(row, "tipo clasificacion", "tipo item", "tipo producto").toLowerCase();

  // Filtrar: solo filas "Secuencia" + "Producto"
  if (tipoRegistro && tipoClasificacion) {
    return tipoRegistro.includes("secuencia") && tipoClasificacion.includes("producto");
  }

  // Fallback: excluir registros que parecen formas de pago o servicios
  const concepto = findField(row, "tipo transaccion", "concepto", "tipo concepto").toLowerCase();
  const isPayment = concepto.includes("pago") || concepto.includes("recibo") || concepto.includes("abono");
  const isService = concepto.includes("servicio") || concepto.includes("flete") || concepto.includes("envio");

  return !isPayment && !isService;
}

export function getInvoiceNumber(row: RawSaleRecord): string {
  return findField(row, "numero comprobante", "comprobante", "factura", "numero factura", "no. factura");
}

// --- Exportación a Excel ---

export function exportCmvToExcel(products: CmvProduct[], month: number, year: number): void {
  if (products.length === 0) return;

  const data = products.map((p) => ({
    "Factura": p.factura,
    "Fecha": p.fecha,
    "Tercero": p.tercero,
    "Tercero Nombre": p.terceroNombre,
    "Bodega": p.bodega,
    "ISBN": p.isbn,
    "Producto": p.producto,
    "Cantidad": p.cantidad,
    "Valor Unitario": p.valorUnitario,
    "Descuento %": p.descuentoPct,
    "Valor Total": p.valorTotal,
    "Pedido": p.pedido,
    "No. Pedido": p.numeroPedido,
    "Descuento": "",
    "Vendor": p.vendor,
    "Margen": "",
    "Costo Unitario": "",
    "Costo Total": "",
  }));

  const ws = utils.json_to_sheet(data);

  // Ajustar anchos de columna
  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.max(key.length, 15),
  }));
  ws["!cols"] = colWidths;

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "CMV");

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const fileName = `CMV - ${monthNames[month - 1]} ${year}.xlsx`;

  const buf = write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

