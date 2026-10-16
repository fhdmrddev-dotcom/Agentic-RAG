/**
 * The documents Realtime channel, upload and delete — and NO list.
 *
 * ⭐ Phase 284-03 (FIX-11 / D-08 / D-24): this hook used to fetch the whole library and patch it
 * from Realtime events. The Library now pages on the server (`useLibraryDocuments`), so there is
 * no whole list to patch: the caller owns the ON-PAGE rows and hands this hook their setter.
 *
 *   · UPDATE to a row on the page → spread-merged in place (the block below, kept verbatim);
 *     a row that is not on the page is never inserted (T-284-17).
 *   · UPDATE that changes a MEMBERSHIP field (`folder_id`, `archived_at`, `is_latest`, `status` —
 *     284-REVIEW WR-01) or reaches a terminal status, INSERT, DELETE → `onChange()`. The caller debounces it into
 *     ONE refetch of the page and the summary. Realtime is a HINT, never a source of truth
 *     (D-v2.5-03): a missed event is reconciled by the next fetch, not by this callback.
 *   · upload → the created document is returned, so the caller can show it on page 1 until
 *     the refetch reconciles it; `onChange()` asks for that refetch.
 *   · delete → the row leaves the page at once, and `onChange()` asks for the refetch.
 */
import { useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from "react"
import { supabase } from "@/lib/supabase"
import { uploadDocument, deleteDocument } from "@/lib/api"
import type { Document } from "@/types"

/**
 * 284-REVIEW WR-01 — the columns that decide WHICH LIST a row is on (a folder's page, archived
 * hidden or shown, latest versions only, IngestionTab's status lists) and which bucket of
 * `/library/summary` counts it. An UPDATE that changes one of them is not cosmetic: merged in
 * place it left a moved / archived row on its OLD folder's page wearing its new values, with
 * stale counts. Such an UPDATE asks for the refetch instead.
 */
export const MEMBERSHIP_FIELDS = ["folder_id", "archived_at", "is_latest", "status"] as const

/** Did `next` (a Realtime `payload.new`) change any membership field of `cur`? A key absent from
 *  the payload is "not sent", never "changed"; `null` and `undefined` are the same absence. */
export function changesMembership(cur: Document, next: Partial<Document>): boolean {
  return MEMBERSHIP_FIELDS.some(
    (k) => k in next && (next[k] ?? null) !== (cur[k] ?? null),
  )
}

export interface UseDocumentsArgs {
  /** The caller's ON-PAGE rows, read to tell a cosmetic UPDATE from a membership one (WR-01). */
  rows: readonly Document[]
  /** The caller's ON-PAGE rows. Realtime merges an UPDATE only into a row already here. */
  setRows: Dispatch<SetStateAction<Document[]>>
  /** Something changed that a merge cannot express: refetch (the caller debounces). */
  onChange: () => void
}

interface UseDocuments {
  uploading: boolean
  uploadingCount: number
  upload: (file: File, folderId?: string | null) => Promise<{ isDuplicate: boolean; doc?: Document }>
  deleteDoc: (id: string, scope?: "version" | "all") => Promise<void>
}

export function useDocuments({ rows, setRows, onChange }: UseDocumentsArgs): UseDocuments {
  const [uploadingCount, setUploadingCount] = useState(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // The latest callbacks and rows, read by the ONE channel subscription (not re-made per render).
  const onChangeRef = useRef(onChange)
  const setRowsRef = useRef(setRows)
  const rowsRef = useRef(rows)
  useEffect(() => {
    onChangeRef.current = onChange
    setRowsRef.current = setRows
    rowsRef.current = rows
  }, [onChange, setRows, rows])

  useEffect(() => {
    let cancelled = false
    const setDocuments: Dispatch<SetStateAction<Document[]>> = (update) => setRowsRef.current(update)

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (!data.session?.user.id) return

      // No user_id filter here — RLS policies ensure users only receive their
      // own rows. Adding a column filter on UPDATE events requires
      // REPLICA IDENTITY FULL on the table; omitting it avoids that requirement.
      const channel = supabase
        .channel("documents-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "documents",
          },
          (payload) => {
            if (payload.eventType === "UPDATE") {
              const newDoc = payload.new as Document
              // Realtime payload reflects ONLY the documents table — but
              // table_count + image_count + chunk_count are server-side
              // aggregates from joined tables (see backend/app/api/documents.py
              // D-09). They are NOT in payload.new. Spread-merge so the prior
              // fetch's aggregates aren't blown away mid-transition; then on
              // terminal-state transitions refetch the list to surface fresh
              // counts (BUG-260516-01 follow-up: user reported "counts don't
              // reflect real-time" after status badge started updating).
              //
              // ── Phase 217: WHICH SIDE OF THAT LINE THE FOUR NEW FIELDS FALL ON ──
              // The ingestion strip (components/ingestion/IngestionStrip.tsx) reads
              // all four, so the rule is stated here rather than inferred there:
              //
              //   REAL COLUMNS — ride payload.new, arrive on every UPDATE:
              //     `ingestion_step`  (the stage the pipeline last entered)
              //     `extractor`       (D-217-08 lineage)
              //     `chunk_count`     (a real column too, despite the note above)
              //
              //   SERVER-DERIVED — NOT in payload.new, behave exactly like table_count:
              //     `tables_stage_applies`  \ pydantic @computed_field off mime_type
              //     `images_stage_applies`  / (D-217-24) — no such DB column exists
              //
              // The spread-merge below is what preserves the derived pair across an
              // UPDATE: `{ ...d, ...newDoc }` keeps the previously-fetched value
              // because the incoming row has no key for it. ⚠ THE INSERT ARM BELOW
              // HAS NO MERGE — a document inserted in another tab arrives with both
              // flags `undefined`, which is why they are OPTIONAL on the Document type
              // and why the strip must render `undefined` applicability as PENDING
              // (unknown), never as skipped.
              //
              // ⚠ Realtime stays a HINT, not a source of truth (D-v2.5-03): a socket
              // that missed a transition leaves a stale stage here, and only the cold
              // fetch reconciles it. That is why plan 01 put `ingestion_step` on the
              // DocumentResponse wire (D-217-10) — the list load, not this callback,
              // is what makes a mid-ingest file honest when the Library first opens.
              // 284-REVIEW WR-01: decided OUTSIDE the state updater (an updater may run twice under
              // StrictMode, and lazily), against the rows the caller last rendered.
              const cur = rowsRef.current.find((d) => d.id === newDoc.id)
              const membership = cur !== undefined && changesMembership(cur, newDoc)
              setDocuments((prev) =>
                prev.map((d) => (d.id === newDoc.id ? { ...d, ...newDoc } : d)),
              )
              // A membership change, or a terminal status (fresh server-side counts): ONE hint.
              // The caller coalesces hints into one refetch of the page and the summary (D-08).
              if (membership || newDoc.status === "completed" || newDoc.status === "failed") {
                onChangeRef.current()
              }
            } else if (payload.eventType === "INSERT" || payload.eventType === "DELETE") {
              // 284-03 (D-08): an INSERT or DELETE never patches the page — which page a new
              // row lands on, and what slides up when one leaves, is the server's to say.
              onChangeRef.current()
            }
          },
        )
        .subscribe()

      channelRef.current = channel
    })

    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  const upload = useCallback(
    async (file: File, folderId?: string | null): Promise<{ isDuplicate: boolean; doc?: Document }> => {
      setUploadingCount((c) => c + 1)
      try {
        const { doc, isDuplicate } = await uploadDocument(file, folderId)
        // The caller shows `doc` on page 1 until the refetch reconciles it (D-08); Realtime
        // UPDATE events still fire to advance its status (pending → processing → completed).
        onChangeRef.current()
        return { isDuplicate, doc }
      } finally {
        setUploadingCount((c) => c - 1)
      }
    },
    [],
  )

  const deleteDoc = useCallback(async (id: string, scope?: "version" | "all") => {
    await deleteDocument(id, scope)
    setRowsRef.current((prev) => {
      if (scope === "all") {
        // Optimistically remove every row with the same filename in the same folder
        const target = prev.find((d) => d.id === id)
        if (target) {
          return prev.filter((d) => !(d.filename === target.filename && d.folder_id === target.folder_id))
        }
      }
      return prev.filter((d) => d.id !== id)
    })
    onChangeRef.current()
  }, [])

  return { uploading: uploadingCount > 0, uploadingCount, upload, deleteDoc }
}
