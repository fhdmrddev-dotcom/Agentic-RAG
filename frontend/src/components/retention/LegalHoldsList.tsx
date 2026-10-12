/**
 * Phase 275 plan 04 (S3) — the Legal holds sub-tab: active hold cards, released holds dimmed
 * under a `<details>`, and the place / add / release flows.
 *
 * Self-fetching (the `OrgExpertsTab` shape) with the shell's honest-degrade rule: a failed read
 * keeps the last-known holds and says so. Every recorded write calls `onRecorded`, which the
 * Retention tab wires to the org band's recording marker (062-A — no toasts).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Pause } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { listHolds, type HoldList, type LegalHold } from "@/lib/api/retention"
import { LegalHoldDialog } from "./LegalHoldDialog"
import { ReleaseHoldDialog } from "./ReleaseHoldDialog"
import { AMBER_TEXT_CLASS, RetentionChip, RichCopy } from "./RetentionChip"
import { RETENTION_COPY, fillCopy, formatRetentionDate } from "./retentionCopy"

const C = RETENTION_COPY

const NEW_BUTTON =
  "h-7 border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-[hsl(239_70%_50%)] hover:bg-primary/20 dark:text-primary"

function HoldCard({
  hold,
  onAdd,
  onRelease,
}: {
  hold: LegalHold
  onAdd?: (h: LegalHold) => void
  onRelease?: (h: LegalHold) => void
}) {
  const covers =
    fillCopy(C.sketchTemplates.holdCovers, { N: hold.document_count }) +
    (hold.folder_paths.length > 0
      ? fillCopy(C.sketchTemplates.holdCoversFolders, { folders: hold.folder_paths.join(", ") })
      : "")
  return (
    <article
      data-testid="hold-card"
      className={cn(
        "grid gap-2 rounded-[10px] border p-4",
        hold.active
          ? "border-warning/30 bg-gradient-to-b from-warning/10 to-transparent"
          : "border-border bg-card opacity-70",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {hold.active ? (
          <RetentionChip tone="hold" icon={Pause}>
            {C.ported.holding}
          </RetentionChip>
        ) : (
          <RetentionChip tone="source">
            {fillCopy(C.specTemplates.releasedOn, { date: formatRetentionDate(hold.released_at) })}
          </RetentionChip>
        )}
        <h4 className="font-headline text-base font-semibold text-foreground">{hold.name}</h4>
        <span className="flex-1" />
        {hold.active && onAdd && onRelease && (
          <>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs font-semibold" onClick={() => onAdd(hold)}>
              {C.ported.addDocuments}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs font-semibold" onClick={() => onRelease(hold)}>
              {C.ported.releaseHoldEllipsis}
            </Button>
          </>
        )}
      </div>
      {hold.reason && <p className="text-xs text-muted-foreground">{hold.reason}</p>}
      <p className="text-xs text-muted-foreground">
        {fillCopy(C.sketchTemplates.holdPlaced, {
          name: hold.created_by_name ?? C.contract.formerMember,
          date: formatRetentionDate(hold.created_at),
        })}
        {" · "}
        {covers}
        {" · "}
        {typeof hold.held_today === "number" ? (
          <RichCopy text={fillCopy(C.sketchTemplates.heldToday, { N: hold.held_today })} />
        ) : (
          <span className={AMBER_TEXT_CLASS}>{C.contract.countFailed}</span>
        )}
      </p>
    </article>
  )
}

export function LegalHoldsList({ onRecorded }: { onRecorded?: () => void }) {
  const [holds, setHolds] = useState<HoldList | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [dialog, setDialog] = useState<{ hold: LegalHold | null } | null>(null)
  const [releasing, setReleasing] = useState<LegalHold | null>(null)
  const alive = useRef(true)

  const load = useCallback(async () => {
    try {
      const res = await listHolds()
      if (!alive.current) return
      setHolds(res)
      setLoadError(false)
    } catch {
      if (alive.current) setLoadError(true) // keep the last-known holds
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
    }
  }, [load])

  const recorded = () => {
    onRecorded?.()
    void load()
  }

  const active = holds?.active ?? []
  const released = holds?.released ?? []

  return (
    <section className="grid gap-4 rounded-[10px] border border-border bg-card p-4" aria-busy={holds === null && !loadError}>
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-headline text-base font-semibold">{C.ported.holdsTitle}</h3>
        <span className="rounded-full bg-muted px-2 text-[11px] font-semibold text-muted-foreground">
          {fillCopy(C.sketchTemplates.activeCount, { N: active.length })}
        </span>
        <span className="flex-1" />
        <Button type="button" size="sm" className={NEW_BUTTON} onClick={() => setDialog({ hold: null })}>
          {C.ported.newHold}
        </Button>
      </header>
      <p className="text-xs text-muted-foreground">{C.ported.holdsSub}</p>

      {loadError && (
        <p role="alert" className={`text-sm ${AMBER_TEXT_CLASS}`}>
          {C.contract.loadFailed}{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            {C.contract.tryAgain}
          </button>
        </p>
      )}

      {holds !== null && active.length === 0 && released.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-headline text-base font-semibold">{C.contract.holdsEmptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{C.contract.holdsEmptyBody}</p>
          <Button type="button" size="sm" className={`mt-4 ${NEW_BUTTON}`} onClick={() => setDialog({ hold: null })}>
            {C.ported.newHold}
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          {active.map((h) => (
            <HoldCard key={h.id} hold={h} onAdd={(x) => setDialog({ hold: x })} onRelease={setReleasing} />
          ))}
          {released.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {fillCopy(C.sketchTemplates.releasedCount, { N: released.length })}
              </summary>
              <div className="mt-2 grid gap-2">
                {released.map((h) => (
                  <HoldCard key={h.id} hold={h} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <LegalHoldDialog
        open={dialog !== null}
        hold={dialog?.hold ?? null}
        onClose={() => setDialog(null)}
        onDone={recorded}
        onStale={() => void load()}
      />
      <ReleaseHoldDialog
        hold={releasing}
        onClose={() => setReleasing(null)}
        onDone={recorded}
        onStale={() => void load()}
      />
    </section>
  )
}
