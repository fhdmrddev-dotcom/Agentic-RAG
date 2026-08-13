/**
 * Phase 193-05 Task 3, EXTENDED TO THE FULL FALSIFICATION SUITE BY 193-08 Task 2
 * — the DOOR VOCABULARY's own suite.
 *
 * ── THE FOUR RULES THIS FILE FOLLOWS, AND WHY EACH ONE ──────────────────────────────────
 *
 * 1. WHOLE-TABLE PROPERTIES, NEVER ROW ASSERTIONS. Every property below is stated over the
 *    WHOLE table, derived from the module's own exports, so the 22nd id inherits all of
 *    them the moment it is added. `runVocabulary.test.ts:40-44` puts it exactly: *a
 *    property stated only about the row being added is a property the next row can break in
 *    silence.* Nothing here hand-lists an identifier; `ALL_DOOR_WORDS` is
 *    `Object.entries(doorVocabulary)`, and `COLUMN_D`'s key set is asserted to be the SAME
 *    SET — so a value added to one and not the other is a failure rather than a gap.
 *
 * 2. ⚠ EXACT MATCH, NEVER A CONTAINMENT ASSERTION — AND ON THIS TABLE THAT IS ARITHMETIC
 *    RATHER THAN CAUTION. Collisions are not a risk here, they are already the case:
 *    `STRIP_LABEL` is built on `DOOR_A_NAME`'s verb; `SWITCH_CTA` and `STRIP_LABEL_GOVERN`
 *    are both built on `DOOR_B_NAME`, the first as a strict PREFIX and the second as the
 *    SAME STRING (D-23). So a containment check on that fragment is true of THREE ROWS and
 *    identifies none of them. That is DEMONSTRATED mechanically below rather than asserted
 *    in prose, because prose is not a fence.
 *
 *    ⚠ AND THE FORBIDDEN MATCHER IS NOT SPELLED ANYWHERE IN THIS FILE, deliberately — the
 *    plan's acceptance for this suite is a GREP for it, and prose quoting the pattern it
 *    bans is what makes such a grep unreadable. That is the 187-24 lesson, which
 *    `runVocabulary.test.ts:33-38` already records and which this phase has now met twice.
 *    Where a NEGATIVE about a character is needed ("no less-than sign here"), it is written
 *    as an explicit `String.prototype.includes` boolean compared with `toBe(false)`: the ban
 *    is on identifying a VALUE by a fragment, not on ever asking whether a character occurs,
 *    and spelling it this way keeps the grep a clean instrument. Every WORD below is
 *    asserted with `toBe`.
 *
 * 3. ⚠ COLUMN-D LITERALS LIVE HERE, AND THAT IS THE WHOLE POINT OF THIS WAVE. `193-05`
 *    deliberately had NONE: that wave was a pure MOVE at the shipped values, its proof was
 *    `193-01`'s six whole-`innerHTML` DOM captures, and a source-level comparison would have
 *    reported an ampersand-entity difference the rendered surface did not have. In `193-08`
 *    the WORDS ARE THE SUBJECT, so `COLUMN_D` spells all 21 as literals HERE, exactly once
 *    in this repository, and the module is compared against them. The literal living in the
 *    TEST is what makes the assertion a FALSIFICATION of the table rather than a copy of it
 *    (`runVocabulary.test.ts:64-72`).
 *
 *    …and because a literal in a test can rot just as quietly as one in a source file, a
 *    further case RE-READS `BUILD-CONTRACT.generated.md` at test time and asserts the parsed
 *    column D equals `COLUMN_D`. That is the mechanical statement of D-02: the acceptance bar
 *    and the module cannot drift, and a copy change stays a one-line diff in one file.
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
// The GENERATED acceptance bar itself, read as text so the suite can re-derive column D
// instead of trusting that someone ported it correctly (rule 3, D-02).
import buildContractSource from "../../../../.planning/sketches/164-telling-the-doors-apart/BUILD-CONTRACT.generated.md?raw"

/**
 * Every governed word the module owns, DERIVED from the module itself rather than
 * hand-listed — so a 22nd id is covered by every property below the moment it is exported,
 * and a DELETED id reds on the count instead of quietly leaving a loop with less to do.
 */
const ALL_DOOR_WORDS = Object.entries(doorVocabulary) as [string, string][]

/** The id count the build contract governs: 20 from D-11, plus the 21st D-23 added. */
const GOVERNED_ID_COUNT = 21

/**
 * ⚠ COLUMN D OF THE REGENERATED BUILD CONTRACT, SPELLED AS LITERALS EXACTLY ONCE IN THIS
 * REPOSITORY'S TESTS (rule 3). Every assertion against the module compares against THIS
 * object, never the other way round, so a re-word in the module without a re-word here is a
 * red test rather than a silent agreement.
 *
 * The two ids variant D INHERITS unchanged (`DESCRIBE_H1`, `HINT_FRAG3`) are present exactly
 * like the nineteen that changed — the contract's audit is defined over the WHOLE table, and
 * an id omitted because "it isn't changing" is the second home the next reword trips over
 * (D-11).
 */
const COLUMN_D: Record<string, string> = {
  CHOOSER_H1: "How do you want to start?",
  CHOOSER_SUB: "Both end up in the same place. You can switch between them at any time.",
  DOOR_A_TIER: "you write one paragraph",
  DOOR_A_NAME: "Draft it for me",
  DOOR_A_DESC:
    "Describe the recurring work in plain language. The AI writes the steps, sets how strict it is, and asks you about anything it had to guess.",
  DOOR_A_NOTE: "you can open the full editor at any point — nothing is locked in",
  DOOR_B_TIER: "you decide every setting",
  DOOR_B_NAME: "Build it myself",
  DOOR_B_DESC:
    "Open the editor and set each step yourself — what it must cite, which checks have to pass, and which model runs each step.",
  DOOR_B_NOTE: "what it must cite · required checks · per-step sources & model",
  STRIP_BACK: "‹ Change how I start",
  STRIP_LABEL: "⚡ Drafting it for you",
  STRIP_LABEL_GOVERN: "Build it myself",
  DESCRIBE_H1: "What recurring work should this automate?",
  DESCRIBE_CTA: "Write the first draft",
  HINT_FRAG1: "writes the steps",
  HINT_FRAG2: "sets how strict it is",
  HINT_FRAG3: "asks about anything it had to guess",
  SWITCH_PROMPT: "Need to set citations, checks, or per-step sources yourself?",
  SWITCH_CTA: "Build it myself ›",
  SOUL_LABEL: "What this will do",
}

/**
 * Pairs of ids the contract DELIBERATELY gives the same string.
 *
 * ⚠ `193-05` left this list EMPTY with the extension named in its own docblock, and `193-08`
 * EXTENDED IT — which is the whole reason it was declared as a list rather than left implicit.
 * D-23 renames the govern door's label to echo the door's own name, so the collision below is
 * a DECISION. The alternative shape — discovering a red distinctness test and weakening the
 * property until it passes — would have removed a fence instead of declaring an exception.
 */
const DECLARED_EQUALITIES: [string, string][] = [["STRIP_LABEL_GOVERN", "DOOR_B_NAME"]]

/**
 * Characters that survive an editor badly, and the codepoint each MUST be.
 *
 * A hyphen-minus for an em dash, an en dash for an em dash, a bullet for a middle dot, or a
 * less-than sign for a single angle quotation mark all look nearly identical in a diff and in
 * most editors — and the last of them would additionally have to be escaped in JSX. These are
 * the substitutions a reviewer waves through and a renderer does not.
 */
const EM_DASH = 0x2014
const MIDDLE_DOT = 0x00b7
const ANGLE_LEFT = 0x2039
const ANGLE_RIGHT = 0x203a
const HIGH_VOLTAGE = 0x26a1

/** Dash-like codepoints: hyphen-minus plus the whole U+2010–U+2015 dash block. */
const DASH_LIKE = new Set([0x002d, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015])

/** Separator-dot lookalikes: middle dot, bullet, hyphenation point, dot operator, full stop. */
const DOT_LIKE = new Set([0x00b7, 0x2022, 0x2027, 0x22c5, 0x002e])

/** Every index in `value` whose character is in `set` AND is flanked by spaces — i.e. used as
 *  a SEPARATOR rather than inside a word (`per-step` keeps its hyphen legitimately). */
function separatorCodepoints(value: string, set: Set<number>): number[] {
  const found: number[] = []
  for (let i = 1; i < value.length - 1; i++) {
    const cp = value.codePointAt(i)
    if (cp !== undefined && set.has(cp) && value[i - 1] === " " && value[i + 1] === " ") {
      found.push(cp)
    }
  }
  return found
}

/** `doorA.tier` → `DOOR_A_TIER`. The same mechanical mapping the port script used: dot to
 *  underscore, camel boundary to underscore, upper-case. Nothing hand-listed. */
function idToExport(id: string): string {
  return id
    .replace(/\./g, "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toUpperCase()
}

/**
 * Parse column D out of the generated contract's COPY table.
 *
 * The rules are the contract's own, stated at its § COPY table: a `**bold**` cell is the pick,
 * a `⬅ from C` annotation is provenance rather than text, and an `*(inherit)*` cell means
 * *take column A unchanged*.
 */
function parseColumnD(markdown: string): Record<string, string> {
  const cellText = (raw: string): string =>
    raw
      .replace(/⬅\s*from\s*[A-C]\s*$/u, "")
      .replace(/^\s*\*\*(.*)\*\*\s*$/s, "$1")
      .trim()

  const out: Record<string, string> = {}
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^\|\s*`([a-zA-Z.0-9]+)`\s*\|(.*)\|\s*$/.exec(line)
    if (!m) continue
    const cells = m[2].split("|")
    if (cells.length !== 5) continue // where · A · B · C · D
    const shippedA = cellText(cells[1])
    const d = cellText(cells[4])
    out[idToExport(m[1])] = d === "" || /^\*\(inherit\)\*$/.test(d) ? shippedA : d
  }
  return out
}

describe("doorVocabulary — the table itself", () => {
  it(`owns exactly ${GOVERNED_ID_COUNT} ids, and every export is one of them`, () => {
    expect(ALL_DOOR_WORDS).toHaveLength(GOVERNED_ID_COUNT)
    // …and the module exports NOTHING BUT the words: no helper, no type-carrying const, no
    // default. A single non-string export here would silently break every loop below.
    for (const [id, value] of ALL_DOOR_WORDS) {
      expect(typeof value, `${id} is not a string`).toBe("string")
    }
    // NON-VACUITY: the derivation really read the module rather than an empty namespace.
    expect(ALL_DOOR_WORDS.map(([id]) => id).includes("STRIP_BACK")).toBe(true)
  })

  it("the module's export set and COLUMN_D's key set are the SAME SET (rule 1)", () => {
    // A value added to one and not the other is a failure, not a gap — which is what stops
    // the exact-match loop below from quietly covering twenty of twenty-one ids.
    expect(Object.keys(COLUMN_D).sort()).toEqual(ALL_DOOR_WORDS.map(([id]) => id).sort())
    expect(Object.keys(COLUMN_D)).toHaveLength(GOVERNED_ID_COUNT)
  })

  it("every value is non-empty and carries no stray leading or trailing whitespace", () => {
    for (const [id, value] of ALL_DOOR_WORDS) {
      expect(value.length, `${id} is empty`).toBeGreaterThan(0)
      // A copy string that ships with an edge space renders a gap nobody typed, and it
      // survives every fragment check ever written about it.
      expect(value, `${id} has edge whitespace`).toBe(value.trim())
      // …and no newline smuggled in by a wrapped source line.
      expect(value, `${id} spans lines`).not.toMatch(/[\r\n]/)
    }
  })

  it("the values are PAIRWISE DISTINCT, except for the DECLARED equalities", () => {
    const declared = new Set(DECLARED_EQUALITIES.map(([a, b]) => [a, b].sort().join("::")))
    // Stated as a decision rather than an accident: exactly ONE pair is deliberately equal,
    // and it is the D-23 one. A second collision appearing here without a line in the list
    // above is a bug, not a style question.
    expect(DECLARED_EQUALITIES).toEqual([["STRIP_LABEL_GOVERN", "DOOR_B_NAME"]])

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

    // …and the declared exception is not a dead entry excusing a collision that no longer
    // exists. Every declared pair must ACTUALLY be equal, or the list is documenting a fiction.
    for (const [a, b] of DECLARED_EQUALITIES) {
      const va = (doorVocabulary as Record<string, string>)[a]
      const vb = (doorVocabulary as Record<string, string>)[b]
      expect(va, `${a} is not exported`).toBeTypeOf("string")
      expect(va, `${a} and ${b} are declared equal but are not`).toBe(vb)
    }
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

describe("doorVocabulary 193-08 — every word is EXACTLY column D (D-01 / D-02, rule 3)", () => {
  // One case per id, named by id, so a failure names the word rather than an index. The loop
  // is over COLUMN_D's keys — hand-listing them here would reintroduce the very second home
  // this module exists to remove.
  for (const id of Object.keys(COLUMN_D)) {
    it(`${id} is byte-exactly column D`, () => {
      expect((doorVocabulary as Record<string, string>)[id]).toBe(COLUMN_D[id])
    })
  }

  it("the two ids variant D INHERITS are still governed and still exported", () => {
    // Their column-D cell reads *(inherit)*, which is a value, not an absence (D-11).
    expect(doorVocabulary.DESCRIBE_H1).toBe(COLUMN_D.DESCRIBE_H1)
    expect(doorVocabulary.HINT_FRAG3).toBe(COLUMN_D.HINT_FRAG3)
  })

  it("the two DECLARED relations between door B's name and its two echoes hold exactly", () => {
    // D-23: the govern strip echoes the door's own name — the SAME STRING, additionally
    // pinned in the module by a `typeof DOOR_B_NAME` annotation so a rename on either side is
    // a TYPECHECK error rather than two words that quietly disagree.
    expect(doorVocabulary.STRIP_LABEL_GOVERN).toBe(doorVocabulary.DOOR_B_NAME)
    // …and the switch CTA is that same name plus a chevron, which is what makes the name a
    // strict PREFIX of the CTA. Asserted by CONSTRUCTION, so the relation is pinned rather
    // than the two literals independently happening to agree.
    expect(doorVocabulary.SWITCH_CTA).toBe(`${doorVocabulary.DOOR_B_NAME} ›`)
    // …and it really is a PREFIX rather than the whole string. ⚠ The inequality half is NOT
    // asserted at runtime, deliberately and on measurement: `expect(SWITCH_CTA === DOOR_B_NAME)`
    // is a TYPECHECK ERROR here (TS2367 — the two literal types have no overlap), which is a
    // strictly STRONGER fence than a green runtime assertion, and writing it anyway would have
    // taken `tsc` from 33 to 34. The proper-prefix relation is asserted instead.
    expect(doorVocabulary.SWITCH_CTA.startsWith(doorVocabulary.DOOR_B_NAME)).toBe(true)
    expect(doorVocabulary.SWITCH_CTA.length).toBeGreaterThan(doorVocabulary.DOOR_B_NAME.length)
  })
})

describe("doorVocabulary 193-08 — the generated contract IS the acceptance bar (D-02)", () => {
  it("column D, re-parsed from BUILD-CONTRACT.generated.md, equals COLUMN_D", () => {
    // NON-VACUITY FIRST. A `?raw` import that resolved to nothing yields the empty string in
    // some resolvers rather than throwing, and the comparison below would then be about a
    // table parsed out of nothing (the 192.1 E-2 lesson).
    expect(buildContractSource.length).toBeGreaterThan(2000)
    expect(buildContractSource).toMatch(/^# BUILD-CONTRACT/m)
    expect(buildContractSource).toMatch(/GENERATED by `build\.cjs`/)

    const parsed = parseColumnD(buildContractSource)
    // The parse found the whole table, not a prefix of it.
    expect(Object.keys(parsed)).toHaveLength(GOVERNED_ID_COUNT)
    expect(parsed).toEqual(COLUMN_D)
  })

  it("POSITIVE CONTROL — the parser really reads the D cell, and really resolves an inherit", () => {
    // Without these the comparison above could be passing on a parser that returns column B,
    // or one that drops the `*(inherit)*` rows entirely.
    const fixture = [
      "| id | where | A · shipped | B | C | **D · THE PICK** |",
      "|---|---|---|---|---|---|",
      "| `demo.pick` | somewhere | shipped words | b words | c words | **d words** ⬅ from C |",
      "| `demo.inherit` | somewhere | shipped words | *(inherit)* | *(inherit)* | *(inherit)* |",
    ].join("\n")
    expect(parseColumnD(fixture)).toEqual({
      DEMO_PICK: "d words",
      DEMO_INHERIT: "shipped words",
    })
    // …and the id → export mapping is mechanical for every shape this table uses.
    expect(idToExport("strip.labelGovern")).toBe("STRIP_LABEL_GOVERN")
    expect(idToExport("hint.frag1")).toBe("HINT_FRAG1")
    expect(idToExport("doorA.tier")).toBe("DOOR_A_TIER")
  })

  it("the module really is what the contract's substitution audit was run against", () => {
    // The audit line is the contract's own claim that variant D matched the REAL rendered
    // DOM. Pinning it here means a regeneration that silently starts missing substitutions
    // cannot pass this suite unnoticed.
    expect(buildContractSource).toMatch(
      /\*\*Variant D\*\* — \d+ substitution\(s\) matched the real DOM; \*\*zero misses\*\*/,
    )
  })
})

describe("doorVocabulary — the characters, asserted by codepoint", () => {
  it("the return control and the switch CTA carry ANGLE QUOTATION MARKS, not < and >", () => {
    // U+2039 / U+203A. A `<` or a `>` looks close enough in a diff and in most editors, and
    // it would additionally have to be escaped in JSX — the kind of substitution a reviewer
    // waves through and a renderer does not.
    expect(doorVocabulary.STRIP_BACK.codePointAt(0)).toBe(ANGLE_LEFT)
    const cta = doorVocabulary.SWITCH_CTA
    expect(cta.codePointAt(cta.length - 1)).toBe(ANGLE_RIGHT)
    expect(doorVocabulary.STRIP_BACK.includes("<")).toBe(false)
    expect(cta.includes(">")).toBe(false)
  })

  it("the describe strip's lightning bolt is U+26A1, the glyph its own door card carries", () => {
    expect(doorVocabulary.STRIP_LABEL.codePointAt(0)).toBe(HIGH_VOLTAGE)
    // ⚠ AND THE GOVERN STRIP CARRIES NO GLYPH AT ALL — asserted, not left to be noticed.
    // That asymmetry is a CONSEQUENCE of D-23 (the label becomes the door's name, and the
    // name has no glyph), not a discretionary choice, and it is routed to UAT row U6 so the
    // operator rules on it by looking. Pinned here so it cannot be "restored" by accident.
    const governFirst = doorVocabulary.STRIP_LABEL_GOVERN.codePointAt(0)
    expect(governFirst).toBeLessThan(0x2000)
    expect(doorVocabulary.STRIP_LABEL_GOVERN.startsWith("B")).toBe(true)
  })

  it("every SEPARATOR dash in the table is an EM DASH (U+2014), never a hyphen or an en dash", () => {
    const seen: string[] = []
    for (const [id, value] of ALL_DOOR_WORDS) {
      for (const cp of separatorCodepoints(value, DASH_LIKE)) {
        expect(cp, `${id} uses a dash that is not an em dash`).toBe(EM_DASH)
        seen.push(id)
      }
      // A double hyphen is the other way this substitution arrives — from an editor that
      // "helpfully" un-composes the character, or from a paste out of plain-text notes.
      expect(value.includes("--"), `${id} carries a double hyphen`).toBe(false)
    }
    // NON-VACUITY: the table really does contain separator dashes to have gotten wrong.
    expect(seen.length).toBeGreaterThanOrEqual(2)
    // …and a hyphen INSIDE a word is untouched by the rule above, which is why the rule is
    // scoped to space-flanked characters rather than to every dash in the string.
    expect(separatorCodepoints("per-step sources", DASH_LIKE)).toEqual([])
    expect(separatorCodepoints("a – b", DASH_LIKE)).toEqual([0x2013])
  })

  it("every SEPARATOR dot is a MIDDLE DOT (U+00B7), never a bullet and never a full stop", () => {
    const seen: string[] = []
    for (const [id, value] of ALL_DOOR_WORDS) {
      for (const cp of separatorCodepoints(value, DOT_LIKE)) {
        expect(cp, `${id} uses a separator dot that is not a middle dot`).toBe(MIDDLE_DOT)
        seen.push(id)
      }
    }
    // NON-VACUITY: at least one value really does separate with middle dots.
    expect(seen.length).toBeGreaterThanOrEqual(2)
    // POSITIVE CONTROL — the walk really catches both lookalikes it exists to catch.
    expect(separatorCodepoints("a • b", DOT_LIKE)).toEqual([0x2022])
    expect(separatorCodepoints("a . b", DOT_LIKE)).toEqual([0x002e])
  })

  it("the ampersands are PLAIN, never the JSX entity — the entity conversion, asserted", () => {
    // The move's one honest source-level difference (see the module header): JSX spelled the
    // entity, a TypeScript string spells one character, and React re-serialises it on render.
    // An entity surviving into this table would render its five literal characters on screen.
    for (const [id, value] of ALL_DOOR_WORDS) {
      expect(value, `${id} carries a raw HTML entity`).not.toMatch(/&(amp|lt|gt|quot|#\d+);/)
    }
    // NON-VACUITY: the table really does contain an ampersand to have gotten this wrong with.
    expect(ALL_DOOR_WORDS.filter(([, v]) => v.includes("&")).length).toBeGreaterThan(0)
  })
})

describe("doorVocabulary — why containment assertions are forbidden (rule 2)", () => {
  it("⚠ DEMONSTRATED: several shipped values CONTAIN another id's whole value", () => {
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
    // At least one exists — so a fragment check cannot identify a row, and every assertion in
    // this repo about these strings compares WHOLE STRINGS.
    expect(containments.length).toBeGreaterThan(0)
    // Named for the reader, still derived: the door-B name is the one that recurs most, and
    // after column D it is ALSO an exact duplicate of a third id — so the fragment is true of
    // three rows at once, which is the strongest form this hazard takes anywhere in the repo.
    expect(containments.includes("SWITCH_CTA ⊃ DOOR_B_NAME")).toBe(true)
    expect(doorVocabulary.STRIP_LABEL_GOVERN).toBe(doorVocabulary.DOOR_B_NAME)
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
    // ties the two subjects of this file together — the runtime table and the raw text. The
    // pattern allows an optional TYPE ANNOTATION, because D-23's agreement fence is one.
    for (const [id] of ALL_DOOR_WORDS) {
      expect(doorVocabularySource, `${id} is not declared in the loaded source`).toMatch(
        new RegExp(`^export const ${id}\\b`, "m"),
      )
    }
    // …and D-23's fence really is an ANNOTATION in the source, not merely two literals that
    // happen to agree at runtime. Without this line the equality above could hold with the
    // typecheck defending nothing.
    expect(doorVocabularySource).toMatch(
      /^export const STRIP_LABEL_GOVERN:\s*typeof DOOR_B_NAME\s*=/m,
    )
  })

  it("no UN-governed string travelled into the table with the ones that are", () => {
    // The contract's COPY table is the boundary. These four ship on the same two components
    // and are deliberately NOT governed — moving them would put strings in the vocabulary
    // module that the contract's substitution audit cannot verify, which is a different
    // failure from leaving a governed one behind and needs its own guard.
    for (const ungoverned of ["Open ›", "business requirement", "judge always-on", "TIERS."]) {
      expect(doorVocabularySource.includes(`"${ungoverned}"`), `${ungoverned} is exported`).toBe(
        false,
      )
      expect(ALL_DOOR_WORDS.map(([, v]) => v).includes(ungoverned)).toBe(false)
    }
    // NON-VACUITY: the check really reads a loaded source and a populated table.
    expect(doorVocabularySource.includes("export const STRIP_BACK")).toBe(true)
    expect(ALL_DOOR_WORDS.map(([, v]) => v).includes(doorVocabulary.DESCRIBE_CTA)).toBe(true)
  })
})
