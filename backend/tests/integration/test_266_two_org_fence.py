"""Phase 266 (PACK-19, SC#3, D-266-17) — the two-org fence, against REAL RLS.

What this proves, and what it refuses to prove vacuously:

  * Two disjoint orgs (A, B) each hold an INSTALLED copy of the Financial Analyzer's corpus:
    an org-shared folder, one completed ``is_latest`` document, and one chunk carrying the
    ``$124.5`` / ``+18.2%`` text with a fixed embedding of the column's REAL dimension (read
    from ``pg_attribute`` — never hard-coded), plus an ``expert_installs`` row per org.
  * The fence SUBJECT S is a fresh user whose ONLY membership is org A. That is asserted from
    ``org_members`` before any leg runs. Retrieval's org gate is ALL of a caller's memberships
    (``current_user_org_ids()``), so a two-org subject would legitimately see both copies and
    prove nothing (RESEARCH Pitfall 3 — the dev account is in two orgs).
  * POSITIVE CONTROL: T is a fresh NON-OWNER member of org B only. Every leg that returns
    nothing for S returns B's copy for T through the SAME query, so "0 rows" can never be the
    query being broken (262 row 1.4's vacuous pass).
  * Legs: (1) a direct document read, (2) both search RPCs (keyword + vector), (3) the Expert's
    resolved scope. Every RLS leg runs under ``open_user_conn`` with the fail-loud
    ``assert_auth_uid`` preflight, so a NULL ``auth.uid()`` cannot false-pass at "0 rows".
  * PLANT (non-vacuity of the resolver leg): an install row for org A that points at org B's
    folder, and a SYSTEM_USER_ID-owned shared folder in org B handed to the bundle's
    ``knowledge_folder_ids``. The phase resolver strips both and logs
    ``EXPERT_MEMBER_CROSS_ORG_STRIPPED``; the base resolver (522e7b4fc) admitted the second —
    driven RED in 266-05 and recorded in its SUMMARY.

Everything seeded is deleted in ``finally``. Skip-guarded on the local Postgres :54322 — a
skipped run is a SKIP, never a pass.
"""
from __future__ import annotations

import logging
from uuid import UUID, uuid4

import pytest

from app.db import experts as experts_db
from app.services import expert_service
from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg

# Verbatim reuse of the Phase-163 single-org co-member helpers (never re-derived).
from tests.integration.test_163_rls_documents import _add_comember, _drop_user

pytestmark = requires_pg

FA_BUNDLE_ID = UUID("00000000-0000-0000-0000-000000000259")
SYSTEM_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
CHUNK_TEXT = (
    "ACME Corp Q3 2026 Income Statement ($M). Revenue $124.5 (+18.2% YoY). "
    "Marker {marker}."
)


async def _embedding_dim(pool) -> int:
    fmt = await pool.fetchval(
        "SELECT format_type(atttypid, atttypmod) FROM pg_attribute "
        "WHERE attrelid = 'public.document_chunks'::regclass AND attname = 'embedding'"
    )
    # e.g. 'vector(1536)'
    assert fmt and fmt.startswith("vector(") and fmt.endswith(")"), fmt
    return int(fmt[len("vector("):-1])


def _vec_literal(dim: int) -> str:
    # A fixed, non-zero, unit-direction vector: every seeded chunk and the query share it, so
    # cosine similarity is 1.0 and the ONLY thing that can exclude a row is the RPC's gates.
    return "[" + ",".join(["0.01"] * dim) + "]"


async def _seed_org_copy(pool, *, org_id: str, owner_uid: str, marker: str, vec: str) -> dict:
    """One installed corpus copy in ``org_id`` — every org column EXPLICIT (never the trigger)."""
    folder_id, doc_id, chunk_id = uuid4(), uuid4(), uuid4()
    await pool.execute(
        "INSERT INTO public.folders (id, user_id, org_id, name, is_org_shared) "
        "VALUES ($1, $2, $3, $4, true)",
        folder_id, UUID(owner_uid), UUID(org_id), f"266-fence-{marker}",
    )
    await pool.execute(
        "INSERT INTO public.documents (id, user_id, org_id, folder_id, filename, file_path, "
        "file_size, mime_type, status, is_latest, version_number, chunk_count) "
        "VALUES ($1, $2, $3, $4, $5, $6, 100, 'text/markdown', 'completed', true, 1, 1)",
        doc_id, UUID(owner_uid), UUID(org_id), folder_id,
        f"266-fence-{marker}.md", f"{owner_uid}/{doc_id}.md",
    )
    await pool.execute(
        "INSERT INTO public.document_chunks (id, document_id, user_id, org_id, content, "
        "chunk_index, embedding) VALUES ($1, $2, $3, $4, $5, 0, $6::text::public.vector)",
        chunk_id, doc_id, UUID(owner_uid), UUID(org_id),
        CHUNK_TEXT.format(marker=marker), vec,
    )
    await pool.execute(
        "INSERT INTO public.expert_installs (org_id, expert_bundle_id, folder_id, status, "
        "installed_by, corpus_version) VALUES ($1, $2, $3, 'installed', $4, 'fence-266')",
        UUID(org_id), FA_BUNDLE_ID, folder_id, UUID(owner_uid),
    )
    # Prove the explicit org actually landed (the autofill trigger is a no-op when set).
    got = await pool.fetchrow(
        "SELECT d.org_id AS d_org, f.org_id AS f_org, c.org_id AS c_org "
        "FROM public.documents d JOIN public.folders f ON f.id = d.folder_id "
        "JOIN public.document_chunks c ON c.document_id = d.id WHERE d.id = $1",
        doc_id,
    )
    assert {str(got["d_org"]), str(got["f_org"]), str(got["c_org"])} == {org_id}
    return {"folder_id": folder_id, "doc_id": doc_id, "chunk_id": chunk_id}


async def _cleanup_copy(pool, org_id: str, copy: dict | None) -> None:
    if not copy:
        return
    for sql, arg in (
        ("DELETE FROM public.expert_installs WHERE org_id = $1 AND expert_bundle_id = '"
         + str(FA_BUNDLE_ID) + "'", UUID(org_id)),
        ("DELETE FROM public.document_chunks WHERE id = $1", copy["chunk_id"]),
        ("DELETE FROM public.documents WHERE id = $1", copy["doc_id"]),
        ("DELETE FROM public.folders WHERE id = $1", copy["folder_id"]),
    ):
        try:
            await pool.execute(sql, arg)
        except Exception:
            pass


async def _memberships(pool, uid: str) -> set[str]:
    rows = await pool.fetch(
        "SELECT org_id FROM public.org_members WHERE user_id = $1", UUID(uid)
    )
    return {str(r["org_id"]) for r in rows}


@pytest.fixture
async def fence(pg_pool, two_orgs_two_users):
    """Seed both org copies + S (org A only) + T (org B only); tear everything down."""
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    marker = uuid4().hex[:10]
    dim = await _embedding_dim(pg_pool)
    vec = _vec_literal(dim)
    copy_a = copy_b = None
    s_uid = t_uid = None
    sys_folder = None
    try:
        copy_a = await _seed_org_copy(pg_pool, org_id=a["org_id"], owner_uid=a["uid"],
                                      marker=f"a{marker}", vec=vec)
        copy_b = await _seed_org_copy(pg_pool, org_id=b["org_id"], owner_uid=b["uid"],
                                      marker=f"b{marker}", vec=vec)
        s_uid = await _add_comember(pg_pool, a["org_id"])
        t_uid = await _add_comember(pg_pool, b["org_id"])
        # The plant's second shape: a SYSTEM_USER_ID-owned shared folder living in org B.
        sys_folder = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.folders (id, user_id, org_id, name, is_org_shared) "
            "VALUES ($1, $2, $3, $4, true)",
            sys_folder, SYSTEM_USER_ID, UUID(b["org_id"]), f"266-fence-sys-{marker}",
        )
        yield {
            "org_a": a["org_id"], "org_b": b["org_id"],
            "admin_a": a["uid"], "admin_b": b["uid"],
            "s": s_uid, "t": t_uid,
            "a": copy_a, "b": copy_b, "sys_folder": sys_folder,
            "marker": marker, "vec": vec, "dim": dim,
        }
    finally:
        await _cleanup_copy(pg_pool, a["org_id"], copy_a)
        await _cleanup_copy(pg_pool, b["org_id"], copy_b)
        if sys_folder is not None:
            try:
                await pg_pool.execute("DELETE FROM public.folders WHERE id = $1", sys_folder)
            except Exception:
                pass
        for uid in (s_uid, t_uid):
            if uid:
                await _drop_user(pg_pool, uid)


@pytest.mark.asyncio
async def test_subjects_are_single_org(pg_pool, fence):
    """Non-vacuity precondition: S belongs to org A ONLY, T to org B ONLY."""
    assert await _memberships(pg_pool, fence["s"]) == {fence["org_a"]}
    assert await _memberships(pg_pool, fence["t"]) == {fence["org_b"]}
    assert fence["org_a"] != fence["org_b"]


@pytest.mark.asyncio
async def test_leg1_document_read_is_fenced(pg_pool, fence):
    assert await _memberships(pg_pool, fence["s"]) == {fence["org_a"]}
    sql = "SELECT count(*) FROM public.documents WHERE id = $1"
    async with open_user_conn(pg_pool, fence["s"]) as conn:
        await assert_auth_uid(conn, fence["s"])
        s_sees_b = await conn.fetchval(sql, fence["b"]["doc_id"])
        s_sees_a = await conn.fetchval(sql, fence["a"]["doc_id"])
    async with open_user_conn(pg_pool, fence["t"]) as conn:
        await assert_auth_uid(conn, fence["t"])
        t_sees_b = await conn.fetchval(sql, fence["b"]["doc_id"])
    assert s_sees_b == 0, "LEAK: an org-A-only user read org B's corpus document"
    assert s_sees_a == 1, "S cannot read its own org's shared copy — the leg is broken, not fenced"
    assert t_sees_b == 1, "positive control: an org-B member must read org B's copy"


@pytest.mark.asyncio
async def test_leg2_keyword_and_vector_search_are_fenced(pg_pool, fence):
    assert await _memberships(pg_pool, fence["s"]) == {fence["org_a"]}
    kw_sql = (
        "SELECT document_id FROM public.keyword_search_chunks($1, $2::uuid, 50, NULL, NULL)"
    )
    vec_sql = (
        "SELECT document_id FROM public.match_document_chunks("
        "$1::text::public.vector, $2::uuid, 50, 0.0, NULL, NULL, NULL)"
    )
    # The marker token appears in BOTH chunks (prefixed a/b), so the query text itself can
    # match either org's chunk; only the RPC's org gate can separate them.
    kw_text = "ACME revenue"

    async def _run(uid: str) -> tuple[set, set]:
        async with open_user_conn(pg_pool, uid) as conn:
            await assert_auth_uid(conn, uid)
            kw = {r["document_id"] for r in await conn.fetch(kw_sql, kw_text, uid)}
            vc = {r["document_id"] for r in await conn.fetch(vec_sql, fence["vec"], uid)}
        return kw, vc

    s_kw, s_vec = await _run(fence["s"])
    t_kw, t_vec = await _run(fence["t"])
    a_doc, b_doc = fence["a"]["doc_id"], fence["b"]["doc_id"]

    assert b_doc not in s_kw, "LEAK: keyword search returned org B's chunk to an org-A-only user"
    assert b_doc not in s_vec, "LEAK: vector search returned org B's chunk to an org-A-only user"
    assert a_doc in s_kw, "keyword query found nothing in S's own org — the query is broken"
    assert a_doc in s_vec, "vector query found nothing in S's own org — the query is broken"
    assert b_doc in t_kw and b_doc in t_vec, "positive control: org-B member must find B's copy"
    assert a_doc not in t_kw and a_doc not in t_vec, "LEAK in the other direction (B sees A)"


@pytest.mark.asyncio
async def test_leg3_expert_scope_resolves_each_orgs_own_copy(pg_pool, fence):
    assert await _memberships(pg_pool, fence["s"]) == {fence["org_a"]}
    res_s = await expert_service.resolve_expert_bundle(
        pg_pool, FA_BUNDLE_ID, UUID(fence["org_a"]), UUID(fence["s"])
    )
    res_t = await expert_service.resolve_expert_bundle(
        pg_pool, FA_BUNDLE_ID, UUID(fence["org_b"]), UUID(fence["t"])
    )
    assert res_s is not None and res_t is not None
    assert list(res_s.effective_folder_ids) == [fence["a"]["folder_id"]]
    assert list(res_t.effective_folder_ids) == [fence["b"]["folder_id"]]
    assert fence["b"]["folder_id"] not in res_s.effective_folder_ids


@pytest.mark.asyncio
async def test_plant_install_row_pointing_at_org_b_is_stripped(pg_pool, fence, monkeypatch, caplog):
    """The install lookup is NOT the boundary: hand the resolver org B's install row for a
    caller in org A and the strict caller-org loop must still strip it."""
    b_install = await pg_pool.fetchrow(
        "SELECT * FROM public.expert_installs WHERE org_id = $1 AND expert_bundle_id = $2",
        UUID(fence["org_b"]), FA_BUNDLE_ID,
    )
    assert b_install is not None and b_install["folder_id"] == fence["b"]["folder_id"]

    async def _foreign_install(pool, *, org_id, bundle_id):
        return dict(b_install)

    monkeypatch.setattr(experts_db, "get_expert_install", _foreign_install)
    caplog.set_level(logging.WARNING)
    res = await expert_service.resolve_expert_bundle(
        pg_pool, FA_BUNDLE_ID, UUID(fence["org_a"]), UUID(fence["s"])
    )
    assert res is not None
    assert list(res.effective_folder_ids) == []
    assert any(
        "EXPERT_MEMBER_CROSS_ORG_STRIPPED" in r.getMessage()
        and str(fence["b"]["folder_id"]) in r.getMessage()
        for r in caplog.records
    ), "the cross-org folder was not stripped by the strict loop"


@pytest.mark.asyncio
async def test_plant_system_owned_folder_in_org_b_is_never_admitted(pg_pool, fence, monkeypatch, caplog):
    """The retired SEED-304 shape: a SYSTEM_USER_ID-owned shared folder in ANOTHER org, reaching
    the resolver both through the bundle's knowledge_folder_ids and through an install row.
    The base resolver (522e7b4fc) admitted it via ``is_system_folder``; 266 must not."""
    real_get_bundle = experts_db.get_expert_bundle_by_id

    async def _bundle_with_sys_folder(pool, bundle_id, caller_org_id):
        row = await real_get_bundle(pool, bundle_id, caller_org_id)
        assert row is not None
        row = dict(row)
        row["knowledge_folder_ids"] = [fence["sys_folder"]]
        return row

    async def _install_to_sys_folder(pool, *, org_id, bundle_id):
        return {
            "org_id": UUID(fence["org_a"]), "expert_bundle_id": FA_BUNDLE_ID,
            "folder_id": fence["sys_folder"], "status": "installed", "folder_exists": False,
        }

    monkeypatch.setattr(experts_db, "get_expert_bundle_by_id", _bundle_with_sys_folder)
    monkeypatch.setattr(experts_db, "get_expert_install", _install_to_sys_folder, raising=False)
    caplog.set_level(logging.WARNING)
    res = await expert_service.resolve_expert_bundle(
        pg_pool, FA_BUNDLE_ID, UUID(fence["org_a"]), UUID(fence["s"])
    )
    assert res is not None
    assert fence["sys_folder"] not in list(res.effective_folder_ids), (
        "a SYSTEM_USER_ID-owned folder in org B was admitted into an org-A caller's scope"
    )
    assert list(res.effective_folder_ids) == []
