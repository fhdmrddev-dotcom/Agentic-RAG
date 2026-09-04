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
  // ── 200-WIRE (sketch 200 `publish.html` + `run-dialog.html`) — THE AUTHORED LABEL ─────
  // ⚠ `label` WAS ALWAYS ON THE WIRE AND THIS READ-SHAPE THREW IT AWAY. The backend's
  // `InputFieldSpec` declares `label: str` (`backend/app/models/harness.py:504`) and it
  // travels to the client inside `WorkflowDefinition.inputs` (`:532`) — but this member
  // read `Array<{ key?: string }>`, so every consumer downstream of `entryInputKeys` could
  // only ever print the raw JSONB key. Two shipped surfaces said so in writing and one of
  // them (`RunModal.tsx`) turned it into a documented refusal built on a premise that was
  // measurably false. Widening the member is the whole fix; see `entryInputFields` below
  // for the one subset it genuinely does not cover.
  // ── 214.1-01 (STEP-02) — THE SECOND ONE-MEMBER WIDENING, for the same reason and by the
  // same method as the `label` one directly above. `InputFieldSpec.required` is a
  // `bool = True` on the backend model and has ALWAYS travelled inside
  // `WorkflowDefinition.inputs`; this read-shape threw it away, so the three launch doors
  // could not tell a required field from an optional one and drew them identically. Widening
  // the member is the whole fix — `entryInputFields` below carries it, and
  // `LaunchInputFields` renders it as the SHIPPED mark rather than a new string.
  inputs?: Array<{ key?: string; label?: string | null; required?: boolean | null }> | null
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

/**
 * One entry input as the surfaces need to SAY it: the key it is addressed by, plus the
 * author's own label when the definition carries one.
 *
 * ⚠ `label` IS OPTIONAL BECAUSE THE GAP IS REAL, JUST NARROWER THAN IT WAS WRITTEN DOWN.
 * A definition that authors `inputs[]` carries `InputFieldSpec.label` (a REQUIRED `str`
 * on the backend model, `harness.py:504`) and this resolver hands it over. A definition
 * that declares only the bare `PhaseSpecJSON.input_keys` (`harness.py:73` — a plain
 * `list[str]`) has NO label anywhere, on the wire or off it, and that subset stays
 * unlabelled: the key is the only true thing there is to print. Inventing a friendly
 * sentence for it would be fabricating an author's words.
 *
 * ⚠ 214.1-01 ADDS A THIRD ABSENCE ARM TO THAT SAME RULE, and it is written HERE beside the
 * code it governs rather than in a plan nobody will read again: **A LABEL EQUAL TO ITS KEY IS
 * AN ABSENCE.** The declared-input door writes `label: key` on a one-click declaration,
 * because `InputFieldSpec.label` is a required `str` and inventing a friendly name would be
 * exactly the fabrication the two arms exist to refuse. Without this arm every such
 * declaration would print in the BODY face, which tells a reader *"a human phrased this
 * word"* about a word nobody phrased. A label identical to the key carries nothing the key
 * does not, so it is dropped and the key renders in the mono face. The comparison is made
 * AFTER trimming, for the same reason the whitespace arm exists.
 */
export interface EntryInputField {
  key: string
  /** The author's own label. ABSENT means the definition has none — never a default. */
  label?: string
  /**
   * Whether a launcher marks this field required.
   *
   * ⚠ ABSENT ON THE WIRE READS `true`, because `InputFieldSpec.required` is `bool = True`
   * server-side. Defaulting the other way here would be a client that disagreed with the
   * model about what a definition says — a second copy of a server predicate, and a wrong one.
   * ⛔ It is a MARK, never a block: see `LaunchInputFields.tsx`'s docblock for why, and for
   * the re-open trigger that would change it.
   */
  required?: boolean
}

/**
 * The entry inputs the soul and the run dialog surface, WITH their authored labels.
 *
 * The precedence is `entryInputKeys`'s, unchanged: bare `input_keys` wins when present
 * (those rows can carry no label), then `inputs[]`, then the wire kickoff fallback.
 */
export function entryInputFields(def: DefShape | null | undefined): EntryInputField[] {
  if (!def) return []
  if (Array.isArray(def.input_keys) && def.input_keys.length > 0) {
    // A bare `input_keys` row carries no label and no requiredness anywhere, on the wire or
    // off it. `required` still reads `true` — that is the model's default, not an invention.
    return def.input_keys.map((key) => ({ key, required: true }))
  }
  const fromInputs = (def.inputs ?? [])
    .filter((i): i is { key?: string; label?: string | null; required?: boolean | null } => !!i)
    .map((i) => {
      const key = i.key ?? ""
      const label = typeof i.label === "string" ? i.label.trim() : ""
      // ⚠ ABSENT reads TRUE, matching `InputFieldSpec.required = True`. Only an explicit
      // `false` is falsy here, so a `null` or a missing key both mean required.
      const required = i.required !== false
      // An empty or whitespace-only label is an ABSENCE, not a value to print — and so is a
      // label EQUAL TO ITS KEY, which carries nothing the key does not (see the docblock).
      return label && label !== key ? { key, label, required } : { key, required }
    })
    .filter((f) => !!f.key)
  if (fromInputs.length > 0) return fromInputs
  // The wire kickoff is always content-only → kickoff_prompt (D-103-CONF-1).
  return [{ key: "kickoff_prompt", required: true }]
}

/**
 * The entry input_keys the soul surfaces ("needs <keys>").
 *
 * DERIVED from `entryInputFields` rather than re-implemented — one home for the
 * precedence rule, so a change to it cannot land on one surface and miss the other.
 * Behaviour is byte-identical to the pre-200 implementation.
 */
export function entryInputKeys(def: DefShape | null | undefined): string[] {
  return entryInputFields(def).map((f) => f.key)
}

/**
 * Phase 214-09 (STEP-02 / D-214-04) — the RUN-SCAFFOLDING keys a launcher must NOT draw a
 * field for, because another control on the same form already collects them and the server
 * STRIPS a launcher-supplied copy.
 *
 * ⚠ THIS MIRRORS A BACKEND FROZENSET AND SAYS SO RATHER THAN RE-DERIVING IT.
 * `backend/app/models/message.py::RESERVED_RUN_INPUT_KEYS` is
 * `frozenset({"kickoff_prompt", "folder_id"})`, and BOTH kickoff merge sites strip those keys
 * out of a launcher's `inputs` dict before they reach `create_workflow_run.inputs`. Plan
 * `214-16` measured the strip into existence; this constant is the client half of the same
 * one rule. ⚠ A DIVERGENCE IS A SILENT DATA LOSS, NOT A TYPE ERROR — a field drawn for a key
 * the server strips is `BUG-260826-01` in a new costume: a control a person fills in whose
 * value reaches nothing. Change the two together or not at all.
 *
 * Both keys already have their own control on every launcher this phase touches: the Run
 * modal's kickoff textarea and its KB-scope `<select>`; the schedule form's "Starting
 * instruction" textarea. A second control for the same fact is not a feature.
 */
export const RESERVED_LAUNCH_INPUT_KEYS: ReadonlySet<string> = new Set([
  "kickoff_prompt",
  "folder_id",
])

/**
 * The declared entry inputs a LAUNCHER should render a field for.
 *
 * `entryInputFields` answers *"what does this definition declare?"* and its last arm falls
 * back to `[{ key: "kickoff_prompt" }]` for a definition that declares nothing at all — which
 * is the right answer to that question and the WRONG list to draw a form from. Every
 * definition would grow a text field beside the kickoff textarea that collects the same fact,
 * and the server would strip the value on arrival.
 *
 * So this is `entryInputFields` MINUS the reserved keys, and nothing else: same resolver, same
 * precedence, same two-arm label rule. An empty result means *"this launcher asks for nothing
 * extra"* and a caller renders no field region at all.
 */
export function launchInputFields(def: DefShape | null | undefined): EntryInputField[] {
  return entryInputFields(def).filter((f) => !RESERVED_LAUNCH_INPUT_KEYS.has(f.key))
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
 * Phase 197-04 (AUTH-02 / D-18) — WHICH STEP PRODUCES THE DELIVERABLE.
 *
 * The arrival card's rows 2 and 5 both hand a slug to the page's SHIPPED
 * `jumpToStep(slug)` seam (`WorkflowBuilderPage.tsx:1570`, `:1637`) — row 2 because
 * `TemplateAttachSection` is already mounted on that step (`PhaseFormPanel.tsx:1166`) and
 * owns its own server read, row 5 because that step's *Instructions* field is what
 * actually decides what gets produced. D-18 routes both to the terminal `llm_emit` step,
 * which makes rows 2 and 5 ONE mechanism rather than two.
 *
 * ⚠ **THIS DOES NOT RE-ANSWER "DOES THIS MAKE A FILE?"** — `templateAdmission`'s docblock
 * below states the module's standing rule and it binds here verbatim
 * (`soulData.ts:236-240`):
 *
 *   > *"WHY NOT THE SIMPLER 'has an emit phase' (P1′): it is byte-for-byte
 *   > `soulDeliverable(def).kind === "file"`, which ALREADY drives the shipped* Makes a
 *   > file *chip (`library/libraryFilter.ts`). Under P1′ the new mark would be a second
 *   > word for a fact this exact surface already states — and a second answer to one
 *   > question is the drift this module exists to forbid. Nothing here re-implements a
 *   > derivation `soulDeliverable` or `tierForDefinition` already owns."*
 *
 * `soulDeliverable` remains the ONE owner of *whether* a file is produced, and its
 * order-independent `phases.some(...)` is CORRECT for that question — it is deliberately
 * not refactored to route through this function. The question here is *WHICH step*, which
 * `.some()` structurally cannot answer and which matters because drafts carry more than
 * one emit phase. A caller wanting both facts asks both functions.
 *
 * ⚠ **ROWS 4 AND 5 ARE COUPLED TODAY, AND THE COUPLING LIVES IN THE OTHER FUNCTION.**
 * `soulDeliverable`'s label interpolates the workflow NAME (`${name} · file`), so the
 * deliverable row's *label* changes the moment the name row is edited. `terminalEmitSlug`
 * is name-independent BY CONSTRUCTION — it reads `slug` / `phase_index` / `phase_type` and
 * never touches `def.name`. That is exactly why the card reads the two separately: the
 * jump target must not move when the author renames the workflow. A later reader must not
 * "simplify" this by deriving the target from the label.
 *
 * THE TIE-BREAK IS DECLARED, NEVER LEFT TO `sort` STABILITY. Among `llm_emit` phases
 * carrying a usable slug: the greatest `phase_index` wins; on a tie, or when ANY candidate
 * lacks a usable numeric `phase_index`, the LAST candidate in ARRAY ORDER wins. The
 * mixed case resolves to array order deliberately — a numeric comparison in which one
 * operand does not exist is not a comparison, and the array is the definition's own
 * serialised order. ⚠ No shipped derivation in this module orders phases by `phase_index`
 * for a PICK (`tierForDefinition` folds over all of them; `soulDeliverable` uses
 * `.some()`), so this is net-new logic and is driven RED-first by
 * `soulData.test.ts`'s descending-order case.
 *
 * The defensive-shape ladder copies `templateAdmission`'s arm-per-reason shape below.
 *
 * @returns the slug of the step that produces the deliverable, or `null` when no step
 *          does — `null` is an HONEST absence and is never a slug that selects nothing.
 */
export function terminalEmitSlug(def: DefShape | null | undefined): string | null {
  // (1) The wire did not say. Nullish, or a `phases` the server never sent as an array —
  //     which includes the jsonb STRING SCALAR shape 194 of 223 live rows carry
  //     (`CLAUDE.md` § jsonb string-scalar trap): a string is truthy, `("…").phases` is
  //     `undefined`, and `Array.isArray` is false, so it is caught here.
  if (!def || !Array.isArray(def.phases)) return null

  // (2) The candidate set. A phase qualifies only if it is an `llm_emit` AND carries a
  //     slug that could actually select a step. ⚠ A candidate whose `slug` is absent,
  //     non-string, or empty after trim is NOT a candidate (threat T-197-13): this value's
  //     ONLY purpose is to be handed to `jumpToStep`, and a slug that selects nothing is
  //     strictly worse than an honest `null` — the caller can render nothing for `null`,
  //     but a dead jump target looks like a working control that silently does nothing.
  //     A phase list declaring no `config` at all yields no candidates and falls to (3),
  //     which is the same silence `templateAdmission`'s arm (2b) refuses to read as a "no".
  const candidates: Array<{ slug: string; index: number | null }> = []
  for (const p of def.phases) {
    if (p?.config?.phase_type !== "llm_emit") continue
    const rawSlug = p?.slug
    const slug = typeof rawSlug === "string" ? rawSlug.trim() : ""
    if (slug.length === 0) continue
    const rawIndex = p?.phase_index
    const index =
      typeof rawIndex === "number" && Number.isFinite(rawIndex) ? rawIndex : null
    candidates.push({ slug, index })
  }

  // (3) Nothing produces a deliverable that this card could point at → `null`.
  //     ⚠ This is NOT the negation of `soulDeliverable(def).kind === "file"` and must not
  //     be read as one: a definition WITH an emit phase whose slug is unusable DOES make a
  //     file and still answers `null` here. The two functions answer different questions,
  //     and the case where they disagree is the proof of it.
  if (candidates.length === 0) return null

  // (4) The declared tie-break. `>=` in the fold is load-bearing: it makes an index tie
  //     resolve to the LAST candidate in array order, matching the no-usable-index arm
  //     directly above it, so both fallbacks point the same way.
  const allIndexed = candidates.every((c) => c.index !== null)
  if (!allIndexed) return candidates[candidates.length - 1].slug

  let best = candidates[0]
  for (const c of candidates) {
    if ((c.index as number) >= (best.index as number)) best = c
  }
  return best.slug
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
 * published row locally. Routing the 110 to `unknown` is precisely what stops D-17 stripping a
 * shipped capability from three-quarters of the library.
 *
 * ⚠ **CORRECTED ON MEASUREMENT (193 REVIEW WR-07): the CAUSE of those 110 was mis-attributed.**
 * This sentence used to read "the 110 are `phases: []` (an unauthored stub)". That is an
 * unearned causal claim. `definition` is a jsonb **STRING SCALAR on 194 of 223 rows**
 * (`CLAUDE.md` § jsonb string-scalar trap) and `libraryFilter`'s `defOf` casts it through
 * **unparsed**, so at runtime `def` is very often a `string`, not an object — and a string
 * answers `unknown` at the step-(1) shape guard, never reaching the `phases: []` step at all.
 * **The honest statement: the 110 reach `unknown` through the shape guard — some as
 * `phases: []`, most likely as an unparsed jsonb string scalar; the split was NOT measured.**
 * The verdict is unaffected either way, which is why this is a correction to the prose and not
 * to the code. ⚠ Nothing pins the string-scalar shape in `ADMISSION_CASES` — a future "tidy"
 * of step (1) could move the dominant live shape into a different arm with the suite green.
 * That test gap is left open and named in `193-REVIEW.md` WR-07.
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
  // (2b) ⚠ 193 REVIEW WR-05 — A PHASE LIST THAT DECLARES NO `config` AT ALL DESCRIBES NOTHING
  //      ABOUT PHASE TYPE, so it must read the same way (2) does. `config` is OPTIONAL in
  //      `DefShape`, and before this arm existed a shape like
  //      `{ phases: [{ slug: "a", phase_index: 0 }] }` fell through to (3), where
  //      `undefined !== "llm_emit"` made `fills` false and produced a POSITIVE
  //      `does-not-admit` — the answer that HIDES the control. That inverts D-20: hide only on
  //      a positive no, never on a silence. The wire saying "there are phases" while saying
  //      nothing about any of them is a silence, not a no.
  if (def.phases.every((p) => p?.config?.phase_type === undefined)) return "unknown"
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
