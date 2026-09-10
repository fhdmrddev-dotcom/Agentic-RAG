/**
 * SEED-258 (Phase 239-10) — the copy module, and the ONE number it is allowed to carry.
 *
 * ⚠ WHY A CROSS-LANGUAGE PIN AND NOT A COMMENT.
 *
 * SEED-258 exists because of a relation between two numbers that was asserted in prose, in
 * one of the two files, with nothing executable connecting them. `google_drive.py` said for
 * its ENTIRE LIFE that its 25 MB "match[ed] application upload ceiling"; measured
 * 2026-09-08 that ceiling was 50 MB and the sentence had never been true.
 *
 * This module carries a recommendation — *"Recommended: 25 MB"* — and 25 is the backend's
 * `SOURCE_MAX_FILE_SIZE_MB_DEFAULT`. That is the same shape of relation, so it gets the same
 * treatment: **pinned by a test that reads the backend source**, never restated in a comment.
 *
 * ⚠ THE BOUNDS ARE A DIFFERENT CASE AND ARE NOT PINNED HERE — they are SERVED
 * (`source_max_file_size_mb_floor` / `_ceiling` on the settings response) precisely so the
 * form never owns a copy. The cases below prove the copy DERIVES them from its arguments,
 * which is stronger than pinning a duplicate would be.
 *
 * The `?raw` backend import is this repo's established idiom for a cross-language pin
 * (`acceptFormats.test.ts`, `ConnectionFormPanel.sourceTools.test.tsx`, and six others).
 */
import { describe, it, expect } from "vitest"

import userSettingsPySource from "../../../../../backend/app/models/user_settings.py?raw"
import {
  SOURCE_CEILING_COST,
  SOURCE_CEILING_DESCRIPTION,
  SOURCE_CEILING_RECOMMENDED_MB,
  SOURCE_CEILING_TITLE,
  sourceCeilingBounds,
  sourceCeilingRecommendation,
} from "../sourceCeilingCopy"

/** Read a module-level `NAME = <int>` out of the backend source. */
function pyInt(name: string): number {
  const m = userSettingsPySource.match(new RegExp(`^${name}\\s*=\\s*(\\d+)\\s*$`, "m"))
  if (!m) throw new Error(`${name} not found in user_settings.py — the pin has lost its anchor`)
  return Number(m[1])
}

describe("sourceCeilingCopy — the fixture's own premise", () => {
  /**
   * ⚠ FOUR TIMES IN THIS PHASE a test passed vacuously because its fixture was wrong. A
   * `?raw` import that silently resolved to "" would make every pin below trivially true,
   * so the premise is asserted before anything rests on it.
   */
  it("the backend source actually loaded, and holds the three constants", () => {
    expect(userSettingsPySource.length).toBeGreaterThan(1000)
    expect(userSettingsPySource).toContain("SOURCE_MAX_FILE_SIZE_MB_DEFAULT")
    expect(userSettingsPySource).toContain("SOURCE_MAX_FILE_SIZE_MB_FLOOR")
    expect(userSettingsPySource).toContain("SOURCE_MAX_FILE_SIZE_MB_CEILING")
  })
})

describe("sourceCeilingCopy — the recommendation is pinned to the shipped default", () => {
  it("recommends exactly the backend's SOURCE_MAX_FILE_SIZE_MB_DEFAULT", () => {
    // If someone changes the shipped default and not this line, THIS case fails — which is
    // the whole point. A recommendation that has drifted from the default is worse than
    // none: it advises the operator toward a value the product no longer chooses.
    expect(SOURCE_CEILING_RECOMMENDED_MB).toBe(pyInt("SOURCE_MAX_FILE_SIZE_MB_DEFAULT"))
  })

  it("the recommendation sentence states that number and why", () => {
    const line = sourceCeilingRecommendation(SOURCE_CEILING_RECOMMENDED_MB)
    expect(line).toContain(`${SOURCE_CEILING_RECOMMENDED_MB} MB`)
    expect(line).toMatch(/most document workloads/i)
  })
})

describe("sourceCeilingCopy — the bounds are DERIVED, never owned", () => {
  it("states whatever floor and ceiling it is handed", () => {
    const line = sourceCeilingBounds(3, 44)
    expect(line).toContain("3")
    expect(line).toContain("44")
  })

  it("⛔ does not smuggle the shipped 1/50 into a sentence about other bounds", () => {
    // A copy function that ignored its arguments and hardcoded the shipped numbers would
    // pass the case above by accident (both mention digits) and fail this one.
    const line = sourceCeilingBounds(3, 44)
    expect(line).not.toContain("50")
  })

  it("the module source contains no bare ceiling literal at all", () => {
    // The recommendation (25) is the ONE number this module is allowed to own, and it is
    // pinned above. 50 is the server's to state.
    const withoutRecommendation = [
      SOURCE_CEILING_TITLE,
      SOURCE_CEILING_DESCRIPTION,
      SOURCE_CEILING_COST,
    ].join(" ")
    expect(withoutRecommendation).not.toContain("50")
    expect(withoutRecommendation).not.toContain(String(pyInt("SOURCE_MAX_FILE_SIZE_MB_CEILING")))
  })
})

describe("sourceCeilingCopy — the words the operator asked for", () => {
  it("the cost sentence names memory and the untrusted server", () => {
    expect(SOURCE_CEILING_COST).toMatch(/memory/i)
    expect(SOURCE_CEILING_COST).toMatch(/server we do not control/i)
  })

  it("the description scopes the limit to every connected source", () => {
    expect(SOURCE_CEILING_DESCRIPTION).toMatch(/every connected source/i)
    expect(SOURCE_CEILING_DESCRIPTION).toMatch(/Google Drive/)
    expect(SOURCE_CEILING_DESCRIPTION).toMatch(/MCP/)
  })

  it("the title says what the number IS, in a person's terms", () => {
    // "how big a file can I import" — SEED-258's own framing of the number a person
    // thinks in. A title of "source_max_file_size_mb" would be the constant again.
    expect(SOURCE_CEILING_TITLE).not.toMatch(/source_max_file_size_mb/)
    expect(SOURCE_CEILING_TITLE).toMatch(/file/i)
  })
})
