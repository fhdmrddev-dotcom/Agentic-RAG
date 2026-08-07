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
 * Mirror of the backend shapes — pointers RE-DERIVED by symbol at Phase 189 (see the
 * `PhaseTypeId` block below for why they had to be):
 *  - `PhaseSpec`: `backend/app/models/harness.py:328`.
 *  - `PhaseConfig` discriminated union: `backend/app/models/harness.py:288-299`.
 *  - The closed `phase_type` set is that union's discriminator, and `WorkflowDefinition`
 *    is `extra="forbid"` — which is why `minimalPhaseFor` emits only the keys its union
 *    member REQUIRES. The member COUNT is deliberately not restated here: it has grown
 *    twice (5 → 6 at 101.1, 6 → 7 at 189) and a count in prose rots on every additive
 *    growth, while the rule does not.
 */
import {
  nodeTitle,
  parseSkipTarget,
  type GroundingCause,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"

// ── The closed phase-type set ──────────────────────────────────────────────────

/**
 * The 7 members of the backend's `PhaseConfig` discriminated union
 * (`harness.py:288-299`). CLOSED: a slug and a minimal phase are only ever derived
 * from this set, never from user text.
 *
 * ⚠ THIS IS A MIRROR. The client MIRRORS the server's closed set and never defines it —
 * the union in `harness.py` is the contract, this is a restatement of its discriminator
 * so the picker has something to iterate. Two consequences, both deliberate:
 *
 *  - A member added here that the server does not carry is a definition the server will
 *    422. That drift is not left to review: `definitionOps.test.ts` reads
 *    `harness.py` itself through the same `?raw` loader `PublishGauntlet.test.tsx:46`
 *    uses for `publish_service.py`, and asserts this union's members are exactly the
 *    union's `phase_type` literals, IN ORDER. It was observed RED against a planted
 *    mismatch before it was trusted (Phase 189, D-23's mechanical-not-editorial rule).
 *  - The line pointer above is re-derived, not inherited. It read `harness.py:157-167`
 *    from Phase 184 until Phase 189 — stale twice over by then (the union had moved to
 *    `:162-172` before 189-07's insertions pushed it to `:288-299`). A pointer nothing
 *    typechecks is a claim, and this one had already rotted; the `?raw` fence is what
 *    makes the RELATIONSHIP machine-checked even when the LINE NUMBER rots again.
 *
 * The 7th member (`external_action`, Phase 189 / CONN-01 / D-01) is APPENDED LAST, the
 * same additive growth `llm_emit` arrived by at 101.1.
 */
export type PhaseTypeId =
  | "programmatic"
  | "llm_single"
  | "llm_agent"
  | "llm_batch_agents"
  | "llm_human_input"
  | "llm_emit"
  | "external_action"

/**
 * The FIXED presentation order of the step-type picker (D-184-11). It is a `readonly`
 * tuple, not a set, because "the picker's third option moved" is a UX regression a
 * test should catch.
 *
 * ⚠ IT IS `satisfies`, SO A SUBSET SATISFIES IT. Omitting a member compiles cleanly and
 * the picker simply never offers that type — the one silent site in this block, and the
 * reason Phase 189 appended here deliberately rather than waiting to be told. New members
 * are APPENDED, never inserted: a shipped option changing position is the regression this
 * tuple exists to catch, and `definitionOps.test.ts` asserts the shipped PREFIX, not just
 * the length.
 */
export const PHASE_TYPE_ORDER = [
  "programmatic",
  "llm_single",
  "llm_agent",
  "llm_batch_agents",
  "llm_human_input",
  "llm_emit",
  "external_action",
] as const satisfies readonly PhaseTypeId[]

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
 * D-187-07 — the config keys whose edit invalidates a GENERATOR-SEEDED name.
 *
 * JUSTIFIED, NOT ENUMERATED. The rule is: a config edit clears a generator-seeded name
 * precisely when it could change what the step's face says about that step. Written that
 * way the rule stays correct automatically as the face's inputs grow — a new member is
 * added here by asking "would the derived face, or what this step actually does, read
 * differently after this edit?", never by taste and never by copying a list.
 *
 * The current members and why each qualifies:
 *
 *   - `skill_ref`      — tier (1) of `derivedFace`. A bound skill IS the face.
 *   - `folder_scope`   — tier (3) of `derivedFace`. The single scoped folder names the step.
 *   - `available_tools`— not read by `derivedFace`, and included DELIBERATELY rather than
 *                        by oversight: it is what decides whether the step reads your
 *                        documents at all (`groundingCauseOf`'s `detected` branch), so a
 *                        seeded name written for a step that searched your files no longer
 *                        describes it once those tools are switched off.
 *
 * THE TEMPLATE ARM IS DEFINITION-LEVEL AND CURRENTLY DORMANT. `derivedFace` tier (2)
 * reads the definition's `assets[]` template filename, which is NOT a phase config key —
 * and measured this session, `frontend/src` contains zero `assets` references outside
 * docblocks, so no builder surface can edit it yet. The rule is implemented and tested at
 * the pure-function level; nobody should claim a user can trigger it today.
 *
 * `phase_type` is absent for the same reason, measured rather than assumed: it is the
 * union discriminator and `PhaseFormPanel` only ever READS it (`:719`) — the type is
 * chosen once, at add time, and the slug is derived from it.
 */
export const IDENTITY_BEARING_CONFIG_KEYS: ReadonlySet<string> = new Set<string>([
  "skill_ref",
  "folder_scope",
  "available_tools",
])

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
 *
 * ── Phase 187 (D-187-07) — THE DEMOTE, and why it lives here ──────────────────────
 *
 * This is the ONE config-edit home (`builderStore.ts:519` ← `WorkflowBuilderPage`'s
 * `onPhaseChange`), so the rule is stated once and cannot be reached around. It is
 * deliberately NOT added to `setPhaseGovernance` below, whose patch type admits only the
 * two governance booleans (T-185-06-02) — widening that into a general `PhaseSpec` writer
 * would be a typecheck error, which is the point.
 *
 * A stored name has no invalidation story of its own. Re-bind a step's skill and a
 * generator-written name still promises the old behaviour: the face lies. Clearing the
 * seeded name lets the face fall back to `derivedFace`, which tracks the config for free —
 * so no stale-name marker and no second corner on the card is needed.
 *
 * It clears BOTH `name` and `name_seeded_by_ai`. Clearing only the name would leave a
 * provenance marker describing a name that no longer exists.
 *
 * A HAND-TYPED name — `name` present with `name_seeded_by_ai` absent or `false` — is never
 * cleared by any config edit (SPEC Req 3). That asymmetry is the entire reason the marker
 * exists, and losing an author's writing to an unrelated edit would be data loss
 * (T-187-10-01).
 *
 * The keys are `delete`d rather than set to `undefined`: a phase that carried no name must
 * come back with no name KEY, not with an explicit `undefined` the round trip would
 * serialize (`extra="forbid"` on the backend union, and R2's round-trip identity).
 */
export function patchPhaseConfig(
  phases: readonly PhaseSpecJSON[],
  slug: string,
  patch: Readonly<Record<string, unknown>>,
): PhaseSpecJSON[] {
  // Read the trigger off the PATCH's keys, once, before the walk: the rule is a property
  // of the edit, not of the phase.
  const invalidatesTheFace = Object.keys(patch).some((key) =>
    IDENTITY_BEARING_CONFIG_KEYS.has(key),
  )

  return phases.map((p) => {
    if (p.slug !== slug) return p
    const next: PhaseSpecJSON = { ...p, config: { ...p.config, ...patch } }
    // Gated on a seeded name that actually EXISTS — a marker with nothing to describe is
    // not a state the server's stamp can produce, and clearing it would be a write with
    // no user-visible consequence.
    const seededName =
      next.name_seeded_by_ai === true && typeof next.name === "string" && next.name.trim() !== ""
    if (invalidatesTheFace && seededName) {
      delete next.name
      delete next.name_seeded_by_ai
    }
    return next
  })
}

/** The only two fields `setPhaseGovernance` may write (D-185-10). */
export type PhaseGovernancePatch = Readonly<{
  grounding_escalated?: boolean
  action_risk_armed?: boolean
}>

/**
 * Set one step's governance intent, immutably, at the **PhaseSpec level**.
 *
 * WHY THIS IS ITS OWN OP AND NOT A `patchPhaseConfig` CALL (D-185-10). These two fields
 * are siblings of `validators` and `name`, not members of the config union, and
 * `PhaseFormPanel`'s only write seam patches `config` — its own shipped docblock defines
 * `PhaseConfigPatch` that way. Widening that prop would silently change the meaning of a
 * shipped contract, so the write is CALLER-owned through this narrow op instead, exactly
 * as `PhaseGateRow.onRemove` already belongs to the caller for the same reason.
 *
 * The parameter type admits ONLY the two booleans, so growing this into a general
 * `PhaseSpec` writer is a typecheck error rather than a review comment (T-185-06-02).
 *
 * Like `patchPhaseConfig` it deliberately does NOT renumber and does NOT reorder — arming
 * a checkpoint or escalating grounding cannot change run order, and re-sorting here would
 * make a switch flick move a card. It returns a new array with a new object for the named
 * slug ONLY; every other phase stays identical by reference, which is what `fromCanvas`'s
 * carry-through invariant needs (`canvasModel.ts:358-369`).
 */
export function setPhaseGovernance(
  phases: readonly PhaseSpecJSON[],
  slug: string,
  patch: PhaseGovernancePatch,
): PhaseSpecJSON[] {
  return phases.map((p) => (p.slug === slug ? { ...p, ...patch } : p))
}

// ── R10a — the orphaning-delete refusal ────────────────────────────────────────

/**
 * The outcome of asking whether a step may be removed, in the discriminated-outcome
 * idiom of `api.ts:3286-3293`'s `PublishOutcome`. A bare boolean is FORBIDDEN: R10
 * says no refusal is silent, so the refusing branch physically carries the sentence
 * the surface renders.
 */
export type RemovalOutcome = { ok: true } | { ok: false; reason: string }

/**
 * R10a — may this step be removed?
 *
 * Grounded on the `skip_to_phase` graph, NOT on index arithmetic (RESEARCH assumption
 * A4). `removePhase` renumbers immediately, so index contiguity self-heals and a
 * "successor left without a predecessor" case cannot survive the delete. The genuine
 * orphan is a SURVIVING `validators[].on_failure` naming the slug being deleted — the
 * backend's `unsatisfiable_skip`. The parse is the shipped `parseSkipTarget`, imported
 * rather than re-declared: a second copy of it is exactly the G-5 drift
 * `canvasModel.purity.test.ts:116-118` forbids next door.
 *
 * A self-reference does not refuse: a step whose own fallback points at itself takes
 * that reference with it when it goes.
 *
 * This is a SHAPE predicate. It consults no server, produces no severity and no code.
 */
export function canRemovePhase(
  phases: readonly PhaseSpecJSON[],
  slug: string,
): RemovalOutcome {
  const referrers = orderPhases(phases).filter(
    (phase) =>
      phase.slug !== slug &&
      (phase.validators ?? []).some((v) => parseSkipTarget(v?.on_failure) === slug),
  )
  if (referrers.length === 0) return { ok: true }

  const lead = `"${nodeTitle(referrers[0])}"`
  const others = referrers.length - 1
  const subject =
    others === 0 ? `${lead} sends` : `${lead} and ${others} other step${others > 1 ? "s" : ""} send`
  return { ok: false, reason: `${subject} failures to this step. Remove that fallback first.` }
}

// ── R10b — the stranding-add refusal ───────────────────────────────────────────

/** One row of the step-type picker. `disabledReason` absent = the choice is offered. */
export interface TypeChoice {
  type: PhaseTypeId
  /** Non-empty whenever the choice is offered disabled. Never a bare flag — 139-C's
   *  finding is that an option which vanishes, or greys out mutely, teaches nothing. */
  disabledReason?: string
}

/** The one stranding sentence, in the plain language the picker speaks (D-183-06). */
export const STRANDING_REASON =
  "This would come after the deliverable, so the workflow would no longer end with it."

/**
 * R10b — EVERY choice in `PHASE_TYPE_ORDER` is offered at render position `index`, in
 * that fixed order. **Never fewer than the whole set**: a stranding choice is returned
 * DISABLED WITH ITS REASON, never omitted.
 *
 * ⚠ This sentence counted — *"the six choices … never fewer than six"* — until Phase 189
 * appended the 7th type and falsified it, in the commit that falsified it (D-26's
 * same-commit rule). The PROPERTY is unchanged and is now stated WITHOUT a number,
 * because the rule is "nothing is ever hidden", not "six": the set has grown twice
 * (5 → 6 at 101.1, 6 → 7 at 189) and a count in prose rots on every additive growth. The
 * suite asserts `PHASE_TYPE_ORDER.length` for the same reason.
 *
 * The rule: when the definition already carries an `llm_emit` and `index` lands
 * strictly AFTER the last one's render position, the new step would follow the
 * deliverable and the workflow would stop ending with it.
 *
 * ⚠ BOUNDARY, recorded deliberately (plan 184-02 Task 2 wrote "at or after"). `index`
 * is `insertPhaseAt`'s position, and inserting AT the deliverable's position puts the
 * new step BEFORE it — the deliverable simply shifts down one and stays terminal.
 * Disabling that slot would refuse the single most natural authoring act ("add a step
 * just before the deliverable") while stating a reason that is factually false about
 * the edit it refused. A refusal whose stated reason lies is worse than a silent one,
 * so the boundary here is strictly-after. See 184-02-SUMMARY.md, Deviation 1.
 *
 * Like `canRemovePhase`, this is a SHAPE predicate and consults no server.
 */
export function allowedTypesAt(
  phases: readonly PhaseSpecJSON[],
  index: number,
): TypeChoice[] {
  const ordered = orderPhases(phases)
  let lastEmit = -1
  for (let position = 0; position < ordered.length; position += 1) {
    if (ordered[position].config.phase_type === "llm_emit") lastEmit = position
  }
  const at = clampPosition(index, ordered.length)
  const strands = lastEmit !== -1 && at > lastEmit

  return PHASE_TYPE_ORDER.map((type) =>
    strands ? { type, disabledReason: STRANDING_REASON } : { type },
  )
}

// ── Phase 185 governance vocabulary (GOVERN-01 / GOVERN-03) ────────────────────

/**
 * EVERY user-visible governance sentence, one exported const each — never a literal in
 * JSX. This is the `STRANDING_REASON` / `StepTypePicker` idiom: the surface AUTHORS NO
 * SENTENCE OF ITS OWN, imports what it renders, and its suite asserts character-identity
 * against these names. A refusal reason that lives in a component is a refusal reason
 * nobody can test for drift.
 *
 * TWO RULES THIS COPY SATISFIES, AND BOTH ARE LOCKS.
 *
 * 1. D-185-02 — the attached-gate sentence is AGENT-STEP copy and is deliberately worded
 *    from scratch rather than lifted off the deliverable path. The shipped `check_coverage`
 *    claim is computable only over a STRUCTURED LEAF SET (`output.field_map`, which only
 *    `llm_emit` produces); free prose has no leaves, and detection only ever fires on
 *    `llm_agent` / `llm_batch_agents`. The honest claim on a detected agent step is
 *    RETRIEVED-AND-POINTED-AT — it opened a file, and it says which. Promising more here
 *    would be the precise overclaim this milestone exists to prevent, so the deliverable
 *    path's stronger wording must never be transplanted onto `GROUNDING_ATTACHED_GATE`.
 *
 * 2. SPEC Req 7's binding vocabulary — say *Must prove it*, *Free to think*, *Nothing to
 *    prove here*. The four banned readings are the past participle of "prove", the two
 *    "no governance at all" adjectives, and the two clerical ways of saying a step is
 *    outside the rule. *Traceable* becomes legitimate only at the review moment, where a
 *    coverage check has actually run — that is Phase 188, not here.
 *
 * The refusal below is the "lobotomy, not a loophole" wording (sketch 142-B, operator-
 * locked): switching the document tools off does not loosen the step, it stops the step
 * reading your files. Framing that as a reasonable alternative is what the first draft
 * did wrong.
 */

/** The loose side of the dial. Struck through, never hidden, on a locked step. */
export const GROUNDING_DIAL_LOOSE_LABEL = "○ Free to think"

/** The strict side of the dial. */
export const GROUNDING_DIAL_STRICT_LABEL = "⛨ Must prove it"

/**
 * The canvas seal's ACCESSIBLE label (185-09) — the same binding words as the strict
 * side of the dial, with the glyph removed because the seal renders `⛨` itself as an
 * `aria-hidden` child and a screen reader must not hear it twice.
 *
 * It lives here, beside the dial's label, rather than as a literal in
 * `PhaseNodeCard.tsx`: Req 7's vocabulary is a LOCK, and two copies of a locked word in
 * two files can drift. `PhaseNodeCard.test.tsx` asserts that
 * `GROUNDING_DIAL_STRICT_LABEL` still ends with this string, so the pair cannot be
 * edited apart silently either.
 */
export const GOVERNANCE_SEAL_LABEL = "Must prove it"

/** A step type that makes no factual claim carries this INSTEAD of a control (D-185-16). */
export const GROUNDING_NOTHING_TO_PROVE = "Nothing to prove here"

/** Why the step is locked, when the cause is `detected`. */
export const GROUNDING_WHY_DETECTED = "Because this step reads your documents."

/** Why the step is locked, when the cause is `escalated` — the one authored cause. */
export const GROUNDING_WHY_ESCALATED = "Because you turned this on by hand."

/** The `already-set` reading: the strictness is the citation policy's, not this dial's. */
export const GROUNDING_ALREADY_SET_NOTE =
  "This step already has to cite its sources — that comes from its citation policy above, not from this dial."

/** The tool chips ARE the dial — said in-surface so the real control is never hidden. */
export const GROUNDING_TOOL_LIST_IS_THE_CONTROL =
  "Switching any of them on is what makes this step have to prove itself — this list is the real control."

/** What the engine-attached gate actually checks. See rule 1 above before editing this. */
export const GROUNDING_ATTACHED_GATE =
  "Before this step is accepted it must have actually retrieved something from your documents, and point at what it used. A step that answers without opening a file fails."

/** The refusal printed when the loose side of a locked dial is pressed. */
export const GROUNDING_LOCK_REFUSAL =
  "Reading your files is what this step is for, so it has to show where its answers came from. You can switch off the document tools below — but that does not loosen the step, it stops it opening your files at all."

/** The label of the 🔒 locked row the gates rail synthesizes for a governed step. */
export const GOVERNANCE_GATE_ROW_LABEL =
  "Must prove it — retrieved sources, pointed at in the answer"

/** The action-risk switch. Default OFF; arming is always the author's act. */
export const ACTION_RISK_ARM_LABEL = "Stop and ask me first"

/** What arming costs, said plainly: an indefinite wait, not a timeout that advances. */
export const ACTION_RISK_ARMED_NOTE =
  "When this step is reached the run stops and waits for your answer. It will not continue on its own."

// ── Phase 189 (CONN-01 / D-02 / D-15) — the external-action authoring vocabulary ──
//
// TWO sentences, sited HERE rather than in `ExternalActionSection.tsx`, for the reason
// the block above states in full: a sentence that lives inside a component is a sentence
// nobody can test for drift. The section imports both and authors none.
//
// ⚠ THE THREE CAPABILITY LABELS ARE NOT HERE, AND THAT IS DELIBERATE (D-23). They are
// `phaseVocabulary.EXTERNAL_CAPABILITY_SENTENCES` — the SAME constant the node face
// reads — so the picker row and the card it previews are ONE string read twice rather
// than two copies that can disagree. Re-typing them here would be the drift this whole
// idiom exists to prevent, one file further along.

/** The capability picker's heading (UI-SPEC §7b/§9d). */
export const EXTERNAL_ACTION_HEADING = "What this step does outside"

/**
 * The honest note printed when NO capability row is selected.
 *
 * ⚠ It says what this step does NOT do, and it is the empty/no-capability note by name
 * (UI-SPEC §9d) — not a running commentary on the type. Phase 190 makes the node send
 * for real; a note that claimed "nothing is ever sent" on a chosen capability would
 * become a lie that day. The not-sent fact at design time is carried by the canvas
 * badge (D-12) and at run time by the run word (D-16), which is where those decisions
 * put it.
 */
export const EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE =
  "Nothing is sent yet — this step records what it would do."

// ── Phase 187 (VOCAB-02 / Req 5) — the seed receipt (sketch 150-B) ─────────────
//
// WHY THE RECEIPT EXISTS. A seeded draft arrives with steps already carrying a
// governance seal the user never asked for, and nothing on the canvas explains why.
// Safety nobody can see is indistinguishable from magic, and magic is not trust. The
// receipt names the steps and their REASON — it is the surface that discharges SC#3.
//
// WHY THE COPY LIVES HERE and not in the component that draws it: the same rule the
// governance block above states. `GovernanceSection.tsx` AUTHORS NO SENTENCE OF ITS
// OWN, and neither may the receipt — a sentence inside a component is a sentence
// nobody can test for drift (T-187-10-05).
//
// WHAT IS LOCKED vs WHAT IS CLAUDE'S. Sketch 150-B's four load-bearing properties are
// locked: per-step WITH its cause, the one-way rule stated plainly, dismissible, and a
// close that says nothing is committed. The wording below is discretionary — except
// where it reaches for the governance vocabulary, which is Req 7's LOCK and is
// therefore COMPOSED from `GOVERNANCE_SEAL_LABEL` rather than re-typed.
//
// THE RECEIPT RENDERS A REASON, IT NEVER DECIDES ONE (D-187-08 / T-187-10-04). The
// per-step formatter takes a `GroundingCause` and the intersecting tool as INPUTS.
// Classification stays where Phase 185 put it — `groundingCauseOf` over the server's
// `kb_tools` — so this module cannot become a second grounding derivation.

/** Total, non-negative whole count. NaN / negative / fractional all resolve (TOTALITY:
 *  a copy formatter is handed numbers derived from author-supplied JSONB). */
function wholeCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  const whole = Math.trunc(value)
  return whole > 0 ? whole : 0
}

/**
 * The receipt's heading: orientation first — what did it build, and how much of it.
 * A formatter over a number, so 0 / 1 / N are one rule rather than three literals.
 */
export function seedReceiptHeading(stepCount: number): string {
  const count = wholeCount(stepCount)
  return `Here's what I built — ${count} ${count === 1 ? "step" : "steps"}`
}

/**
 * The DETECTED lead: how many steps the generation itself grounded, and what that cost
 * them. Its parameter is the count of steps whose cause is `detected` — NOTHING ELSE.
 *
 * ── WHY THE PARAMETER IS NARROWER THAN "GROUNDED" (187-16, review CR-01) ──
 * This sentence ends "so I set them to must prove it". That is an AUTHORSHIP CLAIM, and
 * it is true of exactly one of the three causes `groundingCause` can return:
 *
 *   detected     the generation switched on a KB-reading tool, and the lock followed
 *                from that. The AI really did this. ✔ counted here
 *   already-set  the deliverable's own `citation_policy` dial holds it. Nothing in this
 *                generation applied it — and since `/generate` returns `model_dump`,
 *                which emits the `"strict"` DEFAULT, this is the TYPICAL case. ✘
 *   escalated    the author turned it on by hand. ✘
 *
 * It shipped taking the SEALED count (any non-null cause), so on the ordinary generated
 * draft — both curated starter spines end `llm_agent → llm_emit` — the receipt told the
 * user the AI had applied a gate the AI had not touched. A receipt about safety that
 * misattributes safety is worse than no receipt: it teaches a wrong mental model of what
 * the machine did. The carried causes get `seedReceiptCarriedLead` below, which claims
 * nothing.
 *
 * The returned strings are UNCHANGED by that repair. They were always true of `detected`
 * steps and only of those; the defect was entirely in what the caller counted.
 *
 * ZERO returns the EMPTY STRING, deliberately (D-187-10). With no auto-grounded steps
 * the receipt still appears — the orientation half and the nothing-committed half are
 * useful regardless — but there is no detected paragraph, because a grounded claim that
 * is empty or invented is exactly what Req 5 forbids. The caller renders this paragraph
 * only when it is non-empty.
 *
 * The binding phrase is COMPOSED from `GOVERNANCE_SEAL_LABEL`, never re-typed: Req 7's
 * vocabulary is a lock, and two copies of a locked word in two places can drift.
 */
export function seedReceiptGroundingLead(detectedCount: number): string {
  const count = wholeCount(detectedCount)
  if (count === 0) return ""
  const words = GOVERNANCE_SEAL_LABEL.toLowerCase()
  return count === 1
    ? `1 step reads your documents, so I set it to ${words}.`
    : `${count} steps read your documents, so I set them to ${words}.`
}

/**
 * The CARRIED lead: the sealed steps this generation did NOT seal — `already-set` plus
 * `escalated`, counted together because what they have in common is the only thing the
 * sentence says about them.
 *
 * Four properties, all load-bearing (187-16):
 *
 *  1. ZERO ⇒ the empty string, exactly as its sibling above does, so the component asks
 *     the same question once per paragraph and keeps ONE arrival shape (D-187-10).
 *  2. IT CLAIMS NO AUTHORSHIP **AND ATTRIBUTES NO CAUSE** (187-20, review WR-09). No
 *     first-person application verb appears — this generation did not do it, and a receipt
 *     that implies otherwise is CR-01 wearing a different sentence. But the sentence must
 *     not name the OTHER party either, and that is the half 187-16 got wrong: it shipped
 *     ending " by its own settings", which is a claim about WHICH cause holds the step,
 *     over a count that deliberately sums TWO causes this module keeps apart everywhere
 *     else — `already-set`, where the deliverable's own `citation_policy` default really
 *     does hold it, and `escalated`, where the lock was SET BY HAND rather than derived.
 *     On an escalated-only draft the paragraph therefore contradicted that same step's
 *     own reason, rendered two lines below it on the SAME CARD, where
 *     `seedReceiptStepReason("escalated")` says the lock was set by hand. A card that
 *     argues with itself about how a governance lock got there is an integrity defect on
 *     the governance surface, not a wording preference.
 *     (187-23 / WR-11: until that round the row sentence NAMED A PERSON, and this block
 *     quoted it verbatim. It names none now, and the quote is gone with it — a docblock
 *     that quotes a string its own file no longer contains is precisely the stale-claim
 *     class this phase has hit over and over.)
 *     The repair is a DELETION, not a replacement: the clause is gone and nothing takes
 *     its place. What both carried causes genuinely share is that the step ALREADY wore
 *     the seal, and that is all the sentence now says. WHICH cause is stated per row by
 *     `seedReceiptStepReason` — the one place that is handed the cause — which is exactly
 *     why the paragraph above the rows must not state one.
 *  3. IT IS SELF-CONTAINED. The detected sentence may be absent — on the typical
 *     non-KB draft it IS absent — so this one may render first or alone. It therefore
 *     leans on no antecedent ("that", "those", "more") that exists only when its sibling
 *     is present.
 *  4. IT PROMISES NO ONE-WAY LOCK. `SEED_RECEIPT_ONE_WAY_RULE` is the DETECTED lock
 *     (D-185-07 — detection wins and the undo disappears). An `already-set` step is held
 *     by the `citation_policy` dial and an `escalated` step by the author's own hand;
 *     neither is the one-way lock, so "you can't turn that off" must never travel with
 *     this sentence. That is why the rule is rendered with the DETECTED paragraph and
 *     not with this one.
 *
 * The governance phrase is composed from `GOVERNANCE_SEAL_LABEL` for the same reason its
 * sibling composes it: the vocabulary is Req 7's lock and must have one home.
 */
export function seedReceiptCarriedLead(carriedCount: number): string {
  const count = wholeCount(carriedCount)
  if (count === 0) return ""
  const words = GOVERNANCE_SEAL_LABEL.toLowerCase()
  return count === 1
    ? `1 step was already set to ${words}.`
    : `${count} steps were already set to ${words}.`
}

/**
 * The one-way rule, STATED rather than discovered. Detection wins over author intent
 * and the lock cannot be undone (D-185-07) — a user who learns that by pressing the
 * loose side and being refused has learned it the expensive way. The second clause is
 * the honest compensation: it cannot be turned off, but exactly where it applies is
 * visible, on this card, right now.
 *
 * IT TRAVELS WITH THE DETECTED SENTENCE AND ONLY WITH IT (187-16). This is the DETECTED
 * lock; a carried step is undone by whatever set it. Rendering it over an `already-set`
 * or `escalated` draft would be the same false claim in different words.
 */
export const SEED_RECEIPT_ONE_WAY_RULE =
  "You can't turn that off — but you can see exactly where it applies."

/**
 * One step's reason, RENDERED from the cause it is handed — this function classifies
 * nothing (D-187-08). `tool` is the KB tool the step's `available_tools` actually
 * intersects; naming it is what makes the reason a fact about THIS step rather than a
 * generic phrase. An absent or blank tool falls through to the unqualified sentence:
 * never fabricate, the same floor `derivedFace` holds.
 *
 * A `null` cause yields the empty string — a step with nothing to explain is never
 * listed, so there is no line for it to render. `null` is now its OWN arm; the
 * `default:` below is no longer the null case, and the last block here says why.
 *
 * IT NAMES NO ACTOR (187-23, review WR-11). This arm shipped reading "you turned this
 * on by hand" — a statement about a PERSON. Its input is `phase.grounding_escalated`, a
 * BOOLEAN (`backend/app/models/harness.py:234`; read here via `phaseVocabulary.ts:329`
 * and `:353`). The bit records that the lock is AUTHORED RATHER THAN DERIVED. It does
 * not record who authored it, and this function is handed a cause, never an actor.
 *
 * That gap is reachable rather than theoretical, and it was MEASURED rather than
 * assumed: `grounding_escalated` is an ordinary `PhaseSpec` field, the emit tool's
 * schema is the WHOLE `WorkflowDefinition`
 * (`backend/app/services/workflow_authoring.py:140`), and `generate_workflow_definition`
 * returns `wd.model_dump(mode="json")` with only `name_seeded_by_ai` and `slug`
 * re-stamped (`:341-377`) — nothing on that success path resets this bit. So a model
 * emission carrying `grounding_escalated: true` validates and reaches this card, where
 * the retired sentence would have told a user who clicked nothing that they turned a
 * governance lock on by hand.
 *
 * IF THE SECOND PERSON IS EVER WANTED HERE it must be gated on provenance the client
 * actually holds — the `name_seeded_by_ai` shape (`harness.py:263`), stamped SERVER-SIDE
 * after validation and never read off the emission. No such bit exists for governance,
 * so the honest sentence is the one below: what happened, not who did it.
 *
 * The binding phrase is COMPOSED from `GOVERNANCE_SEAL_LABEL`, exactly as the two leads
 * above compose it. Req 7's vocabulary is a lock with ONE home, and a third hand-typed
 * copy of it is the drift this module exists to prevent.
 *
 * THE `default:` ARM IS AN EXHAUSTIVENESS GUARD (187-23, review WR-15) — the
 * `requiredConfigFor` idiom ~170 lines down, itself the `deriveTier.ts:119-127`
 * runtime-safe guard. A FOURTH `GroundingCause` member is now a TYPECHECK ERROR here
 * rather than an empty sentence on the card. It has to be: `SeedReceipt` renders the
 * reason UNCONDITIONALLY after an em-dash (`SeedReceipt.tsx:342-353`), so an unhandled
 * member would print a face, a dash and nothing — a seal arriving unexplained, the one
 * thing Req 5 forbids this surface to do.
 */
export function seedReceiptStepReason(cause: GroundingCause, tool?: string | null): string {
  const named = typeof tool === "string" && tool.trim() !== "" ? tool.trim() : null
  switch (cause) {
    case "detected":
      return named ? `it reads your documents (${named})` : "it reads your documents"
    case "already-set":
      return "it already has to cite its sources"
    case "escalated": {
      // Composed, never re-typed — the same lock `seedReceiptGroundingLead` and
      // `seedReceiptCarriedLead` obey.
      const words = GOVERNANCE_SEAL_LABEL.toLowerCase()
      return `it was set to ${words} by hand`
    }
    case null:
      return ""
    default: {
      // A 4th `GroundingCause` must be given its own sentence HERE. At runtime an
      // unmodelled member still yields the empty string rather than throwing.
      const _never: never = cause
      void _never
      return ""
    }
  }
}

/** The close: everything else is the author's, and nothing has been committed. The
 *  draft is not saved and not published — sketch 150-B's fourth load-bearing property. */
export const SEED_RECEIPT_NOTHING_COMMITTED =
  "Everything else is yours to change. Nothing is saved or published yet."

/** The dismiss control's ACCESSIBLE label. Carries no glyph, for the same reason
 *  `GOVERNANCE_SEAL_LABEL` does not: the mark renders as an `aria-hidden` child and a
 *  screen reader must not hear it twice (185-09). The receipt is dismissible because
 *  the canvas underneath is the real product — it may never become a blocker. */
export const SEED_RECEIPT_DISMISS_LABEL = "Dismiss"

/** The dismiss MARK. `✕` already ships as a plain dismiss outside the canvas
 *  (`PhaseFormPanel.tsx:766`, `PublishGauntlet.tsx:228`) — icon-convention §4. It is a
 *  separate export so the label above stays glyph-free and the pair cannot drift. */
export const SEED_RECEIPT_DISMISS_GLYPH = "✕"

// ── Phase 187 (VOCAB-03 / Req 6) — the template door (sketch 151-C) ────────────
//
// ONE FORWARD PATH, ALWAYS. Picking a starter SEEDS THE DESCRIBE BOX with the
// workflow's own plain-language sentence; it never forks straight to a canvas. A
// direct fork would be a second way a workflow comes into existence, with its own code
// and its own failure modes — and the curated fork already has a home on the Workflows
// page (the three-homes contract, finding #19). The cost is recorded rather than waved
// away: re-deriving from a sentence may come back different from the curated
// definition a human shaped.
//
// A STARTER IS ITS PHASE SPINE, never one phase-type glyph (icon-convention §4,
// finding #36) — which is why nothing here exports a category icon.

/**
 * The read shape of one starter row as `listStarterWorkflows` hands it over
 * (`api.ts:1303`'s `PublishedWorkflow`). Spelled structurally rather than imported so
 * this pure module stays free of the API client — the same reason `patchPhaseConfig`
 * spells its patch type inline. `definition` is the LOOSE JSONB
 * (`WorkflowDefinitionJSON = Record<string, unknown>`), so every read below is guarded.
 */
export interface StarterChoiceJSON {
  name: string
  definition?: Readonly<Record<string, unknown>> | null
}

/** The one quiet line at rest under the describe box. ONE extra line is the whole
 *  budget: finding #11 (describe-box-only first screen) and #12 (the 3-second read)
 *  are what a gallery here would spend. */
export const STARTER_DOOR_LINE = "Not sure where to start? Start from a template."

/** The picker panel's heading. */
export const STARTER_DOOR_HEADING = "Start from a template"

/** What picking one actually does, said before it happens — the surface never seeds a
 *  box the user did not expect to be filled, and the text stays editable. */
export const STARTER_DOOR_NOTE =
  "Picking one fills the describe box with its own words. You can edit it before anything is generated."

// The three states the panel can be in other than "here are the templates". Plan 187-10
// shipped the door's three affirmative sentences; the picker (187-14) fetches, and a
// fetch has three other outcomes. They live HERE for 187-10's own stated reason — a
// sentence inside a component is a sentence nobody can test for drift — and each is a
// DISTINCT fact, because collapsing them would make the surface say something it does
// not know.

/** In flight. Said in words rather than shown as a wordless spinner: the panel opened
 *  because the user asked a question, and a blank box is not an answer to it. */
export const STARTER_DOOR_LOADING = "Looking up the templates…"

/** The request FAILED. The panel says so and offers nothing — no cached list, no
 *  remembered rows, nothing fabricated. The describe box is still the way forward, which
 *  is exactly why one forward path is worth the constraint. */
export const STARTER_DOOR_UNAVAILABLE =
  "The templates could not be loaded just now. Describe what you need instead."

/** The request SUCCEEDED and returned nothing. A different fact from a failure, and
 *  keeping the two apart is the difference between "there are none" and "we could not
 *  look" — a surface that says the first when it means the second is lying quietly. */
export const STARTER_DOOR_EMPTY = "There are no templates to start from yet."

/**
 * The sentence a chosen starter seeds the describe box with.
 *
 * It is the workflow's OWN `business_requirement` (`harness.py:309`) — its declared
 * plain-language goal — so the box reads like something a person would have typed
 * rather than a machine-generated summary of a definition.
 *
 * FALLBACK, and why it is the name: a starter with no requirement must still seed
 * something the user can edit, and its name is the only other plain-language string it
 * carries that a human wrote. An empty box would silently swallow the click, and a
 * fabricated sentence would put words in the starter's mouth. TOTAL — a starter with
 * neither yields `""` rather than throwing.
 */
export function starterSeedSentence(starter: StarterChoiceJSON): string {
  const requirement = starter.definition?.business_requirement
  if (typeof requirement === "string" && requirement.trim() !== "") return requirement.trim()
  return typeof starter.name === "string" ? starter.name.trim() : ""
}

// ── D-184-11 — slug generation and the minimal valid phase ─────────────────────

/**
 * The base slug token per phase type. Derived from the CLOSED set above and from
 * nothing else — ASVS V5: the auto-generated slug is this phase's one client-side
 * input into the definition JSONB, and the slug is node identity (`node.id ===
 * phase.slug`) plus a `skip_to_phase` target. It is NOT user-editable in this phase;
 * the plain-language TITLE is what the user names.
 */
const SLUG_BASE = {
  programmatic: "prepare",
  llm_single: "write",
  llm_agent: "search",
  llm_batch_agents: "parallel",
  llm_human_input: "ask",
  llm_emit: "deliver",
  // Phase 189 (CONN-01). `act`, not `send`: the base token is keyed by PHASE TYPE, so it
  // is ONE token for all three capabilities — a `send-` slug would be simply wrong on a
  // step whose capability is `create_ticket` or `post_message`, the same argument
  // UI-SPEC §5a used to reject an envelope glyph for this type. It is also the verb the
  // type's own shipped subtitle uses ("…before it acts outside"), and it claims no send —
  // which matters in a phase whose whole point (D-05 / D-16) is that nothing is sent yet.
  external_action: "act",
} as const satisfies Record<PhaseTypeId, string>

/** The base used for a type outside the closed set (TOTALITY — never user text). */
const FALLBACK_SLUG_BASE = "step"

/**
 * D-184-11 — a unique, type-derived slug: the base token, then `-2`, `-3`, … until it
 * is free. Output always matches `/^[a-z0-9-]+$/` because every candidate is a closed
 * constant plus a decimal suffix.
 */
export function slugForType(
  phases: readonly PhaseSpecJSON[],
  type: PhaseTypeId,
): string {
  const base = SLUG_BASE[type] ?? FALLBACK_SLUG_BASE
  const taken = new Set(phases.map((p) => p.slug))
  if (!taken.has(base)) return base
  let suffix = 2
  while (taken.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

/**
 * The keys the discriminated union REQUIRES for a member, and not one key more.
 *
 * `WorkflowDefinition` is `extra="forbid"`, and a re-materialised default is exactly
 * the drift class R2's round-trip property exists to catch — so an optional field with
 * a backend default (`max_steps`, `emitter`, `citation_policy`, `timeout_seconds`, …)
 * is deliberately ABSENT here. The empty strings are honest placeholders the author
 * fills in the inspector; whether an empty `prompt` is publishable is a VERDICT, and
 * verdicts belong to the server.
 *
 * The `default` arm is the `deriveTier.ts:119-127` runtime-safe exhaustiveness guard:
 * the NEXT union member must be handled here (it forced the 7th, at Phase 189, exactly
 * as intended), and at runtime an unmodelled type yields the bare discriminator rather
 * than throwing.
 */
function requiredConfigFor(type: PhaseTypeId): Record<string, unknown> {
  switch (type) {
    case "programmatic":
      return { fn: "" }
    case "llm_single":
      return { prompt: "" }
    case "llm_agent":
      return { prompt: "", available_tools: [] }
    case "llm_batch_agents":
      return { prompt: "", available_tools: [] }
    case "llm_human_input":
      return { prompt: "" }
    case "llm_emit":
      return { prompt: "" }
    case "external_action":
      // Phase 189 (CONN-01 / D-01). `capability` is the ONE required key. Measured from
      // `ExternalActionPhaseConfig` rather than remembered: `available_tools` carries
      // `Field(default_factory=list)` AND is DERIVED from `capability` server-side by a
      // total-replacement validator (D-03), so emitting it here would re-materialise a
      // backend default — the drift R2's round-trip property exists to catch — and would
      // state a whitelist the client is not permitted to author. `phase_type` is the
      // discriminator `minimalPhaseFor` adds; there is no third field, by decision (the
      // member deliberately carries none of the five LLM shape-symmetry optionals).
      //
      // ⚠ AND IT CARRIES A REAL VALUE, unlike the empty-string placeholders above — the
      // one place this switch departs from its own register, so the reason is stated
      // rather than left to be re-derived. `prompt` and `fn` are plain `str`: an empty
      // one PARSES, and whether it PUBLISHES is a verdict the server owns. `capability`
      // is a closed `Literal` of exactly three (D-15), so `""` is not an unfilled
      // placeholder — it is a `ValidationError` that 422s the WHOLE definition the moment
      // the draft is saved, i.e. the step could be placed and then never stored, which
      // would falsify SC#1 ("a user can place the node") in the same breath as satisfying
      // it. The FIRST member of the backend `Literal` is emitted instead, so a placed
      // step is a VALID step.
      //
      // The name is not trusted, it is FENCED: `definitionOps.test.ts` reads the
      // `capability` Literal out of `harness.py` and asserts this value is a member of
      // it, so a rename on the server is a red test here rather than a 422 in the app.
      // Which capability an author actually wants is the picker's question (189-13); the
      // node face reads the stored value and falls through honestly when it does not
      // recognise it (UI-SPEC §7b), so nothing downstream depends on this being the
      // author's intent.
      return { capability: "send_email" }
    default: {
      const _never: never = type
      void _never
      return {}
    }
  }
}

/**
 * D-184-11 — the smallest phase object that satisfies the backend union for `type`.
 * A fresh object graph on every call (no shared array reference between two created
 * steps), so two inserts can never alias one another's `available_tools`.
 */
export function minimalPhaseFor(
  type: PhaseTypeId,
  slug: string,
  index: number,
): PhaseSpecJSON {
  return {
    slug,
    phase_index: index,
    config: { phase_type: type, ...requiredConfigFor(type) },
  }
}

// ── D-184-10 — the drag axis split ─────────────────────────────────────────────

/** A point on the canvas plane. Plain numbers — no DOM node, no event. */
export interface DropPoint {
  x: number
  y: number
}

/** The two independent readings of one drag. */
export interface DropResolution {
  /** The lane the card should reorder INTO, or `null` when the drag did not cross
   *  half a pitch. `null` means: no definition edit, no history entry, no validation. */
  reorderTo: number | null
  /** The vertical component, verbatim. Cosmetic, browser-local, never serialized. */
  dy: number
}

/** The lane nearest `x`; ties resolve to the LOWER index (deterministic, no clock). */
function nearestLaneIndex(x: number, lanes: readonly number[]): number {
  let best = 0
  let bestDistance = Math.abs(x - lanes[0])
  for (let i = 1; i < lanes.length; i += 1) {
    const distance = Math.abs(x - lanes[i])
    if (distance < bestDistance) {
      best = i
      bestDistance = distance
    }
  }
  return best
}

/**
 * D-184-10 — read ONE free drag as TWO independent things.
 *
 * The x-component resolves to a lane slot (a definition edit — undoable, validated,
 * marks the draft dirty). The y-component is kept verbatim as the browser-local
 * cosmetic nudge. **No modifier to learn.**
 *
 * SEPARATION BY CONSTRUCTION: `dy` is computed from the y inputs only and `reorderTo`
 * from the x inputs only, so a purely vertical drag can never produce a definition
 * edit. That is not a comment — `definitionOps.test.ts` asserts it across a sweep of
 * vertical distances.
 *
 * Pure: no DOM, no clock, no measurement. `lanes` is the ordered array of lane centre
 * x-coordinates, supplied by the view from its layout table; the pitch is READ from
 * that array rather than imported, which is why this module still needs nothing from
 * the canvas model.
 */
export function resolveDrop(
  origin: DropPoint,
  dropped: DropPoint,
  lanes: readonly number[],
): DropResolution {
  const dy = dropped.y - origin.y

  // Fewer than two lanes: there is nowhere to reorder to. `dy` still stands.
  if (lanes.length < 2) return { reorderTo: null, dy }

  const pitch = Math.abs(lanes[1] - lanes[0])
  const currentIndex = nearestLaneIndex(origin.x, lanes)
  const dx = dropped.x - lanes[currentIndex]

  if (pitch <= 0 || Math.abs(dx) < pitch / 2) return { reorderTo: null, dy }
  return { reorderTo: nearestLaneIndex(dropped.x, lanes), dy }
}
