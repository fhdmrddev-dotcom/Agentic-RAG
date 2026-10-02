/**
 * Phase 270 (270-03) — the ONLY place the download label is derived and the request made
 * (UI-SPEC Pattern 3). The signed URL is a bearer token: used once, never returned, stored or logged.
 *
 * Save step: NAVIGATION (270-SPIKE.md — Storage's Content-Disposition carries `filename*=UTF-8''…`,
 * so the original filename survives byte-exact). Cloud half of the spike is owed at 270-05.
 */
import { getDocumentDownloadUrl, DownloadError } from "@/lib/api"
import type { Document } from "@/types"

export class VersionMismatchError extends Error {
  readonly expected: number
  constructor(expected: number) {
    super(`The file returned was not v${expected}.`)
    this.name = "VersionMismatchError"
    this.expected = expected
  }
}

/** The control's words — the single derivation (P-04 one vocabulary). */
export function downloadLabel(doc: Pick<Document, "version_number" | "is_latest">): string {
  const v = doc.version_number
  if (v == null || v <= 1) return "Download"
  if (doc.is_latest === false) return `Download v${v} (viewed, not latest)`
  return `Download v${v} (latest)`
}

function saveViaNavigation(url: string): void {
  const a = document.createElement("a")
  a.href = url
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Mint for `doc.id`, verify the version named by the label, then save once. Never returns the URL. */
export async function startDocumentDownload(
  doc: Pick<Document, "id" | "version_number" | "filename">,
): Promise<void> {
  const expected = doc.version_number ?? 1
  const res = await getDocumentDownloadUrl(doc.id)
  if (res.version_number !== expected) throw new VersionMismatchError(expected)
  saveViaNavigation(res.url)
}

/** Visible words for every failure (UI-SPEC §Copywriting). */
export function downloadErrorCopy(err: unknown): string {
  if (err instanceof VersionMismatchError) {
    return `The file returned was not v${err.expected}. Nothing was downloaded.`
  }
  if (err instanceof DownloadError) {
    if (err.status === 404 || err.status === 403) {
      return "You don't have access to this file, so no download link was created."
    }
    if (err.status === 410) {
      return "The original file is missing from storage. Upload it again to make it downloadable."
    }
    if (err.status === 409) return "File lives in a connected source, not stored here."
  }
  return "Download failed. Check your connection and try again."
}
