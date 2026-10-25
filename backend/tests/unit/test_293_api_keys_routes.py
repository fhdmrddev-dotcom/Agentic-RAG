"""Phase 293-01 (START-02; D-02, D-03, D-04, D-11, D-16, D-17, D-19; T-293-02, T-293-04, T-293-05).

The management routes: ``/api-keys`` (a member's own keys) and ``/org/api-keys`` (an org admin
sees and revokes every key). Both routers are mounted on a FRESH ``FastAPI()`` with dependency
overrides — ⛔ never ``app.main.app``'s lifespan (SEED-363).

``db/api_keys`` is replaced by an in-memory store that applies the SAME predicates the SQL does
(owner, org, published, system-global), so a route that forgot a scope would read a row it must
not and the assertions below would see it.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import api_keys as route
from app.models.user_settings import _build_settings_from_row
from app.security import api_key_auth as auth
from app.services import entitlement_service

ORG = "44444444-4444-4444-8444-444444444444"
OTHER_ORG = "99999999-9999-4999-8999-999999999999"
USER = "33333333-3333-4333-8333-333333333333"
OTHER_USER = "88888888-8888-4888-8888-888888888888"
ADMIN = "66666666-6666-4666-8666-666666666666"

WF_PUB = "55555555-5555-4555-8555-555555555555"
WF_DRAFT = "55555555-5555-4555-8555-000000000001"
WF_FOREIGN = "55555555-5555-4555-8555-000000000002"
WF_FILE = "55555555-5555-4555-8555-000000000003"
WF_GLOBAL = "55555555-5555-4555-8555-000000000004"
WF_UNKNOWN = "55555555-5555-4555-8555-00000000ffff"

CONTRACT = json.loads(
    (Path(__file__).resolve().parents[1] / "fixtures" / "phase293" / "api_keys_contract.json")
    .read_text(encoding="utf-8")
)


def _wf(id_, name, *, status="published", created_by=USER, org_id=ORG, glob=False, definition=None):
    return {
        "id": uuid.UUID(id_), "name": name, "status": status, "created_by": uuid.UUID(created_by),
        "org_id": uuid.UUID(org_id), "is_system_global": glob,
        "definition": definition if definition is not None else {
            "inputs": [{"key": "customer", "label": "Customer", "type": "text"}]
        },
    }


class _Store:
    def __init__(self):
        self.workflows = {
            WF_PUB: _wf(WF_PUB, "Contract review"),
            WF_DRAFT: _wf(WF_DRAFT, "Half-built intake", status="draft"),
            WF_FOREIGN: _wf(WF_FOREIGN, "Their secret workflow", created_by=OTHER_USER, org_id=OTHER_ORG),
            WF_FILE: _wf(WF_FILE, "Invoice reader", definition={
                "inputs": [{"key": "invoice", "label": "Invoice", "type": "file"}]
            }),
            WF_GLOBAL: _wf(WF_GLOBAL, "Starter summary", created_by=OTHER_USER, org_id=OTHER_ORG, glob=True),
        }
        self.keys: list[dict] = []
        self.calls: list[dict] = []
        self.names = {USER: "Dana Kim", OTHER_USER: "Lee Park", ADMIN: "Ada Admin"}

    def readable(self, w, user_id, org_id):
        return (str(w["created_by"]) == str(user_id) and str(w["org_id"]) == str(org_id)) or (
            w["is_system_global"] and w["status"] == "published"
        )

    def project(self, k):
        out = {c: k[c] for c in (
            "id", "org_id", "user_id", "label", "key_prefix", "workflows", "expires_at",
            "revoked_at", "revoked_by", "last_used_at", "created_at",
        )}
        out["owner_name"] = self.names.get(str(k["user_id"]))
        out["revoked_by_name"] = self.names.get(str(k["revoked_by"])) if k["revoked_by"] else None
        return out


@pytest.fixture
def store(monkeypatch):
    s = _Store()
    db = route.api_keys_db

    async def create_api_key(pool, *, org_id, user_id, label, key_prefix, key_hash, workflows, expires_at):
        for k in s.keys:
            if (str(k["org_id"]), str(k["user_id"])) == (str(org_id), str(user_id)) and \
               k["label"].strip().lower() == label.strip().lower() and k["revoked_at"] is None:
                raise db.DuplicateKeyLabel(label)
        row = {
            "id": uuid.uuid4(), "org_id": uuid.UUID(str(org_id)), "user_id": uuid.UUID(str(user_id)),
            "label": label, "key_prefix": key_prefix, "key_hash": key_hash, "workflows": workflows,
            "expires_at": expires_at, "revoked_at": None, "revoked_by": None, "last_used_at": None,
            "created_at": datetime.now(timezone.utc),
        }
        s.keys.append(row)
        out = s.project(row)
        out.pop("owner_name"); out.pop("revoked_by_name")
        return out

    async def list_keys_for_owner(pool, *, org_id, user_id):
        return [s.project(k) for k in s.keys
                if str(k["org_id"]) == str(org_id) and str(k["user_id"]) == str(user_id)]

    async def list_keys_for_org(pool, *, org_id):
        return [s.project(k) for k in s.keys if str(k["org_id"]) == str(org_id)]

    async def revoke_key(pool, *, key_id, org_id, owner_id, revoked_by):
        for k in s.keys:
            if str(k["id"]) != str(key_id) or str(k["org_id"]) != str(org_id):
                continue
            if owner_id is not None and str(k["user_id"]) != str(owner_id):
                continue
            if k["revoked_at"] is None:
                k["revoked_at"] = datetime.now(timezone.utc)
                k["revoked_by"] = uuid.UUID(str(revoked_by))
            return s.project(k)
        return None

    async def list_key_calls(pool, *, org_id, key_ids, since):
        return [c for c in s.calls if c["metadata"].get("api_key_id") in key_ids]

    async def get_key_workflows(pool, *, workflow_ids, user_id, org_id):
        out = []
        for wid in workflow_ids:
            w = s.workflows.get(str(wid))
            if w is None:
                continue
            ok = s.readable(w, user_id, org_id)
            out.append({
                "id": w["id"], "readable": ok,
                "name": w["name"] if ok else None,
                "status": w["status"] if ok else None,
                "definition": w["definition"] if ok else None,
            })
        return out

    async def list_startable_candidates(pool, *, user_id, org_id):
        return [
            {"id": w["id"], "name": w["name"], "definition": w["definition"]}
            for w in s.workflows.values()
            if w["status"] == "published" and str(w["created_by"]) == str(user_id)
            and str(w["org_id"]) == str(org_id)
        ]

    async def count_own_drafts(pool, *, user_id, org_id):
        return sum(
            1 for w in s.workflows.values()
            if w["status"] == "draft" and str(w["created_by"]) == str(user_id)
            and str(w["org_id"]) == str(org_id)
        )

    for name, fn in {
        "create_api_key": create_api_key, "list_keys_for_owner": list_keys_for_owner,
        "list_keys_for_org": list_keys_for_org, "revoke_key": revoke_key,
        "list_key_calls": list_key_calls, "get_key_workflows": get_key_workflows,
        "list_startable_candidates": list_startable_candidates, "count_own_drafts": count_own_drafts,
    }.items():
        monkeypatch.setattr(db, name, fn)

    s.audits = []

    async def _write(user_id, action_type, metadata, supabase, org_id=None):
        s.audits.append({"user_id": user_id, "action_type": action_type, "metadata": metadata, "org_id": org_id})

    monkeypatch.setattr(auth, "write_audit_entry", _write)
    monkeypatch.setattr(auth, "get_service_role_supabase", lambda org_id: object())

    async def _settings():
        return _build_settings_from_row({"api_key_starts_per_minute": 7, "api_key_reads_per_minute": 90})

    monkeypatch.setattr(route, "load_app_settings_async", _settings)
    s.entitled = True

    async def _entitlement(pool, org_id, capability):
        if s.entitled:
            return True, "pro", "pro", None
        return False, "free", "pro", "Capability not in tier"

    monkeypatch.setattr(entitlement_service, "resolve_org_entitlement", _entitlement)
    s.is_admin = False

    async def _perm(request, current_user, active_org, perm):
        return s.is_admin

    monkeypatch.setattr(deps, "_has_org_permission", _perm)
    s.caller = USER
    return s


@pytest.fixture
def client(store):
    app = FastAPI()
    app.include_router(route.router)
    app.include_router(route.org_router)

    async def _user():
        return {"id": store.caller, "email": "t@example.com"}

    async def _org():
        return ORG

    async def _pool():
        return object()

    app.dependency_overrides[deps.get_current_user] = _user
    app.dependency_overrides[deps.get_active_org_id] = _org
    app.dependency_overrides[deps.get_pg_pool] = _pool
    return TestClient(app)


def _paths(obj, prefix="") -> set[str]:
    out = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.startswith("_"):
                continue
            p = f"{prefix}.{k}" if prefix else k
            out.add(p)
            out |= _paths(v, p)
    elif isinstance(obj, list):
        for v in obj:
            out |= _paths(v, prefix + "[]")
    return out


def _all_keys(obj) -> set[str]:
    out = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.add(k)
            out |= _all_keys(v)
    elif isinstance(obj, list):
        for v in obj:
            out |= _all_keys(v)
    return out


def _create(client, **kw):
    body = {"label": "n8n-prod", "workflow_ids": [WF_PUB]}
    body.update(kw)
    return client.post("/api-keys", json=body)


# ── create ─────────────────────────────────────────────────────────────────────────────────────


def test_create_returns_the_secret_once_in_the_contract_shape(client, store):
    r = _create(client)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["secret"].startswith("srl_live_")
    assert _paths(body) == _paths(CONTRACT["ApiKeyCreated"])
    assert body["key"]["key_prefix"] == body["secret"][:13]
    assert body["key"]["workflows"] == [{"id": WF_PUB, "name": "Contract review", "state": "startable"}]
    assert body["key"]["state"] == "active"
    # Default expiry is 90 days (D-04).
    exp = datetime.fromisoformat(body["key"]["expires_at"].replace("Z", "+00:00"))
    assert timedelta(days=89) < exp - datetime.now(timezone.utc) <= timedelta(days=90)
    # The stored row holds only the digest.
    stored = store.keys[0]
    assert stored["key_hash"] == auth.digest_key(body["secret"])
    assert body["secret"] not in repr({k: v for k, v in stored.items() if k != "key_hash"})


def test_create_with_never_expires(client, store):
    r = _create(client, expires_in_days=None)
    assert r.status_code == 201, r.text
    assert r.json()["key"]["expires_at"] is None


def test_create_with_an_unlisted_expiry_is_refused(client, store):
    assert _create(client, expires_in_days=7).status_code == 422


def test_create_pins_the_definition_row_id_and_snapshots_its_name(client, store):
    _create(client, workflow_ids=[WF_PUB, WF_GLOBAL])
    assert store.keys[0]["workflows"] == [
        {"id": WF_PUB, "name": "Contract review"},
        {"id": WF_GLOBAL, "name": "Starter summary"},
    ]


def test_create_audits_api_key_create_naming_id_and_label_never_the_secret(client, store):
    body = _create(client).json()
    (entry,) = store.audits
    assert entry["action_type"] == "api_key.create"
    assert entry["org_id"] == ORG
    md = entry["metadata"]
    assert md["api_key_id"] == body["key"]["id"]
    assert md["api_key_label"] == "n8n-prod"
    assert md["call"] == "manage"
    assert body["secret"] not in repr(md)
    assert "key_hash" not in md and "secret" not in md


def test_a_draft_is_refused_by_name(client, store):
    r = _create(client, workflow_ids=[WF_DRAFT])
    assert r.status_code == 422
    assert "Half-built intake" in r.json()["detail"]
    assert store.keys == []


def test_a_foreign_and_an_unknown_id_are_refused_identically(client, store):
    foreign = _create(client, workflow_ids=[WF_FOREIGN])
    unknown = _create(client, workflow_ids=[WF_UNKNOWN])
    assert foreign.status_code == unknown.status_code == 422
    assert "Their secret workflow" not in foreign.text
    assert foreign.json()["detail"].replace(WF_FOREIGN, "<id>") == \
        unknown.json()["detail"].replace(WF_UNKNOWN, "<id>")
    assert store.keys == []


def test_a_file_upload_workflow_is_refused(client, store):
    r = _create(client, workflow_ids=[WF_FILE])
    assert r.status_code == 422
    assert "needs a file upload" in r.json()["detail"]
    assert "Invoice reader" in r.json()["detail"]


def test_a_duplicate_active_label_is_409(client, store):
    assert _create(client).status_code == 201
    r = _create(client, label="  N8N-prod ")
    assert r.status_code == 409
    assert r.json()["detail"] == "You already have an active key called N8N-prod. Pick another label."


def test_an_org_without_the_workflows_capability_gets_the_entitlement_403(client, store):
    store.entitled = False
    r = _create(client)
    assert r.status_code == 403
    assert r.json()["detail"]["error"] == "entitlement_required"
    assert store.keys == []


@pytest.mark.parametrize("label", ["", "   ", "x" * 61])
def test_a_bad_label_is_422(client, store, label):
    assert _create(client, label=label).status_code == 422


def test_an_extra_body_field_is_refused(client, store):
    assert _create(client, user_id=OTHER_USER).status_code == 422


# ── list ───────────────────────────────────────────────────────────────────────────────────────


def _seed_call(store, key_id, *, action="api_key.start", call="start", reason=None):
    md = {"api_key_id": key_id, "api_key_label": "n8n-prod", "call": call, "workflow_id": WF_PUB,
          "run_id": "77777777-7777-4777-8777-777777777777", "outcome": "started"}
    if reason:
        md["reason"] = reason
        md.pop("outcome")
    store.calls.append({"action_type": action, "metadata": md, "created_at": datetime.now(timezone.utc)})


def test_list_matches_the_contract_and_never_carries_secret_or_digest(client, store):
    key_id = _create(client).json()["key"]["id"]
    _seed_call(store, key_id)
    r = client.get("/api-keys")
    assert r.status_code == 200, r.text
    body = r.json()
    assert _paths(body) == _paths(CONTRACT["ApiKeyList"])
    assert "secret" not in _all_keys(body)
    assert "key_hash" not in _all_keys(body)
    assert body["limits"] == {"starts_per_minute": 7, "reads_per_minute": 90}
    (call,) = body["keys"][0]["calls"]
    assert call["verb"] == "start" and call["ok"] is True
    assert call["workflow_name"] == "Contract review"
    assert body["keys"][0]["owner_is_you"] is True


def test_a_refused_call_reads_as_not_ok_with_its_reason(client, store):
    key_id = _create(client).json()["key"]["id"]
    _seed_call(store, key_id, action="api_key.refused", call="read", reason="over_limit")
    (call,) = client.get("/api-keys").json()["keys"][0]["calls"]
    assert call == {**call, "verb": "read", "ok": False, "reason": "over_limit"}


def test_list_shows_only_the_callers_keys(client, store):
    _create(client)
    store.caller = OTHER_USER
    assert client.get("/api-keys").json()["keys"] == []


def test_list_computes_each_workflow_state_live(client, store):
    _create(client, workflow_ids=[WF_PUB, WF_GLOBAL])
    store.workflows[WF_PUB]["status"] = "draft"   # unpublished after the key was made
    del store.workflows[WF_GLOBAL]                 # deleted
    refs = client.get("/api-keys").json()["keys"][0]["workflows"]
    assert [(w["id"], w["state"]) for w in refs] == [(WF_PUB, "unpublished"), (WF_GLOBAL, "deleted")]


def test_a_revoked_and_an_expired_key_read_as_such(client, store):
    _create(client, label="a")
    _create(client, label="b")
    store.keys[0]["revoked_at"] = datetime.now(timezone.utc)
    store.keys[0]["revoked_by"] = uuid.UUID(USER)
    store.keys[1]["expires_at"] = datetime.now(timezone.utc) - timedelta(days=1)
    states = {k["label"]: k["state"] for k in client.get("/api-keys").json()["keys"]}
    assert states == {"a": "revoked", "b": "expired"}


# ── startable workflows ────────────────────────────────────────────────────────────────────────


def test_startable_workflows_lists_own_published_in_this_org_with_fields(client, store):
    r = client.get("/api-keys/startable-workflows")
    assert r.status_code == 200, r.text
    body = r.json()
    by_id = {w["id"]: w for w in body["workflows"]}
    assert set(by_id) == {WF_PUB, WF_FILE}
    assert by_id[WF_PUB]["startable"] is True
    assert by_id[WF_PUB]["fields"] == [{"key": "customer", "label": "Customer", "required": True}]
    assert by_id[WF_FILE] == {**by_id[WF_FILE], "startable": False, "reason": "file_upload"}
    assert body["drafts_hidden"] == 1


# ── revoke ─────────────────────────────────────────────────────────────────────────────────────


def test_a_member_revokes_their_own_key_and_it_is_audited(client, store):
    key_id = _create(client).json()["key"]["id"]
    store.audits.clear()
    r = client.post(f"/api-keys/{key_id}/revoke")
    assert r.status_code == 200, r.text
    assert r.json()["state"] == "revoked"
    assert r.json()["revoked_by_admin"] is False
    (entry,) = store.audits
    assert entry["action_type"] == "api_key.revoke"
    assert entry["metadata"]["api_key_id"] == key_id


def test_revoking_another_members_key_is_404(client, store):
    key_id = _create(client).json()["key"]["id"]
    store.caller = OTHER_USER
    r = client.post(f"/api-keys/{key_id}/revoke")
    assert r.status_code == 404
    assert r.json() == {"detail": "API key not found."}
    assert store.keys[0]["revoked_at"] is None


def test_an_unknown_key_id_is_404(client, store):
    assert client.post(f"/api-keys/{uuid.uuid4()}/revoke").status_code == 404


def test_the_org_routes_refuse_a_non_admin(client, store):
    key_id = _create(client).json()["key"]["id"]
    store.caller = OTHER_USER
    store.is_admin = False
    assert client.get("/org/api-keys").status_code == 403
    r = client.post(f"/org/api-keys/{key_id}/revoke")
    assert r.status_code == 403
    assert r.json() == {"detail": "You do not have permission to manage this organization."}
    assert store.keys[0]["revoked_at"] is None


def test_an_admin_lists_every_key_with_owner_names(client, store):
    _create(client)
    store.caller = ADMIN
    store.is_admin = True
    keys = client.get("/org/api-keys").json()["keys"]
    assert len(keys) == 1
    assert keys[0]["owner_name"] == "Dana Kim"
    assert keys[0]["owner_is_you"] is False
    assert "key_hash" not in _all_keys(keys) and "secret" not in _all_keys(keys)


def test_an_admin_revoke_names_the_admin_and_audits_by_admin(client, store):
    key_id = _create(client).json()["key"]["id"]
    store.audits.clear()
    store.caller = ADMIN
    store.is_admin = True
    r = client.post(f"/org/api-keys/{key_id}/revoke")
    assert r.status_code == 200, r.text
    assert str(store.keys[0]["revoked_by"]) == ADMIN
    assert r.json()["revoked_by_admin"] is True
    assert r.json()["revoked_by_name"] == "Ada Admin"
    (entry,) = store.audits
    assert entry["action_type"] == "api_key.revoke"
    assert entry["user_id"] == ADMIN         # attributed to whoever ACTED, in the key's org
    assert entry["org_id"] == ORG
    assert entry["metadata"]["api_key_id"] == key_id
    assert entry["metadata"]["detail"] == {"by_admin": True, "owner_id": USER}


def test_no_model_but_the_create_response_has_a_secret_field():
    from app.models import api_key as m

    with_secret = [
        name for name, obj in vars(m).items()
        if isinstance(obj, type) and hasattr(obj, "model_fields") and "secret" in obj.model_fields
    ]
    assert with_secret == ["ApiKeyCreated"]
    for name, obj in vars(m).items():
        if isinstance(obj, type) and hasattr(obj, "model_fields"):
            assert "key_hash" not in obj.model_fields, name
