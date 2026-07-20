import { useEffect, useRef, useState } from "react"
import { Globe } from "lucide-react"

interface FolderCreateInputProps {
  depth: number
  onCommit: (name: string, isOrgShared: boolean) => void
  onCancel: () => void
}

export function FolderCreateInput({
  depth,
  onCommit,
  onCancel,
}: FolderCreateInputProps) {
  const [value, setValue] = useState("")
  const [isOrgShared, setIsOrgShared] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const committedRef = useRef(false)

  // Use ref-based focus instead of autoFocus for reliability in StrictMode/dynamic mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div style={{ paddingLeft: `${depth * 12 + 8}px` }} className="py-1 pr-2">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          // Guard: if Enter already committed, don't also cancel on the blur that fires during unmount
          if (committedRef.current) return
          if (value.trim() === "") {
            committedRef.current = true
            onCancel()
          }
          // Non-empty on blur → keep input visible (user may be clicking the share checkbox)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            if (committedRef.current) return
            const trimmed = value.trim()
            if (trimmed) {
              committedRef.current = true
              onCommit(trimmed, isOrgShared)
            }
          }
          if (e.key === "Escape") {
            e.preventDefault()
            if (!committedRef.current) {
              committedRef.current = true
              onCancel()
            }
          }
        }}
        className="w-full px-1 py-0.5 text-sm bg-background border rounded outline-none"
        placeholder="Folder name"
      />
      <label className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={isOrgShared}
          onChange={(e) => setIsOrgShared(e.target.checked)}
          className="rounded"
        />
        <Globe className="h-3 w-3" />
        Shared with org
      </label>
    </div>
  )
}
