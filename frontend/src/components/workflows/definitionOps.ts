/**
 * Phase 184 Wave 0 (CANVAS-02, D-184-05) — definitionOps.
 *
 * THE ONE MUTATION HOME for `WorkflowDefinition.phases`. Both authoring doors — the
 * shipped read-only `≣ Spine` and the flagged canvas — route every structural and
 * config edit through this module, so "the two views disagree about what an edit
 * means" is not a representable state. Every op has the same shape:
 * `(phases, …args) => PhaseSpecJSON[]`.
 *
 * PURITY CONTRACT. Zero React, zero store, zero canvas import, and it imports NOTHING
 * from the API client — a definition edit is COMPUTED, never round-tripped. It reads
 * no DOM, no clock and no randomness. `definitionOps.test.ts` keeps that honest with a
 * `?raw` source grep in the shipped `canvasModel.purity.test.ts` idiom, so a network
 * call reappearing here fails a test rather than a review.
 *
 * WHY IT MAY NOT VALIDATE. The two cheap refusals below are SHAPE predicates decidable
 * from `phases[]` alone. They never consult the server's validation seam, and they never
 * produce a severity or a code. D-182-06's red line stands: there is exactly one lint
 * implementation and it lives on the server; a refusal here is "this edit is not
 * expressible", never "this workflow is invalid".
 *
 * TOTALITY CONTRACT (the `phaseVocabulary.ts:36-40` form). Every exported resolver is
 * total. An unknown `phase_type`, an unknown slug, a missing `validators` array, a
 * malformed `on_failure`, an out-of-range index, a non-finite index and an empty
 * `phases` array all resolve honestly and NEVER throw — the definition JSONB is
 * author-supplied and a mutation helper must not crash on it.
 *
 * STATE OF THE EXTRACTION — read this literally; it is not a claim about the future.
 * 184-CONTEXT's anti-drift note 3 says an in-code claim of a prior extraction is exactly
 * the hazard `soulData.ts` once tripped, so this paragraph was written AFTER grepping
 * the page, not from a plan sentence:
 *
 *   - `patchPhaseConfig` is the immutable config merge `WorkflowBuilderPage.tsx` still
 *     declares inline at `:334-345` (`onPhaseChange`). The merge expression here is
 *     that one, character for character. **The page is NOT yet repointed** — plan
 *     184-04 does that — so two copies exist on purpose right now, and the suite in
 *     `definitionOps.test.ts` is what pins the semantics until they collapse.
 *   - The other five ops are NET-NEW. Grepped this session: the page declares no add /
 *     insert / move / remove / renumber of any kind (the shipped canvas is read-only),
 *     so nothing structural was "lifted". Saying otherwise would be the comment that
 *     lies which D-ITEM-183-02 forbids.
 *
 * Mirror of the backend shapes:
 *  - `PhaseSpec` / `PhaseConfig` discriminated union: `backend/app/models/harness.py:52-193`.
 *  - The 6-member closed `phase_type` set is that union's discriminator, and
 *    `WorkflowDefinition` is `extra="forbid"` — which is why `minimalPhaseFor` emits
 *    only the keys its union member REQUIRES.
 */
import { type PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"

// ── Internal ordering primitives (both pure, both non-mutating) ─────────────────

/**
 * Resolve RENDER order. The comparator is character-for-character the shipped one at
 * `canvasModel.ts:220-223` — that agreement is load-bearing: a position this module
 * computes and a column the projection draws must name the same step, and a duplicate
 * `phase_index` must break the tie the same way in both places.
 */
function orderPhases(phases: readonly PhaseSpecJSON[]): PhaseSpecJSON[] {
  // Total, order-independent ordering: phase_index first, slug as the tiebreak.
  const ordered = [...phases].sort(
    (a, b) => a.phase_index - b.phase_index || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  )
  return ordered
}

/**
 * Rewrite `phase_index` to each member's 0-based POSITION in the array as given.
 *
 * The structural ops resolve render order FIRST, then edit positionally, then call
 * this — they deliberately do not call `renumber` on the spliced array. `renumber`
 * re-sorts by the (now stale) indices, which would drag an inserted step back to
 * wherever its incoming `phase_index` happened to point and silently undo the edit.
 */
function assignIndices(ordered: readonly PhaseSpecJSON[]): PhaseSpecJSON[] {
  return ordered.map((phase, position) => ({ ...phase, phase_index: position }))
}

/** Clamp a caller-supplied render position into `[0, max]`. Total: NaN/±Infinity → 0. */
function clampPosition(index: number, max: number): number {
  if (!Number.isFinite(index)) return 0
  const whole = Math.trunc(index)
  if (whole < 0) return 0
  return whole > max ? max : whole
}

// ── The six structural ops ─────────────────────────────────────────────────────

/**
 * Sort into render order and rewrite `phase_index` to `[0..n-1]`.
 *
 * This is the ONLY function in Phase 184 that renumbers. `canvasModel.fromCanvas`
 * (plan 184-05) deliberately does not — it must hand back what it was given, gaps
 * included, or the `indexGap` fixture's round-trip identity breaks.
 */
export function renumber(phases: readonly PhaseSpecJSON[]): PhaseSpecJSON[] {
  return assignIndices(orderPhases(phases))
}

/** Append `spec` after the last step and renumber. */
export function addPhase(
  phases: readonly PhaseSpecJSON[],
  spec: PhaseSpecJSON,
): PhaseSpecJSON[] {
  return assignIndices([...orderPhases(phases), spec])
}

/**
 * Insert `spec` at render position `index` (clamped to `[0, n]`) and renumber.
 *
 * `spec.phase_index` is IGNORED — the caller's `index` is the intent, and every
 * downstream step shifts by exactly one. That is R1's named property.
 */
export function insertPhaseAt(
  phases: readonly PhaseSpecJSON[],
  index: number,
  spec: PhaseSpecJSON,
): PhaseSpecJSON[] {
  const ordered = orderPhases(phases)
  const at = clampPosition(index, ordered.length)
  return assignIndices([...ordered.slice(0, at), spec, ...ordered.slice(at)])
}

/**
 * Move the phase carrying `slug` to render position `toIndex` (clamped to
 * `[0, n-1]`) and renumber. An unknown slug returns the input unchanged (TOTALITY).
 */
export function movePhase(
  phases: readonly PhaseSpecJSON[],
  slug: string,
  toIndex: number,
): PhaseSpecJSON[] {
  const ordered = orderPhases(phases)
  const from = ordered.findIndex((phase) => phase.slug === slug)
  if (from === -1) return [...phases]

  const moved = ordered[from]
  const without = [...ordered.slice(0, from), ...ordered.slice(from + 1)]
  const to = clampPosition(toIndex, without.length)
  return assignIndices([...without.slice(0, to), moved, ...without.slice(to)])
}

/**
 * Drop the phase carrying `slug` and renumber, so the spine self-heals to `[0..n-1]`.
 * An unknown slug returns the input unchanged (TOTALITY). A duplicate slug — legal in
 * the JSONB, `PhaseSpec.slug` is an unconstrained `str` — removes every match, because
 * the canvas addresses a node BY slug and leaving one behind would be a ghost.
 */
export function removePhase(
  phases: readonly PhaseSpecJSON[],
  slug: string,
): PhaseSpecJSON[] {
  const ordered = orderPhases(phases)
  if (!ordered.some((phase) => phase.slug === slug)) return [...phases]
  return assignIndices(ordered.filter((phase) => phase.slug !== slug))
}

/**
 * Merge a phase-form patch into one phase's config, immutably.
 *
 * Deliberately does NOT renumber and does NOT reorder: a config edit cannot change run
 * order, and re-sorting here would make a keystroke in the inspector move a card.
 *
 * The patch type is structurally `PhaseFormPanel.tsx:48`'s `PhaseConfigPatch`
 * (`Record<string, unknown>`). It is spelled inline rather than imported so this pure
 * module stays free of any component import; the two are mutually assignable, so the
 * 184-04 repoint needs no adapter.
 */
export function patchPhaseConfig(
  phases: readonly PhaseSpecJSON[],
  slug: string,
  patch: Readonly<Record<string, unknown>>,
): PhaseSpecJSON[] {
  return phases.map((p) =>
    p.slug === slug ? { ...p, config: { ...p.config, ...patch } } : p,
  )
}
