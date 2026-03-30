# Phase 4: Pipeline de Datos Shopify - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 04-pipeline-de-datos-shopify
**Areas discussed:** API version strategy, Bulk Operations query scope, Sales cache granularity, Endpoint design, Vendor list source
**Mode:** --auto (all decisions auto-selected as recommended defaults)

---

## API Version Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Stay on 2025-01 | Avoid breaking ingreso module, use currentBulkOperation | ✓ |
| Upgrade to 2026-01 | Use bulkOperation(id:), but requires audit of ingreso | |

**User's choice:** [auto] Stay on 2025-01 (recommended default)
**Notes:** Safest path — the ingreso module depends on currentBulkOperation which works on 2025-01.

---

## Bulk Operations Query Scope

| Option | Description | Selected |
|--------|-------------|----------|
| financial_status:paid only | Conservative, represents real consumption | ✓ |
| Include authorized/partially_paid | Broader capture, risk of counting uncommitted sales | |

**User's choice:** [auto] financial_status:paid only (recommended default)
**Notes:** Pending todo to confirm with ops team — but paid is the safe default.

---

## Sales Cache Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| SKU + month aggregation | Matches replenishment engine thresholds | ✓ |
| SKU + day aggregation | More precise but larger storage, overkill | |

**User's choice:** [auto] SKU + month (recommended default)
**Notes:** Monthly is sufficient for velocity calculation. Daily adds complexity without proportional benefit.

---

## Endpoint Design

| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated router reposiciones.py | Separate concerns, clean module | ✓ |
| Extend ingreso.py | Shared context but couples modules | |

**User's choice:** [auto] New dedicated router (recommended default)
**Notes:** Clean separation — reposiciones imports from shopify_service but has its own router.

---

## Vendor List Source

| Option | Description | Selected |
|--------|-------------|----------|
| From Shopify products vendor field | Single source of truth | ✓ |
| From Firestore providers collection | Depends on migration from v1.0 | |

**User's choice:** [auto] Shopify products vendor field (recommended default)
**Notes:** No dependency on providers migration (v1.0 Phase 2 which is paused).

---

## Claude's Discretion

- Concurrency pattern (threading vs async)
- JSONL parsing approach
- Error handling granularity

## Deferred Ideas

None
