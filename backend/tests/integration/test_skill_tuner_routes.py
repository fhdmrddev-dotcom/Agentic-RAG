"""Phase 123 Plan 04 (TRIG-01) — Skill Trigger Tuner route integration tests.

Proves the four load-bearing behaviors of the owner-scoped tuner router
(``backend/app/api/skill_tuner.py``):

  1. POST /skills/{id}/tuner/runs as the OWNER returns a run id IMMEDIATELY (non-blocking,
     D-06) and ZADDs the Phase-061+ run-buffer (``runs:active`` + the per-skill sorted set).
  2. POST/GET a tuner run for a skill owned by ANOTHER user (and not global) returns 404 —
     the load-bearing cross-user leak-safety assertion (V4 / T-123-04-01). 404 not 403 so
     existence is never leaked.
  3. GET results returns per-provider cells carrying BOTH fires AND no_false sub-scores once
     the (mocked) background run completes (042-A — the false-fire rail is never hidden).
  4. The background job is BOUNDED — given a target list LARGER than the cap, only the capped
     number of providers is scored (no unbounded fan-out — T-123-04-02 / DoS guard).

No live LLM call: the Plan-03 ``skill_tuner_service`` candidate/classify functions are mocked,
so the test runs without the gateway / any provider. Redis is a small in-memory fake.
"""
import asyncio
import json
from datetime import datetime
from uuid import uuid4
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport

from app.api import skill_tuner
from app.dependencies import get_current_user, get_redis, get_supabase
from app.main import app
from app.services.skill_tuner_service import MAX_SEEDED_SHOULD_NOT, TriggerDecision
from tests.integration._run_helpers import _build_mock_supabase, _make_result, _make_table_builder

OWNER = {"id": "00000000-0000-0000-0000-000000000001", "email": "owner@example.com"}
OTHER_USER = {"id": "00000000-0000-0000-0000-000000000099", "email": "other@example.com"}
SKILL_ID = str(uuid4())


# ── A tiny in-memory async fake Redis (no fakeredis dependency) ──────────────────
class _FakeRedis:
    """Records XADD entries per stream + supports the zadd/zrem/set/get/expire surface the
    tuner router touches. Async methods so ``await redis.xadd(...)`` works."""

    def __init__(self):
        self.streams: dict[str, list] = {}
        self.kv: dict[str, str] = {}
        self.zsets: dict[str, dict] = {}
        self.zadd_calls: list[tuple] = []

    async def xadd(self, key, fields, *a, **k):
        self.streams.setdefault(key, []).append(fields)
        return f"{len(self.streams[key])}-0"

    async def zadd(self, key, mapping, *a, **k):
        self.zadd_calls.append((key, mapping))
        self.zsets.setdefault(key, {}).update(mapping)
        return len(mapping)

    async def zrem(self, key, *members):
        z = self.zsets.get(key, {})
        for m in members:
            z.pop(m, None)
        return 1

    async def zscore(self, key, member):
        # CR-01 run<->skill membership oracle: returns the score if the member is in the
        # sorted set, else None (mirrors redis ZSCORE — the "is this run a member of this
        # skill's run set?" probe the stream + results routes use).
        return self.zsets.get(key, {}).get(member)

    async def set(self, key, value, *a, **k):
        # Honor the SET NX semantic the tuner in-flight guard relies on (WR-01): when
        # ``nx=True`` the write succeeds ONLY if the key is absent, returning a truthy value;
        # if the key already exists it returns None (the losing POST -> 409). ``ex`` (TTL) is
        # accepted and ignored by the fake.
        if k.get("nx") and key in self.kv:
            return None
        self.kv[key] = value
        return True

    async def get(self, key):
        return self.kv.get(key)

    async def delete(self, *keys):
        n = 0
        for key in keys:
            if key in self.kv:
                del self.kv[key]
                n += 1
        return n

    async def expire(self, key, ttl):
        return True

    def events_of_type(self, stream_key, event_type):
        """Return the parsed payloads of the given tuner event type on a stream."""
        out = []
        for fields in self.streams.get(stream_key, []):
            payload = json.loads(fields["data"])
            if payload.get("type") == event_type:
                out.append(payload)
        return out


def _supabase_returning_skill(rows):
    """Mock supabase whose skills SELECT returns ``rows`` (the owner-scope read result)."""
    sb = _build_mock_supabase()
    skills_builder = sb.table("skills")
    skills_builder.execute.side_effect = lambda *a, **k: _make_result(rows)
    return sb


# ── Phase 123.1 Plan 01 — tuner_runs durable-persistence + seeded-cases helpers ──
def _supabase_with_tuner_runs(skill_rows, *, store=None):
    """Mock supabase whose ``skills`` SELECT returns ``skill_rows`` AND whose ``tuner_runs``
    table simulates the live latest-per-skill upsert/read.

    ``store`` is a dict that backs the (single, UNIQUE(skill_id)) latest row: an upsert
    OVERWRITES it (latest-wins via on_conflict=skill_id), a select returns the stored row.
    Recorded upsert payloads land in ``store['_upserts']`` so a test can assert the
    on_conflict key + that a re-run overwrote (one row) rather than accumulating.
    """
    if store is None:
        store = {}
    store.setdefault("_upserts", [])
    store.setdefault("_row", None)

    sb = _supabase_returning_skill(skill_rows)
    tr = _make_table_builder(lambda *a, **k: _make_result(
        [store["_row"]] if store["_row"] is not None else []
    ))

    def _upsert(payload, *a, **k):
        # Record the upsert + the on_conflict kwarg, then OVERWRITE the single stored row
        # (latest-wins — UNIQUE(skill_id)). Returns ``tr`` so ``.upsert(...).execute()`` chains.
        store["_upserts"].append({"payload": payload, "kwargs": k})
        store["_row"] = dict(payload)
        return tr

    tr.upsert.side_effect = _upsert

    # Route the tuner_runs table to ``tr``; keep skills routed to the owner-scope mock.
    _orig_table = sb.table.side_effect

    def _route(name):
        if name == "tuner_runs":
            return tr
        return _orig_table(name)

    sb.table.side_effect = _route
    sb._tuner_store = store  # test handle
    return sb


@pytest.fixture(autouse=True)
def _clear_inflight():
    """The per-skill in-flight guard is module-level — clear it around every test so a
    prior test's run doesn't 409 the next start."""
    skill_tuner._INFLIGHT_SKILLS.clear()
    yield
    skill_tuner._INFLIGHT_SKILLS.clear()


# ── 1. Start returns a run id immediately + ZADDs the run-buffer ─────────────────
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_start_returns_run_id_and_zadds_run_buffer():
    """POST .../tuner/runs as the owner returns a run id (non-blocking, D-06) and ZADDs
    ``runs:active`` + the per-skill sorted set (Phase-061+ transport)."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    sb = _supabase_returning_skill([skill_row])
    fake_redis = _FakeRedis()

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_current_user] = lambda: OWNER
    app.dependency_overrides[get_redis] = lambda: fake_redis
    # Patch the service so the spawned background job does NOT touch a live LLM.
    with patch.object(skill_tuner.skill_tuner_service, "build_candidates",
                      new=AsyncMock(return_value=["v2 description"])), \
         patch.object(skill_tuner.skill_tuner_service, "classify_fires",
                      new=AsyncMock(return_value=TriggerDecision(would_load=True, skill_name="Risk Register"))), \
         patch.object(skill_tuner.skill_tuner_service, "fetch_owner_scoped_siblings",
                      new=lambda *a, **k: []):
        try:
            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                resp = await c.post(
                    f"/skills/{SKILL_ID}/tuner/runs",
                    json={"cases": [{"prompt": "fill a risk register", "should_fire": True},
                                    {"prompt": "tell me a joke", "should_fire": False}],
                          "targets": [{"provider": "openai", "model": "gpt-5.4-mini"}]},
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            app.dependency_overrides.pop(get_supabase, None)
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 202, f"expected 202; got {resp.status_code} body={resp.text}"
    body = resp.json()
    assert "run_id" in body and body["run_id"], f"expected a run_id; got {body!r}"
    # Run-buffer ZADD: runs:active AND the per-skill sorted set were written.
    zadd_keys = {k for (k, _m) in fake_redis.zadd_calls}
    assert "runs:active" in zadd_keys, f"expected runs:active ZADD; got {zadd_keys!r}"
    assert any(k.startswith("runs_by_thread:tuner:") for k in zadd_keys), \
        f"expected per-skill run-buffer ZADD; got {zadd_keys!r}"


# ── 2. Cross-user denial — 404 (the load-bearing leak-safety assertion) ──────────
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_start_cross_user_returns_404():
    """POST a tuner run for a skill owned by ANOTHER user (not global) → 404 (V4 /
    T-123-04-01). The owner-scope ``.or_(own,global)`` SELECT returns no row for OTHER_USER;
    the route 404s (NOT 403 — never leak existence)."""
    sb = _supabase_returning_skill([])  # owner-scope filter finds NO row for OTHER_USER
    fake_redis = _FakeRedis()
    skills_execute_called = []
    sb.table("skills").execute.side_effect = lambda *a, **k: (
        skills_execute_called.append((a, k)) or _make_result([])
    )

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_current_user] = lambda: OTHER_USER
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.post(
                f"/skills/{SKILL_ID}/tuner/runs",
                json={"cases": [], "targets": []},
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 404, \
        f"expected 404 (NOT 403, NOT 202) on cross-user start; got {resp.status_code} body={resp.text}"
    body = resp.json()
    assert body.get("detail") == "Skill not found", \
        f"expected route's HTTPException detail 'Skill not found'; got {body!r}"
    # Anti-false-RED: the owner-scope SELECT must have actually run (route registered).
    assert skills_execute_called, "expected skills ownership SELECT to be called (route may not be registered)"


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_get_results_cross_user_returns_404():
    """GET .../tuner/runs/{id} for another user's skill → 404 (the results route is
    owner-scoped too — a cross-user reader can never read a tuning run)."""
    sb = _supabase_returning_skill([])  # no row for OTHER_USER
    fake_redis = _FakeRedis()
    run_id = str(uuid4())

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_current_user] = lambda: OTHER_USER
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get(
                f"/skills/{SKILL_ID}/tuner/runs/{run_id}",
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 404, \
        f"expected 404 on cross-user results; got {resp.status_code} body={resp.text}"
    assert resp.json().get("detail") == "Skill not found"


# ── 2c. CR-01 — a VISIBLE skill + a FOREIGN run_id → 404 (no cross-buffer read) ───
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_visible_skill_foreign_run_id_returns_404_both_routes():
    """Owning/seeing a skill does NOT grant reading an ARBITRARY ``run_id``'s buffer (CR-01).

    The tuner reuses the SAME ``run:{run_id}`` keyspace as chat, so the skill gate alone (which
    only proves "you can see this skill") would let a holder of any visible/global skill + a
    LEAKED run_id read an arbitrary chat/tuner buffer. Both the stream and results routes now
    bind run_id<->skill (per-skill ZSET membership / durable tuner_runs row). A FOREIGN run_id
    — never started for THIS skill, present in the shared buffer keyspace — must 404 on BOTH,
    and the foreign buffer's content must NOT be returned (non-vacuous)."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    sb = _supabase_with_tuner_runs([skill_row], store={})  # no tuner_runs row for any run
    fake_redis = _FakeRedis()

    # A foreign run that was NEVER started for SKILL_ID — but its buffers DO exist in the shared
    # keyspace (as if it were someone else's chat/tuner run). The membership set for THIS skill
    # is deliberately EMPTY (the run was never ZADDed under runs_by_thread:tuner:{SKILL_ID}).
    foreign_run_id = str(uuid4())
    secret_marker = "CROSS-USER-BUFFER-SHOULD-NEVER-BE-RETURNED"
    fake_redis.kv[f"tuner_result:{foreign_run_id}"] = json.dumps({"secret": secret_marker})
    fake_redis.streams[f"run:{foreign_run_id}"] = [
        {"data": json.dumps({"type": "tuner_progress", "secret": secret_marker})}
    ]

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_current_user] = lambda: OWNER  # OWNER can SEE the skill
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            results_resp = await c.get(
                f"/skills/{SKILL_ID}/tuner/runs/{foreign_run_id}",
                headers={"Authorization": "Bearer test-token"},
            )
            stream_resp = await c.get(
                f"/skills/{SKILL_ID}/tuner/runs/{foreign_run_id}/stream",
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)

    # Both routes refuse the foreign run_id with 404 (never 403 — don't leak existence).
    assert results_resp.status_code == 404, \
        f"expected 404 on a foreign run_id (results); got {results_resp.status_code} body={results_resp.text}"
    assert results_resp.json().get("detail") == "Tuner run not found", \
        f"expected the run<->skill membership 404 detail; got {results_resp.json()!r}"
    assert stream_resp.status_code == 404, \
        f"expected 404 on a foreign run_id (stream); got {stream_resp.status_code} body={stream_resp.text}"
    assert stream_resp.json().get("detail") == "Tuner run not found", \
        f"expected the run<->skill membership 404 detail; got {stream_resp.json()!r}"
    # Non-vacuous: the foreign buffer's content was NOT exfiltrated through either route.
    assert secret_marker not in results_resp.text, \
        "the foreign tuner_result buffer must NOT be returned (cross-buffer read)"
    assert secret_marker not in stream_resp.text, \
        "the foreign run-buffer stream must NOT be returned (cross-buffer read)"


# ── 2d. CR-01 — the LEGITIMATE in-flight run passes the gate (anti-overblock) ─────
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_stream_legitimate_in_flight_run_passes_membership_gate():
    """A run that WAS started for this skill (its run_id is in runs_by_thread:tuner:{skill_id})
    is NOT denied by the CR-01 membership gate — the gate blocks FOREIGN run_ids WITHOUT
    over-blocking the legitimate in-flight stream (anti-overblock).

    We call the route coroutine directly and assert it RETURNS an EventSourceResponse (i.e. it
    did NOT raise the 404 ``HTTPException`` the foreign-run_id path raises) — without consuming
    the SSE body (the shared replay_tail_consumer's xread tail is covered by the runs.py
    tests; here we only prove the membership gate let a legitimate member through)."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    sb = _supabase_returning_skill([skill_row])
    fake_redis = _FakeRedis()
    run_id = uuid4()
    # Simulate the start route's ZADD: this run IS a member of the skill's run set (in-flight).
    fake_redis.zsets[f"runs_by_thread:tuner:{SKILL_ID}"] = {str(run_id): 1.0}

    from sse_starlette import EventSourceResponse

    resp = await skill_tuner.stream_tuner_run(
        skill_id=SKILL_ID,
        run_id=run_id,
        since="0",
        current_user=OWNER,
        supabase=sb,
        redis=fake_redis,
    )
    # The legitimate member got PAST the gate — an SSE response, not the 404 HTTPException.
    assert isinstance(resp, EventSourceResponse), \
        f"expected an EventSourceResponse for a legitimate in-flight run; got {resp!r}"


# ── 3. Results returns BOTH fires + no_false per provider cell ───────────────────
@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_results_carry_both_fires_and_no_false_subscores():
    """Drive the background job to completion (service mocked) and assert the GET results
    scoreboard carries BOTH fires AND no_false per provider cell (042-A)."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    fake_redis = _FakeRedis()
    run_id = uuid4()
    # CR-01: the GET binds run_id<->skill via the live per-skill set OR the durable tuner_runs
    # row. The job's ``finally`` ZREMs the live membership, so back this run with a durable
    # store (the job upserts the matching run_id) — the post-completion legitimate path.
    stored = {}
    sb = _supabase_with_tuner_runs([skill_row], store=stored)

    # classify_fires fires correctly: True on should_fire prompts, False on should_not.
    async def _classify(target_model, catalog_lines, user_prompt, user_settings):
        if "risk register" in user_prompt.lower():
            return TriggerDecision(would_load=True, skill_name="Risk Register")
        return TriggerDecision(would_load=False, skill_name=None)

    cases = [
        {"prompt": "fill a risk register for me", "should_fire": True},
        {"prompt": "fill a risk register now", "should_fire": True},
        {"prompt": "tell me a joke", "should_fire": False},
        {"prompt": "what's the weather", "should_fire": False},
    ]
    targets = [{"provider": "openai", "model": "gpt-5.4-mini"}]

    with patch.object(skill_tuner.skill_tuner_service, "build_candidates",
                      new=AsyncMock(return_value=["v2 description"])), \
         patch.object(skill_tuner.skill_tuner_service, "classify_fires", new=_classify), \
         patch("app.models.user_settings.load_user_settings", return_value=object()):
        await skill_tuner._run_tuner_job(
            redis=fake_redis,
            run_id=run_id,
            skill_id=SKILL_ID,
            skill=skill_row,
            cases=cases,
            targets=targets,
            n=2,
            user_id=OWNER["id"],
            supabase=sb,  # CR-01: durable run_id<->skill binding for the post-completion GET
        )

    # The scoreboard is stashed at tuner_result:{run_id}; GET reads it owner-scoped.
    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_current_user] = lambda: OWNER
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get(
                f"/skills/{SKILL_ID}/tuner/runs/{run_id}",
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 200, f"expected 200 results; got {resp.status_code} body={resp.text}"
    scoreboard = resp.json()
    assert scoreboard["candidates"], "expected at least one scored candidate"
    # EVERY provider cell carries BOTH fires and no_false (042-A — false-fire rail visible).
    found_cell = False
    for cand in scoreboard["candidates"]:
        for cell in cand["cells"]:
            found_cell = True
            assert "fires" in cell["axes"], f"cell missing fires sub-score: {cell!r}"
            assert "no_false" in cell["axes"], f"cell missing no_false sub-score: {cell!r}"
    assert found_cell, "expected at least one provider cell in the scoreboard"
    # A tuner_complete progress event was emitted on the run-buffer (tuner-specific vocab).
    assert fake_redis.events_of_type(f"run:{run_id}", "tuner_complete"), \
        "expected a tuner_complete event on the run-buffer"


# ── 4. The background run is BOUNDED — target cap honored (no unbounded fan-out) ─
@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_start_caps_targets_no_unbounded_fanout():
    """POST with a target list LARGER than MAX_TARGETS → only MAX_TARGETS providers are
    scored (T-123-04-02 / DoS guard). We assert the run id response echoes the capped target
    set AND the background job scores no more than the cap."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    fake_redis = _FakeRedis()

    # Build a target list 3x the cap.
    over_cap_targets = [
        {"provider": f"p{i}", "model": f"m{i}"} for i in range(skill_tuner.MAX_TARGETS * 3)
    ]

    classify = AsyncMock(return_value=TriggerDecision(would_load=False, skill_name=None))

    app.dependency_overrides[get_supabase] = lambda: _supabase_returning_skill([skill_row])
    app.dependency_overrides[get_current_user] = lambda: OWNER
    app.dependency_overrides[get_redis] = lambda: fake_redis
    captured = {}
    _orig_job = skill_tuner._run_tuner_job

    async def _spy_job(**kwargs):
        captured["targets"] = kwargs.get("targets")
        captured["cases"] = kwargs.get("cases")
        return await _orig_job(**kwargs)

    with patch.object(skill_tuner.skill_tuner_service, "build_candidates",
                      new=AsyncMock(return_value=[])), \
         patch.object(skill_tuner.skill_tuner_service, "classify_fires", new=classify), \
         patch("app.models.user_settings.load_user_settings", return_value=object()), \
         patch.object(skill_tuner, "_run_tuner_job", new=_spy_job):
        try:
            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                resp = await c.post(
                    f"/skills/{SKILL_ID}/tuner/runs",
                    json={"cases": [{"prompt": "x", "should_fire": True}],
                          "targets": over_cap_targets},
                    headers={"Authorization": "Bearer test-token"},
                )
            # The route spawns the background job fire-and-forget; yield control so the
            # scheduled task runs (and records its capped target list) before we assert.
            for _ in range(20):
                if captured.get("targets") is not None:
                    break
                await asyncio.sleep(0.01)
        finally:
            app.dependency_overrides.pop(get_supabase, None)
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 202, f"expected 202; got {resp.status_code} body={resp.text}"
    body = resp.json()
    # The response echoes the CAPPED target set — no unbounded fan-out.
    assert len(body["targets"]) == skill_tuner.MAX_TARGETS, \
        f"expected targets capped at {skill_tuner.MAX_TARGETS}; got {len(body['targets'])}"
    # The background task received the capped target list (not the 3x over-cap list).
    assert captured.get("targets") is not None, "expected the background job to be spawned"
    assert len(captured["targets"]) == skill_tuner.MAX_TARGETS, \
        f"background job got {len(captured['targets'])} targets; expected cap {skill_tuner.MAX_TARGETS}"


# ── 5. One job per skill — a duplicate concurrent start 409s (bound: no fan-out) ─
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_duplicate_concurrent_run_returns_409():
    """A second start for a skill already in-flight → 409 (one job per skill — T-123-04-02).

    Phase 123 (WR-01): the gate is the cross-worker Redis ``SET NX`` claim, NOT the
    per-process ``_INFLIGHT_SKILLS`` set — so this test pre-sets the Redis claim key
    (``tuner_inflight:{skill_id}``) to simulate a run already in-flight in ANOTHER worker.
    The losing POST's ``SET NX`` then returns None -> 409."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    fake_redis = _FakeRedis()
    # Pre-set the cross-worker in-flight claim (an active run owns it). The per-process set is
    # deliberately NOT seeded — proving the Redis claim is the real gate (defeats WORKER_COUNT=2).
    fake_redis.kv[skill_tuner._inflight_key(SKILL_ID)] = "existing-run-id"

    app.dependency_overrides[get_supabase] = lambda: _supabase_returning_skill([skill_row])
    app.dependency_overrides[get_current_user] = lambda: OWNER
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.post(
                f"/skills/{SKILL_ID}/tuner/runs",
                json={"cases": [{"prompt": "x", "should_fire": True}],
                      "targets": [{"provider": "openai", "model": "gpt-5.4-mini"}]},
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 409, \
        f"expected 409 for a duplicate concurrent run; got {resp.status_code} body={resp.text}"


# ── 5b. WR-01 — unscored empty-model lanes are dropped (target_count is honest) ──
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_empty_model_targets_dropped_from_count_and_dispatch():
    """An ollama-only configured-target set (no representative model -> ``model: ""``) yields
    ZERO targets — so ``target_count``, the dispatched lanes, the rendered cells, and the
    "measured on N models" attribution all AGREE (WR-01).

    ``configured_targets`` appends local providers with an empty model (``_REPRESENTATIVE_MODEL``
    has no ollama/lmstudio entry); the scoring loop skips empty-model lanes (``if not model:
    continue``), so counting them fabricated a number. The route now filters empty-model
    targets at resolution time. We POST with empty ``body.targets`` (the default-resolution
    path), patch ``configured_targets`` to return an ollama-only empty-model lane, and assert
    the echoed (post-filter) ``targets`` is empty AND the background job got an empty target
    list (no fan-out onto an unscorable lane)."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    sb = _supabase_returning_skill([skill_row])
    fake_redis = _FakeRedis()

    captured = {}
    _orig_job = skill_tuner._run_tuner_job

    async def _spy_job(**kwargs):
        captured["targets"] = kwargs.get("targets")
        return await _orig_job(**kwargs)

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_current_user] = lambda: OWNER
    app.dependency_overrides[get_redis] = lambda: fake_redis
    # Empty body.targets -> the route resolves configured_targets(eff). Patch it to the
    # ollama-only empty-model lane the live service would actually produce, and stub the
    # app-settings load so no DB is touched. classify/build are stubbed (job never reached for
    # an empty lane, but keep them honest-fail-safe).
    with patch.object(skill_tuner.skill_tuner_service, "configured_targets",
                      new=lambda *a, **k: [{"provider": "ollama", "model": ""}]), \
         patch("app.models.user_settings.load_app_settings_async",
               new=AsyncMock(return_value=object())), \
         patch.object(skill_tuner.skill_tuner_service, "build_candidates",
                      new=AsyncMock(return_value=[])), \
         patch.object(skill_tuner.skill_tuner_service, "classify_fires",
                      new=AsyncMock(return_value=TriggerDecision(would_load=False, skill_name=None))), \
         patch.object(skill_tuner.skill_tuner_service, "fetch_owner_scoped_siblings",
                      new=lambda *a, **k: []), \
         patch.object(skill_tuner, "_run_tuner_job", new=_spy_job):
        try:
            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                resp = await c.post(
                    f"/skills/{SKILL_ID}/tuner/runs",
                    json={"cases": [{"prompt": "x", "should_fire": True}], "targets": []},
                    headers={"Authorization": "Bearer test-token"},
                )
            # Yield so the fire-and-forget background job records its target list.
            for _ in range(20):
                if captured.get("targets") is not None:
                    break
                await asyncio.sleep(0.01)
        finally:
            app.dependency_overrides.pop(get_supabase, None)
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 202, f"expected 202; got {resp.status_code} body={resp.text}"
    body = resp.json()
    # The echoed (post-filter) target set is EMPTY — target_count == len(targets) == 0, so the
    # persisted count equals the number of scored cells (zero), not a fabricated N.
    assert body["targets"] == [], \
        f"expected empty targets (the unscorable ollama lane dropped); got {body['targets']!r}"
    # The background job received the empty list (no dispatch onto the unscorable lane).
    assert captured.get("targets") == [], \
        f"background job must get the empty post-filter target list; got {captured.get('targets')!r}"


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 123.1 Plan 01 — durable latest-per-skill persistence (D-07) + GET-latest
# (D-08, owner-scoped 404) + seeded-cases GET with provenance (D-05).
#
# These mirror the existing cross-user-404 shape verbatim. RED until Task 3 ships
# the two GET routes + the run_in_threadpool upsert in _run_tuner_job (and Task 2
# applies the live tuner_runs table for the persistence assertions).
# ═══════════════════════════════════════════════════════════════════════════════
GLOBAL_SKILL_ID = str(uuid4())


# ── 6. GET-latest cross-user → 404 (the load-bearing leak-safety assertion) ──────
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_get_latest_cross_user_returns_404():
    """GET .../tuner/runs/latest for a skill owned by ANOTHER user (not global) → 404
    (D-08 / V4). The owner-scope ``.or_(own,global)`` SELECT returns no row for OTHER_USER;
    the route 404s (NOT 403 — never leak existence) BEFORE any tuner_runs read."""
    sb = _supabase_returning_skill([])  # owner-scope filter finds NO row for OTHER_USER
    fake_redis = _FakeRedis()
    skills_execute_called = []
    sb.table("skills").execute.side_effect = lambda *a, **k: (
        skills_execute_called.append((a, k)) or _make_result([])
    )

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_current_user] = lambda: OTHER_USER
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get(
                f"/skills/{SKILL_ID}/tuner/runs/latest",
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 404, \
        f"expected 404 (NOT 403) on cross-user GET-latest; got {resp.status_code} body={resp.text}"
    assert resp.json().get("detail") == "Skill not found", \
        f"expected detail 'Skill not found'; got {resp.json()!r}"
    # Anti-false-RED: the owner-scope SELECT must have actually run (route registered).
    assert skills_execute_called, \
        "expected skills ownership SELECT to be called (latest route may not be registered)"


# ── 7. GET-latest on a GLOBAL skill is visible to a second user (owner-OR-global) ─
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_get_latest_global_skill_visible():
    """A GLOBAL skill's latest tuner run is readable by a SECOND user (the owner-OR-global
    gate — D-08). OTHER_USER (not the skill's owner) passes the ``.or_(own,global)`` gate
    because is_global=true, and reads the stored latest scoreboard."""
    global_skill = {"id": GLOBAL_SKILL_ID, "name": "Shared Skill", "description": "A shared skill.",
                    "user_id": OWNER["id"], "is_global": True}
    stored = {"_row": {
        "skill_id": GLOBAL_SKILL_ID, "user_id": OWNER["id"], "run_id": str(uuid4()),
        "scoreboard": {"skill_id": GLOBAL_SKILL_ID, "candidates": [], "winner_index": None,
                       "winner_description": None},
        "builder_model": "gpt-5.4-mini", "target_count": 1, "case_count": 4,
    }}
    sb = _supabase_with_tuner_runs([global_skill], store=stored)
    fake_redis = _FakeRedis()

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_current_user] = lambda: OTHER_USER  # NOT the owner
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get(
                f"/skills/{GLOBAL_SKILL_ID}/tuner/runs/latest",
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 200, \
        f"expected 200 (global skill visible to second user); got {resp.status_code} body={resp.text}"
    body = resp.json()
    assert body.get("scoreboard", body).get("skill_id") == GLOBAL_SKILL_ID \
        or body.get("skill_id") == GLOBAL_SKILL_ID, \
        f"expected the stored scoreboard for the global skill; got {body!r}"


# ── 8. After a run the latest result PERSISTS (the D-07 durable upsert) ───────────
@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_latest_result_persists_after_run():
    """After ``_run_tuner_job`` completes, the latest scoreboard is upserted into tuner_runs
    (one row for that skill_id) and GET-latest returns it — survives a Redis flush (D-07)."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    fake_redis = _FakeRedis()
    run_id = uuid4()
    stored = {}
    sb = _supabase_with_tuner_runs([skill_row], store=stored)

    async def _classify(target_model, catalog_lines, user_prompt, user_settings):
        return TriggerDecision(would_load="risk register" in user_prompt.lower(),
                               skill_name="Risk Register")

    cases = [
        {"prompt": "fill a risk register for me", "should_fire": True},
        {"prompt": "fill a risk register now", "should_fire": True},
        {"prompt": "tell me a joke", "should_fire": False},
        {"prompt": "what's the weather", "should_fire": False},
    ]
    targets = [{"provider": "openai", "model": "gpt-5.4-mini"}]

    with patch.object(skill_tuner.skill_tuner_service, "build_candidates",
                      new=AsyncMock(return_value=["v2 description"])), \
         patch.object(skill_tuner.skill_tuner_service, "classify_fires", new=_classify), \
         patch("app.models.user_settings.load_user_settings", return_value=object()):
        # Task 3 threads ``supabase`` into _run_tuner_job for the durable upsert.
        await skill_tuner._run_tuner_job(
            redis=fake_redis,
            run_id=run_id,
            skill_id=SKILL_ID,
            skill=skill_row,
            cases=cases,
            targets=targets,
            n=2,
            user_id=OWNER["id"],
            supabase=sb,
        )

    # The durable upsert ran with on_conflict=skill_id (the latest-wins key — D-07).
    upserts = sb._tuner_store["_upserts"]
    assert upserts, "expected a tuner_runs upsert after the run completed (D-07 persistence)"
    on_conflict = upserts[-1]["kwargs"].get("on_conflict")
    assert on_conflict == "skill_id", \
        f"expected on_conflict='skill_id' (latest-wins UNIQUE(skill_id)); got {on_conflict!r}"
    assert upserts[-1]["payload"].get("skill_id") == SKILL_ID
    assert upserts[-1]["payload"].get("user_id") == OWNER["id"]
    # WR-07: ``updated_at`` MUST be a valid ISO-8601 timestamp, NOT the JSON string
    # ``"now()"`` (which Postgres rejects as ``invalid input syntax for type timestamp
    # with time zone``, silently swallowed by the upsert's best-effort try/except). The
    # mock store records the payload verbatim, so ``fromisoformat`` parsing it cleanly
    # is the regression guard against ``"now()"`` ever reaching real Postgres.
    updated_at = upserts[-1]["payload"].get("updated_at")
    assert updated_at, f"expected an updated_at in the upsert payload; got {upserts[-1]['payload']!r}"
    datetime.fromisoformat(updated_at)  # raises ValueError on "now()" / any non-ISO value

    # Drop the Redis result stash (simulate a flush) — GET-latest must STILL return the row.
    fake_redis.kv.pop(f"tuner_result:{run_id}", None)

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_current_user] = lambda: OWNER
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get(
                f"/skills/{SKILL_ID}/tuner/runs/latest",
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 200, \
        f"expected 200 from GET-latest after a run (durable, survives Redis flush); " \
        f"got {resp.status_code} body={resp.text}"


# ── 9. A re-run OVERWRITES the latest row (UNIQUE(skill_id) — never accumulates) ──
@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_rerun_overwrites_latest():
    """A second run for the SAME skill upserts on_conflict=skill_id — the stored latest row is
    OVERWRITTEN (one row, latest-wins), never a second accumulated row (D-07)."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    fake_redis = _FakeRedis()
    stored = {}
    sb = _supabase_with_tuner_runs([skill_row], store=stored)

    async def _classify(target_model, catalog_lines, user_prompt, user_settings):
        return TriggerDecision(would_load=False, skill_name=None)

    cases = [{"prompt": "x", "should_fire": True}, {"prompt": "y", "should_fire": False}]
    targets = [{"provider": "openai", "model": "gpt-5.4-mini"}]

    with patch.object(skill_tuner.skill_tuner_service, "build_candidates",
                      new=AsyncMock(return_value=["v2"])), \
         patch.object(skill_tuner.skill_tuner_service, "classify_fires", new=_classify), \
         patch("app.models.user_settings.load_user_settings", return_value=object()):
        # Two runs for the same skill_id.
        await skill_tuner._run_tuner_job(
            redis=fake_redis, run_id=uuid4(), skill_id=SKILL_ID, skill=skill_row,
            cases=cases, targets=targets, n=1, user_id=OWNER["id"], supabase=sb,
        )
        await skill_tuner._run_tuner_job(
            redis=fake_redis, run_id=uuid4(), skill_id=SKILL_ID, skill=skill_row,
            cases=cases, targets=targets, n=1, user_id=OWNER["id"], supabase=sb,
        )

    upserts = sb._tuner_store["_upserts"]
    assert len(upserts) == 2, f"expected exactly 2 upsert calls (one per run); got {len(upserts)}"
    # Both upserts carry the latest-wins key — the stored backing is a SINGLE row (overwritten).
    for u in upserts:
        assert u["kwargs"].get("on_conflict") == "skill_id", \
            f"every re-run upsert must use on_conflict='skill_id'; got {u['kwargs']!r}"
        # WR-07: every re-run's updated_at is a valid ISO-8601 timestamp, never "now()".
        updated_at = u["payload"].get("updated_at")
        assert updated_at, f"expected an updated_at in every upsert payload; got {u['payload']!r}"
        datetime.fromisoformat(updated_at)  # raises on "now()" / any non-ISO value
    assert sb._tuner_store["_row"] is not None, "expected a single stored latest row after re-run"
    assert sb._tuner_store["_row"]["skill_id"] == SKILL_ID


# ── 10. Seeded-cases GET returns should_fire + should_not WITH provenance (D-05) ──
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_seeded_cases_returned():
    """GET .../tuner/cases/seeded returns should_fire + should_not cases WITH provenance
    (seeded/sibling) for an OWNED skill (D-05). Cross-user → 404 (owner-scoped, no catalog
    leak)."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    sb = _supabase_returning_skill([skill_row])
    fake_redis = _FakeRedis()

    # Owner reads seeded cases — sibling fetch returns one sibling (owner-scoped), so the
    # should_not list carries a 'sibling'-provenance entry + the generic 'seeded' off-topic set.
    sibling = {"id": str(uuid4()), "name": "Email Drafter", "description": "Draft an email."}
    with patch.object(skill_tuner.skill_tuner_service, "fetch_owner_scoped_siblings",
                      new=lambda *a, **k: [sibling]):
        app.dependency_overrides[get_supabase] = lambda: sb
        app.dependency_overrides[get_current_user] = lambda: OWNER
        app.dependency_overrides[get_redis] = lambda: fake_redis
        try:
            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                resp = await c.get(
                    f"/skills/{SKILL_ID}/tuner/cases/seeded",
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            app.dependency_overrides.pop(get_supabase, None)
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 200, \
        f"expected 200 from seeded-cases for an owned skill; got {resp.status_code} body={resp.text}"
    body = resp.json()
    assert body.get("should_fire"), "expected non-empty should_fire seeded cases"
    assert body.get("should_not"), "expected non-empty should_not seeded cases"
    # Every entry carries a prompt + provenance; provenance is seeded or sibling, never 'held'.
    all_provenances = {item["provenance"] for item in body["should_fire"] + body["should_not"]}
    assert all("prompt" in item and "provenance" in item
               for item in body["should_fire"] + body["should_not"]), \
        f"every seeded case must carry prompt+provenance; got {body!r}"
    assert "seeded" in all_provenances, f"expected at least one 'seeded' provenance; got {all_provenances!r}"
    assert "sibling" in all_provenances, \
        f"expected a 'sibling'-provenance should_not (the owner-scoped false-fire rail); got {all_provenances!r}"
    assert "held" not in all_provenances, f"'held' must never be a seed provenance; got {all_provenances!r}"

    # Cross-user → 404 (owner-scoped; no sibling-catalog leak).
    sb_other = _supabase_returning_skill([])  # no row for OTHER_USER
    other_called = []
    sb_other.table("skills").execute.side_effect = lambda *a, **k: (
        other_called.append(1) or _make_result([])
    )
    app.dependency_overrides[get_supabase] = lambda: sb_other
    app.dependency_overrides[get_current_user] = lambda: OTHER_USER
    app.dependency_overrides[get_redis] = lambda: _FakeRedis()
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp2 = await c.get(
                f"/skills/{SKILL_ID}/tuner/cases/seeded",
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)

    assert resp2.status_code == 404, \
        f"expected 404 on cross-user seeded-cases; got {resp2.status_code} body={resp2.text}"
    assert other_called, "expected the owner-scope SELECT to run (seeded route may not be registered)"


# ── 11. Phase 123.1-05 (BUG-260624-01 #1) — the sibling-sourced should_not is CAPPED ──
def _distinct_siblings(n: int) -> list[dict]:
    """n siblings, each with a UNIQUE description (so each contributes one distinct
    sibling-sourced should_not entry — no dedup collapse)."""
    return [
        {"id": str(uuid4()), "name": f"Sibling {i}", "description": f"Do sibling task number {i}."}
        for i in range(n)
    ]


def test_auto_seed_cases_caps_sibling_sourced_should_not():
    """auto_seed_cases (the RUN path) caps the SIBLING-sourced should_not entries at
    MAX_SEEDED_SHOULD_NOT — the generic off-topic baseline is ALWAYS kept on top and is
    NOT counted against the sibling cap (non-vacuous: > cap distinct siblings)."""
    from app.services import skill_tuner_service as svc

    skill = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register."}
    siblings = _distinct_siblings(MAX_SEEDED_SHOULD_NOT + 7)  # strictly > cap

    seeded = svc.auto_seed_cases(skill, siblings)
    sibling_descs = {s["description"] for s in siblings}
    sibling_sourced = [p for p in seeded["should_not"] if p in sibling_descs]
    generic = [p for p in seeded["should_not"] if p in svc._GENERIC_OFF_TOPIC]

    assert len(sibling_sourced) == MAX_SEEDED_SHOULD_NOT, (
        f"sibling-sourced should_not must be capped at {MAX_SEEDED_SHOULD_NOT}; "
        f"got {len(sibling_sourced)}"
    )
    # The generic off-topic baseline is always fully present (never dropped by the cap).
    assert len(generic) == len(svc._GENERIC_OFF_TOPIC), (
        "the generic off-topic baseline must always be kept in full; "
        f"got {len(generic)} of {len(svc._GENERIC_OFF_TOPIC)}"
    )


def test_seed_cases_with_provenance_caps_and_reports_total():
    """seed_cases_with_provenance (the editor seed) caps sibling-provenance entries at the
    same MAX_SEEDED_SHOULD_NOT AND exposes the full uncapped sibling-sourced count so the
    route can return an honest total."""
    from app.services import skill_tuner_service as svc

    skill = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register."}
    full = MAX_SEEDED_SHOULD_NOT + 5
    siblings = _distinct_siblings(full)

    seeded = svc.seed_cases_with_provenance(skill, siblings)
    sibling_entries = [c for c in seeded["should_not"] if c["provenance"] == svc.PROVENANCE_SIBLING]

    assert len(sibling_entries) == MAX_SEEDED_SHOULD_NOT, (
        f"sibling-provenance should_not must be capped at {MAX_SEEDED_SHOULD_NOT}; "
        f"got {len(sibling_entries)}"
    )
    # The full uncapped sibling-sourced count is exposed (the route turns it into `total`).
    assert seeded["should_not_total"] == full, (
        f"should_not_total must equal the full uncapped sibling count {full}; "
        f"got {seeded['should_not_total']}"
    )


def test_seed_cases_with_provenance_no_cap_when_under_limit():
    """With siblings <= cap, nothing is truncated and total equals the shown sibling count
    (the banner-suppression path — total == shown means no banner)."""
    from app.services import skill_tuner_service as svc

    skill = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register."}
    under = MAX_SEEDED_SHOULD_NOT - 2
    siblings = _distinct_siblings(under)

    seeded = svc.seed_cases_with_provenance(skill, siblings)
    sibling_entries = [c for c in seeded["should_not"] if c["provenance"] == svc.PROVENANCE_SIBLING]

    assert len(sibling_entries) == under, f"expected all {under} siblings shown; got {len(sibling_entries)}"
    assert seeded["should_not_total"] == under, (
        f"total must equal the shown count ({under}) when under the cap; got {seeded['should_not_total']}"
    )


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_seeded_cases_GET_returns_capped_slice_plus_total():
    """GET .../tuner/cases/seeded with siblings > cap returns at most MAX_SEEDED_SHOULD_NOT
    sibling-provenance should_not entries AND a top-level `total` == the full uncapped
    sibling-sourced count; should_fire is untouched (non-vacuous: > cap distinct siblings)."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    sb = _supabase_returning_skill([skill_row])
    fake_redis = _FakeRedis()

    full = MAX_SEEDED_SHOULD_NOT + 6
    siblings = _distinct_siblings(full)
    with patch.object(skill_tuner.skill_tuner_service, "fetch_owner_scoped_siblings",
                      new=lambda *a, **k: siblings):
        app.dependency_overrides[get_supabase] = lambda: sb
        app.dependency_overrides[get_current_user] = lambda: OWNER
        app.dependency_overrides[get_redis] = lambda: fake_redis
        try:
            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                resp = await c.get(
                    f"/skills/{SKILL_ID}/tuner/cases/seeded",
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            app.dependency_overrides.pop(get_supabase, None)
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 200, f"expected 200; got {resp.status_code} body={resp.text}"
    body = resp.json()
    sibling_entries = [c for c in body["should_not"] if c["provenance"] == "sibling"]
    assert len(sibling_entries) <= MAX_SEEDED_SHOULD_NOT, (
        f"sibling-provenance should_not must be <= {MAX_SEEDED_SHOULD_NOT}; got {len(sibling_entries)}"
    )
    assert body["total"] == full, (
        f"body['total'] must equal the full uncapped sibling count {full}; got {body['total']}"
    )
    assert body.get("should_fire"), "should_fire must be untouched (non-empty)"


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 123.1 Plan 06 (BACKEND HONESTY — backlog §2) — the scoreboard never reports
# a score that was not measured; the attribution count never over-counts.
#
#   TT-05  an EMPTY should-fire/should-NOT axis renders as the unmeasured sentinel
#          (None / "n/a"), NEVER a fabricated 1.00 perfect recall.
#   TT-12  an ALL-error provider column (every classify call raised) is measured=False
#          and EXCLUDED from the persisted target_count / "measured on N models".
#   TT-15  cell_score returns the SINGLE stored cell["score"] (no recompute drift).
#
# These mirror the existing pure-service unit shape (test_seed_cases_with_provenance_*).
# ═══════════════════════════════════════════════════════════════════════════════


# ── TT-05 — an empty axis is the honest unmeasured sentinel (None), never 1.0 ─────
def test_build_cell_empty_fire_axis_is_unmeasured_not_one():
    """build_cell with fire_decisions=[] (no should-FIRE cases) records the fires axis as the
    unmeasured sentinel None — NOT a fabricated 1.0 recall — and the combined score reflects
    ONLY the measured no_false axis (TT-05)."""
    from app.services import skill_tuner_service as svc

    cell = svc.build_cell(
        provider="openai", model="gpt-5.4-mini",
        fire_decisions=[],                       # NO should-fire cases -> unmeasured
        no_false_decisions=[False, False, True],  # 2/3 correctly did-not-fire -> 2/3
    )
    assert cell["axes"]["fires"] is None, (
        f"empty fire axis must be the unmeasured sentinel None, NOT a fabricated score; "
        f"got {cell['axes']['fires']!r}"
    )
    assert cell["axes"]["fires"] != 1.0, "an empty fire axis must never be a fabricated 1.0"
    # The combined score is ONLY the measured (no_false) axis: 2 of 3 -> 2/3.
    assert cell["score"] == pytest.approx(2.0 / 3.0), (
        f"combined score must reflect ONLY the measured no_false axis (2/3); got {cell['score']!r}"
    )


def test_build_cell_both_axes_empty_is_wholly_unmeasured():
    """When BOTH axes are empty (no cases of either class), the cell is wholly unmeasured:
    both axes None, the combined score None, measured=False (TT-05 + TT-12 boundary)."""
    from app.services import skill_tuner_service as svc

    cell = svc.build_cell("openai", "gpt-5.4-mini", fire_decisions=[], no_false_decisions=[])
    assert cell["axes"]["fires"] is None and cell["axes"]["no_false"] is None, (
        f"both empty axes must be the unmeasured sentinel None; got {cell['axes']!r}"
    )
    assert cell["score"] is None, f"a wholly-unmeasured cell must have score None; got {cell['score']!r}"
    assert cell["measured"] is False, f"a cell with no real decisions must be measured=False; got {cell!r}"


def test_build_cell_measured_axis_scored_honestly():
    """A real fire_decisions list still scores fires as the matching fraction — the honest
    measured path is UNCHANGED (TT-05 anti-regression: the fix only touches the empty case)."""
    from app.services import skill_tuner_service as svc

    cell = svc.build_cell(
        provider="anthropic", model="claude-haiku-4-5-20251001",
        fire_decisions=[True, True, False],        # 2/3 fired -> 2/3 recall
        no_false_decisions=[False, False],         # 2/2 did-not-fire -> 1.0 precision
    )
    assert cell["axes"]["fires"] == pytest.approx(2.0 / 3.0)
    assert cell["axes"]["no_false"] == pytest.approx(1.0)
    assert cell["score"] == pytest.approx(((2.0 / 3.0) + 1.0) / 2.0)
    assert cell["measured"] is True, "a cell with real decisions on both axes must be measured=True"


# ── TT-12 — an all-error column is measured=False, distinct from a measured 0.0 ───
def test_build_cell_all_error_is_unmeasured_distinct_from_zero():
    """A cell where EVERY classify call raised (both decision lists empty AND a positive
    error_count) is marked measured=False — DISTINCT from a cell that genuinely measured 0.0
    (TT-12). The error_count is surfaced so the route/UI can explain "could not measure"."""
    from app.services import skill_tuner_service as svc

    # All-error: no real decision landed on either axis, but calls DID happen and raised.
    all_error = svc.build_cell(
        "minimax", "MiniMax-M2.7-highspeed",
        fire_decisions=[], no_false_decisions=[],
        fire_error_count=4, no_false_error_count=2,
    )
    assert all_error["measured"] is False, f"an all-error cell must be measured=False; got {all_error!r}"
    assert all_error["error_count"] == 6, (
        f"error_count must sum the per-axis raise counts (4+2=6); got {all_error['error_count']!r}"
    )
    assert all_error["score"] is None, "an all-error (no-decision) cell has no measured score -> None"

    # A genuinely measured 0.0 (the model really fired on a should-NOT, zero errors) is NOT the
    # same — it measured, it just scored badly.
    measured_zero = svc.build_cell(
        "openai", "gpt-5.4-mini",
        fire_decisions=[False, False],   # model NEVER fired when it should -> 0.0 recall
        no_false_decisions=[],
        fire_error_count=0, no_false_error_count=0,
    )
    assert measured_zero["measured"] is True, "a real 0.0 measurement must be measured=True (it measured)"
    assert measured_zero["axes"]["fires"] == 0.0, "a real all-wrong fire axis is 0.0, not None"
    assert measured_zero["error_count"] == 0


def test_build_cell_empty_but_no_error_is_not_all_error():
    """A candidate that simply had NO cases of a class (empty list, ZERO errors) is NOT an
    all-error column — measured is driven by the OTHER axis having a real decision (TT-12
    precision: empty-no-error != all-error)."""
    from app.services import skill_tuner_service as svc

    cell = svc.build_cell(
        "openai", "gpt-5.4-mini",
        fire_decisions=[True, True],   # measured the fires axis
        no_false_decisions=[],         # no should-NOT cases existed (NOT an error)
        fire_error_count=0, no_false_error_count=0,
    )
    assert cell["measured"] is True, "a cell that measured at least one axis is measured=True"
    assert cell["error_count"] == 0, "no errors -> error_count 0 (empty != errored)"
    assert cell["axes"]["no_false"] is None, "the absent no_false axis is the unmeasured sentinel None"


# ── TT-15 — cell_score returns the single stored cell["score"] (no drift) ─────────
def test_cell_score_returns_stored_value_verbatim():
    """cell_score(cell) returns cell["score"] verbatim when present — NO second computation
    that could drift from build_cell's stored value (TT-15)."""
    from app.services import skill_tuner_service as svc

    # A stored score that does NOT equal the (fires+no_false)/2 recompute proves cell_score is
    # NOT recomputing — it returns the stored single source of truth.
    cell = {"provider": "openai", "model": "m", "axes": {"fires": 1.0, "no_false": 1.0}, "score": 0.42}
    assert svc.cell_score(cell) == 0.42, (
        f"cell_score must return the stored cell['score'] verbatim (no recompute); got {svc.cell_score(cell)!r}"
    )


def test_cell_score_no_drift_against_build_cell():
    """A cell whose stored score was set by build_cell and cell_score(cell) agree EXACTLY —
    the single-source guarantee (TT-15: the two can never drift)."""
    from app.services import skill_tuner_service as svc

    cell = svc.build_cell(
        "openai", "gpt-5.4-mini",
        fire_decisions=[True, False, True],   # 2/3
        no_false_decisions=[False, True],     # 1/2
    )
    assert svc.cell_score(cell) == cell["score"], (
        f"cell_score must equal the build_cell-stored score (no drift); "
        f"cell_score={svc.cell_score(cell)!r} stored={cell['score']!r}"
    )


def test_cell_score_falls_back_to_recompute_when_no_stored_score():
    """When "score" is absent (a legacy/hand-built cell), cell_score falls back to the
    (fires+no_false)/2 recompute over MEASURED axes, treating a None axis as 0.0 for the
    fallback only (TT-15 safety net)."""
    from app.services import skill_tuner_service as svc

    legacy = {"axes": {"fires": 0.8, "no_false": 0.6}}  # no "score" key
    assert svc.cell_score(legacy) == pytest.approx((0.8 + 0.6) / 2.0), (
        "cell_score must fall back to the recompute when no stored score is present"
    )


# ── TT-12 end-to-end — an all-error column is EXCLUDED from the persisted target_count ──
@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_target_count_excludes_all_error_column():
    """Drive _run_tuner_job with TWO targets where ONE target's classify ALWAYS raises (every
    call) and the other measures normally. The persisted tuner_runs upsert payload's
    ``target_count`` must be 1 (the all-error column is EXCLUDED), NOT 2 — and the all-error
    cell carries measured=False / a non-zero error_count while the measured cell is
    measured=True (TT-12)."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    fake_redis = _FakeRedis()
    run_id = uuid4()
    stored = {}
    sb = _supabase_with_tuner_runs([skill_row], store=stored)

    # The GOOD model measures honestly; the BAD model's classify ALWAYS raises (an all-400 /
    # all-timeout provider). The raise is what TT-12 must distinguish from a real "did-not-fire".
    GOOD = "gpt-5.4-mini"
    BAD = "MiniMax-M2.7-highspeed"

    async def _classify(target_model, catalog_lines, user_prompt, user_settings):
        if target_model == BAD:
            raise RuntimeError("simulated all-400 provider — could not measure")
        return TriggerDecision(would_load="risk register" in user_prompt.lower(),
                               skill_name="Risk Register")

    cases = [
        {"prompt": "fill a risk register for me", "should_fire": True},
        {"prompt": "fill a risk register now", "should_fire": True},
        {"prompt": "tell me a joke", "should_fire": False},
        {"prompt": "what's the weather", "should_fire": False},
    ]
    targets = [{"provider": "openai", "model": GOOD},
               {"provider": "minimax", "model": BAD}]

    with patch.object(skill_tuner.skill_tuner_service, "build_candidates",
                      new=AsyncMock(return_value=["v2 description"])), \
         patch.object(skill_tuner.skill_tuner_service, "classify_fires", new=_classify), \
         patch("app.models.user_settings.load_user_settings", return_value=object()):
        await skill_tuner._run_tuner_job(
            redis=fake_redis, run_id=run_id, skill_id=SKILL_ID, skill=skill_row,
            cases=cases, targets=targets, n=2, user_id=OWNER["id"], supabase=sb,
        )

    # TT-12: the persisted target_count counts ONLY the measured column (the all-error minimax
    # lane is excluded) — it is 1, NOT 2.
    upserts = sb._tuner_store["_upserts"]
    assert upserts, "expected a tuner_runs upsert after the run completed"
    target_count = upserts[-1]["payload"].get("target_count")
    assert target_count == 1, (
        f"target_count must EXCLUDE the all-error column (measured on 1 model, not 2); "
        f"got {target_count!r}"
    )

    # The scoreboard cells reflect the honest measured/unmeasured split.
    scoreboard = upserts[-1]["payload"]["scoreboard"]
    all_cells = [c for cand in scoreboard["candidates"] for c in cand["cells"]]
    bad_cells = [c for c in all_cells if c["model"] == BAD]
    good_cells = [c for c in all_cells if c["model"] == GOOD]
    assert bad_cells, "the all-error minimax lane must still produce a cell (an unmeasured one)"
    assert good_cells, "the good openai lane must produce a measured cell"
    for c in bad_cells:
        assert c["measured"] is False, f"the all-error cell must be measured=False; got {c!r}"
        assert c["error_count"] > 0, f"the all-error cell must carry a non-zero error_count; got {c!r}"
    for c in good_cells:
        assert c["measured"] is True, f"the measured openai cell must be measured=True; got {c!r}"


@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_target_count_equals_len_targets_when_all_measure():
    """Happy-path anti-regression: when EVERY target measures normally (no all-error column),
    target_count == len(targets) — the TT-12 fix only excludes all-error columns, never
    under-counts a real measurement (TT-12 preserved path)."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    fake_redis = _FakeRedis()
    stored = {}
    sb = _supabase_with_tuner_runs([skill_row], store=stored)

    async def _classify(target_model, catalog_lines, user_prompt, user_settings):
        return TriggerDecision(would_load="risk register" in user_prompt.lower(),
                               skill_name="Risk Register")

    cases = [
        {"prompt": "fill a risk register for me", "should_fire": True},
        {"prompt": "fill a risk register now", "should_fire": True},
        {"prompt": "tell me a joke", "should_fire": False},
        {"prompt": "what's the weather", "should_fire": False},
    ]
    targets = [{"provider": "openai", "model": "gpt-5.4-mini"},
               {"provider": "anthropic", "model": "claude-haiku-4-5-20251001"}]

    with patch.object(skill_tuner.skill_tuner_service, "build_candidates",
                      new=AsyncMock(return_value=["v2 description"])), \
         patch.object(skill_tuner.skill_tuner_service, "classify_fires", new=_classify), \
         patch("app.models.user_settings.load_user_settings", return_value=object()):
        await skill_tuner._run_tuner_job(
            redis=fake_redis, run_id=uuid4(), skill_id=SKILL_ID, skill=skill_row,
            cases=cases, targets=targets, n=2, user_id=OWNER["id"], supabase=sb,
        )

    upserts = sb._tuner_store["_upserts"]
    assert upserts, "expected a tuner_runs upsert"
    assert upserts[-1]["payload"].get("target_count") == 2, (
        f"all-measured run: target_count must equal len(targets)=2; "
        f"got {upserts[-1]['payload'].get('target_count')!r}"
    )


@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_all_should_not_run_renders_fires_axis_unmeasured():
    """End-to-end TT-05: a run whose cases are ALL should_not (no should_fire) produces cells
    whose ``fires`` axis is the unmeasured sentinel None — NEVER a fabricated 1.0 — proving the
    honest empty axis flows through the REAL job, not just the build_cell unit."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    fake_redis = _FakeRedis()
    run_id = uuid4()
    stored = {}
    sb = _supabase_with_tuner_runs([skill_row], store=stored)

    async def _classify(target_model, catalog_lines, user_prompt, user_settings):
        return TriggerDecision(would_load=False, skill_name=None)

    # ALL should_not — no should_fire case exists, so the fires axis has ZERO decisions.
    cases = [
        {"prompt": "tell me a joke", "should_fire": False},
        {"prompt": "what's the weather", "should_fire": False},
        {"prompt": "summarize this article", "should_fire": False},
    ]
    targets = [{"provider": "openai", "model": "gpt-5.4-mini"}]

    with patch.object(skill_tuner.skill_tuner_service, "build_candidates",
                      new=AsyncMock(return_value=["v2 description"])), \
         patch.object(skill_tuner.skill_tuner_service, "classify_fires", new=_classify), \
         patch("app.models.user_settings.load_user_settings", return_value=object()):
        await skill_tuner._run_tuner_job(
            redis=fake_redis, run_id=run_id, skill_id=SKILL_ID, skill=skill_row,
            cases=cases, targets=targets, n=2, user_id=OWNER["id"], supabase=sb,
        )

    scoreboard = sb._tuner_store["_row"]["scoreboard"]
    all_cells = [c for cand in scoreboard["candidates"] for c in cand["cells"]]
    assert all_cells, "expected at least one cell in the all-should_not run"
    for c in all_cells:
        assert c["axes"]["fires"] is None, (
            f"the fires axis must be the unmeasured sentinel None (no should-fire cases), "
            f"NEVER a fabricated 1.0; got {c['axes']['fires']!r}"
        )
        assert c["axes"]["fires"] != 1.0, "an empty fire axis must never be a fabricated 1.0"


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 123.1 Plan 07 (RUN UX — backlog §2) — honest live progress + a REAL cancel.
#
#   TT-07  the job emits a tuner_progress event with stage="provider_start" carrying
#          provider+model at the START of each column (BEFORE the per-case loop) —
#          so the frontend can flip a lane queued -> running the moment scoring
#          begins, instead of every lane sitting "queued" until tuner_provider_done.
#   TT-08  a real owner-scoped + run<->skill-bound DELETE cancel route sets a
#          tuner_cancel:{run_id} Redis flag and releases the in-flight claim; the job
#          checks the flag at the candidate AND provider loop tops and stops cleanly
#          WITHOUT persisting a partial scoreboard; cross-user / foreign-run-id 404.
#
# These mirror the existing run<->skill bind 404 shape (test_get_results_cross_user,
# test_visible_skill_foreign_run_id_returns_404_both_routes) + the direct
# _run_tuner_job invocation pattern (test_results_carry_both_fires_and_no_false).
# ═══════════════════════════════════════════════════════════════════════════════


# ── TT-07 — the job emits stage="provider_start" at each column start ─────────────
@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_provider_start_emitted_before_provider_done():
    """Drive _run_tuner_job directly and assert the run-buffer carries a tuner_progress event
    with stage="provider_start" carrying provider+model for EACH measured target, emitted
    BEFORE that target's tuner_provider_done (TT-07 — the lane-flip honesty signal)."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    fake_redis = _FakeRedis()
    run_id = uuid4()
    stored = {}
    sb = _supabase_with_tuner_runs([skill_row], store=stored)

    async def _classify(target_model, catalog_lines, user_prompt, user_settings):
        return TriggerDecision(would_load="risk register" in user_prompt.lower(),
                               skill_name="Risk Register")

    cases = [
        {"prompt": "fill a risk register for me", "should_fire": True},
        {"prompt": "fill a risk register now", "should_fire": True},
        {"prompt": "tell me a joke", "should_fire": False},
        {"prompt": "what's the weather", "should_fire": False},
    ]
    targets = [{"provider": "openai", "model": "gpt-5.4-mini"},
               {"provider": "anthropic", "model": "claude-haiku-4-5-20251001"}]

    with patch.object(skill_tuner.skill_tuner_service, "build_candidates",
                      new=AsyncMock(return_value=["v2 description"])), \
         patch.object(skill_tuner.skill_tuner_service, "classify_fires", new=_classify), \
         patch("app.models.user_settings.load_user_settings", return_value=object()):
        await skill_tuner._run_tuner_job(
            redis=fake_redis, run_id=run_id, skill_id=SKILL_ID, skill=skill_row,
            cases=cases, targets=targets, n=2, user_id=OWNER["id"], supabase=sb,
        )

    stream_key = f"run:{run_id}"
    # A provider_start tuner_progress event was emitted for EACH measured target.
    starts = [
        p for p in fake_redis.events_of_type(stream_key, skill_tuner.EVENT_PROGRESS)
        if p.get("stage") == "provider_start"
    ]
    assert starts, "expected at least one tuner_progress stage='provider_start' event (TT-07)"
    started_models = {(p.get("provider"), p.get("model")) for p in starts}
    assert ("openai", "gpt-5.4-mini") in started_models, \
        f"expected a provider_start for the openai column; got {started_models!r}"
    assert ("anthropic", "claude-haiku-4-5-20251001") in started_models, \
        f"expected a provider_start for the anthropic column; got {started_models!r}"

    # The provider_start for a column precedes that column's tuner_provider_done (the lane
    # flips queued->running BEFORE it lands "done"). Compare positions in the raw stream.
    raw = [json.loads(f["data"]) for f in fake_redis.streams.get(stream_key, [])]
    for model in ("gpt-5.4-mini", "claude-haiku-4-5-20251001"):
        start_idx = next(
            (i for i, e in enumerate(raw)
             if e.get("type") == skill_tuner.EVENT_PROGRESS
             and e.get("stage") == "provider_start" and e.get("model") == model),
            None,
        )
        done_idx = next(
            (i for i, e in enumerate(raw)
             if e.get("type") == skill_tuner.EVENT_PROVIDER_DONE and e.get("model") == model),
            None,
        )
        assert start_idx is not None, f"no provider_start for model {model!r}"
        assert done_idx is not None, f"no tuner_provider_done for model {model!r}"
        assert start_idx < done_idx, (
            f"provider_start for {model!r} (idx {start_idx}) must precede its "
            f"tuner_provider_done (idx {done_idx}) — the lane flips running BEFORE done"
        )


# ── TT-08 — cross-user DELETE cancel → 404 (the owner gate, mirrors CR-01 IDOR) ──
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_cancel_cross_user_returns_404():
    """DELETE .../tuner/runs/{run_id} for a skill owned by ANOTHER user (not global) → 404
    (TT-08 owner gate, mirrors test_get_results_cross_user_returns_404). The owner-scope
    SELECT finds no row for OTHER_USER; the route 404s (NOT 403 — never leak existence) and
    NEVER sets the cancel flag."""
    sb = _supabase_returning_skill([])  # no row for OTHER_USER
    fake_redis = _FakeRedis()
    run_id = str(uuid4())
    skills_execute_called = []
    sb.table("skills").execute.side_effect = lambda *a, **k: (
        skills_execute_called.append((a, k)) or _make_result([])
    )

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_current_user] = lambda: OTHER_USER
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.delete(
                f"/skills/{SKILL_ID}/tuner/runs/{run_id}",
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 404, \
        f"expected 404 (NOT 403) on cross-user cancel; got {resp.status_code} body={resp.text}"
    assert resp.json().get("detail") == "Skill not found", \
        f"expected detail 'Skill not found'; got {resp.json()!r}"
    assert skills_execute_called, "expected the owner-scope SELECT to run (cancel route registered)"
    # No cancel flag was set for the foreign caller.
    assert skill_tuner._cancel_key(run_id) not in fake_redis.kv, \
        "a cross-user cancel must NEVER set the tuner_cancel flag"


# ── TT-08 — a VISIBLE skill + a FOREIGN run_id → 404 (run<->skill bind, mirrors CR-01) ─
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_cancel_foreign_run_id_returns_404():
    """DELETE with a run_id NOT a member of runs_by_thread:tuner:{skill_id} (a foreign/leaked
    run_id, even for a skill the caller CAN see) → 404 (TT-08 run<->skill bind, mirrors
    test_visible_skill_foreign_run_id_returns_404_both_routes). The cancel flag is NEVER set
    for an unbound run_id, and the in-flight claim of the unrelated skill is NOT released."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    sb = _supabase_returning_skill([skill_row])
    fake_redis = _FakeRedis()
    foreign_run_id = str(uuid4())
    # The membership set for THIS skill is empty — the foreign run was never ZADDed here.
    # Pre-seed an unrelated in-flight claim to prove the bad cancel does NOT release it.
    fake_redis.kv[skill_tuner._inflight_key(SKILL_ID)] = "some-other-active-run"

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_current_user] = lambda: OWNER  # OWNER can SEE the skill
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.delete(
                f"/skills/{SKILL_ID}/tuner/runs/{foreign_run_id}",
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code == 404, \
        f"expected 404 on a foreign run_id cancel; got {resp.status_code} body={resp.text}"
    assert resp.json().get("detail") == "Tuner run not found", \
        f"expected the run<->skill membership 404 detail; got {resp.json()!r}"
    # The foreign run_id never got a cancel flag (no cross-buffer cancel).
    assert skill_tuner._cancel_key(foreign_run_id) not in fake_redis.kv, \
        "a foreign run_id cancel must NEVER set the tuner_cancel flag"
    # The unrelated skill's in-flight claim was NOT released by the bad cancel.
    assert fake_redis.kv.get(skill_tuner._inflight_key(SKILL_ID)) == "some-other-active-run", \
        "a foreign-run-id cancel must NOT release the skill's in-flight claim"


# ── TT-08 — happy path: an owned, in-flight, bound run cancels (flag + claim release) ─
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_cancel_owned_inflight_run_sets_flag_and_releases_claim():
    """DELETE for an OWNED, in-flight, BOUND run → 2xx, SETs tuner_cancel:{run_id} AND DELetes
    tuner_inflight:{skill_id} (the claim is released so a retry no longer 409s) — TT-08 happy
    path. The membership set + the in-flight claim are both pre-seeded (the start route's state)."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}
    sb = _supabase_returning_skill([skill_row])
    fake_redis = _FakeRedis()
    run_id = str(uuid4())
    # Simulate the start route's state: the run IS a member of the skill's set + claim is HELD.
    fake_redis.zsets[f"runs_by_thread:tuner:{SKILL_ID}"] = {run_id: 1.0}
    fake_redis.kv[skill_tuner._inflight_key(SKILL_ID)] = run_id

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_current_user] = lambda: OWNER
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.delete(
                f"/skills/{SKILL_ID}/tuner/runs/{run_id}",
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)

    assert resp.status_code in (200, 202), \
        f"expected 2xx on a legitimate cancel; got {resp.status_code} body={resp.text}"
    body = resp.json()
    assert body.get("cancelled") is True, f"expected cancelled=True; got {body!r}"
    # The cancel flag was set so the running job stops at its next loop checkpoint.
    assert fake_redis.kv.get(skill_tuner._cancel_key(run_id)) is not None, \
        "DELETE must SET tuner_cancel:{run_id} so the job stops"
    # The in-flight claim was released immediately — a retry no longer 409s for the full TTL.
    assert skill_tuner._inflight_key(SKILL_ID) not in fake_redis.kv, \
        "DELETE must release the tuner_inflight claim so a retry no longer 409s"


# ── TT-08 — the job checkpoint: a pre-set cancel flag stops the run early ──────────
@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_run_stops_early_when_cancel_flag_preset():
    """Drive _run_tuner_job with the tuner_cancel flag PRE-SET in the fake redis; assert the job
    STOPS early (FEWER classify calls than an uncancelled run over the same inputs), does NOT
    persist a durable scoreboard (no tuner_runs upsert), and still runs its finally cleanup (the
    inflight key is cleared, runs:active is ZREM'd) — TT-08 checkpoint."""
    skill_row = {"id": SKILL_ID, "name": "Risk Register", "description": "Fill a risk register.",
                 "user_id": OWNER["id"], "is_global": False}

    async def _classify(target_model, catalog_lines, user_prompt, user_settings):
        return TriggerDecision(would_load="risk register" in user_prompt.lower(),
                               skill_name="Risk Register")

    cases = [
        {"prompt": "fill a risk register for me", "should_fire": True},
        {"prompt": "fill a risk register now", "should_fire": True},
        {"prompt": "tell me a joke", "should_fire": False},
        {"prompt": "what's the weather", "should_fire": False},
    ]
    targets = [{"provider": "openai", "model": "gpt-5.4-mini"},
               {"provider": "anthropic", "model": "claude-haiku-4-5-20251001"}]

    # Baseline: an UNCANCELLED run to count the classify calls over the same inputs.
    base_count = {"n": 0}

    async def _classify_counting(target_model, catalog_lines, user_prompt, user_settings):
        base_count["n"] += 1
        return await _classify(target_model, catalog_lines, user_prompt, user_settings)

    base_redis = _FakeRedis()
    base_store = {}
    base_sb = _supabase_with_tuner_runs([skill_row], store=base_store)
    with patch.object(skill_tuner.skill_tuner_service, "build_candidates",
                      new=AsyncMock(return_value=["v2 description"])), \
         patch.object(skill_tuner.skill_tuner_service, "classify_fires", new=_classify_counting), \
         patch("app.models.user_settings.load_user_settings", return_value=object()):
        await skill_tuner._run_tuner_job(
            redis=base_redis, run_id=uuid4(), skill_id=SKILL_ID, skill=skill_row,
            cases=cases, targets=targets, n=2, user_id=OWNER["id"], supabase=base_sb,
        )
    assert base_count["n"] > 0, "baseline run must make classify calls (anti-vacuous)"
    assert base_store["_upserts"], "baseline run must persist a durable scoreboard"

    # Cancelled: the flag is PRE-SET before the job starts; it must stop early.
    cancel_count = {"n": 0}

    async def _classify_counting_cancel(target_model, catalog_lines, user_prompt, user_settings):
        cancel_count["n"] += 1
        return await _classify(target_model, catalog_lines, user_prompt, user_settings)

    cancel_redis = _FakeRedis()
    cancel_store = {}
    cancel_sb = _supabase_with_tuner_runs([skill_row], store=cancel_store)
    run_id = uuid4()
    # Pre-set the cancel flag + the in-flight claim + the active-run membership (start state).
    cancel_redis.kv[skill_tuner._cancel_key(run_id)] = "1"
    cancel_redis.kv[skill_tuner._inflight_key(SKILL_ID)] = str(run_id)
    cancel_redis.zsets["runs:active"] = {str(run_id): 1.0}
    cancel_redis.zsets[f"runs_by_thread:tuner:{SKILL_ID}"] = {str(run_id): 1.0}

    with patch.object(skill_tuner.skill_tuner_service, "build_candidates",
                      new=AsyncMock(return_value=["v2 description"])), \
         patch.object(skill_tuner.skill_tuner_service, "classify_fires", new=_classify_counting_cancel), \
         patch("app.models.user_settings.load_user_settings", return_value=object()):
        await skill_tuner._run_tuner_job(
            redis=cancel_redis, run_id=run_id, skill_id=SKILL_ID, skill=skill_row,
            cases=cases, targets=targets, n=2, user_id=OWNER["id"], supabase=cancel_sb,
        )

    # The cancelled run scored FEWER cases than the full baseline (it stopped at a loop top).
    assert cancel_count["n"] < base_count["n"], (
        f"a pre-cancelled run must make FEWER classify calls than the full run; "
        f"cancelled={cancel_count['n']} baseline={base_count['n']}"
    )
    # A cancelled run does NOT persist a partial scoreboard as the durable latest.
    assert not cancel_store["_upserts"], (
        "a cancelled run must NOT upsert a partial scoreboard into tuner_runs (no durable persist)"
    )
    # The finally cleanup STILL ran: the in-flight claim is released + runs:active is ZREM'd.
    assert skill_tuner._inflight_key(SKILL_ID) not in cancel_redis.kv, \
        "the cancelled run's finally must still release the in-flight claim"
    assert str(run_id) not in cancel_redis.zsets.get("runs:active", {}), \
        "the cancelled run's finally must still ZREM runs:active"
