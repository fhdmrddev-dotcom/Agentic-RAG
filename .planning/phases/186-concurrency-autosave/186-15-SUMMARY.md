---
phase: 186-concurrency-autosave
plan: 15
subsystem: workflow-authoring-tests
tags: [evidence-honesty, wr-11, wr-06, concurrency, wire-contract]
gap_closure: true
closes: [WR-11, WR-06]
requires:
  - "186-13 (waves 1-8 shipped)"
provides:
  - "a pane-click dismissal assertion that is not time-dependent, with its own positive control"
  - "the stale_token 409 wire shape asserted on a machine with no Postgres"
  - "the db-tier refusal disambiguation and the token's text-space contract, both DB-free"
affects:
  - "backend/tests/unit/test_186_concurrent_patch.py"
  - "frontend/src/pages/WorkflowBuilderPage.session.test.tsx"
tech-stack:
  added: []
  patterns:
    - "per-test skipif + a one-home _LIVE_DB_REASON constant (the 186-11 precedent)"
    - "delta measurement bracketing an action, with an in-row positive control"
    - "mocked pool.fetchrow side_effect list to drive db-tier return shapes"
key-files:
  created: []
  modified:
    - "frontend/src/pages/WorkflowBuilderPage.session.test.tsx"
    - "backend/tests/unit/test_186_concurrent_patch.py"
decisions:
  - "D-186-15-A: WR-11 is fixed as a DELTA, not under fake timers — swapping the session file onto fake timers would change the timing model of 22 other rows for the sake of one."
  - "D-186-15-B: mockCreate keeps its ABSOLUTE zero; only the PATCH assertion becomes a delta."
  - "D-186-15-C: WR-06's residue is closed IN the existing file rather than a new one, so one contract stays in one file."
metrics:
  duration: "~55 min"
  completed: "2026-08-01"
  tasks: 3
  commits: 3
---

# Phase 186 Plan 15: WR-11 + WR-06 residue (evidence honesty) Summary

Two green-but-silent suites made checkable: the pane-click dismissal row now measures the
dismissal instead of the wall clock, and the `stale_token` 409 wire contract the client
branches its whole conflict UX on is now asserted on a machine with no Postgres.

## What shipped

| Task | Change | Commit |
|---|---|---|
| 1 | Pane-click row rewritten as a delta + in-row positive control (WR-11) | `165b3e0e` |
| 2 | Module `pytestmark` → four per-test `skipif`; DB-free route-tier refusal mapping (WR-06) | `03841bd0` |
| 3 | DB-free db-tier return shapes + the two SQL properties (WR-06) | `c4870806` |

Exactly the two files in `files_modified` were touched — `git diff --stat e9f9c2fd..HEAD`
reports 2 files, 422 insertions, 8 deletions, and no source file outside them.

---

## ⚠ THE MEASUREMENT THAT DID NOT REPRODUCE — read this before quoting any WR-11 number

The plan directed me to record the RED first. **I could not reproduce it.** What follows is
what I actually observed, not what I was told to expect.

### Pre-fix, on this machine (2026-08-01), the shipped row PASSED in every configuration

| # | Configuration | Result |
|---|---|---|
| 1 | `npx vitest run src/pages/WorkflowBuilderPage.session.test.tsx --testTimeout=30000` | **23 passed (23)** |
| 2 | same, second consecutive run | **23 passed (23)** |
| 3 | same, third consecutive run | **23 passed (23)** |
| 4 | `... header.test.tsx session.test.tsx` (the pair) | **50 passed (50)** |
| 5 | `npx vitest run src/pages` (16 files, parallel) | **260 passed (260)** |

The verifier recorded 22 passed / 1 failed over three runs *including full isolation*, and
49 + 1 for the pair. 186-14 independently reported the row passing. So the row is **not**
deterministically red, and the phase now has three mutually inconsistent reports of it.

### So I falsified the diagnosis directly, and the diagnosis is CORRECT

Rather than inherit either number, I reproduced the failure mechanism on purpose. Injecting
a 1500 ms pause between the pane appearing and the pane click — standing in for a lazy
import slower than the 1000 ms `AUTOSAVE_DEBOUNCE_MS` — against the **shipped** assertion:

```
× pane click — ... issues no PATCH (WR-11)  2009ms
AssertionError: expected "vi.fn()" to be called +0 times, but got 1 times
Tests  1 failed | 22 passed (23)
```

That is the verifier's exact signature: 22 / 1, same assertion, same message. **The
verifier's measurement was real and its diagnosis was right.** The row is a latent timing
bomb whose fuse length is the lazy-canvas import time; on this machine (warm vite cache)
that import resolves inside the debounce, so the bomb does not go off. I was denied
permission to clear `node_modules/.vite`, so the cold-cache condition itself was not
reachable — the injected pause is the stand-in.

Keeping the 1500 ms pause and switching to the **new** delta assertion: **23 passed (23)**.
The fix survives precisely the condition that breaks the old assertion.

### The positive control was itself falsified

To prove the control is not decoration, I temporarily broke the helper the way it is most
likely to break — snapshotting `mockUpdate.mock.calls` (the live array) instead of
`.length`, which always yields a delta of 0:

```
AssertionError: expected 0 to be greater than or equal to 1
Tests  1 failed | 22 passed (23)
```

The control catches exactly the bug class its comment names.

### Post-fix, three consecutive runs

| # | Result |
|---|---|
| 1 | **23 passed (23)** |
| 2 | **23 passed (23)** |
| 3 | **23 passed (23)** |
| pair (`header` + `session`) | **50 passed (50)** |

### The claim this SUMMARY exists to kill

**The 186-12 / 186-13 SUMMARY claim that this row "passes in isolation" was FALSE as
stated** — not because the row always fails (it does not), but because it was asserted as a
property of the row when it is a property of the *machine and the cache*. `/gsd:verify-work`
falsified it on 2026-08-01 by measuring it red three times. This execution measured it green
six times. **Neither figure is the row's true state; the row had no true state, which is the
defect.** After this plan the row's result no longer depends on the import time at all, so
the question stops being interesting. Do not inherit any of these numbers on trust.

### Frontend count gate (the Phase 177 lesson)

| | Before | After |
|---|---|---|
| `WorkflowBuilderPage.session.test.tsx` | 23 collected (23 passed observed here; the verifier saw 22 + 1 failed) | **23 collected, 23 passed** |
| `header` + `session` pair | 50 | **50** |

The row was **rewritten, never removed**: no `it.skip` / `describe.skip` / `xit` anywhere in
the file, `toHaveBeenCalledTimes(0)` still appears **12** times (both sibling rows' `mockUpdate`
and all three rows' `mockCreate` are untouched), and `patchDelta` has exactly one declaration
and two call sites, both inside the pane-click row.

---

## WR-06 residue — the wire contract now survives a CI with no Postgres

### Backend measurements, before and after

`backend/tests/unit/test_186_concurrent_patch.py`:

| Configuration | Before | After |
|---|---|---|
| live local DB (`:54322`) | `4 passed` | **`13 passed`** |
| `POSTGRES_DSN=…:59999` (unreachable) | `4 skipped` (0 passed) | **`9 passed, 4 skipped`** |

The plan's verification trio (`test_186_concurrent_patch.py`, `test_186_publish_race.py`,
`test_103_published_409.py`):

| Configuration | Before | After |
|---|---|---|
| live DB | `12 passed` (plan's baseline) | **`21 passed`, 0 failed** |
| no DB | `3 passed` (plan's baseline) | **`12 passed, 9 skipped`** |

Backend collection: **3465 → 3474**, exactly +9, matching the nine new DB-free tests.

Full backend suite, both runs taken on this machine today:

| Run | Result |
|---|---|
| pre-plan (this file restored to `165b3e0e`) | `211 failed, 3228 passed, 11 skipped, 5 xfailed, 9 xpassed, 1 error` |
| post-plan (HEAD) | `211 failed, 3237 passed, 11 skipped, 5 xfailed, 9 xpassed, 1 error` |

**Failure count identical (211); passed count +9.** The 211 failures are pre-existing rot in
`test_retrieval_service.py`, `test_sandbox_service.py`, `test_sql_service.py`,
`test_streaming_reliability.py` and friends — entirely unrelated to this phase, and present
byte-for-byte before this plan. Grepping the full-suite output for
`test_186_concurrent_patch` / `test_186_publish_race` / `test_103_published_409` returns
**nothing**: none of the phase-186 files fail in a whole-suite run.

### What is now asserted without a database

Route tier (`update_draft`'s `cause` → HTTP mapping, `get_pg_pool` and the db function both
mocked):

- `stale_token` → **409** with `detail["code"] == "stale_token"` and `detail["token"]`
  carried verbatim; a `message` exists and **nothing asserts its wording** — the D-186-09
  rule made structural.
- `already_published` → **409** compared against `wf_api._ALREADY_PUBLISHED_DETAIL` itself,
  never a retyped literal.
- `not_found` **and** an unrecognised cause → the **same** codeless string **404**, asserted
  as an equality between the two details plus `isinstance(..., str)`. This is the fail-closed
  property the route's own comment claims and nothing checked (T-186-15-02).
- `CheckViolationError` → the same 409 as `already_published` (the published-row race arm,
  which also had no DB-free cover).

Db tier (`update_workflow_definition` driven through a mocked `pool.fetchrow`):

- matching UPDATE → `ok: True`, **and the probe never runs** (`await_count == 1`) — D-186-09
  promised the extra query is a failure-path cost only.
- `None`/`None` → `not_found`; `None`/published → `already_published`; `None`/draft+token →
  `stale_token` with the probe's token carried through verbatim.
- the `token=None` **defensive collapse** → `not_found`, never `stale_token`, plus the
  two-statement shape (`CONCURRENCY_TOKEN_SQL` absent from the WHERE, five binds not six).
  This branch is meant to be unreachable, which is exactly why it could rot unseen.
- the two SQL properties the verification report had established **by reading**:
  `CONCURRENCY_TOKEN_SQL` in both the WHERE and the RETURNING, `created_by = $2` on both the
  guarded UPDATE and the probe (T-186-01-01 / T-186-01-02), and **no bind is ever a
  `datetime`** — text-space comparison through the one constant (D-186-07).

### These tests were falsified against the real source — all three with NO database

| Injected defect | Result |
|---|---|
| rename the 409 detail's `token` key to `current_token` | `1 failed, 3 passed, 4 skipped` — `test_stale_token_reaches_the_wire_as_a_409_carrying_code_and_token` |
| give the fail-closed 404 a machine code (`detail={"code": cause …}`) | `1 failed, 3 passed, 4 skipped` — `test_not_found_and_an_unrecognised_cause_are_the_same_codeless_404` |
| drop `created_by = $2` from the owner-scoped probe (the existence leak) | `1 failed, 8 passed, 4 skipped` — `test_the_token_is_a_third_conjunct_and_every_bind_travels_as_text` |

Every injected defect was reverted with a file-scoped `git checkout --`; `git status` shows
`backend/app/api/workflows.py` and `backend/app/db/workflows.py` clean, and the plan's
`git diff --stat e9f9c2fd..HEAD` confirms only the two test files changed.

### Structural checks

- `grep -c "^pytestmark" backend/tests/unit/test_186_concurrent_patch.py` → **0**
- `grep -c "skipif(not PG_AVAILABLE, reason=_LIVE_DB_REASON)"` → **4** (F1, F2, F3, F13; none
  of their bodies were modified)
- `_LIVE_DB_REASON` is byte-identical to the reason the `pytestmark` carried, so the skip
  report reads exactly as before
- `stale_token` in `backend/tests/**/*.py`: **13 → 18 lines**, still one file, but now across
  **two DB-free tests** (`test_stale_token_reaches_the_wire_…` at the route tier and
  `test_the_token_is_a_third_conjunct_…` at the db tier) — the plan's stated alternative
- no NEW timestamp-shaped token literal: the only match is F3's shipped `some_token`
  (line 299). Every token added by this plan is an opaque sentinel (`T-NOW` / `T-OLD`).
  I reworded my own explanatory comment mid-task so it describes the anti-pattern without
  containing a literal timestamp, keeping the grep unambiguous.
- `CONCURRENCY_TOKEN_SQL` is **imported** from `app.db.workflows`, never retyped
- `ls supabase/migrations | tail -1` → `114_harness_audit_action_risk_pending.sql`;
  `git diff --stat supabase/migrations/` empty
- `git diff --stat frontend/package.json frontend/package-lock.json backend/requirements.txt`
  empty — no dependency change in either stack (T-186-15-SC)

---

## Deviations from Plan

### 1. [Evidence] The plan's required RED could not be observed, and I did not fabricate it

The plan's `must_haves` state as a truth: *"RED evidence to record: the shipped absolute
assertion fails 3/3 runs including full isolation."* On this machine it passed 3/3 in
isolation, 50/50 paired, and 260/260 under 16-file parallel load. I recorded what I measured
and reproduced the failure mechanism by injecting a 1500 ms pause instead — which yielded
the verifier's exact signature and confirmed the diagnosis. **The truth as literally written
is not satisfied; the property it exists to protect is.** A future reader auditing this
plan's `must_haves` against reality should read the WR-11 section above rather than assume
the row was red here.

### 2. [Scope] The full backend suite had no pre-plan baseline, so I took one

The plan's Task 3 acceptance asks for the full suite's failure count "not greater than the
pre-plan run", but no pre-plan run existed. After committing Task 3 I restored this file to
its `165b3e0e` state, ran the full suite, recorded `211 failed / 3228 passed`, then restored
from HEAD. Both numbers are in the table above rather than one number plus an argument.

No Rule 1/2/3 auto-fixes were needed — no product code was changed by this plan.

## Known Stubs

None. This plan adds only tests, and every test added asserts a property against real
shipped code (falsified above).

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change. The plan's
own register is addressed: T-186-15-01 (the module skip becomes per-test), T-186-15-02 (the
fail-closed 404, now falsified), T-186-15-04 (opaque sentinels only) and T-186-15-05 (both
WR-11 measurements recorded) are mitigated; T-186-15-03 (the token is deliberately disclosed)
and T-186-15-SC (no installs) remain accepted, and no assertion was added about the token's
format.

## Self-Check: PASSED

- `frontend/src/pages/WorkflowBuilderPage.session.test.tsx` — FOUND
- `backend/tests/unit/test_186_concurrent_patch.py` — FOUND
- `.planning/phases/186-concurrency-autosave/186-15-SUMMARY.md` — FOUND
- commit `165b3e0e` — FOUND
- commit `03841bd0` — FOUND
- commit `c4870806` — FOUND
