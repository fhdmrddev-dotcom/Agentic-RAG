/**
 * Phase 244 plan 06 Task 2 (SHELL-04 / D-244-06 / D-244-07 / BUG-260905-01) —
 * THE LIBRARY'S SINGLE-FILE CLOUD DOOR.
 *
 * ── THE OPERATOR'S SENTENCE ───────────────────────────────────────────────────────────
 * *"The door is not where intended — the import should be from the Library, not from the chat."*
 * Before this, the single-file cloud import existed ONLY in the chat composer and wrote straight
 * into the Library **root**. `244-06` un-inverts both halves: the composer's cloud pick now lands
 * in the thread, and this is the Library's own door.
 *
 * ⭐ **IT IS THE THIN COMPLEMENT, NOT A REPLACEMENT (D-244-07).** The Library already owns a
 * folder-choosing cloud door — Phase 233's `preview_source_folder` → commit path, which brings in
 * a whole tree with a diff pass first. This is the one-named-file case beside it.
 *
 * ── THREE THINGS IT DELIBERATELY DOES NOT DO ──────────────────────────────────────────
 *
 * 1. ⛔ **It does not invent a folder picker.** The destination is the page's OWN selection
 *    (`selectedFolderId` / `selectedFolderName`), which is already on screen and already governs
 *    the upload button beside it. A second way to choose a folder is a second answer to *"where
 *    did my file go"*.
 * 2. ⛔ **It does not introduce a second permission rule.** `canUploadToFolder` arrives as a prop
 *    from the page's shipped predicate. A local expression would drift from the upload button's
 *    on the first edit, and both doors write to the same place.
 * 3. ⛔ **It does not fork the file-picker vocabulary.** It mounts the SAME
 *    `ConnectedFilePickerModal` the composer mounts, with the Library's confirm word.
 *
 * ⚠ **AND IT NEVER REFUSES SILENTLY.** D-244-06's ruling is that silently rooting is the defect;
 * a control that greys out with no words replaces one thing the person cannot act on with
 * another. Every unavailable state renders its REASON, and
 * `LibraryPage.cloudImport.test.tsx` case 2 asserts the rendered text rather than `disabled`.
 */
import { useCallback, useEffect, useState } from "react"
import { Cloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConnectedFilePickerModal } from "@/components/chat/ConnectedFilePickerModal"
import { importCloudFile, listConnectorConnections, type ConnectorConnection } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * The door's words, exported so the suite asserts the RENDERED SENTENCE rather than a
 * `data-testid`. ⚠ A presence assertion cannot see content drift — this project shipped ~200
 * green assertions over a surface the operator called *"nothing at all like what we designed"*.
 */
export const LIBRARY_CLOUD_COPY = {
  /** ⛔ NOT `Attach`. That is the composer's word for a file that lives in one chat for 24h;
   *  this door writes a permanent Library document, and D-244-23's rule is that the confirm is
   *  the last moment before the file exists. */
  trigger: "Import from cloud",
  confirm: "Import here",
  title: "Choose a file to import",
  needsDestination: "Choose a folder first — an import needs somewhere to land.",
  notYourFolder: "This folder belongs to someone else, so nothing can be added to it.",
  noConnection: "No cloud storage is connected yet.",
  destinationPrefix: "Imports into",
} as const

interface Props {
  /** The page's OWN selection. `null` means root — which is NOT a destination here. */
  folderId: string | null
  folderName: string | null
  /** ⛔ The page's SHIPPED `canUploadToFolder`. Never re-derived locally. */
  canUpload: boolean
  /** Reconcile the document list after a successful import. */
  onImported?: () => void
}

export function LibraryCloudImport({ folderId, folderName, canUpload, onImported }: Props) {
  const [connections, setConnections] = useState<ConnectorConnection[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listConnectorConnections()
      .then((rows) => {
        if (!cancelled) setConnections(rows)
      })
      .catch(() => {
        /* A connections read that fails leaves the door saying "nothing connected", which is the
           honest reading of "we could not see any" — never a door that opens onto an empty list. */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hasCloudStorage = connections.some(
    (c) =>
      c.is_enabled !== false &&
      (c.service_id.includes("google") ||
        c.service_id.includes("workspace") ||
        c.service_id.includes("drive") ||
        c.service_id.includes("onedrive") ||
        c.service_id.includes("dropbox") ||
        c.service_id.includes("box") ||
        c.service_id.includes("mock")),
  )

  // ⛔ THE ORDER IS THE PRIORITY ORDER, and it is stated rather than implied: a person with no
  // connection cannot be helped by being told to pick a folder.
  const reason: string | null = !hasCloudStorage
    ? LIBRARY_CLOUD_COPY.noConnection
    : !folderId
      ? LIBRARY_CLOUD_COPY.needsDestination
      : !canUpload
        ? LIBRARY_CLOUD_COPY.notYourFolder
        : null

  const handleConfirm = useCallback(
    async ({ connectionId, file }: { connectionId: string; file: { id: string; name: string } }) => {
      if (!folderId) return
      try {
        // ⭐ `folder_id` is REQUIRED by the wire type AND by the server model, so a destination
        // cannot be dropped on the way out. The server answers 422 before its handler runs.
        await importCloudFile(connectionId, file.id, { folder_id: folderId })
        setRefusal(null)
        onImported?.()
      } catch (e) {
        // ⛔ THE SERVER'S OWN SENTENCE (S-4). `ConnectorApiError.message` carries `detail`
        // verbatim; a friendlier client string cannot be acted on.
        setRefusal(e instanceof Error ? e.message : "The import could not be completed.")
        throw e
      }
    },
    [folderId, onImported],
  )

  return (
    <div data-testid="library-cloud-import" className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          data-testid="library-cloud-import-btn"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={reason !== null}
          onClick={() => setPickerOpen(true)}
        >
          <Cloud className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {LIBRARY_CLOUD_COPY.trigger}
        </Button>
        {reason === null && folderName && (
          <span data-testid="library-cloud-import-destination" className="text-[11px] text-muted-foreground">
            {LIBRARY_CLOUD_COPY.destinationPrefix} {folderName}
          </span>
        )}
      </div>

      {/* ⛔ THE REASON IS RENDERED, ALWAYS. A silently disabled control is the same failure as a
          silent root write — the person is left without the one fact they could act on. */}
      {reason !== null && (
        <span
          data-testid="library-cloud-import-reason"
          className="text-[11px] text-muted-foreground"
        >
          {reason}
        </span>
      )}

      {refusal && (
        <div
          role="alert"
          data-testid="library-cloud-import-refusal"
          className={cn(
            "flex items-start gap-2 px-3 py-2 rounded-lg",
            "border border-destructive/40 bg-destructive/10 text-xs",
          )}
        >
          <span className="flex-1 font-mono text-[11px] text-destructive">{refusal}</span>
          <button
            type="button"
            data-testid="library-cloud-import-dismiss"
            onClick={() => setRefusal(null)}
            className="shrink-0 rounded-md border border-border px-2 py-0.5 font-medium text-foreground/80 hover:bg-accent"
          >
            OK
          </button>
        </div>
      )}

      {pickerOpen && (
        <ConnectedFilePickerModal
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          connections={connections}
          title={LIBRARY_CLOUD_COPY.title}
          confirmLabel={LIBRARY_CLOUD_COPY.confirm}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  )
}
