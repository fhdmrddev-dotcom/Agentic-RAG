/**
 * Phase 193.1-06 Task 1 — the TEMPLATE-FIRST VOCABULARY's own suite.
 *
 * Written in `doorVocabulary.test.ts`'s shape, for its stated reasons:
 *
 * 1. WHOLE-TABLE PROPERTIES, NEVER ROW ASSERTIONS. Every property below is derived from
 *    `Object.entries(mod)`, so the next string added to that module inherits all of them the
 *    moment it is exported. A property stated only about the row being added is a property the
 *    next row can break in silence.
 *
 * 2. THE NO-MERGE RULE IS ASSERTED BY NAME, NOT DOCUMENTED. The shipped reading sentences carry
 *    an inherited constraint — the `none` reading and the `unavailable` reading may never
 *    merge — and the three footing lines inherit it one level down. Prose is not a fence, so
 *    the three are compared pairwise by identifier here.
 *
 * 3. EVERY MESSAGE FUNCTION IS PROVED TO USE ITS ARGUMENT. This is the mechanical form of the
 *    phase's headline honesty rule: a function that ignored its count would render a hardcoded
 *    number beside a list of a different length, which is precisely the silent lie the phase
 *    exists to remove. Each function is called with two different arguments and the outputs are
 *    asserted to differ AND to contain the number passed.
 *
 * 4. THE LEAF CLAIM IS ASSERTED, NOT DOCUMENTED — with its non-vacuity anchored on what the
 *    file DOES declare plus a length floor, because a zero-import module has no positive import
 *    to control against and a `?raw` import of a moved module yields the EMPTY STRING in some
 *    resolvers rather than throwing (the 192.1 E-2 lesson: a fence swept against the empty
 *    string passes green while defending nothing).
 */
import { describe, expect, it } from "vitest"

import * as mod from "./templateFirstVocabulary"
import templateFirstVocabularySource from "./templateFirstVocabulary?raw"

/** Every export, DERIVED from the module rather than hand-listed (rule 1). */
const ALL_EXPORTS = Object.entries(mod) as [string, unknown][]

/** The string constants — every export that is not a message function. */
const ALL_CONSTANTS = ALL_EXPORTS.filter(([, v]) => typeof v === "string") as [string, string][]

/** The message functions, with two arguments each so the derivation can be falsified. */
const ALL_FUNCTIONS = ALL_EXPORTS.filter(([, v]) => typeof v === "function") as [
  string,
  (n: number) => string,
][]

describe("templateFirstVocabulary — the table itself", () => {
  it("exports only strings and message functions, and really loaded", () => {
    // NON-VACUITY FIRST: an empty namespace would make every loop below pass while checking
    // nothing at all.
    expect(ALL_EXPORTS.length).toBeGreaterThan(10)
    for (const [id, value] of ALL_EXPORTS) {
      expect(["string", "function"], `${id} is neither a string nor a function`).toContain(
        typeof value,
      )
    }
    // Both KINDS are really present — otherwise one of the two property blocks below is a loop
    // over nothing, which reads exactly like a block that passed.
    expect(ALL_CONSTANTS.length).toBeGreaterThan(5)
    expect(ALL_FUNCTIONS.length).toBeGreaterThanOrEqual(4)
  })

  it("every constant is non-empty, single-line and carries no edge whitespace", () => {
    for (const [id, value] of ALL_CONSTANTS) {
      expect(value.length, `${id} is empty`).toBeGreaterThan(0)
      // A copy string that ships with an edge space renders a gap nobody typed, and it
      // survives every fragment check ever written about it.
      expect(value, `${id} has edge whitespace`).toBe(value.trim())
      expect(value, `${id} spans lines`).not.toMatch(/[\r\n]/)
    }
  })

  it("the constants are PAIRWISE DISTINCT — no declared equalities on this table", () => {
    const collisions: string[] = []
    for (let i = 0; i < ALL_CONSTANTS.length; i++) {
      for (let j = i + 1; j < ALL_CONSTANTS.length; j++) {
        const [idA, valueA] = ALL_CONSTANTS[i]
        const [idB, valueB] = ALL_CONSTANTS[j]
        if (valueA === valueB) collisions.push(`${idA} === ${idB} (${JSON.stringify(valueA)})`)
      }
    }
    expect(collisions).toEqual([])
  })

  it("POSITIVE CONTROL — the distinctness walk really catches a duplicate", () => {
    // Without this the loop above passes on a table it never actually compared: an off-by-one
    // in either bound would produce the same green.
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

  it("no constant carries a raw HTML entity", () => {
    // An entity surviving into this table renders its literal characters on screen — the same
    // hazard `doorVocabulary.test.ts` pins, and this module holds curly quotes and em dashes.
    for (const [id, value] of ALL_CONSTANTS) {
      expect(value, `${id} carries a raw HTML entity`).not.toMatch(/&(amp|lt|gt|quot|#\d+);/)
    }
  })
})

describe("templateFirstVocabulary — the three no-fields sentences MAY NEVER MERGE (rule 2)", () => {
  // ⚠ ASSERTED BY NAME, because this is the one property on this table that prose cannot hold.
  // The shipped reading sentences carry the same constraint one level up: `none` is a fact
  // about the DOCUMENT, `unavailable` is a fact about US, and `notWord` is a fact about what we
  // can read at all. Their CONSEQUENCE for the draft is identical, which is exactly why the
  // three wordings must not be.
  const NO_FIELD_FOOTINGS: [string, string][] = [
    ["FOOTING_NONE", mod.FOOTING_NONE],
    ["FOOTING_NOT_WORD", mod.FOOTING_NOT_WORD],
    ["FOOTING_UNAVAILABLE", mod.FOOTING_UNAVAILABLE],
  ]

  it("all three are exported, non-empty strings", () => {
    // NON-VACUITY before the negatives: an undefined export would make every inequality below
    // trivially true (undefined !== undefined is false, but two absent ids compare equal).
    for (const [id, value] of NO_FIELD_FOOTINGS) {
      expect(typeof value, `${id} is not exported as a string`).toBe("string")
      expect(value.length, `${id} is empty`).toBeGreaterThan(20)
    }
  })

  it("no two of them are the same sentence", () => {
    for (let i = 0; i < NO_FIELD_FOOTINGS.length; i++) {
      for (let j = i + 1; j < NO_FIELD_FOOTINGS.length; j++) {
        const [idA, a] = NO_FIELD_FOOTINGS[i]
        const [idB, b] = NO_FIELD_FOOTINGS[j]
        expect(a, `${idA} and ${idB} have merged`).not.toBe(b)
      }
    }
  })

  it("and none of them is a SUBSTRING of another — merging by extension is still merging", () => {
    // A weaker fence would pass if someone made one sentence the other plus a clause. The
    // distinction these three carry is the SUBJECT of the sentence, not its length.
    for (const [idA, a] of NO_FIELD_FOOTINGS) {
      for (const [idB, b] of NO_FIELD_FOOTINGS) {
        if (idA === idB) continue
        expect(a.includes(b), `${idA} contains the whole of ${idB}`).toBe(false)
      }
    }
  })

  it("all five reading arms have a DISTINCT footing, so a waiting control can always say why", () => {
    // D-09: the in-flight arm has its own line rather than borrowing another's. Five values,
    // five distinct — the `fields` arm's is derived, so it is called here.
    const fiveArms = [
      mod.footingFields(8),
      mod.FOOTING_NONE,
      mod.FOOTING_NOT_WORD,
      mod.FOOTING_UNAVAILABLE,
      mod.FOOTING_LOADING,
    ]
    expect(new Set(fiveArms).size).toBe(5)
    for (const value of fiveArms) expect(value.length).toBeGreaterThan(0)
  })
})

describe("templateFirstVocabulary — every message function USES its argument (rule 3)", () => {
  it.each(ALL_FUNCTIONS.map(([id, fn]) => [id, fn] as const))(
    "%s renders a DIFFERENT sentence for a different argument",
    (_id, fn) => {
      // ⚠ THE MECHANICAL FORM OF THE PHASE'S HONESTY RULE. A function that ignored its count
      // would return the same sentence for 5 and for 8 — a hardcoded number beside a list of a
      // different length. This is the assertion a hardcoded value cannot pass.
      expect(fn(5)).not.toBe(fn(8))
    },
  )

  it("the COUNT functions interpolate the number they were given, not a fixed one", () => {
    // Named individually because `templateBindFailedMessage` takes a filename rather than a
    // count and would not be meaningfully checked by a numeric containment.
    expect(mod.footingFields(5)).toContain("5")
    expect(mod.footingFields(8)).toContain("8")
    expect(mod.footingFields(5)).not.toContain("8")
    expect(mod.nameCheckRunInputNote(2)).toContain("2")
    expect(mod.nameCheckRunInputNote(7)).toContain("7")
    expect(mod.showAllLabel(12)).toContain("12")
    expect(mod.showAllLabel(3)).not.toContain("12")
  })

  it("the singular arms are real sentences, not plural ones with a 1 in them", () => {
    // A derived variation, declared in the module's docblock rather than smuggled: the
    // contract's strings are plural because its fixture has eight fields and two run inputs.
    expect(mod.footingFields(1)).not.toContain("these 1")
    expect(mod.footingFields(1)).toContain("1")
    expect(mod.nameCheckRunInputNote(1)).not.toContain("1 more are")
    expect(mod.nameCheckRunInputNote(1)).toContain("1")
    // …and the PLURAL arms still read as plural, so the branch did not simply invert.
    expect(mod.footingFields(8)).toContain("these 8")
    expect(mod.nameCheckRunInputNote(2)).toContain("2 more are")
  })

  it("`templateBindFailedMessage` interpolates the filename AND carries the consequence", () => {
    const message = mod.templateBindFailedMessage("weekly-status.docx")
    expect(message).toContain("weekly-status.docx")
    // It changes with its argument, like every other function on this table.
    expect(message).not.toBe(mod.templateBindFailedMessage("other.docx"))
    // ⚠ AND IT SAYS WHAT IS NOW TRUE OF THE DRAFT, not only that something failed. Measured:
    // a deliverable step expecting a document with none bound fails TERMINALLY at run time, so
    // a message that reports only the failure leaves the author holding a workflow that cannot
    // complete. Asserted on the SAVE fact and on the ATTACH instruction, which are the two
    // halves an author needs and the two a terse rewrite would drop first.
    expect(message).toMatch(/saved/i)
    expect(message).toMatch(/attach/i)
  })

  it("no function returns an empty or whitespace-only string for any plausible count", () => {
    for (const [id, fn] of ALL_FUNCTIONS) {
      for (const n of [0, 1, 2, 8, 100]) {
        const out = fn(n as never)
        expect(typeof out, `${id}(${n}) is not a string`).toBe("string")
        expect(out.trim().length, `${id}(${n}) is blank`).toBeGreaterThan(0)
      }
    }
  })
})

describe("templateFirstVocabulary — the disclaim and the buckets are not open", () => {
  it("the disclaim names a NAME check and explicitly refuses the coverage claim", () => {
    // ⚠ D-10 calls this the single most important string on the surface: without it the panel
    // asserts a verdict it cannot compute. The two clauses that carry that are pinned so a
    // future tightening cannot quietly drop either.
    expect(mod.NAME_CHECK_DISCLAIM).toContain("name check, not a coverage check")
    expect(mod.NAME_CHECK_DISCLAIM).toContain("until the workflow runs")
  })

  it("no string on this table claims the document is uncovered", () => {
    // The copy may say nothing in the steps NAMES a field. It may NEVER say the document is
    // uncovered, missing fields, or incomplete — those are verdicts only a run can produce.
    const FORBIDDEN = [/\buncovered\b/i, /\bnot covered\b/i, /\bincomplete\b/i, /\bmissing fields\b/i]
    for (const [id, value] of ALL_CONSTANTS) {
      for (const pattern of FORBIDDEN) {
        expect(pattern.test(value), `${id} states a coverage verdict: ${value}`).toBe(false)
      }
    }
    // POSITIVE CONTROL — the patterns really match the thing they forbid, so a green above is
    // a property rather than a typo in a regex.
    expect(FORBIDDEN.some((p) => p.test("this template is uncovered"))).toBe(true)
    expect(FORBIDDEN.some((p) => p.test("missing fields in the draft"))).toBe(true)
  })

  it("THREE bucket labels exist and are distinct — D-10's red line, mechanised", () => {
    // Three buckets, never two. A field supplied when the workflow starts is not a gap, and a
    // two-bucket check lists it as one — which trains the author to dismiss the panel.
    const buckets = [mod.BUCKET_PRODUCED, mod.BUCKET_RUN_INPUT, mod.BUCKET_NAMED_NOWHERE]
    expect(new Set(buckets).size).toBe(3)
    for (const label of buckets) expect(label.trim().length).toBeGreaterThan(0)
  })
})

describe("templateFirstVocabulary — the module is a TRUE LEAF (rule 4)", () => {
  it("imports nothing at all — not a component, not React, not a type", () => {
    const ANY_IMPORT = /^\s*import\s/m
    const ANY_FROM = /from\s+["'][^"']+["']/
    const DYNAMIC_IMPORT = /import\s*\(/
    // POSITIVE CONTROLS FIRST — a matcher that cannot match passes vacuously and looks exactly
    // like a fence that holds.
    expect('import type { Foo } from "@/lib/api"').toMatch(ANY_IMPORT)
    expect('import type { Foo } from "@/lib/api"').toMatch(ANY_FROM)
    expect('const m = await import("./x")').toMatch(DYNAMIC_IMPORT)

    expect(templateFirstVocabularySource).not.toMatch(ANY_IMPORT)
    expect(templateFirstVocabularySource).not.toMatch(ANY_FROM)
    expect(templateFirstVocabularySource).not.toMatch(DYNAMIC_IMPORT)

    // ⚠ NON-VACUITY FOR A ZERO-IMPORT LEAF CANNOT BE A POSITIVE IMPORT. Anchored instead on
    // what the file DOES declare, plus a length floor — a `?raw` import of a moved or renamed
    // module yields the EMPTY STRING in some resolvers rather than throwing, and all three
    // negatives above would then be about nothing at all.
    expect(templateFirstVocabularySource.length).toBeGreaterThan(1000)
    expect(templateFirstVocabularySource).toMatch(/export const /)
    expect(templateFirstVocabularySource).toMatch(/export function /)
    // Every id the namespace reports is really DECLARED in the source that was loaded, which
    // ties the two subjects of this file together — the runtime table and the raw text.
    for (const [id, value] of ALL_EXPORTS) {
      const keyword = typeof value === "function" ? "function" : "const"
      expect(
        templateFirstVocabularySource,
        `${id} is not declared in the loaded source`,
      ).toMatch(new RegExp(`^export ${keyword} ${id}\\b`, "m"))
    }
  })
})
