import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  onUpload: (file: File) => Promise<void>
  uploading: boolean
}

export function DocumentUpload({ onUpload, uploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    try {
      await onUpload(file)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer",
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">Drop a file here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Supported: .txt, .md, .pdf, .docx</p>
        </div>
        {uploading && (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  )
}
