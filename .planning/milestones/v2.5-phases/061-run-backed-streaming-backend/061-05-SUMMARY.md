---
phase: 061-run-backed-streaming-backend
plan: 05
subsystem: tests
tags: [pytest, pytest-asyncio, redis-streams, async-mock, integration-tests, contract-inversion, verification-doc]

# Dependency graph
requires:
  - phase: 061-run-backed-streaming-backend
    plan: 02
    provides: supabase/migrations/035_runs_table.sql + RLS policy in supabase/full-schema.sql (asserted by test_061_runs_table::test_rls_policy_present_in_full_schema)
  - phase: 061-run-backed-streaming-backend
    plan: 03
    provides: app.api.threads._emit / _emit_terminal / TERMINAL_TYPES / RUN_TASKS / agent_runner / event_consumer (imported by 6 of the 8 test files)
  - phase: 061-run-backed-streaming-backend
    plan: 04
    provides: backend/tests/conftest.py redis_client async fixture + _flushdb_at_session_end session-end hygiene (used by all 4 new integration tests + the rewritten test_059)
provides:
  - "Eight new/modified test files exercising every Phase 061 success criterion (SC#1..SC#8) and decision (D-061-01, D-061-04, D-061-08, D-061-15, D-061-16)"
  - "backend/tests/integration/_run_helpers.py shared helper module with _extract_run_id_from_mock for the four 061 integration tests"
  - "Extended _build_mock_supabase() in test_058_concurrency.py to route the 'runs' table through a per-table builder (single source of truth across 061 tests)"
  - "Inverted disconnect-cancel contract test (D-061-16) with explicit D-v2.5-08 + Phase 061 references in file docstring AND commit message"
  - ".planning/phases/061-run-backed-streaming-backend/061-VERIFICATION.md mirroring 058/059 format with the binding-test results table, contract-inversion section, and manual two-tab DevTools checklist"
affects: [062-replay-and-tail-api, 063-frontend-stream-decoupling, 064-validation-harness]

# Tech tracking
tech-stack:
  added:
    - "(none — Plan 05 is test-only; reuses existing pytest + pytest-asyncio + redis-py-async + httpx + AsyncMock stack)"
  patterns:
    - "Cross-import 058 helpers verbatim (058 -> 059 -> 061 chain) — PATTERNS.md established convention; no premature extraction to a _sse_helpers.py module"
    - "Absolute-path imports across sibling test files (`from tests.integration._run_helpers import ...`) — relative imports break collect-time module resolution under pytest"
    - "Per-table mock-Supabase routing in _build_mock_supabase — extending the 058 helper in place is the right move per PATTERNS.md (single source of truth) over per-test monkey-patching"
    - "Contract-inversion documentation rule (Plan 05 Task 3): any test rewrite that flips an assertion's polarity MUST land with both a file-docstring reference and a commit-message reference to the source decision (here D-v2.5-08 + D-061-16) — protects future reviewers from misreading the change as a regression"
    - "DDL-inspection variant of RLS testing (deviation): the SC#5b assertion is a static read of supabase/full-schema.sql for `CREATE POLICY runs_select_own` — the live RLS enforcement is covered by Plan 02's [BLOCKING] schema-push verification (queries pg_policies). Combined coverage is sufficient for 061 scope; full real-Postgres dual-user substrate deferred"

key-files:
  created:
    - backend/tests/unit/test_061_emit_helper.py
    - backend/tests/unit/test_061_consumer.py
    - backend/tests/unit/test_health.py
    - backend/tests/integration/_run_helpers.py
    - backend/tests/integration/test_061_producer_survives_disconnect.py
    - backend/tests/integration/test_061_ttl.py
    - backend/tests/integration/test_061_runs_table.py
    - backend/tests/integration/test_061_hard_timeout.py
    - .planning/phases/061-run-backed-streaming-backend/061-VERIFICATION.md
  modified:
    - backend/tests/integration/test_058_concurrency.py   # extended _build_mock_supabase with 'runs' builder
    - backend/tests/integration/test_059_disconnect.py    # D-061-16 contract inversion
    - backend/tests/integration/test_health.py            # accept new {status, redis} body shape

key-decisions:
  - "D-v2.5-08 honored: every new integration test uses the redis_client fixture and exercises the real Docker Redis Stream, not fakeredis"
  - "D-061-16 contract inversion landed atomically: file docstring + commit message both reference D-v2.5-08 and Phase 061; the original `count_after == 0` assertion is fully removed (only a free-text comment about the historical behavior remains, which does NOT contain the literal `count_after == 0` token)"
  - "PATTERNS.md cross-import chain extended (058 -> 059 -> 061): six of the eight test files cross-import 058 helpers; the four new 061 integration tests also import 059's _slow_chunks/_drive_sse_until_disconnect/_reset_sse_starlette_app_status. _run_helpers.py is the single absolute-import target for the new helper (_extract_run_id_from_mock) — relative imports across siblings rejected"
  - "_build_mock_supabase extended in place (Step 0a) instead of monkey-patching the 'runs' route across four integration tests — single source of truth for the per-table mock"
  - "DDL-inspection RLS variant adopted (TBD-07 deviation, documented in plan frontmatter) — Plan 05 does not introduce a real-Supabase dual-user substrate; the static `CREATE POLICY runs_select_own` check + Plan 02's live pg_policies check together provide sufficient coverage for 061 scope. Full real-Postgres dual-user substrate is deferred to a future Phase 064."
  - "Sandbox-blocked runtime execution: per the prompt's explicit guidance and prior wave executor experience, direct `venv/Scripts/python` invocation is blocked from this executor. Static gates (file presence + AST parse + grep counts) are all green at commit time; runtime test execution is deferred to /gsd:verify-work or to the user. The 11 binding-test commands are documented in 061-VERIFICATION.md so the verifier (or user) can run them with a single copy-paste."
  - "VALIDATION.md frontmatter (`nyquist_compliant: true`, `wave_0_complete: true`) NOT toggled by this commit — the plan output spec ties those flags to confirmed-green binding tests, which the verifier owns."

requirements-completed: [STREAM-04]

# Metrics
duration: ~10min
completed: 2026-05-02
---

# Phase 061 Plan 05: Binding Tests + 061-VERIFICATION.md Summary

**Eight test files (5 new integration, 1 rewritten integration carrying the D-061-16 contract inversion, 2 new unit, 1 unit-style health) plus the 061-VERIFICATION.md merge gate — every binding test from VALIDATION.md TBD-01..11 lands as a concrete file with the exact pytest command in its acceptance criteria, and the rewritten test_059_disconnect.py carries explicit D-v2.5-08 + Phase 061 references in both its docstring and its commit message so a future reviewer cannot mistake the inversion as a regression.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-02T17:21:07Z
- **Completed:** 2026-05-02T17:30:51Z
- **Tasks:** 4 (1 commit each)
- **Files changed:** 12 total — 9 created, 3 modified

## Accomplishments

### Task 1 — Unit tests (TBD-01 / TBD-02 / TBD-03)

Three new unit-style files following the existing `tests/unit/test_settings.py` function-style pattern (no fixtures touched in conftest):

- **`backend/tests/unit/test_061_emit_helper.py`** — three tests covering `_emit` XADD payload shape (single-field `data`, MAXLEN=10000, approximate=True), `_emit_terminal` no-MAXLEN guarantee (Pitfall 5), and the TERMINAL_TYPES assertion guard.
- **`backend/tests/unit/test_061_consumer.py`** — three tests. The headline test (`test_xread_advances_last_id`) replicates the consumer's cursor-advancement contract via stub-driven xread with a side_effect list and asserts the second observed `last_id` is the actual replay-returned id, NOT `$` or `0` (Pitfall 1). Two additional tests assert `done`, `error`, `cancelled` are in `TERMINAL_TYPES` and `delta` is not (D-061-12).
- **`backend/tests/unit/test_health.py`** — two tests. `test_health_includes_redis_status` asserts the new `{status, redis}` body shape (SC#6). `test_health_redis_unreachable_does_not_500` patches `get_redis()` so its `ping()` raises, then asserts (a) HTTP 200, (b) body redis='unreachable', (c) the response body NEVER leaks `settings.redis_url`, the host:port, or the underlying exception message (T-061-05 mitigation).

The existing `backend/tests/integration/test_health.py::TestHealth::test_health_returns_ok_status` was updated from `== {"status": "ok"}` to allow the new `redis` discriminator field — environment-agnostic so it holds whether Redis is up or down.

Commit: `e555ae6` `test(061-05): add unit tests for _emit, consumer cursor, /health Redis status`

### Task 2 — Integration tests + shared helper + mock-Supabase extension (TBD-04..08)

**Step 0a (precondition for all four new integration tests):** extended `backend/tests/integration/test_058_concurrency.py::_build_mock_supabase` to route the `'runs'` table through a per-table builder. This is the PATTERNS.md-endorsed single source of truth — without it each of the four 061 integration tests would need its own monkey-patch.

**Step 0b (precondition):** created `backend/tests/integration/_run_helpers.py` with `_extract_run_id_from_mock(mock_supabase) -> str`. Imported by absolute path (`from tests.integration._run_helpers import ...`) from all four new 061 integration files AND from the rewritten test_059_disconnect.py — matches the established 058/059 cross-import convention; relative imports across sibling test files were rejected (they break collect-time module resolution under pytest).

Four new integration tests:

- **`test_061_producer_survives_disconnect.py::test_producer_continues_after_consumer_disconnect`** — D-061-15 binding gate. Drives a slow-mock-LLM (5 chunks @ 0.3s) via `_drive_sse_until_disconnect`, snapshots `XLEN` at disconnect, sleeps 5s, and asserts (a) XLEN grew, (b) a TERMINAL_TYPES sentinel landed, (c) `runs.status='completed'` UPDATE happened, (d) `xrange_count == xlen_final` (Pitfall 1 parity guard), AND (e) an INLINE parallel `httpx.AsyncClient` GET on `THREAD_B` returned in `< 1.0s` while the producer was mid-stream (D-061-15 contended-timing scenario).
- **`test_061_ttl.py`** — two tests. `test_completed_run_expires_600s` drives a fast happy-path stream end-to-end and asserts `540 < TTL <= 600` on the Redis Stream key after the producer's finally has run. `test_failed_run_expires_60s` patches the LLM mock to raise and asserts `30 < TTL <= 65`. Both assert SC#4.
- **`test_061_runs_table.py`** — two tests. `test_runs_lifecycle_row` drives a happy-path stream and asserts the runs INSERT payload had `status='streaming'` AND that at least one runs UPDATE used a terminal status (`completed` / `failed` / `cancelled`). `test_rls_policy_present_in_full_schema` is the SC#5b deviation variant — opens `supabase/full-schema.sql`, asserts `CREATE POLICY runs_select_own` is present, asserts `auth.uid() = user_id` is in the USING clause, and uses a regex defense-in-depth check that NO INSERT/UPDATE/DELETE policies on `runs` exist (D-061-08: SELECT-only).
- **`test_061_hard_timeout.py::test_120s_timeout_fires_full_finally`** — D-061-01 + D-061-04. Monkeypatches `settings.run_hard_timeout_seconds = 2`, patches the LLM mock to sleep 5s on the first chunk (exceeds the lowered timeout), drives the endpoint to drain, and asserts (a) the Redis Stream's last entry is `type='error' error='hard_timeout'`, (b) the runs UPDATE was called with `status='failed' error='hard_timeout'`, (c) `30 < TTL <= 65` on the failed-bucket EXPIRE.

All four use the `redis_client` async fixture from conftest (Plan 04) AND import 059's `_reset_sse_starlette_app_status` autouse fixture so per-test loop scope doesn't trip AppStatus binding (Pitfall 6).

Commit: `57b2cef` `test(061-05): add 4 integration tests + shared _run_helpers + extend mock-supabase`

### Task 3 — D-061-16 contract inversion (TBD-09)

Rewrote `backend/tests/integration/test_059_disconnect.py`:

- **File docstring** rewritten end-to-end to declare the Phase 061 contract inversion explicitly. References both `D-v2.5-08` and `Phase 061` and lists the inverted I1'-I4' invariants. Closes with: "Reviewer note: this is intentional, NOT a regression."
- **Test renamed** from `test_agent_task_cancels_on_disconnect` to `test_agent_task_SURVIVES_on_disconnect` (per VALIDATION.md TBD-09 lock).
- **Assertions inverted:** the original `count_after == 0` (no LLM calls after disconnect) is REMOVED. The new test asserts `xlen_after > xlen_at_disconnect` (producer XADDs continue post-disconnect) and that a terminal sentinel lands (producer reaches its finally). The remaining `count_after >= 0` assertion is a documentation tautology preserving the variable's name for git-blame continuity.
- **Helpers preserved unchanged:** `_slow_chunks`, `LLMCallCounter`, `_make_counted_chat`, `_drive_sse_until_disconnect`, and `_reset_sse_starlette_app_status` are all useful across the inversion and were left as-is.
- **Smoke test (`test_normal_stream_unchanged`) preserved unchanged** — the wire format from `agent_runner` is byte-identical to 059's (Plan 03 `_emit` shape), so the SSE event-type sequence (`delta` -> `done` -> `stream_end`) is the same.

Commit message body explicitly cites `D-v2.5-08`, `D-061-03`, `D-061-16`, and `Phase 061` so future reviewers running `git blame` on the test file have the rationale immediately at hand.

Commit: `9ab4cef` `test(061-05): invert disconnect-cancel contract per D-061-16`

### Task 4 — 061-VERIFICATION.md (TBD-10 / TBD-11 + manual checklist)

Created `.planning/phases/061-run-backed-streaming-backend/061-VERIFICATION.md` mirroring the 058/059 format. Required sections:

- **Mental Model** — recap of the Redis Stream ephemeral buffer vs. Postgres runs durable record split
- **Binding Test Results table** — all 11 VALIDATION.md TBD rows mapped to the exact pytest commands the verifier runs (TBD-01..09 are pytest, TBD-10 is the 058 regression run, TBD-11 is the 060 e2e Playwright spec)
- **Contract Inversion (D-061-16)** — explicit reviewer-facing note explaining why test_059_disconnect.py was rewritten, with the I1'-I4' inverted invariants and the 062 follow-up (DELETE /runs/{id} cancel verb replaces the now-removed cancel-on-disconnect contract)
- **Manual Two-Tab DevTools Timing Checklist** — 8 rows for refresh / multi-tab / navigate-away scenarios that automated tests can't cover (close Tab A entirely, wait, observe producer XLEN still growing, etc.)
- **Cross-Tab GET <1s** discussion + the inline assertion in `test_061_producer_survives_disconnect.py` covering the contended-timing variant
- **Sign-off block**

Commit: `9d1e8f5` `docs(061-05): add 061-VERIFICATION.md (binding-test table + contract inversion + manual checklist)`

## Task Commits

| Task | Commit | Files                                                                                                                                                                                                                                                                                              |
| ---- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | e555ae6 | backend/tests/unit/test_061_emit_helper.py, backend/tests/unit/test_061_consumer.py, backend/tests/unit/test_health.py, backend/tests/integration/test_health.py                                                                                                                                   |
| 2    | 57b2cef | backend/tests/integration/_run_helpers.py, backend/tests/integration/test_058_concurrency.py, backend/tests/integration/test_061_producer_survives_disconnect.py, backend/tests/integration/test_061_ttl.py, backend/tests/integration/test_061_runs_table.py, backend/tests/integration/test_061_hard_timeout.py |
| 3    | 9ab4cef | backend/tests/integration/test_059_disconnect.py (D-061-16 contract inversion)                                                                                                                                                                                                                    |
| 4    | 9d1e8f5 | .planning/phases/061-run-backed-streaming-backend/061-VERIFICATION.md                                                                                                                                                                                                                            |

## Verification

Per the prompt's explicit sandbox note, direct `venv/Scripts/python` runtime test execution is blocked from this executor. Static-gate verification was executed at every task and is fully green:

- **AST parse** — all 9 created Python files plus the 3 modified Python files parse cleanly with `python -c "import ast; ast.parse(open(f).read())"` for each.
- **Plan acceptance-criteria grep counts (every criterion in the plan):**
  - Task 1: file existence (3/3 OK), `cd backend && venv/Scripts/pytest tests/integration/test_health.py` will still pass per the integration-shape update (deferred to verifier for runtime confirmation).
  - Task 2: `_run_helpers.py` has `def _extract_run_id_from_mock` x1; test_058 contains `"runs"` x1 (the per-table builder branch); each of the three 061 integration tests doing run-id extraction has the absolute import x1; no relative imports anywhere; `THREAD_B` referenced 3x in the producer-survives test (declaration + two GET-helper usages); `cross_tab_elapsed < 1.0` x1; `xrange_count == xlen_final` x1 (Pitfall 1 parity).
  - Task 3: `test_agent_task_SURVIVES_on_disconnect` x1; original `test_agent_task_cancels_on_disconnect` x0 (fully replaced); `D-v2.5-08` x4; `D-061-16 | Phase 061` x9; `count_after == 0` x0 (original assertion fully removed; the only surviving free-text comment about it does NOT contain the literal token); `xlen_after > xlen_at_disconnect` x1.
  - Task 4: file exists; `Contract Inversion` x2; `D-061-16` x5; `D-v2.5-08` x4; `TBD-` exactly x11 (one row per VALIDATION.md TBD); `two-tab` x3.
- **No accidental file deletions** — `git diff --diff-filter=D --name-only HEAD~4 HEAD` returned empty.

Runtime test execution (the 11 binding pytest commands + the 060 Playwright e2e spec) is deferred to `/gsd:verify-work` or to the user. The 11 commands are documented in 061-VERIFICATION.md so the verifier can run them with a single copy-paste:

```bash
cd backend && venv/Scripts/pytest \
  tests/unit/test_061_emit_helper.py \
  tests/unit/test_061_consumer.py \
  tests/unit/test_health.py \
  tests/integration/test_061_producer_survives_disconnect.py \
  tests/integration/test_061_ttl.py \
  tests/integration/test_061_runs_table.py \
  tests/integration/test_061_hard_timeout.py \
  tests/integration/test_059_disconnect.py \
  tests/integration/test_058_concurrency.py \
  -q
```

Plus from repo root:

```bash
npx playwright test e2e/tests/060-thread-race.spec.ts
```

## Deviations from Plan

### Auto-fixed issues

**None.** Plan executed as written. All 4 tasks landed with no Rule 1/2/3 deviations.

### Pre-existing dirty files preserved

Per the prompt's hard rule, the following pre-existing uncommitted files in the user's working tree were NEVER staged into any of this plan's commits (verified with explicit per-file `git add` invocations rather than `git add -A`):

- `backend/app/api/settings.py`
- `backend/app/services/sql_service.py`
- `backend/tests/conftest.py` (the user's 6-line `dependency_overrides[get_supabase] = lambda: _supabase` restoration in `reset_mocks` — Plan 05 required no conftest changes; Plan 04 already added the redis_client + FLUSHDB fixtures)
- `backend/tests/unit/test_sql_service.py`
- `backend/scripts/probe_multimodal.py` (untracked)
- `.planning/phases/061-run-backed-streaming-backend/061-04-SUMMARY.md` (the user's prior modifications)
- All `.claude/` and `.planning/STATE.md` files dirtied by GSD tooling iteration

### Authentication gates encountered

**None.** No external API access required for this plan.

### Test-suite execution deferred (sandbox-blocked)

Direct `venv/Scripts/python` invocation is blocked by the executor's sandbox (consistent with prior wave executor experience documented in the prompt). The plan's `<verify>` blocks specify pytest commands, and those are written verbatim into 061-VERIFICATION.md's binding-test table for the verifier to execute. Static gates (file existence + AST parse + plan-mandated grep counts) are all green; this matches the prompt's explicit guidance: "If your plan's acceptance criteria are static (grep counts, file presence, AST parse), prefer those. Runtime test execution can be deferred to the verifier or to the user."

### VALIDATION.md frontmatter NOT updated

The plan output spec instructs: "update VALIDATION.md frontmatter `nyquist_compliant: true` and `wave_0_complete: true` after confirming all binding tests are green." Since runtime confirmation is deferred to the verifier (above), Plan 05 leaves the frontmatter at `nyquist_compliant: false` / `wave_0_complete: false`. The verifier or `/gsd:verify-work` should toggle these once it has executed the binding-test command block above and observed `0 failed`.

### `test_normal_stream_unchanged` smoke test

Preserved as-is. Plan Task 3 Step C said "Likely no change needed" — confirmed. The wire format from `agent_runner` is byte-identical to the 059 queue payload (Plan 03 `_emit` produces JSON `{type, ...}` under a single-field `data` key; the consumer yields `{"data": fields["data"]}` which the SSE response serializes the same way the asyncio.Queue path did). The smoke test exercises the public SSE event-type sequence (`delta` -> `done` -> `stream_end`), which is invariant across the queue -> Streams refactor.

## Threat Flags

None. Plan 05 introduces no new security-relevant surface — it only adds tests against existing surfaces. The threat-model rows in the plan frontmatter (T-061-01 RLS deviation accepted, T-061-04 hard-timeout coverage, T-061-05 redis_url leakage) are all assertions ABOUT existing surfaces, mitigated by the very tests this plan adds.

## Self-Check: PASSED

- All 9 created files exist on disk:
  - backend/tests/unit/test_061_emit_helper.py ✓
  - backend/tests/unit/test_061_consumer.py ✓
  - backend/tests/unit/test_health.py ✓
  - backend/tests/integration/_run_helpers.py ✓
  - backend/tests/integration/test_061_producer_survives_disconnect.py ✓
  - backend/tests/integration/test_061_ttl.py ✓
  - backend/tests/integration/test_061_runs_table.py ✓
  - backend/tests/integration/test_061_hard_timeout.py ✓
  - .planning/phases/061-run-backed-streaming-backend/061-VERIFICATION.md ✓
- All 4 task commits exist in `git log --oneline -5`:
  - e555ae6 ✓
  - 57b2cef ✓
  - 9ab4cef ✓
  - 9d1e8f5 ✓
- All static acceptance-criteria grep counts pass (see Verification section above).
