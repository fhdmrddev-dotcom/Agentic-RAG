/**
 * Phase 275 plan 04 (S8 / D-17 / D-19 / D-21) — the body of the detail panel's Retention section.
 *
 * One sentence per state, ported from the sketch's `retentionFor` (S8 table); a source-state
 * sentence renders BELOW the retention sentence. The state is the SERVER's (`document-states`),
 * never a client re-statement of the predicate (D-21).
 *
 * D-17: a member's hold reads EXACTLY `On legal hold. Ask an org admin.` then `It can't be
 * deleted until the hold is released.` — no matter, reason or placer. The server sends a member
 * none of them; this component also never reads `hold_names` on the member branch.
 *
 * D-19: Un-archive renders only when the server says `can_unarchive` (org admins only). It is a
 * direct flip (066: reversible, no victim) with a ✎ receipt inside the success branch.
 *
 * ⛔ NO READ here (planning flag 2): the state arrives as a prop from `LibraryPage`'s one batched
 * read. The only call this component makes is the un-archive WRITE.
 */
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { unarchiveDocument, type RetentionDocumentState } from "@/lib/api/retention"
import type { Document } from "@/types"
import { AMBER_TEXT_CLASS, RichCopy } from "./RetentionChip"
import { NOT_RECORDED_DATE, RETENTION_COPY, fillCopy, formatRetentionDate } from "./retentionCopy"

const C = RETENTION_COPY

interface RetentionSectionProps {
  doc: Document
  state?: RetentionDocumentState | null
  canManage: boolean
  /** Re-ask the states and the documents after a recorded un-archive. */
  onUnarchived?: () => void
}

const SOURCE_SENTENCE: Record<string, string> = {
  deleted_at_source: C.contract.sourceDeleted,
  no_longer_shared: C.contract.sourceNoLongerShared,
  source_disconnected: C.contract.sourceDisconnected,
}

function sentenceFor(state: RetentionDocumentState, doc: Document): string {
  const s = state.section
  const policy = s.policy_name ?? "—"
  const date = formatRetentionDate(s.due_at)
  switch (s.kind) {
    case "archived":
      // B-NEW-1: the snapshot name — it still reads the removed policy's name after deletion.
      return fillCopy(C.sketchTemplates.sectionArchived, {
        date: formatRetentionDate(s.archived_at ?? doc.archived_at),
        policy: s.policy_name ?? doc.archived_policy_name ?? "—",
      })
    case "delete_pending":
      return fillCopy(C.sketchTemplates.sectionDeletePending, { policy, date })
    case "archives_tonight":
      return fillCopy(C.sketchTemplates.sectionArchivesTonight, { policy, date })
    case "in_review":
      return fillCopy(C.sketchTemplates.sectionInReview, { policy, date })
    case "no_date":
      return fillCopy(C.sketchTemplates.sectionNoDate, { policy })
    case "disagree":
      return fillCopy(C.specTemplates.sectionDisagree, { A: policy, B: s.other_policy_name ?? "—" })
    case "kept":
      return fillCopy(C.specTemplates.sectionKept, {
        name: s.kept_by ?? NOT_RECORDED_DATE,
        date: formatRetentionDate(s.kept_at),
        policy,
      })
    case "unarchived":
      return fillCopy(C.specTemplates.sectionUnarchived, {
        name: s.kept_by ?? NOT_RECORDED_DATE,
        date: formatRetentionDate(s.kept_at),
        policy,
      })
    case "not_due":
      return `${s.rule_text ?? ""} ${fillCopy(C.sketchTemplates.sectionDue, { date, policy })}`.trim()
    case "none":
    default:
      return C.ported.sectionNone
  }
}

export function RetentionSection({ doc, state, canManage, onUnarchived }: RetentionSectionProps) {
  const row = doc
  const [phase, setPhase] = useState<"idle" | "busy" | "failed">("idle")
  const [done, setDone] = useState<string | null>(null)

  // A different document is a different section: drop the last one's receipt or error.
  useEffect(() => {
    setPhase("idle")
    setDone(null)
  }, [doc.id])

  async function handleUnarchive() {
    setPhase("busy")
    try {
      const res = await unarchiveDocument(doc.id)
      setDone(res.policy_name)
      setPhase("idle")
      onUnarchived?.()
    } catch {
      setPhase("failed")
    }
  }

  // The state has not arrived (or could not be read): say only what the ROW itself records.
  if (!state) {
    if (row.archived_at) {
      return (
        <div className="px-4 py-3 text-sm leading-relaxed text-panel-muted-foreground" data-testid="retention-section">
          <RichCopy
            text={fillCopy(C.sketchTemplates.sectionArchived, {
              date: formatRetentionDate(row.archived_at),
              policy: row.archived_policy_name ?? "—",
            })}
          />
        </div>
      )
    }
    return (
      <p className="px-4 py-3 text-sm italic text-panel-muted-foreground" data-testid="retention-section">
        {NOT_RECORDED_DATE}
      </p>
    )
  }

  const source = state.source_chip ? SOURCE_SENTENCE[state.source_chip] : undefined

  return (
    <div className="grid gap-2 px-4 py-3 text-sm leading-relaxed text-panel-muted-foreground" data-testid="retention-section">
      {state.section.kind === "hold" || state.held ? (
        canManage ? (
          <p className={AMBER_TEXT_CLASS}>{state.hold_line ?? C.contract.memberHoldLine}</p>
        ) : (
          <>
            <p className={AMBER_TEXT_CLASS}>{C.contract.memberHoldLine}</p>
            <p>{C.contract.memberHoldSecond}</p>
          </>
        )
      ) : done !== null ? (
        <>
          <p>{fillCopy(C.specTemplates.unarchiveDone, { policy: done })}</p>
          <p role="status" className="text-xs text-muted-foreground">
            {C.contract.unarchiveReceipt}
          </p>
        </>
      ) : (
        <p>
          <RichCopy text={sentenceFor(state, row)} />
        </p>
      )}

      {source && (
        <p>
          {source} {C.contract.sourceTail}
        </p>
      )}

      {state.can_unarchive && done === null && !state.held && (
        <div>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs font-semibold"
            onClick={handleUnarchive}
            disabled={phase === "busy"}
          >
            {C.contract.unarchive}
          </Button>
        </div>
      )}
      {phase === "failed" && (
        <p role="alert" className={AMBER_TEXT_CLASS}>
          {C.contract.unarchiveFailed}
        </p>
      )}
    </div>
  )
}
