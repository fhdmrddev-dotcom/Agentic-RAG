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
 * ── WHERE THE MODEL COMES FROM, AND WHY THERE IS NO NEW STORAGE ─────────────────────
 *
 * ⚠ `public.messages` HAS NO `model` COLUMN. The model lives on `public.runs.model` and is
 * JOIN-stamped onto assistant messages as `MessageResponse.model` (Phase 095.1-03). So the
 * thread already carries its own answer and D-18 needs no schema change, no migration and
 * no per-thread persistence — option (b) of the bug report was considered and declined for
 * exactly that reason.
 *
 * Two consequences follow directly from that plumbing, and both are cases in the suite:
 *
 *   • USER-ROLE MESSAGES HAVE NO RUN ROW, so their `model` is `undefined`. The derivation
 *     walks BACKWARDS past them rather than reading the last element.
 *   • THE LITERAL `"unknown"` IS A REAL STORED VALUE — 121 live `runs` rows carry it. It is
 *     an absence wearing a string, and restoring it would put a model id in the composer
 *     that no provider offers.
 *
 * ── ⚠ THE BLIND SPOT, NAMED RATHER THAN LEFT TO BE REDISCOVERED ─────────────────────
 *
 * A thread whose last message PREDATES run-backed attribution has no model to restore, and
 * the chain hands it the global default. **THAT IS A SUCCESS, NOT A FAILURE.** The restore
 * is best-effort BY DESIGN. This is written down because the obvious "fix" — persisting the
 * selection per thread — is precisely the storage D-18 declined to add, and a future reader
 * who finds an old thread showing the default should not spend a phase re-litigating it.
 * The bug report's own re-open trigger names this case as the known cost of the approach.
 *
 * ── THE SEED ENDS WHEN THE USER SPEAKS ──────────────────────────────────────────────
 *
 * The restore fires at most ONCE per thread, and any deliberate model or provider choice
 * closes the window for that thread immediately. Without that, a thread with nothing to
 * restore from would have the operator's fresh pick overwritten the moment the assistant's
 * reply landed carrying a different model — reintroducing the same class of defect
 * (a control that changes under you) that this whole plan exists to remove.
 */
import { useCallback, useEffect, useRef, useState } from "react"

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
 * The minimum a message must expose for the derivation to read it. Structural on purpose —
 * `Message` satisfies it, and so does a plain object in a test, so the pure functions below
 * can be exercised without constructing the whole chat type.
 */
export interface ComposerRestoreMessage {
  /** The run's resolved model, JOIN-stamped from `runs.model`. Absent on user-role rows. */
  model?: string
  /** The run's resolved provider, from `runs.provider`. */
  provider?: string
}

/** A resolved restore: both halves, because applying one without the other is the bug. */
export interface ComposerRestoreTarget {
  provider: string
  model: string
}

/**
 * ⚠ A REAL STORED VALUE, NOT A SENTINEL WE INVENTED. 121 live `runs` rows read exactly this,
 * so it must be COMPARED AGAINST rather than merely mentioned: it is an absence wearing a
 * string, and no provider offers a model by this name.
 */
const UNKNOWN_MODEL = "unknown"

/**
 * The three honest readings of the providers payload. Exported as a NAMED union member set
 * so a consumer can narrow it.
 */
export type ComposerModelStatus =
  /** Asked, still waiting. */
  | "loading"
  /** The server answered. */
  | "ready"
  /** We could not read it — a 401, a 500 and an offline machine are indistinguishable. */
  | "failed"

/**
 * The hook's return, as an EXPORTED NAMED type rather than an inline object type — the
 * `useFollowScroll` habit, so a consumer can narrow it in its own signature instead of
 * restating a structural literal that then drifts.
 */
export interface ComposerModelState {
  /**
   * ⚠ A FAILED READ RESOLVES TO A DISTINCT READING, NEVER TO AN EMPTY SUCCESS. An empty
   * `models` array from a failed fetch is otherwise indistinguishable from a correctly
   * rendered composer for a provider that offers nothing — a calm control that has silently
   * removed every model a person could choose. `failed` is what makes the two tellable
   * apart. Same rule `useTemplatePlaceholders` and `useModelRegistry` both keep.
   */
  status: ComposerModelStatus
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
   * Phase 249 (MODEL-05): the ids the platform considers REGISTERED — built-in capability rows
   * PLUS operator-entered override rows. A model ABSENT from this set resolves
   * `capability_source="inferred"` at run time and silently takes safe defaults; the composer
   * marks it so the person choosing finds out BEFORE the run instead of after it.
   *
   * ⚠ Not the same question as `deprecatedModels` (informational sunset) or `disabledModels`
   * (operator hid it). Three sets, three jobs — do not collapse them.
   */
  verifiedModels: Set<string>
  /** Phase 249: per-unverified-model inferred provider, computed SERVER-side. ⛔ The client
   *  never mirrors the inference table (RESEARCH §6 Approach b — zero-drift). */
  inferredProviderFor: Record<string, string>
  /**
   * ⭐ Phase 249: the unverified ids whose inferred provider does NOT support native tool
   * calling. These run in structured mode with the `tools` param unsent — every tool is
   * unavailable and any tool call arrives as unreadable prose. This set is what lets the chip
   * say the CONSEQUENCE rather than just the word "unverified".
   */
  toolsLostModels: Set<string>
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
 * The thread's last-used model: the LAST message in thread order whose `model` is truthy
 * AND is not the literal `"unknown"`.
 *
 * Walking backwards is load-bearing, not stylistic — `undefined` (user-role rows) and
 * `"unknown"` (real stored `runs` values) are interleaved through a real thread, so reading
 * the last element answers `null` for most threads that do have an answer.
 */
export function deriveLastUsedModel(
  messages: readonly ComposerRestoreMessage[],
): { model: string; provider?: string } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const { model, provider } = messages[i]
    if (!model) continue
    if (model === UNKNOWN_MODEL) continue
    return { model, provider }
  }
  return null
}

/**
 * The restore rung: is the thread's last-used model something the composer may actually
 * select right now? Answers `null` — fall through to the next rung — when it is not.
 *
 * Two refusals, and they are different rules with different owners:
 *
 *   • DISABLED (D-07). The id is in the operator's disabled set, which arrives as its own
 *     wire field precisely so this check applies the registry's rule BY NAME rather than
 *     inferring it. ⚠ These are `_registry_row` semantics — a row PRESENT with `enabled`
 *     false, never the per-user allow-set notion the preferences path uses. (That other
 *     identifier is deliberately not spelled here, so a grep for it over this file stays
 *     discriminating and reads 0.)
 *   • NOT OFFERED. No configured provider lists the id, so the picker has no option to
 *     match it and the composer would render a selection nothing can display.
 */
export function resolveRestoreTarget(args: {
  messages: readonly ComposerRestoreMessage[]
  providers: readonly ComposerProvider[]
  disabledModels: ReadonlySet<string>
}): ComposerRestoreTarget | null {
  const derived = deriveLastUsedModel(args.messages)
  if (!derived) return null
  if (args.disabledModels.has(derived.model)) return null

  // Prefer the provider the run actually used; fall back to whoever offers the id, so a
  // legacy message that carries a model but no provider is still restorable.
  const stated = derived.provider
    ? args.providers.find((p) => p.id === derived.provider)
    : undefined
  const owner = stated?.models.includes(derived.model)
    ? stated
    : args.providers.find((p) => p.models.includes(derived.model))

  if (!owner) return null
  return { provider: owner.id, model: derived.model }
}

/**
 * Apply a resolved restore — PROVIDER FIRST, MODEL SECOND.
 *
 * ⚠ THE ORDER IS THE WHOLE FUNCTION. `handleProviderChange` resets the model to that
 * provider's first, so applying the model before the provider is silently undone: the bug
 * then LOOKS fixed on mount and is broken after any provider interaction, which is the
 * hardest possible shape to notice.
 *
 * It exists as a separate exported function rather than two inline calls so the sequence is
 * OBSERVABLE to a test. React batches the two setState calls, so an end-state assertion
 * would pass equally well against a reversed implementation.
 */
export function applyRestoreInOrder(
  target: ComposerRestoreTarget,
  apply: { setProvider: (providerId: string) => void; setModel: (model: string) => void },
): void {
  apply.setProvider(target.provider)
  apply.setModel(target.model)
}

/** Stable empty default so an omitted `messages` argument does not re-key the effect. */
const NO_MESSAGES: readonly ComposerRestoreMessage[] = []

/**
 * Own the chat composer's provider/model selection, including the per-thread restore.
 *
 * Reads `GET /settings/providers` ONCE per mount (empty deps — a re-render must not
 * re-issue it), exactly as `ChatArea.tsx` did.
 *
 * @param threadId the thread being viewed; `null` on the welcome surface. The restore is
 *   keyed by it, so switching threads restores again rather than once per mount.
 * @param messages that thread's messages, already held by `useMessages` and already
 *   consumed by `ChatArea` — read here, never fetched.
 */
export function useComposerModel(
  threadId: string | null = null,
  messages: readonly ComposerRestoreMessage[] = NO_MESSAGES,
): ComposerModelState {
  const [providers, setProviders] = useState<ComposerProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string>("")
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [deprecatedModels, setDeprecatedModels] = useState<Set<string>>(new Set())
  const [disabledModels, setDisabledModels] = useState<Set<string>>(new Set())
  // Phase 249 (MODEL-05) — the pick-time warning's three inputs. Same effect below, no new
  // fetch: they ride the ONE `getProviders()` read this hook already performs.
  const [verifiedModels, setVerifiedModels] = useState<Set<string>>(new Set())
  const [inferredProviderFor, setInferredProviderFor] = useState<Record<string, string>>({})
  const [toolsLostModels, setToolsLostModels] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<ComposerModelStatus>("loading")

  /**
   * The thread ids whose seeding window is CLOSED — either because the restore already
   * fired, or because the operator made a deliberate choice. A ref, not state: closing the
   * window must not itself cause a render, and the effect below reads it in the same tick
   * it writes it.
   */
  const settledThreadsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    getProviders()
      .then(({
        active, active_model, providers: list, deprecated_models, disabled_models,
        verified_models, inferred_provider_for, inferred_tools_lost,
      }) => {
        setProviders(list)
        // Defensive: absent → empty set → no badge (older backend / read blip).
        setDeprecatedModels(new Set(deprecated_models ?? []))
        // Same defensive shape for the disabled set: an older backend omits the key, and
        // an empty set degrades to "refuse nothing", which is the shipped behaviour.
        setDisabledModels(new Set(disabled_models ?? []))
        // ⚠ THE DEFENSIVE DEFAULTS ARE NOT CEREMONY, and the two directions differ:
        //   • absent `verified_models` → EMPTY set would mark EVERY model unverified, so an
        //     older backend must degrade to "verified" — the chip's own render guard reads
        //     `verifiedModels.size > 0` for exactly this reason.
        //   • absent `inferred_tools_lost` → empty set means "claim nothing about tools", which
        //     is the honest default: never assert a consequence we were not told about.
        setVerifiedModels(new Set(verified_models ?? []))
        setInferredProviderFor(inferred_provider_for ?? {})
        setToolsLostModels(new Set(inferred_tools_lost ?? []))
        const activeProvider = list.find((p) => p.id === active) ?? list[0]
        if (activeProvider) {
          setSelectedProvider(activeProvider.id)
          setModels(activeProvider.models)
          const preferred = active_model && activeProvider.models.includes(active_model)
            ? active_model
            : (activeProvider.models[0] ?? "")
          setSelectedModel(preferred)
        }
        setStatus("ready")
      })
      .catch((err) => {
        console.error(err)
        // ⚠ NOT a silent empty list. See `status` on the return type — an empty composer
        // that failed to load and one that legitimately offers nothing must be tellable
        // apart, and this is the only thing that tells them apart.
        setStatus("failed")
      })
  }, [])

  /** Close a thread's seeding window. Idempotent; safe to call on every interaction. */
  const settle = useCallback((id: string | null) => {
    if (id) settledThreadsRef.current.add(id)
  }, [])

  // ── the restore rung ────────────────────────────────────────────────────────
  // Runs when the thread, its messages or the registry sets change. It applies AT MOST ONCE
  // per thread, and only once the providers read has answered — restoring before `providers`
  // is populated could not resolve an owner and would burn the thread's one attempt.
  useEffect(() => {
    if (status !== "ready") return
    if (!threadId) return
    if (settledThreadsRef.current.has(threadId)) return

    const target = resolveRestoreTarget({ messages, providers, disabledModels })
    // No answer YET is not the same as no answer EVER: messages arrive asynchronously, so
    // leave the window OPEN and re-evaluate when they land. What closes it without a
    // restore is a deliberate user choice (see `settle` on the two setters below).
    if (!target) return

    settledThreadsRef.current.add(threadId)
    applyRestoreInOrder(target, {
      setProvider: (providerId) => {
        setSelectedProvider(providerId)
        const p = providers.find((x) => x.id === providerId)
        if (p) setModels(p.models)
      },
      setModel: setSelectedModel,
    })
  }, [status, threadId, messages, providers, disabledModels])

  /**
   * The picker's `onModelChange`. Wrapped so a deliberate pick CLOSES this thread's seeding
   * window — otherwise the next assistant message to land would restore over the top of it.
   */
  const chooseModel = useCallback((model: string) => {
    settle(threadId)
    setSelectedModel(model)
  }, [settle, threadId])

  // Update model list when provider changes
  const handleProviderChange = (providerId: string) => {
    settle(threadId)
    setSelectedProvider(providerId)
    const p = providers.find((x) => x.id === providerId)
    if (p) {
      setModels(p.models)
      setSelectedModel(p.models[0] ?? "")
    }
  }

  return {
    status,
    providers,
    selectedProvider,
    models,
    selectedModel,
    setSelectedModel: chooseModel,
    deprecatedModels,
    disabledModels,
    verifiedModels,
    inferredProviderFor,
    toolsLostModels,
    handleProviderChange,
  }
}
