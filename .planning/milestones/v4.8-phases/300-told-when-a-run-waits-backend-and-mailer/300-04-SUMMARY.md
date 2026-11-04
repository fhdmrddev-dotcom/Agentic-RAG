---
phase: 300-told-when-a-run-waits-backend-and-mailer
plan: 04
subsystem: email-outbox
tags: [backend, outbox, exactly-once, multi-worker, control-room, mutates-local-db]
requires:
  - "public.notifications / public.notification_deliveries + the two notice triggers (300-02, migration 218)"
  - "email_provider.send_email / SendOutcome / configured_provider; run_waiting_email.render_run_waiting (300-03)"
provides:
  - "db/notifications.py: ClaimedDelivery, claim_due_deliveries, reclaim_stale_sending, still_waiting, email_opted_in, recipient_email, record_delivery_outcome, latest_delivery_facts, MAX_ATTEMPTS"
  - "services/notification_drainer.py: NotificationDrainer(pool, *, send, poll_interval_seconds, max_claims_per_tick, lease_seconds) with tick(now=None) / start / stop; render_delivery"
  - "GET /admin/backpressure -> signals.dependencies.email = {state, mode, provider, last_sent_at, last_failure_at, last_failure_reason, latency_ms}"
  - "The Control Room Email tile (HealthSignals.tsx)"
affects: [300-05, 301]
tech-stack:
  added: []
  patterns:
    - "outbox claim: FOR UPDATE OF d SKIP LOCKED + 'sending' flip + render-once freeze in ONE transaction, the send after commit"
    - "stale 'sending' rows: Resend re-queued under the same key, SMTP / none failed (at-most-once)"
    - "a live test isolated from the dev outbox by pinning every tick to the year 2000"
key-files:
  created:
    - backend/app/db/notifications.py
    - backend/app/services/notification_drainer.py
    - backend/tests/unit/test_300_notification_drainer.py
    - backend/tests/integration/test_300_drainer_once_live.py
    - backend/tests/unit/test_300_drainer_wiring.py
    - backend/tests/unit/test_300_health_probe_email.py
    - frontend/src/components/admin/__tests__/HealthSignals.email.test.tsx
  modified:
    - backend/app/main.py
    - backend/app/services/health_probe.py
    - frontend/src/components/admin/HealthSignals.tsx
    - backend/tests/unit/test_300_clean_image_imports.py
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "claim_due_deliveries and reclaim_stale_sending take the configured provider as a keyword (provider=) beside the interface's fixed names; tick(now=None) pins the clock for tests."
  - "A stale 'sending' row is re-queued only when it was claimed for Resend AND Resend is still the configured provider AND attempts remain; a provider switched since a crash counts as SMTP (at-most-once)."
  - "The opt-out read never raises on a malformed value: on unless preferences.notification_email_enabled is exactly false (a user with no user_settings row is on)."
  - "A row that raises before its send is recorded 'retry' (nothing left the process), or 'failed' on its third attempt; record_delivery_outcome writes only a row still 'sending'."
  - "The Email probe reads email_dev_redirect_address only outside production; held_back returns before any DB read; a facts read that fails or times out is 'down' with one fixed sentence, never the raw error."
  - "The Email tile types its probe locally (EmailProbe) and reads it off dependencies, so lib/api/tuner.ts is not edited."
metrics:
  duration: "~1 h 10 min"
  completed: 2026-10-29
  tasks: 2
  files: 14
---

# Phase 300 Plan 04: The run-waiting outbox drainer and the Control Room Email tile — Summary

**Every worker now runs a drainer that sends each due run-waiting email exactly once. It claims rows with SKIP LOCKED and flips them to `sending` in the same transaction, renders the email once and freezes it on the row, re-checks right before sending that the run is still waiting and that the owner has not opted out, sends under `Idempotency-Key: run-waiting/<delivery id>`, and stores every outcome, with at most 3 attempts. The operator sees whether email is off, held back, in test mode, sending or failing, and why, in a new Email tile in the Control Room.**

## What was built

### Task 1: the outbox drainer (D-09, D-12, D-13, D-20, D-31, NOTE-03)

`backend/app/db/notifications.py` (new) holds the duplicate-sending guarantee. Its module docblock lists the four parts.

- **`claim_due_deliveries(pool, *, limit, render, now=None, provider)`**
  - Selects rows with `status IN ('pending','retry')`, fewer than 3 attempts, and `due_at <= COALESCE($now, now())`. Rows come in `due_at` order, `FOR UPDATE OF d SKIP LOCKED`.
  - The workflow name comes through `workflow_runs.definition_id`. The org name comes from `notifications.org_id`. `waited_seconds` is now minus the notice's `created_at`.
  - For each row, in the same transaction, it sets `status='sending'`, `attempts+1`, `claimed_at=now()` and the provider.
  - For a row that has no subject yet, it calls `render` once and freezes `subject`, `text_body`, `html_body` and `waited_seconds` with `COALESCE`. A frozen row is never re-rendered.
  - If rendering fails, that row is `failed` with "The email could not be prepared." The rest of the batch carries on.
- **`reclaim_stale_sending`** handles `sending` rows whose claim is older than the 600 s lease.
  - It re-queues the row as `retry`, due now, only when the row was claimed for Resend, Resend is still configured, and attempts remain.
  - Every other stale row is marked `failed` with "Interrupted while sending; not retried to avoid a duplicate."
- **`still_waiting`** is one `SELECT EXISTS`. It checks that the notice is open, the run is `active`/`paused`, and an unanswered harness `ask_user_prompt` exists for the run.
  - `tool_calls` is read only for `run_id` and `tool_call_id`.
  - It reads no message body and no prompt key. A test scans every `*_SQL` constant to prove this.
- **The other functions:**
  - `email_opted_in` returns true unless `preferences.notification_email_enabled` is exactly false, and never raises.
  - `recipient_email` reads `auth.users.email`.
  - `record_delivery_outcome` swallows its own errors and writes only a row that is still `sending`.
  - `latest_delivery_facts` returns the newest `sent_at` and the newest `failed` row's time and reason.

`backend/app/services/notification_drainer.py` (new) has the same shape as `SchedulerService`.

- **`tick(now=None)`** runs in this order: reclaim stale rows (an error here never blocks claiming), then claim with `render_delivery` (a wrapper over 300-03's `render_run_waiting` that passes only the five facts), then process each row in its own `try`. For each row:
  1. Still waiting? If not, record `skipped_answered`.
  2. Opted in? If not, record `skipped_opted_out` and leave the notice alone.
  3. Is there an address? If not, record `failed` with "No email address on record."
  4. Send with `run_in_threadpool(send, msg, idempotency_key=f"run-waiting/{row.id}")`.
- **Outcome mapping:**
  - sent → `sent` (records `provider_message_id`).
  - suppressed → `suppressed` with its reason.
  - Failed but retryable, with attempts left → `retry`, at +60 s after attempt 1 and +300 s after attempt 2.
  - Anything else → `failed` with the reason.
- **Loop:** it waits on a stop `Event`, and `start`/`stop` are idempotent. Counters are `ticks`, `sent`, `skipped` and `failed`. Logs carry delivery ids and outcome words only.

### Task 2: wiring and the Email tile (D-12, D-20, UI-D13)

- **`main.py`** (FIRING, honoured by construction):
  - One start block after the scheduler's, gated on `if not _setup_mode and RUN_BOOT_SWEEPS:`. There is no new env var, so no deploy artifact is owed.
  - The drainer is parked on `app_instance.state.notification_drainer`, or `None` when it did not start. A failed start is logged and the app continues.
  - One stop block sits beside the scheduler's stop.
- **`health_probe.probe_email()`** is in the `probe_dependencies` gather under the key `email` and in `__all__`.
  - Mode: provider `none` → `off`. Not production with no test address → `held_back` (state `off`, no DB read). Not production with a test address → `test`. Production → `live`.
  - State: `down` when the newest failure is newer than the newest send, or when the facts read fails or times out (bounded by `_PROBE_TIMEOUT_S`, reported as one fixed sentence). Otherwise `up`.
  - `admin.py` is not edited.
- **`HealthSignals.tsx`** (FIRING, still a pure leaf):
  - One `DEP_ORDER` entry `{key: "email", label: "Email"}`.
  - A local `EmailProbe` type, and `emailView`, which holds every S5 word: — / Off / Held back / Test mode / Ready / Sending / Last send failed. The provider words are "Resend" and "your mail server".
  - Times use `toLocaleString()`. The reason wraps (`break-words`) and is never truncated. The ⌥ reveal shows `dependencies.email · {provider}`.
  - The dependency grid is now `sm:grid-cols-2 lg:grid-cols-4`. The three shipped tiles are unchanged, and their a11y test is green.

## Commits

| Task | Gate | Commit | Message |
|---|---|---|---|
| 1 | RED | `6242f4eb2` | test(300-04): the outbox sends once across two drainers and re-checks before sending (RED) |
| 1 | GREEN | `a9bac60b4` | feat(300-04): run-waiting outbox drainer — exactly once across workers (D-12, D-13, D-20, D-31) |
| 2 | RED | `3e2b83d1a` | test(300-04): drainer wiring and the Email health tile (RED) |
| 2 | GREEN | `ea416b434` | feat(300-04): the drainer runs in every worker; the Control Room shows email delivery (D-12, D-20) |

## Evidence

- RED:
  - Task 1 failed at collection: `cannot import name 'notification_drainer'`.
  - Task 2: 7 backend tests failed and 9 errored, and all 11 frontend tests failed.
- Live suite `tests/integration/test_300_drainer_once_live.py`: **8 passed, 0 skipped** (`-rs`), run under the local-DB lock (`300-04 agent-a356376f212f8f02f …`), which was released afterwards. It covers:
  - Two drainers with `asyncio.gather`: **exactly one** send, and the row ends `sent`, attempt 1, provider `resend`. The frozen subject is "Compliance Gap Report is waiting on you", the wait is "3 minutes", and the prompt text is absent.
  - A second tick after `sent` sends nothing.
  - An answered question → `skipped_answered`. A notice still open whose prompt was answered → `skipped_answered`.
  - An opted-out owner → `skipped_opted_out`, and the notice is still open.
  - A retry resends a byte-identical payload under the same key, even after the org is renamed.
  - A crash mid-send: on Resend it is re-sent (attempt 2, same key); on SMTP or none it is `failed`, interrupted, with zero sends.
  - The notice and delivery are written by migration 218's own trigger from a real harness prompt row.
  - After the run, a read-only probe found 0 leftover users, definitions, orgs, threads, notices or deliveries.
- Unit: `test_300_notification_drainer.py` + `test_300_clean_image_imports.py` gave 33 passed. `test_300_drainer_wiring.py` + `test_300_health_probe_email.py` + `test_workflow_scheduler.py` + `test_296_lifespan_no_sweeps.py` gave 56 passed. The existing probe suites (`test_147_health_probe`, `test_150_backpressure_secrets`, `test_146_operator_gate`, `test_backpressure`) gave 23 passed.
- Frontend: `HealthSignals.email.test.tsx` + `HealthSignals.a11y.test.tsx` gave 16 passed.
- Acceptance greps:
  - In `db/notifications.py`: `SKIP LOCKED` appears 4 times, and `\bcontent\b|'prompt'|"prompt"` appears 0 times.
  - `idempotency_key=f"run-waiting/` appears once.
  - In `main.py`: `NotificationDrainer(` appears once and `notification_drainer` 3 times.
  - `"email"` appears in health_probe.py once.
  - In `HealthSignals.tsx`: `key: "email"` appears once and `lg:grid-cols-4` twice.
  - `git diff c7a4a7333 -- backend/app/api/admin.py backend/app/services/harness_engine.py` is empty.

## Plan-end gates (verdict lines verbatim)

Each gate was run once, at plan end, on the committed tree (`ea416b434`).

- Backend unit baseline, under the local-DB lock (`300-04 agent-a356376f212f8f02f backend baseline …`, released afterwards):
  ```
  69 failed, 10633 passed, 1 skipped, 2 xfailed, 2 xpassed, 63 warnings in 609.53s (0:10:09)
  [GATE PASSED] Backend unit baseline satisfied (failed: 69 <= 71, errors: 0).
  ```
- Vitest count gate (`GSD_VITEST_MAX_WORKERS=2`, run from the repo root):
  ```
  total 13217  ·  failed 0  ·  pinned total 12064
  count gate OK — 568/568 pinned files present, no per-file decrease, 0 failing.
  ```
  That is 567 before this plan, plus the one new pin.
- Frontend typecheck (`npx tsc -p tsconfig.app.json --noEmit`): 61 `error TS` lines, the same as the base's 61. None of them name `HealthSignals`, and no other frontend file changed, so the error set is unchanged.
- Hot-file ledger: `ledger gate OK — every watched file has a row.` (753 rows, 72 subject files, 32 watched)
- CLAUDE.md size: `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.` (CLAUDE.md is 104,789 characters)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The frozen-payload live case could not rename the workflow**
- **Found during:** Task 1 (GREEN, first live run)
- **Issue:** Renaming the definition to prove the payload stays frozen raised `CheckViolationError: workflow_definitions row … is published and immutable`.
- **Fix:** The test now renames the org instead. The org's name is also one of the five facts. The fixture's leftover check was widened to cover definitions, threads and runs.
- **Commit:** `a9bac60b4`

**2. [Rule 2 - Correctness] Two keyword extensions to the fixed interface**
- `claim_due_deliveries(..., provider=)` was added, because the behaviour bullet says the claim records the configured provider. `NotificationDrainer.tick(now=None)` was added so the live test can isolate its rows from the shared dev outbox.
- Neither changes a fixed name or a positional parameter.

**3. [Rule 2 - Correctness] Conservative edges the plan left open**
- A stale Resend row is re-queued only when Resend is still the configured provider and attempts remain.
- A row that raises before its send is recorded `retry`, not left as `sending`.
- The opt-out read never raises on a malformed preference value.
- **Commit:** `a9bac60b4`

## TDD Gate Compliance

Each task's `test(...)` RED commit comes before its `feat(...)` GREEN commit: `6242f4eb2` → `a9bac60b4` and `3e2b83d1a` → `ea416b434`. No refactor commit was needed.

## Known Stubs

None. Nothing writes `user_settings.preferences.notification_email_enabled` yet, so every owner reads as opted in. The switch is 300-05's planned Settings surface; the drainer already reads the key at send time.

## Threat Flags

None beyond the plan's register. T-300-26..34 are each mitigated as planned:
- SKIP LOCKED + the in-transaction flip, proven by the live two-drainer test.
- The frozen payload and one key.
- Still-waiting before every send.
- The opt-out at send time.
- The SQL scan.
- SMTP at-most-once.
- The RUN_BOOT_SWEEPS gate, proven by the lifespan test.
- Address-free reasons.
- Outcomes stored on the row and shown on the tile.

## Operator notes

- Once this merges, the operator's dev backend (where `RUN_BOOT_SWEEPS` is True) drains the local outbox. With the local default `EMAIL_PROVIDER=none`, every due delivery is recorded `suppressed` and nothing leaves the machine.
- Cloud: migration 218 must be in the cloud database before this backend deploys. Otherwise every drainer tick logs a missing-relation error. The error is contained by the loop, but the logs are noisy.

## Self-Check: PASSED

- All 7 created files exist.
- All 4 commits (`6242f4eb2`, `a9bac60b4`, `3e2b83d1a`, `ea416b434`) are in `git log c7a4a7333..HEAD`.
- No tracked file was deleted between base `c7a4a7333` and HEAD.
- The local-DB lock is gone (both acquisitions were mine, and both were released).
