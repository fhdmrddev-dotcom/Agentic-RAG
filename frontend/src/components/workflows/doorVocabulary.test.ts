/**
 * Phase 193-05 Task 3 — the DOOR VOCABULARY's own suite.
 *
 * ── THE FOUR RULES THIS FILE FOLLOWS, AND WHY EACH ONE ──────────────────────────────────
 *
 * 1. WHOLE-TABLE PROPERTIES, NEVER ROW ASSERTIONS. Every property below is stated over the
 *    WHOLE table, derived from the module's own exports, so the 22nd id inherits all of
 *    them the moment it is added. `runVocabulary.test.ts:40-44` puts it exactly: *a
 *    property stated only about the row being added is a property the next row can break in
 *    silence.* Nothing here hand-lists an identifier; `ALL_DOOR_WORDS` is
 *    `Object.entries(doorVocabulary)`.
 *
 * 2. ⚠ EXACT MATCH, NEVER A SUBSTRING CHECK — AND ON THIS TABLE THAT IS ARITHMETIC RATHER
 *    THAN CAUTION. Containment collisions are not a risk here, they are already the case:
 *    `DOOR_A_NOTE` CONTAINS `DOOR_B_NAME`; `STRIP_LABEL` contains `DOOR_A_NAME`;
 *    `SWITCH_CTA` and `STRIP_LABEL_GOVERN` are both built on `DOOR_B_NAME`. So a
 *    `toContain` on any of those is TRUE OF SEVERAL ROWS and proves nothing. That is
 *    DEMONSTRATED mechanically below rather than asserted in prose, because prose is not a
 *    fence. It gets worse in `193-08`, not better: column D makes `DOOR_B_NAME` a strict
 *    PREFIX of `SWITCH_CTA` and makes `STRIP_LABEL_GOVERN` the SAME STRING (D-23).
 *
 * 3. ⚠ NO COLUMN-D LITERALS LIVE HERE, AND THE ABSENCE IS A DECISION RATHER THAN AN
 *    OMISSION. `runVocabulary.test.ts:20-22` spells its locked word as a literal in the
 *    TEST, so the assertion FALSIFIES the source instead of copying it, and that is the
 *    right instrument when the words are the subject. In THIS wave the words are NOT the
 *    subject: `193-05` is a pure MOVE at the shipped values, and its byte-level proof is
 *    `193-01`'s six whole-`innerHTML` DOM captures. Taking the proof at the DOM is not a
 *    softer choice, it is the CORRECT level — the JSX these strings came out of spells
 *    `Describe &amp; run` while the module spells `Describe & run`, so a source-level
 *    comparison would report a difference the rendered surface does not have. `193-08`,
 *    where the words ARE the subject, is where exact-match column-D literals belong.
 *
 * 4. THE LEAF CLAIM IS ASSERTED, NOT DOCUMENTED. `doorVocabulary.ts` importing NOTHING is
 *    what makes the door subtree's cycle risk one-directional (D-24(b)) and what lets
 *    `DoorHeaderStrip.tsx` import it safely. ⚠ Its non-vacuity control CANNOT be a positive
 *    import — there is none to find — so the claim is anchored on what the file DOES
 *    declare, plus a length floor: the 192.1 E-2 finding is that a fence swept against the
 *    empty string passes green while defending nothing.
 */
import { describe, expect, it } from "vitest"

import * as doorVocabulary from "./doorVocabulary"
import doorVocabularySource from "./doorVocabulary?raw"

/**
 * Every governed word the module owns, DERIVED from the module itself rather than
 * hand-listed — so a 22nd id is covered by every property below the moment it is exported,
 * and a DELETED id reds on the count instead of quietly leaving a loop with less to do.
 */
const ALL_DOOR_WORDS = Object.entries(doorVocabulary) as [string, string][]

/** The id count the build contract governs: 20 from D-11, plus the 21st D-23 added. */
const GOVERNED_ID_COUNT = 21

/**
 * Pairs of ids the contract DELIBERATELY gives the same string.
 *
 * ⚠ EMPTY TODAY, AND `193-08` MAKES IT NON-EMPTY. D-23 renames the govern door's label to
 * echo the door's own name, so after column D lands `["STRIP_LABEL_GOVERN", "DOOR_B_NAME"]`
 * belongs in this list. It is declared as a LIST rather than left implicit precisely so that
 * wave EXTENDS a declaration instead of discovering a red test and weakening the property to
 * make it pass.
 */
const DECLARED_EQUALITIES: [string, string][] = []

describe("doorVocabulary — the table itself", () => {
  it(`owns exactly ${GOVERNED_ID_COUNT} ids, and every export is one of them`, () => {
    expect(ALL_DOOR_WORDS).toHaveLength(GOVERNED_ID_COUNT)
    // …and the module exports NOTHING BUT the words: no helper, no type-carrying const, no
    // default. A single non-string export here would silently break every loop below.
    for (const [id, value] of ALL_DOOR_WORDS) {
      expect(typeof value, `${id} is not a string`).toBe("string")
    }
    // NON-VACUITY: the derivation really read the module rather than an empty namespace.
    expect(ALL_DOOR_WORDS.map(([id]) => id)).toContain("STRIP_BACK")
  })

  it("every value is non-empty and carries no stray leading or trailing whitespace", () => {
    for (const [id, value] of ALL_DOOR_WORDS) {
      expect(value.length, `${id} is empty`).toBeGreaterThan(0)
      // A copy string that ships with an edge space renders a gap nobody typed, and it
      // survives every `toContain` check ever written about it.
      expect(value, `${id} has edge whitespace`).toBe(value.trim())
      // …and no newline smuggled in by a wrapped source line.
      expect(value, `${id} spans lines`).not.toMatch(/[\r\n]/)
    }
  })

  it("the values are PAIRWISE DISTINCT, except for the declared (currently empty) exceptions", () => {
    const declared = new Set(DECLARED_EQUALITIES.map(([a, b]) => [a, b].sort().join("::")))
    // Stated as a decision rather than an accident: nothing is deliberately duplicated yet.
    expect(DECLARED_EQUALITIES).toEqual([])

    const collisions: string[] = []
    for (let i = 0; i < ALL_DOOR_WORDS.length; i++) {
      for (let j = i + 1; j < ALL_DOOR_WORDS.length; j++) {
        const [idA, valueA] = ALL_DOOR_WORDS[i]
        const [idB, valueB] = ALL_DOOR_WORDS[j]
        if (valueA === valueB && !declared.has([idA, idB].sort().join("::"))) {
          collisions.push(`${idA} === ${idB} (${JSON.stringify(valueA)})`)
        }
      }
    }
    expect(collisions).toEqual([])
  })

  it("POSITIVE CONTROL — the distinctness walk really catches a duplicate", () => {
    // Without this the loop above passes on a table it never actually compared: an
    // off-by-one in either bound would produce the same green.
    const planted: [string, string][] = [
      ["A", "same"],
      ["B", "different"],
      ["C", "same"],
    ]
    const found: string[] = []
    for (let i = 0; i < planted.length; i++) {
      for (let j = i + 1; j < planted.length; j++) {
        if (planted[i][1] === planted[j][1]) found.push(`${planted[i][0]} === ${planted[j][0]}`)
      }
    }
    expect(found).toEqual(["A === C"])
  })
})

describe("doorVocabulary — why containment assertions are forbidden (rule 2)", () => {
  it("⚠ DEMONSTRATED: several shipped values already CONTAIN another id's whole value", () => {
    // The rule in the header is only worth writing if it is true of the real table, so it is
    // measured here rather than trusted. Every pair below is read OFF the module — nothing on
    // this line is re-typed, so the demonstration cannot drift from the strings that ship.
    const containments: string[] = []
    for (const [idA, valueA] of ALL_DOOR_WORDS) {
      for (const [idB, valueB] of ALL_DOOR_WORDS) {
        if (idA !== idB && valueA !== valueB && valueA.includes(valueB)) {
          containments.push(`${idA} ⊃ ${idB}`)
        }
      }
    }
    // At least one exists TODAY — so `expect(x).toContain(SOME_ID)` cannot identify a row,
    // and every assertion in this repo about these strings compares WHOLE STRINGS.
    expect(containments.length).toBeGreaterThan(0)
    // Named for the reader, still derived: the door-B name is the one that recurs most.
    expect(containments.some((c) => c.endsWith("⊃ DOOR_B_NAME"))).toBe(true)
  })
})

describe("doorVocabulary — the characters, asserted by codepoint", () => {
  it("the return control and the switch CTA carry ANGLE QUOTATION MARKS, not < and >", () => {
    // U+2039 / U+203A. A `<` or a `>` looks close enough in a diff and in most editors, and
    // it would additionally have to be escaped in JSX — the kind of substitution a reviewer
    // waves through and a renderer does not.
    expect(doorVocabulary.STRIP_BACK.codePointAt(0)).toBe(0x2039)
    const cta = doorVocabulary.SWITCH_CTA
    expect(cta.codePointAt(cta.length - 1)).toBe(0x203a)
    expect(doorVocabulary.STRIP_BACK).not.toContain("<")
    expect(cta).not.toContain(">")
  })

  it("the ampersands are PLAIN, never the JSX entity — the entity conversion, asserted", () => {
    // The move's one honest source-level difference (see the module header): JSX spelled
    // `&amp;`, a TypeScript string spells `&`, and React re-serialises it on render. An
    // `&amp;` surviving into this table would render the literal five characters on screen.
    for (const [id, value] of ALL_DOOR_WORDS) {
      expect(value, `${id} carries a raw HTML entity`).not.toMatch(/&(amp|lt|gt|quot|#\d+);/)
    }
    // NON-VACUITY: the table really does contain ampersands to have gotten this wrong with.
    expect(ALL_DOOR_WORDS.filter(([, v]) => v.includes("&")).length).toBeGreaterThan(0)
  })
})

describe("doorVocabulary — the module is a TRUE LEAF (rule 4, D-10 / D-24(b))", () => {
  it("imports nothing at all — not a component, not React, not a type", () => {
    const ANY_IMPORT = /^\s*import\s/m
    const ANY_FROM = /from\s+["'][^"']+["']/
    const DYNAMIC_IMPORT = /import\s*\(/
    // POSITIVE CONTROLS first — a matcher that cannot match passes vacuously and looks
    // exactly like a fence that holds.
    expect('import type { CanvasReading } from "@/lib/phaseState"').toMatch(ANY_IMPORT)
    expect('import type { CanvasReading } from "@/lib/phaseState"').toMatch(ANY_FROM)
    expect('const m = await import("./x")').toMatch(DYNAMIC_IMPORT)

    expect(doorVocabularySource).not.toMatch(ANY_IMPORT)
    expect(doorVocabularySource).not.toMatch(ANY_FROM)
    expect(doorVocabularySource).not.toMatch(DYNAMIC_IMPORT)

    // ⚠ NON-VACUITY FOR A ZERO-IMPORT LEAF CANNOT BE A POSITIVE IMPORT (rule 4). Anchored
    // instead on what the file DOES declare, plus a length floor — a `?raw` import of a
    // moved or renamed module yields the EMPTY STRING in some resolvers rather than
    // throwing, and all three negatives above would then be about nothing at all.
    expect(doorVocabularySource.length).toBeGreaterThan(500)
    expect(doorVocabularySource).toMatch(/export const /)
    // Every id the namespace reports is really DECLARED in the source that was loaded, which
    // ties the two subjects of this file together — the runtime table and the raw text.
    for (const [id] of ALL_DOOR_WORDS) {
      expect(doorVocabularySource, `${id} is not declared in the loaded source`).toMatch(
        new RegExp(`^export const ${id}\\b`, "m"),
      )
    }
  })

  it("no UN-governed string travelled into the table with the ones that are", () => {
    // The contract's COPY table is the boundary. These four ship on the same two components
    // and are deliberately NOT governed — moving them would put strings in the vocabulary
    // module that the contract's substitution audit cannot verify, which is a different
    // failure from leaving a governed one behind and needs its own guard.
    for (const ungoverned of ["Open ›", "business requirement", "judge always-on", "TIERS."]) {
      expect(doorVocabularySource, `${ungoverned} does not belong here`).not.toContain(ungoverned)
      expect(ALL_DOOR_WORDS.map(([, v]) => v)).not.toContain(ungoverned)
    }
    // NON-VACUITY: the check really reads a loaded source and a populated table.
    expect(doorVocabularySource).toContain("export const STRIP_BACK")
    expect(ALL_DOOR_WORDS.map(([, v]) => v)).toContain(doorVocabulary.DESCRIBE_CTA)
  })
})
