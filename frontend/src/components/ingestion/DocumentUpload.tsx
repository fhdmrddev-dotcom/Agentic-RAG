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
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors",
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
            <Lock className="h-8 w-8 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Read-only folder</p>
              <p className="text-xs text-muted-foreground mt-0.5">Only the folder owner can upload files here</p>
            </div>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {folderName ? `Upload to ${folderName}` : "Upload to Root"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Drop files here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Supported: .txt, .md, .pdf, .docx, .pptx, .xlsx, .csv, .epub · Multiple files allowed</p>
            </div>
            {uploading && (
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {statusLabel && <span className="text-xs text-muted-foreground">{statusLabel}</span>}
              </div>
            )}
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
