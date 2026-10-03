/**
 * Phase 273-02 (D-13 · sketch 2A · UI-D-04 · UI-SPEC §MetricArtifact) — ONE value per artifact.
 *
 * Label, then `{prefix}{value}{unit}` (Manrope 28px, tabular), then an optional delta against the
 * comparison column: `▲ 8.1% vs Q3 ($1,532K)`. The glyph and the words carry the meaning; colour is
 * secondary and applies ONLY to the glyph + percent span. A comparison of zero has no percent, so the
 * absolute difference is shown instead. Rendered straight in the card body — no inner bordered tile.
 */
import {
  DELTA_GLYPH,
  EMPTY_CELL,
  METRIC_NO_CHANGE,
  formatNumber,
  metricCompareTail,
  percentText,
  splitUnit,
  withUnit,
} from "./artifactCopy"
import type { ArtifactBodyProps } from "./artifactSpec"

const UP = "text-emerald-700 dark:text-emerald-400"
const DOWN = "text-rose-600 dark:text-rose-400"
const SAME = "text-muted-foreground"

export function MetricArtifact({ record }: ArtifactBodyProps) {
  const { columns, rows, metric } = record.spec
  if (!metric) return null
  const row = rows[0] ?? []
  const valueIdx = columns.findIndex((c) => c.name === metric.value_column)
  const valueCol = columns[valueIdx]
  const raw = row[valueIdx]
  const value = typeof raw === "number" ? raw : null
  const { prefix, suffix } = splitUnit(valueCol?.unit ?? null)

  let delta: { glyph: string; change: string; tone: string; tail: string } | null = null
  if (metric.compare_column !== null && value !== null) {
    const cIdx = columns.findIndex((c) => c.name === metric.compare_column)
    const craw = row[cIdx]
    if (typeof craw === "number") {
      const unit = columns[cIdx]?.unit ?? null
      const diff = value - craw
      const tail = metricCompareTail(metric.compare_label ?? metric.compare_column, withUnit(craw, unit))
      if (diff === 0) {
        delta = { glyph: DELTA_GLYPH.same, change: METRIC_NO_CHANGE, tone: SAME, tail }
      } else {
        const glyph = diff > 0 ? DELTA_GLYPH.up : DELTA_GLYPH.down
        const change =
          craw === 0
            ? `${diff > 0 ? "+" : "-"}${withUnit(Math.abs(diff), unit)}`
            : percentText((Math.abs(diff) / Math.abs(craw)) * 100)
        delta = { glyph, change, tone: diff > 0 ? UP : DOWN, tail }
      }
    }
  }

  return (
    <div data-testid="artifact-metric" className="py-1">
      <p data-testid="metric-label" className="text-xs leading-[1.4] text-muted-foreground">
        {metric.label ?? metric.value_column}
      </p>
      <p
        data-testid="metric-value"
        className="font-headline text-[28px] font-semibold leading-[1.2] text-foreground tabular-nums"
      >
        {value === null ? (
          EMPTY_CELL
        ) : (
          <>
            {prefix}
            {formatNumber(value)}
            {suffix && (
              <span
                data-testid="metric-unit"
                className="ml-1 font-sans text-sm font-normal leading-[1.5] text-muted-foreground"
              >
                {suffix}
              </span>
            )}
          </>
        )}
      </p>
      {delta && (
        <p data-testid="metric-delta" className="mt-1 text-xs leading-[1.4] text-muted-foreground tabular-nums">
          <span data-testid="metric-delta-change" className={delta.tone}>
            {`${delta.glyph} ${delta.change}`}
          </span>{" "}
          {delta.tail}
        </p>
      )}
    </div>
  )
}
