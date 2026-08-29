/**
 * Phase 217.1 plan 03 (D-217.1-05) — the upload target folder picker.
 *
 * Modeled on `components/health/MoveToFolderDialog.tsx:28-75`: fetch folders via
 * `listFolders()`, render a `Select` with a `"root"` sentinel value, and let the
 * caller wire the selection to the upload's `folderId`. The "root" sentinel maps
 * to `null` — the same convention the move-to-folder dialog uses, so the two
 * pickers never disagree about what "Root" means.
 *
 * The picker is a child of the Ingestion tab's `Add files` sub-tab. It carries its
 * own fetch and local state; the parent (IngestionTab) receives the selected folder
 * id and name via callbacks.
 */
import { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { listFolders } from "@/lib/api"
import type { Folder } from "@/types"

interface Props {
  /** Called when the user picks a folder. `id` is `null` for Root. */
  onSelect: (id: string | null, name: string) => void
  /** The currently selected folder id, or null for Root. */
  selectedFolderId?: string | null
}

export function UploadFolderPicker({ onSelect, selectedFolderId }: Props) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    listFolders()
      .then(setFolders)
      .catch(() => setFolders([]))
      .finally(() => setLoading(false))
  }, [])

  function handleChange(value: string) {
    if (value === "root") {
      onSelect(null, "Root")
    } else {
      const folder = folders.find((f) => f.id === value)
      onSelect(value, folder?.name ?? "Folder")
    }
  }

  return (
    <div data-testid="upload-folder-picker" className="flex flex-col gap-1.5">
      <Select
        value={selectedFolderId ?? "root"}
        onValueChange={handleChange}
        disabled={loading}
      >
        <SelectTrigger className="w-full max-w-[280px]">
          <SelectValue placeholder="Add to Root" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="root">Root</SelectItem>
          {folders.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Everything you add here is searchable by the agent.
      </p>
    </div>
  )
}