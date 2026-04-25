import { supabase } from "./supabase"
import type { Thread, Message, Document, Folder, Skill, SkillCreate, SkillUpdate, SkillFile, OutputFile, SourceReference, Citation, ConfidenceResult } from "../types"

export interface SkillImportResult {
  created: Skill[]
  errors: Array<{ skill: string; error: string }>
}

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Not authenticated")
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
}

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Not authenticated")
  return token
}

export async function listThreads(): Promise<Thread[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads`, { headers })
  if (!res.ok) throw new Error("Failed to list threads")
  return res.json() as Promise<Thread[]>
}

export async function createThread(title = "New Chat", folderId?: string | null): Promise<Thread> {
  const headers = await getAuthHeaders()
  const body: Record<string, string> = { title }
  if (folderId) body.folder_id = folderId
  const res = await fetch(`${API_BASE}/threads`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to create thread")
  return res.json() as Promise<Thread>
}

export async function getMessages(threadId: string): Promise<Message[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, { headers })
  if (!res.ok) throw new Error("Failed to get messages")
  const data = await res.json() as Array<Message & {
    source_refs?: Citation[]
    confidence_level?: string
    confidence_avg_similarity?: number
    confidence_disclaimer?: string | null
  }>
  // Map DB column names to frontend field names
  return data.map((m) => {
    const { source_refs, confidence_level, confidence_avg_similarity, confidence_disclaimer, ...rest } = m
    const mapped: Message = { ...rest, citations: (source_refs ?? []) as Citation[] }
    if (confidence_level) {
      mapped.confidence = {
        level: confidence_level as "high" | "medium" | "low",
        avg_similarity: confidence_avg_similarity ?? 0,
        disclaimer: confidence_disclaimer ?? null,
      }
    }
    return mapped
  })
}

export async function listModels(): Promise<{ models: string[]; default: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/models`, { headers })
  if (!res.ok) throw new Error("Failed to list models")
  return res.json() as Promise<{ models: string[]; default: string }>
}

export async function deleteThread(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${id}`, { method: "DELETE", headers })
  if (!res.ok) throw new Error("Failed to delete thread")
}

export async function renameThread(id: string, title: string): Promise<Thread> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error("Failed to rename thread")
  return res.json() as Promise<Thread>
}

export async function streamMessage(
  threadId: string,
  content: string,
  onDelta: (text: string) => void,
  onDone: () => void,
  model?: string,
  provider?: string,
  onTitleUpdate?: (title: string) => void,
  onToolStart?: (name: string, args: Record<string, string>) => void,
  onToolEnd?: (name: string, result?: string) => void,
  onSubAgentStart?: (filename: string, task: string) => void,
  onSubAgentDelta?: (text: string) => void,
  onSubAgentDone?: () => void,
  onSkillActivated?: (skillName: string) => void,
  onCodeExecutionStart?: (codePreview: string) => void,
  onCodeStdout?: (content: string) => void,
  onCodeStderr?: (content: string) => void,
  onCodeExecutionComplete?: (exitCode: number, durationMs: number, outputFiles: OutputFile[], error?: string) => void,
  agentMode?: string,
  onSources?: (sources: SourceReference[]) => void,
  onCitations?: (citations: Citation[]) => void,
  onConfidence?: (level: "high" | "medium" | "low", avgSimilarity: number, disclaimer: string | null) => void,
  onSuggestions?: (questions: string[]) => void,
  onPlanning?: (iteration: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content, model, provider, agent_mode: agentMode ?? "default" }),
    signal,
  })

  if (!res.ok) throw new Error("Failed to send message")
  if (!res.body) throw new Error("No response body")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    let done: boolean, value: Uint8Array | undefined
    try {
      ;({ done, value } = await reader.read())
    } catch (err) {
      // AbortError means user stopped — not a real error
      if (err instanceof Error && err.name === "AbortError") return
      throw err
    }
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const raw = line.slice(6).trim()
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        if (parsed.type === "delta") {
          onDelta(parsed.content as string)
        } else if (parsed.type === "title" && onTitleUpdate) {
          onTitleUpdate(parsed.content as string)
        } else if (parsed.type === "tool_start" && onToolStart) {
          onToolStart(parsed.name as string, parsed.args as Record<string, string>)
        } else if (parsed.type === "tool_end" && onToolEnd) {
          onToolEnd(parsed.name as string, parsed.result as string | undefined)
        } else if (parsed.type === "sub_agent_start" && onSubAgentStart) {
          onSubAgentStart(parsed.filename as string, parsed.task as string)
        } else if (parsed.type === "sub_agent_delta" && onSubAgentDelta) {
          onSubAgentDelta(parsed.content as string)
        } else if (parsed.type === "sub_agent_done" && onSubAgentDone) {
          onSubAgentDone()
        } else if (parsed.type === "skill_activated" && onSkillActivated) {
          onSkillActivated(parsed.skill_name as string)
        } else if (parsed.type === "code_execution_start" && onCodeExecutionStart) {
          onCodeExecutionStart(parsed.code_preview as string)
        } else if (parsed.type === "code_stdout" && onCodeStdout) {
          onCodeStdout(parsed.content as string)
        } else if (parsed.type === "code_stderr" && onCodeStderr) {
          onCodeStderr(parsed.content as string)
        } else if (parsed.type === "code_execution_complete" && onCodeExecutionComplete) {
          onCodeExecutionComplete(
            parsed.exit_code as number,
            parsed.duration_ms as number,
            (parsed.output_files ?? []) as OutputFile[],
            parsed.error as string | undefined,
          )
        } else if (parsed.type === "sources" && onSources) {
          onSources((parsed.sources ?? []) as SourceReference[])
        } else if (parsed.type === "citations" && onCitations) {
          onCitations((parsed.citations ?? []) as Citation[])
        } else if (parsed.type === "confidence" && onConfidence) {
          onConfidence(
            parsed.level as "high" | "medium" | "low",
            parsed.avg_similarity as number,
            parsed.disclaimer as string | null,
          )
        } else if (parsed.type === "done") {
          onDone()
          // Do NOT return — stream stays open for suggestions event (Phase 32)
        } else if (parsed.type === "suggestions" && onSuggestions) {
          onSuggestions((parsed.questions ?? []) as string[])
        } else if (parsed.type === "stream_end") {
          return  // True end of stream after optional suggestions event (Phase 32)
        } else if (parsed.type === "planning" && onPlanning) {
          onPlanning(parsed.iteration as number)
        }
      } catch {
        // ignore malformed lines
      }
    }
  }

  onDone()
}

export async function listDocuments(): Promise<Document[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents`, { headers })
  if (!res.ok) throw new Error("Failed to list documents")
  return res.json() as Promise<Document[]>
}

export async function uploadDocument(file: File, folderId?: string | null): Promise<{ doc: Document; isDuplicate: boolean }> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  if (folderId) formData.append("folder_id", folderId)
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error((err as { detail: string }).detail ?? "Upload failed")
  }
  const doc = await res.json() as Document
  return { doc, isDuplicate: res.status === 200 }
}

export async function deleteDocument(id: string, scope?: "version" | "all"): Promise<void> {
  const headers = await getAuthHeaders()
  const url = scope
    ? `${API_BASE}/documents/${id}?scope=${scope}`
    : `${API_BASE}/documents/${id}`
  const res = await fetch(url, { method: "DELETE", headers })
  if (!res.ok) throw new Error("Failed to delete document")
}

export async function fetchDocumentVersions(documentId: string): Promise<Document[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${documentId}/versions`, { headers })
  if (!res.ok) throw new Error("Failed to fetch document versions")
  return res.json() as Promise<Document[]>
}

export async function restoreDocumentVersion(documentId: string): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${documentId}/restore`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new Error("Failed to restore version. Please try again.")
  return res.json() as Promise<Document>
}

export async function listFolders(): Promise<Folder[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders`, { headers })
  if (!res.ok) throw new Error("Failed to list folders")
  return res.json() as Promise<Folder[]>
}

export async function createFolder(name: string, parentId: string | null, isGlobal = false): Promise<Folder> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, parent_id: parentId, is_global: isGlobal }),
  })
  if (!res.ok) throw new Error("Failed to create folder")
  return res.json() as Promise<Folder>
}

export async function renameFolder(id: string, name: string): Promise<Folder> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error("Failed to rename folder")
  return res.json() as Promise<Folder>
}

export async function deleteFolder(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete folder")
}

export async function toggleFolderGlobal(id: string): Promise<Folder> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders/${id}/toggle-global`, {
    method: "PATCH",
    headers,
  })
  if (!res.ok) {
    if (res.status === 403) throw new Error("Only the folder owner can toggle global status")
    throw new Error("Failed to toggle folder global status")
  }
  return res.json() as Promise<Folder>
}

export async function listSkills(): Promise<Skill[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills`, { headers })
  if (!res.ok) throw new Error("Failed to list skills")
  return res.json() as Promise<Skill[]>
}

export async function createSkill(body: SkillCreate): Promise<Skill> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to save skill. Please try again.")
  return res.json() as Promise<Skill>
}

export async function updateSkill(id: string, body: SkillUpdate): Promise<Skill> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update skill. Please try again.")
  return res.json() as Promise<Skill>
}

export async function deleteSkill(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete skill. Please try again.")
}

export async function toggleSkillEnabled(id: string): Promise<Skill> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}/toggle-enabled`, {
    method: "PATCH",
    headers,
  })
  if (!res.ok) throw new Error("Failed to update skill.")
  return res.json() as Promise<Skill>
}

export async function toggleSkillGlobal(id: string): Promise<Skill> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}/toggle-global`, {
    method: "PATCH",
    headers,
  })
  if (!res.ok) {
    if (res.status === 403) throw new Error("Only the skill owner can toggle global status")
    throw new Error("Failed to update skill.")
  }
  return res.json() as Promise<Skill>
}

export interface ProviderInfo {
  id: string
  name: string
  base_url: string
  has_key: boolean
  is_active: boolean
  models: string[]
}

export interface FullAppSettings {
  active_provider: string
  llm_model: string
  available_models: string[]
  providers: ProviderInfo[]
  embedding_model: string
  embedding_base_url: string
  embedding_dimensions: number
  embedding_has_api_key: boolean
  rerank_enabled: boolean
  rerank_provider: string
  rerank_model: string
  rerank_top_n: number
  rerank_has_api_key: boolean
  retrieval_top_k: number
  retrieval_match_threshold: number
  hybrid_search_enabled: boolean
  hybrid_candidate_count: number
  vector_search_weight: number
  keyword_search_weight: number
  rrf_k: number
  web_search_enabled: boolean
  web_search_max_results: number
  sandbox_enabled: boolean
  context_window_max_tokens: number
  sub_agent_max_output_tokens: number
  sub_agent_model: string
}

export type AppSettings = FullAppSettings

export interface ProviderUpdate {
  id: string
  api_key?: string
  models?: string[]
  base_url?: string
}

export interface SettingsUpdate {
  active_provider?: string
  llm_model?: string
  providers?: ProviderUpdate[]
  embedding_model?: string
  embedding_api_key?: string
  embedding_base_url?: string
  embedding_dimensions?: number
  rerank_enabled?: boolean
  rerank_provider?: string
  rerank_api_key?: string
  rerank_model?: string
  rerank_top_n?: number
  retrieval_top_k?: number
  retrieval_match_threshold?: number
  hybrid_search_enabled?: boolean
  hybrid_candidate_count?: number
  vector_search_weight?: number
  keyword_search_weight?: number
  rrf_k?: number
  tavily_api_key?: string
  web_search_max_results?: number
  sandbox_enabled?: boolean
  context_window_max_tokens?: number
  sub_agent_max_output_tokens?: number
  sub_agent_model?: string
}

export async function getSettings(): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings`, { headers, cache: "no-store" })
  if (!res.ok) throw new Error("Failed to get settings")
  return res.json() as Promise<FullAppSettings>
}

export async function updateSettings(body: SettingsUpdate): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to save settings")
  return res.json() as Promise<FullAppSettings>
}

export async function getProviders(): Promise<{ active: string; active_model: string; providers: { id: string; name: string; models: string[]; is_active: boolean }[] }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/providers`, { headers, cache: "no-store" })
  if (!res.ok) throw new Error("Failed to get providers")
  return res.json()
}

export async function exportSkill(id: string, name: string): Promise<void> {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}/skills/${id}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to export skill")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${name.replace(/\s+/g, "-").toLowerCase()}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importSkillZip(file: File): Promise<SkillImportResult> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/skills/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Import failed" }))
    throw new Error((body as { detail?: string }).detail || "Import failed")
  }
  return res.json() as Promise<SkillImportResult>
}

export async function listSkillFiles(skillId: string): Promise<SkillFile[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/files`, { headers })
  if (!res.ok) throw new Error("Failed to list skill files")
  return res.json() as Promise<SkillFile[]>
}

export async function uploadSkillFile(skillId: string, file: File): Promise<SkillFile> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/skills/${skillId}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error((err as { detail: string }).detail ?? "Upload failed")
  }
  return res.json() as Promise<SkillFile>
}

export async function deleteSkillFile(skillId: string, fileId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/files/${fileId}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete skill file")
}

// ── Audit Log (Phase 31) ────────────────────────────────────────────────────

export interface AuditEntry {
  id: string
  action_type: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AuditLogsResponse {
  entries: AuditEntry[]
  total: number
  page: number
  page_size: number
}

export async function getAuditLogs(
  page = 1,
  since?: string,
  actionType?: string,
): Promise<AuditLogsResponse> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams({ page: String(page), page_size: "50" })
  if (since) params.set("since", since)
  if (actionType) params.set("action_type", actionType)
  const res = await fetch(`${API_BASE}/audit-logs?${params}`, { headers })
  if (!res.ok) throw new Error("Failed to load audit log")
  return res.json() as Promise<AuditLogsResponse>
}

export async function exportAuditLogs(since?: string, actionType?: string): Promise<void> {
  const token = await getAuthToken()
  const params = new URLSearchParams()
  if (since) params.set("since", since)
  if (actionType) params.set("action_type", actionType)
  const res = await fetch(`${API_BASE}/audit-logs/export?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to export audit log")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "audit-log.csv"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Knowledge Health types ────────────────────────────────────────────────────

export interface MostRetrievedDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
  retrieval_count: number
  last_retrieved_at: string
}

export interface NeverRetrievedDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
}

export interface LowConfidenceDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
  avg_similarity: number
}

export interface StaleDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
  days_stale: number
}

export interface HealthSummary {
  total_documents: number
  most_retrieved: MostRetrievedDoc[]
  never_retrieved: NeverRetrievedDoc[]
  low_confidence: LowConfidenceDoc[]
  stale: StaleDoc[]
}

export interface HealthOverview {
  health_score: number
  high_confidence_rate: number
  total_documents: number
  retrieved_this_month: number
  never_retrieved_count: number
  stale_count: number
  low_confidence_queries_count: number
  coverage_percent: number
  avg_confidence: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  offset: number
  limit: number
}

export interface RetrievalTrendPoint {
  date: string
  retrieval_count: number
  unique_documents: number
}

export interface LowConfidenceQuery {
  query_text: string
  avg_similarity: number
  occurrence_count: number
  document_count: number
}

// -- Feedback types -----------------------------------------------------------

export interface FeedbackRequest {
  message_id: string
  rating: "positive" | "negative"
  reason?: string | null
}

export interface DownvotedDocument {
  document_id: string
  filename: string
  folder_id: string | null
  downvote_count: number
}

export interface FeedbackStats {
  positive_rate: number
  total_ratings: number
  downvoted_documents: DownvotedDocument[]
}

// ── Knowledge Health API functions ────────────────────────────────────────────

/**
 * @deprecated Use paginated endpoints (getHealthOverview, getMostRetrieved, etc.) instead.
 */
export async function getKnowledgeHealthSummary(staleDays = 90): Promise<HealthSummary> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/summary?stale_days=${staleDays}`, { headers })
  if (!res.ok) throw new Error("Failed to load health summary")
  return res.json() as Promise<HealthSummary>
}

export async function getHealthOverview(staleDays = 90): Promise<HealthOverview> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/overview?stale_days=${staleDays}`, { headers })
  if (!res.ok) throw new Error("Failed to load health overview")
  return res.json() as Promise<HealthOverview>
}

export async function getMostRetrieved(offset = 0, limit = 20): Promise<PaginatedResponse<MostRetrievedDoc>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/most-retrieved?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load most retrieved documents")
  return res.json() as Promise<PaginatedResponse<MostRetrievedDoc>>
}

export async function getNeverRetrieved(offset = 0, limit = 20): Promise<PaginatedResponse<NeverRetrievedDoc>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/never-retrieved?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load never retrieved documents")
  return res.json() as Promise<PaginatedResponse<NeverRetrievedDoc>>
}

export async function getStaleDocs(offset = 0, limit = 20, staleDays = 90): Promise<PaginatedResponse<StaleDoc>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/stale?offset=${offset}&limit=${limit}&stale_days=${staleDays}`, { headers })
  if (!res.ok) throw new Error("Failed to load stale documents")
  return res.json() as Promise<PaginatedResponse<StaleDoc>>
}

export async function getLowConfidenceDocs(offset = 0, limit = 20): Promise<PaginatedResponse<LowConfidenceDoc>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/low-confidence/documents?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load low confidence documents")
  return res.json() as Promise<PaginatedResponse<LowConfidenceDoc>>
}

export async function getLowConfidenceQueries(offset = 0, limit = 20): Promise<PaginatedResponse<LowConfidenceQuery>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/low-confidence/queries?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load low confidence queries")
  return res.json() as Promise<PaginatedResponse<LowConfidenceQuery>>
}

export async function getRetrievalTrend(days = 30): Promise<RetrievalTrendPoint[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/retrieval-trend?days=${days}`, { headers })
  if (!res.ok) throw new Error("Failed to load retrieval trend")
  return res.json() as Promise<RetrievalTrendPoint[]>
}

export async function moveDocument(id: string, folderId: string | null): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/move`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ folder_id: folderId }),
  })
  if (!res.ok) throw new Error("Failed to move document")
  return res.json() as Promise<Document>
}

export async function reingestDocument(id: string): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/reingest`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new Error("Failed to reingest document")
  return res.json() as Promise<Document>
}

// -- Feedback API functions ---------------------------------------------------

/**
 * Submit thumbs-up or thumbs-down rating for an assistant message.
 * Returns raw Response so callers can inspect status 409 (already rated) themselves.
 * Throws only on network errors, never on HTTP error status codes.
 */
export async function submitFeedback(body: FeedbackRequest): Promise<Response> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  return res
}

export async function getFeedbackStats(): Promise<FeedbackStats> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/feedback/stats`, { headers })
  if (!res.ok) throw new Error("Failed to load feedback stats")
  return res.json() as Promise<FeedbackStats>
}
