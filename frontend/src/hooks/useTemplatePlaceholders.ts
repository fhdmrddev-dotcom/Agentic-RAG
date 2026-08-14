/**
 * Quick task 260814-q5r — useTemplatePlaceholders.
 *
 * THE ONLY CALLER OF `GET /workflows/{id}/template/placeholders`. An author who binds a
 * .docx to a step sees its filename today and nothing else, so what the document will
 * actually ask the step to fill in is discovered at run time or never.
 *
 * Modelled on `useGroundingBundle.ts` — same module shape, same discipline: the two
 * waiting readings are DERIVED and frozen at module scope (the
 * `react-hooks/set-state-in-effect` shape that hook documents), the abort predicate is a
 * module-local copy, and a failed read resolves to a distinct union member rather than
 * to an empty success. Three differences from it are deliberate and each is a decision:
 *
 * 1. **A LEAF HOOK, NOT A PARAMETER ON `useGroundingBundle`.** That hook is the shared
 *    palette read keyed on `enabled` alone; an `assetId` parameter would change the effect
 *    key for every consumer of the palette. Its `ready` member types `degraded` as the
 *    empty tuple precisely so "a partial palette presented as complete" is unconstructable
 *    — a template-read failure is a DIFFERENT honesty axis and would have to be smuggled
 *    onto that union. The precedent is recorded in `TemplateAttachSection.tsx`'s own
 *    docblock: a leaf that consults the server itself rather than growing three props on
 *    its parent.
 *
 * 2. **⚠ THE ANSWER IS STORED TOGETHER WITH THE `assetId` IT ANSWERED FOR, and `loading`
 *    is derived when the stored id differs from the current one. This is the one place
 *    this hook must NOT copy its sibling.** `useGroundingBundle` deliberately keeps a
 *    previous palette across a transient disable, because a stale palette is still true.
 *    A stale FIELD LIST is a lie about a DIFFERENT DOCUMENT: after a Replace, the
 *    `definitionId` is unchanged, and showing the old template's fields under the new
 *    template's filename is precisely the defect this feature exists to prevent. Same
 *    reasoning, opposite behaviour.
 *
 * 3. **`GroundingBundle.degraded` is ignored entirely.** It is not on this response, and
 *    branching on a folder/skill registry blip to report "we could not read your template"
 *    would be a new lie rather than an inherited caution.
 *
 * A 401, a 404, a flipped visibility flag and an offline machine are indistinguishable to
 * the client and all mean the same thing — no answer. `useGroundingBundle`'s docblock
 * already establishes this; it is inherited here, not re-argued.
 */
import { useEffect, useState } from "react"

import { getWorkflowTemplatePlaceholders } from "@/lib/api"

/**
 * The five honest readings of a bound template's fields.
 *
 * `fields` carries a NON-EMPTY list BY CONTRACT — an empty read resolves to `none`, never
 * to `fields` with `[]`. "A template with no fields presented as a template with fields"
 * is therefore not a state a caller can construct: the fail-closed-by-shape idiom the
 * sibling hook uses for `degraded`.
 *
 * `none` and `unavailable` are separate members for the reason the whole task exists:
 * "we read it and found nothing" and "we never read it" are different facts, and an author
 * who is shown the first when the second is true ships a workflow that fills nothing.
 */
export type TemplatePlaceholdersState =
  /** No template bound, or no definition yet — zero requests have been issued. */
  | { kind: "idle" }
  /** Asked, still waiting — including while a REPLACED template's answer is outstanding. */
  | { kind: "loading" }
  /** The server read the document and it asks for these, in the server's order. */
  | { kind: "fields"; fields: string[] }
  /** The server read the document and it carries no fill-in fields. */
  | { kind: "none" }
  /**
   * We could not read it. `reason` separates a 200 that admitted the read failed
   * (`"unreadable"`) from no usable answer at all (`"unreachable"`). Both mean the same
   * thing to a person and are kept apart only so a future surface may distinguish them.
   */
  | { kind: "unavailable"; reason: "unreadable" | "unreachable" }

/**
 * The two readings the server has not authored. Frozen at module scope so a caller may
 * compare the returned state by identity across renders — they carry no data to vary.
 */
const IDLE: TemplatePlaceholdersState = { kind: "idle" }
const LOADING: TemplatePlaceholdersState = { kind: "loading" }

/** The server's answer, PLUS the asset id it answered for — see difference 2 above. */
type Answer = {
  assetId: string
  state: Extract<
    TemplatePlaceholdersState,
    { kind: "fields" } | { kind: "none" } | { kind: "unavailable" }
  >
}

/** The shipped `usePanelReconcile.ts:84-92` double-shaped check — an abort is not a failure. */
function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true
  if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError")
    return true
  return false
}

/**
 * Read a bound template's fields once per `[definitionId, assetId]`.
 *
 * @param definitionId The workflow being authored, or `null` when there is not one yet.
 * @param assetId      The BOUND descriptor's `asset_id`, resolved by the caller off
 *                     `definition.assets[]` — the same place its filename comes from, so
 *                     the two can never disagree. `undefined` when no template is attached.
 */
export function useTemplatePlaceholders(
  definitionId: string | null,
  assetId: string | undefined,
): TemplatePlaceholdersState {
  const [answer, setAnswer] = useState<Answer | null>(null)

  const wanted = Boolean(definitionId) && Boolean(assetId)

  useEffect(() => {
    if (!definitionId || !assetId) return

    const controller = new AbortController()

    getWorkflowTemplatePlaceholders(definitionId, assetId, controller.signal)
      .then((res) => {
        // Post-await guard, the `usePanelReconcile.ts:70-75` shape. This effect fires once
        // per [definitionId, assetId] and has no ordering problem to solve, so the signal
        // IS the whole staleness question here.
        if (controller.signal.aborted) return
        // ⚠ COMPARE POSITIVELY. `read !== "unreadable"` would wave through `undefined` —
        // which is exactly what an older server, or a shape change, sends. TypeScript
        // types the field as a two-value union and will NOT protect you at runtime.
        if (res.read !== "ok") {
          setAnswer({ assetId, state: { kind: "unavailable", reason: "unreadable" } })
          return
        }
        const fields = res.placeholders ?? []
        setAnswer(
          fields.length > 0
            ? { assetId, state: { kind: "fields", fields } }
            : { assetId, state: { kind: "none" } },
        )
      })
      .catch((err: unknown) => {
        // An abort caused by unmount or by a changed asset id is silent by design.
        if (isAbortError(err)) return
        if (controller.signal.aborted) return
        setAnswer({ assetId, state: { kind: "unavailable", reason: "unreachable" } })
      })

    return () => controller.abort()
    // `assetId` is in the key as the CHANGE DETECTOR: after a Replace the `definitionId`
    // is unchanged, and the previous template's answer must not survive.
  }, [definitionId, assetId])

  // The waiting readings are derived, never stored. An answer about a DIFFERENT asset id
  // reads as `loading`, not as its own stale self — difference 2 in the module docblock.
  if (!wanted) return IDLE
  if (!answer || answer.assetId !== assetId) return LOADING
  return answer.state
}
