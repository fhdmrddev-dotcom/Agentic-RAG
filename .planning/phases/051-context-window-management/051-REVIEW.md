---
phase: 051-context-window-management
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - backend/app/api/settings.py
  - backend/app/models/user_settings.py
  - backend/app/services/context_window.py
  - backend/app/services/sub_agent_service.py
  - backend/tests/unit/test_context_window.py
  - backend/tests/unit/test_settings.py
  - backend/tests/unit/test_sub_agent_routing.py
  - frontend/src/components/chat/MessageInput.tsx
  - frontend/src/lib/api.ts
  - frontend/src/lib/model-info.test.ts
  - frontend/src/lib/model-info.ts
  - frontend/src/pages/SettingsPage.tsx
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 051: Code Review Report (Gap Closure — Plans 06 & 07)

**Reviewed:** 2026-04-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This review covers the Plan 06 and Plan 07 gap-closure additions to Phase 051:

- **Plan 06** — `sub_agent_model` field wired through the full backend settings stack:
  `config.py` default, `UserEffectiveSettings` model, `SettingsUpdate`/`FullSettingsResponse`
  in the API layer, `save_override`/`load_app_settings` persistence path, and the Settings
  UI (state initialisation, hydration, save handler, and dropdown).
- **Plan 07** — `costTier` field added to the `ModelInfo` TypeScript interface, populated for
  all 11 first-party model entries, and rendered as a second subtitle line in the
  `MessageInput` model dropdown.

The field additions are complete and internally consistent across backend and frontend. No
critical issues found. Two warnings and three info items follow.

The two warnings are correctness issues: one is a runtime bug that causes the
`sub_agent_model` UI setting to be silently ignored (the service reads the raw env value
rather than the override-aware resolved value), and one is a UX correctness issue where the
dropdown for sub-agent model selection cannot represent a saved value that came from outside
the active provider's model list.

## Warnings

### WR-01: `sub_agent_service.py` reads env-only `settings.sub_agent_model`, ignoring the UI-persisted override

**File:** `backend/app/services/sub_agent_service.py:70-71`

**Issue:** The model-selection block reads `settings.sub_agent_model`, where `settings` is
the raw `app.config.Settings` Pydantic object sourced from `.env` environment variables only.
The `sub_agent_model` field added in Plan 06 is stored in `settings_override.json` (via
`save_override`) and is exposed through `UserEffectiveSettings.sub_agent_model` (resolved by
`load_app_settings()`). Because `run_sub_agent` already receives
`user_settings: UserEffectiveSettings | None`, the UI-persisted override is available on
`user_settings.sub_agent_model` — but the routing code never reads it.

A user who sets "Sub-agent model" in the Settings UI will see no runtime effect. The raw env
value (`""` unless `SUB_AGENT_MODEL=` is set in `.env`) wins unconditionally, making the
entire Plan 06 UI slider non-functional at runtime.

The same bug exists in `backend/app/services/suggestion_service.py` lines 45-46 (outside
this review's scope but noted for completeness).

**Fix:**

```python
# sub_agent_service.py — replace the model-resolution block starting at line 70

# Priority: user_settings override (UI/JSON) > env override (.env) > provider default
override_model = (
    (user_settings.sub_agent_model if user_settings else "")
    or settings.sub_agent_model
)

if override_model:
    effective_model = override_model
elif is_generation:
    # D-02: escalate to orchestrator model for generation tasks
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

---

### WR-02: Sub-agent model dropdown in `SettingsPage.tsx` cannot represent a saved value outside the active provider's model list

**File:** `frontend/src/pages/SettingsPage.tsx:791-804`

**Issue:** The `<select>` for "Sub-agent model" is populated solely from `activeModels` — the
model list belonging to the currently active LLM provider. If a user has a saved
`sub_agent_model` value that is not in `activeModels` (e.g. set via a previous provider's
model, set via env var, or carried over from a provider switch), `hydrate()` at line 555
correctly sets `subAgentModel` from the API response, but no matching `<option>` exists in
the dropdown. The browser silently resets the `<select>` control to the first option
("Auto (cheapest)"), meaning:

1. The UI falsely shows "Auto" even though a specific model is saved.
2. If the user clicks "Save AI Model" without changing anything, `subAgentModel` will be
   sent as `""`, overwriting the previously saved value with an empty string.

This is a data-loss risk on save: a user visiting the settings page where the active provider
differs from the one used when the sub-agent model was originally configured will silently
clear the sub-agent model on the next save.

**Fix (minimal):** Replace the `<select>` with a free-text `<input>` (which matches how
`llmModel` is handled via `TextInput`):

```tsx
<FieldRow label="Sub-agent model">
  <TextInput
    value={subAgentModel}
    onChange={setSubAgentModel}
    placeholder="Leave blank for auto (cheapest per provider)"
  />
</FieldRow>
```

**Fix (if dropdown is preferred):** Pre-inject the saved value as an option when it is not
already in `activeModels`:

```tsx
<select
  value={subAgentModel}
  onChange={(e) => setSubAgentModel(e.target.value)}
  className="w-full h-8 text-xs font-mono bg-muted/30 border border-input rounded px-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
>
  <option value="">Auto (cheapest)</option>
  {subAgentModel &&
    !activeModels.split(",").map((m) => m.trim()).includes(subAgentModel) && (
      <option value={subAgentModel}>{subAgentModel} (current)</option>
  )}
  {activeModels
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => (
      <option key={m} value={m}>{m}</option>
    ))}
</select>
```

## Info

### IN-01: `test_settings.py` has no coverage for the new `sub_agent_model` field

**File:** `backend/tests/unit/test_settings.py`

**Issue:** The three existing tests cover `sub_agent_max_output_tokens` range validation,
`FullSettingsResponse` field presence, and the `config.py` default. None verify that
`sub_agent_model` appears on `FullSettingsResponse` or `SettingsUpdate`, or that the
`load_app_settings` round-trip through `save_override` preserves the value.

**Fix:** Add at minimum:

```python
def test_sub_agent_model_field_in_response():
    from app.api.settings import FullSettingsResponse
    assert "sub_agent_model" in FullSettingsResponse.model_fields

def test_sub_agent_model_accepted_by_settings_update():
    from app.api.settings import SettingsUpdate
    s = SettingsUpdate(sub_agent_model="gpt-4.1-nano")
    assert s.sub_agent_model == "gpt-4.1-nano"

def test_sub_agent_model_empty_string_accepted():
    from app.api.settings import SettingsUpdate
    s = SettingsUpdate(sub_agent_model="")
    assert s.sub_agent_model == ""
```

---

### IN-02: `test_sub_agent_routing.py` does not test the `sub_agent_model` UI-override path

**File:** `backend/tests/unit/test_sub_agent_routing.py`

**Issue:** All routing tests use `patch.object(settings, "sub_agent_model", ...)` to patch
the env-layer config. After WR-01 is fixed, the correct override path will be
`user_settings.sub_agent_model`. The existing tests will not cover the new code path and
will continue to pass even if the fix is applied incorrectly (because they patch the wrong
layer).

**Fix:** Add a test that patches via `user_settings` rather than `settings`:

```python
def test_user_settings_sub_agent_model_wins_over_env():
    """user_settings.sub_agent_model (UI override) takes priority over env setting."""
    from app.services import sub_agent_service
    from app.config import settings

    user_settings = _make_user_settings(provider="openai", llm_model="gpt-4o")
    user_settings.sub_agent_model = "gpt-4.1-nano"   # set on the namespace

    with patch.object(settings, "sub_agent_model", ""):
        # Replicate the corrected routing logic
        override_model = user_settings.sub_agent_model or settings.sub_agent_model
        assert override_model == "gpt-4.1-nano"
```

---

### IN-03: `_build_candidate` `trimmable is not None` guard is unreachable dead code

**File:** `backend/app/services/context_window.py:232`

**Issue:** The marker-insertion guard reads `if add_marker and trimmable is not None`. The
`trimmable is not None` check is always `True`: `trimmable` is typed and called as
`list[dict]` at every call site; no caller ever passes `None`. The dead guard slightly
misleads readers into thinking `None` is a valid sentinel.

**Fix:**

```python
# line 232: change
if add_marker and trimmable is not None:
# to
if add_marker:
```

---

_Reviewed: 2026-04-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
