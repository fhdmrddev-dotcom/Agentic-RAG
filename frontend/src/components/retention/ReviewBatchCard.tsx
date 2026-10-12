/**
 * Phase 275 plan 04 (S4 / D-10) — a review batch: a person decides Keep / Archive / Delete per row.
 *
 * NOTHING is pre-selected: an undecided row stays waiting. With no deletes chosen the primary is
 * `Apply {a+b} decisions`; with deletes, the same type-the-count row as a delete batch counts ONLY
 * the deletes, and the button reads `Apply decisions and delete {c} permanently` (destructive).
 */
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { confirmBatch, type ConfirmResult, type QueueBatch } from "@/lib/api/retention"
import { BatchFailure, BatchHeader, BatchNotes, BatchResultBanner, BatchTable, TypeTheCount } from "./DeleteBatchCard"
import { RETENTION_COPY, fillCopy } from "./retentionCopy"

const C = RETENTION_COPY

type Decision = "keep" | "archive" | "delete"

const OPTIONS: Array<{ value: Decision; label: string }> = [
  { value: "keep", label: C.contract.decisionKeep },
  { value: "archive", label: C.contract.decisionArchive },
  { value: "delete", label: C.contract.decisionDelete },
]

export function ReviewBatchCard({
  batch,
  onRecorded,
  onReload,
}: {
  batch: QueueBatch
  onRecorded?: () => void
  onReload: () => void
}) {
  const [decisions, setDecisions] = useState<Record<string, Decision | undefined>>({})
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [result, setResult] = useState<ConfirmResult | null>(null)

  const ids = (d: Decision) => batch.rows.filter((r) => decisions[r.document_id] === d).map((r) => r.document_id)
  const keepIds = ids("keep")
  const archiveIds = ids("archive")
  const deleteIds = ids("delete")
  const undecided = batch.rows.length - keepIds.length - archiveIds.length - deleteIds.length
  const c = deleteIds.length

  async function submit() {
    setBusy(true)
    setFailure(null)
    try {
      const res = await confirmBatch(batch.policy_id, {
        delete_ids: deleteIds,
        keep_ids: keepIds,
        archive_ids: archiveIds,
        typed_count: c,
      })
      setResult(res)
      onRecorded?.()
    } catch {
      // With deletes, some may already have run: the honest confirm-failure copy.
      setFailure(c > 0 ? C.contract.confirmFailed : C.contract.decisionsFailed)
    } finally {
      setBusy(false)
    }
  }

  if (result) return <BatchResultBanner result={result} />

  return (
    <article className="grid gap-4 rounded-[10px] border border-border bg-card p-4" data-testid="review-batch">
      <BatchHeader batch={batch} />
      <BatchTable
        rows={batch.rows}
        decision={(r) => (
          <div role="radiogroup" aria-label={r.name} className="flex flex-wrap gap-1">
            {OPTIONS.map((o) => (
              <label key={o.value} className="flex min-h-8 cursor-pointer items-center gap-1 px-1 text-xs">
                <input
                  type="radio"
                  name={`decision-${batch.policy_id}-${r.document_id}`}
                  className="accent-[hsl(var(--primary))]"
                  checked={decisions[r.document_id] === o.value}
                  onChange={() => {
                    setDecisions((prev) => ({ ...prev, [r.document_id]: o.value }))
                    setTyped("")
                  }}
                />
                {o.label}
              </label>
            ))}
          </div>
        )}
      />
      <BatchNotes batch={batch} />
      <p className="text-xs text-muted-foreground" data-testid="review-footer">
        {fillCopy(C.specTemplates.reviewFooter, { a: keepIds.length, b: archiveIds.length, c, d: undecided })}
      </p>
      {c > 0 ? (
        <TypeTheCount
          n={c}
          typed={typed}
          onTyped={setTyped}
          busy={busy}
          label={fillCopy(C.specTemplates.applyAndDelete, { c })}
          onConfirm={submit}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            type="button"
            className="font-semibold"
            disabled={busy || keepIds.length + archiveIds.length === 0}
            onClick={submit}
          >
            {fillCopy(C.specTemplates.applyDecisions, { N: keepIds.length + archiveIds.length })}
          </Button>
        </div>
      )}
      {failure && <BatchFailure message={failure} onReload={onReload} />}
    </article>
  )
}
