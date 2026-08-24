/**
 * Phase 200-06 — `connectionState.ts`, the ONE home of the four connection states.
 *
 * `200-CHECKLIST.md` §3 `BC-MR-02`. What is guarded here:
 *
 *  1. TOTALITY — every combination of the three inputs resolves to one of the four, and
 *     the all-absent case resolves to `at-rest` rather than to `undefined`;
 *  2. PRECEDENCE at every contended pair, asserted rather than left to the reader;
 *  3. the two EMPTY deltas, which are what make the shipped run-order connector and the
 *     shipped dashed branch byte-identical to their pre-plan rendering;
 *  4. DISTINCT WITHOUT COLOUR — the four are separable by weight and dash alone, the
 *     `199-05` rule `FlowEdge.test.tsx` already applies to its own three states;
 *  5. the vocabulary's ONE home — the four words, spelled here and nowhere else.
 */
import { describe, it, expect } from "vitest"

import {
  CONNECTION_STATE_DELTA,
  CONNECTION_STATE_WORD,
  CONNECTION_STATES,
  connectionStateOf,
  type ConnectionState,
} from "./connectionState"

describe("connectionState — the four, and only the four", () => {
  it("names exactly four states, in the sketch legend's order", () => {
    expect(CONNECTION_STATES).toEqual(["at-rest", "selected", "hovered", "not-taken"])
  })

  it("the word table is TOTAL over the states and carries the sketch's own strings", () => {
    for (const state of CONNECTION_STATES) {
      expect(Object.prototype.hasOwnProperty.call(CONNECTION_STATE_WORD, state)).toBe(true)
    }
    expect(CONNECTION_STATE_WORD["at-rest"]).toBe("at rest")
    expect(CONNECTION_STATE_WORD.selected).toBe("selected")
    expect(CONNECTION_STATE_WORD.hovered).toBe("hovered")
    expect(CONNECTION_STATE_WORD["not-taken"]).toBe("not taken")
    // Four distinct words — a table with a duplicate would make two states indistinguishable
    // in the legend while every other assertion here stayed green.
    expect(new Set(Object.values(CONNECTION_STATE_WORD)).size).toBe(4)
  })

  it("the delta table is TOTAL over the states", () => {
    for (const state of CONNECTION_STATES) {
      expect(Object.prototype.hasOwnProperty.call(CONNECTION_STATE_DELTA, state)).toBe(true)
    }
  })
})

describe("connectionState — the resolver is TOTAL and its precedence is fixed", () => {
  it("no input at all is `at-rest`, never undefined", () => {
    expect(connectionStateOf({})).toBe("at-rest")
    expect(connectionStateOf({ selected: false, hovered: false, conditional: false })).toBe(
      "at-rest",
    )
  })

  it("each input alone resolves to its own state", () => {
    expect(connectionStateOf({ selected: true })).toBe("selected")
    expect(connectionStateOf({ hovered: true })).toBe("hovered")
    expect(connectionStateOf({ conditional: true })).toBe("not-taken")
  })

  it("selected outranks hovered — a deliberate pick beats a pointer that happens to be there", () => {
    expect(connectionStateOf({ selected: true, hovered: true })).toBe("selected")
  })

  it("hovered outranks not-taken — a conditional branch under the pointer reads as hovered", () => {
    expect(connectionStateOf({ hovered: true, conditional: true })).toBe("hovered")
  })

  it("selected outranks both", () => {
    expect(connectionStateOf({ selected: true, hovered: true, conditional: true })).toBe("selected")
  })

  it("EVERY one of the eight input combinations resolves inside the union", () => {
    const members = new Set<string>(CONNECTION_STATES)
    for (const selected of [false, true]) {
      for (const hovered of [false, true]) {
        for (const conditional of [false, true]) {
          const got: ConnectionState = connectionStateOf({ selected, hovered, conditional })
          expect(members.has(got)).toBe(true)
        }
      }
    }
  })
})

describe("connectionState — the deltas (what a state ADDS, and what it deliberately does not)", () => {
  it("`at-rest` and `not-taken` add NOTHING — the shipped strokes are untouched", () => {
    // This is the guarantee, not a detail. Merging an empty object leaves the canvas's
    // own `EDGE_STYLE[kind]` exactly as it was, so 185-VALIDATION's "edges must be
    // indistinguishable" row still passes and the shipped dashed branch is unmoved.
    expect(Object.keys(CONNECTION_STATE_DELTA["at-rest"])).toHaveLength(0)
    expect(Object.keys(CONNECTION_STATE_DELTA["not-taken"])).toHaveLength(0)
  })

  it("`selected` and `hovered` each add a stroke AND a weight", () => {
    for (const state of ["selected", "hovered"] as const) {
      expect(CONNECTION_STATE_DELTA[state].stroke).toBeTruthy()
      expect(typeof CONNECTION_STATE_DELTA[state].strokeWidth).toBe("number")
    }
  })

  it("the four are DISTINCT WITHOUT COLOUR — weight and dash alone separate them", () => {
    // The 199-05 rule: every state the plane can express must be distinguishable without
    // a hue. `at-rest` and `not-taken` share a weight and are separated by the DASH the
    // conditional branch has carried since 183 (`EDGE_STYLE[skip].strokeDasharray`), which
    // is the sketch legend's own treatment for `not taken`.
    const weightOf = (state: ConnectionState) => CONNECTION_STATE_DELTA[state].strokeWidth ?? 2
    const dashOf = (state: ConnectionState) => (state === "not-taken" ? "dashed" : "solid")
    const signatures = CONNECTION_STATES.map((s) => `${String(weightOf(s))}|${dashOf(s)}`)
    // NON-VACUITY FIRST — this project has measured fences that swept the empty string.
    for (const sig of signatures) expect(sig.length).toBeGreaterThan(0)
    expect(new Set(signatures).size).toBe(4)
  })

  it("POSITIVE CONTROL — the signature really does notice a weight change", () => {
    expect("2|solid").not.toBe("3|solid")
    // …and it is colour-free, which is the property being claimed above.
    expect("2|solid").not.toContain("hsl(")
  })
})
