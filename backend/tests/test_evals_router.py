"""Phase 134 Plan 03 (EVAL-04) — eval RATINGS router integration tests.

The FIRST user-initiated write in the eval domain gets its own API-level test file (no eval
router test existed before 134 — only the service-level ``test_eval_runner.py``). Both tests
drive the REAL FastAPI app through the owner-scoped ratings endpoint with NO live DB and NO
live provider (dependency-overridden ``get_current_user`` / ``get_supabase`` fakes):

  1. ``test_rating_round_trip`` (D-08): as OWNER, ``PUT up`` -> ``PUT down`` -> ``PUT null``
     round-trips through the DURABLE readout (``GET /skills/{id}/evals/runs/{run_id}`` merges
     the caller's rating onto each result). Proves the rating is written, re-ratable (the
     toggle updates the ONE row, not a duplicate), and clearable — end to end.
  2. ``test_rating_cross_user_404`` (T-134-01 IDOR): as OTHER_USER, ``PUT rating`` on OWNER's
     ``eval_results`` id -> 404 (never 403) AND no ``eval_ratings`` row is written for
     OTHER_USER — the owner-verify gate is load-bearing.

The in-memory ``_FilterSupabase`` honors ``.eq()`` chains + ``upsert(on_conflict=...)`` +
delete so the owner-scoping + toggle/clear assertions are meaningful (modeled on the filtering
fake in ``test_eval_runner.py``, extended with ``upsert`` for the ratings write path).
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi import HTTPException
from httpx import ASGITransport

from app.dependencies import get_current_user, get_supabase

OWNER = {"id": "00000000-0000-0000-0000-000000000001", "email": "owner@example.com"}
OTHER_USER = {"id": "00000000-0000-0000-0000-000000000099", "email": "other@example.com"}

SKILL_ID = str(uuid4())


# ── A filtering in-memory supabase that honors .eq() chains + upsert(on_conflict) so the
#    owner-scoping (404), the re-ratable toggle (one row), and clear (DELETE) are meaningful ──
class _Result:
    def __init__(self, data):
        self.data = data
        self.count = len(data) if isinstance(data, list) else None


class _FilterTable:
    def __init__(self, store, name):
        self.store = store
        self.name = name
        self._op = "select"
        self._payload = None
        self._on_conflict = None
        self._filters = []
        self._in_filters = []
        self._is_filters = []
        self._order = None
        self._desc = False
        self._limit = None
        self._single = False

    def select(self, *a, **k):
        self._op = "select"
        return self

    def insert(self, payload, *a, **k):
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload, *a, **k):
        self._op = "update"
        self._payload = payload
        return self

    def upsert(self, payload, *a, on_conflict=None, **k):
        self._op = "upsert"
        self._payload = payload
        self._on_conflict = on_conflict
        return self

    def delete(self, *a, **k):
        self._op = "delete"
        return self

    def eq(self, col, val):
        self._filters.append((col, str(val)))
        return self

    def in_(self, col, values):
        # Membership filter — mirrors PostgREST/supabase-py .in_(col, [...]): a row
        # matches when its stringified column value is in the provided value set.
        self._in_filters.append((col, [str(v) for v in values]))
        return self

    def is_(self, col, val):
        # NULL predicate — mirrors supabase-py .is_(col, "null"): a row matches when its
        # column value IS NULL (None). The skill-less sweep readout uses .is_("skill_id","null").
        self._is_filters.append((col, val))
        return self

    def order(self, col, desc=False, **k):
        self._order = col
        self._desc = desc
        return self

    def limit(self, n, *a, **k):
        self._limit = n
        return self

    def maybe_single(self, *a, **k):
        self._single = True
        return self

    def single(self, *a, **k):
        self._single = True
        return self

    def _matched(self):
        out = []
        for r in self.store.get(self.name, []):
            if not all(str(r.get(c)) == v for c, v in self._filters):
                continue
            if not all(str(r.get(c)) in vals for c, vals in self._in_filters):
                continue
            if not all(
                (r.get(c) is None)
                if (v is None or str(v).lower() == "null")
                else (str(r.get(c)) == str(v))
                for c, v in self._is_filters
            ):
                continue
            out.append(r)
        return out

    def execute(self, *a, **k):
        if self._op == "insert":
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            self.store.setdefault(self.name, []).extend(rows)
            return _Result(rows)
        if self._op == "upsert":
            # Emulate ON CONFLICT (self._on_conflict) DO UPDATE: match on the conflict columns;
            # update the existing row in place (the re-rate toggle) or append (first thumb).
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            conflict_cols = [c.strip() for c in (self._on_conflict or "").split(",") if c.strip()]
            existing = self.store.setdefault(self.name, [])
            out = []
            for payload in rows:
                match = None
                if conflict_cols:
                    for r in existing:
                        if all(str(r.get(c)) == str(payload.get(c)) for c in conflict_cols):
                            match = r
                            break
                if match is not None:
                    match.update(payload)
                    out.append(match)
                else:
                    existing.append(payload)
                    out.append(payload)
            return _Result(out)
        if self._op == "update":
            rows = self._matched()
            for r in rows:
                r.update(self._payload)
            return _Result(rows)
        if self._op == "delete":
            rows = self._matched()
            self.store[self.name] = [r for r in self.store.get(self.name, []) if r not in rows]
            return _Result(rows)
        # select
        out = self._matched()
        if self._order:
            out = sorted(out, key=lambda r: r.get(self._order) or 0, reverse=self._desc)
        if self._limit is not None:
            out = out[: self._limit]
        if self._single:
            return _Result(out[0] if out else None)
        return _Result(out)


class _FilterSupabase:
    def __init__(self, store=None):
        self.store = store if store is not None else {}

    def table(self, name):
        return _FilterTable(self.store, name)


def _override(app, *, user, supabase):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: supabase


def _clear_overrides(app):
    for dep in (get_current_user, get_supabase):
        app.dependency_overrides.pop(dep, None)


def _seed_run_with_result(result_id, run_id):
    """A completed run + one OWNER-stamped eval_results row + an empty eval_ratings table —
    the store the round-trip readout reads back through."""
    return {
        "eval_runs": [{
            "id": run_id, "skill_id": SKILL_ID, "skill_version_id": str(uuid4()),
            "user_id": OWNER["id"], "provider": "anthropic",
            "model": "claude-haiku-4-5-20251001", "status": "completed",
            "case_count": 1, "error": None, "created_at": "2026-06-30T00:00:00Z",
            "completed_at": "2026-06-30T00:01:00Z",
        }],
        "eval_results": [{
            "id": result_id, "eval_run_id": run_id, "test_case_id": str(uuid4()),
            "user_id": OWNER["id"], "variant": "with_skill", "provider": "anthropic",
            "model": "claude-haiku-4-5-20251001", "output": "an answer", "status": "completed",
            "error": None, "input_tokens": 1, "output_tokens": 2,
            "created_at": "2026-06-30T00:00:01Z",
        }],
        "eval_ratings": [],
    }


async def _readout_rating(client, run_id, result_id):
    """Fetch the durable run readout and return the caller's merged rating on ``result_id``."""
    resp = await client.get(
        f"/skills/{SKILL_ID}/evals/runs/{run_id}",
        headers={"Authorization": "Bearer test"},
    )
    assert resp.status_code == 200, f"GET readout {resp.status_code}: {resp.text}"
    results = resp.json()["eval_results"]
    row = next(r for r in results if r["id"] == result_id)
    return row.get("rating")


@pytest.mark.asyncio
async def test_rating_round_trip():
    """EVAL-04 / D-08: as OWNER, PUT up -> down -> null round-trips through the DURABLE readout
    — the rating is written, re-ratable (the toggle updates the ONE row), and clearable."""
    from app.main import app

    result_id = str(uuid4())
    run_id = str(uuid4())
    sb = _FilterSupabase(_seed_run_with_result(result_id, run_id))

    _override(app, user=OWNER, supabase=sb)
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            # PUT up -> 200; the durable readout now shows 'up'.
            up = await c.put(
                f"/skills/{SKILL_ID}/evals/results/{result_id}/rating",
                json={"rating": "up"}, headers={"Authorization": "Bearer test"},
            )
            assert up.status_code == 200, f"PUT up {up.status_code}: {up.text}"
            assert up.json()["rating"] == "up"
            assert await _readout_rating(c, run_id, result_id) == "up"

            # PUT down -> re-rate TOGGLES to 'down' via upsert on the UNIQUE constraint.
            down = await c.put(
                f"/skills/{SKILL_ID}/evals/results/{result_id}/rating",
                json={"rating": "down"}, headers={"Authorization": "Bearer test"},
            )
            assert down.status_code == 200, f"PUT down {down.status_code}: {down.text}"
            assert await _readout_rating(c, run_id, result_id) == "down"
            # Exactly ONE row for (user, result) — the toggle updated, did NOT append a duplicate.
            assert len(sb.store.get("eval_ratings", [])) == 1, "re-rate must not duplicate the row"

            # PUT null -> clears (DELETE); the readout rating is None again.
            clear = await c.put(
                f"/skills/{SKILL_ID}/evals/results/{result_id}/rating",
                json={"rating": None}, headers={"Authorization": "Bearer test"},
            )
            assert clear.status_code == 200, f"PUT null {clear.status_code}: {clear.text}"
            assert clear.json()["rating"] is None
            assert await _readout_rating(c, run_id, result_id) is None
            assert sb.store.get("eval_ratings", []) == [], "clear must DELETE the rating row"
    finally:
        _clear_overrides(app)


@pytest.mark.asyncio
async def test_rating_cross_user_404():
    """EVAL-04 / T-134-01 (IDOR): OTHER_USER rating OWNER's eval_results id -> 404 (never 403),
    and NO eval_ratings row is written for OTHER_USER — the owner-verify gate is load-bearing."""
    from app.main import app

    result_id = str(uuid4())
    run_id = str(uuid4())
    # The result belongs to OWNER; OTHER_USER owns nothing here.
    sb = _FilterSupabase(_seed_run_with_result(result_id, run_id))

    _override(app, user=OTHER_USER, supabase=sb)
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.put(
                f"/skills/{SKILL_ID}/evals/results/{result_id}/rating",
                json={"rating": "up"}, headers={"Authorization": "Bearer test"},
            )
    finally:
        _clear_overrides(app)

    assert resp.status_code == 404, f"cross-user PUT expected 404; got {resp.status_code} body={resp.text}"
    # The IDOR gate blocked the write — no rating row was persisted at all (least of all OTHER_USER's).
    ratings = sb.store.get("eval_ratings", [])
    assert not any(r.get("user_id") == OTHER_USER["id"] for r in ratings), \
        "cross-user rating must NOT be written (T-134-01)"
    assert ratings == [], "no eval_ratings row should exist on the 404 path"


# ═══════════════════════════════════════════════════════════════════════════════════
# Phase 137.1 Plan 04 (EVAL-05) — matrix fan-out + engine smoke sweep + engine-health.
#
# These tests drive the Plan-04 route functions DIRECTLY (no httpx / no live DB / no live LLM /
# no real asyncio spawn) over the in-memory ``_FilterSupabase`` fake (the ``test_skill_proposals``
# precedent). The per-arm ``_spawn_eval_job`` seam (anchor thread + companion runs row + ZADD +
# ``run_eval_job`` task) is patched to an ``AsyncMock`` so the route's OWN ``eval_runs`` inserts
# (matrix_group_id + feeds_gate; skill-less NULL FKs) are the MEANINGFUL assertion surface, while
# the launch machinery itself is exercised by ``test_skill_proposals`` + live UAT. ``load_user_settings``
# is patched to a controlled fake so the configured-provider fan-out is deterministic.
# ═══════════════════════════════════════════════════════════════════════════════════


class _FakeRedis:
    """A minimal async redis fake: dict-backed ``SET NX`` (records every call so the ONE-claim +
    value==group_id assertion is meaningful) + best-effort zadd/get/eval/zrem/expire/xadd no-ops."""

    def __init__(self):
        self.store = {}
        self.set_calls = []

    async def set(self, key, value, nx=False, ex=None):
        self.set_calls.append((key, value, nx, ex))
        if nx and key in self.store:
            return None
        self.store[key] = value
        return True

    async def get(self, key):
        return self.store.get(key)

    async def zadd(self, *a, **k):
        return 1

    async def zrem(self, *a, **k):
        return 1

    async def eval(self, *a, **k):
        return 0

    async def expire(self, *a, **k):
        return 1

    async def xadd(self, *a, **k):
        return "1-1"


def _fake_settings():
    """A controlled effective-settings stand-in: three CONFIGURED native providers (anthropic active +
    openai + google) each with a registry model, plus an UNCONFIGURED ollama (empty api_key — must be
    skipped). ``_configured_provider_configs`` reads only ``providers`` / ``active_provider`` /
    ``llm_model``, so a SimpleNamespace suffices (no full UserEffectiveSettings)."""
    return SimpleNamespace(
        active_provider="anthropic",
        llm_model="claude-haiku-4-5-20251001",
        providers=[
            SimpleNamespace(id="anthropic", api_key="sk-ant-xxx", models=["claude-haiku-4-5-20251001"]),
            SimpleNamespace(id="openai", api_key="sk-xxx", models=["gpt-4o"]),
            SimpleNamespace(id="google", api_key="AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", models=["gemini-2.5-flash"]),
            SimpleNamespace(id="ollama", api_key="", models=["llama3"]),  # unconfigured -> skipped
        ],
    )


def _matrix_store(skill_id):
    """An owner-owned skill + its latest version + one test case — the fan-out corpus. eval_runs /
    eval_results start empty so the matrix inserts are the assertion surface."""
    version_id = str(uuid4())
    return {
        "skills": [{"id": skill_id, "name": "pdf-builder", "description": "d", "user_id": OWNER["id"]}],
        "skill_versions": [{
            "id": version_id, "skill_id": skill_id, "user_id": OWNER["id"],
            "version_number": 1, "name": "pdf-builder", "description": "d",
        }],
        "skill_test_cases": [{
            "id": str(uuid4()), "skill_id": skill_id, "user_id": OWNER["id"],
            "prompt": "Make a PDF", "expected_behavior": "makes a pdf", "order_index": 0,
        }],
        "eval_runs": [],
        "eval_results": [],
    }


def _patch_matrix(monkeypatch, evals):
    """Patch the async ``_spawn_eval_job`` seam (return a non-Task so no coordinator/real spawn runs)
    + ``load_user_settings`` (the 3-configured-provider fake). Returns the spawn AsyncMock."""
    spawn = AsyncMock(return_value=object())
    monkeypatch.setattr(evals, "_spawn_eval_job", spawn)
    monkeypatch.setattr(
        "app.models.user_settings.load_user_settings", lambda uid, *a, **k: _fake_settings()
    )
    return spawn


@pytest.mark.asyncio
async def test_matrix_launch_one_group_one_feeds_gate(monkeypatch):
    """D-05/D-06: one matrix launch fans N arms sharing ONE matrix_group_id under ONE SET NX claim
    (value == group_id), with EXACTLY ONE feeds_gate=true (the active provider by default)."""
    from app.api import evals

    skill_id = str(uuid4())
    store = _matrix_store(skill_id)
    sb = _FilterSupabase(store)
    redis = _FakeRedis()
    spawn = _patch_matrix(monkeypatch, evals)

    resp = await evals.start_matrix_run(
        skill_id, evals.MatrixRunBody(),
        current_user=OWNER, supabase=sb, redis=redis, pool=object(),
    )

    group_id = resp["matrix_group_id"]
    # The claim was taken ONCE, keyed by skill_id, with value == group_id (D-06 / Pitfall 1).
    assert len(redis.set_calls) == 1, "the group claim must be taken exactly once"
    key, value, nx, _ex = redis.set_calls[0]
    assert key == f"eval_inflight:{skill_id}" and value == group_id and nx is True

    # N eval_runs rows, all sharing the ONE group, with EXACTLY ONE feeds_gate=true.
    runs = store["eval_runs"]
    assert len(runs) == 3, "one arm per configured provider (ollama unconfigured -> skipped)"
    assert all(r["matrix_group_id"] == group_id for r in runs)
    assert sum(1 for r in runs if r["feeds_gate"]) == 1, "exactly one gate-feeder (D-05)"
    gate_run = next(r for r in runs if r["feeds_gate"])
    assert gate_run["provider"] == "anthropic", "default gate-feeder = the active provider"
    # N arms spawned via the shared companion machinery; the kickoff echoes them.
    assert spawn.await_count == 3
    assert len(resp["arms"]) == 3
    assert {a["provider"] for a in resp["arms"]} == {"anthropic", "openai", "google"}


@pytest.mark.asyncio
async def test_matrix_second_launch_409(monkeypatch):
    """D-06: a second matrix launch on the SAME skill while the first is live returns 409 (the ONE
    SET NX claim is held — the group coordinator only releases it after ALL arms finish)."""
    from app.api import evals

    skill_id = str(uuid4())
    sb = _FilterSupabase(_matrix_store(skill_id))
    redis = _FakeRedis()
    _patch_matrix(monkeypatch, evals)

    await evals.start_matrix_run(
        skill_id, evals.MatrixRunBody(),
        current_user=OWNER, supabase=sb, redis=redis, pool=object(),
    )
    with pytest.raises(HTTPException) as exc:
        await evals.start_matrix_run(
            skill_id, evals.MatrixRunBody(),
            current_user=OWNER, supabase=sb, redis=redis, pool=object(),
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_matrix_gate_feeder_run_only():
    """D-05 / 137 D-03: the gate reads ONLY the feeds_gate=true run of the group — the other N−1
    analysis-only arms never feed it (the gate-feeder is a LABEL on the flag, not a 2nd computation)."""
    from app.api import evals

    skill_id = str(uuid4())
    group_id = str(uuid4())
    feeder_id = str(uuid4())
    runs = [
        {"id": feeder_id, "skill_id": skill_id, "user_id": OWNER["id"], "provider": "anthropic",
         "model": "m1", "matrix_group_id": group_id, "feeds_gate": True, "status": "completed"},
        {"id": str(uuid4()), "skill_id": skill_id, "user_id": OWNER["id"], "provider": "openai",
         "model": "m2", "matrix_group_id": group_id, "feeds_gate": False, "status": "completed"},
        {"id": str(uuid4()), "skill_id": skill_id, "user_id": OWNER["id"], "provider": "google",
         "model": "m3", "matrix_group_id": group_id, "feeds_gate": False, "status": "completed"},
    ]
    sb = _FilterSupabase({"eval_runs": runs})

    feeder = await evals.matrix_gate_feeder_run(sb, matrix_group_id=group_id, user_id=OWNER["id"])
    assert feeder is not None
    assert feeder["feeds_gate"] is True
    assert feeder["id"] == feeder_id and feeder["provider"] == "anthropic"

    # Cross-user cannot read the group's gate-feeder (owner-scoped).
    assert await evals.matrix_gate_feeder_run(
        sb, matrix_group_id=group_id, user_id=OTHER_USER["id"]
    ) is None


@pytest.mark.asyncio
async def test_matrix_cross_user_404(monkeypatch):
    """T-133-01: a cross-user matrix launch 404s on the owner gate BEFORE any claim/spawn/insert."""
    from app.api import evals

    skill_id = str(uuid4())
    store = _matrix_store(skill_id)  # owned by OWNER
    sb = _FilterSupabase(store)
    redis = _FakeRedis()
    _patch_matrix(monkeypatch, evals)

    with pytest.raises(HTTPException) as exc:
        await evals.start_matrix_run(
            skill_id, evals.MatrixRunBody(),
            current_user=OTHER_USER, supabase=sb, redis=redis, pool=object(),
        )
    assert exc.value.status_code == 404
    assert store["eval_runs"] == [], "nothing spawned on the 404 path"
    assert redis.set_calls == [], "no claim taken on the 404 path (owner gate is first)"


# ── Task 2: engine smoke sweep — in-memory synthetic fixture over the matrix (D-01/D-02) ──


def _empty_skill_store():
    """An EMPTY skills/versions/cases world — proves the sweep synthesizes its fixture IN-MEMORY and
    creates NO seeded rows (D-02)."""
    return {
        "skills": [], "skill_versions": [], "skill_test_cases": [],
        "eval_runs": [], "eval_results": [],
    }


@pytest.mark.asyncio
async def test_engine_sweep_persists_skill_less(monkeypatch):
    """D-01/D-02: the sweep fans one arm per configured provider over a BUILT-IN in-memory fixture —
    creating NO rows in skills / skill_versions / skill_test_cases; each eval_runs arm persists with
    NULL skill_id / skill_version_id + matrix_group_id set + feeds_gate=false, owner-stamped from
    current_user; the runner gets the SMOKE fixture via its EXISTING skill_version/cases params."""
    from app.api import evals

    store = _empty_skill_store()
    sb = _FilterSupabase(store)
    redis = _FakeRedis()
    spawn = AsyncMock(return_value=object())
    monkeypatch.setattr(evals, "_spawn_eval_job", spawn)
    monkeypatch.setattr(
        "app.models.user_settings.load_user_settings", lambda uid, *a, **k: _fake_settings()
    )

    board = await evals.run_engine_sweep(
        current_user=OWNER, supabase=sb, redis=redis, pool=object()
    )

    # NO seeded rows anywhere (in-memory fixture — D-02).
    assert store["skills"] == [] and store["skill_versions"] == [] and store["skill_test_cases"] == []
    # One skill-less arm per configured provider (ollama unconfigured -> skipped).
    runs = store["eval_runs"]
    assert len(runs) == 3
    assert all(r["skill_id"] is None and r["skill_version_id"] is None for r in runs)
    assert all(r["matrix_group_id"] for r in runs) and all(r["feeds_gate"] is False for r in runs)
    assert all(r["user_id"] == OWNER["id"] for r in runs)  # owner-stamped from current_user (T-133-03)
    assert len({r["matrix_group_id"] for r in runs}) == 1, "one shared sweep group"
    # Per-USER skill-less sweep claim (never a per-skill 409 collateral — D-06 preserved).
    assert len(redis.set_calls) == 1
    key, value, nx, _ex = redis.set_calls[0]
    assert key == f"eval_inflight:engine-sweep:{OWNER['id']}" and nx is True
    assert value == runs[0]["matrix_group_id"]
    # The runner got the SMOKE fixture via its EXISTING skill_version/cases params (no signature change).
    assert spawn.await_count == 3
    kw = spawn.await_args.kwargs
    assert kw["skill_id"] == f"engine-sweep:{OWNER['id']}"  # synthetic job key, not a real skill id
    assert kw["skill_version"]["name"] == "engine-smoke"
    assert len(kw["cases"]) == 1 and kw["cases"][0]["id"] is None  # NULL test_case_id persistence (D-02)
    # The sweep returns the engine-health board shape.
    assert set(board) == {"tiles", "swept_at"}
    assert len(board["tiles"]) == 3


@pytest.mark.asyncio
async def test_engine_sweep_no_skill_view_leak(monkeypatch):
    """D-02: sweep rows (skill_id IS NULL) never appear in a skill-scoped Studio run-history read
    (``.eq("skill_id", …)`` excludes NULL-skill rows by construction) — no RunHistory pollution."""
    from app.api import evals

    real_skill = str(uuid4())
    store = _empty_skill_store()
    store["skills"] = [{"id": real_skill, "name": "s", "description": "d", "user_id": OWNER["id"]}]
    sb = _FilterSupabase(store)
    redis = _FakeRedis()
    monkeypatch.setattr(evals, "_spawn_eval_job", AsyncMock(return_value=object()))
    monkeypatch.setattr(
        "app.models.user_settings.load_user_settings", lambda uid, *a, **k: _fake_settings()
    )

    await evals.run_engine_sweep(current_user=OWNER, supabase=sb, redis=redis, pool=object())
    assert len(store["eval_runs"]) == 3  # skill-less sweep rows exist

    # The skill-scoped run-list read for a REAL owned skill returns NONE of the sweep rows.
    skill_runs = await evals.list_eval_runs(real_skill, current_user=OWNER, supabase=sb)
    assert skill_runs == [], "NULL-skill sweep rows must not leak into a skill's run history"
