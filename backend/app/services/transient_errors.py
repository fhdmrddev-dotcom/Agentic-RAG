"""One answer to *"is this error worth trying again?"* — Phase 240, 2026-09-09.

⛔ **WHY THIS FILE EXISTS RATHER THAN A SECOND COPY OF THE TUPLE.** The terms below lived inline
in `ingestion_queue_service._process_job`, where the queue uses them to decide whether a failed
job is retried or given up on. The attachment loop needed the same judgement and would have had
to spell it again — and a spelled-again rule is exactly how the queue path and the legacy path
have now disagreed **five** times (BUG-260905-06, the empty-chunk refusal, the Phase 234
provenance carry, the attachment loop itself, and the retry this module was written for).

⚠ **THE TEST ASSERTS IDENTITY, NOT EQUALITY** (`is`, not `==`), so a second copy that merely
happens to match today still reds. Equality would go green on a copy and silently allow drift.

⚠ **DELIBERATELY A SUBSTRING MATCH ON THE MESSAGE, and that is a known weakness rather than an
oversight.** It is what the queue has always done, and changing the CLASSIFIER while moving it
would make the move unprovable. A stronger rule — exception types, or a provider's own retryable
flag — is a change to make on purpose, with its own driving test.
"""

from __future__ import annotations

#: Substrings that mark a failure as worth retrying. Moved here verbatim from the queue.
TRANSIENT_TELLS: tuple[str, ...] = (
    "timeout",
    "timed out",
    "503",
    "502",
    "504",
    "connection",
    "reset by peer",
)


def is_transient(exc: BaseException | str) -> bool:
    """True when the message carries one of `TRANSIENT_TELLS`.

    ⛔ **`"timed out"` IS A SEPARATE ENTRY BECAUSE `"timeout"` DOES NOT MATCH IT.** The queue's
    list has always carried `"timeout"` and its comment has always read *"Transient: timeouts,
    5xx, network resets"* — but the text a socket read timeout actually carries is
    `timed out`, with a space, and `"timeout" in "timed out"` is **False**.

    ⚠ **So the queue's retry has never fired on the commonest transient failure there is.** The
    intent was in the comment and the tuple did not implement it. Found by driving the
    operator's real attachment failure on 2026-09-09, not by reading this list — and it is
    written down here because the same words had been sitting in the queue looking correct.

    ⚠ **THIS WIDENS WHAT THE QUEUE RETRIES**, which is the intended repair and not a side
    effect: a read timeout now backs off and tries again instead of failing a document
    permanently on one stall.
    """
    return any(term in str(exc).lower() for term in TRANSIENT_TELLS)
