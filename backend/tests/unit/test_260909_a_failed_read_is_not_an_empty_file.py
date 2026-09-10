"""A storage read that FAILED is not a file that is EMPTY — measured 2026-09-09.

⛔ **THE FAILURE, ON THE OPERATOR'S REAL WATCH.** A watched email reported:

    no bytes in storage for document 47a73155-ee9f-4650-8880-5ccbef929b5a

**The bytes were in storage the whole time** — 145,843 of them, uploaded at `22:13:53.733`, size
matching `documents.file_size` exactly. The log tells the rest in one line each:

| Time | Event |
|---|---|
| `22:13:53.733` | the storage upload POST **succeeds** |
| `22:13:55.775` | the document row is read |
| — | **20.010 s with no log line at all** |
| `22:14:15.785` | `Storage download failed … ` — the read times out |
| `22:14:15.785` | the empty-bytes guard fires: *"has a storage_path but no bytes"* |
| `22:14:15.813` | the queue marks the job **permanently failed** |

## Why one swallowed exception cost the document

`splice_document` caught the download failure and substituted `raw = b""`. From that line on,
nothing could tell *"storage says this file is empty"* from *"we could not read storage"* — and
the two need opposite handling:

- **empty** is terminal: refuse, and tell the person (BUG-260905-08's guard, which is correct);
- **unreadable** is transient: try again.

Because the timeout had already been rewritten into `RuntimeError("no bytes in storage …")`, the
queue's transient classifier saw a message with no timeout in it and **failed the job permanently
after one attempt** — `retry_count = 1`, `max_retries = 3`. The retry existed and could not fire.

⚠ **AND THE PERSON WAS TOLD THE WRONG THING**: *"The stored copy of this file could not be read,
so nothing was extracted from it. Please upload it again."* The file was intact. Re-uploading was
never the remedy.

⚠ **THIS IS THE SAME 20-SECOND STALL** already measured in `email_attachments.py` — GIL contention
inflating a local call that takes 0.03-0.56 s idle. Here it hit a DOWNLOAD instead of an upload,
which is why the symptom looked like missing data rather than a slow network.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services.ingest_splice import splice_document

USER_ID = "00000000-0000-0000-0000-000000000001"
DOC_ID = "22222222-2222-2222-2222-222222222221"
STORAGE_PATH = f"{USER_ID}/{DOC_ID}/mail.eml"


def _query_builder():
    b = MagicMock()
    for verb in ("eq", "neq", "is_", "order", "limit", "maybe_single", "single", "insert",
                 "update", "select", "delete"):
        getattr(b, verb).return_value = b
    b.execute.return_value = MagicMock(data=[], count=0)
    return b


def _supabase():
    client = MagicMock()
    client.table.side_effect = lambda _name: _query_builder()
    client.storage = MagicMock()
    client.storage.from_.return_value = MagicMock()
    return client


async def _run(supabase, *, job_id="33333333-3333-3333-3333-333333333333"):
    await splice_document(
        document_id=DOC_ID,
        raw=b"",                     # forces the storage read, exactly as the queue path does
        mime_type="message/rfc822",
        filename="mail.eml",
        user_id=USER_ID,
        storage_path=STORAGE_PATH,
        supabase=supabase,
        job_id=job_id,
    )


async def test_a_transient_download_failure_is_raised_so_the_queue_can_retry():
    """⭐ THE ONE THAT MATTERS. The bytes exist; the read stalled. That must be retryable.

    ⚠ It asserts the message still carries the transient tell, because that string is what
    `ingestion_queue_service` classifies on. An exception that reaches the queue describing
    itself as *"no bytes in storage"* is judged permanent and the retry never fires.
    """
    supabase = _supabase()
    supabase.storage.from_.return_value.download.side_effect = TimeoutError("timed out")

    with pytest.raises(Exception) as exc_info:
        await _run(supabase)

    message = str(exc_info.value).lower()
    assert "no bytes in storage" not in message, (
        "a failed READ was reported as an EMPTY FILE — the queue then classifies it as "
        "permanent, and the document is lost to a stall that would have retried"
    )
    assert "timed out" in message or "timeout" in message, (
        f"the transient tell did not survive to the queue: {message!r}"
    )


async def test_a_genuinely_empty_object_is_still_refused_not_retried_forever():
    """⛔ THE GUARD THIS MUST NOT WEAKEN. BUG-260905-08: a document whose bytes really are
    missing must be refused, never ingested as an empty document that reports success."""
    supabase = _supabase()
    supabase.storage.from_.return_value.download.return_value = b""

    with pytest.raises(RuntimeError, match="no bytes in storage"):
        await _run(supabase)


async def test_a_permanent_download_error_is_still_terminal():
    """⚠ A missing object is not a stall. It must NOT be handed back as retryable."""
    supabase = _supabase()
    supabase.storage.from_.return_value.download.side_effect = ValueError("Object not found")

    with pytest.raises(RuntimeError, match="no bytes in storage"):
        await _run(supabase)
