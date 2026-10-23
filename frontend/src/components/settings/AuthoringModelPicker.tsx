import { useCallback, useEffect, useState } from "react"
import { Lock, Loader2 } from "lucide-react"
import { getAuthoringModel, setAuthoringModel } from "@/lib/api"

/**
 * Migration 212 (operator direction 2026-10-23: every non-secret setting lives in the UI) — the
 * workflow-drafting model. The sibling of `JudgeModelPicker`, in the same 024-A idiom: one select
 * plus an always-on 🔒 footer naming the model drafting will actually use.
 *
 * The options are the SERVER's list (`authoring_model_options`: registry models that can force an
 * emission), because drafting is one forced emission and any other model can never return a draft.
 * The save is validated against the same rule; a refusal shows the server's words and the select
 * stays on what is saved. "Auto" clears the setting, so drafting falls back to
 * HARNESS_AUTHORING_MODEL, then the registry default — and the footer says which.
 */
export function AuthoringModelPicker() {
  const [model, setModel] = useState("")
  const [resolved, setResolved] = useState<string | null>(null)
  const [options, setOptions] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await getAuthoringModel()
        if (cancelled) return
        setModel(r.model)
        setResolved(r.resolved)
        setOptions(r.options)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the drafting model")
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onSelect = useCallback(async (next: string) => {
    setSaving(true)
    setError(null)
    try {
      const updated = await setAuthoringModel(next)
      setModel(updated.harness_authoring_model ?? "")
      setResolved(updated.resolved_harness_authoring_model ?? null)
      if (updated.authoring_model_options) setOptions(updated.authoring_model_options)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the drafting model")
    } finally {
      setSaving(false)
    }
  }, [])

  const sorted = Array.from(new Set(options)).sort((a, b) => a.localeCompare(b))
  const currentIsUnlisted = !!model && !sorted.includes(model)
  const effective = model || resolved

  return (
    <div className="rounded-lg border border-border bg-card/60 p-5 shadow-sm">
      <h4 className="font-headline text-sm font-bold text-foreground">Workflow drafting model</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">
        The model that writes a workflow from your description and reads the files you attach. Only
        models that can return a structured draft are listed.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <select
          aria-label="Workflow drafting model"
          value={model}
          disabled={saving || !loaded}
          onChange={(e) => void onSelect(e.target.value)}
          className="h-8 flex-1 rounded-md bg-muted/30 px-2 text-xs font-mono ghost-border focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Auto · {resolved ?? "none available"}</option>
          {currentIsUnlisted && <option value={model}>{model} (current)</option>}
          {sorted.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {saving && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {loaded && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 ghost-border">
          <Lock className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span data-testid="authoring-effective" className="truncate text-xs font-mono text-foreground/90">
            {effective
              ? `Drafts with: ${effective}${model ? "" : " (automatic)"}`
              : "No model that can draft workflows is set up"}
          </span>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-amber-500">{error}</p>}
    </div>
  )
}
