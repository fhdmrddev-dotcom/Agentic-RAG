"""Phase 307-02 (D-07..D-10, D-34, D-45, D-49, D-05; T-307-01/-03/-04/-09/-10) — register + authorize.

``/oauth/register`` (RFC 7591, public clients only) and ``/oauth/authorize`` with every database,
Redis and network seam stubbed. The browser-facing rule this file exists for: an invalid client or
redirect is stored as a REFUSED request and the browser goes to Syrel's own consent route — the
``Location`` never points at an unproven client address. Only after the redirect is proven do the
other errors go back to it, with ``error``, ``state`` and ``iss``.
"""
from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

import pytest
from starlette.testclient import TestClient

from tests.unit import _mcp305_harness as h
from tests.unit._oauth307_fakes import FakeRedis

FRONT = "http://localhost:5173"
CLAUDE = "https://claude.ai/api/mcp/auth_callback"
CIMD_URL = "https://claude.ai/oauth/claude-code-client-metadata"
CIMD_DOC = {
    "client_id": CIMD_URL,
    "client_name": "Claude Code",
    "client_uri": "https://claude.ai",
    "redirect_uris": ["http://localhost/callback", "http://127.0.0.1/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none",
}
CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"  # RFC 7636 appendix B (307-01 SUMMARY)
CLAUDE_AI_DCR = {
    "client_name": "Claude",
    "redirect_uris": [CLAUDE],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none",
}


class FakeDb:
    def __init__(self):
        self.allow = [{"host": "claude.ai"}, {"host": "claude.com"}]
        self.clients: dict[str, dict] = {}
        self.deploy_on = True
        self.pruned: list[dict] = []
        self.cimd_pruned: list[dict] = []
        self.cimd_prune_fails = False
        self.upserts: list[dict] = []

    def add_dcr(self, client_id, redirect_uris, name="Claude"):
        row = {"id": uuid.uuid4(), "client_id": client_id, "kind": "dcr", "client_name": name,
               "client_uri": None, "redirect_uris": list(redirect_uris), "metadata_fetched_at": None,
               "metadata_expires_at": None, "created_at": datetime.now(timezone.utc),
               "last_grant_at": None}
        self.clients[client_id] = row
        return row

    def install(self, monkeypatch):
        from app.db import oauth as oauth_db

        async def get_redirect_hosts(pool):
            return list(self.allow)

        async def insert_dcr_client(pool, *, client_id, client_name, client_uri, redirect_uris):
            row = self.add_dcr(client_id, redirect_uris, client_name)
            row["client_uri"] = client_uri
            return dict(row)

        async def get_client(pool, client_id):
            row = self.clients.get(client_id)
            return dict(row) if row else None

        async def upsert_cimd_client(pool, *, client_id, client_name, client_uri, redirect_uris,
                                     fetched_at, expires_at):
            existing = self.clients.get(client_id)
            if existing and existing["kind"] != "cimd":
                raise ValueError("a non-CIMD client already holds this client_id")
            row = {"id": (existing or {}).get("id", uuid.uuid4()), "client_id": client_id,
                   "kind": "cimd", "client_name": client_name, "client_uri": client_uri,
                   "redirect_uris": list(redirect_uris), "metadata_fetched_at": fetched_at,
                   "metadata_expires_at": expires_at, "created_at": datetime.now(timezone.utc),
                   "last_grant_at": None}
            self.clients[client_id] = row
            self.upserts.append(row)
            return dict(row)

        async def delete_unused_dcr_clients(pool, *, older_than_hours=24, limit=500):
            self.pruned.append({"older_than_hours": older_than_hours})
            return 0

        async def deployment_mcp_on(pool):
            return self.deploy_on

        async def delete_unused_cimd_clients(pool, *, older_than_hours=24, limit=500):
            if self.cimd_prune_fails:
                raise ConnectionError("db blip")
            self.cimd_pruned.append({"older_than_hours": older_than_hours, "upserts": len(self.upserts)})
            return 0

        monkeypatch.setattr(oauth_db, "delete_unused_cimd_clients", delete_unused_cimd_clients,
                            raising=False)

        for name, fn in {
            "get_redirect_hosts": get_redirect_hosts, "insert_dcr_client": insert_dcr_client,
            "get_client": get_client, "upsert_cimd_client": upsert_cimd_client,
            "delete_unused_dcr_clients": delete_unused_dcr_clients,
            "deployment_mcp_on": deployment_mcp_on,
        }.items():
            monkeypatch.setattr(oauth_db, name, fn)


class World:
    def __init__(self, monkeypatch, *, redis=None):
        from app.config import settings
        from app.mcp import oauth_clients, oauth_server

        h.configure(monkeypatch)
        monkeypatch.setattr(settings, "frontend_url", FRONT, raising=False)
        self.redis = redis or FakeRedis()
        self.db = FakeDb()
        self.db.install(monkeypatch)
        self.fetches: list[str] = []
        self.cimd_answer: object = (dict(CIMD_DOC), 300)

        async def _pool():
            return object()

        async def fetch(url, **kw):
            self.fetches.append(url)
            return self.cimd_answer

        monkeypatch.setattr(oauth_server, "get_redis", lambda: self.redis)
        monkeypatch.setattr(oauth_server, "get_pg_pool", _pool)
        monkeypatch.setattr(oauth_clients, "fetch_cimd_document", fetch)
        self.client = TestClient(h.fresh_app(), base_url=h.BASE, follow_redirects=False)

    def authorize(self, **params):
        base = {
            "response_type": "code", "client_id": "dcr-1", "redirect_uri": CLAUDE,
            "code_challenge": CHALLENGE, "code_challenge_method": "S256", "state": "st-123",
            "resource": "http://localhost:8000/mcp",
        }
        for k, v in params.items():
            if v is None:
                base.pop(k, None)
            else:
                base[k] = v
        return self.client.get("/oauth/authorize", params=base)

    def request_id(self, r) -> str:
        loc = r.headers["location"]
        assert loc.startswith(f"{FRONT}/app/connect/"), loc
        return loc.rsplit("/", 1)[1]

    def stored(self, rid) -> dict:
        return json.loads(self.redis.store[f"oauth:req:{rid}"])


@pytest.fixture
def w(monkeypatch):
    return World(monkeypatch)


# ── register ─────────────────────────────────────────────────────────────────────────────────


def test_register_accepts_claude_ai_and_never_returns_a_secret(w):
    started = time.monotonic()
    r = w.client.post("/oauth/register", json=CLAUDE_AI_DCR)
    assert time.monotonic() - started < 1.0
    assert r.status_code == 201, r.text
    body = r.json()
    assert "client_secret" not in body
    assert body["token_endpoint_auth_method"] == "none"
    assert body["redirect_uris"] == [CLAUDE]
    assert body["grant_types"] == ["authorization_code", "refresh_token"]
    assert body["response_types"] == ["code"]
    assert body["client_name"] == "Claude"
    assert isinstance(body["client_id_issued_at"], int)
    assert len(body["client_id"]) >= 22 and body["client_id"] in w.db.clients
    assert r.headers["cache-control"] == "no-store"
    assert w.db.pruned == [{"older_than_hours": 24}]


def test_two_registrations_get_two_opaque_ids(w):
    a = w.client.post("/oauth/register", json=CLAUDE_AI_DCR).json()["client_id"]
    b = w.client.post("/oauth/register", json=CLAUDE_AI_DCR).json()["client_id"]
    assert a != b


@pytest.mark.parametrize("body, code", [
    ({"redirect_uris": ["https://evil.example/cb"]}, "invalid_redirect_uri"),
    ({"redirect_uris": [CLAUDE], "token_endpoint_auth_method": "client_secret_basic"},
     "invalid_client_metadata"),
    ({"redirect_uris": []}, "invalid_redirect_uri"),
])
def test_register_refusals_are_400_with_the_oauth_code(w, body, code):
    r = w.client.post("/oauth/register", json=body)
    assert r.status_code == 400
    assert r.json()["error"] == code


def test_register_refuses_a_non_json_body(w):
    r = w.client.post("/oauth/register", content=b"not json", headers={"content-type": "application/json"})
    assert r.status_code == 400
    assert r.json()["error"] == "invalid_client_metadata"


def test_register_refuses_a_body_over_sixteen_kilobytes(w):
    body = dict(CLAUDE_AI_DCR, padding="x" * 17_000)
    r = w.client.post("/oauth/register", content=json.dumps(body).encode(),
                      headers={"content-type": "application/json"})
    assert r.status_code == 413
    assert w.db.clients == {}


def test_register_over_its_bucket_is_429_with_retry_after(w):
    from app.services.rate_limit import OAUTH_REGISTER_PER_MINUTE

    for _ in range(OAUTH_REGISTER_PER_MINUTE):
        assert w.client.post("/oauth/register", json=CLAUDE_AI_DCR).status_code == 201
    r = w.client.post("/oauth/register", json=CLAUDE_AI_DCR)
    assert r.status_code == 429
    assert 1 <= int(r.headers["retry-after"]) <= 60


def test_register_with_redis_down_is_503(monkeypatch):
    w = World(monkeypatch, redis=FakeRedis(broken=True))
    r = w.client.post("/oauth/register", json=CLAUDE_AI_DCR)
    assert r.status_code == 503
    assert w.db.clients == {}


# ── authorize: the happy paths ───────────────────────────────────────────────────────────────


def test_a_valid_dcr_request_goes_to_the_consent_route_and_is_stored(w):
    row = w.db.add_dcr("dcr-1", [CLAUDE])
    started = time.monotonic()
    r = w.authorize(scope="whatever offline_access")
    assert time.monotonic() - started < 1.0
    assert r.status_code == 302
    rid = w.request_id(r)
    uuid.UUID(rid, version=4)
    assert rid == rid.lower()
    assert r.headers["cache-control"] == "no-store"
    rec = w.stored(rid)
    assert rec["status"] == "ready"
    assert rec["client_row_id"] == str(row["id"])
    assert rec["client_id"] == "dcr-1"
    assert rec["client_kind"] == "dcr"
    assert rec["client_name"] == "Claude"
    assert rec["name_source"] == "dcr"
    assert rec["redirect_uri"] == CLAUDE
    assert rec["redirect_host"] == "claude.ai"
    assert rec["redirect_kind"] == "web"
    assert rec["state"] == "st-123"
    assert rec["code_challenge"] == CHALLENGE
    assert rec["resource"] == "http://localhost:8000/mcp"
    assert w.redis.ttls[f"oauth:req:{rid}"] == 600


def test_a_cimd_request_fetches_validates_and_caches_the_client(w):
    r = w.authorize(client_id=CIMD_URL, redirect_uri="http://localhost:54001/callback")
    rid = w.request_id(r)
    rec = w.stored(rid)
    assert rec["status"] == "ready"
    assert rec["client_kind"] == "cimd"
    assert rec["name_source"] == "cimd"
    assert rec["published_host"] == "claude.ai"
    assert rec["client_name"] == "Claude Code"
    assert rec["redirect_uri"] == "http://localhost:54001/callback"  # as SENT, port included
    assert rec["redirect_kind"] == "loopback"
    assert w.fetches == [CIMD_URL]
    assert len(w.db.upserts) == 1
    up = w.db.upserts[0]
    assert timedelta(seconds=290) < up["metadata_expires_at"] - up["metadata_fetched_at"] <= timedelta(seconds=300)


def test_wr04_a_cimd_fetch_prunes_never_granted_cimd_clients_before_upserting(w):
    w.authorize(client_id=CIMD_URL, redirect_uri="http://localhost:54001/callback")
    # the prune ran once, BEFORE the fresh row was written (so it can never be its own victim)
    assert w.db.cimd_pruned == [{"older_than_hours": 24, "upserts": 0}]
    assert len(w.db.upserts) == 1
    # a cached client is not fetched, so nothing new is written and nothing is pruned
    w.authorize(client_id=CIMD_URL, redirect_uri="http://localhost:2/callback")
    assert len(w.db.cimd_pruned) == 1


def test_wr04_register_prunes_cimd_clients_too(w):
    assert w.client.post("/oauth/register", json=CLAUDE_AI_DCR).status_code == 201
    assert w.db.pruned == [{"older_than_hours": 24}]
    assert w.db.cimd_pruned == [{"older_than_hours": 24, "upserts": 0}]


def test_wr04_a_failed_cimd_prune_never_blocks_a_sign_in(w):
    w.db.cimd_prune_fails = True
    r = w.authorize(client_id=CIMD_URL, redirect_uri="http://localhost:54001/callback")
    assert w.stored(w.request_id(r))["status"] == "ready"
    assert w.client.post("/oauth/register", json=CLAUDE_AI_DCR).status_code == 201


async def test_wr04_the_cimd_prune_sql_takes_only_never_granted_stale_unreferenced_cimd_rows():
    from app.db import oauth as oauth_db

    class Pool:
        calls: list = []

        async def execute(self, sql, *args):
            self.calls.append((sql, args))
            return "DELETE 3"

    pool = Pool()
    assert await oauth_db.delete_unused_cimd_clients(pool, older_than_hours=24, limit=500) == 3
    ((sql, args),) = pool.calls
    assert sql.startswith("DELETE FROM public.oauth_clients WHERE id IN (")
    for part in ("c.kind = 'cimd'", "c.last_grant_at IS NULL",
                 "COALESCE(c.metadata_fetched_at, c.created_at) < now() - make_interval(hours => $1)",
                 "NOT EXISTS (SELECT 1 FROM public.api_keys k WHERE k.oauth_client_id = c.id)",
                 "LIMIT $2"):
        assert part in sql, part
    assert args == (24, 500)


def test_a_fresh_cached_cimd_client_is_not_fetched_again(w):
    w.authorize(client_id=CIMD_URL, redirect_uri="http://localhost:1/callback")
    w.authorize(client_id=CIMD_URL, redirect_uri="http://localhost:2/callback")
    assert w.fetches == [CIMD_URL]


def test_a_stale_cimd_client_is_refetched(w):
    w.authorize(client_id=CIMD_URL, redirect_uri="http://localhost:1/callback")
    w.db.clients[CIMD_URL]["metadata_expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=1)
    w.authorize(client_id=CIMD_URL, redirect_uri="http://localhost:2/callback")
    assert w.fetches == [CIMD_URL, CIMD_URL]


def test_a_trailing_slash_resource_is_the_same_resource(w):
    w.db.add_dcr("dcr-1", [CLAUDE])
    r = w.authorize(resource="http://localhost:8000/mcp/")
    assert w.stored(w.request_id(r))["status"] == "ready"


def test_the_deployment_switch_off_stores_a_deployment_off_request(w):
    w.db.add_dcr("dcr-1", [CLAUDE])
    w.db.deploy_on = False
    r = w.authorize()
    assert w.stored(w.request_id(r))["status"] == "deployment_off"


# ── authorize: refused BEFORE the redirect is proven -> Syrel's consent route ───────────────────


def _refused(w, r) -> dict:
    assert r.status_code == 302
    rec = w.stored(w.request_id(r))
    assert rec["status"] == "refused"
    assert set(rec) == {"status", "reason", "host"}
    return rec


def test_an_unknown_client_is_a_refused_request(w):
    rec = _refused(w, w.authorize(client_id="nope"))
    assert rec == {"status": "refused", "reason": "unknown_client", "host": "claude.ai"}


def test_an_unregistered_redirect_is_refused_and_never_followed(w):
    w.db.add_dcr("dcr-1", [CLAUDE])
    r = w.authorize(redirect_uri="https://claude.ai/api/mcp/auth_callback/evil")
    rec = _refused(w, r)
    assert rec["reason"] == "not_registered"
    assert urlsplit(r.headers["location"]).netloc == "localhost:5173"


def test_a_host_removed_from_the_allowlist_is_refused_at_authorize(w):
    w.db.add_dcr("dcr-1", [CLAUDE])
    w.db.allow = [{"host": "claude.com"}]
    rec = _refused(w, w.authorize())
    assert rec == {"status": "refused", "reason": "host_not_allowed", "host": "claude.ai"}


def test_an_unreadable_cimd_document_is_refused_and_negative_cached(w):
    w.cimd_answer = "metadata_unreadable"
    rec = _refused(w, w.authorize(client_id=CIMD_URL, redirect_uri="http://localhost:1/callback"))
    assert rec == {"status": "refused", "reason": "metadata_unreadable", "host": "claude.ai"}
    _refused(w, w.authorize(client_id=CIMD_URL, redirect_uri="http://localhost:1/callback"))
    assert w.fetches == [CIMD_URL], "a failed CIMD URL was fetched again inside its 60 s"


def test_a_cimd_url_that_is_not_fetchable_is_unreadable_without_a_fetch(w):
    rec = _refused(w, w.authorize(client_id="https://claude.ai:8443/meta",
                                  redirect_uri="http://localhost/callback"))
    assert rec["reason"] == "metadata_unreadable"
    assert w.fetches == []


def test_a_cimd_redirect_not_in_its_document_is_not_registered(w):
    rec = _refused(w, w.authorize(client_id=CIMD_URL, redirect_uri="http://[::1]:5/callback"))
    assert rec["reason"] == "not_registered"


def test_a_missing_redirect_uri_is_refused_not_guessed(w):
    w.db.add_dcr("dcr-1", [CLAUDE])
    rec = _refused(w, w.authorize(redirect_uri=None))
    assert rec["reason"] == "not_registered"


# ── authorize: refused AFTER the redirect is proven -> back to it with error, state, iss ─────────


def _error_back(r, redirect=CLAUDE) -> dict:
    assert r.status_code == 302
    loc = r.headers["location"]
    assert loc.startswith(redirect)
    return {k: v[0] for k, v in parse_qs(urlsplit(loc).query).items()}


@pytest.mark.parametrize("change, error", [
    ({"code_challenge_method": None}, "invalid_request"),
    ({"code_challenge_method": "plain"}, "invalid_request"),
    ({"code_challenge": None}, "invalid_request"),
    ({"code_challenge": "short"}, "invalid_request"),
    ({"code_challenge": CHALLENGE + "x"}, "invalid_request"),
    ({"resource": None}, "invalid_target"),
    ({"resource": "https://other.example/mcp"}, "invalid_target"),
    ({"resource": "http://localhost:8000/mcpx"}, "invalid_target"),
    ({"response_type": "token"}, "unsupported_response_type"),
    ({"response_type": None}, "unsupported_response_type"),
])
def test_post_redirect_errors_go_back_with_state_and_iss(w, change, error):
    w.db.add_dcr("dcr-1", [CLAUDE])
    q = _error_back(w.authorize(**change))
    assert q == {"error": error, "state": "st-123", "iss": "http://localhost:8000"}


def test_a_missing_state_is_invalid_request_without_a_state(w):
    w.db.add_dcr("dcr-1", [CLAUDE])
    q = _error_back(w.authorize(state=None))
    assert q == {"error": "invalid_request", "iss": "http://localhost:8000"}


def test_an_existing_query_on_the_redirect_is_preserved(w):
    w.db.add_dcr("dcr-1", ["http://localhost/cb?app=1"])
    r = w.authorize(redirect_uri="http://localhost:7/cb?app=1", response_type="token")
    loc = r.headers["location"]
    assert loc.startswith("http://localhost:7/cb?app=1&error=unsupported_response_type")


def test_the_iss_parameter_is_the_metadata_issuer_byte_for_byte(w):
    from app.mcp import oauth_metadata as m

    w.db.add_dcr("dcr-1", [CLAUDE])
    q = _error_back(w.authorize(code_challenge_method="plain"))
    assert q["iss"] == m.authorization_server_metadata()["issuer"]


# ── failure modes ────────────────────────────────────────────────────────────────────────────


def test_redis_down_is_a_plain_503_that_echoes_nothing(monkeypatch):
    w = World(monkeypatch, redis=FakeRedis(broken=True))
    w.db.add_dcr("dcr-1", [CLAUDE])
    r = w.authorize(state="ECHO-ME-NOT")
    assert r.status_code == 503
    assert r.headers["content-type"].startswith("text/plain")
    assert "ECHO-ME-NOT" not in r.text and "dcr-1" not in r.text and "claude.ai" not in r.text
    assert "location" not in r.headers


def test_authorize_over_its_bucket_is_429(w):
    from app.services.rate_limit import OAUTH_AUTHORIZE_PER_MINUTE

    w.db.add_dcr("dcr-1", [CLAUDE])
    for _ in range(OAUTH_AUTHORIZE_PER_MINUTE):
        assert w.authorize().status_code == 302
    r = w.authorize()
    assert r.status_code == 429
    assert "retry-after" in r.headers


def test_an_unexpected_error_is_a_503_never_a_traceback(w, monkeypatch):
    from app.db import oauth as oauth_db

    async def boom(pool, client_id):
        raise RuntimeError("db exploded SECRET-DETAIL")

    monkeypatch.setattr(oauth_db, "get_client", boom)
    r = w.authorize()
    assert r.status_code == 503
    assert "SECRET-DETAIL" not in r.text and "Traceback" not in r.text


def test_the_server_imports_no_sdk_auth_framework():
    import inspect

    from app.mcp import oauth_server

    src = inspect.getsource(oauth_server)
    assert "create_auth_routes" not in src
    assert "OAuthAuthorizationServerProvider" not in src
