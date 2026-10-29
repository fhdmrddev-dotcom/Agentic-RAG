---
phase: 300-told-when-a-run-waits-backend-and-mailer
plan: 02
subsystem: database
tags: [migration, triggers, rls, outbox, security, mutates-local-db]
requires:
  - workflow_runs.org_id (Phase 299, D-10)
  - the harness ask_user_prompt / ask_user_response message rows (engine_ask.py, human_input.py, api/runs.py, harness_engine.py)
provides:
  - public.notifications (one open notice per recipient + run; recipient-only SELECT)
  - public.notification_deliveries (the outbox; deny-all to clients)
  - public.notify_on_ask_row() + trigger messages_notify_on_ask
  - public.notify_on_run_status() + trigger workflow_runs_notify_on_status (incl. the D-26 'waiting' schedule follow-up)
  - app_settings.notification_email_delay_seconds / email_from_address / email_from_name / email_dev_redirect_address
  - org_invitations.email_delivery / email_failed_at / email_failure
affects: [300-03, 300-04, 300-05, 301]
tech-stack:
  added: []
  patterns:
    - "fail-soft trigger: whole body in an inner exception block that RAISEs WARNING and returns NULL"
    - "ON CONFLICT (recipient_id, run_id) WHERE closed_at IS NULL — predicate identical to the partial unique index"
key-files:
  created:
    - supabase/migrations/218_run_waiting_notifications.sql
    - backend/tests/unit/test_300_migration_218_shape.py
    - backend/tests/integration/test_300_notice_triggers_live.py
    - backend/tests/integration/test_300_rls_anon_live.py
  modified:
    - supabase/full-schema.sql
    - scripts/full-schema-supplement.sql
decisions:
  - "The delivery due_at is the notice's own created_at + the delay (not the trigger's now()), so a re-ask never moves it"
  - "The status trigger checks the schedule is 'waiting' BEFORE the NOT EXISTS newer-run scan, so the unindexed inputs->>'_schedule_id' scan only runs for a waiting schedule"
  - "218's table + function privileges are mirrored into scripts/full-schema-supplement.sql (pg_dump runs --no-privileges)"
metrics:
  duration: ~25 min
  completed: 2026-10-29
  tasks: 2
  files: 6
---

# Phase 300 Plan 02: Run-waiting notices — migration 218 Summary

Migration 218 adds the notices table (one open notice per recipient and run) and a delivery outbox
that clients cannot touch. Two fail-soft definer-rights triggers write and close notices from the ask
message rows and from the run status. The notice's recipient and org are read from `workflow_runs`,
never from `messages.org_id`. The migration is applied to the local DB only, and live tests prove the
triggers, the RLS posture and the anon wall.

## What was built

- **`public.notifications`**: one row per wait. The partial unique index
  `notifications_one_open_per_recipient_run (recipient_id, run_id) WHERE closed_at IS NULL` keeps one
  open notice per recipient and run. A re-ask updates `tool_call_id`/`kind` and keeps `created_at` and
  the single delivery (D-01). There is one policy, `"Recipients read their own notices"`
  (`FOR SELECT TO authenticated USING (recipient_id = (SELECT auth.uid()))`). No write policy, no route (D-29).
- **`public.notification_deliveries`**: `notification_id UNIQUE` (one delivery per notice, D-20), the
  full status set, attempts, `due_at`/`claimed_at`, and the frozen payload columns (D-31). RLS is on
  with no policy, so it is deny-all to every client role (D-19). A `set_updated_at` BEFORE UPDATE trigger
  keeps `updated_at` correct.
- **`notify_on_ask_row()`**: fires on `messages_notify_on_ask` `AFTER INSERT … WHEN (NEW.role = 'system'
  AND NEW.tool_calls IS NOT NULL)`. Both the prompt rows and both response writers (answer route,
  engine expiry) use role `system`; I read the writers to confirm this.
  - **Prompt arm:** fires only for origin `harness`, a run_id that passes the UUID regex, and a run that
    is owned, not golden, and `active`/`paused`. Kind is `approval` when `engine_pause.kind =
    'action_risk'`, otherwise `question`.
  - **Response arm:** closes the notice by `tool_call_id`, as `answered`, or as `run_ended` when the
    response has `expired: true`.
- **`notify_on_run_status()`**: fires on `workflow_runs_notify_on_status` `AFTER UPDATE OF status … WHEN
  (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','failed','cancelled'))`.
  - It closes the run's open notices with `run_ended`.
  - D-26: when `inputs._schedule_id` passes the UUID guard, the schedule reads `'waiting'`, and no newer
    run of that schedule exists, the schedule's `last_status` becomes the terminal status.
- **Both functions:** `SET search_path = ''`, every name fully qualified. EXECUTE is revoked from
  PUBLIC, anon and authenticated, then granted to service_role.
- **Columns:**
  - `app_settings`: `notification_email_delay_seconds` (default 120, CHECK 60..3600),
    `email_from_address`, `email_from_name` (default `'Syrel'`), `email_dev_redirect_address`.
  - `org_invitations`: `email_delivery` (CHECK sent/failed/not_configured), `email_failed_at`,
    `email_failure`.
  - No INSERT and no seed (D-27). No backfill.

## Evidence

- RED (before the SQL existed): the shape test had 20 failed (file missing), and the live suites had
  59 skipped, each reading *"migration 218 not applied to the local database …"*.
- Local apply in ONE asyncpg transaction against `127.0.0.1:54322`. The VERIFY select read:
  - first apply: `APPLIED PASS`
  - second apply (idempotency): `APPLIED PASS`
- GREEN: `test_300_migration_218_shape.py` + `test_300_notice_triggers_live.py` +
  `test_300_rls_anon_live.py` gave **79 passed, 0 skipped**, both after the first apply and after the
  re-apply.
- `test_181_secdef_privileges.py`: 23 passed, 4 failed. All 4 failures are inherited (see Deferred Issues).
- `bash scripts/regenerate-full-schema.sh` (no `--reset`): the `full-schema.sql` diff is **+410 / −0**.
  That is 385 lines of 218's objects (two functions, two tables, five indexes, three triggers, one
  policy, the RLS enables, the column comments) plus the 25-line supplement tail. Greps:
  - `notification_deliveries`: 26
  - `CREATE TRIGGER messages_notify_on_ask`: 1
  - `CREATE TRIGGER workflow_runs_notify_on_status`: 1
- `scripts/check-greenfield-privileges.py`: **"greenfield privileges OK -- 185 migrations scanned, 143
  table/column ACL statements replayed"**.
- The 12 unit suites that read `full-schema.sql` or the supplement: 143 passed.
- Acceptance greps on the migration:
  - `REVOKE EXECUTE … notify_on_ask_row() FROM PUBLIC` = 1, and the same for `notify_on_run_status()` = 1
  - `SECURITY DEFINER` = 2
  - `EXCEPTION WHEN OTHERS` = 2
  - non-comment `insert into public.app_settings` = 0
- The lock `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock` was taken at 04:54 UTC and
  released after the baseline run.
- Backend baseline: see "Backend baseline" below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Mirrored 218's privileges into `scripts/full-schema-supplement.sql`**
- **Found during:** Task 2 (regenerating `full-schema.sql`)
- **Issue:** The plan said the supplement was "not expected to change". But `regenerate-full-schema.sh`
  dumps with `pg_dump --no-privileges`, so none of 218's REVOKEs reach `full-schema.sql` unless they are
  mirrored into the supplement, which is the artifact's tail. Without the mirror, a greenfield bootstrap
  from `full-schema.sql` would keep the default PUBLIC EXECUTE on both trigger functions and Supabase's
  stock `GRANT ALL` to anon/authenticated on both new tables. That is the CLAUDE.md PUBLIC trap, landing
  in the permissive direction.
- **Fix:** Appended a 25-line block that copies 218's table REVOKE/GRANT and function REVOKE/GRANT
  statements, then regenerated. `check-greenfield-privileges.py` reads OK.
- **Files modified:** `scripts/full-schema-supplement.sql`, `supabase/full-schema.sql`
- **Commit:** 08559430e
- **Ledger note:** `scripts/full-schema-supplement.sql` has a FIRING row (`25 / 17 / 863`). This touch
  only appends a privilege mirror and is honoured by construction. The row and its
  `docs/HOT-FILE-LEDGER.md` section were NOT edited here, so updating them is owed at phase close. This
  matches 296-01, whose supplement commit also left the row alone.

**2. [Rule 3 - Blocking] `regenerate-full-schema.sh` could not find the stack from a worktree**
- **Issue:** `supabase status` names its project after the working directory, so from the worktree it
  looked for `supabase_db_agent-ae233912f3f66488c` and failed with "Supabase is not running locally".
- **Fix:** Ran the script with `SUPABASE_WORKDIR="C:/Vibe Apps/Agentic RAG"`. Only the status probe
  uses it. The script still writes to the worktree's `supabase/full-schema.sql`, which it derives from
  its own path. No file was changed for this.

**3. [Rule 1 - Bug, design] The `tool_calls->0` read is inside the swallow block**
- The research sketch put `tc := NEW.tool_calls->0` in `DECLARE`, which sits outside the inner
  exception block, so an error there would escape the swallow. I moved the read inside the block.

## Deferred Issues

- **`tests/integration/test_181_secdef_privileges.py` has 4 inherited failures.** They are unrelated to
  218. The test names
  `keyword_search_chunks(text, uuid, integer, jsonb, uuid[])` and
  `match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text)`. Neither
  signature exists: the base `full-schema.sql` (before this plan's regeneration) already defines them
  with six and nine arguments (`…, uuid[], uuid[]` and `…, text, uuid[], integer`). A later migration
  changed both signatures and the test was never updated. Out of scope, not fixed. The plan's "zero
  failures in test_181" criterion therefore cannot be met by 218. Every 218-specific privilege assertion
  is in `test_300_rls_anon_live.py`, and all of them pass.

## Operator actions (deploy)

- Cloud: paste `218_run_waiting_notifications.sql` into the cloud SQL editor at deploy, with per-action
  approval, then run `get_advisors(security)`. A phase executor never does this, and nothing was written
  to cloud here (T-300-15, accepted).

## Threat model coverage

- T-300-08: fail-soft is proven live. A planted `CHECK (false) NOT VALID` on `notifications` lets the
  message row land with no notice, and a planted close-blocking CHECK lets the run status update stand.
- T-300-09: proven live. anon reads nothing from either table and cannot insert into either. A recipient
  sees only her own notice. authenticated reads nothing from the outbox, and every client write is
  refused.
- T-300-10: `has_function_privilege` returns false for public/anon/authenticated on both functions;
  `prosecdef` is true and `search_path` is pinned.
- T-300-11: proven live. The message carries org B, the run belongs to org A, and the notice's org is A
  (with a non-vacuity check that the message really carries B).
- T-300-12: `notification_id UNIQUE` plus the partial unique index. The D-01 re-ask case keeps one
  delivery.
- T-300-13: a malformed run_id (`not-a-uuid'; DROP TABLE x; --`) writes nothing, and the message lands.
- T-300-14: no notice for a chat (`deep`) prompt naming a real workflow run, a non-workflow run id, a
  golden run, an ownerless run, or a `completed`/`failed`/`cancelled`/`cap_paused` run.

## Backend baseline

`node scripts/check-backend-unit-baseline.cjs` was run once, at the end, under the lock, on the
committed tree (08559430e). Verdict, verbatim:

```
69 failed, 10446 passed, 1 skipped, 2 xfailed, 2 xpassed, 53 warnings in 594.99s (0:09:54)
[GATE PASSED] Backend unit baseline satisfied (failed: 69 <= 71, errors: 0).
```

## Self-Check: PASSED

- FOUND: supabase/migrations/218_run_waiting_notifications.sql
- FOUND: backend/tests/unit/test_300_migration_218_shape.py
- FOUND: backend/tests/integration/test_300_notice_triggers_live.py
- FOUND: backend/tests/integration/test_300_rls_anon_live.py
- FOUND: commit 04e84e827 (test, RED), commit 08559430e (feat, GREEN)
- No tracked file deleted between base 42421f359 and HEAD.
- Lock file removed (it was mine: `300-02 migration 218 …`).

## TDD Gate Compliance

The RED commit `test(300-02)` 04e84e827 comes before the GREEN commit `feat(300-02)` 08559430e. No
refactor commit was needed.
