/**
 * Phase 192.2-07 Task 1 (LIB-06 / gap round 1, WR-01 — threats T-192.2-30 / T-192.2-31 /
 * T-192.2-32) — THE GUTTER TOKEN CHAIN FENCE.
 *
 * `WorkflowCard.tsx`'s `GUTTER_TONE` docblock states a contract in prose:
 *
 *   > Deep Midnight semantic tokens only; every one of these is already in `index.css`
 *   > and none is a new hex.
 *
 * ⚠ BOTH HALVES OF THAT SENTENCE WERE FALSE WHEN IT WAS WRITTEN, AND NOTHING IN THIS
 * REPOSITORY COULD SEE IT. `bg-warning` / `text-warning` named a Tailwind key that
 * `tailwind.config.js` never declared, backed by CSS variables that existed ONLY inside
 * `.dark`. So the utilities compiled to nothing in BOTH themes and the `stopped` gutter
 * rendered UNPAINTED — pixel-identical to the `unknown` arm whose own docblock says it is
 * deliberately unpainted precisely so the two "cannot be mistaken". The card's suite asserts
 * `data-run` and explicitly NOT a class (`WorkflowCard.test.tsx:1597`, `:1631`, `:1643`), and
 * a Tailwind utility that does not exist is invisible to `tsc`, to eslint and to every
 * rendering test — `class="… bg-warning"` is a perfectly valid string. This fence is the
 * only thing in the tree that can see the chain.
 *
 * It asserts the WHOLE chain, in three links:
 *
 *   L1  utility literals, extracted from the two tone-map object bodies in `WorkflowCard.tsx`
 *   L2  each utility's key is declared under `theme.extend.colors` in `tailwind.config.js`
 *   L3  each key's `hsl(var(--X))` variable is declared in BOTH `:root` AND `.dark` in `index.css`
 *
 * WHAT MAKES THIS FENCE GO RED (written down so a later reader need not derive it):
 *   · deleting the `warning` key from `tailwind.config.js`            → L2
 *   · deleting `--warning` from `index.css`'s `:root` block, leaving it dark-only  → L3
 *   · adding a sixth arm to `GUTTER_TONE` / `RUN_TONE` whose utility names a key nobody
 *     declared, or changing the arm count at all                       → the shape assertion
 *
 * ⚠ AT THE PRE-FIX SHA ONLY **L2** WAS RED, AND THAT IS WORTH KNOWING RATHER THAN ROUNDING OFF.
 * WR-01 is two independent breaks — an undeclared config key AND a dark-only variable — but
 * `themeGaps` skips any key L2 has already reported, so one defect is never counted twice. The
 * dark-only half is therefore proven by its synthetic control, which reproduces exactly that
 * shape and requires the detector to catch it. See the L3 assertion's own note.
 *
 * ⚠ THE EXTRACTION IS BRACE-BOUNDED TO THE TWO MAP BODIES, AND THAT IS LOAD-BEARING RATHER
 * THAN TIDY. `WorkflowCard.tsx` is a live file that other plans edit for unrelated reasons —
 * `192.2-09` adds a `matchReasons` explanation render to its JSX in a parallel worktree, and
 * those changes meet this fence only AFTER the merge, where nobody is watching. A line-ranged
 * or whole-file regex extraction would sweep that JSX's classes and go red for a reason that is
 * nobody's defect. The detector walks from `const GUTTER_TONE = {` to its MATCHING brace and
 * reads string literals from that span only, so a class added anywhere else in the file is
 * provably outside the swept set — proven by a synthetic control below (`is bounded to the two
 * map bodies`), not merely asserted here.
 *
 * ⚠ THE SIZE ASSERTION IS EXACT ON PURPOSE. No `>=`, no range, no tolerance, no
 * computed-from-source size: a fence that cannot go red is not a fence, and an exact count is
 * the entire mechanism by which a SIXTH arm cannot be added without a human re-deriving this
 * chain. `192.2-11` (wave 3) adds that sixth arm and is the plan AUTHORISED to re-derive the
 * count — in `TONE_SHAPE` below, which exists so it is one obvious location instead of a magic
 * number hunted through assertions.
 *
 * ⚠ EVERY FENCE CARRIES A SYNTHETIC POSITIVE CONTROL, the house rule this subtree already
 * states (`librarySubtree.fences.test.ts:56-61`): *"A fence whose matcher is broken passes
 * vacuously and looks exactly like a fence that holds."* This file's controls run the REAL
 * detector functions over in-test sources carrying planted violations, and each must catch it.
 *
 * ⚠ THIS FILE IS NOT ADDED TO `LIBRARY_SUBTREE_PATHS`, AND THAT WAS CONFIRMED RATHER THAN
 * ASSUMED. That array is an explicit list of SOURCE modules; `librarySubtree.fences.test.ts`
 * derives its corpus by indexing `LIBRARY_MODULES[path]` for LISTED paths only (`:130-136`),
 * and its own docblock (`:50-54`) states test files are outside the sweep by construction.
 * Every one of its `LIBRARY_MODULES` reads is keyed by an explicit path, verified at this SHA.
 * This file gains a key in that glob record and is indexed by nothing.
 *
 * ⚠ KNOWN LIMITS, STATED RATHER THAN DISCOVERED LATER:
 *   · The scanners skip strings and both comment forms, so a utility mentioned in a COMMENT is
 *     not swept and a key mentioned in a comment cannot satisfy L2 (the 187-24 trap, which this
 *     subtree has hit four times). A control proves the comment case.
 *   · A regex literal containing an unbalanced brace or quote inside a swept span would confuse
 *     the brace matcher. Neither tone map contains one, and both are object literals of string
 *     values by contract.
 *   · Only `bg-` / `text-` / `border-` / `ring-` / `fill-` / `stroke-` literals are treated as
 *     colour utilities. A future arm keyed on `from-`/`via-` would go unswept; a NON-colour
 *     utility placed in a tone map (say `text-[12px]`) WOULD be swept and would red, which is
 *     correct — these maps are colour-only by their own docblocks.
 */
import { describe, it, expect, vi } from "vitest"
import cardSource from "./WorkflowCard?raw"
import tailwindSource from "../../../../tailwind.config.js?raw"

/**
 * ⚠ `index.css` IS THE ONE SOURCE HERE NOT READ THROUGH `?raw`, AND THE DEPARTURE FROM THE
 * HOUSE RULE IS FORCED BY MEASUREMENT RATHER THAN CHOSEN.
 *
 * `PublishGauntlet.test.tsx:36-46` states the rule this file otherwise obeys — read source with
 * Vite's `?raw` loader, never `node:fs`, because `tsconfig.app.json` sets `types: ["vite/client"]`
 * and a `node:*` import adds NEW `tsc` errors to a baseline every plan is measured against.
 * That rule holds for `.py`, `.ts` and `.tsx` sources. **It does not hold for CSS**, and the
 * reason is not the specifier:
 *
 *   · `import css from "@/index.css?raw"`               → resolves, length **0**
 *   · `import css from "../../../index.css?raw"`        → resolves, length **0**
 *   · `import.meta.glob("…/index.css", {query:"?raw"})` → key present, length **0**
 *   · `import css from "@/index.css?inline"`            → resolves, length **0**
 *
 * All four measured 2026-08-19 under vitest 4.1.0. `test.css` defaults to `false`, so every CSS
 * module is replaced with the empty string and the `?raw` / `?inline` query is swallowed with
 * it. Nothing throws and nothing warns.
 *
 * ⚠ THAT IS EXACTLY THE FAILURE MODE THIS SUBTREE KEEPS RECORDING — a fence sweeping the empty
 * string passes green while defending nothing. Had L3 been written against `""`, every `--X`
 * lookup would have missed and the fence would have been either permanently red for the wrong
 * reason or (with the assertion inverted) permanently green over nothing at all. It was caught
 * only because the non-vacuity block asserts each source is NON-EMPTY before anything is
 * asserted about its contents. That block is load-bearing, not ceremony.
 *
 * So the read goes through `vi.importActual("node:fs")`: a RUNTIME module specifier, so no
 * static `node:*` import exists for `tsc` to reject, and the `types: ["vite/client"]` baseline
 * is unmoved. This is a TEST file, which ships to no browser; no `src/**` product module gains
 * a Node reach from it.
 *
 * ⚠ THE PATH COMES FROM `import.meta.url` BY STRING SURGERY, AND NOT FROM
 * `new URL("…", import.meta.url)` — which Vite STATICALLY REWRITES into an asset reference, so
 * `fileURLToPath` receives something that is no longer a `file:` URL and throws
 * `TypeError: The URL must be of scheme file` before a single test runs. That is
 * `PublishGauntlet.test.tsx:44-46`'s claim, and it was RE-MEASURED here rather than inherited:
 * observed as a suite-level import error, while bare `import.meta.url` was measured to be a
 * perfectly good `file:///…` URL. `process.cwd()` is not used either — it has no type under
 * `vite/client`, and a cwd-derived path would silently depend on whether the runner is
 * `frontend/` or the repo root (`scripts/vitest-count-gate.cjs` differs from a direct run).
 */
const nodeFs = await vi.importActual<{ readFileSync(path: string, encoding: string): string }>(
  "node:fs",
)

/** `file:///C:/…/frontend/src/components/workflows/library/<this file>` → `…/frontend/src/`. */
const SRC_ROOT = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/src/components/workflows/library/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error(`fence cannot locate its own subtree in: ${here}`)
  return `${here.slice(0, at)}/src/`
})()

const cssSource = nodeFs.readFileSync(`${SRC_ROOT}index.css`, "utf8")

// ── the shape this fence was measured against ────────────────────────────────────────────

/**
 * THE ONE PLACE THE EXPECTED SHAPE LIVES.
 *
 * Measured 2026-08-19 against base `d622165b`, where `RunGutter` has FIVE arms
 * (`worked` · `failed` · `stopped` · `never` · `unknown`) and each of the two tone maps has
 * exactly one entry per arm:
 *
 *   · `entries`  10 — five utilities in `GUTTER_TONE` + five in `RUN_TONE`
 *   · `unique`    9 — `text-muted-foreground` is named TWICE (`never` and `unknown` share the
 *                     quiet tone), so the de-duplicated set is one smaller than the entry count.
 *                     Both numbers are pinned because they answer different questions: `entries`
 *                     sees an arm added, `unique` sees a colour added.
 *   · `perMap`    5 — the two maps MUST stay the same length. That pairing is the design
 *                     invariant `RUN_TONE`'s own docblock states ("so a new arm cannot get a
 *                     colour and lose a word"); nothing else in the tree asserts it.
 *
 * ⚠ `192.2-11` IS THE PLAN AUTHORISED TO RE-DERIVE THESE, when it adds a sixth arm. Read the
 * new numbers out of THIS assertion's own failing diff — never predict them — the way
 * `librarySubtree.fences.test.ts` has now done six consecutive times.
 *
 * ── ⚠ RE-DERIVED 2026-08-19 BY `192.2-11` (CR-01) — THE SIXTH ARM LANDED ─────────────────
 * `192.2-11` adds `not-by-you` to BOTH tone maps, so `RunGutter` has SIX arms
 * (`worked` · `failed` · `stopped` · `never` · `not-by-you` · `unknown`). **The numbers were
 * re-derived by reading the two edited object bodies back — NOT by bumping each figure by two —
 * and the reason that distinction matters is that the two maps DO NOT CONTRIBUTE EQUALLY:**
 *
 *   · `GUTTER_TONE["not-by-you"] = "bg-muted-foreground"`  → a GENUINELY NEW literal
 *   · `RUN_TONE["not-by-you"]    = "text-muted-foreground"` → the THIRD occurrence of a literal
 *     that `never` and `unknown` already name (DEC-11-C: the three quiet arms are told apart by
 *     their WORDS, not by three shades of grey)
 *
 * So the three figures move by three DIFFERENT amounts, and a uniform `+2` guess would have
 * landed on `unique: 11` — a number that is wrong while still looking plausible:
 *
 *   · `entries`  10 → **12**  (+2 — the extraction collects RAW OCCURRENCES, one per map)
 *   · `unique`    9 → **10**  (+1 — `new Set(all).size`; only `bg-muted-foreground` is new)
 *   · `perMap`    5 → **6**   (+1 — the two maps stay the same length, which is the invariant)
 *
 * Confirmed against this assertion's own failing diff, which read
 * *"expected [ 'bg-success', …(11) ] to have a length of 10 but got 12"* before the edit.
 * ⚠ THE ASSERTION IS STILL AN EXACT SIZE. No `>=`, no range, no tolerance, no removed check —
 * loosening it to make a sixth arm fit would have left a fence that passes while defending
 * nothing, which is this repository's most repeated failure mode.
 */
const TONE_SHAPE = { entries: 12, unique: 10, perMap: 6 } as const

/** The two maps, by the identifier the extractor anchors on. */
const TONE_MAPS = ["GUTTER_TONE", "RUN_TONE"] as const

/** Utility prefixes treated as colour-bearing. See the KNOWN LIMITS note above. */
const COLOR_UTILITY_PREFIXES = ["bg-", "text-", "border-", "ring-", "fill-", "stroke-"] as const

/**
 * Tailwind's built-in keyword colours, which are NOT declared in `theme.extend.colors` and
 * never will be. An EXPLICIT allowlist rather than a pattern: a typo'd `transparnet` must red.
 */
const BUILT_IN_COLOR_KEYWORDS = ["transparent", "current", "inherit"] as const

// ── scanners (shared by the real assertions and by every synthetic control) ───────────────

/** Advance past whitespace and both comment forms. CSS has only the `/* *\/` form; JS has both. */
function skipTrivia(src: string, i: number): number {
  for (;;) {
    while (i < src.length && /\s/.test(src[i])) i++
    if (src.startsWith("//", i)) {
      const nl = src.indexOf("\n", i)
      i = nl === -1 ? src.length : nl + 1
      continue
    }
    if (src.startsWith("/*", i)) {
      const end = src.indexOf("*/", i + 2)
      i = end === -1 ? src.length : end + 2
      continue
    }
    return i
  }
}

/** From the index of an opening quote, return the index just past the closing quote. */
function skipString(src: string, i: number): number {
  const quote = src[i]
  i++
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2
      continue
    }
    if (src[i] === quote) return i + 1
    i++
  }
  throw new Error("unterminated string literal in swept source")
}

/** From the index of an opening `{`, return the index just past its MATCHING `}`. */
function matchBrace(src: string, open: number): number {
  let depth = 0
  let i = open
  while (i < src.length) {
    const c = src[i]
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i)
      continue
    }
    if (src.startsWith("//", i) || src.startsWith("/*", i)) {
      i = skipTrivia(src, i)
      continue
    }
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) return i + 1
    }
    i++
  }
  throw new Error("unbalanced brace in swept source")
}

/**
 * The body of the ONE block whose header matches. `header` MUST end with `\{`.
 * Throws when the header is absent or ambiguous — a renamed map fails LOUDLY rather than
 * sweeping the empty string, which is this project's measured way for a fence to defend nothing
 * while staying green.
 */
function blockBody(src: string, header: RegExp): string {
  const global = new RegExp(header.source, "g")
  const hits = [...src.matchAll(global)]
  if (hits.length === 0) throw new Error(`fence header not found: ${header.source}`)
  if (hits.length > 1) throw new Error(`fence header is ambiguous (${hits.length} hits): ${header.source}`)
  const open = hits[0].index! + hits[0][0].length - 1
  return src.slice(open + 1, matchBrace(src, open) - 1)
}

/** Every string literal in `src`, comments excluded BY CONSTRUCTION (they are never scanned). */
function stringLiteralsIn(src: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (src.startsWith("//", i) || src.startsWith("/*", i)) {
      i = skipTrivia(src, i)
      continue
    }
    if (c === '"' || c === "'" || c === "`") {
      const end = skipString(src, i)
      out.push(src.slice(i + 1, end - 1))
      i = end
      continue
    }
    i++
  }
  return out
}

type ObjectEntry = { name: string; value: string; isObject: boolean }

/** Depth-0 entries of an object-literal BODY (braces already stripped). */
function parseEntries(body: string): ObjectEntry[] {
  const out: ObjectEntry[] = []
  let i = skipTrivia(body, 0)
  while (i < body.length) {
    let name: string
    if (body[i] === '"' || body[i] === "'") {
      const end = skipString(body, i)
      name = body.slice(i + 1, end - 1)
      i = end
    } else {
      const m = /^[A-Za-z0-9_$-]+/.exec(body.slice(i))
      if (!m) break
      name = m[0]
      i += m[0].length
    }
    i = skipTrivia(body, i)
    if (body[i] !== ":") break
    i = skipTrivia(body, i + 1)

    let value: string
    let isObject = false
    if (body[i] === "{") {
      const end = matchBrace(body, i)
      value = body.slice(i + 1, end - 1)
      isObject = true
      i = end
    } else {
      const start = i
      let depth = 0
      while (i < body.length) {
        const c = body[i]
        if (c === '"' || c === "'" || c === "`") {
          i = skipString(body, i)
          continue
        }
        if (c === "(" || c === "[" || c === "{") {
          depth++
          i++
          continue
        }
        if (c === ")" || c === "]" || c === "}") {
          depth--
          i++
          continue
        }
        if (c === "," && depth === 0) break
        i++
      }
      value = body.slice(start, i).trim()
    }

    out.push({ name, value, isObject })
    i = skipTrivia(body, i)
    if (body[i] === ",") i = skipTrivia(body, i + 1)
  }
  return out
}

// ── L1: the utilities the card's two tone maps actually name ─────────────────────────────

function isColorUtility(literal: string): boolean {
  return COLOR_UTILITY_PREFIXES.some((p) => literal.startsWith(p))
}

/**
 * The colour utilities named INSIDE each tone map's brace-bounded body, and nowhere else.
 * ⚠ This bounding is what keeps a sibling plan's JSX edits out of the swept set — see the
 * `is bounded to the two map bodies` control below, which proves it rather than asserting it.
 */
function toneUtilities(cardSrc: string): { map: string; utilities: string[] }[] {
  return TONE_MAPS.map((map) => ({
    map,
    utilities: stringLiteralsIn(blockBody(cardSrc, new RegExp(`\\bconst ${map}\\s*=\\s*\\{`))).filter(
      isColorUtility,
    ),
  }))
}

function allToneUtilities(cardSrc: string): string[] {
  return toneUtilities(cardSrc).flatMap((m) => m.utilities)
}

// ── L2: utility → declared Tailwind colour key ───────────────────────────────────────────

/**
 * Every colour NAME Tailwind can resolve from `theme.extend.colors`, mapped to its value.
 * A nested object contributes `parent` (from `DEFAULT`) and `parent-member` for the rest, which
 * is exactly how `text-muted-foreground` resolves through `muted.foreground`.
 *
 * ⚠ THIS IS A PARSER, NOT THE LINE-ANCHORED `/^\s*"?key"?\s*:/m` GREP THE PLAN NAMED, and the
 * substitution is deliberate: compound keys like `muted-foreground` have NO such line anywhere
 * in the config — they exist only as a `foreground:` member nested under `muted:`, so the grep
 * would report every compound key as undeclared. The parser is STRICTLY STRONGER on the property
 * the grep was chosen for (comments cannot satisfy it — they are never scanned at all), and the
 * `a key that appears only in a COMMENT does not count as declared` control below proves it.
 */
function declaredColorKeys(twSource: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of parseEntries(blockBody(twSource, /\bcolors\s*:\s*\{/))) {
    if (!entry.isObject) {
      map.set(entry.name, entry.value)
      continue
    }
    for (const member of parseEntries(entry.value)) {
      map.set(member.name === "DEFAULT" ? entry.name : `${entry.name}-${member.name}`, member.value)
    }
  }
  return map
}

function keyOf(utility: string): string {
  const prefix = COLOR_UTILITY_PREFIXES.find((p) => utility.startsWith(p))
  return prefix ? utility.slice(prefix.length) : utility
}

/** The utilities whose key is neither a Tailwind keyword nor a declared config key. */
function unresolvedUtilities(cardSrc: string, twSource: string): string[] {
  const declared = declaredColorKeys(twSource)
  return [...new Set(allToneUtilities(cardSrc))].filter((u) => {
    const key = keyOf(u)
    return !(BUILT_IN_COLOR_KEYWORDS as readonly string[]).includes(key) && !declared.has(key)
  })
}

// ── L3: declared key → CSS variable, in BOTH themes ──────────────────────────────────────

/** `--warning` matches ONLY `--warning:`, never `--warning-foreground:`. */
function declaresVariable(cssBlockBody: string, variable: string): boolean {
  return new RegExp(`^\\s*${variable}\\s*:`, "m").test(cssBlockBody)
}

type ThemeGap = { utility: string; key: string; variable: string | null; missingIn: string[] }

/**
 * For every RESOLVED tone utility, the themes in which its backing CSS variable is not declared.
 * A key whose value carries no `var(--X)` at all is reported too — the tone maps' contract is
 * semantic tokens, so a raw hex smuggled into the config is a violation of the same sentence.
 */
function themeGaps(cardSrc: string, twSource: string, css: string): ThemeGap[] {
  const declared = declaredColorKeys(twSource)
  const rootBody = blockBody(css, /:root\s*\{/)
  const darkBody = blockBody(css, /\.dark\s*\{/)
  const gaps: ThemeGap[] = []

  for (const utility of [...new Set(allToneUtilities(cardSrc))]) {
    const key = keyOf(utility)
    if ((BUILT_IN_COLOR_KEYWORDS as readonly string[]).includes(key)) continue
    const value = declared.get(key)
    if (value === undefined) continue // an L2 failure; reported there, not double-counted here
    const variable = /var\((--[A-Za-z0-9_-]+)\)/.exec(value)?.[1] ?? null
    if (variable === null) {
      gaps.push({ utility, key, variable: null, missingIn: ["not variable-backed"] })
      continue
    }
    const missingIn = [
      declaresVariable(rootBody, variable) ? null : ":root",
      declaresVariable(darkBody, variable) ? null : ".dark",
    ].filter((x): x is string => x !== null)
    if (missingIn.length > 0) gaps.push({ utility, key, variable, missingIn })
  }
  return gaps
}

// ── synthetic sources for the positive controls ──────────────────────────────────────────

const PLANTED_CARD = `
const GUTTER_TONE = {
  worked: "bg-success",
  stopped: "bg-does-not-exist",
} as const

const RUN_TONE = {
  worked: "text-success",
} as const
`

/**
 * The bounding control's source. `bg-nope-not-swept` sits in JSX BELOW both maps — the shape a
 * parallel plan's edit takes — and `bg-also-not-swept` sits inside a COMMENT within a map body.
 * Neither may enter the swept set.
 */
const CARD_WITH_CLASSES_OUTSIDE_THE_MAPS = `
const GUTTER_TONE = {
  /* a commented-out arm: "bg-also-not-swept" */
  worked: "bg-success",
} as const

const RUN_TONE = {
  worked: "text-success",
} as const

const SOMETHING_ELSE = "bg-nope-not-swept"

export function Card() {
  return <div className="bg-nope-not-swept text-nope-not-swept">{"bg-nope-not-swept"}</div>
}
`

const CONFIG_WITH_DARK_ONLY_KEY = `
export default {
  theme: {
    extend: {
      colors: {
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        ghost: "hsl(var(--ghost))",
      },
    },
  },
}
`

const CARD_USING_GHOST = `
const GUTTER_TONE = { worked: "bg-ghost" } as const
const RUN_TONE = { worked: "text-ghost" } as const
`

const CSS_WITH_GHOST_ONLY_IN_DARK = `
:root {
  --success: 142 71% 45%;
  --success-foreground: 0 0% 100%;
}
.dark {
  --success: 142 71% 45%;
  --success-foreground: 0 0% 100%;
  --ghost: 38 92% 60%;
}
`

/** The 187-24 trap: the key exists ONLY as prose inside a comment. */
const CONFIG_WITH_KEY_ONLY_IN_A_COMMENT = `
export default {
  theme: {
    extend: {
      colors: {
        // ghost: "hsl(var(--ghost))" — removed in some earlier phase, kept here as a note
        success: { DEFAULT: "hsl(var(--success))" },
      },
    },
  },
}
`

const CONFIG_WITH_RAW_HEX = `
export default {
  theme: {
    extend: {
      colors: {
        ghost: "#ffbb00",
      },
    },
  },
}
`

// ═══════════════════════════════════════════════════════════════════════════════════════════

describe("the fence is looking at something (non-vacuity)", () => {
  it("resolved all three `?raw` sources, and each is the file this fence thinks it is", () => {
    // ⚠ A `?raw` specifier that fails to resolve is a SUITE-LEVEL error, not a red fence, and the
    // two do not read the same in a gate report. These assertions make the difference explicit.
    expect(cardSource.length).toBeGreaterThan(0)
    expect(tailwindSource.length).toBeGreaterThan(0)
    expect(cssSource.length).toBeGreaterThan(0)
    expect(cardSource).toContain("const GUTTER_TONE")
    expect(cardSource).toContain("const RUN_TONE")
    expect(tailwindSource).toContain("theme:")
    expect(cssSource).toContain(":root {")
    expect(cssSource).toContain(".dark {")
  })

  it("extracts exactly the tone-map shape measured at this SHA — SIX arms, two maps", () => {
    const maps = toneUtilities(cardSource)
    const all = allToneUtilities(cardSource)

    // ⚠ NON-VACUITY FIRST. A detector that swept nothing would satisfy every assertion below
    // about "no unresolved utilities" while defending nothing at all — this project has
    // MEASURED that happening (192.1, a fence sweeping the empty string).
    expect(all.length).toBeGreaterThan(0)

    // ⚠ EXACT, from `TONE_SHAPE`. `192.2-11` DID re-derive these three numbers when it added
    // the sixth arm (`not-by-you`) — 10/9/5 → 12/10/6, by reading the two edited object bodies
    // back and NOT by bumping each by two; see `TONE_SHAPE`'s own re-derivation paragraph. A
    // SEVENTH arm re-runs the same drill: read them out of THIS assertion's failing diff.
    expect(all).toHaveLength(TONE_SHAPE.entries)
    expect(new Set(all).size).toBe(TONE_SHAPE.unique)
    for (const { map, utilities } of maps) {
      expect(`${map}:${utilities.length}`).toBe(`${map}:${TONE_SHAPE.perMap}`)
    }
  })

  it("is bounded to the two map bodies — a class added elsewhere in the file is NOT swept", () => {
    // ⚠ THE CROSS-PLAN CONTROL. `192.2-09` edits `WorkflowCard.tsx`'s JSX in a parallel
    // worktree and its changes meet this fence only after the merge. This proves that a
    // `bg-*` literal in JSX, in a sibling const, or in a comment INSIDE a map body cannot
    // enter the swept set — so a red here is always about the tone maps themselves.
    const swept = allToneUtilities(CARD_WITH_CLASSES_OUTSIDE_THE_MAPS)
    expect(swept).toEqual(["bg-success", "text-success"])
    expect(swept).not.toContain("bg-nope-not-swept")
    expect(swept).not.toContain("text-nope-not-swept")
    expect(swept).not.toContain("bg-also-not-swept")
    // …and the planted literals really ARE in the source, so the negatives above are not
    // passing because the fixture forgot to carry them.
    expect(CARD_WITH_CLASSES_OUTSIDE_THE_MAPS).toContain("bg-nope-not-swept")
    expect(CARD_WITH_CLASSES_OUTSIDE_THE_MAPS).toContain("bg-also-not-swept")
  })

  it("reads a non-empty colour palette out of the real Tailwind config", () => {
    const declared = declaredColorKeys(tailwindSource)
    expect(declared.size).toBeGreaterThan(0)
    // Spot anchors, so a parser that silently returned junk cannot pass this.
    expect(declared.get("success")).toContain("var(--success)")
    expect(declared.get("muted-foreground")).toContain("var(--muted-foreground)")
    expect(declared.get("border")).toContain("var(--border)")
  })
})

describe("L2 — every tone utility names a declared Tailwind colour key", () => {
  it("leaves no utility unresolved", () => {
    // ⚠ THIS IS THE ASSERTION THAT WAS RED BEFORE 192.2-07 TASK 2, naming `bg-warning` and
    // `text-warning`: `tailwind.config.js` declared no `warning` key, so both compiled to
    // nothing and the `stopped` gutter rendered unpainted.
    expect(unresolvedUtilities(cardSource, tailwindSource)).toEqual([])
  })
})

describe("L3 — every resolved key is variable-backed and declared in BOTH themes", () => {
  it("leaves no theme gap", () => {
    // ⚠ THIS ASSERTION WAS **GREEN** BEFORE 192.2-07 TASK 2, AND SAYING SO IS THE POINT.
    // An earlier draft of this docblock claimed it was red alongside L2; that was MEASURED
    // FALSE and is corrected here rather than quietly deleted. `themeGaps` deliberately
    // `continue`s past a key L2 already reported as undeclared, so it does not double-count
    // one defect as two — and at the pre-fix SHA `warning` was undeclared, so L3 never
    // reached the `.dark`-only variables at all.
    //
    // The SECOND, independent half of WR-01 is therefore proven by CONTROL, not by this line:
    // `--warning` / `--warning-foreground` lived only inside `.dark` (index.css:116-117), and
    // `L3 catches a declared key whose variable is missing from ':root'` reproduces exactly
    // that shape on a synthetic pair and requires the detector to catch it. That control is
    // what makes this assertion's green meaningful after Task 2, and it is what will go red
    // if someone later deletes `--warning` from `:root` while leaving the config key in place.
    expect(themeGaps(cardSource, tailwindSource, cssSource)).toEqual([])
  })
})

describe("synthetic positive controls — the matcher can fail", () => {
  it("L2 catches a tone map naming a key nobody declared", () => {
    expect(unresolvedUtilities(PLANTED_CARD, tailwindSource)).toEqual(["bg-does-not-exist"])
  })

  it("L2 does NOT count a key that appears only inside a COMMENT (the 187-24 trap)", () => {
    expect(CONFIG_WITH_KEY_ONLY_IN_A_COMMENT).toContain("ghost")
    expect(declaredColorKeys(CONFIG_WITH_KEY_ONLY_IN_A_COMMENT).has("ghost")).toBe(false)
    expect(unresolvedUtilities(CARD_USING_GHOST, CONFIG_WITH_KEY_ONLY_IN_A_COMMENT)).toEqual([
      "bg-ghost",
      "text-ghost",
    ])
  })

  it("L3 catches a declared key whose variable is missing from `:root` — today's real defect", () => {
    const gaps = themeGaps(CARD_USING_GHOST, CONFIG_WITH_DARK_ONLY_KEY, CSS_WITH_GHOST_ONLY_IN_DARK)
    expect(gaps).toEqual([
      { utility: "bg-ghost", key: "ghost", variable: "--ghost", missingIn: [":root"] },
      { utility: "text-ghost", key: "ghost", variable: "--ghost", missingIn: [":root"] },
    ])
  })

  it("L3 catches a key that is a raw hex rather than a semantic token", () => {
    const gaps = themeGaps(CARD_USING_GHOST, CONFIG_WITH_RAW_HEX, CSS_WITH_GHOST_ONLY_IN_DARK)
    expect(gaps.map((g) => g.missingIn)).toEqual([["not variable-backed"], ["not variable-backed"]])
  })

  it("blockBody REFUSES a renamed map rather than sweeping the empty string", () => {
    expect(() => toneUtilities("const SOMETHING_ELSE = { worked: 'bg-success' }")).toThrow(
      /fence header not found/,
    )
  })
})
