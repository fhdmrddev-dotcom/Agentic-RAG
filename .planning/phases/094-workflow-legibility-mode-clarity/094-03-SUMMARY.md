---
phase: 094-workflow-legibility-mode-clarity
plan: 03
subsystem: ui
tags: [react, panel, harness, phase-timeline, a11y, vitest-axe, apg-accordion, panel-08, a11y-03, rc-4]

# Dependency graph
requires:
  - phase: 094-01-token-wave0-scaffolds
    provides: "the --accent-violet token (now consumed by the retrying glyph + llm_batch_agents left-border) + the RED PhaseTimeline/FailReason/PhaseReconcile scaffolds flipped GREEN here + the shared harness094.ts fixtures"
  - phase: 094-02-phase-demux
    provides: "the usePhases(threadId) selector + the phasesByThread slice + the reconcilePhases reconcile-floor adapter this plan renders over; useTasks for the sub-agent tally"
  - phase: 087-agent-workspace-panel
    provides: "WorkspacePanel mount + PanelSection + PendingAskCard a11y/plain-text-children precedent + panelOpenSignal (requestOpenPanel/subscribeOpenPanel seam) + the --panel-status-* tokens"
provides:
  - "PhaseCard — an APG-accordion phase row: non-color-only status atoms (glyph + REAL text + AA color token), the closed failure taxonomy (max_steps/gate_failed/wall_clock_timeout/reason_unknown) rendered VERBATIM in a separate role=alert, the retrying purple + llm_batch_agents accent from --accent-violet, suppressed per-phase counts, plain-text children (XSS guard)"
  - "PhaseTimeline — section[aria-label=Workflow run timeline] + ol/li of PhaseCards, the reconcile-then-live N-row skeleton (spinner-killer), the forward-only Phase i/N counter (never regresses), ONE polite role=status announcer (present at load, written only on transition edges, throttled), aria-busy flip on terminal, suppressed counts"
  - "WorkspacePanel 5th 'Workflow' section mount (gated on harness lock OR phases exist) + hasActivity extension"
  - "PANEL-08 auto-open: requestOpenPanel() fired at the ChatArea harness kickoff (harness-branch only)"
  - "replayHarness.tsx test helper — replays the DATA-CONTRACT §7 wire fixtures through the REAL subscribeToRun normalizer into a derived Phase[] (single source of truth for the render tests)"
  - "vitest-axe.d.ts — vitest Assertion type augmentation for toHaveNoViolations (resolves the documented baseline matcher-type gap)"
affects: [094-05-surfacing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "APG accordion phase card: <h3> wrapping one <button aria-expanded aria-controls>, body role=region aria-labelledby hidden-when-collapsed, forced-open running phase aria-disabled (button stays). Mirrors PanelSection + PendingAskCard a11y chrome."
    - "Non-color-only status atom: aria-hidden glyph + REAL visible text label + an AA-contrast color token (NEVER --muted-foreground-dim for meaningful text). Status text uses --panel-status-* / lightened tokens ≥4.5:1; the retrying/batch purple is --accent-violet (≥3:1 graphic)."
    - "UI-derived failure taxonomy: classify over gate_failed.error + which event fired (no typed failure_kind on the wire); render the VERBATIM closed-taxonomy reason + the real where-line components only (omit model/sub-agent-index/step-ratio — sub-stream); reason_unknown is the mandatory empty-error sentinel."
    - "Reconcile-then-live forward-only counter: derive the Phase i/N from the slice (skeleton length = total_phases; active-row index), clamp the rendered ordinal to a running max via a ref so a regressing live event never moves it backward (reconcile is the floor)."
    - "Throttled sr-only announcer: ONE role=status aria-live=polite region present at load, written ONLY when the active-phase (index, status) edge moves (a last-edge ref dedupes) — never per render/token; failures go through PhaseCard's SEPARATE role=alert."
    - "Render-test replay: replay the shared wire fixtures through the REAL subscribeToRun + demux into the store, then render the component over the real usePhases/useTasks selectors — exercises the live wire→Phase[]→render pipeline (not a stub)."

key-files:
  created:
    - frontend/src/components/panel/PhaseCard.tsx
    - frontend/src/components/panel/PhaseTimeline.tsx
    - frontend/src/components/panel/__tests__/replayHarness.tsx
    - frontend/src/vitest-axe.d.ts
  modified:
    - frontend/src/components/panel/WorkspacePanel.tsx
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/panel/__tests__/FailReason.test.tsx
    - frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx
    - frontend/src/components/panel/__tests__/PhaseReconcile.test.tsx
    - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx

key-decisions:
  - "The honest Phase i/N counter + reconcile floor derive from the phasesByThread SLICE (its skeleton length = total_phases, the running-row index = current), NOT from a fresh getThreadWorkflow each render — the slice already encodes the reconcile floor (Plan 02), so forward-only is structural; getThreadWorkflow is fetched once for the header name + the terminal run_status (aria-busy)."
  - "PhaseCard takes `phase` as a prop (no provider hook) so FailReason.test.tsx renders it directly with a derived failed phase; PhaseTimeline owns the provider reads. Clean separation = the failure render is unit-testable without mounting the timeline."
  - "Render tests replay the wire fixtures through the REAL normalizer (replayHarness) rather than hand-rolling Phase[] — keeps the DATA-CONTRACT §7 fixtures the single source of truth while testing the renderer's a11y."
  - "vitest-axe.d.ts (NEW, additive) augments vitest's Assertion with toHaveNoViolations — a Rule-3 build-config fix for the documented baseline matcher-type gap; it cleared the 6 net-new INV-2 axe assertions AND ~17 pre-existing baseline instances (tsc 54→37)."

patterns-established:
  - "PANEL-08 auto-open: requestOpenPanel() at the harness-kickoff send branch (if kickoffWorkflowId) only — a Deep send never forces the panel; the ChatLayout expand seam was already subscribed."
  - "The timeline section mounts as the 5th WorkspacePanel section gated on (server-truth workflow lock present) OR (phases.length>0); a Deep / no-run thread keeps the calm PanelEmpty short-circuit."

requirements-completed: [PANEL-08, A11Y-03]

# Metrics
duration: 14min
completed: 2026-06-04
---

# Phase 094 Plan 03: Live Phase-Timeline Render (PANEL-08 / A11Y-03) Summary

**Rendered the operator's #1 acceptance bar — the REAL workflow phase spine, not a spinner — as `PhaseCard` (APG-accordion, non-color-only status, verbatim closed-taxonomy failure + reason_unknown sentinel in a role=alert, retrying purple from `--accent-violet`, suppressed counts) + `PhaseTimeline` (reconcile-then-live N-row skeleton, forward-only Phase i/N counter, one throttled polite announcer, aria-busy flip), mounted as the 5th WorkspacePanel section with PANEL-08 auto-open at harness kickoff — flipping PhaseTimeline/FailReason/PhaseReconcile GREEN (INV-2/3b/4, vitest-axe zero violations in every state).**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-04T19:10:11Z
- **Completed:** 2026-06-04T19:24:14Z
- **Tasks:** 3
- **Files modified:** 10 (4 created + 6 modified)

## Accomplishments

- **PhaseCard** renders ONE harness phase as an APG accordion: `<h3>`>`<button aria-expanded aria-controls>`, body `role="region" aria-labelledby` hidden-when-collapsed, the forced-open running phase `aria-disabled="true"` (button stays). The status atom is non-color-only — an `aria-hidden` glyph + REAL text label + an AA-contrast color token (status text uses `--panel-status-*` / lightened tokens ≥4.5:1, never `--muted-foreground-dim`). Running carries an indeterminate `role="progressbar"` (no `aria-valuenow`). The closed failure taxonomy (`max_steps`/`gate_failed`/`wall_clock_timeout`/`reason_unknown`) renders VERBATIM in a SEPARATE `role="alert"`; `reason_unknown` is the mandatory empty-error sentinel ("Failure reason not captured by the backend…"), never an empty red card. The retrying glyph + `llm_batch_agents` left-border use `--accent-violet` (Plan 01's token, now resolves). All agent text renders as plain React children — no raw-HTML prop (T-094-03-01 XSS guard).
- **PhaseTimeline** renders `<section aria-label="Workflow run timeline">` + the honest "Phase i / N" chip + a `<ol aria-label="Phases">`/`<li>` of PhaseCards. The full N-row skeleton derives from the reconcile-seeded slice (`total_phases` rows — the spinner-killer); the counter clamps to a running floor so a regressing live event never moves it backward (INV-4). ONE `role="status" aria-live="polite"` visually-hidden announcer is present at load, written ONLY on transition edges (a last-edge ref throttles — never per-token). `aria-busy` on the list flips false at a terminal run_status. Counts are SUPPRESSED-don't-fake (D-03): only `phases.length`, "Phase i/N", and the `sub_agent_start` tally render — no per-phase tool/search/source chip.
- **WorkspacePanel** mounts the 5th "Workflow" section gated on the server-truth workflow lock OR `phases.length>0`; `hasActivity` now includes `phases.length`. **ChatArea** fires `requestOpenPanel()` ONLY inside the harness kickoff branch — entering Harness Mode auto-opens the panel to the timeline (PANEL-08), a Deep send never forces it. No chat hot-file (ToolCallPanel/MessageItem/StreamsProvider) was touched.
- **INV-2/3b/4 GREEN** — PhaseTimeline/FailReason/PhaseReconcile = 12/12 passing; vitest-axe zero violations across `fxRunRunning`/`fxRunFailed`/`fxRunDone`/`fxRunAskuserPaused`/`fxRunGatefailRetry` with 1-phase and N-phase; the failure-not-done + reason_unknown sentinel proven against the RC-4 wrong-`done` fixtures; the forward-only counter proven against a regressing replay.

## Task Commits

Each task was committed atomically (sequential on `v2.5-dev`, normal commits WITH hooks):

1. **Task 1: PhaseCard (APG accordion, failure taxonomy, reason_unknown sentinel, retrying purple) + FailReason INV-3b GREEN** — `ef81befb` (feat)
2. **Task 2: PhaseTimeline (reconcile skeleton, forward-only counter, announcer, aria-busy) + PhaseTimeline INV-2 + PhaseReconcile INV-4 GREEN** — `f4159e5b` (feat)
3. **Task 3: WorkspacePanel timeline mount + ChatArea PANEL-08 auto-open + WorkspacePanel test + vitest-axe.d.ts** — `de396404` (feat)

**Plan metadata:** (final docs commit — this SUMMARY + STATE + ROADMAP + REQUIREMENTS)

_Note: Tasks 1/2 are `tdd="true"`. Per the `type: execute` convention, each flips the Plan-01 Wave-0 RED scaffold (`it.todo`) GREEN as the component lands — the test was authored RED in Plan 01, made live here; no discrete `test(...)` RED commit, the suites run at the end of each task._

## Files Created/Modified

- `frontend/src/components/panel/PhaseCard.tsx` (CREATED) — the APG-accordion phase row: `PHASE_TYPE_LABEL` (5 literals + UNKNOWN→"Step"), `STATUS_META` (glyph + text + AA color), `classifyFailure` (closed taxonomy + verbatim copy + real-only where-line + reason_unknown sentinel), the sub-agent child rows, the role=alert failure block, the suppressed-counts rule.
- `frontend/src/components/panel/PhaseTimeline.tsx` (CREATED) — the section/ol/li timeline, the reconcile-floor counter (forward-only clamp), the throttled polite announcer, the aria-busy flip, the doing-now narration, the getThreadWorkflow header-frame fetch.
- `frontend/src/components/panel/__tests__/replayHarness.tsx` (CREATED) — the fixture→REAL-normalizer→Phase[] replay helper (single source of truth) + `seedReconcileFloor` + `resetStore`.
- `frontend/src/vitest-axe.d.ts` (CREATED) — the vitest `Assertion` `toHaveNoViolations` type augmentation (baseline matcher-type gap fix).
- `frontend/src/components/panel/WorkspacePanel.tsx` (MODIFIED) — `usePhases` + `useWorkflowLockForThread` reads, `hasActivity` + `phases.length`, the 5th "Workflow" `PanelSection` mounting `PhaseTimeline` (gated on harness lock OR phases).
- `frontend/src/components/chat/ChatArea.tsx` (MODIFIED) — `requestOpenPanel()` at the harness kickoff branch (import + the harness-only call).
- `frontend/src/components/panel/__tests__/FailReason.test.tsx` (MODIFIED) — flipped INV-3b RED→GREEN (replay the RC-4 fixtures, render PhaseCard, assert FAILED-not-done + sentinel).
- `frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx` (MODIFIED) — flipped INV-2 RED→GREEN (axe all states + announcer-present + aria-expanded toggle + aria-busy flip via the replay path).
- `frontend/src/components/panel/__tests__/PhaseReconcile.test.tsx` (MODIFIED) — flipped INV-4 RED→GREEN (3-row skeleton from total_phases; regressing event never moves the counter back).
- `frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx` (MODIFIED) — added `usePhases`/`useWorkflowLockForThread` to the provider mock + stubbed `PhaseTimeline` + 3 timeline-mount tests (harness-lock / phases-exist / Deep-no-mount).

## Decisions Made

- **Counter derives from the slice, not a per-render fetch** — `phasesByThread` already carries the reconcile-floor skeleton (Plan 02: `total_phases` rows, current running). So `total = phases.length` and the active-row index drive the honest "Phase i/N", and forward-only is structural (the slice never regresses; a ref clamp adds belt-and-braces). `getThreadWorkflow` is fetched once only for the header `definition_name` + the terminal `run_status` (aria-busy).
- **PhaseCard is prop-driven (no provider hook)** so the failure render is unit-testable directly (FailReason renders `<PhaseCard phase={derivedFailed} />`); PhaseTimeline owns the `usePhases`/`useTasks` reads.
- **Render tests replay the wire fixtures through the REAL normalizer** (replayHarness) rather than hand-authoring `Phase[]` — keeps the DATA-CONTRACT §7 fixtures the single source of truth while exercising the renderer's a11y.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest-axe `toHaveNoViolations` matcher type gap (net-new tsc errors)**
- **Found during:** Task 3 (the `npm run build` / `tsc -b` acceptance check)
- **Issue:** The 6 new INV-2 `expect(await axe(container)).toHaveNoViolations()` assertions raised TS2339 ("Property 'toHaveNoViolations' does not exist on type 'Assertion<AxeResults>'") — pushing `tsc -b` from the documented 54-error baseline to 60 (+6 net-new). vitest-axe ships an `extend-expect.d.ts` that augments only the legacy `Vi.Assertion` namespace, which vitest 4.x no longer routes matcher types through, so the matcher is registered at runtime (`setupTests.ts`) but invisible to the type checker — the same gap that lives in the 54 baseline (PendingAskCard/WorkspacePanel axe tests).
- **Fix:** Added `frontend/src/vitest-axe.d.ts` (NEW, additive — no baseline file touched) augmenting the `vitest` module's `Assertion` + `AsymmetricMatchersContaining` with vitest-axe's `AxeMatchers`. This made the runtime-registered matcher type-visible.
- **Files modified:** `frontend/src/vitest-axe.d.ts` (created)
- **Verification:** `tsc -b` dropped **54→37** — it cleared my 6 net-new AND ~17 pre-existing baseline `toHaveNoViolations` instances; zero remaining errors in any of this plan's files; `npx vite build` clean.
- **Committed in:** `de396404` (Task 3 commit)

**2. [Rule 1 - Bug] WorkspacePanel.test.tsx provider mock missing the two new hooks**
- **Found during:** Task 3 (running the panel regression suite)
- **Issue:** WorkspacePanel now reads `usePhases` + `useWorkflowLockForThread`, but the pre-existing `WorkspacePanel.test.tsx` `vi.mock("@/providers/StreamsProvider")` only exported the four prior hooks → the two new reads returned `undefined`, crashing all 17 tests in that file.
- **Fix:** Added `usePhases`/`useWorkflowLockForThread` to the test's provider mock (defaulting to empty phases + null lock so the existing Todos/Files/Versions assertions are unaffected), stubbed the heavy `PhaseTimeline` child to a sentinel, and added 3 timeline-mount tests (harness-lock / phases-exist / Deep-no-mount).
- **Files modified:** `frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx`
- **Verification:** WorkspacePanel.test.tsx 20/20 GREEN (17 prior + 3 new); the full panel+provider suite 122/122 GREEN (no regression).
- **Committed in:** `de396404` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking build-config, 1 bug)
**Impact on plan:** Both auto-fixes were necessary for the plan's own acceptance (tsc-net-zero + no-regression). The vitest-axe augmentation is net-NEGATIVE on the type baseline (a bonus baseline reduction). No scope creep — no chat hot-file touched, the timeline mount/auto-open stayed exactly as scoped.

## Issues Encountered

- **`tsc -b` does not exit 0 — documented pre-existing baseline, now REDUCED to 37 (was 54), ZERO net-new attributable to this plan.** Confirmed: zero `error TS` lines reference any of this plan's files; `npx vite build` is clean (only the pre-existing chunk-size + dynamic-import warnings). The vitest-axe.d.ts augmentation cut the baseline by ~17 (the matcher-type instances across the test suite).
- **An async `getThreadWorkflow` re-render raced one userEvent click** in the aria-expanded toggle test (PhaseCard's local `open` persists, but the timeline re-render flagged a not-wrapped-in-act warning). Resolved by settling the async frame (`await screen.findByText("Phase 3 / 3")`) before the click — deterministic, no production change.
- **`vitest --reporter=basic` errors with `ERR_LOAD_URL`** (the vitest 4.1.0 quirk noted in Plan 01) — ran the default reporter instead; all suites collect + pass cleanly.

## Known Stubs

None that block the plan's goal. Two intentional, contract-correct emptinesses:
- **`phase.subAgents` is empty in the live path** — Plan 02's demux associates `sub_agent_start`/`done` rows into `tasksByThread` (the thread-level slice), not into `phase.subAgents`. PhaseTimeline therefore shows the aggregate `{n} agents` tally from `useTasks` (the real client tally, per DATA-CONTRACT §5.4), and PhaseCard's per-phase child rows render only when `phase.subAgents.length>0` (no crash, no fake). Per-phase sub-agent association is a future enhancement (would need the demux to thread sub_agent rows onto the active phase); the aggregate tally is the honest, in-contract count today.
- **`reconcilePhases` skeleton rows carry `phaseType: "unknown"`** until live `phase_started` fills the real type — handled by PhaseCard's UNKNOWN→"Step" generic row (DATA-CONTRACT §2), never a crash.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary. The timeline reads only the panel-only `usePhases`/`useTasks` slices (Plan 02 PANEL-09 isolation) and one existing GET (`getThreadWorkflow`); all agent text renders as plain React children (the T-094-03-01 XSS mitigation is implemented and grep-proven).

## Next Phase Readiness

- **Plan 05** can read `usePhases`/`useTasks` for the unified-surface count-strip / receipt + layer the mode label onto `ChatArea.tsx` (this plan kept its ChatArea edit scoped to the panel-open seam so 05 layers cleanly). The PhaseTimeline + PhaseCard render surface is the legibility substrate the surfacing plan composes.
- A11Y-03 is CLOSED here (vitest-axe zero violations in every state — pending/running/done/failed/retrying + 1-phase/N-phase). The remaining a11y check is the manual VALIDATION.md Chrome-MCP both-themes real-contrast pass (status/title ≥4.5:1, --accent-violet graphic ≥3:1).
- No blockers.

---

## Self-Check: PASSED

All 4 created files + 2 modified source files + the SUMMARY verified present on disk; all 3 task commits (`ef81befb`, `f4159e5b`, `de396404`) verified in git history.

---
*Phase: 094-workflow-legibility-mode-clarity*
*Completed: 2026-06-04*
