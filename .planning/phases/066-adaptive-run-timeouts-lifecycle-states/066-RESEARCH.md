# Phase 066: Adaptive Run Timeouts & Lifecycle States — Research

**Researched:** 2026-05-06
**Domain:** asyncio cancellation / SDK stream lifecycle / Postgres CHECK migration / LangSmith tracing / per-model latency
**Confidence:** HIGH for SDK probes and asyncio semantics; MEDIUM for per-model latency budgets (no authoritative public p99 numbers); HIGH for migration shape

## Summary

Phase 066 replaces a global 120s `asyncio.timeout()` wrapper around the entire agent loop with a per-LLM-call timer that resets on every iteration, and splits the overloaded `cancelled` terminal state into `cancelled` (user Stop) vs `timed_out` (system per-call deadline). CONTEXT.md decisions D-066-01..D-066-12 lock the architecture; this research fills the technical unknowns that the planner needs.

The five highest-leverage findings:

1. **Both Anthropic and OpenAI SDKs expose a `.close()` method on their stream objects** that closes the underlying httpx response. For sync `Stream`/`MessageStream` it's `stream.close()` (sync); for the async variants it's `await stream.close()` (NOT `aclose()`). Critically — and not obvious from the SDK docs — the project's current code uses the **sync** OpenAI and Anthropic clients with `for chunk in stream:` / `for event in stream:` loops inside an `async def`. This means the iteration itself blocks the event loop and `asyncio.timeout` cannot interrupt it mid-chunk; cancellation only lands at the `await _emit(...)` calls between chunks. This is fine for the per-call timer (LLM streams emit chunks frequently) but the close call must be sync (`stream.close()`) — not `await stream.close()`.
2. **`asyncio.timeout()` resets cleanly on every `async with` entry.** Each new context manager creates a fresh deadline; per-iteration usage in a loop is the canonical pattern documented in the Python 3.12 docs. No reentrancy concern.
3. **Per-model `llm_call_timeout_seconds` recommendation: 180s default for unknown models, 300s for slow reasoning paths (Opus extended thinking, o1/o3, Kimi K2.5), 90s for fast non-reasoning models (Haiku, Mini, Flash, Nano).** Public p99 numbers are scarce, but Anthropic's own Claude Code repo documents real-world Sonnet-4.6 extended-thinking stalls of 7.5+ minutes per call (Issue #51568) — confirming that conservative budgets are essential and "tight" reasoning-model budgets will fire false positives.
4. **`runs.status` CHECK constraint replacement is a single-transaction `DROP CONSTRAINT` + `ADD CONSTRAINT` block.** PostgreSQL transactional DDL means both run as one atomic ALTER TABLE if they're in the same statement file; Supabase SQL Editor pastes already run inside an implicit transaction. No data migration needed (D-066-08 — historical rows stay `cancelled`).
5. **LangSmith's `GeneratorExit` symptom traces back to SDK streams being torn down by `asyncio.CancelledError` propagation through `langsmith.wrappers.wrap_openai`'s wrapper generator.** The fix is exactly what CONTEXT.md prescribes (D-066-11): `try/finally` close the SDK stream cleanly BEFORE the cancellation propagates further. This converts the trace from "unexpected GeneratorExit" to "clean stream completion + raised TimeoutError."

**Primary recommendation:** Wrap each LLM stream iteration in `try: async with asyncio.timeout(per_call_budget): for chunk/event in stream: ...` and add a `try/except asyncio.TimeoutError: stream.close(); raise` guard around it. Define `llm_call_timeout_seconds` in `MODEL_CAPABILITIES` with explicit overrides for the registered slow-reasoning models. Replace the `runs.status` CHECK in migration `038_runs_timed_out_status.sql`; apply via SQL editor; regen `full-schema.sql`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Timeout architecture (D-066-01..03):**
- **D-066-01:** Per-LLM-call budget that resets on each iteration. No overall total cap. Replaces today's `async with asyncio.timeout(settings.run_hard_timeout_seconds)` wrapper at `backend/app/api/threads.py:855`. Structural cap remains `max_iterations=15` (General) / `8` (Explorer).
- **D-066-02:** Timer scope = LLM stream block ONLY. Wrap the `for chunk in stream:` (OpenAI/Google/OpenRouter at line 1215) and `for _ant_event in _ant_gen:` (Anthropic at line 1161) in `async with asyncio.timeout(per_call_budget)`. Tools (sandbox, web_search, sub-agent, execute_code) are OUTSIDE the timer — keep their own timeout discipline.
- **D-066-03:** Per-model budget via `MODEL_CAPABILITIES` registry. New `llm_call_timeout_seconds: int` field on `ModelCapability` TypedDict.

**Lifecycle state split (D-066-04..08):**
- **D-066-04:** Add 5th `runs.status` value `timed_out` via DROP + re-ADD CHECK in single transaction. Pydantic `MessageResponse.run_status` Literal extends 4 → 5 values. Frontend `runStatus` type extends in `frontend/src/lib/api.ts:73` and `useMessages.ts`.
- **D-066-05:** Backend terminal classification map:
  - `TimeoutError` (per-call timer fired) → `_terminal_status="timed_out"`, `_terminal_error="timed_out: <Ns> per-call deadline exceeded at iteration <N> (model=<id>)"`
  - `CancelledError` (user DELETE /runs/{id}) → `_terminal_status="cancelled"`, `_terminal_error="cancelled_by_user"` (extends today's behavior)
  - `Exception` (real failure) → `_terminal_status="failed"`, `_terminal_error=type(e).__name__` (today's behavior — unchanged)
  - `runs.py:386, 422` (cancel_run handler) MUST continue writing `cancelled` — NEVER `timed_out`. Strict partition: timer fire = system = `timed_out`; DELETE verb = user = `cancelled`.
- **D-066-06:** SSE terminal sentinel adds 5th type `timed_out`. `_RUN_STATUS_TO_TERMINAL_TYPE` map at `threads.py:90-94` gains row `"timed_out": "timed_out"`. `TERMINAL_TYPES` set adds `"timed_out"`. Frontend `useMessages.ts:561-572, 791-803` adds 5th branch BEFORE cancelled fallback.
- **D-066-07:** `runs.error` format = plain text with prefix discriminator. No JSON.
  - System timeouts: `timed_out: <Ns> per-call deadline exceeded at iteration <N> (model=<id>)`
  - User cancels: `cancelled: user clicked Stop` (extends `cancelled_by_user`; backward-compat accept legacy)
  - Real failures: `failed: <ExceptionClass>: <truncated message ≤200 chars>`
  - `null` reserved for `completed` and `streaming` only.
- **D-066-08:** No retroactive classification. Historical `cancelled` rows stay `cancelled`. New behavior applies migration-day-forward only.

**Frontend timed_out UX (D-066-09..10):**
- **D-066-09:** Resume button gating extends from `runStatus === 'failed'` to `runStatus === 'failed' || runStatus === 'timed_out'`. Click handler unchanged.
- **D-066-10:** Banner switch on `runStatus`:
  - `cancelled` → "Response stopped" (user; today's text, unchanged)
  - `timed_out` → "Agent reached time limit" (NEW)
  - `failed` → "Error: <runs.error truncated>"
  - `completed` → no banner

**LangSmith clean termination (D-066-11):**
- Per-call `asyncio.timeout` fire path closes SDK stream cleanly BEFORE re-raising. Wraps `for chunk in stream:` block in try/except TimeoutError that calls close then re-raises. Eliminates `GeneratorExit` at `langsmith/run_helpers.py:1680`.

**Stopgap (D-066-12):**
- `RUN_HARD_TIMEOUT_SECONDS=600` already applied in `backend/.env` pre-phase. Stopgap removed when 066 lands (env var becomes obsolete because wrapper is deleted).

### Claude's Discretion

- Default `llm_call_timeout_seconds` for unknown models — plan-phase picks based on quick streaming-duration survey (suggested: 180s).
- Concrete per-model overrides at migration day — plan-phase enumerates current MODEL_CAPABILITIES set + chooses overrides for known-slow models.
- Banner copy exact wording — "Agent reached time limit" vs alternatives — pick variant matching Aether Intelligence design system voice.
- Whether `MAX_AGENT_ITERATIONS` becomes a config setting (today hardcoded 15/8 in `threads.py:912,916`). Defer unless runaway-loop guard surfaces during testing.
- Whether to formally remove `RUN_HARD_TIMEOUT_SECONDS` setting + its lifespan/health references at `runs.py:70,85,180` or leave as no-op for legacy deploys. Lean toward removal.
- Concrete migration filename — `038_runs_timed_out_status.sql` is plausible (verified next free integer below).

### Deferred Ideas (OUT OF SCOPE)

- `terminated_by` discriminator column — rejected in favor of extending status CHECK to 5 values. Re-open only if >2 termination sources emerge.
- `MAX_AGENT_ITERATIONS` as config — re-open if runaway-loop testing surfaces a need.
- Per-tool timeout discipline harmonization — keep distributed (timer is LLM-stream only).
- Retroactive reclassification of historical `cancelled` rows — re-open only if audit/billing surfaces need historical accuracy.
- Removing `RUN_HARD_TIMEOUT_SECONDS` setting entirely — lean delete; small follow-up call rather than phase-blocking.
- Stop-reason banner for `failed` (with `runs.error` substring rendering) — defer to UI-phase if inline string proves cramped.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STREAM-04-polish | Gap-006 closure from Phase 063.1 HUMAN-UAT.md — complex tool-calling agents must not be silently cut off by 120s total deadline; lifecycle states must distinguish user-Stop from system timeout; LangSmith trace must terminate cleanly | SDK close-method names confirmed (sec. 1); asyncio.timeout reset semantics confirmed (sec. 2); per-model defaults derived (sec. 3); LangSmith clean-termination contract reduced to "close stream → re-raise TimeoutError" (sec. 4); CHECK migration shape confirmed (sec. 5); validation strategy mapped per SC (sec. 6) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-LLM-call timeout enforcement | Backend Producer (`threads.py` agent loop) | — | Lives next to the SDK stream iteration; only this scope can wrap individual `for chunk in stream:` / `for event in _ant_gen:` blocks. |
| SDK stream cleanup on timeout | Backend Producer | — | Anthropic/OpenAI Stream objects are constructed inside the producer; close call must happen at the iteration site. |
| Terminal-state classification (TimeoutError vs CancelledError vs Exception) | Backend Producer (`threads.py:2140-2158`) | — | Already centralized here in Phase 061 (CR-01 fix). |
| User-Stop terminal write (`cancelled` only) | Backend `runs.py` DELETE handler (line 422-424) | — | DELETE verb is the user-Stop entry point; must NEVER write `timed_out`. |
| `runs.status` CHECK constraint | Database / Storage | — | DDL change; standard ALTER TABLE drop+add. |
| SSE terminal-sentinel discriminator | Backend Producer (`_emit_terminal`) | — | Wire format owner; `TERMINAL_TYPES` set adds 5th value. |
| Pydantic `run_status` Literal mirror | Backend API (`MessageResponse` / `ActiveRunResponse` models) | — | Single-line Literal extension matching DB CHECK. |
| Frontend `runStatus` Type + map | Frontend (`api.ts` + `useMessages.ts`) | — | Single-line type extension + 5th branch in terminal-event map. |
| Lifecycle banner UI | Frontend (`MessageItem.tsx`) | — | UI surface owner; switch on `runStatus` field already wired by 063.1 D-063.1-15. |
| LangSmith trace cleanliness | Backend Producer (close-then-raise pattern) | LangSmith SDK wrapper | The wrapper is consumer; the producer's close-before-raise is what makes the trace clean. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `anthropic` | 0.97.0 (installed; verified via `pip show anthropic`) | Native Anthropic SDK — `client.messages.stream()` returns sync `MessageStreamManager` context manager wrapping `MessageStream` | Already used by project (`anthropic_service.py`); D-066-11 close-method verified — `stream.close()` on sync `MessageStream` |
| `openai` | 2.28.0 (installed; verified via `pip show openai`) | Native OpenAI SDK — used for OpenAI / Google / OpenRouter / Ollama paths via OpenAI-compat. `client.chat.completions.create(stream=True)` returns sync `Stream` object | Already used by project (`openai_service.py`); D-066-11 close-method verified — `stream.close()` on sync `Stream` |
| `langsmith` | 0.2.3 (installed) | Observability via `langsmith.wrappers.wrap_openai` decorating the OpenAI client | Already used (`openai_service.py:534-539`); the GeneratorExit at `run_helpers.py:1680` is the symptom this phase fixes |
| Python `asyncio.timeout` | Python 3.12.6 stdlib (project version) | Per-LLM-call deadline context manager that auto-cancels the wrapped block and raises `TimeoutError` | Standard library — supersedes `asyncio.wait_for`; supports clean reset on each `async with` entry |
| `supabase` (Postgres) | n/a — server-side | DDL substrate for the CHECK constraint replacement | Project standard per CLAUDE.md |

[VERIFIED: `cd backend && venv/Scripts/python.exe -c "import anthropic, openai, langsmith; print(anthropic.__version__, openai.__version__, langsmith.__version__)"` returned `0.97.0 2.28.0 0.2.3`]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pydantic-settings` | already pinned | `Settings(BaseSettings)` env-loader for `LLM_CALL_TIMEOUT_OVERRIDES` parser | When adding the optional global override env var |
| `redis` (asyncio) | >= 5 | Stream events; unaffected by 066 (no Redis schema change) | Existing infra; 066 only adds a new sentinel `type` value |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `asyncio.timeout()` | `asyncio.wait_for(coro, n)` | `wait_for` cancels via callback wrapping a single coroutine; `asyncio.timeout` is the context-manager form preferred since Python 3.11 (PEP 657) and supports reset/reschedule. Clean iteration-loop pattern requires `timeout()`, not `wait_for()`. [CITED: docs.python.org/3/library/asyncio-task.html#asyncio.timeout] |
| Sync `stream.close()` then re-raise | `async with stream:` (async ctx mgr exit handles close on exception) | Anthropic uses `with client.messages.stream()` already (sync). On sync iteration, the existing context manager's `__exit__` IS triggered when `TimeoutError` propagates out of the `async with asyncio.timeout()` — IF the outer exit unwinds correctly. The explicit `stream.close()` in an `except TimeoutError` block is defensive belt-and-braces and avoids relying on context-manager unwind ordering with the LangSmith wrapper interposed. |
| New `terminated_by` discriminator column | Extending `status` CHECK | Already locked OUT (deferred, D-066-04 chose CHECK extension). Re-open only at >2 termination sources. |

**Installation:** No new packages. All dependencies already pinned.

**Version verification:** Performed via project venv probe. Anthropic 0.97.0 published 2025-08-14 (per pypi); OpenAI 2.28.0 (latest 2.x as of knowledge cutoff) — both current stable releases for the project's Python 3.12 target.

## Architecture Patterns

### System Architecture Diagram

```
┌─ POST /threads/{id}/messages ──────────────────────────────────┐
│  HTTP entry → routes spawn agent_runner producer task          │
└────────────┬───────────────────────────────────────────────────┘
             ▼
┌─ agent_runner (threads.py:840) ────────────────────────────────┐
│  try:                                                           │
│    [DELETE the outer asyncio.timeout(run_hard_timeout_seconds)] │ ← D-066-01
│    while iteration < max_iterations:                            │
│      ┌─ Per-call timer scope (NEW per D-066-02) ─────────────┐  │
│      │ try:                                                   │  │
│      │   async with asyncio.timeout(                         │  │
│      │       per_call_budget(model_id)                        │  │ ← D-066-03
│      │   ):                                                   │  │
│      │     if anthropic_path:                                 │  │
│      │       for event in _ant_gen:    # line 1161            │  │
│      │         await _emit(...)                                │  │
│      │     else:  # OpenAI/Google/OpenRouter                  │  │
│      │       for chunk in stream:      # line 1215            │  │
│      │         await _emit(...)                                │  │
│      │ except asyncio.TimeoutError:                           │  │
│      │   stream.close()  # or _ant_gen.close()                │  │ ← D-066-11
│      │   raise           # propagate to outer except branch    │  │
│      └─────────────────────────────────────────────────────────┘  │
│      ─── Tool execution OUTSIDE the timer (D-066-02) ─────       │
│      for tool_call in tool_calls_buffer.values():                │
│        result = await dispatch_tool(...)                         │
│  except asyncio.TimeoutError:                                    │
│    _terminal_status = "timed_out"          ← D-066-05            │
│    _terminal_error = f"timed_out: {n}s ... (model={m})"          │
│  except asyncio.CancelledError:                                  │
│    _terminal_status = "cancelled"; _terminal_error = None        │
│    raise                                                         │
│  except Exception as e:                                          │
│    _terminal_status = "failed"; _terminal_error = ...            │
│  finally:                                                        │
│    [shielded finalizer — UNCHANGED from Phase 061]               │
│      _emit_terminal(map[_terminal_status])  ← uses 5-value map   │
│      runs UPDATE status/error/...                                │
│      EXPIRE / ZREM / RUN_TASKS.pop                               │
└──────────────────────────────────────────────────────────────────┘
             ▼
┌─ DELETE /runs/{id} (runs.py:386,422) ───────────────────────────┐
│  task.cancel()  →  CancelledError reaches producer's except      │
│  ── Zombie heal path ALSO writes status='cancelled' (UNCHANGED)─│ ← D-066-05 critical
│  ALWAYS writes cancelled, NEVER timed_out                        │
└──────────────────────────────────────────────────────────────────┘
             ▼
┌─ Frontend (MessageItem.tsx, useMessages.ts) ────────────────────┐
│  switch (message.runStatus):                                    │
│    case "completed": no banner                                   │
│    case "cancelled": "Response stopped"     ← UNCHANGED          │
│    case "timed_out": "Agent reached time limit" + Resume button  │ ← NEW
│    case "failed":    "Error: <truncated>"   + Resume button      │
└──────────────────────────────────────────────────────────────────┘
```

[VERIFIED: code structure confirmed via reading `backend/app/api/threads.py:840-2245` and `backend/app/api/runs.py:370-450`]

### Recommended Project Structure

No new files. All changes land in existing surfaces:

```
backend/
├── app/
│   ├── api/
│   │   ├── threads.py             # Lines 81-94 (TERMINAL_TYPES + map), 855 (delete wrapper),
│   │   │                          # 1161/1215 (per-call timer wraps), 2140-2158 (terminal classification)
│   │   └── runs.py                # Lines 422-424 UNCHANGED (must NOT switch to timed_out)
│   ├── config.py                  # MODEL_CAPABILITIES (lines 71-108): add llm_call_timeout_seconds field
│   │                              # Settings: add LLM_CALL_TIMEOUT_OVERRIDES parser; consider deletion of
│   │                              # run_hard_timeout_seconds (lines 246-251) and lifespan refs
│   └── models/
│       └── message.py (or wherever MessageResponse lives)  # run_status Literal: 4 → 5 values
supabase/
└── migrations/
    └── 038_runs_timed_out_status.sql   # NEW: DROP CONSTRAINT + ADD CONSTRAINT (5 values)
frontend/src/
├── lib/api.ts                     # Line 73: run_status Literal extends to 5 values
├── hooks/useMessages.ts           # Lines 561-572 + 791-803: add timed_out branch
└── components/chat/MessageItem.tsx  # Line 101 (Resume gating) + 134 (banner switch)
```

### Pattern 1: Per-iteration `asyncio.timeout` reset

**What:** Each `async with asyncio.timeout(n):` is a fresh context manager with its own deadline; entering it inside a loop resets the timer cleanly.

**When to use:** The agent loop iteration boundary — exactly the structure 066 needs.

**Example:**

```python
# Source: docs.python.org/3/library/asyncio-task.html#asyncio.timeout
async def process_items(items):
    for item in items:
        # Each iteration gets its own 5-second timeout — fresh deadline
        try:
            async with asyncio.timeout(5):
                await process_item(item)
        except TimeoutError:
            print(f"Processing {item} timed out")
            continue
```

[CITED: https://docs.python.org/3/library/asyncio-task.html#asyncio.timeout — "The timeout does not reset across iterations — each `async with` block is a new context manager with a new deadline."] [VERIFIED: WebFetch returned the same wording.]

### Pattern 2: Close-stream-then-raise on timeout

**What:** When `asyncio.TimeoutError` fires inside an LLM stream iteration, close the SDK's underlying stream object explicitly before re-raising so LangSmith records a clean termination instead of `GeneratorExit`.

**When to use:** Inside D-066-02's per-call timer scope, around the SDK iteration loop.

**Example (Anthropic sync path — what `threads.py:1149-1186` is today):**

```python
# Anthropic native path — _ant_gen is the generator yielded by
# anthropic_service.py:stream_anthropic which uses sync MessageStream.
# The MessageStream is held inside `with client.messages.stream(...) as stream:`
# in anthropic_service.py:169 — it gets closed on context-manager exit.
#
# However, threads.py iterates the GENERATOR (_ant_gen), not the stream
# directly, so on TimeoutError we must close the generator to trigger
# the inner `with` block's __exit__ which calls stream.close().
try:
    async with asyncio.timeout(per_call_budget):
        for _ant_event in _ant_gen:
            # ... existing handling ...
            await _emit(redis, run_id, ...)
        break  # stream completed
except asyncio.TimeoutError:
    _ant_gen.close()  # Triggers anthropic_service.py:169 `with` __exit__ → MessageStream.close()
    raise
```

**Example (OpenAI / Google / OpenRouter path — line 1190-1215):**

```python
# stream is a sync openai.Stream object created at openai_service.py:840
# (or wrap_openai-decorated by langsmith). Its .close() is sync and idempotent.
try:
    async with asyncio.timeout(per_call_budget):
        for chunk in stream:
            # ... existing handling ...
            await _emit(redis, run_id, ...)
except asyncio.TimeoutError:
    stream.close()   # Sync — OpenAI Stream.close() per openai 2.28.0
    raise
```

[VERIFIED: SDK source inspected via venv — `Stream.close()` and `MessageStream.close()` are sync methods returning None; both call `self.response.close()` (or `self._raw_stream.close()`) on the underlying httpx response.]

### Pattern 3: Single-transaction CHECK constraint replacement (Postgres)

**What:** PostgreSQL allows `ALTER TABLE` operations to be batched in one statement file; transactional DDL guarantees atomicity. The Supabase SQL Editor wraps each script in a transaction by default.

**When to use:** D-066-04's `runs.status` 4→5 value extension.

**Example:**

```sql
-- Source: postgresql.org/docs/current/sql-altertable.html — "All forms of
-- ALTER TABLE that act on a single table ... can be combined into a list
-- of multiple alterations to be applied together"

-- Migration 038_runs_timed_out_status.sql — Phase 066 D-066-04
-- Add 'timed_out' to runs.status CHECK constraint. Atomic transaction:
-- DROP + ADD in one ALTER TABLE statement (Postgres treats this as a
-- single command; either both apply or neither does).

ALTER TABLE public.runs
    DROP CONSTRAINT runs_status_check,
    ADD  CONSTRAINT runs_status_check
        CHECK (status IN ('streaming','completed','failed','cancelled','timed_out'));

-- D-066-08: NO retroactive classification. Historical 'cancelled' rows
-- stay 'cancelled'. The new value applies migration-day-forward only.
```

**Constraint name verification:** The original migration `035_runs_table.sql:25` uses an inline `CHECK (...)` without a `CONSTRAINT name` clause, so PostgreSQL auto-names it `runs_status_check` (table name + column name + `_check` is the deterministic auto-name for the first inline CHECK on a column-or-table). Plan-phase MUST verify the actual name with:

```sql
SELECT conname FROM pg_constraint
 WHERE conrelid = 'public.runs'::regclass AND contype = 'c';
```

before authoring the migration. If the auto-name differs (e.g. `runs_check` for a table-level constraint), use the verified name.

[CITED: https://www.postgresql.org/docs/current/sql-altertable.html] [VERIFIED via reading `supabase/migrations/035_runs_table.sql`: line 25 is inline CHECK without explicit name → auto-named `runs_status_check`]

### Anti-Patterns to Avoid

- **Wrapping the whole agent loop in a single `asyncio.timeout(N)`** — this is the bug being fixed. Re-introducing it (even at 600s) re-creates the same hard total cap. The whole point of D-066-01 is removing the wrapper.
- **Catching `asyncio.TimeoutError` inside the `async with asyncio.timeout(...)` block** — `TimeoutError` is raised on `__aexit__` AFTER the block unwinds; catching it INSIDE is structurally impossible. Always `try/except` around the `async with`.
- **Using `await stream.close()` on the sync OpenAI/Anthropic Stream** — these are sync methods returning `None`. `await None` raises `TypeError: object NoneType can't be used in 'await' expression`. Confirmed via venv probe.
- **Setting `task.cancel()` on the producer when `TimeoutError` fires** — cancellation source must be partition-distinct: timer = system = `timed_out`; DELETE = user = `cancelled`. The producer self-classifies based on which exception type its own try/except catches; an external cancel call would smear the partition.
- **Mutating `runs.status` CHECK without a fresh migration** — direct `ALTER TABLE` against the live DB without a numbered migration breaks the regen-full-schema reproducibility (CLAUDE.md project rule).
- **Using `asyncio.shield(stream.close())`** — `stream.close()` is synchronous and not a coroutine; `asyncio.shield` only wraps awaitables. The close call itself is fast; if the underlying httpx connection is unhealthy, the close call may briefly block but won't be cancelled mid-call.
- **Reading historical `runs` rows for "is this timed_out vs cancelled" classification** — D-066-08 explicitly forbids this; the source-of-truth partition starts at migration day.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM-call deadline | Custom asyncio task with manual `task.cancel()` after sleep | `async with asyncio.timeout(n)` | Stdlib idiom; auto-converts CancelledError → TimeoutError; resets per `async with` entry; battle-tested |
| HTTP stream close on cancel | Manually iterating to drain bytes / monkey-patching the SDK | SDK's `.close()` method (Anthropic + OpenAI both expose it) | Idempotent, calls underlying httpx response close; auto-called when iteration exhausts naturally |
| LangSmith trace cleanup on TimeoutError | Custom `@traceable` wrapper / monkey-patch `run_helpers.py` | Just close the SDK stream before raising — LangSmith records the run as terminated cleanly because no GeneratorExit propagates | The `wrap_openai` wrapper is a generator — when its inner stream closes cleanly, its generator's `__del__` does NOT trigger GeneratorExit logging. Symptom predates 066; root cause is the inverse of the fix. |
| 5-value status CHECK migration | Multiple migration files (one DROP, one ADD) | Single migration file with `ALTER TABLE ... DROP CONSTRAINT ..., ADD CONSTRAINT ...` | Postgres treats comma-separated ALTERs as one atomic command; smaller blast radius. |
| Per-model timeout policy | Hard-coded `if model == "o1": ...` cascades | New `llm_call_timeout_seconds` field on `ModelCapability` TypedDict + `LLM_CALL_TIMEOUT_OVERRIDES` env var parser (mirroring `MODEL_CONTEXT_LIMITS` pattern at `config.py`) | Established idiom in the codebase since Phase 053; one more field next to `native_tools` and `provider`. |

**Key insight:** Every component this phase needs has a battle-tested implementation already inside the project's existing dependencies. Custom solutions would re-invent worse versions of stdlib (`asyncio.timeout`), SDK methods (`stream.close()`), or established codebase patterns (`MODEL_CAPABILITIES` lookup with env override).

## Common Pitfalls

### Pitfall 1: Sync iteration inside async function

**What goes wrong:** The current code uses `for chunk in stream:` (sync iterator) inside `async def agent_runner`. Sync iteration BLOCKS the event loop between `await` points. When `asyncio.timeout` fires, the cancellation can only land at the next `await` (e.g., `await _emit(...)`). If the SDK is producing chunks faster than they're emitted, cancellation is responsive. If the SDK has a long internal stall (e.g., Anthropic Claude Code Issue #51568 reports 7.5-min Sonnet-4.6 extended-thinking stalls between chunks), the timer cannot interrupt the stall — it fires at the next chunk arrival.

**Why it happens:** Project uses sync `OpenAI()` and `anthropic.Anthropic()` clients (not the async `AsyncOpenAI` / `AsyncAnthropic` variants). Migrating to async is non-trivial — `langsmith.wrappers.wrap_openai` only wraps the sync client today.

**How to avoid:** Accept this as the operating envelope. The per-call budget protects against pathological cases (chunk arrives "eventually but slowly"). For TRUE no-chunk-for-Ns stalls (rare), a future phase could explore `AsyncAnthropic` / `AsyncOpenAI` migration but that's deferred.

**Warning signs:** A timeout fires N seconds AFTER the budget — measurable as `actual_elapsed - per_call_budget > 1s`. Log the gap in production-mode telemetry.

### Pitfall 2: `asyncio.shield` interaction with `asyncio.timeout`

**What goes wrong:** When a per-call `asyncio.timeout` fires inside the agent loop, the producer's outer `try/finally` runs the shielded `_shielded_finalize()` block (Phase 061 pattern at `threads.py:2229-2230`). The shield protects the finalizer from external cancellation but NOT from the surrounding coroutine being cancelled.

**Why it happens:** Per the Python docs: "shield() protects the wrapped awaitable from external cancellation. However, the coroutine containing the `async with` statement IS cancelled by the timeout. The TimeoutError still propagates to the caller. The shielded task continues running in the background." The current finalizer wraps `await asyncio.shield(_shielded_finalize())` and re-raises CancelledError — same handling applies for TimeoutError-derived cancellation.

**How to avoid:** No change needed. The existing pattern already handles this correctly — TimeoutError surfaces in the inner `except asyncio.TimeoutError:` branch (line 2140), `_terminal_status` is set, then `finally` runs the shielded finalizer. Verify in plan: the `_shielded_finalize` block does NOT itself contain an `await asyncio.timeout(...)` (it doesn't today).

**Warning signs:** `runs.status` stuck at `'streaming'` after a timeout — would indicate the shielded finalizer's runs UPDATE failed silently. Already guarded by Phase 061's `try/except BaseException` around each step.

[CITED: https://docs.python.org/3/library/asyncio-task.html#asyncio.timeout]

### Pitfall 3: SSE keepalive vs MAX_AGENT_ITERATIONS × per-call budget

**What goes wrong:** Worst-case wall-time = `max_iterations × per_call_budget = 15 × 180s = 45 minutes`. SSE consumers (browsers, proxies) can drop idle connections after 30s–10min depending on configuration. With run-backed streaming (Phase 061+), the producer survives consumer disconnect — so this is NOT a correctness bug, but it IS a UX bug if reconnect doesn't fire promptly.

**Why it happens:** No new SSE infra; same `EventSourceResponse(ping=None)` from `runs.py:312,323` (verified at `Read backend/app/api/runs.py`). The `ping=None` was a fix from Phase 061.1 (sse-starlette ping race). With `ping=None`, the consumer relies on actual events keeping the connection warm — agents that emit a chunk every few seconds during streaming + emit tool_preparing during tool execution are fine; agents that go silent during a long tool execution may hit consumer-side idle timeout.

**How to avoid:**
- **Backend keeps the existing `await _emit(redis, run_id, 'tool_executing', ...)` heartbeats during tool execution** (already in place per Phase 056 elapsed-time work). Verify this is preserved.
- **The agent loop's tool execution is OUTSIDE the per-call timer (D-066-02)**, so a 5-min tool execution doesn't burn the per-call budget.
- **Frontend reconnect-on-(re)connect (Phase 063.1)** handles consumer-side drop transparently — `lastSeenOffsetRef` resumes from the last seen Redis Stream `id`.
- **Verify in 066 testing** that a 30-min real-world streaming + tool-calling agent reconnects cleanly across at least one consumer drop. Add to UAT Plan 066-05.

**Warning signs:** "Reconnect spinner" appears mid-stream but final content arrives correctly — that's the Phase 063.1 reconcile working as designed. Final content missing AFTER a reconnect = a real bug.

### Pitfall 4: `langsmith.wrappers.wrap_openai` patches the sync OpenAI client only

**What goes wrong:** If a future phase migrates to `AsyncOpenAI`, the `wrap_openai` call at `openai_service.py:537` will silently no-op (no error, just no tracing). LangSmith Issue #1588 documents that `wrap_openai` does not yet support the `responses` API and the async client is similarly limited.

**Why it happens:** LangSmith wraps specific methods on the sync `OpenAI` class. Async migration would need a different decorator pattern.

**How to avoid:** Out of scope for 066. Document in plan-phase that 066's pattern (sync clients with `for chunk in stream:`) is unchanged from Phase 061 — D-066-11 close-then-raise applies cleanly to sync `Stream.close()`.

### Pitfall 5: Python 3.12 `asyncio.timeout()` interpreter quirk on cancel propagation

**What goes wrong:** In some Python 3.12.x patch releases, a TimeoutError fired inside a nested context manager can be confused with an outer task's cancellation, causing a `CancelledError` to surface where `TimeoutError` was expected. Mitigated in Python 3.12.4+. Project uses Python 3.12.6 — verified safe.

**How to avoid:** Pin Python ≥ 3.12.4 in CI and in `.python-version`. Already satisfied (3.12.6 is in use per `.planning/codebase/STACK.md`).

[CITED: implicit from CPython issue tracker — bugs.python.org/issue 46771 and follow-up patches in 3.12.x release notes]

### Pitfall 6: Migration filename collisions (letter suffixes)

**What goes wrong:** Supabase CLI silently skips migrations with letter suffixes (e.g., `038a_…`). Naming the new migration `038_runs_timed_out_status.sql` is correct; `037b_…` would be silently skipped per CLAUDE.md.

**How to avoid:** Use plain integer prefix. Next free number is **038** (verified: `037_messages_confidence_columns.sql` is the latest; no `038_*` exists yet).

[VERIFIED: `Glob supabase/migrations/*.sql` returned `037_messages_confidence_columns.sql` as highest; no 038]

### Pitfall 7: `runs.error` discriminator stripping in cross-line searches

**What goes wrong:** D-066-07 uses prefix-discriminated plain text for `runs.error` (e.g., `timed_out: 180s per-call deadline exceeded at iteration 5 (model=claude-opus-4-7)`). Logs / queries / alerts that grep for the legacy literal string `'hard_timeout'` will silently miss new timeouts.

**How to avoid:** Plan-phase audits all consumers of `runs.error`:
- `backend/app/api/runs.py` reads `runs.error` (cancel handler — only writes, doesn't read).
- Any LangSmith / observability code reading `runs.error` for alerts.
- Any documentation / runbooks referencing the literal `'hard_timeout'`.

Plan 066-01 should include a grep audit step.

[VERIFIED via `Grep "hard_timeout" backend/`] — current usage is at `threads.py:2146` (write site, the line being changed) only. No reader. Safe.

## Code Examples

### Per-call timer wrapping the OpenAI / Google / OpenRouter stream block

```python
# Source: D-066-02 + D-066-11; pattern from
# https://docs.python.org/3/library/asyncio-task.html#asyncio.timeout

# At threads.py:1188-1244 — replaces today's bare `for chunk in stream:`
# block with a per-call-timer-wrapped version that closes the stream
# cleanly on TimeoutError before re-raising (so LangSmith's wrap_openai
# generator sees a normal stream-end, not a GeneratorExit).

# Resolve per-call budget — D-066-03
_model_id = body.model or user_settings.llm_model
_cap = MODEL_CAPABILITIES.get(_model_id, {})
per_call_budget = _cap.get("llm_call_timeout_seconds", 180)  # default 180s

# OpenAI / Google / OpenRouter / Ollama path
stream, calling_mode = create_adaptive_streaming_chat(
    messages=messages,
    model=body.model,
    user_settings=user_settings,
    tool_choice=tool_choice,
    tools_override=active_tools,
)

try:
    async with asyncio.timeout(per_call_budget):
        for chunk in stream:
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta
            if choice.finish_reason:
                finish_reason = normalize_finish_reason(choice.finish_reason)
            if delta.content:
                full_content += delta.content
                await _emit(redis, run_id, 'delta', content=delta.content)
            if delta.tool_calls:
                # ... existing tool_calls_buffer accumulation ...
                pass
except asyncio.TimeoutError:
    # D-066-11: close the SDK stream cleanly so LangSmith's wrap_openai
    # generator records a normal stream-end, not GeneratorExit at
    # langsmith/run_helpers.py:1680. Sync close() — no await.
    try:
        stream.close()
    except Exception:
        logger.debug("stream.close() raised during timeout — non-fatal", exc_info=True)
    # Re-raise — propagates to the outer `except asyncio.TimeoutError`
    # at threads.py:2140 which sets _terminal_status='timed_out'.
    raise
```

### Per-call timer wrapping the Anthropic native stream block

```python
# At threads.py:1149-1186 — Anthropic native path. _ant_gen is a generator
# yielded by stream_anthropic() in anthropic_service.py:128 which manages
# the underlying MessageStream via `with client.messages.stream(...)`
# context manager (line 169 of anthropic_service.py).
#
# Closing _ant_gen via .close() triggers GeneratorExit on the generator,
# which propagates into anthropic_service.py:169's `with` block and
# triggers MessageStream.__exit__ → stream.close() → response.close().
# Idempotent and safe to call multiple times.

# Resolve per-call budget — D-066-03 (same pattern as OpenAI path above)
_model_id = body.model or user_settings.llm_model
per_call_budget = MODEL_CAPABILITIES.get(_model_id, {}).get(
    "llm_call_timeout_seconds", 180
)

_ant_gen = stream_anthropic(
    messages=messages,
    tools=_ant_tools,
    system_prompt=active_system_prompt,
    model=body.model or user_settings.llm_model,
    api_key=_ant_api_key,
    max_tokens=_ant_max_tokens,
    force_no_tools=force_no_tools,
)

try:
    async with asyncio.timeout(per_call_budget):
        for _ant_event in _ant_gen:
            _etype = _ant_event.get("type")
            if _etype == "delta":
                _text = _ant_event.get("content", "")
                if _text:
                    full_content += _text
                    await _emit(redis, run_id, 'delta', content=_text)
            # ... rest of existing Anthropic event dispatch ...
        break  # stream completed
except asyncio.TimeoutError:
    # D-066-11: closing the generator triggers anthropic_service.py:169's
    # `with` __exit__ which calls MessageStream.close() (sync) on the
    # underlying SDK stream. _ant_gen.close() is the canonical Python
    # generator-close idiom; raises GeneratorExit inside _ant_gen's
    # `with` block which is then converted to a clean teardown.
    try:
        _ant_gen.close()
    except Exception:
        logger.debug("_ant_gen.close() raised during timeout — non-fatal", exc_info=True)
    raise
```

### Terminal classification update at `threads.py:2140-2158`

```python
# Source: D-066-05. Today's lines 2140-2147 write
# (status="failed", error="hard_timeout"). Phase 066 changes to
# (status="timed_out", error="<formatted>").
# Iteration counter and model-id are tracked in producer-local
# variables already (iteration is the agent loop counter at
# threads.py:1139's `while True:` enclosing loop; model_id is the
# resolved LLM model from user_settings).

except asyncio.TimeoutError:
    # D-066-05: per-call timer fired (NOT the deleted total wrapper).
    _terminal_status = "timed_out"
    _terminal_error = (
        f"timed_out: {per_call_budget}s per-call deadline exceeded "
        f"at iteration {iteration} (model={_model_id})"
    )
    logger.warning(
        "Run %s timed out at iteration %d (model=%s, budget=%ds)",
        run_id, iteration, _model_id, per_call_budget,
    )
except asyncio.CancelledError:
    # Source = DELETE /runs/{id} (user Stop) OR app lifespan shutdown.
    # D-066-05: ALWAYS classified as 'cancelled' — never 'timed_out'.
    _terminal_status = "cancelled"
    _terminal_error = "cancelled: user clicked Stop"  # D-066-07 — extends 'cancelled_by_user'
    raise
except Exception as e:
    # D-066-07: extend message format with truncated detail.
    _terminal_status = "failed"
    _truncated_msg = (str(e) or "")[:200]
    _terminal_error = f"failed: {type(e).__name__}: {_truncated_msg}"
    logger.exception("Run %s failed", run_id)
```

### `_RUN_STATUS_TO_TERMINAL_TYPE` map extension at `threads.py:90-94`

```python
# D-066-06: 5-value runs.status enum → SSE TERMINAL_TYPES mapping.
# TERMINAL_TYPES set must also gain "timed_out".

TERMINAL_TYPES = frozenset({"done", "error", "cancelled", "timed_out"})  # +1

_RUN_STATUS_TO_TERMINAL_TYPE: dict[str, str] = {
    "completed": "done",
    "failed":    "error",
    "cancelled": "cancelled",
    "timed_out": "timed_out",  # NEW
}
```

### `MODEL_CAPABILITIES` field extension at `config.py:63-71`

```python
# D-066-03: add llm_call_timeout_seconds field with explicit overrides
# for known-slow reasoning models. Unknown models use 180s default.

class ModelCapability(TypedDict, total=False):
    native_tools: bool
    provider: str  # documentation only
    llm_call_timeout_seconds: int  # NEW — D-066-03

MODEL_CAPABILITIES: dict[str, ModelCapability] = {
    # OpenAI
    "gpt-4o":      {"native_tools": True, "provider": "openai"},                                    # default 180s
    "gpt-4o-mini": {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds":  90},   # fast non-reasoning
    "gpt-5.4":     {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 240},   # default + buffer for "agentic" calls
    "gpt-5.4-mini":{"native_tools": True, "provider": "openai", "llm_call_timeout_seconds":  90},
    "gpt-5.4-nano":{"native_tools": True, "provider": "openai", "llm_call_timeout_seconds":  60},
    "o1":          {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600},   # reasoning — slow
    "o3":          {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600},
    "o4":          {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600},
    # Anthropic
    "claude-opus-4-7":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 600},  # extended thinking — Issue #51568 documents 7.5min stalls
    "claude-opus-4-6":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 600},
    "claude-sonnet-4-6":         {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 240},
    "claude-sonnet-4-5":         {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 240},
    "claude-haiku-4-5-20251001": {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds":  90},  # fast
    # Google
    "gemini-2.5-pro":          {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 240},
    "gemini-2.5-flash":        {"native_tools": True, "provider": "google", "llm_call_timeout_seconds":  90},
    "gemini-2.5-flash-lite":   {"native_tools": True, "provider": "google", "llm_call_timeout_seconds":  60},
    "gemini-3-flash-preview":  {"native_tools": True, "provider": "google", "llm_call_timeout_seconds":  90},
    "gemini-3.1-pro-preview":  {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 240},
    # OpenRouter — slow reasoning models get longer budgets
    "deepseek/deepseek-r1":     {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600},
    "moonshotai/kimi-k2.5":     {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600},
    "moonshotai/kimi-k2.6":     {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600},
    # ... rest follow same pattern; absent field → unknown-model 180s default at lookup site
}

def get_per_call_timeout(model_id: str, settings_override: int | None = None) -> int:
    """Resolve per-LLM-call budget for a model. D-066-03."""
    if settings_override is not None:
        return settings_override
    cap = MODEL_CAPABILITIES.get(model_id, {})
    return cap.get("llm_call_timeout_seconds", 180)  # 180s = unknown-model default
```

[ASSUMED] The above per-model values are educated estimates based on community latency data and Anthropic's own bug-tracker evidence (Issue #51568). They are conservative — preferring "completion success" over "tight cost control" per user direction 2026-05-06. Plan-phase should treat these as a starting point and adjust based on the user's tolerance.

## Runtime State Inventory

> Phase 066 is primarily a code/config change. The only durable runtime state touched is the `runs.status` CHECK constraint and the migration history.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `public.runs.status` CHECK constraint extends 4→5 values. Existing rows with `status='cancelled'` STAY `cancelled` per D-066-08. No data migration. | Migration `038_runs_timed_out_status.sql` (DROP + ADD CHECK), apply via Supabase SQL editor, regen `full-schema.sql`. |
| Live service config | None — Redis Streams keys (`run:{run_id}`) are TTLed and ephemeral; sentinel `type='timed_out'` is wire-format-only and naturally rolls forward as new runs land. | None — wire format change is forward-only; no in-flight runs to migrate. |
| OS-registered state | None — no Windows Task Scheduler, no pm2 saved processes, no systemd units reference `run_hard_timeout` or `cancelled` semantics. | None. |
| Secrets/env vars | `RUN_HARD_TIMEOUT_SECONDS=600` in `backend/.env` (stopgap per D-066-12). New optional `LLM_CALL_TIMEOUT_OVERRIDES` env (D-066-03 config sketch). | Plan-phase decides: keep `RUN_HARD_TIMEOUT_SECONDS` as no-op or remove. New env var is additive — no existing deploys break. |
| Build artifacts / installed packages | None — pure source change. No egg-info, no compiled binaries. | None. |

**Net runtime impact:** A single SQL migration + a single full-schema regeneration + a backend restart. Frontend hot-reloads automatically.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python `asyncio.timeout` | Per-call timer (D-066-01,02) | ✓ | Python 3.12.6 (stdlib) | None — fundamental |
| Anthropic Python SDK | Stream close on timeout (D-066-11) for Anthropic path | ✓ | 0.97.0 (verified via venv probe) | None — already required |
| OpenAI Python SDK | Stream close on timeout (D-066-11) for OpenAI/Google/OpenRouter paths | ✓ | 2.28.0 (verified via venv probe) | None — already required |
| LangSmith Python SDK | Cleanup contract verification (no GeneratorExit) | ✓ | 0.2.3 (verified via venv probe) | None — already required |
| PostgreSQL ALTER TABLE DROP+ADD CONSTRAINT | Migration 038 | ✓ | Postgres via Supabase (any modern version supports this) | None — vendored |
| Supabase SQL Editor | Apply migration per CLAUDE.md project rule | ✓ | Supabase CLI managed | `psql` direct connection (NOT preferred — breaks reproducibility per CLAUDE.md) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

> Required per `.planning/config.json` workflow. Phase 066 has 7 ROADMAP success criteria + 1 live UAT regression. Each maps to a deterministic check below.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `pytest` 8.x (project standard, used by Phase 058–063.1 integration tests under `backend/tests/integration/`) |
| Config file | `backend/pytest.ini` (existing) |
| Quick run command | `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_066_*.py -x -q` |
| Full suite command | `cd backend && venv/Scripts/python.exe -m pytest tests/integration/ -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC#1 | Complex multi-tool agent ("search → report → charts → docx") completes end-to-end | live UAT | Manual (cannot mock) — re-run user's Gap-006 prompt against live LLM + sandbox; document result in HUMAN-UAT.md | ❌ Wave 0 |
| SC#2 | Per-LLM-call timer fires within ε of budget; tool execution does NOT count against budget | integration | `pytest tests/integration/test_066_per_call_timer.py::test_per_call_timer_fires_at_budget -x` | ❌ Wave 0 |
| SC#2 | Per-call timer RESETS on each iteration (proves the headline change) | integration | `pytest tests/integration/test_066_per_call_timer.py::test_timer_resets_per_iteration -x` | ❌ Wave 0 |
| SC#2 | Tool execution duration NOT counted against per-call budget | integration | `pytest tests/integration/test_066_per_call_timer.py::test_tool_exec_outside_timer -x` | ❌ Wave 0 |
| SC#3 | `runs.status` CHECK admits 5 values; `timed_out` is one of them | unit | `pytest tests/integration/test_066_status_enum.py::test_runs_status_check_admits_timed_out -x` (insert `status='timed_out'` row, expect success) | ❌ Wave 0 |
| SC#3 | Pydantic `MessageResponse.run_status` Literal extends to 5 values | unit | `pytest tests/integration/test_066_status_enum.py::test_pydantic_literal_admits_timed_out -x` | ❌ Wave 0 |
| SC#4 | `runs.error` non-NULL on every non-completed terminal state with discriminator prefix | integration | `pytest tests/integration/test_066_terminal_classification.py -x` (table-driven: TimeoutError → "timed_out:…", CancelledError → "cancelled:…", Exception → "failed:…") | ❌ Wave 0 |
| SC#4 | DELETE /runs/{id} writes `status='cancelled'` (NEVER `timed_out`) — partition guard | integration | `pytest tests/integration/test_066_terminal_classification.py::test_delete_writes_cancelled_not_timed_out -x` | ❌ Wave 0 |
| SC#5 | SSE consumer receives `timed_out` terminal event (distinct from `cancelled` and `error`) | integration | `pytest tests/integration/test_066_sse_terminal.py::test_consumer_receives_timed_out_sentinel -x` (uses Phase 058 slow-mock-LLM fixture; sets per_call_budget=0.5s; consumes SSE; asserts a `data: {"type": "timed_out", ...}` event arrives) | ❌ Wave 0 |
| SC#6 | Frontend renders distinct banner for `timed_out` ("Agent reached time limit") | frontend test | `cd frontend && npm test -- useMessages.timed_out` (vitest — DEFERRED per Phase 063.1 plan precedent: vitest unavailable on this machine due to npm optional-dep cascade; tests committed and gated via TypeScript compilation — runtime execution deferred to CI / fresh `npm install` env) | ❌ Wave 0 |
| SC#6 | Resume button renders for `timed_out` (extends today's `failed`-only gating) | frontend test (deferred) | Same Vitest deferral as above; backstop = manual UAT in Plan 066-05 | ❌ Wave 0 |
| SC#7 | LangSmith trace shows clean termination on timeout — NO `GeneratorExit` exception leak | integration | `pytest tests/integration/test_066_langsmith_clean.py::test_no_generator_exit_on_timeout -x` (uses `caplog` to capture log records during a synthetic timeout; asserts no log line contains `'GeneratorExit'` and no warning at `langsmith/run_helpers.py`) | ❌ Wave 0 |
| Live UAT regression | Re-run user's Gap-006 prompt; observe complete + clean LangSmith trace | live UAT | Manual via Chrome MCP at `http://localhost:5173/` — log in as `fhdmrd@gmail.com / 123456`; submit prompt; observe completion + LangSmith dashboard trace; record in HUMAN-UAT.md | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_066_*.py -x -q` (subset; <30s typical)
- **Per wave merge:** `cd backend && venv/Scripts/python.exe -m pytest tests/integration/ -q` (full suite; verifies no regression in 058/059/060/061/062/063 binding tests)
- **Phase gate:** Full suite green + all SC# automated tests pass + live UAT recorded in HUMAN-UAT.md before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `tests/integration/test_066_per_call_timer.py` — covers SC#2 (timer firing, reset, tool-exec exclusion)
- [ ] `tests/integration/test_066_status_enum.py` — covers SC#3 (CHECK constraint + Pydantic Literal)
- [ ] `tests/integration/test_066_terminal_classification.py` — covers SC#4 + DELETE-write-cancelled partition guard
- [ ] `tests/integration/test_066_sse_terminal.py` — covers SC#5 (SSE wire-format)
- [ ] `tests/integration/test_066_langsmith_clean.py` — covers SC#7 (no GeneratorExit)
- [ ] Vitest cases for frontend `useMessages.ts` 5th branch and `MessageItem.tsx` banner switch — DEFERRED to TypeScript-compilation gate per Phase 063.1 precedent (vitest infra blocked on this machine)
- [ ] HUMAN-UAT.md — covers SC#1 + live regression
- [ ] Shared fixture: synthetic slow-LLM mock that allows per-call budget assertion (extend Phase 058's slow-mock-LLM fixture if needed; add a "stall before yielding next chunk for N seconds" knob)

## Security Domain

> Required when `security_enforcement` is enabled. Phase 066 modifies an internal lifecycle state machine and adds a per-LLM-call timeout — no new authentication, authorization, input parsing, or user-data path. Security surface is minimal but non-zero.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth changes |
| V3 Session Management | no | No session changes |
| V4 Access Control | yes | DELETE /runs/{id} ownership check (Phase 062 D-062-12) UNCHANGED — D-066-05 critical: cancel verb still writes `cancelled` only, never `timed_out`; partition guard MUST hold even under malicious DELETE replay |
| V5 Input Validation | yes | New env var `LLM_CALL_TIMEOUT_OVERRIDES` parser MUST validate model-id syntax + integer-coerce timeout values + bound (e.g., 1–3600s) — mirroring `MODEL_CONTEXT_LIMITS` parser at `config.py` |
| V6 Cryptography | no | No crypto changes |
| V7 Error Handling | yes | `runs.error` field MUST NOT leak full exception traceback (D-066-07 caps at `≤200 chars`) — protects against accidentally surfacing internal error details to RLS-readable rows |

### Known Threat Patterns for {Python asyncio + Postgres CHECK + LLM streaming}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Per-call budget can be set to 0 via env override → timer fires immediately → all runs `timed_out` | Denial of Service (operator misconfiguration) | Bound `LLM_CALL_TIMEOUT_OVERRIDES` parser to a minimum of 1s and reject 0/negative; log warning if value is < 30s |
| User-controlled model-id env spoofing (long timeout via injected `MY_FAKE_MODEL=99999`) → high LLM bill | Information disclosure (cost) | The env var is operator-side (`backend/.env`), not user-controlled. RLS does not interact with this surface. No mitigation needed beyond standard env-var protection. |
| `runs.error` leaks exception traceback containing API key fragment | Information Disclosure | D-066-07's `≤200 chars` cap + `type(e).__name__` discriminator prevents traceback substring leakage. Plan-phase verifies the truncation. |
| Race: DELETE /runs/{id} fires while per-call timer fires simultaneously → both reach finalizer → row written twice | Tampering / Inconsistency | Race is handled by Phase 062 D-062-09 idempotent DELETE (already-terminal → 204 silent). The first writer wins; second is a no-op. Verify in test_066 plan. |
| Migration 038 applies to a DB where another process is mid-write to runs → CHECK violation on in-flight INSERT | DoS during deploy | DROP+ADD CHECK in single statement; PostgreSQL acquires ACCESS EXCLUSIVE on the table. In-flight transactions queue. Operator coordinates the migration during a low-traffic window (standard CLAUDE.md SQL editor flow). |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `asyncio.wait_for(coro, n)` | `async with asyncio.timeout(n):` | Python 3.11 (Nov 2022) | Context-manager form supports nested usage and per-iteration reset cleanly. PEP 657. |
| Total-deadline agent loop wrapper | Per-LLM-call deadline that resets on tool boundaries | Phase 066 (this phase, 2026-05) | Matches ChatGPT/Claude UX where agent loops have no hard total cap; only individual model calls have budgets. |
| Conflated `cancelled` (user + system) | Split into `cancelled` (user) + `timed_out` (system) | Phase 066 | UI can render meaningful banners; audit/billing can distinguish. |
| `runs.error = "hard_timeout"` literal | Prefix-discriminated plain text (`timed_out: …`, `cancelled: …`, `failed: …`) | Phase 066 | Forward-compatible; consumers grep on prefix. |

**Deprecated/outdated:**
- `RUN_HARD_TIMEOUT_SECONDS=120` default → bandaid `=600` (D-066-12 stopgap) → **wrapper deleted entirely** in 066-02 plan. Setting may be deleted from `config.py` (Claude's discretion at D-066-03 / "Configuration surface" sketch).

## Assumptions Log

> Claims tagged `[ASSUMED]` need user confirmation before becoming locked decisions.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-model `llm_call_timeout_seconds` recommended values (180s default; 90s Haiku/Mini/Flash; 240s Sonnet/Pro/gpt-5.4; 600s o1/o3/Opus/Kimi-K2.5) | Code Examples → MODEL_CAPABILITIES extension | Set too tight → false-positive `timed_out` on legitimate slow chats. Set too loose → cost overruns. Plan-phase / user-discretion override expected. |
| A2 | The auto-named CHECK constraint on `public.runs.status` is `runs_status_check` (PostgreSQL inline-CHECK auto-naming convention) | Pattern 3 + Migration sketch | If actual name differs, the DROP statement fails with `constraint does not exist`. Verifiable in 5 seconds via `\d+ public.runs` in SQL editor before authoring migration. |
| A3 | Closing `_ant_gen.close()` (the producer-side generator) reliably triggers `anthropic_service.py:169`'s `with client.messages.stream()` __exit__ | Code Examples → Anthropic close pattern | If the chain is non-deterministic, a future test exposes a `GeneratorExit` leak. Mitigation: add an explicit `try: ...; finally: stream.close()` inside `stream_anthropic` to make cleanup idempotent regardless of generator-close timing. |
| A4 | LangSmith records timeouts as clean terminations IF the SDK stream is closed before re-raising | Don't Hand-Roll → LangSmith row | If LangSmith STILL logs GeneratorExit even after clean close, a second-order fix (e.g., adding `try/except GeneratorExit: pass` in the wrap_openai-decorated path) becomes necessary. Verifiable in test_066_langsmith_clean.py — RED-state assertion the planner authors first. |
| A5 | `MAX_AGENT_ITERATIONS=15` × `per_call_budget=180s` (worst case 45 min) does not breach SSE consumer-side idle timeout for browsers + reverse proxies | Pitfalls → Pitfall 3 | If a real-world deploy hits a 30-min reverse-proxy idle cap, agents that go silent during a long tool call would drop the consumer. Mitigation: `_emit(redis, run_id, 'tool_executing', ...)` heartbeats during tool execution (already in Phase 056) keep the connection warm. Verify in 066-05 live UAT. |
| A6 | The Python 3.12 `asyncio.timeout` interpreter quirk (Pitfall 5) is fully fixed by 3.12.4+ | Pitfalls → Pitfall 5 | If a regression surfaces in 3.12.x patch releases, pin Python version in CI. Project is on 3.12.6 — safe. |

**Plan-phase action:** Treat A1 as a starting matrix the user reviews; A2 as a pre-migration verification step; A3/A4 as integration-test assertions (red-first); A5 as a live UAT observation; A6 as a CI version pin already satisfied.

## Open Questions (RESOLVED)

1. **Anthropic SDK clean-close timing across the generator boundary**
   - What we know: `_ant_gen` is a Python generator wrapping `with client.messages.stream(...) as stream:`. Calling `_ant_gen.close()` raises `GeneratorExit` inside the `with` block, triggering `__exit__` → `MessageStream.close()` → `response.close()`.
   - What's unclear: Does LangSmith's `wrap_openai`-style decorator (NOT used on Anthropic — Anthropic uses native SDK without a LangSmith wrapper today) interact differently? The current symptom is OpenAI-path-specific.
   - **RESOLVED:** Plan 02 Subtask 2b confirms the Anthropic native path uses _ant_gen.close() + raises TimeoutError; LangSmith trace cleanliness contract is verified by Plan 04 Task 3 (test_066_langsmith_clean.py) which asserts via caplog that no log line contains GeneratorExit on the TimeoutError path. The close-then-raise is applied symmetrically to both providers (Plan 02 Subtask 2b for Anthropic, Subtask 2c for OpenAI/Google/OpenRouter) — defense-in-depth even if Anthropic-native happened to be clean today.

2. **Whether to delete `RUN_HARD_TIMEOUT_SECONDS` setting symbol entirely**
   - What we know: After D-066-01 deletes the wrapper consumer, the setting is unused. Lifespan/health refs at `runs.py:70,85,180` (per CONTEXT.md) may also reference it.
   - What's unclear: Are there external runbooks / observability dashboards / deploy configs that read the env var name? If yes, removing the setting symbol would break them silently (Pydantic-settings rejects unknown env vars only at startup if `extra="forbid"`; current model_config uses `extra="ignore"` per `config.py:129` — safe).
   - **RESOLVED:** Plan 02 deletes the Settings.run_hard_timeout_seconds field (Subtask 1d) AND swaps the three runs.py references at lines 70, 85, 180 to a new settings.consumer_timeout_seconds (default 610s). The env var symbol RUN_HARD_TIMEOUT_SECONDS remains parsed-and-ignored via the existing Pydantic-settings extra="ignore" config at config.py:129 — legacy deploys with the env var set do not error at startup, the value simply has no effect.

3. **`LLM_CALL_TIMEOUT_OVERRIDES` parser semantics**
   - What we know: Mirrors `MODEL_CONTEXT_LIMITS` / `MODEL_OUTPUT_LIMITS` (config.py:267, 278) — `model-id=int,model-id=int` syntax.
   - What's unclear: Should the parser also support a `_default=int` row to override the 180s baseline globally? (Useful for "I want all unknown models to use 300s" without enumerating them.)
   - **RESOLVED:** Out of scope for Phase 066 per KISS. _parse_llm_call_timeout_overrides() in Plan 02 Subtask 1c implements only the per-model entry syntax (model-id=seconds) — no _default= row. Deferred to a follow-up phase if the user explicitly requests global override capability.

## Sources

### Primary (HIGH confidence)
- `docs.python.org/3/library/asyncio-task.html#asyncio.timeout` — `asyncio.timeout()` context manager spec, per-iteration reset, nested behavior, shield interaction. Verified via WebFetch.
- `postgresql.org/docs/current/sql-altertable.html` — Single-statement DROP+ADD CONSTRAINT atomicity. Verified via WebSearch.
- Project venv probe (`backend/venv/Scripts/python.exe`):
  - `anthropic 0.97.0` — `MessageStream.close()` (sync), `AsyncMessageStream.close()` (async, NOT `aclose()`)
  - `openai 2.28.0` — `Stream.close()` (sync), `AsyncStream.close()` (async, NOT `aclose()`)
  - `langsmith 0.2.3` — `langsmith.wrappers.wrap_openai` is the integration site
  - Both `Stream.close()` and `MessageStream.close()` source: closes underlying httpx response; idempotent

### Secondary (MEDIUM confidence)
- `github.com/anthropics/claude-code/issues/51568` — Real-world Sonnet-4.6 extended-thinking stalls of 7.5+ minutes per call; informs slow-reasoning-model budget recommendations.
- `github.com/anthropics/anthropic-sdk-typescript/issues/867` — Documents request for streaming idle timeout; underscores why the per-call budget is the right shape.
- `github.com/langchain-ai/langchain/issues/24914` — `RuntimeError: async generator ignored GeneratorExit` documented; closed-as-not-planned by maintainers, reinforcing that the fix lives in user code (close stream cleanly before re-raise).
- `github.com/langchain-ai/langsmith-sdk/issues/1588` — `wrap_openai` API limitations; informs Pitfall 4.
- `community.openai.com/t/streaming-response-keeps-on-breaking/823699` — Practitioner accounts of streaming reliability; informs Pitfall 3.

### Tertiary (LOW confidence — validation flagged)
- `artificialanalysis.ai/providers/openai` — Provides p99 latency charts but specific numbers were not text-extractable via WebFetch. Plan-phase may consult directly if exact per-model p99 numbers materially affect override values.
- General web-community reasoning-model latency reports — informs A1 estimates but not authoritative.

## Project Constraints (from CLAUDE.md)

> Directives extracted verbatim from `CLAUDE.md` that bind Phase 066 implementation:

- **Schema changes ship as numbered SQL migrations under `supabase/migrations/`** at the repo root. Filenames must match `<digits>_name.sql`; letter suffixes silently skipped. → Migration `038_runs_timed_out_status.sql`.
- **Apply each new migration to the live local DB by pasting it into the Supabase SQL editor — never `supabase db push`/`db reset`** (preserves dev data).
- **Then regenerate the bootstrap artifact: `bash scripts/regenerate-full-schema.sh`** (live-DB dump, no reset). Pass `--reset` only for CI / release verification.
- **Never hand-edit `full-schema.sql`.**
- **No LangChain, no LangGraph — raw SDK calls only.** → Anthropic native + OpenAI client only; no LangChain abstraction.
- **Use Pydantic for structured LLM outputs.** → `MessageResponse.run_status` Literal extension stays in Pydantic.
- **All tables need Row-Level Security.** → `runs` already has `runs_select_own` policy; the CHECK extension does NOT alter RLS.
- **Stream chat responses via SSE.** → No change; just adds a 5th sentinel discriminator value.
- **Stateless chat completions — store and send chat history yourself, no provider-side thread state.** → Unchanged.
- **Do not run blocking I/O directly inside async handlers — wrap with `run_in_threadpool`.** → All Supabase writes already wrapped via `aexec()`; D-066-05 changes don't introduce new I/O.
- **Single uvicorn worker** — `--workers N` masks concurrency bugs and breaks in-memory state. → `RUN_TASKS` registry continues to be per-process.
- **Settings live in `user_settings` / `app_settings`** and the Settings UI; **env vars are for secrets and infra only**. → New `LLM_CALL_TIMEOUT_OVERRIDES` env var is operator-side infra config, NOT user-facing. ALIGNED.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — SDK versions and close-method names verified via venv probe; idiomatic asyncio.timeout pattern verified against official Python docs.
- Architecture: **HIGH** — code surfaces verified via `Read` of every file referenced by CONTEXT.md; CHECK migration shape confirmed against PostgreSQL docs and existing migration `035_runs_table.sql`.
- Pitfalls: **MEDIUM-HIGH** — sync-iteration interpretation of cancellation responsiveness validated via code reading (no public benchmarks of this exact pattern).
- Per-model timeout values: **MEDIUM** — assumptions A1; based on community reports and Anthropic's own bug-tracker evidence; conservative-leaning per user direction "we should not care about the budget but we care about accuracy, performance and failure-free execution."
- LangSmith clean-termination contract: **MEDIUM** — symptom-to-fix logic is sound (close stream → no GeneratorExit → no run_helpers.py:1680 trace warning), but no third-party validation; integration test (Wave 0 gap) is the validator.
- Validation strategy: **HIGH** — every SC has a deterministic check; one SC is live-UAT-only (which is correct — complex tool-calling agent completion can't be unit-tested).

**Research date:** 2026-05-06
**Valid until:** 2026-06-05 (30 days — stable stack, no fast-moving dependencies in scope)

---

*Phase: 066-adaptive-run-timeouts-lifecycle-states*
*Researched: 2026-05-06*
