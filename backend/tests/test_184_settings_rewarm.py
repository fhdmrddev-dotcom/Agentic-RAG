"""Phase 184 verification (UAT-found) — a settings WRITE must be visible to the SYNC reader.

WHY THIS FILE EXISTS. During the Phase 184 live UAT the operator kill-switch was flipped
OFF in the Control Room and did not take effect: ``PUT /admin/visibility`` returned 204,
``app_settings.feature_visibility`` held ``{"audience": "off"}`` in Postgres, the Control
Room radio showed Off — and ``GET /features`` kept answering ``visual_workflow_canvas:
true`` for minutes, with the Builder still rendering the Spine/Canvas tablist after a hard
reload. Falsified live: a single unrelated ``GET /me/preferences`` (the only thing about it
that matters is that it awaits ``load_app_settings_async``) flipped the answer to ``false``
immediately, with no code change and no restart.

THE DEFECT. ``invalidate_settings_cache()`` zeroes ``_settings_cache_time`` but never clears
``_settings_cache``. Two readers, only one honors that contract:

  * ASYNC ``_load_settings_from_db()`` checks the timestamp -> correctly refetches;
  * SYNC ``load_app_settings()`` reads ``_settings_cache`` DIRECTLY, with no staleness
    check at all -> keeps serving the pre-write row indefinitely.

``GET /features`` resolves through ``feature_audience`` -> ``_feature_record`` ->
``load_app_settings()`` — the SYNC path — so invalidation is a no-op for it. The write lands
in the DB and is then simply never observed. The same applies to every sync reader of
``load_app_settings()`` (tool_dispatcher, documents, extraction_service, admin) and to
``save_app_settings``, which uses the identical invalidate-only contract.

Phase 149 already met this and worked around it in ONE place (admin.py's disable-path guard:
``invalidate_settings_cache(); await _load_settings_from_db()``). These tests pin that idiom
as the CONTRACT of the write seams rather than a local patch.

WHAT IS PINNED — one sentence: **after a settings write returns, a SYNC read observes it.**

FALSIFICATION (both tests fail on the pre-fix code):
  - test_visibility_write_is_visible_to_sync_reader -> "everyone" (the stale pre-write value)
  - test_app_settings_write_is_visible_to_sync_reader -> the stale pre-write model id

These are unit tests: the asyncpg pool is a fake that models the row, so no DB is required.
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


class _FakePool:
    """An asyncpg-pool stand-in that MODELS THE ROW, so a write is observable by a re-read.

    ``execute`` applies the write to ``self.row`` (crudely, but faithfully enough for the
    one column each test touches), and ``fetchrow`` returns the current row. That is what
    makes this a real test of the re-warm: a fix that re-reads sees the new value, and a
    fix that merely zeroes a timestamp does not.
    """

    def __init__(self, row: dict):
        self.row = dict(row)
        self.executes: list[tuple] = []

    async def execute(self, sql: str, *args):
        self.executes.append((sql, args))
        if "feature_visibility" in sql:
            # set_feature_visibility passes the {feature: record} dict as $1 (JSONB || merge)
            merge = args[0]
            fv = dict(self.row.get("feature_visibility") or {})
            fv.update(merge)
            self.row["feature_visibility"] = fv
        else:
            # save_app_settings builds "SET col = $1, ... WHERE id = $N"; the trailing arg
            # is the id, the leading args are the values in column order.
            cols = [
                seg.strip().split(" = ")[0]
                for seg in sql.split("SET ", 1)[1].split(" WHERE ")[0].split(", ")
                if " = $" in seg
            ]
            for col, val in zip(cols, args):
                if col != "updated_at":
                    self.row[col] = val

    async def fetchrow(self, _sql: str):
        return dict(self.row)


def _install(monkeypatch, pool: _FakePool) -> None:
    """Point the function-local ``from app.dependencies import get_pg_pool`` at the fake."""

    async def _get_pool():
        return pool

    monkeypatch.setattr("app.dependencies.get_pg_pool", _get_pool)


def _warm(us, row: dict) -> None:
    """Put the module in the exact state the live bug needed: a WARM, fresh-looking cache."""
    us._settings_cache = dict(row)
    us._settings_cache_time = time.time()


@pytest.mark.asyncio
async def test_visibility_write_is_visible_to_sync_reader(monkeypatch):
    """After set_feature_visibility returns, feature_audience (SYNC) reports the NEW audience.

    This is the operator kill-switch defect exactly: flipping the canvas off must be
    observable to the reader that GET /features actually uses.
    """
    from app.models import user_settings as us

    stored = {"feature_visibility": {"visual_workflow_canvas": {"audience": "everyone"}}}
    pool = _FakePool(stored)
    _install(monkeypatch, pool)
    _warm(us, stored)

    # Precondition: the warm cache reports the pre-flip audience (proves the test starts
    # from the state the bug needs, not from a cold cache that would pass trivially).
    assert us.feature_audience("visual_workflow_canvas") == "everyone"

    await us.set_feature_visibility("visual_workflow_canvas", "off")

    assert pool.executes, "the write must still reach the DB"
    assert us.feature_audience("visual_workflow_canvas") == "off", (
        "a settings WRITE must be visible to the SYNC reader the moment it returns — "
        "GET /features resolves through load_app_settings(), which never checks the "
        "cache timestamp that invalidate_settings_cache() zeroes"
    )


@pytest.mark.asyncio
async def test_visibility_write_back_on_is_also_visible(monkeypatch):
    """The re-warm holds in BOTH directions — off -> everyone, not just everyone -> off.

    A fix that special-cased the off value (or that only ever cleared the key) would pass
    the first test and fail this one.
    """
    from app.models import user_settings as us

    stored = {"feature_visibility": {"visual_workflow_canvas": {"audience": "off"}}}
    pool = _FakePool(stored)
    _install(monkeypatch, pool)
    _warm(us, stored)

    assert us.feature_audience("visual_workflow_canvas") == "off"

    await us.set_feature_visibility("visual_workflow_canvas", "everyone")

    assert us.feature_audience("visual_workflow_canvas") == "everyone"


@pytest.mark.asyncio
async def test_app_settings_write_is_visible_to_sync_reader(monkeypatch):
    """The SAME contract for save_app_settings — the defect is not specific to visibility.

    save_app_settings carries the identical invalidate-only contract, and load_app_settings()
    is read by tool_dispatcher, documents and extraction_service, so a stale write here is
    a wrong MODEL, not just a wrong flag.
    """
    from app.models import user_settings as us

    stored = {"llm_model": "model-before", "feature_visibility": {}}
    pool = _FakePool(stored)
    _install(monkeypatch, pool)
    _warm(us, stored)

    assert us.load_app_settings().llm_model == "model-before"

    ok = await us.save_app_settings({"llm_model": "model-after"})

    assert ok is True
    assert us.load_app_settings().llm_model == "model-after", (
        "save_app_settings must leave the sync cache holding what it just wrote"
    )


@pytest.mark.asyncio
async def test_rewarm_failure_does_not_break_the_write(monkeypatch):
    """A re-warm that CANNOT read the DB must not turn a successful write into an error.

    The write is the contract; the re-warm is an optimization on top of it. If the refresh
    read blows up (pool exhausted, transient blip), set_feature_visibility must still report
    success — the next async read repairs the cache via the existing TTL.
    """
    from app.models import user_settings as us

    stored = {"feature_visibility": {"visual_workflow_canvas": {"audience": "everyone"}}}
    pool = _FakePool(stored)

    async def _boom(_sql: str):
        raise RuntimeError("transient read failure during re-warm")

    pool.fetchrow = _boom  # type: ignore[assignment]
    _install(monkeypatch, pool)
    _warm(us, stored)

    assert await us.set_feature_visibility("visual_workflow_canvas", "off") is True
    assert pool.executes, "the UPDATE must still have been issued"
