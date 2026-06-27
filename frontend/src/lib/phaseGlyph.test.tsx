/**
 * Phase 127-01 Task 4 (WUX-03) — phaseGlyph presence gate.
 *
 * Wave-0 icon-presence backstop: asserts every key in PHASE_GLYPHS resolves
 * to a non-null bundled component via phaseGlyph(), and unknown/undefined keys
 * return null. This structural test complements the build-time gate (unplugin-icons
 * fails the build on a missing slug) — it catches a mismatch between PHASE_GLYPHS
 * and PHASE_GLYPH_MARKS before any consumer renders.
 *
 * Dependency-light: no DOM render needed — we assert on the returned value only.
 */
import { describe, it, expect } from "vitest"
import { PHASE_GLYPHS } from "@/components/workflows/soulData"
import { phaseGlyph } from "@/lib/phaseGlyph"

describe("phaseGlyph — presence gate", () => {
  it("returns a non-null component for every key in PHASE_GLYPHS", () => {
    for (const key of Object.keys(PHASE_GLYPHS)) {
      const result = phaseGlyph(key)
      expect(result, `phaseGlyph("${key}") must return a component, got null`).not.toBeNull()
      // React components may be functions OR memo/forwardRef objects — check both.
      expect(
        typeof result === "function" || (typeof result === "object" && result !== null),
        `phaseGlyph("${key}") must be a React component (function or memo/forwardRef object)`
      ).toBe(true)
    }
  })

  it("returns null for an unmapped phase type", () => {
    expect(phaseGlyph("totally_unknown")).toBeNull()
    expect(phaseGlyph("nope")).toBeNull()
  })

  it("returns null for undefined", () => {
    expect(phaseGlyph(undefined)).toBeNull()
  })
})
