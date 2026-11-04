/**
 * Phase 308-05 (D-20, D-29, D-30; UI-SPEC §1b, §1c, A-1..A-6, A-11) — ONE endpoint, collapsed and
 * open (sketch 308-webhooks winner A: the card opens in place to its actions and its own log).
 *
 * The header is a `<button>` (Enter / Space toggle, `aria-expanded`, `aria-controls`). Open, the card
 * shows — top to bottom — the state notice when off, a roll's secret-once panel, the action row, the
 * test verdict, the per-card receipt, the edit form in place of all that while editing, and the log.
 *
 * ⚠ NEVER OPTIMISTIC. Turn off / Turn on, Roll, Edit and Send test change the card only from the
 *   server's answer, handed up through `onChanged(endpoint)`; a failure keeps the card and says so in
 *   the server's words. Delete is handed to the tab, which owns the victim-naming sheet.
 * ⚠ THE ADDRESS IS TEXT, NEVER A LINK, and its query values are masked (T-308-15); the full value is
 *   only in the Edit form's input, which the member typed.
 * ⛔ THE ROLLED SECRET lives in this card's state and leaves with "I've saved the secret", the card
 *   closing, or unmount — the secret lives in one component's props (`WebhookSecretOnce`).
 */
import { useEffect, useId, useRef, useState } from "react"
import { ChevronDown, Pencil, Power, PowerOff, RotateCw, Send, Trash2, Webhook } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  WebhookError,
  rollWebhookSecret,
  sendWebhookTest,
  setWebhookEnabled,
  updateWebhook,
  type WebhookBody,
  type WebhookEndpoint,
  type WebhookRolled,
} from "@/lib/api/webhooks"
import { fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import {
  TONE_CLASS,
  hostOf,
  memberAddress,
  metaPhrase,
  statusTag,
  verdictSentence,
  type LogTone,
  type StatusTone,
} from "./webhookFacts"
import { WEBHOOKS_COPY } from "./webhooksCopy"
import { RollWebhookSecretSheet } from "./RollWebhookSecretSheet"
import { WebhookDeliveryLog } from "./WebhookDeliveryLog"
import { WebhookEndpointForm } from "./WebhookEndpointForm"
import { WebhookSecretOnce } from "./WebhookSecretOnce"

const C = WEBHOOKS_COPY

const TAG_CLASS: Record<StatusTone, string> = {
  on: "border-success/40 text-success",
  warning: "border-warning/50 text-warning",
  neutral: "border-dashed border-border text-muted-foreground",
}

type Receipt = "off" | "on" | "edited" | "rolled"

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : ""
}

function notice(e: WebhookEndpoint): { text: string; warn: boolean } | null {
  if (e.enabled) return null
  switch (e.disabled_reason) {
    case "failing":
      return { text: C.notice.failing, warn: true }
    case "gone":
      return { text: C.notice.gone, warn: true }
    case "admin":
      return { text: C.notice.admin, warn: false }
    default:
      return { text: C.notice.self, warn: false }
  }
}

export function WebhookEndpointCard({
  endpoint: e,
  open,
  onToggle,
  now,
  onChanged,
  onDelete,
  onOpenRun,
  toggleRef,
}: {
  endpoint: WebhookEndpoint
  open: boolean
  onToggle: () => void
  now?: Date
  /** The server's answer after a flip, roll or edit; the tab replaces the row and re-reads. */
  onChanged: (endpoint: WebhookEndpoint) => void
  onDelete: (endpoint: WebhookEndpoint) => void
  onOpenRun?: (runId: string) => void
  /** The tab focuses this toggle on arrival from "Waiting on you". */
  toggleRef?: (el: HTMLButtonElement | null) => void
}) {
  const id = useId()
  const detailId = `${id}-detail`
  const testWhyId = `${id}-test-why`
  const onWhyId = `${id}-on-why`
  const [testing, setTesting] = useState(false)
  const [verdict, setVerdict] = useState<{ tone: LogTone; text: string } | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [flipping, setFlipping] = useState(false)
  const [editing, setEditing] = useState(false)
  const [rollOpen, setRollOpen] = useState(false)
  const [rolled, setRolled] = useState<{ secret: string; until: string } | null>(null)
  const [logKey, setLogKey] = useState(0)
  const flipRef = useRef<HTMLButtonElement>(null)
  const refocusFlip = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // Closing the card drops everything it was showing — above all a rolled secret.
  useEffect(() => {
    if (open) return
    setRolled(null)
    setVerdict(null)
    setReceipt(null)
    setFailure(null)
    setEditing(false)
  }, [open])

  // A direct flip keeps focus on the button's replacement (Turn off ↔ Turn on swap in place).
  useEffect(() => {
    if (refocusFlip.current) {
      refocusFlip.current = false
      flipRef.current?.focus()
    }
  }, [e.enabled])

  const at = now ?? new Date()
  const host = hostOf(e.url)
  const address = memberAddress(e.url)
  const tag = statusTag(e)
  const off = notice(e)
  const adminOff = !e.enabled && e.disabled_reason === "admin"

  function act(next: Receipt) {
    setReceipt(next)
    setFailure(null)
  }

  async function flip() {
    if (flipping || adminOff) return
    const turnOn = !e.enabled
    setFlipping(true)
    setFailure(null)
    try {
      const res = await setWebhookEnabled(e.id, turnOn)
      if (!alive.current) return
      refocusFlip.current = true
      onChanged(res.endpoint)
      act(turnOn ? "on" : "off")
    } catch (err) {
      if (!alive.current) return
      const verb = turnOn ? C.act.verbOn : C.act.verbOff
      setFailure(fillCopy(C.act.failed, { verb, detail: messageOf(err) }).replace(/\s{2,}/g, " "))
    } finally {
      if (alive.current) setFlipping(false)
    }
  }

  async function test() {
    if (testing || !e.enabled) return
    setTesting(true)
    try {
      const result = await sendWebhookTest(e.id)
      if (!alive.current) return
      setVerdict(verdictSentence({ ok: true, result }))
    } catch (err) {
      if (!alive.current) return
      const code = err instanceof WebhookError ? err.code : null
      setVerdict(verdictSentence({ ok: false, code, message: messageOf(err) }))
    } finally {
      if (alive.current) {
        setTesting(false)
        setLogKey((k) => k + 1)
      }
    }
  }

  async function saveEdit(body: WebhookBody) {
    const res = await updateWebhook(e.id, body)
    if (!alive.current) return
    onChanged(res.endpoint)
    setEditing(false)
    act("edited")
  }

  function onRolled(res: WebhookRolled) {
    setRolled({ secret: res.secret, until: res.previous_secret_expires_at })
    onChanged(res.endpoint)
    act("rolled")
  }

  const btn = "min-h-[44px] sm:min-h-0"

  return (
    <div data-testid="webhook-card" className="rounded-[14px] border border-border bg-card p-4">
      <button
        type="button"
        ref={toggleRef}
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggle}
        className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-start gap-2">
          <Webhook className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">
            {address.head}
            {address.query && <span className="text-muted-foreground/70">{address.query}</span>}
          </span>
          <span className={cn("flex-none rounded-md border px-1.5 py-0.5 text-xs", TAG_CLASS[tag.tone])}>{tag.text}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 flex-none text-muted-foreground transition-transform duration-150 motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </span>
        {e.description && <span className="mt-1 block text-xs text-muted-foreground">{e.description}</span>}
        <span className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {e.event_types.map((t) => (
            <span key={t} className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs">
              {t}
            </span>
          ))}
          <span className="ml-1">{metaPhrase(e, at)}</span>
        </span>
      </button>

      <div id={detailId} hidden={!open}>
        {open && (
          <div className="mt-3 border-t border-dashed border-border/60 pt-3">
            {editing ? (
              <WebhookEndpointForm
                mode="edit"
                initial={{ url: e.url, event_types: e.event_types, description: e.description }}
                save={saveEdit}
                onDiscard={() => setEditing(false)}
              />
            ) : (
              <>
                {off && (
                  <p
                    className={cn(
                      "mb-3 rounded-lg border px-3 py-2 text-sm",
                      off.warn ? "border-warning/50 bg-warning/10" : "border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {off.text}
                  </p>
                )}

                {rolled && (
                  <div className="mb-3">
                    <WebhookSecretOnce
                      mode="roll"
                      secret={rolled.secret}
                      host={host}
                      overlapUntil={rolled.until}
                      now={at}
                      onDone={() => setRolled(null)}
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={btn}
                    aria-label={fillCopy(C.aria.test, { host })}
                    aria-describedby={e.enabled ? undefined : testWhyId}
                    disabled={!e.enabled}
                    onClick={() => void test()}
                  >
                    <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {testing ? C.act.testing : C.act.test}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={btn}
                    aria-label={fillCopy(C.aria.roll, { host })}
                    onClick={() => setRollOpen(true)}
                  >
                    <RotateCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {C.act.roll}
                  </Button>
                  <Button
                    ref={flipRef}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={btn}
                    aria-label={fillCopy(e.enabled ? C.aria.off : C.aria.on, { host })}
                    aria-describedby={adminOff ? onWhyId : undefined}
                    aria-busy={flipping || undefined}
                    disabled={adminOff}
                    onClick={() => void flip()}
                  >
                    {e.enabled ? (
                      <PowerOff className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Power className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    )}
                    {e.enabled ? C.act.off : C.act.on}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={btn}
                    aria-label={fillCopy(C.aria.edit, { host })}
                    onClick={() => {
                      setEditing(true)
                      setReceipt(null)
                    }}
                  >
                    <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {C.act.edit}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(btn, "ml-auto text-destructive")}
                    aria-label={fillCopy(C.aria.delete, { host })}
                    onClick={() => onDelete(e)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {C.act.delete}
                  </Button>
                </div>

                {!e.enabled && (
                  <p id={testWhyId} className="mt-2 text-xs text-muted-foreground">
                    {C.act.testOffWhy}
                  </p>
                )}
                {adminOff && (
                  <p id={onWhyId} className="mt-1 text-xs text-muted-foreground">
                    {C.act.onAdminWhy}
                  </p>
                )}
                {verdict && (
                  <p role="status" className={cn("mt-2 text-xs", TONE_CLASS[verdict.tone])}>
                    {verdict.text}
                  </p>
                )}
                {failure && (
                  <p role="alert" className="mt-2 text-xs text-[hsl(0_80%_80%)]">
                    {failure}
                  </p>
                )}
              </>
            )}

            {receipt && (
              <p role="status" className="mt-2 text-xs text-muted-foreground">
                {C.receipt[receipt]}
              </p>
            )}

            {!editing && (
              <WebhookDeliveryLog
                endpointId={e.id}
                host={host}
                on={e.enabled}
                refreshKey={logKey}
                now={at}
                onOpenRun={onOpenRun}
              />
            )}
          </div>
        )}
      </div>

      <RollWebhookSecretSheet
        target={rollOpen ? e : null}
        now={at}
        onClose={() => setRollOpen(false)}
        roll={rollWebhookSecret}
        onRolled={onRolled}
      />
    </div>
  )
}
