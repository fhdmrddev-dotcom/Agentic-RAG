---
id: BUG-260826-03
title: POST /schedules/{id}/trigger returns an unhandled 500 when the schedule's org_id is NULL
reported: 2026-08-26
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/scheduler, backend/api, backend/automations]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 386b5a4
  date: 2026-08-26
---

# BUG-260826-03: Manual schedule trigger 500s on a NULL org_id, and the browser reports it as CORS

## What we observed

Creating a schedule succeeded (`POST /workflows/{id}/schedules` → 201, row
`75886bcb-ae3c-4d65-a158-739119cffb80`). Triggering it immediately failed:

```
POST https://api.superrag.cloud/schedules/75886bcb-.../trigger  net::ERR_FAILED 500
Access to fetch ... blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

Two distinct problems, one visible symptom:

1. **The 500.** `launch_scheduled_run` calls `get_service_role_supabase(schedule.get("org_id"))`
   (`scheduler_service.py:117-118`), and that factory raises outright on a falsy org:
   `ValueError("get_service_role_supabase requires an explicit org_id")` (`dependencies.py:228`).
   `org_id` is not bound at insert time — a DB trigger fills it
   (`autofill_org_id_by_owner('user_id')`, `124_workflow_schedules.sql:173`), which resolves the
   org from the owner's membership. When that resolves to nothing, every trigger of that schedule
   500s permanently.
2. **The misleading CORS message.** An unhandled 500 bypasses the CORS middleware, so no
   `Access-Control-Allow-Origin` header is attached and the browser blames CORS. This sends the
   reader to look at origin configuration, which is fine, instead of at the server exception.

The same code path runs in the background poller, where the failure is caught per-row
(`record_schedule_outcome` / `launch_failed`) and one broken schedule does not stop the tick — so
this is loudest on the manual-trigger route.

## Why it matters

Major. It makes the only launcher that can carry per-run arguments (see BUG-260826-01) fail with a
message pointing at the wrong subsystem. A schedule created through the API in the ordinary way can
land un-triggerable, with no UI feedback and no server-side validation at creation time.

The CORS misdirection is the expensive half: it costs a debugging session before anyone thinks to
read the backend log.

## Hypothesized cause

**Partly verified, partly hypothesis.** Verified: the factory raises on falsy `org_id`, and the
route does not catch it. Hypothesis: the observed NULL came from the autofill trigger finding no
membership row for the owner — not confirmed against the live row at time of writing.

## Surface classification

`Agentic-RAG`.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** small backend hardening phase
- **Plant as seed:** n/a
- **External — note only:** no

Three separable fixes:

1. **Refuse at creation, not at launch.** `POST /workflows/{id}/schedules` should resolve and
   persist the org explicitly (the definition being scheduled always has one — publish refuses a
   falsy org at stage 2.6), or 4xx if it cannot, rather than writing a row that can never fire.
2. **Handle the launch failure honestly.** The trigger route should return a worded 4xx/5xx JSON
   body, never an unhandled exception — matching `ScheduleTriggerResult(launched=False, detail=…)`,
   which the route already returns for the "workflow could not be loaded" case.
3. **Ensure error responses carry CORS headers**, so a 500 reads as a 500 in the browser.

## Workarounds (prompt-side, code-side, or UI-side)

Backfill the org from the workflow definition, then re-trigger:

```sql
UPDATE workflow_schedules s
SET org_id = d.org_id
FROM workflow_definitions d
WHERE s.id = '<schedule id>' AND d.id = s.workflow_id;
```

Or let the poller fire it instead of the trigger route:

```sql
UPDATE workflow_schedules
SET is_active = true, next_run_at = now()
WHERE id = '<schedule id>';
```

The poller claims `is_active AND next_run_at IS NOT NULL AND next_run_at <= now()` and ticks every
60s (`scheduler_poll_interval_seconds`); the claim advances `next_run_at` inside the same
transaction, so it fires exactly once.

## Reference / evidence links

- `backend/app/services/scheduler_service.py:96-140` — `launch_scheduled_run`
- `backend/app/dependencies.py:219-230` — the refuse-without-org factory
- `backend/app/api/schedules.py:227-265` — the trigger route
- `backend/app/db/schedules.py:47-50, 121-132, 263-330` — claim columns, launch read, claim predicate
- `supabase/migrations/124_workflow_schedules.sql:173` — the autofill trigger
