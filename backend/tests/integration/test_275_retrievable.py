"""Phase 275-01 (RET-04 / D-18 / D-21 / D-36; revisions W-1, W-1b) — an archived or source-gone
document leaves EVERY agent read on the LIVE local database (migration 205), while the Library
still sees it.

What this proves, and how it refuses to prove it vacuously:

* **One test per non-retrievable state (D-21)** — archived, missing_at_source,
  unauthorized_at_source, source_disconnected — on the vector arm's EXACT branch, its INDEX branch
  (driven the way ``test_272_rpc_document_scope`` drives them) AND ``keyword_search_chunks``. Each
  case ends with a POSITIVE CONTROL: the state is cleared and the SAME three calls return the SAME
  chunk, so "absent" can never mean "the call is broken".
* **Model-written SQL (D-36).** ``query_user_documents`` — the only door ``query_documents`` and
  ``grep`` use — cannot return an archived document from ``documents`` OR its chunks from
  ``document_chunks`` (the leak a ``documents``-only rewrite would miss). A direct Library read
  (GUC off) DOES return the archived row.
* **The GUC cannot be switched off from inside (W-1 / W-1b).** Text naming ``set_config``,
  ``current_setting`` or a ``U&`` escape is refused before it runs; ordinary text such as
  ``you&me`` is not.
* **The plan pin survived the redefinition** (``plan_cache_mode=force_custom_plan``, mig 201).

Everything seeded is deleted in ``finally``. Skip-guarded on :54322.
"""
from __future__ import annotations

from uuid import UUID, uuid4

import asyncpg
import pytest

from app.dependencies import _apply_rls_user_context
from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg
from tests.integration.test_272_rpc_document_scope import _KW6, _VEC9, _embedding_dim
from tests.integration.test_275_hold_triggers import _folder, _purge

pytestmark = requires_pg

STATES = ("archived", "missing_at_source", "unauthorized_at_source", "source_disconnected")
TERM = "Zephyrine retention ledger"


async def _seed(pool, a, vec, m):
    folder = await _folder(pool, owner=a["uid"], org=a["org_id"], name=f"275-ret-{m}")
    did, cid = uuid4(), uuid4()
    await pool.execute(
        "INSERT INTO public.documents (id, user_id, org_id, folder_id, filename, file_path, file_size, "
        "mime_type, status, is_latest, version_number, chunk_count) "
        "VALUES ($1,$2,$3,$4,$5,$6,100,'text/markdown','completed',true,1,1)",
        did, UUID(a["uid"]), UUID(a["org_id"]), folder, f"ret-{m}.md", f"{a['uid']}/{did}.md",
    )
    await pool.execute(
        "INSERT INTO public.document_chunks (id, document_id, user_id, org_id, content, chunk_index, embedding) "
        "VALUES ($1,$2,$3,$4,$5,0,$6::text::public.vector)",
        cid, did, UUID(a["uid"]), UUID(a["org_id"]), f"{TERM} {m}", vec,
    )
    return folder, did, cid


@pytest.fixture
async def world(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    m = uuid4().hex[:8]
    dim = await _embedding_dim(pg_pool)
    vec = "[" + ",".join(["0.01"] * dim) + "]"
    folder = did = None
    try:
        folder, did, cid = await _seed(pg_pool, a, vec, m)
        yield {"a": a, "m": m, "vec": vec, "doc": did, "chunk": cid}
    finally:
        await _purge(pg_pool, orgs=[a["org_id"], b["org_id"]], docs=[did] if did else [],
                     folders=[folder] if folder else [])


async def _set_state(pool, doc, state):
    if state == "archived":
        await pool.execute("UPDATE public.documents SET archived_at = now(), source_state = NULL WHERE id = $1", doc)
    else:
        await pool.execute("UPDATE public.documents SET archived_at = NULL, source_state = $2 WHERE id = $1", doc, state)


async def _clear(pool, doc, live_spelling=None):
    await pool.execute(
        "UPDATE public.documents SET archived_at = NULL, source_state = $2 WHERE id = $1", doc, live_spelling,
    )


async def _three_arms(pool, uid, vec, doc) -> dict[str, list]:
    async with open_user_conn(pool, uid) as conn:
        await assert_auth_uid(conn, uid)
        exact = await conn.fetch(_VEC9, vec, uid, -2.0, [doc], 1000)
        index = await conn.fetch(_VEC9, vec, uid, -2.0, [doc], None)
        unfiltered = await conn.fetch(_VEC9, vec, uid, -2.0, None, None)
        keyword = await conn.fetch(_KW6, TERM, uid, [doc])
    return {
        "exact": [r["document_id"] for r in exact],
        "index": [r["document_id"] for r in index],
        "unfiltered": [r["document_id"] for r in unfiltered if r["document_id"] == doc],
        "keyword": [r["document_id"] for r in keyword],
    }


async def _assert_hidden_then_returned(pg_pool, world, state, live_spelling=None):
    a, doc = world["a"], world["doc"]
    await _set_state(pg_pool, doc, state)
    hidden = await _three_arms(pg_pool, a["uid"], world["vec"], doc)
    for arm, ids in hidden.items():
        assert ids == [], f"{state}: the {arm} arm served a non-retrievable chunk"
    await _clear(pg_pool, doc, live_spelling)
    shown = await _three_arms(pg_pool, a["uid"], world["vec"], doc)
    for arm, ids in shown.items():
        assert ids == [doc], f"positive control ({state} cleared): the {arm} arm lost the chunk"


async def test_archived_is_excluded_from_every_rpc_arm(pg_pool, world):
    await _assert_hidden_then_returned(pg_pool, world, "archived")


async def test_missing_at_source_is_excluded_from_every_rpc_arm(pg_pool, world):
    await _assert_hidden_then_returned(pg_pool, world, "missing_at_source", live_spelling="live")


async def test_unauthorized_at_source_is_excluded_from_every_rpc_arm(pg_pool, world):
    await _assert_hidden_then_returned(pg_pool, world, "unauthorized_at_source")


async def test_source_disconnected_is_excluded_from_every_rpc_arm(pg_pool, world):
    await _assert_hidden_then_returned(pg_pool, world, "source_disconnected", live_spelling="live")


async def test_the_retrievable_column_is_the_one_predicate(pg_pool, world):
    doc = world["doc"]
    expected = {None: True, "live": True}
    for state in STATES:
        expected[state] = False
    for state, want in expected.items():
        if state == "archived":
            await _set_state(pg_pool, doc, "archived")
        else:
            await _clear(pg_pool, doc, state)
        got = await pg_pool.fetchval("SELECT retrievable FROM public.documents WHERE id = $1", doc)
        assert got is want, f"source_state={state!r}: retrievable={got!r}"
    gen = await pg_pool.fetchval(
        "SELECT attgenerated::text FROM pg_attribute "
        "WHERE attrelid = 'public.documents'::regclass AND attname = 'retrievable'"
    )
    assert gen == "s", "retrievable must be a STORED generated column"


# ── model-written SQL: query_user_documents ─────────────────────────────────────────────────

async def _qud(pool, uid, query):
    async with open_user_conn(pool, uid) as conn:
        await assert_auth_uid(conn, uid)
        return await conn.fetchval("SELECT public.query_user_documents($1)", query)


async def test_agent_sql_cannot_see_an_archived_document_or_its_chunks(pg_pool, world):
    a, doc = world["a"], world["doc"]
    q_doc = f"SELECT id FROM documents WHERE id = '{doc}'"
    q_chunk = f"SELECT content FROM document_chunks WHERE document_id = '{doc}'"
    # positive control first: live document, both queries return it
    assert len(await _qud(pg_pool, a["uid"], q_doc)) == 1
    assert len(await _qud(pg_pool, a["uid"], q_chunk)) == 1
    await _set_state(pg_pool, doc, "archived")
    assert await _qud(pg_pool, a["uid"], q_doc) == [], "D-36: agent SQL read an archived document"
    assert await _qud(pg_pool, a["uid"], q_chunk) == [], "D-36: agent SQL read an archived document's chunks"
    # the Library (GUC off) still sees the archived row
    async with open_user_conn(pg_pool, a["uid"]) as conn:
        seen = await conn.fetchval("SELECT count(*) FROM public.documents WHERE id = $1", doc)
        chunks = await conn.fetchval("SELECT count(*) FROM public.document_chunks WHERE document_id = $1", doc)
    assert seen == 1 and chunks == 1, "the Library must still see an archived document"


async def test_agent_sql_cannot_see_a_source_gone_document(pg_pool, world):
    a, doc = world["a"], world["doc"]
    await _set_state(pg_pool, doc, "missing_at_source")
    assert await _qud(pg_pool, a["uid"], f"SELECT id FROM documents WHERE id = '{doc}'") == []
    await _clear(pg_pool, doc, "live")
    assert len(await _qud(pg_pool, a["uid"], f"SELECT id FROM documents WHERE id = '{doc}'")) == 1


async def test_the_guc_is_scoped_to_the_call(pg_pool, world):
    """After query_user_documents returns, the same transaction's Library read still sees archived rows."""
    a, doc = world["a"], world["doc"]
    await _set_state(pg_pool, doc, "archived")
    async with open_user_conn(pg_pool, a["uid"]) as conn:
        inner = await conn.fetchval("SELECT public.query_user_documents($1)", f"SELECT id FROM documents WHERE id = '{doc}'")
        after = await conn.fetchval("SELECT count(*) FROM public.documents WHERE id = $1", doc)
    assert inner == [] and after == 1


BYPASSES = (
    "SELECT content FROM document_chunks WHERE (SELECT set_config('app.agent_read','off',true)) IS NOT NULL",
    "SELECT content FROM document_chunks WHERE (SELECT SET_CONFIG('app.agent_read','off',true)) IS NOT NULL",
    "SELECT content FROM document_chunks WHERE (SELECT U&\"\\0073et_config\"('app.agent_read','off',true)) IS NOT NULL",
    "SELECT current_setting('app.agent_read', true) AS v",
    "SELECT CURRENT_SETTING('app.agent_read') AS v",
    "SELECT u&'\\0073' AS v",
    "SELECT query_to_xml('select 1', true, true, '') AS v",
)


@pytest.mark.parametrize("query", BYPASSES)
async def test_text_that_could_switch_the_guc_is_refused_before_it_runs(pg_pool, world, query):
    a, doc = world["a"], world["doc"]
    await _set_state(pg_pool, doc, "archived")
    async with pg_pool.acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            await _apply_rls_user_context(conn, a["uid"])
            with pytest.raises(asyncpg.PostgresError) as exc:
                await conn.fetchval("SELECT public.query_user_documents($1)", query)
            assert exc.value.sqlstate == "42501", f"{query}: {exc.value.sqlstate} {exc.value}"
        finally:
            await tr.rollback()
    # and an accepted query still cannot reach the archived chunks
    assert await _qud(pg_pool, a["uid"], f"SELECT content FROM document_chunks WHERE document_id = '{doc}'") == []


async def test_ordinary_ampersand_text_is_not_refused(pg_pool, world):
    # (alias `v`, not `t`: query_user_documents wraps the text as `… FROM (<q>) t`, and a column
    # named `t` would shadow the row alias inside jsonb_agg(t).)
    rows = await _qud(pg_pool, world["a"]["uid"], "SELECT 'you&me' AS v")
    assert rows == [{"v": "you&me"}]


# ── the plan pin and the ACL survived the redefinition ──────────────────────────────────────

@pytest.mark.parametrize("fn", ["match_document_chunks", "keyword_search_chunks"])
async def test_both_rpcs_keep_the_plan_pin_and_search_path(pg_pool, fn):
    cfg = await pg_pool.fetchval(
        "SELECT proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname = 'public' AND p.proname = $1", fn,
    )
    assert cfg is not None and "plan_cache_mode=force_custom_plan" in cfg, cfg
    assert 'search_path=""' in cfg, cfg
    body = await pg_pool.fetchval(
        "SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname = 'public' AND p.proname = $1", fn,
    )
    assert "d.retrievable" in body and "source_disconnected" not in body, fn


async def test_query_user_documents_is_not_public(pg_pool):
    sig = "public.query_user_documents(text)"
    assert await pg_pool.fetchval("SELECT has_function_privilege('anon', $1, 'EXECUTE')", sig) is False
    assert await pg_pool.fetchval("SELECT has_function_privilege('authenticated', $1, 'EXECUTE')", sig) is True
