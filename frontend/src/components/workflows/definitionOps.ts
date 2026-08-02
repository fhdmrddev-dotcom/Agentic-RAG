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
import {
  nodeTitle,
  parseSkipTarget,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"

// ── The closed phase-type set ──────────────────────────────────────────────────

/**
 * The 6 members of the backend's `PhaseConfig` discriminated union
 * (`harness.py:157-167`). CLOSED: a slug and a minimal phase are only ever derived
 * from this set, never from user text.
 */
export type PhaseTypeId =
  | "programmatic"
  | "llm_single"
  | "llm_agent"
  | "llm_batch_agents"
  | "llm_human_input"
  | "llm_emit"

/**
 * The FIXED presentation order of the step-type picker (D-184-11). It is a `readonly`
 * tuple, not a set, because "the picker's third option moved" is a UX regression a
 * test should catch.
 */
export const PHASE_TYPE_ORDER = [
  "programmatic",
  "llm_single",
  "llm_agent",
  "llm_batch_agents",
  "llm_human_input",
  "llm_emit",
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
 * R10b — the six choices offered at render position `index`, in the fixed
 * `PHASE_TYPE_ORDER`. **Never fewer than six**: a stranding choice is returned
 * DISABLED WITH ITS REASON, never omitted.
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
 * a 7th union member must be handled here, and at runtime an unmodelled type yields
 * the bare discriminator rather than throwing.
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
