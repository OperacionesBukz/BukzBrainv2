# Phase 5: Motor de Cálculo de Reposición - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 05-motor-de-c-lculo-de-reposici-n
**Areas discussed:** In-transit algorithm, Endpoint contract, Safety factor, Product filtering
**Mode:** --auto (all decisions auto-selected as recommended defaults)

---

## In-Transit Algorithm Design

| Option | Description | Selected |
|--------|-------------|----------|
| Chronological list model | Sum all pending, calculate absorbed from real sales | ✓ |
| Per-order sequential model | Process each order individually in date order | |
| Simple subtract model | Just subtract total pending from suggested | |

**User's choice:** [auto] Chronological list model (recommended default)
**Notes:** Approved by user in earlier conversation — use real Shopify sales since pending order date.

---

## Endpoint Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Single POST calculate + persist | Returns results AND saves draft | ✓ |
| Separate calculate and persist | Two endpoints, two round-trips | |

**User's choice:** [auto] Single endpoint (recommended default)

---

## Safety Factor Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable with default 1.5 | Request param, matches existing module | ✓ |
| Hardcoded 1.5 | Simpler but inflexible | |

**User's choice:** [auto] Configurable (recommended default)

---

## Product Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Include all with inventory | Zero-velocity = Long Tail, user filters in UI | ✓ |
| Exclude zero-velocity | Smaller result set but hides products | |

**User's choice:** [auto] Include all (recommended default)

---

## Claude's Discretion

- Internal module structure
- Error handling edge cases
- Pure Python vs numpy/pandas (pure Python preferred)

## Deferred Ideas

None
