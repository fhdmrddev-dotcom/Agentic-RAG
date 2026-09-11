/**
 * Phase 100 TMPL-01 (D-01) — TemplateUpload: the panel-local ephemeral-template
 * upload affordance. Extracted from FilesSection (100-06) so the panel's
 * no-activity empty state can render it too — the hasActivity short-circuit in
 * WorkspacePanel made the FilesSection copy structurally unreachable on a fresh
 * thread (G-4 lived-experience gap, found during Phase 100 live UAT).
 *
 * Hidden file input + a quiet button. accept= is a UX hint only — the server's
 * validate_upload is the real gate (T-100-06-01 / T-151-03). Phase 151 (D-09)
 * widened the allowlist beyond OOXML to real skill assets (scripts, .md/.json/
 * .csv, images). On success the returned row is optimistically upserted (panel
 * reconciles, no refresh, D-03); errors surface inline — nothing renders in chat (D-04).
 *
 * ⭐ Phase 244 (SHELL-04 / D-244-24): this docblock used to say the list was "kept in
 * lockstep with workspace.py _ALLOWED_EXT" — an invariant asked for and enforced by
 * nothing, one of THREE hand-typed copies. The literal is gone; accept= now reads
 * WORKSPACE_ACCEPT_ATTR from `@/lib/workspaceAllowedExt`, and
 * `src/lib/__tests__/workspaceAllowedExt.lockstep.test.ts` parses workspace.py as source
 * and asserts set equality. The lockstep is a MECHANISM now, not a sentence.
 */
import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { useViewingThread, useStreamActions } from "@/providers/StreamsProvider"
import { uploadWorkspaceTemplate } from "@/lib/api"
import { WORKSPACE_ACCEPT_ATTR } from "@/lib/workspaceAllowedExt"

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
        accept={WORKSPACE_ACCEPT_ATTR}
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
