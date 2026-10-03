"""Phase 272-03 (FIND-07, SC#3, D-14 / D-18) — migration 200 on the LIVE local database.

What this proves, and how it refuses to prove it vacuously:

* **One signature per name.** ``CREATE OR REPLACE`` with an added parameter makes a NEW overload,
  and positional callers then fail with *"function … is not unique"* (the 033/036 history). So
  ``pg_proc`` must hold exactly ONE row per name, carrying the new identity arguments.
* **The PUBLIC-EXECUTE trap** (BUG-260911-01 class). A recreated function is executable by PUBLIC
  unless revoked from PUBLIC itself; ``anon`` must not execute either RPC, ``authenticated`` must.
* **Empty never means all (D-18).** ``p_document_ids = '{}'`` returns ZERO rows from both RPCs.
* **The DEFINER body still gates.** An org-A-only subject passing org B's document id gets zero
  rows; passing its own org's id gets that chunk back (the positive control that keeps "0 rows"
  from meaning "the query is broken").
* **Both vector branches are reachable**, and the EXACT branch's statement — held here as a
  constant and asserted to be the text inside ``pg_get_functiondef`` so the mirror cannot drift —
  plans with NO HNSW node and DOES use ``idx_document_chunks_document_id`` (SC#3: no
  selective-filter recall cliff is possible on a path that never walks the graph).
* **Old positional callers still work** (``recall_eval._MATCH_SQL``, test_266's 7-arg shape).

Every leg runs as a fresh single-org subject under ``open_user_conn`` with the fail-loud
``assert_auth_uid`` preflight. Everything seeded is deleted in ``finally``.
"""
from __future__ import annotations

import json
import re
from uuid import UUID, uuid4

import pytest

from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg
from tests.integration.test_163_rls_documents import _add_comember, _drop_user

pytestmark = requires_pg

VECTOR_SIG = (
    "query_embedding vector, match_user_id uuid, match_count integer, "
    "match_threshold double precision, metadata_filter jsonb, p_folder_ids uuid[], "
    "p_embedding_model text, p_document_ids uuid[], p_exact_max_chunks integer"
)
KEYWORD_SIG = (
    "search_query text, match_user_id uuid, match_count integer, metadata_filter jsonb, "
    "p_folder_ids uuid[], p_document_ids uuid[]"
)
VECTOR_REGPROC = (
    "public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, "
    "uuid[], integer)"
)
KEYWORD_REGPROC = "public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[])"

# The EXACT branch's statement, verbatim from migration 200 (whitespace-normalised before the
# containment check). If the migration body changes, this constant must change with it — the
# containment assertion below fails otherwise, so the EXPLAIN can never test a stale copy.
EXACT_BRANCH_SQL = """
    SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
           1 - (dc.embedding OPERATOR(public.<=>) query_embedding) AS similarity
    FROM public.document_chunks dc
    JOIN public.documents d ON d.id = dc.document_id
    WHERE dc.document_id = ANY (p_document_ids)
      AND dc.org_id = ANY (SELECT public.current_user_org_ids())
      AND (
        dc.user_id = auth.uid()
        OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
        OR public.connection_doc_is_visible(d.source_connection_id, d.ingest_visibility)
      )
      AND (d.source_state IS NULL OR d.source_state != 'source_disconnected')
      AND 1 - (dc.embedding OPERATOR(public.<=>) query_embedding) > match_threshold
      AND d.is_latest = true
      AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
      AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
      AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)
    ORDER BY (dc.embedding OPERATOR(public.<=>) query_embedding) + 0
    LIMIT match_count
"""

_VEC9 = (
    "SELECT document_id FROM public.match_document_chunks("
    "$1::text::public.vector, $2::uuid, 50, $3::float8, NULL, NULL, NULL, $4::uuid[], $5::int)"
)
_KW6 = (
    "SELECT document_id FROM public.keyword_search_chunks($1, $2::uuid, 50, NULL, NULL, $3::uuid[])"
)


def _norm(sql: str) -> str:
    return " ".join(sql.split())


async def _embedding_dim(pool) -> int:
    fmt = await pool.fetchval(
        "SELECT format_type(atttypid, atttypmod) FROM pg_attribute "
        "WHERE attrelid = 'public.document_chunks'::regclass AND attname = 'embedding'"
    )
    assert fmt and fmt.startswith("vector(") and fmt.endswith(")"), fmt
    return int(fmt[len("vector("):-1])


async def _seed_doc(pool, *, org_id: str, owner_uid: str, marker: str, vec: str) -> dict:
    folder_id, doc_id, chunk_id = uuid4(), uuid4(), uuid4()
    await pool.execute(
        "INSERT INTO public.folders (id, user_id, org_id, name, is_org_shared) "
        "VALUES ($1, $2, $3, $4, true)",
        folder_id, UUID(owner_uid), UUID(org_id), f"272-03-{marker}",
    )
    await pool.execute(
        "INSERT INTO public.documents (id, user_id, org_id, folder_id, filename, file_path, "
        "file_size, mime_type, status, is_latest, version_number, chunk_count) "
        "VALUES ($1, $2, $3, $4, $5, $6, 100, 'text/markdown', 'completed', true, 1, 1)",
        doc_id, UUID(owner_uid), UUID(org_id), folder_id,
        f"272-03-{marker}.md", f"{owner_uid}/{doc_id}.md",
    )
    await pool.execute(
        "INSERT INTO public.document_chunks (id, document_id, user_id, org_id, content, "
        "chunk_index, embedding) VALUES ($1, $2, $3, $4, $5, 0, $6::text::public.vector)",
        chunk_id, doc_id, UUID(owner_uid), UUID(org_id),
        f"Quarterly revenue statement {marker}", vec,
    )
    return {"folder_id": folder_id, "doc_id": doc_id, "chunk_id": chunk_id}


async def _cleanup(pool, seeded: dict | None) -> None:
    if not seeded:
        return
    for sql, arg in (
        ("DELETE FROM public.document_chunks WHERE id = $1", seeded["chunk_id"]),
        ("DELETE FROM public.documents WHERE id = $1", seeded["doc_id"]),
        ("DELETE FROM public.folders WHERE id = $1", seeded["folder_id"]),
    ):
        try:
            await pool.execute(sql, arg)
        except Exception:
            pass


@pytest.fixture
async def scope(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    marker = uuid4().hex[:10]
    dim = await _embedding_dim(pg_pool)
    vec = "[" + ",".join(["0.01"] * dim) + "]"
    doc_a = doc_b = None
    s_uid = None
    try:
        doc_a = await _seed_doc(pg_pool, org_id=a["org_id"], owner_uid=a["uid"],
                                marker=f"a{marker}", vec=vec)
        doc_b = await _seed_doc(pg_pool, org_id=b["org_id"], owner_uid=b["uid"],
                                marker=f"b{marker}", vec=vec)
        s_uid = await _add_comember(pg_pool, a["org_id"])
        members = await pg_pool.fetch(
            "SELECT org_id FROM public.org_members WHERE user_id = $1", UUID(s_uid)
        )
        assert {str(r["org_id"]) for r in members} == {a["org_id"]}, "S must be org-A ONLY"
        yield {"s": s_uid, "a": doc_a, "b": doc_b, "vec": vec}
    finally:
        await _cleanup(pg_pool, doc_a)
        await _cleanup(pg_pool, doc_b)
        if s_uid:
            await _drop_user(pg_pool, s_uid)


# ── schema facts ─────────────────────────────────────────────────────────────────────────────

async def test_exactly_one_signature_per_name(pg_pool):
    rows = await pg_pool.fetch(
        "SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p "
        "JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname = 'public' AND p.proname IN ('match_document_chunks','keyword_search_chunks')"
    )
    by_name: dict[str, list[str]] = {}
    for r in rows:
        by_name.setdefault(r["proname"], []).append(r["args"])
    assert by_name == {"match_document_chunks": [VECTOR_SIG], "keyword_search_chunks": [KEYWORD_SIG]}


@pytest.mark.parametrize("sig", [VECTOR_REGPROC, KEYWORD_REGPROC])
async def test_anon_cannot_execute_and_authenticated_can(pg_pool, sig):
    assert await pg_pool.fetchval("SELECT has_function_privilege('anon', $1, 'EXECUTE')", sig) is False
    assert await pg_pool.fetchval(
        "SELECT has_function_privilege('authenticated', $1, 'EXECUTE')", sig
    ) is True
    acl = await pg_pool.fetchval("SELECT proacl::text FROM pg_proc WHERE oid = $1::regprocedure", sig)
    # PUBLIC appears in an ACL as an entry with an EMPTY grantee ("=X/owner").
    assert acl is not None and not re.search(r"(^|[{,])=X", acl), f"PUBLIC still executes: {acl}"


async def test_the_document_id_btree_exists(pg_pool):
    idx = await pg_pool.fetchval(
        "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' "
        "AND indexname = 'idx_document_chunks_document_id'"
    )
    assert idx is not None and "btree (document_id)" in idx, idx
    # 272-REVIEW WR-05: a failed or cancelled CREATE INDEX CONCURRENTLY leaves an INVALID index with
    # this name, which pg_indexes still lists and IF NOT EXISTS then skips. Validity is the fact.
    valid = await pg_pool.fetchval(
        "SELECT i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid "
        "JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname = 'public' AND c.relname = 'idx_document_chunks_document_id'"
    )
    assert valid is True, "idx_document_chunks_document_id is INVALID: DROP INDEX CONCURRENTLY it, re-run 200's step 1"


@pytest.mark.parametrize("sig", [VECTOR_REGPROC, KEYWORD_REGPROC])
async def test_both_rpcs_pin_custom_plans(pg_pool, sig):
    """272-05 / migration 201: the btree above makes PL/pgSQL's GENERIC plan a whole-table
    document_id join. A pooled connection switches to that plan after five calls, so without this
    pin UNFILTERED search on recall_bench went 3-8 ms -> 0.45-1.56 s (vector) and 0.5-0.9 s ->
    12-32 s (keyword). Evidence: .planning/phases/272-close-means-wrong/evidence/plancache-diagnosis.txt.
    """
    cfg = await pg_pool.fetchval("SELECT proconfig FROM pg_proc WHERE oid = $1::regprocedure", sig)
    assert cfg is not None and "plan_cache_mode=force_custom_plan" in cfg, cfg
    assert 'search_path=""' in cfg, cfg


# ── D-18 + the DEFINER gate, as an org-A-only subject ───────────────────────────────────────

async def test_an_empty_array_returns_zero_rows_from_both_rpcs(pg_pool, scope):
    async with open_user_conn(pg_pool, scope["s"]) as conn:
        await assert_auth_uid(conn, scope["s"])
        vec_rows = await conn.fetch(_VEC9, scope["vec"], scope["s"], -2.0, [], 1000)
        kw_rows = await conn.fetch(_KW6, "Quarterly revenue", scope["s"], [])
        # Positive control on the SAME connection: unfiltered, S does see its own chunk.
        ctrl = await conn.fetch(_VEC9, scope["vec"], scope["s"], -2.0, None, None)
    assert vec_rows == [] and kw_rows == [], "D-18: an empty set returned rows — it widened"
    assert scope["a"]["doc_id"] in {r["document_id"] for r in ctrl}, "control: S sees nothing at all"


async def test_org_b_ids_return_zero_rows_and_org_a_ids_return_the_chunk(pg_pool, scope):
    a_doc, b_doc = scope["a"]["doc_id"], scope["b"]["doc_id"]
    async with open_user_conn(pg_pool, scope["s"]) as conn:
        await assert_auth_uid(conn, scope["s"])
        vb = await conn.fetch(_VEC9, scope["vec"], scope["s"], -2.0, [b_doc], 1000)
        kb = await conn.fetch(_KW6, "Quarterly revenue", scope["s"], [b_doc])
        vb_idx = await conn.fetch(_VEC9, scope["vec"], scope["s"], -2.0, [b_doc], None)
        va = await conn.fetch(_VEC9, scope["vec"], scope["s"], -2.0, [a_doc], 1000)
        ka = await conn.fetch(_KW6, "Quarterly revenue", scope["s"], [a_doc])
    assert vb == [] and kb == [] and vb_idx == [], "LEAK: org-B ids returned rows to an org-A user"
    assert [r["document_id"] for r in va] == [a_doc], "positive control (vector) failed"
    assert [r["document_id"] for r in ka] == [a_doc], "positive control (keyword) failed"


async def test_both_vector_branches_are_reachable(pg_pool, scope):
    a_doc = scope["a"]["doc_id"]
    async with open_user_conn(pg_pool, scope["s"]) as conn:
        await assert_auth_uid(conn, scope["s"])
        n = await conn.fetchval(
            "SELECT count(*) FROM public.document_chunks WHERE document_id = $1", a_doc
        )
        exact = await conn.fetch(_VEC9, scope["vec"], scope["s"], -2.0, [a_doc], max(int(n), 1))
        indexed = await conn.fetch(_VEC9, scope["vec"], scope["s"], -2.0, [a_doc], None)
        # 0 < n_chunks forces the index branch even with a threshold supplied.
        over = await conn.fetch(_VEC9, scope["vec"], scope["s"], -2.0, [a_doc], 0)
    assert [r["document_id"] for r in exact] == [a_doc]
    assert [r["document_id"] for r in indexed] == [a_doc]
    assert [r["document_id"] for r in over] == [a_doc]


async def test_old_positional_callers_still_work(pg_pool, scope):
    old_vec = (
        "SELECT document_id FROM public.match_document_chunks("
        "$1::text::public.vector, $2::uuid, 50, 0.0, NULL, NULL, NULL)"
    )
    old_kw = "SELECT document_id FROM public.keyword_search_chunks($1, $2::uuid, 50, NULL, NULL)"
    async with open_user_conn(pg_pool, scope["s"]) as conn:
        await assert_auth_uid(conn, scope["s"])
        v = {r["document_id"] for r in await conn.fetch(old_vec, scope["vec"], scope["s"])}
        k = {r["document_id"] for r in await conn.fetch(old_kw, "Quarterly revenue", scope["s"])}
    assert scope["a"]["doc_id"] in v and scope["a"]["doc_id"] in k
    assert scope["b"]["doc_id"] not in v and scope["b"]["doc_id"] not in k


# ── SC#3: the exact branch never walks the HNSW graph ───────────────────────────────────────

def _index_names(plan: dict, out: list[str]) -> list[str]:
    if "Index Name" in plan:
        out.append(plan["Index Name"])
    for child in plan.get("Plans", []):
        _index_names(child, out)
    return out


async def test_the_exact_branch_mirror_is_the_migration_body(pg_pool):
    body = await pg_pool.fetchval(
        "SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname = 'public' AND p.proname = 'match_document_chunks'"
    )
    assert _norm(EXACT_BRANCH_SQL) in _norm(body), (
        "the EXACT branch in match_document_chunks no longer matches this test's mirror — "
        "update EXACT_BRANCH_SQL from migration 200 before trusting the EXPLAIN below"
    )


async def test_the_exact_branch_plans_without_an_hnsw_node(pg_pool, scope):
    hnsw = {
        r["indexname"]
        for r in await pg_pool.fetch(
            "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' "
            "AND tablename = 'document_chunks' AND indexdef ILIKE '%USING hnsw%'"
        )
    }
    assert hnsw, "POSITIVE CONTROL: no HNSW index on document_chunks — the assertion would be vacuous"

    bound = EXACT_BRANCH_SQL
    for name, param in (
        ("query_embedding", "$1::public.vector"),
        ("p_document_ids", "$2::uuid[]"),
        ("match_threshold", "$3::float8"),
        ("metadata_filter", "$4::jsonb"),
        ("p_folder_ids", "$5::uuid[]"),
        ("p_embedding_model", "$6::text"),
        ("match_count", "$7::int"),
    ):
        bound = re.sub(rf"\b{name}\b", param, bound)

    async with open_user_conn(pg_pool, scope["s"]) as conn:
        await assert_auth_uid(conn, scope["s"])
        await conn.execute("SET LOCAL enable_seqscan = off")
        raw = await conn.fetchval(
            "EXPLAIN (FORMAT JSON) " + bound,
            scope["vec"], [scope["a"]["doc_id"]], -2.0, None, None, None, 20,
        )
    plan = (json.loads(raw) if isinstance(raw, str) else raw)[0]["Plan"]
    names = _index_names(plan, [])
    assert not (set(names) & hnsw), f"the exact branch walked the HNSW graph: {names}"
    assert "idx_document_chunks_document_id" in names, f"exact branch did not use the btree: {names}"
