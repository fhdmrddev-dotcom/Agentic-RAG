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
 * Only ones a source adapter is registered for — and as of Phase 238 the server SAYS SO
 * rather than the client guessing.
 *
 * ⚠ WHAT USED TO BE HERE, AND WHY IT IS GONE. This block previously read: *"The server's
 * SourceRegistry is the authority and there is no endpoint that publishes its list, so this
 * filter is the client's honest approximation of it... When a second family lands (Microsoft
 * Graph, Phase 238), this predicate is the thing to widen, and widening it by guess is how a dead
 * option appears in a dropdown."* The second family landed. **The predicate was not
 * widened** — `GET /connectors/source-families` publishes `SourceRegistry`'s keys and
 * `isSourceCapable` reads them, so Phase 239's MCP file family will appear here with no
 * change to this file. Adding `|| includes("microsoft")` would have shipped SRC-03 and
 * falsified the milestone's *"rows, not code"* constraint in the same commit.
 *
 * The predicate still fails CLOSED while the list is unknown — that half of the old note was
 * right and is preserved in `sourceCapability.ts`.
 */
import { useEffect, useMemo, useState } from "react"
import { Loader2, Plug } from "lucide-react"

import { listConnectorConnections, listSourceFamilies } from "@/lib/api"
import type { ConnectorConnection } from "@/lib/api/org"
import { isSourceCapable } from "./sourceCapability"
import { SourceFolderPicker, type SelectedFolder } from "./SourceFolderPicker"
import { SourcePreviewPanel } from "./SourcePreviewPanel"

export interface ConnectedSourceSectionProps {
  /** The Library folder the person chose in the sibling upload picker. `null` = root. */
  destinationFolderId?: string | null
  destinationFolderName?: string | null
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
    // Both, together: a connection list without the families list cannot be filtered honestly,
    // and `isSourceCapable` fails closed on `null` rather than briefly offering everything.
    Promise.all([listConnectorConnections(), listSourceFamilies()])
      .then(([rows, families]) => {
        if (!cancelled) setConnections(rows.filter((c) => isSourceCapable(c, families)))
      })
      .catch(() => {
        // Renders nothing at all (see below) — an empty picker that explains itself is still
        // a control somebody has to read past.
        if (!cancelled) setConnections([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const options = useMemo(() => connections ?? [], [connections])

  /** BUG-260912-01 — the picker names the connection in a failure sentence. Resolved HERE
   *  rather than inside the picker: the name belongs to the row this section already holds,
   *  and a component that re-fetched it to narrate an error would be a second read of a fact
   *  already in hand. Absent, the sentence degrades to "the connection" rather than a gap. */
  const connectionName = useMemo(
    () => options.find((c) => c.id === connectionId)?.name ?? "",
    [options, connectionId],
  )

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
          {/* ⭐ SKETCH 231-A — ONE CARD, TWO COLUMNS. The connection picker rides in the card
              header; the folder tree is the LEFT column of the same card as the bar it feeds.
              ⚠ The shipped shape stacked three full-width blocks (select → tree → panel), which
              is what put the tree in a cramped box with the bar below the fold. */}
          {/* ⚠ NO focus class here ON PURPOSE. The inset focus ring for form controls is a
              GLOBAL rule in `index.css` (`:where(input, select, textarea):focus-visible`), so
              this raw `<select>`, the destination select in `CreateWatchModal`, the two in
              `WorkflowScheduleModal` and any select added later all align without each one
              remembering to opt in. A per-control class here would be a SECOND mechanism
              doing the same job — which is how the two drift apart. */}
          {!connectionId && (
            <select
              data-testid="source-connection-select"
              value=""
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
          )}

          {connectionId && (
            <SourcePreviewPanel
              connectionId={connectionId}
              folderId={folder?.folderId ?? null}
              folderName={folder?.folderName}
              destinationFolderId={destinationFolderId}
              destinationFolderName={destinationFolderName}
              onClose={() => setFolder(null)}
              headerSlot={
                <select
                  data-testid="source-connection-select"
                  value={connectionId}
                  onChange={(e) => {
                    setConnectionId(e.target.value || null)
                    setFolder(null)
                  }}
                  className="ml-auto h-8 max-w-[16rem] rounded-md border border-border/60 bg-background px-2 text-xs"
                >
                  {options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              }
              leftSlot={
                <SourceFolderPicker
                  connectionId={connectionId}
                  connectionName={connectionName}
                  selectedFolderId={folder?.folderId ?? null}
                  onSelectFolder={setFolder}
                />
              }
            />
          )}
        </>
      )}
    </div>
  )
}
