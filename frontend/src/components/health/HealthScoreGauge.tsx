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

  const ticks = [0, 25, 50, 75, 100]

  const dimensions = size === "lg"
    ? { width: "w-full", height: "h-56", textSize: "text-4xl", labelSize: "text-sm" }
    : { width: "w-32", height: "h-28", textSize: "text-2xl", labelSize: "text-xs" }

  return (
    <div className={`${dimensions.width} ${dimensions.height} flex flex-col items-center justify-center`}>
      <svg viewBox="0 0 200 120" className="w-full h-full">
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Foreground arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={dashArray}
          style={{ transition: "stroke-dasharray 0.7s ease-out" }}
        />
        {/* Ticks */}
        {ticks.map((t) => {
          const tickAngle = Math.PI * (1 - t / 100)
          const innerR = r - 18
          const outerR = r - 6
          const x1 = cx + innerR * Math.cos(tickAngle)
          const y1 = cy - innerR * Math.sin(tickAngle)
          const x2 = cx + outerR * Math.cos(tickAngle)
          const y2 = cy - outerR * Math.sin(tickAngle)
          return (
            <line
              key={t}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="2"
              strokeLinecap="round"
              opacity={0.5}
            />
          )
        })}
        {/* Needle pivot circle */}
        <circle cx={cx} cy={cy} r="5" fill="hsl(var(--card))" stroke="hsl(var(--foreground))" strokeWidth="2" />
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={tipX}
          y2={tipY}
          stroke="hsl(var(--foreground))"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ transition: "all 0.7s ease-out" }}
        />
      </svg>
      {/* Score text */}
      <div className="flex flex-col items-center -mt-2">
        <span className={`font-bold font-headline tabular-nums leading-none ${colorClass} ${dimensions.textSize}`}>
          {clamped}
        </span>
        <span className={`font-medium ${dimensions.labelSize} text-muted-foreground mt-1`}>{label}</span>
      </div>
    </div>
  )
}
