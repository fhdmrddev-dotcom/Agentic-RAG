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
  args: Record<string, string>
  status: "running" | "done"
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

export interface Message {
  id: string
  thread_id: string
  user_id: string
  role: "user" | "assistant"
  content: string
  created_at: string
  updated_at: string
  tool_calls?: ToolCall[]
  sub_agent?: SubAgentState
  activatedSkill?: string  // Set by skill_activated SSE event
  sources?: SourceReference[]  // Set by sources SSE event; persisted in source_refs column
  citations?: Citation[]       // Set by citations SSE event; loaded from source_refs on DB load
  confidence?: ConfidenceResult // Set by confidence SSE event; persisted in confidence_* columns
  /** True while the agent has finished one tool-call round and is deciding its next action. */
  isPlanning?: boolean
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
  chunk_count: number | null
  content_hash: string | null
  version_number?: number
  is_latest?: boolean
  metadata: DocumentMetadata | null
  created_at: string
  updated_at: string
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
