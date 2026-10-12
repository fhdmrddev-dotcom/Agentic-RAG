/**
 * Phase 275 plan 04 (S4 / D-03 / D-11 / T-275-31) — one delete batch, confirmed by TYPING THE COUNT.
 *
 * Every row starts ticked. Unticking a row strikes it through, shows the D-11 note, and CLEARS the
 * typed value — so the count must be re-typed for the new N. `Delete {N} document(s) permanently`
 * is enabled only when the typed value equals N and N > 0; with every row unticked the button is
 * `Keep {N} documents` (outline) and needs no count, because keeping destroys nothing.
 *
 * The server is the wall: it re-checks `typed_count`, and re-checks every document's hold,
 * revision and fingerprint at the moment of confirm. A document put on hold after the sweep is
 * DROPPED, and the result banner says so by name.
 *
 * The shared batch pieces (table, notes, type-the-count row, result banner) are exported for
 * `ReviewBatchCard`, which applies the same confirm over its delete subset (D-10).
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ApiRefusal } from "@/lib/api/refusal"
import {
  CONFIRM_FALLBACK,
  confirmBatch,
  type ConfirmBatchBody,
  type ConfirmResult,
  type QueueBatch,
  type QueueRow,
} from "@/lib/api/retention"
import { AMBER_TEXT_CLASS, RETENTION_ACTION_META, RetentionChip, RichCopy } from "./RetentionChip"
import { RETENTION_COPY, fillCopy, formatRetentionDate, formatRetentionDateTime } from "./retentionCopy"

const C = RETENTION_COPY

export function BatchHeader({ batch }: { batch: QueueBatch }) {
  const meta = RETENTION_ACTION_META[batch.kind]
  return (
    <header className="grid gap-1">
      <h3 className="flex flex-wrap items-center gap-2 font-headline text-base font-semibold">
        <RetentionChip tone={meta.tone} icon={meta.icon}>
          {meta.label}
        </RetentionChip>
        {batch.policy_name}
      </h3>
      <p className="text-xs text-muted-foreground">
        {fillCopy(C.sketchTemplates.batchSub, {
          scope: batch.scope_text,
          kept_for: batch.kept_for_text,
          date: formatRetentionDateTime(batch.found_at),
        })}
      </p>
    </header>
  )
}

/** The skipped note + the re-check note, the same on both batch kinds. */
export function BatchNotes({ batch }: { batch: QueueBatch }) {
  const skipped = batch.held.length + batch.undecidable.length > 0
  return (
    <div className="grid gap-2 text-xs text-muted-foreground">
      {skipped && (
        <p>
          {fillCopy(C.sketchTemplates.skippedNote, {
            held: batch.held.length,
            held_names: batch.held.map((h) => h.name).join(", "),
            undecidable: batch.undecidable.length,
            undecidable_list: batch.undecidable.map((u) => `${u.name} — ${u.why}`).join("; "),
          })}
        </p>
      )}
      <p>
        <RichCopy text={C.sketchTemplates.recheck} />
      </p>
    </div>
  )
}

/** The batch table's first five columns; `decision` adds the review card's last column. */
export function BatchTable({
  rows,
  lead,
  rowClass,
  decision,
}: {
  rows: QueueRow[]
  lead?: (row: QueueRow) => ReactNode
  rowClass?: (row: QueueRow) => string
  decision?: (row: QueueRow) => ReactNode
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {lead && <th className="w-10 px-2 py-2" />}
            <th className="px-2 py-2">{C.ported.colDocument}</th>
            <th className="px-2 py-2">{C.ported.colFolder}</th>
            <th className="px-2 py-2">{C.ported.colDocumentDate}</th>
            <th className="px-2 py-2">{C.ported.colDueSince}</th>
            {decision && <th className="px-2 py-2">{C.contract.decision}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.document_id} className={cn("border-b border-border/60", rowClass?.(r))}>
              {lead && <td className="px-2 py-1">{lead(r)}</td>}
              <td className="px-2 py-2 font-semibold text-foreground">{r.name}</td>
              <td className="px-2 py-2 text-muted-foreground">{r.folder_path ?? ""}</td>
              <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{formatRetentionDate(r.document_date)}</td>
              <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{formatRetentionDate(r.due_since)}</td>
              {decision && <td className="px-2 py-1">{decision(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** `This can't be undone. Type **N** to confirm.` + the mono input + the destructive button. */
export function TypeTheCount({
  n,
  typed,
  onTyped,
  label,
  onConfirm,
  busy,
}: {
  n: number
  typed: string
  onTyped: (value: string) => void
  label: string
  onConfirm: () => void
  busy: boolean
}) {
  const undoneId = useId()
  const enabled = n > 0 && typed.trim() === String(n) && !busy
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
      <span className="text-sm text-muted-foreground">
        <span id={undoneId}>{C.ported.undone}</span>{" "}
        <RichCopy text={fillCopy(C.sketchTemplates.typeToConfirm, { N: n })} />
      </span>
      <input
        type="text"
        inputMode="numeric"
        aria-label={fillCopy(C.specTemplates.typeAria, { N: n })}
        aria-describedby={undoneId}
        value={typed}
        onChange={(e) => onTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && enabled) onConfirm()
        }}
        className="w-[72px] rounded-md border border-destructive/40 bg-muted px-2 py-1 text-center font-mono text-sm font-semibold"
      />
      <Button type="button" variant="destructive" className="font-semibold" disabled={!enabled} onClick={onConfirm}>
        {label}
      </Button>
    </div>
  )
}

/** The green `role=status` banner that replaces a confirmed card; focus moves to it. */
export function BatchResultBanner({ result }: { result: ConfirmResult }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  const lateHeld = result.did_not_delete.filter((d) => d.reason === "held")
  return (
    <div
      ref={ref}
      role="status"
      tabIndex={-1}
      data-testid="batch-result"
      className="flex flex-wrap items-start gap-2 rounded-[10px] border border-success/30 bg-success/10 p-4 text-sm outline-none"
    >
      <RetentionChip tone="done">{C.ported.done}</RetentionChip>
      <span className="flex-1">
        {(result.deleted.length > 0 || (result.archived.length === 0 && result.kept.length === 0)) && (
          <>
            <RichCopy text={fillCopy(C.sketchTemplates.deletedResult, { N: result.deleted.length })} />{" "}
          </>
        )}
        {result.archived.length > 0 && (
          <>
            <RichCopy text={`**${fillCopy(C.specTemplates.archivedResult, { N: result.archived.length })}**`} />{" "}
          </>
        )}
        {result.kept.length > 0 && (
          <>
            <RichCopy text={`**${fillCopy(C.specTemplates.keptResult, { N: result.kept.length })}**`} />{" "}
          </>
        )}
        {lateHeld.length > 0 && (
          <span className={AMBER_TEXT_CLASS}>
            {fillCopy(
              C.sketchTemplates.lateHold,
              { M: lateHeld.length, names: lateHeld.map((d) => d.name ?? d.document_id).join(", ") },
              lateHeld.length,
            )}{" "}
          </span>
        )}
        {C.ported.auditTail}
      </span>
    </div>
  )
}

/**
 * 275-REVIEW F-WR-01 — what a failed confirm may honestly say.
 *
 * The server refuses BEFORE any write with a 4xx (`Type 4 to confirm.`, `A document can have only
 * one decision.`, `Nothing was chosen.`, `That policy no longer exists.`) or a 503 (the org read was
 * incomplete; "…Nothing was changed."). Those render the server's sentence plus the fact that
 * nothing was written. Only a failure where the server said nothing it chose (network, 5xx) keeps
 * the contract copy — "Some documents may already be deleted" — because partial work is possible.
 */
export function confirmFailureMessage(err: unknown, keepOnly: boolean): string {
  if (err instanceof ApiRefusal) {
    const preWrite =
      (err.status >= 400 && err.status < 500) || (err.status === 503 && err.message !== CONFIRM_FALLBACK)
    if (preWrite) {
      return /Nothing was (changed|deleted)/.test(err.message)
        ? err.message
        : `${err.message} ${C.contract.confirmRefusedNothing}`
    }
  }
  return keepOnly ? C.contract.decisionsFailed : C.contract.confirmFailed
}

/** An inline failure + Reload (the rows stay as the person left them). */
export function BatchFailure({ message, onReload }: { message: string; onReload: () => void }) {
  return (
    <p role="alert" className={`flex flex-wrap items-center gap-2 text-sm ${AMBER_TEXT_CLASS}`}>
      {message}
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs font-semibold" onClick={onReload}>
        {C.contract.reload}
      </Button>
    </p>
  )
}

export function DeleteBatchCard({
  batch,
  onRecorded,
  onReload,
}: {
  batch: QueueBatch
  onRecorded?: () => void
  onReload: () => void
}) {
  // 275-REVIEW F-CR-01: only an EXPLICIT untick is a keep. A row this card has never seen (it
  // arrived with a newer read) is ticked — "every row starts ticked" — and is never sent as a
  // `keep_ids` decision nobody made.
  const [unticked, setUnticked] = useState<Record<string, true>>({})
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [result, setResult] = useState<ConfirmResult | null>(null)

  // A changed row set changes what N means: the typed count must be re-typed against it.
  const rowKey = batch.rows.map((r) => r.document_id).join(",")
  const seenRowKey = useRef(rowKey)
  useEffect(() => {
    if (seenRowKey.current === rowKey) return
    seenRowKey.current = rowKey
    setTyped("")
  }, [rowKey])

  const isTicked = (id: string) => unticked[id] !== true
  const deleteIds = batch.rows.filter((r) => isTicked(r.document_id)).map((r) => r.document_id)
  const keepIds = batch.rows.filter((r) => !isTicked(r.document_id)).map((r) => r.document_id)
  const n = deleteIds.length
  const allKept = n === 0 && batch.rows.length > 0

  async function submit(body: ConfirmBatchBody, keepOnly: boolean) {
    setBusy(true)
    setFailure(null)
    try {
      const res = await confirmBatch(batch.policy_id, body)
      setResult(res)
      onRecorded?.()
    } catch (err) {
      setFailure(confirmFailureMessage(err, keepOnly))
    } finally {
      setBusy(false)
    }
  }

  if (result) return <BatchResultBanner result={result} />

  return (
    <article className="grid gap-4 rounded-[10px] border border-border bg-card p-4" data-testid="delete-batch">
      <BatchHeader batch={batch} />
      <BatchTable
        rows={batch.rows}
        rowClass={(r) => (isTicked(r.document_id) ? "" : "line-through opacity-45")}
        lead={(r) => (
          <label className="flex h-8 w-8 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              className="accent-[hsl(var(--primary))]"
              aria-label={r.name}
              checked={isTicked(r.document_id)}
              onChange={(e) => {
                const keep = !e.target.checked
                setUnticked((prev) => {
                  const next = { ...prev }
                  if (keep) next[r.document_id] = true
                  else delete next[r.document_id]
                  return next
                })
                setTyped("") // the count must be re-typed for the new N
              }}
            />
          </label>
        )}
      />
      {keepIds.length > 0 && <p className={`text-xs ${AMBER_TEXT_CLASS}`}>{C.contract.untickedNote}</p>}
      <BatchNotes batch={batch} />

      {allKept ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            className="font-semibold"
            disabled={busy}
            onClick={() => submit({ delete_ids: [], keep_ids: keepIds, archive_ids: [], typed_count: 0 }, true)}
          >
            {fillCopy(C.specTemplates.keepAll, { N: keepIds.length })}
          </Button>
        </div>
      ) : (
        <TypeTheCount
          n={n}
          typed={typed}
          onTyped={setTyped}
          busy={busy}
          label={fillCopy(C.sketchTemplates.deletePermanently, { N: n })}
          onConfirm={() => submit({ delete_ids: deleteIds, keep_ids: keepIds, archive_ids: [], typed_count: n }, false)}
        />
      )}
      {failure && <BatchFailure message={failure} onReload={onReload} />}
    </article>
  )
}
