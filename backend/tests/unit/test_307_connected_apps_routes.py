"""Phase 307-05 (OAUTH-07; D-25, D-26, D-27, D-28, D-15; T-307-26, T-307-27, T-307-28).

Connected apps on the EXISTING key routes plus two additive ones:

* ``GET /api-keys/connected-apps`` — the caller's live grants in EVERY org (no org header needed).
* ``POST /api-keys/{id}/revoke`` on a grant — the 293 route; its ``api_key.revoke`` row now says
  ``credential: oauth`` with the client's name and redirect host. A key revoke is byte-unchanged.
* ``GET /org/api-keys/connected-apps`` / ``POST /org/api-keys/connected-apps/revoke-all`` — the
  org admin's list and the bulk disconnect: grants in THAT org only, never a key, ONE audit row.
* ``GET /api-keys`` -> ``mcp.oauth`` (sign-in available = ``mcp_public_base()`` is not None).

Mounted on a FRESH ``FastAPI()`` with dependency overrides (SEED-363); ``db/api_keys`` is an
in-memory store. The SQL itself is pinned by the static cases at the bottom (owner predicate in
every statement, the revoke-all WHERE in ONE clause).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import api_keys as route
from app.models.user_settings import _build_settings_from_row
from app.security import api_key_auth as auth

ORG = "44444444-4444-4444-8444-444444444444"
ORG_B = "99999999-9999-4999-8999-999999999999"
USER = "33333333-3333-4333-8333-333333333333"
OTHER = "88888888-8888-4888-8888-888888888888"
ADMIN = "66666666-6666-4666-8666-666666666666"
F_OWN = "f0000000-0000-4000-8000-000000000001"

NOW = datetime.now(timezone.utc)


def _grant(*, user=USER, org=ORG, label="Claude", kind="dcr", redirect="https://claude.ai/api/mcp/auth_callback",
           last_used=None, created=NOW, folder_ids=None, revoked=False, oauth=True, redirects=None):
    gid = uuid.uuid4()
    return {
        "id": gid, "org_id": uuid.UUID(org), "user_id": uuid.UUID(user), "label": label,
        "key_prefix": "srl_mcp_abcd", "workflows": [], "expires_at": NOW + timedelta(days=90),
        "revoked_at": NOW if revoked else None, "revoked_by": None, "last_used_at": last_used,
        "created_at": created, "kind": "mcp", "folder_ids": folder_ids,
        "tools": ["search_knowledge_base", "list_documents", "read_document"],
        "include_external": False,
        "oauth_client_id": uuid.uuid4() if oauth else None,
        "client_kind": kind, "redirect_uris": list(redirects) if redirects else [redirect],
    }


class _Store:
    def __init__(self):
        self.rows: list[dict] = []
        self.audits: list[dict] = []
        self.caller = USER
        self.is_admin = False
        self.org_names = {ORG: "Acme Legal", ORG_B: "Beta Corp"}
        self.org_on = {ORG: True, ORG_B: True}
        self.deploy_on = True
        self.names = {USER: "Dana Kim", OTHER: "Lee Park", ADMIN: "Ada Admin"}
        self.revoke_all_calls: list[tuple] = []
        self.approved: dict[str, str] = {}   # grant id -> the redirect host its api_key.create row names

    def grant_view(self, r: dict) -> dict:
        folders = None if r["folder_ids"] is None else [
            {"id": f, "name": "Contracts"} for f in r["folder_ids"]
        ]
        return {
            **{k: r[k] for k in ("id", "org_id", "user_id", "label", "tools", "folder_ids",
                                 "include_external", "created_at", "last_used_at", "expires_at",
                                 "client_kind", "redirect_uris")},
            "org_name": self.org_names[str(r["org_id"])],
            "org_on": self.org_on[str(r["org_id"])],
            "deploy_on": self.deploy_on,
            "folder_refs": folders,
            "owner_name": self.names.get(str(r["user_id"])),
        }


@pytest.fixture
def store(monkeypatch):
    s = _Store()
    db = route.api_keys_db

    def _live(r):
        return r["oauth_client_id"] is not None and r["revoked_at"] is None

    async def list_grants_for_user(pool, *, user_id):
        out = [s.grant_view(r) for r in s.rows if _live(r) and str(r["user_id"]) == str(user_id)]
        return out

    async def list_grants_for_org(pool, *, org_id):
        return [s.grant_view(r) for r in s.rows if _live(r) and str(r["org_id"]) == str(org_id)]

    async def revoke_all_grants_in_org(pool, *, org_id, revoked_by):
        s.revoke_all_calls.append((str(org_id), str(revoked_by)))
        out = []
        for r in s.rows:
            if _live(r) and str(r["org_id"]) == str(org_id):
                r["revoked_at"] = datetime.now(timezone.utc)
                r["revoked_by"] = uuid.UUID(str(revoked_by))
                out.append({"id": r["id"], "user_id": r["user_id"]})
        return out

    async def revoke_key(pool, *, key_id, org_id, owner_id, revoked_by):
        for r in s.rows:
            if str(r["id"]) != str(key_id) or str(r["org_id"]) != str(org_id):
                continue
            if owner_id is not None and str(r["user_id"]) != str(owner_id):
                continue
            now = r["revoked_at"] is None
            if now:
                r["revoked_at"] = datetime.now(timezone.utc)
                r["revoked_by"] = uuid.UUID(str(revoked_by))
            row = {k: r[k] for k in (
                "id", "org_id", "user_id", "label", "key_prefix", "workflows", "expires_at",
                "revoked_at", "revoked_by", "last_used_at", "created_at", "kind", "folder_ids",
                "tools", "include_external",
            )}
            row["owner_name"] = s.names.get(str(r["user_id"]))
            row["revoked_by_name"] = s.names.get(str(revoked_by))
            if r["oauth_client_id"] is not None:
                row["oauth_client_id"] = r["oauth_client_id"]
                row["oauth_redirect_uris"] = r["redirect_uris"]
            else:
                row["oauth_client_id"] = None
            return {**row, "revoked_now": now}
        return None

    async def list_keys_for_owner(pool, *, org_id, user_id):
        return []

    async def list_key_calls(pool, *, org_id, key_ids, since, per_key=50):
        return []

    async def get_key_workflows(pool, *, workflow_ids, user_id, org_id):
        return []

    async def mcp_switches(pool, org_id):
        return {"org_on": s.org_on.get(str(org_id), True), "deploy_on": s.deploy_on,
                "org_name": s.org_names.get(str(org_id))}

    async def folder_names(pool, *, org_id, folder_ids):
        return [{"id": uuid.UUID(f), "name": "Contracts"} for f in folder_ids]

    async def grant_approved_hosts(pool, *, grant_ids):
        return {str(g): s.approved[str(g)] for g in grant_ids if str(g) in s.approved}

    for name, fn in {
        "grant_approved_hosts": grant_approved_hosts,
        "list_grants_for_user": list_grants_for_user, "list_grants_for_org": list_grants_for_org,
        "revoke_all_grants_in_org": revoke_all_grants_in_org, "revoke_key": revoke_key,
        "list_keys_for_owner": list_keys_for_owner, "list_keys_for_org": list_keys_for_owner,
        "list_key_calls": list_key_calls, "get_key_workflows": get_key_workflows,
        "mcp_switches": mcp_switches, "folder_names": folder_names,
    }.items():
        monkeypatch.setattr(db, name, fn, raising=False)

    async def _write(user_id, action_type, metadata, supabase, org_id=None):
        s.audits.append({"user_id": user_id, "action_type": action_type, "metadata": metadata,
                         "org_id": org_id})

    monkeypatch.setattr(auth, "write_audit_entry", _write)
    monkeypatch.setattr(auth, "get_service_role_supabase", lambda org_id: object())

    async def _settings():
        return _build_settings_from_row({})

    monkeypatch.setattr(route, "load_app_settings_async", _settings)

    async def _perm(request, current_user, active_org, perm):
        return s.is_admin

    monkeypatch.setattr(deps, "_has_org_permission", _perm)
    monkeypatch.setattr(route, "mcp_url", lambda: "https://syrel.example.com/mcp")
    monkeypatch.setattr(route, "mcp_public_base", lambda: "https://syrel.example.com", raising=False)
    return s


@pytest.fixture
def client(store):
    app = FastAPI()
    app.include_router(route.router)
    app.include_router(route.org_router)
    active = {"org": ORG}

    async def _user():
        return {"id": store.caller, "email": "t@example.com"}

    async def _org():
        return active["org"]

    async def _pool():
        return object()

    app.dependency_overrides[deps.get_current_user] = _user
    app.dependency_overrides[deps.get_active_org_id] = _org
    app.dependency_overrides[deps.get_pg_pool] = _pool
    c = TestClient(app)
    c.active = active  # type: ignore[attr-defined]
    return c


# ── the member's list ────────────────────────────────────────────────────────────────────────


def test_my_list_is_every_live_grant_in_every_org_and_nobody_elses(client, store):
    mine_a = _grant(label="Claude")
    mine_b = _grant(org=ORG_B, label="Claude Code", redirect="http://localhost/callback", kind="cimd")
    theirs = _grant(user=OTHER, label="Not yours")
    gone = _grant(label="Revoked", revoked=True)
    key = _grant(label="A key", oauth=False)
    store.rows += [mine_a, mine_b, theirs, gone, key]

    r = client.get("/api-keys/connected-apps")
    assert r.status_code == 200, r.text
    apps = r.json()["apps"]
    assert {a["id"] for a in apps} == {str(mine_a["id"]), str(mine_b["id"])}
    by = {a["id"]: a for a in apps}
    a = by[str(mine_a["id"])]
    assert a["client_name"] == "Claude"
    assert a["name_source"] == "dcr"
    assert a["redirect_host"] == "claude.ai" and a["redirect_kind"] == "web"
    assert a["org_id"] == ORG and a["org_name"] == "Acme Legal"
    assert a["tools"] == ["search_knowledge_base", "list_documents", "read_document"]
    assert a["folders"] is None and a["include_external"] is False
    assert a["mcp_off"] is None
    b = by[str(mine_b["id"])]
    assert b["name_source"] == "cimd"
    assert b["redirect_host"] == "localhost" and b["redirect_kind"] == "loopback"
    assert b["org_name"] == "Beta Corp"
    # never a secret, a prefix, a digest or an oauth client id on the wire
    for field in ("secret", "key_prefix", "key_hash", "oauth_client_id", "label"):
        assert field not in a


def test_my_list_needs_no_org_header(client, store):
    """The route never depends on the active org: an app acting anywhere is visible from one place."""
    from fastapi.routing import APIRoute

    (r,) = [x for x in route.router.routes
            if isinstance(x, APIRoute) and x.path == "/api-keys/connected-apps"]
    names = {d.call.__name__ for d in r.dependant.dependencies if d.call is not None}
    assert "get_active_org_id" not in names


def test_my_list_orders_recently_used_first_then_newest(client, store):
    old_used = _grant(label="used long ago", last_used=NOW - timedelta(days=5), created=NOW - timedelta(days=9))
    fresh_used = _grant(label="used now", last_used=NOW, created=NOW - timedelta(days=20))
    never_old = _grant(label="never old", created=NOW - timedelta(days=3))
    never_new = _grant(label="never new", created=NOW - timedelta(days=1))
    store.rows += [never_old, old_used, never_new, fresh_used]
    names = [a["client_name"] for a in client.get("/api-keys/connected-apps").json()["apps"]]
    assert names == ["used now", "used long ago", "never new", "never old"]


def test_my_list_names_the_switch_that_is_off(client, store):
    store.rows.append(_grant())
    store.org_on[ORG] = False
    (a,) = client.get("/api-keys/connected-apps").json()["apps"]
    assert a["mcp_off"] == "org"
    store.deploy_on = False
    (a,) = client.get("/api-keys/connected-apps").json()["apps"]
    assert a["mcp_off"] == "deployment"


def test_my_list_names_ticked_folders(client, store):
    store.rows.append(_grant(folder_ids=[F_OWN]))
    (a,) = client.get("/api-keys/connected-apps").json()["apps"]
    assert a["folders"] == [{"id": F_OWN, "name": "Contracts"}]


# ── the member disconnects one (the EXISTING revoke route) ───────────────────────────────────


def test_member_revoke_of_a_grant_audits_credential_oauth_once(client, store):
    g = _grant(label="Claude")
    store.rows.append(g)
    r = client.post(f"/api-keys/{g['id']}/revoke")
    assert r.status_code == 200, r.text
    assert r.json()["state"] == "revoked"
    (row,) = store.audits
    assert row["action_type"] == "api_key.revoke"
    assert row["org_id"] == ORG and row["user_id"] == USER
    assert row["metadata"]["detail"] == {
        "credential": "oauth", "client_name": "Claude", "redirect_host": "claude.ai",
    }
    again = client.post(f"/api-keys/{g['id']}/revoke")
    assert again.status_code == 200
    assert len(store.audits) == 1  # a repeat revoke writes no second row
    assert client.get("/api-keys/connected-apps").json()["apps"] == []


def test_member_cannot_revoke_someone_elses_grant(client, store):
    g = _grant(user=OTHER)
    store.rows.append(g)
    r = client.post(f"/api-keys/{g['id']}/revoke")
    assert r.status_code == 404
    assert store.audits == []


def test_a_key_revoke_writes_no_oauth_detail(client, store):
    k = _grant(label="A key", oauth=False)
    store.rows.append(k)
    assert client.post(f"/api-keys/{k['id']}/revoke").status_code == 200
    (row,) = store.audits
    assert "detail" not in row["metadata"]


def test_admin_revoke_of_a_grant_keeps_by_admin_and_adds_oauth(client, store):
    store.is_admin = True
    store.caller = ADMIN
    g = _grant(user=OTHER, label="Cursor", redirect="https://cursor.example.com/cb")
    store.rows.append(g)
    r = client.post(f"/org/api-keys/{g['id']}/revoke")
    assert r.status_code == 200, r.text
    (row,) = store.audits
    assert row["user_id"] == ADMIN
    # 307-05 Task 3: the owner's NAME rides along so the audit tables can say "Disconnected
    # {owner}'s app" (the row carries only owner_id otherwise).
    assert row["metadata"]["detail"] == {
        "by_admin": True, "owner_id": OTHER, "credential": "oauth",
        "client_name": "Cursor", "redirect_host": "cursor.example.com", "owner_name": "Lee Park",
    }


# ── WR-03: the redirect host shown and audited is the one the member APPROVED ─────────────────

_TWO = ["https://claude.ai/x", "http://localhost/cb"]   # a self-registered client's two redirects


def test_wr03_the_list_shows_the_approved_redirect_not_the_first_registered(client, store):
    g = _grant(label="Claude", redirects=_TWO)
    store.rows.append(g)
    store.approved[str(g["id"])] = "localhost"   # it signed in through localhost
    (a,) = client.get("/api-keys/connected-apps").json()["apps"]
    assert (a["redirect_host"], a["redirect_kind"]) == ("localhost", "loopback")
    store.is_admin = True
    (o,) = client.get("/org/api-keys/connected-apps").json()["apps"]
    assert (o["redirect_host"], o["redirect_kind"]) == ("localhost", "loopback")


def test_wr03_with_no_approval_record_two_registered_hosts_name_neither(client, store):
    store.rows.append(_grant(redirects=_TWO))
    (a,) = client.get("/api-keys/connected-apps").json()["apps"]
    assert a["redirect_host"] is None and a["redirect_kind"] is None   # "unknown", never a guess


def test_wr03_the_revoke_audit_names_the_approved_host(client, store):
    g = _grant(label="Claude", redirects=_TWO)
    store.rows.append(g)
    store.approved[str(g["id"])] = "localhost"
    assert client.post(f"/api-keys/{g['id']}/revoke").status_code == 200
    (row,) = store.audits
    assert row["metadata"]["detail"]["redirect_host"] == "localhost"


async def test_wr03_the_approved_host_sql_reads_each_grants_own_create_row():
    from app.db import api_keys as db

    gid = uuid.uuid4()
    pool = _Pool(rows=[{"grant_id": str(gid), "host": "localhost"}])
    assert await db.grant_approved_hosts(pool, grant_ids=[gid]) == {str(gid): "localhost"}
    ((_, sql, args),) = pool.calls
    assert "action_type = 'api_key.create'" in sql
    assert "metadata->>'api_key_id' = ANY($1::text[])" in sql   # audit_log_api_key_id_idx
    assert "'credential' = 'oauth'" in sql
    assert args == ([str(gid)],)
    empty = _Pool()
    assert await db.grant_approved_hosts(empty, grant_ids=[]) == {} and empty.calls == []


# ── the org admin's list and revoke-all ───────────────────────────────────────────────────────


def test_org_list_is_this_orgs_grants_with_owner(client, store):
    store.is_admin = True
    store.caller = ADMIN
    a = _grant(user=USER, label="Claude")
    b = _grant(user=OTHER, label="Claude Code", redirect="http://127.0.0.1/callback")
    other_org = _grant(org=ORG_B)
    key = _grant(oauth=False)
    store.rows += [a, b, other_org, key]
    r = client.get("/org/api-keys/connected-apps")
    assert r.status_code == 200, r.text
    apps = {x["id"]: x for x in r.json()["apps"]}
    assert set(apps) == {str(a["id"]), str(b["id"])}
    assert apps[str(a["id"])]["owner_name"] == "Dana Kim"
    assert apps[str(a["id"])]["owner_is_you"] is False
    assert apps[str(b["id"])]["redirect_kind"] == "loopback"


def test_org_routes_need_an_org_admin(client, store):
    store.is_admin = False
    assert client.get("/org/api-keys/connected-apps").status_code == 403
    assert client.post("/org/api-keys/connected-apps/revoke-all").status_code == 403
    assert store.revoke_all_calls == []


def test_revoke_all_revokes_this_orgs_grants_only_and_audits_once(client, store):
    store.is_admin = True
    store.caller = ADMIN
    a = _grant(user=USER)
    b = _grant(user=OTHER)
    c = _grant(user=OTHER, label="second app")
    elsewhere = _grant(org=ORG_B)
    key = _grant(oauth=False)
    store.rows += [a, b, c, elsewhere, key]
    r = client.post("/org/api-keys/connected-apps/revoke-all")
    assert r.status_code == 200, r.text
    assert r.json() == {"revoked": 3, "members": 2}
    assert store.revoke_all_calls == [(ORG, ADMIN)]
    assert elsewhere["revoked_at"] is None and key["revoked_at"] is None
    (row,) = store.audits
    assert row["action_type"] == "api_key.revoke"
    assert row["user_id"] == ADMIN and row["org_id"] == ORG
    assert row["metadata"]["detail"] == {"credential": "oauth", "scope": "org", "count": 3, "members": 2}
    assert row["metadata"]["call"] == "manage"


def test_revoke_all_with_nothing_to_revoke_writes_no_row(client, store):
    store.is_admin = True
    store.caller = ADMIN
    r = client.post("/org/api-keys/connected-apps/revoke-all")
    assert r.status_code == 200
    assert r.json() == {"revoked": 0, "members": 0}
    assert store.audits == []


# ── mcp.oauth on the key list (D-15) ──────────────────────────────────────────────────────────


def test_key_list_says_whether_sign_in_is_available(client, store, monkeypatch):
    assert client.get("/api-keys").json()["mcp"]["oauth"] is True
    monkeypatch.setattr(route, "mcp_public_base", lambda: None)
    assert client.get("/api-keys").json()["mcp"]["oauth"] is False


def test_no_new_audit_literal():
    import inspect

    src = inspect.getsource(route)
    assert "connected_app." not in src and "oauth.revoke" not in src


# ── the SQL (owner predicate in every statement; the revoke-all WHERE in ONE clause) ─────────


class _Pool:
    def __init__(self, rows=None, status="UPDATE 0"):
        self.calls: list[tuple[str, str, tuple]] = []
        self.rows = rows or []
        self.status = status

    async def fetch(self, sql, *args):
        self.calls.append(("fetch", sql, args))
        return self.rows

    async def fetchrow(self, sql, *args):
        self.calls.append(("fetchrow", sql, args))
        return None

    async def execute(self, sql, *args):
        self.calls.append(("execute", sql, args))
        return self.status


async def test_grant_list_sql_scopes_by_the_member_and_live_grants():
    from app.db import api_keys as db

    pool = _Pool()
    await db.list_grants_for_user(pool, user_id=uuid.UUID(USER))
    ((_, sql, args),) = pool.calls
    assert "k.user_id = $1" in sql
    assert "k.oauth_client_id IS NOT NULL" in sql and "k.revoked_at IS NULL" in sql
    assert "org_members" in sql  # a grant in an org the member left is not listed
    assert args == (uuid.UUID(USER),)


async def test_org_grant_list_sql_scopes_by_org():
    from app.db import api_keys as db

    pool = _Pool()
    await db.list_grants_for_org(pool, org_id=uuid.UUID(ORG))
    ((_, sql, args),) = pool.calls
    assert "k.org_id = $1" in sql
    assert "k.oauth_client_id IS NOT NULL" in sql and "k.revoked_at IS NULL" in sql
    assert "owner_name" in sql
    assert args == (uuid.UUID(ORG),)


async def test_revoke_all_sql_is_one_statement_grants_in_one_org():
    from app.db import api_keys as db

    pool = _Pool(rows=[{"id": uuid.uuid4(), "user_id": uuid.UUID(USER)}])
    out = await db.revoke_all_grants_in_org(pool, org_id=uuid.UUID(ORG), revoked_by=uuid.UUID(ADMIN))
    ((_, sql, args),) = pool.calls
    assert sql.lstrip().upper().startswith("UPDATE API_KEYS")
    assert "WHERE org_id = $1 AND oauth_client_id IS NOT NULL AND revoked_at IS NULL" in sql
    assert "RETURNING id, user_id" in sql
    assert args == (uuid.UUID(ORG), uuid.UUID(ADMIN))
    assert len(out) == 1


async def test_revoke_key_reads_back_the_grant_facts():
    from app.db import api_keys as db

    pool = _Pool()
    await db.revoke_key(pool, key_id=uuid.uuid4(), org_id=uuid.UUID(ORG), owner_id=uuid.UUID(USER),
                        revoked_by=uuid.UUID(USER))
    readback = pool.calls[1][1]
    assert "oauth_client_id" in readback and "oauth_redirect_uris" in readback
    assert "k.user_id = $3" in readback  # the owner predicate is unchanged
