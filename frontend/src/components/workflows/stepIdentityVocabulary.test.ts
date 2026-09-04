/**
 * Phase 214-03 Task 3 — THE STEP-IDENTITY VOCABULARY'S OWN SUITE.
 *
 * The five rules are `doorVocabulary.test.ts:1-55`'s, inherited whole: whole-table
 * properties never row assertions; exact match never containment; the literal lives in the
 * TEST exactly once so the assertion FALSIFIES the table rather than copying it; the
 * generated contract is RE-PARSED at test time so the sketch is bound to the build; and the
 * leaf claim is asserted, not documented.
 *
 * ── ⭐ WHAT THIS SUITE CARRIES THAT ITS SIBLINGS DO NOT ────────────────────────────────
 *
 * `FAILED_REASON_UNKNOWN` is a COPY OF A SHIPPED SENTENCE — the sentinel
 * `PhaseCard.classifyFailure` already renders on its `reason_unknown` arm. A case below
 * reads `PhaseCard.tsx` through `?raw` and asserts the two are CHARACTER-IDENTICAL, so the
 * copy cannot drift from its source while plan `214-11` narrows the sentinel's CONDITION.
 * ⚠ Its condition narrows; its words never change (D-214-18) — the sentinel is an honesty
 * mechanism, and firing it when the reason is known trains readers to distrust it.
 *
 * And the measured tautology of sketch 216 §3 is asserted CLOSED at the vocabulary layer:
 * the new sentences quote nothing, name a SERVICE distinct from the ACTION, and the
 * service-unresolvable shape is the action ALONE — never the words "Unknown service".
 *
 * ⚠ RESIDUAL (same as its siblings): the contract is read from `.planning/sketches/`, which
 * `/gsd:complete-milestone` archives. Re-open trigger: the first milestone close that
 * archives `.planning/sketches/216-the-mark-and-the-action-everywhere/`. The fix is an
 * in-package copy, never a weakened case.
 */
import { describe, expect, it } from "vitest"

import * as stepIdentityVocabulary from "./stepIdentityVocabulary"
import stepIdentityVocabularySource from "./stepIdentityVocabulary?raw"
// ⭐ THE SHIPPED SENTINEL'S OWN SOURCE, read through the same `?raw` loader
// `ExternalActionSection.test.tsx:59` uses for a backend `.py`. ⚠ The obvious `node:fs`
// spelling is wrong here: `tsconfig.app.json` sets `types: ["vite/client"]` and nothing
// else, so a `node:*` import would add NEW errors to the tsc baseline this phase measures.
import phaseCardSource from "../panel/PhaseCard.tsx?raw"
import buildContractSource from "../../../../.planning/sketches/216-the-mark-and-the-action-everywhere/BUILD-CONTRACT.generated.md?raw"

/** Every FLAT (string-valued) export, DERIVED from the module rather than hand-listed. */
const FLAT_WORDS = Object.entries(stepIdentityVocabulary).filter(
  ([, value]) => typeof value === "string",
) as [string, string][]

/** Every COMPOSED (function-valued) export, derived the same way. */
const COMPOSED_IDS = Object.entries(stepIdentityVocabulary)
  .filter(([, value]) => typeof value === "function")
  .map(([id]) => id)
  .sort()

const FLAT_ID_COUNT = 8
const COMPOSED_ID_COUNT = 5

/** ⚠ SKETCH 216 §1's FLAT TABLE, spelled as literals exactly once (rule 3). */
const FLAT_COLUMN: Record<string, string> = {
  FAILED_REASON_LABEL: "Why it stopped",
  FAILED_REASON_UNKNOWN:
    "Failure reason not captured by the backend — surfaced explicitly so the run is never shown as an empty success.",
  ASK_PAUSED: "Paused — waiting for you.",
  ASK_NOTHING_SENT: "Nothing has been sent yet.",
  ASK_WILL_SEND: "What it will send",
  ASK_APPROVE: "Send it",
  ASK_DECLINE: "Do not run it",
  ASK_NOT_RECORDED: "Shown here only. The record keeps what ran, not what it said.",
}

/** ⚠ SKETCH 216 §1's COMPOSED TABLE. Each entry binds the contract's `«…»` placeholder
 *  tokens to the module's NAMED parameters and calls the real function — so an ACTION and a
 *  SERVICE trading places reds here, which is precisely the inverted sentence §3 exists to
 *  stop. A positional signature could not have been checked this way at all. */
const COMPOSED_SHAPES: Record<string, { shape: string; render: () => string }> = {
  STEP_IDENTITY: {
    shape: "«action» · «service»",
    render: () =>
      stepIdentityVocabulary.STEP_IDENTITY({ action: "«action»", service: "«service»" }),
  },
  STEP_IDENTITY_SERVICE_UNKNOWN: {
    shape: "«action»",
    render: () => stepIdentityVocabulary.STEP_IDENTITY_SERVICE_UNKNOWN({ action: "«action»" }),
  },
  ASK_WILL_RUN: {
    shape: "It will run «action» through «service».",
    render: () =>
      stepIdentityVocabulary.ASK_WILL_RUN({ action: "«action»", service: "«service»" }),
  },
  RECEIPT_SENT: {
    shape: "Ran «action» through «service».",
    render: () =>
      stepIdentityVocabulary.RECEIPT_SENT({ action: "«action»", service: "«service»" }),
  },
  RECEIPT_REFUSED: {
    shape: "Did not run «action» through «service».",
    render: () =>
      stepIdentityVocabulary.RECEIPT_REFUSED({ action: "«action»", service: "«service»" }),
  },
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

/** Parse sketch 216 §1's two tables. Rows are `| \`ID\` | "value" |`; a COMPOSED row's id
 *  cell carries a `(…)` suffix inside the backticks. §2's and §3's wider tables cannot
 *  match — the value cell is required to contain no pipe. */
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

describe("stepIdentityVocabulary — the table itself (rule 1)", () => {
  it(`owns exactly ${FLAT_ID_COUNT} flat ids and ${COMPOSED_ID_COUNT} composed, and nothing else`, () => {
    expect(FLAT_WORDS).toHaveLength(FLAT_ID_COUNT)
    expect(COMPOSED_IDS).toHaveLength(COMPOSED_ID_COUNT)
    expect(FLAT_WORDS.length + COMPOSED_IDS.length).toBe(
      Object.keys(stepIdentityVocabulary).length,
    )
    // NON-VACUITY: the derivation really read the module rather than an empty namespace.
    expect(FLAT_WORDS.map(([id]) => id).includes("FAILED_REASON_UNKNOWN")).toBe(true)
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

describe("stepIdentityVocabulary — every word is EXACTLY its governed literal (rules 2/3)", () => {
  for (const id of Object.keys(FLAT_COLUMN)) {
    it(`${id} is byte-exactly its governed literal`, () => {
      expect((stepIdentityVocabulary as unknown as Record<string, string>)[id]).toBe(
        FLAT_COLUMN[id],
      )
    })
  }

  for (const [id, spec] of Object.entries(COMPOSED_SHAPES)) {
    it(`${id} composes byte-exactly its governed shape`, () => {
      expect(spec.render()).toBe(spec.shape)
    })
  }
})

describe("⭐ stepIdentityVocabulary — the SENTINEL is the shipped sentence, not a re-typing", () => {
  it("FAILED_REASON_UNKNOWN is CHARACTER-IDENTICAL to PhaseCard's reason_unknown arm", () => {
    // NON-VACUITY FIRST — a `?raw` import of a moved or renamed module yields the EMPTY
    // STRING in some resolvers rather than throwing, and the extraction below would then be
    // about nothing at all (the 192.1 E-2 lesson).
    expect(phaseCardSource.length).toBeGreaterThan(5000)
    expect(phaseCardSource).toMatch(/function classifyFailure\(/)
    expect(phaseCardSource).toMatch(/kind: "reason_unknown"/)

    const shipped = /"(Failure reason not captured[^"]*)"/.exec(phaseCardSource)
    expect(shipped, "the shipped sentinel sentence was not found in PhaseCard.tsx").not.toBeNull()
    expect(stepIdentityVocabulary.FAILED_REASON_UNKNOWN).toBe(shipped?.[1])
    // …and against this suite's own literal too, so the three agree rather than two of them
    // drifting together away from the contract.
    expect(shipped?.[1]).toBe(FLAT_COLUMN.FAILED_REASON_UNKNOWN)
  })

  it("⚠ the sentinel appears in PhaseCard EXACTLY ONCE — no second spelling to drift", () => {
    // Plan `214-11` narrows this sentinel's CONDITION. A second copy in the same file would
    // let the narrowing reach one arm and not the other, which is the failure the whole
    // vocabulary habit exists to prevent.
    const hits = phaseCardSource.match(/Failure reason not captured/g) ?? []
    expect(hits).toHaveLength(1)
  })
})

describe("stepIdentityVocabulary — the generated contract IS the acceptance bar (rule 3)", () => {
  it("sketch 216 §1, re-parsed from BUILD-CONTRACT.generated.md, equals FLAT_COLUMN", () => {
    expect(buildContractSource.length).toBeGreaterThan(2000)
    expect(buildContractSource).toMatch(/^# BUILD CONTRACT — sketch 216/m)
    expect(buildContractSource).toMatch(/GENERATED by `node drive\.cjs --emit`/)

    const parsed = parseSketchTable(buildContractSource)
    expect(Object.keys(parsed.flat)).toHaveLength(FLAT_ID_COUNT)
    expect(parsed.flat).toEqual(FLAT_COLUMN)
  })

  it("sketch 216 §1's COMPOSED table, re-parsed, equals the shapes this suite asserts", () => {
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
      "| shape | today | after |",
    ].join("\n")
    expect(parseSketchTable(fixture)).toEqual({
      flat: { DEMO_FLAT: "flat words" },
      composed: { DEMO_COMPOSED: "composed «x»" },
    })
  })
})

describe("⭐ stepIdentityVocabulary — the measured tautology is CLOSED (sketch 216 §3)", () => {
  it("the identity names an ACTION and a SERVICE that are DIFFERENT things", () => {
    // The shipped defect put `config.capability` in BOTH slots. Driving the composer with
    // two distinct names and asserting both survive is what makes that impossible here.
    const said = stepIdentityVocabulary.ASK_WILL_RUN({
      action: "Post a message",
      service: "Aether Slack",
    })
    expect(said).toBe("It will run Post a message through Aether Slack.")
    expect(said.includes("Post a message")).toBe(true)
    expect(said.includes("Aether Slack")).toBe(true)
  })

  it("⚠ an UNRESOLVABLE service yields the ACTION ALONE — never the words Unknown service", () => {
    // Sketch 216 §3's third row, and D-214-14's rule: never draw a name the system cannot
    // know. The honest shape has its own id so a caller can be SEEN choosing it.
    const said = stepIdentityVocabulary.STEP_IDENTITY_SERVICE_UNKNOWN({ action: "Post a message" })
    expect(said).toBe("Post a message")
    expect(said.toLowerCase().includes("unknown")).toBe(false)
    expect(said.includes("·")).toBe(false)
    // POSITIVE CONTROL — the two-name shape DOES carry the separator, so the absence above
    // is the unresolvable arm and not a broken composer.
    expect(
      stepIdentityVocabulary.STEP_IDENTITY({ action: "Post a message", service: "Aether Slack" }),
    ).toBe("Post a message · Aether Slack")
  })

  it("⚠ NO SENTENCE QUOTES A NAME — the shipped tautology's straight quotes are gone", () => {
    // Before: `It will run "post_message" through post_message.` The quotes were the tell
    // that a wire id was being read back at a person; nothing here quotes anything.
    for (const [id, value] of ALL_SENTENCES) {
      expect(value.includes('"'), `${id} carries a straight quotation mark`).toBe(false)
      expect(value.includes("“"), `${id} quotes a name`).toBe(false)
    }
    expect(ALL_SENTENCES.length).toBeGreaterThan(12)
  })

  it("the two receipts are opposites, and neither reads as an error", () => {
    // ⚠ Declining is a CORRECT outcome of an approval gate. A receipt that reads like a
    // failure teaches people not to use the gate.
    const sent = stepIdentityVocabulary.RECEIPT_SENT({ action: "Post a message", service: "Slack" })
    const refused = stepIdentityVocabulary.RECEIPT_REFUSED({
      action: "Post a message",
      service: "Slack",
    })
    expect(sent).toBe("Ran Post a message through Slack.")
    expect(refused).toBe("Did not run Post a message through Slack.")
    expect(refused.toLowerCase().includes("cancel")).toBe(false)
    expect(refused.toLowerCase().includes("fail")).toBe(false)
  })
})

describe("stepIdentityVocabulary — the characters, asserted by codepoint", () => {
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

  it("the identity separator is the HOUSE MIDDLE DOT (U+00B7), never a bullet (sketch 216 #5)", () => {
    const seen: string[] = []
    for (const [id, value] of ALL_SENTENCES) {
      for (const cp of separatorDots(value)) {
        expect(cp, `${id} uses a separator dot that is not a middle dot`).toBe(MIDDLE_DOT)
        seen.push(id)
      }
    }
    // NON-VACUITY: the identity really does separate with a middle dot.
    expect(seen).toEqual(["STEP_IDENTITY"])
    expect(separatorDots("a • b")).toEqual([0x2022])
    expect(separatorDots("a . b")).toEqual([0x002e])
  })

  it("no sentence carries an exclamation, a severity word, or a raw HTML entity", () => {
    // ⚠ THE DECLARED EXCEPTION LIST IS EMPTY, AND THAT IS A MEASUREMENT RATHER THAN A HOPE.
    // `FAILED_REASON_UNKNOWN` opens with the word *Failure*, which is a NOUN naming what
    // happened — the matcher is word-bounded on `failed`, so the sentinel passes without an
    // exception. If a future value genuinely needs one of these words it becomes a decision
    // recorded here rather than a slip.
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
    // POSITIVE CONTROL — the matcher really matches, and really respects the word boundary
    // that lets the sentinel through.
    expect(SEVERITY.test("the step failed")).toBe(true)
    expect(SEVERITY.test(stepIdentityVocabulary.FAILED_REASON_UNKNOWN)).toBe(false)
  })
})

describe("stepIdentityVocabulary — no wire id ever reaches a run surface (T-214-03-02)", () => {
  it("no value names a capability or any id-shaped token", () => {
    // ⚠ Needles ASSEMBLED AT RUNTIME (rule 5) — this file is inside a `?raw`-swept tree.
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
    expect(ID_SHAPED.test("ran " + "post" + "_message")).toBe(true)
    expect(ALL_SENTENCES.length).toBeGreaterThan(12)
  })
})

describe("stepIdentityVocabulary — the module is a TRUE LEAF (rule 4)", () => {
  it("imports nothing at all — not a component, not React, not a type", () => {
    const ANY_IMPORT = /^\s*import\s/m
    const ANY_FROM = /from\s+["'][^"']+["']/
    const DYNAMIC_IMPORT = /import\s*\(/
    // POSITIVE CONTROLS first — a matcher that cannot match passes vacuously.
    expect('import type { Phase } from "@/types"').toMatch(ANY_IMPORT)
    expect('import type { Phase } from "@/types"').toMatch(ANY_FROM)
    expect('const m = await import("./x")').toMatch(DYNAMIC_IMPORT)

    expect(stepIdentityVocabularySource).not.toMatch(ANY_IMPORT)
    expect(stepIdentityVocabularySource).not.toMatch(ANY_FROM)
    expect(stepIdentityVocabularySource).not.toMatch(DYNAMIC_IMPORT)

    // NON-VACUITY, anchored on what the file DOES declare plus a length floor.
    expect(stepIdentityVocabularySource.length).toBeGreaterThan(2000)
    expect(stepIdentityVocabularySource).toMatch(/export const /)
    for (const [id] of FLAT_WORDS) {
      expect(stepIdentityVocabularySource, `${id} is not declared in the source`).toMatch(
        new RegExp(`^export const ${id}\\b`, "m"),
      )
    }
    for (const id of COMPOSED_IDS) {
      expect(stepIdentityVocabularySource, `${id} is not declared in the source`).toMatch(
        new RegExp(`^export const ${id} = \\(`, "m"),
      )
    }
  })
})
