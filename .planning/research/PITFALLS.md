# Pitfalls Research

**Domain:** Deterministic workflow harness (LLM state machine) + dual-mode UX on a mature multi-provider streaming agent platform
**Researched:** 2026-05-30
**Confidence:** HIGH (grounded in actual substrate — `tool_dispatcher.py`, `task_service.py`, `ask_user_service.py`, `threads.py` agent_runner, `openai_service.get_tools`; cross-checked against v2.7 PRD §3/§6/§7 + durable-execution prior art)

> **Scope note.** These pitfalls are specific to adding a harness/workflow-runtime + Deep/Harness dual-mode to *this* codebase. Generic "state machines are hard" advice is omitted. Every prevention names a real file:line and an owning phase. Phase numbers below are the v2.8 phases the roadmapper will create; where the v2.7 PRD §12 already proposed a phase shape (079=schema, 081=harness scaffold), I reference that intent but renumber to the real v2.8 head (the milestone renumbers migrations from **056+** per PROJECT.md, and the PRD's 079-089/migration-125-139 numbers are stale fiction from before the v2.7/v2.8 split).

> **Phase-ownership legend (used throughout):**
> - **P-EXTRACT** — `agent_runner` extraction from `threads.py` into a clean `harness/agent_loop` module (G-5 FIRING — must land FIRST).
> - **P-SCHEMA** — migrations 056+ (workflow_definitions / workflow_runs / workflow_phases / immutable trigger / RLS).
> - **P-ENGINE** — harness state-machine engine (transitions, validators, persistence, resume).
> - **P-ENFORCE** — per-phase tool-whitelist enforcement at the dispatch seam.
> - **P-BATCH** — `llm_batch_agents` fan-out + concurrency.
> - **P-MODE** — dual-mode UX + workflow-lock + mid-thread switch.
> - **P-EVAL** — cross-provider eval harness (SEED-034 regression gate) + tool-count budget (SEED-035).
> - **P-VERIFY** — cross-cutting verification (resume smoke test, 4-axis UAT, Chrome MCP).

---

## Critical Pitfalls

### Pitfall 1: Cross-provider regression from editing the shared streaming/tool-dispatch hot path

**What goes wrong:**
The harness needs per-phase tool whitelisting, which the v2.7 PRD §6 row 1 wires into "the tool dispatcher inside the agent loop." If that wiring edits the shared per-provider streaming branches in `threads.py` (the Anthropic branch ~L1897, Google branch ~L2025, OpenAI-compat branch ~L2169, all feeding one `tool_calls_buffer`) or the shared `dispatch_tool` path, a change that looks correct for one provider silently breaks another. This is the exact failure class that produced the entire 075.x cascade (8 phases): Gemini-3 `thought_signature` drops, Anthropic 22-iteration loops, OpenRouter duplicate outputs, the global `isStreaming` lockout — each from a shared-path edit.

**Why it happens:**
The agent loop has 3 provider-specific accumulation branches that converge on a single `tool_calls_buffer` and a single `dispatch_tool` call site (`threads.py:2677`). Adding "check the phase whitelist" feels like a one-line insert at the convergence point, but the providers differ in *when* tool calls finalize (Anthropic emits `end_turn` not `tool_calls`; Google attaches `thought_signature`; DeepSeek/Moonshot need `reasoning_content` round-trip). A refusal that mutates `messages` or `tool_calls_buffer` in the wrong spot corrupts a provider that wasn't tested.

**How to avoid:**
- **Enforce at the dispatch boundary, not in the streaming branches.** The clean seam is `dispatch_tool(tool_name, args, ctx)` (`tool_dispatcher.py:1495`) and its call site (`threads.py:2677`). `ToolContext` *already carries* `available_tools: list[str]` (`tool_dispatcher.py:88`, populated at `threads.py:2656-2659`). The whitelist check is purely additive: before invoking the handler, if `ctx.workflow_phase_tools is not None and tool_name not in ctx.workflow_phase_tools`, return `ToolResult(result=<tool_not_available_in_phase JSON>)`. This rides the SAME `tool_result` → `messages` → next-iteration path every provider already uses. No streaming branch touched.
- **There is a proven in-codebase precedent:** `_handle_task` (`tool_dispatcher.py:1090-1110`) already refuses out-of-subset tools by returning a friendly `ToolResult` string — generalize THAT pattern, don't invent a new one.
- **Mode-gate the whole feature to a no-op when no workflow is active.** When `threads.active_workflow_run_id IS NULL`, `ctx.workflow_phase_tools` stays `None` and the dispatcher is byte-identical to today. Deep Mode (the default, every existing user) is provably untouched.
- **Honor CLAUDE.md `feedback_no_cross_provider_regressions`:** provider fixes must be provider-scoped or additive; never modify the shared chunk handler / SSE emitter in ways that break a working provider. The whitelist edit must be a pure pre-check, never a streaming-branch edit.

**Warning signs:**
A diff to any of `threads.py` lines ~1897 / ~2025 / ~2169 (provider branches), to `tool_calls_buffer` assembly, or to `_emit`/`_emit_terminal`. Any change whose test plan exercises only one provider. A whitelist check placed *inside* a `if active_provider_name == ...` block.

**Phase to address:** P-EXTRACT (extract the loop cleanly first so the seam is obvious), P-ENFORCE (add the additive pre-check), P-EVAL (the eval harness is the regression backstop), P-VERIFY (4-axis UAT).

---

### Pitfall 2: Tool-whitelist enforcement bypass — non-whitelisted tool crashes instead of being refused-and-fed-back

**What goes wrong:**
The state-machine guarantee is "the model literally cannot escape the phase." If a refused tool call throws (KeyError, unhandled exception, or a malformed `tool_result` the provider rejects on the next round), the run dies or hangs instead of cleanly telling the LLM "that tool isn't available now, here's what is." Worse: if the refusal isn't fed back as a normal `tool_result`, the provider's next call sees an `assistant` tool-call turn with no matching `tool` response → 400 error (every provider requires the tool-call/tool-result pairing — see the DeepSeek `reasoning_content` and Gemini `thought_signature` round-trip constraints at `threads.py:2604-2620`).

**Why it happens:**
Developers model the whitelist as "remove the tool from `get_tools()` so the model never sees it." But models hallucinate tool names anyway (and the schema list and the enforcement list can drift). The dispatcher must handle "model emitted a tool not in this phase" as a *normal, expected* event, not an exception.

**How to avoid:**
- **The substrate already does this correctly for unknown tools:** `dispatch_tool` returns `ToolResult(result=f"Unknown tool: {tool_name}")` for any unregistered name (`tool_dispatcher.py:1497-1499`) — never raises. The phase-whitelist refusal must follow the identical shape: return a structured `ToolResult`, e.g. `{"error": "tool_not_available_in_phase", "tool": name, "available": [...], "hint": "call one of the available tools"}`.
- **Belt-and-suspenders: also constrain the schema.** Filter `get_tools(user_settings)` to the phase's `available_tools` so the model's tool-choice menu matches enforcement (reduces refusals to ~zero in the happy path). But NEVER rely on schema-filtering alone — enforcement at dispatch is the actual guarantee.
- **The call site already swallows tool exceptions** (`threads.py:2690-2698`: `json.JSONDecodeError` / `ValueError` / `RuntimeError` / bare `Exception` all map to a `tool_result` string and `_emit('tool_end')`). The refusal path inherits this safety net. Add a test that asserts the refused call produces a `tool` message with matching `tool_call_id` so the next provider round is well-formed.
- **Emit a `tool_not_available_in_phase` event on the run stream** so the panel can show "blocked tool X" — this is observability, riding the existing `_emit` XADD path (no new substrate).

**Warning signs:**
A run that 500s or hangs when the model picks a wrong tool. A provider 400 ("tool_call_id has no matching tool response" / "tool_use ids must have tool_result") on the iteration AFTER a refusal. A refusal path that doesn't append a `{"role": "tool", "tool_call_id": ...}` message.

**Phase to address:** P-ENFORCE (owns the refusal contract). Cross-provider correctness verified in P-EVAL + P-VERIFY (4-axis: a refusal row per provider).

---

### Pitfall 3: State-machine deadlock — a phase that never advances (stuck `active`/`gate_validating`)

**What goes wrong:**
A phase enters `active` and the run sits forever: an `llm_agent` phase whose model keeps calling tools and never self-terminates; a `programmatic` phase whose Python function hangs on I/O; a `gate_validating` phase whose `on_failure: retry` loops; a phase whose only valid next tool isn't in its own whitelist (an unreachable transition — the model is told "you may only call X" but X cannot satisfy the gate, so it can never produce the output the gate wants). The run's `status` stays `active`, no terminal sentinel is emitted, the panel timeline freezes mid-phase.

**Why it happens:**
The harness has TWO independent "who decides we're done" authorities that can disagree: the per-phase `max_steps` cap (LLM-loop bound) and the validation gate (output bound). If a phase's whitelist makes the gate unsatisfiable, neither fires cleanly. Also: the existing agent loop's `force_no_tools` safety (`threads.py:1868` — last iteration forces a text response) is per-RUN, not per-PHASE; a naive `llm_agent` phase reimplementation can omit it.

**How to avoid:**
- **Every phase MUST have a wall-clock cap AND a step cap, both enforced by the backend, not the LLM.** The PRD §5 already specifies `HARNESS_PHASE_MAX_DURATION_SEC=600` env default + per-phase `max_duration_seconds` override — wrap each phase's execution in `asyncio.wait_for(..., timeout=phase_max_duration)`. This mirrors the per-LLM-call timeout machinery already proven in v2.5 Phase 066 and the `asyncio.wait_for` Docling wall-clock fail-safe in Phase 071.1.
- **`llm_agent` phases reuse the existing `force_no_tools`-on-last-iteration guard** (`threads.py:1868`) — port it into the extracted loop so the final step always forces a tool-free answer. This is exactly why P-EXTRACT must land first: the guard must live in the shared extracted loop, not be re-implemented per phase.
- **Phase timeout → `on_failure` handler, never silent.** A phase that hits its wall-clock or step cap transitions to `failed` (or `skipped`/`retry` per config) with a `workflow_phase_end{status: 'failed', reason: 'timeout'}` event. The backend owns this transition.
- **Validate workflow definitions at PUBLISH time** for reachability: every gate's required output must be producible by at least one tool in that phase's whitelist; every `skip_to_phase:<slug>` target must exist. A static lint at publish prevents authoring an unsatisfiable phase.

**Warning signs:**
`workflow_runs.status = 'active'` with `current_phase_id` unchanged for > phase timeout. No `workflow_phase_end` after a `workflow_phase_start`. A phase whose `validators` reference a file/field no whitelisted tool can write. CPU pinned by a `programmatic` phase.

**Phase to address:** P-ENGINE (timeouts + transition authority + publish-time reachability lint), P-EXTRACT (the shared force-no-tools guard).

---

### Pitfall 4: Validation-gate infinite-retry loop

**What goes wrong:**
A phase with `on_failure: retry` and a deterministically-failing validator (the model can't satisfy the `json_schema`, the `workspace_file_exists` file is never written, a buggy `programmatic` validator always returns False) retries forever — burning tokens, money, and a global concurrency slot. This is Pitfall 3's twin but specifically the gate path.

**Why it happens:**
`retry` is the intuitive default for "gate failed," but retries without a cap assume the failure is transient. Many gate failures are *structural* (the prompt can't produce schema-valid output) and retrying is futile.

**How to avoid:**
- **Cap retries per phase** (`max_retries`, recommend default 2-3, hard ceiling configurable). After the cap, escalate to `on_failure_final` (fail_run or skip), never loop. Persist `retry_count` in `workflow_phases` so the cap survives a worker restart (otherwise a restart mid-retry resets the counter → Pitfall 5 interaction).
- **Distinguish transient vs structural failure.** A `json_schema` validation failure on attempt N with identical model output as attempt N-1 is structural — short-circuit immediately (don't waste the remaining retries). Hash the phase output; if two consecutive retries produce byte-identical failing output, fail fast.
- **Feed the validator error back into the retry prompt.** A blind retry repeats the mistake; a retry that includes "your output failed schema validation: <error>" gives the model a chance to self-correct (turns a structural failure into a recoverable one). This mirrors the self-correcting tool-error pattern already used for weak-model arg coercion (`tool_dispatcher.py:1219-1242`).
- **Every retry increments the run's token counters** (PRD §6 row 8 — harness phases write `runs.input_tokens/output_tokens`) so a runaway retry is visible in spend telemetry, and a future spend cap can kill it.

**Warning signs:**
`workflow_phases.status = 'gate_validating'` cycling. Token counters climbing on a run with no panel progress. Identical `validator_results` payloads on consecutive `workflow_phase_gate_check` events. A `programmatic` validator with no observed True return.

**Phase to address:** P-ENGINE (retry cap + structural-failure detection + error-feedback prompt).

---

### Pitfall 5: Resumability edge cases — worker restart mid-phase, mid-LLM-call, mid-ask_user-pause

**What goes wrong:**
HARNESS-RUN-01's promise is "kill uvicorn, restart, resume, no state loss." But the failure modes are subtle:
- **Mid-LLM-call restart:** the `create_adaptive_streaming_chat` call was in flight; the partial completion is lost. If the phase was marked `active` but no output persisted, resume must RE-RUN the phase, not skip it. If it was double-marked `completed` optimistically before the output landed, resume skips a phase that never produced output.
- **Mid-`programmatic`-phase restart:** the Python function had side effects (wrote a workspace file, called an external API). Re-running on resume double-applies them unless the function is idempotent.
- **Mid-`ask_user`-pause restart:** the paused handler was blocked on a Redis SUBSCRIBE (`_handle_ask_user`, `tool_dispatcher.py:1396-1417`). On restart, the SUBSCRIBE is gone — but the `messages` row with `kind='ask_user_prompt'` was persisted FIRST (`tool_dispatcher.py:1358-1374`, D-085-05). If resume doesn't re-establish the subscription AND replay the pending prompt, the user's eventual answer PUBLISHes into the void and the run hangs.
- **Multi-worker:** a different worker resumes than the one that started — in-memory state (the per-run whitelist cache from PRD §6 row 1, the `per_run_task_semaphore`) is gone.

**Why it happens:**
The existing run-backed streaming substrate persists *events* (Redis Stream) and *run status* (Postgres), but the agent loop's in-memory `messages` list, accumulators, and semaphores are ephemeral. "Resume" naively means "restart the producer task," which loses everything not in Postgres.

**How to avoid:**
- **Persist phase state transitions as a strict 2-phase write:** mark `active` BEFORE the work; persist `output` + mark `completed` only AFTER the output is durably stored. On resume, any phase in `active` (not `completed`) is RE-RUN from scratch — never assume partial progress. This is the at-least-once + idempotent contract; the PRD §6 row 2 already names "phase row UPSERT first; SSE emit second."
- **Make `programmatic` phases idempotent or guarded.** Either the function is naturally idempotent, or it checks "did I already produce my output?" (e.g. workspace file exists at expected version) before side-effecting. Document this as a hard contract for `PROGRAMMATIC_PHASE_REGISTRY` authors.
- **`llm_single`/`llm_agent` phases are safe to re-run** (LLM calls are stateless per CLAUDE.md — "stateless chat completions, no provider-side thread state"); just re-run the phase prompt. The only cost is duplicate tokens, acceptable.
- **Resume must re-hydrate the `ask_user` pause.** On startup/resume, scan for runs in `status='awaiting_user'`, re-SUBSCRIBE to `ask_user:{run_id}:{tool_call_id}` (derivable from the persisted `messages.tool_calls` row), and re-emit the pending `ask_user_prompt` so the panel re-renders. The durability path is already half-built (the row persists first); the resume-side re-subscribe is the new work. **Crucially: the user's POST response endpoint already persists the response row before PUBLISH** (`ask_user_service.publish_response` returns subscriber count; `publish_response` docstring: "POST endpoint still returns 200 because the messages row was persisted FIRST") — so resume can also reconcile by reading the persisted response if it arrived during the gap.
- **Rebuild ephemeral in-memory state on resume:** re-create the whitelist cache from `workflow_phases.available_tools` (Postgres is source of truth — D-v2.5-03 reconcile-on-reconnect rule), re-init the `per_run_task_semaphore`.
- **Write a resume smoke test that kills uvicorn at each phase type** (this is HARNESS-RUN-01's verification — PRD §12 Phase 089/our P-VERIFY): mid-`programmatic`, mid-`llm_agent`, mid-`ask_user`.

**Warning signs:**
Resumed runs that skip a phase (output is empty/missing). Double-applied side effects (two workspace versions from one `programmatic` phase). An `awaiting_user` run that never resumes after the user answers post-restart. A resumed run that crashes on a missing semaphore/cache.

**Phase to address:** P-ENGINE (2-phase write + idempotency contract + resume re-hydration), P-VERIFY (per-phase-type kill-and-resume smoke test). Multi-worker discipline inherits D-PRD-08.

---

### Pitfall 6: `llm_batch_agents` fan-out blows the AnyIO 200-concurrency ceiling + global task cap

**What goes wrong:**
`llm_batch_agents` spawns N parallel sub-agents. The PRD §7 row 3 already flags this: "N=10 batch agents × 50 parallel workflow runs = 500 concurrent sub-runs — exceeds AnyIO ceiling." Each sub-agent's LLM call goes through `run_in_threadpool` (`task_service.py:_stream_one_iteration` → `create_adaptive_streaming_chat` is a SYNC iterator drained in a worker thread). The default AnyIO threadpool ceiling is **40 tokens** (not 200 — see correction below); the codebase raised it, but it remains finite. Exhaust it and EVERY threadpool-dependent operation app-wide (sandbox execution, supabase-py sync calls wrapped in `run_in_threadpool`) starves — the whole app hangs, not just the batch phase.

> **Evidence correction:** PROJECT.md §7 and the PRD reference an "AnyIO 200 ceiling." AnyIO/Starlette's default `run_in_threadpool` limiter is **40** total tokens by default; the project apparently lifted it (Phase 058 "200 post-Phase 058"). Treat the exact number as a *tunable shared budget*, not infinite — the batch phase must reserve against it, whatever its current value. **VERIFY the live `total_tokens` value before sizing batch defaults** (`anyio.to_thread.current_default_thread_limiter().total_tokens`).

**Why it happens:**
The `task` tool's existing caps are designed for an LLM that *occasionally* spawns a sub-agent: per-run `asyncio.Semaphore(3)` (`task_service.py` docstring, default 3) + global Redis-Lua counter cap 20 (`acquire_global_task_slot`, `tasks:global:active`). A `llm_batch_agents` phase that wants N=10 deterministic parallel agents will saturate the per-run semaphore (only 3 slots) → 7 of 10 refused with "task() per-run concurrency limit reached" (`tool_dispatcher.py:1143`), OR if the phase bypasses the `task` tool and spawns directly, it can blow past the global cap of 20.

**How to avoid:**
- **`llm_batch_agents` MUST enforce its own `max_parallel` (the PRD §7 recommends default 5).** Fan out N total agents but run at most `max_parallel` concurrently (a bounded `asyncio.Semaphore(max_parallel)` LOCAL to the phase + `asyncio.gather` over batches). Never spawn all N at once.
- **The phase's `max_parallel` must compose with the global cap, not bypass it.** If `llm_batch_agents` reuses the `task` tool (PRD Theme B says it "reuses the existing `task` tool for spawning"), then ALL batch agents go through `acquire_global_task_slot` — good, they respect the global cap of 20. But the per-run `Semaphore(3)` is too small for batch work: introduce a SEPARATE, larger per-phase semaphore for batch agents (SEED-036a "`task()` global-concurrency fair-share" is exactly this), OR raise the per-run semaphore when inside a batch phase. Decide explicitly; don't let 3 silently throttle a batch of 10.
- **Fail-share, not fail-whole.** If the global cap is saturated, a batch phase should run the agents it *can* (serialized through available slots) rather than refusing the whole phase. `acquire_global_task_slot` fails-closed per-agent (`task_service.py:80` returns False on cap/error) — the batch executor must treat a False as "wait and retry this agent," not "abort the batch."
- **Size batch defaults against the SHARED budget.** With a global cap of 20 and an AnyIO threadpool budget of ~200 (verify), `max_parallel=5` per batch phase × realistic concurrent workflow count stays well under both. Document the math in the engine.
- **Do NOT run blocking I/O in async handlers** (D-v2.5-01): batch agents' sync LLM streams stay wrapped in `run_in_threadpool` exactly as `task_service.py:193` already does. Don't "optimize" by calling the sync SDK directly in the async path.

**Warning signs:**
App-wide latency spike during a batch phase (threadpool starvation — cross-tab GET that was <15ms now seconds). "task() per-run concurrency limit reached" in logs during a batch phase. `tasks:global:active` pinned at 20. A batch phase that completes far fewer agents than requested.

**Phase to address:** P-BATCH (owns `max_parallel` + fair-share + threadpool-budget sizing). SEED-036a folds here. Verified under P-VERIFY 4-axis parallel-thread axis.

---

### Pitfall 7: Immutable-on-publish race conditions

**What goes wrong:**
`workflow_definitions` is immutable-on-publish (HARNESS-DEF-01: `published_at` can't be UPDATEd; editing requires a new semver). Race windows:
- **Publish-while-running:** worker A publishes v1.1 of a definition while worker B is mid-run on v1.0. If `workflow_runs` references the *definition row* by mutable slug rather than the immutable `(slug, version)` snapshot, B's in-flight run can read v1.1's phases mid-execution → phase-config drift mid-run.
- **Concurrent publish of the same version:** two requests publish `(slug, '1.0.0')` simultaneously; without a DB-level uniqueness guarantee + trigger, one overwrites or both partially commit.
- **Trigger bypass:** the immutable trigger blocks UPDATE, but a `DELETE` + `INSERT` of the same `(slug, version)` sidesteps the immutability semantics (the "version" now means something different than it did mid-run).

**Why it happens:**
Immutability is enforced at the row level (trigger on UPDATE), but the *reference* semantics (which row a running workflow reads) and the *publish atomicity* (insert-then-flip-published_at) are separate concerns developers conflate.

**How to avoid:**
- **`workflow_runs` snapshots the resolved phase config at run start**, OR references the immutable `workflow_definitions.id` (the specific `(slug, version)` row, never the mutable slug). A running workflow must read a frozen definition. The PRD §3 has `workflow_runs.workflow_definition_id uuid fk` — make resolution by ID, and treat the row as immutable once `published_at` is set.
- **Enforce immutability with BOTH a `UNIQUE(slug, version)` constraint AND the UPDATE-blocking trigger** (PRD §3 specifies both). Mirror the proven `skill_versions` immutable trigger shape (D-PRD-13). Also block DELETE of a published version that any `workflow_runs` row references (FK with `ON DELETE RESTRICT`).
- **Publish atomically:** insert the definition with `published_at` set in a single statement (not insert-then-update), so there's no "published but half-written" window. Validate the full `phases` jsonb (reachability lint from Pitfall 3) *before* the insert, inside the same transaction.
- **RLS still applies** — the trigger and constraints are orthogonal to RLS; both must be present (CLAUDE.md: all new tables need RLS).

**Warning signs:**
A run whose observed phase order doesn't match the definition it started with. Two `workflow_definitions` rows with the same `(slug, version)`. A publish that leaves `published_at` NULL on a row that's already referenced by runs. An integration test that publishes then UPDATEs and the UPDATE *succeeds*.

**Phase to address:** P-SCHEMA (UNIQUE constraint + immutable trigger + FK RESTRICT), P-ENGINE (run reads by immutable ID / snapshots config; publish-time validation in-transaction).

---

### Pitfall 8: Dual-mode mid-thread switch — state corruption + workflow-lock holes

**What goes wrong:**
MODE-SWITCH-01: Deep → Harness allowed mid-thread (spawns a `workflow_runs` row); Harness → Deep REFUSED until the workflow completes or is cancelled. Corruption modes:
- **Switch while streaming:** the user toggles to Harness Mode while a Deep-Mode run is mid-stream. The in-flight run's `available_tools` was computed for Deep Mode; the new phase whitelist doesn't apply to it; the panel shows a phase timeline for a run that isn't phase-constrained.
- **Lock bypass via parallel tabs/threads:** the workflow-lock is per-thread, but the 075.x history shows global UI flags leak across threads (BUG-260523-01: composer locked globally during any stream — fixed by lifting to per-thread `Map`/`Set`). A naive `isHarnessLocked` boolean re-introduces the same cross-thread bug.
- **Stale `active_workflow_run_id`:** the column is set on switch but a crashed/cancelled workflow leaves it dangling → the thread is permanently "locked in Harness Mode" with no active run.
- **Mid-thread switch loses Deep-Mode context:** `threads.deep_mode_metadata` snapshot (PRD Theme F) isn't captured, so switching back after cancel drops the todo/workspace state.

**Why it happens:**
Mode is thread-level state, but UI streaming flags and the agent loop's tool resolution are run-level. The two must stay consistent across the switch boundary, and the lock must be per-thread (never global).

**How to avoid:**
- **Mode switch only takes effect on the NEXT run, never mutates an in-flight run.** A switch sets `threads.active_workflow_run_id` / mode metadata; the currently-streaming run finishes under its original mode. Enforce: refuse a switch *during* an active stream on that thread, OR queue it. The existing per-thread streaming state (`streamsStore.ts` per-thread `Map<threadId, T>` from BUG-260523-01) is the model — mode-lock state MUST be per-thread keyed, never a global boolean.
- **The workflow-lock is a server-side invariant, not just a UI affordance.** Harness → Deep refusal is enforced where the run is created (check `active_workflow_run_id IS NOT NULL AND workflow status NOT IN ('completed','failed','cancelled')`), not only by graying out a button. UI and server agree.
- **Clear `active_workflow_run_id` on every terminal workflow status** (completed/failed/cancelled) in the same transaction that writes the terminal status — no dangling lock. The "Cancel workflow" affordance (PRD Theme F) must perform this clear.
- **Snapshot `deep_mode_metadata` on switch into Harness** so cancel/return restores it.
- **Reconcile on (re)connect** (D-v2.5-03): the panel fetches `GET /threads/{id}/workflow` on mount to learn the true mode/lock state — never trust a Realtime/SSE hint alone.

**Warning signs:**
A thread stuck in Harness Mode with no running workflow (`active_workflow_run_id` set, workflow terminal). Composer/mode toggle disabled on Thread B because Thread A is streaming (global-flag leak — the 075.x signature). A phase timeline rendering over a free-chat run. Switching back to Deep loses todos/files.

**Phase to address:** P-MODE (per-thread lock state + next-run-only semantics + terminal clear + metadata snapshot). Cross-thread isolation verified under P-VERIFY 4-axis parallel-thread axis (the explicit lesson from BUG-260523-01).

---

### Pitfall 9: `ask_user` / human-input timeout + graceful expiry across workers

**What goes wrong:**
`llm_human_input` phases (and Deep-Mode `ask_user`) pause indefinitely waiting for a human. Failure modes:
- **No expiry → zombie runs:** a user never answers; the run holds a global concurrency slot and an open Redis SUBSCRIBE forever.
- **Timeout fires but the LLM gets a confusing result:** on timeout the handler returns `"ask_user timed out — no response received within Ns"` (`tool_dispatcher.py:1416`) — but for an `llm_human_input` *phase*, a timeout should drive the phase's `on_failure`, not just hand the LLM a string.
- **Cross-worker answer race:** the POST `/ask_user_response` lands on worker B; the paused SUBSCRIBE is on worker A. The pub/sub rendezvous handles this (channel `ask_user:{run_id}:{tool_call_id}`), but only if A's subscription is alive. After a restart (Pitfall 5) it isn't.
- **Shutdown during pause:** uvicorn restarts while paused; without the shutdown sentinel the handler hangs and blocks graceful shutdown.

**Why it happens:**
Human input is unbounded by nature; the system must impose bounds the LLM and the human both understand, and the pause must survive the multi-worker + restart reality.

**How to avoid:**
- **The substrate already solves the cross-worker + shutdown + cancel cases — REUSE IT VERBATIM, don't reinvent.** `ask_user_service.py` has: timeout via `asyncio.wait_for` (`tool_dispatcher.py:1413`), cross-worker cancel via `publish_cancel_sentinel` (`ask_user_service.py:142`), shutdown broadcast via `broadcast_shutdown_sentinel_to_all` (`ask_user_service.py:167`), SUBSCRIBE-before-advertise ordering (race mitigation), durable `messages` row first (reload survival), and the `timeout=1.0` never-0 spin-loop fix. The `llm_human_input` phase type wraps this, it does not re-implement it.
- **Server clamps timeout** to `settings.ask_user_max_timeout_seconds` (default 1800s = 30min, `tool_dispatcher.py:1319`). A `llm_human_input` phase must inherit a (possibly longer, but bounded) cap — never unbounded.
- **`llm_human_input` timeout drives the phase's `on_failure`.** Map the timeout `ToolResult` to a phase transition: `on_failure: 'fail_run'` ends the workflow; `skip_to_phase` routes onward. The phase wraps the tool result and consults the gate, rather than feeding the raw timeout string to a free LLM loop.
- **Resume re-establishes the pause** (Pitfall 5): on restart, runs in `awaiting_user` re-subscribe and re-emit the prompt.
- **The global concurrency slot must be released during a long pause** — a 30-minute human wait should NOT hold a `tasks:global:active` slot (that's for active compute, not waiting). Audit: `ask_user` runs at the top level (not via `task`), so it doesn't hold a `task` slot — but confirm an `llm_human_input` phase inside a batch doesn't pin a batch slot while waiting.

**Warning signs:**
Runs in `awaiting_user` older than the max timeout. Open Redis SUBSCRIBEs with no live handler (`ask_user:channels:*` entries for dead runs — the 3600s safety TTL should clear these). Shutdown that hangs waiting on a paused handler. A timed-out human-input phase that loops instead of failing.

**Phase to address:** P-ENGINE (`llm_human_input` wraps `ask_user_service` + maps timeout to gate `on_failure`), P-VERIFY (mid-pause restart + cross-worker answer test). The pub/sub substrate is inherited from v2.7 Phase 085 — no rebuild.

---

### Pitfall 10: Tool-count budget degradation on Google past ~20-26 tools

**What goes wrong:**
The toolbox is already 24 tools (`get_tools`, `openai_service.py:768-784` — 22 base + web_search + execute_code). Adding plugin tools (deferred to v2.9 but the budget guard is v2.8 / SEED-035) pushes past the point where some providers degrade. Google/Gemini in particular shows tool-selection accuracy and latency degradation as the function-declaration count climbs past ~20-30; the model picks wrong tools, hallucinates tool names (→ Pitfall 2 refusals), or the request balloons. Other providers have softer ceilings but all degrade eventually.

**Why it happens:**
Every tool's full JSON schema is sent on every call. More tools = more tokens in the tool menu + harder selection problem. Developers add tools without a budget because each one seems cheap.

**How to avoid:**
- **SEED-035 tool-count budget guard at `get_tools()` (`openai_service.py:768`) is the designed mitigation — implement it.** Cap the tool count exposed per call; when over budget, prune to the most relevant subset. The per-phase whitelist (Pitfall 1/2) is *itself* the strongest budget control — a phase exposing 4 tools instead of 24 sidesteps this entirely. **This is a major harness win:** Harness Mode phases inherently shrink the tool menu, improving Google accuracy.
- **Order/prioritize tools** so the budget keeps the most-used ones (per the `priority` concept the PRD uses for plugin extension ordering).
- **Make the budget provider-aware.** `MODEL_CAPABILITIES` already carries per-model fields (`uses_max_completion_tokens`, `supports_parallel_tools` — added Phase 075.4); add a `max_tools` soft ceiling per provider and prune harder for Google. Provider-specific handling at the service boundary (CLAUDE.md), never a shared-path hack.
- **Measure, don't guess the exact threshold.** Verify Gemini's current behavior via the eval harness (Pitfall 11) — the "~20-26" figure is directional; the eval harness pins the real number per current model versions.

**Warning signs:**
Google runs picking obviously-wrong tools or emitting non-existent tool names (refusal storms). Latency climbing with toolbox size. Eval-harness tool-selection accuracy dropping on Google as tools are added. Token usage dominated by the tool menu.

**Phase to address:** P-EVAL (SEED-035 budget guard at `get_tools()` + per-provider `max_tools`). The per-phase whitelist (P-ENFORCE) is the structural mitigation. Threshold pinned by the eval harness.

---

### Pitfall 11: Per-provider tool-use gaps the v2.7 SEED-034 text-only directive did NOT close

**What goes wrong:**
v2.7 folded SEED-034 as a *text-only universal tool-use directive* (a system-prompt instruction, eval-gated across 6 providers). A text directive cannot close behavioral gaps that live in the wire protocol / SDK: Gemini `thought_signature` round-trip (D-075.5/BUG-260523-02), Anthropic `end_turn`-instead-of-`tool_calls` (`threads.py:2562`), DeepSeek `reasoning_content` mandatory round-trip (`threads.py:2614-2620`), Moonshot/Kimi empty-content-after-tool-call (`threads.py:2570-2580`), OpenRouter stringified-JSON args + duplicate outputs. The harness *amplifies* these: a deterministic workflow makes MANY more tool calls in a locked sequence, so a per-provider tool-use gap that's a 1% annoyance in free chat becomes a workflow-killing systematic failure (every run of workflow X fails on provider Y at phase 3).

**Why it happens:**
The "one UX, four adapters" principle (`feedback_provider_uniform_ux`) means the UI is provider-agnostic, but the harness's correctness depends on every provider completing a tool-call/tool-result round-trip identically. A text directive normalizes *intent*, not *protocol*. The 075.x cascade proved these gaps are protocol-level.

**How to avoid:**
- **The cross-provider eval harness (SEED-034, `scripts/eval_cross_provider.py`) is THE mitigation — make it a hard regression gate, not a one-off script.** It must run a representative multi-phase workflow on all 6 native providers (OpenAI, Anthropic, Google, DeepSeek, Kimi/Moonshot, MiniMax — OpenRouter/Ollama best-effort per `feedback_openrouter_is_experimental`) and assert each completes the locked phase sequence with correct tool round-trips. Wire it into CI as the regression gate the milestone's reliability rider promises.
- **The harness must NOT regress the existing per-provider round-trip fixes.** The extracted agent loop (P-EXTRACT) must carry forward verbatim: `thought_signature` top-level field (`threads.py:2604`), `reasoning_content` conditional spread (`threads.py:2620`), `end_turn` tool-execution-regardless (`threads.py:2562`), empty-retry guard (`threads.py:2574`). These are load-bearing — a "clean rewrite" that drops them re-opens the 075.x cascade.
- **4-axis UAT per CLAUDE.md SC#10** (cross-provider × multi-tool × parallel-thread × long-message) applied to harness runs: a workflow that uses 2+ tools per phase, on each provider, with a parallel thread streaming, on a long thread.
- **Provider-specific handling stays at the service boundary** (`feedback_multi_provider_behavior_variance`) — never a shared-path edit (Pitfall 1).

**Warning signs:**
A workflow that succeeds on OpenAI but deterministically fails at the same phase on Google/DeepSeek/Anthropic. Provider 400s on multi-tool phases. The eval harness passing on a stale model list but real models drifting (`feedback_model_names_representative` — curate the provider model list). Eval harness treated as optional/skipped in CI.

**Phase to address:** P-EVAL (eval harness as CI regression gate + provider round-trip carry-forward audit), P-EXTRACT (carry forward all per-provider fixes during extraction), P-VERIFY (4-axis harness UAT).

---

### Pitfall 12: The `threads.py` god-function extraction (G-5) done wrong re-opens every prior fix

**What goes wrong:**
`backend/app/api/threads.py` is 3,186 LOC and G-5 FIRING (CLAUDE.md hot-file ledger: "9+ phases, extraction due"). The harness needs the agent loop in a clean module. But `agent_runner` (`threads.py:1423`) is dense with battle-won fixes: terminal-status race (`_shielded_finalize`), per-provider streaming branches, iteration-cap silent-drop guard (`threads.py:2506-2520`), context-truncation warnings (`threads.py:2828+`), thought_signature/reasoning_content round-trips, empty-retry. A careless extraction that "cleans up" or reorders these re-introduces bugs that took 8 phases (075.x) to close.

**Why it happens:**
Extraction is framed as a refactor ("no behavior change"), but the function's behavior IS a pile of subtle ordering invariants (e.g. `_emit('done')` removal + `_shielded_finalize` so `runs.status` UPDATE precedes the terminal sentinel — Phase 075.4). A mechanical move that preserves logic but reorders emits can break the wire contract.

**How to avoid:**
- **Extraction is behavior-preserving and lands FIRST, before any harness feature** (CLAUDE.md G-1/G-5; PRD §12 sequences schema→engine but the agent-loop extraction is the true prerequisite). Move `agent_runner` + `_emit`/`_emit_terminal` + the provider branches into `harness/agent_loop.py` (or similar) with ZERO logic changes — a pure move, asserted by the existing E2E backstop (Playwright 6 scenarios from Phase 075.4) + the per-provider eval harness BEFORE and AFTER.
- **Snapshot the wire contract first.** Record the exact SSE event sequence for a representative multi-tool run per provider; assert byte-identical sequence post-extraction. The 075.4 E2E scenarios already map 1:1 to regression classes — run them as the extraction gate.
- **Do the extraction as its own phase with its own verification**, not bundled into a feature phase (G-5: "insert a dedicated refactor phase BEFORE the next feature phase").
- **Preserve the documented invariants by name** (they're commented in-code): terminal-status race, thought_signature, reasoning_content, end_turn handling, empty-retry, iteration-cap drop guard, context-truncation. A checklist in the extraction phase's VERIFICATION.

**Warning signs:**
Any "while I'm in here" cleanup during extraction. Reordered `_emit` calls. A terminal sentinel emitted before the status UPDATE. Eval harness or E2E backstop red after extraction. Extraction bundled with a feature.

**Phase to address:** P-EXTRACT (dedicated, behavior-preserving, eval+E2E gated). This is the literal first phase of v2.8.

---

### Pitfall 13: Iteration-cap "Continue" (SEED-029) silently dropping tool calls vs. resuming

**What goes wrong:**
Today, on the last iteration `force_no_tools=True` (`threads.py:1868`) and if the model STILL emits tool calls, they're silently dropped with a `system_warning kind=iteration_cap_dropped_tool_calls` (`threads.py:2506-2520`). SEED-029's "Continue" button should let the user resume PAST the cap. In Harness Mode, each phase has its own `max_steps` — if "Continue" naively bumps a global cap, it can let a phase run unbounded (Pitfall 3), or resume into the WRONG phase, or resume a phase whose whitelist has since changed.

**Why it happens:**
The iteration cap is currently per-RUN; Harness Mode makes it per-PHASE. "Continue" must know *which* phase's cap was hit and resume that phase's loop, re-establishing that phase's whitelist — not just increment a counter.

**How to avoid:**
- **"Continue" resumes the SAME phase with a bounded additional step budget**, re-reading `workflow_phases.available_tools` (Postgres source of truth) — never a blind global bump.
- **In Deep Mode, "Continue" is simpler** (resume the single run's loop with more iterations) but must still re-establish `messages` state from persisted history (stateless completions — CLAUDE.md).
- **Preserve the existing drop-guard + warning** (`threads.py:2506-2520`) as the pre-Continue state; "Continue" consumes the dropped tool calls rather than re-dropping them.
- **The per-phase `max_steps` cap is the natural home** (PROJECT.md: "Harness Mode's per-phase `max_steps` is its natural home").

**Warning signs:**
"Continue" that resumes the wrong phase. A phase running past `max_steps` after Continue. Dropped tool calls lost permanently after Continue instead of executed.

**Phase to address:** P-ENGINE (per-phase Continue semantics) + P-MODE (the Continue affordance + Deep-Mode variant).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Enforce whitelist by schema-filtering `get_tools()` only (no dispatch-time check) | One-line change; model "never sees" the tool | Model hallucinates tool names anyway → unenforced escape; the core state-machine guarantee is a lie | **Never** — dispatch-time refusal is the guarantee; schema-filter is an optimization on top |
| Per-run in-memory whitelist cache without a refresh-on-transition hook | Avoids a Postgres read per tool call (PRD §6 row 1) | Stale whitelist after a phase transition on another worker → wrong tools allowed | Acceptable WITH explicit cache-clear on `workflow_transition` event + Postgres as source-of-truth fallback |
| `programmatic` phases assumed idempotent without enforcing it | Faster to ship phase authors' functions | Resume after mid-phase crash double-applies side effects (Pitfall 5) | Acceptable only for genuinely pure functions; MUST document the contract + guard side-effecting ones |
| Reuse per-run `Semaphore(3)` for `llm_batch_agents` | No new concurrency primitive | Batch of >3 silently throttled or refused (Pitfall 6) | Never for batch; introduce per-phase `max_parallel` |
| "Clean up" `agent_runner` during the G-5 extraction | Tidier code | Re-opens 075.x cross-provider cascade (Pitfall 12) | Never — extraction is behavior-preserving; cleanup is a separate, later phase |
| Skip resume re-subscribe for `ask_user`, rely on user re-asking | Less resume code | Paused human-input runs hang forever after restart (Pitfall 5/9) | Never — the durable `messages` row exists precisely to enable resume |
| Global `isHarnessLocked` boolean for the mode lock | Simple UI flag | Cross-thread lock leak (the BUG-260523-01 signature, Pitfall 8) | Never — must be per-thread keyed `Map`/`Set` |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Redis Streams (run-backed SSE) | Inventing a new namespace/stream for workflow events | All new SSE types (`workflow_phase_*`, `workflow_transition`, etc.) ride the EXISTING `run:{run_id}` XADD via `_emit` (`threads.py:109`) — PRD §5 confirms "no new substrate" |
| Redis pub/sub (`ask_user`) | Re-implementing pause/resume in the `llm_human_input` phase | Wrap `ask_user_service.py` verbatim — SUBSCRIBE-first ordering, cancel/shutdown sentinels, durable row, `timeout=1.0` are load-bearing and already correct |
| asyncpg pool (hot paths) | Reading the phase whitelist via sync supabase-py inside the async loop | Whitelist reads go through the asyncpg pool (`ToolContext.pool`, D-v2.5-01); supabase-py sync calls stay wrapped in `run_in_threadpool` |
| Supabase RLS | New harness tables without RLS, or RLS via thread that breaks on global/shared scope | Every new table (`workflow_definitions/runs/phases`, `harness_audit`) gets RLS; runs/phases scope via `thread → user_id`; definitions support owner-private + org-shared (PRD §3) |
| 9 LLM providers | Testing the harness on OpenAI only | Eval harness on all 6 native providers (Pitfall 11); 4-axis UAT (SC#10) |
| Multi-worker uvicorn (WORKER_COUNT=2) | In-memory phase/whitelist/semaphore state assumed to survive a different resuming worker | Postgres is source of truth (D-PRD-08); rebuild ephemeral state on resume (Pitfall 5) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Postgres read per tool call for the phase whitelist | Tool latency climbs per call; DB load scales with tool-call volume | In-memory cache per `run_id`, cleared on `workflow_transition` (PRD §6 row 1) | Noticeable at 50+ parallel runs × many tools/phase |
| `llm_batch_agents` fan-out without `max_parallel` | App-wide threadpool starvation; cross-tab GET latency spikes (Pitfall 6) | Per-phase `max_parallel` (default 5) + respect global cap 20 + verify AnyIO budget | N agents × M concurrent workflows > shared threadpool budget (~200, verify) |
| `workflow_phases` / `harness_audit` rows unbounded | Table bloat over months | Index on `(workflow_run_id, phase_index)`; TTL/retention deferred to v3.4 but DOCUMENT the growth (PRD §7 row 6) | ~500k rows annually at modeled scale — trivial near-term, plan retention |
| Validation-gate infinite retry | Token spend climbs with no progress (Pitfall 4) | `max_retries` cap + structural-failure short-circuit | Any deterministically-failing gate with `on_failure: retry` |
| Browser EventSource limit (6/origin) | Panel + chat + multi-thread tabs exhaust connections | Panel shares the SAME `run:{run_id}` EventSource as chat via `<StreamsProvider>` demux (PANEL-06, single subscription) | >6 concurrent run subscriptions per browser origin |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `programmatic` / validator phases run arbitrary registered Python with full app privileges | A malicious/buggy registered function reads/writes any user's data | `PROGRAMMATIC_PHASE_REGISTRY` / `VALIDATOR_REGISTRY` are CODE-defined (not user-authored in v2.8); plugin-authored phase types are deferred to v2.9 — keep it that way. RLS still scopes data access through the user-scoped supabase client / asyncpg queries |
| Workflow definition jsonb authored by a user injecting a phase that whitelists a privilege-escalating tool | A workflow that grants itself `execute_code` / `save_skill` outside intended scope | Whitelist is enforced server-side from `workflow_phases.available_tools`; the available universe is still gated by `get_tools(user_settings)` (web/sandbox toggles honored) — a phase can't whitelist a tool the user's settings disabled |
| `harness_audit` / workflow tables missing RLS | Cross-user visibility of another user's workflow runs/phase outputs | RLS on every new table (CLAUDE.md); audit table INSERT-only like `audit_log` |
| Resumed run re-executes a `programmatic` phase that calls an external paid API | Double-charge / duplicate external side effect | Idempotency contract + guard (Pitfall 5) |
| `ask_user` prompt/response stored unsanitized, rendered in panel | Stored XSS via model- or user-supplied prompt text in the panel | Panel renders prompt/response as text, not HTML (existing React escaping); same discipline as chat messages |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Phase timeline freezes with no signal when a phase stalls (Pitfall 3) | User can't tell if the workflow is working or dead | Per-phase wall-clock with a visible "running… Ns" + timeout → explicit `failed` state in the panel |
| Mode toggle disabled across all threads during any stream (Pitfall 8 / BUG-260523-01) | User can't switch modes on Thread B because Thread A streams | Per-thread mode-lock state; never a global flag |
| "Continue" resumes the wrong phase or unbounded (Pitfall 13) | Confusing/runaway runs | Resume the same phase with a bounded budget; re-read its whitelist |
| Refused tool call shows as an error/crash rather than a graceful "blocked in this phase" (Pitfall 2) | User thinks the agent broke | Panel renders `tool_not_available_in_phase` as an expected, styled "phase guard" event |
| Workflow lock with no escape (no Cancel) | User trapped in Harness Mode | "Cancel workflow" affordance that clears `active_workflow_run_id` + restores Deep-Mode metadata (PRD Theme F) |
| Harness Mode hidden as the default surprise | Existing users see a new locked UX unexpectedly | Deep Mode stays the default (PRD Theme F); Harness is opt-in via toggle/skill metadata |

## "Looks Done But Isn't" Checklist

- [ ] **Tool-whitelist enforcement:** Often missing the dispatch-time refusal (only schema-filtered) — verify a hallucinated/non-whitelisted tool returns a clean `tool_result`, not a crash or provider 400, on ALL 6 providers.
- [ ] **Resumability:** Often missing the `ask_user` re-subscribe and the `active`-phase re-run — verify kill-uvicorn-and-resume at mid-`programmatic`, mid-`llm_agent`, AND mid-`ask_user`.
- [ ] **`llm_batch_agents`:** Often missing `max_parallel` — verify N=10 fans out at ≤5 concurrent and doesn't starve the threadpool or refuse 7 agents.
- [ ] **Immutable-on-publish:** Often missing the running-run snapshot — verify publishing v1.1 mid-run on v1.0 doesn't drift the in-flight run's phases.
- [ ] **Dual-mode switch:** Often missing per-thread lock isolation — verify Thread A streaming doesn't lock Thread B's mode toggle (the BUG-260523-01 regression).
- [ ] **Validation gates:** Often missing the retry cap — verify a deterministically-failing gate stops after `max_retries`, doesn't loop.
- [ ] **G-5 extraction:** Often missing a per-provider round-trip invariant — verify eval harness + E2E backstop green BEFORE and AFTER extraction, byte-identical SSE sequence.
- [ ] **Phase timeouts:** Often missing the wall-clock cap — verify a hanging `programmatic` or never-terminating `llm_agent` phase fails cleanly at its timeout.
- [ ] **Token accounting:** Often missing per-phase `runs.input_tokens/output_tokens` writes — verify each LLM phase increments the counters (PRD §6 row 8, needed for future spend caps).
- [ ] **RLS:** Often missing on the new tables — verify cross-user reads of `workflow_runs`/`workflow_phases`/`harness_audit` are denied.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cross-provider regression from shared-path edit (1) | HIGH | Revert the shared-path edit; re-apply enforcement as a pure dispatch pre-check; re-run eval harness on all 6 providers (this is the 075.x recovery playbook) |
| Whitelist bypass crash (2) | LOW | Wrap refusal in the existing `ToolResult` shape; the call-site `except` already exists — just route the refusal through it |
| Phase deadlock (3) | MEDIUM | Add `asyncio.wait_for` phase wrapper + `on_failure` routing; backfill publish-time reachability lint |
| Infinite gate retry (4) | LOW | Add `max_retries` + structural-failure hash short-circuit; cancel the stuck run via terminal status |
| Resumability gap (5) | HIGH | Implement 2-phase write + active-phase re-run + ask_user re-subscribe; reconcile dangling `awaiting_user`/`active` runs via a startup sweep |
| Batch threadpool starvation (6) | MEDIUM | Add per-phase `max_parallel`; verify against live AnyIO budget; serialize through global cap |
| Immutable publish race (7) | MEDIUM | Add UNIQUE + trigger + FK RESTRICT; migrate runs to reference immutable definition ID/snapshot |
| Mode-lock cross-thread leak (8) | MEDIUM | Lift the lock flag to per-thread `Map`/`Set` (mirror BUG-260523-01 fix); enforce lock server-side |
| ask_user zombie/hang (9) | LOW-MEDIUM | Reuse `ask_user_service` sentinels; add startup sweep for stale `awaiting_user`; clamp timeout |
| Tool-count degradation (10) | LOW | Enable SEED-035 budget at `get_tools()`; lean on per-phase whitelist to shrink the menu |
| Provider tool-use gap (11) | HIGH | Eval harness as CI gate; carry forward the protocol-level fixes; provider-scoped patches only |
| G-5 extraction regression (12) | HIGH | Revert to pre-extraction; redo as pure behavior-preserving move gated by eval+E2E |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Cross-provider shared-path regression | P-EXTRACT + P-ENFORCE + P-EVAL | Eval harness green on 6 providers before/after; whitelist is a pure dispatch pre-check (diff touches no provider branch) |
| 2. Whitelist enforcement bypass / crash | P-ENFORCE | Integration test: non-whitelisted tool → clean `tool_result` with matching `tool_call_id`, no provider 400, per provider |
| 3. State-machine deadlock | P-ENGINE (+ P-EXTRACT for force-no-tools) | Hanging `programmatic` + never-terminating `llm_agent` both fail at phase timeout; publish-time reachability lint rejects unsatisfiable phases |
| 4. Validation-gate infinite retry | P-ENGINE | Deterministically-failing gate stops at `max_retries`; identical-output short-circuit fires |
| 5. Resumability edge cases | P-ENGINE + P-VERIFY | Kill-and-resume smoke test at each phase type (incl. mid-ask_user); no skipped/double-applied phases |
| 6. Batch fan-out concurrency | P-BATCH (SEED-036a) | N=10 runs at ≤`max_parallel`; no threadpool starvation; global cap respected |
| 7. Immutable-publish race | P-SCHEMA + P-ENGINE | Publish mid-run doesn't drift in-flight run; UPDATE/DELETE of published version refused |
| 8. Dual-mode switch corruption | P-MODE + P-VERIFY | Thread A stream doesn't lock Thread B toggle; terminal workflow clears `active_workflow_run_id`; lock enforced server-side |
| 9. ask_user timeout/expiry cross-worker | P-ENGINE + P-VERIFY | Cross-worker answer + mid-pause restart + shutdown-during-pause all resolve cleanly |
| 10. Tool-count budget degradation | P-EVAL (SEED-035) | Eval tool-selection accuracy stable as toolbox grows; per-provider `max_tools` prunes |
| 11. Per-provider tool-use gaps | P-EVAL + P-EXTRACT + P-VERIFY | Multi-phase workflow completes on all 6 providers; protocol fixes carried forward; 4-axis UAT |
| 12. G-5 extraction regression | P-EXTRACT | Byte-identical SSE sequence + eval + E2E green before/after; extraction is its own phase |
| 13. Continue-button cap semantics | P-ENGINE + P-MODE | Continue resumes correct phase with bounded budget; dropped calls executed not re-dropped |

## Sources

- **Actual substrate (HIGH confidence — read directly):**
  - `backend/app/services/tool_dispatcher.py` — `dispatch_tool` graceful-unknown-tool handling (L1495-1500); `ToolContext.available_tools` (L88); `_handle_task` toolset-subset refusal precedent (L1090-1110) + per-run/global concurrency gate sequence (L1128-1196); `_handle_ask_user` timeout/cancel/shutdown machinery (L1273-1458); weak-model arg normalization (L844-875, L1219-1242).
  - `backend/app/services/task_service.py` — per-run `Semaphore` + global Redis-Lua cap (`_ACQUIRE_LUA`, L58-90); sub-agent loop + `run_in_threadpool` sync-stream drain (L121-193); fresh `previous_files_in_run` isolation (L291).
  - `backend/app/services/ask_user_service.py` — SUBSCRIBE-first ordering, cancel/shutdown sentinels, `timeout=1.0` spin-loop fix, durable-row-first resume path.
  - `backend/app/api/threads.py` — `agent_runner` (L1423); per-provider streaming branches (Anthropic ~L1897, Google ~L2025, OpenAI-compat ~L2169) feeding shared `tool_calls_buffer`; `dispatch_tool` call site + `ToolContext` build with `available_tools` (L2632-2677); `force_no_tools` last-iteration guard (L1868); iteration-cap silent-drop guard (L2506-2520); `thought_signature`/`reasoning_content` round-trips (L2604-2620); context-truncation warning (L1828-1859).
  - `backend/app/services/openai_service.py` — `get_tools()` 24-tool toolbox + web/sandbox conditionals (L768-784); per-provider `MODEL_CAPABILITIES` token budgets (L893-908).
- **Planning docs:** `.planning/PRDs/v2.7.md` §3 Theme B (harness design), §6 (compatibility/mitigations), §7 (scalability bounds — `max_parallel_agents` default 5, AnyIO ceiling, whitelist cache), §10 (LangGraph rejection); `.planning/PROJECT.md` (v2.8 scope, SEED-029/034/035/036a, migration head 056+).
- **Prior-art lessons (project memory, HIGH confidence):** `feedback_no_cross_provider_regressions`, `feedback_regressions_during_075_3_uat`, `feedback_provider_uniform_ux`, `feedback_multi_provider_behavior_variance`, `feedback_workflow_guardrails` (G-1..G-6), `project_phase075_4` (BUG-260523-01 per-thread state lift), CLAUDE.md SC#10 (4-axis UAT) + hot-file ledger (threads.py G-5).
- **External prior art (durable-execution patterns, MEDIUM confidence — patterns referenced, NOT adopted per no-LangGraph rule):** state-machine workflow engines (Temporal/Argo-style) for the at-least-once + idempotent-activity + bounded-retry + immutable-definition-version principles; AnyIO/Starlette `run_in_threadpool` default limiter semantics (default 40 tokens; project-lifted — VERIFY live value).

---
*Pitfalls research for: deterministic workflow harness + dual-mode on a multi-provider streaming agent platform*
*Researched: 2026-05-30*
