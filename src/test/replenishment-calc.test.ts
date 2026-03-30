// src/test/replenishment-calc.test.ts
// Tests de referencia para Motor de Cálculo de Reposición (Phase 5)
// Documentan el comportamiento esperado que backend/services/reposicion_service.py debe implementar

import { describe, it, expect } from "vitest"

// ---- Constantes (mirrors types.ts) ----
const CLASSIFICATION_THRESHOLDS = { BESTSELLER: 10, REGULAR: 3, SLOW: 1 }
const URGENCY_THRESHOLDS = { URGENT: 7, SOON: 14, NORMAL: 30 }
const SAFETY_FACTOR = 1.5

// ---- Funciones equivalentes (TypeScript port de la lógica Python esperada) ----

function classifyProduct(salesPerMonth: number): { classification: string; label: string } {
  if (salesPerMonth >= CLASSIFICATION_THRESHOLDS.BESTSELLER)
    return { classification: "Bestseller", label: "Bestseller" }
  if (salesPerMonth >= CLASSIFICATION_THRESHOLDS.REGULAR)
    return { classification: "Regular", label: "Venta Regular" }
  if (salesPerMonth >= CLASSIFICATION_THRESHOLDS.SLOW)
    return { classification: "Slow", label: "Venta Lenta" }
  return { classification: "Long Tail", label: "Cola Larga" }
}

function classifyUrgency(daysOfInventory: number | null): { urgency: string; label: string } {
  if (daysOfInventory === null) return { urgency: "OK", label: "OK" } // D-10: daily_sales=0
  if (daysOfInventory <= URGENCY_THRESHOLDS.URGENT) return { urgency: "URGENTE", label: "URGENTE" }
  if (daysOfInventory <= URGENCY_THRESHOLDS.SOON) return { urgency: "PRONTO", label: "PRONTO" }
  if (daysOfInventory <= URGENCY_THRESHOLDS.NORMAL) return { urgency: "NORMAL", label: "NORMAL" }
  return { urgency: "OK", label: "OK" }
}

function calculateSuggestedQty(
  dailySales: number,
  leadTimeDays: number,
  safetyFactor: number,
  stock: number,
  inTransit: number
): number {
  // D-05: max(0, ceil((daily * lt * sf) - stock - transit))
  const raw = dailySales * leadTimeDays * safetyFactor - stock - inTransit
  return Math.max(0, Math.ceil(raw))
}

function daysInMonth(year: number, month: number): number {
  // month is 1-based
  return new Date(year, month, 0).getDate()
}

function aggregateSalesInRange(
  monthlySales: Record<string, number>,
  startDate: Date,
  endDate: Date
): number {
  // Sum units sold between startDate (inclusive) and endDate (inclusive)
  // Uses proportional day-weighting for partial months (Pattern 2 from RESEARCH.md)
  let total = 0.0

  // Start from the first day of startDate's month
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

  while (current <= endDate) {
    const yearMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`
    const monthUnits = monthlySales[yearMonth] ?? 0
    const dim = daysInMonth(current.getFullYear(), current.getMonth() + 1)

    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
    const monthEnd = new Date(current.getFullYear(), current.getMonth(), dim)

    const overlapStart = startDate > monthStart ? startDate : monthStart
    const overlapEnd = endDate < monthEnd ? endDate : monthEnd

    // CRITICAL: +1 for inclusive on both ends (Pitfall 1)
    const daysDiff = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24))
    const daysCovered = daysDiff + 1

    total += monthUnits * (daysCovered / dim)

    // Advance to next month
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
  }

  return Math.floor(total)
}

interface PendingOrder {
  quantity: number
  createdAt: Date
}

function calculateInTransitReal(
  pendingOrders: PendingOrder[],
  monthlySales: Record<string, number>,
  today: Date
): number {
  // D-03: no pending orders -> return 0
  if (pendingOrders.length === 0) return 0

  // D-01: sum all pending quantities
  const totalPendingQty = pendingOrders.reduce((sum, o) => sum + o.quantity, 0)

  // D-01: oldest pending order date as absorption anchor
  const oldestDate = pendingOrders.reduce(
    (oldest, o) => (o.createdAt < oldest ? o.createdAt : oldest),
    pendingOrders[0].createdAt
  )

  // D-02: sales since oldest order date from sales cache
  const salesSinceOldest = aggregateSalesInRange(monthlySales, oldestDate, today)

  // D-01: absorption model
  const absorbed = Math.min(salesSinceOldest, totalPendingQty)
  return Math.max(0, totalPendingQty - absorbed)
}

interface ProductForVendor {
  vendor: string
  suggestedQty: number
  urgency: string
}

interface VendorAggregation {
  vendor: string
  totalSkus: number
  totalUnitsToOrder: number
  urgentCount: number
}

function aggregateByVendor(products: ProductForVendor[]): VendorAggregation[] {
  // D-17: group by vendor, only include vendors with total_units_to_order > 0
  const vendorMap: Record<string, VendorAggregation> = {}

  for (const p of products) {
    if (p.suggestedQty <= 0) continue
    if (!vendorMap[p.vendor]) {
      vendorMap[p.vendor] = { vendor: p.vendor, totalSkus: 0, totalUnitsToOrder: 0, urgentCount: 0 }
    }
    vendorMap[p.vendor].totalSkus += 1
    vendorMap[p.vendor].totalUnitsToOrder += p.suggestedQty
    if (p.urgency === "URGENTE") vendorMap[p.vendor].urgentCount += 1
  }

  // D-18: sort by urgent_count DESC, then total_units_to_order DESC
  return Object.values(vendorMap).sort((a, b) => {
    if (b.urgentCount !== a.urgentCount) return b.urgentCount - a.urgentCount
    return b.totalUnitsToOrder - a.totalUnitsToOrder
  })
}

// ---- Tests ----

describe("classify_product", () => {
  it("returns Bestseller for sales_per_month >= 10", () => {
    expect(classifyProduct(10)).toEqual({ classification: "Bestseller", label: "Bestseller" })
  })

  it("returns Regular for sales_per_month 9.9 (just below bestseller)", () => {
    expect(classifyProduct(9.9)).toEqual({ classification: "Regular", label: "Venta Regular" })
  })

  it("returns Regular for sales_per_month exactly 3", () => {
    expect(classifyProduct(3)).toEqual({ classification: "Regular", label: "Venta Regular" })
  })

  it("returns Slow for sales_per_month 2.9 (just below regular)", () => {
    expect(classifyProduct(2.9)).toEqual({ classification: "Slow", label: "Venta Lenta" })
  })

  it("returns Slow for sales_per_month exactly 1", () => {
    expect(classifyProduct(1)).toEqual({ classification: "Slow", label: "Venta Lenta" })
  })

  it("returns Long Tail for sales_per_month 0.9 (just below slow)", () => {
    expect(classifyProduct(0.9)).toEqual({ classification: "Long Tail", label: "Cola Larga" })
  })

  it("returns Long Tail for sales_per_month 0 (zero velocity)", () => {
    expect(classifyProduct(0)).toEqual({ classification: "Long Tail", label: "Cola Larga" })
  })
})

describe("classify_urgency", () => {
  it("returns URGENTE for days_of_inventory exactly 7", () => {
    expect(classifyUrgency(7)).toEqual({ urgency: "URGENTE", label: "URGENTE" })
  })

  it("returns PRONTO for days_of_inventory 7.1 (just above urgent)", () => {
    expect(classifyUrgency(7.1)).toEqual({ urgency: "PRONTO", label: "PRONTO" })
  })

  it("returns PRONTO for days_of_inventory exactly 14", () => {
    expect(classifyUrgency(14)).toEqual({ urgency: "PRONTO", label: "PRONTO" })
  })

  it("returns NORMAL for days_of_inventory 14.1 (just above soon)", () => {
    expect(classifyUrgency(14.1)).toEqual({ urgency: "NORMAL", label: "NORMAL" })
  })

  it("returns NORMAL for days_of_inventory exactly 30", () => {
    expect(classifyUrgency(30)).toEqual({ urgency: "NORMAL", label: "NORMAL" })
  })

  it("returns OK for days_of_inventory 30.1 (just above normal)", () => {
    expect(classifyUrgency(30.1)).toEqual({ urgency: "OK", label: "OK" })
  })

  it("returns OK for null (D-10: daily_sales=0 → no urgency)", () => {
    expect(classifyUrgency(null)).toEqual({ urgency: "OK", label: "OK" })
  })
})

describe("calculate_suggested_qty", () => {
  it("formula D-05: daily=1, lead=14, sf=1.5, stock=20, transit=0 → 1", () => {
    // max(0, ceil(1*14*1.5 - 20 - 0)) = max(0, ceil(21-20)) = max(0, 1) = 1
    expect(calculateSuggestedQty(1, 14, SAFETY_FACTOR, 20, 0)).toBe(1)
  })

  it("formula D-05: daily=1, lead=14, sf=1.5, stock=25, transit=0 → 0 (stock excess)", () => {
    // max(0, ceil(21-25)) = max(0, ceil(-4)) = max(0, -4) = 0
    expect(calculateSuggestedQty(1, 14, SAFETY_FACTOR, 25, 0)).toBe(0)
  })

  it("formula D-05: daily=2, lead=14, sf=1.5, stock=0, transit=5 → 37", () => {
    // max(0, ceil(2*14*1.5 - 0 - 5)) = max(0, ceil(42-5)) = max(0, 37) = 37
    expect(calculateSuggestedQty(2, 14, SAFETY_FACTOR, 0, 5)).toBe(37)
  })

  it("formula D-05: daily=0, lead=14, sf=1.5, stock=10, transit=0 → 0 (no demand)", () => {
    // max(0, ceil(0*14*1.5 - 10 - 0)) = max(0, ceil(-10)) = 0
    expect(calculateSuggestedQty(0, 14, SAFETY_FACTOR, 10, 0)).toBe(0)
  })
})

describe("aggregate_sales_in_range", () => {
  it("full month: returns all units for full October 2025", () => {
    const sales = { "2025-10": 31 }
    const start = new Date(2025, 9, 1) // Oct 1
    const end = new Date(2025, 9, 31)  // Oct 31
    expect(aggregateSalesInRange(sales, start, end)).toBe(31)
  })

  it("partial month: Oct 15–31 returns 17 (floor of 17/31*31)", () => {
    // days_covered = 17 (Oct 15 to Oct 31 inclusive = 17 days)
    // 31 * (17/31) = 17.0 → floor = 17
    const sales = { "2025-10": 31 }
    const start = new Date(2025, 9, 15) // Oct 15
    const end = new Date(2025, 9, 31)   // Oct 31
    expect(aggregateSalesInRange(sales, start, end)).toBe(17)
  })

  it("cross-month: Oct 16–Nov 15 returns ~15 (partial Oct + partial Nov)", () => {
    // Oct: 10 * (16/31) ≈ 5.16 → ~5
    // Nov: 20 * (15/30) = 10
    // total ≈ 15.16 → floor = 15
    const sales = { "2025-10": 10, "2025-11": 20 }
    const start = new Date(2025, 9, 16)  // Oct 16
    const end = new Date(2025, 10, 15)   // Nov 15
    expect(aggregateSalesInRange(sales, start, end)).toBe(15)
  })

  it("no data: returns 0 when sales dict is empty", () => {
    const sales: Record<string, number> = {}
    const start = new Date(2025, 9, 1)
    const end = new Date(2025, 9, 31)
    expect(aggregateSalesInRange(sales, start, end)).toBe(0)
  })
})

describe("calculate_in_transit_real", () => {
  it("D-03: no pending orders → in_transit_real = 0", () => {
    expect(calculateInTransitReal([], {}, new Date(2025, 10, 15))).toBe(0)
  })

  it("fully absorbed: 1 order qty=10, created=Oct 1; sales since then=15 → transit=0", () => {
    // absorbed = min(15, 10) = 10; transit = max(0, 10-10) = 0
    const orders: PendingOrder[] = [{ quantity: 10, createdAt: new Date(2025, 9, 1) }]
    const sales = { "2025-10": 15 }
    const today = new Date(2025, 9, 31)
    expect(calculateInTransitReal(orders, sales, today)).toBe(0)
  })

  it("partially absorbed: 1 order qty=10, created=Oct 1; sales since then=5 → transit=5", () => {
    // absorbed = min(5, 10) = 5; transit = max(0, 10-5) = 5
    const orders: PendingOrder[] = [{ quantity: 10, createdAt: new Date(2025, 9, 1) }]
    const sales = { "2025-10": 5 }
    const today = new Date(2025, 9, 31)
    expect(calculateInTransitReal(orders, sales, today)).toBe(5)
  })

  it("D-01 multi-order: 2 orders qty=6+4=10, oldest=Oct 1; sales since oldest=3 → transit=7", () => {
    // total_pending = 10; oldest = Oct 1
    // absorbed = min(3, 10) = 3; transit = max(0, 10-3) = 7
    const orders: PendingOrder[] = [
      { quantity: 6, createdAt: new Date(2025, 9, 1) },
      { quantity: 4, createdAt: new Date(2025, 9, 15) },
    ]
    const sales = { "2025-10": 3 }
    const today = new Date(2025, 9, 31)
    expect(calculateInTransitReal(orders, sales, today)).toBe(7)
  })
})

describe("aggregate_by_vendor", () => {
  it("groups by vendor with correct totals", () => {
    const products: ProductForVendor[] = [
      { vendor: "VendorA", suggestedQty: 10, urgency: "URGENTE" },
      { vendor: "VendorA", suggestedQty: 5, urgency: "OK" },
      { vendor: "VendorB", suggestedQty: 8, urgency: "OK" },
    ]
    const result = aggregateByVendor(products)

    const vendorA = result.find((v) => v.vendor === "VendorA")!
    const vendorB = result.find((v) => v.vendor === "VendorB")!

    expect(vendorA.totalSkus).toBe(2)
    expect(vendorA.totalUnitsToOrder).toBe(15)
    expect(vendorA.urgentCount).toBe(1)

    expect(vendorB.totalSkus).toBe(1)
    expect(vendorB.totalUnitsToOrder).toBe(8)
    expect(vendorB.urgentCount).toBe(0)
  })

  it("D-18: sorts by urgent_count DESC (VendorA with 1 urgent first)", () => {
    const products: ProductForVendor[] = [
      { vendor: "VendorA", suggestedQty: 10, urgency: "URGENTE" },
      { vendor: "VendorA", suggestedQty: 5, urgency: "OK" },
      { vendor: "VendorB", suggestedQty: 8, urgency: "OK" },
    ]
    const result = aggregateByVendor(products)

    expect(result[0].vendor).toBe("VendorA")
    expect(result[1].vendor).toBe("VendorB")
  })

  it("D-18 tie-break: equal urgent_count → sort by total_units_to_order DESC", () => {
    const products: ProductForVendor[] = [
      { vendor: "VendorA", suggestedQty: 5, urgency: "OK" },
      { vendor: "VendorB", suggestedQty: 20, urgency: "OK" },
    ]
    const result = aggregateByVendor(products)

    // Both have urgent_count=0, so sort by total_units: VendorB(20) > VendorA(5)
    expect(result[0].vendor).toBe("VendorB")
    expect(result[1].vendor).toBe("VendorA")
  })

  it("excludes vendors with suggested_qty = 0 (no order needed)", () => {
    const products: ProductForVendor[] = [
      { vendor: "VendorA", suggestedQty: 10, urgency: "OK" },
      { vendor: "VendorB", suggestedQty: 0, urgency: "OK" },
    ]
    const result = aggregateByVendor(products)

    expect(result.length).toBe(1)
    expect(result[0].vendor).toBe("VendorA")
  })
})
