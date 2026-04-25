interface Props {
  score: number
  size?: "lg" | "sm"
}

export function HealthScoreGauge({ score, size = "lg" }: Props) {
  const v = Math.max(0, Math.min(100, score))

  const strokeColor = v >= 80 ? "#34d399" : v >= 60 ? "#fbbf24" : "#f87171"
  const colorClass  = v >= 80 ? "text-emerald-400" : v >= 60 ? "text-amber-400" : "text-red-400"
  const label       = v >= 80 ? "Healthy" : v >= 60 ? "Needs Attention" : "At Risk"

  // Semicircle: center (100, 100), r=76, from left (24,100) to right (176,100)
  const cx = 100, cy = 100, r = 76
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`
  const L   = Math.PI * r                              // arc circumference ≈ 238.8

  // Fill — minimum 5 px so a sliver of colour is always visible when score > 0
  const fill = v > 0 ? Math.max((v / 100) * L, 5) : 0

  // Needle tip (stops 10 px short of arc so it doesn't pierce the track)
  const angle = Math.PI * (1 - v / 100)
  const nx = (cx + (r - 10) * Math.cos(angle)).toFixed(1)
  const ny = (cy - (r - 10) * Math.sin(angle)).toFixed(1)

  const isLg = size === "lg"
  const sw   = isLg ? 14 : 11                          // track stroke width

  // Zone boundary tick helper (sits on the outer edge of the track)
  const tick = (s: number) => {
    const a  = Math.PI * (1 - s / 100)
    const ri = r - sw / 2 - 1
    const ro = r + sw / 2 + 1
    return {
      x1: (cx + ri * Math.cos(a)).toFixed(1), y1: (cy - ri * Math.sin(a)).toFixed(1),
      x2: (cx + ro * Math.cos(a)).toFixed(1), y2: (cy - ro * Math.sin(a)).toFixed(1),
    }
  }

  return (
    <div className={`flex flex-col items-center ${isLg ? "w-full" : ""}`}>
      {/* viewBox height 108 leaves just enough room below the arc for the pivot */}
      <svg
        viewBox="0 0 200 108"
        className={isLg ? "w-full max-w-[280px]" : "w-[110px]"}
        overflow="visible"
      >
        {/* ── Track (muted background) ── */}
        <path d={arc} fill="none"
          stroke="hsl(var(--muted))" strokeWidth={sw} strokeLinecap="round" />

        {/* ── Score fill ── */}
        <path d={arc} fill="none"
          stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${fill} ${L}`}
          style={{ transition: "stroke-dasharray 0.6s ease-out, stroke 0.4s ease-out" }} />

        {/* ── Zone boundary ticks at 60 and 80 ── */}
        {[60, 80].map((s) => {
          const t = tick(s)
          return (
            <line key={s} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke="hsl(var(--background))" strokeWidth="2" strokeLinecap="round" />
          )
        })}

        {/* ── Needle ── */}
        <line x1={cx} y1={cy} x2={nx} y2={ny}
          stroke="hsl(var(--foreground))" strokeWidth={isLg ? 2 : 1.5} strokeLinecap="round"
          style={{ transition: "all 0.6s ease-out" }} />

        {/* ── Pivot — always zone-coloured so status is clear even at score 0 ── */}
        <circle cx={cx} cy={cy} r={isLg ? 5 : 4} fill={strokeColor}
          style={{ transition: "fill 0.4s ease-out" }} />
      </svg>

      {/* Score + label below */}
      <div className={`flex flex-col items-center ${isLg ? "-mt-3" : "-mt-2"}`}>
        <span className={`font-bold font-headline tabular-nums leading-none ${colorClass} ${isLg ? "text-4xl" : "text-xl"}`}>
          {v}
        </span>
        <span className={`font-medium text-muted-foreground mt-0.5 ${isLg ? "text-sm" : "text-[10px]"}`}>
          {label}
        </span>
      </div>
    </div>
  )
}
