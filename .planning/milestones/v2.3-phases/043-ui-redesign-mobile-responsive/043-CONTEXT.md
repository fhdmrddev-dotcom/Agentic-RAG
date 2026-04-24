# Phase 43: UI Redesign — Collapsible Nav & Settings - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Two desktop UX improvements, plus mobile responsiveness as a deferred wave:

1. **Collapsible sidebar panel** — The AppDock icon rail + Sidebar thread list become a single toggleable panel. Collapsed: icon-only rail (like Claude.ai). Expanded: full panel with icons + thread list. Logo adapts. Toggle persists in localStorage.
2. **Settings page tabs** — Replace the long single-scroll SettingsPage with 5 horizontal tabs, each with its own scoped Save button.
3. **Mobile responsiveness** — Frosted overlay drawer + responsive breakpoints. Deferred to Wave 3 (separate execution wave, same phase).

All changes are **structural/CSS refactors** — no changes to data fetching, auth, SSE, or business logic.

</domain>

<decisions>
## Implementation Decisions

### A. Collapsible Sidebar Panel

- **D-01:** The AppDock (`w-14`) and Sidebar (`w-64`) are refactored into a single `NavPanel` component with two states: `collapsed` (icon-only, narrow rail) and `expanded` (icon rail + thread list). The outer `ChatLayout` layout becomes: `| NavPanel | main |`.
- **D-02:** A **toggle button** (chevron-left / chevron-right icon) sits at the top of the panel. Click to collapse or expand. No hover-triggered expand — explicit click only.
- **D-03:** The last state (collapsed or expanded) is persisted to `localStorage` under a key like `nav_panel_collapsed`. Restored on page load. Default: **expanded**.
- **D-04:** **Collapsed state** — `w-14` icon-only rail:
  - Sparkles icon (gradient-primary, no text)
  - 5 nav icon buttons (Chat, Documents, Library Health, Skills, Settings) — same `gradient-primary` active pill as Phase 42
  - Toggle button (chevron-right) to expand
  - Sign Out icon at bottom
  - Thread list completely hidden — no thread items, no New Chat button
- **D-05:** **Expanded state** — full panel (`w-64` or similar):
  - Left sub-column: same icon rail as collapsed (but narrower, `w-14`)
  - Right sub-column: thread list area — logo block at top, New Chat button, scrollable thread list, theme toggle at bottom
  - Toggle button (chevron-left) at top of the right sub-column (or top of the full panel)
- **D-06:** **Logo behavior:**
  - Collapsed: only the gradient Sparkles icon (no wordmark, no subtitle)
  - Expanded: Sparkles icon + "Agentic RAG" wordmark + "Powered by AI" subtitle — same as current Sidebar logo block
- **D-07:** Tooltip on nav icons in collapsed state — same `TooltipContent side="right"` pattern already in `AppDock.tsx`. Tooltips hidden in expanded state (labels are visible).
- **D-08:** The "currently showing threads regardless of navigation view" bug is fixed by this refactor — the thread list is inside the collapsible right sub-column of NavPanel, not always visible. When collapsed, threads are hidden.

### B. Settings Page Tabs

- **D-09:** SettingsPage replaces its single long scroll with a **horizontal tab strip** at the top. 5 tabs:
  - **AI Model** — LLM provider selector, active model, provider-specific model/base_url fields
  - **Search & Retrieval** — Embedding config, reranking config, retrieval weights (top_k, threshold, hybrid weights, rrf_k)
  - **Integrations** — Per-provider API keys, Tavily web search key + max_results, code sandbox toggle
  - **Memory** — Memory entries list (existing MemorySection component)
  - **Audit Log** — Audit log viewer + CSV export (existing AuditLogSection component)
- **D-10:** **Per-tab Save button** — only tabs with editable config get a Save button:
  - AI Model tab: Save button → persists provider + model config
  - Search & Retrieval tab: Save button → persists retrieval/embedding/reranking config
  - Integrations tab: Save button → persists API keys + sandbox flag
  - Memory tab: no Save button (inline save per entry already exists)
  - Audit Log tab: no Save button (read-only + export)
- **D-11:** Each tab's Save button only calls the backend with its own config slice — not the full settings payload. This fixes the current `KEY_PLACEHOLDER` bug (WR-04 from code review) naturally, since each tab manages only its own fields.
- **D-12:** Active tab persisted to `localStorage` (key: `settings_active_tab`). Restored on next open. Default: AI Model tab.
- **D-13:** Tab strip uses the existing shadcn/ui `Tabs` component (`@/components/ui/tabs`) if available, or a simple custom tab implementation consistent with the tonal design system.

### C. Mobile Responsiveness (Wave 3 — deferred)

Mobile implementation is intentionally separated into Wave 3 of this phase. Full decisions captured below for when Wave 3 executes:

- **D-14:** AppDock hidden on mobile (`hidden md:flex` on NavPanel). Sidebar hidden on mobile.
- **D-15:** Main area goes full-width on mobile.
- **D-16:** A `Menu` icon button appears top-left of ChatArea header on mobile only (`md:hidden`). Opens a frosted overlay drawer.
- **D-17:** Mobile drawer: `fixed inset-y-0 left-0 z-50 w-72 bg-sidebar/95 backdrop-blur-md`, slides in from left. Contains thread list (top, scrollable) + nav icon row (bottom, fixed). Frosted backdrop (`z-40 bg-black/50 backdrop-blur-sm`) — tap to close.
- **D-18:** Nav icon selection closes drawer. Thread selection does not auto-close.
- **D-19:** Active thread accent upgraded in both desktop and mobile: `bg-primary/15` background + `gradient-primary` left bar (instead of solid `bg-primary`).
- **D-20:** MessageInput already a floating pill from Phase 41 — verify z-index and viewport inset compatibility only.

### Claude's Discretion

- Exact collapsed/expanded panel widths — `w-14` collapsed, `w-64` expanded is the baseline; adjust if proportions feel off
- Whether NavPanel uses CSS `width` transition or a class swap (prefer CSS transition for smoothness: `transition-[width] duration-200 ease-in-out`)
- Whether the icon rail in expanded state is visually separated from the thread list area (a subtle `border-r border-border/10` or tonal background difference)
- shadcn/ui `Tabs` component vs custom tab strip — prefer shadcn if already installed

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/milestones/v2.2-ROADMAP.md` §"Phase 43" — Original success criteria (mobile + active accent + breakpoints)

### Source Files to Modify
- `frontend/src/components/layout/ChatLayout.tsx` — replace `<AppDock> + <Sidebar>` with `<NavPanel>`, wire collapse state
- `frontend/src/components/layout/AppDock.tsx` — icon rail logic extracted into NavPanel (may be deleted or merged)
- `frontend/src/components/layout/Sidebar.tsx` — thread list logic extracted into NavPanel right sub-column
- `frontend/src/pages/SettingsPage.tsx` — add tab strip, split sections into tab panels, per-tab Save buttons

### New Components to Create
- `frontend/src/components/layout/NavPanel.tsx` — collapsible nav panel combining icon rail + thread list (replaces AppDock + Sidebar)

### Design System References
- `frontend/src/index.css` — `gradient-primary`, `.ghost-border`, CSS variables
- `frontend/tailwind.config.js` — breakpoint config, transition utilities
- `frontend/src/components/layout/AppDock.tsx` — existing nav icon pattern, active state (`gradient-primary` pill)
- `frontend/src/components/layout/Sidebar.tsx` — existing thread list rendering, logo block, theme toggle footer
- `frontend/src/components/ui/tabs.tsx` — shadcn Tabs component (if present — check before using)
- `frontend/src/components/health/HealthPanel.tsx` — `bg-card/50 ghost-border` tonal pattern reference

### Phase Context References
- `.planning/phases/042-ui-redesign-layout-shell-skills/042-CONTEXT.md` — AppDock structure (D-01–D-05), active state pattern, Sidebar thread-list-only decisions
- `.planning/phases/041-ui-redesign-tool-call-visualizer-citations/041-CONTEXT.md` — glass depth pattern, MessageInput floating pill spec

### Code Review Findings (relevant to Settings work)
- `.planning/phases/042-ui-redesign-layout-shell-skills/042-REVIEW.md` §WR-03 — audit log export silent failure (fix while touching SettingsPage)
- `.planning/phases/042-ui-redesign-layout-shell-skills/042-REVIEW.md` §WR-04 — `KEY_PLACEHOLDER` bug in handleSave (per-tab Save fixes this naturally)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AppDock.tsx` — `NAV_ITEMS` array + icon button + tooltip pattern. Copy directly into NavPanel collapsed/icon-rail section.
- `Sidebar.tsx` — logo block, New Chat button, thread list map, theme toggle footer. Copy into NavPanel expanded right sub-column.
- `SettingsPage.tsx` — all existing section components (`ProviderSection`, `ModelSection`, `AuditLogSection`, `MemorySection`, etc.) are reusable as-is — only the top-level layout changes to tabs.

### Established Patterns
- `gradient-primary` — `background-image: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)`. Active AppDock icon, New Chat button, Sidebar logo.
- `bg-card/50 ghost-border` — tonal input/panel pattern from Phase 41/42. Use for Settings tab content panels.
- `transition-[width] duration-200 ease-in-out` — Tailwind arbitrary transition for smooth panel collapse animation.
- Active thread state: `bg-primary/10 text-primary` + `w-0.5 bg-primary` left bar — upgrade to `bg-primary/15` + gradient bar in Wave 3.

### Integration Points
- `ChatLayout.tsx` currently renders `<AppDock> + <Sidebar> + <main>`. Replace with `<NavPanel isCollapsed={...} onToggle={...}> + <main>`. NavPanel receives all props currently split across both components.
- `App.tsx` passes `activeView` + `onNavigate` to `ChatLayout` → AppDock. Same props flow to NavPanel unchanged.
- `SettingsPage.tsx` currently has a single `handleSave` that posts all config. Split into `handleSaveAIModel`, `handleSaveSearch`, `handleSaveIntegrations` — each posts only its slice.

</code_context>

<specifics>
## Specific Ideas

- Claude.ai reference: collapsed nav = icon-only strip, expanded = icon strip + content panel. Exact same pattern requested.
- The "threads always visible" current bug is resolved by moving the thread list into the collapsible right sub-column of NavPanel — it only shows when panel is expanded.
- Settings per-tab Save naturally resolves the WR-04 `KEY_PLACEHOLDER` bug from the Phase 42 code review by scoping each save to only its own fields.

</specifics>

<deferred>
## Deferred Ideas

- **Full mobile responsiveness** — captured in D-14 through D-20 above; deferred to Wave 3 of this phase. Execute after Wave 1 (NavPanel) and Wave 2 (Settings tabs) are stable.

</deferred>

---

*Phase: 043-ui-redesign-nav-settings-mobile*
*Context gathered: 2026-04-19*
