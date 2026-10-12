/**
 * Phase 275 plan 02 (D-07 / S9 / S10) — THE COPY FENCE for the retention strings.
 *
 * `retentionCopy.ts` holds two kinds of string, and each kind is fenced against its OWN source:
 *   · PORTED   — the words the operator approved in sketch 275 (`index.html`). Sketch 275 has no
 *                `COPY` object, so each value is asserted VERBATIM in the sketch source (`?raw`).
 *   · CONTRACT — words the UI-SPEC adds where the sketch had none (the on-state chip, its ✕ label,
 *                the refusal's Close, the generic delete failure). Each is asserted in the UI-SPEC.
 * A ported value that drifts, or a contract value that is quietly re-worded, goes red here.
 */
import { describe, it, expect } from "vitest"
import { RETENTION_COPY } from "../retentionCopy"

import sketchSource from "../../../../../.planning/sketches/275-retention-legal-hold/index.html?raw"
import uiSpecSource from "../../../../../.planning/phases/275-retention-legal-hold/275-UI-SPEC.md?raw"
import holdGuardSource from "../../../../../backend/app/services/retention/hold_guard.py?raw"

describe("retentionCopy — ported from sketch 275, contract copy from the UI-SPEC", () => {
  it("non-vacuity: both ?raw sources are real", () => {
    expect(sketchSource.length).toBeGreaterThan(10000)
    expect(sketchSource).toContain("function screen4()")
    expect(uiSpecSource.length).toBeGreaterThan(10000)
    expect(uiSpecSource).toContain("## S10 — Hold refusals")
  })

  it("every PORTED string sits verbatim in the sketch", () => {
    let checked = 0
    for (const value of Object.values(RETENTION_COPY.ported)) {
      expect(typeof value).toBe("string")
      expect(sketchSource).toContain(value)
      checked++
    }
    // Non-vacuity: an empty `ported` group would pass the loop above for free.
    expect(checked).toBe(2)
  })

  it("every CONTRACT string sits verbatim in the UI-SPEC", () => {
    let checked = 0
    for (const value of Object.values(RETENTION_COPY.contract)) {
      expect(typeof value).toBe("string")
      expect(uiSpecSource).toContain(value)
      checked++
    }
    expect(checked).toBe(4)
  })

  it("the S9 chip words are exactly the UI-SPEC's", () => {
    expect(RETENTION_COPY.ported.includeArchived).toBe("Include archived")
    expect(RETENTION_COPY.contract.archivedIncluded).toBe("Archived: included")
    expect(RETENTION_COPY.contract.stopIncludingArchived).toBe("Stop including archived documents")
  })

  it("the S10 refusal title is the server's own (hold_guard.REFUSAL_TITLE)", () => {
    expect(RETENTION_COPY.ported.refusalTitle).toBe("Can't delete.")
    expect(holdGuardSource).toContain(`REFUSAL_TITLE = "${RETENTION_COPY.ported.refusalTitle}"`)
  })
})
