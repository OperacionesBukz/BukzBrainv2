---
phase: 6
slug: wizard-frontend-config-y-sugeridos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x + React Testing Library |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/test/reposiciones` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/test/reposiciones`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | CONF-01 | integration | `npx vitest run src/test/reposiciones` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | CONF-02 | integration | `npx vitest run src/test/reposiciones` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | CONF-03 | integration | `npx vitest run src/test/reposiciones` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | CONF-04 | integration | `npx vitest run src/test/reposiciones` | ❌ W0 | ⬜ pending |
| 06-01-05 | 01 | 1 | CONF-05 | integration | `npx vitest run src/test/reposiciones` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | APPR-01 | integration | `npx vitest run src/test/reposiciones` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | APPR-02 | integration | `npx vitest run src/test/reposiciones` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 2 | APPR-03 | integration | `npx vitest run src/test/reposiciones` | ❌ W0 | ⬜ pending |
| 06-02-04 | 02 | 2 | APPR-04 | integration | `npx vitest run src/test/reposiciones` | ❌ W0 | ⬜ pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [ ] `src/test/reposiciones/` — test directory for reposiciones module
- [ ] Test stubs for CONF-01 through CONF-05 and APPR-01 through APPR-04

*Existing vitest infrastructure covers framework needs — only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Location dropdown populated with Shopify data | CONF-01 | Requires live Shopify API | Open /reposiciones, verify dropdown shows real locations |
| Vendor multi-select populated | CONF-02 | Requires live Shopify API | Open /reposiciones, verify multi-select shows vendors |
| Config persists across sessions | CONF-05 | Requires Firestore + auth | Configure, close, reopen — verify config restored |
| Inline edit preserves on recalculate | APPR-03 | E2E user interaction | Edit qty, recalculate, verify overrides preserved |
| Vendor summary updates after edits | APPR-04 | E2E user interaction | Edit/delete rows, verify summary updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
