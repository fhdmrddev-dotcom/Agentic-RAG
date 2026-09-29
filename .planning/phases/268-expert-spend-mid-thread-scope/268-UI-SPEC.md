---
phase: 268
slug: expert-spend-mid-thread-scope
status: approved
reviewed_at: 2026-09-28
shadcn_initialized: true
preset: "components.json — style default, baseColor slate, cssVariables, iconLibrary lucide (no preset string; theme = Aether Deep Midnight `.dark` + the light `:root` in src/index.css)"
created: 2026-09-28
acceptance_bar: ".planning/sketches/268-expert-spend-and-mid-thread-scope/index.html — Chat A (composer chip) · Under Restricted: Save & say · Spend A (Expert filter every card follows) — operator, 2026-09-28, D-268-01"
---

# Phase 268: UI Design Contract (Expert Spend & Mid-Thread Scope)

> This is the visual and interaction contract for **CHAT-08** (change a thread's folder scope mid-thread) and **METER-08**
> (spend by Expert on `/admin/spend`). The gsd-ui-researcher wrote it and gsd-ui-checker verifies it.
>
> **Acceptance bar:** sketch 268, with the winners **Chat A**, **Save & say** and **Spend A** (D-268-01). These are
> LOCKED: the `📁 <folder> ▾` composer chip beside the Expert chip, the dashed `· not searched` chip under Restricted,
> the picker ledger (`Next message searches` / `Stops searching`), the `Saved` / `Searching` lines,
> `Takes effect when <Expert> leaves.`, `From your next message.`, the Expert filter pills that every card follows, the
> filter statement line, the always-shown `Spend by Expert` table with `No Expert`, and the reconciliation footer.
> This contract makes them concrete and re-decides none of them. §9 lists every departure from the sketch's pixels,
> each with its reason.
>
> **Carried from 267 (reuse, not redesign):** the timestamped event-card shell (`ExpertEventCard.tsx` `Shell`), the
> `ScopeLedger` columns, the Now/Dropped value vocabulary (`expertEventCopy.ts`), the one-early-return mount in
> `MessageItem`, and the light-theme pairing rule enforced by `expertThemeContrast.test.tsx`.

**Scope rule:** there is **no new route, nav entry or top-level surface**. The chat side adds one chip to the shipped
composer chip row, one menu anchored to that chip, and one new *kind* rendered by the shipped event card. The spend side
adds one ribbon group, one line, one card and one table column to the shipped cockpit, plus two Blind Spots tiles.

---

## 1. Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (already initialised: `frontend/components.json`) |
| Preset | not applicable. The theme is the Aether Deep Midnight `.dark` block **and** the light `:root` block in `frontend/src/index.css`. Both ship, with a user toggle (`ProfileMenu.tsx`), so every new colour must hold on both (§4.3) |
| Component library | Radix, through the shipped shadcn wrappers. **The picker uses the shipped `DropdownMenu`** (`@/components/ui/dropdown-menu`). There is no `@radix-ui/react-popover` in the repo, and the `AttentionPopover.tsx` precedent (T-235-SC) is to not buy one for a small panel (§9-D1) |
| Icon library | lucide-react. New glyphs: `Folder`, `ChevronDown`, `Check`, `Loader2`, `EyeOff` (unnamed folder), `Clock` (pending note), `Sparkles` (Expert), `CornerDownRight` (sub-agent tag), `GitMerge` (sub-agent tile), `MessageSquareDashed` (handoff tile). No emoji ships. The sketch's `📁`, `⏳`, `✦` and `↳` are drawn with these icons |
| Font | Inter (`font-sans`) for body and labels. JetBrains Mono (`font-mono`) for folder paths in the chip, picker ledger and card; timestamps; and every spend figure, pill and table cell (the shipped cockpit is mono throughout). Manrope is not used |
| New dependencies | **none** |
| Design-findings skill | `sketch-findings-agentic-rag`, treated as locked. It contributes: never colour alone (WCAG 1.4.1), honest absence, one home per concern, the ledger is the receipt, and "a page that cannot answer must SAY so" (257 CR-07) |

---

## 2. Spacing Scale

These are the declared values. Every value is a multiple of 4, and new elements use only these.

| Token | Value | Tailwind | Usage in this phase |
|-------|-------|----------|---------------------|
| xs | 4px | `gap-1`, `mt-1`, `space-y-1` | Icon-to-text gap in the chip, the card header and the pills; ledger list rhythm; the gap between the card's lines (`gap-y-1`) |
| sm | 8px | `gap-2`, `px-2`, `py-2`, `mt-2` | Picker tree node padding (`px-2 py-2`), ledger column gap, the card's `mt-2` before its lines, the statement line's `mt-2` under the ribbon, and the gap between the picker's Cancel and Apply |
| md | 12px | `p-3`, `px-3`, `gap-3`, `mt-3` | Picker content padding (`p-3`), card padding (shipped `px-3 py-3`), ledger cell `px-3`, the ledger's `mt-3` under the tree, the reconciliation footer's `mt-3`, and the key-to-value gap (`gap-x-3`) |
| lg | 16px | `gap-4`, `pl-4` | Tree indent per depth level (`16px × depth`, applied as inline `paddingLeft: 8 + 16·depth`), the Blind Spots tile grid gap (shipped `gap-4`) |
| xl | 24px | `space-y-6`, `gap-6`, `p-6` | Cockpit section rhythm (shipped `space-y-6`). The Spend by Expert card sits in that rhythm and adds no new value |
| 2xl | 48px | none | Not used |
| 3xl | 64px | none | Not used |

**Exceptions.** These shipped values are **inherited verbatim** and are not new declarations.
- `ActiveExpertChip`'s container `px-2.5 py-1 gap-1.5` (10px / 4px / 6px). `ScopeChip` copies this container class so
  the two chips read as one control set.
- The composer chip row `gap-1.5 px-3 py-1.5` (`MessageInput.tsx:513`).
- The spend ribbon's pill `px-2.5 py-1` and the ledger cell `py-2.5 px-4` (`AdminSpendPage.tsx:352`, `:676`).
- The shipped `Button size="sm"` padding.

No new element introduces a 2px, 6px, 10px or 14px value of its own.

**Touch targets:**
- The chip is at least 24px tall at every width (WCAG 2.5.8 AA).
- At `< 640px`, picker tree nodes and the Apply/Cancel items get `min-h-[44px]`.
- The Spend-by-Expert row buttons and Expert pills keep the shipped pill height on desktop and get `min-h-[44px]` at
  `< 640px`.

---

## 3. Typography

New elements declare exactly **3 sizes** and **2 weights**.

| Role | Size | Tailwind | Weight | Line height | Used for |
|------|------|----------|--------|-------------|----------|
| Label | 11px | `text-[11px]` | 600, `uppercase tracking-wider` | 1.4 (`leading-snug`) | Card keys (`NOW`, `DROPPED`, `SAVED`, `SEARCHING`), picker ledger headings (`NEXT MESSAGE SEARCHES`, `STOPS SEARCHING`, `SAVED`, `SEARCHING`), the chip's `· NOT SEARCHED` suffix, the `EXPERT` tag, the table header cells |
| Meta | 11px | `text-[11px]` | 400 | 1.4 | Card timestamp (mono), the card's footer line (`From your next message.`), the composer pending note, the statement line under the ribbon (mono), the reconciliation footer (mono), the table rule line, the ledger's sub-agent tag, and the `current` marker in the tree |
| Body | 12px | `text-xs` | 400 | 1.5 (`leading-relaxed`) | Chip label, picker tree nodes, picker sub-line, ledger items, card values, explain boxes, refusal/error text, Expert pills, table cells, Blind Spots tile body |
| Body-strong | 12px | `text-xs` | 600 | 1.5 | Card header (`Scope /Client ACME → /Client ACME/Q3 Contracts`), the selected Expert name in the statement line, the table's `Org total` row, the selected pill, tile titles |
| Title | 14px | `text-sm` | 600 | 1.4 | The picker title `Search in`, and the `Spend by Expert` card heading (matches the shipped `h2 text-sm font-semibold` on the cockpit's other cards) |

The new sizes are **11 / 12 / 14**, and the weights are **400 / 600**.

**Exceptions, inherited and not new:**
- `ActiveExpertChip`'s container carries `font-medium` (500). `ScopeChip` copies that container class verbatim, so a
  chip row never mixes two chip weights.
- The shipped cockpit keeps its 10px KPI labels, its 20px `h1`, its 24px KPI values and its `th font-medium`. This
  phase changes none of them. The new table's header cells use 11px/600 (above), not the shipped 11px/500 `th`,
  because they are a new element.

**Deviation from sketch:** the sketch draws the ledger headings and the chip suffix at 10px. This contract sets them at
**11px**, so the declared set stays at 3 sizes and uppercase labels stay legible (the same ruling as 267 §9-D1). The
picker title is 13px in the sketch and **14px** here, to stay on the shipped scale (§9-D2).

---

## 4. Color

The dark tokens are the shipped `.dark` values; the light tokens are the shipped `:root` values. **No new CSS variable
is introduced.** Hue steps use the repo's pairing pattern: `text-<hue>-700 dark:text-<hue>-{200|300}`.

### 4.1 Roles

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--background` (dark `hsl(216 45% 4%)` / light `hsl(220 20% 97%)`) | Chat transcript canvas and the cockpit page, which the new card and table sit on |
| Secondary (30%) | `--card` (dark `hsl(220 30% 7%)` / light `#fff`), `--muted` | Composer surface, the chip row (`bg-muted/40`, shipped), the picker surface (the shipped `DropdownMenuContent` popover surface), the Spend by Expert card (`bg-card`), Blind Spots tiles (shipped `bg-card/60`) |
| Accent (10%): scope indigo | `text-indigo-700 dark:text-indigo-200`, `border-indigo-600/40 dark:border-indigo-500/40`, `bg-indigo-500/10 dark:bg-indigo-500/[0.18]` | Folder scope identity only (reserved list in §4.2) |
| Expert violet (shipped, unchanged role) | `text-violet-700 dark:text-violet-200`, `bg-violet-500/10 dark:bg-violet-500/15`, `border-violet-600/40 dark:border-violet-500/35` | Expert identity only: `ActiveExpertChip`, the ledger's Expert pill, the `Sparkles` glyph on the Expert filter label |
| Held (amber) | `text-amber-700 dark:text-amber-300`, `border-amber-600/40 dark:border-amber-500/30`, `bg-amber-500/10` | Only for **a change that is saved but not in effect**: the chip's `· not searched` suffix, the Restricted scope card, the `Saved` ledger column, and the Restricted explain box's left rule. The shipped Blind Spots amber is unchanged |
| Semantic "will" | `text-emerald-700 dark:text-emerald-300`, ledger cell `border-emerald-600/40 dark:border-emerald-500/25 bg-emerald-500/[0.08]` (shipped `ScopeLedger` yes) | `Next message searches` and `Searching` columns, the `Now` values, the reconciliation footer in its OK state |
| Semantic "won't" | `text-rose-700 dark:text-rose-300`, ledger cell `border-rose-600/40 dark:border-rose-500/25 bg-rose-500/10` (shipped `ScopeLedger` no) | `Stops searching` column, the `Dropped` values, the reconciliation footer in its FAILED state |
| Destructive | `--destructive` (dark `hsl(0 72% 51%)` / light `hsl(0 84% 60%)`) | **Error boxes only**: the scope-change refusal (the shipped `bg-destructive/10 border-destructive/30 text-destructive` box at `ChatArea.tsx:636`) and the picker's preview error. There is no destructive *action* in this phase |

### 4.2 Scope indigo is reserved for exactly these elements

1. `ScopeChip` in its normal state: border, wash, text and `Folder` glyph.
2. The scope event card in its normal (not held) state: border (`border-indigo-600/40 dark:border-indigo-500/40`), wash
   (`bg-indigo-500/[0.06]`) and header text.
3. The selected node in the picker tree (`bg-indigo-500/10 dark:bg-indigo-500/[0.18]` and indigo text), plus its
   `Check` glyph.
4. The Biased explain box's left rule in the picker (`border-l-2 border-indigo-600 dark:border-indigo-400`).
5. On `/admin/spend`: the active Expert pill, the selected row in Spend by Expert, and that table's share-bar fill.
   - The active pill shares the shipped Time/Coverage "on" style, which is already indigo, now light-safe (§5.6).

Indigo is **never** used for errors, for the Restricted state, or for Expert identity.

**Why indigo and not `--primary`:**
- The sketch's scope accent is indigo, and dark `--primary` (`hsl(239 100% 82%)`) is that indigo.
- But light `--primary` is `hsl(239 84% 67%)` (#6366f1). Measured on `#fff` that is **4.47:1**, below 4.5:1 for 12px
  text.
- So the chip and card use the explicit pair `text-indigo-700` (≈ 7.9:1 on white) with `dark:text-indigo-200`, rather
  than `text-primary`.

### 4.3 Light-theme contract (the 267-ui BLOCKER must not recur)

- Every new hue text step is a **pair**: a bare 600–900 step plus a `dark:` 200–400 step, on the same line. No bare
  50–400 text step of violet, emerald, rose, amber **or indigo** may appear in a phase-268 file.
- **Fence:** extend `frontend/src/components/chat/__tests__/expertThemeContrast.test.tsx`:
  - `HUES` becomes `violet|emerald|rose|amber|indigo`.
  - `FILES` adds every new phase-268 leaf: `ScopeChip.tsx`, `ScopePicker.tsx`, `ExpertSpendCard.tsx`,
    `ExpertFilterPills.tsx`, `AttributionDisclosures.tsx`, and `ActiveExpertChip.tsx` (see below).
  - Add rendered cases (layer A) for the chip (normal + held), the scope card (normal + held), the reconciliation
    footer (OK + failed) and the ledger Expert pill.
  - The non-vacuity floor rises with the new pairs.
- ⚠ **`AdminSpendPage.tsx` and `BlindSpotsCard.tsx` are dark-only today** (`text-emerald-400`, `text-amber-300`,
  `text-indigo-300`, …) and cannot join the fence without a full re-skin, which is out of scope. **That is why every
  new spend element lives in a new leaf file that the page mounts** (§5.5–§5.8). The shipped dark-only classes stay as
  they are, recorded in §9-D9.
- ⚠ **`ActiveExpertChip.tsx` is dark-only** (`text-violet-200`, `text-violet-100`, `text-violet-300`,
  `text-violet-400`). The 267 UI review left it open as "outside the six files".
  - It sits beside `ScopeChip`, and **G4-3 reads both chips at once**.
  - So this phase pairs its classes (`text-violet-700 dark:text-violet-200`, etc.) and adds it to the fence.
  - This changes only class strings, not structure (§9-R2).

**Never colour alone (WCAG 1.4.1):**
- The Restricted state is carried by the words `· not searched`, `Saved` / `Searching` and `Takes effect when … leaves`,
  not by amber alone.
- The dashed border on the inert chip is a second, non-colour cue.
- The selected tree node carries a `Check` glyph as well as its tint.
- The reconciliation footer carries `✓` / `✗` glyphs **and** its sentence.
- `No Expert` is italic **and** named.

---

## 5. Surface contracts

### 5.1 One payload, three renderings (D-268-12c, D-267-11)

The chip's inert state, the picker's ledger and the transcript card all render from **one structured payload** that
`compose_expert_scope` builds on the server. **No component in this phase branches on `scope_mode === "restricted"`,
`activeExpert.scope_mode` or any other Expert field to decide what is searched.** A source fence pins this: a
`?raw` grep of `ScopeChip.tsx`, `ScopePicker.tsx` and the scope branch of `ExpertEventCard.tsx` for `scope_mode`
returns zero matches.

**Payload shape (recommendation; the planner owns the name and transport):** `ScopeEffect`

```
{
  held: boolean,                 // true = the thread folder is NOT searched while this Expert is active
  expert: { id, name, scope_mode } | null,
  next: TranscriptScopeLine,     // what the next message searches (267 type, reused)
  stops: TranscriptScopeLine,    // what it stops searching ("Nothing" when the new scope contains the old)
  saved: TranscriptFolderRef | null   // held only: the folder that is saved but not searched
}
```

- **At rest:** the thread's current `ScopeEffect` is read once when the thread loads, and again after every Expert or
  scope change. The chip reads `held` from it.
- **Picker preview:** the picker asks for the `ScopeEffect` of the **draft** folder, one request per selection. Latest
  wins: a request-id guard drops stale responses.
- **Transcript:** the `scope_changed` event payload **snapshots the same structure** at write time. The card never
  re-fetches it, so a later rename or Expert swap cannot rewrite history.
- `TranscriptScopeLine.thread_folder` gains an optional `path` (e.g. `Client ACME/Q3 Contracts`), snapshotted at write
  time. The vocabulary renders `/{path} ({n})` when `path` is present and falls back to 267's `/{name} ({n})`, so 267
  rows render byte-unchanged.

### 5.2 `ScopeChip` (new leaf, `components/chat/ScopeChip.tsx`)

**Mount:** it goes into the shipped chip row (`MessageInput.tsx:509-541`), as the **second** child after
`ActiveExpertChip` and before attachments and connectors. This is the sketch's order: Expert, scope, connectors.
- `showChipsRow` and the `Using:` label condition widen to include `thread != null` (D-268-12d). On an existing
  thread, the row, with `Using:`, is therefore always present.
- It renders **only when a thread exists**. A brand-new chat keeps the shipped `<select>` in `ChatArea.tsx`'s
  `if (!thread)` branch, unchanged (D-268-12d).
- The chip is a Radix `DropdownMenuTrigger asChild` on a real `<button type="button">`.

**States:**

| State | Condition | Rendering |
|---|---|---|
| S1 normal | `ScopeEffect.held === false` | `Folder` 14px + `{label}` (mono) + `ChevronDown` 12px. Classes: the `ActiveExpertChip` container family (`text-xs font-medium rounded-md px-2.5 py-1 flex items-center gap-1.5 border`) + indigo pair: `border-indigo-600/40 dark:border-indigo-500/40 bg-indigo-500/10 dark:bg-indigo-500/[0.18] text-indigo-700 dark:text-indigo-200`. Hover: `hover:border-indigo-600/60 dark:hover:border-indigo-400/60` |
| S2 held (Save & say) | `ScopeEffect.held === true` | Same shape, **dashed** and quiet: `border-dashed border-border bg-transparent text-muted-foreground`. The label stays **un-struck**. After the chevron comes the suffix `· not searched` (11px/600 uppercase tracking-wider, `text-amber-700 dark:text-amber-300`), which is **visible at rest** |
| S3 changing | a PATCH is in flight | Chevron replaced by `Loader2` 12px `animate-spin motion-reduce:animate-none`, `aria-busy="true"`. The chip stays clickable but opens nothing until resolved |
| S4 unnamed folder | `folder_id` set but not in the caller's `folders` list | Label `a knowledge folder you cannot see` (the shipped `UNNAMEABLE_FOLDER`) with `EyeOff` 12px in place of `Folder` |
| S5 effect unknown | the at-rest `ScopeEffect` has not loaded, or failed | S1 styling with no suffix. The chip never **claims** `not searched` without the payload. A load failure is not shown on the chip; the picker states it on open (§5.3 P4) |

- **Label:**
  - No folder: `All your documents` (§9-D3).
  - Folder: the full path `/{path}` built from the `folders` list's `parent_id` chain. This is presentation, not the
    Expert rule.
  - Longer than 32 characters: `…/{last segment}`.
- **Accessible name** (always the full text, never truncated):
  - S1: `Search scope: {full label}. Change folder`
  - S2: `Search scope: {full label}, not searched while {Expert} is active. Change folder`
  - The same full text goes in `title`. `title` is never the only copy: the visible label and suffix carry the
    meaning (266 UI-3).
- **Composer ring:** unchanged. Scope adds no ring or glow; the violet ring stays Expert-only.

### 5.3 The picker (new leaf, `components/chat/ScopePicker.tsx`)

**Primitive:** the chip's `DropdownMenuContent` with `side="top" align="start" sideOffset={8}`.
- Width: `w-[380px] max-w-[calc(100vw-2rem)]`, padding `p-3`, `data-testid="scope-picker"`.
- Keyboard model (§8.4): tree nodes are `DropdownMenuRadioItem`s; Cancel and Apply are `DropdownMenuItem`s.

**Anatomy (top to bottom):**

```
┌──────────────────────────────────────────────┐
│ Search in                                    │  14px/600 text-foreground
│ Applies from your next message. Earlier      │  12px text-muted-foreground
│ answers keep their sources.                  │
│ ┌──────────────────────────────────────────┐ │
│ │ ✓ 📁 All your documents                  │ │  tree, max-h-[224px] overflow-y-auto
│ │   📁 Client ACME               current   │ │  "current" = 11px muted, on the saved folder
│ │      📁 Q3 Contracts                     │ │  indent 16px per depth
│ └──────────────────────────────────────────┘ │
│ ┌ NEXT MESSAGE SEARCHES ┐┌ STOPS SEARCHING ┐ │  ScopeLedger, grid-cols-1 sm:grid-cols-2 gap-2 mt-3
│ │ /Client ACME/Q3 (2)   ││ /Client ACME (4)│ │
│ │ Financial Reports  EXPERT               │ │
│ │ Chat attachments      ││                 │ │
│ └───────────────────────┘└─────────────────┘ │
│ ▍Financial Analyzer is Biased, so it adds   │  explain box (info or held), mt-3
│ ▍its own folder to whatever you pick here.  │
│                          [Cancel]  [Apply]   │  mt-3, justify-end gap-2
└──────────────────────────────────────────────┘
```

**Tree:**
- **Root node:** `All your documents` (it clears the folder). Then every folder in the caller's `folders` list,
  nested by `parent_id` and sorted by name within each level.
- **Node:** `Folder` 12px + name. `px-2 py-2`, indent `paddingLeft: 8 + 16·depth`, `rounded-md`, 12px text.
  - Selected (the draft): indigo tint + a trailing `Check` 12px.
  - The saved folder carries the trailing `current` marker (11px muted), so "nothing changes" is legible before the
    ledger loads.
- **No per-node document counts** (§9-D4). Counts appear only in the ledger, from the preview payload.
- **On open:** draft = the saved folder, and focus lands on that node.

**Ledger** (the shipped `ScopeLedger`, gaining one `held` tone, §4.1) has four states:

| # | Condition | Ledger | Explain box | Apply |
|---|---|---|---|---|
| P1 | Preview loading | One full-width placeholder cell: `Loader2` 12px + `Checking what your next message will search…` (11px muted), `role="status"` | none | disabled |
| P2 | `held === false`, draft ≠ saved | `Next message searches` (yes): `next` items, where Expert folders carry an `Expert` tag (11px/600 uppercase, `border border-border rounded px-1 text-muted-foreground`) and `Chat attachments` comes last. `Stops searching` (no): `stops` items, or the muted literal `Nothing changes` when `stops` is empty | If `expert?.scope_mode` says Biased **per the payload**: an info box with `border-l-2 border-indigo-600 dark:border-indigo-400 bg-indigo-500/10 rounded-r-md px-3 py-2 text-xs`: `{Expert} is Biased, so it adds its own folder to whatever you pick here.` No Expert: no box | enabled |
| P2′ | `held === false`, draft = saved | As P2, with `Stops searching` reading `Nothing changes` | as P2 | **disabled** (the sketch rule: nothing to apply) |
| P3 | `held === true` (Save & say) | `Saved` (held/amber): the draft folder label. `Searching` (yes): `next` items (the Expert's folders, then `Chat attachments`) | A held box with `border-l-2 border-amber-600 dark:border-amber-400 bg-amber-500/10`: **`No effect while {Expert} is active.`** (600) + ` Restricted reads {folders} only. {draft label} is saved and is searched once {Expert} leaves.` | enabled when draft ≠ saved. **Nothing is blocked** (Save & say) |
| P4 | Preview failed | `role="alert"` box, the shipped destructive family: `Couldn't check what your next message will search.` + a ghost `Try again` (re-requests this draft only and returns to P1) | none | **disabled**. A change whose effect cannot be stated is not offered (the 267 R4 rule) |

- ⛔ The words `Biased` / `Restricted` in the explain boxes come from the payload's `expert.scope_mode`, rendered by
  the vocabulary. The **decision** of what is searched is `held` / `next` / `stops`, never recomputed.

**Sub-line variants:**
- Idle: `Applies from your next message. Earlier answers keep their sources.`
- The thread is streaming: `The answer in progress keeps its scope. This applies from your next message.`

**Apply flow** (the one PATCH home in `ChatArea.tsx`, beside `applyExpertChange`, D-268-12d):
1. `Apply` `onSelect` calls `preventDefault` so the menu **stays open**, and becomes `Loader2` + `Applying…`
   (`aria-busy`). Cancel and the tree are `aria-disabled` and ignore input.
2. **Success:** the menu closes. The chip shows the new label, or S2 if the new effect is held. `onThreadUpdated`
   receives the server's thread. The transcript refetches, except while this thread streams (the 267 pitfall-11 rule),
   in which case the run-end reconcile brings the card in and the pending note (§5.4) is the live receipt.
3. **Refusal:** the menu stays open. The P4-style `role="alert"` box shows under the ledger:
   `Couldn't change the folder. {reason} This chat still searches {saved label}.` The chip never moved, so there is
   nothing to revert. Apply re-enables, and clicking it again is the retry.
   - `{reason}` is the server's `detail` sentence, as React text only.
   - Network failure: `The server could not be reached.`
4. **Cancel / Esc / outside click:** the draft is discarded, and nothing is sent.

**If research refutes D-268-12a** (that is, `agent_loop` re-reads `threads.folder_id` mid-run, so the server answers
409 while streaming):
- The chip opens the picker as usual.
- Apply is disabled while this thread streams, with a held-style line in place of the explain box:
  `Wait for this answer to finish before changing the folder.`
- The streaming sub-line and the §5.4 pending note are then **not built**.
- Record which branch shipped in the phase summary.

### 5.4 Composer pending note (sketch `#pending`)

- **When:** a scope change landed **while this thread is streaming**. It clears when that run ends.
- **Where:** directly under the chip row, inside the composer card, above the textarea.
- **What:** a `Clock` 12px + 11px `text-amber-700 dark:text-amber-300` line:
  `The answer in progress keeps searching {old label}. {new label} applies from your next message.`
  - Under a held change: `The answer in progress keeps its scope. {new label} is saved for when {Expert} leaves.`
- `role="status"`, `aria-live="polite"`, `data-testid="scope-pending-note"`.
- **Why it is required, not decoration:** while streaming, the transcript does not refetch (§5.3 step 2), so the card
  may not exist on screen until the run ends. Without this line, a mid-stream change would have no receipt at rest.

### 5.5 Transcript card: the `scope_changed` kind (D-268-12)

**Mount:**
- `scope_changed` joins `TRANSCRIPT_EVENT_KINDS` in **both** `backend/app/models/message.py` and
  `expertEventCopy.ts`. They are cross-pinned by the shipped `?raw` test.
- `ExpertEventCard` gains a third branch, `ScopeChangedCard`, drawn in the **same `Shell`**. This is the "FORWARD
  SHAPE" the 267 module docblock reserved: "adds a KIND and a header here … never needs a second renderer".
- **`MessageItem.tsx` needs no edit.** Its one early return already routes every allowlisted kind (§9-R3).
- `Shell`'s `tone` widens from `"violet" | "neutral"` to add `"scope"` (indigo) and `"held"` (amber).

**Anatomy:**

```
Normal (no Expert, or Biased):
┌──────────────────────────────────────────────────────────────────┐
│ 📁 Scope /Client ACME → /Client ACME/Q3 Contracts          14:35 │  header 12px/600 indigo pair, time 11px mono muted
│ NOW      /Client ACME/Q3 Contracts (2) · Financial Reports & …    │  12px emerald pair
│ DROPPED  /Client ACME (4)                                        │  12px rose pair, or muted "Nothing"
│ From your next message.                                          │  11px muted, mt-2, spans both columns
└──────────────────────────────────────────────────────────────────┘

Held (Restricted, Save & say):
┌──────────────────────────────────────────────────────────────────┐
│ 📁 Scope /Client ACME → /Client ACME/Q3 Contracts          14:35 │  header 12px/600 amber pair
│ SAVED      /Client ACME/Q3 Contracts                             │  12px text-foreground
│ SEARCHING  HR Policies only · HR Advisor is Restricted           │  12px text-foreground
│ Takes effect when HR Advisor leaves.                             │  11px muted
└──────────────────────────────────────────────────────────────────┘
```

| Tone | Container | Header text + glyph |
|---|---|---|
| `scope` | `border-indigo-600/40 dark:border-indigo-500/40 bg-indigo-500/[0.06]` | `text-indigo-700 dark:text-indigo-200`, `Folder` 12px `text-indigo-600 dark:text-indigo-300` |
| `held` | `border-amber-600/40 dark:border-amber-500/30 bg-amber-500/10` | `text-amber-700 dark:text-amber-300`, `Folder` 12px same pair |

- **Header:** `Scope {from} → {to}`. `from` and `to` are the snapshotted labels (`/{path}` or `All your documents`,
  mono not required in the header). The header truncates with `min-w-0 truncate` and carries its full text in the
  card's `aria-label`.
- **Values:** the 267 `ScopeValue` renderer, unchanged. Items are joined by ` · `, and the thread folder renders as
  `/{path} ({n})`.
  - `Now` = `next`.
  - `Dropped` = `stops`. It is empty (the muted literal `Nothing`) when the new scope contains the old one, which
    happens when widening.
  - Moving from no folder to a folder: `Dropped` = `All other documents`.
- **Held values** are `text-foreground` (neither emerald nor rose): nothing was gained or lost yet.
  - `Saved` = `saved`.
  - `Searching` = `{next folder names joined by " · "} only · {Expert} is Restricted`. `Chat attachments` is omitted
    from this line; the picker shows it.
- **Footer line:** the 267 grid's children are keys and values, so the footer is a **sibling below the grid**
  (`mt-2 text-[11px] leading-snug text-muted-foreground`, `data-testid="scope-event-when"`):

| Snapshot | Footer |
|---|---|
| normal, idle at write | `From your next message.` |
| normal, written while streaming | `From your next message. The answer in progress keeps {from}.` |
| held | `Takes effect when {Expert} leaves.` |

- **No event on an empty thread** (D-268-12b): the chip updates, the transcript stays empty, and nothing else renders.
- **A11y and motion:** the same as 267 §5.6.
  - `role="note"`, `aria-label="Scope change at {HH:mm}"`.
  - Keys are visible text.
  - Live append only: `animate-in fade-in duration-200 motion-reduce:animate-none`; no animation on reload.
- **Test ids:** `scope-event-card`, `scope-event-now`, `scope-event-dropped`, `scope-event-saved`,
  `scope-event-searching`, `scope-event-when`.
  - The shipped `expert-event-card` id stays on the Expert kinds only, so no existing suite changes its population.
  - Pass the test id through `Shell` as a prop.

### 5.6 `/admin/spend`: the Expert filter (D-268-08; Spend A)

**Ribbon** (the shipped filter ribbon, `AdminSpendPage.tsx:341`): a new group, `ExpertFilterPills` (new leaf,
`components/admin/spend/ExpertFilterPills.tsx`), goes **between Time and Coverage**. The ribbon order becomes
Time · Expert · Coverage, and it already wraps.

- **Label:** `Sparkles` 12px `text-violet-600 dark:text-violet-400` + `Expert:` (mono, `text-muted-foreground`),
  the same shape as `Time:`.
- **Pills, in order:**
  1. `All`
  2. Every Expert line in `expert_breakdown` for the window, by USD descending. Deleted Experts are included, labelled
     `Deleted Expert` + a mono muted suffix of the first 8 characters of the id, so two deleted Experts never merge
     visually.
  3. `No Expert` (italic), **always present**, even at $0.
  4. `Not recorded (before 268)` (italic), present only when its line is non-zero.
- **Overflow:** with more than 6 Expert pills, show the top 5 by USD plus a `More ▾` pill. It opens a `DropdownMenu`
  (radio items) with the rest. A selected Expert that sits in the overflow is promoted to a visible 6th pill.
- **Pill class:** one shared helper, `filterPillClass(on)`, is used by **all three** pill groups, so the ribbon reads
  as one control set on both themes (§9-D8).
  - On: `bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-600/40 dark:border-indigo-500/40 font-semibold`
  - Off: the shipped `text-muted-foreground hover:text-foreground hover:bg-card`
  - Every pill is a `<button type="button" aria-pressed>`.
- **Selection persists across Time changes.** A selected Expert with no runs in the new window stays selected and
  visible as a pill, and shows a `$0.0000` line (§5.7).
- **While loading, or after a failed load:** the group shows `All`, plus the selected pill if there is one, so the
  operator can always clear. It never shows an empty group with no way back.
- **Wire (D-268-08):** one param, `expert` (`<uuid>` | `none` | `unrecorded` | absent), passed to **both**
  `getSpendSummary` and `getSpendRuns` from the ONE `loadAll` callback, and to `goToLedgerOffset`.
  - ⛔ A second call site that omits it is the 257 "two dialects" defect. The D-268-08 test asserts that KPIs, the
    14-day chart, the donut and the ledger all move together.

**Filter statement line** (new, `data-testid="spend-filter-statement"`): directly under the ribbon, `mt-2`, 11px mono
`text-muted-foreground`, with the name in 600 `text-foreground`.

| Filter | Line |
|---|---|
| All | `Showing all runs · {window}` |
| An Expert / No Expert / Not recorded | `Showing {name} · {window} · the cards, charts and ledger follow this filter · ` + a `clear` button (link style, `text-indigo-700 dark:text-indigo-300 hover:underline`) |

`{window}` = `Today` / `Last 7D` / `Last 30D` / `All Time`, taken from the same label map as the Time pills.

**What follows the filter (D-268-08):**
- **KPI card 1:** its label becomes `Spend · {name}` while filtered (`Total Org Spend (Attributable)` otherwise). Its
  value and footnote follow the filter.
- **KPI cards 2–4, the 14-day chart, the Model Spend Share donut, the Blind Spots card counts and the ledger:** the
  values follow the filter; the labels are unchanged.
- The chart and donut headers gain a right-side mono suffix `· {name}` while filtered.
- The donut stays **Model** Spend Share, now narrowed to the selected Expert's runs (§9-D5).
- ⛔ **The Spend by Expert table does NOT follow the Expert filter.** It is the navigator, so it always lists every
  line for the window and highlights the selected one. Its header says so (§5.7). This is why the statement line reads
  "the cards, charts and ledger" and not the sketch's "all cards".

### 5.7 `/admin/spend`: the Spend by Expert card (new leaf, `components/admin/spend/ExpertSpendCard.tsx`)

**Placement:** after the charts row and before the Blind Spots card. The page order becomes: KPIs · charts · **Spend
by Expert** · Blind Spots · Ledger/Rates.

**Card:**
- Shell: the shipped cockpit card family (`rounded-xl border border-border bg-card p-5 shadow-sm`).
- Heading: `Sparkles` 16px violet pair + `Spend by Expert` (14px/600).
- Right label: `every Expert · {window} · not filtered` (11px mono muted).

**Table** (`overflow-x-auto`, `data-testid="expert-spend-table"`). Columns: `Expert` · `Runs` (right) · `Tokens` (right)
· `USD` (right) · `Share`.

| Row | Name cell | Notes |
|---|---|---|
| Expert | the name as a `<button type="button" aria-pressed>` + a mode tag (`Biased` / `Restricted`, the 11px bordered tag) + `{n} unrated` amber chip (`text-amber-700 dark:text-amber-300 border-amber-600/40 dark:border-amber-500/30 bg-amber-500/10 rounded-full px-2 text-[11px]`) when that line has unrated runs | USD excludes unrated runs, exactly as the org total does |
| Deleted Expert | `Deleted Expert` + mono muted `{id8}`, no mode tag | still a filter button (its uuid) |
| No Expert | *`No Expert`* (italic, `text-muted-foreground`) | **always present**, even at `0 · 0 · $0.0000`. Its share-bar fill is `bg-muted-foreground/60` |
| Not recorded (before 268) | *`Not recorded (before 268)`* (italic, muted) | present only when non-zero. Never merged into No Expert (D-268-06) |
| Org total | `Org total` (600), `border-t border-border` | the summary's org total for the window (not the client's sum) |

- **Sort:** Experts (including Deleted) by USD descending, then `No Expert`, then `Not recorded (before 268)`, then
  `Org total`.
- **Cells:** figures in mono. USD is `$X.XXXX` (4 decimals, matching the shipped KPI). Tokens are `k` / `M`, using the
  shipped KPI formatter. Runs are integers.
- **Share:** a `h-1.5 rounded-full bg-background min-w-[80px]` track with an indigo fill
  (`bg-indigo-600 dark:bg-indigo-400`) proportional to USD / org total.
  - The bar is supplementary: the USD figure is always in its own cell, so share is never read from colour or length
    alone.
- **Selected row** (matches the Expert filter): `bg-indigo-500/10 dark:bg-indigo-500/[0.18]` on its cells, plus
  `aria-pressed="true"` on its button.
- **Clicking a row** toggles the filter: select it, or clear it if it is already selected (the sketch's behaviour).

**Reconciliation footer** (`mt-3`, 11px mono, `data-testid="expert-spend-recon"`). Computed client-side from the lines
the server sent against the server's org total. It is an independent check, not a restatement:

| Result | Rendering |
|---|---|
| USD and run counts both reconcile | `CheckCircle2` 12px + `✓ {k} lines = ${total} = org total · {R} runs, 0 unattributed`, `text-emerald-700 dark:text-emerald-300` |
| USD differs | `XCircle` 12px + `✗ Lines sum to ${sum}; the org total is ${total} (a difference of ${diff}). This page is not hiding it.`, `text-rose-700 dark:text-rose-300`, `role="alert"` |
| Runs differ | `XCircle` + `✗ Lines count {r} runs; the window has {R}. {R−r} runs are unattributed.`, rose pair, `role="alert"` |

- Money is compared in integer ten-thousandths (`Math.round(usd * 1e4)`), so a float residue cannot produce a false
  alarm.
- **Rule line** under the footer (11px muted, `mt-1`): `A run counts toward the Expert active when it started.
  Sub-agent and continued runs count toward their parent run's Expert. Runs from before this was recorded show as
  Not recorded (before 268), never as No Expert.`

**Other states:**
- Loading: the table body is one row reading `Loading…` (muted).
- Failed load (257 CR-07 rule: no confident numbers): the card body is
  `Spend by Expert unavailable — spend data did not load.` in the shipped amber-unavailable family, **in the new leaf
  with light-safe pairs** (`text-amber-700 dark:text-amber-300`). There is no table and no footer.
- An empty window (zero runs): the `No Expert` row at `0 · 0 · $0.0000`, `Org total` `$0.0000`, and the footer
  `✓ 1 line = $0.0000 = org total · 0 runs, 0 unattributed`.

### 5.8 `/admin/spend`: the ledger's Expert column, and Blind Spots

**Ledger** (`AdminSpendPage.tsx:673` table): a new `Expert` column goes **second**, after `Run Identity`. The cell is a
new leaf, `LedgerExpertCell`, which lives in `ExpertSpendCard.tsx`'s module so it joins the fence.

| Value | Rendering |
|---|---|
| Expert | a pill `rounded-full px-2 text-[11px] inline-flex items-center gap-1` with violet pair `bg-violet-500/10 dark:bg-violet-500/15 border border-violet-600/40 dark:border-violet-500/35 text-violet-700 dark:text-violet-200` + `Sparkles` 12px + the name (truncate `max-w-[16ch]`, full name in `title` **and** as the accessible name) |
| No Expert | *`No Expert`*: the same pill shape, `border-dashed border-border bg-transparent text-muted-foreground italic` |
| Deleted Expert | `Deleted Expert`, the dashed muted pill, no glyph |
| Not recorded | `Not recorded` in 11px muted plain text, no pill |

- **Sub-agent roll-up tag** (D-268-09): a root run whose tokens include descendants carries, in `Run Identity`, a
  `CornerDownRight` 12px + `incl. {n} sub-agent(s)` tag (11px, the shipped `border border-border/40 rounded` tag
  shape).
  - This is **load-bearing honesty**: the row's tokens now exceed that run's own persisted tokens, and the tag is
    what says why.
  - `SpendRunItem` gains the count (the planner names the field).
- **Continuation tag:** a Harness Continue / re-drive shell row carries a `continued` tag of the same shape when the
  API marks it.
- **Filtered-empty ledger:** `No runs for {name} in {window}. Its line in Spend by Expert reads $0.0000.`
  - Unfiltered, it keeps the shipped `No runs matching current filters.` The failed-load copy is unchanged.
- **Filtered ledger header:** the shipped right side gains a mono chip `filtered to {name}`, the same shape as the
  shipped `coverage-scope-note`, with visible text and no hover-only reason.

**Blind Spots** (`BlindSpotsCard.tsx`): two new tiles, mounted from a new leaf `AttributionDisclosures.tsx` into the
shipped grid. The grid changes from `xl:grid-cols-4` to `md:grid-cols-2 xl:grid-cols-3` (6 tiles, 2 rows). Both tiles
use the shipped tile shape. Neither has a button: there is no filter that lands on their population (the shipped CR-06
"no button, deliberately" rule).

| Tile | Title (12px/600) | Body (11px muted) | Footer (11px) |
|---|---|---|---|
| Sub-agent roll-up (`data-testid="blind-spot-subagent"`) | `GitMerge` 14px `text-indigo-600 dark:text-indigo-400` + `Sub-agent tokens now counted` | `A sub-agent's tokens now count toward the run that started it, and toward that run's Expert. Before Phase 268 they were left out, so totals that include sub-agent work read higher than they used to.` | `Shown as "incl. N sub-agents" in the ledger below.` (muted) |
| Handoff summary (`data-testid="blind-spot-handoff"`) | `MessageSquareDashed` 14px muted + `Handoff summaries not metered` | `"New chat with an Expert" writes a short summary of this chat with one model call. That call is not a run, so its tokens are in no total on this page.` | `Not metered yet` in `text-amber-700 dark:text-amber-300` |

---

## 6. Interaction contracts

### 6.1 Change scope (CHAT-08)
- The chip opens the picker. Picking a node sends one preview request (latest wins). Apply sends the one PATCH
  (`folder_id` or `clear_folder`).
- The consequence is stated **before** the click (the picker ledger) and recorded **as it happens** (the card, or the
  pending note while streaming).
- **No confirmation dialog.** The change is reversible by picking again, and its effect is on screen before Apply. A
  confirm step would add friction without information (the 267 §6.2 ruling).
- The next message uses the new scope. Earlier answers keep their sources, and nothing in the transcript re-renders.

### 6.2 Under a Restricted Expert (Save & say)
- Nothing is blocked. The change is saved, the chip goes dashed with `· not searched`, and the card reads
  `Saved` / `Searching` / `Takes effect when {Expert} leaves.`
- When that Expert leaves (the shipped `✕` on `ActiveExpertChip`), `applyExpertChange` re-reads the thread's
  `ScopeEffect`. The chip returns to S1 with the saved folder, and 267's removal card records the change of knowledge
  set.
- **No second scope card is written** on Expert removal. The saved folder was already recorded.

### 6.3 Spend filter
- Pill click, row click and `clear` all set the one `expert` filter state. The declarative effect refetches summary
  and runs together and resets the ledger to page 1 (the shipped behaviour for every filter).
- Refresh and Reprice keep the current Expert filter. `fetchData` shares `loadAll`, so the filter cannot be dropped
  on a reprice.

---

## 7. Copywriting Contract

All strings are exact. The em dash is `—` (U+2014), the middle dot is `·` (U+00B7), the arrow is `→` (U+2192), and
the ellipsis is `…` (U+2026). Uppercase keys are title case in the source and uppercased by CSS.

**Homes (one per concern):**
- Chip and picker words: a new `components/chat/scopeCopy.ts` (`SCOPE_COPY`).
- Card words: `SCOPE_EVENT_COPY` beside `EVENT_COPY` in `expertEventCopy.ts`.
- Spend words: a new `components/admin/spend/expertSpendCopy.ts` (`EXPERT_SPEND_COPY`).
- Shared literals are **imported, never re-spelled**: `All your documents` (`EVENT_COPY.allDocuments`),
  `Chat attachments` (`LEDGER_COPY`), `a knowledge folder you cannot see` (`UNNAMEABLE_FOLDER`), and `Nothing`
  (`EVENT_COPY.nothing`).
- Each module gets a `?raw`-free unit test that pins its strings.

### 7.1 Primary CTAs

| Element | Copy |
|---|---|
| Primary CTA (picker) | `Apply` |
| Apply in flight | `Applying…` |
| Secondary (picker) | `Cancel` |
| Retry (picker preview) | `Try again` |
| Clear the spend filter | `clear` |
| Overflow pill | `More` (with `ChevronDown` 12px) |

### 7.2 Chat: chip, picker, pending note

| Element | Copy |
|---|---|
| Chip label, no folder | `All your documents` |
| Chip label, folder | `/{path}` (`…/{last segment}` past 32 characters) |
| Chip held suffix | `· not searched` |
| Chip accessible name (S1) | `Search scope: {label}. Change folder` |
| Chip accessible name (S2) | `Search scope: {label}, not searched while {Expert} is active. Change folder` |
| Picker title | `Search in` |
| Picker sub (idle) | `Applies from your next message. Earlier answers keep their sources.` |
| Picker sub (streaming) | `The answer in progress keeps its scope. This applies from your next message.` |
| Tree root | `All your documents` |
| Saved-folder marker | `current` |
| Ledger headings | `Next message searches` · `Stops searching` · `Saved` · `Searching` |
| Empty stops | `Nothing changes` |
| Expert folder tag | `Expert` |
| Biased explain | `{Expert} is Biased, so it adds its own folder to whatever you pick here.` |
| Held explain | **`No effect while {Expert} is active.`** ` Restricted reads {folders} only. {draft} is saved and is searched once {Expert} leaves.` |
| Preview loading | `Checking what your next message will search…` |
| Preview error | `Couldn't check what your next message will search.` |
| Refusal | `Couldn't change the folder. {reason} This chat still searches {saved}.` |
| Network reason | `The server could not be reached.` |
| 409 branch only (§5.3) | `Wait for this answer to finish before changing the folder.` |
| Pending note | `The answer in progress keeps searching {old}. {new} applies from your next message.` |
| Pending note (held) | `The answer in progress keeps its scope. {new} is saved for when {Expert} leaves.` |

`{folders}` is a list of folder names: two are joined `A and B`; three or more are joined `A, B and C` (the 267
gate-line rule).

### 7.3 Chat: transcript card

| Element | Copy |
|---|---|
| Header | `Scope {from} → {to}` |
| Keys (normal) | `Now` · `Dropped` |
| Keys (held) | `Saved` · `Searching` |
| Empty `Dropped` | `Nothing` (muted) |
| No-folder → folder `Dropped` | `All other documents` |
| Held `Searching` value | `{folders · joined} only · {Expert} is Restricted` |
| Footer (idle) | `From your next message.` |
| Footer (streaming) | `From your next message. The answer in progress keeps {from}.` |
| Footer (held) | `Takes effect when {Expert} leaves.` |
| Accessible name | `Scope change at {HH:mm}` |

### 7.4 `/admin/spend`

| Element | Copy |
|---|---|
| Ribbon label | `Expert:` |
| Pills | `All` · `{Expert name}` · `Deleted Expert {id8}` · `No Expert` · `Not recorded (before 268)` |
| Statement (all) | `Showing all runs · {window}` |
| Statement (filtered) | `Showing {name} · {window} · the cards, charts and ledger follow this filter · clear` |
| KPI 1 label (filtered) | `Spend · {name}` |
| Card heading | `Spend by Expert` |
| Card right label | `every Expert · {window} · not filtered` |
| Table headers | `Expert` · `Runs` · `Tokens` · `USD` · `Share` |
| Unrated chip | `{n} unrated` |
| Total row | `Org total` |
| Recon OK | `✓ {k} lines = ${total} = org total · {R} runs, 0 unattributed` |
| Recon USD fail | `✗ Lines sum to ${sum}; the org total is ${total} (a difference of ${diff}). This page is not hiding it.` |
| Recon runs fail | `✗ Lines count {r} runs; the window has {R}. {R−r} runs are unattributed.` |
| Rule line | `A run counts toward the Expert active when it started. Sub-agent and continued runs count toward their parent run's Expert. Runs from before this was recorded show as Not recorded (before 268), never as No Expert.` |
| Card loading | `Loading…` |
| Card failed | `Spend by Expert unavailable — spend data did not load.` |
| Ledger column | `Expert` |
| Ledger cells | `{name}` · `No Expert` · `Deleted Expert` · `Not recorded` |
| Sub-agent tag | `incl. {n} sub-agent` / `incl. {n} sub-agents` |
| Continuation tag | `continued` |
| Ledger header chip | `filtered to {name}` |
| Ledger empty (filtered) | `No runs for {name} in {window}. Its line in Spend by Expert reads $0.0000.` |
| Blind Spots tile 1 | title `Sub-agent tokens now counted`; body and footer as §5.8 |
| Blind Spots tile 2 | title `Handoff summaries not metered`; body and footer as §5.8 |

### 7.5 Empty, loading and error states (summary)

| Surface | Empty | Loading | Error |
|---|---|---|---|
| Picker | no folders: the tree shows only `All your documents`. The ledger still states the effect | `Checking what your next message will search…` | `Couldn't check what your next message will search.` + `Try again` |
| Scope PATCH | none | `Applying…` | `Couldn't change the folder. {reason} This chat still searches {saved}.` |
| Spend by Expert | the `No Expert` $0.0000 row + the ✓ footer | `Loading…` | `Spend by Expert unavailable — spend data did not load.` |
| Ledger (filtered) | `No runs for {name} in {window}. Its line in Spend by Expert reads $0.0000.` | the shipped paging dim | shipped `Runs unavailable — the ledger did not load.` |

### 7.6 Destructive actions

| Action | Confirmation |
|---|---|
| **None in this phase.** A scope change is reversible, and a spend filter changes a view, not data. | No confirm dialog. The picker ledger (before) and the persisted card (after) are the honesty mechanism (§6.1) |

**Removed copy:** none. The shipped chat-header folder pill is removed as an element (§9-D6), and no string is retired.

---

## 8. Accessibility and testability contract

1. **At rest, never hover-only (266 UI-3).** Tests assert the words are **visible** (`toBeVisible()` / rendered text)
   with no hover, click or disclosure.
   - The words to check: the chip label; `· not searched`; every card key and value; the card footer; the pending note;
     the statement line; every table cell including `No Expert`; the recon footer; the ledger Expert cell; and both
     new tiles.
   - The picker ledger is checked after opening the chip, which is the one disclosure this phase owns.
   - A `title` attribute never counts as the visible copy.
2. **Content, not presence** (G-8 finding): assertions check rendered strings.
   - Test ids, for anchoring only: `scope-chip`, `scope-picker`, `scope-picker-node-{id|all}`, `scope-picker-ledger`,
     `scope-picker-apply`, `scope-picker-error`, `scope-refusal`, `scope-pending-note`, the §5.5 card ids,
     `spend-expert-filter`, `spend-expert-pill-{id|none|unrecorded|all}`, `spend-filter-statement`,
     `expert-spend-table`, `expert-spend-row-{key}`, `expert-spend-recon`, `ledger-expert-cell`,
     `blind-spot-subagent`, `blind-spot-handoff`.
3. **Roles.**
   - Error and refusal boxes, and a failed recon: `role="alert"`.
   - Preview loading and the pending note: `role="status"`.
   - The card: `role="note"`.
   - Ledger lists: `<ul aria-labelledby>` (shipped `ScopeLedger`).
   - Pills and row buttons: `aria-pressed`.
   - In-flight Apply and chip: `aria-busy="true"`.
4. **Keyboard.**
   - The chip is a `<button>`; Enter or Space opens the menu.
   - Inside it, arrow keys move through the tree (`DropdownMenuRadioItem`, `menuitemradio`) and on to Cancel and Apply
     (`DropdownMenuItem`). Space or Enter on a node selects it without closing (`onSelect` + `preventDefault`).
   - Esc closes and discards the draft.
   - ⚠ **Radix Menu traps Tab**, so a plain `<button>` inside the content is unreachable by keyboard. Apply and Cancel
     **must** be menu items. The static ledger and explain text are non-focusable, as in `AttentionPopover`.
   - On `/admin/spend`, every pill, the `clear` control, `More` and each table row's name cell are real `<button>`s.
     A `<tr onClick>` alone is not accepted.
5. **Mobile, below 640px.**
   - The picker is `max-w-[calc(100vw-2rem)]`, its ledger collapses to one column, and its nodes and items are
     `min-h-[44px]`.
   - The chip truncates per §5.2 and stays at least 24px tall.
   - The ribbon wraps, and pills get `min-h-[44px]`.
   - The Spend by Expert table and the ledger scroll horizontally (`overflow-x-auto`, shipped).
6. **Reduced motion.** The card's append and the chip's `Loader2` both use `motion-reduce:animate-none`.
7. **Both themes.** §4.3's fence runs in the count gate. A new phase-268 leaf that is not in its `FILES` is a planning
   defect.

---

## 9. Recorded deviations and recommendations (for the checker and planner)

| ID | What | Why |
|---|---|---|
| D1 | The picker is the shipped `DropdownMenu` (radio items + item-buttons), not the sketch's free-floating div or a new Popover package | No `@radix-ui/react-popover` exists in the repo. `AttentionPopover.tsx` (T-235-SC) records the ruling not to add one. Radix Menu gives focus return, Esc, outside-click and roving arrows for free. The layout and words are the sketch's |
| D2 | The ledger headings and chip suffix are 11px (sketch: 10px); the picker title is 14px (sketch: 13px) | Keeps the declared type set at 3 sizes on the shipped scale. The same ruling as 267 §9-D1 |
| D3 | The no-folder label is `All your documents` (sketch: `All documents`) | The 267 cards in the same transcript already say `All your documents` (`EVENT_COPY.allDocuments`). Two words for one scope, side by side, would read as two scopes. One vocabulary home |
| D4 | The picker tree shows **no per-node document counts** (the sketch shows `N docs`); counts appear in the ledger only | No folder-count source exists in the client (`Folder` has none), and N+1 counting per open is not bought for decoration. The ledger's counts come from the server payload, so a count shown is a count measured |
| D5 | The donut stays **Model** Spend Share (narrowed by the filter), not the sketch's Expert-share donut | D-268-08 (locked) requires the donut to *follow* the filter. The per-Expert share is the Spend by Expert table, which the sketch also shows. Two Expert-share renderings would be two homes for one fact |
| D6 | The shipped **chat-header folder pill** (`ChatArea.tsx:849-854`) is **removed**, so the composer chip is the one home of scope | Sketch A (the operator's pick over B, the header pill) draws the header with the title only. The shipped pill cannot express `held`, so under a Restricted Expert it would name a folder that is not searched, beside a chip that says it is not. If the operator wants it back at G-4, restoring it is a one-block change and it must then render from `ScopeEffect` |
| D7 | The statement line reads "the cards, charts and ledger follow this filter", not the sketch's "all cards" | The Spend by Expert table deliberately does not follow the filter (it is the navigator). "All cards" would be a false sentence, and the table's own header says `not filtered` |
| D8 | The Time and Coverage pills adopt the same light-safe `filterPillClass` as the new Expert pills | Otherwise the ribbon renders two pill styles in light mode, one legible and one not. It is a class-string change on shipped pills, with no structural change |
| D9 | The shipped dark-only classes on `AdminSpendPage.tsx` / `BlindSpotsCard.tsx` are **not** re-skinned; every new spend element lives in a new, fenced leaf | A full light re-skin of the 257 cockpit is out of scope. New work must not add to the debt, which is why the leaves exist. Recommend a seed: "`/admin/spend` light theme" |
| D10 | The card's Biased `Now` joins items with ` · ` (the sketch: ` + `) | It is the shipped 267 `ScopeValue` renderer. The 267 module reserved it for this kind ("never needs a second renderer") |
| D11 | Deleted Experts render as `Deleted Expert {id8}` | D-268-04 says a missing join is "Deleted Expert". Two deleted Experts must not visually merge into one line on a page whose job is attribution |
| R1 | `ScopeEffect` payload with `held` / `next` / `stops` / `saved`, served at rest and per-draft (§5.1) | It satisfies D-268-12c's one payload for chip, picker and card without the client re-deriving the Expert rule. The planner owns the endpoint shape |
| R2 | `ActiveExpertChip.tsx` gets its violet classes paired and joins the contrast fence | It is the chip's neighbour, and G4-3 reads both at once. The 267 UI review left it open. Class strings only |
| R3 | `MessageItem.tsx` needs **no** edit | Its one early return routes every allowlisted kind to `ExpertEventCard`. Adding `scope_changed` to the allowlist and a branch in the card is sufficient. This keeps a G-5 hot file (35 phases) out of `files_modified` |
| R4 | The spend leaves live under `components/admin/spend/` (`ExpertFilterPills.tsx`, `ExpertSpendCard.tsx` incl. `LedgerExpertCell`, `AttributionDisclosures.tsx`) | They keep `AdminSpendPage.tsx`'s own diff to mounts, one param and one column, and each leaf is fenceable (D9) |

**G-4 mapping (D-268-16):**
- **G4-1 (Expert swap splits spend):**
  - Two Expert lines in Spend by Expert, each clickable.
  - The ledger shows two rows from one thread with different Expert pills.
  - The recon footer reads ✓.
  - Selecting each line moves KPIs, chart, donut and ledger together.
- **G4-2 (scope change, reload):**
  - The `Scope /Client ACME → /Client ACME/Q3 Contracts` card, with `Now` / `Dropped` / `From your next message.`,
    is present **after reload**.
  - The next answer's citations sit in the new folder. The audit join proves the retrieval, not the card.
- **G4-3 (Restricted, Save & say):**
  - The dashed chip reads `/Client ACME/Q3 Contracts · NOT SEARCHED` beside a legible `HR Advisor · Restricted` chip.
  - The card reads `Saved` / `Searching: HR Policies only · HR Advisor is Restricted` / `Takes effect when HR Advisor
    leaves.`
  - The answer still cites HR Policies.
  - Checked on **both** themes.

---

## 10. Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none new. Reuses the shipped `dropdown-menu`, `button` | not required |
| Third-party | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
