"""Phase 304-04 (KEY-01, KEY-03, KEY-04, KEY-05; D-07, D-08, D-11, D-12, D-25, D-28, D-30, D-40, D-41).

The 293 key routes learn ``kind``. A body without ``kind`` is the 293 workflow key, byte-for-byte
(``test_293_api_keys_routes.py`` runs unedited); ``kind="mcp"`` mints a personal MCP key whose
tools and folders are refused server-side in plain words, never trusted from the client.

Both routers are mounted on a FRESH ``FastAPI()`` with dependency overrides — never
``app.main.app``'s lifespan (SEED-363). ``db/api_keys`` is an in-memory store; the acting
connection and ``list_acting_folders`` are fakes that record the user and org they were opened
for, so a route that validated folders on anything but the member's own acting visibility would
show up here.
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import api_keys as route
from app.models.user_settings import _build_settings_from_row
from app.security import api_key_auth as auth
from app.security.principal_liveness import MCP_OFF_DEPLOYMENT_SENTENCE, MCP_OFF_ORG_SENTENCE
from app.services import entitlement_service
from app.services.mcp_tool_catalogue import MCP_TOOLS, PRESETS

ORG = "44444444-4444-4444-8444-444444444444"
OTHER_ORG = "99999999-9999-4999-8999-999999999999"
USER = "33333333-3333-4333-8333-333333333333"
OTHER_USER = "88888888-8888-4888-8888-888888888888"
ADMIN = "66666666-6666-4666-8666-666666666666"

WF_PUB = "55555555-5555-4555-8555-555555555555"

F_OWN = "f0000000-0000-4000-8000-000000000001"
F_CHILD = "f0000000-0000-4000-8000-000000000002"
F_SHARED = "f0000000-0000-4000-8000-000000000003"
F_SYNCED = "f0000000-0000-4000-8000-000000000004"
F_MAIL = "f0000000-0000-4000-8000-000000000005"
F_FOREIGN = "f0000000-0000-4000-8000-0000000000ff"   # another org's folder
F_UNKNOWN = "f0000000-0000-4000-8000-00000000ffff"   # never existed

FOLDER_SENTENCE = "One of the picked folders can't be found, or you can't see it."


class _Store:
    def __init__(self):
        self.workflows = {
            WF_PUB: {
                "id": uuid.UUID(WF_PUB), "name": "Contract review", "status": "published",
                "created_by": uuid.UUID(USER), "org_id": uuid.UUID(ORG),
                "definition": {"inputs": [{"key": "customer", "label": "Customer", "type": "text"}]},
            },
        }
        # Folders by org; ``visible`` is what RLS + the acting GUC would show the member in ORG.
        self.folders = {
            F_OWN: {"id": F_OWN, "name": "Contracts", "parent_id": None, "is_org_shared": False,
                    "org_id": ORG, "user_id": USER},
            F_CHILD: {"id": F_CHILD, "name": "2026", "parent_id": F_OWN, "is_org_shared": False,
                      "org_id": ORG, "user_id": USER},
            F_SHARED: {"id": F_SHARED, "name": "Team handbook", "parent_id": None,
                       "is_org_shared": True, "org_id": ORG, "user_id": None},
            F_SYNCED: {"id": F_SYNCED, "name": "Drive sync", "parent_id": None,
                       "is_org_shared": False, "org_id": ORG, "user_id": USER},
            F_MAIL: {"id": F_MAIL, "name": "Inbox", "parent_id": None, "is_org_shared": False,
                     "org_id": ORG, "user_id": USER},
            F_FOREIGN: {"id": F_FOREIGN, "name": "Their private folder", "parent_id": None,
                        "is_org_shared": False, "org_id": OTHER_ORG, "user_id": USER},
        }
        self.hints = [
            {"folder_id": uuid.UUID(F_SYNCED), "is_mail": False},
            {"folder_id": uuid.UUID(F_MAIL), "is_mail": True},
        ]
        self.keys: list[dict] = []
        self.calls: list[dict] = []
        self.audits: list[dict] = []
        self.names = {USER: "Dana Kim", OTHER_USER: "Lee Park", ADMIN: "Ada Admin"}
        self.org_on = True
        self.deploy_on = True
        self.entitled = True
        self.is_admin = False
        self.caller = USER
        self.acting_opened: list[tuple[str, str]] = []
        self.hint_sql: list[str] = []
        self.switch_reads = 0

    def project(self, k):
        out = {c: k[c] for c in (
            "id", "org_id", "user_id", "label", "key_prefix", "workflows", "expires_at",
            "revoked_at", "revoked_by", "last_used_at", "created_at",
            "kind", "folder_ids", "tools", "include_external",
        )}
        out["owner_name"] = self.names.get(str(k["user_id"]))
        out["revoked_by_name"] = self.names.get(str(k["revoked_by"])) if k["revoked_by"] else None
        return out


@pytest.fixture
def store(monkeypatch):
    s = _Store()
    db = route.api_keys_db

    async def create_api_key(pool, *, org_id, user_id, label, key_prefix, key_hash, workflows,
                             expires_at, kind="workflow", folder_ids=None, tools=None,
                             include_external=False):
        for k in s.keys:
            if (str(k["org_id"]), str(k["user_id"])) == (str(org_id), str(user_id)) and \
               k["label"].strip().lower() == label.strip().lower() and k["revoked_at"] is None:
                raise db.DuplicateKeyLabel(label)
        # The mig-220 CHECKs, so a route that stored a shape the DB refuses fails here too.
        assert kind in ("workflow", "mcp")
        if kind == "mcp":
            assert expires_at is not None and tools and workflows == []
            assert folder_ids is None or (isinstance(folder_ids, list) and len(folder_ids) >= 1)
        else:
            assert tools is None and folder_ids is None and include_external is False
        row = {
            "id": uuid.uuid4(), "org_id": uuid.UUID(str(org_id)), "user_id": uuid.UUID(str(user_id)),
            "label": label, "key_prefix": key_prefix, "key_hash": key_hash, "workflows": workflows,
            "expires_at": expires_at, "revoked_at": None, "revoked_by": None, "last_used_at": None,
            "created_at": datetime.now(timezone.utc), "kind": kind, "folder_ids": folder_ids,
            "tools": tools, "include_external": include_external,
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
            revoked_now = k["revoked_at"] is None
            if revoked_now:
                k["revoked_at"] = datetime.now(timezone.utc)
                k["revoked_by"] = uuid.UUID(str(revoked_by))
            return {**s.project(k), "revoked_now": revoked_now}
        return None

    async def list_key_calls(pool, *, org_id, key_ids, since, per_key=50):
        return [c for c in s.calls if c["metadata"].get("api_key_id") in key_ids]

    async def get_key_workflows(pool, *, workflow_ids, user_id, org_id):
        out = []
        for wid in workflow_ids:
            w = s.workflows.get(str(wid))
            if w is None:
                continue
            ok = str(w["created_by"]) == str(user_id) and str(w["org_id"]) == str(org_id)
            out.append({"id": w["id"], "readable": ok, "name": w["name"] if ok else None,
                        "status": w["status"] if ok else None,
                        "definition": w["definition"] if ok else None})
        return out

    async def list_startable_candidates(pool, *, user_id, org_id):
        return [{"id": w["id"], "name": w["name"], "definition": w["definition"]}
                for w in s.workflows.values()
                if w["status"] == "published" and str(w["created_by"]) == str(user_id)
                and str(w["org_id"]) == str(org_id)]

    async def count_own_drafts(pool, *, user_id, org_id):
        return 0

    async def mcp_switches(pool, org_id):
        s.switch_reads += 1
        if str(org_id) != ORG:
            return None
        return {"org_on": s.org_on, "deploy_on": s.deploy_on, "org_name": "Acme Legal"}

    async def folder_names(pool, *, org_id, folder_ids):
        return [{"id": uuid.UUID(f["id"]), "name": f["name"]} for f in s.folders.values()
                if f["org_id"] == str(org_id) and f["id"] in [str(i) for i in folder_ids]]

    for name, fn in {
        "create_api_key": create_api_key, "list_keys_for_owner": list_keys_for_owner,
        "list_keys_for_org": list_keys_for_org, "revoke_key": revoke_key,
        "list_key_calls": list_key_calls, "get_key_workflows": get_key_workflows,
        "list_startable_candidates": list_startable_candidates, "count_own_drafts": count_own_drafts,
        "mcp_switches": mcp_switches, "folder_names": folder_names,
    }.items():
        monkeypatch.setattr(db, name, fn)

    class _Conn:
        def __init__(self, user_id, org_id):
            self.user_id, self.org_id = user_id, org_id

        async def fetch(self, sql, *args):
            s.hint_sql.append(sql)
            return list(s.hints)

    @asynccontextmanager
    async def acting_member_connection(*, user_id, org_id):
        s.acting_opened.append((str(user_id), str(org_id)))
        yield _Conn(str(user_id), str(org_id))

    async def list_acting_folders(conn):
        # RLS + the acting GUC: only folders in the ACTING org, and only for the connection's user.
        out = []
        for f in s.folders.values():
            if f["org_id"] != conn.org_id:
                continue
            if f["user_id"] not in (conn.user_id, None) and not f["is_org_shared"]:
                continue
            out.append(dict(f))
        return out

    monkeypatch.setattr(route, "acting_member_connection", acting_member_connection)
    monkeypatch.setattr(route, "list_acting_folders", list_acting_folders)

    async def _write(user_id, action_type, metadata, supabase, org_id=None):
        s.audits.append({"user_id": user_id, "action_type": action_type, "metadata": metadata,
                         "org_id": org_id})

    monkeypatch.setattr(auth, "write_audit_entry", _write)
    monkeypatch.setattr(auth, "get_service_role_supabase", lambda org_id: object())

    async def _settings():
        return _build_settings_from_row({"api_key_starts_per_minute": 7, "api_key_reads_per_minute": 90})

    monkeypatch.setattr(route, "load_app_settings_async", _settings)

    async def _entitlement(pool, org_id, capability):
        if s.entitled:
            return True, "pro", "pro", None
        return False, "free", "pro", "Capability not in tier"

    monkeypatch.setattr(entitlement_service, "resolve_org_entitlement", _entitlement)

    async def _perm(request, current_user, active_org, perm):
        return s.is_admin

    monkeypatch.setattr(deps, "_has_org_permission", _perm)
    monkeypatch.setattr(route, "mcp_url", lambda: "https://syrel.example.com/mcp")
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


def _mcp(client, **kw):
    body = {"kind": "mcp", "label": "claude-code", "tools": list(PRESETS["read"].tools),
            "folder_ids": None, "include_external": False, "expires_in_days": 90}
    body.update(kw)
    return client.post("/api-keys", json=body)


def _wf(client, **kw):
    body = {"label": "n8n-prod", "workflow_ids": [WF_PUB]}
    body.update(kw)
    return client.post("/api-keys", json=body)


def _msg(r) -> str:
    """The refusal sentence, whether the route raised it (string detail) or the model did
    (FastAPI's 422 list, with Pydantic's ``Value error, `` prefix the client strips)."""
    detail = r.json()["detail"]
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list):
        return detail[0]["msg"].removeprefix("Value error, ")
    return str(detail)


# ── a body without kind is the 293 workflow key ───────────────────────────────────────────────


def test_a_293_body_without_kind_still_mints_a_workflow_key(client, store):
    r = _wf(client)
    assert r.status_code == 201, r.text
    key = r.json()["key"]
    assert r.json()["secret"].startswith("srl_live_")
    assert key["kind"] == "workflow"
    assert key["tools"] is None and key["folders"] is None
    assert key["include_external"] is False
    assert key["mcp_off"] is None and key["org_name"] is None
    assert store.keys[0]["kind"] == "workflow" and store.keys[0]["tools"] is None
    # A workflow key never reads the MCP switches.
    assert store.switch_reads == 0


def test_kind_workflow_explicitly_is_the_same_key(client, store):
    r = _wf(client, kind="workflow")
    assert r.status_code == 201, r.text
    assert r.json()["key"]["kind"] == "workflow"


def test_an_unknown_kind_is_422(client, store):
    assert _wf(client, kind="robot").status_code == 422
    assert store.keys == []


# ── D-41: no tier gate on MCP keys; the workflow key keeps its 403 ─────────────────────────────


def test_an_mcp_key_needs_no_tier_capability(client, store):
    store.entitled = False
    r = _mcp(client)
    assert r.status_code == 201, r.text


def test_a_workflow_key_from_a_non_entitled_org_still_gets_the_403(client, store):
    store.entitled = False
    r = _wf(client)
    assert r.status_code == 403
    assert r.json()["detail"]["error"] == "entitlement_required"
    assert store.keys == []


# ── D-07 / D-08 / D-11 / D-12: every MCP refusal is server-side, in words ──────────────────────


def test_an_mcp_key_with_no_expiry_is_refused(client, store):
    r = _mcp(client, expires_in_days=None)
    assert r.status_code == 422
    assert _msg(r) == "An AI tool key must have an expiry: 30, 90 or 365 days."
    assert store.keys == []


def test_an_mcp_key_with_an_unlisted_expiry_is_refused(client, store):
    assert _mcp(client, expires_in_days=7).status_code == 422


def test_an_empty_tool_list_is_refused(client, store):
    r = _mcp(client, tools=[])
    assert r.status_code == 422
    assert _msg(r) == "Tick at least one tool."
    assert store.keys == []


def test_an_empty_folder_list_is_refused_never_read_as_all(client, store):
    r = _mcp(client, folder_ids=[])
    assert r.status_code == 422
    assert _msg(r) == "Tick at least one folder, or choose All folders I can see."
    assert store.keys == []


def test_an_unknown_tool_is_refused_by_name(client, store):
    r = _mcp(client, tools=["search_knowledge_base", "delete_everything"])
    assert r.status_code == 422
    assert "delete_everything" in _msg(r)
    assert store.keys == []


def test_a_companion_without_its_lead_is_refused_naming_the_lead(client, store):
    r = _mcp(client, tools=["get_answer"])
    assert r.status_code == 422
    assert "ask_agent" in _msg(r)
    assert store.keys == []


def test_workflow_ids_on_an_mcp_body_are_refused(client, store):
    assert _mcp(client, workflow_ids=[WF_PUB]).status_code == 422
    assert store.keys == []


def test_a_foreign_and_an_unknown_folder_are_refused_identically(client, store):
    foreign = _mcp(client, folder_ids=[F_OWN, F_FOREIGN])
    unknown = _mcp(client, folder_ids=[F_UNKNOWN])
    assert foreign.status_code == unknown.status_code == 422
    assert _msg(foreign) == _msg(unknown) == FOLDER_SENTENCE
    assert "Their private folder" not in foreign.text
    assert store.keys == []


def test_folders_are_validated_on_the_callers_acting_connection_for_the_active_org(client, store):
    assert _mcp(client, folder_ids=[F_OWN]).status_code == 201
    assert store.acting_opened == [(USER, ORG)]


def test_a_deleted_folder_is_refused_with_the_same_sentence(client, store):
    del store.folders[F_CHILD]
    r = _mcp(client, folder_ids=[F_CHILD])
    assert r.status_code == 422 and _msg(r) == FOLDER_SENTENCE


# ── the switches refuse a mint before anything is made ─────────────────────────────────────────


def test_an_org_switched_off_refuses_the_mint(client, store):
    store.org_on = False
    r = _mcp(client)
    assert r.status_code == 403
    assert r.json()["detail"] == MCP_OFF_ORG_SENTENCE
    assert store.keys == []


def test_a_deployment_switched_off_refuses_the_mint(client, store):
    store.deploy_on = False
    r = _mcp(client)
    assert r.status_code == 403
    assert r.json()["detail"] == MCP_OFF_DEPLOYMENT_SENTENCE
    assert store.keys == []


def test_the_deployment_sentence_wins_when_both_are_off(client, store):
    store.deploy_on = False
    store.org_on = False
    assert _mcp(client).json()["detail"] == MCP_OFF_DEPLOYMENT_SENTENCE


def test_the_workflow_key_ignores_the_mcp_switches(client, store):
    store.deploy_on = False
    store.org_on = False
    assert _wf(client).status_code == 201


# ── a successful MCP mint ──────────────────────────────────────────────────────────────────────


def test_an_mcp_mint_returns_the_secret_once_with_the_mcp_prefix(client, store):
    r = _mcp(client, expires_in_days=30)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["secret"].startswith("srl_mcp_")
    assert len(body["key"]["key_prefix"]) == 12
    assert body["key"]["key_prefix"] == body["secret"][:12]
    stored = store.keys[0]
    assert stored["kind"] == "mcp"
    assert stored["key_hash"] == auth.digest_key(body["secret"], kind="mcp")
    assert stored["workflows"] == []
    assert body["secret"] not in repr({k: v for k, v in stored.items() if k != "key_hash"})
    exp = datetime.fromisoformat(body["key"]["expires_at"].replace("Z", "+00:00"))
    assert timedelta(days=29) < exp - datetime.now(timezone.utc) <= timedelta(days=30)


def test_the_default_expiry_is_90_days(client, store):
    body = {"kind": "mcp", "label": "cursor", "tools": ["search_knowledge_base"]}
    r = client.post("/api-keys", json=body)
    assert r.status_code == 201, r.text
    exp = datetime.fromisoformat(r.json()["key"]["expires_at"].replace("Z", "+00:00"))
    assert timedelta(days=89) < exp - datetime.now(timezone.utc) <= timedelta(days=90)
    assert store.keys[0]["folder_ids"] is None          # not narrowed
    assert store.keys[0]["include_external"] is False


def test_the_read_preset_is_stored_as_sent(client, store):
    _mcp(client)
    assert store.keys[0]["tools"] == list(PRESETS["read"].tools)


def test_companions_travel_with_their_lead_in_catalogue_order(client, store):
    r = _mcp(client, tools=["run_workflow", "search_knowledge_base", "ask_agent"])
    assert r.status_code == 201, r.text
    order = [t.name for t in MCP_TOOLS]
    expected = ["search_knowledge_base", "ask_agent", "get_answer", "list_workflows",
                "run_workflow", "get_workflow_run"]
    assert store.keys[0]["tools"] == sorted(expected, key=order.index)
    assert r.json()["key"]["tools"] == store.keys[0]["tools"]


def test_folder_ids_are_stored_as_a_plain_list_of_strings(client, store):
    r = _mcp(client, folder_ids=[F_OWN, F_SHARED], include_external=True)
    assert r.status_code == 201, r.text
    stored = store.keys[0]
    assert stored["folder_ids"] == [F_OWN, F_SHARED]
    assert all(isinstance(i, str) for i in stored["folder_ids"])
    assert stored["include_external"] is True
    key = r.json()["key"]
    assert key["include_external"] is True
    assert sorted(f["name"] for f in key["folders"]) == ["Contracts", "Team handbook"]
    assert {f["id"] for f in key["folders"]} == {F_OWN, F_SHARED}


def test_an_mcp_mint_is_audited_as_api_key_create_with_kind_mcp(client, store):
    body = _mcp(client).json()
    (entry,) = store.audits
    assert entry["action_type"] == "api_key.create"
    assert entry["org_id"] == ORG
    assert entry["metadata"]["kind"] == "mcp"
    assert entry["metadata"]["api_key_id"] == body["key"]["id"]
    assert body["secret"] not in repr(entry)


def test_a_workflow_mint_audit_carries_no_kind(client, store):
    _wf(client)
    (entry,) = store.audits
    assert "kind" not in entry["metadata"]


def test_the_label_409_spans_kinds_and_reads_for_both(client, store):
    assert _wf(client, label="shared").status_code == 201
    r = _mcp(client, label="Shared")
    assert r.status_code == 409
    assert r.json()["detail"] == "You already have an active key called Shared. Pick another label."
    r2 = _mcp(client, label="solo")
    assert r2.status_code == 201
    r3 = _wf(client, label="SOLO")
    assert r3.status_code == 409
    assert r3.json()["detail"] == "You already have an active key called SOLO. Pick another label."


# ── the list carries the MCP facts the screen reads (never retyped in the client) ─────────────


def test_the_list_carries_the_mcp_block_with_the_catalogue_in_order(client, store):
    r = client.get("/api-keys")
    assert r.status_code == 200, r.text
    mcp = r.json()["mcp"]
    assert mcp["available"] is True
    assert mcp["off"] is None
    assert mcp["url"] == "https://syrel.example.com/mcp"
    assert [t["name"] for t in mcp["tools"]] == [t.name for t in MCP_TOOLS]
    by = {t["name"]: t for t in mcp["tools"]}
    assert by["get_answer"] == {"name": "get_answer", "group": "ask",
                                "label": "Fetch the agent's answer", "travels_with": "ask_agent"}
    assert by["search_knowledge_base"]["travels_with"] is None


def test_the_list_reads_the_switches_once(client, store):
    _mcp(client, label="a")
    _mcp(client, label="b")
    store.switch_reads = 0
    client.get("/api-keys")
    assert store.switch_reads == 1


def test_the_list_says_the_deployment_is_off_and_hides_the_choice(client, store):
    store.deploy_on = False
    store.org_on = False
    mcp = client.get("/api-keys").json()["mcp"]
    assert mcp == {**mcp, "available": False, "off": "deployment"}


def test_the_list_says_the_org_is_off(client, store):
    store.org_on = False
    mcp = client.get("/api-keys").json()["mcp"]
    assert mcp == {**mcp, "available": True, "off": "org"}


def _switch_read_fails(monkeypatch):
    async def _boom(pool, org_id):
        raise RuntimeError("db down")

    monkeypatch.setattr(route.api_keys_db, "mcp_switches", _boom)


def test_a_failed_switch_read_is_unknown_never_the_operator(client, store, monkeypatch):
    """304-REVIEW WR-02: a switch read that RAISES is ``unknown`` — still fail closed (the MCP
    choice stays hidden), but never reported as "the operator switched it off"."""
    _mcp(client)
    _switch_read_fails(monkeypatch)
    body = client.get("/api-keys").json()
    assert body["mcp"]["off"] == "unknown"
    assert body["mcp"]["available"] is False
    (key,) = body["keys"]
    assert key["mcp_off"] == "unknown"


def test_the_admin_list_says_unknown_when_the_switch_read_fails(client, store, monkeypatch):
    _mcp(client)
    store.caller = ADMIN
    store.is_admin = True
    _switch_read_fails(monkeypatch)
    body = client.get("/org/api-keys").json()
    assert body["mcp"] == {**body["mcp"], "available": False, "off": "unknown"}
    assert body["keys"][0]["mcp_off"] == "unknown"


def test_a_missing_org_row_refuses_the_mint_without_naming_a_switch(client, store, monkeypatch):
    async def _missing(pool, org_id):
        return None

    monkeypatch.setattr(route.api_keys_db, "mcp_switches", _missing)
    r = _mcp(client)
    assert r.status_code == 403
    # fail closed (no mint), and never the operator's sentence for a fact nobody read
    assert r.json()["detail"] == "Couldn't check whether AI tool access is on. Reload to try again."
    assert store.keys == []


def test_a_null_mcp_url_is_served_as_null(client, store, monkeypatch):
    monkeypatch.setattr(route, "mcp_url", lambda: None)
    assert client.get("/api-keys").json()["mcp"]["url"] is None


def test_each_mcp_key_carries_its_scope_org_and_switch_state(client, store):
    _mcp(client, label="narrow", folder_ids=[F_OWN])
    _mcp(client, label="wide")
    _wf(client)
    store.org_on = False
    keys = {k["label"]: k for k in client.get("/api-keys").json()["keys"]}
    narrow, wide, wf = keys["narrow"], keys["wide"], keys["n8n-prod"]
    assert narrow["kind"] == "mcp" and narrow["folders"] == [{"id": F_OWN, "name": "Contracts"}]
    assert wide["folders"] is None
    assert narrow["org_name"] == wide["org_name"] == "Acme Legal"
    assert narrow["mcp_off"] == wide["mcp_off"] == "org"
    assert narrow["tools"] == list(PRESETS["read"].tools)
    assert narrow["last_used_at"] is None          # D-26: null until 305 resolves a key
    assert wf["kind"] == "workflow" and wf["mcp_off"] is None and wf["tools"] is None
    store.deploy_on = False
    keys = {k["label"]: k for k in client.get("/api-keys").json()["keys"]}
    assert keys["narrow"]["mcp_off"] == "deployment"   # deployment wins over org


def test_a_ticked_folder_since_deleted_drops_out_of_the_card(client, store):
    _mcp(client, folder_ids=[F_OWN, F_CHILD])
    del store.folders[F_CHILD]
    (key,) = client.get("/api-keys").json()["keys"]
    assert key["folders"] == [{"id": F_OWN, "name": "Contracts"}]


def test_the_admin_list_carries_the_same_mcp_block(client, store):
    _mcp(client)
    store.org_on = False
    store.caller = ADMIN
    store.is_admin = True
    body = client.get("/org/api-keys").json()
    assert body["mcp"]["off"] == "org"
    assert [t["name"] for t in body["mcp"]["tools"]] == [t.name for t in MCP_TOOLS]
    (key,) = body["keys"]
    assert key["kind"] == "mcp" and key["owner_name"] == "Dana Kim" and key["owner_is_you"] is False


def test_no_mcp_key_response_carries_a_secret_or_digest(client, store):
    _mcp(client)
    text = client.get("/api-keys").text
    assert "srl_mcp_" not in text.replace(store.keys[0]["key_prefix"], "")
    assert "key_hash" not in text and "secret" not in text


# ── the pickable folders, on the member's own acting visibility ───────────────────────────────


def test_pickable_folders_are_read_on_the_acting_connection(client, store):
    r = client.get("/api-keys/folders")
    assert r.status_code == 200, r.text
    assert store.acting_opened == [(USER, ORG)]
    folders = {f["id"]: f for f in r.json()["folders"]}
    assert F_FOREIGN not in folders                     # another org's folder never offered
    assert set(folders) == {F_OWN, F_CHILD, F_SHARED, F_SYNCED, F_MAIL}
    assert folders[F_CHILD] == {"id": F_CHILD, "name": "2026", "parent_id": F_OWN,
                                "shared": False, "source": None}
    assert folders[F_SHARED]["shared"] is True
    assert folders[F_OWN]["shared"] is False
    assert folders[F_SYNCED]["source"] == "synced"
    assert folders[F_MAIL]["source"] == "mail"


def test_the_source_hint_is_one_statement_on_the_same_connection(client, store):
    client.get("/api-keys/folders")
    (sql,) = store.hint_sql
    assert "connector_watches" in sql and "library_folder_id" in sql
    assert "source_connection_id IS NOT NULL" in sql      # D-40: the one predicate home


def test_a_non_owned_visible_folder_reads_as_shared(client, store):
    store.folders[F_OWN]["user_id"] = OTHER_USER
    store.folders[F_OWN]["is_org_shared"] = True
    folders = {f["id"]: f for f in client.get("/api-keys/folders").json()["folders"]}
    assert folders[F_OWN]["shared"] is True


def test_no_folders_is_an_empty_list(client, store):
    store.folders = {}
    store.hints = []
    assert client.get("/api-keys/folders").json() == {"folders": []}


def test_the_mcp_create_and_folder_payloads_match_the_contract_fixture(client, store):
    """The 304 shapes are pinned in the SAME fixture the frontend's apiKeysContract test reads."""
    import json
    from pathlib import Path

    contract = json.loads(
        (Path(__file__).resolve().parents[1] / "fixtures" / "phase293" / "api_keys_contract.json")
        .read_text(encoding="utf-8")
    )

    def paths(obj, prefix=""):
        out = set()
        if isinstance(obj, dict):
            for k, v in obj.items():
                p = f"{prefix}.{k}" if prefix else k
                out.add(p)
                out |= paths(v, p)
        elif isinstance(obj, list):
            for v in obj:
                out |= paths(v, prefix + "[]")
        return out

    created = _mcp(client, folder_ids=[F_OWN]).json()
    assert paths(created) == paths(contract["McpApiKeyCreated"])
    assert created["secret"].startswith("srl_mcp_")
    folders = client.get("/api-keys/folders").json()
    assert paths(folders) == paths(contract["PickableFolderList"])


def test_the_folder_routes_never_name_the_service_role_visibility_helpers():
    import inspect

    src = inspect.getsource(route)
    assert "fetch_visible_folders" not in src
    assert src.count("list_acting_folders(") >= 2


# ── revoke works for both kinds, and says which kind in the audit ─────────────────────────────


def test_a_member_revokes_their_mcp_key_and_the_audit_says_mcp(client, store):
    key_id = _mcp(client).json()["key"]["id"]
    store.audits.clear()
    r = client.post(f"/api-keys/{key_id}/revoke")
    assert r.status_code == 200, r.text
    assert r.json()["state"] == "revoked" and r.json()["kind"] == "mcp"
    (entry,) = store.audits
    assert entry["action_type"] == "api_key.revoke"
    assert entry["metadata"]["kind"] == "mcp"


def test_an_admin_revokes_an_mcp_key(client, store):
    key_id = _mcp(client).json()["key"]["id"]
    store.audits.clear()
    store.caller = ADMIN
    store.is_admin = True
    r = client.post(f"/org/api-keys/{key_id}/revoke")
    assert r.status_code == 200, r.text
    assert r.json()["revoked_by_admin"] is True
    (entry,) = store.audits
    assert entry["metadata"]["kind"] == "mcp"
    assert entry["metadata"]["detail"] == {"by_admin": True, "owner_id": USER}


def test_a_workflow_revoke_audit_carries_no_kind(client, store):
    key_id = _wf(client).json()["key"]["id"]
    store.audits.clear()
    client.post(f"/api-keys/{key_id}/revoke")
    (entry,) = store.audits
    assert "kind" not in entry["metadata"]
