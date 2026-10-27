"""Phase 296-02 — DEBT-3 (D-02 / D-23): can a ``cap_paused`` workflow run's engine ask be re-driven?

The inventory's worry: ``_redrive_paused_workflow_run`` selects ``wr.status = 'paused'``, so a run
sitting at ``cap_paused`` when its engine ask is answered would never be woken. This test drives
the claim RED-first, as D-23 requires, and the plan's disposition is: GREEN → close DEBT-3 as
"did not reproduce" with this file as the evidence; RED → widen the SELECT to
``IN ('paused','cap_paused')`` with ``claim_run`` still the CAS.

The model below applies the REAL SQL the two real writers send — ``pause_run``'s guard
(``status NOT IN ('completed','failed','cancelled')``) and the re-drive's ``status = 'paused'``
predicate — to one row's status, so neither writer is mocked away.

⛔ ``app.db.runs.run_is_cap_paused`` is NOT the predicate for this question: it reads the
producer ``runs`` table, not ``workflow_runs`` (296-RESEARCH Pitfall 3).
"""
from __future__ import annotations

import asyncio
import inspect
import re
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

_TERMINAL = ("completed", "failed", "cancelled")


class _StatusPool:
    """One ``workflow_runs`` row; UPDATE/SELECT guards evaluated from the SQL actually sent."""

    def __init__(self, status: str, row: dict):
        self.status = status
        self.row = row
        self.calls: list = []

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        if "UPDATE workflow_runs SET status = 'paused'" in sql:
            assert "NOT IN ('completed', 'failed', 'cancelled')" in sql or \
                   "NOT IN ('completed','failed','cancelled')" in sql, sql
            if self.status not in _TERMINAL:
                self.status = "paused"
        elif "UPDATE workflow_runs SET status = 'active'" in sql and "status = 'paused'" in sql:
            if self.status == "paused":
                self.status = "active"
        return "UPDATE 1"

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM workflow_runs wr" in sql:
            m = re.search(r"wr\.status\s*(=\s*'(\w+)'|IN\s*\(([^)]*)\))", sql)
            allowed = {m.group(2)} if m.group(2) else set(re.findall(r"'(\w+)'", m.group(3)))
            return self.row if self.status in allowed else None
        if "SET claimed_at = now()" in sql:
            return {"id": args[0]}
        return None

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        return None

    async def fetch(self, sql, *args):
        return []


def test_engine_pause_writes_pause_run_before_anything_else():
    """The order that makes DEBT-3 moot: the ask's FIRST write moves the run to ``paused``."""
    from app.services.harness import engine_ask

    src = inspect.getsource(engine_ask.engine_pause)
    assert src.index("await pause_run(pool, run_id)") < src.index("stash_awaiting_answer(")


def test_a_cap_paused_run_whose_engine_ask_is_answered_is_re_driven(monkeypatch):
    from app.api import runs as runs_api
    from app.db.workflows import pause_run

    run_id = uuid.uuid4()
    row = {"run_id": run_id, "thread_id": uuid.uuid4(), "current_phase_id": None,
           "inputs": {}, "org_id": None, "is_golden_run": False, "user_id": uuid.uuid4()}
    pool = _StatusPool("cap_paused", row)

    async def _get_pool():
        return pool

    resume = AsyncMock()
    monkeypatch.setattr("app.dependencies.get_pg_pool", _get_pool)
    monkeypatch.setattr("app.services.harness_engine._load_run_definition",
                        AsyncMock(return_value=object()))
    monkeypatch.setattr("app.services.harness_engine._build_resume_context",
                        AsyncMock(return_value=SimpleNamespace(producer_run_id=None)))
    monkeypatch.setattr("app.services.harness_engine._resume_run", resume)

    async def _go():
        await pause_run(pool, run_id)            # the engine ask's first write
        ok = await runs_api._redrive_paused_workflow_run(run_id, "tc-engine", object())
        for _ in range(10):
            await asyncio.sleep(0)
        return ok

    ok = asyncio.run(_go())
    assert ok is True, "the answered engine ask on a once-cap_paused run was not re-driven"
    resume.assert_awaited_once()
    assert pool.status == "active"


def test_nothing_in_the_backend_writes_workflow_runs_cap_paused():
    """The second half of the evidence: ``cap_paused`` is written to ``runs`` only."""
    app = Path(__file__).resolve().parents[2] / "app"
    hits = []
    for p in app.rglob("*.py"):
        for ln in p.read_text(encoding="utf-8").splitlines():
            if re.search(r"UPDATE\s+workflow_runs\s+SET\s+status\s*=\s*'cap_paused'", ln):
                hits.append(f"{p.name}: {ln.strip()}")
    assert hits == []
