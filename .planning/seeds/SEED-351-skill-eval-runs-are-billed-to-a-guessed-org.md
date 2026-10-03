---
seed_id: SEED-351
title: Skill eval runs are born without an org, so a user in two orgs can have eval spend recorded against the wrong one (the mig-106 LIMIT 1 guess)
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Any phase whose files_modified names backend/app/api/evals.py or backend/app/db/runs.py; OR the spend page is used for per-org billing or chargeback; OR a multi-org user reports eval cost under the wrong org."
trigger_paths: ["backend/app/api/evals.py", "backend/app/db/runs.py", "backend/app/services/eval_runner_service.py", "backend/app/db/rates.py"]
trigger_surfaces: ["skills", "admin"]
migration_note:
relates_to: ["v4.4 audit (.planning/milestones/v4.4-MILESTONE-AUDIT.md: 'No insert_run caller outside chat send sets expert_id; eval paths fall to mig-106 LIMIT-1 org guess')", "Phase 268 (METER-08)", "SEED-297", "SEED-328", "docs/history/v4.4-experts-that-actually-work.md", "reference: dev account is in two orgs"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-351: skill eval runs are billed to a guessed org

## The finding

Phase 268 made `insert_run` (`backend/app/db/runs.py:47`) the one place a run's attribution is stamped.
A root run takes `org_id` as passed; `None` falls to the migration-106 trigger, which resolves the owner's
org with `LIMIT 1` (`supabase/migrations/106_org_id_autofill_trigger.sql:29`, `:101`). Its own comment says
that was unambiguous only while each user had one membership ("pre-167").

Measured 2026-10-04, root `insert_run` callers and what they pass:

| Caller | `org_id` | `expert_id` |
|---|---|---|
| chat send (`threads.py` → `run_lifecycle.register_run_start`) | yes | yes (when an Expert is active) |
| harness shell (`harness_engine.py:2812`), golden run (`publish_service.py:1625`) | yes (268-REVIEW WR-06) | `None` by design |
| **skill eval runs (`api/evals.py:331`, `:1932`, `:2643`)** | **not passed** | `None` |

So eval runs depend on the `LIMIT 1` guess. Since v3.4 a user can belong to several orgs (the dev account
does), so the guessed org can be the wrong one. `expert_id = None` on non-chat runs is a decision ("No
Expert"), not a defect; the org is the defect.

## Why it matters

Spend and audit by org is the basis for tiers and any future chargeback. A run recorded against the wrong
org is a quiet billing error and a cross-org data-attribution error.

## When to surface

The next phase that edits `api/evals.py` or `db/runs.py`, or before the spend page is used for billing.

## Scope estimate

Small. Pass the request's active org (`get_active_org_id`, validated `X-Org-Id`) into the three eval
`insert_run` calls, and add a test with a two-org user that asserts the eval run's `org_id`. Consider making
`org_id` required on root `insert_run` so the next caller cannot forget it.

## Breadcrumbs

- `.planning/milestones/v4.4-MILESTONE-AUDIT.md` line 32
- `docs/history/v4.4-...md` (Gaps: "Expert attribution outside chat")
