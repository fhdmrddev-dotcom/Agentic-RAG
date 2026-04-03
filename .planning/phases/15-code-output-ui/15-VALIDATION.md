---
phase: 15
slug: code-output-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + React Testing Library |
| **Config file** | frontend/vite.config.ts |
| **Quick run command** | `cd frontend && npm test -- --run` |
| **Full suite command** | `cd frontend && npm test -- --run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm test -- --run`
- **After every plan wave:** Run `cd frontend && npm test -- --run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-T1 | 15-01 | 1 | SAND-12 | Unit | `cd frontend && npm test -- --run src/__tests__/components/ExecuteCodeBlock.test.tsx` | false | pending |
| 15-02-T1 | 15-02 | 2 | SAND-12 | Unit | `cd frontend && npm test -- --run src/__tests__/hooks/useMessages.test.ts` | false | pending |
| 15-02-T2 | 15-02 | 2 | SAND-12 | Unit | `cd frontend && npm test -- --run` | false | pending |
