/**
 * Phase 192-05 Task 3 (LIB-01 / LIB-03 — D-08 / D-14, threats T-192-04 / T-192-13 /
 * T-192-14) — THE LIBRARY SUBTREE'S NEGATIVE FENCES.
 *
 * Four invariants that no typecheck, no lint run and no rendering test can see:
 *
 *   F1  no `title` attribute anywhere in the subtree — D-14, because TOUCH HAS NO HOVER,
 *       so an explanation parked in a tooltip is an explanation half the users never get.
 *   F4  no module here names a `WorkflowsPage` specifier in ANY import form. An import
 *       back TYPECHECKS CLEAN and LINTS CLEAN and fails only at runtime, as a TDZ
 *       `ReferenceError` in whichever module a caller reached first.
 *   F5  no user-visible string here overstates what the search does (D-08). The field
 *       matches the letters you type; a word implying otherwise is a CORRECTNESS defect
 *       — it is a promise about capability, not a style preference.
 *   TG  `lib/threadGroups.tsx` is byte-unchanged by this phase. 192 IMPORTS
 *       `HighlightTitle` and modifies nothing, which is what makes 158-B's re-open
 *       trigger #3 (*"any phase touches … threadGroups for another reason"*) a mechanical
 *       fact rather than an ambiguity resolved in prose and re-litigated later.
 *
 * ⚠ THE SEVEN PATHS ARE LISTED EXPLICITLY, AND FOUR OF THEM DO NOT EXIST AT THIS COMMIT.
 * THAT IS THE POINT (the `WorkflowCanvas.test.tsx:55-83` idiom). `RunModal.tsx`,
 * `WorkflowDeleteSheet.tsx`, `WorkflowCard.tsx` and `LibraryToolbar.tsx` arrive in later
 * plans of this phase; a fence written AFTER they land would only ever cover what happened
 * to be there, and a bare directory glob covers whatever a future author drops in without
 * ever saying what it stopped covering. An invariance fence says nothing about what it no
 * longer covers, and neither the count gate nor `tsc` can see the loss.
 * `import.meta.glob` expands at build time over files that EXIST, so a listed path with no
 * file simply has no key in the record and contributes the empty string — it never throws.
 *
 * ⚠ F1 IS PARSED, NOT GREPPED, AND THE REASON IS THIS FILE'S OWN NEIGHBOURS.
 * `libraryVocabulary.ts` EXPLAINS the D-14 rule in its docblock, and a raw source grep for
 * the attribute spelling reds on the prose that documents the very rule it enforces — the
 * 187-24 trap in its inverted form. So the detector walks JSX attributes with the
 * TypeScript parser: comments are not nodes, so they are excluded by construction rather
 * than by stripping, and a `//` inside a string cannot fool it. Known limit, stated rather
 * than discovered later: an attribute smuggled in through a spread or through
 * `setAttribute` is invisible to this fence, as it is to the grep it replaces.
 *
 * ⚠ THE F5 TOKENS ARE ASSEMBLED FROM PARTS (`governanceVocabulary.test.ts:41-44`). No
 * forbidden word appears as a contiguous literal anywhere in this file, so a future
 * whole-`frontend/src` grep does not trip on the guard that forbids the word. Test files
 * are outside the sweep by construction here — the explicit path list names seven source
 * modules and nothing else — which is what lets this suite NAME what it forbids.
 *
 * Every fence carries a SYNTHETIC POSITIVE CONTROL: the real detector is run over an
 * in-test source containing the violation, and must catch it. A fence whose matcher is
 * broken passes vacuously and looks exactly like a fence that holds. The separate and
 * heavier obligation — driving each fence RED against a REAL PLANT in production source,
 * with an md5 restore — is 192-12's, over the whole seven-module subtree once it exists.
 */
import { describe, it, expect } from "vitest"
import ts from "typescript"
import threadGroupsSource from "@/lib/threadGroups?raw"

// ── the swept corpus ─────────────────────────────────────────────────────────────────

/** Every module of the library subtree, named now, before four of them exist. */
const LIBRARY_SUBTREE_PATHS = [
  "./libraryRow.ts",
  "./libraryVocabulary.ts",
  "./libraryFilter.ts",
  "./RunModal.tsx",
  "./WorkflowDeleteSheet.tsx",
  "./WorkflowCard.tsx",
  "./LibraryToolbar.tsx",
] as const

/** The house `?raw` / `import.meta.glob` idiom (`PhaseFormPanel.rails.test.tsx:422`). */
const LIBRARY_MODULES = import.meta.glob("./*.{ts,tsx}", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

/** The listed modules that exist right now. The list is the contract; this is its subset. */
const SWEPT: { path: string; source: string }[] = LIBRARY_SUBTREE_PATHS.map((path) => ({
  path,
  source: LIBRARY_MODULES[path] ?? "",
})).filter(({ source }) => source.length > 0)

const subtreeSource = SWEPT.map(({ source }) => source).join("\n")

describe("the sweep is looking at something (non-vacuity)", () => {
  it("names all seven subtree modules, including the four not yet written", () => {
    expect(LIBRARY_SUBTREE_PATHS).toHaveLength(7)
    for (const later of [
      "./RunModal.tsx",
      "./WorkflowDeleteSheet.tsx",
      "./WorkflowCard.tsx",
      "./LibraryToolbar.tsx",
    ]) {
      expect(LIBRARY_SUBTREE_PATHS as readonly string[]).toContain(later)
    }
  })

  it("actually loads the modules that exist, and they are not empty", () => {
    // If a rename or a move silently emptied the glob, every negative below would pass
    // while covering nothing at all.
    expect(SWEPT.length).toBeGreaterThanOrEqual(3)
    expect(SWEPT.map((f) => f.path)).toEqual(
      expect.arrayContaining(["./libraryRow.ts", "./libraryVocabulary.ts", "./libraryFilter.ts"]),
    )
    expect(subtreeSource.length).toBeGreaterThan(1000)
  })

  it("sweeps no test file — the explicit list is what makes this suite able to name what it forbids", () => {
    expect(SWEPT.filter((f) => /\.test\.tsx?$/.test(f.path))).toEqual([])
  })
})

// ── the shared TypeScript-parser scaffolding ─────────────────────────────────────────

const parse = (path: string, source: string) =>
  ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

/**
 * F1's detector — the names of every JSX attribute in a source file. Comments and
 * docblocks are not nodes, so prose ABOUT the forbidden attribute is invisible here.
 */
const jsxAttributeNamesOf = (path: string, source: string): string[] => {
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) found.push(node.name.text)
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(parse(path, source), visit)
  return found
}

/**
 * F5's extractor — every string literal, template chunk and JSX text node
 * (`governanceVocabulary.test.ts:95-118`). Same construction, same reason: the rule is
 * about what a PERSON READS ON SCREEN, and a phase whose deliverable is honest wording
 * must stay free to discuss the forbidden words in its own reasoning.
 */
const userVisibleTextOf = (path: string, source: string): string[] => {
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
  ts.forEachChild(parse(path, source), visit)
  return found
}

const USER_VISIBLE: { path: string; text: string }[] = SWEPT.flatMap(({ path, source }) =>
  userVisibleTextOf(path, source).map((text) => ({ path, text })),
)

/** A synthetic corpus, parsed by the same extractor the real sweep uses. */
const syntheticCorpus = (path: string, source: string) =>
  userVisibleTextOf(path, source).map((text) => ({ path, text }))

// ── F1 — no tooltip explanations (D-14: touch has no hover) ──────────────────────────

const FORBIDDEN_ATTRIBUTE = "title"

describe("F1 — no hover-only explanation anywhere in the library subtree", () => {
  it("POSITIVE CONTROL — the detector catches the attribute on a real JSX element", () => {
    const planted = `export const Row = () => <button ${FORBIDDEN_ATTRIBUTE}="Fork a copy">x</button>\n`
    expect(jsxAttributeNamesOf("./planted.tsx", planted)).toContain(FORBIDDEN_ATTRIBUTE)
  })

  it("SCOPING CONTROL — prose about the rule is NOT caught (parser, not grep)", () => {
    // `libraryVocabulary.ts` really does explain this rule in its docblock. A raw grep
    // would red on the file that documents the fence, which is why F1 is parsed.
    const inProse =
      `/** Ships as real DOM text via aria-describedby — never a ${FORBIDDEN_ATTRIBUTE}=, ` +
      `because touch has no hover. */\nexport const SENTENCE = "Opens a new private copy."\n`
    expect(jsxAttributeNamesOf("./planted.ts", inProse)).toEqual([])
  })

  it("SCOPING CONTROL — a same-named PROPERTY is not a JSX attribute", () => {
    // `HighlightTitle`'s prop is spelled the same and is passed as a prop, not painted as
    // a DOM tooltip. A fence that cannot tell them apart is unusable in this subtree.
    const asAProperty = `export const CFG = { ${FORBIDDEN_ATTRIBUTE}: "not a tooltip" }\n`
    expect(jsxAttributeNamesOf("./planted.ts", asAProperty)).toEqual([])
  })

  it.each(LIBRARY_SUBTREE_PATHS)("%s paints no hover-only explanation", (path) => {
    const source = LIBRARY_MODULES[path] ?? ""
    expect(jsxAttributeNamesOf(path, source)).not.toContain(FORBIDDEN_ATTRIBUTE)
  })
})

// ── F4 — no ESM cycle back to the page ───────────────────────────────────────────────
//
// ⚠ `(\.[jt]sx?)?` IS LOAD-BEARING, and it is here because the canvas fence shipped
// WITHOUT it and was blind in every import form: `frontend/tsconfig.app.json:13-14` sets
// `moduleResolution: "bundler"` WITH `allowImportingTsExtensions: true`, so a suffixed
// specifier compiles, resolves, and builds a real cycle under a green fence.
const IMPORT_FROM_PAGE = /from\s+["'][^"']*WorkflowsPage(\.[jt]sx?)?["']/
const DYNAMIC_IMPORT_PAGE = /import\s*\(\s*["'][^"']*WorkflowsPage(\.[jt]sx?)?["']\s*\)/

describe("F4 — no module under library/ names a WorkflowsPage specifier", () => {
  it("POSITIVE CONTROL — both regexes match every shape they forbid", () => {
    expect('import { WorkflowsPage } from "@/pages/WorkflowsPage"').toMatch(IMPORT_FROM_PAGE)
    expect('import type { WorkflowsPageProps } from "@/pages/WorkflowsPage"').toMatch(
      IMPORT_FROM_PAGE,
    )
    expect('export { UNBOUND } from "../../pages/WorkflowsPage"').toMatch(IMPORT_FROM_PAGE)
    expect('const m = await import("@/pages/WorkflowsPage")').toMatch(DYNAMIC_IMPORT_PAGE)
    // …and the SUFFIXED spelling of each, legal under `allowImportingTsExtensions: true`.
    // One per form: an optional group is only proven by exercising the branch that takes it.
    expect('import { WorkflowsPage } from "@/pages/WorkflowsPage.tsx"').toMatch(IMPORT_FROM_PAGE)
    expect('import type { X } from "./WorkflowsPage.tsx"').toMatch(IMPORT_FROM_PAGE)
    expect('export { UNBOUND } from "@/pages/WorkflowsPage.tsx"').toMatch(IMPORT_FROM_PAGE)
    expect('const m = await import("@/pages/WorkflowsPage.tsx")').toMatch(DYNAMIC_IMPORT_PAGE)
  })

  it("NEGATIVE CONTROL — a `?raw` import of the page is legal and must keep missing", () => {
    // A later plan's suite will read the page's own source to assert the one-direction
    // edge; a fence without this control would flag that legal line.
    for (const legal of [
      'import pageSource from "@/pages/WorkflowsPage?raw"',
      'import pageSource from "@/pages/WorkflowsPage.tsx?raw"',
    ]) {
      expect(legal).not.toMatch(IMPORT_FROM_PAGE)
      expect(legal).not.toMatch(DYNAMIC_IMPORT_PAGE)
    }
  })

  it.each(LIBRARY_SUBTREE_PATHS)("%s imports the page in no form at all", (path) => {
    const source = LIBRARY_MODULES[path] ?? ""
    expect(source).not.toMatch(IMPORT_FROM_PAGE)
    expect(source).not.toMatch(DYNAMIC_IMPORT_PAGE)
  })

  it("the sentinel the page owns was RE-HOMED here rather than imported back", () => {
    // The other half of "no cycle": the subtree needs the value, and it declares it
    // instead of reaching up for it. Without this the negatives above are also satisfied
    // by a subtree that simply does not need the page yet.
    expect(LIBRARY_MODULES["./libraryFilter.ts"] ?? "").toContain('export const UNBOUND = "__unbound__"')
  })
})

// ── F5 — the copy may not overstate what the search does (D-08) ──────────────────────

/** Assemble a searched token so no forbidden word is a contiguous literal in this file. */
const tok = (...parts: string[]): string => parts.join("")

/** D-08's forbidden word class — every one of these claims a capability we do not ship. */
const OVERSTATED_WORDS = [
  tok("sem", "antic"),
  tok("mean", "ing"),
  tok("simi", "lar"),
  tok("AI-", "powered"),
  tok("sma", "rt"),
  tok("underst", "ands"),
  tok("natural ", "language"),
]

const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")

/**
 * Word-anchored and case-insensitive. The anchors are explicit alphanumeric lookarounds
 * rather than `\b`, so the sweep cannot false-positive on a stem — the forbidden words
 * here have live neighbours (`means`, `smarter`) that are perfectly legal copy.
 */
const wordRegExp = (word: string) =>
  new RegExp(`(?<![A-Za-z0-9])${escapeForRegExp(word)}(?![A-Za-z0-9])`, "i")

const wordHits = (corpus: { path: string; text: string }[], word: string) => {
  const re = wordRegExp(word)
  return corpus.filter(({ text }) => re.test(text)).map(({ path }) => path)
}

describe("F5 — no copy in the subtree overstates the search (D-08)", () => {
  it("extracts user-visible text, and there is some", () => {
    expect(USER_VISIBLE.length).toBeGreaterThan(20)
  })

  it.each(OVERSTATED_WORDS)("%s appears 0 times in user-visible strings", (word) => {
    expect(wordHits(USER_VISIBLE, word)).toEqual([])
  })

  it("POSITIVE CONTROL — the detector catches a forbidden word in a string literal", () => {
    const planted = syntheticCorpus(
      "./planted.ts",
      `export const SEARCH_PLACEHOLDER = "Search by ${OVERSTATED_WORDS[1]}…"\n`,
    )
    expect(wordHits(planted, OVERSTATED_WORDS[1])).toEqual(["./planted.ts"])
  })

  it("POSITIVE CONTROL — it catches one in JSX text, where the toolbar's own plant lives", () => {
    const planted = syntheticCorpus(
      "./planted.tsx",
      `export const Hint = () => <p>Finds workflows that are ${OVERSTATED_WORDS[2]}.</p>\n`,
    )
    expect(wordHits(planted, OVERSTATED_WORDS[2])).toEqual(["./planted.tsx"])
  })

  it("SCOPING CONTROL — the same word in a comment is NOT caught (both sides)", () => {
    const inAComment = syntheticCorpus(
      "./planted.ts",
      `/** Why *${OVERSTATED_WORDS[0]}* search is a different engine and its own phase. */\n` +
        `// ${OVERSTATED_WORDS[6]} querying is deferred, deliberately.\n` +
        `export const OK = "Search by name or purpose"\n`,
    )
    expect(wordHits(inAComment, OVERSTATED_WORDS[0])).toEqual([])
    expect(wordHits(inAComment, OVERSTATED_WORDS[6])).toEqual([])
  })

  it("ANCHOR CONTROL — a legal stem does not trip the fence", () => {
    const legal = syntheticCorpus(
      "./planted.ts",
      `export const A = "It matches the letters you type, whatever that means to you."\n` +
        `export const B = "A smarter search is its own phase."\n`,
    )
    expect(wordHits(legal, OVERSTATED_WORDS[1])).toEqual([])
    expect(wordHits(legal, OVERSTATED_WORDS[4])).toEqual([])
  })
})

// ── TG — lib/threadGroups.tsx is byte-unchanged by this phase ────────────────────────

/**
 * ⚠ THE FILE IS `.tsx`, NOT `.ts` as 158-B's re-open trigger #3 spells it — it ships a JSX
 * component (`HighlightTitle`), which its own docblock at `:17-19` explains. The trigger
 * asks whether any phase "touches" it for another reason; 192 IMPORTS it and edits nothing,
 * and this hash is what turns that from a claim into a fact.
 *
 * ⚠ `matchesTitle` (`threadGroups.tsx:74`) is DELIBERATELY NOT REUSED. Its signature is
 * `(t: Thread, q: string)`, and widening it to take a library row WOULD be touching the
 * shared match engine — which is precisely what 158-B's deferral was costed against. The
 * library ships its own `matchesQuery` over its own row type instead; two callers, one
 * engine each, no shared widening.
 *
 * Line endings are normalized before hashing, so the pin means the same thing on a checkout
 * that converts them and on one that does not.
 *
 * ⚠ THE DIGEST IS IN-TEST ARITHMETIC, NOT `node:crypto`, AND THAT IS A MEASUREMENT RATHER
 * THAN A PREFERENCE: `tsconfig.app.json` does not carry the Node type declarations, so
 * `import { createHash } from "node:crypto"` RUNS FINE under vitest and adds a 34th
 * `error TS2307` to a tree whose measured baseline is 33. Pulling `@types/node` into the app
 * project to hash one file would be a build-config change smuggled in by a fence. What this
 * function guarantees is stated plainly instead: it is a CHANGE DETECTOR — two independent
 * 32-bit FNV-1a lanes, pinned alongside the exact character length — and it is not a
 * cryptographic digest. It is not defending against a crafted collision; it is defending
 * against an edit.
 */
const normalizeEol = (source: string) => source.replace(/\r\n/g, "\n")

const digest = (source: string): string => {
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let i = 0; i < source.length; i++) {
    const c = source.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ (c + i), 0x85ebca6b) >>> 0
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0")
}

/** READ OUT of the file at this commit, not computed from anything. */
const THREAD_GROUPS_DIGEST = "4723f9885190e84a"
const THREAD_GROUPS_LENGTH = 7144

describe("TG — 158-B trigger #3, as a fact rather than a reading", () => {
  it("POSITIVE CONTROL — one added byte changes the digest", () => {
    const shifted = digest(normalizeEol(threadGroupsSource) + " ")
    expect(shifted).not.toBe(THREAD_GROUPS_DIGEST)
  })

  it("POSITIVE CONTROL — a one-character EDIT changes it too (not just a longer file)", () => {
    // Length alone is a weak pin: a rename of equal length would slip past it. The digest
    // is what covers a same-length edit, so it is exercised on one.
    const edited = normalizeEol(threadGroupsSource).replace("Unfiled", "unfiled")
    expect(edited.length).toBe(THREAD_GROUPS_LENGTH) // same length, different bytes
    expect(digest(edited)).not.toBe(THREAD_GROUPS_DIGEST)
  })

  it("lib/threadGroups.tsx is byte-identical to its state at the start of this phase", () => {
    const normalized = normalizeEol(threadGroupsSource)
    expect(normalized.length).toBe(THREAD_GROUPS_LENGTH)
    expect(digest(normalized)).toBe(THREAD_GROUPS_DIGEST)
  })

  it("…and the thing 192 imports from it is really there", () => {
    // Byte-identity alone is satisfied by a file nobody uses. This is why the pin matters.
    expect(threadGroupsSource).toContain("export function HighlightTitle(")
    expect(threadGroupsSource).toContain("export function matchesTitle(")
  })
})
