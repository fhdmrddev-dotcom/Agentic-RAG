import { useState } from "react"

interface FolderCreateInputProps {
  depth: number
  onCommit: (name: string) => void
  onCancel: () => void
}

export function FolderCreateInput({
  depth,
  onCommit,
  onCancel,
}: FolderCreateInputProps) {
  const [value, setValue] = useState("")

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
            if (trimmed) onCommit(trimmed)
          }
          if (e.key === "Escape") onCancel()
        }}
        className="w-full px-1 py-0.5 text-sm bg-background border rounded outline-none"
        placeholder="Folder name"
        autoFocus
      />
    </div>
  )
}
