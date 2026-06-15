# Agent-Loop Extraction Seam (Phase 089 — G-5)

**Status:** ✅ APPROVED — operator signed off 2026-05-30 (D-089-04, Task 4 checkpoint).
**Authored:** 2026-05-30 (Plan 089-01, Task 3). **Locked:** 2026-05-30 (Plan 089-01, Task 4).
**Operator decision:** B1 boundary (setup moves into the loop) + `_reconstruct_history`
co-located in `agent_loop.py` (cycle-free). Signature, RunContext (9 fields), and
AgentLoopResult (5 fields) confirmed as proposed. **Plan 089-03 follows this contract exactly.**

This document is the contract between `threads.py` (the producer shell that
STAYS) and `agent_loop.py` (the loop that MOVES). It changes file location
only, never behavior — a careless "while-I'm-in-here" cleanup re-opens the
075.x cross-provider cascade (D-089-03). Nothing here is a behavior change.

---

## 1. The `run_agent_loop` signature (PROPOSED)

```python
async def run_agent_loop(ctx: RunContext, *, emit, emit_terminal, spawn) -> AgentLoopResult
```

- `ctx: RunContext` — a **frozen** dataclass carrying the stable per-run INPUTS
  (Category A). One construction site in `agent_runner`, greppable, mypy-checkable.
- `emit`, `emit_terminal`, `spawn` — **keyword-only callables**, passed (NOT
  imported). This is what breaks the Pitfall-4 import cycle: `threads.py`
  imports `run_agent_loop` from `agent_loop.py`, and `agent_loop.py` does NOT
  import `_emit`/`_emit_terminal`/`_spawn` back from `threads.py`.
  - `emit` → `threads.py:_emit` (threads.py L109) — called ~40× in the loop.
  - `emit_terminal` → `threads.py:_emit_terminal` (threads.py L126) — the loop
    may not need it directly; the finalizer (STAYS) owns the terminal sentinel.
  - `spawn` → `threads.py:_spawn` (threads.py L69) — passed into
    `ToolContext(spawn=...)` for fire-and-forget audit/memory writes.
- Returns `AgentLoopResult` — the outputs `_shielded_finalize` (STAYS in
  threads.py) reads after the loop ends.

---

## 2. `RunContext` — frozen INPUTS (the 9 Category-A fields)

`@dataclass(frozen=True)`. Frozen on purpose (Pitfall 3): inputs only, mutated
nowhere. All mutable accumulators stay loop-local inside `run_agent_loop`
(Category D), never on this context — frozen catches an accidental
accumulator-on-context bug early and keeps the object safe under WORKER_COUNT=2.

| # | Field | Type | Origin in `send_message`/`agent_runner` | Read by |
|---|-------|------|------------------------------------------|---------|
| 1 | `run_id` | `UUID` | `send_message` L1297 | every `_emit`, `ToolContext`, finalize |
| 2 | `thread_id` | `str` | route path param | persist, `ToolContext`, messages append, DB writes |
| 3 | `current_user` | `dict` | `Depends(get_current_user)` | persist, `ToolContext`, history filter |
| 4 | `user_settings` | `Any` (`UserEffectiveSettings`) | resolved L1293-1329 (provider-overridden) | provider gating, tool selection, budgets, title |
| 5 | `body` | `Any` (`MessageCreate`) | route body | `body.model` / `.provider` / `.agent_mode` / `.content` |
| 6 | `redis` | `Any` (redis.asyncio client) | `Depends(get_redis)` | emits (or via the `emit` callable) |
| 7 | `supabase` | `Any` (supabase `Client`) | `Depends(get_supabase)` | history load, skills/memory injection, `ToolContext`, thread touch |
| 8 | `resolved_model` | `str` | L1298 (`_resolved_model`) | finalize warning, `ToolContext.model` |
| 9 | `resolved_provider` | `str` | L1306-1331 (`_resolved_provider`) | finalize warning |

> **Resolution stays put:** the provider/model resolution logic in
> `send_message` (L1293-1331) STAYS in `threads.py`; the loop receives the
> ALREADY-resolved values via `RunContext`. Do NOT re-resolve inside the loop
> (RESEARCH anti-pattern).

Field typing follows the in-repo house style (`tool_dispatcher.py` `ToolContext`):
opaque externals as `Any` with a trailing `# real-type` comment; `UUID`/`str`/
`dict` used directly where the sibling `ToolContext` does.

---

## 3. `AgentLoopResult` — finalizer OUTPUTS (the 5 Category-E fields)

`@dataclass` (PLAIN, not frozen — a return bag like `ToolResult`).

| # | Field | Type | Why the finalizer needs it |
|---|-------|------|----------------------------|
| 1 | `persist` | `Callable[..., Awaitable[Any]]` | the bound `_persist_assistant_message` — the finalizer calls it to insert the assistant row and get the cached message id |
| 2 | `input_tokens_total` | `int \| None` | `_shielded_finalize` writes it into the `runs` UPDATE (TOKEN-COL-01) |
| 3 | `output_tokens_total` | `int \| None` | same — `runs` UPDATE |
| 4 | `persisted_system_warnings` | `list[dict]` | the system_warning rows (migration 048) the finalizer/loop persisted |
| 5 | `full_content_final` | `str` | the final assistant content the finalizer references |

**Why a result object exists at all:** today `_shielded_finalize`
(threads.py L3035, STAYS) reads `full_content`, `input_tokens_total`,
`output_tokens_total`, `_persisted_system_warnings`, and calls
`_persist_assistant_message()` — all via the `agent_runner` closure. After the
loop moves, those live inside `run_agent_loop`. The loop must RETURN them so the
finalizer (which stays in the producer shell) can complete the run. This is the
second-most-important seam decision after `RunContext`.

**Terminal-status race invariant (I10 / Pitfall 5):** `_shielded_finalize`
keeps its byte-identical step order — `persist()` → `finalize_run` (the `runs`
status UPDATE) → `_emit_terminal` sentinel → expire → zrem. `finalize_run`
fires BEFORE the terminal sentinel (the 075.4-03 race fix). `run_agent_loop`
returning the persist callable + token totals is what lets the finalizer hold
that order. `test_075_4_terminal_race.py` asserts source order — stays green.

---

## 4. Category-B boundary — B1 vs B2 (THE seam-review DECISION)

The L1470-1627 setup block (folder-scope resolution, mode/prompt/tool
selection, skills + memory + disabled-tools injection, `_reconstruct_history`
call + `trim_messages_to_fit`) is computed inside `agent_runner` TODAY, after
the producer spawn but BEFORE the loop. Where should it live after extraction?

| Option | What it means | Trade-off |
|--------|---------------|-----------|
| **B1 (RECOMMENDED)** | Move the L1470-1627 setup INTO `run_agent_loop`. `RunContext` carries raw inputs only (the 9 fields above); the loop owns its own setup (folder-scope, prompt/tool/iteration selection, history reconstruction + trim). | **Thinner seam** — `RunContext` is the 9 raw inputs, no derived-value fields. The loop is self-contained: easier for the harness (091) to compose. `_reconstruct_history` gets called from inside the loop module (still imported from threads.py — see §5). `agent_runner` slims to: spawn → construct ctx → `await run_agent_loop(ctx, ...)` → finalize. **Cost:** a bigger single move (setup + loop together), so the verbatim diff in Plan 03 is larger. |
| **B2** | Keep the L1470-1627 setup in `agent_runner`; pass the computed values (`active_system_prompt`, `active_tools`, `max_iterations`, reconstructed+trimmed `messages`, `folder_subtree_ids`, `scoped_folder_path`) into `run_agent_loop` via an EXTENDED ctx (6+ extra fields). | **Smaller per-step diff** but a **fatter `RunContext`** (15+ fields, mixing raw inputs with derived values) and a **fatter `agent_runner`** that still owns loop-setup concerns. The harness (091) then has to re-derive or re-thread setup. Muddier seam. |

**RESEARCH recommendation: B1.** The L1470-1627 derivations are loop SETUP, not
producer-shell concern; moving them keeps the seam thin (raw-inputs-only ctx)
and gives 091/092 a self-contained `run_agent_loop` to branch into without
re-touching it. The mode branch (L1520-1527: Explorer prompt + `get_explorer_tools()`
+ `max_iterations=8` vs General `SYSTEM_PROMPT` + `active_tools=None` +
`max_iterations=15`) moves into the loop under B1 and MUST be preserved
byte-identically (SC#4; `test_explorer_agent.py` stays green).

> **✅ OPERATOR DECISION (2026-05-30): B1 — LOCKED.** The L1470-1627 setup block
> moves into `run_agent_loop`; `RunContext` stays the 9 raw inputs only. Plan 03's
> verbatim move follows B1.

---

## 5. `_reconstruct_history` disposition (Q3)

**RESEARCH recommendation: KEEP in `threads.py`, IMPORT into `agent_loop.py`.**

- It's a pure message-shape helper (threads.py L1135-1221, no `threads.py`
  runtime state — verified). Importing a pure function creates NO cycle (unlike
  `_emit`, which is passed as a callable).
- It's called at L1611 (inside the to-be-moved setup region under B1). Under B1
  the loop module imports it: `from app.api.threads import _reconstruct_history`
  — **but** that import direction (`agent_loop` → `threads`) would reintroduce
  the cycle, since `threads` imports `run_agent_loop` from `agent_loop`.
  **Resolution to confirm in Plan 03:** either (a) move `_reconstruct_history`
  to a neutral module (e.g. it has no threads.py deps, so it can live in
  `agent_loop.py` itself or a small shared helper module), or (b) keep it in
  threads.py and pass the reconstructed history into `run_agent_loop` via ctx
  (a B2-flavored exception for this one symbol). The cleanest cycle-free B1
  shape is to **co-locate `_reconstruct_history` in `agent_loop.py`** (it's a
  pure function, no other live caller depends on it staying in threads.py).
  **✅ OPERATOR DECISION (2026-05-30): co-locate `_reconstruct_history` in
  `agent_loop.py` — LOCKED.** Keep-and-import was rejected because the
  `agent_loop → threads` import direction reintroduces the cycle. The Google
  `thought_signature` echo on reload (I3, threads.py L1184-1188) lives inside
  `_reconstruct_history` and moves WITH it verbatim.

> The frontend read path — `get_snapshot`/`get_messages` with the
> `.neq("role","system")` filter (Phase 086 landmine, threads.py L800/L1113) —
> is a SEPARATE query and STAYS untouched. The loop's history query (L1511,
> selecting `role, content, tool_calls, reasoning_content` for the LLM) is a
> different query with different filters by design — do NOT consolidate them.

---

## 6. What Plan 089-03 will move (the full verbatim-move scope)

So the operator sees the entire move boundary before signing off (D-089-01):

> **Plan 03 moves VERBATIM into `agent_loop.py`:** the iteration loop body
> (`for iteration in range(max_iterations)`, threads.py L1818–~L2738 — trim,
> `force_no_tools`, the provider branch, iteration-cap guard, length guards,
> empty-retry, transient-retry, TPM 429 special-case); the three provider
> chunk-handlers kept as THREE separate functions (`_on_chunk_anthropic`
> L1944-2022, `_on_chunk_google` L2055-2143, `_on_chunk_openai` L2245-2403 —
> NOT collapsed); the tool-dispatch round (`ToolContext` construction +
> `dispatch_tool` call + tool-result append, L2583-2738); `_persist_assistant_message`
> (L1659-1724) and `_persist_system_messages` (L1736-1778); the post-loop emits
> (`final_output_files` L2753-2762, sources/citations/confidence L2866-2889,
> fallback-empty L2764-2780); the inner try/except provider-error handlers
> (L2782-2864); and the suggestion-gen + stream_end (L2911-2984). Under B1, the
> L1470-1627 setup block moves too. **Zero "while-I'm-in-here" cleanup** —
> bugs included (the two deferred Anthropic agent-loop bugs stay AS BUGS, fixed
> later in Phase 093). Already done in Plan 01: the three pure helpers
> (`drain_step`, `_drain_stream_with_close_on_cancel`, `_strip_nul`) moved
> verbatim. **STAYS in threads.py:** the `send_message` route shell,
> `agent_runner` producer shell, `_emit`/`_emit_terminal`/`_spawn`,
> `_shielded_finalize`, `generate_thread_title`, and the
> `get_snapshot`/`get_messages` route handlers (086 filter). Plan 03 also
> updates ~15 integration tests' monkeypatch target from
> `app.api.threads.create_adaptive_streaming_chat` →
> `app.services.agent_loop.create_adaptive_streaming_chat` (test-side, not
> behavior — Pitfall 1).

---

## 7. Per-provider invariants carried verbatim (SC#2 — the named checklist)

The move preserves every per-provider round-trip invariant byte-identically.
Full table in `089-RESEARCH.md` §"Per-Provider Invariant Inventory" (I1–I14):
Anthropic `end_turn`-instead-of-`tool_calls` (I1); Google `thought_signature`
echo + round-trip (I2/I3); DeepSeek `reasoning_content` accumulate + round-trip
(I4/I5); Moonshot/Kimi `<think>` filter + empty-retry (I6/I7); shared
`force_no_tools`-on-last-iteration (I8), iteration-cap silent-drop guard
`kind='iteration_cap_dropped_tool_calls'` (I9), terminal-status race (I10),
transient-retry (I11), TPM-429 (I12), length-recovery (I13), OpenRouter
pre-injection (I14). GLM (zhipu) + MiniMax have ZERO loop-specific branches —
they route through the shared OpenAI-compat path (`_on_chunk_openai`); their
proof is the same SSE-diff + eval rows as the other OpenAI-compat providers.

---

## ✅ Operator sign-off — LOCKED (2026-05-30)

The operator approved this seam as proposed. Plan 089-03 proceeds with the
verbatim move on this exact contract:

- **Signature:** `async def run_agent_loop(ctx: RunContext, *, emit, emit_terminal, spawn) -> AgentLoopResult`
- **RunContext** = the 9 raw inputs (§2), frozen.
- **AgentLoopResult** = the 5 finalizer outputs (§3).
- **Boundary = B1:** the L1470-1627 setup moves into the loop.
- **`_reconstruct_history`:** co-located in `agent_loop.py` (cycle-free; keep-and-import rejected).

No changes were requested to the signature, the RunContext fields, or the boundary.
