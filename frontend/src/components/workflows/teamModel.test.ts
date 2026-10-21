/**
 * Phase 290-01 (VIS-01, D-08 .. D-20, SC#3 / SC#4) — `deriveTeam`, the ONE derivation behind
 * the team picture.
 *
 * Every word expected below is imported from its vocabulary home (`teamVocabulary.ts`,
 * `phaseVocabulary.ts`, `GOVERNANCE_SEAL_LABEL`), never re-typed. Literal source paths are
 * literals on purpose: they name the definition field a line came from, and that path IS
 * the contract. Whole gate objects are asserted with `toEqual`, so a stray field fails.
 * Every negative detector carries a positive control.
 */
import { describe, it, expect } from "vitest"

import teamModelSource from "./teamModel?raw"
import governanceSectionSource from "./GovernanceSection?raw"
import { deriveTeam, SEAT_DOT_CAP, type TeamGate, type TeamLine } from "./teamModel"
import {
  FAIL_ASK,
  FAIL_JUMP_MISSING,
  FAIL_STOP,
  GATE_ARMED_WORDS,
  GATE_KIND_MISSING,
  GATE_KIND_WORDS,
  TEAM_STEP_UNTYPED,
  failJump,
  failRedoThen,
} from "./teamVocabulary"
import {
  PHASE_TYPE_LABELS,
  PHASE_TYPE_SENTENCES,
  PHASE_TYPE_SUBTITLES,
  groundingCauseOf,
  nodeTitle,
  parseSkipTarget,
  technicalTitle,
  type PhaseSpecJSON,
} from "./phaseVocabulary"
import { GOVERNANCE_SEAL_LABEL } from "./definitionOps"
import {
  ALL_FIXTURES,
  branching,
  emptyDraft,
  literatureReview,
  planExecuteVerify,
  singlePhase,
  unresolvableSkip,
} from "./__fixtures__/canvasFixtures"
import {
  TEAM_FIXTURES,
  alreadySetEmit,
  armedStep,
  batchHostile,
  batchTwenty,
  escalatedStep,
  groundedThreeStep,
  malformed,
  productionTwoStep,
  retryMatrix,
  vendorRiskReview,
} from "./__fixtures__/teamFixtures"

const KB = ["search_documents"] as const

/** Every fixture the SC#3 sweep reads: the transcribed corpus plus the planted shapes. */
const SWEEP: { name: string; phases: PhaseSpecJSON[] }[] = [
  ...ALL_FIXTURES.map(({ name, phases }) => ({ name, phases })),
  ...TEAM_FIXTURES,
]

/** A line that joins two STEP nodes directly. The schema has no field for one. */
const stepToStep = (lines: readonly Pick<TeamLine, "from" | "to">[]) =>
  lines.filter((l) => l.from.startsWith("step-") && l.to.startsWith("step-"))

/** How many validators in a definition name a skip target that resolves to a slug in it. */
const resolvableSkipCount = (phases: readonly PhaseSpecJSON[]): number => {
  const slugs = new Set(phases.map((p) => p.slug))
  let count = 0
  for (const p of phases) {
    if (!Array.isArray(p.validators)) continue
    for (const v of p.validators) {
      if (!v || typeof v !== "object") continue
      const target = parseSkipTarget(typeof v.on_failure === "string" ? v.on_failure : null)
      if (target !== null && slugs.has(target)) count += 1
    }
  }
  return count
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** The seven known phase types, from the shipped ⌥ vocabulary. */
const KNOWN_TYPES = Object.keys(PHASE_TYPE_LABELS)

// ── SC#3 — no line the schema lacks ───────────────────────────────────────────────────────

describe("deriveTeam — SC#3: no step-to-step line except a resolvable jump", () => {
  it("POSITIVE CONTROL — the step-to-step detector finds a planted step→step line", () => {
    const planted = [
      { kind: "jump", from: "step-0", to: "step-1", source: "planted" },
      { kind: "handoff", from: "orchestrator", to: "step-0", source: "planted" },
    ]
    expect(stepToStep(planted)).toHaveLength(1)
    expect(resolvableSkipCount(branching)).toBe(1)
  })

  for (const kb of [[], KB] as const) {
    it.each(SWEEP)(`$name (kbTools=${kb.length}): zero step-to-step lines`, ({ phases }) => {
      expect(stepToStep(deriveTeam(phases, kb).lines)).toEqual([])
    })

    it.each(SWEEP)(`$name (kbTools=${kb.length}): jump count = resolvable skips`, ({ phases }) => {
      const model = deriveTeam(phases, kb)
      expect(model.lines.filter((l) => l.kind === "jump")).toHaveLength(
        resolvableSkipCount(phases),
      )
    })
  }

  it.each(SWEEP)("$name: every step gets exactly one handoff from the orchestrator", ({ phases }) => {
    const model = deriveTeam(phases, KB)
    const fromOrchestrator = model.lines.filter((l) => l.from === "orchestrator")
    expect(fromOrchestrator.every((l) => l.kind === "handoff")).toBe(true)
    expect(model.lines.filter((l) => l.kind === "handoff").every((l) => l.from === "orchestrator")).toBe(true)
    expect(fromOrchestrator.map((l) => l.to).sort()).toEqual(model.steps.map((s) => s.id).sort())
  })

  it("the transcribed corpus is really non-empty (non-vacuity)", () => {
    const total = SWEEP.reduce((n, { phases }) => n + deriveTeam(phases, KB).steps.length, 0)
    expect(total).toBeGreaterThan(40)
  })
})

// ── the skip edge (D-10) ──────────────────────────────────────────────────────────────────

describe("deriveTeam — the jump line (D-10)", () => {
  it("branching → exactly one jump from the step-2 check to step 4", () => {
    const model = deriveTeam(branching)
    expect(model.lines.filter((l) => l.kind === "jump")).toEqual([
      {
        kind: "jump",
        from: "gate-1-0",
        to: "step-3",
        source: 'phases[1].validators[0].on_failure = "skip_to_phase:escalate"',
      },
    ])
    expect(model.gates).toEqual<TeamGate[]>([
      {
        id: "gate-1-0",
        stepId: "step-1",
        stepNumber: 2,
        judge: false,
        derived: null,
        kind: "structure_check",
        words: GATE_KIND_WORDS.structure_check,
        criteria: null,
        failure: failRedoThen(2, failJump(4)),
        jumpTo: 4,
        source: 'phases[1].validators[0].kind = "structure_check"',
      },
    ])
    expect(model.gates[0].failure).toBe("redo the step (up to 2 times), then ⤳ jump to step 4")
    expect(model.lines.filter((l) => l.kind === "check")).toEqual([
      {
        kind: "check",
        from: "gate-1-0",
        to: "step-1",
        source: 'phases[1].validators[0].kind = "structure_check"',
      },
    ])
  })

  it("unresolvableSkip → no jump, and the failure words say the run stops", () => {
    const model = deriveTeam(unresolvableSkip)
    expect(model.lines.filter((l) => l.kind === "jump")).toEqual([])
    expect(model.gates).toHaveLength(1)
    expect(model.gates[0].failure).toBe(failRedoThen(2, FAIL_JUMP_MISSING))
    expect(model.gates[0].jumpTo).toBeNull()
  })
})

// ── ordering, sources, the judge (D-08, D-11, D-16) ───────────────────────────────────────

describe("deriveTeam — vendorRiskReview (the 7-step stress shape)", () => {
  const model = deriveTeam(vendorRiskReview)

  it("orders steps by phase_index, not by array position (D-08)", () => {
    expect(model.steps.map((s) => s.slug)).toEqual([
      "intake",
      "screen",
      "assess",
      "summarize",
      "sign-off",
      "notify",
      "report",
    ])
    expect(model.steps.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(model.steps.map((s) => s.id)).toEqual(
      [0, 1, 2, 3, 4, 5, 6].map((i) => `step-${i}`),
    )
  })

  it("sources name the ORIGINAL array index (D-11)", () => {
    const handoffs = model.lines.filter((l) => l.kind === "handoff")
    expect(handoffs).toEqual([
      { kind: "handoff", from: "orchestrator", to: "step-0", source: "phases[2].phase_index = 0" },
      { kind: "handoff", from: "orchestrator", to: "step-1", source: "phases[4].phase_index = 1" },
      { kind: "handoff", from: "orchestrator", to: "step-2", source: "phases[1].phase_index = 2" },
      { kind: "handoff", from: "orchestrator", to: "step-3", source: "phases[6].phase_index = 3" },
      { kind: "handoff", from: "orchestrator", to: "step-4", source: "phases[5].phase_index = 4" },
      { kind: "handoff", from: "orchestrator", to: "step-5", source: "phases[3].phase_index = 5" },
      { kind: "handoff", from: "orchestrator", to: "step-6", source: "phases[0].phase_index = 6" },
    ])
  })

  it("the judge is a Judge, with its criteria text (D-16, F-4)", () => {
    const judge = model.gates.find((g) => g.judge)
    expect(judge).toEqual<TeamGate>({
      id: "gate-2-0",
      stepId: "step-2",
      stepNumber: 3,
      judge: true,
      derived: null,
      kind: "llm_judge_rubric",
      words: GATE_KIND_WORDS.llm_judge_rubric,
      criteria: "Every vendor risk names its evidence",
      failure: failRedoThen(2, FAIL_STOP),
      jumpTo: null,
      source: 'phases[1].validators[0].kind = "llm_judge_rubric"',
    })
    expect(model.lines.filter((l) => l.kind === "judge")).toEqual([
      {
        kind: "judge",
        from: "gate-2-0",
        to: "step-2",
        source: 'phases[1].validators[0].kind = "llm_judge_rubric"',
      },
    ])
  })

  it("exactly one jump: the step-2 check to step 5", () => {
    expect(model.lines.filter((l) => l.kind === "jump")).toEqual([
      {
        kind: "jump",
        from: "gate-1-0",
        to: "step-4",
        source: 'phases[4].validators[0].on_failure = "skip_to_phase:sign-off"',
      },
    ])
    const screen = model.gates.find((g) => g.id === "gate-1-0")
    expect(screen?.jumpTo).toBe(5)
    expect(screen?.failure).toBe(failRedoThen(2, failJump(5)))
  })

  it("the PRE check does not redo its step (D-19)", () => {
    const pre = model.gates.find((g) => g.id === "gate-3-0")
    expect(pre).toEqual<TeamGate>({
      id: "gate-3-0",
      stepId: "step-3",
      stepNumber: 4,
      judge: false,
      derived: null,
      kind: "regex_match",
      words: GATE_KIND_WORDS.regex_match,
      criteria: null,
      failure: FAIL_STOP,
      jumpTo: null,
      source: 'phases[6].validators[0].kind = "regex_match"',
    })
  })

  it("four gates, one judge → no absence line (the unflagged notify step is armed, CR-01)", () => {
    expect(model.gates).toHaveLength(4)
    expect(model.gates.filter((g) => g.derived === "armed").map((g) => g.id)).toEqual([
      "gate-5-armed",
    ])
    expect(model.absence).toBeNull()
    expect(model.oneStep).toBe(false)
  })

  it("the batch step carries its seats, sourced", () => {
    const assess = model.steps.find((s) => s.slug === "assess")
    expect(assess?.seats).toBe(5)
    expect(assess?.seatDots).toBe(5)
    expect(assess?.seatSource).toBe("phases[1].config.max_parallel_agents = 5")
  })
})

// ── derived gates (D-17, D-18, D-20) ──────────────────────────────────────────────────────

describe("deriveTeam — the derived gates", () => {
  it("groundedThreeStep with a KB tool → one derived citations check on step 1", () => {
    const model = deriveTeam(groundedThreeStep, KB)
    expect(model.gates).toEqual<TeamGate[]>([
      {
        id: "gate-0-cite",
        stepId: "step-0",
        stepNumber: 1,
        judge: false,
        derived: "citations",
        kind: "citations_required",
        words: GOVERNANCE_SEAL_LABEL,
        criteria: null,
        failure: failRedoThen(2, FAIL_ASK),
        jumpTo: null,
        source:
          'phases[0].config.available_tools includes "search_documents" (the engine adds citations_required)',
      },
    ])
    expect(model.gates[0].failure).toBe("redo the step (up to 2 times), then ask you")
    expect(model.lines.filter((l) => l.kind === "check")).toEqual([
      {
        kind: "check",
        from: "gate-0-cite",
        to: "step-0",
        source:
          'phases[0].config.available_tools includes "search_documents" (the engine adds citations_required)',
      },
    ])
    expect(model.absence).toBe("noJudge")
  })

  it("the same fixture with no KB tools → nothing derived, absence 'none'", () => {
    const model = deriveTeam(groundedThreeStep, [])
    expect(model.gates).toEqual([])
    expect(model.absence).toBe("none")
    expect(model.steps).toHaveLength(3)
  })

  it("an escalated step gets no gate (D-18)", () => {
    // POSITIVE CONTROL — the fixture really is on the escalated cause.
    expect(groundingCauseOf(escalatedStep[0], KB)).toBe("escalated")
    const model = deriveTeam(escalatedStep, KB)
    expect(model.gates).toEqual([])
    expect(model.absence).toBe("none")
  })

  it("an llm_emit citation policy is not a gate (D-18, D-20)", () => {
    expect(groundingCauseOf(alreadySetEmit[0], KB)).toBe("already-set")
    const model = deriveTeam(alreadySetEmit, KB)
    expect(model.gates).toEqual([])
    expect(model.absence).toBe("none")
  })

  it("an armed step gets the derived stops-and-asks check, with no failure line (D-17)", () => {
    const model = deriveTeam(armedStep)
    expect(model.gates).toEqual<TeamGate[]>([
      {
        id: "gate-0-armed",
        stepId: "step-0",
        stepNumber: 1,
        judge: false,
        derived: "armed",
        kind: "action_risk_approval",
        words: GATE_ARMED_WORDS,
        criteria: null,
        failure: null,
        jumpTo: null,
        source: "phases[0].action_risk_armed = true",
      },
    ])
    expect(model.lines.filter((l) => l.kind === "check")).toEqual([
      { kind: "check", from: "gate-0-armed", to: "step-0", source: "phases[0].action_risk_armed = true" },
    ])
    expect(model.absence).toBe("noJudge")
  })

  it("an external_action step WITHOUT a stored flag is still armed — the engine arms it (CR-01)", () => {
    // `harness.py`'s PhaseSpec D-04 validator coerces every external_action step to armed,
    // and `minimalPhaseFor` writes no flag, so a fresh step arrives unflagged or false.
    const source = 'phases[0].config.phase_type = "external_action" (the engine always arms it)'
    for (const flag of [undefined, false]) {
      const model = deriveTeam([
        { slug: "send", phase_index: 0, config: { phase_type: "external_action" }, action_risk_armed: flag },
      ])
      expect(model.gates).toEqual<TeamGate[]>([
        {
          id: "gate-0-armed",
          stepId: "step-0",
          stepNumber: 1,
          judge: false,
          derived: "armed",
          kind: "action_risk_approval",
          words: GATE_ARMED_WORDS,
          criteria: null,
          failure: null,
          jumpTo: null,
          source,
        },
      ])
      expect(model.lines.filter((l) => l.kind === "check")).toEqual([
        { kind: "check", from: "gate-0-armed", to: "step-0", source },
      ])
      expect(model.absence).toBe("noJudge")
    }
  })

  it("POSITIVE CONTROL — an unflagged step of another type gets no armed check", () => {
    const model = deriveTeam([{ slug: "a", phase_index: 0, config: { phase_type: "llm_agent" } }])
    expect(model.gates).toEqual([])
    expect(model.absence).toBe("none")
  })

  it("the always-armed list matches GovernanceSection's ARM_PINNED_TYPES (one rule, two copies)", () => {
    const list = /: readonly string\[\] = (\[[^\]]*\])/
    const team = teamModelSource.match(new RegExp(`const ARMED_TYPES${list.source}`))
    const governance = governanceSectionSource.match(new RegExp(`const ARM_PINNED_TYPES${list.source}`))
    expect(team?.[1]).toBe('["external_action"]')
    expect(governance?.[1]).toBe(team?.[1])
  })
})

// ── failure words (D-19) ──────────────────────────────────────────────────────────────────

describe("deriveTeam — failure words follow the engine's retry loop (D-19)", () => {
  it("retryMatrix → one exact string per disposition", () => {
    const model = deriveTeam(retryMatrix)
    expect(model.gates.map((g) => g.failure)).toEqual([
      failRedoThen(2, FAIL_STOP),
      failRedoThen(2, FAIL_STOP),
      failRedoThen(2, FAIL_ASK),
      failRedoThen(2, FAIL_STOP),
      failRedoThen(2, FAIL_STOP),
      FAIL_STOP,
      failRedoThen(1, FAIL_STOP),
      FAIL_STOP,
    ])
    expect(model.gates[6].failure).toBe("redo the step (up to 1 time), then stop the run")
    expect(model.gates.map((g) => g.id)).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7].map((k) => `gate-0-${k}`),
    )
    expect(model.lines.filter((l) => l.kind === "jump")).toEqual([])
  })

  it("an unrecognised on_failure reads 'stop the run', never its raw text (WR-01)", () => {
    // `engine_ask._parse_on_failure` routes every unknown value to fail_run.
    const typos = ["explode", "ask-user", "skip_to:review", ""]
    const model = deriveTeam([
      { slug: "review", phase_index: 0, config: { phase_type: "llm_single" } },
      {
        slug: "check",
        phase_index: 1,
        config: { phase_type: "llm_single" },
        validators: typos.map((on_failure) => ({ kind: "regex_match", on_failure })),
      },
    ])
    expect(model.gates.map((g) => g.failure)).toEqual(typos.map(() => failRedoThen(2, FAIL_STOP)))
    for (const typo of typos.filter(Boolean)) {
      expect(model.gates.some((g) => g.failure?.includes(typo))).toBe(false)
    }
    expect(model.lines.filter((l) => l.kind === "jump")).toEqual([])
  })
})

// ── absence (D-12, D-13)──────────────────────────────────────────────────────────────────

describe("deriveTeam — absence, said once", () => {
  it("planExecuteVerify → checks but no judge", () => {
    const model = deriveTeam(planExecuteVerify)
    expect(model.absence).toBe("noJudge")
    expect(model.gates).toHaveLength(1)
  })

  it("productionTwoStep → no gates, two handoffs and nothing else", () => {
    const model = deriveTeam(productionTwoStep)
    expect(model.absence).toBe("none")
    expect(model.lines.filter((l) => l.kind === "handoff")).toHaveLength(2)
    expect(model.lines).toHaveLength(2)
    expect(model.steps[0]).toEqual({
      id: "step-0",
      number: 1,
      slug: "retrieve",
      phaseType: "llm_agent",
      title: nodeTitle(productionTwoStep[0]),
      role: PHASE_TYPE_SUBTITLES.llm_agent,
      technical: technicalTitle(productionTwoStep[0]),
      seats: null,
      seatDots: 0,
      seatSource: null,
    })
    // The unnamed step's title IS the type sentence, so the role swaps to the subtitle.
    expect(nodeTitle(productionTwoStep[0])).toBe(PHASE_TYPE_SENTENCES.llm_agent)
  })

  it("singlePhase → one step, one handoff, no invented step (D-12)", () => {
    const model = deriveTeam(singlePhase)
    expect(model.oneStep).toBe(true)
    expect(model.steps).toHaveLength(1)
    const gateLines = model.lines.filter((l) => l.kind !== "handoff")
    expect(model.lines).toHaveLength(1 + gateLines.length)
    expect(model.lines.filter((l) => l.kind === "handoff")).toHaveLength(1)
  })

  const EMPTY = { steps: [], gates: [], lines: [], absence: "empty", oneStep: false }

  it.each([
    ["emptyDraft", emptyDraft],
    ["null", null],
    ["undefined", undefined],
    ["a string", "not-phases" as unknown as PhaseSpecJSON[]],
    ["an object", { phases: [] } as unknown as PhaseSpecJSON[]],
  ])("%s → the empty model, no throw", (_label, input) => {
    expect(deriveTeam(input as PhaseSpecJSON[] | null | undefined)).toEqual(EMPTY)
  })

  it("POSITIVE CONTROL — a one-step definition is NOT the empty model", () => {
    expect(deriveTeam(singlePhase)).not.toEqual(EMPTY)
  })
})

// ── seats (D-14) ──────────────────────────────────────────────────────────────────────────

describe("deriveTeam — batch seats", () => {
  it("batchTwenty → 20 seats, 8 dots", () => {
    const [step] = deriveTeam(batchTwenty).steps
    expect(SEAT_DOT_CAP).toBe(8)
    expect(step.seats).toBe(20)
    expect(step.seatDots).toBe(SEAT_DOT_CAP)
    expect(step.seatSource).toBe("phases[0].config.max_parallel_agents = 20")
  })

  it("batchHostile → the engine default 5 for 0, -1, \"5\" and absent", () => {
    const steps = deriveTeam(batchHostile).steps
    expect(steps.map((s) => s.seats)).toEqual([5, 5, 5, 5])
    expect(steps.map((s) => s.seatDots)).toEqual([5, 5, 5, 5])
    expect(steps.map((s) => s.seatSource)).toEqual([
      "phases[0].config.max_parallel_agents = 0 (engine default 5)",
      "phases[1].config.max_parallel_agents = -1 (engine default 5)",
      'phases[2].config.max_parallel_agents = "5" (engine default 5)',
      "phases[3].config.max_parallel_agents (absent, engine default 5)",
    ])
  })

  it("literatureReview → 5 seats on the batch step, none elsewhere", () => {
    const steps = deriveTeam(literatureReview).steps
    expect(steps.map((s) => s.seats)).toEqual([null, 5, null])
    expect(steps.map((s) => s.seatDots)).toEqual([0, 5, 0])
    expect(steps.map((s) => s.seatSource)).toEqual([
      null,
      "phases[1].config.max_parallel_agents = 5",
      null,
    ])
  })
})

// ── malformed input (T-290-01, T-290-02) ──────────────────────────────────────────────────

describe("deriveTeam — malformed author input resolves to honest raw floors", () => {
  it("does not throw", () => {
    expect(() => deriveTeam(malformed, KB)).not.toThrow()
  })

  const model = deriveTeam(malformed, KB)

  it("the constructor phase type renders its raw string, never a prototype function", () => {
    const odd = model.steps.find((s) => s.slug === "odd")
    expect(odd?.title).toBe("constructor")
    expect(odd?.role).toBe("constructor")
    expect(odd?.technical).toBe("constructor · odd")
    expect(odd?.phaseType).toBe("constructor")
  })

  it("the __proto__ kind renders its raw string; a kind-less gate reads the floor", () => {
    const proto = model.gates.filter((g) => g.stepId === "step-1")
    expect(proto.map((g) => g.kind)).toEqual(["__proto__", "structure_check", ""])
    expect(proto.map((g) => g.words)).toEqual([
      "__proto__",
      GATE_KIND_WORDS.structure_check,
      GATE_KIND_MISSING,
    ])
    expect(proto[1].failure).toBe(failRedoThen(2, FAIL_JUMP_MISSING))
    expect(proto[1].jumpTo).toBeNull()
    expect(proto[2].failure).toBe(failRedoThen(2, FAIL_ASK))
    expect(proto[2].source).toBe('phases[1].validators[2].kind = ""')
  })

  it("a non-array validators field yields no gate", () => {
    expect(model.gates.filter((g) => g.stepId === "step-2")).toEqual([])
  })

  it("the config-less phase yields an untyped step", () => {
    const bare = model.steps.find((s) => s.slug === "no-config")
    expect(bare?.phaseType).toBe("")
    expect(bare?.role).toBe(TEAM_STEP_UNTYPED)
    expect(bare?.title).toBe(TEAM_STEP_UNTYPED)
    expect(bare?.technical).toBe(`${TEAM_STEP_UNTYPED} · no-config`)
  })

  it("no jump for skip_to_phase:gone", () => {
    expect(model.lines.filter((l) => l.kind === "jump")).toEqual([])
  })

  it("every string field in the model is a string (nothing leaks a function)", () => {
    for (const s of model.steps) {
      for (const field of [s.id, s.slug, s.phaseType, s.title, s.role, s.technical]) {
        expect(typeof field).toBe("string")
      }
    }
    for (const g of model.gates) {
      expect(typeof g.words).toBe("string")
      expect(typeof g.kind).toBe("string")
    }
  })
})

// ── the ⌥ form agrees with the canvas ─────────────────────────────────────────────────────

describe("deriveTeam — technical === technicalTitle for the 7 known types", () => {
  it("POSITIVE CONTROL — there are seven known types", () => {
    expect(KNOWN_TYPES).toHaveLength(7)
  })

  it.each(SWEEP)("$name", ({ phases }) => {
    const model = deriveTeam(phases)
    for (const step of model.steps) {
      if (!KNOWN_TYPES.includes(step.phaseType)) continue
      const phase = phases.find((p) => p.slug === step.slug)
      if (!phase || typeof phase.config !== "object" || phase.config === null) continue
      expect(step.technical, step.slug).toBe(technicalTitle(phase))
    }
  })
})

// ── purity: determinism, non-mutation, and the leaf fence ─────────────────────────────────

describe("deriveTeam — determinism and non-mutation", () => {
  it.each(SWEEP)("$name: two calls are JSON-equal", ({ phases }) => {
    expect(JSON.stringify(deriveTeam(phases, KB))).toBe(JSON.stringify(deriveTeam(phases, KB)))
  })

  it.each(SWEEP)("$name: the input is deep-equal to its pre-call clone", ({ phases }) => {
    const before = clone(phases)
    deriveTeam(phases, KB)
    expect(phases).toEqual(before)
  })
})

describe("teamModel — a pure leaf (no React, no API, no clock, no I/O)", () => {
  /** Code only: block comments and whole-line `//` comments removed. */
  const codeOnly = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

  const FENCES: { id: string; re: RegExp; planted: string }[] = [
    { id: "react", re: /from\s+["']react["']/, planted: 'import { useMemo } from "react"' },
    { id: "api", re: /@\/lib\/api/, planted: 'import { x } from "@/lib/api"' },
    { id: "clock", re: /Date\.now|new\s+Date\b/, planted: "const t = Date.now()" },
    { id: "fetch", re: /\bfetch\s*\(/, planted: 'await fetch("/x")' },
  ]

  it("POSITIVE CONTROLS — each fence matches its planted string, and the stripper keeps code", () => {
    for (const { id, re, planted } of FENCES) {
      expect(planted, id).toMatch(re)
      expect(codeOnly(`/** ${planted} */\n${planted}`), id).toMatch(re)
      expect(codeOnly(`/** ${planted} */\n// ${planted}\nconst a = 1`), id).not.toMatch(re)
    }
  })

  it("the loaded source is this module", () => {
    expect(teamModelSource).toMatch(/export function deriveTeam/)
  })

  it.each(FENCES)("no $id", ({ re }) => {
    expect(codeOnly(teamModelSource)).not.toMatch(re)
  })
})
