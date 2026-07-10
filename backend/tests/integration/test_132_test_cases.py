"""Phase 132 Plan 02 (EVAL-01 / VER-01) — eval test-case CRUD + version-history route tests.

Proves the six load-bearing behaviors of the owner-scoped router
(``backend/app/api/skill_test_cases.py``):

  1. POST a test case → 201, returns a TestCaseResponse; a subsequent GET returns it
     (persistence across requests).
  2. GET list is ordered by ``order_index`` ascending, owner-scoped.
  3. PATCH editing ``prompt`` persists (and ``updated_at`` advances); only supplied fields change.
  4. DELETE removes the row (gone on the next GET).
  5. GET versions is ordered by ``version_number`` DESC, owner-scoped (read-only).
  6. ``test_owner_scope_isolation`` — user B can NEVER read/edit/delete user A's cases or read
     A's versions (the load-bearing leak-safety assertion — T-132-06/07/08). 404/empty, never
     A's data.

No live DB / no provider call: a small in-memory fake supabase backs the
``skills`` / ``skill_test_cases`` / ``skill_versions`` tables and honors the chained
``.eq()`` filters so the app-code ``.eq("user_id", …)`` owner gate is GENUINELY exercised
(a service-role client bypasses RLS — this app-code filter is the only runtime gate).
"""
import itertools
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
import pytest
from httpx import ASGITransport

# Import the module under test FIRST — a missing module is an unambiguous RED (the route
# does not exist yet), distinct from a route returning the wrong status.
from app.api import skill_test_cases  # noqa: F401
from app.dependencies import get_current_user, get_supabase
from app.main import app

OWNER = {"id": "00000000-0000-0000-0000-000000000001", "email": "owner@example.com"}
OTHER_USER = {"id": "00000000-0000-0000-0000-000000000099", "email": "other@example.com"}


# ── A monotonic clock so ``updated_at`` strictly advances on every write ──────────
_BASE = datetime(2026, 6, 30, tzinfo=timezone.utc)
_clock = itertools.count(1)


def _now() -> str:
    return (_BASE + timedelta(seconds=next(_clock))).isoformat()


# ── A tiny in-memory fake supabase honoring the chained query surface the router uses ──
class _Result:
    def __init__(self, data):
        self.data = data
        self.count = len(data) if isinstance(data, list) else None


class _Tbl:
    """One table's chainable query builder, backed by a shared list of row dicts. Honors the
    ``.eq()`` filters (so the owner gate is real), ``.order()``, and insert/update/delete."""

    def __init__(self, rows: list):
        self.rows = rows
        self._op = "select"
        self._filters: list[tuple[str, str]] = []
        self._payload = None
        self._order = None

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

    def delete(self, *a, **k):
        self._op = "delete"
        return self

    def eq(self, col, val):
        self._filters.append((col, str(val)))
        return self

    def or_(self, *a, **k):
        return self

    def order(self, col, desc=False, **k):
        self._order = (col, desc)
        return self

    def limit(self, *a, **k):
        return self

    def _match(self, row) -> bool:
        return all(str(row.get(c)) == v for c, v in self._filters)

    def execute(self):
        if self._op == "insert":
            row = dict(self._payload)
            row.setdefault("id", str(uuid4()))
            row.setdefault("expected_behavior", "")
            row.setdefault("order_index", 0)
            row.setdefault("name", None)
            row["created_at"] = _now()
            row["updated_at"] = _now()
            self.rows.append(row)
            return _Result([dict(row)])

        matched = [r for r in self.rows if self._match(r)]
        if self._op == "select":
            out = [dict(r) for r in matched]
            if self._order:
                col, desc = self._order
                out.sort(key=lambda r: r.get(col), reverse=desc)
            return _Result(out)
        if self._op == "update":
            for r in matched:
                r.update(self._payload)
                r["updated_at"] = _now()
            return _Result([dict(r) for r in matched])
        if self._op == "delete":
            for r in matched:
                self.rows.remove(r)
            return _Result([dict(r) for r in matched])
        return _Result([])


class _FakeSupabase:
    def __init__(self, stores: dict):
        self.stores = stores

    def table(self, name):
        return _Tbl(self.stores.setdefault(name, []))


def _skill_row(skill_id, owner_id=OWNER["id"]):
    return {
        "id": skill_id,
        "user_id": owner_id,
        "name": "Risk Register",
        "description": "Fill a risk register.",
        "instructions": "",
        "is_enabled": True,
        "is_global": False,
        "created_at": _now(),
        "updated_at": _now(),
    }


def _version_row(skill_id, n, owner_id=OWNER["id"]):
    return {
        "id": str(uuid4()),
        "skill_id": skill_id,
        "user_id": owner_id,
        "version_number": n,
        "name": "Risk Register",
        "description": f"v{n}",
        "instructions": "",
        "source": "manual" if n > 1 else "backfill",
        "created_at": _now(),
    }


def _client():
    return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _override(user, supabase):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: supabase


def _clear_overrides():
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_supabase, None)


_AUTH = {"Authorization": "Bearer test-token"}


# ── 1 + 2. Create persists across requests; list is order_index ascending ────────
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_create_persists_and_list_ordered():
    skill_id = str(uuid4())
    sb = _FakeSupabase({"skills": [_skill_row(skill_id)], "skill_test_cases": []})
    _override(OWNER, sb)
    try:
        async with _client() as c:
            r2 = await c.post(f"/skills/{skill_id}/test-cases",
                              json={"prompt": "second", "order_index": 2}, headers=_AUTH)
            r1 = await c.post(f"/skills/{skill_id}/test-cases",
                              json={"prompt": "first", "order_index": 1}, headers=_AUTH)
            assert r2.status_code == 201, r2.text
            assert r1.status_code == 201, r1.text
            created = r1.json()
            assert created["prompt"] == "first"
            assert created["user_id"] == OWNER["id"]
            assert created["skill_id"] == skill_id

            listed = await c.get(f"/skills/{skill_id}/test-cases", headers=_AUTH)
            assert listed.status_code == 200, listed.text
            rows = listed.json()
            # Persisted across requests + ordered by order_index ascending.
            assert [r["prompt"] for r in rows] == ["first", "second"]
    finally:
        _clear_overrides()


# ── 3. PATCH edits the prompt; only-supplied fields change; updated_at advances ───
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_patch_persists_supplied_fields_only():
    skill_id = str(uuid4())
    sb = _FakeSupabase({"skills": [_skill_row(skill_id)], "skill_test_cases": []})
    _override(OWNER, sb)
    try:
        async with _client() as c:
            created = (await c.post(f"/skills/{skill_id}/test-cases",
                                    json={"prompt": "orig", "expected_behavior": "be helpful",
                                          "order_index": 0}, headers=_AUTH)).json()
            case_id = created["id"]
            patched = await c.patch(f"/test-cases/{case_id}",
                                    json={"prompt": "edited"}, headers=_AUTH)
            assert patched.status_code == 200, patched.text
            body = patched.json()
            assert body["prompt"] == "edited"
            # only-supplied: expected_behavior untouched
            assert body["expected_behavior"] == "be helpful"
            # updated_at advanced
            assert body["updated_at"] > created["updated_at"]

            # survives a re-fetch
            rows = (await c.get(f"/skills/{skill_id}/test-cases", headers=_AUTH)).json()
            assert rows[0]["prompt"] == "edited"
    finally:
        _clear_overrides()


# ── 4. DELETE removes the row ────────────────────────────────────────────────────
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_delete_removes_row():
    skill_id = str(uuid4())
    sb = _FakeSupabase({"skills": [_skill_row(skill_id)], "skill_test_cases": []})
    _override(OWNER, sb)
    try:
        async with _client() as c:
            case_id = (await c.post(f"/skills/{skill_id}/test-cases",
                                    json={"prompt": "doomed"}, headers=_AUTH)).json()["id"]
            d = await c.delete(f"/test-cases/{case_id}", headers=_AUTH)
            assert d.status_code == 204, d.text
            rows = (await c.get(f"/skills/{skill_id}/test-cases", headers=_AUTH)).json()
            assert rows == []
    finally:
        _clear_overrides()


# ── 5. GET versions — version_number DESC, read-only, owner-scoped ───────────────
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_list_versions_desc():
    skill_id = str(uuid4())
    sb = _FakeSupabase({
        "skills": [_skill_row(skill_id)],
        "skill_versions": [_version_row(skill_id, 1), _version_row(skill_id, 2), _version_row(skill_id, 3)],
    })
    _override(OWNER, sb)
    try:
        async with _client() as c:
            resp = await c.get(f"/skills/{skill_id}/versions", headers=_AUTH)
            assert resp.status_code == 200, resp.text
            nums = [v["version_number"] for v in resp.json()]
            assert nums == [3, 2, 1], f"expected DESC; got {nums}"
    finally:
        _clear_overrides()


# ── 6. Owner-scope isolation — the load-bearing leak-safety assertion ────────────
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_owner_scope_isolation():
    skill_id = str(uuid4())
    sb = _FakeSupabase({
        "skills": [_skill_row(skill_id, owner_id=OWNER["id"])],
        "skill_test_cases": [],
        "skill_versions": [_version_row(skill_id, 1), _version_row(skill_id, 2)],
    })

    # User A creates a case.
    _override(OWNER, sb)
    try:
        async with _client() as c:
            a_case_id = (await c.post(f"/skills/{skill_id}/test-cases",
                                      json={"prompt": "A's secret case"}, headers=_AUTH)).json()["id"]
    finally:
        _clear_overrides()

    # User B must NEVER see/edit/delete A's case or read A's versions.
    _override(OTHER_USER, sb)
    try:
        async with _client() as c:
            # list → empty (never A's data)
            b_list = await c.get(f"/skills/{skill_id}/test-cases", headers=_AUTH)
            assert b_list.status_code == 200
            assert b_list.json() == []

            # PATCH A's case → 404
            b_patch = await c.patch(f"/test-cases/{a_case_id}",
                                    json={"prompt": "hijack"}, headers=_AUTH)
            assert b_patch.status_code == 404, b_patch.text

            # DELETE A's case → 404
            b_del = await c.delete(f"/test-cases/{a_case_id}", headers=_AUTH)
            assert b_del.status_code == 404, b_del.text

            # versions → empty (D-12 / T-132-08: author-private)
            b_ver = await c.get(f"/skills/{skill_id}/versions", headers=_AUTH)
            assert b_ver.status_code == 200
            assert b_ver.json() == []

            # POST to A's private skill → 404 (parent-skill owner gate)
            b_post = await c.post(f"/skills/{skill_id}/test-cases",
                                  json={"prompt": "intrude"}, headers=_AUTH)
            assert b_post.status_code == 404, b_post.text
    finally:
        _clear_overrides()

    # A's case is still intact + unchanged (B's hijack never landed).
    _override(OWNER, sb)
    try:
        async with _client() as c:
            rows = (await c.get(f"/skills/{skill_id}/test-cases", headers=_AUTH)).json()
            assert len(rows) == 1
            assert rows[0]["prompt"] == "A's secret case"
    finally:
        _clear_overrides()
