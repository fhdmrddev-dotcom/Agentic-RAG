/**
 * Phase 234 (LIB-08 / SURF-01 / VIS-05 / SC#3) — Watched Folders Section.
 *
 * Displays automated folder watches, check cadences, and lifecycle actions:
 * - Cadence statement: "checked every N minutes" (SURF-01 invariant).
 * - Lifecycle actions: Sync now, Pause/Resume, Delete.
 * - Missing files retention: Purge missing files action (VIS-05 / SC#3).
 * - Disconnect freeze banner: "Reconnect {connection_name}" by name (VIS-05 / SC#3).
 */

import React, { useEffect, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Folder,
  HardDrive,
  Loader2,
  MoreVertical,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  deleteWatch,
  listWatches,
  purgeWatchFiles,
  triggerWatchSync,
  updateWatch,
  type ConnectorWatch,
} from "@/lib/api/sources"
import { useFolders } from "@/hooks/useFolders"
import { CreateWatchModal } from "./CreateWatchModal"
import { cn } from "@/lib/utils"

export interface WatchedFoldersSectionProps {
  onNavigateToConnections?: () => void
  destinationFolderId?: string | null
  className?: string
}

export function WatchedFoldersSection({
  onNavigateToConnections,
  destinationFolderId = null,
  className,
}: WatchedFoldersSectionProps) {
  const { folders } = useFolders()
  const [watches, setWatches] = useState<ConnectorWatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  const loadWatches = async () => {
    try {
      setLoading(true)
      const data = await listWatches()
      setWatches(data)
      setError(null)
    } catch (err: any) {
      setError(err?.message || "Failed to load watched folders.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWatches()
  }, [])

  const handleSyncNow = async (watch: ConnectorWatch) => {
    setActionInProgress(watch.id)
    try {
      await triggerWatchSync(watch.id)
      setFeedbackMessage(`Sync scheduled for ${watch.source_folder_name}.`)
      await loadWatches()
    } catch (err: any) {
      setError(err?.message || "Failed to trigger sync.")
    } finally {
      setActionInProgress(null)
    }
  }

  const handleToggleActive = async (watch: ConnectorWatch) => {
    setActionInProgress(watch.id)
    try {
      await updateWatch(watch.id, { is_active: !watch.is_active })
      await loadWatches()
    } catch (err: any) {
      setError(err?.message || "Failed to update watch status.")
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDelete = async (watch: ConnectorWatch) => {
    if (!window.confirm(`Stop watching "${watch.source_folder_name}"? Files in your Library will be retained.`)) {
      return
    }
    setActionInProgress(watch.id)
    try {
      await deleteWatch(watch.id)
      await loadWatches()
    } catch (err: any) {
      setError(err?.message || "Failed to delete watch.")
    } finally {
      setActionInProgress(null)
    }
  }

  const handlePurge = async (watch: ConnectorWatch) => {
    if (
      !window.confirm(
        `Purge missing files for "${watch.source_folder_name}"? Files that no longer exist at the external source will be permanently removed from your Library.`,
      )
    ) {
      return
    }
    setActionInProgress(watch.id)
    try {
      const res = await purgeWatchFiles(watch.id)
      setFeedbackMessage(res.message || `Purged missing files for ${watch.source_folder_name}.`)
      await loadWatches()
    } catch (err: any) {
      setError(err?.message || "Failed to purge missing files.")
    } finally {
      setActionInProgress(null)
    }
  }

  const getLibraryFolderName = (folderId?: string | null) => {
    if (!folderId) return "Root"
    const f = folders.find((item) => item.id === folderId)
    return f ? f.name : "Root"
  }

  return (
    <div className={cn("space-y-4 rounded-xl border border-border/70 bg-card/60 p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
            <HardDrive className="h-4 w-4 text-primary" />
            Watched Folders
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            External cloud folders that periodically sync documents into your Library.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setModalOpen(true)}
          className="gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Add Watched Folder</span>
        </Button>
      </div>

      {feedbackMessage && (
        <div className="p-2.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-xs hover:underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading watched folders...
        </div>
      ) : watches.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border/60 bg-muted/10">
          <Folder className="h-8 w-8 text-muted-foreground mb-2 stroke-[1.5]" />
          <p className="text-sm font-medium text-foreground">No watched folders configured</p>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            Connect a Google Drive folder to automatically ingest files into your Library on a regular schedule.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="mt-4 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Watch a Folder
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {watches.map((watch) => {
            const isDisconnected =
              watch.last_status === "disconnected" ||
              (watch.last_error && watch.last_error.toLowerCase().includes("disconnected")) ||
              (watch.last_error && watch.last_error.toLowerCase().includes("revoked"))

            const connectionLabel = watch.connection_name || "Google Drive"

            return (
              <div
                key={watch.id}
                data-testid={`watch-card-${watch.id}`}
                className={cn(
                  "rounded-lg border p-4 transition-all bg-card/90 space-y-3",
                  isDisconnected
                    ? "border-amber-500/40 bg-amber-500/5 shadow-sm"
                    : watch.is_active
                    ? "border-border/80 hover:border-border"
                    : "border-border/40 opacity-75 bg-muted/20",
                )}
              >
                {/* ── Disconnected Warning Banner (VIS-05 / SC#3) ────────────────── */}
                {isDisconnected && (
                  <div
                    data-testid="watch-disconnected-banner"
                    className="p-2.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        Source connection disconnected: Connection &apos;{connectionLabel}&apos; token revoked or expired. Sync is frozen.
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20 font-medium"
                      onClick={() => {
                        if (onNavigateToConnections) {
                          onNavigateToConnections()
                        } else {
                          window.location.href = "/settings/connections"
                        }
                      }}
                    >
                      Reconnect {connectionLabel}
                    </Button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {watch.source_folder_name}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-medium rounded-full uppercase tracking-wider",
                          isDisconnected
                            ? "bg-amber-500/20 text-amber-600 dark:text-amber-300"
                            : !watch.is_active
                            ? "bg-muted text-muted-foreground"
                            : watch.last_status === "running"
                            ? "bg-blue-500/15 text-blue-500 animate-pulse"
                            : watch.last_status === "failed"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {isDisconnected
                          ? "Disconnected"
                          : !watch.is_active
                          ? "Paused"
                          : watch.last_status === "running"
                          ? "Syncing"
                          : watch.last_status === "failed"
                          ? "Error"
                          : "Active"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        <span>{connectionLabel}</span>
                      </span>
                      <span>&rarr;</span>
                      <span className="flex items-center gap-1">
                        <Folder className="h-3 w-3" />
                        <span>{getLibraryFolderName(watch.library_folder_id)}</span>
                      </span>
                      <span className="text-border">|</span>
                      {/* SURF-01: Exact copy 'checked every N minutes' */}
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>checked every {watch.interval_minutes} minutes</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions toolbar */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncNow(watch)}
                      disabled={actionInProgress === watch.id || !watch.is_active}
                      className="h-8 text-xs gap-1"
                      title="Trigger immediate sync"
                    >
                      <RefreshCw
                        className={cn("h-3.5 w-3.5", actionInProgress === watch.id && "animate-spin")}
                      />
                      <span>Sync now</span>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(watch)}
                      disabled={actionInProgress === watch.id}
                      className="h-8 text-xs px-2"
                      title={watch.is_active ? "Pause watch" : "Resume watch"}
                    >
                      {watch.is_active ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </Button>

                    {/* VIS-05 / SC#3: Purge missing files */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handlePurge(watch)}
                      disabled={actionInProgress === watch.id}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      title="Purge missing or disconnected files from Library"
                    >
                      Purge missing files
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(watch)}
                      disabled={actionInProgress === watch.id}
                      className="h-8 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete watch"
                      aria-label="Delete watch"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {watch.last_error && !isDisconnected && (
                  <div className="text-[11px] text-destructive bg-destructive/5 p-2 rounded border border-destructive/10">
                    Last check error: {watch.last_error}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <CreateWatchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          loadWatches()
          setFeedbackMessage("Watched folder successfully added.")
        }}
        defaultDestinationFolderId={destinationFolderId}
      />
    </div>
  )
}
