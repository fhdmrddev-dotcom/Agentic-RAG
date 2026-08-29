/**
 * Phase 217.1 plan 10 (LIB-01 / BE-2 / D-217.1-27) — the Folders table.
 *
 * One row per `folders[]` entry from `GET /library/index-summary`:
 * `Folder · Documents · Chunks · Vectors · Last indexed · Actions`.
 *
 * ⛔ THE HONEST ROOT ROW (D-217.1-31 / "the point of the tab"): a folder with zero chunks
 * renders `–` (documents/chunks/vectors as applicable) and `never` for Last indexed —
 * NEVER `0` and never a green/ready tick. `Root`, never `Uncategorized`.
 *
 * ⛔ `Re-index selected` gating (RESEARCH Open Question 1): a zero-chunk folder's Actions
 * cell carries NO action (a control that cannot do its verb is what the `✕` cut removed).
 * A stale non-empty folder renders `Re-index selected`; an already-current folder (BE-3's
 * distinguishable `remaining: 0` signal) shows "Already indexed with the current model."
 * on click rather than a false success.
 */
import { useState } from "react"
import { kickReembed } from "@/lib/api"
import type { IndexSummary, FolderIndexRow } from "@/lib/api"

/** What a fact reads when the server has not told us yet. Never blank, never zero. */
const UNKNOWN = "Not known yet"

export function FoldersIndexTable({
  summary,
  canManage,
}: {
  summary: IndexSummary | null
  /** `features.model_management === true` — gates the per-row Re-index button (VANISH). */
  canManage: boolean
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  const rows: FolderIndexRow[] = summary?.folders ?? []

  async function handleReindex(folder: FolderIndexRow) {
    if (busyId) return
    setBusyId(folder.folder_id ?? "root")
    setFeedback((prev) => ({ ...prev, [folder.folder_id ?? "root"]: "" }))
    try {
      const result = await kickReembed({ folder_ids: folder.folder_id ? [folder.folder_id] : [] })
      // BE-3's distinguishable scope marker: an already-current folder is NOT success.
      setFeedback((prev) => ({
        ...prev,
        [folder.folder_id ?? "root"]:
          result.scope === "already_current"
            ? "Already indexed with the current model."
            : result.scope === "folder_empty"
              ? "This folder has no documents to index."
              : "Queued.",
      }))
    } catch {
      setFeedback((prev) => ({
        ...prev,
        [folder.folder_id ?? "root"]: "Could not start the re-index.",
      }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-xl bg-card/50 ghost-border">
      <h3 className="px-4 pt-3 text-sm font-semibold leading-tight">Folders</h3>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">{UNKNOWN}</p>
      ) : (
        <div className="mt-1 overflow-x-auto">
          <table className="w-full text-sm" data-testid="folders-index-table">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3">Folder</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3">Chunks</th>
                <th className="px-4 py-3">Vectors</th>
                <th className="px-4 py-3">Last indexed</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((folder) => {
                const key = folder.folder_id ?? "root"
                const hasChunks = (folder.chunks ?? 0) > 0
                const msg = feedback[key]
                return (
                  <tr key={key} className="border-b border-border/50" data-folder-id={key}>
                    <td className="px-4 py-3 font-medium">{folder.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {hasChunks ? folder.documents : "–"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {hasChunks ? folder.chunks : "–"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {hasChunks ? folder.vectors : "–"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {folder.last_indexed
                        ? new Date(folder.last_indexed).toLocaleString()
                        : "never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {msg ? (
                        <span className="text-xs text-muted-foreground">{msg}</span>
                      ) : hasChunks && canManage ? (
                        <button
                          type="button"
                          data-testid={`reindex-${key}`}
                          onClick={() => handleReindex(folder)}
                          disabled={busyId === key}
                          className="rounded-lg border border-border bg-card/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent/40 transition-colors disabled:opacity-60"
                        >
                          Re-index selected
                        </button>
                      ) : (
                        /* Zero-chunk folder: NO action (Open Question 1 — a control that
                           cannot do its verb is what the ✕ cut removed). */
                        <span className="text-xs text-muted-foreground/60">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
