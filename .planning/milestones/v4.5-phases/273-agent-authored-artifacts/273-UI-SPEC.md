---
phase: 273
slug: agent-authored-artifacts
status: approved
reviewed_at: 2026-10-03
shadcn_initialized: true
preset: "style default · baseColor slate · cssVariables · iconLibrary lucide (frontend/components.json) — Aether Intelligence / Deep Midnight tokens in frontend/src/index.css"
created: 2026-10-03
acceptance_bar: "sketch 273 winners (operator 2026-10-03): 1B framed card · 2A one metric tile · 3A lineage caption · 4B explicit notice + live render"
mode: auto (operator unavailable; sketch 273 + 273-CONTEXT D-01..D-21 treated as LOCKED; every other choice is a documented default, listed under "Decisions made by this spec")
---

# Phase 273 — UI Design Contract

> The visual and interaction contract for agent-authored artifacts (chart · table · metric) in the chat.
> Created by gsd-ui-researcher; the checker verifies it.
>
> **Sources, in priority order:** `273-CONTEXT.md` (D-01..D-21, I-1..I-5, locked) → sketch 273
> (`.claude/skills/sketch-findings-agentic-rag/references/agent-authored-artifacts.md` + `sources/273-agent-authored-artifacts/`,
> approved, **this is the acceptance bar**) → `references/chat-tool-card-unification.md` (rail + build-once inventory)
> → the shipped tokens in `frontend/src/index.css` / `frontend/tailwind.config.js` → defaults set here.
>
> **The behaviour contract** (Pydantic validation, by-reference re-encode, the 500-row refusal, persistence,
> history rewriting) lives in `273-CONTEXT.md` and is **not** repeated. This file covers only what a person
> sees and touches, plus the backend fields that UI copy depends on.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialized — `frontend/components.json`) |
| Preset | `style: default`, `baseColor: slate`, `cssVariables: true`, `iconLibrary: lucide`. Tokens overridden by the Aether Intelligence / Deep Midnight theme in `frontend/src/index.css` (`:root` light, `.dark` default product theme) |
| Component library | Radix (via shadcn `components/ui/*`). **This phase adds no shadcn component.** The frame, legend, table and notice are plain semantic elements (`<figure>`, `<button>`, `<table>`) |
| Chart library | `recharts ^3.8.1`, already a dependency (`frontend/package.json:45`). **No new dependency.** Chart code is **lazy-loaded** (`React.lazy`) so recharts stays out of the main split (`FoundPerWeekSparkline.tsx:3` precedent) |
| Icon library | `lucide-react` (`FileText`, `Info`, `Ban`, `ArrowUp`/`ArrowDown` are **not** used for sort, see Table) |
| Font | Inter (body / UI: `font-sans`), Manrope (headings + metric value: `font-headline`), JetBrains Mono (only in the existing tool rail, unchanged) |
| Theme | Deep Midnight (`.dark`) is the product theme and the acceptance bar. Light (`:root`) must work with the same token names. **No hardcoded hex for chrome**; only the four data-viz slots below are hex |

---

## Spacing Scale

Declared values (all multiples of 4):

| Token | Value | Tailwind | Usage in this phase |
|-------|-------|----------|---------------------|
| xs | 4px | `gap-1`, `gap-y-1` | Caption segment gaps, legend row gap, icon-to-text in chips |
| sm | 8px | `gap-2`, `py-2`, `px-2` | Header gap (title ↔ chip), legend column gap, caption vertical padding, tooltip vertical padding, legend toggle horizontal padding, body bottom padding |
| sm+ | 12px | `pt-3`, `px-3`, `gap-3` | Card body top padding, gap between consecutive artifacts, table cell horizontal padding, tooltip horizontal padding |
| md | 16px | `px-4`, `mt-4` | Card horizontal padding (header, body, caption), space between the answer text and the first artifact |
| lg | 24px | `h-6` | Legend toggle height (touch target, see Exceptions) |
| xl | 32px | `h-8` | Table row height and table header height |
| 2xl | 48px | — | Chart left margin (room for y ticks) |
| 3xl | 64px | — | Not used in this phase |

**Fixed dimensions (multiples of 4):**

| Element | Value |
|---|---|
| Card header min height | 40px (`min-h-10`) |
| Plot height, every chart kind | **240px**, fixed (so a lazy chunk or a reload never shifts layout) |
| Chart margins (recharts `margin`) | top 12 · right 16 (72 for `line` with direct labels) · bottom 4 · left 0, with a 48px y-axis width |
| Table max height before scrolling | **512px** = 15 rows × 32px + 32px sticky header (D-13 "about 15 rows") |
| Table cell max width | 320px, then truncate with the full text in `title` |
| Tooltip min width | 128px |
| Direct-label minimum separation | 16px (de-collision; sketch said ≥13px, rounded up to the grid) |

**Exceptions:**

- **12px (`sm+`)**: sketch 273's 10/14px card padding normalised to 12/16; `gap-3` matches the existing tool-card rhythm. The 72px line-chart right margin and 40px header min-height are fixed dimensions on the 4px grid, not spacing tokens.
- **Visual anchors:** chart → the plot, then the legend; table → the header row and first rows; metric → the value; the caption is deliberately recessive in every component.
- **Data-viz mark specs are not spacing tokens** and keep the sketch values: 2px line stroke, 2px gap between bars and between stacked segments, 4px rounded bar tops, 2px surface-coloured ring on dots and hover markers, dot radius 5, hover marker radius 4.5, scatter hover ring radius 7.
- **Legend toggles are 24px tall**, under the 44px touch guideline, by decision: they sit in a dense legend row and the same toggle is reachable by keyboard. On viewports narrower than 640px the toggle height becomes 32px (`h-8 sm:h-6`).
- The 1px hairlines (header bottom, caption top, row separators) are borders, not spacing.

---

## Typography

Exactly **3 sizes** and **2 weights** for everything this phase renders. The answer prose around the artifact is **unchanged** (it stays `text-sm leading-relaxed`, `MarkdownRenderer.tsx:29`).

| Role | Size | Weight | Line height | Font | Used for |
|------|------|--------|-------------|------|----------|
| Label | 12px (`text-xs`) | 400 | 1.4 (`leading-[1.4]`) | Inter | Kind chip, `chart N` chip, caption, legend toggles, axis ticks, direct labels, tooltip, table header + cells, metric label, metric delta, notice footnote, "all series hidden" message |
| Body | 14px (`text-sm`) | 400 | 1.5 | Inter | Notice reason line, metric unit |
| Heading | 14px (`text-sm`) | 600 | 1.4 | Manrope (`font-headline`) | Card title, notice title |
| Display | 28px (`text-[28px]`) | 600 | 1.2 | Manrope (`font-headline`) | Metric value only |

Rules:
- **Every number renders with `tabular-nums`**: tooltip values, table numeric cells, metric value, delta, axis ticks.
- The sketch's 11 / 11.5 / 12.5 / 13 / 13.5 / 26px sizes and 500 / 700 weights are **normalised** to the scale above (11–12.5 → 12, 13–13.5 → 14, 26 → 28; 500 → 400, 700 → 600). Hierarchy is carried by colour and position, not extra weights.
- Card title clamps to 2 lines (`line-clamp-2`). Chips never wrap (`whitespace-nowrap shrink-0`).

---

## Color

Token names are the contract; resolved values are Deep Midnight (`.dark`), with the light value for reference.

| Role | Token (dark → light) | Usage |
|------|----------------------|-------|
| Dominant (60%) | `--background` `hsl(216 45% 4%)` #060a0f → `hsl(220 20% 97%)` | The chat page around the artifact (unchanged) |
| Secondary (30%) | `--card` `hsl(220 30% 7%)` **= #0d1017** → `#ffffff` | The artifact card surface **and** the chart plot surface. ⭐ Measured: sketch 273's `--surface: #0d1017` is exactly `--card` in `.dark`, so the validated palette was validated against this token |
| Secondary, raised | `--popover` `hsl(220 30% 8%)` → `#ffffff` | Tooltip background, sticky table header background |
| Secondary, quiet | `--muted` `hsl(220 30% 11%)` | Chip background; row hover wash at 50% (`hover:bg-muted/50`) |
| Borders | `--border` `hsl(220 20% 16%)` | Card border (1px), hairlines at 55% (`border-border/55`), grid lines (horizontal only), tooltip border |
| Text | `--foreground` / `--muted-foreground` (`220 16% 65%`, ≈7.7:1 on card) | Title + values in foreground; caption, ticks, chips, labels, units in muted |
| Accent (10%) | `--primary` `hsl(239 100% 82%)` → `hsl(239 84% 67%)` | **Reserved list below only** |
| Warning | `--warning` `hsl(38 92% 60%)` (dark); light uses `amber-700` text / `amber-600` node | **Refused `show_artifact` rail steps only** (node, step number, essence text) |
| Destructive | `--destructive` | **Not used in this phase.** The "can't be shown" notice is neutral and dashed, never red. There are no destructive actions |

**Accent (`--primary`) is reserved for exactly:**
1. The global keyboard focus ring (already global, `index.css` `:where(...):focus-visible`), on legend toggles and table sort buttons.
2. The sort arrow of the **currently sorted** table column (`aria-sort` ascending/descending). Unsorted columns show a muted `↕`.

Nothing else in an artifact uses `--primary`: not the card border, not the chips, not the first data series, not hover states.

### Data-viz categorical palette (data colour, not UI accent)

| Slot | Hex | Contrast on `--card` dark (#0d1017) | Contrast on `--card` light (#ffffff) |
|---|---|---|---|
| 1 | `#3987e5` | 5.23:1 | 3.64:1 |
| 2 | `#d95926` | 4.90:1 | 3.88:1 |
| 3 | `#199e70` | 5.59:1 | 3.41:1 |
| 4 | `#c98500` | 6.20:1 | 3.07:1 |

- Validated by the sketch with `validate_palette.js --mode dark --surface #0d1017`: all checks pass (worst adjacent CVD ΔE 8.4, normal-vision 19.8). The light-column ratios were **measured for this spec** (WCAG relative luminance): every slot clears the 3:1 graphical-object floor (1.4.11), so **one palette serves both themes** and colour never changes with the theme.
- Declare them once as CSS variables `--chart-1..--chart-4` (same value in `:root` and `.dark`) in `index.css`. Components read `var(--chart-N)`, never a literal hex.
- **Colour follows the entity, never its rank or survival.** A series takes the slot of its position in the artifact's **full** series list. Hiding a legend entry or filtering rows never repaints the survivors. ⚠ **A by-reference follow-up inherits its source's series order**, so "EMEA" stays slot 2 from chart 1 to chart 3. The stored artifact must carry that order (a planner obligation, see UI-D-07).
- **Series caps (UI-D-01):** `line`, `bar`, `area` allow at most **4** series (four validated slots); `scatter` allows at most **3** (sketch, all-pairs rule). Above the cap, the backend **refuses** the call to the model (`refused · 6 series (max 4)`); the UI never cycles or invents a fifth colour.
- Text is **never** drawn in a series colour. Direct labels, tooltip names and legend names use the ink tokens; colour appears only in marks and swatches.
- Metric delta colour is **secondary** to its glyph and words: up `text-emerald-700 dark:text-emerald-400`, down `text-rose-600 dark:text-rose-400`, no change `text-muted-foreground`. Only the glyph + percentage span is coloured; the comparison text stays muted. (Light shades measured: emerald-700 5.48:1, rose-600 4.70:1 on white.)

---

## Component Contract

### Inventory (new files; names are recommendations, the shape is binding)

| Unit | Renders | Notes |
|---|---|---|
| `ArtifactBlock` | the **one** mount in `MessageItem.tsx` (D-16): the list of a message's artifacts in emission order | Validates each spec through the registry; anything that fails becomes `ArtifactNotice`. Never throws to the message |
| `ArtifactFrame` | the framed card: header (title + kind chip), body slot, caption footer | Shared by all three components; the **only** place the frame markup lives |
| `artifactRegistry` | closed map `chart` / `table` / `metric` → component (I-1) | Exactly three entries. A lookup miss → notice. Read with an own-property check, never a coalesced bracket read (the prototype-key sink documented in `lib/toolNames.ts`) |
| `ChartArtifact` (lazy) | recharts `line` / `bar` / `area` / `scatter` | The only recharts importer in this phase |
| `TableArtifact` | sortable table | No recharts |
| `MetricArtifact` | one value block | No recharts |
| `ArtifactNotice` | "This artifact can't be shown" | Also the error boundary fallback for each artifact |
| `artifactCopy.ts` | **every** user-visible string in this spec | One home, so a fence can pin the copy and no component re-types it |
| `ShowArtifactBody` + `summarize` | the rail's expanded body and essence for `show_artifact` | Registered in `tool-bodies/index.ts` (`TOOL_BODIES` / `TOOL_SUMMARIES`) |

### Placement and order (D-10)

- `ArtifactBlock` mounts **directly after the answer body** (`MessageItem.tsx`, after the content `div` at ~:690), **before** `RunTerminalStatus`, the live "Working… / Thinking…" indicators, `FinalOutputsPanel` and the reload `SeamCard`s.
- Container: `mt-4 flex flex-col gap-3`. Each card is full width of the assistant content column (`w-full`, inside `max-w-4xl`).
- Order = emission order (the order of `artifact` events / persisted sequence), identical live and on reload.
- No placeholder appears inside the streamed text.

### ArtifactFrame (sketch 1B, locked)

```
<figure data-testid="artifact-block" data-artifact-id=… data-component="chart|table|metric"
        aria-labelledby="{id}-title"
        class="rounded-xl border border-border bg-card overflow-hidden">
  <div class="flex items-center gap-2 px-4 py-2 min-h-10 border-b border-border/55">       ← header
    <div id="{id}-title" class="flex-1 min-w-0 font-headline text-sm font-semibold text-foreground line-clamp-2">{title}</div>
    <span data-testid="artifact-kind-chip" class="chip">{kind label}</span>
  </div>
  <div class="px-4 pt-3 pb-2">{component body}</div>                                          ← body
  <figcaption data-testid="artifact-caption"
       class="flex flex-wrap items-center gap-x-1 gap-y-1 px-4 py-2 border-t border-border/55 text-xs text-muted-foreground">
    <span data-testid="artifact-label-chip" class="chip">{chart N}</span>
    <FileText|Info class="size-3 shrink-0" aria-hidden/> {caption segments}
  </figcaption>
</figure>
```

- `chip` = `inline-flex items-center h-5 px-2 rounded-full border border-border bg-muted text-xs text-muted-foreground whitespace-nowrap`.
- Radius: `rounded-xl` (12px, the sketch's 12px; matches `--radius` scale + 2).
- No shadow, no gradient, no hover state on the card itself. The card is not clickable.
- **No entrance animation** and **no chart animation** (`isAnimationActive={false}` on every series). Live and reload must be pixel-identical for the G4-2 screenshot comparison, and a fade or grow animation would make a mid-animation screenshot differ.

**Kind chip labels** (closed set, from `artifactCopy.ts`):

| Spec | Chip |
|---|---|
| chart `line` | `Line chart` |
| chart `bar`, grouped, or stacked with 1 series | `Bar chart` |
| chart `bar`, stacked, 2+ series | `Stacked bar chart` |
| chart `area`, 1 series | `Area chart` |
| chart `area`, 2+ series (always stacked) | `Stacked area chart` |
| chart `scatter` | `Scatter chart` |
| table | `Table` |
| metric | `Metric` |

The chip never shows `show_artifact`, a spec key or a kind token.

### Caption (D-04 + sketch 3A, locked wording)

The caption is **server-derived**; the UI renders segments the server provides and never composes them from model text. Segment grammar, joined with ` · `:

```
[label chip] [icon] [lineage segments…] [source segments…] {N} rows
```

| Situation | Rendered caption (after the label chip) |
|---|---|
| First emission, a data-bearing tool ran this turn | `Data: query_tables · Quarterly_Report_FY25.pdf p.4 · 16 rows` (icon `FileText`) |
| Several data-bearing tools ran | `Data: query_documents · tickets_FY25.xlsx → execute_code · 12 rows` (tools in call order, joined with ` → `; at most 3 named, then `+N more`) |
| No data-bearing tool ran this turn | `Values provided by the agent · no source document in this turn · 5 rows` (icon `Info`, UI-D-05) |
| Follow-up, row set unchanged (re-encode, kind change, column selection, sort only) | `Redrawn from chart 1 · same 16 rows · Data: query_tables · Quarterly_Report_FY25.pdf p.4 · 16 rows` |
| Follow-up, rows narrowed (filter or top-N) | `From chart 1 · filtered to quarter = Q3 · 4 of 16 rows · Data: query_tables · Quarterly_Report_FY25.pdf p.4 · 4 rows` |
| Metric with no attached rows | the row-count segment is omitted |

Operation phrases (closed set, D-07): `filtered to {column} = {value}` · `filtered to {column} in {v1}, {v2}` (at most 3 values, then `+N more`) · `filtered to {column} {min}–{max}` · `top {N} by {column}` · `sorted by {column}, high to low` / `low to high` · `columns: {c1}, {c2}`. Several operations join with ` · ` in the order filter → top-N → sort → columns.

- **Lineage names the immediate parent** (`From chart 2`), and `M of N rows` counts against that parent. The `Data:` tail is inherited from the root.
- Tool names stay as ids (`query_tables`) because D-04 and the approved sketch both spell them that way; it is the audit line. Document names and page are plain text.
- Values inside the caption that came from data (column names, filter values, file names) are rendered as **text**, truncated at 40 characters with an ellipsis.

**The `chart N` label (UI-D-03):** every artifact shows its label chip, root or follow-up. The noun follows the component (`chart 3`, `table 1`, `metric 2`), numbered per component in creation order within the thread. The number is **assigned and stored by the server at creation**, never computed from render order, so a refused or unrenderable artifact cannot renumber the rest on reload. The model-facing tool result should name the label next to the id (I-3), so "make chart 2 a table" resolves.

### ChartArtifact (sketch Screen 2, locked)

| Aspect | Contract |
|---|---|
| Kinds | `line`, `bar` (grouped / stacked), `area` (always stacked), `scatter`. No pie (D-05) |
| Layout | Legend row (only for 2+ series), then the 240px plot. `ResponsiveContainer width="100%" height={240}` |
| Axes | **One y-axis, always.** Ticks 12px `fill: hsl(var(--muted-foreground))`, no axis lines, no tick lines. About 4 steps (`tickCount={5}`, nice). Tick text uses compact notation (`Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 })`). X ticks thin with `minTickGap={16}` |
| Domain | `bar` and `area`: y starts at 0 (mandatory). `line` and `scatter`: nice auto domain. Hiding a series recomputes the domain from the visible series |
| Grid | `CartesianGrid vertical={false} stroke="hsl(var(--border))"`, solid, horizontal only |
| Line | `type="linear"`, `strokeWidth={2}`, round joins and caps, `dot={false}`, `activeDot={{ r: 4.5, stroke: "hsl(var(--card))", strokeWidth: 2 }}` |
| Bar | `barCategoryGap="28%"`, `barGap={2}`, `radius={[4,4,0,0]}` on grouped bars and on the **top-most visible** stacked segment only; a 2px card-coloured separation between stacked segments |
| Area | Always stacked, `type="linear"`, `fillOpacity={0.85}`, 2px `hsl(var(--card))` edge |
| Scatter | Dots r=5 with a 2px card ring; at most 3 series. Axis titles from the spec's column labels: y title top-left above the plot, x title right-aligned under the x ticks (12px muted) |
| Direct labels | `line` with 2–4 series and container width ≥ 480px only: series name at each line's right end, 12px `fill: hsl(var(--muted-foreground))` (never the series colour), de-collided to ≥16px apart |
| Single series | No legend (the title names it); the tooltip names the series in words |
| Hover (SC#1) | `line` / `area`: dashed crosshair (`stroke: hsl(var(--muted-foreground))`, `strokeDasharray: "3 3"`) + tooltip listing every **visible** series at that x, **sorted by value, high first**; stacked forms add a **Total** row under a hairline. `bar`: band highlight (`fill: hsl(var(--accent) / 0.5)`) + band tooltip. `scatter`: nearest-point ring (r=7, 1.5px foreground stroke) + tooltip with the series name, then `{x label}: {value}` and `{y label}: {value}` |
| Tooltip | Custom content: `rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs min-w-32`, header = x value (muted), rows = 8px swatch + series name (muted) + value (`text-foreground tabular-nums`, right aligned, full formatting with grouping, not compact). `pointer-events-none`, flips at the container edge |
| Legend (SC#1) | Custom HTML row above the plot (not recharts `Legend`): `flex flex-wrap gap-x-2 gap-y-1 mb-2`. Each entry is a `<button type="button" aria-pressed>` with a 10px rounded swatch and the series name: `h-8 sm:h-6 px-2 rounded-md border border-transparent hover:border-border text-xs`. Shown: `text-foreground`. Hidden: `text-muted-foreground line-through`, swatch `opacity-25`. Hiding uses the recharts `hide` prop so slot assignment never moves |
| All series hidden | The plot area keeps 240px and shows, centred, 12px muted: `All series hidden. Turn one back on above.` |
| Keyboard | Legend toggles: Tab + Enter/Space. Plot: keep recharts' `accessibilityLayer` on (default in recharts 3), so arrow keys move the active tooltip |
| Screen readers | The plot wrapper is `role="img"` with `aria-label` = `{kind chip}: {title}, {N} rows` and an `sr-only` sentence naming the series and the x range (`Series: Americas, EMEA, APAC, LATAM. Q1 to Q4.`) |
| Lazy load | `React.lazy` for `ChartArtifact`. `Suspense` fallback = the same frame with an empty 240px body (`aria-busy="true"`), **no shimmer and no text**, so nothing jumps when the chunk lands. A chunk-load failure renders `ArtifactNotice` with the `chart-unavailable` reason |
| Narrow (< 480px container) | Direct labels hidden; legend wraps; plot height stays 240px |

There is **no kind toggle** on the artifact. Changing kind is the agent's job, by reference (D-06; on-artifact controls are deferred).

### TableArtifact (D-13, sketch Screen 2, locked)

| Aspect | Contract |
|---|---|
| Container | `max-h-[512px] overflow-auto`, no inner border (the card frame is the border) |
| Header | `<th>` sticky (`sticky top-0 bg-popover`), `h-8 px-3 text-xs text-muted-foreground text-left`, bottom border `border-border`. Each header holds a full-width `<button type="button">` with the column label and a sort glyph |
| Sort (click-to-sort) | `aria-sort="none|ascending|descending"` on `<th>`. Glyphs: `↕` unsorted (muted), `▲` ascending, `▼` descending (in `text-primary`). First click on a column = ascending; clicking the sorted column flips it; clicking another column starts it ascending. Numbers sort numerically; text sorts with `localeCompare`; empty cells sort last in both directions |
| Rows | `h-8 px-3 text-xs text-foreground border-b border-border/55`, `hover:bg-muted/50`. Initial order = the spec's row order (after any server-side sort) |
| Numeric columns | Right-aligned (header too), `tabular-nums`, grouping separators |
| Empty cell | `—` in `text-muted-foreground` |
| Long text | `whitespace-nowrap`, max 320px, truncate with the full value in `title` |
| Wide tables | Horizontal scroll inside the same container |

### MetricArtifact (D-13, sketch 2A, locked: ONE value per artifact)

```
{label}                                   12px muted
{prefix}{value}{unit}                     value: 28px / 600 Manrope tabular-nums; unit: 14px muted, ml-1
▲ 8.1% vs Q3 ($1.53M)                     12px; glyph + percent coloured, the rest muted
```

- Renders **directly in the card body**, without an inner bordered tile (UI-D-04).
- Several metrics are several artifacts; there is no strip and no list in the metric spec.
- Delta (optional, needs a comparison value): percent change = `(value − comparison) / |comparison|`, 1 decimal. Glyph `▲` (higher), `▼` (lower), `=` with `no change` (equal). Comparison 0 → the percent is omitted and the absolute difference is shown (`▲ +$1.66M vs Q3 ($0)`). The comparison label (`vs Q3`) comes from the spec.
- The arrow glyph and the words carry the meaning; colour is secondary (sketch, locked).

### ArtifactNotice (sketch 4B, locked)

```
<div role="note" data-testid="artifact-notice"
     class="rounded-xl border border-dashed border-muted-foreground/40 bg-card/60 px-4 py-3">
  <div class="flex items-center gap-2 font-headline text-sm font-semibold text-foreground">
    <Ban class="size-4 text-muted-foreground" aria-hidden/> This artifact can't be shown
  </div>
  <p class="mt-1 text-sm text-muted-foreground">{one plain-language reason}</p>
  <p class="mt-2 text-xs text-muted-foreground">The rest of the answer is unaffected.</p>
</div>
```

- Occupies the artifact's slot in emission order, with the same `gap-3` rhythm. The rest of the answer renders normally.
- ⛔ **Never JSON, markup, a spec key, a validation path (`series[2].kind`), an exception message or a stack trace.** The reason comes from the closed catalogue below, never from an error string.
- Each artifact renders inside its own error boundary whose fallback is this notice (`render-failed` reason), so one bad artifact cannot blank the message.

### The tool rail for `show_artifact` (D-10, sketch 3A/4B)

The rail is the existing Phase 095 status-node rail (`StepRow` / `ToolEssenceLine`). This phase adds a `show_artifact` arm, not a new frame.

| State | Rail row |
|---|---|
| Tool label | `Show an artifact` (new entry in `lib/toolNames.ts`; the product renders phrases, not ids; the sketch's mono `show_artifact` was shorthand, UI-D-06) |
| Preparing | Existing `Preparing Show an artifact…` + `preparing · 3.2 KB` pill. ⛔ **No args body** (see Leak paths) |
| Running activity string | `Showing an artifact…` (in `lib/toolMeta.ts`, the one home of activity strings) |
| Done, first emission | `Show an artifact → Bar chart · 12 rows` |
| Done, follow-up, same rows | `Show an artifact → Bar chart · same 16 rows as chart 1` |
| Done, follow-up, narrowed | `Show an artifact → Bar chart · chart 1 rows filtered to Q3 (4 rows)` |
| Refused | `Show an artifact → refused · {reason}`, with an **amber node** (UI-D-02), e.g. `refused · "pie" is not a chart kind`, `refused · 1,240 rows (max 500); aggregate first` |
| Expanded body, done | One worded line: `{kind chip} · {S} series · {N} rows · {chart N}. Shown below the answer.` Never the spec |
| Expanded body, refused | The reason sentence, then `Sent back to the agent to fix.` |

- **Refused node state (UI-D-02):** a new rail node state `refused`, derived from a **structured refusal marker in the tool result** (which only `show_artifact` emits in v1), not from the tool name. Node `bg-amber-600 border-amber-600 dark:bg-warning dark:border-warning`, step number and essence text `text-amber-700 dark:text-warning`. Other tools keep their current error rendering.
- A follow-up turn that re-encodes by reference shows **exactly one rail step** (the visible proof of SC#3). The UI must not add a synthetic step.

### ⚠ Leak paths found in shipped code (must be closed for SC#2)

Measured at `ccd9372f3`. Each of these would put the raw spec (rows included) on the page for `show_artifact` unless it gets an arm:

| # | Where | What it would show | Required behaviour |
|---|---|---|---|
| L-1 | `ToolCallPanel.tsx:355-371` → `ToolArgsLivePanel`, fed by `tool_args_progress.code_so_far`, which is the **raw cumulative args JSON for every tool** (`agent_loop.py:2434-2443`) | the spec JSON streaming live while the model writes it | `show_artifact` renders the header-only form (`hideBody`, the `execute_code` precedent): label + byte count, no body |
| L-2 | `ToolCallDetails.tsx:20-48` `ToolArgsBlock` ("Show parameters", mounted `ToolCallPanel.tsx:381`) | `JSON.stringify` of the args: the rows live, the `rows: "<stored in artifact …>"` placeholder on reload (I-4) | Not rendered for `show_artifact` |
| L-3 | `ToolCallDetails.tsx` `ToolResultBlock` → `GenericBody` fallback | up to 1,500 chars of the raw tool result | Dispatch to `ShowArtifactBody` |
| L-4 | `ToolResultBlock` `parsed.error` arm | the model-facing error string (Pydantic detail) in destructive italic | The tool result carries a separate **plain `reason`** for people; the UI shows only that, in the refused style above. The model-facing detail is never rendered |

These are small additive arms in rail files (`ToolCallPanel.tsx` FIRES, discharged at 227-02; `ToolCallDetails.tsx`; `StepRow.tsx`; `tool-bodies/index.ts`; `lib/toolNames.ts`; `lib/toolMeta.ts` FIRES). **They go beyond D-16's "one handler, one mount" and the planner must account for them** (ledger rows, G-5), because without them SC#2 fails on a live run with every validation passing.

---

## Interaction & State Contract

| State | What the person sees |
|---|---|
| **Live arrival** (sketch 4, winner "live") | The card renders the moment the `artifact` SSE event arrives, under the still-streaming text, which keeps growing above it. No skeleton, no reserved space before arrival |
| Scroll during arrival | The existing follow-but-release scroll governs. A 240px+ card landing never yanks a reader who has scrolled up |
| **Reload** (I-2, D-18) | The same persisted spec renders through the same components. Identical initial render: same order, size, colours, caption, label chip. No raw JSON at any point |
| Ephemeral view state | Legend visibility and table sort are local to the view and **reset on reload** (identical *initial* render is the contract, not remembered toggles) |
| Run stopped or failed after an artifact arrived | The artifact stays and is still there on reload. What showed live must show on reload (I-2); research confirms persistence happens at emission, not only at run end |
| Spec fails frontend validation (live or reload) | `ArtifactNotice` with the matching reason; the rest of the message renders |
| Unknown component reaches the client | `ArtifactNotice` (`unknown-component`) |
| Chart chunk fails to load | `ArtifactNotice` (`chart-unavailable`) |
| Model emitted a bad spec in-turn | Amber `refused` rail step(s) with the reason, followed by the retried call; only the successful retry renders a card. If no retry succeeds, **no card and no notice** render for that attempt (nothing was stored); the answer text stands alone |
| Over 500 rows | Refused in the rail (`refused · 1,240 rows (max 500); aggregate first`); nothing renders (D-09) |
| PNG asked for (D-20) | `execute_code` + the existing `FinalOutputsPanel` file row; no artifact. "Show me a chart" produces an artifact, not a PNG |
| Light theme | Same tokens, same palette; card is white |

---

## Copywriting Contract

All strings live in `artifactCopy.ts`.

| Element | Copy |
|---|---|
| Primary CTA | **None.** An artifact is read-only output with no call to action. Its only controls are legend toggles (labelled by the series name, state in `aria-pressed`) and table sort headers (labelled by the column name, state in `aria-sort`) |
| Empty state heading | Not applicable: an artifact with zero rows is refused before it can render (`refused · no rows to show`) |
| Empty state body (all series hidden) | `All series hidden. Turn one back on above.` |
| Notice title | `This artifact can't be shown` |
| Notice footnote | `The rest of the answer is unaffected.` |
| Error state | Notice title + one reason from the catalogue below. Where a person can act, the reason names the action (`Reload the page to try again.`) |
| Destructive confirmation | None. This phase has no destructive actions |
| Rail tool label | `Show an artifact` |
| Rail activity | `Showing an artifact…` |
| Caption, no source | `Values provided by the agent · no source document in this turn · {N} rows` |
| Caption lineage | `Redrawn from {label} · same {N} rows` / `From {label} · {operations} · {M} of {N} rows` |
| Rail expanded, refused | `Sent back to the agent to fix.` |
| Rail expanded, done | `Shown below the answer.` |

### Notice reason catalogue (closed; every failure maps to exactly one)

| Code | Reason sentence |
|---|---|
| `unknown-chart-kind` (known alias: pie, donut, radar, heatmap, histogram, treemap, funnel, gauge) | `it asked for a {pie chart}, which isn't one of the chart kinds we can draw.` |
| `unknown-chart-kind` (anything else) | `it asked for a chart kind we can't draw.` |
| `unknown-component` | `it asked for something other than a chart, table or metric.` |
| `missing-column` | `its saved data is missing a column the {chart} needs ({column}). Ask the agent to draw it again.` |
| `invalid-settings` | `its saved settings don't match what a {chart} needs. Ask the agent to draw it again.` |
| `too-many-rows` | `it holds more rows than an artifact can show (max 500).` |
| `too-many-series` | `it has more series than a {chart} can show (max {4}).` |
| `no-rows` | `it has no rows to show.` |
| `data-missing` | `its saved data could not be found. Ask the agent to draw it again.` |
| `chart-unavailable` | `the chart viewer didn't load. Reload the page to try again.` |
| `render-failed` (error boundary) | `something went wrong while drawing it. Reload the page to try again.` |

- `{pie chart}` comes only from the alias table, never by echoing an arbitrary model string. `{column}` is data, rendered as text and truncated at 40 characters. `{chart}` is the component noun (`chart`, `table`, `metric`).
- The **rail** refusal reasons are the same sentences in short form (`"pie" is not a chart kind`, `1,240 rows (max 500); aggregate first`, `6 series (max 4)`, `the filter matched 0 of 16 rows`, `chart 9 isn't in this thread`, fallback `its settings weren't valid`), supplied by the server as the plain `reason` field (L-4). ⛔ The server's `reason` names a kind (`"pie"`) **only when it is in the alias table**; any other model-supplied string is never echoed and becomes `a chart kind we can't draw`.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none new (existing `components/ui/*` untouched) | not required |
| Third-party | none | not applicable |

No new npm dependency: `recharts` is already installed, and `zod` is **not** in the tree, so frontend validation is a hand-rolled guard unless research justifies a dependency (CONTEXT, Claude's discretion).

---

## G-4 observables (UI side of D-17..D-20)

Chrome MCP asserts **rendered content**, not element presence (the presence-assertion trap recorded at Phase 235):

| Scenario | Assert |
|---|---|
| G4-1 chart → "make it bar" → "only Q3" | Hovering shows tooltip values that equal the source table's numbers; a legend click sets `aria-pressed="false"` and the series disappears while the others keep their swatch colour; each follow-up adds a new `artifact-block` with kind chip `Bar chart`, its caption reads `Redrawn from chart 1 · same 16 rows` then `From chart 2 · filtered to quarter = Q3 · 4 of 16 rows` (or `chart 1`, whichever the agent referenced), and the turn's rail has exactly one step |
| G4-2 reload identical | Screenshots of each card before and after reload (and after a backend restart) match; captions and label chips are byte-identical; the page text contains no `{"` and no `component` / `rows` spec keys |
| G4-3 broken spec | Only `artifact-notice` with a catalogue reason renders in that slot; the answer text above renders; no JSON, markup or key appears anywhere, including the rail's expanded body and the parameters area |
| G4-4 PNG when asked | "Give me this as a PNG file" produces a `final-outputs-panel` row and **no** `artifact-block`; "Show me a chart" produces an `artifact-block` and **no** PNG |

---

## Decisions made by this spec (auto mode; operator may override)

| ID | Decision | Why |
|---|---|---|
| UI-D-01 | Line/bar/area max 4 series; scatter max 3; above the cap the backend refuses | The validated palette has exactly 4 slots; the sketch caps scatter at 3. Cycling colours would break "colour follows the entity" |
| UI-D-02 | New rail node state `refused` (amber), derived from a structured refusal marker, not a tool-name check | The sketch shows amber refused steps; today's rail has no warn state and renders tool errors in destructive italic |
| UI-D-03 | Every artifact shows its `chart N` label chip, follow-ups included; the number is stored at creation, per component | Reference text says "each artifact carries a chip"; a follow-up must be nameable ("make chart 2 a table") |
| UI-D-04 | The metric renders in the card body with no inner bordered tile | In frame 1B the sketch's inner `.met` tile nests a border in a border; sketch frame A already stripped it for a single tile |
| UI-D-05 | `Info` icon for the "values provided by the agent" caption; `FileText` only when a source exists | A document icon beside "no source document" contradicts the words |
| UI-D-06 | Rail shows the phrase `Show an artifact`, not the id | Product convention since Phase 200 (`lib/toolNames.ts`): the rail is a person-facing step list and every other step there is a phrase, so an id would be the one odd row. The CAPTION keeps tool ids (`Data: query_tables …`) because it states lineage — which tool produced the numbers — and D-04 + the sketch spell it that way. Operator may override at G-4. |
| UI-D-07 | A by-reference artifact inherits its source's series order | Keeps colour on the entity across the lineage chain |
| UI-D-08 | Shown legend entries use `text-foreground`; hidden use `text-muted-foreground` + strike + 25% swatch | The sketch's dimmer hidden text is an estimated 3.2:1 on the card (60% muted over #0d1017); the strike and `aria-pressed` carry the state at AA contrast |
| UI-D-09 | No entrance or chart animation | G4-2 compares screenshots; an animation would make live and reload differ mid-frame |
| UI-D-10 | Type scale normalised to 12 / 14 / 28 px and weights 400 / 600 | Contract limits; hierarchy carried by colour and position |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG
- [x] Dimension 2 Visuals: FLAG
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: FLAG
- [x] Dimension 6 Registry Safety: PASS

**Approval:** pending
