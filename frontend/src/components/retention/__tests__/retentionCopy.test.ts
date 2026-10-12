/**
 * Phase 275 (D-07) — THE COPY FENCE for the retention strings.
 *
 * `retentionCopy.ts` holds five kinds of string, and each kind is fenced against its OWN source:
 *   · PORTED           — static words the operator approved in sketch 275 (`index.html`), asserted
 *                        VERBATIM in the sketch source (`?raw`). Sketch 275 has no `COPY` object.
 *   · CONTRACT         — static words the UI-SPEC sets (or changes by a locked decision), asserted
 *                        VERBATIM in the UI-SPEC.
 *   · SKETCH TEMPLATES — sentences the sketch builds with `${…}`: every literal segment between the
 *                        `{placeholders}`, `**` and `(s)` markers is asserted verbatim in the sketch.
 *   · SPEC TEMPLATES   — the same, against the UI-SPEC.
 *   · SERVER           — the client's copies of `hold_guard.py`'s sentences, asserted in that source.
 * A ported value that drifts, or a contract value that is quietly re-worded, goes red here. Every
 * group asserts an EXACT `checked` count, so an emptied group cannot pass for free.
 */
import { describe, it, expect } from "vitest"
import { RETENTION_COPY, fillCopy, holdRefusalFor, richParts } from "../retentionCopy"

import sketchSource from "../../../../../.planning/sketches/275-retention-legal-hold/index.html?raw"
import uiSpecSource from "../../../../../.planning/phases/275-retention-legal-hold/275-UI-SPEC.md?raw"
import holdGuardSource from "../../../../../backend/app/services/retention/hold_guard.py?raw"
import retentionModelsSource from "../../../../../backend/app/models/retention.py?raw"
import contextSource from "../../../../../.planning/phases/275-retention-legal-hold/275-CONTEXT.md?raw"

/** The literal runs of a template: split on placeholders, bold markers and `(s)`; ≥ 3 chars. */
function segments(template: string): string[] {
  return template
    .split(/\{[^}]+\}|\*\*|\(s\)/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)
}

describe("retentionCopy — every string is fenced against its own source", () => {
  it("non-vacuity: every ?raw source is real", () => {
    expect(sketchSource.length).toBeGreaterThan(10000)
    expect(sketchSource).toContain("function screen4()")
    expect(uiSpecSource.length).toBeGreaterThan(10000)
    expect(uiSpecSource).toContain("## S10 — Hold refusals")
    expect(holdGuardSource).toContain("REFUSAL_TITLE")
  })

  it("every PORTED string sits verbatim in the sketch", () => {
    let checked = 0
    for (const value of Object.values(RETENTION_COPY.ported)) {
      expect(typeof value).toBe("string")
      expect(sketchSource).toContain(value)
      checked++
    }
    // Non-vacuity: an empty `ported` group would pass the loop above for free.
    expect(checked).toBe(73) // 275-05: +wordPolicy, +wordPolicies (posture "1 policy")
  })

  it("every CONTRACT string sits verbatim in the UI-SPEC", () => {
    let checked = 0
    for (const value of Object.values(RETENTION_COPY.contract)) {
      expect(typeof value).toBe("string")
      expect(uiSpecSource).toContain(value)
      checked++
    }
    expect(checked).toBe(87) // 275-REVIEW: +policyAlreadyRemoved (F-CR-02), +confirmRefusedNothing (F-WR-01), +resultNothingDone (F-WR-03), +postureNotReported (F-WR-04), +releaseBodyUncounted (F-WR-05), +wholeNumber (F-WR-09); G-4 re-look OBS-R2a: +changedTail, +noLongerWaitingTail, +unnamedDocument
  })

  it("every SKETCH TEMPLATE's literal segments sit verbatim in the sketch", () => {
    let checked = 0
    for (const [key, value] of Object.entries(RETENTION_COPY.sketchTemplates)) {
      const segs = segments(value)
      expect(segs.length, `${key} has no literal segment to fence`).toBeGreaterThan(0)
      for (const seg of segs) expect(sketchSource, `${key}: "${seg}"`).toContain(seg)
      checked++
    }
    expect(checked).toBe(42)
  })

  it("every SPEC TEMPLATE's literal segments sit verbatim in the UI-SPEC", () => {
    let checked = 0
    for (const [key, value] of Object.entries(RETENTION_COPY.specTemplates)) {
      const segs = segments(value)
      expect(segs.length, `${key} has no literal segment to fence`).toBeGreaterThan(0)
      for (const seg of segs) expect(uiSpecSource, `${key}: "${seg}"`).toContain(seg)
      checked++
    }
    expect(checked).toBe(40) // 275-05: +historyDeleteRefused (G-4 FAIL-1); 275-REVIEW F-WR-03: +4 result clauses
  })

  it("every DECISION template's literal segments sit verbatim in 275-CONTEXT.md (D-34)", () => {
    let checked = 0
    for (const [key, value] of Object.entries(RETENTION_COPY.decisionTemplates)) {
      const segs = segments(value)
      expect(segs.length, `${key} has no literal segment to fence`).toBeGreaterThan(0)
      for (const seg of segs) expect(contextSource, `${key}: "${seg}"`).toContain(seg)
      checked++
    }
    expect(checked).toBe(1)
  })

  it("every SERVER-MODEL sentence is backend/app/models/retention.py's own (275-03 deviation 4)", () => {
    let checked = 0
    for (const value of Object.values(RETENTION_COPY.serverModels)) {
      expect(retentionModelsSource).toContain(`"${value}"`)
      checked++
    }
    expect(checked).toBe(1)
    // The editor's validation copy is the server's too, so an inline error and a 422 read the same.
    for (const v of [RETENTION_COPY.contract.nameRequired, RETENTION_COPY.contract.scopeRequired, RETENTION_COPY.contract.stage2After]) {
      expect(retentionModelsSource).toContain(`"${v}"`)
    }
  })

  it("D-22: exactly two clocks are offered, and the sketch's third ('last modified') is not", () => {
    expect(RETENTION_COPY.ported.clockDocumentDate).toBe("the document date")
    expect(RETENTION_COPY.ported.clockDateAdded).toBe("the day it was added to the Library")
    expect(JSON.stringify(RETENTION_COPY)).not.toContain("the day the file was last modified")
  })

  it("every SERVER sentence is hold_guard.py's own", () => {
    let checked = 0
    for (const value of Object.values(RETENTION_COPY.server)) {
      expect(holdGuardSource).toContain(`"${value}"`)
      checked++
    }
    expect(checked).toBe(3)
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

  it("D-17: the member hold line is EXACTLY the server's MEMBER_HOLD_LINE, with the second line beside it", () => {
    expect(RETENTION_COPY.contract.memberHoldLine).toBe("On legal hold. Ask an org admin.")
    expect(holdGuardSource).toContain(`MEMBER_HOLD_LINE = "${RETENTION_COPY.contract.memberHoldLine}"`)
    expect(RETENTION_COPY.contract.memberHoldSecond).toBe("It can't be deleted until the hold is released.")
  })

  it("D-11: the unticked-row note is the UI-SPEC's, NOT the sketch's (which promised a return next sweep)", () => {
    const note = RETENTION_COPY.contract.untickedNote
    expect(note).toBe("Unticked documents are kept. They are not proposed again unless the policy is edited or the document changes.")
    expect(sketchSource).not.toContain(note)
    expect(sketchSource).toContain("come back at the next sweep")
    // No retention string may carry the retired promise.
    const all = JSON.stringify(RETENTION_COPY)
    expect(all).not.toContain("come back at the next sweep")
  })

  it("D-05 / D-35: a count that cannot be computed reads as a sentence, never as 0", () => {
    expect(RETENTION_COPY.contract.countFailed).toBe("Couldn't count the documents yet.")
    expect(RETENTION_COPY.contract.countFailed).not.toMatch(/\d/)
  })

  it("fillCopy fills placeholders and resolves (s) against N; richParts splits bold runs", () => {
    const t = RETENTION_COPY.sketchTemplates.archivedHidden
    expect(fillCopy(t, { N: 1 })).toBe("1 archived document hidden")
    expect(fillCopy(t, { N: 3 })).toBe("3 archived documents hidden")
    expect(richParts(fillCopy(RETENTION_COPY.sketchTemplates.sectionDue, { date: "1 Jan 2030", policy: "P" }))).toEqual([
      { text: "Due 1 Jan 2030", bold: true },
      { text: " (“P”).", bold: false },
    ])
  })

  it("275-REVIEW IN-07: (s) is resolved on the TEMPLATE, so a name containing '(s)' is printed as written", () => {
    const out = fillCopy(RETENTION_COPY.sketchTemplates.lateHold, { M: 1, names: "Invoice(s).pdf" }, 1)
    expect(out).toContain("Invoice(s).pdf")
    expect(fillCopy(RETENTION_COPY.sketchTemplates.archivedHidden, { N: 2 })).toBe("2 archived documents hidden")
  })

  it("holdRefusalFor: a member never gets a matter name, an admin gets the first one", () => {
    expect(holdRefusalFor(undefined, false).message).toBe(RETENTION_COPY.server.documentMember)
    // A member payload has no names — but even if one leaked in, the member branch ignores it.
    expect(holdRefusalFor(["Secret matter"], false).message).not.toContain("Secret matter")
    expect(holdRefusalFor(["Halvorsen v. Halden"], true).message).toBe(
      "This document is on legal hold (“Halvorsen v. Halden”). Release the hold in Org admin → Retention first.",
    )
    expect(holdRefusalFor([], true).message).toBe(RETENTION_COPY.server.documentAdminNoMatter)
  })
})
