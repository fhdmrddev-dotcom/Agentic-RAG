# Phase 067.1 — Deferred Items

Items discovered during Phase 067.1 execution that are out-of-scope for
the executing plan but should not be lost. Categorized so the orchestrator
or a downstream phase can triage them.

---

## Pre-existing test failures (out of scope for Plan 01)

Verified pre-existing on the unmodified Plan 01 base
(`2914b41 docs(067.1): create phase plan (5 plans, 3 waves)`) by stashing
Track A changes and re-running the suite — both failures reproduce.

### `tests/integration/test_059_disconnect.py::test_normal_stream_unchanged`

- **Failure:** `AssertionError: Expected 'delta' event in stream; got types=[]`
- **Underlying cause:** the test's mock supabase / dependency override
  doesn't patch `create_adaptive_streaming_chat`, so the LLM client falls
  through to the real OpenAI SDK, which raises 401 with the placeholder
  `test-llm****-key` API key. The 401 is caught by the agent loop's
  `APIError` handler and emitted as `error` (not `delta`).
- **Why pre-existing:** reproduces against the base commit without any
  Track A code in scope. Probably introduced by a recent dependency or
  test-fixture change unrelated to the timeout-branch surface.
- **Suggested owner:** Phase 067.1 Plan 05 (closing UAT) or a follow-on
  test-infra-repair phase. Likely fix is a missing `patch(...)` on
  `create_adaptive_streaming_chat` in the test or a fixture autoload that
  installs it.

### `tests/integration/test_061_producer_survives_disconnect.py::test_producer_continues_after_consumer_disconnect`

- **Failure:** `ValueError: too many values to unpack (expected 2)` at
  `test_061_producer_survives_disconnect.py:78`
- **Underlying cause:** the test calls
  `(stream, calling_mode) = create_adaptive_streaming_chat(...)` against
  a side-effect that returns a 3-tuple (or a non-tuple). The signature on
  the LLM-client side has not visibly changed, so the regression is
  test-internal — possibly a stale fixture left over from Phase 061
  Plan 05's test additions.
- **Why pre-existing:** reproduces against the base commit without Track A.
- **Suggested owner:** same as above. The fix is a one-line update to the
  test's mocked side_effect to match the current
  `create_adaptive_streaming_chat` return shape.

---

## Notes for the orchestrator

- Track A's positive-assertion test (`test_track_a_clean_trace_exception`)
  is brand new and gates Plan 01's SC#1 — DO NOT regress it.
- The Phase 061 grep-defense tests in
  `backend/tests/integration/test_061_hard_timeout.py` were updated for
  Track A; their semantic intent is preserved (per-call deadline reaches
  both branches; SDK close() bind is wired symmetrically).
