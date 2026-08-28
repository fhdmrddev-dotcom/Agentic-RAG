/**
 * Phase 214-03 Task 3 — THE ARGUMENT VOCABULARY'S OWN SUITE.
 *
 * ── THE FIVE RULES THIS FILE FOLLOWS, INHERITED FROM `doorVocabulary.test.ts:1-55` ──────
 *
 * 1. WHOLE-TABLE PROPERTIES, NEVER ROW ASSERTIONS. Every property below is stated over the
 *    WHOLE table, derived from the module's own exports, so the 21st id inherits all of
 *    them the moment it is added. *A property stated only about the row being added is a
 *    property the next row can break in silence.* Nothing here hand-lists an identifier.
 *
 * 2. ⚠ EXACT MATCH, NEVER A CONTAINMENT ASSERTION. On a governed copy table a fragment
 *    check cannot identify a row — the door table demonstrates it mechanically, where one
 *    fragment is true of three rows at once. Every word below is compared WHOLE, and the
 *    forbidden matcher is not spelled anywhere in this file, because the plan's acceptance
 *    for this suite is a grep for it and prose quoting the pattern it bans makes that grep
 *    unreadable. Where a NEGATIVE about a substring is genuinely needed it is written as an
 *    explicit `String.prototype.includes` boolean compared with `toBe`.
 *
 * 3. THE LITERAL LIVES HERE, EXACTLY ONCE IN THIS REPOSITORY'S TESTS. `FLAT_COLUMN` and
 *    `COMPOSED_SHAPES` spell sketch 214 §1 as literals in the TEST, and the module is
 *    compared against them — which makes the assertion a FALSIFICATION of the table rather
 *    than a copy of it. ⭐ And because a literal in a test rots as quietly as one in a
 *    source file, a further case RE-READS the generated `BUILD-CONTRACT.generated.md` at
 *    test time and asserts the parsed id→value map equals `FLAT_COLUMN`. That case is the
 *    mechanism binding the sketch to the build: a sentence edited in one place and not the
 *    other is a red test rather than a silent disagreement.
 *
 *    ⚠ RESIDUAL, NAMED RATHER THAN CLAIMED FIXED. This suite reads the contract from
 *    `.planning/sketches/`, which `/gsd:complete-milestone` ARCHIVES. The shipped precedent
 *    hit this (`doorVocabulary.test.ts`, 193 review WR-08) and solved it by having the
 *    generator write an in-package copy — a generator this sketch does not have. Reading
 *    a `?raw` file outside the package is itself a shipped, green idiom
 *    (`ExternalActionSection.test.tsx:59` reads a backend `.py` the same way), so the import
 *    works today. **Re-open trigger: the first milestone close that archives
 *    `.planning/sketches/214-argument-form-and-its-source/`.** The fix at that point is to
 *    emit an in-package copy beside the module, never to weaken this case.
 *
 * 4. THE LEAF CLAIM IS ASSERTED, NOT DOCUMENTED. ⚠ Its non-vacuity control CANNOT be a
 *    positive import — there is none to find — so the claim is anchored on what the file
 *    DOES declare, plus a length floor: a `?raw` import of a moved or renamed module yields
 *    the EMPTY STRING in some resolvers rather than throwing, and every negative would then
 *    be about nothing at all (the 192.1 E-2 lesson).
 *
 * 5. ⚠ THE 187-24 TRAP, WHICH HAS FIRED ON THIS EXACT SURFACE TWICE. The escape-hatch sweep
 *    at the bottom globs every module under `/src` as raw text — so a needle SPELLED in this
 *    file's own prose would make the sweep count itself and pass while defending nothing.
 *    Every forbidden needle is therefore ASSEMBLED AT RUNTIME from fragments, and none of
 *    them appears contiguously anywhere in this file. A reviewer should grep this file for
 *    the literal to confirm its absence — that grep is the check, and it only works if the
 *    prose stays silent.
 */
import { describe, expect, it } from "vitest"

import * as argumentVocabulary from "./argumentVocabulary"
import argumentVocabularySource from "./argumentVocabulary?raw"
// The GENERATED acceptance bar itself, read as text so this suite can RE-DERIVE the table
// instead of trusting that someone ported it correctly (rule 3). See the residual above.
import buildContractSource from "../../../../.planning/sketches/214-argument-form-and-its-source/BUILD-CONTRACT.generated.md?raw"

/** Every FLAT (string-valued) export, DERIVED from the module rather than hand-listed. */
const FLAT_WORDS = Object.entries(argumentVocabulary).filter(
  ([, value]) => typeof value === "string",
) as [string, string][]

/** Every COMPOSED (function-valued) export, derived the same way. */
const COMPOSED_IDS = Object.entries(argumentVocabulary)
  .filter(([, value]) => typeof value === "function")
  .map(([id]) => id)
  .sort()

const FLAT_ID_COUNT = 20
const COMPOSED_ID_COUNT = 5

/**
 * ⚠ SKETCH 214 §1's FLAT TABLE, SPELLED AS LITERALS EXACTLY ONCE IN THIS REPOSITORY'S TESTS
 * (rule 3). Every assertion against the module compares against THIS object, never the
 * other way round, so a re-word in the module without a re-word here is a red test rather
 * than a silent agreement.
 */
const FLAT_COLUMN: Record<string, string> = {
  ARG_SOURCE_FIXED: "Set here",
  ARG_SOURCE_ASK: "Asked when this runs",
  ARG_SOURCE_UPSTREAM: "From an earlier step",
  ARG_SOURCE_GROUP_LABEL: "Where this comes from",
  ARG_READING_FIXED: "You set this",
  ARG_NO_SOURCE: "Nothing supplies this yet",
  ARG_REQUIRED_MARK: "Required",
  ARG_OPTIONAL_MARK: "Optional",
  ARG_PRESET_NOTE: "Set for you — change it if that is not what you meant.",
  ARG_UNRENDERABLE_REQUIRED: "This action cannot be used here yet.",
  ARG_UNRENDERABLE_OPTIONAL: "This step can still run — it will be left out.",
  ARG_SCHEMA_UNKNOWN: "We do not know what this action needs.",
  ARG_SCHEMA_UNKNOWN_NEXT: "Refresh actions",
  ARG_LEFTOVER_NEXT: "Remove it",
  ARG_SECTION_HEADING: "What this step sends",
  ARG_UPSTREAM_PICK_LABEL: "Which earlier step",
  ARG_UPSTREAM_NONE_OPTION: "— choose an earlier step —",
  ARG_UPSTREAM_EMPTY: "This is the first step — nothing runs before it.",
  ARG_ASK_KEY_LABEL: "Ask for it as",
  ARG_ASK_KEY_HINT: "This becomes a field on every way of starting this workflow.",
}

/**
 * ⚠ SKETCH 214 §1's COMPOSED TABLE. The contract writes each shape with `«x»`-style
 * placeholder tokens, so each entry below BINDS the module's named parameters to exactly
 * those tokens — calling the real function and comparing the result to the shape character
 * for character. That is stronger than checking a template by eye: a swapped parameter, a
 * dropped quotation mark or a substituted dash all fail here.
 */
const COMPOSED_SHAPES: Record<string, { shape: string; render: () => string }> = {
  ARG_READING_ASK: {
    shape: "Asked for as “«x»”",
    render: () => argumentVocabulary.ARG_READING_ASK({ key: "«x»" }),
  },
  ARG_READING_UPSTREAM: {
    shape: "Whatever “«x»” produced",
    render: () => argumentVocabulary.ARG_READING_UPSTREAM({ step: "«x»" }),
  },
  ARG_UNRENDERABLE: {
    shape: "“«x»” is a list of items — this form cannot fill it in.",
    render: () => argumentVocabulary.ARG_UNRENDERABLE({ arg: "«x»" }),
  },
  ARG_LEFTOVER: {
    shape: "“«x»” is not something this action accepts.",
    render: () => argumentVocabulary.ARG_LEFTOVER({ arg: "«x»" }),
  },
  ARG_STEP_IDENTITY: {
    shape: "«y» · «x»",
    render: () => argumentVocabulary.ARG_STEP_IDENTITY({ action: "«y»", service: "«x»" }),
  },
}

/** Every sentence this table ships — flat values plus every composed value RENDERED, so the
 *  character properties below cover the composed rows too rather than only the flat ones. */
const ALL_SENTENCES: [string, string][] = [
  ...FLAT_WORDS,
  ...Object.entries(COMPOSED_SHAPES).map(([id, spec]) => [id, spec.render()] as [string, string]),
]

const EM_DASH = 0x2014
const MIDDLE_DOT = 0x00b7

/** Dash-like codepoints: hyphen-minus plus the whole U+2010–U+2015 dash block. */
const DASH_LIKE = new Set([0x002d, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015])
/** Separator-dot lookalikes: middle dot, bullet, hyphenation point, dot operator, full stop. */
const DOT_LIKE = new Set([0x00b7, 0x2022, 0x2027, 0x22c5, 0x002e])

const WORD_CHAR = /[\p{L}\p{N}]/u

/** Every dash-like codepoint in `value` that is NOT an intra-word hyphen — i.e. one used as
 *  a separator or sitting at an edge. `per-step` keeps its hyphen legitimately; a leading or
 *  trailing dash is covered, which a space-flanked-only rule would skip entirely. */
function separatorDashes(value: string): number[] {
  const found: number[] = []
  for (let i = 0; i < value.length; i++) {
    const cp = value.codePointAt(i)
    if (cp === undefined || !DASH_LIKE.has(cp)) continue
    const left = value[i - 1]
    const right = value[i + 1]
    const intraWord = left !== undefined && right !== undefined && WORD_CHAR.test(left) && WORD_CHAR.test(right)
    if (!intraWord) found.push(cp)
  }
  return found
}

/** Every dot-like codepoint used as a SEPARATOR (flanked by spaces on both sides). A full
 *  stop ending a sentence is untouched, which is why the rule is scoped this way. */
function separatorDots(value: string): number[] {
  const found: number[] = []
  for (let i = 1; i < value.length - 1; i++) {
    const cp = value.codePointAt(i)
    if (cp !== undefined && DOT_LIKE.has(cp) && value[i - 1] === " " && value[i + 1] === " ") {
      found.push(cp)
    }
  }
  return found
}

/**
 * Parse sketch 214 §1's two markdown tables out of the generated contract.
 *
 * The contract's own shape: a row is `| \`ID\` | "value" |`, and a COMPOSED row's id cell
 * carries a `(…)` suffix inside the backticks. Rows with any other arity — §2's three-column
 * invariant table, §4's fork table — cannot match, because the value cell is required to
 * contain no pipe.
 */
function parseSketchTable(markdown: string): { flat: Record<string, string>; composed: Record<string, string> } {
  const flat: Record<string, string> = {}
  const composed: Record<string, string> = {}
  const ROW = /^\|\s*`([A-Z0-9_]+)(\(…\))?`\s*\|\s*"([^"|]*)"\s*\|\s*$/
  for (const line of markdown.split(/\r?\n/)) {
    const m = ROW.exec(line)
    if (!m) continue
    if (m[2]) composed[m[1]] = m[3]
    else flat[m[1]] = m[3]
  }
  return { flat, composed }
}

describe("argumentVocabulary — the table itself (rule 1)", () => {
  it(`owns exactly ${FLAT_ID_COUNT} flat ids and ${COMPOSED_ID_COUNT} composed, and nothing else`, () => {
    expect(FLAT_WORDS).toHaveLength(FLAT_ID_COUNT)
    expect(COMPOSED_IDS).toHaveLength(COMPOSED_ID_COUNT)
    // The module exports NOTHING BUT words and composers: no helper, no type-carrying const,
    // no default. A stray export here would silently break every loop below.
    expect(FLAT_WORDS.length + COMPOSED_IDS.length).toBe(
      Object.keys(argumentVocabulary).length,
    )
    // NON-VACUITY: the derivation really read the module rather than an empty namespace.
    expect(FLAT_WORDS.map(([id]) => id).includes("ARG_SOURCE_UPSTREAM")).toBe(true)
  })

  it("the module's flat export set and FLAT_COLUMN are the SAME SET (rule 1)", () => {
    // A value added to one and not the other is a failure, not a gap — which is what stops
    // the exact-match loop below from quietly covering nineteen of twenty ids.
    expect(Object.keys(FLAT_COLUMN).sort()).toEqual(FLAT_WORDS.map(([id]) => id).sort())
    expect(Object.keys(FLAT_COLUMN)).toHaveLength(FLAT_ID_COUNT)
  })

  it("the module's composed export set and COMPOSED_SHAPES are the SAME SET", () => {
    expect(Object.keys(COMPOSED_SHAPES).sort()).toEqual(COMPOSED_IDS)
  })

  it("every value is non-empty, single-line, and carries no edge whitespace", () => {
    for (const [id, value] of ALL_SENTENCES) {
      expect(value.length, `${id} is empty`).toBeGreaterThan(0)
      // A copy string that ships with an edge space renders a gap nobody typed, and it
      // survives every fragment check ever written about it.
      expect(value, `${id} has edge whitespace`).toBe(value.trim())
      expect(value, `${id} spans lines`).not.toMatch(/[\r\n]/)
    }
    expect(ALL_SENTENCES).toHaveLength(FLAT_ID_COUNT + COMPOSED_ID_COUNT)
  })

  it("the flat values are PAIRWISE DISTINCT — no id is a second spelling of another", () => {
    const collisions: string[] = []
    for (let i = 0; i < FLAT_WORDS.length; i++) {
      for (let j = i + 1; j < FLAT_WORDS.length; j++) {
        const [idA, valueA] = FLAT_WORDS[i]
        const [idB, valueB] = FLAT_WORDS[j]
        if (valueA === valueB) collisions.push(`${idA} === ${idB}`)
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

describe("argumentVocabulary — every word is EXACTLY its governed literal (rule 2 / rule 3)", () => {
  // One case per id, named by id, so a failure names the word rather than an index.
  for (const id of Object.keys(FLAT_COLUMN)) {
    it(`${id} is byte-exactly its governed literal`, () => {
      expect((argumentVocabulary as unknown as Record<string, string>)[id]).toBe(FLAT_COLUMN[id])
    })
  }

  for (const [id, spec] of Object.entries(COMPOSED_SHAPES)) {
    it(`${id} composes byte-exactly its governed shape`, () => {
      // The real function, called with the contract's own placeholder tokens bound to its
      // NAMED parameters. A swapped parameter reds here; a positional signature could not
      // have been checked this way at all.
      expect(spec.render()).toBe(spec.shape)
    })
  }
})

describe("argumentVocabulary — the generated contract IS the acceptance bar (rule 3)", () => {
  it("sketch 214 §1, re-parsed from BUILD-CONTRACT.generated.md, equals FLAT_COLUMN", () => {
    // NON-VACUITY FIRST. A `?raw` import that resolved to nothing yields the empty string in
    // some resolvers rather than throwing, and the comparison below would then be about a
    // table parsed out of nothing (the 192.1 E-2 lesson).
    expect(buildContractSource.length).toBeGreaterThan(2000)
    expect(buildContractSource).toMatch(/^# BUILD CONTRACT — sketch 214/m)
    expect(buildContractSource).toMatch(/GENERATED by `node drive\.cjs --emit`/)

    const parsed = parseSketchTable(buildContractSource)
    expect(Object.keys(parsed.flat)).toHaveLength(FLAT_ID_COUNT)
    expect(parsed.flat).toEqual(FLAT_COLUMN)
  })

  it("sketch 214 §1's COMPOSED table, re-parsed, equals the shapes this suite asserts", () => {
    const parsed = parseSketchTable(buildContractSource)
    expect(Object.keys(parsed.composed)).toHaveLength(COMPOSED_ID_COUNT)
    const declared = Object.fromEntries(
      Object.entries(COMPOSED_SHAPES).map(([id, spec]) => [id, spec.shape]),
    )
    expect(parsed.composed).toEqual(declared)
  })

  it("POSITIVE CONTROL — the parser really reads a two-cell row and really splits composed from flat", () => {
    // Without this the comparisons above could be passing on a parser that returns nothing,
    // or one that files every row under the same key.
    const fixture = [
      "| id | value |",
      "|---|---|",
      "| `DEMO_FLAT` | \"flat words\" |",
      "| `DEMO_COMPOSED(…)` | \"composed «x»\" |",
      "| 1 | three | cells |",
    ].join("\n")
    expect(parseSketchTable(fixture)).toEqual({
      flat: { DEMO_FLAT: "flat words" },
      composed: { DEMO_COMPOSED: "composed «x»" },
    })
  })
})

describe("argumentVocabulary — the characters, asserted by codepoint", () => {
  it("every separator or edge dash is an EM DASH (U+2014), never a hyphen or an en dash", () => {
    const seen: string[] = []
    for (const [id, value] of ALL_SENTENCES) {
      for (const cp of separatorDashes(value)) {
        expect(cp, `${id} uses a dash that is not an em dash`).toBe(EM_DASH)
        seen.push(id)
      }
      // A double hyphen is the other way this substitution arrives — from an editor that
      // un-composes the character, or from a paste out of plain-text notes.
      expect(value.includes("--"), `${id} carries a double hyphen`).toBe(false)
    }
    // NON-VACUITY: the table really does contain dashes to have gotten wrong.
    expect(seen.length).toBeGreaterThanOrEqual(4)
  })

  it("POSITIVE CONTROL — the dash walk catches an en dash and spares an intra-word hyphen", () => {
    expect(separatorDashes("a – b")).toEqual([0x2013])
    expect(separatorDashes("per-step sources")).toEqual([])
    expect(separatorDashes("- leading")).toEqual([0x002d])
    expect(separatorDashes("trailing -")).toEqual([0x002d])
  })

  it("every separator dot is a MIDDLE DOT (U+00B7), never a bullet and never a full stop", () => {
    const seen: string[] = []
    for (const [id, value] of ALL_SENTENCES) {
      for (const cp of separatorDots(value)) {
        expect(cp, `${id} uses a separator dot that is not a middle dot`).toBe(MIDDLE_DOT)
        seen.push(id)
      }
    }
    // NON-VACUITY: at least one value really does separate with a middle dot.
    expect(seen.length).toBeGreaterThanOrEqual(1)
    // POSITIVE CONTROL — the walk really catches both lookalikes it exists to catch.
    expect(separatorDots("a • b")).toEqual([0x2022])
    expect(separatorDots("a . b")).toEqual([0x002e])
  })

  it("the quotation marks around an interpolated name are the CURLY pair, never straight", () => {
    // A straight quote inside a rendered sentence reads as code, and it is the substitution
    // an editor makes silently. Every composed shape that quotes a name is checked.
    const quoting = ALL_SENTENCES.filter(([, v]) => v.includes("“"))
    expect(quoting.length).toBeGreaterThanOrEqual(4)
    for (const [id, value] of quoting) {
      expect(value.includes('"'), `${id} carries a straight quotation mark`).toBe(false)
      // Opens and closes are balanced — an unmatched curly quote renders as a stray mark.
      const opens = (value.match(/“/g) ?? []).length
      const closes = (value.match(/”/g) ?? []).length
      expect(opens, `${id} has unbalanced curly quotes`).toBe(closes)
    }
  })

  it("no sentence carries an exclamation, a severity word, or a raw HTML entity", () => {
    // `DESCRIBE_REFUSAL`'s rules, inherited whole: a refusal names what is missing and what
    // to do, and it never shouts. The exception list is DECLARED and asserted EMPTY, so a
    // future value that genuinely needs one of these words is a decision rather than a slip.
    const SEVERITY = /\b(error|invalid|failed|warning|critical)\b/i
    const DECLARED_SEVERITY_EXCEPTIONS: string[] = []
    expect(DECLARED_SEVERITY_EXCEPTIONS).toEqual([])
    const offenders: string[] = []
    for (const [id, value] of ALL_SENTENCES) {
      expect(value.includes("!"), `${id} carries an exclamation`).toBe(false)
      expect(value, `${id} carries a raw HTML entity`).not.toMatch(/&(amp|lt|gt|quot|#\d+);/)
      if (SEVERITY.test(value) && !DECLARED_SEVERITY_EXCEPTIONS.includes(id)) offenders.push(id)
    }
    expect(offenders).toEqual([])
    // POSITIVE CONTROL — the severity matcher really matches, and really respects a boundary.
    expect(SEVERITY.test("this is invalid")).toBe(true)
    expect(SEVERITY.test("Failure reason")).toBe(false)
  })
})

describe("argumentVocabulary — no wire id ever reaches a sentence (T-214-03-02)", () => {
  it("no value names a capability, a phase type, or any id-shaped token", () => {
    // Sketch 214 #13 / #15: the step names its SERVICE and its ACTION, never a capability id
    // and never the phrase this surface stopped using. ⚠ The needles are ASSEMBLED AT
    // RUNTIME (rule 5) — this suite's own source is inside the glob two describes below.
    const wireIds = [
      "send" + "_email",
      "create" + "_ticket",
      "post" + "_message",
      "ask" + "_question",
      "external" + "_action",
    ]
    const ID_SHAPED = /\b[a-z0-9]+_[a-z0-9_]+\b/
    for (const [id, value] of ALL_SENTENCES) {
      for (const wire of wireIds) {
        expect(value.includes(wire), `${id} names the wire id ${wire}`).toBe(false)
      }
      expect(value, `${id} carries an id-shaped token`).not.toMatch(ID_SHAPED)
    }
    // POSITIVE CONTROLS — both matchers really match.
    expect("it ran " + "post" + "_message".concat("")).toMatch(ID_SHAPED)
    expect(ID_SHAPED.test("plain english only")).toBe(false)
    expect(ALL_SENTENCES.length).toBeGreaterThan(20)
  })
})

describe("argumentVocabulary — the module is a TRUE LEAF (rule 4)", () => {
  it("imports nothing at all — not a component, not React, not a type", () => {
    const ANY_IMPORT = /^\s*import\s/m
    const ANY_FROM = /from\s+["'][^"']+["']/
    const DYNAMIC_IMPORT = /import\s*\(/
    // POSITIVE CONTROLS first — a matcher that cannot match passes vacuously and looks
    // exactly like a fence that holds.
    expect('import type { PhaseSpecJSON } from "@/types"').toMatch(ANY_IMPORT)
    expect('import type { PhaseSpecJSON } from "@/types"').toMatch(ANY_FROM)
    expect('const m = await import("./x")').toMatch(DYNAMIC_IMPORT)

    expect(argumentVocabularySource).not.toMatch(ANY_IMPORT)
    expect(argumentVocabularySource).not.toMatch(ANY_FROM)
    expect(argumentVocabularySource).not.toMatch(DYNAMIC_IMPORT)

    // ⚠ NON-VACUITY FOR A ZERO-IMPORT LEAF CANNOT BE A POSITIVE IMPORT (rule 4). Anchored
    // instead on what the file DOES declare, plus a length floor.
    expect(argumentVocabularySource.length).toBeGreaterThan(2000)
    expect(argumentVocabularySource).toMatch(/export const /)
    // Every id the namespace reports is really DECLARED in the source that was loaded, which
    // ties the two subjects of this file together — the runtime table and the raw text.
    for (const [id] of FLAT_WORDS) {
      expect(argumentVocabularySource, `${id} is not declared in the loaded source`).toMatch(
        new RegExp(`^export const ${id}\\b`, "m"),
      )
    }
    for (const id of COMPOSED_IDS) {
      expect(argumentVocabularySource, `${id} is not declared in the loaded source`).toMatch(
        new RegExp(`^export const ${id} = \\(`, "m"),
      )
    }
  })
})

describe("⚠ argumentVocabulary — THE ESCAPE HATCH IS ABSENT, AND THE ABSENCE IS SWEPT (D-214-06)", () => {
  it("this module's own source names no escape hatch, in a value OR in its prose", () => {
    // ⚠ Rule 5: every needle is ASSEMBLED AT RUNTIME. Spelling one here would put it in the
    // glob below as this file's own text, and the sweep would then count its own prose —
    // the 187-24 trap, which has fired on this exact surface twice.
    const needles = ["js" + "on", "text" + "area", "adv" + "anced", "key" + "-value", "key" + "/value"]
    const lowered = argumentVocabularySource.toLowerCase()
    for (const needle of needles) {
      expect(lowered.includes(needle), `argumentVocabulary.ts names ${needle}`).toBe(false)
    }
    // NON-VACUITY: the source really is loaded, and the matcher really matches.
    expect(lowered.includes("export const arg_source_fixed")).toBe(true)
    expect("a Tool Arguments box".toLowerCase().includes(needles[0])).toBe(false)
    expect("a plain js".concat("on box").toLowerCase().includes(needles[0])).toBe(true)
  })

  it("⚠ NO MODULE UNDER `workflows` EXPORTS ESCAPE-HATCH COPY — swept tree-wide", () => {
    const modules = import.meta.glob("/src/**/*.{ts,tsx}", {
      query: "?raw",
      eager: true,
      import: "default",
    }) as Record<string, string>
    // ⚠ NON-VACUITY FIRST — an empty glob makes every absence below FREE, and the failure is
    // invisible. This control is the only guard against that, and it is asserted before any
    // absence is claimed.
    expect(Object.keys(modules).length).toBeGreaterThan(200)
    const workflowModules = Object.entries(modules).filter(([path]) =>
      path.startsWith("/src/components/workflows/"),
    )
    expect(workflowModules.length).toBeGreaterThan(50)

    const needles = ["js" + "on", "text" + "area", "adv" + "anced", "key" + "-value", "key" + "/value"]
    // An EXPORTED string literal is user-facing copy; `JSON.parse` in a helper is not. The
    // fence is about what the product SAYS, so it reads exported literals only.
    const EXPORTED_COPY = /export\s+const\s+[A-Za-z0-9_]+\s*(?::[^=\n]*)?=\s*\n?\s*"([^"]*)"/g

    const offenders: string[] = []
    for (const [path, source] of workflowModules) {
      if (path.includes(".test.")) continue
      let m: RegExpExecArray | null
      EXPORTED_COPY.lastIndex = 0
      while ((m = EXPORTED_COPY.exec(source)) !== null) {
        const value = m[1].toLowerCase()
        if (needles.some((n) => value.includes(n))) offenders.push(path)
      }
    }

    /**
     * ⚠ THE ONE OFFENDER THAT EXISTS TODAY, DECLARED RATHER THAN EXCLUDED BY A LOOSER RULE.
     *
     * `McpToolPicker.tsx` still exports the label sketch 214 #1 forbids; **plan `214-07` owns
     * its deletion**, and this plan owns only the vocabulary half of D-214-06. Declaring it
     * keeps the fence tree-wide and green today, and the case below makes the entry
     * SELF-RETIRING: an exemption that is no longer offending is a red test, so `214-07`
     * cannot land its deletion and leave a fiction behind here.
     */
    const DECLARED_OFFENDERS = ["/src/components/workflows/McpToolPicker.tsx"]
    expect([...new Set(offenders)].sort()).toEqual(DECLARED_OFFENDERS)

    // …and the declared exemption is not a dead entry excusing something that no longer
    // exists. Each one must ACTUALLY still carry the identifier, assembled at runtime.
    const forbiddenIdentifier = "MCP_TOOL_" + "ARGS_LABEL"
    for (const path of DECLARED_OFFENDERS) {
      const source = modules[path]
      expect(source, `${path} is no longer in the tree`).toBeTypeOf("string")
      expect(
        source.includes(forbiddenIdentifier),
        `${path} no longer offends — remove it from DECLARED_OFFENDERS (214-07 has landed)`,
      ).toBe(true)
    }

    // POSITIVE CONTROL — the copy matcher really finds an exported literal.
    const planted = 'export const DEMO_LABEL = "Tool Arguments (JS' + 'ON)"'
    EXPORTED_COPY.lastIndex = 0
    const hit = EXPORTED_COPY.exec(planted)
    expect(hit?.[1].toLowerCase().includes(needles[0])).toBe(true)
  })

  it("⚠ the NEW argument vocabulary is not on the exemption list, and never will be", () => {
    // The exemption above is a bridge to `214-07`, not a category. This case states that the
    // surface this plan ships is held to the rule with no exception at all — so a future
    // edit cannot quietly add this module's path beside `McpToolPicker.tsx`.
    const modules = import.meta.glob("/src/**/*.{ts,tsx}", {
      query: "?raw",
      eager: true,
      import: "default",
    }) as Record<string, string>
    expect(Object.keys(modules).length).toBeGreaterThan(200)
    const mine = modules["/src/components/workflows/argumentVocabulary.ts"]
    expect(mine, "the vocabulary module is not in the glob").toBeTypeOf("string")
    expect(mine.length).toBeGreaterThan(2000)
    const needles = ["js" + "on", "text" + "area", "adv" + "anced"]
    for (const needle of needles) {
      expect(mine.toLowerCase().includes(needle)).toBe(false)
    }
  })
})
