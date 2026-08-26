---
id: BUG-260826-03
title: POST /schedules/{id}/trigger 500s — the launcher parses the definition without the str guard every other caller has (org_id was a refuted first hypothesis)
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

# BUG-260826-03: Manual schedule trigger 500s, and the browser reports it as CORS

## ⚠ CORRECTION 2026-08-26 — THE FIRST HYPOTHESIS WAS REFUTED BY MEASUREMENT

The original diagnosis below (NULL `org_id`) is **kept rather than deleted**, because the refutation
is the finding. After `org_id` was confirmed POPULATED on the live row
(`747c6210-4ade-4e0d-8507-c810e3e3f4af`), **the trigger 500'd again, identically**. So the org was
never the cause of the observed failure.

**The measured asymmetry, and the current primary hypothesis:**

| caller | how it parses `definition` |
|---|---|
| publish (`publish_service.py:140-148`) | `isinstance(raw, str)` → `json.loads`, THEN `model_validate` inside a `try` that returns a structured `definition_invalid` block — never a 500 |
| scheduled launch (`scheduler_service.py:107`) | `WorkflowDefinition.model_validate(row["definition"])` — **bare: no str guard, no try** |

`workflow_definitions.definition` is a jsonb **STRING SCALAR on 261 of 291 rows** — the measured,
recorded, deliberately-left double-encoding defect (`db/workflows.py:388-435`). For any such row the
pool codec hands back a Python `str`, `model_validate` raises, and the route 500s with no handler.

This explains the otherwise-odd fact that **the same workflow published successfully and cannot be
launched by schedule**: publish decodes the string, the scheduler does not. `get_definition`'s own
docstring asserts *"asyncpg's pool codec decodes it to a dict"* (`db/workflows.py:826`) — which is
true only for the ~30 rows written in the correct shape, and is what makes the bare call look safe.

⚠ **This also means the recorded string-scalar defect is NOT inert.** It has been carried as a
cosmetic/́query-shape problem with a re-open trigger; here it takes out an entire launch path. That
raises its priority independently of this report.

**Confirm with:** `SELECT jsonb_typeof(definition) FROM workflow_definitions WHERE id = '<workflow id>'`
— observed workflow `ee53ed2c-2040-4daf-828c-4196b8730037`. Pending at time of writing; the
Coolify traceback is the definitive check.

**Consequence for the fix list:** item 2 below (handle the failure honestly) is now the PRIMARY fix
and should be a `str`-guard mirroring publish's, not merely an exception handler. Items 1 and 3 stay
worth doing — a NULL `org_id` really would 500 the same way, it just was not what happened here.

⚠ **The poller hits the identical line.** `SchedulerService.tick` catches per-tick (*"a failed tick
never ends the loop"*), so on an install where the scheduler IS running this presents as schedules
that silently never fire, with an exception in the log and no user-visible signal — see
BUG-260826-06.

---

## What we observed (original, first hypothesis)

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
