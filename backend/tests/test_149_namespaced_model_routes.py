"""Phase 149 Plan 08 Task 2 (D-149-14 / MODEL-01 / MODEL-02) — namespaced OpenRouter IDs route.

The UAT Test-4 failure: all 9 OpenRouter rows (``vendor/model`` ids like ``deepseek/deepseek-chat``)
404'd on every write. Uvicorn ASGI-decodes ``%2F``→``/`` before Starlette routing, so a
single-segment ``{model_id}`` path param never matched a slash-containing id → FastAPI 404.

The fix is the Starlette ``{model_id:path}`` converter on the PATCH capability write + the PUT
lock routes (the trailing ``/lock`` literal still anchors the PUT route). These tests drive the
routing through the real FastAPI app with a LITERAL slash in the path — exactly the post-uvicorn
state Starlette routes on — so a single-segment route 404s (RED) and the ``:path`` route matches
with the slash intact (GREEN). ``operator_override`` bypasses the 146 gate; the persistence layer
is mocked so the assertion is on ROUTING + the intact ``model_id``, not on a live DB write.
"""
import app.api.admin as admin_mod
import app.dependencies as deps
from unittest.mock import AsyncMock

_NAMESPACED = "deepseek/deepseek-chat"


class _RecordingPool:
    """asyncpg-pool stand-in recording every ``execute(sql, *args)`` — ``args[0]`` is the
    ``model_id`` the upsert received, so we can assert the slash survived routing."""

    def __init__(self):
        self.calls = []

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "INSERT 0 1"


# ── PATCH /admin/models/{model_id:path} ────────────────────────────────────────

def test_patch_namespaced_id_routes(client, operator_override, monkeypatch):
    """PATCH a namespaced id (literal-slash path) routes to set_model_capability — NOT 404 —
    and the upsert receives ``model_id == "deepseek/deepseek-chat"`` (slash intact)."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    monkeypatch.setattr(admin_mod, "invalidate_model_overrides_cache", lambda: None)

    res = client.patch(f"/admin/models/{_NAMESPACED}", json={"max_output_tokens": 8192})

    assert res.status_code != 404, "namespaced PATCH must route (the UAT Test-4 404 is gone)"
    assert res.status_code == 200
    assert len(pool.calls) == 1, "the write must reach the parameterized upsert"
    assert pool.calls[0][1][0] == _NAMESPACED, "the slash must survive into the upsert model_id"


def test_discovery_confirm_namespaced_write(client, operator_override, monkeypatch):
    """A namespaced DB-only model NOT in MODEL_CAPABILITIES (a discovery-confirmed new model)
    writes via PATCH — the discovery-confirm write path (MODEL-02)."""
    new_id = "vendorx/brand-new-model"
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    monkeypatch.setattr(admin_mod, "invalidate_model_overrides_cache", lambda: None)

    res = client.patch(f"/admin/models/{new_id}", json={"native_tools": True, "max_output_tokens": 4096})

    assert res.status_code == 200, "a discovery-confirmed namespaced model must write, not 404"
    assert len(pool.calls) == 1
    assert pool.calls[0][1][0] == new_id, "the DB-only model_id must reach the upsert intact"


def test_single_segment_id_unregressed(client, operator_override, monkeypatch):
    """A plain single-segment id (gpt-4o) still routes on PATCH — the converter change must not
    break non-namespaced ids."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    monkeypatch.setattr(admin_mod, "invalidate_model_overrides_cache", lambda: None)

    res = client.patch("/admin/models/gpt-4o", json={"max_output_tokens": 8192})

    assert res.status_code == 200
    assert pool.calls and pool.calls[0][1][0] == "gpt-4o"


# ── PUT /admin/models/{model_id:path}/lock ─────────────────────────────────────

def test_lock_namespaced_id_routes(client, operator_override, monkeypatch):
    """PUT .../lock on a namespaced id routes to set_model_lock — NOT 404 — with the slash
    intact (the trailing ``/lock`` literal anchors the ``:path`` converter, so model_id does
    NOT swallow ``/lock``)."""
    async def _no_overrides():
        return {}  # no override row → the namespaced model is enabled → lock proceeds

    monkeypatch.setattr("app.models.user_settings.load_all_model_overrides", _no_overrides)
    monkeypatch.setattr("app.models.user_settings.invalidate_model_overrides_cache", lambda: None)
    fake_save = AsyncMock(return_value=True)
    monkeypatch.setattr(admin_mod, "save_app_settings", fake_save)

    res = client.put(f"/admin/models/{_NAMESPACED}/lock", json={"locked": True})

    assert res.status_code != 404, "namespaced PUT .../lock must route (Test-4 / Test-5 leg)"
    assert res.status_code == 204
    fake_save.assert_awaited_once_with({"llm_model": _NAMESPACED, "llm_model_locked": True})


# ── WR-04 (review round 2): the `:path` converter matches the EMPTY string ─────
# The old single-segment `{model_id}` regex (`[^/]+`) made an empty id structurally
# impossible; `:path` (`.*`) does not. Without the handler guard, PATCH /admin/models/
# upserts a phantom model_id="" row and PUT /admin/models//lock BLANKS + LOCKS the org
# default (app_settings.llm_model=""). Both must 422 before any write.

def test_patch_empty_model_id_is_422(client, operator_override, monkeypatch):
    """PATCH /admin/models/ (empty model_id via the `:path` converter) → 422, and the
    upsert is never reached (no phantom model_id='' registry row)."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    monkeypatch.setattr(admin_mod, "invalidate_model_overrides_cache", lambda: None)

    res = client.patch("/admin/models/", json={"max_output_tokens": 8192})

    assert res.status_code == 422, "an empty model_id must be refused, never upserted"
    assert pool.calls == [], "the guard must fire BEFORE any DB touch"


def test_patch_whitespace_model_id_is_422(client, operator_override, monkeypatch):
    """PATCH /admin/models/%20 (whitespace-only id) → 422 — same guard, same reason."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    monkeypatch.setattr(admin_mod, "invalidate_model_overrides_cache", lambda: None)

    res = client.patch("/admin/models/%20", json={"max_output_tokens": 8192})

    assert res.status_code == 422
    assert pool.calls == []


def test_lock_empty_model_id_is_422(client, operator_override, monkeypatch):
    """PUT /admin/models//lock (empty model_id) → 422 BEFORE any write — the org default
    must never be blanked + locked by a buggy client call."""
    fake_save = AsyncMock(return_value=True)
    monkeypatch.setattr(admin_mod, "save_app_settings", fake_save)

    res = client.put("/admin/models//lock", json={"locked": True})

    assert res.status_code == 422, "an empty model_id lock must be refused"
    fake_save.assert_not_awaited()  # llm_model='' + llm_model_locked=true never written
