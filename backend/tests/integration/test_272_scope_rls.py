"""Phase 272-03 (D-21 / D-06 / D-11 / D-19 / D-20 / D-23) — the scope resolver on REAL RLS.

What this proves, and how it refuses to prove it vacuously:

* **RLS decides, not the service role (D-21).** Org A holds a PRIVATE document (owner = org A's
  admin, no folder, not connection-visible) carrying the filtered value. Step 1 — the service-role
  PostgREST read bounded to the caller's orgs — DOES propose it; only step 2 (the caller's RLS)
  can remove it. So a resolver that skipped step 2 turns this suite red (driven, see SUMMARY).
* **Two orgs (Pitfall 2).** Org B holds documents with the SAME filtered value, an ``ACME GMBH``
  spelling and an ``invoice`` type. No id, count, nearby month, stored spelling or document type
  an org-A-only subject receives may include them. POSITIVE CONTROL: an org-B-only subject gets
  B's rows through the same calls, so "absent" can never mean "the query is broken".
* **D-19 AND.** Two org-A shared folders FE (standing for an Expert-restricted scope, which
  reaches retrieval as ``folder_subtree_ids``) and FO both hold an ``Acme GmbH`` document;
  ``folder_ids=[FE]`` returns ONLY FE's — a scope that stops narrowing widens to the whole KB
  (266 CR-01). ``None`` returns both; ``[]`` returns nothing.

Subjects are fresh single-org co-members (asserted from ``org_members`` first). Everything seeded
is deleted in ``finally``. Skip-guarded on :54322 — a skipped run is a SKIP, never a pass.
"""
from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from app.services import retrieval_scope as rscope
from tests.integration._271_gotrue_users import _admin, require_gotrue
from tests.integration._rls_harness import requires_pg
from tests.integration.test_163_rls_documents import _add_comember, _drop_user

pytestmark = requires_pg

ACME = {"field": "legal_entity", "op": "eq", "value": "Acme GmbH"}
OCTOBER = {"field": "date", "op": "between", "value": "2025-10-01", "value2": "2025-10-31"}


async def _folder(pool, *, owner, org, name, shared=True):
    fid = uuid4()
    await pool.execute(
        "INSERT INTO public.folders (id, user_id, org_id, name, is_org_shared) VALUES ($1,$2,$3,$4,$5)",
        fid, UUID(owner), UUID(org), name, shared,
    )
    return fid


async def _doc(pool, *, owner, org, folder, name, metadata):
    did = uuid4()
    await pool.execute(
        "INSERT INTO public.documents (id, user_id, org_id, folder_id, filename, file_path, file_size, "
        "mime_type, status, is_latest, version_number, metadata) "
        "VALUES ($1,$2,$3,$4,$5,$6,100,'text/markdown','completed',true,1,$7::jsonb)",
        # The pg_pool fixture registers a jsonb codec (encoder=json.dumps), so pass the DICT.
        did, UUID(owner), UUID(org), folder, name, f"{owner}/{did}.md", metadata,
    )
    return str(did)


async def _field_def(pool, *, uid, org):
    fid = uuid4()
    await pool.execute(
        "INSERT INTO public.metadata_field_definitions (id, user_id, org_id, field_key, field_type, enabled) "
        "VALUES ($1,$2,$3,'legal_entity','string',true)",
        fid, UUID(uid), UUID(org),
    )
    return fid


@pytest.fixture
async def world(pg_pool, two_orgs_two_users):
    # Step 1 is a SERVICE-ROLE PostgREST read (:54321) built from backend/.env — never the
    # placeholder `app.config.settings` the unit conftest installs (the 271 precedent).
    require_gotrue()
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    m = uuid4().hex[:8]
    docs: list[str] = []
    folders: list = []
    defs: list = []
    s_uid = t_uid = None
    try:
        s_uid = await _add_comember(pg_pool, a["org_id"])
        t_uid = await _add_comember(pg_pool, b["org_id"])
        for uid, org in ((s_uid, a["org_id"]), (t_uid, b["org_id"])):
            members = await pg_pool.fetch("SELECT org_id FROM public.org_members WHERE user_id = $1", UUID(uid))
            assert {str(r["org_id"]) for r in members} == {org}, "subjects must be single-org"
            defs.append(await _field_def(pg_pool, uid=uid, org=org))

        fe = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"272-FE-{m}")
        fo = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"272-FO-{m}")
        fb = await _folder(pg_pool, owner=b["uid"], org=b["org_id"], name=f"272-FB-{m}")
        folders += [fe, fo, fb]

        ids = {
            "a_oct": await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=fe, name=f"a-oct-{m}",
                                metadata={"legal_entity": "Acme GmbH", "date": "2025-10-15", "document_type": "Report"}),
            "a_sep": await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=fo, name=f"a-sep-{m}",
                                metadata={"legal_entity": "Acme GmbH", "date": "2025-09-10", "document_type": "Report"}),
            "a_undated": await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=fo, name=f"a-und-{m}",
                                    metadata={"legal_entity": "Acme GmbH", "document_type": "Memo"}),
            # Org A, but NOT visible to S: owned by A's admin, no folder, no connection.
            "a_private": await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=None, name=f"a-prv-{m}",
                                    metadata={"legal_entity": "Acme GmbH", "document_type": "Secret"}),
            "b_oct": await _doc(pg_pool, owner=b["uid"], org=b["org_id"], folder=fb, name=f"b-oct-{m}",
                                metadata={"legal_entity": "Acme GmbH", "date": "2025-10-20", "document_type": "Report"}),
            "b_undated": await _doc(pg_pool, owner=b["uid"], org=b["org_id"], folder=fb, name=f"b-und-{m}",
                                    metadata={"legal_entity": "ACME GMBH", "document_type": "Invoice"}),
        }
        docs += list(ids.values())
        yield {"s": s_uid, "t": t_uid, "fe": str(fe), "fo": str(fo), "fb": str(fb), **ids}
    finally:
        for did in docs:
            try:
                await pg_pool.execute("DELETE FROM public.documents WHERE id = $1", UUID(did))
            except Exception:
                pass
        for fid in folders:
            try:
                await pg_pool.execute("DELETE FROM public.folders WHERE id = $1", fid)
            except Exception:
                pass
        for fid in defs:
            try:
                await pg_pool.execute("DELETE FROM public.metadata_field_definitions WHERE id = $1", fid)
            except Exception:
                pass
        for uid in (s_uid, t_uid):
            if uid:
                await _drop_user(pg_pool, uid)


async def _resolve(uid, conditions, folder_ids=None):
    return await rscope.resolve_document_scope(
        user_id=uid, conditions=conditions, folder_ids=folder_ids, supabase=_admin(),
    )


async def test_rls_decides_and_org_b_is_never_in_the_set(world):
    s = await _resolve(world["s"], [ACME])
    assert set(s.document_ids) == {world["a_oct"], world["a_sep"], world["a_undated"]}
    assert world["a_private"] not in s.document_ids, "step 1 proposed it; RLS must have removed it"
    assert world["b_oct"] not in s.document_ids
    t = await _resolve(world["t"], [ACME])
    assert set(t.document_ids) == {world["b_oct"]}, "positive control: org B's member sees B's row"


async def test_undated_count_is_rls_intersected(world):
    res = await _resolve(world["s"], [ACME, OCTOBER])
    assert set(res.document_ids) == {world["a_oct"]}
    # a_undated is visible; a_private is undated too but invisible; b_undated is another org.
    assert res.undated_excluded == 1 and res.date_field == "date"


async def test_nearby_months_count_only_what_the_caller_can_read(world):
    out = await rscope.nearby_values(
        user_id=world["s"], conditions=[ACME, OCTOBER], field="date", folder_ids=None,
        supabase=_admin(),
    )
    assert out == [
        {"value": "2025-10", "label": "October 2025", "documents": 1},
        {"value": "2025-09", "label": "September 2025", "documents": 1},
    ], "b_oct would make October 2"


async def test_stored_spellings_are_rls_scoped(world):
    s = await rscope.canonical_stored_values(user_id=world["s"], field="legal_entity", value="acme gmbh")
    t = await rscope.canonical_stored_values(user_id=world["t"], field="legal_entity", value="acme gmbh")
    assert s == ["Acme GmbH"], s
    assert set(t) == {"Acme GmbH", "ACME GMBH"}, "positive control"


async def test_top_document_types_are_rls_scoped(world):
    s = dict(await rscope.top_document_types(user_id=world["s"], limit=50))
    t = dict(await rscope.top_document_types(user_id=world["t"], limit=50))
    assert s.get("report", 0) >= 2 and s.get("memo", 0) >= 1
    assert "invoice" not in s and "secret" not in s, s
    assert t.get("invoice", 0) >= 1, "positive control"


async def test_folder_scope_is_anded_never_dropped(world):
    scoped = await _resolve(world["s"], [ACME], folder_ids=[world["fe"]])
    assert set(scoped.document_ids) == {world["a_oct"]}, "FO's matching document leaked past the scope"
    unscoped = await _resolve(world["s"], [ACME], folder_ids=None)
    assert {world["a_oct"], world["a_sep"]} <= set(unscoped.document_ids)
    empty = await _resolve(world["s"], [ACME], folder_ids=[])
    assert empty.is_empty
