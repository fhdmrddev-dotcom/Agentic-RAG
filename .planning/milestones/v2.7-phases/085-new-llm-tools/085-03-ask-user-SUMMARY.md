---
phase: 085-new-llm-tools
plan: 03
subsystem: backend
tags: [ask-user, redis-pubsub, cross-worker, tool-dispatcher, sse, rest-endpoint, lifespan-shutdown, phase-085]

# Dependency graph
requires:
  - phase: 083-foundation-tool-dispatch-extraction-bug-fixes
    provides: ToolContext / ToolResult / _TOOL_REGISTRY / dispatch_tool entry point
  - phase: 084-workspace-filesystem-backend
    provides: handler-as-service pattern + tool-schema authoring convention
  - phase: 061-run-backed-streaming
    provides: get_redis() singleton + run:{run_id} Stream + _emit() canonical XADD shape
  - phase: 062-runs-endpoint
    provides: runs.py:cancel_run integration site (D-062-08..13 idempotent cancel verb)
  - phase: 067-streamsprovider-resync
    provides: messages.tool_calls kind discriminator pattern (Phase 075.4 system_warning precedent)
  - plan: 085-01-todos
    provides: migration 055 (runs.parent_run_id + messages.tool_calls.kind comment listing ask_user_prompt | ask_user_response)
  - plan: 085-02-task-service
    provides: ToolContext.tool_call_id field + per-dispatch population in agent_runner (channel-naming hook); ask_user_max_timeout_seconds Settings field
provides:
  - "backend/app/services/ask_user_service.py — FIRST Redis pub/sub usage in the repo: subscribe_for_response + publish_response + publish_cancel_sentinel + broadcast_shutdown_sentinel_to_all helpers (~190 lines)"
  - "backend/app/services/tool_dispatcher.py — _handle_ask_user handler with load-bearing 5-step SUBSCRIBE-first ordering + ask_user registry entry (tool #24 — phase-end)"
  - "backend/app/api/runs.py — POST /runs/{rid}/ask_user_response endpoint (persist-FIRST/PUBLISH-second durability discipline) + cancel-sentinel publish INSERTED before task.cancel() in cancel_run"
  - "backend/app/main.py — lifespan shutdown sentinel broadcast INSERTED before RUN_TASKS cancel loop (2s deadline + best-effort wrap; never blocks shutdown on Redis failure)"
  - "Redis channel namespaces (NEW): ask_user:{run_id}:{tool_call_id} (per-call pubsub channel); ask_user:channels:{run_id} (SET — channel registry for cancel + shutdown sweeps; 3600s safety TTL)"
  - "Wire format additions (messages.tool_calls.kind): ask_user_prompt + ask_user_response (extends the Phase 075.4 system_warning kind pattern)"
  - "SSE event additions: ask_user_prompt (from handler, on run:{rid}) + ask_user_response (from POST endpoint, on run:{rid}) — both ride the existing _emit XADD path"
  - "Registry: 23 -> 24 tools (phase-end gate; Plan 04 adds tool schemas + UAT matrix)"
affects: [phase-086-streamsprovider-demux, phase-087-panel-ui, plan-085-04-rest-tools-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FIRST Redis pub/sub usage in the codebase. Phase 061+ uses XADD/XREAD on Redis Streams (durable, replayable); pub/sub is fire-and-forget (lost without a subscriber). The choice is correct here because the SUBSCRIBE-FIRST + persist-BEFORE-emit ordering closes the race AND the durability path lives on the messages table — pub/sub is just the wake-up signal."
    - "Load-bearing 5-step ordering in _handle_ask_user (RESEARCH §A.3 + FC#10): SUBSCRIBE → SADD channels:set → messages-row insert (kind='ask_user_prompt') → SSE emit → block on get_message. Steps 1-2 register the subscriber BEFORE the user has any way to know to respond; step 3 makes the prompt durable across reloads; step 4 is the earliest user-visible signal; step 5 is safe to block on because the race window is closed."
    - "Persist-FIRST / PUBLISH-second on the POST endpoint (RESEARCH §A.7): messages row with kind='ask_user_response' is the durable record; PUBLISH is the live-wake signal. Returns 200 once persist succeeds even if PUBLISH has no subscriber — the user's answer is recorded regardless of whether the agent is still alive."
    - "PUBLISH-FIRST / task.cancel-second in cancel_run (RESEARCH §A.5): paused handler wakes + returns normal ToolResult BEFORE CancelledError propagates. Agent loop iterates once more to write the response row. Without this, ask_user_prompt rows would have no companion response row → GET /threads/{tid}/ask_user/pending returns the prompt forever."
    - "PUBLISH-FIRST / RUN_TASKS-cancel-second in lifespan shutdown (RESEARCH §A.6): broadcast {kind: shutdown} to all ask_user:channels:* SET keys; paused handlers wake + return; agent loops finalize with status='failed' instead of stuck 'streaming' after restart."
    - "Cross-worker channel registry via Redis SET (ask_user:channels:{run_id}): paused handler may be on Worker A while POST cancel/response lands on Worker B; the SET is the rendezvous. Includes SADD on subscribe entry + SREM in finally + 3600s safety TTL for leak recovery."
    - "Cleanup discipline (R2 — no leaked SUBSCRIBE clients): pubsub.unsubscribe → asyncio.wait_for(pubsub.aclose, timeout=2.0) [Pitfall 3] → SREM channels:set, each in its own try/except so a single failure doesn't mask the rest."
    - "Pitfall 1 (redis-py async pubsub spin-loop): get_message(timeout=1.0), NEVER 0; wrap loop in asyncio.wait_for(timeout=N) for the deadline."
    - "Lazy import of ask_user_service inside handler + cancel + lifespan call sites — keeps module-load cheap and avoids any circular-import risk (publish_response/publish_cancel_sentinel/broadcast_shutdown_sentinel_to_all are imported at use time, not module load time)."

key-files:
  created:
    - "backend/app/services/ask_user_service.py"
    - "backend/tests/integration/test_085_ask_user_handler.py"
    - "backend/tests/integration/test_085_ask_user_endpoint.py"
    - "backend/tests/integration/test_085_ask_user_cancel.py"
    - "backend/tests/integration/test_085_lifespan_shutdown.py"
    - ".planning/phases/085-new-llm-tools/deferred-items.md (pre-existing test_062 FK-violation log)"
  modified:
    - "backend/app/services/tool_dispatcher.py (_handle_ask_user handler + 'ask_user' registry entry; tool count 23 -> 24)"
    - "backend/app/api/runs.py (BaseModel + AskUserResponseBody + submit_ask_user_response endpoint + publish_cancel_sentinel call BEFORE task.cancel in cancel_run)"
    - "backend/app/main.py (broadcast_shutdown_sentinel_to_all call BEFORE the RUN_TASKS cancel loop, with 2s wait_for + best-effort wrap)"
    - "backend/tests/unit/test_tool_dispatcher.py (EXPECTED_TOOLS list + registry-count assertion 23 -> 24 — Rule 1 directly-caused fix)"

key-decisions:
  - "Inline the 5-step SUBSCRIBE-first ordering in _handle_ask_user rather than calling ask_user_service.subscribe_for_response — the helper bundles SUBSCRIBE + SADD + block-on-message in one function call, but steps 3-4 (messages-row insert + SSE emit) MUST happen between the SADD and the block. Splitting the helper would either (a) require a refactor-prone callback-style API or (b) move the persistence/emit steps to the wrong side of the race window. The handler's inline ordering is explicit and audit-friendly; ask_user_service still exports the helper for tests, cancel, and shutdown paths."
  - "PUBLISH failure on POST endpoint is logged, not raised — the messages row is the durable record. Returning non-200 would mislead the user into thinking their answer wasn't recorded when in fact the only loss is the live-wake (which doesn't matter if the SUBSCRIBE is already dead because the run will terminate via the shutdown sentinel path anyway). RESEARCH §A.7 codifies this discipline."
  - "messages-row insert failure inside _handle_ask_user is logged but NON-FATAL to the handler — the handler still proceeds to emit SSE + block on get_message. The missing durable row only affects the GET /pending replay surface (Plan 04 owns that endpoint), not the live flow. Better to let the user answer than to fail the agent loop on a transient Postgres hiccup."
  - "Channels:set safety TTL of 3600s — if a worker crashes mid-handler before its SREM runs in the finally, the channel name stays in the SET forever. The 3600s EXPIRE on SADD is the eventual-consistency safety net; a stale entry means one extra (no-op) PUBLISH per cancel/shutdown sweep until the TTL fires, which is harmless."

patterns-established:
  - "Redis-pub/sub-as-a-wake-signal-over-durable-storage idiom: the durable record (messages table) is the source of truth; pub/sub is just the cheap live-wake. This separation is reusable for any future pause/resume tool (e.g. a human_review tool, a wait_for_event tool) where the agent needs to block on an external signal that may or may not arrive while the worker is alive."
  - "Cross-worker rendezvous via Redis SET + channel-name advertisement (ask_user:channels:{rid}): the canonical pattern for any future feature that needs Worker B to PUBLISH a signal to Worker A. The SET is the discovery mechanism; the channel is the wake-up."
  - "Ordering-invariant tests via call-time recording: tests that assert 'X happens before Y' use AsyncMock/side_effect recorders that append timestamps or call indices to a shared list, then assert list ordering. Cleaner than mock.call_count or sleep-based timing tests."

requirements-completed:
  - TOOL-03
  - TOOL-04

# Metrics
duration: ~13min
completed: 2026-05-28
---

# Phase 085 Plan 03: ask_user (Redis pub/sub) Summary

**Agent pauses on `ask_user`, user submits via panel, agent resumes with response in tool_result — works cross-worker, times out cleanly, Stop button + uvicorn shutdown clean up paused runs without leaking SUBSCRIBE clients. FIRST Redis pub/sub usage in the codebase.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-28T12:26Z
- **Completed:** 2026-05-28T12:39Z
- **Tasks executed:** 4 of 4
- **Files modified:** 9 (5 created + 4 modified)
- **Tests passing:** 92/92 across the Phase 085 surface
  - test_085_ask_user_handler.py: 17/17 (helpers + handler)
  - test_085_ask_user_endpoint.py: 5/5 (POST endpoint)
  - test_085_ask_user_cancel.py: 2/2 (cancel-sentinel ordering)
  - test_085_lifespan_shutdown.py: 3/3 (shutdown sentinel ordering)
  - Plan 02 surface (concurrency, sub_agent_emit, task_service, todos, tool_registration): 50/50 — no regressions
  - test_tool_dispatcher.py: 15/15 (24-entry assertion updated 23 -> 24)

## Accomplishments

- **FIRST Redis pub/sub usage in the codebase shipped end-to-end.** Phase 061+ uses XADD/XREAD on Streams (durable, replayable, MAXLEN-trimmed); pub/sub is fire-and-forget. The whole load-bearing dance in this plan exists because pub/sub doesn't queue — PUBLISH without a subscriber is lost forever. The SUBSCRIBE-FIRST + persist-BEFORE-emit ordering closes that race; the cross-worker channel-set registry handles the multi-worker case; the cancel + shutdown sentinels handle the cleanup paths.
- **`ask_user_service.py` ships 4 helpers** (~190 lines):
  - `subscribe_for_response` — pubsub.subscribe → SADD channels:set → asyncio.wait_for(get_message, timeout). Returns parsed JSON or None. Pitfall-1-safe (timeout=1.0, never 0) and Pitfall-3-safe (asyncio.wait_for(pubsub.aclose, timeout=2.0) in finally).
  - `publish_response` — PUBLISH kind='response' with response_text + choice_index; returns subscriber count (Phase 086 panel can use this for UX hints later).
  - `publish_cancel_sentinel` — SMEMBERS channels:set, PUBLISH kind='cancel' to each. No-op if empty. Best-effort, never raises.
  - `broadcast_shutdown_sentinel_to_all` — SCAN ask_user:channels:*, SMEMBERS each, PUBLISH kind='shutdown' to every channel. Best-effort.
- **`_handle_ask_user` handler with 5-step load-bearing ordering** (~120 lines added to tool_dispatcher.py):
  1. `pubsub.subscribe(channel)`            — SUBSCRIBE first; Redis acks
  2. SADD `ask_user:channels:{run_id}`      — advertise to cancel/shutdown sweeps
  3. messages-row insert (kind='ask_user_prompt')  — durable for reload survival
  4. emit `ask_user_prompt` SSE event       — frontend now learns to ask
  5. `await pubsub.get_message(timeout=1)` wrapped in `asyncio.wait_for(timeout=N)`
  Wake payloads: kind='response' → ToolResult(response_text); kind='cancel' → "ask_user cancelled by user stop"; kind='shutdown' → "ask_user interrupted by server shutdown"; timeout → "ask_user timed out — no response received within Ns". Validation gates: empty prompt, missing tool_call_id, non-integer timeout_seconds. Cleanup discipline (R2): unsubscribe → wait_for(aclose, 2s) → SREM, each in its own try/except.
- **POST /runs/{rid}/ask_user_response endpoint** (~120 lines added to runs.py):
  - Ownership SELECT → 404 (NOT 403) on cross-user per D-062-12 (T-085-T12 / T-085-T13)
  - Persist messages row with kind='ask_user_response' FIRST → durable even if SUBSCRIBE is dead (RESEARCH §A.7)
  - Emit ask_user_response SSE for live UI sync (non-fatal on failure)
  - PUBLISH via publish_response — wakes the paused SUBSCRIBE if alive
  - Returns 200 once persist succeeds; PUBLISH failure logged, not raised
- **cancel_run integration** (~20 lines added in runs.py): PUBLISH `publish_cancel_sentinel(redis, run_id)` BEFORE `task.cancel()` per RESEARCH §A.5 PUBLISH-first ordering. Wrapped in try/except (best-effort discipline matching the zombie-heal Redis ops).
- **Lifespan shutdown integration** (~12 lines added in main.py): `await asyncio.wait_for(broadcast_shutdown_sentinel_to_all(get_redis()), timeout=2.0)` BEFORE the `for task in RUN_TASKS.values(): task.cancel()` loop. Try/except wrap — NEVER blocks shutdown on Redis failure.
- **No regressions outside the new surface.** All 65 Plan 01 + 02 tests still GREEN; the only failing adjacent test (test_062_delete_happy::test_cancels_in_flight_producer) was pre-existing at the worktree base — logged to `deferred-items.md`.

## Load-bearing Ordering Invariants

This plan ships four PUBLISH/SUBSCRIBE/persist orderings that are correctness-critical. Each is verified by an integration test that records call order and asserts the textual ordering invariant:

| Invariant | Site | Test | Why it matters |
|-----------|------|------|----------------|
| SUBSCRIBE + SADD → messages-row insert → SSE emit → block on get_message | `_handle_ask_user` | `test_handle_ask_user_subscribe_first_ordering` | Closes the PUBLISH-before-SUBSCRIBE race (FC#10 / T-085-T16). Without it, a fast user response can PUBLISH before the SUBSCRIBE registers → message lost → agent hangs forever. |
| Persist messages row → PUBLISH | `submit_ask_user_response` (POST) | `test_post_ask_user_response_returns_200_when_publish_fails` | Durability — the user's answer is recorded even if the SUBSCRIBE is dead (worker restarted, etc.) per RESEARCH §A.7. |
| PUBLISH cancel sentinel → task.cancel() | `cancel_run` (DELETE) | `test_cancel_run_publishes_cancel_sentinel_when_channels_active` | Paused handler wakes + returns normal ToolResult before CancelledError propagates — agent loop iterates once more to write the response row. Without it, ask_user_prompt rows orphan their response row → GET /pending returns forever. |
| broadcast_shutdown_sentinel_to_all → RUN_TASKS cancel loop | `main.py` lifespan shutdown | `test_shutdown_broadcast_before_run_tasks_cancel` | Paused runs end as `status='failed'` instead of stuck `status='streaming'` after uvicorn restart (T-085-T17). |

## Task Commits

Each task was committed atomically with `--no-verify` (parallel worktree mode):

1. **Task 1: ask_user_service.py + Task 1 helper tests** — `c779e3f` (feat)
2. **Task 2: _handle_ask_user handler with SUBSCRIBE-first ordering + registry 23 -> 24** — `c6c0b27` (feat)
3. **Task 3: POST /runs/{rid}/ask_user_response + cancel-sentinel publish** — `e8556ac` (feat)
4. **Task 4: lifespan shutdown sentinel broadcast** — `8ed42aa` (feat)

Total commits this plan: 4 (one per task). The final metadata commit (this SUMMARY) is the orchestrator's, after merge.

## Files Created/Modified

### Created
- `backend/app/services/ask_user_service.py` — NEW. 4 helpers + module docstring documenting the channel-naming convention + ordering rules. ~190 LOC.
- `backend/tests/integration/test_085_ask_user_handler.py` — NEW. 17 tests: 7 helpers (subscribe timeout, subscribe+publish round-trip, SADD on entry, SREM on exit, publish_response payload shape, cancel sentinel broadcast across SET, shutdown broadcast across all keys + empty-SET no-op) + 10 handler tests (empty prompt, missing tool_call_id, SUBSCRIBE-first ordering invariant, response/cancel/shutdown/timeout/parallel-call payloads, registry entry, invalid timeout, channel-naming isolation).
- `backend/tests/integration/test_085_ask_user_endpoint.py` — NEW. 5 tests: 200 happy path, 404 cross-user (D-062-12), messages-row persistence with correct fields, publish payload shape, 200-on-PUBLISH-failure durability path.
- `backend/tests/integration/test_085_ask_user_cancel.py` — NEW. 2 tests: cancel-sentinel-then-task.cancel ordering with 2 active channels + 2 cancel sentinels received, no-spurious-PUBLISH empty-set path.
- `backend/tests/integration/test_085_lifespan_shutdown.py` — NEW. 3 tests: shutdown-broadcast-before-task-cancel ordering, lifespan-proceeds-when-broadcast-raises (best-effort), end-to-end paused-handler-receives-shutdown-text.
- `.planning/phases/085-new-llm-tools/deferred-items.md` — NEW. Logs the pre-existing test_062 FK-violation that surfaced during regression check; out of scope for Plan 03.

### Modified
- `backend/app/services/tool_dispatcher.py` — `_handle_ask_user` (~120 LOC) added between `_handle_write_todos` and `_TOOL_REGISTRY`; `"ask_user": _handle_ask_user` registry entry added (now 24 tools — phase-end gate).
- `backend/app/api/runs.py` — `from pydantic import BaseModel` import added; `AskUserResponseBody` Pydantic model + `submit_ask_user_response` POST endpoint (~120 LOC) added before the DELETE block; `publish_cancel_sentinel(redis, run_id)` call inserted in `cancel_run` immediately before `task.cancel()` (best-effort try/except).
- `backend/app/main.py` — `await asyncio.wait_for(broadcast_shutdown_sentinel_to_all(get_redis()), timeout=2.0)` block inserted BEFORE the existing `for task in RUN_TASKS.values(): task.cancel()` loop in lifespan shutdown. `asyncio` was already imported.
- `backend/tests/unit/test_tool_dispatcher.py` — `EXPECTED_TOOLS` list extended with `"ask_user"` (now 24 entries); `test_registry_has_exactly_23_entries` renamed to `test_registry_has_exactly_24_entries` (Rule 1 directly-caused test fix; same shape as Plan 02's 22 -> 23 bump).

## Decisions Made

- **Inline the 5-step ordering in `_handle_ask_user` rather than calling `subscribe_for_response`.** The helper bundles SUBSCRIBE + SADD + block-on-message in one function call, but steps 3-4 (messages-row insert + SSE emit) MUST happen BETWEEN the SADD and the block. Splitting the helper into a `(subscribe, await_message)` pair would require either a callback-style API or moving the persistence/emit to the wrong side of the race window. The inline form is explicit and audit-friendly. `ask_user_service` still exports the helper for tests and for the cancel + shutdown paths that don't need the persistence step.
- **PUBLISH failure on POST endpoint is logged, not raised.** The messages row is the durable record. Returning non-200 would mislead the user; the actual loss is just the live-wake, which doesn't matter when the SUBSCRIBE is already dead (the run will terminate via the shutdown sentinel path anyway). RESEARCH §A.7 codifies this discipline.
- **messages-row insert failure inside `_handle_ask_user` is logged but non-fatal to the handler.** The handler still proceeds to emit SSE + block on get_message. The missing durable row only affects the GET /pending replay surface (Plan 04 owns that endpoint), not the live flow. Better to let the user answer than to fail the agent loop on a transient Postgres hiccup.
- **Channels:set 3600s safety TTL.** If a worker crashes mid-handler before its SREM runs, the channel stays in the SET forever. The EXPIRE on SADD is the eventual-consistency safety net; a stale entry means one extra (no-op) PUBLISH per sweep until the TTL fires — harmless.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Directly-caused test fix] Updated test_tool_dispatcher.py registry-count assertion 23 -> 24**

- **Found during:** Task 2 (after committing the new registry entry).
- **Issue:** The pre-existing `test_registry_has_exactly_23_entries` would fail with `assert 24 == 23` after the Task 2 registry entry landed. Same shape as Plan 02's 22 -> 23 fix.
- **Fix:** Renamed test to `test_registry_has_exactly_24_entries`, added `"ask_user"` to `EXPECTED_TOOLS`, updated comments to reflect the phase-end gate (24 tools).
- **Files modified:** `backend/tests/unit/test_tool_dispatcher.py`
- **Verification:** test_tool_dispatcher.py 15/15 PASS (no regression on the 24-tool surface).
- **Committed in:** `c6c0b27` (Task 2).

**2. [Rule 1 — Test-code bug discovered during initial run] Recursion in mock-side_effect recorder**

- **Found during:** Task 3 (first pytest run of test_post_ask_user_response_persists_messages_row).
- **Issue:** Recorder used `original_insert = mock_builder.insert` + `mock_builder.insert.side_effect = _record_insert` where `_record_insert` calls `original_insert(...)` — that re-enters the mock and hits the same side_effect again, infinite recursion.
- **Fix:** Switched to inspecting `mock_builder.insert.call_args_list` AFTER the request returns instead of using a side_effect — simpler, no recursion risk.
- **Files modified:** `backend/tests/integration/test_085_ask_user_endpoint.py`
- **Verification:** test_post_ask_user_response_persists_messages_row PASS.
- **Committed in:** `e8556ac` (Task 3).

**Total deviations:** 2 auto-fixed (1 directly-caused test count bump + 1 test-code recursion bug). No scope creep, no architectural changes.

## Issues Encountered

- **Worktree base mismatch on agent startup.** The worktree was bootstrapped from `da319985` (one commit ahead of the expected Plan 03 base `a9c7e0b`). Followed the `<worktree_branch_check>` protocol — `git reset --hard a9c7e0b` corrected the base. Safe in a fresh worktree (no user changes to lose).
- **Pre-existing test_062_delete_happy FK-violation surfaced during regression check.** Reproduced at the worktree base commit before any Plan 03 commits — NOT caused by this plan. The test inserts a `runs` row without seeding the parent `threads` row first; the existing `fk_aware_runs_factory` fixture solves the same problem elsewhere but test_062 hasn't been migrated yet. Logged to `deferred-items.md`. Out of scope for Plan 03 per the executor SCOPE BOUNDARY rule.

## User Setup Required

None.

- Migration 055 (Plan 01) already in the live DB — covers the `messages.tool_calls.kind` doc-comment listing `ask_user_prompt | ask_user_response`.
- ToolContext.tool_call_id (Plan 02) is already populated per-dispatch in `agent_runner` — handler reads `ctx.tool_call_id` for channel naming.
- `ask_user_max_timeout_seconds` Settings field (Plan 02) is already in `app/config.py` at default 1800s.

Local dev Redis must be up (it is, via `docker-compose.dev.yml` — verified in pre-Task-1 readiness check). Cloud Redis works identically (Upstash `rediss://...` URL — REDIS-SETUP.md key conventions unchanged; pub/sub channels are created on first subscribe, no schema).

## Next Phase Readiness

- **Plan 04 (REST endpoints + tool schemas + UAT) is unblocked.** The 3 GETs (`/threads/{tid}/todos`, `/threads/{tid}/ask_user/pending`, `/threads/{tid}/tasks`) can be authored against Plan 01 + 02 + 03's now-stable wire format. Tool schema authoring in `openai_service.get_tools()` can reference `_handle_ask_user`'s argument shape (`prompt: str`, `options: list[str] | null`, `timeout_seconds: int | null`). UAT matrix from RESEARCH §Validation Architecture can run against landed code.
- **Phase 086 (StreamsProvider demux)** — wire format for the panel is locked: `ask_user_prompt` SSE has `{tool_call_id, prompt, options, timeout_seconds}`; `ask_user_response` SSE has `{tool_call_id, response_text, choice_index}`. The frontend demuxer routes both on the `tool_call_id` field; the pair joins the prompt row to the response row via `tool_call_id` (same join key as the messages.tool_calls payload).
- **Phase 087 (Panel UI)** — POST /runs/{rid}/ask_user_response is the submit endpoint; body shape is `AskUserResponseBody`. The panel can render `options` as buttons if non-null; free-text input otherwise. Reload survival is owned by Plan 04's GET /threads/{tid}/ask_user/pending.

## Threat Coverage

All Plan 03 STRIDE register threats mitigated:

- **T-085-T12** (Spoofing — user Y answers user X's prompt) — `submit_ask_user_response` ownership SELECT via `.eq("user_id", current_user["id"])`; 404 (NOT 403) on miss per D-062-12. Tested by `test_post_ask_user_response_cross_user_returns_404`.
- **T-085-T13** (Tampering — replay after run finalized) — same ownership SELECT covers this implicitly: a finalized run still passes the ownership check (the row is still visible to the user) but the PUBLISH lands on a dead SUBSCRIBE; the messages row insert is still durable and the GET /pending endpoint will not return that prompt again because the kind='ask_user_response' companion row now exists. Test surface for "GET /pending excludes answered prompts" lives in Plan 04.
- **T-085-T14** (DoS — leaked Redis SUBSCRIBE clients) — all SUBSCRIBE sites wrap in try/finally with `unsubscribe(channel)` + `asyncio.wait_for(pubsub.aclose, timeout=2.0)` + SREM channels:set. Each cleanup step in its own try/except (idempotent discipline). Tested implicitly via the timeout + cancel + shutdown integration tests (handler returns clean in every path).
- **T-085-T15** (DoS — redis-py async pubsub spin-loop at 100% CPU) — `get_message(timeout=1.0)`, never 0; wrapped in `asyncio.wait_for(timeout=N)` for the deadline. Codified at the helper + handler + tests via Pitfall 1 docstring references.
- **T-085-T16** (Race condition — PUBLISH lands before SUBSCRIBE registered → message lost) — strict 5-step ordering in `_handle_ask_user`: SUBSCRIBE → SADD → persist row → emit SSE → block. User has no signal to respond until the SSE event fires; subscriber is already registered. Tested by `test_handle_ask_user_subscribe_first_ordering` (call-time recording asserts `sadd` index < `messages_insert` index < `sse_emit` index).
- **T-085-T17** (DoS / Repudiation — uvicorn shutdown leaves paused runs stuck `streaming` forever) — lifespan hook broadcasts shutdown sentinel BEFORE the RUN_TASKS cancel loop; paused handlers wake + return normal ToolResult; agent loop finalizes as `error` (translated to `failed` for the runs CHECK enum per Plan 02's deviation). Tested by `test_shutdown_broadcast_before_run_tasks_cancel` + `test_paused_handler_receives_shutdown_sentinel_end_to_end`.

T-085-T18 (Information disclosure via local Redis channel names) — accepted per the threat register (local Redis is trusted; channel naming uses opaque UUIDs).

## Self-Check

Verified before returning:

- `backend/app/services/ask_user_service.py` — FOUND (commit `c779e3f`)
- `backend/app/services/tool_dispatcher.py` — `_handle_ask_user` + `"ask_user": _handle_ask_user` registry entry verified by Grep (commit `c6c0b27`)
- `backend/app/api/runs.py` — `class AskUserResponseBody`, `submit_ask_user_response`, `publish_cancel_sentinel` import + call, all verified by Grep (commit `e8556ac`)
- `backend/app/main.py` — `broadcast_shutdown_sentinel_to_all` import + call verified by Grep; line ordering: broadcast at line 230 < RUN_TASKS cancel loop at line 241+ (commit `8ed42aa`)
- `backend/tests/integration/test_085_ask_user_handler.py` — FOUND (17 tests; commit `c779e3f` + `c6c0b27`)
- `backend/tests/integration/test_085_ask_user_endpoint.py` — FOUND (5 tests; commit `e8556ac`)
- `backend/tests/integration/test_085_ask_user_cancel.py` — FOUND (2 tests; commit `e8556ac`)
- `backend/tests/integration/test_085_lifespan_shutdown.py` — FOUND (3 tests; commit `8ed42aa`)
- `backend/tests/unit/test_tool_dispatcher.py` — 24-entry assertion + `"ask_user"` in EXPECTED_TOOLS verified by Grep (commit `c6c0b27`)
- All 4 commits present in worktree HEAD log: `c779e3f`, `c6c0b27`, `e8556ac`, `8ed42aa`
- Full Phase 085 test surface 92/92 GREEN: handler (17) + endpoint (5) + cancel (2) + lifespan (3) + concurrency (8) + sub_agent_emit (7) + task_service (19) + tool_registration (9) + todos_service (7) + tool_dispatcher (15) = 92
- 4 load-bearing ordering invariants pinned by integration tests (SUBSCRIBE-first, persist-FIRST, PUBLISH-FIRST cancel, PUBLISH-FIRST shutdown)
- Pre-existing test_062_delete_happy FK-violation reproduced at base — logged to `deferred-items.md` (NOT a Plan 03 regression)

## Self-Check: PASSED

---
*Phase: 085-new-llm-tools*
*Plan: 03*
*Completed: 2026-05-28*
