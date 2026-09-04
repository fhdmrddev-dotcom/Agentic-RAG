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
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

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
