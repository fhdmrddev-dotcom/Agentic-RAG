# Agent-Authored Artifacts (Phase 273)

The agent answers with a **live** chart, table or metric chosen from a **closed registry of exactly
three of our components**, emitted through the `show_artifact` tool (`273-CONTEXT.md` D-01..D-21).
This file is the visual contract. The behavioural contract (validation, by-reference re-encode, the
500-row refusal, persistence) lives in `273-CONTEXT.md` and is not repeated here.

---

## Design Decisions

### A. The frame: a card (sketch 273, Screen 1, winner B)
- Every artifact renders as a **framed card, full-width in the answer body, after the answer text**
  and above output files (D-10).
- **Header:** title on the left (Manrope 600, 13.5px), then a **kind chip** on the right
  (`Line chart`, `Bar chart`, `Stacked bar chart`, `Stacked area chart`, `Scatter chart`, `Table`,
  `Metric`). The chip names the component in plain words, never `show_artifact` or a spec key.
- **Body:** legend row (only for 2 or more series), then the plot.
- **Footer = the provenance caption** (D-04), with a doc icon, separated by a hairline:
  `Data: query_tables · Quarterly_Report_FY25.pdf p.4 · 16 rows`.
  - The caption is **server-derived, never model-written**.
  - When no data-bearing tool ran in the turn, it reads
    `Values provided by the agent · no source document in this turn · N rows`.
- **Why B beat A (borderless in the reading flow):** the card reads as *a thing the agent made*, so
  it is distinct from the prose and from cited text. It also matches the tool-card family. A was
  calmer but blurred the boundary between answer text and artifact, and the caption floated loose.

### B. The three components read as one family (Screen 2)
- **Chart.** Kinds: `line`, `bar` (grouped or stacked), `area` (always stacked), `scatter` (at most
  3 series). Interactive by default (SC#1):
  - line and area: a crosshair plus a tooltip listing every visible series at that x, sorted by
    value; stacked forms add a Total row;
  - bar: a band highlight plus a band tooltip;
  - scatter: a nearest-point ring plus a tooltip;
  - legend entries are **toggle buttons** (`aria-pressed`). A hidden series greys and strikes
    through, and **the survivors keep their colour**.
  - No kind toggle exists in the product: changing the kind is the agent's job, by reference (D-06).
- **Table.** Click-to-sort headers (`aria-sort`, with arrow glyphs `↕ ▲ ▼`), a **sticky header**,
  scrolling after about 15 rows, numbers right-aligned in `tabular-nums`, and a row hover wash.
- **Metric: ONE tile per artifact (winner A).** Label, a big value (Manrope 700, 26px) with a small
  unit, and an optional delta line `▲ 8.1% vs Q3 ($1.53M)`. Several metrics are several artifacts.
  - **Why not the 1-4 tile strip (B):** it would change the metric spec into a list. One value per
    artifact keeps the registry minimal and the spec flat.
  - The delta carries an **arrow glyph and words**, never colour alone (green ▲ / rose ▼ is
    secondary).

### C. Follow-ups state their rows in words (Screen 3, winner A)
- Each artifact carries a **`chart N` chip** (its label within the thread).
- A by-reference follow-up's **caption leads with a lineage line, then the source**:
  - `Redrawn from chart 1 · same 16 rows · Data: query_tables · … · 16 rows`
  - `From chart 1 · filtered to quarter = Q3 · 4 of 16 rows · Data: …`
- The rail for a follow-up turn shows **exactly one step**, for example
  `show_artifact → Bar chart · chart 1 rows filtered to Q3 (4 rows)`. One step and no retrieval is
  the visible proof of SC#3.
- **Why A beat B (a clickable "↑ from chart 1" chip):** the caption *states the proof*: which rows
  survived, and how many of how many. The chip only navigated. Earlier artifacts are never modified
  (D-08).

### D. The "can't be shown" notice is explicit (Screen 4, winner B)
- A **dashed-border box**: title `⊘ This artifact can't be shown`, **one plain-language reason**
  (*"it asked for a pie chart, which isn't one of the chart kinds we can draw."* /
  *"its saved data is missing a column the chart needs (revenue)."*), then a small line,
  *"The rest of the answer is unaffected."*
- ⛔ **Never JSON, markup, a spec key or a stack trace** (SC#2). The surrounding answer text renders
  normally.
- Before the notice, the model had its chance: refused calls show in the rail as **amber step nodes**
  with a worded reason (`show_artifact → refused · "pie" is not a chart kind`, or
  `refused · 1,240 rows (max 500); aggregate first`), followed by the retried call.
- **Why B beat A (a quiet one-line notice):** a missing artifact is a missing part of the answer. The
  quiet line read like a caption and was easy to miss.

### E. Live render, no skeleton (Screen 4)
- The `artifact` SSE event arrives during the run, so the **card renders immediately under the
  still-streaming text**, and the text grows above it. No reserved skeleton.
- Live and reload render **from the same persisted spec through the same component** (I-2).

---

## Data-viz contract

- **Categorical slots (dark, chart surface `#0d1017`):** `#3987e5` · `#d95926` · `#199e70` ·
  `#c98500`. Validated with the dataviz `validate_palette.js --mode dark --surface #0d1017`: **all
  checks pass** (worst adjacent CVD ΔE 8.4, normal-vision 19.8, every slot at or above 3:1).
  ⚠ CVD 8.4 sits just above the 6-8 floor band, so keep the direct labels and gaps; they are the
  secondary encoding.
- **Colour follows the entity, never its rank or survival.** Assign by the series' position in the
  artifact's full series list, so a filter or a hidden legend entry never repaints the rest.
- **Scatter at most 3 series** (the all-pairs rule). Beyond that, fold into "Other" or refuse.
- **Mark specs:** 2px lines with round joins; bars with **4px rounded tops** and a **2px gap**
  between bars and between stacked segments; stacked areas at 0.85 fill with a 2px surface-coloured
  edge; scatter dots r=5 with a **2px surface ring**; hover markers r=4.5 with the same ring.
- **Direct labels** at line ends (at most 4 series), in **text ink (`--text-m`), never the series
  colour**, de-collided to at least 13px apart.
- **One y-axis, always.** Nice ticks (`1 / 2 / 2.5 / 5 × 10ⁿ`, about 4 steps); values of 1000K or
  more read as `M`; a recessive grid (`--border`, horizontal only).
- **Single series:** no legend box (the title names it), and the tooltip names the series in words.
- **Lazy-load the chart component.** `FoundPerWeekSparkline.tsx` deliberately keeps recharts out of
  the main split.

## CSS Patterns

```css
/* frame */
.art.b{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.art.b .hd{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border-s)}
.art.b .bd{padding:10px 14px 6px}
.art.b .cap{padding:8px 14px 10px;border-top:1px solid var(--border-s);font-size:11.5px;color:var(--text-d)}
.chip{font:500 11px var(--sans);color:var(--text-m);background:var(--muted);border:1px solid var(--border);border-radius:999px;padding:1px 8px}
/* legend toggle */
.lg[aria-pressed="false"]{color:var(--text-d);text-decoration:line-through}
.lg[aria-pressed="false"] .sw{opacity:.25}
/* tooltip */
.tip{background:var(--pop);border:1px solid var(--border);border-radius:8px;padding:7px 10px;font-size:12px;box-shadow:0 8px 24px hsl(0 0% 0% / .45)}
.tip .v{font-variant-numeric:tabular-nums}
/* table */
.tbl{max-height:calc(15 * 31px + 34px);overflow:auto}
th{position:sticky;top:0;background:var(--pop)}
/* metric */
.met .v{font:700 26px var(--head);font-variant-numeric:tabular-nums}
/* notice */
.ntc-b{border:1px dashed hsl(220 20% 26%);border-radius:12px;padding:12px 14px;background:hsl(220 30% 6%)}
```

## HTML Structure

```html
<figure class="art b">
  <div class="hd"><div class="ttl">FY25 revenue by region · $K</div><span class="chip">Bar chart</span></div>
  <div class="bd">
    <div class="legend"><button class="lg" aria-pressed="true"><span class="sw"></span>Americas</button>…</div>
    <div class="cw"><svg role="img" aria-label="FY25 revenue by region"></svg><div class="tip"></div></div>
  </div>
  <div class="cap"><span class="chip">chart 1</span> <!-- or the lineage line for a follow-up -->
    <svg><!-- doc icon --></svg> Data: query_tables · Quarterly_Report_FY25.pdf p.4 · 16 rows</div>
</figure>
```

## What to Avoid

- **A borderless artifact (1A):** the boundary between prose and artifact blurs.
- **A metric strip (2B):** it changes the spec to a list. One value per artifact.
- **A navigation-only lineage chip (3B):** it hides the row proof. State the rows in words.
- **A quiet one-line notice (4A):** it reads as a caption and gets missed.
- **A skeleton until the stream ends:** a needless wait. Render on arrival.
- **Pie charts, on-artifact kind toggles, interleaving inside the text:** all rejected at discuss
  (D-05, D-06, D-10).
- Any fallback that prints the spec. The closed vocabulary is only closed if failure is a notice.

## Origin

Synthesized from sketch **273** (agent-authored-artifacts). Winners, operator 2026-10-03:
1B · 2A · 3A · 4B + live render.
Source files: `sources/273-agent-authored-artifacts/`.
