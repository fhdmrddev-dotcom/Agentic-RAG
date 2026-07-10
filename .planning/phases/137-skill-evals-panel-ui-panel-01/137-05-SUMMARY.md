---
phase: 137-skill-evals-panel-ui-panel-01
plan: 05
subsystem: ui
tags: [react, vitest, skill-evals, sse, eval-runner, self-improvement, panel-01]

# Dependency graph
requires:
  - phase: 137-01
    provides: LifecycleStepper (shared 054-B status stepper — full variant)
  - phase: 137-03
    provides: RunBar + RunHistory + RunCaseDetail (055-B expandable run rows, prompt-first per-case detail)
  - phase: 137-04
    provides: ProposalCard (135 propose→approve→promote lifecycle, render-only, handlers injected)
  - phase: 133/134/135
    provides: SkillEvalSection machinery (run/SSE/self-heal/durable readout/proposal handlers) — lifted verbatim
provides:
  - "CaseEditor — prompt-first test-case CRUD leaf that lifts its full loaded list up via onCasesChanged"
  - "EvalsTab — the stateful Evals-tab container that lifts the run/SSE/proposal/gate machinery, owns the case list, and composes the four Wave-1 leaves"
affects: [137-06, 137-07, skill-studio, SkillStudio tab shell, PANEL-01 verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lift state, re-skin render (D-15): the battle-tested SkillEvalSection run/SSE/reconcile machinery is transcribed verbatim in logic into EvalsTab; only the render is re-skinned by composing leaves"
    - "Single-source case list: CaseEditor is the sole listTestCases fetcher; it lifts the full TestCase[] up via onCasesChanged; EvalsTab derives caseCount (stepper) + casesById (run history) from that one list"
    - "Single-run readout bridged to a multi-run history: EvalsTab merges the lifted evalRun/results into a runsForHistory feed (+ a synthesized top row for a live run) and loads a run's durable readout on expand"

key-files:
  created:
    - frontend/src/components/skills/studio/CaseEditor.tsx
    - frontend/src/components/skills/studio/CaseEditor.test.tsx
    - frontend/src/components/skills/studio/EvalsTab.tsx
    - frontend/src/components/skills/studio/EvalsTab.test.tsx
  modified: []

key-decisions:
  - "RunHistory.onRerun (interrupted eval-RUN re-run) wired to handleRun (start a fresh eval run), NOT the plan's literal handleRerun (which is the proposal RE-EVAL rerun) — the two rerun concepts are distinct; ProposalCard.onRerun stays wired to handleRerun"
  - "handleRate signature adapted to the leaf contract (resultId, choice|null) because RunCaseDetail owns the thumbs toggle; the endpoint-then-refetch flow (rateEvalResult THEN loadReadout) is preserved verbatim"
  - "provider/model hydrated with a functional updater that only sets when empty, so a manual picker selection persists across skills (D-12) — SkillEvalSection reset it on every switch"

patterns-established:
  - "Container owns the leaves' state; leaves are pure/controlled and receive lifted handlers as props"
  - "casesById threaded end-to-end (CaseEditor → EvalsTab → RunHistory → RunCaseDetail) closes BUG-260701-02 by rendering prompt-first, never the uuid"

requirements-completed: [PANEL-01]

# Metrics
duration: ~35min
completed: 2026-07-03
---

# Phase 137 Plan 05: EvalsTab (lift machinery + compose leaves) Summary

**The Skill Studio Evals tab is fully assembled — EvalsTab lifts the SkillEvalSection run/SSE/proposal/gate machinery verbatim in logic (attach() self-heal, durable getEvalRun readout, currentSkillRef skill-switch guard, endpoint-then-refetch mutations), owns the skill's test-case list, and re-skins the render by composing LifecycleStepper → CaseEditor → RunBar → RunHistory → ProposalCard, threading casesById so the run history renders prompt-first.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-03T22:20:00Z
- **Completed:** 2026-07-03T22:31:00Z
- **Tasks:** 3
- **Files modified:** 4 created (2 components + 2 specs)

## Accomplishments
- **CaseEditor** — a prompt-first test-case CRUD leaf that lifts the SkillTestCasesSection CRUD minus the version list; rows lead with the prompt (expected_behavior as the quiet second line), the raw test_case_id uuid never renders as a label (BUG-260701-02), and it fires `onCasesChanged(cases)` with the full `TestCase[]` after load + every mutation so the container owns the single case list. No migration.
- **EvalsTab** — the stateful container that lifts the run/SSE/reconcile machinery VERBATIM in logic from SkillEvalSection (no rewrite), owns `cases`/`runs`/`expandedRunId`, derives `caseCount` + `casesById`, and composes the four Wave-1 leaves in D-08/D-12 order with the lifted handlers injected as props. Picker state lives here so provider/model persists across skills (D-12).
- **Prompt-first run history end-to-end** — `casesById` is threaded from CaseEditor's lifted list through RunHistory into RunCaseDetail, so a run's per-case detail (and the live per-arm progress) render the prompt, never the uuid — closing BUG-260701-02 across the whole surface.
- **Honesty locks preserved** — onEvalComplete triggers the durable getEvalRun readout (no mid-run verdicts, T-137-04); every mutation is endpoint-then-refetch (never optimistic, T-137-04); the publish gate is passed to LifecycleStepper untouched, `met` never recomputed (T-137-01).

## Task Commits

Each task was committed atomically (TDD RED→GREEN where applicable):

1. **Task 1: CaseEditor spec (RED)** - `ddbb2e62` (test)
2. **Task 1: CaseEditor implementation (GREEN)** - `9902177a` (feat)
3. **Task 2: EvalsTab container** - `0ab4a29e` (feat)
4. **Task 3: EvalsTab spec** - `96f4d973` (test)

## Files Created/Modified
- `frontend/src/components/skills/studio/CaseEditor.tsx` - Prompt-first test-case add/edit/delete leaf; lifts the CRUD, drops the version list, lifts the full list up via onCasesChanged; skill-switch guarded.
- `frontend/src/components/skills/studio/CaseEditor.test.tsx` - Asserts prompt-first rows, no-uuid label, add/edit/delete client fns, onCasesChanged full-list lift on load + mutation.
- `frontend/src/components/skills/studio/EvalsTab.tsx` - The machinery-lifted, composed Evals-tab container that owns the case list and threads casesById into RunHistory.
- `frontend/src/components/skills/studio/EvalsTab.test.tsx` - Asserts no mid-run verdict, onEvalComplete→getEvalRun, skill-switch clears readout+cases, rating endpoint-then-refetch, prompt-first per-case map + stepper count.

## Verification

- `npx vitest run CaseEditor.test.tsx EvalsTab.test.tsx` → **10/10 passed** (5 + 5).
- `npx tsc -p tsconfig.json --noEmit` → **clean (exit 0)** under `noUnusedLocals`/`noUnusedParameters` (every lifted handler is used in the composition).
- Grep gates: CaseEditor CRUD fns 7 (≥3), version-list leak 0 (==0), onCasesChanged present; EvalsTab `subscribeToRun|getEvalRun` 7 (≥2), `currentSkillRef` 23, `casesById` 4, `onCasesChanged` 2, four-leaf composition 19 (≥5).
- Artifact sizes: CaseEditor 273 lines (≥90), EvalsTab 567 lines (≥160).

## Decisions Made
- **RunHistory.onRerun → handleRun (not handleRerun).** RunHistory's `onRerun(runId)` fires from an interrupted eval-RUN's re-run button; the plan's literal `onRerun={handleRerun}` would misfire the PROPOSAL re-eval handler (which early-returns without a proposal, or re-runs the wrong thing). `handleRun` (start a fresh eval run with the current picker) is the semantically correct "re-run" for an interrupted eval run and reuses lifted logic. ProposalCard.onRerun stays wired to `handleRerun` (the correct proposal re-eval rerun). See Deviations.
- **handleRate signature adaptation.** RunCaseDetail already owns the thumbs toggle and hands `(resultId, choice|null)`; the lifted SkillEvalSection.handleRate took `(EvalResult, "up"|"down")` and computed the toggle itself. Adapted the container handler to the leaf contract while preserving the exact `rateEvalResult(...) THEN loadReadout(...)` endpoint-then-refetch flow (never optimistic).
- **provider/model persistence for D-12.** SkillEvalSection re-fetches providers and unconditionally resets provider/model on every skill switch, which would drop a manual selection. To honor D-12 ("selection preserved across skills"), EvalsTab hydrates with `setProvider((cur) => cur || ...)` / `setModel((cur) => cur || ...)`, setting only on first mount and preserving thereafter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RunHistory.onRerun rewired to a fresh eval run instead of the proposal re-eval**
- **Found during:** Task 2 (EvalsTab compose)
- **Issue:** The plan's action literally lists `onRerun={handleRerun}` for BOTH RunHistory and ProposalCard. RunHistory.onRerun is the interrupted eval-RUN re-run affordance; `handleRerun` is the proposal RE-EVAL rerun (guards on `if (!proposal) return`). Wiring them together would no-op on an interrupted run with no active proposal, or misfire the proposal re-eval — a latent bug.
- **Fix:** Wired `RunHistory.onRerun={handleRun}` (start a fresh eval run — the correct "re-run" for an interrupted eval run, reusing lifted logic). `ProposalCard.onRerun={handleRerun}` unchanged (correct).
- **Files modified:** frontend/src/components/skills/studio/EvalsTab.tsx
- **Verification:** tsc clean (handleRun `() => Promise<void>` assignable to `(runId: string) => void`); EvalsTab spec green.
- **Committed in:** `0ab4a29e` (Task 2 commit)

**2. [Rule 3 - Blocking] handleRate signature adapted to the leaf contract**
- **Found during:** Task 2 (EvalsTab compose)
- **Issue:** RunHistory/RunCaseDetail call `onRate(resultId, choice|null)` (the leaf owns the toggle), but the lifted SkillEvalSection.handleRate was `(r: EvalResult, choice: "up"|"down")` and computed the toggle. Types + semantics did not line up.
- **Fix:** Rewrote the container handler as `handleRate(resultId, choice: "up"|"down"|null)` calling `rateEvalResult(skillId, resultId, choice)` THEN `loadReadout(displayed run)` — the endpoint-then-refetch (never-optimistic) flow is preserved exactly; only the signature adapts to the leaf.
- **Files modified:** frontend/src/components/skills/studio/EvalsTab.tsx
- **Verification:** EvalsTab spec (4) asserts rateEvalResult THEN getEvalRun; green.
- **Committed in:** `0ab4a29e` (Task 2 commit)

**3. [Rule 2 - Missing Critical] D-12 picker persistence + single-run→multi-run history bridge**
- **Found during:** Task 2 (EvalsTab compose)
- **Issue:** (a) The verbatim SkillEvalSection init would reset provider/model on every skill switch, violating D-12. (b) SkillEvalSection holds a single-run readout; RunHistory is a multi-run list needing `runs`/`resultsByRun`.
- **Fix:** (a) functional-updater hydration preserves an existing selection. (b) Added `runs` state (from listEvalRuns), a `runsForHistory` memo that merges the lifted `evalRun` + synthesizes a top row for a live run, `resultsByRun` from the current readout, a `refreshRuns` on the running→false edge, and `handleToggleExpand` that loads a run's durable readout on expand. These are additive render-bridge wiring — the run/SSE/reconcile LOGIC is unchanged.
- **Files modified:** frontend/src/components/skills/studio/EvalsTab.tsx
- **Verification:** EvalsTab spec (1/3/5) asserts the live top row, skill-switch clearing, and prompt-first history; green. tsc clean.
- **Committed in:** `0ab4a29e` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing-critical) — all in the "re-skin render" composition, none touching the lifted run/SSE/reconcile logic.
**Impact on plan:** All three are necessary bridges between the lifted single-run machinery and the multi-run leaf contracts, plus the D-12 requirement the plan explicitly mandates. No scope creep; the machinery is transcribed, not rewritten.

## Issues Encountered
- The fresh worktree has no `frontend/node_modules` (gitignored). Created a temporary Windows directory junction to the main checkout's node_modules so `tsc`/`vitest` resolve; the junction is removed before returning (reparse point only, main checkout untouched).

## Known Stubs
None. Every leaf is wired to real data: CaseEditor to the live test-case CRUD, EvalsTab to the lifted run/SSE/proposal/gate machinery. The synthetic running-run row's empty `skill_version_id` is a transient display bridge (the durable readout replaces it on the first getEvalRun), not a data stub.

## Threat Flags
None. No new endpoints, auth paths, file access, or schema changes were introduced — the plan's threat register (T-137-01..05) is fully covered by the lifted guards (currentSkillRef/requestedSkill skill-switch bail, endpoint-then-refetch, gate passed untouched, React-text-node rendering).

## Next Phase Readiness
- EvalsTab is ready to be mounted as the Evals tab inside the Skill Studio tab shell (a later Plan/phase). It takes `{ skillId, skillVersion, onNavigateStage? }`.
- No blockers. The four Wave-1 leaves + CaseEditor now have one composing owner.

## Self-Check: PASSED

All created files exist (CaseEditor.tsx/.test.tsx, EvalsTab.tsx/.test.tsx, 137-05-SUMMARY.md) and all four task commits are present in git (`ddbb2e62`, `9902177a`, `0ab4a29e`, `96f4d973`).

---
*Phase: 137-skill-evals-panel-ui-panel-01*
*Completed: 2026-07-03*
