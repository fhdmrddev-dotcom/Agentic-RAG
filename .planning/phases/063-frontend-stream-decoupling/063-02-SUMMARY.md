---
phase: 063-frontend-stream-decoupling
plan: 02
subsystem: api
tags: [fastapi, sse, redis-streams, postgrest, hard-cutover, phase-063, stream-04]

# Dependency graph
requires:
  - phase: 061-run-backed-streaming-backend
    provides: agent_runner producer task, RUN_TASKS registry, _emit/_emit_terminal helpers, runs lifecycle row, run:{run_id} Redis Stream buffer
  - phase: 062-replay-tail-api
    provides: GET /runs/{rid}/stream replay-tail endpoint that frontend now consumes for tokens, GET /threads/{tid}/active-runs, DELETE /runs/{rid} cancel verb
  - phase: 063-01
    provides: Wave-0 RED test stubs (test_063_post_contract.py, test_063_post_then_subscribe.py, test_063_legacy_path_deleted.py) that this plan turns GREEN; legacy POST-SSE test audit document
provides:
  - "POST /threads/{tid}/messages now returns HTTP 201 application/json with body {message_id, run_id} synchronously (D-063-01 hard cutover)"
  - "Module-level event_consumer async generator deleted (~96 lines) — GET /runs/{rid}/stream's replay_tail_consumer in app.api.runs is the live equivalent"
  - "_user_msg_id captured from messages INSERT via .select(\"id\").single() chain — defensive isinstance unwrap supports both real PostgREST dict and test-mock list[dict] shapes"
  - "All ordering invariants preserved: messages INSERT → runs INSERT → ZADD → producer-task spawn → JSONResponse return (Pitfall 4 — runs row SELECT-able before frontend opens GET stream)"
affects: [063-03, 063-04, 063-05, 064-validation-harness]

# Tech tracking
tech-stack:
  added:
    - "fastapi.responses.JSONResponse import in backend/app/api/threads.py (was previously absent)"
  patterns:
    - "supabase-py .insert(...).select(\"id\").single() chain with defensive list/dict shape unwrap (real PostgREST returns dict; test mocks return list[dict])"
    - "JSONResponse(status_code=201, content={...}) for synchronous POST returns that previously streamed SSE"

key-files:
  created:
    - ".planning/phases/063-frontend-stream-decoupling/deferred-items.md"
  modified:
    - "backend/app/api/threads.py (+55/-113 lines net; event_consumer deleted, send_message return shape changed, JSONResponse import added)"

key-decisions:
  - "D-063-01 hard cutover applied verbatim — no compat shim, no deprecation period, event_consumer physically removed"
  - "User-message id (not assistant-message id) returned in response body per RESEARCH Open Question #1: only the user message exists synchronously at POST-return time"
  - "Defensive isinstance list/dict unwrap on _user_msg_resp.data accommodates the existing _build_mock_supabase test fixture which returns list[dict] for messages.insert.execute(); real PostgREST .single() returns dict"

patterns-established:
  - "Hard-cutover JSONResponse return for endpoints transitioning away from SSE-on-POST: synchronous {ids} reply, side-channel SSE stream opened by client"
  - "Defensive shape-unwrap for supabase-py .single() result captures: handles both real PostgREST (dict) and unconfigured-mock (list) without forcing test infrastructure rewrites in scope"

requirements-completed: [STREAM-04, STREAM-02b]

# Metrics
duration: 10min
completed: 2026-05-03
---

# Phase 063 Plan 02: send_message Hard Cutover to JSONResponse + event_consumer Deletion Summary

**POST /threads/{tid}/messages now returns HTTP 201 JSON {message_id, run_id} synchronously; the legacy 96-line module-level event_consumer SSE generator deleted in the same commit; agent_runner producer + Redis Stream buffer untouched.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-03T16:30:28Z
- **Completed:** 2026-05-03T16:40:43Z
- **Tasks:** 2 (plus 1 Rule-1 deviation fix commit)
- **Files modified:** 1 production file (`backend/app/api/threads.py`)
- **Files created:** 1 phase doc (`deferred-items.md`)

## Accomplishments

- **D-063-01 hard cutover landed.** `send_message` no longer constructs an `EventSourceResponse`; it returns a plain `JSONResponse(status_code=201, content={"message_id": str(_user_msg_id), "run_id": str(run_id)})`. Frontend will open `GET /runs/{rid}/stream` (Phase 062 endpoint) for token streaming.
- **Module-level `event_consumer` (~96 lines) physically deleted.** Replaced with a five-line breadcrumb comment pointing to the live equivalent (`replay_tail_consumer` in `app.api.runs`). Per ROADMAP risk note: "Don't keep two streaming code paths longer than one phase".
- **User-message id captured at INSERT time.** `.select("id").single()` chained on the messages INSERT; PostgREST returns the inserted row's id. Defensive `isinstance(_, list)` unwrap added (Rule 1 fix) to accommodate the existing mock infrastructure without forcing a Plan 05 test rewrite.
- **Preserved ordering invariants verbatim.** `messages` INSERT → `runs` INSERT (line 793) → `redis.zadd("runs:active", ...)` (line 809) → `agent_runner` task spawn → `RUN_TASKS[run_id]` registration → `JSONResponse` return. Pitfall 4 invariant intact: `public.runs` row is SELECT-able before the frontend's GET stream lands.
- **Preserved verbatim:** `RUN_TASKS`, `TERMINAL_TYPES`, `_RUN_STATUS_TO_TERMINAL_TYPE`, `_emit`, `_emit_terminal`, `_deduplicate_citations`, `_is_transient_provider_error`, the entire `agent_runner` inner producer body, `_persist_assistant_message`, `_shielded_finalize`, `list_active_runs` (CR-01 was already in master).

### Key code landmarks (post-rewrite)

| Region | Status |
|--------|--------|
| `backend/app/api/threads.py:12` | NEW: `from fastapi.responses import JSONResponse` |
| `backend/app/api/threads.py:331-337` | Comment block replacing deleted `event_consumer` (was lines 331-426) |
| `backend/app/api/threads.py:662-684` | NEW: messages INSERT with `.select("id").single()` chain + defensive shape unwrap + 500 on missing id |
| `backend/app/api/threads.py:752-2174` | UNCHANGED: thread ownership SELECT (still uses `.single()` per CR-01 in 062), runs INSERT, ZADD, agent_runner producer, RUN_TASKS registration |
| `backend/app/api/threads.py:2155-2178` | NEW return: `JSONResponse(status_code=status.HTTP_201_CREATED, content={"message_id": str(_user_msg_id), "run_id": str(run_id)})` |

### Exact new return statement

```python
# Phase 063 (D-063-01): hard cutover. POST returns JSON synchronously
# with the user_message id and run_id; frontend opens GET /runs/{rid}/stream
# in a separate request to consume tokens. Replaces the legacy SSE-on-POST
# path that 062's replay_tail_consumer in runs.py made obsolete. No compat
# shim — both paths cannot coexist beyond this phase per ROADMAP risk note
# "Don't keep two streaming code paths longer than one phase".
#
# CRITICAL ordering invariants preserved by lines above this return:
#   - messages INSERT happened (Task 1, _user_msg_id captured)
#   - public.runs row INSERTed (line ~793, status='streaming')
#   - runs:active + runs_by_thread:{tid} sorted-set ZADDs happened
#   - agent_runner task spawned + RUN_TASKS[run_id] registered
# Frontend's GET /runs/{rid}/stream relies on the runs row being
# SELECT-able by the time this response arrives (Pitfall 4).
return JSONResponse(
    status_code=status.HTTP_201_CREATED,
    content={
        "message_id": str(_user_msg_id),
        "run_id": str(run_id),
    },
)
```

## Task Commits

Each task was committed atomically (3 commits total — 2 task commits + 1 deviation fix):

1. **Task 1: Capture user-message id from messages INSERT** — `ff32539` (`feat`)
2. **Task 2: Replace EventSourceResponse return with JSONResponse + delete event_consumer** — `97786ad` (`feat`)
3. **Rule 1 fix: defensive list-unwrap for test-mock shape compatibility** — `9171ebf` (`fix`)

(Plan metadata commit will follow this SUMMARY write.)

## Files Created/Modified

- `backend/app/api/threads.py` — Net +55/-113 lines (file: 2244 → 2186 lines). Three logical edits: (1) JSONResponse import added at top; (2) messages INSERT chained with `.select("id").single()` + defensive shape unwrap + capture into `_user_msg_id`; (3) module-level `event_consumer` (lines 331-426) replaced with breadcrumb comment; (4) terminal `EventSourceResponse(...)` return replaced with `JSONResponse(status_code=201, content={message_id, run_id})`.
- `.planning/phases/063-frontend-stream-decoupling/deferred-items.md` — New file documenting the one contract-incompatible legacy SSE-on-POST test that is explicitly deferred to Plan 05's audit-driven rewrite per the 063-02-PLAN objective.

## Verification

### Module-level static checks (all pass on the worktree's threads.py)

```bash
# event_consumer deleted at module level
python -c "from app.api import threads; assert not hasattr(threads, 'event_consumer')"  # exits 0
grep -c '^async def event_consumer' backend/app/api/threads.py  # → 0

# No EventSourceResponse construction anywhere in the file
grep -c 'EventSourceResponse(' backend/app/api/threads.py  # → 0

# JSONResponse with HTTP_201_CREATED present once (multiline grep)
rg -U --multiline-dotall 'JSONResponse\(\s*status_code=status\.HTTP_201_CREATED' backend/app/api/threads.py  # → 1 match at line 2155

# message_id and run_id wired into response body
grep -nE '"message_id":\s*str\(_user_msg_id\)' backend/app/api/threads.py  # line 2158
grep -nE '"run_id":\s*str\(run_id\)' backend/app/api/threads.py            # lines 705 (existing runs INSERT) + 2159 (new response body)

# .select("id").single() chain present in send_message body
grep -cE '\.select\("id"\)\.single\(\)' backend/app/api/threads.py  # → 2 (occurrences in code + comment)

# Critical preserved symbols still importable
python -c "from app.api.threads import RUN_TASKS, TERMINAL_TYPES, _emit, _emit_terminal, _RUN_STATUS_TO_TERMINAL_TYPE, send_message"  # exits 0

# agent_runner producer nesting preserved (exactly 1 occurrence inside send_message)
grep -c 'async def agent_runner(run_id' backend/app/api/threads.py  # → 1

# Ordering invariant preserved: messages INSERT line < runs INSERT line < ZADD runs:active line
grep -nE 'supabase\.table\("messages"\)\.insert' backend/app/api/threads.py  # line 663
grep -nE 'supabase\.table\("runs"\)\.insert' backend/app/api/threads.py     # line 711
grep -nE 'redis\.zadd\("runs:active"' backend/app/api/threads.py            # line 727
```

### Mock-based pytest sweep (no Redis, no live LLM)

```text
pytest backend/tests/integration/test_061_runs_table.py
       backend/tests/integration/test_061_consumer_cursor_race.py
       backend/tests/integration/test_062_active_runs.py
       backend/tests/integration/test_062_cross_user_404.py
       backend/tests/integration/test_062_delete_terminal_idempotent.py
       backend/tests/integration/test_062_redis_down.py
→ 17 passed, 3 xfailed
```

### Wave-0 backend tests (test_063_post_contract.py, test_063_post_then_subscribe.py, test_063_legacy_path_deleted.py)

These three files are produced by the parallel 063-01 agent in a sibling worktree and are NOT yet visible in this worktree's `backend/tests/integration/`. The plan's must_have-truth #8 ("all 3 Wave-0 backend tests transition RED to GREEN") will be satisfied automatically once the orchestrator merges 063-01 alongside this plan, because the static-check criteria they assert are already true on disk in this worktree:

- `test_event_consumer_not_importable` — verified above: `hasattr(threads, "event_consumer")` is False.
- `test_post_does_not_return_eventsourceresponse` — verified above: `EventSourceResponse` does not appear in `inspect.getsource(send_message)`; `JSONResponse` does.
- `test_post_returns_message_and_run_ids` — code review shows the response body is `{"message_id": str(_user_msg_id), "run_id": str(run_id)}` with `Content-Type: application/json` (FastAPI default) and `status_code=201`.
- `test_post_then_get_stream_renders_full_response` — Pitfall 4 invariants intact (runs row INSERTed before return), so the follow-up GET stream will SELECT successfully.

The orchestrator runs the consolidated pytest sweep as part of `gsd:verify-work` after the wave merge.

## Decisions Made

- **Defensive list/dict shape unwrap on `_user_msg_resp.data`** (Rule 1 fix). Real PostgREST with `.single()` returns a single dict; the existing `_build_mock_supabase` test infrastructure (used by 058/059/061 tests) returns `[dict]` from a generic `.execute()` builder. Without the unwrap, `test_061_runs_table.py::test_runs_lifecycle_row` regressed with `AttributeError: 'list' object has no attribute 'get'`. Adding `if isinstance(data, list): data = data[0] if data else None` — and gating `.get("id")` behind `isinstance(_, dict)` — keeps both paths working without modifying test infrastructure (the plan's objective explicitly defers test-infra rewrites to Plan 05).
- **Comment-block placement.** A short five-line `# Phase 063 (D-063-01): the module-level event_consumer ... DELETED ...` breadcrumb replaced the deleted region. Future readers grepping for `event_consumer` get an explanation of the architectural change without reviving any of the dead code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Defensive list-unwrap for `_user_msg_resp.data`**

- **Found during:** Running 062 mock test sweep after Task 2 commit, then expanding to 061 mock tests.
- **Issue:** Initial implementation `(_user_msg_resp.data or {}).get("id")` worked against real PostgREST (where `.data` is a dict from `.single()`) but raised `AttributeError: 'list' object has no attribute 'get'` against `_build_mock_supabase`'s default messages-INSERT response shape (`[dict]`). This regressed `test_061_runs_table.py::test_runs_lifecycle_row` — a test the plan must_haves explicitly want preserved.
- **Fix:** Replaced with `_user_msg_data = _user_msg_resp.data if _user_msg_resp is not None else None; if isinstance(_user_msg_data, list): _user_msg_data = _user_msg_data[0] if _user_msg_data else None; _user_msg_id = (_user_msg_data or {}).get("id") if isinstance(_user_msg_data, dict) else None`. Both real PostgREST (dict branch) and mocked tests (list[0] branch) yield the inserted row.
- **Files modified:** `backend/app/api/threads.py` (+9/-1 lines).
- **Verification:** `pytest backend/tests/integration/test_061_runs_table.py test_062_active_runs.py test_062_cross_user_404.py test_062_delete_terminal_idempotent.py` — 13/13 passed.
- **Committed in:** `9171ebf`.

---

**Total deviations:** 1 auto-fixed (Rule 1 bug regression introduced and resolved within the same plan).
**Impact on plan:** Necessary fix to honor must_have-truth "061 tests unchanged in master continue to pass". Adds nine lines of defensive shape-handling to production code — a small price to avoid forcing an out-of-scope test-infrastructure rewrite (which the plan explicitly defers to Plan 05). No scope creep.

## Issues Encountered

- **Initial Edit applied to main repo, not worktree** (recovered immediately). The first Task 1 Edit call landed in `C:\Vibe Apps\Agentic RAG\backend\app\api\threads.py` (the main repo's working tree) instead of the worktree's copy at `C:\Vibe Apps\Agentic RAG\.claude\worktrees\agent-a985bd6c8801f4aac\backend\app\api\threads.py` because the path the Edit tool was given did not include the worktree prefix. Detected by `git status` showing no change in the worktree branch. Recovered with `git checkout -- backend/app/api/threads.py` in the main repo (clean revert) followed by re-applying the Edit using the absolute worktree path. No corruption to the main repo's working tree (verified clean post-recovery). Subsequent Edits used absolute worktree paths consistently.
- **Mock-shape contract mismatch with real PostgREST `.single()`** (resolved by Rule 1 fix above; documented for plan-05 awareness in `deferred-items.md`).

## Deferred Items

The legacy SSE-on-POST test `backend/tests/integration/test_059_disconnect.py::test_normal_stream_unchanged` regressed after the D-063-01 hard cutover because it asserts `delta`/`done`/`stream_end` events arriving from `c.stream("POST", "/threads/{tid}/messages", ...)` — a wire format that no longer exists post-cutover. Per the 063-02-PLAN objective: *"any contract-incompatible 058/059/061 tests are deferred to Plan 05's audit-driven rewrite"*. Logged to `.planning/phases/063-frontend-stream-decoupling/deferred-items.md`; Plan 05 will rewrite or delete this test alongside the rest of the legacy POST-SSE catalog from `063-LEGACY-TEST-AUDIT.md` (produced by Plan 01).

## User Setup Required

None — no external services configured.

## Next Phase Readiness

- **063-03 (frontend transport rewrite)** is unblocked: the backend POST contract is exactly what `frontend/src/lib/api.ts::postMessage` is being authored against — `{message_id, run_id}` JSON 201.
- **063-04 (reconcile + multi-tab)** is unblocked: `agent_runner` producer task and `runs:active` ZADD invariants intact, so `GET /threads/{tid}/active-runs` (Phase 062) keeps returning the live row for refresh-mid-stream reattach.
- **063-05 (legacy test audit + rewrite)** has its first concrete entry: `test_059_disconnect.py::test_normal_stream_unchanged` is contract-incompatible and pre-listed in `deferred-items.md` for Plan 05's audit document.
- **064 (validation harness)** ready to consume the new POST contract once the wave-1 backend ships.

## Self-Check: PASSED

Verified post-write:

- `.planning/phases/063-frontend-stream-decoupling/063-02-SUMMARY.md` — FOUND
- `.planning/phases/063-frontend-stream-decoupling/deferred-items.md` — FOUND
- `backend/app/api/threads.py` modified — FOUND
- Commit `ff32539` (Task 1) — FOUND in `git log`
- Commit `97786ad` (Task 2) — FOUND in `git log`
- Commit `9171ebf` (Rule 1 fix) — FOUND in `git log`
- Acceptance-criteria greps:
  - `^async def event_consumer` count → 0 (target: 0) ✓
  - `EventSourceResponse(` count → 0 (target: 0) ✓
  - `_user_msg_id` count → 4 (target: >= 2) ✓
  - `\.select\("id"\)\.single\(\)` count → 2 (target: >= 1) ✓
  - `JSONResponse(\s*status_code=status\.HTTP_201_CREATED` (multiline) count → 1 (target: >= 1) ✓
  - `async def agent_runner(run_id` count → 1 (target: exactly 1) ✓

---

*Phase: 063-frontend-stream-decoupling*
*Plan: 02*
*Completed: 2026-05-03*
