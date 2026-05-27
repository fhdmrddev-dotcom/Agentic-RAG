# Domain Pitfalls: v2.7 Agent Workspace & Panel

**Domain:** Adding workspace filesystems, right-side panels, sub-agent tools, and agent-pause/resume to an existing run-backed streaming chat platform
**Researched:** 2026-05-27
**Scope:** Pitfalls specific to THIS codebase (Agentic RAG v2.6 architecture), not generic advice

---

## Critical Pitfalls

Mistakes that cause rewrites, 075.x-style cascades, or cross-provider regressions.

### Pitfall 1: threads.py God-Function Compounding (G-5 FIRES)

**What goes wrong:** The PRD names `threads.py:1059` (agent_runner) and `:1186-1198` (skill catalog injection) as the two modification sites for harness tool-dispatcher whitelist enforcement. But threads.py is already 3843 LOC, has been touched by 9+ phases in v2.6 alone (G-5 fires), and the tool dispatch section (lines 2548-3600+) is a monolithic `for tool_index, tc in enumerate(tool_calls):` with ~50 `elif` branches for each tool name. Adding `workspace_write`, `workspace_read`, `workspace_list`, `workspace_diff`, `workspace_delete`, `write_todos`, `task`, and `ask_user` means 8 more `elif` branches in that same giant function, plus the harness whitelist pre-check, plus `ask_user` pause/resume coordination.

**Why it happens:** The tool dispatch site was never extracted from the agent_runner closure. Every new tool adds another branch inside a 2400-line nested function definition that closes over `redis`, `run_id`, `supabase`, `current_user`, `thread_id`, `user_settings`, `messages`, etc. The closure capture makes extraction non-trivial.

**Consequences:** (1) Merge conflicts when parallel phases touch the same tool dispatch block. (2) Any shared-path change (e.g., `_emit` call ordering, tool_result format, error handling) risks cross-provider regression (exactly what happened with BUG-260523-01 through BUG-260523-03 after 075.3). (3) The file becomes unnavigable for code review, increasing the chance of silent bugs.

**Prevention:**
- **Phase 079 or 080 MUST include a threads.py extraction phase BEFORE adding tools.** Extract the tool dispatch `for` loop into a `backend/app/services/tool_dispatcher.py` module with a registry pattern (dict mapping tool_name to async handler callable). Each handler receives a typed context object instead of closing over 15+ variables. This is the G-5 refactor the hot-file ledger demands.
- The harness whitelist pre-check should live in the dispatcher module, not inline in agent_runner. The dispatcher reads `workflow_phases.available_tools` from an in-memory cache and refuses before calling the handler.
- New tools (`workspace_*`, `write_todos`, `task`, `ask_user`) register as handler functions in separate modules, never as `elif` branches.

**Detection:** If a phase plan's `files_modified` list includes `backend/app/api/threads.py` with more than 30 LOC net-add in the tool dispatch section, the G-5 guardrail should fire.

**Affected phases:** 080 (workspace tools), 081 (harness engine whitelist), 082 (three new LLM tools), 083 (panel streams integration)

---

### Pitfall 2: ask_user Pause/Resume Breaks the Agent Loop's Assumption of Continuous Execution

**What goes wrong:** The current agent_runner (threads.py:1381-3800) is a single `async def` that runs to completion inside an `asyncio.Task`. It has ONE await pattern: `async for chunk in stream:` inside `asyncio.timeout()`. There is no mechanism for pausing mid-execution, waiting for external input, then resuming with that input injected as a tool_result.

`ask_user` requires: (1) emit `ask_user_prompt` SSE event, (2) PAUSE the agent loop, (3) wait for `POST /runs/{run_id}/ask_user_response`, (4) inject the user's response as the tool_result, (5) RESUME the loop for the next iteration.

**Why it happens:** The agent loop was designed as a fire-and-forget producer. Adding a "wait for external event" primitive is an async coordination pattern the loop has never needed. The naive approach (insert an `await asyncio.Event()` inside the tool dispatch) creates several hazards:
- The `asyncio.timeout()` per-LLM-call timer does not cover tool execution (by design, per threads.py:1411-1417). But `ask_user` could wait indefinitely for user input. If wrapped in the per-call timeout, legitimate long user-think-time would trigger `timed_out`. If NOT wrapped, the producer task could hang forever.
- The `_shielded_finalize` block assumes the producer terminates naturally or via exception. A paused producer that's cancelled during uvicorn shutdown would hit the finally-block with partial state.
- Multi-worker: if the user responds and the POST hits a different worker, that worker must signal the paused producer on the original worker. Redis pub/sub or a shared coordination key is needed.

**Consequences:** (1) Deadlocked producer tasks that never emit terminal sentinels, leaving the frontend in permanent "streaming" state. (2) Token/cost leaks from LLM calls whose results are never delivered. (3) Race conditions between the pause event and the cancel/stop flow (user presses Stop while agent is paused). (4) Cross-worker resume failures in multi-worker mode.

**Prevention:**
- Implement `ask_user` as an `asyncio.Event` per-run, stored in a module-level registry (like `RUN_TASKS`). The `POST /runs/{run_id}/ask_user_response` endpoint sets the event + stores the response payload. The tool dispatch handler awaits the event with a dedicated timeout (`ask_user_timeout_seconds`, default from `app_settings` or tool arg).
- The pause MUST be OUTSIDE the per-LLM-call `asyncio.timeout()` wrapper (tools are already outside it per line 1411-1417).
- Add a dedicated timeout for `ask_user` (configurable, default 300s). On timeout, inject a tool_result like `"User did not respond within the time limit."` and continue the loop (do NOT terminate the run).
- The `_shielded_finalize` block must check for and resolve any pending `ask_user` Event before finalizing (defensive cleanup).
- Multi-worker coordination: use a Redis key `ask_user:{run_id}` with BLPOP/pub-sub. The POST endpoint writes the response to Redis; the paused producer's Event is triggered by a background listener on that key. This mirrors the existing `run:{run_id}` Stream pattern.

**Detection:** Any implementation that puts `await` inside the tool dispatch `for` loop without a timeout wrapper and cross-worker coordination is a bug.

**Affected phases:** 082 (`ask_user` tool implementation), 081 (harness `llm_human_input` phase type uses the same mechanism)

---

### Pitfall 3: StreamsProvider Demultiplexer — Panel Events Triggering Chat Re-renders

**What goes wrong:** The v2.6 `<StreamsProvider>` Context was designed for a single consumer surface ("chat"). Adding the panel as a second consumer means new SSE event types (`workspace_file_written`, `todo_updated`, `workflow_phase_*`, `ask_user_prompt`, etc.) flow through the same `subscribeToRun` callback chain. If the `makeStreamCallbacks` factory in StreamsProvider.tsx (line 214+) dispatches these events via `setMessagesForBucket`, every panel event triggers a React state update that cascades to the chat message list, causing needless re-renders.

**Why it happens:** The current `onDelta`/`onToolStart`/`onToolEnd`/etc. callbacks all funnel through `setMessagesForBucket(surfaceId, threadId, updater)`, which mutates `bucketsBySurface` — a single Map. Even if the panel uses a different surfaceId, the Map reference changes, causing all subscribers to re-evaluate. The `React.memo(MessageItem)` from Phase 075.4 helps but doesn't prevent the list-level reconciliation.

**Consequences:** (1) Visible jank on long message threads when the agent writes workspace files frequently (e.g., `workspace_write` emitting 10+ events per iteration). (2) "StreamsProvider caused N re-renders" DevTools warnings. (3) Battery/CPU cost on mobile where the bottom-sheet panel is hidden but events still trigger state changes.

**Prevention:**
- Panel state MUST live in a SEPARATE Zustand slice or separate keys in streamsStore, NOT in `bucketsBySurface`. New state shape: `panelState: Map<threadId, PanelThreadState>` where `PanelThreadState = { todos: Todo[], workspaceFiles: WorkspaceFile[], workflowPhases: WorkflowPhase[], pendingAskUser: AskUserPrompt | null }`.
- The `subscribeToRun` SSE parser in `api.ts` needs new callback arms for each panel event type (e.g., `onTodoUpdated`, `onWorkspaceFileWritten`, `onWorkflowPhaseStart`). These are dispatched to the panel state slice, NOT to `setMessagesForBucket`.
- The demultiplexer logic should be in the `makeStreamCallbacks` factory (StreamsProvider.tsx:214+), routing by event type BEFORE the callback fires. Chat events go to the existing message-bucket path; panel events go to the new panel-state path.
- Use Zustand selectors with shallow equality (`useStreamsStore(selector, shallow)`) for panel hooks so only the affected panel section re-renders.

**Detection:** Chrome DevTools Profiler: if a `workspace_file_written` event causes `MessageList` to re-render, the demux is leaking. Add a Vitest unit that asserts panel events do NOT trigger `bucketsBySurface` mutations.

**Affected phases:** 083 (panel scaffold — this is where the demux architecture is decided), 080 (workspace tools emitting SSE events)

---

### Pitfall 4: Hybrid Storage Content Leak via Workspace File Reads in Agent Context

**What goes wrong:** When the agent calls `workspace_read(path)`, the tool handler must return the file content as a tool_result string. For large files stored in Supabase Storage (>256KB), this means downloading the file from the bucket, converting to string, and injecting into the LLM context. A single 256KB+ file as a tool_result could consume 85K+ tokens, blowing the context window and triggering inter-iteration trim (Phase 018's rolling trim), which may evict OTHER tool results the agent needs.

**Why it happens:** The existing `read_document` tool already has a 3K char cap (D-22, threads.py line ~2578). But workspace files are agent-authored — the agent may write a 500KB research document and later try to `workspace_read` it. The hybrid storage threshold (256KB) means the largest inline files are already context-budget-threatening, and bucket files can be arbitrarily large.

**Consequences:** (1) Context window overflow causing trim of earlier messages, breaking multi-iteration reasoning. (2) Expensive token consumption (a 256KB file at chars/3 ratio = ~85K tokens = $0.50+ per read on expensive models). (3) Silent quality degradation: the agent reads a large file but trim removes the search results it retrieved earlier.

**Prevention:**
- `workspace_read` MUST have a content cap, analogous to `read_document`'s 3K char cap. Default: `app_settings.workspace_read_max_chars` (recommend 8K chars, ~2.7K tokens — generous enough for plan files, safe for context budgets).
- For files larger than the cap, return a truncation summary: first N chars + `"[Truncated — full file is {size_bytes} bytes. Use workspace_read(path, start_line=X, end_line=Y) to read specific sections.]"`
- The `workspace_diff` tool should return a SUMMARY diff (hunks only, not full before/after), with the delta_from_prev JSONB providing compact representation.
- Never inject raw bytea content into the tool_result for binary files. Return metadata only: `{"path": "/output.pptx", "size_bytes": 1234567, "mime_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "note": "Binary file — cannot display inline. Use the workspace file browser in the panel to download."}`.

**Detection:** Add a unit test asserting `workspace_read` tool_result length never exceeds `workspace_read_max_chars + 200` (200 chars for truncation message).

**Affected phases:** 080 (workspace tools implementation)

---

### Pitfall 5: task Tool Sub-Agent Spawning Exhausts asyncio Task Registry and Redis Streams

**What goes wrong:** The `task` tool spawns a sub-agent that creates a new `run:{sub_run_id}` Redis Stream and a new `asyncio.Task` registered in `RUN_TASKS` (threads.py:92). The PRD's `llm_batch_agents` phase type fans out N parallel sub-agents. At 50 concurrent parent runs with batch phases spawning 5 sub-agents each = 250 concurrent sub-agent tasks. Combined with 50 parent tasks = 300 entries in `RUN_TASKS` + 300 Redis Streams.

**Why it happens:** The current `RUN_TASKS` dict is a global module-level registry with no size cap. The AnyIO threadpool ceiling is 200 (per STACK.md:122). Sub-agent tasks are `asyncio.Task` instances (not threadpool threads), so they don't hit the threadpool ceiling directly, but they DO compete for the event loop's time-slice. 300 concurrent coroutines each doing LLM API calls + Redis XADDs can saturate the event loop.

**Consequences:** (1) Event loop starvation: existing parent run SSE consumers see latency spikes because sub-agent tasks dominate the event loop. (2) Redis memory pressure from 300 concurrent Streams (each buffering up to MAXLEN 10000 entries). (3) Orphaned sub-agent tasks if the parent run is cancelled — the parent's `_shielded_finalize` currently has no mechanism to cancel child tasks.

**Prevention:**
- Implement a per-run sub-agent cap: `max_sub_agents_per_run` (default 5, configurable). The `task` tool refuses to spawn beyond this cap, returning a tool_result error.
- Implement a global sub-agent cap: `max_concurrent_sub_agents` (default 50). Enforced at spawn time with a module-level counter.
- Sub-agent tasks MUST be registered as children of the parent run. Add a `parent_run_id` field to the `runs` table INSERT. On parent cancellation or failure, cascade-cancel all children.
- The `_shielded_finalize` block must include a sub-agent cleanup step: `for child_run_id in _child_run_ids: cancel_child(child_run_id)`.
- The `task` tool's sub-agent should NOT use the full `agent_runner` closure (which closes over the parent's `supabase`, `redis`, `thread_id`, etc.). Instead, factor sub-agent execution into a standalone async function in a new module (`backend/app/services/task_runner.py`) that receives explicit parameters.

**Detection:** Add a load test (or at least a unit test) that spawns 10 concurrent `task` calls and verifies: (1) all complete, (2) `RUN_TASKS` dict size returns to baseline after completion, (3) Redis Streams are EXPIRED.

**Affected phases:** 082 (`task` tool), 081 (`llm_batch_agents` phase type)

---

### Pitfall 6: 075.x Cascade Redux — Insufficient Cross-Provider UAT on New SSE Event Types

**What goes wrong:** v2.7 introduces 13 new SSE event types (per PRD section 5). Each event type must be: (1) emitted correctly by the backend across 4 provider paths (OpenAI, Anthropic, Google, OpenRouter), (2) parsed correctly by `subscribeToRun` in api.ts, (3) routed correctly by the StreamsProvider demultiplexer, (4) rendered correctly by the panel UI. The v2.6 075.x cascade (8 phases) happened because new SSE events were only tested on OpenAI, and cross-provider regressions surfaced in UAT after closeout.

**Why it happens:** The 4 provider streaming paths have structurally different event shapes:
- OpenAI: `delta.tool_calls[].function.arguments` streaming with index-based tool accumulation
- Anthropic: `content_block_start` / `content_block_delta` with text/tool_use discriminator
- Google: native SDK with `Part` objects and `thought_signature` round-trip
- OpenRouter: OpenAI-compatible but with quirks (synthetic timeout, `:extended` model IDs, duplicate output dedup)

New SSE events like `workspace_file_written` are emitted from the tool dispatch section which is SHARED across providers, but the timing/ordering relative to provider-specific events (`delta`, `tool_preparing`, `tool_end`) differs.

**Consequences:** Provider-specific regressions discovered post-ship, requiring insert-phases (075.1, 075.2, 075.3, 075.4 were all cross-provider fix-ups).

**Prevention:**
- MANDATORY per CLAUDE.md SC#10: any phase touching streaming or SSE events MUST include UAT rows for all 4 providers + multi-tool + parallel-thread + long-message scenarios.
- For v2.7 specifically: create a `v2.7-sse-event-matrix.md` test matrix with every new event type x every provider. Fill it during Phase 080 (first phase emitting new events) and verify it at Phase 089 (cross-cutting verification).
- Add a backend integration test for each new event type that asserts: event is emitted, event has the correct JSON shape, event appears in the Redis Stream after XADD.
- Frontend Vitest unit for each new callback arm in `subscribeToRun` (api.ts) — parse a mock SSE line and assert the correct callback fires.

**Detection:** If a phase ships without a 4-provider UAT row for each new SSE event type it introduces, flag it at verify-work.

**Affected phases:** 080, 081, 082, 083 (all emit new SSE events)

---

## Moderate Pitfalls

### Pitfall 7: Workspace File Versioning Accumulation Without Cleanup

**What goes wrong:** Every `workspace_write` creates a new `workspace_file_versions` row (PRD Q-v2.7-02 recommendation a). An agent that iteratively refines a plan file across 20 iterations creates 20 version rows. Across 1000 threads with 10 workspace files each and 10 versions per file = 100K version rows. The PRD acknowledges this (Section 7 row 6, Section 11) and defers TTL to v3.4, but the accumulation starts immediately.

**Prevention:**
- Add a soft cap: `app_settings.workspace_max_versions_per_file` (default 50). On exceeding, prune oldest versions (keeping version 1 and the most recent N).
- The `workspace_file_versions` table needs an index on `(workspace_file_id, version DESC)` for efficient latest-version queries and pruning.
- The `workspace_diff` tool should warn when requesting diffs between very old versions (>20 apart) that the diff may be large.

**Affected phases:** 080 (workspace tools), 079 (schema — add the index)

---

### Pitfall 8: Harness Tool Whitelist Cache Staleness Across Phase Transitions

**What goes wrong:** The PRD (Section 6 row 1) recommends caching the active phase's `available_tools` whitelist in-memory per `run_id` to avoid a Postgres roundtrip on every tool dispatch. But if the cache isn't invalidated precisely at phase transitions, a tool call at the boundary could be evaluated against the OLD phase's whitelist, incorrectly refusing a tool that IS allowed in the new phase (or worse, allowing one that isn't).

**Prevention:**
- The phase transition function in `harness_engine.py` MUST: (1) write the new phase row to Postgres, (2) invalidate the in-memory cache for the run_id, (3) THEN emit the `workflow_transition` SSE event. The ORDER matters — cache-invalidation before SSE ensures the next tool dispatch reads the correct whitelist.
- Use a simple dict keyed by `run_id` with a monotonic `phase_index` as the cache key. On each tool dispatch, compare the cached `phase_index` with the current `workflow_runs.current_phase_id` — if mismatched, refresh.
- In Deep Mode (no active workflow), skip the cache entirely — `available_tools` is None, meaning all tools are allowed.

**Affected phases:** 081 (harness engine)

---

### Pitfall 9: Right-Side Panel Layout Breaking Mobile Responsive

**What goes wrong:** The current `ChatLayout.tsx` (line 70) is a simple `flex h-screen` with NavPanel + main content. Adding a ~30% right-side panel changes the layout to a 3-column structure. The mobile breakpoint (<768px) requires the panel to become a bottom-sheet. The existing mobile drawer (lines 87-182) already uses `fixed inset-y-0 left-0 z-50` — if the panel bottom-sheet uses a similar z-index and positioning, the two can overlap or fight for gesture space.

**Prevention:**
- The panel bottom-sheet should use a HIGHER z-index than the mobile drawer (e.g., z-60 vs z-50) since it's more contextual (active agent interaction vs navigation).
- On mobile, the panel bottom-sheet should be triggered by the same toggle button as desktop, NOT auto-opened. Auto-opening on Harness Mode entry (per PRD) should be disabled on mobile (screen real estate is too constrained).
- Test at 375px width (iPhone SE) — the bottom-sheet should not overlap the `MessageInput` component.

**Affected phases:** 083 (panel scaffold), G-2 guardrail (sketch-before-plan for UX) should fire

---

### Pitfall 10: sub_agent_service.py Migration — Breaking Existing Skill Instructions

**What goes wrong:** The PRD says `task` tool "replaces ad-hoc `run_sub_agent` per skill" and the function remains as an alias for backward compat. But existing skills stored in the `skills` table may have `instructions` text that references `run_sub_agent` by name (e.g., "Use run_sub_agent to analyze the document"). If the function signature, return type, or streaming behavior changes, these skill instructions become stale or misleading.

**Prevention:**
- `run_sub_agent` MUST remain as a thin wrapper that calls the new `task` tool implementation. Same signature. Same return type (Generator[str, None, None]).
- The `task` tool in the LLM's toolbox is a NEW tool — the LLM calls `task(description=...)`. The old `run_sub_agent` call site inside the `analyze_document` tool handler continues to use the function directly (NOT through the LLM tool dispatch).
- Do NOT merge the `analyze_document`'s internal sub-agent invocation with the LLM's `task` tool. They serve different purposes: `analyze_document` is a backend-driven sub-agent; `task` is an LLM-directed sub-agent.

**Affected phases:** 082 (`task` tool)

---

### Pitfall 11: Workspace UNIQUE(thread_id, path) — Case Sensitivity Across OSes

**What goes wrong:** The PRD specifies case-sensitive paths (POSIX convention). The Postgres UNIQUE constraint on `(thread_id, path)` is case-sensitive by default. But users on Windows or macOS may expect `/Plan.md` and `/plan.md` to be the same file. If the agent writes `/PLAN.md` and later reads `/plan.md`, the read fails with a "file not found" error, confusing the agent.

**Prevention:**
- Keep case-sensitive (per PRD decision — POSIX expectations for skill authors).
- Add a SYSTEM PROMPT instruction to the agent: "Workspace file paths are case-sensitive. Use lowercase paths consistently (e.g., `/plan.md`, not `/Plan.md`)."
- The `workspace_write` tool should normalize common path issues: strip trailing slashes, collapse double slashes, ensure leading `/`.
- Consider adding a `workspace_list` tool that returns existing paths so the agent can check before writing.

**Affected phases:** 080 (workspace tools)

---

### Pitfall 12: Plugin Contract Extension Loading Crashes Lifespan Startup

**What goes wrong:** The PRD's `PLUGINS_BOOTSTRAP` env var path upserts plugin rows at lifespan startup. If a plugin's Python module has a top-level import error (e.g., missing dependency), the lifespan function could crash, preventing the entire application from starting. A single bad plugin takes down the entire deployment.

**Prevention:**
- Per-plugin try/except in the bootstrap loader. Failed plugins logged + skipped; deployment continues.
- Each plugin's Python code MUST be loaded in a lazy fashion (importlib on first use, NOT at lifespan startup). The bootstrap path validates the manifest and creates registry rows; actual code loading happens when the extension point is first exercised.
- Add a `plugin_registry.status` column: `healthy` / `failed` / `disabled`. Bootstrap sets `failed` with an error message if manifest validation fails. The `/admin/plugins` API exposes this status.

**Affected phases:** 085 (plugin contract)

---

## Minor Pitfalls

### Pitfall 13: Workspace Files Storage Bucket RLS Mismatch

**What goes wrong:** The `workspace-files` Supabase Storage bucket needs RLS policies that match the `workspace_files` table's RLS (auth.uid() = thread owner). But Storage bucket policies are configured separately from table RLS. If the Storage RLS is missing or misconfigured, users could access other users' workspace files via direct Storage URL.

**Prevention:** Configure Storage bucket policies in the same migration that creates the bucket (migration 126). Use Supabase's `storage.objects` RLS with a join to `workspace_files` and `threads` to verify ownership. Test with a cross-user read attempt.

**Affected phases:** 079 (schema), 080 (storage adapter)

---

### Pitfall 14: todo_updated SSE Flooding on Rapid Agent Writes

**What goes wrong:** The `write_todos` tool does a full-state replace (per PRD — "simpler invariants"). If the agent calls `write_todos` 5 times in rapid succession (e.g., building a plan step by step), each call emits a `todo_updated` SSE event, and the panel re-renders the entire todo list 5 times. Combined with Pitfall 3 (demux re-renders), this creates visible flicker.

**Prevention:**
- Throttle `todo_updated` SSE events: emit at most once per 500ms per run_id. The final state is always correct (full-state replace means last write wins).
- Alternatively, batch `write_todos` calls within a single iteration: if the agent makes multiple `write_todos` calls in the same tool-dispatch round, only emit ONE `todo_updated` event after the last call.

**Affected phases:** 082 (`write_todos` tool), 083 (panel rendering)

---

### Pitfall 15: Diff Viewer Memory Pressure on Large Workspace Files

**What goes wrong:** The `workspace_diff` tool computes diffs using `difflib` (per PRD). For large files (near the 256KB inline threshold), `difflib.unified_diff` or `difflib.ndiff` can consume significant memory (O(n*m) for the standard algorithm). The diff viewer in the panel receives the full diff and renders it, which for large files could freeze the browser tab.

**Prevention:**
- Cap diff output at 500 hunks or 50KB of diff text. Beyond that, show a summary ("Changed 2,847 lines across 234 hunks — file too large for inline diff. Download both versions to compare.").
- Use `difflib.unified_diff` (not `ndiff`) — unified diffs are more compact and standard.
- Store `delta_from_prev` as a JSON-patch or unified-diff format in the `workspace_file_versions` table, computed at write time (amortized cost), not at read time.

**Affected phases:** 080 (workspace tools — diff computation), 084 (diff viewer UI)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Severity |
|---|---|---|---|
| 079 (Schema) | Migration 133 ALTERs `threads` table — 9+ phases have touched it | Test migration on a copy of production data first; idempotent `ADD COLUMN IF NOT EXISTS` | Moderate |
| 080 (Workspace Tools) | Pitfall 1 (threads.py compounding), Pitfall 4 (content size), Pitfall 11 (case sensitivity) | Extract tool dispatcher BEFORE adding tools; cap workspace_read; normalize paths | Critical |
| 081 (Harness Engine) | Pitfall 8 (cache staleness), tool whitelist enforcement adding latency to EVERY tool call | In-memory cache with phase_index version key; skip cache in Deep Mode | Moderate |
| 082 (New LLM Tools) | Pitfall 2 (ask_user pause/resume), Pitfall 5 (task spawning exhaustion), Pitfall 10 (sub_agent migration) | asyncio.Event with timeout + cross-worker Redis coordination; per-run + global spawn caps; preserve run_sub_agent signature | Critical |
| 083 (Panel UI) | Pitfall 3 (demux re-renders), Pitfall 9 (mobile layout), Pitfall 6 (cross-provider SSE) | Separate Zustand slice for panel state; sketch-before-plan (G-2); 4-provider UAT matrix | Critical |
| 084 (Diff/Preview UI) | Pitfall 15 (large file diffs) | Cap diff output; compute at write time | Minor |
| 085 (Plugin Contract) | Pitfall 12 (lifespan crash) | Per-plugin try/except; lazy loading; status column | Moderate |
| 086 (Dual-mode UX) | Mode-switching mid-thread creating orphaned workflow_runs if user cancels before first phase completes | Cancel-workflow cleanup must cascade to all child resources (workflow_phases rows, sub-agent tasks, pending ask_user events) | Moderate |
| 087 (Reference Plugin) | Plugin manifest schema too strict / too loose — blocks future plugins or allows invalid manifests | Ship the reference plugin FIRST and iterate the schema based on what it actually needs, not theoretical completeness | Minor |
| 088 (Seed Workflows) | Seed workflow_definitions rows baked into migrations are hard to update post-ship | Use idempotent UPSERT on `(slug, version)` so future migrations can evolve seed workflows without conflicting | Minor |
| 089 (Verification) | Declaring GREEN without cross-provider + multi-tool + parallel-thread UAT (the v2.6 075.x lesson) | SC#10 MANDATORY: 4-axis UAT matrix with ALL 4 providers exercised before milestone close | Critical |

---

## Structural Risk: Build-Order Hazard

The most dangerous ordering mistake is shipping Phase 082 (`ask_user`, `task`, `write_todos`) BEFORE Phase 080's tool-dispatcher extraction (from Pitfall 1). If the 3 new tools are added as `elif` branches in the current monolithic agent_runner, and Phase 080 then tries to extract the dispatcher, the extraction PR conflicts with every tool addition and the diff becomes unreviewable.

**Recommended dependency insertion:**

```
079 (Schema) → 079.5 (NEW: threads.py tool-dispatcher extraction — G-5 refactor)
079.5 → 080 (Workspace Tools — registered in new dispatcher)
079.5 → 082 (New LLM Tools — registered in new dispatcher)
080 + 081 → 083 (Panel)
```

This adds one phase but prevents a 075.x-style cascade. The extraction phase is estimated at 3 plans (extract dispatcher module, migrate existing tools, add registration pattern for new tools) and directly addresses the G-5 hot-file ledger entry for `threads.py`.

---

## Sources

- `backend/app/api/threads.py` — 3843 LOC; agent_runner at line 1381; tool dispatch at line 2548; _shielded_finalize at line 3692; RUN_TASKS at line 92; _emit at line 115
- `frontend/src/providers/StreamsProvider.tsx` — 1599 LOC; makeStreamCallbacks at line 214; surfaceId pattern throughout
- `frontend/src/stores/streamsStore.ts` — Zustand v5 store; bucketsBySurface at line 44; per-thread state lift at line 47-79
- `frontend/src/hooks/useMessages.ts` — 112 LOC thin reader; Branch D-3 guard preserved
- `frontend/src/components/layout/ChatLayout.tsx` — flex h-screen layout at line 70; main content at line 184
- `frontend/src/lib/api.ts` — subscribeToRun SSE parser at line 335; 30+ event type branches at lines 396-509
- `backend/app/services/sub_agent_service.py` — run_sub_agent at line 20; sync Generator return type; 152 LOC
- `.planning/PRDs/v2.7.md` — Section 5 (architecture changes), Section 6 (compatibility check), Section 7 (scalability check), Section 12 (phase outline)
- `.planning/PROJECT.md` — Hot-file ledger (threads.py 9+ phases); G-5 guardrail; SC#10 UAT mandate
- CLAUDE.md — Workflow guardrails G-1 through G-6; hot-file ledger
- Project memory `feedback_regressions_during_075_3_uat.md` — 4 cross-provider regressions after 075.3 closeout
- Project memory `feedback_uat_lived_experience_gap.md` — orchestrator-driven UAT misses felt-experience defects
