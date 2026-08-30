/**
 * Phase 216 (CHAT-05 / CHAT-06 / CAT-04) — Connectors Flyout for Prompt Bar Plus Menu.
 *
 * Modeled after Claude.ai's dynamic connectors flyout:
 * Provides interactive per-connector toggle switches, quick links to add/manage connectors,
 * and seamless integration with the chat composer.
 */

import { useState, useEffect } from "react"
import { ExternalLink, Loader2, Plug, Plus, Settings2 } from "lucide-react"
import { ConnectionMarkGlyph } from "@/lib/connectionMark"
import { listConnectorConnections, type ConnectorConnection } from "@/lib/api"
import { cn } from "@/lib/utils"

interface ConnectorsFlyoutProps {
  activeConnectorIds: string[]
  onToggleConnector: (id: string) => void
  onClose?: () => void
}

export function ConnectorsFlyout({
  activeConnectorIds,
  onToggleConnector,
  onClose,
}: ConnectorsFlyoutProps) {
  const [connections, setConnections] = useState<ConnectorConnection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const conns = await listConnectorConnections()
        if (!cancelled) {
          // Only show enabled connections
          setConnections(conns.filter((c) => c.is_enabled !== false))
        }
      } catch (err) {
        console.error("Failed to load connections in chat flyout", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleOpenSettings = () => {
    onClose?.()
    window.location.hash = "#settings"
  }

  return (
    <div className="w-[320px] p-2 flex flex-col gap-2 text-foreground select-none">
      <div className="flex items-center justify-between px-2 pt-1 pb-1.5 border-b border-border/50">
        <div className="flex items-center gap-1.5">
          <Plug className="h-4 w-4 text-primary" />
          <span className="font-semibold text-xs tracking-tight">Connectors</span>
        </div>
        <button
          type="button"
          onClick={handleOpenSettings}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <Settings2 className="h-3 w-3" />
          <span>Manage</span>
        </button>
      </div>

      <div className="max-h-[260px] overflow-y-auto flex flex-col gap-1 px-0.5 py-1">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Loading connectors...</span>
          </div>
        ) : connections.length === 0 ? (
          <div className="py-6 px-3 text-center flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              No active connectors found. Connect tools like Google Drive, Slack, or Jira.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose?.()
                navigate("/settings?tab=connections")
              }}
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add your first connector
            </button>
          </div>
        ) : (
          connections.map((conn) => {
            const isActive = activeConnectorIds.includes(conn.id)
            return (
              <div
                key={conn.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg text-xs transition-colors",
                  "hover:bg-muted/60",
                  isActive ? "bg-primary/5" : "bg-transparent",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                  <div className="flex-none">
                    <ConnectionMarkGlyph shape={conn} size="chip" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-xs truncate text-foreground">
                      {conn.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate capitalize">
                      {conn.service_id.replace("_", " ")}
                      {conn.account_email ? ` · ${conn.account_email}` : ""}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  aria-label={`Toggle ${conn.name}`}
                  data-testid={`connector-toggle-${conn.id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleConnector(conn.id)
                  }}
                  className={cn(
                    "relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive ? "bg-primary" : "bg-muted-foreground/30",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                      isActive ? "translate-x-[18px]" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>
            )
          })
        )}
      </div>

      <div className="pt-1.5 border-t border-border/50 flex items-center justify-between px-2">
        <button
          type="button"
          onClick={handleOpenSettings}
          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          <span>Add connector</span>
        </button>
        <span className="text-[10px] text-muted-foreground">
          {activeConnectorIds.length} enabled
        </span>
      </div>
    </div>
  )
}
