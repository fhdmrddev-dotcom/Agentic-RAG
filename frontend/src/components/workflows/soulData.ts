/**
 * Phase 124-01 Task 1 (WUX-01, sketch 046-A / D-02 / D-03) — soulData.
 *
 * THE SINGLE SHARED MODULE for the workflow "soul" data. It surfaces the
 * identity-carrying atoms every soul size (card / run / pub) consumes from ONE
 * copy: the strictness-tier derivation, the phase-glyph vocabulary, the entry
 * "needs" keys, and the honest deliverable signal. These helpers were previously
 * page-private in `WorkflowsPage.tsx` (44-139); they are EXTRACTED here VERBATIM
 * so the three soul sizes can never render disagreeing tiers or glyphs
 * (D-02, SC#1+SC#2). Re-implementing any of these per soul size is the exact
 * drift this module forbids.
 *
 * Pure + client-side (D-02): this module surfaces EXISTING definition fields only
 * — no migration, no new authoring field, no backend touch. It imports NOTHING
 * from the API client; a tier / glyph / deliverable is DERIVED, never fetched.
 */
import { deriveTier, type CitationPolicy, type ValidatorKind } from "@/components/workflows/deriveTier"

// ── Phase-type glyph vocabulary (the ONE shared copy; the 6th llm_emit
//    "deliverable" entry). All soul surfaces import THIS map. ──
// Extraction history, stated literally — this header once claimed the
// PhaseSpineGraph.tsx duplicate had been replaced when it had NOT, which is how
// that drift survived two phases. The facts: Phase 124-01 removed the
// WorkflowsPage.tsx:44-51 copy; **Phase 183-04 removed the PhaseSpineGraph.tsx
// copy**, which now imports this map and renders it through phaseGlyph(). As of
// that plan there is no other declaration of this vocabulary in frontend/src, and
// `?raw` source guards in PhaseSpine.test.tsx / PhaseSpineGraph.test.tsx /
// WorkflowSoul.test.tsx make a reappearance a test failure rather than a comment.
// Phase 127-01 (WUX-03): upgraded flat unicode → verified fluent-emoji slug strings.
// phaseGlyph() (src/lib/phaseGlyph.tsx) is the render-time resolver — it returns
// a bundled 3D SVG component for each slug. This map is the single source of truth
// for the phase-type → icon vocabulary; PhaseSpine.tsx reads it for the unicode
// fallback ("•" for unknown types). Slugs verified API-present 2026-06-27.
// NEVER use: "direct-hit" (missing from the set), "no-entry-sign" (missing).
// Phase 184-01 Task 2 (D-184-07): the two cross-cutting swaps — `llm_agent` to
// "compass" and `llm_batch_agents` to "handshake" (its previous silhouettes mark
// measured luminance 34.5 on Deep Midnight, ~4x dimmer than the other five, and
// disappeared). Sketch 137-B makes the 3D mark the SOLE carrier of step type, so
// this is a correctness fix, not a taste call. Both slugs re-verified present in
// the installed @iconify-json/fluent-emoji@1.2.7 set 2026-07-27; the swap landed
// in ONE commit together with phaseGlyph.PHASE_GLYPH_MARKS, because changing this
// map alone would leave phaseGlyph() returning the old 3D component.
// Phase 189-13 Task 1 (CONN-01 / UI-SPEC §5a): the 7th type, `external_action`, gets
// "outbox-tray" 📤 — "leaves here / goes outside", which is the TYPE's nature. The mark
// is keyed by phase_type, so it is ONE mark for the type and NOT one per capability: an
// envelope would say *email* on a step whose capability might be a ticket. Two things
// were MEASURED against the installed @iconify-json/fluent-emoji@1.2.7 set (3174 icons)
// rather than inherited — (a) `outbox-tray` is PRESENT while the bare `outbox` is ABSENT
// (the empty-icon trap; never try it, it fails the build), and (b) presence is NECESSARY,
// NOT SUFFICIENT, per the 184 swap above: the slug's palette measures mean luminance
// 168.4, inside the shipped band (package 148.2 … handshake 189.0) and far above the 34.5
// that made the old batch-agents mark disappear. That is an unweighted palette estimate,
// not a rendered measurement — the rendered check is UAT row U1 (plan 189-16), because
// jsdom applies no CSS and paints nothing. Landed in ONE commit with
// phaseGlyph.PHASE_GLYPH_MARKS, and the two maps' key sets are now asserted IDENTICAL as
// a property (soulData.test.ts), so a ninth type inherits the split-brain guard.
export const PHASE_GLYPHS: Record<string, string> = {
  programmatic: "gear",
  llm_single: "memo",
  llm_agent: "compass",
  llm_batch_agents: "handshake",
  llm_human_input: "raised-hand",
  llm_emit: "package",
  external_action: "outbox-tray",
}

/** A loose read-shape over the definition JSONB (we only read what the soul needs). */
export interface DefShape {
  name?: string | null
  business_requirement?: string | null
  project_folder_id?: string | null
  inputs?: Array<{ key?: string }> | null
  input_keys?: string[] | null
  phases?: Array<{
    slug?: string
    phase_index?: number
    name?: string | null
    config?: { phase_type?: string; citation_policy?: string; [k: string]: unknown }
    validators?: Array<{ kind?: string }> | null
  }> | null
  // Phase 193-02 (AUTH-03 / D-21): the bound-library-template read-shape. It was always
  // REACHABLE through the index signature below, and therefore always UNTYPED; declaring
  // it here rather than narrowing at the call site follows `libraryFilter.ts`'s
  // "DERIVE, DO NOT RE-IMPLEMENT" rule — `DefShape` IS the declared read-shape, and a
  // second local declaration of it is the drift this module exists to forbid. Only
  // `kind` is ever consumed (`templateAdmission`); `asset_id` is declared because the
  // live rows carry it, never read, never rendered, never logged (threat T-193-07).
  // Measured: 74 `assets[]` entries across 223 live definitions, every one `kind:
  // "template"`. Widening touches every consumer's type surface — `tsc -p
  // tsconfig.app.json` was 33 before this member and is 33 after it.
  assets?: Array<{ kind?: string; asset_id?: string | null; [k: string]: unknown }> | null
  [k: string]: unknown
}

const ALL_VALIDATOR_KINDS: ReadonlySet<string> = new Set<ValidatorKind>([
  "citations_required",
  "output_file_valid",
  "freshness",
  "structure_check",
  "llm_judge_rubric",
])

/**
 * The citation_policy strictness order (loosest → strictest). Used to pick the
 * STRICTEST declared policy across multiple emit phases deterministically (WR-03).
 * Mirrors the deriveTier mapping intent — strict refines a workflow's whole tier up.
 */
const POLICY_ORDER: readonly CitationPolicy[] = ["draft", "partial", "flag", "strict"]

/** Return the stricter of two citation policies (the higher POLICY_ORDER rank). */
function stricterPolicy(a: CitationPolicy, b: CitationPolicy): CitationPolicy {
  return POLICY_ORDER.indexOf(b) > POLICY_ORDER.indexOf(a) ? b : a
}

/**
 * Derive the strictness tier for a soul from its REAL definition (D10): the
 * citation_policy comes from the strictest llm_emit phase's config (default
 * "draft" when no emit phase declares one — no per-phase citation gate), and the
 * validator-kind set is the union across all phases. The tier is computed on
 * every call — there is NO stored tier string read anywhere.
 */
export function tierForDefinition(def: DefShape | null | undefined) {
  const phases = def?.phases ?? []
  // Pick the STRICTEST citation_policy across all emit phases (WR-03 — deterministic
  // "stricter wins" via POLICY_ORDER, not iteration-order-dependent). Default "draft"
  // when there is no emit phase at all (the only place citation_policy lives).
  let citationPolicy: CitationPolicy = "draft"
  let sawEmit = false
  for (const p of phases) {
    if (p.config?.phase_type === "llm_emit") {
      const cp = p.config?.citation_policy
      if (cp === "strict" || cp === "flag" || cp === "partial" || cp === "draft") {
        citationPolicy = sawEmit ? stricterPolicy(citationPolicy, cp) : cp
        sawEmit = true
      }
    }
  }
  const kinds = new Set<ValidatorKind>()
  for (const p of phases) {
    for (const v of p.validators ?? []) {
      if (v.kind && ALL_VALIDATOR_KINDS.has(v.kind)) kinds.add(v.kind as ValidatorKind)
    }
  }
  return deriveTier(citationPolicy, kinds)
}

/** The entry input_keys the soul surfaces ("needs <keys>"). */
export function entryInputKeys(def: DefShape | null | undefined): string[] {
  if (!def) return []
  if (Array.isArray(def.input_keys) && def.input_keys.length > 0) return def.input_keys
  const fromInputs = (def.inputs ?? []).map((i) => i?.key).filter((k): k is string => !!k)
  if (fromInputs.length > 0) return fromInputs
  // The wire kickoff is always content-only → kickoff_prompt (D-103-CONF-1).
  return ["kickoff_prompt"]
}

/**
 * The honest deliverable signal (D-03 / A1). The verified mechanism: a workflow
 * WITH a terminal `llm_emit` phase produces a FILE; ABSENT → the honest
 * "produces: answer in chat".
 *
 * `kind: "file"` carries a friendly label DERIVED from the workflow name (never a
 * fabricated "Status Report" / invented extension — the emitter does not expose a
 * guaranteed static deliverable name). Per A1 the EXACT friendly label string is
 * confirmed against sketch 046-A at UAT, not hard-asserted here; the resolver only
 * guarantees an honest, non-empty, non-fabricated label.
 *
 * `kind: "chat"` is the LOCKED honest fallback — never a fabricated deliverable.
 */
export type SoulDeliverable = { kind: "file"; label: string } | { kind: "chat" }

export function soulDeliverable(def: DefShape | null | undefined): SoulDeliverable {
  const phases = def?.phases ?? []
  const hasEmit = phases.some((p) => p.config?.phase_type === "llm_emit")
  if (!hasEmit) return { kind: "chat" }
  // Derive an honest label from the workflow name (no hardcoded deliverable name,
  // no fabricated extension). When the name is missing, fall back to a generic but
  // honest "file deliverable" rather than inventing a title.
  const name = def?.name?.trim()
  const label = name ? `${name} · file` : "file deliverable"
  return { kind: "file", label }
}

/**
 * Phase 193-02 (AUTH-03 / D-21 / D-25) — CAN THIS WORKFLOW BE HANDED A TEMPLATE?
 *
 * ⚠ THE CONTRACT'S SIGNAL DOES NOT EXIST IN THE DATA, and that correction is stated
 * here rather than smoothed. The sketch BUILD-CONTRACT, its README and 193-CONTEXT's
 * `<canonical_refs>` all describe the fill signal as *"admits `render_template` in the
 * phase tool whitelist"* — i.e. `phases[].config.available_tools ∋ "render_template"`.
 * Measured against the live library (223 definitions, `193-RESEARCH.md` §A.1-A.3):
 * **0 of 223 rows carry it.** A predicate written to the contract's letter marks
 * NOTHING AT ALL. The signal that does exist is `phases[].config.phase_type ===
 * "llm_emit"` (79 live phases), and `EMITTER_REGISTRY` has exactly ONE entry today
 * (`harness/emitters.py:183`), so `llm_emit` ⟺ *renders a template*.
 *
 * THE THREE STATES ARE LOAD-BEARING (D-20/D-25) — this is NOT a boolean with a `?? true`
 * at one call site. The card and the Run modal fall back OPPOSITE ways:
 *   WorkflowCard  (D-15): `templateAdmission(row.def) === "admits"`      — silence unless a positive yes
 *   RunModal      (D-20): `templateAdmission(def) !== "does-not-admit"`  — hide only on a positive no
 * On the card a missing mark costs nothing; in the modal, hiding on `unknown` would
 * REMOVE A SHIPPED CAPABILITY (WFIN-01) from a user who may need it, with no way to
 * discover it existed. The asymmetry is a decision, not an oversight — do not "fix" it
 * into consistency, and do not collapse the union to make one call site read nicer.
 * `soulDeliverable`, directly above, is the CAUTIONARY precedent: its `def?.phases ?? []`
 * collapses `null` and `{ phases: [] }` into one answer, which is right for a deliverable
 * label and would be a D-20 violation here.
 *
 * D-21's BOUND-ASSET ARM, measured (`193-RESEARCH.md` §A.4): `_exec_llm_emit` resolves
 * `_emit_bound_asset_ref(definition)` FIRST, and `template_asset_service.py:144` returns
 * UNCONDITIONALLY on Branch 1 when that ref is non-`None` — there is no override path,
 * nothing clears the ref because a user uploaded something. So on a row that binds a
 * library template the run-time upload is unreachable code: *Template to fill* would
 * promise what the engine discards, and *· needs a template* would be simply FALSE.
 *
 * THE COST, STATED NOT SMOOTHED — D-21's live scoring over the 145 published rows is
 * **1 admits / 34 does-not-admit / 110 unknown**, and the single admitting slug is
 * `ephemeral-template-fill-101uat`. The card mark is therefore visible on exactly ONE
 * published row locally. The 110 are `phases: []` (76 % of the library — an unauthored
 * stub), and routing them to `unknown` is precisely what stops D-17 stripping a shipped
 * capability from three-quarters of the library.
 *
 * WHY NOT THE SIMPLER "has an emit phase" (P1′): it is byte-for-byte
 * `soulDeliverable(def).kind === "file"`, which ALREADY drives the shipped *Makes a file*
 * chip (`library/libraryFilter.ts`). Under P1′ the new mark would be a second word for a
 * fact this exact surface already states — and a second answer to one question is the
 * drift this module exists to forbid. Nothing here re-implements a derivation
 * `soulDeliverable` or `tierForDefinition` already owns.
 */
export type TemplateAdmission = "admits" | "does-not-admit" | "unknown"

export function templateAdmission(def: DefShape | null | undefined): TemplateAdmission {
  // (1) The wire did not say. Nullish, or a `phases` the server never sent as an array.
  if (!def || !Array.isArray(def.phases)) return "unknown"
  // (2) An empty `phases` is a stub nobody authored — 110 of 145 published rows. NOT a
  //     positive no: D-20 keeps the Run modal's control on exactly this shape.
  if (def.phases.length === 0) return "unknown"
  // (3) No emit phase → a positive no. ⚠ An `llm_emit` phase with NO `emitter` key COUNTS
  //     as `render_template` — that is the Pydantic default (`models/harness.py`), and the
  //     shipped RunModal fixtures omit the key. Guarding on `emitter` rather than on
  //     `phase_type` alone also makes a FUTURE second emitter read `does-not-admit` here
  //     without a code change (RESEARCH assumption A1).
  const fills = def.phases.some((p) => {
    if (p.config?.phase_type !== "llm_emit") return false
    const emitter = p.config?.emitter ?? "render_template"
    return emitter === "render_template"
  })
  if (!fills) return "does-not-admit"
  // (4) An emit phase exists, but the definition already BINDS a library template — the
  //     run-time upload is unreachable (see the docblock's §A.4 measurement).
  const bound = (Array.isArray(def.assets) ? def.assets : []).some((a) => a?.kind === "template")
  if (bound) return "does-not-admit"
  // (5) It fills a template and nothing is bound: this is where a user supplies one.
  return "admits"
}
