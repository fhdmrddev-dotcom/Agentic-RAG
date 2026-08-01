/**
 * Phase 183-02 Task 1 (CANVAS-01, D-183-06 / D-183-07 / D-183-13 / D-183-15) —
 * phaseVocabulary.
 *
 * THE ONE SHARED PHASE-VOCABULARY MODULE. Two graph views one toggle apart — the
 * shipped vertical `PhaseSpineGraph` and the net-new read-only canvas — must never
 * disagree about what a step is CALLED, what it LOOKS like, or where its on-fail
 * branch GOES. This module owns exactly that vocabulary in one copy: the definition
 * read shapes, the `skip_to_phase` parse, the node-title resolution, the
 * plain-language step sentences, and the two derived badge signals.
 *
 * The drift this module forbids: a second `parseSkipTarget`, a second
 * `PHASE_TYPE_LABELS`, or a second phase-glyph map. The glyph vocabulary is NOT
 * re-declared here — `soulData.PHASE_GLYPHS` is the single source of truth for it
 * and `phaseGlyph()` (src/lib/phaseGlyph.tsx) is its render-time resolver.
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the
 * future: **plan 183-04 performed the hard cut**. `PhaseSpineGraph.tsx` no longer
 * declares a glyph map, a type-label map, the read shapes, the on-fail parse or a
 * node-title resolver — it imports them from here (and the icon vocabulary from
 * `soulData`), with NO re-export shim left behind. Its five importers were
 * repointed in that same commit.
 *
 * This paragraph is kept honest by machine, not by habit: `?raw` source guards in
 * `PhaseSpineGraph.test.tsx` and `PhaseSpine.test.tsx` fail the moment a second
 * copy of the glyph map or the parse reappears anywhere. In-code claims of a prior
 * extraction are the exact anti-drift hazard 183-CONTEXT warns about — soulData.ts's
 * own header asserted an extraction that had not happened — so treat this sentence
 * as true only because those guards are green.
 *
 * Purity contract: this module is pure and client-side. It imports NOTHING from the
 * API client — every value here is DERIVED from definition fields that already
 * exist, never fetched. It reads no DOM, computes no layout, and invents no
 * authoring field (a stored grounding-mode field belongs to Phase 185, not here).
 *
 * TOTALITY contract (CANVAS-01): every exported resolver is total. An unknown
 * `phase_type`, an unknown `citation_policy`, an unknown validator kind, a missing
 * `validators` array and a malformed `on_failure` all resolve honestly and NEVER
 * throw — the definition JSONB is author-supplied and a projection must not crash
 * on it.
 */

// ── Definition read shapes ──────────────────────────────────────────────────────
// Moved VERBATIM from PhaseSpineGraph.tsx:48-71 (field sets unchanged). Their
// looseness is deliberate and documented: the Builder refines the real definition;
// these are only the read shapes the graph + form panel agree on.

/** A validator entry as it appears in the draft definition JSON (loose shape — the
 *  Builder refines the real definition; we only read `on_failure` here). */
export interface ValidatorJSON {
  kind?: string
  on_failure?: string
  [k: string]: unknown
}

/** A phase config as it appears in the draft definition JSON. */
export interface PhaseConfigJSON {
  phase_type: string
  [k: string]: unknown
}

/** A `PhaseSpec` as it appears in the draft definition JSON (the Builder's working
 *  shape — `WorkflowDefinitionJSON` is opaque at the api layer; this is the local
 *  read shape the graph + form panel agree on). */
export interface PhaseSpecJSON {
  slug: string
  phase_index: number
  name?: string | null
  config: PhaseConfigJSON
  validators?: ValidatorJSON[]
  // ── Phase 185 (D-185-08) — the two governance intents ───────────────────────
  // Additive-optional, mirroring `name?: string | null`; pre-185 definition rows
  // read with both absent and the backend's `PhaseSpec` supplies `false`.
  //
  // THE AUTHOR'S INTENT ONLY (D-185-07). Of the three grounding causes only
  // `escalated` is authored: `detected` is a pure function of
  // `config.available_tools ∩ kb_tools` and `already-set` a pure function of
  // `config.citation_policy`, so both are DERIVED at read time and NEVER stored.
  // That is what makes "a detected step set back to free to think" unrepresentable
  // rather than a rule somebody must keep defending.
  //
  // ROUND TRIP: no serializer work is owed for these. `fromCanvas` carries phases
  // through BY REFERENCE (`canvasModel.ts:413-421`) — it hands back the SAME objects
  // `toCanvas` was given — so SPEC acceptance criterion 3 holds BY CONSTRUCTION and
  // is pinned by a `toBe` assertion in `canvasModel.roundtrip.test.ts`.
  /** The author escalated an otherwise-loose step to "must prove it". */
  grounding_escalated?: boolean
  /** The author armed an action-risk checkpoint: the run stops here and waits. */
  action_risk_armed?: boolean
  // ── Phase 187 (VOCAB-02 / Req 3) — the provenance marker ────────────────────
  // Additive-optional in the same register as the two bits above; pre-187 rows read
  // with it absent and no migration is owed.
  /** PROVENANCE, not display: the NL generator wrote the stored `name` rather than
   *  a person. Read ONLY by the demote-on-config-edit rule in `definitionOps.ts` —
   *  a generator-seeded title is cleared when an edit changes what the derived tier
   *  would say, while a hand-typed one never is. NO resolver in this module reads
   *  it; the ladder above cares only whether a title exists. */
  name_seeded_by_ai?: boolean
}

// ── The skip_to_phase parse ─────────────────────────────────────────────────────

/** The literal `on_failure` disposition prefix the backend slices by. */
export const SKIP_PREFIX = "skip_to_phase:"

/**
 * Resolve the target slug of a `skip_to_phase:<slug>` on_failure value.
 *
 * Semantics are EXACTLY the backend's `parse_skip_target`
 * (`backend/app/services/harness/reachability.py:89-98`): when the value is a
 * string beginning with the literal `SKIP_PREFIX`, slice off the prefix BY LENGTH,
 * trim, and return the remainder (or null when it is empty). Everything after the
 * prefix is the target — so `"skip_to_phase:a:b"` resolves to `"a:b"`.
 *
 * The prefix-length slice is load-bearing, and the correction is real: the previous
 * `PhaseSpineGraph` copy split on the LAST ":" and therefore returned `"b"` for that
 * input while its docblock falsely asserted parity (correction C-1 under D-183-15).
 * The pin is executable, not prose — `__fixtures__/skipParseCases.json` is read by
 * BOTH this module's vitest suite and `backend/tests/unit/test_183_skip_parse_parity.py`,
 * so neither language can drift alone.
 */
export function parseSkipTarget(onFailure: string | null | undefined): string | null {
  if (typeof onFailure !== "string" || !onFailure.startsWith(SKIP_PREFIX)) return null
  const target = onFailure.slice(SKIP_PREFIX.length).trim()
  return target.length > 0 ? target : null
}

// ── The node face vocabulary ────────────────────────────────────────────────────

/**
 * D-183-06 — the plain-language business sentence per `phase_type`, anchored to
 * sketch 137-D. It replaces the technical `"AI agent step · retrieve"` read that
 * 137-D was chosen to eliminate.
 *
 * MEASURED, and corrected in Phase 187-04. This docblock previously carried a
 * how-many-phases-have-a-name figure that was read at the wrong JSONB depth and is
 * REFUTED; it is deliberately not restated here, so a grep can prove it is gone.
 * The measurement live on :54322, **2026-08-02**, is
 * **0 of 57 phases across the 27 well-formed `workflow_definitions` rows** (the
 * other 145 rows store `definition` as a double-encoded JSON string that no app read
 * path can parse — `WorkflowDefinition.model_validate()` 422s on a `str`).
 *
 * The correction STRENGTHENS the conclusion this docblock draws rather than
 * weakening it: at 0 of 57, the type sentence is not merely the dominant node face,
 * it is the ONLY one the shipped ladder ever reached. That is the measurement Phase
 * 187 exists to answer.
 *
 * It is no longer the last stop before the raw type: 187-04 inserts a CONFIG-DERIVED
 * tier above it (`derivedFace` below), so a step with something bound now says what
 * it does and this sentence is the honest floor beneath that.
 */
export const PHASE_TYPE_SENTENCES: Record<string, string> = {
  programmatic: "Prepare the inputs",
  llm_single: "Write it up",
  llm_agent: "Work out how to do it",
  llm_batch_agents: "Work on the parts together",
  llm_human_input: "Check with you",
  llm_emit: "Produce the deliverable",
}

/** The ONE supporting line 137-D allows beneath the title. */
export const PHASE_TYPE_SUBTITLES: Record<string, string> = {
  programmatic: "A fixed step the server runs",
  llm_single: "Writes one piece in one pass",
  llm_agent: "Searches and decides its own next move",
  llm_batch_agents: "Several assistants work in parallel",
  llm_human_input: "Pauses here until you answer",
  llm_emit: "Fills your template and produces the file",
}

/**
 * A human label for a phase type — moved VERBATIM from `PhaseSpineGraph.tsx:34-41`,
 * values unchanged. This is the ⌥ Technical-names reveal vocabulary (D-183-08), NOT
 * the default node face.
 */
export const PHASE_TYPE_LABELS: Record<string, string> = {
  programmatic: "Server step",
  llm_single: "AI write step",
  llm_agent: "AI agent step",
  llm_batch_agents: "Parallel agents",
  llm_human_input: "Needs you",
  llm_emit: "Deliverable",
}

/**
 * The node title — FOUR tiers since 187-04 (D-183-06 + D-187-04 / D-187-05):
 *
 *   1. the stored `phase.name`, when it trims non-empty — a hand-written name is
 *      never overridden by a derivation;
 *   2. the CONFIG-DERIVED face (`derivedFaceOf`), computed at render from what the
 *      step actually has bound and written NOWHERE, so re-binding a skill changes
 *      the face with no write;
 *   3. the plain-language sentence for the type;
 *   4. the raw type string echoed honestly (never invent a sentence for a type we do
 *      not know — the `PhaseSpineGraph.tsx:89` precedent).
 *
 * TWO FLOORS this function carries, both testable:
 *  - **The SLUG NEVER appears in this string.** It lives behind the ⌥
 *    Technical-names reveal, via `technicalTitle`.
 *  - **A name is NEVER fabricated.** Tier 2 reads id→name lookups it does not own;
 *    an absent context or a lookup that misses falls THROUGH to tier 3 rather than
 *    rendering a raw UUID. An id-shaped face is worse than a generic one.
 *
 * `ctx` is OPTIONAL and defaults to the frozen module-scope empty context, which is
 * what lets every shipped caller render byte-identically to HEAD without being
 * touched. The one deliberate exception is `llm_human_input`: tier 4 of `derivedFace`
 * reads no lookup, so an unnamed human-input step now says "Wait for your approval"
 * instead of "Check with you" even with the context omitted. That is D-187-04's
 * intent, and it is pinned by a test rather than left to be discovered.
 */
export function nodeTitle(phase: PhaseSpecJSON, ctx: NameContext = NO_NAME_CONTEXT): string {
  const name = phase.name?.trim()
  if (name) return name
  const derived = derivedFaceOf(phase, ctx)
  if (derived) return derived
  // `?? ""` rather than a bare read: an absent `config` is a malformed author-supplied
  // row, and a projection must resolve it rather than throw (CANVAS-01 totality).
  const type = phase.config?.phase_type ?? ""
  return PHASE_TYPE_SENTENCES[type] ?? type
}

/**
 * The ⌥ Technical-names form — exactly today's shipped fallback preserved:
 * `"<type label> · <slug>"`, with the raw type standing in when unmapped.
 */
export function technicalTitle(phase: PhaseSpecJSON): string {
  const type = phase.config.phase_type
  const label = PHASE_TYPE_LABELS[type] ?? type
  return `${label} · ${phase.slug}`
}

// ── Phase 185 (GOVERN-01 / GOVERN-02) — THE ONE CLIENT GROUNDING DERIVATION ────
//
// This section REPLACES the shipped three-face word-badge derivation, which
// Req 6 deletes ("Phase 185 replaces this derivation" was that derivation's own
// docblock, so the removal was pre-authorized in the source). It read
// `citation_policy` plus a declared `citations_required` validator and rendered a
// WORD; graded governance reads the tool intersection FIRST and renders a SHAPE
// (the corner seal, plan 185-09). Different question, different answer, one home.
//
// WHY IT LIVES HERE AND IN EXACTLY ONE PLACE. Two surfaces consume this rule and
// they sit one click apart: the panel's `GovernanceSection` (which draws the dial
// and must know WHICH cause applies, because the cause decides whether the loose
// side refuses) and `canvasModel.buildPhaseData` (which needs only the boolean).
// 185-07's own hand-off note states the constraint plainly — the intersection has
// exactly one client home, and a second copy in `canvasModel.ts` or on the card is
// the drift this phase's red line forbids. So the rule moved DOWN into the shared
// vocabulary module both views already read, rather than being re-typed beside the
// second consumer.
//
// CLIENT-PREDICTS / SERVER-ENFORCES (D-185-09). Nothing here authorizes anything.
// The gate that actually runs is synthesized server-side at the run seam from the
// server's own `KB_TOOLS`; this is the DISPLAY prediction, so a wrong read is a
// display bug and never a safety hole. That is also why `kbTools` is passed IN and
// never hardcoded: the safety-DEFINING list has one home and it is not this file.
//
// TOTALITY (CANVAS-01). Every branch resolves; an unknown `phase_type`, an absent
// `available_tools`, an absent `kbTools` and an unknown `citation_policy` all read
// honestly and none of them throws.

/**
 * The three grounding causes and their absence, in the SAME total order the
 * server's `grounding_cause()` uses: `detected` → `already-set` → `escalated`.
 * That ordering IS the mechanism behind "detection wins and the undo disappears"
 * (D-185-07): a detected step can never be read back as free to think, because
 * the branch that would say so is never reached.
 */
export type GroundingCause = "detected" | "already-set" | "escalated" | null

/**
 * The two step types that can carry a grounding dial (D-185-15). Mirrors the
 * backend rule exactly: `available_tools` exists only on `LlmAgentPhaseConfig`
 * and `LlmBatchAgentsPhaseConfig`, so these are the only types the server's
 * `grounding_cause` can ever report `detected` for — and the only types on which
 * a stored `grounding_escalated` bit means anything.
 */
export const GROUNDING_DIAL_TYPES: readonly string[] = ["llm_agent", "llm_batch_agents"]

/** The deliverable — the one type whose strictness is owned by another control. */
const EMIT_PHASE_TYPE = "llm_emit"

/** The `citation_policy` value that makes the deliverable already-strict. */
const STRICT_CITATION_POLICY = "strict"

/**
 * The flat inputs the cause is a pure function of. Flat rather than phase-shaped
 * because the panel holds these five values as separate props (it renders a form
 * over a phase, not the phase itself) while the canvas holds a whole phase —
 * `groundingCauseOf` below is the phase-shaped adapter, so BOTH consumers reach
 * the same body and neither owns a second copy of the branch order.
 */
export interface GroundingInputs {
  /** The step's `phase_type`. Decides whether a dial exists at all (D-185-15). */
  phaseType: string
  /** The step's currently selected tools. */
  availableTools: readonly string[]
  /** The server's KB-reading tool names (D-185-09). EMPTY marks NOTHING — an
   *  unread palette must not un-mark a locked step, and it must not invent one
   *  either; the run-time gate is unconditional and server-side regardless. */
  kbTools: readonly string[]
  /** Author intent only (D-185-07). Inert wherever detection applies. */
  groundingEscalated: boolean
  /** `llm_emit` only: its shipped `citation_policy`. */
  citationPolicy?: string
}

/**
 * Resolve WHY a step must prove itself, or `null` when it is held to nothing.
 * TOTAL — every input shape returns, and none of them throws.
 */
export function groundingCause(inputs: GroundingInputs): GroundingCause {
  const hasDial = GROUNDING_DIAL_TYPES.includes(inputs.phaseType)

  // (1) DETECTED — the step reads your documents. Structural, never stored, and it
  //     wins over both branches below, which is what makes the lock one-way.
  if (hasDial && inputs.availableTools.some((tool) => inputs.kbTools.includes(tool))) {
    return "detected"
  }

  // (2) ALREADY-SET — the deliverable's own `citation_policy` dial said so. This
  //     section owns no second control for it; it reports what that one decided.
  if (inputs.phaseType === EMIT_PHASE_TYPE && inputs.citationPolicy === STRICT_CITATION_POLICY) {
    return "already-set"
  }

  // (3) ESCALATED — the author turned it on by hand. Read ONLY where a dial
  //     exists: a stored bit on a type that can never carry the control is inert,
  //     by the same rule that makes detection win.
  if (hasDial && inputs.groundingEscalated) return "escalated"

  return null
}

/**
 * The phase-shaped adapter over `groundingCause`. Reads the five inputs off a
 * definition phase and delegates; it declares no branch of its own, so the canvas
 * and the panel cannot drift apart by construction.
 *
 * `available_tools` and `citation_policy` are read defensively: `PhaseConfigJSON`
 * is the LOOSE definition-JSONB read shape, so a hand-edited row can carry either
 * as any JSON value, and a projection must not crash on one.
 */
export function groundingCauseOf(
  phase: PhaseSpecJSON,
  kbTools: readonly string[],
): GroundingCause {
  const rawTools = phase.config.available_tools
  const citationPolicy = phase.config.citation_policy
  return groundingCause({
    phaseType: phase.config.phase_type,
    availableTools: Array.isArray(rawTools) ? rawTools.filter((t): t is string => typeof t === "string") : [],
    kbTools,
    groundingEscalated: phase.grounding_escalated === true,
    citationPolicy: typeof citationPolicy === "string" ? citationPolicy : undefined,
  })
}

/**
 * GOVERN-03 — is an action-risk checkpoint armed on this step? A plain read of the
 * author's intent, offered on EVERY step type (SPEC Req 8) and defaulting to OFF:
 * an absent field means unarmed, and no step type performs outbound egress in 185.
 */
export function actionRiskArmed(phase: PhaseSpecJSON): boolean {
  return phase.action_risk_armed === true
}

// ── Phase 187 (VOCAB-01 / D-187-04, D-187-05) — THE CONFIG-DERIVED NODE FACE ────
//
// WHY IT EXISTS, measured. On the live corpus (:54322, 2026-08-02) **0 of 57**
// phases across the 27 well-formed `workflow_definitions` rows carry a real
// `phase.name`, so `nodeTitle` falls through its first tier 100% of the time and
// every node face on every workflow is one of exactly six type sentences. Two steps
// that do genuinely different work — "search the contracts folder" and "apply the
// pricing policy" — render letter-for-letter identically. This section inserts a
// tier that makes a step say what THAT step does, read from config it already has.
//
// DERIVE, NEVER STORE. The face is computed at render and written nowhere, so
// re-binding a skill changes it with no write and a stale JSONB row cannot lie —
// the same property that makes `groundingCauseOf` above safe.
//
// INJECTED CONTEXT, NOT A FETCH (D-187-05). `folder_scope` and `skill_ref` store
// resolved UUIDs, never names (`backend/app/models/harness.py:88`, `:93`), and the
// template lives on the DEFINITION (`assets[]`), not the phase. So the derivation
// cannot be a pure function of the phase alone. It takes an OPTIONAL name-lookup
// context instead — exactly the shipped `ToCanvasOptions.kbTools` precedent: passed
// IN with a safe default, never hardcoded, never fetched. The purity contract at the
// top of this file is preserved to the letter.
//
// NEVER FABRICATE. Absent context, or a lookup that misses, falls THROUGH to the
// type sentence. An id-shaped face is worse than a generic one.

/** The one type that pauses for a person — the literal `waitsForYou` also reads. */
const HUMAN_INPUT_PHASE_TYPE = "llm_human_input"

/**
 * The id→name lookups the derived face needs, injected by whoever holds them.
 *
 * Every member is optional and every miss is a fall-through, so the omitted /
 * empty context is the safe direction by construction: an unread map renders the
 * shipped type sentence rather than a fabricated or id-shaped face.
 */
export interface NameContext {
  /** Folder id → display name. Source: `PhaseFormPanel`'s `folderNames` (Phase
   *  103-ux). Absent or missing key ⇒ the folder tier misses. */
  folderNames?: Readonly<Record<string, string>>
  /** Skill id → display name. Source: `PhaseFormPanel`'s `skillNames` (Phase
   *  103-ux). Absent or missing key ⇒ the skill tier misses. */
  skillNames?: Readonly<Record<string, string>>
  /** The DEFINITION's `assets[]` entry where `kind === "template"`, already
   *  resolved to its filename by the caller that holds the definition. Absent ⇒
   *  the template tier misses. */
  templateFilename?: string
}

/** Module-scope so an omitted context hands the SAME reference on every call — the
 *  projection must stay deterministic to the byte (`canvasModel.ts`'s `NO_KB_TOOLS`
 *  idiom), and a fresh `{}` per call is a needless identity change. */
const NO_NAME_CONTEXT: NameContext = Object.freeze({})

/**
 * The flat inputs the derived face is a pure function of — mirroring
 * `GroundingInputs` above for the same reason: the panel holds these as separate
 * values while the canvas holds a whole phase, so `derivedFaceOf` below is the
 * phase-shaped adapter and BOTH consumers reach this one body.
 */
export interface DerivedFaceInputs {
  /** The step's `phase_type`. Gates tiers 2 and 4. */
  phaseType: string
  /** The bound skill's display name, already resolved. */
  skillName?: string
  /** The definition's template filename, already resolved. */
  templateFilename?: string
  /** The single scoped folder's display name, already resolved. */
  folderName?: string
}

/**
 * Resolve what THIS step does from its config, or `null` when nothing is bound.
 * TOTAL — every input shape returns and none of them throws.
 *
 * The ORDER is the decision (D-187-04), so it is numbered in the source: the rule is
 * MOST-SPECIFIC-FIRST, and any future tier is inserted by that test rather than by
 * taste. SPEC Req 1's "folder scope → bound skill → template" is a drafting slip and
 * is OVERRIDDEN by D-187-04.
 */
export function derivedFace(inputs: DerivedFaceInputs): string | null {
  // (1) BOUND SKILL — a bound skill states what *this* step does, so it wins over
  //     everything below. Most-specific-first is the whole argument for the
  //     precedence (D-187-04).
  if (inputs.skillName) return `Run the ${inputs.skillName}`

  // (2) TEMPLATE — gated on `llm_emit`, deliberately. The template is
  //     DEFINITION-level, so an ungated tier would render the same filename on
  //     every phase that reaches it and make distinct steps identical — the exact
  //     failure SC#5 check 2 exists to catch. `llm_emit` is also the only type
  //     whose executor resolves the bound template.
  if (inputs.phaseType === EMIT_PHASE_TYPE && inputs.templateFilename) {
    return `Fill ${inputs.templateFilename}`
  }

  // (3) FOLDER SCOPE — last of the three config tiers, deliberately. `folder_scope`
  //     is a subset of the single `project_folder_id`
  //     (`harness.py:_folder_scope_requires_project`), so most steps in one workflow
  //     share it and folder-first would collapse distinct steps back into identical
  //     faces — defeating the phase's own falsifiable bar.
  if (inputs.folderName) return `Search ${inputs.folderName}`

  // (4) HUMAN INPUT — nothing is bound, but the type alone says what happens.
  if (inputs.phaseType === HUMAN_INPUT_PHASE_TYPE) return "Wait for your approval"

  // (5) otherwise NULL — the honest floor. Never fabricate; the caller falls through
  //     to the plain-language type sentence.
  return null
}

/**
 * The phase-shaped adapter over `derivedFace`. It declares NO branch of its own — it
 * only reads defensively off the LOOSE definition-JSONB shape and delegates, so the
 * canvas and the panel cannot drift apart by construction.
 *
 * Every read is guarded (`Array.isArray` / `typeof`) because `PhaseConfigJSON` is
 * author-supplied and hand-editable: a projection must not crash on a malformed row
 * (CANVAS-01 totality).
 *
 * `assets` is NOT read here. The template is definition-level, so resolving it
 * belongs to the caller that holds the definition; this module stays a pure function
 * of *(phase, injected context)*.
 */
export function derivedFaceOf(
  phase: PhaseSpecJSON,
  ctx: NameContext = NO_NAME_CONTEXT,
): string | null {
  const config: Partial<PhaseConfigJSON> = phase.config ?? { phase_type: "" }

  // A `skill_ref` is a resolved UUID. A miss yields `undefined` — NEVER the raw id.
  const rawSkillRef = config.skill_ref
  const skillName =
    typeof rawSkillRef === "string" ? ctx.skillNames?.[rawSkillRef] : undefined

  // `folder_scope` is a LIST of ids. Only a single scoped folder can name the step:
  // a face that named one of several would be wrong, and a count is not a name.
  const rawScope = config.folder_scope
  const soleFolderId =
    Array.isArray(rawScope) && rawScope.length === 1 && typeof rawScope[0] === "string"
      ? rawScope[0]
      : undefined
  const folderName = soleFolderId !== undefined ? ctx.folderNames?.[soleFolderId] : undefined

  return derivedFace({
    phaseType: typeof config.phase_type === "string" ? config.phase_type : "",
    skillName,
    // The `llm_emit` gate lives in the core so both callers inherit it.
    templateFilename: ctx.templateFilename,
    folderName,
  })
}

// ── The badge slots (D-183-07 — Phase 185 leaves slot 1 EMPTY) ──────────────────
//
// Slot 1 carried a three-face grounding word-badge until Phase 185. SPEC Req 6
// DELETES it: governance renders as shape (the corner seal), spends no colour and
// spends no badge slot, and the freed slot belongs to 188 (run state) / 189
// (external actions). `PhaseNodeCard`'s max-2 tuple union is what enforces that
// budget; nothing here reserves the slot, because a reserved slot is a slot spent.
// The signal itself still reaches the face — as `PhaseNodeData.grounded`, resolved
// from the section above.

/**
 * D-183-07 slot 2 — "Waits for you", true ONLY on `llm_human_input`. Every other
 * node face now carries NO badge at all (137-B allows at most two, and slot 1 is
 * deliberately unspent).
 */
export function waitsForYou(phase: PhaseSpecJSON): boolean {
  return phase.config.phase_type === HUMAN_INPUT_PHASE_TYPE
}
