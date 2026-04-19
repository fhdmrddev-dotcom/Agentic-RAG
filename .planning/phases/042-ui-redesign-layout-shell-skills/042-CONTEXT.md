# Phase 42: UI Redesign — Layout Shell & Skills - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Three structural upgrades to the layout and Skills/Settings pages:
1. Extract nav icons from Sidebar into a standalone AppDock vertical icon rail
2. Rebuild SkillsPage as a 3-pane tonal layout (decorative left | skill list center | inline detail right)
3. Apply premium toggle glow and pill styling across Skills and Settings

All changes are **additive CSS/Tailwind + structural refactor** — no changes to data fetching, auth, SSE, or business logic.

</domain>

<decisions>
## Implementation Decisions

### A. AppDock Shape & Placement

- **D-01:** AppDock is a narrow vertical icon-only rail on the far left of the viewport. Layout becomes: `AppDock | Sidebar | Main`. The existing Sidebar retains its current width and thread list — AppDock is an additional column to its left.
- **D-02:** Icons in AppDock (top cluster, top-to-bottom): Chat, Documents, Library Health, Skills, Settings. Sign Out pinned to the bottom.
- **D-03:** Theme toggle remains in Sidebar or moves to Settings page — not in AppDock.
- **D-04:** Active state: the active nav icon gets a small rounded pill/square with `gradient-primary` background behind it (indigo → cyan). Consistent with the New Chat button and Phase 41 accent pattern.
- **D-05:** Nav buttons (Documents, Library Health, Skills, Settings) are removed from Sidebar's bottom fixed section — they move entirely into AppDock. Sidebar becomes a pure thread-list panel.

### B. SkillsPage 3-Pane Layout

- **D-06:** Three panes separated by tonal background shifts (not `border-r` dividers):
  - **Left pane** — Decorative/structural only. Empty tonal background column. No interactive content. Creates visual depth and signals the 3-pane structure.
  - **Center pane** — Scrollable list of SkillCards (existing component, reused). Page header (title + New/Import buttons) sits above this pane.
  - **Right pane** — Inline detail/edit panel. SkillFormDialog converts from a modal to an inline side panel rendered within the 3-pane layout.
- **D-07:** When no skill is selected, the right pane shows an empty state: Zap icon + "Select a skill to view details" text. The tonal background is always visible so the 3-pane structure is apparent even on empty state.
- **D-08:** Clicking a SkillCard populates the right panel with the skill's edit form (SkillFormDialog content, inline). The dialog modal is retired for this flow.

### C. Toggle Glow & Pill Styling

- **D-09:** The toggle switch **track** (the pill-shaped background) uses `gradient-primary` (indigo → cyan) when checked, replacing the current solid `bg-primary`. Thumb stays white. This applies to the enable/disable toggle in SkillCard.
- **D-10:** Required/ReadOnly badges are small pill `<span>` tags placed **after** the input field (not inside it):
  - "Required" badge: `bg-rose-500/10 text-rose-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full`
  - "Read Only" badge: `bg-muted text-muted-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full`
- **D-11:** Skill API key / env inputs use `bg-card/50` background with `ghost-border` and `rounded-lg` pill feel (consistent with Phase 41 parameter block styling).

### D. SettingsPage Tonal Shifts

- **D-12:** Card components stay — no structural stripping. Each Card section gets a tonal background treatment: outer Card uses `bg-card/60`, nested sub-sections (e.g. individual field groups within a Card) use `bg-card/40`. Card borders replaced with `ghost-border` only (remove hard border).
- **D-13:** The tonal depth difference between Cards and their content provides the visual separation that `border-t` dividers previously gave. No new separator elements added.

### Claude's Discretion

- Exact AppDock icon rail width (e.g. `w-12` vs `w-14`) — pick what feels balanced with the thread list Sidebar
- Whether the decorative left pane in SkillsPage has a fixed width or is proportional — use judgment based on the center list content width
- Exact tonal background values for SkillsPage panes — use existing design system variables (`bg-sidebar`, `bg-card/60`, `bg-background`) to create depth without introducing new colors
- Whether SkillFormDialog's modal trigger (the edit button on SkillCard) stays for accessibility fallback or is removed entirely

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §"UI-04, UI-05, UI-06" — locked requirements for this phase
- `.planning/ROADMAP.md` §"Phase 42" — Success criteria (5 items)

### Source Files to Modify
- `frontend/src/components/layout/Sidebar.tsx` — extract nav buttons into AppDock; Sidebar becomes thread-list-only
- `frontend/src/components/layout/ChatLayout.tsx` — add AppDock column to layout, wire navigation
- `frontend/src/pages/SkillsPage.tsx` — rebuild as 3-pane layout
- `frontend/src/components/skills/SkillCard.tsx` — gradient toggle track, pill input styling
- `frontend/src/components/skills/SkillFormDialog.tsx` — convert from modal to inline panel
- `frontend/src/pages/SettingsPage.tsx` — tonal Card bg treatment

### New Component to Create
- `frontend/src/components/layout/AppDock.tsx` — standalone vertical icon rail (new file)

### Design System References
- `frontend/src/index.css` — `gradient-primary`, `.glass`, `.ghost-border`, CSS variables
- `frontend/tailwind.config.js` — existing animate-* keyframes, gradient configs
- `frontend/src/components/layout/Sidebar.tsx` — existing active state pattern (`bg-primary/10 text-primary` + left bar) for reference
- `frontend/src/components/health/HealthPanel.tsx` — `bg-card/50 ghost-border` pattern (reference for tonal depth)

### Phase 41 Pattern Reference
- `.planning/phases/041-ui-redesign-tool-call-visualizer-citations/041-CONTEXT.md` — glass depth decisions (D-10: bg-card/80 outer, bg-card/50 nested), gradient accent patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Sidebar.tsx` — logo block, thread list, active state logic (all reusable; nav buttons extracted to AppDock)
- `SkillCard.tsx` — existing card structure; only toggle + input styles change
- `SkillFormDialog.tsx` — form content reusable inline; the Dialog wrapper is replaced by a plain panel container
- `useSkills` hook — unchanged; skill data/mutations flow into the new inline panel

### Established Patterns
- Active nav state: `bg-primary/10 text-primary` + optional left bar — AppDock active pill replaces this with `gradient-primary` bg
- Glass depth: `bg-card/80 backdrop-blur-sm` (outer) → `bg-card/50` (nested) — established in Phase 41, reused for Settings tonal treatment
- `ghost-border` utility — use instead of hard `border` on Cards and inputs
- Toggle switch: currently `bg-primary` track → upgrade to `gradient-primary` background (CSS `background-image: linear-gradient(...)` on the track element)

### Integration Points
- `ChatLayout.tsx` renders `<Sidebar>` — will add `<AppDock>` as a sibling column, update flex layout
- `App.tsx` passes `activeView` and `onNavigate` to `ChatLayout` → `Sidebar` — same props flow to AppDock
- `SkillsPage.tsx` currently has no concept of "selected skill" state — will need `useState<Skill | null>` for the detail panel

</code_context>

<specifics>
## Specific Ideas

- AppDock layout preview confirmed by user: `| AppDock | Sidebar | Main |` — AppDock is a new leftmost column, not embedded inside Sidebar
- 3-pane Skills preview confirmed: `[Nav?] | Skill list | Detail panel` — left pane is decorative/empty, center has cards, right has inline form
- Badge layout confirmed: `[ API Key _____ ] [Required]` — badge is after the input, not inside it
- Toggle glow: track only (not full card row, not icon) — switch track uses gradient-primary when enabled

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 042-ui-redesign-layout-shell-skills*
*Context gathered: 2026-04-19*
