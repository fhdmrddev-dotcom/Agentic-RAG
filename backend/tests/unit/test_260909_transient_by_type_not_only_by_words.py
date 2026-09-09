"""A timeout that says nothing is still a timeout — code review WR-01, 2026-09-09.

⛔ **THE CLASSIFIER WAS MESSAGE-ONLY, AND MOST TIMEOUTS CARRY NO MESSAGE.** Measured:

    TimeoutError()          str=''
    asyncio.TimeoutError()  str=''
    socket.timeout()        str=''
    httpx.ReadTimeout('')   str=''
    httpx.ConnectTimeout('') str=''
    httpx.PoolTimeout('')   str=''

**Six classes, every one an empty string.** A substring test over the message judges all of them
PERMANENT — the exact opposite of the truth, on the failure this whole line of work exists for.

⚠ **THE EARLIER TEST PASSED BY ACCIDENT OF ITS FIXTURE.** It spells `TimeoutError("timed out")`,
so the word was there to be matched. The operator's real failure only carried `timed out` because
the OS socket layer happens to construct it with that text; `asyncio.wait_for` does not.

⚠ This is the second time in one day this tuple has been wrong in the same direction — it already
carried `"timeout"` while the message said `timed out`. **A rule that reads words cannot classify
an exception that has none**; the type is the fact, and the message is the hint.
"""

from __future__ import annotations

import asyncio
import socket

import httpx
import pytest

from app.services.transient_errors import is_transient


@pytest.mark.parametrize(
    "exc",
    [
        TimeoutError(),
        asyncio.TimeoutError(),
        socket.timeout(),
        httpx.ReadTimeout(""),
        httpx.ConnectTimeout(""),
        httpx.PoolTimeout(""),
        httpx.RemoteProtocolError(""),
        ConnectionResetError(),
        ConnectionAbortedError(),
    ],
    ids=lambda e: type(e).__name__,
)
def test_a_wordless_transient_exception_is_still_transient(exc):
    assert is_transient(exc), (
        f"{type(exc).__name__}() carries str()={str(exc)!r}, so a message-only rule calls it "
        f"permanent — the document is failed on a stall that would have succeeded on retry"
    )


@pytest.mark.parametrize(
    "exc",
    [
        ValueError("Object not found"),
        PermissionError("row-level security"),
        RuntimeError("no bytes in storage for document 47a73155"),
    ],
    ids=lambda e: type(e).__name__,
)
def test_a_permanent_failure_is_not_swept_up_by_the_type_rule(exc):
    """⚠ The negative control. Widening must not turn every error into a retry loop."""
    assert not is_transient(exc)


def test_the_message_rule_still_works_for_exceptions_that_do_carry_words():
    """The type rule ADDS to the message rule; it must not replace it — a provider that raises a
    generic Exception carrying '503 Service Unavailable' is still transient."""
    assert is_transient(Exception("503 Service Unavailable"))
    assert is_transient(Exception("connection reset by peer"))
