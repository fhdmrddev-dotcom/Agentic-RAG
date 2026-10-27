"""296 G-4 scenario 3 (found live 2026-10-27): an answered run's re-drive must END its stream.

Measured in local Redis: ``run:4d313e4c-…`` (the re-drive shell of run ``8557f483``) held
phase events, the answer ``delta`` and ``run_completed`` — and no terminal sentinel, TTL -1.
The server's SSE tail waits for a sentinel (``TERMINAL_TYPES``), so a followed thread's
subscription stayed open for ``consumer_timeout_seconds`` and its 296-04 ``onTerminal`` reconcile
never ran: the answer and ``◌ Unsourced`` appeared only after a thread switch.

The kickoff producer ends its stream finalize → sentinel → EXPIRE (``run_producer.py``); the
re-drive's ``_wake`` finalised the shell row only. Driven against the REAL local Postgres with the
harness from ``test_296_redrive_fault_injection.py``; only the engine edges and Redis are fakes.
"""
from __future__ import annotations

import json
import uuid
from types import SimpleNamespace

import pytest

from tests.unit.test_296_redrive_fault_injection import (  # noqa: F401 — fixtures by import
    _drain,
    paused_run,
    pool,
    pytestmark,
)


class _RecordingRedis:
    def __init__(self):
        self.added: list[tuple[str, dict]] = []
        self.expired: list[tuple[str, int]] = []

    async def xadd(self, key, fields, **kwargs):
        self.added.append((key, json.loads(fields["data"])))
        return "0-0"

    async def expire(self, key, ttl):
        self.expired.append((key, ttl))
        return True


def _wire(monkeypatch, pool, producer_run_id, *, resume=None):
    async def _get_pool():
        return pool

    async def _load_def(_pool, _run_id):
        return object()

    async def _build_ctx(_row, _redis, _pool):
        return SimpleNamespace(producer_run_id=producer_run_id, run_usage_box={})

    async def _resume(run_id, defn, ctx, *, pool, redis):
        if resume is not None:
            await resume()

    monkeypatch.setattr("app.dependencies.get_pg_pool", _get_pool)
    monkeypatch.setattr("app.services.harness_engine._load_run_definition", _load_def)
    monkeypatch.setattr("app.services.harness_engine._build_resume_context", _build_ctx)
    monkeypatch.setattr("app.services.harness_engine._resume_run", _resume)


@pytest.mark.asyncio
async def test_a_completed_re_drive_ends_its_stream_with_done_then_expires_it(monkeypatch, pool, paused_run):
    from app.api import runs as runs_api

    shell = uuid.uuid4()
    redis = _RecordingRedis()
    _wire(monkeypatch, pool, shell)
    await runs_api._redrive_paused_workflow_run(paused_run.run_id, "tc-296-s3", redis)
    await _drain()

    key = f"run:{shell}"
    terminals = [ev["type"] for k, ev in redis.added if k == key and ev.get("type") in runs_api.TERMINAL_TYPES]
    assert terminals == ["done"], f"the shell stream must end with one `done`, got {terminals}"
    assert [k for k, _ in redis.expired] == [key], "the ended stream must expire, never sit at TTL -1"


@pytest.mark.asyncio
async def test_a_failed_re_drive_ends_its_stream_with_error(monkeypatch, pool, paused_run):
    from app.api import runs as runs_api

    async def _boom():
        raise RuntimeError("planted producer failure")

    shell = uuid.uuid4()
    redis = _RecordingRedis()
    _wire(monkeypatch, pool, shell, resume=_boom)
    await runs_api._redrive_paused_workflow_run(paused_run.run_id, "tc-296-s3f", redis)
    await _drain()

    key = f"run:{shell}"
    terminals = [ev["type"] for k, ev in redis.added if k == key and ev.get("type") in runs_api.TERMINAL_TYPES]
    assert terminals == ["error"], f"a failed re-drive must end its stream with `error`, got {terminals}"
