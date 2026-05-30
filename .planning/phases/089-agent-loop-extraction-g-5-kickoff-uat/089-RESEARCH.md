# Phase 089: Agent-Loop Extraction (G-5) + Kickoff UAT - Research

**Researched:** 2026-05-30
**Domain:** Behavior-preserving Python refactor (extract a nested async closure into a module) + cross-provider SSE equivalence proof + carry-forward verification sweep
**Confidence:** HIGH (the entire scope is in-repo, line-verified against the live `threads.py`; the proof harness reuses shipped Phase 088 infrastructure)

## Summary

Phase 089 lifts the agent iteration loop, the three provider chunk-handlers, the tool-dispatch round, and `_persist_assistant_message` out of the 3,186-LOC `backend/app/api/threads.py` god file into a new `backend/app/services/agent_loop.py::run_agent_loop()`. The single dominant fact the planner must internalize: **the code being extracted is not a top-level function — it is a deeply nested set of closures inside `agent_runner` (itself nested inside the `send_message` route handler).** Everything that moves currently reads ~30 variables from its enclosing scope via Python closure capture. The extraction's whole risk surface IS converting those implicit closure reads into an explicit parameter/context contract WITHOUT changing a single byte of observable behavior. There are no new libraries, no new dependencies, no schema changes — this is pure mechanical surgery whose correctness bar is "the captured per-provider SSE event stream diffs to empty before vs after."

The acceptance bar is **byte-identical SSE per provider** (captured-diff-empty on the `run:{run_id}` Redis stream), NOT "tests pass." Tests passing is necessary but insufficient: the test suite mocks the LLM, so it proves plumbing but not the per-provider round-trip invariants (Anthropic `end_turn`, Google `thought_signature`, DeepSeek `reasoning_content`, Moonshot `<think>`-filter, etc.). The proof harness is two-pronged: (a) a new SSE-capture-and-diff mechanism on the Redis stream, and (b) the existing Phase 088 `scripts/eval_cross_provider.py` + the 075.4 Playwright E2E suite staying GREEN before AND after. Both are operator-run against live provider keys.

Critically, GLM (zhipu) and MiniMax are confirmed **wired native providers** (base URLs, API keys, registry entries all present) — the ROADMAP's "6" undercounts; the bar is **native-7**. And there are **zero** provider-specific branches for GLM/MiniMax in the loop — they route through the shared OpenAI-compat `_on_chunk_openai` path, so the proof simply adds two more rows to the eval matrix rather than carrying new invariants.

**Primary recommendation:** Extract `run_agent_loop()` taking a **frozen `RunContext` dataclass** (built in `send_message` and passed in) for the ~10 stable inputs, plus the three `_emit`/`_emit_terminal`/`_spawn` callables passed as explicit args. Report this exact signature to the operator BEFORE moving any code (D-089-04). Move the loop, the three `_on_chunk_*` handlers, `_persist_assistant_message`, `_persist_system_messages`, and `_strip_nul` VERBATIM into `agent_loop.py`. Keep `_shielded_finalize` and `agent_runner`'s producer/finalizer shell in `threads.py`, calling `run_agent_loop(ctx)`. Capture the `run:{run_id}` XRANGE event sequence per provider before and after; assert empty diff after normalizing run_id/message_id/timestamps.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Extraction boundary & seam**
- **D-089-01:** Clean module. `agent_loop.py::run_agent_loop()` owns the iteration loop, the tool-dispatch block, the three provider chunk-handlers (`_on_chunk_anthropic`, `_on_chunk_google`, `_on_chunk_openai`), AND `_persist_assistant_message` — all moved **VERBATIM** (no logic change).
- **D-089-02:** `threads.py` retains ONLY: the route handler (`send_message`), the producer spawn (`agent_runner` shell + `_producer`/`_drain` plumbing), `_emit`/`_emit_terminal`/`_spawn` helpers, and `_shielded_finalize`.
- **D-089-03:** No "while-I'm-in-here" cleanup. The extraction changes file location only, never behavior. Highest-risk-if-done-wrong phase of v2.8.
- **D-089-04:** State-passing across the new module boundary = Claude's discretion (likely a frozen context dataclass — `AgentLoopContext`/`RunContext` — over a ~15+ arg flat list). **Report the exact seam + `run_agent_loop` signature back to the operator for confirmation BEFORE executing.**

**Cross-provider matrix**
- **D-089-05:** The 089 baseline covers the **full native first-class provider set of 7**: `openai`, `anthropic`, `google`, `deepseek`, `moonshot`, **`zhipu`/GLM, `minimax`**. `_PROVIDER_BASE_URLS` in `config.py` is the single source of truth; GLM + MiniMax are wired, NOT deferred. This correction propagates to every downstream v2.8 phase (091-096 read "native-7").
- **D-089-06:** Per-provider round-trip invariants carried forward verbatim and **named in VERIFICATION** (SC#2) span the matrix: Anthropic `end_turn`-instead-of-`tool_calls`; Google `thought_signature` echo; DeepSeek `reasoning_content` round-trip; Moonshot empty-content-after-tool-call retry guard; plus shared guards `force_no_tools`-on-last-iteration, iteration-cap silent-drop guard (`kind='iteration_cap_dropped_tool_calls'`), and the terminal-status race (`_shielded_finalize`). GLM + MiniMax invariants captured if any exist; absence noted explicitly.
- **D-089-07:** OpenRouter = experimental / best-effort (regression logged, not blocker). Ollama = optional / opportunistic. The **native-7 are the hard pass/fail bar.**

**Byte-identical proof bar (SC#3)**
- **D-089-08:** Both mechanisms. (a) Capture per-provider SSE event-sequence logs from a scripted multi-tool run BEFORE extraction, replay identical run AFTER, assert diff empty; AND (b) the 088 eval-harness + 075.4 Playwright E2E backstop stay GREEN before AND after.
- **D-089-09:** Extend the automated eval gate to GLM + MiniMax NOW in 089. Add `zhipu`/GLM + `minimax` to the eval script's PROVIDERS list + quick current-model-ID curation pass. Additive proof-harness work, NOT agent-loop edits.
- **D-089-10:** "Representative multi-tool run" = Claude's discretion, guided by SC#10's multi-tool axis. Manual 4-axis kickoff UAT (cross-provider × multi-tool × parallel-thread × long-message ≥50 msgs / ≥5 KB) in BOTH General AND Explorer `agent_mode` (SC#4).

**CF-01 carry-forward sweep**
- **D-089-11:** Driver = hybrid. Claude drives browser-observable checks via Chrome MCP on `http://localhost:5173/` (test login `fhdmrd@gmail.com`) — title-gen appearing, download link working — AND authors the eval runbook/script. The operator runs the backend eval script (real provider keys in operator's `backend/.env`). Operator starts uvicorn themselves — never `run_in_background`.
- **D-089-12:** Disposition = re-open + defer; 089 stays pure. If any swept item is STILL broken, re-open with a concrete `re_open_trigger`, route to a named later slot — zero feature fixes inside 089. Routing: title-gen / Google-404 → v2.8 polish slot (093 vicinity or standalone quick); download-link → SEED-037 `/gsd:quick`.
- **D-089-13:** CF-01 title-gen sweep scope = the native-7, not just ROADMAP's "DeepSeek/Moonshot/Google."
- **D-089-14:** SEED-037 download `/gsd:quick` timing = decide after the sweep. Data-driven, not pre-committed.

**Reported-bugs routing**
- **D-089-15:** Six Agentic-RAG bugs sit in this neighborhood; none fold into 089. The two `backend/agent-loop` Anthropic bugs (`anthropic-end-of-cycle-shows-actions-not-summary`, `anthropic-excessive-tool-iterations`) stay **deferred to Phase 093** and **must NOT be touched during the lift** — fixing them is the forbidden cleanup that re-opens the cascade.

### Claude's Discretion
- State-passing mechanism / context object shape (D-089-04 — report seam first).
- Exact "representative multi-tool run" prompt + tool selection (D-089-10).
- Whether the extraction lands as one atomic commit or a reviewable sequence (planner's call) — provided each intermediate state keeps eval + E2E GREEN.

### Deferred Ideas (OUT OF SCOPE)
- ANY feature fix, bug fix, or "while-I'm-in-here" cleanup.
- Harness features (091+). Schema (090). The two deferred Anthropic agent-loop bugs (Phase 093).
- The four other open Agentic-RAG bugs (`non-anthropic-generic-code-task-descriptions` → 093; `chat-tool-cards-scroll-collapse-duplicate`, `step-count-mismatch-timer-vs-panel`, `timer-disappears-long-runs` → 095) — leave open, do not touch.
- SEED-037 download wire-up (standalone `/gsd:quick`; trigger = sweep proves still-broken).
- Per-provider model-ID full curation beyond D-089-09's eval-gate needs → Phase 096 (EVAL-01).
- General/Explorer-selector behavior DURING an active workflow → Phase 092.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **FOUND-03** | Agent loop extracted from `threads.py` (3,186 LOC) into `agent_loop.py` with byte-identical cross-provider behavior — eval + E2E GREEN before AND after, all per-provider round-trip fixes carried verbatim. Ships FIRST; zero harness features. Deep Mode unchanged. | The Extraction Seam Map (exact line ranges), the Closure-Capture Inventory → `run_agent_loop` signature, the Per-Provider Invariant Inventory (named for VERIFICATION), and the byte-identical SSE proof harness design — see targets 1-3, 5, 6 below. |
| **CF-01** | v2.7 carry-forwards verified-closed or re-opened via cross-provider UAT sweep — title-gen (BUG-260527-01), Google secondary-model 404, download-link payload; SEED-037 download → standalone `/gsd:quick`. | CF-01 Carry-Forward Sweep section: per-item evidence location, verification surface, concrete pass/fail check, and disposition routing — see target 7 below. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Agent iteration loop (LLM round-trips, tool dispatch) | API / Backend (`agent_loop.py` — NEW) | — | Pure backend orchestration; no UI, no client logic. Currently lives in `threads.py`; the lift gives it its own module. |
| Provider chunk normalization (`_on_chunk_*`) | API / Backend (`agent_loop.py`) | — | "One UX, N adapters" — provider-native streaming primitives translated to the shared SSE vocabulary at the service boundary. Moves WITHOUT collapsing the shared path. |
| SSE event emission (`_emit`/`_emit_terminal`) | API / Backend (`threads.py` — STAYS) | Redis (`run:{run_id}` stream) | The Redis-stream plumbing is producer-task lifecycle, not loop logic. Passed into `run_agent_loop` as callables. |
| Run lifecycle / terminal finalization (`_shielded_finalize`) | API / Backend (`threads.py` — STAYS) | Postgres (`runs` table) + Redis | Terminal-status race fix + shielded persist is producer-task concern, not loop concern. |
| Tool execution dispatch (`dispatch_tool`) | API / Backend (`tool_dispatcher.py` — UNCHANGED) | — | Already extracted in Phase 083. The loop CALLS it; 089 must NOT disturb it (091's whitelist guard lands here later). |
| Title generation (`generate_thread_title`) | API / Backend (`threads.py` — STAYS) | — | Fires in `send_message` BEFORE producer spawn, outside the loop. CF-01 item (a) verification surface. |
| Cross-provider SSE proof | Test/Eval tier (`scripts/eval_cross_provider.py` + NEW capture harness) | Redis stream + Postgres | Operator-run, drives the real HTTP route, reads durable truth. The acceptance gate. |

## Standard Stack

This phase introduces **zero new libraries**. The "stack" is the existing in-repo substrate the extraction must preserve.

### Core (already present — extraction preserves these contracts)
| Component | Location | Purpose | Why it Stays Constant |
|-----------|----------|---------|----------------------|
| FastAPI route + `MessageCreate` | `threads.py:1224` (`send_message`) | Entry point; per-request `provider`/`model` override | The eval harness switches providers via this override (no global mutation). STAYS. |
| Redis Streams (`run:{run_id}`) | `_emit`/`_emit_terminal` `threads.py:109/126` | Per-run SSE event buffer; XADD producer / XREAD consumer | The byte-identical capture point is `XRANGE run:{run_id} - +`. STAYS in threads.py, passed as callables. |
| asyncpg pool (`insert_run`/`finalize_run`/`insert_assistant_message`) | `app.db.runs` | Run lifecycle + message persistence | `_persist_assistant_message` (MOVES) calls `insert_assistant_message`; `_shielded_finalize` (STAYS) calls `finalize_run`. |
| Provider stream adapters | `stream_anthropic` (`anthropic_service`), `stream_google` (`google_service`), `create_adaptive_streaming_chat` (`openai_service`) | Native SDK → normalized-event generators | The `_on_chunk_*` handlers (MOVE) consume these. `agent_loop.py` must import the same three. |
| `dispatch_tool` + `ToolContext` + `ToolResult` | `tool_dispatcher.py:1495 / :59 / :92` | Phase 083 registry-pattern tool dispatch | The loop constructs `ToolContext` per-iteration (`threads.py:2632`) and calls `dispatch_tool`. MOVES with the loop; the dispatcher module is untouched. |
| `_drain_stream_with_close_on_cancel` | `threads.py:216` | langsmith-safe stream drain under per-call timeout | Called by all three `_on_chunk_*` drains. **Decision needed:** keep in threads.py + import, or move to agent_loop.py — see Open Questions. |

### Supporting (config + helpers the loop reads)
| Component | Location | Used By Loop | Move/Stay |
|-----------|----------|--------------|-----------|
| `_PROVIDER_BASE_URLS` | `config.py:10` | Provider list source of truth | STAYS (config). The native-7 authority. |
| `get_per_call_timeout_async`, `settings`, `get_model_capability_async` | `config.py` | Per-call budget, provider gating | STAYS (config); imported into agent_loop.py. |
| `trim_messages_to_fit`, `estimate_messages_tokens`, `resolve_context_budget` | `context_window` | Pre-loop + per-iteration trim | STAYS; imported into agent_loop.py. |
| `EXPLORER_SYSTEM_PROMPT`, `get_explorer_tools`, `SYSTEM_PROMPT`, `get_tools` | `openai_service` | Mode-axis prompt/tool selection | STAYS; imported into agent_loop.py. |
| `_reconstruct_history` | `threads.py:1135` | History rebuild before the loop | **Decision needed** — see Open Questions (called at `threads.py:1611`, inside what will be the moved region OR the boundary). |

### Alternatives Considered (state-passing mechanism — D-089-04)
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Frozen `RunContext` dataclass | ~15-20 flat positional/keyword args | Flat args: zero indirection but a 20-line call signature, brittle to reorder, easy to mis-wire one arg silently (diff-risk HIGH). Dataclass: one construction site, named fields, trivially greppable, mypy-checkable — diff-risk LOW. **Recommend dataclass.** |
| Frozen dataclass | Mutable dataclass / dict | The loop MUTATES accumulators (`full_content`, `input_tokens_total`, etc.) — those are NOT context, they're loop-local state that must stay loop-local (inside `run_agent_loop`), not in the context object. Pass immutable inputs via frozen ctx; keep mutable accumulators as locals. |

**Installation:** None. `git mv`-equivalent surgery only.

**Version verification:** N/A — no package installs. The only "version" concern is the per-provider eval model-ID curation (D-089-09) — see CF-01 / Eval Curation below for the verified current IDs from `MODEL_CAPABILITIES`.

## Architecture Patterns

### System Architecture Diagram (data flow — before AND after must be byte-identical)

```
                         POST /threads/{id}/messages  (send_message — STAYS in threads.py)
                                          │
                    ┌─────────────────────┼──────────────────────────────┐
                    │ 1. INSERT user msg  │ 2. resolve provider/model     │
                    │ 3. INSERT runs row  │ 4. ZADD runs:active           │
                    │ 5. generate_thread_title (CF-01 item a — STAYS)     │
                    └─────────────────────┬──────────────────────────────┘
                                          │  spawn agent_runner task
                                          ▼
              ┌────────────── agent_runner (producer shell — STAYS) ──────────────┐
              │  build RunContext  ──►  run_agent_loop(ctx)  ◄── THE SEAM (NEW)    │
              │                              │                                     │
              │                              ▼  [MOVES to agent_loop.py]           │
              │   ┌──────────── for iteration in range(max_iterations) ─────────┐  │
              │   │  trim ─► force_no_tools? ─► provider branch:                │  │
              │   │     ┌─ anthropic ─► stream_anthropic ─► _on_chunk_anthropic │  │
              │   │     ├─ google    ─► stream_google    ─► _on_chunk_google    │  │
              │   │     └─ else       ─► create_adaptive  ─► _on_chunk_openai    │  │
              │   │              (each drains via _drain_stream_with_close...)   │  │
              │   │                          │ emits delta/tool_preparing/...    │  │
              │   │                          ▼  via ctx.emit ──────────────────────────► XADD run:{run_id}
              │   │  iteration-cap guard ─► tool-dispatch round:                 │  │   (Redis Stream —
              │   │     ToolContext ─► dispatch_tool() ─► append tool result     │  │    the CAPTURE point)
              │   │     [dispatcher UNCHANGED — 083 seam]                        │  │
              │   └──────────────────────────────────────────────────────────────┘  │
              │   final_output_files emit ─► _persist_assistant_message [MOVES]     │
              │   sources/citations/confidence/suggestions/stream_end emits         │
              │                              │ (loop returns to agent_runner)       │
              │   except → set _terminal_status   finally → _shielded_finalize [STAYS]│
              │     ▼ finalize_run UPDATE ─► _emit_terminal sentinel ─► EXPIRE ─► ZREM│
              └────────────────────────────────────────────────────────────────────┘
                                          │
                  GET /runs/{id}/stream (runs.py) ── XREAD run:{run_id} ──► SSE to browser
```

### Recommended Module Structure
```
backend/app/
├── api/
│   └── threads.py          # STAYS: send_message route, agent_runner producer shell,
│                           #        _emit/_emit_terminal/_spawn, _shielded_finalize,
│                           #        generate_thread_title, get_snapshot/get_messages
│                           #        (with .neq("role","system") filter — UNTOUCHED),
│                           #        _reconstruct_history (see Open Question 1)
└── services/
    └── agent_loop.py       # NEW: run_agent_loop(ctx) + the three _on_chunk_* handlers
                            #      + _persist_assistant_message + _persist_system_messages
                            #      + _strip_nul + RunContext dataclass
```

### Pattern 1: Closure-to-Context conversion (the entire extraction technique)
**What:** Every variable the moved code currently reads from `agent_runner`/`send_message` scope becomes either (a) a field on the frozen `RunContext` (stable inputs) or (b) an explicit callable parameter (`emit`, `emit_terminal`, `spawn`), or (c) a loop-local re-declared inside `run_agent_loop` (mutable accumulators).
**When to use:** Mandatory — this is how the byte-identical behavior is preserved.
**Example (the proposed signature — REPORT TO OPERATOR FIRST per D-089-04):**
```python
# backend/app/services/agent_loop.py  (PROPOSED — confirm before moving code)
from dataclasses import dataclass

@dataclass(frozen=True)
class RunContext:
    run_id: "UUID"
    thread_id: str
    current_user: dict
    user_settings: object              # resolved + provider-overridden in send_message
    body: "MessageCreate"              # carries .content, .provider, .model, .agent_mode
    redis: "aioredis.Redis"
    supabase: "Client"
    resolved_model: str                # _resolved_model from send_message
    resolved_provider: str             # _resolved_provider from send_message

async def run_agent_loop(
    ctx: RunContext,
    *,
    emit,                # threads.py:_emit  (redis, run_id, type, **fields)
    emit_terminal,       # threads.py:_emit_terminal
    spawn,               # threads.py:_spawn
) -> AgentLoopResult:    # carries terminal accumulators _shielded_finalize needs
    ...
    # loop-local accumulators (DECLARED HERE, not captured):
    full_content = ""
    full_reasoning_content = ""
    input_tokens_total: int | None = None
    output_tokens_total: int | None = None
    persisted_tool_calls: list[dict] = []
    _persisted_system_warnings: list[dict] = []
    ...
```
> **Why a result object too:** `_shielded_finalize` (STAYS in threads.py) currently reads `full_content`, `input_tokens_total`, `output_tokens_total`, `_persisted_system_warnings`, and calls `_persist_assistant_message()`. After extraction those live inside `run_agent_loop`. The loop must return an `AgentLoopResult` carrying the persist callable's cached id + the token totals + the system-warning list so the finalizer can complete. This is the second-most-important seam decision after the input context.

### Pattern 2: "One UX, N adapters" preserved (no shared-path collapse)
**What:** The three `_on_chunk_*` handlers move TOGETHER into `agent_loop.py` but stay as three separate functions branched on `active_provider_name`. Do NOT "simplify" them into one.
**When to use:** Always — collapsing them is the exact forbidden cleanup (D-089-03) that re-opens the 075.x cascade.
**Anti-pattern:** "While I'm moving these, I'll dedupe the usage-accounting blocks across Anthropic/Google." NO. Verbatim move only.

### Anti-Patterns to Avoid
- **Collapsing the three chunk handlers** — re-opens 075.x cross-provider cascade. Move all three verbatim.
- **Fixing the two deferred Anthropic bugs while in the loop** (D-089-15) — `end_turn`-shows-actions + excessive-iterations belong to Phase 093. The loop must preserve them AS BUGS.
- **Touching `dispatch_tool` / `ToolContext`** — 091's whitelist guard depends on the unchanged 083 seam.
- **Touching the `.neq("role","system")` filter** in `get_snapshot`/`get_messages` (Phase 086 landmine) — those route handlers STAY and must not be edited.
- **Module-level mutable singletons** — WORKER_COUNT=2 means any module-level mutable state in `agent_loop.py` is a cross-worker hazard. `RunContext` is per-call; keep it that way (no module-global accumulators).
- **Re-resolving provider/model inside the loop differently** — the resolution logic in `send_message` (L1293-1331) STAYS; pass the already-resolved values via `RunContext`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE event capture for the diff proof | A custom in-loop event recorder / new logging sink | `XRANGE run:{run_id} - +` against Redis after the run reaches terminal | The Redis stream IS the wire payload, captured server-side, already ordered, already the exact bytes the consumer reads. Zero new instrumentation = zero behavior change. |
| Cross-provider behavioral backstop | A new test rig | `scripts/eval_cross_provider.py` (Phase 088), extended +2 providers | Already drives the real route, reads durable truth, has the localhost hard-gate + secret-safe env reporting. D-089-09 explicitly reuses it. |
| Provider list / "which are native" | A hardcoded list in the eval script or a new constant | `config.py:_PROVIDER_BASE_URLS` keys (minus `openrouter`/`ollama`) | Single source of truth (D-089-05). Any divergence is a bug. |
| State-passing across the seam | A `**kwargs` bag or a module-global | A frozen `RunContext` dataclass | Named fields, mypy-checkable, one construction site, greppable. `**kwargs` hides mis-wiring; globals break WORKER_COUNT=2. |
| Run terminal detection in the eval | Parsing SSE | Poll `public.runs.status` until `{completed,failed,cancelled,timed_out}` | The eval already does this (`wait_for_run`); reuse. |

**Key insight:** The proof harness should ADD a capture step around the existing eval driver, not replace it. The eval proves "tool round-trips still work"; the new XRANGE capture proves "the SSE bytes are identical." Both reuse the same scripted run.

## Runtime State Inventory

> This is a refactor phase. A grep finds files; it does NOT find runtime state. Each category answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | **None requiring migration.** The extraction renames no DB keys, collections, or IDs. `messages.tool_calls` JSONB shape, `runs` columns, `workspace_files` — all unchanged. The `run:{run_id}` Redis stream key format is unchanged (still produced by `_emit` in threads.py). | None — verified by: zero schema edits in scope (D-089-03); `_emit`/`_emit_terminal` stay in threads.py. |
| **Live service config** | **None.** No n8n / Datadog / Tailscale / Cloudflare config references the agent-loop module path. LangSmith traces are keyed by run, not by module name. | None — verified: the only "service" is LangSmith, which traces `create_streaming_chat` calls by their own decorators in `openai_service` (unchanged). |
| **OS-registered state** | **None.** No Task Scheduler / pm2 / systemd entry references `threads.py` internals or `agent_loop`. | None — verified: uvicorn is operator-started in a visible terminal (no registered service). |
| **Secrets / env vars** | **None changed.** Provider API keys (`OPENAI_API_KEY` … `ZHIPU_API_KEY`, `MINIMAX_API_KEY`) are read via `config.py` `Settings` (unchanged). The extraction reads them through `user_settings`/`settings` the same way. | None — code reads the same keys; no key renamed. |
| **Build artifacts / installed packages** | **`__pycache__/threads.cpython-312.pyc`** will be stale after the edit, plus a NEW `agent_loop.cpython-312.pyc` is generated on first import. **Test monkeypatch targets** (`app.api.threads.create_adaptive_streaming_chat`, `app.api.threads.generate_thread_title`) are an installed-import-graph artifact — see the Critical Test-Breakage Risk below. | `.pyc` self-heals on next run (no action). **The monkeypatch-path breakage is real and MUST be planned** — see Common Pitfalls #1. |

**The canonical question — after every file is updated, what runtime systems still have the old shape?** Answer: only the Python import graph that tests reach into via `monkeypatch("app.api.threads.create_adaptive_streaming_chat")`. After the loop moves, that symbol is referenced from `agent_loop.py`, so the patch target must become `app.services.agent_loop.create_adaptive_streaming_chat`. This is a test-side edit (allowed — tests are not "behavior"), but it's the single most likely thing to silently break the suite. ~15 integration tests patch these two symbols.

## Common Pitfalls

### Pitfall 1: Monkeypatch-target breakage (THE extraction's #1 silent failure)
**What goes wrong:** ~15 integration tests do `monkeypatch.setattr("app.api.threads.create_adaptive_streaming_chat", fake)` and `"app.api.threads.generate_thread_title"`. When the call site moves to `agent_loop.py`, the loop reads `agent_loop.create_adaptive_streaming_chat` (its own module binding), so a patch at `app.api.threads.*` no longer intercepts it — tests either hit the real provider (network error) or fail their assertions.
**Why it happens:** Python `from X import Y` creates a new binding in the importing module's namespace; patching the source module doesn't affect already-imported bindings in OTHER modules.
**How to avoid:** As part of the extraction, update every test patch target from `app.api.threads.create_adaptive_streaming_chat` → `app.services.agent_loop.create_adaptive_streaming_chat` (and `...generate_thread_title` stays at `app.api.threads.*` since title-gen STAYS). Grep first: `app.api.threads.create_adaptive_streaming_chat` appears in test_058/059/061/062/063/etc. `generate_thread_title` STAYS in threads.py so its patches are unaffected.
**Warning signs:** Suite goes red with connection-refused / real-provider errors immediately after the move; OR tests pass but make real network calls (slow, flaky).

### Pitfall 2: The `active_provider_name` shadow (a verbatim-move subtlety)
**What goes wrong:** `active_provider_name` is computed TWICE with different sources: at L1889 (`getattr(user_settings,"active_provider","")` — used for the Anthropic/Google native-path gate) and AGAIN at L2231 (`get_model_capability_async(_model_id).get("provider")` — used inside `_on_chunk_openai` for the Moonshot/DeepSeek `<think>` filter + usage accounting). A careless move that "dedupes" these breaks the provider gating.
**Why it happens:** They look redundant but serve different decisions (operator-intent routing vs. model-family chunk handling).
**How to avoid:** Move both verbatim. Do NOT consolidate. This is exactly the D-089-03 trap.
**Warning signs:** Moonshot/DeepSeek `<think>` content leaks into visible output, OR Anthropic-via-OpenRouter incorrectly routes to the native path.

### Pitfall 3: Mutable accumulators captured as context instead of loop-local
**What goes wrong:** Putting `full_content`, `input_tokens_total`, `persisted_tool_calls`, `_previous_files_in_run` on the `RunContext` and mutating ctx fields. With a frozen dataclass this errors; with a mutable one it risks cross-call bleed under WORKER_COUNT=2 if the ctx is ever reused.
**Why it happens:** They're "in scope" today via closure, so it's tempting to treat them as context.
**How to avoid:** Frozen `RunContext` for INPUTS only. Declare all mutable accumulators as locals inside `run_agent_loop` (exactly where they're declared today at L1629-1657). The `_on_chunk_*` handlers `nonlocal` them — that keeps working because the handlers are nested inside `run_agent_loop`.
**Warning signs:** `FrozenInstanceError` at runtime (good — caught early), or token totals leaking between concurrent runs (bad — caught only by parallel-thread UAT).

### Pitfall 4: `_drain_stream_with_close_on_cancel` import cycle
**What goes wrong:** If `_drain_stream_with_close_on_cancel` stays in threads.py and `agent_loop.py` imports it, while threads.py imports `run_agent_loop` from agent_loop.py → circular import at module load.
**Why it happens:** threads.py → agent_loop.py (for `run_agent_loop`) AND agent_loop.py → threads.py (for the drain helper + `_emit`).
**How to avoid:** Pass `emit`/`emit_terminal`/`spawn` as call-time PARAMETERS (not imports) — this already breaks the cycle for those. For `_drain_stream_with_close_on_cancel` and `drain_step` (pure helpers with no threads.py state), MOVE them to agent_loop.py (or a shared `app/services/stream_drain.py`). They have zero closure dependencies — verified at L166/L216, they're pure functions.
**Warning signs:** `ImportError: cannot import name ... (most likely due to a circular import)` at startup.

### Pitfall 5: The terminal-status race ordering must not move (SC#2 invariant)
**What goes wrong:** `_shielded_finalize` (L3035) does `finalize_run` UPDATE BEFORE `_emit_terminal` sentinel (the Plan 075.4-03 race fix). If the extraction relocates `_persist_assistant_message` such that the finalizer can't call it, or reorders the finalize steps, the terminal race re-opens.
**Why it happens:** `_shielded_finalize` calls `_persist_assistant_message` (which MOVES). The finalizer STAYS but loses its closure access to the persist function.
**How to avoid:** `run_agent_loop` returns an `AgentLoopResult` that includes a bound `persist()` callable (or the already-cached message id + the data needed). The finalizer step order (persist → finalize_run → sentinel → expire → zrem) stays byte-identical. `test_075_4_terminal_race.py` asserts source order — keep it green.
**Warning signs:** `test_075_4_terminal_race.py` fails; frontend sees `done` SSE while snapshot still returns `status='streaming'`.

## Code Examples

### Capturing the per-provider SSE event sequence for the diff (the SC#3 proof)
```python
# Source: derived from runs.py XREAD consumer (threads.py emits to f"run:{run_id}")
# Run AFTER the run reaches terminal status. Returns the ordered wire payloads.
async def capture_run_events(redis, run_id: str) -> list[dict]:
    entries = await redis.xrange(f"run:{run_id}", "-", "+")
    events = []
    for _entry_id, fields in entries:
        # _emit stores {"data": json.dumps({"type":..., **fields})}
        events.append(json.loads(fields["data"]))
    return events

# Normalization for deterministic diff (run_id/message_id/timestamps vary run-to-run):
def normalize(events: list[dict]) -> list[dict]:
    out = []
    for e in events:
        e = dict(e)
        e.pop("captured_at", None)        # monotonic wall-clock, non-deterministic
        # mask volatile ids inside known fields; keep TYPE + structural shape
        for k in ("message_id", "run_id"):
            if k in e: e[k] = "<masked>"
        out.append(e)
    return out
# Assert: normalize(before) == normalize(after) per provider → empty diff = SC#3 PASS.
```
> **Capture point rationale:** the `run:{run_id}` stream is the exact byte sequence the SSE consumer (`runs.py`) reads and forwards to the browser. Capturing here (vs. the SSE response body) is deterministic, server-side, requires zero client, and needs no new instrumentation in the loop (zero behavior change). The eval script already has the run_id (returned by `run_prompt`) and waits for terminal — add the XRANGE capture right after `wait_for_run`.

### Per-provider invariant — where each lives (the SC#2 named checklist)
```python
# Anthropic end_turn-instead-of-tool_calls (the comment IS the invariant):
# threads.py:2561-2565
#   "Anthropic's compat layer sends 'end_turn' (not 'tool_calls') even when
#    tool calls are present — checking finish_reason alone would silently drop them."
if not tool_calls_buffer:
    if finish_reason not in ("tool_calls", "stop", "end_turn", None): ...

# Google thought_signature echo: threads.py:2127-2136 (finish branch hydrates buffer)
#   and threads.py:2604-2608 (re-attached top-level on the assistant tool_calls dict)
#   and _reconstruct_history threads.py:1184-1188 (echoed on reload).

# DeepSeek reasoning_content round-trip: threads.py:2313-2317 (accumulate)
#   + threads.py:2620 (must round-trip on tool-call turns or DeepSeek 400s).

# Moonshot/Kimi <think>-filter + empty-retry: threads.py:2280-2308 (state machine)
#   + threads.py:2574-2580 (empty-content-after-tool-call retry, _empty_retries < 1).

# force_no_tools-on-last-iteration: threads.py:1868
force_no_tools = (iteration == max_iterations - 1)

# Iteration-cap silent-drop guard: threads.py:2506-2520
#   kind="iteration_cap_dropped_tool_calls"  (grep-anchor for VERIFICATION)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Agent loop inline in the route handler (god file) | Extracted `agent_loop.py` module | Phase 089 (this) | Harness (091) sits on a clean module, not the god file. |
| Google `thought_signature` via OpenAI-compat `extra_content` | Native google-genai SDK + top-level field | Phase 075.5 | The loop's Google branch uses `stream_google` (native). Preserve verbatim. |
| Tool dispatch ~780-LOC elif chain | `dispatch_tool()` registry (`tool_dispatcher.py`) | Phase 083 | The loop calls a single `dispatch_tool`. 089 keeps this seam. |
| `_previous_files_in_run: set[str]` (filename only) | `dict[str, dict]` ({filename,url,size}) | Phase 075.4 | Download-link payload (CF-01 item c) is already fixed — see CF-01 below. |
| Eval matrix = 6 providers | Eval matrix = native-7 + OpenRouter best-effort | Phase 089 (D-089-09) | GLM + MiniMax added to the automated gate. |

**Deprecated/outdated:**
- The ROADMAP/REQUIREMENTS "all 6 native providers" wording — superseded by D-089-05 (**native-7**). REQUIREMENTS.md EVAL-01 still says "6 native providers"; that is the 088 inheritance and is corrected for v2.8 by this research.
- `gemini-2.5-flash` as a Google eval model — known-degraded (narrates a todo list without emitting the tool call); the eval pins `gemini-3.5-flash` (3.x+).

## CF-01 Carry-Forward Sweep (target 7 — FOUND for CF-01)

Each item: evidence location, verification surface, concrete pass/fail check, disposition.

### Item (a): Title-gen on the native-7 (BUG-260527-01)
- **Where the fix lives:** `generate_thread_title` `threads.py:992-1085`; the Phase 083 fix is the `_SINGLE_MODEL_PROVIDERS` frozenset routing (`config.py` `{deepseek, moonshot, minimax, zhipu, ollama}`) at `threads.py:989/1005`. Single-model providers use the frontend-sent `chat_model` (always correct for the active provider) rather than a sub-agent default that may name a wrong-provider model. **STAYS in threads.py** (fires in `send_message` before the loop, L1383-1421).
- **Verification surface:** browser-observable (Chrome MCP, `http://localhost:5173/`). Create a new chat per provider; the thread title in the sidebar should change from "New Chat" to a 4-6 word title within ~2s.
- **Concrete pass/fail:** For each of the native-7 — send one message, then assert `threads.title != "New Chat"` AND title is multi-word (not one letter/word). DB cross-check: `SELECT title FROM threads WHERE id = ...`.
- **Known prior signal (caution):** Auto-memory `project_title_gen_deepseek_moonshot_broken.md` says title-gen is "still broken on DeepSeek/Moonshot (sends wrong model name)" and was deferred as minor. So this item has a real chance of being STILL-BROKEN. Per D-089-12: if broken, re-open with `re_open_trigger`, route to a v2.8 polish slot (093 vicinity or standalone quick) — **do NOT fix in 089**.
- **Disposition routing:** title-gen → v2.8 polish slot / standalone quick (D-089-12).

### Item (b): Google secondary-model 404 routing
- **Where it lives:** the ROOT sub-agent footgun was closed in Phase 085 (`sub_agent_models.resolve_sub_agent_model_safely`, commit `bdd9fd7`) — `BUG-260528-01` is `status: closed, verified_closed_by: 085`. The LIVE CF-01 surface is the **transient 088-04 Google secondary-model 404 routing artifact** (STATE.md: "transient 088-04 Google 404 is a SEPARATE secondary-model routing artifact (v2.8 CF-01)"). This is the title-gen / secondary-model path on the Google axis, NOT the main agent loop.
- **Verification surface:** backend eval script (operator-run) on the Google axis + LangSmith trace; OR Chrome MCP creating a Google-provider chat and watching for a `fallback_model` SSE event / 404 in backend logs.
- **Concrete pass/fail:** Run the eval `--provider google` cell; assert the run reaches `completed` with no 404 in backend logs and the secondary-model (title/sub-agent) resolves to a Google-family model (not `gpt-4.1`). Cross-check `runs.model`/`runs.provider` consistency for any sub-run.
- **Disposition routing:** Google-404 → v2.8 polish slot (093 vicinity or standalone quick) per D-089-12 if still reproduces.

### Item (c): Download-link payload (BUG-260522-02 + BUG-260521-02)
- **Where it lives:** **ALREADY FIXED in code.** `_previous_files_in_run` is `dict[str, dict]` (`threads.py:1808`), and the `final_output_files` emit projects the full `{filename, url, size}` triple from `.values()` (`threads.py:2753-2762`). BUG-260522-02 is `status: folded` into 075.4. So the URL **is** in the event payload today.
- **Verification surface:** browser-observable (Chrome MCP). Run the canonical primes-matplotlib recipe on Anthropic; the pinned "Final outputs" panel `<OutputFileCard>` should render a clickable download link + size badge (not the muted `opacity-40` url-absent fallback).
- **Concrete pass/fail:** After an `execute_code` run that writes a file, capture the `final_output_files` SSE event (XRANGE) and assert each `files[]` entry has non-empty `url` AND `size`. UI: assert the download icon is NOT `opacity-40` and click navigates to the signed URL.
- **Disposition routing:** If download is genuinely still-broken AND it's the SEED-037 in-panel wire-up gap → run the SEED-037 `/gsd:quick` right then (D-089-14). If it works → SEED-037 stays a separate later quick. Data-driven.

> **CF-01 sweep is purely verification** — under D-089-12 the only 089 work is verify + (if broken) re-open with a trigger. The lift itself does not touch the download-link or title-gen code (both STAY in threads.py / sandbox_service.py, outside the moved loop).

## D-089-09 Eval Curation — current model IDs (verified against `config.py` MODEL_CAPABILITIES)

Extend the eval `PROVIDERS` list (`scripts/eval_cross_provider.py:68-75`) from 6 → native-7 (+ keep OpenRouter as best-effort). Verified current registry IDs:

| Provider | Current eval ID (verified in registry) | Registry line | Action |
|----------|----------------------------------------|---------------|--------|
| openai | `gpt-5.4-mini` | config.py:178 | keep |
| anthropic | `claude-haiku-4-5` (registry: `claude-haiku-4-5-20251001`) | config.py:191 | keep — confirm the eval's short alias resolves |
| google | `gemini-3.5-flash` (3.x+, NOT 2.5) | config.py:90 | keep |
| deepseek | `deepseek-v4-flash` | config.py:214 | keep |
| moonshot | `kimi-k2.6` | config.py:219 | keep |
| **zhipu (GLM)** | **`glm-4-flash`** (default) or `glm-4-plus` | config.py:225 / :224 | **ADD** (`_SUB_AGENT_MODEL_DEFAULTS["zhipu"]="glm-4-flash"`, config.py:555) |
| **minimax** | **`minimax-m2.7`** | config.py:222 | **ADD** (`_SUB_AGENT_MODEL_DEFAULTS["minimax"]="minimax-m2.7"`, config.py:554) |
| openrouter | `z-ai/glm-5.1` | (eval line 72) | keep — best-effort, not gated (D-089-07) |

Also extend `report_env_presence()` (`eval_cross_provider.py:208-218`) to add `ZHIPU_API_KEY` + `MINIMAX_API_KEY` presence checks (verified env-var names: `config.py:580-581`, `.env.example:100-101`). The `--provider` argparse `choices` (line 605) auto-extends from the PROVIDERS list. Per [[feedback_model_names_representative]]: these are provider-class representatives; the comprehensive pinning pass is Phase 096 (EVAL-01).

## Extraction Seam Map (target 1 — verified against the LIVE file)

> Line numbers verified against the current 3,186-LOC `threads.py` (2026-05-30). The CONTEXT's "~L" hints were close; here are the real ranges. **Critical structural fact: `agent_runner` is a NESTED async function inside `send_message`, and the loop helpers are nested inside `agent_runner`.** The extraction un-nests them into a module.

### MOVES to `agent_loop.py` (D-089-01)
| Symbol | Live line range | Notes |
|--------|-----------------|-------|
| The iteration loop | `for iteration in range(max_iterations):` **L1818** → end of loop body **~L2738** | Includes trim, force_no_tools, provider branch, iteration-cap guard, length guards, empty-retry, tool-dispatch round. |
| `_on_chunk_anthropic` | **L1944-2022** (defined), drained L2017 | Anthropic native path L1897-2023. |
| `_on_chunk_google` | **L2055-2143** (defined), drained L2138 | Google native path L2025-2144. |
| `_on_chunk_openai` | **L2245-2403** (defined), drained L2404 | OpenAI/OpenRouter/Ollama path L2146-2452. |
| Tool-dispatch round | **L2583-2738** | `ToolContext` construction L2632-2660; `dispatch_tool` call L2677; tool-result append L2704-2737. |
| `_persist_assistant_message` | **L1659-1724** | Returns message id; idempotent via `_message_persisted` + function-attr cache. Called by finalizer (STAYS) → needs result-object seam. |
| `_persist_system_messages` | **L1736-1778** | Persists `role='system'` warning rows (migration 048). |
| `_strip_nul` | **L1726-1734** | Pure helper used by both persist functions. |
| Post-loop emits | `final_output_files` **L2753-2762**, sources/citations/confidence **L2866-2889**, fallback-empty **L2764-2780** | Inside the inner try; move with the loop body. |
| The provider-error/exception handlers | `except (asyncio.TimeoutError...)` **L2782-2864** | The inner try/except that wraps the loop. Moves with the loop (sets `full_content`, emits friendly deltas, re-raises). |
| Suggestion-gen + stream_end | **L2911-2984** | Runs after the loop, before the finalizer triggers. Move with the loop body (it reads `full_content`, `body.content`, `user_settings`). |

### STAYS in `threads.py` (D-089-02)
| Symbol | Live line range | Notes |
|--------|-----------------|-------|
| `send_message` route | **L1224-3185** (the shell) | INSERTs, provider/model resolution L1293-1331, runs INSERT L1337, title-gen L1383-1421, JSONResponse return L3180. |
| `agent_runner` producer shell | **L1423** → finally **L3151** | Owns the outer try/except that sets `_terminal_status`; folder-scope + history load + mode/prompt selection (L1470-1627) — **see Open Question 1**. |
| `_emit` / `_emit_terminal` / `_spawn` | **L109-140 / L69-74** | Passed into `run_agent_loop` as callables. |
| `_shielded_finalize` | **L3035-3142** | finalize_run → sentinel → expire → zrem ordering. Calls `_persist_assistant_message` (MOVES) → result-object seam. |
| `_reconstruct_history` | **L1135-1221** | Read path for the LLM; called at L1611. **See Open Question 1.** |
| `drain_step`, `_drain_stream_with_close_on_cancel` | **L166-192 / L216-315** | Pure helpers — **recommend moving to agent_loop.py or a shared module** (Pitfall 4). |
| `generate_thread_title` | **L992-1085** | CF-01 item (a). Fires in send_message, not the loop. |
| `get_snapshot` / `get_messages` | **L763-874 / L1087-1132** | Carry `.neq("role","system")` filter — Phase 086 landmine. UNTOUCHED. |

## Closure-Capture Inventory (target 2 — THE most important output)

Every variable the moved code reads from its enclosing (`agent_runner`/`send_message`) scope. Each becomes a `RunContext` field, a callable param, or a re-declared loop-local.

### Category A — stable INPUTS → `RunContext` fields (frozen)
| Variable | Origin | Read by |
|----------|--------|---------|
| `run_id` | `send_message` L1297 | every `_emit`, ToolContext, finalize |
| `thread_id` | route path param | persist, ToolContext, messages append, DB writes |
| `current_user` | `Depends(get_current_user)` | persist, ToolContext, history filter |
| `user_settings` | resolved L1293-1329 (`_user_settings`, provider-overridden) | provider gating, tool selection, budgets, title — **pass the RESOLVED object** |
| `body` (`MessageCreate`) | route body | `body.model`, `body.provider`, `body.agent_mode`, `body.content` |
| `redis` | `Depends(get_redis)` | every emit (or via the `emit` callable — see Cat. C) |
| `supabase` | `Depends(get_supabase)` | history load, skills/memory injection, ToolContext, thread touch |
| `_resolved_model` | L1298 | finalize warning, ToolContext model |
| `_resolved_provider` | L1306-1331 | finalize warning |

### Category B — DERIVED-in-runner inputs (computed at L1470-1627, BEFORE the loop)
> **These are computed inside `agent_runner` today (after spawn).** Decision: either (B1) compute them inside `run_agent_loop` (move L1470-1627 into the module), or (B2) compute in `agent_runner` and pass via an extended context. **Recommend B1** — they're loop setup, not producer-shell concern, and moving them keeps the seam thinner (fewer ctx fields). This is the Open Question 1 boundary call.
| Variable | Computed at | Used by |
|----------|-------------|---------|
| `thread_folder_id`, `folder_subtree_ids`, `scoped_folder_path` | L1479-1508 | ToolContext, system-prompt scope note |
| `active_system_prompt` | L1521/1525 (+ scope/skills/memory/disabled-tools augmentation L1530-1603) | provider stream calls |
| `active_tools` | L1522/1526 (`get_explorer_tools()` or `None`) | provider stream calls, ToolContext |
| `max_iterations` | L1523 (8 explorer) / L1527 (15 general) | the loop range |
| `messages` (history) | L1605-1622 (`_reconstruct_history` + `trim_messages_to_fit`) | the loop's first call |
| `history_resp.data` | L1511 query | `_reconstruct_history` input |

### Category C — CALLABLES → explicit params
| Callable | Origin | Why a param (not import) |
|----------|--------|--------------------------|
| `_emit` | threads.py L109 | breaks the import cycle (Pitfall 4); the loop calls it ~40× |
| `_emit_terminal` | threads.py L126 | used by the finalizer (stays) — loop may not need it directly |
| `_spawn` | threads.py L69 | passed into `ToolContext(spawn=...)` L2643 |

### Category D — mutable ACCUMULATORS → loop-locals (re-declare inside `run_agent_loop`, NOT context)
> Declared today at L1629-1657. The `_on_chunk_*` handlers `nonlocal` them — this keeps working because the handlers stay nested inside `run_agent_loop`.
`full_content`, `full_reasoning_content`, `persisted_tool_calls`, `_persisted_system_warnings`, `input_tokens_total`, `output_tokens_total`, `source_refs`, `unique_sources`, `retrieved_citations`, `similarity_scores`, `unique_citations`, `_confidence_slot`, `_message_persisted`, `_empty_retries`, `_previous_files_in_run` (L1808), `_per_run_task_semaphore` (L1816), `_structured_tools_injected`, `_needs_pre_injection`.

### Category E — finalizer-needed OUTPUTS → `AgentLoopResult` (returned to `agent_runner`)
> `_shielded_finalize` (STAYS) reads these after the loop. Return them.
`_persist_assistant_message` (the bound callable / cached id), `input_tokens_total`, `output_tokens_total`, `_persisted_system_warnings`, and the terminal-state signal (though `_terminal_status` is set by the producer-shell except handlers, which STAY).

**Proposed signature (REPORT TO OPERATOR per D-089-04):**
```python
async def run_agent_loop(ctx: RunContext, *, emit, emit_terminal, spawn) -> AgentLoopResult
# RunContext (frozen): run_id, thread_id, current_user, user_settings, body,
#                      redis, supabase, resolved_model, resolved_provider
# AgentLoopResult: persist (callable), input_tokens_total, output_tokens_total,
#                  persisted_system_warnings, full_content_final
```

## Per-Provider Invariant Inventory (target 3 + 5 — the SC#2 named VERIFICATION checklist)

| # | Invariant | file:line | One-line excerpt | Provider branch |
|---|-----------|-----------|------------------|-----------------|
| I1 | Anthropic `end_turn` instead of `tool_calls` | threads.py:**2562-2565** | `"Anthropic's compat layer sends 'end_turn' (not 'tool_calls')..."` → `finish_reason not in ("tool_calls","stop","end_turn",None)` | shared (post-stream tool-buffer check) |
| I2 | Google `thought_signature` echo (hydrate) | threads.py:**2127-2136** | `tool_calls_buffer[_i]["thought_signature"] = _ftc["thought_signature"]` | `_on_chunk_google` finish branch |
| I3 | Google `thought_signature` re-attach (round-trip) | threads.py:**2604-2608** + **1184-1188** | `{"thought_signature": tc["thought_signature"]}` on assistant tool_call dict + in `_reconstruct_history` | shared tool-round + reload path |
| I4 | DeepSeek `reasoning_content` accumulate | threads.py:**2313-2317** | `full_reasoning_content += _rc; await _emit(... 'reasoning_delta' ...)` | `_on_chunk_openai` |
| I5 | DeepSeek `reasoning_content` round-trip on tool turns | threads.py:**2620** | `**({"reasoning_content": full_reasoning_content} if full_reasoning_content else {})` (else DeepSeek 400s) | shared tool-round assembly |
| I6 | Moonshot/Kimi `<think>` filter state machine | threads.py:**2280-2308** | `if active_provider_name in ("moonshot","deepseek"): ... _in_think_block ...` | `_on_chunk_openai` |
| I7 | Empty-content-after-tool-call retry guard | threads.py:**2574-2580** | `if not full_content and _empty_retries < 1: _empty_retries += 1 ... continue` | shared |
| I8 | `force_no_tools` on last iteration | threads.py:**1868-1869** | `force_no_tools = (iteration == max_iterations - 1); tool_choice = "none" if force_no_tools else "auto"` | shared |
| I9 | Iteration-cap silent-drop guard | threads.py:**2506-2520** | `kind="iteration_cap_dropped_tool_calls"` + clears `tool_calls_buffer` | shared |
| I10 | Terminal-status race (finalize before sentinel) | threads.py:**3094-3118** (in `_shielded_finalize`, STAYS) | `finalize_run(...)` THEN `_emit_terminal(...)` | producer shell |
| I11 | Transient provider-error retry (2×, [0.5,1.5]s) | threads.py:**2476-2488** | `if _is_transient_provider_error(...) and _provider_retries < _MAX_PROVIDER_RETRIES: ... continue` | shared (except APIError) |
| I12 | TPM "request too large" 429 special-case | threads.py:**2460-2474** | `_is_request_too_large = status_code==429 and ("request too large" ...)` | shared |
| I13 | `finish_reason == "length"` prose-before-code recovery | threads.py:**2530-2559** | injects corrective user message + `continue` | shared |
| I14 | OpenRouter XML pre-injection + per-provider boundary dicts | threads.py:**1876-1885** + **2191-2192/2364-2368** | independent `_emit_boundary_openrouter` vs `_emit_boundary_openai_native` | `_on_chunk_openai` |

### GLM (zhipu) + MiniMax — explicit absence note (D-089-06)
**Verified: there are ZERO GLM/MiniMax-specific branches in the loop.** Grep for `minimax|zhipu|glm` in `threads.py` returns exactly ONE hit — `_SINGLE_MODEL_PROVIDERS` (L989), which is a **title-gen routing** constant (STAYS in threads.py, not in the loop). GLM and MiniMax route through the shared OpenAI-compat path (`_on_chunk_openai`) because their `_PROVIDER_BASE_URLS` entries are OpenAI-compatible endpoints (`config.py:18-19`). They do NOT use `<think>` tags (not in the moonshot/deepseek filter list at L2280) and do NOT use native `thought_signature`. **Their invariants = the shared OpenAI-compat invariants (I4-I14 as applicable). No provider-specific carry-forward exists for them.** The proof for GLM/MiniMax is therefore the same SSE-diff + eval rows as the other OpenAI-compat providers — no extra invariant rows.

### Explorer-branch preservation (target 5 — SC#4)
| Explorer-specific value | file:line | Value |
|-------------------------|-----------|-------|
| System prompt | threads.py:**1521** | `active_system_prompt = EXPLORER_SYSTEM_PROMPT` |
| Tool set (the ~6-KB dedicated set) | threads.py:**1522** | `active_tools = get_explorer_tools()` (from `openai_service`) |
| Iteration cap | threads.py:**1523** | `max_iterations = 8` (comment: "GEN-04: was 6") |
| General contrast | threads.py:**1525-1527** | `SYSTEM_PROMPT`, `active_tools = None`, `max_iterations = 15` |
| Skills/memory/disabled-tools injection | threads.py:**1542** | `if body.agent_mode != "explorer":` — Explorer SKIPS catalog/memory/disabled-tools augmentation |

The mode branch is at L1520-1527 (in Category B — moves into `run_agent_loop` if B1 chosen). UAT (D-089-10) must exercise BOTH modes; `test_explorer_agent.py` (unit) already covers the Explorer toolset selection and must stay green.

## The Phase 086 Snapshot-Filter Landmine (target 8)

- **Where the filter lives:** `.neq("role","system")` in `get_snapshot` (**threads.py:800**) and `get_messages` (**threads.py:1113**). `MessageResponse.role` is `Literal["user","assistant"]` (`app.models.message`), so serializing a `role='system'` row (migration 048 ask_user / system_warning banners) raises `ResponseValidationError` → 500, thread won't load. Regression guard: `test_075_snapshot.py`.
- **Does the extraction touch it?** **NO.** Both route handlers STAY in threads.py and are NOT part of the moved loop. The loop's history read is a SEPARATE query (`threads.py:1511`, selecting `role, content, tool_calls, reasoning_content` for the LLM) that does NOT filter system rows and feeds `_reconstruct_history` — this is the LLM read path, unrelated to the frontend serialization path. **Constraint:** the extraction must NOT "consolidate" the loop's history query with the route handlers' message queries (they have different filters by design). Preserve both verbatim. The `panel.py` `/pending` raw-asyncpg query is a third separate path, also unaffected.
- **Net:** zero risk IF the route handlers are left untouched (D-089-02 says they stay). Flag for the planner: the verification checklist should include "ask_user thread loads without 500 after extraction" (load a thread with ask_user history via `http://localhost:5173/`).

## Validation Architecture

> nyquist_validation = true (`.planning/config.json:8`). Section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (`asyncio_mode = auto`) — `backend/pytest.ini` |
| Config file | `backend/pytest.ini` (`testpaths = tests`) |
| Quick run command | `backend/venv/Scripts/python.exe -m pytest backend/tests/integration/test_075_4_terminal_race.py backend/tests/unit/test_chunk_handler_provider_aware.py -x` |
| Full suite command | `backend/venv/Scripts/python.exe -m pytest backend/tests/ -q` |
| E2E backstop | `frontend/tests/e2e/scenario-*.spec.ts` (13 scenarios — Playwright) via `frontend-tests.yml` |
| Eval gate | `backend/venv/Scripts/python.exe scripts/eval_cross_provider.py` (operator-run, live keys) |

### Success Criterion → Validation Map
| SC | Behavior | Validation type | Command / surface | Exists? |
|----|----------|-----------------|-------------------|---------|
| SC#1 (FOUND-03) | Loop + handlers + persist + dispatch round moved verbatim; threads.py retains only the shell | structural diff + suite | full pytest suite GREEN + `git diff` review of the seam | ✅ existing suite; ❌ Wave 0 needs the monkeypatch-target update |
| SC#2 | Every per-provider invariant (I1-I14) carried verbatim, NAMED in VERIFICATION | unit + named checklist | `test_066_*`, `test_075_*`, `test_chunk_handler_provider_aware`, `test_explorer_agent` + the I1-I14 table | ✅ tests exist; ❌ VERIFICATION must enumerate I1-I14 |
| SC#3 | Byte-identical SSE per native-7 provider (captured-diff-empty) | NEW capture+diff harness | `capture_run_events` XRANGE before/after, `normalize`, assert empty diff per provider (operator-run live) | ❌ Wave 0 — new capture helper + before/after runbook |
| SC#3 (backstop) | Eval + E2E GREEN before AND after | eval + Playwright | `eval_cross_provider.py` (7 providers) + `scenario-*.spec.ts` | ✅ exist; ❌ Wave 0 needs +2 providers (D-089-09) |
| SC#4 | Explorer branch preserved byte-identically | unit + 4-axis UAT in BOTH modes | `test_explorer_agent.py` + manual UAT General AND Explorer | ✅ unit; ❌ UAT rows in VALIDATION.md |
| SC#5 / EVAL-02 | 4-axis UAT (cross-provider × multi-tool × parallel-thread × long-message) | manual UAT scoreboard | VALIDATION.md UAT rows (NOT PLAN tasks) — Chrome MCP + operator backend | ❌ VALIDATION.md authoring |
| CF-01 | 3 carry-forwards verified-closed or re-opened | hybrid (Chrome MCP + eval) | per-item checks above (title-gen, Google-404, download-link) | ❌ runbook + dispositions |

### Sampling Rate
- **Per task commit:** quick run (terminal-race + chunk-handler unit tests) — < 30s.
- **Per wave merge:** full pytest suite GREEN.
- **Phase gate:** full suite GREEN + eval scoreboard `EVAL_SUMMARY 28/28` (7 providers × 4 prompts, native-7 gated; OpenRouter best-effort) BEFORE AND AFTER the lift + SSE-diff empty per native-7 provider + 4-axis UAT in both modes + CF-01 dispositions recorded.

### Wave 0 Gaps
- [ ] **Monkeypatch-target sweep** — update ~15 integration tests' `app.api.threads.create_adaptive_streaming_chat` → `app.services.agent_loop.create_adaptive_streaming_chat` (grep-driven). `generate_thread_title` patches STAY (title-gen stays in threads.py). *This is a Wave 0 prerequisite — without it the suite goes red on move.*
- [ ] **`scripts/eval_cross_provider.py` +2 providers** — add `("zhipu","glm-4-flash")` + `("minimax","minimax-m2.7")` to `PROVIDERS`; add `ZHIPU_API_KEY`/`MINIMAX_API_KEY` to `report_env_presence()` (D-089-09 — additive, NOT loop edits).
- [ ] **SSE capture helper** — `capture_run_events(redis, run_id)` (XRANGE) + `normalize()` + a before/after diff runbook the operator runs (drives the eval's scripted multi-tool prompt, captures per-native-7-provider, asserts empty diff).
- [ ] **VALIDATION.md** — 4-axis UAT rows (cross-provider native-7 × multi-tool × parallel-thread × long-message ≥50 msgs/≥5 KB) in BOTH General AND Explorer mode + CF-01 per-item disposition rows.
- [ ] **`AgentLoopResult` seam** — the finalizer (`_shielded_finalize`, STAYS) needs the loop to return the persist callable + token totals + warnings; no existing test covers this seam — add one asserting the finalizer still gets a valid message id.

*(Framework install: none — pytest + Playwright already present.)*

## Security Domain

> security_enforcement absent in config → treat as enabled. This is a refactor with no new attack surface, but the proof harness touches auth + the loop persists user data.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control (preserved, not changed) |
|---------------|---------|-------------------------------------------|
| V2 Authentication | yes | The eval harness mints a bearer via Supabase password grant for the LOCAL test user only (`eval_cross_provider.py:405`); `get_current_user` verifies server-side. Unchanged. |
| V3 Session Management | no | Stateless chat completions (no provider-side thread state — CLAUDE.md rule). |
| V4 Access Control | yes | RLS — the loop writes `messages`/`runs` with `user_id = current_user["id"]`; the eval reads only the test user's own threads. The extraction must preserve the `user_id` filters on every DB write (verified present at persist L1683/L1711 and history L1515). |
| V5 Input Validation | yes (preserve) | `_strip_nul` (MOVES) strips PG-illegal null bytes; `json.loads(tc["arguments"])` guarded by `except json.JSONDecodeError` (L2690). Preserve verbatim. |
| V6 Cryptography | no | No crypto in scope. Provider keys read via config; the eval prints PRESENCE only, never values (`report_env_presence`). |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation (preserved) |
|---------|--------|---------------------------------|
| Secret leakage via eval output | Information disclosure | `report_env_presence()` prints set/MISSING only; localhost hard-gate refuses cloud SUPABASE_URL (`eval_cross_provider.py:233`). Preserve when adding the 2 new providers. |
| SQL injection in the eval | Tampering | Fixed allowlist `_COUNT_QUERIES`; thread_id always parameterized `%s`. Adding providers does not add queries. |
| Traceback leaking env values | Information disclosure | `BackendUnavailable` clean-exit pattern (no traceback). Preserve. |
| Cross-user data leak via RLS bypass | Elevation/Info-disclosure | Every loop DB write keeps the `user_id` predicate; the threads ownership SELECT fires FIRST in route handlers (unchanged). |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python venv | backend | ✓ (CLAUDE.md mandates) | 3.12 (`.cpython-312`) | — |
| pytest | unit/integration validation | ✓ | `backend/pytest.ini` present | — |
| Local Supabase | eval harness + UAT | operator-managed | CLI v2.101 (memory) | — (operator starts) |
| Redis (local docker) | `run:{run_id}` stream + SSE capture | operator-managed | docker-compose.dev.yml | — |
| uvicorn backend | eval + UAT | **operator-started in visible terminal** ([[feedback_user_starts_backend]]) | — | NEVER `run_in_background` |
| Provider API keys (native-7) | live eval + SSE proof | **operator's `backend/.env` only** | — | Claude cannot run the eval; operator runs + pastes results (D-089-11) |
| Chrome DevTools MCP | CF-01 browser-observable checks + 4-axis UAT | ✓ ([[feedback_chrome_mcp_testing]]) | `http://localhost:5173/`, login `fhdmrd@gmail.com`/`123456` | — |
| Playwright (E2E backstop) | scenario-*.spec.ts | ✓ | `frontend-tests.yml` | — |

**Missing dependencies with no fallback:** Live provider keys for the SSE-diff + eval gate — by design only on the operator's machine. Claude authors the runbook; the operator runs it (D-089-11). This is a hard hybrid-driver constraint, not a blocker.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Title-gen (CF-01 a) is likely STILL-BROKEN on DeepSeek/Moonshot (auto-memory says "sends wrong model name", deferred as minor) | CF-01 item (a) | LOW — the sweep verifies live; if it works, no re-open needed. Disposition is data-driven (D-089-12). |
| A2 | Moving `_drain_stream_with_close_on_cancel` + `drain_step` to agent_loop.py (vs. keeping + importing) avoids the import cycle cleanly | Pitfall 4 / Open Q | LOW — both are pure (no threads.py state, verified L166/L216); if kept in threads.py, the cycle is broken anyway by passing emit as a param. Planner's call. |
| A3 | B1 (compute the L1470-1627 setup inside `run_agent_loop`) gives a thinner seam than B2 (compute in agent_runner, pass via ctx) | Closure-Capture Cat. B / Open Q 1 | MEDIUM — this changes where `_reconstruct_history` is called from and how many ctx fields exist. **Operator should confirm the boundary at the seam-review checkpoint (D-089-04).** |
| A4 | The eval's short alias `claude-haiku-4-5` resolves to the registry's `claude-haiku-4-5-20251001` | Eval Curation | LOW — verify at curation time; if not, pin the full ID. |
| A5 | Capturing SSE at the `run:{run_id}` XRANGE (vs. SSE response body) is sufficient for the byte-identical proof | Code Examples / SC#3 | LOW — the stream IS the wire payload the consumer forwards; equivalent and deterministic. Confirmed by runs.py XREAD consumer reading the same key. |
| A6 | A 28-cell eval (7×4) is the right gate shape (vs 24) | Sampling Rate | LOW — native-7 gated, OpenRouter best-effort (not in the gated count); exact cell count is the planner's to set. |

## Open Questions

1. **The Category-B boundary: where do the L1470-1627 derivations live (the seam-review decision)?**
   - What we know: folder-scope, mode/prompt/tool selection, skills/memory injection, history reconstruction + trim all happen inside `agent_runner` BEFORE the loop. They're loop SETUP, not producer-shell concern.
   - What's unclear: move them into `run_agent_loop` (B1 — thinner ctx, recommended) or keep in `agent_runner` and pass the computed values via an extended ctx (B2 — more ctx fields, `agent_runner` stays fatter).
   - Recommendation: **B1**, and explicitly include this in the seam-signature reported to the operator (D-089-04). It makes `RunContext` carry raw inputs only; the loop owns its own setup. Operator confirms before any move.

2. **Atomic commit vs. reviewable sequence (D-089 Claude's discretion)?**
   - What we know: each intermediate state must keep eval + E2E GREEN.
   - Recommendation: a 3-step sequence — (1) move pure helpers (`drain_step`, `_drain_stream_with_close_on_cancel`, `_strip_nul`) + add `RunContext`/`AgentLoopResult` skeleton; (2) move the loop + handlers + persist, wire the seam, update monkeypatch targets; (3) extend the eval + author the SSE-capture runbook. Each step ends GREEN. Planner's final call.

3. **Does `_reconstruct_history` move or stay?**
   - It's called at L1611 (inside the to-be-moved setup region under B1). If B1: it can stay in threads.py and be imported by agent_loop.py (it's a pure function with no threads.py state — verified L1135-1221), OR move. Recommendation: **keep in threads.py, import into agent_loop.py** — it's also conceptually a message-shape helper that other paths might reuse, and importing a pure function creates no cycle.

## Sources

### Primary (HIGH confidence — line-verified in-repo)
- `backend/app/api/threads.py` (3,186 LOC) — full seam map, closure inventory, invariant inventory, snapshot filter. Every line number verified against the live file 2026-05-30.
- `backend/app/config.py` — `_PROVIDER_BASE_URLS` (L10-20, native-7 authority), `MODEL_CAPABILITIES` (model IDs), `_SUB_AGENT_MODEL_DEFAULTS` (L546-555), API-key wiring (L580-581, L624-627).
- `backend/app/services/tool_dispatcher.py` — `ToolContext` (L59-89), `ToolResult` (L92), `dispatch_tool` (L1495) — the 083 seam the loop calls.
- `scripts/eval_cross_provider.py` (696 LOC) — the proof harness: provider override (L472-491), terminal poll (L494-515), scoreboard (L558-583), PROVIDERS list (L68-75), env presence (L202-224).
- `.planning/reported-bugs/{title-generation-broken-deepseek-moonshot-google, sub-agent-cross-provider-model-default-404, final-outputs-backend-omits-url-in-event-payload}.md` — CF-01 evidence + dispositions.
- `.planning/phases/089-.../089-CONTEXT.md` — D-089-01..15 (authoritative scope).
- `.planning/STATE.md` — Phase 086 snapshot landmine note; 089 highest-risk blocker.
- `.planning/REQUIREMENTS.md` — FOUND-03, CF-01, EVAL-01 (the "6" the operator corrected to 7).

### Secondary (MEDIUM — auto-memory, cross-checked)
- `project_title_gen_deepseek_moonshot_broken.md` — title-gen still broken signal (A1).
- `feedback_model_names_representative.md` — model IDs are provider-class representatives (curation = Phase 096).
- `feedback_no_cross_provider_regressions.md`, `feedback_provider_uniform_ux.md` — no-shared-path-edits + one-UX-N-adapters.

### Tertiary (LOW — none)
- No web sources needed; the entire scope is in-repo, line-verifiable. No training-data claims about external library behavior were relied on.

## Metadata

**Confidence breakdown:**
- Extraction seam + closure inventory: HIGH — every symbol line-verified against the live 3,186-LOC file; the nested-closure structure is confirmed, not assumed.
- Per-provider invariants: HIGH — each invariant located with file:line + excerpt; GLM/MiniMax absence verified by exhaustive grep (1 hit, a title-gen constant).
- Byte-identical SSE proof design: HIGH — capture point (Redis `run:{run_id}` XRANGE) confirmed against the runs.py XREAD consumer reading the same key.
- CF-01 dispositions: MEDIUM-HIGH — download-link verified fixed-in-code; title-gen flagged likely-still-broken (A1); Google-404 is the transient 088-04 artifact (verification is live, operator-run).
- Native-7 correction: HIGH — `_PROVIDER_BASE_URLS` + API keys + registry entries all confirm GLM/MiniMax wired.

**Research date:** 2026-05-30
**Valid until:** 2026-06-29 (stable — in-repo refactor; the only drift risk is further `threads.py` edits before the lift, which would shift line numbers but not structure).
