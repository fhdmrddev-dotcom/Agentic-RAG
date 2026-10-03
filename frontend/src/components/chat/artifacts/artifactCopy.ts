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
 */
import { own } from "@/components/workflows/ownProperty"
import type { ArtifactRecord, Cell, ComponentName, LineageOperation, NoticeContext, NoticeReason } from "./artifactSpec"

// ── Frame, notice and chart chrome ───────────────────────────────────────────────────────────

export const NOTICE_TITLE = "This artifact can't be shown"
export const NOTICE_FOOTNOTE = "The rest of the answer is unaffected."
export const ALL_SERIES_HIDDEN = "All series hidden. Turn one back on above."
export const TOOLTIP_TOTAL = "Total"
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

/** Grouped, full-precision number (tooltip, table cell, metric). */
export function formatNumber(n: number): string {
  return NUMBER.format(n)
}

/** Compact axis tick (`1.5K`, `2M`). */
export function formatCompact(n: number): string {
  return COMPACT.format(n)
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
      return "it asked for something other than a chart, table or metric."
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
