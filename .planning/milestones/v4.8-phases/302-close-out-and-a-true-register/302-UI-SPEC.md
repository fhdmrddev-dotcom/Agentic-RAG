---
phase: 302
slug: close-out-and-a-true-register
status: approved
reviewed_at: 2026-10-30
reviewed_by: gsd-ui-checker (6/6, 2 non-blocking FLAGs; self-approved under the autonomous mandate)
shadcn_initialized: true
preset: not applicable
created: 2026-10-30
---

# Phase 302 — UI Design Contract

> Visual and interaction contract for the close-out fixes in Phase 302. Written by gsd-ui-researcher in
> autonomous mode, with nothing asked of the operator. Every open point is resolved below and listed under
> **Decisions made here (UI-D1..UI-D14)**.
>
> **This phase adds no new surface.** It puts content back into an existing panel section (FIX-01),
> verifies shipped row words (FIX-03), and corrects three refusals or accessible names (FE-IN-01, -04, -06).
> No sketch exists or is owed: D-18 records the G-2 self-approval. This contract keeps the work small:
> existing components, existing tokens, existing vocabulary leaves, no packages.

---

## Surfaces in this phase

| # | Surface | Requirement / finding | Decisions | Files expected to change (one small hunk each in a hot file) |
|---|---------|----------------------|-----------|---------------------------------------------------------------|
| S1 | Workspace panel FILES section lists the thread's generated files | FIX-01 / BUG-261027-01 | D-01..D-04, D-18..D-20 | new panel module + `FilesSection.tsx`, `WorkspacePanel.tsx` (count + `hasActivity`) |
| S2 | Schedule row outcome words + row-local Run now: **verify only** | FIX-03 / BUG-261027-03 | D-05, D-19 | none unless the G-4 drive finds a defect |
| S3 | In-thread workflow start: a 409 refusal worded by its cause | FE-IN-01 | D-09 | `useStartWorkflowInThread.ts`, `composerCopy.ts`, one line in `ThreadWorkflowPicker.tsx` |
| S4 | Disabled Word-blank ticks say why | FE-IN-04 | D-10 | `DescribeTemplateRow.tsx` (one spread) |
| S5 | Team view: region and figure get distinct names | FE-IN-06 | D-11 | `TeamPicture.tsx` (one attribute), `teamVocabulary.ts` (one const) |

Not designed here, and left unchanged: `MessageItem.tsx`'s "Generated files" block and `OutputFileCard.tsx`
(the chat side stays byte-identical); `FilePreview.tsx` and `VersionDiff.tsx`; `PanelSection.tsx`;
`PanelRail.tsx`'s markup (only the number passed to it changes); `WorkflowScheduleModal.tsx` and
`scheduleOutcomeVocabulary.ts` (300's work, verified and not rebuilt); the backend findings BE-IN-01/03/04,
which have no UI.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn (already set up, `frontend/components.json`) | codebase |
| Preset | not applicable (style `default`, baseColor `slate`, CSS variables) | components.json |
| Component library | Radix via shadcn. This phase uses only the installed `Button` (the picker's existing Dismiss) and `@radix-ui/react-slot` (inside `FileRow`) | `src/components/ui/`, `FileRow.tsx` |
| Icon library | lucide-react `^0.577.0`. **No new glyph.** File glyphs come only from `@/lib/fileIcon` through `FileRow` (one icon path, Phase 195 SC#2). `Download` / `Loader2` come from `FileRow`'s own trailing arms | codebase |
| Font | Inter (`font-sans`) for prose, the theme mono (`font-mono`) for file names, meta and the group label, exactly as the panel rows already use | `index.css`, `FileRow.tsx` DENSITY.panel |
| Theme | Aether Deep Midnight (`.dark`) plus light. All colours come from existing CSS variables. **No new token** | `index.css`, `tailwind.config.js` |
| Shipped pieces reused | `FileRow` (`density="panel"`, `asChild`), `fileAgeLabel` / `TIME_UNKNOWN` (`files/fileRowUtils`), `downloadSandboxOutput` + `DownloadError` (`@/lib/api`), `PanelSection` count badge, `PanelRail` "Files — N" item, `TemplateUpload`, the picker's failure line (`ThreadWorkflowPicker.tsx:78-94`), `FILES_LOCKED_WHILE_COMPOSING` and its `#describe-files-locked` note, `teamFigureLabel` | codebase |
| Packages | **None installed.** No `npx shadcn add` | phase rule |

---

## Spacing Scale

New markup uses 4 / 8 / 16 px only. Everything else is shipped markup copied as-is.

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | Group label bottom padding (`pb-1`). Gap inside the failure line stays shipped `gap-2` (8px) |
| sm | 8px | Group label top padding (`pt-2`). Space between the last workspace row and the group label comes from this `pt-2` alone, with no extra margin |
| md | 16px | Not newly used |
| lg / xl / 2xl / 3xl | 24 / 32 / 48 / 64px | Not used |

**Exceptions (shipped markup reused verbatim, not re-spaced):**

| Value | Where | Why it stays |
|-------|-------|--------------|
| 10px horizontal, 8px vertical row padding (`px-2.5 py-2`), 2px row gap (`gap-0.5`), 4px list inset (`p-1`) | Every generated-file row and its wrapper (S1) | The workspace rows in `FilesSection.tsx:285-347` use exactly this, so the two kinds of row line up in one column. The group label also uses `px-2.5`, so its first letter sits over the row icons |
| 8px icon-to-name gap (`gap-2`), 16px glyph | S1 rows | `FileRow` DENSITY.panel `rowClass` / `iconPx`. Layout belongs to the shared row, not to the caller |
| Picker failure line `gap-2`, `basis-full` | S3 | Unchanged markup. Only the sentence inside it changes |

---

## Typography

> Scale weights are **400 and 600**. This phase's new text uses **400 only**. Any 500 that appears is
> inside a shipped class string copied verbatim, never in a new one.

| Role | Size | Weight | Line height | Used by |
|------|------|--------|-------------|---------|
| Micro | 10px (`text-[10px]`) | 400 | 1.5 (inherited) | S1 group label "Generated files" (`font-mono uppercase tracking-[0.1em]`, the chat header's class string from `MessageItem.tsx:137` with the panel's muted token). S1 size and age cells (shipped DENSITY.panel `sizeClass`). In-row download error (shipped `FileRow` `errorText` span) |
| Label | 12px (`text-xs`) | 400 | 1.5 (`leading-normal`) | S3 failure sentence (shipped picker line). S4 reason note (shipped `text-xs` paragraph, unchanged) |
| Body | 13px (`text-[13px]`) | 400 | 1.5 | S1 file name (shipped DENSITY.panel `font-mono text-[13px]`). S1 empty line "No files yet." (shipped) |

Three sizes, all already in the panel and picker. No heading or display size: no new heading exists.

---

## Color

| Role | Token | Approx. hex (dark) | Usage |
|------|-------|-------------------|-------|
| Dominant (60%) | `--background` 216 45% 4% | #06090F | The page and chat column behind the panel (unchanged) |
| Secondary (30%) | `--panel-surface` / `--card` | (panel ground) | The panel the FILES section sits on, and the picker's card (unchanged) |
| Accent (10%) | `--primary` 239 100% 82% / `--ring` (same hue) | #A3A5FF | Reserved list below only |
| Neutral hover | shadcn `--accent` 220 25% 14% | #1A2030 | Row hover wash (`hover:bg-accent`), shipped on the workspace rows and copied to the generated rows |
| Muted text | `--panel-muted-foreground` | 7.21:1 on the panel ground (light), identical to `--muted-foreground` in dark | Group label, size and age cells, the row glyph and the `Download` glyph (DENSITY.panel tone). This token is the Phase 088-05 AA choice for the panel. **Do not substitute `text-muted-foreground`** (4.01:1 in light) |
| Error text | `text-red-400` (shipped in `FileRow` `errorText`) / `text-[hsl(0_80%_80%)]` (shipped picker failure line) / `border-red-500/40` (shipped chat error border) | — | S1 in-row download failure. S3 refusal sentence. No new red |
| Destructive | `--destructive` | #DC2828 | **Not used.** Nothing in this phase deletes anything |

**Accent (`--primary` / `--ring`) is reserved for exactly these:**
1. The keyboard focus ring on a generated-file row (`focus-visible:ring-1 focus-visible:ring-ring`, the workspace row's shipped ring).
2. Existing focus rings that are already in place (the picker trigger `ring-primary/30`, the Word-blank checkbox `focus:ring-primary`). Neither changes.

Nothing new is primary-coloured. **UI-D5:** the panel's `Download` glyph keeps the panel density's muted tone.
It does not use the chat density's `text-primary` (see S1).

---

## Surface Contracts

### S1: The FILES section lists the thread's generated files (FIX-01)

**Data rule (D-02, binding regardless of RESEARCH's measured cause).** The generated rows read from the
**same source the chat's "Generated files" list reads**, for the viewed thread (`useViewingThread()`).
Nothing is copied into `workspace_files`, and there is no second storage path. The read logic lives in a
**new module** (suggested `components/panel/generatedFiles.ts` for the derivation and
`components/panel/GeneratedFilesGroup.tsx` for the rows). `FilesSection.tsx` gains one mount, and
`WorkspacePanel.tsx` gains one count term (G-5 honoured by construction). If RESEARCH finds that the cause
is not the two-homes split, the visual contract below still holds. Only the data source changes.

**Anatomy, with both kinds of file:**
```
FILES                                              6     ← PanelSection count = workspace + generated (unique)
┌─────────────────────────────────────────────────────┐
│ [Upload a template]                                 │  TemplateUpload (shipped, unchanged, always first)
│ ▢  reports/summary.md          2.1 KB · v3   4m ago │  workspace rows: listbox options, open the preview (unchanged)
│ ▢  analysis.py                   812 B · v1   9m ago │
│                                                     │
│ GENERATED FILES                                     │  group label, 10/400 mono uppercase, panel-muted
│ 🖼  c1.png                      48.2 KB   2m ago  ⤓ │  generated rows: <a> download rows, panel density
│ 🖼  c2.png                      51.0 KB   2m ago  ⤓ │
│ 📄  quarterly-revenue-charts.pdf 210 KB   2m ago  ⤓ │
└─────────────────────────────────────────────────────┘
```

**Anatomy, generated files only (the BUG's thread):** the same, minus the two workspace rows. The group
label still shows (UI-D2), so a reader can tell why these rows download instead of opening a preview.

**Order and grouping (UI-D1, UI-D3).**
- Workspace rows come first, in their shipped order and markup, byte-unchanged.
- The generated group follows. It is one flat group with **one row per file name**. When a later turn
  produced a file with the same name, the latest turn's file wins and the earlier one is not listed (the
  chat keeps the per-turn story and its "Replaces:" line; the panel shows what exists now).
- Within the group, newest turn first. Inside one turn, keep the order the source gives.
- A file present in both homes (same name in `workspace_files` and in the outputs) is listed **once, as
  the workspace row**, because that row can also preview and show versions.

**The group label.** A `<p id={labelId}>` reading **Generated files**:
`px-2.5 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-panel-muted-foreground`.
It renders only when the group has at least one row. It is not a control and not a heading element: the
section already has its heading ("Files").

**The group wrapper.** `<div role="group" aria-labelledby={labelId} className="flex flex-col gap-0.5">`.
It sits **outside** the workspace `role="listbox"`. Generated rows are links, not listbox options
(UI-D4), so they are not part of the listbox's roving tabindex or ArrowUp/Down handler.

**A generated row (the chat's behaviour at the panel's density).**
`<FileRow asChild density="panel" …>` wrapping an `<a>`:

| Prop / attribute | Value |
|------------------|-------|
| `name` | the file's `filename`, verbatim, as React text |
| `sizeBytes` | the file's `size` when present. When absent, no size cell is shown (FileRow's rule) |
| `metaSuffix` | none (generated files carry no version) |
| `age` | `fileAgeLabel(<instant of the producing message>, rowsNow)`, using the **same one `rowsNow`** the workspace rows use. If the source has no instant, the row shows `TIME_UNKNOWN` dimmed, which is the panel's own honesty rule (`FilesSection.tsx:313-319`) |
| `trailing` | `"download"` at rest, `"spinner"` while downloading, `"dead"` when the file has no `url` |
| `errorText` | the download failure message, or `null` |
| `<a href>` | the same resolved URL the chat uses (relative `/sandbox-outputs/…` gets `VITE_API_BASE_URL` prefixed; an absolute legacy URL passes through) |
| `<a download>` | `filename` |
| `target` / `rel` | `_blank` / `noopener noreferrer` (the chat's) |
| `onClick` | `preventDefault`, then `downloadSandboxOutput(url, filename)`, which is the chat's own function. On `DownloadError` it shows the error's message. Otherwise it shows **Download failed — try again.** Either way the message clears after **3 s**. Repeat clicks while downloading are ignored |
| `aria-disabled` | `true` while downloading |
| classes | `cursor-pointer rounded-md border border-transparent px-2.5 py-2 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring`. While downloading, add `opacity-60 cursor-not-allowed`. On error, replace `border-transparent` with `border-red-500/40` |

**"Identical to the chat's" means the behaviour, not the pixel size (UI-D5).** The download function, the
URL resolution, the error words, the 3 s clear, the spinner and the dead "Download unavailable" arm are
the chat's. The glyph size (16px, no ribbon), the 13px name and the muted `Download` tone come from
`FileRow`'s `panel` density, which Phase 195 keyed per surface on purpose. The URL resolution and the click
handler must have **one home**. Lift them out of `OutputFileCard.tsx` into a shared helper that both call,
or call a helper the chat already exports. A second hand-written copy is not acceptable. The chat's
rendered output must stay byte-identical, and its baseline suite proves it.

**A url-less generated file.** `trailing="dead"` renders FileRow's shipped `<span aria-disabled>` with
**Download unavailable** (title *Download unavailable — this file has no link*). The row wrapper is then a
`<div>`, not an `<a>`, and it is not focusable. This matches the chat's dead branch.

**Counts (UI-D6).**
- `PanelSection title="Files" count={N}`, where N = workspace rows + listed generated rows (after the
  de-duplication above).
- `PanelRail` "Files — N" badge: the same N.
- `WorkspacePanel`'s `hasActivity` includes generated rows. **This is load-bearing.** Without it, a
  thread whose only files are generated short-circuits to `PanelEmpty` before the FILES section can
  render, and the bug survives with a correct list nobody can see.

**States.**

| State | What shows |
|-------|-----------|
| Workspace 0, generated 0 | `TemplateUpload`, then **No files yet.** (shipped line, unchanged). The panel may still short-circuit to `PanelEmpty` on a thread with no other activity (shipped D3) |
| Workspace ≥1, generated 0 | Exactly today's list. No group label |
| Workspace 0, generated ≥1 | `TemplateUpload`, the group label, the generated rows. **Never "No files yet."** |
| Both ≥1 | Workspace rows, then the label, then the generated rows |
| A row downloading | That row only: spinner, `opacity-60`, `aria-disabled` |
| A row's download failed | That row only: its message in the row (`text-red-400 text-[10px]`), red border, cleared after 3 s |
| Viewed thread changes | The group shows the new thread's files. No list from the previous thread lingers |
| A turn produces files while the panel is open (parallel-thread axis) | The new rows appear when the chat's "Generated files" for that turn appear, because both read the same source. No refetch control |

**Interaction and accessibility.**
- Tab order: `TemplateUpload` → the workspace listbox (one stop, roving) → each generated row (one stop
  each, native `<a>`). Enter activates the download, as in the chat. Shift+F10 / the menu key does nothing
  on a generated row: there is no ⋯ menu (UI-D7).
- A generated row's accessible name is its text content (file name, size, age), as with the chat's anchor.
  No extra `aria-label`.
- Clicking a generated row **never** opens `FilePreview` and never sets the Versions section's file
  (UI-D4). Preview for generated files would be a new capability, so it is out of scope.
- No fresh-write flash on generated rows (UI-D8). The flash belongs to the workspace version diff.
- Reduced motion: the only motion is FileRow's spinner (`animate-spin`), unchanged.
- Mobile bottom sheet: the same body renders, with nothing mobile-specific.

### S2: Schedule rows (FIX-03): what G-4 checks, nothing redesigned

The row words and the row-local Run now shipped in Phase 300 (D-15 / D-16, plan 300-01). 302 changes none
of them. The G-4 drive (D-19 scenario 2) passes when **all** of these hold in Chrome:

1. A row whose `last_status` is `launch_failed` reads **Didn't start. Press Run now to see why.** in the
   error tone (`data-testid="schedule-last-outcome"`). The token `launch_failed` appears nowhere on screen.
2. A row whose `last_status` is a server sentence reads **Didn't run — {sentence}** (full stop added if
   missing), on its own wrapping line, never truncated.
3. Pressing Run now on one row puts **only that row** into the busy state (its Run now spinner with
   sr-only **Starting…**, and its Pause and Delete disabled). Every other row's buttons, the Add form and the
   ✕ close stay enabled.
4. After the first load the list is **never** replaced by **Loading…**. A refetch marks the list
   `aria-busy="true"` and keeps the rows in place.
5. The Run now result line (`data-testid="schedule-run-result"`) appears under **Last ran** on the pressed
   row only.

Any failed check is a G-3 fast-fix inside 300's files, not a redesign. If all pass, BUG-261027-03 closes
with `verified_closed_by: 302`.

### S3: An in-thread start's 409, worded by its cause (FE-IN-01)

**Where.** The shipped failure line under the "Run a workflow" trigger
(`ThreadWorkflowPicker.tsx:78-94`: `role="alert"`, `text-xs text-[hsl(0_80%_80%)]`, the sentence, then
Retry when allowed, then **Dismiss message**). Its markup does not change. Only the sentence and the Retry
rule change.

**Cause → sentence → controls (words first: the sentence carries the next step):**

| Cause (server) | How it is told apart | Sentence | Retry |
|----------------|---------------------|----------|-------|
| The thread's workflow is running (`workflow_kickoff.py:187-193`) | The provider's lock arm (the `WORKFLOW_LOCK_DETAIL_PREFIX` match it already makes) | **A workflow is already running in this thread, so {name} didn't start.** (shipped `startLocked`, unchanged) | none (shipped) |
| The thread's workflow is paused, waiting for an answer (`workflow_kickoff.py:178-186`) | A 409 whose server sentence starts with the paused prefix, held as one constant cross-pinned to `workflow_kickoff.py` by a `?raw` test (the 279-03 Test 3c precedent) | **{name} didn't start because this thread's workflow is paused, waiting for your answer. Answer it in the panel or on the run page.** | none |
| Any other 409 on the send path. Today these are the org mismatches: the Expert / thread org (`threads.py:1836`), the chat's org (299 `refuse_if_other_org` kind `chat`) and the workflow's org (kind `run`) | A 409 that is neither of the above **and** carries a non-empty server sentence | **{name} didn't start. {server sentence}** (e.g. *Vendor review didn't start. Switch to this chat's organization to keep chatting with its Expert.*) | none |
| A 409 with no usable sentence | — | **{name} didn't start. Nothing ran.** (shipped `startFailed`) | shown (shipped) |
| 422 / folder / anything else | unchanged | unchanged | unchanged |

**Rules.**
- `{name}` is the workflow's name, as React text. The server sentence is React text, never markup.
- The org sentences are already worded for this person on the server (299 D-18 / D-38, 279-02). Showing
  them is the **second recorded exception** to "client sentence, never server text", beside 298's folder
  refusal. It must be written in the hook's header comment next to the first exception.
- No Retry for the paused cause or the other-409 cause: the same start would be refused again. The hook's
  `retry()` returns early for them, and the picker's Retry condition excludes them. That is a one-line
  edit in `ThreadWorkflowPicker.tsx` (FIRES 4/3, honoured by construction). **UI-D9:** the paused cause
  may ride the existing `kind: "locked"`, because the lock is what holds while a run is paused. The
  other-409 cause gets a new kind (suggested `"refused"`).
- The paused cause adds **no link and no button** to the run page. The sentence names where to go, and the
  panel is already beside the chat. A link would be a new control (UI-D10).
- Same tone for every cause (the shipped light red). No amber line is introduced here (UI-D11).

New strings live in `components/chat/composerCopy.ts` → `shared`, beside `startLocked`:
`startPaused(name)` and `startRefusedWith(name, sentence)`. The paused prefix is a **wire-match
constant, not copy**, so it lives with the hook (or beside the provider's lock prefix), never in
`composerCopy`.

### S4: The disabled Word-blank ticks say why (FE-IN-04)

- Each blank's `<input type="checkbox">` in `DescribeTemplateRow.tsx` (the `view.arm === "blanks"` list)
  gets the row's existing `{...lockedBy}` spread, the same object the file input and the Clear button
  already carry.
- Result: while a draft is being written (`disabled && disabledNoteId`), each tick has
  `aria-describedby="describe-files-locked"`, and a screen reader hears *"…, checkbox, dimmed/unavailable,
  Files can't be changed while the draft is being written."*
- When not composing, the ticks carry **no** `aria-describedby`. The note is unmounted then, and an id
  reference to a missing node must not exist. `lockedBy` is `{}` in that case already.
- The reason text is the shipped `FILES_LOCKED_WHILE_COMPOSING` (`templateFirstVocabulary.ts:172`),
  rendered once by the page above both locked sections. **No new string, no `title` tooltip, no visual
  change.**

### S5: The Team view's region and figure get distinct names (FE-IN-06)

- The scroll region (`role="region"`, `tabIndex={0}`, both the populated and the empty arm of
  `TeamPicture.tsx`) is named **Team view, scrollable** from a new constant `TEAM_SCROLL_REGION_LABEL` in
  `teamVocabulary.ts`.
- The `<figure>` keeps **Team picture for {name}** (`teamFigureLabel`, unchanged, including its
  Untitled-workflow fallback upstream).
- A screen reader then hears *"Team view, scrollable, region"*, then *"Team picture for Vendor risk review,
  figure"*: two names, each said once.
- The region's name deliberately leaves out the workflow name, because the figure inside it already says
  it (UI-D12). No visible change.
- `teamVocabulary.test.ts:219` pins the leaf's exported function set. The new export is a `const`, not a
  function, so that pin should be unaffected. The planner checks whether a const-set pin exists and
  updates it in the same commit if so.

---

## Copywriting Contract

| Element | Copy (verbatim) | Home |
|---------|-----------------|------|
| S1 group label + group accessible name | **Generated files** | constant in the new FIX-01 panel module (the chat's identical literal in `MessageItem.tsx:137` is left alone, because that file is hot at 39 phases) |
| S1 empty state | **No files yet.** (unchanged; now shown only when workspace and generated are both 0) | `FilesSection.tsx` (shipped) |
| S1 download failure | the `DownloadError` message from `downloadSandboxOutput` (e.g. **Session expired — please refresh the page and try again.**, **File not found.**, **Download failed — try again.**); any other error: **Download failed — try again.** | `lib/api/documents.ts` (shipped) / the shared helper |
| S1 dead file | **Download unavailable** (title: **Download unavailable — this file has no link**) | `FileRow.tsx` (shipped) |
| S1 rail item | **Files — {N}** (N now includes generated rows) | `PanelRail.tsx` (shipped template) |
| S1 unknown time | **time unknown** (dimmed) | `TIME_UNKNOWN` (shipped) |
| S3 running | **A workflow is already running in this thread, so {name} didn't start.** | `composerCopy.shared.startLocked` (shipped) |
| S3 paused | **{name} didn't start because this thread's workflow is paused, waiting for your answer. Answer it in the panel or on the run page.** | `composerCopy.shared.startPaused` (new) |
| S3 other 409 | **{name} didn't start. {server sentence}** | `composerCopy.shared.startRefusedWith` (new) |
| S3 no sentence | **{name} didn't start. Nothing ran.** | `composerCopy.shared.startFailed` (shipped) |
| S3 controls | **Retry start** / **Dismiss message** (shipped; Retry hidden for running, paused, other-409) | `composerCopy.shared` (shipped) |
| S4 reason | **Files can't be changed while the draft is being written.** | `FILES_LOCKED_WHILE_COMPOSING` (shipped) |
| S5 region name | **Team view, scrollable** | `teamVocabulary.TEAM_SCROLL_REGION_LABEL` (new) |
| S5 figure name | **Team picture for {name}** | `teamVocabulary.teamFigureLabel` (shipped) |

| Template element | This phase |
|------------------|-----------|
| Primary CTA | None new. Each generated row is its own action (download), named by its file name |
| Empty state heading | **No files yet.** (shipped, now honest) |
| Empty state body | None (shipped). `TemplateUpload` above it is the next step, unchanged |
| Error state | S1: the row's download message, cleared after 3 s, and clicking again retries. S3: the cause sentence plus Dismiss |
| Destructive confirmation | None. No destructive action exists in this phase |

No raw wire value (`launch_failed`, a status token, an ISO time, a UUID, a `/sandbox-outputs/` path) reaches
the screen.

---

## How we'd know this failed (visual)

- A thread whose turn ran `execute_code` and produced files still reads **FILES 0** or **No files yet.**,
  or the panel short-circuits to the empty panel while the chat shows Generated files.
- A generated row opens the preview, or downloads differently from the chat (another URL, another error
  sentence, no 3 s clear, no spinner).
- The section count or the rail "Files — N" disagrees with the number of rows listed.
- The same file name is listed twice in the panel.
- A generated row joins the workspace listbox (arrow keys land on it), or cannot be reached with Tab.
- The chat's Generated files list changes by a single byte.
- A schedule row shows `launch_failed`, or Run now on one row disables or reloads the others.
- An in-thread start refused because of a pause or an org mismatch reads "already running", or offers a Retry.
- A disabled Word-blank tick has no accessible description while composing, or a dangling
  `aria-describedby` when not composing.
- The Team view announces "Team picture for …" twice.
- A new colour, size, weight, glyph or package appears.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none newly added. Reuses the installed `Button` | not required |
| third-party | none | not applicable |

No `npx shadcn add` is run, no third-party registry is declared, and no npm package is installed.

---

## Pre-population sources

| Source | Decisions used |
|--------|----------------|
| 302-CONTEXT.md | D-01, D-02, D-03, D-04, D-05, D-09, D-10, D-11, D-18, D-19, D-20 (11) |
| 302-RESEARCH.md | not read (being written in parallel). S1's visual contract is written to hold whatever cause RESEARCH measures |
| 296-REVIEW.md | FE-IN-01, FE-IN-04, FE-IN-06 (file:line and the suggested fixes) |
| sketch-findings skill | file-browser-and-diff D1/D2 (rows open a preview, which is why generated rows are visibly a separate group); panel-shell D3/D4 (empty short-circuit, rail count badge); chat-tool-card-unification (one `fileIcon` path, hero split retired) |
| 301-UI-SPEC.md | format, the 4/8/16 rule with shipped-markup exceptions, 400/600 with shipped-weight exception |
| Codebase | `FilesSection.tsx`, `WorkspacePanel.tsx` (`hasActivity`, the count), `FileRow.tsx` DENSITY, `OutputFileCard.tsx` (download behaviour), `MessageItem.tsx:137` (label classes), `useStartWorkflowInThread.ts`, `composerCopy.ts`, `ThreadWorkflowPicker.tsx`, `StreamsProvider.tsx:204,3261-3283` (lock arm), `workflow_kickoff.py:178-193,311-312`, `threads.py:834-845,1836`, `item_org_guard.py` REFUSALS, `DescribeTemplateRow.tsx:332,476-482`, `WorkflowBuilderPage.tsx:2052-2081`, `TeamPicture.tsx:467,487`, `teamVocabulary.ts`, `WorkflowScheduleModal.tsx:381-560`, `scheduleOutcomeVocabulary.ts` |
| User input | 0 (autonomous mandate) |

**Decisions made here (UI-D1..UI-D14):**
- **UI-D1** Generated files are a separate group after the workspace rows, not mixed in. The two kinds behave differently (preview and versions versus download), and the file-browser D1 contract promises that a panel row opens a preview.
- **UI-D2** The group label shows whenever the group has rows, including when there are no workspace rows. That keeps the label's meaning stable.
- **UI-D3** One row per file name, latest turn wins. A name present in both homes is listed once, as the workspace row.
- **UI-D4** Generated rows are `<a>` links outside the workspace listbox: no preview, no Versions hook, no roving focus.
- **UI-D5** "Identical download" means the chat's function, URL resolution, error words, 3 s clear, spinner and dead arm, through one shared helper. The pixel density stays the panel's (16px glyph, muted `Download`), per Phase 195's per-surface density rule.
- **UI-D6** The section count, the rail badge and `hasActivity` all include generated rows. `hasActivity` is the load-bearing one.
- **UI-D7** No ⋯ menu on generated rows (Shift+F10 does nothing). The attachment menu belongs to workspace attachments.
- **UI-D8** No fresh-write flash on generated rows.
- **UI-D9** The paused 409 may reuse `kind: "locked"`. Other send-path 409s get one new kind (suggested `"refused"`). Retry is hidden for both.
- **UI-D10** The paused sentence adds no run-page link or button, because that would be a new control.
- **UI-D11** All refusal causes keep the picker's one shipped tone, with no amber.
- **UI-D12** The Team region is named **Team view, scrollable** without the workflow name, which the figure already carries.
- **UI-D13** FIX-03 gets no design work. S2 lists only the five observable G-4 checks.
- **UI-D14** The new "Generated files" constant lives in the FIX-01 module. `MessageItem.tsx`'s identical literal is not touched (hot file). Sharing it is noted for that file's next extraction.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
