---
phase: 051-context-window-management
reviewed: 2026-04-23T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - backend/app/services/sub_agent_service.py
  - backend/app/config.py
  - backend/app/services/context_window.py
  - backend/requirements.txt
  - backend/app/models/user_settings.py
  - backend/app/api/settings.py
  - frontend/src/lib/api.ts
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/lib/model-info.ts
  - frontend/src/components/chat/MessageInput.tsx
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 051: Code Review Report

**Reviewed:** 2026-04-23
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 051 adds tiktoken-backed token estimation, a sliding-window trim algorithm, sub-agent keyword routing for generation vs analysis tasks, a settings UI slider for sub-agent output tokens, and model info tooltips in the chat model selector. The implementation is generally well-structured and consistent with project conventions.

Four warnings and four info items were found. No critical security vulnerabilities. The most actionable warnings are: a logic bug in `_build_candidate` that inserts a trim-marker even when no trimming has yet occurred; a `_remove_oldest_atomic` edge case that silently drops tool messages whose siblings share a `tool_call_id` but belong to a different parent call; the `gpt-5.4-nano` model ID in sub-agent defaults hitting `_uses_max_completion_tokens` but not present in `_MODEL_OUTPUT_DEFAULTS`; and the Settings page `handleReset` resetting unsaved cross-tab state.

---

## Warnings

### WR-01: `_build_candidate` inserts trim marker when `trimmable` is non-empty but nothing has been removed yet

**File:** `backend/app/services/context_window.py:229`

**Issue:** `_build_candidate` is called inside the trim loop on every iteration — including the first iteration before any removal — with `add_marker=False`. However the logic at lines 229–232 reads:

```python
if add_marker and trimmable is not None:
    result.append({"role": "user", "content": _TRIM_MARKER})
```

The `trimmable is not None` guard is always True (an empty list is not None). This is harmless as currently called because `add_marker` starts as `False` and is only set to `True` after a removal. However the real issue is in the post-loop block (lines 209–214):

```python
if trimmed_any or (
    trimmable == [] and estimate_messages_tokens(
        _build_candidate(system_msg, [], protected, False)
    ) > max_tokens
):
    trimmed_any = True
```

When the entire trimmable list is exhausted but the protected tail alone still exceeds `max_tokens`, `trimmed_any` is set to `True` and the final `_build_candidate(system_msg, trimmable, protected, trimmed_any)` on line 216 inserts the trim marker — but `trimmable` is now `[]`, so the marker is inserted between the system message and the protected tail with zero historical messages between them. This accurately signals context loss and is arguably correct behaviour, but if the protected tail itself contains the very first user message (e.g. a single-turn conversation), the LLM will see the trim marker before any real content, which is confusing. More importantly, `estimate_messages_tokens` is called a second time in this branch on an already-checked candidate, wasting a full re-estimation of the protected messages.

**Fix:** Guard the second estimation call with a length check and document the degenerate case:

```python
# Only mark as trimmed if we actually removed something from trimmable,
# OR if even the irreducible protected tail exceeds the budget (rare).
protected_only_tokens = (
    estimate_messages_tokens(_build_candidate(system_msg, [], protected, False))
    if not trimmed_any and trimmable == []
    else 0
)
if trimmed_any or (trimmable == [] and protected_only_tokens > max_tokens):
    trimmed_any = True
```

---

### WR-02: `_remove_oldest_atomic` drops sibling tool messages that share a `tool_call_id` but belong to a different parent

**File:** `backend/app/services/context_window.py:279-285`

**Issue:** In the orphaned-tool-message branch (lines 276-285), the code removes the leading tool message and then continues removing subsequent messages that share the same `tool_call_id`:

```python
tool_call_id = first.get("tool_call_id")
for msg in trimmable[1:]:
    if msg.get("role") == "tool" and msg.get("tool_call_id") == tool_call_id:
        to_remove += 1
    else:
        break
```

If a model ever reuses a `tool_call_id` across two separate assistant turns (which violates the spec but has been observed with some proxy providers via OpenRouter), this will silently swallow the tool results for the *second* call, producing an API error or garbled output on the next turn. Additionally, if `tool_call_id` is `None` (missing from the message), the condition `msg.get("tool_call_id") == tool_call_id` evaluates to `None == None` → `True`, meaning all consecutive tool messages with missing IDs are bulk-removed even if they belong to different parent calls.

**Fix:** Guard against the `None` ID case:

```python
tool_call_id = first.get("tool_call_id")
if tool_call_id is not None:
    for msg in trimmable[1:]:
        if msg.get("role") == "tool" and msg.get("tool_call_id") == tool_call_id:
            to_remove += 1
        else:
            break
```

---

### WR-03: `gpt-5.4-nano` sub-agent default triggers `max_completion_tokens` but has no entry in `_MODEL_OUTPUT_DEFAULTS`

**File:** `backend/app/services/sub_agent_service.py:19`

**Issue:** `_SUB_AGENT_MODEL_DEFAULTS["openai"]` is set to `"gpt-5.4-nano"`. In `run_sub_agent`, `_uses_max_completion_tokens("gpt-5.4-nano")` returns `True` (matches `gpt-5` prefix), so `max_completion_tokens` is used — correct. However `_resolve_max_tokens(output_ceiling, user_settings)` (called at line 95) resolves `output_ceiling` as the `explicit` argument (non-None), so it returns it directly without any model lookup. This path is fine.

The subtle bug is on the analysis path: `output_ceiling = settings.sub_agent_max_output_tokens` (default 8192). This value is used as-is. For analysis tasks using `gpt-5.4-nano`, 8192 tokens is within spec. However for generation tasks `output_ceiling = max(32768, settings.sub_agent_max_output_tokens)` = 32768. If the actual `gpt-5.4-nano` model has a lower output ceiling (it is not in `_MODEL_OUTPUT_DEFAULTS` or `model-info.ts`), the API will return a 400. The model ID `gpt-5.4-nano` appears to be a placeholder/speculative ID; the currently known GPT-5 nano variant is `gpt-4.1-nano`. If `gpt-5.4-nano` does not exist in the API, every OpenAI sub-agent call will fail with a 404/model-not-found error.

**Fix:** Replace the speculative model ID with the known current model, and add it to `MODEL_INFO` and `_MODEL_OUTPUT_DEFAULTS`:

```python
# sub_agent_service.py line 18
"openai": "gpt-4.1-nano",
```

---

### WR-04: `handleReset` in SettingsPage resets context/sub-agent state to last-fetched values, but those values are shared across tabs

**File:** `frontend/src/pages/SettingsPage.tsx:643-645`

**Issue:** The Reset button at the top of the page calls `hydrate(s)` which restores **all** state fields (including context/sub-agent sliders on Tab 0, all search fields on Tab 1, and integration settings on Tab 2) regardless of which tab is active. A user who has made changes on both Tab 0 and Tab 1, switches to Tab 1, and then clicks Reset will silently discard their unsaved Tab 0 changes too. There is no confirmation prompt.

This is a UX bug rather than a data loss risk (since nothing is persisted until Save is clicked), but it is counter-intuitive enough that users will likely click Reset to undo Tab 1 edits and be surprised when their Tab 0 sliders reset too.

**Fix:** Scope the reset to the active tab. The simplest approach is to add a per-tab reset handler that only restores the fields belonging to that tab, or move the Reset button inside each tab panel next to its own Save button. At minimum, show a confirmation when the user is not on the first tab:

```tsx
const handleReset = () => {
  if (s) {
    if (activeTab !== "0" || window.confirm("Reset all unsaved changes across all tabs?")) {
      hydrate(s)
    }
  }
}
```

---

## Info

### IN-01: `estimate_tokens` uses `cl100k_base` for all `gpt-*` and `o1`/`o3` models regardless of generation

**File:** `backend/app/services/context_window.py:106`

**Issue:** GPT-4.1, GPT-5, and newer OpenAI models use the `o200k_base` encoding, not `cl100k_base`. Using the wrong tokenizer produces estimates that are off by ~5-10% on English text and up to ~15% on code/JSON. For the purposes of context trimming this means the budget check is slightly optimistic (will trim slightly less than needed). This is unlikely to cause hard failures since the practical context budgets in `MODEL_CONTEXT_DEFAULTS` already leave headroom, but it is worth correcting when tiktoken support is extended.

```python
# Suggested improvement:
_O200K_MODELS = frozenset({"gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o"})
enc = _tiktoken.get_encoding("o200k_base") if model in _O200K_MODELS else _get_cl100k()
```

---

### IN-02: `_parse_model_limits` silently ignores malformed entries without logging

**File:** `backend/app/services/context_window.py:51-62`

**Issue:** If a user typos the `MODEL_CONTEXT_LIMITS` env var (e.g. `gpt-4o=abc`), the bad entry is silently dropped and the model falls through to the provider default. There is no warning logged, so the misconfiguration is invisible.

**Fix:** Add a warning log on the `ValueError` path:

```python
except ValueError:
    logger.warning("MODEL_CONTEXT_LIMITS: invalid token count for model '%s', ignoring", model)
```

---

### IN-03: `gpt-5.4-nano` is absent from `MODEL_INFO` in `model-info.ts`

**File:** `frontend/src/lib/model-info.ts`

**Issue:** The sub-agent default `gpt-5.4-nano` (and the new `gpt-5*` family generally) has no entry in `MODEL_INFO`. Per D-12 this is by design for unknown models — no info icon is shown. However given WR-03 above, this also flags that the model ID is likely wrong. If the correct ID `gpt-4.1-nano` is used instead, it is already present in `MODEL_INFO` at line 27.

No action needed beyond resolving WR-03.

---

### IN-04: `context_window_max_tokens` has no server-side validation range in `SettingsUpdate`

**File:** `backend/app/api/settings.py:100-101`

**Issue:** `sub_agent_max_output_tokens` has `ge=4096, le=65536` bounds validation via `Field`. The sibling field `context_window_max_tokens` (line 100) has no equivalent bounds — a client could POST `context_window_max_tokens=-1` or `context_window_max_tokens=99999999`, and `save_override` would persist it. The `resolve_context_budget` function only uses the value when it is `> 0` (config.py:81), so negative values are harmlessly ignored. But an absurdly large positive value would be used verbatim and could cause the context trim logic to never trigger, potentially sending excessively long prompts.

**Fix:** Add range validation consistent with the UI slider bounds:

```python
context_window_max_tokens: int | None = Field(default=None, ge=0, le=2_000_000)
```

---

_Reviewed: 2026-04-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
