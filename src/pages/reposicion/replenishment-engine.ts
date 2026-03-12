import { parseSalesCsv, parseInventoryCsv } from "./csv-parser";
import type { ProductAnalysis, VendorSummary, ReplenishmentResult, Classification, UrgencyLevel } from "./types";
import { SAFETY_FACTOR, URGENCY_THRESHOLDS, CLASSIFICATION_THRESHOLDS } from "./types";

function classifyProduct(salesPerMonth: number): { classification: Classification; label: string } {
  if (salesPerMonth >= CLASSIFICATION_THRESHOLDS.BESTSELLER) return { classification: "Bestseller", label: "Bestseller" };
  if (salesPerMonth >= CLASSIFICATION_THRESHOLDS.REGULAR) return { classification: "Regular", label: "Venta Regular" };
  if (salesPerMonth >= CLASSIFICATION_THRESHOLDS.SLOW) return { classification: "Slow", label: "Venta Lenta" };
  return { classification: "Long Tail", label: "Cola Larga" };
}

function classifyUrgency(daysOfInventory: number): { urgency: UrgencyLevel; label: string } {
  if (daysOfInventory <= URGENCY_THRESHOLDS.URGENT) return { urgency: "URGENTE", label: "URGENTE" };
  if (daysOfInventory <= URGENCY_THRESHOLDS.SOON) return { urgency: "PRONTO", label: "PRONTO" };
  if (daysOfInventory <= URGENCY_THRESHOLDS.NORMAL) return { urgency: "NORMAL", label: "NORMAL" };
  return { urgency: "OK", label: "OK" };
}

export function calculateReplenishment(
  salesText: string,
  inventoryText: string,
  sede: string,
  leadTimeDays: number
): ReplenishmentResult {
  const sales = parseSalesCsv(salesText);
  const inventory = parseInventoryCsv(inventoryText);

  const sedeCol = inventory.sedes.find((s) => s.label === sede);
  if (!sedeCol) throw new Error(`No se encontró la sede "${sede}"`);

  // Aggregate sales by SKU
  const productSales: Record<string, { title: string; vendor: string; total: number }> = {};
  sales.data.forEach((row) => {
    const sku = (row[sales.skuIdx] || "").trim();
    const qty = parseInt(row[sales.qtyIdx]) || 0;
    const title = row[sales.titleIdx] || "";
    const vendor = row[sales.vendorIdx] || "";
    if (!sku) return;
    if (!productSales[sku]) productSales[sku] = { title, vendor, total: 0 };
    productSales[sku].total += qty;
  });

  const numMonths = Math.max(sales.months.size, 1);
  const numDays = numMonths * 30;

  // Build inventory lookup
  const inventoryMap: Record<string, { stock: number; vendor: string; title: string }> = {};
  inventory.data.forEach((row) => {
    const sku = (row[inventory.skuIdx] || "").trim();
    const stock = parseInt(row[sedeCol.index]) || 0;
    const vendor = (row[inventory.vendorIdx] || "").trim();
    const title = (row[inventory.titleIdx] || "").trim();
    if (sku) inventoryMap[sku] = { stock, vendor, title };
  });

  // Calculate metrics
  const products: ProductAnalysis[] = [];
  Object.entries(productSales).forEach(([sku, data]) => {
    if (data.total <= 0) return;

    const salesPerDay = data.total / numDays;
    const salesPerWeek = salesPerDay * 7;
    const salesPerMonth = data.total / numMonths;
    const stock = inventoryMap[sku]?.stock ?? 0;
    const rawDaysInv = salesPerDay > 0 ? stock / salesPerDay : 999;
    const daysOfInventory: number | "N/A" = rawDaysInv < 999 ? Math.round(rawDaysInv * 10) / 10 : "N/A";
    const reorderPoint = Math.round(salesPerDay * leadTimeDays * SAFETY_FACTOR);
    const needsReorder = stock <= reorderPoint;
    const orderQuantity = needsReorder ? Math.max(Math.round(salesPerMonth + reorderPoint - stock), 1) : 0;

    const { classification, label: classificationLabel } = classifyProduct(salesPerMonth);
    const effectiveDays = typeof daysOfInventory === "number" ? daysOfInventory : 999;
    const { urgency, label: urgencyLabel } = classifyUrgency(effectiveDays);

    const vendor = data.vendor || inventoryMap[sku]?.vendor || "Sin vendor";

    products.push({
      sku,
      title: data.title || inventoryMap[sku]?.title || "",
      vendor,
      classification,
      classificationLabel,
      salesPerMonth: Math.round(salesPerMonth * 10) / 10,
      salesPerWeek: Math.round(salesPerWeek * 10) / 10,
      salesPerDay: Math.round(salesPerDay * 100) / 100,
      totalSold: data.total,
      stock,
      daysOfInventory,
      urgency,
      urgencyLabel,
      reorderPoint,
      needsReorder,
      orderQuantity,
    });
  });

  // Sort by days of inventory ascending
  products.sort((a, b) => {
    const da = typeof a.daysOfInventory === "number" ? a.daysOfInventory : 9999;
    const db = typeof b.daysOfInventory === "number" ? b.daysOfInventory : 9999;
    return da - db;
  });

  // Group by vendor
  const vendorMap: Record<string, ProductAnalysis[]> = {};
  products
    .filter((p) => p.needsReorder && p.orderQuantity > 0)
    .forEach((p) => {
      if (!vendorMap[p.vendor]) vendorMap[p.vendor] = [];
      vendorMap[p.vendor].push(p);
    });

  const vendors: VendorSummary[] = Object.entries(vendorMap)
    .map(([vendor, items]) => ({
      vendor,
      titles: items.length,
      units: items.reduce((sum, i) => sum + i.orderQuantity, 0),
      urgentCount: items.filter((i) => i.urgency === "URGENTE").length,
      items,
    }))
    .sort((a, b) => b.units - a.units);

  const stats = {
    totalProducts: products.length,
    needReplenishment: products.filter((p) => p.needsReorder).length,
    urgent: products.filter((p) => p.urgency === "URGENTE").length,
    outOfStock: products.filter((p) => p.stock === 0).length,
    vendorsWithOrders: vendors.length,
  };

  return { products, vendors, stats };
}
