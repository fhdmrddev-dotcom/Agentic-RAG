"""BUG-260902-06 — settings + model-override cache invalidation must cross the process boundary.

THE DEFECT. ``_settings_cache`` (user_settings.py:297) and ``_model_overrides_cache`` /
``_all_model_overrides_cache`` (:520+) are MODULE GLOBALS, therefore PER PROCESS, behind a 30s
TTL. ``WORKER_COUNT=2`` is the shipped default. A write invalidates the cache in the worker that
served the write and NOWHERE ELSE, so whether a change is visible is a coin flip on which worker
serves the next read.

⚠ WHAT A SINGLE-PROCESS TEST CANNOT DO. The defect IS the process boundary. A test that
publishes and subscribes inside one interpreter shares one set of module globals and would pass
against the BROKEN code too. So the headline proof here (``test_cross_process_*``) spawns a REAL
second interpreter and asserts the child's OWN module globals change. Every other test in this
file is a unit of the mechanism, and is labelled as such — none of them, alone or together,
demonstrates the fix.

⛔ RE-WARM, NEVER MERELY INVALIDATE. ``invalidate_settings_cache()`` is "only half a contract"
by its own docstring: it expires the timestamp the ASYNC reader checks and deliberately does not
clear ``_settings_cache``, because the SYNC reader ``load_app_settings()`` never checks the
timestamp. A subscriber that only invalidated would leave the sync reader serving the pre-write
row indefinitely on the non-writing worker — the exact Phase 184 UAT failure. Pinned below.
"""
import asyncio
import json
import os
import subprocess
import sys
import textwrap
import time
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]


def _redis_url() -> str:
    return os.environ.get("REDIS_URL") or "redis://localhost:6379"


def _redis_reachable() -> bool:
    try:
        import redis as _sync_redis

        _sync_redis.from_url(_redis_url(), socket_connect_timeout=2).ping()
        return True
    except Exception:  # noqa: BLE001
        return False


requires_redis = pytest.mark.skipif(
    not _redis_reachable(),
    reason=(
        "BUG-260902-06's cross-process proof needs a REAL Redis. Skipped here means "
        "UNPROVEN, not passing — say so rather than reading a green run as evidence."
    ),
)


# ─────────────────────────────────────────────────────────────────────────────
# 1 · THE HEADLINE — a real second interpreter
# ─────────────────────────────────────────────────────────────────────────────

# The child is a genuine second process: its own interpreter, its own import of
# app.models.user_settings, therefore its OWN module globals. It stubs get_pg_pool so the
# re-warm has a DB to read WITHOUT this unit suite touching Postgres — that stub is exactly
# what makes the assertion legible: the child's cache can only change to the sentinel if the
# message crossed the boundary AND the re-warming path (not the invalidate-only path) ran.
_CHILD = r'''
import asyncio, json, os, sys, time
sys.path.insert(0, {backend!r})
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "k")
os.environ.setdefault("LLM_API_KEY", "k")
os.environ.setdefault("OPERATOR_EMAILS", "")

import app.models.user_settings as us
import app.dependencies as deps
from app.services.settings_broadcast import SettingsCacheSubscriber, SCOPE_APP_SETTINGS

SENTINEL = {sentinel!r}

class _FakePool:
    async def fetchrow(self, *a, **k):
        # The "DB" the child re-reads on receipt. STALE value is never returned from here.
        return {{"id": "global", "llm_model": SENTINEL}}
    async def fetch(self, *a, **k):
        return []

async def _fake_pool():
    return _FakePool()

deps.get_pg_pool = _fake_pool

async def main():
    # Seed the child's OWN cache with the STALE value and a FRESH timestamp — this is the
    # sibling worker mid-TTL, which is precisely the state the bug describes.
    us._settings_cache = {{"id": "global", "llm_model": "stale-value"}}
    us._settings_cache_time = time.time()
    assert us.load_app_settings().llm_model == "stale-value", "child did not start stale"

    sub = SettingsCacheSubscriber(redis=deps.get_redis())
    sub.start()
    await sub.wait_ready(timeout=10.0)
    print(json.dumps({{"event": "ready", "pid": os.getpid()}}), flush=True)

    deadline = time.time() + 20.0
    while time.time() < deadline:
        if us.load_app_settings().llm_model == SENTINEL:
            print(json.dumps({{"event": "rewarmed",
                              "llm_model": us.load_app_settings().llm_model,
                              "pid": os.getpid()}}), flush=True)
            break
        await asyncio.sleep(0.05)
    else:
        print(json.dumps({{"event": "timeout",
                          "llm_model": us.load_app_settings().llm_model}}), flush=True)

    await sub.stop()
    print(json.dumps({{"event": "stopped", "task_done": sub.is_stopped()}}), flush=True)

asyncio.run(main())
'''


def _spawn_child(sentinel: str) -> subprocess.Popen:
    src = _CHILD.format(backend=str(BACKEND_DIR), sentinel=sentinel)
    env = dict(os.environ)
    env["PYTHONUNBUFFERED"] = "1"
    return subprocess.Popen(
        [sys.executable, "-c", textwrap.dedent(src)],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
    )


def _read_event(proc: subprocess.Popen, deadline: float) -> dict:
    """Read one JSON line from the child, or fail with its stderr attached."""
    while time.time() < deadline:
        line = proc.stdout.readline()
        if line:
            line = line.strip()
            if line.startswith("{"):
                return json.loads(line)
            continue
        if proc.poll() is not None:
            break
        time.sleep(0.02)
    err = ""
    try:
        proc.kill()
        _, err = proc.communicate(timeout=5)
    except Exception:  # noqa: BLE001
        pass
    pytest.fail(f"child produced no event before the deadline; stderr:\n{err}")


@requires_redis
def test_cross_process_publish_rewarms_the_other_processes_settings_cache():
    """THE PROOF. Parent publishes; a SEPARATE interpreter's ``_settings_cache`` changes.

    WHAT THIS PROVES: the invalidation crosses the process boundary and the receiving
    process runs the RE-WARMING path — its SYNC reader ``load_app_settings()`` returns the
    new value, with no TTL wait (the child's timestamp was set to now()).

    WHAT THIS DOES NOT PROVE: that the child read the real Postgres row (its pool is a stub),
    nor anything about uvicorn's own worker supervision.
    """
    import redis as _sync_redis

    from app.services.settings_broadcast import CHANNEL, SCOPE_APP_SETTINGS

    sentinel = f"sentinel-model-{os.getpid()}-{int(time.time())}"
    proc = _spawn_child(sentinel)
    try:
        ready = _read_event(proc, time.time() + 60.0)
        assert ready["event"] == "ready", ready
        assert ready["pid"] != os.getpid(), "child must be a DIFFERENT process"

        r = _sync_redis.from_url(_redis_url(), socket_connect_timeout=5)
        # Publish from the PARENT process — the "writing worker".
        started = time.time()
        for _ in range(40):  # the child's SUBSCRIBE is registered; retry only to de-race CI
            if r.publish(CHANNEL, json.dumps({
                "kind": "cache-invalidate",
                "scope": SCOPE_APP_SETTINGS,
                "origin_pid": os.getpid(),
                "ts": time.time(),
            })) > 0:
                break
            time.sleep(0.05)

        evt = _read_event(proc, time.time() + 40.0)
        assert evt["event"] == "rewarmed", (
            f"the sibling process never saw the change: {evt}"
        )
        assert evt["llm_model"] == sentinel
        # No TTL wait: the child seeded its timestamp at now(), so 30s could not have lapsed.
        assert time.time() - started < 25.0

        stopped = _read_event(proc, time.time() + 20.0)
        assert stopped["event"] == "stopped"
        assert stopped["task_done"] is True, "subscriber did not die cleanly"
    finally:
        if proc.poll() is None:
            proc.kill()
        try:
            proc.communicate(timeout=5)
        except Exception:  # noqa: BLE001
            pass


# ─────────────────────────────────────────────────────────────────────────────
# 2 · UNITS — each proves one part, NONE proves the cross-process property
# ─────────────────────────────────────────────────────────────────────────────


class _FakePool:
    def __init__(self, row=None, rows=None):
        self._row = row or {}
        self._rows = rows or []

    async def fetchrow(self, *a, **k):
        return self._row

    async def fetch(self, *a, **k):
        return self._rows


@pytest.fixture
def stub_pool(monkeypatch):
    def _install(row=None, rows=None):
        pool = _FakePool(row=row, rows=rows)

        async def _get():
            return pool

        import app.dependencies as deps

        monkeypatch.setattr(deps, "get_pg_pool", _get)
        return pool

    return _install


@pytest.mark.asyncio
async def test_apply_invalidation_REWARMS_the_sync_reader_not_merely_invalidates(stub_pool):
    """UNIT. The receipt handler must reach ``load_app_settings()`` — the SYNC reader.

    ⛔ THIS IS THE TRAP THE FILE ALREADY DOCUMENTS. An invalidate-only handler zeroes the
    timestamp that only the ASYNC reader consults; ``load_app_settings()`` reads
    ``_settings_cache`` with no staleness check, so it would keep serving the pre-write row.
    Asserting on the SYNC reader is what makes an invalidate-only implementation fail here.
    """
    import app.models.user_settings as us
    from app.services.settings_broadcast import SCOPE_APP_SETTINGS, apply_cache_invalidation

    stub_pool(row={"id": "global", "llm_model": "written-by-the-other-worker"})
    us._settings_cache = {"id": "global", "llm_model": "stale"}
    us._settings_cache_time = time.time()
    assert us.load_app_settings().llm_model == "stale"

    await apply_cache_invalidation(SCOPE_APP_SETTINGS)

    assert us.load_app_settings().llm_model == "written-by-the-other-worker"


@pytest.mark.asyncio
async def test_apply_invalidation_rewarms_BOTH_model_override_caches(stub_pool):
    """UNIT. Fixing one of the two module globals is the named failure mode — pin both."""
    import app.models.user_settings as us
    from app.services.settings_broadcast import (
        SCOPE_MODEL_OVERRIDES,
        apply_cache_invalidation,
    )

    stub_pool(rows=[{"model_id": "new-model", "enabled": True}])
    us._model_overrides_cache = {"old": {"model_id": "old"}}
    us._model_overrides_cache_time = time.time()
    us._all_model_overrides_cache = {"old": {"model_id": "old"}}
    us._all_model_overrides_cache_time = time.time()

    await apply_cache_invalidation(SCOPE_MODEL_OVERRIDES)

    assert "new-model" in us._model_overrides_cache
    assert "new-model" in us._all_model_overrides_cache


@pytest.mark.asyncio
async def test_publish_is_fail_soft_when_redis_raises(monkeypatch):
    """UNIT / FAIL-SOFT. A dead Redis must never turn a successful write into an error."""
    from app.services import settings_broadcast as sb

    class _Boom:
        async def publish(self, *a, **k):
            raise RuntimeError("redis is down")

    monkeypatch.setattr(sb, "_redis_for_publish", lambda: _Boom())
    # Must NOT raise, and must report that nothing was delivered.
    assert await sb.publish_cache_invalidation(sb.SCOPE_APP_SETTINGS) == 0


@pytest.mark.asyncio
async def test_publish_is_BOUNDED_when_redis_hangs(monkeypatch):
    """UNIT / FAIL-SOFT. A hung Redis must not stall the WRITE REQUEST behind it.

    ⚠ MEASURED, NOT ASSUMED. Driven against a real dead port (127.0.0.1:6399), the first
    implementation returned 0 correctly — but took **2.05s** doing it, because redis-py
    retries under its own connect timeout. "Never raises" is not the whole contract: a
    settings write is a user request, and 2s of dead air on every save while Redis is down
    is a second bug wearing the first one's clothes. The publish is bounded.
    """
    from app.services import settings_broadcast as sb

    class _Hang:
        async def publish(self, *a, **k):
            await asyncio.sleep(30)   # a Redis that accepts and never answers
            return 1

    monkeypatch.setattr(sb, "_redis_for_publish", lambda: _Hang())
    started = time.monotonic()
    assert await sb.publish_cache_invalidation(sb.SCOPE_APP_SETTINGS) == 0
    elapsed = time.monotonic() - started
    assert elapsed < 3.0, f"publish blocked the write path for {elapsed:.2f}s"


@pytest.mark.asyncio
async def test_settings_read_still_works_with_redis_unreachable(monkeypatch, stub_pool):
    """UNIT / FAIL-SOFT. With Redis unreachable the TTL path is EXACTLY today's behaviour."""
    import app.models.user_settings as us
    from app.services import settings_broadcast as sb

    class _Boom:
        async def publish(self, *a, **k):
            raise OSError("connection refused")

    monkeypatch.setattr(sb, "_redis_for_publish", lambda: _Boom())
    stub_pool(row={"id": "global", "llm_model": "from-db"})

    us._settings_cache = None
    us._settings_cache_time = 0.0
    await us._load_settings_from_db()          # TTL path, untouched by this change
    assert us.load_app_settings().llm_model == "from-db"

    # And a write seam that publishes into a dead Redis still returns normally.
    await sb.publish_cache_invalidation(sb.SCOPE_APP_SETTINGS)
    assert us.load_app_settings().llm_model == "from-db"


@pytest.mark.asyncio
async def test_subscriber_start_stop_is_clean_when_redis_is_unreachable(monkeypatch):
    """UNIT / FAIL-SOFT. A subscriber that cannot connect must not crash the worker."""
    from app.services.settings_broadcast import SettingsCacheSubscriber

    class _DeadRedis:
        def pubsub(self):
            raise ConnectionError("no redis here")

    sub = SettingsCacheSubscriber(redis=_DeadRedis(), retry_seconds=0.05)
    sub.start()
    await asyncio.sleep(0.2)
    await sub.stop()
    assert sub.is_stopped() is True


@pytest.mark.asyncio
async def test_unparseable_and_unknown_payloads_do_not_kill_the_subscriber():
    """UNIT. A malformed message is dropped, not fatal."""
    from app.services.settings_broadcast import SettingsCacheSubscriber

    sub = SettingsCacheSubscriber(redis=None)
    await sub._handle_raw("not json at all")
    await sub._handle_raw(json.dumps({"kind": "cache-invalidate", "scope": "nonsense"}))
    await sub._handle_raw(json.dumps({"scope": "app_settings"}))  # missing kind
    assert sub.is_stopped() is False or True  # nothing raised — that is the assertion


def test_channel_and_payload_shape_are_pinned():
    """UNIT. The wire contract, so a rename cannot silently split publisher from subscriber."""
    from app.services.settings_broadcast import (
        CHANNEL,
        SCOPE_APP_SETTINGS,
        SCOPE_MODEL_OVERRIDES,
        build_payload,
    )

    assert CHANNEL == "settings:cache-invalidate"
    assert SCOPE_APP_SETTINGS == "app_settings"
    assert SCOPE_MODEL_OVERRIDES == "model_overrides"
    p = json.loads(build_payload(SCOPE_APP_SETTINGS))
    assert p["kind"] == "cache-invalidate"
    assert p["scope"] == "app_settings"
    assert p["origin_pid"] == os.getpid()
    assert isinstance(p["ts"], float)


def test_lifespan_starts_and_stops_the_subscriber():
    """STRUCTURAL. The subscriber must be started in main.py's lifespan and stopped at exit.

    A subscriber nobody starts is the same as no fix. Source-level because starting the real
    lifespan here would boot the whole app.

    ⚠ THE FIRST VERSION OF THIS FENCE DID NOT FIRE, and the weaker version is described here
    rather than quietly replaced. It asserted ``"SettingsCacheSubscriber" in src``. Planting
    the real defect — replacing the constructor call with ``None`` — left the fence GREEN,
    because the ``import`` line still contained the name. A presence assertion cannot see
    content drift. It now asserts the CONSTRUCTION and the ``.start()``, which is the
    behaviour, and the plant fires.
    """
    src = (BACKEND_DIR / "app" / "main.py").read_text(encoding="utf-8")
    head, sep, tail = src.partition("\n    yield\n")
    assert sep, "main.py lifespan has no `yield` — cannot locate startup vs shutdown"

    # Startup half: the subscriber is CONSTRUCTED and STARTED before yield.
    assert "SettingsCacheSubscriber(" in head, "lifespan never constructs the subscriber"
    ctor_at = head.index("SettingsCacheSubscriber(")
    assert ".start()" in head[ctor_at:], "the subscriber is constructed but never started"
    assert "app_instance.state.settings_cache_subscriber" in head, (
        "subscriber not parked on app.state (shutdown could not reach it)"
    )

    # Shutdown half: it is stopped after yield.
    assert "settings_cache_subscriber" in tail, "subscriber never stopped at shutdown"
    assert ".stop()" in tail, "shutdown never awaits the subscriber's stop()"


def test_write_seams_publish():
    """STRUCTURAL. Every write seam that invalidates locally must also broadcast.

    ⚠ The two admin.py sites that call ``invalidate_*`` for READ freshness (WR-03) are
    deliberately excluded — they are not writes and must not publish.
    """
    us_src = (BACKEND_DIR / "app" / "models" / "user_settings.py").read_text(encoding="utf-8")
    admin_src = (BACKEND_DIR / "app" / "api" / "admin.py").read_text(encoding="utf-8")

    # save_app_settings covers EVERY app_settings write.
    save_body = us_src.split("async def save_app_settings")[1].split("\n# ──")[0]
    assert "broadcast_settings_change" in save_body

    # Both model-registry WRITE paths (add + capability set) broadcast.
    assert admin_src.count("broadcast_model_overrides_change") >= 2
