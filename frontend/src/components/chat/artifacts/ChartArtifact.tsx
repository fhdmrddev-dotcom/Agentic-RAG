/**
 * Phase 273-02 (D-05 · SC#1 · UI-D-07 · UI-D-08 · UI-D-09 · UI-SPEC §ChartArtifact) — the interactive
 * chart. Lazy DEFAULT export, and the ONLY recharts importer of this phase, so recharts stays out of
 * the chat chunk (`artifactRegistry.ts` loads it through `React.lazy`).
 *
 * Kinds: `line`, `bar` (grouped or stacked), `area` (always stacked), `scatter`. One y-axis, always.
 *
 * SC#1 — interactive by default:
 *   · hover: a custom tooltip listing every VISIBLE series at that x, high first, with a Total row for
 *     stacked forms (`chartModel.tooltipRows`); a dashed crosshair for line/area, a band for bar, a
 *     nearest-point ring for scatter;
 *   · the legend is a row of real `<button aria-pressed>` toggles (not recharts' Legend) driving a
 *     LOCAL `hidden` set that reaches recharts as each series' `hide` prop. Legend state is view-only
 *     and resets on reload (UI-SPEC §Interaction).
 *
 * UI-D-07 — colour follows the entity: series `i` paints `var(--chart-${slots[i] + 1})` from the
 * server's stored `slots`, so hiding a series never repaints the survivors.
 * UI-D-09 — `isAnimationActive={false}` on every series and the tooltip: live and reload must be
 * pixel-identical for G4-2's screenshot comparison.
 *
 * All numbers and words come from `chartModel.ts` / `artifactCopy.ts`; series names render as text.
 */
import { useId, useMemo, useState, type ReactElement } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/utils"
import { ALL_SERIES_HIDDEN, LEGEND_GROUP_LABEL, TOOLTIP_TOTAL, columnHeading } from "./artifactCopy"
import type { ArtifactBodyProps, ArtifactRecord } from "./artifactSpec"
import {
  ariaLabel,
  chartData,
  decollide,
  formatTick,
  formatValue,
  formatX,
  isStacked,
  niceTicks,
  seriesColor,
  seriesKey,
  seriesNames,
  seriesSlots,
  srSummary,
  tooltipRows,
  valueToY,
  visibleDomain,
  xDomain,
  type HiddenSet,
} from "./chartModel"

const PLOT_HEIGHT = 240
const MARGIN_TOP = 12
const MARGIN_BOTTOM = 4
const MARGIN_RIGHT = 16
const MARGIN_RIGHT_LABELS = 72
const Y_AXIS_WIDTH = 48
/** recharts' default XAxis height. */
const X_AXIS_HEIGHT = 30
const DIRECT_LABEL_MIN_WIDTH = 480
const DIRECT_LABEL_GAP = 16

const TICK = { fontSize: 12, fill: "hsl(var(--muted-foreground))" }
const CARD = "hsl(var(--card))"
const RADIUS_TOP: [number, number, number, number] = [4, 4, 0, 0]
const RADIUS_NONE: [number, number, number, number] = [0, 0, 0, 0]

// ── Tooltip ──────────────────────────────────────────────────────────────────────────────────

interface TooltipDatum {
  __i?: number
  __s?: number
  x?: unknown
  y?: unknown
}

export interface ChartTooltipContentProps {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: unknown }>
  record: ArtifactRecord
  hidden: HiddenSet
}

interface Row {
  key: string
  name: string
  text: string
  slot: number | null
}

/** The custom tooltip body. Exported so its rows can be pinned without a pointer. */
export function ChartTooltipContent({ active, payload, record, hidden }: ChartTooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null
  const datum = payload[0]?.payload as TooltipDatum | undefined
  if (!datum || typeof datum.__i !== "number") return null
  const chart = record.spec.chart
  if (!chart) return null

  let header: string
  let rows: Row[]
  let total: { text: string } | null = null

  if (chart.kind === "scatter") {
    const s = typeof datum.__s === "number" ? datum.__s : 0
    const name = seriesNames(record)[s] ?? ""
    header = name
    rows = [
      { key: "x", name: chart.x, text: formatValue(typeof datum.x === "number" ? datum.x : null), slot: null },
      {
        key: "y",
        name,
        text: formatValue(typeof datum.y === "number" ? datum.y : null),
        slot: seriesSlots(record)[s] ?? null,
      },
    ]
  } else {
    const model = tooltipRows(record, datum.__i, hidden)
    header = model.header
    rows = model.rows.map((r) => ({ key: `s${r.series}`, name: r.name, text: r.text, slot: r.slot }))
    total = model.total
  }

  return (
    <div
      data-testid="artifact-tooltip"
      className="pointer-events-none min-w-32 rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-[1.4] shadow-lg"
    >
      <div data-testid="tooltip-header" className="mb-1 text-muted-foreground">
        {header}
      </div>
      {rows.map((r) => (
        <div key={r.key} data-testid="tooltip-row" className="flex items-center gap-2">
          {r.slot !== null && (
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: seriesColor(r.slot) }}
            />
          )}
          <span className="text-muted-foreground">{r.name}</span>
          <span className="ml-auto pl-3 text-right text-foreground tabular-nums">{r.text}</span>
        </div>
      ))}
      {total && (
        <div data-testid="tooltip-total" className="mt-1 flex items-center gap-2 border-t border-border/55 pt-1">
          <span className="text-muted-foreground">{TOOLTIP_TOTAL}</span>
          <span className="ml-auto pl-3 text-right text-foreground tabular-nums">{total.text}</span>
        </div>
      )}
    </div>
  )
}

// ── Chart ────────────────────────────────────────────────────────────────────────────────────

function ScatterDot(props: { cx?: number; cy?: number; fill?: string }) {
  if (typeof props.cx !== "number" || typeof props.cy !== "number") return <g />
  return <circle cx={props.cx} cy={props.cy} r={5} fill={props.fill} stroke={CARD} strokeWidth={2} />
}

function ScatterActiveDot(props: { cx?: number; cy?: number; fill?: string }) {
  if (typeof props.cx !== "number" || typeof props.cy !== "number") return <g />
  return (
    <g>
      <circle cx={props.cx} cy={props.cy} r={7} fill="none" stroke="hsl(var(--foreground))" strokeWidth={1.5} />
      <circle cx={props.cx} cy={props.cy} r={5} fill={props.fill} stroke={CARD} strokeWidth={2} />
    </g>
  )
}

export default function ChartArtifact({ record }: ArtifactBodyProps) {
  const srId = useId()
  const [hidden, setHidden] = useState<Set<number>>(() => new Set())
  const [width, setWidth] = useState(0)
  const data = useMemo(() => chartData(record), [record])

  const chart = record.spec.chart
  if (!chart) return null

  const names = seriesNames(record)
  const slots = seriesSlots(record)
  const colors = slots.map(seriesColor)
  const multi = names.length >= 2
  const stacked = isStacked(record)
  const allHidden = names.length > 0 && names.every((_, i) => hidden.has(i))
  const domain = visibleDomain(record, hidden)
  const ticks = niceTicks(domain)
  const visibleIdx = names.map((_, i) => i).filter((i) => !hidden.has(i))
  const topVisible = visibleIdx.length > 0 ? visibleIdx[visibleIdx.length - 1] : -1

  const toggle = (i: number) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const directLabels =
    chart.kind === "line" && names.length >= 2 && names.length <= 4 && width >= DIRECT_LABEL_MIN_WIDTH
  const margin = {
    top: MARGIN_TOP,
    right: directLabels ? MARGIN_RIGHT_LABELS : MARGIN_RIGHT,
    bottom: MARGIN_BOTTOM,
    left: 0,
  }

  const tooltip = (cursor: object | false) => (
    <Tooltip
      isAnimationActive={false}
      cursor={cursor}
      content={(p) => (
        <ChartTooltipContent
          active={p.active}
          payload={p.payload as ReadonlyArray<{ payload?: unknown }> | undefined}
          record={record}
          hidden={hidden}
        />
      )}
    />
  )
  const grid = <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
  const yAxis = (
    <YAxis
      type="number"
      width={Y_AXIS_WIDTH}
      domain={domain}
      ticks={ticks}
      tickFormatter={formatTick}
      tick={TICK}
      axisLine={false}
      tickLine={false}
      allowDataOverflow
      {...(chart.kind === "scatter" ? { dataKey: "y" } : {})}
    />
  )
  const categoryX = (
    <XAxis
      dataKey="x"
      tick={TICK}
      tickFormatter={(v: unknown) => formatX(typeof v === "number" || typeof v === "string" ? v : null)}
      axisLine={false}
      tickLine={false}
      minTickGap={16}
    />
  )
  const crosshair = { stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }

  let plot: ReactElement
  if (chart.kind === "line") {
    plot = (
      <LineChart data={data} margin={margin} accessibilityLayer>
        {grid}
        {categoryX}
        {yAxis}
        {tooltip(crosshair)}
        {names.map((name, i) => (
          <Line
            key={seriesKey(i)}
            type="linear"
            dataKey={seriesKey(i)}
            name={name}
            stroke={colors[i]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 4.5, stroke: CARD, strokeWidth: 2, fill: colors[i] }}
            hide={hidden.has(i)}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    )
  } else if (chart.kind === "area") {
    plot = (
      <AreaChart data={data} margin={margin} accessibilityLayer>
        {grid}
        {categoryX}
        {yAxis}
        {tooltip(crosshair)}
        {names.map((name, i) => (
          <Area
            key={seriesKey(i)}
            type="linear"
            stackId="stack"
            dataKey={seriesKey(i)}
            name={name}
            fill={colors[i]}
            fillOpacity={0.85}
            stroke={CARD}
            strokeWidth={2}
            hide={hidden.has(i)}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    )
  } else if (chart.kind === "bar") {
    plot = (
      <BarChart data={data} margin={margin} barCategoryGap="28%" barGap={2} accessibilityLayer>
        {grid}
        {categoryX}
        {yAxis}
        {tooltip({ fill: "hsl(var(--accent) / 0.5)" })}
        {names.map((name, i) => (
          <Bar
            key={seriesKey(i)}
            dataKey={seriesKey(i)}
            name={name}
            fill={colors[i]}
            stackId={stacked ? "stack" : undefined}
            radius={!stacked || i === topVisible ? RADIUS_TOP : RADIUS_NONE}
            {...(stacked ? { stroke: CARD, strokeWidth: 2 } : {})}
            hide={hidden.has(i)}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    )
  } else {
    const xd = xDomain(record)
    const xi = record.spec.columns.findIndex((c) => c.name === chart.x)
    const yIdx = names.map((n) => record.spec.columns.findIndex((c) => c.name === n))
    plot = (
      <ScatterChart margin={margin} accessibilityLayer>
        {grid}
        <XAxis
          type="number"
          dataKey="x"
          name={chart.x}
          domain={xd}
          ticks={niceTicks(xd)}
          tickFormatter={formatTick}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          minTickGap={16}
        />
        {yAxis}
        {tooltip(false)}
        {names.map((name, i) => (
          <Scatter
            key={seriesKey(i)}
            name={name}
            data={record.spec.rows
              .map((row, ri) => ({ __i: ri, __s: i, x: row[xi], y: row[yIdx[i]] }))
              .filter((d) => typeof d.x === "number" && typeof d.y === "number")}
            fill={colors[i]}
            shape={ScatterDot}
            activeShape={ScatterActiveDot}
            hide={hidden.has(i)}
            isAnimationActive={false}
          />
        ))}
      </ScatterChart>
    )
  }

  // Direct labels for a 2–4 series line chart, at each line's right end, in ink (never the series
  // colour), de-collided to ≥ 16px. Computed from the same domain the y-axis draws.
  let labels: Array<{ i: number; top: number }> = []
  if (directLabels) {
    const last = data[data.length - 1]
    const plotTop = MARGIN_TOP
    const plotHeight = PLOT_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM - X_AXIS_HEIGHT
    const ends = visibleIdx
      .map((i) => ({ i, v: last ? last[seriesKey(i)] : null }))
      .filter((e): e is { i: number; v: number } => typeof e.v === "number")
    const ys = decollide(
      ends.map((e) => valueToY(e.v, domain, plotTop, plotHeight)),
      DIRECT_LABEL_GAP,
      plotTop,
      plotTop + plotHeight,
    )
    labels = ends.map((e, k) => ({ i: e.i, top: ys[k] }))
  }

  const yTitle =
    chart.kind === "scatter" && names.length === 1
      ? columnHeading(names[0], record.spec.columns.find((c) => c.name === names[0])?.unit ?? null)
      : null
  const xTitle =
    chart.kind === "scatter"
      ? columnHeading(chart.x, record.spec.columns.find((c) => c.name === chart.x)?.unit ?? null)
      : null

  return (
    <div data-testid="artifact-chart">
      {multi && (
        <div role="group" aria-label={LEGEND_GROUP_LABEL} className="mb-2 flex flex-wrap gap-x-2 gap-y-1">
          {names.map((name, i) => {
            const off = hidden.has(i)
            return (
              <button
                key={seriesKey(i)}
                type="button"
                aria-pressed={!off}
                onClick={() => toggle(i)}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-md border border-transparent px-2 text-xs leading-[1.4] hover:border-border sm:h-6",
                  off ? "text-muted-foreground line-through" : "text-foreground",
                )}
              >
                <span
                  data-testid="legend-swatch"
                  data-color={colors[i]}
                  aria-hidden="true"
                  className={cn("size-2.5 shrink-0 rounded-[3px]", off && "opacity-25")}
                  style={{ backgroundColor: colors[i] }}
                />
                {name}
              </button>
            )
          })}
        </div>
      )}
      {yTitle && <div className="mb-1 text-xs leading-[1.4] text-muted-foreground">{yTitle}</div>}
      <div role="img" aria-label={ariaLabel(record)} aria-describedby={srId} className="relative h-[240px] w-full">
        <ResponsiveContainer width="100%" height={PLOT_HEIGHT} onResize={(w) => setWidth(w)}>
          {plot}
        </ResponsiveContainer>
        {labels.map(({ i, top }) => (
          <span
            key={seriesKey(i)}
            aria-hidden="true"
            className="pointer-events-none absolute whitespace-nowrap text-xs leading-[1.4] text-muted-foreground"
            style={{ top: top - 8, left: Math.max(0, width - MARGIN_RIGHT_LABELS + 8) }}
          >
            {names[i]}
          </span>
        ))}
        {allHidden && (
          <div className="absolute inset-0 flex items-center justify-center text-xs leading-[1.4] text-muted-foreground">
            {ALL_SERIES_HIDDEN}
          </div>
        )}
      </div>
      <p id={srId} className="sr-only">
        {srSummary(record)}
      </p>
      {xTitle && <div className="mt-1 text-right text-xs leading-[1.4] text-muted-foreground">{xTitle}</div>}
    </div>
  )
}
