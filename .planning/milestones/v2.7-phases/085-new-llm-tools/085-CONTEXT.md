# Phase 085: New LLM Tools - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend implementation of three new LLM tools — `write_todos`, `task`, `ask_user` — registered through the Phase 083 tool dispatcher. Each tool emits new SSE event types on the existing `run:{run_id}` Redis Stream. Phase 085 also ships the REST endpoints that Phase 086 (StreamsProvider extension) and Phase 087 (Panel UI) will consume on thread-switch reconcile.

**Out of scope for Phase 085:** Panel UI (Phase 087), StreamsProvider/Zustand demux wiring (Phase 086), Harness Engine and Plugin Contract (deferred to v2.8 per `REQUIREMENTS.md` Future Requirements section).

</domain>

<decisions>
## Implementation Decisions

### `ask_user` tool — pause / resume mechanics

- **D-085-01:** `ask_user(prompt, options=None, timeout_seconds=None)` pauses by **blocking inside the tool handler** — `_handle_ask_user(args, ctx)` awaits a Redis pub/sub `SUBSCRIBE` on channel `ask_user:{run_id}:{tool_call_id}`. The handler returns a normal `ToolResult` containing the user's answer; `agent_runner` sees a regular tool result and continues. No durable run-state machinery. Worker stays bound to the run while paused — acceptable given timeout cap.
- **D-085-02:** Response endpoint: `POST /runs/{run_id}/ask_user_response`. Body: `{tool_call_id: str, response_text: str, choice_index: int | null}`. Returns 200 once `PUBLISH` succeeds. Matches existing `/runs/{run_id}/stream` URL pattern.
- **D-085-03:** Default timeout: **5 minutes** (300 s). Configurable per-call via `timeout_seconds` tool arg. Server clamps to a max via env var `ASK_USER_MAX_TIMEOUT_SECONDS` (default 1800 s = 30 min). On timeout, handler returns `ToolResult(result="ask_user timed out — no response received within Ns")` and agent_runner continues.
- **D-085-04:** Stop-while-pending cleanup: the existing cancel path (Stop button → run cancellation) emits a sentinel `PUBLISH` on the `ask_user:{run_id}:*` channel pattern. Handler wakes up, returns `ToolResult(result="ask_user cancelled by user stop")` so `_shielded_finalize` closes the run normally. No leaked Redis SUBSCRIBE clients.
- **D-085-05:** Reload-survivable persistence: `ask_user` prompts persist as `messages` rows with a marker `kind='ask_user_prompt'` in `tool_calls` jsonb (same shape as Phase 075.4's `system_warning` pattern). Response persists as a follow-up `messages` row with `kind='ask_user_response'`. Panel reconciles via fetch on thread-switch per `D-v2.5-03`.
- **D-085-06:** Parallel `ask_user` calls supported. Each gets a unique `tool_call_id`; Redis channels are per-tool-call-id (`ask_user:{run_id}:{tool_call_id}`), so concurrent SUBSCRIBEs don't collide. Panel renders a stack of pending prompts. Matches OpenAI/Google parallel-tool-call streaming.
- **D-085-07:** Uvicorn shutdown mid-pause: SUBSCRIBE blocks on the worker; on `lifespan` shutdown, the cancel sentinel is broadcast to all in-flight `ask_user:*` channels so handlers can drain cleanly. Unresponded prompts get `ToolResult(result="ask_user interrupted by server shutdown")` and the run completes with status `error`. Migrations are not required — sentinel is a runtime concern.

### `task` tool — sub-agent shape

- **D-085-08:** Tool signature: `task(description: str, instructions: str | None = None, tools: list[str] | None = None, max_steps: int | None = None) -> str`. `description` is required (what to do); `instructions` is task-specific guidance APPENDED to a server-controlled base system prompt (we keep prompt-engineering control — LLMs do not author the full system prompt).
- **D-085-09:** `tools` arg: server validates the requested toolset is a SUBSET of the parent's `available_tools`. LLM cannot grant tools the parent doesn't have. `task`, `ask_user`, and `write_todos` themselves are excluded from sub-agent toolsets (no nested sub-agents — see D-085-12; sub-agents don't write todos or ask the user). Default toolset (when arg omitted) = parent's read-only tools (`search_documents`, `query_documents`, `read_document`, `web_search`, `ls`, `tree`, `grep`, `glob`, `analyze_document`, `query_tables`, `workspace_read`, `workspace_list`).
- **D-085-10:** `max_steps` arg: server clamps to env var `TASK_MAX_STEPS` (default 10). Default when omitted: 5.
- **D-085-11:** `model_override` and `system_prompt_override` are NOT exposed to the LLM in v1 — zero-cross-provider-risk. Sub-agent inherits parent's active provider and the user's configured `sub_agent_model` from Settings. v2.8 can revisit if a need surfaces.
- **D-085-12:** Nesting cap: 1 level. The `ToolContext` carries a new `parent_run_id: UUID | None` field. When non-null (sub-agent context), `_handle_task` returns `ToolResult(result="task() unavailable inside a sub-agent — 1-level nesting cap")`. Enforced server-side.
- **D-085-13:** Result shape: `task()` returns the sub-agent's **final assistant message text only** (summary). Sub-agent's full transcript (tool calls + intermediate steps) lives in the sub-agent's own `run:{sub_run_id}` Stream — Phase 087 panel can drill into it via `sub_run_id` link. Parent context stays tight.
- **D-085-14:** Each `task()` call creates its own `runs` row + Redis Stream at `run:{sub_run_id}`. Parent emits `sub_agent_start{sub_run_id, description, tools, max_steps}` on its own stream so the panel knows there's a drill-down available. Sub-agent end emits `sub_agent_done{sub_run_id, status, summary}` on parent's stream.
- **D-085-15:** Concurrency caps: **per-run 3 / global 20**, both configurable via env vars `TASK_PER_RUN_CONCURRENCY` (default 3) and `TASK_GLOBAL_CONCURRENCY` (default 20). Per-run cap enforced via `asyncio.Semaphore` carried on `ToolContext`. Global cap enforced via Redis-backed counter at `tasks:global:active` with atomic INCR/DECR. Exceeding either returns `ToolResult(result="task() concurrency limit reached — N active, max M")`.
- **D-085-16:** `task` tool COEXISTS with existing `analyze_document` + `run_sub_agent`. Both stay byte-identical (no shared-code-path mods per `feedback_no_cross_provider_regressions`). `task` lives in a new `backend/app/services/task_service.py` file with its own agent loop scaffolding that calls into the same `openai_service.complete()` path. Future deprecation of `analyze_document` happens in v2.8+ once `task` is UAT-proven.

### `write_todos` tool — schema + payload

- **D-085-17:** Tool signature: `write_todos(todos: list[Todo]) -> {accepted: int, version: int}`. Todo shape: `{id: str (client-supplied), content: str, status: 'pending' | 'in_progress' | 'completed', parent_id: str | None, order_index: int}`.
- **D-085-18:** Full-state-replace semantics: every call overwrites the thread's todo list entirely. Server DELETES existing rows + INSERTs new rows in a single transaction. Simple invariants — the list IS what the LLM last said.
- **D-085-19:** Status enum: 3 states only — `pending`, `in_progress`, `completed`. Matches Claude Code's task tool. `cancelled` is identical to deletion in practice; omitted.
- **D-085-20:** Optional nesting via `parent_id`. Schema supports the column day-1 (no future migration). Strong models (OpenAI, Anthropic, Google) use it for break-down workflows; weaker models (DeepSeek, Moonshot) skip it and produce flat lists. Panel renders indented if `parent_id` is set, else flat.
- **D-085-21:** SSE event: `todo_updated` with payload `{todos: [...]}` — full list shipped on every emit (mirrors full-state-replace). Rides existing `run:{run_id}` Redis Stream via `_emit()`. No diff computation — simple, robust across providers.
- **D-085-22:** Dedicated `todos` table — columns: `id uuid pk`, `thread_id uuid fk`, `todo_id text` (client-supplied), `content text`, `status text` (CHECK constraint on 3 values), `parent_id text nullable`, `order_index int default 0`, `created_at timestamptz`, `updated_at timestamptz`. UNIQUE on `(thread_id, todo_id)`. RLS via FK chain `auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id)` — same pattern as `workspace_files` from Phase 084.

### REST endpoints (consumed by Phase 086/087)

- **D-085-23:** Ship four endpoints in Phase 085:
  1. `POST /runs/{run_id}/ask_user_response` — submit user response (load-bearing for D-085-02)
  2. `GET /threads/{thread_id}/todos` — current todo list (Phase 086 reconciles via this on thread-switch per D-v2.5-03)
  3. `GET /threads/{thread_id}/ask_user/pending` — in-flight `ask_user` prompts (rows in `messages` with `kind='ask_user_prompt'` and no matching `ask_user_response` row yet); Phase 087 renders these on reload
  4. `GET /threads/{thread_id}/tasks` — sub-agent run index for Phase 087 drill-down. Returns `[{sub_run_id, description, status, summary, started_at, completed_at}]`. Prevents Phase 086/087 from having to scrape `messages.tool_calls` jsonb.
- **D-085-24:** All endpoints follow existing FastAPI router patterns in `backend/app/api/threads.py` / `backend/app/api/runs.py`. RLS-enforced reads via supabase-py + `auth.uid()`. Wrap sync supabase calls with `run_in_threadpool` per D-v2.5-01.

### Tool count budget

- **D-085-25:** Phase 085 brings the General-Mode toolbox to **24 tools** (16 existing + 5 workspace + 3 new). This sits above Google's recommended 20-tool soft limit but Phase 075.4 already validated cross-provider tool-calling at 21 tools with no measured regression. Keep the 3 new tools as distinct entry points — multi-action consolidation (e.g., `workspace(action='write'|'read'...)`) is a known anti-pattern with Anthropic + Google, and consolidating shipped tools risks regressions across UAT covering 9 providers.
- **D-085-26:** Plant **SEED-035** ("Tool Count Budget — Investigate >20 Tools") with `re_open_trigger`: Google or DeepSeek/Moonshot tool-selection accuracy on the 24-tool toolbox drops below 90% in UAT (measured by failed/wrong tool picks in LangSmith over a 50-sample window). Defers the soft-limit concern without losing it.

### Cross-cutting compliance

- **D-085-27:** SC#10 4-axis UAT (cross-provider × multi-tool × parallel-thread × long-message) applies in full — Phase 085 introduces 4 new SSE event types (`todo_updated`, `ask_user_prompt`, `ask_user_response`, `sub_agent_start`, `sub_agent_done`) AND modifies the agent loop's tool-result handling for the ask_user pause path. UAT MUST cover at least 4 providers (OpenAI, Anthropic, Google, OpenRouter) for each new tool, with at least one row per axis. Planning step lays out the UAT matrix in VALIDATION.md.
- **D-085-28:** All blocking I/O (Supabase queries, Redis PUBLISH/SUBSCRIBE) wraps via `run_in_threadpool` or asyncpg pool per D-v2.5-01. The Redis `SUBSCRIBE` in `_handle_ask_user` uses `redis.asyncio` (already an async client) — no threadpool needed there.

### Claude's Discretion
- Whether `task_service.py` is one file or splits into service + agent-loop adapter (mirror analyze_document pattern or hoist parts out of `threads.py:agent_runner`)
- Exact wire format of the structured diff `Todo[]` payload (always-array vs streaming partial) — pick what reads cleanest in `useTodos` hook for Phase 086
- Migration numbering — next available after Phase 084's. Single migration covering `todos` table + the `kind='ask_user_prompt'`/`'ask_user_response'` doc-comment in messages.tool_calls is fine; or split for clarity
- Whether sub-agent's `runs.parent_run_id` foreign key warrants a new column on `runs` (clean schema) vs storing in `runs.metadata` jsonb (no migration)
- Default ask_user prompt placeholder text shown if the agent passes an empty `prompt` (treat as error vs render "(no prompt)")
- Tool schemas in `openai_service.py:get_tools()` — discretion on tool description wording, but content MUST emphasize each tool's purpose so smaller models route correctly (mitigates the tool-count concern in D-085-25)

</decisions>

<failure_criteria>
## How we'd know this failed (G-6 — failure criteria upfront)

Phase 085 fails if ANY of these observable conditions hold after the phase ships:

1. **`ask_user` cross-worker race** — User submits response on Worker B while paused agent runs on Worker A; agent never receives the response, run times out unexpectedly. (Redis pub/sub design must close this.)
2. **`ask_user` leaks Redis SUBSCRIBE clients** — `redis-cli client list | grep subscribe` shows orphaned clients after Stop button or run cancellation. (Sentinel cleanup must broadcast.)
3. **`ask_user` reload-survival** — User refreshes mid-prompt; prompt vanishes from panel (panel can't reconcile via fetch). Or: user submits response after refresh, but agent doesn't resume because the SUBSCRIBE died with the worker.
4. **`task` runaway loops** — A sub-agent burns >50 iterations because `max_steps` clamp doesn't fire, or sub-agent calls `task()` itself and the 1-level nesting cap doesn't refuse.
5. **`task` cross-provider failure** — Sub-agent emits wrong model name to the provider (the D-075.5-04 footgun). Test rig must include sub-agent invocation on all 4 native providers.
6. **`task` concurrency caps don't fire** — 5+ parallel `task()` calls succeed when per-run cap is 3; or 30+ parallel tasks succeed across runs when global cap is 20.
7. **`write_todos` data loss** — Status reverts to `pending` after a write_todos call (full-state-replace shouldn't lose status — server transaction is faulty). Or: panel reconcile via GET endpoint returns stale data after a write.
8. **Cross-provider tool selection accuracy regresses** — In SC#10 UAT, any of OpenAI/Anthropic/Google/OpenRouter fails to pick the right tool from the 24-tool box in >10% of trials. (This is the SEED-035 trigger.)
9. **Existing tools regress** — Any pre-Phase-085 tool (search_documents, analyze_document, execute_code, workspace_*) behaves differently after Phase 085 ships. (No shared-code-path modifications rule.)
10. **`messages` persistence bugs** — `kind='ask_user_prompt'` rows appear after a non-ask_user message accidentally, OR `kind='ask_user_response'` rows are missing the matching prompt link.

Each of these is testable; planning's VALIDATION.md surfaces one or more UAT/integration rows per failure mode.

</failure_criteria>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 083/084 outputs (foundation)
- `backend/app/services/tool_dispatcher.py` — Registry pattern (`_TOOL_REGISTRY`), `ToolContext` dataclass, `ToolResult` dataclass. New tool handlers register here.
- `backend/app/services/workspace_service.py` — Reference for service-layer + SSE-emit pattern from Phase 084.
- `.planning/phases/083-foundation-tool-dispatch-extraction-bug-fixes/083-CONTEXT.md` — Dispatcher contract (D-01..D-04)
- `.planning/phases/084-workspace-filesystem-backend/084-CONTEXT.md` — Reference implementation pattern (D-01..D-14 for storage + RLS + tool registration)

### Agent loop + SSE
- `backend/app/api/threads.py:1402` — `agent_runner` producer. Tool dispatch integration point.
- `backend/app/api/threads.py:109` — `_emit(redis, run_id, type, **fields)` helper for XADD to `run:{run_id}` Stream.
- `backend/app/api/threads.py:126` — `_emit_terminal()` — terminal event emission pattern (relevant for `_shielded_finalize` flow when ask_user is interrupted).
- `backend/app/api/threads.py:_shielded_finalize` — Run finalization (asyncio.shield) — `ask_user` cancellation must integrate cleanly here.

### Sub-agent baseline (must stay byte-identical per no-regression rule)
- `backend/app/services/sub_agent_service.py:17` — `run_sub_agent` for `analyze_document`. **DO NOT modify.** Phase 085's `task` tool lives alongside in a new `task_service.py`.

### Redis run-backed streaming (D-v2.5-08)
- `backend/app/services/redis_runs.py` (and related run-stream helpers) — XADD / XREAD pattern. `ask_user` pub/sub channels are NEW Redis namespace (`ask_user:{run_id}:{tool_call_id}`) — distinct from `run:{run_id}` Stream.
- `REDIS-SETUP.md` — Redis key conventions (run buffer + sorted sets). Phase 085 adds `ask_user:*` pub/sub channels + `tasks:global:active` counter.

### Provider routing + cross-provider compliance
- `backend/app/services/openai_service.py:get_tools()` — Tool schema registration site. New tools add here.
- `backend/app/config.py:MODEL_CAPABILITIES` + `_SUB_AGENT_MODEL_DEFAULTS` — Provider routing for sub-agent model defaults (D-085-11).
- `.planning/research/STACK.md` — Provider compatibility notes.

### v2.7 milestone scope
- `.planning/PRDs/v2.7.md` §3 Theme C — Locked design for `write_todos`, `task`, `ask_user` (note: v2.7 was rescoped to Themes A+C+D+H; Theme B Harness Engine + Theme E Plugin Contract are deferred to v2.8).
- `.planning/REQUIREMENTS.md` — TOOL-01..TOOL-04 (Phase 085's scoped requirements)
- `.planning/ROADMAP.md` Phase 085 section — 4 success criteria + Research flag note on Redis pub/sub edge cases.

### Cross-cutting rules
- `CLAUDE.md` SC#10 (4-axis UAT) — MANDATORY for streaming/agent-loop/provider-routing/UI-state phases.
- `CLAUDE.md` G-3 (lightweight commands check — full discuss→plan→execute IS correct for Phase 085, confirmed)
- `CLAUDE.md` G-5 hot-file ledger — `backend/app/api/threads.py` at 9+ phases. Phase 085 must minimize threads.py changes; new logic goes in `task_service.py` and new endpoint files.
- `.planning/prd-reset/DECISIONS.md` D-v2.5-01 — wrap blocking I/O via `run_in_threadpool` / asyncpg pool.
- `.planning/prd-reset/DECISIONS.md` D-v2.5-03 — Realtime is best-effort; reconcile via fetch on (re)connect. Phase 086/087 panels MUST fetch via the Phase 085 GET endpoints on thread-switch.
- `.planning/prd-reset/DECISIONS.md` D-v2.5-08 — Run-backed streaming via Redis Streams.

### Anti-patterns + feedback
- `feedback_no_cross_provider_regressions` — Provider bug fixes must be provider-scoped or additive; no shared-code-path modifications.
- `feedback_provider_uniform_ux` — One UX, four adapters. Wire format stays provider-agnostic.
- `feedback_cross_provider_always_top_of_mind` — All 9 providers considered from day 1, not just at verification.
- `feedback_check_user_ask_before_overscoping` — Check existing config knobs before scoping new work. (No existing `ask_user` knob; this phase introduces the surface.)
- `reference_local_dev_app.md` — Test app at http://localhost:5173/, test login fhdmrd@gmail.com / 123456 for Chrome MCP authenticated UAT.

### Related deferred work
- `SEED-035` (planted by this discuss-phase) — Tool count budget; re-open when Google or DeepSeek tool-selection accuracy drops <90%.
- `SEED-034` — System prompt revision for cross-provider tool use (overlapping concern; planning may want to coordinate `task`/`ask_user` tool descriptions with SEED-034's prompt fixes).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/tool_dispatcher.py` (Phase 083) — Tool registration pattern. Phase 085 adds 3 new `_handle_*` functions + 3 `_TOOL_REGISTRY` entries. Mechanical extension.
- `backend/app/services/workspace_service.py` (Phase 084) — Reference for service-layer + SSE-emit pattern. `task_service.py` mirrors this shape (service entry points called from a thin dispatcher handler).
- `backend/app/services/sub_agent_service.py` — Existing `run_sub_agent` for `analyze_document`. Reference pattern for sub-agent LLM streaming, model-override safety, fallback sentinel. **Read but DO NOT modify** — Phase 085's `task` builds a new path alongside.
- `backend/app/api/threads.py:_emit()` — SSE emission. All new SSE events use this same helper.
- `backend/app/utils/db.py:aexec()` — Async wrapper for sync supabase-py calls.

### Established Patterns
- Per-thread SSE event payloads ride `run:{run_id}` Redis Stream — never invent new key namespaces for events; pub/sub for `ask_user` IS a new namespace because it's a control channel, not an event stream.
- RLS via FK chain to `threads` — `todos` table follows this template verbatim.
- Persistence for reload-survival via `messages` rows with `kind` marker in `tool_calls` jsonb — Phase 075.4 pattern for `system_warning`, extended here for `ask_user_prompt` and `ask_user_response`.
- Sub-agent model routing fallback (`backend/app/services/sub_agent_service.py:67-89`) — `task` reuses this exact safety net to avoid the D-075.5-04 cross-provider-misroute footgun.
- `_shielded_finalize` for cancellation safety — `ask_user`'s sentinel-publish cleanup integrates with this.
- `run_in_threadpool` for sync supabase calls in async handlers (D-v2.5-01) — applies to all new endpoints.

### Integration Points
- `tool_dispatcher.py:_TOOL_REGISTRY` — Add 3 new entries: `"write_todos"`, `"task"`, `"ask_user"`.
- `openai_service.py:get_tools()` — Append 3 new tool JSON schemas.
- `backend/app/api/threads.py` — Minimal changes: extend `ToolContext` dataclass with `parent_run_id: UUID | None` (for nesting cap) and `per_run_task_semaphore: asyncio.Semaphore` (for concurrency cap). No agent_runner control-flow changes — handlers do their own pause/spawn.
- `backend/app/api/runs.py` or new `backend/app/api/ask_user.py` — Host the `POST /runs/{run_id}/ask_user_response` endpoint.
- `backend/app/api/threads.py` — Host the three GET endpoints for thread-scoped data (or extract to `backend/app/api/panel.py` if file size becomes a concern — minimal G-5 mitigation).

### New code surfaces (Phase 085 owns)
- `backend/app/services/task_service.py` — `task()` sub-agent runner. Builds on `openai_service.complete()` + `tool_dispatcher.dispatch_tool()` with the constrained toolset + 1-level nesting guard.
- `backend/app/services/todos_service.py` — `write_todos()` full-state-replace transaction + SSE emit + GET endpoint helper.
- `backend/app/services/ask_user_service.py` — Redis pub/sub helpers (`subscribe_for_response`, `publish_response`, `publish_cancel_sentinel`). Encapsulates the channel naming + cleanup.
- New migration (next # after 084's range — Claude's discretion) — `todos` table + indexes + RLS policies + comment on `messages.tool_calls.kind` allowed values.

</code_context>

<specifics>
## Specific Ideas

- `ask_user` pause-by-handler-block (D-085-01) is the simplest correct shape. The producer holds the worker — that's OK because (a) Phase 075/077 already validated WORKER_COUNT=2 multi-worker capacity, (b) max pause is 5 min default / 30 min hard cap. If a deployment hits worker exhaustion from many concurrent paused asks, the operator can raise `WORKER_COUNT` — knob already exists.
- Redis pub/sub channel naming `ask_user:{run_id}:{tool_call_id}` is INTENTIONALLY distinct from the Redis Stream `run:{run_id}` namespace. Pub/sub is for control signals (one-shot publish, one subscriber); Streams are for event buffers (append-only, replay-capable). Don't mix.
- `task` sub-agent's full transcript living on its own `run:{sub_run_id}` Stream means existing `/runs/{run_id}/stream` and `/runs/{run_id}/snapshot` endpoints work for sub-agents for free. Phase 087 panel drill-down hits these existing endpoints.
- Migration discretion: a single migration covering the `todos` table + a doc-comment on `messages.tool_calls.kind` is cleanest. Don't split into 3 migrations for 3 concerns.
- Tool description wording in `get_tools()` MUST be specific about purpose to mitigate the 24-tool selection-accuracy concern. Use the Claude-Code-style tool-description pattern: lead with "Use when..." + "Do not use for..." for each tool.

</specifics>

<deferred>
## Deferred Ideas

- **`task` `system_prompt_override` / `model_override` exposure** — Out of scope for v2.7 / Phase 085 per D-085-11. Revisit in v2.8 if specialized sub-agent patterns (Researcher/Coder/Reviewer) need different prompts or models. Re-open trigger: a v2.8 phase explicitly scopes named sub-agent roles.
- **Tool count consolidation** — Captured as `SEED-035` (planted by this discuss-phase). Re-opens automatically if Google or DeepSeek/Moonshot tool-selection accuracy drops <90% in UAT.
- **Harness Engine workflows** — v2.7 scope reduced to Themes A+C+D+H; Theme B (Harness state machine) and Theme E (Plugin Contract) deferred to v2.8. `task` tool in Phase 085 stays a simple sub-agent spawn — NOT a workflow phase type. v2.8 can wrap `task` calls in a workflow_phase if Harness ships.
- **Sub-agent panel drill-down deep-link** — Phase 087 owns. Phase 085 ships the data via `GET /threads/{tid}/tasks` + existing `/runs/{sub_run_id}/stream`; Phase 087 wires the UI.
- **`write_todos` checkbox-in-panel-flips-status** — Out of scope per `REQUIREMENTS.md` PANEL-02 ("status indicators" = display-only). Phase 087's panel is read-only for todos in v1. User-flips-checkbox is a v2.8 follow-up.
- **`ask_user` rich UI (markdown prompt, attachments)** — v1 ships plain text prompt + optional choice buttons + free-text response. Markdown rendering in the prompt and file attachment in the response are deferred. Re-open if operator UAT shows the panel ask_user UX is too plain.
- **BUG-260523-04 (Anthropic 15+ tool iterations)** — Cross-checked during this discuss-phase. NOT folded into Phase 085 — its `re_open_trigger` targets a post-075.4 LangSmith trace investigation phase, not v2.7. Tangentially relevant (sub-agents will iterate too) but the root cause is system-prompt/anthropic-loop, not sub-agent design. Status: `deferred` (unchanged).
- **BUG-260528-03 (non-Anthropic generic task descriptions)** — Open, frontend/streaming concern. NOT in Phase 085's backend-only scope. Leave open.

</deferred>

---

*Phase: 085-new-llm-tools*
*Context gathered: 2026-05-28*
