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
  RING_GEOMETRY,
  RUN_READING_BORDER,
  RUN_READING_WORD,
  ringDash,
  ringSpecFor,
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


// ── THE RING TABLE — whole-table invariants nobody had asserted ────────────────────────
//
// Everything below is Task 2's half. It is sited in this file rather than in the card
// suite because each is a property of `RING_GEOMETRY` itself: they hold whether or not a
// card is ever rendered, and asserting them over the table is what makes them survive a
// reading whose card the suite never asks for.
//
// ⚠ jsdom CANNOT PROVE GREYSCALE DISTINGUISHABILITY. It applies no CSS and paints
// nothing, so nothing in this file — or in any unit test — is evidence that a person can
// tell two rings apart by looking. These assertions prove the ATTRIBUTE-level distinction:
// that the emitted geometry differs, and differs in a property that is nameable. The
// VISUAL half is U3, a driven Chrome MCP row in plan 189-16, and it is not optional
// merely because this file is green.

/** The ring's shipped radius (`NodeRunOverlay.RING_RADIUS`) and the circumference every
 *  dash pattern is computed from. Re-derived here rather than imported: the overlay does
 *  not export it, and a test that recomputed it from the source it is checking would be
 *  agreeing with itself. Pinned against the DOM in `PhaseNodeCard.test.tsx`. */
const RING_RADIUS = 34
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/** The number of dash/gap PAIRS a reading's rendered pattern names. `0` ⇒ it emits no
 *  dasharray at all (the closed ring, and the reading with no arc). */
function pairCountOf(reading: CanvasReading): number {
  const dash = ringDash(ringSpecFor(reading), CIRCUMFERENCE)
  if (dash === null || dash.dasharray === null) return 0
  return dash.dasharray.trim().split(/\s+/).length / 2
}

describe("runVocabulary 189-10 — the whole ring table tiles the circle EXACTLY", () => {
  it("every fraction row satisfies repeats × (dash + gap) === 1", () => {
    // TRUE OF ALL SEVEN SHIPPED ROWS AND ASSERTED NOWHERE UNTIL NOW. It is what stops a
    // seam appearing where the pattern wraps at the path start, and it is precisely the
    // kind of property that gets broken by a plausible-looking row (`repeats: 3` with a
    // two-decimal dash+gap cannot satisfy it) because nobody ever wrote it down.
    const fractionRows = ALL_READINGS.map((reading) => [reading, RING_GEOMETRY[reading]] as const)
      .filter(([, spec]) => spec.kind === "fraction")

    for (const [reading, spec] of fractionRows) {
      if (spec.kind !== "fraction") continue // narrowing only; filtered above
      const { dash, gap, repeats } = spec.arc
      expect(repeats * (dash + gap), `${reading} does not tile the circle`).toBeCloseTo(1, 10)
    }

    // NON-VACUITY: an empty filter satisfies a for-loop forever. There are four fraction
    // rows as this is written, and the floor is stated so a table that lost them all
    // cannot pass.
    expect(fractionRows.length).toBeGreaterThanOrEqual(4)
  })

  it("…and the rendered pattern really does sum to the circumference, per repeat", () => {
    // The tiling invariant restated on the OUTPUT rather than the input, so it also
    // catches `ringDash` mis-multiplying rather than only the table being mis-authored.
    for (const reading of ALL_READINGS) {
      const spec = RING_GEOMETRY[reading]
      if (spec.kind !== "fraction") continue
      const dash = ringDash(spec, CIRCUMFERENCE)!
      const numbers = dash.dasharray!.trim().split(/\s+/).map(Number)
      const total = numbers.reduce((a, b) => a + b, 0)
      expect(total, `${reading}'s pattern does not close on the circle`).toBeCloseTo(
        CIRCUMFERENCE,
        1,
      )
    }
  })
})

describe("runVocabulary 189-10 — the eighth ring is the ONLY one drawn in FOUR arcs", () => {
  it("counts the dash/gap pairs — a machine check, never an eyeball", () => {
    // THE ASSERTABLE UNIQUE PROPERTY, and the reason `repeats: 4` was chosen over any
    // other shape. Every other fraction row names one or two pairs, `solid` emits none,
    // and the two `length` rows emit an unbounded texture (one authored pair, repeated by
    // the renderer). Four is unclaimed, and the count is what a test can assert.
    const fourArc = ALL_READINGS.filter((reading) => pairCountOf(reading) === 4)
    expect(fourArc).toEqual([NEW_READING])
  })

  it("POSITIVE CONTROLS — the counter really counts, at every other row", () => {
    // Without these the assertion above passes on a counter that returns 4 for one input
    // and throws away the rest.
    expect(pairCountOf("running")).toBe(1)
    expect(pairCountOf("waiting-for-you")).toBe(1)
    expect(pairCountOf("failed")).toBe(2)
    expect(pairCountOf("done")).toBe(0) // the closed ring emits no dasharray
    expect(pairCountOf("not-started")).toBe(0) // no arc element at all
    expect(pairCountOf(NEW_READING)).toBe(4)
  })

  it("does NOT animate — motion stays `running`'s own uniqueness property", () => {
    // ⚠ LOAD-BEARING, AND THE REASON THE SEPARATION IS BY COUNT. The run is OVER for this
    // phase; a spinning terminal would claim work still in flight. And because `running`
    // is the only reading that moves, a distinction that leaned on motion would evaporate
    // under `prefers-reduced-motion` — the arc COUNT survives it.
    const spec = RING_GEOMETRY[NEW_READING]
    expect(spec.kind).toBe("fraction")
    if (spec.kind !== "fraction") throw new Error("unreachable — pinned above")
    expect(spec.spinning).toBe(false)
    expect(ringDash(spec, CIRCUMFERENCE)!.spinning).toBe(false)

    // …and `running` really is the ONLY row that spins, asserted over the whole table so
    // a second spinner cannot be added in silence.
    const spinning = ALL_READINGS.filter(
      (reading) => ringDash(ringSpecFor(reading), CIRCUMFERENCE)?.spinning === true,
    )
    expect(spinning).toEqual(["running"])
  })

  it("places NO gap at 12 o'clock — the waiting reading's signature stays its own", () => {
    // An SVG circle starts at 3 o'clock and runs clockwise, so 12 o'clock is 0.75C.
    // `gapCentre: 0.125` puts the four gaps on the 45° diagonals — 0.125, 0.375, 0.625,
    // 0.875 — so none lands on a cardinal point, and the pause chip's quadrant is
    // untouched. Computed from the row, never from the four numbers just quoted.
    const spec = RING_GEOMETRY[NEW_READING]
    if (spec.kind !== "fraction") throw new Error("unreachable")
    const { repeats, gapCentre } = spec.arc
    expect(gapCentre).not.toBeNull()
    const centres = Array.from({ length: repeats }, (_, i) => (gapCentre! + i / repeats) % 1)
    expect(centres).toHaveLength(4)
    for (const centre of centres) {
      expect(Math.abs(centre - 0.75), `a gap sits at 12 o'clock`).toBeGreaterThan(0.05)
    }

    // POSITIVE CONTROL — the waiting reading's gap IS at 12 o'clock, so the check above is
    // capable of finding one. Without it the assertion passes on any arithmetic at all.
    const waiting = RING_GEOMETRY["waiting-for-you"]
    if (waiting.kind !== "fraction") throw new Error("unreachable")
    expect(waiting.arc.gapCentre).toBe(0.75)
  })

  it("keeps the computed dashoffset POSITIVE, like every shipped row", () => {
    // Not a correctness property — a negative offset renders identically — but a
    // consistency one the whole table has held so far, and the reason `0.125` was chosen
    // over `0` or `0.25`. Asserted over the table so it stays a table property.
    for (const reading of ALL_READINGS) {
      const dash = ringDash(ringSpecFor(reading), CIRCUMFERENCE)
      if (dash === null) continue
      expect(dash.dashoffset, `${reading} has a negative dashoffset`).toBeGreaterThanOrEqual(0)
    }
  })

  it("the EIGHT rendered geometries are pairwise DISTINCT", () => {
    // The shape channel separates every reading from every other, with colour excluded by
    // construction: `ringDash` returns no stroke and knows no colour token, so this
    // distinctness cannot be borrowed from paint. (The RENDERED equivalent, read off the
    // DOM, lives in `PhaseNodeCard.test.tsx`; this is the table's own half.)
    const signatures = ALL_READINGS.map((reading) =>
      JSON.stringify({
        reading: null, // deliberately excluded — the KEY must not make rows distinct
        dash: ringDash(ringSpecFor(reading), CIRCUMFERENCE),
      }),
    )
    expect(new Set(signatures).size).toBe(ALL_READINGS.length)
    // 8 → 9 at 194-04. ⚠ THE EXACT COUNT IS KEPT DELIBERATELY, where the sibling case in
    // `PhaseNodeCard.test.tsx` chose a FLOOR: this one is the table's own inventory, and a
    // row silently vanishing from `RUN_READING_WORD` (which is where `ALL_READINGS` is
    // derived) is exactly the regression an inequality would wave through.
    expect(ALL_READINGS.length).toBe(9)
  })
})

describe("runVocabulary 189-10 — WR-04: the lookups stay own-guarded as the table grows", () => {
  it("`ringSpecFor` returns the UNKNOWN ring for an inherited member, never a function", () => {
    // T-189-24. `RING_GEOMETRY` is a plain object literal, so it INHERITS `constructor`,
    // `toString` and `__proto__`. None of them is nullish, so a bare `TABLE[key] ?? fallback`
    // does NOT fire its fallback for them — it hands back a FUNCTION typed as `RingSpec`.
    // The guard is shipped; this pins it while the table grows by a row.
    const inherited = ringSpecFor("constructor" as CanvasReading)
    expect(inherited).toBe(RING_GEOMETRY.unknown)
    expect(typeof inherited).toBe("object")

    // POSITIVE CONTROL — the inherited member really IS reachable by index, so the guard
    // is doing work rather than the property being absent.
    expect(typeof (RING_GEOMETRY as Record<string, unknown>)["constructor"]).toBe("function")
  })

  it("…and it never falls back to the CLOSED ring — an unknown state cannot read as done", () => {
    // The fail-closed direction that matters: the floor is the dotted unknown ring, and
    // `done`'s unbroken circle is the one thing it must never be.
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(ringSpecFor(key as CanvasReading)).not.toBe(RING_GEOMETRY.done)
      expect(ringSpecFor(key as CanvasReading).kind).not.toBe("solid")
    }
  })

  it("the WORD lookup is own-guarded too, and floors on the honest word", () => {
    expect(runReadingWord("constructor" as CanvasReading)).toBe(RUN_READING_WORD.unknown)
    // ⚠ and specifically NOT the new word: an unrecognised reading must not be reported
    // as a deliberate not-send, which would be a claim about a step nobody made.
    expect(runReadingWord("constructor" as CanvasReading)).not.toBe(D16_WORD)
    expect(runReadingWord("constructor" as CanvasReading)).not.toBe(RUN_READING_WORD.done)
  })
})

// ═══ 194-04 · THE NINTH READING, AND THE TWO NO-COLLAPSE FENCES ═════════════════════
//
// ⚠ EVERY ASSERTION BELOW IS SCOPED OVER COMPOSED **VALUES**, NEVER OVER MODULE SOURCE, and
// that is a measured constraint rather than a stylistic one. `runVocabulary.ts`'s docblocks
// legitimately NAME `failed` and `skipped` (they are readings, and the file explains why the
// stopped reading is neither), so a raw source sweep would red on the prose documenting the
// very rule it is checking. That is Phase 193.2's F-3 lesson, applied here before it bit.

/** The stopped reading, named ONCE so no assertion below re-spells it. */
const STOPPED: CanvasReading = "cancelled"

/** D-04's locked canvas wording, spelled literally and exactly once in this repository's
 *  tests — which is what makes the first assertion a FALSIFICATION of the table rather than
 *  a copy of it, the same rule `D16_WORD` above follows. */
const STOPPED_WORD = "Stopped by you"

/** The PANEL's word for the same state. Written here, in the CANVAS suite, for one reason:
 *  D-188-02 requires the two vocabularies to be DIFFERENT, and an inequality needs both
 *  sides. It is asserted against, never imported and never rendered by this module. */
const PANEL_WORD_FOR_THE_SAME_STATE = "Stopped"

describe("runVocabulary 194-04 — the ninth word", () => {
  it("is byte-exactly the locked wording, and reachable through the TOTAL accessor", () => {
    expect(RUN_READING_WORD[STOPPED]).toBe(STOPPED_WORD)
    expect(runReadingWord(STOPPED)).toBe(STOPPED_WORD)
  })

  it("is NOT the panel's word — two vocabularies, one derivation (D-188-02)", () => {
    // ⚠ Req 8's acceptance is a grep proving zero local RE-DERIVATIONS. It is emphatically
    // NOT that the two views print identical strings — the panel speaks harness words and
    // the canvas speaks business ones. This inequality is that rule, made mechanical.
    expect(RUN_READING_WORD[STOPPED]).not.toBe(PANEL_WORD_FOR_THE_SAME_STATE)
    // …and the difference is more than casing or whitespace, which a bare `!==` would let
    // through if someone later "unified" them with a trim.
    expect(RUN_READING_WORD[STOPPED].toLowerCase().trim()).not.toBe(
      PANEL_WORD_FOR_THE_SAME_STATE.toLowerCase().trim(),
    )
    // POSITIVE CONTROL — the comparison really can find equality, so the two above are
    // measurements and not a comparator that always disagrees.
    expect(RUN_READING_WORD[STOPPED]).toBe(STOPPED_WORD)
  })

  it("carries a CLAUSE, and the clause says the step did not finish", () => {
    const clause = runReadingClause(STOPPED)
    expect(clause).not.toBeNull()
    expect(runReadingLabel(STOPPED)).toBe(`${STOPPED_WORD} ${clause}`)
    // POSITIVE CONTROL — a reading WITHOUT a clause really does render the word alone, so
    // the composition above is a measurement rather than an accessor ignoring its argument.
    expect(runReadingLabel("done")).toBe(RUN_READING_WORD.done)
  })

  it("⚠ CLAIMS NOTHING WAS DISCARDED — D-13's red line, over the composed LABEL", () => {
    // The validated sketch words the run band "… · partial work discarded". D-13 forbids
    // exactly that: a stopped run KEEPS its completed phases and their outputs are durable.
    // Asserted over the whole rendered sentence, lower-cased, so a capitalised or
    // mid-sentence variant cannot slip past.
    const label = runReadingLabel(STOPPED).toLowerCase()
    for (const forbidden of ["discard", "thrown away", "throw away", "lost", "deleted", "wiped"]) {
      expect(label, `the stopped sentence must not claim work was ${forbidden}`).not.toContain(
        forbidden,
      )
    }
    // NON-VACUITY: the needle set really can match a sentence, so six absences are six
    // measurements rather than a loop over an empty comparison.
    expect("partial work discarded").toContain("discard")
    // …and the sentence is not empty, which is the other way this fence could go vacuous.
    expect(label.length).toBeGreaterThan(20)
  })
})

describe("runVocabulary 194-04 — V-19: no cancel path enters the failed or skipped vocabulary", () => {
  it("the WORD is neither failure's nor bypass's, exactly", () => {
    expect(RUN_READING_WORD[STOPPED]).not.toBe(RUN_READING_WORD.failed)
    expect(RUN_READING_WORD[STOPPED]).not.toBe(RUN_READING_WORD.skipped)
    // …nor a claim of success, nor the honest-ignorance word. Four refusals, four distinct
    // false claims about this step.
    expect(RUN_READING_WORD[STOPPED]).not.toBe(RUN_READING_WORD.done)
    expect(RUN_READING_WORD[STOPPED]).not.toBe(RUN_READING_WORD.unknown)
  })

  it("the whole composed SENTENCE is neither, at every failure flavour", () => {
    // `failed`'s sentence is a function of `emitFailure`, so a single compare against one
    // of its three flavours would leave the other two undefended — the 193.2 "two arms, one
    // assertion" lesson. Swept over the closed set instead.
    const stopped = runReadingLabel(STOPPED)
    for (const f of [
      null,
      "model_failed_to_emit",
      "citation_gate_rejected",
      "render_failed",
      "integrity_failed",
      "no_template_bound",
    ] as const) {
      expect(stopped, `collapsed into the failed sentence at ${f}`).not.toBe(
        runReadingLabel("failed", f),
      )
    }
    expect(stopped).not.toBe(runReadingLabel("skipped"))
    // NON-VACUITY: the sweep really produced distinct failure sentences to compare against,
    // rather than six copies of one string that happened to differ from ours.
    expect(
      new Set(
        (["model_failed_to_emit", "citation_gate_rejected", "render_failed"] as const).map((f) =>
          runReadingLabel("failed", f),
        ),
      ).size,
    ).toBeGreaterThan(1)
  })

  it("the RING is neither — shape is the channel that survives colour being switched off", () => {
    const stopped = ringDash(ringSpecFor(STOPPED), CIRCUMFERENCE)
    expect(stopped).not.toEqual(ringDash(ringSpecFor("failed"), CIRCUMFERENCE))
    expect(stopped).not.toEqual(ringDash(ringSpecFor("skipped"), CIRCUMFERENCE))
    // …and specifically not the closed circle, which is the single worst confusion here.
    expect(stopped).not.toEqual(ringDash(ringSpecFor("done"), CIRCUMFERENCE))
    expect(stopped!.dasharray).not.toBeNull()
  })

  it("its assertable UNIQUE property: the only ring whose dash equals its gap", () => {
    // Derived from the table, never from the two numbers. Every other fraction row names a
    // dash and a gap that differ; the two `length` rows carry no fractions at all.
    const halved = ALL_READINGS.filter((reading) => {
      const spec = RING_GEOMETRY[reading]
      return spec.kind === "fraction" && spec.arc.dash === spec.arc.gap
    })
    expect(halved).toEqual([STOPPED])
    // …and it does not spin: the run is over for this phase, and a moving terminal would
    // claim work still in flight.
    const spec = RING_GEOMETRY[STOPPED]
    expect(spec.kind).toBe("fraction")
    if (spec.kind !== "fraction") throw new Error("unreachable — pinned above")
    expect(spec.spinning).toBe(false)
  })

  it("claims NO card border — the sixth deliberate absence, pinned not merely commented", () => {
    // `RUN_READING_BORDER` is a `Partial<>`, so this absence is invisible to the compiler and
    // would otherwise be indistinguishable from an oversight.
    expect(Object.prototype.hasOwnProperty.call(RUN_READING_BORDER, STOPPED)).toBe(false)
    // Only the three LOUD readings claim the border, and that set is asserted WHOLE — so a
    // later phase quietly adding a fourth claimant goes red here.
    expect(Object.keys(RUN_READING_BORDER).sort()).toEqual(
      ["failed", "running", "waiting-for-you"].sort(),
    )
  })
})
