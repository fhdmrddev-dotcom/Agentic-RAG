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
 *    a row already on the page merges in place (`useDocuments`, T-284-17) — and an UPDATE that
 *    changes which list the row is on (folder, archived, latest, status) schedules the same
 *    refetch instead (284-REVIEW WR-01).
 * 5. A STALE ANSWER IS DROPPED (`useDocumentFind`'s `reqIdRef` guard): a slow earlier request can
 *    never overwrite a later one.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"

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
  /** Which page `rows` are (offset / limit of the request that answered them); `null` until
   *  answered. After a failed page change this is still the page ON SCREEN (284-REVIEW IN-07). */
  rowsPage: { offset: number; limit: number } | null
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
}

interface ListAnswer {
  rows: Document[]
  total: number
  /** A view / filter's archived count (the browse count is the summary's). */
  archived: number | null
}

/** The last list request that settled, and the rows it put on screen. */
interface SettledList extends ListAnswer {
  /** The request that settled (success or failure). */
  sourceKey: string
  pageKey: string
  attempt: number
  /** The source the ROWS belong to — kept from the previous answer when a request fails. */
  answeredKey: string | null
  /** The page the ROWS are (offset / limit of the request that answered them) — kept, like
   *  `answeredKey`, when a later request fails (284-REVIEW IN-07). */
  answeredPage: { offset: number; limit: number } | null
  error: Error | null
}

const NO_ROWS: Document[] = []

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
  // ⭐ ONE settled-request record, written ONLY in a request's callbacks. Every list state is
  // DERIVED from it in render (never set synchronously in an effect), so the state machine cannot
  // drift from the request that produced it.
  const [settled, setSettled] = useState<SettledList | null>(null)
  // `attempt` — a reload the person asked for; `changeTick` — a silent one (a hint or a refresh).
  const [attempt, setAttempt] = useState(0)
  const [changeTick, setChangeTick] = useState(0)

  const [summary, setSummary] = useState<LibrarySummary | null>(null)
  const [summaryState, setSummaryState] = useState<LibraryLoadState>("loading")
  const [summaryTick, setSummaryTick] = useState(0)

  const reqIdRef = useRef(0)
  const summaryReqRef = useRef(0)
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

  // The on-page rows' setter (`useDocuments`' Realtime merge, the optimistic upload row). It
  // edits the rows that are ON SCREEN; with nothing answered there is nothing to edit.
  const setRows = useCallback<Dispatch<SetStateAction<Document[]>>>((update) => {
    setSettled((prev) =>
      prev === null ? prev : { ...prev, rows: typeof update === "function" ? update(prev.rows) : update },
    )
  }, [])

  // 284-REVIEW WR-01: `rows` — the rows `setRows` edits — lets an UPDATE that moves a row off
  // this list (a move, an archive, a status change) schedule the refetch instead of merging.
  const base = useDocuments({ rows: settled?.rows ?? NO_ROWS, setRows, onChange: scheduleChange })

  // ── the page ──────────────────────────────────────────────────────────────────────────
  // Keyed on the SERIALISED source, so a new-but-equal object is the same list (no refetch).
  const sourceKey = JSON.stringify(source)
  const pageKey = `${offset}:${limit}:${includeArchived}`
  useEffect(() => {
    const myReq = ++reqIdRef.current
    const request = { sourceKey, pageKey, attempt }
    readList(JSON.parse(sourceKey) as LibrarySource, includeArchived, offset, limit).then(
      (answer) => {
        if (myReq !== reqIdRef.current) return
        setSettled({ ...request, answeredKey: sourceKey, answeredPage: { offset, limit }, ...answer, error: null })
      },
      (e: unknown) => {
        if (myReq !== reqIdRef.current) return
        // Rows (if any) are deliberately left as they were: an error never swaps the list.
        setSettled((prev) => ({
          answeredKey: prev?.answeredKey ?? null,
          answeredPage: prev?.answeredPage ?? null,
          rows: prev?.rows ?? [],
          total: prev?.total ?? 0,
          archived: prev?.archived ?? null,
          ...request,
          error: asError(e, "Couldn't load documents."),
        }))
      },
    )
  }, [sourceKey, pageKey, includeArchived, offset, limit, attempt, changeTick])

  // Derived (UI-SPEC §Loading vocabulary): rows belong to THIS source, or none are shown (cold);
  // the settled request is the one asked for, or the person is waiting (warm). A change hint is
  // not part of the request identity, so a background refetch never reads as a wait (silent).
  const onScreen = settled !== null && settled.answeredKey === sourceKey
  const isCurrent =
    settled !== null && settled.sourceKey === sourceKey && settled.pageKey === pageKey && settled.attempt === attempt
  const listState: LibraryListState = !onScreen
    ? isCurrent && settled.error
      ? "error"
      : "cold"
    : !isCurrent
      ? "warm"
      : settled.error
        ? "error"
        : "ready"
  const rows = onScreen ? settled.rows : NO_ROWS
  const rowsPage = onScreen ? settled.answeredPage : null
  const total = onScreen ? settled.total : null
  const listArchived = onScreen ? settled.archived : null
  const error = isCurrent ? settled.error : null

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
  // (React's "adjust state while rendering" pattern — guarded, so it settles in one extra pass.)
  if (fromLists && single?.doc !== fromLists) {
    setSingle({ id: fromLists.id, doc: fromLists, error: null })
  }
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
    [baseUpload, browseFolder, offset, setRows],
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
    rowsPage,
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
  }
}
