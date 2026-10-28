---
seed_id: SEED-395
title: A run-start folder override may name the owner's folder in another organization
created: 2026-10-28
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase whose files_modified names harness/scope.py or run_producer.py, or that changes how a run-start folder_id override is accepted.
trigger_paths: ["backend/app/services/harness/scope.py", "backend/app/services/run_producer.py"]
trigger_surfaces: ["workflow", "retrieval"]
migration_note:
relates_to: ["backend/app/services/harness/scope.py", "backend/app/services/foreign_folder_refusal.py", "298-02", "298-03", "295-10", "D-13", "D-34"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-395: A run-start folder override may name the owner's folder in another organization

## The finding

`resolve_run_scope_root` (`backend/app/services/harness/scope.py:191`) layers a per-run override,
`run_inputs["folder_id"]`, above the definition's `project_folder_id`. The override passes its D-05
owner gate when it is in `fetch_visible_folders(owner)`, the owner's **unrestricted** visible set.
That set includes the owner's own folders in **every** org they belong to.

Phase 298 (plan 298-02, `foreign_folder_refusal.py`) refuses a workflow whose **definition** binds
a folder outside the definition's org, at save and at every launch door (D-13, D-34). The run-start
override is not part of the definition, so it is outside that rule. A two-org owner could start a
run of an org-A workflow that retrieves from their own org-B folder. The 295-10 ledger note
(`folder_utils.py`) recorded this as inherited, and 298-CONTEXT.md `<deferred>` lists it as a
candidate seed.

## Why it matters

The person can see the data, so it is their own folder and nothing leaks to anyone else. The cost
is consistency: the run's output and receipts land in org A, while its knowledge came from org B.
That is exactly what ORG-05 refuses for a bound folder. The 298 audit measured 0 multi-org users
in the cloud, so nobody is affected yet.

## When to surface

Any phase whose `files_modified` names `backend/app/services/harness/scope.py` or
`backend/app/services/run_producer.py`, or that changes how a run-start `folder_id` override is
accepted.

## Scope estimate

Small. One check in `resolve_run_scope_root`: pass the definition's org as `restrict_org_ids`
when it is known (never `set()`, T-298-12), or drop an override whose folder org differs. The
override gate already falls back to the author default, so a dropped override changes nothing
else.

## Breadcrumbs

- 298-CONTEXT.md `<deferred>`: "Per-run folder override at run start may name the owner's folder in
  another org (`resolve_run_scope_root`, inherited, 295-10 ledger note) — left; candidate seed."
- `docs/HOT-FILE-LEDGER.md` → `backend/app/utils/folder_utils.py` (295-10 polarity invariants).
- `foreign_folder_refusal.py` docstring: "THE DEFINITION'S ORG ALWAYS COMES FROM THE ROW".
