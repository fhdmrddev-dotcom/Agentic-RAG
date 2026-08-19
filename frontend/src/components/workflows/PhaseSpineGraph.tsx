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
 */
import { PHASE_GLYPHS } from "@/components/workflows/soulData"
import {
  nodeTitle,
  parseSkipTarget,
  type NameContext,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"
import { phaseGlyph } from "@/lib/phaseGlyph"

/** The verbatim read-only legend (locked contract — sketch 019-D / 103-PLAN). */
export const READ_ONLY_LEGEND =
  "READ-ONLY GRAPH · ordered by phase_index · run order (i→i+1) · " +
  "on-fail branch (skip_to_phase) · no depends_on · no parallel lanes · inspect, don't drag"

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
}

export function PhaseSpineGraph({
  phases,
  selectedSlug,
  onSelectNode,
  nameContext,
}: PhaseSpineGraphProps) {
  // Sort by phase_index (strict run order). The input array order is irrelevant.
  const ordered = [...phases].sort((a, b) => a.phase_index - b.phase_index)
  const slugSet = new Set(ordered.map((p) => p.slug))

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
      </div>

      {/* The verbatim read-only legend (run order, no depends_on, inspect-don't-drag). */}
      <p
        data-testid="graph-legend"
        className="mb-4 font-mono text-[11px] leading-relaxed text-muted-foreground"
      >
        {READ_ONLY_LEGEND}
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
          const isEmit = phase.config.phase_type === "llm_emit"
          // The dashed on-fail edges originating at THIS node (rendered as a labeled
          // skip-branch row beneath the node; the target slug is declared for assertion).
          const outgoingSkips = skipEdges.filter((e) => e.fromSlug === phase.slug)

          return (
            <li key={phase.slug} className="relative pb-4 pl-9 last:pb-0">
              {/* Solid run-order gutter edge (i→i+1); hidden on the last node. */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute left-[13px] top-[34px] bottom-0 w-0.5 bg-border"
                />
              )}

              {/* The node bullet (the spine glyph). */}
              <span
                aria-hidden="true"
                className={[
                  "absolute left-0 top-1 grid h-[26px] w-[26px] place-items-center rounded-full border font-mono text-[13px]",
                  isEmit
                    ? "border-accent-violet text-accent-violet"
                    : "border-border text-foreground",
                  isSelected ? "ring-2 ring-primary" : "",
                ].join(" ")}
              >
                {Glyph ? <Glyph className="h-4 w-4" /> : glyphFallback}
              </span>

              {/* The node CARD — a <button> (keyboard-selectable; selection only,
                  never draggable). No draggable attr, no drag handler. */}
              <button
                type="button"
                data-testid={`spine-node-${phase.slug}`}
                data-slug={phase.slug}
                data-phase-type={phase.config.phase_type}
                data-selected={isSelected ? "true" : "false"}
                aria-pressed={isSelected}
                aria-label={`Phase ${phase.phase_index + 1}: ${title} (${phase.config.phase_type})`}
                onClick={() => onSelectNode(phase.slug)}
                className={[
                  "w-full rounded-md border px-3 py-2 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
                    : "border-border bg-card hover:border-primary/40",
                ].join(" ")}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-[13px] leading-none">
                    {Glyph ? <Glyph className="h-4 w-4" /> : glyphFallback}
                  </span>
                  <span
                    data-testid="node-title"
                    className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground"
                  >
                    {title}
                  </span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {phase.config.phase_type}
                  </span>
                </span>
                <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                  phase_index {phase.phase_index}
                </span>
              </button>

              {/* The dashed on-fail skip branch label(s). The ONLY non-linear edge. */}
              {outgoingSkips.map((edge) => (
                <div
                  key={`${edge.fromSlug}->${edge.toSlug}`}
                  data-testid="skip-edge"
                  data-from-slug={edge.fromSlug}
                  data-target-slug={edge.toSlug}
                  className="mt-1.5 ml-1 flex items-center gap-1.5 border-l-2 border-dashed border-amber-500/70 pl-2 text-[11px] text-amber-600 dark:text-amber-400"
                >
                  <span aria-hidden="true">⤳</span>
                  <span>
                    on fail → skip to <span className="font-mono font-medium">{edge.toSlug}</span>
                  </span>
                </div>
              ))}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default PhaseSpineGraph
