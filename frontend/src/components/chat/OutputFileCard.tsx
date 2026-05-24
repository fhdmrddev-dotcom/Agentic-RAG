import { useState } from "react"
import type { MouseEvent } from "react"
import { Loader2, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { downloadSandboxOutput, DownloadError } from "@/lib/api"

// D-067.2-03: API_BASE for prepending the host on relative re-sign URLs emitted
// by the backend's harvest_output_files (e.g. "/sandbox-outputs/{path}"). The
// `API_BASE` constant inside lib/api.ts is not exported, so we read the env
// var directly here. Lives alongside OutputFileCard because this is the only
// site that resolves OutputFile.url across the chat surface.
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""

function resolveOutputUrl(url: string): string {
  // D-067.2-03: new sandbox outputs store relative URLs (`/sandbox-outputs/{path}`);
  // prepend API_BASE for those. Legacy outputs (already-stored long-form
  // signed URLs starting with "http") pass through unchanged — they decay
  // after 1h as before (legacy decay accepted per CONTEXT.md § Claude's
  // Discretion).
  if (url.startsWith("/")) return `${API_BASE}${url}`
  return url
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Relaxed prop shape (D-075.2-05 / D-075.2-06 / RESEARCH §Q4): finalOutputFiles
// entries on the Message type carry `{ filename: string; url?: string }` with
// no `size` field, while per-cell outputFiles supply both. The canonical
// `OutputFile` type in `@/types` stays STRICT (`url: string`, `size: number`);
// only this component's prop shape relaxes both fields. The strict type is a
// structural subtype of this relaxed shape, so the existing per-cell call site
// in tool-bodies/ExecuteCodeBody (Phase 075.7 rename) keeps typechecking
// verbatim.
interface OutputFileCardProps {
  file: {
    filename: string
    url?: string
    size?: number
    /** Plan 075.4-04 D-075.4-D2 — populated by Plan 075.4-03's content-hash
     *  dedup in sandbox_service.harvest_output_files when iteration N produces
     *  a DIFFERENT SHA-256 for the SAME filename as iteration N-1 (the
     *  "iteratively-refining pptx" case). Renders a tiny "Replaces:" subline
     *  so the user can see which previous file the current output supersedes
     *  — closes BUG-260523-03's user-visible affordance side (backend dedup
     *  was Plan 03's deliverable; UI surfacing is this Plan 04 wave). */
    supersedes?: string
  }
}

// Phase 067.3 (D-067.3-R2-03/04): JS blob fetch+download click intercept.
// onClick prevents the default anchor navigation (which would hit 401 because
// browsers send only cookies, not Authorization: Bearer), runs the helper
// from lib/api.ts which injects the Bearer token via fetch, follows the
// 302 to Supabase CDN, and triggers a programmatic <a download> click.
// The static <a href> is preserved so right-click "Save link as" still
// has a real target — the resulting raw click will 401, which is an
// accepted UX trade-off (rare in chat-history context).
export function OutputFileCard({ file }: OutputFileCardProps) {
  // Hooks declared unconditionally so rules-of-hooks is trivially satisfied
  // regardless of whether the url-optional branch returns early below.
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<{ status: number | "network"; message: string } | null>(null)

  // Url-optional back-compat (D-075.2-05 / RESEARCH §Q4): render plain-filename
  // row when url is missing (legacy finalOutputFiles entries persisted before
  // url stamping was added). Hooks above are unused in this branch but their
  // unconditional declaration keeps hook ordering stable across renders.
  if (!file.url) {
    return (
      <div className="flex items-center gap-2.5 rounded-md ghost-border px-3 py-2 text-xs bg-muted/30">
        <Download className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 opacity-40" />
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="font-mono text-foreground/60 truncate">{file.filename}</span>
          {file.supersedes && (
            <span className="text-[10px] text-muted-foreground/70 truncate">
              Replaces: {file.supersedes}
            </span>
          )}
        </span>
      </div>
    )
  }

  const handleClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (downloading) return
    setDownloading(true)
    setDownloadError(null)
    try {
      await downloadSandboxOutput(file.url!, file.filename)
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

  return (
    <a
      href={resolveOutputUrl(file.url)} /* preserved so right-click 'Save link as' has a real target — accepted 401 trade-off (D-067.3-R2-03) */
      download={file.filename}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      aria-disabled={downloading}
      className={cn(
        "flex items-center gap-2.5 rounded-md ghost-border px-3 py-2 text-xs transition-colors group",
        downloading ? "bg-muted/30 opacity-60 cursor-not-allowed" : "bg-muted/30 hover:bg-accent/40",
        downloadError ? "border border-red-500/40" : "",
      )}
    >
      {downloading ? (
        <Loader2 className="w-3.5 h-3.5 text-primary flex-shrink-0 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5 text-primary flex-shrink-0" />
      )}
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="font-mono text-foreground/80 truncate">{file.filename}</span>
        {/* Plan 075.4-04 D-075.4-D2 — supersedes subline (closes BUG-260523-03 UI side).
            React auto-escapes text content; no XSS surface introduced. */}
        {file.supersedes && (
          <span className="text-[10px] text-muted-foreground/70 truncate">
            Replaces: {file.supersedes}
          </span>
        )}
        {downloadError && (
          <span className="text-red-400 text-[10px] truncate">{downloadError.message}</span>
        )}
      </span>
      {file.size != null && (
        <span className="text-muted-foreground/50 flex-shrink-0">{formatBytes(file.size)}</span>
      )}
    </a>
  )
}
