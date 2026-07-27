/**
 * Phase 183-05 Task 1 (CANVAS-01, D-183-10 / D-183-11 / D-183-12, correction C-2) —
 * canvasModel.
 *
 * THE PROJECTION. `toCanvas` turns a workflow definition's `phases[]` into the
 * `{ nodes, edges }` the read-only canvas draws. It is a PURE function of the
 * definition ALONE (D-183-12): same phases in ⇒ byte-identical nodes and edges out.
 * No DOM read, no measurement, no network, no clock, no randomness, no mutation of
 * the input, no two-pass render. That is what makes SC#2 and SC#4 provable with a
 * plain snapshot instead of a browser.
 *
 * WHAT AN EDGE IS — the one line that carries this phase. The sequential edge is the
 * phase whose `phase_index` is EXACTLY +1, found by LOOKUP:
 * `byIndexValue.get(p.phase_index + 1)`. That mirrors the server's reachability
 * adjacency (`backend/app/services/harness/reachability.py:162-169`) line-for-line,
 * including its explicit note that a gap CANNOT be bridged. The obvious alternative —
 * sort the array and walk consecutive positions — draws `0→1→3` for `phase_index
 * [0,1,3]`, a PHANTOM EDGE the linter does not have and G-6 names as a failure. The
 * picture would then lie about what will actually run.
 *
 * WHAT THIS MODULE DOES NOT DO. It takes no selection argument and no
 * technical-names argument: selection is applied by the view (plan 183-06) and BOTH
 * title forms ride on every node so the ⌥ reveal is a render-time choice. Arrow
 * markers, edge styling and node chrome belong to the view too — only TYPES are
 * imported from the canvas library here, so the model stays library-agnostic at
 * runtime. Layout is computed and NEVER persisted: no `position` / `x` / `y` /
 * `layout` key is ever written back onto a definition object (Pitfall 3 — a leaked
 * key would 422 against the backend's `extra="forbid"`). And nothing is fetched: the
 * canvas draws with zero network round trips (D-183-15; the server verdict seam
 * arrives with Phase 184).
 *
 * HEIGHT IS A CSS PROBLEM, NOT A MEASUREMENT PROBLEM. Sketch 136 measured rendered
 * node heights to avoid clipping gate-heavy cards. This model does not: every node is
 * one uniform width, the card grows DOWNWARD, and handles anchor at a fixed
 * `EDGE_ANCHOR_Y` offset from the node top rather than at 50%, so a taller card never
 * moves the edge baseline (183-06 owns that CSS).
 */
import type { Edge, Node } from "@xyflow/react"

import {
  groundingFor,
  nodeTitle,
  parseSkipTarget,
  technicalTitle,
  waitsForYou,
  PHASE_TYPE_SUBTITLES,
  type Grounding,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"

// ── The layout constants ────────────────────────────────────────────────────────

/**
 * CANVAS_LAYOUT — ONE frozen table, the `deriveTier.ts:57-79` const-table idiom. Every
 * placement number in this module reads from here and plan 183-06's CSS agrees with
 * the SAME table, so a stray literal cannot creep into either half.
 *
 * `PITCH_X` is chosen so UAT row U-2 passes by construction: the 5-phase maximum
 * (`eval_coverage`) spans `4 * 320 + 260 = 1,540px`, inside sketch 136-B's measured
 * ~1,600px budget.
 */
export const CANVAS_LAYOUT = {
  /** Uniform node width — every card is the same width; content wraps, never widens. */
  NODE_WIDTH: 260,
  /** The floor a card may not shrink below; it grows DOWNWARD from here. */
  NODE_MIN_HEIGHT: 96,
  /** Horizontal distance between two adjacent phase columns. */
  PITCH_X: 320,
  /** The single spine lane every phase node sits on. */
  LANE_Y: 0,
  /** The lane below the spine where an unresolved-skip stub is parked. */
  SKIP_LANE_Y: 200,
  /** Handle offset from the node TOP (never 50%) — a taller card keeps its baseline. */
  EDGE_ANCHOR_Y: 28,
  /** The ○ end cap's square size. */
  END_CAP_SIZE: 40,
} as const satisfies Record<string, number>

// ── The node / edge vocabulary (183-06's `nodeTypes` map must match exactly) ─────

/** The three node `type` strings the view maps through `nodeTypes`. */
export const CANVAS_NODE_TYPES = {
  phase: "phase",
  unresolvedSkip: "unresolvedSkip",
  endCap: "endCap",
} as const

/** The three edge kinds, carried on `edge.data.kind` (styling is the view's job). */
export const CANVAS_EDGE_KINDS = {
  /** The run-order `phase_index + 1` link. */
  flow: "flow",
  /** A parsed `skip_to_phase` on-fail branch (resolved OR broken). */
  skip: "skip",
  /** The terminal phase → the ○ end cap. */
  end: "end",
} as const

export type CanvasEdgeKind = (typeof CANVAS_EDGE_KINDS)[keyof typeof CANVAS_EDGE_KINDS]

// ── The node data shapes ────────────────────────────────────────────────────────
//
// The explicit `[k: string]: unknown` index signature on each data interface is NOT
// laziness: @xyflow/react v12 constrains node data to `Record<string, unknown>`, and a
// plain interface does not satisfy that constraint without one. Declared once per
// shape, deliberately, rather than widening the whole model to `any`.

/** Everything a phase card needs to render, resolved once, at projection time. */
export interface PhaseNodeData {
  slug: string
  phaseIndex: number
  phaseType: string
  /** The plain-language business sentence (D-183-06) — the DEFAULT face. */
  title: string
  /** The ⌥ Technical-names form, `"<label> · <slug>"` — always emitted, shown on demand. */
  technicalTitle: string
  /** The one supporting line; empty string for a type we do not know. */
  subtitle: string
  /** Badge slot 1 (D-183-07) — always present. */
  grounding: Grounding
  /** Badge slot 2 — true ONLY on `llm_human_input`. */
  waitsForYou: boolean
  [k: string]: unknown
}

/** The honest broken-reference marker (D-183-10) — what the definition DECLARES. */
export interface UnresolvedSkipNodeData {
  /** The slug the `on_failure` names but that no phase provides. */
  declaredTarget: string
  /** The phase that declared it. */
  fromSlug: string
  [k: string]: unknown
}

/** The ○ end cap carries no data — it is pure punctuation. */
export type EndCapNodeData = Record<string, unknown>

export type PhaseCanvasNode = Node<PhaseNodeData, typeof CANVAS_NODE_TYPES.phase>
export type UnresolvedSkipCanvasNode = Node<
  UnresolvedSkipNodeData,
  typeof CANVAS_NODE_TYPES.unresolvedSkip
>
export type EndCapCanvasNode = Node<EndCapNodeData, typeof CANVAS_NODE_TYPES.endCap>

/** A node the canvas draws. Only `"phase"` nodes correspond to a `PhaseSpec`. */
export type CanvasNode = PhaseCanvasNode | UnresolvedSkipCanvasNode | EndCapCanvasNode

export interface CanvasEdgeData extends Record<string, unknown> {
  kind: CanvasEdgeKind
}

/** An edge the canvas draws. `data.kind` is the whole classification. */
export type CanvasEdge = Edge<CanvasEdgeData>

export interface CanvasProjection {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

// ── Internal helpers (all pure) ─────────────────────────────────────────────────

/** The reserved-id namespace. `PhaseSpec.slug` is an unconstrained `str` on the
 *  backend (`app/models/harness.py:190`), so a slug CAN spell one of these. */
const RESERVED_PREFIX = "__canvas__"

/**
 * Build a reserved node id that provably cannot collide with a real slug: prefix,
 * then keep prepending `_` while the candidate is taken. Deterministic (no counter,
 * no randomness), so the same definition always yields the same id.
 */
function reservedId(suffix: string, taken: ReadonlySet<string>): string {
  let id = `${RESERVED_PREFIX}${suffix}`
  while (taken.has(id)) id = `_${id}`
  return id
}

/**
 * The accessible name, one sentence: position, title, then the raw phase type in
 * parentheses — the shipped `PhaseSpineGraph.tsx` label shape, so the two views one
 * toggle apart cannot announce a phase differently. The PLAIN-language title is used
 * here; the view may override the rendered label under the ⌥ reveal.
 */
function ariaLabelFor(phase: PhaseSpecJSON, title: string): string {
  return `Phase ${phase.phase_index + 1}: ${title} (${phase.config.phase_type})`
}

/** Resolve every face value a phase card needs, once. */
function buildPhaseData(phase: PhaseSpecJSON): PhaseNodeData {
  const phaseType = phase.config.phase_type
  return {
    slug: phase.slug,
    phaseIndex: phase.phase_index,
    phaseType,
    title: nodeTitle(phase),
    technicalTitle: technicalTitle(phase),
    subtitle: PHASE_TYPE_SUBTITLES[phaseType] ?? "",
    grounding: groundingFor(phase),
    waitsForYou: waitsForYou(phase),
  }
}

// ── The projection ──────────────────────────────────────────────────────────────

/**
 * Project a definition's phases onto the canvas.
 *
 * PURE (D-183-12). The input array is never mutated — `[...phases].sort(...)` is the
 * shipped non-mutating idiom (`PhaseSpine.tsx:38-40`) and the sort comparator is
 * TOTAL (index, then slug) so even duplicate `phase_index` values order
 * deterministically regardless of the caller's array order.
 *
 * An empty definition returns empty arrays: no end cap, no ghost node, no chrome
 * (D-183-11 — the single most common canvas state).
 */
export function toCanvas(phases: PhaseSpecJSON[]): CanvasProjection {
  const nodes: CanvasNode[] = []
  const edges: CanvasEdge[] = []

  if (!phases || phases.length === 0) return { nodes, edges }

  // Total, order-independent ordering: phase_index first, slug as the tiebreak.
  const ordered = [...phases].sort(
    (a, b) => a.phase_index - b.phase_index || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  )

  const bySlug = new Map(ordered.map((p) => [p.slug, p]))
  const byIndexValue = new Map(ordered.map((p) => [p.phase_index, p]))
  const columnOf = new Map(ordered.map((p, col) => [p.slug, col]))
  const slugSet = new Set(ordered.map((p) => p.slug))

  // (0) PHASE NODES — one per phase, id === slug (SC#3). `llm_batch_agents` gets ONE
  // node: the ×N fan-out is a RUNTIME behaviour, not topology, and drawing N lanes
  // would disagree with the server's adjacency.
  for (const [col, phase] of ordered.entries()) {
    const data = buildPhaseData(phase)
    nodes.push({
      id: phase.slug,
      type: CANVAS_NODE_TYPES.phase,
      position: { x: col * CANVAS_LAYOUT.PITCH_X, y: CANVAS_LAYOUT.LANE_Y },
      data,
      draggable: false,
      ariaRole: "button",
      ariaLabel: ariaLabelFor(phase, data.title),
    })
  }

  const emittedEdgeIds = new Set<string>()
  const emittedStubIds = new Set<string>()
  const pushEdge = (edge: CanvasEdge) => {
    if (emittedEdgeIds.has(edge.id)) return
    emittedEdgeIds.add(edge.id)
    edges.push(edge)
  }

  for (const phase of ordered) {
    // (1) SEQUENTIAL — the phase whose phase_index is EXACTLY +1, by LOOKUP.
    // reachability.py:164 does precisely this. A gap therefore yields NO bridging
    // edge, and the phase after the gap is honestly left as an orphan.
    const successor = byIndexValue.get(phase.phase_index + 1)
    if (successor !== undefined && successor.slug !== phase.slug) {
      pushEdge({
        id: `seq:${phase.slug}->${successor.slug}`,
        source: phase.slug,
        target: successor.slug,
        data: { kind: CANVAS_EDGE_KINDS.flow },
      })
    }

    // (2) SKIP — one per validator declaring `skip_to_phase:<slug>`.
    for (const validator of phase.validators ?? []) {
      const target = parseSkipTarget(validator?.on_failure)
      if (target === null) continue

      if (bySlug.has(target)) {
        pushEdge({
          id: `skip:${phase.slug}->${target}`,
          source: phase.slug,
          target,
          data: { kind: CANVAS_EDGE_KINDS.skip },
        })
        continue
      }

      // D-183-10 — the target does not exist. The shipped spine DROPS this edge
      // silently (`slugSet.has(target)` filter); migration 065 lost a real gate for
      // exactly that reason. Render it instead as a visibly broken reference: a stub
      // node that terminates the edge. The edge lands on an emitted id (so it is not
      // a phantom edge) and it does not lie about what the definition declares. This
      // agrees with the backend's UNSATISFIABLE_SKIP verdict (reachability.py:147-156).
      const stubId = reservedId(`unresolved:${phase.slug}:${target}`, slugSet)
      if (!emittedStubIds.has(stubId)) {
        emittedStubIds.add(stubId)
        const col = columnOf.get(phase.slug) ?? 0
        nodes.push({
          id: stubId,
          type: CANVAS_NODE_TYPES.unresolvedSkip,
          position: {
            x: col * CANVAS_LAYOUT.PITCH_X + CANVAS_LAYOUT.PITCH_X / 2,
            y: CANVAS_LAYOUT.SKIP_LANE_Y,
          },
          data: { declaredTarget: target, fromSlug: phase.slug },
          draggable: false,
          selectable: false,
          focusable: false,
          // …and not activatable, so it must not inherit the "press enter to open this
          // step's details" description the library attaches to every node.
          domAttributes: { "aria-describedby": undefined },
        })
      }
      pushEdge({
        id: `skip:${phase.slug}->?${target}`,
        source: phase.slug,
        target: stubId,
        data: { kind: CANVAS_EDGE_KINDS.skip },
      })
    }
  }

  // (3) END CAP — sketch 136: every flow ends in an explicit ○ cap, never a dangling
  // stub. EXACTLY ONE cap, fed by the phase with the MAXIMUM phase_index (the last of
  // the total ordering). On a gap this deliberately leaves the pre-gap phase with no
  // outgoing edge — the honest picture of an orphan; a second cap would falsely imply
  // that phase ends the flow.
  const terminal = ordered[ordered.length - 1]
  const capId = reservedId("end", slugSet)
  nodes.push({
    id: capId,
    type: CANVAS_NODE_TYPES.endCap,
    position: { x: ordered.length * CANVAS_LAYOUT.PITCH_X, y: CANVAS_LAYOUT.LANE_Y },
    data: {},
    draggable: false,
    selectable: false,
    focusable: false,
    // …and not activatable, so it must not inherit the "press enter to open this
    // step's details" description the library attaches to every node.
    domAttributes: { "aria-describedby": undefined },
  })
  pushEdge({
    id: `end:${terminal.slug}->${capId}`,
    source: terminal.slug,
    target: capId,
    data: { kind: CANVAS_EDGE_KINDS.end },
  })

  return { nodes, edges }
}

// ── The inverse: the ONE canvas-to-definition serializer (R2) ────────────────────

/**
 * Phase 184-05 Task 1 (R2, D-184-17) — `fromCanvas`, the ONE client serializer.
 * It lands in this module and nowhere else.
 *
 * PURE (D-183-12), exactly as `toCanvas` is: no DOM read, no measurement, no clock,
 * no randomness, no network, no mutation of either input. It reads `node.id` and node
 * ORDER, and nothing else — never a node's computed layout, never its resolved face
 * data. Both of those are RENDER products; neither is authored information.
 *
 * CARRY-THROUGH BY REFERENCE, NEVER A RECONSTRUCTION. The returned array holds the
 * SAME `PhaseSpecJSON` objects the caller passed in as `source`. That is not an
 * optimisation — it is the only shape that can satisfy R2. `toCanvas` reads exactly
 * six things off a phase and DROPS everything else: `config.prompt`,
 * `config.available_tools`, `config.skill_snapshot`, `config.merge_strategy` and
 * `validators[].timing` are five of roughly twenty such fields that exist in the
 * definition and appear nowhere on a node. A field-by-field rebuild would
 * re-materialise Pydantic defaults where the source carried ABSENCE, and would
 * silently drop every field nobody remembered to copy — i.e. it would lose real
 * authored data the moment the user saved. Handing back the same object makes that
 * entire class of failure unrepresentable, and reference identity (`toBe`) is a
 * strictly stronger proof than any deep compare.
 *
 * IT NEVER RENUMBERS. Contiguous `[0..n-1]` renumbering is `definitionOps.renumber`'s
 * job, applied AFTER a structural edit. Two homes for one rule is exactly the drift
 * Wave 0 exists to prevent — and a `fromCanvas` that renumbered would turn the
 * shipped `indexGap` fixture's `[0, 1, 3]` into `[0, 1, 2]`, failing its own identity
 * property against a fixture already committed to this repo.
 *
 * DIVISION OF LABOUR, stated so neither home grows a second copy of the other's rule:
 * `fromCanvas` is the sole CANVAS→DEFINITION serializer; `definitionOps` is the sole
 * DEFINITION→DEFINITION mutation home.
 *
 * DUPLICATE SLUGS FAIL SAFE. `PhaseSpec.slug` is an unconstrained `str` on the backend
 * (see `RESERVED_PREFIX` above, which exists for the same reason), so two phases CAN
 * share one. A slug-keyed map collapses them, and walking the nodes would then hand
 * back fewer phases than the user authored. Losing a step on save is the worst failure
 * available here, so a collision is detected and the source is handed back untouched
 * instead — never lossy, even on a shape the app cannot otherwise draw honestly.
 *
 * NO EDGE ARGUMENT (RESEARCH open question 1, resolved). Edges carry zero AUTHORED
 * information in this phase: the run-order link is derived from `phase_index`, the
 * branch link from `validators[].on_failure`, and neither free wiring nor
 * `skip_to_phase` authoring is in scope. A future phase that wants topology authored
 * from a drawn connection must make that argument explicitly rather than inherit it by
 * accident. `canvasModel.purity.test.ts` pins "reads no edge", "never renumbers" and
 * "reads no position" as source guards over this function's own slice.
 *
 * NOT A CONTRADICTION with `canvasModel.purity.test.ts:74-83`. That shipped assertion —
 * "does not hand back a reference to any input phase object" — is about the NODE DATA
 * `toCanvas` builds: a node's `data` must be a freshly resolved face, never an alias of
 * the phase or its config, or the view could mutate the definition through it.
 * `fromCanvas` deliberately returns the phases THEMSELVES. Different value, different
 * claim; both hold at once.
 */
export function fromCanvas(
  nodes: readonly CanvasNode[],
  source: readonly PhaseSpecJSON[],
): PhaseSpecJSON[] {
  const bySlug = new Map(source.map((p) => [p.slug, p]))

  // The fail-safe branch. A collapsed map means the caller's phases do not have
  // distinct identities, so no node walk can reproduce them faithfully.
  if (bySlug.size !== source.length) return [...source]

  const out: PhaseSpecJSON[] = []
  for (const node of nodes) {
    // Only phase nodes correspond to a PhaseSpec. The end cap and the
    // broken-reference stub carry reserved ids and model nothing in the definition.
    if (node.type !== CANVAS_NODE_TYPES.phase) continue
    const phase = bySlug.get(node.id)
    if (phase !== undefined) out.push(phase)
  }
  return out
}
