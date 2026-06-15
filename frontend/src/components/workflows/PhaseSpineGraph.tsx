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
 * definition JSON). It shares only the phase-type glyph vocabulary by value.
 *
 * The static drag-free invariant (REQ-4 acceptance c) is structural: every node
 * is a `<button>` (keyboard-selectable), there is NO `draggable` attribute, NO
 * drag handler (onDragStart / onPointerDown drag), NO connection handle, and NO
 * add-node control anywhere in the DOM. Selection NEVER reorders — clicking a
 * node only fires `onSelectNode(slug)`.
 */

/** The phase-type glyph vocabulary (mirrors the run-surface glyphs by VALUE — not
 *  by import; the 6th `◆` llm_emit deliverable is net-new per sketch 019-D D9). */
const PHASE_GLYPHS: Record<string, string> = {
  programmatic: "⚙",
  llm_single: "✎",
  llm_agent: "🤖",
  llm_batch_agents: "⛓",
  llm_human_input: "☺",
  llm_emit: "◆",
}

/** A human label for a phase type (the node-title fallback when `phase.name` is absent). */
const PHASE_TYPE_LABELS: Record<string, string> = {
  programmatic: "Server step",
  llm_single: "AI write step",
  llm_agent: "AI agent step",
  llm_batch_agents: "Parallel agents",
  llm_human_input: "Needs you",
  llm_emit: "Deliverable",
}

/** The verbatim read-only legend (locked contract — sketch 019-D / 103-PLAN). */
export const READ_ONLY_LEGEND =
  "READ-ONLY GRAPH · ordered by phase_index · run order (i→i+1) · " +
  "on-fail branch (skip_to_phase) · no depends_on · no parallel lanes · inspect, don't drag"

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

/**
 * Resolve the target slug of a `skip_to_phase:<slug>` on_failure value, mirroring
 * the backend `parse_skip_target` (reachability.py): split on the LAST ":" and
 * return the trailing slug. Returns null for any non-skip on_failure value.
 */
export function parseSkipTarget(onFailure: string | undefined | null): string | null {
  if (!onFailure || !onFailure.startsWith("skip_to_phase:")) return null
  const idx = onFailure.lastIndexOf(":")
  const slug = onFailure.slice(idx + 1).trim()
  return slug.length > 0 ? slug : null
}

/** The node title: phase.name if present, else a non-empty fallback (type label · slug). */
function nodeTitle(phase: PhaseSpecJSON): string {
  const name = phase.name?.trim()
  if (name) return name
  const label = PHASE_TYPE_LABELS[phase.config.phase_type] ?? phase.config.phase_type
  return `${label} · ${phase.slug}`
}

export interface PhaseSpineGraphProps {
  phases: PhaseSpecJSON[]
  /** The currently-selected phase slug (the open form anchor), or null at rest. */
  selectedSlug: string | null
  /** Selection only — NEVER reorders. Fires the clicked phase's slug. */
  onSelectNode: (slug: string) => void
}

export function PhaseSpineGraph({ phases, selectedSlug, onSelectNode }: PhaseSpineGraphProps) {
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
          const glyph = PHASE_GLYPHS[phase.config.phase_type] ?? "●"
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
                {glyph}
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
                aria-label={`Phase ${phase.phase_index + 1}: ${nodeTitle(phase)} (${phase.config.phase_type})`}
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
                    {glyph}
                  </span>
                  <span
                    data-testid="node-title"
                    className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground"
                  >
                    {nodeTitle(phase)}
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
