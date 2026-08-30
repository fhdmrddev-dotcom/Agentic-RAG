/** Phase 217.1 (BE-6 / Plan 17) — the CHECKED QUERIES table + Add-a-check flow.
 *
 * Verdict derivation (pure, client-side, from the row's own two fields):
 *   checked_at === null          → "Not checked yet"
 *   last_rank === null           → "Not found" (checked but the doc didn't rank —
 *                                   the honest fourth word; never folded into Slipped)
 *   previous_rank === null || last_rank <= previous_rank  → "Holding"
 *   last_rank > previous_rank    → "Slipped"
 *
 * ⛔ The rank cell renders a SENTENCE ("was 2, now 6"), never a bare pair with no verb.
 *
 * ⛔ Reconcile-by-fetch (D-v2.5-03): after create/trigger, re-fetch the list rather than
 * trusting an optimistic row that the server may not have persisted.
 */

import { useCallback, useEffect, useState } from "react"
import { Plus } from "lucide-react"
import {
  listCheckedQueries,
  createCheckedQuery,
  triggerCheck,
  deleteCheckedQuery,
  type CheckedQueryRow,
} from "@/lib/api"

export interface CheckedQueriesSectionProps {
  /** Lift the live count so the parent's stat tile can show it (one fetch, two consumers). */
  onTotalChange?: (total: number) => void
}

export function verdictFor(row: CheckedQueryRow): string {
  if (row.checked_at === null) return "Not checked yet"
  if (row.last_rank === null) return "Not found"
  if (row.previous_rank === null || row.last_rank <= row.previous_rank) return "Holding"
  return "Slipped"
}

/** "was 2, now 6" — a sentence, never a bare number pair. */
export function rankChangeSentence(row: CheckedQueryRow): string | null {
  if (row.checked_at === null) return null
  if (row.last_rank === null) return "not ranked"
  if (row.previous_rank === null) return `ranked ${row.last_rank}`
  return `was ${row.previous_rank}, now ${row.last_rank}`
}

function RankCell({ row }: { row: CheckedQueryRow }) {
  const sentence = rankChangeSentence(row)
  if (sentence === null) return <span className="text-muted-foreground">—</span>
  return <span className="tabular-nums">{sentence}</span>
}

function VerdictBadge({ row }: { row: CheckedQueryRow }) {
  const verdict = verdictFor(row)
  const color =
    verdict === "Slipped"
      ? "bg-red-400/10 text-red-400"
      : verdict === "Holding"
        ? "bg-emerald-400/10 text-emerald-400"
        : "bg-muted text-muted-foreground"
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 tabular-nums ${color}`}>
      {verdict}
    </span>
  )
}

export function CheckedQueriesSection({ onTotalChange }: CheckedQueriesSectionProps) {
  const [rows, setRows] = useState<CheckedQueryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [expectedDocId, setExpectedDocId] = useState("")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listCheckedQueries()
      setRows(res)
      onTotalChange?.(res.length)
    } catch {
      setError("Failed to load checked queries")
    } finally {
      setLoading(false)
    }
  }, [onTotalChange])

  useEffect(() => {
    void load()
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!question.trim() || !expectedDocId.trim()) {
      setError("Question and a target document are both required")
      return
    }
    try {
      const created = await createCheckedQuery({
        question: question.trim(),
        expected_document_id: expectedDocId.trim(),
      })
      // Immediately trigger a check so the row has a rank on first render
      // rather than sitting at "Not checked yet" indefinitely.
      await triggerCheck(created.id)
      setQuestion("")
      setExpectedDocId("")
      setFormOpen(false)
      await load() // reconcile-by-fetch
    } catch {
      setError("Failed to add the checked query")
    }
  }

  async function handleCheck(id: string) {
    try {
      await triggerCheck(id)
      await load() // reconcile-by-fetch
    } catch {
      setError("Failed to check this query")
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCheckedQuery(id)
      await load()
    } catch {
      setError("Failed to delete this query")
    }
  }

  if (loading) {
    return (
      <div className="ghost-border bg-card/50 rounded-lg p-4 space-y-3">
        <div className="animate-pulse bg-muted/30 h-4 w-48 rounded" />
        <div className="animate-pulse bg-muted/30 h-12 rounded" />
      </div>
    )
  }

  return (
    <div className="ghost-border bg-card/50 rounded-lg p-4" data-testid="health-checks">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-headline font-bold">Checked queries</h3>
        <button
          type="button"
          onClick={() => setFormOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 text-xs rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          {formOpen ? "Close" : "Add a check"}
        </button>
      </div>

      {error && <p className="text-xs text-destructive mb-3">{error}</p>}

      {formOpen && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 mb-4 rounded-lg border border-border/40 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Question</span>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What is the retention policy?"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Should find (document id)</span>
            <input
              value={expectedDocId}
              onChange={(e) => setExpectedDocId(e.target.value)}
              placeholder="Paste the document id that should rank"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium"
          >
            Add and check
          </button>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No checked queries yet. Add one to track how a question&rsquo;s top result moves.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Question</th>
                <th className="py-2 pr-3 font-medium">Should find</th>
                <th className="py-2 pr-3 font-medium">Rank</th>
                <th className="py-2 pr-3 font-medium">Verdict</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-3 min-w-0">
                    <span className="block truncate max-w-[240px]">{row.question}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {row.expected_document_id.slice(0, 8)}…
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <RankCell row={row} />
                  </td>
                  <td className="py-2 pr-3">
                    <VerdictBadge row={row} />
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleCheck(row.id)}
                      className="text-xs text-muted-foreground hover:text-foreground mr-3"
                    >
                      Re-check
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}