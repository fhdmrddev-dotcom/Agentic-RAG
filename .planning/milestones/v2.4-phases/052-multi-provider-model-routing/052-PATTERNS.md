# Phase 52: Multi-Provider Model Routing - Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 7 (5 backend, 2 frontend)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/sub_agent_service.py` | service | streaming | self (modify) | exact |
| `backend/app/services/suggestion_service.py` | service | request-response | `sub_agent_service.py` | exact |
| `backend/app/api/threads.py` | controller | SSE/event-driven | self (modify) | exact |
| `backend/app/models/user_settings.py` | model | config I/O | self (modify) | exact |
| `backend/app/api/settings.py` | controller | request-response | self (modify) | exact |
| `frontend/src/lib/api.ts` | utility | request-response | self (modify) | exact |
| `frontend/src/pages/SettingsPage.tsx` | component | request-response | self (modify) | exact |

---

## Pattern Assignments

### `backend/app/services/sub_agent_service.py` — 404 fallback + model resolution

**What changes:** Add `try/except openai.NotFoundError` around `client.chat.completions.create`, retry with fallback model, yield a `fallback_model` SSE chunk so the caller (`event_stream()`) can re-yield it.

**Imports to add** (current file lines 1-8):
```python
from __future__ import annotations
from typing import TYPE_CHECKING, Generator
from langsmith import traceable
from app.config import settings
from app.services.openai_service import get_llm_client, _resolve_max_tokens, _uses_max_completion_tokens
# ADD:
import json
import openai
```

**Existing model resolution pattern** (lines 69-92) — the fallback model is already derivable from this block:
```python
override_model = (
    (user_settings.sub_agent_model if user_settings else "")
    or settings.sub_agent_model
)

if override_model:
    effective_model = override_model
elif is_generation:
    effective_model = (
        (user_settings.llm_model if user_settings else None)
        or model
        or settings.llm_model
    )
else:
    provider = user_settings.active_provider if user_settings else ""
    provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
    effective_model = (
        provider_default
        or (user_settings.llm_model if user_settings else None)
        or model
        or settings.llm_model
    )
```

**Fallback model derivation pattern** — when `openai.NotFoundError` fires, derive fallback using same chain but skip the override:
```python
# _fallback_model(): replicate the non-override branch of the resolution above
provider = user_settings.active_provider if user_settings else ""
fallback_model = (
    _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
    or (user_settings.llm_model if user_settings else None)
    or model
    or settings.llm_model
)
```

**Streaming create call to wrap** (lines 102-111):
```python
stream = client.chat.completions.create(
    model=effective_model,
    messages=messages,
    stream=True,
    **{token_param: resolved_tokens},
)
for chunk in stream:
    if chunk.choices and chunk.choices[0].delta.content:
        yield chunk.choices[0].delta.content
```

**Pattern to apply — wrap the streaming block:**
```python
_original_model = effective_model
try:
    stream = client.chat.completions.create(
        model=effective_model,
        messages=messages,
        stream=True,
        **{token_param: resolved_tokens},
    )
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
except openai.NotFoundError:
    # 404 = model not found on this provider — retry with provider default
    provider = user_settings.active_provider if user_settings else ""
    fallback = (
        _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
        or (user_settings.llm_model if user_settings else None)
        or model
        or settings.llm_model
    )
    if not fallback or fallback == _original_model:
        raise  # no better fallback available
    # Emit fallback notification as a special sentinel chunk (caller re-yields as SSE)
    yield json.dumps({"__type": "fallback_model", "original_model": _original_model, "fallback_model": fallback})
    token_param2 = "max_completion_tokens" if _uses_max_completion_tokens(fallback) else "max_tokens"
    stream2 = client.chat.completions.create(
        model=fallback,
        messages=messages,
        stream=True,
        **{token_param2: resolved_tokens},
    )
    for chunk in stream2:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
```

**Note on sentinel design:** The generator is `Generator[str, None, None]` — it can only yield strings. Use a JSON-encoded sentinel string (e.g. `__type: fallback_model`) so the caller in `threads.py` can detect and re-emit the proper SSE event without changing the generator's type signature.

---

### `backend/app/services/suggestion_service.py` — 404 fallback (non-streaming)

**What changes:** Add `try/except openai.NotFoundError` around `client.chat.completions.create`, retry with fallback model, return a `(result, fallback_info)` tuple so `event_stream()` can emit the SSE event.

**Current function signature** (line 23):
```python
def generate_suggestions(
    user_message: str,
    assistant_response: str,
    user_settings: "UserEffectiveSettings | None" = None,
) -> list[str]:
```

**New signature (tuple return):**
```python
def generate_suggestions(
    user_message: str,
    assistant_response: str,
    user_settings: "UserEffectiveSettings | None" = None,
) -> tuple[list[str], dict | None]:
    """Returns (questions, fallback_info).
    fallback_info is None normally; {"original_model": ..., "fallback_model": ...} on 404 retry."""
```

**Existing model resolution** (lines 44-58) — identical to sub_agent_service, copy the same fallback derivation pattern.

**Non-streaming create call to wrap** (lines 61-66):
```python
resp = client.chat.completions.create(
    model=effective_model,
    messages=messages,
    stream=False,
    **{token_param: 200},
)
```

**Pattern to apply:**
```python
_original_model = effective_model
fallback_info: dict | None = None
try:
    resp = client.chat.completions.create(
        model=effective_model,
        messages=messages,
        stream=False,
        **{token_param: 200},
    )
except openai.NotFoundError:
    provider = user_settings.active_provider if user_settings else ""
    fallback = (
        _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
        or (user_settings.llm_model if user_settings else None)
        or settings.llm_model
    )
    if not fallback or fallback == _original_model:
        raise
    fallback_info = {"original_model": _original_model, "fallback_model": fallback}
    token_param2 = "max_completion_tokens" if _uses_max_completion_tokens(fallback) else "max_tokens"
    resp = client.chat.completions.create(
        model=fallback,
        messages=messages,
        stream=False,
        **{token_param2: 200},
    )
content = resp.choices[0].message.content or ""
questions = [q.strip() for q in content.split("\n") if q.strip()]
return questions[:3], fallback_info
```

**Import to add:**
```python
import openai
```

---

### `backend/app/api/threads.py` — fallback SSE event + generate_thread_title 404 fallback

**What changes:**
1. In `generate_thread_title()` — add `try/except openai.NotFoundError` around the create call, return `(title, fallback_info)` tuple.
2. In `event_stream()` — detect sentinel chunks from `run_sub_agent()`, re-yield as `fallback_model` SSE event; handle `(questions, fallback_info)` from `generate_suggestions()`; handle `(title, fallback_info)` from `generate_thread_title()`.

**`skill_activated` SSE event pattern (exact)** — line 879:
```python
yield f"data: {json.dumps({'type': 'skill_activated', 'skill_name': skill_name})}\n\n"
```

**`fallback_model` SSE event — follow this exact shape:**
```python
yield f"data: {json.dumps({'type': 'fallback_model', 'original_model': original, 'fallback_model': fallback})}\n\n"
```

**Current `generate_thread_title` function** (lines 259-292):
```python
def generate_thread_title(first_user_message: str, user_settings=None) -> str:
    """Call LLM to produce a short thread title from the first user message."""
    try:
        client = get_llm_client(user_settings)
        override = (
            (user_settings.sub_agent_model if user_settings else "")
            or settings.sub_agent_model
        )
        if override:
            model = override
        else:
            provider = user_settings.active_provider if user_settings else ""
            model = (
                _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
                or (user_settings.llm_model if user_settings else settings.llm_model)
            )
        token_param = "max_completion_tokens" if _uses_max_completion_tokens(model) else "max_tokens"
        response = client.chat.completions.create(
            model=model,
            messages=[...],
            stream=False,
            **{token_param: 20},
        )
        return response.choices[0].message.content.strip() or "New Chat"
    except Exception:
        return first_user_message[:40].strip() or "New Chat"
```

**New signature:**
```python
def generate_thread_title(
    first_user_message: str,
    user_settings=None,
) -> tuple[str, dict | None]:
    """Returns (title, fallback_info). fallback_info is None unless a 404 retry occurred."""
```

**Pattern for 404 wrap inside generate_thread_title** — insert `except openai.NotFoundError` before the outer `except Exception` catch:
```python
import openai  # add to imports at top of file

try:
    # ... existing create call ...
    return response.choices[0].message.content.strip() or "New Chat", None
except openai.NotFoundError:
    provider = user_settings.active_provider if user_settings else ""
    fallback = (
        _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
        or (user_settings.llm_model if user_settings else settings.llm_model)
    )
    if not fallback or fallback == model:
        return first_user_message[:40].strip() or "New Chat", None
    fallback_info = {"original_model": model, "fallback_model": fallback}
    token_param2 = "max_completion_tokens" if _uses_max_completion_tokens(fallback) else "max_tokens"
    response = client.chat.completions.create(
        model=fallback,
        messages=[...],
        stream=False,
        **{token_param2: 20},
    )
    return response.choices[0].message.content.strip() or "New Chat", fallback_info
except Exception:
    return first_user_message[:40].strip() or "New Chat", None
```

**In `event_stream()` — sentinel detection for run_sub_agent** (current sub-agent streaming block, lines 864-874):
```python
for text_chunk in run_sub_agent(...):
    sub_agent_content += text_chunk
    yield f"data: {json.dumps({'type': 'sub_agent_delta', 'content': text_chunk})}\n\n"
```

**Replace with sentinel-detection loop:**
```python
for text_chunk in run_sub_agent(...):
    # Detect fallback sentinel emitted by sub_agent_service
    if text_chunk.startswith('{"__type": "fallback_model"'):
        try:
            sentinel = json.loads(text_chunk)
            yield f"data: {json.dumps({'type': 'fallback_model', 'original_model': sentinel['original_model'], 'fallback_model': sentinel['fallback_model']})}\n\n"
        except (json.JSONDecodeError, KeyError):
            pass
        continue
    sub_agent_content += text_chunk
    yield f"data: {json.dumps({'type': 'sub_agent_delta', 'content': text_chunk})}\n\n"
```

**In `event_stream()` — suggestions call** (current lines 1431-1440):
```python
questions = generate_suggestions(
    user_message=body.content,
    assistant_response=full_content,
    user_settings=user_settings,
)
if questions:
    yield f"data: {json.dumps({'type': 'suggestions', 'questions': questions[:3]})}\n\n"
```

**Replace with tuple-aware call:**
```python
questions, sugg_fallback = generate_suggestions(
    user_message=body.content,
    assistant_response=full_content,
    user_settings=user_settings,
)
if sugg_fallback:
    yield f"data: {json.dumps({'type': 'fallback_model', **sugg_fallback})}\n\n"
if questions:
    yield f"data: {json.dumps({'type': 'suggestions', 'questions': questions[:3]})}\n\n"
```

**In `event_stream()` — title generation call** (current lines 1419-1422):
```python
title = generate_thread_title(first_user_msg, user_settings=user_settings)
try:
    supabase.table("threads").update({"title": title}).eq("id", thread_id).execute()
    yield f"data: {json.dumps({'type': 'title', 'content': title})}\n\n"
```

**Replace with tuple-aware call:**
```python
title, title_fallback = generate_thread_title(first_user_msg, user_settings=user_settings)
if title_fallback:
    yield f"data: {json.dumps({'type': 'fallback_model', **title_fallback})}\n\n"
try:
    supabase.table("threads").update({"title": title}).eq("id", thread_id).execute()
    yield f"data: {json.dumps({'type': 'title', 'content': title})}\n\n"
```

---

### `backend/app/models/user_settings.py` — `resolved_sub_agent_model` computation

**What changes:** Add a `resolved_sub_agent_model` helper function (or inline it in `load_app_settings`) that replicates the model resolution logic from `sub_agent_service.py` using already-loaded settings.

**Existing `load_app_settings` return** (lines 226-266) — currently returns `UserEffectiveSettings`. Two options per CONTEXT.md "Claude's Discretion":
- Option A: add `resolved_sub_agent_model: str` field directly to `UserEffectiveSettings`
- Option B: compute it in `settings.py`'s `_build_response()` from the loaded `UserEffectiveSettings`

**Recommended: Option B** (no model change needed). Add a helper in `user_settings.py`:
```python
from app.services.sub_agent_service import _SUB_AGENT_MODEL_DEFAULTS

def resolve_sub_agent_model(s: UserEffectiveSettings) -> str:
    """Return the model that would actually be used for sub-agent calls right now."""
    override = s.sub_agent_model or settings_ref.sub_agent_model  # settings_ref = env_settings
    if override:
        return override
    provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(s.active_provider, "")
    return provider_default or s.llm_model
```

**Circular import note:** `sub_agent_service.py` imports from `user_settings.py`, so importing `_SUB_AGENT_MODEL_DEFAULTS` back into `user_settings.py` creates a cycle. To avoid this, move `_SUB_AGENT_MODEL_DEFAULTS` to `config.py` (it has no imports from user_settings) and import it from there in both files. Alternatively, inline the dict in `user_settings.py` as a local constant — copy from `sub_agent_service.py` lines 15-21.

**Copy of dict (to inline in user_settings.py or config.py):**
```python
_SUB_AGENT_MODEL_DEFAULTS: dict[str, str] = {
    "anthropic":  "claude-haiku-4-5-20251001",
    "openai":     "gpt-4.1-nano",
    "google":     "gemini-2.5-flash",
    "openrouter": "",
    "ollama":     "",
}
```

---

### `backend/app/api/settings.py` — `resolved_sub_agent_model` in GET + validation in PATCH

**What changes:**
1. Add `resolved_sub_agent_model: str` to `FullSettingsResponse` and populate it in `_build_response()`.
2. In `update_settings()` (PUT handler), validate `body.sub_agent_model` against the active provider's `available_models` list before calling `save_override()`.

**Existing `FullSettingsResponse` model** (lines 27-62) — add one field:
```python
class FullSettingsResponse(BaseModel):
    # ... all existing fields ...
    sub_agent_model: str
    resolved_sub_agent_model: str   # ADD: what would actually be used right now
```

**Existing `_build_response()` return** (lines 110-151) — add one line:
```python
return FullSettingsResponse(
    # ... all existing fields ...
    sub_agent_model=s.sub_agent_model,
    resolved_sub_agent_model=resolve_sub_agent_model(s),   # ADD
)
```

**Validation pattern in PUT handler** — insert before `save_override(updates)` at line 238. Model: follow the pattern used for the Pydantic `Field(ge=..., le=...)` constraint on `sub_agent_max_output_tokens` (line 104), but runtime validation because the valid set is dynamic:
```python
# Validate sub_agent_model against active provider's model list
if body.sub_agent_model:
    # Re-load to get the current active provider (may have just been changed in this request)
    pending_provider = body.active_provider or updates.get("llm_provider") or load_app_settings().active_provider
    provider_obj = next(
        (p for p in load_app_settings().providers if p.id == pending_provider),
        None,
    )
    if provider_obj and provider_obj.models and body.sub_agent_model not in provider_obj.models:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=422,
            detail=f"Model '{body.sub_agent_model}' is not available for provider '{pending_provider}'. "
                   f"Available: {', '.join(provider_obj.models)}",
        )
```

**How the frontend currently surfaces PATCH/PUT errors** (api.ts line 469):
```typescript
if (!res.ok) throw new Error("Failed to save settings")
```
The 422 detail is NOT forwarded by this current code — `updateSettings()` in api.ts must be updated to extract the detail message from the JSON response body when `!res.ok`. See Frontend section below.

---

### `frontend/src/lib/api.ts` — error detail extraction + new event types

**What changes:**
1. `updateSettings()` — extract FastAPI validation error detail and throw it as the message.
2. `streamMessage()` signature + parser — add `onFallbackModel` callback and wire `fallback_model` SSE event.
3. `FullAppSettings` — add `resolved_sub_agent_model: string`.
4. `SettingsUpdate` — no changes needed (sub_agent_model already present).

**Current updateSettings** (lines 462-471):
```typescript
export async function updateSettings(body: SettingsUpdate): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to save settings")
  return res.json() as Promise<FullAppSettings>
}
```

**New version (extract detail for inline error):**
```typescript
export async function updateSettings(body: SettingsUpdate): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    try {
      const err = await res.json() as { detail?: string | Array<{ msg: string }> }
      if (typeof err.detail === "string") throw new Error(err.detail)
      if (Array.isArray(err.detail)) throw new Error(err.detail.map((e) => e.msg).join("; "))
    } catch {
      // fall through if body isn't parseable JSON
    }
    throw new Error("Failed to save settings")
  }
  return res.json() as Promise<FullAppSettings>
}
```

**Add to `FullAppSettings` interface** (after line 415):
```typescript
sub_agent_model: string
resolved_sub_agent_model: string   // ADD
```

**Add `onFallbackModel` to `streamMessage` signature** (after `onPlanning` param, line 120):
```typescript
onFallbackModel?: (originalModel: string, fallbackModel: string) => void,
```

**Add to SSE parser block** (after `onPlanning` handler, around line 204):
```typescript
} else if (parsed.type === "fallback_model" && onFallbackModel) {
  onFallbackModel(parsed.original_model as string, parsed.fallback_model as string)
}
```

---

### `frontend/src/pages/SettingsPage.tsx` — inline validation error + read-only labels + fallback toast

**What changes:**
1. Add `subAgentModelError` state for inline validation error under the sub-agent model dropdown.
2. Add `resolved_sub_agent_model` hydration from settings response.
3. Add two read-only info rows under the dropdown showing resolved title/follow-up model.
4. Add fallback toast notification when `fallback_model` SSE event arrives (via `onFallbackModel` callback).

**Existing state declarations** (lines 520-523):
```typescript
// Context & Sub-agent
const [contextWindowMaxTokens, setContextWindowMaxTokens] = useState(0)
const [subAgentMaxOutputTokens, setSubAgentMaxOutputTokens] = useState(8192)
const [subAgentModel, setSubAgentModel] = useState("")
```

**Add:**
```typescript
const [subAgentModelError, setSubAgentModelError] = useState<string | null>(null)
const [resolvedSubAgentModel, setResolvedSubAgentModel] = useState("")
```

**Hydration** (after line 557):
```typescript
setSubAgentModel(data.sub_agent_model ?? "")
setResolvedSubAgentModel(data.resolved_sub_agent_model ?? "")  // ADD
```

**`handleSaveAIModel` error pattern** (lines 567-593):
```typescript
const handleSaveAIModel = async () => {
  setSavingAI(true)
  setError(null)
  setSubAgentModelError(null)   // ADD: clear field error on new save attempt
  try {
    const updated = await updateSettings(body)
    hydrate(updated)
    setSavedAI(true)
    setTimeout(() => setSavedAI(false), 2500)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save AI Model settings"
    // If error message mentions a specific model/provider, show as inline field error
    if (msg.includes("is not available for provider")) {
      setSubAgentModelError(msg)
    } else {
      setError(msg)
    }
  } finally {
    setSavingAI(false)
  }
}
```

**Existing amber warning inline pattern** (line 935-938 — Tavily key missing warning):
```tsx
{webSearchEnabled && tavilyApiKey === "" && (
  <p className="text-xs text-amber-400 px-3 pb-1">
    No Tavily API key configured — web search will not run.
  </p>
)}
```

**Inline validation error under sub-agent dropdown** — use `text-destructive` (matches the save-level error at line 668):
```tsx
<FieldRow label="Sub-agent model">
  <select ... >
    {/* existing options */}
  </select>
  {subAgentModelError && (
    <p className="text-xs text-destructive mt-1">{subAgentModelError}</p>
  )}
</FieldRow>
```

**Read-only label rows** (after the `</FieldRow>` that closes the sub-agent model dropdown, before the closing `</SectionCard>` at line 813):
```tsx
{/* D-09: Read-only resolved model labels for title & follow-up */}
<FieldRow label="Title drafting">
  <span className="text-xs text-muted-foreground font-mono">
    {subAgentModel ? subAgentModel : `${resolvedSubAgentModel || "auto"} (auto)`}
  </span>
</FieldRow>
<FieldRow label="Follow-up suggestions">
  <span className="text-xs text-muted-foreground font-mono">
    {subAgentModel ? subAgentModel : `${resolvedSubAgentModel || "auto"} (auto)`}
  </span>
</FieldRow>
```

**Fallback toast — no toast library exists in the project.** Use an ephemeral banner state instead, following the existing `savedAI` / `error` transient feedback pattern:

```typescript
const [fallbackNotice, setFallbackNotice] = useState<string | null>(null)

// In streamMessage onFallbackModel callback:
onFallbackModel: (original, fallback) => {
  setFallbackNotice(`Model ${original} unavailable — using ${fallback}`)
  setTimeout(() => setFallbackNotice(null), 4000)
}
```

Render as a banner above the message list (follow the same `text-sm text-destructive bg-destructive/10` style seen at line 405, but use amber for a softer warning):
```tsx
{fallbackNotice && (
  <div className="text-xs text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-md">
    {fallbackNotice}
  </div>
)}
```

**Where to wire the callback:** The `streamMessage` call lives in `useMessages.ts` hook. Check where `onSkillActivated` is already wired there — the `fallbackNotice` state will need to either live in the hook or be passed as a setter callback from the component that renders the banner (e.g., `ChatArea.tsx`).

---

## Shared Patterns

### `openai.NotFoundError` catch — all three backend callers
**Source:** `openai` Python SDK (imported as `import openai`)
**Apply to:** `run_sub_agent()`, `generate_suggestions()`, `generate_thread_title()`

The correct exception class is `openai.NotFoundError` (not `openai.APIError` which is broader). The project already catches `openai.APIError` in `threads.py` at lines 693 and 1339 — `NotFoundError` is a subclass, so the specific catch MUST come before any `APIError` catch to prevent it being swallowed.

```python
except openai.NotFoundError:
    # 404 = model not found — fallback applies
    ...
except openai.APIError:
    # other API errors — surface directly
    raise
```

### SSE event shape — all event emitters in `threads.py`
**Source:** `threads.py` lines 677, 768, 863, 879 (multiple event types)
**Pattern:** Always `yield f"data: {json.dumps({'type': '<event_name>', ...})}\n\n"`

The `fallback_model` event follows this exactly:
```python
yield f"data: {json.dumps({'type': 'fallback_model', 'original_model': original_model, 'fallback_model': fallback_model})}\n\n"
```

### Settings PATCH validation error pattern
**Source:** `backend/app/api/settings.py` — existing `Field(ge=4096, le=65536)` on `sub_agent_max_output_tokens` (line 104) for range validation; the new sub_agent_model validation uses `HTTPException(status_code=422)` for dynamic list validation.

FastAPI automatically returns `{"detail": "..."}` JSON for both `HTTPException` and Pydantic validation errors — the frontend `updateSettings()` must parse this to surface field-specific messages.

### Inline field error styling
**Source:** `SettingsPage.tsx` line 371 and 668
```tsx
<p className="text-xs text-destructive mt-1">{errorMessage}</p>
```

### Amber informational warning styling
**Source:** `SettingsPage.tsx` line 935-938 (Tavily key warning)
```tsx
<p className="text-xs text-amber-400 px-3 pb-1">{warningMessage}</p>
```

---

## No Analog Found

All files in this phase are modifications to existing files. No new files without analogs.

---

## Metadata

**Analog search scope:** `backend/app/services/`, `backend/app/api/`, `backend/app/models/`, `backend/app/config.py`, `frontend/src/lib/api.ts`, `frontend/src/pages/SettingsPage.tsx`
**Files scanned:** 7 source files read in full
**Pattern extraction date:** 2026-04-25
