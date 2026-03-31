---
phase: 8
slug: historial-de-pedidos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 + React Testing Library |
| **Config file** | `vite.config.ts` (vitest inline config) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | HIST-01 | unit | `npx vitest run src/test/reposiciones/history.test.ts` | No — Wave 0 | pending |
| 08-01-02 | 01 | 1 | HIST-02 | unit | `npx vitest run src/test/reposiciones/history.test.ts` | No — Wave 0 | pending |
| 08-01-03 | 01 | 1 | HIST-03 | unit | `npx vitest run src/test/reposiciones/history.test.ts` | No — Wave 0 | pending |
| 08-01-04 | 01 | 1 | HIST-04 | unit | `npx vitest run src/test/reposiciones/history.test.ts` | No — Wave 0 | pending |
| 08-01-05 | 01 | 1 | HIST-05 | unit | `npx vitest run src/test/reposiciones/history.test.ts` | No — Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `src/test/reposiciones/history.test.ts` — stubs for HIST-01 filter logic, HIST-02 transitions map, HIST-03 item rendering, HIST-04 download helper, HIST-05 missing status_history default

*Existing Vitest infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-time update via onSnapshot | HIST-01 | Requires two browser sessions | Open two browsers, change status in one, verify other updates |
| Tab navigation between Nuevo Sugerido and Historial | D-01 | Visual UI interaction | Click tabs, verify content switches |
| Collapsible row expand/collapse | D-10 | Visual UI interaction | Click row, verify detail panel appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
