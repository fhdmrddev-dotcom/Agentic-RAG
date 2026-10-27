/**
 * Phase 290-01 (VIS-01, D-08 .. D-20) — THE ONE DERIVATION BEHIND THE TEAM PICTURE (D-11).
 *
 * `deriveTeam` turns a workflow definition's `phases[]` into the value the team picture
 * (290-03) draws: the steps in run order, the gates that check each step, and every line
 * between them, each line carrying the `source` path of the definition field it came from.
 * The render draws only what this returns, so every honesty rule lives here, where a test
 * reads it directly.
 *
 * ── LEAF RULES ────────────────────────────────────────────────────────────────────────────
 * No React, no API client, no clock, no I/O: the derivation reads only the definition the
 * viewer already holds (D-07), and the same input always yields the same JSON. All four are
 * fenced over this file's raw source in `teamModel.test.ts`.
 *
 * ── THE SC#3 CONSTRUCTION RULE ────────────────────────────────────────────────────────────
 * Steps never pass work to each other: the engine gives each one its turn and every step
 * reads what the earlier ones produced. The definition has no field for a step-to-step
 * link, so this module draws none. The lines it CAN produce are exactly:
 *   - `handoff` — orchestrator → step, one per step;
 *   - `judge` / `check` — gate → the step it checks;
 *   - `jump` — gate → another step, ONLY for a `skip_to_phase:<slug>` whose slug this
 *     definition has (D-10). `retry` redoes the same step and is never a line.
 *
 * ── WORDS FOLLOW THE ENGINE (D-17 .. D-20) ────────────────────────────────────────────────
 * A POST gate redoes its step up to `max_retries` (default 2) before it routes; a PRE gate
 * does not redo. The engine adds one citations gate only on a step whose grounding cause is
 * `detected`, and since Phase 295 it asks the person once its redos run out. An escalated
 * or already-set cause, and an `llm_emit` step's own citation policy, add no gate.
 *
 * ── HOSTILE INPUT (T-290-01, T-290-02) ────────────────────────────────────────────────────
 * Every keyed read of a presentation map goes through `own()`; the slug → step lookup is a
 * `Map`; `nodeTitle` output is kept only when it is a non-empty string, because its floor
 * is a bracket read that yields a prototype function for a `constructor` phase type. Every
 * malformed part resolves to its raw string floor, and nothing throws.
 */
import {
  actionRiskArmed,
  comparePhaseOrder,
  groundingCauseOf,
  intersectingKbToolOf,
  nodeTitle,
  parseSkipTarget,
  PHASE_TYPE_LABELS,
  PHASE_TYPE_SENTENCES,
  PHASE_TYPE_SUBTITLES,
  STEP_UNTYPED as TEAM_STEP_UNTYPED,
  type NameContext,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"
import { own } from "@/components/workflows/ownProperty"
import { GOVERNANCE_SEAL_LABEL } from "@/components/workflows/definitionOps"
import {
  FAIL_ASK,
  FAIL_JUMP_MISSING,
  FAIL_STOP,
  GATE_ARMED_WORDS,
  GATE_KIND_MISSING,
  GATE_KIND_WORDS,
  failJump,
  failRedoThen,
} from "./teamVocabulary"

// ── types (the contract 290-03 consumes) ──────────────────────────────────────────────────

export type TeamLineKind = "handoff" | "judge" | "check" | "jump"

/** One drawn line. `from` / `to` are node ids: `orchestrator`, `step-N` or `gate-…`. */
export interface TeamLine {
  kind: TeamLineKind
  from: string
  to: string
  source: string
}

export interface TeamStep {
  /** `step-${runIndex}`. */
  id: string
  /** `runIndex + 1`. */
  number: number
  slug: string
  /** `""` when `config` or `phase_type` is absent. */
  phaseType: string
  /** `nodeTitle(...)` when it returns a non-empty string, else the floor. */
  title: string
  /** The shipped type sentence; swapped to the subtitle when it equals the title. */
  role: string
  /** `${label} · ${slug}` — byte-equal to `technicalTitle` for the seven known types. */
  technical: string
  /** `llm_batch_agents` only. */
  seats: number | null
  /** `min(seats, SEAT_DOT_CAP)`, 0 when `seats` is null. */
  seatDots: number
  seatSource: string | null
}

export interface TeamGate {
  /** `gate-${runIndex}-${k}` declared, `gate-${runIndex}-cite`, `gate-${runIndex}-armed`. */
  id: string
  stepId: string
  stepNumber: number
  judge: boolean
  derived: "citations" | "armed" | null
  /** The raw kind (`""` when absent); `citations_required` / `action_risk_approval` derived. */
  kind: string
  words: string
  criteria: string | null
  /** The words AFTER `FAIL_LEAD`; null for the armed checkpoint. */
  failure: string | null
  /** Target step number, only when resolvable. */
  jumpTo: number | null
  source: string
}

export type TeamAbsence = "empty" | "none" | "noJudge" | null

export interface TeamModel {
  steps: TeamStep[]
  gates: TeamGate[]
  lines: TeamLine[]
  absence: TeamAbsence
  oneStep: boolean
}

/** The most seat dots a batch step draws; the words always state the real count. */
export const SEAT_DOT_CAP = 8

// ── engine defaults (backend/app/models/harness.py, read-only) ────────────────────────────

/** `ValidatorSpec.max_retries` default. */
const DEFAULT_MAX_RETRIES = 2

/** `max_parallel_agents` default. */
const DEFAULT_SEATS = 5

/** The engine citations gate's retry budget. */
const CITATIONS_MAX_RETRIES = 2

const BATCH_TYPE = "llm_batch_agents"
const JUDGE_KIND = "llm_judge_rubric"

/**
 * The step types the ENGINE always arms, whatever the stored `action_risk_armed` says
 * (290 CR-01). The rule's homes are the backend `PhaseSpec` D-04 validator
 * (`backend/app/models/harness.py`, which coerces every `ExternalActionPhaseConfig` step to
 * `action_risk_armed = True` on `model_validate`) and, on the client, `ARM_PINNED_TYPES` in
 * `GovernanceSection.tsx` (`:142`). This leaf may not import that component, so it keeps a
 * copy, and `teamModel.test.ts` asserts the two lists still read the same.
 *
 * The stored flag alone is not enough: `minimalPhaseFor` writes no `action_risk_armed`, and
 * the builder hands the picture its in-memory phases, so a fresh step arrives unflagged.
 */
const ARMED_TYPES: readonly string[] = ["external_action"]

/** Module-scope so an omitted argument hands the same reference on every call. */
const NO_KB_TOOLS: readonly string[] = Object.freeze([])
const NO_NAME_CONTEXT: NameContext = Object.freeze({})

// ── helpers ───────────────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value)

interface OrderedPhase {
  phase: PhaseSpecJSON
  /** The ORIGINAL array position, which every `source` path names. */
  original: number
  slug: string
  index: number
}

/** Drop non-objects and order by `phase_index`, then slug — the canvasModel comparator,
 *  which since 296-07 (290-IN-01) is literally the same function, `comparePhaseOrder`. */
function orderSteps(phases: readonly unknown[]): OrderedPhase[] {
  const kept: OrderedPhase[] = []
  phases.forEach((entry, original) => {
    if (!isRow(entry)) return
    const phase = entry as unknown as PhaseSpecJSON
    kept.push({
      phase,
      original,
      slug: typeof entry.slug === "string" ? entry.slug : "",
      index: typeof entry.phase_index === "number" && Number.isFinite(entry.phase_index)
        ? entry.phase_index
        : 0,
    })
  })
  return kept.sort((a, b) => comparePhaseOrder(a.phase, b.phase))
}

/** The step's title: `nodeTitle` when it yields a non-empty string, else the raw floor. */
function titleOf(phase: PhaseSpecJSON, hasConfig: boolean, type: string, ctx: NameContext): string {
  const rawName: unknown = phase.name
  const name = typeof rawName === "string" ? rawName.trim() : ""
  if (hasConfig) {
    // A non-string `name` would throw inside `nodeTitle`'s `.trim()`; hand it a copy without.
    const safe = typeof rawName === "string" || rawName == null ? phase : { ...phase, name: undefined }
    const title: unknown = nodeTitle(safe, ctx)
    if (typeof title === "string" && title.length > 0) return title
  }
  return name || type || TEAM_STEP_UNTYPED
}

/** Seats for a batch step: a positive whole `max_parallel_agents`, else the engine default. */
function seatsOf(config: Row, original: number): { seats: number; source: string } {
  const raw = config.max_parallel_agents
  const field = `phases[${original}].config.max_parallel_agents`
  if (raw === undefined) {
    return { seats: DEFAULT_SEATS, source: `${field} (absent, engine default ${DEFAULT_SEATS})` }
  }
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) {
    return { seats: raw, source: `${field} = ${raw}` }
  }
  return {
    seats: DEFAULT_SEATS,
    source: `${field} = ${JSON.stringify(raw)} (engine default ${DEFAULT_SEATS})`,
  }
}

/** A whole-number string as Pydantic's lax `int` reads it: `" 3 "`, `"+2"`, `"1_0"`, `"3.0"`. */
const INT_STRING = /^[+-]?\d+(?:_\d+)*(?:\.0+)?$/

/**
 * How many redos the engine runs for a `max_retries` value (290 WR-06).
 *
 * `ValidatorSpec.max_retries: int = 2` is lax, so Pydantic turns a whole-number string,
 * a whole float or a boolean into an int, and nothing bounds it below. The engine stops
 * redoing once `attempt >= max_retries` with `attempt` starting at 0, so a negative value
 * means no redo at all. Measured against `ValidatorSpec` 2026-10-21. An absent value, and
 * anything Pydantic refuses (`3.5`, `""`, `null`, `"0x3"`), reads as the default: a refused
 * value fails validation, so the engine never runs that definition with any count.
 */
function retriesOf(raw: unknown): number {
  let n: number | null = null
  if (typeof raw === "number" && Number.isInteger(raw)) n = raw
  else if (typeof raw === "boolean") n = raw ? 1 : 0
  else if (typeof raw === "string" && INT_STRING.test(raw.trim())) {
    n = Number.parseInt(raw.trim().replace(/_/g, ""), 10)
  }
  if (n === null) return DEFAULT_MAX_RETRIES
  return Math.max(0, n)
}

/** The failure words for a declared gate (D-10, D-19), plus its resolved jump target. */
function failureWords(
  v: Row,
  stepNumberOf: ReadonlyMap<string, number>,
): { failure: string; raw: string; jumpTo: number | null } {
  const retries = retriesOf(v.max_retries)
  const pre = v.timing === "pre"
  const raw = typeof v.on_failure === "string" ? v.on_failure : "fail_run"
  const target = parseSkipTarget(raw)

  let then: string
  let jumpTo: number | null = null
  if (target !== null) {
    const n = stepNumberOf.get(target)
    if (n !== undefined) {
      jumpTo = n
      then = failJump(n)
    } else {
      then = FAIL_JUMP_MISSING
    }
  } else if (raw === "ask_user") {
    then = FAIL_ASK
  } else {
    // `fail_run`, `retry` (its redos ran out) and EVERY unrecognised value: the engine's
    // `engine_ask._parse_on_failure` routes an unknown string to `fail_run` (fail-safe), so
    // a typo such as `ask-user` stops the run and must read that way (290 WR-01).
    then = FAIL_STOP
  }

  const failure = pre || retries === 0 ? then : failRedoThen(retries, then)
  return { failure, raw, jumpTo }
}

/** The gates the ENGINE adds that the definition does not list (D-17, D-18, D-20). */
function derivedGates(
  phase: PhaseSpecJSON,
  step: TeamStep,
  original: number,
  runIndex: number,
  kbTools: readonly string[],
): TeamGate[] {
  const gates: TeamGate[] = []
  if (groundingCauseOf(phase, kbTools) === "detected") {
    const tool = intersectingKbToolOf(phase, kbTools)
    gates.push({
      id: `gate-${runIndex}-cite`,
      stepId: step.id,
      stepNumber: step.number,
      judge: false,
      derived: "citations",
      kind: "citations_required",
      words: GOVERNANCE_SEAL_LABEL,
      criteria: null,
      failure: failRedoThen(CITATIONS_MAX_RETRIES, FAIL_ASK),
      jumpTo: null,
      source: `phases[${original}].config.available_tools includes "${tool ?? ""}" (the engine adds citations_required)`,
    })
  }
  const stored = actionRiskArmed(phase)
  if (stored || ARMED_TYPES.includes(step.phaseType)) {
    gates.push({
      id: `gate-${runIndex}-armed`,
      stepId: step.id,
      stepNumber: step.number,
      judge: false,
      derived: "armed",
      kind: "action_risk_approval",
      words: GATE_ARMED_WORDS,
      criteria: null,
      failure: null,
      jumpTo: null,
      source: stored
        ? `phases[${original}].action_risk_armed = true`
        : `phases[${original}].config.phase_type = "${step.phaseType}" (the engine always arms it)`,
    })
  }
  return gates
}

// ── the derivation ────────────────────────────────────────────────────────────────────────

export function deriveTeam(
  phases: readonly PhaseSpecJSON[] | null | undefined,
  kbTools: readonly string[] = NO_KB_TOOLS,
  nameContext: NameContext = NO_NAME_CONTEXT,
): TeamModel {
  if (!Array.isArray(phases)) {
    return { steps: [], gates: [], lines: [], absence: "empty", oneStep: false }
  }

  const ordered = orderSteps(phases)

  // Slugs are author input, so a Map, never an object literal. The first step wins a tie.
  const stepNumberOf = new Map<string, number>()
  ordered.forEach(({ slug }, i) => {
    if (!stepNumberOf.has(slug)) stepNumberOf.set(slug, i + 1)
  })

  const steps: TeamStep[] = []
  const gates: TeamGate[] = []
  const handoffs: TeamLine[] = []
  const gateLines: TeamLine[] = []

  ordered.forEach(({ phase, original, slug }, runIndex) => {
    const config: unknown = phase.config
    const hasConfig = isRow(config)
    const type = hasConfig && typeof config.phase_type === "string" ? config.phase_type : ""

    const title = titleOf(phase, hasConfig, type, nameContext)
    const sentence = own(PHASE_TYPE_SENTENCES, type) ?? (type || TEAM_STEP_UNTYPED)
    const role = sentence === title ? (own(PHASE_TYPE_SUBTITLES, type) ?? sentence) : sentence
    const label = own(PHASE_TYPE_LABELS, type) ?? (type || TEAM_STEP_UNTYPED)

    const seat = hasConfig && type === BATCH_TYPE ? seatsOf(config, original) : null

    const step: TeamStep = {
      id: `step-${runIndex}`,
      number: runIndex + 1,
      slug,
      phaseType: type,
      title,
      role,
      technical: `${label} · ${slug}`,
      seats: seat ? seat.seats : null,
      seatDots: seat ? Math.min(seat.seats, SEAT_DOT_CAP) : 0,
      seatSource: seat ? seat.source : null,
    }
    steps.push(step)
    handoffs.push({
      kind: "handoff",
      from: "orchestrator",
      to: step.id,
      source: `phases[${original}].phase_index = ${String(phase.phase_index)}`,
    })

    // Declared gates, in the definition's own validator order.
    const validators: unknown = phase.validators
    if (Array.isArray(validators)) {
      validators.forEach((v: unknown, k: number) => {
        if (!isRow(v)) return
        const kind = typeof v.kind === "string" ? v.kind : ""
        const judge = kind === JUDGE_KIND
        const words = kind === "" ? GATE_KIND_MISSING : (own(GATE_KIND_WORDS, kind) ?? kind)
        const vConfig = v.config
        const criteria =
          judge && isRow(vConfig) && typeof vConfig.criteria === "string" && vConfig.criteria.length > 0
            ? vConfig.criteria
            : null
        const { failure, raw, jumpTo } = failureWords(v, stepNumberOf)
        const id = `gate-${runIndex}-${k}`
        const source = `phases[${original}].validators[${k}].kind = "${kind}"`
        gates.push({
          id,
          stepId: step.id,
          stepNumber: step.number,
          judge,
          derived: null,
          kind,
          words,
          criteria,
          failure,
          jumpTo,
          source,
        })
        gateLines.push({ kind: judge ? "judge" : "check", from: id, to: step.id, source })
        if (jumpTo !== null) {
          gateLines.push({
            kind: "jump",
            from: id,
            to: `step-${jumpTo - 1}`,
            source: `phases[${original}].validators[${k}].on_failure = "${raw}"`,
          })
        }
      })
    }

    // Derived gates, after the declared ones. `groundingCauseOf` reads `config` unguarded.
    if (hasConfig) {
      for (const gate of derivedGates(phase, step, original, runIndex, kbTools)) {
        gates.push(gate)
        gateLines.push({ kind: "check", from: gate.id, to: step.id, source: gate.source })
      }
    }
  })

  const absence: TeamAbsence =
    steps.length === 0 ? "empty" : gates.length === 0 ? "none" : gates.some((g) => g.judge) ? null : "noJudge"

  return {
    steps,
    gates,
    lines: [...handoffs, ...gateLines],
    absence,
    oneStep: steps.length === 1,
  }
}
