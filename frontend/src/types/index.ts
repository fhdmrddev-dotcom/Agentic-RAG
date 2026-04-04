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
