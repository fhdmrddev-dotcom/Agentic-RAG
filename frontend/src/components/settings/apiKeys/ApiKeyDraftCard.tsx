/**
 * Phase 293-04 (D-02, D-04, D-11, D-18) — the create form inside the draft card (sketch C).
 *
 * Label (1-60 characters, trimmed), the caller's PUBLISHED workflows from the server (a file-upload
 * one is a disabled row with its reason), and an expiry of 30 / 90 / 365 days or never, with 90
 * preselected (D-04). Create key stays disabled, and SAYS why (`aria-describedby`), until a label
 * and one workflow are present.
 *
 * ⚠ Esc does nothing destructive here; only Discard draft discards. A create failure keeps every
 *   value the person chose (the parent owns `failure` and never remounts this card on it).
 * ⚠ A ⋯ menu pre-pick is ticked only once the server's list says it CAN be ticked, and the hint
 *   waits for that list too, so it never claims "already picked" about a row it could not tick.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ApiKeyCreateBody, StartableWorkflow } from "@/lib/api/apiKeys"
import type { ApiKeyPrepick } from "./apiKeyPrepick"
import { API_KEYS_COPY, fillCopy } from "./apiKeysCopy"
import { startableRowFacts } from "./apiKeyFacts"

const C = API_KEYS_COPY

type Expiry = "30" | "90" | "365" | "never"
const EXPIRIES: readonly Expiry[] = ["30", "90", "365", "never"]
const EXPIRY_DAYS: Record<Expiry, ApiKeyCreateBody["expires_in_days"]> = { "30": 30, "90": 90, "365": 365, never: null }
const MAX_LABEL = 60

export function ApiKeyDraftCard({
  workflows,
  workflowsFailed,
  draftsHidden,
  from,
  busy,
  failure,
  onRetryWorkflows,
  onCreate,
  onDiscard,
}: {
  /** null while the picker list loads. */
  workflows: readonly StartableWorkflow[] | null
  workflowsFailed: boolean
  draftsHidden: number
  from: ApiKeyPrepick | null
  busy: boolean
  failure: string | null
  onRetryWorkflows: () => void
  onCreate: (body: ApiKeyCreateBody) => void
  onDiscard: () => void
}) {
  const [label, setLabel] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [expiry, setExpiry] = useState<Expiry>("90")
  const appliedFrom = useRef(false)
  const labelRef = useRef<HTMLInputElement>(null)
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([])
  const ids = { label: useId(), why: useId(), wf: useId(), exp: useId() }

  useEffect(() => {
    labelRef.current?.focus()
  }, [])

  const fromRow = from && workflows ? workflows.find((w) => w.id === from.workflowId) ?? null : null
  useEffect(() => {
    if (appliedFrom.current || !fromRow) return
    appliedFrom.current = true
    if (fromRow.startable) setPicked([fromRow.id])
  }, [fromRow])

  const trimmed = label.trim()
  const why = !trimmed ? C.draft.needLabel : picked.length === 0 ? C.draft.needWorkflow : null
  const canCreate = why === null && !busy

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  function onRadioKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (i + delta + EXPIRIES.length) % EXPIRIES.length
    setExpiry(EXPIRIES[next])
    radioRefs.current[next]?.focus()
  }

  function submit() {
    if (!canCreate) return
    // Server order is kept: the first picked row in LIST order is the one the show-once curl uses.
    const order = (workflows ?? []).map((w) => w.id)
    const workflow_ids = [...picked].sort((a, b) => order.indexOf(a) - order.indexOf(b))
    onCreate({ label: trimmed, workflow_ids, expires_in_days: EXPIRY_DAYS[expiry] })
  }

  const hintFrom =
    fromRow === null ? null : fromRow.startable ? fillCopy(C.draft.fromMenu, { workflow: from?.name || fromRow.name }) : fillCopy(C.draft.fromMenuFile, { workflow: from?.name || fromRow.name })

  const draftsHint =
    draftsHidden <= 0 ? C.draft.workflowsHintNone : draftsHidden === 1 ? C.draft.workflowsHintOne : fillCopy(C.draft.workflowsHint, { N: draftsHidden })

  return (
    <div data-testid="api-key-draft" className="rounded-[14px] border border-primary bg-card p-4 ring-1 ring-primary/15">
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
        <span className={cn("font-headline text-base font-semibold", !trimmed && "text-muted-foreground")}>
          {trimmed || C.draft.titlePlaceholder}
        </span>
        <span className="rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">{C.draft.tag}</span>
      </div>

      <div className="mt-4 grid gap-3">
        {hintFrom && <p className="text-xs text-primary">{hintFrom}</p>}

        <div className="grid gap-1 md:grid-cols-[128px_1fr] md:gap-4">
          <label htmlFor={ids.label} className="pt-1.5 text-sm">
            {C.draft.labelField}
          </label>
          <div>
            <Input
              id={ids.label}
              ref={labelRef}
              className="h-8"
              value={label}
              maxLength={MAX_LABEL}
              placeholder={C.draft.labelPlaceholder}
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">{C.draft.labelHint}</p>
          </div>
        </div>

        <div className="grid gap-1 md:grid-cols-[128px_1fr] md:gap-4">
          <span id={ids.wf} className="pt-1.5 text-sm">
            {C.draft.workflowsField}
          </span>
          <div>
            <div role="group" aria-labelledby={ids.wf} className="max-h-[208px] overflow-y-auto rounded-md border border-border">
              {workflows === null && !workflowsFailed && (
                <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
                  {C.draft.workflowsLoading}
                </p>
              )}
              {workflowsFailed && (
                <div role="alert" className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-[hsl(0_80%_80%)]">
                  <span>{C.draft.workflowsFailed}</span>
                  <Button type="button" variant="outline" size="sm" className="h-7" onClick={onRetryWorkflows}>
                    {C.tab.retry}
                  </Button>
                </div>
              )}
              {workflows !== null && workflows.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">{C.draft.noWorkflows}</p>
              )}
              {workflows?.map((w) => {
                const row = startableRowFacts(w)
                return (
                  <label
                    key={w.id}
                    className={cn(
                      "flex items-center gap-2 border-t border-border/60 px-3 py-1.5 text-sm first:border-t-0",
                      row.disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      disabled={row.disabled}
                      checked={picked.includes(w.id)}
                      onChange={() => toggle(w.id)}
                    />
                    <span className="flex-1">{w.name}</span>
                    <span className={cn("text-right text-xs", row.disabled ? "" : "font-mono text-muted-foreground")}>{row.right}</span>
                  </label>
                )
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{draftsHint}</p>
          </div>
        </div>

        <div className="grid gap-1 md:grid-cols-[128px_1fr] md:gap-4">
          <span id={ids.exp} className="pt-1.5 text-sm">
            {C.draft.expiresField}
          </span>
          <div>
            <div role="radiogroup" aria-labelledby={ids.exp} className="inline-flex rounded-md border border-border p-0.5">
              {EXPIRIES.map((e, i) => (
                <button
                  key={e}
                  ref={(el) => {
                    radioRefs.current[i] = el
                  }}
                  type="button"
                  role="radio"
                  aria-checked={expiry === e}
                  tabIndex={expiry === e ? 0 : -1}
                  onClick={() => setExpiry(e)}
                  onKeyDown={(ev) => onRadioKey(ev, i)}
                  className={cn(
                    "rounded px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    expiry === e ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {C.draft.expiresOptions[e]}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{expiry === "never" ? C.draft.expiresHintNever : C.draft.expiresHint}</p>
          </div>
        </div>

        <p className="border-l-[3px] border-primary bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {C.draft.runsAsLead}
          <b className="font-semibold text-foreground">{C.draft.runsAsBold}</b>
          {C.draft.runsAsTail}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="gradient-primary"
            disabled={!canCreate}
            aria-describedby={why ? ids.why : undefined}
            onClick={submit}
          >
            {busy ? C.draft.creating : C.draft.create}
          </Button>
          <Button type="button" variant="ghost" onClick={onDiscard}>
            {C.draft.discard}
          </Button>
          {why && (
            <span id={ids.why} className="text-xs text-muted-foreground">
              {why}
            </span>
          )}
        </div>
        {failure !== null && (
          <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
            {failure}
          </p>
        )}
      </div>
    </div>
  )
}
