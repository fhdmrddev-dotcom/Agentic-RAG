/**
 * Phase 207 — domain module split out of `lib/api.ts`.
 *
 * ⚠ MOVED VERBATIM, NOT REWRITTEN. `lib/api.ts` is still the only public entry
 * point and keeps its path, because suites mock this module BY PATH and `196-08`
 * measured 249 red tests from a single added export. Nothing outside `lib/` moves.
 *
 * ⚠ This docblock deliberately does NOT spell the mock call it describes: the
 * acceptance census greps for that literal, and prose containing it inflates the
 * count it is supposed to hold still (the 187-24 trap — measured here, not feared).
 */

import type { Document, Folder, WorkspaceFile } from "../../types"
import { API_BASE, getAuthHeaders, getAuthToken } from "./_core"
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

// Phase 100 (TMPL-01 / D-01): upload an ephemeral OOXML template into the
// thread's workspace via POST /threads/{tid}/workspace/files (workspace.py
// `upload_template`). Mirrors uploadDocument's FormData + Bearer shape — the
// NO-Content-Type detail is load-bearing so the browser sets the multipart
// boundary itself. The server is the real gate (validate_ooxml magic-byte
// check, Plan 100-04); the panel reconciles by upserting the returned row.
export async function uploadWorkspaceTemplate(
  threadId: string,
  file: File,
): Promise<WorkspaceFile> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/threads/${threadId}/workspace/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },  // NO Content-Type — browser sets the boundary
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error((err as { detail: string }).detail ?? "Upload failed")
  }
  // WR-08 (100-REVIEW): the backend route returns write_file's dict whose key is
  // `file_id` (no `id`). Map it at the API boundary instead of a blind cast so the
  // optimistically upserted store row carries a real id — 088-05 D-16 history:
  // missing workspace-file ids caused live `/files//content` 404s.
  const row = (await res.json()) as WorkspaceFile & { file_id?: string }
  return { ...row, id: row.id ?? row.file_id }
}

// Phase 067.3 (D-067.3-R2-01/02/04): JS blob fetch+download for
// /sandbox-outputs/{path}. Plain <a href> clicks send only cookies and
// the FastAPI get_current_user dependency reads Authorization: Bearer
// headers exclusively → 401. This helper injects the Bearer token via
// fetch, follows the 302 to Supabase CDN, downloads as Blob, triggers
// programmatic <a download> click. NO backend changes (sandbox_outputs.py
// stays as-is). Right-click "Save link as" falls back to the default
// browser behavior (raw anchor click → 401) — accepted UX trade-off
// for chat-history context (D-067.3-R2-03 + Specifics §"R-2 right-click").
export class DownloadError extends Error {
  readonly status: number | "network"
  constructor(status: number | "network", message: string) {
    super(message)
    this.status = status
    this.name = "DownloadError"
  }
}

export async function downloadSandboxOutput(
  relativeUrl: string,
  filename: string,
): Promise<void> {
  // Normalize: prepend API_BASE only for relative URLs (matches the
  // resolveOutputUrl shape used by tool-bodies/ExecuteCodeBody.tsx
  // (Phase 075.7 rename of the legacy execute-code wrapper) — keeps the
  // call site simple
  // by accepting either form).
  const url = relativeUrl.startsWith("/") ? `${API_BASE}${relativeUrl}` : relativeUrl

  let token: string
  try {
    token = await getAuthToken()
  } catch {
    throw new DownloadError(401, "Session expired — please refresh the page and try again.")
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      // redirect: "follow" is the default; the 302 → Supabase CDN is
      // auto-followed and the final response carries the file bytes.
    })
  } catch {
    // Network failure (offline, DNS, CORS preflight reject) → status="network".
    throw new DownloadError("network", "Download failed — try again.")
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new DownloadError(401, "Session expired — please refresh the page and try again.")
    }
    if (res.status === 404) {
      // Backend collapses missing-and-IDOR to 404 (sandbox_outputs.py:48-67
      // existence-leak prevention) — frontend mirrors that message verbatim.
      throw new DownloadError(404, "File not found.")
    }
    // 5xx + any other non-2xx
    throw new DownloadError(res.status, "Download failed — try again.")
  }

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement("a")
    a.href = blobUrl
    a.download = filename
    // Append-then-click-then-remove pattern — required by Firefox.
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Revoke after a short delay — some browsers are async about the
    // download trigger and revoking immediately can race the save dialog.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  }
}

// Phase 101.1-09 (gap 3): the 067.3 blob-download pattern for a workspace
// deliverable. A produced docx/pptx/xlsx is stored INLINE, so its bytes are NOT
// reachable via the /content route (which str-decodes inline content and corrupts
// the binary). This helper hits the raw-bytes route (workspace.py
// /files/{id}/raw) with the Bearer token, blobs the EXACT bytes, and triggers a
// programmatic <a download> click — mirroring downloadSandboxOutput's contract
// (DownloadError on 401/404/5xx; the missing-and-IDOR-collapsed 404 maps to the
// same "File not found"). Closes the "Download is dead text" last mile of TMPL-02.
export async function downloadWorkspaceFile(
  threadId: string,
  fileId: string,
  filename: string,
): Promise<void> {
  let token: string
  try {
    token = await getAuthToken()
  } catch {
    throw new DownloadError(401, "Session expired — please refresh the page and try again.")
  }

  const url = `${API_BASE}/threads/${threadId}/workspace/files/${fileId}/raw`
  let res: Response
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new DownloadError("network", "Download failed — try again.")
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new DownloadError(401, "Session expired — please refresh the page and try again.")
    }
    if (res.status === 404) {
      // Backend collapses missing-and-IDOR-and-expired to 404 (existence-leak rule).
      throw new DownloadError(404, "File not found.")
    }
    throw new DownloadError(res.status, "Download failed — try again.")
  }

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement("a")
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  }
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

export async function createFolder(name: string, parentId: string | null, isOrgShared = false): Promise<Folder> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders`, {
    method: "POST",
    headers,
    // Phase 165 (MIG-02): the wire field is is_org_shared (folders = FUNCTIONAL org-share).
    body: JSON.stringify({ name, parent_id: parentId, is_org_shared: isOrgShared }),
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

export async function toggleFolderOrgShared(id: string): Promise<Folder> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders/${id}/toggle-global`, {
    method: "PATCH",
    headers,
  })
  if (!res.ok) {
    if (res.status === 403) throw new Error("Only the folder owner can change org sharing")
    throw new Error("Failed to update folder sharing")
  }
  return res.json() as Promise<Folder>
}
