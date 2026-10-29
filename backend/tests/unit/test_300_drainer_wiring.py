"""Phase 300-04 (D-20 / T-300-32) — the drainer runs in every worker, and never in a test.

``main.py``'s lifespan starts ``NotificationDrainer`` only under the boot-sweep gate
(``not _setup_mode and RUN_BOOT_SWEEPS``), parks it on ``app.state.notification_drainer`` and
stops it at shutdown. ``tests/conftest.py`` sets ``RUN_BOOT_SWEEPS = False``, so a test lifespan
never drains the shared local outbox. Both halves are checked: the source shape (comments
stripped, so a commented-out block cannot satisfy it), and a real lifespan with the flag off
(slot ``None``) and on (started, then stopped) — the ``test_296_lifespan_no_sweeps`` harness.
"""
from __future__ import annotations

import asyncio
import inspect
import io
import tokenize
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.main as main_mod


def _code_only(src: str) -> str:
    """The module source with every comment token removed."""
    toks = [t for t in tokenize.generate_tokens(io.StringIO(src).readline) if t.type != tokenize.COMMENT]
    return tokenize.untokenize(toks)


SRC = _code_only(inspect.getsource(main_mod))
LINES = SRC.splitlines()


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip())


def test_the_drainer_is_constructed_exactly_once():
    assert SRC.count("NotificationDrainer(") == 1


def test_the_drainer_is_built_only_inside_the_boot_sweep_gate():
    ctor = next(i for i, ln in enumerate(LINES) if "NotificationDrainer(" in ln)
    gate = max(i for i, ln in enumerate(LINES[:ctor])
               if ln.strip().startswith("if not _setup_mode and RUN_BOOT_SWEEPS:"))
    gate_indent = _indent(LINES[gate])
    for ln in LINES[gate + 1: ctor + 1]:
        if ln.strip():
            assert _indent(ln) > gate_indent, f"the drainer is constructed outside the gate: {ln!r}"


def test_the_drainer_is_parked_on_app_state_started_and_failure_tolerant():
    assert "app_instance.state.notification_drainer = _drainer" in SRC
    start = SRC.index("NotificationDrainer(")
    block = SRC[start: SRC.index("app_instance.state.notification_drainer = _drainer")]
    assert "_drainer.start()" in block
    assert "except Exception:" in block and "logger.exception(" in block, "a failed start logs and continues"


def test_shutdown_stops_the_drainer_inside_a_try():
    at = SRC.index('getattr(app_instance.state, "notification_drainer", None)')
    window = SRC[at - 120: at + 300]
    assert "await _nd.stop()" in window
    assert "try:" in window and "except Exception" in window


class _FakeDrainer:
    instances: list = []

    def __init__(self, pool, **kwargs):
        self.pool = pool
        self.started = 0
        self.stopped = 0
        _FakeDrainer.instances.append(self)

    def start(self):
        self.started += 1

    async def stop(self):
        self.stopped += 1


async def _lifespan_state():
    from app.main import app

    _FakeDrainer.instances = []
    patches = [
        patch("app.services.harness_engine.resume_stranded_workflows", AsyncMock(return_value=0)),
        patch("app.services.run_reconciler.reconcile_orphaned_runs", AsyncMock(return_value=0)),
        patch("app.dependencies.get_pg_pool", AsyncMock(return_value=MagicMock())),
        patch("app.services.audit_service.assert_action_types_synced", AsyncMock(return_value=None)),
        patch("app.services.notification_drainer.NotificationDrainer", _FakeDrainer),
    ]
    for p in patches:
        p.start()
    try:
        async with app.router.lifespan_context(app):
            for _ in range(5):
                await asyncio.sleep(0.01)
            during = getattr(app.state, "notification_drainer", "missing")
    finally:
        for p in reversed(patches):
            p.stop()
        from app.services.harness_engine import set_app_shutting_down

        set_app_shutting_down(False)
    return during


@pytest.mark.asyncio
async def test_a_test_lifespan_never_starts_the_drainer():
    assert main_mod.RUN_BOOT_SWEEPS is False, "conftest must have turned the boot sweeps off"
    during = await _lifespan_state()
    assert during is None
    assert _FakeDrainer.instances == []


@pytest.mark.asyncio
async def test_a_production_lifespan_starts_one_drainer_and_stops_it(monkeypatch):
    monkeypatch.setattr(main_mod, "RUN_BOOT_SWEEPS", True, raising=False)
    during = await _lifespan_state()
    assert len(_FakeDrainer.instances) == 1
    (d,) = _FakeDrainer.instances
    assert during is d
    assert d.started == 1 and d.stopped == 1
