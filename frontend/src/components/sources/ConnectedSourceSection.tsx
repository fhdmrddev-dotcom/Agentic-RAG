/**
 * Phase 233 (D-233-06 / LIB-09) — the connected-source door, and `SourceFolderPicker`'s first home.
 *
 * ⚠ **`SourceFolderPicker` SHIPPED AT 232-04 AND WAS MOUNTED NOWHERE.** Measured 2026-09-05:
 * `grep -rl SourceFolderPicker frontend/src` returned the component and its own test, and nothing
 * else. A component with no mount is a component nobody can find a defect in, so giving it a home
 * is part of this phase rather than a tidy-up.
 *
 * ── WHY HERE, AND NOT A SIXTH TAB ────────────────────────────────────────────────────────
 *
 * The Library's **Ingestion tab** is where getting-things-in already lives (`IngestionTab` hosts
 * the dropzone and the upload folder picker), and it is where Phase 234's watch loop lands. So
 * this is a BLOCK inside `Add files`, beside the dropzone — one child element at one mount site.
 * `IngestionTab` gains an import and a mount, and no branch.
 *
 * ⛔ Not a sixth Library tab. The preview inherits `LibraryPage`'s measure rather than declaring
 * one of its own.
 *
 * ── WHICH CONNECTIONS APPEAR ─────────────────────────────────────────────────────────────
 *
 * Only ones a source adapter is registered for. The server's `SourceRegistry` is the authority
 * and there is no endpoint that publishes its list, so this filter is the client's honest
 * approximation of it — and it is deliberately NARROW: a connection that is offered and then
 * cannot browse is worse than one that is not offered. ⚠ When a second family lands (Microsoft
 * Graph, Phase 238), this predicate is the thing to widen, and widening it by guess is how a dead
 * option appears in a dropdown.
 */
import { useEffect, useMemo, useState } from "react"
import { Loader2, Plug } from "lucide-react"

import { listConnectorConnections } from "@/lib/api"
import type { ConnectorConnection } from "@/lib/api/org"
import { SourceFolderPicker, type SelectedFolder } from "./SourceFolderPicker"
import { SourcePreviewPanel } from "./SourcePreviewPanel"

export interface ConnectedSourceSectionProps {
  /** The Library folder the person chose in the sibling upload picker. `null` = root. */
  destinationFolderId?: string | null
  destinationFolderName?: string | null
}

/** ⚠ Narrow on purpose — see the module docblock. Widened when an adapter is registered. */
function isSourceCapable(c: ConnectorConnection): boolean {
  const id = (c.service_id || "").toLowerCase()
  if (c.status === "revoked" || c.status === "error") return false
  return id.includes("google") || id.includes("workspace") || id.includes("drive")
}

export function ConnectedSourceSection({
  destinationFolderId = null,
  destinationFolderName = null,
}: ConnectedSourceSectionProps) {
  const [connections, setConnections] = useState<ConnectorConnection[] | null>(null)
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [folder, setFolder] = useState<SelectedFolder | null>(null)

  useEffect(() => {
    let cancelled = false
    listConnectorConnections()
      .then((rows) => {
        if (!cancelled) setConnections(rows.filter(isSourceCapable))
      })
      .catch(() => {
        if (!cancelled) setConnections([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const options = useMemo(() => connections ?? [], [connections])

  // Nothing to offer → render nothing at all. An empty picker that explains itself is still a
  // control somebody has to read past.
  if (connections !== null && options.length === 0) return null

  return (
    <div data-testid="connected-source-section" className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Plug className="h-4 w-4 text-muted-foreground" />
        From a connected source
      </div>

      {connections === null ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Looking for connected sources…
        </div>
      ) : (
        <>
          <select
            data-testid="source-connection-select"
            value={connectionId ?? ""}
            onChange={(e) => {
              setConnectionId(e.target.value || null)
              setFolder(null)
            }}
            className="h-9 w-full max-w-sm rounded-md border border-border/60 bg-background px-2 text-sm"
          >
            <option value="">Choose a connection…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {connectionId && (
            <SourceFolderPicker
              connectionId={connectionId}
              selectedFolderId={folder?.folderId ?? null}
              onSelectFolder={setFolder}
              className="max-h-72 overflow-y-auto"
            />
          )}

          {connectionId && folder && (
            <SourcePreviewPanel
              connectionId={connectionId}
              folderId={folder.folderId}
              folderName={folder.folderName}
              destinationFolderId={destinationFolderId}
              destinationFolderName={destinationFolderName}
              onClose={() => setFolder(null)}
            />
          )}
        </>
      )}
    </div>
  )
}
