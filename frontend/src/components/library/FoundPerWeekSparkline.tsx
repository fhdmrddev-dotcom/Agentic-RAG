/** Phase 217.1-15 — inline SVG polyline sparkline.
 *
 * No recharts import — keeps the app's one code-split out of the 430px panel.
 * Pure leaf: `{ weeks: { week: string; count: number }[] }` renders a polyline.
 * Geometry from `HealthScoreGauge.tsx:16-24` (compute the path, transition).
 */

import { useMemo } from "react"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"

interface WeekBucket {
  week: string
  count: number
}

interface Props {
  weeks: WeekBucket[]
}

export function FoundPerWeekSparkline({ weeks }: Props) {
  const maxCount = useMemo(() => Math.max(1, ...weeks.map((w) => w.count)), [weeks])

  if (weeks.length < 2) {
    return (
      <div className="text-xs text-muted-foreground tabular-nums">
        {weeks.length === 1 ? (
          <>
            <AnimatedNumber value={weeks[0].count} /> this week
          </>
        ) : (
          "No data"
        )}
      </div>
    )
  }

  const W = 120
  const H = 32
  const pad = 2
  const stepX = (W - pad * 2) / (weeks.length - 1)

  const points = weeks.map((w, i) => {
    const x = pad + i * stepX
    const y = H - pad - ((w.count / maxCount) * (H - pad * 2))
    return { x, y, str: `${x},${y}` }
  })

  const areaPoints = [
    `${pad},${H - pad}`,
    ...points.map((p) => p.str),
    `${pad + (weeks.length - 1) * stepX},${H - pad}`,
  ].join(" ")

  const lastPoint = points[points.length - 1]

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="shrink-0 overflow-visible"
      aria-label={`Found per week, ${weeks.length} weeks`}
    >
      <defs>
        <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill="url(#sparklineGrad)"
      />
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.map((p) => p.str).join(" ")}
      />
      {lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={2.5}
          fill="hsl(var(--primary))"
          className="animate-pulse"
        />
      )}
    </svg>
  )
}

/** Bucket an array of ISO date strings into week-count pairs.
 *  The most recent week is first; weeks with zero searches are included
 *  so the sparkline never skips a gap. */
export function bucketByWeek(dates: string[], maxWeeks = 12): WeekBucket[] {
  if (dates.length === 0) return []

  const now = Date.now()
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000

  // Build week buckets from now backward
  const buckets: WeekBucket[] = []
  for (let i = 0; i < maxWeeks; i++) {
    const weekEnd = now - i * ONE_WEEK
    const weekStart = now - (i + 1) * ONE_WEEK
    const count = dates.filter((d) => {
      const t = new Date(d).getTime()
      return t >= weekStart && t < weekEnd
    }).length
    buckets.push({ week: `w${i}`, count })
  }

  // Reverse so the oldest week is first (left-to-right)
  return buckets.reverse()
}