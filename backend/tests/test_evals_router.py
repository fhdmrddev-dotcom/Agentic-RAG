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
from uuid import uuid4

import httpx
import pytest
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
