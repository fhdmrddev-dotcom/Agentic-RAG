---
seed_id: SEED-341
title: Automatic folder sync and scheduled workflows ship switched OFF, and turning them on is an env-file edit plus a restart, not an operator control
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Any phase whose files_modified names backend/app/config.py's watch/scheduler block, main.py's lifespan, deploy/onebox.env.example or the Control Room; OR the next deploy/install milestone (SEED-003); OR a customer or demo reports that a watched folder never synced or a schedule never ran."
trigger_paths: ["backend/app/main.py", "backend/app/services/watch_service.py", "backend/app/services/scheduler_service.py", "deploy/onebox.env.example", "docker-compose.prod.yml", "frontend/src/components/admin/MaintenancePanel.tsx", "frontend/src/components/admin/ControlRoomPage.tsx"]
trigger_surfaces: ["admin", "connectors", "workflow", "deployment"]
migration_note:
relates_to: ["SEED-003", "SEED-078", "BUG-260826-06 (a schedule created with the scheduler off is a silent no-op; folded into 210)", "Phase 234 (watch loop)", "Phase 204 (scheduler)", "docs/history/v4.0-connected-knowledge.md", "docs/history/v4.2-the-connected-knowledge-you-can-actually-run.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-341: automatic sync and schedules ship switched off

## The finding

Two headline features run in background loops, and both loops are off unless an operator edits an env
file and restarts the backend:

| Loop | Flag | Default | Where |
|---|---|---|---|
| Watched cloud folders sync (v4.0, Phase 234) | `WATCH_PROCESS_ENABLED` | `false` | `backend/app/config.py:1412`; `deploy/onebox.env.example:267`; `docker-compose.prod.yml:103` |
| Scheduled workflows (v3.8, Phase 204) | `SCHEDULER_PROCESS_ENABLED` | `false` | `config.py:1359`; `onebox.env.example:74`; `docker-compose.prod.yml:72` |

The reason is written down and sound: both loops make outbound calls on their own (`config.py:1409-1411`,
*"must be explicitly enabled by the operator"*). The UI is honest when the watch reader is off: it shows
"waiting — the reader is off" (`models/source.py:186-194`, D-235-12/21).

What is missing is a decision and a control:
- A fresh install offers "watch this folder" and "run on a schedule" and then does neither.
- The only way to turn them on is an env var plus a restart. `CLAUDE.md` says settings belong in
  `app_settings` / the Settings UI and env vars are for secrets and infra only. Whether a loop runs on a
  given process is infra; whether automatic sync is allowed for this install is a product setting.

## Why it matters

A user who sets up a watch and sees "waiting" forever does not know an operator has to edit a file.
The demo of "the library reads by itself" fails on any new install. Production state is not verified here.

## When to surface

The next phase that touches the loop wiring, the deploy artifacts or the Control Room; or the first
report that a watch never synced or a schedule never ran.

## Scope estimate

Small to Medium, mostly a decision:
1. Decide the default per deployment preset (one-box single user: on? multi-tenant: off until approved?).
2. Keep the env var as the process-level switch (which process runs the loop). Add an operator kill switch
   in the Control Room, next to the existing kill-switch grid, that pauses or allows the loop without a
   restart.
3. When the loop is off, let the user-facing surfaces say who can turn it on, not just that it is off.
Deployment-artifact parity rule applies (same commit for env example, OPERATOR.md, compose).

## Breadcrumbs

- `docs/history/v4.0-connected-knowledge.md` (status row "Scheduled watch loop: built, but off by default")
- `docs/history/v4.2-...md` (Gaps: "Today the background watch process still ships disabled by default")
- `docs/OPERATOR.md:159` (the documented flag)
