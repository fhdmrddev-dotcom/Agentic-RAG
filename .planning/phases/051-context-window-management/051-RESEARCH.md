# Phase 51: Context Window Management - Research

**Researched:** 2026-04-23
**Domain:** Python token counting, FastAPI settings extension, React range sliders, shadcn/ui popover/tooltip, sub-agent model routing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sub-Agent Task Routing (CTX-01, CTX-02)**
- D-01: Escalation trigger: output-format keyword matching on the `task` string passed to `run_sub_agent()`. Keywords: `pptx`, `powerpoint`, `presentation`, `report`, `document`, `pdf`, `spreadsheet`, `excel`, `csv export`. Case-insensitive. No verb matching.
- D-02: Escalated model: use `user_settings.llm_model` (same as main agent). No new env var needed.
- D-03: Output ceiling for escalated tasks: 32k tokens (32768). Existing sub-agent hardcodes 8192 — stays as analysis default. Generation tasks override to 32768.
- D-04: Simple analysis tasks continue using `_SUB_AGENT_MODEL_DEFAULTS` — no change.

**Settings UI — Context & Sub-Agent Controls (CTX-03)**
- D-05: Placement: new "Context & Sub-Agent" section on the existing AI Model tab, below the provider/model cards.
- D-06: Control type: sliders (HTML range inputs). New `SliderInput` component added to SettingsPage alongside existing `NumberInput`.
- D-07: Context history depth slider: maps to `context_window_max_tokens`. Range: 0–200,000, step 1,000, default 0 (= auto). Show current model's auto-resolved limit as hint when value is 0.
- D-08: Sub-agent output token slider: maps to new `sub_agent_max_output_tokens` setting. Range: 4,096–65,536, step 1,024, default 8,192. Generation tasks override with min(32,768, slider_value).
- D-09: Sub-agent model override dropdown: maps to `sub_agent_model`. Shows available models for active provider. Empty/blank = auto.
- D-10: Save button: reuses existing AI Model tab's Save button.

**Model Info Card Design (CTX-04)**
- D-11: Small info icon (lucide-react `Info`) right of each model name in model selector dropdown. Hover triggers compact popover/tooltip.
- D-12: Card fields: context window size, max output tokens, best-for label. Skip cost tier. `MODEL_INFO` lookup — no icon if model not in lookup.
- D-13: `MODEL_INFO` lookup lives in `src/lib/model-info.ts`. Keys mirror `MODEL_CONTEXT_DEFAULTS` from backend config.py.

**Token Counting — tiktoken (CTX-05)**
- D-14: Add `tiktoken` to `backend/requirements.txt` as optional. Silent fallback to chars/4 with single startup warning if import fails.
- D-15: Only modify `estimate_tokens()` in `context_window.py`. OpenAI models (starts with `gpt-` or `o1`/`o3`) use `cl100k_base`. All others use chars/4.
- D-16: Sub-agent char cap (`sub_agent_max_chars`) stays char-based — tiktoken not used there.

### Claude's Discretion
- Exact popover styling and positioning for model info icon (follow existing shadcn/ui Popover/Tooltip patterns)
- Slider visual design (track color, thumb style) — match Deep Midnight theme
- Range slider step granularity for context_window_max_tokens beyond 200k (cap at 200k in UI)
- How to display "auto" state on context depth slider when value = 0
- tiktoken encoding choice for newer GPT-4.1 models (o200k_base vs cl100k_base) — use cl100k_base as specified in CTX-05

### Deferred Ideas (OUT OF SCOPE)
- Cost tier lookup per model — deferred indefinitely
- tiktoken for non-OpenAI providers
- Sub-agent output token override via UI for generation-specific ceiling (32k ceiling is hardcoded in routing logic)
- Dynamic model metadata from provider APIs
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTX-01 | Sub-agent detects generation tasks via keyword routing; escalates to capable model with 32k output ceiling | D-01/D-02/D-03 locked. Research confirms `run_sub_agent()` is the only callsite and `task` string is the correct intercept point. |
| CTX-02 | Simple analysis tasks continue using cheap sub-agent model | D-04 locked. Existing `_SUB_AGENT_MODEL_DEFAULTS` unchanged for non-matching tasks. |
| CTX-03 | Settings page exposes context depth slider, sub-agent output token slider, and sub-agent model override dropdown | D-05 through D-10 locked. New `sub_agent_max_output_tokens` config field needed in 4 layers. |
| CTX-04 | Model selector shows inline info card with context window size, max output tokens, best-use-case label | D-11/D-12/D-13 locked. Tooltip (not Popover) is the right component — already in codebase. |
| CTX-05 | Token estimation for OpenAI models uses tiktoken (cl100k_base) | D-14/D-15/D-16 locked. tiktoken 0.12.0 installable; not yet in venv or requirements.txt. |
</phase_requirements>

---

## Summary

Phase 51 adds four independently deliverable capabilities to an existing, well-structured codebase: (1) keyword-based task escalation in the sub-agent, (2) two sliders and a dropdown in the Settings UI for the new `sub_agent_max_output_tokens` config field, (3) per-model info cards in the model selector dropdown, and (4) tiktoken-backed token estimation for OpenAI models.

All decisions are locked via CONTEXT.md — no design exploration needed. The codebase is a clean example of the patterns each change extends: `run_sub_agent()` is a single function; `estimate_tokens()` is a single function; the Settings layer is a well-defined 4-file stack (config.py → user_settings.py → settings.py → SettingsPage.tsx / api.ts). The only new installation required is tiktoken in the backend venv.

The biggest implementation pitfall is the `sub_agent_max_output_tokens` threading: it must be added in all four layers of the settings stack simultaneously (config.py, UserEffectiveSettings, FullSettingsResponse + SettingsUpdate in settings.py, FullAppSettings + SettingsUpdate in api.ts, and hydrate() + handleSaveAIModel() in SettingsPage.tsx). Missing any layer produces a silent zero or a TypeScript error.

**Primary recommendation:** Implement in four waves: (1) sub-agent routing, (2) tiktoken upgrade, (3) settings stack for sub_agent_max_output_tokens, (4) model info cards in MessageInput.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Generation keyword detection | API / Backend (`sub_agent_service.py`) | — | Task routing is pure backend; frontend never sees sub-agent model selection |
| Output token ceiling override | API / Backend (`sub_agent_service.py`) | — | Token parameters are passed directly to OpenAI client |
| tiktoken upgrade | API / Backend (`context_window.py`) | — | estimate_tokens() called only from Python; no frontend impact |
| sub_agent_max_output_tokens config | API / Backend (`config.py`, `user_settings.py`, `settings.py`) | Frontend (SettingsPage, api.ts) | Config field lives in backend; UI reads/writes it via Settings API |
| SliderInput component | Frontend (`SettingsPage.tsx`) | — | Pure UI component, no backend changes needed |
| MODEL_INFO lookup | Frontend (`src/lib/model-info.ts`) | — | Static data; no API call needed or desired (D-12 locks this) |
| Model info icon/tooltip in selector | Frontend (`MessageInput.tsx`) | — | UI only; data comes from static MODEL_INFO |

---

## Standard Stack

### Core (already installed — no new installs except tiktoken)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tiktoken | 0.12.0 (installable) | BPE token counting for OpenAI models | Official OpenAI tokenizer; used by openai SDK internally |
| @radix-ui/react-tooltip | 1.2.8 (already in package.json) | Model info card hover trigger | Already installed; Tooltip is correct for non-interactive card content |

### Key finding: Tooltip vs Popover for model info cards

`@radix-ui/react-popover` is NOT in `package.json`. `@radix-ui/react-tooltip` IS installed (v1.2.8). The shadcn Tooltip component already exists at `frontend/src/components/ui/tooltip.tsx`.

Decision: Use `Tooltip` (not Popover) for the model info card per D-11 ("hovering the icon triggers a compact popover/tooltip"). Tooltip is correct for hover-only, non-interactive content (context window size, max tokens, best-for label). No new npm package needed.

**If Popover were needed** (e.g., for click-triggered cards or interactive content), the install would be:
```bash
npm install @radix-ui/react-popover@1.1.15
npx shadcn-ui@latest add popover
```
But Tooltip is sufficient and already available.

### Backend installation

```bash
# In backend venv
pip install tiktoken==0.12.0
# Add to requirements.txt:
tiktoken>=0.12.0
```

**Version verification:** `npm view @radix-ui/react-popover version` → 1.1.15 [VERIFIED: npm registry]. tiktoken 0.12.0 available for Python 3.12 on Windows [VERIFIED: pip dry-run in venv].

---

## Architecture Patterns

### System Architecture Diagram

```
User message
     │
     ▼
run_sub_agent(task=..., ...)
     │
     ├─ KEYWORD MATCH on task string
     │    ├─ generation keywords found ──► escalated_model = user_settings.llm_model
     │    │                                output_ceiling = 32768
     │    └─ no match ──────────────────► effective_model = _SUB_AGENT_MODEL_DEFAULTS[provider]
     │                                    output_ceiling = sub_agent_max_output_tokens (from config)
     │
     ▼
_resolve_max_tokens(ceiling, user_settings)
     │
     ▼
client.chat.completions.create(model, messages, max_tokens=ceiling)
```

```
estimate_tokens(text, model=None)          [context_window.py]
     │
     ├─ model starts with "gpt-" or "o1"/"o3" ──► tiktoken cl100k_base
     │                                              OR fallback to chars/4
     └─ other models ─────────────────────────────► chars/4 heuristic
```

```
Settings stack for sub_agent_max_output_tokens:
  .env / settings_override.json
     │
     ▼ config.py Settings class
     │   sub_agent_max_output_tokens: int = 8192
     ▼ user_settings.py UserEffectiveSettings
     │   sub_agent_max_output_tokens: int
     │   load_app_settings() reads via _int(override, "sub_agent_max_output_tokens", ...)
     ▼ settings.py FullSettingsResponse + SettingsUpdate
     │   Both gain sub_agent_max_output_tokens: int / int | None
     ▼ api.ts FullAppSettings + SettingsUpdate
     │   Both gain sub_agent_max_output_tokens: number / number | undefined
     ▼ SettingsPage.tsx
         [subAgentMaxOutputTokens, setSubAgentMaxOutputTokens] state
         hydrate() reads from data.sub_agent_max_output_tokens
         handleSaveAIModel() writes to body.sub_agent_max_output_tokens
         SliderInput renders range 4096–65536 step 1024
```

### Recommended Project Structure (new files only)

```
frontend/src/lib/
└── model-info.ts          # MODEL_INFO static lookup — new file
```

No new backend files. All backend changes are in-place edits to existing files.

### Pattern 1: tiktoken with silent fallback

**What:** Try to import tiktoken at module load time. If it fails (ImportError), log once at startup and set a module-level flag. estimate_tokens() checks the flag on every call.

**When to use:** Any optional dependency that degrades gracefully.

```python
# Source: D-14/D-15 from CONTEXT.md + tiktoken official API
import logging
logger = logging.getLogger(__name__)

try:
    import tiktoken as _tiktoken
    _TIKTOKEN_AVAILABLE = True
except ImportError:
    _tiktoken = None  # type: ignore[assignment]
    _TIKTOKEN_AVAILABLE = False
    logger.warning("tiktoken not available — using char heuristic for token estimation")

def estimate_tokens(text: str | None, model: str = "") -> int:
    if not text:
        return 0
    if _TIKTOKEN_AVAILABLE and model and (
        model.startswith("gpt-") or model.startswith(("o1", "o3"))
    ):
        enc = _tiktoken.get_encoding("cl100k_base")  # type: ignore[union-attr]
        return len(enc.encode(text))
    return max(1, len(text) // 4)
```

**Note:** `estimate_tokens()` currently takes only `text`. Adding `model` as an optional keyword arg (default `""`) is backward-compatible — all existing callers pass text only and the new arg will be ignored, using chars/4. The callers `estimate_messages_tokens()` and `trim_messages_to_fit()` would need to be updated to pass the model through. See Pitfall 1.

### Pattern 2: tiktoken encoder caching

**What:** `tiktoken.get_encoding()` does a network fetch on first call (downloads the vocab file) and caches to disk. Subsequent calls are fast. Do not call per-token — call once per estimate.

**When to use:** Any repeated tiktoken usage.

```python
# Cache the encoder at module level after import succeeds
_CL100K_ENCODER = None

def _get_encoder():
    global _CL100K_ENCODER
    if _CL100K_ENCODER is None and _TIKTOKEN_AVAILABLE:
        _CL100K_ENCODER = _tiktoken.get_encoding("cl100k_base")
    return _CL100K_ENCODER
```

**Why cache:** Avoids repeat encoding lookups in `estimate_messages_tokens()` which calls `estimate_tokens()` once per message.

### Pattern 3: HTML range slider in Tailwind

**What:** Native `<input type="range">` styled with Tailwind utility classes. No external library needed.

**When to use:** Linear numeric range with step granularity — matches D-06/D-07/D-08.

```tsx
// SliderInput — follows NumberInput pattern in SettingsPage.tsx
function SliderInput({
  value,
  onChange,
  min,
  max,
  step,
  displayFormatter,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  displayFormatter?: (v: number) => string
}) {
  return (
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
        {displayFormatter ? displayFormatter(value) : value.toLocaleString()}
      </span>
    </div>
  )
}
```

**Deep Midnight theme:** Use `accent-primary` on the range input — this applies the theme's primary color to the thumb and filled track via the CSS `accent-color` property without custom CSS. [ASSUMED — accent-primary is a Tailwind utility; verify the theme defines `--primary` as a CSS var that accent-color can inherit.]

### Pattern 4: Tooltip-based model info card in DropdownMenuItem

**What:** `Info` icon from lucide-react inside each `DropdownMenuItem`, wrapped in shadcn `Tooltip`. The Tooltip content renders a small card with model metadata.

**When to use:** Non-interactive hover-only info overlay on a small icon target.

```tsx
// Source: existing tooltip.tsx component + D-11/D-12/D-13
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { MODEL_INFO } from "@/lib/model-info"

// Inside the models.map() in MessageInput.tsx:
{models.map((m) => {
  const info = MODEL_INFO[m]
  return (
    <DropdownMenuItem key={m} onSelect={() => onModelChange?.(m)} className="...">
      <Cpu className="h-3 w-3 shrink-0 text-muted-foreground" />
      {m}
      {m === selectedModel && <span className="ml-auto text-[10px] text-primary font-semibold">active</span>}
      {info && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 shrink-0 text-muted-foreground/50 hover:text-muted-foreground ml-1" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[200px] text-xs space-y-1">
              <div><span className="font-medium">Context:</span> {info.contextWindow.toLocaleString()} tokens</div>
              <div><span className="font-medium">Max output:</span> {info.maxOutputTokens.toLocaleString()} tokens</div>
              <div><span className="font-medium">Best for:</span> {info.bestFor}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </DropdownMenuItem>
  )
})}
```

**Pitfall:** `TooltipProvider` must wrap any `Tooltip`. In a dropdown map, either wrap each item individually or hoist `TooltipProvider` above the `DropdownMenuContent`. Hoisting above `DropdownMenu` avoids re-mounting the provider on every render.

### Pattern 5: Sub-agent keyword routing

**What:** Before model selection in `run_sub_agent()`, check the `task` string for generation format keywords.

```python
# Source: D-01/D-02/D-03 from CONTEXT.md
_GENERATION_KEYWORDS = frozenset({
    "pptx", "powerpoint", "presentation",
    "report", "document", "pdf",
    "spreadsheet", "excel", "csv export",
})

def _is_generation_task(task: str) -> bool:
    """Return True if the task string contains any generation format keyword."""
    task_lower = task.lower()
    return any(kw in task_lower for kw in _GENERATION_KEYWORDS)
```

**Placement:** At the top of `run_sub_agent()`, before the model resolution block (the `if settings.sub_agent_model:` branch). When `_is_generation_task(task)` is True: skip `_SUB_AGENT_MODEL_DEFAULTS`, use `user_settings.llm_model`, set output ceiling to 32768.

### Pattern 6: MODEL_INFO static lookup shape

```typescript
// src/lib/model-info.ts
export interface ModelInfo {
  contextWindow: number      // tokens, from MODEL_CONTEXT_DEFAULTS in config.py
  maxOutputTokens: number    // tokens, from _MODEL_OUTPUT_DEFAULTS in openai_service.py
  bestFor: string            // short label, e.g. "Long docs, coding"
}

export const MODEL_INFO: Record<string, ModelInfo> = {
  "gpt-4o":          { contextWindow: 100_000,  maxOutputTokens: 16384,  bestFor: "General purpose, vision" },
  "gpt-4o-mini":     { contextWindow: 100_000,  maxOutputTokens: 16384,  bestFor: "Fast, cost-efficient" },
  "gpt-4.1":         { contextWindow: 400_000,  maxOutputTokens: 32768,  bestFor: "Long context, coding" },
  "gpt-4.1-mini":    { contextWindow: 400_000,  maxOutputTokens: 32768,  bestFor: "Fast long context" },
  "gpt-4.1-nano":    { contextWindow: 400_000,  maxOutputTokens: 16384,  bestFor: "Ultra-fast, low cost" },
  "claude-sonnet-4-6":          { contextWindow: 150_000, maxOutputTokens: 32768, bestFor: "Reasoning, long docs" },
  "claude-opus-4-6":            { contextWindow: 150_000, maxOutputTokens: 16384, bestFor: "Complex tasks, analysis" },
  "claude-haiku-4-5-20251001":  { contextWindow: 150_000, maxOutputTokens: 8192,  bestFor: "Fast analysis, summaries" },
  "gemini-2.5-pro":             { contextWindow: 600_000, maxOutputTokens: 32768, bestFor: "Very long context, research" },
  "gemini-2.5-flash":           { contextWindow: 600_000, maxOutputTokens: 32768, bestFor: "Fast, multimodal" },
  "gemini-2.5-flash-lite":      { contextWindow: 600_000, maxOutputTokens: 16384, bestFor: "Ultra-fast, high volume" },
  // OpenRouter models omitted from info card (show no icon per D-12 graceful degradation)
  // Add as needed
}
```

**Keys:** Match model IDs as they appear in the `models` array passed to `MessageInput`. These must align with the IDs in `MODEL_CONTEXT_DEFAULTS` (config.py) and `_MODEL_OUTPUT_DEFAULTS` (openai_service.py) for consistency.

### Anti-Patterns to Avoid

- **Calling `tiktoken.get_encoding()` per message in a loop:** Creates repeated disk lookups (after first call it's cached internally by tiktoken, but explicit caching is clearer and faster).
- **Adding Popover instead of Tooltip:** Popover requires `@radix-ui/react-popover` (not installed), needs click-to-open behavior, and is heavier. Tooltip is already installed and hover-triggered — the correct choice for D-11.
- **Wrapping `TooltipProvider` inside `models.map()`:** Causes one provider mount per model entry in the dropdown — hoist it above the map.
- **Missing the `model` parameter threading** through `estimate_messages_tokens()`: If `estimate_tokens(text, model)` needs the model for tiktoken accuracy, the model must be passed down from `trim_messages_to_fit()` → `estimate_messages_tokens()` → `estimate_tokens()`. See Pitfall 1 for the full propagation chain.
- **Using `_resolve_max_tokens(explicit=32768, user_settings)` for escalated tasks:** This correctly passes 32768 as the explicit ceiling, which takes priority 1 in the resolution chain — the right approach. Do NOT use 8192 as the explicit for escalated tasks.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| BPE token counting for OpenAI | Custom regex tokenizer | tiktoken cl100k_base | OpenAI's own tokenizer; chars/4 can be 30–40% off for code/JSON |
| Range slider component | Custom CSS + JS drag handler | HTML `<input type="range">` + `accent-primary` | Native input handles keyboard, touch, accessibility — 5 lines vs 100 |
| Model info card markup | Custom floating div with JS positioning | shadcn `Tooltip` (already installed) | Handles portal rendering, z-index stacking, animation — already themed |
| Keyword set membership test | Manual `if/elif` chain | `frozenset` + `any(kw in task_lower for kw in _GENERATION_KEYWORDS)` | Frozenset O(1) lookup; extensible without touching logic |

---

## Common Pitfalls

### Pitfall 1: estimate_tokens() signature change breaks callers if model is required

**What goes wrong:** If `model` is added as a required parameter to `estimate_tokens()`, `estimate_messages_tokens()` will fail because it calls `estimate_tokens(content)` without a model arg.

**Why it happens:** `estimate_messages_tokens()` doesn't receive the model currently — it would need to be threaded through from callers.

**How to avoid:** Add `model: str = ""` as a keyword-only argument with empty-string default. Empty string → chars/4 path. Tiktoken only fires when model is explicitly passed. The two internal calls in `estimate_messages_tokens()` (content + tool_calls) need the model passed through — update `estimate_messages_tokens(messages, model="")` signature too, and thread it down. `trim_messages_to_fit()` calls `estimate_messages_tokens()` — update its signature as well.

**Callers outside context_window.py:** Search for all callers of `estimate_tokens`, `estimate_messages_tokens`, and `trim_messages_to_fit` before changing signatures.

**Warning signs:** `TypeError: estimate_tokens() takes 1 positional argument but 2 were given` on first call, or tiktoken never firing despite correct model IDs.

### Pitfall 2: sub_agent_max_output_tokens missing from one layer of the settings stack

**What goes wrong:** The setting saves but returns 0 or undefined; slider defaults to wrong value on page load; or the backend rejects the PATCH with a validation error.

**Why it happens:** The settings stack has 6 distinct locations that must all be updated in sync. Missing any one causes a gap.

**Complete checklist:**
1. `config.py` — `sub_agent_max_output_tokens: int = 8192` in Settings class
2. `user_settings.py` — `sub_agent_max_output_tokens: int` in UserEffectiveSettings; `_int(override, "sub_agent_max_output_tokens", env_settings.sub_agent_max_output_tokens)` in `load_app_settings()`
3. `settings.py` — `sub_agent_max_output_tokens: int` in `FullSettingsResponse`; `sub_agent_max_output_tokens: int | None = None` in `SettingsUpdate`; update handler in `update_settings()`; update `_build_response()`
4. `api.ts` — `sub_agent_max_output_tokens: number` in `FullAppSettings`; `sub_agent_max_output_tokens?: number` in `SettingsUpdate`
5. `SettingsPage.tsx` — state variable; `hydrate()` reads from data; `handleSaveAIModel()` writes to body
6. `sub_agent_service.py` — reads `settings.sub_agent_max_output_tokens` (or from `user_settings` if extended there) as the analysis task output ceiling

**Warning signs:** Slider shows 0 after save/reload; backend logs `sub_agent_max_output_tokens` not found in override; TypeScript type error in api.ts.

### Pitfall 3: tiktoken first-call latency / network dependency

**What goes wrong:** First request after startup that triggers tiktoken causes a ~100–500ms delay (downloading BPE vocab file) or fails in air-gapped environments.

**Why it happens:** `tiktoken.get_encoding("cl100k_base")` downloads the vocabulary file on first call (then caches to `~/.cache/tiktoken/` or `%LOCALAPPDATA%\tiktoken`). Subsequent calls are fast.

**How to avoid:** Warm the encoder at startup (not on first request). In `context_window.py`'s module-level initialization block, call `_get_encoder()` once so the file is downloaded during startup, not during a live request. If startup fails, the fallback flag is already set.

**Warning signs:** First chat response after server restart is slow; `requests.exceptions.ConnectionError` during import in air-gapped environments.

### Pitfall 4: DropdownMenuItem and Tooltip interaction in Radix UI

**What goes wrong:** Tooltip doesn't appear; clicking the Info icon selects the model instead of showing the tooltip; or tooltip flickers.

**Why it happens:** Radix UI's `DropdownMenuItem` captures pointer events for selection. The Info icon sits inside a menu item — pointer events on the icon's `TooltipTrigger` may be swallowed by the parent item.

**How to avoid:** 
- Add `onSelect={(e) => e.preventDefault()}` is not applicable here (the icon is not a menu item).
- Use `e.stopPropagation()` on the Info icon's `onClick` to prevent accidental model selection when clicking the icon.
- Tooltip is hover-triggered (`Tooltip` not `Popover`), so click propagation is less critical than mouseenter propagation.
- Apply `pointer-events-none` to the model name text span if needed; keep `pointer-events-auto` on the Info icon.

**Warning signs:** Hovering the Info icon immediately closes the dropdown; clicking the icon selects the model without showing the tooltip.

### Pitfall 5: Generation keyword "document" is too broad

**What goes wrong:** Simple tasks like "summarize this document" or "analyze the document" fire the escalation path because the word "document" appears in the task string.

**Why it happens:** D-01 includes "document" as a keyword. A task description of "Analyze the attached document" contains "document" but is an analysis task, not a generation task.

**How to avoid:** This is a known trade-off explicitly chosen in D-01 ("No verb matching — format keywords are unambiguous"). Accept that "document" as a standalone keyword may over-escalate slightly. The escalation cost is using the more capable model, which is safe — it's not a correctness issue. No code mitigation needed, but note this in comments.

**Warning signs:** Not a bug — by design. Document in code comments.

---

## Code Examples

### tiktoken in context_window.py

```python
# Module-level (top of context_window.py, after existing imports)
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

def _get_cl100k():
    """Return cached cl100k_base encoder, or None if tiktoken unavailable."""
    global _CL100K
    if _CL100K is None and _TIKTOKEN_AVAILABLE:
        _CL100K = _tiktoken.get_encoding("cl100k_base")  # type: ignore[union-attr]
    return _CL100K

def estimate_tokens(text: str | None, model: str = "") -> int:
    """Estimate token count. Uses tiktoken for OpenAI models when available."""
    if not text:
        return 0
    if model and (model.startswith("gpt-") or model.startswith(("o1", "o3"))):
        enc = _get_cl100k()
        if enc is not None:
            return max(1, len(enc.encode(text)))
    return max(1, len(text) // 4)
```

### Sub-agent keyword routing in sub_agent_service.py

```python
# At module level, after _SUB_AGENT_MODEL_DEFAULTS
_GENERATION_KEYWORDS = frozenset({
    "pptx", "powerpoint", "presentation",
    "report", "document", "pdf",
    "spreadsheet", "excel", "csv export",
})

def _is_generation_task(task: str) -> bool:
    t = task.lower()
    return any(kw in t for kw in _GENERATION_KEYWORDS)

# Inside run_sub_agent(), replacing the current model resolution + token logic:
is_generation = _is_generation_task(task)

if settings.sub_agent_model:
    effective_model = settings.sub_agent_model
elif is_generation:
    # Escalate to orchestrator model for generation tasks (D-02)
    effective_model = (
        user_settings.llm_model if user_settings else None
    ) or model or settings.llm_model
else:
    provider = user_settings.active_provider if user_settings else ""
    provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
    effective_model = (
        provider_default
        or (user_settings.llm_model if user_settings else None)
        or model
        or settings.llm_model
    )

# Ceiling selection (D-03 / D-08)
if is_generation:
    output_ceiling = min(32768, settings.sub_agent_max_output_tokens)
    # Generation tasks need at least 32k; take the higher of the two
    output_ceiling = max(32768, output_ceiling)
else:
    output_ceiling = settings.sub_agent_max_output_tokens  # slider value (default 8192)

resolved_tokens = _resolve_max_tokens(output_ceiling, user_settings)
```

**Note on generation ceiling logic:** D-08 says "Generation tasks override this with min(32,768, slider_value)" — meaning the slider sets a *baseline* but generation tasks get at least 32768. Read as: generation ceiling = max(32768, slider_value), capped by model limits via `_resolve_max_tokens`. Analysis tasks use the slider value directly.

### SliderInput component shape

```tsx
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

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| chars/4 heuristic for all models | tiktoken for OpenAI, chars/4 for others | This phase | ~30% more accurate token counts for GPT models; prevents context overflow on long JSON-heavy tool results |
| Fixed 8192 output ceiling for all sub-agent tasks | 8192 for analysis, 32768 for generation | This phase | Generation tasks (PPTX, reports) can produce complete outputs without truncation |
| No context/token controls in Settings UI | Sliders for context depth and sub-agent output, model override dropdown | This phase | Admin can tune behaviour without .env edits |
| No model metadata in UI | Static MODEL_INFO lookup with context/output/bestFor per model | This phase | Users can make informed model selections |

**Deprecated/outdated:**
- `estimate_tokens(text)` one-arg signature: Will gain optional `model=""` arg. Callers that don't pass model get chars/4 — backward compatible.
- Sub-agent hardcoded `8192` literal in `_resolve_max_tokens(8192, user_settings)`: Replaced by `settings.sub_agent_max_output_tokens`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `accent-primary` Tailwind utility applies the theme's primary color to `<input type="range">` thumb and track via CSS `accent-color` | Architecture Patterns / Pattern 3 | Minor — worst case slider uses default browser color; fix with explicit CSS |
| A2 | D-08 "min(32,768, slider_value)" means generation ceiling = max(slider, 32768), not min | Code Examples / sub-agent routing | Medium — if wrong, generation tasks get capped below 32768; re-read D-08 carefully during implementation |
| A3 | `_resolve_max_tokens(explicit, user_settings)` with `explicit=32768` correctly caps at model's real ceiling via priority chain | Architecture Patterns | LOW — _resolve_max_tokens priority 1 returns explicit value directly; no model ceiling check. If model can't do 32768, the API will error. Verify each model's actual output ceiling vs the 32768 request. |

---

## Open Questions

1. **Does D-08 mean generation ceiling = min(32768, slider) or max(32768, slider)?**
   - What we know: D-08 says "Generation tasks override this with min(32,768, slider_value)" — which reads as `min(32768, slider_value)`. But the default slider is 8192, making `min(32768, 8192) = 8192`, which defeats the purpose.
   - What's unclear: Whether "min" is a typo for "max", or whether the intent is generation tasks use 32k *regardless* of slider and the slider only controls analysis tasks.
   - Recommendation: Read as `max(32768, slider_value)` — generation tasks get *at least* 32768. The analysis ceiling is the slider value directly. This interpretation is consistent with D-03 ("Generation tasks override to 32768") and the CONTEXT.md specifics ("Same model as main agent for escalation").

2. **Should `estimate_messages_tokens()` propagate the model for tiktoken accuracy?**
   - What we know: `estimate_messages_tokens()` currently calls `estimate_tokens(content)` without a model. Adding model propagation requires signature changes across 3 functions and their callers.
   - What's unclear: How much accuracy improvement this gives in practice for the main agent (whose history uses tiktoken-counted text).
   - Recommendation: Extend `estimate_tokens(text, model="")` but only thread model through `estimate_messages_tokens()` if the planner chooses — it's optional for correctness (chars/4 fallback is safe). Phase can deliver CTX-05 with tiktoken in estimate_tokens only, without threading through message estimation.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| tiktoken | CTX-05 (estimate_tokens) | Not in venv | 0.12.0 installable | chars/4 heuristic (already in use) |
| @radix-ui/react-tooltip | CTX-04 (model info card) | Already installed | 1.2.8 | N/A — already present |
| @radix-ui/react-popover | CTX-04 (if popover chosen) | NOT installed | 1.1.15 available | Use Tooltip instead (decision: Tooltip) |

**Missing dependencies with no fallback:**
- None that block execution.

**Missing dependencies with fallback:**
- tiktoken: Not in backend venv. Must be installed (`pip install tiktoken==0.12.0` + add to requirements.txt). Fallback to chars/4 is already implemented and will continue working during development before install.

---

## Validation Architecture

> Nyquist validation is not explicitly disabled (config.json has no nyquist_validation key — treated as enabled).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.0.0 + pytest-asyncio |
| Config file | backend/pytest.ini or pyproject.toml (check) |
| Quick run command | `pytest backend/tests/test_context_window.py -x` |
| Full suite command | `pytest backend/tests/ -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTX-01 | Generation keywords trigger escalated model + 32768 ceiling | unit | `pytest backend/tests/test_sub_agent_routing.py -x` | No — Wave 0 |
| CTX-02 | Analysis tasks use cheap model + slider-value ceiling | unit | `pytest backend/tests/test_sub_agent_routing.py::test_analysis_routing -x` | No — Wave 0 |
| CTX-03 | Settings API returns + saves sub_agent_max_output_tokens | unit | `pytest backend/tests/test_settings.py -x` | Likely partial |
| CTX-04 | MODEL_INFO keys match backend config.py keys | unit | `vitest run src/lib/model-info.test.ts` | No — Wave 0 |
| CTX-05 | estimate_tokens() uses tiktoken for gpt-* / o1 / o3 models | unit | `pytest backend/tests/test_context_window.py::test_tiktoken_estimate -x` | No — Wave 0 |

### Wave 0 Gaps

- [ ] `backend/tests/test_sub_agent_routing.py` — covers CTX-01, CTX-02
- [ ] `frontend/src/lib/model-info.test.ts` — covers CTX-04 key alignment
- [ ] `backend/tests/test_context_window.py` — needs tiktoken test cases (file may exist; needs new test)

*(Existing test infrastructure is present; gaps are new test functions, not new framework setup)*

---

## Security Domain

Phase 51 is a configuration and routing enhancement. Security impact is minimal.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — settings API already auth-gated |
| V3 Session Management | No | N/A |
| V4 Access Control | Yes (minor) | Settings API uses `get_current_user` dependency — already enforced. New `sub_agent_max_output_tokens` field flows through same auth path. |
| V5 Input Validation | Yes | New `sub_agent_max_output_tokens: int | None = None` in SettingsUpdate Pydantic model — type validation is automatic. Add explicit range validation (min=4096, max=65536) consistent with slider bounds. |
| V6 Cryptography | No | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Over-large output token value in PATCH | Tampering | Pydantic field validator: `Field(ge=4096, le=65536)` on `sub_agent_max_output_tokens` in SettingsUpdate |
| Keyword injection via task string | Tampering | Keywords are read-only frozenset in backend; no user control over the keyword list. Task string comes from LLM tool call, not user input directly. Low risk. |

---

## Sources

### Primary (HIGH confidence)

- Codebase read: `backend/app/services/context_window.py` — estimate_tokens() signature, chars/4 implementation
- Codebase read: `backend/app/services/sub_agent_service.py` — _SUB_AGENT_MODEL_DEFAULTS, run_sub_agent() full body
- Codebase read: `backend/app/config.py` — Settings class, MODEL_CONTEXT_DEFAULTS, sub_agent_max_chars
- Codebase read: `backend/app/services/openai_service.py` — _resolve_max_tokens() priority chain, _MODEL_OUTPUT_DEFAULTS
- Codebase read: `backend/app/api/settings.py` — FullSettingsResponse, SettingsUpdate, update_settings handler
- Codebase read: `backend/app/models/user_settings.py` — UserEffectiveSettings, load_app_settings(), save_override()
- Codebase read: `frontend/src/pages/SettingsPage.tsx` — NumberInput, Toggle, FieldRow patterns; hydrate(); handleSaveAIModel()
- Codebase read: `frontend/src/components/chat/MessageInput.tsx` — models.map() loop, DropdownMenuItem structure
- Codebase read: `frontend/src/lib/api.ts` — FullAppSettings, SettingsUpdate interface shapes
- Codebase read: `frontend/package.json` — @radix-ui/react-tooltip installed, @radix-ui/react-popover NOT installed
- pip dry-run: `tiktoken==0.12.0` installable into Python 3.12 venv [VERIFIED]
- npm view: `@radix-ui/react-popover` version 1.1.15 available [VERIFIED]

### Secondary (MEDIUM confidence)

- tiktoken GitHub: official BPE tokenizer for OpenAI models; cl100k_base used for GPT-4, GPT-3.5, text-embedding models; o200k_base for o1/o3 models [ASSUMED — D-15 locks cl100k_base for all OpenAI models regardless]

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**
- Sub-agent routing: HIGH — full source read, no ambiguity
- tiktoken integration: HIGH — pattern is standard; only open question is encoder caching optimization
- Settings stack: HIGH — 4-layer stack fully read; all extension points identified
- SliderInput component: HIGH — HTML native range, Tailwind accent utility
- MODEL_INFO / Tooltip: HIGH — Tooltip already installed; Popover deliberately avoided

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (stable stack; only risk is new model IDs being added)
