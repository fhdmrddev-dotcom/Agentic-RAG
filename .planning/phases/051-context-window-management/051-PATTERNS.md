# Phase 51: Context Window Management - Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 9
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/sub_agent_service.py` | service | request-response | self (edit) | exact |
| `backend/app/services/context_window.py` | service / utility | transform | self (edit) | exact |
| `backend/app/config.py` | config | CRUD | self (edit) — follow `sub_agent_max_chars: int` pattern | exact |
| `backend/app/models/user_settings.py` | model | CRUD | self (edit) — follow `sandbox_enabled: bool` / `_int()` pattern | exact |
| `backend/app/api/settings.py` | controller / route | request-response | self (edit) — follow `sandbox_enabled` field pattern | exact |
| `frontend/src/lib/model-info.ts` | utility / static-data | transform | `frontend/src/lib/toolMeta.ts` | role-match |
| `frontend/src/lib/api.ts` | utility / API client | request-response | self (edit) — follow `sandbox_enabled` field pattern | exact |
| `frontend/src/pages/SettingsPage.tsx` | component | request-response | self (edit) — follow `NumberInput` / `Toggle` / `FieldRow` / `handleSaveAIModel` patterns | exact |
| `frontend/src/components/chat/MessageInput.tsx` | component | event-driven | self (edit) — follow `models.map()` / `DropdownMenuItem` / `Cpu` icon pattern | exact |

---

## Pattern Assignments

### `backend/app/services/sub_agent_service.py` (service, request-response)

**Analog:** self — this file is the source of truth for the edit

**Imports pattern** (lines 1–11):
```python
from __future__ import annotations

from typing import TYPE_CHECKING, Generator

from langsmith import traceable

from app.config import settings
from app.services.openai_service import get_llm_client, _resolve_max_tokens, _uses_max_completion_tokens

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings
```

**Existing module-level dict to extend alongside** (lines 16–22):
```python
_SUB_AGENT_MODEL_DEFAULTS: dict[str, str] = {
    "anthropic":  "claude-haiku-4-5-20251001",
    "openai":     "gpt-5.4-nano",
    "google":     "gemini-2.5-flash",
    "openrouter": "",
    "ollama":     "",
}
```
Add the new `_GENERATION_KEYWORDS` frozenset immediately after this dict.

**Existing model resolution + token call to replace** (lines 55–67):
```python
if settings.sub_agent_model:
    effective_model = settings.sub_agent_model
else:
    provider = user_settings.active_provider if user_settings else ""
    provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
    effective_model = (
        provider_default
        or (user_settings.llm_model if user_settings else None)
        or model
        or settings.llm_model
    )

resolved_tokens = _resolve_max_tokens(8192, user_settings)  # Haiku 4.5 ceiling
```
This entire block is replaced by the keyword-routing logic (see Core pattern below).

**Core keyword routing pattern** (new code replacing lines 55–67):
```python
_GENERATION_KEYWORDS = frozenset({
    "pptx", "powerpoint", "presentation",
    "report", "document", "pdf",
    "spreadsheet", "excel", "csv export",
})

def _is_generation_task(task: str) -> bool:
    """Return True if the task contains any output-format generation keyword.

    Note: 'document' is intentionally broad — may trigger on analysis phrases
    like 'analyze the document'. This is accepted (D-01): escalation to the
    capable model is safe even if slightly over-eager.
    """
    t = task.lower()
    return any(kw in t for kw in _GENERATION_KEYWORDS)

# Inside run_sub_agent(), replacing lines 55–67:
is_generation = _is_generation_task(task)

if settings.sub_agent_model:
    effective_model = settings.sub_agent_model
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

# D-03/D-08: generation tasks get at least 32768; analysis tasks use slider value
if is_generation:
    output_ceiling = max(32768, settings.sub_agent_max_output_tokens)
else:
    output_ceiling = settings.sub_agent_max_output_tokens  # default 8192

resolved_tokens = _resolve_max_tokens(output_ceiling, user_settings)
```

**token_param / stream call pattern** (lines 68–78 — unchanged):
```python
token_param = "max_completion_tokens" if _uses_max_completion_tokens(effective_model) else "max_tokens"
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

---

### `backend/app/services/context_window.py` (utility, transform)

**Analog:** self — tiktoken upgrade is a targeted modification of `estimate_tokens()`

**Existing module-level setup to extend** (lines 1–13):
```python
"""Context window management — token estimation and sliding-window trimming.

Uses a character-based token estimation heuristic (1 token ~ 4 chars for English).
No external API calls or tiktoken dependency required — runs in <1ms.
"""
from __future__ import annotations

import json
import logging

from app.config import settings, PROVIDER_CONTEXT_DEFAULTS, MODEL_CONTEXT_DEFAULTS

logger = logging.getLogger(__name__)
```
Add the tiktoken import block immediately after `logger = ...` (before `_parse_model_limits`).

**New tiktoken optional-import block** (insert after line 13):
```python
try:
    import tiktoken as _tiktoken
    _TIKTOKEN_AVAILABLE = True
    _CL100K: "tiktoken.Encoding | None" = None
except ImportError:
    _tiktoken = None  # type: ignore[assignment]
    _TIKTOKEN_AVAILABLE = False
    _CL100K = None
    logger.warning(
        "tiktoken not installed — token estimation uses chars/4 heuristic. "
        "Install with: pip install tiktoken"
    )


def _get_cl100k() -> "tiktoken.Encoding | None":
    """Return cached cl100k_base encoder, or None if tiktoken unavailable.

    Called once at module load (after import block) to warm the encoder cache
    and avoid first-request latency (tiktoken downloads vocab on first call).
    """
    global _CL100K
    if _CL100K is None and _TIKTOKEN_AVAILABLE:
        _CL100K = _tiktoken.get_encoding("cl100k_base")  # type: ignore[union-attr]
    return _CL100K


# Warm encoder at startup to avoid first-request latency (Pitfall 3)
_get_cl100k()
```

**Existing `estimate_tokens()` to replace** (lines 65–72):
```python
def estimate_tokens(text: str | None) -> int:
    """Estimate token count for a string using chars/4 heuristic.

    Returns 0 for None or empty strings.
    """
    if not text:
        return 0
    return max(1, len(text) // 4)
```

**New `estimate_tokens()` with tiktoken** (replaces lines 65–72):
```python
def estimate_tokens(text: str | None, model: str = "") -> int:
    """Estimate token count. Uses tiktoken cl100k_base for OpenAI models when available.

    Falls back to chars/4 heuristic for all other providers or when tiktoken
    is not installed. The `model` parameter is optional — omitting it gives chars/4.

    Args:
        text: String to estimate. Returns 0 for None/empty.
        model: Model ID (e.g. "gpt-4o"). Empty string → chars/4.
    """
    if not text:
        return 0
    if model and (model.startswith("gpt-") or model.startswith(("o1", "o3"))):
        enc = _get_cl100k()
        if enc is not None:
            return max(1, len(enc.encode(text)))
    return max(1, len(text) // 4)
```

**Callers that need signature update** — `estimate_messages_tokens()` (lines 75–103) calls `estimate_tokens(content)`. Adding `model=""` default makes this backward-compatible: existing callers without `model` argument continue to work and get chars/4. No caller updates required for correctness — threading `model` through is optional enhancement.

---

### `backend/app/config.py` (config, CRUD)

**Analog:** self — follow the existing `sub_agent_max_chars` integer field pattern

**Existing sub-agent block to extend** (lines 186–192):
```python
# Sub-agent settings
sub_agent_model: str = ""
# Empty = auto-select cheapest model for active provider (see sub_agent_service.py).
# Set SUB_AGENT_MODEL=<model-id> in .env to override for all providers.
sub_agent_max_chars: int = 600_000
# Sub-agents have their own independent context window — this cap is NOT protecting
# the main agent's budget. 600k chars ≈ 150k tokens, which fits any 200k+ model
```

**New field to insert** (add after line 192, before Observability comment):
```python
sub_agent_max_output_tokens: int = 8192
# Default output ceiling for sub-agent analysis tasks (D-08).
# Generation tasks (pptx, report, pdf, etc.) override this with max(32768, this value).
# Range: 4096–65536. Set SUB_AGENT_MAX_OUTPUT_TOKENS=<n> in .env to override globally.
# Overridable per-user via Settings UI slider.
```

**Pattern to follow** — integer field declaration with comment block, matching `sub_agent_max_chars` style at line 189. No `Field()` validator needed in `config.py` — validation happens at the API layer in `settings.py`.

---

### `backend/app/models/user_settings.py` (model, CRUD)

**Analog:** self — follow the `sandbox_enabled: bool` field and `_bool()` / `_int()` pattern

**`UserEffectiveSettings` class — existing field to follow** (lines 79–81):
```python
# Sandbox
sandbox_enabled: bool
```

**New field to add** in `UserEffectiveSettings` (add in the Sub-agent section, after `sandbox_enabled`):
```python
# Sub-agent
sub_agent_max_output_tokens: int
```

**`load_app_settings()` — existing `_int()` pattern to copy** (line 255):
```python
sandbox_enabled=_bool(override, "sandbox_enabled", env_settings.sandbox_enabled),
```

**New line to add** in `load_app_settings()` return statement (after `sandbox_enabled` line):
```python
sub_agent_max_output_tokens=_int(override, "sub_agent_max_output_tokens", env_settings.sub_agent_max_output_tokens),
```

**`_int()` helper signature** (lines 128–135) — already present, no changes needed:
```python
def _int(override: dict, key: str, env_val: int) -> int:
    v = override.get(key)
    if v is None:
        return env_val
    try:
        return int(v)
    except (TypeError, ValueError):
        return env_val
```

---

### `backend/app/api/settings.py` (controller, request-response)

**Analog:** self — follow the `sandbox_enabled` field across `FullSettingsResponse`, `SettingsUpdate`, `_build_response()`, and `update_settings()`

**`FullSettingsResponse` — existing field to follow** (lines 56–57):
```python
# Sandbox
sandbox_enabled: bool
```

**New field to add** in `FullSettingsResponse`:
```python
# Sub-agent
sub_agent_max_output_tokens: int
```

**`SettingsUpdate` — existing optional field to follow** (lines 95–96):
```python
# Sandbox
sandbox_enabled: bool | None = None
```

**New field to add** in `SettingsUpdate`:
```python
# Sub-agent
sub_agent_max_output_tokens: int | None = None
```

**Security note:** Add `Field(ge=4096, le=65536)` on `sub_agent_max_output_tokens` in `SettingsUpdate` to enforce slider bounds at the API layer. Example from RESEARCH.md §Security Domain:
```python
from pydantic import BaseModel, Field

sub_agent_max_output_tokens: int | None = Field(default=None, ge=4096, le=65536)
```

**`_build_response()` — existing pattern to follow** (lines 136–137):
```python
sandbox_enabled=s.sandbox_enabled,
```

**New line to add** in `_build_response()`:
```python
sub_agent_max_output_tokens=s.sub_agent_max_output_tokens,
```

**`update_settings()` handler — existing pattern to follow** (lines 208–209):
```python
if body.sandbox_enabled is not None:
    updates["sandbox_enabled"] = body.sandbox_enabled
```

**New block to add** in `update_settings()`:
```python
if body.sub_agent_max_output_tokens is not None:
    updates["sub_agent_max_output_tokens"] = body.sub_agent_max_output_tokens
```

---

### `frontend/src/lib/model-info.ts` (utility, static-data)

**Analog:** `frontend/src/lib/toolMeta.ts` — same lib/ directory, same pattern of a single-purpose static-data utility with a JSDoc header comment and named exports

**toolMeta.ts header pattern** (lines 1–5):
```typescript
/**
 * Shared tool metadata helpers — used by ToolCallPanel and MessageItem.
 * Keeps labels and summaries in one place so they don't drift.
 */
```

**New file structure to follow** — model-info.ts mirrors the toolMeta.ts layout (JSDoc, export interface, export const):
```typescript
/**
 * Static model metadata lookup — used by MessageInput for model info tooltips.
 * Keys mirror MODEL_CONTEXT_DEFAULTS in backend/app/config.py and
 * _MODEL_OUTPUT_DEFAULTS in backend/app/services/openai_service.py.
 *
 * For unknown model IDs: no entry in MODEL_INFO → no info icon shown (D-12).
 */

export interface ModelInfo {
  contextWindow: number       // tokens; from MODEL_CONTEXT_DEFAULTS in config.py
  maxOutputTokens: number     // tokens; from _MODEL_OUTPUT_DEFAULTS in openai_service.py
  bestFor: string             // short label, e.g. "Long docs, coding"
}

export const MODEL_INFO: Record<string, ModelInfo> = {
  // ── OpenAI ──────────────────────────────────────────────────────────────────
  "gpt-4o":          { contextWindow: 100_000,  maxOutputTokens: 16384,  bestFor: "General purpose, vision" },
  "gpt-4o-mini":     { contextWindow: 100_000,  maxOutputTokens: 16384,  bestFor: "Fast, cost-efficient" },
  "gpt-4.1":         { contextWindow: 400_000,  maxOutputTokens: 32768,  bestFor: "Long context, coding" },
  "gpt-4.1-mini":    { contextWindow: 400_000,  maxOutputTokens: 32768,  bestFor: "Fast long context" },
  "gpt-4.1-nano":    { contextWindow: 400_000,  maxOutputTokens: 16384,  bestFor: "Ultra-fast, low cost" },
  // ── Anthropic ────────────────────────────────────────────────────────────────
  "claude-sonnet-4-6":         { contextWindow: 150_000, maxOutputTokens: 32768, bestFor: "Reasoning, long docs" },
  "claude-opus-4-6":           { contextWindow: 150_000, maxOutputTokens: 16384, bestFor: "Complex tasks, analysis" },
  "claude-haiku-4-5-20251001": { contextWindow: 150_000, maxOutputTokens: 8192,  bestFor: "Fast analysis, summaries" },
  // ── Google ───────────────────────────────────────────────────────────────────
  "gemini-2.5-pro":            { contextWindow: 600_000, maxOutputTokens: 32768, bestFor: "Very long context, research" },
  "gemini-2.5-flash":          { contextWindow: 600_000, maxOutputTokens: 32768, bestFor: "Fast, multimodal" },
  "gemini-2.5-flash-lite":     { contextWindow: 600_000, maxOutputTokens: 16384, bestFor: "Ultra-fast, high volume" },
  // OpenRouter models omitted — graceful degradation per D-12 (no icon for unknown IDs)
}
```

**Keys must align** with:
- `MODEL_CONTEXT_DEFAULTS` in `backend/app/config.py` (lines 25–48)
- `_MODEL_OUTPUT_DEFAULTS` in `backend/app/services/openai_service.py` (lines 581–605)

---

### `frontend/src/lib/api.ts` (utility, request-response)

**Analog:** self — follow the `sandbox_enabled` field pattern in both `FullAppSettings` and `SettingsUpdate`

**`FullAppSettings` — existing field to follow** (lines 410–411):
```typescript
  sandbox_enabled: boolean
```

**New field to add** in `FullAppSettings`:
```typescript
  sub_agent_max_output_tokens: number
```

**`SettingsUpdate` — existing optional field to follow** (lines 444–445):
```typescript
  sandbox_enabled?: boolean
```

**New field to add** in `SettingsUpdate`:
```typescript
  sub_agent_max_output_tokens?: number
```

**No changes** to `getSettings()` or `updateSettings()` functions — they pass the full object through and TypeScript type checking enforces correctness.

---

### `frontend/src/pages/SettingsPage.tsx` (component, request-response)

**Analog:** self — follow `NumberInput` + `FieldRow` + `handleSaveAIModel` + `hydrate()` patterns

**Existing `NumberInput` component** (lines 48–62) — `SliderInput` is structured identically but uses `type="range"`:
```typescript
function NumberInput({ value, onChange, min, max, step }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
}) {
  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
      className="h-8 text-sm font-mono bg-muted/30 ghost-border"
    />
  )
}
```

**New `SliderInput` component** — add adjacent to `NumberInput` (after line 62):
```typescript
function SliderInput({
  value,
  onChange,
  min,
  max,
  step,
  hint,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  hint?: string
}) {
  const displayValue = value === 0 ? "Auto" : value.toLocaleString()
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <input
          type="range"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="flex-1 h-1.5 accent-primary cursor-pointer"
        />
        <span className="text-xs font-mono text-muted-foreground w-20 text-right shrink-0">
          {displayValue}
        </span>
      </div>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  )
}
```

**Existing `FieldRow` component** (lines 25–32) — use as-is for new section rows:
```typescript
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <Label className="text-sm text-muted-foreground shrink-0 w-44">{label}</Label>
      <div className="flex-1 max-w-xs">{children}</div>
    </div>
  )
}
```

**State variables to add** (follow `sandboxEnabled` pattern at line 480):
```typescript
const [contextWindowMaxTokens, setContextWindowMaxTokens] = useState(0)
const [subAgentMaxOutputTokens, setSubAgentMaxOutputTokens] = useState(8192)
```

**`hydrate()` additions** (after line 510, following the `setSandboxEnabled(data.sandbox_enabled)` line):
```typescript
setContextWindowMaxTokens(data.context_window_max_tokens ?? 0)
setSubAgentMaxOutputTokens(data.sub_agent_max_output_tokens ?? 8192)
```

**`handleSaveAIModel()` body** (lines 524–533) — append new fields to the `body` object:
```typescript
const body: SettingsUpdate = {
  active_provider: activeProvider,
  llm_model: llmModel,
  providers: providerStates.map((ps) => ({ ... })),
  // ADD:
  context_window_max_tokens: contextWindowMaxTokens,
  sub_agent_max_output_tokens: subAgentMaxOutputTokens,
}
```

**Existing Save button** (lines 714–724) — reuse as-is. The new section appears above the save button, inside the same `TabsContent value="0"` block, after the "Active Model" `SectionCard` (line 711).

**New section placement** — insert a new `SectionCard` between the "Active Model" card (ends line 711) and the save button div (line 713):
```typescript
{/* Context & Sub-Agent SectionCard */}
<SectionCard
  title="Context & Sub-Agent"
  description="Tune context history depth and sub-agent output token budgets."
>
  <FieldRow label="Context history depth">
    <SliderInput
      value={contextWindowMaxTokens}
      onChange={setContextWindowMaxTokens}
      min={0}
      max={200000}
      step={1000}
      hint={contextWindowMaxTokens === 0 ? "Auto — resolved from active model's defaults" : undefined}
    />
  </FieldRow>
  <FieldRow label="Sub-agent output tokens">
    <SliderInput
      value={subAgentMaxOutputTokens}
      onChange={setSubAgentMaxOutputTokens}
      min={4096}
      max={65536}
      step={1024}
    />
  </FieldRow>
</SectionCard>
```

**Note:** `context_window_max_tokens` also needs to be added to `FullAppSettings` in `api.ts` and `FullSettingsResponse` in `settings.py` following the same pattern as `sub_agent_max_output_tokens`, since the hydrate() reads it from `data.context_window_max_tokens`. Check whether `context_window_max_tokens` is already present in those types (it is already in `config.py` as `context_window_max_tokens: int = 0`) — if not already in the API response, add it following the exact same chain as `sub_agent_max_output_tokens`.

---

### `frontend/src/components/chat/MessageInput.tsx` (component, event-driven)

**Analog:** self — augment the existing `models.map()` loop

**Existing imports** (lines 1–11) — add `Info` to lucide import and add Tooltip imports:
```typescript
import { ArrowUp, ChevronDown, Compass, Cpu, Info, Layers, Square } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MODEL_INFO } from "@/lib/model-info"
```

**Existing `DropdownMenuContent` import** (lines 5–10) — already present, no change:
```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
```

**Existing `models.map()` loop** (lines 193–208) — this is the exact block to augment:
```typescript
{models.map((m) => (
  <DropdownMenuItem
    key={m}
    onSelect={() => onModelChange?.(m)}
    className={cn(
      "text-xs cursor-pointer gap-2",
      m === selectedModel && "font-medium bg-accent",
    )}
  >
    <Cpu className="h-3 w-3 shrink-0 text-muted-foreground" />
    {m}
    {m === selectedModel && (
      <span className="ml-auto text-[10px] text-primary font-semibold">active</span>
    )}
  </DropdownMenuItem>
))}
```

**New `models.map()` loop with info icon** — replaces lines 193–208:
```typescript
<TooltipProvider>
  {models.map((m) => {
    const info = MODEL_INFO[m]
    return (
      <DropdownMenuItem
        key={m}
        onSelect={() => onModelChange?.(m)}
        className={cn(
          "text-xs cursor-pointer gap-2",
          m === selectedModel && "font-medium bg-accent",
        )}
      >
        <Cpu className="h-3 w-3 shrink-0 text-muted-foreground" />
        {m}
        {m === selectedModel && (
          <span className="ml-auto text-[10px] text-primary font-semibold">active</span>
        )}
        {info && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info
                className="h-3 w-3 shrink-0 text-muted-foreground/50 hover:text-muted-foreground ml-1"
                onClick={(e) => e.stopPropagation()}
              />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[200px] text-xs space-y-1">
              <div><span className="font-medium">Context:</span> {info.contextWindow.toLocaleString()} tokens</div>
              <div><span className="font-medium">Max output:</span> {info.maxOutputTokens.toLocaleString()} tokens</div>
              <div><span className="font-medium">Best for:</span> {info.bestFor}</div>
            </TooltipContent>
          </Tooltip>
        )}
      </DropdownMenuItem>
    )
  })}
</TooltipProvider>
```

**Pitfall (Radix Pitfall 4):** `TooltipProvider` is hoisted above the `.map()` call to avoid re-mounting per render. The `onClick={(e) => e.stopPropagation()}` on the Info icon prevents accidental model selection when clicking it.

---

## Shared Patterns

### Integer config field threading (4-layer stack)

**Source files:** `config.py` → `user_settings.py` → `settings.py` → `api.ts` → `SettingsPage.tsx`

**Pattern to copy for `sub_agent_max_output_tokens`:**

1. `config.py` — `sub_agent_max_output_tokens: int = 8192` (follow `sub_agent_max_chars: int = 600_000` at line 189)
2. `user_settings.py` — add field to `UserEffectiveSettings`; add `_int(override, "sub_agent_max_output_tokens", env_settings.sub_agent_max_output_tokens)` to `load_app_settings()` return (follow `sandbox_enabled` at line 255)
3. `settings.py` — add `sub_agent_max_output_tokens: int` to `FullSettingsResponse`; `int | None = None` to `SettingsUpdate`; propagate in `_build_response()` and `update_settings()` (follow `sandbox_enabled` at lines 56, 95, 136, 208–209)
4. `api.ts` — add `sub_agent_max_output_tokens: number` to `FullAppSettings`; `sub_agent_max_output_tokens?: number` to `SettingsUpdate` (follow `sandbox_enabled` at lines 410, 444)
5. `SettingsPage.tsx` — state + `hydrate()` + `handleSaveAIModel()` body (follow `sandboxEnabled` at lines 480, 510, and the body at lines 524–533)

### Optional dependency import with silent fallback

**Source:** `backend/app/services/context_window.py` (new pattern; no prior analog in codebase)

**Pattern:** Module-level `try/except ImportError` with a boolean flag + `logger.warning()` on import failure. Function checks flag before using the library. Applied to tiktoken in `context_window.py`.

### Frozenset keyword routing

**Source:** `backend/app/services/sub_agent_service.py` (new `_GENERATION_KEYWORDS`)

**Pattern:** `frozenset` of lowercase strings + `any(kw in task.lower() for kw in frozenset)` predicate. O(1) membership test, extensible without touching logic.

### `FieldRow` + small component layout

**Source:** `frontend/src/pages/SettingsPage.tsx` lines 25–62

**Apply to:** All new settings inputs in `SettingsPage.tsx`. Every input control is wrapped in `<FieldRow label="...">`. New `SliderInput` follows the same prop signature shape as `NumberInput`.

### Tooltip for hover-only info overlays

**Source:** `frontend/src/components/ui/tooltip.tsx` + existing `@radix-ui/react-tooltip` installation

**Apply to:** `MessageInput.tsx` model info icon. `TooltipProvider` hoisted above the `.map()` call. `TooltipContent side="right"` for dropdowns that open leftward.

---

## No Analog Found

All files have close analogs or are edits of existing files. No files require patterns from RESEARCH.md alone.

---

## Metadata

**Analog search scope:** `backend/app/`, `frontend/src/`
**Files scanned:** 9 (all target files read directly; no additional analog search needed — all files are self-analogs or direct edits)
**Pattern extraction date:** 2026-04-23
