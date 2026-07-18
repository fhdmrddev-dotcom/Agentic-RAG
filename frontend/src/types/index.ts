// Phase 139 (SI-02): reuse the tuner's cell-bearing candidate as the winner /
// baseline member of a description proposal's inline scoreboard snapshot. This is
// a type-only import (verbatimModuleSyntax) — fully elided at compile, so the
// api.ts ↔ types circular *type* reference creates no runtime import cycle.
import type { TunerCandidate } from "@/lib/api"

export interface Thread {
  id: string
  user_id: string
  title: string
  folder_id: string | null
  created_at: string
  updated_at: string
}

export interface SubAgentState {
  filename: string
  task: string
  content: string
  status: "running" | "done"
}

export interface OutputLine {
  kind: "stdout" | "stderr"
  content: string
}

export interface OutputFile {
  filename: string
  url: string
  size: number
  /** Phase 095 Plan 05 (D-08) — additive hero flag from the backend
   * final_output_files emit + persisted execute_code result. True for the
   * agent-flagged (else heuristic-picked) final deliverable; the chat
   * output area heroes these above a collapsible "Working files" group.
   * Optional — older streams without it degrade gracefully (all working). */
  is_hero?: boolean
}

export interface ToolCall {
  name: string
  id?: string          // set to "preparing-{index}" by onToolPreparing; replaced by real id when tool_start arrives
  args: Record<string, string>
  status: "running" | "done" | "interrupted" | "preparing"
  result?: string
  sub_agent?: SubAgentState
  startedAt?: number   // Date.now() when tool_start received
  endedAt?: number     // Date.now() when tool_end received
  // Code execution fields (execute_code tool only)
  outputLines?: OutputLine[]
  outputFiles?: OutputFile[]
  executionDurationMs?: number
  exitCode?: number
  errorMessage?: string
  /** Phase 067.4 R-5 (D-067.4-R5-01 amended): live elapsed seconds during sandbox
   * execution. Updated by `onCodeExecuting` heartbeat ticks (~1 Hz) while
   * `status === "running"`; `ExecuteCodeBody` (Phase 075.7 rename of the
   * legacy execute-code wrapper) renders this as a tabular-nums
   * counter next to the spinner. Replaced by the post-completion duration badge
   * (`executionDurationMs`) once execution completes. */
  elapsedSeconds?: number
  /** SAND (silence fix): current sub-phase of an execute_code step, from the
   * `code_executing` SSE `phase` field — 'starting_sandbox' | 'installing_libraries'
   * | 'running'. Drives the honest header label ("Starting sandbox…", "Installing
   * libraries…") so the pre-execution setup window (container spin-up + pip
   * install) is no longer shown as an indeterminate "Running code…". */
  codePhase?: string
  /** D-067-03: 0-based iteration index from iteration_start SSE event. Used by
   * ToolCallPanel to render "Step N" gradient dividers between iteration groups.
   * Undefined for tool calls loaded from DB (historical messages — no divider). */
  iteration?: number
  /** Phase 075.1 Plan 04 Atom D (B-260519-05): the resolved sub-agent model id
   * for sub-agent-driven tool calls (today only `analyze_document`). Backend
   * sets this in persisted_tool_calls so the tool-card can render the
   * "Sub-agent: {model_id}" transparency line — surfaces the silent downgrade
   * (e.g. claude-sonnet-4-6 main agent → claude-haiku-4-5-20251001 sub-agent)
   * that was invisible pre-Plan-04. Absent for non-sub-agent tools. */
  sub_agent_model?: string
  /** T-260523-09 (2026-05-23): cumulative bytes of the tool's args streamed
   * from the LLM so far, updated by `onToolArgsProgress` SSE callback at
   * every 5KB boundary. Visible while the tool is in `"preparing"` state —
   * gives the user a "model is writing X.X KB of code" signal during the
   * 60-120s execute_code generation pauses that previously looked silent.
   * Resets implicitly when the tool transitions to `"running"` (final args
   * are then in tc.args and this field is no longer rendered). */
  argsBytesStreamed?: number
  /** 075.6 Plan 02 / Req #5: cumulative tool-args code text streamed from the
   * LLM, updated by `onToolArgsProgress` SSE callback's new `code_so_far`
   * payload via longer-string-wins. Visible inside <ToolArgsLivePanel> while
   * `status === "preparing"`. Cleared on tool_start transition so post-start
   * renders use `tc.args.code` as source of truth (panel collapses but the
   * byte-counter header stays for at-a-glance scan). */
  argsCodeText?: string
  /** Phase 075.9 T2: stable client-side identifier stamped on creation by the
   * streams store reducer. Independent of provider-emitted `tc.id` lifecycle
   * — `tc.id` is unstable across preparing→running transitions on some
   * providers, but `clientKey` is stamped ONCE at first observation and
   * never mutated. UI surfaces (dedup keys, React keys, Record<string, _>
   * keys) MUST prefer `clientKey` over `id`; see `frontend/src/lib/toolKey.ts`
   * for the derivation contract. Optional during the 075.9 migration window
   * for back-compat with DB-loaded historical tool calls (no SSE stream =
   * no stamp); will tighten to required in a follow-up phase. */
  clientKey?: string
}

export interface SourceReference {
  document_id: string
  filename: string
}

export interface Citation {
  document_id: string
  filename: string
  chunk_index: number | null
  passage: string | null
  similarity: number | null
  is_full_doc: boolean
  version_number?: number
}

export interface ConfidenceResult {
  level: "high" | "medium" | "low"
  avg_similarity: number
  disclaimer: string | null
}

export interface SkillActivation {
  type: 'skill_activation'
  skillName: string
  occurredAt: number  // Date.now() at SSE event arrival; preserves D-09 ordering
  /** Phase 067.1 Plan 04: optional skill description from skill_loaded SSE follow-up event.
   * Surfaces in SkillRow as the upcoming-tool hint. May be undefined if the skill row has
   * an empty description column or if the skill_loaded follow-up never arrives (historical
   * messages loaded from DB do not flow through live SSE). */
  description?: string
}

export interface Message {
  id: string
  thread_id: string
  user_id: string
  role: "user" | "assistant"
  content: string
  created_at: string
  updated_at: string
  tool_calls?: ToolCall[]
  /** Phase 56 D-03/D-04: latest iteration index (0-based) seen on iteration_start SSE event. Frontend adds +1 for display. */
  iterationCount?: number
  sub_agent?: SubAgentState
  activatedSkill?: string  // Legacy single-skill field (kept for DB-loaded message compat)
  /** Phase 56 D-08/D-09: ordered list of skills activated during the live stream, used for inline rendering in ToolCallPanel. */
  activatedSkills?: SkillActivation[]
  sources?: SourceReference[]  // Set by sources SSE event; persisted in source_refs column
  citations?: Citation[]       // Set by citations SSE event; loaded from source_refs on DB load
  confidence?: ConfidenceResult // Set by confidence SSE event; persisted in confidence_* columns
  suggestions?: string[]   // Set by suggestions SSE event; ephemeral — not persisted, not loaded
  /** True while the agent has finished one tool-call round and is deciding its next action. */
  isPlanning?: boolean
  /** True if the user clicked Stop — shows "Response stopped" indicator (D-067-02: no fallback chrome between SSE end and DB persistence). */
  stopped?: boolean
  /** Phase 063 (D-063-04 / RESEARCH Open Question 2): the Redis Stream run_id this assistant message is/was streamed from. Set by reconcile and sendMessage paths; absent for DB-only loaded messages until backfilled. Used by Stop semantics (DELETE /runs/{runId}) and Resume button visibility logic. */
  runId?: string
  /** Phase 063 (D-063-04) + Phase 066 (D-066-04, 09): lifecycle status of the underlying run. Mirrors public.runs.status enum values post-migration 038 (5 values). Resume button surfaces when runStatus === 'failed' || runStatus === 'timed_out' (D-066-09 — no auto-retry for paid LLM calls per D-v2.5-05). The 'timed_out' value (NEW in 066) renders an "Agent reached time limit" banner; 'cancelled' renders "Response stopped"; 'failed' renders the Resume button without a banner. */
  runStatus?: "streaming" | "completed" | "failed" | "cancelled" | "timed_out"
  /** Phase 095.1-03 (D-04 model attribution): the REAL resolved model/provider
   * of the run that produced this assistant message, read from runs.model /
   * runs.provider via the additive runs↔messages enrich. Drives the RunCard
   * run-sub `{provider} · {model} · turn N`. Optional (NOT `| null`) because the
   * api.ts mapper coerces the wire null → undefined; absent for legacy /
   * pre-run-backed messages (graceful → run-sub shows just `turn N`). */
  model?: string
  provider?: string
  /** Phase 095.1-03 (D-05 true reload timer): the run's persisted wall-clock
   * start/end (runs.started_at / runs.completed_at, ISO strings). A finished
   * run's TRUE duration = completedAt − startedAt — identical live and on reload
   * (never Date.now() − created_at, the BUG-260606-02 inflation lie). A finished
   * run with no completedAt → NO duration (the honesty rule). Optional because
   * the mapper coerces null → undefined. */
  startedAt?: string
  completedAt?: string
  /** Phase 076.1: error string from SSE terminal errorPayload. Populated by
   * StreamsProvider onTerminal when kind === "error" or "timed_out". Used by
   * RunCard to display categorized failure reason. Only available for live-
   * streamed runs (not backfilled from DB — runs.error is not yet in the
   * messages response). */
  runError?: string
  /** Phase 075.1 Plan 04 Atom E (B-260519-11 + BUG-260514-01): cumulative
   * sandbox-output file list emitted by the backend `final_output_files`
   * SSE event after the agent loop terminates. Drives the pinned
   * "Final outputs" panel rendered below the per-cell delta panels in
   * ToolCallPanel — closes the cumulative-repeat symptom where a 12-file
   * run rendered 12 download links per cell. Absent for runs that produced
   * no output files. */
  finalOutputFiles?: { filename: string; url?: string; size?: number; is_hero?: boolean }[]
  /** Phase 076.2 D-01: DeepSeek reasoning/thinking content. Present on
   * assistant messages from thinking-enabled providers (DeepSeek V4).
   * Accumulated during streaming via reasoning_delta SSE events.
   * Rendered in a collapsible "Thinking" block in RunCard. */
  reasoningContent?: string
  /** Phase 149 Plan 09 (D-149-10): honest disabled-model fallback notice. Stamped by
   * StreamsProvider from the `model_disabled_fallback` SSE event when the user's selected
   * model was operator-DISABLED and the run fell back to the org default. `message` already
   * names BOTH models (rendered as an inline notice in MessageItem). Absent on the common
   * enabled path — the swap is never silent (never a dropped event). */
  modelFallbackNotice?: { disabledModel: string; fallbackModel: string; message: string }
}

export interface DocumentMetadata {
  title?: string
  author?: string
  date?: string
  document_type?: string
  topics?: string[]
  language?: string
  summary?: string
  /** Phase 112 (META-02) — per-field confidence map from enriched extraction
   *  (Phase 111 `attach_confidence` renames `confidence` -> `_confidence`).
   *  DISPLAY-ONLY (never a flat `metadata_filter` dimension, D-111-3/9).
   *  Values are raw 0.0–1.0; the ConfidenceChip maps them to D-05 display tiers. */
  _confidence?: Record<string, number>
  /** Phase 112 — per-field provenance. `"user"` = manually overridden (the panel
   *  renders a neutral "Edited" chip — no score). Server hard-stamps this on PATCH
   *  so the client can never assert its own provenance. */
  _source?: Record<string, "user" | "extracted">
  /** Phase 118 (CLASS-02) — the on-upload classification suggestion the backend
   *  rule-eval pass stamps onto the doc's metadata (D-118-5). DISPLAY/ACTION-ONLY
   *  provenance — never a flat `metadata_filter` match dimension (the `_`-prefix
   *  reject already excludes it). The DocumentList row chip renders only while
   *  `status === "suggested"`; the panel section renders the accepted receipt +
   *  Undo. `undefined`/absent once the suggestion is dismissed. */
  _classification?: ClassificationSuggestion
  /** Custom (user-defined) field_keys read through. The panel renders the union of
   *  built-ins + enabled custom defs (`MetadataFieldDef`), never raw keys. */
  [key: string]: unknown
}

/** Phase 112 (META-02) — mirrors the backend `MetadataFieldResponse`
 *  (backend/app/models/metadata_field.py). Custom field defs live in
 *  `metadata_field_definitions`; `field_type` is a closed vocab, and `enum`
 *  carries `options: string[]`. Listed via `listMetadataFields()`. */
export interface MetadataFieldDef {
  id: string
  user_id?: string | null
  field_key: string
  field_type: "string" | "date" | "number" | "boolean" | "enum"
  description?: string | null
  options?: string[] | null
  is_global: boolean
  enabled: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 114 (VIEW-03 / UX-01) — the no-DSL filter-AST CLIENT contract.
//
// Mirrors the backend filter AST (backend/app/models/document_view.py
// ViewCondition / ViewFilter) BYTE-FOR-BYTE so the builder can assemble the
// `filter_expr` POST /document-views accepts and round-trip a saved view's
// `filter_expr` back into the bar. The client ONLY assembles the AST — ALL
// field-whitelist validation + value binding happens server-side (the client is
// NOT a trust boundary; a hand-crafted payload cannot inject SQL or filter on a
// non-whitelisted/`_`-prefixed field — T-114-05-01). Operator words are the
// SAME 11 the backend `Literal` lists; the UI labels them in plain language
// (never "query"). The optional operands are additive so an existing `{op:eq}`
// row parses unchanged: `value2` carries the upper bound for `between`; `values`
// carries the membership list for `one_of`; `unit` carries the relative-date
// span unit for `within_next`/`older_than` (the window math itself is derived
// server-side at resolve time — D-114-16, the client readout is preview-only).
// ────────────────────────────────────────────────────────────────────────────

/** The 11 operators the backend `ViewCondition.op` Literal accepts (Phase 114). */
export type ViewConditionOp =
  | "eq"
  | "gte"
  | "lte"
  | "one_of"
  | "contains"
  | "is_empty"
  | "within_next"
  | "older_than"
  | "before"
  | "after"
  | "between"

/** One AND-ed condition: field → type-aware operator → value(s). All operands
 *  except `field`/`op` are optional (an `is_empty` carries none). */
export interface ViewCondition {
  field: string
  op: ViewConditionOp
  value?: string | number | boolean | null
  /** Upper bound for `between` (and the optional far end of a date `between`). */
  value2?: string | number | null
  /** Membership list for `one_of`. */
  values?: Array<string | number> | null
  /** Relative-date span unit for `within_next`/`older_than`. */
  unit?: "days" | "weeks" | "months" | null
}

/** The flat AND-of-conditions filter the builder produces and the backend stores
 *  in `document_views.filter_expr`. `op` stays `"and"` (OR/NOT deferred). */
export interface ViewFilter {
  op: "and"
  conditions: ViewCondition[]
}

/** The empty (no-narrowing) filter (IN-04: single-sourced — FilterBar + IngestionPage
 *  both reference this instead of each declaring their own). An empty `conditions`
 *  list means "no filter active" (the folder view shows; no resolve round-trip). */
export const EMPTY_FILTER: ViewFilter = { op: "and", conditions: [] }

/** A saved view (mirrors the backend `ViewResponse`). Selecting one loads its
 *  `filter_expr` back into the same filter bar (D-114-1); seeded global views
 *  carry `is_global` (the tooltip-labeled `G` pill in the Views sidebar). */
export interface SavedView {
  id: string
  user_id?: string | null
  name: string
  filter_expr: ViewFilter
  folder_scope?: string | null
  is_global: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 117 (REL-02 / UX-01) — the document-relationships CLIENT contract.
//
// Mirrors the backend payloads EXACTLY so the Relationships panel (Plan 04)
// renders the server's truth without re-deriving anything:
//   - the GET read response from
//     `document_relationship_service.get_related_documents` (Plan 01) — the ONE
//     leak-safe outgoing+incoming traversal: `{subject, total, documents[],
//     source_refs}`, each row carrying `direction`/`label`/`relationship_id` and a
//     NULLABLE `document_id` (the masked "no access" row, D-117-8);
//   - the POST 201 create response (`RelationshipResponse`,
//     models/document_relationship.py:50-63).
// The backend OWNS the rel-type vocabulary (the `Literal`) + the inverse-label
// wording (`_INVERSE_LABEL`); the frontend mirrors these keys for display casing
// (D-117-6) and never invents its own. The client is NOT a trust boundary —
// every access decision is server-side (the per-viewer readability re-check).
// ────────────────────────────────────────────────────────────────────────────

/** The 4 relationship types the backend `RelationshipCreate.rel_type` Literal
 *  accepts (models/document_relationship.py:47) — a closed union; a 5th value is
 *  a 422 at parse. Read from the subject's perspective ("this supersedes X"). */
export type RelType = "supersedes" | "amends" | "references" | "attached_to"

/** One compact relationship row in the GET read payload (mirrors a
 *  `get_related_documents` `documents[]` entry, document_relationship_service.py).
 *  An OUTGOING row's `label` is the `rel_type` verbatim; an INCOMING row's `label`
 *  is the backend's inverse label (`superseded_by`/`amended_by`/`referenced_by`/
 *  `has_attachment`, D-117-6) — the frontend casing-map mirrors those keys. */
export interface RelationshipRow {
  /** `null` when the OTHER endpoint is MASKED (the caller can't read it). The
   *  backend NEVER sends an id/title for a masked row (D-117-8 — "linked document
   *  (no access)"); typing this `string | null` makes a leaked-id render a type
   *  error, so the UI cannot accidentally surface it. The server is the gate. */
  document_id: string | null
  /** The related document's real filename, OR the no-access mask string
   *  ("linked document (no access)") when `document_id` is null. */
  filename: string
  rel_type: RelType
  direction: "outgoing" | "incoming"
  /** The backend's raw label (snake_case): `rel_type` for outgoing rows, the
   *  inverse label for incoming rows. The display map handles casing (D-117-6). */
  label: string
  /** The edge row id — the remove ✕ DELETEs `/document-relationships/{id}`. The
   *  read traversal always carries it; optional here so a partial payload is
   *  still well-typed (a row without it simply has no remove affordance). */
  relationship_id?: string
}

/** The GET /document-relationships?document_id= read response (mirrors
 *  `get_related_documents`'s plain dict: subject + total + the compact rows). */
export interface RelatedDocumentsResponse {
  subject: { document_id: string; filename: string }
  total: number
  documents: RelationshipRow[]
}

/** A persisted relationship row — the POST 201 create body (mirrors the backend
 *  `RelationshipResponse`, models/document_relationship.py:50-63). `user_id` /
 *  `created_at` are nullable to match the permissive backend model. */
export interface Relationship {
  id: string
  user_id?: string | null
  source_doc_id: string
  target_doc_id: string
  rel_type: string
  created_at?: string | null
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 118 (CLASS-01 / CLASS-03) — auto-classification CLIENT contract.
//
// The frontend interface seam the on-doc plan (05) and the rules-page plan (06)
// build against. Mirrors the backend payloads from Plans 02/03 EXACTLY so the UI
// renders the server's truth without re-deriving anything:
//   - `ClassificationRule` mirrors the rule CRUD response (`RuleResponse`,
//     models/classification_rule.py) — a `SavedView` clone with `filter_expr`
//     renamed to `match_expr` plus `suggest_folder_id`/`enabled`. The backend
//     OWNS the `is_global` scope (hard-set false on create); the create body
//     NEVER supplies it (mirrors `createView`).
//   - `ClassificationSuggestion` mirrors the on-upload `_classification` object
//     the ingest rule-eval pass stamps onto a doc's metadata (D-118-5) — the
//     matched rule's provenance, the suggested folder (resolved fresh; nullable
//     when the folder is gone, Pitfall 5), a `"suggested" | "accepted"` status,
//     and `prior_folder_id` (stamped at ACCEPT time for the reversible Undo,
//     D-118-6 — Undo reuses the existing `moveDocument(id, prior_folder_id)`).
// The client is NOT a trust boundary — the leak-safe own+global rule reads, the
// `match_expr` whitelist validation, and the accept-move folder re-check are all
// enforced server-side. Never a confidence % — provenance only (the 028/036
// honesty principle).
// ────────────────────────────────────────────────────────────────────────────

/** A classification rule (mirrors the backend `RuleResponse`,
 *  models/classification_rule.py). A `SavedView` clone — `filter_expr` becomes
 *  `match_expr` (the SAME `ViewFilter` AST, evaluated in-Python at upload by the
 *  net-new matcher), plus `suggest_folder_id` (the folder a match suggests; the
 *  FK is `ON DELETE SET NULL` so it may be null) and `enabled` (the toggle rides
 *  the UPDATE path — no separate endpoint). `is_global` is server-owned; the
 *  create body never supplies it (the server hard-sets it false). */
export interface ClassificationRule {
  id: string
  user_id?: string | null
  name: string
  match_expr: ViewFilter
  suggest_folder_id: string | null
  is_global: boolean
  enabled: boolean
}

/** The on-upload classification suggestion stamped onto a doc's
 *  `metadata._classification` (D-118-5) — the matched rule's provenance + the
 *  suggested move. NEVER a confidence %; the human-readable `condition_summary`
 *  is the frozen AST render the matched rule carried. `suggested_folder_name` is
 *  resolved FRESH at suggestion-build time and is null/"(deleted)" when the
 *  folder is gone (Pitfall 5). `status` flips to `"accepted"` after Accept (the
 *  panel renders the audit receipt + Undo); the whole object is cleared on
 *  Dismiss. `prior_folder_id` is stamped at ACCEPT time only (the Undo target —
 *  Undo reuses the existing `moveDocument`), absent on a fresh suggestion. */
export interface ClassificationSuggestion {
  rule_id: string
  rule_name: string
  condition_summary: string
  suggested_folder_id: string | null
  suggested_folder_name: string | null
  status: "suggested" | "accepted"
  prior_folder_id?: string | null
}

export interface Folder {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  is_global: boolean
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  user_id: string
  folder_id: string | null
  filename: string
  file_path: string
  file_size: number
  mime_type: string
  status: "pending" | "processing" | "completed" | "failed"
  error_message: string | null
  /** Phase 56 D-10/D-11: granular sub-status while status='processing'. One of: 'extracting', 'chunking', 'embedding', 'metadata'. Backend sets via Realtime UPDATE; frontend renders via DocumentStatusBadge. */
  ingestion_step?: string | null
  chunk_count: number | null
  content_hash: string | null
  version_number?: number
  is_latest?: boolean
  metadata: DocumentMetadata | null
  created_at: string
  updated_at: string
  table_count?: number
  image_count?: number
}

/** Phase 123-06 (TRIG-03) — one save-time description-lint warning, mirroring the
 *  backend `skill_lint.lint_description()` `{code, message}` shape (Plan 01).
 *  `code` is the specific reason (`name_echo` / `no_trigger_verb` / `too_short` /
 *  `too_long` / `generic` / `duplicate` / `empty`); `message` is the human reason
 *  string the inline warning renders verbatim. The lint is WARN-NEVER-BLOCK (D-09):
 *  the save already succeeded — these are advisory. */
export interface SkillLintWarning {
  code: string
  message: string
}

export interface Skill {
  id: string
  user_id: string
  name: string
  description: string
  instructions: string
  is_enabled: boolean
  is_global: boolean
  is_system: boolean // Phase 137.2 / CREATE-01 — "Built-in" pill (output-only; the client reads it, never sends it)
  created_at: string
  updated_at: string
  /** Phase 123-06 (TRIG-03) — the optional save-time lint warnings the
   *  POST/PATCH /skills response carries (`SkillResponse.lint_warnings`, Plan 01).
   *  Advisory only — the save already succeeded (warn-never-block, D-09). Empty/
   *  absent => healthy (silent-when-healthy). The shared `SkillForm` holds the
   *  returned warnings in local state after a save resolves and renders them
   *  inline under the Description textarea (sketch 044-A), each with a one-click
   *  "Tune this" handoff into the Trigger Tuner. */
  lint_warnings?: SkillLintWarning[]
}

export interface SkillCreate {
  name: string
  description?: string
  instructions?: string
  is_global?: boolean
}

export interface SkillUpdate {
  name?: string
  description?: string
  instructions?: string
}

export interface SkillFile {
  id: string
  skill_id: string
  user_id: string
  filename: string
  file_path: string
  file_size: number
  mime_type: string
  created_at: string
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 132 Plan 03 (EVAL-01 / VER-01) — eval test-case + version-history wire
// mirrors. Mirror the backend Pydantic shapes BYTE-FOR-BYTE (snake_case):
//   skill_test_case.py → TestCaseCreate / TestCaseUpdate / TestCaseResponse
//   skill_version.py   → SkillVersionResponse (read-only — trigger-created)
// `expected_behavior` is free text (D-06); there are NO provider/model fields
// (D-08). These back the THIN 132 foundation surface; the designed Evals panel
// is Phase 137 (PANEL-01, G-2).
// ────────────────────────────────────────────────────────────────────────────

export interface TestCase {
  id: string
  skill_id: string
  user_id: string
  prompt: string
  expected_behavior: string
  order_index: number
  name: string | null
  created_at: string
  updated_at: string
}

export interface TestCaseCreate {
  prompt: string
  expected_behavior?: string
  order_index?: number
  name?: string | null
}

export interface TestCaseUpdate {
  prompt?: string
  expected_behavior?: string
  order_index?: number
  name?: string | null
}

export interface SkillVersion {
  id: string
  skill_id: string
  user_id: string
  version_number: number
  name: string
  description: string
  instructions: string
  source: string
  created_at: string
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 133 Plan 05 (EVAL-02) — eval-runner wire mirrors (snake_case, no reshape).
// Mirror migration 080 (eval_runs / eval_results) + the Plan 04 route payloads.
// ────────────────────────────────────────────────────────────────────────────

/** POST /skills/{id}/evals/runs response (202 kickoff — D-06). */
export interface EvalRunKickoff {
  run_id: string
  skill_id: string
  skill_version_id: string
  provider: string
  model: string
  case_count: number
}

/** A durable eval_runs row (migration 080). status mirrors the run-audit enum. */
export interface EvalRun {
  id: string
  skill_id: string
  skill_version_id: string
  user_id: string
  provider: string
  model: string
  status: "running" | "completed" | "failed" | "cancelled" | "interrupted"
  case_count: number
  error: string | null
  created_at: string
  completed_at: string | null
  // Phase 134 (EVAL-03 / D-07) — additive verdict rollup columns (migration 081).
  // Honest count: passed_count of measured_count with-skill cases passed. NULL on
  // old (pre-081) runs and on error/cancel paths. verdict_summary is the optional
  // default rollup label; Phase 136 (GATE-01) owns the real publish threshold.
  passed_count: number | null
  measured_count: number | null
  verdict_summary: string | null
  // Phase 137.1 (EVAL-05 / migration 085) — matrix grouping + gate-feeder flag.
  // matrix_group_id groups the N single-provider arms of one matrix run (NULL on a
  // single run). feeds_gate marks the ONE arm whose rows feed the publish gate (D-05;
  // false on single runs and every pre-085 row — their gate read is unchanged).
  matrix_group_id: string | null
  feeds_gate: boolean
}

/** A durable eval_results row — one per (test_case × variant) (migration 080). */
export interface EvalResult {
  id: string
  eval_run_id: string
  test_case_id: string
  user_id: string
  variant: "with_skill" | "without_skill"
  provider: string
  model: string
  output: string
  status: "completed" | "failed" | "timed_out" | "cancelled"
  error: string | null
  input_tokens: number | null
  output_tokens: number | null
  created_at: string
  // Phase 134 (EVAL-03 / D-04, D-06) — additive per-arm verdict columns (migration
  // 081), written in the SAME insert by the independent LLM judge. verdict_state is
  // "graded" only for a completed/non-empty arm; an errored/empty arm is honestly
  // "not_measured" (NEVER a fabricated pass/fail — EVAL-03 SC#1), and a completed
  // arm whose judge shot failed is "judge_error". verdict_passed/score are NULL
  // unless graded. All fields NULL on old (pre-081) rows.
  verdict_state: "graded" | "not_measured" | "judge_error" | null
  verdict_passed: boolean | null
  verdict_score: number | null
  verdict_reason: string | null
  judge_model: string | null
  // Phase 134 (EVAL-04 / D-09) — the CALLER's own thumbs rating on this answer,
  // attached by get_eval_run from an owner-scoped eval_ratings read. null = unrated.
  rating: "up" | "down" | null
  // Phase 137.1 (EVAL-05 / migration 085) — per-arm wall-clock (EVAL-05e; NULL on
  // pre-085 rows) + advisory judge critique of the CASE (EVAL-05d). case_feedback is
  // NEVER a verdict and never enters rollup math — it renders visually distinct from
  // PASS/FAIL. Both NULL on old rows / un-graded arms.
  duration_ms: number | null
  case_feedback: string | null
}

/** GET /skills/{id}/evals/runs/{runId} response — the durable readout. */
export interface EvalRunReadout {
  eval_run: EvalRun
  eval_results: EvalResult[]
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 137.1 (EVAL-05) — matrix runs, engine smoke-sweep health, and run-history
// aggregation wire mirrors. Snake_case, no reshape — these mirror the Plan 04/05/07
// route payloads the Studio + Settings consume. All owner-scoped SERVER-SIDE (thin
// client, not itself a security boundary).
// ────────────────────────────────────────────────────────────────────────────

/** POST /skills/{id}/evals/matrix response (202 kickoff). One matrix run fans N
 *  single-provider arms under ONE matrix_group_id; each arm is a normal EvalRunKickoff
 *  and streams via subscribeToRun. Exactly one arm has feeds_gate=true (D-05). */
export interface MatrixRunKickoff {
  matrix_group_id: string
  arms: EvalRunKickoff[]
}

/** One provider/model tile on the engine-health board (D-02 / 060-A). `healthy` is the
 *  honest smoke-sweep outcome; `error` is the VERBATIM provider error string when
 *  unhealthy (a missing key is an honest ✗, not a blocker); `run_id` deep-links to that
 *  arm's run detail; `last_swept_at` is the ISO timestamp of the sweep (null if never). */
export interface EngineHealthTile {
  provider: string
  model: string
  healthy: boolean
  error: string | null
  run_id: string | null
  last_swept_at: string | null
}

/** GET /evals/engine-health response — the per-provider ✓/✗ board (skill-less smoke
 *  sweep, D-02). `swept_at` is the board-level sweep timestamp (null before the first
 *  sweep). */
export interface EngineHealthBoard {
  tiles: EngineHealthTile[]
  swept_at: string | null
}

/** One (provider, model) aggregation row over an eval run's HISTORY (D-07). `with_mean`
 *  / `without_mean` are the mean pass-rates; `with_stddev` is NULL at run_count<2 (no
 *  spread from a single run — the honest "first run" floor); `delta` = with_mean −
 *  without_mean; `analyst_notes` are DETERMINISTIC backend-computed lines (D-08, never an
 *  LLM paragraph). */
export interface EvalConfigAgg {
  provider: string
  model: string
  run_count: number
  with_mean: number
  without_mean: number
  with_stddev: number | null
  delta: number
  analyst_notes: string[]
}

/** GET /skills/{id}/evals/aggregate response — mean±stddev/delta over accumulated run
 *  history, grouped per (provider, model). Empty `configs` = no history yet. */
export interface EvalAggregate {
  configs: EvalConfigAgg[]
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 136 (GATE-01) — skill publish gate. Exact mirror of the backend
// `PublishGate` Pydantic model (Plan 01 `app.models.skill`): a server-computed
// read-model over eval_runs ⋈ skill_versions ⋈ skills. The client NEVER computes
// `met` — it renders this and echoes `override` (D-07). Flat interface + nullable
// fields + status-union deliberately mirrors EvalRun / PromotionGate above.
// ────────────────────────────────────────────────────────────────────────────

/** GET /skills/{id}/publish-gate response. `state` is the honest publish
 *  readiness: "passed" (met), or one of three honest unmet reasons. `measured`/
 *  `passed`/`passing_run_id` are the numeric evidence (NULL when nothing honest
 *  to show); `reason` is the human-readable line; `last_override` carries the
 *  most-recent owner-visible force-publish record (D-01/D-02) or null. */
export interface PublishGate {
  met: boolean
  state: "never_evaled" | "latest_failed" | "passed_on_older_version" | "passed"
  measured: number | null
  passed: number | null
  passing_run_id: string | null
  reason: string
  last_override: { gate_state: string; created_at: string } | null
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 135 (SI-01) — self-improvement proposal lifecycle. Mirrors the LOCKED
// backend response contract (Plans 04/05): a proposal captures the base vs the
// LLM-proposed skill instructions plus its rationale, then rides an approve →
// re-eval → promote/not-promote gate. FLAT interface + status-union + nullable
// style deliberately mirrors EvalRun above.
// ────────────────────────────────────────────────────────────────────────────

/** The promotion-gate honest counts + pass conditions (D-13). Owned by the
 *  backend `PromotionGate` model (Plan 04's eval_run.py); Plan 05 populates it on
 *  the terminal promoted / not_promoted transition. `passed` is the overall
 *  verdict; `no_regression`/`improved` are its two conditions; the five counts
 *  are the honest with-skill tallies (never fabricated — cases whose judge could
 *  not measure land in `excluded_not_measured`, not in a pass/fail bucket). */
export interface PromotionGate {
  passed: boolean
  no_regression: boolean
  improved: boolean
  prev_pass: number
  prev_fail: number
  still_pass: number
  newly_pass: number
  excluded_not_measured: number
}

/** Phase 139 (SI-02) — the inline per-provider scoreboard a `kind='description'`
 *  proposal carries as PRE-approval evidence (D-04/D-10). This is the EXACT
 *  top-level shape 139-02's writer persists — literally `{ winner, baseline,
 *  run_id }` — NOT a `TunerScoreboard` (whose `candidates[]` + `winner_index`
 *  shape has no top-level `.winner`/`.baseline`, so the card could not read them
 *  off it). `winner`/`baseline` reuse the tuner's cell-bearing `TunerCandidate`
 *  so the description card can feed their `cells` straight into `ProviderScoreboard`;
 *  `baseline` is null when the tuner run had no baseline candidate. */
export interface DescriptionScoreboardSnapshot {
  winner: TunerCandidate
  baseline: TunerCandidate | null
  run_id: string
}

/** A durable skill_proposals row (migration 083; description fields migration 090).
 *  Mirrors the LOCKED backend response shape; the client computes the base→proposed
 *  diff itself (lineDiff). Nullable ids are set as the proposal advances (new
 *  version + re-eval run appear on approve/promote); `gate` is null until the
 *  terminal gate verdict. `kind` discriminates SI-01 instruction rows from SI-02
 *  description rows. */
export interface SkillProposal {
  id: string
  skill_id: string
  /** Which proposal family this row is. `instruction` = SI-01 (an
   *  instructions-body diff, migration 083); `description` = SI-02 (a
   *  trigger-description diff sourced from a Trigger Tuner run, migration 090). */
  kind: "instruction" | "description"
  base_skill_version_id: string
  new_skill_version_id: string | null
  re_eval_run_id: string | null
  source_eval_run_id: string | null
  // For a `kind='description'` row these instruction fields may be empty strings —
  // the diff the card renders lives in proposed_description/base_description instead.
  proposed_instructions: string
  base_instructions: string
  rationale: string
  evidence_summary: string
  // Phase 139 (SI-02) description-proposal fields — null on a `kind='instruction'`
  // row. The description card renders lineDiff(base_description, proposed_description)
  // + a ProviderScoreboard from scoreboard_snapshot; source_tuner_run_id is the
  // provenance FK back to the Trigger Tuner run that produced the winner (D-09/D-10).
  proposed_description: string | null
  base_description: string | null
  source_tuner_run_id: string | null
  scoreboard_snapshot: DescriptionScoreboardSnapshot | null
  status:
    | "proposed"
    | "rejected"
    | "approved"
    | "re_evaling"
    | "promoted"
    | "not_promoted"
    | "interrupted"
  override_forced: boolean
  // Populated by Plan 05 on promoted / not_promoted (D-13); null otherwise.
  gate?: PromotionGate | null
  created_at: string
  updated_at: string
}

/** POST approve / rerun response — the updated proposal plus the companion
 *  re-eval run_id the client subscribes to (rides the existing eval_* SSE). */
export interface ProposalApproveResult {
  proposal: SkillProposal
  re_eval_run_id: string
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 086 Plan 01 — agent-panel wire-mirror interfaces.
//
// These mirror the backend JSON field names BYTE-FOR-BYTE (snake_case) so there
// is no client-side reshape — the backend already reshapes where needed (e.g.
// panel.py:67 maps todo_id -> id before serializing). The exact field names are
// VERIFIED against the emit sites + GET reshapes (086-01-PLAN <interfaces>):
//   GET /threads/{tid}/todos            (panel.py:67)
//   GET /threads/{tid}/workspace/files  (workspace.py:99)
//   GET /threads/{tid}/ask_user/pending (panel.py:103)
//   GET /threads/{tid}/tasks            (panel.py:156)
// plus the 6 SSE event payloads from Phases 084/085.
//
// Rendering is Phase 087 — these types only back the data-plumbing layer
// (store Maps + SSE dispatch + GET helpers + cache) shipped in Plan 086-01.
// ────────────────────────────────────────────────────────────────────────────

/** GET /threads/{tid}/todos (panel.py:67 reshapes todo_id -> id) +
 *  SSE todo_updated (tool_dispatcher.py:1239) — the SSE `todos` array is the
 *  FULL canonical list (full-state-replace, not a delta). Identity key: `id`. */
export interface Todo {
  id: string
  content: string
  status: string
  parent_id: string | null
  order_index: number
  created_at?: string
  updated_at?: string
}

/** GET /threads/{tid}/workspace/files (workspace.py:99) +
 *  SSE workspace_file_written (tool_dispatcher.py:892, FLAT payload — carries
 *  id/path/version/size_bytes/mime_type). Phase 088-05 (D-16): the SSE now emits
 *  the persisted row `id` too (it used to be GET-only), so the live panel can
 *  fetch content/versions/diff by id without a refresh. The store still keys by
 *  `path` (stable identity across version bumps); `id` stays optional because a
 *  replayed/legacy event may lack it — the select→fetch path reconciles-by-GET
 *  when it's missing (FilePreview / VersionDiff guard). */
export interface WorkspaceFile {
  id?: string
  path: string
  size_bytes: number
  mime_type: string
  version?: number
  created_at?: string
  updated_at?: string
  kind?: string          // 100: 'template_input' for ephemeral uploads (D-02 badge)
  expires_at?: string    // 100: ISO timestamp; drives countdown + amber tint (D-02)
}

/** GET /threads/{tid}/ask_user/pending (panel.py:103) +
 *  SSE ask_user_prompt (tool_dispatcher.py:1357, FLAT payload — no
 *  message_id/run_id/created_at; those exist only on the GET). Identity key:
 *  `tool_call_id` (NOT `ask_id`). */
export interface PendingAsk {
  tool_call_id: string
  prompt: string
  options: string[]
  timeout_seconds: number
  message_id?: string
  run_id?: string
  created_at?: string
  /** D-12 (Phase 093): the prior phase's draft answer the user is being asked to
   *  confirm. Additive + optional — present on the /pending GET (panel.py) and the
   *  ask_user_prompt SSE event; absent on older rows. The visible render is Phase 094;
   *  093 only plumbs it onto the shape. */
  draft?: string
}

/** GET /threads/{tid}/tasks (panel.py:156) + SSE sub_agent_start/done TASK
 *  variant (task_service.py:264/428 — both carry `sub_run_id`, the discriminator
 *  vs the legacy analyze_document sub_agent_* path which has none). The optional
 *  description/tools/max_steps/summary fields are populated from the sub_agent
 *  SSE bookends. Identity key: `sub_run_id`. */
export interface TaskRunIndexItem {
  sub_run_id: string
  parent_run_id: string
  status: string
  model: string
  provider: string
  started_at?: string
  completed_at?: string
  description?: string
  tools?: string[]
  max_steps?: number
  summary?: string
}

/**
 * Phase 094 Plan 02 (PANEL-08 / PANEL-09) — the normalized harness-phase shape
 * (DATA-CONTRACT §3b). One element per phase in the panel-only `phasesByThread`
 * slice. The discriminated render keys on `phaseType` (the wire `phase_started.
 * phase_type` field, one of the 5 LOCKED literals; UNKNOWN → generic row).
 *
 * Source mapping (DATA-CONTRACT §3b):
 *   slug       ← phase_started.phase
 *   phaseIndex ← phase_started.phase_index
 *   phaseType  ← phase_started.phase_type (the §2 discriminator)
 *   status     ← phase_started→running / phase_completed→done /
 *                run_failed|terminal gate_failed→failed /
 *                non-terminal gate_failed→retrying /
 *                phase_transition.via==="skip_to_phase"→skipped /
 *                derived pending for not-yet-started phases
 *   attempt    ← gate_failed.attempt
 *   error      ← gate_failed.error / run_failed.reason
 *   subAgents  ← sub_agent_start/done bookends (the existing TaskRunIndexItem
 *                shape, keyed by sub_run_id), associated with this phase
 *   pendingAsk ← a tool_call_id POINTER into pendingAsksByThread (the ask card
 *                already has a store — do NOT duplicate the ask here)
 */
/** Phase 101.1-04 (GAP-C / D-11) — the discrete emit-moment sub-step the harness
 *  streams via `phase_substep` (status field). A sealed forced emit is ATOMIC (it
 *  cannot stream tokens), so the emit moment surfaces as these honest sub-steps on the
 *  EXISTING status-node rail instead of a static "Step 0 · working…" box. Optional —
 *  only a `llm_emit` fill phase ever carries one; every other phase leaves it undefined. */
export type EmitSubStep =
  | "forcing"
  | "emitting"
  | "recovering"
  | "validating"
  | "rendering"
  | "validated"

/** Phase 101.1-04 (GAP-C / D-11) — the 5 distinguishable emit failure states the harness
 *  streams via `phase_substep` (failure field). Each renders failed-as-failed on the rail
 *  (closed taxonomy + reason_unknown fallback) — never an empty "done" card (RC-4). */
export type EmitFailure =
  | "model_failed_to_emit"
  | "citation_gate_rejected"
  | "render_failed"
  | "integrity_failed"
  | "no_template_bound"

export interface Phase {
  slug: string
  phaseIndex: number
  phaseType: string
  status: "pending" | "running" | "done" | "failed" | "retrying" | "skipped"
  attempt?: number
  error?: string
  subAgents: TaskRunIndexItem[]
  pendingAsk: string | null
  /** GAP-C (D-11) — the live emit sub-step (the latest `phase_substep` status), rendered
   *  as a sub-row on the existing rail. Undefined on non-emit phases. */
  emitSubStep?: EmitSubStep
  /** GAP-C (D-11) — the terminal emit failure value (the `phase_substep` failure field).
   *  Renders failed-as-failed via the closed taxonomy. Undefined unless an emit failed. */
  emitFailure?: EmitFailure
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 087 Plan 01 — workspace file content / versions / diff wire-mirror
// interfaces + the ask_user answer POST body.
//
// These mirror the backend JSON field names BYTE-FOR-BYTE (snake_case) so there
// is no client-side reshape. VERIFIED against:
//   GET  /threads/{tid}/workspace/files/{id}/content  (workspace.py:124-199 — two-shape)
//   GET  /threads/{tid}/workspace/files/{id}/versions (workspace.py:202-235)
//   GET  /threads/{tid}/workspace/files/{id}/diff      (workspace.py:238-323 + workspace_service.py:99)
//   POST /runs/{run_id}/ask_user_response               (runs.py:496)
// ────────────────────────────────────────────────────────────────────────────

/** GET /content — inline shape: small text files return their content directly. */
export interface WorkspaceFileContentInline {
  id: string
  path: string
  size_bytes: number
  mime_type: string
  storage_type: "inline"
  content: string
}

/** GET /content — bucket shape: binary/large files return a 60s-TTL signed URL
 *  (best-effort; `signed_url` may be null → calm "no preview · Download"). */
export interface WorkspaceFileContentBucket {
  id: string
  path: string
  size_bytes: number
  mime_type: string
  storage_type: "bucket"
  signed_url: string | null
}

/** Discriminated union over `storage_type` — FilePreview routes on it (D-02). */
export type WorkspaceFileContent =
  | WorkspaceFileContentInline
  | WorkspaceFileContentBucket

/** GET /versions — one row per stored version, sorted version DESC. */
export interface WorkspaceVersion {
  id: string
  version: number
  size_bytes: number
  created_at: string
}

/** GET /diff — raw unified-diff STRING in `delta.diff` (NOT pre-parsed hunks);
 *  VersionDiff parses it client-side (Pattern 2). Backend truncates at 500 diff
 *  lines and sets `delta.truncated=true` — the UI must surface that (Pitfall 4). */
export interface WorkspaceDiff {
  path: string
  from_version: number
  to_version: number
  delta: {
    format: "unified"
    diff: string
    stats: { additions: number; deletions: number }
    truncated: boolean
  }
  stats: { additions: number; deletions: number }
}

/** POST /runs/{run_id}/ask_user_response body. `choice_index` is the picked
 *  option index (null for free-text answers); `response_text` always carries the
 *  resolved answer string. `run_id` for the route comes from PendingAsk.run_id
 *  (GET-only — see Pitfall 1 / A2). */
export interface AskUserAnswerBody {
  tool_call_id: string
  response_text: string
  choice_index: number | null
}
