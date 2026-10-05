"""Phase 274 plan 01 Task 2 (ATT-01 / D-08) — DELETING A THREAD REMOVES ITS ATTACHMENT BYTES.

⛔ THE GAP. `DELETE /threads/{id}` deleted the `threads` row and the FK cascade dropped every
`workspace_files` / `workspace_file_versions` row — but a file over 256 KB lives in the
`workspace-files` BUCKET, and nothing removed it. Every deleted thread orphaned its large
attachments, and with D-05 (thread-life attachments) nothing else ever would.

⭐ THE CONTRACT (D-08), asserted here case by case:
  * COLLECT the paths through the USER-JWT client BEFORE the `threads` delete (after it, the
    cascade has removed the rows that name them);
  * DELETE the thread;
  * REMOVE the collected paths in chunks of at most 100, AFTER the delete returns (so a failed
    delete never leaves rows pointing at removed bytes);
  * a failure is LOGGED, never `pass`, and never blocks the delete;
  * only paths whose first segment is the caller's user id are removed;
  * no service-role client anywhere on this path.

Every case is STUBBED — no Postgres connection and no Storage call reaches a real service.
"""
from __future__ import annotations

import ast
import inspect
import logging
import re
import subprocess
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

USER = "33333333-3333-4333-8333-333333333333"
OTHER = "99999999-9999-4999-8999-999999999999"
THREAD = "11111111-1111-4111-8111-111111111111"

BACKEND = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND.parent
CLEANUP_PATH = BACKEND / "app" / "services" / "thread_workspace_cleanup.py"
THREADS_PATH = BACKEND / "app" / "api" / "threads.py"
PHASE_BASE = "75cd73782d8651d7d976d287e40d6c6802a2dc95"


def _cleanup():
    from app.services import thread_workspace_cleanup

    return thread_workspace_cleanup


class _Resp:
    def __init__(self, data):
        self.data = data


class _Query:
    """A recording supabase-py query builder: every chained call is logged, `.execute()` answers."""

    def __init__(self, table: str, log: list, answers: dict, raises: dict):
        self.table = table
        self.calls: list[tuple] = []
        self._log = log
        self._answers = answers
        self._raises = raises

    def __getattr__(self, name):
        def _chain(*args, **kwargs):
            self.calls.append((name, args))
            return self

        return _chain

    def execute(self):
        self._log.append((self.table, list(self.calls)))
        if self.table in self._raises:
            raise self._raises[self.table]
        return _Resp(self._answers.get(self.table, []))


class _FakeSupabase:
    def __init__(self, answers: dict | None = None, raises: dict | None = None):
        self.queries: list = []
        self.answers = answers or {}
        self.raises = raises or {}
        self.removed: list[list[str]] = []
        self.buckets: list[str] = []
        self.remove_raises_on: set[int] = set()

        sb = self

        class _Bucket:
            def remove(self, paths):
                idx = len(sb.removed)
                sb.removed.append(list(paths))
                if idx in sb.remove_raises_on:
                    raise RuntimeError("storage unavailable")
                return [{"name": p} for p in paths]

        class _Storage:
            def from_(self, bucket):
                sb.buckets.append(bucket)
                return _Bucket()

        self.storage = _Storage()

    def table(self, name):
        return _Query(name, self.queries, self.answers, self.raises)


def _p(file_id: str, v: int = 1, user: str = USER) -> str:
    return f"{user}/{THREAD}/{file_id}/v{v}"


# ── collect ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_collect_returns_the_sorted_unique_non_null_paths_of_files_and_versions():
    """PLANT to drive RED: read only `workspace_files.content_storage_path` and skip the versions —
    every earlier version's bytes are then orphaned."""
    sb = _FakeSupabase(
        answers={
            "workspace_files": [
                {"id": "f-big", "content_storage_path": _p("f-big", 2)},
                {"id": "f-small", "content_storage_path": None},  # inline, no bucket bytes
            ],
            "workspace_file_versions": [
                {"content_storage_path": _p("f-big", 1)},
                {"content_storage_path": _p("f-big", 2)},  # duplicate of the file's current
                {"content_storage_path": None},
            ],
        }
    )
    paths = await _cleanup().collect_thread_workspace_paths(sb, THREAD, USER)
    assert paths == sorted({_p("f-big", 1), _p("f-big", 2)})

    tables = [t for t, _ in sb.queries]
    assert tables == ["workspace_files", "workspace_file_versions"]
    files_calls = sb.queries[0][1]
    assert ("eq", ("thread_id", THREAD)) in files_calls
    version_calls = sb.queries[1][1]
    in_calls = [c for c in version_calls if c[0] == "in_"]
    assert in_calls and in_calls[0][1][0] == "workspace_file_id"
    assert set(in_calls[0][1][1]) == {"f-big", "f-small"}


@pytest.mark.asyncio
async def test_collect_issues_no_versions_query_when_the_thread_has_no_files():
    sb = _FakeSupabase(answers={"workspace_files": []})
    assert await _cleanup().collect_thread_workspace_paths(sb, THREAD, USER) == []
    assert [t for t, _ in sb.queries] == ["workspace_files"]


@pytest.mark.asyncio
async def test_collect_drops_and_logs_a_path_outside_the_callers_prefix(caplog):
    """PLANT to drive RED: remove the first-segment filter. The storage policy is the final
    authority, but this belt means a foreign path is never even ASKED for."""
    sb = _FakeSupabase(
        answers={
            "workspace_files": [
                {"id": "f-1", "content_storage_path": _p("f-1")},
                {"id": "f-2", "content_storage_path": _p("f-2", user=OTHER)},
            ],
            "workspace_file_versions": [],
        }
    )
    with caplog.at_level(logging.WARNING):
        paths = await _cleanup().collect_thread_workspace_paths(sb, THREAD, USER)
    assert paths == [_p("f-1")]
    assert any("prefix" in r.getMessage().lower() for r in caplog.records)


@pytest.mark.asyncio
async def test_a_collect_failure_logs_and_returns_nothing(caplog):
    sb = _FakeSupabase(raises={"workspace_files": RuntimeError("db down")})
    with caplog.at_level(logging.WARNING):
        paths = await _cleanup().collect_thread_workspace_paths(sb, THREAD, USER)
    assert paths == []
    assert any(r.levelno >= logging.WARNING and THREAD in r.getMessage() for r in caplog.records)


@pytest.mark.asyncio
async def test_collect_goes_through_aexec(monkeypatch):
    """D-v2.5-01: no sync supabase-py `.execute()` on the event loop."""
    mod = _cleanup()
    seen: list = []

    async def _fake_aexec(q):
        seen.append(q)
        return q.execute()

    monkeypatch.setattr(mod, "aexec", _fake_aexec)
    sb = _FakeSupabase(
        answers={"workspace_files": [{"id": "f-1", "content_storage_path": _p("f-1")}]}
    )
    await mod.collect_thread_workspace_paths(sb, THREAD, USER)
    assert len(seen) == 2


# ── remove ───────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_remove_chunks_at_100_on_the_workspace_bucket():
    from app.services.workspace_service import BUCKET_NAME

    sb = _FakeSupabase()
    paths = [f"{USER}/{THREAD}/f-{i}/v1" for i in range(250)]
    await _cleanup().remove_workspace_paths(sb, paths)
    assert [len(c) for c in sb.removed] == [100, 100, 50]
    assert [p for c in sb.removed for p in c] == paths
    assert set(sb.buckets) == {BUCKET_NAME}


@pytest.mark.asyncio
async def test_remove_of_nothing_calls_nothing():
    sb = _FakeSupabase()
    await _cleanup().remove_workspace_paths(sb, [])
    assert sb.removed == [] and sb.buckets == []


@pytest.mark.asyncio
async def test_a_failed_chunk_is_logged_and_the_rest_still_run(caplog):
    """PLANT to drive RED: `except Exception: pass` — the failure becomes invisible, which is the
    exact shape the sandbox-outputs cleanup above it in `delete_thread` still has."""
    sb = _FakeSupabase()
    sb.remove_raises_on = {0}
    paths = [f"{USER}/{THREAD}/f-{i}/v1" for i in range(150)]
    with caplog.at_level(logging.WARNING):
        await _cleanup().remove_workspace_paths(sb, paths)  # must not raise
    assert [len(c) for c in sb.removed] == [100, 50], "the second chunk was not attempted"
    warned = [r for r in caplog.records if r.levelno >= logging.WARNING]
    assert warned and "100" in warned[0].getMessage()


@pytest.mark.asyncio
async def test_remove_runs_the_sync_storage_call_in_a_threadpool(monkeypatch):
    mod = _cleanup()
    calls: list = []

    async def _fake_pool(fn, *a, **k):
        calls.append(a)
        return fn(*a, **k)

    monkeypatch.setattr(mod, "run_in_threadpool", _fake_pool)
    await mod.remove_workspace_paths(_FakeSupabase(), [_p("f-1")])
    assert calls == [([_p("f-1")],)]


# ── delete_thread order ──────────────────────────────────────────────────────────────────
def _route_supabase(order: list, *, delete_raises: Exception | None = None):
    sb = MagicMock()

    def _table(name):
        q = MagicMock()
        if name == "threads":
            def _execute():
                order.append("threads.delete")
                if delete_raises:
                    raise delete_raises
                return _Resp([])
        else:
            def _execute():
                return _Resp([])
        q.select.return_value = q
        q.delete.return_value = q
        q.eq.return_value = q
        q.in_.return_value = q
        q.execute.side_effect = _execute
        return q

    sb.table.side_effect = _table
    return sb


@pytest.mark.asyncio
async def test_delete_thread_collects_before_and_removes_after_the_threads_delete(monkeypatch):
    """PLANT to drive RED: move the collect line below the `threads` delete — the cascade has
    then removed every row that named a path, and the collect returns `[]` forever."""
    from app.api import threads

    order: list = []
    collected = [_p("f-1"), _p("f-2")]

    async def _collect(sb, thread_id, user_id):
        order.append(("collect", thread_id, user_id))
        return collected

    async def _remove(sb, paths):
        order.append(("remove", list(paths)))

    monkeypatch.setattr(threads, "collect_thread_workspace_paths", AsyncMock(side_effect=_collect))
    monkeypatch.setattr(threads, "remove_workspace_paths", AsyncMock(side_effect=_remove))
    monkeypatch.setattr(threads.settings, "sandbox_enabled", False, raising=False)

    bg = MagicMock()
    await threads.delete_thread(
        thread_id=THREAD,
        background_tasks=bg,
        current_user={"id": USER},
        supabase=_route_supabase(order),
    )
    assert order == [
        ("collect", THREAD, USER),
        "threads.delete",
        ("remove", collected),
    ]
    bg.add_task.assert_called_once()


@pytest.mark.asyncio
async def test_a_failed_threads_delete_removes_no_bytes(monkeypatch):
    """T-274-03: removal runs only after the delete returns, so a failed delete never leaves
    rows pointing at removed bytes."""
    from app.api import threads

    order: list = []
    remove = AsyncMock()
    monkeypatch.setattr(
        threads, "collect_thread_workspace_paths", AsyncMock(return_value=[_p("f-1")])
    )
    monkeypatch.setattr(threads, "remove_workspace_paths", remove)
    monkeypatch.setattr(threads.settings, "sandbox_enabled", False, raising=False)

    with pytest.raises(RuntimeError, match="delete failed"):
        await threads.delete_thread(
            thread_id=THREAD,
            background_tasks=MagicMock(),
            current_user={"id": USER},
            supabase=_route_supabase(order, delete_raises=RuntimeError("delete failed")),
        )
    remove.assert_not_called()


# ── static fences ────────────────────────────────────────────────────────────────────────
def _strip_py(src: str) -> str:
    out = re.sub(r'"""(?:.|\n)*?"""', "", src)
    out = re.sub(r"'''(?:.|\n)*?'''", "", out)
    return re.sub(r"(?m)#.*$", "", out)


def test_the_cleanup_seam_uses_no_service_role_and_no_retyped_bucket_name():
    """PLANT to drive RED: `from app.services.supabase_client import get_supabase` in the seam."""
    code = _strip_py(CLEANUP_PATH.read_text(encoding="utf-8"))
    assert "async def collect_thread_workspace_paths" in code  # non-vacuity
    for forbidden in ("get_supabase", "service_role", "SUPABASE_SERVICE"):
        assert forbidden not in code, f"{forbidden!r} on the user-JWT-only delete path (D-08)"
    assert '"workspace-files"' not in code and "'workspace-files'" not in code
    assert "BUCKET_NAME" in code
    assert not re.search(r"(?m)^\s*pass\s*$", code), "a bare `pass` hides a failure (T-274-04)"


def _delete_thread_ifs(src: str) -> int:
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "delete_thread":
            return sum(isinstance(n, ast.If) for n in ast.walk(node))
    raise AssertionError("delete_thread not found")


def test_delete_thread_gains_no_branch_relative_to_the_phase_base():
    """D-19 (G-5): `threads.py` is FIRING — one import + two call lines, zero branches."""
    try:
        base_src = subprocess.run(
            ["git", "show", f"{PHASE_BASE}:backend/app/api/threads.py"],
            cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        pytest.skip("phase base not reachable from this checkout")
    head_src = THREADS_PATH.read_text(encoding="utf-8")
    assert _delete_thread_ifs(head_src) == _delete_thread_ifs(base_src)
    from app.api import threads

    body = inspect.getsource(threads.delete_thread)
    assert body.index("collect_thread_workspace_paths") < body.index('table("threads")')
    assert body.index('table("threads")') < body.index("remove_workspace_paths")
