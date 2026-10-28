# Phase 293 — deferred items (out of scope, found during execution)

| Found in | Item | Why deferred |
|---|---|---|
| 293-05 Task 2 (live drive) | `DELETE /workflows/{id}` on a draft whose blocked publish left a trial run answered **500** (draft `50f56149…`, 2026-10-25). The cascade route (`DELETE /workflows/{id}/cascade`) removed it. Likely the trial run's row still references the draft. | Pre-existing (draft delete is Phase 103 code); not caused by 293. |
| 293-05 Task 2 (live drive) | A workflow step pinned to another provider's model id is sent to the ACTIVE provider and refused 400 at the publish trial run. | Pre-existing provider routing for workflow steps; recorded as F-4 in `293-VALIDATION.md`. |
| 293-05 Task 2 (live drive), F-2 | The chat thread of a LIVE key-started (or scheduled) run shows no `ThreadRunLine` at all: its live arm needs the browser's own kickoff mark, which an unattended run never has, and its stopped arm needs `cancelled`. So the origin line appears in chat only once such a run is stopped. | **Deferred by the operator, 2026-10-25.** Re-open trigger: the next phase whose `files_modified` names `frontend/src/components/chat/ThreadRunLine.tsx` or `frontend/src/providers/StreamsProvider.tsx`. |

## 293-REVIEW Info findings (deferred by the operator's "fix all" scope: Critical + Warning only, 2026-10-26)

| ID | Item | Re-open trigger |
|---|---|---|
| IN-01 | The file token is consumed (GET+DEL) before the per-key limiter and the live checks, so a 429/503 or a transient error burns a valid link. | The next change to `download_inbound_file` in `backend/app/api/inbound.py`, or a reported "link already used" from an integrator. |
| IN-02 | The settings status sample shows `step_index: 3, step_total: 3` on a `completed` run; the server sends both as `null` unless the run is active. | The next phase whose `files_modified` names `frontend/src/components/settings/apiKeys/curlExamples.ts`. |
| IN-03 | No body-size cap on `POST /inbound/workflows/{id}/runs` (only per-field caps, applied after FastAPI parses the whole body), though the `inbound_inputs.py` docblock says oversize bodies are refused. | The next change to `backend/app/services/inbound_inputs.py` or to request middleware in `backend/app/main.py`. |
| IN-04 | `unattended_launch.launch_unattended_run` fires `asyncio.create_task(_drive_run(...))` without keeping a reference (can be garbage-collected mid-run). | The next change to `backend/app/services/unattended_launch.py`, or any unattended run found stuck `active` with no task. |
| IN-05 | Migration 215's backfill regex `^[0-9a-f-]{36}$` accepts strings that do not cast to `uuid`; one such `_schedule_id` aborts the migration. | Before migration 215 is applied to any environment where it has not run yet (greenfield deploy), or the next migration touching `workflow_runs.origin_*`. |
| IN-06 | Zero-field workflows that read `kickoff_prompt` (e.g. global `literature_review`) read `startable` but a key cannot pass their subject; `create_key` also accepts global workflows the picker never offers. | The next phase whose `files_modified` names `backend/app/api/api_keys.py` or `backend/app/services/inbound_inputs.py`. |
| IN-07 | `check-seeds-register.cjs --require-settled` matches only 3-digit ids (`/^SEED-(\d{3})$/`), so `SEED-1000`+ would read `[unknown-seed]`. | The first seed numbered 1000, or the next change to `scripts/check-seeds-register.cjs`. |
| IN-08 | Revoking an already-revoked key writes another `api_key.revoke` audit row. | The next phase whose `files_modified` names `backend/app/api/api_keys.py` or `backend/app/db/api_keys.py`. |

