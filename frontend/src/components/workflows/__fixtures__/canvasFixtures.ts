/**
 * Phase 183-05 Task 2 (CANVAS-01 / SC#4, D-183-09) — the canvas fixture corpus.
 *
 * NET-NEW STRUCTURE, stated plainly: the frontend has no shared fixture module
 * anywhere — every suite declares its own inline module-level consts. This directory
 * was created in plan 183-02 for the cross-language skip-parse table and is extended
 * here rather than following an existing frontend convention. The backend does keep
 * `backend/tests/fixtures/`, so the concept is house-approved; it simply had no
 * frontend precedent.
 *
 * TRANSCRIBED, NEVER READ LIVE. Two live database reads on the same day disagreed —
 * 183-CONTEXT and sketches 134-136 quote 119 phases / 40 zero-phase / 10 named / two
 * 5-phase definitions, while the reproducible read this session found 51 / 71 / 0 /
 * one (correction C-3) — and a definition that was 5-phase at sketch time is 0-phase
 * now (C-4). A snapshot test whose input drifts is not a gate. Every entry below is
 * therefore copied from a CHECKED-IN artifact and carries a JSDoc line naming that
 * artifact by `file:line`, so a future reader can re-verify with an editor and no
 * database. This module performs no I/O of any kind.
 *
 * PATH CONVENTION: SQL sources are cited relative to the repo's migrations directory
 * (`migrations/NNN_*.sql`). That is deliberate — the acceptance guard for this file
 * forbids the local-stack tokens that would indicate a live read, and the full
 * platform-prefixed path contains one of them. The files are unambiguous by number.
 *
 * WHAT IS TRANSCRIBED: the fields the projection reads — `slug`, `phase_index`,
 * `config.phase_type`, `config.citation_policy` and `validators[].kind` /
 * `validators[].on_failure` — PLUS, since Phase 187-12, the three fields the
 * CONFIG-DERIVED node face reads (`phaseVocabulary.derivedFace`, D-187-04):
 * `config.skill_ref`, `config.folder_scope`, and the DEFINITION-level template asset.
 * The last one is carried as `CanvasFixture.assets` rather than on a phase, because
 * that is where it lives — `definition.assets[]` where `kind === "template"` — and
 * smuggling it into a phase would misdescribe the corpus.
 *
 * Prompt bodies and tool lists are still omitted on purpose: they are large, they
 * change, and neither `toCanvas` nor `nodeTitle` reads them.
 *
 * The three derived-tier fields are INERT in the projection snapshot, which is why
 * adding them moved no snapshot byte: `nodeTitle` resolves them only against an
 * injected `NameContext` (D-187-05), and this module's own suites pass none. They
 * exist for `phaseVocabulary.corpus.test.ts` (SC#5), which declares the id→name maps
 * beside the ids below.
 */
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"

// ── The id→name lookup subjects (Phase 187-12, D-187-05) ────────────────────────
// `folder_scope` and `skill_ref` store RESOLVED UUIDs and never names
// (`backend/app/models/harness.py:88`, `:93`), so the derived face can only resolve
// them through an injected context. The corpus therefore has to carry ids; what is
// transcribed is the SHAPE (a uuid string, and a LIST of them for `folder_scope`),
// never a particular live row's key — this module still reads no database.

/** The bound skill the corpus binds on ONE hand-authored phase. The literal is the
 *  one `canvasModel.purity.test.ts:283` already sweeps this corpus with, reused so
 *  the two suites exercise the skill tier with the SAME subject rather than two ids
 *  that can drift. Shape source: `backend/app/models/harness.py:93`. */
export const CORPUS_SKILL_ID = "3f2b8c40-1111-4a2b-9c3d-000000000001"

/** The single scoped folder on ONE hand-authored phase. Literal from
 *  `canvasModel.purity.test.ts:284`; shape from `backend/app/models/harness.py:88`
 *  (`folder_scope` is a LIST — only a single entry can name a step). */
export const CORPUS_FOLDER_ID = "9a1e77d2-2222-4b3c-8d4e-000000000002"

/** The PM pack's project folder. Every PM-pack phase scopes to it —
 *  `scripts/seed-pm-pack.py:361` and `:372`, both `"folder_scope": [folder_id]`. That
 *  script resolves the id at seed time, so the id itself is hand-authored, test-only
 *  and only its SHAPE is transcribed; the folder's display NAME is a checked-in
 *  constant, `DEMO_FOLDER_NAME` at `scripts/seed-pm-pack.py:88`. */
export const PM_FOLDER_ID = "00000000-0000-0000-0000-0000001040f0"

// ── The 4 canonical seeds ───────────────────────────────────────────────────────
// Transcribed from `backend/tests/conftest.py:837-938` (`_four_seed_defs`, whose
// docstring declares itself the SINGLE SOURCE OF TRUTH for the definition JSONB
// shipped as migration 061) and cross-checked line-for-line against
// `migrations/061_harness_seed_templates.sql:48-236`. The two agree.

/** Canonical seed 1 — `research_summarize`: llm_agent → llm_single.
 *  Source: `backend/tests/conftest.py:852-866`; SQL `migrations/061_harness_seed_templates.sql:53-89`. */
export const researchSummarize: PhaseSpecJSON[] = [
  { slug: "research", phase_index: 0, config: { phase_type: "llm_agent" } },
  { slug: "summarize", phase_index: 1, config: { phase_type: "llm_single" } },
]

/** Canonical seed 2 — `plan_execute_verify`: llm_single → llm_agent → llm_single,
 *  the verify phase carrying a `regex_match` validator with `on_failure: "retry"`
 *  (a NON-skip disposition — it must yield no edge and no stub).
 *  Source: `backend/tests/conftest.py:867-892`; SQL `migrations/061_harness_seed_templates.sql:92-145`. */
export const planExecuteVerify: PhaseSpecJSON[] = [
  { slug: "plan", phase_index: 0, config: { phase_type: "llm_single" } },
  { slug: "execute", phase_index: 1, config: { phase_type: "llm_agent" } },
  {
    slug: "verify",
    phase_index: 2,
    config: { phase_type: "llm_single" },
    validators: [{ kind: "regex_match", on_failure: "retry" }],
  },
]

/** Canonical seed 3 — `literature_review`: programmatic → llm_batch_agents → llm_single.
 *  The batch phase declares `max_parallel_agents: 5` and MUST still render as ONE node.
 *  Source: `backend/tests/conftest.py:893-912`; SQL `migrations/061_harness_seed_templates.sql:148-197`. */
export const literatureReview: PhaseSpecJSON[] = [
  { slug: "split", phase_index: 0, config: { phase_type: "programmatic" } },
  {
    slug: "review",
    phase_index: 1,
    config: { phase_type: "llm_batch_agents", max_parallel_agents: 5 },
  },
  { slug: "merge", phase_index: 2, config: { phase_type: "llm_single" } },
]

/** Canonical seed 4 — `doc_qa_human`: llm_agent → llm_human_input → llm_single.
 *  The only canonical seed carrying the "Waits for you" badge slot.
 *  Source: `backend/tests/conftest.py:913-932`; SQL `migrations/061_harness_seed_templates.sql:200-246`. */
export const docQaHuman: PhaseSpecJSON[] = [
  { slug: "draft", phase_index: 0, config: { phase_type: "llm_agent" } },
  { slug: "confirm", phase_index: 1, config: { phase_type: "llm_human_input" } },
  { slug: "finalize", phase_index: 2, config: { phase_type: "llm_single" } },
]

// ── The Starter Library ×3 ──────────────────────────────────────────────────────
// The three curated starters (what 183-CONTEXT calls "the 3 PM-pack starters" —
// correction C-6). Every one is topologically identical: llm_agent → llm_emit with a
// strict citation policy plus the `citations_required` + `output_file_valid` gate set,
// both gated `fail_run`. They are the corpus's ONLY `llm_emit` witnesses.

/** Starter 1 — `risk-register`. Source: `migrations/094_starter_workflows.sql:59-109`
 *  (slug `:62`, phases `:70-96`, the emit gate set `:91-94`). */
export const riskRegister: PhaseSpecJSON[] = [
  { slug: "retrieve", phase_index: 0, config: { phase_type: "llm_agent" }, validators: [] },
  {
    slug: "emit",
    phase_index: 1,
    config: {
      phase_type: "llm_emit",
      emitter: "render_template",
      citation_policy: "strict",
      integrity_policy: "strict",
    },
    validators: [
      { kind: "citations_required", on_failure: "fail_run" },
      { kind: "output_file_valid", on_failure: "fail_run" },
    ],
  },
]

/** Starter 2 — `weekly-status-report`. Source: `migrations/094_starter_workflows.sql:114-164`
 *  (slug `:117`, phases `:125-151`). Topologically identical to `risk-register`. */
export const weeklyStatusReport: PhaseSpecJSON[] = [
  { slug: "retrieve", phase_index: 0, config: { phase_type: "llm_agent" }, validators: [] },
  {
    slug: "emit",
    phase_index: 1,
    config: {
      phase_type: "llm_emit",
      emitter: "render_template",
      citation_policy: "strict",
      integrity_policy: "strict",
    },
    validators: [
      { kind: "citations_required", on_failure: "fail_run" },
      { kind: "output_file_valid", on_failure: "fail_run" },
    ],
  },
]

/** Starter 3 — `compliance-gap-report` (authored fresh, not promoted).
 *  Source: `migrations/094_starter_workflows.sql:169-219` (slug `:172`, phases `:180-205`). */
export const complianceGapReport: PhaseSpecJSON[] = [
  { slug: "retrieve", phase_index: 0, config: { phase_type: "llm_agent" }, validators: [] },
  {
    slug: "emit",
    phase_index: 1,
    config: {
      phase_type: "llm_emit",
      emitter: "render_template",
      citation_policy: "strict",
      integrity_policy: "strict",
    },
    validators: [
      { kind: "citations_required", on_failure: "fail_run" },
      { kind: "output_file_valid", on_failure: "fail_run" },
    ],
  },
]

// ── The PM pack ×2 (the operator's private originals the starters were promoted from) ──

/** PM original 1 — `pm-weekly-status-report`. Source: `scripts/seed-pm-pack.py:104-109`
 *  (slug) and `:353-389` (the shared `_build_def` phase shape), named at `:401-426`.
 *  Its `folder_scope` is now transcribed (Phase 187-12): BOTH phases carry
 *  `[folder_id]` — `scripts/seed-pm-pack.py:361` and `:372` — which is what makes the
 *  PM pack the corpus's only REAL single-entry folder-scope witness. The projection
 *  still ignores it; only the derived face reads it, and only with a context. */
export const pmWeeklyStatusReport: PhaseSpecJSON[] = [
  {
    slug: "retrieve",
    phase_index: 0,
    config: { phase_type: "llm_agent", folder_scope: [PM_FOLDER_ID] },
    validators: [],
  },
  {
    slug: "emit",
    phase_index: 1,
    config: {
      phase_type: "llm_emit",
      emitter: "render_template",
      folder_scope: [PM_FOLDER_ID],
      citation_policy: "strict",
      integrity_policy: "strict",
    },
    validators: [
      { kind: "citations_required", on_failure: "fail_run" },
      { kind: "output_file_valid", on_failure: "fail_run" },
    ],
  },
]

/** PM original 2 — `pm-risk-register`. Source: `scripts/seed-pm-pack.py:110-114` (slug)
 *  and `:353-389` (the shared phase shape), named at `:429-445`. Same transcribed
 *  `folder_scope: [folder_id]` on both phases (`scripts/seed-pm-pack.py:361`, `:372`). */
export const pmRiskRegister: PhaseSpecJSON[] = [
  {
    slug: "retrieve",
    phase_index: 0,
    config: { phase_type: "llm_agent", folder_scope: [PM_FOLDER_ID] },
    validators: [],
  },
  {
    slug: "emit",
    phase_index: 1,
    config: {
      phase_type: "llm_emit",
      emitter: "render_template",
      folder_scope: [PM_FOLDER_ID],
      citation_policy: "strict",
      integrity_policy: "strict",
    },
    validators: [
      { kind: "citations_required", on_failure: "fail_run" },
      { kind: "output_file_valid", on_failure: "fail_run" },
    ],
  },
]

// ── The 5-phase maximum ─────────────────────────────────────────────────────────

/** `eval_coverage` — the ONLY 5-phase definition and the only one covering all five
 *  non-emit phase types in one flow: programmatic → llm_batch_agents → llm_agent →
 *  llm_human_input → llm_single. Zero phase names, zero validators. This is what UAT
 *  row U-2 exercises (five columns must fit without horizontal page overflow).
 *  Source: `migrations/066_eval_coverage_seed.sql:61-124` (phases `:70-122`). */
export const evalCoverage: PhaseSpecJSON[] = [
  { slug: "split", phase_index: 0, config: { phase_type: "programmatic" }, validators: [] },
  {
    slug: "fanout",
    phase_index: 1,
    config: { phase_type: "llm_batch_agents", max_parallel_agents: 5 },
    validators: [],
  },
  { slug: "deep_dive", phase_index: 2, config: { phase_type: "llm_agent" }, validators: [] },
  { slug: "confirm", phase_index: 3, config: { phase_type: "llm_human_input" }, validators: [] },
  { slug: "summarize", phase_index: 4, config: { phase_type: "llm_single" }, validators: [] },
]

// ── The degenerate + synthetic edge cases ───────────────────────────────────────

/** The EMPTY draft — hand-authored, test-only (no checked-in source; a zero-phase
 *  definition has no rows to transcribe). It is nonetheless the single most common
 *  canvas state in the live corpus, which is why D-183-11 locks its behaviour: no end
 *  cap, no ghost node, no chrome. */
export const emptyDraft: PhaseSpecJSON[] = []

/** A ONE-phase definition — hand-authored, test-only. The live corpus contains
 *  several; the layout maths has its own degenerate case here (no preceding edge
 *  before the ○ end cap), so it is pinned rather than assumed. */
export const singlePhase: PhaseSpecJSON[] = [
  { slug: "answer", phase_index: 0, config: { phase_type: "llm_single" } },
]

/** The SYNTHETIC branching shape (D-183-09) — hand-authored, test-only:
 *  `gather → assess ⇢(on fail) escalate`, skipping `draft`. Sketch 136's proposed
 *  shape. `skip_to_phase` appears ZERO times across the whole live corpus, so SC#1's
 *  branch edge cannot be demonstrated from real data. NO database row is seeded from
 *  this and NO new starter workflow ships — shipping one is a Starter Library /
 *  Phase 187 product decision, not a projection phase's to make.
 *
 *  Phase 187-12 extends `assess` with a `skill_ref` (`CORPUS_SKILL_ID` above; shape
 *  from `backend/app/models/harness.py:93`). It is the corpus's ONLY skill witness,
 *  and it lands here deliberately: `assess` and `draft` are both bare `llm_single`
 *  today, so binding a skill to one of them creates the only pair in the whole corpus
 *  that is MATERIALLY DIFFERENT yet renders one face under the pre-187 two-tier
 *  ladder. That pair is what makes SC#5 check 2 falsifiable rather than vacuous —
 *  see `phaseVocabulary.corpus.test.ts`. No real corpus row carries a `skill_ref`
 *  (measured: zero across `migrations/`), so a hand-authored witness is the honest
 *  option; inventing a fake starter workflow would not be. */
export const branching: PhaseSpecJSON[] = [
  { slug: "gather", phase_index: 0, config: { phase_type: "llm_agent" } },
  {
    slug: "assess",
    phase_index: 1,
    config: { phase_type: "llm_single", skill_ref: CORPUS_SKILL_ID },
    validators: [{ kind: "structure_check", on_failure: "skip_to_phase:escalate" }],
  },
  { slug: "draft", phase_index: 2, config: { phase_type: "llm_single" } },
  { slug: "escalate", phase_index: 3, config: { phase_type: "llm_human_input" } },
]

/** The UNRESOLVABLE skip (D-183-10) — hand-authored, test-only. A validator names a
 *  slug no phase provides. The shipped spine drops such an edge silently; the canvas
 *  must render an honest broken reference instead, agreeing with the backend's
 *  `UNSATISFIABLE_SKIP` verdict. */
export const unresolvableSkip: PhaseSpecJSON[] = [
  { slug: "start", phase_index: 0, config: { phase_type: "llm_agent" } },
  {
    slug: "check",
    phase_index: 1,
    config: { phase_type: "llm_single" },
    validators: [{ kind: "structure_check", on_failure: "skip_to_phase:nonexistent" }],
  },
]

/** The NON-CONTIGUOUS `phase_index` gap (correction C-2) — hand-authored, test-only.
 *  Indices `[0, 1, 3]`. The server's adjacency draws `0→1` ONLY and calls the
 *  index-3 phase an orphan; a sorted-array walk would draw a phantom `1→3`. Publish
 *  lint rejects a gap (`bad_index`), but the Builder projects UNSAVED drafts and
 *  draft rows, neither of which is lint-gated.
 *
 *  Phase 187-12 extends `stranded` with a single-entry `folder_scope`
 *  (`CORPUS_FOLDER_ID` above; shape from `backend/app/models/harness.py:88`). Same
 *  reasoning as `branching`'s `skill_ref`: `second` and `stranded` are both bare
 *  `llm_single`, so scoping one of them to a folder yields the corpus's second
 *  materially-different-yet-identically-faced pair under the pre-187 ladder. The PM
 *  pack is the REAL folder-scope witness; this one exists so the check has a
 *  same-type pair to bite on. */
export const indexGap: PhaseSpecJSON[] = [
  { slug: "first", phase_index: 0, config: { phase_type: "llm_agent" } },
  { slug: "second", phase_index: 1, config: { phase_type: "llm_single" } },
  {
    slug: "stranded",
    phase_index: 3,
    config: { phase_type: "llm_single", folder_scope: [CORPUS_FOLDER_ID] },
  },
]

// ── The sweep list ──────────────────────────────────────────────────────────────

/**
 * Phase 187-12 — a DEFINITION-level asset, the two fields a face resolution reads.
 *
 * Mirrors `AssetRef` (`backend/app/models/harness.py:255-282`) minus `asset_id` and
 * `mime`: both are Storage plumbing that no title derivation touches, and `asset_id`
 * is a per-seed Storage key rather than a transcribable constant.
 *
 * `kind` is carried rather than assumed BECAUSE the lookup is a filter, not an index:
 * a caller holding a `WorkflowDefinition` must find the entry where
 * `kind === "template"` before it has a `NameContext.templateFilename`. That filter is
 * what 187-15 owes at the page, and the corpus test performs it here rather than
 * pre-resolving it into the fixture and quietly deleting the step being tested.
 */
export interface AssetFixture {
  filename: string
  kind: "template" | "reference"
}

export interface CanvasFixture {
  /** The snapshot key and the test name — stable, never renumber. */
  name: string
  phases: PhaseSpecJSON[]
  /** Where the shape came from, `file:line`, or an explicit hand-authored note. */
  source: string
  /**
   * Phase 187-12 — the definition's `assets[]`, transcribed. It sits on the FIXTURE
   * and not on a phase because that is where the real field lives; smuggling it into
   * a phase would misdescribe the corpus and hide the `llm_emit` gate's whole reason
   * for existing (an ungated template tier paints one filename on every step).
   *
   * Absent ⇒ the definition ships no asset at all, and the template tier misses. Each
   * array's own `file:line` is named in `source`.
   */
  assets?: readonly AssetFixture[]
}

/**
 * ALL_FIXTURES — the ONE list the SC#4 sweep iterates, and since Phase 187-12 the
 * SC#5 sweep too. A fixture added above but not registered here would be silently
 * omitted from both, so the array is the contract: 15 entries / 36 phases covering
 * all six phase types and node counts 0, 1, 2, 3 and 5.
 *
 * 187-12 added NO entry — the derived-tier coverage rides on the five entries that
 * carry a template, the ONE phase that carries a `skill_ref` and the five that carry
 * a single-entry `folder_scope`.
 * That is deliberate: a new entry would write a new projection snapshot block, and the
 * plan's own gate is that this work moves no snapshot byte.
 */
export const ALL_FIXTURES: CanvasFixture[] = [
  {
    name: "research_summarize (canonical seed 1)",
    phases: researchSummarize,
    source: "backend/tests/conftest.py:852-866",
  },
  {
    name: "plan_execute_verify (canonical seed 2)",
    phases: planExecuteVerify,
    source: "backend/tests/conftest.py:867-892",
  },
  {
    name: "literature_review (canonical seed 3)",
    phases: literatureReview,
    source: "backend/tests/conftest.py:893-912",
  },
  {
    name: "doc_qa_human (canonical seed 4)",
    phases: docQaHuman,
    source: "backend/tests/conftest.py:913-932",
  },
  {
    name: "risk-register (Starter Library 1)",
    phases: riskRegister,
    source: "migrations/094_starter_workflows.sql:59-109; assets :97-101",
    assets: [{ filename: "risk-register.docx", kind: "template" }],
  },
  {
    name: "weekly-status-report (Starter Library 2)",
    phases: weeklyStatusReport,
    source: "migrations/094_starter_workflows.sql:114-164; assets :152-156",
    assets: [{ filename: "weekly-status-report.docx", kind: "template" }],
  },
  {
    name: "compliance-gap-report (Starter Library 3)",
    phases: complianceGapReport,
    source: "migrations/094_starter_workflows.sql:169-219; assets :207-211",
    assets: [{ filename: "compliance-gap-report.docx", kind: "template" }],
  },
  {
    name: "pm-weekly-status-report (PM pack 1)",
    phases: pmWeeklyStatusReport,
    source:
      "scripts/seed-pm-pack.py:104-109,353-389; assets :390-397 with filename :108; folder_scope :361,:372",
    assets: [{ filename: "weekly-status-report.docx", kind: "template" }],
  },
  {
    name: "pm-risk-register (PM pack 2)",
    phases: pmRiskRegister,
    source:
      "scripts/seed-pm-pack.py:110-114,353-389; assets :390-397 with filename :113; folder_scope :361,:372",
    assets: [{ filename: "risk-register.docx", kind: "template" }],
  },
  {
    name: "eval_coverage (the 5-phase maximum)",
    phases: evalCoverage,
    source: "migrations/066_eval_coverage_seed.sql:61-124",
  },
  {
    name: "empty draft (0 phases)",
    phases: emptyDraft,
    source: "hand-authored, test-only (D-183-11)",
  },
  {
    name: "single phase (1 phase)",
    phases: singlePhase,
    source: "hand-authored, test-only (the degenerate layout case)",
  },
  {
    name: "branching (synthetic skip_to_phase)",
    phases: branching,
    source:
      "hand-authored, test-only (D-183-09; sketch 136's proposed shape); assess.skill_ref hand-authored, test-only, shape from backend/app/models/harness.py:93",
  },
  {
    name: "unresolvable skip (broken reference)",
    phases: unresolvableSkip,
    source: "hand-authored, test-only (D-183-10)",
  },
  {
    name: "non-contiguous phase_index [0,1,3]",
    phases: indexGap,
    source:
      "hand-authored, test-only (correction C-2); stranded.folder_scope hand-authored, test-only, shape from backend/app/models/harness.py:88",
  },
]
