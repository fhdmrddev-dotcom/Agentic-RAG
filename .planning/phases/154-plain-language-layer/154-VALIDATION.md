---
phase: 154
slug: plain-language-layer
status: planned
nyquist_compliant: true
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

> One row per task. Wave 1 = the spine (Plan 01); Wave 2 = relabel surfaces (Plans 02, 03 — disjoint files, parallel).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 154-01-01 | 01 | 1 | LANG-01 | T-154-02 | Shared context (not a bare hook): default OFF, toggle flips one shared value, persists to localStorage, throws outside provider | unit | `cd frontend && npx vitest run src/providers/__tests__/TechnicalNamesProvider.test.tsx` | ❌ W0 | ⬜ pending |
| 154-01-02 | 01 | 1 | LANG-01 | T-154-01 | Term-map maps DISPLAY strings only; `technical` side === today's shipped string; unknown-key passthrough; PlainLabel renders escaped text (no dangerouslySetInnerHTML) | unit | `cd frontend && npx vitest run src/lib/__tests__/termMap.test.tsx` | ❌ W0 | ⬜ pending |
| 154-01-03 | 01 | 1 | LANG-01 (D-01a) | T-154-01 | Control Room consumes the shared context (zero leaf edits); Settings + admin toggles are one switch; provider mounted app-wide | integration | `cd frontend && npx vitest run src/components/admin/__tests__/ControlRoomPage.test.tsx` | ⚠️ wrap in `<TechnicalNamesProvider>` | ⬜ pending |
| 154-02-01 | 02 | 2 | LANG-01 | T-154-01 | Ingestion badge plain by default / technical on reveal; `styles[status]` stays keyed on the raw enum (never the label) | unit | `cd frontend && npx vitest run src/__tests__/components/DocumentStatusBadge.test.tsx` | ⚠️ extend existing | ⬜ pending |
| 154-02-02 | 02 | 2 | LANG-01 | T-154-01 | Document-detail "Metadata" → "Details" default, technical on reveal; ConfidenceChip words untouched | build-gate | `cd frontend && npx tsc -b 2>&1 \| grep -cE 'error TS' && npx vite build` | n/a | ⬜ pending |
| 154-03-01 | 03 | 2 | LANG-01 | T-154-01 | Settings hosts "Show technical names" (every user flips the shared context); bounded relabels; tab `value` keys + expert config unchanged | build-gate | `cd frontend && npx tsc -b 2>&1 \| grep -cE 'error TS' && npx vite build` | n/a | ⬜ pending |
| 154-03-02 | 03 | 2 | LANG-01 | T-154-04 | Composer helpers additive (labels + enum calls intact); MessageItem/StreamsProvider UNTOUCHED (G-5) | unit (non-regression) | `cd frontend && npx vitest run src/components/chat/__tests__` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Phase gate (before `/gsd:verify-work`):** full `npx vitest run` green + `npm run build`
(tsc exactly 30 errors / 0 net-new, `vite build` exit 0) + the **Contract-Safety Recipe**
(154-RESEARCH.md §Contract-Safety Verification Recipe / D-05a): `git diff --name-only
<base>..HEAD` prints ZERO backend + ZERO `supabase/migrations/` files, and every changed
file is under `frontend/src/` or `.planning/`.

---

## Wave 0 Requirements

> New test files created in Wave 1 (Plan 01) before/with their production code (tdd tasks):

- [ ] `frontend/src/providers/__tests__/TechnicalNamesProvider.test.tsx` — default OFF, shared flip (two-toggles-agree, D-01a), persistence across remount, throws outside provider, optional-accessor null-outside.
- [ ] `frontend/src/lib/__tests__/termMap.test.tsx` — round-trip (plain when OFF / technical when ON), `technical` === today's shipped string (contract guard), unknown-key passthrough.
- [ ] Extend `frontend/src/__tests__/components/DocumentStatusBadge.test.tsx` (Wave 2, Plan 02) — plain-by-default + technical-on-reveal, styles enum-keyed unchanged.
- [ ] `ControlRoomPage.test.tsx` `renderPage()` wrapped in `<TechnicalNamesProvider>` (REQUIRED — else `useTechnicalNames()` throws in ~8 tests).
- [ ] No framework install needed — Vitest already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plain labels read naturally to a non-technical user across the relabeled surfaces | LANG-01 SC#1 | Copy quality is subjective (research flagged plain-label copy as `[ASSUMED]` A1) | Operator reads each relabeled surface with the toggle OFF; confirms no jargon leaks, no "plain" label is MORE confusing |
| The reveal flips the WHOLE app (not just one surface) and persists across reload | LANG-01 SC#3 | End-to-end cross-surface + persistence | Flip "Show technical names" in Settings → verify chat + documents + workflows + /admin all show technical vocab; reload → state persists |
| Deep Mode byte-identical | SC#2 | Backend-untouched proof | `git diff --name-only` shows ZERO backend files; no enum/const/API-key/audit-action rename |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned (2026-07-15) — populated by gsd-planner during plan-phase.
