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
 * sketch 137-D. Only 10 of 119 live phases carry a real `phase.name`, so this
 * fallback is the DOMINANT node face, not an edge case. It replaces the technical
 * `"AI agent step · retrieve"` read that 137-D was chosen to eliminate.
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
 * The node title (D-183-06). A real `phase.name` wins when it trims non-empty;
 * otherwise the plain-language sentence for the type; otherwise the raw type string
 * echoed honestly (never invent a sentence for a type we do not know — the
 * `PhaseSpineGraph.tsx:89` precedent).
 *
 * The SLUG NEVER appears in this string. It lives behind the ⌥ Technical-names
 * reveal, via `technicalTitle`.
 */
export function nodeTitle(phase: PhaseSpecJSON): string {
  const name = phase.name?.trim()
  if (name) return name
  const type = phase.config.phase_type
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
// This section REPLACES `groundingFor` (SPEC Req 6: "Phase 185 replaces this
// derivation"). The shipped three-face word-badge read `citation_policy` plus a
// declared `citations_required` validator and rendered a WORD; graded governance
// reads the tool intersection FIRST and renders a SHAPE (the corner seal, plan
// 185-09). Different question, different answer, one home.
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

// ── The two badge slots (D-183-07) ──────────────────────────────────────────────

/**
 * Badge slot 1 — grounding. `words` is what the user reads; `glyph` is the
 * never-colour-alone control (WCAG 1.4.1), so the state survives a colour-blind
 * read at rest. Both are always non-empty.
 */
export interface Grounding {
  mode: "strict" | "flag" | "open"
  words: string
  glyph: string
}

/**
 * The three grounding faces. Glyphs REUSE the shipped strictness vocabulary from
 * `deriveTier.ts:57-79` (STRICT 🔒 / MIDDLE ◐ / LOOSE ○) so the whole app speaks one
 * strictness language rather than inventing a canvas-local dialect.
 *
 * The reuse is a BAND match, not just a glyph match: the `flag` face covers exactly
 * the `flag | partial` band `deriveTier` calls MIDDLE (`deriveTier.ts:112-115`), so a
 * phase cannot read one strictness on the canvas and a different one on the workflow
 * soul a click away. `phaseVocabulary.test.ts` imports `deriveTier` and pins that
 * agreement for both policies, so the two modules cannot drift apart silently.
 */
const GROUNDINGS = {
  strict: { mode: "strict", words: "Must cite its sources", glyph: "🔒" },
  flag: { mode: "flag", words: "Flags uncited claims", glyph: "◐" },
  open: { mode: "open", words: "No sources needed", glyph: "○" },
} as const satisfies Record<Grounding["mode"], Grounding>

/**
 * D-183-07 slot 1 — grounding DERIVED from fields that exist TODAY: the
 * `citation_policy` dial plus the presence of a `citations_required` validator
 * gate. Phase 185 later replaces this derivation with an authored grounding-mode
 * field; 183 must NOT invent that field.
 *
 * `strict` when the policy is `"strict"` OR any validator declares
 * `citations_required`; the MIDDLE `flag` face for `"flag"` AND for `"partial"`;
 * `"open"` for everything else — `"draft"`, an absent value and any future/unknown
 * value — so the function stays TOTAL and never throws.
 *
 * `"partial"` reads as the middle face because it is a REAL enforcement level, not
 * an absence of one: `deriveTier.ts:112-115` maps it to MIDDLE alongside `flag`, and
 * `soulData.POLICY_ORDER` ranks it above `draft`. Calling it "No sources needed"
 * here would have two governance surfaces one click apart making opposite claims
 * about the same stored value. Totality is unaffected — it is the UNKNOWN policy,
 * not the known-but-middling one, that falls through to `open`.
 *
 * `v.kind` is compared as a plain string and is NEVER cast to `ValidatorKind`: the
 * backend declares nine kinds while `deriveTier.ts:28-33` narrows to five, so a cast
 * would be a lie and an unmodelled kind such as `regex_match` must simply be ignored.
 *
 * C-8 holds: `citation_policy` exists only on `llm_emit` configs, so a NON-emit phase
 * can only reach `strict` via the `citations_required` validator. That is intended —
 * a gate is a property of the phase that carries it.
 */
export function groundingFor(phase: PhaseSpecJSON): Grounding {
  const validators = phase.validators ?? []
  const hasCitationGate = validators.some((v) => v?.kind === "citations_required")
  const policy = phase.config.citation_policy
  if (policy === "strict" || hasCitationGate) return GROUNDINGS.strict
  if (policy === "flag" || policy === "partial") return GROUNDINGS.flag
  return GROUNDINGS.open
}

/**
 * D-183-07 slot 2 — "Waits for you", true ONLY on `llm_human_input`. Every other
 * node face stays at ONE badge (137-D allows at most two).
 */
export function waitsForYou(phase: PhaseSpecJSON): boolean {
  return phase.config.phase_type === "llm_human_input"
}
