---
phase: 271
slug: find-the-document
status: approved
reviewed_at: 2026-10-03
shadcn_initialized: true
preset: not applicable (components.json style "default", baseColor slate, cssVariables, iconLibrary lucide)
created: 2026-10-03
sources:
  - 271-CONTEXT.md (D-01..D-09, locked)
  - .planning/sketches/271-find-the-document (winners 1A · 2A · 3A + older-versions hint, operator 2026-10-03 — the G-2 acceptance bar)
  - sketch-findings-agentic-rag (029-A chip strip, 030-A relative date, 032-A composition, 034/035-A relationships, 036/037-A rules, 231-A header row)
  - shipped code (LibraryHeaderBar, FilterBar, ConditionPopover, DocumentList/DocumentRow, CreateLinkDialog, relationshipLabels, DocumentFileFacts, ClassificationRulesPage)
---

# Phase 271: UI Design Contract (Find the Document)

> The visual and interaction contract for the Find | Ask mode switch on the Library Documents tab, the structure filters (folder path, relationship, version state), the field-sorted result list, and the Filing rules home inside the Library. Written by gsd-ui-researcher and verified by gsd-ui-checker.
>
> **The acceptance bar is the approved sketch** (`.planning/sketches/271-find-the-document/index.html`, winners 1A / 2A / 3A, older-versions hint kept). Where this contract deviates from the sketch, the row in §Deviations from the sketch names the reason. Every other visual question defers to the sketch.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (`frontend/components.json` present) |
| Preset | not applicable. Style `default`, baseColor `slate`, CSS variables on, theme = Aether Deep Midnight (`frontend/src/index.css` `.dark`) |
| Component library | Radix (through shadcn `ui/*`: `select`, `tooltip`, `input`, `button`, `dialog`) |
| Icon library | `lucide-react` (`components.json` `iconLibrary: lucide`) |
| Font | Inter (body, `font-sans`), Manrope (page and card titles, `font-headline`), JetBrains Mono (not used by new surfaces in this phase) |
| New dependencies | **none**. Popovers use FilterBar's shipped absolute-positioned popover idiom. No shadcn Popover/Combobox is added. |

---

## Spacing Scale

Declared values. All are multiples of 4, and every one maps to a Tailwind class already used on the Library page.

| Token | Value | Tailwind | Usage in this phase |
|-------|-------|----------|---------------------|
| xs | 4px | `gap-1`, `p-1`, `py-1` | Icon to label gap inside chips and links, padding of the NEW Find/Ask segmented-control track (`p-1`), vertical padding of the Filing rules link (`py-1`) |
| sm | 8px | `gap-2` | Mode switch to search input, chip to chip, Filing rules link to queue pill, meta-line items |
| md | 16px | `space-y-4`, `gap-4` | Vertical rhythm of the Documents list column (search row → chip strip → meta line → list); this is the shipped `space-y-4` |
| lg | 24px | `gap-6`, `p-6` | List column to detail-panel gap (shipped `gap-6`), Ask card inner padding |
| xl | 32px | `p-8` | Page padding (shipped Library `p-8`) |
| 2xl | 48px | `py-12` | Zero-result box vertical padding |
| 3xl | 64px | — | Not used in this phase |

Exceptions:
- **12px, shipped idioms only** (reused, never authored fresh here):
  - the FilterBar wrapper `rounded-xl bg-card/30 ghost-border p-3` (inherited, unchanged);
  - the popover shell `p-3` (the shipped ConditionPopover idiom; every new popover in S6 reuses it so one popover family keeps one inner padding).
- **Shipped 2px track padding:** the existing Library tab segmented control keeps its shipped `p-0.5`. It is not edited by this phase; the new mode switch uses `p-1`.
- **Decorative size exemption:** the 6px (`h-1.5 w-1.5`) dot before "Exact match on fields. No AI ranking." is a decorative glyph (`aria-hidden`), not a spacing value.
- **Touch targets:** below 768px, the mode-switch segments, the quick-add chips, the Filing rules link and the sort select are `min-h-[44px]`. At 768px and up they are 32px (`h-8`).
- **Search input height 36px** (`h-9`), to match the ConditionPopover inputs it sits beside.

---

## Typography

**Weights: every NEW element in this phase uses only 400 (regular) and 600 (semibold).** Weight 700 appears only on the shipped page-title class, and 500 only on the shipped FilterBar chip text and the shipped DocumentRow filename cell, all named below. New surfaces use exactly four sizes. Shipped elements this phase reuses keep their classes byte-for-byte.

| Role | Size | Weight | Line height | Used for |
|------|------|--------|-------------|----------|
| Label | 12px (`text-xs`) | 400 regular, 600 for the count | 1.5 | Chips, meta line ("Sorted by", "Exact match on fields. No AI ranking."), version tags, mode-switch segments, the Filing rules link, popover section headings (uppercase, `tracking-wider`) |
| Body | 14px (`text-sm`) | 400 | 1.5 | Search input, result table cells, popover options, Ask card body, zero-result body |
| Heading | 18px (`text-lg`) | 600 semibold, Manrope | 1.25 | Ask card title, Filing rules sub-view section heading when the builder is closed on mobile |
| Display | 24px (`text-2xl`) | inherited `font-bold` (shipped) | 1.2 | Page title slot: "Library", and "Filing rules" in the sub-view header |

Exceptions (inherited, not authored here):
- The page title (`text-2xl font-headline font-bold`) is the measured convention on every page (`LibraryHeaderBar.tsx:96-102`). "Filing rules" keeps that class so it matches its siblings.
- FilterBar chip text stays `font-medium` (500) as shipped. The builder is shared with the Views tab, and restyling it here would fork it.
- The result-row filename keeps the shipped `DocumentRow` filename cell class `font-medium` (500). The Find column set reuses that cell; it does not restyle it.

---

## Color

Hex values are computed from the `.dark` HSL tokens in `frontend/src/index.css`. **Always use the token class, never the hex.**

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Dominant (60%) | `--background` | `#06090F` (hsl 216 45% 4%) | Page surface, search input background (`bg-background`) |
| Secondary (30%) | `--card` / `--muted` | `#0C1017` / `#141924` | Library sidebar, FilterBar wrapper, chips, Ask card, popovers (`--popover`), segmented-control tracks |
| Accent (10%) | `--primary` | `#A3A5FF` (hsl 239 100% 82%) | Only the elements listed below |
| Warning | `--warning` | `#F7B23B` (hsl 38 92% 60%) | Zero-result count and box, the older-versions hint, the "older version" row tag |
| Success (decorative) | `--success` | `#21C45D` (hsl 142 71% 45%) | The 6px dot before "Exact match on fields. No AI ranking." (`aria-hidden`) |
| Destructive | `--destructive` | `#DC2828` (hsl 0 72% 51%) | Shipped only: rule Delete and the document delete. This phase adds no destructive control. |

**Accent is reserved for exactly these elements:**
1. The selected segment of the **Find documents | Ask** mode switch (`bg-primary/15 text-primary`). The Library tab segmented control stays neutral (`bg-accent`), which is what tells the two controls apart.
2. The **Open in chat** button in Ask mode (`bg-primary/15 border-primary/40 text-primary`, the sketch `.btn`).
3. The text actions **Show them**, **Clear search**, **Clear filters** and **Try again** (`text-primary hover:underline`).
4. Focus rings (`--ring`) and the shipped selected-row wash in the result list.

Accent is **never** used for: filter chips, set or unset (they keep FilterBar's neutral `bg-card border-border`), the Filing rules link (neutral), the Library tabs, the sort select, or version tags.

---

## Screen Inventory and Layout Contract

**Focal points.** Find: the search input first, then the result list (count line, then rows). Ask: the question input, then the **Open in chat** button. Filing rules: the rules list, with **New rule** as the single primary action in the header.

### S1. Library header row: the Filing rules link (FIND-06, D-08/D-09, sketch 3A)

```
[Library] [subtitle, lg+] [Documents|Views|Ingestion|Indexing|Health]  ……  [🪄 Filing rules ›] [12 documents]
```

- The right cluster is wrapped in one `ml-auto flex items-center gap-2`. **Filing rules** comes first and the queue pill second. The link must not sit beside the tabs, where it would read as a sixth tab.
- The link is a ghost text button: `text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border rounded-md px-2 py-1`. It shows lucide `Wand2` (h-3.5 w-3.5), the label "Filing rules" and lucide `ChevronRight` (h-3.5 w-3.5). The `Wand2` glyph moves from the retired rail entry so the concept keeps its icon (icon convention: one concept, one glyph).
- The link appears on **all five tabs**.
- Below 768px it is icon-only with `aria-label="Filing rules"` and a Tooltip reading "Filing rules".
- `TAB_LABELS` keeps its five keys (D-217-15). The link is not a `role="tab"`.

### S2. The Filing rules sub-view (inside the Library)

- Clicking the link replaces the Library header row and tab body with the sub-view. **The app rail still highlights Library.**
- Sub-view header (one row, the same height as the Library row): a ghost button with `ChevronLeft` and the label "Library", then the title **"Filing rules"** (`text-2xl font-headline font-bold`), then the subtitle (hidden below `lg`), then the shipped **New rule** primary button on the right.
- **Back** returns to the Library tab the person came from, with its selection intact. It does not reset to Documents.
- Body: the shipped `ClassificationRulesPage` list and builder, unchanged in behaviour. Its own outer `p-8` and its own `h1` block are dropped, because the Library page already supplies the padding and the title. Scope filter (All / Arrival / Extracted), AutomationGroup rows, the right-side 430px RuleBuilderPanel push/split and the inline delete confirm all stay byte-identical.
- **Rail:** the "Classification" entry (`nav-items.ts`, `Wand2`) is removed, along with the mobile drawer row derived from it. The `classification-rules` `ActiveView` member and its `ChatLayout` branch are retired together in one change, and `activeViewReachability.ts` must stay green. **No path may land on `UnknownViewFallback`.**

### S3. Documents tab, Find mode: resting (no search)

```
[● Find documents | Ask]  [🔍 Filter by file name…                                  ]
Where [＋ Document type] [＋ Added by] [＋ Date] [＋ Folder] [＋ Relationship] [Version: Latest] [＋ condition]
(the shipped lead: dropzone, cloud import, stat tiles, folder heading)
(the shipped folder list, pager)
```

- The **search row** (mode switch + input) and the **chip strip** sit at the top of the list column (D-01: "at the top of Documents"). The shipped lead renders below them. **Controls the person is using never move.** Only the content below the strip changes when a search starts.
- With no search, the list is the shipped folder-browse list, byte-identical: same columns, same pager, no meta line, no sort control.
- The Views tab composition is **unchanged**: no mode switch, no quick-add chips, shipped FilterBar order.

### S4. Documents tab, Find mode: search active

A search is **active** when the name input is non-empty, **or** at least one condition is set, **or** Version is not "Latest versions".

```
[● Find documents | Ask]  [🔍 acme                                                ✕]
Where [Document type is Contract ✕] [Added by You ✕] [Folder /Contracts + subfolders ✕] [Version: Latest] [＋ Relationship] … [＋ condition]
4 documents · Sorted by [Added to Agentic RAG (newest) ▾] · ● Exact match on fields. No AI ranking. · Clear search
┌ ▸ Name                                   Type       Added by   Added          Status   Actions ┐
│   Acme MSA 2019                          Contract   You        10 Feb 2024    Ready    ⋯       │
│   /Contracts/2019 · v2 · 2 versions                                                            │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
(pager, only when total > 25)
```

- **The shipped lead is hidden while a search is active** (dropzone, cloud import, stat tiles, folder heading). Results are not folder-scoped, so a dropzone reading "upload to <folder>" above cross-folder results would mislabel where things go. Clear search brings it back.
- **The meta line** (`text-xs text-muted-foreground`, `flex flex-wrap items-center gap-2`, `aria-live="polite"` on the count) shows, in order:
  1. The count ("4 documents", "1 document", "0 documents"). `font-semibold text-foreground`, or `text-warning` at zero. **This is the only count on screen in Find mode.** FilterBar's own "N documents match" is suppressed in this mode.
  2. "Sorted by" plus a shadcn `Select` (`h-8 text-xs`, `aria-label="Sort results"`).
  3. A green dot (`aria-hidden`) plus "Exact match on fields. No AI ranking."
  4. When no Folder chip is set: "Searching every folder you can see."
  5. "Clear search" as a text action, right-aligned with `ml-auto`.
- **Result rows** come through the shipped `DocumentList` with a Find column set. It stays **seven `<td>`, fixed order**: chevron · Name · Document type · Added by · *Date* · Status · Actions. Columns 3 to 5 are what `SHED_COLUMNS_3_TO_5` hides when the detail panel opens, and **that constant is not edited** (T-217-35). Browse mode keeps Filename · Type · Size · Chunks byte-identical.
  - **Name cell:** the file name (the shipped DocumentRow filename cell, `text-sm font-medium`, unchanged), with a second line (`text-xs text-muted-foreground`) carrying the folder path ("/Contracts/2019", or "Not in a folder") and the version tag. The second line survives the shed, so folder and version stay visible beside the detail panel.
  - **Date column:** the header names the fact the active sort uses ("Added", "Modified in the file", "Created in the file", "Date in the document"). When the sort is by name, it shows "Added". A missing value reads *not recorded* (italic, muted), never `0` and never a substituted date (the 270 D-09/D-10 rule).
  - **Version tag** (`text-xs`, `rounded-md border px-2`). A latest row with a history reads "v2 · 2 versions", in neutral `border-border text-muted-foreground`. An older-version row reads "v1 · older version", in `border-warning/30 bg-warning/10 text-warning`. A single-version latest row shows no tag.
- **Row click** opens the Phase 270 detail panel for **that row**, including an older-version row. The panel must resolve from the Find result set, not only from the latest-rows `documents` array.
- **Panel open:** the shipped 032-A behaviour applies. The sidebar rails, the chip strip collapses to the shipped summary chip ("3 filters"), and columns 3 to 5 shed. Every chip popover stays usable at the reduced width (`w-72` max, it may overflow the strip to the right but never off-screen).
- **Pagination:** the shipped `DocumentsPager`, 25 rows by default. It only renders when the total is above 25. The total comes from the server count, never from the page length.

### S5. Documents tab, Ask mode (D-02, sketch 1A)

```
[Find documents | ● Ask]  [🔍 What changed in the Acme renewal?                      ]
┌ Ask is answered in chat ───────────────────────────────────────────────┐
│ Ask searches what your documents say and answers with cited passages.  │
│ It does not list documents here.                                       │
│ Your question: “What changed in the Acme renewal?”                     │
│ [Open in chat →]                                                       │
└────────────────────────────────────────────────────────────────────────┘
```

- In Ask mode the chip strip, meta line, lead and result list are **not rendered at all**. No passage, chunk or document list ever appears in the Library (D-02).
- The card uses `rounded-xl bg-card/50 ghost-border p-6 space-y-3`. The title is Heading 18/600 Manrope.
- **Open in chat** (Enter in the input does the same) opens a **new** chat thread with the question pre-filled in the composer, **not sent**. The person presses Send, so they keep control of model and provider. It uses the shipped one-shot `prefillMessage` handoff, and the navigator owns clearing it (the rule recorded in `startScopedChat.ts`). The button is disabled while the input is empty.
- **Each mode keeps its own text.** Switching modes never turns a question into a file-name filter or the reverse. Find's conditions, version state and sort survive a trip to Ask and back.
- The mode resets to **Find documents** when the page loads. It is not persisted.

### S6. Structure-filter popovers (FIND-01/FIND-03, sketch 2A)

There is **one builder**: the shipped `FilterBar` and `ConditionPopover` (D-114-1). In Find mode, FilterBar is given an optional quick-add row of dimension chips. Each chip opens a popover that edits exactly one condition in the same `ViewFilter` (or the phase's extended condition shape). Set chips render with FilterBar's shipped chip markup: summary text plus a ✕ with `aria-label="Remove condition N"`. `＋ condition` remains for every other field, **including org custom fields**. (The sketch's "Entity" chip stands in for a custom field. In the build, custom fields come through `＋ condition`, because they are defined per org.)

All popovers use the shipped idiom: `absolute top-full mt-2 z-20 w-72 rounded-lg border border-border bg-popover p-3 shadow-md`, `role="dialog"` with an `aria-label`, Esc closes it, focus returns to the chip, and section headings are `text-xs uppercase tracking-wider text-muted-foreground` (new popovers use 12px; the shipped ConditionPopover keeps its own `text-[10px]` labels untouched).

| Chip (unset → set) | Popover content | Set-chip text |
|---|---|---|
| **＋ Document type** | Options are the org's document types (`document_type_norm`), single choice or "is one of" | `Document type is Contract` |
| **＋ Added by** | "You"; each connected source by its connection name; people by display name **when the server provides one, never an email** (270 P-02); "Anyone else" | `Added by You` · `Added by Drive Finance (connected source)` |
| **＋ Date** | First "Which date": **Date in the document** · **Added to Agentic RAG** · **Created in the file** · **Last modified in the file** (the 270 labels, verbatim). Then the shipped date operators: within next… / older than… / before / after / between, using `RelativeDateControl` (030-A) | `Added to Agentic RAG between 1 Jan 2019 and 31 Dec 2019` |
| **＋ Folder** | The folder tree (own + shared, indented, the NavRow folder glyph), plus "Not in a folder", plus the checkbox **"Include subfolders"**, which is **on by default** (SC#3) | `Folder /Contracts + subfolders` · `Folder /Contracts only` |
| **＋ Relationship** | Heading "Documents that…" over 8 radio options (both directions of all 4 stored types). Heading "…this document" over the **Phase 117 combobox** (`CreateLinkDialog` typeahead, `role=combobox/listbox/option` + `aria-activedescendant`), with up to 8 candidates from **latest versions**, filtered by typed name. Then a helper line. Apply is disabled until both a verb and a document are picked | `Relationship is superseded by Acme MSA 2019` |
| **Version: Latest** (always shown) | Three radios, each with a helper line (copy below). Default is Latest versions | `Version: Has earlier versions` · `Version: Older versions (superseded)` |

**The 8 relationship verbs** are one closed table. It is pinned by a test and **derived from `relationshipLabels.ts`** (`OUTGOING_LABEL` / `INCOMING_LABEL`, which mirror the backend `_INVERSE_LABEL`), never retyped. Each verb reads as `<result> <verb> <picked doc>`:

| Key | Verb shown | Stored edge it matches |
|---|---|---|
| supersedes | Supersedes | result → picked, `supersedes` |
| superseded_by | Is superseded by | picked → result, `supersedes` |
| amends | Amends | result → picked, `amends` |
| amended_by | Is amended by | picked → result, `amends` |
| references | References | result → picked, `references` |
| referenced_by | Is referenced by | picked → result, `references` |
| attached_to | Is attached to | result → picked, `attached_to` |
| has_attachment | Has attachment | picked → result, `attached_to` |

**The Version chip is always visible, even at the default.** It reads `Version: Latest`, takes no ✕, and is styled as a neutral set chip. A filter that hides rows by default has to show that it does (D-06). Choosing an option replaces the value. Clear search resets it to Latest.

**Older-versions hint** (README winner, D-06). It shows when Version = Latest **and** a Relationship condition is set **and** the server reports N > 0 matching older-version rows. It sits directly under the result list (or under the zero box), `role="status"`, styled `rounded-lg border border-dashed border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning`. Its copy is below. **Show them** sets Version to "Older versions (superseded)". It never widens the filter on its own.

### S7. States (every surface)

| State | Find results | Ask | Filing rules |
|---|---|---|---|
| Loading | Count slot reads "Searching…" (`role="status"`). The previous rows stay with `aria-busy="true" opacity-60` | — | shipped "Loading rules…" |
| Populated | S4 | S5 | shipped list |
| Zero | Count `0 documents` in warning, plus the zero box (copy below), plus the older-versions hint if it applies | — | shipped empty line, renamed (copy below) |
| Error | `role="alert"` box, copy below. **The query and every chip are kept, and the list is never silently swapped for the unfiltered folder list** (today's `resolveFilterIntoList` catch does exactly that swap; Find must not inherit it) | — | shipped "Couldn't load your rules." + Try again |
| Resting | S3, the shipped folder list | Card with the question line hidden until text exists | — |

---

## Copywriting Contract

| Element | Copy |
|---|---|
| Mode switch | `Find documents` · `Ask` (radiogroup `aria-label="Search mode"`) |
| Find input placeholder | `Filter by file name…` |
| Ask input placeholder | `Ask a question about your documents` |
| **Primary CTA (Ask)** | `Open in chat` (lucide `ArrowRight` trails it) |
| Primary CTA (Filing rules) | `New rule` (shipped, unchanged) |
| Sort label | `Sorted by` |
| Sort options (in order, default first) | `Added to Agentic RAG (newest)` · `Added to Agentic RAG (oldest)` · `Date in the document (newest)` · `Last modified in the file (newest)` · `Created in the file (newest)` · `Name (A to Z)` |
| Deterministic line | `Exact match on fields. No AI ranking.` |
| Scope line (no Folder chip) | `Searching every folder you can see.` |
| Clear action | `Clear search` |
| Count | `{N} documents` · `1 document` · `0 documents` |
| Empty state heading | `No documents match` |
| Empty state body | `Nothing is shown from outside these filters. Remove a filter, or clear them all.` + action `Clear filters` |
| Older-versions hint | `{N} more matches in older (superseded) versions.` + action `Show them` (N=1 reads `1 more match in older (superseded) versions.`) |
| Error state | `Couldn't run this search. Your filters are kept.` + action `Try again` |
| Ask card title | `Ask is answered in chat` |
| Ask card body | `Ask searches what your documents say and answers with cited passages. It does not list documents here.` |
| Ask question line | `Your question: “{text}”` |
| Ask handoff note (under the button, muted) | `Opens a new chat with your question ready to send.` |
| Relationship popover headings | `Documents that…` · `…this document` |
| Relationship helper | `A link someone added between two documents. Older uploads of the same document are under Version.` |
| Relationship typeahead placeholder | `Type a document name` |
| Version options + helpers | `Latest versions`: "One row per document. Default." · `Has earlier versions`: "Latest rows that have older uploads in their history." · `Older versions (superseded)`: "Earlier uploads replaced by a newer version of the same document. This is version history, not a Supersedes link." |
| Version row tags | `v{n} · {m} versions` · `v{n} · older version` |
| Folder option | `Not in a folder` · checkbox `Include subfolders` |
| Added-by fallback option | `Anyone else` |
| Save-as-view when it cannot store the search | `This search can't be saved as a view yet.` (muted text, shown **instead of** the Save as view link when the search includes a name, folder, relationship or version condition. In every other case Save as view stays exactly as shipped) |
| Header link | `Filing rules` (icon-only below 768px: `aria-label` / tooltip `Filing rules`) |
| Filing rules back button | `Library` |
| Filing rules title | `Filing rules` (replaces "Classification rules") |
| Filing rules subtitle | Shipped sentence kept verbatim: `Suggest a folder for matching uploads — never a silent move. You accept or dismiss each suggestion on the document.` |
| Rule builder scope option | `After extraction` (replaces "After extraction (Classification)"). Helper line unchanged |
| Rail entry "Classification" | **Removed** |
| Destructive confirmation | **None added.** Shipped and unchanged: rule delete ("Delete the rule **{name}**? Your documents are not affected — only this rule is removed (existing suggestions stay).") and document delete |

**Vocabulary rules.**
- Never write "query" (the 029-A rule).
- Never write "AI search", "smart" or "relevance" in Find.
- Never call a date just "Modified" or "Created" without saying whose (the 270 rule).
- "Superseded" appears in the version vocabulary only together with "older versions" or "version history", so it cannot be confused with the `Supersedes` link (D-07).

---

## Component Inventory

| Component | Status | Change |
|---|---|---|
| `LibraryHeaderBar.tsx` | modify | +1 optional `onOpenFilingRules` prop; right cluster becomes link + pill. ⛔ tabs, `role="tablist"` and the attention badges are untouched |
| `LibraryPage.tsx` (G-5 FIRES) | modify | Search row + mode state; Find-active hides the lead; meta line; Filing rules sub-view state (Library-local, not an `ActiveView`). Propose the ledger seam before adding branches |
| `FilterBar.tsx` | modify | Optional quick-add dimension chips (Find only), count suppression in Find, the "can't be saved" line. Views tab passes nothing and stays byte-identical |
| `ConditionPopover.tsx` | modify / extend | Date "Which date" selector; Folder, Relationship and Version editors (or sibling editors it delegates to). One popover family, never a second builder |
| `CreateLinkDialog` combobox | reuse | Extract the combobox body so the Relationship popover and the dialog share it. Never fork it |
| `relationshipLabels.ts` | extend | The 8-verb filter table derived from the existing maps |
| `DocumentList.tsx` / `DocumentRow.tsx` (FIRES) | modify | A Find column set at positions 3 to 5 plus the name-cell second line. Still seven `<td>` |
| `SHED_COLUMNS_3_TO_5` | **unchanged** | T-217-35 |
| `DocumentDetailPanel.tsx` | reuse | Row click; must accept an older-version row |
| `DocumentsPager.tsx` | reuse | Server total |
| `ClassificationRulesPage.tsx` | modify | Renamed strings; an `embedded` mode drops the outer padding and h1 |
| `RuleBuilderPanel.tsx` | modify | One label string |
| `nav-items.ts`, `App.tsx` (`ActiveView`), `ChatLayout.tsx` (G-5 FIRES) | modify | Retire `classification-rules` across all three in one commit; reachability fence green |
| New: `FindModeSwitch` (or inline) | new | Radiogroup with two segments, roving arrow keys |
| New: `FindMetaLine` | new | Count, sort, deterministic line, scope, Clear search |
| New: `AskHandoffCard` | new | S5 |

---

## Interaction and Accessibility Contract

- **Mode switch:** `role="radiogroup"` with two `role="radio"` + `aria-checked`. Arrow Left/Right move and select. Tab enters at the checked segment.
- **Name input:** 300ms debounce (the FilterBar constant). Esc clears the name only. Enter does nothing in Find and opens chat in Ask.
- **Chips:** `aria-haspopup="dialog"` + `aria-expanded`. The ✕ is a separate, keyboard-reachable button and never hover-only (117 audit lock).
- **Sort select:** a change re-requests from the server. **The client never re-sorts a page** (the stated sort is the server's order).
- **Live regions:** the count is `aria-live="polite"`, the hint is `role="status"`, errors are `role="alert"`.
- **Pre-seeded folder:** if a sidebar folder (not Root) is selected when a search becomes active, the Folder chip is set to that folder with "Include subfolders" on. It is a visible chip and removable. Clicking a sidebar folder **while a search is active** follows the shipped `SELECT_FOLDER` rule (it ends the search and browses that folder).
- **Contrast:** all new text uses `text-foreground` or `text-muted-foreground` (≥7.7:1 on `--background`). Warning text on its 10% wash must measure ≥4.5:1, so measure it before shipping and use a text-safe shade if it fails.

---

## G-4 Lived-Experience Scenarios ("I'd recognize failure here")

Each scenario is driven in a real browser (Chrome MCP) at verification. A screenshot plus the wire is not sufficient.

1. **Find a 2019 contract without a phrase.** On Documents/Find, set Document type = Contract, Added by = You, Date = Date in the document between 1 Jan 2019 and 31 Dec 2019, and one custom field. *Failure:* passages or chunks appear; the same document appears twice; a chip is set but the count does not change; the row's visible Type, Added by or Date contradicts a chip.
2. **"What supersedes X."** Relationship = Supersedes → X, then Is superseded by → X. *Failure:* both verbs return the same set (outgoing only); the hit is an older version row that vanishes with no hint; the hint's Show them flips the version without the chip saying so.
3. **Find Filing rules without being told.** Start on the Library Ingestion tab, find and open Filing rules, press back. *Failure:* the rail still offers Classification; the link reads as a sixth tab; back lands on Documents instead of Ingestion; any page reads "Classification rules"; an existing rule is missing.
4. **Ask leaves the Library.** Type a question in Ask and press Enter. *Failure:* any list or passage renders in the Library; chat opens in the old thread; the question is sent automatically; going back to Find shows the question as a file-name filter.
5. **Panel open on a result.** Open the detail panel from a Find row. *Failure:* the panel does not open for an older-version row; the folder or version line disappears; a chip popover opens off-screen.
6. **The sort is real.** Change Sorted by to Created in the file (newest). *Failure:* the date column header does not change; rows with no recorded date are interleaved instead of last; the order matches no visible column.

---

## How We'd Know This Failed

- Find renders passages, or makes an embedding call (D-03 asserts zero in a test).
- Find shows two counts, or a count that disagrees with the rows.
- A chip renders for a filter the endpoint does not evaluate. **Every quick-add chip and every option must be backed by a server filter with a content-level test**, not a presence test.
- A relationship verb pair returns the same set, or an incoming verb returns nothing while the edge exists.
- "Latest versions" ever hides a latest row, or "Older versions" ever includes one.
- The Version chip is invisible at its default.
- A search error swaps in the unfiltered folder list.
- Ask renders anything list-shaped inside the Library, or auto-sends.
- `SHED_COLUMNS_3_TO_5` is edited, a row renders other than seven `<td>`, or the Views tab changes.
- A dead `classification-rules` member, a stale `NAV_ITEMS` entry, or a path that reaches `UnknownViewFallback`.
- "Classification" survives as the rules surface's visible name.

---

## Deviations from the Sketch (each is a decision, not drift)

| Sketch | This contract | Why |
|---|---|---|
| Set chips use an indigo wash | Set chips keep FilterBar's neutral style | One builder, shared with the Views tab. Two looks for one builder is the fork CONTEXT forbids |
| "＋ Version" at the default | `Version: Latest` always visible | A default that hides rows must show itself (D-06) |
| Version option "Superseded (older versions)", tag "v1 · superseded" | "Older versions (superseded)", tag "v1 · older version" | D-07: the lineage fact must not read like the `Supersedes` link |
| Chips "Owner", "Modified" | "Added by", "Date" with "Which date" | The Phase 270 vocabulary. "Owner" has no name source beyond You / connected source (`DocumentFileFacts.addedBy`) |
| Sort default "Modified (newest)" (CONTEXT specifics) | "Added to Agentic RAG (newest)" | ⚠ **Needs operator confirmation.** "Modified" alone is ambiguous under 270's labelled dates, and `source_modified_at` is null on every pre-270 document, so a default on it would sink most of the library into one unordered tail. "Last modified in the file" is offered as an option |
| Table columns Name/Type/Owner/Modified/Folder/Version | DocumentList Find set: chevron · Name (+ folder · version line) · Document type · Added by · Date · Status · Actions | Keeps the 7-cell SHED invariant and the shipped row actions (download, versions, delete) |
| Sub-view header shows a crumb "Library › Filing rules" plus an h2 | Back button + one title in the header row | `LibraryHeaderBar` deleted the crumb as duplication. One title, one row |
| Filing rules copy "Rules decide a new document's type, folder and fields" | The shipped subtitle, verbatim | 036-A: suggested ≠ moved. The sketch sentence overstated what rules do |
| Sketch "Open detail panel" button | Removed | Sketch scaffolding. A row click opens the panel |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `select`, `tooltip`, `input`, `button` (all already installed) | not required |
| third-party | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
