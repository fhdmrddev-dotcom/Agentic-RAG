---
phase: 194-stop-a-running-workflow
verified: 2026-08-16T08:11:49Z
verified_at_head: c74750c3
branch: develop
status: gaps_found
score: 2/3 roadmap success criteria verified
overrides_applied: 0
requirement: RUN-01
requirement_verdict: partially_satisfied
gaps:
  - truth: "SC#2 — The stopped run reports `cancelled` honestly — not failed, not silently complete."
    status: failed
    reason: >-
      At the DEFAULT `WORKER_COUNT=2` a Stop that lands on the worker not holding the
      producer task writes `cancelled` correctly and then has it OVERWRITTEN by the
      still-running producer, which finishes and calls `finish_run(pool, run_id,
      "completed")`. The user pressed Stop, got 204, and the run reports `completed`.
      That is literally the "silently complete" outcome SC#2 forbids, at roughly half of
      all Stops. Verified independently in source at HEAD, not taken from the SUMMARY.
      Recorded by the phase as accepted limitation L-01 / review finding CR-04 — but a
      recorded limitation is not an achieved success criterion, and no later phase in this
      milestone covers it.
    artifacts:
      - path: "backend/app/db/workflows.py:1458-1473"
        issue: "`finish_run` is an unconditional `UPDATE workflow_runs SET status = $2 WHERE id = $1` with no terminal guard — a later `completed` write silently replaces a `cancelled`."
      - path: "backend/app/services/harness_engine.py:2012"
        issue: "`await finish_run(pool, run_id, \"completed\")` on the success arm; no in-loop re-read of `workflow_runs.status` anywhere in the phase loop."
      - path: "backend/app/services/run_lifecycle.py:341-401"
        issue: "The zombie arm's premise (\"producer died\") is false in the cross-worker case — the producer is alive on the other worker and nothing signals it."
      - path: "backend/app/services/ask_user_service.py:310-332"
        issue: "`publish_cancel_sentinel` is the only cross-process cancel publish and it is scoped to `ask_user:*` channels — it cannot reach a producer that is not paused at a prompt."
      - path: "backend/Dockerfile:43"
        issue: "`--workers ${WORKER_COUNT:-2}` — the failing configuration is the default in production, in `backend/.env.example`, in `deploy/onebox.env.example` and in `scripts/restart-backend.ps1`."
    missing:
      - "A cross-worker cancel signal (Redis cancel channel every worker's producer subscribes to), OR an in-loop `workflow_runs.status` re-read before `mark_phase_active` that raises `CancelledError` on a terminal status."
      - "Until then: a terminal-status guard on `finish_run` so a `completed` write cannot silently replace a `cancelled`."
      - "A ROADMAP phase for the fix — L-01 is routed to \"a dedicated phase\" that does not exist in the milestone (195-198 do not cover it)."
  - truth: "SC#2 — the vocabulary a user reads about a stop is honest about WHO stopped it."
    status: partial
    reason: >-
      `_cancel_run_internals` step 1b (added by this phase) is inherited by three
      non-owner callers — the operator Kill, the disable-user sweep and the workflow
      delete cascade. Each now drives `cancel_active_phases`, so a phase reaches
      `cancelled` without the run's owner ever pressing Stop, while the canvas renders
      "Stopped by you" / "you ended the run while this step was still working". Telling a
      user they stopped a run an operator killed is the same class of false statement the
      phase exists to remove. Review finding WR-04, open and unfixed.
    artifacts:
      - path: "frontend/src/components/workflows/runVocabulary.ts:110,158"
        issue: "`cancelled: \"Stopped by you\"` and `CLAUSE_STOPPED = \"— you ended the run while this step was still working\"` — asserts an actor the phase row does not carry."
      - path: "backend/app/api/admin.py:506,825"
        issue: "Operator Kill and disable-user sweep call the shared writer, now inheriting the phase terminalize."
      - path: "backend/app/api/workflows.py:1504"
        issue: "Delete cascade calls the shared writer, same inheritance."
    missing:
      - "An agent-neutral reading (e.g. \"Stopped mid-step\" / \"the run was ended while this step was still working\"), OR the actor carried on the phase row with two rendered variants."
  - truth: "The accepted limitation is recorded where the next phase will find it."
    status: failed
    reason: >-
      `194-VALIDATION.md` states verbatim that L-01 and L-02 are "written here, in
      `STATE.md` and on the RUN-01 row so that none of them lives only in a transcript".
      Measured at HEAD, that is FALSE: `.planning/STATE.md` contains no L-01/CR-04 entry
      (its only "L-01" match is `ARL-01…04`, Phase 192.1's unrelated security register)
      and `.planning/REQUIREMENTS.md`'s RUN-01 row carries no note. The limitation lives
      only in `194-VALIDATION.md` and `194-REVIEW.md` — which is precisely the
      single-place invisibility the entry itself invokes as the reason it exists.
    artifacts:
      - path: ".planning/STATE.md"
        issue: "No L-01 / CR-04 / cross-worker-overwrite entry. The stopped_at narrative still describes the phase at 11 of 13 plans, predating the code review and fix pass."
      - path: ".planning/REQUIREMENTS.md:70"
        issue: "RUN-01 row is unannotated — a reader ticking it later has no signal that half of all Stops do not stop."
    missing:
      - "An L-01 note on the RUN-01 row in REQUIREMENTS.md (orchestrator-owned write)."
      - "An L-01 entry in STATE.md (orchestrator-owned write)."
      - "A ROADMAP phase or seed carrying the fix, so the re-open trigger points at something that exists."
human_verification:
  - test: "Start a real workflow run, then press Stop from the panel spine. Repeat on a NEW run from the composer, and again on a NEW run from ActiveRunsTray."
    expected: "Each Stop ends the run. The spine marks the interrupted phase Stopped, completed phases survive, and no surface says failed or complete."
    why_human: "No automated test drives a real streaming harness run against a real Stop click. All 15 rows of 194-UAT.md are undriven (rows_driven: 0) — Chrome MCP returned [] for the whole phase."
  - test: "⚠ THE SHARPEST ROW — reload the page mid-run, THEN press Stop."
    expected: "The Stop resolves the PRODUCER run id and ends the run; it does not silently no-op and does not cancel a sub-agent."
    why_human: >-
      This is the row that would have caught the two-id landmine, and verification found a
      second, unrecorded reason to drive it (see Anti-Patterns / A-1): the client's
      active-runs reconcile creates a `runStatus:"streaming"` placeholder for EVERY
      streaming `runs` row on the thread, sub-agent rows included, and `stopThread` picks
      by bucket order. Whether it can hand a sub-agent id to `DELETE /runs/{id}` depends
      on ordering that only a live run exercises.
  - test: "Stop a run that is waiting at an approval (ask_user) checkpoint."
    expected: "The paused prompt wakes, the run ends cancelled, and /pending serves no dead prompt."
    why_human: "Requires a live harness run parked at an approval; the sentinel/publish ordering is only observable end to end."
  - test: "Press the panel Stop on a workflow run that has ALREADY finished (the control still renders — WR-03)."
    expected: "Either the control is absent, or pressing it tells the user something. Today it emits a console.warn and nothing reaches the screen."
    why_human: "Visual/affordance judgement on a surface whose subject is honesty."
  - test: "The 8-row cross-provider roster + the multi-tool, parallel-thread and long-message axes (CLAUDE.md SC#10 — three of its four triggers fire on this phase)."
    expected: "Each row carries a real verdict; blocked rows recorded ⛔ with a reason and a blocking id, never omitted."
    why_human: "194-UAT.md authored 15 rows and drove 0. Cross-provider behaviour does not transfer 1:1 and cannot be inferred from unit tests."
deferred: []
---

# Phase 194: Stop a Running Workflow — Verification Report

**Phase Goal:** A run can be stopped at any point and says so honestly — specifically, that the
shipped cancel is **reachable**, **honest** and **safe** from the workflow run surface.
**Verified:** 2026-08-16T08:11:49Z at HEAD `c74750c3` (branch `develop`)
**Status:** `gaps_found`
**Re-verification:** No — initial verification.

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC#1 | A user can stop a run mid-execution from the run surface. | ✓ VERIFIED (code) — end-to-end owed to human | Three mounts exist, are wired and are reachable. Mount 4 descoped honestly. See below. |
| SC#2 | The stopped run reports `cancelled` honestly — not failed, not silently complete. | ✗ **FAILED** | At the default `WORKER_COUNT=2` the run can still report `completed` after a Stop. The write half is verified; the *outcome* half is not. |
| SC#3 | Stopping is safe mid-phase: no partial write is presented as finished. | ✓ VERIFIED | Proved mechanically AND on live data — a `completed` phase survived the real heal untouched. |

**Score: 2/3.**

---

### SC#1 — Reachable ✓

Verified in source, not from SUMMARY claims:

| Mount | Artifact | Status | Evidence |
|-------|----------|--------|----------|
| 1 — panel spine (PRIMARY) | `frontend/src/components/panel/WorkspacePanel.tsx:453-469` | ✓ WIRED | Real `<button data-testid="panel-stop-run">` under the `showTimeline && threadId` harness gate, `onClick={() => void streamActions.stopThread(threadId)}`. Passes the **THREAD id**, never `workflowLock.runId`. |
| 2 — composer | `MessageInput.tsx:410-416` → `ChatArea.tsx:361` → `StreamsProvider.tsx:2373-2404` | ✓ WIRED | `stopStream` resolves the streaming assistant message's own `runId` (the producer id). |
| 3 — ActiveRunsTray | `ActiveRunsTray.tsx:107,128` → `stopThread` | ✓ WIRED | Per-run Stop **and** Stop-all already ship. A harness thread reaches `streamingThreads` because `StreamsProvider.tsx:1587` derives it from `snapshot.active_runs`, and a harness run has a producer `runs` row with `status='streaming'` — so V-08 holds by construction, not by assertion. |
| 4 — library row | — | ⊘ **DESCOPED (D-16), honestly** | Confirmed: `grep -rE "runId\|run_id\|running\|activeRun"` across `library/` returns one hit, prose in a docblock; all three feeds are **definition** feeds. The strikethrough premise is kept visible in `194-CONTEXT.md:133-136` rather than overwritten. |

**Does SC#1 silently depend on mount 4? No — confirmed, not accepted.** The property mount 4 was
reached for ("stoppable from outside its thread without navigating in") is delivered by mount 3,
which was already shipping. `ActiveRunsTray.tsx:107` (Stop-all) and `:128` (per-run Stop) both route
through `stopThread`. The descope has a written re-open trigger.

**The two-id landmine is genuinely avoided.** `workflowLock.runId` really does carry two id types —
`StreamsProvider.tsx:1840` stamps a `workflow_runs.id` on reconcile, `:3093` stamps a producer
`runs.run_id` on continue-resubscribe. The panel Stop touches neither and delegates to the resolver.
The pre-stamp silent no-op is now observable (`:2453-2460`, `:2390-2397`) with the rejected
alternative and its re-open trigger recorded in place.

**What is NOT verified:** that any of this ends a real run. Zero of 15 UAT rows were driven.

---

### SC#2 — Honest ✗ FAILED

**This is the phase's headline claim and it is the one judgement that matters, so it is stated
plainly rather than balanced.**

#### What IS delivered, and is real

| Property | Status | Evidence at HEAD |
|---|---|---|
| `DELETE /runs/{id}` accepts a `workflow_runs.id`, owner-scoped + anchor-confirmed | ✓ | `api/runs.py:1236-1253` — all three clauses (a)(b)(c) present; 404 never 403. |
| It resolves FORWARD to the live producer | ✓ | `:1292-1303` — and the CR-01 fix is in source: `AND r.parent_run_id IS NULL`, `ORDER BY r.started_at DESC NULLS LAST, r.run_id DESC`, `LIMIT 1`. |
| The no-producer arm cannot 204 over a failed write | ✓ | CR-03 fix in source: `cancel_workflow_run_internals` returns `bool`; `:1392-1396` raises 500 when it is `False`. |
| Step 3b co-writes `workflow_runs` + clears the anchor, reading the anchor BEFORE the shipped 092-03 clear | ✓ | `run_lifecycle.py:341-401` — ordering is load-bearing and correct. |
| One composition, two callers; no second cancel writer | ✓ | `run_lifecycle.py:158-250`. |
| Deep path byte-identical | ✓ | The `if wf_id` guard is the scope; Step-1 `runs` SELECT stays first. |
| Tests | ✓ | **Re-run by this verifier**: `test_062_cancel_run.py` + `test_run_lifecycle.py` + `test_migration_119.py` → **43 passed**. |

#### What is NOT delivered — and it is the criterion itself

`RUN_TASKS` is a per-process dict. `WORKER_COUNT=2` is the default — confirmed in
`backend/Dockerfile:43` (`--workers ${WORKER_COUNT:-2}`), `backend/.env.example:76`,
`deploy/onebox.env.example:68` and `scripts/restart-backend.ps1:94`. So it is the shipped
configuration locally *and* in production.

When a Stop lands on the worker that does not hold the producer task:

1. The route takes the no-producer / zombie arm and writes `cancelled` — correctly.
2. **Nothing tells the other worker.** Verified by search, not by reading the SUMMARY: the only
   cross-process cancel publish in the backend is `publish_cancel_sentinel`
   (`ask_user_service.py:310-332`), which publishes only onto `ask_user:{run_id}:{tool_call_id}`
   channels — it can wake a producer *paused at a prompt*, and cannot reach one that is executing.
3. **The engine never re-reads its own status.** No `workflow_runs.status` poll exists in the phase
   loop; the only cancellation mechanism is in-process `task.cancel()`.
4. The producer runs on, calls `mark_phase_active` (`harness_engine.py:1579`) producing an `active`
   phase under a `cancelled` run, and then `finish_run(pool, run_id, "completed")` at `:2012`.
5. `finish_run` is `UPDATE workflow_runs SET status = $2 WHERE id = $1` (`db/workflows.py:1458-1463`)
   — **unconditional, no terminal guard.** The `completed` silently replaces the `cancelled`.

Net: the user pressed Stop, the API answered 204, the surface flickered to stopped, and the run
finished and reports **`completed`**. SC#2's wording is *"not failed, **not silently complete**"*.
This is exactly "silently complete", at roughly half of all Stops on the default deployment.

**Is L-01 a bounded, recorded exception, or does it undermine the headline claim? It undermines it.**
Three reasons, each measured rather than argued:

1. **It is the modal case, not an edge.** ~50% at the default worker count — the same arithmetic the
   phase's own CONTEXT (D-09) used to *justify* building the zombie arm. A phase cannot invoke a
   frequency to justify its work and then treat the same frequency as a footnote.
2. **It fails the criterion in the direction the criterion names.** SC#3 and SC#1 are about states and
   controls; SC#2 is about a *report*. The report is wrong, and it is wrong in the exact word the
   criterion forbids.
3. **Its routing points at nothing.** `194-VALIDATION.md` routes L-01 to "a dedicated phase" with an
   "immediate" re-open trigger. Milestone phases 195-198 (`Show the Deliverable`, `Registry-Backed
   Model Picker`, `Guided Authoring`, `Node Vocabulary`) cover none of it, so Step 9b does **not**
   defer this gap. And the record itself is broken — see gap 3 below.

**What the phase is properly credited with:** L-01 is *inherited*, not introduced. Before 194 the
wrong-worker Stop did strictly less (it never wrote `workflow_runs` at all, leaving the orphaned-lie
state `run_lifecycle.py:348-356` now describes). 194 improved the situation and named the residue
accurately and unflinchingly — `194-REVIEW.md`'s CR-04 reaches the same verdict this report does, in
its own words: *"RUN-01's 'stop at any point, and the run reports honestly that it was stopped' is not
met, and SC#2's honesty claim is inverted."* Improvement is real. It is not the criterion.

#### A second SC#2 defect, open and unfixed (WR-04)

Step 1b is inherited by `admin.py:506` (operator Kill), `admin.py:825` (disable-user sweep) and
`workflows.py:1504` (delete cascade) — all confirmed in source. Each now drives
`cancel_active_phases`, so a phase can reach `cancelled` with no owner Stop, while
`runVocabulary.ts:110` renders **"Stopped by you"** and `:158` renders *"you ended the run while this
step was still working"*. That is a false statement to a user, of the class this phase exists to
remove, newly reachable because of this phase's own change.

---

### SC#3 — Safe ✓ VERIFIED

| Property | Status | Evidence |
|---|---|---|
| Interrupted phase → `cancelled`, never `failed`/`skipped` | ✓ | `db/workflows.py:1293` (`cancel_phase`, phase-keyed, engine arm) and `:1341-1390` (`cancel_active_phases`, run-keyed, zombie arm). |
| Completed phases untouched | ✓ **mechanically AND on real data** | `AND status = 'active'` in the predicate (`:1388`, deliberately on one source line). And: this verifier re-queried the live DB — healed phase `d751095b…` still reads **`completed`**, sibling `0e0cf57c…` reads **`cancelled`**. |
| Only a real cancellation is written as one (CR-02 fix) | ✓ | `harness_engine.py:1707-1716` — `if isinstance(_escape, asyncio.CancelledError)`. A crash writes nothing and leaves the row `active`, preserving the shipped resume contract. |
| Migration 119 applied to the live DB | ✓ **independently re-verified** | `pg_get_constraintdef` at `127.0.0.1:54322` returns all **seven** literals including `cancelled`. `test_migration_119.py` → **3 passed** (executes, does not green-skip). |
| Frontend union admits it and does not render "Unknown" | ✓ | `lib/phaseState.ts:80` (`DB_PHASE_STATUS`), `:160` (`CanvasReading` 9th member), `:223-224` (explicit `case` arm, not a fall-through). Panel word `phaseStatusMeta.ts:152` → `"Stopped"`. Canvas word `runVocabulary.ts:110`. |
| The data heal (V-20) | ✓ **independently re-verified** | Live DB now: `workflow_runs` active **0**; `workflow_phases` active **0**; threads with a workflow anchor **0**; orphan terminal-run anchors **0**. `194-HEAL-RECEIPT.md` carries real row ids with before/after per row and states per row that the HTTP 204s were **not** obtained and are not claimed. |

---

## Behavioural Spot-Checks (run by this verifier, not read from SUMMARY)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Backend cancel path | `pytest tests/test_062_cancel_run.py tests/test_run_lifecycle.py tests/test_migration_119.py -q` | `43 passed` | ✓ PASS |
| Migration 119 executes (not skips) | `pytest tests/test_migration_119.py -v` | 3 × `PASSED`, 0 skipped | ✓ PASS |
| Live constraint | `pg_get_constraintdef` on `workflow_phases_status_check` | 7 literals incl. `cancelled` | ✓ PASS |
| Live heal state | `workflow_runs` / `workflow_phases` / anchor queries | active 0 / 0 / 0, orphan anchors 0 | ✓ PASS |
| Typecheck | `npx tsc -p tsconfig.app.json --noEmit` | **33** — the documented unmoved baseline | ✓ PASS |
| Frontend count gate | `GSD_VITEST_MAX_WORKERS=2 node ../scripts/vitest-count-gate.cjs` | `count gate OK` · 3954 · failed 0 · 75/75 · exit 0 | ✓ PASS |
| Panel / tray / derivation suites | `vitest run WorkspacePanel.test.tsx ActiveRunsTray.test.tsx phaseState.test.ts` | 3 files, **106 passed** | ✓ PASS |
| Chat surface suites | `vitest run src/components/chat/__tests__/ src/lib/__tests__/toolMeta.test.ts` | 15 files, **138 passed** | ✓ PASS |
| Stop a live run end to end | — | not runnable without a live streaming harness run + browser | ? SKIP → human |

Every gate the orchestrator reported was independently reproduced. None was taken on trust.

---

## Anti-Patterns Found

| ID | File | Severity | Finding |
|---|---|---|---|
| — | all 13 modified source files | — | **No `TBD` / `FIXME` / `XXX` debt markers.** Clean. |
| A-1 | `backend/app/api/threads.py:475-482` + `frontend/src/providers/StreamsProvider.tsx:1607-1638` | ⚠️ **WARNING (new — in no phase artifact)** | **The client-side twin of CR-01.** The snapshot's `active_runs` SELECT filters `status='streaming'` with **no `parent_run_id IS NULL`**, and sub-agent runs are inserted with the same `thread_id`, `user_id` and `status='streaming'` (`task_service.py:551-562`). The reconcile loop then creates a `runStatus:"streaming"` placeholder carrying **that run's id** for each. `stopThread` picks by bucket order (`:2415-2418`), so a **sub-agent** id can reach `DELETE /runs/{id}` — which takes the Step-1 **primary** path (the row exists and is owned), cancels the sub-agent and returns 204 while the producer keeps running. CR-01's fix narrowed only the backend *fallback* join; the primary path acts on whatever id the client supplies. Whether it fires depends on placeholder ordering, which only a live run exercises — hence UNCERTAIN, and hence the reload-mid-run UAT row matters more than it already did. |
| A-2 | `frontend/src/components/panel/WorkspacePanel.tsx:453` | ⚠️ WARNING (WR-03, open) | `showTimeline = isHarness \|\| phases.length > 0`, and phase rows survive a run's completion — so a finished run still shows **"This run — Stop"**. Pressing it emits a `console.warn` and nothing reaches the screen: a destructive-looking affordance that does nothing and says nothing, on a surface whose subject is honesty. |
| A-3 | `frontend/src/lib/api.ts:1259-1268` | ⚠️ WARNING (WR-07, open) | `cancelRun` swallows **any** 404. Now that the server accepts both id shapes, a 404 means "could not resolve" far more often than "another tab already cancelled it" — so the panel Stop retains a fully silent failure path. |
| A-4 | `backend/app/api/runs.py:1266-1268` | ⚠️ WARNING (WR-05, open) | The forward join filters `r.status = 'streaming'`, but `cap_paused` is non-terminal and re-attachable and still holds its anchor — so a `cap_paused` run passes (a)(b)(c), finds no producer, and takes the no-producer arm, terminalizing `workflow_runs` + phases while the `runs` row stays `cap_paused` in `runs:active`. The exact mirror drift `finalize_run_terminal` exists to prevent, produced by the new arm. |
| A-5 | `backend/app/api/runs.py:1290-1303` | ⚠️ WARNING (WR-08, open) | The new `get_pg_pool()` + `pool.fetch(...)` carries no `try/except`, unlike every other step in this route — a transient pool/query error becomes a **500 on the Stop path**, the one request whose purpose is to be idempotent and never fail. |
| A-6 | `backend/app/api/workflows.py:1483-1490` | ℹ️ INFO (L-02, accepted) | Confirmed exactly as recorded: the identical unnarrowed join, no `parent_run_id IS NULL`, feeding `_cancel_run_internals`. Owner-scoped (`wd.created_by = $2`) so no cross-tenant exposure. `git log 743965a1..HEAD -- backend/app/api/workflows.py` is **EMPTY** — pre-existing, correctly attributed. |

---

## Requirements Coverage

| Requirement | Source | Description | Status | Evidence |
|---|---|---|---|---|
| RUN-01 | all 13 plans (`requirements: [RUN-01]`, verified in every frontmatter) | "A user can stop a running workflow at any point, and the run reports honestly that it was stopped." | ⚠️ **PARTIALLY SATISFIED** | The *control* half is delivered (SC#1 ✓) and the *safety* half is delivered (SC#3 ✓). The *honesty* half — "the run reports honestly that it was stopped" — does **not** hold at the default worker count: the run reports `completed`. |

**Does the UAT being undriven change the RUN-01 answer? Yes, in one direction only.** Even if every
UAT row passed, RUN-01 would remain partially satisfied, because L-01 is a source-level defect that
no passing row can repair — and a UAT session would be **more likely than not to observe a passing
Stop**, since a single-worker dev process or a lucky worker assignment both produce the honest path.
So the undriven UAT does not cause the RUN-01 verdict; it does mean **no human has ever seen this
phase's Stop work at all**, which is why several human-verification rows remain even though the
verdict is already `gaps_found`.

**No orphaned requirements.** REQUIREMENTS.md:114 maps `RUN-01 | 194` and nothing else to this phase.

---

## What the SUMMARY files claimed vs. what the code establishes

Per instruction, SUMMARY claims were treated as claims. Spot-checks:

| Claim | Verdict |
|---|---|
| 194-03: "the panel's Stop resolves through `stopThread(threadId)` — never `workflowLock.runId`" | ✓ TRUE in source (`WorkspacePanel.tsx:461`). |
| 194-04: "no surface collapses the new status into done, failed or skipped" | ✓ TRUE — explicit `case "cancelled"` arms in both `phaseStatusFromDb` and `canvasReading`, not fall-throughs. |
| 194-07: "before phase 1 the banner still reads exactly `Starting workflow…` — the byte pin is unmoved" | ✓ TRUE (`toolMeta.ts:182`; pin at `toolMeta.test.ts:31`, plus a new V-07(a) case at `:130`). |
| 194-09: "'stop at ANY point' is true, not qualified" | ✗ **OVERCLAIM.** True only for the narrow case the must_have itself scopes ("where the producer task is dead"). The clause "not qualified" is false — it is qualified by L-01 at ~50%. |
| 194-13: "the two run rows were healed BY RUNNING THE PATH THIS PHASE BUILT" | ✓ TRUE and honestly qualified — the receipt states per row that the HTTP route was **not** driven (no obtainable JWT; the executor refused to forge auth) and that the two 204s "DO NOT EXIST AND ARE NOT CLAIMED". The writer that the route's no-producer arm calls was invoked directly. |
| VALIDATION: L-01/L-02 are "written here, in `STATE.md` and on the RUN-01 row" | ✗ **FALSE.** Neither location contains them (gap 3). |
| 194-01 Task 2 duplicate-icon: a recorded deferral, not a verdict | ✓ TRUE — `194-MEASUREMENTS.md` disqualifies its own sample on two measured grounds and records what was and was not established. Correctly neither closed nor failed. |

---

## Gaps Summary

Phase 194 did substantial, careful and unusually self-critical work. Its migration is applied and
independently verified, its data heal is real and re-queried at HEAD, its phase vocabulary is
correct and fail-closed, its three Stop mounts genuinely exist and are wired to the one durable
cancel path, its descope of mount 4 rests on a measured premise with the false original left visible,
and four review findings were fixed in source before this verification. Every gate reproduced.

It nonetheless does not achieve its middle success criterion, and that criterion is the phase's
reason for existing. **A Stop that reports success while the run goes on to report `completed` is the
defect this phase was created to remove, and at the default `WORKER_COUNT=2` it is still there for
roughly half of all Stops.** The phase names this accurately (L-01 / CR-04) and does not claim to
have closed it — which is the right behaviour and is why this report credits it — but an
accurately-described unmet criterion is still an unmet criterion.

Three things make the residue worse than its own description:

1. **The record is broken.** `194-VALIDATION.md` says L-01 is recorded in STATE.md and on the RUN-01
   row specifically so it cannot live in one place. Measured: it is in neither. The entry violates
   the very lesson it cites.
2. **The routing points at nothing.** "A dedicated phase" does not exist in the ROADMAP; 195-198 do
   not touch it. The "immediate" trigger has no target.
3. **A new, unrecorded honesty defect is reachable** because of this phase's own change (WR-04:
   "Stopped by you" for operator kills), and a second is plausible and undriven (A-1: the client can
   hand a sub-agent id to the cancel route — the client-side twin of the CR-01 the review caught on
   the server).

### On accepting this as an override

An override is a legitimate option here and is offered rather than assumed — but it should be taken
with the cost stated, not as bookkeeping. `references/verification-overrides.md` says overrides are
**not** appropriate when "the implementation is simply incomplete", and the SC#2 failure is
incompleteness rather than an alternative implementation. If the operator judges that shipping 194
with a known half-effective Stop is the right trade, the honest form is:

```yaml
overrides:
  - must_have: "SC#2 — The stopped run reports cancelled honestly — not failed, not silently complete."
    reason: >-
      L-01/CR-04 accepted for this phase: the cross-worker overwrite is inherited, 194 strictly
      improves on it, and the fix (a cross-worker cancel signal or an in-loop status poll) is a
      new mechanism in the hottest engine loop. Scheduled as its own phase.
    accepted_by: "{operator}"
    accepted_at: "{ISO timestamp}"
```

⚠ **An override should not be added until the fix has a real home in the ROADMAP and the RUN-01 row
carries the limitation.** Otherwise the override closes the last place the defect is written down.

### Recommended next action

**Do not route to `/gsd:plan-phase 194 --gaps`.** G-7's spirit applies: gap 1 is a new mechanism, not
a defect in code this phase wrote, and a closure round may not add a capability. Instead:

1. **Insert a phase for the cross-worker Stop** (option 2 from CR-04 — the in-loop
   `workflow_runs.status` re-read before `mark_phase_active` — is the cheaper of the two and makes
   the DB write authoritative for the engine as well as for the surface). This is the single action
   that converts RUN-01 from partial to satisfied.
2. **Record L-01 where VALIDATION.md already claims it is** — the RUN-01 row and STATE.md.
   Orchestrator-owned writes; deliberately not made by this verifier.
3. **Drive the UAT rows**, starting with the reload-mid-run negative row — it now probes two
   distinct landmines (the two-id one and A-1's sub-agent one).
4. WR-04 and A-2/A-3 are small and land inside code this phase wrote; WR-05/WR-08 are cheap
   hardening on the new arm. These are `/gsd:fast`-sized under G-3, not a round.

---

_Verified: 2026-08-16T08:11:49Z at `c74750c3`_
_Verifier: Claude (gsd-verifier) — goal-backward, FORCE stance_
_No `state.*`, `roadmap.update-plan-progress` or `requirements.mark-complete` verb was called; REQUIREMENTS.md, STATE.md and ROADMAP.md are unmodified by this verification._
