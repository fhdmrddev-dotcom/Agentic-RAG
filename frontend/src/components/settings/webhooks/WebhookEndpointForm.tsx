/**
 * Phase 308-05 (D-24, D-27, D-46; UI-SPEC §1e, A-7, A-8, A-9, T-308-23) — add and edit one endpoint.
 *
 * The client checks the address's FORM only (parseable, no name:password@, no #fragment), on blur
 * and on Save. Reachability is the server's: when it refuses, the line under the address reads the
 * one D-24 sentence, focus returns to the input, and every typed value is kept. No reason code, IP
 * or other internal ever reaches the screen. The client never rewrites what was typed.
 *
 * ⚠ NEVER OPTIMISTIC. `save(body)` is the parent's server call; the form only closes when the parent
 *   says so after a 2xx. A failure keeps the form as typed and says so in the server's words.
 * ⚠ The address is text in an input — nothing here builds a link from it.
 */
import { useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { WebhookError, type WebhookBody, type WebhookEventType } from "@/lib/api/webhooks"
import { fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import { checkAddressForm } from "./webhookFacts"
import { WEBHOOKS_COPY } from "./webhooksCopy"

const C = WEBHOOKS_COPY
const F = C.form

const EVENTS: readonly { type: WebhookEventType; sentence: string }[] = [
  { type: "run.finished", sentence: F.ev.finished },
  { type: "run.waiting", sentence: F.ev.waiting },
  { type: "document.ingested", sentence: F.ev.ingested },
]
const ADD_DEFAULT: readonly WebhookEventType[] = ["run.finished", "run.waiting"]
const COUNTER_FROM = 80

type FormLine = "notUrl" | "userinfo" | "fragment"

export function WebhookEndpointForm({
  mode,
  initial,
  save,
  onDiscard,
}: {
  mode: "add" | "edit"
  /** Edit: the saved values. */
  initial?: WebhookBody
  /** The parent's server call; resolves after a 2xx, throws the refusal otherwise. */
  save: (body: WebhookBody) => Promise<void>
  onDiscard: () => void
}) {
  const id = useId()
  const [url, setUrl] = useState(initial?.url ?? "")
  const [events, setEvents] = useState<WebhookEventType[]>(initial ? [...initial.event_types] : [...ADD_DEFAULT])
  const [description, setDescription] = useState(initial?.description ?? "")
  const [formLine, setFormLine] = useState<FormLine | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const addressRef = useRef<HTMLInputElement>(null)

  const editing = mode === "edit"
  const why = url.trim() === "" ? F.needAddress : events.length === 0 ? F.needEvent : null
  const addressLine = refusal ?? (formLine ? F[formLine] : null)
  const ids = { address: `${id}-address`, addressLine: `${id}-address-line`, hint: `${id}-hint`, why: `${id}-why`, events: `${id}-events`, desc: `${id}-desc` }

  function checkForm(): boolean {
    const line = url.trim() === "" ? null : checkAddressForm(url)
    setFormLine(line)
    return line === null
  }

  function toggle(type: WebhookEventType) {
    setEvents((cur) => (cur.includes(type) ? cur.filter((t) => t !== type) : EVENTS.map((e) => e.type).filter((t) => t === type || cur.includes(t))))
  }

  async function handleSave() {
    if (busy || why !== null) return
    setRefusal(null)
    setFailure(null)
    if (!checkForm()) {
      addressRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      await save({ url: url.trim(), event_types: events, description: description.trim() === "" ? null : description })
    } catch (err) {
      const code = err instanceof WebhookError ? err.code : null
      const message = err instanceof Error ? err.message : ""
      if (code === "address_refused") {
        setRefusal(F.refused)
        window.setTimeout(() => addressRef.current?.focus(), 0)
      } else if (code === "invalid_url") {
        setRefusal(message || F.notUrl)
        window.setTimeout(() => addressRef.current?.focus(), 0)
      } else if (code === "no_cipher") {
        setFailure(F.noCipher)
      } else if (code !== null && message) {
        setFailure(message)
      } else {
        setFailure(fillCopy(F.saveFailed, { detail: message }).replace(/\s{2,}/g, " "))
      }
    } finally {
      setBusy(false)
    }
  }

  const Title = editing ? "h4" : "h3"
  return (
    <form
      className={cn("grid gap-4", !editing && "rounded-[14px] border border-border bg-card p-4")}
      onSubmit={(e) => {
        e.preventDefault()
        void handleSave()
      }}
    >
      <Title className="font-headline text-base font-semibold">{editing ? F.titleEdit : F.titleAdd}</Title>

      <div className="grid gap-2">
        <label htmlFor={ids.address} className="text-sm">
          {F.address}
        </label>
        <Input
          id={ids.address}
          ref={addressRef}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setRefusal(null)
          }}
          onBlur={() => checkForm()}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          maxLength={2048}
          placeholder={F.addressPlaceholder}
          disabled={busy}
          aria-invalid={addressLine ? true : undefined}
          aria-describedby={addressLine ? `${ids.addressLine} ${ids.hint}` : ids.hint}
          className={cn("font-mono text-sm", addressLine && "border-destructive")}
        />
        {addressLine && (
          <p id={ids.addressLine} className="text-xs text-[hsl(0_80%_80%)]">
            {addressLine}
          </p>
        )}
        <p id={ids.hint} className="text-xs text-muted-foreground">
          {F.addressHint}
        </p>
      </div>

      <div role="group" aria-labelledby={ids.events} className="grid gap-2">
        <span id={ids.events} className="text-sm">
          {F.events}
        </span>
        {EVENTS.map((ev) => (
          <label key={ev.type} className="flex min-h-[44px] items-start gap-2 text-sm sm:min-h-0">
            <input
              type="checkbox"
              className="mt-1 accent-primary"
              checked={events.includes(ev.type)}
              disabled={busy}
              onChange={() => toggle(ev.type)}
            />
            <span>
              <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs">{ev.type}</span>{" "}
              {ev.sentence}
            </span>
          </label>
        ))}
      </div>

      <div className="grid gap-2">
        <label htmlFor={ids.desc} className="text-sm">
          {F.description}
        </label>
        <Input
          id={ids.desc}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={100}
          placeholder={F.descriptionPlaceholder}
          disabled={busy}
        />
        <p className="flex justify-between gap-2 text-xs text-muted-foreground">
          <span>{F.descriptionHint}</span>
          {description.length >= COUNTER_FROM && <span>{fillCopy(F.counter, { n: description.length })}</span>}
        </p>
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDiscard} disabled={busy}>
            {editing ? F.discardEdit : F.discard}
          </Button>
          <Button
            type="submit"
            className="gradient-primary"
            disabled={busy || why !== null}
            aria-describedby={why !== null && !busy ? ids.why : undefined}
          >
            {busy ? F.saving : editing ? F.saveEdit : F.save}
          </Button>
        </div>
        {why !== null && !busy && (
          <p id={ids.why} className="text-right text-xs text-muted-foreground">
            {why}
          </p>
        )}
        {busy && (
          <span role="status" className="sr-only">
            {F.saving}
          </span>
        )}
        {failure !== null && (
          <p role="alert" className="text-xs text-[hsl(0_80%_80%)]">
            {failure}
          </p>
        )}
      </div>
    </form>
  )
}
