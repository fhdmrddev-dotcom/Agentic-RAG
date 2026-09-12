"""BUG-260912-01 — the loop must TELL the UI when a turn's text was narration, not an answer.

⛔ THE DEFECT, AND WHY EVERY EXISTING TEST PASSED OVER IT.

`agent_loop` streams assistant text to the browser one `delta` at a time, and `delta` is
APPEND-ONLY — there is no retraction event anywhere in the protocol. When a turn ends in tool
calls the loop consumes that text into the tool-calling assistant message and resets
`full_content` to "", which is correct for persistence and for the model's own context. The
browser is told nothing. So over a five-tool run the message body accumulated every "I'll start
by…", "Now let me…", "Excellent analysis!…" the model ever wrote, with the real answer at the
bottom — while the PERSISTED row held only the final turn.

⭐ **THAT ASYMMETRY IS THE FINDING, AND IT IS WHY THE FIX IS ONE EVENT AND NOT A MIGRATION.**
Measured on the live database before writing this: an assistant message with 7 tool calls
persists **308 characters** and no narration at all. A page reload already rendered correctly.
Only the live stream lied, so only the live stream needs a new word.

⚠ **NO EXISTING TEST COULD HAVE CAUGHT THIS.** The backend tests assert what is PERSISTED, and
persistence was right. The frontend tests assert that a delta appends, and appending was right.
The defect lived in the gap between two correct halves — nothing owned the question "does the
screen still agree with the row?". That question is what these cases ask.
"""

import inspect
import re

from app.services import agent_loop


def _loop_source() -> str:
    return inspect.getsource(agent_loop)


class TestTheBoundaryIsAnnounced:
    def test_a_turn_boundary_event_is_emitted(self):
        """⛔ RED before the fix: the string `turn_boundary` did not exist in this file.

        The loop had exactly one lever for a discarded turn — `full_content = ""` — and it
        moves persistence and the model's context while leaving the screen untouched.
        """
        assert "turn_boundary" in _loop_source(), (
            "no turn_boundary event exists; the UI cannot know that a turn's text was "
            "narration, so `delta` text accumulates in the message body forever"
        )

    def test_the_boundary_is_emitted_on_the_run_stream(self):
        """It must ride the same `_emit(redis, run_id, ...)` channel as every other event."""
        assert re.search(r"_emit\(\s*redis,\s*run_id,\s*['\"]turn_boundary['\"]", _loop_source()), (
            "turn_boundary must be emitted through _emit on the run stream, like `delta`"
        )

    def test_the_boundary_is_guarded_on_there_being_something_to_fold(self):
        """⛔ An unguarded boundary makes the consumer open an EMPTY fold.

        A turn that called a tool with no preamble — the ordinary shape for a strong model —
        has no text to move. The guard is what keeps this inert for those runs (D-14's
        default-inert rule), so a model that never narrates sees byte-identical behaviour.
        """
        src = _loop_source()
        idx = src.index("turn_boundary")
        window = src[max(0, idx - 400) : idx]
        assert re.search(r"if\s+full_content\s*:", window), (
            "turn_boundary must be emitted only when full_content is non-empty"
        )


class TestTheResetIsStillTheThingThatFollows:
    """⚠ The fix must not disturb the reset it sits beside — that reset IS why persistence is right."""

    def test_full_content_is_still_reset_after_the_boundary(self):
        src = _loop_source()
        idx = src.index("turn_boundary")
        after = src[idx : idx + 600]
        assert re.search(r'full_content\s*=\s*""', after), (
            "the accumulator reset must still follow the boundary; without it iteration 2 "
            "carries iteration 1's content concatenated (Phase 076.2 Pitfall 1)"
        )

    def test_the_boundary_precedes_the_reset_and_not_the_other_way(self):
        """⛔ ORDER IS LOAD-BEARING AND FAILS SILENTLY IF REVERSED.

        `_emit` is awaited. Emitting AFTER `full_content = ""` would still compile, still pass
        every other case here, and still be wrong the day someone makes the payload carry the
        text — the guard would read an already-emptied string and the event would stop firing.
        Pinning the order now costs nothing and removes that trap.
        """
        src = _loop_source()
        emit_at = src.index("turn_boundary")
        reset_at = src.index('full_content = ""', emit_at)
        assert emit_at < reset_at
