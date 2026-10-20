"""Phase 294-03 (DEC-03, D-13 / D-15 / D-16, T-294-13..20) — GET / POST /citation-checks.

The router is mounted on a FRESH ``FastAPI()`` with dependency overrides. ⛔ It never enters
``app.main.app``'s lifespan (no ``with TestClient(main.app)``): SEED-363 measured that the real
lifespan runs the boot resume sweep against the shared local DB.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import citation_checks as route
from app.models.citation_check import CitationCheckResult
from app.services.rerank_engines import jev
from tests.unit.decision_engine_fakes import PLANTED_KEYS, Recorder, install, user_settings

MSG_ID = "11111111-1111-4111-8111-111111111111"
OTHER_ID = "55555555-5555-4555-8555-555555555555"
THREAD_ID = "22222222-2222-4222-8222-222222222222"
USER_ID = "33333333-3333-4333-8333-333333333333"
ORG_ID = "44444444-4444-4444-8444-444444444444"

CONTENT = "Revenue rose to five million dollars in 2024 [1]. Costs fell by twelve percent over the year [2]."


def _message(**kw) -> dict:
    row = {
        "id": MSG_ID, "thread_id": THREAD_ID, "user_id": USER_ID, "org_id": ORG_ID,
        "role": "assistant", "content": CONTENT,
        "source_refs": [
            {"document_id": "d1", "filename": "a.pdf", "chunk_index": 0, "passage": "Revenue was $5M in 2024."},
            {"document_id": "d2", "filename": "b.pdf", "chunk_index": 1, "passage": "Costs rose 12%."},
        ],
    }
    row.update(kw)
    return row


def _stored(verdict="supported") -> dict:
    return {
        "version": 1, "engine": "jev", "model": "typesafe/jev-1.14", "checked_at": "2026-10-20T00:00:00Z",
        "claims": [{"ordinal": 0, "n": 1, "sentence": "s", "verdict": verdict, "confidence": 0.7}],
        "counts": {"supported": int(verdict == "supported"), "partly_supported": 0, "not_supported": 0,
                   "contradicted": int(verdict == "contradicted"), "couldnt_check": 0},
        "usage": {"input_tokens": 1, "cost_usd": None},
    }


# ── fakes ──────────────────────────────────────────────────────────────────────────────────────


class _Resp:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, db, table):
        self.db, self.table, self.filters, self.single = db, table, [], False

    def select(self, *_a, **_kw):
        return self

    def eq(self, col, val):
        self.filters.append((col, val))
        return self

    def in_(self, col, vals):
        self.filters.append((col, list(vals)))
        return self

    def maybe_single(self):
        self.single = True
        return self

    def execute(self):
        self.db.executed.append((self.table, list(self.filters)))
        if self.table == "messages":
            msg_id = dict(self.filters).get("id")
            row = self.db.messages.get(msg_id)
            return None if row is None else _Resp(row)     # postgrest maybe_single: None on 0 rows
        ids = dict(self.filters).get("message_id", [])
        return _Resp([r for r in self.db.checks if r["message_id"] in ids])


class _UserDb:
    """What the user-JWT client can see (RLS already applied)."""

    def __init__(self, messages=None, checks=None):
        self.messages = messages or {}
        self.checks = checks or []
        self.executed = []

    def table(self, name):
        return _Query(self, name)


class _Pool:
    def __init__(self):
        self.store: dict[str, dict] = {}
        self.calls = []

    async def fetchrow(self, sql, *args):
        self.calls.append(args)
        row = {"message_id": args[0], "thread_id": args[1], "user_id": args[2], "org_id": args[3],
               "engine": args[4], "model": args[5], "result": args[6], "input_tokens": args[7], "cost_usd": args[8]}
        self.store[str(args[0])] = row
        return row


class _Redis:
    def __init__(self):
        self.kv: dict[str, str] = {}

    async def set(self, key, value, nx=False, ex=None):
        if nx and key in self.kv:
            return None
        self.kv[key] = value
        return True

    async def eval(self, _script, _n, key, value):
        if self.kv.get(key) == value:
            del self.kv[key]
            return 1
        return 0


@pytest.fixture
def env(monkeypatch):
    db = _UserDb(messages={MSG_ID: _message()})
    pool, redis = _Pool(), _Redis()
    state = SimpleNamespace(db=db, pool=pool, redis=redis,
                            settings=user_settings(rerank_provider="jev", rerank_model=""))

    async def _settings():
        return state.settings

    monkeypatch.setattr(route, "load_app_settings_async", _settings)
    app = FastAPI()
    app.include_router(route.router)
    app.dependency_overrides[deps.get_current_user] = lambda: {"id": USER_ID, "email": "u@example.com"}
    app.dependency_overrides[deps.get_user_supabase_client] = lambda: state.db
    app.dependency_overrides[deps.get_redis] = lambda: state.redis

    async def _pool():
        return state.pool

    app.dependency_overrides[deps.get_pg_pool] = _pool
    state.client = TestClient(app)
    state.app = app
    return state


def _engine_ok(monkeypatch, verdict="contradicted"):
    rec = Recorder()

    def handle(request):
        body = rec.enter(request)
        try:
            return httpx.Response(200, json={
                "answers": {n: {"type": "choice", "choice": verdict, "confidence": 0.83} for n in body["questions"]},
                "usage": {"input_tokens": 50, "output_tokens": 0, "cost": 0.0000021},
            })
        finally:
            rec.leave()

    install(monkeypatch, jev, handle)
    return rec


def _no_secrets(text: str):
    for key in PLANTED_KEYS:
        assert key not in text
    assert "base_url" not in text and ".example/api" not in text and "openrouter.ai" not in text


# ── auth ───────────────────────────────────────────────────────────────────────────────────────


def test_unauthenticated_is_refused(env):
    env.app.dependency_overrides.pop(deps.get_current_user)
    env.app.dependency_overrides.pop(deps.get_user_supabase_client)

    def _bad_auth(_token):
        raise ValueError("bad jwt")

    env.app.dependency_overrides[deps.get_supabase] = lambda: SimpleNamespace(auth=SimpleNamespace(get_user=_bad_auth))
    r = env.client.get("/citation-checks", params={"message_ids": MSG_ID},
                       headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401
    p = env.client.post(f"/citation-checks/{MSG_ID}", headers={"Authorization": "Bearer not-a-real-token"})
    assert p.status_code == 401
    # No header at all: FastAPI 0.115's HTTPBearer answers 403 "Not authenticated" before the dependency runs.
    assert env.client.get("/citation-checks", params={"message_ids": MSG_ID}).status_code in (401, 403)


# ── GET ────────────────────────────────────────────────────────────────────────────────────────


def test_get_more_than_100_ids_is_422(env):
    ids = ",".join(f"00000000-0000-4000-8000-{i:012d}" for i in range(101))
    assert env.client.get("/citation-checks", params={"message_ids": ids}).status_code == 422


def test_get_a_malformed_id_is_422(env):
    assert env.client.get("/citation-checks", params={"message_ids": "not-a-uuid"}).status_code == 422


def test_get_returns_availability_and_only_rls_visible_rows(env):
    env.db.checks = [{"message_id": MSG_ID, "result": _stored()}]
    r = env.client.get("/citation-checks", params={"message_ids": f"{MSG_ID},{OTHER_ID}"})
    assert r.status_code == 200
    body = r.json()
    assert body["availability"] == {"available": True, "engine": "jev", "reason": None}
    assert set(body["checks"]) == {MSG_ID}
    CitationCheckResult.model_validate(body["checks"][MSG_ID])
    assert env.db.executed[-1] == ("message_citation_checks", [("message_id", [MSG_ID, OTHER_ID])])
    _no_secrets(r.text)


@pytest.mark.parametrize("settings_kw,expected", [
    ({"rerank_enabled": False}, {"available": False, "engine": None, "reason": "off"}),
    ({"rerank_provider": "cohere"}, {"available": False, "engine": None, "reason": "engine_reorders_only"}),
    ({"rerank_provider": "local"}, {"available": False, "engine": None, "reason": "engine_reorders_only"}),
    ({"rerank_provider": "openai_decisions", "providers": []},
     {"available": False, "engine": "openai_decisions", "reason": "key_missing"}),
])
def test_get_availability_reasons(env, settings_kw, expected):
    env.settings = user_settings(**{"rerank_provider": "jev", **settings_kw})
    r = env.client.get("/citation-checks", params={"message_ids": MSG_ID})
    assert r.status_code == 200
    assert r.json()["availability"] == expected


def test_get_omits_an_invalid_stored_row(env):
    env.db.checks = [{"message_id": MSG_ID, "result": {"version": 1, "bogus": True}}]
    r = env.client.get("/citation-checks", params={"message_ids": MSG_ID})
    assert r.status_code == 200 and r.json()["checks"] == {}


# ── POST ───────────────────────────────────────────────────────────────────────────────────────


def test_post_not_found_and_not_yours_share_one_404(env):
    missing = env.client.post(f"/citation-checks/{OTHER_ID}")        # RLS hides it == not found
    malformed = env.client.post("/citation-checks/not-a-uuid")
    assert missing.status_code == 404 and malformed.status_code == 404
    assert missing.json() == malformed.json() == {"detail": "Message not found"}


def test_post_reads_the_message_through_the_user_client(env, monkeypatch):
    _engine_ok(monkeypatch)
    env.client.post(f"/citation-checks/{MSG_ID}")
    assert ("messages", [("id", MSG_ID)]) in env.db.executed


def test_post_a_user_message_is_422(env):
    env.db.messages[MSG_ID] = _message(role="user")
    assert env.client.post(f"/citation-checks/{MSG_ID}").status_code == 422


@pytest.mark.parametrize("refs", [None, [], [{"document_id": "d1", "passage": None}, {"document_id": "d2", "passage": ""}]])
def test_post_without_citation_passages_is_422(env, refs):
    env.db.messages[MSG_ID] = _message(source_refs=refs)
    assert env.client.post(f"/citation-checks/{MSG_ID}").status_code == 422


def test_post_while_a_check_is_in_flight_is_409(env, monkeypatch):
    _engine_ok(monkeypatch)
    env.redis.kv[f"citation_check:{MSG_ID}"] = "someone-else"
    r = env.client.post(f"/citation-checks/{MSG_ID}")
    assert r.status_code == 409
    assert r.json()["detail"] == {"reason": "in_flight"}
    assert env.redis.kv[f"citation_check:{MSG_ID}"] == "someone-else"   # never evicts another holder
    assert env.pool.store == {}


@pytest.mark.parametrize("settings_kw,reason", [
    ({"rerank_enabled": False}, "off"),
    ({"rerank_provider": "cohere"}, "engine_reorders_only"),
    ({"providers": []}, "key_missing"),
])
def test_post_engine_unavailable_is_409_with_the_reason(env, settings_kw, reason):
    env.settings = user_settings(**{"rerank_provider": "jev", **settings_kw})
    r = env.client.post(f"/citation-checks/{MSG_ID}")
    assert r.status_code == 409
    assert r.json()["detail"] == {"reason": reason}
    assert env.pool.store == {}
    assert env.redis.kv == {}


def test_post_success_stores_returns_and_releases(env, monkeypatch):
    rec = _engine_ok(monkeypatch, "contradicted")
    r = env.client.post(f"/citation-checks/{MSG_ID}")
    assert r.status_code == 200, r.text
    result = CitationCheckResult.model_validate(r.json())
    assert [c.verdict for c in result.claims] == ["contradicted", "contradicted"]
    assert result.claims[0].confidence == 0.83
    assert len(rec.bodies) == 2
    assert env.redis.kv == {}
    stored = env.pool.store[MSG_ID]
    assert [str(stored[k]) for k in ("message_id", "thread_id", "user_id", "org_id")] == [MSG_ID, THREAD_ID, USER_ID, ORG_ID]
    _no_secrets(r.text)


def test_ids_are_bound_from_the_message_row_never_the_request(env, monkeypatch):
    _engine_ok(monkeypatch)
    env.db.messages[MSG_ID] = _message(user_id="66666666-6666-4666-8666-666666666666",
                                       thread_id="77777777-7777-4777-8777-777777777777")
    r = env.client.post(f"/citation-checks/{MSG_ID}?user_id={USER_ID}&thread_id={THREAD_ID}",
                        json={"user_id": USER_ID, "org_id": "x", "content": "forged claim [1]"})
    assert r.status_code == 200
    stored = env.pool.store[MSG_ID]
    assert str(stored["user_id"]) == "66666666-6666-4666-8666-666666666666"
    assert str(stored["thread_id"]) == "77777777-7777-4777-8777-777777777777"
    assert "forged" not in json.dumps(r.json())


def test_a_second_post_replaces_the_stored_row(env, monkeypatch):
    _engine_ok(monkeypatch, "supported")
    first = env.client.post(f"/citation-checks/{MSG_ID}").json()
    _engine_ok(monkeypatch, "not_supported")
    second = env.client.post(f"/citation-checks/{MSG_ID}").json()
    assert first["counts"]["supported"] == 2 and second["counts"]["not_supported"] == 2
    assert len(env.pool.store) == 1
    assert env.pool.store[MSG_ID]["result"]["counts"]["not_supported"] == 2


def test_the_in_flight_key_is_released_on_error(env, monkeypatch):
    def boom(_row, _settings):
        raise RuntimeError("engine exploded sk-or-PLANTED-294")

    monkeypatch.setattr(route, "run_citation_check", boom)
    client = TestClient(env.app, raise_server_exceptions=False)
    r = client.post(f"/citation-checks/{MSG_ID}")
    assert r.status_code == 500
    assert env.redis.kv == {}
    _no_secrets(r.text)


def test_the_route_is_not_a_tool_and_has_two_operations():
    paths = sorted((r.path, sorted(r.methods)) for r in route.router.routes)
    assert paths == [("/citation-checks", ["GET"]), ("/citation-checks/{message_id}", ["POST"])]
