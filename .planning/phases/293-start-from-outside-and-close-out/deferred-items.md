# Phase 293 — deferred items (out of scope, found during execution)

| Found in | Item | Why deferred |
|---|---|---|
| 293-05 Task 2 (live drive) | `DELETE /workflows/{id}` on a draft whose blocked publish left a trial run answered **500** (draft `50f56149…`, 2026-10-25). The cascade route (`DELETE /workflows/{id}/cascade`) removed it. Likely the trial run's row still references the draft. | Pre-existing (draft delete is Phase 103 code); not caused by 293. |
| 293-05 Task 2 (live drive) | A workflow step pinned to another provider's model id is sent to the ACTIVE provider and refused 400 at the publish trial run. | Pre-existing provider routing for workflow steps; recorded as F-4 in `293-VALIDATION.md`. |
