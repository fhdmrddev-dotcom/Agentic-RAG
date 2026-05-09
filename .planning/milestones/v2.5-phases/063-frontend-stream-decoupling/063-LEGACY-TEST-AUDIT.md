# Phase 063 — Legacy POST-SSE Test Audit

**Audit status:** resolved
**Audit run:** 2026-05-03
**Resolved by:** Phase 063 Plan 05 (executor)
**Audited by:** Phase 063 Plan 01 Wave-0 stub task (executor)

**Audit commands run:**
- `cd backend && grep -rln 'EventSourceResponse\|/threads/[^/]*/messages.*ac.stream\|client.stream.*messages' tests/integration/`
- `cd backend && grep -rln 'streamMessage' tests/`
- `cd backend && grep -rn 'ac\.stream\|client\.stream' tests/integration/test_058_*.py tests/integration/test_059_*.py tests/integration/test_061_*.py tests/integration/test_062_*.py`
- `cd backend && grep -rn '/messages' tests/integration/test_058_*.py tests/integration/test_059_*.py tests/integration/test_061_*.py tests/integration/test_062_*.py`

This document inventories every backend integration test that POSTs to
`/threads/{thread_id}/messages` and reads SSE off the response (the
legacy POST-SSE shape that D-063-01 hard-cutover deletes). Plan 05 uses
this catalog as a checkable input — every test below gets a disposition.

## Inherited Exclusions (from 062-VERIFICATION.md `inherited_exclusions`)

These four tests are already excluded from Phase 062's full-suite verify
command per `DEF-061.1-01` and `DEF-061.1-02`. Phase 063 inherits the
exclusions verbatim — they are out of 063 scope.

| Test                                                     | Source         | Disposition                              |
| -------------------------------------------------------- | -------------- | ---------------------------------------- |
| `test_normal_stream_unchanged`                           | DEF-061.1-01   | ✅ Inherit exclusion (out of 063 scope)  |
| `test_failed_run_expires_60s`                            | DEF-061.1-02   | ✅ Inherit exclusion (out of 063 scope)  |
| `test_120s_timeout_fires_full_finally`                   | DEF-061.1-02   | ✅ Inherit exclusion                     |
| `test_producer_continues_after_consumer_disconnect`      | DEF-061.1-02   | ✅ Inherit exclusion                     |

These names are preserved verbatim so Phase 063 Plan 05 can match them
against the `-k 'not (...)'` filter clause in 063-VALIDATION.md "Backend
full suite" command.

## New 063 Audit Findings

The grep below catches every test file that touches the legacy POST-SSE
contract. For each test function, the disposition column tells Plan 05
exactly what to do:

| Test File                                                                   | Test Name                                                  | POSTs to /threads/{tid}/messages? | Reads SSE off POST response? | Disposition (Plan 05)              |
| --------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------- | ---------------------------- | ---------------------------------- |
| backend/tests/integration/test_058_concurrency.py                          | `test_cross_tab_unblocked_during_sse`                      | yes (via `_consume_sse` helper at line 154) | yes — `aiter_lines()` over `client.stream("POST", ...)` | ✅ rewrite-to-get-stream — D-058-09 cross-tab gate is still relevant; rewrite to POST→assert-201→GET-stream and keep the cross-tab GET timing assertion against the GET stream's open period (Plan 05: `_consume_sse` now does POST→JSON→GET-stream; cross-tab GET still races against the slow messages-INSERT inside the POST handler, the original D-058-09 surface) |
| backend/tests/integration/test_059_disconnect.py                           | `test_agent_task_SURVIVES_on_disconnect`                   | yes (via `_drive_sse_until_disconnect` ASGI helper at line 270) | yes — drives ASGI scope POST + reads body chunks | ✅ rewrite-to-get-stream — D-061-16 producer-survives-disconnect contract preserved (Plan 05: helper renamed to `_post_then_drive_get_stream_until_disconnect`; performs POST via httpx then drives GET /runs/{rid}/stream via raw ASGI scope, injects http.disconnect after first body chunk; legacy alias `_drive_sse_until_disconnect` preserved for cross-import compat) |
| backend/tests/integration/test_059_disconnect.py                           | `test_normal_stream_unchanged`                             | yes (line 357 `c.stream("POST", ...)`) | yes — `aiter_lines()` for stream_end | ✅ inherit-existing-exclusion (DEF-061.1-01) — preserved verbatim; canonical -k filter excludes |
| backend/tests/integration/test_061_hard_timeout.py                         | `test_120s_timeout_fires_full_finally`                     | yes (line 62 `c.stream("POST", ...)`)| yes — `aiter_lines()` | ✅ inherit-existing-exclusion (DEF-061.1-02) — preserved verbatim; canonical -k filter excludes |
| backend/tests/integration/test_061_producer_survives_disconnect.py         | `test_producer_continues_after_consumer_disconnect`        | yes (uses cross-tab GET on /threads/{tid}/messages line 105 — distinct from POST-SSE) | no — line 105 is a plain `ac.get(...)` against a different endpoint shape than the legacy POST-SSE; the test's POST surface is wrapped via `_drive_sse_until_disconnect`-style internals shared with 059 | ✅ inherit-existing-exclusion (DEF-061.1-02) — preserved verbatim; canonical -k filter excludes |
| backend/tests/integration/test_061_runs_table.py                           | `test_runs_lifecycle_row`                                  | yes (line 49 `c.stream("POST", ...)`) | yes — `aiter_lines()` | ✅ rewrite-to-get-stream — Plan 05: `c.stream("POST", ...)` replaced with plain `c.post(...)` asserting 201; producer still spawned in send_message; downstream `await_producer_finalized(mock_supabase)` drives finalize so the runs INSERT/UPDATE call_args assertion is unchanged |
| backend/tests/integration/test_061_runs_table.py                           | `test_rls_policy_present_in_full_schema`                   | no — schema-grep test only          | no                           | ✅ keep-as-is (no POST, no SSE)                |
| backend/tests/integration/test_061_ttl.py                                  | `test_completed_run_expires_600s`                          | yes (line 52 `c.stream("POST", ...)`)| yes — `aiter_lines()` | ✅ rewrite-to-get-stream — Plan 05: rewritten to POST→assert-201→`await_producer_finalized`; D-061-04 EXPIRE 600s invariant still asserts via `redis_client.ttl(f"run:{run_id}")` after finalize |
| backend/tests/integration/test_061_ttl.py                                  | `test_failed_run_expires_60s`                              | yes (line 94 `c.stream("POST", ...)`)| yes — `aiter_lines()` | ✅ inherit-existing-exclusion (DEF-061.1-02) — preserved verbatim; canonical -k filter excludes |
| backend/tests/integration/test_062_delete_happy.py                         | `test_cancels_in_flight_producer`                          | yes (line 116 `ac.stream("POST", ...)`) | yes — `aiter_lines()` (drives producer; first chunk only) | ✅ rewrite-to-get-stream — Plan 05: `ac.stream("POST", ...)` replaced with plain `ac.post(...)` asserting 201; added `await asyncio.sleep(0.2)` between POST and DELETE so the producer task has time to enter its body before cancel arrives (Pitfall 4 — POST returns before producer's first XADD) |
| backend/tests/integration/test_062_multi_consumer_fanout.py                | `test_two_consumers_receive_identical_sequences`           | yes (line 121 `ac.stream("POST", ...)`) | yes — first chunk only (producer driver) | ✅ rewrite-to-get-stream — Plan 05: `ac.stream("POST", ...)` replaced with plain `ac.post(...)` asserting 201; downstream parallel GET-stream consumers unchanged |
| backend/tests/integration/test_062_stream_replay.py                        | `test_replay_then_tail_to_terminal`                        | yes (line 79 `ac.stream("POST", ...)`) | yes — first chunk only (producer driver) | ✅ rewrite-to-get-stream — Plan 05: `ac.stream("POST", ...)` replaced with plain `ac.post(...)` asserting 201; added `await asyncio.sleep(0.2)` so producer accumulates buffered events before GET stream's replay phase reads. Test_063_post_then_subscribe.py is the new-architecture variant; both kept until a future cleanup phase decides on duplication |
| backend/tests/integration/test_062_stream_replay.py                        | `test_replay_from_specific_offset`                         | no — pre-populates Redis directly via `xadd`, no POST | no                | ✅ keep-as-is (no POST, no SSE off POST)       |
| backend/tests/integration/test_062_stream_terminal.py                      | `test_*` (GET stream tests, line 65)                       | no — GET-only tests                  | no                           | ✅ keep-as-is (GET against /runs/{rid}/stream — these are 062 contract tests, not legacy POST-SSE) |
| backend/tests/integration/test_062_stream_ttl_expired.py                   | `test_*` (3 tests, lines 66/105/141)                       | no — GET-only tests                  | no                           | ✅ keep-as-is (GET against /runs/{rid}/stream — same as 062-stream-terminal) |
| backend/tests/integration/test_062_active_runs.py                          | (5 tests)                                                  | no — GET /threads/{tid}/active-runs only | no                       | ✅ keep-as-is (Phase 062 endpoint contract — uses plain `c.get`, no streaming) |
| backend/tests/integration/test_062_cross_user_404.py                       | (all)                                                      | no — assumes pre-062 contract        | no                           | ✅ keep-as-is (cross-user IDOR coverage, no POST-SSE)            |
| backend/tests/integration/test_062_redis_down.py                           | (all)                                                      | no — Redis-down 503 path             | no                           | ✅ keep-as-is (no POST, no SSE)                                 |
| backend/tests/integration/test_062_delete_terminal_idempotent.py           | (all)                                                      | no — DELETE /runs/{rid} idempotency  | no                           | ✅ keep-as-is (no POST, no SSE)                                 |
| backend/tests/integration/test_062_delete_zombie.py                        | (all)                                                      | no — DELETE zombie-heal              | no                           | ✅ keep-as-is (no POST, no SSE)                                 |
| backend/tests/integration/test_061_consumer_cursor_race.py                 | (all)                                                      | no — race-condition unit (no /messages) | no                        | ✅ keep-as-is (no POST, no SSE)                                 |
| backend/tests/integration/test_threads.py                                  | (matched on `/threads/.*messages`)                          | uses POST/GET against /messages but as plain JSON — no SSE | no       | ✅ keep-as-is (REST contract tests, not streaming)               |
| backend/tests/integration/test_threads_skills.py                           | (matched on `/threads/.*messages`)                          | uses POST/GET against /messages but as plain JSON — no SSE | no       | ✅ keep-as-is (REST contract tests, not streaming)               |

## Summary by Disposition

| Disposition                          | Count |
| ------------------------------------ | ----- |
| rewrite-to-get-stream                | 6     |
| inherit-existing-exclusion           | 4     |
| delete-redundant-with-062            | 0     |
| delete-bound-to-removed-code         | 0     |
| keep-as-is                           | 13+   |
| INVESTIGATE                          | 0     |

## Disposition Codes

- **rewrite-to-get-stream**: test still has value; rewrite the spawn step
  to POST→assert-201→GET-stream so the test exercises the new D-063-01
  contract while preserving its original assertion intent.
- **delete-redundant-with-062**: test logic is fully covered by an
  existing `test_062_*.py  case; delete to avoid duplicate coverage.
- **delete-bound-to-removed-code**: test exercises the deleted
  `event_consumer` or its closure; delete (no replacement needed —
  `test_063_legacy_path_deleted.py  covers the absence guard).
- **inherit-existing-exclusion**: already excluded per DEF-061.1-01/02 —
  leave alone; the `-k 'not (...)'` filter in 063-VALIDATION.md keeps
  these out of the verify suite.
- **keep-as-is**: test does NOT actually use the legacy SSE-on-POST
  shape (false positive in grep — usually a GET-stream test against
  `/runs/{rid}/stream`, or a plain JSON REST test against
  `/threads/{tid}/messages`).
- **INVESTIGATE**: requires a Plan 05 reviewer to choose between
  rewrite-to-get-stream and a deletion code; record the open question
  here so it cannot be silently skipped.

## Notes for Plan 05

- The six `rewrite-to-get-stream` tests share a common shape — the POST
  is used to spawn the producer, and the SSE drain is incidental. Plan
  05 can extract a shared helper (`_post_and_get_run_id` returning the
  run_id from the JSON envelope) once instead of inlining the rewrite
  in each test.
- `test_062_stream_replay.py::test_replay_then_tail_to_terminal` is the
  borderline case — once `test_063_post_then_subscribe.py  is GREEN, the
  062 test exercises a strict superset minus the cross-phase boundary.
  Reviewer may opt for `delete-redundant-with-063` instead of
  `rewrite-to-get-stream` if duplication is the bigger concern.
- All 4 inherited exclusions are preserved by name in the
  063-VALIDATION.md `-k` filter; Plan 05 must not accidentally re-include
  them. The four names are:
  - `test_normal_stream_unchanged`
  - `test_failed_run_expires_60s`
  - `test_120s_timeout_fires_full_finally`
  - `test_producer_continues_after_consumer_disconnect`
