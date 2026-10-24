/**
 * Phase 273-02 (UI-SPEC §Copywriting · §Kind chip labels · §Notice reason catalogue · §Caption) —
 * EVERY USER-VISIBLE STRING OF THE ARTIFACT SURFACE, IN ONE HOME.
 *
 * The `composerCopy.ts` pattern: no component in `artifacts/` re-types a sentence; it imports it from
 * here, so a fence can pin the copy and a drift is one diff, not a hunt.
 *
 * ⛔ What may be interpolated into a sentence here, and nothing else:
 *   · a component noun from the CLOSED set (`chart` / `table` / `metric`);
 *   · a chart-kind ALIAS from `KIND_ALIASES` below — an arbitrary model string is never echoed
 *     (`sunburst` becomes "a chart kind we can't draw");
 *   · a count;
 *   · a data value (column name, filter value, file name) as TEXT, truncated at 40 characters.
 * No JSON, no spec key, no validation path, no exception message (D-12 / SC#2).
 *
 * Numbers are formatted with a pinned `en-US` locale: every sentence around them is English, and the
 * same record must render byte-identically live and on reload (G4-2), whatever the machine locale.
 *
 * 273-05's rail body calls `kindChipLabel` with PRIMITIVES (the tool RESULT carries component, kind,
 * stacked and series_count, never a record) and reuses `operationPhrase` for the rail essence.
 *
 * Phase 292-02 (UI-SPEC §Copywriting Contract) adds every string of the three encoded types —
 * diagram, comparison and timeline — under the SAME rule. What may be interpolated widens by exactly
 * two closed sets: an ITEM WORD (`steps` / `links` / `terms` / `options` / `events`) and a COMPONENT
 * ALIAS from `COMPONENT_ALIASES`; a data value (node id, term name, date string) is still text
 * truncated at 40. The verdict words follow the operator-approved sketch key (UI-D-292-10).
 */
import { own } from "@/components/workflows/ownProperty"
import type {
  ArtifactRecord,
  Cell,
  ComponentName,
  LineageOperation,
  NodeKind,
  NoticeContext,
  NoticeReason,
  Verdict,
} from "./artifactSpec"

// ── Frame, notice and chart chrome ───────────────────────────────────────────────────────────

export const NOTICE_TITLE = "This artifact can't be shown"
export const NOTICE_FOOTNOTE = "The rest of the answer is unaffected."
export const ALL_SERIES_HIDDEN = "All series hidden. Turn one back on above."
export const TOOLTIP_TOTAL = "Total"
/** The legend row's group name for assistive tech. */
export const LEGEND_GROUP_LABEL = "Series"
export const EMPTY_CELL = "—"

// ── Caption ──────────────────────────────────────────────────────────────────────────────────

export const CAPTION_NO_SOURCE = "Values provided by the agent"
export const CAPTION_NO_SOURCE_DOC = "no source document in this turn"
export const CAPTION_DATA_PREFIX = "Data: "
export const CAPTION_SOURCE_JOIN = " → "
export const CAPTION_SEGMENT_JOIN = " · "
/** The caption names at most this many sources, then `+N more`. */
export const CAPTION_MAX_SOURCES = 3
/** filter_in names at most this many values, then `+N more`. */
export const OPERATION_MAX_VALUES = 3
export const VALUE_MAX_CHARS = 40

const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })
const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
// 273-REVIEW WR-04: below 1 a fixed 2 decimals rounds a rate of 0.0045 to "0" — the stored number
// misstated on the surface whose point is faithful numbers. Small magnitudes keep 3 (ticks 2)
// SIGNIFICANT digits instead; 1 and above are unchanged.
const SMALL = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 })
const SMALL_TICK = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 2 })

function isSmall(n: number): boolean {
  return n !== 0 && Math.abs(n) < 1
}

/** Grouped, full-precision number (tooltip, table cell, metric). */
export function formatNumber(n: number): string {
  return isSmall(n) ? SMALL.format(n) : NUMBER.format(n)
}

/** Compact axis tick (`1.5K`, `2M`, `0.002`). */
export function formatCompact(n: number): string {
  return isSmall(n) ? SMALL_TICK.format(n) : COMPACT.format(n)
}

/** A row count as people read it. */
export function rowsPhrase(n: number): string {
  return `${formatNumber(n)} ${n === 1 ? "row" : "rows"}`
}

export function moreSuffix(n: number): string {
  return `+${formatNumber(n)} more`
}

/** A data value rendered as text, truncated at 40 characters with an ellipsis. */
export function truncateValue(s: string): string {
  return s.length > VALUE_MAX_CHARS ? `${s.slice(0, VALUE_MAX_CHARS - 1)}…` : s
}

/** A cell rendered as caption text: numbers grouped, strings truncated, null as "(empty)". */
export function cellPhrase(v: Cell | undefined): string {
  if (v === null || v === undefined || v === "") return "(empty)"
  if (typeof v === "number") return formatNumber(v)
  return truncateValue(v)
}

export function captionLineageSame(parentLabel: string, rowCount: number): string[] {
  return [`Redrawn from ${truncateValue(parentLabel)}`, `same ${rowsPhrase(rowCount)}`]
}

export function captionLineageFrom(parentLabel: string): string {
  return `From ${truncateValue(parentLabel)}`
}

export function captionOfRows(m: number, n: number): string {
  return `${formatNumber(m)} of ${rowsPhrase(n)}`
}

export function captionSource(tool: string, document: string | null, page: number | null): string {
  const doc = document ? `${CAPTION_SEGMENT_JOIN}${truncateValue(document)}${page !== null ? ` p.${page}` : ""}` : ""
  return `${truncateValue(tool)}${doc}`
}

// ── Table ────────────────────────────────────────────────────────────────────────────────────

/** Sort glyphs: muted ↕ when unsorted, ▲ / ▼ in the reserved accent when sorted. */
export const SORT_GLYPH = { none: "↕", ascending: "▲", descending: "▼" } as const

/** A column heading: the name, then its unit in parentheses when it has one. */
export function columnHeading(name: string, unit: string | null): string {
  return unit ? `${name} (${unit})` : name
}

// ── Metric ───────────────────────────────────────────────────────────────────────────────────

export const DELTA_GLYPH = { up: "▲", down: "▼", same: "=" } as const
export const METRIC_NO_CHANGE = "no change"

const CURRENCY_PREFIX = /^[$€£¥₹]/

/** A unit split into a currency prefix and a suffix: `$K` → `$` + `K`, `days` → `` + `days`. */
export function splitUnit(unit: string | null): { prefix: string; suffix: string } {
  if (!unit) return { prefix: "", suffix: "" }
  if (CURRENCY_PREFIX.test(unit)) return { prefix: unit.slice(0, 1), suffix: unit.slice(1) }
  return { prefix: "", suffix: unit }
}

/** A number with its unit as running text: `$1,532K`, `12 days`, `8%`. */
export function withUnit(n: number, unit: string | null): string {
  const { prefix, suffix } = splitUnit(unit)
  const gap = suffix.length > 1 && /^[A-Za-z]/.test(suffix) ? " " : ""
  return `${prefix}${formatNumber(n)}${gap}${suffix}`
}

/** The muted tail of the delta line: `vs Q3 ($1,532K)`. */
export function metricCompareTail(compareLabel: string, compareText: string): string {
  return `vs ${truncateValue(compareLabel)} (${compareText})`
}

const PERCENT = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function percentText(p: number): string {
  return `${PERCENT.format(p)}%`
}

// ── Lineage operation phrases (closed set, D-07) ─────────────────────────────────────────────

function rangeBound(v: number | string | null): string {
  return typeof v === "number" ? formatNumber(v) : truncateValue(String(v))
}

export function operationPhrase(op: LineageOperation): string {
  switch (op.op) {
    case "filter_eq":
      return `filtered to ${truncateValue(op.column)} = ${cellPhrase(op.value)}`
    case "filter_in": {
      const named = op.values.slice(0, OPERATION_MAX_VALUES).map(cellPhrase).join(", ")
      const rest = op.values.length - OPERATION_MAX_VALUES
      return `filtered to ${truncateValue(op.column)} in ${named}${rest > 0 ? ` ${moreSuffix(rest)}` : ""}`
    }
    case "filter_range": {
      const col = truncateValue(op.column)
      if (op.min !== null && op.max !== null) return `filtered to ${col} ${rangeBound(op.min)}–${rangeBound(op.max)}`
      if (op.min !== null) return `filtered to ${col} ≥ ${rangeBound(op.min)}`
      if (op.max !== null) return `filtered to ${col} ≤ ${rangeBound(op.max)}`
      return `filtered to ${col}`
    }
    case "top_n":
      return `top ${formatNumber(op.n)} by ${truncateValue(op.column)}`
    case "sort":
      return `sorted by ${truncateValue(op.column)}, ${op.direction === "desc" ? "high to low" : "low to high"}`
    case "select":
      return `columns: ${op.columns.map(truncateValue).join(", ")}`
  }
}

/** Caption order: filter → top-N → sort → columns. */
export const OPERATION_ORDER: Record<LineageOperation["op"], number> = {
  filter_eq: 0,
  filter_in: 0,
  filter_range: 0,
  top_n: 1,
  sort: 2,
  select: 3,
}

// ── Kind chip ────────────────────────────────────────────────────────────────────────────────

/**
 * The kind chip in plain words. Primitive arguments on purpose: 273-05's rail body has the tool
 * RESULT (component, kind, stacked, series_count), not a record.
 */
export function kindChipLabel(
  component: string,
  kind: string | null | undefined,
  stacked: boolean,
  seriesCount: number,
): string {
  if (component === "table") return "Table"
  if (component === "metric") return "Metric"
  // 292 (UI-D-292-02): fixed chip text, never a spec key.
  if (component === "diagram") return "Flow diagram"
  if (component === "comparison") return "Comparison"
  if (component === "timeline") return "Timeline"
  switch (kind) {
    case "line":
      return "Line chart"
    case "bar":
      return stacked && seriesCount >= 2 ? "Stacked bar chart" : "Bar chart"
    case "area":
      return seriesCount >= 2 ? "Stacked area chart" : "Area chart"
    case "scatter":
      return "Scatter chart"
    default:
      return "Chart"
  }
}

export function kindChipLabelOf(record: ArtifactRecord): string {
  const chart = record.spec.chart
  return kindChipLabel(record.component, chart?.kind ?? null, chart?.stacked ?? false, chart?.y.length ?? 0)
}

// ── Notice reason catalogue ──────────────────────────────────────────────────────────────────

/** The closed alias table: the only model-adjacent words a notice may print. */
export const KIND_ALIASES: Readonly<Record<string, string>> = {
  pie: "pie chart",
  donut: "donut chart",
  radar: "radar chart",
  heatmap: "heatmap",
  histogram: "histogram",
  treemap: "treemap",
  funnel: "funnel chart",
  gauge: "gauge chart",
}

/** The alias for a requested kind, or undefined. Own-property, case-insensitive, trimmed. */
export function kindAlias(raw: string): string | undefined {
  return own(KIND_ALIASES as Record<string, string>, raw.trim().toLowerCase())
}

/**
 * 292 (UI-D-292-21): the closed COMPONENT alias table — the only model-adjacent words a component
 * refusal may print. ⚠ `flowchart`, `graph` and `gantt_chart` are deliberately NOT here: the notice
 * would otherwise say "a flowchart isn't a type we can show" while we do show flow diagrams.
 */
export const COMPONENT_ALIASES: Readonly<Record<string, string>> = {
  mindmap: "mind map",
  mind_map: "mind map",
  gantt: "Gantt chart",
  sankey: "Sankey diagram",
  map: "map",
  image: "image",
  html: "web page",
  code: "code block",
  kanban: "board",
  steps: "step list",
  pie: "pie chart",
  donut: "donut chart",
}

/** The alias for a requested component, or undefined. Own-property, case-insensitive, trimmed. */
export function componentAlias(raw: string): string | undefined {
  return own(COMPONENT_ALIASES as Record<string, string>, raw.trim().toLowerCase())
}

/** `a` / `an` for a closed alias (only aliases reach this; no model string does). */
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a"
}

function nounOf(ctx?: NoticeContext): ComponentName {
  return ctx?.noun ?? "chart"
}

/** The one plain-language reason line for a catalogue code. */
export function noticeText(reason: NoticeReason, ctx?: NoticeContext): string {
  switch (reason) {
    case "unknown-chart-kind":
      return ctx?.alias
        ? `it asked for a ${ctx.alias}, which isn't one of the chart kinds we can draw.`
        : "it asked for a chart kind we can't draw."
    case "unknown-component":
      return ctx?.alias
        ? `it asked for ${article(ctx.alias)} ${ctx.alias}, which isn't one of the artifact types we can show.`
        : "it asked for something other than a chart, table, metric, diagram, comparison or timeline."
    case "too-many-items":
      return `it has more ${ctx?.items ?? "items"} than a ${nounOf(ctx)} can show (max ${formatNumber(ctx?.max ?? 0)}).`
    case "wrong-option-count": {
      const n = ctx?.count ?? 0
      return `it has ${formatNumber(n)} ${n === 1 ? "option" : "options"}; a comparison shows 2 to 5.`
    }
    case "no-items":
      return `it has no ${ctx?.items ?? "items"} to show.`
    case "broken-link":
      return ctx?.value
        ? `its saved data links to a step that isn't in it (${truncateValue(ctx.value)}). Ask the agent to draw it again.`
        : "its saved data links to a step that isn't in it. Ask the agent to draw it again."
    case "ragged-term":
      return ctx?.value
        ? `its saved data has a term with the wrong number of cells (${truncateValue(ctx.value)}). Ask the agent to draw it again.`
        : "its saved data has a term with the wrong number of cells. Ask the agent to draw it again."
    case "bad-date":
      return ctx?.value
        ? `its saved data has a date we can't read (${truncateValue(ctx.value)}). Ask the agent to draw it again.`
        : "its saved data has a date we can't read. Ask the agent to draw it again."
    case "missing-column":
      return ctx?.column
        ? `its saved data is missing a column the ${nounOf(ctx)} needs (${truncateValue(ctx.column)}). Ask the agent to draw it again.`
        : `its saved data is missing a column the ${nounOf(ctx)} needs. Ask the agent to draw it again.`
    case "invalid-settings":
      return `its saved settings don't match what a ${nounOf(ctx)} needs. Ask the agent to draw it again.`
    case "too-many-rows":
      return "it holds more rows than an artifact can show (max 500)."
    case "too-many-series":
      return `it has more series than a ${nounOf(ctx)} can show (max ${ctx?.max ?? 4}).`
    case "no-rows":
      return "it has no rows to show."
    case "data-missing":
      return "its saved data could not be found. Ask the agent to draw it again."
    case "chart-unavailable":
      return "the chart viewer didn't load. Reload the page to try again."
    case "render-failed":
      return "something went wrong while drawing it. Reload the page to try again."
  }
}

// ══ Phase 292-02 — the encoded types' copy (UI-SPEC §Copywriting Contract) ══════════════════════

function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`
}

// ── Counts (caption segment + rail; UI-D-292-19 / -20) ──────────────────────────────────────

export function stepsPhrase(n: number): string {
  return plural(n, "step", "steps")
}

export function linksPhrase(n: number): string {
  return n === 0 ? "no links" : plural(n, "link", "links")
}

export function termsPhrase(n: number): string {
  return plural(n, "term", "terms")
}

export function optionsPhrase(n: number): string {
  return plural(n, "option", "options")
}

export function optionsTermsPhrase(options: number, terms: number): string {
  return `${optionsPhrase(options)} × ${termsPhrase(terms)}`
}

export function eventsPhrase(n: number): string {
  return plural(n, "event", "events")
}

// ── Comparison caption second line (D-17) ───────────────────────────────────────────────────

export const COMPARISON_NOTE = "Verdicts are the agent's reading."
export const COMPARISON_NOTE_SOURCED = "Verdicts are the agent's reading. Hover or focus a cell for its clause."

// ── Shared source tooltip (UI-D-292-09) ──────────────────────────────────────────────────────

/** A source line / tooltip header with no document name still says what it is. */
export const SOURCE_FALLBACK = "Source"

/** `{document truncated 40} · p.{page}`; the page segment is omitted when there is none. */
export function sourceHeader(document: string | null, page: number | null): string {
  const parts = [document ? truncateValue(document) : SOURCE_FALLBACK]
  if (page !== null) parts.push(`p.${page}`)
  return parts.join(CAPTION_SEGMENT_JOIN)
}

/** The excerpt in OUR curly quotes, truncated at 280 characters with an ellipsis. */
export function excerptText(excerpt: string): string {
  const max = 280
  const cut = excerpt.length > max ? `${excerpt.slice(0, max - 1)}…` : excerpt
  return `“${cut}”`
}

// ── Diagram (UI-SPEC §DiagramArtifact) ──────────────────────────────────────────────────────

export const DIAGRAM_ROLE_DESCRIPTION = "flow diagram"

export function diagramAriaLabel(title: string, steps: number, links: number): string {
  return `Flow diagram: ${title}. ${stepsPhrase(steps)}, ${linksPhrase(links)}.`
}

export const NODE_KIND_WORD: Readonly<Record<NodeKind, string>> = {
  start: "Start",
  end: "End",
  decision: "Decision",
  step: "Step",
}

export interface NodeRelation {
  label: string
  edgeLabel: string | null
}

function relation(r: NodeRelation): string {
  return r.edgeLabel ? `${r.label}, "${r.edgeLabel}"` : r.label
}

/**
 * A node's accessible name: `{label}. {Kind}. Leads to …. Loops back to …. Comes from ….` — each
 * clause omitted when empty. Labels are the model's text, read as text by assistive tech.
 */
export function nodeAriaLabel(
  label: string,
  kind: NodeKind,
  leadsTo: NodeRelation[],
  loopsBackTo: NodeRelation[],
  comesFrom: string[],
): string {
  const parts = [`${label}.`, `${own(NODE_KIND_WORD as Record<string, string>, kind) ?? NODE_KIND_WORD.step}.`]
  if (leadsTo.length > 0) parts.push(`Leads to ${leadsTo.map(relation).join("; ")}.`)
  if (loopsBackTo.length > 0) parts.push(`Loops back to ${loopsBackTo.map(relation).join("; ")}.`)
  if (comesFrom.length > 0) parts.push(`Comes from ${comesFrom.join("; ")}.`)
  return parts.join(" ")
}

// ── Comparison (UI-SPEC §ComparisonArtifact; the sketch key, UI-D-292-10) ───────────────────

export const VERDICT_WORD: Readonly<Record<Verdict, string>> = {
  y: "Favourable",
  n: "Unfavourable",
  m: "Neutral",
  q: "Not stated",
}

/** The verdict word for a stored verdict, read through own(). */
export function verdictWord(v: Verdict): string {
  return own(VERDICT_WORD as Record<string, string>, v) ?? VERDICT_WORD.q
}

export const NOT_STATED = "Not stated"
export const COMPARISON_TERM_HEADER = "Term"
export const COMPARISON_LEGEND_LABEL = "Verdicts"
export const DIFF_TOGGLE = "Only terms that differ"
export const DIFF_DISABLED_TITLE = "No term is the same across every option."
export const ALL_TERMS_IDENTICAL = "Every term is the same across these options."

export function hiddenTermsPhrase(n: number): string {
  return n === 1 ? "1 identical term hidden" : `${formatNumber(n)} identical terms hidden`
}

// ── Timeline (UI-SPEC §TimelineArtifact) ────────────────────────────────────────────────────

/** The fixed English month table: byte-identical on every machine (some ICU builds print `Sept`). */
export const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

export const TODAY_LABEL = "Today"

export type TodayPlacement = "between" | "top" | "bottom"

const TODAY_TAIL: Readonly<Record<TodayPlacement, string>> = {
  between: "everything below hasn't happened yet",
  top: "none of these has happened yet",
  bottom: "everything above has happened",
}

export function todaySentence(dateText: string, placement: TodayPlacement): string {
  return `${dateText} — ${TODAY_TAIL[placement]}`
}

/** What a screen reader hears before the Today sentence. */
export function todaySrLead(dateText: string): string {
  return `${TODAY_LABEL}, ${dateText}.`
}

export function timelineAriaLabel(title: string, events: number): string {
  return `Timeline: ${title}. ${eventsPhrase(events)}.`
}

export type EventState = "past" | "upcoming" | "deadline"

export const EVENT_STATE_WORD: Readonly<Record<EventState, string>> = {
  past: "Happened.",
  upcoming: "Upcoming.",
  deadline: "Deadline.",
}

/** A gap row's visible label (gaps are ≥ 6 months, so always plural) and its screen-reader tail. */
export function gapLabel(months: number): string {
  return plural(months, "month", "months")
}
export const GAP_SR_SUFFIX = " later"

// Deadline pill (UI-D-292-16). ⚠ A month-precision deadline IN the current month reads `this month`
// (amber, the month analogue of `due today`): UI-D-292-15 puts the current month on the past side, so
// the UI-SPEC's `passed this month` and `this month` would otherwise name the same case twice.
export const DUE_TODAY = "due today"
export const DUE_THIS_MONTH = "this month"

export function inDaysPhrase(n: number): string {
  return `in ${plural(n, "day", "days")}`
}

export function inMonthsPhrase(n: number): string {
  return `in ${plural(n, "month", "months")}`
}

export function passedDaysPhrase(n: number): string {
  return `passed ${plural(n, "day", "days")} ago`
}

export function passedMonthsPhrase(n: number): string {
  return `passed ${plural(n, "month", "months")} ago`
}
