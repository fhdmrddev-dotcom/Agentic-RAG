/**
 * Phase 100 TMPL-01 (D-01) — TemplateUpload: the panel-local ephemeral-template
 * upload affordance. Extracted from FilesSection (100-06) so the panel's
 * no-activity empty state can render it too — the hasActivity short-circuit in
 * WorkspacePanel made the FilesSection copy structurally unreachable on a fresh
 * thread (G-4 lived-experience gap, found during Phase 100 live UAT).
 *
 * Hidden OOXML-only file input + a quiet button. accept= is a UX hint only —
 * the server's validate_ooxml is the real gate (T-100-06-01). On success the
 * returned row is optimistically upserted (panel reconciles, no refresh, D-03);
 * errors surface inline — nothing renders in chat (D-04).
 */
import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { useViewingThread, useStreamActions } from "@/providers/StreamsProvider"
import { uploadWorkspaceTemplate } from "@/lib/api"

export function TemplateUpload() {
  const threadId = useViewingThread()
  const { setWorkspaceFileForThread } = useStreamActions()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (f: File) => {
    if (!threadId) return
    setUploading(true)
    try {
      const uploaded = await uploadWorkspaceTemplate(threadId, f)
      setWorkspaceFileForThread(threadId, uploaded) // optimistic reconcile (no refresh)
      setUploadError(null)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    // Reset the input so re-selecting the same file fires change again.
    e.target.value = ""
    if (f) void handleUpload(f)
  }

  return (
    <div className="flex flex-col gap-1 px-1 pb-1">
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.pptx,.xlsx"
        aria-label="Upload template file"
        tabIndex={-1}
        className="hidden"
        onChange={onFileInputChange}
      />
      <button
        type="button"
        disabled={!threadId || uploading}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5",
          "text-[12px] font-medium text-foreground/80 transition-colors",
          "hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        {uploading ? "Uploading…" : "Upload template"}
      </button>
      {uploadError && (
        <p role="alert" className="px-0.5 text-[11px] text-destructive">
          {uploadError}
        </p>
      )}
    </div>
  )
}

export default TemplateUpload
