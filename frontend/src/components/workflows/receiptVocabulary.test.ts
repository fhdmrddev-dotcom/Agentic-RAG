/**
 * Phase 200-05 Task 1 (DES-02 / D-09 / X-11) — `receiptVocabulary.ts`.
 *
 * WHAT WOULD BE UNGUARDED WITHOUT THIS FILE:
 *  • that the module IMPORTS NOTHING FROM `library/` — X-11's whole finding. Importing
 *    `libraryVocabulary.ts` from outside `library/**` would not TRIP its 14-path fence, it
 *    would BREAK the fence's contract (`LIBRARY_SUBTREE_PATHS` would stop describing the
 *    subtree's blast radius), so nothing in that suite can catch it and this one must;
 *  • that no string here EQUALS any of `runVocabulary.ts`'s LOCKED canvas words — the two
 *    registers speak to different audiences and copying one into the other is the recorded
 *    defect;
 *  • that the module is a TRUE LEAF (zero imports), which is what makes an ESM cycle
 *    impossible by construction;
 *  • that it exports ZERO glyph strings;
 *  • EXACT-MATCH values for every governed id, because several readings share a lead word
 *    and a `toContain` on any fragment would pass while proving nothing.
 */
import { describe, it, expect } from "vitest"
import receiptVocabularySource from "./receiptVocabulary?raw"
import * as V from "./receiptVocabulary"
import { RUN_READING_WORD } from "./runVocabulary"

/** Every EXPORTED STRING CONSTANT in the module — the whole governed table, read back. */
const CONSTANTS: Record<string, string> = Object.fromEntries(
  Object.entries(V).filter(([, v]) => typeof v === "string") as [string, string][],
)

describe("receiptVocabulary — the module's shape", () => {
  it("is a TRUE LEAF: it imports nothing at all", () => {
    // The `decisionsVocabulary.ts` contract. A leaf with no edges cannot sit on a cycle.
    expect(receiptVocabularySource.split(/^import\s/m).length - 1).toBe(0)
    // NON-VACUITY: the source really was read, and it really does declare exports.
    expect(receiptVocabularySource.length).toBeGreaterThan(2000)
    expect(receiptVocabularySource).toContain("export const")
  })

  it("⚠ NEVER imports `libraryVocabulary` — the REGISTER is D-09's model, not the MODULE", () => {
    // X-11: that module is fenced to `library/**` by an explicit 14-path list. An import
    // from here would put library words on a non-library surface AND make
    // `LIBRARY_SUBTREE_PATHS` stop describing the subtree — which its own fence cannot see.
    expect(receiptVocabularySource.split("libraryVocabulary").length - 1).toBe(0)
    expect(receiptVocabularySource.split("library/").length - 1).toBe(0)
  })

  it("POSITIVE CONTROL — the two needles above really can find what they forbid", () => {
    const planted = 'import { LIB } from "./library/libraryVocabulary"'
    expect(planted.split("libraryVocabulary").length - 1).toBe(1)
    expect(planted.split("library/").length - 1).toBe(1)
    expect(planted.split(/^import\s/m).length - 1).toBe(1)
  })

  it("exports ZERO glyph strings", () => {
    // `runVocabulary.ts` exports none and the library's own vocabulary nets none. A mark on
    // this surface is a decision for `icon-convention.md`, never for a vocabulary module.
    // The range covers arrows, dingbats, misc-symbols and every astral (emoji) codepoint.
    const GLYPHY = /[←-⯿️]|[\uD800-\uDBFF][\uDC00-\uDFFF]/
    for (const [id, value] of Object.entries(CONSTANTS)) {
      expect(`${id}:${value}`).not.toMatch(GLYPHY)
    }
    // NON-VACUITY: the needle finds the real marks this repo actually ships elsewhere —
    // the spine's own View-only eye and its dashed-branch arrow.
    expect("\u{1F441} View only").toMatch(GLYPHY)
    expect("⤳").toMatch(GLYPHY)
  })

  it("holds the WHOLE table, not a subset — every governed id is exported", () => {
    for (const id of [
      "HEADER_SPAN_NOT_RECORDED",
      "HEADER_NOT_FINISHED",
      "HEADER_SEPARATOR",
      "OUTCOME_FINISHED",
      "OUTCOME_FAILED",
      "OUTCOME_NEVER_RAN",
      "OUTCOME_INTERRUPTED",
      "OUTCOME_STILL_RUNNING",
      "OUTCOME_NOT_REACHED",
      "OUTCOME_UNKNOWN",
      "OUTCOME_DID_NOT_FINISH",
      "OUTCOME_PAUSED",
      "TIME_NOT_RECORDED",
      "BRANCH_TAKEN",
      "BRANCH_NOT_TAKEN",
    ]) {
      expect(CONSTANTS[id], `missing governed id ${id}`).toBeTypeOf("string")
      expect(CONSTANTS[id].length).toBeGreaterThan(0)
    }
    for (const fn of [
      "headerSpan",
      "headerSteps",
      "headerFinished",
      "timeRan",
      "timeRunning",
      "timeInterrupted",
      "timeFailed",
      "countDeclared",
    ]) {
      expect(V[fn as keyof typeof V]).toBeTypeOf("function")
    }
  })
})

describe("receiptVocabulary — ⚠ it duplicates NONE of runVocabulary's locked canvas words", () => {
  it("no exported string EQUALS any canvas reading word", () => {
    const canvas = new Set(Object.values(RUN_READING_WORD))
    // NON-VACUITY FIRST: assert the comparison set is real before asserting a negative
    // against it — otherwise every inequality below passes against an empty set.
    expect(canvas.size).toBeGreaterThanOrEqual(8)
    for (const [id, value] of Object.entries(CONSTANTS)) {
      expect(canvas.has(value), `${id} duplicates a locked canvas word`).toBe(false)
    }
  })

  it("POSITIVE CONTROL — the comparison really does fire on a canvas word", () => {
    const canvas = new Set(Object.values(RUN_READING_WORD))
    expect(canvas.has(RUN_READING_WORD.running)).toBe(true)
  })

  it("no two governed ids share a value — EXACT-MATCH assertions stay unambiguous", () => {
    const values = Object.values(CONSTANTS)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe("receiptVocabulary — the exact strings", () => {
  it("the header's three atoms", () => {
    expect(V.headerSpan("4m 12s")).toBe("Ran 4m 12s")
    expect(V.headerSteps(6)).toBe("6 steps")
    expect(V.headerSteps(1)).toBe("1 step")
    expect(V.headerSteps(0)).toBe("0 steps")
    expect(V.headerFinished("14:22")).toBe("finished 14:22")
    expect(V.HEADER_SEPARATOR).toBe(" · ")
  })

  it("the two header ABSENCE arms say DIFFERENT things", () => {
    expect(V.HEADER_SPAN_NOT_RECORDED).toBe("Runtime not recorded")
    expect(V.HEADER_NOT_FINISHED).toBe("no finish time recorded")
    expect(V.HEADER_SPAN_NOT_RECORDED).not.toBe(V.HEADER_NOT_FINISHED)
  })

  it("the outcome words", () => {
    expect(V.OUTCOME_FINISHED).toBe("finished")
    expect(V.OUTCOME_FAILED).toBe("stopped on an error")
    expect(V.OUTCOME_NEVER_RAN).toBe("never ran (skipped)")
    expect(V.OUTCOME_INTERRUPTED).toBe("interrupted")
    expect(V.OUTCOME_STILL_RUNNING).toBe("still running")
    expect(V.OUTCOME_NOT_REACHED).toBe("not reached")
    expect(V.OUTCOME_UNKNOWN).toBe("outcome not recorded")
    expect(V.OUTCOME_DID_NOT_FINISH).toBe("did not finish")
    expect(V.OUTCOME_PAUSED).toBe("paused, waiting on a person")
  })

  it("the time readings", () => {
    expect(V.timeRan("1.8s")).toBe("1.8s")
    expect(V.timeRunning("12s")).toBe("12s so far")
    expect(V.timeInterrupted("8s")).toBe("ran 8s, interrupted")
    expect(V.timeFailed("4s")).toBe("stopped after 4s")
    expect(V.TIME_NOT_RECORDED).toBe("time not recorded")
  })

  it("⚠ `never ran` and `time not recorded` are DIFFERENT SENTENCES (D-06's headline)", () => {
    expect(V.OUTCOME_NEVER_RAN).not.toBe(V.TIME_NOT_RECORDED)
    // And neither is a substring of the other, so no assertion anywhere can confuse them.
    expect(V.OUTCOME_NEVER_RAN.includes(V.TIME_NOT_RECORDED)).toBe(false)
    expect(V.TIME_NOT_RECORDED.includes(V.OUTCOME_NEVER_RAN)).toBe(false)
  })

  it("the count phrase renders the wire's pair VERBATIM, `0` included", () => {
    expect(V.countDeclared(312, "sources")).toBe("312 sources")
    expect(V.countDeclared(0, "sources")).toBe("0 sources")
    // ⚠ A noun this client never heard of still renders — the executor owns that word.
    expect(V.countDeclared(7, "widgets")).toBe("7 widgets")
  })

  it("names §5.1's three AUTHORED nouns as a documented expectation, never a render source", () => {
    expect([...V.RECEIPT_KNOWN_COUNT_NOUNS]).toEqual(["sources", "agents", "fields"])
    // ⚠ It is NOT consulted by the renderer: an unknown noun rendered fine one case above.
    expect(receiptVocabularySource).toContain("NEVER A RENDER SOURCE")
  })

  it("the branch readings, and neither names the mechanism", () => {
    expect(V.BRANCH_TAKEN).toBe("branch taken")
    expect(V.BRANCH_NOT_TAKEN).toBe("branch not taken")
    for (const word of [V.BRANCH_TAKEN, V.BRANCH_NOT_TAKEN]) {
      expect(word).not.toContain("skip_to_phase")
      expect(word).not.toContain("phase_index")
    }
  })
})
