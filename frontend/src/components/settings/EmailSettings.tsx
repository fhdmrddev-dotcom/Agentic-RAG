import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSettings, type FullAppSettings, type SettingsUpdate } from "@/lib/api"

/**
 * EmailSettings — Phase 300-05 (D-07, D-08, D-10; UI-SPEC S3).
 *
 * The operator's mail knobs in Settings → Integrations: who run-waiting and invitation emails come
 * from (address and name), how long a run waits before its owner is emailed (60..3600 s, default
 * 120), and the test address every email goes to outside production. "Sent through" is READ-ONLY:
 * the provider and its secret are infra, set in the server environment (D-08).
 *
 * WHY A LEAF. `SettingsPage.tsx` is G-5 FIRING, so (the 293-03 `ApiKeyLimits` precedent this file
 * copies file-for-file) this component owns its own fetch and draft state, and the page holds only
 * a ref.
 *
 * ONE SAVE PER SECTION. There is no button here: the Integrations tab's one Save merges `changes()`
 * into its PUT and hands the response back through `adopt()`. A server 400 (out of bounds, not an
 * address) surfaces in that save's existing error home, as the server's sentence.
 *
 * ⛔ Invariants:
 *  - It owns its fetch and drafts; the page reaches it only through the handle below.
 *  - CHANGED FIELDS ONLY, and only VALID ones: an invalid address shows its line and is not sent.
 *  - An invalid changed address VETOES the section's save (300-REVIEW WR-05): `invalid()` returns
 *    the sentence for the page's error home and the page returns before its PUT, so the save can
 *    never say "Saved" while silently dropping the address, and `adopt()` never wipes the typed
 *    value and its line.
 *  - A cleared or non-numeric delay is never sent (`Number("") === 0` must never reach the server).
 *  - Until the read has answered, `changes()` is `{}`.
 *  - After a save the fields show the SERVER's values, never the typed ones.
 *  - The provider is shown, never sent.
 *  - The delay words are a TWIN of the server's `run_waiting_email.duration_words` (UI-D7 floor
 *    words), pinned to it by one case list both test suites read. Never a second rule.
 */

const COPY = {
  title: "Email",
  description:
    "Who run-waiting and invitation emails come from, and how long a run waits before its owner is emailed.",
  sentThrough: "Sent through",
  fromLabel: "Send from (address)",
  fromHint: "Run-waiting and invitation emails come from this address. Replies are not read.",
  nameLabel: "Send from (name)",
  nameHint: "The sender name people see in their inbox.",
  delayLabel: "Wait before emailing (seconds)",
  delayHint: (words: string) =>
    `A run still waiting after ${words} emails its owner. Between 60 and 3600 seconds.`,
  testLabel: "Test address (outside production)",
  testHint:
    "Outside production, every email goes here instead of to its real recipient. Leave it empty and nothing is sent outside production: each email is only logged.",
  notAnAddress: "That isn't an email address.",
  saveRefused: "An email address in the Email card isn't valid. Fix it, then save again.",
  loadFailed: "Couldn't load the email settings.",
  retry: "Retry loading email settings",
} as const

const PROVIDER_WORDS: Record<"resend" | "smtp", string> = {
  resend: "Resend",
  smtp: "Your mail server (SMTP)",
}

const DELAY = { min: 60, max: 3600, fallback: 120 } as const
const NAME_MAX = 60

/** Twin of `run_waiting_email.duration_words`: floor words, never rounded up. */
function durationWords(seconds: number): string {
  const total = Math.max(0, Math.trunc(seconds))
  if (total < 60) return "less than a minute"
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return minutes === 1 ? "1 minute" : `${minutes} minutes`
  const hours = Math.floor(total / 3600)
  if (hours < 48) return hours === 1 ? "1 hour" : `${hours} hours`
  return `${Math.floor(total / 86400)} days`
}

/** Empty or non-numeric reports nothing; anything else is clamped to 60..3600. */
function delayFrom(raw: string): number | null {
  if (raw.trim() === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.min(DELAY.max, Math.max(DELAY.min, Math.trunc(n)))
}

function hasControlCharacter(value: string): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    if (code < 32 || code === 127) return true
  }
  return false
}

/** Empty, or one bare `local@domain` with a dot in the domain. The server stays the boundary. */
function addressOk(value: string): boolean {
  if (value.trim() === "") return true
  return /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(value) && !hasControlCharacter(value)
}

function nameOk(value: string): boolean {
  return value.length >= 1 && value.length <= NAME_MAX && !hasControlCharacter(value)
}

type Knobs = { delay: number; from: string; name: string; test: string }

/** What the Integrations save reads before its PUT, and hands the PUT's response back to. */
export type EmailSettingsHandle = {
  /** The changed knobs, ready to spread into the section's body; `{}` until the read has answered. */
  changes: () => SettingsUpdate
  /** WR-05: the sentence refusing the save while a changed address is invalid, else `null`.
   *  Also shows that field's own line, blurred or not. */
  invalid: () => string | null
  /** Show the values the server now holds. */
  adopt: (
    saved: Pick<
      FullAppSettings,
      | "notification_email_delay_seconds"
      | "email_from_address"
      | "email_from_name"
      | "email_dev_redirect_address"
    >,
  ) => void
}

function FieldRow({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={id} className="w-56 shrink-0 text-sm text-muted-foreground">
          {label}
        </Label>
        <div className="max-w-xs flex-1">{children}</div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-[hsl(0_80%_80%)]">
          {error}
        </p>
      )}
    </div>
  )
}

const INPUT_CLASS = "h-8 bg-muted/30 font-mono text-sm ghost-border"

export function EmailSettings({ ref }: { ref?: Ref<EmailSettingsHandle> }) {
  const [loaded, setLoaded] = useState<Knobs>({ delay: DELAY.fallback, from: "", name: "Syrel", test: "" })
  const [provider, setProvider] = useState<FullAppSettings["email_provider"]>(undefined)
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "failed">("loading")
  const [delayDraft, setDelayDraft] = useState("")
  const [fromDraft, setFromDraft] = useState("")
  const [nameDraft, setNameDraft] = useState("")
  const [testDraft, setTestDraft] = useState("")
  const [touched, setTouched] = useState<{ from: boolean; test: boolean }>({ from: false, test: false })
  const alive = useRef(true)

  function show(knobs: Knobs) {
    setLoaded(knobs)
    setDelayDraft(String(knobs.delay))
    setFromDraft(knobs.from)
    setNameDraft(knobs.name)
    setTestDraft(knobs.test)
    setTouched({ from: false, test: false })
  }

  function load() {
    setLoadState("loading")
    getSettings()
      .then((s) => {
        if (!alive.current) return
        // An older backend that omits the fields runs on the same defaults.
        show({
          delay: s.notification_email_delay_seconds ?? DELAY.fallback,
          from: s.email_from_address ?? "",
          name: s.email_from_name ?? "Syrel",
          test: s.email_dev_redirect_address ?? "",
        })
        setProvider(s.email_provider)
        setLoadState("loaded")
      })
      .catch(() => {
        if (alive.current) setLoadState("failed")
      })
  }

  useEffect(() => {
    alive.current = true
    load()
    return () => {
      alive.current = false
    }
  }, [])

  function changes(): SettingsUpdate {
    const body: SettingsUpdate = {}
    if (loadState !== "loaded") return body
    const delay = delayFrom(delayDraft)
    if (delay !== null && delay !== loaded.delay) body.notification_email_delay_seconds = delay
    if (fromDraft !== loaded.from && addressOk(fromDraft)) body.email_from_address = fromDraft.trim() === "" ? "" : fromDraft
    if (nameDraft !== loaded.name && nameOk(nameDraft)) body.email_from_name = nameDraft
    if (testDraft !== loaded.test && addressOk(testDraft)) body.email_dev_redirect_address = testDraft.trim() === "" ? "" : testDraft
    return body
  }

  // No deps on purpose: the handle is rebuilt every render, so the page's save always reads the
  // drafts as last committed.
  useImperativeHandle(ref, () => ({
    changes,
    invalid() {
      if (loadState !== "loaded") return null
      const badFrom = fromDraft !== loaded.from && !addressOk(fromDraft)
      const badTest = testDraft !== loaded.test && !addressOk(testDraft)
      if (!badFrom && !badTest) return null
      setTouched((t) => ({ from: t.from || badFrom, test: t.test || badTest }))
      return COPY.saveRefused
    },
    adopt(saved) {
      if (loadState !== "loaded") return
      show({
        delay: saved.notification_email_delay_seconds ?? loaded.delay,
        from: saved.email_from_address ?? loaded.from,
        name: saved.email_from_name ?? loaded.name,
        test: saved.email_dev_redirect_address ?? loaded.test,
      })
    },
  }))

  const ready = loadState === "loaded"
  const hintSeconds = delayFrom(delayDraft) ?? loaded.delay
  const sentThrough =
    provider === "resend" || provider === "smtp" ? (
      PROVIDER_WORDS[provider]
    ) : (
      <>
        Nothing yet. Emails are only logged. Set <code className="font-mono">EMAIL_PROVIDER</code> in the
        server environment to send them.
      </>
    )

  return (
    <Card className="ghost-border bg-card/60 shadow-sm" data-email-settings>
      <CardHeader>
        <CardTitle className="text-base font-headline font-semibold">{COPY.title}</CardTitle>
        <CardDescription>{COPY.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-4 py-1">
          <span className="w-56 shrink-0 text-sm text-muted-foreground">{COPY.sentThrough}</span>
          <span data-testid="email-sent-through" className="max-w-xs flex-1 text-sm text-foreground">
            {ready ? sentThrough : ""}
          </span>
        </div>
        <FieldRow
          id="email-from-address"
          label={COPY.fromLabel}
          hint={COPY.fromHint}
          error={touched.from && !addressOk(fromDraft) ? COPY.notAnAddress : null}
        >
          <Input
            id="email-from-address"
            type="email"
            value={fromDraft}
            disabled={!ready}
            onChange={(e) => setFromDraft(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, from: true }))}
            className={`${INPUT_CLASS} w-full max-w-xs`}
          />
        </FieldRow>
        <FieldRow id="email-from-name" label={COPY.nameLabel} hint={COPY.nameHint}>
          <Input
            id="email-from-name"
            type="text"
            value={nameDraft}
            maxLength={NAME_MAX}
            disabled={!ready}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              if (nameDraft.trim() === "") setNameDraft(loaded.name)
            }}
            className={`${INPUT_CLASS} w-full max-w-xs`}
          />
        </FieldRow>
        <FieldRow id="email-delay-seconds" label={COPY.delayLabel} hint={COPY.delayHint(durationWords(hintSeconds))}>
          <Input
            id="email-delay-seconds"
            type="number"
            inputMode="numeric"
            value={delayDraft}
            min={DELAY.min}
            max={DELAY.max}
            disabled={!ready}
            onChange={(e) => setDelayDraft(e.target.value)}
            onBlur={() => setDelayDraft(String(delayFrom(delayDraft) ?? loaded.delay))}
            className={`${INPUT_CLASS} w-24`}
          />
        </FieldRow>
        <FieldRow
          id="email-test-address"
          label={COPY.testLabel}
          hint={COPY.testHint}
          error={touched.test && !addressOk(testDraft) ? COPY.notAnAddress : null}
        >
          <Input
            id="email-test-address"
            type="email"
            value={testDraft}
            disabled={!ready}
            onChange={(e) => setTestDraft(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, test: true }))}
            className={`${INPUT_CLASS} w-full max-w-xs`}
          />
        </FieldRow>
        {loadState === "failed" && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-[hsl(0_80%_80%)]"
          >
            <span>{COPY.loadFailed}</span>
            <Button type="button" size="sm" variant="outline" onClick={load}>
              {COPY.retry}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
