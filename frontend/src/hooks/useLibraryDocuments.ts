/**
 * Phase 284 (FIX-11 / D-07 / D-08 / D-11 / D-12 / D-24) — the Library's documents, as ROWS and
 * NUMBERS asked of the server, never as the whole library.
 *
 * 284-01 extracted this seam from `LibraryPage.tsx` over the in-memory array; 284-03 replaced the
 * BODY. The page asks for what to SHOW; this hook answers it with three reads:
 *   · `GET /documents`            — ONE page of the browse list (or a view / filter resolve's page)
 *   · `GET /library/summary`      — every number the Library shows without listing a row
 *   · `GET /documents/{id}`       — a selected document on neither the page nor Find's rows (D-11)
 *
 * ── THE RULES ─────────────────────────────────────────────────────────────────────────
 * 1. THE PAGE DERIVES NOTHING FROM DOCUMENTS. Every row and every number the page renders comes
 *    from this hook. A child that only counts receives a number (D-07), never an array.
 * 2. `null` MEANS NOT ANSWERED, NEVER 0 (SEED-248 / D-12). `total`, `summary`, `inFlight` and
 *    `archivedHidden` stay `null` until their read has answered.
 * 3. A SOURCE SWITCH (folder, view, filter) IS COLD — the rows belong to another list, so they
 *    are cleared. A PAGE, ROWS-PER-PAGE or INCLUDE-ARCHIVED change is WARM — the rows stay while
 *    the answer is fetched. A REALTIME-triggered refetch is SILENT — no state change at all
 *    until the answer lands (UI-SPEC §Loading vocabulary).
 * 4. REALTIME IS A HINT (D-08 / D-v2.5-03). An INSERT or DELETE never patches a list: it
 *    schedules ONE refetch of the page and the summary, coalesced over 500 ms. Only an UPDATE to
 *    a row already on the page merges in place (`useDocuments`, T-284-17).
 * 5. A STALE ANSWER IS DROPPED (`useDocumentFind`'s `reqIdRef` guard): a slow earlier request can
 *    never overwrite a later one.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useDocuments } from "@/hooks/useDocuments"
import { getDocument, getLibrarySummary, listDocumentsPage, resolveAdHoc, resolveView } from "@/lib/api"
import type { Document, LibrarySummary, ViewFilter } from "@/types"

export type LibraryLoadState = "loading" | "ready" | "error"
/** `cold` — nothing on screen yet for this list · `warm` — the person asked for another page and
 *  the previous rows are still shown · `ready` · `error` (rows kept when there were any). */
export type LibraryListState = "cold" | "warm" | "ready" | "error"

/** What the list shows: a folder (or Root) browse, a saved view, or an unsaved filter. */
export type LibrarySource =
  | { kind: "browse"; folderId: string | null }
  | { kind: "view"; viewId: string }
  | { kind: "filter"; filter: ViewFilter }

/** The coalescing window for a Realtime hint (D-08 / T-284-20). */
export const LIBRARY_CHANGE_DEBOUNCE_MS = 500

export interface UseLibraryDocumentsArgs {
  source: LibrarySource
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
  /** The server's page, in the server's order — never sliced here. */
  rows: Document[]
  /** The server's exact total for this list; `null` until answered. */
  total: number | null
  /** Archived rows in this scope, shown or hidden (`ArchivedHiddenLine`'s count); `null` until known. */
  archivedHidden: number | null
  /** Documents still being read: the summary's pending + processing (R-04); `null` until answered. */
  inFlight: number | null
  /** The `GET /library/summary` answer; `null` until answered. */
  summary: LibrarySummary | null
  summaryState: LibraryLoadState
  listState: LibraryListState
  /** A load the person is waiting for (cold or warm) — never true for a background refetch. */
  loading: boolean
  error: Error | null
  /** The open document, or `null` when none is open, it is still being read, or it is not visible. */
  selectedDoc: Document | null
  /** Opening a document failed for a reason other than "not visible" (S8). */
  selectedDocError: Error | null
  retrySelectedDoc: () => void
  /** Re-read the page and the summary SILENTLY (after an edit, a move, an import). */
  refresh: () => Promise<void>
  /** "Try again" on the list — a load the person asked for. */
  retry: () => void
  /** "Try again" on the numbers. */
  retrySummary: () => void
  /** Bumped by every debounced change hint, so a child's own lists can refetch on it too. */
  changeTick: number
  upload: (file: File, folderId?: string | null) => Promise<{ isDuplicate: boolean }>
  deleteDoc: (id: string, scope?: "version" | "all") => Promise<void>
  uploading: boolean
  uploadingCount: number
  /** ⚠ 284-03 Task 1 window only — the current page rows for the Ingestion tab (Task 2 deletes it). */
  documentsForIngestion: Document[]
}

interface ListAnswer {
  rows: Document[]
  total: number
  /** A view / filter's archived count (the browse count is the summary's). */
  archived: number | null
}

interface SingleDoc {
  id: string
  doc: Document | null
  error: Error | null
}

function isNotVisible(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { status?: unknown }).status === 404
}

function asError(e: unknown, message: string): Error {
  return e instanceof Error ? e : new Error(message)
}

async function readList(
  source: LibrarySource,
  includeArchived: boolean,
  offset: number,
  limit: number,
): Promise<ListAnswer> {
  if (source.kind === "browse") {
    const res = await listDocumentsPage({
      folder_id: source.folderId ?? "root",
      include_archived: includeArchived,
      offset,
      limit,
    })
    return { rows: res.documents, total: res.total, archived: null }
  }
  const resolve = (opts: Parameters<typeof resolveView>[1]) =>
    source.kind === "view" ? resolveView(source.viewId, opts) : resolveAdHoc(source.filter, opts)
  // The archived count is ONE count read with the opposite flag: the difference between the two
  // totals is exactly the archived rows the view holds. A failed count is an unknown, not a 0.
  const [page, other] = await Promise.all([
    resolve({ offset, limit, include_archived: includeArchived }),
    resolve({ count_only: true, include_archived: !includeArchived }).catch(() => null),
  ])
  return {
    rows: page.documents ?? [],
    total: page.total,
    archived: other === null ? null : Math.abs(other.total - page.total),
  }
}

export function useLibraryDocuments({
  source,
  includeArchived,
  offset,
  limit,
  selectedDocId,
  findRows,
}: UseLibraryDocumentsArgs): UseLibraryDocuments {
  const [rows, setRows] = useState<Document[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [listArchived, setListArchived] = useState<number | null>(null)
  const [listState, setListState] = useState<LibraryListState>("cold")
  const [error, setError] = useState<Error | null>(null)
  // `attempt` — a reload the person asked for; `changeTick` — a silent one (a hint or a refresh).
  const [attempt, setAttempt] = useState(0)
  const [changeTick, setChangeTick] = useState(0)

  const [summary, setSummary] = useState<LibrarySummary | null>(null)
  const [summaryState, setSummaryState] = useState<LibraryLoadState>("loading")
  const [summaryTick, setSummaryTick] = useState(0)

  const reqIdRef = useRef(0)
  const summaryReqRef = useRef(0)
  /** The source whose rows are on screen (`null` = none yet). */
  const answeredKeyRef = useRef<string | null>(null)
  const lastRef = useRef({ key: "", page: "", attempt: 0, changeTick: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const summaryKnownRef = useRef(false)

  // ── the change hint (D-08): ONE refetch per 500 ms window, however many events land in it ──
  const scheduleChange = useCallback(() => {
    if (timerRef.current !== null) return
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setChangeTick((n) => n + 1)
      setSummaryTick((n) => n + 1)
    }, LIBRARY_CHANGE_DEBOUNCE_MS)
  }, [])
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    },
    [],
  )

  const base = useDocuments({ setRows, onChange: scheduleChange })

  // ── the page ──────────────────────────────────────────────────────────────────────────
  // Keyed on the SERIALISED source, so a new-but-equal object is the same list (no refetch).
  const sourceKey = JSON.stringify(source)
  useEffect(() => {
    const myReq = ++reqIdRef.current
    const page = `${offset}:${limit}:${includeArchived}`
    const prev = lastRef.current
    lastRef.current = { key: sourceKey, page, attempt, changeTick }
    const sameList = answeredKeyRef.current === sourceKey
    const background =
      sameList &&
      prev.key === sourceKey &&
      prev.page === page &&
      prev.attempt === attempt &&
      prev.changeTick !== changeTick

    if (!sameList) {
      // Cold: the previous rows belong to another list — never show them under this header.
      setRows([])
      setTotal(null)
      setListArchived(null)
      setError(null)
      setListState("cold")
    } else if (!background) {
      setListState("warm")
    }

    readList(JSON.parse(sourceKey) as LibrarySource, includeArchived, offset, limit).then(
      (answer) => {
        if (myReq !== reqIdRef.current) return
        answeredKeyRef.current = sourceKey
        setRows(answer.rows)
        setTotal(answer.total)
        setListArchived(answer.archived)
        setError(null)
        setListState("ready")
      },
      (e: unknown) => {
        if (myReq !== reqIdRef.current) return
        // Rows (if any) are deliberately left as they were: an error never swaps the list.
        setError(asError(e, "Couldn't load documents."))
        setListState("error")
      },
    )
  }, [sourceKey, includeArchived, offset, limit, attempt, changeTick])

  // ── the numbers ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const myReq = ++summaryReqRef.current
    getLibrarySummary().then(
      (s) => {
        if (myReq !== summaryReqRef.current) return
        summaryKnownRef.current = true
        setSummary(s)
        setSummaryState("ready")
      },
      () => {
        if (myReq !== summaryReqRef.current) return
        // A background refetch that fails keeps the last answer; a first read that fails says so.
        if (!summaryKnownRef.current) setSummaryState("error")
      },
    )
  }, [summaryTick])

  const refresh = useCallback(async () => {
    setChangeTick((n) => n + 1)
    setSummaryTick((n) => n + 1)
  }, [])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  const retrySummary = useCallback(() => {
    if (!summaryKnownRef.current) setSummaryState("loading")
    setSummaryTick((n) => n + 1)
  }, [])

  // ── the open document (D-11) ──────────────────────────────────────────────────────────
  // The page first, then Find's rows (an older version lives only there), else ONE read by id.
  const fromLists = useMemo<Document | null>(
    () =>
      selectedDocId === null
        ? null
        : rows.find((d) => d.id === selectedDocId) ?? findRows.find((d) => d.id === selectedDocId) ?? null,
    [selectedDocId, rows, findRows],
  )
  const [single, setSingle] = useState<SingleDoc | null>(null)
  // Remember the last row the selection resolved to, so paging away does not close the panel.
  useEffect(() => {
    if (fromLists) setSingle((prev) => (prev?.doc === fromLists ? prev : { id: fromLists.id, doc: fromLists, error: null }))
  }, [fromLists])
  const known = single !== null && single.id === selectedDocId
  // Only once the page has answered: a document on the page being loaded costs no extra read.
  const listSettled = listState === "ready" || listState === "error"
  const fetchId =
    selectedDocId !== null && fromLists === null && !known && listSettled ? selectedDocId : null
  useEffect(() => {
    if (fetchId === null) return
    let alive = true
    getDocument(fetchId).then(
      (doc) => {
        if (alive) setSingle({ id: fetchId, doc, error: null })
      },
      (e: unknown) => {
        if (!alive) return
        // 404 → the panel stays closed with no copy that could confirm the document exists.
        setSingle({ id: fetchId, doc: null, error: isNotVisible(e) ? null : asError(e, "Couldn't open that document.") })
      },
    )
    return () => {
      alive = false
    }
  }, [fetchId])
  const retrySelectedDoc = useCallback(() => setSingle(null), [])
  const selectedDoc = fromLists ?? (known ? single.doc : null)
  const selectedDocError = fromLists === null && known ? single.error : null

  // ── the doors ─────────────────────────────────────────────────────────────────────────
  const { upload: baseUpload, deleteDoc: baseDelete } = base
  const browseFolder = source.kind === "browse" ? source.folderId : undefined
  const upload = useCallback(
    async (file: File, folderId?: string | null) => {
      const res = await baseUpload(file, folderId)
      const doc = res.doc
      // D-08: the new document is the first row of page 1 of ITS folder until the refetch the
      // upload asked for reconciles it. Totals move with the summary refetch, never here.
      if (doc && browseFolder !== undefined && offset === 0 && (doc.folder_id ?? null) === browseFolder) {
        setRows((prev) => (prev.some((d) => d.id === doc.id) ? prev : [doc, ...prev]))
      }
      return { isDuplicate: res.isDuplicate }
    },
    [baseUpload, browseFolder, offset],
  )
  const deleteDoc = useCallback(
    async (id: string, scope?: "version" | "all") => {
      await baseDelete(id, scope)
      // A deleted document must not stay open from the remembered row.
      setSingle((prev) => (prev?.id === id ? { id, doc: null, error: null } : prev))
    },
    [baseDelete],
  )

  // ── the numbers the page shows ────────────────────────────────────────────────────────
  const archivedHidden =
    source.kind === "browse"
      ? summary === null
        ? null
        : source.folderId === null
          ? summary.root.archived
          : (summary.folders[source.folderId]?.archived ?? 0)
      : listArchived
  const inFlight = summary === null ? null : summary.status.pending + summary.status.processing

  return {
    rows,
    total,
    archivedHidden,
    inFlight,
    summary,
    summaryState,
    listState,
    loading: listState === "cold" || listState === "warm",
    error,
    selectedDoc,
    selectedDocError,
    retrySelectedDoc,
    refresh,
    retry,
    retrySummary,
    changeTick,
    upload,
    deleteDoc,
    uploading: base.uploading,
    uploadingCount: base.uploadingCount,
    documentsForIngestion: rows,
  }
}
