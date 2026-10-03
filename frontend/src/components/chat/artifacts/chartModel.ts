/**
 * Phase 273-02 (D-05 · SC#1 · UI-D-07) — the chart's PURE model. No React, no recharts.
 *
 * Everything the chart draws or prints is derived here so it can be pinned without jsdom laying out
 * an SVG (RESEARCH Pitfall 9): the palette slot per series, the y-domain (recomputed from the
 * VISIBLE series), the tooltip rows (visible series, high first, with a Total for stacked forms),
 * the tick/value formatting, the accessible names, and the direct-label de-collision.
 *
 * ⭐ Colour follows the entity, never its rank or survival (UI-D-07): series `i` always paints
 * `var(--chart-${slots[i] + 1})`, where `slots` is the server's stored assignment. Hiding a series
 * never re-indexes the survivors.
 */
import type { ArtifactRecord, Cell } from "./artifactSpec"
import { EMPTY_CELL, formatCompact, formatNumber, kindChipLabelOf, rowsPhrase, truncateValue } from "./artifactCopy"

export type HiddenSet = ReadonlySet<number>

/** One recharts datum. Synthetic keys (`x`, `s0`…), so a column name is never read as a path. */
export interface ChartDatum {
  __i: number
  x: Cell
  [series: `s${number}`]: number | null
}

export function seriesNames(record: ArtifactRecord): string[] {
  return record.spec.chart?.y ?? []
}

export function seriesSlots(record: ArtifactRecord): number[] {
  return record.spec.chart?.slots ?? []
}

export function seriesKey(i: number): `s${number}` {
  return `s${i}`
}

/** The palette variable for a slot (declared once in index.css as `--chart-1..4`). */
export function seriesColor(slot: number): string {
  return `var(--chart-${slot + 1})`
}

/** Area is always stacked; bar only when asked AND it has 2+ series. */
export function isStacked(record: ArtifactRecord): boolean {
  const c = record.spec.chart
  if (!c) return false
  if (c.kind === "area") return true
  return c.kind === "bar" && c.stacked && c.y.length >= 2
}

function colIndex(record: ArtifactRecord, name: string): number {
  return record.spec.columns.findIndex((c) => c.name === name)
}

function yIndexes(record: ArtifactRecord): number[] {
  return seriesNames(record).map((n) => colIndex(record, n))
}

function numOrNull(v: Cell | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

export function chartData(record: ArtifactRecord): ChartDatum[] {
  const c = record.spec.chart
  if (!c) return []
  const xi = colIndex(record, c.x)
  const yi = yIndexes(record)
  return record.spec.rows.map((row, i) => {
    const d: ChartDatum = { __i: i, x: row[xi] ?? null }
    yi.forEach((ci, s) => {
      d[seriesKey(s)] = numOrNull(row[ci])
    })
    return d
  })
}

// ── Domain and ticks ─────────────────────────────────────────────────────────────────────────

/** 1 / 2 / 2.5 / 5 × 10ⁿ — the smallest nice step ≥ raw. */
export function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}

function tidy(n: number): number {
  return Number(n.toPrecision(12))
}

function niceDomain(lo: number, hi: number): [number, number] {
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1
    lo -= pad
    hi += pad
  }
  const step = niceStep((hi - lo) / 4)
  const nlo = tidy(Math.floor(lo / step) * step)
  let nhi = tidy(Math.ceil(hi / step) * step)
  if (nhi <= nlo) nhi = tidy(nlo + step)
  return [nlo, nhi]
}

/**
 * The y-domain for the visible series. bar and area start at 0 (mandatory); line and scatter take
 * a nice auto domain. Stacked forms cover the visible SUM per x.
 */
export function visibleDomain(record: ArtifactRecord, hidden: HiddenSet): [number, number] {
  const c = record.spec.chart
  if (!c) return [0, 1]
  const visible = yIndexes(record).map((ci, s) => ({ ci, s })).filter(({ s }) => !hidden.has(s))
  if (visible.length === 0) return [0, 1]

  const values: number[] = []
  if (isStacked(record)) {
    for (const row of record.spec.rows) {
      let pos = 0
      let neg = 0
      for (const { ci } of visible) {
        const v = numOrNull(row[ci])
        if (v === null) continue
        if (v >= 0) pos += v
        else neg += v
      }
      values.push(pos, neg)
    }
  } else {
    for (const row of record.spec.rows) {
      for (const { ci } of visible) {
        const v = numOrNull(row[ci])
        if (v !== null) values.push(v)
      }
    }
  }
  if (values.length === 0) return [0, 1]

  let lo = Math.min(...values)
  let hi = Math.max(...values)
  if (c.kind === "bar" || c.kind === "area") {
    lo = Math.min(0, lo)
    hi = Math.max(0, hi)
  }
  const [nlo, nhi] = niceDomain(lo, hi)
  return [c.kind === "bar" || c.kind === "area" ? Math.min(0, nlo) : nlo, nhi]
}

/** About four nice steps across the domain. */
export function niceTicks([lo, hi]: [number, number]): number[] {
  const step = niceStep((hi - lo) / 4)
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) ticks.push(tidy(t))
  return ticks.length >= 2 ? ticks : [lo, hi]
}

/** The x extent for a numeric (scatter) x axis. */
export function xDomain(record: ArtifactRecord): [number, number] {
  const c = record.spec.chart
  if (!c) return [0, 1]
  const xi = colIndex(record, c.x)
  const xs = record.spec.rows.map((r) => numOrNull(r[xi])).filter((v): v is number => v !== null)
  if (xs.length === 0) return [0, 1]
  return niceDomain(Math.min(...xs), Math.max(...xs))
}

// ── Formatting ───────────────────────────────────────────────────────────────────────────────

export function formatTick(n: number): string {
  return formatCompact(n)
}

export function formatValue(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? formatNumber(n) : EMPTY_CELL
}

/** An x value as text: numbers grouped, strings truncated, empty as a dash. */
export function formatX(v: Cell | undefined): string {
  if (v === null || v === undefined || v === "") return EMPTY_CELL
  return typeof v === "number" ? formatNumber(v) : truncateValue(v)
}

// ── Tooltip ──────────────────────────────────────────────────────────────────────────────────

export interface TooltipRow {
  series: number
  name: string
  slot: number
  value: number | null
  text: string
}

export interface TooltipModel {
  header: string
  rows: TooltipRow[]
  total: { value: number; text: string } | null
}

/** Every VISIBLE series at row `xIndex`, sorted high first (nulls last); stacked forms add a Total. */
export function tooltipRows(record: ArtifactRecord, xIndex: number, hidden: HiddenSet): TooltipModel {
  const c = record.spec.chart
  const row = record.spec.rows[xIndex]
  if (!c || !row) return { header: "", rows: [], total: null }
  const xi = colIndex(record, c.x)
  const names = seriesNames(record)
  const slots = seriesSlots(record)
  const rows = yIndexes(record)
    .map((ci, s) => {
      const value = numOrNull(row[ci])
      return { series: s, name: names[s], slot: slots[s], value, text: formatValue(value) }
    })
    .filter((r) => !hidden.has(r.series))
    .sort((a, b) => {
      if (a.value === null && b.value === null) return a.series - b.series
      if (a.value === null) return 1
      if (b.value === null) return -1
      return b.value - a.value || a.series - b.series
    })
  let total: TooltipModel["total"] = null
  if (isStacked(record) && rows.length >= 2) {
    const sum = rows.reduce((acc, r) => acc + (r.value ?? 0), 0)
    total = { value: tidy(sum), text: formatValue(tidy(sum)) }
  }
  return { header: formatX(row[xi]), rows, total }
}

// ── Accessible names ─────────────────────────────────────────────────────────────────────────

export function ariaLabel(record: ArtifactRecord): string {
  return `${kindChipLabelOf(record)}: ${record.spec.title}, ${rowsPhrase(record.spec.rows.length)}`
}

export function srSummary(record: ArtifactRecord): string {
  const c = record.spec.chart
  if (!c) return ""
  const series = `Series: ${seriesNames(record).map(truncateValue).join(", ")}.`
  const xi = colIndex(record, c.x)
  const rows = record.spec.rows
  if (rows.length === 0) return series
  if (record.spec.columns[xi]?.type === "number") {
    const xs = rows.map((r) => numOrNull(r[xi])).filter((v): v is number => v !== null)
    if (xs.length === 0) return series
    return `${series} ${truncateValue(c.x)} ${formatNumber(Math.min(...xs))} to ${formatNumber(Math.max(...xs))}.`
  }
  return `${series} ${formatX(rows[0][xi])} to ${formatX(rows[rows.length - 1][xi])}.`
}

// ── Direct labels ────────────────────────────────────────────────────────────────────────────

/** Map a value to a pixel y inside a plot band. */
export function valueToY(v: number, [lo, hi]: [number, number], top: number, height: number): number {
  if (hi === lo) return top + height / 2
  return top + height * (1 - (v - lo) / (hi - lo))
}

/**
 * Push labels apart to at least `minGap` px, keeping their relative order and staying inside
 * [lo, hi]. Returns positions in INPUT order.
 */
export function decollide(ys: number[], minGap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i)
  const pos = order.map((o) => o.y)
  for (let k = 1; k < pos.length; k++) pos[k] = Math.max(pos[k], pos[k - 1] + minGap)
  if (pos.length > 0 && pos[pos.length - 1] > hi) {
    pos[pos.length - 1] = hi
    for (let k = pos.length - 2; k >= 0; k--) pos[k] = Math.min(pos[k], pos[k + 1] - minGap)
  }
  if (pos.length > 0 && pos[0] < lo) {
    pos[0] = lo
    for (let k = 1; k < pos.length; k++) pos[k] = Math.max(pos[k], pos[k - 1] + minGap)
  }
  const out = new Array<number>(ys.length)
  order.forEach((o, k) => {
    out[o.i] = pos[k]
  })
  return out
}
