---
id: BUG-260815-07
title: Deleting a workflow fails with an error — the three known refusal conditions were all ruled out, so the cause is unknown
reported: 2026-08-15
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [workflows/library, backend/api/workflows, frontend/workflows]
folded_into: 194
verified_closed_by: null
related_seeds: []
re_open_trigger: "⚠ ONLY THE REPRODUCIBLE HALF IS FOLDED. Phase 194 (D-09/D-12) claims the stuck-active-runs clause — the two workflow_runs rows active since 2026-06-14 and 2026-08-01 that are a permanent delete blocker — because that is measurably the same gap as RUN-01's zombie arm: run_lifecycle._cancel_run_internals Step 3b heals only the runs row, never workflow_runs, so with WORKER_COUNT=2 and a per-process RUN_TASKS a Stop landing on the wrong worker wedges the thread forever. THE ONE-OFF DELETE FAILURE ITSELF IS NOT CLAIMED AND STAYS OPEN — it was explicitly recorded as NOT reproducible, and folding this report must not be read as closing that clause. Re-open the unclaimed half on a second sighting of a delete failure whose three known refusal conditions are all ruled out. ⚠ CORRECTED AT /gsd:execute-phase 194 (plan 194-05, 2026-08-16), BESIDE the original wording above and never over it: the clause 'a permanent delete blocker' IS MEASURABLY FALSE and the original is kept visible because it is what was believed when this report was folded. delete_workflow_cascade (backend/app/api/workflows.py:1483-1518) cancel-firsts AND then calls finish_run(pool, r['wf_id'], 'cancelled') UNCONDITIONALLY for every in-flight row — the call sits OUTSIDE the `if r['producer_id'] is not None:` guard, so a run with no live producer (which is exactly what these two are) is terminalized anyway; and the 409 shared-workflow guard (count_foreign_runs_on_global, :1462) cannot fire either, because both definitions are is_system_global = False with zero foreign runs. ⚠ THE CORRECTION DOES NOT DE-SCOPE THE HEAL AND MUST NOT BE READ AS DOING SO — the rows were still healed in 194-13, on four honest reasons recorded in 194-HEAL-RECEIPT.md: they LIE about being live to every surface that reads run status, two threads were still holding active_workflow_run_id anchors (which wedges those threads), one is an abandoned is_golden_run permanently unresumable since Phase 190's A4 gate, and leaving a known-stuck row unhealed while shipping the fix that prevents new ones is the exact inconsistency RUN-01 exists to remove. ⚠ THE FOLDED HALF IS THE MECHANISM, NOT THE DELETE: 194-09 Task 1 makes _cancel_run_internals Step 3b co-write workflow_runs + the anchor clear so no NEW row can get stuck this way; 194-13 Task 2 healed the existing five. THE NON-REPRODUCIBLE DELETE FAILURE ITSELF IS UNTOUCHED BY ALL OF THIS AND STAYS OPEN, on the trigger stated above."
reproduces_on:
  branch: develop
  commit: d3a74202
  date: 2026-08-15
---

# BUG-260815-07: a workflow cannot be deleted

## What we observed

During Phase 193.2's operator UAT the operator reported: *"I cannot delete workflow… I see an error
message that cannot delete."* The exact error text was not captured.

## What has already been RULED OUT — do not re-check these

Measured against the live local DB, 2026-08-15:

| Candidate cause | Result |
|---|---|
| Phase 148 visibility gate (`require_visible("workflow_authoring")`, on all 11 authoring routes incl. `DELETE /{id}/cascade` at `workflows.py:1424`) | **NOT it.** `app_settings.feature_visibility.workflow_authoring` = `{"roles": [], "groups": [], "audience": "everyone"}`. The gate is a documented no-op for an `everyone` audience. |
| The `409` shared-workflow guard (`count_foreign_runs_on_global`, `workflows.py:1459-1470`) | **NOT it.** The operator owns **0** `is_system_global` definitions, and **0** of their definitions carry runs by another user. |
| The owner-gate `404` (`_owned_slug_or_404`) | **Unlikely** — the operator owns 29 published + 80 draft definitions under `d8a54002…`. |

⚠ **`harness_audit` contains ZERO delete-related rows in the 90 minutes around the attempt**, so the
request appears not to have reached the audit write at the end of the cascade — consistent with a
failure *before* step 4, or with the request never reaching the endpoint at all.

## ⚠ NOT REPRODUCIBLE — and that makes it worse, not better (2026-08-15, same session)

The operator retried shortly afterwards: **deleting a published workflow AND deleting a draft both
succeeded.** Their words: *"I don't know what happened at that time."*

**This report stays `open` and stays `major`.** An intermittent delete failure is harder to trust
than a consistent one — "it works now" is how this gets closed and then bites during a demo. What
changed between the failing and succeeding attempts is not known.

**Timing, for whoever picks this up:** the failure happened while authoring, roughly `14:01`–`14:13`
— the same window in which three golden runs failed because the OpenAI balance was exhausted
(`BUG-260815-05`), and in which the operator added credits. **Delete does not call OpenAI**, so a
direct link is unlikely; but a backend restart around the credit top-up would explain a transient
failure on any request, and is the cheapest hypothesis to hold.

## ⚠ ADJACENT FINDING — two runs stuck `active` for weeks (this one IS reproducible)

Measured across the whole local DB:

| run id | status | created |
|---|---|---|
| `4b0feda7-c524-4a18-8ea0-4c6fc9705868` | `active` | **2026-08-01** |
| `fde3bbe3-02c2-4664-902f-921411bb1fe7` | `active` | **2026-06-14** |

No worker will ever finish these. **They are a genuine, permanent delete blocker for their own
workflows**, because `delete_workflow_cascade` cancels every in-flight run for the slug *before* the
DB delete (D-LOCK-05) — a run that cannot be cancelled cleanly stalls the cascade. They are also
presumably rendering as live runs on any surface that reads run status.

### ⚠ CORRECTED (Phase 194, plan 194-05, 2026-08-16) — the delete-blocker claim is FALSE

**The paragraph above is the ORIGINAL and is kept verbatim, because it is what this report was
folded on. Measured at HEAD, its central claim does not hold: these two rows are NOT a delete
blocker, permanent or otherwise.**

| Claim | Measured |
|---|---|
| *"a run that cannot be cancelled cleanly stalls the cascade"* | **FALSE.** `delete_workflow_cascade` (`backend/app/api/workflows.py:1483-1518`) selects every in-flight row via a `LEFT JOIN` to `runs`, cancels the producer **only when one exists** (`if r["producer_id"] is not None:`), and then calls `await finish_run(pool, r["wf_id"], "cancelled")` **UNCONDITIONALLY, outside that guard** (`:1518`). A row with `producer_id IS NULL` — which is exactly what both of these are — is terminalized anyway. Nothing stalls. |
| the `409` shared-workflow guard as a second blocker | **Cannot fire.** `count_foreign_runs_on_global` (`:1462`) needs an `is_system_global` definition with runs by another user; both definitions are `is_system_global = False` with **zero** foreign runs. This was already ruled out in the table above for the *reported* failure and is re-stated here because it also rules it out for *these two rows*. |

**⚠ This correction does NOT de-scope the heal, and reading it that way would be the wrong
conclusion.** The two rows were healed in plan `194-13` on four reasons that survive the
correction, recorded in `194-HEAL-RECEIPT.md`:

1. They **lie about being live** to every surface that reads run status — the honesty failure
   RUN-01 exists to remove.
2. Two threads were still holding an `active_workflow_run_id` **anchor**, which is what actually
   wedges a thread (a Deep chat on an anchored thread stays harness-locked).
3. One (`4b0feda7`) is an abandoned `is_golden_run`, **permanently unresumable** since Phase 190's
   A4 gate excluded golden runs from `find_resumable_runs`. Nothing will ever finish it.
4. Shipping the fix that prevents NEW stuck rows while leaving the known ones stuck is precisely
   the inconsistency this phase exists to remove.

**⚠ What Phase 194 actually claims here is the MECHANISM, not the delete.** `194-09` Task 1 makes
`_cancel_run_internals` Step 3b co-write `workflow_runs.status` **and** the anchor clear through
`finish_run`, so a Stop landing on the wrong worker (`WORKER_COUNT=2`, per-process `RUN_TASKS`) can
no longer wedge a thread. `194-13` Task 2 healed the five existing rows with a committed
before/after receipt naming the instrument **per row**.

**⚠ THE NON-REPRODUCIBLE DELETE FAILURE IS UNTOUCHED BY ANY OF THIS AND STAYS OPEN.** Its section
above is unedited and its trigger — *a second sighting of a delete failure whose three known refusal
conditions are all ruled out* — is unchanged. Nothing in this correction, and nothing in Phase 194,
explains the original error the operator saw.

⚠ **This is NOT the operator's failure** — their drafts from the `14:01`–`14:13` window are all
`failed`, not stuck. It is a separate defect found while investigating, and it is the one with a
reproducible cause. **Whoever fixes deletion should handle "cancel a run that no worker owns"
explicitly**, and the Control Room's active-runs-with-Kill surface (Phase 146-148) is where an
operator should be able to clear them.

## What is still needed

**The exact error text, and which workflow.** Then the next check is whether the failure is:

1. **Client-side** — the delete flow is preview-then-confirm (`GET .../delete-preview` at
   `workflows.py:1396`, then `DELETE .../cascade` at `:1421`); a failing *preview* would surface as
   "cannot delete" without any cascade being attempted. `WorkflowDeleteSheet.tsx` owns this UI (moved
   verbatim into `components/workflows/library/` by Phase 192).
2. **`delete_draft` vs `delete_workflow_cascade`** — two different routes (`:1315` and `:1421`) with
   different preconditions. Which one the UI calls depends on published-vs-draft, and the operator
   did not say which kind of row they tried.
3. **Server-side after the guards** — the cascade cancels in-flight runs first (D-LOCK-05); a row
   with a stuck `active`/`paused` run could fail there.

## Why it matters

Severity `major`: there is no other way to remove a workflow. The operator's library is at **112
rows** (3 starters + 29 published + 80 drafts), much of it accumulated test data from UAT sessions,
and it cannot be cleaned up. This compounds `BUG-260815-02`'s findability problem — a library that
only ever grows.

## Related

- `BUG-260815-08` — Workflows-page header/layout issues reported in the same breath
- `BUG-260815-02` — library findability; an un-deletable library makes it worse
