# Phase 156: Everyday UX Polish (STRETCH) - Research

**Researched:** 2026-07-16
**Domain:** React frontend information-architecture refactor — permanent icon rail + dedicated chat-history column + ⌘K command palette (pure-client, over the already-loaded `threads` array)
**Confidence:** HIGH (codebase is fully readable; the winning sketch encodes exact mechanics; the one new dependency — `cmdk` — is verified against the npm registry and the correct ecosystem)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01** — Split the single collapsible `NavPanel` into (a) a **permanent ~58px icon rail** (logo → nav icons → footer-action icons), always present on every view; (b) a **new `ChatHistoryColumn` (~300px)** rendered in `ChatLayout` **only when `activeView === "chat"`**, between the rail and the chat grid. Compose both in `ChatLayout.tsx`.
- **D-02** — New Chat is always reachable by construction. Primary: a **New Chat (+) in the rail** (reachable from every view). History-column header also carries a "New" affordance. No state can hide New Chat → SC#1 satisfied.
- **D-03** — Search is two tiers, both pure-frontend: (a) inline **"Filter this list…"** input in the history column — substring match on `thread.title` over loaded `threads`, match highlight, empty groups fold, honest empty-state (satisfies SC#2 alone); (b) a **⌘K / Ctrl-K palette** over **all** threads (title match), date-grouped, keyboard-nav (↑↓ / ↵ / Esc), opened by shortcut or the ⌘K chip in the filter box; selecting → `selectThread` + navigate to chat. Confirmed: `GET /threads` has no limit → all threads client-side already.
- **D-04** — **Date grouping is the default**; folder is a per-row chip. Buckets from `updated_at`: **Today / Yesterday / Last 7 days / Last 30 days / Older** (empty buckets hidden, counts shown). Each row shows folder chip (or "Unfiled"). A Date⇄Folder segmented toggle is **optional (only if cheap)**; NOT required. Locked default: **date**.
- **D-05** — **Prefer the shadcn `Command` primitive (`cmdk`)** for the palette (focus-trap + roving-tabindex + ARIA for free — avoids new a11y debt right after A11Y-01). Inline filter = plain controlled input, no dependency. Research must confirm cmdk fits Deep Midnight and isn't already transitive; **fallback** = hand-roll on `ui/dialog.tsx`.
- **D-06** — Ship order: **(W1)** permanent rail + `ChatHistoryColumn` (New Chat + inline filter + date grouping) → satisfies all 3 SCs → **(W2)** ⌘K palette → **(W3)** mobile parity + polish. ⌘K is in scope but is the **cut-line**.
- **D-07** — Rail is icons + tooltips only; the expand-to-labels state and `nav_panel_collapsed` localStorage are **removed**. Nav renders from the feature-filtered `navItems` prop (VIS-01 vanish still applies). Footer actions (theme, **operator shield when `isOperator`**, sign out) become rail-bottom icon buttons with tooltips. Operator shield stays **probe-gated and OUTSIDE `navItems`** (a regression test locks it — do not regress). Confirmed: `nav_panel_collapsed` / `isCollapsed` have **no readers outside NavPanel**.
- **D-08** — Keep the existing mobile drawer; **add title search** above its list (reuse the filter predicate) and, if cheap, the same date grouping. ⌘K is desktop-keyboard-first — no mobile ⌘K.
- **D-09** — Moving the thread list is a **MOVE + wrap, not a rewrite**. Every existing `renderThreadList()` behavior carries over intact: select, inline rename, delete-with-confirm dialog, SEED-064 running dot + Stop + `ActiveRunsTray`, per-thread options menu, New-Chat folder-scoping picker, and the Phase-155 A11Y-01 keyboard-reachability (real `<button>` rows; CSS-gated reveal on hover AND focus-within; never render-gated). Search + grouping wrap around this preserved logic.
- **D-10** — **BUG-260711-01 folds into this phase** (`folded_into: 156`). Plan-phase MUST verify at least one task closes it; it flips to `closed` only when the shipped rail verifiably relieves the crowding.

### Claude's Discretion
- Exact rail width (~56–60px), history-column width (~300px), and whether the history header repeats New Chat vs. relying on the rail's — resolve against Sketch 078's `index.html` measurements during planning (sketch uses **rail 58px, history-col 306px**).
- Whether to include the optional Date⇄Folder toggle (D-04) and mobile date grouping (D-08) — include if they land cheaply without new state complexity; otherwise defer.

### Deferred Ideas (OUT OF SCOPE)
- **SEED-113** — user/profile menu + general settings (rail-bottom real estate; defer — keep theme/sign-out/operator as discrete rail icons).
- **Sketch 078-B** — standalone "Chats page" deep-history destination (on the table for later).
- **Pinning / favourites, folder CRUD from sidebar, per-thread URL routing (SEED-015)** — future polish.
- **Optional Date⇄Folder toggle (077-C) + mobile date grouping** — in-scope-if-cheap; otherwise fast-follow.
- Backend thread-search endpoints; any change to the chat run/streaming surface.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **POLISH-01** | "Collapsed nav keeps New Chat reachable, and the thread list gets search + date/folder grouping (the two confirmed SEED-045 anchors…)." Hard SCs (ROADMAP verbatim): **SC#1** with the nav collapsed, New Chat stays reachable; **SC#2** the thread list supports search; **SC#3** threads are grouped by date and/or folder. | **SC#1** → permanent rail's New Chat (+) + history-column "New" (D-02) make New Chat reachable on every view by construction (§ Architecture Pattern 1, 2). **SC#2** → inline substring filter + ⌘K palette, both pure-client over `threads` (§ Pattern 4, 5). **SC#3** → hand-rolled date bucketing from `updated_at` matching the sketch's `groupByDate` (§ Pattern 3, Code Examples). All three land in **W1** except ⌘K (W2). |
</phase_requirements>

## Summary

This is a **pure-frontend information-architecture refactor** with **zero backend/schema/migration work**. Every capability transforms the already-loaded `threads` array (`useThreads` → `listThreads()` → `GET /threads`, which has no server limit) client-side. The winning **Sketch 078-D** encodes the exact target structure (`.rail` 58px + `.history-col` 306px + `.cmdk` palette) and the exact mechanics (`groupByDate`, `relDate`, `rowCompact`, `groupsHTML`, live `filt` with highlight + empty-state) — the plan should port these idioms to React/Tailwind, mapping the sketch's raw CSS vars to the app's Deep Midnight semantic tokens (`bg-sidebar`, `text-muted-foreground`, `bg-primary/15`, `ghost-border`, `gradient-primary`, which the current `NavPanel.tsx` already uses).

The work decomposes into three moves: **(1)** repurpose `NavPanel.tsx` (561 lines, currently a `w-64`↔`w-16` collapsible column) into a thin permanent icon rail — removing the `isCollapsed`/`nav_panel_collapsed` machinery (verified sole readers: `NavPanel.tsx:77,83`) and lifting the whole `renderThreadList()` (`NavPanel.tsx:125–283`) out; **(2)** land that lifted row logic — intact, per D-09 — into a new `ChatHistoryColumn` component, wrapped with the inline filter + date grouping; **(3)** add a `cmdk`-based `ThreadCommandPalette` mounted once at the `ChatLayout` root with a `⌘K` window-keydown mirroring the existing `⌘.` listener (`ChatLayout.tsx:188–197`).

**Primary recommendation:** Adopt `cmdk@1.1.1` (verified: React-19 peer support, no install scripts, depends on the already-present `@radix-ui/react-dialog`) via a shadcn `ui/command.tsx` for the palette; hand-roll the date bucketing and the inline filter (no date lib present, ~20 lines, adding one is overkill). **Critical correctness note:** the `loadThreads()` bootstrap effect (`NavPanel.tsx:101–106`) must move **up to `ChatLayout`** (always-mounted), not into `ChatHistoryColumn` (chat-view-only) — otherwise the global ⌘K palette shows an empty list on non-chat views. **Critical security note:** the sketch's match-highlight uses `innerHTML` with the thread title — in React this must be JSX text nodes, never `dangerouslySetInnerHTML` (XSS vector on user-controlled titles).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Permanent icon rail (nav) | Browser / Client | — | Pure presentational nav over the `navItems` prop already computed in `App.tsx`; no data path changes. |
| Chat-history column (list + filter + grouping) | Browser / Client | — | Client transforms over the already-loaded, already-RLS-scoped `threads`; no new query, endpoint, or trust boundary. |
| ⌘K command palette (search all threads) | Browser / Client | — | Client substring match over the same `threads` array (`GET /threads` returns all rows — CONTEXT D-03); no backend search endpoint. |
| Date bucketing / folder chip | Browser / Client | — | Derived from `thread.updated_at` / `thread.folder_id` (present on the type) + the loaded `folders` array; pure computation. |

**No API / Backend / Database / CDN tier is involved.** This is the single most important tier fact: any plan task that reaches for a backend endpoint, migration, or query change is out of scope and contradicts D-03/D-09.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cmdk` | `1.1.1` | The ⌘K command-palette primitive (roving `↑↓`, `↵` select, focus-trap, ARIA `combobox`/`listbox`/`option`, filter shell) | `[VERIFIED: npm registry]` The canonical command-palette lib; the exact primitive shadcn/ui's `<Command>` wraps. React-19 peer-supported; depends on `@radix-ui/react-dialog` **already in the project**. Chosen by D-05 to avoid hand-owning a11y right after A11Y-01 closed. `[CITED: package.json peerDependencies]` |
| `react` | `19.2.4` (present) | — | `[VERIFIED: package.json]` cmdk peer range is `^18 \|\| ^19` — satisfied. |
| `@radix-ui/react-dialog` | `1.1.15` (present) | Overlay/focus-trap/Esc/portal base — cmdk's transitive dep **and** the hand-roll fallback base (`ui/dialog.tsx` already wraps it) | `[VERIFIED: package.json:21]` cmdk requires `^1.1.6`; installed `1.1.15` satisfies. Zero-risk either path. |

### Supporting (all already present — reuse, do not add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-tooltip` (via `ui/tooltip.tsx`) | `1.2.8` | Rail icon tooltips (`side="right"`, `delayDuration={0}`) | Verbatim reuse of the current collapsed-rail idiom (`NavPanel.tsx:353–357`). `TooltipProvider` already wraps everything at `App.tsx:167`. |
| `@radix-ui/react-alert-dialog` (via `ui/alert-dialog.tsx`) | `1.1.15` | Delete-confirm dialog | Moves verbatim with `renderThreadList()` (`NavPanel.tsx:434–459`). |
| `lucide-react` | `0.577.0` | Icons (`Plus`, `Search`, `MessageSquare`, `Folder`, `Moon/Sun`, `Shield`, `LogOut`, `Sparkles`, `MoreHorizontal`, `Square`, `Pencil`, `Trash2`) | All already imported in `NavPanel.tsx:15–20`; add `Search` for the filter box. |
| `cn` (`clsx` + `tailwind-merge`) | — | Conditional classes | Already the project idiom. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `cmdk` palette | Hand-roll on `ui/dialog.tsx` (Radix Dialog: focus-trap + Esc + portal for free; hand-own `↑↓` roving + `aria-activedescendant` + `role=listbox/option`) | Viable (the app already ships a combobox/listbox/`aria-activedescendant` pattern in `CreateLinkDialog` — see `RelationshipsSection.a11y.test.tsx:157–175`), but **more code and more a11y surface to test**. Fallback only if a new dep is truly unwanted. |
| Hand-rolled date bucket | `date-fns` / `dayjs` / `luxon` | **None is present** (verified — no matches in `package.json`). The bucketing is ~20 lines of `Date` math; adding a lib for it is overkill and contradicts "keep it pure-frontend, no infra." **Hand-roll.** |
| New `cmdk` dep at all | Reuse existing `ActiveRunsTray` popover idiom | The tray is a click-popover, not a keyboard-first modal finder; it lacks roving-tabindex and a filter input. Wrong tool for a global ⌘K. |

**Installation (only if D-05 primary path chosen):**
```bash
cd frontend && npm install cmdk@1.1.1
```
Frontend-only dependency, bundled by Vite — **no cloud/build/deploy risk** (no server, no migration, no env var). `npm run build` (`tsc -b && vite build`) picks it up with no config change.

**Version verification performed:**
```
npm view cmdk version         → 1.1.1
npm view cmdk peerDependencies → react ^18 || ^19 || ^19.0.0-rc  (project: 19.2.4 ✓)
npm view cmdk dependencies     → @radix-ui/react-dialog ^1.1.6 (installed 1.1.15 ✓),
                                 @radix-ui/react-id, @radix-ui/react-primitive,
                                 @radix-ui/react-compose-refs (all Radix, tiny)
npm view cmdk scripts          → { dev: 'tsup src --watch', build: 'tsup src' }  (NO install/postinstall/preinstall)
npm view cmdk dist.unpackedSize → 81,852 bytes (~82 KB)
npm view cmdk time.modified    → 2025-08-27 (stable, mature)
```

## Package Legitimacy Audit

> One candidate package this phase may install: `cmdk`. slopcheck could not be installed in this session (pip install was sandbox-denied); per protocol the package is therefore tagged `[ASSUMED]` and the planner must gate its install behind a `checkpoint:human-verify` task. Registry-level and provenance evidence below is strong (npm-verified, mature, well-known, no install scripts, deps already satisfied).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `cmdk` | npm | ~1 yr since last publish (1.1.1, 2025-08-27); package first published 2022 | Very high (shadcn/ui's `<Command>` primitive; multi-million weekly per public npm stats) `[ASSUMED]` | `github.com/pacocoursey/cmdk` `[CITED: npm view / well-known]` | not run (unavailable) → `[ASSUMED]` | **Approved with checkpoint** — planner inserts `checkpoint:human-verify` before `npm install cmdk@1.1.1` |

**Postinstall / supply-chain check (run):** `npm view cmdk scripts` → only `dev`/`build` (cmdk's own tsup tooling); **no `install`/`postinstall`/`preinstall` hook** → no install-time code execution risk. `[VERIFIED: npm registry]`

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

*Because slopcheck was unavailable, `cmdk` is tagged `[ASSUMED]` and the planner MUST gate its install behind a `checkpoint:human-verify` task. If the fallback (hand-roll on `ui/dialog.tsx`) is chosen, this section is moot — no new package installs and the audit is N/A.*

## Architecture Patterns

### System Architecture Diagram

```
                          App.tsx  (owns: activeView, navItems, isOperator, operatorIdentity)
                              │  props ▼ (all views mount ChatLayout)
                              ▼
    ┌──────────────────────────── ChatLayout.tsx  (composition root: flex h-screen) ─────────────────────────────┐
    │                                                                                                             │
    │  useThreads() → { threads, selectedThread, selectThread, newThread, deleteThread, renameThread, loadThreads}│
    │  useFolders() → { folders }        ⟵ ★ MOVE loadThreads() bootstrap effect HERE (was NavPanel:101-106)       │
    │  paletteOpen state + ⌘K window-keydown  (mirror ⌘. at :188-197)                                              │
    │                                                                                                             │
    │   ┌─────────┐   ┌──────────────────────────┐   ┌───────────────── activeView switch ─────────────────┐     │
    │   │  RAIL   │   │  ChatHistoryColumn (NEW)  │   │  activeView==="chat" → chat grid (1fr + panel)       │     │
    │   │ (NavPa- │   │  only when activeView===  │   │  else → IngestionPage / Settings / Workflows / …     │     │
    │   │  nel,   │──▶│  "chat"; hidden md:flex   │──▶│  (unchanged branches)                                │     │
    │   │ repur-  │   │                           │   └──────────────────────────────────────────────────────┘    │
    │   │ posed)  │   │  hc-top:                  │                                                                │
    │   │ 58px    │   │   • title "Chats" + New   │        ┌───────────────────────────────────────────┐          │
    │   │ hidden  │   │   • Filter input + ⌘K chip│        │  ThreadCommandPalette (NEW, cmdk)          │          │
    │   │ md:flex │   │  hc-list (flex-1 scroll): │        │  mounted once at ChatLayout root           │          │
    │   │         │   │   groupByDate(filter(     │        │  (reachable on EVERY view). Reads threads, │          │
    │   │ logo    │   │     threads)) → groups    │◀──⌘K──▶│  selectThread, onNavigate. NO StreamsProv. │          │
    │   │ navItems│   │   → preserved rows        │        │  onSelect → selectThread + navigate(chat)  │          │
    │   │ +New(+) │   │   (select/rename/delete/  │        └───────────────────────────────────────────┘          │
    │   │ theme   │   │    SEED-064 dot+Stop+Tray/│                                                                │
    │   │ shield  │   │    options / A11Y-01)     │     Mobile (md:hidden): existing drawer + NEW title-search box  │
    │   │ signout │   │                           │     above its flat threads.map (D-08). No ⌘K on mobile.        │
    │   └─────────┘   └──────────────────────────┘                                                                │
    └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Data source (unchanged): listThreads() → GET /threads → .select("*").order("updated_at")  [NO limit — all rows client-side]
```

### Recommended Project Structure
```
frontend/src/
├── components/layout/
│   ├── NavPanel.tsx                     # REPURPOSE → thin 58px permanent icon rail (logo/nav/footer). Keep filename (a test mocks "../NavPanel").
│   ├── ChatHistoryColumn.tsx            # NEW — lifted renderThreadList() + inline filter + date groups (chat-view only)
│   ├── ThreadCommandPalette.tsx         # NEW — cmdk palette; mounted once at ChatLayout root
│   ├── ChatLayout.tsx                   # EDIT — compose rail + column + palette; move loadThreads() effect up; add ⌘K listener; add mobile search
│   └── __tests__/
│       ├── ChatHistoryColumn.test.tsx       # NEW (Wave 0) — filter/highlight/empty + preserved row behaviors
│       ├── ChatHistoryColumn.a11y.test.tsx  # NEW (Wave 0) — vitest-axe
│       └── ThreadCommandPalette.test.tsx    # NEW (Wave 0) — open/filter/select/esc + a11y
├── lib/
│   ├── threadGroups.ts                  # NEW — bucketFor()/groupByDate()/filter predicate/highlight helper (pure, testable)
│   └── __tests__/threadGroups.test.ts   # NEW (Wave 0) — bucket boundaries + fold + within-bucket order
└── components/ui/
    └── command.tsx                      # NEW — shadcn Command wrapper over cmdk (or skip if hand-rolling)
```

### Pattern 1: Repurpose NavPanel into a permanent icon rail (D-01, D-07)
**What:** Strip the collapse machinery; render a fixed-width icon-only rail on every view.
**What moves OUT of NavPanel** (into `ChatHistoryColumn`): the entire thread region — `renderThreadList()` (`:125–283`), the "Chats" header + `ActiveRunsTray` + New Chat + folder picker (`:370–429`), the delete `AlertDialog` (`:434–459`), and the `loadThreads()` effect (`:101–106`, which moves UP to `ChatLayout`, not into the column — see Pitfall 1).
**What STAYS in the rail:** logo (`:313–325`, always visible now, no opacity gate), `navItems.map` icons (`:330–361`) each wrapped in the existing Tooltip idiom, and the footer (`:461–556`) — theme toggle, **probe-gated operator shield** (kept OUTSIDE `navItems`, D-07), sign out — as rail-bottom icon buttons with `side="right"` tooltips. **Add** a New Chat (+) icon button to the rail (D-02).
**What is DELETED:** `isCollapsed` state (`:76–86`), `handleToggle`, the toggle button (`:301–310`), the `nav_panel_collapsed` localStorage read/write (`:77,83`), and the `w-64/w-16` + opacity/`pointer-events-none` masking (`:287–297, 365–369`). Since **every** icon is now always shown with a tooltip, `navItems.map` no longer branches on `isCollapsed` — always render the Tooltip-wrapped form.

**Prop change (NavPanel shrinks):** drop `threads, selectedThread, onSelectThread, onDeleteThread, onRenameThread, loadThreads` (they move to `ChatHistoryColumn`). Keep `activeView, onNavigate, navItems, isOperator, onSignOut, theme, onToggleTheme`, plus `onNewThread` for the rail's + (handler = `() => { onNewThread(); onNavigate("chat") }` so New-Chat-from-Settings switches to chat).

```tsx
// Rail nav item — always tooltip-wrapped now (no isCollapsed branch). Source pattern: NavPanel.tsx:353-357
<Tooltip key={view} delayDuration={0}>
  <TooltipTrigger asChild>
    <button
      onClick={() => onNavigate(view)}
      aria-current={activeView === view ? "page" : undefined}
      className={cn(
        "flex items-center justify-center w-10 h-10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        activeView === view ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40",
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
    </button>
  </TooltipTrigger>
  <TooltipContent side="right" className="ml-2">{label}</TooltipContent>
</Tooltip>
```
**Rail container:** `hidden md:flex flex-col items-center h-full w-[58px] shrink-0 bg-sidebar border-r border-border/20 py-3` (keep `hidden md:flex` — mobile still uses the drawer).

### Pattern 2: ChatHistoryColumn — MOVE + wrap, not rewrite (D-09)
**What:** A new component that owns the thread list. The row JSX (`NavPanel.tsx:138–278`) moves **verbatim** — do not restyle the rows. Wrap it with: the header (`<h2>Chats</h2>` + New button), the filter input (+ ⌘K chip), and the date-group iteration.
**Preserve exactly (D-09 + Phase-155 A11Y-01):** real `<button>` rows; the Stop/options actions row **always rendered + CSS-gated** (`opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`, `NavPanel.tsx:220–225`) — never render-gated on mouse state; the SEED-064 running dot (`:201–212`) and `ActiveRunsTray` (`:379`); inline rename (`:143–154`); the delete-confirm `AlertDialog` (`:434–459`); the folder-scoped New-Chat picker (`:392–426`).
**Container:** `hidden md:flex flex-col w-[300px] shrink-0 bg-sidebar border-r border-border/20`. Mount from `ChatLayout` **only** at `activeView === "chat"` (mirrors how the list is chat-only today via `NavPanel.tsx:370`).
**Dependencies it pulls (like NavPanel does today):** `useStreamingThreadIds` / `useStreamActions` (SEED-064) + `ActiveRunsTray` — so any test rendering `ChatLayout` at `activeView="chat"` must wrap in `StreamsProvider` **or** stub the column (mirror the existing `vi.mock("../NavPanel", …)` approach at `ChatLayoutLaunch.test.tsx:90`).

### Pattern 3: Hand-rolled date bucketing (D-04) — pure, testable, no lib
**What:** Bucket threads by `updated_at` into Today / Yesterday / Last 7 days / Last 30 days / Older; hide empty buckets; show counts. Calendar-day-aware (more intuitive than the sketch's raw 24 h `d`-integer, but same labels/boundaries).
```ts
// lib/threadGroups.ts   — Source of labels/boundaries: sketch index.html:246 groupByDate
import type { Thread } from "@/types"
export type DateBucket = "Today" | "Yesterday" | "Last 7 days" | "Last 30 days" | "Older"
const ORDER: DateBucket[] = ["Today", "Yesterday", "Last 7 days", "Last 30 days", "Older"]

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }

export function bucketFor(updatedAtISO: string, now = new Date()): DateBucket {
  const days = Math.floor((startOfDay(now) - startOfDay(new Date(updatedAtISO))) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days <= 7) return "Last 7 days"
  if (days <= 30) return "Last 30 days"
  return "Older"
}

export function groupByDate(threads: Thread[], now = new Date()) {
  const map = new Map<DateBucket, Thread[]>()
  for (const t of threads) (map.get(bucketFor(t.updated_at, now)) ?? map.set(bucketFor(t.updated_at, now), []).get(bucketFor(t.updated_at, now))!).push(t)
  // sort within bucket by updated_at DESC (do NOT rely on API order — see Pitfall 3)
  return ORDER.filter(b => map.get(b)?.length).map(b => ({
    label: b,
    items: map.get(b)!.slice().sort((a, z) => z.updated_at.localeCompare(a.updated_at)),
  }))
}
```
**Folder chip per row:** `folders.find(f => f.id === t.folder_id)?.name ?? (t.folder_id ? "Folder" : "Unfiled")` — `folders` is already threaded into the column (from `useFolders`, `ChatLayout.tsx:90`).

### Pattern 4: Shared live filter + safe match-highlight (D-03)
**What:** One substring predicate shared by the inline column filter, the mobile search, and the ⌘K palette. Highlight matches with `<mark>` **as JSX text nodes** (never `dangerouslySetInnerHTML`).
```tsx
export const matchesTitle = (t: Thread, q: string) =>
  !q.trim() || t.title.toLowerCase().includes(q.trim().toLowerCase())

// Safe highlight — React auto-escapes each string segment (sketch uses innerHTML at index.html:386; DO NOT port that literally)
export function HighlightTitle({ title, query }: { title: string; query: string }) {
  const q = query.trim().toLowerCase()
  if (!q) return <>{title}</>
  const i = title.toLowerCase().indexOf(q)
  if (i < 0) return <>{title}</>
  return (<>
    {title.slice(0, i)}
    <mark className="bg-primary/25 text-foreground rounded-[3px] px-px">{title.slice(i, i + q.length)}</mark>
    {title.slice(i + q.length)}
  </>)
}
```
**Empty-group fold + honest empty-state:** filter groups to non-empty after applying `matchesTitle`; if the whole filtered set is empty render "No chats match your search." (sketch `.th-empty`, `index.html:265`).

### Pattern 5: ⌘K palette with cmdk (D-05 primary)
**What:** A single palette instance at the `ChatLayout` root, opened by `⌘K`/`Ctrl+K` from any view. Use `shouldFilter={false}` and feed it the **same** `matchesTitle` + `groupByDate` output (fidelity with the inline filter; the sketch reuses one `groupsHTML` for both — `index.html:336,366`). cmdk provides the `↑↓` roving, `↵` select, focus-trap, Esc (via Dialog), and `role=dialog/listbox/option` ARIA.
```tsx
// ThreadCommandPalette.tsx  (uses shadcn ui/command.tsx over cmdk)
<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput value={q} onValueChange={setQ} placeholder={`Search all ${threads.length} chats…`} />
  <CommandList>
    <CommandEmpty>No chats match your search.</CommandEmpty>
    {groupByDate(threads.filter(t => matchesTitle(t, q))).map(g => (
      <CommandGroup key={g.label} heading={`${g.label} · ${g.items.length}`}>
        {g.items.map(t => (
          <CommandItem key={t.id} value={t.id}
            onSelect={() => { selectThread(t); onNavigate("chat"); setOpen(false) }}>
            <span className="truncate">{t.title}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    ))}
  </CommandList>
</CommandDialog>
```
**⌘K listener (in ChatLayout, mirroring `⌘.` at `:188–197`):**
```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(v => !v) }
  }
  window.addEventListener("keydown", onKey)
  return () => window.removeEventListener("keydown", onKey)
}, [])
```
(`e.key.toLowerCase() === "k"` catches both `k` and shifted `K`, exactly as the sketch does at `index.html:412`. `preventDefault` also suppresses the browser's native Ctrl+K.) The palette must **not** import `useStreamingThreadIds` — it needs only `threads`, `selectThread`, `onNavigate`, keeping it out of `StreamsProvider` (so it renders cleanly at the `ChatLayout` root and in tests). Radix Dialog auto-restores focus to the last-focused element on close.

### Anti-Patterns to Avoid
- **Porting the sketch's `innerHTML` highlight** (`index.html:386`) with `dangerouslySetInnerHTML` — XSS on user titles. Use JSX text nodes (Pattern 4).
- **Putting `loadThreads()` inside `ChatHistoryColumn`** — the column only mounts on chat, so the global ⌘K would show an empty list elsewhere. It moves to `ChatLayout` (Pitfall 1).
- **Adding the operator shield to `navItems`/`NAV_ITEMS`** to render it in the rail — `nav-items.test.ts:17–25` fails the build. Keep it a separate, `isOperator`-gated rail element (as today, `NavPanel.tsx:531`).
- **Restyling the moved rows** — D-09 is MOVE + wrap. Changing row markup risks regressing the Phase-155 A11Y-01 focus-within reveal.
- **A JS breakpoint hook for mobile** — the split is pure CSS (`hidden md:flex` rail/column vs `md:hidden` drawer). No `useMediaQuery` needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ⌘K palette a11y (focus-trap, `↑↓` roving, `aria-activedescendant`, `role=listbox/option`, Esc) | A bespoke keyboard/focus state machine | `cmdk` (D-05) | A11Y-01 just closed; the app's own combobox a11y bar (`RelationshipsSection.a11y.test.tsx`) is non-trivial to re-hit by hand. `cmdk` gives it for free. |
| Modal overlay / focus-trap / Esc / portal | A hand-built modal | `ui/dialog.tsx` (Radix Dialog) — cmdk's base, or the hand-roll fallback base | Already in the tree; battle-tested. |
| Rail tooltips | Custom hover/positioning | `ui/tooltip.tsx` (`side="right"`, `delayDuration={0}`) | The exact collapsed-rail idiom already ships (`NavPanel.tsx:353`). |
| Delete confirmation | A window.confirm / custom dialog | `ui/alert-dialog.tsx` (moves verbatim) | Already the row's delete UX (`NavPanel.tsx:434`). |
| Thread CRUD / list state | New fetch/plumbing | `useThreads()` (unchanged) | All CRUD + the loaded list already exist (`useThreads.ts`); search/grouping/⌘K are pure client transforms. |

**Key insight:** The only genuinely new primitive is the ⌘K shell, and `cmdk` is its standard answer. Everything else is a **relocation** of shipped, tested UI — the risk is in *preserving* behavior (D-09), not building it.

## Runtime State Inventory

> This is a refactor/MOVE phase (repurpose NavPanel, remove the collapse state, relocate the thread list). Grep finds files; runtime state needs explicit accounting.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `localStorage["nav_panel_collapsed"]` — the collapse flag. Verified **sole readers/writers: `NavPanel.tsx:77,83`** (the other `isCollapsed` hits — `ModelRegistryTab.tsx`, `ToolCallPanel.tsx` — are unrelated local component state, not this key). Removed by D-07. | Code edit: delete the read/write. The **orphaned localStorage value is harmless** (nothing reads it once the code is gone) — optionally a one-line `localStorage.removeItem("nav_panel_collapsed")` on mount for hygiene; not required. No data migration. |
| **Live service config** | None — pure frontend. No n8n/Datadog/Tailscale/etc. | None. |
| **OS-registered state** | None. | None. |
| **Secrets / env vars** | None — no new env var; `cmdk` needs no config. The local↔cloud env-var switch is untouched. | None. |
| **Build artifacts / installed packages** | If `cmdk` is added: `frontend/package.json` + `frontend/package-lock.json` gain the dep and `node_modules/cmdk` is installed (routine `npm install`). No stale artifact — `vite build` bundles it. | Run `npm install` after the package.json edit; commit the lockfile. |

**Nothing found** in Live-service-config, OS-registered, and Secrets categories — verified: this phase touches only frontend React/TS source + (optionally) one npm dependency.

## Common Pitfalls

### Pitfall 1: `loadThreads()` stranded in a chat-only component → empty ⌘K elsewhere
**What goes wrong:** The bootstrap `useEffect(() => { loadThreads()… }, [loadThreads])` currently lives in `NavPanel.tsx:101–106`. If it moves into `ChatHistoryColumn` (which mounts only at `activeView==="chat"`), then opening ⌘K on Documents/Settings/Workflows shows an empty list until you first visit chat.
**Why it happens:** The palette is global (all views); the column is chat-only. They can't share a mount lifecycle.
**How to avoid:** Move the `loadThreads()` effect **up to `ChatLayout`** (always mounted, already has `loadThreads` from `useThreads`). Keep the same retry-once-after-2s guard (`:102–105`).
**Warning signs:** ⌘K empty on a non-chat view on first load; threads only appear after visiting chat.

### Pitfall 2: XSS via the match-highlight
**What goes wrong:** Porting the sketch's `title.innerHTML = orig.replace(rx, '<mark>$1</mark>')` (`index.html:386`) with `dangerouslySetInnerHTML` renders a malicious thread title as HTML.
**Why it happens:** Thread titles are user-controlled (auto-generated from prompts / user-renamed); the sketch is vanilla JS with no escaping.
**How to avoid:** JSX text nodes (Pattern 4 `HighlightTitle`) — React escapes each segment.
**Warning signs:** any `dangerouslySetInnerHTML` in the diff; a title containing `<img onerror=…>` rendering as an element.

### Pitfall 3: Assuming the API returns threads newest-first
**What goes wrong:** `list_threads` is quoted as `.select("*").order("updated_at")` (CONTEXT D-03) — **direction not confirmed** `[ASSUMED]`. If rows arrive oldest-first, buckets render in the wrong within-group order.
**How to avoid:** Sort within each bucket by `updated_at` DESC client-side (Pattern 3) — defensive, cheap, order-independent.
**Warning signs:** "Today" showing the oldest chat at the top.

### Pitfall 4: Breaking the D-07 operator-shield contract
**What goes wrong:** Rendering the shield by adding a Control-Room entry to `navItems`/`NAV_ITEMS` to fit the new rail loop → leaks the surface to every user; **`nav-items.test.ts` fails the build** (`:17–25`).
**How to avoid:** Keep the shield a **separate `isOperator`-gated rail element**, rendered outside the `navItems.map` (exactly as `NavPanel.tsx:531`). Also preserve the mobile-drawer shield (`ChatLayout.tsx:323`).
**Warning signs:** a Control-Room icon visible to a non-operator; `nav-items.test.ts` red.

### Pitfall 5: A `ChatLayout` test rendering the real column without `StreamsProvider`
**What goes wrong:** `ChatHistoryColumn` pulls `useStreamingThreadIds`/`useStreamActions` (SEED-064). A new test that renders `ChatLayout` at `activeView="chat"` without `StreamsProvider` throws.
**How to avoid:** Wrap in `StreamsProvider` **or** stub the column, mirroring the shipped `vi.mock("../NavPanel", …)` / `vi.mock("@/components/panel/WorkspacePanel", …)` at `ChatLayoutLaunch.test.tsx:90–91`. (That existing test renders at `activeView="workflows"` with `threads: []`, NavPanel stubbed — it stays green: the column doesn't mount and a closed palette renders nothing. Re-run to confirm.)
**Warning signs:** "useStream… must be used within StreamsProvider" in a layout test.

### Pitfall 6: Renaming `NavPanel.tsx` breaks a test mock
**What goes wrong:** `ChatLayoutLaunch.test.tsx:90` does `vi.mock("../NavPanel", …)`. Renaming the file to e.g. `RailNav.tsx` silently breaks the mock (the real, StreamsProvider-dependent component then renders).
**How to avoid:** **Keep the filename `NavPanel.tsx`** (repurposed as the rail) — least churn. If you must rename, update the mock path in the same commit.

### Pitfall 7: Permanent-rail horizontal-overflow / min-width at the md breakpoint
**What goes wrong:** Rail (58px) + history (300px) + chat grid could crowd the chat `main` on a narrow md viewport (~768px), especially with the workspace panel open (`clamp(300px,30%,420px)`).
**Why it happens:** Three side-by-side columns instead of two.
**How to avoid:** The root is `flex h-screen`; make rail and column `shrink-0` fixed widths and keep the chat grid `flex-1 min-w-0` (it already is — `ChatLayout.tsx:352`). `min-w-0` + `overflow-hidden` prevents overflow; the chat `main` (1fr) simply gets narrower. Flag the 768–820px band as the tightest case; 300px history is fine at md+ (matches the sketch's 306px). No new overflow risk on non-chat views (column absent → rail + main only).
**Warning signs:** a horizontal scrollbar on the app frame; the chat composer clipping at ~800px.

## Code Examples

### Existing pattern to mirror — the `⌘.` window keydown (copy for `⌘K`)
```tsx
// Source: frontend/src/components/layout/ChatLayout.tsx:188-197 (VERIFIED, in-repo)
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ".") { e.preventDefault(); togglePanel() }
  }
  window.addEventListener("keydown", onKey)
  return () => window.removeEventListener("keydown", onKey)
}, [togglePanel])
```

### Existing pattern to preserve — the A11Y-01 CSS-gated action reveal (moves verbatim)
```tsx
// Source: frontend/src/components/layout/NavPanel.tsx:220-225 (VERIFIED, in-repo)
// ALWAYS rendered; opacity-gated; revealed on hover OR keyboard focus-within OR menu-open.
<div className={cn(
  "absolute inset-y-0 right-0 flex items-center gap-1 pl-10 pr-1.5 bg-gradient-to-l from-sidebar via-sidebar to-transparent rounded-r-lg",
  "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
  isMenuOpen && "opacity-100",
)}>
  {/* Stop (if running) + options menu button — real <button>s, keyboard-reachable */}
</div>
```

### Existing a11y test idiom to reuse (Wave 0)
```tsx
// Source: frontend/src/components/relationships/RelationshipsSection.a11y.test.tsx:16,101-106 (VERIFIED)
import { axe } from "vitest-axe"
it("no aXe AA violations — populated", async () => {
  const { container } = render(<ChatHistoryColumn {...props} />)
  await screen.findByText("Q3 revenue variance analysis")
  expect(await axe(container)).toHaveNoViolations()
})
```
(`vitest-axe` matcher is globally wired via `setupTests.ts:6-8`; `expect.extend(axeMatchers)`.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `w-64`↔`w-16` collapsible NavPanel that masks its content (incl. New Chat + list) on collapse | Permanent 58px icon rail + dedicated history column; nav growth decoupled from history | This phase (Sketch 078-D, won 2026-07-16) | Fixes SEED-045 Anchor-1 + BUG-260711-01 structurally. |
| Flat endless `threads.map` scroll, no search/grouping | Inline substring filter + date buckets + global ⌘K finder | This phase | SC#2 + SC#3; tames the 280+-thread backlog. |
| Hand-owned dialog a11y (pre-A11Y-01) | Radix Dialog + (for the palette) `cmdk` roving/ARIA | Ongoing; A11Y-01 closed 2026-07-16 | Keeps the a11y bar without re-hand-rolling it. |

**Deprecated/outdated in this phase:**
- `nav_panel_collapsed` localStorage flag + `isCollapsed` toggle UX — removed (D-07). Replaced by "always-visible icon rail."
- The sketch's vanilla-JS `innerHTML` filter/highlight — replaced by JSX-safe rendering.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `cmdk@1.1.1` is legitimate/safe to install (slopcheck unavailable this session; strong npm/provenance evidence + no install scripts) | Standard Stack / Package Legitimacy Audit | Low — well-known lib; planner gates install behind `checkpoint:human-verify` per protocol. |
| A2 | `GET /threads` / `list_threads` returns **all** rows (no limit) — quoted in CONTEXT D-03 but not re-read from backend this session | Summary / Pattern 5 | If a limit exists, ⌘K "search all" is incomplete. CONTEXT states it authoritatively; treat as locked but a 30-sec backend grep during planning removes all doubt. |
| A3 | `list_threads` `.order("updated_at")` direction (asc/desc) unconfirmed | Pitfall 3 | Low — mitigated by client-side within-bucket DESC sort (order-independent). |
| A4 | `cmdk` npm weekly-download magnitude ("multi-million") | Package Legitimacy Audit | None functionally — provenance/popularity note only. |

**All other claims are VERIFIED (in-repo reads / `npm view`) or CITED.** The Assumptions Log is short by design — the codebase and the sketch are fully readable.

## Open Questions

1. **Include the optional Date⇄Folder segmented toggle (D-04) and mobile date grouping (D-08)?**
   - What we know: the sketch ships `groupByFolder` (`index.html:248`) and a `.seg` toggle in Variant B; the mechanics are ~15 more lines.
   - What's unclear: whether it clears the "cheap, no new state complexity" bar (Claude's Discretion).
   - Recommendation: land date grouping first (required); add the toggle in W3 only if the filter/group plumbing makes it a few lines. Defer otherwise (it's explicitly optional).

2. **History-column header: repeat New Chat, or rely on the rail's +?**
   - What we know: the sketch header carries a "New" button (`index.html:277`) AND the rail has one (Variant D). Both is redundant but harmless.
   - Recommendation: keep both (matches the winning sketch; the header New is the in-context entry, the rail + is the always-reachable one). Low cost.

3. **cmdk `shouldFilter`: use cmdk's built-in scoring or feed pre-filtered items?**
   - Recommendation: `shouldFilter={false}` + our own `matchesTitle`+`groupByDate` — guarantees the palette and the inline filter behave identically (the sketch reuses one grouping fn for both) and keeps date grouping under our control.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node / npm | Adding `cmdk`; `npm run build`/`test` | ✓ (project builds today) | — | — |
| `cmdk` (npm) | ⌘K palette (D-05 primary) | ✗ (not installed; not transitive — verified no match in `package-lock.json`) | `1.1.1` (registry) | **Hand-roll on `ui/dialog.tsx`** (Radix Dialog already present) — D-05 fallback |
| `@radix-ui/react-dialog` | cmdk base + hand-roll fallback base | ✓ | `1.1.15` | — |
| `vitest` + `@testing-library/react` + `vitest-axe` | Wave-0 tests | ✓ | `4.1.0` / `16.3.2` / `0.1.0` | — |
| Chrome MCP | Live lived-experience UAT (G-4) | ✓ (per project tooling; can hang → operator-clicks fallback) | — | Operator-driven browser walkthrough |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `cmdk` — if the new dep is unwanted, hand-roll the palette on the already-present Radix Dialog (D-05 fallback). Everything else needed is installed.

## Validation Architecture

> `workflow.nyquist_validation: true` (config.json) — this section is required and drives VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.0` + `@testing-library/react` `16.3.2` + `@testing-library/user-event` `14.6.1` + `vitest-axe` `0.1.0` (jsdom) |
| Config file | `frontend/vitest.config.ts` (jsdom, `setupFiles: ./src/setupTests.ts`, `@`→`./src` alias) |
| Quick run command | `cd frontend && npx vitest run src/lib/__tests__/threadGroups.test.ts` (or any single new file) |
| Full suite command | `cd frontend && npm run test` (`vitest run`) |
| Build check | `cd frontend && npm run build` (`tsc -b && vite build`) — catches type + a11y-lint regressions; note `npm run lint:a11y` runs `eslint.a11y.config.js` (Phase-155 CI gate) |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| SC#1 (New Chat reachable) | Rail renders a New-Chat button with an accessible name, on every `activeView` | unit/RTL | `npx vitest run src/components/layout/__tests__/*` (NavPanel-as-rail render + `getByRole("button",{name:/new chat/i})`) | ❌ Wave 0 |
| SC#2 (search — inline) | Typing in the filter narrows rows to title-substring matches, highlights the match, folds empty groups, shows honest empty-state | unit + RTL | `npx vitest run src/components/layout/__tests__/ChatHistoryColumn.test.tsx` | ❌ Wave 0 |
| SC#2 (search — ⌘K) | `⌘K` opens palette; typing filters; `onSelect` → `selectThread`+navigate; `Esc` closes | RTL (`user.keyboard("{Meta>}k{/Meta}")`) | `npx vitest run src/components/layout/__tests__/ThreadCommandPalette.test.tsx` | ❌ Wave 0 |
| SC#3 (date grouping) | `bucketFor`/`groupByDate` — Today/Yesterday/≤7/≤30/Older boundaries, empty-bucket fold, within-bucket DESC | unit | `npx vitest run src/lib/__tests__/threadGroups.test.ts` | ❌ Wave 0 |
| A11Y-01 (do-no-harm) | No axe AA violations across populated/empty/filtered; moved rows keep real `<button>` + focus-within reveal; palette exposes dialog/listbox roles | a11y (vitest-axe) | `npx vitest run src/components/layout/__tests__/ChatHistoryColumn.a11y.test.tsx` | ❌ Wave 0 |
| D-07 lock (regression) | `NAV_ITEMS` carries no control-room entry (shield stays outside) | unit (exists) | `npx vitest run src/lib/nav-items.test.ts` | ✅ (must stay green) |
| D-09 (behavior preserve) | Existing `ChatLayoutLaunch.test.tsx` still green after composition change | integration (exists) | `npx vitest run src/components/layout/__tests__/ChatLayoutLaunch.test.tsx` | ✅ (re-run) |

### Sampling Rate
- **Per task commit:** the single relevant new test file (`npx vitest run <file>`).
- **Per wave merge:** `npm run test` (full vitest) + `npm run build` (tsc + vite).
- **Phase gate:** full suite green **+ live Chrome-MCP lived-experience UAT** before `/gsd:verify-work`.

### Live Chrome-MCP lived-experience checks (G-4 — jsdom CANNOT cover these; Phase-155 lesson)
jsdom has no layout/contrast/scroll — the SC-defining "does the rail actually stop starving history" and the felt-experience defects are **only** verifiable live:
1. **SC#1 / BUG-260711-01:** with 20+ threads, the history column shows many rows at rest; visit Documents/Settings/Workflows and back — the rail never hides New Chat; adding a (hypothetical) 9th nav icon does not shrink the visible-row count.
2. **SC#2:** type in the filter → rows narrow live with highlight; press `⌘K` from a **non-chat** view → palette opens over the whole backlog, `↑↓` moves, `↵` opens the thread and lands on chat, `Esc` closes and restores focus.
3. **SC#3:** rows are grouped Today/Yesterday/Last 7/Last 30/Older with counts; empty buckets absent.
4. **Preserved behaviors (D-09):** select, inline rename (Enter/Esc), delete-confirm, SEED-064 running dot + Stop + ActiveRunsTray, options menu — all still work; keyboard-Tab reaches Stop/Rename/Delete on a focused row (A11Y-01).
5. **On-system feel:** Deep Midnight tokens, same active/hover/`focus-visible` ring; both themes; mobile drawer shows the new search box; no horizontal overflow at ~800px with the workspace panel open.

### Wave 0 Gaps
- [ ] `frontend/src/lib/threadGroups.ts` + `frontend/src/lib/__tests__/threadGroups.test.ts` — SC#3 bucketing + shared filter predicate.
- [ ] `frontend/src/components/layout/__tests__/ChatHistoryColumn.test.tsx` — SC#2 inline filter/highlight/empty + D-09 preserved row behaviors.
- [ ] `frontend/src/components/layout/__tests__/ChatHistoryColumn.a11y.test.tsx` — vitest-axe (A11Y-01 do-no-harm).
- [ ] `frontend/src/components/layout/__tests__/ThreadCommandPalette.test.tsx` — ⌘K open/filter/select/esc + a11y (dialog/listbox roles).
- [ ] Framework install: none — vitest/RTL/vitest-axe already present. `cmdk` install is a source dependency, not a test-framework gap.

## Security Domain

> `security_enforcement` absent in config → treated as enabled. This phase is pure-client UI over already-authenticated, already-RLS-scoped data — it introduces **no new endpoint, query, auth path, session, or trust boundary**. The audit is honestly narrow.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth change; the existing session/JWT path is untouched. |
| V3 Session Management | no | No session state added. |
| V4 Access Control | no | No new data read; `threads`/`folders` are already owner/RLS-scoped by the backend (the client is not a trust boundary — the D-03 "all threads client-side" set is already the caller's own). |
| V5 Input Validation / Output Encoding | **yes** | The search-match **highlight must render as JSX text nodes**, never `dangerouslySetInnerHTML` — the one real control (see below). Filter/⌘K inputs are client-only, no injection sink. |
| V6 Cryptography | no | None. |

### Known Threat Patterns for {React client, thread titles as user data}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via `<mark>` match-highlight on a user-controlled thread title | Tampering / (stored XSS) | Render highlighted segments as JSX text (`HighlightTitle`, Pattern 4); React auto-escapes. **Never** port the sketch's `innerHTML` (`index.html:386`). |
| Leaking another user's thread via the "search all" set | Information Disclosure | None needed — the client only ever holds the caller's own `threads` (backend RLS-scoped); the palette adds no new fetch. |

## Sources

### Primary (HIGH confidence)
- In-repo reads (VERIFIED): `frontend/src/components/layout/NavPanel.tsx` (rail source + `renderThreadList`), `ChatLayout.tsx` (composition root, `⌘.` listener :188-197, mobile drawer :234-340, chat grid :351-357), `hooks/useThreads.ts`, `lib/nav-items.ts` + `lib/nav-items.test.ts` (D-07 lock), `components/chat/ActiveRunsTray.tsx`, `components/ui/dialog.tsx` + `tooltip.tsx`, `types/index.ts` (`Thread`), `App.tsx` (activeView/isOperator/navItems ownership), `package.json`, `vitest.config.ts`, `setupTests.ts`, `RelationshipsSection.a11y.test.tsx`, `NavRow.test.tsx`, `ChatLayoutLaunch.test.tsx`.
- Design contract (VERIFIED): `.planning/sketches/078-chat-history-home/README.md` + `index.html` (Synthesis D — `.rail`/`.history-col`/`.cmdk`; `groupByDate`:246, `relDate`:245, `rowCompact`:251, `groupsHTML`:261, `filt`:380, global ⌘K keydown:411-418), sketches 076 + 077 READMEs.
- `npm view cmdk` (VERIFIED): version 1.1.1, peerDeps (React 18/19), deps (@radix-ui/react-dialog ^1.1.6), scripts (no postinstall), size ~82 KB, modified 2025-08-27.
- Phase inputs (VERIFIED): `156-CONTEXT.md` (D-01..D-10), `REQUIREMENTS.md` (POLISH-01), `config.json` (nyquist_validation true), `reported-bugs/chat-list-too-narrow-nav-panel-crowding.md` (BUG-260711-01), `seeds/SEED-045-ui-ux-polish-pass.md`.

### Secondary (MEDIUM confidence)
- `@radix-ui/react-dialog` present at `1.1.15` satisfying cmdk's `^1.1.6` — inferred from `package.json:21` + cmdk's declared dep range.

### Tertiary (LOW confidence)
- cmdk weekly-download magnitude (public reputation, not measured this session) — A4.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every current dep read from `package.json`; `cmdk` verified via `npm view` (version, React-19 peer, no install scripts, deps satisfied).
- Architecture: HIGH — the winning sketch encodes the exact structure/mechanics; the composition root, the `⌘.` idiom to mirror, and the A11Y-01 row pattern are all read in-repo with line refs.
- Pitfalls: HIGH — each is grounded in a specific in-repo line (loadThreads effect, nav-items test, StreamsProvider coupling, the sketch's innerHTML) or an explicit CONTEXT/ASSUMED gap.
- Package legitimacy: MEDIUM — slopcheck unavailable (sandbox-denied); npm/provenance evidence strong; planner gates install behind `checkpoint:human-verify`.

**Research date:** 2026-07-16
**Valid until:** ~2026-08-15 (30 days — stable stack; the only moving part is the `cmdk` version, which is mature).

## RESEARCH COMPLETE

**Phase:** 156 - Everyday UX Polish (STRETCH)
**Confidence:** HIGH

### Key Findings
- **Pure-frontend, MOVE-not-rewrite.** No backend/schema/migration. `NavPanel.tsx` (561 lines) becomes a thin 58px rail; its `renderThreadList()` (`:125–283`) lifts verbatim into a new `ChatHistoryColumn`; a `cmdk` `ThreadCommandPalette` mounts once at the `ChatLayout` root. All transforms run over the already-loaded `threads`.
- **`cmdk` is the right ⌘K primitive and is safe-but-new:** not installed / not transitive; `1.1.1` supports React 19, has **no install scripts**, and depends on the already-present `@radix-ui/react-dialog`. Frontend-only, ~82 KB, zero cloud/build risk. Tagged `[ASSUMED]` (slopcheck unavailable) → planner must add a `checkpoint:human-verify` before install. Hand-roll on `ui/dialog.tsx` is the sanctioned fallback.
- **No date lib present** → hand-roll the Today/Yesterday/7/30/Older bucketing (~20 lines matching the sketch's `groupByDate`); the match-highlight MUST be JSX text nodes, never `dangerouslySetInnerHTML` (XSS).
- **Two must-not-break locks + one must-move:** keep the operator shield OUTSIDE `NAV_ITEMS` (`nav-items.test.ts` fails the build otherwise); keep `NavPanel.tsx`'s filename (a test mocks `"../NavPanel"`); and **move the `loadThreads()` bootstrap up to `ChatLayout`** (not into the chat-only column) so global ⌘K isn't empty on other views.
- **Small test-regression surface:** no dedicated `NavPanel.test.tsx` exists; `ChatLayoutLaunch.test.tsx` stubs NavPanel and renders at `workflows` with `threads:[]` → stays green (re-run). The real validation work is **Wave-0 net-new tests** + a **live Chrome-MCP UAT** (jsdom can't prove "rail stops starving history").

### File Created
`C:\Vibe Apps\Agentic RAG\.planning\phases\156-everyday-ux-polish-stretch\156-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All deps read from package.json; cmdk verified via `npm view`. |
| Architecture | HIGH | Winning sketch + in-repo composition root with line refs. |
| Pitfalls | HIGH | Each grounded in a specific in-repo line or explicit CONTEXT gap. |
| Package legitimacy | MEDIUM | slopcheck unavailable; strong npm/provenance evidence; gated by checkpoint. |

### Open Questions
- Optional Date⇄Folder toggle + mobile date grouping — include only if cheap (D-04/D-08 discretion); recommend deferring to W3.
- `list_threads` no-limit + order direction — quoted authoritatively in CONTEXT (A2/A3); a 30-second backend grep at plan time removes the last doubt (client sort mitigates A3 regardless).

### Ready for Planning
Research complete. The planner can create PLAN.md files: W1 (rail refactor + ChatHistoryColumn + filter + date grouping → all 3 SCs), W2 (⌘K palette, cut-line), W3 (mobile parity + polish), with Wave-0 test scaffolding and a `checkpoint:human-verify` before any `cmdk` install.
