"""2026-08-31 — A RUN THAT HAS JUST STARTED IS NOT A TTL-EXPIRED ONE.

⚠ MEASURED IN A REAL BROWSER, AND DETERMINISTIC. Opening `GET /runs/{id}/stream` 0 ms
after `POST /threads/{id}/messages` returned answered
`{"type":"error","error":"buffer_expired_while_streaming"}` and closed the connection —
on a run that was perfectly healthy and went on to complete. The same sequence with a
150 ms delay streamed normally. Four delays, one outcome each: 0 → dead; 150, 400, 1000 →
fine.

⚠ THE CODE CALLED THIS CASE IMPOSSIBLE. `_synthetic_terminal_generator`'s docstring reads
*"Defensive case: status='streaming' with redis.exists=0 shouldn't happen"* — which is
exactly why it was handled as a hard terminal instead of as a wait. It happens on EVERY
send: the producer is a DETACHED task, so the POST returns a run id before that task has
XADDed anything, and `run:{id}` does not exist until the first event.

⚠ AND NO DRIVE SCRIPT IN THIS REPO COULD EVER HAVE SEEN IT. They are Python clients
against `http://localhost:8000`; `localhost` resolves `::1` first and this backend binds
IPv4 only, so urllib stalls ~2 s on every connection — measured 4 ms on `127.0.0.1`
against 2048 ms on `[::1]` — and always loses the race by a mile. Chrome connects in
~40 ms and loses it the other way. **A harness slower than the bug cannot see the bug**,
and every one of this session's own SSE drives was that harness.

── WHY THE FIX IS SAFE ────────────────────────────────────────────────────────────────
A TTL-expired run is by definition OLD, and an old run has a TERMINAL status — the
producer's shielded finalizer writes one on every exit path, including cancellation and
timeout. So `streaming` + missing key means "not yet", never "gone". The bounded wait
applies to that case ALONE; a genuinely expired run still gets its synthetic terminal
with no delay whatsoever, which is what these cases pin from both sides.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

RUNS = Path(__file__).resolve().parents[2] / "app" / "api" / "runs.py"
SRC = RUNS.read_text(encoding="utf-8")


def _stream_route_source() -> str:
    tree = ast.parse(SRC)
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "stream_run":
            return ast.get_source_segment(SRC, node) or ""
    raise AssertionError("stream_run not found in runs.py")


def test_a_nonterminal_run_with_no_buffer_is_WAITED_for_not_declared_expired():
    body = _stream_route_source()
    assert "_RUN_STATUS_TO_TERMINAL_TYPE" in body, (
        "the wait must be gated on the run's status being NON-terminal — without that "
        "gate a genuinely expired run would be delayed for nothing"
    )
    assert "_NASCENT_BUFFER_WAIT_SECONDS" in body
    # The gate reads "no buffer AND the status is not one of the terminal ones".
    assert re.search(
        r"if not buffer_exists and row\.get\(\"status\"\) not in _RUN_STATUS_TO_TERMINAL_TYPE",
        body,
    ), "the nascent-buffer wait is not gated the way the fix requires"


def test_the_wait_is_BOUNDED_so_a_dead_producer_cannot_hold_the_connection():
    """A retry loop with no ceiling turns one broken run into a leaked connection."""
    import app.api.runs as runs

    assert 0 < runs._NASCENT_BUFFER_WAIT_SECONDS <= 10, (
        "the wait must be bounded and short — the observed race is well under 150ms"
    )
    assert 0 < runs._NASCENT_BUFFER_POLL_SECONDS <= 0.5
    # Enough polls to actually catch a sub-second race rather than sampling twice.
    assert runs._NASCENT_BUFFER_WAIT_SECONDS / runs._NASCENT_BUFFER_POLL_SECONDS >= 10


def test_a_TERMINAL_run_with_no_buffer_still_short_circuits_with_no_wait():
    """⚠ THE OTHER HALF, AND THE ONE A CARELESS FIX BREAKS. A completed run whose buffer
    has aged out is the case `_synthetic_terminal_generator` was BUILT for (D-062-06), and
    it must still answer instantly — waiting three seconds to tell someone about a run
    that finished yesterday would be a new defect wearing the old one's fix."""
    body = _stream_route_source()
    # ⚠ THE CALL SITE, NOT THE NAME. The first mention of `_synthetic_terminal_generator`
    # in this route is inside the comment explaining the fix, so an `index()` on the bare
    # identifier compares against PROSE and fails on correct code — which is exactly what
    # it did the first time this case ran.
    assert "_synthetic_terminal_generator(" in body, (
        "the TTL-expired path must survive — it is the reason this branch exists"
    )
    wait_at = body.index("_NASCENT_BUFFER_WAIT_SECONDS")
    synth_call_at = body.rindex("_synthetic_terminal_generator(")
    assert wait_at < synth_call_at, (
        "the wait must precede, not replace, the synthetic terminal"
    )


def test_a_producer_that_wrote_nothing_is_LOGGED_not_silently_synthesised():
    """If the wait elapses, that is a real fault: a producer that never emitted one event.
    The synthetic terminal hides it from the client, so the log is the only place it can
    be seen at all."""
    body = _stream_route_source()
    assert "wrote no buffer within" in body


def test_redis_failing_MID_WAIT_falls_through_rather_than_503ing():
    """The run row is real and already validated; a clean terminal close beats a 503 for a
    caller who has been waiting."""
    body = _stream_route_source()
    tail = body[body.index("_NASCENT_BUFFER_WAIT_SECONDS"):]
    assert "break" in tail
    assert "Redis probe failed while waiting" in tail


def test_the_terminal_status_map_is_the_one_the_producer_writes():
    """The gate is only correct while these four are exactly the statuses a finished run
    can carry — a fifth added to the producer without being added here would make that
    run wait three seconds for a buffer that will never come."""
    from app.services.run_transport import _RUN_STATUS_TO_TERMINAL_TYPE

    assert set(_RUN_STATUS_TO_TERMINAL_TYPE) == {
        "completed", "failed", "cancelled", "timed_out",
    }
