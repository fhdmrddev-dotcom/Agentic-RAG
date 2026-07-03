---
phase: 137-skill-evals-panel-ui-panel-01
plan: 03
subsystem: ui
tags: [react, vitest, testing-library, skills, evals, panel-01, lobehub-icons, honest-verdicts, prompt-first]

# Dependency graph
requires:
  - phase: 134-eval-results-honest-verdict-ratings
    provides: EvalRun/EvalResult verdict rollup + verdict_state honesty + owner-scoped thumbs ratings
  - phase: 132-skill-versioning-eval-test-case-persistence
    provides: TestCase type (prompt/expected_behavior) + skill_versions binding
  - phase: 128-live-description-before-tool-start
    provides: providerLogo() shared @lobehub/icons brand-mark map
provides:
  - RunCaseDetail — per-case side-by-side WITH/WITHOUT arms + honest verdict badge + labeled thumbs, prompt-first from a TestCase prop
  - RunHistory — 055-B expandable run rows with provider logos + honest rollup + interrupted/running states + per-case casesById lookup
  - RunBar — compact controlled provider/model picker + Run launch bar
affects: [137-05-evals-tab-container, skill-evals-panel, panel-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure controlled presentational leaves — all state + handlers injected by the EvalsTab container (Plan 05)"
    - "Prompt-first case rendering (D-11): EvalResult carries only test_case_id, so the prompt is threaded in via a casesById TestCase map — the uuid is never a label"
    - "Honest verdict badge lifted verbatim from SkillEvalSection (never re-derive pass/fail); not_measured/judge_error render neutral, never as fail"

key-files:
  created:
    - frontend/src/components/skills/studio/RunCaseDetail.tsx
    - frontend/src/components/skills/studio/RunCaseDetail.test.tsx
    - frontend/src/components/skills/studio/RunHistory.tsx
    - frontend/src/components/skills/studio/RunHistory.test.tsx
    - frontend/src/components/skills/studio/RunBar.tsx
    - frontend/src/components/skills/studio/RunBar.test.tsx
  modified: []

key-decisions:
  - "verdictBadge lifted verbatim from SkillEvalSection :68-79 — the honest verdict mapping is the single source of truth, never re-derived"
  - "Thumbs render per-arm result.rating (matches the lifted SkillEvalSection logic) with a 'Your rating' label kept visually distinct from the judge chip — two truths, never blended"
  - "RunHistory sorts runs newest-first defensively so a running run always sits on top regardless of input order"

patterns-established:
  - "Pattern 1: prompt-first via casesById[test_case_id] ?? null → RunCaseDetail (closes BUG-260701-02)"
  - "Pattern 2: honest run states (graded/not_measured/judge_error/interrupted/running) with color as reinforcement, never fail-coloring neutral states"

requirements-completed: [PANEL-01]

# Metrics
duration: 30min
completed: 2026-07-03
---

# Phase 137 Plan 03: Skill Evals Panel Run-Display Leaves Summary

**The three PANEL-01 run-display components — RunCaseDetail (side-by-side arms + honest verdicts + labeled thumbs, prompt-first from a TestCase), RunHistory (055-B expandable rows with the casesById prompt-first thread + interrupted/running honesty + D-09 nudge), and RunBar (compact controlled picker + Run) — built as pure controlled leaves ready for the EvalsTab container to wire.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-03T21:50:00Z
- **Completed:** 2026-07-03T22:00:00Z
- **Tasks:** 3 (Tasks 1 & 2 via TDD RED→GREEN)
- **Files created:** 6 (3 components + 3 co-located specs)

## Accomplishments
- **RunCaseDetail** renders each case prompt-first from the `testCase` prop (neutral fallback when null — never the uuid), the two arms side-by-side with the lifted honest verdict chip (PASS/FAIL/"not measured"/"judge error") + score + reason + tokens, and a "Your rating" thumbs control (aria-pressed, toggle-to-null) held distinct from the judge verdict.
- **RunHistory** renders 055-B expandable rows (provider logo via `providerLogo`, Bot fallback for unmapped; model; version binding; honest rollup with "· N not measured" append), expanding in place to one `RunCaseDetail` per case fed `casesById[test_case_id] ?? null`; interrupted → banner + re-run; running → live per-arm progress with NO mid-run verdicts; the D-09 "Propose an improvement?" nudge on a finished run with a failed measured case.
- **RunBar** is a compact controlled provider/model picker + Run button (disabled while running or when provider/model empty; changing provider resets the model to the new provider's first) that holds no launch logic.
- 20/20 co-located tests green; scoped `tsc --noEmit` clean on all three files.

## Task Commits

Each task was committed atomically (TDD tasks carry test → feat):

1. **Task 1: RunCaseDetail** — `60d00b9d` (test) → `4a49494c` (feat)
2. **Task 2: RunHistory** — `614bdf7c` (test) → `84146745` (feat)
3. **Task 3: RunBar** — `e4f5054d` (feat, component + spec)

_TDD RED→GREEN followed for Tasks 1 & 2 (component-absent import failure = RED, implementation = GREEN)._

## Files Created/Modified
- `frontend/src/components/skills/studio/RunCaseDetail.tsx` — per-case side-by-side arms + honest verdict badge + labeled thumbs, prompt-first from a TestCase prop
- `frontend/src/components/skills/studio/RunCaseDetail.test.tsx` — spec: PASS/FAIL/not-measured/judge-error render; neutral states carry no fail styling; both arms; prompt-first + no uuid; null fallback; onRate toggle
- `frontend/src/components/skills/studio/RunHistory.tsx` — 055-B expandable rows + honest rollup + interrupted/running states + per-case casesById lookup + D-09 nudge
- `frontend/src/components/skills/studio/RunHistory.test.tsx` — spec: rollup "· N not measured"; interrupted banner + re-run; no mid-run verdict; per-case prompt-first via casesById; conditional propose nudge; Bot fallback + toggle
- `frontend/src/components/skills/studio/RunBar.tsx` — compact controlled provider/model picker + Run
- `frontend/src/components/skills/studio/RunBar.test.tsx` — spec: Run disabled while running + empty provider/model; onRun on click; provider change → onProviderChange + model reset

## Decisions Made
- **Lifted `verdictBadge` verbatim** from `SkillEvalSection` (:68-79) rather than re-implementing — the honest pass/fail mapping stays a single source of truth (D-04).
- **Thumbs render per-arm** (both WITH and WITHOUT results carry their own `rating`), matching the battle-tested SkillEvalSection render, with a "Your rating" label to keep the human rating a distinct truth from the judge verdict chip (T-137-04).
- **RunHistory sorts newest-first defensively** (`created_at` desc) so a running run is always the top row (D-12), independent of the container's input order.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1–4 deviations; no architectural changes; zero new packages (threat T-137-SC accept holds).

## Issues Encountered
- **Worktree had no `node_modules`.** The parallel-executor worktree is a bare checkout; `npx vitest` could not resolve its config. Resolved by creating a Windows directory junction `frontend/node_modules → <shared checkout>/frontend/node_modules` via `node fs.symlinkSync(..., "junction")` (PowerShell/`mklink` path handling was mangling the target). The junction is `.gitignore`d and never committed — a test-environment setup action only, no code impact.
- **Grep-gate token hygiene.** Two explanatory comments mentioned the literal tokens `dangerouslySetInnerHTML` (RunCaseDetail) and `startEvalRun` (RunBar) that the plan's grep gates assert-absent. Rephrased both comments so a naive `grep` gate cannot false-positive on a comment; no behavior change, folded into the same task commits.

## Threat Flags
None — all three are pure presentational components: no network, no id construction, no `dangerouslySetInnerHTML`; every text field (prompt/expected_behavior/judge reason/output/error) renders as a React text node (T-137-05), a missing case renders the neutral fallback never a leaked id (T-137-03), and thumbs render server `rating` with no optimistic local truth (T-137-04). No new security surface beyond the plan's threat register.

## Next Phase Readiness
- The three leaves are complete and export stable prop contracts. **Plan 05 (EvalsTab container)** lifts its state + handlers into them: `onRun`/`onRate`/`onToggleExpand`/`onRerun`/`onProposeFromRun`, the `casesById` (test_case_id→TestCase) map, `resultsByRun`, and `liveByCase`. Until then the components are intentionally prop-driven (not stubs) — this is the plan's explicit leaf-first design.
- No blockers.

## Self-Check: PASSED
- All 6 files verified present on disk.
- All 5 task commits verified in `git log` (`60d00b9d`, `4a49494c`, `614bdf7c`, `84146745`, `e4f5054d`).

---
*Phase: 137-skill-evals-panel-ui-panel-01*
*Completed: 2026-07-03*
