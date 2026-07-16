# Phase 156: Everyday UX Polish (STRETCH) - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

> **Autonomous run.** The operator invoked `/gsd:discuss-phase 156` with an explicit
> unattended-run directive ("continue autonomously … comprehensively select the best
> options … then plan then execute"). Gray areas below were **auto-selected and
> auto-decided** by the orchestrator (effectively `--auto` mode), grounded in the three
> operator-won sketches (076/077/078), the SEED-045 anchors, and a live codebase scout.
> No AskUserQuestion turns were used. Every decision is anchored to a won sketch or an
> existing code pattern so downstream agents can act without re-asking.

<domain>
## Phase Boundary

**Delivers:** the everyday chat-navigation polish defined by POLISH-01 (STRETCH) — the
two confirmed SEED-045 anchors, realized through the operator-won **Sketch 078-D**
information-architecture reframe:

1. **Nav stops competing with chat history.** The left nav becomes a **permanent thin
   icon rail** (icons + tooltips) whose growth never steals vertical space from the
   thread list. This structurally fixes the SEED-045 Anchor-1 bug ("collapsed nav hides
   New Chat") *and* the folded **BUG-260711-01** ("nav growth crowds out chat selection").
2. **The thread list gets a real home + search + grouping.** A **dedicated chat-history
   column** (shown on the chat view) owns the full height, with an inline "filter this
   list" search box and **date grouping** (Today / Yesterday / Last 7 days / Last 30 days
   / Older). Each row shows its folder as a chip.
3. **The whole backlog is one keystroke away.** A **⌘K / Ctrl-K global finder** searches
   across *all* threads (not just what's loaded in the column), grouped, keyboard-forward.

**Hard acceptance bar (ROADMAP SC, verbatim):**
1. With the nav collapsed, New Chat stays reachable.
2. The thread list supports search.
3. Threads are grouped by date and/or folder.

**Explicitly NOT in this phase (scope guard):** a full user/profile menu (SEED-113), a
standalone "Chats page" deep-history destination (Sketch 078-B — kept on the table for
later), pinning/favourites, folder CRUD, per-thread URL routing (SEED-015), backend
thread-search endpoints, or any change to the chat run/streaming surface. This is a
**frontend-only, pure-client** polish phase.
</domain>

<decisions>
## Implementation Decisions

### Layout & IA (Sketch 078-D — the operator-won synthesis)
- **D-01 — Split the single collapsible NavPanel into a permanent rail + a history
  column.** Today `NavPanel.tsx` is one `w-64`↔`w-16` column that masks its content on
  collapse (the bug). Replace with: (a) a **permanent ~58px icon rail** (logo → nav
  icons → footer-action icons), always present on every view; (b) a **new
  `ChatHistoryColumn` component (~300px)** rendered in `ChatLayout` **only when
  `activeView === "chat"`**, sitting between the rail and the chat grid. Compose both in
  `ChatLayout.tsx` (the existing composition root). *Rationale: operator won 078-D on
  2026-07-16; it decouples nav growth from history for good.*
- **D-07 — The rail is icons + tooltips only; the expand-to-labels state and the
  `nav_panel_collapsed` localStorage are removed.** Nav items render from the
  feature-filtered `navItems` prop (unchanged semantics — the VIS-01 vanish still
  applies). Footer actions (theme toggle, **operator shield when `isOperator`**, sign
  out) become rail-bottom icon buttons with tooltips. The operator shield stays
  **probe-gated and rendered OUTSIDE `navItems`** (the Phase-146/148 D-07 non-discoverable
  contract — a regression test locks that; do not regress it). *Confirmed safe:*
  `nav_panel_collapsed` / `isCollapsed` have **no readers outside NavPanel**.

### New Chat reachability (SC#1)
- **D-02 — New Chat is always reachable; the "collapsed nav" failure is eliminated by
  construction.** Primary placement: a **New Chat (+) action in the rail** (Sketch 076-B),
  reachable from *every* view in one click. The history-column header also carries a
  "New" affordance (078-D) as the in-context entry. Because the rail is permanent and the
  history column is always shown on chat, there is no state in which New Chat is hidden —
  SC#1 is satisfied and then some. *(076-B's "New Chat in the collapsed rail" was the
  answer to the old collapsible-panel framing; 078-D supersedes the framing but keeps the
  affordance.)*

### Search (SC#2) — two tiers, both pure-frontend
- **D-03 — Inline column filter + global ⌘K finder.** (a) The history column has a live
  **"Filter this list…"** input: substring match on `thread.title` over the loaded
  `threads`, match highlight, empty groups fold away, honest empty-state. This alone
  satisfies SC#2. (b) A **⌘K / Ctrl-K command palette** searches **all** threads (title
  match), results grouped by date, keyboard nav (↑↓ move / ↵ open / Esc close), opened by
  the shortcut **or** the ⌘K chip inside the filter box. Selecting a result opens that
  thread (`selectThread`) and navigates to chat. *Confirmed:* `GET /threads` has **no
  limit** (`list_threads` → `.select("*").order("updated_at")`), so **all** of a user's
  threads are already client-side — both tiers are pure-frontend, no backend work.

### Grouping (SC#3)
- **D-04 — Date grouping is the default; folder is a per-row chip.** Buckets computed
  from `updated_at`: **Today / Yesterday / Last 7 days / Last 30 days / Older** (empty
  buckets hidden, counts shown). Each row shows its folder as a chip (or "Unfiled"). This
  satisfies SC#3 ("date and/or folder"). A **Date⇄Folder segmented toggle** (Sketch 077-C
  `groupByFolder`) is an **optional** enhancement — include only if cheap; NOT required
  for acceptance. Locked default: **date**.

### ⌘K implementation
- **D-05 — Prefer the shadcn `Command` primitive (`cmdk`) for the palette; a plain
  controlled input for the inline filter.** *Rationale:* Phase 155 just closed A11Y-01 —
  `cmdk` gives focus-trap + roving-tabindex keyboard nav + ARIA for free, avoiding new
  a11y debt. It is a tiny frontend-only dependency (~$0 infra; aligns with
  `feedback_dont_hedge_to_no_new_infra`). **Research must confirm** it fits Deep Midnight
  tokens and isn't already transitively present; **fallback** = hand-roll the palette on
  the existing `ui/dialog.tsx` if a new dep is unwanted (then a11y is hand-owned). The
  inline column filter needs no dependency.

### Scope sequencing (STRETCH discipline)
- **D-06 — Ship the acceptance bar first, ⌘K second, mobile/polish last.** Suggested
  plan/wave order: **(W1)** permanent rail refactor + `ChatHistoryColumn` with New Chat +
  inline filter + date grouping → **satisfies all 3 SCs**; **(W2)** the ⌘K global palette;
  **(W3)** mobile parity (add title search to the mobile drawer list) + on-system polish.
  If budget runs short, the phase still ships its full acceptance bar after W1. ⌘K is
  **in scope** but is the designated cut-line.

### Behavior preservation (do-no-harm)
- **D-09 — Moving the thread list to the history column is a MOVE + wrap, not a rewrite.**
  Every existing row behavior in `NavPanel.renderThreadList()` MUST carry over intact:
  select, inline rename, delete-with-confirm dialog, the SEED-064 resting **running dot**
  + **Stop** button + cross-thread `ActiveRunsTray`, the per-thread options menu, the
  New-Chat **folder-scoping** picker, and the **Phase-155 A11Y-01 keyboard-reachability**
  (real `<button>` rows, CSS-gated action reveal on hover **and** `focus-within`, never
  render-gated). Search + date grouping wrap *around* this preserved logic.

### Mobile
- **D-08 — Keep the existing mobile drawer; add title search to its thread list.** The
  rail/history split is desktop-only (`hidden md:flex`). The mobile drawer in
  `ChatLayout.tsx` keeps its structure (flat list + bottom nav-icon row + New Chat);
  **add a search input** above its list (reuse the filter predicate) and, if cheap, the
  same date grouping. ⌘K is desktop-keyboard-first — no mobile ⌘K required; mobile reaches
  search via the drawer box.

### Folded Todos / Reported Bugs
- **D-10 — BUG-260711-01 folds into this phase.** "Chat list / chat area squeezed too
  narrow — nav panel growth crowds out chat selection" (major, open) is *exactly* what
  078-D fixes structurally (thin permanent rail + protected full-height history column).
  Frontmatter updated: `status: folded`, `folded_into: 156`. Its own suggested routing
  named "a dedicated nav/IA density pass inside v3.3, sketch before redesign" — Sketch 078
  is that sketch. **Plan-phase MUST verify** at least one task closes it; it flips to
  `closed` only when the shipped rail verifiably relieves the crowding.

### Claude's Discretion
- Exact rail width (~56–60px), history-column width (~300px), and whether the history
  header repeats New Chat vs. relying on the rail's — resolve against Sketch 078's
  `index.html` measurements during planning.
- Whether to include the optional Date⇄Folder toggle (D-04) and mobile date grouping
  (D-08) — include if they land cheaply without new state complexity; otherwise defer.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (operator-won sketches — the G-2 acceptance bar)
- `.planning/sketches/078-chat-history-home/README.md` + `index.html` — **THE WINNER
  (Synthesis D).** Permanent 58px icon rail + dedicated history column (search + date
  grouping) + ⌘K global finder. `index.html` carries the exact structure: `.rail`,
  `.history-col` (`.hc-top` → `.hc-title`+New, `.search`+⌘K chip, `.hc-list`), the
  `.cmdk` palette, and the `groupByDate`/`rowCompact`/`groupsHTML` mechanics. **Read
  first.**
- `.planning/sketches/076-collapsed-nav-rail/README.md` — winner **B** (New Chat + Search
  reachable in the rail). Superseded framing, affordance retained (D-02).
- `.planning/sketches/077-thread-list-organization/README.md` — no winner (reframed by
  078); its search + date/folder grouping mechanics are the *contents* of 078's column.
- `.planning/seeds/SEED-045-ui-ux-polish-pass.md` — the two confirmed anchors + exact
  breadcrumbs into `NavPanel.tsx` (line refs for the collapse gate + New Chat + flat list).
- Project skill **`sketch-findings-agentic-rag`** — Deep Midnight tokens, on-system feel,
  the three-homes IA contract. (Sketches 076/077/078 are NOT yet packaged into it — use
  the raw sketches above; consider a `/gsd:sketch --wrap-up` after the phase.)

### Reported bug (folded)
- `.planning/reported-bugs/chat-list-too-narrow-nav-panel-crowding.md` — **BUG-260711-01**,
  folded_into 156. The daily-driver crowding regression this phase closes.

### Key source files (scout results — see code_context)
- `frontend/src/components/layout/NavPanel.tsx` — becomes the permanent rail; its
  `renderThreadList()` (rows, rename, delete, SEED-064 dots/Stop, options menu) is the
  logic to MOVE into the new history column.
- `frontend/src/components/layout/ChatLayout.tsx` — the composition root; hosts the rail
  + history column + ⌘K overlay; contains the separate **mobile drawer** thread list.
- `frontend/src/hooks/useThreads.ts` — `threads`, `selectThread`, `newThread`,
  `deleteThread`, `renameThread`, `loadThreads`, `updateThreadTitle`.
- `frontend/src/hooks/useFolders.ts` — `folders` (for the folder chip + New-Chat scoping).
- `frontend/src/lib/nav-items.ts` — `NAV_ITEMS` / `NavItem` (the ~8 feature-filtered rail
  items — the crowding source; renders unchanged in the rail).
- `frontend/src/components/chat/ActiveRunsTray.tsx` — cross-thread runs tray (moves with
  the list).
- `frontend/src/types/index.ts` — `Thread { id, title, folder_id, updated_at, … }` (all
  fields needed for search + grouping are present).
- `frontend/src/components/ui/dialog.tsx` — base for the ⌘K palette (or `cmdk` fallback).
- `frontend/src/components/ui/tooltip.tsx` — already used for the collapsed rail; reuse for
  the permanent rail.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`NavPanel.renderThreadList()`** (NavPanel.tsx:125–283): the full row implementation —
  select/rename/delete, SEED-064 running dot + Stop, options menu, A11Y-01 CSS-gated
  reveal. **Lift-and-shift** into `ChatHistoryColumn`; wrap with search + date groups.
- **`useThreads()`**: already returns the complete thread CRUD + the loaded list. No new
  data plumbing — search/grouping/⌘K are pure client transforms over `threads`.
- **Tooltip** (`ui/tooltip.tsx`): the exact collapsed-rail idiom (`delayDuration={0}`,
  `side="right"`) is already in NavPanel — reuse verbatim for the permanent rail icons.
- **Mobile drawer** (ChatLayout.tsx:234–340): parallel flat `threads.map` list — the
  second place to add search (D-08).

### Established Patterns
- **Feature-filtered nav + probe-gated operator shield** (nav-items.ts + App
  `visibleNavItems` + `isOperator`): the rail MUST keep rendering `navItems` (not raw
  `NAV_ITEMS`) and keep the shield outside the array — a regression test enforces it.
- **Three-homes, no router** (ChatLayout `activeView` switch): the history column mounts
  as a conditional branch on `activeView === "chat"` — no routing; mirrors how the thread
  list is chat-only today.
- **⌘/Ctrl+. panel toggle** (ChatLayout.tsx:188–197): the exact `window` keydown +
  `metaKey||ctrlKey` + `preventDefault` idiom to copy for the **⌘K** global shortcut
  (register/cleanup in a `useEffect`).
- **A11Y-01 row a11y** (Phase 155): real `<button>` rows, actions revealed on
  `group-hover` **and** `group-focus-within`, never render-gated — preserve exactly.

### Integration Points
- `ChatLayout.tsx` root `<div className="flex h-screen">` — insert the history column
  between `<NavPanel/>` (now the rail) and the chat grid; the ⌘K overlay mounts at this
  level (or App) so it's reachable regardless of `activeView`.
- The chat grid (`gridTemplateColumns: "1fr <panel>"`) and all page-mount branches stay
  byte-identical — the history column is additive, only on the chat view.
</code_context>

<specifics>
## Specific Ideas

- "Two distinct jobs — *the column filters what you're looking at; ⌘K jumps anywhere.*"
  (Sketch 078-D). Keep that mental model crisp: the inline box filters the visible column;
  ⌘K is a global overlay over the entire backlog.
- Date bucket predicates and relative-date labels are already spelled out in Sketch 078's
  `groupByDate` / `relDate` — match them for consistency.
- On-system feel is the bar: Deep Midnight tokens, the same active/hover/`focus-visible`
  ring states, motion that reads as the real app (not a new thing). Run the lived-
  experience UI UAT — polish work is where felt-experience defects hide.
</specifics>

<deferred>
## Deferred Ideas

- **SEED-113 — user/profile menu + general settings** (`.planning/seeds/SEED-113-user-profile-menu-general-settings.md`):
  lives in the same rail-bottom real estate the redesign touches. The permanent rail sets
  it up cleanly, but building a profile menu is its own scope. **Defer** — re-open when a
  profile/account surface is scoped. (This phase keeps theme/sign-out/operator as discrete
  rail icons.)
- **Sketch 078-B — standalone "Chats page" deep-history destination:** the operator kept
  it "on the table for later if the rail column ever feels tight." Not built now.
- **Pinning / favourites, folder CRUD from the sidebar, per-thread URL routing (SEED-015):**
  named in SEED-045's umbrella but out of POLISH-01's SCs — future polish.
- **Optional Date⇄Folder toggle (077-C) + mobile date grouping:** in-scope-if-cheap (D-04
  / D-08); otherwise a fast-follow.

### Reviewed Bugs (not folded)
Other open `surface: Agentic-RAG` reports were reviewed and are **out of this phase's
domain** (they concern chat run/streaming/provider behavior, not nav/thread-list layout):
`setting-up-agent-hides-model-activity`, `general-chat-intermittent-silent-send-drop`,
`killed-workflow-empty-chat-card`, `BUG-260712-02` (duplicate user bubble),
`BUG-260707-03` (final answer folded), etc. Left open; not routed here.
</deferred>

---

*Phase: 156-everyday-ux-polish-stretch*
*Context gathered: 2026-07-16*
