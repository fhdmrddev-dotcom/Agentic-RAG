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
  // All arcs share one path — zone segments use dashoffset so boundaries are pixel-perfect
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`
  const totalLength = Math.PI * r
  const z1 = totalLength * 0.60  // 0–60  (red zone)
  const z2 = totalLength * 0.20  // 60–80 (amber zone)
  const z3 = totalLength * 0.20  // 80–100 (green zone)

  // Score fill
  const fillLength = (clamped / 100) * totalLength

  // Needle
  const needleLen = r - 4
  const angleRad = Math.PI * (1 - clamped / 100)
  const tipX = (cx + needleLen * Math.cos(angleRad)).toFixed(2)
  const tipY = (cy - needleLen * Math.sin(angleRad)).toFixed(2)

  // Zone boundary divider ticks
  const dividers = [60, 80].map((s) => {
    const a = Math.PI * (1 - s / 100)
    return {
      key: s,
      x1: (cx + (r - 8) * Math.cos(a)).toFixed(2),
      y1: (cy - (r - 8) * Math.sin(a)).toFixed(2),
      x2: (cx + (r + 2) * Math.cos(a)).toFixed(2),
      y2: (cy - (r + 2) * Math.sin(a)).toFixed(2),
    }
  })

  const sw = 13
  const isLg = size === "lg"

  return (
    <div className={`${isLg ? "w-full h-56" : "w-32"} flex flex-col items-center justify-center`}>
      <svg viewBox="0 0 200 120" className="w-full">
        {/* Zone backgrounds — same arcPath + dashoffset, no separate endpoints, no seam artifacts */}
        <path d={arcPath} fill="none" stroke="#f87171" strokeOpacity="0.22" strokeWidth={sw}
          strokeLinecap="butt" strokeDasharray={`${z1} ${totalLength}`} />
        <path d={arcPath} fill="none" stroke="#fbbf24" strokeOpacity="0.22" strokeWidth={sw}
          strokeLinecap="butt" strokeDasharray={`${z2} ${totalLength}`} strokeDashoffset={-z1} />
        <path d={arcPath} fill="none" stroke="#34d399" strokeOpacity="0.22" strokeWidth={sw}
          strokeLinecap="butt" strokeDasharray={`${z3} ${totalLength}`} strokeDashoffset={-(z1 + z2)} />
        {/* Score fill — same path, animated */}
        <path d={arcPath} fill="none" stroke={strokeColor} strokeWidth={sw} strokeLinecap="butt"
          strokeDasharray={`${fillLength} ${totalLength}`}
          style={{ transition: "stroke-dasharray 0.7s ease-out" }} />
        {/* Zone dividers at 60 and 80 */}
        {dividers.map(({ key, x1, y1, x2, y2 }) => (
          <line key={key} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="hsl(var(--background))" strokeWidth="2.5" />
        ))}
        {/* Needle pivot — zone color */}
        <circle cx={cx} cy={cy} r="5" fill={strokeColor}
          style={{ transition: "fill 0.7s ease-out" }} />
        {/* Needle */}
        <line x1={cx} y1={cy} x2={tipX} y2={tipY}
          stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round"
          style={{ transition: "all 0.7s ease-out" }} />
      </svg>
      <div className="flex flex-col items-center -mt-2">
        <span className={`font-bold font-headline tabular-nums leading-none ${colorClass} ${isLg ? "text-4xl" : "text-2xl"}`}>
          {clamped}
        </span>
        <span className={`font-medium ${isLg ? "text-sm" : "text-xs"} text-muted-foreground mt-1`}>{label}</span>
      </div>
    </div>
  )
}
