import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import type { MostRetrievedDoc } from "@/lib/api"

interface Props {
  docs: MostRetrievedDoc[]
}

function trimName(filename: string, max = 28): string {
  const base = filename.replace(/\.[^.]+$/, "")
  return base.length > max ? base.slice(0, max) + "…" : base
}

interface ChartEntry {
  name: string
  fullName: string
  count: number
}

interface TooltipPayload {
  payload?: ChartEntry
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const entry = payload[0].payload
  if (!entry) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs space-y-0.5">
      <p className="font-medium text-foreground max-w-48 truncate">{entry.fullName}</p>
      <p className="text-muted-foreground">
        {entry.count} retrieval{entry.count !== 1 ? "s" : ""} in 30 days
      </p>
    </div>
  )
}

export function RetrievalChart({ docs }: Props) {
  if (docs.length === 0) return null

  const data: ChartEntry[] = docs.map((doc) => ({
    name: trimName(doc.filename),
    fullName: doc.filename,
    count: doc.retrieval_count,
  }))

  const barHeight = 36
  const chartHeight = data.length * barHeight + 24

  return (
    <Card className="ghost-border bg-card/50 shadow-sm mb-6">
      <CardHeader className="pb-0 pt-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <CardTitle className="text-base font-headline font-bold">
            Document Usage — Last 30 Days
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-2 pr-6">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 0, right: 32, bottom: 0, left: 0 }}
            barCategoryGap="30%"
          >
            <CartesianGrid
              horizontal={false}
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={180}
              tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <Bar
              dataKey="count"
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
