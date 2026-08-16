---
phase: 194
slug: stop-a-running-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-16
---

# Phase 194 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `194-RESEARCH.md` § *Validation Architecture*. **Baselines are re-derived at Wave 0,
> never inherited** — every figure below was measured at `05f664a0` and will have moved.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frontend framework** | vitest + Testing Library — `frontend/vitest.config.ts` |
| **Backend framework** | pytest + `pytest_asyncio` — `backend/venv/Scripts/python.exe -m pytest` |
| **Frontend quick run** | `cd frontend && npx vitest run <touched test file>` |
| **Backend quick run** | `cd backend && venv/Scripts/python.exe -m pytest tests/test_062_cancel_run.py tests/test_cancel_run.py tests/test_run_lifecycle.py -q` |
| **Frontend full gate** | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` — read the **verdict line**, never a summary |
| **Backend full suite** | `cd backend && venv/Scripts/python.exe -m pytest tests/unit -q` — compare failures **by name**, never by count |
| **Typecheck** | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` — ⚠ bare `--noEmit` checks **ZERO** files |
| **Live-DB gate template** | `backend/tests/test_migration_115.py` (rollback txn, nested savepoint, two clean skips) |
| **Estimated runtime** | quick ~15-40 s · frontend full gate ~4-6 min · backend `tests/unit` ~3-5 min |

### Baselines measured at `05f664a0` — RE-DERIVE at Wave 0

| Gate | Baseline |
|------|----------|
| count gate | `count gate OK` · total **3918** · failed **0** · pinned total 3868 · **75/75** pinned files present · exit 0 |
| `tsc -p tsconfig.app.json` | **33** errors (the documented, unmoved baseline) |
| cancel-path pytest (4 files) | **12 passed** |
| `pytest tests/unit` | known rot baseline **62 failed / ~2221 passed** (SEED-056 / SEED-165) |

⚠ **A GROWING count-gate total is the gate WORKING.** Its contract is *no per-file decrease* and
*zero failing* — never a fixed grand total. 3918 will be larger at this phase's close.

---

## Sampling Rate

- **After every task commit:** the relevant quick run **+** `npx tsc -p tsconfig.app.json --noEmit` (expect **33**)
- **After every plan wave:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` **+** `pytest backend/tests/unit -q` compared by failure **name** against the Wave 0 baseline
- **Before `/gsd:verify-work`:** both full suites green (backend: no NEW failure vs. baseline)
- **Max feedback latency:** ~40 s per task; ~6 min per wave

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. Each row below is a **required** verification — a plan that
> omits one has a coverage gap, not a smaller scope.

| # | SC | Behavior | Test Type | Automated Command | File Exists | Task ID | Status |
|---|----|----------|-----------|-------------------|-------------|---------|--------|
| V-01 | SC#1 | `DELETE /runs/{id}` accepts a `workflow_runs.id`, owner-scoped + anchor-confirmed, and resolves **forward** to the producer id | unit (be) | `pytest backend/tests/test_062_cancel_run.py -x -k dual_id` | ❌ W0 | TBD | ⬜ pending |
| V-02 | SC#1 | A cross-user `workflow_runs.id` returns **404, never 403** (no existence leak) | unit (be) | `pytest backend/tests/test_062_cancel_run.py -x -k cross_user` | ❌ W0 | TBD | ⬜ pending |
| V-03 | SC#1 | A `workflow_runs.id` that is NOT the thread's live anchor → 404 | unit (be) | same file | ❌ W0 | TBD | ⬜ pending |
| V-04 | SC#1 | The panel renders a Stop under the harness gate and calls `stopThread` with the **thread id** | unit (fe) | `npx vitest run src/components/panel/__tests__/WorkspacePanel.test.tsx` | ✅ extend | TBD | ⬜ pending |
| V-05 | SC#1 | ⚠ **No module under `components/panel/` passes `workflowLock.runId` to `cancelRun`** | fence (fe) | same file | ❌ W0 | TBD | ⬜ pending |
| V-06 | SC#1 | The composer Stop resolves a **producer** run id during a harness run | unit (fe) | `npx vitest run src/components/chat/__tests__/` | ❌ W0 | TBD | ⬜ pending |
| V-07 | SC#1 | The chat banner **advances** past `"Starting workflow…"` once a phase completes — **and still reads it before phase 1** | unit (fe) | `npx vitest run src/lib/__tests__/toolMeta.test.ts` | ✅ extend (`:31` pin unmoved) | TBD | ⬜ pending |
| V-08 | SC#1 | A harness thread appears in `useStreamingThreadIds()` so `ActiveRunsTray` lists it | unit (fe) | `npx vitest run src/components/chat/__tests__/ActiveRunsTray.test.tsx` | ✅ extend | TBD | ⬜ pending |
| V-09 | SC#2 | Step 3b co-writes `workflow_runs.status='cancelled'` via `finish_run` | unit (be) | `pytest backend/tests/test_062_cancel_run.py -x -k zombie_workflow` | ❌ W0 | TBD | ⬜ pending |
| V-10 | SC#2 | Step 3b reads the anchor **BEFORE** the shipped 092-03 clear | unit (be) | same file | ❌ W0 | TBD | ⬜ pending |
| V-11 | SC#2 | A Deep run (`active_workflow_run_id IS NULL`) takes the arm **byte-identically** | unit (be) | `pytest backend/tests/test_run_lifecycle.py -x` | ✅ extend | TBD | ⬜ pending |
| V-12 | SC#2 | ⚠ Step 3b carries **NO** `is_app_shutting_down()` gate, and F2 still **does** | fence (be) | `pytest backend/tests/test_run_lifecycle.py -x -k shutdown_gate_scope` | ❌ W0 | TBD | ⬜ pending |
| V-13 | SC#2 | A double `finish_run` is a no-op (idempotence) | unit (be) | `pytest backend/tests/test_062_cancel_run.py -x -k idempotent` | ❌ W0 | TBD | ⬜ pending |
| V-14 | SC#3 | mig 119: **all seven** literals admitted, incl. the six shipped verbatim | live-DB | `pytest backend/tests/test_migration_119.py -x` | ❌ W0 | TBD | ⬜ pending |
| V-15 | SC#3 | mig 119 **negative control**: a nonsense value refused with SQLSTATE `23514` naming `workflow_phases_status_check` | live-DB | same file | ❌ W0 | TBD | ⬜ pending |
| V-16 | SC#3 | The in-flight phase becomes `cancelled` on the **engine** cancel arm | unit (be) | `pytest backend/tests/test_harness_engine.py -x -k cancel_phase` | ❌ W0 | TBD | ⬜ pending |
| V-17 | SC#3 | The in-flight phase becomes `cancelled` on the **zombie** arm (no engine at all) | unit (be) | `pytest backend/tests/test_062_cancel_run.py -x -k zombie_phase` | ❌ W0 | TBD | ⬜ pending |
| V-18 | SC#3 | ⚠ `completed` phases are **UNTOUCHED** (D-07, inherited verbatim) | unit (be) | same file | ❌ W0 | TBD | ⬜ pending |
| V-19 | SC#3 | ⚠ A cancel **never** enters the `failed` or `skipped` vocabulary for the phase | fence (be) | same file | ❌ W0 | TBD | ⬜ pending |
| V-20 | D-17 | All **four** rows (2 `workflow_runs` + 2 orphan `workflow_phases`) terminal after the heal, with before/after captured | manual + recorded receipt | `checkpoint:human-verify` + a committed SQL receipt | ❌ W-N | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## ⚠ Every fence names the REAL PLANT it is driven RED against

> **A fence is only real once you have watched it FAIL.** This project shipped **five** inert fences
> in Phase 193.2, **four** in 193.1, **three** in 192.1 and **five** in 190 — *every one caught by
> planting, none by reading.* `194-RESEARCH.md` § *The fences, and the REAL PLANT each must be driven
> RED against* names twelve fences and their plants; **two require TWO separate plants each.**
>
> **The plant must live in production source, not in the test.** A plan that ships a fence without a
> recorded RED observation has shipped a claim.

---

## Wave 0 Requirements

- [ ] `backend/tests/test_migration_119.py` — new, modelled on `test_migration_115.py` (rollback txn, nested savepoint, two clean skips)
- [ ] Extend `backend/tests/test_062_cancel_run.py` — dual-id, cross-user, anchor, zombie-workflow, idempotence, zombie-phase, completed-untouched, no-failed-vocabulary
- [ ] Extend `backend/tests/test_run_lifecycle.py` — Deep-run byte-identity, shutdown-gate scope fence
- [ ] Extend `backend/tests/test_harness_engine.py` — engine cancel arm phase terminalize
- [ ] Extend `frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx` — Stop mount + the `workflowLock.runId` source fence
- [ ] New/extended frontend chat tests — composer producer-id resolution, banner advance, tray listing
- [ ] Re-derive **all four baselines** in the table above before any plan is scored against them

---

## Manual-Only Verifications

| Behavior | Ref | Why Manual | Test Instructions |
|----------|-----|-----------|-------------------|
| Migration 119 application | D-06 | Project rule: paste into the Supabase SQL editor — **never** `db push` / `db reset` (preserves dev data). Then `bash scripts/regenerate-full-schema.sh` (no `--reset`) | Operator applies, then `test_migration_119.py` proves the seven literals |
| The four-row data heal | D-12 / D-17 | Mutates real, irreplaceable rows. *A data repair with no receipt is indistinguishable from a claim* | `checkpoint:human-verify`; capture row ids, `thread_id`, `created_at`, status **before and after**, committed as a receipt |
| Stopping a live run, end to end, on each mount | SC#1 | No automated test drives a real streaming harness run against a real Stop click | Start a real workflow run; Stop from the panel spine, then (new run) from the composer, then (new run) from `ActiveRunsTray` |
| The stopped run **reads** honestly on screen | SC#2 | Wire format and DB status are not the same thing as what a person reads | After each Stop: the spine marks the interrupted phase stopped, completed phases survive, and no surface says failed or complete |
| Cross-provider roster — **8 rows** | CLAUDE.md SC#10 | 194 touches streaming, the agent loop and UI state, so the full-bandwidth rule fires | Derive the roster from `MODEL_CAPABILITIES` (group by `provider`, newest registry-backed id per group) — **never re-type it**. ⚠ Blocked rows are recorded **⛔ with a reason and a blocking id, never omitted** |

---

## Wave serialization — ⚠ CLAUDE.md § Parallel execution rule 4

> *"Serialize any plan whose tests MUTATE the local database. Worktrees isolate files, not Postgres."*

| Wave content | Serialize? | Why |
|---|---|---|
| Migration 119 **authoring** | ✅ parallel-safe | Authors a file; applies nothing |
| Migration 119 **apply** + `test_migration_119.py` | ⛔ **SERIALIZE** | DDL on the live local DB. Its `DROP+ADD CONSTRAINT` takes a brief **ACCESS EXCLUSIVE** lock on `workflow_phases` |
| Any backend test seeding `workflow_runs` / `workflow_phases` | ⛔ **SERIALIZE** | The lock above and FK contention are shared even under a rollback txn |
| D-12 / D-17's four-row heal | ⛔ **SERIALIZE** + `checkpoint:human-verify` | Mutates real, irreplaceable rows |
| Frontend mount plans + fences | ✅ parallel-safe, **≤ 2 concurrent** | Pure component/store tests |
| Ledger rows (D-02) + docstring corrections | ✅ parallel-safe | Docs only |

⚠ Every worktree runs `bash scripts/bootstrap-worktree.sh "$(pwd)"` **FIRST**; tear down **only** with
`bash scripts/teardown-worktree.sh <path>` (never `rm -rf` — it follows the junction and destroys the
real 1.7 GB `venv`). ⚠ **Assert the dispatched base SHA in every executor prompt** — worktrees forked
from the wrong base 12/12 in Phase 192. ⚠ **Capture failing filenames BEFORE re-running anything** —
cap-2 is not deterministic (193.2 measured `failed` 4, 11 and 6 on three consecutive runs of an
unchanged tree).

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers every ❌ reference above
- [ ] Every fence has a **recorded RED observation** against a real production-source plant
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 s per task
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

## Accepted scoped limitations — recorded at phase close (2026-08-16)

⚠ **Both entries below are ACCEPTED LIMITATIONS, not passing rows.** They are written here, in
`STATE.md` and on the RUN-01 row so that none of them lives only in a transcript — this project's
standing lesson is that *a measurement that lives in one place is invisible to the next phase*
(`WorkspacePanel.tsx:161-165` recorded the two-id finding in Phase 188 and Phase 194 had to
re-derive it from scratch).

### L-01 — CR-04: with `WORKER_COUNT=2`, a Stop can be overwritten by the still-running producer

**Status: OPEN. Routed to a dedicated phase. NOT closed by Phase 194 and not claimed to be.**

`RUN_TASKS` is **per-process** and `WORKER_COUNT=2` is the default. When the producer task lives
on the *other* worker, `DELETE /runs/{id}` takes the no-producer arm and writes `cancelled`
correctly — but **no cross-worker cancel signal exists and the engine has no in-loop status
poll**, so the still-running producer continues, calls `mark_phase_active`, and then
`finish_run(run_id, "completed")` (`harness_engine.py:1579`, `:1981`), **overwriting the
`cancelled` the Stop just wrote.**

⚠ **This is roughly HALF of all Stops at the default worker count, not an edge case** — the same
arithmetic CONTEXT used to justify the zombie arm in the first place. ⚠ **The limitation is
INHERITED, not introduced by Phase 194; what Phase 194 added is the CLAIM to have closed it.**
That distinction is the reason this entry exists.

**Why it is a PHASE and not a `/gsd:fast` or a bare seed** (the fixer's assessment, adopted):
both candidate repairs are NEW MECHANISMS. The cheaper one — re-read `workflow_runs.status`
before `mark_phase_active` and raise `CancelledError` when terminal — lands in the hottest engine
loop in the tree, interacts with the boot resume sweep AND with the CR-02 arm changed in this
phase's fix pass, and needs its own RED-driven fences. The fallback is a Redis cancel channel.
**A seed alone would let *"a Stop that half the time does not stop"* read as a footnote.**

Neither CR-01 nor CR-02's fix touches this or changes its shape.

**Re-open trigger:** immediate — the next workflow phase scheduled after 194. Status-poll option
first, Redis-channel option as fallback.

### L-02 — the CR-01 defect has a TWIN in `api/workflows.py`, unfixed

**Status: OPEN. Pre-existing; NOT introduced by Phase 194** — `git diff 743965a1..HEAD` on that
file is **EMPTY** for the whole phase.

`delete_workflow_cascade` (`backend/app/api/workflows.py:1483-1490`) carries the **identical
unnarrowed join** that CR-01 fixed in `api/runs.py`:

```sql
LEFT JOIN runs r ON r.thread_id = wr.thread_id AND r.status = 'streaming'
```

— no `parent_run_id IS NULL`, no `ORDER BY`, no `LIMIT` — and hands `r["producer_id"]` straight to
`_cancel_run_internals`. **It can therefore cancel a SUB-AGENT while deleting a workflow**, for
exactly CR-01's reason: sub-agent runs are inserted on the same `thread_id` with
`status='streaming'` (`task_service.py`), and harness phases are built to spawn them
(`harness/phase_types.py` — `parent_run_id=None`, `spawn` passed through).

⚠ **Severity is lower than CR-01 and the reason is measured, not assumed:** this query is
owner-scoped (`wd.created_by = $2`), so there is **no cross-tenant exposure** — the confusion is
producer-vs-sub-agent within one owner's own thread.

**Deliberately not fixed in the review pass:** different file, outside the named fix scope, and
`backend/app/api/workflows.py` is a **G-5-firing hot file (17 phases)** whose next editor owes a
refactor recommendation FIRST. It is the natural companion to WR-01's owed re-pointing of that
same block, and to L-01's phase.

**Re-open trigger:** the next phase whose `files_modified` names `backend/app/api/workflows.py`
— it fixes this join in the same commit, or states why not.

### Owed UAT — driven at verification, not in any plan

`194-UAT.md`'s rows are **UNDRIVEN**: the 8-row cross-provider scoreboard, the multi-tool /
parallel-thread / long-message axes, and the four G-4 lived-experience rows. ⚠ **The sharpest is
the negative row — reload the page mid-run, THEN press Stop** — which is the row that would have
caught the two-id landmine. They need Chrome MCP; `list_connected_browsers` returned `[]` for the
whole of this phase, so none could be driven.
