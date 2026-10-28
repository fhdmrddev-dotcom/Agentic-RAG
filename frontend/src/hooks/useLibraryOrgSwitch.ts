/**
 * Phase 298-04 (D-26 / G-5) — LibraryPage's org-scoped mount reads, moved out of the page.
 *
 * The LibraryPage ledger section names the seam this takes: page-UI state that still lived in
 * the page. This file holds the two reads that used to be `[]` effects in the page:
 *   1. the metadata field defs + the saved views (Phase 114), and
 *   2. the Expert-install provenance read (Phase 266, D-266-13).
 *
 * ⛔ MOVED VERBATIM, comments included. The page gains one call to this hook in place of the
 * state and the two effects; what each read does and when it fires is unchanged by the move.
 */
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react"
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

export function useLibraryOrgSwitch(_switchArgs: LibraryOrgSwitchArgs): LibraryOrgSwitch {
  // ── Phase 114: the filter bar + Views group state ───────────────────────────
  const [customFields, setCustomFields] = useState<MetadataFieldDef[]>([])
  const [views, setViews] = useState<SavedView[]>([])

  // Load the field defs (for the operator menu) + the saved views once.
  useEffect(() => {
    listMetadataFields().then(setCustomFields).catch(() => setCustomFields([]))
    listViews().then(setViews).catch(() => setViews([]))
  }, [])

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
  }, [])

  return { customFields, views, setViews, refreshViews, folderProvenance }
}
