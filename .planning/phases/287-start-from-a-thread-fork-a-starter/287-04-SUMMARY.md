---
phase: 287-start-from-a-thread-fork-a-starter
plan: 04
subsystem: verification
tags: [start-03, start-01, fork-isolation, count-gate, ledger]
requires: [287-01, 287-02, 287-03]
provides: [fork isolation proof, count-gate adoption of phase suites]
key-files:
  created:
    - backend/tests/unit/test_287_fork_isolation.py
    - frontend/src/components/workflows/library/__tests__/starterFork.287.test.tsx
  modified:
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/seeds/SEED-232-a-workflow-cannot-be-started-from-inside-a-thread.md
    - .planning/seeds/SEED-084-starter-workflow-library.md
metrics:
  tasks: 2
  completed: 2026-10-19
---

# Phase 287 Plan 04: Fork isolation proof and gate close-out Summary

SC#4 isolation is proven against the real local DB with two users: editing a fork's name and a phase prompt leaves the starter row and another user's fork byte-equal, and the shelf slug set is unchanged.

## Commits
- 457ed8b50 test: fork isolation (live DB) + starter fork payload pin
- 8e2727c23 chore: count-gate adoption, ledger re-derivation, seeds shipped

## What was proven
- Backend `test_287_fork_isolation.py` (ran, 2 passed): two forks (users A and B) of one starter are new rows (own id, draft, not global, created_by caller). A's edit through `update_workflow_definition` lands (positive control reads the edited prompt) while the starter's name, `definition::text` and `updated_at`, and B's fork, are byte-equal on re-read. `list_starter_workflows` slug set identical before/after and excludes both forks. Counterfactual: a planted equal-id pair fails the identity helper. Rows deleted in `finally`; the test asserts zero leftover rows. Local-DB lock held (noclobber) during mutation and the baseline, released after.
- Frontend `starterFork.287.test.tsx` (3 passed): "Make my own copy" on a starter writes nothing until a name is confirmed (dialog kept); the create payload has a new `weekly-status-<6 chars>` slug, version 1, status draft, the trimmed typed name, and `category` kept (A-05); a blank name writes nothing.

## Gates (run once, here)
- Count gate (re-derived): `count gate OK - 461/461 pinned files present, no per-file decrease, 0 failing`; `total 10607 failed 0 pinned total 9763`. New 287 suites printed their own actuals (ThreadWorkflowPicker 9, useStartWorkflowInThread 7, ChatArea.threadWorkflowPicker 5, StreamsProvider.inputs 3, soulData.requiredFields 7, starterFork.287 3) and were then pinned in BASELINE; the first four are named FILE-LEVEL in TARGETS (no chat/providers directory entry). ChatLayout.launch raised 17 to 38 and RunModal 40 to 55 (printed actuals). Four suites unrelated to this phase print `new` (PromptVariableChips, RunHero, describeRefusalVocabulary, nodeEffectBanner) and many others show `+N` over stale pins (pre-existing drift, not adopted here). The gate was run before the final pin edits; the edits only raise two pins to the actuals it printed (`node --check` clean), so a re-run is owed to the orchestrator if it wants a verdict line over the final file.
- Backend baseline (`check-backend-unit-baseline.cjs`): 71 failed, 7768 passed, 1 skipped, 2 xfailed, 2 xpassed, 0 errors. GATE PASSED at the ceiling (71 <= 71).
- tsc (`tsconfig.app.json`): 63 errors at HEAD. Set diff against base content of the only touched file with an error (streamsStore.ts, swapped to 37159ec21): zero NEW errors at HEAD. `streamsStore.ts(477)` is inherited (same error at 475 on base). Files-with-errors intersected with the phase diff = only streamsStore.ts.
- check-hot-file-ledger, check-claude-md-size (94,896 chars), check-seeds-register --phase 287: all exit 0.

## Ledger
Re-derived with the recipe: streamsStore.ts `24 / 16 / 607` (phase count was 15), StreamsProvider.tsx `109 / 42 / 5004` and ChatArea.tsx `94 / 44 / 1189` confirmed unchanged, vitest-count-gate.cjs `314 / 69 / 6539`. Row and section updated in the same commit.

## Seeds
SEED-232 and SEED-084 now `status: shipped` with notes (they were `folded`).

## Deviations from Plan
- [Scope] Starter-card "answer arrives in chat" line NOT added. `libraryVocabulary.ts` was not edited: the card deliberately renders none of the soul atoms (`soul-output` "produces: answer in chat" is asserted ABSENT on every card by `WorkflowCard.test.tsx` D-03 and the baseline suite), and the existing deliverable wording only lives on WorkflowSoul/Decisions surfaces. Adding it to the card would reverse a pinned design decision without a sketch (G-2). Left for the operator to rule; no card change shipped.
- SC#4 "one click": **DEVIATED, operator to rule.** The shipped menu then ForkNameDialog flow was kept per A-04. Not recorded as PASS.
- STATE.md not edited (orchestrator owns it); text below.

## STATE.md follow-up (apply under Guardrail overrides)
- G-2 override, Phase 287: sketch not run before planning a user-visible surface (D-16); the in-thread "Run a workflow" action and the kept fork dialog have no operator-approved mockup. Lived-experience G-4 scenarios still owed.
- A-03 anti-pattern tension: in-thread start is an action button (no aria-pressed, no composer state), not a mode pill; recorded as a deliberate departure.

## Deferred / operator steps
- Schedule-form required block (Phase 293); server-side required-input enforcement; C2 fork-dialog deviation (SC#4 ruling); cloud migration 210 paste into the cloud Supabase SQL editor is an operator step; starter-card chat-answer wording (above).
- Local DB had one pre-existing workflow_definitions row with '287' in its slug before the test ran; untouched.

## Known Stubs
None.

## Self-Check: PASSED
Both test files exist, both commits in `git log`, SUMMARY written.
