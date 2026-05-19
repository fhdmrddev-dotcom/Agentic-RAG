"""Phase 075.1 Plan 02 Task 1 — D-v2.5-01 compliance test for harvest_output_files.

Tests that ``harvest_output_files`` can be safely offloaded to
``starlette.concurrency.run_in_threadpool`` so its synchronous blocking I/O
(Supabase Storage uploads, ``sandbox_files`` INSERTs, container file reads)
does NOT starve the async event loop / SSE keepalive after a sandbox cell
completes.

Root cause being defended against (from 075-CROSS-PROVIDER-UAT.md):
Pre-fix, threads.py:2533 called ``harvest_output_files(...)`` directly on
the event loop. The Supabase Storage uploads inside it were synchronous,
so the loop blocked for the full upload duration — long enough for the
SSE consumer's keepalive heartbeat to time out and tear down the stream
before the terminal frame shipped. Universal symptom: "stuck on Running
code..." until F5 refresh.

The fix at threads.py:2533 wraps the call in ``await run_in_threadpool(...)``
per D-v2.5-01 + CLAUDE.md Rules ("Do not run blocking I/O directly inside
async handlers — wrap with run_in_threadpool"). The unit test below proves
the loop-responsiveness invariant: a concurrently-scheduled
``asyncio.sleep(0.05)`` task completes BEFORE the harvest returns when
harvest is run via ``run_in_threadpool`` and the supabase upload mock
blocks for ~0.2s.
"""
from __future__ import annotations

import asyncio
import os
import time
from unittest.mock import MagicMock

import pytest
from starlette.concurrency import run_in_threadpool


@pytest.mark.asyncio
async def test_harvest_offloaded_keeps_loop_responsive(tmp_path):
    """Loop stays responsive while harvest_output_files runs in threadpool.

    Schedule a 50ms asyncio.sleep concurrently with a harvest call where
    the supabase upload mock blocks for 200ms. With run_in_threadpool the
    sleep MUST complete first (loop-responsiveness invariant). If harvest
    blocked the loop, the sleep would finish AFTER harvest returns.
    """
    from app.services.sandbox_service import harvest_output_files

    # Build a real temp file the harvest can "copy" out of the container.
    mock_session = MagicMock()

    def fake_copy(src, dest):
        os.makedirs(dest, exist_ok=True)
        with open(os.path.join(dest, "chart.png"), "wb") as f:
            f.write(b"fake-png-data")

    mock_session.copy_from_runtime.side_effect = fake_copy

    # Mock supabase with a slow upload (simulates Supabase Storage round-trip
    # — pre-fix, this 200 ms blocked the entire event loop).
    mock_supabase = MagicMock()
    storage_bucket = MagicMock()

    def slow_upload(*args, **kwargs):
        time.sleep(0.2)  # block the calling thread for 200 ms
        return MagicMock()

    storage_bucket.upload.side_effect = slow_upload
    mock_supabase.storage.from_.return_value = storage_bucket

    table_mock = MagicMock()
    table_mock.insert.return_value = table_mock
    table_mock.execute.return_value = MagicMock()
    mock_supabase.table.return_value = table_mock

    # Mark when each operation completes (wall clock).
    completion_times: dict[str, float] = {}

    async def sleeper():
        await asyncio.sleep(0.05)
        completion_times["sleep"] = time.monotonic()

    async def harvester():
        result = await run_in_threadpool(
            harvest_output_files,
            mock_session,
            "exec-075-1",
            "user-075-1",
            mock_supabase,
        )
        completion_times["harvest"] = time.monotonic()
        return result

    start = time.monotonic()
    sleep_task = asyncio.create_task(sleeper())
    harvest_task = asyncio.create_task(harvester())
    result = await harvest_task
    await sleep_task

    # Loop-responsiveness invariant: the 50 ms sleep completed BEFORE the
    # 200 ms harvest returned. Pre-fix, harvest blocked the loop so the
    # sleep would have finished AFTER harvest (around 200 ms in, not 50).
    assert "sleep" in completion_times and "harvest" in completion_times
    assert completion_times["sleep"] < completion_times["harvest"], (
        f"Loop was blocked: sleep_done_at={completion_times['sleep'] - start:.3f}s "
        f"harvest_done_at={completion_times['harvest'] - start:.3f}s"
    )

    # Harvest still returns the expected shape.
    assert isinstance(result, list)
    assert len(result) == 1
    entry = result[0]
    assert entry["filename"] == "chart.png"
    assert entry["url"] == "/sandbox-outputs/user-075-1/exec-075-1/chart.png"
    assert entry["size"] == len(b"fake-png-data")


@pytest.mark.asyncio
async def test_harvest_returns_same_shape_via_threadpool():
    """run_in_threadpool wrap MUST NOT change the return shape.

    Backward-compat guard: the call site in threads.py expects
    ``list[dict]`` with keys {filename, url, size}. Threadpool offload
    only moves the *execution thread*, not the return shape.
    """
    from app.services.sandbox_service import harvest_output_files

    mock_session = MagicMock()

    def fake_copy(src, dest):
        os.makedirs(dest, exist_ok=True)
        with open(os.path.join(dest, "out.csv"), "wb") as f:
            f.write(b"a,b\n1,2\n")

    mock_session.copy_from_runtime.side_effect = fake_copy

    mock_supabase = MagicMock()
    storage_bucket = MagicMock()
    storage_bucket.upload.return_value = MagicMock()
    mock_supabase.storage.from_.return_value = storage_bucket

    table_mock = MagicMock()
    table_mock.insert.return_value = table_mock
    table_mock.execute.return_value = MagicMock()
    mock_supabase.table.return_value = table_mock

    result = await run_in_threadpool(
        harvest_output_files,
        mock_session,
        "exec-shape-test",
        "user-shape-test",
        mock_supabase,
    )

    assert isinstance(result, list)
    assert len(result) == 1
    assert set(result[0].keys()) == {"filename", "url", "size"}
    assert result[0]["filename"] == "out.csv"
    assert result[0]["url"] == "/sandbox-outputs/user-shape-test/exec-shape-test/out.csv"
