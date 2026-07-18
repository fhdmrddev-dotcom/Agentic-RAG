"""Phase 147 Plan 02 Task 2 (ADMIN-02) — cross-user active-runs list + D-07 record endpoint.

Proves:
  - ``GET /admin/runs`` derives honest kind badges per D-Q1 Option A (no migration):
    a run WITH a ``runs`` row is chat / workflow (thread has an active workflow run) /
    eval (``eval_runs.id`` == run_id); a run with NO ``runs`` row is a tuner job;
  - ``killable`` is true ONLY for chat + workflow (D-01) — eval + tuner are false;
  - a tuner run_id absent from ``runs`` renders generically and never raises;
  - each row carries a server-derived ``not_responding`` boolean computed by REUSING
    the reconciler's stream-age oracle (a stalled stream → true, a fresh stream →
    false, tuner/eval → false; RESEARCH Open Q3);
  - ``GET /admin/runs`` is floor-EXEMPT (D-07): ZERO ``operator_audit_log`` rows on a poll;
  - a non-operator gets a byte-identical 404 (inherited router gate);
  - ``POST /admin/control-plane/record`` maps a server-owned event enum to a hardcoded
    (label, action): visit → "Opened the Control Plane"/"control_plane.visit";
    refresh → "Viewed system health"/"health.view"; an unknown event → 422 (Pydantic).

Boundary mocking (Pitfall 6): the operator branch is driven via the asyncpg pool mock
(``set_fetchrow_result`` for the gate) with ``set_fetch_results`` queuing the endpoint's
enrichment SELECTs; Redis (``zrange`` + the oracle's ``xinfo_stream``/``time``) is a
purpose-built fake patched onto ``app.api.admin.get_redis``.
"""
from datetime import datetime, timedelta, timezone

from redis.exceptions import ResponseError

# valid UUIDs so the ::uuid[] enrichment casts never choke in production
CHAT_ID = "11111111-1111-1111-1111-111111111111"
WF_ID = "22222222-2222-2222-2222-222222222222"
EVAL_ID = "33333333-3333-3333-3333-333333333333"
TUNER_ID = "44444444-4444-4444-4444-444444444444"
THREAD_CHAT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
THREAD_WF = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
THREAD_EVAL = "cccccccc-cccc-cccc-cccc-cccccccccccc"
USER1 = "dddddddd-dddd-dddd-dddd-dddddddddddd"
USER2 = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
USER3 = "ffffffff-ffff-ffff-ffff-ffffffffffff"


class _FakeRedis:
    """zrange(runs:active) + the reconciler oracle's xinfo_stream/time surface.

    ``active`` is the WITHSCORES sorted-set payload; ``stream_ages`` maps run_id →
    seconds-since-last-write (or "missing" to raise the no-such-key ResponseError).
    """

    def __init__(self, active, stream_ages=None):
        self._active = list(active)
        self._stream_ages = stream_ages or {}

    async def zrange(self, key, start, end, withscores=False):
        assert key == "runs:active"
        return list(self._active)

    async def xinfo_stream(self, key):
        rid = key.split("run:", 1)[1]
        spec = self._stream_ages.get(rid)
        if spec is None or spec == "missing":
            raise ResponseError("no such key")
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        last_ms = now_ms - int(spec) * 1000
        return {"last-generated-id": f"{last_ms}-0"}

    async def time(self):
        now = datetime.now(timezone.utc).timestamp()
        return (int(now), int((now % 1) * 1_000_000))


def _past():
    """A started_at safely PAST the 60s start-grace so the oracle judges the stream."""
    return datetime.now(timezone.utc) - timedelta(hours=1)


def _op(mock_asyncpg_pool, monkeypatch):
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})  # operator present


# ── GET /admin/runs — kind derivation + killable ──────────────────────────────

def test_mixed_active_set_kind_badges_and_killable(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    _op(mock_asyncpg_pool, monkeypatch)
    fake = _FakeRedis(
        active=[(CHAT_ID, 100.0), (WF_ID, 101.0), (EVAL_ID, 102.0), (TUNER_ID, 103.0)],
        stream_ages={CHAT_ID: 1, WF_ID: 1},  # fresh streams → not_responding false
    )
    monkeypatch.setattr("app.api.admin.get_redis", lambda: fake)

    runs_rows = [
        {"run_id": CHAT_ID, "thread_id": THREAD_CHAT, "user_id": USER1,
         "model": "gpt-5", "provider": "openai", "status": "streaming", "started_at": _past()},
        {"run_id": WF_ID, "thread_id": THREAD_WF, "user_id": USER2,
         "model": "claude", "provider": "anthropic", "status": "streaming", "started_at": _past()},
        {"run_id": EVAL_ID, "thread_id": THREAD_EVAL, "user_id": USER3,
         "model": "gemini", "provider": "google", "status": "streaming", "started_at": _past()},
    ]
    eval_rows = [{"id": EVAL_ID}]
    wf_rows = [{"id": THREAD_WF}]  # the workflow thread has an active_workflow_run_id
    user_rows = [{"id": USER1, "email": "a@x.co"}, {"id": USER2, "email": "b@x.co"},
                 {"id": USER3, "email": "c@x.co"}]
    mock_asyncpg_pool.set_fetch_results([runs_rows, eval_rows, wf_rows, user_rows])

    res = client.get("/admin/runs", headers=auth_headers)
    assert res.status_code == 200
    by_id = {r["run_id"]: r for r in res.json()["runs"]}

    assert by_id[CHAT_ID]["kind"] == "chat" and by_id[CHAT_ID]["killable"] is True
    assert by_id[WF_ID]["kind"] == "workflow" and by_id[WF_ID]["killable"] is True
    assert by_id[EVAL_ID]["kind"] == "eval" and by_id[EVAL_ID]["killable"] is False
    assert by_id[TUNER_ID]["kind"] == "tuner" and by_id[TUNER_ID]["killable"] is False

    # metadata enrichment (never thread content — linkage rule #11)
    assert by_id[CHAT_ID]["user_email"] == "a@x.co"
    assert by_id[CHAT_ID]["model"] == "gpt-5"
    assert by_id[CHAT_ID]["started_at"] == 100.0
    # fresh streams → not_responding false
    assert by_id[CHAT_ID]["not_responding"] is False
    assert by_id[WF_ID]["not_responding"] is False


def test_tuner_absent_from_runs_renders_generically_without_raising(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    _op(mock_asyncpg_pool, monkeypatch)
    fake = _FakeRedis(active=[(TUNER_ID, 200.0)])
    monkeypatch.setattr("app.api.admin.get_redis", lambda: fake)
    mock_asyncpg_pool.set_fetch_result([])  # no runs row for the tuner id

    res = client.get("/admin/runs", headers=auth_headers)
    assert res.status_code == 200
    runs = res.json()["runs"]
    assert len(runs) == 1
    row = runs[0]
    assert row["run_id"] == TUNER_ID
    assert row["kind"] == "tuner"
    assert row["killable"] is False
    assert row["user_id"] is None
    assert row["model"] is None
    assert row["not_responding"] is False


def test_empty_active_set_returns_empty_list(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    _op(mock_asyncpg_pool, monkeypatch)
    monkeypatch.setattr("app.api.admin.get_redis", lambda: _FakeRedis(active=[]))
    res = client.get("/admin/runs", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == {"runs": []}


# ── not_responding derivation (stream-age oracle reuse) ───────────────────────

def test_not_responding_derivation(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    _op(mock_asyncpg_pool, monkeypatch)
    STALLED = CHAT_ID
    FRESH = WF_ID
    fake = _FakeRedis(
        active=[(STALLED, 100.0), (FRESH, 101.0), (TUNER_ID, 102.0)],
        stream_ages={STALLED: 3000, FRESH: 1},  # 3000s > 2400s stale threshold; 1s fresh
    )
    monkeypatch.setattr("app.api.admin.get_redis", lambda: fake)

    runs_rows = [
        {"run_id": STALLED, "thread_id": THREAD_CHAT, "user_id": USER1,
         "model": "gpt-5", "provider": "openai", "status": "streaming", "started_at": _past()},
        {"run_id": FRESH, "thread_id": THREAD_EVAL, "user_id": USER2,
         "model": "claude", "provider": "anthropic", "status": "streaming", "started_at": _past()},
    ]
    # no evals, no workflow threads → both are chat kind; emails optional
    mock_asyncpg_pool.set_fetch_results([runs_rows, [], [], []])

    res = client.get("/admin/runs", headers=auth_headers)
    assert res.status_code == 200
    by_id = {r["run_id"]: r for r in res.json()["runs"]}
    assert by_id[STALLED]["not_responding"] is True, "a stalled stream must be not_responding"
    assert by_id[FRESH]["not_responding"] is False, "a fresh stream must NOT be not_responding"
    assert by_id[TUNER_ID]["not_responding"] is False, "a tuner row is never not_responding"


# ── floor-exempt + gate ───────────────────────────────────────────────────────

def test_runs_is_floor_exempt(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    _op(mock_asyncpg_pool, monkeypatch)
    monkeypatch.setattr("app.api.admin.get_redis", lambda: _FakeRedis(active=[]))
    res = client.get("/admin/runs", headers=auth_headers)
    assert res.status_code == 200
    op_inserts = [
        c for c in mock_builder.insert.call_args_list
        if c.args and isinstance(c.args[0], dict) and "action" in c.args[0] and "label" in c.args[0]
    ]
    assert len(op_inserts) == 0, "floor-exempt: /admin/runs must not write an operator_audit_log row"


def test_runs_404_for_non_operator(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)  # no operator row → gate 404
    res = client.get("/admin/runs", headers=auth_headers)
    assert res.status_code == 404
    assert res.json() == {"detail": "Not Found"}


# ── POST /admin/control-plane/record — server-owned event → (label, action) ───

def test_record_visit_maps_to_control_plane_visit(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    _op(mock_asyncpg_pool, monkeypatch)
    res = client.post("/admin/control-plane/record", json={"event": "visit"}, headers=auth_headers)
    assert res.status_code == 204
    op_inserts = [
        c for c in mock_builder.insert.call_args_list
        if c.args and isinstance(c.args[0], dict) and "action" in c.args[0] and "label" in c.args[0]
    ]
    assert len(op_inserts) == 1
    row = op_inserts[0].args[0]
    assert row["action"] == "control_plane.visit"
    assert row["label"] == "Opened the Control Plane"
    assert row["is_write"] is False  # a read receipt, not a mutation


def test_record_refresh_maps_to_health_view(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    _op(mock_asyncpg_pool, monkeypatch)
    res = client.post("/admin/control-plane/record", json={"event": "refresh"}, headers=auth_headers)
    assert res.status_code == 204
    op_inserts = [
        c for c in mock_builder.insert.call_args_list
        if c.args and isinstance(c.args[0], dict) and "action" in c.args[0] and "label" in c.args[0]
    ]
    assert len(op_inserts) == 1
    row = op_inserts[0].args[0]
    assert row["action"] == "health.view"
    assert row["label"] == "Viewed system health"


def test_record_unknown_event_422(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    _op(mock_asyncpg_pool, monkeypatch)
    res = client.post("/admin/control-plane/record", json={"event": "bogus"}, headers=auth_headers)
    assert res.status_code == 422
