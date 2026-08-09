"""Phase 184 security audit (T-184-UAT-02) — the kill switch must not be enforced stale.

WHY THIS FILE EXISTS. ``test_184_settings_rewarm.py`` (its sibling) pins the WRITING worker:
after ``set_feature_visibility`` returns, that worker's sync reader observes the new audience.
Its own docblock is explicit that this is "NOT a cross-process fix". The Phase 184 security
audit measured what that leaves behind, and it is wider than a TTL:

  * ``load_app_settings()`` (the SYNC reader) checks **no timestamp at all**;
  * ``_SETTINGS_CACHE_TTL = 30.0`` is honored ONLY by the async ``_load_settings_from_db``.

So on a worker that did NOT service the operator's write, nothing expires the sync view. It
keeps serving the pre-flip audience until some *unrelated* request on that worker happens to
await the async loader — in a busy app ~30 s, but with **no code-level bound**. Under the
project default ``WORKER_COUNT=2`` that is one of two workers. The reader in question is what
``CanvasGateMiddleware`` and ``require_canvas`` enforce ``visual_workflow_canvas`` with, i.e.
the master off-switch for the whole canvas surface (REVERT-01 / D-181-01), and what
``GET /features`` answers the UI with.

WHAT IS PINNED — one sentence: **a gated read never resolves the flag from a cache older than
the TTL, and pays no DB call when it is younger.**

Both halves matter. Dropping the second would put a per-request DB call on the flag path and
break D-v2.5-01; dropping the first is the defect itself.

FALSIFICATION (each test fails on the pre-fix code):
  - test_expired_cache_is_refreshed_before_the_gate_reads_it -> "everyone" (the stale value)
  - test_gated_paths_bound_the_flag / test_features_bounds_the_flag /
    test_require_canvas_bounds_the_flag -> 0 refreshes (no call site existed)
  - test_warm_cache_costs_no_db_read guards the OPPOSITE mistake and fails if a future
    "fix" drops the TTL check and reads the DB on every request.

Unit tests: the asyncpg pool is a fake that models the row, so no DB is required.
"""
import time

import pytest


@pytest.fixture(autouse=True)
def _restore_settings_cache():
    """Save/restore the module-level cache globals so these tests cannot poison others."""
    from app.models import user_settings as us

    before_cache, before_time = us._settings_cache, us._settings_cache_time
    yield
    us._settings_cache, us._settings_cache_time = before_cache, before_time


class _CountingPool:
    """An asyncpg-pool stand-in that COUNTS reads, so "no DB I/O when warm" is measurable."""

    def __init__(self, row: dict):
        self.row = dict(row)
        self.fetchrow_calls = 0

    async def fetchrow(self, _sql: str):
        self.fetchrow_calls += 1
        return dict(self.row)


def _install(monkeypatch, pool) -> None:
    """Point the function-local ``from app.dependencies import get_pg_pool`` at the fake."""

    async def _get_pool():
        return pool

    monkeypatch.setattr("app.dependencies.get_pg_pool", _get_pool)


def _warm(us, row: dict, age: float) -> None:
    """Seat a cache of a chosen AGE — the whole point is that age is what must matter."""
    us._settings_cache = dict(row)
    us._settings_cache_time = time.time() - age


_ON = {"feature_visibility": {"visual_workflow_canvas": {"audience": "everyone"}}}
_OFF = {"feature_visibility": {"visual_workflow_canvas": {"audience": "off"}}}


# ══ the contract itself ═══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_expired_cache_is_refreshed_before_the_gate_reads_it(monkeypatch):
    """THE defect. A worker holding a pre-flip cache must not keep enforcing it forever.

    Models the exact production shape: the operator flipped the canvas OFF on worker A, so
    the DB says "off"; worker B still holds the "everyone" row it read before the write. B
    never serviced that write, so nothing on B expires its sync view.
    """
    from app.models import user_settings as us

    pool = _CountingPool(_OFF)  # the DB has the POST-flip value
    _install(monkeypatch, pool)
    _warm(us, _ON, age=us._SETTINGS_CACHE_TTL + 5)  # this worker holds the PRE-flip value

    # Precondition: the stale cache reports the pre-flip audience — proves the test starts
    # from the state the bug needs, not from a cold cache that would pass trivially.
    assert us.feature_audience("visual_workflow_canvas") == "everyone"

    await us.ensure_settings_fresh()

    assert us.feature_audience("visual_workflow_canvas") == "off", (
        "a gated read must not resolve the kill switch from a cache older than the TTL — "
        "load_app_settings() checks no timestamp, so only an awaited refresh bounds it"
    )


@pytest.mark.asyncio
async def test_bound_holds_in_both_directions(monkeypatch):
    """off -> everyone too. A fix that only ever re-read on the way OFF would be half a fix."""
    from app.models import user_settings as us

    pool = _CountingPool(_ON)
    _install(monkeypatch, pool)
    _warm(us, _OFF, age=us._SETTINGS_CACHE_TTL + 5)

    assert us.feature_audience("visual_workflow_canvas") == "off"

    await us.ensure_settings_fresh()

    assert us.feature_audience("visual_workflow_canvas") == "everyone"


@pytest.mark.asyncio
async def test_warm_cache_costs_no_db_read(monkeypatch):
    """The OTHER half of the contract — D-v2.5-01's "no per-request DB call" is preserved.

    Guards the opposite over-correction: a "fix" that simply re-read the DB on every gated
    request would pass every test above and put a query on the canvas hot path. Because
    ``_load_settings_from_db`` is TTL-checked, a young cache must cost zero reads.
    """
    from app.models import user_settings as us

    pool = _CountingPool(_ON)
    _install(monkeypatch, pool)
    _warm(us, _ON, age=1.0)  # well inside the TTL

    await us.ensure_settings_fresh()
    await us.ensure_settings_fresh()
    await us.ensure_settings_fresh()

    assert pool.fetchrow_calls == 0, (
        "a warm cache must not touch the DB — three gated requests inside the TTL window "
        f"issued {pool.fetchrow_calls} read(s)"
    )


@pytest.mark.asyncio
async def test_refresh_failure_never_raises_and_leaves_the_cache_intact(monkeypatch):
    """A settings blip must degrade to the previous cache, never to a 500 on the gate.

    Downstream is fail-closed (``feature_audience`` -> hardcoded default -> "off" for the
    canvas), so the degraded direction is HIDE, never REVEAL (D-181-02).
    """
    from app.models import user_settings as us

    pool = _CountingPool(_OFF)

    async def _boom(_sql: str):
        raise RuntimeError("transient read failure during the gated refresh")

    pool.fetchrow = _boom  # type: ignore[assignment]
    _install(monkeypatch, pool)
    _warm(us, _ON, age=us._SETTINGS_CACHE_TTL + 5)

    await us.ensure_settings_fresh()  # must not raise

    assert us.feature_audience("visual_workflow_canvas") == "everyone", (
        "a failed refresh leaves the previous cache in place rather than blanking it"
    )


# ══ the three call sites — a contract with no caller is a comment ═════════════════

@pytest.fixture
def _refresh_spy(monkeypatch):
    """Count ``ensure_settings_fresh`` calls at BOTH bound names.

    ``canvas_gate`` and ``dependencies`` lazy-import inside the function (so patching the
    source module reaches them), while ``features`` imports at module scope (so it holds its
    own reference). Patching both is what makes this spy honest about all three sites.
    """
    calls: list[str] = []

    async def _spy():
        calls.append("x")

    monkeypatch.setattr("app.models.user_settings.ensure_settings_fresh", _spy)
    monkeypatch.setattr("app.api.features.ensure_settings_fresh", _spy)
    return calls


def test_gated_paths_bound_the_flag(client, _refresh_spy):
    """The middleware refreshes on a canvas path — and NOT on an ordinary one.

    The second half is load-bearing: it is what keeps the bounded cost off the hot path, so
    the fix cannot drift into a per-request query for the whole app.
    """
    client.post("/workflows/validate", json={})
    assert len(_refresh_spy) >= 1, "a canvas-gated path must bound the flag before reading it"

    before = len(_refresh_spy)
    client.get("/definitely-not-a-real-route-184")
    assert len(_refresh_spy) == before, (
        "an ordinary request must not pay for the refresh — D-v2.5-01 keeps the hot path "
        "free of per-request settings I/O"
    )


def test_schema_path_bounds_the_flag(client, _refresh_spy):
    """/openapi.json too — its filter hook is SYNC and cannot refresh for itself.

    The schema half hides the canvas paths while off (D-182-R2-02); resolving that from an
    unboundedly stale flag would publish a surface the request-path 404 is hiding.
    """
    before = len(_refresh_spy)
    client.get("/openapi.json")
    assert len(_refresh_spy) > before, "the schema half must bound the flag it filters on"


def test_features_bounds_the_flag(client, auth_headers, _refresh_spy):
    """GET /features — the endpoint the live UAT actually caught answering stale."""
    before = len(_refresh_spy)
    client.get("/features", headers=auth_headers)
    assert len(_refresh_spy) > before, (
        "GET /features resolves every audience through the sync reader; it is what the UI "
        "polls to learn whether a surface exists"
    )


@pytest.mark.asyncio
async def test_require_canvas_bounds_the_flag(monkeypatch):
    """The route-level gate refreshes BEFORE the flag decides, and still 404s while off.

    Called directly (``_dep`` declares ``request`` Optional for exactly this) so the
    middleware's own refresh cannot stand in for the dependency's.
    """
    from fastapi import HTTPException

    from app import dependencies as deps

    calls: list[str] = []

    async def _spy():
        calls.append("x")

    monkeypatch.setattr("app.models.user_settings.ensure_settings_fresh", _spy)
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda _f: "off")

    with pytest.raises(HTTPException) as exc:
        await deps.require_canvas()(request=None, credentials=None, supabase=None)

    assert exc.value.status_code == 404, "flag-off stays a 404 for every caller (D-181-01)"
    assert calls, "require_canvas must bound the flag before resolving the audience"
