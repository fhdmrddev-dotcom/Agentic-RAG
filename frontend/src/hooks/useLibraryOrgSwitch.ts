/**
 * Phase 298-04 (D-26 / G-5) — LibraryPage's org-scoped mount reads, moved out of the page.
 *
 * The LibraryPage ledger section names the seam this takes: page-UI state that still lived in
 * the page. This file holds the two reads that used to be `[]` effects in the page:
 *   1. the metadata field defs + the saved views (Phase 114), and
 *   2. the Expert-install provenance read (Phase 266, D-266-13).
 *
 * ⛔ MOVED VERBATIM, comments included (the move-only commit). The page gains one call to this
 * hook in place of the state and the two effects.
 *
 * Phase 298-04 (D-08 / UI-D10) — then the org arm: both reads re-ask when the active org changes
 * (SEED-317's trigger fires here), and a switch after mount returns the selection to Root and
 * closes the document panel, because an old-org folder id would read a specific-folder list that
 * is not narrowed. ⛔ No keyed remount (297 rule): the page stays mounted and re-asks.
 */
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react"
import { useActiveOrgId } from "@/hooks/useActiveOrgId"
import { listMetadataFields, listViews } from "@/lib/api"
import { listExpertInstalls } from "@/lib/api/experts"
import { provenanceByFolder } from "@/components/experts/catalog/expertCatalog"
import type { MetadataFieldDef, SavedView } from "@/types"

export interface LibraryOrgSwitchArgs {
  /** The page's selection reducer dispatch (only `SELECT_FOLDER` to Root is ever sent). */
  dispatch: Dispatch<{ type: "SELECT_FOLDER"; folderId: null }>
  /** The page's open-document setter (the right-side detail panel). */
  setSelectedDocId: Dispatch<SetStateAction<string | null>>
}

export interface LibraryOrgSwitch {
  customFields: MetadataFieldDef[]
  views: SavedView[]
  setViews: Dispatch<SetStateAction<SavedView[]>>
  refreshViews: () => void
  folderProvenance: Record<string, string>
}

export function useLibraryOrgSwitch({ dispatch, setSelectedDocId }: LibraryOrgSwitchArgs): LibraryOrgSwitch {
  const activeOrgId = useActiveOrgId()

  // UI-D10 — a switch AFTER mount: back to Root, panel closed (every reset visible, none silent).
  // The first render records the org and does nothing, so first paint is unchanged.
  // ⚠ DURING RENDER, not in an effect (React's "adjust state while rendering" pattern, the same
  // one the page uses for its pager clamp). In an effect, `useLibraryDocuments`' own effect — which
  // runs first — would already have asked for the OLD org's folder under the new org's header,
  // and a specific-folder read is not narrowed. Here the render restarts with Root selected, so no
  // effect ever sees the old folder id with the new org.
  const [seenOrg, setSeenOrg] = useState(activeOrgId)
  if (seenOrg !== activeOrgId) {
    setSeenOrg(activeOrgId)
    dispatch({ type: "SELECT_FOLDER", folderId: null })
    setSelectedDocId(null)
  }

  // ── Phase 114: the filter bar + Views group state ───────────────────────────
  const [customFields, setCustomFields] = useState<MetadataFieldDef[]>([])
  const [views, setViews] = useState<SavedView[]>([])

  // Load the field defs (for the operator menu) + the saved views once — and again for each org
  // the person switches to (298-04, D-08).
  // D-09: an answer asked under the previous org is dropped (`live`), so it cannot repaint.
  useEffect(() => {
    let live = true
    listMetadataFields()
      .then((rows) => live && setCustomFields(rows))
      .catch(() => live && setCustomFields([]))
    listViews()
      .then((rows) => live && setViews(rows))
      .catch(() => live && setViews([]))
    return () => {
      live = false
    }
  }, [activeOrgId])

  const refreshViews = useCallback(() => {
    listViews().then(setViews).catch(() => {})
  }, [])

  // Phase 266 (D-266-13): an installed Expert's folder names where it came from —
  // "Shared with org · from Financial Analyzer" — through NavRow's existing shared label.
  // ⚠ A standard-tier org is REFUSED this read (403, the capability gate on the whole
  // `/experts` router); `listExpertInstalls` turns that into `[]`, and any other failure is a
  // missing note, not an error — the tree renders exactly as before either way.
  const [folderProvenance, setFolderProvenance] = useState<Record<string, string>>({})
  useEffect(() => {
    let mounted = true
    listExpertInstalls()
      .then((rows) => {
        if (mounted) setFolderProvenance(provenanceByFolder(rows))
      })
      .catch(() => {
        if (mounted) setFolderProvenance({})
      })
    return () => {
      mounted = false
    }
  }, [activeOrgId])

  return { customFields, views, setViews, refreshViews, folderProvenance }
}
