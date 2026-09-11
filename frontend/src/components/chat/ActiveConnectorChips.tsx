/**
 * Phase 216 (CHAT-06 / D-216-06) — Active Connector Chips.
 *
 * Renders a dismissible chip for every connector currently armed in the session, keeping tool
 * availability clear and visible directly above the composer.
 *
 * ⭐ PHASE 244 (244-05 T2 / D-244-26) — THE ROW CONTAINER WAS HOISTED OUT OF THIS COMPONENT, and
 * the reason is measured rather than stylistic.
 *
 * D-244-26 says the chat-attachment chip is *"a **sibling** of the connector chip, not a new
 * region"*. Three arms were available and two of them are wrong:
 *
 *   ⛔ a `children` / `extra` SLOT here — this component returned `null` when nothing was armed,
 *      so the attachment chip would **vanish for a person with no connector**, which is exactly
 *      the one-item case D-244-26 orders checked;
 *   ⛔ a SECOND `<div>` beneath this one — that is the "new region" the decision forbids, and it
 *      is the easy accident;
 *   ✅ HOIST. `MessageInput` owns the row container, its `data-testid` and its `Using:` label;
 *      this component renders its chips as a FRAGMENT and `null` when empty. The row appears when
 *      EITHER an attachment or a connector exists, and nothing at all when neither does.
 *
 * ⚠ THE EMPTY ARM IS STILL LOAD-BEARING and must stay `null`, not an empty fragment: the `Using:`
 * label lives in the hoisted container now, and a caller that renders this alongside no chips must
 * be able to tell that nothing came back. `MessageInput` decides whether the ROW exists; this
 * component decides only whether CHIPS do.
 *
 * ⚠ `data-testid="active-connector-chips"` MOVED to the hoisted container (`MessageInput.tsx`) so
 * no existing suite silently loses its hook. The per-chip `active-connector-chip-{id}` hooks —
 * the ones `MessageInput.connectors.test.tsx` actually uses, at nine call sites — are unmoved.
 *
 * ⛔ This component has exactly ONE mount (`MessageInput.tsx`), which is what makes the hoist
 * contained rather than a cross-surface change.
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
    <>
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
    </>
  )
}
