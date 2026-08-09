import { useCallback, useEffect, useState } from "react"
import { Lock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getModelDefault, setModelDefault, type ModelDefault } from "@/lib/api"

/**
 * Phase 167 Plan 07 (VIS-02 / D-167-04 / SEED-116) — the per-user default-model picker.
 *
 * The FIRST concrete SEED-116 two-layer preference in the UI. It clones the 024-A
 * JudgeModelPicker idiom near-1:1: a registry-only `<select>` bound to the caller's
 * `/me/preferences` default, save-on-select (persist → re-read the server-derived pair),
 * a load effect with a `cancelled` guard, and an ALWAYS-ON 🔒 footer that never reads
 * blank.
 *
 * The two-layer proof (the ONE thing this picker adds over the judge knob):
 *   - the select offers ONLY the operator/org ENABLED `allowed_models` — the user can
 *     never pick outside the governed set (the server re-validates on PUT, 400 otherwise);
 *   - a persisted UNKNOWN value stays selectable as "(current)" so a round-trip never
 *     silently drops it;
 *   - when the operator LOCK is on (`locked`), the select is DISABLED and the footer
 *     names the governed default — the user override is inert (the server honors the lock
 *     regardless; the disable is courtesy, the server is the wall — T-167-14b).
 *
 * Server-derived, never a separate optimistic store: every read/write returns the fresh
 * {default_model, effective_model, locked, allowed_models} view and we render off it.
 */
export function ModelDefaultPreference() {
  const [pref, setPref] = useState<ModelDefault | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const p = await getModelDefault()
        if (!cancelled) setPref(p)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load your default model")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onSelect = useCallback(async (value: string) => {
    setSaving(true)
    setError(null)
    try {
      // "" clears the override back to the operator default (setModelDefault(null)); any
      // other value persists the pick. The server validates it ∈ the allowed-set (400 on
      // an out-of-set model) + honors the lock, then returns the fresh two-layer view so
      // the knob stays server-derived.
      const updated = await setModelDefault(value || null)
      setPref(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your default model")
    } finally {
      setSaving(false)
    }
  }, [])

  const defaultModel = pref?.default_model ?? null
  const locked = pref?.locked ?? false

  // Registry-only options (VIS-02), deduped + sorted. A persisted value the allowed-set no
  // longer contains stays selectable as "(current)" so the round-trip never drops it.
  const models = Array.from(new Set(pref?.allowed_models ?? [])).sort((a, b) => a.localeCompare(b))
  const currentIsUnknown = !!defaultModel && !models.includes(defaultModel)

  // The EFFECTIVE model — never blank: the server-composed effective default, else the raw
  // preference, else a plain fallback phrase. This is what a new chat actually defaults to.
  const effective = pref?.effective_model || defaultModel || "your organization's default"

  return (
    <div className="rounded-lg border border-border bg-card/60 p-5 shadow-sm">
      <h4 className="font-headline text-sm font-bold text-foreground">Default chat model</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">
        The model new chats use by default — chosen from the set your administrator has enabled.
        {locked
          ? " Your administrator has locked this, so it can’t be changed here."
          : " You can still switch models inside any chat."}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <select
          aria-label="Default model"
          value={defaultModel ?? ""}
          disabled={saving || locked}
          onChange={(e) => void onSelect(e.target.value)}
          className="h-8 flex-1 rounded-md bg-muted/30 px-2 text-xs font-mono ghost-border focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <option value="">Auto · {pref?.effective_model || "organization default"}</option>
          {/* Keep an unknown persisted value selectable so the round-trip never drops it. */}
          {currentIsUnknown && defaultModel && (
            <option value={defaultModel}>{defaultModel} (current)</option>
          )}
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {saving && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {/* ALWAYS-ON 🔒 footer (024-A) — the EFFECTIVE model, never blank. When locked it goes
          amber and names the governed default: this is where the operator lock surfaces
          (SEED-116 two-layer). Unlocked it reads calm indigo — the model that actually flows. */}
      <div
        className={cn(
          "mt-2 flex items-center gap-2 rounded-md px-3 py-2 ghost-border",
          locked ? "bg-amber-500/10 border-amber-500/30" : "bg-primary/10",
        )}
      >
        <Lock className={cn("h-3.5 w-3.5 shrink-0", locked ? "text-amber-400" : "text-primary")} />
        <span
          data-testid="model-default-effective"
          className="truncate text-xs font-mono text-foreground/90"
        >
          {locked
            ? `Set by your administrator: ${effective}`
            : `Effective model: ${effective}`}
        </span>
      </div>

      {error && <p className="mt-2 text-[11px] text-amber-500">{error}</p>}
    </div>
  )
}
