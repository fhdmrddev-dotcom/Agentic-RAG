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
  /** True if the user clicked Stop — shows "Response stopped" indicator instead of "Saving response…" */
  stopped?: boolean
  /** Phase 063 (D-063-04 / RESEARCH Open Question 2): the Redis Stream run_id this assistant message is/was streamed from. Set by reconcile and sendMessage paths; absent for DB-only loaded messages until backfilled. Used by Stop semantics (DELETE /runs/{runId}) and Resume button visibility logic. */
  runId?: string
  /** Phase 063 (D-063-04) + Phase 066 (D-066-04, 09): lifecycle status of the underlying run. Mirrors public.runs.status enum values post-migration 038 (5 values). Resume button surfaces when runStatus === 'failed' || runStatus === 'timed_out' (D-066-09 — no auto-retry for paid LLM calls per D-v2.5-05). The 'timed_out' value (NEW in 066) renders an "Agent reached time limit" banner; 'cancelled' renders "Response stopped"; 'failed' renders the Resume button without a banner. */
  runStatus?: "streaming" | "completed" | "failed" | "cancelled" | "timed_out"
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
