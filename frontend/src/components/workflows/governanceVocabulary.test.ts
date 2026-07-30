/**
 * Phase 185-11 Task 1 — the graded-governance vocabulary sweep, as a TEST.
 *
 * SPEC criteria 14 and 15 are cross-cutting: they can only be checked once every wave has
 * landed, and a grep run once by hand and quoted in a SUMMARY rots the moment the next
 * phase edits a string. This file is that grep, made falsifiable and permanent.
 *
 * WHAT IT GUARDS (`references/graded-governance.md` §VOCABULARY — binding):
 *
 *   Say:   Must prove it (on the canvas, at rest) · Free to think · Nothing to prove here
 *   Never: Proven · Ungoverned · Unchecked · Not applicable · N/A
 *   `traceable` is legitimate ONLY at the review moment, where a coverage check has
 *   actually run — that is Phase 188, not this tree.
 *
 * Plus SPEC Req 6's three retired badge strings (deleted with the three-face grounding
 * derivation in plan 185-08 — the symbol names are deliberately not spelled here, because
 * this phase's own fence 4 greps `frontend/src` for them and a docblock that names what it
 * forbids is a false positive, the D-ITEM-183-02 trap that cost 185-09 and 185-10 six),
 * and the D-185-02 overclaim guard: the deliverable path's stronger wording is computable
 * only over a structured leaf set, so it must never be transplanted onto a detected agent
 * step.
 *
 * ── THREE SCOPING DECISIONS, EACH DELIBERATE ────────────────────────────────────────────
 *
 * 1. TEST FILES ARE EXCLUDED FROM THE SWEEP. A test that asserts a banned string is absent
 *    must be allowed to NAME it — otherwise this very file is its own first offender, and
 *    every future suite that asserts on the retired copy becomes unwritable.
 *
 * 2. THE MATCH IS SCOPED TO STRING LITERALS AND JSX TEXT, NEVER TO COMMENTS OR DOCBLOCKS.
 *    The rule Req 7 states is about what a PERSON READS ON SCREEN. A phase whose deliverable
 *    is honest wording is allowed to DISCUSS the banned words in its own reasoning — and it
 *    does: `definitionOps.ts`'s governance docblock spells out why *Traceable* is deferred to
 *    the review moment, and `WorkflowBuilderPage.tsx`'s header docblock records that one-shot
 *    emission is proven by spike-097. Both are correct prose about engineering facts and
 *    neither is copy. A file-wide grep flags both; that is the D-ITEM-183-02 trap that cost
 *    plans 185-09 and 185-10 three false positives each. The scoping is done with the
 *    TypeScript parser rather than a comment-stripping regex, so a `//` inside a string
 *    literal cannot fool it — the same tokenize-not-grep discipline plan 185-03 used for its
 *    backend source guard.
 *
 * 3. THE SEARCHED TOKENS ARE ASSEMBLED FROM PARTS. No banned word appears as a contiguous
 *    literal anywhere in this file, so a whole-`frontend/src` grep by a future phase does not
 *    trip on the guard that forbids the word. (Decision 1 already protects this file from its
 *    OWN sweep; this protects it from everybody else's.)
 *
 * ── FALSIFICATION ───────────────────────────────────────────────────────────────────────
 *
 * Every assertion family below carries a POSITIVE CONTROL that runs the real detector over a
 * synthetic source and proves it can go red, plus a non-vacuity guard on the swept file count
 * so an empty or mis-rooted glob cannot pass silently.
 */
import { describe, it, expect } from "vitest"
import ts from "typescript"

import {
  GOVERNANCE_GATE_ROW_LABEL,
  GOVERNANCE_SEAL_LABEL,
  GROUNDING_DIAL_LOOSE_LABEL,
  GROUNDING_DIAL_STRICT_LABEL,
  GROUNDING_NOTHING_TO_PROVE,
} from "./definitionOps"

// ── the swept corpus ──────────────────────────────────────────────────────────────────────

/** The house `?raw` / `import.meta.glob` idiom (`PhaseFormPanel.rails.test.tsx:422`). */
const WORKFLOW_MODULES = import.meta.glob("./*.{ts,tsx}", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

/** The Builder page is the workflow tree's other user-visible surface. */
const PAGE_MODULES = import.meta.glob("../../pages/WorkflowBuilderPage.tsx", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

/** Scoping decision 1 — a suite asserting a banned string is absent must be able to name it. */
const isTestFile = (path: string) => /\.test\.tsx?$/.test(path)

const SWEPT: { path: string; source: string }[] = Object.entries({
  ...WORKFLOW_MODULES,
  ...PAGE_MODULES,
})
  .filter(([path]) => !isTestFile(path))
  .map(([path, source]) => ({ path, source }))

// ── scoping decision 2 — user-visible text, extracted with the TypeScript parser ──────────

/**
 * Every string literal, template chunk and JSX text node in a source file. Comments and
 * docblocks are not nodes, so they are absent by construction rather than by stripping.
 */
const userVisibleTextOf = (path: string, source: string): string[] => {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      found.push(node.text)
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(sourceFile, visit)
  return found
}

/** Every user-visible string in the swept tree, tagged with the file it came from. */
const USER_VISIBLE: { path: string; text: string }[] = SWEPT.flatMap(({ path, source }) =>
  userVisibleTextOf(path, source).map((text) => ({ path, text })),
)

// ── scoping decision 3 — tokens assembled from parts ──────────────────────────────────────

/** Assemble a searched token so no banned word is a contiguous literal in this file. */
const tok = (...parts: string[]): string => parts.join("")

/** SPEC Req 6 — the three badge strings deleted with the word badge in plan 185-08. */
const RETIRED_BADGE_STRINGS = [
  tok("Must cite its ", "sources"),
  tok("Flags un", "cited claims"),
  tok("No sources ", "needed"),
]

/** SPEC Req 7 — the five never-say words, plus the review-moment-only word. */
const BANNED_WORDS = [
  tok("Prov", "en"),
  tok("Ungov", "erned"),
  tok("Unch", "ecked"),
  tok("Not ", "applicable"),
  tok("N", "/A"),
  tok("trace", "able"),
]

/** D-185-02 — emit-path copy that must never be transplanted onto a detected agent step. */
const OVERCLAIM_PHRASES = [
  tok("every value ", "trace", "able"),
  tok("everything it says ", "is checked"),
]

// ── detectors ─────────────────────────────────────────────────────────────────────────────

const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")

/**
 * Word-anchored and case-insensitive.
 *
 * The anchors are explicit alphanumeric lookarounds rather than `\b`, so the sweep cannot
 * false-positive on a stem: `Must prove it` does not contain the banned past participle, and
 * `min/avg` does not contain the banned clerical abbreviation. Case-insensitive because a
 * mid-sentence lowercase use is exactly as banned as a capitalised one — the rule is about
 * the WORD, not its position in a sentence.
 */
const wordRegExp = (word: string) =>
  new RegExp(`(?<![A-Za-z0-9])${escapeForRegExp(word)}(?![A-Za-z0-9])`, "i")

/** Substring match — the retired badge strings and the overclaims are whole phrases. */
const phraseHits = (corpus: { path: string; text: string }[], phrase: string) =>
  corpus.filter(({ text }) => text.includes(phrase)).map(({ path }) => path)

const wordHits = (corpus: { path: string; text: string }[], word: string) => {
  const re = wordRegExp(word)
  return corpus.filter(({ text }) => re.test(text)).map(({ path }) => path)
}

/** A synthetic corpus, parsed by the same extractor the real sweep uses. */
const syntheticCorpus = (path: string, source: string) =>
  userVisibleTextOf(path, source).map((text) => ({ path, text }))

// ── the sweep is real ─────────────────────────────────────────────────────────────────────

describe("the vocabulary sweep is looking at something (non-vacuity)", () => {
  it("sweeps more than 10 non-test modules", () => {
    expect(SWEPT.length).toBeGreaterThan(10)
  })

  it("reaches both roots — the workflows tree and the Builder page", () => {
    expect(SWEPT.map((f) => f.path)).toEqual(
      expect.arrayContaining(["./definitionOps.ts", "../../pages/WorkflowBuilderPage.tsx"]),
    )
  })

  it("excludes test files, so a suite may name the strings it forbids", () => {
    expect(SWEPT.filter((f) => isTestFile(f.path))).toEqual([])
  })

  it("extracts user-visible text, and there is a lot of it", () => {
    expect(USER_VISIBLE.length).toBeGreaterThan(100)
  })
})

// ── criterion 14 — the three retired badge strings ────────────────────────────────────────

describe("criterion 14 — SPEC Req 6's retired badge strings are gone", () => {
  it.each(RETIRED_BADGE_STRINGS)("%s appears 0 times in the workflow tree", (phrase) => {
    expect(phraseHits(USER_VISIBLE, phrase)).toEqual([])
  })

  it("POSITIVE CONTROL — the detector catches a retired badge string in a string literal", () => {
    const planted = syntheticCorpus(
      "./planted.ts",
      `export const BADGE = ${JSON.stringify(RETIRED_BADGE_STRINGS[0])}\n`,
    )
    expect(phraseHits(planted, RETIRED_BADGE_STRINGS[0])).toEqual(["./planted.ts"])
  })
})

// ── criterion 15, banned half ─────────────────────────────────────────────────────────────

describe("criterion 15 (banned half) — the never-say words are absent from user-visible copy", () => {
  it.each(BANNED_WORDS)("%s appears 0 times in user-visible strings", (word) => {
    expect(wordHits(USER_VISIBLE, word)).toEqual([])
  })

  it("POSITIVE CONTROL — the detector catches a banned word in a string literal", () => {
    const planted = syntheticCorpus(
      "./planted.ts",
      `export const LABEL = "This step is ${BANNED_WORDS[0].toLowerCase()}"\n`,
    )
    expect(wordHits(planted, BANNED_WORDS[0])).toEqual(["./planted.ts"])
  })

  it("POSITIVE CONTROL — the detector catches a banned word in JSX text", () => {
    const planted = syntheticCorpus(
      "./planted.tsx",
      `export const Row = () => <span>${BANNED_WORDS[1]}</span>\n`,
    )
    expect(wordHits(planted, BANNED_WORDS[1])).toEqual(["./planted.tsx"])
  })

  it("SCOPING CONTROL — the same word in a comment is NOT caught (decision 2, both sides)", () => {
    const inAComment = syntheticCorpus(
      "./planted.ts",
      `/** Why *${BANNED_WORDS[0]}* is banned: nothing is until a run's gate passes. */\n` +
        `// ${BANNED_WORDS[1]} is the other reading we refuse.\n` +
        `export const OK = "Must prove it"\n`,
    )
    expect(wordHits(inAComment, BANNED_WORDS[0])).toEqual([])
    expect(wordHits(inAComment, BANNED_WORDS[1])).toEqual([])
  })

  it("SCOPING CONTROL — a `//` inside a string is text, not a comment (parser, not regex)", () => {
    const trap = syntheticCorpus(
      "./planted.ts",
      `export const HREF = "https://example.test/${BANNED_WORDS[0].toLowerCase()}"\n`,
    )
    expect(wordHits(trap, BANNED_WORDS[0])).toEqual(["./planted.ts"])
  })

  it("ANCHOR CONTROL — the required strict phrase does not trip the banned past participle", () => {
    const shipped = syntheticCorpus(
      "./planted.ts",
      `export const A = ${JSON.stringify(GROUNDING_DIAL_STRICT_LABEL)}\n` +
        `export const B = ${JSON.stringify(GROUNDING_NOTHING_TO_PROVE)}\n` +
        `export const C = "it proves it, and it has proved it"\n`,
    )
    expect(wordHits(shipped, BANNED_WORDS[0])).toEqual([])
  })

  it("ANCHOR CONTROL — an identifier-shaped string does not trip anything", () => {
    const identifiers = syntheticCorpus(
      "./planted.ts",
      `export const KEYS = ["waitsForYou", "min/avg", "unCheckedIn", "provenance"]\n`,
    )
    for (const word of BANNED_WORDS) expect(wordHits(identifiers, word)).toEqual([])
  })
})

// ── criterion 15, required half ───────────────────────────────────────────────────────────

/**
 * The three binding phrases, searched for as the VALUE of the exported constant that owns
 * them rather than as a literal retyped here — so the sweep cannot drift from the copy it
 * guards. The drift lock below is what stops that from being circular: it pins each constant
 * to the binding phrase, so rewording the constant reds this file rather than silently
 * moving the goalposts.
 */
const REQUIRED = {
  strict: "Must prove it",
  loose: "Free to think",
  nothing: "Nothing to prove here",
} as const

describe("criterion 15 (required half) — the binding phrases are present and pinned", () => {
  it("DRIFT LOCK — each binding phrase still lives in its named exported constant", () => {
    expect(GOVERNANCE_SEAL_LABEL).toBe(REQUIRED.strict)
    expect(GROUNDING_DIAL_STRICT_LABEL.endsWith(REQUIRED.strict)).toBe(true)
    expect(GOVERNANCE_GATE_ROW_LABEL.startsWith(REQUIRED.strict)).toBe(true)
    expect(GROUNDING_DIAL_LOOSE_LABEL.endsWith(REQUIRED.loose)).toBe(true)
    expect(GROUNDING_NOTHING_TO_PROVE).toBe(REQUIRED.nothing)
  })

  it.each([
    ["the strict side of the dial", GROUNDING_DIAL_STRICT_LABEL],
    ["the canvas seal's label", GOVERNANCE_SEAL_LABEL],
    ["the loose side of the dial", GROUNDING_DIAL_LOOSE_LABEL],
    ["the no-claim reading", GROUNDING_NOTHING_TO_PROVE],
  ])("%s appears at least once in the swept tree", (_name, value) => {
    expect(phraseHits(USER_VISIBLE, value).length).toBeGreaterThan(0)
  })

  it("POSITIVE CONTROL — the presence check fails on a tree that lost the copy", () => {
    const stripped = syntheticCorpus(
      "./planted.ts",
      // Deliberately carries ONLY the loose side — the strict side and the no-claim
      // reading are missing, which is precisely what the presence check must catch.
      `export const DIAL = ${JSON.stringify(GROUNDING_DIAL_LOOSE_LABEL)}\n`,
    )
    expect(phraseHits(stripped, GOVERNANCE_SEAL_LABEL)).toEqual([])
    expect(phraseHits(stripped, GROUNDING_NOTHING_TO_PROVE)).toEqual([])
    expect(phraseHits(stripped, GROUNDING_DIAL_LOOSE_LABEL).length).toBeGreaterThan(0)
  })
})

// ── D-185-02 — the overclaim guard ────────────────────────────────────────────────────────

describe("D-185-02 — emit-path copy is never transplanted onto a detected agent step", () => {
  it.each(OVERCLAIM_PHRASES)("%s appears 0 times in the workflow tree", (phrase) => {
    expect(phraseHits(USER_VISIBLE, phrase)).toEqual([])
  })

  it("POSITIVE CONTROL — the detector catches an overclaim in a string literal", () => {
    const planted = syntheticCorpus(
      "./planted.ts",
      `export const GATE = "This step makes ${OVERCLAIM_PHRASES[0]}."\n`,
    )
    expect(phraseHits(planted, OVERCLAIM_PHRASES[0])).toEqual(["./planted.ts"])
  })

  it("the shipped attached-gate sentence claims retrieved-and-pointed-at, not coverage", () => {
    for (const phrase of OVERCLAIM_PHRASES) {
      expect(phraseHits(USER_VISIBLE, phrase)).toEqual([])
    }
  })
})
