# Phase 289 Plan 01: SEED-360 (in progress)

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
`git status --short backend frontend` was empty after Task 1.
