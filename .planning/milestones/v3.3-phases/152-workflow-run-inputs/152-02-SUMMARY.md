---
phase: 152-workflow-run-inputs
plan: 02
subsystem: workflows-backend
tags: [WFIN-03, delete-cascade, workflows, fk-safe, owner-gate, cancel-first]
requires:
  - workflow_definitions / workflow_runs / workflow_phases FK topology (RESTRICT/CASCADE/SET NULL)
  - run_lifecycle._cancel_run_internals (064 zombie-heal, D-LOCK-05)
  - operator_service.write_operator_audit (best-effort audit seam)
provides:
  - delete_published_workflow_cascade() — FK-safe hard-delete of a workflow (def + all versions + all runs)
  - delete_workflow_cascade_preview() — server-sourced Removed/Kept counts for the victim-naming sheet
  - DELETE /workflows/{definition_id}/cascade — owner-gated cascade endpoint (cancel-first)
  - GET /workflows/{definition_id}/delete-preview — owner-gated preview read
affects:
  - 152-04 (WFIN-03 delete frontend — consumes the preview counts + the cascade endpoint)
tech-stack:
  added: []
  patterns:
    - one-transaction FK-safe cascade (mirror create_workflow_run acquire()→transaction())
    - owner-scoped $N-only SQL, service-role has no RLS backstop → the WHERE is load-bearing
    - 404-collapse on non-owner/unknown (no existence leak)
    - cancel-first in the route/service layer (never inside the db txn)
key-files:
  created:
    - backend/tests/test_152_delete_cascade.py
  modified:
    - backend/app/db/workflows.py
    - backend/app/api/workflows.py
decisions:
  - "D-08/G-5: the cascade endpoint lives in api/workflows.py, NEVER threads.py (verified via scoped git diff)"
  - "D-LOCK-04: hard-delete def+versions+runs; threads detached-but-kept (auto SET NULL); harness_audit kept (A3)"
  - "D-LOCK-05: cancel in-flight runs first via the shared _cancel_run_internals zombie-heal, before the DB delete"
  - "A1: delete-by-slug sweeps ALL versions owned by the caller, not a single version"
  - "No migration: the immutability trigger is BEFORE UPDATE only; the only FK blocker (runs.definition_id RESTRICT) is satisfied by ordering"
  - "Audit receipt via operator_audit_log (the only non-migration audit seam); best-effort, never raises"
metrics:
  duration: ~40m
  completed: 2026-07-14
  tasks: 2
  files_changed: 3
  commits: 3
---

# Phase 152 Plan 02: WFIN-03 Safe Delete Cascade (backend) Summary

Owner-gated, FK-safe workflow hard-delete: a distinct `api/workflows.py` cascade endpoint cancels any in-flight run first (D-LOCK-05), then deletes the definition + all versions + all runs in FK-safe order (runs first — the `ON DELETE RESTRICT` blocker — so phases auto-cascade and thread anchors auto-SET-NULL, leaving threads as normal chats), with a companion server-sourced delete-preview read supplying the exact Removed/Kept counts the victim-naming sheet consumes. No migration.

## What Was Built

**Task 1 — db-layer helpers + live-PG tests (TDD).**
- `delete_published_workflow_cascade(pool, *, slug, user_id) -> dict` in `db/workflows.py`: ONE transaction mirroring `create_workflow_run`'s `acquire()→transaction()` shape. Resolves ALL versions owner-scoped (`WHERE slug=$1 AND created_by=$2` — A1); empty → `{"deleted": False}`. Then `DELETE FROM workflow_runs WHERE definition_id = ANY($1::uuid[])` FIRST (the `ON DELETE RESTRICT` blocker — auto-cascades `workflow_phases`, auto-SET-NULLs `threads.active_workflow_run_id`), then `DELETE FROM workflow_definitions`. Returns `{deleted, name, versions, runs}` (run count parsed from the asyncpg `DELETE <n>` command tag). `harness_audit` untouched (A3 — no FK on `run_id`).
- `delete_workflow_cascade_preview(pool, *, slug, user_id) -> dict`: owner-scoped `{found, name, versions, runs=COUNT(*), threads=COUNT(DISTINCT thread_id)}`; foreign/unknown slug → `{found: False}`.
- `test_152_delete_cascade.py`: 4 live-PG integration tests (against real FKs on local Postgres :54322) — all-versions/no-orphans, cascade owner-gate, preview counts, preview owner-gate. RED first (ImportError), then GREEN.

**Task 2 — routes + cancel-first (`api/workflows.py`, D-08).**
- `DELETE /{definition_id}/cascade` (204, `require_visible("workflow_authoring")`): a DISTINCT route (never overloads the draft `DELETE /{id}` — Pitfall 7). Owner-gate `_owned_slug_or_404` → 404 collapse. Cancel-first loops every in-flight run (`active`/`paused`/`cap_paused`) for the slug's versions through the shared `_cancel_run_internals` (late-imported, admin.py:479 discipline) BEFORE the DB delete. Then `delete_published_workflow_cascade`. Best-effort audit receipt.
- `GET /{definition_id}/delete-preview` (`DeletePreview` model, same owner-gate): server-sourced `{name, versions, runs, threads}` for the sheet (D-LOCK-03).

## Verification

- `venv/Scripts/python -m pytest tests/test_152_delete_cascade.py -x -q` → **4 passed** against LIVE local PG (real FK cascade, not skipped).
- Touched-surface regression: `test_147_workflows_flag` + `test_152_folder_override` + `test_thread_workflow_endpoint` + `test_152_delete_cascade` → **22 passed**.
- `import app.api.workflows` → clean (no import cycle).
- Source review: `DELETE FROM workflow_runs` executes BEFORE `DELETE FROM workflow_definitions`; cancel-first precedes the cascade; owner check maps non-owner → 404; `require_visible("workflow_authoring")` on both new routes; the draft `DELETE /{definition_id}` route unchanged; all params bind `$N` / `ANY($1::uuid[])` (no f-string on user values); `harness_audit` not referenced in the cascade.
- **D-08 red line:** scoped `git diff --name-only 022a5509~1 HEAD` (plan-152-02 commits) = `api/workflows.py`, `db/workflows.py`, `test_152_delete_cascade.py` only — `threads.py` untouched.
- No migration added (immutability trigger is `BEFORE UPDATE` only; FK blocker satisfied by ordering). No packages installed.

## Deviations from Plan

### Auto-fixed Issues
None — plan executed as written.

### Judgment call: audit-receipt seam
The plan's Task 2 prose says to write the audit receipt "via the existing operator/audit write seam." Two audit surfaces exist, and only one is usable without a migration:
- `audit_log` (`write_audit_entry`) — its action enum is CHECK-constrained AND guarded at boot by `assert_action_types_synced`; adding `workflow.delete` would require a migration + a `VALID_ACTION_TYPES` change (this plan forbids migrations).
- `harness_audit` (`write_audit`) — its 22-kind `event_type` CHECK has no delete kind → also migration-bound.
- **`operator_audit_log` (`write_operator_audit`)** — free-text `action`, no CHECK, no boot guard, and it NEVER raises (swallow-on-error). This is the only non-migration seam, so the receipt is written here (action `workflow.delete`, `is_write=True`, `target_type="workflow_definition"`, `metadata={slug, versions, runs}`) under the actor's own id.
- **Nuance:** `operator_audit_log` is conventionally the OPERATOR governance ledger; this records a user self-service delete there. It is a material, irreversible action worth an audit trail and it keeps the 152-04 "recorded with your name" copy honest. If the operator ledger must stay operator-only, a future dedicated user-action audit table (a migration) would relocate it. Because the write NEVER raises, the delete's 204 can never regress on an audit failure.

## Authentication Gates
None.

## Known Stubs
None — both helpers and routes are fully wired to real data (live-PG verified).

## Threat Flags
None beyond the plan's `<threat_model>` (T-152-02-01..05). The two new routes are owner-gated with 404-collapse; the delete runs as service role with the app-layer `created_by` WHERE as the sole boundary (mitigated). No new un-modeled surface.

## Notes for Downstream / Operator
- **WFIN-03 stays OPEN at the requirement level** (false-green avoidance, 148–151 convention) — closes at verify-work/secure-phase after the live SC#10 4-axis UAT (`152-VALIDATION.md`) and the T-152-02-* threat close.
- **Operator: restart uvicorn** to load the two new routes before UAT.
- 152-04 (delete frontend) consumes `GET /workflows/{id}/delete-preview` (counts) + `DELETE /workflows/{id}/cascade`.

## Self-Check: PASSED
- Files exist: `backend/app/db/workflows.py`, `backend/app/api/workflows.py`, `backend/tests/test_152_delete_cascade.py` — all FOUND.
- Commits exist: `022a5509` (test/RED), `7b3ff3cd` (feat/GREEN), `b8d73267` (feat/route) — all FOUND.
