"""Phase 272 (D-13) — the retrieval RPC adapter, moved VERBATIM out of ``retrieval_service.py``.

⭐ **This module discharges the extraction that had been owed since Phase 231 (SEED-224).** ``retrieval_service.py``
fired G-5 and the ROADMAP said its THIRD landing must propose the extraction before adding
behaviour; Phase 272 is that third landing, so 272-01 takes the extraction FIRST, as a pure move
(``tests/unit/test_272_pure_move.py`` proves every function here is AST-identical to its
PHASE_BASE source — only ``_call_as_user``'s G-5 docstring paragraph was rewritten, on purpose).

What lives here: the pgvector literal, the asyncpg user-context call (``_call_as_user`` — the
RLS/claims boundary every retrieval RPC runs under), and the two RPC arms
(``match_document_chunks`` / ``keyword_search_chunks``).

⛔ **What this module is NOT:** it is not the orchestrator (``retrieval_service.search_documents``
still composes embed → arms → fuse → rerank → enrich), not ranking (``retrieval_rank.py``), not a
document reader (``retrieval_documents.py``), and not the filter seam (``retrieval_scope.py``).
Filtered retrieval lands in ``retrieval_scope.py`` and this module — never back in
``retrieval_service.py``. (Knob logic: see ``_call_as_user``.)
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.config import settings
from app.dependencies import get_user_pg_connection
from app.services.openai_service import embed_texts
from app.services.retrieval_tuning import apply_hnsw_session_knobs

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings


def _vector_literal(embedding: list[float]) -> str:
    """Format a float embedding as a pgvector literal (Phase 164 / RESEARCH Pitfall 3).

    The asyncpg pool registers ONLY a jsonb codec (dependencies.py:74) — there is NO
    vector codec, so a raw ``list[float]`` cannot be bound to a ``vector`` param the way
    PostgREST/``supabase.rpc`` did implicitly. Build the ``'[...]'`` literal and cast it
    at the call site (``$1::public.vector``) instead.
    """
    return "[" + ",".join(repr(float(x)) for x in embedding) + "]"


async def _call_as_user(
    user_id: str,
    fn_sql: str,
    *args,
    hnsw_ef_search: int | None = None,
    hnsw_iterative_scan: str | None = None,
) -> list[dict]:
    """Run a retrieval RPC (or any SELECT) over the Phase-163 asyncpg user-context (D-164-02).

    Opens ``get_user_pg_connection(None, {"id": user_id})`` — the uid-synthesized
    ``request.jwt.claims`` context (``SET LOCAL ROLE authenticated`` + both GUC forms, NO
    token → no mid-run expiry, the 163 red line) — so the DEFINER bodies' nested
    ``current_user_org_ids()`` / ``auth.uid()`` resolve the CALLER's org and a spoofed
    ``match_user_id`` cannot cross orgs. Returns plain dicts so the shape is parity with the
    old ``supabase.rpc(...).data`` (uuid columns are cast ``::text`` at the call site so ids
    stay str-keyed exactly like the PostgREST JSON, keeping ``_rrf_fuse`` / enrich lookups
    byte-compatible). Fail-closed: on a service-role/owner connection ``auth.uid()`` is NULL
    → empty org set → 0 rows.

    Phase 241 (QUEUE-06 / D-10 / D-11) — the two optional HNSW knobs ride the transaction this
    context manager ALREADY opens, so the COMMIT that already happens auto-reverts every
    ``SET LOCAL`` and a scan budget cannot leak to the next borrower of the pooled connection.
    No new plumbing; absent both knobs this function is byte-identical to the shipped one.

    ⛔ **G-5 — the extraction is DISCHARGED by 272-01, and that is a rule, not a licence.**
    ``retrieval_service.py``'s extraction had been owed since Phase 231 (SEED-224); Phase 241 was
    its SECOND landing, and the ROADMAP said a THIRD must propose the extraction before adding
    behaviour. Phase 272 is that third landing, so 272-01 took the extraction first, as a pure
    move: this function now lives in ``retrieval_rpc.py``, and filtered retrieval lands in
    ``retrieval_scope.py`` / this module — **never back in** ``retrieval_service.py``, which is
    the orchestrator only. The 241 cap rationale still stands: the knob LOGIC (validation, the
    `set_config` statements, the degrade-not-fail arms, the hardcoded memory companions)
    deliberately lives in ``app/services/retrieval_tuning.py`` so that what lands here stays a
    call and its arguments. Do not move it back.
    """
    async with get_user_pg_connection(None, {"id": user_id}) as conn:
        if hnsw_ef_search is not None or hnsw_iterative_scan is not None:
            await apply_hnsw_session_knobs(
                conn, ef_search=hnsw_ef_search, iterative_scan=hnsw_iterative_scan
            )
        rows = await conn.fetch(fn_sql, *args)
    return [dict(r) for r in rows]


async def _vector_search(
    query: str,
    user_id: str,
    supabase: Client,
    metadata_filter: dict | None,
    top_n: int,
    match_threshold: float,
    user_settings: UserEffectiveSettings | None,
    folder_ids: list[str] | None = None,
) -> list[dict]:
    # SEED-065: embed_texts is a SYNC OpenAI HTTP call. Running it directly on the
    # event loop froze ALL request serving for the embedding round-trip — under a
    # search-heavy llm_batch_agents fan-out (N concurrent sub-agents) that stacked
    # into multi-second idle-request stalls (conc_probe cross_tab_latency p95=2.6s,
    # threadpool only 6/200 = blocking, not starvation). Wrap in run_in_threadpool
    # so the blocking HTTP call leaves the loop (the D-v2.5-01 pattern; supersedes
    # the D-058-01 deferral that scoped 058 to Supabase only). Behavior identical.
    query_embedding = (
        await run_in_threadpool(embed_texts, [query], user_settings=user_settings)
    )[0]
    # Phase 111.1 D-10: filter search to the CURRENTLY-configured embedding model so a
    # half-finished re-embed never compares across vector spaces (Pitfall 2). Stale-model
    # chunks are excluded — that exclusion is the graceful-dip recall reduction (D-04),
    # NOT a cross-vector-space comparison. The migration-073 backfill tagged pre-existing
    # chunks text-embedding-3-small, so default to that when no model is configured.
    current_model = (getattr(user_settings, "embedding_model", "") or "text-embedding-3-small")
    # Phase 164 (D-164-02): run the DEFINER RPC over the asyncpg user-context (NOT the
    # passed-in service-role `supabase` client — the org predicate resolves auth.uid()=caller
    # only there). Positional args map the migration-073 signature order; the embedding is a
    # pgvector literal cast `$1::public.vector` (Pitfall 3); id/document_id cast ::text so the
    # dict shape matches the old PostgREST JSON (str ids for _rrf_fuse / enrich lookups).
    return await _call_as_user(
        user_id,
        """SELECT id::text AS id, document_id::text AS document_id, content, chunk_index, similarity
           FROM public.match_document_chunks($1::public.vector, $2, $3, $4, $5, $6, $7)""",
        _vector_literal(query_embedding),
        user_id,
        top_n,
        match_threshold,
        metadata_filter if metadata_filter else None,
        folder_ids if folder_ids else None,
        current_model,
        # Phase 241 (D-09 / D-11) — the ONLY caller that passes these: HNSW is the vector
        # index, so `_keyword_search` below deliberately carries nothing. Resolved in the
        # shipped `user_settings.x if user_settings else settings.x` idiom used at :365-372.
        hnsw_ef_search=(user_settings.hnsw_ef_search if user_settings else settings.hnsw_ef_search),
        hnsw_iterative_scan=(
            user_settings.hnsw_iterative_scan if user_settings else settings.hnsw_iterative_scan
        ),
    )


async def _keyword_search(
    query: str,
    user_id: str,
    supabase: Client,
    metadata_filter: dict | None,
    top_n: int,
    folder_ids: list[str] | None = None,
) -> list[dict]:
    # Phase 164 (D-164-02): same user-context swap as `_vector_search` — keyword_search_chunks
    # is DEFINER, so its in-body org gate only scopes the caller when auth.uid() resolves.
    # Positional args map the migration-025 signature; @@/plainto_tsquery/ts_rank_cd resolve
    # under search_path='' (pg_catalog). Returns (id, document_id, content, chunk_index, rank).
    return await _call_as_user(
        user_id,
        """SELECT id::text AS id, document_id::text AS document_id, content, chunk_index, rank
           FROM public.keyword_search_chunks($1, $2, $3, $4, $5)""",
        query,
        user_id,
        top_n,
        metadata_filter if metadata_filter else None,
        folder_ids if folder_ids else None,
    )
