# Phase 063 — Deferred Items

Items discovered during execution that are out of scope for the current
plan and explicitly deferred (per plan objectives or scope boundary).

## Discovered during 063-02 execution (2026-05-03)

### Contract-incompatible legacy SSE-on-POST tests

The 063-02-PLAN objective states: *"any contract-incompatible 058/059/061
tests are deferred to Plan 05's audit-driven rewrite"*. The following test
function exercises the legacy `POST /threads/{tid}/messages` SSE-streaming
contract that D-063-01 hard-cutover removed; it asserts on `delta` / `done`
/ `stream_end` event types that no longer arrive on POST (POST now returns
JSON synchronously and the SSE flow lives at `GET /runs/{rid}/stream`):

| Test file | Test function | Failure mode after 063-02 | Disposition |
|-----------|---------------|---------------------------|-------------|
| `backend/tests/integration/test_059_disconnect.py` | `test_normal_stream_unchanged` | `AssertionError: Expected 'delta' event in stream; got types=[]` — POST no longer streams; wire format moved to `GET /runs/{rid}/stream` | Rewrite or delete in Plan 05 (handled by 063-LEGACY-TEST-AUDIT.md from Plan 01) |

Mock-based tests that don't exercise SSE-on-POST continue to pass post-063-02
(test_058_concurrency.py, test_061_runs_table.py, test_061_consumer_cursor_race.py,
all of test_062_*). Verified in 063-02-SUMMARY.md.

No new deferred items beyond this one — Plan 05's existing audit document
(`063-LEGACY-TEST-AUDIT.md`) is the canonical home for the rewrite/delete
disposition list.
