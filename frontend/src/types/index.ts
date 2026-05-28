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
  finalOutputFiles?: { filename: string; url?: string }[]
  /** Phase 076.2 D-01: DeepSeek reasoning/thinking content. Present on
   * assistant messages from thinking-enabled providers (DeepSeek V4).
   * Accumulated during streaming via reasoning_delta SSE events.
   * Rendered in a collapsible "Thinking" block in RunCard. */
  reasoningContent?: string
}

export interface DocumentMetadata {
  title?: string
  author?: string
  date?: string
  document_type?: string
  topics?: string[]
  language?: string
  summary?: string
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

export interface Skill {
  id: string
  user_id: string
  name: string
  description: string
  instructions: string
  is_enabled: boolean
  is_global: boolean
  created_at: string
  updated_at: string
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
 *  SSE workspace_file_written (tool_dispatcher.py:892, FLAT payload — no nested
 *  `file`, no `id`; carries path/version/size_bytes/mime_type). The store keys
 *  workspace files by `path` (SSE has no `id`), so `id` is optional here. */
export interface WorkspaceFile {
  id?: string
  path: string
  size_bytes: number
  mime_type: string
  version?: number
  created_at?: string
  updated_at?: string
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
