---
phase: 175-cross-provider-streaming-fidelity
reviewed: 2026-07-22T17:46:57Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - backend/app/config.py
  - backend/app/services/sub_agent_models.py
  - backend/app/services/provider_gateway/openai_compat.py
  - backend/app/services/agent_loop.py
  - backend/app/services/openai_service.py
  - backend/app/services/provider_gateway/errors.py
  - backend/app/services/thread_title.py
  - backend/app/services/suggestion_service.py
  - backend/app/services/provider_gateway/test_errors.py
  - backend/tests/unit/test_085_task_service.py
  - backend/tests/unit/test_dsml_leak_signal.py
  - backend/tests/unit/test_openai_compat_dsml_strip.py
  - backend/tests/unit/test_reasoning_capability_markers.py
  - backend/tests/unit/test_reasoning_first_routing.py
  - backend/tests/unit/test_suggestions.py
  - backend/tests/unit/test_threads_title_gen.py
  - backend/tests/unit/test_title_reasoning_off.py
  - backend/tests/unit/test_utility_model_guard.py
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 175: Code Review Report

**Reviewed:** 2026-07-22T17:46:57Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 175 adds cross-provider streaming-fidelity work: a `reasoning_first` STRUCTURED
routing gate (XPROV-01), a DeepSeek DSML sanitizer flush + honest-leak signal (XPROV-02),
a shared cross-provider utility-model guard (XPROV-03), and per-model reasoning-off on the
title/suggestion calls (XPROV-04), plus a dedicated `reasoning_tools_unsupported` error kind.

The default-inert / D-14 discipline is genuinely respected in most places: the routing gate
(`cap.get("reasoning_first")`), the reasoning-off injection (`get_model_capability(...).get("reasoning_off")`),
the DSML flush (only `deepseek` populates `_dsml_pending`), the leak signal (`getattr(...,"dsml_leaked",False)`),
and the new error branch (400 + structured-body signature) are all guarded so unmarked models
take the identical path as before. The capability-marker matrix (`test_reasoning_capability_markers.py`)
locks the SAFE/UNSAFE sets tightly. The DSML per-chunk strip + stream-end flush logic is correct
across the split-opener, leaking, and partial-prefix-at-EOS cases.

The one blocking issue is a wiring mismatch: XPROV-02b's honest-leak signal is emitted via the
frontend's **terminal** `error` SSE event while the backend deliberately continues and completes
the run, and the leak explanation is never persisted to the assistant message — so the feature's
own goal ("ends honestly instead of silently incomplete") is not met on the reconnect/source-of-truth
path, and live-vs-persisted run state desyncs. Three warnings cover a semantic divergence between the
two XPROV-03 guards, an over-broad error-signature match, and an uncovered forced-emission path for
`reasoning_first` models.

## Critical Issues

### CR-01: DSML-leak "honest error" is emitted as a terminal `error` event, never persisted, while the run still completes

**File:** `backend/app/services/agent_loop.py:2169-2179` (emit) + `backend/app/services/agent_loop.py:2215` (`break`); consumer at `frontend/src/lib/api.ts:838-848`

**Issue:**
When a DeepSeek DSML leak is detected post-drain, the loop emits the fixed copy via the **existing**
`error` SSE event:

```python
if getattr(stream, "dsml_leaked", False):
    await _emit(redis, run_id, 'error', message=DSML_LEAK_ERROR_MESSAGE)
```

Two independent problems compound here:

1. **The frontend treats `error` as a hard terminal.** `frontend/src/lib/api.ts:838-848` maps a
   `type === "error"` SSE event to `callbacks.onTerminal("error", …)` and `return` — it stops
   consuming the stream and marks the run errored. But the backend does **not** fail: after the emit
   it parses tool calls (none, because the tool was written as text), then `break  # stream completed
   successfully`, and the outer loop finalizes the run as **completed** (no `_terminal_status='failed'`).
   Result: the live view terminates as an error, while the persisted run status is `completed`. On
   reconnect the frontend reconciles via fetch (CLAUDE.md D-v2.5-03) and now sees a completed run —
   the two states disagree.

2. **The explanation is never persisted.** Unlike the provider-error handler at
   `agent_loop.py:2798` (`full_content += user_msg` *then* emits both `delta` and `error` — a fix
   made specifically because `error`-only was "silently swallowed"), the DSML path does **not** append
   `DSML_LEAK_ERROR_MESSAGE` to `full_content`. The persisted assistant message is only the prose that
   preceded the leak. On any reload/reconnect the turn shows short/empty content with **no** explanation
   — precisely the "silently incomplete" outcome XPROV-02b claims to fix, on the source-of-truth path.

**Fix:** Mirror the proven provider-error shape so the explanation survives reconnect and the turn
finalizes consistently (do not reuse the terminal `error` event to convey a non-terminal condition):

```python
if getattr(stream, "dsml_leaked", False):
    # Persist the explanation into the assistant message so a reconnect/reload
    # still shows it (matches the provider-error path at :2798), and surface it
    # as a delta rather than the terminal `error` event so the run finalizes
    # honestly instead of desyncing (frontend api.ts:838 treats `error` as terminal).
    full_content += DSML_LEAK_ERROR_MESSAGE
    await _emit(redis, run_id, 'delta', content=DSML_LEAK_ERROR_MESSAGE)
```

If the intent is genuinely to fail the turn, then set `_terminal_status='failed'` and stop the loop
so the persisted status matches the emitted `error` — but still append the message to `full_content`.
Either way, the current "terminal `error` event + successful completion + unpersisted copy" combination
is internally inconsistent.

## Warnings

### WR-01: The two XPROV-03 guards disagree on unrecognised / empty-provider candidates — `provider_safe_utility_model` over-drops valid ids

**File:** `backend/app/services/sub_agent_models.py:88-94` vs `backend/app/services/sub_agent_models.py:165-179`

**Issue:**
Both guards are labelled XPROV-03 D-03 and are meant to share semantics, but they differ:

- `resolve_sub_agent_model_safely`'s folded gate fires **only** on a confident known-provider
  mismatch — it explicitly carves out the fallback bucket
  (`and _inferred_provider != _INFERENCE_FALLBACK_PROVIDER`), so an unrecognised id passes through
  unchanged (asserted in `test_085_task_service.py` and `test_utility_model_guard.py`).
- `provider_safe_utility_model` (used by `thread_title.py` and `suggestion_service.py`) has **no**
  such carve-out:

  ```python
  inferred = _infer_provider_for(override_candidate)   # unrecognised id -> "ollama" fallback
  if inferred == active or active in _FLEXIBLE_PROVIDERS:
      return override_candidate
  return None                                          # drops it
  ```

Consequences on the title/suggestion paths (native, non-flexible active provider):
- A **valid but pattern-unrecognised** `sub_agent_model` — e.g. an OpenAI fine-tune id
  `ft:gpt-4o-…` (does not start with `gpt-`, no `/`) on `active_provider="openai"` — infers to the
  `ollama` bucket and is silently dropped, falling back to the provider default. `test_085_task_service.py`
  keeps such an id; the utility-guard test even had to *change* its override from `custom-model` to a
  `claude-*` id to stay green — acknowledging the drop.
- **Empty `active_provider`** (legacy mode / unpopulated `UserEffectiveSettings.active_provider`):
  `inferred` is never `""`, so *every* non-empty candidate is dropped. Pre-175 both call sites used the
  configured `sub_agent_model` directly, so a legacy deploy with `SUB_AGENT_MODEL` set now silently
  ignores it for title-gen and suggestions.

**Fix:** Give `provider_safe_utility_model` the same fallback-bucket carve-out and empty-provider
short-circuit as the sibling resolver, so only a *confident* cross-provider mismatch is dropped:

```python
active = (user_settings.active_provider if user_settings else "") or ""
if not override_candidate:
    return None
inferred = _infer_provider_for(override_candidate)
if (
    inferred == active
    or active in _FLEXIBLE_PROVIDERS
    or inferred == _INFERENCE_FALLBACK_PROVIDER   # unrecognised id -> keep (byte-identical, D-14)
    or not active                                  # no active provider -> nothing to mismatch against
):
    return override_candidate
return None
```

Add a `provider_safe_utility_model` test asserting an unrecognised id on a native provider is **kept**,
to lock the parity with `resolve_sub_agent_model_safely`.

### WR-02: `_has_reasoning_tools_signature` misclassifies any 400 whose error `param == "reasoning_effort"`

**File:** `backend/app/services/provider_gateway/errors.py:136-137`

**Issue:**
The signature match returns True on the structured `param` alone, independent of the message:

```python
if err.get("param") == "reasoning_effort":
    return True
```

But `param == "reasoning_effort"` is not unique to the tools-unsupported case. A validation 400 for an
**invalid reasoning_effort value** (e.g. sending `reasoning_effort="none"` to a model whose accepted set
is `low|medium|high`, or vice-versa) also carries `param="reasoning_effort"` and would be misclassified
as `reasoning_tools_unsupported`. The user then sees "this reasoning model can't use tools … switched to
prompt-based tools automatically" for an unrelated parameter error. Given XPROV-04 injects
`reasoning_effort="none"` on Google title calls, a provider that rejects that value would trip this exact
false positive.

**Fix:** Require the reinforcing message signature even when `param` matches, so the match stays as narrow
as the docstring claims ("mirrors `_has_insufficient_quota`"):

```python
msg = err.get("message")
low = msg.lower() if isinstance(msg, str) else ""
sig_in_msg = any(sig in low for sig in _REASONING_TOOLS_SIGNATURES)
if err.get("param") == "reasoning_effort" and sig_in_msg:
    return True
return sig_in_msg
```

### WR-03: `reasoning_first` gate does not cover the forced-emission path; gpt-5.6 registry rows are internally contradictory

**File:** `backend/app/services/openai_service.py:1675-1676` (gate) vs `backend/app/services/openai_service.py:1839` (forced path); registry rows `backend/app/config.py:279-281`

**Issue:**
The XPROV-01 gate short-circuits `resolve_calling_mode` to STRUCTURED, which protects the **auto/Deep**
path. But `create_adaptive_streaming_chat`'s forced-emission branch (`if force_tool_name is not None:`,
line 1839) sends `tools` + a named `tool_choice` **regardless of calling mode** — it never consults
`resolve_calling_mode`. The gpt-5.6 rows carry `reasoning_first: True` **and** `forced_emission: True` +
`emit_tier: "force_strict"` simultaneously (config.py:279-281). On the chat.completions endpoint these are
mutually exclusive: forcing a reasoning-first model to emit tools re-triggers the very 400 the gate exists
to avoid. So a gpt-5.6 model used in a forced role (harness judge / authoring / skill-builder, all of
which resolve to `forced_emission` models and are operator-selectable) will 400, and the new
`reasoning_tools_unsupported` copy ("switched to prompt-based tools automatically") is inaccurate there —
nothing was switched; the forced call failed.

Severity is bounded today because gpt-5.6 is preview / not-yet-GA (config comment: "Re-verify ids + caps
against live /models once GA"), but the registry data is already self-contradictory and will bite the
moment gpt-5.6 is selected as a forced-emission utility model.

**Fix:** Decide the forced-path behavior for reasoning-first models explicitly — e.g. in the forced branch,
if `get_model_capability(effective_model).get("reasoning_first")`, either drop the named `tool_choice`
(fall back to coerce/structured for that call) or route these rows to `emit_tier: "coerce"` in the registry
so they are never force-called. Also soften the `reasoning_tools_unsupported` copy so it does not assert an
automatic switch that only happens on the auto path.

## Info

### IN-01: DSML-leak test asserts against a hand-copied mirror of the agent_loop hook, not the real code

**File:** `backend/tests/unit/test_dsml_leak_signal.py:73-77`

**Issue:** `_post_drain_guard` is a re-implementation of the `agent_loop.py:2175-2179` hook ("Mirror of the
agent_loop Option-B post-drain hook (kept in lockstep)"). The tests exercise the mirror, not the shipped
code, so a change to the real hook (e.g. the CR-01 fix) will not be caught by these tests. The
`dsml_leaked`-flag tests (against real `_normalize`) are solid; only the emit-guard assertions are mirror-only.

**Fix:** Where feasible, assert against the actual hook (e.g. a focused integration test that drives the real
post-drain branch), or add a source-string guard (as `test_129_minimax_argrepair.py` does) so drift is detected.

### IN-02: gpt-5.6 (reasoning-first) carries no `reasoning_off`, so its own utility calls fall to the derived-title fallback

**File:** `backend/app/config.py:279-281`

**Issue:** The XPROV-01 400 message itself states gpt-5.6 supports `reasoning_effort="none"`, yet the
gpt-5.6 rows are not marked `reasoning_off: "effort_none"`. A user who sets `sub_agent_model` to a gpt-5.6
id would have title-gen/suggestions burn the tiny 30-token budget on hidden reasoning and fall to the
degenerate derived title — the exact XPROV-04 symptom, just for OpenAI's reasoning-first tier. This is
default-inert (no regression, OpenAI was deliberately outside the docs-confirmed SAFE set), so it is noted
rather than flagged; revisit the SAFE set once gpt-5.6 is GA and `effort_none` is docs-confirmed for it.

---

_Reviewed: 2026-07-22T17:46:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
