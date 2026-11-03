"""Phase 307-02 (D-14, D-17, D-19, D-20, D-46, D-47, D-48; T-307-02/-03/-11/-14) — /oauth/token, /oauth/revoke.

Every database, Redis and audit seam is stubbed; the rotation STATE MACHINE itself is 307-01's
(``rotate_refresh``, driven live there) — here its five outcomes are mapped to the wire.

* code exchange: one identical ``invalid_grant`` body for every binding mismatch; a replayed code
  revokes the grant the first exchange bought; ``Cache-Control: no-store`` on every answer.
* refresh: liveness is asked ONLY through ``api_key_auth.grant_still_live_for_refresh`` (D-48 —
  a switched-off org/deployment never blocks a refresh); reuse audits ``refresh_reuse``.
* revoke: always 200 (D-20); a refresh token ends the grant (audited once), an access token only
  itself.
"""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from starlette.testclient import TestClient

from app.security.oauth_tokens import digest_token
from tests.unit import _mcp305_harness as h
from tests.unit._oauth307_fakes import FakeRedis

CLAUDE = "https://claude.ai/api/mcp/auth_callback"
VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
RESOURCE = "http://localhost:8000/mcp"


class _Conn:
    def __init__(self, world):
        self.world = world

    def transaction(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _Pool:
    def __init__(self, world):
        self.world = world

    def acquire(self):
        return _Conn(self.world)


class World:
    def __init__(self, monkeypatch, *, redis=None):
        from app.db import api_keys as api_keys_db
        from app.db import oauth as oauth_db
        from app.mcp import oauth_server
        from app.security import api_key_auth

        h.configure(monkeypatch)
        self.redis = redis or FakeRedis()
        self.pool = _Pool(self)
        self.clients: dict[str, dict] = {}
        self.grants: dict[uuid.UUID, dict] = {}
        self.tokens: dict[str, dict] = {}        # digest -> token row (joined to its grant on read)
        self.issued: list[dict] = []
        self.granted: list = []
        self.revoked_grants: list = []
        self.revoked_access: list = []
        self.rotations: list[dict] = []
        self.next_rotation = "rotated"
        self.liveness_calls: list = []
        self.refusal = None
        self.audits: list[tuple] = []

        async def _pool():
            return self.pool

        monkeypatch.setattr(oauth_server, "get_redis", lambda: self.redis)
        monkeypatch.setattr(oauth_server, "get_pg_pool", _pool)

        async def get_client(pool, client_id):
            row = self.clients.get(client_id)
            return dict(row) if row else None

        async def issue_token_pair(conn, *, grant_id, access_hash, refresh_hash, resource, refresh_expires_at):
            self.issued.append(dict(grant_id=grant_id, access_hash=access_hash, refresh_hash=refresh_hash,
                                    resource=resource, refresh_expires_at=refresh_expires_at))
            return uuid.uuid4(), uuid.uuid4()

        async def mark_client_granted(conn, client_row_id):
            self.granted.append(client_row_id)

        async def get_token_by_digest(pool, digest):
            tok = self.tokens.get(digest)
            if tok is None:
                return None
            return {**self.grants[tok["grant_id"]], **tok}

        async def rotate_refresh(pool, *, refresh_hash, new_access_hash, new_refresh_hash, resource, now=None):
            from app.db.oauth import RotationOutcome

            self.rotations.append(dict(refresh_hash=refresh_hash, new_access_hash=new_access_hash,
                                       new_refresh_hash=new_refresh_hash, resource=resource))
            grant_id = self.tokens[refresh_hash]["grant_id"]
            return RotationOutcome(self.next_rotation, grant_id, self.grants[grant_id])

        async def revoke_grant(pool_or_conn, grant_id, *, revoked_by=None):
            already = self.grants[grant_id]["revoked_at"] is not None
            self.grants[grant_id]["revoked_at"] = self.grants[grant_id]["revoked_at"] or datetime.now(timezone.utc)
            self.revoked_grants.append(grant_id)
            return not already

        async def revoke_access_token(pool, token_id):
            self.revoked_access.append(token_id)

        async def get_key_row(pool, *, key_id, org_id):
            row = self.grants.get(uuid.UUID(str(key_id)))
            return dict(row) if row and str(row["org_id"]) == str(org_id) else None

        async def still_live(pool, key_row):
            self.liveness_calls.append(key_row["id"])
            return self.refusal

        async def audit_now(key, action_type, **kw):
            self.audits.append((action_type, kw))

        for mod, name, fn in (
            (oauth_db, "get_client", get_client), (oauth_db, "issue_token_pair", issue_token_pair),
            (oauth_db, "mark_client_granted", mark_client_granted),
            (oauth_db, "get_token_by_digest", get_token_by_digest),
            (oauth_db, "rotate_refresh", rotate_refresh), (oauth_db, "revoke_grant", revoke_grant),
            (oauth_db, "revoke_access_token", revoke_access_token),
            (api_keys_db, "get_key_row", get_key_row),
            (api_key_auth, "grant_still_live_for_refresh", still_live),
            (api_key_auth, "audit_key_call_now", audit_now),
        ):
            monkeypatch.setattr(mod, name, fn)
        self.client = TestClient(h.fresh_app(), base_url=h.BASE)

    # ── seeding ──
    def add_client(self, client_id="dcr-1"):
        row = {"id": uuid.uuid4(), "client_id": client_id, "kind": "dcr", "client_name": "Claude",
               "redirect_uris": [CLAUDE]}
        self.clients[client_id] = row
        return row

    def add_grant(self, client_row) -> dict:
        gid = uuid.uuid4()
        row = {"id": gid, "org_id": uuid.uuid4(), "user_id": uuid.uuid4(), "label": "Claude",
               "kind": "mcp", "revoked_at": None,
               "expires_at": datetime.now(timezone.utc) + timedelta(days=90),
               "oauth_client_id": client_row["id"]}
        self.grants[gid] = row
        return row

    def add_token(self, grant, presented, kind):
        tid = uuid.uuid4()
        self.tokens[digest_token(presented, kind)] = {"token_id": tid, "token_kind": kind,
                                                      "grant_id": grant["id"], "resource": RESOURCE}
        return tid

    async def save_code(self, code, grant, client_row, **over):
        from app.mcp import oauth_store

        record = {"grant_id": str(grant["id"]), "org_id": str(grant["org_id"]),
                  "client_id": client_row["client_id"], "client_row_id": str(client_row["id"]),
                  "redirect_uri": CLAUDE, "code_challenge": CHALLENGE, "resource": RESOURCE, **over}
        await oauth_store.save_code(self.redis, code_digest=oauth_store.digest_code(code), record=record)

    def token(self, **form):
        return self.client.post("/oauth/token", data=form)

    def exchange(self, code, **over):
        form = {"grant_type": "authorization_code", "code": code, "client_id": "dcr-1",
                "redirect_uri": CLAUDE, "code_verifier": VERIFIER, "resource": RESOURCE}
        for k, v in over.items():
            if v is None:
                form.pop(k, None)
            else:
                form[k] = v
        return self.token(**form)

    def revoke(self, **form):
        return self.client.post("/oauth/revoke", data=form)


@pytest.fixture
def w(monkeypatch):
    return World(monkeypatch)


async def _seeded(w, code="the-code"):
    client = w.add_client()
    grant = w.add_grant(client)
    await w.save_code(code, grant, client)
    return client, grant


# ── code exchange ─────────────────────────────────────────────────────────────────────────────


async def test_a_valid_exchange_answers_a_bearer_pair_with_no_store(w):
    client, grant = await _seeded(w)
    started = time.monotonic()
    r = w.exchange("the-code")
    assert time.monotonic() - started < 1.0
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"access_token", "token_type", "expires_in", "refresh_token", "scope"}
    assert body["token_type"] == "Bearer" and body["expires_in"] == 3600 and body["scope"] == "mcp"
    assert body["access_token"].startswith("srl_oat_") and body["refresh_token"].startswith("srl_ort_")
    assert r.headers["cache-control"] == "no-store" and r.headers["pragma"] == "no-cache"
    (issued,) = w.issued
    assert issued["grant_id"] == grant["id"]
    assert issued["access_hash"] == digest_token(body["access_token"], "access")
    assert issued["refresh_hash"] == digest_token(body["refresh_token"], "refresh")
    assert issued["resource"] == RESOURCE
    assert w.granted == [client["id"]]
    assert w.liveness_calls == [grant["id"]]


INVALID_GRANT = {"error": "invalid_grant",
                 "error_description": "The authorization code or refresh token is invalid, expired or "
                                      "was already used."}


@pytest.mark.parametrize("over", [
    {"code_verifier": "x" * 43},
    {"code_verifier": None},
    {"redirect_uri": "https://claude.ai/api/mcp/auth_callback/x"},
    {"redirect_uri": None},
    {"client_id": "dcr-2"},
    {"resource": None},
    {"resource": "https://other.example/mcp"},
    {"code": "never-issued"},
])
async def test_every_binding_mismatch_is_one_identical_invalid_grant(w, over):
    await _seeded(w)
    w.add_client("dcr-2")
    r = w.exchange(over.pop("code", "the-code"), **over)
    assert r.status_code == 400
    assert r.json() == INVALID_GRANT
    assert r.headers["cache-control"] == "no-store"
    assert w.issued == []


async def test_a_different_loopback_port_than_authorize_is_refused(w):
    client = w.add_client()
    grant = w.add_grant(client)
    await w.save_code("lb", grant, client, redirect_uri="http://localhost:54001/callback")
    r = w.exchange("lb", redirect_uri="http://localhost:54002/callback")
    assert r.json() == INVALID_GRANT


async def test_a_replayed_code_is_refused_and_revokes_the_grant(w):
    _, grant = await _seeded(w)
    assert w.exchange("the-code").status_code == 200
    again = w.exchange("the-code")
    assert again.status_code == 400 and again.json() == INVALID_GRANT
    assert w.revoked_grants == [grant["id"]]
    assert len(w.issued) == 1


async def test_a_dead_grant_at_exchange_is_invalid_grant(w):
    from app.security.principal_liveness import Refusal

    await _seeded(w)
    w.refusal = Refusal("not_member")
    r = w.exchange("the-code")
    assert r.json() == INVALID_GRANT
    assert w.issued == []


async def test_an_unknown_client_is_401_invalid_client(w):
    await _seeded(w)
    r = w.exchange("the-code", client_id="nobody")
    assert r.status_code == 401 and r.json()["error"] == "invalid_client"


@pytest.mark.parametrize("form, error", [
    ({"grant_type": "password", "client_id": "dcr-1"}, "unsupported_grant_type"),
    ({"grant_type": "client_credentials"}, "unsupported_grant_type"),
    ({"client_id": "dcr-1"}, "invalid_request"),
    ({"grant_type": "authorization_code", "client_id": "dcr-1"}, "invalid_request"),
])
async def test_grant_type_dispatch(w, form, error):
    w.add_client()
    r = w.token(**form)
    assert r.status_code == 400 and r.json()["error"] == error


async def test_a_json_body_is_invalid_request(w):
    await _seeded(w)
    r = w.client.post("/oauth/token", json={"grant_type": "authorization_code", "code": "the-code"})
    assert r.status_code == 400 and r.json()["error"] == "invalid_request"
    assert w.issued == []


async def test_redis_down_is_503_temporarily_unavailable(monkeypatch):
    w = World(monkeypatch, redis=FakeRedis(broken=True))
    r = w.exchange("the-code")
    assert r.status_code == 503 and r.json()["error"] == "temporarily_unavailable"


async def test_token_over_its_bucket_is_429(w, monkeypatch):
    from app.services import rate_limit

    async def full(redis, *, client, kind):
        assert kind == "oauth_token"
        return 17

    monkeypatch.setattr(rate_limit, "check_oauth_limit", full)
    r = w.exchange("x")
    assert r.status_code == 429 and r.headers["retry-after"] == "17"


# ── refresh ───────────────────────────────────────────────────────────────────────────────────

REFRESH = "srl_ort_" + "R" * 43


def _refresh_world(w):
    client = w.add_client()
    grant = w.add_grant(client)
    w.add_token(grant, REFRESH, "refresh")
    return client, grant


@pytest.mark.parametrize("outcome", ["rotated", "grace_rotated"])
async def test_refresh_rotates(w, outcome):
    _, grant = _refresh_world(w)
    w.next_rotation = outcome
    r = w.token(grant_type="refresh_token", refresh_token=REFRESH, client_id="dcr-1")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["refresh_token"] != REFRESH and body["refresh_token"].startswith("srl_ort_")
    assert r.headers["cache-control"] == "no-store"
    (rot,) = w.rotations
    assert rot["refresh_hash"] == digest_token(REFRESH, "refresh")
    assert rot["new_access_hash"] == digest_token(body["access_token"], "access")
    assert rot["new_refresh_hash"] == digest_token(body["refresh_token"], "refresh")
    assert rot["resource"] is None  # optional on refresh (D-47)
    assert w.liveness_calls == [grant["id"]]
    assert w.audits == []


async def test_refresh_passes_a_resource_through(w):
    _refresh_world(w)
    w.token(grant_type="refresh_token", refresh_token=REFRESH, client_id="dcr-1", resource=RESOURCE)
    assert w.rotations[0]["resource"] == RESOURCE


async def test_reuse_is_invalid_grant_and_audited_once(w):
    _, grant = _refresh_world(w)
    w.next_rotation = "reuse_revoked"
    r = w.token(grant_type="refresh_token", refresh_token=REFRESH, client_id="dcr-1")
    assert r.status_code == 400 and r.json() == INVALID_GRANT
    assert len(w.audits) == 1
    action, kw = w.audits[0]
    assert action == "api_key.refused"
    assert kw["reason"] == "refresh_reuse"
    assert kw["detail"] == {"credential": "oauth"}
    assert REFRESH not in repr(w.audits)


async def test_dead_is_invalid_grant_without_audit(w):
    _refresh_world(w)
    w.next_rotation = "dead"
    r = w.token(grant_type="refresh_token", refresh_token=REFRESH, client_id="dcr-1")
    assert r.json() == INVALID_GRANT and w.audits == []


async def test_wrong_resource_is_invalid_target(w):
    _refresh_world(w)
    w.next_rotation = "wrong_resource"
    r = w.token(grant_type="refresh_token", refresh_token=REFRESH, client_id="dcr-1",
                resource="https://other.example/mcp")
    assert r.status_code == 400 and r.json()["error"] == "invalid_target"


@pytest.mark.parametrize("reason", ["revoked", "expired", "not_member", "banned"])
async def test_a_dead_grant_refuses_before_rotation(w, reason):
    from app.security.principal_liveness import Refusal

    _refresh_world(w)
    w.refusal = Refusal(reason)
    r = w.token(grant_type="refresh_token", refresh_token=REFRESH, client_id="dcr-1")
    assert r.json() == INVALID_GRANT
    assert w.rotations == []


async def test_a_refresh_token_of_another_client_is_invalid_grant(w):
    _refresh_world(w)
    w.add_client("dcr-2")
    r = w.token(grant_type="refresh_token", refresh_token=REFRESH, client_id="dcr-2")
    assert r.json() == INVALID_GRANT and w.rotations == []


async def test_an_access_token_presented_as_refresh_is_invalid_grant(w):
    client = w.add_client()
    grant = w.add_grant(client)
    access = "srl_oat_" + "A" * 43
    w.add_token(grant, access, "access")
    r = w.token(grant_type="refresh_token", refresh_token=access, client_id="dcr-1")
    assert r.json() == INVALID_GRANT and w.rotations == []


# ── revoke ────────────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("token", ["srl_ort_" + "Z" * 43, "garbage", "", "srl_oat_" + "Z" * 43])
async def test_revoke_always_answers_200(w, token):
    w.add_client()
    r = w.revoke(token=token, client_id="dcr-1")
    assert r.status_code == 200
    assert w.revoked_grants == [] and w.revoked_access == [] and w.audits == []


async def test_revoking_a_refresh_token_ends_the_grant_audited_once(w):
    _, grant = _refresh_world(w)
    assert w.revoke(token=REFRESH, client_id="dcr-1", token_type_hint="refresh_token").status_code == 200
    assert w.revoke(token=REFRESH, client_id="dcr-1").status_code == 200
    assert w.revoked_grants == [grant["id"], grant["id"]]
    assert len(w.audits) == 1
    action, kw = w.audits[0]
    assert action == "api_key.revoke"
    assert kw["detail"]["credential"] == "oauth"
    assert kw["detail"]["client_name"] == "Claude"
    assert kw["detail"]["redirect_host"] == "claude.ai"


async def test_revoking_an_access_token_kills_only_itself(w):
    client = w.add_client()
    grant = w.add_grant(client)
    access = "srl_oat_" + "A" * 43
    tid = w.add_token(grant, access, "access")
    assert w.revoke(token=access, client_id="dcr-1").status_code == 200
    assert w.revoked_access == [tid] and w.revoked_grants == [] and w.audits == []


async def test_another_clients_token_is_200_and_untouched(w):
    _refresh_world(w)
    w.add_client("dcr-2")
    assert w.revoke(token=REFRESH, client_id="dcr-2").status_code == 200
    assert w.revoked_grants == []


async def test_revoke_with_redis_down_is_503(monkeypatch):
    w = World(monkeypatch, redis=FakeRedis(broken=True))
    assert w.revoke(token=REFRESH, client_id="dcr-1").status_code == 503


# ── the source rules ──────────────────────────────────────────────────────────────────────────


def test_the_server_asks_liveness_only_through_the_d48_helper():
    import inspect

    from app.mcp import oauth_server

    src = inspect.getsource(oauth_server)
    assert "principal_still_allowed" not in src
    assert src.count("grant_still_live_for_refresh(") >= 2
    assert "mcp_off" in src  # the D-48 comment: a switch-off never blocks a refresh
