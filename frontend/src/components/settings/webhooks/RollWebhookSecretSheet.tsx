/**
 * Phase 308-05 (D-13; UI-SPEC §1g, A-12, A-13) — roll an endpoint's signing secret: the CALM sheet.
 *
 * Not destructive — nothing is deleted and deliveries keep flowing — so the frame is the primary
 * 3px rule, and the safe button names what it keeps ("Keep this secret", focused). The sheet says
 * the 24 h overlap; while an earlier roll's overlap is still running it also says that rolling now
 * ends it, and the secret before that stops working at once.
 *
 * ⚠ NEVER OPTIMISTIC. `roll(id)` is the server call; the new secret reaches the parent only from the
 *   server's answer (`onRolled`), which shows it once inside the card. A failure keeps the sheet open
 *   and says the current secret still works.
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
import type { WebhookEndpoint, WebhookRolled } from "@/lib/api/webhooks"
import { fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import { formatCallTime } from "@/components/settings/apiKeys/apiKeyFacts"
import { WEBHOOKS_COPY } from "./webhooksCopy"

const C = WEBHOOKS_COPY
const OVERLAP_MS = 24 * 60 * 60 * 1000

/** When the running overlap's roll happened, or null when no overlap is running. */
function runningRollAt(e: WebhookEndpoint, now: Date): string | null {
  if (!e.previous_secret_expires_at) return null
  const ends = new Date(e.previous_secret_expires_at).getTime()
  if (!(ends > now.getTime())) return null
  return new Date(ends - OVERLAP_MS).toISOString()
}

export function RollWebhookSecretSheet({
  target,
  now,
  onClose,
  roll,
  onRolled,
}: {
  target: WebhookEndpoint | null
  now?: Date
  onClose: () => void
  roll: (id: string) => Promise<WebhookRolled>
  /** The server's answer (the new secret among it), handed to the card that shows it once. */
  onRolled: (res: WebhookRolled) => void
}) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const at = now ?? new Date()

  async function handleRoll() {
    if (!target || busy) return
    setBusy(true)
    setFailure(null)
    try {
      const res = await roll(target.id)
      onRolled(res)
      onClose()
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : ""
      setFailure(fillCopy(C.roll.failed, { detail }).replace(/\s{2,}/g, " "))
    } finally {
      setBusy(false)
    }
  }

  const rolledAt = target ? runningRollAt(target, at) : null

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) {
          setFailure(null)
          onClose()
        }
      }}
    >
      <AlertDialogContent className="max-w-[480px] border-t-[3px] border-t-primary">
        {target && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-headline text-xl font-semibold">{C.roll.title}</AlertDialogTitle>
              <AlertDialogDescription className="text-sm">{C.roll.sub}</AlertDialogDescription>
            </AlertDialogHeader>

            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{C.roll.factAfter}</li>
              <li>{C.roll.factAgain}</li>
              {rolledAt && (
                <li className="font-semibold text-foreground">
                  {fillCopy(C.roll.factOverlapNow, { time: formatCallTime(rolledAt, at) })}
                </li>
              )}
            </ul>

            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <span className="text-success" aria-hidden="true">
                {C.keptMark}
              </span>{" "}
              {C.roll.kept}
            </div>

            {failure !== null && (
              <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
                {failure}
              </p>
            )}
            {busy && (
              <span role="status" className="sr-only">
                {C.roll.busy}
              </span>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel className="font-semibold">{C.roll.keep}</AlertDialogCancel>
              <Button type="button" onClick={handleRoll} disabled={busy}>
                {busy ? C.roll.busy : C.roll.confirm}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
