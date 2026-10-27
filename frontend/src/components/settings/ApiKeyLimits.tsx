import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSettings, type FullAppSettings, type SettingsUpdate } from "@/lib/api"
import { API_KEYS_COPY } from "@/components/settings/apiKeys/apiKeysCopy"

/**
 * ApiKeyLimits — Phase 293-03 (START-02 / D-14, UI-SPEC Surface 6).
 *
 * The operator's two per-key allowances for calls from other systems: how many runs a key may
 * start a minute (default 10) and how many status reads it may make a minute (default 120). Both
 * are app-wide `app_settings` columns (migration 215), bounded in three places that agree: the
 * migration CHECK, the `PUT /settings` 400, and the clamp below (1..60 and 10..600).
 *
 * WHY A LEAF. `SettingsPage.tsx` is G-5 FIRING, so (the 292.1 `AgentRoundLimits` precedent this
 * file copies) this component owns its own fetch and draft state, and the page holds only a ref.
 *
 * ONE SAVE PER SECTION. There is no button here: the Integrations tab's one Save merges
 * `changes()` into its PUT and hands the response back through `adopt()`. Members never see this
 * card (the Integrations tab is not rendered for them); they read the effective values on their
 * own API keys tab, served by the keys read.
 *
 * ⛔ Invariants:
 *  - It owns its fetch and drafts; the page reaches it only through the handle below.
 *  - CHANGED FIELDS ONLY: `changes()` carries a limit only when its value differs from the loaded one.
 *  - A cleared or non-numeric field is never sent — `Number("") === 0` must never reach the server
 *    (the 294-REVIEW WR-04 defect). It is simply left out.
 *  - Until the read has answered, `changes()` is `{}` — the section still saves its other fields.
 *  - After a save the fields show the SERVER's values, never the typed ones.
 *  - The bounds below mirror the server's; the server stays the boundary.
 *  - (292.1-REVIEW WR-05) Nothing is shown as live, or saved, before the read answers: the fields
 *    are empty and locked while loading, and a failed read says so (with Retry) — never 10 / 120.
 */

const COPY = API_KEYS_COPY.limits

const STARTS = { min: 1, max: 60, fallback: 10 } as const
const READS = { min: 10, max: 600, fallback: 120 } as const

/** Empty or non-numeric reports nothing; anything else is clamped to the field's bounds. */
function limitFrom(raw: string, bounds: { min: number; max: number }): number | null {
  if (raw.trim() === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.min(bounds.max, Math.max(bounds.min, Math.trunc(n)))
}

type Limits = { starts: number; reads: number }

/** What the Integrations save reads before its PUT, and hands the PUT's response back to. */
export type ApiKeyLimitsHandle = {
  /** The changed limits, ready to spread into the section's body; `{}` until the read has answered. */
  changes: () => SettingsUpdate
  /** Show the values the server now holds. */
  adopt: (saved: Pick<FullAppSettings, "api_key_starts_per_minute" | "api_key_reads_per_minute">) => void
}

function LimitRow({
  id,
  label,
  hint,
  value,
  min,
  max,
  disabled,
  onChange,
  onBlur,
}: {
  id: string
  label: string
  hint: string
  value: string
  min: number
  max: number
  disabled: boolean
  onChange: (raw: string) => void
  onBlur: () => void
}) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={id} className="w-56 shrink-0 text-sm text-muted-foreground">
          {label}
        </Label>
        <div className="max-w-xs flex-1">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            value={value}
            min={min}
            max={max}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className="h-8 w-24 bg-muted/30 font-mono text-sm ghost-border"
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export function ApiKeyLimits({ ref }: { ref?: Ref<ApiKeyLimitsHandle> }) {
  const [loaded, setLoaded] = useState<Limits>({ starts: STARTS.fallback, reads: READS.fallback })
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "failed">("loading")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [startsDraft, setStartsDraft] = useState("")
  const [readsDraft, setReadsDraft] = useState("")
  const alive = useRef(true)

  function load() {
    setLoadState("loading")
    setLoadError(null)
    getSettings()
      .then((s) => {
        if (!alive.current) return
        const limits = {
          // An older backend that omits the fields runs on the same 10 / 120 defaults.
          starts: s.api_key_starts_per_minute ?? STARTS.fallback,
          reads: s.api_key_reads_per_minute ?? READS.fallback,
        }
        setLoaded(limits)
        setStartsDraft(String(limits.starts))
        setReadsDraft(String(limits.reads))
        setLoadState("loaded")
      })
      .catch((e: unknown) => {
        if (!alive.current) return
        setLoadError(e instanceof Error ? e.message : null)
        setLoadState("failed")
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
    const starts = limitFrom(startsDraft, STARTS)
    const reads = limitFrom(readsDraft, READS)
    if (starts !== null && starts !== loaded.starts) body.api_key_starts_per_minute = starts
    if (reads !== null && reads !== loaded.reads) body.api_key_reads_per_minute = reads
    return body
  }

  // No deps on purpose: the handle is rebuilt every render, so the page's save always reads the
  // drafts as last committed.
  useImperativeHandle(ref, () => ({
    changes,
    adopt(saved) {
      if (loadState !== "loaded") return
      const limits = {
        starts: saved.api_key_starts_per_minute ?? loaded.starts,
        reads: saved.api_key_reads_per_minute ?? loaded.reads,
      }
      setLoaded(limits)
      setStartsDraft(String(limits.starts))
      setReadsDraft(String(limits.reads))
    },
  }))

  /** On blur, show the value that would be sent (clamped) — or the loaded one for a cleared field. */
  function settle(draft: string, bounds: { min: number; max: number }, fallback: number, set: (v: string) => void) {
    return () => set(String(limitFrom(draft, bounds) ?? fallback))
  }

  const ready = loadState === "loaded"

  return (
    <Card className="ghost-border bg-card/60 shadow-sm" data-api-key-limits>
      <CardHeader>
        <CardTitle className="text-base font-headline font-bold">{COPY.title}</CardTitle>
        <CardDescription>{COPY.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <LimitRow
          id="api-key-limit-starts"
          label={COPY.startsLabel}
          hint={COPY.startsHint}
          value={startsDraft}
          min={STARTS.min}
          max={STARTS.max}
          disabled={!ready}
          onChange={setStartsDraft}
          onBlur={settle(startsDraft, STARTS, loaded.starts, setStartsDraft)}
        />
        <LimitRow
          id="api-key-limit-reads"
          label={COPY.readsLabel}
          hint={COPY.readsHint}
          value={readsDraft}
          min={READS.min}
          max={READS.max}
          disabled={!ready}
          onChange={setReadsDraft}
          onBlur={settle(readsDraft, READS, loaded.reads, setReadsDraft)}
        />
        {loadState === "failed" && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-[hsl(0_80%_80%)]">
            <span>
              {COPY.loadFailed}
              {loadError ? ` ${loadError}` : ""}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={load}>
              {COPY.retry}
            </Button>
          </div>
        )}
        <p className="py-1 text-xs text-muted-foreground">{COPY.footer}</p>
      </CardContent>
    </Card>
  )
}
