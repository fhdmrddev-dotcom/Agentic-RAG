/**
 * Phase 275 plan 04 (S3 / 066 graded guard) — release a legal hold.
 *
 * Victim-naming plain confirm: releasing deletes nothing, but it takes protection away, so the
 * sheet says how many documents lose it and NAMES what the hold covered (up to 8, then `and {N}
 * more`). `Keep hold` is focused by default (Radix AlertDialog focuses Cancel); `Release hold` is
 * outline + amber — NOT red, because a delete still needs the type-the-count confirm later.
 *
 * ⚠ The hold payload (`HoldOut`) carries the covered FOLDER paths and the held count, not
 * document names, so the list names the coverage the admin chose. A failure keeps the sheet open.
 */
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ApiRefusal } from "@/lib/api/refusal"
import { releaseHold, type LegalHold } from "@/lib/api/retention"
import { AMBER_TEXT_CLASS } from "./RetentionChip"
import { RETENTION_COPY, fillCopy } from "./retentionCopy"

const C = RETENTION_COPY
const MAX_NAMES = 8

export function ReleaseHoldDialog({
  hold,
  onClose,
  onDone,
  onStale,
}: {
  hold: LegalHold | null
  onClose: () => void
  onDone: () => void
  /** 275-REVIEW F-CR-02: the server refused (e.g. already released) — re-read, but record nothing. */
  onStale?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  // A 4xx refusal: the server's own sentence. Nothing is left to release, so only Close remains.
  const [refused, setRefused] = useState<string | null>(null)

  const names = hold
    ? [
        ...hold.folder_paths,
        ...(hold.document_count > 0 ? [fillCopy(C.sketchTemplates.holdCovers, { N: hold.document_count })] : []),
      ]
    : []
  const shown = names.slice(0, MAX_NAMES)
  const more = names.length - shown.length
  // 275-REVIEW F-WR-05: `held_today` is null exactly when the server could not count, and
  // `document_count` counts only directly picked documents (never folder coverage) — so an unknown
  // count says so in words. Never a substituted number, never 0.
  const n = typeof hold?.held_today === "number" ? hold.held_today : null

  async function handleRelease() {
    if (!hold || busy) return
    setBusy(true)
    setFailed(false)
    setRefused(null)
    try {
      await releaseHold(hold.id)
      onDone()
      onClose()
    } catch (err) {
      // 275-REVIEW F-CR-02: a 4xx is the server's decision ("This hold is already released.") —
      // render it and re-read the list. "It is still in force." is only for a failure where the
      // server said nothing (network, 5xx), when the hold genuinely is still in force.
      if (err instanceof ApiRefusal && err.status >= 400 && err.status < 500) {
        setRefused(err.message)
        onStale?.()
      } else {
        setFailed(true)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open={hold !== null}
      onOpenChange={(o) => {
        if (!o) {
          setFailed(false)
          setRefused(null)
          onClose()
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-headline text-base">
            {hold ? fillCopy(C.specTemplates.releaseTitle, { matter: hold.name }) : ""}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            {n === null ? C.contract.releaseBodyUncounted : fillCopy(C.specTemplates.releaseBody, { N: n })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {shown.length > 0 && (
          <ul className="max-h-40 overflow-y-auto rounded-md border border-border px-3 py-2 text-sm" data-testid="release-victims">
            {shown.map((name) => (
              <li key={name}>{name}</li>
            ))}
            {more > 0 && <li className="text-muted-foreground">{fillCopy(C.specTemplates.andMore, { N: more })}</li>}
          </ul>
        )}
        {(failed || refused !== null) && (
          <p role="alert" className={`text-sm ${AMBER_TEXT_CLASS}`}>
            {refused ?? C.contract.releaseFailed}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="font-semibold">
            {refused !== null ? C.contract.close : C.contract.keepHold}
          </AlertDialogCancel>
          {refused === null && (
            <Button
              type="button"
              variant="outline"
              className={`border-border bg-transparent font-semibold ${AMBER_TEXT_CLASS}`}
              onClick={handleRelease}
              disabled={busy}
            >
              {C.contract.releaseHold}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
