---
phase: 292
slug: more-ways-to-show-it
status: approved
reviewed_at: 2026-10-24
shadcn_initialized: true
preset: "style default · baseColor slate · cssVariables · iconLibrary lucide (frontend/components.json). Aether Intelligence / Deep Midnight tokens in frontend/src/index.css"
created: 2026-10-24
acceptance_bar: "sketch 292 winners (operator 2026-10-24): set = diagram · comparison · timeline · 2A top-down flow · 3A matrix · 4A vertical rail · Screen 5 refusals = 273 rules unchanged"
extends: ".planning/milestones/v4.5-phases/273-agent-authored-artifacts/273-UI-SPEC.md (UI-D-01..10, all still binding)"
mode: autonomous (operator: "continue by yourself end to end"). Sketch 292 + 292-CONTEXT D-01..D-26 and 273-UI-SPEC are LOCKED; every other choice is a numbered decision UI-D-292-NN below
---

# Phase 292: UI Design Contract

> The visual and interaction contract for three new agent-authored artifact components, `diagram`,
> `comparison` and `timeline`. They live inside the shipped Phase 273 artifact frame.
> Written by gsd-ui-researcher; gsd-ui-checker verifies it.
>
> **Sources, in priority order:**
> 1. `292-CONTEXT.md` (D-01..D-26, I-1..I-4, locked).
> 2. Sketch 292 (`.planning/sketches/292-more-ways-to-show-it/`, screens 2A, 3A, 4A and 5). Approved, and **this is the acceptance bar**.
> 3. `273-UI-SPEC.md` (the frame, chips, caption, rail step and notice).
> 4. The shipped code in `frontend/src/components/chat/artifacts/`.
> 5. Tokens in `frontend/src/index.css`.
> 6. Decisions made here.
>
> **What this file covers:** only what a person sees and touches, plus the backend fields that UI copy
> depends on. The behaviour contract lives in CONTEXT and RESEARCH and is not repeated here. That
> covers validation, source resolution, persistence, migration 213 and history rewriting.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialized: `frontend/components.json`) |
| Preset | `style: default`, `baseColor: slate`, `cssVariables: true`, `iconLibrary: lucide`. Tokens come from the Aether Intelligence / Deep Midnight theme in `frontend/src/index.css` (`:root` light, `.dark` the default product theme) |
| Component library | Radix via shadcn `components/ui/*`. **This phase adds no shadcn component.** The three bodies are plain semantic elements: `<svg>` + positioned `<div>`s, `<table>`, `<ol>` |
| Layout / chart library | **None added** (D-16, D-19). The diagram layout is our code; no Mermaid, dagre, elkjs or other layout package. Recharts stays chart-only |
| Icon library | `lucide-react`: `FileText` and `Info` (caption, unchanged), `Ban` (notice, unchanged), and new in this phase `Check`, `X`, `Minus` (verdict glyphs) |
| Font | Inter (`font-sans`: all body text and labels), Manrope (`font-headline`: card title, comparison option headers), JetBrains Mono (`font-mono`: **timeline dates only** in this phase, plus the existing tool rail) |
| Theme | Deep Midnight (`.dark`) is the product theme and the acceptance bar. Light (`:root`) must work with the same token names. **No hardcoded hex.** Theme-pair Tailwind palette classes are allowed only where 273 already set the precedent (emerald / rose / amber / indigo pairs listed under Color) |

---

## Spacing Scale

These are the 273 values, unchanged. All are multiples of 4.

| Token | Value | Tailwind | Usage in this phase |
|-------|-------|----------|---------------------|
| xs | 4px | `gap-1`, `py-1`, `px-1` | Glyph to legend word, edge-label horizontal padding, source icon to text |
| sm | 8px | `gap-2`, `py-2`, `px-2`, `gap-x-2` | Glyph to cell text, title to chip and pill in a timeline event, timeline grid column gap, comparison cell vertical padding, gap-row bottom padding |
| sm+ | 12px | `px-3`, `gap-3`, `pb-3` | Comparison cell horizontal padding, legend entry gap, node horizontal padding, gap from tools row to matrix, Today row bottom padding |
| md | 16px | `px-4`, `pb-4` | Card horizontal padding (unchanged frame), timeline event bottom padding, minimum horizontal gap between diagram nodes |
| lg | 24px | `h-6` | Comparison toggle height at ≥ 640px (273 legend-toggle precedent), timeline rail column width |
| xl | 32px | `h-8` | Comparison toggle height below 640px, comparison header row height |
| 2xl | 48px | — | The diagram's right gutter for back edges |
| 3xl | 64px | — | Not used |

**Fixed dimensions (all multiples of 4):**

| Element | Value | Source |
|---|---|---|
| Diagram node height | min **44px**, grows by **16px** per extra label line (max 4 lines = 92px) | sketch 42 → grid |
| Diagram node width | **88px** min to **192px** max, computed per diagram (UI-D-292-05) | sketch 120–190, widened down for 375px |
| Diagram vertical gap between rows | **36px** (row pitch = row height + 36) | sketch 78 − 42 |
| Diagram top / bottom padding inside the body | 8px / 8px | sketch |
| Diagram back-edge gutter | **48px** on the right, reserved only when the diagram has ≥ 1 back edge or self-loop | UI-D-292-05 |
| Decision node point inset | 16px each side (clip-path) | sketch 14 → grid |
| Verdict glyph badge | **16px** circle; glyph icon 10px, stroke 3 | sketch |
| Comparison term column | `min-w-24` (96px), `w-[24%]` | sketch 24% |
| Comparison option column | `min-w-[104px]` | UI-D-292-14 |
| Timeline grid | `grid-cols-[96px_24px_minmax(0,1fr)]` | sketch 92 / 22 → grid |
| Timeline dot | 12px (event), 8px (Today), card-coloured 3px ring | sketch 11 / 9 |
| Tooltip | `min-w-32` (128px) to `max-w-72` (288px) | 273 min, sketch 300 → 288 |

**Exceptions:**

- **Mark specs are not spacing tokens.** They keep sketch values:
  - edge stroke 1.5px, 2px when highlighted;
  - back-edge dash `4 4`;
  - arrowhead marker 7 × 7;
  - timeline rail line 1px;
  - gap-segment dash: 1px border, dashed;
  - upcoming-dot border 1.5px; deadline-dot border 2px.
- **Comparison toggle is 24px tall at ≥ 640px and 32px below.** This is the 273 legend-toggle rule (`h-8 sm:h-6`). It sits in a dense tools row and is keyboard-reachable.
- **Diagram nodes have no 44px touch target.** A node's height is set by its label (min 44px, which happens to meet the guideline). Its width can be 88px at 375px. A tap anywhere on the node focuses it.
- The 1px hairlines (frame, table rows, rail line) are borders, not spacing.
- **Optical-alignment offsets are not spacing tokens.** `mt-0.5` / `pt-0.5` (2px) on the timeline source line and date column, the rail's `top: 10px` start, the 10px (`size-2.5`) verdict glyph and the 3px dot ring align marks to the 14px text baseline, as in the sketch.
- **12px (`px-3` / `gap-3` / `pb-3`) is the 273 "sm+" step**, inherited unchanged from 273's scale, not a new token.
- **Primary visual anchor per type:** diagram = the first-ranked (top) node; comparison = the option header row; timeline = the Today row.

---

## Typography

The **3 sizes and 2 weights** of the 273 artifact family carry over unchanged. This phase adds no size and no weight.

| Role | Size | Weight | Line height | Font | Used for in this phase |
|------|------|--------|-------------|------|------------------------|
| Label | 12px (`text-xs`) | 400 | 1.4 (`leading-[1.4]`) | Inter | Node labels, edge labels, legend words, toggle text, hidden-count line, comparison "Term" header, comparison cell text, "Not stated", timeline dates (mono), event detail, source line, category chip, deadline pill, gap label, Today sentence, tooltip, caption second line |
| Label strong | 12px (`text-xs`) | 600 | 1.4 | Manrope (option headers), Inter (Today label) | Comparison option column headers, the word `Today` |
| Body | 14px (`text-sm`) | 400 | 1.5 | Inter | Notice reason line (unchanged) |
| Heading | 14px (`text-sm`) | 600 | 1.4 | Manrope (card title), Inter (event title) | Card title (unchanged frame), timeline event title |
| Display | 28px | 600 | 1.2 | Manrope | **Not used by the new components.** Metric value only (273) |

Rules:
- **Normalisation (UI-D-292-03).** The sketch's 10.5 / 11 / 11.5 / 12.5 / 13px sizes become 12px, and its 500 / 700 weights become 400 / 600. The rule matches 273 UI-D-10: 10.5–12.5 → 12, 13 → 14, 500 → 400, 700 → 600.
- **Mono for timeline dates is a sketch-locked exception.** It gives right-aligned, tabular dates. Use `font-mono tabular-nums`.
- **The `?` in the not-stated badge is a glyph mark, not text.** It renders 10px / 600 inside the 16px badge, the same exception 273 made for the sort glyphs `↕ ▲ ▼`.
- **Long text:**
  - node labels wrap and clamp at 4 lines (`line-clamp-4`);
  - comparison cell text wraps (`whitespace-normal break-words`) and never truncates;
  - event titles and details wrap;
  - edge labels never wrap (`whitespace-nowrap`). Their 24-character cap keeps them short (UI-D-292-24).
- **Text is always React text.** Every model-supplied string (node label, edge label, option, term, cell text, event title, detail, category) and every server-resolved excerpt renders as a React text node. ⛔ No `dangerouslySetInnerHTML`, no markdown renderer, no `innerHTML` for tooltips (I-3).

---

## Color

Token names are the contract. Values are Deep Midnight (`.dark`) → light.

| Role | Token (dark → light) | Usage |
|------|----------------------|-------|
| Dominant (60%) | `--background` `hsl(216 45% 4%)` → `hsl(220 20% 97%)` | The chat page around the artifact (unchanged) |
| Secondary (30%) | `--card` `hsl(220 30% 7%)` (#0d1017, the sketch's `--surface`) → `#ffffff` | The card surface; diagram canvas; edge-label backing; timeline dot ring; sticky comparison term column |
| Secondary, raised | `--popover` `hsl(220 30% 8%)` → `#ffffff` | Tooltip; comparison header row |
| Secondary, quiet | `--muted` `hsl(220 30% 11%)` → `hsl(220 14% 94%)` | Diagram node fill (sketch `hsl(220 30% 10%)`), category chip; cell / row hover wash at 50% (`hover:bg-muted/50`) |
| Borders | `--border` `hsl(220 20% 16%)` → `hsl(220 13% 89%)` | Frame, row hairlines at 55%, timeline rail line, gap dash, neutral glyph badge |
| Node border | `--muted-foreground` at 40% (`border-muted-foreground/40`) | Diagram node outline (sketch `hsl(220 20% 24%)`) |
| Edge stroke | `hsl(var(--muted-foreground) / 0.7)`; arrowhead fill `hsl(var(--muted-foreground))` | Diagram edges (sketch `hsl(220 16% 40%)`, measured ≥ 3:1 against the card in both themes) |
| Text | `--foreground` / `--muted-foreground` | Titles, node labels, cell text in foreground; dates, detail, source, legend, edge labels, upcoming titles in muted |
| Accent (10%) | `--primary` `hsl(239 100% 82%)` → `hsl(239 84% 67%)` | **The reserved list below only** |
| Warning | `--warning` `hsl(38 92% 60%)` (dark). Light uses `amber-700` text and `amber-600` borders and fills (273 precedent) | **The reserved warning list below only** |
| Verdict ✓ | `text-emerald-700 dark:text-emerald-400`, badge `bg-emerald-500/10 border-emerald-500/35` | Comparison favourable glyph only. This is the 273 metric-delta pair, measured at 5.48:1 on white |
| Verdict ✗ | `text-rose-600 dark:text-rose-400`, badge `bg-rose-500/10 border-rose-500/35` | Comparison unfavourable glyph only. This is the 273 pair, measured at 4.70:1 on white |
| Destructive | `--destructive` | **Not used.** No destructive action. The notice stays neutral and dashed |

**Accent (`--primary`) is reserved for exactly** (273's two uses plus three named here, UI-D-292-22):
1. The global keyboard focus ring (unchanged, `index.css` `:where(...):focus-visible`).
2. The sort arrow of the sorted table column (273, unchanged).
3. **Diagram highlight.** When a node is hovered or focused, it and its neighbours get border `border-primary` and fill `bg-primary/10`. Their edges get `stroke: hsl(var(--primary))` at 2px, with the hot arrowhead marker. Hot edge labels turn `text-foreground`; this one is not accent.
4. **Comparison toggle, pressed.** "Only terms that differ" with `aria-pressed="true"` gets `border-primary/45 bg-primary/15 text-foreground`.
5. **Timeline Today row.** Covers the word `Today`, its 8px dot and its sentence. Light theme uses `text-indigo-600` / `bg-indigo-600` instead of `--primary` (UI-D-292-23). Light `--primary` (#6366f1) measures **4.46:1** on white, which fails 4.5:1 for 12px text. `indigo-600` measures **6.26:1**.

Nothing else uses accent. That includes card borders, node fills at rest, category chips, glyph badges and event dots.

**Warning (amber) is reserved for exactly:**
1. Refused `show_artifact` rail steps (273 UI-D-02, unchanged).
2. The comparison **not-stated** badge: `?` glyph `text-amber-700 dark:text-warning`, with dashed border `border-amber-500/40`.
3. The timeline **deadline**:
   - the dot ring, `border-amber-600 dark:border-warning`, filled with the same colour when the deadline has passed;
   - the upcoming / today pill, `text-amber-700 dark:text-warning border-amber-500/30 bg-amber-500/10`.

**Colour never carries meaning alone (WCAG 1.4.1).** Each component pairs colour with a shape and a word:

| Component | How the meaning reads without colour |
|---|---|
| Diagram | Node kind = shape: pill for start / end, hexagon for decision, rounded rectangle for step. Back edge = dashed line |
| Comparison | Verdict = glyph shape (check / cross / dash / question) plus badge border style (solid / dashed), with the verdict word available to screen readers |
| Timeline | Past = filled dot; upcoming = hollow dot; deadline = thicker ring plus a worded pill; Today = a labelled row |

The data-viz palette (`--chart-1..4`) is **not used** by any of the three. They are monochrome by design: no colour per category, per node kind or per option.

---

## Component Contract

### Inventory

| Unit | Change | Notes |
|---|---|---|
| `ArtifactFrame` | **Unchanged markup.** One additive slot: an optional second caption line (comparison only, see Caption) | The label chip stays in the caption footer where 273 shipped it, not in the header as the sketch drew it (UI-D-292-01) |
| `artifactRegistry` | **3 → 6 entries:** `diagram`, `comparison`, `timeline`, read through `own()` | The three new renderers load **eagerly**, with no `React.lazy` and no Suspense flash. If the bundle check forces lazy loading, the fallback is the existing `ArtifactBusyBody` (UI-D-292-26) |
| `artifactSpec.ts` | One guard arm per new type; `ComponentName` and `LABEL_RE` widened to six | The guard rejects anything the renderer would not draw (I-3) |
| `DiagramArtifact` | New | Layout model in a pure sibling `diagramLayout.ts` (unit-testable, no DOM) |
| `ComparisonArtifact` | New | `same`-row detection in a pure helper |
| `TimelineArtifact` | New | Date parsing, sorting, Today placement, gap and day-count maths in a pure sibling `timelineModel.ts` that takes `today` as an **argument** (testable, no `Date.now()` inside) |
| `ArtifactTooltip` | New, shared by all three | Anchored excerpt tooltip (see Shared tooltip) |
| `artifactCopy.ts` | Every new string below | One home, as in 273. No component re-types a sentence |
| `ShowArtifactBody` / `summarize` | Three new essence arms | Built from the tool result's plain facts (see Rail) |

### Kind chip labels (UI-D-292-02)

| Spec | Chip |
|---|---|
| `diagram` | `Flow diagram` |
| `comparison` | `Comparison` |
| `timeline` | `Timeline` |

The chip text is fixed. It never shows `show_artifact`, `diagram` or any spec key. Existing labels are unchanged.

### Caption (D-04 grammar from 273, extended)

The caption stays server-derived and grammar-identical:

```
[label chip] [icon] [lineage — never, for these types (D-08)] [Data: … | Values provided by the agent · no source document in this turn] [count segment]
```

**Count segment by component (UI-D-292-20)**:
- the frontend phrases it from the spec's own counts, never from model text;
- the server's `row_count` gives nodes / terms / events;
- the frontend counts edges and options from the validated spec.

| Component | Count segment | Example |
|---|---|---|
| diagram | `{N} steps · {M} links` (`1 step`, `1 link`, `no links`) | `Data: search_documents · Invoice_Policy.pdf p.3 · 8 steps · 9 links` |
| comparison | `{O} options × {T} terms` (`1 term`) | `Data: search_documents · Atlas_MSA_2023.pdf p.14 → query_documents · 3 options × 7 terms` |
| timeline | `{N} events` (`1 event`) | `Values provided by the agent · no source document in this turn · 9 events` |

- The 273 rules still hold: tools are named by id; documents are truncated at 40 characters; at most 3 sources, then `+N more`. The icon is `FileText` when a data tool ran and `Info` when none did.
- ⛔ **The caption never states an upcoming count or a day count.** Those depend on the viewer's clock (D-18) and live in the body only. The caption must stay byte-identical on reload.

**Comparison second caption line (D-17).** It renders inside `<figcaption>` as a full-width line, `basis-full italic text-muted-foreground`, with no indent. The copy is fixed and chosen by one fact, whether any cell carries a source:

| Situation | Second line |
|---|---|
| ≥ 1 cell has a resolved source | `Verdicts are the agent's reading. Hover or focus a cell for its clause.` |
| No cell has a source | `Verdicts are the agent's reading.` |

Diagram and timeline have **no** second line.

### Shared tooltip: `ArtifactTooltip` (UI-D-292-09)

It shows a server-resolved source `{document, page, excerpt}` for a diagram node, a comparison cell or a timeline source line.

```
┌──────────────────────────────────────────┐   rounded-lg border border-border bg-popover
│ [FileText 12px] Procurement_Policy_v4.pdf · p.2 │   px-3 py-2 shadow-lg text-xs leading-[1.4]
│ “All new vendors must be requested through …” │   min-w-32 max-w-72  pointer-events-none
└──────────────────────────────────────────┘
```

- **Header:**
  - `text-muted-foreground`, `flex items-center gap-1`;
  - the document name is truncated at 40 characters, then ` · p.{page}`;
  - with no page, the page segment is omitted.
- **Excerpt:**
  - `text-foreground italic`, wrapped in curly quotes `“…”` added by our copy, never by the data;
  - truncated at **280 characters** with `…`.
- **Placement:**
  - **anchored to the element, never to the cursor**;
  - preferred position above the element, left-aligned with it;
  - flips below when there are fewer than 8px above;
  - clamped 8px inside the viewport horizontally;
  - this is deterministic and identical for mouse, keyboard and touch.
- **Show on:** `pointerenter` or `focus`. **Hide on:** `pointerleave`, `blur`, or `Escape` (WCAG 1.4.13, dismissible). On touch, a tap focuses the element and shows the tooltip; a tap elsewhere blurs it.
- `role="tooltip"` with a stable id (`{artifactId}-tip`). The anchored element sets `aria-describedby` to that id while the tooltip shows.
- **An element with no source shows no tooltip.** Hovering a source-less diagram node still lights its edges. A source-less cell still gets its hover wash.
- Render through a portal into `document.body` so the card's `overflow-hidden` never clips it. Use no innerHTML: the header and excerpt are React text.

### DiagramArtifact (sketch 2A, D-04, D-16)

**Anatomy:**

```
body (px-4 pt-3 pb-2, unchanged frame)
└─ div.relative  role="group"  aria-roledescription="flow diagram"
   │  aria-label="Flow diagram: {title}. {N} steps, {M} links."   width = body width, height = layout H
   ├─ <svg aria-hidden focusable="false" class="absolute inset-0 overflow-visible">
   │    <defs> marker #{id}-ah (muted) · marker #{id}-ah-hot (primary) </defs>
   │    <path> per edge (fill none, stroke 1.5, marker-end) · back edges stroke-dasharray "4 4"
   ├─ <span aria-hidden> per labelled edge (absolute, centred on the edge midpoint)
   └─ <div tabIndex role="img" aria-label=…> per node (see Screen readers) (absolute, left/top/width/height from the layout)
```

Nodes are **positioned HTML elements over one SVG edge layer** (UI-D-292-07), exactly as the sketch built them. SVG text cannot wrap, and node labels must wrap. Both layers are React elements with no innerHTML and no layout dependency, which is what D-16 locks.

**Node kinds (closed; UI-D-292-04): `step` (the default when omitted), `decision`, `start`, `end`.** There is no `actor`. The sketch drew no shape for it, and per-owner lanes (2B) lost. The shape carries the kind:

| Kind | Shape | Classes |
|---|---|---|
| `step` | rounded rectangle | `rounded-lg border border-muted-foreground/40 bg-muted px-3` |
| `start`, `end` | pill | `rounded-full border border-muted-foreground/40 bg-muted px-3` |
| `decision` | hexagon | Two stacked layers clipped to `polygon(16px 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 16px 100%, 0 50%)`. Outer layer = the border colour; inner layer inset 1px = `bg-muted`. Label `px-5`. Width capped at 160px |

- Node label: `text-xs leading-[1.4] text-foreground text-center`, centred both ways, `line-clamp-4`.
- The full label also goes in the node's accessible name. A clamped label is the 4-line backstop, not the normal case (see caps).

**Layout (UI-D-292-05). Our code, deterministic, a pure function of `(spec, bodyWidth)`:**

1. **Back edges.** Run a DFS from the nodes with no incoming edge, in spec order, then from any unvisited node, in spec order. An edge to a node on the current DFS stack is a back edge. A self-loop is a back edge.
2. **Ranks.** Use the longest path over forward edges only, starting at rank 0.
3. **Order within a rank.** Keep spec node order. No crossing minimisation: it is the approved sketch's behaviour and keeps the result predictable.
4. **Width available.** `Wn = bodyWidth − (hasBackEdge ? 48 : 0)`.
5. **Row capacity and node width.**
   - `perRow = max(1, floor((Wn + 16) / (88 + 16)))`.
   - A rank with more nodes than `perRow` wraps onto extra rows of the same rank, filled in order.
   - `k_max` = the largest row size after wrapping.
   - `nw = clamp(floor((Wn − (k_max − 1)·16) / k_max), 88, 192)`; decision nodes use `min(nw, 160)`.
6. **Horizontal placement of a row with k nodes.**
   - Step `s = max(nw + 16, min(Wn / k, nw + 96))`.
   - Centre `cx_i = Wn/2 + (i − (k−1)/2)·s`.
   - This spreads short rows as the sketch did, and never overlaps at minimum width.
7. **Node height.**
   - Characters per line: `cpl = floor((nodeWidth − padX) / 6.6)`, where `padX` is 24 (step, start, end) or 40 (decision).
   - `lines = min(4, ceil(label.length / cpl))`.
   - Height: `h = 44 + 16·(lines − 1)`.
   - Row height = the tallest node in the row. Nodes centre vertically in their row.
8. **Vertical placement.** Row `r` top = `8 + Σ(previous row heights) + 36·r`. Total `H` = last row bottom + 8.
9. **Forward edge.**
   - Cubic from the source's bottom-centre to 3px above the target's top-centre, with control points at the vertical midpoint (`M sx,sy C sx,my tx,my tx,ty`).
   - If the edge spans more than one row, both control points move horizontally by `nw/2 + 12` toward the card half the source sits in. That keeps it off intermediate nodes.
10. **Back edge (dashed).**
    - Leaves the source's right-middle and enters the target's right-middle (+4px for the arrowhead).
    - Bends through the gutter at `rx = bodyWidth − 8 − 8·(j mod 4)`, where `j` is the back-edge index.
    - Its label is right-aligned to `rx`, vertically centred between source and target.
11. **Self-loop (labelled only, D-04).** A dashed arc from the node's right edge 8px above centre to 8px below centre, bulging 16px into the gutter. Its label sits right of the arc.
12. **Edge label.** Sits at the curve midpoint `((sx+tx)/2, (sy+ty)/2)`, using `absolute -translate-x-1/2 -translate-y-1/2 rounded-sm bg-card px-1 text-xs text-muted-foreground whitespace-nowrap`. The 36px row gap leaves room for a 16px label.
13. **Width source.** Measure the body's content width with a `ResizeObserver`, laid out in `useLayoutEffect` so the first paint is already laid out. Re-layout on width change only; the layout never depends on render order or the clock.
14. **Marker ids are per artifact** (`{record.id}-ah`, `{record.id}-ah-hot`). Two diagrams on one page must not share a `<marker id>`.

**Never scrolls sideways (D-16).** The body has no `overflow-x`. The layout is computed to fit `bodyWidth`, and there is no internal vertical scroll either: a 25-node chain is simply tall.

**States:**

| State | What the person sees |
|---|---|
| Rest | All nodes at full opacity; edges `muted-foreground/70`; labels muted |
| Hover or focus a node | It and its neighbours: `border-primary bg-primary/10` (the hexagon's outer layer turns primary). Its edges: primary 2px with the hot marker; their labels `text-foreground`. Everything else dims: other nodes `opacity-45`, other edges `opacity-25`, other labels `opacity-30`. The source tooltip shows if the node has a source |
| Leave, blur or `Escape` | Back to rest |
| Transitions | `transition-[opacity,border-color,background-color,stroke] duration-[120ms]`, `motion-reduce:transition-none`. No entrance animation (273 UI-D-09) |
| 1 node (crafted or legacy row; the backend refuses < 2) | One node centred, no edges. Caption `1 step · no links`. Renders, never errors |
| No edges, several nodes | All nodes at rank 0, wrapped into rows. Renders |
| 25-node chain | 25 rows, about 2,000px tall, no scroll container |
| A rank wider than `perRow` | Wraps onto extra rows of the same rank |
| Light theme | Same tokens; node fill `--muted` light; edges `muted-foreground/70` light |

**Keyboard (UI-D-292-08): roving tabindex. The diagram is one tab stop.**
- `Tab` into the diagram focuses the first node in reading order (rank, then left to right), or the last focused node.
- `ArrowRight` / `ArrowDown` move to the next node in reading order; `ArrowLeft` / `ArrowUp` move to the previous one.
- `Home` / `End` jump to the first / last node.
- `Escape` hides the tooltip and clears the highlight, keeping focus.
- Focus shows the global primary ring plus the hover state above.

**Screen readers:**
- Each node: `tabIndex` (0 for the roving target, −1 for the rest), `role="img"`, and `aria-label`, for example: `{label}. {Start|End|Decision|Step}. Leads to {target label}{, "{edge label}"}; …. Comes from {source label}; ….`
- The two clauses are omitted when empty. A back edge reads `Loops back to {target label}`.
- The tooltip is linked by `aria-describedby` while shown.
- Edge paths and edge labels are `aria-hidden`; their meaning is in the node names.

**Responsive:**

| Viewport / container | Behaviour |
|---|---|
| 375px phone (body ≈ 311px) | `perRow = 3`, `nw = 93` (or 88–92 with a gutter). Labels wrap to 2–4 lines. No sideways scroll |
| Chat column (`max-w-4xl`, body ≈ 862px) | Nodes at 192px max; short rows spread with up to `nw + 96` pitch |
| Wide | Same as the chat column. The artifact is never wider than the assistant column |

### ComparisonArtifact (sketch 3A, D-05, D-17)

**Anatomy:**

```
body
├─ tools row: flex flex-wrap items-center gap-x-3 gap-y-2 mb-3
│   ├─ <button type="button" aria-pressed> Only terms that differ </button>
│   ├─ (pressed only) <span role="status"> {N} identical terms hidden </span>   text-xs text-muted-foreground
│   └─ legend: flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground
│        [✓] Favourable  [✗] Unfavourable  [–] Neutral  [?] Not stated
└─ div.overflow-x-auto (scrollbar thin)
    └─ <table class="w-full border-collapse text-xs leading-[1.4]">
        <thead><tr class="h-8 bg-popover">
          <th scope="col">Term</th>                         text-muted-foreground font-normal, sticky left-0
          <th scope="col">{option}</th> × 2–5                font-headline font-semibold text-foreground
        <tbody><tr> per term
          <th scope="row">{term}</th>                        text-muted-foreground font-normal, sticky left-0 bg-card
          <td> per option: [glyph badge] {cell text}         px-3 py-2 align-top, border-b border-border/55
```

**Verdict legend wording (UI-D-292-10). Follows the approved sketch key:**

| Verdict | Glyph | Badge | Legend / screen-reader word |
|---|---|---|---|
| `y` | lucide `Check` | solid border, emerald | `Favourable` |
| `n` | lucide `X` | solid border, rose | `Unfavourable` |
| `m` | lucide `Minus` | solid `border-border`, `text-muted-foreground`, no fill | `Neutral` |
| `q` | text `?` (10px / 600) | **dashed** `border-amber-500/40`, amber glyph | `Not stated` |

⚠ **Reconciliation, recorded rather than silently picked.** CONTEXT D-05 glosses the enum as "yes / no / partly / not stated". The operator-approved sketch's key reads "favourable / unfavourable / neutral / not stated in the document", and its data uses it that way: `90 days` notice is `n`, `3 years` is `m`. The sketch is the acceptance bar, so the visible words follow it.
- **The `show_artifact` description must define the verdicts the same way** (planner obligation): `y` = favourable for, or meets, what the user asked; `n` = unfavourable, or does not meet it; `m` = neutral or partly; `q` = not stated in what was retrieved.
- The enum literals `y | n | m | q` are unchanged.

**Glyph badge (UI-D-292-11):**
- Shape: `inline-flex size-4 shrink-0 items-center justify-center rounded-full border`.
- Icons are `size-2.5` with `strokeWidth={3}`, `aria-hidden`.
- The verdict word follows as `<span class="sr-only">`. The glyph shape plus the solid or dashed border carry the verdict; colour supports it.

**Cells:**
- Cell content: `flex items-start gap-2`, text `text-foreground whitespace-normal break-words`.
- **`q` always renders our copy `Not stated`** in `italic text-muted-foreground` (UI-D-292-12). Any text the model put on a `q` cell is not shown. A not-stated cell is never blank.
- `y` / `n` / `m` with no text render the glyph plus the verdict word in `text-muted-foreground` (e.g. `Favourable`). The cell is never blank.
- Text is never truncated. The 200-character cap (`MAX_CELL_CHARS`) bounds it.

**"Only terms that differ" (UI-D-292-13):**
- **Identical term:** every cell has the same verdict **and** the same text after `trim()` and case-folding (`q` cells compare as `Not stated`).
- Identical rows are **dimmed at rest** (sketch): the row header and cell text go `text-muted-foreground`, and glyphs keep their colours.
- **Toggle off (default):** all terms show, identical ones dimmed.
- **Toggle on:** identical rows are removed from the table, and `{N} identical term(s) hidden` appears beside the toggle (`role="status"`, polite).
- **No identical terms:** the toggle renders `disabled` (`aria-disabled`, `opacity-50`, `cursor-not-allowed`) with `title="No term is the same across every option."`.
- **All terms identical, toggle on:** the table keeps its header, and one row with `colSpan` = all columns reads `Every term is the same across these options.` in `italic text-muted-foreground py-3`.
- The toggle state is local view state. It **resets on reload** (273 rule: an identical *initial* render is the contract).
- **Toggle classes:**
  - base: `inline-flex h-8 sm:h-6 items-center gap-1 rounded-md border px-2 text-xs`;
  - unpressed: `border-border text-muted-foreground hover:text-foreground`;
  - pressed: `border-primary/45 bg-primary/15 text-foreground`.

**Hover and focus:**
- Any option cell: `hover:bg-muted/50` (the sketch's `hsl(220 30% 10%)`).
- A cell with a source shows `ArtifactTooltip` on hover or focus.

**Keyboard (UI-D-292-08): roving tabindex across option cells. The matrix is one tab stop.**
- Arrow keys move cell to cell in 2-D, skipping the term column.
- `Home` / `End` jump to the first / last cell of the row; `Ctrl+Home` / `Ctrl+End` jump to the first / last cell of the table.
- Focus shows the tooltip if the cell has a source.
- The toggle is its own tab stop before the matrix.

**Screen readers:**
- It is a real `<table>` with `scope` headers, so a reader announces the option and term for each cell.
- Glyph: sr-only verdict word. Tooltip linked by `aria-describedby` on focus.

**Responsive (UI-D-292-14).** The comparison **may** scroll sideways; the diagram may not.

| Viewport / container | Behaviour |
|---|---|
| 375px (body ≈ 311px) | 2 options fit (96 + 2 × 104 = 304px). 3–5 options scroll horizontally inside the body, with the **term column sticky** (`sticky left-0 z-[1] bg-card`; header cell `bg-popover`). The tools row wraps: toggle on its own line, legend below |
| Chat column (≈ 862px) | Up to 5 options fit without scroll (96 + 5 × 104 = 616px min). Columns share the width equally after the 24% term column |
| Wide | Same as the chat column |

- There is no internal vertical scroll and no sticky header (20 terms is the cap).
- The 273 table's 512px scroller is **not** reused, because sticky-left plus sticky-top inside one scroller breaks on iOS Safari.

**Edge cases:**

| Case | What renders |
|---|---|
| 2 options × 1 term | Full matrix, one row. Toggle disabled unless that one term is identical. If it is identical and the toggle is turned on, the all-identical row shows |
| Every cell `q` in a row | That row reads `Not stated` across, and counts as identical |
| 5 options × 20 terms | Full matrix, no vertical scroll |
| A term whose name is long (≤ 60) | Wraps in the sticky column |

### TimelineArtifact (sketch 4A, D-06, D-18)

**Model (`timelineModel.ts`, pure, `today` passed in):**

1. **Parse dates as calendar dates (UI-D-292-18).**
   - Accept `YYYY-MM-DD` (day precision) or `YYYY-MM` (month precision) from integer parts.
   - ⛔ Never `new Date(isoString)`: it parses as UTC midnight and shows the previous day west of Greenwich.
   - Day counts use UTC-noon arithmetic on the parts, so DST never shifts them.
2. **Sort** ascending by `(year, month, day ?? 0)`. The sort is stable, so equal dates keep spec order. The model's order is never trusted (D-06).
3. **Past vs upcoming:**
   - Day precision: an event is **past** when its date ≤ today, and **upcoming** when its date > today.
   - Month precision: compare months; the current month counts as past.
4. **Today row** is inserted after the last past event and before the first upcoming one:
   - at the top if every event is upcoming;
   - at the bottom if every event is past.
5. **Gap rows.** Between two consecutive events **on the same side of Today**, insert a gap row when the calendar-month difference `(y2−y1)·12 + (m2−m1)` is **≥ 6**. Gaps are never drawn across the Today row; the sketch's rule is kept (UI-D-292-17).
6. **Deadline day count.** For an upcoming or today deadline, `N = calendar days from today to the date`. For a month-precision deadline, `N` is in calendar months.

**Anatomy:**

```
<ol class="relative" aria-label="Timeline: {title}. {N} events.">
  <li class="grid grid-cols-[96px_24px_minmax(0,1fr)] gap-x-2">          ← event row
     <div class="pt-0.5 text-right font-mono text-xs tabular-nums text-muted-foreground">14 Mar 2023</div>
     <div class="relative flex justify-center" aria-hidden>  1px rail line (bg-border) full height; dot </div>
     <div class="pb-4 min-w-0">
        <div class="flex flex-wrap items-center gap-2 text-sm font-semibold">{title} [category chip] [deadline pill]</div>
        <div class="text-xs text-muted-foreground">{detail}</div>
        <div class="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground" tabIndex=0?>[FileText 12px] {document} · p.{page}</div>
     </div>
  </li>
  <li class="… gap">   date col: "{N} months" italic muted · rail: dashed 1px border · event col: min-h-5 pb-2 </li>
  <li class="… today"> date col: "Today" text-xs font-semibold accent · 8px accent dot · "{24 Oct 2026} — everything below hasn't happened yet" text-xs accent pb-3 </li>
</ol>
```

- **Rail line:**
  - a 1px `bg-border` line centred in the 24px column;
  - on the first row it starts at the dot centre (`top: 10px`), and on the last row it ends at the dot centre;
  - on a gap row it is a dashed 1px `border-l border-dashed border-border`.
- **Dots** (12px, with `ring-[3px] ring-card` so the line appears to stop at the dot):

| Event | Dot | Title colour |
|---|---|---|
| Past | filled `bg-muted-foreground` | `text-foreground` |
| Upcoming | hollow: `bg-card border-[1.5px] border-muted-foreground` | `text-muted-foreground` (sketch `.fut`) |
| Deadline, upcoming or today | hollow, `border-2` amber | `text-foreground` |
| Deadline, past | filled amber, `border-2` amber | `text-foreground` |
| Today row | 8px filled accent (`mt-1.5`) | n/a |

- **Category** uses the standard 273 chip (`h-5 rounded-full border bg-muted px-2 text-xs text-muted-foreground`). It is never coloured.
- **Source line:**
  - shown only when the event has a resolved source;
  - `FileText size-3` + `{document truncated 40} · p.{page}`;
  - focusable (`tabIndex=0`, `rounded-sm`); hover or focus shows `ArtifactTooltip` with the excerpt;
  - with no source, there is no line.
- **Date text (fixed table, no `Intl`, UI-D-292-18):**
  - day precision `14 Mar 2023`; month precision `Mar 2023`;
  - months `Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec`;
  - this is byte-identical on every machine and ICU version (some ICU builds print `Sept`).

**Deadline pill (UI-D-292-16).** Shape: `rounded-full border px-2 text-xs` (sketch `.due`).

| Case | Pill text | Style |
|---|---|---|
| Upcoming, day precision | `in {N} days` / `in 1 day` | amber |
| Today | `due today` | amber |
| Upcoming, month precision | `in {N} months` / `in 1 month` / `this month` | amber |
| Past, day precision | `passed {N} days ago` / `passed 1 day ago` | muted chip (`border-border bg-muted text-muted-foreground`) |
| Past, month precision | `passed {N} months ago` / `passed this month` | muted chip |

Numbers ≥ 1,000 use `en-US` grouping (273's pinned formatter).

**Today sentence (UI-D-292-15).** `{date}` is today in the fixed format above.

| Placement | Sentence |
|---|---|
| Between past and upcoming | `{date} — everything below hasn't happened yet` |
| Top (all upcoming) | `{date} — none of these has happened yet` |
| Bottom (all past) | `{date} — everything above has happened` |

**States and edge cases:**

| Case | What renders |
|---|---|
| Normal (sketch fixture) | 9 events + 3 gap rows + 1 Today row = 13 rows |
| Single event | That event plus the Today row above or below it. No gap rows. The rail line is trimmed at both dot centres |
| Several events on one date | One row each, each with its own date |
| A deadline exactly today | Sits on the past side (date ≤ today), with an amber hollow ring and `due today` |
| Mixed precision on one month (`2026-03` and `2026-03-14`) | The month-only event sorts first |
| 40 events | Long list; no internal scroll |
| The viewer's date changes between visits | The Today row and pills move; events, order, gaps and caption do not (D-18; this is the documented exception to "same on reload") |

- **Hover:** only source lines react, with the tooltip. Rows have no hover wash (the sketch has none; rows are not interactive).
- **Keyboard:** each source line is a plain tab stop. With ≤ 40 events this needs no roving; source lines are the only interactive elements.
- **Screen readers:**
  - The `<ol>` reads in order. Each event `<li>` begins with an sr-only state word: `Happened.`, `Upcoming.` or `Deadline.` (deadline also reads the pill).
  - The gap row reads its visible `{N} months` with an sr-only suffix ` later`.
  - The Today row reads `Today, {date}.` followed by the sentence.
  - Dots are `aria-hidden`.
- **Responsive:**
  - At 375px (body ≈ 311px) the grid stays `96 / 24 / 1fr`, which leaves the event column about 175px. Titles, chips and pills wrap.
  - Chat column and wide: same grid; the event column grows.
  - There is never sideways scroll.

### Notice and rail (D-20, sketch Screen 5: 273 rules unchanged)

The `ArtifactNotice` markup, title (`This artifact can't be shown`) and footnote (`The rest of the answer is unaffected.`) are **unchanged**. The answer text always renders.
- **In a turn, the order is:** an amber refused rail step, then the model's retry. Only if no retry succeeds does a notice appear, and only for a bad *stored* or live record that fails the frontend guard.
- ⛔ A notice never shows JSON, markup, a spec key (`nodes`, `edges`, `verdict`, `events`, `component`…), a validation path or an exception message.

**Rail rows for the new types (UI-D-292-19):**

| State | Rail essence | Expanded body |
|---|---|---|
| Diagram shown | `Flow diagram · 8 steps, 9 links` | `Flow diagram · 8 steps · 9 links · diagram 1. Shown below the answer.` |
| Comparison shown | `Comparison · 3 options × 7 terms` | `Comparison · 3 options × 7 terms · comparison 1. Shown below the answer.` |
| Timeline shown | `Timeline · 9 events` | `Timeline · 9 events · timeline 1. Shown below the answer.` |
| Refused | `refused · {reason}` (amber node, 273 UI-D-02) | `{reason}.` then `Sent back to the agent to fix.` |

- The timeline essence **does not** say how many events are upcoming. That depends on the clock, and the rail row is built from the stored tool result.
- **Planner obligation.** The `show_artifact` success result carries these plain counts: `row_count` (nodes / terms / events), plus `edge_count` for diagram and `option_count` for comparison. The rail reads only those, never the spec.

---

## Copywriting Contract

All strings live in `artifactCopy.ts` (frontend) or the `_R` table (backend rail reasons). The 273 strings are unchanged except the two widened `unknown-component` sentences.

| Element | Copy |
|---|---|
| Primary CTA | **None.** An artifact is read-only output. Its only controls are the comparison toggle `Only terms that differ`, and focus targets (nodes, cells, source lines) that reveal a source |
| Kind chips | `Flow diagram` · `Comparison` · `Timeline` |
| Label chips | `diagram {N}` · `comparison {N}` · `timeline {N}` (server-assigned, D-13) |
| Diagram counts | `{N} steps` / `1 step` · `{M} links` / `1 link` / `no links` |
| Diagram aria-label | `Flow diagram: {title}. {N} steps, {M} links.` |
| Node kind words (aria) | `Start` · `End` · `Decision` · `Step` |
| Node relations (aria) | `Leads to {label}` · `, "{edge label}"` · `Comes from {label}` · `Loops back to {label}` |
| Comparison legend | `Favourable` · `Unfavourable` · `Neutral` · `Not stated` |
| Comparison header | `Term` |
| Not-stated cell | `Not stated` (italic) |
| Toggle | `Only terms that differ` |
| Toggle disabled title | `No term is the same across every option.` |
| Hidden count | `{N} identical terms hidden` / `1 identical term hidden` |
| All identical (toggle on) | `Every term is the same across these options.` |
| Comparison counts | `{O} options × {T} terms` / `1 term` |
| Caption second line | `Verdicts are the agent's reading. Hover or focus a cell for its clause.` · without sources: `Verdicts are the agent's reading.` |
| Timeline counts | `{N} events` / `1 event` |
| Timeline aria-label | `Timeline: {title}. {N} events.` |
| Today label | `Today` |
| Today sentence | `{date} — everything below hasn't happened yet` · `{date} — none of these has happened yet` · `{date} — everything above has happened` |
| Deadline pill | `in {N} days` · `in 1 day` · `due today` · `in {N} months` · `in 1 month` · `this month` · `passed {N} days ago` · `passed 1 day ago` · `passed {N} months ago` · `passed this month` |
| Gap label | `{N} months` (sr-only suffix ` later`) |
| Event state (sr-only) | `Happened.` · `Upcoming.` · `Deadline.` |
| Tooltip | header `{document} · p.{page}`; excerpt in `“…”`, max 280 chars + `…` |
| Caption, no source | `Values provided by the agent · no source document in this turn · {count segment}` (273 wording) |
| Empty state | Not applicable. An empty diagram, comparison or timeline is refused before it renders. A crafted empty stored row shows the `no-items` notice |
| Destructive confirmation | None. This phase has no destructive action |

### Notice reason catalogue, additions (frontend `NoticeReason`, closed)

**Allowed interpolations:**
- a component noun from the six;
- an item word from the closed map `diagram → steps / links`, `comparison → terms / options`, `timeline → events`;
- a number;
- an alias from a closed alias table;
- a data value (node id, term name, date string) as text, truncated at 40 characters.

Nothing else.

| Code | Reason sentence |
|---|---|
| `unknown-component` (alias, UI-D-292-21) | `it asked for a {mind map}, which isn't one of the artifact types we can show.` |
| `unknown-component` (anything else; **widened**) | `it asked for something other than a chart, table, metric, diagram, comparison or timeline.` |
| `too-many-items` | `it has more {steps} than a {diagram} can show (max {25}).` (also `links` / 40, `terms` / 20, `events` / 40) |
| `wrong-option-count` | `it has {N} options; a comparison shows 2 to 5.` |
| `no-items` | `it has no {steps} to show.` (`terms`, `events`) |
| `broken-link` | `its saved data links to a step that isn't in it ({id}). Ask the agent to draw it again.` (sketch Screen 5) |
| `ragged-term` | `its saved data has a term with the wrong number of cells ({term}). Ask the agent to draw it again.` |
| `bad-date` | `its saved data has a date we can't read ({date}). Ask the agent to draw it again.` |
| `invalid-settings` (reused, noun widened) | `its saved settings don't match what a {diagram} needs. Ask the agent to draw it again.` Covers duplicate node ids, an unlabelled self-loop, an unknown node kind or verdict, a malformed source or a string over its cap |
| `render-failed` (reused) | `something went wrong while drawing it. Reload the page to try again.` |

### Component alias table (UI-D-292-21, closed; the only model-adjacent words a component refusal may print)

| Key (matched trimmed, case-insensitive, via `own()`) | Words |
|---|---|
| `mindmap`, `mind_map` | `mind map` |
| `gantt` | `Gantt chart` |
| `sankey` | `Sankey diagram` |
| `map` | `map` |
| `image` | `image` |
| `html` | `web page` |
| `code` | `code block` |
| `kanban` | `board` |
| `steps` | `step list` |
| `pie`, `donut` (as a component) | `pie chart`, `donut chart` |

**Not aliased:** `flowchart`, `graph` and `gantt_chart` fall to the generic sentence. The notice would otherwise say "a flowchart isn't a type we can show" while we do show flow diagrams.

### Rail refusal reasons, additions (backend `_R`, short form, people-facing)

| Key | Reason |
|---|---|
| `unknown_component` (**widened**) | `something other than a chart, table, metric, diagram, comparison or timeline` |
| `component_alias` | `"{key}" is not an artifact type` (the alias **key**, never the raw model string; sketch Screen 5) |
| `too_many_nodes` | `{n} steps (max 25); group related steps first` (sketch Screen 5) |
| `too_few_nodes` | `a diagram needs at least 2 steps` |
| `too_many_edges` | `{n} links (max 40); group related steps first` |
| `no_edges` | `a diagram needs at least 1 link` |
| `unknown_node` | `a link names a step that isn't in it ({id})` |
| `duplicate_node` | `two steps share an id` |
| `duplicate_edge` | `two links join the same two steps` (UI-D-292-27: they would draw on top of each other) |
| `self_loop_unlabelled` | `a step links to itself without a label` |
| `node_label_too_long` | `a step name is over 48 characters` |
| `edge_label_too_long` | `a link label is over 24 characters` |
| `option_count` | `{n} options (2 to 5)` |
| `too_many_terms` | `{n} terms (max 20)` |
| `ragged_term` | `term {i} has {got} cells for {n} options` |
| `option_too_long` / `term_too_long` | `an option name is over 40 characters` / `a term name is over 60 characters` |
| `too_many_events` | `{n} events (max 40)` |
| `bad_date` | `event {i} has a date that isn't YYYY-MM-DD or YYYY-MM` |
| `event_text_too_long` | `an event title is over 80 characters` / `an event detail is over 200 characters` / `a category is over 24 characters` |
| `unresolved_source` | `a source it cites wasn't retrieved in this turn` |
| `reference_new_type` | `{label} can't be redrawn by reference; send the data again` (D-08) |
| `reference_into_new_type` | `a {table} can't be turned into a {comparison}; send the data again` (D-08) |

- The list of the six valid types goes in the **model-facing** `detail`, never in the people-facing `reason` (UI-D-292-21). The rail stays one short line, as in 273.
- `{id}` and `{label}` follow 273's `_safe_name` rule: ≤ 40 characters shown, never markup.

---

## Interaction & State Contract (all three)

| State | What the person sees |
|---|---|
| Live arrival | The card renders when the `artifact` SSE event arrives, below the still-streaming text (273). No skeleton |
| Loading | Not applicable (eager components). See UI-D-292-26 for the lazy fallback |
| Reload | Same persisted spec, same component, same layout at the same width (I-2). The only thing that differs is the timeline's Today row and pills when the date has changed |
| Ephemeral view state | The comparison toggle, the diagram highlight and the open tooltip reset on reload |
| Frontend guard fails | `ArtifactNotice` with one catalogue reason; the rest of the message renders |
| Renderer throws | The per-artifact error boundary shows the `render-failed` notice |
| Theme switch | Re-renders with the same tokens; no layout change |
| Reduced motion | The 120ms highlight transitions are off |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none new (existing `components/ui/*` untouched) | not required |
| Third-party | none | not applicable |

There is no new npm dependency (D-19): no Mermaid, dagre, elkjs, d3 or zod. `lucide-react` is already installed and supplies `Check`, `X` and `Minus`.

---

## G-4 observables ("I'd recognize failure here")

Chrome MCP drives each scenario at verification and asserts **rendered content**, not element presence (the Phase 235 presence-assertion trap). Each scenario runs at **375px**, the default chat column and a wide window.

**G4-1 Diagram** (D-21: "How does our invoice approval work?" against a real KB document):

| Assert | How |
|---|---|
| Kind chip reads `Flow diagram`; label chip matches `diagram \d+` | `textContent` |
| Every node label appears in the retrieved document text (not invented), and no label is clamped at 375px | Compare node `textContent` against the retrieved chunks; `scrollHeight <= clientHeight` per node |
| **No node overlaps another** | Pairwise `getBoundingClientRect()` intersection = 0, at all three widths |
| **No sideways scroll** at 375px | The diagram body and the page have `scrollWidth <= clientWidth` |
| Hovering, and separately focusing, a node lights exactly its edges | The count of highlighted paths equals the node's degree; the others are at opacity 0.25 |
| The tooltip names a document that was retrieved this turn, and its excerpt is a substring of that chunk | Text compare against the `search_documents` result |
| Back edges are dashed | The dashed path count equals the DFS back-edge count of the stored spec |
| Arrows point from `from` to `to` | Marker on `marker-end`, path starting at the source node |
| Caption ends `· {N} steps · {M} links` | `textContent` |

*Failure looks like:* nodes overlapping or clipped, a sideways scrollbar on a phone, a label that stops mid-word, a hover that lights nothing, a tooltip naming a file the agent never retrieved.

**G4-2 Comparison** (D-22: "Compare these two contracts on termination, liability and renewal."):

| Assert | How |
|---|---|
| Kind chip `Comparison`; every option cell holds **exactly one** glyph badge whose sr-only word is one of the four | DOM count and text |
| **No blank cell** | Every `td` `textContent.trim()` is non-empty |
| ≥ 1 `Not stated` cell, rendered italic | `textContent` + `getComputedStyle(...).fontStyle === "italic"` |
| The toggle hides exactly the identical rows | Row count drops by N, `aria-pressed="true"`, and `{N} identical terms hidden` reads the same N; N is independently computed from the stored spec |
| The second caption line reads exactly `Verdicts are the agent's reading. Hover or focus a cell for its clause.` | `textContent` |
| Hover or focus a sourced cell → its clause tooltip | Text compare against the retrieved chunk |
| At 375px with 3+ options, the term column stays visible while scrolling | Scroll the body; the term column's `getBoundingClientRect().left` is unchanged |

*Failure looks like:* a blank cell where a term was missing, a verdict shown only by colour, a toggle that changes nothing, a clause the documents do not contain.

**G4-3 Timeline** (D-23: "Show the history and upcoming deadlines of this contract."):

| Assert | How |
|---|---|
| Kind chip `Timeline`; events sorted ascending whatever order the model sent | Compare the rendered dates with a sort of the stored spec |
| **Exactly one** Today row, reading today's date in `D Mon YYYY` | `textContent` vs the test machine's local date |
| Every event above Today has a filled dot; every one below is hollow | Computed `background-color` (card colour = hollow) |
| The deadline has an amber ring and `in N days`, where N equals an independently computed day count | Computed `border-color`, `textContent` |
| Gap rows appear exactly where consecutive same-side events are ≥ 6 months apart, labelled with the month count | Compute from the spec and compare |
| No date shows a day earlier than the spec (timezone trap) | Run once with the browser in a negative-UTC timezone (`America/Los_Angeles`) |

*Failure looks like:* the Today line missing or in the wrong place, every dot the same, a deadline with no day count, a date off by one.

**G4-4 Unknown type refused** (D-24):
- The rail shows an amber step `refused · "mindmap" is not an artifact type`, or the generic sentence for a non-alias.
- A crafted bad stored row shows only `artifact-notice` with a catalogue reason.
- The page text, the rail's expanded body and the parameters area contain no `{"`, `}`, `nodes`, `edges`, `verdict`, `events` or `component`.

**G4-5 Reload identical** (D-25):
- Reload each thread above, on **at least two native providers**.
- Each card's `textContent` and screenshot match before and after, at the same viewport and on the same date.
- Captions and label chips are byte-identical.

---

## Decisions made by this spec (autonomous; operator may override at G-4)

| ID | Decision | Why |
|---|---|---|
| UI-D-292-01 | The three new bodies sit in the **unchanged** 273 frame. The label chip stays in the caption footer (shipped), not in the header (sketch drawing) | The sketch reused the frame "unchanged"; the shipped frame is the contract, and a second chip position would split the family |
| UI-D-292-02 | Kind chips `Flow diagram` / `Comparison` / `Timeline` | Sketch chip text verbatim |
| UI-D-292-03 | Sketch sizes and weights normalised to 12 / 14 and 400 / 600; mono kept for timeline dates | 273 UI-D-10 rule; tabular right-aligned dates are a sketch feature |
| UI-D-292-04 | Node kinds `step` (default) · `decision` · `start` · `end`; no `actor`. Shape carries the kind | These four are the sketch's shapes; owners-by-lane (2B) lost, so `actor` would have no visual |
| UI-D-292-05 | Deterministic layout: DFS back edges, longest-path ranks, spec order within a rank, row wrap at 88px min width, a 48px back-edge gutter, the spread formula above | It reproduces 2A, fits 375px without overlap (the sketch's `W·(i+1)/(k+1)` placement overlaps at 3 nodes in 311px), and keeps live = reload |
| UI-D-292-06 | Node height grows by line estimate (44 → 92px), with a 4-line clamp backstop | Fixed 42px nodes clamp real labels at phone width; an estimate keeps the layout a pure function with no measure pass |
| UI-D-292-07 | Nodes are positioned HTML over one SVG edge layer | SVG text cannot wrap; both layers are React elements without innerHTML, which is what D-16 forbids |
| UI-D-292-08 | Roving tabindex for diagram nodes and comparison cells; focus behaves like hover | Hover-only source info must be keyboard-reachable without 25–100 tab stops |
| UI-D-292-09 | One shared tooltip, anchored to the element, Escape to dismiss, portalled | Deterministic for mouse, keyboard and touch; the card's `overflow-hidden` would clip it otherwise |
| UI-D-292-10 | The legend reads `Favourable / Unfavourable / Neutral / Not stated`, following the approved sketch. The tool description must define the verdicts the same way | It reconciles CONTEXT D-05's "yes / no / partly" gloss with the sketch's key and data; flagged to the planner |
| UI-D-292-11 | lucide `Check` / `X` / `Minus` plus a text `?` in a 16px badge; solid vs dashed border | Unicode ✓ ✗ render inconsistently across platform fonts; lucide is the project's icon set |
| UI-D-292-12 | A `q` cell always reads our `Not stated`; model text on it is not shown | D-05 "never a blank", and the model cannot dress up an absence |
| UI-D-292-13 | Identical = same verdict and same normalised text. Rows are dimmed at rest; the toggle is disabled when no term is identical; a hidden count shows; an all-identical message shows | It makes the toggle's effect visible and never leaves an empty table |
| UI-D-292-14 | The comparison may scroll sideways inside its body with a sticky term column. Column minimums 96 / 104px fit 2 options at 375px | Only the diagram is locked to "never scrolls" (D-16); 5 options cannot fit 311px legibly |
| UI-D-292-15 | Past = date ≤ today. The Today row sits between past and upcoming, with three sentence variants | The sketch had only the mixed case; the edges need words |
| UI-D-292-16 | Deadline pill covers upcoming, today, month-precision and past variants. A past deadline gets a muted pill and a filled amber dot | A missed deadline must still read as one, in words |
| UI-D-292-17 | A gap needs ≥ 6 calendar months between consecutive events on the same side of Today; it is never drawn across Today | It keeps the sketch's rule (its code skipped the gap that straddles Today) |
| UI-D-292-18 | Dates parsed from integer parts, a fixed English month table, UTC-noon day maths, no `new Date(iso)` and no `Intl` for dates | Avoids the off-by-one-day timezone trap and ICU `Sept` drift; live and reload stay identical |
| UI-D-292-19 | Rail essence has no "upcoming" count; the tool result carries `edge_count` / `option_count` | The sketch's `2 upcoming` depends on the clock; the rail reads plain result facts only (273 L-3) |
| UI-D-292-20 | The caption count segment is phrased per component; a second caption line is comparison-only | D-17; 273 grammar kept |
| UI-D-292-21 | A closed component alias table drives refusals; the people-facing rail reason stays short and the six-type list goes in the model-facing detail | The sketch's refusal echoed `mindmap`, which is only safe from a closed table (273 rule) |
| UI-D-292-22 | Accent widened to three named uses (diagram highlight, pressed toggle, Today); amber widened to the not-stated badge and deadline | Sketch-locked visuals; every use is named so nothing else drifts to accent |
| UI-D-292-23 | Light-theme Today uses `indigo-600` | Light `--primary` measures 4.46:1 on white, under 4.5:1 for 12px text; `indigo-600` measures 6.26:1 |
| UI-D-292-24 | Display caps: node label 48, edge label 24, option 40, term 60, cell 200, event title 80, detail 200, category 24, excerpt shown 280 | They are what the layouts above can hold at 375px; the backend refuses above them (worded) |
| UI-D-292-25 | Only 120ms highlight transitions; no entrance animation; `motion-reduce` off | 273 UI-D-09 (screenshot parity live vs reload) |
| UI-D-292-26 | The three renderers load eagerly; a forced lazy load uses the existing busy body | Plain DOM/SVG with no heavy library; avoids a reload flash |
| UI-D-292-27 | Duplicate `from→to` edges are refused (`two links join the same two steps`); marker ids are per artifact | Duplicates would draw on top of each other invisibly; shared marker ids break on a page with two diagrams |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: FLAG (non-blocking; the offsets are listed under Exceptions)
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-10-24 (gsd-ui-checker, revision 0)
