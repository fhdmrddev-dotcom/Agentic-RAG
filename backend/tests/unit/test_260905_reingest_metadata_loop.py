"""BUG-260905-13 — the non-queue ingest path lost its metadata to a running event loop.

⛔ THE OPERATOR'S BACKEND LOG IS WHAT IDENTIFIED THIS, and the warning is the signature:

    ingest_enrich.py:236: RuntimeWarning: coroutine 'extract_metadata_enriched'
                          was never awaited
      metadata_dict = None

"never awaited" means the coroutine object was constructed and `asyncio.run()` threw before
running it. `asyncio.run()` raises when a loop is already running in the calling thread.

`splice_document` is `async def`; `ingest_document` is SYNC and reaches
`asyncio.run(extract_metadata_enriched(...))` through `enrich_for_ingest`. Calling it inline
from the loop therefore degraded EVERY `/upload` and `/reingest` to `metadata=None`, while
documents that went through the durable QUEUE hit the `run_in_threadpool` call further down
and kept all seven fields. Same file, same request, two different answers.
"""
from __future__ import annotations

import asyncio
import inspect
import re

import pytest


def test_asyncio_run_is_what_breaks_inside_a_running_loop():
    """The mechanism itself, pinned — so the fence below is not a mystery."""
    async def outer():
        async def inner():
            return "ok"

        with pytest.raises(RuntimeError):
            asyncio.run(inner())          # the exact call enrich_for_ingest makes
        return True

    assert asyncio.run(outer())


def test_the_non_queue_delegation_runs_ingest_document_off_the_event_loop():
    """⛔ THE FENCE. `splice_document` must not call the sync `ingest_document` inline.

    Read from source rather than mocked, because the defect is not a wrong VALUE — it is a
    call made on the wrong thread, which every mock of `ingest_document` would hide.
    """
    from app.services import ingest_splice

    src = inspect.getsource(ingest_splice.splice_document)
    i = src.index("from app.api.documents import ingest_document")
    window = src[i : i + 700]

    assert "run_in_threadpool" in window, (
        "the non-queue branch calls ingest_document inline in the event loop; "
        "asyncio.run inside enrich_for_ingest will raise and metadata degrades to None"
    )
    # The delegation must be awaited — a bare run_in_threadpool(...) returns a coroutine
    # nobody runs, which would skip ingestion entirely rather than merely lose metadata.
    assert re.search(r"await\s+run_in_threadpool\(\s*ingest_document", window), (
        "the threadpool delegation is not awaited"
    )
