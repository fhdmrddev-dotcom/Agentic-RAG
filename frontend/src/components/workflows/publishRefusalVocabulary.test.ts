/**
 * Phase 214-03 Task 3 — THE PUBLISH-REFUSAL VOCABULARY'S OWN SUITE.
 *
 * The five rules are `doorVocabulary.test.ts:1-55`'s, inherited whole and stated in
 * `argumentVocabulary.test.ts`'s header: whole-table properties never row assertions; exact
 * match never containment; the literal lives in the TEST exactly once so the assertion
 * FALSIFIES the table rather than copying it; the generated contract is RE-PARSED at test
 * time so the sketch is bound to the build; and the leaf claim is asserted, not documented.
 *
 * ── ⭐ WHAT THIS SUITE CARRIES THAT ITS SIBLINGS DO NOT ────────────────────────────────
 *
 * This module is the DECLARING HOME of `ArgumentGapKind` in TypeScript, so two further
 * properties are asserted here and nowhere else:
 *
 *   1. `Object.keys(REFUSAL_FOR_KIND)` is EXACTLY the five gap kinds — the pairing plan
 *      `214-05` depends on, and the thing a `switch` with a `default:` could not guarantee.
 *   2. ⭐ Those keys equal THE MEMBERS OF THE EXPORTED UNION, extracted from this module's
 *      own `?raw` source. That is what makes plan `214-14`'s S-4 cross-language check
 *      meaningful: S-4 parses the union out of THIS declaring module and compares it against
 *      `args.py`'s `ArgumentGapKind`. ⚠ If a consumer had re-typed the five literals inline,
 *      S-4 would be comparing Python against a copy of itself.
 *
 * And one restraint that is STRUCTURAL rather than remembered: `REFUSE_SHAPE_UNKNOWN` takes
 * no `arg` parameter at all (sketch 215 #2), so `REFUSAL_FOR_KIND.shape_unknown` is driven
 * below with a distinctive argument name and asserted to drop it.
 *
 * ⚠ RESIDUAL (same as its siblings): the contract is read from `.planning/sketches/`, which
 * `/gsd:complete-milestone` archives. Re-open trigger: the first milestone close that
 * archives `.planning/sketches/215-publish-refuses-by-name/`. The fix is an in-package copy,
 * never a weakened case.
 */
import { describe, expect, it } from "vitest"

import * as publishRefusalVocabulary from "./publishRefusalVocabulary"
import publishRefusalVocabularySource from "./publishRefusalVocabulary?raw"
import buildContractSource from "../../../../.planning/sketches/215-publish-refuses-by-name/BUILD-CONTRACT.generated.md?raw"

const { REFUSAL_FOR_KIND, REFUSAL_NEXT_FOR_KIND } = publishRefusalVocabulary

/** Every FLAT (string-valued) export, DERIVED from the module rather than hand-listed. */
const FLAT_WORDS = Object.entries(publishRefusalVocabulary).filter(
  ([, value]) => typeof value === "string",
) as [string, string][]

/** Every COMPOSED (function-valued) export, derived the same way. */
const COMPOSED_IDS = Object.entries(publishRefusalVocabulary)
  .filter(([, value]) => typeof value === "function")
  .map(([id]) => id)
  .sort()

const FLAT_ID_COUNT = 11
const COMPOSED_ID_COUNT = 7

/**
 * ⚠ THE FIVE GAP KINDS, SPELLED AS LITERALS EXACTLY ONCE IN THIS REPOSITORY'S TESTS. Both
 * the map's keys and the union's members are compared against THIS list, so a sixth kind
 * added to only one of the three places is a red test rather than a silent drift.
 */
const GAP_KINDS = [
  "ask_undeclared",
  "no_source",
  "shape_unknown",
  "unrenderable",
  "upstream_unreachable",
]

/** ⚠ SKETCH 215 §1's FLAT TABLE, spelled as literals exactly once (rule 3). */
const FLAT_COLUMN: Record<string, string> = {
  REFUSE_NEXT: "Go to the step",
  REFUSE_NEXT_REDISCOVER: "Refresh actions",
  REFUSE_TITLE: "Not published",
  REFUSE_COUNT_ONE: "One step cannot run as written.",
  STAGE_STRUCTURE: "Structure",
  STAGE_STRUCTURE_WHAT: "Reachable · terminal · inputs satisfied · no orphans",
  STAGE_PASSED: "Checked",
  STAGE_BLOCKED: "Stopped here",
  STAGE_NOT_REACHED: "Not reached",
  GOLDEN_NO_SEND: "Checked what each step would send. Nothing was sent.",
  ALREADY_PUBLISHED_NOTE:
    "Published workflows keep running — this check applies the next time one is published.",
}

/**
 * ⚠ SKETCH 215 §1's COMPOSED TABLE. Each entry binds the contract's `«…»` placeholder tokens
 * to the module's NAMED parameters and calls the real function, so a swapped parameter reds
 * here — which matters more on this table than anywhere else in the phase: three of these
 * sentences interpolate two or three plain strings, and a positional signature would let a
 * step name and an argument name trade places while still typechecking.
 *
 * The two COUNT rows carry a `substitutions` map because the contract writes their numeric
 * slot with the same `«step»` token: the expected string is the shape with that token
 * replaced, rather than a number the function could never have produced.
 */
const COMPOSED_SHAPES: Record<
  string,
  { shape: string; render: () => string; substitutions?: Record<string, string> }
> = {
  REFUSE_NO_SOURCE: {
    shape: "Nothing supplies “«arg»” in “«step»”.",
    render: () =>
      publishRefusalVocabulary.REFUSE_NO_SOURCE({ arg: "«arg»", step: "«step»" }),
  },
  REFUSE_ASK_UNDECLARED: {
    shape: "“«step»” asks for “«arg»” when it runs, but nothing asks for it.",
    render: () =>
      publishRefusalVocabulary.REFUSE_ASK_UNDECLARED({ step: "«step»", arg: "«arg»" }),
  },
  REFUSE_UPSTREAM_UNREACHABLE: {
    shape: "“«step»” takes “«arg»” from “«upstream»”, which does not run before it.",
    render: () =>
      publishRefusalVocabulary.REFUSE_UPSTREAM_UNREACHABLE({
        step: "«step»",
        arg: "«arg»",
        upstream: "«upstream»",
      }),
  },
  REFUSE_SHAPE_UNKNOWN: {
    shape: "We do not know what “«step»” needs.",
    render: () => publishRefusalVocabulary.REFUSE_SHAPE_UNKNOWN({ step: "«step»" }),
  },
  REFUSE_UNRENDERABLE: {
    shape: "“«arg»” in “«step»” is a list of items — nothing here can fill it in.",
    render: () =>
      publishRefusalVocabulary.REFUSE_UNRENDERABLE({ arg: "«arg»", step: "«step»" }),
  },
  REFUSE_COUNT_MANY: {
    shape: "«step» steps cannot run as written.",
    substitutions: { "«step»": "4" },
    render: () => publishRefusalVocabulary.REFUSE_COUNT_MANY({ count: 4 }),
  },
  REFUSE_REST_OK: {
    shape: "The other «step» are ready.",
    substitutions: { "«step»": "4" },
    render: () => publishRefusalVocabulary.REFUSE_REST_OK({ count: 4 }),
  },
}

/** The shape a composed id must render to, after its declared token substitutions. */
function expectedFor(spec: { shape: string; substitutions?: Record<string, string> }): string {
  let out = spec.shape
  for (const [token, value] of Object.entries(spec.substitutions ?? {})) {
    out = out.split(token).join(value)
  }
  return out
}

/** Every sentence this table ships — flat values plus every composed value RENDERED. */
const ALL_SENTENCES: [string, string][] = [
  ...FLAT_WORDS,
  ...Object.entries(COMPOSED_SHAPES).map(([id, spec]) => [id, spec.render()] as [string, string]),
]

const EM_DASH = 0x2014
const MIDDLE_DOT = 0x00b7
const DASH_LIKE = new Set([0x002d, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015])
const DOT_LIKE = new Set([0x00b7, 0x2022, 0x2027, 0x22c5, 0x002e])
const WORD_CHAR = /[\p{L}\p{N}]/u

function separatorDashes(value: string): number[] {
  const found: number[] = []
  for (let i = 0; i < value.length; i++) {
    const cp = value.codePointAt(i)
    if (cp === undefined || !DASH_LIKE.has(cp)) continue
    const left = value[i - 1]
    const right = value[i + 1]
    const intraWord =
      left !== undefined && right !== undefined && WORD_CHAR.test(left) && WORD_CHAR.test(right)
    if (!intraWord) found.push(cp)
  }
  return found
}

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

/** Parse sketch 215 §1's two tables. Rows are `| \`ID\` | "value" |`; a COMPOSED row's id
 *  cell carries a `(…)` suffix inside the backticks. §2's three-column invariant table and
 *  §4's kind table cannot match — the value cell is required to contain no pipe, and §4's
 *  ids are lower-case. */
function parseSketchTable(markdown: string): {
  flat: Record<string, string>
  composed: Record<string, string>
} {
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

/** Extract the members of the exported `ArgumentGapKind` union from the module's own SOURCE
 *  — scoped to the declaration itself, so a docblock mentioning a kind cannot feed it. */
function parseUnionMembers(source: string): string[] {
  // ⚠ The terminator is CRLF-tolerant deliberately. This module is checked out with CRLF
  // line endings on Windows, so a bare two-linefeed terminator never matched: the extractor
  // returned an empty array and the equality below could only have passed by both sides being
  // empty. Measured post-merge, Phase 214 wave 1.
  const decl = /export type ArgumentGapKind =([\s\S]*?)\r?\n\r?\n/.exec(source)
  if (!decl) return []
  return [...decl[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort()
}

describe("publishRefusalVocabulary — the table itself (rule 1)", () => {
  it(`owns exactly ${FLAT_ID_COUNT} flat ids, ${COMPOSED_ID_COUNT} composed, and two maps`, () => {
    expect(FLAT_WORDS).toHaveLength(FLAT_ID_COUNT)
    expect(COMPOSED_IDS).toHaveLength(COMPOSED_ID_COUNT)
    // The only non-string, non-function exports are the two `Record` maps. A stray export
    // here would silently break every loop below.
    const others = Object.entries(publishRefusalVocabulary)
      .filter(([, v]) => typeof v !== "string" && typeof v !== "function")
      .map(([id]) => id)
      .sort()
    expect(others).toEqual(["REFUSAL_FOR_KIND", "REFUSAL_NEXT_FOR_KIND"])
    // NON-VACUITY: the derivation really read the module rather than an empty namespace.
    expect(FLAT_WORDS.map(([id]) => id).includes("REFUSE_TITLE")).toBe(true)
  })

  it("the module's flat export set and FLAT_COLUMN are the SAME SET (rule 1)", () => {
    expect(Object.keys(FLAT_COLUMN).sort()).toEqual(FLAT_WORDS.map(([id]) => id).sort())
    expect(Object.keys(FLAT_COLUMN)).toHaveLength(FLAT_ID_COUNT)
  })

  it("the module's composed export set and COMPOSED_SHAPES are the SAME SET", () => {
    expect(Object.keys(COMPOSED_SHAPES).sort()).toEqual(COMPOSED_IDS)
  })

  it("every value is non-empty, single-line, and carries no edge whitespace", () => {
    for (const [id, value] of ALL_SENTENCES) {
      expect(value.length, `${id} is empty`).toBeGreaterThan(0)
      expect(value, `${id} has edge whitespace`).toBe(value.trim())
      expect(value, `${id} spans lines`).not.toMatch(/[\r\n]/)
    }
    expect(ALL_SENTENCES).toHaveLength(FLAT_ID_COUNT + COMPOSED_ID_COUNT)
  })

  it("the flat values are PAIRWISE DISTINCT", () => {
    const collisions: string[] = []
    for (let i = 0; i < FLAT_WORDS.length; i++) {
      for (let j = i + 1; j < FLAT_WORDS.length; j++) {
        if (FLAT_WORDS[i][1] === FLAT_WORDS[j][1]) {
          collisions.push(`${FLAT_WORDS[i][0]} === ${FLAT_WORDS[j][0]}`)
        }
      }
    }
    expect(collisions).toEqual([])
  })

  it("POSITIVE CONTROL — the distinctness walk really catches a duplicate", () => {
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

describe("publishRefusalVocabulary — every word is EXACTLY its governed literal (rules 2/3)", () => {
  for (const id of Object.keys(FLAT_COLUMN)) {
    it(`${id} is byte-exactly its governed literal`, () => {
      expect((publishRefusalVocabulary as unknown as Record<string, string>)[id]).toBe(
        FLAT_COLUMN[id],
      )
    })
  }

  for (const [id, spec] of Object.entries(COMPOSED_SHAPES)) {
    it(`${id} composes byte-exactly its governed shape`, () => {
      expect(spec.render()).toBe(expectedFor(spec))
    })
  }
})

describe("publishRefusalVocabulary — the generated contract IS the acceptance bar (rule 3)", () => {
  it("sketch 215 §1, re-parsed from BUILD-CONTRACT.generated.md, equals FLAT_COLUMN", () => {
    // NON-VACUITY FIRST — a `?raw` import that resolved to nothing yields the empty string in
    // some resolvers rather than throwing (the 192.1 E-2 lesson).
    expect(buildContractSource.length).toBeGreaterThan(2000)
    expect(buildContractSource).toMatch(/^# BUILD CONTRACT — sketch 215/m)
    expect(buildContractSource).toMatch(/GENERATED by `node drive\.cjs --emit`/)

    const parsed = parseSketchTable(buildContractSource)
    expect(Object.keys(parsed.flat)).toHaveLength(FLAT_ID_COUNT)
    expect(parsed.flat).toEqual(FLAT_COLUMN)
  })

  it("sketch 215 §1's COMPOSED table, re-parsed, equals the shapes this suite asserts", () => {
    const parsed = parseSketchTable(buildContractSource)
    expect(Object.keys(parsed.composed)).toHaveLength(COMPOSED_ID_COUNT)
    const declared = Object.fromEntries(
      Object.entries(COMPOSED_SHAPES).map(([id, spec]) => [id, spec.shape]),
    )
    expect(parsed.composed).toEqual(declared)
  })

  it("POSITIVE CONTROL — the parser really splits composed from flat and ignores wider rows", () => {
    const fixture = [
      "| id | value |",
      "|---|---|",
      "| `DEMO_FLAT` | \"flat words\" |",
      "| `DEMO_COMPOSED(…)` | \"composed «x»\" |",
      "| `no-source` | lower-case id | third cell |",
    ].join("\n")
    expect(parseSketchTable(fixture)).toEqual({
      flat: { DEMO_FLAT: "flat words" },
      composed: { DEMO_COMPOSED: "composed «x»" },
    })
  })
})

describe("⭐ publishRefusalVocabulary — the gap-kind pairing is COMPILER-ENFORCED (D-214-09)", () => {
  it("REFUSAL_FOR_KIND's keys are EXACTLY the five gap kinds", () => {
    expect(Object.keys(REFUSAL_FOR_KIND).sort()).toEqual(GAP_KINDS)
    expect(GAP_KINDS).toHaveLength(5)
    for (const kind of GAP_KINDS) {
      expect(
        typeof (REFUSAL_FOR_KIND as Record<string, unknown>)[kind],
        `${kind} has no refusal`,
      ).toBe("function")
    }
  })

  it("REFUSAL_NEXT_FOR_KIND's keys are the same five, and only shape_unknown re-discovers", () => {
    expect(Object.keys(REFUSAL_NEXT_FOR_KIND).sort()).toEqual(GAP_KINDS)
    // The fix for an unknown shape is re-discovery, not an edit — so sending the reader to
    // the step would be sending them somewhere they can do nothing.
    expect(REFUSAL_NEXT_FOR_KIND.shape_unknown).toBe(
      publishRefusalVocabulary.REFUSE_NEXT_REDISCOVER,
    )
    const others = GAP_KINDS.filter((k) => k !== "shape_unknown")
    expect(others).toHaveLength(4)
    for (const kind of others) {
      expect(
        (REFUSAL_NEXT_FOR_KIND as Record<string, string>)[kind],
        `${kind} does not offer the step`,
      ).toBe(publishRefusalVocabulary.REFUSE_NEXT)
    }
  })

  it("⭐ the map's keys equal THE UNION'S MEMBERS, read from this module's own source", () => {
    // This is the assertion plan `214-14`'s S-4 rests on: S-4 parses the union out of THIS
    // declaring module and compares it with `args.py`. If a consumer had re-typed the five
    // literals inline, S-4 would be comparing Python against a copy of itself.
    const members = parseUnionMembers(publishRefusalVocabularySource)
    expect(members).toEqual(GAP_KINDS)
    expect(members).toEqual(Object.keys(REFUSAL_FOR_KIND).sort())
    // NON-VACUITY + POSITIVE CONTROL — the extractor really reads a declaration, and really
    // returns nothing when there is none, so an empty result cannot pass as agreement.
    expect(publishRefusalVocabularySource.length).toBeGreaterThan(2000)
    expect(parseUnionMembers('export type ArgumentGapKind =\n  | "a"\n  | "b"\n\nrest')).toEqual([
      "a",
      "b",
    ])
    expect(parseUnionMembers("nothing here")).toEqual([])
  })

  it("⚠ the shape_unknown refusal INVENTS NO ARGUMENT NAME (sketch 215 #2)", () => {
    // Driven through the MAP rather than the function, so the restraint is proved where a
    // caller actually meets it. The argument name is distinctive precisely so its absence
    // cannot be a coincidence of wording.
    const facts = { step: "Tell the team", arg: "ZZQ_DISTINCTIVE_ARG", upstream: "Draft it" }
    const sentence = REFUSAL_FOR_KIND.shape_unknown(facts)
    expect(sentence.includes(facts.arg), "the unknown-shape refusal named an argument").toBe(false)
    expect(sentence.includes(facts.upstream), "it named an upstream it cannot know").toBe(false)
    // …and it DOES name the step, so the absence above is restraint rather than an empty
    // sentence. POSITIVE CONTROL: a sibling kind with the same facts DOES name the argument.
    expect(sentence.includes(facts.step)).toBe(true)
    expect(REFUSAL_FOR_KIND.no_source(facts).includes(facts.arg)).toBe(true)
  })

  it("every refusal names the step IN THE AUTHOR'S OWN WORDS, never a slug (sketch 215 #1)", () => {
    const facts = { step: "Tell the team", arg: "subject", upstream: "Draft it" }
    const slug = "tell-the-team"
    for (const kind of GAP_KINDS) {
      const sentence = (
        REFUSAL_FOR_KIND as Record<string, (f: typeof facts) => string>
      )[kind](facts)
      expect(sentence.includes(facts.step), `${kind} does not name the step`).toBe(true)
      expect(sentence.includes(slug), `${kind} leaked a slug`).toBe(false)
      expect(sentence.endsWith("."), `${kind} is not a sentence`).toBe(true)
    }
  })
})

describe("publishRefusalVocabulary — the characters, asserted by codepoint", () => {
  it("every separator or edge dash is an EM DASH (U+2014)", () => {
    const seen: string[] = []
    for (const [id, value] of ALL_SENTENCES) {
      for (const cp of separatorDashes(value)) {
        expect(cp, `${id} uses a dash that is not an em dash`).toBe(EM_DASH)
        seen.push(id)
      }
      expect(value.includes("--"), `${id} carries a double hyphen`).toBe(false)
    }
    // NON-VACUITY: the table really does contain dashes to have gotten wrong.
    expect(seen.length).toBeGreaterThanOrEqual(2)
  })

  it("POSITIVE CONTROL — the dash walk catches an en dash and spares an intra-word hyphen", () => {
    expect(separatorDashes("a – b")).toEqual([0x2013])
    expect(separatorDashes("per-step sources")).toEqual([])
  })

  it("every separator dot is a MIDDLE DOT (U+00B7), never a bullet and never a full stop", () => {
    const seen: string[] = []
    for (const [id, value] of ALL_SENTENCES) {
      for (const cp of separatorDots(value)) {
        expect(cp, `${id} uses a separator dot that is not a middle dot`).toBe(MIDDLE_DOT)
        seen.push(id)
      }
    }
    // NON-VACUITY: the stage's "what it checks" line really does separate with middle dots.
    expect(seen.length).toBeGreaterThanOrEqual(3)
    expect(separatorDots("a • b")).toEqual([0x2022])
    expect(separatorDots("a . b")).toEqual([0x002e])
  })

  it("the quotation marks around an interpolated name are the CURLY pair, never straight", () => {
    const quoting = ALL_SENTENCES.filter(([, v]) => v.includes("“"))
    expect(quoting.length).toBeGreaterThanOrEqual(5)
    for (const [id, value] of quoting) {
      expect(value.includes('"'), `${id} carries a straight quotation mark`).toBe(false)
      const opens = (value.match(/“/g) ?? []).length
      const closes = (value.match(/”/g) ?? []).length
      expect(opens, `${id} has unbalanced curly quotes`).toBe(closes)
    }
  })

  it("no sentence carries an exclamation, a severity word, or a raw HTML entity (sketch 215 #5)", () => {
    // `DESCRIBE_REFUSAL`'s rules, inherited whole. The exception list is DECLARED and
    // asserted EMPTY, so a future value that genuinely needs one of these words is a
    // decision rather than a slip.
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
    expect(SEVERITY.test("this step is invalid")).toBe(true)
  })

  it("⚠ NO HEADLINE NAMES A GAUNTLET STAGE (sketch 215 #4)", () => {
    // The stage words live on the spine, below the cause. A headline naming a stage is
    // `BUG-260815-06`'s failure in a new costume, so the four stage strings are asserted
    // absent from every refusal sentence — read OFF the module, never re-typed.
    const stageWords = [
      publishRefusalVocabulary.STAGE_STRUCTURE,
      publishRefusalVocabulary.STAGE_PASSED,
      publishRefusalVocabulary.STAGE_BLOCKED,
      publishRefusalVocabulary.STAGE_NOT_REACHED,
    ]
    const facts = { step: "Tell the team", arg: "subject", upstream: "Draft it" }
    for (const kind of GAP_KINDS) {
      const sentence = (
        REFUSAL_FOR_KIND as Record<string, (f: typeof facts) => string>
      )[kind](facts)
      for (const word of stageWords) {
        expect(sentence.includes(word), `${kind} names the stage "${word}"`).toBe(false)
      }
    }
    // NON-VACUITY: the stage words really are non-empty strings that could have been found.
    expect(stageWords.every((w) => w.length > 0)).toBe(true)
    expect(stageWords).toHaveLength(4)
  })
})

describe("publishRefusalVocabulary — no wire id ever reaches a sentence (T-214-03-02)", () => {
  it("no value names a capability or any id-shaped token", () => {
    // ⚠ Needles ASSEMBLED AT RUNTIME (rule 5) — this file is inside a `?raw`-swept tree.
    const wireIds = [
      "send" + "_email",
      "create" + "_ticket",
      "post" + "_message",
      "external" + "_action",
    ]
    const ID_SHAPED = /\b[a-z0-9]+_[a-z0-9_]+\b/
    for (const [id, value] of ALL_SENTENCES) {
      for (const wire of wireIds) {
        expect(value.includes(wire), `${id} names the wire id ${wire}`).toBe(false)
      }
      expect(value, `${id} carries an id-shaped token`).not.toMatch(ID_SHAPED)
    }
    expect(ID_SHAPED.test("ran " + "post" + "_message")).toBe(true)
    expect(ALL_SENTENCES.length).toBeGreaterThan(15)
  })
})

describe("publishRefusalVocabulary — the module is a TRUE LEAF (rule 4)", () => {
  it("⛔ imports nothing at all — it DECLARES the gap-kind union rather than importing it", () => {
    const ANY_IMPORT = /^\s*import\s/m
    const ANY_FROM = /from\s+["'][^"']+["']/
    const DYNAMIC_IMPORT = /import\s*\(/
    // POSITIVE CONTROLS first — a matcher that cannot match passes vacuously.
    expect('import type { ArgumentGapKind } from "./x"').toMatch(ANY_IMPORT)
    expect('import type { ArgumentGapKind } from "./x"').toMatch(ANY_FROM)
    expect('const m = await import("./x")').toMatch(DYNAMIC_IMPORT)

    // ⚠ NO EXCEPTION FOR THIS MODULE. An earlier draft of the plan allowed it exactly one
    // `import type` for the union; declaring the union here instead keeps the leaf claim at
    // full strength, and this assertion is where that difference is cashed.
    expect(publishRefusalVocabularySource).not.toMatch(ANY_IMPORT)
    expect(publishRefusalVocabularySource).not.toMatch(ANY_FROM)
    expect(publishRefusalVocabularySource).not.toMatch(DYNAMIC_IMPORT)

    // NON-VACUITY, anchored on what the file DOES declare plus a length floor.
    expect(publishRefusalVocabularySource.length).toBeGreaterThan(2000)
    expect(publishRefusalVocabularySource).toMatch(/^export type ArgumentGapKind =/m)
    for (const [id] of FLAT_WORDS) {
      expect(publishRefusalVocabularySource, `${id} is not declared in the source`).toMatch(
        new RegExp(`^export const ${id}\\b`, "m"),
      )
    }
    for (const id of COMPOSED_IDS) {
      expect(publishRefusalVocabularySource, `${id} is not declared in the source`).toMatch(
        new RegExp(`^export const ${id} = \\(`, "m"),
      )
    }
  })

  it("⚠ REFUSAL_FOR_KIND is a Record over the union, not a switch with a default", () => {
    // A `switch` would absorb a sixth kind in silence and render a generic sentence for a
    // failure this phase went to the trouble of distinguishing. Asserted in the SOURCE,
    // because the runtime shape of a map and of a function returning one look alike.
    expect(publishRefusalVocabularySource).toMatch(
      /^export const REFUSAL_FOR_KIND: Record<ArgumentGapKind,/m,
    )
    expect(publishRefusalVocabularySource).toMatch(
      /^export const REFUSAL_NEXT_FOR_KIND: Record<ArgumentGapKind, string>/m,
    )
    // POSITIVE CONTROL — the matcher really matches, and a `switch` spelling would not.
    expect(/Record<ArgumentGapKind,/.test("Record<ArgumentGapKind, string>")).toBe(true)
    expect(/Record<ArgumentGapKind,/.test("switch (kind) { default: return x }")).toBe(false)
  })
})
