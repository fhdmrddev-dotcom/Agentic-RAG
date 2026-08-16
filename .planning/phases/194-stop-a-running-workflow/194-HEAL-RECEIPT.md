---
phase: 194-stop-a-running-workflow
plan: 13
artifact: heal-receipt
target_db: "local dev only — postgresql://postgres:postgres@127.0.0.1:54322/postgres"
cloud_applied: false
measured_on: 2026-08-16
base_commit: dcf93a81
rows_healed: 5
---

# Phase 194 — the data heal receipt (D-12 / D-17 / V-20)

> **What this file is for.** *A data repair with no receipt is indistinguishable from a claim*
> (D-12). This is the before column, the after column, the method used **per row**, and the reason
> each method was the right instrument for that row.

⛔ **LOCAL DEV ONLY.** Nothing in this file was applied to the cloud database. No migration was
applied or edited. `supabase db push` and `supabase db reset` were not run.

---

## Scope — the rows this receipt covers, and nothing else

Five rows and two thread anchors, every one addressed **by id**. ⛔ **No predicate sweep was ever
issued against `workflow_phases` or `workflow_runs`** (threat `T-194-13-01`) — the one predicate
that does run is `cancel_active_phases`' own shipped `AND status = 'active'`, inside a
`WHERE workflow_run_id = $1` already narrowed to a single named run.

---

## BEFORE

**Date:** 2026-08-16 · **DSN:** `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
**Base commit:** `dcf93a81` · **Session:** `psycopg2`, `set_session(readonly=True)` — the BEFORE
capture **could not have written anything**, which is why it is a base rather than a snapshot.

### Q1 — `workflow_runs` WHERE status IN ('active','paused','cap_paused') ORDER BY created_at

```
id | thread_id | status | created_at | updated_at | is_golden_run
fde3bbe3-02c2-4664-902f-921411bb1fe7 | 4bf89cbc-5630-4fb3-982e-5fd179450003 | active | 2026-06-14 21:15:56.171618+00:00 | 2026-07-18 20:43:42.887245+00:00 | False
4b0feda7-c524-4a18-8ea0-4c6fc9705868 | e52a19f7-52cc-45ba-bedf-03247a8c4133 | active | 2026-08-01 17:04:34.899039+00:00 | 2026-08-09 06:12:35.972373+00:00 | True
(2 rows)
```

### Q2 — `workflow_phases` status='active', joined to their run

```
id | workflow_run_id | slug | phase_index | status | updated_at | run_status
961c290d-8ec7-46c2-b6d9-58923f8612cc | 5aa42b6b-2bc0-43b3-8044-bc2d25ff7355 | confirm | 1 | active | 2026-07-18 20:43:42.944508+00:00 | failed
9e6acf54-8c10-46d8-8351-5d31dc3946af | e0d1f740-31ef-400c-b0e7-625aac8ab62f | confirm | 1 | active | 2026-07-18 20:43:42.944508+00:00 | failed
0e0cf57c-b2ba-4b49-8b05-1448a2531aad | 4b0feda7-c524-4a18-8ea0-4c6fc9705868 | summarize | 1 | active | 2026-08-01 17:06:14.541934+00:00 | active
(3 rows)
```

### Q3 — threads holding an anchor

```
id | active_workflow_run_id
e52a19f7-52cc-45ba-bedf-03247a8c4133 | 4b0feda7-c524-4a18-8ea0-4c6fc9705868
4bf89cbc-5630-4fb3-982e-5fd179450003 | fde3bbe3-02c2-4664-902f-921411bb1fe7
(2 rows)
```

### Q4 — `runs` histogram

```
status | count
cancelled | 29
completed | 1002
failed | 136
timed_out | 1
(4 rows)
```

⚠ **`streaming` = ZERO. STATED EXPLICITLY BECAUSE IT IS THE FACT THAT DECIDES WHICH ARM RUNS.**
Not one `runs` row in the whole database is `streaming`, so the `DELETE /runs/{id}` forward
resolution's `LEFT JOIN runs r ON r.thread_id = wr.thread_id AND r.status = 'streaming'` returns
`producer_id IS NULL` for both stuck runs, and the route takes the **no-live-producer arm** — the
one that calls `cancel_workflow_run_internals`. It does **not** take the live-producer arm and it
does **not** reach `_cancel_run_internals`. This was not inferred from the histogram alone; the
route's own SQL was executed verbatim, read-only, against both ids (§ *Which arm the route would
take*, below).

### Q5a — `workflow_runs` histogram

```
status | count
active | 2
completed | 179
failed | 31
(3 rows)
```

### Q5b — `workflow_phases` histogram

```
status | count
active | 3
completed | 423
failed | 41
pending | 23
recorded_not_sent | 5
skipped | 1
(6 rows)
total: 496
```

---

## The per-row table D-12 requires

### Group A — the two `workflow_runs` rows

| # | `workflow_runs.id` | `thread_id` | `created_at` | `updated_at` | status BEFORE | `is_golden_run` | anchor points here? | owner |
|---|---|---|---|---|---|---|---|---|
| A1 | `fde3bbe3-02c2-4664-902f-921411bb1fe7` | `4bf89cbc-5630-4fb3-982e-5fd179450003` | 2026-06-14 21:15:56.171618+00 | 2026-07-18 20:43:42.887245+00 | `active` | `False` | ✅ yes | `d8a54002-6a29-4b88-b918-cff2aa4a06d5` |
| A2 | `4b0feda7-c524-4a18-8ea0-4c6fc9705868` | `e52a19f7-52cc-45ba-bedf-03247a8c4133` | 2026-08-01 17:04:34.899039+00 | 2026-08-09 06:12:35.972373+00 | `active` | ⚠ **`True`** | ✅ yes | `d8a54002-6a29-4b88-b918-cff2aa4a06d5` |

Supporting, all measured at this commit:

- **A1** → definition `pm-weekly-status-report` (*Weekly Status Report*, `published`,
  `is_system_global = False`); thread *"PM scoreboard openai/gpt-4o"*.
- **A2** → definition `meridian-risk-summary-good-07aedc33` (*Project Meridian Risk Summary
  (GOOD)*, `published`, `is_system_global = False`); thread *"[validation] publish golden run —
  Project Meridian Risk Summary (GOOD)"*.
- **A1's producer `runs` row is ALREADY `cancelled`** — `652ec9bb-f8f8-4937-8a61-655959e25749`,
  started 2026-06-14 21:15:56.153028+00. ⇒ **A1 is the G-B gap in its purest historical form: the
  `runs` half was cancelled and the `workflow_runs` half was never told.**

### Group B — the two ORPHAN `workflow_phases` rows

| # | `workflow_phases.id` | `workflow_run_id` | run status | `thread_id` (of the run) | slug | index | `created_at` | `updated_at` | status BEFORE |
|---|---|---|---|---|---|---|---|---|---|
| B1 | `961c290d-8ec7-46c2-b6d9-58923f8612cc` | `5aa42b6b-2bc0-43b3-8044-bc2d25ff7355` | **`failed`** | `b3f8fda5-a956-4d51-a01b-28ff6fde3884` | `confirm` | 1 | 2026-06-01 21:08:57.377307+00 | 2026-07-18 20:43:42.944508+00 | `active` |
| B2 | `9e6acf54-8c10-46d8-8351-5d31dc3946af` | `e0d1f740-31ef-400c-b0e7-625aac8ab62f` | **`failed`** | `cef20cdf-98d5-4087-b2bf-94d8117dd9d7` | `confirm` | 1 | 2026-06-03 18:36:53.000536+00 | 2026-07-18 20:43:42.944508+00 | `active` |

Neither parent run is `is_golden_run`. Neither parent thread holds an anchor (Q3 lists only the two
Group-A threads), so **no anchor is cleared by Group B and none needed to be.**

### The consequence row — C1

| # | `workflow_phases.id` | `workflow_run_id` | run status | slug | index | `updated_at` | status BEFORE |
|---|---|---|---|---|---|---|---|
| C1 | `0e0cf57c-b2ba-4b49-8b05-1448a2531aad` | `4b0feda7-…` (**A2**) | `active` | `summarize` | 1 | 2026-08-01 17:06:14.541934+00 | `active` |

---

## ⚠ THE 3-vs-2 DISCREPANCY — RESOLVED BY MEASUREMENT, AND THE RESOLUTION CORRECTS THIS PLAN

`194-MIGRATION-RECEIPT.md` carried this forward with an explicit instruction not to assume it away:
`workflow_phases` holds **THREE** `active` rows; `194-CONTEXT.md` **D-17** describes **TWO**. Both
figures are recorded, the loser beside the winner.

**Measured verdict: D-17 IS CORRECT, and `194-12`'s three is also correct — they are counting
different things.** The two orphans are `961c290d` and `9e6acf54`, both `confirm`, both under runs
that are already terminally `failed`. The third, `0e0cf57c` (`summarize`), sits under run
`4b0feda7` — **which is A2, one of the two stuck runs being healed here**. It is **not a third
orphan; it is that run's interrupted phase**, and it is exactly the row `cancel_active_phases`
exists to terminalize.

### ⚠ CONSEQUENCE — THE PLAN'S "EXACTLY FOUR ROWS MOVED" ACCEPTANCE CRITERION IS WRONG AS WRITTEN, AND CORRECT BEHAVIOUR FAILS IT

`194-13-PLAN.md`'s Task 2 requires *"the histograms show **exactly four** rows moved — two
`workflow_runs` and two `workflow_phases`"*. That criterion was written before the third `active`
phase row was attributed. Healing A2 **through the composition this phase built** must also
terminalize `0e0cf57c`, because `cancel_workflow_run_internals` calls `cancel_active_phases` on the
run it just finished. **That is SC#3 working — and it is the best available evidence for SC#3 on
real data, not a scope violation.**

**Expected: FIVE rows move, plus two anchors cleared.** The plan's wording is left standing above
and the corrected expectation is recorded beside it:

| row | table | change | why |
|---|---|---|---|
| A1 `fde3bbe3` | `workflow_runs` | `active` → `cancelled` | the heal |
| A2 `4b0feda7` | `workflow_runs` | `active` → `cancelled` | the heal (⚠ `is_golden_run = True`) |
| C1 `0e0cf57c` | `workflow_phases` | `active` → `cancelled` | **a CONSEQUENCE of healing A2 — SC#3** |
| B1 `961c290d` | `workflow_phases` | `active` → `cancelled` | orphan, one-off recorded write |
| B2 `9e6acf54` | `workflow_phases` | `active` → `cancelled` | orphan, one-off recorded write |
| `4bf89cbc` | `threads` | anchor → `NULL` | `finish_run`'s own transaction |
| `e52a19f7` | `threads` | anchor → `NULL` | `finish_run`'s own transaction |

⚠ **A1 has NO `active` phase row, so healing it moves only its run row and its anchor.** Its two
phases read `pending` (`5dc9355f` `retrieve` idx 0, `02d8e0a8` `emit` idx 1) and
`cancel_active_phases`' `AND status = 'active'` clause leaves both untouched — which is the same
clause `194-09`'s F-5 fence drove RED against a widened-predicate plant. **`pending` is out of its
reach and must stay so.**

**Predicted AFTER:** `workflow_runs` `active` **0** / `cancelled` **2**; `workflow_phases` `active`
**0** / `cancelled` **3**, total still **496**; `threads` holding an anchor **0**. Recorded as a
prediction *before* the write, so the AFTER column can be compared to it rather than fitted to it.

---

## Which arm the route would take — measured read-only, before any write

The route's forward-resolution SQL (`backend/app/api/runs.py:1264-1270`) was executed **verbatim**
against both ids on the read-only session, together with the three authorization clauses it gates
on. This is evidence about **which code path is correct for these rows**, gathered without writing.

**Clauses (a) `workflow_runs.user_id`, (b) `threads.user_id`, (c) the anchor equality:**

```
wf_id | thread_id | thread_owner | wf_owner | owner_match | active_workflow_run_id | anchor_confirms
4b0feda7-… | e52a19f7-… | d8a54002-… | d8a54002-… | True | 4b0feda7-… | True
fde3bbe3-… | 4bf89cbc-… | d8a54002-… | d8a54002-… | True | fde3bbe3-… | True
```

⇒ For the owning user `d8a54002-…`, all three clauses admit both rows. **No clause was relaxed,
deleted or evaluated with a different filter to obtain this — it is a read of the live data through
the route's own predicates.**

**The forward resolution:**

```
-- fde3bbe3-02c2-4664-902f-921411bb1fe7: 1 row
   fde3bbe3-… | 4bf89cbc-… | producer_id=None | producer_status=None
   producer rows with producer_id NOT NULL: 0  =>  arm = NO-LIVE-PRODUCER
-- 4b0feda7-c524-4a18-8ea0-4c6fc9705868: 1 row
   4b0feda7-… | e52a19f7-… | producer_id=None | producer_status=None
   producer rows with producer_id NOT NULL: 0  =>  arm = NO-LIVE-PRODUCER
```

⇒ Both rows resolve to `_producer is None`, so the route's `else:` arm runs:
`publish_cancel_sentinel(redis, run_id)` (best-effort) then
`await cancel_workflow_run_internals(pool=pool, workflow_run_id=run_id)`, then `204`. **The shared
`_cancel_run_internals` writer is never called on this arm** — which is the whole point of
`194-11`'s plant (e).

---

## AFTER

_(Recorded in the second half of this receipt — see § AFTER, below.)_
