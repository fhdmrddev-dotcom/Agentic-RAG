---
id: BUG-260815-07
title: Deleting a workflow fails with an error — the three known refusal conditions were all ruled out, so the cause is unknown
reported: 2026-08-15
surface: Agentic-RAG
severity: major
status: open
affected_areas: [workflows/library, backend/api/workflows, frontend/workflows]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
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
