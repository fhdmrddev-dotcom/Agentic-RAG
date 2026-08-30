/**
 * Phase 216 (ATTACH-01 / D-216-09) — Connected Cloud File Picker Modal.
 *
 * Allows users to browse and import single files directly from their connected
 * cloud storage (Google Drive, OneDrive, etc.) into the current workspace/chat.
 */

import { useState, useEffect } from "react"
import { Check, FileText, HardDrive, Loader2, Search, Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { listCloudFiles, importCloudFile, type CloudFileItem, type ConnectorConnection } from "@/lib/api"
import { ConnectionMarkGlyph } from "@/lib/connectionMark"
import { cn } from "@/lib/utils"

interface ConnectedFilePickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connections: ConnectorConnection[]
  onFileImported?: (doc: { id: string; filename: string }) => void
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
  onFileImported,
}: ConnectedFilePickerModalProps) {
  // Filter connections that support file storage (Google Workspace, Google Drive, OneDrive, etc.)
  const cloudConns = connections.filter(
    (c) =>
      c.is_enabled !== false &&
      (c.service_id.includes("google") ||
        c.service_id.includes("workspace") ||
        c.service_id.includes("drive") ||
        c.service_id.includes("onedrive") ||
        c.service_id.includes("dropbox") ||
        c.service_id.includes("box")),
  )

  const [selectedConnId, setSelectedConnId] = useState<string>(cloudConns[0]?.id ?? "")
  const [files, setFiles] = useState<CloudFileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [importingId, setImportingId] = useState<string | null>(null)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())
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

  async function handleImport(file: CloudFileItem) {
    if (!selectedConnId || importingId) return
    setImportingId(file.id)
    setError(null)
    try {
      const doc = await importCloudFile(selectedConnId, file.id)
      setImportedIds((prev) => new Set(prev).add(file.id))
      onFileImported?.(doc)
    } catch (err: any) {
      setError(err.message || "Failed to import file")
    } finally {
      setImportingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HardDrive className="h-5 w-5 text-primary" />
            <span>Import from Cloud Storage</span>
          </DialogTitle>
          <DialogDescription>
            Select a file to import into your active workspace.
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

        <div className="flex-1 min-h-[300px] max-h-[400px] overflow-y-auto border border-border rounded-lg divide-y divide-border/50">
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
              const isImported = importedIds.has(f.id)
              const isImporting = importingId === f.id
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-xs"
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

                  <Button
                    size="sm"
                    variant={isImported ? "outline" : "default"}
                    disabled={isImporting || isImported}
                    onClick={() => handleImport(f)}
                    className="shrink-0 h-8 gap-1 text-xs"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Importing...</span>
                      </>
                    ) : isImported ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                        <span>Imported</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        <span>Import</span>
                      </>
                    )}
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
