---
phase: 301
slug: the-waiting-on-you-notice
status: approved
reviewed_at: 2026-10-29
reviewed_by: gsd-ui-checker (6/6, 3 non-blocking FLAGs; self-approved under the autonomous mandate — operator sketch approval owed at G-4)
shadcn_initialized: true
preset: not applicable
created: 2026-10-29
---

# Phase 301 — UI Design Contract

> Visual and interaction contract for the in-app "Waiting on you" notice (NOTE-01, NOTE-05).
> Written by gsd-ui-researcher in autonomous mode. Nothing was asked of the operator; every open point
> is resolved below and listed under **Decisions made here (UI-D1..UI-D15)**. The binding visual source
> is sketch `301-waiting-on-you`, winner **A: its own rail control**, picked by Claude under the
> autonomous mandate. The operator still owes approval at G-4 (SC#4).

---

## Surfaces in this phase

| # | Surface | Sketch | Decisions |
|---|---------|--------|-----------|
| S1 | The "Waiting on you" rail control and its count, collapsed and expanded | 301 **A** | D-01, D-02, D-04 |
| S2 | The list: a popover with rows, empty state, loading, failed fetch with the last list kept, and "and N more" | 301 (fixed in every variant) | D-05..D-10, D-17 |
| S3 | Mobile: the hamburger dot and the drawer's "Waiting on you" row | 301 MOMENT "mobile" | D-03 |
| S4 | The Library mark stays the Library's (what must NOT change) | 301 truth strip | D-11, D-12 |

Not designed here, and reused unchanged: 299's `LinkGate` and `SwitchOrgPrompt`, which handle a row in
another org (S3 in `299-UI-SPEC.md`, including its copy), and the run page. `PendingAskCard.tsx`,
`StreamsProvider.tsx` and `WorkflowRunPage.tsx` are not touched.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn (already set up, `frontend/components.json`) | codebase |
| Preset | not applicable (style `default`, baseColor `slate`, CSS variables) | components.json |
| Component library | Radix via shadcn: `dropdown-menu` (`DropdownMenu`, `Trigger`, `Content`, `Label`, `Item`), `tooltip` | `src/components/ui/` |
| Icon library | lucide-react `^0.577.0`. New glyphs: **`Hourglass`** (the control; not used anywhere else in `src/`, distinct from Library's `FileText` and Workflows' `Workflow`), **`MessageCircleQuestion`** (kind "question", the same glyph `PanelRail.tsx` already uses for an ask), **`CircleCheck`** (kind "approval"). All three files exist in `node_modules/lucide-react/dist/esm/icons/` | codebase |
| Font | Inter (`font-sans`) for all new text. No mono, no Manrope | `index.css` |
| Theme | Aether Deep Midnight (`index.css .dark`) plus the light theme. Every colour comes from an existing CSS variable. No new token | `index.css`, `tailwind.config.js` |
| Shipped pieces reused | `RailItem` geometry and the Library badge class string (`NavPanel.tsx:117-118`, `:196-197`), `OrgAvatar` (`components/org/OrgIdentity.tsx`), `SyrelLoader size="section"`, the drawer-trigger dot (`ChatArea.tsx:923-929`), `useAppNavigation.openRun` | codebase |
| Packages | **None installed.** No `npx shadcn add`, no `@radix-ui/react-popover` | D-05 |

---

## Spacing Scale

All new markup uses 4 / 8 / 16 / 24 / 32 px.

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | Gap between the 16px org avatar and the org name in a row's second line (`gap-1`). Space between a row's title and its second line (`mt-1`). The popover's inner padding (shipped `p-1` on `DropdownMenuContent`) |
| sm | 8px | Gap between the kind square and the row's text (`gap-2`). Row padding (`px-2 py-2`). Padding of the empty, loading, failed, stale and "and N more" lines (`px-2 py-2`). The popover's distance from the rail (`sideOffset={8}`) |
| md | 16px | Drawer row horizontal padding (`px-4`). The gap from the drawer's screen edge to the list on mobile (`calc(100vw - 32px)` = 16px each side) |
| lg | 24px | The kind square (`w-6 h-6`, 24px) |
| xl | 32px | Not used |
| 2xl / 3xl | 48 / 64px | Not used |

**Exceptions (shipped markup reused verbatim, not re-spaced):**

| Value | Where | Why it stays |
|-------|-------|--------------|
| 40px control, 12px icon-to-label gap, 12px expanded padding (`h-10`, `w-10`, `gap-3 px-3`) | The S1 control | It copies `RailItem`'s geometry exactly so the control lines up with New chat and the nav items. A different size would break the rail's column |
| 18px count pill, 4px inner padding, corner offset (`min-w-[18px] h-[18px] px-1`, `-top-1 -right-1` collapsed, `right-3 top-1/2 -translate-y-1/2` expanded) | S1 count and S3 drawer count | The Library badge's class string (`NavPanel.tsx:196-197`), copied byte for byte so the two marks look like one family |
| 10px dot (`w-2.5 h-2.5`, `top-1.5 right-1.5`) | S3 hamburger dot | The shipped `attentionDot` element in `ChatArea.tsx`. Not edited, only its condition widens |
| 44px drawer row (`min-h-11`) | S3 | Touch target. 44 is on the 4px grid |

---

> Scale weights are **400 and 600 only**. 500 and 700 are NOT part of this scale; they appear solely inside shipped class strings copied verbatim (`RailItem` `font-medium`, the Library badge `font-bold`).

## Typography

Three sizes, two weights for new text. Two shipped weights are reused verbatim and listed.

| Role | Size | Weight | Line height | Used by |
|------|------|--------|-------------|---------|
| Micro | 10px (`text-[10px]`) | 700 (shipped badge `font-bold`); 600 for the avatar initial (shipped `font-semibold`) | 18px (shipped `leading-[18px]`) for the pill; 1 for the avatar initial | The count pill (S1, S3). The initial inside the 16px `OrgAvatar` |
| Label | 12px (`text-xs`) | 400 | 1.5 (`leading-normal`, 18px; overrides `text-xs`'s default 16px) | A row's second line (org · kind · waited). The "and N more", stale and failed lines |
| Body | 14px (`text-sm`) | 400; row title **600**; popover header **600** (shipped `DropdownMenuLabel font-semibold`); expanded rail label **500** (shipped `RailItem font-medium`, reused) | 1.5 (`leading-normal`); the title is one line, `truncate` | Row title, popover header "Waiting on you", empty state, loading line, the expanded rail label, the drawer row label |

No heading or display size: the surface is a menu, not a page. Weights for **new** text are 400 and 600
only. 500 and 700 appear only inside shipped classes that are copied, never in new class strings.

---

## Color

| Role | Token | Approx. hex (dark) | Usage |
|------|-------|-------------------|-------|
| Dominant (60%) | `--background` 216 45% 4% | #06090F | The page behind the shell (unchanged) |
| Secondary (30%) | `--sidebar` 220 40% 5% / `--popover` 220 30% 8% | #080B12 / #0E121B | The rail and drawer the control lives on. The popover surface (shipped `bg-popover`) |
| Accent (10%) | `--primary` 239 100% 82% | #A3A5FF | Reserved list below only |
| Needs-you (semantic) | `--warning` 38 92% 60% / `--warning-foreground` 240 60% 8% | #F5A524 / #0A0A21 | Amber list below only |
| Neutral hover | shadcn `--accent` 220 25% 14% | #1A2030 | The row hover and keyboard-focus wash (shipped `focus:bg-accent`), the control's hover (`hover:bg-accent/40`) and open state. This is shadcn's neutral `accent` token, not the brand accent |
| Muted text | `--muted-foreground` 220 16% 65% | #97A1B4 | A row's second line, the empty / loading / failed / stale / "and N more" lines, the idle control icon (≈7.7:1 on the popover, AA) |
| Destructive | `--destructive` | #DC2828 | **Not used.** Nothing in this phase deletes, dismisses or fails in a way the person caused |

**Accent (`--primary`) is reserved for exactly these:**
1. Focus rings on the control and the drawer row (`focus-visible:ring-2 focus-visible:ring-primary/30`, the rail's existing ring).
2. The `OrgAvatar` gradient (shipped `from-primary to-primary/60`, not re-decided).

Nothing else new is primary-coloured. The control is never `aria-current` and never wears the active
`bg-primary/15` highlight, because it is not a view.

**Amber (`--warning`) is reserved for exactly these, and means "needs you":**
1. The count pill on the rail control (`bg-warning text-warning-foreground`, ≥4.5:1 in both themes, `index.css:45-48`).
2. The count pill on the drawer row (same classes).
3. The drawer row's wash when the count is above 0 (`bg-warning/10`). The row's words stay `text-foreground`.
4. Each row's 24px kind square (`bg-warning/15 text-warning`, the shipped `ModelDiscoveryPanel` pairing). The square is decorative and `aria-hidden`; the kind words carry the meaning.
5. The hamburger dot (shipped, unchanged class).

**UI-D3: the control's icon is not tinted amber.** The sketch tints it amber when something waits. In the
light theme `--warning` text on the 95%-lightness sidebar measures under 3:1, so the icon keeps the
rail's ordinary tone (`text-muted-foreground`, `hover:text-sidebar-foreground`), and the amber number is
the only signal. This matches the Library item, whose icon is also not tinted.

Never red: a waiting run is not an error. Never the danger tone anywhere in this phase.

---

## Surface Contracts

### S1 — The rail control (D-01, D-02, D-04)

**Where.** `NavPanel.tsx`, directly **after the New chat `RailItem` and before `navItems.map`**, inside the
same `flex flex-col gap-1 mt-4` group. One mount. No separator is added (UI-D2). The control lives in a new
file (suggested `components/layout/WaitingOnYouControl.tsx`), and `NavPanel` gains only the mount and the
D-12 filter (G-5 honoured by construction).

**It is always present** on every view `ChatLayout` mounts, collapsed or expanded, for every signed-in
person. It is never hidden for a person with nothing waiting.

**Anatomy, collapsed (58px rail):**
```
┌──────────┐
│  ⧗   [2] │  40×40 button, Hourglass 20px centred, pill at the top-right corner (-top-1 -right-1)
└──────────┘  tooltip on the right: "2 workflow runs are waiting on you"
```
**Anatomy, expanded (210px rail):**
```
┌───────────────────────────────┐
│ ⧗  Waiting on you         [2] │  full-width 40px row, label 14/500, pill centred on the right
└───────────────────────────────┘  (right-3 top-1/2 -translate-y-1/2), no tooltip
```

**The button.** One `<button type="button">` that is the `DropdownMenuTrigger` (`asChild`). Collapsed, it
is also the `TooltipTrigger`, using `ProfileMenu.tsx:104-111`'s nesting
(`Tooltip > TooltipTrigger asChild > DropdownMenuTrigger asChild > button`). Classes copy `RailItem`:
`relative flex items-center h-10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30`,
plus `w-10 justify-center` collapsed or `w-full justify-start gap-3 px-3` expanded, plus the tone
`text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 data-[state=open]:bg-accent/40 data-[state=open]:text-sidebar-foreground`.
Clicking it opens the list. It never navigates.

**Its name.** `aria-label` is the sentence from the vocabulary leaf (see Copy). The visible expanded label
"Waiting on you" is a substring of every form of the sentence (case aside), so label-in-name holds. The
tooltip text equals the `aria-label`. No `title` attribute (the tooltip already says it).

**The count pill.** `aria-hidden="true"`, `data-testid="rail-waiting-badge"`, the Library badge class
string verbatim. It renders **only when the server's total is above 0**. At 0, and before the first
answer, there is no pill and no reserved space. The number is the server's total of open notices, not
the number of rows shown (UI-D6). Above 99 it reads **"99+"**. The `aria-label` always carries the exact
total.

**States.**

| State | Pill | `aria-label` | Opening shows |
|-------|------|--------------|---------------|
| Before the first answer | none | "Waiting on you" | the loading line |
| First fetch failed, never answered | none | "Waiting on you" | the failed line |
| Answered, total 0 | none | "Waiting on you" | the empty state |
| Answered, total N | N (or 99+) | the N sentence | the rows |
| Answered before, latest fetch failed | the last known N | the last known N sentence | the last rows, plus the stale line |

The count never shows 0 and never flashes empty on a failed fetch (D-17).

### S2 — The list (D-05..D-10, D-17)

**Primitive.** The shipped `DropdownMenuContent`, a sibling component of `AttentionPopover` (suggested
`components/layout/WaitingOnYouList.tsx`), not a branch inside it. Desktop: `side="right" align="start"
sideOffset={8}`, `className="w-80 max-h-[min(480px,var(--radix-dropdown-menu-content-available-height))]"`,
`data-testid="waiting-popover"`. The shipped content already scrolls (`overflow-y-auto`).

**Header.** `DropdownMenuLabel` with **"Waiting on you"** (shipped `px-2 py-1.5 text-sm font-semibold`).
No count in the header (the pill already shows it). No separator under it.

**Rows: order and shape.**
- One flat list, **waited longest first** (`created_at` ascending). Not grouped by org (D-07).
- Every row names its org, including rows in the active org (D-06). One shape, no conditional label.
- No question text, no document content, no run status word.

**Row anatomy (binding, from the sketch):**
```
┌──────────────────────────────────────────────────────┐
│ [?]  Compliance Gap Report                           │  title 14/600 text-foreground, one line, truncate
│      (A) Acme Legal · needs your approval · waiting 14 min │  12/400 text-muted-foreground, wraps
└──────────────────────────────────────────────────────┘
 [?] = 24px kind square: bg-warning/15 text-warning rounded-md, glyph 14px
       (MessageCircleQuestion for a question, CircleCheck for an approval), aria-hidden
 (A) = OrgAvatar size="xs": 16px circle, initial 10/600, aria-hidden
```

**Row element (UI-D1).** Each row is one **`DropdownMenuItem`**, `data-testid="waiting-row"`,
`className="items-start gap-2 py-2"` (merges over the shipped `px-2 py-1.5`). The title and second line
sit in a `min-w-0 flex-1` column. The " · " separators are `aria-hidden` spans, so a screen reader hears
"Compliance Gap Report, Acme Legal, needs your approval, waiting 14 min" without "dot".

Why a menu item rather than a plain `<button>`: Radix Menu cancels the Tab key inside menu content
(`node_modules/@radix-ui/react-menu/dist/index.mjs:305`, `if (event.key === "Tab") event.preventDefault()`),
so a plain button inside the list cannot be reached from the keyboard. A `DropdownMenuItem` is reachable
with arrow keys, Home/End and typeahead, and activates on Enter or Space. Each row is one focus stop,
the whole row is the target, and it is a button in role (`menuitem`). This meets D-08's "keyboard and
touch reachable, one stop per row".

**Selecting a row (D-08).** `onSelect` closes the list (Radix default) and calls `openRun(run_id)`, which
pushes `/app/runs/<id>`. **It never calls `switchOrg`.** For a run in another org, 299's `LinkGate`
shows `SwitchOrgPrompt` ("This is in {Org}", Stay / Switch, 299 copy unchanged). Stay leaves the active
org as it was. On mobile, selecting also closes the drawer.

**No other control in the list (D-09).** No mark-read, no dismiss, no snooze, no "clear all", no "view
all" link, no settings gear. Tests assert these absences by name.

**Waited time.** Recomputed from `created_at` on a once-a-minute tick, so "waiting 3 min" becomes
"waiting 4 min" while the list is open, without a refetch.

**Live changes while open (UI-D12).** A refetch replaces the rows in place. The list stays open, and it
does not close on its own when the last row leaves: the empty state appears in its place. There is no
exit animation (UI-D9). If the row with keyboard focus leaves, focus falls back to the menu content
(Radix default) and arrow keys continue from the top.

**"and N more" (D-10).** When the server's total is greater than the rows it returned (at most 50), one
plain line follows the last row: `px-2 py-2 text-xs text-muted-foreground`, `data-testid="waiting-more"`,
not focusable, not a control. N = total − rows shown.

**States inside the list (one shows at a time, under the header):**

| State | What shows | Element |
|-------|-----------|---------|
| Before the first answer | `SyrelLoader size="section"` with the loading words | `px-2 py-2 text-sm text-muted-foreground`, `role="status"` from the loader |
| First fetch failed, never answered | the failed line | `px-2 py-2 text-sm text-muted-foreground` |
| Answered, nothing waiting | the empty line | `px-2 py-2 text-sm text-muted-foreground`, `data-testid="waiting-empty"` |
| Answered, N waiting | the rows (then "and N more" if needed) | as above |
| Answered before, latest fetch failed | the last rows, then the stale line after them (after "and N more" if present) | `px-2 py-2 text-xs text-muted-foreground`, `data-testid="waiting-stale"` |

No amber and no red on the failed or stale lines. A fetch that cannot run is not something the person did.

### S3 — Mobile (D-03)

**The hamburger dot.** The shipped `attentionDot` in `ChatArea.tsx` (both drawer-trigger sites, unchanged
markup) lights when **any** shell condition exists, of either mark (library or waiting). Today it is gated
on `showAttention`, which needs the Library door. The condition that feeds it widens to "any condition";
the element does not change. It carries no number.

**The drawer row.** In `ChatLayout.tsx`'s mobile drawer, directly **after the New Chat button block
(and its folder select) and before the "Search chats" box**, inside the same `px-1 mb-2` stack:
```
┌──────────────────────────────────────┐
│ ⧗  Waiting on you                [3] │  min-h-11, px-4, rounded-lg, label 14/400 text-foreground
└──────────────────────────────────────┘  N > 0: bg-warning/10 wash and the pill; N = 0: no wash, no pill
```
- One `<button type="button">`, `data-testid="drawer-waiting-row"`, `w-full flex items-center gap-2`,
  the Hourglass 16px (`h-4 w-4`, `text-muted-foreground`), the label, and the pill pushed right with
  `ml-auto`. The pill here is **inline** (not absolute): `min-w-[18px] h-[18px] px-1 rounded-full bg-warning text-warning-foreground text-[10px] font-bold leading-[18px] text-center`, `aria-hidden`.
- Its `aria-label` is the same sentence as S1.
- It is always present, like the rail control. At 0 it opens the empty state.
- It is the `DropdownMenuTrigger` of the **same list component** as S2, opened `side="bottom" align="start"
  sideOffset={4}` with width `w-[min(320px,calc(100vw-32px))]`. The rows, states and copy are identical.
  Selecting a row closes the list and the drawer, then calls `openRun` (UI-D10).
- Focus ring: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30`.

The drawer's bottom icon row is not changed. Its Library badge counts only Library conditions (S4).

### S4 — The Library mark stays the Library's (D-11, D-12)

What must look exactly as it does today when a waiting notice exists:
- The Library rail badge and its popover count only `library` conditions. A waiting notice never adds to
  the Library number, never appears as a row in the Library popover, and never changes the Library
  popover's one footer action.
- The drawer's Library icon badge counts only `library` conditions.
- The Library page tab strip (`attentionCountByTab`) is unchanged, because waiting conditions carry no `tab`.
- With a stopped source and two waiting runs at once: Library badge **1**, waiting pill **2**, hamburger dot
  lit. Two marks, never one merged number (sketch truth strip).

---

## Copywriting Contract

Every string lives in one new vocabulary leaf (suggested `components/layout/waitingVocabulary.ts`, a
zero-import leaf). Components write no copy. Org and workflow names are rendered as React text only.
No raw value from the wire (`question`, `approval`, `closed_at`, an ISO time, a UUID) reaches the screen.

| Element | Copy (verbatim) |
|---------|-----------------|
| Control label (expanded rail, drawer row) | **Waiting on you** |
| Control accessible name and tooltip, total 0 or unknown | **Waiting on you** |
| … total 1 | **1 workflow run is waiting on you** |
| … total N | **{N} workflow runs are waiting on you** |
| Pill text | `{N}`; above 99, **99+** |
| List header | **Waiting on you** |
| Row title | the workflow's name, verbatim. Blank or missing: **Untitled workflow** |
| Row org | the org's name, verbatim. Blank or missing: **Unnamed org**. Avatar initial = first character of the name, upper-cased, or **?** (the `SwitchOrgPrompt.tsx:70` rule) |
| Kind, `question` | **needs your answer** |
| Kind, `approval` | **needs your approval** |
| Kind, any other value (defensive; the DB allows only the two above) | **needs you** |
| Waited, under 1 minute (or a future `created_at`) | **waiting under a minute** |
| Waited, 1 to 59 minutes | **waiting {m} min** |
| Waited, 1 to 23 hours | **waiting {h} hr** |
| Waited, 1 day | **waiting 1 day** |
| Waited, 2 days or more | **waiting {d} days** |
| More than shown | **and {N} more** |
| Empty state (single line, from the sketch) | **Nothing is waiting on you.** |
| Loading (before the first answer) | **Checking what's waiting on you…** |
| Failed, never answered | **Couldn't check right now. Trying again shortly.** |
| Stale (last list kept after a failed refresh) | **Couldn't refresh just now. This is the last list we got.** |

| Template element | This phase |
|------------------|-----------|
| Primary CTA | None. Each row is its own action, named by its content ("Compliance Gap Report, Acme Legal, needs your approval, waiting 14 min") and opening the run |
| Empty state heading | **Nothing is waiting on you.** |
| Empty state body | None, by the sketch. There is nothing for the person to do, so no next step is offered (UI-D11) |
| Error state | **Couldn't check right now. Trying again shortly.** (never answered) / **Couldn't refresh just now. This is the last list we got.** (last list kept). The retry is automatic (focus, reconnect, 60 s poll), so no retry button |
| Destructive confirmation | None. No destructive action exists in this phase |

Separators in a row's second line are " · " (space, middle dot, space), `aria-hidden`.

---

## Interaction and accessibility

- **Keyboard.** Tab reaches the control in rail order (after New chat). Enter, Space or ArrowDown opens
  the list and focuses the first row (Radix). Arrow keys, Home and End move between rows. Enter or Space
  opens the run. Escape closes the list and returns focus to the control. Tab while open closes the list
  (Radix).
- **Pointer and touch.** The whole row is the target (at least 48px tall with two lines). The drawer row
  is at least 44px.
- **Screen readers.** The control's name carries the count sentence. The pill, the avatar, the kind
  square and the separators are `aria-hidden`. **No live region** announces count changes (UI-D8): the
  list refetches on focus, reconnect and every 60 s, and announcing each would be noise. A person who
  wants the count reads the control's name.
- **Reduced motion.** Nothing new animates. The popover's shipped fade and zoom are the only motion, and
  they are Radix's.
- **Security.** Names are React text, never `dangerouslySetInnerHTML`. The row carries no question text,
  so nothing private shows on a shared screen beyond a workflow name and an org name.

---

## Data the renderers need (for the planner)

The rows cannot be drawn from today's `AttentionCondition` fields alone, because `title` and `detail` are
pre-composed strings. The waiting producer has to hand the renderer, per row: `run_id`, workflow name,
org name, kind and `created_at`. The waited phrase must be computed at render time from `created_at` on
the minute tick, so it cannot be baked into `detail`. The renderer also needs the **server's total** for
the pill and for "and N more", which can be larger than the rows it returned, plus whether an answer has
ever arrived and whether the latest fetch failed (the S1/S2 state tables). How these values travel through
the registry (a typed optional field on the condition, or a separate value beside it) is the planner's
and RESEARCH's call. This contract only requires that the badge number be the total and that no state
be inferred from `conditions.length` alone.

---

## How we'd know this failed (visual)

- The control is missing on any view, or appears only when something waits.
- The pill shows **0**, shows while loading, or drops to nothing after a failed fetch that followed a real count.
- The pill counts only the active org's runs, or counts rows shown instead of the server total.
- A waiting run adds to the Library badge, appears in the Library popover, or marks a Library tab.
- A row lacks its org name for runs in the active org, shows the question text, or shows a raw word such
  as `question`, `approval` or an ISO date.
- A row is not reachable from the keyboard, or the Tab key is the only way the plan tests reaching it.
- Clicking a row in another org switches org without the prompt.
- The list has a dismiss, mark-read, snooze or clear control.
- "waiting 3 min" stays frozen while the list is open past the next minute.
- The list closes by itself when the last row leaves, or shows a red or amber error line.
- On mobile, the drawer has no "Waiting on you" row, or the hamburger dot stays dark while a run waits.
- A new colour, font size, weight or package appears.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none newly added. Reuses the installed `dropdown-menu` (`DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuLabel`, `DropdownMenuItem`) and `tooltip`, both already in `src/components/ui/` | not required |
| third-party | none | not applicable |

No `npx shadcn add` is run, no third-party registry is declared, and no npm package is installed.

---

## Pre-population sources

| Source | Decisions used |
|--------|----------------|
| 301-CONTEXT.md | D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-17, D-18, D-22, D-24 (18) |
| 301-RESEARCH.md | not read (being written in parallel; this contract does not depend on it) |
| Sketch 301 (winner A) | Rail placement, row anatomy (kind square, title, org mark + name, kind words, waited), waited-longest-first, flat list, whole-row target, no mark-read, the empty line, the mobile hamburger dot and drawer row, the separate Library badge |
| sketch-findings skill | 58px rail and its icon + tooltip rule (chat-history-and-nav D1/D4); amber = needs you (pending-question D2); org identity vocabulary (org-admin-and-identity); one glyph per home (icon convention) |
| 299-UI-SPEC.md | `OrgAvatar` as the org mark (UI-D8 there), `SwitchOrgPrompt` reused unchanged, the 4/8/16/24/32 rule with shipped-markup exceptions, 400/600 plus shipped-weight exception |
| components.json / codebase | shadcn default + lucide; `RailItem` geometry and the Library badge string (`NavPanel.tsx`); `ProfileMenu`'s Tooltip + DropdownMenu nesting; `AttentionPopover` side/offset; `ChatArea` drawer dot; drawer layout (`ChatLayout.tsx:686-800`); `OrgAvatar`; `SyrelLoader`; `--warning` contrast notes (`index.css:39-48`); the Radix Menu Tab rule |
| User input | 0 (autonomous mandate) |

**Decisions made here (UI-D1..UI-D15):**
- **UI-D1** Rows are `DropdownMenuItem`s, because Radix Menu cancels Tab inside its content (source line cited above). This is how D-08's "whole row is one button, keyboard reachable" is met.
- **UI-D2** The control sits directly under New chat. D-01 says "under New chat / Search", but the shipped rail has no Search item (that was sketch 076's proposal), so there is nothing else to sit under. No separator is added, which keeps `NavPanel` to one mount.
- **UI-D3** The control's icon is not tinted amber (light-theme contrast). Only the pill is amber.
- **UI-D4** `OrgAvatar` gains one additive optional prop, `size?: "default" | "xs"`. `"xs"` = `h-4 w-4 text-[10px]`. The default stays byte-identical at every current caller. The shipped 36px circle would be taller than the 12px line it sits in. `OrgIdentity.tsx` has one commit in its history, so it is not a hot file.
- **UI-D5** No "· scheduled" suffix on a row. The sketch drew one, but D-06's row fields and D-15's route fields carry no run origin. A scheduled or API-key run looks like any other waiting run, which is what NOTE-01 asks for.
- **UI-D6** The pill shows the server's total (it can exceed the 50 rows returned), capped at "99+" on screen. The accessible name always carries the exact number.
- **UI-D7** Loading, never-answered failure and stale-list lines are words only, muted, no amber or red, no retry button (the retry is automatic).
- **UI-D8** No live region for count changes.
- **UI-D9** No exit animation when a row leaves. The sketch's fade was a demonstration device, not a decision.
- **UI-D10** The drawer row opens the same list component (`side="bottom"`). Selecting a row also closes the drawer.
- **UI-D11** The empty state is the sketch's single line with no body and no next step.
- **UI-D12** The list stays open through live refetches and does not close itself at zero.
- **UI-D13** Defensive fallbacks: unknown kind → "needs you"; blank workflow → "Untitled workflow"; blank org → "Unnamed org" with initial "?".
- **UI-D14** Waited format: "under a minute" / "{m} min" / "{h} hr" / "1 day" / "{d} days". Computed from `created_at` on a minute tick. A future `created_at` (clock skew) reads "under a minute".
- **UI-D15** Popover width 320px (`w-80`; the sketch drew 330px, rounded to the grid), kind square 24px (sketch 22px), org mark 16px (sketch 14px), row padding 8px (sketch 9/10px), all moved onto the 4px grid.

**Observation for the orchestrator (not folded, outside this phase's scope):** by the same Radix rule,
`AttentionPopover`'s only control, the plain "Open Library health" `<button>` (`AttentionPopover.tsx:98-105`),
should be unreachable by keyboard inside the menu. This comes from reading the source and has not been
driven in a browser. It is worth a reported-bug check. 301 does not change that file's control.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
