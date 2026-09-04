---
id: BUG-260826-06
title: Schedules can be created and listed on an install where the scheduler is disabled, with no indication they will never fire
reported: 2026-08-26
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/scheduler, backend/api, frontend/workflows, deployment/config]
folded_into: 210
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 386b5a4
  date: 2026-08-26
---

# BUG-260826-06: A schedule created on an install with the scheduler off is a silent no-op

## What we observed

A schedule was created successfully in production (`POST /workflows/{id}/schedules` → 201) and
then made due directly in the database:

```sql
UPDATE workflow_schedules SET is_active = true, next_run_at = now() WHERE id = '75886bcb-…';
```

Well past the 60s poll interval, the row was unchanged:

| column | value |
|---|---|
| `is_active` | `true` |
| `next_run_at` | `2026-08-26 07:24:54+00` — still the moment of the UPDATE, never advanced |
| `last_run_at` | `null` |
| `last_status` | `null` |

Nothing had claimed it. The cause is configuration, not code:

```python
scheduler_process_enabled: bool = False        # backend/app/config.py:1139
```

and the shipped deployment example carries `SCHEDULER_PROCESS_ENABLED=false`
(`deploy/onebox.env.example:74`, `backend/.env.example:84`). `main.py:517` only constructs and
starts `SchedulerService` when that flag is true, so on a default install the tick loop does not
exist.

The off-by-default choice is itself deliberate and defensible — *"a box that has never been told
to schedule anything boots byte-identically to before this phase"* (`main.py:501-503`). **The
defect is that nothing else in the system knows about the flag.** `POST /workflows/{id}/schedules`
accepts and persists the row, `GET` lists it, the Schedule modal offers the feature, and
`next_run_at` is computed and displayed — all describing a future that will never happen.

## Why it matters

Major, and quietly so. A user sets up an automation, sees it accepted with a plausible next-run
time, and receives nothing. There is no error, no badge, no empty-state warning — the only way to
discover it is to notice the absence of runs and then read a backend boot log for the line
`Workflow scheduler started (poll every %ds, max %d claims/tick)`.

It also silently removes the workaround for BUG-260826-01: on this install the scheduled path is
the *only* launcher that can carry per-run arguments to a `send_email` step, and it does not run.
The manual `POST /schedules/{id}/trigger` route still works, because it launches in-process rather
than through the poller — which is what makes the failure so easy to misdiagnose: the same schedule
row fires perfectly by hand and never fires on its own.

## Hypothesized cause

Not a hypothesis in its mechanics — the flag is read at `main.py:517` and defaults false. What is
open is **why the API surface was never made aware of it**. Most likely simply that Phase 204
scoped the flag to process startup, and the CRUD/UI half was written against the assumption that a
persisted schedule implies a running scheduler.

## Surface classification

`Agentic-RAG` — this app's automations surface plus its deployment configuration.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** small; pair with BUG-260826-03 as one scheduler-honesty change
- **Plant as seed:** n/a
- **External — note only:** no

Candidate shapes, cheapest first — the first is probably enough:

1. **Tell the truth in the API and the UI.** Expose the effective flag (an existing health/settings
   read is fine) and have the schedules list and Schedule modal say plainly that automations are
   not running on this install. Follows the existing tri-state honesty discipline — *"we have not
   asked yet" / "there are none" / "we could not ask"* are different facts and a surface that
   collapses them lies about at least one.
2. **Refuse at creation** when the scheduler is disabled — a worded 4xx rather than a row that
   cannot fire. Sharper, but it also blocks the legitimate "configure now, enable at deploy" order.
3. **Decide whether production should have it on at all.** If automations are a shipped feature,
   `SCHEDULER_PROCESS_ENABLED=true` belongs in the deploy artifacts and in the parity checklist;
   if they are opt-in, that needs saying somewhere an operator will read.

Whichever is chosen, note the deployment-artifact parity rule: a change to an env var the app reads
must update `deploy/onebox.env.example`, `docs/OPERATOR.md` and friends in the **same commit**
(enforced by `scripts/check-deploy-drift.sh`).

## Workarounds (prompt-side, code-side, or UI-side)

Trigger the schedule by hand — this path launches in-process and does not need the poller:

```
POST /schedules/{schedule_id}/trigger    → {launched: true, workflow_run_id: "…"}
```

It deliberately does not advance `next_run_at` (*"show me what this does"*, not *"consider this
cadence satisfied"*) and does not consult `is_active`.

Or set `SCHEDULER_PROCESS_ENABLED=true` in the Coolify backend environment and restart. Confirm at
boot with the log line `Workflow scheduler started (poll every 60s, max 10 claims/tick)`.

## Reference / evidence links

- `backend/app/config.py:1139` — `scheduler_process_enabled: bool = False`
- `backend/app/main.py:500-537` — the gated startup and its stated rationale
- `deploy/onebox.env.example:70-76`, `backend/.env.example:78-90` — shipped `false`
- `backend/app/db/schedules.py:263-330` — `claim_due_schedules`, the loop that never runs here
- `backend/app/api/schedules.py:88-136` — creation, which knows nothing about the flag
- Observed on schedule `75886bcb-ae3c-4d65-a158-739119cffb80`, 2026-08-26

---

## Phase 210 disposition (2026-08-26) — FOLDED, not closed

Code shipped (banner + `scheduler_process_enabled` on `GET /features`). **UAT could not be driven:** the schedule door is a menu item gated on `provenance === "published"` (`WorkflowCard.tsx:1426`) and this install has **no published-provenance workflow** (`Yours 0`), so the door never appears. Closes after one driven save on an install where the scheduler is off.
