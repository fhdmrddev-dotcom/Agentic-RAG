/**
 * Phase 200-06 (`200-CHECKLIST.md` §3 `BC-MR-02`) — THE FOUR CONNECTION STATES.
 *
 * `screens/builder-canvas.html` draws them as a legend strip, verbatim:
 *
 *   at rest   · a 2px line in the border colour
 *   selected  · a 2px line in the brand colour
 *   hovered   · a 2px line in a light neutral
 *   not taken · a 2px DASHED line in a dim colour
 *
 * and `199-05` measured that **only the first of the four exists on the shipped
 * canvas**. This module is the ONE home for the reading, so the canvas resolves a state
 * and `FlowEdge` renders one, and neither invents a fifth.
 *
 * ── WHY `not-taken` IS THE CONDITIONAL BRANCH, AND WHY THAT IS NOT A STRETCH ──────
 *
 * The shipped plane already draws exactly one connection the run does NOT follow unless
 * a check fails: the `skip` edge that carries `on_failure: skip_to_phase:<slug>`. It has
 * been drawn DASHED since 183 (`WorkflowCanvas.EDGE_STYLE[skip]` — `strokeDasharray:
 * "5 4"`), which IS the sketch's `not taken` treatment, arrived at independently. So this
 * state is NAMED here rather than newly painted: the delta for it is deliberately EMPTY,
 * and the shipped conditional branch renders byte-identically to what it rendered before
 * this plan. What changes is that the plane can now SAY which state a line is in.
 *
 * ⚠ It is a state of the DEFINITION, never a claim about a run. A connection that a run
 * genuinely did not take is a different fact, it needs run rows the canvas does not read,
 * and reading this state as that one would be the fabricated-claim failure `199-05`
 * named. The word `not taken` is the sketch's own and is kept; the docblock is where the
 * scope of the claim lives.
 *
 * ── PRECEDENCE, STATED SO IT CANNOT BE REDISCOVERED ──────────────────────────────
 *
 * A conditional branch can also be hovered, and a hovered connection can also be
 * selected, so the four are NOT mutually exclusive inputs and an order is required:
 *
 *   selected > hovered > not-taken > at-rest
 *
 * Selection is a DELIBERATE act by the person and outranks a transient pointer position;
 * both outrank a structural fact that is true of the line all the time. The order is
 * asserted by this module's suite at every contended pair rather than left to the reader.
 *
 * ── DISTINCT WITHOUT COLOUR (the 199-05 rule, applied) ───────────────────────────
 *
 * `FlowEdge.test.tsx` already fences its three armed/open/ordinary states as distinct
 * under a colour-blind signature. The same rule binds here, and it is why the deltas
 * below move `strokeWidth` rather than only `stroke`: `at-rest` 2 · `hovered` 2.5 ·
 * `selected` 3, plus the dash `not-taken` already carries. Four signatures, four
 * distinct readings, none of them riding on a hue.
 *
 * A TRUE LEAF: it imports one TYPE from React and nothing else, so it can never
 * participate in a value-level module cycle — the constraint `FlowEdge`'s own docblock
 * records as having been observed RED on this subtree.
 */
import type { CSSProperties } from "react"

/** The four, in the sketch legend's own order. */
export const CONNECTION_STATES = ["at-rest", "selected", "hovered", "not-taken"] as const

export type ConnectionState = (typeof CONNECTION_STATES)[number]

/**
 * The legend's words — the sketch's own strings, ONE home.
 *
 * Kept beside the states rather than at a render site so the vocabulary cannot acquire a
 * second spelling, which is the one-string-home rule this repo already enforces four
 * times over (`doorVocabulary.ts`, `libraryVocabulary.ts`, `decisionsVocabulary.ts`,
 * `runVocabulary.ts`).
 */
export const CONNECTION_STATE_WORD: Record<ConnectionState, string> = {
  "at-rest": "at rest",
  selected: "selected",
  hovered: "hovered",
  "not-taken": "not taken",
}

/**
 * What each state ADDS to the stroke the canvas already resolved — never a replacement.
 *
 * ⚠ `at-rest` and `not-taken` are EMPTY ON PURPOSE, and the emptiness is the guarantee:
 * merging an empty object leaves `EDGE_STYLE[kind]` untouched, so an ordinary connector
 * and a conditional branch render byte-identically to how they rendered before this
 * plan. `185-VALIDATION.md`'s manual row ("screenshot a 5-step unarmed workflow before
 * and after; edges must be indistinguishable") therefore still passes, and it passes for
 * every canvas shipped today.
 */
export const CONNECTION_STATE_DELTA: Record<ConnectionState, CSSProperties> = {
  "at-rest": {},
  selected: { stroke: "hsl(var(--primary))", strokeWidth: 3 },
  hovered: { stroke: "hsl(220 30% 100% / 0.72)", strokeWidth: 2.5 },
  "not-taken": {},
}

/** The three inputs, named rather than positional — two booleans in a row is how a caller
 *  eventually passes them the wrong way round. */
export interface ConnectionInputs {
  /** The person selected this connection. A deliberate act. */
  selected?: boolean
  /** The pointer is over this connection. Transient. */
  hovered?: boolean
  /** The connection is a conditional branch — structural, true all the time. */
  conditional?: boolean
}

/**
 * TOTAL: every combination of the three inputs resolves to exactly one of the four, and
 * the all-false case resolves to `at-rest` rather than to `undefined`. A caller never has
 * to handle an absence.
 */
export function connectionStateOf(inputs: ConnectionInputs): ConnectionState {
  if (inputs.selected === true) return "selected"
  if (inputs.hovered === true) return "hovered"
  if (inputs.conditional === true) return "not-taken"
  return "at-rest"
}
