---
phase: 094-workflow-legibility-mode-clarity
plan: 01
subsystem: ui
tags: [tailwind, css-tokens, vitest, vitest-axe, pytest, harness, sse-fixtures, design-token, a11y]

# Dependency graph
requires:
  - phase: 093-harness-cross-provider-parity
    provides: "the fixed per-phase harness SSE event-shape contract (phase_started/_completed/_transition + ask_user_prompt.draft + sources/citations/confidence + run_completed) that the §7 fixtures replay verbatim"
  - phase: 087-agent-workspace-panel
    provides: "the --panel-status-* token convention + the panelHooks/PendingAskCard test patterns mirrored here"
provides:
  - "--accent-violet design token in both index.css theme blocks (light 258 80% 40%, dark 258 90% 66%) + the Tailwind accent-violet utility — resolves BEFORE any purple surface renders (D-05 Build-Prerequisite A)"
  - "frontend/src/test-fixtures/harness094.ts — the shared DATA-CONTRACT §7 wire fixtures module (single source of truth Plans 02/03/05 import)"
  - "5 Wave 0 RED test scaffolds (4 frontend it.todo + 1 backend pytest.mark.skip) seeding INV-1..5 + INV-3a, each naming its downstream owner plan"
affects: [094-02-phase-demux, 094-03-timeline-render, 094-04-rc4-backend-persist, 094-05-surfacing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DATA-CONTRACT §7 fixtures as a shared replayable string[] module (wire() helper emits the exact FLAT _emit SSE frame) — no test re-hand-rolls a wire payload"
    - "Wave 0 RED scaffold convention extended to harness: it.todo (frontend) / pytest.mark.skip (backend) placeholders that COLLECT but don't execute, each naming its owner plan"

key-files:
  created:
    - frontend/src/test-fixtures/harness094.ts
    - frontend/src/providers/__tests__/phaseHooks.test.tsx
    - frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx
    - frontend/src/components/panel/__tests__/FailReason.test.tsx
    - frontend/src/components/panel/__tests__/PhaseReconcile.test.tsx
    - backend/tests/test_094_rc4_failure.py
  modified:
    - frontend/src/index.css
    - frontend/tailwind.config.js

key-decisions:
  - "--accent-violet token lands FIRST (D-05) so var(--accent-violet) never resolves to nothing (Pitfall 3); no component renders text-/border-accent-violet yet (Plan 03 owns the retrying/batch surfaces)"
  - "fixtures emit FLAT producer wire fields (phase, phase_index, phase_type, attempt, error, reason, from_phase, to_phase, via, status) — NOT nested — matching the real _emit shape so a test exercises the REAL subscribeToRun normalizer"
  - "scaffolds are it.todo/skip (collect-not-pass) — production wiring (phasesByThread slice, PhaseTimeline, _surface_failure_message) does not exist yet; importing it would break collection, so the harness/imports land with the implementation plan"

patterns-established:
  - "Shared harness SSE fixtures module — Plans 02/03/05 import fxPhase*/fxRun* + reconcile seeds instead of re-authoring wire frames"
  - "Per-run-state fixtures export BOTH the live string[] AND a HarnessReconcileSeed (ThreadWorkflowState shape) so reconcile-floor tests have the mount payload"

requirements-completed: []  # A11Y-03 is SEEDED here (the INV-2 vitest-axe scaffold, it.todo) but CLOSED by Plan 03 (its true closing plan — the PhaseTimeline component that passes the axe gate). Also claimed by 094-03; stays Pending until 094-03 lands. Not marked complete here to avoid overstating a scaffold.

# Metrics
duration: 5min
completed: 2026-06-04
---

# Phase 094 Plan 01: Token + Wave 0 Scaffolds Summary

**Landed the `--accent-violet` design token in both theme blocks + the Tailwind theme (D-05, FIRST), authored the shared DATA-CONTRACT §7 harness wire-fixtures module, and scaffolded the 5 Wave 0 RED tests (INV-1..5 + INV-3a) that gate Plans 02/03/04/05.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-04T18:28:29Z
- **Completed:** 2026-06-04T18:33:15Z
- **Tasks:** 3
- **Files modified:** 8 (2 config modified + 6 created)

## Accomplishments

- `--accent-violet` resolves to a real color in BOTH themes before any purple surface renders — light `258 80% 40%` (#4514b8, 8.52:1 on light panel surface), dark `258 90% 66%` (#895af6, 4.35:1 graphic ≥3:1 on dark panel surface), HSL channels with no `hsl()` wrapper + verification comments matching the `--panel-status-*` convention; registered as the `accent-violet` Tailwind utility. No component renders the token yet (Plan 03 owns the `retrying` glyph + `llm_batch_agents` left-border).
- `frontend/src/test-fixtures/harness094.ts` — the single-source-of-truth wire fixtures module: 5 per-phase-type fixtures (programmatic / llm_single / llm_agent / llm_batch_agents / llm_human_input) + 6 per-run-state fixtures (running / gatefail-retry + wall-clock variant / failed + reason-unknown variant / askuser-paused / done), each a flat `string[]` of `data: <JSON>` frames matching the exact FLAT `_emit` producer shape; per-run-state fixtures also export a `reconcileSeed` (ThreadWorkflowState shape).
- 5 Wave 0 RED scaffolds collect cleanly and seed every falsifiable invariant: INV-1 (PANEL-09 reference-identity) + INV-5 (cross-thread isolation) → Plan 02; INV-2 (axe across states) + INV-3b (RC-4 frontend: failed-not-done + reason_unknown sentinel) + INV-4 (reconcile-floor forward-only counter) → Plan 03; INV-3a (RC-4 backend: persist failure message at BOTH failure-return sites + empty-reason sentinel + `_shielded_finalize` untouched) → Plan 04.

## Task Commits

Each task was committed atomically (sequential on `v2.5-dev`, normal commits WITH hooks):

1. **Task 1: Add the --accent-violet token to both theme blocks + Tailwind (D-05, FIRST)** — `b24f1e85` (feat)
2. **Task 2: Create the shared DATA-CONTRACT section 7 fixtures module** — `e25d15c9` (test)
3. **Task 3: Scaffold the 5 Wave 0 RED test files (frontend + backend)** — `7b271a59` (test)

**Plan metadata:** (final docs commit — this SUMMARY + STATE + ROADMAP)

## Files Created/Modified

- `frontend/src/index.css` (MODIFIED) — `--accent-violet` in the `:root` (light) and `.dark` blocks, HSL channels + verification comments.
- `frontend/tailwind.config.js` (MODIFIED) — `"accent-violet": "hsl(var(--accent-violet))"` under `theme.extend.colors`.
- `frontend/src/test-fixtures/harness094.ts` (CREATED) — shared §7 wire fixtures + `wire()` helper + `HarnessReconcileSeed` shape + reconcile seeds.
- `frontend/src/providers/__tests__/phaseHooks.test.tsx` (CREATED) — INV-1 + INV-5 it.todo (owner Plan 02).
- `frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx` (CREATED) — INV-2 axe + a11y gates it.todo (owner Plan 03).
- `frontend/src/components/panel/__tests__/FailReason.test.tsx` (CREATED) — INV-3b it.todo (owner Plan 03).
- `frontend/src/components/panel/__tests__/PhaseReconcile.test.tsx` (CREATED) — INV-4 it.todo (owner Plan 03).
- `backend/tests/test_094_rc4_failure.py` (CREATED) — INV-3a 4 skip-marked tests (owner Plan 04).

## Decisions Made

- **Token first, no surface yet** — landed `--accent-violet` before any consumer so `var(--accent-violet)` never resolves to transparent (Pitfall 3 / D-05 BINDING). Verified `grep -rn "text-accent-violet|border-accent-violet|var(--accent-violet)" frontend/src/components frontend/src/providers` = 0.
- **Fixtures emit FLAT fields** matching the real `_emit` wire (not nested), so Plans 02/03/05 replay them through the REAL `subscribeToRun` line parser — exercising the actual normalizer rather than a stubbed callback.
- **Scaffolds collect-not-pass** — used `it.todo` (frontend) / `pytest.mark.skip` (backend) because the production targets (`phasesByThread` slice, `PhaseTimeline`, `_surface_failure_message`) don't exist yet; importing them would break collection. The full panelHooks-style harness + the fixture imports land with each implementation plan.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1–4 triggers; all three tasks landed verbatim against the PATTERNS/DATA-CONTRACT anchors.

## Issues Encountered

- **`npm run build` does not exit 0 — but this is a documented pre-existing 54-error tsc baseline, NOT a regression.** The plan's Task-1/Task-2 acceptance lists "`npm run build` exits 0". The repo carries a fixed 54-error `tsc -b` baseline (referenced repeatedly in STATE.md, e.g. 093-05 "tsc 54 baseline 0 net-new") across unrelated files (Seam.test.tsx, SettingsPage.tsx, SkillFormDialog.tsx, streamsStore.ts, the vitest-axe `toHaveNoViolations` matcher type, etc. — all out of this plan's scope). Proof of zero net-new: stashing this plan's `index.css`/`tailwind.config.js` and re-running `tsc -b` returns the SAME 54; adding `harness094.ts` returns the SAME 54 (0 attributable). The load-bearing intent of the criterion (Tailwind rebuilds the utility + CSS compiles + the new module type-checks) was verified directly: **`npx vite build` succeeds cleanly** (only chunk-size warnings), proving the token resolves and the CSS compiles. Per the SCOPE BOUNDARY + FIX ATTEMPT rules, the pre-existing baseline errors were NOT touched.
- **Backend pytest must run under the `venv`** (CLAUDE.md rule). Bare `python` lacked `pydantic_settings`; `./venv/Scripts/python.exe -m pytest ... --collect-only` collects the 4 scaffold tests with 0 collection errors.
- **`vitest --reporter=basic` fails to load the reporter** (a vitest 4.1.0 quirk — the `basic` reporter URL errors with `ERR_LOAD_URL`); the default reporter runs fine — 4 files / 14 todo / 0 errors. Not a scaffold problem.

## Verification

- `grep -c "accent-violet" frontend/src/index.css` = **4** (≥2) · `grep -c "accent-violet" frontend/tailwind.config.js` = **2** (≥1) · light `258 80% 40%` + dark `258 90% 66%` present (no `hsl()` wrapper).
- `npx vite build` — **clean** (token resolves, fixtures type-check); `tsc -b` = 54 (pre-existing baseline, **0 net-new** attributable to this plan).
- `grep -c "export const fx" harness094.ts` = **16** (≥10) · `grep -c "phase_type"` = **16** (5 literals present) · verbatim `wall_clock_timeout after 600s` present · empty-reason `fxRunFailedReasonUnknown` (`reason: ""`) present.
- 4 frontend scaffolds collect under vitest: **4 files / 14 it.todo / 0 errors**; `it.todo` total across the 4 = **19** (≥5).
- `backend/tests/test_094_rc4_failure.py` collects under pytest (venv): **4 tests, 0 collection errors**.
- All 5 scaffolds name their downstream owner plan (`grep "owner: Plan"` finds all 5: 02 / 03 / 03 / 03 / 04).
- **No production component renders the token yet** (Plan 03 owns) — grep = 0.

## Known Stubs

None that block the plan's goal. The 5 RED scaffolds are INTENTIONAL Wave 0 placeholders (`it.todo` / `pytest.mark.skip`) — they are the explicit deliverable of this plan (downstream plans flip them GREEN), not unwired data stubs. The token has no consumer yet by design (D-05 sequencing — Plan 03 wires the `retrying`/`batch` surfaces).

## Next Phase Readiness

- **Plan 02** can build `phasesByThread` slice + `onPhase*` demux + `getThreadWorkflow` reconcile against `phaseHooks.test.tsx` (INV-1/INV-5) and the `fxPhase*` fixtures.
- **Plan 03** can build `PhaseTimeline`/`PhaseCard` against `PhaseTimeline`/`FailReason`/`PhaseReconcile` (INV-2/3b/4) + the `fxRun*` fixtures, and may now use `text-accent-violet`/`border-accent-violet` (token resolves).
- **Plan 04** can build `_surface_failure_message` against `test_094_rc4_failure.py` (INV-3a) at both failure-return sites.
- No blockers. The token + fixtures + scaffolds are the Wave 0 gate the implementation plans depend on.

---

## Self-Check: PASSED

All 7 created files verified present on disk; all 3 task commits (`b24f1e85`, `e25d15c9`, `7b271a59`) verified in git history.

---
*Phase: 094-workflow-legibility-mode-clarity*
*Completed: 2026-06-04*
