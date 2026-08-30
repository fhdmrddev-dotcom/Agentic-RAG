/**
 * Phase 216 (CHAT-06 / D-216-06) — Active Connector Chips Bar.
 *
 * Displays dismissible chips directly above the composer for every connector
 * currently active in the session, keeping tool availability clear and visible.
 */

import { X } from "lucide-react"
import { ConnectionMarkGlyph } from "@/lib/connectionMark"
import type { ConnectorConnection } from "@/lib/api"
import { cn } from "@/lib/utils"

interface ActiveConnectorChipsProps {
  connections: ConnectorConnection[]
  activeConnectorIds: string[]
  onRemoveConnector: (id: string) => void
}

export function ActiveConnectorChips({
  connections,
  activeConnectorIds,
  onRemoveConnector,
}: ActiveConnectorChipsProps) {
  if (activeConnectorIds.length === 0) return null

  const activeConns = connections.filter((c) => activeConnectorIds.includes(c.id))
  if (activeConns.length === 0) return null

  return (
    <div
      data-testid="active-connector-chips"
      className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 mb-1 bg-muted/40 rounded-lg border border-border/40"
    >
      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mr-1">
        Using:
      </span>
      {activeConns.map((conn) => (
        <span
          key={conn.id}
          data-testid={`active-connector-chip-${conn.id}`}
          className={cn(
            "inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded-full text-xs font-medium",
            "bg-background border border-border/80 shadow-xs text-foreground",
            "hover:border-border transition-colors animate-in fade-in zoom-in-95 duration-150",
          )}
        >
          <ConnectionMarkGlyph shape={conn} size="chip" />
          <span className="truncate max-w-[140px]">{conn.name}</span>
          <button
            type="button"
            aria-label={`Remove ${conn.name}`}
            onClick={() => onRemoveConnector(conn.id)}
            className="rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}
