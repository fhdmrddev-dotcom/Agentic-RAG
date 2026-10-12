"""Phase 275-03 (RET-03 / D-08 / D-29 / D-31 / D-37) — the sweep claimant, the daemon, the flag.

Mocked-pool cases (the live proof is ``tests/integration/test_275_disposition.py``):

* the claim is ``FOR UPDATE SKIP LOCKED`` inside a transaction and advances ``next_run_at`` to the
  next 02:00 UTC IN that transaction, with the lease set (T-275-26);
* the release writes the terminal status in ONE place and refuses an unknown status;
* the daemon isolates orgs — one failure releases that org ``failed`` and the tick continues; an
  incomplete evaluation releases ``incomplete``;
* an incomplete read writes NO document or queue change, only the ``sweep_incomplete`` receipt;
* a confirm whose typed count is wrong is refused before the pool is touched (D-03);
* the flag defaults off and the lifespan only constructs the daemon behind it (D-29 / D-37);
* source fences: the sweep, the loader and the claim module never delete a document, the only
  document delete is reached from ``confirm_batch``, nothing touches ``workspace_files``, and
  ``scheduler_service`` is neither imported nor edited (D-31).
"""
from __future__ import annotations

import ast
import inspect
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.db import retention as rdb
from app.services.retention import disposition, sweep_service
from app.services.retention.load import IncompleteEvaluation

BACKEND = Path(__file__).resolve().parents[2]
ORG = "11111111-1111-1111-1111-111111111111"
ORG2 = "22222222-2222-2222-2222-222222222222"
ORG3 = "33333333-3333-3333-3333-333333333333"


class _Con:
    def __init__(self, pool):
        self.pool = pool

    def transaction(self, **kw):
        pool = self.pool

        class _Tx:
            async def __aenter__(self):
                pool.calls.append(("BEGIN", kw))
                return self

            async def __aexit__(self, *exc):
                pool.calls.append(("END", ()))
                return False

        return _Tx()

    async def fetch(self, sql, *args):
        self.pool.calls.append((sql, args))
        return self.pool.fetch_results.pop(0) if self.pool.fetch_results else []

    async def fetchrow(self, sql, *args):
        self.pool.calls.append((sql, args))
        return None

    async def fetchval(self, sql, *args):
        self.pool.calls.append((sql, args))
        return None

    async def execute(self, sql, *args):
        self.pool.calls.append((sql, args))
        return "UPDATE 1"

    async def executemany(self, sql, rows):
        self.pool.calls.append((sql, tuple(rows)))


class _Pool:
    def __init__(self, fetch_results=None):
        self.calls: list = []
        self.fetch_results = list(fetch_results or [])
        self._con = _Con(self)

    def acquire(self):
        con = self._con

        class _Acq:
            async def __aenter__(self):
                return con

            async def __aexit__(self, *exc):
                return False

        return _Acq()

    async def execute(self, sql, *args):
        return await self._con.execute(sql, *args)

    async def fetchrow(self, sql, *args):
        return await self._con.fetchrow(sql, *args)

    async def fetchval(self, sql, *args):
        return await self._con.fetchval(sql, *args)


class _Untouchable:
    def __getattr__(self, name):
        raise AssertionError(f"D-03: the pool was touched ({name}) before the typed count was checked")


# ── the 02:00 UTC cadence ───────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("now,expected", [
    (datetime(2026, 10, 12, 1, 0, tzinfo=timezone.utc), datetime(2026, 10, 12, 2, 0, tzinfo=timezone.utc)),
    (datetime(2026, 10, 12, 2, 0, tzinfo=timezone.utc), datetime(2026, 10, 13, 2, 0, tzinfo=timezone.utc)),
    (datetime(2026, 10, 12, 23, 59, tzinfo=timezone.utc), datetime(2026, 10, 13, 2, 0, tzinfo=timezone.utc)),
    (datetime(2026, 10, 12, 1, 0), datetime(2026, 10, 12, 2, 0, tzinfo=timezone.utc)),
])
def test_next_sweep_is_the_next_two_am_utc(now, expected):
    assert rdb.next_sweep_at(now) == expected
    assert rdb.SWEEP_HOUR_UTC == 2


# ── the claim (T-275-26) ────────────────────────────────────────────────────────────────────

async def test_the_claim_skips_locked_rows_and_advances_next_run_inside_the_transaction():
    now = datetime(2026, 10, 12, 2, 5, tzinfo=timezone.utc)
    pool = _Pool(fetch_results=[[{"org_id": ORG, "next_run_at": now, "last_run_at": None, "last_status": None}]])
    claimed = await rdb.claim_due_retention_sweeps(pool, limit=5, lease_seconds=900, now=now)
    assert [c["org_id"] for c in claimed] == [ORG]
    sqls = [c[0] for c in pool.calls]
    begin, end = sqls.index("BEGIN"), sqls.index("END")
    select_i = next(i for i, s in enumerate(sqls) if isinstance(s, str) and "FOR UPDATE SKIP LOCKED" in s)
    update_i = next(i for i, s in enumerate(sqls) if isinstance(s, str) and "UPDATE public.retention_sweeps" in s)
    assert begin < select_i < update_i < end, "the lease and next_run_at must be written INSIDE the claim TX"
    update_args = pool.calls[update_i][1]
    assert update_args[1] == now + timedelta(seconds=900), "the lease"
    assert update_args[2] == datetime(2026, 10, 13, 2, 0, tzinfo=timezone.utc), "next_run_at = the next 02:00 UTC"


async def test_release_writes_the_terminal_status_in_one_place():
    pool = _Pool()
    await rdb.release_retention_sweep(pool, ORG, status="incomplete", error="cycle", counts={"incomplete": 1})
    sql, args = pool.calls[-1]
    assert "leased_until = NULL" in sql and "last_status = $2" in sql
    assert args[1] == "incomplete" and args[2] == "cycle"
    with pytest.raises(ValueError):
        await rdb.release_retention_sweep(pool, ORG, status="deleted")


# ── the daemon (per-org isolation) ──────────────────────────────────────────────────────────

async def test_one_org_failing_releases_that_org_and_the_tick_continues(monkeypatch):
    releases: list = []

    async def _claim(pool, **kw):
        return [{"org_id": ORG}, {"org_id": ORG2}, {"org_id": ORG3}]

    async def _sweep(pool, org_id, *, now=None):
        if org_id == ORG:
            raise RuntimeError("boom")
        if org_id == ORG2:
            return disposition.SweepResult(status="incomplete", error="a folder cycle", counts={"incomplete": 1})
        return disposition.SweepResult(status="ok", counts={"archived": 2})

    async def _release(pool, org_id, *, status, error=None, counts=None):
        releases.append((org_id, status, error))

    monkeypatch.setattr(rdb, "claim_due_retention_sweeps", _claim)
    monkeypatch.setattr(disposition, "run_org_sweep", _sweep)
    monkeypatch.setattr(rdb, "release_retention_sweep", _release)

    svc = sweep_service.RetentionSweepService(pool=object())
    swept = await svc.tick()
    assert swept == 1
    assert [(o, s) for o, s, _ in releases] == [(ORG, "failed"), (ORG2, "incomplete"), (ORG3, "ok")]
    assert "boom" in (releases[0][2] or "")


def test_constructing_the_service_starts_nothing():
    svc = sweep_service.RetentionSweepService(pool=object())
    assert svc._running is False and svc._poll_task is None


# ── incomplete disposes nothing (SC#3) ──────────────────────────────────────────────────────

async def test_an_incomplete_read_writes_no_document_or_queue_change(monkeypatch):
    async def _boom(pool, org_id, *, con=None):
        raise IncompleteEvaluation("folder X is part of a parent cycle")

    monkeypatch.setattr(disposition, "load_snapshot", _boom)
    pool = _Pool()
    result = await disposition.run_org_sweep(pool, ORG, now=datetime(2026, 10, 12, 2, tzinfo=timezone.utc))
    assert result.status == "incomplete" and "cycle" in (result.error or "")
    writes = [c for c in pool.calls if isinstance(c[0], str) and c[0].lstrip().split(" ")[0] in ("INSERT", "UPDATE", "DELETE")]
    assert len(writes) == 1, writes
    assert "retention_receipts" in writes[0][0] and writes[0][1][1] == "sweep_incomplete"
    assert not any("public.documents" in c[0] or "retention_queue" in c[0] for c in writes)


# ── confirm refuses a wrong typed count before anything (D-03) ──────────────────────────────

@pytest.mark.parametrize("typed", [0, 1, 3, True, "2"])
async def test_a_wrong_typed_count_is_refused_before_the_pool_is_touched(typed):
    with pytest.raises(disposition.ConfirmRefused):
        await disposition.confirm_batch(
            _Untouchable(), ORG, "p1", delete_ids=["d1", "d2"], typed_count=typed,
            actor_id=None, actor_name="Amira Sato",
        )


# ── the flag (D-29 / D-37) ──────────────────────────────────────────────────────────────────

def test_the_sweep_flag_defaults_off():
    from app.config import Settings

    assert Settings.model_fields["retention_sweep_enabled"].default is False


def test_the_lifespan_constructs_the_daemon_only_behind_the_flag():
    src = (BACKEND / "app" / "main.py").read_text(encoding="utf-8")
    gate = src.index('getattr(settings, "retention_sweep_enabled", False)')
    ctor = src.index("RetentionSweepService(")
    assert gate < ctor, "the daemon must be constructed inside the flag guard"
    assert "retention_sweep_service" in src[src.index("Phase 234 — stop the watch service"):], "stopped at shutdown"


# ── source fences ───────────────────────────────────────────────────────────────────────────

RETENTION_FILES = [
    BACKEND / "app" / "services" / "retention" / name
    for name in ("evaluate.py", "periods.py", "load.py", "disposition.py", "sweep_service.py")
] + [BACKEND / "app" / "db" / "retention.py"]


@pytest.mark.parametrize("path", RETENTION_FILES, ids=lambda p: p.name)
def test_no_retention_module_touches_workspace_files_or_the_scheduler(path):
    src = path.read_text(encoding="utf-8")
    assert "workspace_files" not in src, f"{path.name}: a thread attachment is never a document (D-274-01)"
    assert "scheduler_service" not in src, f"{path.name}: D-31 — the sweep is not the scheduler"


@pytest.mark.parametrize("path", [p for p in RETENTION_FILES if p.name != "disposition.py"], ids=lambda p: p.name)
def test_only_disposition_deletes_a_document(path):
    src = path.read_text(encoding="utf-8")
    assert "DELETE FROM public.documents" not in src
    assert 'table("documents").delete' not in src


def test_the_one_document_delete_is_reached_only_from_confirm_batch():
    path = BACKEND / "app" / "services" / "retention" / "disposition.py"
    src = path.read_text(encoding="utf-8")
    assert src.count("DELETE FROM public.documents") == 1
    tree = ast.parse(src)
    holder = None
    callers: dict[str, set[str]] = {}
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            seg = ast.get_source_segment(src, node) or ""
            if "DELETE FROM public.documents" in seg and holder is None:
                holder = node.name
            for call in ast.walk(node):
                if isinstance(call, ast.Call) and isinstance(call.func, ast.Name):
                    callers.setdefault(call.func.id, set()).add(node.name)
    assert holder == "_confirm_delete", holder
    assert callers.get("_confirm_delete") == {"confirm_batch"}, callers.get("_confirm_delete")


def test_the_sweep_path_never_deletes_a_document():
    for fn in (disposition.run_org_sweep, disposition._sweep_write, sweep_service.sweep_one):
        assert "DELETE FROM public.documents" not in inspect.getsource(fn)


def test_scheduler_service_is_not_imported_by_main_for_retention():
    src = (BACKEND / "app" / "main.py").read_text(encoding="utf-8")
    block = src[src.index("retention_sweep_enabled"):][:1500]
    assert "scheduler_service" not in block
