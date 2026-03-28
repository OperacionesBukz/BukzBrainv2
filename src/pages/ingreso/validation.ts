export interface ValidationError {
  row?: number;
  field: string;
  message: string;
}

const REQUIRED_COLUMNS = ["Titulo", "SKU", "Vendor"] as const;

function cleanSku(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return s.replace(/\.0$/, "");
}

export function validateProductFile(
  rows: Record<string, unknown>[],
  columns: string[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Required columns
  for (const col of REQUIRED_COLUMNS) {
    if (!columns.includes(col)) {
      errors.push({ field: col, message: `Columna "${col}" no encontrada` });
    }
  }
  if (errors.length > 0) return errors;

  // 2. Per-row validation
  const skuSeen = new Map<string, number>();

  rows.forEach((row, i) => {
    const rowNum = i + 2; // row 1 = header

    const titulo = String(row["Titulo"] ?? "").trim();
    if (!titulo) {
      errors.push({ row: rowNum, field: "Titulo", message: `Fila ${rowNum}: Titulo vacío` });
    }

    const sku = cleanSku(row["SKU"]);
    if (!sku) {
      errors.push({ row: rowNum, field: "SKU", message: `Fila ${rowNum}: SKU vacío` });
    } else {
      const firstRow = skuSeen.get(sku);
      if (firstRow !== undefined) {
        errors.push({
          row: rowNum,
          field: "SKU",
          message: `Fila ${rowNum}: SKU "${sku}" duplicado (ya en fila ${firstRow})`,
        });
      } else {
        skuSeen.set(sku, rowNum);
      }
    }

    const vendor = String(row["Vendor"] ?? "").trim();
    if (!vendor) {
      errors.push({ row: rowNum, field: "Vendor", message: `Fila ${rowNum}: Vendor vacío` });
    }

    // Price (optional)
    if ("Precio" in row && row["Precio"] != null && String(row["Precio"]).trim() !== "") {
      const precio = Number(row["Precio"]);
      if (isNaN(precio) || precio <= 0) {
        errors.push({
          row: rowNum,
          field: "Precio",
          message: `Fila ${rowNum}: Precio inválido "${row["Precio"]}"`,
        });
      }
    }

    // Image URL (optional)
    if ("Portada (URL)" in row && row["Portada (URL)"] != null) {
      const url = String(row["Portada (URL)"]).trim();
      if (url && !/^https?:\/\/.+/i.test(url)) {
        errors.push({
          row: rowNum,
          field: "Portada (URL)",
          message: `Fila ${rowNum}: URL de portada inválida`,
        });
      }
    }
  });

  return errors;
}
