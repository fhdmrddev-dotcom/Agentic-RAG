# Phase 43: UI Redesign — Mobile & Responsive - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the app fully usable on mobile via three structural changes:
1. Hide AppDock and Sidebar by default on viewport < 768px
2. Add a hamburger menu button (mobile-only, top-left of ChatArea header) that reveals a frosted overlay drawer
3. The drawer contains the full thread list AND a compact nav icon row at the bottom (replaces AppDock on mobile)

All changes are **additive CSS/Tailwind breakpoints + a new mobile drawer component** — no changes to data fetching, auth, SSE, or business logic.

</domain>

<decisions>
## Implementation Decisions

### A. AppDock on Mobile

- **D-01:** AppDock (`w-14` vertical icon rail) is hidden entirely on mobile (< 768px) using `hidden md:flex`. On desktop (≥ 768px) it renders as before.
- **D-02:** The frosted overlay drawer is the ONLY navigation surface on mobile. It contains:
  - **Top section (scrollable):** Full thread list — same content as Sidebar.tsx currently renders (threads, New Chat button, theme toggle)
  - **Bottom section (fixed):** Compact nav icon row — same 5 icons as AppDock (Chat, Documents, Library Health, Skills, Settings) + Sign Out pinned bottom
- **D-03:** Selecting a nav icon from the drawer's bottom icon row navigates to that view AND closes the drawer automatically.

### B. Mobile Menu Trigger

- **D-04:** A `Menu` icon (lucide-react `Menu` or `AlignLeft`) appears at the far left of the ChatArea header, **mobile-only** (`md:hidden`). It is absent on desktop.
- **D-05:** The button opens the frosted overlay drawer. It uses the same ghost button style as other icon buttons in the header.

### C. Drawer Behavior

- **D-06:** The thread list drawer is a frosted overlay panel:
  - Position: `fixed inset-y-0 left-0 z-50`
  - Width: `w-72` (slightly wider than desktop Sidebar's `w-64` to accommodate the nav icon row)
  - Background: `bg-sidebar/95 backdrop-blur-md`
  - Slides in from the left (CSS transition on `translate-x`)
- **D-07:** A frosted backdrop covers the rest of the screen when the drawer is open:
  - `fixed inset-0 z-40 bg-black/50 backdrop-blur-sm`
  - `onClick` on the backdrop closes the drawer
- **D-08:** The drawer closes when: (a) user taps the backdrop, or (b) user selects a nav icon from the bottom icon row. Thread selection does NOT auto-close the drawer — user can tap backdrop after selecting.

### D. Active Thread Accent in Drawer

- **D-09:** The active thread row in the mobile drawer gets an upgraded treatment per ROADMAP SC-2:
  - Background: `bg-primary/15` (slightly brighter than desktop's `bg-primary/10`)
  - Left accent line: uses `gradient-primary` (indigo→cyan) instead of solid `bg-primary` — achieved via `background-image: linear-gradient(to bottom, ...)` or a `gradient-primary` class on the `w-0.5` bar
- **D-10:** This upgraded active accent also applies in the desktop Sidebar (since they share the thread row rendering logic) — consistent upgrade across both surfaces.

### E. Responsive Breakpoints in ChatLayout

- **D-11:** `<AppDock>` gains `hidden md:flex` wrapper classes in ChatLayout.
- **D-12:** `<Sidebar>` gains `hidden md:flex` wrapper classes in ChatLayout.
- **D-13:** `<main className="flex-1 overflow-hidden">` is unchanged — it naturally goes full-width when its siblings are hidden on mobile.

### F. MessageInput on Mobile

- **D-14:** MessageInput was upgraded to a floating pill in Phase 41 (`rounded-2xl shadow-lg backdrop-blur-sm`). No structural changes needed for mobile — it is already positioned at the bottom of ChatArea and will render correctly at full width when main is full-width. Verify z-index and safe-area inset compatibility only.

### Claude's Discretion

- Exact transition animation for the drawer (slide-in duration and easing — `300ms ease-out` is a reasonable default)
- Whether to use a `<dialog>` element or a plain `<div>` with `aria-modal` for the drawer — use whichever is simpler to implement correctly
- The drawer's nav icon row layout — can mirror AppDock's structure but horizontal-ish within the drawer footer
- Whether drawer state (`isOpen`) lives in `ChatLayout` (passed down as prop) or managed inside a new `MobileDrawer` component — prefer co-locating state in `ChatLayout` since it controls both AppDock visibility and Sidebar visibility

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/milestones/v2.2-ROADMAP.md` §"Phase 43" — Success criteria (5 items, includes drawer spec, active accent, breakpoints, MessageInput, desktop regression)

### Source Files to Modify
- `frontend/src/components/layout/ChatLayout.tsx` — add `hidden md:flex` to AppDock and Sidebar; add hamburger trigger state and mobile drawer
- `frontend/src/components/layout/Sidebar.tsx` — upgrade active thread accent (D-09, D-10): `bg-primary/15` + gradient left bar
- `frontend/src/components/chat/ChatArea.tsx` — add mobile-only hamburger Menu button in header (D-04)

### New Component to Create
- `frontend/src/components/layout/MobileDrawer.tsx` — frosted overlay drawer with thread list + nav icon row (D-06, D-07, D-08)

### Design System References
- `frontend/src/index.css` — `gradient-primary` class, `.glass`, `.ghost-border`, CSS variables
- `frontend/tailwind.config.js` — breakpoint config (`md: 768px`), existing animate-* keyframes
- `frontend/src/components/layout/AppDock.tsx` — nav icon pattern to replicate in drawer footer
- `frontend/src/components/layout/Sidebar.tsx` — thread list rendering pattern (thread rows, New Chat button, theme toggle) to reuse in drawer

### Phase Context References
- `.planning/phases/042-ui-redesign-layout-shell-skills/042-CONTEXT.md` — AppDock structure decisions (D-01 through D-05), active state pattern (`gradient-primary` pill background)
- `.planning/phases/041-ui-redesign-tool-call-visualizer-citations/041-CONTEXT.md` — glass depth pattern (`bg-card/80 backdrop-blur-sm`), MessageInput floating pill spec

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Sidebar.tsx` — Full thread list rendering (thread rows, New Chat button, theme toggle footer). The `MobileDrawer` component reuses this content, optionally by extracting a `ThreadList` sub-component or by duplicating the thread rendering logic.
- `AppDock.tsx` — `NAV_ITEMS` array + icon button rendering pattern. Reuse for the drawer's bottom nav icon row.
- `ChatArea.tsx` — Has an existing header bar — needs a `md:hidden` hamburger button injected at the left of this header.

### Established Patterns
- `hidden md:flex` — Tailwind responsive utility for hiding elements on mobile and showing on desktop. Used on both `<AppDock>` and `<Sidebar>` wrappers in ChatLayout.
- `fixed inset-0 z-40` — Standard backdrop overlay pattern (see existing `popover` and dropdown patterns throughout the codebase).
- Active state: `bg-primary/10 text-primary` + `w-0.5 bg-primary` left bar — upgrade both to `bg-primary/15` and gradient left bar (D-09).
- `gradient-primary` — Defined in `index.css` as `background-image: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)`. Already used on AppDock active icon, New Chat button, Sidebar logo.

### Integration Points
- `ChatLayout.tsx` manages `activeView` and navigation — passes `onNavigate` to `AppDock`. The `MobileDrawer` also needs `onNavigate` to wire up its bottom nav icon row.
- `useThreads` is called in `ChatLayout` — thread data is already available at this level. Pass `threads`, `selectedThread`, `onSelectThread`, `onNewThread` to `MobileDrawer`.
- `ChatArea.tsx` needs an `onOpenMobileDrawer` prop (or equivalent) passed from `ChatLayout` to trigger the hamburger button action.

</code_context>

<specifics>
## Specific Ideas

- Drawer width `w-72` — slightly wider than desktop Sidebar (`w-64`) to give the bottom nav icon row comfortable horizontal spacing
- The backdrop uses `backdrop-blur-sm` (lighter blur than the drawer itself which uses `backdrop-blur-md`) — layered blur depth consistent with Phase 41 glass pattern
- Active thread accent upgrade (D-09) applies in both desktop Sidebar and mobile drawer — same component = consistent behavior

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 043-ui-redesign-mobile-responsive*
*Context gathered: 2026-04-19*
