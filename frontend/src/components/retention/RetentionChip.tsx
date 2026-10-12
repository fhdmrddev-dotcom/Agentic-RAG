/**
 * Phase 275 plan 04 (S6 / D-04 / D-21) — the retention chip, and the row's chip pair.
 *
 * ONE chip component for rows, the folder line, Preview and the panel. A chip is a WORD with an
 * `aria-hidden` lucide glyph — never colour alone. Tones follow UI-SPEC §Color, with an explicit
 * light shade for amber and red text (`--warning` and the lightened red fail AA on light).
 *
 * ⛔ PURE FUNCTION OF PROPS: no fetch here (planning flag 2). The row's state comes from the ONE
 * batched `POST /retention/document-states` that `LibraryPage` owns (`useRetentionStates`), and
 * the chip value is the SERVER's (`chip` / `source_chip`) — never a client re-statement of the
 * predicate (D-21).
 */
import type { ReactNode } from "react"
import { Archive, CalendarX, CloudOff, Pause, Scale, Trash2, Unlink, UserCheck, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { RetentionAction, RetentionChipValue, RetentionDocumentState, RetentionSourceChip } from "@/lib/api/retention"
import { RETENTION_COPY, richParts } from "./retentionCopy"

export type RetentionTone = "hold" | "archive" | "delete" | "review" | "undecidable" | "source" | "done"

// The grid-correct pill baseline, copied ONCE from `components/org/StatusChip.tsx:42`
// (`BASE_CLASSES`, module-private there — StatusChip.tsx is deliberately NOT edited, planning
// flag 6). Weight raised to 600 to match the sketch `.tag` (UI-SPEC §Typography).
const BASE_CLASSES = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"

const AMBER_TEXT = "text-[hsl(32_90%_30%)] dark:text-warning"
const RED_TEXT = "text-[hsl(0_72%_40%)] dark:text-[hsl(0_80%_80%)]"

export const RETENTION_TONE_CLASS: Record<RetentionTone, string> = {
  hold: cn("border-warning/30 bg-warning/10", AMBER_TEXT),
  undecidable: cn("border-warning/30 bg-warning/10", AMBER_TEXT),
  archive: "border-accent-violet/35 bg-accent-violet/10 text-accent-violet-text",
  delete: cn("border-destructive/40 bg-destructive/10", RED_TEXT),
  review: "border-primary/30 bg-primary/10 text-[hsl(239_70%_50%)] dark:text-primary",
  source: "border-border bg-muted/40 text-muted-foreground",
  done: "border-success/30 bg-success/10 text-success",
}

export const AMBER_TEXT_CLASS = AMBER_TEXT
export const RED_TEXT_CLASS = RED_TEXT

interface RetentionChipProps {
  tone: RetentionTone
  icon?: LucideIcon
  children: ReactNode
  className?: string
}

export function RetentionChip({ tone, icon: Icon, children, className }: RetentionChipProps) {
  return (
    <span data-testid="retention-chip" data-tone={tone} className={cn(BASE_CLASSES, RETENTION_TONE_CLASS[tone], className)}>
      {Icon && <Icon className="h-3 w-3 flex-none" aria-hidden="true" />}
      {children}
    </span>
  )
}

const C = RETENTION_COPY

/** S6 — the retention chip, by the server's value. Precedence is decided by the server (one chip). */
export const RETENTION_CHIP_META: Record<RetentionChipValue, { label: string; tone: RetentionTone; icon: LucideIcon }> = {
  on_hold: { label: C.ported.chipOnHold, tone: "hold", icon: Pause },
  archived: { label: C.ported.chipArchived, tone: "archive", icon: Archive },
  delete_pending: { label: C.ported.chipDeletePending, tone: "delete", icon: Trash2 },
  archives_tonight: { label: C.ported.chipArchivesTonight, tone: "archive", icon: Archive },
  in_review: { label: C.ported.chipInReview, tone: "review", icon: UserCheck },
  policies_disagree: { label: C.contract.chipPoliciesDisagree, tone: "undecidable", icon: Scale },
  no_date: { label: C.ported.chipNoDate, tone: "undecidable", icon: CalendarX },
}

/** The action tag (sketch `actTag`) + the "then …" words, by a policy's action. */
export const RETENTION_ACTION_META: Record<
  RetentionAction,
  { tone: RetentionTone; label: string; then: string; icon: LucideIcon }
> = {
  archive: { tone: "archive", label: C.ported.tagArchive, then: C.ported.thenArchive, icon: Archive },
  delete: { tone: "delete", label: C.ported.tagDelete, then: C.ported.thenDelete, icon: Trash2 },
  review: { tone: "review", label: C.ported.tagReview, then: C.ported.thenReview, icon: UserCheck },
}

/** S6 — the source chip (D-21), muted: a fact about the source, not a hold. */
export const SOURCE_CHIP_META: Record<RetentionSourceChip, { label: string; icon: LucideIcon }> = {
  deleted_at_source: { label: C.contract.chipDeletedAtSource, icon: CloudOff },
  no_longer_shared: { label: C.contract.chipNoLongerShared, icon: Unlink },
  source_disconnected: { label: C.contract.chipSourceDisconnected, icon: Unlink },
}

/**
 * S6 — at most TWO chips per row: one retention chip and one source chip. Nothing renders when the
 * state is unknown or simply not due — absence is the calm state.
 */
export function RetentionRowChips({ state }: { state?: RetentionDocumentState | null }) {
  if (!state) return null
  const chip = state.chip ? RETENTION_CHIP_META[state.chip] : undefined
  const source = state.source_chip ? SOURCE_CHIP_META[state.source_chip] : undefined
  if (!chip && !source) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-testid="retention-row-chips">
      {chip && (
        <RetentionChip tone={chip.tone} icon={chip.icon}>
          {chip.label}
        </RetentionChip>
      )}
      {source && (
        <RetentionChip tone="source" icon={source.icon}>
          {source.label}
        </RetentionChip>
      )}
    </span>
  )
}

/** Render a filled copy template: `**bold**` runs become `<strong>` (the sketch's `<b>`). */
export function RichCopy({ text }: { text: string }) {
  return (
    <>
      {richParts(text).map((p, i) =>
        p.bold ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.text}
          </strong>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}
