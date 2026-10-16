"""The Library's index facts — Phase 217.1 (BE-2 / LIB-01, D-217.1-27).

`GET /library/index-summary` — corpus totals + per-folder rows for the Indexing tab's
Vector store, Embedding model and Folders cards.

⭐ **UNGATED, BY DECISION (D-217.1-27).** Reading how many vectors YOUR OWN corpus has is
not model management; changing the model is. The route therefore carries NO
`require_visible("model_management")` dependency — the three ACTION buttons stay gated in
Plan 10, this route's facts are visible to every user. This also closes Phase 217's
deferred WR-02 (a non-operator previously had no way to see the indexing facts at all).

⭐ **RLS-ENFORCED, NOT SERVICE-ROLE — deliberately unlike its neighbours.**
`knowledge_health.py` / `document_queries.py` take a service-role carve-out because
`audit_log` has no `authenticated` SELECT policy (mig 108). That reason does NOT apply
here: `document_chunks` / `documents` / `folders` all carry live `authenticated` SELECT
policies, so the correct path is `get_user_pg_connection` — an asyncpg connection with
`SET LOCAL ROLE authenticated` + the JWT-claims GUCs applied, so RLS is enforced by
Postgres itself on the raw `GROUP BY`. A second user's folders can never appear because
Postgres filters them at the row level, not because app code remembers to.

The `GROUP BY` under the RLS path inherits `get_globally_visible_folder_ids`'s org-shared
merge automatically (documents.py:741) — do NOT hand-roll a narrower `.eq("user_id", ...)`
filter that would disagree with the Documents tab's own count.

`last_indexed` is `max(embedded_at)` (BE-1) — the honest "when the vector was written"
time — never `created_at`, which is the chunking time and does not move on a re-embed.

Read-only by construction: no INSERT, no UPDATE, no DELETE, no audit event of its own.

`GET /library/summary` (Phase 284, FIX-11 / R-03) — every number the Library shows (header
total, in-flight pill, folder and Root counts, folder sizes, the CHUNKS tile, the ingestion stage
cards, the "added by" connections, the document-type list) from ONE grouping-sets scan. ⚠ It
reads the VIEW `public.library_documents` (migration 207 — own documents ∪ documents in org-shared
folders the caller does not own), NOT the RLS-wide `documents` table that `index-summary` reads,
so its numbers equal `GET /documents`' totals by construction: both read one SQL home of the
visible set. Same RLS path (`get_user_pg_connection`), no new SQL function, nothing bounded by the
number of documents — only by folders, statuses, steps, connections and types.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.dependencies import get_current_user, get_user_pg_connection
from app.services.openai_service import resolve_effective_embedding_provider

router = APIRouter(prefix="/library", tags=["library"])


class FolderIndexRow(BaseModel):
    folder_id: str | None
    name: str
    documents: int
    chunks: int
    vectors: int
    last_indexed: datetime | None


class IndexSummary(BaseModel):
    vectors: int | None
    chunks_total: int | None
    documents_without_vectors: int | None
    last_indexed: datetime | None
    model: str | None
    dimensions: int | None
    provider: str | None
    folders: list[FolderIndexRow]


@router.get("/index-summary", response_model=IndexSummary)
async def get_index_summary(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> IndexSummary:
    """One RLS-enforced GROUP BY over the caller's own corpus. Ungated per D-217.1-27."""
    async with get_user_pg_connection(request, current_user) as conn:
        totals_row = await conn.fetchrow(
            """
            SELECT
                COUNT(*)                                          AS chunks_total,
                COUNT(embedding)                                  AS vectors,
                MAX(dc.embedded_at)                               AS last_indexed,
                MAX(dc.embedding_model)                           AS model,
                MAX(dc.embedding_dimensions)                      AS dimensions
            FROM public.document_chunks dc
            """
        )
        # Per-folder rows: the folder name joins in-scope (RLS already filtered which
        # folders this caller can see — the LEFT JOIN can never leak another user's).
        folder_rows = await conn.fetch(
            """
            SELECT
                d.folder_id,
                COALESCE(f.name, 'Root')                          AS name,
                COUNT(DISTINCT d.id)                              AS documents,
                COUNT(dc.id) FILTER (WHERE dc.id IS NOT NULL)     AS chunks,
                COUNT(dc.embedding)                               AS vectors,
                MAX(dc.embedded_at)                               AS last_indexed
            FROM public.documents d
            LEFT JOIN public.document_chunks dc ON dc.document_id = d.id
            LEFT JOIN public.folders f ON f.id = d.folder_id
            GROUP BY d.folder_id, f.name
            ORDER BY d.folder_id NULLS FIRST
            """
        )
        # Exact documents-without-vectors: total docs minus docs with ≥1 vector.
        total_documents = await conn.fetchval("SELECT COUNT(*) FROM public.documents")
        docs_with_vectors = await conn.fetchval(
            "SELECT COUNT(DISTINCT document_id) FROM public.document_chunks "
            "WHERE embedding IS NOT NULL"
        )

    model = totals_row["model"]
    dimensions = totals_row["dimensions"]
    provider = None
    if model:
        try:
            provider = resolve_effective_embedding_provider(model)
        except Exception:
            provider = None

    folders = [
        FolderIndexRow(
            # D-217.1-31: the null-folder bucket reads `Root`, never `Uncategorized`.
            folder_id=str(r["folder_id"]) if r["folder_id"] is not None else None,
            name=r["name"] or "Root",
            documents=r["documents"] or 0,
            chunks=r["chunks"] or 0,
            vectors=r["vectors"] or 0,
            last_indexed=r["last_indexed"],
        )
        for r in folder_rows
    ]

    return IndexSummary(
        vectors=totals_row["vectors"],
        chunks_total=totals_row["chunks_total"],
        documents_without_vectors=max(
            0, (total_documents or 0) - (docs_with_vectors or 0)
        ),
        last_indexed=totals_row["last_indexed"],
        model=model,
        dimensions=dimensions,
        provider=provider,
        folders=folders,
    )


# ── Phase 284 · GET /library/summary ─────────────────────────────────────────────────────────

#: The `document_types` list is bounded by distinct VALUES, which a user controls; cap it so a
#: pathological metadata field cannot grow the response with the library (T-284-12).
DOCUMENT_TYPES_CAP = 200

#: ONE scan over the caller's visible set. GROUPING(col) = 1 when `col` is NOT in the row's
#: grouping set, which is how the fold below tells the grand-total row from the Root row (both
#: carry folder_id NULL — D-217.1-31: the null-folder bucket is Root).
#: The rate-limit predicate mirrors IngestionTab's `pausedDoc` text match (rate limit / 429 /
#: quota) over in-flight rows, so the banner's trigger is counted server-side.
LIBRARY_SUMMARY_SQL = """
SELECT GROUPING(folder_id)            AS g_f,
       GROUPING(status)               AS g_s,
       GROUPING(ingestion_step)       AS g_i,
       GROUPING(source_connection_id) AS g_c,
       GROUPING(doc_type)             AS g_t,
       folder_id, status, ingestion_step, source_connection_id, doc_type,
       count(*)                                        AS n,
       coalesce(sum(file_size), 0)::bigint             AS size_bytes,
       count(*) FILTER (WHERE archived_at IS NOT NULL) AS archived,
       coalesce(sum(chunk_count), 0)::bigint           AS chunks,
       count(*) FILTER (
         WHERE status IN ('pending', 'processing')
           AND (error_message ILIKE '%rate limit%' OR error_message ILIKE '%429%'
                OR error_message ILIKE '%quota%')
       )                                               AS rate_limited
FROM (
  SELECT folder_id, status, ingestion_step, source_connection_id, file_size, chunk_count,
         archived_at, error_message, metadata->>'document_type' AS doc_type
  FROM public.library_documents
  WHERE is_latest
) v
GROUP BY GROUPING SETS ((), (folder_id), (status), (status, ingestion_step),
                        (source_connection_id), (doc_type))
"""

#: The ONE name read, bounded by the distinct connection ids of the caller's visible set.
#: ⚠ `id, name` ONLY — `authenticated` holds no SELECT grant on connector_connections' secret
#: columns, so `*` raises permission denied (T-284-15).
CONNECTION_NAMES_SQL = "SELECT id, name FROM public.connector_connections WHERE id = ANY($1::uuid[])"


class LibraryCount(BaseModel):
    count: int = 0
    size_bytes: int = 0
    archived: int = 0


class LibraryStatus(BaseModel):
    pending: int = 0
    processing: int = 0
    #: R-04: `paused` is not a document status (documents_status_check allows pending,
    #: processing, completed, failed — it lives on ingestion_jobs). Kept at 0 for wire
    #: compatibility with the frontend's `"paused"` branches.
    paused: int = 0
    completed: int = 0
    failed: int = 0


class LibraryConnection(BaseModel):
    id: str
    name: str | None = None
    count: int


class LibraryDocType(BaseModel):
    value: str
    count: int


class LibrarySummary(BaseModel):
    """Every Library number over the caller's visible set (latest versions; archived INCLUDED in
    total / root / folders, as the Library has always counted them)."""

    total: int = 0
    archived: int = 0
    chunks: int = 0
    root: LibraryCount = Field(default_factory=LibraryCount)
    folders: dict[str, LibraryCount] = Field(default_factory=dict)
    status: LibraryStatus = Field(default_factory=LibraryStatus)
    #: in-flight counts per `ingestion_step`, for `status = 'processing'` only (IngestionTab's fold)
    steps: dict[str, int] = Field(default_factory=dict)
    rate_limited_in_flight: int = 0
    connections: list[LibraryConnection] = Field(default_factory=list)
    document_types: list[LibraryDocType] = Field(default_factory=list)
    document_types_truncated: bool = False


def fold_summary_rows(rows, names: dict[str, str | None]) -> LibrarySummary:
    """Fold the grouping-sets rows into the wire shape. Pure — the unit suite drives it."""
    out = LibrarySummary()
    types: list[LibraryDocType] = []
    for r in rows:
        g_f, g_s, g_i, g_c, g_t = r["g_f"], r["g_s"], r["g_i"], r["g_c"], r["g_t"]
        n = int(r["n"] or 0)
        if g_f and g_s and g_i and g_c and g_t:  # () — the grand total
            out.total = n
            out.archived = int(r["archived"] or 0)
            out.chunks = int(r["chunks"] or 0)
            out.rate_limited_in_flight = int(r["rate_limited"] or 0)
        elif not g_f:  # (folder_id)
            bucket = LibraryCount(count=n, size_bytes=int(r["size_bytes"] or 0),
                                  archived=int(r["archived"] or 0))
            if r["folder_id"] is None:
                out.root = bucket
            else:
                out.folders[str(r["folder_id"])] = bucket
        elif not g_s and g_i:  # (status)
            if r["status"] in ("pending", "processing", "completed", "failed"):
                setattr(out.status, r["status"], n)
        elif not g_s and not g_i:  # (status, ingestion_step)
            if r["status"] == "processing" and r["ingestion_step"]:
                out.steps[r["ingestion_step"]] = n
        elif not g_c:  # (source_connection_id)
            if r["source_connection_id"] is not None:
                cid = str(r["source_connection_id"])
                out.connections.append(LibraryConnection(id=cid, name=names.get(cid), count=n))
        elif not g_t:  # (doc_type)
            if r["doc_type"] is not None:
                types.append(LibraryDocType(value=r["doc_type"], count=n))
    out.connections.sort(key=lambda c: (-c.count, c.id))
    types.sort(key=lambda t: (-t.count, t.value))
    out.document_types = types[:DOCUMENT_TYPES_CAP]
    out.document_types_truncated = len(types) > DOCUMENT_TYPES_CAP
    return out


@router.get("/summary", response_model=LibrarySummary)
async def get_library_summary(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> LibrarySummary:
    """The Library's numbers, aggregated in SQL over the caller's visible set.

    One grouping-sets scan over `public.library_documents` (RLS-enforced, as the caller), then
    at most one name read bounded by the distinct connection ids. Ungated, like
    `index-summary`: these are the caller's own corpus facts.
    """
    async with get_user_pg_connection(request, current_user) as conn:
        rows = await conn.fetch(LIBRARY_SUMMARY_SQL)
        conn_ids = sorted(
            {r["source_connection_id"] for r in rows
             if not r["g_c"] and r["source_connection_id"] is not None},
            key=str,
        )
        names: dict[str, str | None] = {}
        if conn_ids:
            for nr in await conn.fetch(CONNECTION_NAMES_SQL, conn_ids):
                names[str(nr["id"])] = nr["name"]
    return fold_summary_rows(rows, names)
