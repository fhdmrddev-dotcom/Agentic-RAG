/**
 * Phase 087 Plan 03 Task 2 — FilePreview (PANEL-03, D-02).
 *
 * Full-replace drill-in preview router (sketch 005 winner A / file-browser-
 * and-diff.md D1). On mount/file-change it fetches the file content via
 * getWorkspaceFileContent (AbortController cancels stale fetches — T-087-06),
 * then routes by storage_type + mime/ext to a graceful per-type renderer.
 *
 * Routing (D-02):
 *   inline + md          → MarkdownRenderer  (reuse — sanitizes its own HTML)
 *   inline + code        → ShikiCode         (A1 — the LIVE highlighter; the
 *                                             UI-SPEC's literal mention of the
 *                                             legacy RSH highlighter is
 *                                             SUPERSEDED by ShikiCode per A1 /
 *                                             Pitfall 2 — no new dep either way)
 *   inline + csv         → CsvTablePreview
 *   inline + plain text  → <pre>
 *   bucket + image + non-null signed_url → <img src={signed_url}>
 *   bucket null-url / binary / too-large → calm "No preview available · Download"
 *
 * SECURITY (T-087-04): raw content is routed ONLY through MarkdownRenderer
 * (DOMPurify-sanitized), ShikiCode (HTML-escaped — pass RAW text, never
 * pre-rendered), CsvTablePreview / <pre> / <img> (plain React children).
 * FilePreview itself never injects raw file content as HTML.
 */
import { useEffect, useRef, useState } from "react"
import { ChevronLeft, Download, Loader2 } from "lucide-react"
import { downloadWorkspaceFile, getWorkspaceFileContent, DownloadError } from "@/lib/api"
import { useResolvedFileId } from "@/hooks/useResolvedFileId"
import type { WorkspaceFile, WorkspaceFileContent } from "@/types"
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer"
import { ShikiCode } from "@/components/chat/tool-bodies/ShikiCode"
import { CsvTablePreview } from "./CsvTablePreview"

interface FilePreviewProps {
  threadId: string
  file: WorkspaceFile
  onBack: () => void
}

/** Map a filename extension → a Shiki language id (A1). */
function langFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  switch (ext) {
    case "py":
      return "python"
    case "ts":
    case "tsx":
      return "typescript"
    case "js":
    case "jsx":
    case "mjs":
      return "javascript"
    case "json":
      return "json"
    case "sh":
    case "bash":
      return "bash"
    case "sql":
      return "sql"
    case "yml":
    case "yaml":
      return "yaml"
    case "html":
      return "html"
    case "css":
      return "css"
    default:
      return "text"
  }
}

type Kind = "markdown" | "code" | "csv" | "text" | "image" | "fallback"

function classifyInline(mime: string, path: string): Kind {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  if (mime === "text/markdown" || ext === "md" || ext === "markdown") return "markdown"
  if (mime === "text/csv" || ext === "csv") return "csv"
  const codeExts = [
    "py", "ts", "tsx", "js", "jsx", "mjs", "json", "sh", "bash",
    "sql", "yml", "yaml", "html", "css",
  ]
  if (
    mime === "application/json" ||
    mime.startsWith("text/x-") ||
    codeExts.includes(ext)
  ) {
    return "code"
  }
  if (mime.startsWith("text/")) return "text"
  return "fallback"
}

/** Basename of a workspace path → the download filename (101.1-09, gap 3). */
function deriveFilename(path: string): string {
  return path.split("/").pop() || "download"
}

function Fallback({
  message,
  onDownload,
  downloadError,
}: {
  message: string
  onDownload?: () => void
  downloadError?: string | null
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <p className="text-[13px] text-panel-muted-foreground">{message}</p>
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-primary hover:bg-accent transition-colors"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download
        </button>
      )}
      {downloadError && (
        <p className="text-[12px] text-destructive" role="alert">
          {downloadError}
        </p>
      )}
    </div>
  )
}

export function FilePreview({ threadId, file, onBack }: FilePreviewProps) {
  const backRef = useRef<HTMLButtonElement>(null)

  // Escape returns to the list (D1 / UI-SPEC A11Y).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onBack()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onBack])

  // Move focus to the back button on mount so keyboard users land in-preview.
  useEffect(() => {
    backRef.current?.focus()
  }, [])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 bg-surface px-3 py-2">
        <button
          ref={backRef}
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs text-panel-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />Files
        </button>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/80">
          {file.path}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <FilePreviewContent threadId={threadId} file={file} />
      </div>
    </div>
  )
}

/**
 * Inner body that owns the content fetch keyed by (threadId, file.id). Split
 * out so the back-button header (which never re-fetches) stays mounted while
 * the body re-fetches on file change.
 */
function FilePreviewContent({
  threadId,
  file,
}: {
  threadId: string
  file: WorkspaceFile
}) {
  const [content, setContent] = useState<WorkspaceFileContent | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  // Phase 088-05 (D-16): resolve a USABLE id before fetching. In the live
  // (no-refresh) flow the file now arrives with its id on the SSE; if it's ever
  // missing this backfills it from the GET listing by path (never an empty id →
  // no `/files//content` 404).
  const resolved = useResolvedFileId(threadId, file)

  // Phase 101.1-09 (gap 3): the Fallback Download control. It fetches the EXACT
  // bytes (Bearer-authed raw-bytes route) so a produced deliverable is reachable
  // from the panel (UAT Test 2: Download was dead text). A graceful inline error
  // surfaces if the helper throws (no new toast system — a local string).
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const onDownload =
    resolved.status === "ready"
      ? () => {
          setDownloadError(null)
          downloadWorkspaceFile(threadId, resolved.id, deriveFilename(file.path)).catch(
            (err: unknown) => {
              setDownloadError(
                err instanceof DownloadError
                  ? err.message
                  : "Download failed — try again.",
              )
            },
          )
        }
      : undefined

  useEffect(() => {
    // Still backfilling the id from the GET listing → hold the spinner.
    if (resolved.status === "resolving") {
      setContent(null)
      setError(false)
      setLoading(true)
      return
    }
    // No listing row matched the path (or the lookup failed) → graceful fallback.
    if (resolved.status === "unresolved") {
      setContent(null)
      setError(true)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(false)
    setContent(null)
    getWorkspaceFileContent(threadId, resolved.id, controller.signal)
      .then((c) => {
        if (active) {
          setContent(c)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (active && (err as { name?: string })?.name !== "AbortError") {
          setError(true)
          setLoading(false)
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [threadId, resolved.status, resolved.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-4 w-4 animate-spin text-panel-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  if (error || !content) {
    return (
      <Fallback
        message="No preview available · Download"
        onDownload={onDownload}
        downloadError={downloadError}
      />
    )
  }

  if (content.storage_type === "bucket") {
    const isImage = content.mime_type.startsWith("image/")
    if (isImage && content.signed_url) {
      return (
        <div className="p-3">
          <img
            src={content.signed_url}
            alt={file.path}
            className="max-w-full rounded-md"
          />
        </div>
      )
    }
    return (
      <Fallback
        message="No preview available · Download"
        onDownload={onDownload}
        downloadError={downloadError}
      />
    )
  }

  const kind = classifyInline(content.mime_type, file.path)
  switch (kind) {
    case "markdown":
      return (
        <div className="p-3">
          <MarkdownRenderer content={content.content} />
        </div>
      )
    case "code":
      return (
        <div className="p-1">
          <ShikiCode code={content.content} language={langFromPath(file.path)} />
        </div>
      )
    case "csv":
      return <CsvTablePreview content={content.content} />
    case "text":
      return (
        <pre className="m-0 whitespace-pre-wrap break-words px-3 py-2 font-mono text-[13px] text-foreground">
          {content.content}
        </pre>
      )
    default:
      return (
        <Fallback
          message="No preview available · Download"
          onDownload={onDownload}
          downloadError={downloadError}
        />
      )
  }
}
