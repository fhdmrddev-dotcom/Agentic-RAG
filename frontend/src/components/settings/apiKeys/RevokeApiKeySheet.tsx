/**
 * Phase 293-04 (D-04, T-293-24) — revoke a key: the victim-naming confirm (066 graded guard),
 * on the `ReleaseHoldDialog` shape.
 *
 * The sheet NAMES what stops working: which workflows the key starts, when it was last used, whose
 * key it is. On someone else's key (the admin view) the sub line names the owner and says they
 * will see it. `Keep it` holds focus by default (Radix AlertDialog focuses Cancel); Esc and the
 * scrim close it.
 *
 * ⚠ NEVER OPTIMISTIC. The sheet calls `revoke(id)` and only after the server answers does it hand
 *   the caller `onDone()`, which re-fetches; the card turns revoked from the server's answer, so it
 *   can never claim a revoke the server refused. A failure keeps the sheet open, says the server's
 *   words, and says the key still works.
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
import type { ApiKeyRead } from "@/lib/api/apiKeys"
import { API_KEYS_COPY, fillCopy } from "./apiKeysCopy"
import { formatCallTime, formatDay } from "./apiKeyFacts"

const C = API_KEYS_COPY
const LIVE_OUTCOMES = new Set(["running", "waiting_for_person", "paused"])

/** The newest run this key started that its last read saw still live, or null. */
function liveRunId(key: ApiKeyRead): string | null {
  const seen = new Set<string>()
  for (const call of key.calls) {
    if (!call.run_id || seen.has(call.run_id)) continue
    seen.add(call.run_id)
    if (call.ok && call.outcome && LIVE_OUTCOMES.has(call.outcome)) return call.run_id
  }
  return null
}

export function RevokeApiKeySheet({
  target,
  now,
  onClose,
  revoke,
  onDone,
}: {
  target: ApiKeyRead | null
  now?: Date
  onClose: () => void
  /** `revokeApiKey` for the member, `revokeOrgApiKey` for the admin. */
  revoke: (keyId: string) => Promise<unknown>
  /** Called after the server answered OK; the caller re-fetches. */
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const at = now ?? new Date()

  async function handleRevoke() {
    if (!target || busy) return
    setBusy(true)
    setFailure(null)
    try {
      await revoke(target.id)
      onDone()
      onClose()
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : ""
      setFailure(fillCopy(C.sheet.failed, { label: target.label, detail }).replace(/\s{2,}/g, " "))
    } finally {
      setBusy(false)
    }
  }

  const owner = target?.owner_name ?? C.sheet.unknownOwner
  const live = target ? liveRunId(target) : null
  const calls = target?.calls.length ?? 0

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
      <AlertDialogContent className="max-w-[480px] border-destructive/45 border-t-[3px] border-t-destructive">
        {target && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-headline text-xl font-semibold">
                {fillCopy(C.sheet.title, { label: target.label })}
              </AlertDialogTitle>
              <AlertDialogDescription data-testid="revoke-sub" className="text-sm">
                {target.owner_is_you ? (
                  C.sheet.subOwn
                ) : (
                  <>
                    {C.sheet.subAdminLead}
                    <b className="font-semibold text-foreground">{owner}</b>
                    {C.sheet.subAdminTail}
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <ul data-testid="revoke-facts" className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                {C.sheet.factStarts}
                {target.workflows.map((w, i) => (
                  <span key={w.id}>
                    {i > 0 && C.sheet.factAnd}
                    <b className="font-semibold text-foreground">{w.name}</b>
                  </span>
                ))}
              </li>
              <li>
                {C.sheet.factLastUsed}
                <b className="font-semibold text-foreground">
                  {target.last_used_at ? formatCallTime(target.last_used_at, at) : C.card.neverUsed}
                </b>
                {calls > 0 && fillCopy(C.sheet.factCalls, { N: calls })}
              </li>
              <li>
                {C.sheet.factOwner}
                <b className="font-semibold text-foreground">{owner}</b>
                {fillCopy(C.sheet.factCreated, { date: formatDay(target.created_at, at) })}
              </li>
            </ul>

            <div data-testid="revoke-kept" className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {live ? fillCopy(C.sheet.keptLive, { id: live.slice(0, 6) }) : C.sheet.keptOther}
            </div>

            {failure !== null && (
              <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
                {failure}
              </p>
            )}
            {busy && (
              <span role="status" className="sr-only">
                {C.sheet.busy}
              </span>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel className="font-semibold">{C.sheet.keep}</AlertDialogCancel>
              <Button type="button" variant="destructive" onClick={handleRevoke} disabled={busy}>
                {busy ? C.sheet.busy : fillCopy(C.sheet.confirm, { label: target.label })}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
