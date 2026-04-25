# Phase 48: Settings & Navigation Polish — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

> **Phase numbering note:** ROADMAP.md shows this as Phase 49 (Settings & Navigation Polish). The authoritative sequence is STATE.md: Phase 47 = Document List & Upload Polish (shipped 2026-04-25), Phase 48 = Settings & Navigation Polish (this phase). ROADMAP is stale by 1 due to Smart Skill Dispatch being deferred.

<domain>
## Phase Boundary

Two independent areas of polish:

1. **Web search toggle (SETT-01/02):** Add an explicit on/off toggle for web search in the Settings → Integrations tab. Currently web search is implicitly enabled by having a Tavily key. After this phase it has an independent boolean that can turn off the tool even when a key exists.

2. **Nav logo visibility (NAV-01/02):** The Sparkles brand icon disappears entirely when the sidebar is collapsed because `opacity-0` is applied to the whole logo group. Fix: show the icon-only when collapsed, hide only the text.

What's in scope:
- `web_search_enabled` bool in `UserEffectiveSettings` + `SettingsUpdate` + override file
- Toggle UI in Integrations tab (gating the key and max-results fields)
- Inline warning when toggle=on but no key configured
- GET response uses the stored bool (not derived from key presence)
- NavPanel logo header: icon always visible, text fades on collapse

What's NOT in scope:
- Any other Settings tab changes
- Nav item icon visibility (already correct — only the span has opacity-0)
- Sidebar width, layout, or collapse/expand behavior
- Any backend changes to the Tavily API call itself

</domain>

<decisions>
## Implementation Decisions

### Web Search Toggle — Backend (SETT-01/02)

- **D-01:** Add `web_search_enabled: bool` field to `UserEffectiveSettings` in `backend/app/models/user_settings.py`. Load it via `_bool(override, "web_search_enabled", bool(env_settings.tavily_api_key))` — defaults to `True` when a key is present (backward compatible), `False` when no key. Stored independently in `settings_override.json`.

- **D-02:** Add `web_search_enabled: bool | None = None` to `SettingsUpdate` in `backend/app/api/settings.py`. In the save handler, persist it to the override file like `sandbox_enabled`.

- **D-03:** Change `settings.py:142` GET response from `web_search_enabled=bool(s.tavily_api_key)` to `web_search_enabled=s.web_search_enabled`. The stored bool is now authoritative; key presence no longer overrides the user's intent.

- **D-04:** `openai_service.py:503` `if settings.web_search_enabled:` — once `UserEffectiveSettings` has the field (D-01), this gate works correctly with the user's stored preference. No change needed to this line itself.

### Web Search Toggle — Frontend (SETT-01/02)

- **D-05:** Add `webSearchEnabled` state to `SettingsPage`. In `hydrate()`, set it from `data.web_search_enabled` (already in the GET response type `FullAppSettings`). Include `web_search_enabled: webSearchEnabled` in `handleSaveIntegrations` payload alongside the existing `tavily_api_key` and `web_search_max_results`.

- **D-06:** The Web Search `SectionCard` in the Integrations tab gains a toggle at the top: `FieldRow label="Enabled" → Toggle checked={webSearchEnabled}`. This mirrors the Reranking section pattern exactly. When off, the key field and max-results field are hidden (conditional render `{webSearchEnabled && (...)}` around the inner `bg-card/40` block).

- **D-07:** When `webSearchEnabled` is `true` but `tavilyApiKey` is empty (not `KEY_PLACEHOLDER`, not a real key), show an inline warning below the toggle: `"No Tavily API key configured — web search will not run."` Style: `text-xs text-amber-500` (same amber used elsewhere for non-critical warnings).

### Logo Visibility — Frontend (NAV-01/02)

- **D-08:** In `NavPanel.tsx` header section (currently lines 241–251), the entire `<div className="flex items-center gap-2 transition-opacity duration-200" …>` has `isCollapsed ? "opacity-0" : "opacity-100 delay-100"` applied to it. Move the opacity classes from the container `<div>` to only the text `<span>` ("Agentic RAG"). The Sparkles icon `<div>` becomes always visible.

  Before (simplified):
  ```tsx
  <div className={cn("flex items-center gap-2 transition-opacity", isCollapsed ? "opacity-0" : "opacity-100 delay-100")}>
    <div className="w-8 h-8 rounded-lg gradient-primary ..."><Sparkles /></div>
    <span>Agentic RAG</span>
  </div>
  ```

  After:
  ```tsx
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 rounded-lg gradient-primary shrink-0 ..."><Sparkles /></div>
    <span className={cn("font-headline ...", isCollapsed ? "opacity-0" : "opacity-100 delay-100 transition-opacity duration-200")}>
      Agentic RAG
    </span>
  </div>
  ```

- **D-09:** No positional changes needed. The Sparkles icon at `px-4` (16px) left aligns naturally within the 64px collapsed strip — visually centered in the icon column. This covers both NAV-01 and NAV-02 (they're the same root cause).

### Claude's Discretion

- Whether the Tavily key warning (D-07) appears below the Toggle FieldRow or below the key input field — Claude picks whatever reads most naturally in the UI.
- Exact amber shade: `text-amber-500` or `text-yellow-500` — match whatever is used in the codebase for non-critical inline warnings.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — settings model and save
- `backend/app/models/user_settings.py` §42–86 — `UserEffectiveSettings` model; add `web_search_enabled: bool` here (D-01); `load_app_settings()` at §225 is where the `_bool()` call goes
- `backend/app/api/settings.py` §53 — `FullAppSettings.web_search_enabled` already exists; §97 — `SettingsUpdate` needs `web_search_enabled: bool | None = None` (D-02); §142 — change to `s.web_search_enabled` (D-03)
- `backend/app/config.py` §158–159 — existing `web_search_enabled` property (key-derived); the new field in `UserEffectiveSettings` supersedes this for runtime tool gating

### Backend — tool gating
- `backend/app/services/openai_service.py` §500–507 — `get_tools()` function; `if settings.web_search_enabled:` at §503 gates the tool inclusion; no code change needed here once D-01 flows through

### Frontend — Settings page
- `frontend/src/pages/SettingsPage.tsx` §460–979 — full page; §513–515 — `tavilyApiKey` / `webSearchMaxResults` states (add `webSearchEnabled` alongside); §550 — `hydrate()` Tavily block (add `setWebSearchEnabled(data.web_search_enabled)`); §626–644 — `handleSaveIntegrations` (add `web_search_enabled`); §926–937 — Web Search `SectionCard` (add toggle + conditional fields + warning per D-05–D-07)
- Reranking section pattern (§849–907) — exact analog for toggle-gating a subsection; follow this pattern for D-06

### Frontend — NavPanel
- `frontend/src/components/layout/NavPanel.tsx` §239–252 — logo header block; D-08 applies here
- `frontend/src/components/layout/NavPanel.tsx` §262–288 — nav item buttons; icons are already opacity-safe (only the span has opacity-0); no changes needed here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Toggle` component (SettingsPage.tsx:101–123) — already defined in the file, used for rerank/sandbox; D-06 uses the same component
- `FieldRow` component (SettingsPage.tsx:25–32) — wraps all labeled controls; toggle goes in a `FieldRow`
- `SectionCard` component (SettingsPage.tsx:152–166) — wraps each settings group; Web Search already uses it

### Established Patterns
- Reranking toggle-gates its subsection: `rerankEnabled && (<>fields...</>)` at §853 — exact pattern for D-06
- `sandbox_enabled` in `SettingsUpdate` and `handleSaveIntegrations` at §99/§632 — exact pattern for adding `web_search_enabled` to the POST body
- `_bool(override, key, env_default)` helper in `user_settings.py:153–159` — use this for `web_search_enabled` in D-01
- NavPanel `isCollapsed` opacity pattern: `isCollapsed ? "opacity-0" : "opacity-100 delay-100"` on spans — move to text span only for D-08

### Integration Points
- `FullAppSettings.web_search_enabled` (settings.py:53) is already surfaced in the GET response — frontend only needs to read it and wire the state
- `UserEffectiveSettings` flows through `load_user_settings()` → `get_tools()` in `openai_service.py` — adding the field at the model level automatically gates the tool correctly

</code_context>

<specifics>
## Specific Ideas

- The web search Warning (D-07) should be subtle — amber text, no red/destructive styling. It's advisory not blocking.
- The Reranking section is the best analog for the Web Search toggle pattern — even the field layout (key + top-n) mirrors the structure.

</specifics>

<deferred>
## Deferred Ideas

- Frontend pre-flight size check before upload (from Phase 47 discussion) — backend check is sufficient for now
- Folder-level document count badges on FolderNode items — beyond Phase 47 scope

</deferred>

---

*Phase: 48-settings-navigation-polish*
*Context gathered: 2026-04-25*
