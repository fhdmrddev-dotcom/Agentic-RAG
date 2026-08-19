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

// Type-only, and that is required rather than stylistic: this module is the PURE
// projection (D-183-12) and must stay free of any runtime dependency that could make the
// committed snapshot depend on view state. `connectionState.ts` is a true leaf anyway,
// but the type-only form is what makes the independence structural.
import type { ConnectionState } from "@/components/workflows/connectionState"
import {
  actionRiskArmed,
  branchConditionOf,
  groundingCauseOf,
  nodeTitle,
  notConnectedOf,
  parseSkipTarget,
  technicalTitle,
  waitsForYou,
  PHASE_TYPE_SUBTITLES,
  type NameContext,
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
  /** The floor a card may not shrink below; it grows DOWNWARD from here.
   *
   *  ⚠ 104 → 72 AT THE PHASE 200 CANVAS PORT, and the prior reason is kept rather than
   *  overwritten: 104 was D-185-17's 137-B floor — "the height at which the mark floating
   *  above the card's top edge clears the title line by 11px rather than the 3px the
   *  sketch theme's own `padding-top: 34` left". That mark no longer floats above the
   *  card; sketch 200 puts it INSIDE, on the left, so the clearance the 104 bought is not
   *  a constraint any more. 72 is `screens/builder-canvas.html`'s own node height, on ten
   *  of its ten nodes. The floor is still a FLOOR — the sheet's own three-line nodes are
   *  84px, and this card still grows downward to meet a run line or a condition. */
  NODE_MIN_HEIGHT: 72,
  /** Horizontal distance between two adjacent phase columns. */
  PITCH_X: 320,
  /** The single spine lane every phase node sits on. */
  LANE_Y: 0,
  /** The lane below the spine where an unresolved-skip stub is parked. */
  SKIP_LANE_Y: 200,
  /** Handle offset from the node TOP (never 50%) — a taller card keeps its baseline.
   *
   *  ⚠ 28 → 36 AT THE PHASE 200 CANVAS PORT. It is still a FIXED offset from the top and
   *  D-183-12 is untouched — what changed is which fixed offset the sheet draws. Measured
   *  off `screens/builder-canvas.html` rather than chosen: its nodes sit at `top: 64px`
   *  with a height of 72, and every connector into and out of them is drawn at `y = 100`.
   *  `100 − 64 = 36`, i.e. the vertical centre of the sheet's 72px card. At the old 28 the
   *  lines would enter a 72px card a third of the way down its left edge. */
  EDGE_ANCHOR_Y: 36,
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

/**
 * The three edge kinds, carried on `edge.data.kind` (styling is the view's job).
 *
 * 185-10: `flow` is now ALSO an `edge.type`, and therefore the key of the view's
 * module-scope `edgeTypes` map — exactly as `CANVAS_NODE_TYPES` are the keys of
 * `nodeTypes`. `skip` and `end` are NOT set as `edge.type` and keep the library's
 * default renderer, so this table is the vocabulary of both classification and
 * (for `flow` alone) rendering. The docblock is spelled out because it used to say
 * `data.kind` was the only carrier, and that is no longer true.
 */
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
  /**
   * GOVERN-02 — this step must prove it (any of the three causes). Resolved once
   * here, through `phaseVocabulary.groundingCauseOf`, which is the ONE client home
   * of the rule the panel's dial also reads.
   *
   * The canvas RENDERS this as SHAPE (the corner seal, plan 185-09), never as
   * colour and never as a word-badge: SPEC Req 6 says governance spends neither,
   * and both badge slots are now SPENT.
   *
   * ⚠ CORRECTED at Phase 189-13, in the commit that falsified it, and TIGHTENED at 189-15
   * once the badge actually landed. This sentence used to end *"Badge slot 1 is
   * deliberately EMPTY from this plan onward"*, then *"both badge slots are committed to
   * 188/189"*. Neither is true now: 188 DECLINED its claim (its channel is the run ring)
   * and 189-15 SPENT slot 1 on the state-conditional "Not connected" badge fed by
   * `notConnected` below. Governance's own argument — that it spends no colour and no
   * badge slot — is unchanged and is the half of this paragraph that had to survive both
   * edits.
   */
  grounded: boolean
  /**
   * GOVERN-03 — an action-risk checkpoint is armed on this step. READ-ONLY on the
   * canvas: arming happens in the panel's governance section (sketch 147 — the
   * panel is where you SET, the canvas is where you SEE), and `PhaseNodeCard`
   * forbids any focusable control inside the card, so a clickable armed mark is
   * not representable here even in principle.
   */
  armed: boolean
  /** Badge slot 2 — true ONLY on `llm_human_input`. */
  waitsForYou: boolean
  /**
   * Badge slot 1 (D-12 / D-18, Phase 189-13) — this step cannot reach anything yet.
   *
   * Resolved ONCE here through `phaseVocabulary.notConnectedOf`, the same shape every
   * sibling boolean on this face uses, and rendered by `PhaseNode.tsx` as the muted
   * "Not connected" word-badge. It is DESIGN-TIME data and is emitted regardless of run
   * mode, so the badge persists while the step runs and after it has recorded — which is
   * honest (the step genuinely is not connected) and is why D-16's run word had to be
   * worded so the two never read as a duplication.
   *
   * ⚠ IT RETIRES BY DATA, NOT BY EDIT. When Phase 190 binds a destination,
   * `notConnectedOf` returns false, the badge tuple falls to its existing branch, and
   * neither this file nor `PhaseNode.tsx` nor the card is touched.
   */
  notConnected: boolean
  /**
   * Phase 200-06 (`BC-MR-03`) — this step's own branch condition, already resolved to the
   * TARGET STEP'S NAME, or ABSENT when there is nothing honest to say.
   *
   * Absent in three distinct cases, and the third is a decision rather than a gap: the
   * step declares no `on_failure` at all; the directive is not a skip; or the target slug
   * resolves to no phase in this definition — in which case the broken-reference STUB
   * already prints the whole sentence and a second copy on the source card would be the
   * same fact twice, three centimetres apart (199-05's own rule).
   *
   * ⚠ THE SLUG NEVER REACHES THE FACE. `workflow_phases.slug` is an identifier; the card
   * carries business words. The resolution happens once, in the projection, against the
   * definition the projection already holds.
   */
  condition?: string
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
  /**
   * GOVERN-03 — the action-risk checkpoint state of the step this edge runs INTO.
   * The checkpoint sits on the connector INTO the risky step, because what it
   * describes is the moment before that step runs.
   *
   * THREE STATES, NOT TWO, and the third is what keeps two shipped promises from
   * contradicting each other (sketch 147 `index.html:459` — `if (mk === 'none' ||
   * !step.risky) return { onCard: '', inGap: '' }` — and `:539`'s `detourOwnsLine`):
   *
   *   ABSENT  the step declares no checkpoint. The connector is ORDINARY and
   *           `FlowEdge` draws it exactly as the library's default renderer drew it
   *           before this plan. This is the state every shipped canvas is in, and it
   *           is why "an ordinary unarmed flow edge renders identically to today"
   *           and "unarmed shows a ghost" are both true at once.
   *   false   a checkpoint is declared and OPEN. The detour is drawn as a faint
   *           dashed ghost with a solid line running straight through it — visibly
   *           present and open, never absent, so a step that emails a report with
   *           nobody watching cannot look identical to one that reads a file.
   *   true    ARMED. The arc IS the path and no straight line runs past it.
   *
   * Only `true` and ABSENT are producible: SPEC Req 8 arms nothing by default in 185, and
   * `checkpointOnTarget` below returns `actionRiskArmed(phase) ? true : undefined`, so
   * `false` is not expressible by this projection at all.
   *
   * ⚠ CORRECTED at 189-15 (D-21). This paragraph used to end *"`false` is Phase 189's
   * state — an external-action step whose checkpoint the author turned off"*. **189 IS NOT
   * THAT CLAIMANT AND NOBODY IS**, because D-04 pins `action_risk_armed` to `true` at the
   * Pydantic level for `external_action` (189-07) and the panel's arming switch renders ON
   * and REFUSES TO MOVE (189-14). A step of this type whose checkpoint the author turned
   * off is therefore not a state this product has — it is unreachable FOREVER, not merely
   * unreached today, and naming a future phase as its claimant is what would eventually
   * turn a stale comment into a work item.
   *
   * ⚠ AND THIS IS A PROSE CORRECTION, NOT A DELETION OF BEHAVIOUR. `FlowEdge`'s ghost-marks
   * branch stays shipped and stays tested; it is simply unreachable, which is the honest
   * state for a rendering whose input no producer emits. **A plan that reads this docblock
   * as a requirement to build a ghost-detour edge has misread it** — 189-15's diff over
   * `FlowEdge.tsx` is empty, deliberately.
   */
  armed?: boolean
  /**
   * Phase 200-06 (`BC-MR-01` / D-08) — the UPSTREAM step's own declared count, ready to
   * render, or ABSENT when that step declared nothing.
   *
   * ⚠ **`toCanvas` NEVER SETS THIS, AND THAT IS STRUCTURAL RATHER THAN AN OVERSIGHT.**
   * This projection is a PURE function of the definition alone (D-183-12) — same phases
   * in, byte-identical nodes and edges out — and a run's declared count is not in the
   * definition. The key is declared HERE because this is where the edge's data shape has
   * its one home; it is FILLED by `WorkflowCanvas`, from the `runState` seam the PAGE
   * supplies, in the same memo that resolves the stroke. So the projection's committed
   * snapshot stays byte-identical to what it was before this plan, and there is still
   * exactly one place a reader looks to learn what an edge can carry.
   */
  payload?: EdgePayload
  /**
   * Phase 200-06 (`BC-MR-02`) — which of the four connection states this line is in.
   *
   * Resolved by `connectionState.connectionStateOf` in `WorkflowCanvas` (which owns the
   * pointer and the selection), never here: it is a VIEW state, not a projection fact,
   * and putting it in the pure projection would make the committed snapshot depend on
   * where the mouse is. Absent ⇒ `FlowEdge` renders exactly as it did before this plan.
   */
  connection?: ConnectionState
}

/**
 * ONE connection's payload — the fact it carries, kept in the two halves the wire carries
 * them in so that neither can be synthesised from the other.
 *
 * ⚠ `count` is a REAL integer INCLUDING `0`; ABSENCE is the DIFFERENT fact and is
 * expressed by omitting the whole object, never by a `0` and never by a dash
 * (`BC-MNR-01`). `noun` is the STEP'S OWN word, authored at one executor site per phase
 * type and carried on the wire — the client spells none of its own (`BC-MNR-02`).
 */
export interface EdgePayload {
  count: number
  noun: string
}

/**
 * An edge the canvas draws. `data.kind` is the whole CLASSIFICATION; since 185-10 a
 * flow edge additionally carries `type: "flow"`, which chooses WHO RENDERS it.
 */
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

/**
 * GOVERN-02 — does this step have to prove itself? A NAMED TOTAL FUNCTION, so the
 * boolean on the node face has a name to argue with rather than an inline ternary,
 * exactly as every other face value here does.
 *
 * It declares no branch of its own: the cause and its total order live in
 * `phaseVocabulary.groundingCauseOf`, which the panel's dial reads through the
 * same body. "Grounded" is simply "there is a cause".
 */
function isGrounded(phase: PhaseSpecJSON, kbTools: readonly string[]): boolean {
  return groundingCauseOf(phase, kbTools) !== null
}

/** GOVERN-03 — is a checkpoint armed on this step? Delegated for the same reason. */
function isArmed(phase: PhaseSpecJSON): boolean {
  return actionRiskArmed(phase)
}

/** D-12 / D-18 (189-13) — can this step reach anything yet? Delegated for the same
 *  reason: the rule (a type test and a state test on separate lines, so Phase 190 edits
 *  ONE line) lives in `phaseVocabulary.notConnectedOf`, and this file declares no branch
 *  of its own. */
function isNotConnected(phase: PhaseSpecJSON): boolean {
  return notConnectedOf(phase)
}

/**
 * GOVERN-03 — the checkpoint state to carry on the edge running INTO `phase`, as the
 * THREE states `CanvasEdgeData.armed` documents rather than a plain boolean.
 *
 * It declares no rule of its own: the armed reading is `phaseVocabulary.actionRiskArmed`,
 * the SAME body `isArmed` above hands to the node face, so the mark on the connector and
 * the state of the step can never disagree. What this function adds is the ABSENCE case —
 * an unarmed step declares no checkpoint today, so its connector carries no key at all
 * and is drawn exactly as it was before Phase 185.
 */
function checkpointOnTarget(phase: PhaseSpecJSON): boolean | undefined {
  return actionRiskArmed(phase) ? true : undefined
}

/**
 * Resolve every face value a phase card needs, once.
 *
 * `nameContext` reaches `nodeTitle` and NOTHING else (Phase 187 / D-187-05). The
 * technical form is deliberately left on one argument: it is the `label · slug` pair,
 * and a derived face behind the ⌥ reveal would hide the slug the reveal exists to show.
 */
function buildPhaseData(
  phase: PhaseSpecJSON,
  kbTools: readonly string[],
  nameContext: NameContext,
  /**
   * 200-06 (BC-MR-03) — slug → the step's own NAME, over the definition being projected.
   *
   * INJECTED rather than looked up here, for the reason the `nameContext` parameter beside
   * it exists: this helper sees ONE phase, and resolving a branch target needs all of
   * them. The caller is `toCanvas`, which already holds `bySlug`.
   *
   * OPTIONAL, and omitting it means "no condition on any face" rather than "a condition
   * with a slug in it". Every shipped caller of `toCanvas` supplies it (it is not a public
   * parameter — the resolver is built inside the projection), so the default exists only
   * so this helper stays total on its own.
   */
  resolveName: (slug: string) => string | null = () => null,
): PhaseNodeData {
  const phaseType = phase.config.phase_type
  // The whole line, or null when this step declares no branch worth stating. Spread
  // CONDITIONALLY below (the shipped D-14 idiom), so a step with no branch produces a
  // `data` object byte-identical to what it produced before this plan — which is what
  // keeps the committed projection snapshot unmoved for every fixture but the branching one.
  const condition = branchConditionOf(phase, resolveName)
  return {
    slug: phase.slug,
    phaseIndex: phase.phase_index,
    phaseType,
    title: nodeTitle(phase, nameContext),
    technicalTitle: technicalTitle(phase),
    // ⚠ OWN-PROPERTY GUARDED (WR-04, fixed at 189-13 while the 7th key was being added).
    // This read shipped as a bare `PHASE_TYPE_SUBTITLES[phaseType] ?? ""` and was the ONLY
    // read of that map outside its own declaration. A bare table lookup does NOT fire its
    // `??` fallback for an INHERITED name: the map is a plain object literal, so
    // `PHASE_TYPE_SUBTITLES["constructor"]` is the `Object` FUNCTION — never nullish — and
    // the measured consequence in this codebase was a function object reaching the node
    // render and crashing it outright (`lib/phaseGlyph.tsx`, 188.1-04). `phase_type` is
    // author-supplied definition JSONB and this is a projection, so totality is a property
    // of the lookup rather than of its current callers. The INLINE form is used rather
    // than an import so the guard reads identically to its two shipped siblings
    // (`nodePresentation.ts` and `runVocabulary.ts`).
    subtitle: Object.prototype.hasOwnProperty.call(PHASE_TYPE_SUBTITLES, phaseType)
      ? PHASE_TYPE_SUBTITLES[phaseType]
      : "",
    grounded: isGrounded(phase, kbTools),
    armed: isArmed(phase),
    waitsForYou: waitsForYou(phase),
    notConnected: isNotConnected(phase),
    ...(condition === null ? {} : { condition }),
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
 *
 * `options.kbTools` (Phase 185 / D-185-09) is the server's KB-reading tool list,
 * passed IN so this module stays PURE — it fetches nothing and hardcodes nothing;
 * the safety-DEFINING list has one home and it is the server's. It is OPTIONAL and
 * defaults to EMPTY, and the default is the safe direction stated out loud: an
 * unread palette marks NOTHING rather than un-marking something, because the
 * run-time gate is server-side and unconditional either way (D-185-09). Every
 * shipped caller that omits it therefore projects exactly as it did before.
 *
 * `options.nameContext` (Phase 187 / D-187-05) reads the SAME way, and for the same
 * reason. `folder_scope` and `skill_ref` store resolved UUIDs and the template lives on
 * the DEFINITION, so the config-derived node face cannot be a function of the phase
 * alone — it is a function of *(phase, injected name context)*. The id→name maps are
 * therefore passed IN so this module stays PURE: it fetches nothing and hardcodes
 * nothing. It is OPTIONAL and defaults to EMPTY, and that default is the safe direction
 * stated out loud: an absent map makes the derived tier MISS and renders the generic
 * type sentence, never a fabricated or id-shaped face. Every shipped caller that omits
 * it therefore projects exactly as it did before.
 */
export interface ToCanvasOptions {
  /** The server-supplied KB-reading tool names. Absent or empty marks nothing. */
  kbTools?: readonly string[]
  /** The page-owned folder/skill id→name maps and the definition's template filename.
   *  Absent or empty ⇒ every derived tier misses and the type sentence renders. */
  nameContext?: NameContext
}

/** Module-scope so an omitted `kbTools` hands the same reference on every call —
 *  the projection must be deterministic to the byte (the snapshot gate depends
 *  on it) and a fresh `[]` per call is a needless identity change. */
const NO_KB_TOOLS: readonly string[] = Object.freeze([])

/** Module-scope for exactly the reason above: an omitted `nameContext` must hand the
 *  SAME reference on every call, because the projection has to be deterministic to the
 *  byte and a fresh `{}` per call is a needless identity change the snapshot gate would
 *  see. The `NO_KB_TOOLS` idiom, applied to the second injected lookup. */
const NO_NAME_CONTEXT: NameContext = Object.freeze({})

export function toCanvas(
  phases: PhaseSpecJSON[],
  options: ToCanvasOptions = {},
): CanvasProjection {
  const nodes: CanvasNode[] = []
  const edges: CanvasEdge[] = []
  const kbTools = options.kbTools ?? NO_KB_TOOLS
  const nameContext = options.nameContext ?? NO_NAME_CONTEXT

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
  // 200-06 (BC-MR-03) — slug → this definition's own step NAME. A `Map`, so a slug named
  // `constructor` cannot resolve an inherited member: `Map.get` reads no prototype chain.
  // `nodeTitle` is the SAME function the face's own title comes from, so the condition
  // names a step exactly as that step names itself.
  const nameOfSlug = (slug: string): string | null => {
    const target = bySlug.get(slug)
    return target === undefined ? null : nodeTitle(target, nameContext)
  }

  for (const [col, phase] of ordered.entries()) {
    const data = buildPhaseData(phase, kbTools, nameContext, nameOfSlug)
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
      // ⚠ `type` IS NEW HERE IN 185-10, AND IT CHANGES WHO DRAWS THIS EDGE (D-185-18).
      //
      // Until this line `type` was set on NONE of the four edge pushes, so every edge
      // rendered through `@xyflow/react`'s built-in `default` renderer (`BezierEdgeInternal`
      // — verified in `node_modules/@xyflow/react/dist/esm/index.mjs`: `edge.type || 'default'`).
      // Setting it moves EVERY flow edge onto `WorkflowCanvas`'s `edgeTypes.flow`, i.e. onto
      // `FlowEdge`. That is why `FlowEdge` must reproduce the built-in bezier rendering — path,
      // stroke AND arrowhead — for the ordinary unarmed non-risky case, and why the plan gave
      // that a task and a regression guard of its own. It is NOT "just wiring the data".
      //
      // `skip` and `end` are deliberately left WITHOUT a `type`: they keep the default
      // renderer and `DEFAULT_EDGE_OPTIONS`, which holds this plan's blast radius to the flow
      // edges alone.
      //
      // `armed` is spread CONDITIONALLY (the shipped D-14 `{...(cond ? { x } : {})}` idiom), so
      // an ordinary step's connector carries no new key and its projection — and therefore the
      // committed snapshot's `data` object — is byte-identical to before.
      const armed = checkpointOnTarget(successor)
      pushEdge({
        id: `seq:${phase.slug}->${successor.slug}`,
        source: phase.slug,
        target: successor.slug,
        type: CANVAS_EDGE_KINDS.flow,
        data: { kind: CANVAS_EDGE_KINDS.flow, ...(armed === undefined ? {} : { armed }) },
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
