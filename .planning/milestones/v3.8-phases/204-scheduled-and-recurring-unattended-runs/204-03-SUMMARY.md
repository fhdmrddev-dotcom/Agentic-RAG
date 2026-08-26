---
phase: 204-scheduled-and-recurring-unattended-runs
plan: 03
subsystem: backend/scheduler + frontend/workflows
tags: [SCHED-01, scheduler, cron, interval, rls, postgres, skip-locked, unattended, deploy-parity]
requires:
  - "croniter (declared in backend/requirements.txt at cd6af1c5)"
  - "harness_engine._build_resume_context + run_workflow (shipped)"
  - "db.workflows.create_workflow_run + get_definition (shipped)"
  - "run_lifecycle cancel brake (204-01) — inherited, not re-implemented"
provides:
  - "workflow_schedules table + owner-scoped RLS (migration 124, AUTHORED — apply is OWED)"
  - "models/schedule.py — the ONE cadence validator + the ONE next-run resolver"
  - "db/schedules.py — CRUD + claim_due_schedules (FOR UPDATE SKIP LOCKED)"
  - "services/scheduler_service.py — poll loop + unattended launcher"
  - "api/schedules.py — 6 owner-scoped routes across 2 routers"
  - "frontend: types/schedule.ts, WorkflowScheduleModal.tsx, 6 api.ts client functions"
affects:
  - "backend/app/main.py lifespan (start + stop) and router registry"
  - "backend/app/config.py (3 additive settings)"
  - "the D-16 deploy artifacts (4 files, same commit)"
tech-stack:
  added: []
  patterns:
    - "claim-by-transaction: FOR UPDATE SKIP LOCKED + the next_run_at advance INSIDE the claiming tx"
    - "no leader election — exactly-once is a database property, not a process property"
    - "reuse _build_resume_context rather than composing a sixth ctx bag"
key-files:
  created:
    - supabase/migrations/124_workflow_schedules.sql
    - backend/app/models/schedule.py
    - backend/app/db/schedules.py
    - backend/app/services/scheduler_service.py
    - backend/app/api/schedules.py
    - backend/tests/unit/test_workflow_scheduler.py
    - frontend/src/types/schedule.ts
    - frontend/src/components/workflows/WorkflowScheduleModal.tsx
  modified:
    - backend/app/main.py
    - backend/app/config.py
    - frontend/src/lib/api.ts
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/components/workflows/library/WorkflowCard.tsx
    - backend/.env.example
    - deploy/onebox.env.example
    - docker-compose.prod.yml
    - docs/OPERATOR.md
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - 11 frontend test suites (mock-factory budget)
decisions:
  - "D-204-03-A: exactly-once is the CLAIMING TRANSACTION, not a leader — every worker polls"
  - "D-204-03-B: only a PUBLISHED workflow can be scheduled (a draft is mutable; nobody is watching)"
  - "D-204-03-C: the manual trigger does NOT advance next_run_at"
  - "D-204-03-D: RLS is 108 Shape A (membership AND owner) with NO org-wide read branch"
  - "D-204-03-E: the spend caps ride on the run's durable inputs under a _schedule_ namespace"
  - "D-204-03-F: api.ts G-5 seam RE-DECLINED with a trigger that cannot be re-declined"
metrics:
  duration: ~3h
  tasks: 6
  completed: 2026-08-24
---

# Phase 204 Plan 03: Workflow Scheduler (SCHED-01) Summary

Published workflows can now run on a cron or interval **with nobody watching** — migration 124's
`workflow_schedules` table, a claim-by-transaction poller that is safe at any `WORKER_COUNT`
with no leader election, six owner-scoped REST routes, and a dialog that makes the author choose
the spend caps before the first unattended run exists.

## What shipped

| Commit | What |
|---|---|
| `4742ac00` | migration 124 — the table, 4 RLS policies (108 Shape A), 3 indexes, 2 reused triggers |
| `97d934b7` | `models/schedule.py` (the ONE cadence validator + `compute_next_run_at`) and `db/schedules.py` |
| `90431308` | `scheduler_service.py`, `config.py` settings, `main.py` lifespan, and the four D-16 deploy artifacts |
| `657b66e2` | `api/schedules.py` — 6 routes across 2 routers, registered in `main.py` |
| `f84b4a7a` | `test_workflow_scheduler.py` — 35 cases |
| `fa80b5a7` | `types/schedule.ts`, `WorkflowScheduleModal.tsx`, 6 `api.ts` exports, the card door, 11 mock factories |
| `3378353f` | `docs/HOT-FILE-LEDGER.md` + `CLAUDE.md` — the api.ts re-decline and five re-derived rows |

## The mechanism, and the one sentence that matters

`claim_due_schedules` is the whole duplicate-firing mitigation, and **the load-bearing half is
not the `SKIP LOCKED` keywords**. The sequence, all inside one transaction:

1. `SELECT … FOR UPDATE SKIP LOCKED` — a second worker skips locked rows instead of waiting.
2. `next_run_at` is **advanced before that transaction commits**.
3. On commit, the rows the second worker next sees already have a future `next_run_at` and no
   longer satisfy the predicate.

`SKIP LOCKED` alone only prevents a *simultaneous* double claim; what prevents a claim a
millisecond later is step 2. Both halves are separately falsified (CF-1, CF-2 below).

That is why there is **no leader election, no advisory lock of our own, and no Redis
coordination** — the loop runs in every uvicorn worker. A leader scheme's failure mode is that
the leader dies and *nothing fires, silently*, which is the worst possible failure for
automation nobody is watching.

## The three pre-flight gaps

### G-1 · Migration 124 — ⚠ AUTHORED, **APPLY AND SCHEMA REGENERATION ARE OWED**

CLAUDE.md is in force: a migration is applied by **pasting it into the Supabase SQL editor**,
never `supabase db push` / `db reset`. An agent cannot open a browser, so **the apply was not
performed and is not faked.**

**What WAS done instead — a non-destructive DRY RUN against the live local DB** (`:54322`): the
whole file was executed inside a transaction that was then **rolled back**, and the resulting
catalog was read back before the rollback:

```
DRY RUN OK  cols=17  rls=True  policies=4  indexes=4  both-cadence-insert=CheckViolation
ROLLED BACK — nothing was applied.
```

So the DDL parses, every referenced object (`organizations`, `workflow_definitions`,
`auth.users`, `current_user_org_ids()`, `autofill_org_id_by_owner`, `set_updated_at`) exists,
and the `schedule_cadence_exactly_one` CHECK really refuses a both-cadences row.

**OWED, in this order:**

1. Paste `supabase/migrations/124_workflow_schedules.sql` into the **local** Supabase SQL editor
   and run it. The whole file is one `BEGIN…COMMIT` and is re-paste-safe.
2. Then run `bash scripts/regenerate-full-schema.sh` (**no `--reset`**) and commit the
   regenerated `supabase/full-schema.sql`. ⚠ **Until this runs, `full-schema.sql` lacks
   `workflow_schedules` and every greenfield deploy silently comes up without the table.** Never
   hand-edit that file.
3. 124 joins the pending cloud set for the next operator-gated production push.

**Until step 1 runs, `SCHEDULER_PROCESS_ENABLED` must stay `false`** — it is `false` by default,
so nothing breaks; the poller would simply raise `UndefinedTableError` every tick and log it.

### G-2 · Deploy-artifact parity — closed, and the checker's verdict verbatim

`SCHEDULER_PROCESS_ENABLED`, `SCHEDULER_POLL_INTERVAL_SECONDS` and
`SCHEDULER_MAX_CLAIMS_PER_TICK` landed in `backend/.env.example`, `deploy/onebox.env.example`,
`docker-compose.prod.yml` and `docs/OPERATOR.md` **in the same commit** (`90431308`). Nothing was
added to `OMITTED_FROM_ONEBOX` — all three are knobs the one-box should ship.

⚠ **No new compose SERVICE was added, and that is a decision.** The scheduler is a lifespan task
inside the existing backend, so it scales with `WORKER_COUNT` and needs no process of its own —
precisely because the claim is a database transaction rather than an in-process lock.

```
[1/4] preset keys   ok  no unclassified preset-key drift (allowlist covers 44 keys)
[2/4] seed list     ok  all 9 runbook seed migrations exist (highest listed: 089)
                    WARN migration(s) above #089 carry seed-like INSERT/UPDATE — review whether
                         the OPERATOR.md Step-3 list needs them: 093 094 098 104 105 106 107 111
                         113 118 122 123
[3/4] sandbox tag   ok  sandbox tag consistent everywhere: agentic-rag-sandbox:101.1
[4/4] compose parse WARN docker compose unavailable/denied here — CI runs the authoritative parse
                    ok  structural check: backend mounts setup_data:/data AND volumes declares it
RESULT: PASS — the one-box deploy artifacts are in sync.
```

⚠ **The seed-list WARN is PRE-EXISTING, and that was measured rather than assumed.**
`git show 9af9706e:docs/OPERATOR.md | grep -oE '[0-9]{3}_[a-z0-9_]+\.sql'` returns exactly the
same nine filenames, so the highest listed seed was already `089` at the base commit. Logged to
`deferred-items.md`; not fixed here (scope boundary).

⚠ **A MEASURED SURPRISE WORTH KEEPING.** Check 2 greps the **whole** `docs/OPERATOR.md`, not just
the Step-3 table. A first draft of the runbook note named the new migration by FILENAME, and the
checker immediately reported *"all **10** runbook seed migrations exist (highest listed: **124**)"*
— counting a prose mention as a listed seed **and** raising the ceiling that suppresses its own
"this looks seed-bearing" warning. The note now names migration **124 by number only**, and says
in the document why.

⚠ **A second, unrelated staleness was found and fixed while there:** that same block read
*"Migrations currently run to 102"* — **stale by twenty-two migrations.** Corrected, with the
re-derivation command written beside it.

### G-3 · `frontend/src/lib/api.ts` — the decline is ANSWERED

**(1) It was added to the plan's scope.** The file was not in `files_modified`; fetching inline
in the modal would have broken the one-home convention every other client call follows. Declared
as Deviation 1 below.

**(2) THE 197 G-5 DECLINE IS RE-DECLINED IN WRITING.** The ledger records that the old trigger —
*"the next phase adding a RUNTIME export or a second concern here"* — **fired at 200.2 and was
never answered**, and that carrying the old *"it did not fire"* sentence forward was no longer
available. 204-03 adds **six runtime exports**, so this is the second firing.

> **RE-DECLINED.** The seam (a per-domain split under `frontend/src/lib/api/` behind a
> re-exporting barrel) is a 6,700-line restructure of the hottest file in the tree. Landing it in
> the same commit as a net-new feature destroys the one property a bisect needs, and the barrel
> requirement means it cannot be landed incrementally either. **It is a phase.**
>
> **FRESH TRIGGER (deliberately stronger — the old one was paid off twice): the NEXT phase that
> adds a runtime export to `frontend/src/lib/api.ts` TAKES the split, or escalates it to the
> operator as a phase of its own. It may NOT re-decline.**

Written in `docs/HOT-FILE-LEDGER.md` and in the `CLAUDE.md` row, in the same commit
(`3378353f`), and in the source itself as a header comment above the six functions.

**(3) The mock budget was spent IN ADVANCE — the first time that has happened here.** ⚠ And a
**factory-SHAPE census turned out to be part of the budget, not just a file count**: of the twelve
suites named in the brief, **nine** matched `vi.mock("@/lib/api", () => ({`, **two** used the
`() => { … return { … } }` form, and **one — `src/pages/SettingsPage.test.tsx` — needed nothing at
all**, because it spreads `await vi.importActual("@/lib/api")` and therefore carries every real
export by construction. Eleven files were widened. The count gate reads `failed 0`.

## Deviations from Plan

### 1. [Rule 3 — Blocking] `frontend/src/lib/api.ts` added to scope

**Found during:** Task 5. **Issue:** the modal must call six new endpoints and the file is not in
`files_modified`. **Fix:** added, with the G-3 re-decline above. **Commit:** `fa80b5a7`.

### 2. [Rule 3 — Blocking] `backend/app/config.py` added to scope

**Found during:** Task 3. Three settings were needed and this project's convention is
pydantic `Settings`, not `os.environ`. The alternative would have added a **fourth** configuration
mechanism *and* hidden the new var from `check-deploy-drift.sh`'s `backend/.env.example` census —
i.e. it would have defeated G-2. Purely additive; no red line of that file touched. **Commit:**
`90431308`.

### 3. [Rule 3 — Blocking] `WorkflowCard.tsx` added to scope

**Found during:** Task 5. The plan requires the card to offer a schedule action and the page to
open the modal, but the card owns the row's DOM. One optional prop + one `DropdownMenuItem`. ⚠
**This makes the ⋯-menu seam NAMED FOR THE THIRD TIME** (192.2 named it, SEED-190 edited it
without taking it, 204 has now done the same). Recorded in the ledger as **overdue**.

### 4. [Deferred, with a trigger] The card's "active schedule" badge is NOT built

The plan's task 5 asks for a *"schedule trigger action **and active schedule indicator badge**"*.
The action shipped; **the badge did not, and the reason is structural rather than a choice.** A
badge needs a per-row schedule count on the library feed, which is a projection widening in
`backend/app/db/workflows.py` — a file **owned by the sibling `204-02` agent this wave** and
explicitly out of bounds. Widening it would also owe the three-place lockstep (`.select()` +
Pydantic model + serializer) on a file this plan may not touch.

**Re-open trigger: the next phase that touches `backend/app/db/workflows.py`'s library feeds.**
Until then the modal is the honest place to see whether a workflow is scheduled, and the door to
it is one click away on every published row.

### 5. [Rule 1 — Bug, in this plan's own test] The 187-24 trap fired on my first fence

`test_b_the_insert_binds_inputs_as_an_object` first asserted `"json.dumps" not in src` over
`db/schedules.py`. It went **RED against correct code**, because that module's docblock *explains
the string-scalar trap by name*. Replaced with an **AST walk** (no `json` import, no `.dumps`
call node). The trap is now recorded in the case's own comment.

### 6. [Out of scope — NOT touched] `LibraryToolbar.tsx` is modified in the working tree

`frontend/src/components/workflows/library/LibraryToolbar.tsx` carries an uncommitted
`+68 / −158` UI rewrite that **this plan did not make** (another session is active on this
working tree — four `docs(connections)` / `docs(206)` commits landed on `develop` mid-execution).
It was **left exactly as found**: not staged, not committed, not reverted.

## Threat-model coverage — the standing criterion

All three mitigations have real tests, and each was **falsified by a plant against the committed
tree**.

| Threat | How it is driven | Counterfactual |
|---|---|---|
| **Multi-instance duplicate firings** | 12 due schedules, **two real asyncpg connections** racing the real `claim_due_schedules` under `asyncio.gather` against **real Postgres**. Assertions are the CLAIM SETS: disjoint, union exactly 12. Plus the load-bearing half — a second claim after commit returns `[]`, and each row's stored `next_run_at` is in the future | CF-1, CF-2 |
| **Unauthorized / cross-tenant access** | All **five** owner-scoped entry points (`get_schedule`, `update_schedule`, `delete_schedule`, `list_schedules_by_org`, `list_schedules_by_workflow`) issued as the WRONG user against a row that really exists; the row is then re-read and is **unchanged**. Non-vacuity: the rightful owner reaches all five | CF-3 |
| **Invalid cron parsed and persisted** | 7 invalid bodies over **real HTTP** through the real routers, with a pool that **raises on contact** — so "the database was never touched" is the only way the case can pass | CF-4 |

### Counterfactuals driven (all against the committed tree — 204-01's lesson honoured)

| | Plant | Red |
|---|---|---|
| CF-1 | the row lock removed entirely from the claim SELECT | `..._two_concurrent_claimers_never_claim_the_same_schedule` |
| CF-2 | the in-transaction `next_run_at` advance removed | `..._a_claimed_schedule_is_no_longer_due_because_next_run_at_advanced` |
| CF-3 | `get_schedule` loses `AND user_id = $2` | `..._a_foreign_schedule_is_invisible_to_every_owner_scoped_read_and_write` |
| CF-4 | the cron field validator returns its input unchecked | `..._an_invalid_schedule_is_422...[bad-cron]` + `[four-fields]` |

### ⚠ What the tests do NOT prove — stated rather than left to be assumed

- **The RLS policies are not exercised.** §C runs against a **throwaway schema** (migration 124
  is unapplied), and that copy carries no policies. It is also moot on the live path: the app's
  asyncpg pool is `BYPASSRLS`, so the policies never evaluate today. **The gate that actually
  protects a user is the owner predicate in `db/schedules.py`, and that is what CF-3 falsifies.**
  The policies are the belt for the future user-JWT client; their SHAPE is asserted against
  migration 124's own statements (4 policies, each carrying both the membership macro and the
  owner branch, no global escape branch in any policy body).
- **The throwaway table has a stand-in org autofill trigger,** not the real
  `autofill_org_id_by_owner('user_id')` — the §C users are synthetic and seeding `org_members`
  rows for them would mutate real dev data. That the real trigger is installed is asserted
  against the migration text instead.
- **No real workflow has been scheduled and fired end to end.** `launch_scheduled_run` composes
  shipped, separately-tested pieces (`create_workflow_run`, `_build_resume_context`,
  `run_workflow`), but the composition itself has no live drive. **This is the first owed UAT
  row.**
- **No two-worker live test.** The isolation property is proven (two independent connections
  sharing only Postgres), in one process.

## Gate figures — verbatim

```
backend\venv\Scripts\python -m pytest backend/tests/unit/test_workflow_scheduler.py -v
  -> 35 passed
```

```
backend/tests/unit @ HEAD        -> 67 failed, 2532 passed, 2 xfailed, 2 xpassed
backend/tests/unit @ base sources-> 67 failed   (main.py + config.py restored from 9af9706e,
                                    the new test file excluded)
NEW FAILURES vs base 9af9706e: ZERO — the two FAILED lists are identical test-for-test; the one
textual difference is a pytest `unraisableexception` RuntimeWarning glued onto a different line
per run (the same artifact 204-01 recorded).
```

```
frontend$ npx tsc --noEmit -p tsconfig.app.json
  -> 34 errors, ALL pre-existing and ALL in files this plan did not touch.
     Errors in src/{types/schedule,lib/api,pages/WorkflowsPage,
     components/workflows/WorkflowScheduleModal,
     components/workflows/library/WorkflowCard}: NONE.
  (⚠ the bare `npx tsc --noEmit` checks ZERO files — the project-scoped form is the only one
   that measures anything. It is what found v3.7's one shipped defect.)
```

```
GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs        [from the repo root]
  total                                      5004    5438    +434
  total 5438  ·  failed 0  ·  pinned total 5004
count gate OK — 110/110 pinned files present, no per-file decrease, 0 failing.
```

⚠ **5438 is larger than every figure written in CLAUDE.md, and that is the gate WORKING** — its
contract is *no per-file DECREASE* and *zero failing*, never a fixed grand total. It went green
on the first run; none of SEED-171's five known-flaky suites reddened, so its triage procedure
was never entered and the worker cap was never touched.

```
bash scripts/check-deploy-drift.sh
  RESULT: PASS — the one-box deploy artifacts are in sync.   (2 WARNs, both pre-existing — see G-2)
```

```
node scripts/check-claude-md-size.cjs
  CLAUDE.md  116960 chars  78% of limit  headroom 33040  [OK]
```

## What the plan assumed wrongly

1. **`files_modified` was short by three files** — `frontend/src/lib/api.ts` (the pre-flight
   caught this), plus `backend/app/config.py` and `WorkflowCard.tsx` (it did not).
2. **Task 5's "active schedule indicator badge" is not buildable inside this plan's file
   boundary** — see Deviation 4. It needs a library-feed projection in a sibling-owned file.
3. **Task 3 says "advisory lock (`pg_try_advisory_xact_lock`) **or** `SELECT … FOR UPDATE SKIP
   LOCKED`" as if they were interchangeable.** They are not, for this problem. An advisory lock
   serialises *pollers*; `SKIP LOCKED` + the in-transaction advance makes *each schedule* claimed
   once regardless of how many pollers exist. Only the second lets the loop run in every worker,
   which is what removes the leader.
4. **The plan never mentions that the caps need somewhere to live.** `workflow_runs` has no
   ceiling columns and adding them is SCHED-02's business, so they ride on the run's durable
   `inputs` under a `_schedule_` namespace — a decision `204-02` must know about
   (see "Notes for 204-02" below).
5. **`croniter` is confirmed present** — `croniter.croniter('*/15 * * * *', now).get_next(datetime)`
   evaluated correctly in the venv, as the brief stated.

## Notes for `204-02` (the circuit breaker) and for whoever runs UAT

- **The per-run caps are on `workflow_runs.inputs`**, as `_schedule_max_tokens_per_run` and
  `_schedule_max_duration_seconds`. A breaker that wants a scheduled run's ceilings reads them
  from the run it is already policing — no second query, and no new column.
- **A scheduled run is an ordinary unattended run.** It inherits 204-01's cancel brake unedited,
  so a breaker that trips by calling `cancel_workflow_run_internals` (as `204-01`'s summary
  recommends) stops a scheduled run correctly with no scheduler-specific code.
- **Deleting a schedule does NOT cancel runs it already launched** — deliberately. Those are
  ordinary runs with their own Stop control.

## OWED

| # | What | Why it matters |
|---|---|---|
| 1 | **Paste migration 124 into the local Supabase SQL editor** | nothing works until the table exists; keep `SCHEDULER_PROCESS_ENABLED=false` until then |
| 2 | **`bash scripts/regenerate-full-schema.sh`** (no `--reset`) after #1 | otherwise every greenfield deploy silently comes up **without** `workflow_schedules` |
| 3 | **UAT: create a schedule on a published workflow, trigger it manually, watch the run** | the launcher's composition has no live drive (see "What the tests do NOT prove") |
| 4 | **UAT: enable `SCHEDULER_PROCESS_ENABLED` at `WORKER_COUNT=2` and let a 15-minute interval fire twice** | the exactly-once property is proven in one process, not across two uvicorn workers |
| 5 | **UAT: the dialog itself** — cron preset, custom cron, timezone, interval, pause/resume, delete, and a deliberately malformed cron (the refusal must name what is wrong) | G-4: no lived-experience row has been run |
| 6 | 124 joins the pending cloud migration set for the next operator-gated production push | cloud parity |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-endpoints | `backend/app/api/schedules.py` | Six net-new authenticated routes. All owner-scoped, all 404-not-403 on a miss, all behind `require_visible("workflow_authoring")`. |
| threat_flag: schema-at-trust-boundary | `supabase/migrations/124_workflow_schedules.sql` | A new tenant-scoped table. RLS is 108 Shape A on all four policies; no global escape branch, asserted by test against the migration's own statements. |
| threat_flag: unattended-execution | `backend/app/services/scheduler_service.py` | ⚠ **The first code path in this product that starts an LLM run with no human present.** Mitigations: OFF by default; published-only; per-run token and duration caps chosen by the author; the run is stamped with the schedule's OWNER (never a service identity), so every downstream owner-scope guard still applies. |

## Self-Check: PASSED

All 8 created files present on disk; all 7 commits resolve (`4742ac00`, `97d934b7`, `90431308`,
`657b66e2`, `f84b4a7a`, `fa80b5a7`, `3378353f`); all six routes registered on the real app
(asserted by `test_b_the_poller_claim_has_no_http_door`); `scheduler_process_enabled` present in
both `main.py` and `config.py`.
