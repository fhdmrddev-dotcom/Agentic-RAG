---
seed_id: SEED-311
title: Tier-gate refusals that still give a false reason — cross-org run-now, header-less kickoff, scheduler DB blip
created: 2026-09-24
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching entitlement_service.py, workflow_kickoff.py, scheduler_service.py, api/schedules.py, or adding a new tier-gated door.
trigger_paths: ["backend/app/services/entitlement_service.py", "backend/app/services/workflow_kickoff.py", "backend/app/services/scheduler_service.py", "backend/app/api/schedules.py"]
trigger_surfaces: [workflow, admin]
migration_note:
relates_to: ["258", R265-audit-fixes-04, R265-audit-fixes-07, R265-audit-fixes-12]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-311: Tier refusal honesty residuals

## The finding

- R265-audit-fixes-04: Run-now checks two different orgs. The dependency checks the caller's ACTIVE org, and `launch_scheduled_run` checks the SCHEDULE's org. When they differ, the user is told the schedule was "deleted, or no longer yours".
- R265-audit-fixes-07: a kickoff sent without `X-Org-Id` resolves `None` via `resolve_active_org_or_none`. `enforce_entitlement(None)` then refuses with a false upgrade message.
- R265-audit-fixes-12 (PLAUSIBLE): the scheduler calls `check_entitlement` directly. A DB blip is logged as "not entitled", and the firing is skipped as `launch_failed` after `next_run_at` has already advanced.

The UI half, where doors print a bare status code, is R265-audit-fixes-05 / UAT-265-258-b and UAT-265-258-c. 265-TRIAGE.md handles those as single-file fixes, not here.

## Why it matters

TIER-03 requires refusals to name the plan truthfully. A false "upgrade" or "deleted" reason is worse than a bare status code.

## When to surface

See `trigger_when`.

## Scope estimate

Small to Medium. There are three backend sites, and each one changes an org-resolution path or an error path. That is why each falls outside D-04.

## Breadcrumbs

265-REVIEW-audit-fixes.md.
