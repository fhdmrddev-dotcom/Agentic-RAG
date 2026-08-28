/**
 * Phase 192.2-10 Task 2 (WR-02) — THE LOOKALIKE RUN-FIELD FENCE OVER `lib/api.ts`.
 *
 * `frontend/src/lib/api.ts` declares THREE fields spelled `last_run_status?: string | null` —
 * on `ThreadWorkflowState`, on `PublishedWorkflow` and on `WorkflowDraftRow`. They describe
 * different tables at different scopes, and **a swap between any two of them TYPECHECKS**,
 * exactly as the file's own warning twelve lines above the collision predicted. It also
 * carries ONE database column under TWO wire names: `workflow_runs.created_at` arrives as
 * `last_run_created_at` on the thread type and as `last_run_at` on the two library types.
 *
 * DEC-10-B decided the fix is a CROSS-REFERENCE, not a rename: `api.ts` is the hottest file in
 * this repository and Phase 197 declined its extraction seam on the recorded basis that its
 * change was type-only. So each of the three declarations now carries a docblock naming the
 * other two BY TYPE NAME (never by line number, which rots), and each embeds one marker token.
 * This suite is what keeps that true.
 *
 * ⚠ WHAT MAKES THIS SUITE GO RED, stated so a future reader does not have to infer it:
 *   · a FOURTH `last_run_status?: string | null` declaration added anywhere in `api.ts`
 *     without its cross-reference docblock and marker;
 *   · a marker DELETED from one of the three docblocks (i.e. the paragraph was rewritten away);
 *   · a cross-reference block that stops naming all three types.
 *
 * ⚠ THE DECLARATION DETECTOR IS LINE-ANCHORED, AND THAT IS LOAD-BEARING RATHER THAN TIDY.
 * Those three docblocks now DISCUSS the field by name, so a naive whole-file count of the
 * identifier reads 18 where the truth is 3 — the fence would be counting the prose that
 * documents the rule, and would satisfy itself. That is the 187-24 trap, which this project has
 * hit four times in one subtree. A JSDoc body line always begins with `*`, so an anchored match
 * on a line whose ONLY content is the declaration structurally cannot see a comment.
 *
 * ⚠ EVERY COUNT IS ASSERTED TO A RECORDED NUMBER, NEVER A LOWER BOUND. And every detector is
 * run over a synthetic source carrying the violation (a planted FOURTH declaration with only
 * THREE markers), because a fence with a broken matcher passes vacuously and looks exactly like
 * a fence that holds.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Phase 214 plan 16 — the launch-inputs cases below call the REAL `postMessage` against a
// stubbed `fetch`, so `getAuthHeaders` needs a session. Mock only Supabase auth; nothing
// else in the client is faked, because the property under test is the REQUEST BODY the
// shipped function builds. (Pattern: `lib/api.workflows.test.ts`.)
const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }))
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: mockGetSession } },
}))

import { API_SOURCE as apiSource } from "@/lib/apiSource.testutil"
import { postMessage } from "@/lib/api"

/** The single fixed literal embedded in each of the three cross-reference docblocks. */
const MARKER = "WR-02-LOOKALIKE-LAST-RUN-STATUS"

/** The three types that carry a `last_run_status`. Each cross-reference block names all three. */
const TYPES = ["ThreadWorkflowState", "PublishedWorkflow", "WorkflowDraftRow"] as const

/** The recorded truth this fence pins. Both are NUMBERS on purpose, never bounds. */
const EXPECTED_DECLARATIONS = 3
const EXPECTED_MARKERS = 3

/**
 * THE DECLARATION DETECTOR — a whole line whose only content is the declaration.
 * A JSDoc body line starts with `*` and a line comment starts with a slash, so neither can match.
 */
const declarationsIn = (src: string): string[] =>
  src.match(/^[ \t]*last_run_status\?: string \| null[ \t]*$/gm) ?? []

/** Every JSDoc block in a source, whole. */
const docblocksIn = (src: string): string[] => src.match(/\/\*\*[\s\S]*?\*\//g) ?? []

const markerCount = (src: string): number => src.split(MARKER).length - 1

/** A newline without writing an escape into a source this suite also greps. */
const NL = String.fromCharCode(10)

describe("WR-02 — the three lookalike last_run_status fields, and the marker that binds them", () => {
  it("NON-VACUITY — the raw import actually delivered api.ts, before anything is counted", () => {
    // ⚠ A `?raw` import that resolves to the EMPTY STRING makes every count below read 0 and
    // every negative assertion pass. This project measured exactly that failure for CSS under
    // vitest (192.2-07), so the length and three known anchors are asserted FIRST, never last.
    expect(typeof apiSource).toBe("string")
    expect(apiSource.length).toBeGreaterThan(100_000)
    expect(apiSource).toContain("interface ThreadWorkflowState")
    expect(apiSource).toContain("interface PublishedWorkflow")
    expect(apiSource).toContain("interface WorkflowDraftRow")
  })

  it("there are EXACTLY three declarations — a recorded number, not a lower bound", () => {
    expect(declarationsIn(apiSource)).toHaveLength(EXPECTED_DECLARATIONS)
  })

  it("the marker appears EXACTLY three times — one per declaration", () => {
    expect(markerCount(apiSource)).toBe(EXPECTED_MARKERS)
  })

  it("declarations and markers AGREE — the invariant a silent fourth field would break", () => {
    expect(declarationsIn(apiSource)).toHaveLength(markerCount(apiSource))
  })

  it("⚠ THE TRAP, MEASURED — an unanchored count reads far more than three", () => {
    // Recorded rather than merely warned about: the docblocks discuss the field by name, so an
    // unanchored count is wrong by a large factor and rises with every future paragraph. If it
    // changes because prose was edited, the ANCHORED count is unaffected — that is the whole
    // point, and this case exists to keep the contrast visible rather than assumed.
    const naive = apiSource.split("last_run_status").length - 1
    expect(naive).toBeGreaterThan(EXPECTED_DECLARATIONS)
    expect(declarationsIn(apiSource)).toHaveLength(EXPECTED_DECLARATIONS)
  })

  it("each of the three cross-reference blocks names ALL THREE types, by TYPE NAME", () => {
    const blocks = docblocksIn(apiSource).filter((b) => b.includes(MARKER))
    expect(blocks).toHaveLength(EXPECTED_MARKERS)
    for (const block of blocks) {
      for (const type of TYPES) expect(block).toContain(type)
    }
  })

  it("each block also states that the two TIMESTAMP names are one column", () => {
    // The other half of WR-02. A cross-reference that names the status fields but leaves the
    // `last_run_created_at` / `last_run_at` divergence unsaid answers only half the question.
    const blocks = docblocksIn(apiSource).filter((b) => b.includes(MARKER))
    expect(blocks).toHaveLength(EXPECTED_MARKERS)
    for (const block of blocks) {
      expect(block).toContain("last_run_created_at")
      expect(block).toContain("last_run_at")
      expect(block).toContain("workflow_runs.created_at")
    }
  })
})

describe("WR-02 — SYNTHETIC POSITIVE CONTROLS (the detectors, run over a planted violation)", () => {
  /**
   * A source in the shape `api.ts` would take if a FOURTH interface gained the field without its
   * cross-reference: FOUR declarations, THREE markers. It also plants the two decoys the real
   * file now contains — the field named inside a JSDoc line, and inside a line comment.
   */
  const PLANTED = [
    "export interface A {",
    "  /** " + MARKER + " — mentions last_run_status?: string | null in PROSE, and must not count.",
    "   *  Names ThreadWorkflowState, PublishedWorkflow and WorkflowDraftRow. */",
    "  last_run_status?: string | null",
    "}",
    "export interface B {",
    "  /** " + MARKER + " */",
    "  last_run_status?: string | null",
    "}",
    "export interface C {",
    "  /** " + MARKER + " */",
    "  last_run_status?: string | null",
    "}",
    "export interface D {",
    "  // the fourth, added with no cross-reference: last_run_status?: string | null",
    "  last_run_status?: string | null",
    "}",
  ].join(NL)

  it("the DECLARATION detector counts 4 in the planted source — the prose mentions excluded", () => {
    // FOUR real declarations. The JSDoc mention and the line-comment mention are NOT counted: an
    // unanchored matcher would read 6 here and the mismatch case below would still pass, for the
    // wrong reason. This is the case that proves the anchor is doing work.
    expect(declarationsIn(PLANTED)).toHaveLength(4)
  })

  it("the MARKER detector counts 3 in the planted source", () => {
    expect(markerCount(PLANTED)).toBe(3)
  })

  it("⚠ THE CONTROL — the agreement invariant REPORTS THE MISMATCH on the planted source", () => {
    // The exact assertion made against the real file, run against a source that violates it.
    // It must FAIL there, so the honest way to state it here is that the two disagree by one.
    expect(declarationsIn(PLANTED).length).not.toBe(markerCount(PLANTED))
    expect(declarationsIn(PLANTED).length - markerCount(PLANTED)).toBe(1)
  })

  it("a DELETED marker is caught too — the other direction of the same fence", () => {
    const rewritten = PLANTED.replace(
      "/** " + MARKER + " */",
      "/** (this paragraph was rewritten away) */",
    )
    expect(markerCount(rewritten)).toBe(2)
    expect(declarationsIn(rewritten).length).not.toBe(markerCount(rewritten))
  })

  it("a block that stops naming all three types is caught", () => {
    const blocks = docblocksIn(PLANTED).filter((b) => b.includes(MARKER))
    expect(blocks).toHaveLength(3)
    // Block 0 names all three; blocks 1 and 2 name none — so the per-block naming assertion made
    // against the real file provably discriminates rather than passing on anything at all.
    const naming = blocks.map((b) => TYPES.filter((t) => b.includes(t)).length)
    expect(naming).toEqual([3, 0, 0])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Phase 214 plan 02 (STEP-05 / D-214-23) — THE ABSENT-vs-EMPTY COLLAPSE, FENCED.
//
// Three new nullable facts reach the client this phase: `failureReason` (why a step failed),
// and — one wave over — `allowed_connection_ids` (which connections a generated workflow may
// bind). On BOTH, an ABSENT value and an EMPTY one are DIFFERENT FACTS, and on both the
// collapse is one character of convenience:
//
//   · `failureReason ?? ""`  turns NOT RECORDED into RECORDED-AS-NOTHING, which costs
//     `PhaseCard`'s `reason_unknown` sentinel its meaning. That sentinel firing on a failure
//     whose reason was known IS `BUG-260826-05`.
//   · `allowed_connection_ids ?? []` turns "no preference" into "forbid every external step";
//     `|| undefined` turns "forbid everything" into "no preference". Both are silently wrong
//     decisions on an OUTBOUND path.
//
// This is the same family as `WorkflowRunPhase.step_count`'s `0`-vs-`null` rule, which this
// api module has documented since Phase 200 — so the rule is not new, only its third instance.
//
// ⚠ EVERY NEEDLE IS ASSEMBLED AT RUNTIME. The sweep reads `/src/**` INCLUDING THIS FILE, so a
// literal spelled in this suite's own prose or in a fixture would satisfy the grep meant to
// forbid it. That is the 187-24 trap, and this project has recorded it firing six times —
// twice on this very surface. Nothing below spells a forbidden form as one literal.
// ═══════════════════════════════════════════════════════════════════════════════════════════

const QUOTE = String.fromCharCode(34)
const EMPTY_STRING_LITERAL = QUOTE + QUOTE

/** `?? ""` — assembled, never written. */
const COALESCE_TO_EMPTY_STRING = "?? " + EMPTY_STRING_LITERAL

const srcModules = () =>
  import.meta.glob("/src/**/*.{ts,tsx}", {
    query: "?raw",
    eager: true,
    import: "default",
  }) as Record<string, string>

/**
 * A module's CODE, with block comments and whole-line `//` comments removed.
 *
 * ⚠ **THIS IS NOT TIDINESS — THE FENCE WITHOUT IT FIRED ON ITS OWN RULE, MEASURED.** The first
 * run of this suite reported `/src/lib/api/knowledge.ts` as an offender, and the "offending"
 * text was the field's own docblock saying *"writing `allowed_connection_ids ?? []` turns no
 * preference into forbid everything"*. The same held for the two reason forms, whose rule is
 * stated on `Phase.failureReason` and on `WorkflowRunPhase.failure_reason`.
 *
 * The property that matters is *no CODE PATH performs the collapse*. So the sweep reads code.
 * A JSDoc body line always begins with `*` and a line comment with `//`, so an anchored strip
 * removes prose while leaving every executable line intact — and URLs (`https://…`) survive,
 * because only a line whose FIRST non-space characters are the slashes is dropped.
 *
 * The alternative — deleting the paragraphs that state the rule until the grep reads 0 — is
 * how a fence is driven green by removing the documentation it exists to protect.
 */
const codeOf = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n")

describe("Phase 214 — an ABSENT failure reason may never collapse into an EMPTY one", () => {
  it("NON-VACUITY — the src glob really resolved, before a single absence is asserted", () => {
    // ⚠ FIRST, ALWAYS. An empty glob makes every absence below free, and this project measured
    // exactly that failure for CSS under vitest (192.2-07). 200 is a floor with headroom, not
    // a pinned count: the tree grows and a pinned total here would rot every week.
    const modules = srcModules()
    expect(Object.keys(modules).length).toBeGreaterThan(200)
    // …and the sweep really read CONTENT, not a map of empty strings.
    const total = Object.values(modules).reduce((n, s) => n + s.length, 0)
    expect(total).toBeGreaterThan(1_000_000)
  })

  it("⚠ SCOPE — the sweep CANNOT see THIS file, and that is asserted rather than assumed", () => {
    // ⚠ MEASURED, NOT REASONED ABOUT (Phase 214, 2026-08-28). `import.meta.glob` EXCLUDES THE
    // MODULE THAT CALLS IT. A sibling probe file resolved `/src/lib/apiRunFields.fences.test.ts`
    // at 19,311 chars; from inside this file the same key reads `undefined`.
    //
    // WHY IT MATTERS RATHER THAN BEING TRIVIA. This suite spells all four forbidden forms — it
    // has to, they are its needles — so a reader could reasonably conclude the fence tolerates
    // them, or that it is somehow self-exempting by design. Neither is true: it simply cannot
    // see itself. **The honest consequence is that a collapse written IN THIS FILE would not be
    // caught here**, and that is stated rather than left for someone to discover.
    //
    // It is also what makes the needles safe to spell: the 187-24 trap needs the sweep to read
    // the prose, and structurally it cannot. Every OTHER file is covered — proven by the
    // positive control below, which is not synthetic: a scratch file placed in this same
    // directory during development WAS reported as an offender by the case above.
    const modules = srcModules()
    expect(modules["/src/lib/apiRunFields.fences.test.ts"]).toBeUndefined()
    // …while a sibling in the SAME directory IS reachable, so the exclusion is per-module and
    // not a broken glob pattern.
    expect(typeof modules["/src/lib/apiSource.testutil.ts"]).toBe("string")
  })

  const offendersFor = (needles: string[]) =>
    Object.entries(srcModules())
      .filter(([, source]) => needles.some((n) => codeOf(source).includes(n)))
      .map(([path]) => path)

  /**
   * The ONE site allowed to coalesce, and the argument for it.
   *
   * `PhaseCard` reads TWO sources and fires the sentinel only when BOTH are empty.
   * Coalescing there is not the collapse this fence forbids, for two independent reasons:
   *
   *   1. It is UNOBSERVABLE. The wire invariant one file over is that an empty string is
   *      NEVER SHIPPED — the value is absent or it is real text. So the coalesce maps a
   *      single inhabited state onto another and merges nothing a reader could tell apart.
   *   2. It is the FIX, not the defect. This fence names its own harm as the sentinel firing
   *      on a failure whose reason WAS known. That happened because only ONE source was read;
   *      the second source, length-tested, is what stops it. Forbidding the test here would
   *      restore the very bug this fence exists to prevent.
   *
   * ⚠ Path-anchored, never construct-anchored. Re-spelling the coalesce to dodge the
   * needle would leave the fence passing for a reason that is not the real one.
   */
  const COALESCE_EXEMPT = "/src/components/panel/PhaseCard.tsx"

  it("no CODE in src/ coalesces the camelCase reason to an empty string", () => {
    const offenders = offendersFor(["failureReason " + COALESCE_TO_EMPTY_STRING])
    expect(offenders.filter((f) => !f.endsWith(COALESCE_EXEMPT))).toEqual([])
    // POSITIVE CONTROL — the exemption is a HOLE OF KNOWN SIZE, not a disabled fence. The
    // needle must still match the exempt file, so a new offender elsewhere is still listed.
    expect(offenders.some((f) => f.endsWith(COALESCE_EXEMPT))).toBe(true)
  })

  it("no CODE in src/ coalesces the snake_case reason to an empty string", () => {
    // The wire spelling has its own case: a mapper is where the collapse is most tempting,
    // because that is the one place both spellings are in scope at once.
    expect(offendersFor(["failure_reason " + COALESCE_TO_EMPTY_STRING])).toEqual([])
  })

  it("no CODE in src/ collapses `allowed_connection_ids` in EITHER direction", () => {
    // ⚠ BOTH directions, because they are two different lies. `?? []` forbids everything when
    // the author asked for nothing; `|| undefined` permits everything when the author forbade
    // everything. A fence that swept only one would let the more dangerous one through.
    expect(
      offendersFor([
        "allowed_connection_ids ?? []",
        "allowed_connection_ids || []",
        "allowed_connection_ids || undefined",
      ]),
    ).toEqual([])
  })

  it("⚠ THE CONTROL — the matcher SEES a planted collapse, and the STRIPPER spares only prose", () => {
    // (1) The needles really match the shapes they name.
    const plantedReason = "const r = phase." + "failureReason " + COALESCE_TO_EMPTY_STRING
    expect(codeOf(plantedReason).includes("failureReason " + COALESCE_TO_EMPTY_STRING)).toBe(true)
    const plantedWire = "const r = row." + "failure_reason " + COALESCE_TO_EMPTY_STRING
    expect(codeOf(plantedWire).includes("failure_reason " + COALESCE_TO_EMPTY_STRING)).toBe(true)
    const plantedIds = "body." + "allowed_connection_ids ?? []"
    expect(codeOf(plantedIds).includes("allowed_connection_ids ?? []")).toBe(true)
    // …and the needle is genuinely the assembled operator, not an accident.
    expect(COALESCE_TO_EMPTY_STRING.length).toBe(5)

    // (2) THE STRIPPER DISCRIMINATES. A docblock that FORBIDS the form is spared; the same
    // form as code, on the very next line, is still caught. This is the property the first run
    // of this suite lacked — it reported `knowledge.ts` for its own rule (measured, 2 failed).
    const mixed = [
      "/** never write x." + "allowed_connection_ids ?? [] — it forbids everything. */",
      "// nor x." + "allowed_connection_ids ?? [] in a line comment",
      "const y = x." + "allowed_connection_ids ?? []",
    ].join("\n")
    expect(codeOf(mixed).includes("allowed_connection_ids ?? []")).toBe(true)
    const proseOnly = mixed.split("\n").slice(0, 2).join("\n")
    expect(proseOnly.includes("allowed_connection_ids ?? []")).toBe(true) // raw: present
    expect(codeOf(proseOnly).includes("allowed_connection_ids ?? []")).toBe(false) // code: gone

    // (3) A URL survives the line-comment strip — the false-positive the anchor prevents.
    expect(codeOf('const u = "https://example.invalid/x"')).toContain("https://example.invalid")
  })

  it("the four new run-phase fields are declared NULLABLE on both client mirrors", () => {
    // ⚠ A TYPE ASSERTION EXPRESSED OVER SOURCE, DELIBERATELY. `failureReason: string` would
    // typecheck at every call site and make an absent reason INEXPRESSIBLE — the client would
    // then have to invent one, which is the substitution this whole phase refuses. The
    // run-page mirror lives in the api client; the panel mirror lives in `types/index.ts`.
    const nullable = (src: string, field: string) =>
      new RegExp(`\\n\\s*${field}\\?:\\s*string\\s*\\|\\s*null`).test(src)
    for (const field of ["failure_reason", "tool_name", "capability", "service_name"]) {
      expect(nullable(apiSource, field), `${field} must be nullable on WorkflowRunPhase`).toBe(
        true,
      )
    }
    // POSITIVE CONTROL — the matcher discriminates rather than matching anything.
    expect(nullable("  failure_reason: string", "failure_reason")).toBe(false)
    expect(nullable("\n  failure_reason?: string | null", "failure_reason")).toBe(true)
  })

  it("the two later-wave widenings landed, and BOTH state their two-arm rule in words", () => {
    // ⚠ THE FILE THE PLAN NAMED IS NOT THE FILE THESE TYPES LIVE IN. `PublishVerdict` and
    // `GenerateWorkflowBody` moved to `lib/api/knowledge.ts` at Phase 207's split; the plan
    // said `lib/api/workflows.ts`. `API_SOURCE` concatenates every api module, so this fence
    // is indifferent to which one — which is exactly why it is asserted here rather than by a
    // per-file grep that would have been satisfiable only by putting the type in the wrong home.
    expect(apiSource).toContain("step_name")
    expect(apiSource).toContain("allowed_connection_ids")
    // The three `named_failures` keys are OPTIONAL — a pre-214 or other-stage entry must render.
    for (const key of ["step_name?:", "argument?:", "upstream?:"]) {
      expect(apiSource).toContain(key)
    }
    // ⚠ `named_failures` ITSELF IS UNTOUCHED. `PublishGauntlet`'s rule 4 is key detection PER
    // ENTRY; narrowing the array would break every other stage's rendering.
    expect(apiSource).toContain("named_failures: unknown[]")
    // And the absent-vs-empty rule is STATED where a reader of the field will find it.
    const genBlock = apiSource.slice(
      Math.max(0, apiSource.indexOf("allowed_connection_ids") - 2000),
      apiSource.indexOf("allowed_connection_ids") + 200,
    )
    expect(genBlock).toContain("absent")
    expect(genBlock.toLowerCase()).toContain("empty")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Phase 214 plan 16 (STEP-02 / D-214-04) — THE LAUNCH-INPUTS CHANNEL, AND THE BODY THAT MUST
// NOT MOVE.
//
// `postMessage` gains ONE option: the declared input values a launcher collected. It is the
// only channel those values have — before this plan the POST body was exactly
// {content, model, provider, agent_mode, workflow_definition_id?, folder_id?} and a declared
// `to` recipient died at the fetch call (`BUG-260826-01`).
//
// ⚠ TWO PROPERTIES, AND THE SECOND IS THE ONE THAT COULD BREAK THE APP. Sending the map is
// easy; NOT sending it is the contract. Every ordinary Deep chat send goes through this same
// function, so an unconditional `inputs` key — or an `inputs: {}` — would change the request
// body of every message in the product. Both arms are therefore asserted by DEEP EQUALITY
// against a literal pre-change body, never by a partial match: a subset assertion cannot see
// an ADDED key, which is precisely the regression it would need to see.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** `?? {}` and `|| {}` on the launch-inputs path — assembled, never written as one literal. */
const EMPTY_OBJECT_LITERAL = "{" + "}"
const COALESCE_INPUTS_NULLISH = "inputs ?? " + EMPTY_OBJECT_LITERAL
const COALESCE_INPUTS_OR = "inputs || " + EMPTY_OBJECT_LITERAL

describe("Phase 214 — postMessage carries declared launch inputs, and only when there are any", () => {
  const calls: Array<{ url: string; init: RequestInit }> = []

  beforeEach(() => {
    calls.length = 0
    vi.clearAllMocks()
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000")
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "u1" }, access_token: "tok-214" } },
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init })
        return {
          ok: true,
          status: 201,
          json: async () => ({ message_id: "m1", run_id: "r1" }),
        }
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const sentBody = (): Record<string, unknown> =>
    JSON.parse(String(calls[0].init.body)) as Record<string, unknown>

  it("the declared values reach the request body under `inputs`, with their keys intact", async () => {
    await postMessage("t-1", "run it", {
      workflowDefinitionId: "wf-1",
      inputs: { to: "a@example.test", subject: "S" },
    })
    expect(calls).toHaveLength(1)
    expect(sentBody().inputs).toEqual({ to: "a@example.test", subject: "S" })
  })

  it("⭐ OMITTED — the body is DEEP-EQUAL to the pre-214 literal, not merely a superset", async () => {
    await postMessage("t-1", "hello")
    // The whole body, asserted as an object. `model`/`provider` are undefined and
    // JSON.stringify drops them, which is the pre-change behaviour being pinned.
    expect(sentBody()).toEqual({ content: "hello", agent_mode: "default" })
  })

  it("⭐ EMPTY MAP — same body, byte for byte: `inputs: {}` is NEVER put on the wire", async () => {
    await postMessage("t-1", "run it", { workflowDefinitionId: "wf-1", inputs: {} })
    expect(sentBody()).toEqual({
      content: "run it",
      agent_mode: "default",
      workflow_definition_id: "wf-1",
    })
    // …and stated the other way round, because the deep-equal above is what a future
    // reader will be tempted to relax into a subset match.
    expect(Object.keys(sentBody())).not.toContain("inputs")
  })

  it("no CODE in src/ coalesces the launch inputs to an empty map, in EITHER direction", () => {
    // ⚠ BOTH forms, and they are two different lies on this path. `?? {}` turns "the
    // launcher declared nothing" into "the launcher declared an empty map", which is the
    // key that would then always be sent; `|| {}` does the same and additionally swallows
    // a deliberately-empty map. The server distinguishes absent from empty (the merge is a
    // spread of `body.inputs or {}` — an absent map and an empty one are the SAME dict, so
    // the honest client behaviour is to send neither).
    const offenders = Object.entries(srcModules())
      .filter(([, source]) =>
        [COALESCE_INPUTS_NULLISH, COALESCE_INPUTS_OR].some((n) => codeOf(source).includes(n)),
      )
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it("⚠ THE CONTROL — the launch-inputs matcher SEES a planted collapse and spares prose", () => {
    const plantedNullish = "const i = options." + COALESCE_INPUTS_NULLISH
    expect(codeOf(plantedNullish).includes(COALESCE_INPUTS_NULLISH)).toBe(true)
    const plantedOr = "const i = options." + COALESCE_INPUTS_OR
    expect(codeOf(plantedOr).includes(COALESCE_INPUTS_OR)).toBe(true)
    // The needles are the assembled operators, not accidents of concatenation.
    expect(COALESCE_INPUTS_NULLISH).toHaveLength(12)
    expect(COALESCE_INPUTS_OR).toHaveLength(12)
    // A docblock that FORBIDS the form is spared; the same form as code is still caught.
    const mixed = [
      "/** never write options." + COALESCE_INPUTS_NULLISH + " here. */",
      "const i = options." + COALESCE_INPUTS_NULLISH,
    ].join("\n")
    expect(codeOf(mixed).includes(COALESCE_INPUTS_NULLISH)).toBe(true)
    expect(codeOf(mixed.split("\n")[0]).includes(COALESCE_INPUTS_NULLISH)).toBe(false)
  })
})
