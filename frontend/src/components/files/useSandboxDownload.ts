import { useState } from "react"
import type { MouseEvent } from "react"
import { downloadSandboxOutput, DownloadError } from "@/lib/api"

/**
 * ── PHASE 302 PLAN 01 (D-02 / UI-D5) — THE ONE HOME OF SANDBOX-OUTPUT DOWNLOADS ──
 *
 * Lifted, unchanged, from `components/chat/OutputFileCard.tsx` so the chat's output
 * files and the Workspace panel's "Generated files" rows can never download
 * differently: the URL resolution, the `downloadSandboxOutput` call, the
 * `DownloadError` words, the generic fallback sentence, the 3 s auto-clear and the
 * in-flight guard all live here and nowhere else.
 *
 * Hooks only — no JSX, and no fetch other than `downloadSandboxOutput`. The caller
 * still owns its wrapper element (an `<a>` when there is a url; its own dead arm
 * when there is not), its classes and its density.
 */

// D-067.2-03: API_BASE for prepending the host on relative re-sign URLs emitted
// by the backend's harvest_output_files (e.g. "/sandbox-outputs/{path}"). The
// `API_BASE` constant inside lib/api.ts is not exported, so we read the env
// var directly here. (302-01: moved here from OutputFileCard, which was the only
// site that resolved OutputFile.url; the panel's generated rows are the second.)
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""

export function resolveOutputUrl(url: string): string {
  // D-067.2-03: new sandbox outputs store relative URLs (`/sandbox-outputs/{path}`);
  // prepend API_BASE for those. Legacy outputs (already-stored long-form
  // signed URLs starting with "http") pass through unchanged — they decay
  // after 1h as before (legacy decay accepted per CONTEXT.md § Claude's
  // Discretion).
  if (url.startsWith("/")) return `${API_BASE}${url}`
  return url
}

export interface SandboxDownload {
  downloading: boolean
  errorText: string | null
  href: string | undefined
  onClick: (e: MouseEvent<HTMLAnchorElement>) => Promise<void>
}

// Phase 067.3 (D-067.3-R2-03/04): JS blob fetch+download click intercept.
// onClick prevents the default anchor navigation (which would hit 401 because
// browsers send only cookies, not Authorization: Bearer), runs the helper
// from lib/api.ts which injects the Bearer token via fetch, follows the
// 302 to Supabase CDN, and triggers a programmatic <a download> click.
export function useSandboxDownload(url: string | undefined, filename: string): SandboxDownload {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<{ status: number | "network"; message: string } | null>(null)

  const onClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (downloading || !url) return
    setDownloading(true)
    setDownloadError(null)
    try {
      await downloadSandboxOutput(url, filename)
    } catch (err) {
      // D-067.3-R2-04 status-specific copy; messages already set inside the helper.
      if (err instanceof DownloadError) {
        setDownloadError({ status: err.status, message: err.message })
      } else {
        setDownloadError({ status: "network", message: "Download failed — try again." })
      }
      // Auto-clear after 3s — non-blocking, lightweight feedback (no toast lib in repo).
      setTimeout(() => setDownloadError(null), 3000)
    } finally {
      setDownloading(false)
    }
  }

  return {
    downloading,
    errorText: downloadError?.message ?? null,
    href: url ? resolveOutputUrl(url) : undefined,
    onClick,
  }
}
