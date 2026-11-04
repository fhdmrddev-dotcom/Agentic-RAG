/**
 * Phase 308-05 (D-12, D-13, T-308-06; UI-SPEC §1f, A-10) — an endpoint's signing secret, shown once.
 *
 * ⛔ THIS COMPONENT RECEIVES THE SECRET AS A PROP AND KEEPS IT NOWHERE ELSE. It writes no storage, no
 *   URL, no log; its only copy goes to the clipboard when the person asks. The owner of the secret is
 *   `WebhooksTab`'s state (create) or the endpoint card's state (roll), which drops it on "I've saved
 *   the secret", on the card closing, on an org switch and on unmount — so once this card is gone, the
 *   secret is gone from the page.
 *
 * The 304 shape: the warning frame, the secret box with Copy, the verify snippets in a disclosure
 * (they take no secret; they read SYREL_WEBHOOK_SECRET), and the one filled button. The create
 * variant carries Send test and its verdict ("It is in this endpoint's log."); the roll variant
 * carries the 24 h overlap line instead.
 */
import { useEffect, useRef, useState } from "react"
import { Send, Webhook } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { WebhookError, type WebhookTestResult } from "@/lib/api/webhooks"
import { API_KEYS_COPY } from "@/components/settings/apiKeys/apiKeysCopy"
import { formatCallTime } from "@/components/settings/apiKeys/apiKeyFacts"
import { CopyButton, type CopyState } from "@/components/settings/apiKeys/McpConnectSnippets"
import { TONE_CLASS, slotParts, verdictSentence, type LogTone } from "./webhookFacts"
import { nodeSnippet, pythonSnippet } from "./webhookSnippets"
import { WEBHOOKS_COPY } from "./webhooksCopy"

const C = WEBHOOKS_COPY
const COPY_STATE_MS = 2000

type CopyId = "secret" | "python" | "node"

export function WebhookSecretOnce({
  mode,
  secret,
  host,
  overlapUntil = null,
  now,
  sendTest,
  onDone,
}: {
  mode: "create" | "roll"
  secret: string
  host: string
  /** Roll: when the previous secret stops working (the server's `previous_secret_expires_at`). */
  overlapUntil?: string | null
  now?: Date
  /** Create: the parent's `sendWebhookTest(id)`. */
  sendTest?: () => Promise<WebhookTestResult>
  onDone: () => void
}) {
  const [copy, setCopy] = useState<Record<CopyId, CopyState>>({ secret: "idle", python: "idle", node: "idle" })
  const [announce, setAnnounce] = useState("")
  const [testing, setTesting] = useState(false)
  const [verdict, setVerdict] = useState<{ tone: LogTone; text: string } | null>(null)
  const timers = useRef<number[]>([])
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    const pending = timers.current
    return () => {
      alive.current = false
      pending.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  const python = pythonSnippet()
  const node = nodeSnippet()
  const text: Record<CopyId, string> = { secret, python, node }

  async function doCopy(id: CopyId) {
    let ok = false
    try {
      await navigator.clipboard.writeText(text[id])
      ok = true
    } catch {
      ok = false
    }
    if (!alive.current) return
    setCopy((c) => ({ ...c, [id]: ok ? "done" : "failed" }))
    setAnnounce(ok ? API_KEYS_COPY.once.copiedAnnounce : "")
    timers.current.push(
      window.setTimeout(() => {
        if (!alive.current) return
        setCopy((c) => ({ ...c, [id]: "idle" }))
        setAnnounce("")
      }, COPY_STATE_MS),
    )
  }

  async function doTest() {
    if (!sendTest || testing) return
    setTesting(true)
    try {
      const result = await sendTest()
      if (alive.current) setVerdict(verdictSentence({ ok: true, result }, "once"))
    } catch (err) {
      if (!alive.current) return
      const code = err instanceof WebhookError ? err.code : null
      setVerdict(verdictSentence({ ok: false, code, message: err instanceof Error ? err.message : "" }, "once"))
    } finally {
      if (alive.current) setTesting(false)
    }
  }

  const failedLine = (id: CopyId) =>
    copy[id] === "failed" ? <p className="mt-1 text-xs text-[hsl(0_80%_80%)]">{API_KEYS_COPY.once.copyFailedLine}</p> : null
  const at = now ?? new Date()

  return (
    <div data-testid="webhook-secret-once" className="rounded-[14px] border border-warning/55 bg-warning/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Webhook className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
        <span className="font-headline text-base font-semibold">{C.once.title}</span>
        <span className="font-mono text-xs text-muted-foreground">{host}</span>
      </div>

      <p className="mt-3 text-sm text-warning">{mode === "roll" ? C.once.warningRoll : C.once.warning}</p>
      {mode === "roll" && overlapUntil && (
        <p className="mt-1 text-xs text-muted-foreground">
          {slotParts(C.once.overlap, { time: formatCallTime(overlapUntil, at) }).map((p, i) =>
            p.bold ? (
              <b key={i} className="font-semibold text-foreground">
                {p.text}
              </b>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
        </p>
      )}

      <div className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-background p-3">
        <span className="flex-1 break-all font-mono text-sm">{secret}</span>
        <CopyButton state={copy.secret} label={C.once.copySecret} onCopy={() => void doCopy("secret")} />
      </div>
      {failedLine("secret")}

      {mode === "create" && sendTest && (
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px] sm:min-h-0"
            onClick={() => void doTest()}
            disabled={testing}
          >
            <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {testing ? C.act.testing : C.act.test}
          </Button>
          {verdict && (
            <p role="status" className={cn("mt-2 text-xs", TONE_CLASS[verdict.tone])}>
              {verdict.text}
            </p>
          )}
        </div>
      )}

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted-foreground">{C.once.how}</summary>
        {(
          [
            ["python", C.once.python, C.once.copyPython, python],
            ["node", C.once.node, C.once.copyNode, node],
          ] as const
        ).map(([id, label, copyLabel, body]) => (
          <div key={id} className="mt-3">
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <span>{label}</span>
              <CopyButton state={copy[id]} label={copyLabel} onCopy={() => void doCopy(id)} />
            </div>
            <pre className="mt-1 overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs leading-[1.6]">
              {body}
            </pre>
            {failedLine(id)}
          </div>
        ))}
        <p className="mt-3 text-muted-foreground">{C.once.rawBody}</p>
        <p className="mt-1 text-muted-foreground">{C.once.dedupe}</p>
      </details>

      <div className="mt-4">
        <Button type="button" className="gradient-primary" onClick={onDone}>
          {API_KEYS_COPY.once.done}
        </Button>
      </div>
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  )
}
