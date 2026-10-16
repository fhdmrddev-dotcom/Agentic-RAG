/**
 * Phase 284-03 (FIX-11 / D-08 / D-11 / D-24 / R-11) — a Library API that answers like the server.
 *
 * Before 284 every Library suite mocked `useDocuments` with the WHOLE documents array and let the
 * page count it. The page no longer holds that array: it asks `GET /documents` for one page,
 * `GET /library/summary` for the numbers and `GET /documents/{id}` for a document on neither the
 * page nor Find's rows. This module evaluates those requests against ONE fixture the way the
 * server does (latest only, folder scope, archived hidden unless asked, status buckets, order,
 * offset / limit, the exact total), so a suite cannot pass by mocking a number — every number on
 * screen is derived from the same rows the list shows.
 *
 * ── THE RULES ─────────────────────────────────────────────────────────────────────────────
 * ⛔ TEST-ONLY. Never imported by product code (the `lib/stripComments.testutil.ts` rule); a
 *    grep for this path outside `__tests__` / `*.test.*` must print nothing.
 * ⛔ FILE-LOCAL. Each suite installs it itself; it is NOT wired in `setupTests.ts` (the
 *    `mockReactFlow.ts` rule — a global install would reach every suite).
 * ⛔ NO vitest import: it is typechecked with the app, so a mock is taken structurally.
 */
import type {
  Document,
  DocumentListParams,
  DocumentListResponse,
  LibraryCount,
  LibrarySummary,
  ViewFilter,
} from "@/types"
// The product's error class (a test util may import product code; never the reverse). A 404 is
// the server's uniform answer for a document the caller cannot see (T-284-19).
import { DocumentListError } from "@/lib/api/documents"

// ── the summary (moved here from useLibraryDocuments by 284-03) ──────────────────────────────

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
 * `GET /library/summary` over a fixture. Field names and semantics are the server's: `total`,
 * `root` and `folders` INCLUDE archived; `status.paused` is always 0 (R-04 — paused is not a
 * stored document status). Only LATEST rows are counted, as the server's view does.
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
  let total = 0

  for (const d of docs) {
    if (d.is_latest === false) continue
    total += 1
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
    total,
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

// ── the list ────────────────────────────────────────────────────────────────────────────────

const STATUS_SETS: Record<NonNullable<DocumentListParams["status"]>, readonly string[]> = {
  in_flight: ["pending", "processing"],
  completed: ["completed"],
  failed: ["failed"],
  done: ["completed", "failed"],
}

function isSpreadsheet(d: Document): boolean {
  const name = d.filename.toLowerCase()
  const mime = (d.mime_type ?? "").toLowerCase()
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv") ||
    mime.includes("spreadsheet") ||
    mime.includes("csv")
  )
}

/** The server's order: the timestamp descending, then `id` descending as the tiebreak. */
function ordered(docs: readonly Document[], order: DocumentListParams["order"]): Document[] {
  const key = order === "updated_desc" ? "updated_at" : "created_at"
  return [...docs].sort((a, b) => {
    const t = (b[key] ?? "").localeCompare(a[key] ?? "")
    return t !== 0 ? t : b.id.localeCompare(a.id)
  })
}

export interface FakeResolveOpts {
  count_only?: boolean
  offset?: number
  limit?: number
  include_archived?: boolean
}

export interface FakeResolveAnswer {
  documents?: Document[]
  total: number
  offset?: number
  limit?: number
}

export interface FakeLibraryApi {
  listDocumentsPage(params: DocumentListParams): Promise<DocumentListResponse>
  getLibrarySummary(): Promise<LibrarySummary>
  getDocument(id: string): Promise<Document>
  resolveView(id: string, opts?: FakeResolveOpts): Promise<FakeResolveAnswer>
  resolveAdHoc(filter: ViewFilter, opts?: FakeResolveOpts): Promise<FakeResolveAnswer>
}

export interface FakeLibraryOptions {
  /** A saved view's resolved rows, by view id (unknown id → no rows). */
  views?: Record<string, readonly Document[]>
  /** An ad-hoc filter's resolved rows (default: no rows). */
  adHoc?: (filter: ViewFilter) => readonly Document[]
}

/** A resolve pages the caller-supplied resolved set exactly as the server pages a view. */
function resolvePage(rows: readonly Document[], opts: FakeResolveOpts = {}): FakeResolveAnswer {
  // Server default for a resolve: archived INCLUDED (today's resolve has no archived predicate).
  const include = opts.include_archived ?? true
  const shown = rows.filter((d) => d.is_latest !== false && (include || !d.archived_at))
  if (opts.count_only) return { total: shown.length }
  const offset = opts.offset ?? 0
  const limit = opts.limit ?? 25
  return { documents: shown.slice(offset, offset + limit), total: shown.length, offset, limit }
}

export function fakeLibraryApi(
  docs: readonly Document[],
  options: FakeLibraryOptions = {},
): FakeLibraryApi {
  return {
    async listDocumentsPage(params) {
      const statuses = params.status ? STATUS_SETS[params.status] : null
      const rows = docs.filter((d) => {
        if (d.is_latest === false) return false
        if (params.folder_id === "root" && d.folder_id != null) return false
        if (params.folder_id !== undefined && params.folder_id !== "root" && d.folder_id !== params.folder_id)
          return false
        if (!params.include_archived && d.archived_at) return false
        if (statuses && !statuses.includes(d.status)) return false
        if (params.kind === "spreadsheet" && !isSpreadsheet(d)) return false
        return true
      })
      const sorted = ordered(rows, params.order)
      return {
        documents: sorted.slice(params.offset, params.offset + params.limit),
        total: sorted.length,
        offset: params.offset,
        limit: params.limit,
      }
    },
    async getLibrarySummary() {
      return summarizeDocuments(docs)
    },
    async getDocument(id) {
      const found = docs.find((d) => d.id === id)
      if (!found) throw new DocumentListError(404, "Couldn't load this document.")
      return found
    },
    async resolveView(id, opts) {
      return resolvePage(options.views?.[id] ?? [], opts)
    },
    async resolveAdHoc(filter, opts) {
      return resolvePage(options.adHoc?.(filter) ?? [], opts)
    },
  }
}

/** The structural slice of a vitest mock this module needs — no vitest import (see the rules). */
interface ImplementableMock {
  mockImplementation(fn: (...args: never[]) => unknown): unknown
}

export interface FakeLibraryMocks {
  listDocumentsPage?: ImplementableMock
  getLibrarySummary?: ImplementableMock
  getDocument?: ImplementableMock
  resolveView?: ImplementableMock
  resolveAdHoc?: ImplementableMock
}

/** Point each given mock at the fake for `docs`. A mock left out keeps the suite's own answer. */
export function installFakeLibraryApi(
  mocks: FakeLibraryMocks,
  docs: readonly Document[],
  options: FakeLibraryOptions = {},
): FakeLibraryApi {
  const api = fakeLibraryApi(docs, options)
  mocks.listDocumentsPage?.mockImplementation(api.listDocumentsPage as never)
  mocks.getLibrarySummary?.mockImplementation(api.getLibrarySummary as never)
  mocks.getDocument?.mockImplementation(api.getDocument as never)
  mocks.resolveView?.mockImplementation(api.resolveView as never)
  mocks.resolveAdHoc?.mockImplementation(api.resolveAdHoc as never)
  return api
}
