/**
 * Phase 087 Plan 03 Task 3 — FilesSection (PANEL-03).
 *
 * The Files section body: a keyboard-operable list of the thread's workspace
 * files (icon + mono filename + `formatBytes · v{version}` meta), with a green
 * flash on a freshly-written file. Clicking (or Enter/Space on) a row
 * full-replaces the list with <FilePreview> (sketch 005 winner A / file-browser-
 * and-diff.md D1); the `‹ Files` back button (in FilePreview) returns to the
 * list AND focus is restored to the originating row.
 *
 * Data: useWorkspaceFiles(threadId) + useViewingThread() (Phase 086 reactive
 * hooks — `data` is never undefined, empty array is a stable ref). No refresh.
 *
 * A11Y (A11Y-02 / UI-SPEC): role=listbox + role=option rows, roving tabindex,
 * ArrowUp/Down navigation, Enter/Space opens, no mouse-only path. The flash
 * respects prefers-reduced-motion (handled in index.css .animate-fileFlash).
 */
import { useEffect, useRef, useState } from "react"
import {
  FileText,
  FileCode,
  FileSpreadsheet,
  FileImage,
  File as FileIcon,
  Presentation,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  useWorkspaceFiles,
  useViewingThread,
} from "@/providers/StreamsProvider"
import type { WorkspaceFile } from "@/types"
import { FilePreview } from "./FilePreview"
import { TemplateUpload } from "./TemplateUpload"

// Copied verbatim from OutputFileCard.tsx:24-28 (the plan instructs copy, not
// re-derive — the source fn is not exported). Keep byte-for-byte identical.
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Per-extension office icons (sketch-016): docx/pptx/xlsx templates get a
// distinct glyph so the kind reads at a glance — checked BEFORE the generic
// fallthrough (and before the mime branches, since OOXML mimes are long and
// the path extension is the reliable signal for the template allowlist).
const OOXML_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const OOXML_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
const OOXML_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function iconFor(file: WorkspaceFile) {
  const mime = file.mime_type
  const ext = file.path.split(".").pop()?.toLowerCase() ?? ""
  // OOXML office types first (template uploads + agent-written office files).
  if (ext === "docx" || mime === OOXML_DOCX) return FileText
  if (ext === "xlsx" || mime === OOXML_XLSX) return FileSpreadsheet
  if (ext === "pptx" || mime === OOXML_PPTX) return Presentation
  if (mime === "text/markdown" || ext === "md") return FileText
  if (mime === "text/csv" || ext === "csv") return FileSpreadsheet
  if (mime.startsWith("image/")) return FileImage
  const codeExts = [
    "py", "ts", "tsx", "js", "jsx", "mjs", "json", "sh",
    "bash", "sql", "yml", "yaml", "html", "css",
  ]
  if (mime.startsWith("text/x-") || mime === "application/json" || codeExts.includes(ext)) {
    return FileCode
  }
  if (mime.startsWith("text/")) return FileText
  return FileIcon
}

// ── Ephemeral-template expiry helpers (D-02) — compute on render from
//    expires_at; NO per-second timer (Anti-Pattern). An agent file (no
//    expires_at) returns null/false → byte-identical render (D-11). ──
function expiryCaption(expiresAt?: string): string | null {
  if (!expiresAt) return null            // agent file → no badge (D-11)
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return "expired"
  const h = Math.floor(ms / 3_600_000)
  if (h >= 1) return `expires in ${h}h`
  return `expires in ${Math.max(1, Math.floor(ms / 60_000))}m`
}

function isNearExpiry(expiresAt?: string): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() - Date.now() < 3_600_000  // < 1h
}

/** Stable identity for a file row (id when present, else path). */
function fileKey(f: WorkspaceFile): string {
  return f.id ?? f.path
}

export interface FilesSectionProps {
  /** Phase 087-02: lift the opened file to WorkspacePanel so the Versions
   *  section can compare its versions (the file is never orphaned). Optional —
   *  FilesSection works standalone (its own drill-in preview) without it. */
  onSelectFile?: (file: WorkspaceFile) => void
}

export function FilesSection({ onSelectFile }: FilesSectionProps = {}) {
  const threadId = useViewingThread()
  const { data: files } = useWorkspaceFiles(threadId)

  const [selected, setSelected] = useState<WorkspaceFile | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const rowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  // The row to restore focus to after returning from a preview (D1 / A11Y).
  const lastOpenedKey = useRef<string | null>(null)

  // ── Fresh-write flash: remember which file key most recently changed
  //    (new key OR bumped version) so its row gets the green fileFlash. ──
  const prevVersions = useRef<Map<string, number>>(new Map())
  const [flashKey, setFlashKey] = useState<string | null>(null)

  useEffect(() => {
    let freshKey: string | null = null
    for (const f of files) {
      const key = fileKey(f)
      const ver = f.version ?? 0
      const prev = prevVersions.current.get(key)
      if (prev === undefined || ver > prev) {
        // a brand-new file or a version bump → candidate for the flash
        if (prevVersions.current.size > 0 || prev !== undefined) freshKey = key
      }
    }
    // sync the version map for the next diff
    const next = new Map<string, number>()
    for (const f of files) next.set(fileKey(f), f.version ?? 0)
    prevVersions.current = next

    if (freshKey) {
      setFlashKey(freshKey)
      const t = setTimeout(() => setFlashKey(null), 1500)
      return () => clearTimeout(t)
    }
  }, [files])

  // Clamp the roving active index when the list shrinks.
  useEffect(() => {
    if (activeIndex > files.length - 1) {
      setActiveIndex(Math.max(0, files.length - 1))
    }
  }, [files.length, activeIndex])

  const openFile = (file: WorkspaceFile) => {
    lastOpenedKey.current = fileKey(file)
    setSelected(file)
    // Lift the opened file so the Versions section can compare it (087-02).
    onSelectFile?.(file)
  }

  const handleBack = () => {
    const key = lastOpenedKey.current
    setSelected(null)
    // restore focus to the originating row after the list re-mounts
    requestAnimationFrame(() => {
      if (key) rowRefs.current.get(key)?.focus()
    })
  }

  const onKeyDown = (e: React.KeyboardEvent, index: number, file: WorkspaceFile) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault()
        openFile(file)
        break
      case "ArrowDown": {
        e.preventDefault()
        const next = Math.min(index + 1, files.length - 1)
        setActiveIndex(next)
        rowRefs.current.get(fileKey(files[next]))?.focus()
        break
      }
      case "ArrowUp": {
        e.preventDefault()
        const prev = Math.max(index - 1, 0)
        setActiveIndex(prev)
        rowRefs.current.get(fileKey(files[prev]))?.focus()
        break
      }
      default:
        break
    }
  }

  // ── Drill-in: full-replace the list with the preview (D1). ──
  if (selected && threadId) {
    return <FilePreview threadId={threadId} file={selected} onBack={handleBack} />
  }

  const rows = files

  // ── Upload affordance (D-01): extracted to <TemplateUpload/> so the panel's
  //    no-activity empty state (WorkspacePanel) can render it too. Rendered in
  //    BOTH the empty state and the populated list. ──
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-1 p-1">
        <TemplateUpload />
        <p className="px-2 py-3 text-[13px] text-panel-muted-foreground">No files yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 p-1">
      <TemplateUpload />
      <div role="listbox" aria-label="Workspace files" className="flex flex-col gap-0.5">
        {rows.map((file, index) => {
          const key = fileKey(file)
          const Icon = iconFor(file)
          const isActive = index === activeIndex
          const isTemplate = file.kind === "template_input"
          return (
            <div
              key={key}
              ref={(el) => {
                rowRefs.current.set(key, el)
              }}
              role="option"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => openFile(file)}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(e) => onKeyDown(e, index, file)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2.5 py-2 transition-colors",
                "hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive && "ring-1 ring-ring",
                flashKey === key && "animate-fileFlash",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0 text-panel-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground/90">
                {file.path}
              </span>
              {/* Ephemeral-template cue (D-02): "Template" badge + a live expiry
                  countdown caption (amber needs-attention when < 1h). Only for
                  kind='template_input' — an agent file renders byte-identically
                  (D-11). The caption recomputes on each natural panel re-render;
                  NO per-second timer (Anti-Pattern). */}
              {isTemplate && (
                <span className="flex flex-shrink-0 items-center gap-1.5">
                  <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-accent-foreground">
                    Template
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[10px]",
                      isNearExpiry(file.expires_at)
                        ? "text-amber-500"                       // needs-attention color (D-02)
                        : "text-panel-muted-foreground",
                    )}
                  >
                    {expiryCaption(file.expires_at)}
                  </span>
                </span>
              )}
              {/* Phase 088-05 (UAT SC#2): size/version meta ("376 B · v2") is
                  meaningful metadata → panel-scoped AA muted (was 4.01:1 light). */}
              <span className="flex-shrink-0 font-mono text-[10px] text-panel-muted-foreground">
                {formatBytes(file.size_bytes)}
                {file.version != null && ` · v${file.version}`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default FilesSection
