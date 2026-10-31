"""Phase 305-01 (D-07..D-11 / D-46 / D-50 / D-54; T-305-01/-02/-03/-07/-13/-15) — the key edge.

Every credential failure is ONE response: the same status, body bytes AND headers
(``WWW-Authenticate: Bearer``), so a caller cannot tell "no such key" from "revoked" from "an app
session JWT" (T-305-03). Only the two switched-off reasons are told apart, as a 403 with their
sentence (D-08). The edge never writes an audit row itself: the core throttles refusal rows (CR-02).

The org comes only from the resolved key (D-10): an ``X-Org-Id`` header changes nothing. The key is
read from the ``Authorization`` header only (D-11): a key in the query string is the one 401.

The per-address limit (D-54) is its own bucket (``mcp_ip``), runs BEFORE the key is read, and fails
closed: over the limit is 429 + Retry-After, Redis down is 503 — and the resolver is never called.

The JWT and malformed-key arms use the REAL resolver with a pool that fails on any use, proving
those strings are refused before any read (``digest_key`` -> None).
"""
from __future__ import annotations

import pytest
from starlette.testclient import TestClient

from app.security.mcp_principal import resolve_mcp_principal as REAL_RESOLVER
from tests.unit import _mcp305_harness as h

JWT = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJzdWIiOiIzMzMzIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ."
    "c2lnbmF0dXJlLXNpZ25hdHVyZS1zaWduYXR1cmU"
)


class _PoolThatMustNotBeUsed:
    def __getattr__(self, name):
        raise AssertionError(f"the pool was used ({name}) for a string that is not a key")


def _audit_spy(monkeypatch) -> list:
    from app.security import api_key_auth
    from app.services import audit_service

    writes: list = []

    async def _spy(*a, **k):
        writes.append((a, k))

    import app.mcp.audit as mcp_audit

    monkeypatch.setattr(api_key_auth, "audit_key_call_now", _spy)
    monkeypatch.setattr(audit_service, "write_audit_entry", _spy)
    monkeypatch.setattr(mcp_audit, "insert_audit_row", _spy)  # BUG-261031-04: dispatch's writer
    return writes


def _org_echo(monkeypatch):
    import app.mcp.tools as tools

    async def echo(principal, args):
        return h.text_result(principal.org_id)

    monkeypatch.setitem(tools.REGISTERED, "t_org", h.make_spec("t_org", echo))


def _post_init(c, *, auth: str | None, path: str = "/mcp", extra: dict | None = None):
    hdrs = {"accept": "application/json, text/event-stream", "content-type": "application/json"}
    if auth is not None:
        hdrs["authorization"] = auth
    if extra:
        hdrs.update(extra)
    return c.post(path, headers=hdrs, json=h.initialize_body())


def _fingerprint(r):
    return r.status_code, r.content, sorted(r.headers.raw)


def _refused_with(reason: str):
    from app.security.api_key_auth import KeyRefused

    return h.Recorder(exc=KeyRefused(reason))


@pytest.fixture
def setup(monkeypatch):
    h.configure(monkeypatch)
    writes = _audit_spy(monkeypatch)
    return writes


def _response_for(monkeypatch, auth, resolver=None, *, real=False):
    import app.mcp.edge as edge

    h.stub_edge(monkeypatch, REAL_RESOLVER if real else resolver)
    if real:
        async def _bad_pool():
            return _PoolThatMustNotBeUsed()

        monkeypatch.setattr(edge, "get_pg_pool", _bad_pool)
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        return _post_init(c, auth=auth)


CASES = [
    ("no header", None, None, False),
    ("basic scheme", "Basic dXNlcjpwYXNz", None, False),
    ("empty bearer", "Bearer ", None, False),
    ("bearer only", "Bearer", None, False),
    ("app session jwt", f"Bearer {JWT}", None, True),
    ("malformed mcp key", "Bearer srl_mcp_not!a!key", None, True),
    ("workflow-shaped key", "Bearer srl_live_" + "B" * 43, None, True),
    ("unknown", f"Bearer {h.KEY}", "unknown", False),
    ("revoked", f"Bearer {h.KEY}", "revoked", False),
    ("expired", f"Bearer {h.KEY}", "expired", False),
    ("not_member", f"Bearer {h.KEY}", "not_member", False),
    ("banned", f"Bearer {h.KEY}", "banned", False),
    ("wrong_kind", f"Bearer {h.KEY}", "wrong_kind", False),
]


def test_every_credential_failure_is_one_identical_401(monkeypatch, setup):
    prints = {}
    for label, auth, reason, real in CASES:
        resolver = _refused_with(reason) if reason else None
        prints[label] = _fingerprint(_response_for(monkeypatch, auth, resolver, real=real))
    first = prints["no header"]
    assert first[0] == 401
    assert (b"www-authenticate", b"Bearer") in [(k.lower(), v) for k, v in first[2]]
    for label, fp in prints.items():
        assert fp == first, f"{label!r} differs from the one 401: {fp!r} vs {first!r}"
    assert setup == [], "the edge (or a stubbed path) wrote an audit row"


def test_the_one_401_body_is_built_once():
    import app.mcp.edge as edge

    assert isinstance(edge._INVALID_BODY, bytes)
    assert b"invalid_token" in edge._INVALID_BODY


@pytest.mark.parametrize("reason", ["mcp_off_org", "mcp_off_deployment"])
def test_switched_off_is_a_403_with_its_sentence(monkeypatch, setup, reason):
    from app.security.api_key_auth import KeyRefused

    sentence = f"MCP access is switched off ({reason})."
    r = _response_for(monkeypatch, f"Bearer {h.KEY}", h.Recorder(exc=KeyRefused(reason, sentence)))
    assert r.status_code == 403
    assert r.json() == {"error": "mcp_off", "error_description": sentence}
    assert setup == []


def test_a_key_in_the_query_string_is_ignored(monkeypatch, setup):
    resolver = h.stub_edge(monkeypatch)
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        r = _post_init(c, auth=None, path=f"/mcp?key={h.KEY}")
        baseline = _post_init(c, auth=None)
    assert resolver.calls == []
    assert _fingerprint(r) == _fingerprint(baseline)


def test_x_org_id_never_changes_the_acting_org(monkeypatch, setup):
    _org_echo(monkeypatch)
    h.stub_edge(monkeypatch)
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        r = h.call(c, "t_org", extra_headers={"X-Org-Id": "99999999-9999-4999-8999-999999999999"})
    assert r.json()["result"]["content"][0]["text"] == h.KEY_ORG


def test_over_the_ip_limit_is_429_before_the_key_is_read(monkeypatch, setup):
    from app.services import rate_limit

    resolver = h.stub_edge(monkeypatch)

    async def _over(redis, *, client):
        return 17

    monkeypatch.setattr(rate_limit, "check_ip_limit", _over)
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        r = _post_init(c, auth=f"Bearer {h.KEY}")
    assert r.status_code == 429
    assert r.headers["retry-after"] == "17"
    assert r.json()["error"] == "rate_limited"
    assert resolver.calls == []


def test_limiter_down_is_503_before_the_key_is_read(monkeypatch, setup):
    from app.services import rate_limit

    resolver = h.stub_edge(monkeypatch)

    async def _down(redis, *, client):
        raise rate_limit.LimiterUnavailable()

    monkeypatch.setattr(rate_limit, "check_ip_limit", _down)
    with TestClient(h.fresh_app(), base_url=h.BASE) as c:
        r = _post_init(c, auth=f"Bearer {h.KEY}")
    assert r.status_code == 503
    assert r.json() == {"error": "unavailable", "error_description": rate_limit.UNAVAILABLE_DETAIL}
    assert resolver.calls == []


async def test_check_ip_limit_uses_its_own_bucket_and_fails_closed():
    from app.services import rate_limit

    seen: list[str] = []

    class _Pipe:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def incr(self, bucket):
            seen.append(bucket)

        def expire(self, bucket, ttl):
            pass

        async def execute(self):
            return [1, True]

    class _Redis:
        def pipeline(self, transaction=True):
            return _Pipe()

    assert await rate_limit.check_ip_limit(_Redis(), client="10.0.0.1") is None
    assert seen and seen[0].startswith("apikey:rl:mcp_ip:10.0.0.1:")

    class _Broken:
        def pipeline(self, transaction=True):
            raise ConnectionError("redis down")

    with pytest.raises(rate_limit.LimiterUnavailable):
        await rate_limit.check_ip_limit(_Broken(), client="10.0.0.1")
