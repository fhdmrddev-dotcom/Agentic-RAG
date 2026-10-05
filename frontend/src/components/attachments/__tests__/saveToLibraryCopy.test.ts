/**
 * Phase 274 plan 03 Task 2 (D-15) — THE COPY FENCE for the Save-to-Library port.
 *
 * `saveToLibraryCopy.ts` is a PORT of sketch 274's `COPY.js`, never a re-typing. This suite reads
 * the sketch as SOURCE (`?raw`) and asserts every ported pair as `key: "value"`, so a value that
 * drifts — or drifts onto a different key — goes red rather than shipping. The two engine
 * refusals are additionally fenced against the minter itself (`ingest_splice.py`), because they
 * are the server's sentences, not design copy.
 */
import { describe, it, expect } from "vitest"
import { COPY } from "../saveToLibraryCopy"

import sketchSource from "../../../../../.planning/sketches/274-save-to-library/COPY.js?raw"
import spliceSource from "../../../../../backend/app/services/ingest_splice.py?raw"

describe("saveToLibraryCopy — a port of sketch 274's COPY.js", () => {
  it("non-vacuity: both ?raw sources are real", () => {
    expect(sketchSource.length).toBeGreaterThan(500)
    expect(sketchSource).toContain("const COPY = {")
    expect(spliceSource.length).toBeGreaterThan(500)
    expect(spliceSource).toContain("def ")
  })

  it("every ported engine / shared / a string sits in the sketch as key: \"value\"", () => {
    const groups: [string, Record<string, unknown>][] = [
      ["engine", COPY.engine],
      ["shared", COPY.shared],
      ["a", COPY.a],
    ]
    let checked = 0
    for (const [, group] of groups) {
      for (const [key, value] of Object.entries(group)) {
        if (typeof value !== "string") continue // builders are fenced by shape below
        expect(sketchSource).toContain(`${key}: "${value}"`)
        checked++
      }
    }
    // Non-vacuity: a port that exported empty groups would pass the loop above.
    // engine 3 + shared 17 string keys + a 3 = 23.
    expect(checked).toBe(23)
  })

  it("the builders are ported by SHAPE: their template text is the sketch's", () => {
    expect(sketchSource).toContain(
      "Saving makes this version ${n}; version ${n - 1} stays in its history.",
    )
    expect(sketchSource).toContain("The same file is already in ${path}, so nothing new was saved.")
    expect(sketchSource).toContain("You picked ${picked}. The existing copy was not moved.")
    expect(sketchSource).toContain("agentRead: (name) => `Read ${name}`")
  })

  it("versionWarn reproduces the sketch's sentence with real values", () => {
    expect(COPY.shared.versionWarn("Meridian-Q4-pricing.xlsx", "Suppliers/Meridian/Pricing", 2)).toBe(
      "Suppliers/Meridian/Pricing already has a file called Meridian-Q4-pricing.xlsx. " +
        "Saving makes this version 2; version 1 stays in its history.",
    )
    expect(COPY.shared.alreadyBody("Finance/Q4 2026 review")).toBe(
      "The same file is already in Finance/Q4 2026 review, so nothing new was saved.",
    )
    expect(COPY.shared.alreadyDiffFolder("Suppliers/Meridian")).toBe(
      "You picked Suppliers/Meridian. The existing copy was not moved.",
    )
    expect(COPY.shared.agentRead("a.md")).toBe("Read a.md")
  })

  it("the engine refusals are the MINTER's own sentences (ingest_splice.py)", () => {
    expect(spliceSource).toContain(`"${COPY.engine.REFUSE_NOT_OWNER}"`)
    expect(spliceSource).toContain(`"${COPY.engine.REFUSE_NO_FOLDER}"`)
  })

  it("variants b and c and the scenario fixture are NOT ported; net-new strings sit under netNew", () => {
    expect(Object.keys(COPY).sort()).toEqual(["a", "engine", "netNew", "shared"])
    const keys = Object.keys(COPY)
    expect(keys).not.toContain("b")
    expect(keys).not.toContain("c")
    expect(keys).not.toContain("scenario")
    // Every net-new value is absent from the sketch — otherwise it is a port, not net-new.
    for (const value of Object.values(COPY.netNew)) {
      expect(typeof value).toBe("string")
      expect(sketchSource).not.toContain(`"${value}"`)
    }
  })

  it("the confirm word is never Attach or Import (D-10)", () => {
    expect(COPY.shared.confirm).toBe(COPY.shared.verb)
    for (const s of [COPY.shared.verb, COPY.shared.confirm, COPY.shared.dialogTitle]) {
      expect(s).not.toMatch(/attach|import/i)
    }
  })
})
