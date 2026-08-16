---
phase: 194-stop-a-running-workflow
reviewed: 2026-08-16T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - backend/app/api/runs.py
  - backend/app/db/workflows.py
  - backend/app/services/harness_engine.py
  - backend/app/services/run_lifecycle.py
  - backend/tests/test_062_cancel_run.py
  - backend/tests/test_harness_engine.py
  - backend/tests/test_migration_119.py
  - backend/tests/test_run_lifecycle.py
  - backend/tests/test_workflow_phase_cancel.py
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/components/chat/RunCard.tsx
  - frontend/src/components/chat/__tests__/ActiveRunsTray.test.tsx
  - frontend/src/components/chat/__tests__/ComposerStopHarness.test.tsx
  - frontend/src/components/chat/__tests__/MessageItem.harnessBanner.test.tsx
  - frontend/src/components/panel/PhaseTimeline.tsx
  - frontend/src/components/panel/WorkspacePanel.tsx
  - frontend/src/components/panel/phaseStatusMeta.ts
  - frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx
  - frontend/src/components/panel/__tests__/WorkspacePanel.derived.test.tsx
  - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx
  - frontend/src/components/workflows/NodeRunOverlay.tsx
  - frontend/src/components/workflows/PhaseNode.test.tsx
  - frontend/src/components/workflows/PhaseNodeCard.test.tsx
  - frontend/src/components/workflows/runVocabulary.ts
  - frontend/src/components/workflows/runVocabulary.test.ts
  - frontend/src/lib/phaseState.ts
  - frontend/src/lib/phaseState.test.ts
  - frontend/src/lib/toolMeta.ts
  - frontend/src/lib/__tests__/toolMeta.test.ts
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/stores/streamsStore.ts
  - frontend/src/types/index.ts
  - supabase/migrations/119_workflow_phases_cancelled.sql
findings:
  critical: 4
  warning: 8
  info: 5
  total: 17
status: issues_found
---

# Phase 194: Code Review Report

**Reviewed:** 2026-08-16
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Phase 194 makes a workflow run stoppable through one durable cancel path, widens
`workflow_phases_status_check` with a `cancelled` literal, extends the zombie heal across to
`workflow_runs`, and gives `DELETE /runs/{id}` a dual-id fallback. Migration 119 is clean: all six
shipped literals are re-added verbatim, exactly one is added, no RLS/table/index change, and the
regenerated `full-schema.sql` carries seven. The migration receipt and the heal receipt are the
strongest artifacts in the phase — both record their own findings against their own plans, and the
heal is verified by re-read rather than by absence of exception. The frontend typechecks at the
documented baseline (33 errors, unmoved).

The findings below are concentrated in exactly the places the phase was warned about, and four of
them defeat the phase's own headline property — *a Stop that reports success while doing nothing.*

The dual-id fallback's forward resolution joins on `thread_id` alone with no producer discriminator
and no deterministic ordering, so it can resolve to a **sub-agent** run row and cancel the wrong
task while returning 204 (CR-01). The engine's new phase terminalize sits under a bare
`except BaseException:` that cannot tell a user Stop from a crash, so a phase that CRASHED is now
persisted as `cancelled` and rendered "Stopped by you" (CR-02). The no-producer arm returns 204
unconditionally even though the only write in that request is performed by a composition that
swallows every exception by contract (CR-03). And the arm the phase leans on for the cross-worker
case cannot actually stop a live producer on another worker — that producer keeps executing and
overwrites the `cancelled` it just wrote (CR-04).

Several long docblocks make claims the code does not support; two are called out below (WR-01,
IN-02) because this project treats a comment that credits a guard with a rule it cannot enforce as a
defect in its own right.

## Critical Issues

### CR-01: The forward-resolution LEFT JOIN can resolve a SUB-AGENT run and cancel the wrong task

**File:** `backend/app/api/runs.py:1262-1290`
**Issue:**
The dual-id fallback resolves the producer identity with:

```sql
SELECT wr.id AS wf_id, wr.thread_id, r.run_id AS producer_id, r.status AS producer_status
FROM workflow_runs wr
LEFT JOIN runs r ON r.thread_id = wr.thread_id AND r.status = 'streaming'
WHERE wr.id = $1
```

followed by `next((r for r in (_live or []) if r["producer_id"] is not None), None)`.

The join's only linkage to the workflow run is `thread_id`. There is **no `parent_run_id IS NULL`
clause, no `ORDER BY`, no `LIMIT`**, and `next()` takes whatever row Postgres happens to return
first. Sub-agent runs are inserted on the **same** `thread_id` with `status='streaming'`
(`backend/app/services/task_service.py:552-562`), and a harness phase's `ToolContext` is built with
`parent_run_id=None` (`backend/app/services/harness/phase_types.py:457`) **precisely so a phase can
spawn `task()` sub-agents**. So a Stop pressed while a `task_sub_agent` phase is in flight can
resolve `producer_id` to the *sub-agent's* run id.

The consequence is the exact failure the fallback was written to remove, one level deeper:
`run_id` is rebound to the sub-agent id, `_cancel_run_internals` cancels (or zombie-heals) the
sub-agent, **the real producer task is never touched**, and the route returns 204.

No test covers more than one streaming `runs` row on a thread — `_FetchPool` in
`backend/tests/test_062_cancel_run.py:783-797` is always seeded with exactly one row, so the
ambiguity is not merely untested, it is unobservable by the suite.

**Fix:**
```python
_live = await pool.fetch(
    "SELECT wr.id AS wf_id, wr.thread_id, "
    "r.run_id AS producer_id, r.status AS producer_status "
    "FROM workflow_runs wr "
    "LEFT JOIN runs r ON r.thread_id = wr.thread_id "
    "AND r.status = 'streaming' "
    "AND r.parent_run_id IS NULL "          # never a sub-agent shell
    "WHERE wr.id = $1 "
    "ORDER BY r.started_at DESC NULLS LAST "  # deterministic, newest producer
    "LIMIT 1",
    run_id,
)
```
Add a case that seeds `_FetchPool` with a producer row **and** a sub-agent row (non-null
`parent_run_id`) and asserts the producer id is the one handed to the shared writer.

---

### CR-02: The engine cancel arm stamps `cancelled` on a phase that CRASHED or TIMED OUT

**File:** `backend/app/services/harness_engine.py:1614-1686`
**Issue:**
The new phase terminalize is placed inside the pre-existing escape handler:

```python
except BaseException:
    ...
    if not is_app_shutting_down():
        ...expire ask_user...
        await asyncio.shield(cancel_phase(pool, phase_id))
    raise
```

The exception is never captured and never inspected. That handler's own shipped comment says
*"a crash escapes the same way"*, and it is true: `_execute_phase` raising any non-`TimeoutError`
exception propagates straight out of `_run_phase_with_gates` (only `asyncio.TimeoutError` is caught
there, at `:906`) and lands here. So a phase that **failed for a real reason** is now persisted as
`cancelled`.

Downstream this renders `"Stopped by you"` on the canvas (`runVocabulary.ts:88`) and `"Stopped"` on
the panel spine (`phaseStatusMeta.ts:152`), with the clause *"you ended the run while this step was
still working"* — while `run_producer`'s terminal classifier writes `workflow_runs.status='failed'`
for the same escape. The run then reads **failed with a step claiming a person stopped it**. That is
a persisted, user-visible false statement in the phase whose entire requirement is honesty about
what a stopped run did.

No test drives a non-`CancelledError` exception through this arm:
`_drive_engine_through_a_mid_phase_cancel` in `backend/tests/test_harness_engine.py` defaults to
`asyncio.CancelledError()` and no added case overrides it with a crash to assert the resulting
status.

**Fix:**
```python
except BaseException as _escape:
    ...
    if not is_app_shutting_down():
        ...expire ask_user...
        # ONLY a cancellation is a stop. A crash / a timeout is NOT a stop and must
        # not be written as one — the run row will read `failed`, and a phase row
        # reading `cancelled` under it is a contradiction the surface renders.
        if isinstance(_escape, asyncio.CancelledError):
            try:
                await asyncio.shield(cancel_phase(pool, phase_id))
            except BaseException:
                logger.exception(...)
    raise
```
Add the negative case: drive the helper with `exc=RuntimeError("boom")` and assert **zero**
`cancelled` writes.

---

### CR-03: The no-producer arm returns 204 even when its only write silently failed

**File:** `backend/app/api/runs.py:1338-1345`, `backend/app/services/run_lifecycle.py:211-228`
**Issue:**
The route's no-live-producer arm performs exactly one durable action and then answers 204:

```python
await cancel_workflow_run_internals(pool=pool, workflow_run_id=run_id)
# Same 204 as every other arm — Postgres is the durable cancel
# record (D-062-13), and this arm has just written it.
return Response(status_code=status.HTTP_204_NO_CONTENT)
```

`cancel_workflow_run_internals` wraps **both** writes in one `try: ... except Exception: logger.exception(...)`
and returns `None` on every path. Its docstring justifies that with *"the chat-side cancel has
already landed by the time this runs"* — which is true of the Step-3b zombie caller and **false of
this caller**, where no other write exists. If `finish_run` raises (pool exhausted, transient
Postgres error, a future constraint), the route still returns 204, `cancelRun` reports success, and
`workflow_runs` stays `active` forever.

The comment *"this arm has just written it"* is a claim the code cannot make. This is the same
silent-success class the route's own header comment condemns twice, reintroduced by the arm the
phase added — and it is the arm that healed the two historically stuck rows, so it is the arm that
runs on exactly the data the phase exists for.

**Fix:** give the composition an observable outcome and let the new arm act on it.
```python
async def cancel_workflow_run_internals(*, pool, workflow_run_id) -> bool:
    """... Returns True iff BOTH writes landed. Callers that have no other durable
    write (the DELETE no-producer arm) MUST NOT report success on False."""
    try:
        ...
        return True
    except Exception:
        logger.exception(...)
        return False
```
```python
ok = await cancel_workflow_run_internals(pool=pool, workflow_run_id=run_id)
if not ok:
    raise HTTPException(status_code=500, detail="Could not stop the run")
return Response(status_code=status.HTTP_204_NO_CONTENT)
```
The Step-3b caller keeps ignoring the return value — its best-effort framing is still correct there.

---

### CR-04: A Stop landing on the other worker does not stop the run, and its terminal writes are overwritten

**File:** `backend/app/services/run_lifecycle.py:293-379`, `backend/app/services/harness_engine.py:1579,1981`
**Issue:**
`RUN_TASKS` is per-process and `WORKER_COUNT=2` is the default, which D-09 correctly identifies as
roughly half of all Stops. But the zombie arm's premise — *"process restarted, producer died"* — is
false in exactly that case: the producer is **alive on the other worker**, and there is no
cross-worker cancel signal anywhere in the backend (`grep` finds no run-status poll in the engine's
phase loop; the only cancellation mechanism is in-process `task.cancel()`).

So the zombie arm writes `runs.status='cancelled'`, `workflow_runs.status='cancelled'` and
`workflow_phases.status='cancelled'` **under a run that keeps executing**. The live engine then:
- calls `mark_phase_active(pool, phase_id)` on the next phase (`harness_engine.py:1579`), producing
  an `active` phase under a `cancelled` run, and
- calls `finish_run(pool, run_id, "completed")` at `:1981` on success (or `"failed"` at `:1693`),
  **overwriting the `cancelled` the Stop just wrote.**

Net result for ~half of all Stops on the default deployment: the API returns 204, the surface
flickers to stopped, and the run finishes and reports `completed`. RUN-01's *"stop at any point, and
the run reports honestly that it was stopped"* is not met, and SC#2's honesty claim is inverted —
the run ends up lying in the *opposite* direction from the one this phase fixed.

This limitation is inherited (Deep runs have always had it), but the phase claims to close it and
neither the code nor the receipts record it as an accepted gap.

**Fix (either, and record the choice):**
1. Publish a cancel request on a Redis channel that every worker's producer subscribes to, and have
   the owning worker call `task.cancel()`; the zombie arm then only runs after that lookup misses
   everywhere (a short SETNX/ack window), or
2. Have `harness_engine`'s phase loop re-read `workflow_runs.status` before `mark_phase_active` and
   raise `CancelledError` when it is terminal — a cheap per-phase poll that makes the DB write
   authoritative for the engine as well as for the surface.

If neither ships in this phase, record it explicitly as a scoped limitation in `194-VALIDATION.md`
and on the RUN-01 row, because a Stop that half the time does not stop is the requirement, not a
footnote.

## Warnings

### WR-01: `cancel_workflow_run_internals`' docstring claims 194 "MOVES" a composition it in fact duplicated

**File:** `backend/app/services/run_lifecycle.py:176-179`
**Issue:** The docstring states *"`delete_workflow_cascade` (`api/workflows.py:1494-1518`) has
composed exactly this since Phase 152, in the wrong file — 194 MOVES that composition here rather
than copying it."* Measured: `git diff 743965a1..HEAD -- backend/app/api/workflows.py` is **empty**,
and `api/workflows.py:1494-1518` still inline-composes `publish_cancel_sentinel` + `finish_run`
itself. Nothing was moved; a second composition was created. The same docstring carries the rule
*"Do NOT fork a second cancel writer"* while the writer it names remains forked in the tree.
It is also wrong in a second way: the cascade never called `cancel_active_phases` (which did not
exist before this phase), so it has never composed *"exactly this"*.
**Fix:** either re-point `delete_workflow_cascade`'s step (2)+(3) at
`cancel_workflow_run_internals`, or correct the docstring beside the original — e.g. *"194 does NOT
move it; `delete_workflow_cascade` still composes its own `finish_run` (`api/workflows.py:1513-1518`).
Re-pointing it is owed and is the trigger for the next phase touching that route."*

### WR-02: The forward arm publishes the ask_user cancel sentinel on a channel no harness prompt subscribes to

**File:** `backend/app/api/runs.py:1296-1312`
**Issue:** The no-producer arm correctly publishes on the **workflow** run id — the harness
subscribes there (`harness_engine.py:1283` and `harness/phase_types.py` both pass the workflow
`run_id` to `subscribe_for_response`, and the channel set key is `ask_user:channels:{run_id}`). The
forward arm instead **rebinds `run_id` to the producer id** and then hands it to
`_cancel_run_internals`, whose Step 3a publishes on `ask_user:channels:{producer_id}` — a key no
harness prompt ever registers under. So a Stop on a run paused at an approval (BUG-260808-02, folded
into this phase on exactly this basis) never gets D-085-04's PUBLISH-first wake-up; the paused
handler only sees the raw `CancelledError`. The two arms of the same route disagree about which
channel the harness listens on.
**Fix:** publish on the workflow run id **before** rebinding, in the forward arm:
```python
try:
    await publish_cancel_sentinel(redis, run_id)  # still the workflow_runs.id here
except Exception:
    logger.exception("cancel_run: harness cancel sentinel failed for workflow run %s", run_id)
_pid = _producer["producer_id"]
run_id = UUID(str(_pid)) if not isinstance(_pid, UUID) else _pid
```

### WR-03: The panel Stop renders for runs that are already terminal

**File:** `frontend/src/components/panel/WorkspacePanel.tsx:445-467`
**Issue:** The control is gated on `showTimeline && threadId`, and
`showTimeline = isHarness || phases.length > 0` (`:349`). Phase rows survive a run's completion, so
a completed / failed / cancelled workflow still shows **"This run — Stop"**. Clicking it reaches
`stopThread`, which finds no streaming assistant message, emits the new `console.warn` and returns —
a control the user can press that does nothing and says nothing. The suite pins the behaviour
(`WorkspacePanel.test.tsx`, *"mounts for a phases-exist thread with no lock"*), so it is deliberate,
but it is an inert destructive-looking affordance on a surface whose subject is honesty.
**Fix:** gate on liveness, not on the timeline:
```tsx
const runIsLive =
  workflowLock != null && !workflowLock.capPaused &&
  phases.some((p) => p.status === "running" || p.status === "retrying")
{runIsLive && threadId && ( /* … Stop … */ )}
```

### WR-04: "Stopped by you" is asserted for operator kills and delete cascades

**File:** `frontend/src/components/workflows/runVocabulary.ts:88,155`
**Issue:** `_cancel_run_internals`' new step 1b is inherited by three non-owner callers —
`backend/app/api/admin.py:506` (operator Kill), `admin.py:825` (the disable-user sweep, which kills a
victim's in-flight runs) and `backend/app/api/workflows.py:1504` (the delete cascade). Each of those
now drives `cancel_active_phases`, so a phase can reach `cancelled` without the run's owner ever
pressing Stop, while the canvas renders `"Stopped by you"` and `CLAUSE_STOPPED` renders *"you ended
the run while this step was still working"*. Telling a user they stopped a run an operator killed is
the same class of false statement the phase exists to remove.
**Fix:** make the reading agent-neutral, e.g. `cancelled: "Stopped mid-step"` with
`CLAUSE_STOPPED = "— the run was ended while this step was still working"`, or carry the actor on
the phase row and render two variants.

### WR-05: A `cap_paused` producer falls into the no-producer arm and leaves a half-terminal run

**File:** `backend/app/api/runs.py:1266-1268`
**Issue:** The join filters `r.status = 'streaming'`. `cap_paused` is explicitly **non-terminal and
re-attachable** (`run_lifecycle.py:138-141`, and Step 2's terminal set at `:266` excludes it), and a
`cap_paused` harness run still holds its thread anchor — so it passes clauses (a)/(b)/(c), finds no
`streaming` row, and takes the no-producer arm. That terminalizes `workflow_runs` and its phases
while the `runs` row stays `cap_paused` and remains in `runs:active` / `runs_by_thread:{tid}`. The
result is exactly the mirror drift `finalize_run_terminal` was built to prevent, produced by the new
arm.
**Fix:** widen the join to non-terminal producer statuses and route a found row through the shared
writer (which already short-circuits on true terminals at Step 2):
```sql
AND r.status NOT IN ('completed','failed','cancelled','timed_out')
```

### WR-06: F-1's cancel fence is line-scoped and does not sweep `pages/`

**File:** `frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx` (fence F-1, clause (b))
**Issue:** Two gaps in a fence the phase relies on for "four mounts, ONE mechanism":
1. Clause (b) evaluates `CANCEL_CALL.test(line) && LOCK_RUN_ID.test(line)` **per line**, so a
   prettier-wrapped call — `stopThread(\n  workflowLock.runId,\n)` — matches neither conjunct on any
   single line and passes green.
2. The union globs `panel/`, `chat/` and `workflows/` only. `frontend/src/pages/` is not swept, and
   that directory holds `WorkflowRunPage.tsx` — a workflow **run surface**, the single most likely
   home for a fifth Stop mount. The fence's own docblock calls its scope *"the union of the mount
   directories"*, which is not what it globs.
**Fix:** join the file into one string (or strip newlines inside call parens) before the conjunction,
and add a fourth glob for `../../../pages/**/*.{ts,tsx}` with its own named non-empty assertion
(`/WorkflowRunPage.tsx`).

### WR-07: `cancelRun`'s 404 swallow leaves the new panel Stop's real failures silent

**File:** `frontend/src/lib/api.ts:1259-1268`, `frontend/src/providers/StreamsProvider.tsx:2386-2478`
**Issue:** The phase added a `console.warn` for the falsy-`runId` pre-stamp window (correctly
scoped, and the deferral is recorded), but the neighbouring silence is untouched: `cancelRun`
returns normally on **any** 404. Now that the server accepts both id shapes, a 404 no longer means
"another tab already cancelled it" nearly as often — it means the server could not resolve the id, or
the anchor moved. The panel Stop therefore still has a path where the user presses Stop, nothing
happens, and the UI says nothing at all.
**Fix:** distinguish the two — have `stopThread` surface a notice when the DELETE 404s while the
local message still reads `runStatus === "streaming"`, e.g. reuse the `fallbackNotices` slice rather
than swallowing.

### WR-08: The forward-resolution `pool.fetch` is unguarded and turns an infra blip into a 500 on the Stop path

**File:** `backend/app/api/runs.py:1262-1276`
**Issue:** Every other durable/best-effort step in this route and in `_cancel_run_internals` carries
its own `try/except` per D-062-13. The new `await get_pg_pool()` + `pool.fetch(...)` does not, so a
pool acquisition failure or a transient query error raises out of the route as a 500 — on the one
request whose whole purpose is to be idempotent and never fail. It is also *the* request a user
retries under stress.
**Fix:** wrap the fetch, log, and fall through to the existing `if not row: raise 404` (or return
204 after attempting the workflow-side write), so the arm degrades the way the rest of the route
does.

## Info

### IN-01: `WorkspacePanel.tsx` spells the `■` glyph in prose, defeating the occurrence count its sibling relies on

**File:** `frontend/src/components/panel/WorkspacePanel.tsx:296`
**Issue:** `phaseStatusMeta.ts:130-137` explicitly rests a shipped claim on the glyph's render count
across `frontend/src` and refuses to spell rejected marks in prose for that reason. `WorkspacePanel.tsx:296`
spells `■` inside a docblock, so `grep -rn "■" frontend/src` now returns **3** where only **2** are
renders. This is the 187-24 trap the phase's own comments warn about four times.
**Fix:** write it without the character (e.g. "the filled-square cancelled-STATE glyph"), as the
neighbouring comments already do for the rejected marks.

### IN-02: The comment defending the synthesized `producer_status` describes a case the join makes unreachable

**File:** `backend/app/api/runs.py:1300-1310`
**Issue:** *"copying that shape here would silently reclassify every already-terminal producer as
cancellable"* — but the LEFT JOIN filters `r.status = 'streaming'`, so an already-terminal producer
never reaches this branch and `producer_status` is `'streaming'` by construction. Step 2's terminal
check is dead code on this path. The comment credits a guard with a rule it cannot enforce.
**Fix:** state the real reason (the field is threaded so Steps 2/3a/3b run unchanged) and, if WR-05
is taken, the comment becomes true as written.

### IN-03: `test_migration_119.py` green-skips entirely in any environment without local Postgres

**File:** `backend/tests/test_migration_119.py:113-119,223,275,337`
**Issue:** A module-level `skipif` plus three in-body `pytest.skip` mean every case is a green skip
in CI. The constraint widening has no enforcement outside the operator's box. `194-MIGRATION-RECEIPT.md`
handles this honestly (it says *"a green-skip is not a passing fence"* and records eleven driven RED
observations), so this is not a false claim — but the fence is a local one, permanently.
**Fix:** none required for this phase; note it where the CI test policy lives so the next reader does
not read a green CI run as evidence that migration 119's vocabulary is pinned.

### IN-04: `_cancel_run_internals`' step 1b acquires the pool twice per zombie heal

**File:** `backend/app/services/run_lifecycle.py:304-306,369-374`
**Issue:** `get_pg_pool()` is awaited at `:306` for `finalize_run_terminal` and again at `:373` for
the workflow co-write, in the same function, a few lines apart. Harmless (the dependency is a
singleton), but it obscures that both writes share one pool and makes the second `try/except`'s
stated purpose ("could not acquire a pool") read as a distinct failure mode when the first would
already have logged it.
**Fix:** hoist the pool to a local above step 1 and reuse it.

### IN-05: The heal receipt's ledger table is superseded by later plans, as it predicted

**File:** `.planning/phases/194-stop-a-running-workflow/194-HEAL-RECEIPT.md:621-656`
**Issue:** The receipt records `RunCard.tsx` as untouched (`20 / 8 / 550`) and warns that plans
`194-05` and `194-07` had not yet run. Both have since landed and touched `RunCard.tsx`,
`MessageItem.tsx`, `toolMeta.ts` and `streamsStore.ts`, so the triples in that table are stale by the
receipt's own mechanism.
**Fix:** re-derive the `RunCard.tsx` / `WorkspacePanel.tsx` ledger triples at HEAD and record them
beside — not over — the receipt's figures, per the project's standing habit.

---

_Reviewed: 2026-08-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
