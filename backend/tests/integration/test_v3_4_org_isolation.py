"""Phase 164 (TEN-05 / TEN-03 / PRAG-01 / D-164-06) — the v3.4 cross-org isolation EXIT GATE.

The named milestone exit gate: a two-org adversarial, data-driven matrix that proves
"zero cross-org leakage" is a MEASURED property, not a claim. It extends the shipped
Phase-163 fixtures (``two_orgs_two_users`` + ``pg_pool``) and ``_rls_harness``
(``open_user_conn`` / ``assert_auth_uid`` / ``as_user_supabase_txn`` / ``requires_pg``)
into an exhaustive gate over:

  * every user-facing table (driven from ``information_schema``) — B reads 0 of A's rows,
    over BOTH DB paths (asyncpg ``open_user_conn`` + supabase-py ``as_user_supabase_txn``);
  * all four ``SECURITY DEFINER`` functions (``match_document_chunks`` /
    ``keyword_search_chunks`` / ``match_skills`` / ``folder_is_globally_visible``) —
    0 cross-org rows when called with a spoofed ``match_user_id``, + a pg_proc audit
    that each is DEFINER with a pinned ``search_path``;
  * an ``X-Org-Id`` header spoof that does NOT widen access (org derives from
    ``current_user_org_ids()`` membership, never a header — the header is inert in 164);
  * the text-to-SQL / grep INVOKER path (``public.query_user_documents``, D-164-04) —
    0 cross-org rows over the user-context connection, plus a non-user-context leak-conn
    RED-demonstration proving the CONNECTION swap (not the deleted ``_inject_user_id`` /
    ``_inject_user_id_for_grep`` regex) is the gate (RESEARCH Pitfall 4);
  * a PRAG-01 live-retrieval leg — B never receives A's PRIVATE chunk and receives A's
    SHARED-folder chunk only per the folder-ACL predicate; and the platform-universal /
    over-widening guards cloned from ``test_163_rls_platform_universal.py``.

STATE CONTRACT (mirrors the 163 leak files): the RED-ANCHOR
``test_definer_ignores_spoofed_match_user_id`` is provably RED against the PRE-164 DB —
the pre-164 ``match_document_chunks`` body filters ``dc.user_id = match_user_id`` (SECDEF,
bypassing RLS) so a spoofed ``match_user_id = A`` returns user A's real seeded chunk. It
goes GREEN only after Plan 03 applies migration 110 (in-body org gate keyed on
``auth.uid() = B``) AND Plan 04 lands the producer client-swap. A RED suite HERE is the
DESIGNED, CORRECT Wave-0 outcome — do NOT weaken the assertions to make it pass. For THIS
plan the authoring bar is: imports/fixtures resolve (``--collect-only`` exits 0), the
red-anchor is demonstrably RED, and the chunk fixture is non-vacuous.

Skip-guarded on the local Postgres :54322 via ``_rls_harness.requires_pg``.
"""
from __future__ import annotations

import json
from uuid import uuid4

import pytest
import pytest_asyncio

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

from app.dependencies import _apply_rls_user_context
from tests.integration._rls_harness import (
    as_user_supabase_txn,
    assert_auth_uid,
    open_user_conn,
    requires_pg,
)

pytestmark = requires_pg

# ── shared constants ────────────────────────────────────────────────────────────

# Live ``document_chunks.embedding`` column dimension (probed at author time:
# ``format_type`` → ``vector(1536)`` == text-embedding-3-small). The seed embedding +
# every query vector use this dim so the pgvector ``<=>`` operator does not error.
EMBED_DIM = 1536

# The four SECURITY DEFINER functions the phase audits (live signatures probed at author
# time). Pre-164 proconfig: match_document_chunks=NULL, keyword_search_chunks=NULL (both
# UN-pinned → RED for the search_path audit); match_skills='public, pg_temp',
# folder_is_globally_visible='public' (pinned → GREEN). Migration 110 pins all four.
_DEFINER_FUNCTIONS = (
    "match_document_chunks",
    "keyword_search_chunks",
    "match_skills",
    "folder_is_globally_visible",
)

# The built-in skill-creator's owner (migration 087 / 018) — the system principal that owns
# all is_system / seeded platform content (cloned from test_163_rls_platform_universal.py).
SYSTEM_SEED_UID = "00000000-0000-0000-0000-000000000001"

# SQLSTATE for "new row violates row-level security policy" (a WITH CHECK rejection).
_RLS_VIOLATION_SQLSTATE = "42501"


# ── vector + information_schema helpers ──────────────────────────────────────────

def _unit_vec_literal(hot: int = 0, dim: int = EMBED_DIM) -> str:
    """A pgvector literal ``'[1,0,0,...]'`` with a single hot component (unit vector).

    asyncpg registers NO vector codec on the test pool (only jsonb), so a vector arg MUST
    be passed as this literal string and cast ``$n::public.vector`` — exactly as PostgREST
    / supabase.rpc did implicitly (RESEARCH Pitfall 3). Using a UNIT vector (not a zero
    vector) is load-bearing: cosine distance ``v <=> v`` of a zero vector is NaN, and
    ``1 - NaN > threshold`` is false → the seed would never match → the red-anchor would
    FALSE-GREEN at 0 rows. Identical unit vectors give distance 0, similarity 1.
    """
    parts = ["0"] * dim
    parts[hot % dim] = "1"
    return "[" + ",".join(parts) + "]"


async def _table_exists(pool, table: str) -> bool:
    """information_schema probe (cloned from test_163_leak_asyncpg.py) — drive the matrix
    off live tables so a lean DB skips a missing table rather than erroring."""
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


# ── the non-vacuous chunk fixture (Task 1: private chunks; Task 3 extends w/ shared folder) ──

@pytest_asyncio.fixture
async def two_orgs_chunks_and_shared_folder(pg_pool, two_orgs_two_users):
    """EXTEND (never mutate) ``two_orgs_two_users``: seed each user exactly one PRIVATE
    ``document_chunks`` row referencing that user's seeded ``doc_id`` with a fixed unit
    embedding + the user's ``org_id`` (the mig-106 ``autofill_org_id_from_parent`` trigger
    no-ops when org_id is already set).

    Non-vacuity is load-bearing: without user A owning a REAL chunk, the red-anchor
    ``test_definer_ignores_spoofed_match_user_id`` would false-green at 0 rows. The augmented
    keys (``private_chunk_id``) are added to the fixture's dict view only — no shared DB row
    is mutated. FK-safe teardown deletes the chunks BEFORE the parent fixture tears down its
    documents (Task 3 appends the shared-folder rows to the same teardown list).
    """
    base = two_orgs_two_users
    created_chunk_ids: list = []
    for label in ("a", "b"):
        u = base[label]
        cid = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.document_chunks "
            "(id, document_id, user_id, org_id, content, chunk_index, embedding, "
            " embedding_model, embedding_dimensions) "
            "VALUES ($1, $2, $3, $4, $5, 0, $6::vector, 'text-embedding-3-small', $7)",
            cid, u["doc_id"], u["uid"], u["org_id"], f"164-{label}-secret-chunk",
            _unit_vec_literal(), EMBED_DIM,
        )
        u["private_chunk_id"] = str(cid)
        created_chunk_ids.append(cid)

    # A single teardown ledger children-first; Task 3 appends (table, id) rows here.
    teardown: list[tuple[str, object]] = [
        ("document_chunks", cid) for cid in created_chunk_ids
    ]
    base["_teardown"] = teardown

    try:
        yield base
    finally:
        for table, row_id in teardown:
            try:
                await pg_pool.execute(f"DELETE FROM public.{table} WHERE id = $1", row_id)
            except Exception:  # best-effort teardown — never fail a test on cleanup
                pass


# ── pg_proc DEFINER audit helper (RED pre-164 for the two un-pinned fns) ──────────

async def _assert_definer_pinned(pool, fn_name: str) -> None:
    """Assert ``public.<fn_name>`` is SECURITY DEFINER AND carries a pinned ``search_path``
    (``proconfig`` has a ``search_path=`` entry). Audits REAL live state: pre-164 the two
    un-pinned retrieval fns (match_document_chunks / keyword_search_chunks) FAIL here."""
    row = await pool.fetchrow(
        "SELECT prosecdef, proconfig FROM pg_proc "
        "WHERE proname = $1 AND pronamespace = 'public'::regnamespace",
        fn_name,
    )
    assert row is not None, f"function public.{fn_name} not found — signature drift?"
    assert row["prosecdef"] is True, (
        f"{fn_name} is not SECURITY DEFINER (prosecdef={row['prosecdef']!r}) — D-164-03 keeps "
        "all four DEFINER; the in-body org predicate + pinned search_path is the audit."
    )
    proconfig = row["proconfig"] or []
    assert any(c.startswith("search_path=") for c in proconfig), (
        f"{fn_name} has NO pinned search_path (proconfig={proconfig!r}) — the DEFINER "
        "search-path-hijack class (CVE-2018-1058) is open. RED pre-164 for "
        "match_document_chunks / keyword_search_chunks; migration 110 pins all four."
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("fn_name", _DEFINER_FUNCTIONS)
async def test_definer_secdef_and_search_path_pinned(pg_pool, fn_name):
    """Audit leg (``-k search_path``): each of the four functions is DEFINER + search_path
    pinned. RED pre-164 for the two currently-unpinned retrieval fns; GREEN post-110."""
    await _assert_definer_pinned(pg_pool, fn_name)


# ── THE RED-ANCHOR (D-164-06) — a spoofed match_user_id must NOT cross orgs ───────

@pytest.mark.asyncio
async def test_definer_ignores_spoofed_match_user_id(pg_pool, two_orgs_chunks_and_shared_folder):
    """RED pre-164 / GREEN post-164 — the killer assertion that proves the gate tests the
    NEW behavior, not a tautology.

    As user B (``auth.uid() = B``) call ``match_document_chunks`` with a spoofed
    ``match_user_id = A``. PRE-164 the body filters ``dc.user_id = match_user_id`` under
    SECDEF (bypassing RLS) → returns user A's REAL seeded chunk → RED (leak). POST-164 the
    in-body org gate keys on ``auth.uid() = B``'s memberships → 0 of A's cross-org chunks.
    """
    ctx = two_orgs_chunks_and_shared_folder
    a, b = ctx["a"], ctx["b"]
    async with open_user_conn(pg_pool, b["uid"]) as conn:
        # fail-loud preflight FIRST — a NULL auth.uid() would false-pass isolation at 0 rows.
        await assert_auth_uid(conn, b["uid"])
        rows = await conn.fetch(
            "SELECT id FROM public.match_document_chunks($1::public.vector, $2, 50, 0.0)",
            _unit_vec_literal(), a["uid"],  # spoofed match_user_id = A
        )
        assert len(rows) == 0, (
            "cross-org leak: DEFINER trusted the spoofed match_user_id — user B retrieved "
            f"user A's chunk(s) {[str(r['id']) for r in rows]} (their orgs are disjoint). "
            "RED pre-164; migration 110's in-body org gate (keyed on auth.uid()=B) turns it GREEN."
        )
