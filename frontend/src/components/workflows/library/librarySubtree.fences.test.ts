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
 *   TG  `lib/threadGroups.tsx` is byte-unchanged by this phase, which is what makes 158-B's
 *       re-open trigger #3 (*"any phase touches … threadGroups for another reason"*) a
 *       mechanical fact rather than an ambiguity resolved in prose and re-litigated later.
 *       ⚠ CORRECTED IN 192-12 — this paragraph used to add *"192 IMPORTS `HighlightTitle`"*.
 *       Measured, that half is FALSE and always was; see the TG section's own ⚠ note below.
 *   OD  the cut has ONE DIRECTION. `WorkflowsPage.tsx` imports every library module it
 *       consumes, DECLARES none of them, and leaves NO RE-EXPORT SHIM. Without the third
 *       clause F4's two negatives are also satisfied by a page that kept the coupling behind
 *       a re-export — the `WorkflowCanvas.test.tsx:756-765` shape, applied here.
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
// ⚠ A `?raw` import of the page is the ONE legal way this subtree may name it, and F4's own
// NEGATIVE CONTROL (`:246-256`) exists so this line does not red the fence beside it.
import pageSource from "@/pages/WorkflowsPage?raw"

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

// ── XSS — the highlight is IMPORTED, never re-implemented (T-192-04) ─────────────────
//
// D-07 highlights the user-authored `business_requirement` — user-controlled text on a
// rendering path. `HighlightTitle` (`threadGroups.tsx:137`) renders each segment as a JSX
// TEXT NODE so React escapes it, and its docblock records that the sketch's `innerHTML`
// highlight was deliberately NOT ported because it is an XSS vector on exactly this text.
// The threat is therefore RE-IMPLEMENTATION, and it has two halves: the TG pin below (the
// shipped control cannot be weakened) and this (a second, unsafe highlight cannot be
// written next door). `WorkflowSoul`'s own rule says the same thing about the same field.
const RAW_HTML = /dangerouslySetInnerHTML/

describe("T-192-04 — no raw-HTML rendering anywhere in the library subtree", () => {
  it("POSITIVE CONTROL — the detector catches the escape hatch", () => {
    expect('<p dangerouslySetInnerHTML={{ __html: marked }} />').toMatch(RAW_HTML)
  })

  it.each(LIBRARY_SUBTREE_PATHS)("%s renders no raw HTML", (path) => {
    expect(LIBRARY_MODULES[path] ?? "").not.toMatch(RAW_HTML)
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
 * asks whether any phase "touches" it for another reason, and the hash below is what turns
 * the answer from a claim into a fact.
 *
 * ⚠ THIS PARAGRAPH USED TO READ *"192 IMPORTS it and edits nothing"*. THE FIRST HALF IS
 * FALSE AND WAS NEVER TRUE — corrected in 192-12 rather than smoothed over, per the house
 * rule that a guard which only passes by making a comment lie is a broken guard
 * (D-ITEM-183-02). MEASURED, twice, at this commit:
 *
 *   · `grep -rn "HighlightTitle" frontend/src` returns ZERO consumers under
 *     `components/workflows/library/`; the three live call sites are all in
 *     `components/layout/`. `192-11-SUMMARY.md` § "THE MEASURED CORRECTION" records the
 *     same fact from the other side, with a positive control.
 *   · `WorkflowCard` renders `row.name` as plain text and takes no `query` prop at all.
 *
 * So D-07's SECOND half — *"with the hit highlighted"* — is NOT SHIPPED. It is DEFERRED
 * rather than owed-as-a-small-wiring-job, and the reason is a STRUCTURAL CONFLICT this plan
 * measured rather than predicted: `HighlightTitle`'s props are `{ title, query }`, so the
 * wiring `192-11` handed forward (`<HighlightTitle title={row.name} query={query} />`)
 * spells a JSX ATTRIBUTE named `title` inside the swept subtree — and F1 above walks JSX
 * attribute NAMES, so it reds on it. Observed, not reasoned: the wiring was planted into
 * `WorkflowCard.tsx` and F1 failed with *"expected [ 'data-testid', 'data-card', …(73) ] to
 * not include 'title'"*, the identical failure the deliberate `title="x"` plant produces.
 * F1's existing SCOPING CONTROL does not cover it — that control is about an object
 * PROPERTY (`{ title: "…" }`), which is a different node kind.
 *
 * ⚠ THE CONFLICT IS REAL AND IT IS NOT F1'S FAULT. F1 is D-14 ("touch has no hover") and it
 * is deliberately blunt; the shipped `HighlightTitle` merely happens to spell its prop with
 * the forbidden word. **Wiring D-07's highlight therefore requires F1 to become
 * element-aware** (a DOM tooltip on an intrinsic element, versus a React prop on a
 * capitalised component) — a change to the very fence this plan exists to prove fires, in
 * the closing plan of the phase, which is exactly the "a closure round may not add a
 * capability" shape G-7 forbids. RE-OPEN TRIGGER, concrete: **the next phase that touches
 * `WorkflowCard.tsx` or the library search** wires the highlight AND narrows F1 to
 * intrinsic elements in the same commit, driving the narrowed F1 RED against a real
 * `<button title="…">` plant so the loosening is proved not to have blinded it. The
 * limitation test in `WorkflowsPage.test.tsx` (*"⚠ MEASURED, NOT ASSUMED"*) is what must be
 * INVERTED when it lands, and its positive control already pins the shipped behaviour any
 * wiring must match: the FIRST match only.
 *
 * ⚠ LIB-01 IS UNAFFECTED. REQUIREMENTS.md's wording is *"search the Workflows page by name
 * and filter the list"* — the highlight belongs to decision D-07, not to the requirement.
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
/**
 * D-07's two consumption shapes — an IMPORT of the component, and a RENDER of it. Prose that
 * merely names it satisfies neither, which is the point (see the case below).
 */
const HIGHLIGHT_IMPORT = /import\s*(?:type\s*)?\{[^}]*\bHighlightTitle\b/
const HIGHLIGHT_ELEMENT = /<HighlightTitle[\s/>]/

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

  it("…and the two exports the pin exists to protect are really there", () => {
    // Byte-identity alone is satisfied by a file nobody uses. This is why the pin matters —
    // and note the claim is about what the file EXPORTS, not about what 192 imports, which
    // is the correction the ⚠ block above records.
    expect(threadGroupsSource).toContain("export function HighlightTitle(")
    expect(threadGroupsSource).toContain("export function matchesTitle(")
  })

  it("POSITIVE CONTROLS — the two highlight detectors catch real consumption", () => {
    expect('import { HighlightTitle } from "@/lib/threadGroups"').toMatch(HIGHLIGHT_IMPORT)
    expect('import { folderLabel, HighlightTitle } from "@/lib/threadGroups"').toMatch(
      HIGHLIGHT_IMPORT,
    )
    expect("<HighlightTitle title={row.name} query={q} />").toMatch(HIGHLIGHT_ELEMENT)
    expect("<HighlightTitle\n  title={row.name}\n/>").toMatch(HIGHLIGHT_ELEMENT)
    // SCOPING CONTROL — the prose form really is not caught, which is the whole reason
    // these two exist instead of a raw substring check.
    const prose = " * renders it: highlighting is `HighlightTitle`'s job (`threadGroups.tsx:137`)"
    expect(prose).not.toMatch(HIGHLIGHT_IMPORT)
    expect(prose).not.toMatch(HIGHLIGHT_ELEMENT)
  })

  it("D-07's highlight is UNSHIPPED, and the F1 conflict that defers it is pinned here", () => {
    // ⚠ Two facts, so a later author inherits a MEASUREMENT instead of re-deriving one.
    //
    // 1. Nothing in this subtree CONSUMES the shipped highlight. Asserted over the swept
    //    corpus rather than over one file, so a highlight wired into ANY library module
    //    fails this line and forces the author to read the ⚠ block above.
    //
    //    ⚠ THE DETECTOR IS IMPORT/ELEMENT-SHAPED, NOT A RAW `toContain`, AND THAT IS
    //    MEASURED RATHER THAN CAUTIOUS: a raw substring check FAILS on this very tree,
    //    because `libraryFilter.ts:182` names the component in PROSE ("highlighting is
    //    `HighlightTitle`'s job"). It was written raw first and observed RED against exactly
    //    that comment — the 187-24 trap, which this file already documents for F1 and F5.
    expect(subtreeSource).not.toMatch(HIGHLIGHT_IMPORT)
    expect(subtreeSource).not.toMatch(HIGHLIGHT_ELEMENT)
    //    NON-VACUITY: the corpus really does mention it in prose, so the two negatives above
    //    are narrower than a substring check rather than merely luckier than one.
    expect(subtreeSource).toContain("HighlightTitle")

    // 2. WHY it is deferred rather than owed as small wiring: the component's prop is
    //    spelled with F1's forbidden word, so the wiring is an F1 violation by
    //    construction. This is what makes the conflict inherent rather than incidental.
    expect(threadGroupsSource).toContain("HighlightTitle({ title, query }")
    expect(FORBIDDEN_ATTRIBUTE).toBe("title")

    // POSITIVE CONTROL — F1's own detector, run over the exact wiring 192-11 handed
    // forward, really does catch it. Without this the paragraph above is an argument; with
    // it, the deferral rests on the same detector the fence ships.
    const wiring = `export const Row = () => <span><HighlightTitle ${FORBIDDEN_ATTRIBUTE}={row.name} query={q} /></span>\n`
    expect(jsxAttributeNamesOf("./planted.tsx", wiring)).toContain(FORBIDDEN_ATTRIBUTE)
  })
})

// ── OD — the cut has ONE DIRECTION, and no shim preserves the old coupling ────────────

/**
 * F4 proves nothing under `library/` reaches UP. This proves the edge EXISTS and points
 * DOWN — the `WorkflowCanvas.test.tsx:756-765` shape. Without it, F4's negatives are also
 * satisfied by a page that declares everything itself and by two modules nobody uses.
 *
 * ⚠ THE SIX IMPORTED PATHS ARE MEASURED, NOT ASSUMED. `grep -n "workflows/library"
 * frontend/src/pages/WorkflowsPage.tsx` at this commit returns exactly six specifiers, and
 * `WorkflowDeleteSheet` is deliberately NOT among them: the page never mounts the Sheet — the
 * CARD does (`WorkflowCard.tsx`, the `deleteSheetRef` black box). Listing it here would
 * assert a coupling that does not exist and would red on the correct architecture.
 */
const PAGE_IMPORTED_MODULES = [
  "RunModal",
  "libraryFilter",
  "libraryRow",
  "LibraryToolbar",
  "WorkflowCard",
  "libraryVocabulary",
] as const

/** The six symbols the page must no longer DECLARE — the three cards, the modal, the two leaves. */
const PAGE_MUST_NOT_DECLARE = [
  "function RunModal(",
  "type DeletePhase",
  "function FilterItem(",
  "function PublishedCard(",
  "function DraftCard(",
  "function StarterCard(",
] as const

/** A re-export shim — the thing that keeps the coupling while every negative stays green. */
const REEXPORT_STAR = /export\s+\*\s+from\s+["'][^"']*library\//
const REEXPORT_NAMED = /export\s+\{[^}]*\}\s+from\s+["'][^"']*library\//

describe("OD — WorkflowsPage imports the subtree, declares none of it, shims nothing", () => {
  it("POSITIVE CONTROLS — every detector below catches what it forbids", () => {
    expect('export * from "@/components/workflows/library/WorkflowCard"').toMatch(REEXPORT_STAR)
    expect('export { RunModal } from "./library/RunModal"').toMatch(REEXPORT_NAMED)
    expect('export { WorkflowCard, type X } from "@/components/workflows/library/WorkflowCard"').toMatch(
      REEXPORT_NAMED,
    )
    // …and a LEGAL local export is not mistaken for a shim, or this fence reds on the
    // page's own `export default WorkflowsPage`.
    expect("export default WorkflowsPage").not.toMatch(REEXPORT_NAMED)
    expect("export function WorkflowsPage({ folders, onLaunch }: WorkflowsPageProps) {").not.toMatch(
      REEXPORT_NAMED,
    )
  })

  it("the page really is the file under test (non-vacuity)", () => {
    // A `?raw` import that silently resolved to an empty string would make every assertion
    // below pass while covering nothing — the failure shape this whole suite exists to stop.
    expect(pageSource.length).toBeGreaterThan(10000)
    expect(pageSource).toContain("export function WorkflowsPage(")
  })

  it.each(PAGE_IMPORTED_MODULES)("imports %s from the library subtree", (moduleName) => {
    // ⚠ `(\.[jt]sx?)?` IS DELIBERATE AND IS F4's OWN IDIOM, ten lines up. Written WITHOUT it
    // first, this line reddened on a `…/RunModal.tsx` specifier — which is LEGAL here
    // (`tsconfig.app.json` sets `allowImportingTsExtensions`) and is still a one-direction
    // edge. A fence that reds on correct code is worse than none: it trains its reader to
    // edit the fence. The regression this actually guards is the module going UNIMPORTED,
    // which is the plant it was driven RED against.
    expect(pageSource).toMatch(
      new RegExp(`from\\s+["']@/components/workflows/library/${moduleName}(\\.[jt]sx?)?["']`),
    )
  })

  it.each(PAGE_MUST_NOT_DECLARE)("no longer declares %s", (declaration) => {
    expect(pageSource).not.toContain(declaration)
  })

  it("leaves NO re-export shim pointing back at library/", () => {
    // The clause that makes the two negatives mean what they say. A shim would let every
    // other assertion in this file stay green while the page remained the subtree's front
    // door — which is the coupling D-01 exists to remove.
    expect(pageSource).not.toMatch(REEXPORT_STAR)
    expect(pageSource).not.toMatch(REEXPORT_NAMED)
  })
})
