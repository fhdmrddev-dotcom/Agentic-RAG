# Phase 075: SEED-008 + tool_args_progress Polish Bundle - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Three narrow streaming-UX upgrades + two folded bug fixes, bundled into one polish phase. All three core upgrades have a backend lead with a thin frontend cutover; bug fold-ins ride along on their natural dependency plan.

1. **`GET /threads/{id}/snapshot`** — new combined endpoint replaces the 3-call cold-cache reconcile chain (`/messages` + `/active-runs` + `/runs/{rid}/stream?since=`). Returns `{messages, active_runs, since_cursors}` in one round-trip. Target: ≥50% perceived latency cut on post-F5 thread switch (SC #1).
2. **Line-by-line `code_stdout` SSE re-wire** — today `on_stdout` / `on_stderr` callbacks at `backend/app/api/threads.py:2085-2095` are passed to `InteractiveSandboxSession.run()` but the library never invokes them mid-flight (proof: explicit comment at `threads.py:2210-2218`, "on_stdout callbacks are no-ops in InteractiveSandboxSession — output only available after execution completes"). Replace the run path with Docker SDK `exec_run(stream=True)` so callbacks actually fire as the container produces output. Goal: ≥3 distinct `code_stdout` events across ≥1s for a 5-step printer (SC #2).
3. **`tool_args_progress` SSE for non-execute_code tools** — emit progress events when an in-flight tool's accumulated argument JSON crosses 5KB during streaming. Slots between the existing `tool_preparing` (name known, args still streaming) and `tool_start` (args parsed, ready to execute) events. Args accumulate at `threads.py:1601-1616` (OpenAI deltas) and `anthropic_service.py:199-206` (Anthropic `input_json_delta`); current code is silent between those two points. Test: `analyze_document` with a long-form prompt (SC #3).

**Folded reported bugs (ship in this phase):**
- **BUG-260518-01 — Resume button appears mid-stream during code execution** (major). Folded into Plan 01 because the new `GET /threads/{id}/snapshot` endpoint is exactly the reconcile-fetch primitive needed to gate the Resume button on confirmed terminal `runs.status` instead of provisional SSE error. Three-file fix surface: `backend/app/api/runs.py:221-235` (distinguish heartbeat-gap from genuine stream end), `frontend/src/lib/api.ts:390-408` (map `buffer_expired_*` as transient/recoverable), `frontend/src/providers/StreamsProvider.tsx:689-720` (call `/snapshot` before flipping Resume state).
- **BUG-260514-03 — Top/bottom streaming indicator desync** (minor). Folded into Plan 02 because the new line-by-line `code_stdout` events are exactly the data source the bottom indicator needs. Two-part frontend fix: (a) sticky last-text per macro state (no more clearing to blank), (b) subscribe to the new per-line `code_stdout` events so the bottom indicator updates as code executes.

**Out of scope (firm):**
- **`tool_args_progress` for `execute_code`** — deferred to v3.0 Skill Studio per REQUIREMENTS.md line 65. Phase 075 explicitly filters execute_code out of the emit path.
- **BUG-260514-02** (Anthropic end-of-cycle narration vs synthesized summary) — root cause is system-prompt / agent-loop terminal-frame OR frontend block-ordering, orthogonal to phase 075's SSE/snapshot/sandbox surface. Deferred again with refreshed `re_open_trigger` pointing to v2.7 Agent Workspace milestone. Consistent with Phase 074 D-074-10 routing.
- Any new run-lifecycle states. Any DB migrations. Any change to `messages.confidence_*` schema (D-v2.5-12 unchanged). Any frontend tool-card UI consumption of `tool_args_progress` (defer to v3.0). The v2.7 right-side workspace panel.
- Frontend dedup logic for stdout — single source of truth (mid-flight emit) makes it unnecessary.

</domain>

<decisions>
## Implementation Decisions

### Snapshot endpoint shape + cutover (Area 1)
- **D-075-01:** `GET /threads/{id}/snapshot` returns `{messages, active_runs, since_cursors}`. The `since_cursors` field is **server-derived from the actual Redis stream state** for each active run (not a literal `'0'` constant baked in, not a client-pinned hint). On first attach in normal operation this is effectively `'0'` for an unexpired buffer; planner verifies by querying stream state (`XINFO STREAM run:{run_id}` or equivalent) at endpoint-implementation time. The frontend's `lastSeenOffsetRef.current` map at `StreamsProvider.tsx:369` still wins on reconnects after the first attach — server cursors are the **initial** replay starting point, not a session-wide override.
- **D-075-02:** Frontend cutover is an **atomic swap** in `StreamsProvider.reconcile` (`tsx:478-485`). The current `Promise.all([getActiveRuns, loadMessages])` is replaced by a single `getSnapshot()` call. No feature flag, no coexistence path. The existing `getActiveRuns` and `getMessages` helpers in `api.ts` stay (used by code outside the reconcile hot path). The Phase 067.5 Branch D-3 streaming-bucket guard at `useMessages.ts:572-590` is preserved **verbatim** — snapshot is just a faster reconcile, not a behavioral change.
- **D-075-03:** Backend extracts a shared async helper `_enrich_messages_with_runs(thread_id, user_id, supabase)` that takes a messages list and zips in `run_id` + `run_status` from `public.runs` via the message_id FK. Both `GET /threads/{id}/messages` (currently at `threads.py:795-816`) and the new `GET /threads/{id}/snapshot` call it. The merge logic is identical to today's — only the call-site changes. T-063.1-01 (cross-user 404-before-runs-SELECT) and T-063.1-04 (no extra fields beyond `run_id` + `run_status`) mitigations carry verbatim.
- **D-075-04:** Auth + failure-mode posture mirrors existing endpoints **exactly**:
  - Ownership: dual `.eq("user_id", current_user["id"])` on the threads SELECT + the runs SELECT (D-062-12 defense-in-depth alongside RLS).
  - Cross-user → 404 not 403 (T-062-01 — don't leak resource existence).
  - Redis probe: `await asyncio.wait_for(redis.exists(f"run:{run_id}"), timeout=2.0)` per active run, catching `RedisError`/`asyncio.TimeoutError`/`OSError` → `503 + Retry-After: 10` (D-062-13).
  - The `since_cursors` field requires Redis (D-075-01); on Redis-down the entire endpoint returns 503 — no partial/degraded response shape introduced.

### Sandbox line-by-line stdout mechanism (Area 2)
- **D-075-05:** **Bypass `InteractiveSandboxSession.run()` entirely for execute_code.** Use Docker SDK's `exec_run(..., stream=True, demux=True)` (or equivalent SDK streaming API) inside the sandbox branch of `threads.py:2155-2206`. The llm-sandbox `session` object stays for: (a) session lifecycle (`open()` / `close()` / `_evict_expired`), (b) `/sandbox/output` directory bootstrap (`session.execute_command("mkdir -p /sandbox/output")`), (c) `harvest_output_files(session, ...)` post-execution. Only the **execution invocation** swaps from `session.run(wrapped_code, on_stdout=..., on_stderr=...)` to a direct Docker SDK exec stream loop that yields stdout/stderr chunks as the container produces them. Planner verifies the Docker SDK exposed by `llm-sandbox` (likely `session.client` or `session.container`) supports streaming exec or pulls it from the upstream `docker` Python library.
- **D-075-06:** **Per-line emit, no batching.** Each line from the Docker SDK stream becomes its own `code_stdout` SSE event with a `captured_at` timestamp (added to the event payload so SC #2's monotonic-timestamp integration assertion is trivial to express). Trust Redis Stream backpressure + the run buffer's TTL to handle pathological flooding cases (e.g., `for i in range(100000): print(i)`). No batching buffer, no time/size flush thresholds, no adaptive cadence.
- **D-075-07:** **Remove the post-completion stdout emit at `threads.py:2213-2218`.** Once mid-flight emit owns every line, that `for line in exec_result.stdout.splitlines(): await _emit(...)` block becomes dead code that would double-emit on the SSE stream. Deletion is mandatory (not optional) — the integration test from SC #2 fails fast if a duplicate event arrives at completion. Same removal applies to the stderr block at `:2216-2218`.
- **D-075-08:** **Heartbeat fires only during silent windows (>1s with no stdout).** The existing 1-Hz `code_executing` heartbeat at `threads.py:2192-2200` is preserved (per SC #4 invariant) but the inner timer **resets on every `code_stdout` flush**. Implementation: track `_last_output_at = time_mod.time()` and only emit the heartbeat when `now - _last_output_at >= _HEARTBEAT_INTERVAL_S`. Net effect: a chatty script never sees redundant `code_executing` events; a long matplotlib render (silent) still gets heartbeats every 1s; the 10s keepalive cadence (D-061-10) is preserved unchanged.

### tool_args_progress payload + chunking (Area 3)
- **D-075-09:** **`args_so_far` is the cumulative full args buffer, truncated to the last 5 KB for transport** (sliding-window tail of the accumulator). `total_args_bytes_so_far` carries the full running size so the frontend / observability can reason about the real arg footprint. Event payload shape: `{type: "tool_args_progress", tool_index: int, name: str, args_so_far: str, total_args_bytes_so_far: int}`. The 5KB tail is a byte-count truncation (`accumulator.encode("utf-8")[-5120:].decode("utf-8", errors="ignore")` or equivalent — planner picks the safest UTF-8-aware slice to avoid invalid codepoint trailing bytes).
- **D-075-10:** **Fire on every 5KB-accumulated boundary** (5KB, 10KB, 15KB, …). Implementation: per `tool_index`, track `last_emit_boundary` integer (initialized to 0); after every delta append, check `if len(accumulator.encode("utf-8")) // 5120 > last_emit_boundary: last_emit_boundary = ...; await _emit(...)`. Max event count is `ceil(total_args_bytes / 5120)`. No time-based throttle; no per-delta firing.
- **D-075-11:** **Filter: skip when tool name is `"execute_code"` AND skip when `calling_mode == CallingMode.STRUCTURED`**. Both filters live in the emit guard:
  - **execute_code exclusion** is per ROADMAP language; v3.0 Skill Studio re-enables it (REQUIREMENTS.md line 65).
  - **Structured-mode exclusion** because args arrive at once at `finish_reason` parse time, not progressively — there's no streaming accumulator to walk. Structured-mode tools >5KB simply don't emit `tool_args_progress` (silent path, documented in the emit-guard comment).
- **D-075-12:** **Backend SSE primitive only — no frontend consumer this phase.** Phase 075 ships: (a) the backend emit at both OpenAI deltas (`threads.py:1601-1616`) and Anthropic `input_json_delta` (`anthropic_service.py:199-206`), (b) an integration test that drives `analyze_document` with a long-form prompt and asserts the event payload shape. The frontend tool card stays unchanged. UI consumption (progressive args preview / "Sending args N KB…" counter) is deferred to v3.0 Skill Studio per REQUIREMENTS.md line 65 — same milestone that re-enables execute_code emit.

### Reported bug fold-ins (Area 4)
- **D-075-13:** **BUG-260518-01 (Resume mid-stream) is folded into Plan 01.** The new `GET /threads/{id}/snapshot` is the reconcile-fetch primitive that closes the bug:
  - Backend: `runs.py:221-235` `replay_tail_consumer` distinguishes heartbeat-gap from genuine stream end (don't emit `buffer_expired_during_tail` if a recent `code_executing` heartbeat shows the run is still alive).
  - Frontend: `api.ts:390-408` maps `buffer_expired_*` errors as **transient/recoverable** rather than terminal. `StreamsProvider.tsx:689-720` (the onTerminal handler) calls `getSnapshot(threadId)` on provisional error; if `active_runs` still contains this `run_id` with `status: 'streaming'`, do NOT flip `runStatus: "failed"` — re-attach the SSE stream from the snapshot's `since_cursors[run_id]`. Resume button stays hidden.
  - Reported-bug frontmatter for `resume-button-appears-during-active-code-execution.md` updated: `status: open` → `status: folded`, `folded_into: "075"`.
- **D-075-14:** **BUG-260514-03 (top/bottom indicator desync) is folded into Plan 02.** Both halves of the report's recommended fix ship:
  - (a) **Sticky bottom-indicator text per macro state.** When a tool call is open and no fresh state-change events arrive, the bottom indicator stays on its last text ("Running code…") instead of clearing to blank. Frontend-only fix in whichever component derives the bottom-indicator text (likely a hook reading SSE state — planner pinpoints).
  - (b) **Subscribe to the new line-by-line `code_stdout` events.** When a `code_stdout` event arrives during a tool call, the bottom indicator updates to "Running code… (N seconds)" or simply re-anchors its sticky text with the latest captured_at. Composes naturally with Plan 02's per-line emit.
  - Reported-bug frontmatter for `streaming-indicator-top-bottom-desync.md` updated: `status: open` → `status: folded`, `folded_into: "075"`.
- **D-075-15:** **BUG-260514-02 (Anthropic narration vs synthesized summary) deferred again** — consistent with Phase 074 D-074-10 routing. Root cause is system-prompt / agent-loop terminal-frame OR frontend block-ordering rendering of mixed text + tool_use blocks — both surfaces are orthogonal to Phase 075's SSE/snapshot/sandbox plumbing. Folding would ~3x phase size and cross into provider-parity prompt engineering. Reported-bug frontmatter for `anthropic-end-of-cycle-shows-actions-not-summary.md` updated: `re_open_trigger` refreshed to **"v2.7 Agent Workspace milestone planning OR any future Anthropic-path system-prompt redesign in anthropic_service.py / threads.py agent-loop terminal frame OR a dedicated v2.6 polish phase 075.1 if user feedback escalates"**. `status: deferred` unchanged.

### Plan split (Area 4 continued)
- **D-075-16:** **3-plan split bundles each folded bug with its natural dependency:**
  - **Plan 01 — Snapshot endpoint full stack + BUG-260518-01 fix.** Backend: new `GET /threads/{id}/snapshot` endpoint + extracted `_enrich_messages_with_runs` helper + `runs.py:221-235` heartbeat-gap distinction. Frontend: atomic swap in `StreamsProvider.reconcile` + `api.ts` `buffer_expired_*` transient mapping + `StreamsProvider.tsx:689-720` reconcile-fetch on provisional terminal. Integration test for snapshot endpoint + Chrome MCP UAT for SC #1 cold-cache timing + Resume-button-stays-hidden regression test.
  - **Plan 02 — Line-by-line code_stdout SSE rewire + BUG-260514-03 indicator fix.** Backend: Docker SDK `exec_run(stream=True)` swap in `threads.py:2155-2206`, post-completion emit removal, silent-window heartbeat. Frontend: sticky bottom-indicator text + subscribe to new `code_stdout` events. Integration test for SC #2 5-step printer + Chrome MCP UAT verifying bottom indicator stays animated through code execution.
  - **Plan 03 — tool_args_progress SSE primitive.** Backend only: emit at OpenAI delta accumulator (`threads.py:1601-1616`) + Anthropic `input_json_delta` accumulator (`anthropic_service.py:199-206`), with execute_code + STRUCTURED filters. Integration test for SC #3 `analyze_document` with >5KB args. No frontend.

  Plan 02 and Plan 03 are **independent** — can execute parallel-able. Plan 01 has no dependency on either; can also parallel. The 3-plan budget from ROADMAP is honored.

### Claude's Discretion
- **Pydantic response models:** new `ThreadSnapshotResponse(messages: list[MessageResponse], active_runs: list[ActiveRunResponse], since_cursors: dict[str, str])` in the existing `app/schemas/threads.py` (or wherever `MessageResponse` / `ActiveRunResponse` live today). Reuse the existing two models verbatim — no new shapes.
- **Integration test scaffolding:** new tests land in `backend/tests/integration/` next to `test_063_post_then_subscribe.py` / `test_063_1_messages_runs_join.py`. The hoisted `_reset_redis_singleton` autouse fixture from Phase 074 D-074-11 protects them automatically.
- **Chrome MCP UAT cadence:** SC #1 (cold-cache latency reduction ≥50%) needs timing measurement; Chrome DevTools MCP `performance_start_trace` / `_stop_trace` against `http://localhost:5173/` with `fhdmrd@gmail.com` / `123456` (per `reference_local_dev_app.md`) captures the before/after numbers cleanly.
- **Docker SDK exec_run API choice:** planner picks between `container.exec_run(...)` (high-level wrapper that returns an iterator when `stream=True`) and the lower-level `client.api.exec_create() + exec_start(stream=True)` pair. Both work; high-level is simpler. If llm-sandbox doesn't expose `session.container` directly, planner reaches through `session._container` or whatever attribute holds the docker.models.containers.Container instance — confirm at plan time by reading `~/site-packages/llm_sandbox/` source.
- **Per-line vs per-chunk from Docker SDK:** Docker SDK streams stdout as **bytes chunks**, not always per-line. Planner adds a small line-buffer to split on `\n` and emit one event per complete line. Trailing partial line at completion flushes as a final `code_stdout` event before the `_done` marker. The integration test for SC #2 asserts the line count from `for i in range(5): print(i); time.sleep(1)` is exactly 5 distinct events with monotonic `captured_at`.
- **Code-review depth:** Standard (matches Phase 067.x cluster precedent — touches RLS-sensitive endpoints, frontend reconcile path, and SSE producer behavior).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 075 charter
- `.planning/ROADMAP.md` lines 452-461 — locked goal + 4 success criteria for Phase 075
- `.planning/REQUIREMENTS.md` §Theme D lines 38-43 — POLISH-SEED-008-01, POLISH-SEED-008-02, POLISH-TOOL-PROG-01
- `.planning/PRDs/v2.6.md` §Theme D — Polish Carry-forwards section

### Seeds
- `.planning/seeds/SEED-008-streaming-ux-polish.md` — original two gaps (thread-switch latency + line-by-line stdout), root-cause analysis, proposed fixes including "parallelize 3 sequential calls into a single combined endpoint"

### Folded reported bugs (status flips to `folded` post-discussion)
- `.planning/reported-bugs/resume-button-appears-during-active-code-execution.md` — BUG-260518-01, folded into Plan 01 (snapshot endpoint IS the reconcile-fetch primitive that closes it)
- `.planning/reported-bugs/streaming-indicator-top-bottom-desync.md` — BUG-260514-03, folded into Plan 02 (sticky text + subscribe to new code_stdout events)

### Deferred bug (NOT folded — re_open_trigger refreshed)
- `.planning/reported-bugs/anthropic-end-of-cycle-shows-actions-not-summary.md` — BUG-260514-02, `status: deferred` unchanged; `re_open_trigger` updated to point at v2.7 Agent Workspace OR future Anthropic-path system-prompt redesign OR optional 075.1 polish phase

### Backend code sites (where the changes land)
- `backend/app/api/threads.py:510-551` — `list_active_runs` endpoint (existing; reference for /snapshot's active_runs shape + auth/404 pattern)
- `backend/app/api/threads.py:731-818` — `get_messages` endpoint with the runs-FK merge at `:795-816` (extract `_enrich_messages_with_runs` from this block per D-075-03)
- `backend/app/api/threads.py:1595-1616` — OpenAI `_on_chunk_openai` tool_calls delta accumulator (tool_args_progress emit site for OpenAI path per D-075-10)
- `backend/app/api/threads.py:2085-2095` — sandbox `on_stdout` / `on_stderr` callbacks (currently no-op; D-075-05 replaces the invocation that consumes them)
- `backend/app/api/threads.py:2155-2206` — sandbox execution loop with `session.run()` and `code_executing` heartbeat (the swap zone per D-075-05 + D-075-08)
- `backend/app/api/threads.py:2210-2218` — post-completion stdout/stderr emit (DELETE per D-075-07)
- `backend/app/api/runs.py:221-235` — `replay_tail_consumer` heartbeat-gap deadline guard (BUG-260518-01 fix per D-075-13)
- `backend/app/api/runs.py:331-391` — `stream_run` endpoint + Redis health probe pattern (template for /snapshot's D-062-13 mirror per D-075-04)
- `backend/app/services/anthropic_service.py:199-225` — Anthropic `input_json_delta` accumulator + `tool_start` emit (tool_args_progress emit site for Anthropic path per D-075-10)
- `backend/app/services/sandbox_service.py` — `SandboxSessionManager` (stays untouched; session object still owns lifecycle; only the `.run()` call swaps to Docker SDK exec)

### Frontend code sites (where the changes land)
- `frontend/src/providers/StreamsProvider.tsx:369` — `lastSeenOffsetRef` (per-run cursor map; preserved per D-075-01)
- `frontend/src/providers/StreamsProvider.tsx:478-580` — `reconcile` flow with `Promise.all([getActiveRuns, loadMessages])` (atomic swap target per D-075-02)
- `frontend/src/providers/StreamsProvider.tsx:689-720` — `onTerminal` handler that flips `runStatus: "failed"` on `kind === "error"` (BUG-260518-01 reconcile-fetch wiring per D-075-13)
- `frontend/src/lib/api.ts:135-136, 281, 452-467` — current `getActiveRuns`, `subscribeToRun`, `getMessages` helpers (new `getSnapshot` joins; old helpers stay)
- `frontend/src/lib/api.ts:390-408, 449` — `buffer_expired_*` error mapping (transient mapping per D-075-13)
- `frontend/src/providers/StreamsProvider.tsx:419-435` — Phase 067.5 Branch D-3 streaming-bucket guard in the `clearThreadBucket` action with predicate `tid && tid !== streamingThreadIdRef.current` (**PRESERVE VERBATIM** per D-075-02 + Theme C REQ). Note: the original D-075-02 cited `useMessages.ts:572-590` — post-Phase 068 lift, useMessages.ts is now 89 lines total and the guard moved to StreamsProvider.tsx. Confirmed by 075-RESEARCH.md Discovery 3 + 075-PATTERNS.md.
- `frontend/src/components/chat/MessageItem.tsx:118` — Resume button visibility condition (BUG-260518-01 reference per D-075-13)
- `frontend/src/types/index.ts:113` — `runStatus` enum (reference for snapshot's active_runs type + Resume-button-still-hidden invariant)
- Bottom-indicator component (planner identifies via grep for the typing indicator hook — likely under `frontend/src/components/chat/` or `frontend/src/hooks/`) for BUG-260514-03 sticky text per D-075-14

### Test sites
- `backend/tests/integration/test_063_post_then_subscribe.py` and `test_063_1_messages_runs_join.py` — pattern for thread-endpoint integration tests (snapshot test lands beside them)
- `backend/tests/integration/conftest.py` — hoisted `_reset_redis_singleton` autouse fixture from Phase 074 D-074-11 (auto-protects new tests)

### Precedent (prior-phase patterns to reuse)
- `.planning/phases/067.5-...` and `.planning/phases/068.5-...` — Branch D-3 streaming-bucket guard pattern (preserved per D-075-02)
- `.planning/phases/067.4-...` — `code_executing` heartbeat invariant origin (D-067.4-R5-01, preserved + composed-with per D-075-08)
- `.planning/phases/063.1-messages-runs-join/` — pattern for the runs-FK merge in `get_messages` (`threads.py:795-816`); D-075-03 extracts that merge as the shared helper
- `.planning/phases/062-...` — D-062-12 (cross-user 404 not 403) + D-062-13 (Redis-down 503+Retry-After:10) — D-075-04 mirrors both exactly for /snapshot
- `.planning/phases/074-seed-009-seed-011-polish-bundle/074-CONTEXT.md` D-074-10 — precedent for deferring BUG-260514-02 with same reasoning; D-075-15 keeps that deferral consistent

### Project-level rules
- `CLAUDE.md` — Python venv, no LangChain/LangGraph, single uvicorn worker (still authoritative pre-D-PRD-12), reported-bugs cross-check protocol (applied to BUG-260518-01, BUG-260514-03, BUG-260514-02 in this discussion), `run_in_threadpool` rule for blocking I/O (D-v2.5-01), Realtime is a hint not source-of-truth (D-v2.5-03 — snapshot satisfies the "always reconcile via fetch on (re)connect" half of that invariant)
- `.planning/PROJECT.md` Key Decisions — D-v2.5-01 (run_in_threadpool), D-v2.5-03 (Realtime as hint)
- `.planning/STATE.md` — current phase 075 status pre-context-gathered

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Runs-FK merge logic** (`threads.py:795-816`): existing code in `get_messages` that zips `run_id` + `run_status` onto assistant messages via the `public.runs.message_id` FK with ORDER BY started_at DESC + first-wins (D-063.1-13 / Gap-002 / WR-01). Extracted as `_enrich_messages_with_runs` helper per D-075-03; both endpoints call it.
- **Active-runs query pattern** (`threads.py:543-551`): `.eq("user_id") + .eq("status","streaming") + .order("started_at", desc=True)` against `idx_runs_active` partial index. `/snapshot` reuses the same SELECT to populate `active_runs` field; same defense-in-depth posture.
- **Redis probe pattern** (`runs.py:354-370`): `asyncio.wait_for(redis.exists(...), timeout=2.0)` with `RedisError`/`TimeoutError`/`OSError` catch and 503+Retry-After:10 fallback. `/snapshot` copies this verbatim per D-075-04.
- **Existing on_stdout / on_stderr callback machinery** (`threads.py:2085-2204`): the `asyncio.Queue` bridge + drain loop is already in place. D-075-05's swap only changes the **producer** of queue items (Docker SDK exec_run replaces `session.run()`); the queue/drain/`_emit` consumer side is reused unchanged.
- **`code_executing` heartbeat** (`threads.py:2192-2200`): existing 1-Hz tick. D-075-08 only adds a `_last_output_at` reset on every `code_stdout` flush; the emit, the keepalive cadence, and the SC #4 invariant are all preserved.
- **OpenAI / Anthropic tool args accumulators** (`threads.py:1601-1616` + `anthropic_service.py:199-206`): the `tool_calls_buffer[idx]["arguments"] += chunk` / `tool_blocks[event.index]["arguments"] += delta.partial_json` patterns are the natural insertion points for the D-075-10 boundary check. No new buffer; just a `last_emit_boundary` counter per tool_index.
- **lastSeenOffsetRef per-run cursor map** (`StreamsProvider.tsx:369`): D-075-13's reconcile-fetch wiring populates this from `snapshot.since_cursors` on first attach.
- **Pydantic MessageResponse + ActiveRunResponse**: already defined for `/messages` and `/active-runs`. `ThreadSnapshotResponse` is a thin composition of these two — no new field shapes.

### Established Patterns
- **Dual `.eq("user_id")` defense-in-depth** (D-062-12; applied at `threads.py:524-547, 738-805` and `runs.py:342-352`): every new ownership-sensitive query mirrors this. `/snapshot` does the same.
- **404 not 403 on cross-user resource access** (T-062-01; same call sites). `/snapshot` returns 404 if `thread_id` doesn't belong to the user.
- **`maybe_single()` not `single()`** for ownership SELECT (CR-01 mitigation; `runs.py:347-352`): avoids PostgREST PGRST116 → 500 leak. `/snapshot` uses `maybe_single()` for the threads ownership probe.
- **Identifier-only log format strings** (Phase 073 T-073-04 + Phase 074 D-074-03): if any logger lines land in /snapshot or the new tool_args_progress emit, the pattern is `logger.info("emitting tool_args_progress for tool_index=%d size=%d", idx, total)` — no actual argument content leaked.
- **Frontend `Promise.all` for parallel reconcile** (`StreamsProvider.tsx:482-485`): the current chain. Atomic swap to a single `getSnapshot()` collapses the parallel branch into one call; the rest of the reconcile block (placeholder creation, subscribeToRun attach, dedup) stays unchanged.
- **Pinned `sse_starlette.__version__.startswith("2.4.")` invariant** (`test_059_disconnect.py:63-94`): if `_emit(redis, run_id, 'tool_args_progress', ...)` lands inside the SSE producer loop, the assertion path is unaffected — `_emit` is a thin XADD wrapper, doesn't touch the sse-starlette response layer.
- **Bug-report frontmatter status lifecycle** (CLAUDE.md MANDATORY): `open` → `folded` (when a phase claims it) → `closed` (when verified). D-075-13 + D-075-14 flip BUG-260518-01 + BUG-260514-03 to `folded`; D-075-15 leaves BUG-260514-02 at `deferred` with refreshed `re_open_trigger`.

### Integration Points
- **Redis stream introspection for `since_cursors`**: D-075-01 needs the planner to pick the exact API. Candidates: `await redis.xinfo_stream(f"run:{run_id}")` reads `first-entry.id`, or `await redis.xrange(f"run:{run_id}", "-", "+", count=1)` reads the head element ID. Either gives the "stream start" cursor. For unexpired buffers this is effectively `0-0`; in degenerate cases (Redis trim or partial buffer) it gives the real earliest available offset.
- **Docker SDK from inside llm-sandbox**: `from docker import DockerClient` and `client.containers.get(session.container.id).exec_run(cmd, stream=True, demux=True)` is one path; alternatively `session.client.api.exec_create(...) + exec_start(...)` is the lower-level pair. Planner verifies at plan time by reading `~/site-packages/llm_sandbox/sandbox.py` for the `container` / `client` attribute names.
- **No DB migration**: zero schema changes. Both snapshot endpoint and the two new SSE events read existing tables (`messages`, `runs`) and existing Redis stream keys (`run:{run_id}`).
- **No new frontend dependencies**: snapshot consumer is one new helper in `api.ts` + one swap in `StreamsProvider.tsx`. Bottom-indicator fix is a hook tweak. No new packages.
- **No `tool_args_progress` consumer in v2.6** — the event lands in Redis Stream, replays correctly through `replay_tail_consumer`, but the frontend ignores it (unknown event-type fallthrough is harmless per existing SSE consumer pattern). v3.0 Skill Studio wires the consumer.

</code_context>

<specifics>
## Specific Ideas

- **Plan 01 ship gate:** `cd backend && venv/Scripts/python -m pytest tests/integration/test_075_snapshot.py tests/integration/test_063_1_messages_runs_join.py -q` is all-green (the existing 063.1 test must stay green when `_enrich_messages_with_runs` is extracted — protects against regression in the FK-merge logic).
- **Plan 02 ship gate:** `pytest tests/integration/test_075_code_stdout_progressive.py -q` produces 5/5 PASS on the `for i in range(5): print(i); time.sleep(1)` scenario, with assertions: (a) ≥3 distinct `code_stdout` events, (b) monotonic `captured_at` per event, (c) total elapsed across the events ≥1.0s, (d) no duplicate emit at completion.
- **Plan 03 ship gate:** `pytest tests/integration/test_075_tool_args_progress.py -q` drives `analyze_document` with a synthetic >5KB prompt and asserts: (a) at least one `tool_args_progress` event fires before `tool_start`, (b) `total_args_bytes_so_far` is monotonically non-decreasing, (c) `args_so_far` is ≤5120 bytes per event, (d) the event does NOT fire when `tool_name == "execute_code"`.
- **Live UAT (SC #1 cold-cache latency):** Chrome DevTools MCP at `http://localhost:5173/` with `fhdmrd@gmail.com` / `123456`. Capture `performance_start_trace` → reload → click a thread with active runs → `performance_stop_trace`. Compare before-cutover (3 calls) and after-cutover (1 call) `loadEventEnd`-relative timing. Target: ≥50% reduction.
- **Live UAT (BUG-260518-01 closure):** drive a long pptx-generation prompt (e.g., "build a 30-slide deck on this 50-page PDF") that triggers a >30s sandbox cell. Watch the assistant message during execution — Resume button must NOT appear; bottom indicator must stay animated; final result paints cleanly when sandbox returns.
- **Live UAT (BUG-260514-03 closure):** same long pptx-generation cell; bottom indicator stays on "Running code…" text throughout the silent windows (matplotlib renders) instead of clearing to blank. Chrome MCP `take_screenshot` at t=30s, t=60s, t=120s confirms the indicator text is visible.
- **Anthropic-path tool_args_progress UAT:** with `active_provider=anthropic` and model `claude-sonnet-4-6`, drive a prompt that produces a >5KB `analyze_document` tool call. Verify backend logs show the boundary emit and the SSE stream replay (via `GET /runs/{rid}/stream?since=0`) contains `tool_args_progress` events between `tool_preparing` and `tool_start`.
- **Code-review surface:** Plan 01 + Plan 02 touch RLS-sensitive endpoints (D-062-12) + the streaming reconcile path — standard review depth. Plan 03 is a pure SSE producer add — quick review suffices.

</specifics>

<deferred>
## Deferred Ideas

- **BUG-260514-02 (Anthropic narration vs synthesized summary)** — re_open_trigger fires on Phase 075 planning by name, but root cause is system-prompt / agent-loop terminal-frame OR frontend block-ordering, not Phase 075's SSE/snapshot/sandbox surface. Deferred again per D-075-15. Refreshed `re_open_trigger` points at v2.7 Agent Workspace OR future system-prompt redesign in `anthropic_service.py` / `threads.py` agent-loop terminal frame OR optional v2.6 polish phase 075.1 if user feedback escalates. Reported-bug frontmatter updated accordingly.
- **`tool_args_progress` for `execute_code`** — explicitly out of scope per ROADMAP language; deferred to v3.0 Skill Studio per REQUIREMENTS.md line 65 ("Skill Studio... `tool_args_progress` for `execute_code`"). Phase 075 filter on tool name skips this case.
- **Frontend consumer for `tool_args_progress`** — backend ships the SSE primitive; UI consumption ("Sending args N KB…" counter, progressive args preview) deferred to v3.0 Skill Studio milestone, same dependency cluster as the execute_code re-enable. Adding it now would conflate v2.6 polish with v3.0 UX work.
- **Adaptive emit cadence for `code_stdout`** (hybrid per-line / batched at >20 events/s) — rejected per D-075-06. Trust Redis Stream backpressure + run-buffer TTL for the pathological flood case. If a real flood scenario surfaces in production, add adaptive cadence as a polish carry-forward.
- **Snapshot endpoint feature flag** — rejected per D-075-02. Atomic swap is the right move; the dual-call posture exists today as graceful fallback and the snapshot endpoint is a faster reconcile, not a behavioral change.
- **Snapshot endpoint partial-degraded shape on Redis-down** — rejected per D-075-04. `since_cursors` requires Redis; on Redis-down return 503 + Retry-After:10 like `/runs/{rid}/stream` does. No new failure-mode shapes the frontend must handle.
- **Frontend dedup for double-emit stdout** — rejected per D-075-07. Single source of truth (mid-flight emit, post-completion deleted) eliminates the duplication at the producer side.
- **Heartbeat at fixed 1Hz regardless of stdout activity** — rejected per D-075-08. Silent-window-only firing eliminates redundant signals during chatty execution while preserving the SC #4 "code_executing heartbeat is preserved" invariant.
- **Switching to a streaming-capable variant of llm-sandbox** — D-075-05 explicitly bypasses `session.run()` instead. llm-sandbox upstream may or may not gain streaming support later; this phase doesn't depend on or block that path.
- **Realtime hint composition with snapshot** — D-v2.5-03 says Realtime is a hint not source-of-truth; always reconcile via fetch. Snapshot IS the reconcile fetch. No additional Realtime wiring needed.
- **Multi-worker compatibility audit for the new endpoint** — Phase 077 / D-PRD-12 territory. /snapshot has no per-worker state (reads Postgres + Redis, both shared). No incremental risk.

### Reviewed Todos (not folded)
- No todos surfaced by `todo.match-phase` for Phase 075 (verified — todo_count: 0). The three success criteria + two folded bugs cover the full intended scope.

</deferred>

---

*Phase: 075-seed-008-tool-args-progress-polish-bundle*
*Context gathered: 2026-05-18*
