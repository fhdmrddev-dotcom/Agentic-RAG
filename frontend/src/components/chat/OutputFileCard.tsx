import { useState } from "react"
import type { MouseEvent } from "react"
import { Loader2, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { fileIcon } from "@/lib/fileIcon"
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
    /** Phase 095 Plan 05 (D-08) — additive hero flag (read by MessageItem to
     *  pick the variant; this card renders it as a "★ Your file" caption in the
     *  hero variant). Optional — older streams degrade to working. */
    is_hero?: boolean
  }
  /** Phase 095 Plan 05 (D-07) — layout flag. "hero" = the emphasized "★ Your
   *  file" block (primary glow border, gradient bg, larger fileIcon, prominent
   *  Download); "working" = the quieter intermediate row. Default "working" so
   *  every existing call site is unchanged. BOTH variants use the SAME
   *  fileIcon(filename) (Plan 01) and the SAME url-optional / download states. */
  variant?: "hero" | "working"
}

// Phase 067.3 (D-067.3-R2-03/04): JS blob fetch+download click intercept.
// onClick prevents the default anchor navigation (which would hit 401 because
// browsers send only cookies, not Authorization: Bearer), runs the helper
// from lib/api.ts which injects the Bearer token via fetch, follows the
// 302 to Supabase CDN, and triggers a programmatic <a download> click.
// The static <a href> is preserved so right-click "Save link as" still
// has a real target — the resulting raw click will 401, which is an
// accepted UX trade-off (rare in chat-history context).
export function OutputFileCard({ file, variant = "working" }: OutputFileCardProps) {
  // Hooks declared unconditionally so rules-of-hooks is trivially satisfied
  // regardless of whether the url-optional branch returns early below.
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<{ status: number | "network"; message: string } | null>(null)

  const isHeroVariant = variant === "hero"
  // Phase 095 Plan 05 (D-07): the per-extension icon (Plan 01 fileIcon, the ONE
  // shared icon system — no second icon path). Larger glyph in the hero block.
  const icon = fileIcon(file.filename, isHeroVariant ? 30 : 16)

  // Url-less dead state (D-07 / 095-VALIDATION.md D-07 dead-link row): a file
  // arriving without a `url` (older persisted entry, or a url-less emit) now
  // renders the download affordance CLEARLY DISABLED (the sketch's `dl-btn.dead`
  // state) rather than a silent plain filename with no affordance. This closes
  // RESEARCH dead-link root #1 — no silent dead anchor. The "Download
  // unavailable" copy + the disabled style make the missing link legible.
  if (!file.url) {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-md ghost-border text-xs",
          isHeroVariant ? "px-4 py-3 bg-muted/30" : "px-3 py-2 bg-muted/30",
        )}
        data-variant={variant}
        data-dead="true"
      >
        <span className="flex-shrink-0 opacity-70">{icon}</span>
        <span className="flex-1 min-w-0 flex flex-col">
          {isHeroVariant && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
              ★ Your file
            </span>
          )}
          <span className="font-mono text-foreground/60 truncate">{file.filename}</span>
          {file.supersedes && (
            <span className="text-[10px] text-muted-foreground/70 truncate">
              Replaces: {file.supersedes}
            </span>
          )}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium flex-shrink-0",
            "border-red-500/40 bg-red-500/10 text-red-400 cursor-not-allowed",
          )}
          aria-disabled="true"
          title="Download unavailable — this file has no link"
        >
          <Download className="w-3 h-3" />
          Download unavailable
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
      data-variant={variant}
      className={cn(
        "flex items-center rounded-md text-xs transition-colors group",
        // Phase 095 Plan 05 (D-07): hero = primary glow border + gradient wash +
        // prominent layout; working = the quieter ghost-border row. Reuse-only
        // utilities (bg-primary/5, border-primary/40 — no new keyframes).
        isHeroVariant
          ? "gap-3.5 px-4 py-3 border border-primary/40 bg-gradient-to-br from-primary/10 to-accent/5 shadow-[0_0_0_1px_rgba(99,102,241,0.08)]"
          : "gap-2.5 px-3 py-2 ghost-border",
        downloading
          ? "opacity-60 cursor-not-allowed"
          : isHeroVariant
            ? "hover:from-primary/15 hover:to-accent/10"
            : "bg-muted/30 hover:bg-accent/40",
        downloadError ? "border border-red-500/40" : "",
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 min-w-0 flex flex-col">
        {isHeroVariant && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
            ★ Your file
          </span>
        )}
        <span
          className={cn(
            "font-mono truncate",
            isHeroVariant ? "text-sm text-foreground font-medium" : "text-foreground/80",
          )}
        >
          {file.filename}
        </span>
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
      {isHeroVariant ? (
        <span className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground flex-shrink-0">
          {downloading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          Download
        </span>
      ) : downloading ? (
        <Loader2 className="w-3.5 h-3.5 text-primary flex-shrink-0 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5 text-primary flex-shrink-0" />
      )}
    </a>
  )
}
