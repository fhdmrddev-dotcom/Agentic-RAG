/**
 * Phase 284-01 (FIX-11 / D-07 / D-11 / D-12 / D-24) — the Library's documents, as ROWS and
 * NUMBERS rather than as the whole library.
 *
 * `LibraryPage.tsx` used to hold every visible document in memory and derive everything from
 * that one array: the in-flight pill, the open document, the folder counts and sizes, the root
 * count, the browse list, the archived split and the pager slice. That is the reason the
 * Library cannot scale (SC#1-#3), and it was the page's owed G-5 extraction. This hook is the
 * named seam: the page asks it for what to SHOW, and it decides how that is answered.
 *
 * ── THE RULES ─────────────────────────────────────────────────────────────────────────
 * 1. THE PAGE DERIVES NOTHING FROM DOCUMENTS. Every row and every number the page renders
 *    comes from this hook's return. A child that only counts receives a number (D-07), never
 *    the array.
 * 2. `null` MEANS NOT ANSWERED, NEVER 0 (SEED-248 / D-12). `total`, `summary`, `inFlight` and
 *    `archivedHidden` are `null` until their read has answered; a caller renders "…" or
 *    "Not known yet" for `null` and must not coerce it into a count it does not have. (In
 *    wave 1 they are always answered, because the array is already in memory.)
 * 3. A FOLDER OR VIEW SWITCH IS A COLD LOAD; A PAGE CHANGE IS WARM (UI-SPEC §Loading
 *    vocabulary). `listState` / `summaryState` carry that. Wave 1 never loads, so both are
 *    `"ready"`.
 * 4. WAVE 1 IS BUILT ON `useDocuments` AND IS BYTE-IDENTICAL to what the page computed. Every
 *    derivation below was MOVED from `LibraryPage.tsx`, not rewritten. 284-03 swaps the BODY
 *    for `listDocumentsPage` + `getLibrarySummary` + `getDocument`, and the return shape does
 *    not change — so the page does not change again.
 *
 * ⚠ `documentsForIngestion` is the raw array, returned for the ONE consumer that still needs
 * it in wave 1 (the Ingestion tab, plus Find's relationship candidates). It is named for its
 * job so that 284-03 can delete it and the compiler names every remaining reader.
 *
 * The pager STATE (offset, size, the reset on navigation) stays in the page: it is UI state.
 * This hook takes `offset` / `limit` as arguments and answers that page.
 */
import { useMemo } from "react"

import { useDocuments } from "@/hooks/useDocuments"
import { splitArchived } from "@/components/retention/ArchivedHiddenLine"
import type { Document, LibraryCount, LibrarySummary } from "@/types"

export type LibraryLoadState = "loading" | "ready" | "error"

export interface UseLibraryDocumentsArgs {
  /** The selected folder, or `null` for Root. */
  folderId: string | null
  /** The rows a saved view / ad-hoc filter resolved to; `null` = browse the folder. */
  filteredDocs: Document[] | null
  /** The ONE include-archived state (Find's reducer, Phase 275 D-04). */
  includeArchived: boolean
  offset: number
  limit: number
  /** The open document's id (the right-side detail panel). */
  selectedDocId: string | null
  /** Find's answer — an older version lives only here (271-04 UI-SPEC S4). */
  findRows: readonly Document[]
}

export interface UseLibraryDocuments {
  /** The browse rows to render: one page of the folder, or the whole resolved view. */
  rows: Document[]
  /** The rows the browse list could show (the pager's denominator); `null` until answered. */
  total: number | null
  /** Archived rows in this scope (shown or hidden — `ArchivedHiddenLine`'s count). */
  archivedHidden: number | null
  /** Documents still being read — pending, processing or paused. */
  inFlight: number | null
  /** The `GET /library/summary` shape; `null` until answered. */
  summary: LibrarySummary | null
  summaryState: LibraryLoadState
  listState: LibraryLoadState
  loading: boolean
  error: Error | null
  /** The open document, or `null` when it is not visible (or none is open). */
  selectedDoc: Document | null
  /** Re-read the list (and, from 284-03, the summary). */
  refresh: () => Promise<void>
  upload: (file: File, folderId?: string | null) => Promise<{ isDuplicate: boolean }>
  deleteDoc: (id: string, scope?: "version" | "all") => Promise<void>
  uploading: boolean
  uploadingCount: number
  /** ⚠ Wave 1 only — the raw array for the Ingestion tab (284-03 deletes it). */
  documentsForIngestion: Document[]
}

function emptyCount(): LibraryCount {
  return { count: 0, size_bytes: 0, archived: 0 }
}

function addTo(bucket: LibraryCount, d: Document): void {
  bucket.count += 1
  bucket.size_bytes += d.file_size ?? 0
  if (d.archived_at) bucket.archived += 1
}

function isInFlight(d: Document): boolean {
  return d.status === "pending" || d.status === "processing" || d.status === "paused"
}

/** IngestionTab's rate-limit predicate, verbatim (case-insensitive). */
function mentionsRateLimit(message: string | null): boolean {
  const m = message?.toLowerCase()
  return Boolean(m && (m.includes("rate limit") || m.includes("429") || m.includes("quota")))
}

/**
 * The client mirror of `GET /library/summary`, computed over documents already in memory.
 * Field names and semantics are the server's: `total`, `root` and `folders` INCLUDE archived;
 * `status.paused` is always 0 (R-04 — paused is not a stored document status).
 */
export function summarizeDocuments(docs: readonly Document[]): LibrarySummary {
  const root = emptyCount()
  const folders: Record<string, LibraryCount> = {}
  const status = { pending: 0, processing: 0, paused: 0, completed: 0, failed: 0 }
  const steps: Record<string, number> = {}
  const connections = new Map<string, { id: string; name: string | null; count: number }>()
  const types = new Map<string, number>()
  let archived = 0
  let chunks = 0
  let rateLimited = 0

  for (const d of docs) {
    if (d.folder_id == null) addTo(root, d)
    else addTo((folders[d.folder_id] ??= emptyCount()), d)
    if (d.archived_at) archived += 1
    chunks += d.chunk_count ?? 0
    if (d.status === "pending" || d.status === "processing" || d.status === "completed" || d.status === "failed") {
      status[d.status] += 1
    }
    // IngestionTab's fold: a step is counted only while the document is processing.
    if (d.status === "processing" && d.ingestion_step) {
      steps[d.ingestion_step] = (steps[d.ingestion_step] ?? 0) + 1
    }
    if (isInFlight(d) && mentionsRateLimit(d.error_message)) rateLimited += 1
    if (d.source_connection_id) {
      const c = connections.get(d.source_connection_id)
      if (c) c.count += 1
      else
        connections.set(d.source_connection_id, {
          id: d.source_connection_id,
          name: d.source_connection_name ?? null,
          count: 1,
        })
    }
    const t = d.metadata?.document_type
    if (typeof t === "string" && t.trim() !== "") types.set(t, (types.get(t) ?? 0) + 1)
  }

  return {
    total: docs.length,
    archived,
    chunks,
    root,
    folders,
    status,
    steps,
    rate_limited_in_flight: rateLimited,
    connections: [...connections.values()],
    // DocumentTypeEditor's order: sorted by `localeCompare`.
    document_types: [...types.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count })),
    document_types_truncated: false,
  }
}

export function useLibraryDocuments({
  folderId,
  filteredDocs,
  includeArchived,
  offset,
  limit,
  selectedDocId,
  findRows,
}: UseLibraryDocumentsArgs): UseLibraryDocuments {
  const { documents, uploading, uploadingCount, upload, deleteDoc, loadDocuments } = useDocuments()

  const summary = useMemo(() => summarizeDocuments(documents), [documents])

  /** Moved from LibraryPage.tsx by 284-01. Sketch 231-A — what the header pill and the
   *  `In progress` badge both read.
   *
   *  ⛔ IT FETCHES NOTHING. These are documents the page already holds, counted — the same rule
   *  `IngestionTab` carries ("every document it renders is one the page already holds"). A second
   *  poll for a number that is already in memory is how two surfaces come to disagree about it.
   *
   *  ⚠ `paused` is counted as in-flight ON PURPOSE. A rate-limited document has not finished and
   *  has not failed; calling it idle would be the same class of lie as calling a queued file
   *  "added", which is the defect this whole change exists to fix. (R-04's correction — paused is
   *  not a stored status — is a SERVER fact; wave 1 keeps this predicate byte-identical.) */
  const inFlightCount = useMemo(
    () =>
      documents.filter(
        (d) => d.status === "pending" || d.status === "processing" || d.status === "paused",
      ).length,
    [documents],
  )

  // Moved from LibraryPage.tsx by 284-01. Resolve the selected doc from the live documents array
  // so it tracks edits + re-fetches (loadDocuments reconcile). Falls back to closed if it disappears.
  // Phase 271-04 (UI-SPEC S4): a Find row may be an OLDER version, which `documents` (latest
  // rows only) never holds — so the Find answer is the second place a selection resolves from.
  // The live `documents` row still wins for a latest document.
  const selectedDoc = useMemo<Document | null>(
    () =>
      selectedDocId === null
        ? null
        : documents.find((d) => d.id === selectedDocId) ??
          findRows.find((d) => d.id === selectedDocId) ??
          null,
    [selectedDocId, documents, findRows],
  )

  // Moved from LibraryPage.tsx by 284-01. When a filter/view is active the list shows the
  // resolved set (folderId undefined → DocumentList does no further folder filtering); otherwise
  // it scopes to the selected folder's (or Root's) documents BEFORE paging.
  const folderScopedDocuments = useMemo(() => {
    if (filteredDocs !== null) return filteredDocs
    if (folderId === null) {
      return documents.filter((d) => d.folder_id == null)
    }
    return documents.filter((d) => d.folder_id === folderId)
  }, [filteredDocs, folderId, documents])

  // Moved from LibraryPage.tsx by 284-01. Phase 275 (S9 / D-04): browse hides archived rows
  // unless the ONE include-archived state (Find's reducer, shared with its `Include archived`
  // chip) is on. 275-REVIEW F-WR-11: a saved view or an ad-hoc filter honours the SAME state (its
  // resolve has no archived predicate), so it can never disagree with Find over the same conditions.
  const archived = useMemo(
    () => splitArchived(folderScopedDocuments, includeArchived),
    [folderScopedDocuments, includeArchived],
  )

  // Moved from LibraryPage.tsx by 284-01. ⛔ Client-side slice. `GET /documents` is unpaginated
  // until 284-02/284-03 (documents.py:726-760), so the denominator here is real — bounded by
  // PostgREST's 1000-row ceiling, which the pager's honest arm names (WR-04 / T-217.1-11a).
  // Views' server-resolved list is NOT re-sliced here — a saved view's row count is its own
  // resolve, not the pager's business.
  const rows = useMemo(
    () =>
      filteredDocs !== null ? archived.shown : archived.shown.slice(offset, offset + limit),
    [filteredDocs, archived, offset, limit],
  )

  return {
    rows,
    total: archived.shown.length,
    archivedHidden: archived.archivedCount,
    inFlight: inFlightCount,
    summary,
    summaryState: "ready",
    listState: "ready",
    loading: false,
    error: null,
    selectedDoc,
    refresh: loadDocuments,
    upload,
    deleteDoc,
    uploading,
    uploadingCount,
    documentsForIngestion: documents,
  }
}
