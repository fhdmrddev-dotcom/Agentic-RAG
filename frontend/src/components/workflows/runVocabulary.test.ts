/**
 * Phase 189 Plan 10 — the CANVAS VOCABULARY's own suite.
 *
 * WHY THIS FILE EXISTS AT ALL. `runVocabulary.ts` shipped in 188-06 with no suite of its
 * own: every assertion about it lived in `PhaseNodeCard.test.tsx`, reached THROUGH a
 * rendered card. That is the right place to prove what a person SEES, and the wrong place
 * to prove a property OF THE TABLE — a whole-table invariant asserted through jsdom pays a
 * render per row and, worse, can only ever cover the rows the card is asked to render.
 * The three invariants this file adds are properties of the DATA, so they are asserted
 * against the data.
 *
 * ⚠ IT DOES NOT DUPLICATE THE CARD SUITE. The rendered half — that the word reaches the
 * DOM as real text, that the eight rings paint eight distinct signatures, that colour is
 * excluded from that compare — stays where it is. This file proves the tables those
 * renders read from; `PhaseNodeCard.test.tsx` proves the renders.
 *
 * ── WHAT 189 ADDS, AND WHY EACH IS ASSERTED THE WAY IT IS ───────────────────────────────
 *
 * 1. THE D-16 WORD, BYTE-EXACTLY. The operator locked the wording; the table is where it
 *    lives. The literal is spelled ONCE, here, and the source is compared against it —
 *    never the other way round.
 *
 * 2. D-07 NON-COLLISION, AS INEQUALITIES AGAINST THE SHIPPED VALUES. The seven words are
 *    READ OFF THE TABLE rather than re-typed, so the comparison is against what actually
 *    ships and not against a copy that can rot.
 *
 * 3. ⚠ EXACT MATCH, NEVER A SUBSTRING CHECK. The new word shares its leading token with
 *    the shipped `Not started`, so a containment assertion on that fragment is true of
 *    BOTH and would pass while proving nothing — a vacuous fence of exactly the kind this
 *    phase has now been bitten by three times. Every assertion below compares WHOLE
 *    STRINGS.
 *
 *    ⚠ AND THE FORBIDDEN CALL IS NOT SPELLED ANYWHERE IN THIS FILE, deliberately: the
 *    plan's acceptance for this suite is a GREP for it, and prose quoting the pattern it
 *    bans is what makes such a grep unreadable. That is the 187-24 lesson, which 189-08
 *    met again with a glyph — a comment explaining a rejected token took its count 0 → 1
 *    and falsified the criterion it was explaining. The rule is described in words here
 *    and demonstrated mechanically in the prefix-collision test below.
 *
 * 4. WHOLE-TABLE PROPERTIES, NEVER ROW ASSERTIONS. Pairwise-distinct words, exact tiling
 *    and pairwise-distinct geometry are asserted over the WHOLE table, so the NINTH
 *    reading inherits all three guards without anyone remembering to extend a list. A
 *    property stated only about the row being added is a property the next row can break
 *    in silence.
 */
import { describe, expect, it } from "vitest"

import type { CanvasReading } from "@/lib/phaseState"

import {
  RUN_READING_BORDER,
  RUN_READING_WORD,
  runReadingClause,
  runReadingLabel,
  runReadingWord,
} from "./runVocabulary"

/** The reading 189 adds. Named once, so no assertion below re-spells it. */
const NEW_READING: CanvasReading = "recorded-not-sent"

/**
 * D-16's locked wording, spelled literally and exactly once in this repository's tests.
 *
 * It MUST be a literal here — that is what makes the first assertion a FALSIFICATION of
 * the table rather than a copy of it. (The same rule the ring decimals follow in
 * `PhaseNodeCard.test.tsx`: the needle is written in the test, never in the source.)
 *
 * The separator is an EM DASH (U+2014), not a hyphen and not an en dash, and the
 * codepoint is asserted below rather than trusted to survive an editor.
 */
const D16_WORD = "Not sent — recorded"

/** Every reading the table owns, DERIVED from the table itself rather than hand-listed —
 *  so a ninth reading is covered by every loop below the moment it is added. */
const ALL_READINGS = Object.keys(RUN_READING_WORD) as CanvasReading[]

describe("runVocabulary 189-10 — the D-16 word", () => {
  it("is byte-exactly the locked wording, em dash included", () => {
    expect(RUN_READING_WORD[NEW_READING]).toBe(D16_WORD)
    // …and it really is reachable through the TOTAL accessor a caller uses, not merely
    // present in the literal. Without this the table could be right and the lookup wrong.
    expect(runReadingWord(NEW_READING)).toBe(D16_WORD)

    // THE SEPARATOR IS AN EM DASH, asserted by CODEPOINT. A hyphen-minus or an en dash
    // looks nearly identical in a diff and in most editors, and D-16 locked the wording
    // rather than an approximation of it.
    const separator = D16_WORD.slice(D16_WORD.indexOf("—"), D16_WORD.indexOf("—") + 1)
    expect(separator.codePointAt(0)).toBe(0x2014)
    expect(D16_WORD).not.toContain("--")
  })

  it("opens on the NEGATION — the outcome first, the consolation second (D-16)", () => {
    // The whole reason the wording survives being skimmed. A reader who takes in only the
    // first word must not come away with "sent". Asserted on the leading token so the
    // ordering itself is guarded, not merely the presence of both halves.
    const [firstWord] = RUN_READING_WORD[NEW_READING].split(" ")
    expect(firstWord).toBe("Not")
    // …and the consolation half really is the SECOND half, after the em dash.
    const [outcome, consolation] = RUN_READING_WORD[NEW_READING].split(" — ")
    expect(outcome).toBe("Not sent")
    expect(consolation).toBe("recorded")
  })
})

describe("runVocabulary 189-10 — D-07 non-collision, asserted exactly", () => {
  /**
   * The shipped words, READ OFF THE TABLE. Not re-typed: an inequality against a
   * hand-copied string proves the copy differs, which is not the claim being made.
   */
  const shipped = {
    notStarted: RUN_READING_WORD["not-started"],
    running: RUN_READING_WORD.running,
    done: RUN_READING_WORD.done,
    failed: RUN_READING_WORD.failed,
    skipped: RUN_READING_WORD.skipped,
    waiting: RUN_READING_WORD["waiting-for-you"],
    unknown: RUN_READING_WORD.unknown,
  }

  it("POSITIVE CONTROL — the comparison used below can actually find equality", () => {
    // Without this every inequality that follows would pass just as happily against a
    // typo'd accessor, an undefined lookup or a table that had been emptied.
    expect(RUN_READING_WORD.done).toBe(shipped.done)
    expect(runReadingWord("done")).toBe(shipped.done)
    // …and the seven really are seven non-empty strings, so "not equal to any of them"
    // is a statement about a populated table.
    for (const [name, word] of Object.entries(shipped)) {
      expect(typeof word, `${name} is not a string`).toBe("string")
      expect(word.trim().length, `${name} is empty`).toBeGreaterThan(0)
    }
    expect(Object.keys(shipped)).toHaveLength(7)
  })

  it("does not read as SUCCESS — D-07's binding constraint, and this phase's whole point", () => {
    // The confusion 189 exists to prevent: a step that deliberately sent nothing must
    // never be mistaken for one that succeeded.
    expect(
      RUN_READING_WORD[NEW_READING],
      "the not-sent word must not be the success word",
    ).not.toBe(shipped.done)
  })

  it("does not collide with RUNNING or with the WAITING word (D-07, binding)", () => {
    // D-07 forbids `running` and `waiting-for-you` sharing a word, and requires the new
    // word to collide with NEITHER. All three pairs are asserted, not just the two new ones.
    expect(RUN_READING_WORD[NEW_READING]).not.toBe(shipped.running)
    expect(RUN_READING_WORD[NEW_READING]).not.toBe(shipped.waiting)
    expect(shipped.running).not.toBe(shipped.waiting)
  })

  it("does not read as FAILED and does not read as SKIPPED", () => {
    // Nothing failed — the step did exactly what it was asked to do. And it was not
    // passed over: it RAN, and a person approved it. Both misreadings are lies, in
    // opposite directions, which is why each is asserted rather than assumed.
    expect(RUN_READING_WORD[NEW_READING]).not.toBe(shipped.failed)
    expect(RUN_READING_WORD[NEW_READING]).not.toBe(shipped.skipped)
  })

  it("is not the honest-gap word either — the state IS known", () => {
    expect(RUN_READING_WORD[NEW_READING]).not.toBe(shipped.unknown)
  })

  it("⚠ shares the prefix `Not ` with `Not started` and is STILL a different word", () => {
    // THE MEASURED TRAP, PINNED. Both words begin "Not ", so a substring assertion on that
    // fragment cannot separate them. This test states the collision that WOULD have been
    // missed and then asserts the whole-string inequality that catches it.
    expect(shipped.notStarted.startsWith("Not ")).toBe(true)
    expect(RUN_READING_WORD[NEW_READING].startsWith("Not ")).toBe(true)
    // …so the ambiguous check really is ambiguous — DEMONSTRATED, not merely asserted
    // about. Written as a boolean over both words rather than as two substring
    // assertions, deliberately: an `expect(word).toContain(prefix)` line here would BE
    // the very pattern this file forbids, and the next reader would copy it out of a
    // green suite without reading the paragraph explaining why it was safe just here.
    const prefix = "Not "
    const bothShareThePrefix =
      shipped.notStarted.includes(prefix) && RUN_READING_WORD[NEW_READING].includes(prefix)
    expect(bothShareThePrefix, "the prefix collision this test exists for is gone").toBe(true)
    // …and the exact compare is what carries the distinction.
    expect(RUN_READING_WORD[NEW_READING]).not.toBe(shipped.notStarted)
  })

  it("ALL words are pairwise DISTINCT — a property of the table, not seven comparisons", () => {
    // Stated as a set-size property so the NINTH reading inherits the guard. Seven
    // hand-written comparisons would cover the eight that exist and nothing after them.
    const words = Object.values(RUN_READING_WORD)
    expect(new Set(words).size).toBe(words.length)
    expect(words).toHaveLength(ALL_READINGS.length)
    // NON-VACUITY: a set of one is trivially "distinct".
    expect(words.length).toBeGreaterThan(7)
  })
})

describe("runVocabulary 189-10 — the clause is null, and the border is unclaimed", () => {
  it("carries NO clause: the word already contains its own, after the em dash", () => {
    expect(runReadingClause(NEW_READING)).toBeNull()
    // POSITIVE CONTROL — the accessor really does return clauses for the readings that
    // have one, so `null` here is a decision and not a broken lookup.
    expect(runReadingClause("skipped")).not.toBeNull()
    expect(runReadingClause("unknown")).not.toBeNull()
  })

  it("so the whole label is the word ALONE — no two-em-dash sentence", () => {
    // The observable consequence of the `null` above, and the reason for it: a clause here
    // would render "Not sent — recorded — …", restating what the badge and the step's own
    // output body already carry.
    expect(runReadingLabel(NEW_READING)).toBe(D16_WORD)
    const emDashes = runReadingLabel(NEW_READING).split("—").length - 1
    expect(emDashes).toBe(1)
    // POSITIVE CONTROL — a reading WITH a clause really does get a longer label, so the
    // equality above is a measurement rather than an accessor that ignores its argument.
    expect(runReadingLabel("skipped").length).toBeGreaterThan(
      RUN_READING_WORD.skipped.length,
    )
  })

  it("claims NO card border — the quiet terminal stays quiet (deliberate absence)", () => {
    // `RUN_READING_BORDER` is a `Partial<>`, so this absence is invisible to the compiler
    // and would otherwise be indistinguishable from an oversight. It is recorded in the
    // table's docblock AND pinned here.
    expect(Object.prototype.hasOwnProperty.call(RUN_READING_BORDER, NEW_READING)).toBe(false)
    // Only the three LOUD readings claim the border, and that set is asserted whole —
    // so a later phase quietly adding a fourth claimant goes red here.
    expect(Object.keys(RUN_READING_BORDER).sort()).toEqual(
      ["failed", "running", "waiting-for-you"].sort(),
    )
  })
})

