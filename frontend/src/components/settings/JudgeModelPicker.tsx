import { useCallback, useEffect, useState } from "react"
import { Lock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getJudgeModel, setJudgeModel } from "@/lib/api"

/**
 * Phase 137.1 Plan 10 (EVAL-05 / D-11, D-12 / sketch 060-A) — the independent judge
 * model knob. It sits beneath the engine-health board as its own card, reusing the
 * 024-A picker idiom (a preset `<select>` + an ALWAYS-ON 🔒 footer): one select bound
 * to the `harness_judge_model` setting, offering ONLY registry-known models, with a
 * persistent lock footer that shows the EFFECTIVE judge (never a blank that implies
 * "configured") and its double duty.
 *
 * Honesty / security locks:
 *   - D-12 (T-137.1-S1): the select offers ONLY registry-known models; the Plan 05
 *     server validates the write against the registry (400 on unknown). The effective
 *     default is ALWAYS shown, so an unset value never reads as blank/misconfigured.
 *   - D-11: the footer names the judge's double duty — it grades eval verdicts AND is
 *     the publish-gauntlet judge (ONE resolver, ONE knob). The effective judge is the
 *     raw setting, else the resolver default, else the hard floor claude-opus-4-8.
 *
 * Wiring mirrors the skill_builder_model client shape: getJudgeModel() reads the
 * effective pair; setJudgeModel() persists ("" clears back to the resolver default)
 * and returns the refreshed settings, from which we re-read harness_judge_model +
 * resolved_harness_judge_model so the knob stays derived from the server, never a
 * separate optimistic store.
 */

const DEFAULT_JUDGE = "claude-opus-4-8"

export function JudgeModelPicker({ registryModels }: { registryModels: string[] }) {
  const [judgeModel, setJudgeModelValue] = useState("")
  const [resolvedJudge, setResolvedJudge] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { judge_model, resolved_judge_model } = await getJudgeModel()
        if (cancelled) return
        setJudgeModelValue(judge_model)
        setResolvedJudge(resolved_judge_model)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the judge model")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onSelect = useCallback(async (model: string) => {
    setSaving(true)
    setError(null)
    try {
      // Persist the independent judge (harness_judge_model). The Plan 05 server validates
      // it against the registry (400 on unknown); "" clears back to the resolver default.
      // Re-read the pair from the refreshed settings so the knob stays server-derived.
      const updated = await setJudgeModel(model)
      setJudgeModelValue(updated.harness_judge_model)
      setResolvedJudge(updated.resolved_harness_judge_model)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the judge model")
    } finally {
      setSaving(false)
    }
  }, [])

  // Registry-only options (D-12), deduped + sorted. A persisted value the registry no
  // longer knows stays selectable as "(current)" so a round-trip never silently drops it.
  const models = Array.from(new Set(registryModels)).sort((a, b) => a.localeCompare(b))
  const currentIsCustom = !!judgeModel && !models.includes(judgeModel)

  // The EFFECTIVE judge — never blank: the raw setting, else the resolver default, else
  // the hard floor (claude-opus-4-8). This is what actually grades; shown always (D-11).
  const effective = judgeModel || resolvedJudge || DEFAULT_JUDGE

  return (
    <div className="rounded-lg border border-border bg-card/60 p-5 shadow-sm">
      <h4 className="font-headline text-sm font-bold text-foreground">Judge model</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">
        The independent model that grades eval verdicts and gates skill publishing. Registry-known
        models only — the server validates the choice.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <select
          aria-label="Judge model"
          value={judgeModel}
          disabled={saving}
          onChange={(e) => void onSelect(e.target.value)}
          className="h-8 flex-1 rounded-md bg-muted/30 px-2 text-xs font-mono ghost-border focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Auto · {resolvedJudge || DEFAULT_JUDGE} (default)</option>
          {/* Keep an unknown persisted value selectable so the round-trip never drops it. */}
          {currentIsCustom && <option value={judgeModel}>{judgeModel} (current)</option>}
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {saving && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {/* ALWAYS-ON 🔒 footer (024-A) — the EFFECTIVE judge, never blank + its double duty. */}
      <div className={cn("mt-2 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 ghost-border")}>
        <Lock className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span data-testid="judge-effective" className="truncate text-xs font-mono text-foreground/90">
          Effective judge: {effective} · grades eval verdicts + the publish-gauntlet judge
        </span>
      </div>

      {error && <p className="mt-2 text-[11px] text-amber-500">{error}</p>}
    </div>
  )
}
