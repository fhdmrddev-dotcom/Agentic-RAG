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

    # Teardown ledger, children-first: private chunks first, then the shared-folder rows
    # (shared_chunk → shared_doc → shared_folder) so FK order holds on cleanup.
    teardown: list[tuple[str, object]] = [
        ("document_chunks", cid) for cid in created_chunk_ids
    ]

    # ── SHARED-FOLDER scenario for user A (PRAG-01): an is_global folder owned by A + a
    #    document inside it + one document_chunk — so the PRAG-01 leg can distinguish A's
    #    PRIVATE chunk from A's SHARED-folder chunk. (folder_is_globally_visible walks
    #    ancestors on is_global, so a top-level is_global folder resolves True.)
    a = base["a"]
    shared_folder_id = uuid4()
    shared_doc_id = uuid4()
    shared_chunk_id = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.folders (id, user_id, org_id, name, is_global) "
        "VALUES ($1, $2, $3, $4, true)",
        shared_folder_id, a["uid"], a["org_id"], f"164-a-shared-folder-{shared_folder_id}",
    )
    await pg_pool.execute(
        "INSERT INTO public.documents "
        "(id, user_id, org_id, folder_id, filename, file_path, file_size, mime_type, "
        " status, is_latest, version_number) "
        "VALUES ($1, $2, $3, $4, $5, $6, 100, 'text/plain', 'completed', true, 1)",
        shared_doc_id, a["uid"], a["org_id"], shared_folder_id,
        f"164-a-shared-{shared_doc_id}.txt", f"{a['uid']}/{shared_doc_id}.txt",
    )
    await pg_pool.execute(
        "INSERT INTO public.document_chunks "
        "(id, document_id, user_id, org_id, content, chunk_index, embedding, "
        " embedding_model, embedding_dimensions) "
        "VALUES ($1, $2, $3, $4, $5, 0, $6::vector, 'text-embedding-3-small', $7)",
        shared_chunk_id, shared_doc_id, a["uid"], a["org_id"], "164-a-shared-chunk",
        _unit_vec_literal(), EMBED_DIM,
    )
    a["shared_folder_id"] = str(shared_folder_id)
    a["shared_doc_id"] = str(shared_doc_id)
    a["shared_chunk_id"] = str(shared_chunk_id)
    teardown += [
        ("document_chunks", shared_chunk_id),
        ("documents", shared_doc_id),
        ("folders", shared_folder_id),
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
        # The property is "0 of A's cross-org chunks" — NOT "0 rows total": post-164 B
        # legitimately retrieves its OWN matching chunk (same unit embedding), because the
        # in-body gate keys on auth.uid()=B (mirrors the test_prag01_retrieval_isolation +
        # match_skills assertion style — a specific-A-chunk-absence check, not a raw count).
        leaked = {str(r["id"]) for r in rows} & {a["private_chunk_id"], a["shared_chunk_id"]}
        assert not leaked, (
            "cross-org leak: DEFINER trusted the spoofed match_user_id — user B retrieved "
            f"user A's chunk(s) {leaked} (their orgs are disjoint). "
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
            # A's-chunk-absence, NOT a raw count: post-164 B's OWN matching chunk may
            # legitimately appear (org gate keys on auth.uid()=B). Only A's disjoint-org
            # chunks must be absent (same style as the match_skills leg below).
            leaked = {str(r["id"]) for r in rows} & {a["private_chunk_id"], a["shared_chunk_id"]}
            assert not leaked, (
                f"cross-org leak via {fn_name}: user B retrieved user A's chunk(s) {leaked} "
                "with a spoofed match_user_id (B's OWN matching chunk may legitimately appear)."
            )
        elif fn_name == "keyword_search_chunks":
            rows = await conn.fetch(
                "SELECT id FROM public.keyword_search_chunks($1, $2, 50, NULL, NULL)",
                "secret", a["uid"],
            )
            leaked = {str(r["id"]) for r in rows} & {a["private_chunk_id"], a["shared_chunk_id"]}
            assert not leaked, (
                f"cross-org leak via {fn_name}: user B got user A's keyword hit(s) {leaked} "
                "with a spoofed match_user_id (B's OWN 'secret' chunk may legitimately appear; "
                "pre-164 the body returned only rows where user_id = the param)."
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


# ══════════════════════════════════════════════════════════════════════════════════
# Task 3 — text-to-SQL / grep cross-org leg (query_user_documents, D-164-04) + PRAG-01
#          live-retrieval isolation + platform-universal / over-widening guards.
# ══════════════════════════════════════════════════════════════════════════════════


def _extract_a_rows(data, a_uid: str) -> list:
    """Filter a ``query_user_documents`` jsonb result (a list of row dicts) to rows OWNED by
    user A. The pg_pool jsonb codec decodes the result to Python objects, so ``user_id`` is a
    string; compare against A's uid."""
    return [r for r in (data or []) if str(r.get("user_id")) == str(a_uid)]


@pytest.mark.asyncio
async def test_text_to_sql_query_user_documents_isolation(pg_pool, two_orgs_chunks_and_shared_folder):
    """D-164-04 / RESEARCH Pitfall 4 — the single highest-risk regression this phase carries.

    ``public.query_user_documents(sql_query)`` is INVOKER (no SECURITY clause) — it EXECUTEs
    the arbitrary text-to-SQL under the CALLER'S role. Plan 04 DELETES the ``_inject_user_id``
    regex, leaving the user-context CONNECTION as the ONLY scope. This leg arbitrates that the
    CONNECTION identity — not the deleted regex, not the param — is the gate:

      * USER-CONTEXT (``open_user_conn`` as B, role authenticated, RLS enforced): a crafted
        cross-org SELECT that WOULD surface A's rows returns 0 A-owned rows. GREEN (documents
        RLS shipped in 163; the connection identity scopes the arbitrary query).
      * LEAK-CONN (a plain ``pg_pool.acquire()`` — role postgres / BYPASSRLS, NO
        ``_apply_rls_user_context``): the SAME crafted SELECT DOES return A's rows (> 0). This
        is the "regex deleted BUT connection not user-context" leak state (Pitfall 4) — the
        checkout Plan 04 must NOT ship. It proves the connection is the arbiter.
    """
    ctx = two_orgs_chunks_and_shared_folder
    a, b = ctx["a"], ctx["b"]
    # A crafted cross-org SELECT (SELECT-only, no semicolon — passes query_user_documents' guard).
    crafted = f"select id, user_id from documents where user_id = '{a['uid']}'"

    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])  # fail-loud FIRST
        data = await conn.fetchval("SELECT public.query_user_documents($1)", crafted)
        a_rows = _extract_a_rows(data, a["uid"])
        assert len(a_rows) == 0, (
            "cross-org leak (text-to-SQL, user-context): B's crafted query_user_documents SELECT "
            f"surfaced {len(a_rows)} of user A's documents — RLS under the authenticated role "
            "must scope the arbitrary query to B's org."
        )

    # LEAK-CONN RED-demonstration — a NON-user-context connection (role postgres, BYPASSRLS)
    # runs the identical crafted SELECT and LEAKS A's rows. NOT a user conn → no assert_auth_uid.
    async with pg_pool.acquire() as leak_conn:
        data = await leak_conn.fetchval("SELECT public.query_user_documents($1)", crafted)
        a_rows = _extract_a_rows(data, a["uid"])
        assert len(a_rows) > 0, (
            "leak-conn demonstration is VACUOUS: query_user_documents over a NON-user-context "
            "connection did NOT surface user A's rows. The connection identity (not the deleted "
            "regex) is the gate (Pitfall 4) — if this fails, A owns no documents or the pool "
            "connection unexpectedly enforced RLS."
        )


@pytest.mark.asyncio
async def test_text_to_sql_grep_path_isolation(pg_pool, two_orgs_chunks_and_shared_folder):
    """The grep SUCCESSOR path (``kb.grep_path`` → ``_inject_user_id_for_grep``, DELETED in
    Plan 04) — the SAME ``public.query_user_documents`` INVOKER RPC with a pattern-match SELECT
    (the shape grep builds). Identical arbitration to the text-to-SQL leg: user-context → 0
    A-rows; leak-conn → A's rows leak. Both matched by ``-k text_to_sql``; Plan 04 Task 3's
    ``-k "text_to_sql" -x`` verify runs both."""
    ctx = two_orgs_chunks_and_shared_folder
    a, b = ctx["a"], ctx["b"]
    # A grep-shaped content pattern-match over A's chunks (private "164-a-secret-chunk" +
    # shared "164-a-shared-chunk" both match '%164-a-%').
    grep_sql = "select user_id, content from document_chunks where content ilike '%164-a-%'"

    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])  # fail-loud FIRST
        data = await conn.fetchval("SELECT public.query_user_documents($1)", grep_sql)
        a_rows = _extract_a_rows(data, a["uid"])
        assert len(a_rows) == 0, (
            "cross-org leak (grep path, user-context): B's crafted grep-shaped SELECT surfaced "
            f"{len(a_rows)} of user A's chunks — RLS under the authenticated role must scope it."
        )

    async with pg_pool.acquire() as leak_conn:
        data = await leak_conn.fetchval("SELECT public.query_user_documents($1)", grep_sql)
        a_rows = _extract_a_rows(data, a["uid"])
        assert len(a_rows) > 0, (
            "leak-conn demonstration is VACUOUS: the grep-shaped query_user_documents over a "
            "NON-user-context connection did NOT surface user A's chunks — the connection "
            "identity is the gate (Pitfall 4)."
        )


@pytest.mark.asyncio
async def test_prag01_retrieval_isolation(pg_pool, two_orgs_chunks_and_shared_folder):
    """PRAG-01 live retrieval isolation (``-k prag01_retrieval``) — org- AND folder-ACL scoping.

    As user B over the asyncpg user-context, retrieval via ``match_document_chunks`` must:
      * POSITIVE CONTROL — return B's OWN chunk (the query works; not 0-for-everyone).
      * NEVER return A's PRIVATE chunk (org isolation — GREEN pre + post).
      * NEVER return A's SHARED-folder chunk cross-org either. The folder-ACL branch
        (``folder_is_globally_visible``) lives INSIDE the org gate, so a DISJOINT-org reader
        gets 0 — user is_global folder content stays org-scoped until orgs gain members
        (163-UAT Test-7 symptom two; the co-member POSITIVE folder-ACL proof is a Phase
        166/167 forward gate, where the shared fixture's two-DISJOINT-org topology is replaced
        by a co-member).

    RED pre-164 / GREEN post-110 via the SPOOFED ``match_user_id = A``: pre-164 the SECDEF body
    filters ``dc.user_id = match_user_id`` and returns BOTH of A's chunks (leak); post-110 the
    in-body org gate keys on ``auth.uid() = B`` → 0. The positive control is GREEN in both."""
    ctx = two_orgs_chunks_and_shared_folder
    a, b = ctx["a"], ctx["b"]
    async with open_user_conn(pg_pool, b["uid"]) as conn:
        await assert_auth_uid(conn, b["uid"])  # fail-loud FIRST
        # positive control — B retrieves its OWN chunk (non-vacuity; the query is live).
        own = await conn.fetch(
            "SELECT id FROM public.match_document_chunks($1::public.vector, $2, 100, 0.0)",
            _unit_vec_literal(), b["uid"],
        )
        own_ids = {str(r["id"]) for r in own}
        assert b["private_chunk_id"] in own_ids, (
            "positive-control failure: user B cannot retrieve its OWN chunk — retrieval is "
            "0-for-everyone, which would false-green the isolation assertions below."
        )
        # adversarial — spoof match_user_id = A. B must receive NEITHER A's PRIVATE nor A's
        # SHARED-folder chunk (org gate blocks both cross-org; folder-ACL does not widen).
        leaked = await conn.fetch(
            "SELECT id FROM public.match_document_chunks($1::public.vector, $2, 100, 0.0)",
            _unit_vec_literal(), a["uid"],
        )
        leaked_ids = {str(r["id"]) for r in leaked}
        assert a["private_chunk_id"] not in leaked_ids, (
            "PRAG-01 leak: user B retrieved user A's PRIVATE chunk (cross-org)."
        )
        assert a["shared_chunk_id"] not in leaked_ids, (
            "PRAG-01 leak: user B retrieved user A's SHARED-folder chunk cross-org — user "
            "is_global folder content stays org-scoped (the folder-ACL branch lives INSIDE the "
            "org gate); a disjoint-org reader must get 0. RED pre-164, GREEN post-110."
        )


# ── platform-universal + over-widening guards (clone test_163_rls_platform_universal) ──

async def _ensure_system_seed_user(pool) -> None:
    """Ensure the system seed user exists so an is_system seed satisfies skills.user_id FK.
    Idempotent; normally already present from migration 087. NEVER torn down (shared principal)."""
    await pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
        SYSTEM_SEED_UID, "seed@system.local",
    )


async def _seed_system_skill(pool, org_id: str) -> str:
    """Seed an is_system=true skill owned by the system seed in ``org_id`` (mirrors the real
    skill-creator: is_system=true + is_global=true). org_id explicit → mig-106 autofill no-ops."""
    sid = uuid4()
    await pool.execute(
        "INSERT INTO public.skills (id, user_id, org_id, name, is_system, is_global) "
        "VALUES ($1, $2, $3, $4, true, true)",
        sid, SYSTEM_SEED_UID, org_id, f"164-systemskill-{sid}",
    )
    return str(sid)


async def _cleanup(pool, sql: str, arg) -> None:
    try:
        await pool.execute(sql, arg)
    except Exception:  # best-effort teardown — never fail a test on cleanup
        pass


@pytest.mark.asyncio
async def test_is_system_stays_universal(pg_pool, two_orgs_two_users):
    """Platform-universal READ via ``match_skills`` — a non-co-member (disjoint org) SEES an
    ``is_system=true`` built-in skill. Guards the mig-109 FIX-A / 163-UAT Test-7 regression:
    is_system platform content must stay OUTSIDE the org gate (universal), else the built-in
    skill-creator vanishes for everyone but the seed org."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    await _ensure_system_seed_user(pg_pool)
    sys_skill = await _seed_system_skill(pg_pool, a["org_id"])  # in org X; B is a non-co-member
    try:
        async with open_user_conn(pg_pool, b["uid"]) as conn:
            await assert_auth_uid(conn, b["uid"])  # fail-loud FIRST
            rows = await conn.fetch(
                "SELECT id FROM public.match_skills($1::public.vector, $2, NULL)",
                _unit_vec_literal(), b["uid"],
            )
        ids = {str(r["id"]) for r in rows}
        assert sys_skill in ids, (
            "FIX-A regression (163-UAT Test 7): the is_system built-in skill-creator is invisible "
            "to a non-co-member via match_skills — is_system must stay OUTSIDE the org gate "
            "(universal). Migration 110 must preserve the mig-109 is_system escape."
        )
    finally:
        await _cleanup(pg_pool, "DELETE FROM public.skills WHERE id = $1", sys_skill)


@pytest.mark.asyncio
async def test_user_is_global_stays_org_scoped(pg_pool, two_orgs_two_users):
    """Over-widening guard via ``match_skills`` — a user's OWN is_global skill (owner-toggled,
    org-shared) must NOT leak to a non-co-member. Only is_system (platform) escapes the org
    gate; user-self-served is_global stays org-scoped until orgs gain members (166/167).

    RED pre-164 (match_skills has no org gate → the ``s.is_global = true`` branch leaks A's
    skill cross-org) / GREEN post-110 (org gate → A's skill excluded for a disjoint-org B)."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    own_global = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.skills (id, user_id, org_id, name, is_global) "
        "VALUES ($1, $2, $3, $4, true)",
        own_global, a["uid"], a["org_id"], f"164-ownglobal-{own_global}",
    )
    try:
        async with open_user_conn(pg_pool, b["uid"]) as conn:
            await assert_auth_uid(conn, b["uid"])  # fail-loud FIRST
            rows = await conn.fetch(
                "SELECT id FROM public.match_skills($1::public.vector, $2, NULL)",
                _unit_vec_literal(), b["uid"],
            )
        ids = {str(r["id"]) for r in rows}
        assert str(own_global) not in ids, (
            "over-widening: user A's ORG-scoped is_global skill leaked to a non-co-member via "
            "match_skills — only is_system (platform) escapes the org gate; user is_global stays "
            "org-scoped until orgs gain members (166/167). RED pre-164, GREEN post-110."
        )
    finally:
        await _cleanup(pg_pool, "DELETE FROM public.skills WHERE id = $1", str(own_global))


@pytest.mark.asyncio
async def test_badge_spoof_blocked(pg_pool, two_orgs_two_users):
    """Badge-spoof (T-163-11, mig 109 WITH-CHECK) — an authenticated user self-setting
    ``is_system=true`` on INSERT is REJECTED (SQLSTATE 42501). GREEN (109 applied); the audit
    re-asserts the write check survives the 110 re-CREATE surface. Rolled back regardless."""
    a = two_orgs_two_users["a"]
    spoof = uuid4()
    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            await _apply_rls_user_context(conn, a["uid"])
            await assert_auth_uid(conn, a["uid"])  # fail-loud FIRST
            with pytest.raises(asyncpg.PostgresError) as exc:
                await conn.execute(
                    "INSERT INTO public.skills (id, user_id, org_id, name, is_system) "
                    "VALUES ($1, $2, $3, $4, true)",
                    spoof, a["uid"], a["org_id"], f"164-spoof-{spoof}",
                )
            assert exc.value.sqlstate == _RLS_VIOLATION_SQLSTATE, (
                f"expected an RLS write-check violation ({_RLS_VIOLATION_SQLSTATE}), got "
                f"{exc.value.sqlstate!r}. An authenticated user self-setting is_system=true must "
                "be REJECTED (T-163-11 badge-spoof; mig-109 WITH-CHECK)."
            )
        finally:
            await tx.rollback()


# ══════════════════════════════════════════════════════════════════════════════════
# 164-05 Task 1 — WR-02: `_inject_folder_scope` must splice the folder filter into the
#          WHERE BEFORE any trailing ORDER BY / GROUP BY / HAVING / LIMIT / OFFSET
#          (a valid-SQL regression after 164-04 deleted `_inject_user_id`'s WHERE
#          normalization). Pure-string unit legs — matched by `-k folder_scope`.
# ══════════════════════════════════════════════════════════════════════════════════

# A single deterministic folder id — the exact value the helper interpolates (no uppercase,
# so `.lower()` comparisons in the asserts stay faithful to the emitted SQL).
_FOLDER_SCOPE_IDS = ["11111111-1111-1111-1111-111111111111"]


def test_folder_scope_condition_precedes_order_by_and_limit():
    """WR-02: a no-WHERE query with a trailing ORDER BY / LIMIT gets a fresh
    ``WHERE documents.folder_id IN (...)`` inserted BEFORE the ORDER BY — pre-164-05 it was
    appended after LIMIT (``... ORDER BY x LIMIT n WHERE ...`` → invalid SQL)."""
    from app.services.sql_service import _inject_folder_scope

    out = _inject_folder_scope(
        "SELECT * FROM documents ORDER BY created_at LIMIT 5", _FOLDER_SCOPE_IDS
    )
    low = out.lower()
    assert "documents.folder_id in (" in low, f"folder filter missing entirely: {out!r}"
    # the folder condition must sit BEFORE the ORDER BY (valid WHERE placement)
    assert low.index("folder_id in (") < low.index("order by"), (
        f"WR-02 regression: folder filter landed AFTER ORDER BY → invalid SQL: {out!r}"
    )
    # trailing clauses keep their original order and no WHERE appears after ORDER BY
    assert low.index("order by") < low.index("limit"), f"trailing clauses reordered: {out!r}"
    assert "order by created_at where" not in low, f"WHERE after ORDER BY (invalid): {out!r}"


def test_folder_scope_where_and_precedes_limit():
    """WR-02: an existing WHERE + trailing LIMIT gets ``AND documents.folder_id IN (...)``
    spliced into the WHERE (before LIMIT), not appended after LIMIT."""
    from app.services.sql_service import _inject_folder_scope

    out = _inject_folder_scope(
        "SELECT * FROM documents WHERE title = 'x' LIMIT 3", _FOLDER_SCOPE_IDS
    )
    low = out.lower()
    assert " and documents.folder_id in (" in low, f"expected AND-splice onto WHERE, got {out!r}"
    assert low.index("folder_id in (") < low.index("limit"), (
        f"WR-02 regression: folder filter landed AFTER LIMIT → invalid SQL: {out!r}"
    )
    # the LLM's own predicate survives verbatim
    assert "title = 'x'" in out, f"original WHERE predicate dropped: {out!r}"


def test_folder_scope_no_tail_appends_where():
    """No-tail regression guard: a bare SELECT with no trailing clause still gets a trailing
    `` WHERE documents.folder_id IN (...)`` (the pre-existing happy path is unchanged)."""
    from app.services.sql_service import _inject_folder_scope

    out = _inject_folder_scope("SELECT * FROM documents", _FOLDER_SCOPE_IDS)
    expected_tail = f"WHERE documents.folder_id IN ('{_FOLDER_SCOPE_IDS[0]}')"
    assert out.rstrip().endswith(expected_tail), f"expected trailing {expected_tail!r}, got {out!r}"


def test_folder_scope_group_by_having_placement():
    """WR-02: with a GROUP BY (+ HAVING) tail, the condition splices before the FIRST trailing
    clause (GROUP BY) — GROUP BY / HAVING keep their order and stay valid SQL."""
    from app.services.sql_service import _inject_folder_scope

    out = _inject_folder_scope(
        "SELECT folder_id, count(*) FROM documents GROUP BY folder_id HAVING count(*) > 1",
        _FOLDER_SCOPE_IDS,
    )
    low = out.lower()
    assert low.index("documents.folder_id in (") < low.index("group by"), (
        f"WR-02 regression: folder filter landed at/after GROUP BY: {out!r}"
    )
    assert low.index("group by") < low.index("having"), f"GROUP BY / HAVING reordered: {out!r}"
