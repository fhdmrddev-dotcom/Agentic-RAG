import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { TrendingUp, BarChart3 } from "lucide-react"
import type { RetrievalTrendPoint } from "@/lib/api"

interface Props {
  data: RetrievalTrendPoint[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

interface TooltipPayloadItem {
  payload?: RetrievalTrendPoint & { formattedDate?: string }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  if (!point) return null
  return (
    <div className="bg-card/90 backdrop-blur-md border border-border/60 rounded-xl px-3.5 py-2.5 shadow-xl text-xs space-y-1.5 animate-chartFadeIn">
      <p className="font-semibold text-foreground border-b border-border/30 pb-1">{formatDate(point.date)}</p>
      <div className="flex items-center gap-2 text-primary font-medium">
        <span className="w-2 h-2 rounded-full bg-primary" />
        <span>{point.found_something} found</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-muted-foreground/60" />
        <span>{point.found_nothing} not found</span>
      </div>
      {point.could_not_search > 0 && (
        <div className="flex items-center gap-2 text-destructive font-medium">
          <span className="w-2 h-2 rounded-full bg-destructive" />
          <span>{point.could_not_search} could not search</span>
        </div>
      )}
    </div>
  )
}

export function RetrievalTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center space-y-2 h-64">
        <BarChart3 className="h-8 w-8 text-muted-foreground opacity-40" />
        <p className="text-sm font-medium text-muted-foreground">No retrieval data yet</p>
        <p className="text-xs text-muted-foreground max-w-[240px]">
          Start chatting with your agent to see retrieval trends over time.
        </p>
      </div>
    )
  }

  const chartData = data.map((d) => ({
    ...d,
    formattedDate: formatDate(d.date),
  }))

  return (
    <div className="group relative rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-sm p-5 shadow-sm transition-all duration-300 card-interactive overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-headline font-bold text-foreground">Coverage Trend</h3>
          <p className="text-[11px] text-muted-foreground">Searches over time</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="foundSomething" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="foundNothing" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
              <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="couldNotSearch" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.25} />
              <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="could_not_search"
            stackId="s"
            stroke="none"
            fill="url(#couldNotSearch)"
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          />
          <Area
            type="monotone"
            dataKey="found_nothing"
            stackId="s"
            stroke="none"
            fill="url(#foundNothing)"
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          />
          <Area
            type="monotone"
            dataKey="found_something"
            stackId="s"
            stroke="none"
            fill="url(#foundSomething)"
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          />
          <Line
            type="monotone"
            dataKey="retrieval_count"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, stroke: "hsl(var(--card))", strokeWidth: 2, fill: "hsl(var(--primary))" }}
            isAnimationActive={true}
            animationDuration={1000}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
