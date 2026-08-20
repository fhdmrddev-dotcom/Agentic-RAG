/**
 * Phase 103-04 Task 1 (REQ-4 / WFAUTH-03, sketch 019-D) — PhaseSpineGraph.
 *
 * The read-only VERTICAL phase-spine graph for the Builder. One node per
 * `PhaseSpec` ordered by `phase_index`, threaded on a vertical spine (a CSS
 * gutter line), with solid run-order `i→i+1` edges and EXACTLY ONE dashed
 * `skip_to_phase` on-fail branch when a validator declares one. It is a NET-NEW
 * component built from plain HTML/CSS (NO graph lib) and — by the locked sketch
 * contract — it is READ-ONLY: inspect, don't drag.
 *
 * G-5 RED LINE: this component MUST NOT import or modify the run-surface live
 * phase timeline / phase-card (those read live `usePhases`; this reads a DRAFT
 * definition JSON).
 *
 * The static drag-free invariant (REQ-4 acceptance c) is structural: every node
 * is a `<button>` (keyboard-selectable), there is NO `draggable` attribute, NO
 * drag handler (onDragStart / onPointerDown drag), NO connection handle, and NO
 * add-node control anywhere in the DOM. Selection NEVER reorders — clicking a
 * node only fires `onSelectNode(slug)`.
 *
 * ── ⚠ PHASE 200 — TWO OF SKETCH 200'S SPINE ATOMS ARE DECLINED, AND BOTH REASONS WERE
 *      RE-MEASURED RATHER THAN INHERITED ────────────────────────────────────────────────
 *
 * The `builder-spine` sheet draws both, and the 200 audit buckets both as FE-WIRING — the
 * SEAMS really do ship, which is what makes them worth stating rather than passing over:
 *
 *   · **`＋ Add Step` at the foot of the spine.** The insert seam exists on the CANVAS
 *     (`PlaneEditingLayer.tsx` `data-testid="canvas-insert-N"` → `StepTypePicker`), so this is
 *     a mount decision and not a capability. It is declined because mounting it here would
 *     re-open the locked read-only contract stated two paragraphs above, and that contract is
 *     not documentation — it is MECHANICALLY ENFORCED by this component's own REQ-4
 *     acceptance-c case (*"STATIC drag-free DOM: … no add-node control"*, which scans every
 *     button's label and every `[data-add-node]`). Re-opening it is a phase's decision to
 *     take, with that fence re-baselined deliberately; it is not an FE-wiring pass's.
 *   · **`Approve` / `Send back` in a step card.** The answer seam ships end to end
 *     (`api.ts` `answerAskUser`, driven by `PendingAskCard.tsx`), and the author-side choices
 *     are authored in `PhaseFormPanel`. But this component reads a DRAFT definition: there is
 *     no run, therefore no `tool_call_id`, therefore nothing for either button to send. They
 *     would be controls that cannot act, drawn on the surface whose whole promise is that
 *     what it shows is true of the workflow in front of you. The honest mount is the RUN
 *     spine — the `runTense` prop below, whose caller really does hold a run.
 *
 * ⚠ THE SECOND IS THE SAME CLASS OF SHEET DEFECT `199-02` CAUGHT, not a new judgement: a
 * run-tense atom drawn on an authoring surface. It is recorded here so the next reader of the
 * sheet does not re-derive it as an omission.
 *
 * Phase 183-04 (D-183-06 / D-183-08 / D-183-13) — THE HARD CUT. This file used to
 * carry its OWN phase-glyph map (the flat text marks Phase 127 retired), its own
 * type-label map, its own definition read shapes, its own on-fail parse and its own
 * node-title resolver. All six are DELETED: they now live in exactly one home,
 * `phaseVocabulary.ts` (vocabulary + parse + titles) and `soulData.ts` +
 * `phaseGlyph()` (the icon vocabulary + its render-time resolver), so the vertical
 * spine and the read-only canvas one toggle away cannot disagree about what a step
 * is called, what it looks like, or where its on-fail branch goes. Nothing is
 * re-exported from here — every consumer imports from the shared home directly.
 *
 * Two visible consequences, both intended:
 *   - the spine now renders the 3D fluent-emoji marks (finishing the Phase 127
 *     migration this file was left out of);
 *   - the DEFAULT node face is the plain-language business sentence (D-183-06), and
 *     the slug stays REVEALABLE — see the paragraph below for where, since 187-09.
 *
 * Phase 187-09 (SPEC Req 4 / D-187-16) — THIS COMPONENT IS NO LONGER A CONSUMER OF THE
 * ⌥ TECHNICAL-NAMES STATE, and the removal is the point rather than an oversight. 183-04
 * made the spine SWAP its title under the reveal, mirroring the canvas card. 187-04 gave
 * `nodeTitle` a config-derived tier, which makes the plain title SPECIFIC — so the swap
 * began destroying real meaning, and on the card it also truncated the slug it existed
 * to show. The canvas therefore moved its reveal into the card's SUBTITLE slot; this
 * surface has no subtitle slot, so it stops swapping instead, and the two views one
 * toggle apart agree on the TITLE in both toggle states.
 *
 * Nothing was hidden by that. The technical vocabulary was never behind the reveal HERE:
 * the mono chip beside each title prints the RAW `phase_type` unconditionally, the line
 * beneath prints the RAW `phase_index`, and the `aria-label` carries the raw type — all
 * three with the reveal OFF. With the title no longer swapping, no rendered value on this
 * surface depends on the reveal at all, so the subscription that used to read it was dead
 * code and is gone (`tsc -b` and ESLint both said so, which is how it was found rather
 * than assumed). The app-wide `TechnicalNamesProvider` is untouched and remains the ONE
 * technical-names state; the canvas is still its consumer, and the control still ships in
 * Settings, the operator band and the canvas header — never here.
 *
 * `nameContext` (D-187-05) is the page-owned folder/skill id→name lookup the derived tier
 * needs. It is OPTIONAL, it reaches `nodeTitle` and nowhere else, and an absent one makes
 * every derived tier MISS — the generic type sentence renders, never a fabricated or
 * id-shaped face — so a caller that omits it renders byte-identically to HEAD.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * Phase 200-05 (DES-02 · `200-CHECKLIST.md` §2) — THE TWO TENSES, AND THREE SUBTRACTIONS
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * ⚠ THIS COMPONENT STILL READS A DRAFT DEFINITION AND STILL HAS NO RUN. `199-02` refused
 * run-time words here for exactly that reason, and the refusal is INTACT — it is now
 * enforced rather than remembered. D-09 reconciles the contradiction CONTEXT carried (the
 * spine has no run / the slice clears the spine's per-step timings) with **one component,
 * two tenses**: the run tense arrives through the OPTIONAL `runTense` prop below, and
 * **an absent prop leaves the authoring render byte-identical**. That is this file's own
 * `nameContext?` pattern, and the house pattern three times over (`WorkflowCanvas.runState`,
 * `WorkflowCanvas.editable`, `PhaseFormPanel.rails` — the last pinned LOAD-BEARING at
 * `PhaseFormPanel.rails.test.tsx:125`). The authoring mount at `WorkflowBuilderPage.tsx:2136`
 * passes nothing and is unchanged; the run mount is `200-07`'s, on a page that already holds
 * the run and the definition in one fetch. **That siting is what keeps 199-02's refusal
 * intact BY CONSTRUCTION rather than by care.**
 *
 * THREE ATOMS WERE SUBTRACTED, and each subtraction is the deliverable rather than a tidy-up:
 *
 *   • `BS-MNR-01` — the `READ_ONLY_LEGEND` no longer RENDERS. ⚠ **This deliberately reverses
 *     `DEC-199-02-F`**, which kept it as a locked 019-D contract on the argument that it was
 *     asserted in four places. `200-CHECKLIST.md` calls it *"11px mono, visible at rest — the
 *     noisiest string in the product"*, and it is machine vocabulary (`phase_index`,
 *     `skip_to_phase`, `depends_on`) printed to a business author at the top of the widest
 *     column: the same *"never name the mechanism to the user"* rule under which 199-02 spent
 *     this header's other engineering note. **The CONSTANT stays exported** — its four
 *     assertion sites are re-pointed, not deleted, and the removal is proved by a DOM-level
 *     scan rather than a source one, because a `?raw` scan would go red on the export itself
 *     and a deliberate absence must not trip its own fence.
 *   • `BS-MNR-02` — the per-step raw `phase_type` chip is gone as VISIBLE TEXT. Its
 *     replacement is `PHASE_TYPE_LABELS`, **the canvas's own words**, so the same step no
 *     longer reads `llm_agent` here and `AI agent step` one toggle away. The raw id survives
 *     where a machine needs it (`data-phase-type`), which is not text a person reads.
 *   • `BS-MNR-03` — the `phase_index N` line is gone as a rendered LABEL. ⚠ `phase_index`
 *     itself is UNTOUCHED in the DATA: it is the ordering key and the sort below still reads
 *     it. What was forbidden is printing it at a person.
 *
 * AND THREE ATOMS WERE BUILT. `BS-MR-01`, the per-step model name — rendered ONLY where the
 * config declares one, because an absent model means *"use the run's model"* and naming a
 * default here would be a fabricated claim (N-6: the sketch's `GPT-4o` is placeholder text,
 * and models come from the registry, never from a literal). `BS-MR-02`, the type badge in the
 * canvas's words. `BS-MR-06`, the plain-language order sentence and the footer count sentence
 * that replace the legend's machine vocabulary — both derived from the definition the client
 * already holds, so neither is a claim about a run.
 */
import { PHASE_GLYPHS } from "@/components/workflows/soulData"
import {
  nodeTitle,
  parseSkipTarget,
  PHASE_TYPE_LABELS,
  PHASE_TYPE_SUBTITLES,
  type NameContext,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"
import { phaseGlyph } from "@/lib/phaseGlyph"
import { branchReading, type SpineRunTense } from "@/components/workflows/phaseDuration"
import { countDeclared } from "@/components/workflows/receiptVocabulary"
// Phase 200 (FE-WIRING) — the effect banner, from the ONE home the canvas card already
// reads. Before this import `grep -rn "effectBannerFor" frontend/src` returned exactly two
// consumers, BOTH in `PhaseNodeCard.tsx`, so the same `external_action` step wore
// `CHANGES SOMETHING OUTSIDE` on the canvas and nothing at all one toggle away. That is the
// two-views-two-languages defect `BS-2` exists to close, and the fix is an import rather
// than a second predicate: a re-spelled banner here would agree with the canvas only until
// one of them was edited. Its `ONLY READS` sibling stays DECLINED — no wire field can
// resolve a step to it — and the decline plus its dated re-open trigger live in that module.
import { effectBannerFor } from "@/components/workflows/nodeEffectBanner"
// Phase 200 (FE-WIRING) — the selected row's two detail lines, string home + worded scale.
import {
  literalReading,
  SPINE_DETAIL_LITERAL_LABEL,
  SPINE_DETAIL_PROMPT_LABEL,
} from "@/components/workflows/spineDetailVocabulary"

/**
 * The verbatim read-only legend (locked contract — sketch 019-D / 103-PLAN).
 *
 * ⚠ STILL EXPORTED, NO LONGER RENDERED (200-05, `BS-MNR-01`). The export is kept on purpose:
 * a subtraction proved by an INVERTED assertion against a live constant is a subtraction a
 * later re-add reddens, which a deleted constant cannot do (the `192.2-05` method, and the
 * same choice 199-02 made for this header's other removed atom). Its four assertion sites —
 * one in this component's suite and three in `pages/WorkflowBuilderPage.test.tsx`, where it
 * was how the graph view's PRESENCE was detected — are re-pointed at the spine's own
 * `aria-label`, which is a stabler presence probe than a body of copy.
 */
export const READ_ONLY_LEGEND =
  "READ-ONLY GRAPH · ordered by phase_index · run order (i→i+1) · " +
  "on-fail branch (skip_to_phase) · no depends_on · no parallel lanes · inspect, don't drag"

/**
 * `BS-MR-06` — the order sentence, in plain language.
 *
 * ⚠ IT DOES NOT REPEAT THE BADGE. The checklist words this atom as
 * *"View only — this is the order it will run in."*, and the first two words already ship as
 * the `👁 View only` badge beside it — the SHIPPED cross-surface read-only vocabulary that
 * `WorkflowCanvas.tsx:1000` and `WorkflowRunPage.tsx:960` also render, which 199-02's
 * inventory pins as an atom that STAYS. Printing "View only" twice in one header would be the
 * noise this whole subtraction exists to remove, so the atom ships SPLIT across the badge and
 * this line, character-complete between them.
 */
export const SPINE_ORDER_SENTENCE = "This is the order it will run in."

/**
 * `BS-MR-06` — the footer count sentence, derived entirely from the definition.
 *
 * ⚠ EVERY FIGURE IN IT IS COUNTED FROM THE PHASES IN HAND, never from a run: how many steps
 * there are, and how many of them stop for a person. A step count is an authoring fact and is
 * true before anything has ever run. ⚠ The person-gate clause is OMITTED at zero rather than
 * rendered as `0 person gates` — an absent clause says nothing, where a zero invites the
 * reader to wonder what it is counting.
 */
export function spineFooterSentence(stepCount: number, personGates: number): string {
  const steps = stepCount === 1 ? "1 step" : `${stepCount} steps`
  const lead = `${steps}, runs top to bottom`
  if (personGates === 0) return lead
  return `${lead}, ${personGates === 1 ? "one person gate" : `${personGates} person gates`}`
}

export interface PhaseSpineGraphProps {
  phases: PhaseSpecJSON[]
  /** The currently-selected phase slug (the open form anchor), or null at rest. */
  selectedSlug: string | null
  /** Selection only — NEVER reorders. Fires the clicked phase's slug. */
  onSelectNode: (slug: string) => void
  /** The page-owned folder/skill id→name maps and the definition's template filename
   *  (Phase 187 / D-187-05). Absent ⇒ every derived tier misses and the generic type
   *  sentence renders — never a fabricated or id-shaped face. */
  nameContext?: NameContext
  /**
   * Phase 200-05 (DES-02 / D-09) — THE RUN TENSE, AND IT IS OPTIONAL FOR A REASON.
   *
   * ⚠ ABSENT ⇒ THE AUTHORING RENDER IS BYTE-IDENTICAL, and that is asserted rather than
   * assumed: a case renders both ways and compares the two `innerHTML`s, and a second case
   * proves the prop is LOAD-BEARING (the present render is NOT the same DOM), copying
   * `PhaseFormPanel.rails.test.tsx:125`. Without both halves this prop could be inert and
   * nothing would say so.
   *
   * ⚠ THE AUTHORING MOUNT MUST NEVER PASS IT. This component reads a DRAFT definition; a
   * duration, an elapsed or a branch outcome on that surface is a claim about a run that has
   * not happened. `199-02` refused exactly that, and the refusal now holds by construction:
   * the only mount that supplies this prop is the run surface's, which really does hold a run.
   */
  runTense?: SpineRunTense
}

export function PhaseSpineGraph({
  phases,
  selectedSlug,
  onSelectNode,
  nameContext,
  runTense,
}: PhaseSpineGraphProps) {
  // Sort by phase_index (strict run order). The input array order is irrelevant.
  const ordered = [...phases].sort((a, b) => a.phase_index - b.phase_index)
  const slugSet = new Set(ordered.map((p) => p.slug))
  /**
   * Phase 200 (FE-WIRING) — slug → the phase itself, so a skip edge can name its TARGET.
   *
   * ⚠ THE CANVAS HAS RESOLVED THIS ALL ALONG AND THE SPINE PRINTED THE RAW SLUG.
   * `canvasModel.ts:424` hands `branchConditionOf` a `resolveName` closure built over the
   * same definition and renders the destination's `nodeTitle`; this component rendered
   * `<span className="font-mono">{edge.toSlug}</span>` — a schema token, in a mono face, to
   * a non-technical author, three centimetres from the same fact spelled properly one
   * toggle away. Same map, same resolver, so the two views cannot disagree.
   *
   * A `Map` and not an object literal: the keys are author-supplied slugs off the
   * definition JSONB, and a slug spelled `constructor` or `__proto__` is a WR-04 prototype
   * sink on a plain object (the measured `[Function Object]` React child of 188.1-04).
   * `Map.get` has no prototype chain to fall through to.
   */
  const bySlug = new Map(ordered.map((p) => [p.slug, p]))

  // Resolve the dashed on-fail edges: one per validator declaring a
  // `skip_to_phase:<slug>` whose target resolves to a real node (the only
  // non-linear edges). A phase with multiple skip validators yields multiple
  // edges, but the common case (and the locked draft shape) is one.
  const skipEdges: { fromSlug: string; toSlug: string }[] = []
  for (const phase of ordered) {
    for (const v of phase.validators ?? []) {
      const target = parseSkipTarget(v.on_failure)
      if (target && slugSet.has(target)) {
        skipEdges.push({ fromSlug: phase.slug, toSlug: target })
      }
    }
  }

  return (
    <section
      aria-label="Workflow phase spine (read-only)"
      className="flex h-full min-w-0 flex-col overflow-y-auto bg-background px-4 py-4"
    >
      {/* Header: the View-only badge — the graph offers no build affordances.
          `👁 View only` is the SHIPPED cross-surface read-only vocabulary
          (`WorkflowCanvas.tsx:1000`, `WorkflowRunPage.tsx:960` render the same two
          words), so it is not this component's to re-spell or to spend.

          Phase 199-02 (DES-01, sheet `c3-phase-spine` Col 1) — THE SECOND SPAN IS GONE,
          and the subtraction is the point. It read `NET-NEW · no graph lib`: a note about
          how this component is IMPLEMENTED, printed to the person authoring a workflow,
          at the top of the widest column. The adopted design language's third rule is
          "never name the mechanism to the user", and sketch 178's own read of this sheet
          is that the authoring column is where the "text is noise" rule drifts because it
          is the one place there is room to be lazy. The correct response to that drift is
          to CUT, not to add the sheet's two-line descriptions.

          It was safe to spend because it was load-bearing for nothing: a repo-wide grep
          measured ZERO assertions on it anywhere in `frontend/src` before it was removed,
          and its removal is proved by an INVERTED assertion in
          `PhaseSpineGraph.test.tsx`'s 199-02 inventory rather than by a deleted one. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
          👁 View only
        </span>
        {/* BS-MR-05 — the total runtime, RUN TENSE ONLY. It is already WORDED by the caller
            (`receiptVocabulary.ts`), so this component neither formats a duration nor decides
            what an unrecorded one reads as. Absent prop ⇒ this node does not exist. */}
        {runTense && (
          <span
            data-testid="spine-total-runtime"
            className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            {runTense.total}
          </span>
        )}
      </div>

      {/* BS-MR-06 / BS-MNR-01 — the plain-language order sentence, in the slot the
          machine-vocabulary legend used to occupy. Both figures below are counted from the
          definition in hand, so neither is a claim about a run. */}
      <p
        data-testid="graph-order-sentence"
        className="mb-1 text-[12px] leading-relaxed text-muted-foreground"
      >
        {SPINE_ORDER_SENTENCE}
      </p>
      <p
        data-testid="graph-footer-count"
        className="mb-4 text-[11px] leading-relaxed text-muted-foreground"
      >
        {spineFooterSentence(
          ordered.length,
          ordered.filter((p) => p.config.phase_type === "llm_human_input").length,
        )}
      </p>

      {/* The vertical spine: an <ol> of nodes; the gutter line is a ::before on each
          <li> (a solid run-order edge i→i+1, suppressed on the last node). */}
      <ol className="relative mx-auto flex w-full max-w-[680px] flex-col">
        {ordered.map((phase, i) => {
          const isLast = i === ordered.length - 1
          const isSelected = selectedSlug === phase.slug
          // The 3D mark first; the soulData slug string is NOT a glyph since Phase
          // 127, so "•" is the real visual fallback for an unmapped type.
          const Glyph = phaseGlyph(phase.config.phase_type)
          const glyphFallback = PHASE_GLYPHS[phase.config.phase_type] ?? "•"
          // Resolved ONCE and used in BOTH the visible title and the accessible
          // name, so they can never drift apart (WCAG 2.5.3 label-in-name).
          //
          // THE SPINE NO LONGER SWAPS THIS (Phase 187 / SPEC Req 4 / D-187-16). Until
          // 187-09 this line was a ternary on the ⌥ reveal, choosing the technical
          // `<type label> · <slug>` form over the plain one and mirroring the canvas
          // card's swap. (The retired expression is quoted verbatim exactly once, as the
          // positive control of the source guard in `PhaseSpineGraph.test.tsx` — a
          // control string is the one place it cannot be mistaken for live code, and it
          // keeps this file's acceptance grep for the retired form honestly at zero.)
          // The canvas moved its ⌥ reveal into the
          // card's SUBTITLE slot, because 187-04's config-derived tier makes the plain
          // title specific and the swap destroyed it (and truncated the slug it was
          // meant to reveal). This surface has NO subtitle slot to move into, so the
          // only way the two views one toggle apart can still agree is for the spine to
          // stop swapping.
          //
          // THE ASYMMETRY IS RECORDED, NOT DESIGNED AWAY, and it costs nothing because
          // this surface never hid the technical vocabulary in the first place: the mono
          // chip below prints the RAW `phase_type` unconditionally, the line beneath it
          // prints the RAW `phase_index`, and the `aria-label` carries the raw type too —
          // all three with the reveal OFF. So Req 4's "both graph views agree in both
          // toggle states" is satisfied on the TITLE, which is exactly what the SPEC's
          // acceptance criterion says. Giving the spine a subtitle consumer, or stripping
          // its raw chrome, would both grow scope into this component's layout for no
          // Req-4 gain.
          //
          // `nameContext` (D-187-05) is the page-owned id→name lookup 187-04's derived
          // tier needs; it reaches `nodeTitle` and nowhere else. Absent ⇒ every derived
          // tier misses and the generic type sentence renders, byte-identically to HEAD.
          const title = nodeTitle(phase, nameContext)
          // BS-MR-02 — the CANVAS's own word for this type, imported rather than re-spelled.
          // A second uppercase label map here would be exactly the two-views-two-languages
          // defect BS-2 exists to close, one map further down. An unmapped type falls back to
          // NOTHING rather than to the raw id: the title already says what the step is, and a
          // schema token is not a word.
          const typeWord = PHASE_TYPE_LABELS[phase.config.phase_type]
          // BS-MR-01 — the per-step model, rendered ONLY where the config declares one. An
          // absent or blank value means "use the run's model", and printing a default here
          // would be a fabricated claim (N-6). `config` is untyped JSONB at the edge, so the
          // shape is checked rather than trusted.
          const rawModel = phase.config.model
          const model = typeof rawModel === "string" && rawModel.trim().length > 0 ? rawModel.trim() : null
          // The one-line reading of what this KIND of step does — sketch 200's spine draws it
          // on every row, under the title. These are the CANVAS's own words
          // (`PHASE_TYPE_SUBTITLES`), the same map the node cards use, so the spine and the
          // canvas keep saying one thing about a step rather than two.
          const subtitle = PHASE_TYPE_SUBTITLES[phase.config.phase_type]
          // Phase 200 (FE-WIRING) — the effect banner, resolved by the SHARED total function
          // over the phase TYPE (never the capability: reaching outside is the type's one
          // invariant fact, true even of a step whose capability is unset or is a name this
          // client does not recognise — see `nodeEffectBanner.ts`). An unrecognised
          // forward-compat discriminator yields `null` and no element renders at all.
          //
          // ⚠ IT IS NOT RUN TENSE and needs no run prop: "this step changes something
          // outside" is true of the DRAFT, before anything has ever executed. That is what
          // separates it from the duration, the outcome and the branch reading on this same
          // card, all three of which stay behind `runTense`.
          const effectBanner = effectBannerFor(phase.config.phase_type)
          // Phase 200 (FE-WIRING) — the sheet's two detail lines, rendered ONLY on the
          // selected row (the sheet draws them under a dashed divider on its Step 3 card,
          // which is its selected one). Both are what the AUTHOR wrote, read back: the
          // prompt they typed and a word for the number they set. Neither is a run fact.
          //
          // ⚠ EACH IS INDEPENDENTLY ABSENT-ABLE, and the block itself disappears when both
          // are. A step with no prompt renders no prompt line — never an empty value, never
          // an em dash — because the readiness checklist is the surface that says a prompt is
          // MISSING, and a blank line beside a label says it twice in a weaker voice.
          const rawPrompt = phase.config.prompt
          const detailPrompt =
            isSelected && typeof rawPrompt === "string" && rawPrompt.trim().length > 0
              ? rawPrompt.trim()
              : null
          const detailLiteral = isSelected ? literalReading(phase.config.temperature) : null
          // ⚠ RUN TENSE ONLY. `undefined` on the authoring mount, and `undefined` for a slug
          // this run never mentioned — two absences that render identically because both mean
          // "we hold no run fact about this step", which is not a fact about the step.
          const facts = runTense?.factsOf(phase.slug)
          // The dashed on-fail edges originating at THIS node (rendered as a labeled
          // skip-branch row beneath the node; the target slug is declared for assertion).
          const outgoingSkips = skipEdges.filter((e) => e.fromSlug === phase.slug)

          return (
            <li key={phase.slug} className="relative pb-4 last:pb-0">
              {/* Run-order gutter edge (i→i+1); hidden on the last node. Sketch 200 runs it
                  DASHED and behind the cards, centred on the 56px icon rail — so the rail's
                  rings read as beads on one thread rather than as separate ornaments. */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute left-[28px] top-[34px] bottom-0 z-0 w-px border-l border-dashed border-border"
                />
              )}

              {/* The node CARD — a <button> (keyboard-selectable; selection only,
                  never draggable). No draggable attr, no drag handler. */}
              <button
                type="button"
                data-testid={`spine-node-${phase.slug}`}
                data-slug={phase.slug}
                data-phase-type={phase.config.phase_type}
                data-selected={isSelected ? "true" : "false"}
                aria-pressed={isSelected}
                // ⚠ THE ACCESSIBLE NAME CARRIES THE CANVAS'S WORD, NOT THE RAW ID (200-05,
                // BS-MNR-02). Until this plan it read `(llm_agent)`. An `aria-label` is not
                // "invisible text" — it is the text a screen-reader user receives, so a
                // subtraction that left the schema token here would have removed the chip
                // from sighted readers only. An unmapped type drops the parenthetical
                // entirely rather than falling back to the id.
                aria-label={`Phase ${phase.phase_index + 1}: ${title}${typeWord ? ` (${typeWord})` : ""}`}
                onClick={() => onSelectNode(phase.slug)}
                className={[
                  "group flex w-full overflow-hidden rounded border text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
                    : "border-border bg-card hover:bg-accent/40",
                ].join(" ")}
              >
                {/* The icon rail — sketch 200 gives every spine row a bordered 56px gutter
                    holding the step's glyph in a small ring. It is what makes the row read as
                    a CARD rather than a list item. */}
                <span
                  aria-hidden="true"
                  className="flex w-14 shrink-0 justify-center border-r border-border bg-muted/30 pt-4"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
                    {Glyph ? <Glyph className="h-3.5 w-3.5" /> : glyphFallback}
                  </span>
                </span>

                {/* The content column — three stacked lines, exactly the sheet's order:
                    title + model on one baseline, then the plain-language reading, then the
                    type badge on its own line. */}
                <span className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                  <span className="flex w-full items-baseline justify-between gap-4">
                    <span
                      data-testid="node-title"
                      className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground"
                    >
                      {title}
                    </span>
                    {/* BS-MR-01 — the model, only where one was declared. An absent value
                        means "use the run's model", and printing a default here would be a
                        fabricated claim (N-6). */}
                    {model && (
                      <span
                        data-testid="node-model"
                        className="shrink-0 font-mono text-[11px] text-muted-foreground"
                      >
                        {model}
                      </span>
                    )}
                  </span>

                  {/* The one-line reading of the step kind. */}
                  {subtitle && (
                    <span
                      data-testid="node-subtitle"
                      className="block w-full truncate text-[12px] text-muted-foreground"
                    >
                      {subtitle}
                    </span>
                  )}

                  {/* BS-MR-02 — the canvas's word, uppercased by CSS rather than by a second
                      string, so there is still exactly ONE spelling of this label in the tree.

                      Phase 200 (FE-WIRING) — THE BANNER TAKES THIS SLOT WHEN IT FIRES, and the
                      type chip stands down rather than sitting beside it. That is the sheet's
                      own composition (`builder-spine.html:420-427` draws its two connector rows
                      with the warning chip and NO type chip), and it is right for a reason the
                      sheet does not have to state: `PHASE_TYPE_LABELS.external_action` reads
                      `External action`, so the two chips side by side would spell one fact
                      twice — in two registers, in the same 10px face, on the same line. This
                      tree calls that the defect, repeatedly and by name.

                      ⚠ NOTHING IS LOST TO A SCREEN READER. The node's `aria-label` carries the
                      type word unconditionally, one element up, so the swap is a VISIBLE-chip
                      swap and not a subtraction from the accessible name. And `data-phase-type`
                      still carries the raw id for a machine, as it always has. */}
                  {effectBanner ? (
                    <span className="flex items-center">
                      <span
                        data-testid="node-effect-banner"
                        className="rounded border border-warning/20 bg-warning/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-warning"
                      >
                        {effectBanner}
                      </span>
                    </span>
                  ) : typeWord ? (
                    <span className="flex items-center">
                      <span
                        data-testid="node-type-word"
                        className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary"
                      >
                        {typeWord}
                      </span>
                    </span>
                  ) : null}
                  {/* BS-MR-04 — the per-step reading. ⚠ RUN TENSE ONLY: absent prop ⇒ absent
                      node. ONE reading per row (D-09's own shape), and a step that declared no
                      count renders no count slot AT ALL — never `0`, never a dash, never prose
                      (D-07 / N-8). A declared `0` renders as the fact it is. */}
                  {facts && (
                    <span
                      data-testid="node-run-reading"
                      data-outcome={facts.outcome}
                      className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground"
                    >
                      <span data-testid="node-run-time">{facts.timing.reading}</span>
                      {facts.count && (
                        <span data-testid="node-run-count">
                          {countDeclared(facts.count.count, facts.count.noun)}
                        </span>
                      )}
                    </span>
                  )}

                  {/* Phase 200 (FE-WIRING) — THE SELECTED ROW'S DETAIL BLOCK, under the
                      sheet's dashed divider (`builder-spine.html:329-339`).

                      ⚠ IT IS AUTHORING TENSE, NOT RUN TENSE, and that is why it needs no run
                      prop and is not gated behind one. Both lines are what the AUTHOR wrote,
                      read back to them: the prompt they typed, and a word for the number they
                      set. `199-02` refused run-tense atoms on this surface — a duration, an
                      outcome, a branch verdict — because a draft has no run to make them true
                      of. A prompt is true of the draft.

                      ⚠ SELECTED ONLY. The sheet draws it on ONE card of eight, its selected
                      one. Rendering a prompt on every row would turn a spine of eight steps
                      into eight paragraphs and destroy the scan the whole component is for —
                      and it would put the panel's own content on the panel's own anchor.

                      ⚠ EACH LINE IS INDEPENDENTLY ABSENT, and the block itself does not render
                      when both are. A step with no prompt gets NO prompt line — never a blank
                      value, never an em dash, never `Not set`. The readiness checklist
                      (`stepReadinessContext.stepGaps`) is the surface licensed to say a prompt
                      is MISSING; a labelled empty line says the same thing in a weaker voice
                      and in a second place.

                      NOT A CONTROL: two `<span>`s in a `<div>`-free column. One tab stop per
                      node is this component's invariant and the detail block is not an
                      exception to it — the card is already a `<button>` and this renders
                      inside it, so an interactive child would be a nested-interactive DOM
                      error as well as a second tab stop. */}
                  {(detailPrompt || detailLiteral) && (
                    <span
                      data-testid="node-detail"
                      className="mt-1 flex flex-col gap-3 border-t border-dashed border-border pt-3"
                    >
                      {detailPrompt && (
                        <span className="flex flex-col gap-1">
                          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {SPINE_DETAIL_PROMPT_LABEL}
                          </span>
                          <span
                            data-testid="node-detail-prompt"
                            className="line-clamp-3 text-[12px] leading-relaxed text-foreground"
                          >
                            {detailPrompt}
                          </span>
                        </span>
                      )}
                      {detailLiteral && (
                        <span className="flex flex-col gap-1">
                          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {SPINE_DETAIL_LITERAL_LABEL}
                          </span>
                          <span
                            data-testid="node-detail-literal"
                            className="text-[12px] leading-relaxed text-foreground"
                          >
                            {detailLiteral}
                          </span>
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </button>

              {/* The dashed on-fail skip branch label(s). The ONLY non-linear edge. */}
              {outgoingSkips.map((edge) => {
                /**
                 * Phase 200 (FE-WIRING) — THE TARGET'S NAME, not its slug.
                 *
                 * The resolver has shipped since 187 and the CANVAS has used it all along
                 * (`canvasModel.ts:424` → `branchConditionOf(phase, resolveName)` → the
                 * destination's `nodeTitle`). This row printed `edge.toSlug` in a mono face:
                 * a schema token, to a non-technical author, naming the same step the canvas
                 * names properly one toggle away. Same map, same resolver, so the two views
                 * cannot now disagree about where a branch goes.
                 *
                 * ⚠ THE SLUG IS THE FALLBACK, AND IT IS NOT A FABRICATION. `nodeTitle` is
                 * total but its floor is `PHASE_TYPE_SENTENCES[type] ?? type`, which is the
                 * EMPTY STRING for a phase carrying neither a name, nor a derivable face, nor
                 * a recognised type. An empty destination would read `on fail → skip to `,
                 * which says less than the slug does. So an empty resolution keeps today's
                 * behaviour rather than degrading past it — the slug is real stored data, not
                 * an invented value, and `data-target-slug` carries it for a machine either
                 * way.
                 *
                 * ⚠ AND THE FALLBACK KEEPS THE MONO FACE while a resolved NAME does not. A
                 * mono face is how this tree marks a machine identifier; painting a person's
                 * own words in it would say "this is a token" about a sentence they wrote.
                 */
                const targetTitle = (() => {
                  const target = bySlug.get(edge.toSlug)
                  if (target === undefined) return null
                  const resolved = nodeTitle(target, nameContext)
                  return resolved.length > 0 ? resolved : null
                })()

                return (
                <div
                  key={`${edge.fromSlug}->${edge.toSlug}`}
                  data-testid="skip-edge"
                  data-from-slug={edge.fromSlug}
                  data-target-slug={edge.toSlug}
                  className="mt-1.5 ml-1 flex items-center gap-1.5 border-l-2 border-dashed border-amber-500/70 pl-2 text-[11px] text-amber-600 dark:text-amber-400"
                >
                  <span aria-hidden="true">⤳</span>
                  <span>
                    on fail → skip to{" "}
                    {targetTitle === null ? (
                      <span className="font-mono font-medium">{edge.toSlug}</span>
                    ) : (
                      <span data-testid="skip-edge-target" className="font-medium">
                        {targetTitle}
                      </span>
                    )}
                  </span>
                  {/* BS-MR-03 — the branch reading. ⚠ RUN TENSE ONLY, and it is a THREE-state
                      read, not a boolean: `undefined` means the caller does not hold the fact
                      and nothing renders, which is not the same as "the run did not take it".
                      On a DRAFT this sentence would be a fabricated claim — 199-02 refused
                      exactly that — so it is unreachable without the run prop. The checklist's
                      two machine tokens survive on `data-branch-reading` for a driven
                      verifier; the WORDS are product English, because the adopted design
                      language's third rule is never to name the mechanism to the reader. */}
                  {typeof facts?.branchTaken === "boolean" && (
                    <span
                      data-testid="skip-edge-reading"
                      data-branch-reading={facts.branchTaken ? "traversed" : "skipped"}
                      className="font-medium"
                    >
                      {branchReading(facts.branchTaken)}
                    </span>
                  )}
                </div>
                )
              })}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default PhaseSpineGraph
