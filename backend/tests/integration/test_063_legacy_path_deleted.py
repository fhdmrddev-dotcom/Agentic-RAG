"""D-063-01 hard-cutover guards: prove the legacy POST-SSE code path is gone.

Phase 063 Plan 01 (Wave 0). Pure Python static-check tests — no httpx,
no Redis, no fixtures. They prove two things at the source level:

  1. ``event_consumer`` (the legacy SSE generator at threads.py:331-426)
     is no longer importable from ``app.api.threads``.
  2. ``send_message`` (the POST handler at threads.py:727-2244) does NOT
     reference ``EventSourceResponse`` and DOES reference either
     ``JSONResponse`` or status code ``201`` — i.e., the new D-063-01
     contract has shipped.

Per D-063-01 ("Hard cutover"): the ROADMAP risk note explicitly mandates
"don't keep two streaming code paths longer than one phase — choose one,
deprecate the other, delete dead code in this phase." These tests fail
LOUDLY if the old path leaks into a later commit by accident.

RED reason at this commit: ``event_consumer`` IS still defined at
threads.py:331-426 and ``send_message`` STILL returns
``EventSourceResponse(event_consumer(...))`` — both assertions fail with
recognizable contract errors. NOT collection / import errors (the
imports themselves succeed; it's the existence checks that fail).

Pattern: lightweight mock-only style mirroring test_062_active_runs.py
(no fixtures), but no HTTP layer at all — just AST inspection via
``inspect.getsource``. T-063-01-02 disposition: read-only inspection,
cannot mutate state.
"""


def test_event_consumer_not_importable():
    """D-063-01: event_consumer at threads.py:331-426 must be DELETED.

    On master this RED-fails with the exact assertion message below — the
    function still exists at module scope. Plan 02 deletes it; this test
    flips green automatically once the deletion lands.
    """
    from app.api import threads as threads_module
    assert not hasattr(threads_module, "event_consumer"), (
        "event_consumer is still defined in app.api.threads — "
        "D-063-01 hard cutover not complete"
    )


def test_post_does_not_return_eventsourceresponse():
    """D-063-01: POST send_message must return JSONResponse, not EventSourceResponse.

    Static-source check via ``inspect.getsource``. On master, the function
    body still contains ``return EventSourceResponse(event_consumer(...))``
    at threads.py:2241-2244, so the first assertion RED-fires. After Plan
    02 the body contains ``return JSONResponse(status_code=201, ...)`` and
    both assertions pass.
    """
    import inspect
    from app.api.threads import send_message

    src = inspect.getsource(send_message)
    assert "EventSourceResponse" not in src, (
        "send_message still references EventSourceResponse — "
        "D-063-01 not complete"
    )
    # Either name-import (JSONResponse) or status code 201 must appear in
    # the new return path. Plan 02's pattern (063-PATTERNS.md) uses both.
    assert "JSONResponse" in src or "201" in src, (
        "send_message must return JSONResponse with status 201 "
        "(D-063-01 contract)"
    )
