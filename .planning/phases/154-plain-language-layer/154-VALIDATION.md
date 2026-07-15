---
phase: 154
slug: plain-language-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
---

# Phase 154 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Frontend-only phase (LANG-01, display-only relabel). No backend, no migration.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) |
| **Config file** | `frontend/vitest.config.ts` / `frontend/package.json` |
| **Quick run command** | `cd frontend && npx vitest run <touched test files>` |
| **Full suite command** | `cd frontend && npm run build` (`tsc -b` + `vite build`) + `npx vitest run` |
| **Estimated runtime** | ~30–90 seconds (touched-surface subset) |

**Baseline note:** `tsc -b` reports exactly **30 pre-existing SEED-056/049 errors** —
these are NOT attributable to this phase. Gate = **0 net-new** tsc errors vs that
baseline + `vite build` exit 0.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` on the touched test file(s).
- **After every plan wave:** Run the touched-surface suite + `npm run build` (0 net-new tsc).
- **Before `/gsd:verify-work`:** Touched-surface suite green + `vite build` exit 0.
- **Max feedback latency:** ~90 seconds.

---

## Per-Task Verification Map

> Populated by gsd-planner during planning (one row per task). Skeleton below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 154-01-01 | 01 | 1 | LANG-01 | T-154-01 / — | Term-map maps DISPLAY strings only; underlying enum/API/audit values never changed | unit | `cd frontend && npx vitest run src/lib/__tests__/termMap.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Finalized by the planner. Expected new test files:

- [ ] `frontend/src/lib/__tests__/termMap.test.ts` — term-map round-trip (plain⇄technical), unknown-key passthrough
- [ ] context/provider test — persistence to localStorage, default OFF, flip propagation across consumers (the two-toggles-agree invariant, D-01a)
- [ ] per-surface render assertions (e.g. `DocumentStatusBadge` plain-by-default + technical-on-reveal)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plain labels read naturally to a non-technical user across the relabeled surfaces | LANG-01 SC#1 | Copy quality is subjective (research flagged plain-label copy as `[ASSUMED]` A1) | Operator reads each relabeled surface with the toggle OFF; confirms no jargon leaks, no "plain" label is MORE confusing |
| The reveal flips the WHOLE app (not just one surface) and persists across reload | LANG-01 SC#3 | End-to-end cross-surface + persistence | Flip "Show technical names" in Settings → verify chat + documents + workflows + /admin all show technical vocab; reload → state persists |
| Deep Mode byte-identical | SC#2 | Backend-untouched proof | `git diff --name-only` shows ZERO backend files; no enum/const/API-key/audit-action rename |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
