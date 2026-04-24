# Phase 41: UI Redesign — Tool Call Visualizer & Citations - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Apply the Deep Midnight glassmorphic aesthetic to three chat components: ToolCallPanel, CitationCard/CitationList, and MessageInput. All changes are **additive CSS/Tailwind only** — no logic changes to SSE parsing, state management, or component APIs (SC-5).

Three deliverables:
1. ToolCallPanel — glassmorphic wrapper + frosted parameter blocks
2. CitationCard/CitationList — gradient left-accent border, file-type icons, expand/collapse animation
3. MessageInput — true floating pill layout with air around it

</domain>

<decisions>
## Implementation Decisions

### A. CitationCard Gradient Border (UI-02)
- **D-01:** Replace current `border-l-2 border-muted-foreground/30` with a gradient left-accent strip — a thin `w-0.5` div with `bg-gradient-to-b` colored per file type. No full-perimeter border.
- **D-02:** File-type gradient colors:
  - PDF: `from-red-400/60 to-transparent`
  - DOCX: `from-blue-400/60 to-transparent`
  - Markdown: `from-purple-400/60 to-transparent`
  - Default/unknown: `from-muted-foreground/30 to-transparent`
- **D-03:** File-type icons use lucide-react, color-coded matching the gradient accent color (PDF=red-400, DOCX=blue-400, Markdown=purple-400). Replace current `FileText` with type-specific icons.

### B. MessageInput Floating Pill (UI-03)
- **D-04:** True floating: add `mx-4 mb-3` to the outer wrapper so the pill sits with breathing room above the page floor. The pill has air on left, right, and bottom.
- **D-05:** Inner container upgrades: `rounded-xl` → `rounded-2xl`, `shadow-sm` → `shadow-lg shadow-primary/5`. Keep existing `ghost-border bg-card/80 backdrop-blur-sm`.
- **D-06:** Outer wrapper background (`bg-background/80 backdrop-blur-sm`) becomes transparent/removed — the pill itself is the visual element, not the full-width bar.

### C. CitationList Expand/Collapse Animation (SC-3)
- **D-07:** Install shadcn Collapsible component (`npx shadcn add collapsible`). Radix UI is already in the project (other shadcn components use it). Replaces the current conditional render with a proper animated Collapsible.
- **D-08:** Animation: `data-[state=open]:animate-in data-[state=closed]:animate-out` with `duration-200 ease-in-out`. The 200ms ease requirement from SC-3 is met via Radix's built-in data attributes.
- **D-09:** CitationList trigger button keeps its existing "N sources" text + chevron icon pattern. Only the reveal mechanism changes (conditional render → Collapsible).

### D. ToolCallPanel Glass Depth (UI-01)
- **D-10:** Two layers only (SC-1 exactly):
  - **Outer wrapper** (the ToolCallPanel root container): `bg-card/80 backdrop-blur-sm rounded-lg`
  - **Parameters/result block** within each tool item: `bg-card/50 backdrop-blur-md rounded-md`
- **D-11:** Individual tool row headers (the collapsed/expanded toggle rows) are **not** given glass treatment — they stay as-is. Only the wrapper and nested parameter blocks change.
- **D-12:** Changes are additive — no removal of existing classes, only additions to the relevant container elements.

### Claude's Discretion
- Exact lucide-react icon choices for PDF (e.g. `FileText` colored red vs. a distinct PDF icon), DOCX (e.g. `FileText` colored blue), and Markdown (e.g. `FileCode` colored purple) — use judgment to pick the most semantically appropriate icon from lucide-react
- Exact Collapsible animation keyframe (slideDown vs. fade) — use what's already in tailwind.config.js `animate-*` or add a minimal custom keyframe
- Whether to add `slideDown` keyframe to tailwind.config.js or use Radix CSS variable approach (`--radix-collapsible-content-height`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §"UI Redesign — Deep Midnight" — UI-01, UI-02, UI-03 definitions (the locked requirements for this phase)
- `.planning/ROADMAP.md` §"Phase 41" — Success criteria SC-1 through SC-5

### Source Components (all in `frontend/src/components/chat/`)
- `frontend/src/components/chat/ToolCallPanel.tsx` — component to upgrade (wrapper + params blocks)
- `frontend/src/components/chat/CitationCard.tsx` — component to upgrade (border + icon)
- `frontend/src/components/chat/CitationList.tsx` — component to upgrade (Collapsible animation)
- `frontend/src/components/chat/MessageInput.tsx` — component to upgrade (floating pill)
- `frontend/src/components/chat/ChatArea.tsx` — parent layout; MessageInput is rendered here in normal flex flow (no position change needed)

### Design System
- `frontend/src/index.css` — `.glass`, `.glass-strong`, `.ghost-border` utilities; CSS variable definitions
- `frontend/tailwind.config.js` — existing `animate-*` keyframes, if any
- `frontend/components.json` — shadcn config for `npx shadcn add collapsible`

### Pattern References
- `frontend/src/components/health/HealthPanel.tsx` — `bg-card/50 ghost-border shadow-sm` pattern on Card (reference for D-10)
- `frontend/src/components/chat/SuggestionPills.tsx` — `bg-card/60 backdrop-blur-sm` on pills (reference for glass depth)
- `frontend/src/components/chat/MessageInput.tsx:111` — existing `rounded-xl ghost-border bg-card/80 backdrop-blur-sm` inner container (upgrade target for D-05)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.glass` utility class: `bg-muted/0.5 backdrop-filter blur(12px)` — could be referenced but target classes (bg-card/80, bg-card/50) are more specific
- `ghost-border` class: `border: 1px solid hsl(var(--border) / 0.3)` — already on MessageInput inner container, keep it
- shadcn `card.tsx`, `button.tsx`, `tooltip.tsx` — all available; no new shadcn components needed except Collapsible

### Established Patterns
- Glass treatment: `bg-card/80 backdrop-blur-sm` (lighter) + `bg-card/50 backdrop-blur-md` (stronger nested) — matches exactly what SC-1 specifies
- Gradient strips: bg-gradient-to-b with from/to Tailwind color utilities — used in health stat bars
- Icon sizing in chat: `w-3 h-3` (small), `w-3.5 h-3.5` (medium) — CitationCard currently uses `w-3 h-3`

### Integration Points
- CitationCard is rendered by CitationList — the border change is isolated to CitationCard
- CitationList is rendered by MessageItem — swapping conditional render for Collapsible is isolated to CitationList
- ToolCallPanel is rendered by MessageItem — wrapper class additions isolated to ToolCallPanel root
- MessageInput is rendered by ChatArea — pill layout change is isolated to MessageInput outer wrapper

</code_context>

<specifics>
## Specific Ideas

- Left gradient accent strip: thin `w-0.5 self-stretch bg-gradient-to-b` div as first child of CitationCard flex container (replacing the left border on the outer div)
- MessageInput outer wrapper: change `px-6 py-4 bg-background/80 backdrop-blur-sm` → `px-4 pb-3 bg-transparent` so the pill has air around it; inner card div keeps its glass treatment
- Collapsible animation keyframe: check if `animate-slideDown` already exists in tailwind.config.js; if not, use `max-height` via Radix CSS variable (`--radix-collapsible-content-height`) for a clean height animation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 041-ui-redesign-tool-call-visualizer-citations*
*Context gathered: 2026-04-19*
