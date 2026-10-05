/**
 * Phase 274 (ATT-03 / D-12 / D-13 / D-14) — the Save-to-Library wire layer.
 *
 * Three routes, all under `/threads/{thread_id}/workspace` (274-02's `workspace_promote.py`):
 *   - `POST  /files/{file_id}/promote`          body `{folder_id}` → 201 saved | 200 already
 *   - `GET   /files/{file_id}/promote-preview`  `?folder_id=` → what confirming WOULD do
 *   - `GET   /library-links`                    → every attachment's Library mark, one request
 *
 * ⛔ Field names here are the contract's, verbatim. 274-05 fences them against the backend; a
 *   renamed field is a silent `undefined` in the dialog, never a type error.
 * ⛔ Every call uses the shared auth header builder, so it carries `X-Org-Id` (the server
 *   re-validates it; a caller in two orgs with no header gets a 400).
 * ⛔ A refusal surfaces the SERVER's sentence verbatim and its HTTP status. The dialog tells a 403
 *   (not your folder) from a 404 (folder gone) from a 422 (type refused) by `status`, and shows
 *   the sentence under its own lead line — it never paraphrases (D-12).
 *
 * Not re-exported through `lib/api.ts`: callers import this domain module directly (the
 * gated `apiBarrel.test.ts` checks only the connectors domain).
 */
import { API_BASE, getAuthHeaders } from "./_core"

export type LibraryLinkOutcome = "saved" | "already"

/** `pending | processing | completed | failed` (DB CHECK) plus the frontend's `paused`. */
export type LibraryDocumentStatus = "pending" | "processing" | "completed" | "failed" | "paused"

/** POST .../promote — 201 `saved` or 200 `already`. On `already`, `folder_id` is the EXISTING copy's. */
export interface PromoteResult {
  outcome: LibraryLinkOutcome
  document_id: string
  folder_id: string | null
  document_status: LibraryDocumentStatus
  filename: string
  version_number: number
}

/** GET .../promote-preview — advisory; the POST's answer is the one that is rendered as a result. */
export interface PromotePreview {
  promotable: boolean
  refusal: string | null
  filename: string
  duplicate_of: { document_id: string; folder_id: string | null } | null
  next_version: number | null
}

export interface LibraryLinkInfo {
  document_id: string
  outcome: LibraryLinkOutcome
  folder_id: string | null
  document_status: LibraryDocumentStatus
  filename: string
}

export interface AttachmentLibraryState {
  workspace_file_id: string
  promotable: boolean
  link: LibraryLinkInfo | null
}

export interface LibraryLinksResponse {
  files: AttachmentLibraryState[]
}

/** A refused or failed attachment call: the server's own sentence plus the HTTP status. */
export class PromoteError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "PromoteError"
    this.status = status
  }
}

/**
 * Unwrap FastAPI's `detail` exactly as `attachConnectionFileToThread` does: a plain string, or
 * `{reason_code, message}`. A body that is not JSON falls back to `fallback` — never to raw HTML.
 */
async function refusalOf(res: Response, fallback: string): Promise<PromoteError> {
  const err = await res.json().catch(() => ({ detail: fallback }))
  const detail = (err as { detail?: unknown } | null)?.detail
  const message =
    typeof detail === "string"
      ? detail
      : (detail as { message?: string } | null)?.message ?? fallback
  return new PromoteError(res.status, message)
}

function base(threadId: string): string {
  return `${API_BASE}/threads/${threadId}/workspace`
}

/** Copy one chat attachment into a chosen Library folder. The folder is REQUIRED (D-10: no Root). */
export async function promoteAttachment(
  threadId: string,
  fileId: string,
  folderId: string,
): Promise<PromoteResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${base(threadId)}/files/${fileId}/promote`, {
    method: "POST",
    headers,
    body: JSON.stringify({ folder_id: folderId }),
  })
  if (!res.ok) throw await refusalOf(res, "Couldn't save this file to the Library.")
  return res.json() as Promise<PromoteResult>
}

/** What saving into `folderId` would do: refused, a duplicate, or the next version number. */
export async function getPromotePreview(
  threadId: string,
  fileId: string,
  folderId: string,
): Promise<PromotePreview> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams({ folder_id: folderId })
  const res = await fetch(`${base(threadId)}/files/${fileId}/promote-preview?${params.toString()}`, {
    headers,
  })
  if (!res.ok) throw await refusalOf(res, "Couldn't check this folder.")
  return res.json() as Promise<PromotePreview>
}

/** Every attachment's Library mark for one thread, in ONE request (D-15). */
export async function getLibraryLinks(threadId: string): Promise<LibraryLinksResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${base(threadId)}/library-links`, { headers })
  if (!res.ok) throw await refusalOf(res, "Couldn't load this chat's Library links.")
  return res.json() as Promise<LibraryLinksResponse>
}
