/**
 * Phase 275 plan 04 (S5 / 062-A / D-12 / D-13) — the retention receipts, newest first.
 *
 * Each row is `[✎ | blank] · plain sentence · mono "{date time} · {actor}"`. The ✎ marks a WRITE;
 * a dry run is a read and carries none. The receipt outlives the document: a deleted document's
 * row shows its STORED name and is never a link. An actor whose account is gone reads `a former
 * member` (the server sends it), never blank. Paged at 50 with `Show older` (the OrgAuditTab idiom).
 */
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { listHistory, type HistoryRow } from "@/lib/api/retention"
import { AMBER_TEXT_CLASS, RichCopy } from "./RetentionChip"
import { NOT_RECORDED_DATE, RETENTION_COPY, fillCopy, formatRetentionDateTime } from "./retentionCopy"

const C = RETENTION_COPY
const PAGE = 50

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0)

function docs(n: number) {
  return fillCopy(C.specTemplates.countDocuments, { N: n })
}
function folders(n: number) {
  return fillCopy(C.specTemplates.countFolders, { N: n })
}

const DRY_RUN_VERB: Record<string, string> = {
  delete: C.ported.verbDeleted,
  archive: C.ported.thenArchive,
  review: C.ported.verbReviewed,
}

/** The receipt sentence for one row (S5 table). Unknown actions fall back to the action's name. */
export function receiptSentence(r: HistoryRow): string {
  // The STORED name (D-12/D-13): it outlives the document. A row that never had one says so.
  const doc = r.document_name ?? NOT_RECORDED_DATE
  const policy = r.policy_name ?? "—"
  const d = r.detail ?? {}
  switch (r.action) {
    case "archived":
      return typeof d.decided_by === "string"
        ? fillCopy(C.specTemplates.historyReviewArchived, { doc, policy, name: d.decided_by })
        : fillCopy(C.sketchTemplates.historyArchived, { doc, policy })
    case "deleted":
      return fillCopy(C.sketchTemplates.historyDeleted, { doc, policy, name: r.actor_name })
    case "did_not_delete": {
      const base = fillCopy(C.sketchTemplates.historyDidNotDelete, { doc })
      if (d.reason !== "held") return base
      const since =
        typeof d.held_since === "string"
          ? fillCopy(C.specTemplates.historyOnHoldSince, { time: formatRetentionDateTime(d.held_since) })
          : ""
      return `${base}${C.ported.lateHoldTail}${since}`
    }
    case "queued_delete":
      return fillCopy(C.specTemplates.historyQueued, { doc, policy, what: C.contract.whatDeletion })
    case "queued_review":
      return fillCopy(C.specTemplates.historyQueued, { doc, policy, what: C.contract.whatReview })
    case "kept":
      return fillCopy(C.specTemplates.historyKept, { doc, policy, name: r.actor_name })
    case "unarchived":
      return fillCopy(C.specTemplates.historyUnarchived, { doc, policy })
    case "hold_placed":
      return fillCopy(C.sketchTemplates.historyHoldPlaced, {
        matter: r.hold_name ?? "—",
        docs: docs(num(d.documents)),
        folders: folders(num(d.folders)),
      })
    case "hold_extended":
      return fillCopy(C.specTemplates.historyHoldExtended, {
        matter: r.hold_name ?? "—",
        docs: docs(num(d.documents)),
        folders: folders(num(d.folders)),
      })
    case "hold_released":
      return fillCopy(C.specTemplates.historyHoldReleased, { matter: r.hold_name ?? "—", N: num(d.released_count) })
    case "policy_saved":
      return fillCopy(C.sketchTemplates.historyPolicySaved, { name: policy })
    case "policy_deleted":
      return fillCopy(C.specTemplates.historyPolicyRemoved, { name: policy })
    case "dry_run": {
      const counts = (d.counts ?? {}) as Record<string, unknown>
      return fillCopy(C.sketchTemplates.historyDryRun, {
        policy,
        act: num(counts.act),
        verb: DRY_RUN_VERB[String(d.action)] ?? C.ported.verbDeleted,
        hold: num(counts.hold),
        undecidable: num(counts.undecidable),
      })
    }
    case "delete_refused":
      return fillCopy(C.specTemplates.historyDeleteRefused, { doc })
    case "sweep_incomplete":
      return fillCopy(C.specTemplates.postureNotFinished, { "date time": formatRetentionDateTime(r.created_at) })
    default:
      return r.action
  }
}

export function RetentionHistory() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // 275-REVIEW F-WR-12: the server pages by offset over a newest-first list that GROWS AT THE TOP
  // (a sweep, another admin, another tab). The cursor advances by what the server RETURNED — never
  // by the rows shown — and a row already shown is dropped by id, so a receipt can never appear
  // twice (which would read as two deletes of one document) and nothing older is skipped.
  const [nextOffset, setNextOffset] = useState(0)
  const alive = useRef(true)

  const load = useCallback(async (offset: number) => {
    if (offset > 0) setLoadingMore(true)
    try {
      const page = await listHistory(offset, PAGE)
      if (!alive.current) return
      setRows((prev) => {
        if (offset === 0) return page.rows
        const seen = new Set((prev ?? []).map((r) => r.id))
        return [...(prev ?? []), ...page.rows.filter((r) => !seen.has(r.id))]
      })
      setNextOffset(offset + page.rows.length)
      setHasMore(page.has_more)
      setLoadError(false)
    } catch {
      if (alive.current) setLoadError(true) // keep the rows already shown
    } finally {
      if (alive.current) setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load(0)
    return () => {
      alive.current = false
    }
  }, [load])

  return (
    <section className="grid gap-2 rounded-[10px] border border-border bg-card p-4" aria-busy={rows === null && !loadError}>
      {loadError && (
        <p role="alert" className={`text-sm ${AMBER_TEXT_CLASS}`}>
          {C.contract.loadFailed}{" "}
          <button type="button" className="underline" onClick={() => void load(rows ? nextOffset : 0)}>
            {C.contract.tryAgain}
          </button>
        </p>
      )}
      {rows !== null && rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{C.contract.historyEmpty}</p>
      ) : (
        <ol className="grid gap-0.5" aria-label={C.ported.tabHistory}>
          {(rows ?? []).map((r) => (
            <li
              key={r.id}
              data-testid="history-row"
              className="grid grid-cols-[18px_minmax(0,1fr)_auto] gap-2 rounded-md px-1 py-1.5 text-xs text-muted-foreground"
            >
              <span className="text-[hsl(32_90%_30%)] dark:text-warning" data-testid="write-mark">
                {r.written ? "✎" : ""}
              </span>
              <span>
                <RichCopy text={receiptSentence(r)} />
              </span>
              <span className="font-mono text-xs">
                {formatRetentionDateTime(r.created_at)} · {r.actor_name}
              </span>
            </li>
          ))}
        </ol>
      )}
      {hasMore && (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs font-semibold"
            disabled={loadingMore}
            onClick={() => void load(nextOffset)}
          >
            {C.contract.showOlder}
          </Button>
        </div>
      )}
    </section>
  )
}
