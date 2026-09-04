/** Phase 217.1-12 — the coverage ring, copied from HealthScoreGauge.tsx geometry
 *  with the grade word DELETED and numerator-and-denominator in its place.
 *
 *  ⛔ No 0-100 grade word ("Healthy"/"Needs Attention"/"At Risk") anywhere in this
 *  component — the sketch bans a bare proportion as quality grade.
 */

interface Props {
  retrieved: number
  total: number
  size?: "lg" | "sm"
}

export function CoverageRing({ retrieved, total, size = "lg" }: Props) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (retrieved / total) * 100)) : 0

  const strokeColor = pct >= 80 ? "#34d399" : pct >= 60 ? "#fbbf24" : "#f87171"
  const isLg = size === "lg"

  const SIZE = isLg ? 176 : 96
  const cx = SIZE / 2
  const cy = SIZE / 2
  const sw = isLg ? 14 : 9
  const r = cx - sw / 2 - 2
  const circ = 2 * Math.PI * r
  const fill = (pct / 100) * circ

  return (
    <div className="flex flex-col items-center">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={sw}
          />
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${fill} ${circ}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.6s ease-out, stroke 0.4s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold font-headline tabular-nums leading-none text-foreground ${isLg ? "text-2xl" : "text-lg"}`}>
            {retrieved}
            <span className="text-muted-foreground">/{total}</span>
          </span>
          <span className={`font-medium text-muted-foreground mt-0.5 ${isLg ? "text-xs" : "text-[9px]"}`}>
            found by a search
          </span>
        </div>
      </div>
    </div>
  )
}