---
phase: 300-told-when-a-run-waits-backend-and-mailer
plan: 01
subsystem: scheduler / unattended runs / schedule UI
tags: [backend, frontend, scheduler, unattended, provider-resume, words-first, fastapi, react]

requires:
  - phase: 296
    provides: "missing_required (the one blank-input predicate), metadata.provider recorded by the in-app door and read on resume (SEED-362), row-local Run now result (296-04)"
  - phase: 299
    provides: "workflow_runs.org_id; the schedule create door's org stamp"
provides:
  - "inbound_inputs: missing_required_labels, join_labels, blank_required_sentence, MISSING_REQUIRED_CODE = \"missing_required\" (300-02 shares the literal)"
  - "Schedule 422 wire: detail {code: missing_required, message, missing[labels]} from create / patch-inputs / resume"
  - "Fire-time blank-input refusal recorded on last_status, raised as ScheduledLaunchRefused"
  - "run_model_resolution.resolve_owner_run_model(owner_id) -> (model, provider)"
  - "Unattended runs record model + metadata.provider at launch and in the first drive ctx"
  - "last_status literal \"waiting\" when a scheduled drive ends with its run paused (300-02's trigger flips it at run end)"
  - "scheduleOutcomeVocabulary.ts: scheduleOutcomeLine(lastStatus) -> {text, tone} | null"
  - "lib/api/schedules.ts: ScheduleRefusalError (an ApiError) with code + missing"
affects: [300-02, 300-VALIDATION, scheduler, api-keys, workflow-schedule-modal]

tech-stack:
  added: []
  patterns:
    - "One predicate, two projections: _missing_fields feeds missing_required (keys) and missing_required_labels (labels)"
    - "Structured refusal detail {code, message, missing}; the client routes by code, never by words"
    - "Duck-typed error code read (no new import through a mocked barrel)"

key-files:
  created:
    - frontend/src/components/workflows/scheduleOutcomeVocabulary.ts
    - backend/tests/unit/test_300_schedule_required_inputs.py
    - backend/tests/unit/test_300_unattended_provider.py
    - frontend/src/components/workflows/__tests__/scheduleOutcomeVocabulary.test.ts
    - frontend/src/lib/api/__tests__/schedulesRefusal.test.ts
  modified:
    - backend/app/services/inbound_inputs.py
    - backend/app/api/schedules.py
    - backend/app/services/scheduler_service.py
    - backend/app/services/run_model_resolution.py
    - backend/app/services/unattended_launch.py
    - frontend/src/components/workflows/WorkflowScheduleModal.tsx
    - frontend/src/lib/api/schedules.ts
    - frontend/src/components/workflows/__tests__/WorkflowScheduleModal.test.tsx
    - backend/tests/unit/test_298_org_matrix.py
    - backend/tests/unit/test_296_step_inputs_and_routing.py
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md

key-decisions:
  - "Fire-time check reads the RAW stored definition (row[\"definition\"]), never the parsed model"
  - "Patch door re-checks only when inputs are sent or is_active goes True, and only after the owner-scoped get_schedule (a foreign id still falls through to the 404)"
  - "Only workflow_runs.status 'paused' maps to the waiting outcome; 'cap_paused' does not (the spec names a person's answer)"
  - "The modal reads the refusal's code off the thrown error instead of importing ScheduleRefusalError, which is not re-exported via lib/api.ts (the 196-08 mock-factory hazard)"
  - "Run now tracks a Set of running rows (not one id), since other rows stay interactive and two rows can start at once"
  - "A failed QUIET refetch keeps the list already shown instead of swapping in the load-failed line"

patterns-established:
  - "Schedule refusal sentences are built in one home (blank_required_sentence) and shown verbatim"

requirements-completed: [FIX-04, FIX-05]

duration: ~60min
completed: 2026-10-29
---

# Phase 300 Plan 01: A scheduled run is refused before launch when a required input is blank, unattended runs resume on the provider they started on, and the schedule row speaks words

**A blank required input is now refused by its label at every schedule door: create, edit inputs, resume, and fire time. Each refusal is one sentence from one predicate. Key and schedule runs record the owner's resolved model and provider, so a resume continues on them. A scheduled run that paused for a person now reads "Waiting on you" instead of "Finished". The schedule row shows a sentence instead of `launch_failed`, and Run now busies only its own row.**

## Performance

- **Duration:** ~60 min (first commit 04:46Z, gates closed 05:30Z)
- **Tasks:** 3 / 3 (each RED → GREEN)
- **Files modified:** 18 (vs plan base `42421f359`)

## Accomplishments

- **FIX-04 / D-14.**
  - `_missing_fields` is the one loop behind both `missing_required` and the new `missing_required_labels`. Every `expected_missing` case in `launch_fields_cases.json` gives the same membership through both.
  - Create answers 422 `{code, message, missing}` with "X is required and has no value." The patch door (edit inputs, resume) answers with the saved-schedule sentence plus "Add a new schedule with it filled in, then delete this one."
  - A pause is never refused. A foreign id still gets the existing 404.
  - At fire time there is one block after the foreign-folder block. It records the sentence, raises `ScheduledLaunchRefused` and launches nothing. The log line carries the schedule id and a count, never an input value.
- **FIX-05 / D-17 / D-33.**
  - One helper, `resolve_owner_run_model`, loads settings via `run_in_threadpool` and fails soft to `(None, None)`.
  - It is called once in `launch_unattended_run`. The writer gets `model` + `provider` (`metadata.provider`, same INSERT). The first drive's ctx dict gets `model` and `metadata: {provider}` only when a provider resolved.
  - The API-key door inherits this by calling the same core. `run_lifecycle.py`, `run_producer.py`, `harness_engine.py` and `api/inbound.py` are untouched: `git diff 42421f359 --stat` on them is empty.
- **D-26.** `_record_outcome("completed")` reads the schedule's newest run. If that run is `paused`, it records `"waiting"`. If the read fails, it records today's `completed`.
- **D-15 / D-16 / BUG-261027-03.**
  - `scheduleOutcomeVocabulary.ts` is a new leaf with no imports. Every row of UI-SPEC §S6a is covered. A server sentence reads "Didn't run — …" with a full stop added when it has none, and an unknown token reads neutral words.
  - The modal shows the outcome on its own wrapping line.
  - Run now no longer uses the global busy guard: only its own row's Run now / Pause / Delete disable. Results are kept per row.
  - "Loading…" shows only on the first load. After that the `<ul>` carries `aria-busy`.
  - A `missing_required` refusal from create lands under the inputs. From Resume it lands on that row, in the warning tone.

## Task Commits

1. **Task 1, blank required input refused by label (FIX-04)**: RED `86e9fda63`, GREEN `7eedb6a18`
2. **Task 2, unattended provider recorded; paused reads waiting (FIX-05, D-26)**: RED `9bac2aeb1`, GREEN `310e4c0b2`
3. **Task 3, schedule rows speak words; per-row Run now (D-15, D-16)**: RED `722b0183a`, GREEN `fd024ec01`

## Plan gates (verdict lines, verbatim)

- **Backend baseline** (run under the local-DB lock: acquired after 0s, released after): `[GATE PASSED] Backend unit baseline satisfied (failed: 69 <= 71, errors: 0).` The summary line read `69 failed, 10464 passed, 1 skipped, 2 xfailed, 2 xpassed`.
- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2`, repo root): `total 13206 · failed 1 · pinned total 12053` → `RESULT: COUNT GATE VIOLATED (1 reason(s))`, with `[failing-tests] 1 test(s) failed`. There was no per-file decrease.
  - I captured the failing test from the gate's own JSON report before re-running anything: `src/__tests__/routing/navigationKeepsStreams.test.tsx :: D-10 — a live stream in thread A survives six navigations …` (`STACK_TRACE_ERROR`).
  - That file is **provably unmodified** against base (`git diff --numstat 42421f359 HEAD` and `git status` are empty for it). It imports no schedule code.
  - Re-run alone at HEAD it passes 5/5. I read this as a load-timing red in a suite this plan did not touch, not a regression. It is one sample, so it is not proof of innocence. Earlier, in a neighbour run, `WorkflowBuilderPage.canvas.test.tsx` timed out once (7 s) and passed 164/164 alone. Same reading.
- **Typecheck** `npx tsc -p tsconfig.app.json --noEmit`: 61 error lines, the base figure, and none in any file this plan touched.
  - I did not do a strict base set-diff (it would have meant swapping base files in and out of the worktree). The new-error set is empty by construction instead: the only exported type change is an added class in `lib/api/schedules.ts`, and the modal's props are unchanged.
- **Hot-file ledger**: `ledger gate OK — every watched file has a row.`
- **CLAUDE.md size**: `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.`
- **OpenAPI**: `test_276_openapi_snapshot_fresh.py` passed 2/2. The snapshot was fresh, so neither OpenAPI file was regenerated or touched.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1, test fixtures] Two existing scheduled-launch fakes declared a required input but left the schedule blank**
- **Found during:** Task 1 GREEN.
- **Issue:**
  - `test_298_org_matrix._scheduled` (5 cases) and `test_296_step_inputs_and_routing::test_s6_f8_c…` both declare a required `topic` on a schedule whose inputs are `{}`.
  - D-14 now refuses that at fire time, before the org/kickoff behaviour those tests are about.
- **Fix:**
  - The matrix schedule now carries `{"topic": "Lisbon"}`.
  - The S6-F8-c case draws "no declared answers" with every declared input optional, which keeps its intent.
- **Commit:** `7eedb6a18`

**2. [Rule 2] Run now tracks a Set of running rows**
- The plan says "sets runningId". Once other rows stay interactive (D-16), two rows can be starting at the same time, and a single id would show the wrong row as busy. So the state is `runningIds: Set`.
- **Commit:** `fd024ec01`

**3. [Rule 3] The modal reads the refusal by `code` instead of `instanceof ScheduleRefusalError`**
- Importing the class through `@/lib/api` would make every suite that mocks that barrel by factory need a new name (the 196-08 measurement). So the class is exported from `lib/api/schedules.ts` only, and the modal checks `err.code === "missing_required"`. The behaviour is the one the plan specifies.
- **Commit:** `fd024ec01`

**4. [Rule 1] A test that pinned a SHA was not written**
- The Task 2 behaviour "inbound.py gains no edit" is checked once, by `git diff <base> --stat` (above), not by a test. A test pinned to a base SHA would go red on the next legitimate edit. The test asserts only that `inbound.py` calls `launch_unattended_run(`.

**5. Test re-targeted, not dropped**
- `WorkflowScheduleModal.test.tsx`'s 296-04 case "one result line per modal: the next action clears it" contradicts D-16. It now asserts that a row's line stays when ANOTHER row's Pause is pressed. The per-file count went up (9 pinned → 29 actual; pin raised).

**6. Ledger: three more files now fire, so they got FIRING rows**
- `inbound_inputs.py` (293, 296, 300), `unattended_launch.py` (293, 296, 300) and `lib/api/schedules.ts` each reached 3 phases with this plan. I gave them CLAUDE.md FIRING rows plus dated sections, the same way the plan handles `run_model_resolution.py`.

## Decisions Made

See `key-decisions` in the frontmatter. Two are worth flagging for review:
- **`cap_paused` is NOT mapped to "waiting".** Only `paused` is. If the operator wants a cap pause to read "waiting" too, it is a one-token change in `scheduler_service._record_outcome`.
- **The D-26 status read uses `inputs->>'_schedule_id'`, as the plan prescribed.** There is no index behind it. It runs once per scheduled drive. If `workflow_runs` grows large, mig 215's `origin_ref` (the schedule id) is the indexed alternative.

## Known Stubs

None.

## Threat Flags

None. The threat register's T-300-01..07 are each mitigated in code:
- T-300-01: the server re-checks with the one predicate.
- T-300-02: the check runs after the owner-scoped read.
- T-300-03: the log carries a count only.
- T-300-04 / T-300-05: the owner's pair is recorded at launch, off the loop, and fails soft.
- T-300-06: the waiting outcome plus one vocabulary.
- T-300-07: React text only, and a neutral sentence for unknown tokens.

## Next Phase Readiness

- 300-02 can rely on the literal `"waiting"` (`scheduler_service._record_outcome`) and `MISSING_REQUIRED_CODE = "missing_required"`.
- BUG-261027-03/04/05 are addressed in code and stay `folded` until G-4. The 8-row provider roster drive for SC#1 lives in `300-VALIDATION.md`.

## Self-Check: PASSED

- All 5 created files and the modified sources exist at HEAD.
- Commits 86e9fda63, 7eedb6a18, 9bac2aeb1, 310e4c0b2, 722b0183a and fd024ec01 are present in `git log`.
- In each task the RED commit precedes the GREEN commit.
