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

## Method — per group, with the reason, because THE METHOD IS PART OF THE DELIVERABLE

### ⚠ READ THIS FIRST: which instrument healed Group A, stated per row rather than left inferable

**The two run rows were healed by calling the exported composition
`backend/app/services/run_lifecycle.py::cancel_workflow_run_internals(*, pool, workflow_run_id)`
directly — NOT by driving `DELETE /runs/{workflow_run_id}` over HTTP.** That is stated plainly and
per row, because *a receipt that implies the route ran when the function was called directly is the
same class of false claim D-12 exists to prevent.*

| row | instrument | evidence |
|---|---|---|
| A1 `fde3bbe3` | `await cancel_workflow_run_internals(pool=pool, workflow_run_id='fde3bbe3-…')` | § *Group A — the drive*, below |
| A2 `4b0feda7` | `await cancel_workflow_run_internals(pool=pool, workflow_run_id='4b0feda7-…')` | § *Group A — the drive*, below |
| B1 `961c290d` | one id-scoped `UPDATE`, `rowcount = 1` | § *Group B — the drive*, below |
| B2 `9e6acf54` | one id-scoped `UPDATE`, `rowcount = 1` | § *Group B — the drive*, below |
| C1 `0e0cf57c` | **no instrument of its own** — written by `cancel_active_phases` inside A2's composition | § *Group A — the drive*, below |

**Why the HTTP route was not driven, measured rather than asserted.** The backend was up and the
route's authentication guard was verified LIVE and left intact:

```
GET  /health                                   -> 200
DELETE /runs/fde3bbe3-…  (no Authorization)    -> 403  {"detail":"Not authenticated"}
```

The route requires a Supabase user JWT for the owning user `d8a54002-6a29-4b88-b918-cff2aa4a06d5`,
and no legitimate token for that user was obtainable in this session. ⛔ **No authentication was
forged, minted, impersonated or bypassed; no dependency was overridden; no guard was weakened,
relaxed or deleted to make a call succeed.** That was an explicit constraint and it is recorded as
honoured rather than assumed. The 403 above is the guard doing its job, and it wrote nothing — the
request never reached Step 1's ownership `SELECT`.

**What is therefore evidenced, and what is NOT.** `cancel_workflow_run_internals` *is* the shared
writer this phase built (plan `194-09`), and it is *exactly* what the route's no-live-producer arm
calls — one composition, two callers (D-08/D-10). So this heal evidences **the composition**, and
with it SC#2's server-side half and SC#3's phase terminalize, on real data. It does **not**
evidence the HTTP layer above it: the dual-id fallback's three authorization clauses, the forward
resolution, `publish_cancel_sentinel`, and the `204` were **not exercised here**. Their RED-driven
evidence is plan `194-11`'s six production-source plants, and this receipt does not stand in for
them. ⚠ **The `204` responses the plan's acceptance criteria ask for DO NOT EXIST and are not
claimed.**

⚠ **The one thing measured about the route rather than assumed:** its forward-resolution SQL was
executed verbatim, read-only, against both ids and returned `producer_id IS NULL` for both (§ *Which
arm the route would take*). So the arm that would have run **is** the arm whose writer was called —
the instrument differs from the route, the write does not.

⚠ **One arm of the route was deliberately not replicated:** `publish_cancel_sentinel(redis, run_id)`.
It wakes a paused harness `ask_user` prompt subscribed on the workflow-run channel. Not replicating
it is a decision with a measured basis, not an omission: zero `runs` rows are `streaming` (Q4), both
runs have been abandoned since 2026-06-14 and 2026-08-01, and there is no subscriber to wake. The
route treats it as best-effort by contract anyway.

### Group A — the drive

Both rows were healed **one at a time, by id**, each with its own before/after re-read.
⚠ **`cancel_workflow_run_internals` NEVER RAISES** (best-effort by contract, D-062-13) — so a clean
return proves nothing at all, and **every write below is verified by RE-READING the row**, never by
the absence of an exception. A `WARNING`/`ERROR` log handler was attached for the whole drive to
catch anything the composition swallowed: **0 records captured.**

```
==============================================================================
A1  fde3bbe3-02c2-4664-902f-921411bb1fe7
------------------------------------------------------------------------------
  BEFORE run   : {'id': UUID('fde3bbe3-02c2-4664-902f-921411bb1fe7'), 'status': 'active', 'updated_at': datetime.datetime(2026, 7, 18, 20, 43, 42, 887245, tzinfo=datetime.timezone.utc), 'is_golden_run': False}
  BEFORE phase : {'id': UUID('5dc9355f-28b8-4a4a-aaa7-23bd85cda345'), 'slug': 'retrieve', 'phase_index': 0, 'status': 'pending'}
  BEFORE phase : {'id': UUID('02d8e0a8-2650-4128-a145-76a6a96f69b4'), 'slug': 'emit', 'phase_index': 1, 'status': 'pending'}
  BEFORE anchors: [{'id': UUID('4bf89cbc-5630-4fb3-982e-5fd179450003'), 'active_workflow_run_id': UUID('fde3bbe3-02c2-4664-902f-921411bb1fe7')}]
  >>> await cancel_workflow_run_internals(pool=pool, workflow_run_id='fde3bbe3-02c2-4664-902f-921411bb1fe7')
  AFTER  run   : {'id': UUID('fde3bbe3-02c2-4664-902f-921411bb1fe7'), 'status': 'cancelled', 'updated_at': datetime.datetime(2026, 8, 16, 5, 59, 33, 756251, tzinfo=datetime.timezone.utc), 'is_golden_run': False}
  AFTER  phase : {'id': UUID('5dc9355f-28b8-4a4a-aaa7-23bd85cda345'), 'slug': 'retrieve', 'phase_index': 0, 'status': 'pending'}
  AFTER  phase : {'id': UUID('02d8e0a8-2650-4128-a145-76a6a96f69b4'), 'slug': 'emit', 'phase_index': 1, 'status': 'pending'}
  AFTER  anchors: []
  VERIFIED by re-read: run=cancelled, anchors_remaining=0
==============================================================================
A2  4b0feda7-c524-4a18-8ea0-4c6fc9705868
------------------------------------------------------------------------------
  BEFORE run   : {'id': UUID('4b0feda7-c524-4a18-8ea0-4c6fc9705868'), 'status': 'active', 'updated_at': datetime.datetime(2026, 8, 9, 6, 12, 35, 972373, tzinfo=datetime.timezone.utc), 'is_golden_run': True}
  BEFORE phase : {'id': UUID('d751095b-36c9-4832-b583-85f406a0d347'), 'slug': 'research', 'phase_index': 0, 'status': 'completed'}
  BEFORE phase : {'id': UUID('0e0cf57c-b2ba-4b49-8b05-1448a2531aad'), 'slug': 'summarize', 'phase_index': 1, 'status': 'active'}
  BEFORE anchors: [{'id': UUID('e52a19f7-52cc-45ba-bedf-03247a8c4133'), 'active_workflow_run_id': UUID('4b0feda7-c524-4a18-8ea0-4c6fc9705868')}]
  >>> await cancel_workflow_run_internals(pool=pool, workflow_run_id='4b0feda7-c524-4a18-8ea0-4c6fc9705868')
  AFTER  run   : {'id': UUID('4b0feda7-c524-4a18-8ea0-4c6fc9705868'), 'status': 'cancelled', 'updated_at': datetime.datetime(2026, 8, 16, 5, 59, 33, 777865, tzinfo=datetime.timezone.utc), 'is_golden_run': True}
  AFTER  phase : {'id': UUID('d751095b-36c9-4832-b583-85f406a0d347'), 'slug': 'research', 'phase_index': 0, 'status': 'completed'}
  AFTER  phase : {'id': UUID('0e0cf57c-b2ba-4b49-8b05-1448a2531aad'), 'slug': 'summarize', 'phase_index': 1, 'status': 'cancelled'}
  AFTER  anchors: []
  VERIFIED by re-read: run=cancelled, anchors_remaining=0
==============================================================================
WARNING/ERROR log records captured during the heal: 0
```

**Three properties fell out of this that are worth more than the heal itself, because they are the
phase's own invariants observed on REAL data for the first time rather than against a mock:**

1. ⚠ **`AND status = 'active'` held, in both directions, on rows nobody constructed.** A2's
   `research` phase was **`completed` and stayed `completed`**; A1's two phases were **`pending` and
   stayed `pending`**. That clause is the only thing standing between `cancel_active_phases` and a
   bulk terminalize (D-07), and `194-09`'s F-5 drove it RED against a widened-predicate plant — here
   it is watched holding against live rows whose outputs are already durable.
2. ⚠ **`finish_run`'s status write and its anchor clear landed in ONE transaction, and the receipt
   proves it rather than quoting the docstring:** the thread row's `updated_at` is **byte-identical**
   to its run row's — `4bf89cbc` and `fde3bbe3` both `05:59:33.756251+00`; `e52a19f7` and `4b0feda7`
   both `05:59:33.777865+00`. Two separate transactions could not produce identical microseconds.
3. ⚠ **C1 was written as a CONSEQUENCE, with no instrument of its own** — `0e0cf57c` moved inside
   A2's composition, `05:59:33.782910+00`, five microseconds after A2's run write. **That is SC#3
   working on live data, and it is the fifth row the plan's four-row criterion did not anticipate.**

### Group B — the drive, and ⚠ THE PLAN'S STATED REASON FOR IT IS CORRECTED BY MEASUREMENT

**The instrument:** two `UPDATE` statements, two ids, each asserted to report `rowcount = 1` inside
a single transaction that would have **rolled back** on any other count. ⛔ **No
`WHERE status='active'` sweep** — a predicate write could catch a genuinely live phase, and there is
no reason to take that risk for two known rows (`T-194-13-01`).

```
==============================================================================
B1  961c290d-8ec7-46c2-b6d9-58923f8612cc
------------------------------------------------------------------------------
  BEFORE: ('961c290d-…', '5aa42b6b-…', 'confirm', 1, 'active', 2026-07-18 20:43:42.944508+00:00)
  >>> UPDATE workflow_phases SET status='cancelled', updated_at=now() WHERE id = '961c290d-8ec7-46c2-b6d9-58923f8612cc'
  rowcount = 1
  AFTER : ('961c290d-…', '5aa42b6b-…', 'confirm', 1, 'cancelled', 2026-08-16 06:00:19.130432+00:00)
==============================================================================
B2  9e6acf54-8c10-46d8-8351-5d31dc3946af
------------------------------------------------------------------------------
  BEFORE: ('9e6acf54-…', 'e0d1f740-…', 'confirm', 1, 'active', 2026-07-18 20:43:42.944508+00:00)
  >>> UPDATE workflow_phases SET status='cancelled', updated_at=now() WHERE id = '9e6acf54-8c10-46d8-8351-5d31dc3946af'
  rowcount = 1
  AFTER : ('9e6acf54-…', 'e0d1f740-…', 'confirm', 1, 'cancelled', 2026-08-16 06:00:19.130432+00:00)
==============================================================================
COMMITTED — 2 statements, 2 ids, rowcount 1 each.
```

**⚠ THE REASON THE PATH CANNOT REACH THESE TWO ROWS IS NOT THE ONE THE PLAN GIVES, AND BOTH ARE
RECORDED — THE LOSER BESIDE THE WINNER.** `194-13-PLAN.md` states, twice and in its acceptance
criteria, that *"their parent runs are already terminally `failed`, so `DELETE /runs/{id}` takes
**Step 2 `terminal_noop`** — no writes at all"*. Driven read-only against both parent-run ids, that
mechanism **is not what stops the request**:

```
Step 1  SELECT run_id, status FROM runs WHERE run_id IN (5aa42b6b-…, e0d1f740-…)  ->  []
        (no producer row at either id, so Step 1 misses and the 194-11 fallback engages)
(a)     workflow_runs: 5aa42b6b-… owner d8a54002-… status failed   -> clause (a) PASSES
        workflow_runs: e0d1f740-… owner d8a54002-… status failed   -> clause (a) PASSES
(b)     threads b3f8fda5-… owner d8a54002-…                        -> clause (b) PASSES
        threads cef20cdf-… owner d8a54002-…                        -> clause (b) PASSES
(c)     b3f8fda5-….active_workflow_run_id IS NULL                  -> clause (c) FAILS
        cef20cdf-….active_workflow_run_id IS NULL                  -> clause (c) FAILS
```

⇒ **The request falls out of the fallback and returns `404`. It never reaches Step 2, so it never
reaches `terminal_noop`.** The plan's conclusion — *a one-off write is the only instrument* — is
**correct**; its stated mechanism is not, and correcting it matters because the next reader would
otherwise look for a `terminal_noop` that never executes.

**And there is a THIRD reason, stronger than either, which the plan does not name: the path MUST
NOT be used here even if it could reach them.** `cancel_workflow_run_internals` calls
`finish_run(pool, wf_id, "cancelled")` **unconditionally on the run row**. Driven against
`5aa42b6b` or `e0d1f740` it would overwrite a **truthful `failed`** with `cancelled` — destroying
two accurate terminal records to repair two phase rows. *The run rows are not lying; only their
phase rows are.* A phase-scoped write is the only instrument that repairs the lie without
manufacturing a new one.

⚠ **Both parent threads hold NO anchor** (Q3 lists only the two Group-A threads), so **no anchor was
cleared by Group B and none needed to be.** Neither parent run is `is_golden_run`.

---

## AFTER

Re-run at **2026-08-16**, same DSN, same read-only session shape, **all five queries**, verbatim:

### Q1 — `workflow_runs` WHERE status IN ('active','paused','cap_paused')

```
id | thread_id | status | created_at | updated_at | is_golden_run
(0 rows)
```

### Q2 — `workflow_phases` status='active', joined to their run

```
id | workflow_run_id | slug | phase_index | status | updated_at | run_status
(0 rows)
```

### Q3 — threads holding an anchor

```
id | active_workflow_run_id
(0 rows)
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

⚠ **BYTE-IDENTICAL to BEFORE, and that is a POSITIVE result rather than a null one.** The
no-live-producer arm deliberately does **not** call `finalize_run_terminal`, so no `runs` row should
have moved — and none did. `streaming` is still absent from the histogram entirely. Had a `runs`
count changed, it would have meant the shared `_cancel_run_internals` writer ran, which on these
rows would have been the wrong arm.

### Q5a — `workflow_runs` histogram

```
status | count
cancelled | 2
completed | 179
failed | 31
(3 rows)
```

### Q5b — `workflow_phases` histogram

```
status | count
cancelled | 3
completed | 423
failed | 41
pending | 23
recorded_not_sent | 5
skipped | 1
(6 rows)
total: 496
```

---

## Per-row BEFORE → AFTER

| # | table | id | BEFORE | AFTER | instrument |
|---|---|---|---|---|---|
| A1 | `workflow_runs` | `fde3bbe3-02c2-4664-902f-921411bb1fe7` | `active` | **`cancelled`** | `cancel_workflow_run_internals` (the exported composition — NOT the HTTP route) |
| A2 | `workflow_runs` | `4b0feda7-c524-4a18-8ea0-4c6fc9705868` ⚠ `is_golden_run = True` | `active` | **`cancelled`** | `cancel_workflow_run_internals` (the exported composition — NOT the HTTP route) |
| C1 | `workflow_phases` | `0e0cf57c-b2ba-4b49-8b05-1448a2531aad` | `active` | **`cancelled`** | **no instrument of its own** — `cancel_active_phases`, inside A2's composition (SC#3) |
| B1 | `workflow_phases` | `961c290d-8ec7-46c2-b6d9-58923f8612cc` | `active` | **`cancelled`** | one id-scoped `UPDATE`, `rowcount = 1` |
| B2 | `workflow_phases` | `9e6acf54-8c10-46d8-8351-5d31dc3946af` | `active` | **`cancelled`** | one id-scoped `UPDATE`, `rowcount = 1` |
| — | `threads` | `4bf89cbc-5630-4fb3-982e-5fd179450003` | anchor → `fde3bbe3-…` | **`NULL`** | `finish_run`'s own transaction, inside A1's composition |
| — | `threads` | `e52a19f7-52cc-45ba-bedf-03247a8c4133` | anchor → `4b0feda7-…` | **`NULL`** | `finish_run`'s own transaction, inside A2's composition |

**Untouched, and named so their survival is a measurement rather than an assumption:**
`5dc9355f` (`retrieve`, `pending`) · `02d8e0a8` (`emit`, `pending`) · `d751095b` (`research`,
**`completed`**).

---

## No row outside the five moved — PROVED BY ENUMERATION, not by arithmetic

The plan asks the histograms to prove it. Histograms can only prove a **net**, so the rows
themselves were enumerated by `updated_at`, which catches a row that moved **without** changing
status:

```
--- every workflow_runs row touched in the last 30 min ---
  fde3bbe3-02c2-4664-902f-921411bb1fe7 | cancelled | 2026-08-16 05:59:33.756251+00:00
  4b0feda7-c524-4a18-8ea0-4c6fc9705868 | cancelled | 2026-08-16 05:59:33.777865+00:00
  count = 2
--- every workflow_phases row touched in the last 30 min ---
  0e0cf57c-b2ba-4b49-8b05-1448a2531aad | 4b0feda7-… | summarize | cancelled | 2026-08-16 05:59:33.782910+00:00
  9e6acf54-8c10-46d8-8351-5d31dc3946af | e0d1f740-… | confirm   | cancelled | 2026-08-16 06:00:19.130432+00:00
  961c290d-8ec7-46c2-b6d9-58923f8612cc | 5aa42b6b-… | confirm   | cancelled | 2026-08-16 06:00:19.130432+00:00
  count = 3
--- every threads row touched in the last 30 min ---
  4bf89cbc-5630-4fb3-982e-5fd179450003 | None | 2026-08-16 05:59:33.756251+00:00
  e52a19f7-52cc-45ba-bedf-03247a8c4133 | None | 2026-08-16 05:59:33.777865+00:00
  count = 2
--- runs rows touched ---
  runs completed_at in window = 0
```

**Every id in that enumeration is one of the seven in the table above, and there are no others.**

### Prediction vs. outcome — compared, not fitted

| quantity | predicted BEFORE the write | measured AFTER | verdict |
|---|---|---|---|
| `workflow_runs` `active` | 0 | **0** | ✅ |
| `workflow_runs` `cancelled` | 2 | **2** | ✅ |
| `workflow_phases` `active` | 0 | **0** | ✅ |
| `workflow_phases` `cancelled` | 3 | **3** | ✅ |
| `workflow_phases` total | 496 | **496** | ✅ no row created or destroyed |
| threads holding an anchor | 0 | **0** | ✅ |
| rows moved | **5** (not the plan's 4) | **5** | ✅ the corrected figure held |
| `runs` histogram | unmoved | **unmoved** | ✅ |

**Zero divergence.** Had there been any, it would be recorded here rather than the data being made
to match — that instruction was explicit and there was, in the event, nothing to invoke it for.

---

## Caveats

### ⚠ A2 is a GOLDEN RUN, and this receipt is the only thing that distinguishes it as HEALED

`4b0feda7` carries `is_golden_run = True` — a publish-validation artifact, not a user run. Its
thread is *"[validation] publish golden run — Project Meridian Risk Summary (GOOD)"*. Since Phase
190's A4 gate, `find_resumable_runs` excludes `is_golden_run = true` outright, so **nothing will ever
pick it up again**; cancelling it is honest rather than merely convenient.

**⛔ NO DISTINGUISHING MARKER WAS WRITTEN, AND THE REASON IS MEASURED, NOT PREFERRED.** The plan
allows an `error`/audit note and forbids a new status literal. Measured at this commit,
**`workflow_runs` HAS NO `error` COLUMN** — its columns are `id, thread_id, definition_id, status,
current_phase_id, org_id, created_at, updated_at, claimed_at, inputs, model, continues_used,
user_id, is_golden_run`. So the note the plan contemplates has nowhere to live without a schema
change, and a second migration for a one-off is exactly what D-17 forbids. ⛔ **No new status
literal was invented; the row reads the shipped `cancelled`, the same value A1 reads.**

⇒ **A future reader distinguishes this row by `is_golden_run = True` plus THIS COMMITTED RECEIPT.**
That is the whole reason the receipt is committed rather than pasted into a session. Stated on one
line so it survives a `grep`: **workflow run 4b0feda7-c524-4a18-8ea0-4c6fc9705868 was healed by Phase 194 plan 13, not stopped by a user.**

⚠ **It was CANCELLED, never RE-ANCHORED** (`T-194-13-02`, an explicit non-goal). Its thread's
`active_workflow_run_id` is now `NULL` and nothing here writes it back. No arm of this heal can
return the row to a resumable state, and Phase 190's A4 gate would exclude it even if one did.

### ⚠ `BUG-260815-07`'s delete-blocker justification was MEASURED FALSE and is NOT why this shipped

The bug report's stated justification — that these rows are a **permanent delete blocker** — is
false, and it is named here so nobody re-quotes it. `delete_workflow_cascade` already cancel-firsts
**and** calls `finish_run(wf_id, "cancelled")` unconditionally for every in-flight row, and both
definitions are `is_system_global = False` (measured above: `pm-weekly-status-report` and
`meridian-risk-summary-good-07aedc33`), so the 409 guard could not fire either.

**The honest reasons this heal shipped, which are the ones to record:**

1. **Two rows lied about being live.** `fde3bbe3` read `active` for **63 days**; `4b0feda7` for
   **15**. Anything reading run status without joining the anchor rendered them as running.
2. **Two threads still held anchors** to those lies, keeping the composer harness-locked against
   runs that could never finish.
3. **Two phase rows presented partial writes as still running** — `961c290d` and `9e6acf54`, both
   `confirm`, both `active` under runs that had already `failed`. That is **SC#3's exact failure
   mode sitting in the live data** while this phase shipped the fix that prevents new ones.
4. **One of them is an abandoned golden run that nothing will ever pick up**, re-driven 77 times
   (see the correction below) and then permanently excluded by Phase 190's A4 gate.

⛔ **`BUG-260815-07`'s non-reproducible delete-failure half is NOT closed by this receipt** and no
claim is made about it.

### ⚠ A RESEARCH figure corrected on measurement, recorded beside rather than over it

`194-RESEARCH.md` § *The two stuck rows* states that A2's thread *"carries **five** `runs` rows, all
`failed` with `error='resume re-drive failed'`"*. Measured at this commit, thread `e52a19f7` carries
**79** `runs` rows — **77 `failed` and 2 `completed`** — and the failure text comes in **two**
distinct spellings, not one: `resume re-drive failed` and
`failed: orphaned — stream stale, reconciled by staleness sweep`. RESEARCH's narrative (the boot
sweep re-drove it and failed, repeatedly, until A4 landed) is **correct and is in fact understated by
more than an order of magnitude**. Re-derive with:
`SELECT thread_id, status, count(*) FROM runs WHERE thread_id = 'e52a19f7-52cc-45ba-bedf-03247a8c4133' GROUP BY 1,2;`

### Scope

⛔ Local dev only. ⛔ No cloud write. ⛔ No migration applied, authored or edited; `ls
supabase/migrations/*.sql | wc -l` is unchanged at **113**. ⛔ `supabase/full-schema.sql` untouched.
⛔ No schema change of any kind — every write in this receipt is a row `UPDATE` inside the
seven-literal vocabulary migration 119 already applied (`194-MIGRATION-RECEIPT.md`). ⛔ No
`.planning/STATE.md`, `ROADMAP.md` or `REQUIREMENTS.md` edit.

**Information disclosure (`T-194-13-05`):** this receipt carries row ids, thread ids, a user id,
statuses, timestamps, workflow slugs/names and phase slugs. **No prompt, no phase `output`, no
provider payload, no auth header and no token appears anywhere in it.**

---

## Ledger

Every hot-file triple Phase 194 owes, **re-derived at this plan's own commit** rather than inherited
from the plan that measured it, so the phase's final figures are auditable in one place.

**The two commands, run for every file** (a third, `git show <base>:<file> | wc -l`, gives the
phase-base line count; Phase 194's base is `743965a1`):

```
git log --oneline -- <file> | wc -l
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u
wc -l <file>
```

| File | commits | raw buckets | **phases** | non-phase buckets, NAMED | L at `743965a1` | **L now** | 194 diff | G-5 | ledger row |
|---|---|---|---|---|---|---|---|---|---|
| `backend/app/db/workflows.py` | 34 | 18 | **18** | none | 1447 | **1582** | +136 / −1 | **FIRES** | ✅ cell RE-DERIVED (was `32 / 17 / 1447`) |
| `frontend/src/components/panel/WorkspacePanel.tsx` | 14 | 9 | **9** | none | 493 | **580** | +88 / −1 | **FIRES** | ✅ **ROW ADDED** |
| `backend/app/services/run_lifecycle.py` | 4 | 3 | **3** | none | 299 | **437** | +138 / −0 | **FIRES** (at the threshold) | ✅ **ROW ADDED** |
| `backend/app/api/runs.py` | 33 | 16 | **16** | none | 1208 | **1376** | +168 / −0 | **FIRES HARD** | ✅ **ROW ADDED** |
| `backend/app/services/harness_engine.py` | 45 | **17** | **16** | ⚠ `quick` — from `fix(quick-260731-3y4)` | 2494 | **2536** | +42 / −0 | **FIRES HARD** | ✅ **ROW ADDED** |
| `frontend/src/components/chat/RunCard.tsx` | 20 | **9** | **8** | ⚠ `streaming` — an untagged 075.x fix/revert pair | 550 | **550** | **none** | fires (8) | ⛔ **NO ROW — see below** |

### ⚠ `RunCard.tsx` gets NO row here, and the reason is a measurement rather than an oversight

`194-13-PLAN.md` Task 3(a) names it as one of *"the three ledger cells this phase touched"*.
**Measured, Phase 194 has not touched it:** `git log --oneline 743965a1..HEAD --
frontend/src/components/chat/RunCard.tsx` is **EMPTY**, and its line count is unmoved at 550. This
plan's own non-goals say ⛔ *"Do not add a ledger row for a file this phase did not touch"*, so no
row was written. **Its triple is recorded here instead of being lost: `20 commits / 8 phases /
550 L`.**

**Who owes it, named rather than left open:** plan **`194-07`** is the one whose `files_modified`
includes `RunCard.tsx`, and plan **`194-05`** is the one whose `files_modified` includes `CLAUDE.md`
with the explicit must-have *"RunCard.tsx and WorkspacePanel.tsx are ROWS in the CLAUDE.md hot-file
ledger"*. **Both were still pending when this receipt was written.**

### ⚠ THESE FIGURES WILL GO STALE, AND THE COMMIT THAT STALES THEM IS ALREADY KNOWN TO BE COMING

Plans **`194-05`** and **`194-07`** have not run — both are blocked on an operator measurement that
has not arrived. `194-05` touches `CLAUDE.md` and `streamsStore.ts`; `194-07` touches
`RunCard.tsx`, `MessageItem.tsx`, `toolMeta.ts` and two test files. **When either lands, the
`RunCard.tsx` triple above and the `WorkspacePanel.tsx` ledger row's neighbourhood both move.**

This is the exact self-staling the ledger documents about itself — the `WorkflowsPage.tsx` cell has
gone stale **four consecutive times and once within a single day**, and *a figure written at a
plan's close goes stale on the next commit that touches any file it counted*. The difference here is
only that the next commit is **already identified by plan number**, so it is stated rather than left
to be discovered. ⚠ **Whoever lands `194-05` must UPDATE the `WorkspacePanel.tsx` row, never add a
second one for the same file** — that instruction is written into the row itself, not only here.

### The G-5 override — VERIFIED, not assumed

`194-CONTEXT.md` **D-01** records that a G-5 override was **OFFERED AND DECLINED**, the fourth
consecutive phase to decline one (193, 193.1, 193.2, 194) — and states that *if* `.planning/STATE.md`
records none for Phase 194, that absence is a measurement.

**It was checked before the sentence was written.** `.planning/STATE.md` carries five
guardrail-override records; the only one under a `## Guardrail overrides` heading of its own is the
**v3.6 close** (`:1713`, *"None recorded"*), and the three phase-level entries are `193` (`:858`),
`193.1` (`:670`) and `193.2` (`:386`/`:519`) — **each recording NONE.** There is **no Phase-194
override record of any kind**, and STATE.md's own Phase-194 entry says so in its own words:
*"this file records NO guardrail override for Phase 194, and that absence is a measurement."*
⇒ The sentence is written in all five ledger cells, and it is true.

### One inherited correction, recorded beside its original

`194-CONTEXT.md` **D-01** states that `RunCard.tsx` and `WorkspacePanel.tsx` *"occur only inside
other rows' prose"*. **Measured — first by `194-01-BASELINE.md` and re-confirmed here — that is
FALSE: `grep -o` returned 0 for BOTH before this plan ran. Neither filename appeared in `CLAUDE.md`
at all.** *"Present but only in prose"* and *"absent entirely"* are different diagnoses with
different fixes, and the wrong one sends the next reader looking for a mention that was never there.
⚠ The prose-only state D-01 described **is** real for a different file, which is why the distinction
is worth keeping: `harness_engine.py` occurs **exactly once** in `CLAUDE.md`, inside the
`publish_service.py` row's prose — and a row-scanning audit cannot see it there either.
