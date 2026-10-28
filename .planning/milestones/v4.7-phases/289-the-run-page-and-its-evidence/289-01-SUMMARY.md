---
phase: 289-the-run-page-and-its-evidence
plan: 01
subsystem: workflow-runs / human gate
tags: [SEED-360, ask_user, harness, run-page, tdd]
requires: []
provides:
  - "ask_user SQL that runs on real Postgres ($1::uuid::text)"
  - "_fail_redrive: a failed paused re-drive ends failed with words"
  - "PendingAskCard paused prop + PAUSED_WAITING_LINE"
affects: [289-05 (S5 live proof, waiting_on sentence restore, ledger rows, PendingAskStack seed)]
tech-stack:
  added: []
  patterns: ["DB-backed RED/GREEN pin under backend/tests/ for SQL the unit suite mocks"]
key-files:
  created:
    - backend/tests/test_289_ask_user_sql.py
    - backend/tests/unit/test_289_redrive_failure.py
    - frontend/src/components/panel/__tests__/PendingAskCard.paused.test.tsx
  modified:
    - backend/app/db/workflows.py
    - backend/app/api/runs.py
    - backend/tests/test_harness_resume.py
    - frontend/src/components/panel/PendingAskCard.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.retired.baseline.test.tsx
    - frontend/src/pages/WorkflowRunPage.tsx
    - frontend/src/pages/WorkflowRunPage.test.tsx
decisions:
  - "A failed paused re-drive terminalizes as failed (not re-paused): the answer row exists, so no surface could answer again"
  - "_fail_redrive checks status = active inline (no existing pool reader) and never raises"
  - "The context-build failure arm returns True: the only caller ignores the value and the answer is recorded"
metrics:
  duration: "~75 min"
  completed: 2026-10-19
requirements: [VIS-03]
---

# Phase 289 Plan 01: SEED-360 — answering a paused run resumes it, or ends it truthfully

**One-liner:** the two ask_user statements typed `$1` as text against a uuid column and raised
`uuid = text` on every paused-run answer (captured live at base); a 2-token cast fixes it, a new
`_fail_redrive` ends any future re-drive failure as `failed` with a worded reason and a `run_failed`
audit row, and the run page's card keeps its answer control on a paused run instead of saying
"agent stopped".

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 (step 0) | `dcf6ba649` (orchestrator) | docs(289-01): record the D-16 audited reading before any source edit |
| 1 | `3177d90dd` | docs(289-01): D-11 live capture of the paused re-drive failure at base |
| 2 RED | `35ff22045` | test(289-01): pin the ask_user SQL uuid=text failure and the re-drive failure arm |
| 2 GREEN | `7c07523b3` | feat(289-01): fix the ask_user SQL cast and end a failed re-drive truthfully |
| 3 RED | `5970520b5` | test(289-01): the paused card keeps its answer control |
| 3 GREEN | `b3ef15a5f` | feat(289-01): paused prop on the ask card |

`git log --oneline` order: `dcf6ba649` (docs, STATE.md) precedes every `backend/`/`frontend/` commit;
each `test(289-01)` precedes its `feat(289-01)`.

## D-16 audited reading (Task 1 step 0)

Already written and committed by the orchestrator before any source edit: commit `dcf6ba649`
(`docs(289-01): record the D-16 audited reading before any source edit`), under
`.planning/STATE.md` `## Guardrail overrides`. `grep -c "Phase 289 — G-5 audited reading" .planning/STATE.md`
returns `1` at this plan's base. This executor did not edit STATE.md.

## D-11 live capture (base)

**Backend driven:** the operator's `:8000` uvicorn (PID 22920 listening; file sink
`C:/Vibe Apps/Agentic RAG/backend/logs/backend.28384.log`), running from the MAIN checkout on base
code. Not restarted. Local-DB lock taken before the first write and released after cleanup.

**Drive method (deviation, recorded):** API-level, not a browser tab. The token came from the same
GoTrue password grant the app's login form calls (`/auth/v1/token?grant_type=password`, dev account
`fhdmrd@gmail.com`, `X-Org-Id: 22f9c615-…`, the account's only org, proven by `org_members`). The run
was started through the app's one kickoff path (`POST /threads` then
`POST /threads/{id}/messages` with `workflow_definition_id`), and the answer was
`POST /runs/{workflow_run_id}/ask_user_response` with `{tool_call_id, response_text: "Yes", choice_index: 0}`.
The card offers no control on a paused run (F-1), so the answer could not go through the UI at base anyway.

**Planted workflow** (local DB only, bypassing the publish judge on purpose; F-2 is deferred):
`workflow_definitions d866da1e-…` slug `s289-d11-pause-3e814d05`, status `published`,
`business_requirement` set; phases `intro` (llm_single) → `approve` (llm_human_input, options Yes/No,
`timeout_seconds: 30`) → `wrap` (llm_single).

### Attempt 1 (contaminated, recorded rather than discarded)

Run `56a21b60-…`: paused at 30 s, answered at 17:43:58Z, and the `:8000` log read:

```
2026-10-19 21:43:58,192 INFO app.api.runs ask_user_response: re-drive skipped, run 56a21b60-5533-42ba-bd78-da5abd6ea2fc already claimed
```

The `claimed_at` lease (17:43:45Z) was NOT stamped by `:8000`. It was stamped by a **different process**:
the parallel worktree `agent-a40d7ea51ab9565d2` ran a `TestClient` test (`GET http://testserver/workflow-runs/…`),
whose app lifespan ran the real boot sweep `resume_stranded_workflows` against the shared local DB,
claimed this live run, and tried to re-drive it inside the test process
(`agent-a40d7ea51ab9565d2/backend/logs/backend.9516.log:56`,
`llm_human_input: prompt row insert failed run=56a21b60-…`). See "Findings" below. This attempt is not
the D-11 evidence.

### Attempt 2 (the capture)

Run `c396cd9a-f4a1-4682-9a1f-62d16f82356b`, thread `573a2344-…`:
- started 17:45:33Z; `intro` completed; `approve` prompt `tool_call_id 95bac16619514dc197b9b7a1e1622775`;
- DB `workflow_runs.status = 'paused'` at 17:46:05Z (`backend.28384.log:165`,
  `phase approve paused on the human gate … no answer after 30s`);
- answered at 17:46:06Z → HTTP `200 {"status":"ok"}`;
- `:8000` log, verbatim (`backend.28384.log:172-173` and the traceback that follows):

```
2026-10-19 21:46:06,959 INFO app.api.runs ask_user_response: re-drove paused run c396cd9a-f4a1-4682-9a1f-62d16f82356b on tcid 95bac16619514dc197b9b7a1e1622775
2026-10-19 21:46:07,022 ERROR app.api.runs ask_user_response: re-drive failed for run c396cd9a-f4a1-4682-9a1f-62d16f82356b
Traceback (most recent call last):
  File "C:\Vibe Apps\Agentic RAG\backend\app\api\runs.py", line 659, in _wake
    await _resume_run(run_id, definition, ctx, pool=pool, redis=redis)
  File "C:\Vibe Apps\Agentic RAG\backend\app\services\harness_engine.py", line 3140, in _resume_run
    await run_workflow(run_id, definition, ctx, pool=pool, redis=redis)
  File "C:\Vibe Apps\Agentic RAG\backend\app\services\harness_engine.py", line 2239, in run_workflow
    outcome = await _run_phase_with_gates(
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Vibe Apps\Agentic RAG\backend\app\services\harness_engine.py", line 1098, in _run_phase_with_gates
    output = await asyncio.wait_for(
             ^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Python312\Lib\asyncio\tasks.py", line 520, in wait_for
    return await fut
           ^^^^^^^^^
  File "C:\Vibe Apps\Agentic RAG\backend\app\services\harness_engine.py", line 603, in _execute_phase
    return await executor(phase, accumulated_outputs, ctx)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Vibe Apps\Agentic RAG\backend\app\services\harness\human_input.py", line 179, in _exec_llm_human_input
    _durable = await get_ask_user_response(_pool, run_id, str(_resume_tcid))
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Vibe Apps\Agentic RAG\backend\app\db\workflows.py", line 2319, in get_ask_user_response
    row = await pool.fetchrow(
          ^^^^^^^^^^^^^^^^^^^^
  File "C:\Vibe Apps\Agentic RAG\backend\venv\Lib\site-packages\asyncpg\pool.py", line 660, in fetchrow
    return await con.fetchrow(
           ^^^^^^^^^^^^^^^^^^^
  File "C:\Vibe Apps\Agentic RAG\backend\venv\Lib\site-packages\asyncpg\connection.py", line 752, in fetchrow
    data = await self._execute(
           ^^^^^^^^^^^^^^^^^^^^
  File "C:\Vibe Apps\Agentic RAG\backend\venv\Lib\site-packages\asyncpg\connection.py", line 1873, in _execute
    result, _ = await self.__execute(
                ^^^^^^^^^^^^^^^^^^^^^
  File "C:\Vibe Apps\Agentic RAG\backend\venv\Lib\site-packages\asyncpg\connection.py", line 1970, in __execute
    result, stmt = await self._do_execute(
                   ^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Vibe Apps\Agentic RAG\backend\venv\Lib\site-packages\asyncpg\connection.py", line 2021, in _do_execute
    stmt = await self._get_statement(
           ^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Vibe Apps\Agentic RAG\backend\venv\Lib\site-packages\asyncpg\connection.py", line 443, in _get_statement
    statement = await self._protocol.prepare(
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "asyncpg/protocol/protocol.pyx", line 165, in prepare
asyncpg.exceptions.UndefinedFunctionError: operator does not exist: uuid = text
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.
```

The failure is `uuid = text`, exactly the root cause research predicted, so Task 2's fix is proven by
evidence and goes ahead.

**Statuses read from the local DB after the answer (17:46:22Z):**

| Row | Status |
|---|---|
| `workflow_runs c396cd9a…` | `active` (claimed_at 17:46:06Z) |
| phase `intro` | `completed` |
| phase `approve` (llm_human_input) | `active` |
| phase `wrap` | `pending` |
| thread anchor `active_workflow_run_id` | still `c396cd9a…` |
| messages | user kickoff, `ask_user_prompt`, `ask_user_response` "Yes" (the answer IS recorded) |
| last audit row | a second `phase_started approve` (the re-drive), then nothing |

So: run `active`, human-input phase `active`, no producer (the `_wake` task ended in its except arm).
This is F-3, reproduced at base.

### Inherited, not new

`git show 266e344c9:backend/app/db/workflows.py` (288's base) carries both JOIN lines with `$1::text`:

```
1731:             AND p.tool_calls->0->>'run_id' = $1::text      (ask_user_response_exists)
2286:         AND p.tool_calls->0->>'run_id' = $1::text          (get_ask_user_response; :2329 at HEAD)
```

Both statements (15 lines each, `SELECT EXISTS (` … and `row = await pool.fetchrow(` …) were diffed
base-vs-HEAD with `diff` and read **IDENTICAL**. The function was added at `613814426`
(`fix(200-03): D-10 — an unanswered human gate PAUSES the run, never approves it`).

### Cleanup

Ids snapshotted before the first write; after the drive the diff read new rows
`workflow_definitions 1, workflow_runs 2, threads 2, workflow_phases 6, messages 6, harness_audit 12, runs 4`,
and **every new row was proven to belong to this drive's two threads / two runs / one definition**
(new-not-mine = 0 in each table). Deleted in dependency order in one transaction; the re-diff read
`before = after` for all seven tables (315 / 287 / 1241 / 696 / 3151 / 3371 / 1899), 0 new, 0 missing.
`git status --short backend frontend` was empty after Task 1. Lock released after cleanup.

## Task 2: SQL fix and the re-drive failure arm (D-11, D-12)

### RED (`35ff22045`, against the reachable local Postgres; the DB module did NOT skip)

```
E   asyncpg.exceptions.UndefinedFunctionError: operator does not exist: uuid = text
E   HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.
E   asyncpg.exceptions.UndefinedFunctionError: operator does not exist: uuid = text
E   HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.
>       assert len(phase) == 1, "the active phase must be failed exactly once"
E       AssertionError: the active phase must be failed exactly once
E           RuntimeError: planted _build_resume_context failure
E       assert ([])   (case e: no finish_run write)
FAILED tests/test_289_ask_user_sql.py::test_get_ask_user_response_runs_on_real_postgres
FAILED tests/test_289_ask_user_sql.py::test_ask_user_response_exists_runs_on_real_postgres
FAILED tests/unit/test_289_redrive_failure.py::test_a_raising_resume_ends_the_run_failed_with_words
FAILED tests/unit/test_289_redrive_failure.py::test_a_raising_build_context_ends_the_run_failed_and_still_returns
FAILED tests/unit/test_289_redrive_failure.py::test_a_failing_failure_arm_is_logged_and_swallowed
FAILED tests/unit/test_289_redrive_failure.py::test_no_active_phase_still_finishes_the_run_failed
6 failed, 1 passed
```

(The one pass is case (c), "an already-terminal run is not rewritten", which is vacuously true at
base because base writes nothing. It is meaningful only GREEN, where the other four prove writes
happen.)

### GREEN (`7c07523b3`)

```
tests/test_289_ask_user_sql.py::test_get_ask_user_response_runs_on_real_postgres PASSED
tests/test_289_ask_user_sql.py::test_ask_user_response_exists_runs_on_real_postgres PASSED
tests/unit/test_289_redrive_failure.py::test_a_raising_resume_ends_the_run_failed_with_words PASSED
tests/unit/test_289_redrive_failure.py::test_a_raising_build_context_ends_the_run_failed_and_still_returns PASSED
tests/unit/test_289_redrive_failure.py::test_a_run_already_terminal_is_not_rewritten PASSED
tests/unit/test_289_redrive_failure.py::test_a_failing_failure_arm_is_logged_and_swallowed PASSED
tests/unit/test_289_redrive_failure.py::test_no_active_phase_still_finishes_the_run_failed PASSED
7 passed
```

Neighbouring suites: `test_harness_resume.py tests/unit/test_185_engine_attachment.py
tests/unit/test_256_producer_shells.py test_200_human_gate_pause.py` + the two new files:
**105 passed, 1 failed**; the one failure is inherited (see Deviations / deferred).

### W1 greps and the AST check

| Check | Base | After |
|---|---|---|
| `grep -c '\$1::uuid::text' backend/app/db/workflows.py` | 0 | **2** |
| `grep -cE '>>.run_id. = \$1::text[[:space:]]*$' backend/app/db/workflows.py` | 4 (:1731, :1767, :1803, :2329) | **2** (:1767, :1803, NOT edited, legitimately text) |
| `git diff --ignore-space-at-eol --numstat dcf6ba649 -- backend/app/db/workflows.py` | | `2	2` |
| `grep -c "async def _fail_redrive" backend/app/api/runs.py` | 0 | 1 |
| `grep -c "_fail_redrive(" backend/app/api/runs.py` | 0 | 3 (definition + two call sites) |

AST (`ast.get_source_segment` of the two AsyncFunctionDefs):

```
ask_user_response_exists True
get_ask_user_response True
```

The docstring mentions (:1716, :1754) are untouched; the run scoping (`tool_calls->0->>'run_id'` and
`wr.id = $1`, WR-06) is byte-identical apart from the cast (T-289-02).

### What `_fail_redrive` does (api/runs.py)

One helper, two call sites. It reads `SELECT status FROM workflow_runs WHERE id = $1` (no existing
pool reader took `(pool, run_id)`), returns if not `active`, then `get_active_phase` →
`fail_phase(id, "Your answer was saved, but the run could not continue.")` → `finish_run(failed)`
(also clears the thread anchor) → `write_audit(run_failed, user_id=<run owner from the paused-row
SELECT>, {"reason": "ask_user re-drive failed"})`. The whole body is wrapped; a failure logs the run
id only (T-256-14) and is swallowed. Call sites: `_wake`'s `except` (after the existing
`logger.exception`, before `finally`, which is byte-identical), and a new guarded region around
`_build_resume_context` + `resume_answered_tool_call_id`, whose except logs, calls `_fail_redrive`
and returns `True`.

## Task 3: the paused card (D-13, D-14)

### RED (`5970520b5`)

```
× 289-01 (D-13): a PAUSED run hands its card `paused` ...   expected 'undefined' to be 'true'
× 289-01 (D-13): an ACTIVE run's card is not paused ...      expected 'undefined' to be 'false'
× keeps the answer control after the window when the run is paused, and never says 'agent stopped'
× makes no claim that the run continues (that sentence waits for S5)
× answers with the WORKFLOW run id and reaches the answered state
Tests 5 failed | 5 passed
```

(The default-prop case "without `paused` the same past-window card still expires as before" passed
at RED, as it must: it pins the unchanged behaviour of every existing caller.)

### GREEN (`b3ef15a5f`)

The plan's verify list: `PendingAskCard.paused`, `PendingAskCard`, `PendingAskCard.retired.baseline`,
`PendingAskStack.oneInput`, `WorkflowRunPage`, `WorkflowRunPage.seam286.pin` →
**6 files passed, 267 tests passed, 0 failed.** The seam286 pin snapshots passed WITHOUT regeneration:
`git diff --numstat -- frontend/src/pages/__tests__/` is empty (vitest left an EOL-only stat-dirty
mark on the `.snap` file, zero content lines; restored with a single-file `git checkout --`).

`PAUSED_WAITING_LINE` = "The answer window has passed. The run is paused and still waiting for your
answer." It makes no continuation claim (asserted: `not.toMatch(/continue/i)`). The expired-card
answer control is the existing live-answer layout (choices, free text, Send): D-14, no new layout, no
sketch needed.

Acceptance greps: `paused?: boolean` → 1; `PAUSED_WAITING_LINE` → 3 (declaration, prop doc, render);
`paused={runStatus === "paused"}` in WorkflowRunPage.tsx → 1.

### Typecheck set diff (`npx tsc -p tsconfig.app.json --noEmit`, per-file error-code set, positions stripped)

- Before GREEN (base source + RED tests): 57 unique lines, of which 2 are the RED tests' own
  (`PAUSED_WAITING_LINE` not exported; `paused` not a prop).
- After GREEN: 55. **Only-after: none.** Only-before: exactly those 2 RED lines.
  The 55 are inherited and unrelated (e.g. `MessageSkeleton.tsx` JSX namespace,
  `ExpertAuthoringStudio.tsx` unused imports).

## G-5 record

Triples re-derived with the CLAUDE.md recipe at this plan's HEAD (six-digit quick buckets
subtracted). Ledger rows are written by plan 05, not here.

| File | commits / phases / lines (after) | lines before → after | hook counts before → after |
|---|---|---|---|
| `backend/app/db/workflows.py` | 54 / 28 / 2767 | 2767 → 2767 (2 tokens, 2 lines changed) | n/a |
| `backend/app/api/runs.py` | 43 / 20 / 1798 | 1755 → 1798 (+43: one helper + one guarded region + one call) | n/a |
| `frontend/src/components/panel/PendingAskCard.tsx` | 18 / 10 / 1042 | 1013 → 1042 (+29: one prop, one constant, one render arm, one dep) | `useState(` 2 → 2; `useState[(<]` 7 → 7; `useEffect(` 2 → 2 |
| `frontend/src/pages/WorkflowRunPage.tsx` | 32 / 13 / 1581 | 1580 → 1581 (+1: ONE attribute, no import/hook/state/effect) | `useState(` 1 → 1; `useState[(<]` 4 → 4; `useEffect(` 4 → 4 |

## Named gap: PendingAskStack

D-13 for the chat panel's `PendingAskStack` (W5) was decided at planning by reading the code: the
stack CANNOT derive the run's paused status from data it already holds, so it is NOT changed here.
Evidence, re-checked by grep at this plan's HEAD (moved lines recorded at their new position):

- The stack's only run signals are `useWorkflowLockForThread(threadId)` and `usePhases(threadId)`:
  `frontend/src/components/panel/PendingAskCard.tsx:857-858` (was :828-830 at base; moved by this
  plan's +29 lines).
- `WorkflowLock` carries `runId`, `mode` ("harness" | "cap_paused"), `capPaused`,
  `continuesRemaining`, and **no run status**: `frontend/src/stores/streamsStore.ts:98, :140, :142, :144`.
- `capPaused` is the iteration-cap pause, `cap_paused = run_status == "cap_paused"`
  (`backend/app/api/threads.py:2177`), not the human-gate `paused`.
- The phases come from `reconcilePhases` (`frontend/src/providers/StreamsProvider.tsx:4640-4641`),
  which fetches `getThreadWorkflow`, whose wire DOES carry `run_status`
  (`frontend/src/lib/api/threads.ts:1546`; `backend/app/models/thread.py:440`) but returns only
  `Phase[]` and discards it.
- A paused run's human-input step stays DB `active`, which maps to `running`
  (`frontend/src/lib/phaseState.ts:61`; `backend/app/services/harness/human_input.py:60-77` keeps the
  step resumable rather than cancelled), so the phases read the same for paused and active.
- The `PendingAsk` itself carries no run status (`frontend/src/types/index.ts:1352-1370`).

Carrying `run_status` to the stack would need a new store field written in `StreamsProvider.tsx`
(G-5 FIRING, 109/42/5004) or `streamsStore.ts` (FIRING), or a new fetch in the stack: each is a new
touch outside this plan's one-prop budget. The chat-panel stack stays countdown-driven. **Plan 05
plants this as a seed** (trigger: the next phase whose `files_modified` names `StreamsProvider.tsx`
or `streamsStore.ts`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A stale SQL-string pin asserted the broken cast**
- **Found during:** Task 2 GREEN
- **Issue:** `backend/tests/test_harness_resume.py::test_ask_user_answered_vs_pending_query` asserted
  `"->>'run_id' = $1::text" in sql` for `ask_user_response_exists`, i.e. it pinned the exact text
  Postgres refuses. It passed at base and went red on the fix.
- **Fix:** the assertion now reads `$1::uuid::text`, with a 3-line comment pointing at the DB-backed
  proof. The scoping assertion is otherwise unchanged. The file's other pin (:243,
  `get_pending_ask_user`) and `test_288_waiting_on.py:128` target statements this plan did NOT edit
  and still pass.
- **Files modified:** `backend/tests/test_harness_resume.py` (not in `files_modified`)
- **Commit:** `7c07523b3`

**2. [Rule 3 - Blocking] The exact `?raw` line pin on PendingAskCard.tsx**
- **Found during:** Task 3 GREEN
- **Issue:** `PendingAskCard.retired.baseline.test.tsx` pins the card's segment count EXACTLY
  (`1014`); any edit reds it by design ("goes stale loudly, in the same commit as the change").
- **Fix:** re-baselined `1014 → 1043` with a dated note in the same commit, following the file's own
  supersede-in-place convention. The three retirement-sentence fences are untouched and green.
- **Files modified:** `frontend/src/components/panel/__tests__/PendingAskCard.retired.baseline.test.tsx`
  (not in `files_modified`)
- **Commit:** `b3ef15a5f`

**3. Drive method: API-level instead of a browser tab (D-11)**
- The plan allowed claude-in-chrome or headless Playwright through the login form. This executor
  signed in through the same GoTrue password grant the login form calls and drove the app's one
  kickoff path and the real answer route over HTTP. What D-11 asks for (the live log line on the
  `:8000` base backend) does not depend on the browser, and at base the card offers no answer control
  anyway (F-1). The run page UI was not exercised live in this plan; S5 in plan 05 is the live proof.

**4. Case (b)'s return value**
- `_redrive_paused_workflow_run` returns `True` when `_build_resume_context` raises, as the plan
  specified ("its normal success value"). The docstring's "Returns True if a re-drive was spawned"
  is therefore slightly broader now; a one-line comment at the return says why (the answer is
  recorded, the run ended truthfully, and the only caller ignores the value).

### Out of scope, recorded (not fixed)

- **`tests/test_200_human_gate_pause.py::test_no_twenty_fifth_audit_kind_was_added` is RED at
  base.** It asserts `len(_AUDIT_EVENT_TYPES) == 24`; the set is 25 since `daf6c123b`
  (`feat(204-02)`, `circuit_breaker_tripped`). This plan's diff to `db/workflows.py` is the 2 SQL
  lines only (`2	2`), so the failure is inherited. The file is under `tests/`, not `tests/unit`, so
  it is outside the backend baseline gate. The plan's "passes unchanged" criterion therefore reads:
  every case that passed at base still passes; this one was already red.
- **Cross-worktree contamination of the shared local DB (new finding).** A parallel worktree's
  `TestClient` test booted the real FastAPI lifespan, whose boot sweep `resume_stranded_workflows`
  ran against the developer's local DB, **claimed a live run that belonged to the `:8000` backend**,
  and tried to re-drive it inside the test process (attempt 1 above). Any `TestClient(app)` test that
  enters the lifespan can do this to any anchored `active`/`paused` run. Not fixed here (outside this
  plan's files); recommend plan 05 or the orchestrator plant it as a seed / reported bug, trigger: the
  next phase touching `main.py`'s lifespan or the harness resume sweep.
- **A resumed segment changes model** (research, "Not fixed, record it"): unchanged by this plan;
  S5 roster rows will show it.

## Known Stubs

None. `PAUSED_WAITING_LINE` is deliberately weaker than the 288 sentence ("the run continues as
soon as they answer"), which plan 05 restores only after S5 is driven green.

## Threat Flags

None. No new endpoint, auth path or schema. The answer route's owner scoping (T-289-01) is
untouched; `_fail_redrive` is reached only from the owner-scoped route after the paused-row SELECT
and `claim_run`; it logs the run id only (T-289-05).

## TDD Gate Compliance

Plan type `tdd`: `test(289-01)` `35ff22045` → `feat(289-01)` `7c07523b3`; `test(289-01)` `5970520b5`
→ `feat(289-01)` `b3ef15a5f`. Both RED runs failed for the intended reason before the GREEN commit.
No refactor commit was needed.

## Self-Check: PASSED

- FOUND: `backend/tests/test_289_ask_user_sql.py`, `backend/tests/unit/test_289_redrive_failure.py`,
  `frontend/src/components/panel/__tests__/PendingAskCard.paused.test.tsx`, this SUMMARY.
- FOUND commits: `dcf6ba649`, `3177d90dd`, `35ff22045`, `7c07523b3`, `5970520b5`, `b3ef15a5f`.
- `grep -c "uuid = text"` on this SUMMARY → 5; `grep -c "Phase 289 — G-5 audited reading" .planning/STATE.md` → 1.
- STATE.md and ROADMAP.md not modified by this executor.
