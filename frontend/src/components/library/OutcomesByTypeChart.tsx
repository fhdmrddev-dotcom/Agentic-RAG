/**
 * Ingestion outcomes per file type — the most ACTIONABLE chart on the Health tab.
 *
 * ⭐ WHY THIS EXISTS. The Health tab's headline was "46 of 119 found by a search", which is
 * DEMAND, not health: a perfectly ingested library nobody queried rendered a red arc reading
 * "61% of your library is broken" when it meant "61% has not been needed yet". This chart is
 * the opposite — every bar names something the product owns and a person can fix. *"PDFs fail
 * 30% of the time"* is a next action. *"46 documents were found"* is not.
 *
 * ⛔ NO GRADE WORD, matching `CoverageRing`'s rule — the sketch bans a bare proportion
 * presented as a quality verdict. Counts only.
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

export interface TypeOutcome {
  type: string
  completed: number
  failed: number
}

interface Props {
  data: TypeOutcome[]
}

export function OutcomesByTypeChart({ data }: Props) {
  /**
   * ⚠ An empty library is not a broken chart. Recharts renders an axis pair over an empty
   * array, which reads as "everything failed" rather than "nothing here yet" — so say it.
   */
  if (!data.length) {
    return (
      <div
        data-testid="health-outcomes-empty"
        className="ghost-border bg-card/50 rounded-lg p-4 h-full min-h-[176px] flex items-center justify-center"
      >
        <span className="text-xs text-muted-foreground">Nothing has been ingested yet.</span>
      </div>
    )
  }

  return (
    <div
      data-testid="health-outcomes-chart"
      className="ghost-border bg-card/50 rounded-lg p-4 h-full"
    >
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-foreground">Ingested by type</h3>
        <p className="text-xs text-muted-foreground">Which formats read cleanly</p>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted) / 0.25)" vertical={false} />
          <XAxis
            dataKey="type"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.2)" }}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          {/*
            ⚠ `failed` is stacked ON TOP of `completed` on the same key so the bar's full
            height is the type's total. Two side-by-side bars would let a reader compare the
            wrong pair — a tall green bar beside a short red one looks like a lot of failures
            until you notice the axis.
          */}
          <Bar dataKey="completed" stackId="a" fill="#34d399" radius={[0, 0, 2, 2]} name="read" />
          <Bar dataKey="failed" stackId="a" fill="#f87171" radius={[2, 2, 0, 0]} name="could not read" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
