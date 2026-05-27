---
phase: 073-asyncpg-pool-integration
plan: 02
subsystem: database
tags: [asyncpg, sql-helpers, typed-helpers, db-layer, jsonb-codec, unit-tests, t-073-02]

# Dependency graph
requires:
  - phase: 073-asyncpg-pool-integration
    plan: 01
    provides: "get_pg_pool() singleton + _init_pg_connection (JSONB codec) + _build_mock_pg_pool() factory + suite-wide _reset_pg_pool_singleton autouse"
provides:
  - "backend/app/db/ namespace (new Python package — additive, does NOT replace aexec)"
  - "app.db.runs.insert_run(pool, *, run_id, thread_id, user_id, status, model, provider) -> None"
  - "app.db.runs.finalize_run(pool, *, run_id, status, error, completed_at, message_id, input_tokens, output_tokens) -> None"
  - "app.db.runs.insert_assistant_message(pool, *, thread_id, user_id, content, tool_calls, source_refs, confidence_level, confidence_avg_similarity, confidence_disclaimer) -> UUID"
  - "$N positional-binding-only SQL strings for all three hot-path writes (T-073-02 mitigation locked)"
  - "AsyncMock-pool unit test suite for the helpers (8 tests, all green)"
affects:
  - 073-03-token-accumulator  # finalize_run signature is the consumer-of-record for input_tokens/output_tokens
  - 073-04-hot-path-flips     # replaces threads.py:974 + 1310 + 2651 aexec calls with these helpers

# Tech tracking
tech-stack:
  added: []  # No new libs - asyncpg already added in Plan 01
  patterns:
    - "Typed async helper module per write target (sibling of multimodal_service / extraction_service factoring)"
    - "Positional-only SQL parameter binding ($N) - no Python-side string interpolation anywhere in app/db/"
    - "JSONB-codec-relies-on-pool-init - call sites pass plain Python lists, no per-call serialization"
    - "AsyncMock-pool unit test: assert (sql_substring, *positional_args) against pool.execute/.fetchval call_args[0]"

key-files:
  created:
    - "backend/app/db/__init__.py"
    - "backend/app/db/runs.py"
    - "backend/tests/unit/test_db_runs.py"
  modified: []  # No production-side modifications — all new files in a new package

key-decisions:
  - "All three helpers are keyword-only (after `pool: asyncpg.Pool`) - prevents accidental positional misuse at the three call sites Plan 04 will flip"
  - "Role 'assistant' is HARDCODED inside the messages INSERT SQL (literal 'assistant' in VALUES), NOT a parameter - keeps the helper name and behavior tightly coupled; schema CHECK constraint enforces the role vocabulary"
  - "Triple-quoted heredoc SQL strings (multi-line) - readable, copy-pasteable into psql for debugging, and grep-able without escape noise"
  - "finalize_run returns None even though pool.execute returns the cmd status - callers don't need it; aligns with the existing aexec-based call site which discarded supabase response too"
  - "Docstring text avoids the literal substrings 'json.dumps', '.format(', 'RETURNING id' (>1 occurrence) to keep the T-073-02 audit grep deterministic on the whole backend/app/db/ subtree"

patterns-established:
  - "Per-target helper module: write-side SQL for one logical concern (runs + adjacent messages) lives in `app/db/<name>.py`. Future phases that add more asyncpg-backed writes (e.g., admin dashboard reads in v3.1, spend-cap accumulator in v3.4) follow the same shape."
  - "Test convention: `sql, *args = pool.execute.call_args[0]; assert <substring> in sql; assert args == [<expected positional tuple>]`. Asserts BOTH the SQL string shape AND the binding order in one expression."

requirements-completed: [WORKER-LIFT-02]

# Metrics
duration: 4min
completed: 2026-05-17
---

# Phase 073 Plan 02: Typed asyncpg helpers (app.db.runs) Summary

**Three typed async SQL helpers (insert_run / finalize_run / insert_assistant_message) backed by asyncpg's native positional binding, plus an 8-test AsyncMock-pool unit suite that locks the contract Plan 04 will consume.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-17T15:25:58Z
- **Completed:** 2026-05-17T15:29:53Z
- **Tasks:** 2 (each committed atomically)
- **Files modified:** 0 (3 created)

## Accomplishments

- `backend/app/db/` package created (additive — does NOT replace `aexec`; cold paths in kb.py, runs.py, sandbox_outputs.py, test_fixtures.py, and threads.py non-hot calls all stay on aexec per D-073-04).
- Three keyword-only async helpers shipped, signatures locked verbatim from RESEARCH §Pattern 2:
  - `insert_run(pool, *, run_id, thread_id, user_id, status, model, provider) -> None`
  - `finalize_run(pool, *, run_id, status, error, completed_at, message_id, input_tokens, output_tokens) -> None`
  - `insert_assistant_message(pool, *, thread_id, user_id, content, tool_calls=None, source_refs=None, confidence_level=None, confidence_avg_similarity=None, confidence_disclaimer=None) -> UUID`
- T-073-02 SQL-injection mitigation: every value substitution uses `$N` placeholders; the audit grep `grep -E 'f"(INSERT|UPDATE|SELECT|DELETE)|\.format\('` returns **0 matches** across the entire `backend/app/db/` subtree.
- 8/8 unit tests green: positional-args contract for all three helpers, $1..$6 placeholder positive coverage, NULL-token passthrough (D-073-09), TEXT error column passthrough (Q2), `RETURNING id` flowing through `pool.fetchval` return value, optional-fields default-None coverage.

## Public Interface for Plan 04

Plan 04 imports these via:

```python
from app.db.runs import insert_run, finalize_run, insert_assistant_message
from app.dependencies import get_pg_pool   # Plan 01 — already shipped
```

Call sites Plan 04 flips:

1. `backend/app/api/threads.py:974` — runs INSERT at request entry
   ```python
   pool = await get_pg_pool()
   await insert_run(
       pool,
       run_id=run_id,
       thread_id=thread_id,             # UUID, not str
       user_id=current_user["id"],      # UUID
       status="streaming",
       model=_resolved_model,
       provider=_resolved_provider,
   )
   ```

2. `backend/app/api/threads.py:2651` — runs UPDATE inside `_shielded_finalize`
   ```python
   await finalize_run(
       pool,
       run_id=run_id,
       status=_terminal_status,
       error=_terminal_error,           # str | None — TEXT column, not JSONB
       completed_at=datetime.now(timezone.utc),
       message_id=_msg_id_for_runs,     # UUID | None
       input_tokens=input_tokens_total, # int | None (D-073-09 NULL sentinel)
       output_tokens=output_tokens_total,
   )
   ```

3. `backend/app/api/threads.py:1310` — messages INSERT inside `_persist_assistant_message`
   ```python
   _cached_id = await insert_assistant_message(
       pool,
       thread_id=thread_id,             # UUID
       user_id=current_user["id"],
       content=_strip_nul(full_content),
       tool_calls=completed_tools or None,   # plain list, JSONB codec serializes
       source_refs=unique_citations or unique_sources or None,
       confidence_level=c["level"] if _confidence_slot else None,
       confidence_avg_similarity=c["avg_similarity"] if _confidence_slot else None,
       confidence_disclaimer=c["disclaimer"] if _confidence_slot else None,
   )
   ```

The `RETURNING id` clause means `_cached_id` is the inserted UUID directly — no separate fetch.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create `backend/app/db/__init__.py` + `backend/app/db/runs.py` typed helper module** — `5ed4ccb` (feat)
2. **Task 2: Create `backend/tests/unit/test_db_runs.py` — AsyncMock-pool unit tests (+ docstring tidy in `app/db/runs.py` so the T-073-02 audit grep returns 0 across `app/db/`)** — `d02d6f9` (test)

**Plan metadata commit:** _TBD (final docs commit after this SUMMARY.md write)_

## Files Created

- `backend/app/db/__init__.py` — Package init + module docstring documenting D-073-04 scope (this package is additive; cold paths stay on aexec)
- `backend/app/db/runs.py` — 144 lines, three async helpers + module docstring with security stance + per-helper docstrings covering schema constraints, TOKEN-COL-01, and JSONB codec dependency
- `backend/tests/unit/test_db_runs.py` — 202 lines, 8 async tests using the Plan-01-shipped `_build_mock_pg_pool()` factory

## Decisions Made

- **Keyword-only signature (after `pool`):** Forces explicit naming at call sites, prevents subtle argument-reorder bugs in the three high-stakes locations Plan 04 will edit. The helper signatures themselves serve as the call-site contract documentation.
- **Role 'assistant' hardcoded inside the messages SQL VALUES clause:** Not a parameter. The helper is named `insert_assistant_message`; user-role messages are persisted elsewhere (the `aexec` user-message INSERT at threads.py is a cold path per D-073-04 and stays on the existing route). Keeps the helper purpose-bound and removes one source of value-binding bugs.
- **Triple-quoted heredoc SQL strings:** Multi-line, copy-paste-into-psql friendly, no f-string visual noise. Combined with the lint-grep gate, eliminates the entire f-string-in-SQL class of bug at this layer.
- **Docstring text avoidance of literal `json.dumps` / `.format(` / multiple `RETURNING id`:** The plan's acceptance grep counts every occurrence (not just code occurrences); docstring prose mentioning those exact substrings would create false positives at the gate. The original draft mentioned them in explanatory prose; rewording (`per-call serialization`, `string-interpolation methods`, `via the SQL RETURNING clause`) preserves the docstring intent while keeping audit grep counts deterministic.

## T-073-02 Security Gate Result

```
$ grep -rE 'f"(INSERT|UPDATE|SELECT|DELETE)|\.format\(' backend/app/db/
(0 matches)
```

Plus positive-direction coverage from `test_insert_run_uses_positional_placeholders`:

```python
sql, *_ = pool.execute.call_args[0]
for placeholder in ("$1", "$2", "$3", "$4", "$5", "$6"):
    assert placeholder in sql, f"missing placeholder {placeholder} in SQL: {sql!r}"
```

The SQL string is constructed in source code; only `$N` placeholders carry value substitution; asyncpg's native binding makes SQL injection unreachable at this layer.

## Test Results

```
$ cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_db_runs.py -x -q --no-header
........                                                                 [100%]
============================== warnings summary ===============================
venv\Lib\site-packages\requests\__init__.py:113
  RequestsDependencyWarning: urllib3 (2.6.3) or chardet (7.4.3)/charset_normalizer (3.4.6) doesn't match a supported version!
8 passed, 1 warning in 0.14s
```

Eight tests, all green:
- `test_insert_run_passes_args_positionally` — positional tuple = `[run_id, thread_id, user_id, status, model, provider]`
- `test_insert_run_uses_positional_placeholders` — T-073-02 positive coverage ($1..$6 in SQL)
- `test_finalize_run_passes_args_positionally` — tuple = `[run_id, status, error, completed_at, message_id, input_tokens, output_tokens]`
- `test_finalize_run_null_tokens_passthrough` — D-073-09: positions 4/5/6 (message_id / input_tokens / output_tokens) and position 2 (error) all None
- `test_finalize_run_error_text_passthrough` — Q2: error TEXT column flows the string `"timed_out after 120s"` unchanged
- `test_insert_assistant_message_returns_uuid` — pool.fetchval.return_value flows through the helper return value
- `test_insert_assistant_message_sql_shape` — `INSERT INTO messages` + `RETURNING id` + `'assistant'` hardcoded in SQL; 8 positional args
- `test_insert_assistant_message_optional_fields_none` — args[3..7] all None when callers omit tool_calls/source_refs/confidence_*

## Deviations from Plan

**None — plan executed exactly as written.**

One minor docstring rewording was applied during Task 2 to keep the T-073-02 audit grep deterministic on the whole `backend/app/db/` subtree (the original draft mentioned `.format()` and `json.dumps` in explanatory prose, which the audit regex would count). Functionally zero behavior change. Captured in the Task 2 commit alongside the test file rather than as a separate amendment commit per the rule "create new commits, never amend".

## Issues Encountered

None.

## Next Phase Readiness

**Wave 1 mid-deliverable shipped.** Plan 03 (token accumulator, D-073-07/08/09) can now wire its accumulator output through `finalize_run`'s `input_tokens` / `output_tokens` kwargs — the NULL-sentinel passthrough is locked by `test_finalize_run_null_tokens_passthrough`. Plan 04 (hot-path flips) can `from app.db.runs import insert_run, finalize_run, insert_assistant_message` and replace the three aexec call sites at `threads.py:974 / 1310 / 2651` without further setup; the SQL string shape + arg order is contract-locked by the 8 unit tests.

## Self-Check: PASSED

Verified all created files exist:
- `backend/app/db/__init__.py` — FOUND
- `backend/app/db/runs.py` — FOUND (144 lines, 3 async helpers, $N placeholders only, 0 json.dumps in code)
- `backend/tests/unit/test_db_runs.py` — FOUND (202 lines, 8 async tests, all green)

Verified all task commits exist in `git log --oneline -3`:
- `5ed4ccb` — FOUND (Task 1: `feat(073-02): add app.db.runs typed asyncpg helpers (D-073-05)`)
- `d02d6f9` — FOUND (Task 2: `test(073-02): unit tests for app.db.runs typed helpers (8 tests, all green)`)

---
*Phase: 073-asyncpg-pool-integration*
*Plan: 02*
*Completed: 2026-05-17*
