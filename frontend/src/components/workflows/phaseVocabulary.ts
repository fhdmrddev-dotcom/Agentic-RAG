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
 * `citations_required`; `"flag"` for the flag policy; `"open"` for everything else —
 * which DELIBERATELY includes `"partial"`, `"draft"`, an absent value and any
 * future/unknown value, so the function is TOTAL and never throws.
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
  if (policy === "flag") return GROUNDINGS.flag
  return GROUNDINGS.open
}

/**
 * D-183-07 slot 2 — "Waits for you", true ONLY on `llm_human_input`. Every other
 * node face stays at ONE badge (137-D allows at most two).
 */
export function waitsForYou(phase: PhaseSpecJSON): boolean {
  return phase.config.phase_type === "llm_human_input"
}
