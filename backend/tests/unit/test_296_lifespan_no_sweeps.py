"""Phase 296-02 (SEED-363 / 289-IN-08) — a test lifespan never claims a live run.

Measured three times in Phase 289 and twice in 295: any ``TestClient(app)`` (or
``app.router.lifespan_context``) entered the REAL lifespan, whose boot sweeps
(``resume_stranded_workflows`` and the orphan reconciler, boot + periodic) ran
against the shared local DB and claimed, re-drove or terminalized a developer's
live run from a process that was about to exit.

The fix is a MODULE flag, ``app.main.RUN_BOOT_SWEEPS``, which ``tests/conftest.py``
sets False in ``pytest_configure``. It is deliberately NOT an env var or a setting:
a new env var the app reads must reach the deploy artifacts in the same commit
(``scripts/check-deploy-drift.sh``), and nothing outside the test suite should be
able to turn the sweeps off.
"""

from __future__ import annotations

import asyncio
import re
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_MAIN = Path(__file__).resolve().parents[2] / "app" / "main.py"


def _sweep_patches():
    """Patch both sweep entry points plus the lifespan's DB touch points.

    The sweeps import their targets lazily inside their closures, so patching the
    module attribute is what they will call. ``get_pg_pool`` and the audit-drift
    guard are patched so the proof does not depend on the local stack being up.
    """
    resume = AsyncMock(return_value=0)
    reconcile = AsyncMock(return_value=0)
    fake_pool = MagicMock()
    return resume, reconcile, [
        patch("app.services.harness_engine.resume_stranded_workflows", resume),
        patch("app.services.run_reconciler.reconcile_orphaned_runs", reconcile),
        patch("app.dependencies.get_pg_pool", AsyncMock(return_value=fake_pool)),
        patch(
            "app.services.audit_service.assert_action_types_synced",
            AsyncMock(return_value=None),
        ),
    ]


async def _enter_lifespan_and_settle():
    from app.main import app

    resume, reconcile, patches = _sweep_patches()
    for p in patches:
        p.start()
    try:
        async with app.router.lifespan_context(app):
            # Let the background tasks the lifespan scheduled run their first step.
            for _ in range(20):
                await asyncio.sleep(0.01)
    finally:
        for p in reversed(patches):
            p.stop()
        # The lifespan's shutdown sets the process-wide "app shutting down" flag; leaving it set
        # makes every later test's producer escape skip its F2 terminalize (order-dependent reds
        # measured in the 296-02 gate run). Restore it.
        from app.services.harness_engine import set_app_shutting_down

        set_app_shutting_down(False)
    return resume, reconcile


def test_suite_default_is_off():
    """conftest.pytest_configure turns the sweeps off for the whole suite."""
    import app.main as main_mod

    assert main_mod.RUN_BOOT_SWEEPS is False


@pytest.mark.asyncio
async def test_lifespan_with_flag_off_starts_no_sweep():
    """With the suite default, neither sweep is ever awaited."""
    resume, reconcile = await _enter_lifespan_and_settle()

    assert resume.await_count == 0, "resume_stranded_workflows ran under a test lifespan"
    assert reconcile.await_count == 0, "reconcile_orphaned_runs ran under a test lifespan"


@pytest.mark.asyncio
async def test_lifespan_with_flag_on_starts_both_sweeps(monkeypatch):
    """Production default: the flag is True and both sweeps are scheduled."""
    import app.main as main_mod

    monkeypatch.setattr(main_mod, "RUN_BOOT_SWEEPS", True, raising=False)
    resume, reconcile = await _enter_lifespan_and_settle()

    assert resume.await_count >= 1
    assert reconcile.await_count >= 1


def test_flag_is_a_module_constant_not_an_env_var():
    """No env var and no setting gates the sweeps (Pitfall 5 — deploy drift)."""
    src = _MAIN.read_text(encoding="utf-8")
    assert re.search(r"^RUN_BOOT_SWEEPS\s*=\s*True\b", src, re.MULTILINE)
    for line in src.splitlines():
        if "RUN_BOOT_SWEEPS" in line:
            assert "environ" not in line and "getenv" not in line, line
            assert "settings." not in line, line


def test_router_import_line_has_its_space():
    """289-IN-08: the router import line is not missing a space after a comma."""
    src = _MAIN.read_text(encoding="utf-8")
    code = [ln for ln in src.splitlines() if not ln.lstrip().startswith("#")]
    assert not any("workflow_run_evidence,metadata_fields" in ln for ln in code)
