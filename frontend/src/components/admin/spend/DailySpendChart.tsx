import React, { useState } from "react"
import type { DailySpendPoint } from "@/types/spend"

interface DailySpendChartProps {
  data: DailySpendPoint[]
  height?: number
}

export const DailySpendChart: React.FC<DailySpendChartProps> = ({ data, height = 180 }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
        No daily spend recorded in this window.
      </div>
    )
  }

  const maxSpend = Math.max(...data.map((d) => d.spendUsd), 1.0)
  const chartHeight = height - 40
  const barWidth = 16
  const gap = 14
  const totalWidth = data.length * (barWidth + gap) + 20

  return (
    <div className="relative flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-mono">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-500 shadow-sm shadow-indigo-500/30" />
            Rated Spend (USD)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/80 border border-amber-400/30" />
            Unrated Volume
          </span>
        </div>
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="text-[11px] font-mono text-foreground flex items-center gap-2">
            <span className="text-muted-foreground">{data[hoveredIdx].date}:</span>
            <span className="text-emerald-400 font-semibold">${data[hoveredIdx].spendUsd.toFixed(4)}</span>
            {data[hoveredIdx].unratedCount > 0 && (
              <span className="text-amber-400">({data[hoveredIdx].unratedCount} unrated)</span>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${totalWidth} ${height}`}
          className="w-full overflow-visible"
          style={{ height: `${height}px`, minWidth: `${totalWidth}px` }}
        >
          {/* Horizontal grid lines */}
          <line
            x1="0"
            y1={chartHeight}
            x2={totalWidth}
            y2={chartHeight}
            stroke="hsl(217 19% 18%)"
            strokeDasharray="2 2"
          />
          <line
            x1="0"
            y1={chartHeight / 2}
            x2={totalWidth}
            y2={chartHeight / 2}
            stroke="hsl(217 19% 14%)"
            strokeDasharray="2 2"
          />

          {data.map((point, idx) => {
            const x = idx * (barWidth + gap) + 10
            const ratedBarHeight = Math.max((point.spendUsd / maxSpend) * chartHeight, 2)
            const ratedY = chartHeight - ratedBarHeight

            // Unrated indicator height (scaled relative to max 15 unrated)
            const unratedHeight = point.unratedCount > 0
              ? Math.min(Math.max((point.unratedCount / 10) * 24, 6), 36)
              : 0
            const unratedY = Math.max(ratedY - unratedHeight - 2, 4)

            const isHovered = hoveredIdx === idx

            return (
              <g
                key={point.date || idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer transition-opacity"
              >
                {/* Background hover column */}
                <rect
                  x={x - gap / 2}
                  y="0"
                  width={barWidth + gap}
                  height={height}
                  fill={isHovered ? "hsl(217 19% 18% / 0.3)" : "transparent"}
                  rx="4"
                />

                {/* Overlaid amber segment for unrated runs */}
                {point.unratedCount > 0 && (
                  <rect
                    x={x}
                    y={unratedY}
                    width={barWidth}
                    height={unratedHeight}
                    fill="hsl(38 92% 50% / 0.85)"
                    stroke="hsl(38 92% 65% / 0.4)"
                    strokeWidth="1"
                    rx="2"
                  />
                )}

                {/* Rated spend bar */}
                <rect
                  x={x}
                  y={ratedY}
                  width={barWidth}
                  height={ratedBarHeight}
                  fill={isHovered ? "hsl(239 84% 75%)" : "hsl(239 84% 67%)"}
                  rx="2"
                  className="transition-colors duration-150"
                />

                {/* Day label */}
                <text
                  x={x + barWidth / 2}
                  y={height - 10}
                  textAnchor="middle"
                  fill={isHovered ? "hsl(210 40% 98%)" : "hsl(215 20% 55%)"}
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {point.dayLabel || point.date.slice(-2)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
