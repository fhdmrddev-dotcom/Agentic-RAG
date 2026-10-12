/**
 * Phase 275 plan 04 (planning flag 2 / D-21) — THE ONE batched retention read for the Library.
 *
 * `LibraryPage` calls this with the ids it is showing and the selected folder, and passes the
 * result DOWN: the row chips, the folder line and the detail panel's Retention section make no
 * fetch of their own. One `POST /retention/document-states` per change of (visible id set,
 * folder) — the id set is keyed order-independently, so a re-render with the same rows re-asks
 * nothing.
 *
 * Honest degrade (the `OrgAdminShell` alive-ref rule): a failed read KEEPS the last-known states;
 * it never blanks them, and never invents a calm state for a document it could not read.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  getDocumentStates,
  type RetentionDocumentState,
  type RetentionFolderState,
} from "@/lib/api/retention"

/** The server caps a request at 500 document ids and 50 folder ids. */
const MAX_DOCUMENT_IDS = 500

export interface RetentionStates {
  documents: Record<string, RetentionDocumentState>
  folders: Record<string, RetentionFolderState>
  /** The server's `org:manage` answer for the caller — decides admin vs member copy. */
  canManage: boolean
}

export interface UseRetentionStates extends RetentionStates {
  /** Re-ask after a write this page made (an un-archive, a delete). */
  refresh: () => void
}

const EMPTY: RetentionStates = { documents: {}, folders: {}, canManage: false }

export function useRetentionStates(documentIds: readonly string[], folderId: string | null): UseRetentionStates {
  const [states, setStates] = useState<RetentionStates>(EMPTY)
  const [nonce, setNonce] = useState(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // Order-independent key: the same rows in a new order are the same question.
  const idKey = useMemo(
    () => Array.from(new Set(documentIds)).sort().slice(0, MAX_DOCUMENT_IDS).join(","),
    [documentIds],
  )

  useEffect(() => {
    const ids = idKey === "" ? [] : idKey.split(",")
    const folderIds = folderId ? [folderId] : []
    if (ids.length === 0 && folderIds.length === 0) return
    let current = true
    void (async () => {
      try {
        const res = await getDocumentStates({ document_ids: ids, folder_ids: folderIds })
        if (!current || !alive.current) return
        setStates((prev) => {
          const documents = { ...prev.documents }
          // A requested id the server returned nothing for has no retention state now.
          for (const id of ids) delete documents[id]
          for (const d of res.documents ?? []) documents[d.document_id] = d
          const folders = { ...prev.folders }
          for (const f of folderIds) delete folders[f]
          for (const f of res.folders ?? []) folders[f.folder_id] = f
          return { documents, folders, canManage: Boolean(res.can_manage) }
        })
      } catch {
        /* keep the last-known states — a blip never blanks the chips */
      }
    })()
    return () => {
      current = false
    }
  }, [idKey, folderId, nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])
  return { ...states, refresh }
}
