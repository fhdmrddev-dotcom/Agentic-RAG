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

import type {
  Document,
  DocumentChunkRow,
  DocumentContentResponse,
  DocumentImageRow,
  DocumentQueryRow,
  ConversationResponse,
  DocumentTableRow,
  Folder,
  WorkspaceFile,
} from "../../types"
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

/**
 * Phase 244 (SHELL-04 / D-244-05 / BUG-260905-01) — attach ONE connected-cloud file to THIS
 * THREAD via `POST /threads/{tid}/workspace/files/from-connection`.
 *
 * ⛔ THIS IS DELIBERATELY NOT `importCloudFile`. That one drives the LIBRARY's single-file
 * import and mints a `documents` row; this one writes a `workspace_files` row under the same
 * 24h TTL read gate a local attach gets, and **no `documents` row at all**. Both composer
 * doors therefore mean the same thing — *this conversation* — which is the un-inversion
 * `BUG-260905-01` asks for.
 *
 * The throw shape mirrors `uploadWorkspaceTemplate`'s exactly: `err.detail` is the server's
 * OWN sentence and it is never paraphrased, so one refusal vocabulary serves both doors.
 */
export async function attachConnectionFileToThread(
  threadId: string,
  connectionId: string,
  fileId: string,
): Promise<WorkspaceFile> {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}/threads/${threadId}/workspace/files/from-connection`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ connection_id: connectionId, file_id: fileId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Attach failed" }))
    const detail = (err as { detail?: unknown }).detail
    // FastAPI sends either a plain string `detail` or `{reason_code, message}` — the disabled
    // connection uses the second shape, and dropping it would print "[object Object]".
    const message =
      typeof detail === "string"
        ? detail
        : (detail as { message?: string } | null)?.message ?? "Attach failed"
    throw new Error(message)
  }
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

// ──────────────────────────────────────────────────────────────────────────────────────
// Phase 217 (LIB-04 / D-217-04) — the five document-DETAIL reads.
//
// `document_chunks.content` has been stored since migration 002 and `full_markdown` since
// the pipeline's terminal write; until plans 02/03 landed these routes nothing in the
// browser could reach either. Each function is `listDocuments`' exact shape — the shared
// `getAuthHeaders()` -> `fetch` -> `if (!res.ok) throw` -> `res.json() as Promise<T>` —
// and each throws a DISTINCT message, so a section's error arm can say which read failed
// rather than sharing one anonymous "Failed to load".
//
// ⚠ Every one of these MUST also be re-exported from `lib/api.ts`. A symbol exported from
// this module and forgotten in the barrel typechecks perfectly and is invisible to every
// consumer (D-207-06) — `apiBarrel.test.ts` now guards that for this module, not only for
// `connectors.ts`.
// ──────────────────────────────────────────────────────────────────────────────────────

/** GET /documents/{id}/content — the parsed text, sliced to a line range, UNNUMBERED.
 *
 *  ⚠ The query parameters are `start_line` / `end_line`, which is what
 *  `documents.py:883-887` declares — NOT `from` / `to`. Both are 1-based and inclusive.
 *  Omitting `endLine` asks the server for ONE page (`CONTENT_PAGE_LINES` = 500); an
 *  explicit span is capped server-side at `CONTENT_MAX_LINES` = 2000 and the envelope's
 *  `end_line` reports what was actually served, so `has_more` is authoritative and never
 *  re-derived here.
 *
 *  A document with no parsed text is a 200 with `content: ""` — NOT a 404. Only a document
 *  the caller cannot see is a 404 (217-02's `error_kind` discriminator makes that split on
 *  the server, so this client never sniffs an error string). */
export async function getDocumentContent(
  id: string,
  opts?: { startLine?: number; endLine?: number },
): Promise<DocumentContentResponse> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (opts?.startLine != null) params.set("start_line", String(opts.startLine))
  if (opts?.endLine != null) params.set("end_line", String(opts.endLine))
  const qs = params.toString()
  const res = await fetch(`${API_BASE}/documents/${id}/content${qs ? `?${qs}` : ""}`, { headers })
  if (!res.ok) throw new Error("Failed to load document text")
  return res.json() as Promise<DocumentContentResponse>
}

/** GET /documents/{id}/chunks — the chunks the agent actually searches, in `chunk_index`
 *  order. `embedding_model` / `embedding_dimensions` are per-CHUNK because their variation
 *  mid-re-embed is the whole point (D-217-08): a half-re-embedded document is a fact only
 *  this list can show. */
export async function listDocumentChunks(id: string): Promise<DocumentChunkRow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/chunks`, { headers })
  if (!res.ok) throw new Error("Failed to load document chunks")
  return res.json() as Promise<DocumentChunkRow[]>
}

/** GET /documents/{id}/conversation — the other messages of this document's mail thread,
 *  oldest first.
 *
 *  ⚠ It takes a DOCUMENT id and never a `thread_key`. A thread key is derived from a
 *  `Message-ID`, which is chosen by whoever sent the mail — so a route accepting one would
 *  be a lookup handle an outsider gets to pick (TM-240-13). A document with no thread key
 *  answers 200 with an empty list; that is the ordinary case for almost every document. */
export async function fetchDocumentConversation(id: string): Promise<ConversationResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/conversation`, { headers })
  if (!res.ok) throw new Error("Failed to load conversation")
  return res.json() as Promise<ConversationResponse>
}

/** GET /documents/{id}/tables — the extracted tables, in `table_index` order.
 *  ⚠ Owner-only by migration 108: a document reached through SOMEONE ELSE'S globally
 *  visible folder returns an empty list here, and that is correct rather than a failure
 *  (the row's `table_count` badge, computed through the same client, already reads 0). */
export async function listDocumentTables(id: string): Promise<DocumentTableRow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/tables`, { headers })
  if (!res.ok) throw new Error("Failed to load document tables")
  return res.json() as Promise<DocumentTableRow[]>
}

/** GET /documents/{id}/images — the image DESCRIPTIONS.
 *  ⚠ There is no picture on this wire and there never can be: `document_images` stores no
 *  bytes, so the description IS the image. Same owner-only asymmetry as tables. */
export async function listDocumentImages(id: string): Promise<DocumentImageRow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/images`, { headers })
  if (!res.ok) throw new Error("Failed to load document images")
  return res.json() as Promise<DocumentImageRow[]>
}

/** GET /documents/{id}/queries — the searches that returned this document, within the
 *  backend's rolling window. `query_text` is null on rows written by the view/filter path
 *  (D-115-10), which records a `via` and no question. */
export async function listDocumentQueries(id: string): Promise<DocumentQueryRow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/queries`, { headers })
  if (!res.ok) throw new Error("Failed to load the searches that found this document")
  return res.json() as Promise<DocumentQueryRow[]>
}
