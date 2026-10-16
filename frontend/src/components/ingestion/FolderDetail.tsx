import { Globe, FileText, FolderIcon, Calendar, HardDrive } from "lucide-react"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"
import type { Folder } from "@/types"

/**
 * Phase 284-01 (D-07 / D-12 / UI-SPEC S5) — the band takes NUMBERS, not the folder's documents:
 * the summary's count and size, plus the summary read's state. `null` is "not answered", never 0.
 *   ready   — the shipped "N document(s)" + formatted size
 *   loading — `…` in each of the two number slots
 *   error   — ONE span of UI-SPEC S5's failure copy in place of both; the badge, subfolders and Created date
 *             stay, because they come from the folder and not the summary.
 */
interface FolderDetailProps {
  folder: Folder
  count: number | null
  sizeBytes: number | null
  state: "loading" | "ready" | "error"
  subfolderCount: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function FolderDetail({ folder, count, sizeBytes, state, subfolderCount }: FolderDetailProps) {
  const known = state === "ready" && count !== null && sizeBytes !== null

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
      {folder.is_org_shared && (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
          <Globe className="h-3 w-3" />
          Shared with org
        </span>
      )}
      {state === "error" ? (
        <span className="inline-flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" />
          Count not known yet
        </span>
      ) : (
        <>
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {known ? (
              <>
                <AnimatedNumber value={count} /> {count === 1 ? "document" : "documents"}
              </>
            ) : (
              "…"
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            <HardDrive className="h-3.5 w-3.5" />
            {known ? formatBytes(sizeBytes) : "…"}
          </span>
        </>
      )}
      {subfolderCount > 0 && (
        <span className="inline-flex items-center gap-1">
          <FolderIcon className="h-3.5 w-3.5" />
          <AnimatedNumber value={subfolderCount} /> {subfolderCount === 1 ? "subfolder" : "subfolders"}
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5" />
        Created {formatDate(folder.created_at)}
      </span>
    </div>
  )
}
