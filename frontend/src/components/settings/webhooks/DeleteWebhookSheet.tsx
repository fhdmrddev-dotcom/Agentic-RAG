/**
 * Phase 308-05 (D-30; UI-SPEC §1h, §2c) — delete an endpoint: the 066 victim-naming guard, on the
 * `RevokeApiKeySheet` shape (destructive frame, "Keep it" holds focus, Esc and the scrim close it).
 *
 * The member variant names the address (query masked) and what goes with it. The `admin` variant —
 * reused by 308-06's Org admin section — names the owner and the org: whose system stops hearing,
 * and that the audit log records the admin.
 *
 * ⚠ NEVER OPTIMISTIC. `remove()` is injected (the member's `deleteWebhook`, or the admin's
 *   `adminDeleteWebhook`); only after the server answers does the sheet call `onDone()`, which
 *   re-reads. A failure keeps the sheet open, says the server's words, and says it is still there.
 * ⚠ The address renders as text — never a link.
 */
import { useRef, useState } from "react"

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
import { fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import { WEBHOOKS_COPY } from "./webhooksCopy"

const C = WEBHOOKS_COPY

export function DeleteWebhookSheet({
  target,
  admin,
  onClose,
  remove,
  onDone,
  focusAfterDelete,
}: {
  /** The endpoint to delete and its display address (member: query masked; admin: host + path). */
  target: { id: string; address: string } | null
  /** The admin variant: the owner and the org, named in the title and the facts. */
  admin?: { ownerName: string; orgName: string }
  onClose: () => void
  remove: () => Promise<void>
  /** Called after the server answered OK; the caller re-reads. */
  onDone: () => void
  /** After a delete the opener is gone with its card: where focus lands instead (never <body>).
   *  Keep it / Esc still return focus to the opener (Radix's own restore). */
  focusAfterDelete?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const deleted = useRef(false)

  async function handleDelete() {
    if (!target || busy) return
    setBusy(true)
    setFailure(null)
    try {
      await remove()
      deleted.current = true
      onDone()
      onClose()
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : ""
      setFailure(fillCopy(C.del.failed, { detail }).replace(/\s{2,}/g, " "))
    } finally {
      setBusy(false)
    }
  }

  const vars = admin ? { owner: admin.ownerName, org: admin.orgName } : {}
  const facts = admin
    ? [C.admin.delFactStops, C.admin.delFactLog, C.admin.delFactSees].map((f) => fillCopy(f, vars))
    : [C.del.factPending, C.del.factLog]
  const kept = admin ? fillCopy(C.admin.delKept, vars) : C.del.kept

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
      <AlertDialogContent
        className="max-w-[480px] border-destructive/45 border-t-[3px] border-t-destructive"
        onCloseAutoFocus={(ev) => {
          if (deleted.current && focusAfterDelete) {
            ev.preventDefault()
            focusAfterDelete()
          }
          deleted.current = false
        }}
      >
        {target && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-headline text-xl font-semibold">
                {admin ? fillCopy(C.admin.delTitle, vars) : C.del.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="break-all font-mono text-xs text-muted-foreground">
                {target.address}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>

            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <span className="text-success" aria-hidden="true">
                {C.keptMark}
              </span>{" "}
              {kept}
            </div>

            {failure !== null && (
              <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
                {failure}
              </p>
            )}
            {busy && (
              <span role="status" className="sr-only">
                {C.del.busy}
              </span>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel className="font-semibold">{C.del.keep}</AlertDialogCancel>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={busy}>
                {busy ? C.del.busy : C.del.confirm}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
