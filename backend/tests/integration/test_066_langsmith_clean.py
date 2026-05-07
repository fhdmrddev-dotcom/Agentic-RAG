"""Phase 066 SC#7 + Phase 067.1 Plan 01 SC#1: LangSmith trace clean on TimeoutError.

Phase 066 D-066-11 first attempted close-then-raise: on per-call
asyncio.timeout, call stream.close() / _ant_gen.close() inside the
``except asyncio.TimeoutError`` block. Phase 067 Plan 05 live UAT
discovered this is too late — Python's ``for chunk in stream:`` semantics
trigger the implicit ``iterator.close()`` BEFORE control reaches the
except handler, and ``_TracedStream.__iter__``'s
``except BaseException as e: self._end_trace(error=e)`` records
``GeneratorExit`` unconditionally (Phase 067.1 RESEARCH § Pitfall 1).

Phase 067.1 Plan 01 Track A re-architects the iteration: the sync
``for chunk in stream:`` runs in a thread pool worker; our async-side
timeout cancels OUR queue consumer; on cancel we close the underlying
SDK stream from the main thread BEFORE the producer's for-loop exits, so
``_TracedStream.__iter__`` exits via ``StopIteration`` → ``else: self._end_trace()``
clean-closure branch (no error recorded).

This file ships TWO assertions:
  1. ``test_no_generator_exit_on_timeout`` — original Phase 066 caplog
     proxy (no log record contains 'GeneratorExit'). Cheap and broad.
  2. ``test_track_a_clean_trace_exception`` — Track A positive assertion.
     Drives the OpenAI branch through a faithful ``_TracedStream``
     behavioral double (mirrors langsmith run_helpers.py:1678-1685
     verbatim) and asserts every recorded ``_end_trace(error=...)`` call
     uses ``error=None`` (clean close) or ``error in (TimeoutError,
     CancelledError)`` — never ``GeneratorExit``.
"""
import asyncio
import logging
import time
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (  # noqa: E402
    _build_mock_supabase,
    _make_done_chunk,
    _make_sse_chunk,
    await_producer_finalized,
)
from tests.integration.test_059_disconnect import (  # noqa: F401, E402
    _reset_sse_starlette_app_status,
)

THREAD_A = str(uuid4())


def _stalling_chunks():
    time.sleep(5.0)
    yield _make_sse_chunk("never ")
    yield _make_done_chunk()


# Phase 067.1 Plan 01 Track A — faithful _TracedStream behavioral double.
#
# Mirrors langsmith.run_helpers._TracedStream.__iter__ verbatim
# (run_helpers.py:1678-1685, langsmith 0.2.3..0.8.2). Exposes ``_end_trace``
# so the test can capture the ``error`` argument and positively assert on it.
# Has a sync ``close()`` that signals the underlying iterator to stop
# yielding — same contract as openai 2.28.0 ``Stream.close``: it closes the
# underlying httpx response so the next ``__next__`` returns
# ``StopIteration`` (NOT ``GeneratorExit``).
#
# Why a behavioral double rather than a real ``_TracedStream``: constructing
# the real wrapper requires an internal ``_TraceableContainer`` and a live
# LangSmith trace context. The double drives the same Python iterator
# semantics — ``yield from`` inside ``except BaseException``-wrapped
# generator — which is the exact mechanism Track A neutralizes.
#
# The INNER iterator must NOT be a Python generator. ``Stream.close()`` on
# real openai 2.28.0 closes the underlying network stream; subsequent
# ``__next__`` returns StopIteration cleanly. A Python generator's
# ``.close()`` raises ``GeneratorExit`` INSIDE the generator — which is the
# exact mechanism we are trying to bypass. We therefore model the inner
# as an iterator class that respects ``close()`` by having its
# ``__next__`` return StopIteration thereafter.
class _StallingIterator:
    """Iterator-class with close()→StopIteration semantics (matches openai.Stream).

    Sleeps in fine-grained slices so close() from another thread observes
    quickly (mirrors how openai.Stream's underlying httpx response close
    interrupts an in-flight read promptly via socket teardown).
    """

    def __init__(self, total_stall: float = 5.0, slice_size: float = 0.05):
        self._closed = False
        self._n = 0
        self._total_stall = total_stall
        self._slice_size = slice_size

    def __iter__(self):
        return self

    def __next__(self):
        if self._closed:
            raise StopIteration
        # First call stalls in fine slices so close() from another thread
        # observes promptly (mirrors openai.Stream — closing the underlying
        # httpx response interrupts an in-flight chunk read at the next
        # poll). Without fine slicing the producer thread would not see
        # _closed for the full sleep duration, and the test's executor
        # thread would still be running when the test makes assertions.
        if self._n == 0:
            elapsed = 0.0
            while elapsed < self._total_stall and not self._closed:
                time.sleep(self._slice_size)
                elapsed += self._slice_size
            self._n += 1
            if self._closed:
                raise StopIteration
            return _make_sse_chunk("never ")
        if self._n == 1:
            self._n += 1
            return _make_done_chunk()
        raise StopIteration

    def close(self):
        # openai 2.28.0 Stream.close() closes the underlying httpx response;
        # subsequent __next__ returns StopIteration. NO GeneratorExit raised.
        self._closed = True


class _FakeTracedStream:
    """Mirrors langsmith _TracedStream.__iter__ semantics without real tracing."""

    def __init__(self, inner):
        self._inner = inner
        self._closed = False
        # capture every _end_trace invocation for the test to inspect
        self.end_trace_calls: list[BaseException | None] = []

    def __iter__(self):
        # VERBATIM mirror of langsmith run_helpers.py:1678-1685.
        try:
            yield from self._inner
        except BaseException as e:
            self._end_trace(error=e)
            raise
        else:
            self._end_trace()

    def _end_trace(self, error=None):
        # Production langsmith calls _container_end here; we just record.
        self.end_trace_calls.append(error)

    def close(self):
        # Mirrors openai.Stream.close — closes the underlying iterator's
        # network stream. Our double calls the inner's close() which sets
        # a flag so subsequent __next__ returns StopIteration cleanly.
        self._closed = True
        try:
            inner_close = getattr(self._inner, "close", None)
            if inner_close is not None:
                inner_close()
        except Exception:
            pass


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_no_generator_exit_on_timeout(redis_client, monkeypatch, caplog):
    """SC#7 + D-066-11: TimeoutError path does NOT leak GeneratorExit into logs."""
    import app.config as _app_config
    monkeypatch.setattr(_app_config, "get_per_call_timeout", lambda *a, **k: 1)
    caplog.set_level(logging.WARNING)

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_stalling_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)

        # Assert: no caplog record contains 'GeneratorExit' in its message
        # OR pathname (covers both langsmith/run_helpers.py:1680 and any
        # synthetic exception trace).
        offending = [
            (rec.levelname, rec.name, rec.getMessage())
            for rec in caplog.records
            if "GeneratorExit" in rec.getMessage()
            or "GeneratorExit" in (rec.pathname or "")
        ]
        assert not offending, (
            f"D-066-11 violation: TimeoutError path leaked GeneratorExit into logs. "
            f"Offending records: {offending}"
        )

        # Sanity: we DID hit the timed_out path (otherwise the negation is vacuous)
        runs_builder = mock_supabase.table("runs")
        timed_out_updates = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "timed_out"
        ]
        assert timed_out_updates, (
            "Test setup wrong — must have hit timed_out path (otherwise the "
            "negation 'no GeneratorExit' is vacuously satisfied)"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_track_a_clean_trace_exception(redis_client, monkeypatch):
    """Phase 067.1 Plan 01 SC#1: Track A positive assertion on trace closure.

    Drives the OpenAI branch through ``_FakeTracedStream`` (a faithful
    behavioral double of ``langsmith.run_helpers._TracedStream``) so we can
    capture every ``_end_trace(error=...)`` invocation. The Track A invariant:
    the trace MUST close with ``error=None`` (the ``else`` branch of
    ``__iter__``) or with a clean cancellation type (TimeoutError /
    CancelledError) — NEVER with ``GeneratorExit`` (which would mean the
    for-loop's implicit cleanup got there first).

    Why this complements the caplog proxy: the existing
    ``test_no_generator_exit_on_timeout`` watches LOGS. This test watches
    the actual trace-closure error argument, which is the truth source for
    the LangSmith UI's exception column (Phase 067 Plan 05 Gap-007 was
    discovered HERE — the trace exception column showed GeneratorExit even
    when our application logs were clean).
    """
    import app.config as _app_config
    monkeypatch.setattr(_app_config, "get_per_call_timeout", lambda *a, **k: 1)

    # Use _StallingIterator (iterator-class with close()→StopIteration
    # semantics) rather than _stalling_chunks (Python generator whose
    # .close() raises GeneratorExit). The inner MUST mirror real openai
    # Stream behavior or the test would inadvertently exercise the very
    # bug Track A is designed to prevent.
    fake_stream = _FakeTracedStream(_StallingIterator())

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (fake_stream, CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)

        # Track A positive assertion: every captured _end_trace call must
        # use error=None or a clean cancellation type. NEVER GeneratorExit.
        captured_errors = fake_stream.end_trace_calls
        assert captured_errors, (
            "Test setup wrong — _FakeTracedStream._end_trace was never invoked. "
            "Either Track A doesn't drive the wrapped iterator at all, or the "
            "behavioral double diverged from langsmith's __iter__ contract."
        )
        bad_errors = [
            err for err in captured_errors
            if err is not None
            and not isinstance(err, (asyncio.TimeoutError, asyncio.CancelledError))
        ]
        assert not bad_errors, (
            f"Track A regression: LangSmith trace closed with non-clean exception. "
            f"Expected None / TimeoutError / CancelledError on every _end_trace "
            f"call; got {[type(e).__name__ for e in bad_errors]} (full list: "
            f"{[type(e).__name__ if e else 'None' for e in captured_errors]}). "
            f"This means Python's for-loop implicit cleanup is propagating "
            f"GeneratorExit into _TracedStream.__iter__ before Track A's "
            f"out-of-band stream.close() can land — Pitfall 1 (Phase 067.1 "
            f"RESEARCH § Pattern 1) is firing again."
        )

        # Sanity: we DID hit the timed_out path (otherwise the assertion is
        # vacuous — _end_trace would only be called on natural stream end).
        runs_builder = mock_supabase.table("runs")
        timed_out_updates = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "timed_out"
        ]
        assert timed_out_updates, (
            "Test setup wrong — must have hit timed_out path (otherwise the "
            "Track A assertion is vacuously satisfied via natural stream end)"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
