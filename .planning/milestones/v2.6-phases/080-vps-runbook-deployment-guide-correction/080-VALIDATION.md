---
phase: 080
slug: vps-runbook-deployment-guide-correction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 080 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual doc review + grep-based verification |
| **Config file** | none — documentation-only phase |
| **Quick run command** | `grep -rn "single.worker\|--workers 1" .planning/ --include="*.md"` |
| **Full suite command** | Manual review of both deployment guides |
| **Estimated runtime** | ~30 seconds (grep), ~10 min (manual review) |

---

## Sampling Rate

- **After every task commit:** Run quick grep to verify no stale references introduced
- **After every plan wave:** Full manual review of target documents
- **Before `/gsd-verify-work`:** All 4 SCs manually verified
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| T1 | 01 | 1 | WORKER-LIFT-01 | grep | `grep -n "WORKER_COUNT" .planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` | pending |
| T2 | 01 | 1 | WORKER-LIFT-01 | grep | `grep -n "Redis" .planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` | pending |
| T3 | 01 | 1 | WORKER-LIFT-03 | grep | `grep -n "postgrest" .planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` | pending |
| T4 | 01 | 1 | WORKER-LIFT-01 | grep | `grep -n "Redis" .planning/research/recovered/RECOVERED_Deploy_Hostinger_Supabase_Cloud.md` | pending |
| T5 | 01 | 1 | WORKER-LIFT-01 | grep | `grep -n "pgbouncer\|pool.siz" .planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` | pending |
| T6 | 01 | 1 | SC#4 | grep | `grep -rn "single.worker\|--workers 1" .planning/ --include="*.md" \| grep -v milestones/` | pending |

---

## Validation Architecture

### Coverage Model
Documentation-only phase — no code, no schema, no API surface. Validation is grep-based content verification + manual review of document structure.

### Acceptance Criteria Mapping
- SC#1 → T1 (WORKER_COUNT), T2 (Redis), T3 (postgrest auto-patch note)
- SC#2 → T4 (Hostinger Redis section)
- SC#3 → T5 (pgbouncer tuning section in both docs)
- SC#4 → T6 (no stale single-worker references)
