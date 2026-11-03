"""Phase 307-03 (OAUTH-04; D-13, D-14, D-15, D-16, D-28, D-36, D-49, D-50, D-03) — the consent routes.

``GET /oauth/requests/{id}`` reads a pending authorize request for the signed-in member;
``POST …/approve`` turns it into a narrowed GRANT (an ``api_keys`` row of kind ``mcp`` naming the
client) plus a single-use 60 s code and the redirect back; ``POST …/deny`` sends the browser back
with ``error=access_denied``. All three need the member's Bearer session (T-307-06: not a cookie).

The router is mounted on a FRESH ``FastAPI()`` with dependency overrides (SEED-363 — never
``app.main.app``'s lifespan). Redis is the in-memory ``FakeRedis`` (atomic MULTI on one loop);
``db/api_keys`` and ``db/oauth`` are in-memory fakes; folders are read through a fake acting
reader that records the (user, org) it was asked for, so a route that judged folders in any org but
the PICKED one shows up here.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.mcp import oauth_store
from app.security import api_key_auth as auth
from app.security.principal_liveness import MCP_OFF_DEPLOYMENT_SENTENCE, MCP_OFF_ORG_SENTENCE
from app.services.mcp_tool_catalogue import MCP_TOOLS, PRESETS, normalise_tool_selection
from tests.unit._oauth307_fakes import FakeRedis

USER = "33333333-3333-4333-8333-333333333333"
ORG_A = "44444444-4444-4444-8444-444444444444"
ORG_B = "55555555-5555-4555-8555-555555555555"
ORG_OFF = "66666666-6666-4666-8666-666666666666"
ORG_FOREIGN = "99999999-9999-4999-8999-999999999999"
CLIENT_ROW = "77777777-7777-4777-8777-777777777777"
F_A = "f0000000-0000-4000-8000-00000000000a"
F_B = "f0000000-0000-4000-8000-00000000000b"
ISSUER = "https://api.syrel.example"
REDIRECT = "https://claude.ai/api/mcp/auth_callback"
READ = list(PRESETS["read"].tools)
AUTH = {"Authorization": "Bearer member-jwt"}


def _record(**kw) -> dict:
    rec = {
        "status": "ready",
        "client_row_id": CLIENT_ROW,
        "client_id": "p307-client",
        "client_kind": "dcr",
        "client_name": "  Claude  ",
        "client_uri": None,
        "name_source": "dcr",
        "published_host": None,
        "redirect_uri": REDIRECT,
        "redirect_host": "claude.ai",
        "redirect_kind": "web",
        "state": "st-307",
        "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        "resource": f"{ISSUER}/mcp",
        "created_at": 1,
    }
    rec.update(kw)
    return rec


class _World:
    def __init__(self):
        self.redis = FakeRedis()
        self.grants: list[dict] = []
        self.granted_clients: list[str] = []
        self.audits: list[dict] = []
        self.members = {ORG_A, ORG_B, ORG_OFF}
        self.orgs = {
            ORG_A: {"id": uuid.UUID(ORG_A), "name": "Acme Legal", "org_on": True},
            ORG_B: {"id": uuid.UUID(ORG_B), "name": "Beta Co", "org_on": True},
            ORG_OFF: {"id": uuid.UUID(ORG_OFF), "name": "Closed Ltd", "org_on": False},
        }
        self.deploy_on = True
        self.visible = {ORG_A: {F_A}, ORG_B: {F_B}}
        self.folder_reads: list[tuple[str, str]] = []

    def save(self, **kw) -> str:
        return asyncio.run(oauth_store.save_request(self.redis, _record(**kw)))


@pytest.fixture
def world(monkeypatch):
    from app.api import oauth_consent as route
    from app.services import mcp_narrowing as narrowing

    w = _World()

    async def member_orgs(pool, user_id):
        assert str(user_id) == USER
        return [dict(o) for oid, o in sorted(w.orgs.items(), key=lambda kv: kv[1]["name"])
                if oid in w.members]

    async def deployment_mcp_on(pool):
        return w.deploy_on

    async def mark_client_granted(conn, client_row_id):
        w.granted_clients.append(str(client_row_id))

    async def is_org_member(pool, *, org_id, user_id):
        return str(user_id) == USER and str(org_id) in w.members

    async def mcp_switches(pool, org_id):
        o = w.orgs.get(str(org_id))
        if o is None:
            return None
        return {"org_on": o["org_on"], "deploy_on": w.deploy_on, "org_name": o["name"]}

    async def create_api_key(pool, *, org_id, user_id, label, key_prefix, key_hash, workflows,
                             expires_at, kind="workflow", folder_ids=None, tools=None,
                             include_external=False, oauth_client_id=None):
        assert kind == "mcp" and oauth_client_id is not None and workflows == []
        assert 1 <= len(label.strip()) <= 60 and label == label.strip()
        assert folder_ids is None or len(folder_ids) >= 1
        row = {
            "id": uuid.uuid4(), "org_id": org_id, "user_id": user_id, "label": label,
            "key_prefix": key_prefix, "key_hash": key_hash, "expires_at": expires_at,
            "kind": kind, "folder_ids": folder_ids, "tools": tools,
            "include_external": include_external, "oauth_client_id": oauth_client_id,
            "revoked_at": None,
        }
        w.grants.append(row)
        return dict(row)

    async def visible(user_id, org_id):
        w.folder_reads.append((str(user_id), str(org_id)))
        return set(w.visible.get(str(org_id), set()))

    monkeypatch.setattr(route.oauth_db, "member_orgs", member_orgs)
    monkeypatch.setattr(route.oauth_db, "deployment_mcp_on", deployment_mcp_on)
    monkeypatch.setattr(route.oauth_db, "mark_client_granted", mark_client_granted)
    monkeypatch.setattr(route.api_keys_db, "is_org_member", is_org_member)
    monkeypatch.setattr(route.api_keys_db, "mcp_switches", mcp_switches)
    monkeypatch.setattr(route.api_keys_db, "create_api_key", create_api_key)
    monkeypatch.setattr(narrowing, "acting_visible_folder_ids", visible)
    monkeypatch.setattr(route.oauth_metadata, "issuer", lambda: ISSUER)

    async def _write(user_id, action_type, metadata, supabase, org_id=None):
        w.audits.append({"user_id": user_id, "action_type": action_type, "metadata": metadata,
                         "org_id": org_id})

    monkeypatch.setattr(auth, "write_audit_entry", _write)
    monkeypatch.setattr(auth, "get_service_role_supabase", lambda org_id: object())
    return w


def _app(w: _World, *, signed_in: bool = True) -> FastAPI:
    from app.api import oauth_consent as route

    app = FastAPI()
    app.include_router(route.router)

    async def _user():
        return {"id": USER, "email": "dana@acme.example"}

    async def _pool():
        return object()

    if signed_in:
        app.dependency_overrides[deps.get_current_user] = _user
    app.dependency_overrides[deps.get_pg_pool] = _pool
    app.dependency_overrides[deps.get_redis] = lambda: w.redis
    return app


@pytest.fixture
def client(world):
    return TestClient(_app(world))


def _approve(client, rid, **kw):
    body = {"org_id": ORG_A, "tools": READ, "folder_ids": None, "include_external": False}
    body.update(kw)
    return client.post(f"/oauth/requests/{rid}/approve", json=body, headers=AUTH)


def _q(url: str) -> dict:
    return {k: v[0] for k, v in parse_qs(urlsplit(url).query).items()}


# ── the session ───────────────────────────────────────────────────────────────────────────────


def test_no_session_is_401_on_all_three_routes(world):
    rid = world.save()
    c = TestClient(_app(world, signed_in=False))
    assert c.get(f"/oauth/requests/{rid}").status_code == 401
    assert c.post(f"/oauth/requests/{rid}/approve", json={}).status_code == 401
    assert c.post(f"/oauth/requests/{rid}/deny").status_code == 401
    assert world.grants == [] and asyncio.run(oauth_store.peek_request(world.redis, rid)) is not None


# ── GET ───────────────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("rid", ["not-a-uuid", str(uuid.uuid4()), "0B7F3A1E-2C4D-4E5F-8A9B-1C2D3E4F5A6B"])
def test_a_malformed_or_missing_request_reads_expired(client, rid):
    r = client.get(f"/oauth/requests/{rid}", headers=AUTH)
    assert r.status_code == 200
    assert r.json() == {"status": "expired"}


def test_a_refused_request_carries_the_reason_and_host_and_no_client_name(client, world):
    rid = asyncio.run(oauth_store.save_refused_request(world.redis, reason="host_not_allowed",
                                                       host="evil.example"))
    r = client.get(f"/oauth/requests/{rid}", headers=AUTH)
    assert r.json() == {"status": "refused", "reason": "host_not_allowed", "host": "evil.example"}


def test_a_deployment_off_request_names_the_redirect_host(client, world):
    rid = world.save(status="deployment_off")
    assert client.get(f"/oauth/requests/{rid}", headers=AUTH).json() == {
        "status": "deployment_off", "host": "claude.ai",
    }


def test_a_ready_request_switched_off_since_reads_deployment_off(client, world):
    rid = world.save()
    world.deploy_on = False
    assert client.get(f"/oauth/requests/{rid}", headers=AUTH).json()["status"] == "deployment_off"


def test_a_ready_request_reads_the_whole_consent_wire_and_is_not_consumed(client, world):
    rid = world.save()
    r = client.get(f"/oauth/requests/{rid}", headers={**AUTH, "X-Org-Id": ORG_B})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ready"
    assert body["client"] == {
        "name": "Claude", "name_source": "dcr", "published_host": None,
        "redirect_host": "claude.ai", "redirect_kind": "web", "host_seeded": True,
    }
    assert body["account"] == {"email": "dana@acme.example"}
    assert body["orgs"] == [
        {"id": ORG_A, "name": "Acme Legal", "mcp_off": None, "active": False},
        {"id": ORG_B, "name": "Beta Co", "mcp_off": None, "active": True},
        {"id": ORG_OFF, "name": "Closed Ltd", "mcp_off": "org", "active": False},
    ]
    assert [t["name"] for t in body["tools"]] == [t.name for t in MCP_TOOLS]
    assert set(body["tools"][0]) == {"name", "group", "label", "travels_with"}
    # Reading does not consume: the request is still there.
    assert asyncio.run(oauth_store.peek_request(world.redis, rid)) is not None
    # And a refusal-free read never leaks the redirect URI, state or PKCE challenge.
    flat = r.text
    for secret in ("st-307", "E9Melhoa2", "auth_callback", CLIENT_ROW):
        assert secret not in flat


@pytest.mark.parametrize("host, kind, seeded", [
    ("claude.com", "web", True), ("app.example.com", "web", False), ("localhost", "loopback", False),
])
def test_host_seeded_is_true_only_for_the_built_in_web_hosts(client, world, host, kind, seeded):
    rid = world.save(redirect_host=host, redirect_kind=kind)
    assert client.get(f"/oauth/requests/{rid}", headers=AUTH).json()["client"]["host_seeded"] is seeded


def test_a_cimd_client_reads_its_published_host(client, world):
    rid = world.save(name_source="cimd", client_kind="cimd", published_host="claude.ai",
                     client_id="https://claude.ai/oauth/claude-code-client-metadata")
    client_wire = client.get(f"/oauth/requests/{rid}", headers=AUTH).json()["client"]
    assert client_wire["name_source"] == "cimd" and client_wire["published_host"] == "claude.ai"


def test_bidi_and_zero_width_characters_are_dropped_from_the_name():
    """T-307-23 (Rule 2, found during 307-03): a self-registered name cannot reorder or hide its
    letters with Unicode format characters to pass for another app."""
    from app.api.oauth_consent import client_label

    assert client_label("Cl‮edua‬") == "Cledua"
    assert client_label("Cla​ude") == "Claude"
    assert client_label("Claude\x07\x1b[31m") == "Claude[31m"
    assert client_label("‮​") == "Connected app"
    assert client_label("  two\n\tlines  ") == "two lines"


def test_a_missing_name_reads_connected_app_and_a_long_one_is_capped(client, world):
    rid = world.save(client_name=None)
    assert client.get(f"/oauth/requests/{rid}", headers=AUTH).json()["client"]["name"] == "Connected app"
    rid2 = world.save(client_name="x" * 300)
    assert client.get(f"/oauth/requests/{rid2}", headers=AUTH).json()["client"]["name"] == "x" * 60


# ── approve ───────────────────────────────────────────────────────────────────────────────────


def test_approve_creates_the_grant_and_a_single_use_code_and_returns_the_redirect(client, world):
    rid = world.save()
    before = datetime.now(timezone.utc)
    r = _approve(client, rid)
    assert r.status_code == 200, r.text
    url = r.json()["redirect_url"]
    assert url.startswith(REDIRECT + "?")
    q = _q(url)
    assert q["state"] == "st-307" and q["iss"] == ISSUER and len(q["code"]) >= 40
    # The grant: kind mcp, the client, the PICKED org, the member, 90 days, the trimmed name.
    (g,) = world.grants
    assert str(g["org_id"]) == ORG_A and str(g["user_id"]) == USER
    assert str(g["oauth_client_id"]) == CLIENT_ROW
    assert g["label"] == "Claude"
    assert g["tools"] == list(normalise_tool_selection(READ).tools)
    assert g["folder_ids"] is None and g["include_external"] is False
    assert timedelta(days=89, hours=23) < g["expires_at"] - before < timedelta(days=90, minutes=5)
    assert len(g["key_hash"]) == 64  # a digest of a secret nobody is shown
    # The code is stored for 60 s under its digest, bound to everything /oauth/token checks.
    digest = oauth_store.digest_code(q["code"])
    stored = asyncio.run(oauth_store.take_code(world.redis, digest))
    assert stored == {
        "grant_id": str(g["id"]), "org_id": ORG_A, "client_id": "p307-client",
        "client_row_id": CLIENT_ROW, "redirect_uri": REDIRECT,
        "code_challenge": _record()["code_challenge"], "resource": f"{ISSUER}/mcp",
    }
    assert world.granted_clients == [CLIENT_ROW]
    # The request is consumed.
    assert asyncio.run(oauth_store.peek_request(world.redis, rid)) is None
    # One api_key.create row, credential oauth, naming the client and the redirect host.
    (a,) = world.audits
    assert a["action_type"] == "api_key.create" and a["org_id"] == ORG_A and a["user_id"] == USER
    assert a["metadata"]["kind"] == "mcp" and a["metadata"]["call"] == "manage"
    assert a["metadata"]["api_key_id"] == str(g["id"])
    assert a["metadata"]["detail"] == {
        "credential": "oauth", "client_name": "Claude", "redirect_host": "claude.ai",
    }


def test_the_code_ttl_is_sixty_seconds(client, world):
    rid = world.save()
    q = _q(_approve(client, rid).json()["redirect_url"])
    assert world.redis.ttls["oauth:code:" + oauth_store.digest_code(q["code"])] == 60


def test_an_existing_query_on_the_redirect_is_preserved(client, world):
    rid = world.save(redirect_uri="http://localhost:51234/callback?x=1", redirect_host="localhost",
                     redirect_kind="loopback")
    url = _approve(client, rid).json()["redirect_url"]
    assert url.startswith("http://localhost:51234/callback?x=1&")
    q = _q(url)
    assert q["x"] == "1" and q["state"] == "st-307" and q["iss"] == ISSUER and "code" in q


def test_a_narrowed_pick_is_stored_as_picked(client, world):
    rid = world.save()
    tools = list(PRESETS["ask"].tools)
    r = _approve(client, rid, org_id=ORG_B, tools=tools, folder_ids=[F_B], include_external=True)
    assert r.status_code == 200, r.text
    (g,) = world.grants
    assert str(g["org_id"]) == ORG_B and g["folder_ids"] == [F_B] and g["include_external"] is True
    assert g["tools"] == list(normalise_tool_selection(tools).tools)
    # Folders were judged in the PICKED org on the member's own visibility.
    assert world.folder_reads == [(USER, ORG_B)]


def test_not_a_member_of_the_picked_org_is_403_and_the_request_stays(client, world):
    rid = world.save()
    r = _approve(client, rid, org_id=ORG_FOREIGN)
    assert r.status_code == 403
    assert isinstance(r.json()["detail"], str) and r.json()["detail"]
    assert world.grants == [] and asyncio.run(oauth_store.peek_request(world.redis, rid)) is not None


def test_the_org_switch_off_is_403_with_the_304_sentence(client, world):
    rid = world.save()
    r = _approve(client, rid, org_id=ORG_OFF)
    assert (r.status_code, r.json()["detail"]) == (403, MCP_OFF_ORG_SENTENCE)
    assert world.grants == []


def test_the_deployment_switch_off_is_403_with_the_304_sentence(client, world):
    rid = world.save()
    world.deploy_on = False
    r = _approve(client, rid)
    assert (r.status_code, r.json()["detail"]) == (403, MCP_OFF_DEPLOYMENT_SENTENCE)


@pytest.mark.parametrize("tools", [[], ["no_such_tool"]])
def test_a_bad_tool_pick_is_422_with_the_304_words_and_the_request_stays(client, world, tools):
    rid = world.save()
    r = _approve(client, rid, tools=tools)
    assert (r.status_code, r.json()["detail"]) == (422, normalise_tool_selection(tools).refusal)
    assert world.grants == []
    assert _approve(client, rid).status_code == 200  # still approvable


def test_an_unseen_folder_is_422_and_an_empty_folder_list_is_422(client, world):
    from app.models.api_key import MCP_EMPTY_FOLDERS_SENTENCE
    from app.services.mcp_narrowing import _FOLDER_NOT_VISIBLE

    rid = world.save()
    r = _approve(client, rid, folder_ids=[F_B])  # ORG_B's folder, picked org is ORG_A
    assert (r.status_code, r.json()["detail"]) == (422, _FOLDER_NOT_VISIBLE)
    r2 = _approve(client, rid, folder_ids=[])
    assert r2.status_code == 422
    assert MCP_EMPTY_FOLDERS_SENTENCE in r2.text
    assert world.grants == []


def test_an_extra_field_is_refused(client, world):
    rid = world.save()
    assert _approve(client, rid, expires_in_days=365).status_code == 422
    assert _approve(client, rid, user_id=USER).status_code == 422


def test_a_second_approve_and_a_deny_after_approve_are_410(client, world):
    rid = world.save()
    assert _approve(client, rid).status_code == 200
    assert _approve(client, rid).status_code == 410
    r = client.post(f"/oauth/requests/{rid}/deny", headers=AUTH)
    assert r.status_code == 410 and "redirect_url" not in r.text
    assert len(world.grants) == 1


def test_a_stale_or_unknown_request_is_410_and_never_a_redirect(client, world):
    r = _approve(client, str(uuid.uuid4()))
    assert r.status_code == 410 and "redirect_url" not in r.text
    assert _approve(client, "not-a-uuid").status_code == 410


def test_a_refused_request_can_be_neither_approved_nor_denied_into_a_redirect(client, world):
    rid = asyncio.run(oauth_store.save_refused_request(world.redis, reason="not_registered",
                                                       host="claude.ai"))
    assert _approve(client, rid).status_code == 410
    rid2 = asyncio.run(oauth_store.save_refused_request(world.redis, reason="unknown_client", host=None))
    r = client.post(f"/oauth/requests/{rid2}/deny", headers=AUTH)
    assert r.status_code == 410 and "redirect_url" not in r.text


def test_a_deployment_off_request_cannot_be_approved(client, world):
    rid = world.save(status="deployment_off")
    r = _approve(client, rid)
    assert (r.status_code, r.json()["detail"]) == (403, MCP_OFF_DEPLOYMENT_SENTENCE)
    assert world.grants == []


def test_two_concurrent_approves_make_exactly_one_grant(world):
    rid = world.save()
    app = _app(world)

    async def go():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
            body = {"org_id": ORG_A, "tools": READ, "folder_ids": None, "include_external": False}
            return await asyncio.gather(*[
                c.post(f"/oauth/requests/{rid}/approve", json=body, headers=AUTH) for _ in range(2)
            ])

    statuses = sorted(r.status_code for r in asyncio.run(go()))
    assert statuses == [200, 410]
    assert len(world.grants) == 1


def test_d50_two_approvals_from_the_same_client_leave_both_grants(client, world):
    first = world.save()
    second = world.save()
    assert _approve(client, first).status_code == 200
    assert _approve(client, second).status_code == 200
    assert len(world.grants) == 2
    assert all(g["revoked_at"] is None for g in world.grants)
    assert {g["label"] for g in world.grants} == {"Claude"}


# ── deny ──────────────────────────────────────────────────────────────────────────────────────


def test_deny_returns_access_denied_with_state_and_iss_and_writes_no_grant(client, world):
    rid = world.save()
    r = client.post(f"/oauth/requests/{rid}/deny", headers=AUTH)
    assert r.status_code == 200
    url = r.json()["redirect_url"]
    assert url.startswith(REDIRECT + "?")
    assert _q(url) == {"error": "access_denied", "state": "st-307", "iss": ISSUER}
    assert world.grants == [] and world.audits == []
    assert asyncio.run(oauth_store.peek_request(world.redis, rid)) is None
    assert client.post(f"/oauth/requests/{rid}/deny", headers=AUTH).status_code == 410


def test_deny_on_a_deployment_off_request_sends_access_denied(client, world):
    rid = world.save(status="deployment_off")
    r = client.post(f"/oauth/requests/{rid}/deny", headers=AUTH)
    assert r.status_code == 200 and _q(r.json()["redirect_url"])["error"] == "access_denied"


# ── the store is down ─────────────────────────────────────────────────────────────────────────


def test_a_store_outage_is_503_with_a_sentence(world):
    rid = world.save()
    world.redis.broken = True
    c = TestClient(_app(world))
    for r in (
        c.get(f"/oauth/requests/{rid}", headers=AUTH),
        _approve(c, rid),
        c.post(f"/oauth/requests/{rid}/deny", headers=AUTH),
    ):
        assert r.status_code == 503
        assert isinstance(r.json()["detail"], str) and r.json()["detail"].endswith(".")
    assert world.grants == []


# ── where it is mounted (D-03 / P-3) ──────────────────────────────────────────────────────────


def test_register_mcp_includes_the_consent_router_on_a_fastapi_app(monkeypatch):
    from tests.unit import _mcp305_harness as h
    from app.mcp import register_mcp

    h.configure(monkeypatch, base="https://api.example.com", env="production")
    app = FastAPI()
    register_mcp(app)
    paths = {getattr(r, "path", None) for r in app.router.routes}
    assert {"/oauth/requests/{request_id}", "/oauth/requests/{request_id}/approve",
            "/oauth/requests/{request_id}/deny"} <= paths
    # Hidden from the OpenAPI document, like /mcp.
    assert not any(p.startswith("/oauth/requests") for p in app.openapi().get("paths", {}))


def test_a_bare_starlette_app_still_registers(monkeypatch):
    from tests.unit import _mcp305_harness as h

    h.configure(monkeypatch, base="https://api.example.com", env="production")
    app = h.fresh_app()  # Starlette has no include_router: no error, /mcp still mounted
    paths = {getattr(r, "path", None) for r in app.router.routes}
    assert "/mcp" in paths
    assert not any(str(p).startswith("/oauth/requests") for p in paths)


def test_with_no_public_base_the_consent_routes_do_not_exist(monkeypatch):
    from tests.unit import _mcp305_harness as h
    from app.mcp import register_mcp

    h.configure(monkeypatch, base=None, env="production")
    app = FastAPI()
    register_mcp(app)
    with TestClient(app) as c:
        assert c.get(f"/oauth/requests/{uuid.uuid4()}", headers=AUTH).status_code == 404


def test_the_route_never_reads_the_active_org_and_never_revokes():
    from pathlib import Path

    src = (Path(__file__).resolve().parents[2] / "app" / "api" / "oauth_consent.py").read_text("utf-8")
    assert "get_active_org_id" not in src
    for word in ("revoke_key", "revoke_grant", "revoked_at"):
        assert word not in src
    assert src.count("validate_mcp_narrowing(") == 1
    assert "take_request(" in src
