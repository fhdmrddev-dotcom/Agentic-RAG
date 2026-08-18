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
 * ⚠ 192.1-03 (D-33): THE LIST HAS GROWN AND WILL GROW AGAIN — read its length from the array,
 * not from this paragraph. The seven above were Phase 192's; the G-5 fork extraction adds its
 * own, and the identity pair follows. The rule that survives every one of those additions is
 * the one stated at `LIBRARY_SUBTREE_PATHS` itself: **a module joins the list in the same
 * commit that creates it**, because an unlisted module is swept by nothing at all.
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

/**
 * Every module of the library subtree, named now, before some of them exist.
 *
 * ⚠ 192.1-03 (D-33) — THE LIST IS WIDENED IN THE SAME COMMIT THAT ADDS A MODULE, and that is
 * a decision rather than a habit. The corpus is an EXPLICIT LIST, not a glob, so a module
 * absent from it is swept by NOTHING — F1, T-192-04, F4 and F5 all silently skip it while
 * every one of them stays green. That is the *"a guardrail cannot see what is absent from its
 * list"* lesson `CLAUDE.md` records for `WorkflowsPage.tsx` and G-5, reproduced one layer
 * down. The `toHaveLength` below is what makes forgetting impossible: adding a path reds it
 * immediately, so the two edits cannot separate.
 */
const LIBRARY_SUBTREE_PATHS = [
  "./libraryRow.ts",
  "./libraryVocabulary.ts",
  "./libraryFilter.ts",
  "./RunModal.tsx",
  "./WorkflowDeleteSheet.tsx",
  "./WorkflowCard.tsx",
  "./LibraryToolbar.tsx",
  // ── 192.1-03 (D-01 / D-33): the G-5 fork extraction — its pure leaves, then the hook ──
  "./libraryFork.ts",
  "./useWorkflowFork.ts",
  // ── 192.1-04 (D-14 / D-18 / D-33): the identity line's clock ──
  // ⚠ ITS FIXTURE IS NOT HERE, AND THE OMISSION IS DELIBERATE RATHER THAN FORGOTTEN.
  // `__fixtures__/libraryScale.ts` is a SUBDIRECTORY module, and the glob at `:96` is
  // `./*.{ts,tsx}` — NON-RECURSIVE — so it has no key in `LIBRARY_MODULES` and listing it
  // would contribute the empty string forever, i.e. a path that looks swept and is not.
  // Test-only, ships to no user, renders nothing: outside this sweep by construction.
  "./relativeChanged.ts",
  // ── 192.1-05 (D-13 / D-31 / D-33): the identity resolver ──
  "./rowIdentity.ts",
  // ── 192.1-07 (D-19 / D-20 / D-33 / D-36): 162-B's name prompt at the fork ──
  // ⚠ THE FIFTH AND LAST SOURCE MODULE D-35 FORECAST, and it is listed in the same commit
  // that creates it for the reason stated above: F1 in particular is load-bearing HERE, and
  // for a measured reason rather than a general one — the natural shell to clone
  // (`org/InviteMemberDialog.tsx`) carries the forbidden attribute TWICE, so an unswept
  // dialog module is the one place in this subtree where the violation arrives by copying
  // rather than by invention (D-36).
  "./ForkNameDialog.tsx",
  // ── 192.2-02 (LIB-06 / D-05): the G-5 discharge on `WorkflowCard.tsx` — its face leaf ──
  // ⚠ LISTED IN THE COMMIT THAT CREATES IT, and the plan's `files_modified` did NOT name this
  // file. Adding a module without listing it leaves it swept by NOTHING while every fence stays
  // green — the *"a guardrail cannot see what is absent from its list"* failure this array's own
  // docblock records. That is a correctness requirement, not a scope question.
  "./cardFace.ts",
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
  it("names every subtree module, including the ones written after this fence", () => {
    // ⚠ THE LITERAL IS READ OUT OF THIS ASSERTION'S OWN FAILING DIFF, never predicted.
    // 192.1-03 added `./libraryFork.ts` and observed `expected […] to have a length of 7 but
    // got 8` before writing the 8 — which is the whole point of the pin: the two edits cannot
    // separate, so a module can never be added without entering the corpus.
    // ⚠ AND THE ARITHMETIC IN THE PLANNING DOCUMENTS IS NOT THE SOURCE. `192.1-RESEARCH.md`
    // §7a says this list ends at 10 and `192.1-CONTEXT.md` D-35 corrects it to 12; both are
    // forecasts of a plan decision. The number here is the array's measured length.
    // ⚠ 192.1-04 read it the same way, one round later: `expected […] to have a length of 9
    // but got 10` was OBSERVED before the 10 was written. Three `it.each` sweeps × one new
    // path = +3 cases, which is the arithmetic the count-gate pin records.
    // ⚠ 192.1-05 read it the same way, one round later again: `expected […] to have a length of
    // 10 but got 11` was OBSERVED before the 11 was written. The +3 arithmetic held for the
    // FOURTH consecutive addition — but note it changes with THIS commit, which adds two more
    // `it.each(LIBRARY_SUBTREE_PATHS)` sweeps: a fifth module will now move the pin by FIVE.
    // ⚠ 192.1-07 read it the same way, one round later again — `expected [ './libraryRow.ts',
    // …(11) ] to have a length of 11 but got 12` was OBSERVED before the 12 was written — and
    // the FIVE forecast one line up HELD: the gate printed `librarySubtree.fences.test.ts
    // 111 116 +5`. That is the corpus at 12 and the suite at 116, which is also D-35's
    // forecast landing (12 modules) with its own suite arithmetic superseded, exactly as
    // D-35 said to expect: *"re-derive the final number from the gate's own `actual` column"*.
    // ⚠ 192.2-02 read it the same way, one phase later again: `expected [ './libraryRow.ts',
    // …(12) ] to have a length of 12 but got 13` was OBSERVED before the 13 was written, and the
    // FIVE forecast three paragraphs up held — five `it.each(LIBRARY_SUBTREE_PATHS)` sweeps ×
    // one new module (`./cardFace.ts`, the G-5 discharge's face leaf) = +5 cases.
    expect(LIBRARY_SUBTREE_PATHS).toHaveLength(13)
    for (const later of [
      "./RunModal.tsx",
      "./WorkflowDeleteSheet.tsx",
      "./WorkflowCard.tsx",
      "./LibraryToolbar.tsx",
      "./libraryFork.ts",
      "./useWorkflowFork.ts",
      "./relativeChanged.ts",
      "./rowIdentity.ts",
    ]) {
      expect(LIBRARY_SUBTREE_PATHS as readonly string[]).toContain(later)
    }
  })

  it("loads EVERY listed module, and none of them is empty", () => {
    // If a rename or a move silently emptied the glob, every negative below would pass
    // while covering nothing at all.
    //
    // ⚠ THIS WAS `>= 3` PLUS THREE HAND-NAMED MODULES UNTIL E-2 (`192.1-SECURITY.md`), WHICH
    // LEFT NINE OF TWELVE WITH NO PROOF THEY LOAD AT ALL. `SWEPT` DROPS an unresolved path
    // (`:123`), and every `it.each(LIBRARY_SUBTREE_PATHS)` sweep below reads
    // `LIBRARY_MODULES[path] ?? ""` — so a module renamed, moved into a subdirectory or given a
    // new extension was swept against the EMPTY STRING and passed green, one sweep at a time,
    // silently. That is the Phase-190 CR-01 shape exactly: a fence that cannot fire. The audit
    // measured the properties still holding at HEAD by independent grep, so nothing was broken
    // — only undefended.
    //
    // Exact equality subsumes BOTH retired assertions and makes the corpus prove itself: every
    // listed path resolved, none resolved to `""`, and the order still matches the list. It
    // also pins the D-35 omission at `:94-98` from the other side — list the fixture, a
    // subdirectory module the non-recursive glob cannot see, and THIS reds rather than quietly
    // sweeping a permanent empty string.
    expect(SWEPT.map((f) => f.path)).toEqual([...LIBRARY_SUBTREE_PATHS])
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

// ── F6 — no module parses the draft's opaque field as a date (D-16) ──────────────────

/**
 * ⚠ THE OBVIOUS SHORTCUT IS THE DEFECT, WHICH IS WHY THIS IS A FENCE AND NOT ADVICE.
 *
 * A draft row already carries a field that LOOKS like a timestamp and needs no backend change,
 * because the server renders it and `updated_at` from ONE column
 * (`db/workflows.py:93-95` — `to_char(updated_at AT TIME ZONE 'UTC', …)`). Reading it would work
 * in a fixture and fail in life three ways: it is opaque BY CONTRACT (`api.ts:3334-3345`),
 * Postgres keeps microseconds where a JS `Date` keeps milliseconds — so a parsed-and-re-rendered
 * value matches ZERO rows and every later save refuses as stale (probed live 2026-08-01) — and it
 * exists only on drafts, so two of the three feeds would silently render nothing.
 *
 * ⚠⚠ A RAW REGEX FOR THIS REDS ON A CLEAN TREE, AND 192.1-05 MEASURED IT RATHER THAN INHERITING
 * THE WARNING. The needle appears **24 times across 4 swept modules** at this commit
 * (`grep -o … | wc -l`), and — unlike the F1 case this file already documents twice
 * (`:186-193`, `:497-506`) — **not all of them are prose**:
 * `useWorkflowFork.ts:125, :254, :308` READ AND WRITE the field in real code,
 * legitimately, because threading it verbatim is exactly what 186-07 requires. So a
 * comment-stripping regex would fail too. The detector therefore keys on the SHAPE, not the word:
 * a `new Date(…)` or `Date.parse(…)` **whose argument names that field**. Comments are not AST
 * nodes, so prose is excluded by construction, and a legal read that never reaches a date
 * constructor is untouched.
 *
 * Known limit, stated rather than discovered later: a value laundered through an intermediate
 * variable (`const t = row.token; new Date(t)`) is invisible here, as it would be to any grep.
 * The fence catches the shortcut an executor actually takes, which is the direct one.
 */
const OPAQUE_FIELD = tok("to", "ken")

interface OpaqueDateScan {
  /** How many `new Date(…)` / `Date.parse(…)` sites the walker actually visited. */
  dateSites: number
  /** The offending expressions, as source text. */
  violations: string[]
}

const dateArgumentsOf = (node: ts.Node): readonly ts.Expression[] | null => {
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Date") {
    return node.arguments ? Array.from(node.arguments) : []
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "Date" &&
    node.expression.name.text === "parse"
  ) {
    return Array.from(node.arguments)
  }
  return null
}

const namesOpaqueField = (node: ts.Node): boolean => {
  let found = false
  const walk = (inner: ts.Node): void => {
    if (ts.isIdentifier(inner) && inner.text === OPAQUE_FIELD) found = true
    else if (ts.isStringLiteralLike(inner) && inner.text === OPAQUE_FIELD) found = true
    ts.forEachChild(inner, walk)
  }
  walk(node)
  return found
}

const opaqueFieldAsDate = (path: string, source: string): OpaqueDateScan => {
  const scan: OpaqueDateScan = { dateSites: 0, violations: [] }
  const file = parse(path, source)
  const visit = (node: ts.Node): void => {
    const args = dateArgumentsOf(node)
    if (args) {
      scan.dateSites += 1
      if (args.some(namesOpaqueField)) scan.violations.push(source.slice(node.pos, node.end).trim())
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(file, visit)
  return scan
}

describe("F6 — the draft's opaque field is never read as a timestamp (D-16)", () => {
  it("POSITIVE CONTROL — the detector catches every shape the shortcut takes", () => {
    const shapes = [
      `const t = Date.parse(${OPAQUE_FIELD})`,
      `const d = new Date(row.source.${OPAQUE_FIELD})`,
      `const e = new Date(draft.${OPAQUE_FIELD}).getTime()`,
      `const f = +new Date(t.${OPAQUE_FIELD})`,
      `const g = new Date(row["${OPAQUE_FIELD}"])`,
    ]
    for (const shape of shapes) {
      expect(opaqueFieldAsDate("./planted.ts", `${shape}\n`).violations).toHaveLength(1)
    }
  })

  it("SCOPING CONTROL — the 24 existing mentions are NOT caught, prose OR code", () => {
    // ⚠ MEASURED AT THIS COMMIT, not assumed: four swept modules name the field, and one of them
    // does so in real, correct code. This control is what proves the fence is narrower than the
    // grep it replaces — and it runs over the REAL sources, never a synthetic stand-in.
    // ⚠ The list below was itself CORRECTED BY A FAILING ASSERTION: it was written with five
    // entries (`libraryVocabulary.ts` among them, carried over from F7's measurement one screen
    // down) and the diff said `[…(3)] to deeply equal […(4)]`. Two adjacent measurements are not
    // one measurement.
    const mentions = SWEPT.filter(({ source }) => source.includes(OPAQUE_FIELD))
    expect(mentions.map((m) => m.path).sort()).toEqual([
      "./WorkflowCard.tsx",
      "./libraryFilter.ts",
      "./libraryRow.ts",
      "./useWorkflowFork.ts",
    ])
    // …and the module that really READS it in code is the one 186-07 requires to.
    expect(LIBRARY_MODULES["./useWorkflowFork.ts"] ?? "").toContain(`${OPAQUE_FIELD}: created.${OPAQUE_FIELD}`)
    for (const { path, source } of mentions) {
      expect(opaqueFieldAsDate(path, source).violations).toEqual([])
    }
  })

  it("NON-VACUITY — the subtree DOES format time, and the walker DOES see date sites", () => {
    // Without this, "no module parses that field as a date" would be satisfied by a subtree that
    // does nothing with time at all — the F4 re-homed-sentinel shape (`:311-316`), applied here.
    const clock = LIBRARY_MODULES["./relativeChanged.ts"] ?? ""
    expect(clock).toContain("export function relativeChanged")
    const scan = opaqueFieldAsDate("./relativeChanged.ts", clock)
    expect(scan.dateSites).toBeGreaterThan(0) // it really parses a timestamp…
    expect(scan.violations).toEqual([]) // …just never THAT one
  })

  it.each(LIBRARY_SUBTREE_PATHS)("%s reads no date out of the opaque field", (path) => {
    expect(opaqueFieldAsDate(path, LIBRARY_MODULES[path] ?? "").violations).toEqual([])
  })
})

// ── F7 — no owner display name anywhere in the subtree (D-09) ────────────────────────

/**
 * D-09, verbatim: *"The owner segment is `Yours` / `Shared` and stops there … **no owner display
 * name anywhere in the subtree**, and that is a fence, not a preference."*
 *
 * The wire carries `is_mine` (a boolean) and a creator UUID that is never serialized, so a
 * person's name would need a users join nobody asked for. The failure this guards is not a typo:
 * it is a future author reaching for a name that is not in the payload, and rendering something
 * the data cannot support — which on a SHARED library is also an information-disclosure step
 * (T-192.1-12) taken without anyone deciding to take it.
 *
 * ⚠ AND THIS ONE ALSO REDS RAW, WHICH IS WHY IT IS PARSED. The creator column is named **six
 * times** in the swept corpus at this commit — `libraryFilter.ts:94`, `libraryRow.ts:90`,
 * `libraryVocabulary.ts:260`, `useWorkflowFork.ts:129, :171, :281` — every one of them PROSE
 * explaining why the feed is already scoped, or why the name is not rendered. A raw grep reds on
 * the paragraph that documents the rule. Second instance in this one commit; the sixth in the
 * repository.
 *
 * The forbidden identifiers are ASSEMBLED (F5's `tok` trick, `:322`) so no contiguous literal of
 * a forbidden name appears in this file either.
 */
const OWNER_NAME_FIELDS = [
  tok("created", "_by"),
  tok("owner", "_name"),
  tok("user", "_name"),
  tok("display", "_name"),
  tok("full", "_name"),
  tok("createdBy", ""),
  tok("owner", "Name"),
]

/** Every identifier and string literal in CODE. Comments are not nodes, so prose is excluded. */
const codeNamesOf = (path: string, source: string): string[] => {
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) found.push(node.text)
    else if (ts.isStringLiteralLike(node)) found.push(node.text)
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(parse(path, source), visit)
  return found
}

const ownerNameHits = (path: string, source: string): string[] => {
  const names = codeNamesOf(path, source)
  return OWNER_NAME_FIELDS.filter((field) =>
    names.some((name) => name === field || wordRegExp(field).test(name)),
  )
}

describe("F7 — the subtree names no owner, only `Yours` and `Shared` (D-09)", () => {
  it("POSITIVE CONTROL — the detector catches a read of each forbidden field", () => {
    for (const field of OWNER_NAME_FIELDS) {
      const planted = `export const who = (row: Row) => row.${field}\n`
      expect(ownerNameHits("./planted.ts", planted)).toContain(field)
      // …and through an element access, which a property-name-only walk would miss.
      const indexed = `export const who = (row: Row) => row["${field}"]\n`
      expect(ownerNameHits("./planted.ts", indexed)).toContain(field)
    }
  })

  it("SCOPING CONTROL — the six existing PROSE mentions are not caught", () => {
    const mentions = SWEPT.filter(({ source }) => OWNER_NAME_FIELDS.some((f) => source.includes(f)))
    // MEASURED at this commit — four modules discuss the creator column in their docblocks.
    expect(mentions.map((m) => m.path).sort()).toEqual([
      "./libraryFilter.ts",
      "./libraryRow.ts",
      "./libraryVocabulary.ts",
      "./useWorkflowFork.ts",
    ])
    for (const { path, source } of mentions) expect(ownerNameHits(path, source)).toEqual([])
  })

  it("NON-VACUITY — the subtree DOES render ownership, in exactly two words", () => {
    // Otherwise "no owner name" is satisfied by a subtree that says nothing about ownership at
    // all, which is a different (and wrong) surface.
    const vocabulary = LIBRARY_MODULES["./libraryVocabulary.ts"] ?? ""
    const strings = userVisibleTextOf("./libraryVocabulary.ts", vocabulary)
    expect(strings).toContain("Yours")
    expect(strings).toContain("Shared")
    // And the extractor the fence uses really does see identifiers in this file.
    expect(codeNamesOf("./libraryVocabulary.ts", vocabulary)).toContain("OWN_SHARED")
  })

  it.each(LIBRARY_SUBTREE_PATHS)("%s reads no owner display name", (path) => {
    expect(ownerNameHits(path, LIBRARY_MODULES[path] ?? "")).toEqual([])
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
  // ── 192.1-03 (D-01 / G-5): the fork extraction's downward edge ──
  "useWorkflowFork",
  // ⚠ `libraryFork` IS DELIBERATELY NOT LISTED, for the same reason `WorkflowDeleteSheet` is
  // not, and the ⚠ block above states that reason in general terms. Measured here: after the
  // cut the page has NO remaining use of `freshHash` or `isForkConflict` — both are consumed
  // only by the two handlers, which left with them — so the page does not import the module
  // at all. Listing it would assert a coupling that must not exist, and `noUnusedLocals` makes
  // manufacturing one a TYPE ERROR rather than merely untidy. The pure leaves are reached
  // THROUGH the hook, which is the correct shape of a two-layer cut.
  // ⚠ THIS CORRECTS `192.1-03-PLAN.md` Task 3(a), which says to add both names.
  // ── 192.1-07 (D-19): 162-B's name prompt is MOUNTED by the page, so it IS an edge ──
  // ⚠ AND IT IS THE FIRST ENTRY HERE THAT IS A COMPONENT THE PAGE RENDERS RATHER THAN A
  // MODULE IT CALLS, which is why it belongs and `WorkflowDeleteSheet` still does not: the
  // Sheet is mounted by the CARD, this prompt is mounted by the PAGE. The distinction the ⚠
  // block above draws is about WHO mounts, not about what kind of thing it is.
  "ForkNameDialog",
] as const

/**
 * The symbols the page must no longer DECLARE — the three cards, the modal, and (192.1-03)
 * the whole fork concern.
 *
 * ⚠ THE TWO SPELLING FAMILIES ARE NOT INTERCHANGEABLE, and the distinction is what makes the
 * fork entries work at all. `freshHash` and `isForkConflict` were MODULE-SCOPE `function`
 * declarations, so the existing `"function …("` pattern matches them exactly. `onTweak`,
 * `onUseStarter`, `draftBySlug` and `forkFailed` are COMPONENT-SCOPE `const`s — a
 * `"function …("` needle would never have matched them, and a fence that cannot match is a
 * fence that passes vacuously. Their declaration spellings are used instead.
 *
 * All six were observed RED against the page as it stood BEFORE the cut — a stronger drive
 * than a plant-and-restore, because the "plant" is the real shipped declaration, so no file
 * was mutated and none needed restoring.
 */
const PAGE_MUST_NOT_DECLARE = [
  "function RunModal(",
  "type DeletePhase",
  "function FilterItem(",
  "function PublishedCard(",
  "function DraftCard(",
  "function StarterCard(",
  // ── 192.1-03 (D-01) — the fork concern, in both declaration families ──
  "function freshHash(",
  "function isForkConflict(",
  "const onTweak = useCallback",
  "const onUseStarter = useCallback",
  "const [forkFailed, setForkFailed]",
  "const draftBySlug = useMemo",
] as const

/** A re-export shim — the thing that keeps the coupling while every negative stays green. */
const REEXPORT_STAR = /export\s+\*\s+from\s+["'][^"']*library\//
const REEXPORT_NAMED = /export\s+\{[^}]*\}\s+from\s+["'][^"']*library\//

/**
 * T-192.1-16's dependency array — `[rows]` and nothing else.
 *
 * ⚠ THIS DETECTOR DID NOT EXIST WHEN THE PHASE CLOSED, AND THE REGISTER SAID IT DID. The
 * threat's recorded mitigation reads *"the memo is keyed on `[rows]` alone (grep-asserted on the
 * literal dependency array)"*. `/gsd:secure-phase` re-ran that grep (E-1, `192.1-SECURITY.md`):
 * the only `[rows])` hit in ANY test file was a COMMENT at `rowIdentity.test.ts:815`, and
 * `WorkflowsPage.test.tsx` names neither `identityIndex` nor `useMemo`. So the mitigation was
 * prose. Widening the key to `[rows, query]` — the exact D-05 violation the phase names, and
 * the shape the page's OWN neighbouring `counts` memo already uses, so it arrives by imitation
 * rather than by invention — passed `tsc`, `eslint`, the count gate and all 52 page cases.
 *
 * Deliberately keyed on `buildIdentityIndex(rows)` rather than on `identityIndex`: a rename of
 * the const is legal and must not red, while a second dependency is the regression.
 */
const IDENTITY_MEMO_KEYED_ON_ROWS_ALONE = /buildIdentityIndex\(\s*rows\s*\)\s*,\s*\[\s*rows\s*\]\s*\)/

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

  it("keys the identity memo on [rows] ALONE — a second dependency is the D-05 violation", () => {
    // POSITIVE CONTROLS FIRST — the detector must REJECT both realistic widenings, or the green
    // on the real page below would mean nothing. `query` is the filter text; `chip` is the
    // provenance filter. Either one re-resolves 106 rows on every keystroke, which RESEARCH
    // measured at ≈ 230,000 inner-loop iterations per render, twice a render (T-192.1-14).
    expect("useMemo(() => buildIdentityIndex(rows), [rows, query])").not.toMatch(
      IDENTITY_MEMO_KEYED_ON_ROWS_ALONE,
    )
    expect("useMemo(() => buildIdentityIndex(rows), [rows, chip])").not.toMatch(
      IDENTITY_MEMO_KEYED_ON_ROWS_ALONE,
    )
    // …and a legal reformat is NOT mistaken for a widening, or this fence trains its reader to
    // edit the fence — the failure mode F4's docblock records ten lines up.
    expect("useMemo(() => buildIdentityIndex(rows), [ rows ])").toMatch(
      IDENTITY_MEMO_KEYED_ON_ROWS_ALONE,
    )
    expect(pageSource).toMatch(IDENTITY_MEMO_KEYED_ON_ROWS_ALONE)
  })

  it("leaves NO re-export shim pointing back at library/", () => {
    // The clause that makes the two negatives mean what they say. A shim would let every
    // other assertion in this file stay green while the page remained the subtree's front
    // door — which is the coupling D-01 exists to remove.
    expect(pageSource).not.toMatch(REEXPORT_STAR)
    expect(pageSource).not.toMatch(REEXPORT_NAMED)
  })
})
