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

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts"

import { typeColor } from "./SegmentDonut"

export interface TypeOutcome {
  type: string
  completed: number
  failed: number
  documents?: number
  chunks?: number
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

  // ⚠ The bar shows the top 8 by volume; the DONUT accounts for every format via its
  // "Other" bucket, so nothing is unrepresented on the page even when a bar is omitted.
  const shown = data.slice(0, 8)

  return (
    <div
      data-testid="health-outcomes-chart"
      className="ghost-border bg-card/50 rounded-lg p-4 h-full"
    >
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-foreground">Content weight by type</h3>
        <p className="text-xs text-muted-foreground">Searchable chunks each format contributes</p>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={shown} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
            ⭐ HEIGHT is chunk volume — how much searchable CONTENT a format contributes, which
            is a different question from how many FILES it has: one 300-page PDF outweighs
            thirty short notes. COLOUR identifies the format and matches the donut's palette
            exactly, so "PDF" is the same colour in both. It is identity, never a grade.

            ⚠ `failed` stays stacked in red on top, because a format that fails to read is the
            one thing here that IS a verdict. It is invisible at zero, which is correct.
          */}
          <Bar dataKey="chunks" stackId="a" radius={[0, 0, 2, 2]} name="chunks">
            {shown.map((d, i) => (
              <Cell key={d.type} fill={typeColor(i)} />
            ))}
          </Bar>
          <Bar dataKey="failed" stackId="a" fill="#f87171" radius={[2, 2, 0, 0]} name="could not read" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
