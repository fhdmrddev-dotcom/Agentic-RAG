/**
 * Phase 183-05 Task 3 (D-183-12, G-6) — the canvasModel purity tripwire.
 *
 * D-183-12 in machine-checkable form, plus the first four G-6 "how we'd know this
 * failed" conditions. Every assertion here is a control that PROVABLY fires: adding a
 * clock read to the model, or mutating the input inside `toCanvas`, was confirmed to
 * turn this suite red before being reverted.
 *
 * The load-bearing one is the Pitfall-3 walk. If a layout key ever reaches a
 * definition object it would 422 against the backend's `extra="forbid"` — or force
 * someone to relax it, which is the first named G-6 failure. The model computes
 * layout; it never writes it back.
 */
import { describe, it, expect } from "vitest"

import canvasModelSource from "./canvasModel?raw"
import { toCanvas, CANVAS_LAYOUT } from "./canvasModel"
// Phase 184-05 additions land as SEPARATE import statements rather than by widening
// the two lines above, so this file's whole diff is ADDED lines only and D-184-08's
// "no existing assertion touched" claim is auditable by `git diff` alone.
import { fromCanvas } from "./canvasModel"
import { ALL_FIXTURES, evalCoverage } from "./__fixtures__/canvasFixtures"
import { indexGap } from "./__fixtures__/canvasFixtures"
import type { PhaseSpecJSON } from "./phaseVocabulary"

/** A JSON deep clone — every fixture is JSON-safe by construction. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** A DETERMINISTIC reshuffle (reverse, then rotate by one) — never Math.random, so a
 *  failure here is always reproducible. */
const reshuffle = (phases: PhaseSpecJSON[]): PhaseSpecJSON[] => {
  const reversed = [...phases].reverse()
  return reversed.length > 1 ? [...reversed.slice(1), reversed[0]] : reversed
}

/** The layout keys that must never appear anywhere inside a definition object. */
const FORBIDDEN_DEFINITION_KEYS = ["position", "x", "y", "layout"]

/** Walk an arbitrary value and collect every forbidden key found on any object. */
const forbiddenKeysIn = (value: unknown, found: string[] = []): string[] => {
  if (Array.isArray(value)) {
    for (const item of value) forbiddenKeysIn(item, found)
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_DEFINITION_KEYS.includes(k)) found.push(k)
      forbiddenKeysIn(v, found)
    }
  }
  return found
}

describe("canvasModel — determinism (D-183-12: same definition in, same picture out)", () => {
  it.each(ALL_FIXTURES)("$name projects byte-identically across two calls", ({ phases }) => {
    expect(JSON.stringify(toCanvas(phases))).toBe(JSON.stringify(toCanvas(phases)))
  })

  it.each(ALL_FIXTURES)("$name is order-independent (shuffled input, same output)", ({ phases }) => {
    expect(JSON.stringify(toCanvas(reshuffle(phases)))).toBe(JSON.stringify(toCanvas(phases)))
  })
})

describe("canvasModel — non-mutation and Pitfall 3 (no layout in the definition)", () => {
  it.each(ALL_FIXTURES)("$name: the input is deep-equal to its pre-call clone", ({ phases }) => {
    const before = clone(phases)
    toCanvas(phases)
    expect(phases).toEqual(before)
  })

  it.each(ALL_FIXTURES)("$name: no position/x/y/layout key reaches the INPUT", ({ phases }) => {
    toCanvas(phases)
    expect(forbiddenKeysIn(phases)).toEqual([])
  })

  it("the walk is a real control — it FINDS a planted layout key", () => {
    const planted = [{ slug: "a", phase_index: 0, config: { phase_type: "llm_single" }, position: { x: 1, y: 2 } }]
    expect(forbiddenKeysIn(planted)).toContain("position")
  })

  it("does not hand back a reference to any input phase object", () => {
    const phases = clone(evalCoverage)
    const { nodes } = toCanvas(phases)
    for (const node of nodes) {
      for (const phase of phases) {
        expect(node.data).not.toBe(phase)
        expect(node.data).not.toBe(phase.config)
      }
    }
  })
})

describe("canvasModel — the layout constants are the single source", () => {
  it("places every phase at exactly col * CANVAS_LAYOUT.PITCH_X on the lane", () => {
    const { nodes } = toCanvas(evalCoverage)
    const phaseNodes = nodes.filter((n) => n.type === "phase")
    expect(phaseNodes).toHaveLength(5)
    phaseNodes.forEach((node, col) => {
      expect(node.position).toEqual({
        x: col * CANVAS_LAYOUT.PITCH_X,
        y: CANVAS_LAYOUT.LANE_Y,
      })
    })
  })
})

// ── Phase 184-05: the `fromCanvas` source slice, and why it is a slice ──────────
//
// The three new guards below are claims about ONE function, not about the module, so
// they are scoped to that function's own source. Two helpers make that scoping real:
//
//  1. `sliceFrom` cuts from a declaration to the next TOP-LEVEL `export` (or EOF).
//  2. `stripComments` then removes every comment from the cut.
//
// Step 2 is the load-bearing one. D-ITEM-183-02 — hit five-plus times in Phase 183 —
// says a guard that can only pass by making a comment lie is a BROKEN guard. Without
// the strip, "fromCanvas never reads a position" would forbid `fromCanvas`'s docblock
// from using the word `position` while explaining that very rule. Both helpers carry
// their own positive controls below; an extractor nobody proved is just an assumption
// with a function name.

/** Cut a top-level declaration's source out of a module, declaration → next export. */
const sliceFrom = (source: string, marker: string): string => {
  const start = source.indexOf(marker)
  if (start < 0) throw new Error(`sliceFrom: marker not found — ${marker}`)
  const rest = source.slice(start + marker.length)
  const nextExport = rest.search(/\nexport\s/)
  return marker + (nextExport < 0 ? rest : rest.slice(0, nextExport))
}

/** Remove block and line comments so the guards below test CODE, never prose. */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ")

/** `fromCanvas`'s body, comments removed — the subject of the three new guards. */
const FROM_CANVAS_CODE = stripComments(sliceFrom(canvasModelSource, "export function fromCanvas"))

describe("canvasModel — source purity (the ?raw grep, the shipped house idiom)", () => {
  it("reads no DOM, no clock and no randomness", () => {
    expect(canvasModelSource).not.toMatch(
      /getBoundingClientRect|offsetHeight|offsetWidth|document\.|window\.|Date\.now|Math\.random/,
    )
  })

  it("imports nothing from the API client", () => {
    expect(canvasModelSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
  })

  it("never references the server validation seam (D-183-15: zero network round trips)", () => {
    expect(canvasModelSource).not.toMatch(/workflows\/validate/)
    expect(canvasModelSource).not.toMatch(/fetch\(/)
  })

  it("declares no second copy of the phase glyph map or the on-fail parse (G-5)", () => {
    expect(canvasModelSource).not.toMatch(/const PHASE_GLYPHS/)
    expect(canvasModelSource).not.toMatch(/function parseSkipTarget/)
  })

  it("imports the shared vocabulary rather than re-deriving it", () => {
    expect(canvasModelSource).toMatch(/from "@\/components\/workflows\/phaseVocabulary"/)
  })

  it("derives the sequential edge by phase_index LOOKUP, never by array adjacency", () => {
    expect(canvasModelSource).toMatch(/phase_index \+ 1/)
    expect(canvasModelSource).not.toMatch(/ordered\[\s*(i|index)\s*\+\s*1\s*\]/)
  })

  // ── Phase 184-05 — the three `fromCanvas` slice guards, each with a control ────

  it("the slice extractor is real — it stops at the next top-level export", () => {
    const synthetic = [
      "export function fromCanvas(a) {",
      "  return a",
      "}",
      "",
      "export function somethingElse() {",
      "  return node.position",
      "}",
    ].join("\n")
    const cut = sliceFrom(synthetic, "export function fromCanvas")
    expect(cut).toContain("return a")
    expect(cut).not.toContain("somethingElse")
    expect(cut).not.toContain("node.position")
  })

  it("the comment stripper is real — it removes prose and keeps code", () => {
    const planted = "// mentions node.position in prose\nconst a = node.position\n/* .target */"
    const stripped = stripComments(planted)
    expect(stripped).toContain("const a = node.position")
    expect(stripped.match(/\.position\b/g)).toHaveLength(1)
    expect(stripped).not.toContain(".target")
  })

  it("the extracted slice is fromCanvas ONLY — no toCanvas body leaked in", () => {
    expect(FROM_CANVAS_CODE).toContain("export function fromCanvas")
    expect(FROM_CANVAS_CODE).not.toContain("export function toCanvas")
    expect(FROM_CANVAS_CODE).not.toContain("CANVAS_LAYOUT.PITCH_X")
  })

  it("fromCanvas never reads an edge (RESEARCH Q1 — edges carry no authored data)", () => {
    // MEMBER access specifically: the dot must follow an identifier or a closing
    // bracket. A bare /\.(source|target)/ also matches the spread in `[...source]`,
    // where `source` is this function's own PARAMETER and no member is read at all —
    // a false positive the first run of this guard actually produced.
    const memberAccess = /[A-Za-z0-9_$\])]\.(source|target)\b/
    expect(FROM_CANVAS_CODE).not.toMatch(/\bedges\b/)
    expect(FROM_CANVAS_CODE).not.toMatch(memberAccess)
    // Controls: both regexes DO fire on a planted literal.
    expect("const drawn = edges.filter(Boolean)").toMatch(/\bedges\b/)
    expect("const from = edge.source").toMatch(memberAccess)
    expect("const to = edge.target").toMatch(memberAccess)
  })

  it("fromCanvas never renumbers — renumbering lives in definitionOps.renumber", () => {
    expect(FROM_CANVAS_CODE).not.toMatch(/phase_index\s*:/)
    expect(FROM_CANVAS_CODE).not.toMatch(/phase_index\s*=[^=]/)
    // Controls: both regexes DO fire on a planted literal.
    expect("out.push({ phase_index: i })").toMatch(/phase_index\s*:/)
    expect("phase.phase_index = i").toMatch(/phase_index\s*=[^=]/)
  })

  it("fromCanvas never reads a position — layout is never authored data (Pitfall 3)", () => {
    expect(FROM_CANVAS_CODE).not.toMatch(/\.position\b/)
    // Control: the regex DOES fire on a planted literal.
    expect("const x = node.position.x").toMatch(/\.position\b/)
  })
})

/**
 * Phase 184-05 Task 1 — the four BEHAVIOURAL pins the source guards above cannot
 * express. These are targeted assertions on named shapes; the full R2 property (the
 * committed corpus dump × the generated shapes, swept) lives in
 * `canvasModel.roundtrip.test.ts` and is a different kind of claim.
 *
 * THE TRAP, stated once so nobody files it as a defect: `toCanvas` SORTS its input by
 * `(phase_index, slug)` at `canvasModel.ts:220-223`. The round trip therefore returns
 * the SORTED source, not the caller's array order, and every comparison below is
 * against the sorted source.
 */
describe("canvasModel — fromCanvas behaviour (the Task-1 acceptance pins)", () => {
  /** The exact comparator `toCanvas` applies — index first, slug as the tiebreak. */
  const byIndexThenSlug = (a: PhaseSpecJSON, b: PhaseSpecJSON) =>
    a.phase_index - b.phase_index || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)

  it("does NOT renumber — the shipped [0,1,3] gap survives the round trip", () => {
    const round = fromCanvas(toCanvas(indexGap).nodes, indexGap)
    expect(round.map((p) => p.phase_index)).toEqual([0, 1, 3])
  })

  it("returns the SAME objects (toBe), not copies — the R2 carry-through claim", () => {
    const expected = [...evalCoverage].sort(byIndexThenSlug)
    const round = fromCanvas(toCanvas(evalCoverage).nodes, evalCoverage)
    expect(round).toHaveLength(expected.length)
    round.forEach((phase, i) => expect(phase).toBe(expected[i]))
  })

  it("drops the end cap and every non-phase node, and nothing else", () => {
    const { nodes } = toCanvas(indexGap)
    expect(nodes.length).toBeGreaterThan(indexGap.length) // the ○ end cap is in there
    expect(fromCanvas(nodes, indexGap)).toHaveLength(indexGap.length)
  })

  it("fails SAFE on duplicate slugs — hands the source back, drops no phase", () => {
    const duplicateSlugs: PhaseSpecJSON[] = [
      { slug: "step", phase_index: 0, config: { phase_type: "llm_agent" } },
      { slug: "step", phase_index: 1, config: { phase_type: "llm_single" } },
    ]
    const round = fromCanvas(toCanvas(duplicateSlugs).nodes, duplicateSlugs)
    expect(round).toHaveLength(duplicateSlugs.length)
    round.forEach((phase, i) => expect(phase).toBe(duplicateSlugs[i]))
  })
})

/**
 * Phase 187-08 (VOCAB-01 / D-187-05) — the injected name context does not cost purity.
 *
 * The threat the plan names (T-187-08-01) is that a module which needs id→name maps
 * grows a way to GO AND GET THEM. The control is structural rather than reviewed: the
 * maps arrive as an OPTIONAL option with a frozen module-scope default, and the source
 * guards below say so in a form that fails a test if anyone changes their mind.
 */
describe("canvasModel — the injected name context stays PURE (Phase 187 / D-187-05)", () => {
  /** All three members populated, so no branch of the derivation is left unexercised. */
  const NAME_CTX = {
    skillNames: { "3f2b8c40-1111-4a2b-9c3d-000000000001": "pricing policy check" },
    folderNames: { "9a1e77d2-2222-4b3c-8d4e-000000000002": "Supplier Contracts" },
    templateFilename: "Renewal Summary.pptx",
  }

  it.each(ALL_FIXTURES)(
    "$name: the input is deep-equal to its pre-call clone WITH a name context",
    ({ phases }) => {
      const before = clone(phases)
      toCanvas(phases, { nameContext: NAME_CTX })
      expect(phases).toEqual(before)
    },
  )

  it.each(ALL_FIXTURES)(
    "$name: no position/x/y/layout key reaches the INPUT with a name context",
    ({ phases }) => {
      toCanvas(phases, { nameContext: NAME_CTX })
      expect(forbiddenKeysIn(phases)).toEqual([])
    },
  )

  it.each(ALL_FIXTURES)(
    "$name projects byte-identically across two calls with the SAME context",
    ({ phases }) => {
      expect(JSON.stringify(toCanvas(phases, { nameContext: NAME_CTX }))).toBe(
        JSON.stringify(toCanvas(phases, { nameContext: NAME_CTX })),
      )
    },
  )

  it.each(ALL_FIXTURES)(
    "$name: omitting the option twice projects byte-identically (the frozen default)",
    ({ phases }) => {
      expect(JSON.stringify(toCanvas(phases))).toBe(JSON.stringify(toCanvas(phases, {})))
    },
  )

  // ── The source guards. The identity of the omitted default is not observable from
  //    outside the module (nothing returns it), so it is pinned where it is declared.

  it("declares the frozen module-scope empty default, `NO_KB_TOOLS`'s idiom verbatim", () => {
    expect(canvasModelSource).toMatch(
      /const NO_NAME_CONTEXT:\s*NameContext\s*=\s*Object\.freeze\(\{\}\)/,
    )
    // Control: the regex does NOT match a per-call fresh object.
    expect("const NO_NAME_CONTEXT: NameContext = {}").not.toMatch(
      /const NO_NAME_CONTEXT:\s*NameContext\s*=\s*Object\.freeze\(\{\}\)/,
    )
  })

  it("resolves an omitted option to that same default rather than to a fresh `{}`", () => {
    const code = stripComments(canvasModelSource)
    expect(code).toMatch(/options\.nameContext\s*\?\?\s*NO_NAME_CONTEXT/)
    expect(code).not.toMatch(/options\.nameContext\s*\?\?\s*\{\}/)
  })

  it("hands the context to nodeTitle ONLY — technicalTitle still takes one argument", () => {
    const code = stripComments(canvasModelSource)
    expect(code).toMatch(/nodeTitle\(phase,\s*nameContext\)/)
    expect(code).toMatch(/technicalTitle\(phase\)/)
    // The reveal-ON form is the SLUG and must stay the slug: a name context there would
    // put a derived face behind the technical toggle, which is the opposite of its job.
    expect(code).not.toMatch(/technicalTitle\(phase\s*,/)
  })

  it("still fetches nothing — the maps are passed IN, never gone and got (T-187-08-01)", () => {
    expect(canvasModelSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    expect(canvasModelSource).not.toMatch(/fetch\(/)
    expect(canvasModelSource).not.toMatch(/useState|useEffect/)
  })
})
