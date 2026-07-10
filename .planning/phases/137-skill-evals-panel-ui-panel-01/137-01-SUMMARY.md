---
phase: 137-skill-evals-panel-ui-panel-01
plan: 01
subsystem: ui
tags: [react, typescript, publish-gate, skill-evals, lifecycle-stepper, honesty, vitest]

# Dependency graph
requires:
  - phase: 136-skill-publish-gate
    provides: "GET /skills/{id}/publish-gate → PublishGate read-model (met/state/measured/passed/passing_run_id/reason/last_override)"
  - phase: 132-skill-versioning-eval-test-case-persistence
    provides: "skill_versions + skill_test_cases (caseCount / skillVersion sourced by consumers)"
provides:
  - "Shared 054-B LifecycleStepper component (Cases → Eval → Gate → Published) over PublishGate"
  - "full + strip variants from one component (Studio header strip + slim detail panel)"
  - "The one-truth status renderer that resolves the 136-UAT 1/1-vs-0/2 contradiction as two labeled facts"
affects: [137-02, 137-panel-shell, skill-evals-panel, studio-header]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure server-truth renderer: readiness driven ONLY by publishGate.met/state; passed/measured are displayed, never compared (no client gate arithmetic)"
    - "One component, two variants (full | strip) — same PublishGate in, no divergent truth (D-10)"
    - "Fresh, fully-mocked spec per SEED-056 (no rotted-sibling imports; no api mock — the component has no @/lib/api dependency)"

key-files:
  created:
    - frontend/src/components/skills/studio/LifecycleStepper.tsx
    - frontend/src/components/skills/studio/LifecycleStepper.test.tsx
  modified: []

key-decisions:
  - "The ⚡ collision maps to the real backend state passed_on_older_version (met=false); the component renders a green 'passing eval exists' met-Gate label beside the newest run's honest failing count + a stale 'measured vN-1' message — two labeled facts, never a flat contradiction"
  - "Readiness derives from publishGate.met + publishGate.state ONLY; passed/measured are never compared (a naive passed>=measured recompute would mislabel a stale full pass as 'ready')"
  - "TDD ordering per plan: component built first (tsc gate), then the fresh spec (the real green gate)"

patterns-established:
  - "Studio components live under frontend/src/components/skills/studio/ (net-new directory)"
  - "No client-side gate math in any status surface — the server publish_gate_service is the single truth-teller"

requirements-completed: [PANEL-01]

# Metrics
duration: 14min
completed: 2026-07-03
---

# Phase 137 Plan 01: Shared LifecycleStepper Summary

**A pure-renderer 054-B lifecycle stepper (Cases → Eval → Gate → Published) over the server PublishGate that resolves the 136-UAT "Publish ready 1/1" vs "0/2 passed" contradiction as two version-bound labeled facts, in one component with full + strip variants.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-03T17:40:00Z (approx)
- **Completed:** 2026-07-03T17:53:49Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- Built the ONE status-truth component consumed by both the Studio header (condensed `strip`) and the slim detail panel (full vertical stepper) — same PublishGate in, no divergent truth (D-10).
- Encoded the honesty lock (T-137-01): readiness is driven only by `publishGate.met` + `publishGate.state`; `passed`/`measured` are displayed, never compared — proven by a test where `met=false` with `passed>measured` still renders the not-met branch.
- Resolved the ⚡ collision (`passed_on_older_version`): a green "passing eval exists" met-Gate label stands beside the newest run's honest failing count, with a stale "measured vN-1, live skill is vN" message — two labeled facts, never one flat contradiction.
- The `last_override` force-publish record always renders as an un-softened amber receipt (D-01/D-02).
- 6/6 fresh, fully-mocked spec cases green (SEED-056 rot-avoidance).

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the shared LifecycleStepper component** - `d3bc926e` (feat) — includes a copy-alignment amend to match the plan's "Publish ready" phrasing (SkillEvalSection :546 parity)
2. **Task 2: Author the LifecycleStepper spec (fresh, fully mocked)** - `9b23e578` (test)

_Note: the Task 1 component copy was aligned to "Publish ready" while authoring the Task 2 spec; since Task 1's commit was fresh and local with no dependents, the one-line copy change was folded into the Task 1 commit via amend so Task 2 stays test-only._

## Files Created/Modified
- `frontend/src/components/skills/studio/LifecycleStepper.tsx` — the shared 054-B lifecycle stepper (full | strip) over PublishGate; renders `met`/`state`/`measured`/`passed`/`last_override` verbatim, derives no readiness.
- `frontend/src/components/skills/studio/LifecycleStepper.test.tsx` — 6-case behavioral spec: 4 gate states + the ⚡ collision (two labeled facts) + the strip variant + the no-recompute proof.

## Decisions Made
- **⚡ collision ↔ real backend state:** The sketch's collision (gate met on an older passing run + newest run failed) maps to the real `PublishGate` state `passed_on_older_version` (met=false, `passing_run_id=null`). A single PublishGate carries one `state` + one honest count pair, so the component binds the state's "a pass existed" fact to the Gate node (green "passing eval exists" + "passed on v{N-1}" label) and the count to the Eval node, with the stale-version message doing the reconciliation. This is faithful to the server model while still reading as two labeled facts.
- **No newest-run prop:** The stepper receives only `{ publishGate, caseCount, skillVersion, variant?, proposalState?, onNavigateStage? }` — it cannot (and must not) fetch or derive the newest-run rollup; it renders what the server gate hands it.

## Deviations from Plan

None that required deviation rules. One minor in-task refinement (not a rule-triggered deviation): while authoring the Task 2 spec, the Task 1 component's `passed`-state message was aligned from "Gate met — …" to the plan-specified "Publish ready — eval passed {passed}/{measured} …" (SkillEvalSection :546 parity, and the copy the plan's Task 2 asserts). Folded into the Task 1 commit via amend (fresh local commit, no dependents).

## Issues Encountered
- **Worktree had no `node_modules`** (gitignored, not copied into the fresh worktree), so `tsc`/`vitest` could not run. Resolved by creating a Windows directory junction from the worktree `frontend/node_modules` to the main checkout's `frontend/node_modules` (via PowerShell `New-Item -ItemType Junction`). The junction is gitignored and never staged. Both gates then ran clean against the worktree files.
- **Plan's literal tsc gate is a solution config** (`tsconfig.json` has `files: []` + references), so `tsc -p tsconfig.json --noEmit` compiles zero files (exit 0 trivially). To genuinely typecheck the new files I additionally ran `tsc -p tsconfig.app.json --noEmit` (the config that `include`s `src`) and confirmed **zero errors reference `LifecycleStepper`**. All other errors from that run are pre-existing baseline rot (SEED-056 + unrelated test/source files: `MessageSkeleton.tsx`, `NavPanel.tsx`, `SkillFormDialog.tsx`, various `*.test.tsx`) — out of scope, not touched, logged here only.

## Verification
- `tsc -p tsconfig.json --noEmit` → exit 0 (plan's literal gate).
- `tsc -p tsconfig.app.json --noEmit` → no errors for the two new files (pre-existing baseline rot in unrelated files unchanged).
- `vitest run src/components/skills/studio/LifecycleStepper.test.tsx` → **6/6 passed**.
- Acceptance grep gates: no gate arithmetic (`passed …(>=|>|<)… measured` empty); `publishGate.(met|state)` referenced 13×; `last_override` rendered; zero `dangerouslySetInnerHTML`; component 274 lines (≥80), spec 149 lines (≥60).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The shared `LifecycleStepper` is ready to be consumed by the Studio header (strip) and the slim detail panel (full) in the subsequent Phase 137 plans (panel shell / tab surfaces).
- Consumers must supply `caseCount` (from `listTestCases` length) and `skillVersion` (the live version) — the stepper derives neither.
- `onNavigateStage` is wired on the Cases/Eval/Gate nodes for deep-link scroll; consumers pass the handler.

## Self-Check: PASSED

- FOUND: `frontend/src/components/skills/studio/LifecycleStepper.tsx`
- FOUND: `frontend/src/components/skills/studio/LifecycleStepper.test.tsx`
- FOUND: `.planning/phases/137-skill-evals-panel-ui-panel-01/137-01-SUMMARY.md`
- FOUND commit `d3bc926e` (Task 1, feat)
- FOUND commit `9b23e578` (Task 2, test)

---
*Phase: 137-skill-evals-panel-ui-panel-01*
*Completed: 2026-07-03*
