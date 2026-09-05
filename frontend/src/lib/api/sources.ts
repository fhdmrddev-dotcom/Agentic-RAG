/**
 * Phase 234 (LIB-08 / SURF-01 / VIS-05) — Typed client for Folder Watches & Source Sync API.
 */

import { API_BASE, ApiError, getAuthHeaders } from "./_core"

export interface ConnectorWatchItem {
  id: string
  watch_id: string
  external_id: string
  name: string
  path_hint: string
  source_version?: string | null
  source_modified_at?: string | null
  content_hash?: string | null
  document_id?: string | null
  state: "present" | "missing" | "unauthorized" | string
  first_seen_at?: string | null
  last_seen_at?: string | null
  missing_since?: string | null
  last_error?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ConnectorWatch {
  id: string
  org_id?: string | null
  user_id: string
  connection_id: string
  source_folder_id: string
  source_folder_name: string
  source_drive_id?: string | null
  library_folder_id?: string | null
  interval_minutes: number
  next_run_at?: string | null
  leased_until?: string | null
  is_active: boolean
  last_run_at?: string | null
  last_status?: string | null
  last_error?: string | null
  item_count: number
  connection_name?: string | null
  service_id?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ConnectorWatchDetail extends ConnectorWatch {
  items: ConnectorWatchItem[]
}

export interface CreateWatchPayload {
  connection_id: string
  source_folder_id: string
  source_folder_name: string
  source_drive_id?: string | null
  library_folder_id?: string | null
  interval_minutes?: number
}

export interface UpdateWatchPayload {
  interval_minutes?: number
  is_active?: boolean
  library_folder_id?: string | null
  clear_library_folder?: boolean
}

export interface WatchSyncResponse {
  status: string
  message: string
}

export interface WatchPurgeResponse {
  status: string
  purged_count: number
  message: string
}

export async function listWatches(signal?: AbortSignal): Promise<ConnectorWatch[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches`, { headers, signal })
  if (!res.ok) {
    throw new ApiError(`Failed to load watches (status ${res.status})`, res.status)
  }
  return (await res.json()) as ConnectorWatch[]
}

export async function getWatch(id: string, signal?: AbortSignal): Promise<ConnectorWatchDetail> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches/${encodeURIComponent(id)}`, { headers, signal })
  if (!res.ok) {
    throw new ApiError(`Failed to load watch ${id} (status ${res.status})`, res.status)
  }
  return (await res.json()) as ConnectorWatchDetail
}

export async function createWatch(payload: CreateWatchPayload): Promise<ConnectorWatch> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(`Failed to create watch: ${text}`, res.status)
  }
  return (await res.json()) as ConnectorWatch
}

export async function updateWatch(id: string, payload: UpdateWatchPayload): Promise<ConnectorWatch> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(`Failed to update watch ${id}: ${text}`, res.status)
  }
  return (await res.json()) as ConnectorWatch
}

export async function deleteWatch(id: string, purgeDocuments: boolean = false): Promise<void> {
  const headers = await getAuthHeaders()
  const url = `${API_BASE}/sources/watches/${encodeURIComponent(id)}${purgeDocuments ? "?purge_documents=true" : ""}`
  const res = await fetch(url, {
    method: "DELETE",
    headers,
  })
  if (!res.ok && res.status !== 204) {
    const text = await res.text()
    throw new ApiError(`Failed to delete watch ${id}: ${text}`, res.status)
  }
}

export async function triggerWatchSync(id: string): Promise<WatchSyncResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches/${encodeURIComponent(id)}/sync`, {
    method: "POST",
    headers,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(`Failed to trigger sync for watch ${id}: ${text}`, res.status)
  }
  return (await res.json()) as WatchSyncResponse
}

export async function purgeWatchFiles(id: string): Promise<WatchPurgeResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches/${encodeURIComponent(id)}/purge`, {
    method: "POST",
    headers,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(`Failed to purge files for watch ${id}: ${text}`, res.status)
  }
  return (await res.json()) as WatchPurgeResponse
}
