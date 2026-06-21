import { useRef, useState } from "react"
import { Lock, Upload } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  onUpload: (file: File, folderId?: string | null) => Promise<{ isDuplicate: boolean }>
  uploading: boolean
  uploadingCount?: number
  folderId?: string | null
  folderName?: string | null
  disabled?: boolean
}

interface BatchResult {
  uploaded: number
  duplicates: number
  errors: string[]
}

export function DocumentUpload({ onUpload, uploading, uploadingCount = 0, folderId, folderName, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)

  async function handleFiles(files: File[]) {
    if (!files.length || disabled) return
    setResult(null)

    const outcomes = await Promise.allSettled(files.map((f) => onUpload(f, folderId)))

    const batch: BatchResult = { uploaded: 0, duplicates: 0, errors: [] }
    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") {
        if (outcome.value.isDuplicate) batch.duplicates++
        else batch.uploaded++
      } else {
        batch.errors.push(outcome.reason instanceof Error ? outcome.reason.message : "Upload failed")
      }
    }
    setResult(batch)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(Array.from(e.target.files || []))
    e.target.value = ""
  }

  const statusLabel =
    uploadingCount > 1
      ? `Uploading ${uploadingCount} files…`
      : uploading
        ? "Uploading…"
        : null

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && !disabled && inputRef.current?.click()}
        className={cn(
          // Compact single-row drop bar. (Was a tall p-10 dropzone that pushed the
          // file list below the fold — especially on short viewports.) Drag-drop AND
          // click-to-browse both still work on the whole bar.
          "flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors",
          disabled
            ? "pointer-events-none opacity-60 cursor-not-allowed border-muted-foreground/20"
            : cn(
                "cursor-pointer",
                dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50",
              ),
          uploading && "pointer-events-none opacity-60",
        )}
      >
        {disabled ? (
          <>
            <Lock className="h-5 w-5 text-muted-foreground/50 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground leading-tight">Read-only folder</p>
              <p className="text-xs text-muted-foreground truncate leading-tight">Only the folder owner can upload files here</p>
            </div>
          </>
        ) : uploading ? (
          <>
            <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm font-medium">{statusLabel ?? "Uploading…"}</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">
                {folderName ? `Upload to ${folderName}` : "Upload to Root"}
              </p>
              <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                Drop files here or click to browse · .txt .md .pdf .docx .pptx .xlsx .csv .epub
              </p>
            </div>
          </>
        )}
      </div>

      {result && !uploading && (
        <div className="space-y-1">
          {(result.uploaded > 0 || result.duplicates > 0) && (
            <p className="text-sm text-muted-foreground">
              {[
                result.uploaded > 0 && `${result.uploaded} uploaded`,
                result.duplicates > 0 && `${result.duplicates} already up to date`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {result.errors.map((err, i) => (
            <p key={i} className="text-sm text-destructive">{err}</p>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".txt,.md,.pdf,.docx,.pptx,.xlsx,.csv,.epub,text/plain,text/markdown,text/csv,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  )
}
