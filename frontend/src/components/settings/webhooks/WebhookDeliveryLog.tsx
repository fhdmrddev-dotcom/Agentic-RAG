/**
 * Phase 308-05 (D-20, D-21, T-308-13; UI-SPEC §1d, A-14, A-15, A-17) — one endpoint's delivery log.
 *
 * Its own paged read (`listWebhookDeliveries`, newest first, 20 a page), guarded by an `alive` ref.
 * Read on mount, after a test (`refreshKey`), after a Resend and on Refresh; and every 15 s ONLY while
 * a shown row is Queued, Sending or Retrying — the interval is cleared when none remain and on unmount.
 * Webhook tables are service-role only, so there is no Realtime hint (D-32).
 *
 * ⛔ THE LOG CAN NEVER SHOW CONTENT. It renders exactly event, about, status words, tries, HTTP code
 *   or error word, latency and when. There is no column, tooltip, disclosure or download for a
 *   request body, a response body or headers — the wire carries none, and the footnote says so.
 * ⚠ A row its owner can no longer see reads "no longer visible": no id, no link (A-17).
 * ⚠ Resend is never optimistic: "Resending…", then the log re-reads and the server's row shows.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useCitationNavOptional } from "@/lib/citationNav"
import {
  WebhookError,
  listWebhookDeliveries,
  resendWebhookDelivery,
  type WebhookDelivery,
} from "@/lib/api/webhooks"
import { fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import {
  TONE_CLASS,
  aboutCell,
  deliveryStatus,
  httpCell,
  isInFlight,
  latencyText,
  whenCell,
} from "./webhookFacts"
import { WEBHOOKS_COPY } from "./webhooksCopy"

const C = WEBHOOKS_COPY
const L = C.log
const PAGE = 20
const POLL_MS = 15_000

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : ""
}

export function WebhookDeliveryLog({
  endpointId,
  host,
  on,
  refreshKey = 0,
  now,
  onOpenRun,
  onOpenDocument,
}: {
  endpointId: string
  host: string
  /** Off: no Resend column, one line says why (A-14). */
  on: boolean
  /** Bumped by the card after a test, so the new row shows. */
  refreshKey?: number
  now?: Date
  onOpenRun?: (runId: string) => void
  /** Defaults to the shipped Library document door (`CitationNavProvider.openDocument`). */
  onOpenDocument?: (documentId: string) => void
}) {
  const [rows, setRows] = useState<WebhookDelivery[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [olderBusy, setOlderBusy] = useState(false)
  const [resending, setResending] = useState<string | null>(null)
  const [resendLine, setResendLine] = useState<string | null>(null)
  const alive = useRef(true)
  const nav = useCitationNavOptional()
  const openDocument = onOpenDocument ?? nav?.openDocument

  const load = useCallback(async () => {
    try {
      const page = await listWebhookDeliveries(endpointId, { limit: PAGE, before: null })
      if (!alive.current) return
      setRows(page.deliveries)
      setCursor(page.next_cursor)
      setLoadError(null)
    } catch (err) {
      if (alive.current) setLoadError(messageOf(err)) // the last-known rows stay
    }
  }, [endpointId])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  // The 15 s poll: only while a shown row is still in flight; cleared when none remain or on unmount.
  const inFlight = rows?.some(isInFlight) ?? false
  useEffect(() => {
    if (!inFlight) return
    const timer = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(timer)
  }, [inFlight, load])

  async function older() {
    if (!cursor || olderBusy) return
    setOlderBusy(true)
    try {
      const page = await listWebhookDeliveries(endpointId, { limit: PAGE, before: cursor })
      if (!alive.current) return
      setRows((cur) => [...(cur ?? []), ...page.deliveries])
      setCursor(page.next_cursor)
    } catch (err) {
      if (alive.current) setLoadError(messageOf(err))
    } finally {
      if (alive.current) setOlderBusy(false)
    }
  }

  async function resend(d: WebhookDelivery) {
    if (resending) return
    setResending(d.id)
    setResendLine(null)
    try {
      await resendWebhookDelivery(endpointId, d.id)
      if (alive.current) await load()
    } catch (err) {
      if (!alive.current) return
      const code = err instanceof WebhookError ? err.code : null
      setResendLine(code === "rate_limited" ? L.resendRefused : messageOf(err) || L.resendRefused)
    } finally {
      if (alive.current) setResending(null)
    }
  }

  const at = now ?? new Date()
  const canResend = (d: WebhookDelivery) => d.item_kind !== "test" && (d.status === "sent" || d.status === "failed")

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{L.title}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-[44px] sm:min-h-0"
          aria-label={fillCopy(L.refreshAria, { host })}
          onClick={() => void load()}
        >
          <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {L.refresh}
        </Button>
      </div>

      {!on && <p className="mb-2 text-xs text-muted-foreground">{L.resendOff}</p>}

      {rows === null && loadError === null && (
        <p role="status" className="text-xs text-muted-foreground">
          {L.loading}
        </p>
      )}
      {loadError !== null && (
        <div
          role="alert"
          className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-[hsl(0_80%_80%)]"
        >
          <span>{[L.loadFailed, loadError].filter(Boolean).join(" ")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            {C.tab.retry}
          </Button>
        </div>
      )}

      {rows !== null && (
        <div className="overflow-x-auto rounded-lg border border-border bg-muted/40">
          {rows.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{L.empty}</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th scope="col" className="px-3 py-1.5 font-normal text-muted-foreground">{L.col.event}</th>
                  <th scope="col" className="px-3 py-1.5 font-normal text-muted-foreground">{L.col.about}</th>
                  <th scope="col" className="px-3 py-1.5 font-normal text-muted-foreground">{L.col.status}</th>
                  <th scope="col" className="px-3 py-1.5 font-normal text-muted-foreground">{L.col.tries}</th>
                  <th scope="col" className="px-3 py-1.5 font-normal text-muted-foreground">{L.col.http}</th>
                  <th scope="col" className="px-3 py-1.5 font-normal text-muted-foreground">{L.col.latency}</th>
                  <th scope="col" className="px-3 py-1.5 font-normal text-muted-foreground">{L.col.when}</th>
                  {on && (
                    <th scope="col" className="px-3 py-1.5 font-normal">
                      <span className="sr-only">{L.col.resend}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const st = deliveryStatus(d)
                  const about = aboutCell(d)
                  const open =
                    about.kind === "run" && about.id && onOpenRun
                      ? () => onOpenRun(about.id as string)
                      : about.kind === "document" && about.id && openDocument
                        ? () => openDocument(about.id as string)
                        : null
                  return (
                    <tr key={d.id} className="border-t border-border/60">
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono">{d.event_type}</td>
                      <td className="whitespace-nowrap px-3 py-1.5">
                        {open ? (
                          <button type="button" className="font-mono text-primary hover:underline" onClick={open}>
                            {about.text}
                          </button>
                        ) : (
                          <span className={cn(about.id ? "font-mono" : "text-muted-foreground")}>{about.text}</span>
                        )}
                      </td>
                      <td className={cn("whitespace-nowrap px-3 py-1.5", TONE_CLASS[st.tone])}>{st.text}</td>
                      <td className="px-3 py-1.5 font-mono">{d.attempts}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono">{httpCell(d)}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono">{latencyText(d.last_latency_ms)}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-muted-foreground">{whenCell(d, at)}</td>
                      {on && (
                        <td className="px-3 py-1.5 text-right">
                          {canResend(d) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              aria-label={fillCopy(L.resendAria, { event: d.event_type })}
                              disabled={resending !== null}
                              onClick={() => void resend(d)}
                            >
                              {resending === d.id ? L.resending : L.resend}
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {resendLine !== null && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {resendLine}
        </p>
      )}
      {cursor && rows !== null && (
        <button
          type="button"
          className="mt-2 text-xs text-primary hover:underline disabled:opacity-60"
          disabled={olderBusy}
          onClick={() => void older()}
        >
          {L.older}
        </button>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{L.footnote}</p>
    </div>
  )
}
