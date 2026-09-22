import React, { useState } from "react"
import type { ModelSpendShare } from "@/types/spend"

interface SpendDonutChartProps {
  data: ModelSpendShare[]
  totalSpendUsd: number
  size?: number
}

export const SpendDonutChart: React.FC<SpendDonutChartProps> = ({
  data,
  totalSpendUsd,
  size = 180,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const ratedModels = data.filter((m) => m.isRated && m.spendUsd !== null && m.spendUsd > 0)
  const unratedModels = data.filter((m) => !m.isRated || m.unratedCount > 0)

  const radius = size / 2 - 20
  const circumference = 2 * Math.PI * radius
  const strokeWidth = 14
  const center = size / 2

  let accumulatedPct = 0

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Donut SVG */}
      <div className="relative flex-none" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(217 19% 14%)"
            strokeWidth={strokeWidth}
          />

          {/* Rated segments */}
          {ratedModels.map((item, idx) => {
            const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`
            const strokeDashoffset = -((accumulatedPct / 100) * circumference)
            accumulatedPct += item.percentage

            const isHovered = hoveredIdx === idx

            return (
              <circle
                key={item.modelId}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer transition-all duration-200"
              />
            )
          })}
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
          {hoveredIdx !== null && ratedModels[hoveredIdx] ? (
            <>
              <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground truncate max-w-[90px]">
                {ratedModels[hoveredIdx].modelId}
              </span>
              <span className="text-base font-bold font-mono text-emerald-400">
                ${ratedModels[hoveredIdx].spendUsd?.toFixed(2)}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {ratedModels[hoveredIdx].percentage}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
                Rated Total
              </span>
              <span className="text-lg font-bold font-mono text-foreground">
                ${totalSpendUsd.toFixed(2)}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {ratedModels.length} models
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 min-w-0 space-y-2 text-xs">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/40">
          Model Share & Honesty
        </div>

        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {ratedModels.map((item, idx) => (
            <div
              key={item.modelId}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="flex items-center justify-between gap-2 p-1 rounded hover:bg-card/80 cursor-pointer font-mono"
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-none"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate text-foreground font-medium">{item.modelId}</span>
              </div>
              <div className="flex items-center gap-2 flex-none text-right">
                <span className="text-muted-foreground">{item.percentage}%</span>
                <span className="text-emerald-400 font-semibold">${item.spendUsd?.toFixed(4)}</span>
              </div>
            </div>
          ))}

          {/* Explicit Unrated Models Disclosure */}
          {unratedModels.map((item) => (
            <div
              key={item.modelId}
              className="flex items-center justify-between gap-2 p-1 rounded bg-amber-500/10 border border-amber-500/20 font-mono text-[11px]"
            >
              <div className="flex items-center gap-2 truncate text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full flex-none bg-amber-500" />
                <span className="truncate">{item.modelId}</span>
              </div>
              <div className="flex items-center gap-1 text-amber-300 font-medium flex-none">
                <span>{item.unratedCount} unrated runs</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20">EXCLUDED</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
