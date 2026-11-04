/**
 * Phase 308-06 (HOOK-06; D-30, D-51, P-1; UI-SPEC Surface 2) — Org admin → API keys → "Webhooks in
 * {org}": every webhook endpoint a member of the org has added, with Turn off, Turn on (admin-off rows
 * only) and Delete.
 *
 * Mounted ONCE in `OrgApiKeysTab`, directly after the connected apps. Self-contained on the
 * `OrgConnectedApps` shape: its own read (`listOrgWebhooks`), an `alive` ref, the last-known list kept
 * on a failed re-read.
 *
 * ⚠ NO FEATURE GATE (P-1). Unlike the connected apps there is no server capability to wait for: the
 *   section always reads and always renders. A webhooks kill switch is deferred; when it exists it
 *   arrives as a prop, never as a guess here.
 * ⚠ NEVER OPTIMISTIC. Every write changes the table only from the server's answer, then
 *   `onRecorded()` pulses the band's "every action recorded" marker (the 304/307 precedent), the
 *   receipt line names owner and host, and the table re-reads. No toast, no timer (062-A).
 * ⛔ A QUERY STRING NEVER REACHES THIS VIEW (D-30, T-308-15). The server sends host + masked path +
 *   `has_query` only; the cell says "query hidden" and nothing else. Owner names and addresses render
 *   as React text — the address is never a link.
 * ⚠ TURN ON ONLY FOR AN ADMIN-OFF ROW (A-24, T-308-20): a failing, gone or owner-left endpoint is the
 *   owner's to fix, and the server refuses it anyway (308-04).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Webhook } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  adminDeleteWebhook,
  adminSetWebhookEnabled,
  listOrgWebhooks,
  type OrgWebhook,
} from "@/lib/api/webhooks"
import { fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import { formatCallTime } from "@/components/settings/apiKeys/apiKeyFacts"
import { MCP_KEY_COPY } from "@/components/settings/apiKeys/mcpKeyCopy"
import { DeleteWebhookSheet } from "@/components/settings/webhooks/DeleteWebhookSheet"
import { statusTag, type StatusTone } from "@/components/settings/webhooks/webhookFacts"
import { WEBHOOKS_COPY } from "@/components/settings/webhooks/webhooksCopy"

const A = WEBHOOKS_COPY.admin

/** The shipped status-tag pairs (the member card's, AA on `--card`). */
const TAG_CLASS: Record<StatusTone, string> = {
  on: "border-success/40 text-success",
  warning: "border-warning/50 text-warning",
  neutral: "border-dashed border-border text-muted-foreground",
}

function ownerOf(e: OrgWebhook): string {
  return e.owner_name ? e.owner_name : A.unknownOwner
}

/** Owner name A–Z; the server's order (newest first) is kept within an owner (a stable sort). */
function ordered(list: readonly OrgWebhook[]): OrgWebhook[] {
  return [...list].sort((a, b) => ownerOf(a).localeCompare(ownerOf(b)))
}

/** "{N} endpoint(s) · {M} member(s)" — each half takes its own plural. */
function countLine(endpoints: number, members: number): string {
  return A.count
    .split(" · ")
    .map((part, i) => fillCopy(part, { N: endpoints, M: members }, i === 0 ? endpoints : members))
    .join(" · ")
}

type Receipt = "receiptOff" | "receiptOn" | "receiptDeleted"

export function OrgWebhooks({
  orgName,
  onRecorded,
}: {
  orgName?: string | null
  onRecorded?: () => void
}) {
  const [list, setList] = useState<OrgWebhook[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<string | null>(null)
  const [target, setTarget] = useState<OrgWebhook | null>(null)
  const alive = useRef(true)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const org = orgName ?? MCP_KEY_COPY.mcp.orgFallback

  const load = useCallback(async () => {
    try {
      const res = await listOrgWebhooks()
      if (!alive.current) return
      setList(res.endpoints)
      setLoadError(null)
    } catch (err) {
      if (alive.current) setLoadError(err instanceof Error ? err.message : "")
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
    }
  }, [load])

  function recorded(kind: Receipt, e: OrgWebhook) {
    onRecorded?.()
    setReceipt(fillCopy(A[kind], { owner: ownerOf(e), host: e.host }))
    void load()
  }

  async function flip(e: OrgWebhook, on: boolean) {
    if (busyId !== null) return
    setBusyId(e.id)
    setWriteError(null)
    try {
      await adminSetWebhookEnabled(e.id, on)
      if (!alive.current) return
      recorded(on ? "receiptOn" : "receiptOff", e)
    } catch (err) {
      if (alive.current) setWriteError(err instanceof Error ? err.message : "")
    } finally {
      if (alive.current) setBusyId(null)
    }
  }

  const rows = list ? ordered(list) : []
  const members = new Set(rows.map(ownerOf)).size

  return (
    <section data-testid="org-webhooks" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Webhook className="h-4 w-4 flex-none" aria-hidden="true" />
        <h3 ref={titleRef} tabIndex={-1} className="font-headline text-base font-semibold outline-none">
          {fillCopy(A.heading, { org })}
        </h3>
        {list !== null && <span className="font-mono text-xs text-muted-foreground">{countLine(rows.length, members)}</span>}
      </div>
      <p className="-mt-2 px-1 text-xs text-muted-foreground">{fillCopy(A.description, { org })}</p>

      {receipt !== null && (
        <p data-testid="org-webhooks-receipt" role="status" className="px-1 text-xs text-muted-foreground">
          {receipt}
        </p>
      )}
      {writeError !== null && (
        <p role="alert" className="px-1 text-sm text-[hsl(0_80%_80%)]">
          {writeError}
        </p>
      )}

      {list === null && loadError === null && (
        <p role="status" className="px-1 text-sm text-muted-foreground">
          {A.loading}
        </p>
      )}
      {loadError !== null && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-[hsl(0_80%_80%)]"
        >
          <span>{[A.loadFailed, loadError].filter(Boolean).join(" ")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            {WEBHOOKS_COPY.tab.retry}
          </Button>
        </div>
      )}

      {list !== null && rows.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">{fillCopy(A.empty, { org })}</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                {[A.col.owner, A.col.address, A.col.events, A.col.status, A.col.last, A.col.failed].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
                <td className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const owner = ownerOf(e)
                const tag = statusTag(e, org)
                const vars = { owner, host: e.host }
                const busy = busyId === e.id
                return (
                  <tr key={e.id} data-testid={`org-webhook-${e.id}`} className="border-b border-border/60 last:border-b-0">
                    <td className="px-3 py-2">
                      <span>{owner}</span>
                      {e.owner_is_you && <span className="text-muted-foreground"> {A.you}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="break-all font-mono">{e.host + e.path}</span>
                      {e.has_query && <span className="ml-1.5 text-muted-foreground">{A.queryHidden}</span>}
                    </td>
                    <td className="px-3 py-2" title={e.event_types.join(", ")}>
                      <span className="font-mono">{e.event_types.length}</span>
                      <span className="sr-only"> {e.event_types.join(", ")}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("inline-block rounded-md border px-1.5 py-0.5", TAG_CLASS[tag.tone])}>{tag.text}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {e.last_success_at ? formatCallTime(e.last_success_at, new Date()) : A.never}
                    </td>
                    <td className="px-3 py-2 font-mono">{e.consecutive_failures}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        {e.enabled && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            aria-label={fillCopy(A.offAria, vars)}
                            onClick={() => void flip(e, false)}
                          >
                            {A.off}
                          </Button>
                        )}
                        {!e.enabled && e.disabled_reason === "admin" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            aria-label={fillCopy(A.onAria, vars)}
                            onClick={() => void flip(e, true)}
                          >
                            {A.on}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          aria-label={fillCopy(A.deleteAria, vars)}
                          onClick={() => {
                            setWriteError(null)
                            setTarget(e)
                          }}
                        >
                          {A.delete}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <DeleteWebhookSheet
        target={target ? { id: target.id, address: target.host + target.path } : null}
        admin={target ? { ownerName: ownerOf(target), orgName: org } : undefined}
        onClose={() => setTarget(null)}
        remove={() => (target ? adminDeleteWebhook(target.id) : Promise.resolve())}
        onDone={() => {
          if (target) recorded("receiptDeleted", target)
        }}
        focusAfterDelete={() => titleRef.current?.focus()}
      />
    </section>
  )
}
