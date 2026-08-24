/**
 * Phase 200 — `transcriptVocabulary.ts`'s guard, pinned in the commit that created it.
 *
 * WHAT WOULD BE UNGUARDED WITHOUT THIS FILE:
 *  • that the module's two absence headlines are DIFFERENT SENTENCES — *"no steps"* and
 *    *"no times"* are two facts, and this repo has folded that pair wrong three times
 *    (`runFacts.ts` CR-01, `DecisionsList` D-20, `phaseDuration.ts`'s own nine arms);
 *  • that nothing exported here DUPLICATES a word that already has a home — neither
 *    `receiptVocabulary.ts`'s exports nor any value in `RUN_READING_WORD`. Duplication is
 *    how a second home appears while every file still looks like it has one;
 *  • that the module spends ZERO GLYPHS, so a mark on this surface stays a decision for
 *    `icon-convention.md` rather than a thing a vocabulary quietly introduced;
 *  • that every export is a NON-EMPTY string — an empty governed string renders as an
 *    absence while reading, in source, exactly like a present one.
 *
 * ⚠ EXACT-MATCH ASSERTIONS ONLY, inherited from `receiptVocabulary.test.ts` for its stated
 * mechanical reason: a `toContain` on a fragment passes while proving nothing.
 */
import { describe, it, expect } from "vitest"
import * as TRANSCRIPT from "./transcriptVocabulary"
import * as RECEIPT from "./receiptVocabulary"
import { RUN_READING_WORD } from "./runVocabulary"
import {
  TRANSCRIPT_LANDMARK_LABEL,
  TRANSCRIPT_NO_STEPS,
  TRANSCRIPT_TIMES_NOT_RECORDED,
  SPINE_HEADING,
  CENTRE_LOG_LABEL,
  CENTRE_CANVAS_LABEL,
  CENTRE_SWITCH_LABEL,
} from "./transcriptVocabulary"

/** Every string this module exports, read off the module rather than hand-listed — so a
 *  NEW export is covered by the sweeps below on the day it lands, not on the day someone
 *  remembers to add it here. */
const EXPORTED: string[] = Object.values(TRANSCRIPT).filter(
  (v) => typeof v === "string",
) as string[]

describe("transcriptVocabulary — the seven governed strings", () => {
  it("exports exactly the seven, and the module holds nothing else", () => {
    // ⚠ A COUNT, so an export added without a decision fails a test rather than arriving
    // silently. It is not a ceiling on the module — it is a requirement that growing it is
    // deliberate, which is what `doorVocabulary.ts`'s own governed-id count buys.
    expect(EXPORTED).toHaveLength(7)
    expect(EXPORTED).toEqual(
      expect.arrayContaining([
        TRANSCRIPT_LANDMARK_LABEL,
        TRANSCRIPT_NO_STEPS,
        TRANSCRIPT_TIMES_NOT_RECORDED,
        SPINE_HEADING,
        CENTRE_LOG_LABEL,
        CENTRE_CANVAS_LABEL,
        CENTRE_SWITCH_LABEL,
      ]),
    )
  })

  it("every export is a non-empty string", () => {
    for (const value of EXPORTED) expect(value.trim().length).toBeGreaterThan(0)
  })
})

describe("transcriptVocabulary — the two absences are two sentences", () => {
  /**
   * ⚠ THE ONE THAT MATTERS. *"This run recorded no steps"* and *"this run's steps have no
   * recorded times"* are different facts about different runs, and a module that let them
   * collapse would print "nothing happened" about a run that did plenty. The component picks
   * between them on `phases.length === 0` versus `runAnchorMs(...) === null`; this asserts
   * there really are two things to pick between.
   */
  it("the no-steps headline and the no-times headline are not the same string", () => {
    expect(TRANSCRIPT_NO_STEPS).not.toBe(TRANSCRIPT_TIMES_NOT_RECORDED)
  })

  it("neither headline is the landmark, so the region cannot be named by its own error", () => {
    expect(TRANSCRIPT_LANDMARK_LABEL).not.toBe(TRANSCRIPT_NO_STEPS)
    expect(TRANSCRIPT_LANDMARK_LABEL).not.toBe(TRANSCRIPT_TIMES_NOT_RECORDED)
  })
})

describe("transcriptVocabulary — no string here has a home somewhere else", () => {
  /**
   * ⚠ COMPARED AGAINST THE REAL EXPORTS, never against a copy pasted into this file. A
   * hand-listed set drifts the moment the other module gains a word, and a drifting guard
   * reports `0 duplicates` for the reason that it can no longer see them.
   */
  it("duplicates nothing exported by receiptVocabulary", () => {
    const receiptStrings = new Set<string>(
      Object.values(RECEIPT).filter((v) => typeof v === "string") as string[],
    )
    // NON-VACUITY: the comparison set is real and populated.
    expect(receiptStrings.size).toBeGreaterThan(5)
    for (const value of EXPORTED) expect(receiptStrings.has(value)).toBe(false)
  })

  it("duplicates no canvas reading word", () => {
    const canvasWords = new Set<string>(Object.values(RUN_READING_WORD))
    expect(canvasWords.size).toBeGreaterThan(0)
    for (const value of EXPORTED) expect(canvasWords.has(value)).toBe(false)
  })
})

describe("transcriptVocabulary — zero glyphs", () => {
  /**
   * Rule 2, inherited verbatim: a mark on this surface is a decision for the icon
   * convention, not something a vocabulary module introduces on the way past.
   *
   * ⚠ THE PROBE IS A CHARACTER-CLASS SWEEP, NOT A LIST OF FORBIDDEN MARKS. A list can only
   * catch the glyphs someone already thought of, and the whole failure mode here is a mark
   * nobody thought about.
   */
  it("exports only characters a keyboard produces", () => {
    for (const value of EXPORTED) {
      expect(value).toMatch(/^[\x20-\x7E’—]+$/)
    }
    // POSITIVE CONTROL — the sweep really does reject a mark.
    expect("Run log ✓").not.toMatch(/^[\x20-\x7E’—]+$/)
  })
})
