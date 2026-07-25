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
 *     the slug stays REVEALABLE through the app-wide ⌥ Technical-names state
 *     (D-183-08). The spine is a leaf CONSUMER of that state — the control ships in
 *     Settings, the operator band and (from 183) the canvas header, never here, so
 *     two controls can never disagree.
 */
import { PHASE_GLYPHS } from "@/components/workflows/soulData"
import {
  nodeTitle,
  parseSkipTarget,
  technicalTitle,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"
import { phaseGlyph } from "@/lib/phaseGlyph"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"

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
}

export function PhaseSpineGraph({ phases, selectedSlug, onSelectNode }: PhaseSpineGraphProps) {
  // D-183-08 — the app-wide ⌥ Technical-names reveal, read (never owned) here. The
  // OPTIONAL accessor is deliberate: outside a provider it returns null and the
  // spine falls back to plain language, so this component still renders in a
  // provider-less unit test. The canvas (183-06) reads the SAME state with the SAME
  // fallback ordering, which is what makes a Spine/Canvas title disagreement
  // structurally impossible.
  const showTechnical = useTechnicalNamesOptional()?.showTechnical ?? false

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
      {/* Header: the View-only badge — the graph offers no build affordances. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
          👁 View only
        </span>
        <span className="text-[11px] text-muted-foreground">
          NET-NEW · no graph lib
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
          const title = showTechnical ? technicalTitle(phase) : nodeTitle(phase)
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
