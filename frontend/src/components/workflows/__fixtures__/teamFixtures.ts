/**
 * Phase 290-01 (VIS-01) — the team picture's planted fixtures.
 *
 * Every entry below is HAND-AUTHORED and TEST-ONLY: no database row is seeded from this
 * module, and it performs no I/O of any kind. Each one exists to prove one honesty rule of
 * `teamModel.deriveTeam`, named in its JSDoc. The transcribed corpus lives in
 * `canvasFixtures.ts`; this module imports nothing from it and edits nothing there, so the
 * two corpora cannot drift into one another.
 */
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"

/**
 * The 7-step STRESS shape — hand-authored, test-only, no database row is seeded from this.
 *
 * All seven phase types, stored in a deliberately NON-sorted array order so the run-order
 * sort is exercised and every `source` path must name the ORIGINAL array index. Step 2
 * (`screen`) carries a `structure_check` whose `skip_to_phase` names step 5 (`sign-off`):
 * the one jump line. Step 3 (`assess`) carries the one judge, with its rubric text on
 * `config.criteria`. Step 4 (`summarize`) carries a PRE check, which never redoes its step.
 */
export const vendorRiskReview: PhaseSpecJSON[] = [
  { slug: "report", phase_index: 6, config: { phase_type: "llm_emit" } },
  {
    slug: "assess",
    phase_index: 2,
    config: { phase_type: "llm_batch_agents", max_parallel_agents: 5 },
    validators: [
      { kind: "llm_judge_rubric", config: { criteria: "Every vendor risk names its evidence" } },
    ],
  },
  { slug: "intake", phase_index: 0, config: { phase_type: "programmatic" } },
  { slug: "notify", phase_index: 5, config: { phase_type: "external_action" } },
  {
    slug: "screen",
    phase_index: 1,
    config: { phase_type: "llm_agent" },
    validators: [{ kind: "structure_check", on_failure: "skip_to_phase:sign-off" }],
  },
  { slug: "sign-off", phase_index: 4, config: { phase_type: "llm_human_input" } },
  {
    slug: "summarize",
    phase_index: 3,
    config: { phase_type: "llm_single" },
    validators: [{ kind: "regex_match", on_failure: "fail_run", timing: "pre" }],
  },
]

/**
 * The PRODUCTION-SHAPED 2-step — hand-authored, test-only, no database row is seeded from
 * this. An `llm_agent` with no knowledge-base tool, then an `llm_emit`, and no validators:
 * the picture must say "nothing checks this work" and draw only the two handoffs.
 */
export const productionTwoStep: PhaseSpecJSON[] = [
  { slug: "retrieve", phase_index: 0, config: { phase_type: "llm_agent" } },
  { slug: "emit", phase_index: 1, config: { phase_type: "llm_emit" } },
]

/**
 * The PRODUCTION-SHAPED grounded 3-step — hand-authored, test-only, no database row is
 * seeded from this. Step 1 reads `search_documents`, so with that tool in `kbTools` its
 * grounding cause is `detected` and the engine adds a citations gate the definition does
 * not list (D-17, D-18). With `kbTools` empty, nothing is derived.
 */
export const groundedThreeStep: PhaseSpecJSON[] = [
  {
    slug: "search",
    phase_index: 0,
    config: { phase_type: "llm_agent", available_tools: ["search_documents"] },
  },
  { slug: "draft", phase_index: 1, config: { phase_type: "llm_single" } },
  { slug: "emit", phase_index: 2, config: { phase_type: "llm_emit" } },
]

/**
 * An ESCALATED step — hand-authored, test-only, no database row is seeded from this. A
 * dial-bearing `llm_agent` with a non-knowledge-base tool and `grounding_escalated: true`,
 * so its cause is `escalated`. The engine adds no gate for that cause, so neither may the
 * picture (D-18).
 */
export const escalatedStep: PhaseSpecJSON[] = [
  {
    slug: "write",
    phase_index: 0,
    config: { phase_type: "llm_agent", available_tools: ["web_search"] },
    grounding_escalated: true,
  },
]

/**
 * An ALREADY-SET deliverable — hand-authored, test-only, no database row is seeded from
 * this. An `llm_emit` whose own `citation_policy` is strict: cause `already-set`. That
 * policy is the step's own setting, not a gate, so no gate is derived (D-20).
 */
export const alreadySetEmit: PhaseSpecJSON[] = [
  { slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "strict" } },
]

/**
 * An ARMED step — hand-authored, test-only, no database row is seeded from this. An
 * `external_action` with `action_risk_armed: true` gets the derived "stops and asks you"
 * check, with no failure line (D-17).
 */
export const armedStep: PhaseSpecJSON[] = [
  {
    slug: "send",
    phase_index: 0,
    config: { phase_type: "external_action" },
    action_risk_armed: true,
  },
]

/**
 * A batch step ABOVE the dot cap — hand-authored, test-only, no database row is seeded
 * from this. Twenty seats draw eight dots, and the words still say twenty (D-14).
 */
export const batchTwenty: PhaseSpecJSON[] = [
  {
    slug: "fanout",
    phase_index: 0,
    config: { phase_type: "llm_batch_agents", max_parallel_agents: 20 },
  },
]

/**
 * Four HOSTILE batch counts — hand-authored, test-only, no database row is seeded from
 * this. `0`, `-1`, the string `"5"` and an absent field each read as the engine default 5.
 */
export const batchHostile: PhaseSpecJSON[] = [
  { slug: "zero", phase_index: 0, config: { phase_type: "llm_batch_agents", max_parallel_agents: 0 } },
  { slug: "negative", phase_index: 1, config: { phase_type: "llm_batch_agents", max_parallel_agents: -1 } },
  { slug: "stringly", phase_index: 2, config: { phase_type: "llm_batch_agents", max_parallel_agents: "5" } },
  { slug: "absent", phase_index: 3, config: { phase_type: "llm_batch_agents" } },
]

/**
 * MALFORMED author input — hand-authored, test-only, no database row is seeded from this.
 * A `constructor` phase type (a prototype key on a plain object), a `__proto__` kind, an
 * unresolvable skip, a validator with no kind, a non-array `validators`, and one phase with
 * no `config` at all. Every part must resolve to its honest raw floor, and nothing throws
 * (T-290-01, T-290-02).
 */
export const malformed: PhaseSpecJSON[] = [
  { slug: "odd", phase_index: 0, config: { phase_type: "constructor" } },
  {
    slug: "proto",
    phase_index: 1,
    config: { phase_type: "llm_single" },
    validators: [
      { kind: "__proto__" },
      { kind: "structure_check", on_failure: "skip_to_phase:gone" },
      { on_failure: "ask_user" },
    ],
  },
  {
    slug: "bad-validators",
    phase_index: 2,
    config: { phase_type: "llm_single" },
    validators: "not-an-array",
  } as unknown as PhaseSpecJSON,
  { slug: "no-config", phase_index: 3 } as unknown as PhaseSpecJSON,
]

/**
 * The FAILURE-WORDS matrix — hand-authored, test-only, no database row is seeded from
 * this. One step whose validators cover every `on_failure` disposition, the backend
 * default, an unknown value (which stops the run, as the engine routes it to `fail_run`),
 * `max_retries` 0 and 1, and a PRE `retry` (D-19).
 */
export const retryMatrix: PhaseSpecJSON[] = [
  {
    slug: "check",
    phase_index: 0,
    config: { phase_type: "llm_single" },
    validators: [
      { kind: "regex_match", on_failure: "fail_run" },
      { kind: "regex_match", on_failure: "retry" },
      { kind: "regex_match", on_failure: "ask_user" },
      { kind: "regex_match" },
      { kind: "regex_match", on_failure: "explode" },
      { kind: "regex_match", on_failure: "fail_run", max_retries: 0 },
      { kind: "regex_match", on_failure: "fail_run", max_retries: 1 },
      { kind: "regex_match", on_failure: "retry", timing: "pre" },
    ],
  },
]

/** Every planted shape, for the SC#3 sweep. A shape added above but not here is unswept. */
export const TEAM_FIXTURES: { name: string; phases: PhaseSpecJSON[] }[] = [
  { name: "vendorRiskReview", phases: vendorRiskReview },
  { name: "productionTwoStep", phases: productionTwoStep },
  { name: "groundedThreeStep", phases: groundedThreeStep },
  { name: "escalatedStep", phases: escalatedStep },
  { name: "alreadySetEmit", phases: alreadySetEmit },
  { name: "armedStep", phases: armedStep },
  { name: "batchTwenty", phases: batchTwenty },
  { name: "batchHostile", phases: batchHostile },
  { name: "malformed", phases: malformed },
  { name: "retryMatrix", phases: retryMatrix },
]
