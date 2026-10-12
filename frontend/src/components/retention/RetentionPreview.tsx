/**
 * Phase 275 plan 04 (S2 / D-02 / D-06 / D-34) — the Preview column: what tonight's sweep would do.
 *
 * Every bucket is the SERVER's (`POST /retention/policies/preview` runs the same pure evaluator the
 * sweep runs), rendered as an expandable `<details>` with its numeral. `act` and `can't be decided`
 * open at rest when they have rows. A preview that could not finish keeps Save locked (fail closed).
 */
import type { PolicyPreview, PreviewRow } from "@/lib/api/retention"
import { cn } from "@/lib/utils"
import { AMBER_TEXT_CLASS, RED_TEXT_CLASS, RichCopy } from "./RetentionChip"
import { RETENTION_COPY, fillCopy, formatRetentionDate } from "./retentionCopy"

const C = RETENTION_COPY

function Bucket({
  testId,
  n,
  label,
  rows,
  open,
  tone,
}: {
  testId: string
  n: number
  label: string
  rows: string[]
  open: boolean
  tone: "act-delete" | "act-archive" | "act-review" | "hold" | "nope" | "plain"
}) {
  return (
    <details
      data-testid={testId}
      open={open}
      className={cn(
        "rounded-[10px] border border-border",
        tone === "act-delete" && "border-destructive/40",
        tone === "act-archive" && "border-accent-violet/35",
        tone === "act-review" && "border-primary/40",
        tone === "nope" && n > 0 && "border-warning/30 bg-warning/10",
      )}
    >
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
        <span
          className={cn(
            "min-w-[22px] text-right font-headline text-base font-semibold",
            tone === "act-delete" && RED_TEXT_CLASS,
            tone === "act-archive" && "text-accent-violet-text",
            tone === "act-review" && "text-[hsl(239_70%_50%)] dark:text-primary",
            (tone === "hold" || tone === "nope") && AMBER_TEXT_CLASS,
          )}
        >
          {n}
        </span>
        <span className="flex-1">
          <RichCopy text={label} />
        </span>
      </summary>
      {rows.length > 0 && (
        <ul className="grid gap-1 px-3 pb-3 pl-10 text-xs text-muted-foreground">
          {rows.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </details>
  )
}

const ACT_LABEL = {
  delete: C.sketchTemplates.bucketActDelete,
  archive: C.sketchTemplates.bucketActArchive,
  review: C.sketchTemplates.bucketActReview,
} as const

const rowDue = (r: PreviewRow) => fillCopy(C.sketchTemplates.rowDue, { doc: r.name, date: formatRetentionDate(r.due_at) })
// The server composes `why` ("no document date", "also under “X”", the hold's name) — rendered as-is.
const rowWhy = (r: PreviewRow, why: string) => (why ? `${r.name} · ${why}` : r.name)

export function RetentionPreview({
  preview,
  loading,
  failed,
  serverMessage,
  stale,
  onRetry,
}: {
  preview: PolicyPreview | null
  loading: boolean
  failed: boolean
  /** A refusal sentence the server sent (409 scope taken, 422 foreign folder) — shown as-is. */
  serverMessage?: string | null
  stale: boolean
  onRetry: () => void
}) {
  return (
    <section className="grid content-start gap-2 rounded-[10px] border border-border bg-card p-4" aria-busy={loading}>
      <h4 className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">{C.ported.previewTitle}</h4>

      {stale && (
        <p role="status" className={cn("rounded-[10px] border border-warning/30 bg-warning/10 px-3 py-2 text-xs", AMBER_TEXT_CLASS)}>
          {C.ported.staleBanner}
        </p>
      )}

      {failed ? (
        <div role="alert" className={cn("grid gap-2 text-sm", AMBER_TEXT_CLASS)}>
          {serverMessage && <p>{serverMessage}</p>}
          <p>{C.contract.previewFailed}</p>
          <button type="button" className="justify-self-start underline" onClick={onRetry}>
            {C.contract.tryAgain}
          </button>
        </div>
      ) : loading ? (
        <div className="grid gap-2 opacity-40" data-testid="preview-loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 rounded-[10px] border border-border bg-muted/40" />
          ))}
        </div>
      ) : !preview ? (
        <div className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          <p>{C.ported.nothingPreviewed}</p>
          <p>{C.ported.cantSaveYet}</p>
        </div>
      ) : (
        <PreviewBuckets preview={preview} />
      )}
    </section>
  )
}

function PreviewBuckets({ preview }: { preview: PolicyPreview }) {
  const b = preview.buckets
  const action = preview.action
  const undecidable = b.undecidable
  const hasNoDate = undecidable.some((r) => r.kind === "no_date")
  const hasCollision = undecidable.some((r) => r.kind === "collision")
  const next = b.not_yet[0]
  return (
    <div className="grid gap-2">
      <Bucket
        testId="bucket-act"
        n={b.act.length}
        label={ACT_LABEL[action] ?? ACT_LABEL.review}
        rows={b.act.map(rowDue)}
        open={b.act.length > 0}
        tone={action === "delete" ? "act-delete" : action === "archive" ? "act-archive" : "act-review"}
      />
      <Bucket
        testId="bucket-hold"
        n={b.hold.length}
        label={C.sketchTemplates.bucketHold}
        rows={b.hold.map((r) => rowWhy(r, r.why))}
        open={false}
        tone="hold"
      />
      <Bucket
        testId="bucket-undecidable"
        n={undecidable.length}
        label={C.sketchTemplates.bucketUndecidable}
        rows={undecidable.map((r) => rowWhy(r, r.why))}
        open={undecidable.length > 0}
        tone="nope"
      />
      {(hasNoDate || hasCollision) && (
        <p className={cn("text-xs", AMBER_TEXT_CLASS)}>
          {hasNoDate && C.ported.noteNoDate}
          {hasNoDate && hasCollision && " "}
          {hasCollision && C.ported.noteCollision}
        </p>
      )}
      <Bucket
        testId="bucket-kept"
        n={b.kept.length}
        label={C.contract.bucketKept}
        rows={b.kept.map((r) =>
          fillCopy(C.specTemplates.keptRow, { doc: r.name, name: r.kept_by ?? C.contract.formerMember, date: formatRetentionDate(r.kept_at) }),
        )}
        open={false}
        tone="plain"
      />
      <Bucket
        testId="bucket-not-yet"
        n={b.not_yet.length}
        label={
          C.ported.notYet +
          (next ? fillCopy(C.sketchTemplates.notYetNext, { doc: next.name, date: formatRetentionDate(next.due_at) }) : "")
        }
        rows={b.not_yet.map(rowDue)}
        open={false}
        tone="plain"
      />
      {b.already.length > 0 && (
        <Bucket
          testId="bucket-already"
          n={b.already.length}
          label={C.ported.alreadyArchived}
          rows={b.already.map((r) => rowWhy(r, formatRetentionDate(r.archived_at)))}
          open={false}
          tone="plain"
        />
      )}
      {preview.private_not_covered > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="private-not-covered">
          {fillCopy(C.decisionTemplates.privateNotCovered, { N: preview.private_not_covered })}
        </p>
      )}
    </div>
  )
}
