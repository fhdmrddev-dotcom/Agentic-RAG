/**
 * Phase 308.1-04 Task 1 (D-22, D-23; UI-SPEC D-UI-01, P14) — the follow-view words.
 *
 * Reads the module SOURCE (`?raw`) as well as its exports, the way
 * `publishRefusalVocabulary.test.ts` does: the leaf imports nothing, every dash in a
 * string is an EM DASH (U+2014), no string carries an exclamation mark, C-07 carries no
 * failure word, and every exported string equals the approved UI-SPEC text exactly.
 */
import { describe, it, expect } from "vitest"

import * as vocab from "./publishFollowVocabulary"
import source from "./publishFollowVocabulary?raw"

const { PUBLISH_FOLLOW_COPY, PUBLISH_PROGRESS, PUBLISH_PROGRESS_UNNAMED, publishHonestyText } = vocab

/** Every string literal in the module source (double-quoted and template literals). */
function stringLiterals(src: string): string[] {
  const out: string[] = []
  const re = /"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g
  // Skip comment lines so prose in the docblock is not mistaken for copy.
  const code = src
    .split("\n")
    .filter((line) => !/^\s*(\*|\/\*\*|\/\/)/.test(line))
    .join("\n")
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) out.push(m[1] ?? m[2] ?? "")
  return out
}

describe("publishFollowVocabulary — a zero-import leaf (P14)", () => {
  it("non-vacuity: the raw source was read", () => {
    expect(source.length).toBeGreaterThan(500)
  })

  it("imports nothing", () => {
    expect(source.split("\n").filter((l) => /^\s*import\b/.test(l))).toEqual([])
  })
})

describe("publishFollowVocabulary — the characters (P14)", () => {
  const literals = stringLiterals(source)

  it("non-vacuity: the literal walk finds the copy", () => {
    expect(literals.length).toBeGreaterThan(8)
    expect(literals.some((s) => s.includes("keeps running"))).toBe(true)
  })

  it("every dash used as a dash is U+2014 (no spaced hyphen, no en dash)", () => {
    for (const s of literals) {
      expect(s, s).not.toMatch(/ - /)
      expect(s, s).not.toContain("–")
    }
  })

  it("no exclamation mark inside any string literal", () => {
    for (const s of literals) expect(s, s).not.toContain("!")
  })

  it("C-07 carries no failure word", () => {
    const c07 = PUBLISH_FOLLOW_COPY.followError.toLowerCase()
    for (const word of ["failed", "error", "timed out"]) expect(c07).not.toContain(word)
  })

  it("POSITIVE CONTROL — the dash walk catches a spaced hyphen and an en dash", () => {
    expect(stringLiterals('const x = "a - b"')).toEqual(["a - b"])
    expect("a – b").toContain("–")
  })
})

describe("publishFollowVocabulary — every string equals the UI-SPEC text exactly", () => {
  it("C-01 .. C-10", () => {
    expect(PUBLISH_FOLLOW_COPY.checking).toBe("Checking…")
    expect(PUBLISH_FOLLOW_COPY.headingRunning).toBe("Running the golden run on your KB…")
    expect(PUBLISH_FOLLOW_COPY.headingFinishing).toBe("Golden run finished — reviewing the result…")
    expect(PUBLISH_FOLLOW_COPY.starting).toBe("Starting the run…")
    expect(PUBLISH_FOLLOW_COPY.finishing).toBe(
      "The trial run finished. Checking its citations, then the independent review grades the result.",
    )
    expect(PUBLISH_FOLLOW_COPY.followError).toBe(
      "Can't reach the server right now — still trying. The publish keeps running on the server either way.",
    )
    expect(PUBLISH_FOLLOW_COPY.closeWhileFollowing).toBe("Close — the check keeps running")
    expect(PUBLISH_FOLLOW_COPY.lost).toBe(
      "This publish can no longer be found. Publish again to start a new check.",
    )
    expect(PUBLISH_FOLLOW_COPY.watchLive).toBe("▦ Watch the golden run live ›")
  })

  it("C-04 / C-04b — the progress line", () => {
    expect(PUBLISH_PROGRESS({ index: 2, count: 5, name: "Collect evidence" })).toBe("Step 2 of 5: Collect evidence")
    expect(PUBLISH_PROGRESS_UNNAMED({ index: 2, count: 5 })).toBe("Step 2 of 5")
  })

  it("C-06 — the honesty paragraph, whole, with exactly four bold spans", () => {
    expect(publishHonestyText()).toBe(
      "Publish runs your whole workflow for real against your knowledge base, then an independent judge grades the result — so a multi-step workflow can take a few minutes. Same harness, same tools, same model, so the judge grades a real deliverable, not a dry-run. You can close this window — the check keeps running. Open Publish again to see where it is. Editing the workflow before it finishes makes this publish refuse, because the check is for the version you sent.",
    )
    const bold = PUBLISH_FOLLOW_COPY.honesty.filter((p) => p.bold).map((p) => p.text)
    expect(bold).toEqual(["whole workflow for real", "few minutes", "real", "keeps running"])
  })

  it("C-06 never tells the author not to close the tab", () => {
    expect(publishHonestyText().toLowerCase()).not.toContain("don't close")
  })
})
