/**
 * Phase 216 (ATTACH-01 / D-216-09) — Connected Cloud File Picker Modal.
 * Phase 244 plan 06 (SHELL-04 / D-244-05 / D-244-22 / D-244-27) — REBUILT AROUND
 * SELECT-THEN-CONFIRM, and re-pointed: it no longer decides what a pick MEANS.
 *
 * ⛔ WHAT CHANGED, AND WHY IT WAS NOT "ATTRIBUTES PLUS A TEST". The plan's first framing
 * guessed this modal already composed in the drawn order and needed only `data-*` hooks. It
 * was measured at the revision pass and the guess was WRONG on three counts: there was no
 * source line, **no selection state at all** (every row carried its own immediate `Import`
 * button, so a click WAS the commit), and no cancel/confirm footer — the dialog closed via ✕
 * or a backdrop click. Sketch 236's § Build Contract draws
 * *title · source line · file list with single-select · cancel + confirm*, so this is an
 * interaction-model change, not a JSX reorder.
 *
 * ⛔ AND THE COMMIT IS NOW THE PARENT'S. The modal used to call `importCloudFile`, which mints
 * a LIBRARY document — so a file picked mid-chat was written permanently into the Library root
 * (`BUG-260905-01`). It now raises `onConfirm` and the CALLER decides: the composer attaches to
 * the thread, the Library imports into the selected folder. One picker, two doors, no forked
 * file-picker vocabulary.
 *
 * ⭐ The confirm WORD is a prop with a chat default. `Attach` is the composer's (`D-244-23`:
 * *"the confirm button is the last moment before the file exists"*); `Import` is the Library's,
 * and the two must not be the same word for two different consequences.
 */

import { useState, useEffect, useMemo } from "react"
import { FileText, HardDrive, Loader2, Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { listCloudFiles, type CloudFileItem, type ConnectorConnection } from "@/lib/api"
import { ConnectionMarkGlyph } from "@/lib/connectionMark"
import { COPY } from "./composerCopy"
import { cn } from "@/lib/utils"

interface ConnectedFilePickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connections: ConnectorConnection[]
  /** The title above the source line. Defaults to the composer's ported word. */
  title?: string
  /**
   * The word on the confirm control. ⛔ Defaults to `Attach` — `Import` belongs to the
   * Library door and means a permanent KB write (D-244-23).
   */
  confirmLabel?: string
  /**
   * What a confirmed pick MEANS. The modal does not know, and that is the point: it raises
   * the choice and the caller commits it. ⚠ The caller owns its own failure reporting — a
   * rejection closes this dialog so the refusal is said in ONE place, never twice.
   */
  onConfirm: (args: { connectionId: string; file: CloudFileItem }) => Promise<void> | void
}

/**
 * The provider NOUN for the source line. ⚠ Derived from `service_id`, never from the
 * connection's display NAME — reading a provider out of a name is the fourth-leak shape
 * `import_service.fetch_cloud_file` was measured to have in Phase 238 (a Microsoft connection
 * a person had typed "Google migration" into was read by the Google adapter).
 */
function providerLabel(serviceId: string): string {
  const id = (serviceId || "").toLowerCase()
  if (id.includes("onedrive") || id.includes("sharepoint")) return "OneDrive"
  if (id.includes("dropbox")) return "Dropbox"
  if (id.includes("box")) return "Box"
  if (id.includes("google") || id.includes("workspace") || id.includes("drive")) return "Google Drive"
  return "cloud storage"
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return ""
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function ConnectedFilePickerModal({
  open,
  onOpenChange,
  connections,
  title,
  confirmLabel,
  onConfirm,
}: ConnectedFilePickerModalProps) {
  // Filter connections that support file storage (Google Workspace, Google Drive, OneDrive, etc.)
  const cloudConns = useMemo(
    () =>
      connections.filter(
        (c) =>
          c.is_enabled !== false &&
          (c.service_id.includes("google") ||
            c.service_id.includes("workspace") ||
            c.service_id.includes("drive") ||
            c.service_id.includes("onedrive") ||
            c.service_id.includes("dropbox") ||
            c.service_id.includes("box") ||
            c.service_id.includes("mock")),
      ),
    [connections],
  )

  const [selectedConnId, setSelectedConnId] = useState<string>(cloudConns[0]?.id ?? "")
  const [files, setFiles] = useState<CloudFileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cloudConns.length > 0 && !selectedConnId) {
      setSelectedConnId(cloudConns[0].id)
    }
  }, [cloudConns, selectedConnId])

  useEffect(() => {
    if (!open || !selectedConnId) return
    let cancelled = false

    async function fetchFiles() {
      setLoading(true)
      setError(null)
      try {
        const res = await listCloudFiles(selectedConnId, searchQuery.trim() || undefined)
        if (!cancelled) {
          setFiles(res.files)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load files from cloud storage")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const timer = setTimeout(() => {
      fetchFiles()
    }, searchQuery ? 300 : 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, selectedConnId, searchQuery])

  // A pick belongs to ONE browse session. Switching connection, searching again, or closing
  // the dialog must not leave a stale selection armed behind the confirm button.
  useEffect(() => {
    setSelectedFileId(null)
  }, [selectedConnId, searchQuery, open])

  const activeConn = cloudConns.find((c) => c.id === selectedConnId) ?? cloudConns[0]
  const selectedFile = files.find((f) => f.id === selectedFileId) ?? null

  async function handleConfirm() {
    if (!selectedFile || !selectedConnId || confirming) return
    setConfirming(true)
    try {
      await onConfirm({ connectionId: selectedConnId, file: selectedFile })
    } catch {
      /* ⛔ SWALLOWED ON PURPOSE, and this is the "one refusal vocabulary" rule in code.
         The caller has already rendered the server's sentence in ITS own refusal region —
         the composer's `role="alert"` strip, the Library's inline row. Re-rendering it here
         would say the same refusal twice, in two different shapes, and D-244-27's whole
         finding is that a second vocabulary for one fact is how a surface drifts. */
    } finally {
      setConfirming(false)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="cloud-file-picker"
        className="max-w-2xl max-h-[85vh] flex flex-col p-6 gap-4"
      >
        {/* ── BLOCK 1 + 2 — the title, then the SOURCE LINE (sketch 236 § modalHTML `.mtop`) ──
            ⛔ Their DOM order is asserted with `compareDocumentPosition`, never query order. */}
        <DialogHeader>
          <DialogTitle
            data-testid="cloud-title"
            className="flex items-center gap-2 text-lg"
          >
            {title ?? COPY.a.cloudTitle}
          </DialogTitle>
          <DialogDescription data-testid="cloud-source" className="flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {COPY.a.cloudSub(
              providerLabel(activeConn?.service_id ?? ""),
              activeConn?.name ?? "your connection",
            )}
          </DialogDescription>
        </DialogHeader>

        {cloudConns.length > 1 && (
          <div className="flex gap-2 border-b border-border pb-2">
            {cloudConns.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedConnId(c.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  selectedConnId === c.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground",
                )}
              >
                <ConnectionMarkGlyph shape={c} size="chip" />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cloud files by name..."
            className="pl-9 text-xs"
          />
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
            {error}
          </div>
        )}

        {/* ── BLOCK 3 — the file list, SINGLE-SELECT ────────────────────────────────────────
            ⛔ Exactly one row can carry `data-cloud-row-selected="true"`, and the fence counts
            them rather than checking the row it just clicked: a list that selected BOTH would
            pass "the row I clicked is selected" and fail the person. */}
        <div
          data-testid="cloud-filelist"
          role="listbox"
          aria-label="Cloud files"
          className="flex-1 min-h-[300px] max-h-[400px] overflow-y-auto border border-border rounded-lg divide-y divide-border/50"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Fetching cloud files...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-xs text-muted-foreground">
              <p>No files found.</p>
            </div>
          ) : (
            files.map((f) => {
              const isSelected = selectedFileId === f.id
              return (
                <div
                  key={f.id}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  data-cloud-row-selected={isSelected ? "true" : "false"}
                  onClick={() => setSelectedFileId(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setSelectedFileId(f.id)
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 transition-colors text-xs cursor-pointer",
                    "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isSelected ? "bg-primary/10" : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                    {f.icon_url ? (
                      <img src={f.icon_url} alt="" className="h-5 w-5 shrink-0" />
                    ) : (
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate text-foreground">{f.name}</div>
                      <div className="text-[10px] text-muted-foreground flex gap-2">
                        {f.size ? <span>{formatBytes(f.size)}</span> : null}
                        {f.modified_at ? (
                          <span>Updated {new Date(f.modified_at).toLocaleDateString()}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 rounded-full border transition-colors",
                      isSelected ? "border-primary bg-primary" : "border-border",
                    )}
                  />
                </div>
              )
            })
          )}
        </div>

        {/* ── BLOCK 4 + 5 — CANCEL BEFORE CONFIRM (sketch 236 § modalHTML `.mbot`) ────────── */}
        <div className="flex items-center justify-end gap-2">
          <Button
            data-testid="cloud-cancel"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onOpenChange(false)}
          >
            {COPY.a.cloudCancel}
          </Button>
          <Button
            data-testid="cloud-confirm"
            size="sm"
            className="h-8 text-xs"
            disabled={!selectedFile || confirming}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel ?? COPY.a.cloudConfirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
