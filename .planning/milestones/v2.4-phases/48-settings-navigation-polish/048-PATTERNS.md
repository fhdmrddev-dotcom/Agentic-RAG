# Phase 48: Settings & Navigation Polish — Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 8
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/models/user_settings.py` | model | CRUD | same file — `sandbox_enabled` field + `_bool()` pattern | exact |
| `backend/app/api/settings.py` | controller | request-response | same file — `sandbox_enabled` in SettingsUpdate + save handler | exact |
| `backend/app/api/feedback.py` | controller | request-response | same file — existing return dict at line 184 | exact |
| `frontend/src/pages/SettingsPage.tsx` | component | request-response | same file — Reranking SectionCard (lines 848–878) | exact |
| `frontend/src/components/layout/NavPanel.tsx` | component | — | same file — nav item span opacity pattern (lines 270–273) | exact |
| `frontend/src/components/ui/tabs.tsx` | utility/ui | — | same file — TabsTrigger className (line 30) | exact |
| `frontend/src/lib/api.ts` | utility | request-response | same file — adjacent `DownvotedDocument` interface (lines 680–685) | exact |
| `frontend/src/components/health/FeedbackStatsPanel.tsx` | component | request-response | same file — existing positive-rate flex row (lines 47–56) | exact |

---

## Pattern Assignments

### `backend/app/models/user_settings.py` — add `web_search_enabled: bool` field (D-01)

**Analog:** Same file — `sandbox_enabled: bool` field + `_bool()` loader call

**Step 1 — Add field to `UserEffectiveSettings` class (lines 75–80). Insert after `web_search_max_results`:**
```python
# Web search
tavily_api_key: str
web_search_max_results: int
web_search_enabled: bool          # <-- ADD THIS

# Sandbox
sandbox_enabled: bool
```

**Step 2 — Add `_bool()` loader call in `load_app_settings()` return statement (lines 257–260). Insert after `web_search_max_results` line:**
```python
tavily_api_key=_str(override, "tavily_api_key", env_settings.tavily_api_key),
web_search_max_results=_int(override, "web_search_max_results", env_settings.web_search_max_results),
web_search_enabled=_bool(override, "web_search_enabled", bool(env_settings.tavily_api_key)),  # <-- ADD

sandbox_enabled=_bool(override, "sandbox_enabled", env_settings.sandbox_enabled),
```

The `_bool()` helper (lines 153–159) is the exact function to use — it reads from the override dict, falls back to the env default, and coerces non-bool strings. The env default is `bool(env_settings.tavily_api_key)` so it defaults to `True` when a key is present (backward compatible) and `False` when no key.

---

### `backend/app/api/settings.py` — add `web_search_enabled` to SettingsUpdate + fix GET response (D-02, D-03)

**Analog:** Same file — `sandbox_enabled: bool | None = None` in `SettingsUpdate` (line 99) and `sandbox_enabled` save block (lines 224–225) and `web_search_enabled=bool(s.tavily_api_key)` GET line (line 142).

**Step 1 — Add field to `SettingsUpdate` (lines 95–99). Insert after `web_search_max_results`:**
```python
# Web search
tavily_api_key: str | None = None      # "***" = keep; "" = clear; real = save
web_search_max_results: int | None = None
web_search_enabled: bool | None = None  # <-- ADD

# Sandbox
sandbox_enabled: bool | None = None
```

**Step 2 — Add save block in `update_settings()` (lines 219–225). Insert after the `web_search_max_results` block:**
```python
if body.tavily_api_key is not None:
    updates["tavily_api_key"] = body.tavily_api_key
if body.web_search_max_results is not None:
    updates["web_search_max_results"] = body.web_search_max_results
if body.web_search_enabled is not None:           # <-- ADD
    updates["web_search_enabled"] = body.web_search_enabled  # <-- ADD

if body.sandbox_enabled is not None:
    updates["sandbox_enabled"] = body.sandbox_enabled
```

**Step 3 — Fix GET response in `_build_response()` (line 142). Change:**
```python
# BEFORE (line 142)
web_search_enabled=bool(s.tavily_api_key),

# AFTER
web_search_enabled=s.web_search_enabled,
```

---

### `backend/app/api/feedback.py` — add `positive_count` + `negative_count` to return dict (D-11)

**Analog:** Same file — `positive_count` local variable is already computed at line 116; the return dict is at lines 184–188.

**Current return dict (lines 184–188):**
```python
return {
    "positive_rate": round(positive_rate, 4),
    "total_ratings": total_ratings,
    "downvoted_documents": downvoted_documents,
}
```

**After — add two fields. `negative_count` is derived inline (no new query):**
```python
return {
    "positive_rate": round(positive_rate, 4),
    "total_ratings": total_ratings,
    "positive_count": positive_count,                        # <-- ADD (already a local var at line 116)
    "negative_count": total_ratings - positive_count,        # <-- ADD (derived)
    "downvoted_documents": downvoted_documents,
}
```

No query changes. `positive_count` (line 116) and `total_ratings` (set just before the positive query) are both already in scope at line 184.

---

### `frontend/src/pages/SettingsPage.tsx` — add web search toggle (D-05, D-06, D-07)

**Analog:** Same file — Reranking SectionCard pattern (lines 848–878) and `sandboxEnabled` state + `handleSaveIntegrations` (lines 517, 631–633).

**Step 1 — Add state (after line 514, alongside `tavilyApiKey`):**
```tsx
// Web search
const [tavilyApiKey, setTavilyApiKey] = useState("")
const [webSearchMaxResults, setWebSearchMaxResults] = useState(5)
const [webSearchEnabled, setWebSearchEnabled] = useState(true)   // <-- ADD
```

**Step 2 — Add to `hydrate()` (after line 551). Current block:**
```tsx
setTavilyApiKey(data.web_search_enabled ? KEY_PLACEHOLDER : "")
setWebSearchMaxResults(data.web_search_max_results)
```
Add after `setWebSearchMaxResults`:
```tsx
setWebSearchEnabled(data.web_search_enabled)    // <-- ADD
```

Note: the existing `setTavilyApiKey(data.web_search_enabled ? ...)` line is a pre-existing quirk; leave it unchanged — it controls whether the key field shows `***` or blank.

**Step 3 — Add `web_search_enabled` to `handleSaveIntegrations` payload (lines 630–634). Copy `sandbox_enabled` pattern:**
```tsx
const body: SettingsUpdate = {
  tavily_api_key: tavilyApiKey || KEY_PLACEHOLDER,
  web_search_max_results: webSearchMaxResults,
  web_search_enabled: webSearchEnabled,    // <-- ADD
  sandbox_enabled: sandboxEnabled,
}
```

**Step 4 — Restructure Web Search SectionCard (lines 928–937). Replace current flat `bg-card/40` block with toggle-gated pattern, copying Reranking SectionCard exactly:**
```tsx
{/* Web Search SectionCard */}
<SectionCard title="Web Search" description="Enable web search via Tavily.">
  <FieldRow label="Enabled">
    <Toggle checked={webSearchEnabled} onChange={setWebSearchEnabled} label={webSearchEnabled ? "On" : "Off"} />
  </FieldRow>
  {webSearchEnabled && tavilyApiKey === "" && (
    <p className="text-xs text-amber-400 px-3 pb-1">
      No Tavily API key configured — web search will not run.
    </p>
  )}
  {webSearchEnabled && (
    <div className="bg-card/40 rounded-md px-3 py-2">
      <FieldRow label="Tavily API Key">
        <ApiKeyInput value={tavilyApiKey} onChange={setTavilyApiKey} placeholder="tvly-…" />
      </FieldRow>
      <FieldRow label="Max results">
        <NumberInput value={webSearchMaxResults} onChange={setWebSearchMaxResults} min={1} max={20} />
      </FieldRow>
    </div>
  )}
</SectionCard>
```

Warning color is `text-amber-400` — this matches the codebase convention (`HealthScoreGauge.tsx`, `HealthStatBar.tsx`, `KnowledgeHealthPage.tsx` all use `text-amber-400` for advisory warnings; `text-amber-500` appears only in tests and `ConfidenceBadge` which is a distinct severity scale).

Warning condition: `webSearchEnabled && tavilyApiKey === ""` — `KEY_PLACEHOLDER` ("***") means a real key exists, so the warning must only fire on literal empty string.

---

### `frontend/src/components/layout/NavPanel.tsx` — fix logo icon visibility on collapse (D-08, D-09)

**Analog:** Same file — nav item `<span>` opacity pattern (lines 270–273) where the icon remains always visible and only the span gets the opacity toggle.

**Current logo block (lines 241–251):**
```tsx
<div className={cn(
  "flex items-center gap-2 transition-opacity duration-200",
  isCollapsed ? "opacity-0" : "opacity-100 delay-100"
)}>
  <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-primary shadow-sm shadow-primary/20 shrink-0">
    <Sparkles className="w-4 h-4 text-white" />
  </div>
  <span className="font-headline font-semibold text-[15px] tracking-tight text-sidebar-foreground">
    Agentic RAG
  </span>
</div>
```

**After — move opacity from container div to text span only:**
```tsx
<div className="flex items-center gap-2">
  <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-primary shadow-sm shadow-primary/20 shrink-0">
    <Sparkles className="w-4 h-4 text-white" />
  </div>
  <span className={cn(
    "font-headline font-semibold text-[15px] tracking-tight text-sidebar-foreground transition-opacity duration-200",
    isCollapsed ? "opacity-0" : "opacity-100 delay-100"
  )}>
    Agentic RAG
  </span>
</div>
```

The nav item pattern (lines 270–273) proves this approach is correct — `<Icon>` is never opacity-toggled, only `<span>` is. The logo fix mirrors that exact pattern.

---

### `frontend/src/components/ui/tabs.tsx` — fix stale tab animation (D-10)

**Analog:** Same file — `TabsTrigger` className string at line 30.

**Current `TabsTrigger` className (line 30):**
```tsx
"inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
```

**After — single token replacement:**
```tsx
"inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
```

Change is `transition-all` → `transition-colors`. This is a global change affecting Settings tabs, Library Health tabs, Low Confidence sub-tabs, and any other `<Tabs>` in the app. Only color properties animate on activation — eliminating the box-shadow/transform "shake" on the Stale tab.

---

### `frontend/src/lib/api.ts` — add fields to `FeedbackStats` interface (D-11)

**Analog:** Same file — `DownvotedDocument` interface directly above (lines 680–685) and `FeedbackStats` itself (lines 687–691).

**Current `FeedbackStats` interface (lines 687–691):**
```typescript
export interface FeedbackStats {
  positive_rate: number
  total_ratings: number
  downvoted_documents: DownvotedDocument[]
}
```

**After:**
```typescript
export interface FeedbackStats {
  positive_rate: number
  total_ratings: number
  positive_count: number        // <-- ADD
  negative_count: number        // <-- ADD
  downvoted_documents: DownvotedDocument[]
}
```

---

### `frontend/src/components/health/FeedbackStatsPanel.tsx` — 2-col layout with stat cards (D-12)

**Analog:** Same file — existing positive-rate flex row (lines 47–56) which is being restructured.

**Current positive-rate block (lines 47–56):**
```tsx
<div className="flex items-center gap-4 px-4 pt-4 pb-2">
  <HealthScoreGauge score={positivePercent} size="sm" />
  <div className="flex flex-col">
    <span className="text-sm font-medium text-muted-foreground">positive rating</span>
    <span className="text-xs text-muted-foreground">
      all-time · {stats.total_ratings} total ratings
    </span>
  </div>
</div>
```

**After — replace with 2-col grid. Gauge stays left, 3 stat cards go right:**
```tsx
<div className="grid grid-cols-[auto_1fr] gap-4 px-4 pt-4 pb-2">
  {/* Left: gauge unchanged */}
  <div className="flex flex-col items-center justify-center">
    <HealthScoreGauge score={positivePercent} size="sm" />
    <span className="text-xs text-muted-foreground mt-1">positive rating</span>
  </div>
  {/* Right: 3 stat cards */}
  <div className="grid grid-cols-3 gap-2">
    <div className="flex flex-col items-center justify-center rounded-md bg-card/60 border border-border/30 py-2 px-1">
      <span className="text-xs text-muted-foreground">Total</span>
      <span className="text-lg font-bold tabular-nums">{stats.total_ratings}</span>
    </div>
    <div className="flex flex-col items-center justify-center rounded-md bg-card/60 border border-border/30 py-2 px-1">
      <span className="text-xs text-muted-foreground">Positive</span>
      <span className="text-lg font-bold tabular-nums text-emerald-400">{stats.positive_count}</span>
    </div>
    <div className="flex flex-col items-center justify-center rounded-md bg-card/60 border border-border/30 py-2 px-1">
      <span className="text-xs text-muted-foreground">Negative</span>
      <span className="text-lg font-bold tabular-nums text-red-400">{stats.negative_count}</span>
    </div>
  </div>
</div>
```

Color conventions: `text-emerald-400` (positive) and `text-red-400` (negative) match the existing gauge color scale used in `HealthScoreGauge.tsx` (line 10: `v >= 80 ? "text-emerald-400" : ... "text-red-400"`). `tabular-nums` matches the existing downvote count chip pattern at line 79.

---

## Shared Patterns

### Bool flag in `UserEffectiveSettings` + `load_app_settings()`
**Source:** `backend/app/models/user_settings.py` lines 60, 80, 243, 260
**Apply to:** `web_search_enabled` field addition (D-01)
```python
# Field declaration pattern (follows existing bool fields like rerank_enabled, sandbox_enabled):
field_name: bool

# Loader call pattern in load_app_settings() return:
field_name=_bool(override, "field_name", <env_default>),
```

### Bool field in `SettingsUpdate` + conditional save block
**Source:** `backend/app/api/settings.py` lines 82, 99, 193–194, 224–225
**Apply to:** `web_search_enabled` in SettingsUpdate and update_settings() (D-02)
```python
# SettingsUpdate field pattern:
field_name: bool | None = None

# update_settings() save pattern:
if body.field_name is not None:
    updates["field_name"] = body.field_name
```

### Toggle-gated subsection in SectionCard
**Source:** `frontend/src/pages/SettingsPage.tsx` lines 848–878 (Reranking section)
**Apply to:** Web Search SectionCard restructure (D-06)
```tsx
<SectionCard title="..." description="...">
  <FieldRow label="Enabled">
    <Toggle checked={state} onChange={setState} label={state ? "On" : "Off"} />
  </FieldRow>
  {state && (
    <div className="bg-card/40 rounded-md px-3 py-2">
      {/* conditional fields */}
    </div>
  )}
</SectionCard>
```

### Amber advisory warning (inline, non-blocking)
**Source:** `frontend/src/pages/KnowledgeHealthPage.tsx` line 46 (`text-xs text-amber-400`)
**Apply to:** Web search no-key warning (D-07)
```tsx
<p className="text-xs text-amber-400 px-3 pb-1">
  Advisory message text here.
</p>
```

### Icon always-visible, text opacity-toggled on collapse
**Source:** `frontend/src/components/layout/NavPanel.tsx` lines 269–273
**Apply to:** Logo header fix (D-08)
```tsx
<Icon className="w-5 h-5 shrink-0" />    {/* no opacity classes */}
<span className={cn(
  "text-sm whitespace-nowrap transition-opacity duration-200",
  isCollapsed ? "opacity-0" : "opacity-100"
)}>
  {label}
</span>
```

---

## No Analog Found

None. All 8 files have exact in-file analogs.

---

## Metadata

**Analog search scope:** `backend/app/models/`, `backend/app/api/`, `frontend/src/pages/`, `frontend/src/components/layout/`, `frontend/src/components/ui/`, `frontend/src/components/health/`, `frontend/src/lib/`
**Files read:** 8 target files + 2 analog cross-checks (KnowledgeHealthPage.tsx for amber color, NavPanel.tsx nav item span pattern)
**Pattern extraction date:** 2026-04-25
