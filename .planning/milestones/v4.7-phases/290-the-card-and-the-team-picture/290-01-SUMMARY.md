---
phase: 290-the-card-and-the-team-picture
plan: 01
subsystem: frontend/workflows (team picture derivation)
tags: [team-picture, derivation, vocabulary, tdd, characterization-pin]
requires:
  - phaseVocabulary.ts (parseSkipTarget, groundingCauseOf, intersectingKbToolOf, actionRiskArmed, nodeTitle, PHASE_TYPE_SENTENCES/SUBTITLES/LABELS)
  - ownProperty.ts (own)
  - definitionOps.ts (GOVERNANCE_SEAL_LABEL)
provides:
  - deriveTeam + TeamModel / TeamStep / TeamGate / TeamLine / TeamLineKind / TeamAbsence / SEAT_DOT_CAP (teamModel.ts)
  - every team-picture string, zero imports (teamVocabulary.ts)
  - planted fixtures TEAM_FIXTURES (teamFixtures.ts)
  - canvas header characterization pin (6 snapshots) for 290-03
affects:
  - 290-03 (TeamPicture render consumes deriveTeam; must leave the header pin byte-unchanged)
tech-stack:
  added: []
  patterns: [zero-import vocabulary leaf, ?raw purity fence with positive controls, outerHTML characterization pin]
key-files:
  created:
    - frontend/src/components/workflows/teamModel.ts
    - frontend/src/components/workflows/teamModel.test.ts
    - frontend/src/components/workflows/teamVocabulary.ts
    - frontend/src/components/workflows/teamVocabulary.test.ts
    - frontend/src/components/workflows/__fixtures__/teamFixtures.ts
    - frontend/src/components/workflows/__tests__/WorkflowCanvas.headerPin.test.tsx
    - frontend/src/components/workflows/__tests__/__snapshots__/WorkflowCanvas.headerPin.test.tsx.snap
  modified: []
decisions:
  - "deriveTeam lines are only handoff, judge/check and a jump for a resolvable skip_to_phase; a step-to-step line cannot be constructed (SC#3)"
  - "Engine-derived citations Check only when groundingCauseOf === 'detected', failure 'redo the step (up to 2 times), then ask you' (D-18, D-19)"
  - "An untyped step's technical form floors to 'A step with no type · <slug>' rather than ' · <slug>'"
  - "A present-but-invalid max_parallel_agents is sourced as '= <json> (engine default 5)'"
metrics:
  duration: ~30 min
  completed: 2026-10-21
  tasks: 3
  files: 7
---

# Phase 290 Plan 01: Team Picture Derivation Summary

I built `deriveTeam` as a pure derivation. It turns `phases[]` into steps in run order, the gates that check each step, and every line in the picture, with each line naming the definition field it came from. It ships with a zero-import vocabulary leaf for every team-picture string, ten planted fixtures, and a 6-snapshot pin of the canvas header. All of it was written test-first.

## Base and commits

- **Plan base:** `1f9673d25c49f1fa1b4a759052023339a322a039` (develop). The worktree started on `17a064f2e` and was reset to the base by the branch check.
- `d8eb324f0` `test(290-01)`: team vocabulary leaf, planted fixtures, canvas header pin (Task 1)
- `0aa1e9464` `test(290-01)`: add failing tests for deriveTeam (Task 2, RED)
- `62dd59431` `feat(290-01)`: implement deriveTeam (Task 3, GREEN)
- `1103c9dcb` `fix(290-01)`: types the vocabulary-value sweep so tsc adds no error (Rule 1, see below)

No REFACTOR commit was needed. The helpers `orderSteps`, `titleOf`, `seatsOf`, `failureWords` and `derivedGates` were named in the GREEN commit.

## TDD gate compliance

- **RED:** `teamModel.test.ts` against the contract stub gave **30 failed / 213 passed (243)**. Every failure was an assertion failure; imports resolved. The 213 passes are sweep and absence rows that the empty model satisfies trivially, such as "zero step-to-step lines" and "empty input gives the empty model".
- **GREEN:** 243/243 passed. `git diff --numstat 0aa1e9464 HEAD -- teamModel.test.ts` is empty, so no test was edited to get to green.
- Order in `git log`: `test(290-01)` RED (`0aa1e9464`) comes before `feat(290-01)` GREEN (`62dd59431`).

## Verification

- `vitest run teamModel.test.ts teamVocabulary.test.ts governanceVocabulary.test.ts __tests__/WorkflowCanvas.headerPin.test.tsx canvasModel.purity.test.ts --maxWorkers=2` gave **5 files / 437 tests passed**.
- `eslint` on all six new source/test files: exit 0.
- **tsc set diff:** base 63 errors (`tsc -p tsconfig.app.json --noEmit`, re-derived at base). After the GREEN commit: 66 errors, all three in `teamVocabulary.test.ts`. After `1103c9dcb`: 63 errors, and `comm -3` against the base set is empty.
- Snapshot file has 6 `exports[` entries. `WorkflowCanvas.tsx`, `canvasFixtures.ts` and `phaseVocabulary.ts` have an empty numstat against the base.
- Grep gates: `teamVocabulary.ts` code lines have 0 import/from, 0 `Must cite its`, and 0 step-sentence or seal-label strings; the file has 1 `Must point at the documents it used`. `teamModel.ts` code lines have 0 react, `@/lib/api`, `dangerouslySetInnerHTML` or `Date.now`; the file has 1 `groundingCauseOf(` and contains `=== "detected"`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tsc errors in the Task 1 vocabulary test**
- **Found during:** Task 3 typecheck set diff
- **Issue:** `Object.values(teamVocabulary).filter((v): v is string => …)` is a type predicate that is not assignable over the namespace's union type, which caused 3 new TS errors.
- **Fix:** the namespace is widened to `Record<string, unknown>` before the predicate. Runtime behaviour is unchanged and the suite stays 15/15.
- **Files:** `teamVocabulary.test.ts` (not `teamModel.test.ts`, so the "no RED test edited" rule holds)
- **Commit:** `1103c9dcb`

**2. [Rule 2 - Test strength] `escalatedStep` is an `llm_agent`, not an `llm_single`**
- The plan said "a non-KB `llm_single` with `grounding_escalated: true`". `llm_single` is not a grounding-dial type, so its cause is `null`, and D-18's "never for `escalated`" would have been asserted against a fixture that is never escalated.
- The fixture is now an `llm_agent` with `available_tools: ["web_search"]`. The test asserts `groundingCauseOf(...) === "escalated"` as a positive control before it asserts zero gates.

**3. [Rule 2 - Honest floor] An untyped step's `technical` form**
- The plan's formula gives `" · no-config"` for a phase with no type, which leaves a blank before the dot. It now floors to `TEAM_STEP_UNTYPED`, giving `"A step with no type · no-config"`. Nothing changes for the seven known types: `technical === technicalTitle(phase)` holds across the whole sweep.

**4. [Rule 2 - Honest source] `seatSource` for an invalid `max_parallel_agents`**
- When `max_parallel_agents` is `0`, `-1` or `"5"`, the source reads `phases[o].config.max_parallel_agents = <JSON value> (engine default 5)`. Without the suffix, a ledger row would show `= 0` next to 5 seats.

**5. [Rule 1 - Robustness] A non-string `phase.name` would throw inside `nodeTitle`**
- `nodeTitle` calls `phase.name?.trim()`, which throws on a number. `titleOf` now passes `nodeTitle` a shallow copy with `name: undefined` in that case, without mutating the input. This is T-290-02 totality.

**6. Purity fence reads code only**
- The `?raw` fence in `teamModel.test.ts` strips block comments and whole-line `//` comments before matching, because the module docblock names the forbidden imports. A positive control proves the stripper keeps code and drops comments.

## Observation (not acted on: `phaseVocabulary.ts` is a G-5-firing file)

`nodeTitle` (`PHASE_TYPE_SENTENCES[type] ?? type`) and `technicalTitle` (`PHASE_TYPE_LABELS[type] ?? type`) both read their presentation maps with a plain bracket lookup. For a `constructor` phase type they return `Object` (a function), not a string, and the shipped canvas does the same today. `technicalTitle` also reads `phase.config.phase_type` without a guard, so it throws on a config-less phase. `groundingCauseOf` and `intersectingKbToolOf` likewise read `phase.config` unguarded. `teamModel.ts` guards around all four:
- it keeps a `nodeTitle` result only when it is a non-empty string;
- it computes `technical` itself, using `own()`;
- it calls the grounding helpers only when `config` is an object.

The `malformed` fixture pins each guard.

## Known Stubs

None. `deriveTeam` is fully wired; the render arrives in 290-03.

## Threat Flags

None. No network, auth, file-access or schema surface was added. The derivation reads only the definition the viewer already holds, and the purity fence covers T-290-05.

## Self-Check: PASSED

- FOUND: all 7 created files
- FOUND: commits d8eb324f0, 0aa1e9464, 62dd59431, 1103c9dcb
