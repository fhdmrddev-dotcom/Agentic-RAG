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
from starlette.concurrency import run_in_threadpool

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

# The fixture seeds each user ONE owned row in these tables (id recorded) — so the matrix
# can run BOTH the positive control (viewer sees its OWN row == 1) and the isolation assert
# (0 of the other user's rows). Every OTHER user-facing table is isolation-only (owner-scoped
# ``WHERE user_id = A`` count == 0). Same representative set as test_163_leak_asyncpg.py.
_SEEDED_TABLES = (
    ("documents", "doc_id"),
    ("folders", "folder_id"),
    ("threads", "thread_id"),
    ("skills", "skill_id"),
)


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


# ══════════════════════════════════════════════════════════════════════════════════
# Task 2 — every-user-facing-table matrix (both DB paths) + all-four-DEFINER 0-cross-org
#          legs + X-Org-Id header-spoof rejection.
# ══════════════════════════════════════════════════════════════════════════════════


async def _owner_scoped_tables(pool) -> list[str]:
    """Every user-facing public table (data-driven from ``information_schema``): all tables
    carrying a ``user_id`` owner column. This is the ~35-table set the matrix iterates — NOT
    a hardcoded ~4-table list, so a new owned table is covered automatically."""
    rows = await pool.fetch(
        "SELECT table_name FROM information_schema.columns "
        "WHERE table_schema='public' AND column_name='user_id' "
        "ORDER BY table_name"
    )
    return [r["table_name"] for r in rows]


async def _sb_select_data(adapter, table: str, col: str, val: str) -> list:
    """Run ``.table(table).select('user_id').eq(col, val).execute()`` the way the app does —
    synchronously inside ``run_in_threadpool`` (supabase-py ``.execute()`` is sync; the
    adapter schedules its asyncpg coroutine back onto the running test loop). Returns
    ``.data`` (0-length == not visible under RLS). Mirrors test_163_leak_supabase.py."""
    def _call():
        return adapter.table(table).select("user_id").eq(col, val).execute()

    res = await run_in_threadpool(_call)
    return res.data


@pytest.mark.asyncio
async def test_table_matrix_asyncpg(pg_pool, two_orgs_two_users):
    """asyncpg path (``open_user_conn``): for EVERY user-facing table (information_schema-
    driven), user B reads 0 of user A's rows — fail-loud-preflighted, positive-controlled on
    the four fixture-seeded tables. GREEN pre-164 (163 shipped membership RLS) — this is the
    exit-gate invariant, re-run by the milestone after 166/167/168."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    tables = await _owner_scoped_tables(pg_pool)
    assert "documents" in tables and "skills" in tables, (
        "information_schema drove an empty/degenerate table set — the matrix would be vacuous"
    )
    seeded = dict(_SEEDED_TABLES)
    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])  # fail-loud FIRST
        for table in tables:
            if not await _table_exists(pg_pool, table):
                continue
            if table in seeded:
                # positive control — B sees its OWN row (guards a 0-for-everyone false-green).
                own = await conn.fetchval(
                    f"SELECT count(*) FROM public.{table} WHERE id = $1", b[seeded[table]]
                )
                assert own == 1, (
                    f"positive-control failure: user B cannot see its OWN {table} row — the "
                    "harness over-restricts (a 0-for-everyone bug would false-green isolation)."
                )
            leaked = await conn.fetchval(
                f"SELECT count(*) FROM public.{table} WHERE user_id = $1", a["uid"]
            )
            assert leaked == 0, (
                f"cross-org leak (asyncpg): user B reads {leaked} of user A's {table} rows "
                "(their orgs are disjoint)."
            )


@pytest.mark.asyncio
async def test_table_matrix_supabase(pg_pool, two_orgs_two_users):
    """supabase-py path (``as_user_supabase_txn`` → SupabaseTxnAdapter): the SECOND DB path of
    the matrix. Same every-table isolation via the PostgREST-shaped fluent surface, positive-
    controlled on the seeded tables — mirroring test_163_leak_supabase.py."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    tables = await _owner_scoped_tables(pg_pool)
    seeded = dict(_SEEDED_TABLES)
    async with as_user_supabase_txn(pg_pool, b["uid"]) as sb:
        for table in tables:
            if not await _table_exists(pg_pool, table):
                continue
            if table in seeded:
                own = await _sb_select_data(sb, table, "id", b[seeded[table]])
                assert len(own) == 1, (
                    f"positive-control failure (PostgREST path): user B cannot see its OWN "
                    f"{table} row — a NULL-uid / over-restricting bridge would false-green below."
                )
            leaked = await _sb_select_data(sb, table, "user_id", a["uid"])
            assert len(leaked) == 0, (
                f"cross-org leak (PostgREST path): user B reads {len(leaked)} of user A's "
                f"{table} rows."
            )


@pytest.mark.asyncio
@pytest.mark.parametrize("fn_name", _DEFINER_FUNCTIONS)
async def test_definer_zero_cross_org(pg_pool, two_orgs_chunks_and_shared_folder, fn_name):
    """Each of the four DEFINER functions returns 0 of user A's rows when called by user B
    with parameters that WOULD surface A's rows (spoofed ``match_user_id = A`` for the three
    retrieval fns; A's private folder for the fourth). RED pre-164 for the retrieval fns
    (they trust the param); GREEN post-110 (in-body org gate keyed on auth.uid()=B).

    NOTE on the supabase-py path for DEFINER fns: ``SupabaseTxnAdapter.rpc()`` is a
    RECORD-ONLY stub (it does not EXECUTE the RPC — see _reembed_adapter.py, deliberately so
    the re-embed resize call cannot wipe live vectors), so a supabase-path DEFINER assertion
    would be vacuous. DEFINER coverage is therefore over the asyncpg user-context here; the
    supabase-py DB path is proven by ``test_table_matrix_supabase`` above."""
    ctx = two_orgs_chunks_and_shared_folder
    a, b = ctx["a"], ctx["b"]
    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])  # fail-loud FIRST
        if fn_name == "match_document_chunks":
            rows = await conn.fetch(
                "SELECT id FROM public.match_document_chunks($1::public.vector, $2, 50, 0.0)",
                _unit_vec_literal(), a["uid"],
            )
            assert len(rows) == 0, (
                f"cross-org leak via {fn_name}: user B retrieved {len(rows)} of user A's chunks "
                "with a spoofed match_user_id."
            )
        elif fn_name == "keyword_search_chunks":
            rows = await conn.fetch(
                "SELECT id FROM public.keyword_search_chunks($1, $2, 50, NULL, NULL)",
                "secret", a["uid"],
            )
            assert len(rows) == 0, (
                f"cross-org leak via {fn_name}: user B got {len(rows)} of user A's keyword hits "
                "with a spoofed match_user_id (pre-164 the body returns only rows where "
                "user_id = the param)."
            )
        elif fn_name == "match_skills":
            rows = await conn.fetch(
                "SELECT id FROM public.match_skills($1::public.vector, $2, NULL)",
                _unit_vec_literal(), a["uid"],
            )
            ids = {str(r["id"]) for r in rows}
            assert a["skill_id"] not in ids, (
                f"cross-org leak via {fn_name}: user B retrieved user A's PRIVATE skill "
                f"{a['skill_id']} via a spoofed match_user_id (is_system/is_global platform "
                "content may legitimately appear; A's private skill must NOT)."
            )
        elif fn_name == "folder_is_globally_visible":
            visible = await conn.fetchval(
                "SELECT public.folder_is_globally_visible($1)", a["folder_id"]
            )
            assert visible is not True, (
                f"leak via {fn_name}: user A's PRIVATE folder {a['folder_id']} is reported "
                "globally visible — a non-global folder must resolve False (no cross-org widening)."
            )


@pytest.mark.asyncio
async def test_org_header_spoof_does_not_widen(pg_pool, two_orgs_two_users):
    """X-Org-Id header-spoof leg (``-k org_header_spoof``).

    Grep at author time (2026-07-20) found NO reader of ``X-Org-Id`` / ``x_org_id`` anywhere
    in ``backend/`` or the repo (RESEARCH Open Q3) — the header is INERT in 164; validated
    single-active-org narrowing lands in Phase 166 (``<OrgContext>`` switcher). There is thus
    no DB seam that consults a header: org can ONLY derive from membership via
    ``current_user_org_ids()``. This leg proves that property directly — as user B, B's org
    set is exactly B's memberships (A's org absent) and a B-scoped read returns 0 of A's rows;
    a spoofed header could change neither, because nothing reads it. HAND-OFF: re-point this
    leg at the real header seam once Phase 166 adds validated narrowing."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])  # fail-loud FIRST
        org_rows = await conn.fetch(
            "SELECT public.current_user_org_ids() AS org_id"
        )
        org_ids = {str(r["org_id"]) for r in org_rows}
        assert b["org_id"] in org_ids, (
            "B's own org is missing from current_user_org_ids() — membership resolution broke; "
            "the isolation assertion below would false-green."
        )
        assert a["org_id"] not in org_ids, (
            "membership widened: user A's org appears in user B's current_user_org_ids() — the "
            "org set must derive ONLY from B's memberships, never a (spoofable) header."
        )
        leaked = await conn.fetchval(
            "SELECT count(*) FROM public.documents WHERE user_id = $1", a["uid"]
        )
        assert leaked == 0, (
            "cross-org leak: a B-scoped read surfaced user A's rows — a spoofed X-Org-Id header "
            "cannot widen access because the DB derives org from current_user_org_ids(), never "
            "the header."
        )
