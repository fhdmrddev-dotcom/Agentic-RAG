---
phase: 235-the-source-says-what-it-did
plan: 07
subsystem: api
tags: [fastapi, pydantic, connector-watches, honesty, per-row-boundary, pytest, tdd]

# Dependency graph
requires:
  - phase: 235-06
    provides: "the live-reader idiom (`getattr(request.app.state, 'watch_service', None)`), and the two appended read routes that left `trigger_watch_sync` / `_enrich_watch_rows` byte-unchanged for this plan"
  - phase: 234
    provides: "the `/sync` scheduler poke, `_enrich_watch_rows`, `WatchResponse` / `WatchSyncResponse`, and the probe-app test fixture"
provides:
  - "POST /sources/watches/{id}/sync — refuses when no reader is live, and reports the ask + the next-check window when one is"
  - "WatchSyncResponse.next_run_at / .next_check_within_seconds / .reader_running"
  - "WatchResponse.degraded / .degraded_reason / .next_check_within_seconds"
  - "_degraded_watch_record — the per-row projection fallback for GET /sources/watches"
affects: [235-09, 235-10, 235-11, 235-12, watched-folders-section, source-attention-badge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A refusal names the INSTANCE's configuration as the cause and never the caller's own data (T-235-22)"
    - "Ownership 404 runs BEFORE any capability pre-flight, so a refusal can never become an existence oracle (T-235-26)"
    - "Per-row try/except around a list projection: the failing row is RETURNED degraded, never dropped and never a 500"
    - "An error surfaced to a screen carries a fixed token + exception CLASS name; the exception text goes to logger.exception"
    - "A source fence assembles its forbidden word (`'sched' + 'uled'`) so the fence file cannot itself trip a repo-wide grep"

key-files:
  created:
    - backend/tests/unit/api/test_sources_sync_honesty.py
    - backend/tests/unit/api/test_sources_degraded_row.py
  modified:
    - backend/app/api/sources.py
    - backend/app/models/source.py
    - backend/tests/unit/api/test_sources_watches_api.py

key-decisions:
  - "`next_run_at` on the accepted reply is resolved in Python (`datetime.now(timezone.utc)`), NOT read back with a `RETURNING` clause — the acceptance criterion requires the UPDATE statement to stay byte-for-byte the one that shipped, and the authoritative column is what `GET /sources/watches` already returns"
  - "The refusal writes NOTHING. Poking `next_run_at` when no process consumes it is precisely the false promise BUG-260906-02 is about, so the pre-flight returns before the UPDATE rather than after it"
  - "`status=\"asked\"`, never `\"pending\"` — `_enrich_watch_rows` already SYNTHESISES `last_status = \"pending\"` at read time for a never-ticked watch, and two meanings behind one token is how a surface starts lying quietly"
  - "A degraded row falls back to a nil-UUID sentinel identity rather than being skipped when the raw row has no readable `id` — dropping it is the omission the boundary exists to prevent"
  - "Phase 234's `test_trigger_watch_sync` was AMENDED, not replaced: the poke assertion it was written to prove is untouched, and only the word changed"

patterns-established:
  - "Non-vacuity control FIRST in any suite whose properties are `not in` assertions over a file read"
  - "A planted failure targets exactly ONE row: a boundary that only proves itself when everything fails proves nothing about the N−1 that did not"

requirements-completed: [SURF-02, LIB-10]

# Metrics
duration: 41min
completed: 2026-09-06
---

# Phase 235 Plan 07: The Source Says What It Did Summary

**`/sync` stops reporting success for work that cannot happen — it refuses when no reader process is live, names this instance's configuration as the cause, writes nothing, and when a reader IS live reports the ask plus the next-check window instead of the request; and one unprojectable watch row now costs its own row a degraded flag rather than 500-ing every source the caller owns.**

## Performance

- **Duration:** ~41 min
- **Tasks:** 2, both TDD (RED → GREEN, no REFACTOR needed)
- **Files modified:** 5 (2 source, 2 new suites, 1 amended suite)
- **Net:** `+638 / −31` lines

## Accomplishments

### Task 1 — the Sync button can no longer promise work nothing will do

- **The refusal reads the LIVE reader, not the flag.** `getattr(request.app.state, "watch_service", None) is not None`, matching plan 06's idiom. `main.py:587-589` swallows a failed start and leaves the configuration flag reading true, so the flag is not the fact. The config flag's NAME remains absent from the whole module — plan 06's `grep -n "watch_process_enabled" api/sources.py` guard still returns empty.
- **The refusal writes nothing.** It returns before the `UPDATE`. Poking a column no process reads is the false promise itself, not a lesser version of it.
- **The refusal blames configuration, and only configuration.** Asserted against a forbidden list — `folder`, `connection`, `!`, `error`, `failed` — plus a separate case forbidding `WATCH_` and `_enabled` so a member cannot learn this instance's operator keys (T-235-22).
- **Ownership still precedes everything.** The 404 check is untouched and runs first; a case drives an unknown id with the reader OFF and asserts `404 "Watch not found or unauthorized."` with zero writes, so the refusal cannot be used as a watch-existence oracle (T-235-26).
- **The accepted reply carries the outcome vocabulary and the window** — `status="asked"`, `next_run_at`, `next_check_within_seconds` (from `settings.watch_poll_interval_seconds`), `reader_running=True`. That is what lets the surface say *"Asked · next check within N"* (D-235-16) instead of a bare spinner.

### Task 2 — one broken row is one broken row

- **`_enrich_watch_rows` now projects every row inside its own boundary.** The planted `SEED-239` reproduction — the per-row `connector_connections` lookup throwing for exactly one connection id — used to escape the route uncaught; it now yields HTTP 200 with **3** items of which one is flagged.
- **The failing row is NAMED, never dropped.** `id`, `source_folder_name`, `user_id` and `connection_id` are read defensively from the raw row so the surface can say *which* source could not be read. A source that vanishes from its own list is the silence `LIB-10` forbids, and it is worse than an error page because nothing on screen says anything is missing.
- **`degraded_reason` is machine-safe.** `projection_failed:RuntimeError` — a fixed token plus the exception CLASS name. A case forbids `Traceback`, `<class '`, `object at 0x`, the exception text, and even the table name; the full exception goes to `logger.exception`.
- **Order-independence is pinned.** A separate case fails the LAST row and asserts the first two still render, so the boundary cannot degenerate into "everything before the first failure".

## Task Commits

| # | Task | Commit | Type |
|---|------|--------|------|
| 1 | Task 1 RED — the Sync button's honesty, failing | `502d312d9` | test |
| 2 | Task 1 GREEN — refusal + outcome reply | `04ac27629` | feat |
| 3 | Task 2 RED — one row must not 500 the list, failing | `00ef4bc96` | test |
| 4 | Task 2 GREEN — the per-row projection boundary | `156640916` | feat |

## Files Created/Modified

| File | Δ | What |
|---|---|---|
| `backend/app/api/sources.py` | `+136 / −29` | `trigger_watch_sync` gains `request: Request`, the reader pre-flight and the outcome reply; `_enrich_watch_rows` gains the per-row boundary; `_degraded_watch_record` + `_UNIDENTIFIED_WATCH` added beside it; one docstring line reworded to clear the forbidden word |
| `backend/app/models/source.py` | `+34` | `WatchSyncResponse` gains 3 fields + a docblock; `WatchResponse` gains 3 fields. All defaulted |
| `backend/tests/unit/api/test_sources_sync_honesty.py` | `+235` (new) | 9 cases |
| `backend/tests/unit/api/test_sources_degraded_row.py` | `+222` (new) | 8 cases |
| `backend/tests/unit/api/test_sources_watches_api.py` | `+11 / −2` | `test_trigger_watch_sync` amended — still **10** cases |

## Verification — recorded, not asserted

**Backend unit gate, verbatim tail:**

```
72 failed, 3887 passed, 2 xfailed, 2 xpassed, 45 warnings in 112.40s (0:01:52)
```

Inherited baseline is **72** (plan 05's measurement; plan 06 read 71, so the floor carries ±1). This reads **exactly 72 — no new failure.** Strengthened rather than left as an arithmetic claim: `grep -ci "^FAILED.*\(watch\|degraded\|sync_honesty\)"` over the same run returns **0**, so none of the 72 names anything this plan touched. The single `FAILED` line matching `source` at all is `test_phase56_iteration_start.py::…test_threads_py_emits_iteration_start_at_loop_top`, which is about `threads.py` and is pre-existing.

**Targeted suites:**

```
tests/unit/api/test_sources_degraded_row.py + test_sources_watches_api.py
  + test_sources_sync_honesty.py + tests/unit/services/test_source_health_verdict.py
57 passed, 1 warning in 1.37s
```

```
tests/unit/api  ->  34 passed, 1 warning in 1.61s
```

**`test_sources_watches_api.py` before / after: 10 passed / 10 passed.** The count did not move; one case's assertions did (see Deviations).

**Acceptance criteria:**

| Criterion | Result |
|---|---|
| `grep -c "scheduled" backend/app/api/sources.py` | **0** |
| `grep -n "UPDATE" backend/app/api/sources.py` | one hit, `:339` — `UPDATE connector_watches`, statement byte-unchanged |
| `grep -n "watch_process_enabled" backend/app/api/sources.py` | **empty** (plan 06's guard preserved) |
| `grep -n "str(exc)\|str(err)"` inside `_enrich_watch_rows`'s `degraded_reason` | **none** — the only hit in the file is prose in `_degraded_watch_record`'s docstring saying not to |
| No adapter / listing call added to the route | asserted as a test over the live source: `sync_watch`, `list_folder`, `adapter`, `await watch_service.`, `httpx` are each absent from `inspect.getsource(trigger_watch_sync)` |
| `test_sources_sync_honesty.py` | 9 passed (≥ 6 required) |
| `test_sources_degraded_row.py` | 8 passed (≥ 6 required), including `status_code == 200` with one row broken |
| Files touched by this plan | exactly 5 — `git diff --name-only bf01ab981 HEAD` |

**Validation rows discharged:** V-14 (one row degrades one row), V-15 (reader off ⇒ refusal naming configuration), V-16 **backend half only** — the frontend half at `WatchedFoldersSection.tsx:78` is Plan 10's and is untouched here, so the composition fence over both files stays red on purpose.

### The RED drive of the source fence — recorded verbatim

The fence was authored before the word was removed, so its RED is the real thing rather than a re-planted one:

```
___________ test_the_forbidden_word_is_gone_from_the_sources_module ___________

    def test_the_forbidden_word_is_gone_from_the_sources_module():
        """V-16 (backend half). The frontend half is Plan 10's; the composition fence covers both."""
        src = _module_source()
>       assert FORBIDDEN_WORD not in src, (
            f"{Path(sources.__file__).name} still contains the word {FORBIDDEN_WORD!r} - "
            "it describes the request, not the outcome (BUG-260906-02)"
        )
E       AssertionError: sources.py still contains the word 'scheduled' - it describes the request, not the outcome (BUG-260906-02)
E       assert 'scheduled' not in '"""Phase 23...ds,\n    )\n'
E
E         'scheduled' is contained here:
E           ate a new scheduled watch
E         ?           +++++++++
```

It names the file and it names the word. ⭐ **And it caught an occurrence the plan's `<read_first>` did not mention:** `sources.py:4`, the module docstring line *"Create a new scheduled watch"*. `grep -c` could never have reached **0** on the two response-literal edits alone; the fence found the third.

Task 2's RED is likewise real rather than staged — `test_one_broken_row_does_not_500_the_list` failed with the planted `RuntimeError` propagating out of `client.get(...)` uncaught, which is `SEED-239`'s measured shape exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Phase 234's `test_trigger_watch_sync` asserted the removed vocabulary**

- **Found during:** Task 1 GREEN.
- **Issue:** `tests/unit/api/test_sources_watches_api.py:247` asserted `data["status"] == "scheduled"`, and its probe app has no `watch_service` on `app.state`, so after the fix it read `refused` and the poke assertion could not run either. The plan's Task 2 acceptance asks for that file to still pass at 10; it could not pass unchanged, because this plan changes the contract that case pins.
- **Fix:** Amended in place — `client.app.state.watch_service = object()` (declaring a live reader, which is itself the fix), `status == "asked"`, plus `reader_running is True`. The `next_run_at = now()` poke assertion the case exists for is byte-unchanged, and a docblock records why it moved. **Count stayed 10.** The reader-OFF arm lives in the new suite, so Phase 234's file did not grow a second responsibility.
- **Files modified:** `backend/tests/unit/api/test_sources_watches_api.py`
- **Commit:** `04ac27629`

**2. [Rule 2 — Missing critical functionality] The plan's minimal degraded record could not have validated**

- **Found during:** Task 2 GREEN design.
- **Issue:** The plan specifies a minimal record of `id`, `source_folder_name`, `user_id`, `connection_id`. `WatchResponse` also requires `source_folder_id` with **no default**, so that record would have failed `response_model` validation — re-raising inside FastAPI's serialiser and producing the very 500 the boundary exists to prevent. A per-row boundary whose fallback can itself fail is a boundary with a hole.
- **Fix:** `_degraded_watch_record` supplies every required field defensively, including `source_folder_id` (`""` fallback) and a nil-UUID sentinel `_UNIDENTIFIED_WATCH` for an unreadable `id`/`user_id`/`connection_id`. The UUID coercions are individually guarded, so a malformed identity degrades to the sentinel rather than raising. Documented at the sentinel: a row with no readable id is **not** droppable, because dropping it is the omission the boundary exists to prevent.
- **Files modified:** `backend/app/api/sources.py`
- **Commit:** `156640916`

No Rule 4 (architectural) decisions were needed. **D-235-15 was never approached:** nothing in this plan makes the route do a listing, and that is asserted by a test rather than claimed.

## Issues Encountered

- **`next_run_at` cannot be read back without changing the statement.** The acceptance criterion requires the `UPDATE … next_run_at = now()` to stay byte-for-byte, which rules out a `RETURNING` clause. Resolved by resolving the value in Python and documenting inline that it differs from the database's `now()` by the round trip only, and that `GET /sources/watches` returns the authoritative column.
- **`Request.app.state` raises `AttributeError` for a key no lifespan set** — the same finding plan 06 recorded. `getattr(..., None)` is used here for the same reason, and it is also the honest reading: an app that never started a reader is not running one.

## Known Stubs

None. Every field this plan adds is either derived from live process state, read from the raw row, or defaulted so that a caller can distinguish "not set" from "false".

## Honest caveats carried forward

- ⚠ **The frontend `WatchSyncResponse` interface (`frontend/src/lib/api/sources.ts:80-83`) is still `{ status, message }`.** Plan 04 widened `ConnectorWatch` with the three `WatchResponse` fields but not this one, and neither file is in this plan's `files_modified`. The three new reply fields are therefore **on the wire and invisible to TypeScript** until a frontend plan declares them. A TS interface over `res.json()` is an assertion, not a check, so nothing breaks — but a Wave-4 surface reading `res.next_check_within_seconds` will not compile until then. **Plan 10 (or whichever plan first renders the pending state) must widen it.**
- ⚠ **`"asked"` and `"refused"` are new `status` VALUES on a free-string field.** `WatchedFoldersSection.tsx:78` currently ignores `status` entirely and prints its own sentence, so nothing reads them yet — but any future consumer switching on `status` must handle both arms, and `"pending"` is deliberately not one of them (it is `last_status`'s synthesised read-time value on `WatchResponse`, a different concept).
- ⚠ **`last_good_at` from `/sources/health` remains window-limited** (plan 06's caveat, unchanged by this plan). A `null` there is *"no success within the window"*, not *"never succeeded"*; `GET /sources/watches/{id}/runs` is the unbounded answer. Nothing in this plan turns that `null` into a "never" claim.
- ⚠ **A degraded row's `item_count`, `connection_name`, `service_id`, `last_run_at` and `last_status` fall back to model defaults** (`0` / `None` / `None` / `None` / `"pending"`). They are NOT measurements of that source — `degraded=True` is the flag that says so, and a surface must gate on it before rendering any of those five as fact.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change. Every threat in the plan's register was mitigated as specified: T-235-22 (refusal names configuration, never a key), T-235-23 (`degraded_reason` carries no frame or text), T-235-24 (D-235-15 asserted over the live route source), T-235-25 (per-row boundary driven with a planted throwing row), T-235-26 (404 precedes the pre-flight, asserted).

## Self-Check: PASSED

- `backend/app/api/sources.py` — FOUND (modified)
- `backend/app/models/source.py` — FOUND (modified)
- `backend/tests/unit/api/test_sources_sync_honesty.py` — FOUND
- `backend/tests/unit/api/test_sources_degraded_row.py` — FOUND
- `backend/tests/unit/api/test_sources_watches_api.py` — FOUND (modified)
- `502d312d9` — FOUND
- `04ac27629` — FOUND
- `00ef4bc96` — FOUND
- `156640916` — FOUND
- STATE.md / ROADMAP.md / `scripts/vitest-count-gate.cjs` / `WatchedFoldersSection.tsx` — **NOT modified** (`git diff --name-only bf01ab981 HEAD` lists exactly the five files above)
- Working tree clean at hand-off (`git status --short` empty)

---
*Phase: 235-the-source-says-what-it-did*
*Completed: 2026-09-06*
