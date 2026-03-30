# Feature Landscape: Reposiciones Automatizadas

**Domain:** Automated inventory replenishment with approval workflows (internal ops tool, Shopify-native)
**Researched:** 2026-03-30
**Confidence:** HIGH for table stakes (well-documented domain); MEDIUM for differentiators (context-specific)

---

## Table Stakes

Features users expect in any replenishment system. Missing = product feels broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Calculation engine: current stock + lead time + sales velocity → suggested quantity | Core value. Without it there is no module. | High | Must use real Shopify inventory by location, real sales from Shopify. No static formulas against CSV. |
| Review suggested quantities before ordering | No team approves blind suggestions. Human review is non-negotiable. | Med | Inline editable table. Per-SKU quantity override. |
| Approval gate (Borrador → Aprobado) | Prevents accidental order generation. Standard in all PO workflows. | Low | Single-step approval is fine for internal tool. Multi-level unnecessary at Bukz scale. |
| Order history list | Teams need to see what was ordered, when, and by whom. | Med | Table with filter by state, vendor, date. Paginated. |
| Order state tracking (Borrador → Aprobado → Enviado → Parcial → Recibido) | Users must know at a glance what is pending action. Standard across all PO systems. | Med | Each state transition must be explicit user action, not automatic (except Draft creation). |
| Filter/select vendors for a replenishment run | Bukz has 150+ vendors. Users never process all at once. | Low | Multi-select with search. Vendor list sourced from Shopify products by vendor tag. |
| Per-vendor order generation (Excel) | Vendors receive individual files, not aggregated. This is operational reality. | Med | Same format as existing manual module to avoid retraining vendors. |
| ZIP download of all vendor Excels | Standard delivery mechanism already established by existing manual module. | Low | Backend job, async, poll for completion. |
| Configuration: sede (location), lead time, date range for sales | Parameters change per run. Without this, calculation is unreliable. | Low | Form before triggering calculation. Persist last-used config per user. |
| Reposicion linked to specific Shopify location | Bukz operates multi-bodega. Inventory levels are per-location, not global. | Med | Shopify `inventoryLevel` query by `locationId`. |
| In-transit detection: reduce suggested qty by units already ordered but not received | Over-ordering in-transit stock is a real operational waste. | High | Most complex feature. Uses Shopify order history + pending PO records to compute real need. See dependency note. |
| Basic audit trail: who created, who approved, timestamps | Internal compliance. Even small teams need this when disputes arise. | Low | Firestore document fields: `createdBy`, `approvedBy`, `createdAt`, `approvedAt`. |

---

## Differentiators

Features that make this module clearly better than the existing manual CSV process.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sales cache in Firestore via Shopify Bulk Operations | First run may take 1-3 min; subsequent runs are instant. Teams won't wait 3 minutes every replenishment cycle. Without cache, this becomes unusable daily. | High | Shopify Bulk Operations API returns JSONL asynchronously. Cache keyed by `variantId + date range`. Invalidate when >24h old. |
| Real sales data from Shopify (not manual CSV upload) | Eliminates human error in data prep. The existing manual module requires someone to export and upload CSV — this goes away. | Med | Uses `orders` GraphQL query filtered by `created_at >= [date]` and `financial_status: paid`. |
| Suggested quantities are editable per-line before approval | Users trust suggestions more when they can override. Approval without editability creates friction. | Med | Inline number input in review table. Track which lines were manually overridden (visual indicator). |
| "Recalcular" button without losing manual overrides | If config changes mid-session, user can refresh suggestions without losing their edits. | Med | Client state: `{ suggested: number, override: number | null }` per line. Recalc only resets `suggested`, not `override`. |
| Vendor quantity summary at approval time | Before approving, user sees total units and estimated cost per vendor. Prevents surprises. | Low | Aggregate from line items already in memory. No extra API call. |
| Link each pedido to the Shopify draft order or a note | Provides traceability from Bukz order → Shopify → vendor confirmation. | Med | Optional for MVP. Store Shopify draft order ID in Firestore pedido doc if created. |
| Sales velocity trend indicator per SKU | Shows if a product is accelerating or declining. Changes suggested qty trust level. | High | Requires comparing velocity across two periods (e.g., last 30 days vs prior 30 days). Defer post-MVP. |

---

## Anti-Features

Features to explicitly NOT build for this module.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Automatic order submission to vendor (no human step) | Bukz vendors receive Excel files by email, not EDI. Auto-send removes human check on a financial commitment. Legal/operational risk. | Keep ZIP download + manual email send. Add "Marcar como Enviado" button after download. |
| Multi-level approval chains (e.g. compras → gerencia → finanzas) | Bukz is a small team. Multi-level approvals add friction with no value. Single approver is correct. | One approve button. Roles: any admin can approve. |
| Real-time Shopify inventory push from this module | Reposiciones calculates orders TO send to vendors — it does not receive stock. Updating Shopify inventory from here would conflict with the actual receiving workflow in the Inventory module. | Inventory module handles stock entry. Reposiciones marks pedido as Recibido only. |
| Email notifications for every state transition | Already marked Out of Scope in PROJECT.md. Overloads inbox for small team. | In-app state visible in order list. Toast on explicit actions. |
| Demand forecasting with ML / AI models | Bukz volume does not justify the complexity. A moving average over real Shopify sales is sufficient and explainable. | Use configurable sales date range as the demand proxy. Simple and auditable. |
| Integration with external ERP or accounting systems | Out of scope per PROJECT.md. No ERP in use. | Pedido history in Firestore is the record of truth. |
| Vendor portal / vendor login | Vendors are external. Adding auth for them is a separate product. | Vendors receive Excel by email, same as today. |
| Barcode scanning for receiving | Out of scope for MVP. Receiving confirmation is manual ("Recibido" state). | Future: scan sheet on receipt. Not now. |
| Real-time stock alerts / push notifications | Service worker complexity not justified per PROJECT.md decision. | Order list shows Parcial/Pendiente states clearly in-app. |

---

## Feature Dependencies

```
Shopify location list
  → Configuration form (sede selection)
    → Calculation engine

Shopify sales data (Bulk Operations)
  → Sales cache in Firestore
    → Calculation engine

Shopify inventory by location
  → Calculation engine

Vendor list (from Shopify product vendor tags)
  → Vendor filter in configuration

Calculation engine
  → Suggested quantities table (Borrador)
    → Inline edit / override
      → Approval gate
        → Pedido doc in Firestore (Aprobado)
          → Vendor Excel generation (per vendor)
            → ZIP download
              → "Marcar como Enviado" action

Pedido history
  → In-transit detection (open Aprobado/Enviado pedidos reduce suggested qty)

Pedido doc in Firestore
  → State transitions: Aprobado → Enviado → Parcial → Recibido
  → Order history list with filter
```

**Critical path:** Shopify API integration → Calculation engine → Borrador creation → Approval → Excel/ZIP export. Everything else is secondary.

**In-transit detection is a second-order dependency:** it requires at least one completed replenishment cycle to have stored pedido records in Firestore before it can function. For the very first run it is a no-op (no prior open orders). This is correct behavior, not a bug.

---

## MVP Recommendation

Prioritize:

1. Shopify API layer: inventory by location, products by vendor, sales history (with cache)
2. Calculation engine: `(sales_velocity * lead_time) - current_stock - in_transit_qty`
3. Configuration UI: sede, vendors, lead time, date range
4. Suggested quantities table with inline edit + approval flow
5. Excel generation per vendor + ZIP download
6. Order history with state transitions

Defer post-MVP:

- Sales velocity trend indicator (requires two-period comparison, adds compute complexity)
- Shopify draft order linking (useful but not operationally blocking)
- Recalculate-without-losing-overrides UX refinement (nice-to-have, basic recalc is sufficient for MVP)
- Vendor quantity summary panel (useful but derivable from the table itself)

---

## Sources

- [eTurns: Inventory Replenishment and Approval Workflow Models](https://www.eturns.com/resources/blog/what-are-the-best-inventory-replenishment-and-approval-workflow-models-punchout-quotes-etc) — MEDIUM confidence (industry vendor)
- [Moxo: Inventory Replenishment Workflow Guide](https://www.moxo.com/blog/inventory-replenishment-workflow) — MEDIUM confidence (workflow SaaS vendor)
- [Fabrikator: 11 Costly Inventory Replenishment Mistakes](https://www.fabrikator.io/blog/how-can-automatic-inventory-replenishment-go-wrong) — MEDIUM confidence
- [Zip: Purchase Order Approval Workflow Guide](https://ziphq.com/blog/purchase-order-approval-workflow) — MEDIUM confidence
- [Zip: Purchase Order Tracking Guide](https://ziphq.com/blog/purchase-order-tracking) — MEDIUM confidence
- [Prediko: Purchase Order Management for Shopify](https://www.prediko.io/blog/purchase-order-management-apps-shopify) — MEDIUM confidence (competitor analysis)
- [Fabrikator: Inventory Replenishment Best Practices](https://www.fabrikator.io/blog/inventory-replenishment-best-practices) — MEDIUM confidence
- PROJECT.md context (decisions, constraints, existing features) — HIGH confidence
