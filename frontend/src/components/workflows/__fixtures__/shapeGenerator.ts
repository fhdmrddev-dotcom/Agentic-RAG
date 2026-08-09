/**
 * Phase 184-05 Task 2 (R2, D-184-17) — the hand-rolled shape generator.
 *
 * WHY THIS EXISTS, AND WHY IT CARRIES THE COVERAGE. D-184-17 pairs a committed corpus
 * dump with generated shapes, and is explicit that the dump ALONE would barely exercise
 * the serializer: the live corpus is 2-steps-modal and uses `skip_to_phase` ZERO times.
 * Everything the round-trip property actually needs to be hard about — a branch edge, a
 * broken branch edge, a gate-heavy phase, a deep chain, an index gap, a duplicate index,
 * a duplicate slug, and one phase per config-union member with EVERY optional field
 * populated — is hand-authored here. This module is what earns R2; the dump is
 * corroboration.
 *
 * HAND-AUTHORED, NOT TRANSCRIBED, AND SAID SO. Unlike `canvasFixtures.ts` — whose
 * entries are transcribed from checked-in artifacts and cited `file:line` — every shape
 * below is invented for coverage. Each one names what it covers and states plainly that
 * it corresponds to no database row and no seed. Nothing here is a claim about the live
 * corpus; the dump's own `_provenance` block is the only such claim in the phase.
 *
 * NO NEW DEPENDENCY. `zundo` was this phase's one net-new dependency (184-04) and this
 * is a plain module: no property-testing library, no generator library, no randomness.
 * Shapes are deterministic and enumerated, so a failure names one shape and reproduces
 * on the next run.
 *
 * FRESH OBJECTS PER CALL. `generatedShapes()` builds a new object graph every call, so
 * two callers can never alias one another's phases. The round-trip property asserts
 * REFERENCE identity, and a shared module-level constant would make "the same object"
 * true for an uninteresting reason.
 *
 * `canvasFixtures.ts` IS NOT TOUCHED by this module — only its `CanvasFixture` TYPE is
 * reused, so the snapshot corpus and its acceptance guard stay exactly as they ship
 * (D-184-17, and CONTEXT anti-drift note 2).
 */
import type { CanvasFixture } from "@/components/workflows/__fixtures__/canvasFixtures"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"

/** Every field of the backend's `SkillSnapshot` (`app/models/harness.py:43-48`) —
 *  synthetic values, present so a rebuild that forgot the key would be caught. */
const skillSnapshot = () => ({
  skill_id: "11111111-1111-4111-8111-111111111111",
  name: "synthetic-skill",
  description: "hand-authored; corresponds to no stored skill",
  instructions: "hand-authored instructions body",
  files: ["a.md", "b.py"],
  storage_prefix: "synthetic/prefix",
})

/** Every field of the backend's `ValidatorSpec` (`app/models/harness.py:178-186`),
 *  including the three `toCanvas` drops outright: `config`, `max_retries`, `timing`. */
const fullValidator = (kind: string, onFailure: string) => ({
  kind,
  config: { threshold: 0.9, note: "hand-authored" },
  on_failure: onFailure,
  max_retries: 3,
  timing: "post",
})

/** A plain step whose only job is to occupy a position in a chain. */
const step = (slug: string, index: number, phaseType = "llm_single"): PhaseSpecJSON => ({
  slug,
  phase_index: index,
  config: { phase_type: phaseType },
})

/**
 * The six full-field configs, one per `PhaseConfig` union member
 * (`app/models/harness.py:52-154`). EVERY optional field is populated — this is the
 * field-drop proof: `toCanvas` reads six things off a phase, and every key below that
 * it does not read must still be present, and reference-identical, after the round trip.
 */
const FULL_CONFIGS: Record<string, Record<string, unknown>> = {
  programmatic: {
    phase_type: "programmatic",
    fn: "split_topic",
    input_keys: ["topic", "scope"],
  },
  llm_single: {
    phase_type: "llm_single",
    prompt: "hand-authored prompt body",
    model: "synthetic-model",
    temperature: 0.4,
    folder_scope: ["22222222-2222-4222-8222-222222222222"],
    skill_ref: "33333333-3333-4333-8333-333333333333",
    skill_snapshot: skillSnapshot(),
  },
  llm_agent: {
    phase_type: "llm_agent",
    prompt: "hand-authored prompt body",
    available_tools: ["search_documents", "execute_code"],
    max_steps: 12,
    wall_clock_seconds: 900,
    model: "synthetic-model",
    folder_scope: ["22222222-2222-4222-8222-222222222222"],
    skill_ref: "33333333-3333-4333-8333-333333333333",
    skill_snapshot: skillSnapshot(),
  },
  llm_batch_agents: {
    phase_type: "llm_batch_agents",
    prompt: "hand-authored prompt body",
    available_tools: ["search_documents"],
    max_steps: 12,
    max_parallel_agents: 5,
    merge_strategy: "concat_numbered",
    wall_clock_seconds: 900,
    model: "synthetic-model",
    folder_scope: ["22222222-2222-4222-8222-222222222222"],
    skill_ref: "33333333-3333-4333-8333-333333333333",
    skill_snapshot: skillSnapshot(),
  },
  llm_human_input: {
    phase_type: "llm_human_input",
    prompt: "hand-authored ask body",
    options: ["Approve", "Revise"],
    timeout_seconds: 300,
  },
  llm_emit: {
    phase_type: "llm_emit",
    prompt: "hand-authored prompt body",
    emitter: "render_template",
    model: "synthetic-model",
    folder_scope: ["22222222-2222-4222-8222-222222222222"],
    skill_ref: "33333333-3333-4333-8333-333333333333",
    skill_snapshot: skillSnapshot(),
    citation_policy: "strict",
    integrity_policy: "strict",
  },
}

/** The closed six-member type set, in the shipped `PHASE_TYPE_SENTENCES` order. */
export const GENERATED_PHASE_TYPES = [
  "programmatic",
  "llm_single",
  "llm_agent",
  "llm_batch_agents",
  "llm_human_input",
  "llm_emit",
] as const

const HAND = "hand-authored, test-only (184-05 shapeGenerator; no database row, no seed)"

/**
 * generatedShapes — the ONE list the round-trip sweep iterates alongside the committed
 * dump. A shape authored but not returned here would be silently omitted, so this
 * function is the contract: 15 shapes covering node counts 0, 1, 2, 3 and 12, all six
 * phase types, both branch outcomes, both index anomalies and the duplicate-slug
 * fail-safe.
 */
export function generatedShapes(): CanvasFixture[] {
  const shapes: CanvasFixture[] = []

  /** One shape per config-union member, EVERY optional field populated. This is the
   *  field-drop proof and the reason the generator, not the dump, earns R2. */
  for (const phaseType of GENERATED_PHASE_TYPES) {
    shapes.push({
      name: `every-field ${phaseType} (all optional config keys populated)`,
      phases: [
        {
          slug: `only-${phaseType}`,
          phase_index: 0,
          name: `A named ${phaseType} step`,
          config: { ...FULL_CONFIGS[phaseType] } as PhaseSpecJSON["config"],
          validators: [fullValidator("structure_check", "retry")],
        },
      ],
      source: HAND,
    })
  }

  /** A RESOLVING `skip_to_phase` branch: `assess` fails over to `escalate`, jumping
   *  `draft`. The live corpus uses `skip_to_phase` zero times, so this shape is the
   *  only branch coverage the property gets. */
  shapes.push({
    name: "skip resolving — a branch edge landing on a real phase",
    phases: [
      step("gather", 0, "llm_agent"),
      {
        slug: "assess",
        phase_index: 1,
        config: { phase_type: "llm_single" },
        validators: [fullValidator("structure_check", "skip_to_phase:escalate")],
      },
      step("escalate", 2, "llm_human_input"),
    ],
    source: HAND,
  })

  /** An UNRESOLVABLE `skip_to_phase`: the validator names a slug no phase provides, so
   *  `toCanvas` emits a reserved-id stub node. `fromCanvas` must drop that stub and
   *  still return exactly the two real phases. */
  shapes.push({
    name: "skip unresolvable — a branch edge to a slug no phase provides",
    phases: [
      step("start", 0, "llm_agent"),
      {
        slug: "check",
        phase_index: 1,
        config: { phase_type: "llm_single" },
        validators: [fullValidator("structure_check", "skip_to_phase:nowhere")],
      },
    ],
    source: HAND,
  })

  /** A GATE-HEAVY phase: four validators, each carrying `config`, `timing` and
   *  `max_retries` — three fields `toCanvas` drops outright. */
  shapes.push({
    name: "gate-heavy — one phase carrying four fully-populated validators",
    phases: [
      step("retrieve", 0, "llm_agent"),
      {
        slug: "emit",
        phase_index: 1,
        config: { ...FULL_CONFIGS.llm_emit } as PhaseSpecJSON["config"],
        validators: [
          fullValidator("citations_required", "fail_run"),
          fullValidator("output_file_valid", "fail_run"),
          { ...fullValidator("json_schema", "retry"), timing: "pre" },
          fullValidator("llm_judge_rubric", "ask_user"),
        ],
      },
    ],
    source: HAND,
  })

  /** The degenerate spine: one phase, hence no preceding edge before the ○ end cap. */
  shapes.push({
    name: "single phase — the degenerate spine",
    phases: [step("answer", 0)],
    source: HAND,
  })

  /** The empty draft — the single most common live canvas state (D-183-11). The round
   *  trip must be an empty array in and an empty array out, with no end cap in between. */
  shapes.push({
    name: "zero phases — the empty draft",
    phases: [],
    source: HAND,
  })

  /** A 12-DEEP chain, four steps past the live 5-phase maximum. Nothing about the
   *  serializer is length-sensitive, and this shape is what proves it. */
  shapes.push({
    name: "deep chain — 12 sequential steps",
    phases: Array.from({ length: 12 }, (_unused, i) => step(`deep-${i}`, i)),
    source: HAND,
  })

  /** A non-contiguous `phase_index` — `[0, 1, 4]`. The load-bearing regression: a
   *  `fromCanvas` that renumbered would hand back `[0, 1, 2]` and quietly rewrite the
   *  user's spine on save. Renumbering is `definitionOps.renumber`'s job, not this
   *  serializer's. */
  shapes.push({
    name: "phase_index gap — indices [0, 1, 4] must survive untouched",
    phases: [step("first", 0, "llm_agent"), step("second", 1), step("stranded", 4)],
    source: HAND,
  })

  /** A DUPLICATE `phase_index` — two phases both at 2. `toCanvas`'s comparator is TOTAL
   *  (index, then slug), so the order is deterministic; the property compares against
   *  that same comparator rather than against the input order. */
  shapes.push({
    name: "duplicate phase_index — two phases both at index 2",
    phases: [step("alpha", 0, "programmatic"), step("zulu", 2), step("bravo", 2)],
    source: HAND,
  })

  /** A DUPLICATE SLUG. `PhaseSpec.slug` is an unconstrained `str` on the backend, so a
   *  slug-keyed map can collapse two real phases into one. This shape drives
   *  `fromCanvas`'s fail-safe branch: the source is handed back untouched, because
   *  losing a step on save is the worst failure available here. */
  shapes.push({
    name: "duplicate-slug — the fromCanvas fail-safe branch",
    phases: [step("step", 0, "llm_agent"), step("step", 1)],
    source: HAND,
  })

  return shapes
}
