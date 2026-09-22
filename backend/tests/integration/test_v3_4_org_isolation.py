"""Phase 164 (TEN-05 / TEN-03 / PRAG-01 / D-164-06) — the v3.4 cross-org isolation EXIT GATE.

The named milestone exit gate: a two-org adversarial, data-driven matrix that proves
"zero cross-org leakage" is a MEASURED property, not a claim. It extends the shipped
Phase-163 fixtures (``two_orgs_two_users`` + ``pg_pool``) and ``_rls_harness``
(``open_user_conn`` / ``assert_auth_uid`` / ``as_user_supabase_txn`` / ``requires_pg``)
into an exhaustive gate over:

  * every user-facing table (driven from ``information_schema``) — B reads 0 of A's rows,
    over BOTH DB paths (asyncpg ``open_user_conn`` + supabase-py ``as_user_supabase_txn``);
  * all four ``SECURITY DEFINER`` functions (``match_document_chunks`` /
    ``keyword_search_chunks`` / ``match_skills`` / ``folder_is_org_shared``) —
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
# folder_is_org_shared='public' (pinned → GREEN). Migration 110 pins all four.
# (the folder DEFINER fn was OID-preservingly renamed → folder_is_org_shared by mig 111.)
_DEFINER_FUNCTIONS = (
    "match_document_chunks",
    "keyword_search_chunks",
    "match_skills",
    "folder_is_org_shared",
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

    # ── SHARED-FOLDER scenario for user A (PRAG-01): an is_org_shared folder owned by A + a
    #    document inside it + one document_chunk — so the PRAG-01 leg can distinguish A's
    #    PRIVATE chunk from A's SHARED-folder chunk. (folder_is_org_shared walks
    #    ancestors on is_org_shared, so a top-level is_org_shared folder resolves True.)
    a = base["a"]
    shared_folder_id = uuid4()
    shared_doc_id = uuid4()
    shared_chunk_id = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.folders (id, user_id, org_id, name, is_org_shared) "
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
                f"{a['skill_id']} via a spoofed match_user_id (is_system/is_org_shared platform "
                "content may legitimately appear; A's private skill must NOT)."
            )
        elif fn_name == "folder_is_org_shared":
            visible = await conn.fetchval(
                "SELECT public.folder_is_org_shared($1)", a["folder_id"]
            )
            assert visible is not True, (
                f"leak via {fn_name}: user A's PRIVATE folder {a['folder_id']} is reported "
                "org-shared — a non-shared folder must resolve False (no cross-org widening)."
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
        (``folder_is_org_shared``) lives INSIDE the org gate, so a DISJOINT-org reader
        gets 0 — user is_org_shared folder content stays org-scoped until orgs gain members
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
            "is_org_shared folder content stays org-scoped (the folder-ACL branch lives INSIDE the "
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
    skill-creator: is_system=true + is_org_shared=true). org_id explicit → mig-106 autofill no-ops."""
    sid = uuid4()
    await pool.execute(
        "INSERT INTO public.skills (id, user_id, org_id, name, is_system, is_org_shared) "
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
async def test_user_is_org_shared_stays_org_scoped(pg_pool, two_orgs_two_users):
    """Over-widening guard via ``match_skills`` — a user's OWN is_org_shared skill (owner-toggled,
    org-shared) must NOT leak to a non-co-member. Only is_system (platform) escapes the org
    gate; user-self-served is_org_shared stays org-scoped until orgs gain members (166/167).

    RED pre-164 (match_skills has no org gate → the ``s.is_org_shared = true`` branch leaks A's
    skill cross-org) / GREEN post-110 (org gate → A's skill excluded for a disjoint-org B)."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    own_global = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.skills (id, user_id, org_id, name, is_org_shared) "
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
            "over-widening: user A's ORG-scoped is_org_shared skill leaked to a non-co-member via "
            "match_skills — only is_system (platform) escapes the org gate; user is_org_shared stays "
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


# ══════════════════════════════════════════════════════════════════════════════════
# CLOSED by Phase 165 (SEED-124 / CR-01) — the cross-org KB browse-tool leak is fixed.
#          The agent's KB browse/read tools (ls / tree / glob / read_document) run on the
#          service-role BYPASSRLS client and resolve folder visibility through
#          `folder_utils.py`. Plan 165-02 org-scoped those helpers (fail-closed caller-org
#          resolution from `org_members`), so a disjoint-org user's agent no longer sees
#          another org's org-shared folders + documents cross-org. Migration 108 (RLS) +
#          migration 110 (DEFINER) org-scope every OTHER path; migration 111's semantic-split
#          rename (-> is_org_shared / is_system_global) + 165-02 closed this last
#          service-role Python outlier.
#
#          The former strict expected-failure marker (which tracked the known-open state) is
#          REMOVED: the two-org live drive below now stands as a normal passing regression
#          assertion — the SC#4 arbiter that the leak is closed (proven live against the real
#          service-role client via the XPASS→removal flip).
# ══════════════════════════════════════════════════════════════════════════════════


def _read_local_supabase_env():
    """Parse ``SUPABASE_URL`` + ``SUPABASE_SERVICE_ROLE_KEY`` straight from ``backend/.env``.

    The root ``conftest.py`` sets ``os.environ.setdefault("SUPABASE_URL",
    "https://test.supabase.co")`` at import time, so ``settings.supabase_url`` /
    ``get_supabase()`` point at an unreachable MOCK host under pytest. Reading the real local
    URL from the ``.env`` file (mirrors ``test_115_tool_global_leak._read_local_supabase_env``)
    gives the genuine ``http://127.0.0.1:54321`` service-role gate the agent tool path uses."""
    import os  # noqa: PLC0415

    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if not os.path.exists(env_path):
        return None
    url = key = None
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k == "SUPABASE_URL":
                    url = v
                elif k == "SUPABASE_SERVICE_ROLE_KEY":
                    key = v
    except OSError:
        return None
    if not url or not key:
        return None
    return url, key


def _service_role_supabase_or_skip():
    """The REAL service-role (BYPASSRLS) client the agent producer injects into the KB tool
    path (``ctx.supabase = get_supabase()`` on the ``send_message`` seam) — built against the
    LOCAL Supabase from ``backend/.env`` (see ``_read_local_supabase_env``, since the root
    conftest pollutes ``SUPABASE_URL`` with a mock host). Probe the REST gate; skip cleanly if
    it is unreachable so this leg is XFAIL when the leak is exercisable and SKIP when the stack
    is down — never a spurious ERROR."""
    creds = _read_local_supabase_env()
    if creds is None:
        pytest.skip("local SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in backend/.env")
    url, key = creds
    try:
        from supabase import create_client  # noqa: PLC0415

        client = create_client(url, key)
        client.table("folders").select("id").limit(1).execute()  # probe the gate the helper hits
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"service-role Supabase REST gate unreachable: {type(e).__name__}: {e}")
    return client


@pytest.mark.asyncio
async def test_browse_tools_cross_org_isolation_seed124_closed(
    pg_pool, two_orgs_chunks_and_shared_folder
):
    """CLOSED by Phase 165 (SEED-124 / CR-01) — the agent's KB browse/read tools no longer
    leak cross-org. This is the SC#4 arbiter: a normal passing assertion driven LIVE against
    the real service-role client (not code inspection).

    The fixture seeds an ``is_org_shared`` folder + document owned by user A (org X). This leg
    drives the REAL service-role folder-visibility helper
    (``folder_utils.get_globally_visible_folder_ids`` — the exact function ``read_path`` /
    ``ls_path`` / ``tree_path`` call on the BYPASSRLS client) as user B (org Y, disjoint) and
    asserts B does NOT see A's ``is_org_shared`` folder. Plan 165-02 org-scoped the helper
    (fail-closed caller-org resolution from ``org_members``), so B — a disjoint-org caller —
    resolves 0 of A's shared folders and the assertion PASSES. Formerly a strict
    expected-failure marker while the leak was open; the marker was removed once 165-02 closed
    the leak (the test XPASSed → the strict expected-failure FAILed → forcing the flip to this
    normal passing regression test)."""
    from app.utils.folder_utils import get_globally_visible_folder_ids

    ctx = two_orgs_chunks_and_shared_folder
    a, b = ctx["a"], ctx["b"]
    sb = _service_role_supabase_or_skip()

    # Service-role browse path exactly as the KB read/ls/tree tools invoke it (now org-scoped).
    visible_ids = {str(fid) for fid in await get_globally_visible_folder_ids(sb, b["uid"])}

    assert a["shared_folder_id"] not in visible_ids, (
        "CR-01 cross-org leak: user B (org Y) sees user A's (org X) org-shared folder "
        f"{a['shared_folder_id']} via the service-role folder-visibility helper — the KB "
        "browse/read tools bypass the membership org gate that RLS/DEFINER enforce everywhere "
        "else. Closed by Phase 165 (SEED-124 / 165-02 org-scoped folder_utils.py)."
    )


# ══════════════════════════════════════════════════════════════════════════════════
# SEED-125 (CR-01 / CR-02) — the SKILLS-domain sibling of the SEED-124 folder leak.
#   The agent's load_skill / read_skill_file / execute_code(skill-file injection) /
#   save_skill(sibling-lint) tools resolve skills on the BYPASSRLS service-role producer
#   client, so the membership org gate never applied — a disjoint-org caller could load
#   another org's is_org_shared skill instructions + pull its bundled file bytes. The fix
#   org-gates all six resolution sites via one shared
#   ``tool_dispatcher._resolve_skill_visibility_or`` (is_system universal escape PRESERVED,
#   fail-closed on an empty org set). These legs drive the REAL handlers against the REAL
#   service-role client (not code inspection — the D-102/D-110-5 "static would false-green"
#   lesson), mirroring the SEED-124 SC#4 arbiter + the test_115_tool_global_leak two-caller
#   pattern. CR-02 (the storage-read sibling) is a separate xfail-until-mig-112 leg below.
# ══════════════════════════════════════════════════════════════════════════════════


def _make_seed125_tool_ctx(sb, caller_uid: str):
    """Minimal REAL ToolContext that drives the skill handlers as ``caller_uid`` on the REAL
    service-role client ``sb`` (the exact ``ctx.supabase = get_supabase()`` producer seam).
    ``emit`` is a no-op AsyncMock; ``spawn`` closes the write_audit_entry coroutine so it is
    never left un-awaited and never writes (mirrors test_load_skill_collision._make_ctx)."""
    from unittest.mock import AsyncMock  # noqa: PLC0415

    from app.services.tool_dispatcher import ToolContext  # noqa: PLC0415

    return ToolContext(
        redis=None,
        run_id=uuid4(),
        thread_id="seed125-thread",
        supabase=sb,
        pool=None,
        user_settings=None,
        current_user={"id": caller_uid},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(return_value=None),
        spawn=lambda c: c.close(),
    )


async def _seed_org_shared_skill(pool, owner_uid: str, org_id: str) -> tuple[str, str, str]:
    """Seed an is_org_shared (owner-toggled, NOT is_system) skill owned by ``owner_uid`` in
    ``org_id`` + one bundled skill_files row. Returns (skill_id, skill_name, instructions_body).
    org_id explicit → the mig-106 autofill trigger no-ops; the skill_files row cascade-deletes
    with the skill (ON DELETE CASCADE), so the two_orgs fixture's DELETE-by-user_id teardown
    (owner == user A) cleans everything up."""
    sid = uuid4()
    name = f"seed125-shared-{sid}"
    body = f"SEED-125 org-A PRIVATE instructions {sid}"
    await pool.execute(
        "INSERT INTO public.skills "
        "(id, user_id, org_id, name, description, instructions, is_org_shared, is_enabled) "
        "VALUES ($1, $2, $3, $4, $5, $6, true, true)",
        sid, owner_uid, org_id, name, "org A shared skill", body,
    )
    await pool.execute(
        "INSERT INTO public.skill_files "
        "(id, skill_id, user_id, org_id, filename, file_path, file_size, mime_type) "
        "VALUES ($1, $2, $3, $4, 'notes.txt', $5, 10, 'text/plain')",
        uuid4(), sid, owner_uid, org_id, f"{owner_uid}/{sid}/notes.txt",
    )
    return str(sid), name, body


@pytest.mark.asyncio
async def test_load_skill_cross_org_refused_seed125(pg_pool, two_orgs_two_users):
    """CR-01 load_skill — a disjoint-org caller (B) MUST NOT resolve org A's is_org_shared
    skill; the owner (A) still does. Drives the REAL ``_handle_load_skill`` on the REAL
    service-role client. RED pre-fix (the .or_(is_org_shared.eq.true) filter had no org gate
    → B loaded A's instructions cross-org); GREEN post-fix (the org-gated filter)."""
    from app.services.tool_dispatcher import _handle_load_skill  # noqa: PLC0415

    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    sb = _service_role_supabase_or_skip()
    _sid, name, body = await _seed_org_shared_skill(pg_pool, a["uid"], a["org_id"])

    # Owner A resolves the skill (positive control — the skill exists + is loadable).
    out_a = json.loads((await _handle_load_skill(
        {"skill_name": name}, _make_seed125_tool_ctx(sb, a["uid"]))).result)
    assert out_a.get("instructions") == body, (
        f"positive-control failure: owner A cannot load its OWN skill (got {out_a!r}) — the "
        "org gate must not over-restrict the owner, or the isolation assert below false-greens."
    )

    # Disjoint-org B must be REFUSED at resolution — no instructions, the not-found error.
    out_b = json.loads((await _handle_load_skill(
        {"skill_name": name}, _make_seed125_tool_ctx(sb, b["uid"]))).result)
    assert "instructions" not in out_b, (
        "CR-01 cross-org leak: user B (disjoint org) loaded user A's is_org_shared skill "
        f"instructions via the service-role load_skill tool — got {out_b!r}. The org gate "
        "(org_id ∈ caller_org_ids) must exclude another org's shared skill."
    )
    assert out_b.get("error") == f"Skill '{name}' not found or not enabled.", (
        f"expected the honest not-found refusal for cross-org B, got {out_b!r}"
    )


@pytest.mark.asyncio
async def test_read_skill_file_cross_org_refused_seed125(pg_pool, two_orgs_two_users):
    """CR-01 read_skill_file — cross-org B is refused at SKILL RESOLUTION (before any storage
    download), so it never learns the file exists or reads its bytes; owner A passes the gate.
    The distinct error strings arbitrate: B gets the skill-not-found refusal, A gets past it."""
    from app.services.tool_dispatcher import _handle_read_skill_file  # noqa: PLC0415

    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    sb = _service_role_supabase_or_skip()
    _sid, name, _body = await _seed_org_shared_skill(pg_pool, a["uid"], a["org_id"])

    # B — resolution refused (org gate) → the SKILL-level not-found error, NOT a file-level one.
    out_b = json.loads((await _handle_read_skill_file(
        {"skill_name": name, "filename": "notes.txt"},
        _make_seed125_tool_ctx(sb, b["uid"]))).result)
    assert out_b.get("error") == f"Skill '{name}' not found.", (
        "CR-01 cross-org leak: user B resolved user A's is_org_shared skill on read_skill_file "
        f"(expected the skill-level refusal, got {out_b!r}) — the org gate must refuse B before "
        "the storage path is ever built."
    )

    # A — passes skill resolution (owner). With no storage bytes seeded it returns a FILE-level
    # error, proving A was NOT refused at the skill gate (the arbiter vs B's skill-level refusal).
    out_a = json.loads((await _handle_read_skill_file(
        {"skill_name": name, "filename": "notes.txt"},
        _make_seed125_tool_ctx(sb, a["uid"]))).result)
    assert not str(out_a.get("error", "")).startswith("Skill '"), (
        f"positive-control failure: owner A was refused at skill resolution (got {out_a!r}) — "
        "the org gate over-restricted the owner."
    )


@pytest.mark.asyncio
async def test_is_system_skill_stays_cross_org_seed125(pg_pool, two_orgs_two_users):
    """The is_system UNIVERSAL escape is PRESERVED by the org gate (mig-109 FIX-A / D-165-02):
    a built-in (is_system=true) skill owned by the system seed in org A still loads for a
    disjoint-org caller B. Guards against the fix over-restricting platform content — the exact
    163-UAT Test-7 regression the match_skills RLS also guards (test_is_system_stays_universal)."""
    from app.services.tool_dispatcher import _handle_load_skill  # noqa: PLC0415

    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    sb = _service_role_supabase_or_skip()
    await _ensure_system_seed_user(pg_pool)

    sid = uuid4()
    name = f"seed125-system-{sid}"
    body = f"SEED-125 system built-in instructions {sid}"
    await pg_pool.execute(
        "INSERT INTO public.skills "
        "(id, user_id, org_id, name, description, instructions, is_system, is_org_shared, is_enabled) "
        "VALUES ($1, $2, $3, $4, $5, $6, true, true, true)",
        sid, SYSTEM_SEED_UID, a["org_id"], name, "built-in", body,
    )
    try:
        out_b = json.loads((await _handle_load_skill(
            {"skill_name": name}, _make_seed125_tool_ctx(sb, b["uid"]))).result)
        assert out_b.get("instructions") == body, (
            "FIX-A regression: the is_system built-in is invisible to a disjoint-org caller via "
            f"load_skill (got {out_b!r}) — is_system must stay OUTSIDE the org gate (universal), "
            "else the org-gate over-restricts platform content (163-UAT Test-7)."
        )
    finally:
        await _cleanup(pg_pool, "DELETE FROM public.skills WHERE id = $1", str(sid))


@pytest.mark.asyncio
async def test_skill_file_storage_read_cross_org_refused_seed125(pg_pool, two_orgs_two_users):
    """CR-02 storage-read sibling — under a user's JWT (storage RLS applies), the OWNER (A) reads
    A's skill-file storage row, a DISJOINT-org caller (B) reads 0. Two-caller regression, GREEN
    now AND post-mig-112.

    NUANCE (measured, not assumed): the ``skill-files`` storage read policy's shared branch is an
    ``EXISTS`` subquery that JOINs ``public.skills`` — and ``public.skills`` already carries
    org-gated RLS (mig 108/109), which is enforced INSIDE the subquery under B's authenticated
    role. So the storage read is ALREADY transitively org-gated at runtime (B's skills-RLS hides
    A's org-shared skill from the JOIN → the EXISTS is false → B sees 0). mig 112 is therefore
    NOT closing a live exploitable leak here; it hardens the storage POLICY EXPRESSION itself to
    be EXPLICITLY org-gated (``s.org_id IN current_user_org_ids()``) — defense-in-depth that no
    longer RELIES on the implicit transitive skills-RLS — and corrects mig-111's false
    "reconciled to mig-109" comment. The two-caller result (A=1, B=0) is identical pre/post 112,
    so this stands as a normal passing regression (no xfail). The A positive control proves the
    B=0 is a genuine per-viewer denial, not a blanket storage.objects RLS block."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    if not await _table_exists(pg_pool, "skill_files"):
        pytest.skip("skill_files table absent")

    sid = uuid4()
    storage_name = f"{a['uid']}/{sid}/notes.txt"
    try:
        await pg_pool.execute(
            "INSERT INTO public.skills (id, user_id, org_id, name, is_org_shared, is_enabled) "
            "VALUES ($1, $2, $3, $4, true, true)",
            sid, a["uid"], a["org_id"], f"seed125-storage-{sid}",
        )
        await pg_pool.execute(
            "INSERT INTO public.skill_files "
            "(id, skill_id, user_id, org_id, filename, file_path, file_size, mime_type) "
            "VALUES ($1, $2, $3, $4, 'notes.txt', $5, 10, 'text/plain')",
            uuid4(), sid, a["uid"], a["org_id"], storage_name,
        )
        await pg_pool.execute(
            "INSERT INTO storage.objects (bucket_id, name) VALUES ('skill-files', $1)",
            storage_name,
        )
    except Exception as e:  # storage schema / bucket differences → skip, never hard-error
        await _cleanup(pg_pool, "DELETE FROM public.skills WHERE id = $1", str(sid))
        pytest.skip(f"could not seed storage.objects skill-file row: {type(e).__name__}: {e}")

    try:
        # Positive control — the OWNER (A) reads the row (via the owner-prefix leg), so a B=0
        # below is a genuine per-viewer denial, not storage.objects RLS blanket-blocking B.
        async with open_user_conn(pg_pool, a["uid"]) as conn_a:
            await assert_auth_uid(conn_a, a["uid"])  # fail-loud FIRST
            owner_sees = await conn_a.fetchval(
                "SELECT count(*) FROM storage.objects "
                "WHERE bucket_id = 'skill-files' AND name = $1",
                storage_name,
            )
        assert owner_sees == 1, (
            "positive-control failure: owner A cannot read its OWN skill-file storage row — the "
            "storage policy over-restricts (a 0-for-everyone bug would false-green the B leg)."
        )

        # Isolation — a disjoint-org caller (B) reads 0 of A's is_org_shared skill file.
        async with open_user_conn(pg_pool, b["uid"]) as conn_b:
            await assert_auth_uid(conn_b, b["uid"])  # fail-loud FIRST
            leaked = await conn_b.fetchval(
                "SELECT count(*) FROM storage.objects "
                "WHERE bucket_id = 'skill-files' AND name = $1",
                storage_name,
            )
        assert leaked == 0, (
            "CR-02 storage leak: user B (disjoint org) reads the storage row of user A's "
            "is_org_shared skill file — the shared branch must be org-gated (transitively via the "
            "skills-table RLS today; explicitly via mig 112's current_user_org_ids() predicate)."
        )
    finally:
        await _cleanup(
            pg_pool,
            "DELETE FROM storage.objects WHERE bucket_id = 'skill-files' AND name = $1",
            storage_name,
        )
        await _cleanup(pg_pool, "DELETE FROM public.skills WHERE id = $1", str(sid))


# ══════════════════════════════════════════════════════════════════════════════════
# PACK-17 / Phase 264 (264-04, SC#1's REAL-DB HALF) — the SAME-ORG NON-AUTHOR axis.
#
#   The SEED-125 legs above drive the DISJOINT-ORG axis, which must keep FAILING and
#   is the case the org gate exists for. 264's case is its INVERSE and must now PASS:
#   Phase 263 stamps `skills.born_for_expert_bundle_id` and admits a colleague's
#   born-for skill at RESOLVE time (the catalog: names + descriptions), but the
#   instruction BODY was fetched through a predicate that had never heard of that
#   column — so for every org member BUT the author, the Expert's prompt promised a
#   skill the load path then refused, and the miss branch handed the model an
#   `available_skills` list that EXCLUDED it.
#
#   ⛔ WHAT THESE TWO TESTS PROVE THAT `tests/unit/test_264_load_skill_born_for.py`
#   CANNOT, AND VICE VERSA. 264-03's unit proof drives the real handler against a
#   RECORDING+FILTERING in-process fake: it proves the query this process would send
#   and the rows that query would admit, evaluated in Python. It touches no database.
#   These two prove the other half — a REAL service-role (BYPASSRLS) supabase client,
#   real PostgREST parsing the `.or_()` grammar, real `public.skills` rows, real
#   `org_members` membership resolution: Postgres AGREES with the predicate. Neither
#   claims what the other proves, and neither alone is the evidence.
#
#   ⛔ AND WHAT NEITHER DEFENDS: this module is OUTSIDE `pytest tests/unit`, so it does
#   NOT hold the backend ceiling and may never be quoted as a gate. It is UAT-adjacent
#   evidence for D-264-09.
# ══════════════════════════════════════════════════════════════════════════════════


def _make_born_for_tool_ctx(sb, caller_uid: str, born_for_bundle_id):
    """The 264 sibling of ``_make_seed125_tool_ctx`` — the SAME ctx, plus the run's
    access-checked Expert bundle id on ``ToolContext.born_for_bundle_id`` (264-01's carrier).

    ⛔ Built by ``dataclasses.replace`` over the neighbour's helper rather than by a second
    ``ToolContext(...)`` literal, so the two ctx shapes CANNOT drift — and so the neighbour's
    own default stays untouched (a changed default would silently make
    ``test_load_skill_cross_org_refused_seed125`` measure a different configuration than it
    did before this commit)."""
    import dataclasses  # noqa: PLC0415

    return dataclasses.replace(
        _make_seed125_tool_ctx(sb, caller_uid), born_for_bundle_id=born_for_bundle_id,
    )


async def _seed_born_for_private_skill(pool, owner_uid: str, org_id: str):
    """Seed the 264 shape: a **PRIVATE** (``is_org_shared=False``), enabled skill owned by
    ``owner_uid`` in ``org_id``, stamped ``born_for_expert_bundle_id`` -> a REAL
    ``public.expert_bundles`` row in the same org, plus one bundled ``skill_files`` row.

    Returns ``(skill_id, skill_name, instructions_body, bundle_id)``.

    ⚠ The bundle row is NOT optional and a bare fresh UUID will NOT do: mig 191 declares
    ``born_for_expert_bundle_id uuid REFERENCES public.expert_bundles(id) ON DELETE SET NULL``,
    so an unbacked id is rejected by the foreign key. (264-04's plan text said "a fresh UUID" —
    measured wrong against the shipped migration; recorded in 264-04-SUMMARY.md.)
    ``expert_bundles`` also carries ``CHECK (is_system = true OR org_id IS NOT NULL)``
    (mig 187), so ``org_id`` is explicit here.

    ``org_id`` explicit on the skill -> the mig-106 autofill trigger no-ops; the ``skill_files``
    row cascade-deletes with the skill."""
    bundle_id = uuid4()
    await pool.execute(
        "INSERT INTO public.expert_bundles (id, org_id, created_by, name, slug) "
        "VALUES ($1, $2, $3, $4, $5)",
        bundle_id, org_id, owner_uid, f"264 born-for expert {bundle_id}",
        f"pack17-born-for-{bundle_id}",
    )
    sid = uuid4()
    name = f"pack17-born-for-{sid}"
    body = f"PACK-17 born-for PRIVATE instructions {sid}"
    await pool.execute(
        "INSERT INTO public.skills "
        "(id, user_id, org_id, name, description, instructions, is_org_shared, is_enabled, "
        " born_for_expert_bundle_id) "
        "VALUES ($1, $2, $3, $4, $5, $6, false, true, $7)",
        sid, owner_uid, org_id, name, "born for the 264 expert", body, bundle_id,
    )
    await pool.execute(
        "INSERT INTO public.skill_files "
        "(id, skill_id, user_id, org_id, filename, file_path, file_size, mime_type) "
        "VALUES ($1, $2, $3, $4, 'margin.md', $5, 12, 'text/markdown')",
        uuid4(), sid, owner_uid, org_id, f"{owner_uid}/{sid}/margin.md",
    )
    return str(sid), name, body, str(bundle_id)


async def _seed_second_member_of_org(pool, org_id: str):
    """Create a SECOND member of ``org_id`` — a real ``auth.users`` row plus an ``org_members``
    row — and return ``(uid, personal_org_ids)``.

    The ``two_orgs_two_users`` fixture deliberately gives two users in two DISJOINT orgs, so
    264's axis (same org, different person) has no fixture. Membership is created exactly the
    way that fixture's fallback arm creates it. ⚠ The mig-105 ``handle_new_user`` trigger may
    also auto-provision a PERSONAL org for this user; those org ids are returned so teardown can
    delete them. A second membership is harmless to the predicate (the org gate is an
    ``org_id.in.(…)`` over the caller's WHOLE set) but it is still seeded state we own."""
    uid = uuid4()
    await pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        uid, f"pack17-member-{uid}@test.local",
    )
    personal = [
        str(r["org_id"]) for r in await pool.fetch(
            "SELECT org_id FROM public.org_members WHERE user_id = $1", uid
        )
    ]
    await pool.execute(
        "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member') "
        "ON CONFLICT DO NOTHING",
        org_id, uid,
    )
    return str(uid), personal


async def _teardown_born_for_seed(pool, skill_id, bundle_id, member_uid, personal_orgs):
    """Delete every row the 264 legs seeded and RETURN the post-delete counts, so the caller can
    ASSERT the teardown rather than trust it (the ``263-UAT.md`` "Data left behind, deliberately"
    standard: anything kept is named and justified, anything else is deleted and the deletion
    VERIFIED)."""
    await _cleanup(pool, "DELETE FROM public.skills WHERE id = $1", skill_id)
    await _cleanup(pool, "DELETE FROM public.expert_bundles WHERE id = $1", bundle_id)
    await _cleanup(pool, "DELETE FROM public.org_members WHERE user_id = $1", member_uid)
    for oid in personal_orgs:
        await _cleanup(pool, "DELETE FROM public.organizations WHERE id = $1", oid)
    await _cleanup(pool, "DELETE FROM public.profiles WHERE id = $1", member_uid)
    await _cleanup(pool, "DELETE FROM auth.users WHERE id = $1", member_uid)
    return {
        "skills": await pool.fetchval(
            "SELECT count(*) FROM public.skills WHERE id = $1", skill_id),
        "skill_files": await pool.fetchval(
            "SELECT count(*) FROM public.skill_files WHERE skill_id = $1", skill_id),
        "expert_bundles": await pool.fetchval(
            "SELECT count(*) FROM public.expert_bundles WHERE id = $1", bundle_id),
        "org_members": await pool.fetchval(
            "SELECT count(*) FROM public.org_members WHERE user_id = $1", member_uid),
        "auth_users": await pool.fetchval(
            "SELECT count(*) FROM auth.users WHERE id = $1", member_uid),
    }


_TEARDOWN_CLEAN = {
    "skills": 0, "skill_files": 0, "expert_bundles": 0, "org_members": 0, "auth_users": 0,
}


@pytest.mark.asyncio
async def test_load_skill_born_for_same_org_non_author_pack17(pg_pool, two_orgs_two_users):
    """PACK-17 / SC#1 on a REAL database — a SAME-ORG NON-AUTHOR, on a run with the Expert
    active, loads the instruction BODY of a PRIVATE born-for skill; and the widening is proven
    NARROW on Postgres, not only in the predicate.

    Five cases, in order, each asserting on the instruction BODY STRING (never a status word — a
    status word cannot tell "resolved the right row" from "resolved something"):

      1. positive control — the AUTHOR (A) loads its own private born-for skill. Without it, a
         0-for-everyone seeding or permission bug would false-green every refusal below.
      2. ⭐ THE TARGET — a SECOND member of A's org, carrying the stamped bundle, gets the SAME
         body back from a real Postgres round-trip. This is the case that was broken.
      3. narrowness — the same member with ``born_for_bundle_id=None`` (no Expert active) is
         REFUSED. The widening is opt-in per RUN, not a standing grant.
      4. narrowness — the same member with a WRONG bundle is REFUSED. The marker must MATCH.
      5. ⛔ T-264-19 tenancy — a DISJOINT-ORG caller (B) holding the CORRECT bundle id is STILL
         refused, because the born-for disjunct nests INSIDE the org gate rather than beside
         ``is_system``. That is the SEED-125 shape this phase must not re-open, measured on the
         real database rather than inferred from the predicate string.

    ⛔ Outside ``pytest tests/unit``: UAT-adjacent evidence for D-264-09, never a gate.
    ⛔ 264-03's ``tests/unit/test_264_load_skill_born_for.py`` proves the QUERY this process would
    send and the rows it would admit, evaluated in-process against a recording fake; THIS proves
    what Postgres returns. Neither claims what the other proves."""
    from app.services.tool_dispatcher import _handle_load_skill  # noqa: PLC0415

    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    sb = _service_role_supabase_or_skip()
    sid, name, body, bundle_id = await _seed_born_for_private_skill(
        pg_pool, a["uid"], a["org_id"])
    member_uid, personal_orgs = await _seed_second_member_of_org(pg_pool, a["org_id"])
    refusal = f"Skill '{name}' not found or not enabled."

    try:
        async def _load(ctx):
            return json.loads((await _handle_load_skill({"skill_name": name}, ctx)).result)

        # 1. Positive control — the AUTHOR loads its own private born-for skill.
        out_author = await _load(_make_born_for_tool_ctx(sb, a["uid"], bundle_id))
        assert out_author.get("instructions") == body, (
            "positive-control failure: the AUTHOR cannot load its OWN private born-for skill "
            f"(got {out_author!r}) — every refusal below would then false-green on a seeding or "
            "permission bug rather than on the org/born-for gate."
        )

        # 2. ⭐ THE TARGET — a same-org NON-AUTHOR with the Expert active gets the BODY.
        out_member = await _load(_make_born_for_tool_ctx(sb, member_uid, bundle_id))
        assert out_member.get("instructions") == body, (
            "PACK-17 (SC#1) REAL-DB failure: a same-org NON-AUTHOR on a run with the born-for "
            f"Expert active did NOT receive the instruction body — got {out_member!r}. Phase 263 "
            "admits this row at RESOLVE time, so the Expert's prompt promises a skill the LOAD "
            "path then refuses. The born-for disjunct must be nested inside the org gate in the "
            "predicate `_handle_load_skill` actually sends to PostgREST."
        )
        assert "margin.md" in (out_member.get("files") or []), (
            "the non-author's load must also list the skill's bundled files — that `files: [...]` "
            "promise is what the `read_skill_file` / `execute_code` widenings rest on "
            f"(RESEARCH §8.11). Got {out_member.get('files')!r}."
        )

        # 3. Narrowness — no Expert active on the run => refused.
        out_no_bundle = await _load(_make_born_for_tool_ctx(sb, member_uid, None))
        assert "instructions" not in out_no_bundle, (
            "over-widening: a same-org non-author with NO Expert active loaded another user's "
            f"PRIVATE skill — got {out_no_bundle!r}. The born-for arm is opt-in per RUN."
        )
        assert out_no_bundle.get("error") == refusal, (
            f"expected the honest not-found refusal with no bundle, got {out_no_bundle!r}"
        )

        # 4. Narrowness — a WRONG bundle => refused (the marker must MATCH, not merely exist).
        out_wrong = await _load(_make_born_for_tool_ctx(sb, member_uid, str(uuid4())))
        assert "instructions" not in out_wrong, (
            "over-widening: a WRONG born-for bundle id admitted another user's PRIVATE skill — "
            f"got {out_wrong!r}. A marker that matches any bundle is not a scope."
        )
        assert out_wrong.get("error") == refusal, (
            f"expected the honest not-found refusal for a wrong bundle, got {out_wrong!r}"
        )

        # 5. ⛔ T-264-19 — a DISJOINT-ORG caller holding the CORRECT bundle is still refused.
        out_cross_org = await _load(_make_born_for_tool_ctx(sb, b["uid"], bundle_id))
        assert "instructions" not in out_cross_org, (
            "SEED-125 RE-OPENED by the 264 widening: a DISJOINT-ORG caller carrying the correct "
            f"born-for bundle id loaded org A's private skill — got {out_cross_org!r}. The "
            "born-for disjunct must nest INSIDE `and(org_id.in.(…), …)`; placed beside "
            "`is_system` it lets a foreign org through, which is the exact leak this module's "
            "org gate exists to prevent."
        )
        assert out_cross_org.get("error") == refusal, (
            f"expected the honest not-found refusal for a cross-org caller, got {out_cross_org!r}"
        )
    finally:
        remaining = await _teardown_born_for_seed(
            pg_pool, sid, bundle_id, member_uid, personal_orgs)
        assert remaining == _TEARDOWN_CLEAN, (
            f"teardown left rows behind on the shared local DB: {remaining!r}"
        )


@pytest.mark.asyncio
async def test_read_skill_file_born_for_same_org_non_author_pack17(pg_pool, two_orgs_two_users):
    """PACK-17 on a REAL database, one layer down — the SAME-ORG NON-AUTHOR gets PAST skill
    RESOLUTION in ``_handle_read_skill_file``, where before 264 it was refused at the skill level.

    ⛔ The two error strings arbitrate, exactly as the cross-org sibling above arbitrates them:

      * refused at RESOLUTION -> ``Skill '<name>' not found.``  (the skill-level refusal)
      * past RESOLUTION       -> ``File 'margin.md' not found: …`` (a FILE-level miss — this leg
        seeds the ``skill_files`` ROW but no storage object, so the download legitimately fails)

    A file-level error is therefore the PROOF that resolution widened; a skill-level error is the
    pre-264 defect. The cross-org caller must still get the SKILL-level one — narrowness on the
    real database, at the second of the three widened sites.

    ⛔ Outside ``pytest tests/unit``: UAT-adjacent evidence for D-264-09, never a gate."""
    from app.services.tool_dispatcher import _handle_read_skill_file  # noqa: PLC0415

    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    sb = _service_role_supabase_or_skip()
    sid, name, _body, bundle_id = await _seed_born_for_private_skill(
        pg_pool, a["uid"], a["org_id"])
    member_uid, personal_orgs = await _seed_second_member_of_org(pg_pool, a["org_id"])
    skill_refusal = f"Skill '{name}' not found."

    try:
        async def _read(ctx):
            return json.loads((await _handle_read_skill_file(
                {"skill_name": name, "filename": "margin.md"}, ctx)).result)

        # Positive control — the AUTHOR gets past resolution (a file-level miss, not skill-level).
        out_author = await _read(_make_born_for_tool_ctx(sb, a["uid"], bundle_id))
        assert out_author.get("error") != skill_refusal, (
            "positive-control failure: the AUTHOR is refused at SKILL resolution for its own "
            f"born-for skill (got {out_author!r}) — the member leg below could not then mean "
            "anything."
        )

        # ⭐ THE TARGET — a same-org NON-AUTHOR gets past resolution too.
        out_member = await _read(_make_born_for_tool_ctx(sb, member_uid, bundle_id))
        assert out_member.get("error") != skill_refusal, (
            "PACK-17 failure one layer down: a same-org NON-AUTHOR on a run with the born-for "
            f"Expert active is refused at SKILL resolution in read_skill_file — got "
            f"{out_member!r}. `load_skill` returns `files: [...]`, so a loadable body whose "
            "bundled files 404 is the same defect: the model is told the files exist and then "
            "cannot read them."
        )

        # Narrowness — no Expert active => refused at the SKILL level, exactly as before 264.
        out_no_bundle = await _read(_make_born_for_tool_ctx(sb, member_uid, None))
        assert out_no_bundle.get("error") == skill_refusal, (
            "over-widening: a same-org non-author with NO Expert active resolved another user's "
            f"PRIVATE skill in read_skill_file — got {out_no_bundle!r}."
        )

        # ⛔ T-264-19 — a DISJOINT-ORG caller with the CORRECT bundle stays refused at the SKILL
        # level, so it never even learns the file exists.
        out_cross_org = await _read(_make_born_for_tool_ctx(sb, b["uid"], bundle_id))
        assert out_cross_org.get("error") == skill_refusal, (
            "SEED-125 RE-OPENED at read_skill_file: a DISJOINT-ORG caller carrying the correct "
            f"born-for bundle id resolved org A's private skill — got {out_cross_org!r}."
        )
    finally:
        remaining = await _teardown_born_for_seed(
            pg_pool, sid, bundle_id, member_uid, personal_orgs)
        assert remaining == _TEARDOWN_CLEAN, (
            f"teardown left rows behind on the shared local DB: {remaining!r}"
        )
