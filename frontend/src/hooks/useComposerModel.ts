/**
 * Phase 196 Plan 07 Task 2 (D-18 / BUG-260718-04) — useComposerModel.
 *
 * THE CHAT COMPOSER'S PROVIDER/MODEL STATE MACHINE, lifted out of `ChatArea.tsx` verbatim.
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────────────
 *
 * `ChatArea.tsx` is the strongest extraction case on the frontend side of the hot-file
 * ledger, and Phase 194.1's honouring of G-5 was recorded there as a MEASUREMENT —
 * `useState` 7 → 7, `useEffect` 4 → 4, props 8 → 8, every one unmoved. A naive per-thread
 * model restore adds an effect to that file and fails its own recorded test (4 → 5).
 *
 * So the feature took a named narrow seam instead: five `useState` declarations, the
 * provider-load effect and `handleProviderChange` moved here, which honours G-5 by
 * ARITHMETIC rather than by argument — `ChatArea.tsx` goes `useState` 7 → 2 and
 * `useEffect` 4 → 3. A file that loses five state hooks has honoured G-5 by any reading.
 *
 * ── THE FALLBACK CHAIN, AS BULLETS BEFORE ANY CODE ──────────────────────────────────
 *
 * The composer's model is resolved by walking these rungs in order and taking the first
 * that answers:
 *
 *   • the thread's LAST-USED model — the most recent run-backed message's model, when it
 *     is still offered and still ENABLED                            (Task 3 — the new rung)
 *   • the global default `active_model`, when the active provider actually offers it
 *   • that provider's first model, `activeProvider.models[0]`
 *   • `""` — no provider, no models, nothing to select
 *
 * ⚠ ONLY THE FIRST RUNG IS NEW. The bottom three are the shipped `preferred` ternary from
 * `ChatArea.tsx`, moved here unchanged — it already implements *"use the stored value iff
 * the current provider offers it, else fall back"*, which is the same shape the enabled
 * check needs. This file PREPENDS a rung; it does not author a second rule.
 *
 * ── TASK 2 IS BEHAVIOUR-PRESERVING ──────────────────────────────────────────────────
 *
 * Everything below the `disabledModels` addition is a verbatim move. The restore rung, the
 * honest failure reading and their tests land in Task 3, deliberately as a separate commit:
 * shipping an extraction and a feature together makes any regression un-attributable, which
 * is the entire reason the two are separate tasks.
 */
import { useEffect, useState } from "react"

import { getProviders } from "@/lib/api"

/**
 * The provider shape the composer consumes. Declared here rather than in `ChatArea.tsx`
 * because this hook now owns the state that holds it; `MessageInput` accepts it
 * structurally, so nothing downstream needed to change.
 */
export interface ComposerProvider {
  id: string
  name: string
  models: string[]
  is_active: boolean
}

/**
 * The hook's return, as an EXPORTED NAMED type rather than an inline object type — the
 * `useFollowScroll` habit, so a consumer can narrow it in its own signature instead of
 * restating a structural literal that then drifts.
 */
export interface ComposerModelState {
  /** Every provider the operator has configured a key for. */
  providers: ComposerProvider[]
  /** The provider the next send will go to. */
  selectedProvider: string
  /** The selected provider's offered model ids. */
  models: string[]
  /** The model the next send will go to. `""` when nothing could be resolved. */
  selectedModel: string
  /** The composer's own model setter — the picker's `onModelChange`. */
  setSelectedModel: (model: string) => void
  /**
   * Phase 149 (IN-01 / D-149-05): the registry's DEPRECATED ids, for the picker's
   * informational badge. ⚠ Deprecated is NOT disabled — a deprecated model stays
   * selectable.
   */
  deprecatedModels: Set<string>
  /**
   * Phase 196 Plan 07 (D-18 / D-07): the operator-DISABLED ids. Distinct from the set
   * above and used for a different job — this is the one the restore must REFUSE.
   */
  disabledModels: Set<string>
  /**
   * ⚠ Switching provider deliberately CLOBBERS the model to that provider's first. That is
   * shipped behaviour and it stays: a model id is not portable across providers, so
   * carrying the old selection over would leave the composer naming a model the newly
   * chosen provider cannot run. It is also why a restore must apply `provider` BEFORE
   * `model` (Task 3) — the other order is silently undone by this function.
   */
  handleProviderChange: (providerId: string) => void
}

/**
 * Own the chat composer's provider/model selection.
 *
 * Reads `GET /settings/providers` ONCE per mount (empty deps — a re-render must not
 * re-issue it), exactly as `ChatArea.tsx` did.
 */
export function useComposerModel(): ComposerModelState {
  const [providers, setProviders] = useState<ComposerProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string>("")
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [deprecatedModels, setDeprecatedModels] = useState<Set<string>>(new Set())
  const [disabledModels, setDisabledModels] = useState<Set<string>>(new Set())

  useEffect(() => {
    getProviders()
      .then(({ active, active_model, providers: list, deprecated_models, disabled_models }) => {
        setProviders(list)
        // Defensive: absent → empty set → no badge (older backend / read blip).
        setDeprecatedModels(new Set(deprecated_models ?? []))
        // Same defensive shape for the disabled set: an older backend omits the key, and
        // an empty set degrades to "refuse nothing", which is the shipped behaviour.
        setDisabledModels(new Set(disabled_models ?? []))
        const activeProvider = list.find((p) => p.id === active) ?? list[0]
        if (activeProvider) {
          setSelectedProvider(activeProvider.id)
          setModels(activeProvider.models)
          const preferred = active_model && activeProvider.models.includes(active_model)
            ? active_model
            : (activeProvider.models[0] ?? "")
          setSelectedModel(preferred)
        }
      })
      .catch(console.error)
  }, [])

  // Update model list when provider changes
  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId)
    const p = providers.find((x) => x.id === providerId)
    if (p) {
      setModels(p.models)
      setSelectedModel(p.models[0] ?? "")
    }
  }

  return {
    providers,
    selectedProvider,
    models,
    selectedModel,
    setSelectedModel,
    deprecatedModels,
    disabledModels,
    handleProviderChange,
  }
}
