/**
 * Phase 196 Plan 05 Task 3 (AUTH-04 / D-06) — useModelRegistry.
 *
 * THE ONLY CALLER OF `GET /models/registry` ON THE AUTHORING SURFACE. It reads the live
 * registry union — the six-field author projection plan 196-04 shipped — plus the model a
 * run would ACTUALLY inherit, resolved server-side.
 *
 * ── THE THREE READINGS, AS BULLETS BEFORE ANY CODE ──────────────────────────────────
 *
 *   • `loading`     — asked, still waiting. Zero answers so far.
 *   • `ready`       — the server answered. Carries `models` (possibly empty, if the
 *                     registry genuinely holds nothing) and `runDefaultModel`, which is
 *                     `null` when the server's own chain resolved nothing.
 *   • `unavailable` — we could not read it. A 401, a 500, a flipped flag and an offline
 *                     machine are indistinguishable to a client and all mean the same
 *                     thing: no answer.
 *
 * ⚠ **A FAILED READ RESOLVES TO A DISTINCT MEMBER, NEVER TO AN EMPTY SUCCESS.** This is
 * the sibling rule `useTemplatePlaceholders` and `useGroundingBundle` both keep, and it
 * matters more here than in either: an empty `models` array handed back from a FAILED
 * fetch is indistinguishable from a genuinely empty registry, and the picker consuming it
 * would then offer nothing but its inherit option — which renders as a perfectly correct,
 * perfectly calm control that has silently removed every model a person could choose.
 * `unavailable` carries no `models` field at all, so "a failed read presented as an empty
 * registry" is not a state a caller can construct. The compiler is the guard, not a
 * convention.
 *
 * ── WHY THE FETCH LIVES HERE AND NOT IN THE COMPONENT ───────────────────────────────
 *
 * `ModelField` mounts FOUR times inside one phase form — once per step type that carries a
 * model. A component that fetched its own rows would issue four identical requests every
 * time somebody clicked a step, and each mount would hold its own copy of an answer that
 * is identical across all four. The registry payload is a PANEL-LEVEL concern, so it is
 * read once by an owner above the panel and passed down as a prop.
 *
 * That siting is also what makes the panel's own source fence satisfiable: the panel body
 * gains no effect and no derivation from this feature — it gains a hook call and a prop.
 *
 * ── SIZE (Open Q3) ──────────────────────────────────────────────────────────────────
 *
 * No pagination, deliberately. The union measured 69 rows on 2026-08-18 (a reading, not a
 * constant — it moves the moment an operator adds a row), which is a single small response
 * and a single `<select>` a person can scroll. Revisit at roughly 500 rows, where the
 * option list stops being scannable and the answer is a filter box rather than a page
 * cursor.
 */
import { useEffect, useState } from "react"

import { getAuthorModelRegistry, type AuthorModelRow } from "@/lib/api"

/** The three honest readings of the live registry. Exported as a NAMED type rather than
 *  inlined on the hook's return, so a consumer can narrow it in its own signature. */
export type ModelRegistryState =
  /** Asked, still waiting — zero answers so far. */
  | { kind: "loading" }
  /** The server answered. `models` may be empty if the registry genuinely holds nothing;
   *  `runDefaultModel` is `null` when the server's own chain resolved nothing. */
  | { kind: "ready"; models: AuthorModelRow[]; runDefaultModel: string | null }
  /**
   * We could not read it. ⚠ It carries NO `models` field — see the module docblock: that
   * omission is what makes "a failed read presented as an empty registry" unconstructable.
   */
  | { kind: "unavailable" }

/** The waiting reading, frozen at module scope so a caller may compare by identity across
 *  renders — it carries no data to vary. */
const LOADING: ModelRegistryState = { kind: "loading" }

/** Likewise the failure reading: one value, compared by identity, never rebuilt. */
const UNAVAILABLE: ModelRegistryState = { kind: "unavailable" }

/**
 * Read the author-visible model registry ONCE per mount.
 *
 * There are no parameters, and that is a decision rather than an omission: the registry is
 * not scoped to a workflow, a step or a user preference, so a parameter would be an effect
 * key that can change and therefore a second request nobody asked for.
 */
export function useModelRegistry(): ModelRegistryState {
  const [state, setState] = useState<ModelRegistryState>(LOADING)

  useEffect(() => {
    // ⚠ A CANCELLATION FLAG, NOT AN `AbortController`. `getAuthorModelRegistry` takes no
    // signal (unlike `getWorkflowTemplatePlaceholders`), so there is no request to abort —
    // what this guard prevents is a state update after unmount, which is the whole reason
    // the sibling hooks carry their post-await checks. Stated rather than left to look like
    // a weaker copy of the shipped abort discipline.
    let cancelled = false

    getAuthorModelRegistry()
      .then((res) => {
        if (cancelled) return
        setState({ kind: "ready", models: res.models, runDefaultModel: res.run_default_model })
      })
      .catch(() => {
        if (cancelled) return
        // ⚠ NOT `{ kind: "ready", models: [] }`. See the module docblock — that substitution
        // is the single defect this reading exists to make impossible.
        setState(UNAVAILABLE)
      })

    return () => {
      cancelled = true
    }
    // Empty deps: one read per mount. A re-render must not re-issue it.
  }, [])

  return state
}
