"""Phase 158 Plan 07 (SC#3 / D-03) — the setup-mode-tolerant lifespan (behavioral).

Wave 1 replaces the 158-01 Nyquist source-string scaffold with the full BEHAVIORAL proof
(monkeypatch the file marker + spy the guarded seams while the REAL lifespan runs):

  - setup mode  (``setup_finalized()`` -> False): the lifespan does NOT await
    ``assert_action_types_synced`` (the ONE un-guarded DB hard-fail, main.py:357), does NOT
    spawn the four background reconcilers, and announces the setup token ONCE (D-15).
  - configured mode (``setup_finalized()`` -> True): it STILL awaits the audit-enum drift
    guard AND spawns all four reconcilers — byte-identical to the pre-158 boot.

RESEARCH Pattern 3 verified line-by-line that 357 is the ONLY crash path; every other startup
step is already best-effort try/except. The behavioral run neutralizes the external I/O seams
(get_pg_pool / get_redis) so the lifespan runs OFFLINE, and counts reconciler spawns by
intercepting ``asyncio.create_task`` — the coroutines are CLOSED, never executed, so a
while-True reconciler can never hang the test.
"""
from unittest.mock import AsyncMock, MagicMock

import app.main as main_mod
import app.services.setup_store as setup_store


def test_setup_store_marker_available_for_boot_guard():
    """SC#3/D-03: the lifespan computes ``_setup_mode`` from the file marker
    (``setup_store.setup_finalized`` — a cheap file read, no DB, blip-proof)."""
    assert getattr(setup_store, "setup_finalized", None) is not None
    assert callable(setup_store.setup_finalized)


async def _run_lifespan_capture(monkeypatch, *, finalized: bool) -> dict:
    """Run the REAL app lifespan with the file marker forced to ``finalized`` and every
    external I/O seam neutralized; return counts of the three observable behaviors.

      - ``audit``    -> how many times ``assert_action_types_synced`` was awaited
      - ``spawns``   -> how many ``asyncio.create_task`` reconciler spawns fired
      - ``announce`` -> how many times the setup token was announced
    """
    calls = {"audit": 0, "spawns": 0, "announce": 0}

    # 1. The FILE marker => controls `_setup_mode = not setup_finalized()`.
    monkeypatch.setattr(setup_store, "setup_finalized", lambda: finalized)

    def _spy_announce() -> None:
        calls["announce"] += 1

    monkeypatch.setattr(setup_store, "announce_token_if_unfinalized", _spy_announce)

    # 2. Spy the ONE un-guarded DB hard-fail (main.py:357).
    async def _spy_audit(pool) -> None:
        calls["audit"] += 1

    monkeypatch.setattr(
        "app.services.audit_service.assert_action_types_synced", _spy_audit
    )

    # 3. Neutralize external I/O so the lifespan runs OFFLINE. Best-effort startup blocks
    #    stay best-effort (their try/except swallows the MagicMock-pool mismatch); the ONE
    #    un-guarded audit call is the spy above. Skip the cipher sweep entirely for a quiet log.
    monkeypatch.setattr(main_mod, "_validate_and_report_cipher", lambda: None)
    monkeypatch.setattr("app.dependencies.get_pg_pool", AsyncMock(return_value=MagicMock()))
    _redis = MagicMock()
    _redis.ping = AsyncMock(return_value=True)
    _redis.aclose = AsyncMock(return_value=None)
    monkeypatch.setattr("app.dependencies.get_redis", lambda: _redis)
    monkeypatch.setattr(
        "app.services.ask_user_service.broadcast_shutdown_sentinel_to_all",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        "app.services.harness_engine.set_app_shutting_down", lambda *a, **k: None
    )

    # 4. Count reconciler spawns WITHOUT running them (close the coro so a while-True
    #    reconciler can never hang the test, and no 'never awaited' warning fires).
    def _counting_create_task(coro, *a, **k):
        calls["spawns"] += 1
        coro.close()
        return MagicMock()

    monkeypatch.setattr(main_mod.asyncio, "create_task", _counting_create_task)

    async with main_mod.lifespan(main_mod.app):
        pass

    return calls


async def test_setup_mode_defers_audit_guard_and_reconcilers(monkeypatch):
    """SC#3/D-03 (the boot-tolerant proof): in setup mode the lifespan does NOT await the
    audit-enum drift guard and does NOT spawn the four reconcilers — a fresh/unbound box boots
    into setup mode instead of crash-looping (Pitfall 3) — and announces the token once (D-15)."""
    calls = await _run_lifespan_capture(monkeypatch, finalized=False)
    assert calls["audit"] == 0, "assert_action_types_synced MUST be deferred in setup mode"
    assert calls["spawns"] == 0, "the four reconcilers MUST NOT spawn on an unbound box"
    assert calls["announce"] == 1, "the setup token MUST be announced exactly once (D-15)"


async def test_configured_mode_runs_audit_guard_and_reconcilers(monkeypatch):
    """SC#3/D-03 (byte-identical): a FINALIZED box STILL awaits the audit-enum drift guard AND
    spawns all four reconcilers — the loud drift guard (Phase 110 DMF-01) is only DEFERRED in
    setup mode, never removed — and the token is NOT announced on a configured box."""
    calls = await _run_lifespan_capture(monkeypatch, finalized=True)
    assert calls["audit"] == 1, "configured mode MUST still run the audit-enum drift guard"
    assert calls["spawns"] == 4, "configured mode MUST spawn all four background reconcilers"
    assert calls["announce"] == 0, "a finalized box announces no setup token"
