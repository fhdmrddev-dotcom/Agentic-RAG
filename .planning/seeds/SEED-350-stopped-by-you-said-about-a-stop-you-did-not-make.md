---
seed_id: SEED-350
title: "\"Stopped by you\" is shown for runs an operator killed, a user-disable sweep ended, or a workflow delete cascaded — Phase 194 review WR-04, still open"
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Any phase whose files_modified names runVocabulary.ts, the shared cancel path (_cancel_run_internals in backend/app/services/run_lifecycle.py) or the operator Kill in admin.py; OR a user asks why the app says they stopped a run they did not stop."
trigger_paths: ["frontend/src/components/workflows/runVocabulary.ts", "backend/app/services/run_lifecycle.py", "backend/app/api/runs.py", "backend/app/api/admin.py", "backend/app/api/workflows.py"]
trigger_surfaces: ["workflow", "admin"]
migration_note:
relates_to: ["v3.7 Phase 194 review WR-04 (.planning/milestones/v3.7-phases/194-stop-a-running-workflow/194-REVIEW.md:339)", "SEED-140", "docs/history/v3.7-workflow-product-completion.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-350: "Stopped by you" said about a stop you did not make

## The finding

Phase 194 review WR-04 (2026-08-16): `_cancel_run_internals` (`backend/app/services/run_lifecycle.py`) is shared by three callers that are not the
run's owner: the operator Kill (`backend/app/api/admin.py`), the disable-user sweep that kills a victim's
in-flight runs (`admin.py`), and the workflow delete cascade (`backend/app/api/workflows.py`). Each can
drive a phase to `cancelled`, and the run surface then says:

- `frontend/src/components/workflows/runVocabulary.ts:110` `cancelled: "Stopped by you"`
- `runVocabulary.ts:158` `CLAUSE_STOPPED = "— you ended the run while this step was still working"`

Measured 2026-10-04: both strings unchanged. The v3.7 close listed WR-04 as open; no seed or bug held it.

## Why it matters

Telling a user they stopped a run that an operator killed is a false statement, the exact class Phase 194
was created to remove. It also hides operator action from the person affected.

## When to surface

The next phase that touches the run vocabulary or any cancel caller.

## Scope estimate

Small. Either make the wording agent-neutral (`"Stopped mid-step"`, `"— the run was ended while this step
was still working"`), or record the actor on the run/phase row and render two variants ("Stopped by you" /
"Stopped by an administrator"). The second is better if the operator wants affected users told.

## Breadcrumbs

- `.planning/milestones/v3.7-phases/194-stop-a-running-workflow/194-REVIEW.md` § WR-04
