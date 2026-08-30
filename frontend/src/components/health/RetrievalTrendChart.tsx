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
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs space-y-0.5">
      <p className="font-medium text-foreground">{formatDate(point.date)}</p>
      <p className="text-primary">{point.found_something} found</p>
      <p className="text-muted-foreground">{point.found_nothing} not found</p>
      <p className="text-muted-foreground/60">{point.could_not_search} could not search</p>
    </div>
  )
}

export function RetrievalTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="ghost-border bg-card/50 rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-2 h-64">
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
    <div className="ghost-border bg-card/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-base font-headline font-bold">Coverage Trend</h3>
        <span className="text-xs text-muted-foreground ml-auto">Searches over time</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="foundSomething" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="foundNothing" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
              <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="couldNotSearch" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
              <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
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
          />
          <Area
            type="monotone"
            dataKey="found_nothing"
            stackId="s"
            stroke="none"
            fill="url(#foundNothing)"
          />
          <Area
            type="monotone"
            dataKey="found_something"
            stackId="s"
            stroke="none"
            fill="url(#foundSomething)"
          />
          <Line
            type="monotone"
            dataKey="retrieval_count"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
