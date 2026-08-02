/**
 * Phase 187-12 (VOCAB-01 / SC#5) — the two acceptance checks, swept over the corpus.
 *
 * SC#5 names its own corpus: the 3 curated starters + the 4 canonical seed shapes +
 * the PM pack. That corpus is a checked-in module — `__fixtures__/canvasFixtures.ts`,
 * transcribed from migrations, `conftest.py` and `seed-pm-pack.py` — so this file
 * extends the shipped sweep rather than transcribing a second copy of the same rows.
 *
 * WHAT A "FACE" IS (D-187-16). The face is the STRING `nodeTitle()` returns. That is a
 * decision, not a convenience: `PhaseSpineGraph.tsx:184` prints the raw `phase_type` in
 * a mono chip UNCONDITIONALLY — reveal-OFF included — and `:164`'s `aria-label` carries
 * it too. A DOM-scrape reading of check 1 therefore fails 100% on the spine today and
 * could only be made to pass by deleting shipped chrome. So every assertion below is a
 * PURE-FUNCTION assertion; no component is mounted and no DOM is queried.
 *
 * WHAT CHECK 2 MEANS (D-187-15). "No two steps render identical faces" is NARROWED to
 * "no two steps whose config is MATERIALLY DIFFERENT render identical faces". Measured:
 * `four_seed_defs()`'s `plan_execute_verify` has two bare `llm_single` steps (`plan`
 * and `verify`) whose only differing field is `prompt` — which no tier of the D-187-04
 * ladder reads, and which a tier MUST NOT read (a prompt is not a name; D-187-05's
 * never-fabricate floor). Two genuinely identical configs rendering identically is an
 * honest statement, not over-simplification. It is recorded as the documented
 * exception below, with its measured shape, rather than engineered away by editing the
 * seed — an acceptance bar that edits its own corpus has stopped measuring anything.
 *
 * HOW BIG THE CLAIM IS. The corpus is 15 fixtures / 36 phases, max 5 phases per
 * workflow, and the SPEC says so itself ("the SC#5 corpus is small … do not over-claim
 * it"). Read the result as "no jargon leaks and no materially-different pair collides
 * anywhere in the shipped corpus", not as a proof over all possible workflows.
 */
import { describe, it, expect, afterAll } from "vitest"

import {
  nodeTitle,
  PHASE_TYPE_SENTENCES,
  type NameContext,
  type PhaseSpecJSON,
} from "./phaseVocabulary"
import {
  ALL_FIXTURES,
  CORPUS_FOLDER_ID,
  CORPUS_SKILL_ID,
  PM_FOLDER_ID,
  type CanvasFixture,
} from "./__fixtures__/canvasFixtures"

// ── The injected lookups (D-187-05) ─────────────────────────────────────────────
// `skill_ref` and `folder_scope` store RESOLVED UUIDs and never names, so the derived
// tier cannot resolve them without maps. The maps live HERE, beside the ids, because
// the fixture module's charter is transcribed data and a display name is a lookup
// result rather than a definition field.

/** Skill id → display name. The name is sketch 148-C's own worked example ("Run the
 *  pricing policy check") and matches the map `canvasModel.purity.test.ts:283` already
 *  sweeps this corpus with, so the two suites cannot disagree about one id. */
const SKILL_NAMES: Readonly<Record<string, string>> = {
  [CORPUS_SKILL_ID]: "pricing policy check",
}

/** Folder id → display name. `CORPUS_FOLDER_ID`'s name is sketch 148-C's example, and
 *  matches `canvasModel.purity.test.ts:284`. `PM_FOLDER_ID`'s name is the checked-in
 *  constant `DEMO_FOLDER_NAME` — `scripts/seed-pm-pack.py:88`. */
const FOLDER_NAMES: Readonly<Record<string, string>> = {
  [CORPUS_FOLDER_ID]: "Supplier Contracts",
  [PM_FOLDER_ID]: "PM Demo Project (sample data)",
}

/** The deliverable type — the ONLY type whose template tier can fire
 *  (`phaseVocabulary.ts:457`, the gate inside `derivedFace`). Declared here because the
 *  module keeps its own copy private; the material key below has to ask the same
 *  question the derivation asks. */
const EMIT_PHASE_TYPE = "llm_emit"

/**
 * The name context a caller holding this definition would pass.
 *
 * The template filename is resolved by the SAME filter a real caller must apply —
 * `assets[]` where `kind === "template"` — rather than being pre-resolved into the
 * fixture. That filter is the piece 187-15 still owes at the page
 * (`WorkflowCanvas` receives `phases`, not the `WorkflowDefinition`), so performing it
 * here keeps the corpus honest about what is and is not yet reachable by a user.
 */
function contextFor(fixture: CanvasFixture): NameContext {
  const template = fixture.assets?.find((a) => a.kind === "template")
  return {
    folderNames: FOLDER_NAMES,
    skillNames: SKILL_NAMES,
    templateFilename: template?.filename,
  }
}

/** The six raw type tokens check 1 forbids — DERIVED from the shipped vocabulary, never
 *  re-typed, so a seventh phase type is covered the day it is added. */
const RAW_PHASE_TYPE_TOKENS = Object.keys(PHASE_TYPE_SENTENCES)

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Exact-token containment, not substring. A face may legitimately contain a word that
 * happens to spell a token as a fragment; only a whole-token appearance is a leak.
 * Case-insensitive, so "Check with you" would be caught for a phase slugged `check`.
 */
function containsToken(haystack: string, token: string): boolean {
  if (!token) return false
  return new RegExp(`\\b${escapeRegExp(token)}\\b`, "i").test(haystack)
}

/**
 * The material-config key (D-187-15) — `phase_type` plus exactly the fields the
 * derived tier READS: the bound skill, the SINGLE scoped folder (two or more ids can
 * never name a step, so they collapse to "none"), and whether the template tier
 * applies at all.
 *
 * Two phases with the same key are honestly the same kind of step, and are ALLOWED to
 * share a face. Two phases with different keys sharing a face is the
 * over-simplification SC#5 check 2 exists to catch. Deliberately excluded: `prompt`,
 * `model`, `max_steps`, `temperature` — D-187-07's list of fields that leave the face
 * alone, because a tier that read them would be fabricating a name.
 */
function materialConfigKey(phase: PhaseSpecJSON, templateFilename?: string): string {
  const config = phase.config ?? { phase_type: "" }
  const phaseType = typeof config.phase_type === "string" ? config.phase_type : ""
  const skillRef = typeof config.skill_ref === "string" ? config.skill_ref : null
  const scope = config.folder_scope
  const soleFolder =
    Array.isArray(scope) && scope.length === 1 && typeof scope[0] === "string"
      ? scope[0]
      : null
  const templateApplies = phaseType === EMIT_PHASE_TYPE && Boolean(templateFilename)
  return JSON.stringify([phaseType, skillRef, soleFolder, templateApplies])
}

/** Every (fixture, phase) pair check 1 actually visited — the DoS control (T-187-12-03)
 *  against a `describe.each` that quietly stops covering the corpus. */
const sweptPhases = new Set<string>()

const EXPECTED_PHASE_COUNT = ALL_FIXTURES.reduce((n, f) => n + f.phases.length, 0)

// ── The corpus self-check ───────────────────────────────────────────────────────

describe("SC#5 corpus — the sweep covers what it claims to", () => {
  it("registers at least the 15 fixtures / 36 phases the corpus ships today", () => {
    expect(ALL_FIXTURES.length).toBeGreaterThanOrEqual(15)
    expect(EXPECTED_PHASE_COUNT).toBeGreaterThanOrEqual(36)
  })

  it("carries every corpus member SC#5 names by name", () => {
    const names = ALL_FIXTURES.map((f) => f.name).join(" | ")
    for (const member of [
      // the 4 canonical seeds (migration 061, via `four_seed_defs()`)
      "research_summarize",
      "plan_execute_verify",
      "literature_review",
      "doc_qa_human",
      // the 3 curated starters (migration 094 — `list_starter_workflows`'s full filter)
      "risk-register",
      "weekly-status-report",
      "compliance-gap-report",
      // the PM pack (Phase 104)
      "pm-weekly-status-report",
      "pm-risk-register",
    ]) {
      expect(names).toContain(member)
    }
  })

  it("exercises all three lookup tiers somewhere in the corpus", () => {
    const phases = ALL_FIXTURES.flatMap((f) => f.phases)
    expect(phases.filter((p) => typeof p.config?.skill_ref === "string").length).toBeGreaterThan(0)
    expect(
      phases.filter((p) => Array.isArray(p.config?.folder_scope)).length,
    ).toBeGreaterThan(0)
    expect(
      ALL_FIXTURES.filter((f) => f.assets?.some((a) => a.kind === "template")).length,
    ).toBeGreaterThanOrEqual(3)
  })

  it("derives the six forbidden type tokens from the shipped vocabulary", () => {
    expect(RAW_PHASE_TYPE_TOKENS).toHaveLength(6)
    expect(RAW_PHASE_TYPE_TOKENS).toContain("llm_emit")
  })
})

// ── SC#5 check 1 — no jargon leak ───────────────────────────────────────────────

describe.each(ALL_FIXTURES)("SC#5 check 1 — $name", (fixture) => {
  it("no reveal-OFF face contains its own slug or a raw phase_type token", () => {
    const ctx = contextFor(fixture)
    const violations: string[] = []

    for (const phase of fixture.phases) {
      sweptPhases.add(`${fixture.name}::${phase.slug}`)
      const face = nodeTitle(phase, ctx)

      if (containsToken(face, phase.slug)) {
        violations.push(`slug "${phase.slug}" leaked into face "${face}"`)
      }
      for (const token of RAW_PHASE_TYPE_TOKENS) {
        if (containsToken(face, token)) {
          violations.push(`type token "${token}" leaked into ${phase.slug}'s face "${face}"`)
        }
      }
    }

    // The array carries the fixture name, the slug and the offending face, so a red
    // run is diagnosable from the diff without re-running anything.
    expect(violations).toEqual([])
  })
})

// ── SC#5 check 2 — no over-simplification (narrowed by D-187-15) ────────────────

/** Every pair of phases in one fixture whose material keys DIFFER but whose faces are
 *  identical. The empty array is the check. */
function check2Violations(
  fixture: CanvasFixture,
  face: (phase: PhaseSpecJSON, ctx: NameContext) => string,
): string[] {
  const ctx = contextFor(fixture)
  const templateFilename = ctx.templateFilename
  const rows = fixture.phases.map((p) => ({
    slug: p.slug,
    face: face(p, ctx),
    key: materialConfigKey(p, templateFilename),
  }))

  const out: string[] = []
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      if (rows[i].face === rows[j].face && rows[i].key !== rows[j].key) {
        out.push(`${rows[i].slug} + ${rows[j].slug} both render "${rows[i].face}"`)
      }
    }
  }
  return out
}

describe.each(ALL_FIXTURES)("SC#5 check 2 — $name", (fixture) => {
  it("no two MATERIALLY DIFFERENT steps render the same face", () => {
    expect(check2Violations(fixture, nodeTitle)).toEqual([])
  })
})

// ── The documented exception, with its measured shape ───────────────────────────

describe("SC#5 check 2 — the plan_execute_verify exception (D-187-15)", () => {
  const fixture = ALL_FIXTURES.find((f) => f.name.startsWith("plan_execute_verify"))
  if (!fixture) throw new Error("plan_execute_verify missing from ALL_FIXTURES")

  const phaseBySlug = (slug: string) => {
    const found = fixture.phases.find((p) => p.slug === slug)
    if (!found) throw new Error(`phase ${slug} missing from plan_execute_verify`)
    return found
  }

  /**
   * MEASURED SHAPE, transcribed from `backend/tests/conftest.py:867-890` (the seed
   * helper that declares itself the single source of truth for migration 061's
   * definition JSONB): `plan` and `verify` are both bare `llm_single`, and the ONLY
   * field that differs between them is `prompt`.
   *
   * Because they are migration-061 seeds rather than generator-authored rows, Req 2's
   * per-step `name` can never fill their top tier either. So this collision is
   * permanent, and it is honest: the two steps really are the same KIND of step.
   */
  it("plan and verify render one face, and their material keys are equal", () => {
    const ctx = contextFor(fixture)
    const plan = phaseBySlug("plan")
    const verify = phaseBySlug("verify")

    expect(nodeTitle(plan, ctx)).toBe(nodeTitle(verify, ctx))
    expect(materialConfigKey(plan, ctx.templateFilename)).toBe(
      materialConfigKey(verify, ctx.templateFilename),
    )
    // Recorded rather than asserted loosely: the shipped face is the llm_single
    // sentence, because every tier of the D-187-04 ladder correctly misses.
    expect(nodeTitle(plan, ctx)).toBe(PHASE_TYPE_SENTENCES.llm_single)
  })

  it("is therefore NOT a check-2 violation — the narrowing is what makes it pass", () => {
    expect(check2Violations(fixture, nodeTitle)).toEqual([])
  })

  it("was not edited to fit the test — the seed shape is still two bare llm_single steps", () => {
    for (const slug of ["plan", "verify"]) {
      const phase = phaseBySlug(slug)
      expect(phase.config.phase_type).toBe("llm_single")
      expect(phase.config.skill_ref).toBeUndefined()
      expect(phase.config.folder_scope).toBeUndefined()
      expect(phase.name ?? null).toBeNull()
    }
  })
})

// ── The falsification control: check 2 measured against HEAD's pre-187 resolution ──

/**
 * The SHIPPED PRE-187 two-tier ladder, reproduced exactly: stored name → type
 * sentence → raw type (`phaseVocabulary.ts:169` as it stood before 187-04 inserted the
 * derived tier). Nothing calls this in production; it exists so check 2 can be
 * observed FAILING, which is the only thing that distinguishes a gate from a comment.
 */
function preDerivedFace(phase: PhaseSpecJSON): string {
  const name = phase.name?.trim()
  if (name) return name
  const type = phase.config?.phase_type ?? ""
  return PHASE_TYPE_SENTENCES[type] ?? type
}

describe("SC#5 check 2 — the check bites (falsification control)", () => {
  const violatingMembers = (face: (p: PhaseSpecJSON, ctx: NameContext) => string) =>
    ALL_FIXTURES.filter((f) => check2Violations(f, face).length > 0).map((f) => f.name)

  it("FAILS on the pre-187 resolution for exactly the two same-type bound pairs", () => {
    const failing = violatingMembers((p) => preDerivedFace(p))
    expect(failing).toEqual([
      "branching (synthetic skip_to_phase)",
      "non-contiguous phase_index [0,1,3]",
    ])
  })

  it("PASSES on the shipped four-tier ladder for every corpus member", () => {
    expect(violatingMembers(nodeTitle)).toEqual([])
  })

  /**
   * The honest scope of the claim above, stated so nobody reads more into it. Both
   * members that fail pre-187 are the two hand-authored fixtures 187-12 extended, and
   * that is not a weakness of the check — it is a MEASUREMENT of the corpus: inside
   * every real transcribed workflow (the 4 seeds, the 3 starters, the PM pack), every
   * step that differs materially also differs in `phase_type`, and the six type
   * sentences are distinct. So the real corpus could never have exhibited the collision
   * at this scale, and a check that only swept it would have been vacuous.
   */
  it("records that no REAL transcribed member has a materially-different pair at all", () => {
    const realMembers = ALL_FIXTURES.filter((f) => !f.source.includes("hand-authored"))
    for (const fixture of realMembers) {
      const keys = fixture.phases.map((p) =>
        materialConfigKey(p, contextFor(fixture).templateFilename),
      )
      const faces = fixture.phases.map((p) => nodeTitle(p, contextFor(fixture)))
      // distinct keys ⇒ distinct faces, and no real member relies on the narrowing
      // except plan_execute_verify, whose duplicate KEY is what excuses it.
      expect(new Set(keys).size).toBe(new Set(faces).size)
    }
  })
})

// ── The derived tier actually resolved (the maps are wired, not inert) ──────────

describe("SC#5 — the two bound witnesses resolve through the derived tier", () => {
  const faceOf = (fixtureName: string, slug: string) => {
    const fixture = ALL_FIXTURES.find((f) => f.name.startsWith(fixtureName))
    if (!fixture) throw new Error(`fixture ${fixtureName} missing from ALL_FIXTURES`)
    const phase = fixture.phases.find((p) => p.slug === slug)
    if (!phase) throw new Error(`phase ${slug} missing from ${fixtureName}`)
    return nodeTitle(phase, contextFor(fixture))
  }

  it("names the bound skill, the scoped folder and the bound template", () => {
    expect(faceOf("branching", "assess")).toBe("Run the pricing policy check")
    expect(faceOf("non-contiguous", "stranded")).toBe("Search Supplier Contracts")
    expect(faceOf("pm-weekly-status-report", "retrieve")).toBe(
      "Search PM Demo Project (sample data)",
    )
    expect(faceOf("risk-register", "emit")).toBe("Fill risk-register.docx")
  })

  it("never leaks an id when a lookup misses — the never-fabricate floor", () => {
    const fixture = ALL_FIXTURES.find((f) => f.name.startsWith("branching"))!
    const assess = fixture.phases.find((p) => p.slug === "assess")!
    // an EMPTY context: the tier misses and the honest type sentence is what shows
    const face = nodeTitle(assess, {})
    expect(face).toBe(PHASE_TYPE_SENTENCES.llm_single)
    expect(face).not.toContain(CORPUS_SKILL_ID)
  })
})

// The sweep guard runs last, after every check-1 test has reported. Running a SUBSET
// of this file (`-t`) will trip it by design: the claim is corpus-wide coverage.
afterAll(() => {
  expect(
    sweptPhases.size,
    "check 1 must visit every phase of every fixture — a describe.each that silently covers nothing is not a gate",
  ).toBe(EXPECTED_PHASE_COUNT)
})
