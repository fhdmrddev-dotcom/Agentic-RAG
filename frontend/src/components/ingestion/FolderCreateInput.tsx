import { useState } from "react"
import { Globe } from "lucide-react"

interface FolderCreateInputProps {
  depth: number
  onCommit: (name: string, isGlobal: boolean) => void
  onCancel: () => void
}

export function FolderCreateInput({
  depth,
  onCommit,
  onCancel,
}: FolderCreateInputProps) {
  const [value, setValue] = useState("")
  const [isGlobal, setIsGlobal] = useState(false)

  return (
    <div style={{ paddingLeft: `${depth * 12 + 8}px` }} className="py-1 pr-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value.trim() === "") onCancel()
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const trimmed = value.trim()
            if (trimmed) onCommit(trimmed, isGlobal)
          }
          if (e.key === "Escape") onCancel()
        }}
        className="w-full px-1 py-0.5 text-sm bg-background border rounded outline-none"
        placeholder="Folder name"
        autoFocus
      />
      <label className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={isGlobal}
          onChange={(e) => setIsGlobal(e.target.checked)}
          className="rounded"
        />
        <Globe className="h-3 w-3" />
        Global folder
      </label>
    </div>
  )
}
