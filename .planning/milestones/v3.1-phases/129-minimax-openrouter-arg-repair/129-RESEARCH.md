# Phase 129: MiniMax/OpenRouter Arg Repair - Research

**Researched:** 2026-06-27
**Domain:** Cross-provider tool-use robustness at the OpenAI-compatible adapter boundary (MiniMax malformed-args repair + OpenRouter `require_parameters`)
**Confidence:** HIGH (root cause confirmed by live DB evidence + provider docs; the two locked code-injection points are read and pinpointed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (repair fallback — retry-then-honest-fail):** When MiniMax sends tool-call args too garbled to repair at the boundary, **retry the model turn once** (re-ask it to re-emit the tool call); if still malformed, fail with the existing honest provider-error copy. Mirrors the Phase 122 force→coerce ladder and preserves run honesty — never a silent swallow, never a fabricated/partial dispatch. A **successful** repair surfaces a quiet "recovered" honesty signal consistent with the Phase 122 emit_tier / forced-emit scoreboard (recovery is visible, not hidden).
- **D-02 (OpenRouter scope — bundle into existing 'quality' tool-strategy):** `require_parameters` is added **alongside the response-healing plugin already in the `openrouter_tool_strategy="quality"` path** (`openai_service.py` ~1611–1625). Additive, opt-in via the strategy the user already selects — no new Settings surface, no always-on behavior change for users on other strategies. Implements the already-documented-but-never-wired directive (config.py / D-15).
- **D-03 (repair breadth — MiniMax-scoped, reuse proven coercion):** The arg-repair guard is **provider-gated to MiniMax**, mirroring the existing `write_todos` stringified-args coercion (BUG-260529-01 precedent). No general OpenAI-compat-wide guard — other providers unaffected, shared request path not forked.

### Claude's Discretion
- The exact code seam for the MiniMax repair (buffer-assembly vs round-trip-message build) — see Architecture Patterns; the research recommends the round-trip-message seam.
- The exact emit vocabulary for the "recovered" signal, provided it matches Phase 122 honesty intent (`emit_recovered`-style quiet audit, not a new user-facing label).

### Deferred Ideas (OUT OF SCOPE)
- **General (all-provider) adapter-boundary arg-repair guard** — deferred to keep this phase provider-scoped and off the shared path. Re-open if a second OpenAI-compat provider exhibits the same malformed-args class.
- **`gpt4o-max-tokens-exceeds-completion-cap`** — a token-cap mechanism in provider-routing/MODEL_CAPABILITIES, NOT arg-repair; belongs in a separate provider-routing polish item.
- **`spike-nl-workflow-authoring.md`** — unrelated; not folded.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MP-04 | MiniMax malformed-args boundary repair + OpenRouter `require_parameters` for broader provider robustness | Root cause confirmed (truncation at output-token cap, run `2c711ee4`, `output_tokens=8192`). Repair seam pinpointed at `agent_loop.py:2039-2074` (round-trip assistant-message build). OpenRouter `require_parameters` request shape confirmed via official docs; injection point at `openai_service.py:1624` (same `extra_body` block as the `response-healing` plugin). |

**Folded bug (update frontmatter at plan-phase):** `BUG-260607-03` (`minimax-m3-invalid-tool-args-400`) → set `status: folded`, `folded_into: 129`. At least one plan task MUST address it.
</phase_requirements>

## Summary

This is a backend-only, no-package, no-migration phase that hardens the OpenAI-compatible adapter boundary for two peripheral providers. **The root cause of the folded bug is now confirmed by hard evidence, not hypothesis.** Live DB query of the offending run `2c711ee4` (MiniMax-M3, thread `b6800732`, 2026-06-07) shows `output_tokens = 8192` — **exactly** the model's configured `max_output_tokens` cap — and the error `invalid params, invalid function arguments json string, tool_call_id: call_function_oe37l04aftv8_1`. The 8192-token cap being hit precisely, combined with the error pointing at a specific tool_call_id, confirms the **truncation** hypothesis over mis-escaping: MiniMax-M3 ran out of output budget mid-stream while emitting a large `execute_code.code` argument, producing a truncated (therefore invalid) JSON string. MiniMax's official function-calling docs confirm `function.arguments` is a JSON string and document **no truncation signaling** — the model reports `finish_reason: "tool_calls"` even when it truncated, which is exactly why the existing `finish_reason == "length" and tool_calls_buffer` guard at `agent_loop.py:1975` never fired.

**Because the args are truncated (not mis-escaped), they cannot be "re-encoded" into validity** — the fix is the D-01 retry-then-honest-fail ladder: detect that the buffered MiniMax tool-call `arguments` string is invalid JSON before it is round-tripped, re-ask the model once (a fresh turn re-emits the tool call), and if still invalid, fail with the existing honest `bad_request` copy. A successful re-emit surfaces a quiet "recovered" signal in the Phase 122 vocabulary.

The OpenRouter half (D-02) is a one-line additive injection: `extra_body["provider"] = {"require_parameters": True}` inside the existing `openrouter_tool_strategy="quality"` + `provider == "openrouter"` block (`openai_service.py:1619-1625`), right next to the `plugins: [{"id": "response-healing"}]` line. OpenRouter's official docs confirm the exact shape (top-level `provider` object) and that it only excludes non-compliant upstreams from routing — a safe, opt-in robustness gain. config.py:344 already documents this directive (D-15) but it was never wired.

**Primary recommendation:** Add a MiniMax-gated JSON-validity guard at the round-trip assistant-message build seam (`agent_loop.py:2039-2074`); on invalid args, run a one-shot re-ask using the existing `_provider_retries`-style retry scaffold, then honest-fail via the existing `bad_request` classifier copy. Inject OpenRouter `require_parameters` into the existing quality-strategy `extra_body` block. Keep the shared chunk handler / SSE emitter / agent loop byte-identical for all other providers.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect MiniMax truncated/invalid tool-call args | API / Backend — `agent_loop.py` tool-call round-trip seam | Adapter — `openai_service.py` (provider gate) | The malformed args are produced in the streaming round and rejected on the NEXT request; the agent loop owns the assistant-message build that re-sends them. |
| One-shot re-ask on invalid args | API / Backend — agent loop (reuse `_provider_retries` scaffold) | — | The retry is a re-issue of the model turn within the loop, same place the existing transient-error retry lives (`agent_loop.py:1905-1917`). |
| Honest-fail surface + "recovered" signal | API / Backend — agent loop + provider_gateway error classifier | — | Reuse existing `bad_request` copy (`provider_gateway/errors.py:187`) and Phase 122 `emit_recovered`-style audit vocabulary. |
| OpenRouter `require_parameters` injection | API / Backend — `openai_service.py` request-build adapter | — | It is a request-body parameter under `extra_body.provider`; belongs in the same adapter block as `:exacto` + `response-healing`. |
| Keep shared path byte-identical (OpenAI/Anthropic/Google) | API / Backend — provider-gated branches only | — | D-14 RED LINE: every change lives inside a `provider == "minimax"` / `provider == "openrouter"` gate; the `"auto"` path for other providers is untouched. |

## Standard Stack

**No new packages.** This phase is pure backend edits to existing files using the stdlib (`json`) and the existing OpenAI SDK already in the project. The `## Package Legitimacy Audit` section is therefore N/A (no installs).

### Core (existing, in-repo — the files to edit)
| File | Purpose | Why it owns this |
|------|---------|------------------|
| `backend/app/services/agent_loop.py` | Tool-call round-trip + retry scaffold | The assistant-message build (`:2039-2074`) re-sends the malformed args; the retry scaffold (`:1905-1917`, `_provider_retries`) is the pattern for D-01's one-shot re-ask. |
| `backend/app/services/openai_service.py` | OpenAI-compat request build | The `openrouter_tool_strategy="quality"` `extra_body` block (`:1611-1625`) is where D-02 injects `require_parameters`. |
| `backend/app/config.py` | Curated registry + D-15 note | Already documents the `require_parameters` directive (`:344`); MiniMax rows (`:318-325`) carry `max_output_tokens: 131072` BUT the live run capped at 8192 — see Open Questions Q2. |
| `backend/app/services/provider_gateway/errors.py` | Honest per-kind error copy | `bad_request` copy (`:187-190`) is the existing honest-fail surface D-01 reuses. |
| `backend/app/services/tool_dispatcher.py` | `write_todos` coercion precedent | `:2447-2458` is the proven boundary-coercion pattern D-03 mirrors. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Round-trip-message seam (`agent_loop.py:2039`) | Buffer-assembly seam (`agent_loop.py:2037`) | Buffer-assembly is earlier but the dispatch path already `json.loads` + catches `JSONDecodeError` at `:2120`; the *round-trip* is what 400s, so the validity check belongs where the assistant message is built (just before re-send). Recommend round-trip seam. |
| One-shot model re-ask (D-01 locked) | Bumping MiniMax `max_output_tokens` | Out of scope (deferred `gpt4o-max-tokens-exceeds-completion-cap` is the token-cap family); also doesn't fix a model that truncates for other reasons. D-01 is locked. |
| Provider-gated guard (D-03 locked) | General all-provider arg-validity guard | Deferred — would touch the shared path for every provider. Locked to MiniMax-only. |

**Installation:** None.

## Package Legitimacy Audit

N/A — this phase installs no external packages. All edits use the stdlib and the existing OpenAI SDK already vendored in `backend/requirements.txt`.

## Architecture Patterns

### System Architecture Diagram

```
User prompt (heavy execute_code request)
        │
        ▼
agent_loop.py  ──► create_adaptive_streaming_chat (openai_service.py)
        │                     │
        │                     ├─ provider == "minimax"  → OpenAI-compat stream
        │                     └─ provider == "openrouter" + strategy "quality"
        │                            └─[D-02]► extra_body["provider"] = {"require_parameters": True}
        │                                       (next to plugins:[response-healing], :exacto model suffix)
        ▼
provider_gateway/openai_compat.py  (streams chunks)
        │  accumulates tool_args  _tool_args[idx]["arguments"] += delta   (:298-299)
        │  emits finish event with finish_reason + assembled tool_calls   (:355-368)
        │       ⚠ MiniMax reports finish_reason="tool_calls" even when TRUNCATED at token cap
        ▼
agent_loop.py  tool_calls_buffer  →  tool_calls = list(...values())      (:2037)
        │
        ├─ [LOCAL DISPATCH]  json.loads(tc["arguments"])  (:2120, catches JSONDecodeError :2143)
        │       └─ malformed → "Error parsing tool arguments" (local only, run continues)
        │
        └─ [ROUND-TRIP]  messages.append({"role":"assistant","tool_calls":[{... "arguments": tc["arguments"]}]})  (:2039-2074)
                │   ⚠⚠ THE 400 SEAM — truncated arguments string re-sent verbatim to MiniMax next turn
                │
                ▼  next iteration → create_adaptive_streaming_chat → MiniMax 400 "invalid function arguments json string"
                │
                └─[D-01 NEW]► MiniMax-gated JSON-validity guard BEFORE append:
                        validate json.loads(tc["arguments"]) for each tool_call
                        invalid + provider=="minimax":
                            ├─ retry-once: re-ask the model turn (drop the bad assistant turn, continue loop)
                            ├─ success → emit quiet "recovered" signal (Phase 122 emit_recovered vocab)
                            └─ still invalid → honest-fail via bad_request copy (provider_gateway/errors.py:187)
```

### Pattern 1: Provider-gated boundary coercion (D-03's precedent)
**What:** Guard a provider-specific malformed payload at the adapter boundary, gated on the resolved provider, returning a self-correcting result rather than crashing.
**When to use:** A specific provider emits a shape the shared path can't consume; the fix must not touch other providers.
**Example (the exact precedent to mirror):**
```python
# Source: backend/app/services/tool_dispatcher.py:2447-2458 (BUG-260529-01)
todos_in = args.get("todos") or []
# BUG-260529-01: some models serialize the nested `todos` arg as a JSON string.
# Coerce + guard so valid stringified payloads succeed and bad shapes return a
# self-correcting error (not a crash).
if isinstance(todos_in, str):
    try:
        todos_in = json.loads(todos_in)
    except (ValueError, TypeError):
        return ToolResult(
            result="write_todos: 'todos' must be a JSON array of objects, not a string"
        )
```
**Adaptation for D-01:** the MiniMax case is *truncation*, not stringification — so the guard validates `json.loads(tc["arguments"])` and, on failure, triggers a one-shot **re-ask** (not a local error string), because a truncated arg cannot be coerced into validity; only a fresh emission can.

### Pattern 2: Bounded provider retry (D-01's re-ask scaffold)
**What:** Re-issue the model turn a bounded number of times before failing honestly.
**When to use:** A retry can plausibly succeed (a fresh emission may not truncate).
**Example (the exact scaffold to mirror):**
```python
# Source: backend/app/services/agent_loop.py:1905-1917
if _is_transient_provider_error(provider_err) and _provider_retries < _MAX_PROVIDER_RETRIES:
    _provider_retries += 1
    delay = _retry_delays[_provider_retries - 1]
    await asyncio.sleep(delay)
    continue  # re-issue the model turn
raise  # non-retryable or retries exhausted → honest-fail
```
**Adaptation for D-01:** add a SEPARATE bounded counter (e.g. `_minimax_argrepair_retries`, max 1 per D-01) so it does not consume the transient-error budget. The re-ask is NOT triggered by an exception (the 400 only happens on the *next* request) — it is triggered proactively by the JSON-validity check on the buffered args, by dropping the malformed assistant turn and `continue`-ing the loop with a corrective nudge (compare the prose-before-code recovery at `agent_loop.py:1998-2008`, which already does exactly this: strip the bad turn, inject a corrective user message, `continue`).

### Pattern 3: Honest "recovered" signal (Phase 122 vocabulary)
**What:** When a recovery succeeds, emit a quiet audit signal — never hide the recovery, never surface it as a scary user error.
**When to use:** A repair/coerce/recovery path succeeded and run honesty (CLAUDE.md) requires it be visible.
**Example:**
```python
# Source: backend/app/services/harness/phase_types.py:1199-1202 (Phase 122 MP-01)
if result.get("recovered_from_narration"):
    await _emit_audit(ctx, event_type="emit_recovered", metadata=_emit_audit_metadata(...))
```
**Adaptation for D-01:** the Phase 122 `emit_recovered` / `recovered_from_narration` vocabulary lives in the **harness** `forced_emit` substrate (`backend/app/services/forced_emit.py`), which the Deep agent loop **bypasses** (forced_emit.py docstring: "the agent loop this substrate bypasses (D-01)"). So D-01 cannot literally call `forced_emit`; it should emit a quiet equivalent on the Deep agent-loop SSE channel (the existing `_emit(redis, run_id, ...)` helper) using a name consistent with the 122 family (e.g. a `tool_args_recovered` / `emit_recovered`-style event). The planner should pick the exact event name; the contract is "quiet, visible, not a user-facing error."

### Anti-Patterns to Avoid
- **Forking the shared request path** — every change MUST be inside a `provider == "minimax"` or `provider == "openrouter"` gate. The `"auto"` branch for OpenAI/Anthropic/Google must stay byte-identical (D-14 RED LINE).
- **Trying to "re-escape" truncated JSON** — the args are truncated at the token cap, not mis-escaped; string repair (balancing braces, re-escaping) would fabricate a partial dispatch, violating D-01 ("never fabricated/partial dispatch"). Only a fresh re-ask is honest.
- **Silently swallowing the 400** — D-01 forbids silent swallow; a still-malformed retry must reach the honest `bad_request` copy.
- **Retrying the 400 as a transient error** — `_is_transient_provider_error` deliberately does NOT retry parameter/bad_request errors (`agent_loop.py:445-462`); do not loosen it (that would retry genuinely fatal param errors for every provider). The re-ask must be a SEPARATE, MiniMax-gated, proactive path.
- **Putting `require_parameters` outside the quality block** — D-02 locks it to the `openrouter_tool_strategy="quality"` + `provider == "openrouter"` branch; an always-on injection changes routing for users on `native`/`xml` strategies.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON arg validity check | A custom brace-balancer / partial-JSON parser | `json.loads(...)` in a `try/except (ValueError, TypeError)` | The `write_todos` precedent (`tool_dispatcher.py:2450`) already proves the stdlib pattern; partial parsers fabricate shapes (violates D-01). |
| Bounded retry loop | A new retry framework | The existing `_provider_retries` / `_retry_delays` scaffold + the prose-before-code `continue` recovery pattern | `agent_loop.py:1905-1917` + `:1998-2008` already do bounded re-issue with corrective injection. |
| Honest error copy | New user-facing error strings | `provider_gateway/errors.py` `message_for_kind("bad_request")` | The classifier already produced the exact copy seen in the failed run; reuse keeps copy consistent. |
| OpenRouter request shape | Guessing the field nesting | `extra_body["provider"] = {"require_parameters": True}` | Confirmed by official docs (top-level `provider` object). |

**Key insight:** Both halves of this phase are *additive injections into seams that already exist for exactly this class of problem*. There is no new subsystem to build — the danger is touching the shared path, not missing infrastructure.

## Runtime State Inventory

> Not a rename/refactor/migration phase — this is a code-behavior change with no stored-state or registration surface. Section included for completeness per the trigger check.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schema/data change; the repair operates on in-flight stream buffers only. Verified: no migration in scope (CONTEXT.md). | None |
| Live service config | None — no external service registration changes. The MiniMax / OpenRouter API keys + base URLs are unchanged (`config.py:19`, `:730`). | None |
| OS-registered state | None — no scheduled tasks, no process names. | None |
| Secrets/env vars | None — `minimax_api_key` / OpenRouter routing are read-only here; no new env var. `require_parameters` is a request-body flag, not config. | None |
| Build artifacts | None — pure Python source edits; no package re-install, no sandbox image rebuild (the sandbox is the agent's tool runtime, untouched). | None |

**Nothing found in any category** — verified against CONTEXT.md ("no migration, no new API surface") and the file list (all edits are to existing `.py` service files).

## Common Pitfalls

### Pitfall 1: Repairing at the wrong seam (local dispatch vs round-trip)
**What goes wrong:** Adding the guard at the local dispatch path (`agent_loop.py:2120`, where `json.loads` already runs) — but that path already catches `JSONDecodeError` and lets the run CONTINUE locally. The 400 happens on the *round-trip* (the assistant message re-sent to MiniMax), which is a DIFFERENT code location (`:2039-2074`).
**Why it happens:** Both locations call `json.loads(tc["arguments"])`; it's easy to assume fixing one fixes both.
**How to avoid:** Place the validity check at the round-trip assistant-message build (`:2039`), BEFORE the `messages.append`. That is the only seam that prevents the next-turn 400.
**Warning signs:** A fix that makes the local dispatch error nicer but the run still 400s on the next iteration.

### Pitfall 2: Assuming `finish_reason == "length"` will catch truncation
**What goes wrong:** Relying on the existing length guard (`agent_loop.py:1975`) to handle the truncated-args case.
**Why it happens:** Logically, a token-cap truncation "is" a length finish.
**How to avoid:** MiniMax's docs document `finish_reason: "tool_calls"` with NO truncation signaling (confirmed). The live run hit `output_tokens=8192` (the cap) yet still produced a `tool_calls` finish — the length guard cannot see it. The repair MUST validate the args JSON directly, independent of finish_reason.
**Warning signs:** A guard keyed only on finish_reason that doesn't fire on the reproduction.

### Pitfall 3: Consuming the transient-retry budget
**What goes wrong:** Reusing `_provider_retries` for the re-ask, so a code-heavy MiniMax run that also hits a transient 503 burns its retry budget on arg-repair (or vice versa).
**Why it happens:** The scaffold is right there.
**How to avoid:** Use a SEPARATE bounded counter for the D-01 one-shot re-ask (max 1). Mirror the `_empty_retries` pattern (`agent_loop.py:2027`, a separate single-shot counter) rather than `_provider_retries`.
**Warning signs:** A multi-failure run exhausting retries unexpectedly.

### Pitfall 4: OpenRouter routing regression on other strategies
**What goes wrong:** Injecting `require_parameters` unconditionally narrows OpenRouter's routable upstream pool for users on `native`/`xml` strategies, who didn't opt in.
**Why it happens:** Putting the flag in a shared `extra_body` line instead of inside the `strategy == "quality"` + `provider == "openrouter"` guard.
**How to avoid:** Inject ONLY inside the existing quality block (`:1619-1625`), beside the `plugins` line. D-02 locks this.
**Warning signs:** OpenRouter requests on `native` strategy suddenly failing to route / getting fewer providers.

### Pitfall 5: `:exacto` + `require_parameters` interaction (undocumented)
**What goes wrong:** The quality block already appends `:exacto` to the model id AND sets `plugins: [response-healing]`. Adding `require_parameters` stacks three OpenRouter-specific routing modifiers whose combined behavior is not documented.
**Why it happens:** Each is individually valid; the combination is untested by us.
**How to avoid:** Treat the three-way interaction as **confirm-at-execution** via the SC#10 OpenRouter scoreboard row (before/after `require_parameters`). The official docs confirm `require_parameters` shape and routing exclusion but NOT its interaction with `:exacto` or `plugins`.
**Warning signs:** OpenRouter quality-strategy runs that routed fine before now 404/422 on routing.

## Code Examples

### Confirmed: OpenRouter `require_parameters` request shape
```python
# Source: openrouter.ai/docs/guides/routing/provider-selection (fetched 2026-06-27)
# Injected into the EXISTING block at openai_service.py:1619-1625, beside plugins:
if provider == "openrouter":
    if ":exacto" not in effective_model:
        kwargs["model"] = f"{effective_model}:exacto"
    kwargs.setdefault("extra_body", {})
    kwargs["extra_body"]["plugins"] = [{"id": "response-healing"}]
    # [D-02 NEW] — require_parameters so OpenRouter excludes upstreams that
    # would silently drop the tool schema (config.py:344 / D-15 directive):
    kwargs["extra_body"]["provider"] = {"require_parameters": True}
```
Request body produced (confirmed shape):
```json
{
  "model": "...:exacto",
  "messages": [...],
  "tools": [...],
  "provider": { "require_parameters": true },
  "plugins": [ { "id": "response-healing" } ]
}
```

### Confirmed: the MiniMax round-trip seam (where the 400 originates)
```python
# Source: backend/app/services/agent_loop.py:2037-2074
tool_calls = list(tool_calls_buffer.values())
# [D-01 NEW — MiniMax-gated guard goes HERE, before the append] e.g.:
#   if provider == "minimax":
#       for tc in tool_calls:
#           try: json.loads(tc["arguments"])
#           except (ValueError, TypeError): <one-shot re-ask, else honest bad_request>
messages.append({
    "role": "assistant",
    "tool_calls": [
        {"id": tc["id"], "type": "function",
         "function": {"name": tc["name"], "arguments": tc["arguments"]},  # ← truncated string re-sent
         **({"thought_signature": tc["thought_signature"]} if tc.get("thought_signature") else {})}
        for tc in tool_calls
    ],
    **({"content": full_content} if full_content else {}),
    **({"reasoning_content": full_reasoning_content} if full_reasoning_content else {}),
})
```

### Confirmed: the honest-fail copy to reuse
```python
# Source: backend/app/services/provider_gateway/errors.py:187-190
"bad_request": (
    "*Model parameter error — this model may not support the current "
    "configuration.*"
),
```
This is the exact copy the failed run `2c711ee4` surfaced (classification already works as designed). D-01's still-malformed branch reuses it.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `require_parameters` documented-but-unwired (config.py:344 note) | Wire it into the quality strategy `extra_body` | This phase (D-02) | OpenRouter quality-strategy routes only to upstreams honoring the tool schema. |
| MiniMax 400 fails the run with honest copy (no recovery) | One-shot re-ask before honest-fail (D-01) | This phase | Code-heavy MiniMax-M3 runs recover instead of dying when the model truncates args once. |
| `write_todos` stringified-args coercion (BUG-260529-01) | Generalized pattern reused, MiniMax-gated (D-03) | This phase | Proven boundary-coercion pattern extended to a second provider quirk, scoped. |

**Deprecated/outdated:**
- The hypothesis "M3 mis-escapes a large arg" — **superseded by evidence**: the run hit `output_tokens=8192` (exact cap), confirming TRUNCATION. Mis-escaping is ruled out by the cap-hit signature. (Mark in any plan as evidence-confirmed, not hypothesis.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The re-ask (a fresh model turn) will usually emit shorter/complete args because the model isn't deterministically forced to re-truncate at the same point | D-01 design | If MiniMax re-truncates identically every time, the re-ask never succeeds and the run honest-fails (still correct per D-01, just no recovery). LOW risk — D-01 already caps at one retry then honest-fails, so worst case = current behavior + one wasted call. |
| A2 | `require_parameters` does not conflict with the already-present `plugins: [response-healing]` and `:exacto` | D-02 / Pitfall 5 | Official docs confirm shape + routing-exclusion but NOT the three-way interaction. Flagged confirm-at-execution via the OpenRouter SC#10 row. MEDIUM. |
| A3 | The "recovered" signal can be a quiet agent-loop SSE/audit emit (not a literal `forced_emit` call, which the Deep loop bypasses) | D-01 / Pattern 3 | If a reviewer insists the signal must route through `forced_emit`, the design needs adjustment — but forced_emit.py's own docstring says the agent loop bypasses it, so a Deep-side equivalent is correct. LOW. |
| A4 | MiniMax-M3's effective `max_output_tokens` at run time was 8192, despite config.py:325 listing 131072 | Open Q2 | If the cap is actually configurable/higher and the 8192 was a different limit (e.g. account-tier), the truncation framing still holds (it hit *a* cap), only the knob differs. LOW for the repair design; see Open Q2. |

## Open Questions (RESOLVED)

1. **What exact "recovered" event name should the Deep agent loop emit?**
   - What we know: Phase 122 uses `emit_recovered` + `recovered_from_narration` in the harness `forced_emit` substrate; the Deep loop bypasses that substrate and uses `_emit(redis, run_id, <event>, ...)`.
   - What's unclear: whether to reuse the literal `emit_recovered` name on the Deep channel or coin a `tool_args_recovered` event.
   - **RESOLVED:** `tool_args_recovered` (Phase-122-family, Deep-side `_emit`, quiet — not a user-facing error delta; FE ignores unknown events). Locked in Plan 02 Task 1.

2. **Why did the live run cap at `output_tokens=8192` when config.py:325 sets MiniMax-M3 `max_output_tokens: 131072`?**
   - What we know: the failed run (2026-06-07, commit `0af81c8e`) hit exactly 8192. config.py currently lists 131072 for `MiniMax-M3` (`:325`); the OpenRouter MiniMax fallback default is 8192 (`config.py:424`).
   - What's unclear: whether the run predates the 131072 registry value, or whether MiniMax's API enforced a lower server-side cap, or the `_resolve_max_tokens` path applied a different ceiling.
   - **RESOLVED:** non-blocking — the repair design is unchanged (truncation holds regardless of the exact cap; it hit *a* cap). Confirm at execution by checking `_resolve_max_tokens` (openai_service.py:1479) for the MiniMax path and re-running the heavy prompt on current config. Evidence-gathering, not a design input.

3. **Does a single re-ask reliably recover, or should the corrective nudge tell the model to split the code?**
   - What we know: the prose-before-code recovery (`:1998-2008`) injects a corrective user message and `continue`s — a proven in-loop recovery shape.
   - What's unclear: whether a bare re-ask suffices or whether the nudge should instruct the model to emit a smaller/complete arg.
   - **RESOLVED:** corrective-nudge re-ask (per Plan 02 Task 1 action — inject a corrective user message then `continue`, mirroring `:1998-2008`); the SC#10 MiniMax recovered/failed rungs measure the live recovery rate. Confirm at execution.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| MiniMax API (api.minimax.io) | Live UAT of the repair (recovered/failed rungs) | Key present (`minimax_api_key`, config.py:730) — live reachability not probed this session | MiniMax-M3 | M2.5-highspeed workaround (bug report) for non-UAT use |
| OpenRouter API | Live UAT of `require_parameters` before/after | Routed via `openrouter_tool_strategy` | quality strategy | — (experimental provider; low priority) |
| Local Supabase (`:54322`) | Evidence query (DONE — confirmed root cause) | ✓ | Postgres (verified this session) | — |
| Backend venv + psycopg2 | Evidence query | ✓ (`backend/venv/Scripts/python.exe`) | psycopg2 OK | — |
| pytest | Unit coverage (arg-validity guard) | ✓ (`backend/pytest.ini`) | — | — |
| LangSmith (project `agentic-rag-module2`) | Trace inspection | ✗ (not emitting since 2026-06-20, per memory) | — | Supabase `runs` + backend logs (used instead — sufficient) |

**Missing dependencies with no fallback:** None blocking. Root cause was confirmed via Supabase without LangSmith.
**Missing dependencies with fallback:** LangSmith → Supabase/logs (already exercised successfully).

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && venv/Scripts/python.exe -m pytest app/services/provider_gateway/test_errors.py -x -q` |
| Full suite command | `cd backend && venv/Scripts/python.exe -m pytest -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MP-04 | A valid JSON args string passes the MiniMax guard unchanged (no-op for well-formed args) | unit | `pytest backend/tests/test_129_minimax_argrepair.py::test_valid_args_pass_through -x` | ❌ Wave 0 |
| MP-04 | An invalid/truncated args string is DETECTED by the guard (json.loads fails) under provider=="minimax" | unit | `pytest backend/tests/test_129_minimax_argrepair.py::test_truncated_args_detected -x` | ❌ Wave 0 |
| MP-04 | The guard is a NO-OP for non-MiniMax providers (openai/anthropic/google round-trip byte-identical) | unit | `pytest backend/tests/test_129_minimax_argrepair.py::test_non_minimax_unaffected -x` | ❌ Wave 0 |
| MP-04 | One-shot re-ask is bounded (max 1) and does not consume `_provider_retries` | unit | `pytest backend/tests/test_129_minimax_argrepair.py::test_reask_bounded_separate_counter -x` | ❌ Wave 0 |
| MP-04 | Still-malformed after retry → honest `bad_request` copy surfaced (no silent swallow) | unit | `pytest backend/tests/test_129_minimax_argrepair.py::test_still_malformed_honest_fail -x` | ❌ Wave 0 |
| MP-04 | A successful re-ask emits the quiet "recovered" signal | unit | `pytest backend/tests/test_129_minimax_argrepair.py::test_recovered_signal_emitted -x` | ❌ Wave 0 |
| MP-04 | OpenRouter quality strategy injects `extra_body["provider"]={"require_parameters":True}`; native/xml do NOT | unit | `pytest backend/tests/test_129_openrouter_require_params.py::test_require_parameters_quality_only -x` | ❌ Wave 0 |

### SC#10 4-Axis Cross-Provider Scoreboard (manual / live UAT — authored under VALIDATION.md)

Per CLAUDE.md SC#10 (phase touches provider routing): UAT rows MUST exercise all 4 axes. This phase's scoreboard:

| Axis | Required coverage for this phase |
|------|----------------------------------|
| **Cross-provider** | OpenAI, Anthropic, Google (regression: byte-identical, no behavior change) + MiniMax (repair) + OpenRouter (require_parameters) — 5 rows minimum |
| **Multi-tool** | ≥1 row exercising 2+ tools in one prompt on MiniMax (e.g. `search_documents` + `execute_code`) to confirm the per-tool-call guard validates each tool_call independently |
| **Parallel-thread** | ≥1 row: Thread A (MiniMax heavy execute_code, triggering repair) streaming while Thread B accepts a new prompt — confirm the repair is run-scoped, no cross-thread bleed |
| **Long-message** | ≥1 row: the reproduction itself — a heavy `execute_code` prompt large enough to push MiniMax-M3 toward its output-token cap (≥5KB code payload), proving recovered-or-honest-fail |

**Repair-specific rungs (the D-01 ladder — both outcomes must be exercised):**
- **Recovered rung:** MiniMax truncates once → re-ask succeeds → run continues → quiet "recovered" signal visible.
- **Honest-fail rung:** MiniMax truncates, re-ask still malformed → honest `bad_request` copy → run fails cleanly (no silent swallow, no partial dispatch).

**OpenRouter require_parameters before/after:** one quality-strategy row WITHOUT the flag (baseline routing) and one WITH (confirm routing still succeeds + no `:exacto`/`plugins` conflict — Pitfall 5).

**Regression proof (the shared-path RED LINE):** OpenAI/Anthropic/Google rows must show byte-identical tool-call round-trips (no new event, no behavior change) — the guard is MiniMax-gated and must not fire for them.

### Sampling Rate
- **Per task commit:** `pytest backend/tests/test_129_*.py -x -q`
- **Per wave merge:** `cd backend && venv/Scripts/python.exe -m pytest -q` (full backend suite — watch for regressions in `test_errors.py`, agent-loop tests, and any `-k minimax` / `-k tuner` tests per prior regression-gate lessons)
- **Phase gate:** full suite green + SC#10 4-axis live UAT (recovered + honest-fail rungs both proven; OpenRouter before/after) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/test_129_minimax_argrepair.py` — covers MP-04 MiniMax guard (valid pass-through, truncation detect, non-minimax no-op, bounded re-ask, honest-fail, recovered signal). Mock the stream/buffer + provider gate; no live API. Follow `feedback_mock_completeness.md` (mock ALL network deps).
- [ ] `backend/tests/test_129_openrouter_require_params.py` — covers MP-04 OpenRouter injection (quality-only, not native/xml). Assert on the assembled `kwargs["extra_body"]` (the existing pattern asserts request-build shape, no live call).
- [ ] No framework install needed — pytest + venv already present.

## Security Domain

> `security_enforcement` absent from config → treated as enabled. Backend-only provider-boundary change.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface touched (provider API keys unchanged). |
| V3 Session Management | no | No session change. |
| V4 Access Control | yes (light) | The repair is run-scoped; the existing run/thread RLS + run-scoping (`run:{run_id}` keyspace) must not be widened. Confirm the re-ask + recovered signal stay scoped to the originating run_id (parallel-thread UAT row covers this). |
| V5 Input Validation | yes | The core of the phase: validate the model-supplied `arguments` JSON before round-trip (`json.loads` in try/except — never `eval`, never partial-parse). |
| V6 Cryptography | no | None. |

### Known Threat Patterns for the OpenAI-compat adapter boundary

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed model output crashing the round-trip (the bug) | Denial of Service (run failure) | `json.loads` validity guard + bounded re-ask + honest-fail (D-01) |
| Information disclosure via raw error in user copy | Information Disclosure | Reuse fixed `bad_request` copy (`errors.py:187`) — NO raw-detail interpolation for known kinds (existing T-095.1-01-02 control) |
| Cross-run/thread bleed of repair state | Tampering / Elevation | Keep retry counter + recovered signal in the per-run loop scope (parallel-thread UAT axis) |
| OpenRouter routing to an untrusted/non-compliant upstream | Tampering | `require_parameters` is itself a hardening (excludes upstreams that drop the tool schema) — net security gain, not a new risk |

## Sources

### Primary (HIGH confidence)
- **Live Supabase DB** (`localhost:54322`, `runs` + `messages`) — confirmed run `2c711ee4`: status=failed, model=MiniMax-M3, provider=minimax, `output_tokens=8192`, error `invalid params, invalid function arguments json string, tool_call_id: call_function_oe37l04aftv8_1`. Exactly ONE such failure across all providers. (This session.)
- **Codebase (read this session):** `agent_loop.py:445-462,1505-1510,1820-1862,1883-1917,1975-2012,2037-2074,2115-2161`; `openai_service.py:1395-1632`; `config.py:172-203,318-356,424,701,730`; `provider_gateway/openai_compat.py:222-368`; `provider_gateway/errors.py:180-213`; `tool_dispatcher.py:1347-1361,2447-2483`; `forced_emit.py:31-32,68-78,194-271,318-342`; `harness/phase_types.py:1199-1202`.
- **MiniMax M3 official function-calling docs** — `platform.minimax.io/docs/guides/text-m3-function-call` (fetched 2026-06-27): `function.arguments` is a JSON string; `finish_reason: "tool_calls"`; **no truncation signaling documented**; no malformed-args error handling documented.
- **OpenRouter Provider Routing docs** — `openrouter.ai/docs/guides/routing/provider-selection` (fetched 2026-06-27): `require_parameters` is a top-level `provider` object field; setting it excludes non-compliant upstreams from routing; `:exacto`/`plugins` interaction NOT documented.

### Secondary (MEDIUM confidence)
- WebSearch (OpenRouter `require_parameters`, MiniMax M3 function-calling) — cross-verified against the official docs above.

### Tertiary (LOW confidence)
- None relied upon for any load-bearing claim.

## Metadata

**Confidence breakdown:**
- Root cause (truncation, not mis-escaping): **HIGH** — `output_tokens=8192` exact cap-hit + tool_call_id-specific error + MiniMax docs confirm no truncation signal.
- Repair seam location (`agent_loop.py:2039`): **HIGH** — read the exact round-trip build; the local-dispatch vs round-trip distinction is verified in code.
- OpenRouter `require_parameters` shape + injection point: **HIGH** — official docs + the exact existing `extra_body` block read.
- D-01 "recovered" signal mechanism: **MEDIUM** — Phase 122 vocabulary confirmed, but it lives in a substrate the Deep loop bypasses; exact event name is a planner decision (Open Q1).
- Re-ask recovery rate: **MEDIUM** — design is sound; actual recovery rate is a confirm-at-execution UAT measurement (Open Q3).

**Research date:** 2026-06-27
**Valid until:** 2026-07-27 (stable backend boundary; provider docs may shift — re-verify the OpenRouter `provider` object shape + MiniMax finish_reason behavior at execution if more than ~30 days elapse).
