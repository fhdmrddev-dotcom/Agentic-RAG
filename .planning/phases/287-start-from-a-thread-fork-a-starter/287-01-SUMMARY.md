---
phase: 287-start-from-a-thread-fork-a-starter
plan: 01
subsystem: frontend-launch
tags: [required-fields, launch, tdd]
requirements: [START-01]
key-files:
  created:
    - frontend/src/components/workflows/__tests__/soulData.requiredFields.test.ts
  modified:
    - frontend/src/components/workflows/soulData.ts
    - frontend/src/components/layout/ChatLaunchForm.tsx
    - frontend/src/components/workflows/library/RunModal.tsx
    - frontend/src/components/workflows/LaunchInputFields.tsx
    - frontend/src/components/workflows/LaunchInputFields.test.tsx
    - frontend/src/components/layout/ChatLayout.launch.test.tsx
    - frontend/src/pages/__tests__/RunModal.test.tsx
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
completed: 2026-10-19
---

# Phase 287 Plan 01: Required-field block at the launch confirm controls

Empty required launch inputs are now refused, by name, in `ChatLaunchForm` and `RunModal`, via two pure helpers (`missingRequiredFields`, `requiredFieldsMessage`) in `soulData.ts`. The leaf `LaunchInputFields` stays non-blocking. The 214.1-01 re-open trigger is TAKEN.

## Commits
- `9286006cd` test: RED. 7 of 7 cases failed (helpers did not exist) before implementation.
- `eed10f890` feat: helpers in soulData.ts, GREEN (with argumentVocabulary.test.ts untouched and green, 51 tests).
- `a18bafa4e` feat: block wired into both confirm controls, docblocks rewritten, tests rewritten.
- `e78e01a31` docs: ledger rows and sections (CLAUDE.md + docs/HOT-FILE-LEDGER.md).

## Deliberate test edits (each with its reason, also written inline in the tests)
1. `ChatLayout.launch` "opens the form and creates NO thread until it is confirmed": now fills both fields before confirm, because both are required (absent reads true) and an empty confirm is now refused.
2. `ChatLayout.launch` "an untouched field sends an empty string": rewritten in place into "an untouched REQUIRED field is REFUSED by name" (asserts `subject is required`, createThread and postMessage at zero). Added a sibling using a new `required: false` fixture (`DEF_WITH_OPTIONAL`, driver `drive-launch-optional`) that still posts `""` with the key present, keeping "absent vs empty are different" alive.
3. `ChatLayout.launch` Test Run door: fills fields first; the "form opens on this door" point is unchanged.
4. `RunModal.test` "an untouched field sends an EMPTY STRING": same rewrite as 2, plus a `required: false` sibling. Refusal uses `run-required-refusal`, distinct from the server 422 `run-upload-error`.
5. `LaunchInputFields.test`: one comment updated only (the leaf-never-blocks assertion is unchanged).

No case deleted. Targeted run: 5 suites, 139 tests pass (was 137: each rewritten file gained one case). `ChatLayoutLaunch.test.tsx` and `ChatLayout.tsx` unedited. `tsc -p tsconfig.app.json` shows no errors in touched files. The "NO REQUIRED-NESS IS VALIDATED" string is gone from all three source files.

## Deviations from Plan
- Worktree HEAD started at `be7f4177a`, not the expected base; reset to `d295f7497` per the task's instruction (branch check passed).
- Gate `check-hot-file-ledger.cjs` on the phase directory exits 1, but only for `ThreadWorkflowPicker.tsx` and `useStartWorkflowInThread.ts`, which are plan 03's NEW files named by 287-03-PLAN.md. Every file this plan touches has a row and section. Plan 03 must add those two rows in its own commit. `check-claude-md-size.cjs` exits 0.
- `LaunchInputFields.tsx` had a section but no CLAUDE.md row; one was added.

## Known follow-ups / threat notes
- T-287-01 (accepted): client block is UX only; no server predicate for required launch inputs exists. Hardening deferred.
- Schedule form is NOT blocked; deferred to phase 293.
- Not run (per instructions): full count gate and full backend suite (plan 04).

## Self-Check: PASSED
Commits 9286006cd, eed10f890, a18bafa4e, e78e01a31 exist; test file and edited sources present.
