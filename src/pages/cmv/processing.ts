import type {
  RawSaleRecord,
  CreditNote,
  CmvProduct,
  CmvTotals,
  ProcessingStats,
  Vendor,
} from "./types";
import {
  parseSalesExcel,
  parseNotesExcel,
  mapRawToProduct,
  isProductRecord,
  getInvoiceNumber,
} from "./excel-utils";

// --- Paso 3: Eliminar notas crédito ---

function removeCreditNotes(
  records: RawSaleRecord[],
  notes: CreditNote[]
): { filtered: RawSaleRecord[]; removed: number } {
  if (notes.length === 0) return { filtered: records, removed: 0 };

  const noteInvoices = new Set(
    notes.map((n) => n.comprobanteRelacionado.trim().toUpperCase())
  );

  const filtered = records.filter((row) => {
    const invoice = getInvoiceNumber(row).trim().toUpperCase();
    return !noteInvoices.has(invoice);
  });

  return {
    filtered,
    removed: records.length - filtered.length,
  };
}

// --- Paso 4: Filtrar solo productos ---

function filterProducts(records: RawSaleRecord[]): {
  products: RawSaleRecord[];
  removedPayments: number;
  removedServices: number;
} {
  const products: RawSaleRecord[] = [];
  let removedPayments = 0;
  let removedServices = 0;

  for (const row of records) {
    if (isProductRecord(row)) {
      products.push(row);
    } else {
      // Intentar clasificar qué se eliminó
      const concepto = String(row["concepto"] || row["tipo concepto"] || "").toLowerCase();
      if (concepto.includes("pago") || concepto.includes("recibo")) {
        removedPayments++;
      } else {
        removedServices++;
      }
    }
  }

  return { products, removedPayments, removedServices };
}

// --- Pasos 6-7: Asignar vendor y margen ---

function assignVendorAndMargin(
  products: CmvProduct[],
  isbnMap: Map<string, string>,
  vendorMargins: Map<string, number>
): {
  assigned: CmvProduct[];
  unknownVendors: CmvProduct[];
  missingMargins: CmvProduct[];
} {
  const assigned: CmvProduct[] = [];
  const unknownVendors: CmvProduct[] = [];
  const missingMargins: CmvProduct[] = [];

  for (const product of products) {
    const isbn = product.isbn.trim();
    const vendorName = isbnMap.get(isbn) || "";

    if (!vendorName) {
      unknownVendors.push({ ...product, vendor: "", margen: 0, costo: 0, costoTotal: 0 });
      continue;
    }

    const margin = vendorMargins.get(vendorName.toUpperCase());

    if (margin === undefined) {
      missingMargins.push({ ...product, vendor: vendorName, margen: 0, costo: 0, costoTotal: 0 });
      continue;
    }

    const costo = product.valorUnitario * (1 - margin);
    const costoTotal = costo * product.cantidad;

    assigned.push({
      ...product,
      vendor: vendorName,
      margen: margin,
      costo: Math.round(costo),
      costoTotal: Math.round(costoTotal),
    });
  }

  return { assigned, unknownVendors, missingMargins };
}

// --- Paso 8-9: Calcular totales ---

export function calculateTotals(products: CmvProduct[]): CmvTotals {
  if (products.length === 0) {
    return { totalVentas: 0, totalCosto: 0, margenPromedio: 0, costoPctVentas: 0, totalProductos: 0 };
  }

  const totalVentas = products.reduce((sum, p) => sum + p.valorTotal, 0);
  const totalCosto = products.reduce((sum, p) => sum + p.costoTotal, 0);
  const margenPromedio = totalVentas > 0 ? ((totalVentas - totalCosto) / totalVentas) * 100 : 0;
  const costoPctVentas = totalVentas > 0 ? (totalCosto / totalVentas) * 100 : 0;

  return {
    totalVentas: Math.round(totalVentas),
    totalCosto: Math.round(totalCosto),
    margenPromedio: Math.round(margenPromedio * 10) / 10,
    costoPctVentas: Math.round(costoPctVentas * 10) / 10,
    totalProductos: products.length,
  };
}

// --- Procesamiento principal ---

export interface ProcessResult {
  products: CmvProduct[];
  unknownVendorProducts: CmvProduct[];
  missingMarginProducts: CmvProduct[];
  stats: ProcessingStats;
  totals: CmvTotals;
}

/** Parsea los Excels y devuelve registros crudos + ISBNs únicos (para lookup previo) */
export function parseExcelFiles(
  salesBuffer: ArrayBuffer,
  notesBuffer: ArrayBuffer | null,
): { rawRecords: RawSaleRecord[]; creditNotes: CreditNote[]; uniqueIsbns: string[] } {
  const rawRecords = parseSalesExcel(salesBuffer);
  const creditNotes = notesBuffer ? parseNotesExcel(notesBuffer) : [];

  // Extraer ISBNs únicos de los registros
  const isbnSet = new Set<string>();
  for (const row of rawRecords) {
    if (!isProductRecord(row)) continue;
    const partial = mapRawToProduct(row);
    const isbn = (partial.isbn || "").trim();
    if (isbn) isbnSet.add(isbn);
  }

  return { rawRecords, creditNotes, uniqueIsbns: Array.from(isbnSet) };
}

/** Procesa CMV a partir de registros ya parseados + mapa de vendors */
export function processCmvFromRecords(
  rawRecords: RawSaleRecord[],
  creditNotes: CreditNote[],
  vendors: Vendor[],
  skuVendorMap: Map<string, string>
): ProcessResult {

  // 2. Eliminar notas crédito
  const { filtered: afterNotes, removed: removedByNotes } = removeCreditNotes(rawRecords, creditNotes);

  // 3. Filtrar solo productos
  const { products: productRecords, removedPayments, removedServices } = filterProducts(afterNotes);

  // 4. Mapear a estructura interna
  const mapped: CmvProduct[] = productRecords.map((row) => {
    const partial = mapRawToProduct(row);
    return {
      factura: partial.factura || "",
      fecha: partial.fecha || "",
      tercero: partial.tercero || "",
      terceroNombre: partial.terceroNombre || "",
      bodega: partial.bodega || "",
      concepto: partial.concepto || "",
      isbn: partial.isbn || "",
      producto: partial.producto || "",
      cantidad: partial.cantidad || 0,
      valorUnitario: partial.valorUnitario || 0,
      descuentoPct: partial.descuentoPct || 0,
      valorTotal: partial.valorTotal || 0,
      observaciones: partial.observaciones || "",
      pedido: partial.pedido || "",
      numeroPedido: partial.numeroPedido || "",
      descuento: partial.descuento || "VACIO",
      formaPago: partial.formaPago || "",
      tipoDocumento: partial.tipoDocumento || "",
      secuencia: partial.secuencia || "",
      tipoItem: partial.tipoItem || "",
      vendor: "",
      margen: 0,
      costo: 0,
      costoTotal: 0,
    };
  });

  // 4b. Descartar filas sin ISBN (no se pueden cruzar con vendor)
  const withIsbn = mapped.filter((p) => p.isbn.trim() !== "");

  // 5. Crear mapa de márgenes por vendor
  const vendorMargins = new Map<string, number>();
  for (const v of vendors) {
    vendorMargins.set(v.name.toUpperCase(), v.margin);
  }

  // 6. Asignar vendor y margen
  const { assigned, unknownVendors, missingMargins } = assignVendorAndMargin(
    withIsbn,
    skuVendorMap,
    vendorMargins
  );

  // 7. Calcular totales (solo de productos asignados)
  const totals = calculateTotals(assigned);

  const stats: ProcessingStats = {
    totalRawRecords: rawRecords.length,
    removedByNotes,
    removedPayments,
    removedServices,
    totalProducts: withIsbn.length,
    unknownVendors: unknownVendors.length,
    missingMargins: missingMargins.length,
  };

  return {
    products: assigned,
    unknownVendorProducts: unknownVendors,
    missingMarginProducts: missingMargins,
    stats,
    totals,
  };
}

// --- Recalcular después de resolver excepciones ---

export function recalculateProduct(
  product: CmvProduct,
  vendor: string,
  margin: number
): CmvProduct {
  const costo = product.valorUnitario * (1 - margin);
  const costoTotal = costo * product.cantidad;
  return {
    ...product,
    vendor,
    margen: margin,
    costo: Math.round(costo),
    costoTotal: Math.round(costoTotal),
  };
}
