/**
 * Phase 193.1-09 Task 1 (AUTH-03 / SC#3 — D-10 / D-20) — the three-bucket classifier.
 *
 * ── THE FIXTURE'S PROVENANCE IS THE FIRST THING THIS FILE PROVES ──────────────────────────
 * `193.1-RESEARCH` states the warning sign in one line: *a plan whose reconcile test fixture
 * resembles sketch 167's is the warning sign.* That sketch's fixture declares two phase types
 * that are not among the seven the backend actually accepts, and a config key that is not on
 * any of the seven schemas. So the fixtures below are NOT drawn from it. They are trimmed
 * copies of two REAL rows read out of the live local `workflow_definitions` table at
 * execution time, and each one names the row it came from:
 *
 *   • `REAL_DEGENERATE_DEFINITION` ← `compliance-gap-report-dt5p8p` (a template-binding row)
 *   • `REAL_RUN_INPUT_DEFINITION`  ← `kb-cited-answer-c7e884e0` (1 of only 3 rows in the whole
 *     corpus with a non-empty definition-level input list)
 *
 * ⚠ AND THE MEASUREMENT THAT DECIDES THE COPY IS RE-DERIVED, NOT INHERITED. Read at execution
 * time over all 223 rows: 74 bind a template; across all 74, phase slugs matching any of the
 * eight known placeholder names → **0**; rows with a non-empty definition-level input list →
 * **3**, every one of them keyed `question`. Real slugs are verbs (`retrieve` ×70, `emit` ×69);
 * real placeholders are nouns. **So the degenerate case — every field named nowhere — is the
 * COMMON case, and it is written FIRST in this file for that reason.**
 *
 * ⚠ ONE TRAP RE-ENCOUNTERED WHILE MEASURING, RECORDED SO THE NEXT READER DOES NOT REPEAT IT:
 * 194 of the 223 `definition` values are stored as JSON *string* scalars, not objects, so a
 * naive `jsonb` path query sees only 29 rows and reports 11 template-binding definitions and
 * ZERO rows with inputs. Decoding the scalar first reproduces the planned figures exactly.
 * The plan's numbers were right; the naive query is what is wrong.
 */
import { describe, it, expect } from "vitest"

// The module SOURCE via Vite's `?raw` loader — the shipped house idiom for a
// machine-checkable claim about a file's own text.
import bucketsSource from "./templateNameBuckets?raw"
import {
  classifyTemplateNames,
  ENGINE_KNOWN_RUN_INPUT_KEYS,
  type NameCheckDefinition,
  type TemplateNameClassification,
} from "./templateNameBuckets"

// ══════════════════════════════════════════════════════════════════════════════════════
// The fixtures — REAL definition shapes, each named to its source row
// ══════════════════════════════════════════════════════════════════════════════════════

/** The seven phase types the backend actually accepts. Spelled here so the fixtures below
 *  can be asserted against the real set rather than against a plausible-looking one. */
const REAL_PHASE_TYPES = [
  "programmatic",
  "llm_single",
  "llm_agent",
  "llm_batch_agents",
  "llm_human_input",
  "llm_emit",
  "external_action",
] as const

/**
 * ← live row `compliance-gap-report-dt5p8p`, trimmed to the fields this classifier reads.
 * Two phases, verb slugs, real types, `inputs` genuinely `null` — which is what 220 of the
 * 223 rows carry.
 */
const REAL_DEGENERATE_DEFINITION: NameCheckDefinition = {
  slug: "compliance-gap-report-dt5p8p",
  version: 1,
  status: "draft",
  inputs: null,
  phases: [
    { slug: "retrieve", phase_index: 0, config: { phase_type: "llm_agent" } },
    { slug: "emit", phase_index: 1, config: { phase_type: "llm_emit", emitter: "render_template" } },
  ],
}

/**
 * ← live row `kb-cited-answer-c7e884e0`, one of the only three rows in the corpus with a
 * non-empty definition-level input list. Its single key really is `question`.
 */
const REAL_RUN_INPUT_DEFINITION: NameCheckDefinition = {
  slug: "kb-cited-answer-c7e884e0",
  version: 1,
  status: "draft",
  inputs: [
    {
      key: "question",
      label: "Question to answer",
      type: "text",
      required: true,
      source: "user",
      enum_options: [],
      folder_scope: null,
    },
  ],
  phases: [
    { slug: "gather-evidence", phase_index: 0, config: { phase_type: "llm_agent" } },
    { slug: "write-answer", phase_index: 1, config: { phase_type: "llm_single" } },
  ],
}

/**
 * The eight placeholder names sketch 167 PARSED out of a real `.docx` (its audit line 3).
 * They are the realistic input to this classifier, and against the fixture above not one of
 * them matches anything.
 */
const EIGHT_REAL_PLACEHOLDERS = [
  "accomplishments",
  "milestones",
  "overall_rag_status",
  "planned_next",
  "project_name",
  "reporting_period",
  "risks_blockers",
  "summary",
] as const

/** Sum + disjointness, as a reusable property rather than a per-case assertion. */
function assertExactlyOnce(result: TemplateNameClassification, fields: readonly string[]): void {
  expect(result.produced.length + result.runInput.length + result.nowhere.length).toBe(fields.length)
  const union = [...result.produced, ...result.runInput, ...result.nowhere]
  expect([...union].sort()).toEqual([...fields].sort())
  // …and no name is in two DIFFERENT buckets (a duplicate input lands twice in ONE bucket,
  // which is honest; the same name in two buckets is not).
  for (const [a, b] of [
    [result.produced, result.runInput],
    [result.produced, result.nowhere],
    [result.runInput, result.nowhere],
  ] as const) {
    expect(a.filter((n) => b.includes(n))).toEqual([])
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 1 — THE DEGENERATE CASE, FIRST, BECAUSE IT IS THE COMMON ONE
// ══════════════════════════════════════════════════════════════════════════════════════

describe("classifyTemplateNames — the degenerate case is the COMMON case (D-20)", () => {
  it("a REAL template-binding definition classifies all eight real placeholders as `nowhere`", () => {
    const result = classifyTemplateNames(EIGHT_REAL_PLACEHOLDERS, REAL_DEGENERATE_DEFINITION)
    expect(result.nowhere).toEqual([...EIGHT_REAL_PLACEHOLDERS])
    expect(result.produced).toEqual([])
    expect(result.runInput).toEqual([])
    assertExactlyOnce(result, EIGHT_REAL_PLACEHOLDERS)
  })

  it("…and returns without throwing when the definition carries a null input list", () => {
    expect(() => classifyTemplateNames(EIGHT_REAL_PLACEHOLDERS, REAL_DEGENERATE_DEFINITION)).not.toThrow()
  })

  it("THE FIXTURE IS REAL — its phase types are among the seven and its slugs are verbs", () => {
    // Non-vacuity for the whole file: a fixture whose types are invented would make every
    // case above pass while measuring nothing the backend would accept.
    const phases = REAL_DEGENERATE_DEFINITION.phases as Array<{ slug: string; config: { phase_type: string } }>
    for (const p of phases) {
      expect(REAL_PHASE_TYPES).toContain(p.config.phase_type)
    }
    expect(phases.map((p) => p.slug)).toEqual(["retrieve", "emit"])
    // …and none of the eight placeholder names is a slug, which is the measured 0-of-74 fact
    // this whole degenerate-first design rests on.
    for (const name of EIGHT_REAL_PLACEHOLDERS) {
      expect(phases.map((p) => p.slug)).not.toContain(name)
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 2 — THE THREE SOURCES THAT EXIST
// ══════════════════════════════════════════════════════════════════════════════════════

describe("classifyTemplateNames — the buckets, from sources that exist (D-20)", () => {
  it("a name equal to a phase slug is `produced`", () => {
    const fields = ["retrieve", "summary"]
    const result = classifyTemplateNames(fields, REAL_DEGENERATE_DEFINITION)
    expect(result.produced).toEqual(["retrieve"])
    expect(result.nowhere).toEqual(["summary"])
    assertExactlyOnce(result, fields)
  })

  it("a name equal to a declared definition-level input key is `runInput` — with REAL data", () => {
    const fields = ["question", "summary"]
    const result = classifyTemplateNames(fields, REAL_RUN_INPUT_DEFINITION)
    expect(result.runInput).toEqual(["question"])
    expect(result.produced).toEqual([])
    expect(result.nowhere).toEqual(["summary"])
    assertExactlyOnce(result, fields)
  })

  it("a name equal to an engine-known run-input key is `runInput` even with no declared inputs", () => {
    const fields = [...ENGINE_KNOWN_RUN_INPUT_KEYS, "summary"]
    const result = classifyTemplateNames(fields, REAL_DEGENERATE_DEFINITION)
    expect(result.runInput).toEqual([...ENGINE_KNOWN_RUN_INPUT_KEYS])
    expect(result.nowhere).toEqual(["summary"])
    assertExactlyOnce(result, fields)
  })

  it("the engine-known key set is exactly the two the engine knows", () => {
    expect([...ENGINE_KNOWN_RUN_INPUT_KEYS].sort()).toEqual(["kickoff_prompt", "topic"])
  })

  it("PRECEDENCE — a name that is BOTH a run input and a slug is `runInput`", () => {
    // The run-input bucket is the false-alarm guard, and the engine's own knowledge outranks
    // a slug coincidence: a field the run supplies is not a gap however a step happens to be
    // named.
    const definition: NameCheckDefinition = {
      inputs: [{ key: "topic" }],
      phases: [{ slug: "topic", phase_index: 0, config: { phase_type: "llm_single" } }],
    }
    const result = classifyTemplateNames(["topic"], definition)
    expect(result.runInput).toEqual(["topic"])
    expect(result.produced).toEqual([])
    assertExactlyOnce(result, ["topic"])
  })

  it("MATCHING IS TRIMMED AND CASE-INSENSITIVE — `Project_Name` matches `project_name`", () => {
    const definition: NameCheckDefinition = {
      inputs: [{ key: "  Reporting_Period " }],
      phases: [{ slug: "project_name", phase_index: 0, config: { phase_type: "llm_single" } }],
    }
    const result = classifyTemplateNames(["Project_Name", " reporting_period"], definition)
    expect(result.produced).toEqual(["Project_Name"])
    expect(result.runInput).toEqual([" reporting_period"])
    expect(result.nowhere).toEqual([])
  })

  it("…and the field is returned EXACTLY AS GIVEN — the document's spelling is the answer", () => {
    const definition: NameCheckDefinition = {
      phases: [{ slug: "summary", phase_index: 0, config: { phase_type: "llm_single" } }],
    }
    expect(classifyTemplateNames([" SUMMARY "], definition).produced).toEqual([" SUMMARY "])
  })

  it("ORDER IS PRESERVED WITHIN EACH BUCKET — the order is part of the answer", () => {
    const definition: NameCheckDefinition = {
      inputs: [{ key: "topic" }],
      phases: [
        { slug: "emit", phase_index: 1, config: { phase_type: "llm_emit" } },
        { slug: "retrieve", phase_index: 0, config: { phase_type: "llm_agent" } },
      ],
    }
    const fields = ["emit", "zeta", "topic", "retrieve", "alpha"]
    const result = classifyTemplateNames(fields, definition)
    // NOT the phase order, NOT sorted — the order the document asked in.
    expect(result.produced).toEqual(["emit", "retrieve"])
    expect(result.nowhere).toEqual(["zeta", "alpha"])
    expect(result.runInput).toEqual(["topic"])
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 3 — EXACTLY ONCE, AS A PROPERTY
// ══════════════════════════════════════════════════════════════════════════════════════

describe("classifyTemplateNames — every field classified EXACTLY ONCE", () => {
  const CASES: Array<[string, readonly string[], NameCheckDefinition]> = [
    ["the degenerate real fixture", EIGHT_REAL_PLACEHOLDERS, REAL_DEGENERATE_DEFINITION],
    ["the real run-input fixture", ["question", ...EIGHT_REAL_PLACEHOLDERS], REAL_RUN_INPUT_DEFINITION],
    ["all three buckets non-empty", ["retrieve", "topic", "summary"], REAL_DEGENERATE_DEFINITION],
    ["a duplicated field name", ["summary", "summary", "retrieve"], REAL_DEGENERATE_DEFINITION],
    ["no fields at all", [], REAL_DEGENERATE_DEFINITION],
  ]

  it.each(CASES)("%s: the three lengths sum to the input and no name spans two buckets", (_label, fields, definition) => {
    assertExactlyOnce(classifyTemplateNames(fields, definition), fields)
  })

  it("a duplicated field lands twice in ONE bucket, never once in two", () => {
    const result = classifyTemplateNames(["summary", "summary"], REAL_DEGENERATE_DEFINITION)
    expect(result.nowhere).toEqual(["summary", "summary"])
    expect(result.produced).toEqual([])
    expect(result.runInput).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 4 — THE SIX DEFENSIVE-READ SHAPES (the shipped untyped-JSONB posture)
// ══════════════════════════════════════════════════════════════════════════════════════

describe("classifyTemplateNames — untyped JSONB is read defensively, never spread", () => {
  // The three phase shapes and the three input shapes, each proved to behave as EMPTY rather
  // than to throw. `BuilderDefinition` carries an index signature, so both of these arrive
  // PRESENT BUT UNTYPED at runtime and a non-array is a real possibility, not a hypothetical.
  const PHASE_SHAPES: Array<[string, NameCheckDefinition]> = [
    ["phases absent", { inputs: null }],
    ["phases not an array", { phases: "retrieve" as unknown, inputs: null }],
    ["phase entries without a string slug", { phases: [{ phase_index: 0 }, { slug: 7 }, null], inputs: null }],
  ]
  const INPUT_SHAPES: Array<[string, NameCheckDefinition]> = [
    ["inputs absent", { phases: [] }],
    ["inputs not an array", { phases: [], inputs: { key: "question" } as unknown }],
    ["input entries without a string key", { phases: [], inputs: [{ label: "x" }, { key: 7 }, null] }],
  ]

  it.each([...PHASE_SHAPES, ...INPUT_SHAPES])("%s behaves as empty and does not throw", (_label, definition) => {
    const fields = ["retrieve", "question"]
    let result: TemplateNameClassification | null = null
    expect(() => {
      result = classifyTemplateNames(fields, definition)
    }).not.toThrow()
    // Everything falls through to `nowhere` — EXCEPT the two engine-known keys, which are
    // knowledge about the engine and not about this definition.
    expect(result!.nowhere).toEqual(["retrieve", "question"])
    assertExactlyOnce(result!, fields)
  })

  it("a null or undefined definition behaves as empty", () => {
    for (const definition of [null, undefined]) {
      const result = classifyTemplateNames(["retrieve"], definition)
      expect(result.nowhere).toEqual(["retrieve"])
      assertExactlyOnce(result, ["retrieve"])
    }
  })

  it("…and the engine-known keys still resolve when EVERYTHING else is unreadable", () => {
    // The one thing that must survive a garbage definition: the two keys the engine itself
    // knows. Without this the false-alarm guard would silently disappear exactly when the
    // definition is least trustworthy.
    const result = classifyTemplateNames(["topic"], { phases: 3 as unknown, inputs: 4 as unknown })
    expect(result.runInput).toEqual(["topic"])
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 5 — THE SOURCE FENCE: the two config keys this module may NEVER read
// ══════════════════════════════════════════════════════════════════════════════════════

// ⚠ ASSEMBLED FROM PARTS, this project's shipped idiom for a guard that must not satisfy
// itself. The module's own acceptance criterion is `grep -c <either token>` → 0 over
// `templateNameBuckets.ts`; a fence file spelling either token whole would make a
// subtree-wide grep read a hit that is the GUARD rather than a violation.
const DEAD_OUTPUT_KEY = ["output", "_keys"].join("")
const WRONG_INPUT_KEY = ["input", "_keys"].join("")

describe("templateNameBuckets — the two sources that do not exist are named NOWHERE", () => {
  it("NON-VACUITY — the ?raw source really loaded and is the module it claims to be", () => {
    // FIRST, BEFORE ANY NEGATIVE. A `?raw` import of a moved or renamed module yields the
    // EMPTY STRING in some resolvers rather than throwing, and `"".includes(x)` is false for
    // every x — so the negatives below would pass while defending nothing.
    expect(bucketsSource.length).toBeGreaterThan(1000)
    expect(bucketsSource).toMatch(/export function classifyTemplateNames\(/)
    expect(bucketsSource).toMatch(/export const ENGINE_KNOWN_RUN_INPUT_KEYS/)
  })

  it("POSITIVE CONTROL — the detector catches each token in a synthetic source", () => {
    expect(`const x = p.config.${DEAD_OUTPUT_KEY}`).toContain(DEAD_OUTPUT_KEY)
    expect(`const x = p.config.${WRONG_INPUT_KEY}`).toContain(WRONG_INPUT_KEY)
    expect("const x = p.slug").not.toContain(DEAD_OUTPUT_KEY)
    expect("const x = p.slug").not.toContain(WRONG_INPUT_KEY)
  })

  it("THE REAL SOURCE names neither, in code OR in prose", () => {
    // One is not a schema field at all — every phase config forbids extra keys, so writing it
    // raises at every save / validate / publish boundary, and 0 of 223 live rows carry it. The
    // other exists on exactly one of the seven config types and means keys a STEP reads from
    // prior phases — an input to a step, not a run input. A module that read either would be
    // reading an empty list forever, or answering a different question.
    expect(bucketsSource).not.toContain(DEAD_OUTPUT_KEY)
    expect(bucketsSource).not.toContain(WRONG_INPUT_KEY)
  })

  it("…and imports no component and no network client", () => {
    expect(bucketsSource).not.toMatch(/from\s+["'][^"']*@\/lib\/api["']/)
    expect(bucketsSource).not.toMatch(/from\s+["']react["']/)
    expect(bucketsSource).not.toMatch(/from\s+["'][^"']*\.tsx["']/)
  })
})
