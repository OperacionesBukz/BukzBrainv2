import { describe, it, expect } from "vitest";
import { validateProductFile, validateUpdateFile, type ValidationError } from "@/pages/ingreso/validation";

function makeRow(overrides: Record<string, unknown> = {}) {
  return { Titulo: "Mi Libro", SKU: "12345", Vendor: "Editorial X", ...overrides };
}

describe("validateProductFile", () => {
  it("returns no errors for a valid file", () => {
    const rows = [makeRow(), makeRow({ SKU: "67890" })];
    const columns = ["Titulo", "SKU", "Vendor"];
    expect(validateProductFile(rows, columns)).toEqual([]);
  });

  it("detects missing required columns", () => {
    const errors = validateProductFile([makeRow()], ["Titulo", "Vendor"]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("SKU");
    expect(errors[0].row).toBeUndefined();
  });

  it("detects empty SKU in a row", () => {
    const rows = [makeRow({ SKU: "" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor"]);
    const skuError = errors.find((e) => e.field === "SKU");
    expect(skuError).toBeDefined();
    expect(skuError!.row).toBe(2);
  });

  it("detects empty Titulo in a row", () => {
    const rows = [makeRow({ Titulo: "" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor"]);
    const err = errors.find((e) => e.field === "Titulo");
    expect(err).toBeDefined();
    expect(err!.row).toBe(2);
  });

  it("detects empty Vendor in a row", () => {
    const rows = [makeRow({ Vendor: "" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor"]);
    const err = errors.find((e) => e.field === "Vendor");
    expect(err).toBeDefined();
  });

  it("detects duplicate SKUs within the file", () => {
    const rows = [makeRow({ SKU: "111" }), makeRow({ SKU: "111" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor"]);
    const dupError = errors.find((e) => e.message.includes("duplicado"));
    expect(dupError).toBeDefined();
    expect(dupError!.row).toBe(3);
  });

  it("detects invalid price", () => {
    const rows = [makeRow({ Precio: "abc" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor", "Precio"]);
    const err = errors.find((e) => e.field === "Precio");
    expect(err).toBeDefined();
  });

  it("allows valid numeric price", () => {
    const rows = [makeRow({ Precio: 29900 })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor", "Precio"]);
    expect(errors).toEqual([]);
  });

  it("detects invalid image URL", () => {
    const rows = [makeRow({ "Portada (URL)": "not-a-url" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor", "Portada (URL)"]);
    const err = errors.find((e) => e.field === "Portada (URL)");
    expect(err).toBeDefined();
  });

  it("allows valid image URL", () => {
    const rows = [makeRow({ "Portada (URL)": "https://example.com/img.jpg" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor", "Portada (URL)"]);
    expect(errors).toEqual([]);
  });

  it("treats SKU with .0 suffix as integer", () => {
    const rows = [makeRow({ SKU: "12345.0" }), makeRow({ SKU: "12345" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor"]);
    const dupError = errors.find((e) => e.message.includes("duplicado"));
    expect(dupError).toBeDefined();
  });

  it("returns early if required columns missing (no row errors)", () => {
    const errors = validateProductFile([{ Foo: "bar" }], ["Foo"]);
    expect(errors.length).toBe(3);
    expect(errors.every((e) => e.row === undefined)).toBe(true);
  });
});

function makeUpdateRow(overrides: Record<string, unknown> = {}) {
  return { SKU: "12345", Precio: 29900, ...overrides };
}

describe("validateUpdateFile", () => {
  it("returns no errors for valid file with SKU", () => {
    const rows = [makeUpdateRow()];
    const columns = ["SKU", "Precio"];
    expect(validateUpdateFile(rows, columns)).toEqual([]);
  });

  it("returns no errors for valid file with ID", () => {
    const rows = [{ ID: "123", Vendor: "Planeta" }];
    const columns = ["ID", "Vendor"];
    expect(validateUpdateFile(rows, columns)).toEqual([]);
  });

  it("detects missing identifier columns", () => {
    const errors = validateUpdateFile([{ Precio: 100 }], ["Precio"]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("SKU");
    expect(errors[0].message).toContain("ID");
  });

  it("detects no data columns present", () => {
    const errors = validateUpdateFile([{ SKU: "123" }], ["SKU"]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("columna de datos");
  });

  it("detects empty SKU in a row when SKU is the identifier", () => {
    const rows = [makeUpdateRow({ SKU: "" })];
    const errors = validateUpdateFile(rows, ["SKU", "Precio"]);
    const err = errors.find((e) => e.field === "SKU");
    expect(err).toBeDefined();
    expect(err!.row).toBe(2);
  });

  it("detects duplicate SKUs", () => {
    const rows = [makeUpdateRow({ SKU: "111" }), makeUpdateRow({ SKU: "111" })];
    const errors = validateUpdateFile(rows, ["SKU", "Precio"]);
    const dupError = errors.find((e) => e.message.includes("duplicado"));
    expect(dupError).toBeDefined();
  });

  it("detects invalid price", () => {
    const rows = [makeUpdateRow({ Precio: "abc" })];
    const errors = validateUpdateFile(rows, ["SKU", "Precio"]);
    const err = errors.find((e) => e.field === "Precio");
    expect(err).toBeDefined();
  });

  it("detects invalid image URL", () => {
    const rows = [makeUpdateRow({ "Portada (URL)": "not-a-url" })];
    const errors = validateUpdateFile(rows, ["SKU", "Portada (URL)"]);
    const err = errors.find((e) => e.field === "Portada (URL)");
    expect(err).toBeDefined();
  });

  it("allows file with only ID column as identifier", () => {
    const rows = [{ ID: "123", Titulo: "Nuevo" }];
    const errors = validateUpdateFile(rows, ["ID", "Titulo"]);
    expect(errors).toEqual([]);
  });

  it("treats SKU with .0 suffix as integer", () => {
    const rows = [makeUpdateRow({ SKU: "12345.0" }), makeUpdateRow({ SKU: "12345" })];
    const errors = validateUpdateFile(rows, ["SKU", "Precio"]);
    const dupError = errors.find((e) => e.message.includes("duplicado"));
    expect(dupError).toBeDefined();
  });
});
