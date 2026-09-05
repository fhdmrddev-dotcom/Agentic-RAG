import { AnimatedNumber } from "@/components/ui/AnimatedNumber"

interface Props {
  score: number
  size?: "lg" | "sm"
}

export function HealthScoreGauge({ score, size = "lg" }: Props) {
  const v = Math.max(0, Math.min(100, score))

  const strokeColor = v >= 80 ? "#34d399" : v >= 60 ? "#fbbf24" : "#f87171"
  const colorClass  = v >= 80 ? "text-emerald-400" : v >= 60 ? "text-amber-400" : "text-red-400"
  const label       = v >= 80 ? "Healthy" : v >= 60 ? "Needs Attention" : "At Risk"

  const isLg = size === "lg"

  // Ring dimensions — all math on a <circle>, no arc path direction issues
  const SIZE = isLg ? 176 : 96
  const cx   = SIZE / 2
  const cy   = SIZE / 2
  const sw   = isLg ? 14 : 9
  const r    = cx - sw / 2 - 2          // circle sits snugly inside the SVG
  const circ = 2 * Math.PI * r          // full circumference
  const fill = (v / 100) * circ         // filled length

  return (
    <div className="flex flex-col items-center">
      {/* Relative container so the score overlay can be centered */}
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <defs>
            <linearGradient id={`gaugeGrad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="1" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.8" />
            </linearGradient>
            <filter id={`gaugeGlow-${size}`} x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor={strokeColor} floodOpacity="0.3" />
            </filter>
          </defs>
          {/* Muted background track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="hsl(var(--muted) / 0.5)"
            strokeWidth={sw}
          />
          {/* Coloured fill — rotate −90° so it starts at 12 o'clock */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={`url(#gaugeGrad-${size})`}
            filter={`url(#gaugeGlow-${size})`}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${fill} ${circ}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease-out" }}
          />
        </svg>

        {/* Score + label centered via absolute overlay (avoids SVG font quirks) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold font-headline tabular-nums leading-none ${colorClass} ${isLg ? "text-4xl" : "text-2xl"}`}>
            <AnimatedNumber value={v} />
          </span>
          <span className={`font-medium text-muted-foreground mt-0.5 ${isLg ? "text-xs" : "text-[9px]"}`}>
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}
