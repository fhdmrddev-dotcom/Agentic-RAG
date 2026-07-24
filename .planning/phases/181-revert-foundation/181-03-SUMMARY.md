---
phase: 181-revert-foundation
plan: 03
subsystem: testing
tags: [scope-freeze, revert, byte-identical, ci-gate, feature-visibility, governance, uat, shell]

# Dependency graph
requires:
  - phase: 181-01 (revert-foundation, backend)
    provides: the visual_workflow_canvas "off" audience + require_canvas 404 gate + GET /features off-bypass + the backend test_revert_byte_identical acceptance gate — the automated half this plan re-confirms live
  - phase: 181-02 (revert-foundation, frontend)
    provides: GovernedFeature += visual_workflow_canvas / FeatureAudience += "off" + the reused-card Off|On operator control + the frontend revertByteIdentical nav-parity gate — the FE half this plan eyeballs live
provides:
  - "scripts/check-181-scope-freeze.sh — a reusable POSIX-sh scope-freeze guard (phase-diff AND milestone-close) that FAILS (exit 1, names each offender) if any of the 8 FROZEN paths — the two authoring doors (WorkflowDoorSwitch/WorkflowBuilderPage/WorkflowsPage), the developer run surface (PhaseTimeline/PhaseCard), or the harness engine (harness_engine.py / services/harness/ / models/harness.py) — appears in git diff --name-only BASE..HEAD (D-181-08)"
  - "The recorded D-181-07 observable byte-identity checklist (nav-item set + reachable-route set + responses + GET /features map + the two doors + the run surface — each unchanged vs today), corroborated live on the operator account"
  - "HARD gate #1 CLOSED: the full-suite D-181-06 differential (zero net-new failures both suites) + the scope-freeze OK + the operator live-close sign-off"
affects: [182-server-validation-seam, 183-read-only-canvas, 184-editable-canvas, every-later-v3.6-canvas-phase, v3.6-milestone-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The FROZEN-contracts scope-freeze technique (D-14 confirmed-absent-from-the-diff): assert a named file set is ABSENT from git diff --name-only BASE..HEAD, exit non-zero + name offenders on any hit — reusable at every phase diff AND at milestone-close with the SAME phase-start ref"
    - "Byte-identity verified OBSERVABLY, not by bundle hash (D-181-07): nav set + reachable-route set + /features map + the two doors + the run surface, cross-checked against the flag-off live app"
    - "Honest full-suite differential (NOT a raw 0-failures claim): the flag-off suite result is compared file-for-file against the documented phase-start baseline; the gate is 'zero NET-NEW failures', which tolerates the repo-wide pre-existing rot (SEED-049 / SEED-056 / 162.5 source-drift)"

key-files:
  created:
    - scripts/check-181-scope-freeze.sh
  modified: []

key-decisions:
  - "D-181-08: the two authoring doors + the developer run surface + the harness engine are frozen out of the ENTIRE 181 phase diff, proven by a committed reusable script (not prose) — re-runnable verbatim at v3.6 milestone-close with the same phase-start ref"
  - "D-181-06: the byte-identical gate rides the EXISTING backend-tests.yml (pytest tests -q) + frontend-tests.yml (npm test) — no new CI job; green == zero net-new failures vs the phase-start baseline, with the 181 suites themselves fully green"
  - "D-181-07: byte-identity is confirmed OBSERVABLY on the operator account (nav has no canvas entry, GET /features canvas=false even for the operator, Off|On flip round-trips + records named audit receipts, /canvas/ping 404s when off / 200s when on) — never a JS bundle hash"

patterns-established:
  - "Every later v3.6 phase re-runs scripts/check-181-scope-freeze.sh against its own phase-start ref to prove it never touched the frozen doors/run-surface/harness; the milestone-close re-runs it against the 181 phase-start ref"

requirements-completed: [REVERT-01, REVERT-02]

# Metrics
duration: ~30min
completed: 2026-07-24
---

# Phase 181 Plan 03: Revert Foundation (scope-freeze + operator live-close) Summary

**A committed, reusable `check-181-scope-freeze.sh` proving the two authoring doors + the developer run surface + the harness engine are ABSENT from the entire phase diff (D-181-08), an honest full-suite differential showing zero net-new failures with the flag off (D-181-06), and an operator live-close sign-off on the observable flag-off byte-identity + the Off|On flip (D-181-07) — HARD gate #1 CLOSED, zero migration / zero package.**

## Performance

- **Duration:** ~30 min (across the automated Task 1 + the operator live-close UAT)
- **Started:** 2026-07-24T15:58:00Z (approx, after the 181-02 close)
- **Task 1 committed:** 2026-07-24T16:16:17Z (`b92f4194`)
- **Operator sign-off:** 2026-07-24T16:26:26Z (the second audit receipt anchors it)
- **Completed:** 2026-07-24T16:28:00Z (approx)
- **Tasks:** 2 (1 auto + 1 blocking human-verify checkpoint — approved)
- **Files modified:** 1 (1 created)

## Accomplishments
- Shipped `scripts/check-181-scope-freeze.sh` (148 lines, POSIX sh, `set -euo pipefail`): takes the phase-start ref as `$1`, computes `git diff --name-only "$BASE"..HEAD`, and FAILS (exit 1, printing each offender) if ANY of the 8 FROZEN paths appears — `WorkflowDoorSwitch.tsx`, `WorkflowBuilderPage.tsx`, `WorkflowsPage.tsx`, `PhaseTimeline.tsx`, `PhaseCard.tsx`, `backend/app/services/harness_engine.py`, anything under `backend/app/services/harness/`, `backend/app/models/harness.py`. Clean diff prints `scope-freeze OK` and exits 0. Reusable at both the phase diff AND the v3.6 milestone-close (same ref).
- Verified the positive AND negative paths: the live phase diff prints `scope-freeze OK` (the doors/run-surface/harness are absent — D-181-08; no `supabase/migrations/*` and no `package.json`/`requirements.txt` delta — D-181-05); a self-test that injected a FROZEN path tripped the guard (exit non-zero, named offender) twice, then reverted clean.
- Ran the full D-181-06 gate honestly (not a raw 0-failures claim): the flag-off backend + frontend suites show **zero net-new failures** vs the documented phase-start baseline, and the 181-owned suites are fully green.
- Drove the operator live-close UAT (D-181-07) on the operator account and captured the observable byte-identity checklist verbatim; **operator approved** — HARD gate #1 is CLOSED.

## Task Commits

1. **Task 1: scripts/check-181-scope-freeze.sh + full-suite green (D-181-06/07/08)** — `b92f4194` (chore)
2. **Task 2: Operator live-close UAT (blocking human-verify)** — no commit (verification-only checkpoint; **operator approved**)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `scripts/check-181-scope-freeze.sh` — the reusable scope-freeze guard: `git diff --name-only "$BASE"..HEAD` matched against the 8 FROZEN paths; exit 1 + named offender on any hit, `scope-freeze OK` + exit 0 on a clean diff. House style follows `scripts/check-deploy-drift.sh` (non-zero-on-violation).

## D-181-07 Observable Byte-Identity Checklist (operator-observed, flag OFF)

The four points below were observed LIVE on the operator account (`fhdmrd@gmail.com`, local app) and are the recorded byte-identity evidence — NOT a bundle hash:

1. **Nav / doors / run surface unchanged.** Flag OFF (default): the primary nav shows NO "Visual workflow canvas" entry; the existing Workflows door + run surface present exactly as today. The scope-freeze corroborates the two authoring doors + the run surface + the harness engine are byte-identical (absent from the phase diff).
2. **`GET /features` hides canvas from everyone, operators included.** The operator-session `GET /features` (HTTP 200) returned `governance_health=true, model_management=true, skill_studio=true, workflow_authoring=true, visual_workflow_canvas=false` — off for the operator too (no phantom True; D-181-01 master-switch honored).
3. **The Off | On operator control (not the triad) + named audit receipts.** Control Room → Users & Access → Feature visibility: the "Visual workflow canvas" row renders a simple two-position **Off | On** control (NOT the Everyone / Operators-only / By-role triad the other four features show). The On→Off round-trip recorded two named receipts on `GET /admin/audit` — "Made visual_workflow_canvas visible to everyone" (16:25:57Z) and "Made visual_workflow_canvas visible to off" (16:26:26Z), both attributed to the operator.
4. **`/canvas/ping` 404-when-off, gate tracks the flag.** Authenticated `/canvas/ping` returned **404 when the flag is off** (200 when on), never 403 for an authenticated request (unauthenticated is 403 at the auth layer). Live gate-tracks-flag proof: flipping On made `/features` canvas=true + `/canvas/ping` 200; flipping Off reverted both to false + 404. The flag was left restored to Off (default).

## Full-Suite Differential (D-181-06 — honest, per documented repo rot)

Not a raw 0-failures claim — measured against the documented phase-start baseline; the gate is **zero net-new failures**:

- **Backend** (`pytest tests -q`): 201 failed + 1 error / 2958 passed — matches the phase-start baseline; **zero net-new**. The 181 backend suites are green (21 passed across `test_revert_byte_identical`, `test_181_off_audience`, `test_181_flip_on`, `test_148_effective_features`). The pre-existing failures are the documented repo-wide rot (SEED-049 e2e rot, SEED-056 vitest rot, 162.5 source-drift) in service-unit files the feature-visibility subsystem never touches.
- **Frontend** (`npm test` / `vitest run`): 31 failed / 1846 passed across 205 files — exact match to the Wave 2 baseline; **zero net-new**. The 181 frontend suites are green (20 passed across `revertByteIdentical`, `FeatureVisibility.a11y`, `ControlRoomPage`).

## Scope-Freeze Verification (D-181-08)

`bash scripts/check-181-scope-freeze.sh <phase-start-ref>` prints `scope-freeze OK` and exits 0 — none of the 8 FROZEN paths (`WorkflowDoorSwitch.tsx`, `WorkflowBuilderPage.tsx`, `WorkflowsPage.tsx`, `PhaseTimeline.tsx`, `PhaseCard.tsx`, `harness_engine.py`, `services/harness/`, `models/harness.py`) appear in the phase diff. The negative self-test (injecting a FROZEN path) tripped the guard twice — exit non-zero, offender named — then reverted clean. The diff also shows no `supabase/migrations/*` and no dependency-manifest change (D-181-05 corroboration: zero migration, zero package).

## Operator Sign-Off

**Operator approved** (`fhdmrd@gmail.com`, local app, 2026-07-24). Claude drove the four live checks on the operator's behalf; the operator confirmed all four hold ("approved") — the flag-off product is exactly today's, the Off|On flip works and records receipts, and the canvas route 404s when off. This is the human live-close verification for HARD gate #1 (REVERT-01/REVERT-02).

## Decisions Made
None beyond the plan — followed the locked D-181-06/07/08 decisions as specified. The scope-freeze script is a straight application of the standing D-14 "confirmed-absent-from-the-diff" technique; the observable byte-identity checklist + the full-suite differential are the D-181-06/07 evidence the plan called for.

## Deviations from Plan
None — plan executed exactly as written. Task 1 landed the reusable scope-freeze script and the honest full-suite differential; Task 2 (the blocking human-verify checkpoint) was operator-approved after Claude drove the live checks. No auto-fix deviations (Rules 1–4 did not fire).

## Issues Encountered
None. (The `gsd-sdk state.record-metric` / `state.add-decision` / `state.record-session` verbs remain unusable against this STATE schema — the documented verb-arg gap noted in the 181-02 SUMMARY; the durable decision/metric record lives in this SUMMARY's frontmatter, and the Current Position + progress block were hand-edited surgically.)

## Deferred Issues (out of scope — logged, NOT fixed)
The repo-wide pre-existing rot surfaced by the full-suite differential (201+1 backend / 31 frontend failures) is documented, unchanged, and untouched by Phase 181 — SEED-049 (e2e rot), SEED-056 (frontend-vitest rot), and Phase-162.5 source-drift in service-unit files the feature-visibility subsystem never imports. Phase 181 introduces **zero net-new failures** across all three plans.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- **HARD gate #1 is CLOSED.** The revert story is a TESTED acceptance gate: the backend + frontend `revert*`/`test_revert_byte_identical` suites ride the existing CI, the scope-freeze script is a committed reusable artifact, and the operator has confirmed the live flag-off product is byte-identical to today.
- **Phase 181 is COMPLETE (3/3 plans).** Every later v3.6 canvas phase inherits the tested off-switch (attach `Depends(require_canvas())` + append a "404 when off" probe to `test_revert_byte_identical.py`; tag any new `NAV_ITEMS` canvas entry with `feature: "visual_workflow_canvas"`).
- **Milestone-close** re-runs `scripts/check-181-scope-freeze.sh` against the 181 phase-start ref to re-prove the doors/run-surface/harness were never touched across the whole milestone.
- **Next: Phase 182 (Server Validation Seam, VALID-01)** — backend-only reuse of `reachability.lint_workflow`, flag-gated 404 inheriting this off-switch; `/gsd:plan-phase 182`.

## Self-Check: PASSED
- Created file exists on disk: `scripts/check-181-scope-freeze.sh`.
- Task 1 commit exists in git history: `b92f4194` (chore).
- Prior plan tips exist: `06069c5c` (181-01 docs), `c60cd006` (181-02 docs).
- REVERT-01 / REVERT-02 already marked Complete in REQUIREMENTS.md (Plan 01 — verified, not double-marked).

---
*Phase: 181-revert-foundation*
*Completed: 2026-07-24*
