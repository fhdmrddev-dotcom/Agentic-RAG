/**
 * Phase 234 (LIB-08 / SURF-01 / VIS-05) — Create Watch Modal.
 *
 * Configures automated background watching of an external cloud folder into a Library folder.
 */

import React, { useEffect, useState } from "react"
import { AlertCircle, Clock, Folder, HardDrive, Loader2, ShieldCheck } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { listConnectorConnections } from "@/lib/api"
import type { ConnectorConnection } from "@/lib/api/org"
import { createWatch, type ConnectorWatch } from "@/lib/api/sources"
import { useFolders } from "@/hooks/useFolders"
import { SourceFolderPicker, type SelectedFolder } from "./SourceFolderPicker"
import { cn } from "@/lib/utils"

export interface CreateWatchModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (watch: ConnectorWatch) => void
  defaultDestinationFolderId?: string | null
}

const CADENCE_OPTIONS = [
  { label: "15 minutes", value: 15 },
  { label: "30 minutes (recommended)", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "6 hours", value: 360 },
  { label: "24 hours", value: 1440 },
]

function isSourceCapable(c: ConnectorConnection): boolean {
  const id = (c.service_id || "").toLowerCase()
  if (c.status === "revoked" || c.status === "error") return false
  return id.includes("google") || id.includes("workspace") || id.includes("drive")
}

export function CreateWatchModal({
  open,
  onClose,
  onSuccess,
  defaultDestinationFolderId = null,
}: CreateWatchModalProps) {
  const { folders } = useFolders()
  const [connections, setConnections] = useState<ConnectorConnection[] | null>(null)
  const [loadingConnections, setLoadingConnections] = useState(false)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [selectedFolder, setSelectedFolder] = useState<SelectedFolder | null>(null)
  const [destinationFolderId, setDestinationFolderId] = useState<string | null>(defaultDestinationFolderId)
  const [intervalMinutes, setIntervalMinutes] = useState<number>(30)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSelectedFolder(null)
      setError(null)
      setSubmitting(false)
      return
    }

    setLoadingConnections(true)
    listConnectorConnections()
      .then((rows) => {
        const capable = rows.filter(isSourceCapable)
        setConnections(capable)
        if (capable.length > 0 && !selectedConnectionId) {
          setSelectedConnectionId(capable[0].id)
        }
      })
      .catch(() => {
        setError("Could not load connected services.")
      })
      .finally(() => {
        setLoadingConnections(false)
      })
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConnectionId || !selectedFolder) {
      setError("Please select both a connection and a source folder.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const created = await createWatch({
        connection_id: selectedConnectionId,
        source_folder_id: selectedFolder.folderId,
        source_folder_name: selectedFolder.folderName,
        source_drive_id: selectedFolder.driveId || null,
        library_folder_id: destinationFolderId || null,
        interval_minutes: intervalMinutes,
      })
      onSuccess?.(created)
      onClose()
    } catch (err: any) {
      setError(err?.message || "Failed to create folder watch.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            Watch Cloud Folder
          </DialogTitle>
          <DialogDescription>
            Automatically ingest new and updated files from your connected drive into your Library.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-5 pr-1 py-1">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Connection selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              1. Connected Account
            </label>
            {loadingConnections ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading connections...
              </div>
            ) : !connections || connections.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground border border-dashed rounded-lg bg-card/50">
                No Google Drive connections found. Please connect Google Drive in{" "}
                <span className="font-medium text-foreground">Settings → Connections</span> first.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {connections.map((conn) => (
                  <button
                    key={conn.id}
                    type="button"
                    onClick={() => {
                      setSelectedConnectionId(conn.id)
                      setSelectedFolder(null)
                    }}
                    className={cn(
                      "px-3 py-2 text-sm rounded-lg border transition-all text-left flex items-center gap-2",
                      selectedConnectionId === conn.id
                        ? "border-primary bg-primary/10 text-foreground font-medium ring-1 ring-primary"
                        : "border-border/60 bg-card hover:bg-muted/50 text-muted-foreground",
                    )}
                  >
                    <HardDrive className="h-4 w-4" />
                    <span>{conn.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Source folder picker */}
          {selectedConnectionId && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                2. Select Source Folder
              </label>
              <div className="border rounded-lg bg-card/40 p-2 max-h-56 overflow-y-auto">
                <SourceFolderPicker
                  connectionId={selectedConnectionId}
                  selectedFolderId={selectedFolder?.folderId}
                  onSelectFolder={setSelectedFolder}
                />
              </div>
              {selectedFolder && (
                <div className="text-xs text-primary font-medium flex items-center gap-1.5 mt-1">
                  <Folder className="h-3.5 w-3.5" />
                  <span>Selected: {selectedFolder.folderName}</span>
                </div>
              )}
            </div>
          )}

          {/* 3. Destination library folder */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              3. Library Destination Folder
            </label>
            <select
              value={destinationFolderId || ""}
              onChange={(e) => setDestinationFolderId(e.target.value || null)}
              className="w-full text-sm rounded-lg border border-border/70 bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Root (No folder)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.is_org_shared ? "(Shared)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Cadence preset selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>4. Check Cadence</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CADENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIntervalMinutes(opt.value)}
                  className={cn(
                    "px-3 py-2 text-xs rounded-lg border text-center transition-all",
                    intervalMinutes === opt.value
                      ? "border-primary bg-primary/10 text-foreground font-semibold ring-1 ring-primary"
                      : "border-border/60 bg-card hover:bg-muted/50 text-muted-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Invariant Copy & Retention Notes */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 text-foreground font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>This folder will be checked every {intervalMinutes} minutes.</span>
            </div>
            <p>
              Files deleted at source are retained in your Library until you purge them.
            </p>
          </div>
        </form>

        <DialogFooter className="pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedFolder || !selectedConnectionId}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Watch...
              </>
            ) : (
              "Start Watching"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
