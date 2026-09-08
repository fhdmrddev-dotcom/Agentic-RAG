"""Cross-worker settings/model-registry cache invalidation over Redis pub/sub.

BUG-260902-06. ``user_settings.py`` holds three MODULE-GLOBAL caches behind a 30s TTL —
``_settings_cache`` (every value in ``app_settings``), ``_model_overrides_cache`` and
``_all_model_overrides_cache`` (the model registry). Module globals are PER PROCESS and
``WORKER_COUNT=2`` is the shipped default, so a write invalidates the cache in the worker
that served the write and NOWHERE ELSE. Whether a change is visible is a coin flip on which
worker serves the next read, bounded by the TTL.

THE MECHANISM. On a write, PUBLISH to one channel. Every worker runs a background subscriber
that, on receipt, RE-WARMS the affected cache.

⛔ RE-WARM, NEVER MERELY INVALIDATE. ``invalidate_settings_cache()`` says in its own docstring
that it is "only half a contract": it expires the timestamp the ASYNC reader checks and
deliberately does NOT clear ``_settings_cache``, because the SYNC reader ``load_app_settings()``
never checks the timestamp (blanking it would serve Pydantic DEFAULTS for every column).
``refresh_settings_cache()`` exists precisely because an invalidate-only call never reaches
that reader — it was added after a Phase 184 live UAT found a flip that landed in the DB and
was never observed. So the subscriber calls the RE-WARMING path, not the invalidator.

⛔ ``load_app_settings()`` STAYS SYNCHRONOUS AND DOES NO I/O. It cannot await Redis. That
constraint is why this is PUSH-based rather than a shared cache. Nothing here changes its
signature or gives it a network dependency.

⛔ FAIL SOFT, EVERYWHERE. Redis unavailable, subscriber dead, message lost, payload garbage —
the system degrades to EXACTLY today's behaviour (the 30s TTL). Nothing here may raise into a
settings read, a request, startup or shutdown. A settings read that raises because Redis
blipped would be a worse bug than the one this fixes.

Pattern follows ``ask_user_service.py`` (the working pub/sub precedent in this codebase):
SUBSCRIBE first, ``get_message(timeout=1.0)`` — never 0 (Pitfall 1), ``aclose()`` under a 2s
``wait_for`` (Pitfall 3), each cleanup step in its own try/except.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)

# ── The wire contract ────────────────────────────────────────────────────────
# One channel, not one per scope: the subscriber count stays at exactly one per worker
# whatever we add later, and a new scope needs no lifespan change.
CHANNEL = "settings:cache-invalidate"

KIND = "cache-invalidate"
SCOPE_APP_SETTINGS = "app_settings"
SCOPE_MODEL_OVERRIDES = "model_overrides"
SCOPE_ALL = "all"

_KNOWN_SCOPES = frozenset({SCOPE_APP_SETTINGS, SCOPE_MODEL_OVERRIDES, SCOPE_ALL})


def build_payload(scope: str) -> str:
    """The published JSON. ``origin_pid`` is DIAGNOSTIC ONLY — deliberately not filtered on.

    Filtering by pid would let a pid collision (containers restart; pids are reused) silently
    drop a real invalidation, and the re-warm is idempotent, so the writing worker doing one
    redundant re-read is the cheaper failure mode by a wide margin.
    """
    return json.dumps({
        "kind": KIND,
        "scope": scope,
        "origin_pid": os.getpid(),
        "ts": time.time(),
    })


def _redis_for_publish():
    """Seam for the publisher's client. Overridden in tests to prove the fail-soft arm."""
    from app.dependencies import get_redis

    return get_redis()


async def publish_cache_invalidation(scope: str) -> int:
    """Best-effort broadcast. NEVER raises; returns the subscriber count, 0 on any failure.

    0 means nothing was delivered and every other worker will fall back to its 30s TTL —
    i.e. exactly today's behaviour. That is the designed degradation, not an error.
    """
    if scope not in _KNOWN_SCOPES:
        logger.warning("settings_broadcast: refusing to publish unknown scope %r", scope)
        return 0
    try:
        redis = _redis_for_publish()
        count = await redis.publish(CHANNEL, build_payload(scope))
        return int(count or 0)
    except Exception:  # noqa: BLE001 — a Redis blip must never fail the write
        logger.warning(
            "settings_broadcast: publish failed for scope=%s; siblings fall back to the "
            "%s TTL", scope, "30s", exc_info=True,
        )
        return 0


async def apply_cache_invalidation(scope: str) -> None:
    """RE-WARM the named caches in THIS process. NEVER raises.

    ⛔ Re-warm, not invalidate. For ``app_settings`` that means ``refresh_settings_cache()``
    (expire → re-read → re-expire), which is the only path the SYNC reader observes. For the
    model registry it means invalidate-then-reload BOTH caches — fixing one of the two module
    globals with the identical defect is the named failure mode of this bug.
    """
    import app.models.user_settings as us

    try:
        if scope in (SCOPE_APP_SETTINGS, SCOPE_ALL):
            await us.refresh_settings_cache()
        if scope in (SCOPE_MODEL_OVERRIDES, SCOPE_ALL):
            us.invalidate_model_overrides_cache()
            await us._load_model_overrides()
            await us.load_all_model_overrides()
    except Exception:  # noqa: BLE001 — a failed re-warm degrades to the TTL, never crashes
        logger.warning(
            "settings_broadcast: re-warm failed for scope=%s; this worker falls back to "
            "its TTL", scope, exc_info=True,
        )


class SettingsCacheSubscriber:
    """One per worker. Subscribes to :data:`CHANNEL` and re-warms on receipt.

    LIFECYCLE. ``start()`` spawns a task and returns immediately (startup is never blocked on
    Redis). ``stop()`` sets the stop event, waits for the task with a deadline, and cancels it
    if it overruns — so shutdown cannot wedge on a half-dead Redis socket. Both are idempotent.

    FAILURE. Any Redis error reconnects after ``retry_seconds``; it never propagates. A worker
    whose subscriber can never connect behaves exactly as it does today.
    """

    def __init__(self, redis: Any, retry_seconds: float = 2.0) -> None:
        self._redis = redis
        self._retry_seconds = retry_seconds
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()
        self._ready = asyncio.Event()

    # ── control ──────────────────────────────────────────────────────────
    def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run(), name="settings-cache-subscriber")

    async def wait_ready(self, timeout: float = 10.0) -> bool:
        """True once a SUBSCRIBE is registered. Used by tests to de-race the first publish."""
        try:
            await asyncio.wait_for(self._ready.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False

    async def stop(self) -> None:
        self._stop.set()
        task, self._task = self._task, None
        if task is None:
            return
        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=5.0)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        except Exception:  # noqa: BLE001
            logger.warning("settings_broadcast: subscriber task ended badly", exc_info=True)

    def is_stopped(self) -> bool:
        return self._task is None or self._task.done()

    # ── the loop ─────────────────────────────────────────────────────────
    async def _run(self) -> None:
        while not self._stop.is_set():
            pubsub = None
            try:
                pubsub = self._redis.pubsub()
                await pubsub.subscribe(CHANNEL)          # SUBSCRIBE first
                self._ready.set()
                logger.info("settings_broadcast: subscribed to %s", CHANNEL)
                while not self._stop.is_set():
                    msg = await pubsub.get_message(
                        ignore_subscribe_messages=True,
                        timeout=1.0,                     # Pitfall 1 — never 0
                    )
                    if msg is not None and msg.get("type") == "message":
                        await self._handle_raw(msg.get("data"))
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 — reconnect; never propagate
                self._ready.clear()
                logger.warning(
                    "settings_broadcast: subscriber error; retrying in %.1fs "
                    "(this worker falls back to its TTL meanwhile)",
                    self._retry_seconds, exc_info=True,
                )
            finally:
                if pubsub is not None:
                    try:
                        await asyncio.wait_for(pubsub.aclose(), timeout=2.0)  # Pitfall 3
                    except Exception:  # noqa: BLE001
                        logger.debug("settings_broadcast: pubsub aclose failed", exc_info=True)
            if self._stop.is_set():
                break
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self._retry_seconds)
            except asyncio.TimeoutError:
                pass

    async def _handle_raw(self, data: Any) -> None:
        """Parse and dispatch one message. A malformed payload is DROPPED, never fatal."""
        try:
            payload = json.loads(data)
        except (TypeError, ValueError):
            logger.warning("settings_broadcast: unparseable payload on %s", CHANNEL)
            return
        if not isinstance(payload, dict) or payload.get("kind") != KIND:
            return
        scope = payload.get("scope")
        if scope not in _KNOWN_SCOPES:
            logger.warning("settings_broadcast: unknown scope %r — ignored", scope)
            return
        await apply_cache_invalidation(scope)
