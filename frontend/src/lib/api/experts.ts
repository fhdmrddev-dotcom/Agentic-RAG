/**
 * Phase 260 / Phase 261 — domain module for Expert Bundles, AI drafting, and access grants.
 */

import type { ExpertBundle } from "../../types"
import { API_BASE, getAuthHeaders } from "./_core"

export interface ExpertBundleCreate {
  name: string
  slug: string
  description?: string
  icon?: string
  category?: string
  when_to_use?: string
  example_output?: string
  scope_mode?: "restricted" | "biased"
  tool_floor_enabled?: boolean
  member_skills?: string[]
  required_connections?: string[]
  knowledge_folder_ids?: string[]
  prompt_suggestions?: Array<{ title: string; prompt: string }>
  visibility?: "private" | "org" | "public" | "granted"
  is_enabled?: boolean
}

export interface ExpertBundleUpdate {
  name?: string
  slug?: string
  icon?: string
  category?: string
  when_to_use?: string
  example_output?: string
  description?: string
  scope_mode?: "restricted" | "biased"
  tool_floor_enabled?: boolean
  member_skills?: string[]
  required_connections?: string[]
  knowledge_folder_ids?: string[]
  prompt_suggestions?: Array<{ title: string; prompt: string }>
  visibility?: "private" | "org" | "public" | "granted"
  is_enabled?: boolean
}

export interface ExpertGrant {
  id: string
  expert_id: string
  grantee_type: "user" | "role"
  grantee_id: string
  created_at: string
}

export interface ExpertGrantCreate {
  grantee_type: "user" | "role"
  grantee_id: string
}

export interface ExpertDraftOutput {
  name: string
  slug: string
  description: string
  icon: string
  category: string
  when_to_use: string
  example_output: string
  scope_mode: "restricted" | "biased"
  member_skills: string[]
  required_connections: string[]
  knowledge_folder_ids: string[]
  prompt_suggestions: Array<{ title: string; prompt: string }>
  tool_floor_enabled: boolean
}

async function handleResponse<T>(res: Response, fallbackError: string): Promise<T> {
  if (!res.ok) {
    let msg = fallbackError
    try {
      const err = await res.json()
      if (typeof err.detail === "string") {
        msg = err.detail
      } else if (err.detail?.detail) {
        msg = err.detail.detail
      } else if (err.detail?.upgrade_hint) {
        msg = err.detail.upgrade_hint
      } else if (Array.isArray(err.detail) && err.detail.length > 0) {
        msg = err.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(", ")
      } else if (err.message) {
        msg = err.message
      }
    } catch {
      // Keep default
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function listExperts(
  includeSystem = true,
  enabledOnly = true,
  forManagement = false,
): Promise<ExpertBundle[]> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (!includeSystem) params.set("include_system", "false")
  if (!enabledOnly) params.set("enabled_only", "false")
  if (forManagement) params.set("for_management", "true")
  const qs = params.toString() ? `?${params.toString()}` : ""
  const res = await fetch(`${API_BASE}/experts${qs}`, { headers })
  return handleResponse<ExpertBundle[]>(res, "Failed to list experts")
}

export async function getExpert(bundleId: string): Promise<ExpertBundle> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/experts/${bundleId}`, { headers })
  return handleResponse<ExpertBundle>(res, "Failed to get expert")
}

export async function createExpert(payload: ExpertBundleCreate): Promise<ExpertBundle> {
  const authHeaders = (await getAuthHeaders()) as Record<string, string>
  const res = await fetch(`${API_BASE}/experts`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return handleResponse<ExpertBundle>(res, "Failed to create expert")
}

export async function updateExpert(bundleId: string, payload: ExpertBundleUpdate): Promise<ExpertBundle> {
  const authHeaders = (await getAuthHeaders()) as Record<string, string>
  const res = await fetch(`${API_BASE}/experts/${bundleId}`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return handleResponse<ExpertBundle>(res, "Failed to update expert")
}

export async function deleteExpert(bundleId: string): Promise<{ deleted: boolean; id: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/experts/${bundleId}`, {
    method: "DELETE",
    headers,
  })
  return handleResponse<{ deleted: boolean; id: string }>(res, "Failed to delete expert")
}

export async function draftExpert(
  description: string,
  files?: File[],
): Promise<ExpertDraftOutput> {
  const authHeaders = (await getAuthHeaders()) as Record<string, string>
  // Strip Content-Type so browser fetch sets multipart/form-data boundary automatically
  const { "Content-Type": _, ...headers } = authHeaders
  const formData = new FormData()
  formData.append("description", description)
  if (files && files.length > 0) {
    for (const f of files) {
      formData.append("files", f)
    }
  }
  const res = await fetch(`${API_BASE}/experts/draft`, {
    method: "POST",
    headers,
    body: formData,
  })
  return handleResponse<ExpertDraftOutput>(res, "Failed to draft expert")
}

export async function getExpertGrants(bundleId: string): Promise<ExpertGrant[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/experts/${bundleId}/grants`, { headers })
  return handleResponse<ExpertGrant[]>(res, "Failed to get expert grants")
}

export async function addExpertGrant(bundleId: string, payload: ExpertGrantCreate): Promise<ExpertGrant> {
  const authHeaders = (await getAuthHeaders()) as Record<string, string>
  const res = await fetch(`${API_BASE}/experts/${bundleId}/grants`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return handleResponse<ExpertGrant>(res, "Failed to add expert grant")
}

export async function removeExpertGrant(bundleId: string, grantId: string): Promise<{ deleted: boolean; id: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/experts/${bundleId}/grants/${grantId}`, {
    method: "DELETE",
    headers,
  })
  return handleResponse<{ deleted: boolean; id: string }>(res, "Failed to remove expert grant")
}
