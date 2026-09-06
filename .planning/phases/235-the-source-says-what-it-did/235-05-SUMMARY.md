---
phase: 235-the-source-says-what-it-did
plan: 05
subsystem: connector-watch-history
tags: [watch-service, run-history, failure-classification, surf-02, h-5]
status: complete
requires:
  - db.watches.release_watch (plan 01 — the seven optional kwargs)
  - connector_sync_runs (migration 172, applied)
  - services.sources.failure_cause.classify_failure_cause (plan 02)
provides:
  - all FOUR release seams write a run row carrying real counts, a named cause and a truthful listing_complete
  - classify_failure_cause is the classifier at both failure seams (the substring sniff is demoted to control flow only)
  - started_at captured when the tick begins, not read back from the claim's last_run_at
  - record_skipped_still_running resolved by DELETION of the dead import
affects:
  - backend/app/services/watch_service.py
  - backend/tests/unit/services/test_watch_service.py
tech-stack:
  added: []
  patterns:
    - "one home for the six count keys (`_zero_counts`), because each key is a named column in migration 172"
    - "a best-effort release path never raises: `_opt_uuid` degrades to the DAL's COALESCE fallback"
    - "the cause is classified ONCE per exception and passed down, never re-derived at the seam"
    - "kwarg-addressed mock assertions replace whole-call equality when a live clock enters the call"
key-files:
  created:
    - backend/tests/unit/services/test_watch_sync_runs.py
  modified:
    - backend/app/services/watch_service.py
    - backend/tests/unit/services/test_watch_service.py
decisions:
  - "`record_skipped_still_running`: DELETED the import. The still-leased skip happens inside claim_due_watches' SQL, so no service-layer skip case exists — and calling it would clobber a live 'running' status while writing no history row"
  - "The VIS-04 403/permission/unauthorized substring branch is UNCHANGED — it decides control flow, not classification"
  - "Seam 4 classifies from the RAW exception, not the 'Source access unauthorized: …' wrapper, which would make every failure there look like a revoked token"
  - "Seam 2 (paused) passes EXPLICIT zero counts, not None — nothing was read, and zero is the honest observation rather than an absence of one"
  - "test_watch_service.py was edited outside files_modified (Rule 3): its four whole-call release assertions could not survive a live-clock kwarg"
metrics:
  duration: ~35 min
  tasks_complete: 2 of 2
  completed: 2026-09-06
---

# Phase 235 Plan 05: The Source Says What It Did — Summary

All four `release_watch` seams now hand the DAL the real counts, a **named** failure cause and a
truthful `listing_complete` — including the crash seam that lives in `tick()`, outside
`sync_watch` entirely. Plan 01's handoff said *"every row it writes today is a zero-count row"*;
that is no longer true.

---

## What Was Built

### Task 1 — the four seams (`c71bfedef` RED → `f50e3c294` GREEN)

**All four seams were edited, and `grep -c "release_watch(" ` still reads exactly `4`** — none
added, none lost. The measured shape of each:

| # | line | status | counts | listing_complete | failure_cause |
|---|---|---|---|---|---|
| 1 | `tick()`'s per-watch `except` | `failed` | `None` | `False` | `classify_failure_cause(str(exc))` |
| 2 | connection disabled | `paused` | **explicit zeros** | `False` | `None` |
| 3 | the happy path | `success` | **the real dict** | `listing.complete` | `None` |
| 4 | `_handle_unauthorized_watch` | `failed` | `None` | `False` | classified from the **raw** exception |

- **⛔ Seam 1 is outside `sync_watch`, and that is exactly why it is pinned by its own test.**
  It is the arm that catches every crash-shaped failure — the failures a person most needs in a
  history. `test_crash_arm_is_reached_from_tick_not_from_sync_watch` replaces `sync_watch`
  *wholesale* with a raising mock, so not one line of its body runs, and still demands a row.
  Had the write been placed inside `sync_watch`, that case would find no call at all.

- **⭐ `listing_complete` is passed from `listing.complete`, never left at its default.** The
  H-5 block immediately above seam 3 *suppresses* missing-state transitions when the listing did
  not finish exhaustively, so such a tick records `count_missing = 0` **by design rather than by
  observation**. The default (`False`) is the safe direction, but it would render a COMPLETE
  listing as incomplete — honest about deletions, and wrong about everything else.

- **Seam 2 gets a row (D-235-07 / RESEARCH OQ-5).** A watch paused because its connection was
  disabled did not *read* — but it did *tick*. That distinction is the whole point: it makes
  *"when did this source last successfully READ?"* answerable separately from *"when did it last
  CHANGE anything?"*, which is the conflation that let a dead watch look fine. Its counts are
  **explicit zeros, not `None`** — nothing was read, and zero is an observation, not the absence
  of one.

- **`started_at` is the tick's own clock.** `claim_due_watches` sets `last_run_at = now()` at
  **claim** time (RESEARCH §2.5), so reading it back at release would make every row's duration
  read as zero. Captured at the top of `sync_watch`, and separately at the top of `tick()`'s
  per-watch loop body for seam 1.

- **The substring sniff stops being the classifier — and is otherwise untouched.** The
  `403 / permission / unauthorized` test at `:189-197` still decides **control flow** (which
  items transition to `unauthorized`, VIS-04). Narrowing or widening it would silently change
  item state for reasons unrelated to history, so it is byte-identical. What changed is that the
  *cause recorded in the row* now comes from `classify_failure_cause`, and the raw string
  survives only as evidence in `last_error`. **Nothing classified today became unclassified**:
  every token the sniff matched is still a matcher input in `failure_cause.py`.

- **⚠ Seam 4 classifies the RAW exception, not the wrapper.** `error` is written as
  `f"Source access unauthorized: {exc}"` — a string that contains the word *"unauthorized"* no
  matter what actually went wrong. Classifying that would make a **deleted folder** report as a
  **revoked token**, at the one seam whose entire job is telling those two apart. The cause is
  therefore computed once at the call site, from `str(list_exc)`, and passed down.

- Two small leaves added: `_zero_counts()` (one home for the six keys, because each is a *named
  integer column* in migration 172 — a key added without a column drops silently) and
  `_opt_uuid()` (which **must never raise**: it feeds a best-effort writer on the release path of
  a sync that may already have failed, so a malformed id degrades to the DAL's own
  `COALESCE(..., w.user_id)` rather than turning a completed sync into a crash).

### Task 2 — `test_watch_sync_runs.py`, 8 cases (`cd8606657`)

Four named seam cases, plus the non-vacuity control, the V-02 pair, the tick-not-`sync_watch`
proof, and the classifier-not-sniff proof.

- **The non-vacuity control is collected FIRST, deliberately.** Every other case asserts
  *"called once with…"* over a patched `release_watch`. If the patch target were wrong — a stale
  module path, a rename, an import moved call-site-local — all four would pass over a mock nobody
  invoked, and the file would be green while recording nothing. The control proves the patched
  name **is** the name the module calls through, that the double records, and that it is
  **restored** afterwards so a leaked patch cannot silence a later suite.

- **V-02 is asserted as a PAIR, in one case, because the zero alone is what misleads.** A
  page-token cycle drives `listing.complete` to `False` while a genuinely-absent tracked item
  (`ext-gone`, `state='present'`) sits in the deleted-candidate set. The case asserts
  `listing_complete is False` **and** `counts["missing"] == 0` **and** that `update_item_state`
  was never awaited — so the suppression is proven to have happened, rather than the zero merely
  being unexplained.

- **Seam 3 uses a RENAME rather than a new file**, so the number asserted is one the sync
  actually produced (`counts["renamed"] == 1`) instead of one the fixture handed over — no mint,
  no storage upload, no mock returning the answer.

- **Seam 3 also pins `res["counts"] is kw["counts"]`**, which is how *"`sync_watch`'s return
  shape is unchanged"* becomes executable rather than asserted in prose.

---

## ⛔ `record_skipped_still_running` — RESOLVED BY DELETION, and why calling it would be wrong

RESEARCH Open Question 4 assigned this to plan 05 with two doors: call it, or delete it. **The
import at `watch_service.py:32` is deleted.** Two measured reasons, and the second is the one
that matters:

1. **There is no service-layer skip case to call it from.** `claim_due_watches`
   (`db/watches.py:225-238`) filters on `leased_until IS NULL OR leased_until < now()` and takes
   `FOR UPDATE SKIP LOCKED`. A still-leased watch is therefore skipped **inside SQL** and never
   reaches this module — `watch_service.py` never holds the id of a watch it skipped for a live
   lease. The research's parenthetical *"there is a real skip case when a lease is live"* is true
   of the **system** and false of **this file**.

2. **⚠ Calling it would be actively harmful, not merely redundant.** It `UPDATE`s
   `last_status = 'skipped_still_running'` — **overwriting the `running` status of a watch
   another worker is legitimately mid-flight on** — and it writes **no `connector_sync_runs`
   row**. That is a status with no history behind it: precisely the class of claim this phase
   exists to end.

Migration 172's COMMENT (plan 01) already records the value as *"documented by migration 168 and
written by nothing"*, so **no COMMENT edit was needed and none was made** — migration 172 is
already applied to the live database, and re-editing an applied migration is forbidden. Deleting
the import makes that COMMENT permanently true rather than incidentally true.

**⚠ The residual, stated rather than smoothed over:** the DAL function
`record_skipped_still_running` **still exists** in `backend/app/db/watches.py:382-399` and is
still exercised by `tests/unit/db/test_watches_db.py`. It was not deleted because `db/watches.py`
is plan 01's file and outside this plan's `files_modified`, and removing it would red a suite
this plan does not own. What is now true is that **nothing in the production tree imports it** —
`grep -c "record_skipped_still_running" backend/app/services/watch_service.py` returns **0**.

⚠ **That grep returning 0 is itself deliberate.** The explanatory comment in `watch_service.py`
refers to *"the `skipped_still_running` writer in `db/watches.py`"* and **avoids the exact
symbol**, so a future auditor grepping the production tree for the dead writer gets a clean
absence rather than a false positive from the note explaining the absence. This is plan 01's own
`run_in_threadpool` lesson applied a second time.

---

## Deviations from Plan

### `[Rule 3 - Blocking]` `test_watch_service.py` had to be edited, and it is not in `files_modified`

- **Found during:** Task 1, before any implementation.
- **Issue:** four assertions in `backend/tests/unit/services/test_watch_service.py` used
  whole-call equality — `mock_release.assert_awaited_once_with(mock_pool, watch_id,
  status="success")`. Once `release_watch` carries `started_at` (a live clock reading), **no
  whole-call assertion can be written by hand**, so all four break by construction. The plan's
  own acceptance criterion requires this suite to still pass, so the edit was unavoidable.
- **Fix:** repinned by **kwarg** rather than by whole-call equality — `call_args[0]` still pins
  the positional `(pool, watch_id)`, and `call_args[1]` pins status/counts/listing_complete/
  failure_cause/started_at. **The subject of each assertion is unchanged; only its addressing
  is** — and the repin *strengthened* them, since three of the four previously asserted nothing
  about what the tick did. This is the same class of repin plan 01 recorded for
  `test_release_and_skip_still_running`.
- **Driven RED first:** the repin was committed on its own (`c71bfedef`) and measured
  `4 failed, 2 passed` — `KeyError: 'listing_complete'` ×3, `KeyError: 'failure_cause'` ×1 —
  before a line of `watch_service.py` was touched.
- **Files modified:** `backend/tests/unit/services/test_watch_service.py`
- **Commit:** `c71bfedef`

### `[Rule 1 - Bug]` Task 1's *"followed within 3 lines by `counts=`"* criterion is defeated by the file's own formatting

- **Found during:** Task 1 acceptance checks.
- **Issue:** the criterion reads *"Every one of the 4 matches is followed within 3 lines by
  `counts=`"*. Each seam is now a multi-line keyword call in this file's (and `db/watches.py`'s)
  one-kwarg-per-line style, so `counts=` lands 4–6 lines below `release_watch(`. **The literal
  reading fails while the property it stands for holds.**
- **Fix:** the criterion is recorded here as a proxy whose literal form is wrong, rather than the
  code being reformatted to satisfy a line count. The property was measured directly instead — by
  parsing each `release_watch(` **call block** to its closing paren:

  ```
  sites: [162, 212, 535, 587]
  162 counts=True listing_complete=True started_at=True
  212 counts=True listing_complete=True started_at=True
  535 counts=True listing_complete=True started_at=True
  587 counts=True listing_complete=True started_at=True
  ```
- **Commit:** `f50e3c294`

---

## The RED drive, verbatim (Task 2's mandate)

`counts=counts` at seam 3 was commented out, the suite re-run, then restored.

```
            assert kw["status"] == "success"
            assert kw["failure_cause"] is None
>           assert kw["counts"]["renamed"] == 1
E           KeyError: 'counts'
tests\unit\services\test_watch_sync_runs.py:246: KeyError
            assert kw["listing_complete"] is False
>           assert kw["counts"]["missing"] == 0
E           KeyError: 'counts'
tests\unit\services\test_watch_sync_runs.py:332: KeyError
FAILED tests/unit/services/test_watch_sync_runs.py::test_success_arm_records_a_run_row_with_real_counts
FAILED tests/unit/services/test_watch_sync_runs.py::test_incomplete_listing_pairs_listing_complete_false_with_zero_missing
2 failed, 6 passed, 1 warning in 1.40s
```

⭐ **TWO cases went red, not one — and the second is the more interesting.** The V-02 case fails
on the same missing kwarg, which confirms that the pair assertion is genuinely reading the
service's output rather than a fixture's. **6 of the 8 stayed green**, which is the shape a
targeted defect should produce: the control, the paused seam, the two crash cases and the
unauthorized seam are provably not coupled to seam 3.

**Restoration confirmed by git, not by eye:** after restoring, `git status --short` reports
`watch_service.py` as **not modified** — it is byte-identical to the committed `f50e3c294`.

---

## Verification

**Backend unit gate — the verbatim tail line:**

```
72 failed, 3840 passed, 2 xfailed, 2 xpassed, 42 warnings in 131.55s (0:02:11)
```

| | value |
|---|---|
| inherited baseline (plan 02's close) | **72 failed, 3832 passed** |
| **this plan** | **72 failed, 3840 passed** |
| new failures | **0** |
| passed delta | **+8** — exactly the eight cases this plan added |
| collection errors | **0** (no collection-error line in the summary) |

⚠ **72 is PRE-EXISTING and was not "fixed".** CLAUDE.md's ceiling of 71 is stale by one; RESEARCH
C-1 measured 72 on this phase's merge base and Phase 234 measured 72 on its own. The rule applied
here is the plan's: **no NEW failure above 72.**

**Plan verification command** (`test_watch_sync_runs.py` + `test_watch_service.py` +
`test_watch_diff_completeness.py` + `test_failure_cause.py`):

```
57 passed, 1 warning in 0.56s
```

**Phase 234's existing watch suites — before and after, as the criterion asks:**

| Suite | before this plan | after |
|---|---|---|
| `test_watch_service.py` + `test_watch_diff_completeness.py` | **10 passed, 0 failed** | **10 passed, 0 failed** |
| `test_watch_sync_runs.py` (new) | — | **8 passed, 0 failed** |
| plus `test_watches_db.py` + `test_sources_watches_api.py` | — | **34 passed, 0 failed** (all four) |

**Acceptance criteria:**

| Criterion | Result |
|---|---|
| `grep -c "release_watch(" watch_service.py` = 4 | ✅ **4** — none added, none lost |
| each of the 4 carries `counts=` | ✅ measured per call block (see Deviations) — the *"within 3 lines"* literal is refuted |
| `grep -n "classify_failure_cause"` ≥ 2 | ✅ **6 lines**; two are the seam-1 and seam-4 call sites (`:168`, `:283`/`:593`) |
| `grep -c "run_in_threadpool(release"` = 0 | ✅ **0** — `release_watch` is asyncpg all the way down (C-2) |
| 234's watch suites pass at prior count | ✅ **10 → 10** |
| new suite: 0 failed, ≥ 7 passed | ✅ **8 passed, 0 failed** |
| exactly four seam cases, named for their seam | ✅ `test_tick_crash_arm_…` / `test_paused_arm_…` / `test_success_arm_…` / `test_unauthorized_arm_…` |
| first collected test is the non-vacuity control | ✅ `test_release_watch_double_is_installed_and_callable` |
| RED drive recorded + file restored | ✅ verbatim above; restore proven by `git status` |
| `record_skipped_still_running` resolved and stated | ✅ import DELETED, with the reason it must not be called |
| `STATE.md` / `ROADMAP.md` / `vitest-count-gate.cjs` untouched | ✅ `git diff --name-only` names none of them |

**Frontend:** untouched. The vitest gate was **deliberately not run** — stated here rather than
skipped silently. The composition fence is red on purpose and is plan 12's, not mine.

---

## Known Stubs

None. This plan renders nothing to a user.

⚠ **ONE HONEST LIMIT, AND IT IS THE IMPORTANT PARAGRAPH IN THIS FILE.** `release_watch`
**swallows its INSERT exception by design** (T-235-05) — losing a history row must never turn a
successful sync into a failed one. **Nothing in the code, and nothing in this suite, can
distinguish "wrote a row" from "raised and was logged."** Every assertion added here is about
the CALL the service makes, never about a row in `connector_sync_runs`.

So the correct claim is: **the four seams are verified to PASS the right values, and are NOT
verified to have STORED them.** The first honest check is a non-zero
`select count(*) from connector_sync_runs` after a real tick, plus a spot-check that
`count_renamed` / `listing_complete` on that row match what the log line printed. That is a G-4
UAT row and it is **owed**, not discharged. Plan 01's identical caveat is therefore **narrowed,
not closed**: what has changed is that the values reaching the swallow are now real.

⚠ Research assumption **A1** (which database role the asyncpg pool connects as, versus migration
172's grants) is still unmeasured and is carried forward from plan 01 unchanged. It is the same
one query — `select current_user` on the pool — and it also gates plan 01's owed grant narrowing.

---

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access and no schema change.

Register dispositions honoured:

| Threat | Disposition | How |
|---|---|---|
| T-235-15 (a failure class with no history row) | mitigate | seam 1 edited explicitly; pinned by a case that replaces `sync_watch` wholesale |
| T-235-16 (a suppressed `count_missing` reading as "nothing deleted") | mitigate | `listing_complete` threaded from `listing.complete`; asserted as a PAIR with the zero, with the suppression itself proven via `update_item_state.assert_not_awaited()` |
| T-235-17 (raw provider text stored as evidence) | accept | `last_error` unchanged in content and destination; never rendered raw here |
| T-235-SC (package installs) | n/a | **no package installed** |

---

## ⛔ Owed items — carried forward, not closed

| # | Owed | Trigger |
|---|---|---|
| 1 | **Prove a row is actually written.** The insert is swallowed; a green suite is not evidence. Needs a non-zero `count(*)` after a real tick, with `count_renamed` / `listing_complete` cross-checked against the log line. | a G-4 UAT row on this phase |
| 2 | **Delete the DAL's `record_skipped_still_running`** (and its case in `test_watches_db.py`). The import is gone, so nothing in production reaches it, but the function and its test remain. | any plan whose `files_modified` includes `backend/app/db/watches.py` |
| 3 | **Measure the pool's database role** (A1) — unblocks plan 01's owed grant narrowing on `connector_sync_runs`. | inherited from plan 01, unchanged |
| 4 | **`watch_service.py`'s hot-file ledger row is now stale.** CLAUDE.md records `2 / 1 / 458`; it measures **599 lines** after this plan. The disposition cell also still says the file *"reaches NO rules engine (`BUG-260906-01`)"*, which this plan does not change. | the phase close, which owns the CLAUDE.md ledger re-derivation |

---

## Commits

| Commit | What |
|---|---|
| `c71bfedef` | `test` — RED: repin the four existing release assertions to what the tick did (4 failed, 2 passed) |
| `f50e3c294` | `feat` — GREEN: all four seams carry counts + cause + listing_complete; dead import deleted |
| `cd8606657` | `test` — the eight-case suite that fails if any one seam stops writing |

---

## Self-Check: PASSED

- `backend/app/services/watch_service.py` — **FOUND** (599 L)
- `backend/tests/unit/services/test_watch_sync_runs.py` — **FOUND** (367 L)
- `backend/tests/unit/services/test_watch_service.py` — **FOUND**
- `c71bfedef`, `f50e3c294`, `cd8606657` — all three resolve in `git log`
- `git diff --diff-filter=D` on every commit → **0 deletions**
- `git status --short` after the RED drive → `watch_service.py` **not listed**, i.e. byte-identical to `f50e3c294`
- No new untracked files beyond the one this plan created and committed

⛔ `STATE.md`, `ROADMAP.md` and `scripts/vitest-count-gate.cjs` were **not** modified — the
orchestrator owns the first two and plan 12 owns the third.
