"""
Motor de Cálculo de Reposición — Servicio de funciones puras.
No tiene dependencias de FastAPI ni Firestore — solo recibe datos y devuelve resultados.
Implementa CALC-01 a CALC-06 según decisiones D-01 a D-18 de 05-CONTEXT.md.

Punto de entrada principal: calculate_replenishment()
Exporta: classify_product, classify_urgency, aggregate_sales_in_range,
         calculate_in_transit_real, calculate_replenishment
"""

# SCHEMA CONTRACT: replenishment_orders documents must have structure per Pitfall 5 of RESEARCH.md:
# {
#   "status": "aprobado" | "enviado",
#   "created_at": "ISO 8601 UTC string",
#   "location_id": str,
#   "items": [{"sku": str, "vendor": str, "quantity": int, "title": str}, ...]
# }
# Phase 7 must conform to this schema when writing aprobado/enviado documents.

import math
import calendar
from datetime import date, datetime, timezone


# ---- Constantes (D-09, D-10) ----
# Mirrors TypeScript constants in src/pages/reposicion/types.ts

CLASSIFICATION_THRESHOLDS = {"BESTSELLER": 10, "REGULAR": 3, "SLOW": 1}
URGENCY_THRESHOLDS = {"URGENT": 7, "SOON": 14, "NORMAL": 30}
SAFETY_FACTOR = 1.5


def classify_product(sales_per_month: float) -> tuple[str, str]:
    """
    Classifies a product by its average monthly sales velocity.

    Returns (classification, label) where:
    - classification: "Bestseller" | "Regular" | "Slow" | "Long Tail"
    - label: Spanish display label

    Thresholds (D-09):
    - Bestseller: >= 10 units/month
    - Regular:    >= 3 units/month
    - Slow:       >= 1 unit/month
    - Long Tail:  < 1 unit/month (including zero-velocity products)
    """
    if sales_per_month >= CLASSIFICATION_THRESHOLDS["BESTSELLER"]:
        return "Bestseller", "Bestseller"
    if sales_per_month >= CLASSIFICATION_THRESHOLDS["REGULAR"]:
        return "Regular", "Venta Regular"
    if sales_per_month >= CLASSIFICATION_THRESHOLDS["SLOW"]:
        return "Slow", "Venta Lenta"
    return "Long Tail", "Cola Larga"


def classify_urgency(days_of_inventory: float | None) -> tuple[str, str]:
    """
    Assigns urgency level based on days of inventory remaining.

    Returns (urgency, label) where:
    - urgency: "URGENTE" | "PRONTO" | "NORMAL" | "OK"

    Thresholds (D-10):
    - URGENTE: <= 7 days
    - PRONTO:  <= 14 days
    - NORMAL:  <= 30 days
    - OK:      > 30 days

    Special case: None → "OK" (D-10: daily_sales=0 means no demand urgency)
    """
    if days_of_inventory is None:
        return "OK", "OK"  # D-10: daily_sales=0 → no urgency
    if days_of_inventory <= URGENCY_THRESHOLDS["URGENT"]:
        return "URGENTE", "URGENTE"
    if days_of_inventory <= URGENCY_THRESHOLDS["SOON"]:
        return "PRONTO", "PRONTO"
    if days_of_inventory <= URGENCY_THRESHOLDS["NORMAL"]:
        return "NORMAL", "NORMAL"
    return "OK", "OK"


def aggregate_sales_in_range(
    monthly_sales: dict[str, int],
    start_date: date,
    end_date: date,
) -> int:
    """
    Sums units sold between start_date (inclusive) and end_date (inclusive).
    Uses proportional day-weighting for partial months (Pattern 2 from RESEARCH.md).

    The sales cache stores full-month totals per YYYY-MM key. For a month that is
    partially covered by the range, we prorate: units * (days_covered / days_in_month).

    Handles leap years via calendar.monthrange (Pitfall 1 guard: +1 for inclusive bounds).

    Args:
        monthly_sales: {YYYY-MM: units} — e.g. {"2025-10": 31, "2025-11": 12}
        start_date: inclusive start of range
        end_date: inclusive end of range

    Returns:
        int: total units (floor of prorated sum)
    """
    total = 0.0

    # Iterate month by month starting from the first day of start_date's month
    current = date(start_date.year, start_date.month, 1)

    while current <= end_date:
        year_month = current.strftime("%Y-%m")
        month_units = monthly_sales.get(year_month, 0)
        days_in_month = calendar.monthrange(current.year, current.month)[1]

        # Determine overlap between [start_date, end_date] and this calendar month
        month_start = date(current.year, current.month, 1)
        month_end = date(current.year, current.month, days_in_month)

        overlap_start = max(start_date, month_start)
        overlap_end = min(end_date, month_end)

        # CRITICAL: +1 for inclusive on both ends — Pitfall 1
        days_covered = (overlap_end - overlap_start).days + 1

        total += month_units * (days_covered / days_in_month)

        # Advance to next month
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)

    return int(total)


def calculate_in_transit_real(
    sku: str,
    pending_orders_for_sku: list[dict],
    monthly_sales: dict[str, int],
    today: date,
) -> int:
    """
    Calculates the real in-transit quantity for a SKU using the absorption model (D-01).

    Multi-order algorithm:
    1. Sum total pending quantity across ALL pending orders for this SKU
    2. Find the oldest pending order date (absorption anchor)
    3. Sum sales from oldest order date to today (from sales cache)
    4. absorbed = min(total_sales_since_oldest, total_pending_qty)
    5. in_transit_real = max(0, total_pending_qty - absorbed)

    Args:
        sku: product SKU (used for logging/debug context)
        pending_orders_for_sku: list of dicts with {"quantity": int, "created_at": datetime or ISO str}
        monthly_sales: {YYYY-MM: units} from sales cache for this SKU
        today: the end date for absorption calculation

    Returns:
        int: real in-transit quantity after absorption
    """
    if not pending_orders_for_sku:
        return 0  # D-03: no pending orders → in_transit_real = 0

    total_pending_qty = sum(o["quantity"] for o in pending_orders_for_sku)

    # D-01: oldest pending order date as absorption anchor
    # GUARD: created_at may be string ISO 8601 or datetime; normalize if needed
    def _to_date(created_at) -> date:
        if isinstance(created_at, str):
            # Parse ISO 8601 string; handle both with and without timezone info
            dt = datetime.fromisoformat(created_at)
            return dt.date()
        if isinstance(created_at, datetime):
            return created_at.date()
        if isinstance(created_at, date):
            return created_at
        # Fallback: try to convert
        return datetime.fromisoformat(str(created_at)).date()

    oldest_date = min(_to_date(o["created_at"]) for o in pending_orders_for_sku)

    # D-02: sales since oldest order date from sales cache
    sales_since_oldest = aggregate_sales_in_range(monthly_sales, oldest_date, today)

    # D-01: absorption model
    absorbed = min(sales_since_oldest, total_pending_qty)
    return max(0, total_pending_qty - absorbed)


def calculate_replenishment(
    inventory_items: list[dict],
    sales_cache: dict[str, dict[str, int]],
    pending_orders_map: dict[str, list[dict]],
    params: dict,
) -> dict:
    """
    Main entry point: calculates replenishment suggestions for all inventory items.

    Implements CALC-01 through CALC-06 per decisions D-01 to D-18 from 05-CONTEXT.md.

    Args:
        inventory_items: list of {sku, title, vendor, available} dicts
                         (from get_inventory_by_location — D-15: ALL products included)
        sales_cache: {sku: {YYYY-MM: units}} — from Firestore sales_cache/6m_global
        pending_orders_map: {sku: [pending_order_dicts]} — pre-grouped by SKU
                            (pending orders with status aprobado or enviado — D-04)
        params: {
            lead_time_days: int,
            safety_factor: float,
            date_range_days: int,
            date_range_start: date,
            date_range_end: date,
        }

    Returns:
        dict: {
            "products": list[dict],      # per-SKU analysis, sorted by days_of_inventory asc
            "vendor_summary": list[dict], # aggregated by vendor, sorted by urgent_count desc
            "stats": dict,               # summary counts
        }

    Notes:
        - D-15: includes ALL products regardless of velocity (zero-velocity → Long Tail)
        - D-16: vendor filtering already applied before calling (in endpoint)
        - D-08: suggested_qty == 0 products still appear in results with urgency="OK"
    """
    lead_time_days = params["lead_time_days"]
    safety_factor = params["safety_factor"]
    date_range_start: date = params["date_range_start"]
    date_range_end: date = params["date_range_end"]

    # days_in_period for daily rate calculation (D-06)
    days_in_period = (date_range_end - date_range_start).days + 1

    products = []

    for item in inventory_items:
        sku = item["sku"]
        stock = item["available"]
        title = item["title"]
        vendor = item["vendor"]

        monthly_sales = sales_cache.get(sku, {})

        # D-06: calculate sales metrics over the configured period
        total_sold = aggregate_sales_in_range(monthly_sales, date_range_start, date_range_end)
        daily_sales = total_sold / days_in_period
        sales_per_month = total_sold / max(1, (days_in_period / 30))
        sales_per_week = daily_sales * 7

        # Pitfall 2: division guard for zero-velocity products
        days_of_inventory = (stock / daily_sales) if daily_sales > 0 else None

        # Reorder point = demand during lead time with safety factor
        reorder_point = daily_sales * lead_time_days * safety_factor
        needs_reorder = stock <= reorder_point

        # D-04 / CALC-04 / CALC-05: in-transit detection using absorption model
        in_transit_orders = pending_orders_map.get(sku, [])
        in_transit_real = calculate_in_transit_real(sku, in_transit_orders, monthly_sales, date_range_end)

        # D-05: core formula
        suggested_qty_raw = (daily_sales * lead_time_days * safety_factor) - stock - in_transit_real
        suggested_qty = max(0, math.ceil(suggested_qty_raw))

        # CALC-02: classify by velocity
        classification, classification_label = classify_product(sales_per_month)

        # CALC-03: classify urgency (D-10: None → OK for zero-velocity)
        urgency, urgency_label = classify_urgency(days_of_inventory)

        # D-08: all products appear in results regardless of suggested_qty value
        products.append({
            "sku": sku,
            "title": title,
            "vendor": vendor,
            "classification": classification,
            "classification_label": classification_label,
            "sales_per_month": sales_per_month,
            "sales_per_week": sales_per_week,
            "sales_per_day": daily_sales,
            "total_sold": total_sold,
            "stock": stock,
            "days_of_inventory": days_of_inventory,
            "urgency": urgency,
            "urgency_label": urgency_label,
            "reorder_point": reorder_point,
            "needs_reorder": needs_reorder,
            "suggested_qty": suggested_qty,
            "in_transit_real": in_transit_real,
        })

    # Sort products by days_of_inventory ascending (None → proxy 9999 to put at end)
    products.sort(key=lambda p: p["days_of_inventory"] if p["days_of_inventory"] is not None else 9999)

    # D-17 / D-18: vendor aggregation
    # Only include vendors where total_units_to_order > 0
    vendor_map: dict[str, dict] = {}
    for p in products:
        if p["suggested_qty"] <= 0:
            continue
        vendor = p["vendor"]
        if vendor not in vendor_map:
            vendor_map[vendor] = {
                "vendor": vendor,
                "total_skus": 0,
                "total_units_to_order": 0,
                "urgent_count": 0,
            }
        vendor_map[vendor]["total_skus"] += 1
        vendor_map[vendor]["total_units_to_order"] += p["suggested_qty"]
        if p["urgency"] == "URGENTE":
            vendor_map[vendor]["urgent_count"] += 1

    # D-18: sort by urgent_count DESC, then total_units_to_order DESC
    vendor_summary = sorted(
        vendor_map.values(),
        key=lambda v: (-v["urgent_count"], -v["total_units_to_order"]),
    )

    # Stats
    stats = {
        "total_products": len(products),
        "needs_replenishment": len([p for p in products if p["suggested_qty"] > 0]),
        "urgent": len([p for p in products if p["urgency"] == "URGENTE"]),
        "out_of_stock": len([p for p in products if p["stock"] == 0]),
        "vendors_with_orders": len(vendor_summary),
    }

    return {
        "products": products,
        "vendor_summary": list(vendor_summary),
        "stats": stats,
    }
