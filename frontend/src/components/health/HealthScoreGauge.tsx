import { useMemo } from "react"

interface Props {
  score: number
  size?: "lg" | "sm"
}

export function HealthScoreGauge({ score, size = "lg" }: Props) {
  const clamped = Math.max(0, Math.min(100, score))

  const { colorClass, strokeColor, label } = useMemo(() => {
    if (clamped >= 80) return { colorClass: "text-emerald-400", strokeColor: "#34d399", label: "Healthy" }
    if (clamped >= 60) return { colorClass: "text-amber-400", strokeColor: "#fbbf24", label: "Needs Attention" }
    return { colorClass: "text-red-400", strokeColor: "#f87171", label: "At Risk" }
  }, [clamped])

  const cx = 100
  const cy = 100
  const r = 80
  const totalLength = Math.PI * r
  const dashArray = `${(clamped / 100) * totalLength} ${totalLength}`

  const angleRad = Math.PI * (1 - clamped / 100)
  const needleLen = r - 4
  const tipX = cx + needleLen * Math.cos(angleRad)
  const tipY = cy - needleLen * Math.sin(angleRad)

  // Points on the arc for zone boundaries
  const ptAt = (s: number) => {
    const a = Math.PI * (1 - s / 100)
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }
  }
  const p0   = ptAt(0)
  const p60  = ptAt(60)
  const p80  = ptAt(80)
  const p100 = ptAt(100)

  const sw = 13
  const isLg = size === "lg"

  return (
    <div className={`${isLg ? "w-full h-56" : "w-32"} flex flex-col items-center justify-center`}>
      <svg viewBox="0 0 200 120" className="w-full">
        {/* Zone backgrounds — always visible so color context is clear at any score */}
        <path
          d={`M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 0 0 ${p60.x.toFixed(2)} ${p60.y.toFixed(2)}`}
          fill="none" stroke="#f87171" strokeOpacity="0.22" strokeWidth={sw} strokeLinecap="butt"
        />
        <path
          d={`M ${p60.x.toFixed(2)} ${p60.y.toFixed(2)} A ${r} ${r} 0 0 0 ${p80.x.toFixed(2)} ${p80.y.toFixed(2)}`}
          fill="none" stroke="#fbbf24" strokeOpacity="0.22" strokeWidth={sw} strokeLinecap="butt"
        />
        <path
          d={`M ${p80.x.toFixed(2)} ${p80.y.toFixed(2)} A ${r} ${r} 0 0 0 ${p100.x.toFixed(2)} ${p100.y.toFixed(2)}`}
          fill="none" stroke="#34d399" strokeOpacity="0.22" strokeWidth={sw} strokeLinecap="butt"
        />
        {/* Score fill arc — overlays the zone background up to the current score */}
        <path
          d={`M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 0 0 ${p100.x.toFixed(2)} ${p100.y.toFixed(2)}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          style={{ transition: "stroke-dasharray 0.7s ease-out" }}
        />
        {/* Zone dividers at 60 and 80 */}
        {[60, 80].map((s) => {
          const a = Math.PI * (1 - s / 100)
          return (
            <line
              key={s}
              x1={(cx + (r - sw * 0.55) * Math.cos(a)).toFixed(2)}
              y1={(cy - (r - sw * 0.55) * Math.sin(a)).toFixed(2)}
              x2={(cx + (r + sw * 0.55) * Math.cos(a)).toFixed(2)}
              y2={(cy - (r + sw * 0.55) * Math.sin(a)).toFixed(2)}
              stroke="hsl(var(--background))"
              strokeWidth="2.5"
            />
          )
        })}
        {/* Needle pivot — colored by zone */}
        <circle
          cx={cx} cy={cy} r="5"
          fill={strokeColor}
          style={{ transition: "fill 0.7s ease-out" }}
        />
        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={tipX.toFixed(2)} y2={tipY.toFixed(2)}
          stroke="hsl(var(--foreground))"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ transition: "all 0.7s ease-out" }}
        />
      </svg>
      {/* Score text */}
      <div className="flex flex-col items-center -mt-2">
        <span className={`font-bold font-headline tabular-nums leading-none ${colorClass} ${isLg ? "text-4xl" : "text-2xl"}`}>
          {clamped}
        </span>
        <span className={`font-medium ${isLg ? "text-sm" : "text-xs"} text-muted-foreground mt-1`}>{label}</span>
      </div>
    </div>
  )
}
