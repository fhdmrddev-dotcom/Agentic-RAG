---
phase: 051-context-window-management
verified: 2026-04-23T00:00:00Z
status: gaps_found
score: 3/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Settings page exposes sliders for context history depth and sub-agent output token ceiling, AND a dropdown for sub-agent model override"
    status: partial
    reason: "Two sliders (context depth, sub-agent output tokens) are implemented and wired. The sub-agent model override dropdown is entirely absent from SettingsPage.tsx. Both REQUIREMENTS.md CTX-03 and ROADMAP SC #3 explicitly require it. Plan 04 noted it was out of scope for that plan ('not required by CTX-03') but the roadmap contract requires it."
    artifacts:
      - path: "frontend/src/pages/SettingsPage.tsx"
        issue: "Context & Sub-Agent SectionCard has 2 SliderInput rows only — no sub-agent model override dropdown control"
      - path: "backend/app/api/settings.py"
        issue: "sub_agent_model field is not present in SettingsUpdate or FullSettingsResponse — the config field exists in config.py but is not surfaced through the settings API"
      - path: "frontend/src/lib/api.ts"
        issue: "sub_agent_model is absent from FullAppSettings and SettingsUpdate interfaces"
    missing:
      - "Dropdown (or select) control in Context & Sub-Agent SectionCard for sub_agent_model override"
      - "sub_agent_model field in FullSettingsResponse and SettingsUpdate in backend/app/api/settings.py"
      - "sub_agent_model field in FullAppSettings and SettingsUpdate in frontend/src/lib/api.ts"
      - "sub_agent_model in UserEffectiveSettings and load_app_settings() in backend/app/models/user_settings.py"

  - truth: "Each model in the model selector shows an inline info card with context window, output limit, cost tier, and best-for label"
    status: partial
    reason: "MODEL_INFO entries show context window, max output tokens, and best-for label. The 'cost tier' field is absent from ModelInfo interface and all 11 model entries. REQUIREMENTS.md CTX-04 and ROADMAP SC #4 both list cost tier as a required data point in the info card. The tooltip in MessageInput renders only 3 data points."
    artifacts:
      - path: "frontend/src/lib/model-info.ts"
        issue: "ModelInfo interface has contextWindow, maxOutputTokens, bestFor — no costTier field. All 11 entries lack cost tier data."
      - path: "frontend/src/components/chat/MessageInput.tsx"
        issue: "TooltipContent renders Context, Max output, Best for — no cost tier line"
    missing:
      - "costTier field in ModelInfo interface (e.g. 'low' | 'mid' | 'high' or a string label)"
      - "costTier value for each of the 11 model entries in MODEL_INFO"
      - "Cost tier row in the TooltipContent in MessageInput.tsx"
---

# Phase 051: Context Window Management Verification Report

**Phase Goal:** Context limits are handled intelligently across all providers — sub-agents route complex generation tasks (PPTX, reports) to capable models, output token ceilings are configurable per task type, and admins can tune context behaviour from the Settings UI with inline per-model documentation
**Verified:** 2026-04-23
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sub-agent escalates generation tasks (pptx/report/pdf/spreadsheet/excel/csv export) to orchestrator model with 32768 output ceiling | VERIFIED | `_GENERATION_KEYWORDS` frozenset (9 keywords) at line 24 of `sub_agent_service.py`; `_is_generation_task()` at line 31; `max(32768, settings.sub_agent_max_output_tokens)` at line 91 |
| 2 | Analysis tasks (summarise/extract/list/compare) continue to use cheap sub-agent model via `_SUB_AGENT_MODEL_DEFAULTS` | VERIFIED | else-branch at lines 79-87 of `sub_agent_service.py` preserves `_SUB_AGENT_MODEL_DEFAULTS` lookup; analysis ceiling uses `settings.sub_agent_max_output_tokens` |
| 3 | Settings page exposes context depth slider, sub-agent output token slider, AND sub-agent model override dropdown | PARTIAL FAIL | Two sliders are present and wired (see SettingsPage.tsx lines 758-783). Dropdown for `sub_agent_model` override is absent from all layers (SettingsPage.tsx, api.ts, settings.py, user_settings.py) |
| 4 | Each model in the selector shows an info card with context window, output limit, cost tier, and best-for label | PARTIAL FAIL | MODEL_INFO has 11 entries with contextWindow/maxOutputTokens/bestFor. `costTier` field is not present in ModelInfo interface or any entry; tooltip renders only 3 data points |
| 5 | Token estimation for OpenAI models uses tiktoken (cl100k_base); other providers use char heuristic | VERIFIED | `_TIKTOKEN_AVAILABLE`, `_get_cl100k()`, and `model.startswith("gpt-")` branch present in `context_window.py` lines 15-110; `tiktoken>=0.12.0` in requirements.txt |

**Score:** 3/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/sub_agent_service.py` | `_GENERATION_KEYWORDS` frozenset + `_is_generation_task()` + routing logic | VERIFIED | Frozenset at line 24, function at line 31, routing replaces hardcoded 8192 at lines 89-95 |
| `backend/app/config.py` | `sub_agent_max_output_tokens: int = 8192` | VERIFIED | Line 193: `sub_agent_max_output_tokens: int = 8192` |
| `backend/app/services/context_window.py` | `_TIKTOKEN_AVAILABLE`, `_get_cl100k()`, updated `estimate_tokens(text, model="")` | VERIFIED | Lines 15-42 for tiktoken block; line 94 for updated signature |
| `backend/requirements.txt` | `tiktoken>=0.12.0` | VERIFIED | Line 5 |
| `backend/app/models/user_settings.py` | `sub_agent_max_output_tokens: int` in UserEffectiveSettings + `load_app_settings()` wiring | VERIFIED | Line 84 (field); line 261 (`_int(override, "sub_agent_max_output_tokens", ...)`) |
| `backend/app/api/settings.py` | `sub_agent_max_output_tokens` in FullSettingsResponse, SettingsUpdate (ge=4096, le=65536), `_build_response()`, handler | VERIFIED | Lines 59, 101, 144, 221 |
| `frontend/src/lib/api.ts` | `sub_agent_max_output_tokens` in FullAppSettings and SettingsUpdate | VERIFIED | Lines 413, 449 |
| `frontend/src/pages/SettingsPage.tsx` | SliderInput component + state + hydrate + save + Context & Sub-Agent SectionCard | VERIFIED | SliderInput at line 64; state at lines 520-521; hydrate at lines 552-553; save at lines 576-577; SectionCard at lines 758-783 |
| `frontend/src/lib/model-info.ts` | ModelInfo interface + MODEL_INFO with 11 entries including cost tier | STUB | Interface exists with 3 fields (contextWindow, maxOutputTokens, bestFor) — costTier field absent; 11 entries present but no cost tier data |
| `frontend/src/components/chat/MessageInput.tsx` | Info icon + Tooltip with context/output/costTier/bestFor for known models | PARTIAL | TooltipProvider + Tooltip + Info icon all present; tooltip renders 3 of 4 required data points — cost tier row missing |
| `backend/app/api/settings.py` | `sub_agent_model` in FullSettingsResponse and SettingsUpdate | MISSING | sub_agent_model is a config field in config.py but is not surfaced in any settings API layer |
| `frontend/src/pages/SettingsPage.tsx` | Sub-agent model override dropdown in Context & Sub-Agent SectionCard | MISSING | SectionCard contains only 2 SliderInput rows; no dropdown for sub_agent_model |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `run_sub_agent()` | `_is_generation_task()` | `is_generation = _is_generation_task(task)` | WIRED | Line 68 of sub_agent_service.py |
| `_is_generation_task()` | `_GENERATION_KEYWORDS` | `any(kw in t for kw in _GENERATION_KEYWORDS)` | WIRED | Line 39 of sub_agent_service.py |
| `run_sub_agent()` | `settings.sub_agent_max_output_tokens` | `output_ceiling = settings.sub_agent_max_output_tokens` (analysis) / `max(32768, ...)` (generation) | WIRED | Lines 91-93 |
| `estimate_tokens()` | `_get_cl100k()` | `enc = _get_cl100k(); return len(enc.encode(text))` | WIRED | Lines 107-109 of context_window.py |
| `SettingsPage.tsx hydrate()` | `FullAppSettings.sub_agent_max_output_tokens` | `setSubAgentMaxOutputTokens(data.sub_agent_max_output_tokens ?? 8192)` | WIRED | Line 553 |
| `SettingsPage.tsx handleSaveAIModel()` | `PUT /api/settings` | body includes `sub_agent_max_output_tokens: subAgentMaxOutputTokens` | WIRED | Line 577 |
| `_build_response()` | `UserEffectiveSettings.sub_agent_max_output_tokens` | `sub_agent_max_output_tokens=s.sub_agent_max_output_tokens` | WIRED | Line 144 of settings.py |
| `MessageInput.tsx models.map()` | `MODEL_INFO[m]` | `const info = MODEL_INFO[m]` | WIRED | Line 202 of MessageInput.tsx |
| `TooltipProvider` | `models.map()` | TooltipProvider hoisted above map | WIRED | Lines 200, 236 of MessageInput.tsx |
| `SettingsPage.tsx` | `sub_agent_model` dropdown | sub_agent_model setting in Context & Sub-Agent SectionCard | NOT_WIRED | No dropdown exists; config field not surfaced through any layer |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SettingsPage.tsx` | `subAgentMaxOutputTokens` | `GET /api/settings` → `data.sub_agent_max_output_tokens` → `_build_response()` → `UserEffectiveSettings` → `settings_override.json` / `.env` | Yes — defaults to 8192 from config, persisted in override file | FLOWING |
| `SettingsPage.tsx` | `contextWindowMaxTokens` | `GET /api/settings` → `data.context_window_max_tokens` → `_build_response()` → `UserEffectiveSettings` | Yes | FLOWING |
| `MessageInput.tsx` | `info` (ModelInfo) | `MODEL_INFO[m]` — static lookup by model ID string | Static data — no DB query needed for a static lookup | FLOWING |
| `sub_agent_service.py` | `output_ceiling` | `settings.sub_agent_max_output_tokens` from config / override | Yes — reads from pydantic settings | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running server/venv. Static code analysis used throughout.

| Behavior | Method | Result | Status |
|----------|--------|--------|--------|
| `_is_generation_task("Create a pptx")` returns True | grep for `_GENERATION_KEYWORDS` containing "pptx" + `any(kw in t ...)` logic | "pptx" in frozenset; case-insensitive match confirmed | PASS |
| `_is_generation_task("Summarize this text")` returns False | None of "summarize", "text" are in `_GENERATION_KEYWORDS` | Confirmed by reading frozenset | PASS |
| `estimate_tokens(text, model="gpt-4o")` uses tiktoken path | `model.startswith("gpt-")` check at line 106 | Correctly branches to `_get_cl100k()` | PASS |
| `SettingsUpdate(sub_agent_max_output_tokens=4095)` raises ValidationError | `Field(ge=4096, le=65536)` at line 101 of settings.py | Pydantic validation confirmed | PASS |
| Sub-agent model dropdown visible in Settings UI | grep SettingsPage.tsx for sub_agent_model or dropdown in Context SectionCard | Zero matches — dropdown absent | FAIL |
| costTier in ModelInfo tooltip | grep model-info.ts and MessageInput.tsx for costTier | Zero matches in both files | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CTX-01 | 051-02 | Sub-agent detects generation tasks via keyword routing and escalates to capable model with 32k ceiling | SATISFIED | `_GENERATION_KEYWORDS` frozenset + `_is_generation_task()` + `max(32768, settings.sub_agent_max_output_tokens)` in sub_agent_service.py |
| CTX-02 | 051-02 | Simple analysis tasks use cheap sub-agent model — escalation only for creation/generation verbs | SATISFIED | else-branch in `run_sub_agent()` preserves `_SUB_AGENT_MODEL_DEFAULTS`; analysis ceiling = `settings.sub_agent_max_output_tokens` |
| CTX-03 | 051-04 | Settings page exposes context depth slider, sub-agent output token slider, AND sub-agent model override dropdown | BLOCKED | Two sliders implemented and wired through all 6 layers. Sub-agent model override dropdown entirely absent from SettingsPage.tsx, api.ts, settings.py, and user_settings.py |
| CTX-04 | 051-05 | Model selector shows inline info card with context window, output limit, cost tier, and best-for label | BLOCKED | INFO card shows 3/4 required data points (context window, max output, best-for). Cost tier field absent from ModelInfo interface and all 11 model entries; tooltip does not render it |
| CTX-05 | 051-03 | Token estimation for OpenAI models uses tiktoken (cl100k_base); others use char heuristic | SATISFIED | `_TIKTOKEN_AVAILABLE`, `_get_cl100k()` cache, `model.startswith("gpt-"/"o1"/"o3")` branch; tiktoken>=0.12.0 in requirements.txt |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `frontend/src/pages/SettingsPage.tsx` | Context & Sub-Agent SectionCard omits `sub_agent_model` dropdown — plan 04 explicitly deferred it but roadmap SC requires it | BLOCKER | CTX-03 not fully satisfied; admin cannot override sub-agent model from UI |
| `frontend/src/lib/model-info.ts` | `ModelInfo` interface missing `costTier` field; all 11 entries lack cost tier data | BLOCKER | CTX-04 not fully satisfied; info card is incomplete per requirement |

### Human Verification Required

#### 1. Sub-Agent Model Override Dropdown Absence

**Test:** Navigate to Settings > AI Model tab. Scroll to "Context & Sub-Agent" section.
**Expected:** A dropdown/select control for overriding the sub-agent model should be present.
**Why human:** Confirms the UI gap is visible to the end user, not just absent from code.

#### 2. Model Info Tooltip — Cost Tier Row Absent

**Test:** Open the chat model selector dropdown. Hover over the info icon on any known model (e.g. gpt-4o).
**Expected:** Tooltip should show Context, Max output, Cost tier, and Best for.
**Why human:** Confirms the tooltip is missing the cost tier line visually, not just in code.

### Gaps Summary

Two gaps block full goal achievement for Phase 051:

**Gap 1 — Sub-agent model override dropdown (CTX-03)**
The roadmap success criterion #3 and REQUIREMENTS.md CTX-03 both explicitly require a "dropdown for sub-agent model override" in the Settings UI. Plan 04 noted this was out of scope ("not required by CTX-03"), but plans cannot reduce scope below what the roadmap contract states. The `sub_agent_model` config field exists in `backend/app/config.py` but is not surfaced through any layer of the settings stack (UserEffectiveSettings, FullSettingsResponse, SettingsUpdate, api.ts, SettingsPage.tsx). The dropdown, state variable, hydrate binding, and save body entry are all absent.

**Gap 2 — Cost tier field in model info cards (CTX-04)**
REQUIREMENTS.md CTX-04 and ROADMAP SC #4 both list "cost tier" as a required data point in the inline model info card. The `ModelInfo` interface in `model-info.ts` has three fields (`contextWindow`, `maxOutputTokens`, `bestFor`) but no `costTier`. All 11 model entries lack cost tier data. The tooltip in `MessageInput.tsx` renders three lines (Context, Max output, Best for) but no cost tier line.

Both gaps require targeted additions. They share no root cause and can be addressed independently.

---

_Verified: 2026-04-23_
_Verifier: Claude (gsd-verifier)_
