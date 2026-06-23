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
from uuid import uuid4
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport

from app.api import skill_tuner
from app.dependencies import get_current_user, get_redis, get_supabase
from app.main import app
from app.services.skill_tuner_service import TriggerDecision
from tests.integration._run_helpers import _build_mock_supabase, _make_result

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
        )

    # The scoreboard is stashed at tuner_result:{run_id}; GET reads it owner-scoped.
    sb = _supabase_returning_skill([skill_row])
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
