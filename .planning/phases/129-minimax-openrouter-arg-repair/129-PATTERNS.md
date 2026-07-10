# Phase 129: MiniMax/OpenRouter Arg Repair - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 5 (3 modified source + 2 new test) + 1 frontmatter touch
**Analogs found:** 5 / 5 (every new/modified file has an in-repo analog — this phase is additive-into-existing-seams, no greenfield subsystem)

This is a **backend-only** phase. Both halves are *additive injections into seams that already exist for exactly this class of problem* (RESEARCH "Don't Hand-Roll" key insight). Every analog below lives in the same file as its target edit — the danger is touching the shared path, not missing infrastructure.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/agent_loop.py` (D-01 MiniMax guard + re-ask + recovered signal) | service (agent loop / tool-call round-trip) | streaming / event-driven (SSE) | **same file** — `tool_dispatcher.py:2450` write_todos coercion (validity guard) + `agent_loop.py:1905-1917` retry scaffold + `agent_loop.py:1998-2008` prose-before-code `continue` recovery | exact (in-file precedents) |
| `backend/app/services/openai_service.py` (D-02 OpenRouter `require_parameters`) | service (OpenAI-compat request build adapter) | request-response (request-body assembly) | **same block** — `openai_service.py:1619-1625` `:exacto` + `response-healing` plugin under `extra_body` | exact (same `if provider=="openrouter"` block) |
| `backend/app/config.py` (D-15 note → wired; possibly drop the "never wired" caveat) | config (curated registry + provenance note) | config / static registry | **same file** — `config.py:342-346` D-15 directive comment; MiniMax rows `:318-325` | exact (note already present) |
| `backend/tests/test_129_minimax_argrepair.py` (NEW) | test (unit — guard / re-ask / honest-fail / recovered) | request-response (mocked stream + provider gate) | `tests/test_provider_router.py` (mock supabase + `_fast_chunks` + provider-resolution asserts) | role-match |
| `backend/tests/test_129_openrouter_require_params.py` (NEW) | test (unit — request-build shape assert) | request-response (assert assembled `kwargs["extra_body"]`) | `tests/test_provider_router.py` (request-build shape, no live call) | role-match |
| `.planning/reported-bugs/minimax-m3-invalid-tool-args-400.md` (frontmatter touch) | doc (bug report) | — | TEMPLATE.md frontmatter convention | exact |

## Pattern Assignments

### `backend/app/services/agent_loop.py` — D-01 MiniMax arg-repair guard (service, streaming/event-driven)

**Target seam:** the round-trip assistant-message build at `agent_loop.py:2037-2074` — the validity check goes at `:2037`, **before** the `messages.append(...)` at `:2039`. This is the ONLY seam that prevents the next-turn 400 (Pitfall 1: the local-dispatch `json.loads` at `:2120` already catches `JSONDecodeError` and lets the run continue locally — fixing it does NOT stop the round-trip 400).

**Analog 1 — provider-gated JSON-validity guard (D-03 precedent).**
Source: `backend/app/services/tool_dispatcher.py:2446-2456` (BUG-260529-01). The proven stdlib boundary-coercion shape to mirror:
```python
todos_in = args.get("todos") or []
# BUG-260529-01: some models (e.g. free OpenRouter llama-3.3-70b) serialize the
# nested `todos` arg as a JSON string. Coerce + guard so valid stringified
# payloads succeed and bad shapes return a self-correcting error (not a crash).
if isinstance(todos_in, str):
    try:
        todos_in = json.loads(todos_in)
    except (ValueError, TypeError):
        return ToolResult(
            result="write_todos: 'todos' must be a JSON array of objects, not a string"
        )
```
**Adaptation:** validate `json.loads(tc["arguments"])` for each `tc` in `tool_calls`, in a `try/except (ValueError, TypeError)`. Difference from the precedent: MiniMax's failure is *truncation* not stringification — so the `except` branch does NOT return a self-correcting error string; it triggers a one-shot **re-ask** (truncated args cannot be coerced into validity; only a fresh emission can). Anti-pattern (RESEARCH): do NOT brace-balance / re-escape — that fabricates a partial dispatch, violating D-01.

**Provider gate.** The guard MUST be inside a `provider == "minimax"` gate. The resolved provider is available in the loop as `_resolved_provider = ctx.resolved_provider` (`agent_loop.py:1023`) and the per-iteration `active_provider_name = getattr(user_settings, "active_provider", "") or ""` (`agent_loop.py:1527`). Gate on the resolved provider, not the model string (mirrors the D-09 #3 / BUG-260616-01 lesson at `openai_service.py:1612` — slash-gating on the model id mis-fired for every `org/model` id).

**Analog 2 — bounded re-ask via `continue` with corrective injection (D-01 scaffold).**
Source: `backend/app/services/agent_loop.py:1998-2008` (the prose-before-code recovery — the exact in-loop "drop the bad turn, inject corrective message, `continue`" shape):
```python
if _looks_like_prose_not_code:
    # Strip the truncated prose — inject a recovery prompt instead
    full_content = ""
    _recovery = (
        "You wrote a text response but hit the output token limit before calling execute_code. "
        "Do NOT write any more text. Call execute_code NOW with complete Python code to produce the file."
    )
    messages.append({"role": "assistant", "content": "[Response truncated — token limit reached before execute_code was called]"})
    messages.append({"role": "user", "content": _recovery})
    logger.warning("prose_before_code_recovery: iteration %d hit length limit without tool call — injecting recovery prompt", iteration)
    continue  # retry this iteration
```
**Adaptation:** on invalid MiniMax args, do the same shape — do NOT append the malformed assistant `tool_calls` turn; instead inject a corrective nudge ("your previous tool call's arguments were truncated/invalid — re-emit the tool call with complete arguments") and `continue` the loop. The re-ask is triggered **proactively by the validity check** (not by an exception — the 400 only happens on the NEXT request).

**Analog 3 — SEPARATE bounded counter (Pitfall 3 — do NOT consume `_provider_retries`).**
Source: the `_empty_retries` single-shot counter at `agent_loop.py:1224` (init) + `:2027-2033` (use):
```python
# init (top of run, line 1224)
_empty_retries = 0  # tracks empty-response retries across all iterations
...
# use (line 2027)
if not full_content and _empty_retries < 1:
    _empty_retries += 1
    logger.warning(
        "LLM returned empty response on iteration %d (thread %s) — retrying once",
        iteration, thread_id,
    )
    continue
```
**Adaptation:** add a run-scoped `_minimax_argrepair_retries = 0` counter (init alongside `_empty_retries` at the top of the run, NOT inside the per-iteration block where `_provider_retries` resets at `:1508`). Max 1 per D-01. Do NOT reuse `_provider_retries` (`:1508-1510`) — Pitfall 3: a code-heavy MiniMax run that also hits a transient 503 would burn its budget on arg-repair. Do NOT loosen `_is_transient_provider_error` (`:445-462`) — it deliberately never retries parameter/bad_request errors; the re-ask is a SEPARATE proactive path.

**Anti-pattern — `finish_reason == "length"` will NOT catch this (Pitfall 2).** The existing length guards at `:1975` (`finish_reason == "length" and tool_calls_buffer`) and `:1983` never fire: MiniMax docs document `finish_reason: "tool_calls"` with NO truncation signaling, and the live run (`output_tokens=8192`, the cap) still produced a `tool_calls` finish. The repair MUST validate the args JSON directly, independent of `finish_reason`.

---

### `backend/app/services/agent_loop.py` — D-01 honest-fail + "recovered" signal (service, SSE)

**Analog — honest `bad_request` copy (D-01 still-malformed branch).**
Source: `backend/app/services/provider_gateway/errors.py:187-190` (the exact copy the failed run `2c711ee4` already surfaced — classification works as designed; reuse keeps copy consistent):
```python
"bad_request": (
    "*Model parameter error — this model may not support the current "
    "configuration.*"
),
```
Reached via `message_for_kind("bad_request")` (`errors.py:202-212`). **Anti-pattern:** do NOT interpolate raw 400 detail into the copy for this known kind — `message_for_kind` only adds bounded `raw_detail` for the `unknown` kind (Information-Disclosure control T-095.1-01-02). After the one-shot re-ask is exhausted, the still-malformed turn must reach this copy — never a silent swallow (D-01).

**Analog — quiet "recovered" honesty signal (Phase 122 vocabulary, Deep-side equivalent).**
Source (the 122 intent to MATCH, NOT to call directly): `backend/app/services/harness/phase_types.py:1199-1205`:
```python
if result.get("recovered_from_narration"):
    # D-06 fired — record the degraded-but-honest NATIVE recovery transition.
    await _emit_phase_substep(ctx, phase, status="recovering")  # amber tint = degraded but honest
    await _emit_audit(ctx, event_type="emit_recovered", metadata=_emit_audit_metadata(...))
```
**CRITICAL adaptation (Open Q1 + Assumption A3):** that `emit_recovered` / `recovered_from_narration` vocabulary lives in the **harness `forced_emit` substrate**, which the Deep agent loop **bypasses** by design — `forced_emit.py:74` docstring: *"the open agent loop this substrate bypasses (D-01)"*; phase_types uses `_emit_audit(ctx, ...)`, a harness-only emitter. So D-01 **cannot** call `forced_emit` / `_emit_audit`. Emit a quiet equivalent on the **Deep agent-loop SSE channel** instead, using the canonical loop emitter:

The Deep loop's emitter is `_emit = emit` (`agent_loop.py:1026`), a callable passed in that resolves to `threads.py:_emit`:
```python
# Source: backend/app/api/threads.py:152-166 — one canonical XADD shape (D-061-10)
async def _emit(redis, run_id: _uuid_mod.UUID, type: str, **fields) -> None:
    await redis.xadd(
        f"run:{run_id}",
        {"data": json.dumps({"type": type, **fields})},
        maxlen=10000,
        approximate=True,
    )
```
Call shape used throughout the loop, e.g. `await _emit(redis, run_id, 'tool_start', name=tool_name, args=args)` (`:2121`). **For D-01:** `await _emit(redis, run_id, '<recovered-event-name>', ...)` — planner picks the event name (Open Q1): keep it consistent with the 122 family (`tool_args_recovered` or `emit_recovered`) and **quiet** (an audit signal, NOT a user-facing error `delta`). The FE can ignore unknown event types — confirm no new handler is required.

---

### `backend/app/services/openai_service.py` — D-02 OpenRouter `require_parameters` (service, request-response)

**Analog — the EXACT block to extend (same `if provider == "openrouter"` branch).**
Source: `backend/app/services/openai_service.py:1610-1625`:
```python
# OpenRouter quality strategy enhancements
if user_settings and getattr(user_settings, "openrouter_tool_strategy", "quality") == "quality":
    # D-09 #3 (BUG-260616-01): gate on the RESOLVED provider, not the model
    # string. The old `"/" in effective_model` slash-gate fired for EVERY
    # `org/model` id ...
    if provider == "openrouter":
        # Append :exacto for quality routing if not already present
        if ":exacto" not in effective_model:
            kwargs["model"] = f"{effective_model}:exacto"
        # Enable Response Healing plugin
        kwargs.setdefault("extra_body", {})
        kwargs["extra_body"]["plugins"] = [{"id": "response-healing"}]
```
**Adaptation (D-02, confirmed request shape from official docs):** add ONE line inside this exact block, right after the `plugins` line:
```python
        # [D-02 / config.py:344 D-15] require_parameters so OpenRouter excludes
        # upstreams that would silently drop the tool schema:
        kwargs["extra_body"]["provider"] = {"require_parameters": True}
```
**Anti-patterns:**
- Pitfall 4 — do NOT inject unconditionally / outside this `strategy == "quality"` + `provider == "openrouter"` double-gate; that narrows routing for `native`/`xml`-strategy users who didn't opt in (D-02 locks it to the quality block).
- Pitfall 5 — this stacks a THIRD OpenRouter routing modifier (`:exacto` model suffix + `plugins:[response-healing]` + `provider.require_parameters`); their combined behavior is undocumented. Flagged confirm-at-execution via the SC#10 OpenRouter before/after row (A2).

---

### `backend/app/config.py` — D-15 note (config, static registry)

**Analog — the directive already present (just being honored, not added).**
Source: `backend/app/config.py:342-346`:
```python
# Phase 101.1 D-15: OpenRouter is TIER-FORCE *conditional* — forced_emission True
# ONLY where the routed upstream is itself forceable (deepseek / z-ai-glm / minimax).
# The forcing adapter MUST send provider.require_parameters=true so OpenRouter does
# NOT silently downgrade. ...
```
**Adaptation:** D-02 wires the previously documented-but-never-wired directive. Optional edit: update the comment to drop the "MUST send (but doesn't)" implication once the `openai_service.py` injection lands — or leave as-is (it's now accurate). MiniMax registry rows at `:318-325` (`provider: "minimax"`, `max_output_tokens: 131072`) are the gate-target rows for D-01; note Open Q2 — the live run capped at 8192 despite the 131072 value (does not change the repair design; confirm `_resolve_max_tokens` at `openai_service.py:1479` at execution).

---

### `backend/tests/test_129_minimax_argrepair.py` (NEW) + `test_129_openrouter_require_params.py` (NEW) — (test, request-response)

**Analog — mocked-stream + provider-resolution unit test (no live API).**
Source: `backend/tests/test_provider_router.py:20-55` — the established backend unit-test scaffold:
```python
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4
import httpx, pytest
from httpx import ASGITransport
from app.dependencies import get_redis, get_supabase
from app.main import app
from app.services.openai_service import CallingMode
from tests.integration._run_helpers import (
    _build_mock_supabase, _fast_chunks, _make_result,
)
# autouse fixture resets app.dependencies._redis singleton between tests
```
**Adaptation per RESEARCH Validation Architecture (Wave 0 gaps):**
- `test_129_minimax_argrepair.py` — mock the stream/buffer + provider gate (NO live API; follow `feedback_mock_completeness.md` — mock ALL network deps, explicit `MagicMock` attrs). Cover the 6 mapped behaviors: valid args pass-through (no-op), truncated args DETECTED under `provider=="minimax"`, NO-OP for non-MiniMax (openai/anthropic/google byte-identical), one-shot re-ask bounded (max 1, separate counter — assert it does NOT touch `_provider_retries`), still-malformed → honest `bad_request` copy, successful re-ask → quiet "recovered" signal emitted.
- `test_129_openrouter_require_params.py` — assert on the assembled `kwargs["extra_body"]` (request-build shape, no live call): `provider == {"require_parameters": True}` present for `openrouter_tool_strategy == "quality"`; ABSENT for `native`/`xml`.

Test IDs are enumerated in RESEARCH "Phase Requirements → Test Map" — reuse those exact `::test_...` names.

## Shared Patterns

### D-14 RED LINE — provider-gated, shared path byte-identical
**Source:** the in-file gates this phase mirrors — `agent_loop.py:1023` (`_resolved_provider`), `:1527` (`active_provider_name`), `openai_service.py:1619` (`if provider == "openrouter"`).
**Apply to:** every edit in `agent_loop.py` and `openai_service.py`.
Every change MUST be inside a `provider == "minimax"` or `provider == "openrouter"` gate. The `"auto"` / shared `_on_chunk` path for OpenAI/Anthropic/Google must stay byte-identical. SC#10 regression rows prove the guard never fires for them.

### Honesty over silence (Phase 122 intent, CLAUDE.md "run honesty")
**Source:** `harness/phase_types.py:1199-1205` (`emit_recovered`/`emit_failed` family) — the *intent* to match; **mechanism** = Deep-loop `_emit` (`threads.py:152`), NOT `forced_emit`.
**Apply to:** the D-01 recovered signal AND the honest-fail.
Recovered / coerced / failed states are SURFACED, never swallowed: successful repair → quiet `_emit` recovered signal; exhausted repair → honest `bad_request` copy (`errors.py:187`). Never a silent swallow, never a fabricated/partial dispatch.

### Bounded retry without budget-stealing
**Source:** `agent_loop.py:1224` + `:2027` (`_empty_retries` single-shot) vs `:1508-1510` (`_provider_retries`, max 2, per-iteration reset).
**Apply to:** the D-01 re-ask.
New recovery paths get their OWN run-scoped single-shot counter, mirroring `_empty_retries` — never reuse the transient-error budget.

### stdlib `json.loads` in `try/except` — never partial-parse / `eval`
**Source:** `tool_dispatcher.py:2450` (write_todos), `agent_loop.py:2120/2143` (local dispatch).
**Apply to:** the D-01 validity check (V5 Input Validation — validate model-supplied args before round-trip; never `eval`, never brace-balance).

## No Analog Found

None. Every new/modified file has a concrete in-repo precedent — both halves of this phase are additive injections into seams that already exist (RESEARCH key insight). The two NEW test files are new artifacts but follow the established `tests/test_*.py` mocked-scaffold pattern.

## Metadata

**Analog search scope:** `backend/app/services/` (agent_loop, openai_service, tool_dispatcher, forced_emit, harness/phase_types, provider_gateway/errors), `backend/app/config.py`, `backend/app/api/threads.py`, `backend/tests/`.
**Files scanned:** ~9 source/test files (all ranges from RESEARCH "read this session" list, verified in-context).
**Pattern extraction date:** 2026-06-27
