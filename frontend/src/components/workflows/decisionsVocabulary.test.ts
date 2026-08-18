/**
 * Phase 197-03 Task 2 (AUTH-02 · D-07 / D-16 / D-20 · threats T-197-09 / T-197-10 / T-197-11) —
 * the decisions copy home's own suite.
 *
 * SIX PROPERTIES, AND EVERY FENCE CARRIES A POSITIVE CONTROL IN THE SAME BLOCK:
 *
 *   1. the row order is DATA, and it is five
 *   2. `decisionRowLabel` is TOTAL over that order, and the five labels are pairwise distinct
 *   3. both fold formatters are TOTAL over hostile numbers, and their two arms really differ
 *   4. the four absence values are distinct from each other and from every other value
 *   5. D-20 — no value claims what the gate does
 *   6. the module is a TRUE LEAF, and it re-declares none of the three page-owned constants
 *
 * ── WHY EVERY NEGATIVE HAS A POSITIVE CONTROL ─────────────────────────────────────────────
 * `/gsd:secure-phase 192.1` found a fence swept against the EMPTY STRING: the property held
 * and NOTHING was guarding it. `import.meta.glob` and `?raw` both contribute the empty string
 * for an absent path in some resolvers rather than throwing, and `"".includes(x)` is false for
 * every x — so a whole fence family can pass green while defending nothing. This project has
 * shipped that twice. So each detector below is also run over a PLANTED source that must be
 * reported, and each absence is anchored on a presence.
 *
 * ── THE SEARCHED TOKENS ARE ASSEMBLED FROM PARTS ──────────────────────────────────────────
 * `governanceVocabulary.test.ts:56-58`, scoping decision 3. No word this file forbids appears
 * as a contiguous literal anywhere in it, so a future whole-`frontend/src` grep does not trip
 * on the guard that forbids the word — and, more immediately, so this file cannot satisfy or
 * break the sweeps it protects.
 *
 * ── COMMENTS ARE STRIPPED BEFORE ANY RAW SOURCE SWEEP ─────────────────────────────────────
 * The shipped helper shape at `SeedReceipt.test.tsx:1091-1105`. A commented-out line must not
 * be able to satisfy a sweep, and a prose mention must not be able to break one. Over-stripping
 * is the SAFE direction: removing a live site turns a fence red and is seen immediately, while
 * leaving a commented one in place is the silent pass this discipline exists to end.
 */
import { describe, it, expect } from "vitest"

import * as decisionsVocabulary from "./decisionsVocabulary"
import {
  DECISION_ROW_ORDER,
  decisionRowLabel,
  groundingFoldSummary,
  decisionsFoldSummary,
  DECISION_KB_NONE,
  DECISION_TEMPLATE_NONE,
  DECISION_REQUIREMENT_NONE,
  DECISION_NAME_NONE,
  type DecisionRowKey,
} from "./decisionsVocabulary"
import decisionsVocabularySource from "./decisionsVocabulary?raw"

// ── helpers ───────────────────────────────────────────────────────────────────────────────

/** Assemble a searched token so no forbidden word is a contiguous literal in this file. */
const tok = (...parts: string[]): string => parts.join("")

/**
 * Source with COMMENTS REMOVED. Block comments go entirely; a line is cut at the first `//`
 * that begins the line or follows whitespace, which leaves regex literals (whose `//` follows
 * a backslash) and `://` intact. `SeedReceipt.test.tsx:1091-1105`.
 */
function withoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => {
      const m = /(^|\s)\/\//.exec(line)
      return m ? line.slice(0, m.index) : line
    })
    .join("\n")
}

const CODE_ONLY = withoutComments(decisionsVocabularySource)

/** The three exported FUNCTIONS, named rather than discovered — see the totality guard below. */
const FUNCTION_EXPORTS = ["decisionRowLabel", "groundingFoldSummary", "decisionsFoldSummary"]

/** Every plain string value the module exports. */
const STRING_EXPORTS: { id: string; text: string }[] = Object.entries(decisionsVocabulary)
  .filter(([, value]) => typeof value === "string")
  .map(([id, value]) => ({ id, text: value as string }))

/**
 * Every sentence this module can put in front of a person: the plain string exports, the five
 * row labels, and both fold formatters driven over a real range. The formatters are called
 * rather than skipped, because a fence over `typeof === "string"` alone would sweep NONE of the
 * three values that interpolate a count — which is most of the module's risk.
 */
const ALL_COPY: { id: string; text: string }[] = [
  ...STRING_EXPORTS,
  ...DECISION_ROW_ORDER.map((key) => ({ id: `decisionRowLabel(${key})`, text: decisionRowLabel(key) })),
  ...[0, 1, 2, 7].flatMap((n) => [
    { id: `groundingFoldSummary(${n})`, text: groundingFoldSummary(n) },
    { id: `decisionsFoldSummary(${n})`, text: decisionsFoldSummary(n) },
  ]),
]

// ── 1. the row order is DATA, and it is five (D-07) ───────────────────────────────────────

describe("DECISION_ROW_ORDER — D-07's 'always five, always the same order', as data", () => {
  it("is the declared tuple, in the declared sequence", () => {
    expect([...DECISION_ROW_ORDER]).toEqual([
      "knowledge-base",
      "template",
      "requirement",
      "name",
      "deliverable",
    ])
  })

  it("is exactly five, and no key repeats", () => {
    expect(DECISION_ROW_ORDER).toHaveLength(5)
    expect(new Set(DECISION_ROW_ORDER).size).toBe(5)
  })

  it("is declared in the source as a tuple, not assembled at runtime", () => {
    // NON-VACUITY for the raw sweeps further down, taken here where it is cheapest: a `?raw`
    // import that resolved to nothing yields the empty string, and every negative below would
    // then be about nothing at all.
    expect(decisionsVocabularySource.length).toBeGreaterThan(1000)
    expect(CODE_ONLY).toMatch(/^export const DECISION_ROW_ORDER = \[/m)
    expect(CODE_ONLY).toMatch(/as const satisfies readonly DecisionRowKey\[\]/)
  })
})

// ── 2. `decisionRowLabel` is total, and the labels are pairwise distinct ──────────────────

describe("decisionRowLabel — total over the declared order, and no two rows read alike", () => {
  it("yields a non-empty trimmed label for every key in the order", () => {
    for (const key of DECISION_ROW_ORDER) {
      const label = decisionRowLabel(key)
      expect(label, `${key} has no label`).not.toBe("")
      expect(label, `${key}'s label is not trimmed`).toBe(label.trim())
    }
  })

  it("the five labels are PAIRWISE DISTINCT — the FOOTING_UNAVAILABLE 'must not merge' rule", () => {
    // Two rows sharing a label is two rows nobody can tell apart, on a card whose whole
    // subject is that each decision has exactly one answer.
    const labels = DECISION_ROW_ORDER.map((key) => decisionRowLabel(key))
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("carries the never-binding, so a 6th row is a TYPECHECK error not a blank row", () => {
    expect(CODE_ONLY).toMatch(/const _never: never = key/)
    // POSITIVE CONTROL — the guard is not merely present, it RESOLVES at runtime rather than
    // throwing, which is the property `seedReceiptStepReason`'s own default arm ships.
    const unmodelled = "audit-trail" as unknown as DecisionRowKey
    expect(decisionRowLabel(unmodelled)).toBe("")
  })
})

// ── 3. the count formatters are total, and both arms are exercised ───────────────────────

describe("the fold summaries are total over hostile numbers (the wholeCount guard)", () => {
  // A copy formatter on this surface is handed numbers derived from author-supplied JSONB.
  const NON_POSITIVE = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 0]

  it("every non-positive or non-finite input yields the empty string, on BOTH lines", () => {
    for (const input of NON_POSITIVE) {
      expect(groundingFoldSummary(input), `grounding(${input})`).toBe("")
      expect(decisionsFoldSummary(input), `decisions(${input})`).toBe("")
    }
    // Explicitly, because zero is the arm the card's one-conditional-line shape depends on.
    expect(groundingFoldSummary(0)).toBe("")
    expect(decisionsFoldSummary(0)).toBe("")
  })

  it("1 and 2 yield DISTINCT non-empty strings — the singular arm is exercised, not assumed", () => {
    for (const fn of [groundingFoldSummary, decisionsFoldSummary]) {
      expect(fn(1)).not.toBe("")
      expect(fn(2)).not.toBe("")
      expect(fn(1)).not.toBe(fn(2))
      expect(fn(1)).toBe(fn(1).trim())
      expect(fn(2)).toBe(fn(2).trim())
    }
  })

  it("a fractional count is truncated rather than rendered — 1.5 reads as the 1 arm", () => {
    expect(groundingFoldSummary(1.5)).toBe(groundingFoldSummary(1))
    expect(decisionsFoldSummary(1.5)).toBe(decisionsFoldSummary(1))
    // POSITIVE CONTROL — the output really CHANGES with its argument, so a formatter that
    // ignored its count could not pass the case above by accident.
    expect(decisionsFoldSummary(7)).toContain("7")
    expect(groundingFoldSummary(7)).toContain("7")
  })

  it("the two lines never collide at the same count", () => {
    for (const n of [1, 2, 7]) {
      expect(groundingFoldSummary(n)).not.toBe(decisionsFoldSummary(n))
    }
  })
})

// ── 4. the absence values are distinct, and none of them is a duplicate ──────────────────

describe("the four absence values state an absence, and each states its own", () => {
  const ABSENCES = [
    DECISION_KB_NONE,
    DECISION_TEMPLATE_NONE,
    DECISION_REQUIREMENT_NONE,
    DECISION_NAME_NONE,
  ]

  it("each is non-empty and trimmed", () => {
    for (const value of ABSENCES) {
      expect(value).not.toBe("")
      expect(value).toBe(value.trim())
    }
  })

  it("they are pairwise distinct, and none duplicates any OTHER value in the module", () => {
    expect(new Set(ABSENCES).size).toBe(4)
    // The stronger claim: no exported string in the whole module is a duplicate of another.
    // Two ids with one value is a row that cannot say which decision it is about.
    const texts = STRING_EXPORTS.map((e) => e.text)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it("POSITIVE CONTROL — the duplicate detector really fires on a planted duplicate", () => {
    const planted = [...STRING_EXPORTS.map((e) => e.text), DECISION_KB_NONE]
    expect(new Set(planted).size).not.toBe(planted.length)
  })
})

// ── 5. D-20 — no value claims what the gate does (T-197-09) ──────────────────────────────

describe("D-20 — nothing this module says makes a claim about the gate", () => {
  /**
   * The searched token, assembled from parts (scoping decision 3). Research enumerated every
   * gauntlet stage from source: `business_requirement_missing` (`grounding.py:1007`) is the
   * ONLY definition-level predicate, so a knowledge-base row, a template row, a name row or a
   * deliverable row referencing the gate would be a false claim about what it does. Row 3's
   * verdict is the SERVER's sentence and travels on the D-13 payload (D-12) — it is not
   * authored in this repository, so a total ban here is exactly right.
   */
  const GATE_CLAIM = tok("pub", "lish")

  /** The detector, run over the real corpus below and over a plant in the next case. */
  const claimsIn = (corpus: { id: string; text: string }[]) =>
    corpus.filter(({ text }) => text.toLowerCase().includes(GATE_CLAIM)).map(({ id }) => id)

  it("the swept corpus is real and covers the formatters as well as the constants", () => {
    // NON-VACUITY BEFORE THE NEGATIVE. A sweep over an empty list reports nothing and looks
    // exactly like a fence that holds.
    expect(STRING_EXPORTS.length).toBeGreaterThanOrEqual(12)
    expect(ALL_COPY.length).toBeGreaterThanOrEqual(20)
    for (const { id, text } of ALL_COPY) {
      expect(typeof text, `${id} is not a string`).toBe("string")
    }
    // …and the derived half really is derived: the five labels and both formatters' output are
    // in the corpus, not just the plain constants.
    expect(ALL_COPY.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        "decisionRowLabel(knowledge-base)",
        "decisionRowLabel(deliverable)",
        "groundingFoldSummary(7)",
        "decisionsFoldSummary(7)",
      ]),
    )
  })

  it("no value anywhere in the module contains the gate-claim token", () => {
    expect(claimsIn(ALL_COPY)).toEqual([])
  })

  it("POSITIVE CONTROL — the same detector reports a planted claim", () => {
    // The half that makes the case above mean something. Without it the fence proves only
    // that the detector was never exercised.
    const plant = [
      { id: "planted", text: `Bind a folder before ${GATE_CLAIM}ing this workflow.` },
      { id: "planted-cased", text: `Required to ${GATE_CLAIM.toUpperCase()}.` },
    ]
    expect(claimsIn(plant)).toEqual(["planted", "planted-cased"])
    // …and it does not fire on the real corpus merely because the corpus is empty.
    expect(claimsIn([...ALL_COPY, ...plant])).toEqual(["planted", "planted-cased"])
  })

  it("every exported function is one this suite actually drives (totality, not deny-list)", () => {
    // THE PROPERTY, NOT THE WORDING — the Phase-185 lesson that a deny-list cannot be made
    // fail-closed by extension. A FOURTH exported function would carry copy that `ALL_COPY`
    // never calls and the D-20 sweep would silently stop being total. This makes that a red
    // test rather than a quiet hole.
    const fns = Object.entries(decisionsVocabulary)
      .filter(([, value]) => typeof value === "function")
      .map(([id]) => id)
    expect(fns.sort()).toEqual([...FUNCTION_EXPORTS].sort())
  })
})

// ── 6. the module is a TRUE LEAF, and re-declares no page-owned constant (T-197-10) ──────

describe("decisionsVocabulary — the module is a TRUE LEAF", () => {
  it("imports nothing at all — not a component, not React, not a type", () => {
    const ANY_IMPORT = /^\s*import\s/m
    const ANY_FROM = /from\s+["'][^"']+["']/
    const DYNAMIC_IMPORT = /import\s*\(/

    // POSITIVE CONTROLS FIRST — a matcher that cannot match passes vacuously and looks exactly
    // like a fence that holds (`doorVocabulary.test.ts:531-535`).
    expect('import type { DecisionRowKey } from "./x"').toMatch(ANY_IMPORT)
    expect('import type { DecisionRowKey } from "./x"').toMatch(ANY_FROM)
    expect('const m = await import("./x")').toMatch(DYNAMIC_IMPORT)

    expect(decisionsVocabularySource).not.toMatch(ANY_IMPORT)
    expect(decisionsVocabularySource).not.toMatch(ANY_FROM)
    expect(decisionsVocabularySource).not.toMatch(DYNAMIC_IMPORT)
  })

  it("POSITIVE CONTROL — the loaded source really is this module", () => {
    // ⚠ NON-VACUITY FOR A ZERO-IMPORT LEAF CANNOT BE A POSITIVE IMPORT. Anchored instead on
    // what the file DOES declare: every id the namespace reports is really declared in the
    // source that was loaded, which ties the runtime table and the raw text together.
    expect(decisionsVocabularySource).toMatch(/export const /)
    for (const { id } of STRING_EXPORTS) {
      expect(CODE_ONLY, `${id} is not declared in the loaded source`).toMatch(
        new RegExp(`^export const ${id}\\b`, "m"),
      )
    }
    for (const id of FUNCTION_EXPORTS) {
      expect(CODE_ONLY, `${id} is not declared in the loaded source`).toMatch(
        new RegExp(`^export function ${id}\\b`, "m"),
      )
    }
  })

  it("re-declares NONE of the three page-owned constants (the two-spellings failure)", () => {
    // `builderStore.ts:147` — *two spellings of a locked string is how a locked string stops
    // being locked*. These three live on `WorkflowBuilderPage.tsx` and this plan DECLINES to
    // move them: a vocabulary module importing from a PAGE inverts the dependency direction
    // the whole `components/workflows` tree depends on, and this module is a leaf. Declining
    // to move them and re-declaring them here would be the worst of both.
    // Needles from parts, so this file cannot satisfy the sweep it performs.
    const PAGE_OWNED = [
      tok("REQUIREMENT_", "INVITATION"),
      tok("REQUIREMENT_AI_MARK_", "LABEL"),
      tok("REQUIREMENT_AI_MARK_", "EXPLANATION"),
    ]
    const declaresIn = (source: string) =>
      PAGE_OWNED.filter((id) =>
        new RegExp(`(?:export\\s+)?const\\s+${id}\\b`).test(source),
      )
    expect(declaresIn(CODE_ONLY)).toEqual([])
  })

  it("POSITIVE CONTROL — the declaration detector fires on a planted declaration", () => {
    const PAGE_OWNED = [
      tok("REQUIREMENT_", "INVITATION"),
      tok("REQUIREMENT_AI_MARK_", "LABEL"),
      tok("REQUIREMENT_AI_MARK_", "EXPLANATION"),
    ]
    const declaresIn = (source: string) =>
      PAGE_OWNED.filter((id) =>
        new RegExp(`(?:export\\s+)?const\\s+${id}\\b`).test(source),
      )
    const planted = [
      `export const ${PAGE_OWNED[0]} = "x"`,
      `const ${PAGE_OWNED[1]} = "y"`,
      `export const ${PAGE_OWNED[2]} = "z"`,
    ].join("\n")
    expect(declaresIn(planted)).toEqual(PAGE_OWNED)
    // …and the comment stripper is real: a declaration living only in prose is NOT reported.
    expect(declaresIn(withoutComments(`// export const ${PAGE_OWNED[0]} = "x"`))).toEqual([])
  })

  it("POSITIVE CONTROL — the comment stripper removes prose and keeps code", () => {
    const sample = ['/* export const GONE = "a" */', 'export const KEPT = "b" // trailing'].join("\n")
    const stripped = withoutComments(sample)
    expect(stripped).not.toMatch(/GONE/)
    expect(stripped).toMatch(/export const KEPT/)
    expect(stripped).not.toMatch(/trailing/)
  })
})
