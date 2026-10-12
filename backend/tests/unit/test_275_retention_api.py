"""Phase 275-03 (RET-01 / D-02 / D-17 / D-28 / D-34 / D-35; revisions W-2, W-3b) — the /retention router.

The probe app includes ``retention.router`` ALONE and shares ``app.main.app.dependency_overrides`` (the
test_190 shape), so a refusal observed here is the router's own and not middleware ordering.

⚠ WHY THE MEMBER CASES ARE THE ONES TO READ (D-28, SC#1). A member is refused BY THE SERVER on every
write, preview, confirm, keep, un-archive, hold and run-now route — and ``_forbid_the_service`` makes
every write verb raise if it is reached at all, so "403" means "never written", not merely "the
status was 403". PLANT (record): delete ``Depends(require_org_manage)`` from any one route (falling
back to ``get_current_user``) and that route's member case goes red — the verb is reached.

The rest: Save needs a fresh server-recorded preview of the SAME draft (D-02); policy writes and hold
release run on the SERVICE pool, never under the authenticated role (W-2); a policy folder must be in
the active org but need not be org-shared (W-3b); a hold refuses ids the admin cannot read (D-35); a
wrong typed count deletes nothing (D-03); run-now is refused while sweeps are off (D-29); a member's
document-states carry no matter name, reason or placer (D-17); another org's ids read as absent.
"""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import retention as api
from app.db import retention as rdb
from app.main import app as real_app
from app.services.retention import disposition
from app.services.retention.evaluate import EvalContext, FamilyFacts, PolicyFacts, Stage
from app.services.retention.load import IncompleteEvaluation, OrgSnapshot

CALLER_ID = "00000000-0000-0000-0000-000000000001"
ACTIVE_ORG = "11111111-1111-1111-1111-111111111111"
OTHER_ORG = "22222222-2222-2222-2222-222222222222"
POLICY = "33333333-3333-4333-8333-333333333333"
HOLD = "44444444-4444-4444-8444-444444444444"
DOC = "55555555-5555-4555-8555-555555555555"
DOC2 = "55555555-5555-4555-8555-555555555556"
FOLDER = "66666666-6666-4666-8666-666666666666"
MATTER = "Halden v. Crane"
PLACER = "Amira Sato"

CLASS_DRAFT = {
    "name": "Contracts review", "document_type_norm": "Contract", "folder_id": None,
    "include_subfolders": True, "clock": "document_date",
    "stage1_value": 10, "stage1_unit": "years", "stage1_action": "review",
}
FOLDER_DRAFT = {**CLASS_DRAFT, "name": "Finance invoices", "document_type_norm": None, "folder_id": FOLDER,
                "stage1_action": "archive", "stage1_value": 7}


@pytest.fixture
def client():
    probe = FastAPI()
    probe.include_router(api.router)
    probe.dependency_overrides = real_app.dependency_overrides  # the SAME dict (test_190 precedent)
    return TestClient(probe)


def _h():
    return {"Authorization": "Bearer test-token", "X-Org-Id": ACTIVE_ORG}


def _perms(monkeypatch, manage: bool):
    async def _fake(request, current_user, org_id, permission_key):
        return manage if permission_key == "org:manage" else False

    monkeypatch.setattr("app.dependencies._has_org_permission", _fake)


def _member_of_org(monkeypatch, pool, role="member"):
    monkeypatch.setattr("app.dependencies._pg_pool", pool)
    pool.set_fetchrow_result({"role": role})


def _forbid_the_service(monkeypatch):
    def _never(*_a, **_kw):
        raise AssertionError("D-28: a retention write/verb was reached by a caller without org:manage")

    for name in ("insert_policy", "update_policy", "delete_policy", "release_hold", "record_preview",
                 "insert_receipt", "claim_org_sweep_now", "list_holds", "list_receipts", "read_sweep_row",
                 "get_policy", "get_hold", "fresh_preview_exists", "folder_org", "count_policies_and_holds"):
        monkeypatch.setattr(rdb, name, _never)
    for name in ("preview_draft", "confirm_batch", "unarchive_family", "run_org_sweep"):
        monkeypatch.setattr(disposition, name, _never)
    for name in ("_write_hold", "_write_coverage", "_readable_ids", "_snapshot", "_document_types", "_count_held"):
        monkeypatch.setattr(api, name, _never)


@pytest.fixture
def audits(monkeypatch):
    rows: list = []

    async def _audit(user_id, action_type, metadata, supabase, org_id=None):
        rows.append({"action_type": action_type, "org_id": org_id, "metadata": metadata})

    monkeypatch.setattr(api, "write_audit_entry", _audit)
    return rows


MANAGE_ROUTES = [
    ("get", "/retention/summary", None),
    ("get", "/retention/policies", None),
    ("post", "/retention/policies/preview", {"draft": CLASS_DRAFT}),
    ("post", "/retention/policies", CLASS_DRAFT),
    ("put", f"/retention/policies/{POLICY}", CLASS_DRAFT),
    ("delete", f"/retention/policies/{POLICY}", None),
    ("get", "/retention/document-types", None),
    ("get", "/retention/holds", None),
    ("post", "/retention/holds", {"name": MATTER, "reason": "Litigation", "document_ids": [DOC]}),
    ("post", f"/retention/holds/{HOLD}/coverage", {"document_ids": [DOC]}),
    ("post", f"/retention/holds/{HOLD}/release", {"note": None}),
    ("post", "/retention/holds/count", {"document_ids": [DOC]}),
    ("get", "/retention/queue", None),
    ("post", f"/retention/queue/{POLICY}/confirm", {"delete_ids": [DOC], "typed_count": 1}),
    ("post", f"/retention/documents/{DOC}/unarchive", None),
    ("get", "/retention/history", None),
    ("post", "/retention/sweep/run", None),
]


@pytest.mark.parametrize("method,path,body", MANAGE_ROUTES, ids=[f"{m} {p}" for m, p, _ in MANAGE_ROUTES])
def test_a_member_is_refused_by_the_server_and_nothing_is_reached(monkeypatch, mock_asyncpg_pool, client, audits, method, path, body):
    _member_of_org(monkeypatch, mock_asyncpg_pool)
    _perms(monkeypatch, manage=False)
    _forbid_the_service(monkeypatch)
    kwargs = {"headers": _h()}
    if body is not None:
        kwargs["json"] = body
    res = client.request(method.upper(), path, **kwargs)
    assert res.status_code == 403, (path, res.status_code, res.text)
    assert not audits


def test_every_manage_route_declares_the_gate_and_document_states_does_not():
    import inspect

    src = inspect.getsource(api)
    assert src.count("Depends(require_org_manage)") >= 15
    routes = {(next(iter(r.methods)), r.path): r for r in api.router.routes}
    assert len(routes) == 18
    for (method, path), route in routes.items():
        gated = any(getattr(d.call, "__name__", "") == "require_org_manage" for d in route.dependant.dependencies)
        if path == "/retention/document-states":
            assert not gated, "document-states is member-readable (D-17)"
        else:
            assert gated, f"{method} {path} lacks require_org_manage"


def test_the_router_is_registered_on_the_real_app():
    paths = {getattr(r, "path", "") for r in real_app.routes}
    assert "/retention/policies" in paths and "/retention/document-states" in paths


# ── admin happy paths + the D-02 preview gate ───────────────────────────────────────────────

@pytest.fixture
def admin(monkeypatch, mock_asyncpg_pool):
    _member_of_org(monkeypatch, mock_asyncpg_pool, role="admin")
    _perms(monkeypatch, manage=True)
    return mock_asyncpg_pool


def _preview_result():
    rows = {b: [] for b in disposition.BUCKETS}
    rows["act"] = [{"document_id": DOC, "name": "Kessler Services Agreement", "folder_path": "/Contracts", "document_date": "2014-09-30",
                    "due_at": "2024-09-30", "kind": "queue_review", "why": "", "other_policy_name": None, "hold_names": [],
                    "kept_by": None, "kept_at": None, "archived_at": None}]
    counts = {b: len(v) for b, v in rows.items()}
    counts["private_not_covered"] = 2
    return {"policy_id": None, "action": "review", "has_stage2": False, "buckets": rows, "counts": counts,
            "private_not_covered": 2, "sets": {"archive": [], "queue_delete": [], "queue_review": [DOC]}}


@pytest.fixture
def previews(monkeypatch, admin):
    recorded: set = set()

    async def _preview(pool, org_id, draft, *, editing_policy_id=None, now=None, snapshot=None):
        return _preview_result()

    async def _record(pool, org_id, *, policy_id, draft_hash, created_by, counts):
        recorded.add(draft_hash)

    async def _fresh(pool, org_id, draft_hash, *, minutes=30):
        return draft_hash in recorded

    async def _receipt(*a, **k):
        return None

    monkeypatch.setattr(disposition, "preview_draft", _preview)
    monkeypatch.setattr(rdb, "record_preview", _record)
    monkeypatch.setattr(rdb, "fresh_preview_exists", _fresh)
    monkeypatch.setattr(rdb, "insert_receipt", _receipt)
    return recorded


def test_preview_returns_buckets_the_private_count_and_a_draft_hash(client, previews, audits):
    res = client.post("/retention/policies/preview", headers=_h(), json={"draft": CLASS_DRAFT})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["buckets"]["act"][0]["name"] == "Kessler Services Agreement"
    assert body["private_not_covered"] == 2 and body["counts"]["private_not_covered"] == 2
    assert body["draft_hash"] in previews


def test_save_without_a_matching_fresh_preview_is_409_and_nothing_is_written(client, previews, monkeypatch, audits):
    monkeypatch.setattr(rdb, "insert_policy", lambda *a, **k: (_ for _ in ()).throw(AssertionError("written")))
    res = client.post("/retention/policies", headers=_h(), json=CLASS_DRAFT)
    assert res.status_code == 409 and res.json()["detail"] == "Preview again before saving."

    # previewed, then edited → a different canonical draft → still 409
    assert client.post("/retention/policies/preview", headers=_h(), json={"draft": CLASS_DRAFT}).status_code == 200
    edited = {**CLASS_DRAFT, "stage1_value": 11}
    res = client.post("/retention/policies", headers=_h(), json=edited)
    assert res.status_code == 409 and res.json()["detail"] == "Preview again before saving."
    assert not audits


def test_save_after_a_preview_writes_through_the_service_pool(client, previews, admin, monkeypatch, audits):
    assert client.post("/retention/policies/preview", headers=_h(), json={"draft": CLASS_DRAFT}).status_code == 200
    now = datetime(2026, 10, 12, tzinfo=timezone.utc)
    policy_row = {
        "id": POLICY, "org_id": ACTIVE_ORG, "name": "Contracts review", "scope_kind": "class", "folder_id": None,
        "include_subfolders": True, "document_type_norm": "contract", "clock": "document_date", "stage1_value": 10,
        "stage1_unit": "years", "stage1_action": "review", "stage2_value": None, "stage2_unit": None,
        "stage2_action": None, "revision": 1, "previewed_revision": 1, "created_by": CALLER_ID,
        "created_by_name": "test@example.com", "updated_by": CALLER_ID, "updated_by_name": "test@example.com",
        "created_at": now, "updated_at": now,
    }
    admin.set_fetchrow_results([{"role": "admin"}, policy_row])
    monkeypatch.setattr(rdb, "insert_receipt", _real_insert_receipt)
    res = client.post("/retention/policies", headers=_h(), json=CLASS_DRAFT)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["revision"] == 1 and body["previewed_revision"] == 1
    sqls = [c[0] for c in admin.calls]
    insert_i = next(i for i, s in enumerate(sqls) if "INSERT INTO public.retention_policies" in s)
    begin_i = max(i for i in range(insert_i) if sqls[i] == "transaction_enter")
    assert not any("SET LOCAL ROLE authenticated" in s for s in sqls[begin_i:insert_i]), "W-2: service pool, never the JWT role"
    assert any("policy_saved" in str(c[1]) for c in admin.calls if "retention_receipts" in c[0])
    assert any("INSERT INTO public.retention_sweeps" in s for s in sqls[insert_i:]), "a sweep claim row is seeded"
    assert audits == [{"action_type": "retention.policy.create", "org_id": ACTIVE_ORG, "metadata": audits[0]["metadata"]}]


_real_insert_receipt = rdb.insert_receipt


def test_a_policy_folder_in_another_org_is_422_and_one_in_this_org_need_not_be_shared(client, previews, admin, monkeypatch, audits):
    calls: list = []

    async def _folder_org(pool, folder_id):
        return OTHER_ORG

    async def _insert(pool, org_id, draft, *, actor_id, actor_name, now=None):
        calls.append(draft)
        return {**draft, "id": POLICY, "org_id": ACTIVE_ORG, "revision": 1, "previewed_revision": 1,
                "created_by_name": actor_name, "updated_by_name": actor_name,
                "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}

    monkeypatch.setattr(rdb, "folder_org", _folder_org)
    monkeypatch.setattr(rdb, "insert_policy", _insert)
    assert client.post("/retention/policies/preview", headers=_h(), json={"draft": FOLDER_DRAFT}).status_code == 422
    res = client.post("/retention/policies", headers=_h(), json=FOLDER_DRAFT)
    assert res.status_code == 422 and res.json()["detail"] == "That folder is not in this organization."
    assert not calls

    async def _same_org(pool, folder_id):
        return ACTIVE_ORG  # in the org; NOT org-shared — there is no shared-folder rule here (W-3b)

    monkeypatch.setattr(rdb, "folder_org", _same_org)
    assert client.post("/retention/policies/preview", headers=_h(), json={"draft": FOLDER_DRAFT}).status_code == 200
    res = client.post("/retention/policies", headers=_h(), json=FOLDER_DRAFT)
    assert res.status_code == 201, res.text
    assert calls and calls[0]["scope_kind"] == "folder"


def test_draft_validation_messages():
    from app.models.retention import PolicyDraft

    with pytest.raises(ValueError, match="A policy needs a document type, a folder, or both."):
        PolicyDraft(**{**CLASS_DRAFT, "document_type_norm": None})
    with pytest.raises(ValueError, match="Give the policy a name."):
        PolicyDraft(**{**CLASS_DRAFT, "name": "   "})
    with pytest.raises(ValueError, match="The delete step must come after the archive step."):
        PolicyDraft(**{**FOLDER_DRAFT, "stage1_value": 2, "stage1_unit": "years", "stage2_value": 12, "stage2_unit": "months"})
    ok = PolicyDraft(**{**FOLDER_DRAFT, "clock": "date_added", "stage1_value": 1, "stage1_unit": "days",
                        "stage2_value": 2, "stage2_unit": "days"})
    assert ok.to_row()["stage2_action"] == "delete"
    with pytest.raises(ValueError):
        PolicyDraft(**{**CLASS_DRAFT, "stage2_value": 2, "stage2_unit": "days"})  # stage 2 only after an archive
    with pytest.raises(ValueError):
        PolicyDraft(**{**CLASS_DRAFT, "surprise": 1})  # extra="forbid"


async def test_the_preview_ttl_is_thirty_minutes_in_sql(mock_asyncpg_pool):
    mock_asyncpg_pool.set_fetchval_result(True)
    assert await rdb.fresh_preview_exists(mock_asyncpg_pool, ACTIVE_ORG, "h") is True
    sql, args = mock_asyncpg_pool.calls[-1]
    assert "retention_previews" in sql and "org_id = $1" in sql and "draft_hash = $2" in sql
    assert args[2] == "30"


def test_incomplete_preview_is_503_and_records_no_preview(client, admin, monkeypatch, audits):
    recorded: list = []

    async def _boom(*a, **k):
        raise IncompleteEvaluation("a folder cycle")

    async def _record(*a, **k):
        recorded.append(1)

    monkeypatch.setattr(disposition, "preview_draft", _boom)
    monkeypatch.setattr(rdb, "record_preview", _record)
    res = client.post("/retention/policies/preview", headers=_h(), json={"draft": CLASS_DRAFT})
    assert res.status_code == 503
    assert res.json()["detail"] == "Preview couldn't finish, so this policy can't be saved yet. Nothing was changed."
    assert not recorded


def test_another_orgs_policy_hold_or_document_reads_as_absent(client, admin, monkeypatch, audits):
    async def _none(*a, **k):
        return None

    monkeypatch.setattr(rdb, "get_policy", _none)
    monkeypatch.setattr(rdb, "get_hold", _none)
    monkeypatch.setattr(rdb, "delete_policy", _none)

    async def _not_found(*a, **k):
        raise disposition.NotFound("Document not found.")

    monkeypatch.setattr(disposition, "unarchive_family", _not_found)
    assert client.put(f"/retention/policies/{POLICY}", headers=_h(), json=CLASS_DRAFT).status_code == 404
    assert client.delete(f"/retention/policies/{POLICY}", headers=_h()).status_code == 404
    assert client.post(f"/retention/holds/{HOLD}/release", headers=_h(), json={}).status_code == 404
    assert client.post(f"/retention/holds/{HOLD}/coverage", headers=_h(), json={"document_ids": [DOC]}).status_code == 404
    assert client.post(f"/retention/documents/{DOC}/unarchive", headers=_h()).status_code == 404
    assert not audits


def test_hold_release_runs_on_the_service_pool(client, admin, monkeypatch, audits):
    async def _hold(pool, org_id, hold_id):
        return {"id": HOLD, "org_id": ACTIVE_ORG, "name": MATTER, "released_at": None}

    async def _count(*a, **k):
        return 3

    monkeypatch.setattr(rdb, "get_hold", _hold)
    monkeypatch.setattr(api, "_count_released", _count)
    admin.set_fetchrow_results([{"role": "admin"}, {"id": HOLD, "name": MATTER, "released_at": datetime.now(timezone.utc)}])
    res = client.post(f"/retention/holds/{HOLD}/release", headers=_h(), json={"note": "Case settled"})
    assert res.status_code == 200, res.text
    sqls = [c[0] for c in admin.calls]
    upd = next(i for i, s in enumerate(sqls) if "UPDATE public.legal_holds" in s and "released_at = now()" in s)
    begin_i = max(i for i in range(upd) if sqls[i] == "transaction_enter")
    assert not any("SET LOCAL ROLE authenticated" in s for s in sqls[begin_i:upd]), "W-2: service pool"
    assert audits and audits[0]["action_type"] == "retention.hold.release" and audits[0]["org_id"] == ACTIVE_ORG


def test_a_hold_on_an_unreadable_or_foreign_id_is_422_and_nothing_is_written(client, admin, monkeypatch, audits):
    async def _readable(conn, org, doc_ids, folder_ids):
        return set(), set()  # RLS read returned none of the picked ids

    def _never(*a, **k):
        raise AssertionError("D-35: a hold was written over ids the admin cannot read")

    monkeypatch.setattr(api, "_readable_ids", _readable)
    monkeypatch.setattr(api, "_write_hold", _never)
    res = client.post("/retention/holds", headers=_h(), json={"name": MATTER, "reason": "Litigation", "document_ids": [DOC]})
    assert res.status_code == 422
    assert not audits


def test_a_wrong_typed_count_is_422_and_nothing_is_deleted(client, admin, audits):
    res = client.post(f"/retention/queue/{POLICY}/confirm", headers=_h(), json={"delete_ids": [DOC, DOC2], "typed_count": 1})
    assert res.status_code == 422
    assert "Type 2 to confirm." in res.text
    assert not any("DELETE FROM public.documents" in c[0] for c in admin.calls)


def test_run_now_is_refused_while_scheduled_sweeps_are_off(client, admin, monkeypatch, audits):
    def _never(*a, **k):
        raise AssertionError("claimed while the flag is off")

    monkeypatch.setattr(rdb, "claim_org_sweep_now", _never)
    monkeypatch.setattr(api.settings, "retention_sweep_enabled", False)
    res = client.post("/retention/sweep/run", headers=_h())
    assert res.status_code == 409 and "Scheduled sweeps are off" in res.json()["detail"]


# ── document-states: names reach org admins only (D-17) ─────────────────────────────────────

def _snapshot_with_a_held_document() -> OrgSnapshot:
    fam = FamilyFacts(
        family_key="k1", latest_id=DOC, row_ids=(DOC,), file_paths=("u/d",), org_id=ACTIVE_ORG,
        folder_id=FOLDER, document_type_norm=None, date_typed=None,
        created_at=datetime(2020, 1, 1, tzinfo=timezone.utc), archived_at=None, org_visible=True, name="Kessler.pdf",
    )
    p = PolicyFacts(id=POLICY, name="Expired contracts", scope_kind="folder", folder_id=FOLDER, include_subfolders=True,
                    document_type_norm=None, clock="date_added", stage1=Stage(1, "years", "delete"), stage2=None,
                    revision=1, previewed_revision=1)
    ctx = EvalContext(folder_parent={FOLDER: None}, folder_policies={FOLDER: p}, class_policies={},
                      held={"k1": datetime(2026, 8, 3, tzinfo=timezone.utc)})
    return OrgSnapshot(
        org_id=ACTIVE_ORG, families=[fam], ctx=ctx, policies={POLICY: p}, policy_rows={}, folder_paths={FOLDER: "/Contracts"},
        folders={FOLDER: {"id": FOLDER, "name": "Contracts"}},
        holds={HOLD: {"id": HOLD, "name": MATTER, "reason": "Litigation — preserve everything",
                      "created_by_name": PLACER, "created_at": datetime(2026, 8, 3, tzinfo=timezone.utc)}},
        family_holds={"k1": [HOLD]}, folder_holds={FOLDER: [HOLD]}, doc_family={DOC: "k1"}, family_latest={},
    )


@pytest.fixture
def states(monkeypatch, mock_asyncpg_pool):
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "member"})

    async def _readable(conn, org, doc_ids, folder_ids):
        return {DOC} & {str(d) for d in doc_ids}, {FOLDER} & {str(f) for f in folder_ids}

    async def _snap(org_id):
        return _snapshot_with_a_held_document()

    monkeypatch.setattr(api, "_readable_ids", _readable)
    monkeypatch.setattr(api, "_snapshot", _snap)


def test_a_member_sees_the_hold_but_never_the_matter_reason_or_placer(client, states, monkeypatch):
    _perms(monkeypatch, manage=False)
    res = client.post("/retention/document-states", headers=_h(), json={"document_ids": [DOC, DOC2], "folder_ids": [FOLDER]})
    assert res.status_code == 200, res.text
    body = res.json()
    assert [d["document_id"] for d in body["documents"]] == [DOC], "an unreadable id is omitted (RLS read first)"
    st = body["documents"][0]
    assert st["held"] is True and st["chip"] == "on_hold"
    assert st["hold_line"] == "On legal hold. Ask an org admin."
    assert "hold_names" not in st
    assert body["folders"][0]["held"] is True and "hold_names" not in body["folders"][0]
    for leak in (MATTER, "Halden", PLACER, "Litigation"):
        assert leak not in res.text, f"D-17: {leak!r} reached a member"


def test_an_admin_sees_the_matter_and_the_placer(client, states, monkeypatch):
    _perms(monkeypatch, manage=True)
    res = client.post("/retention/document-states", headers=_h(), json={"document_ids": [DOC], "folder_ids": [FOLDER]})
    assert res.status_code == 200, res.text
    st = res.json()["documents"][0]
    assert st["hold_names"] == [MATTER]
    assert MATTER in st["hold_line"] and PLACER in st["hold_line"]
    assert res.json()["folders"][0]["hold_names"] == [MATTER]
