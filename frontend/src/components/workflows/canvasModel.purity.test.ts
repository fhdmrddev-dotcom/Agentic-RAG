/**
 * Phase 183-05 Task 3 (D-183-12, G-6) — the canvasModel purity tripwire.
 *
 * D-183-12 in machine-checkable form, plus the first four G-6 "how we'd know this
 * failed" conditions. Every assertion here is a control that PROVABLY fires: adding a
 * clock read to the model, or mutating the input inside `toCanvas`, was confirmed to
 * turn this suite red before being reverted.
 *
 * The load-bearing one is the Pitfall-3 walk. If a layout key ever reaches a
 * definition object it would 422 against the backend's `extra="forbid"` — or force
 * someone to relax it, which is the first named G-6 failure. The model computes
 * layout; it never writes it back.
 */
import { describe, it, expect } from "vitest"

import canvasModelSource from "./canvasModel?raw"
import { toCanvas, CANVAS_LAYOUT } from "./canvasModel"
import { ALL_FIXTURES, evalCoverage } from "./__fixtures__/canvasFixtures"
import type { PhaseSpecJSON } from "./phaseVocabulary"

/** A JSON deep clone — every fixture is JSON-safe by construction. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** A DETERMINISTIC reshuffle (reverse, then rotate by one) — never Math.random, so a
 *  failure here is always reproducible. */
const reshuffle = (phases: PhaseSpecJSON[]): PhaseSpecJSON[] => {
  const reversed = [...phases].reverse()
  return reversed.length > 1 ? [...reversed.slice(1), reversed[0]] : reversed
}

/** The layout keys that must never appear anywhere inside a definition object. */
const FORBIDDEN_DEFINITION_KEYS = ["position", "x", "y", "layout"]

/** Walk an arbitrary value and collect every forbidden key found on any object. */
const forbiddenKeysIn = (value: unknown, found: string[] = []): string[] => {
  if (Array.isArray(value)) {
    for (const item of value) forbiddenKeysIn(item, found)
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_DEFINITION_KEYS.includes(k)) found.push(k)
      forbiddenKeysIn(v, found)
    }
  }
  return found
}

describe("canvasModel — determinism (D-183-12: same definition in, same picture out)", () => {
  it.each(ALL_FIXTURES)("$name projects byte-identically across two calls", ({ phases }) => {
    expect(JSON.stringify(toCanvas(phases))).toBe(JSON.stringify(toCanvas(phases)))
  })

  it.each(ALL_FIXTURES)("$name is order-independent (shuffled input, same output)", ({ phases }) => {
    expect(JSON.stringify(toCanvas(reshuffle(phases)))).toBe(JSON.stringify(toCanvas(phases)))
  })
})

describe("canvasModel — non-mutation and Pitfall 3 (no layout in the definition)", () => {
  it.each(ALL_FIXTURES)("$name: the input is deep-equal to its pre-call clone", ({ phases }) => {
    const before = clone(phases)
    toCanvas(phases)
    expect(phases).toEqual(before)
  })

  it.each(ALL_FIXTURES)("$name: no position/x/y/layout key reaches the INPUT", ({ phases }) => {
    toCanvas(phases)
    expect(forbiddenKeysIn(phases)).toEqual([])
  })

  it("the walk is a real control — it FINDS a planted layout key", () => {
    const planted = [{ slug: "a", phase_index: 0, config: { phase_type: "llm_single" }, position: { x: 1, y: 2 } }]
    expect(forbiddenKeysIn(planted)).toContain("position")
  })

  it("does not hand back a reference to any input phase object", () => {
    const phases = clone(evalCoverage)
    const { nodes } = toCanvas(phases)
    for (const node of nodes) {
      for (const phase of phases) {
        expect(node.data).not.toBe(phase)
        expect(node.data).not.toBe(phase.config)
      }
    }
  })
})

describe("canvasModel — the layout constants are the single source", () => {
  it("places every phase at exactly col * CANVAS_LAYOUT.PITCH_X on the lane", () => {
    const { nodes } = toCanvas(evalCoverage)
    const phaseNodes = nodes.filter((n) => n.type === "phase")
    expect(phaseNodes).toHaveLength(5)
    phaseNodes.forEach((node, col) => {
      expect(node.position).toEqual({
        x: col * CANVAS_LAYOUT.PITCH_X,
        y: CANVAS_LAYOUT.LANE_Y,
      })
    })
  })
})

describe("canvasModel — source purity (the ?raw grep, the shipped house idiom)", () => {
  it("reads no DOM, no clock and no randomness", () => {
    expect(canvasModelSource).not.toMatch(
      /getBoundingClientRect|offsetHeight|offsetWidth|document\.|window\.|Date\.now|Math\.random/,
    )
  })

  it("imports nothing from the API client", () => {
    expect(canvasModelSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
  })

  it("never references the server validation seam (D-183-15: zero network round trips)", () => {
    expect(canvasModelSource).not.toMatch(/workflows\/validate/)
    expect(canvasModelSource).not.toMatch(/fetch\(/)
  })

  it("declares no second copy of the phase glyph map or the on-fail parse (G-5)", () => {
    expect(canvasModelSource).not.toMatch(/const PHASE_GLYPHS/)
    expect(canvasModelSource).not.toMatch(/function parseSkipTarget/)
  })

  it("imports the shared vocabulary rather than re-deriving it", () => {
    expect(canvasModelSource).toMatch(/from "@\/components\/workflows\/phaseVocabulary"/)
  })

  it("derives the sequential edge by phase_index LOOKUP, never by array adjacency", () => {
    expect(canvasModelSource).toMatch(/phase_index \+ 1/)
    expect(canvasModelSource).not.toMatch(/ordered\[\s*(i|index)\s*\+\s*1\s*\]/)
  })
})
