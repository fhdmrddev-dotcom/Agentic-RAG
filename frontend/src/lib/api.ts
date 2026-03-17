import { supabase } from "./supabase"
import type { Thread, Message, Document } from "../types"

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

export async function createThread(title = "New Chat"): Promise<Thread> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error("Failed to create thread")
  return res.json() as Promise<Thread>
}

export async function getMessages(threadId: string): Promise<Message[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, { headers })
  if (!res.ok) throw new Error("Failed to get messages")
  return res.json() as Promise<Message[]>
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
  onTitleUpdate?: (title: string) => void,
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content, model }),
  })

  if (!res.ok) throw new Error("Failed to send message")
  if (!res.body) throw new Error("No response body")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const raw = line.slice(6).trim()
      if (raw === "[DONE]") {
        onDone()
        return
      }
      try {
        const parsed = JSON.parse(raw) as { type: string; content: string }
        if (parsed.type === "delta") {
          onDelta(parsed.content)
        } else if (parsed.type === "title" && onTitleUpdate) {
          onTitleUpdate(parsed.content)
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

export async function uploadDocument(file: File): Promise<{ doc: Document; isDuplicate: boolean }> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
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

export async function deleteDocument(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete document")
}

export interface LLMProvider {
  id: string
  name: string
  base_url: string
  models: string[]
  is_active: boolean
  has_api_key: boolean
}

export interface FullAppSettings {
  llm_providers: LLMProvider[]
  available_models: string[]
  llm_model: string
  embedding_model: string
  embedding_model_locked: boolean
  embedding_base_url: string
  embedding_dimensions: number
  embedding_has_api_key: boolean
  embedding_overridden: boolean
  rerank_enabled: boolean
  rerank_provider: string
  rerank_model: string
  rerank_top_n: number
  rerank_has_api_key: boolean
  reranking_overridden: boolean
  retrieval_top_k: number
  retrieval_match_threshold: number
  hybrid_search_enabled: boolean
  hybrid_candidate_count: number
  vector_search_weight: number
  keyword_search_weight: number
  rrf_k: number
  retrieval_overridden: boolean
}

// Legacy alias kept for SettingsPage backwards compat
export type AppSettings = FullAppSettings

export async function getSettings(): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings`, { headers })
  if (!res.ok) throw new Error("Failed to get settings")
  return res.json() as Promise<FullAppSettings>
}

export interface LLMProviderInput {
  id?: string
  name: string
  base_url: string
  api_key?: string
  models: string[]
}

export async function upsertProvider(provider: LLMProviderInput): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/providers`, {
    method: "PUT",
    headers,
    body: JSON.stringify(provider),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to save provider" }))
    throw new Error((err as { detail: string }).detail ?? "Failed to save provider")
  }
  return res.json() as Promise<FullAppSettings>
}

export async function deleteProvider(id: string): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/providers/${id}`, { method: "DELETE", headers })
  if (!res.ok) throw new Error("Failed to delete provider")
  return res.json() as Promise<FullAppSettings>
}

export async function activateProvider(id: string): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/providers/${id}/activate`, { method: "PATCH", headers })
  if (!res.ok) throw new Error("Failed to activate provider")
  return res.json() as Promise<FullAppSettings>
}

export interface EmbeddingSettingsInput {
  embedding_model?: string
  embedding_base_url?: string
  embedding_api_key?: string
  embedding_dimensions?: number
}

export async function updateEmbeddingSettings(input: EmbeddingSettingsInput): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/embedding`, {
    method: "PUT",
    headers,
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Update failed" }))
    throw new Error((err as { detail: string }).detail ?? "Update failed")
  }
  return res.json() as Promise<FullAppSettings>
}

export interface RerankingSettingsInput {
  rerank_enabled?: boolean
  rerank_provider?: string
  rerank_api_key?: string
  rerank_model?: string
  rerank_top_n?: number
}

export async function updateRerankingSettings(input: RerankingSettingsInput): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/reranking`, {
    method: "PUT",
    headers,
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error("Failed to update reranking settings")
  return res.json() as Promise<FullAppSettings>
}

export interface RetrievalSettingsInput {
  retrieval_top_k?: number
  retrieval_match_threshold?: number
  hybrid_search_enabled?: boolean
  hybrid_candidate_count?: number
  vector_search_weight?: number
  keyword_search_weight?: number
  rrf_k?: number
}

export async function updateRetrievalSettings(input: RetrievalSettingsInput): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/retrieval`, {
    method: "PUT",
    headers,
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error("Failed to update retrieval settings")
  return res.json() as Promise<FullAppSettings>
}

export async function resetEmbeddingSettings(): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/embedding`, { method: "DELETE", headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Reset failed" }))
    throw new Error((err as { detail: string }).detail ?? "Reset failed")
  }
  return res.json() as Promise<FullAppSettings>
}

export async function resetRerankingSettings(): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/reranking`, { method: "DELETE", headers })
  if (!res.ok) throw new Error("Failed to reset reranking settings")
  return res.json() as Promise<FullAppSettings>
}

export async function resetRetrievalSettings(): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/retrieval`, { method: "DELETE", headers })
  if (!res.ok) throw new Error("Failed to reset retrieval settings")
  return res.json() as Promise<FullAppSettings>
}

// Legacy — kept for backwards compat
export async function updateEmbeddingModel(model: string): Promise<FullAppSettings> {
  return updateEmbeddingSettings({ embedding_model: model })
}
