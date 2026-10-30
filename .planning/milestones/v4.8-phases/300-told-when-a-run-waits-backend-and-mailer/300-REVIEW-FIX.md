---
phase: 300-told-when-a-run-waits-backend-and-mailer
fixed_at: 2026-10-29T13:30:00Z
review_path: .planning/phases/300-told-when-a-run-waits-backend-and-mailer/300-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 2
status: all_fixed
---

# Phase 300: Code Review Fix Report

**Fixed at:** 2026-10-29
**Source review:** `.planning/phases/300-told-when-a-run-waits-backend-and-mailer/300-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (WR-01..WR-05, IN-01..IN-04)
- Fixed: 9
- Skipped: 2, both out of scope by instruction (IN-05, IN-06: deferred, low impact, recorded)

Every fix was test-first. A test was written and run RED against the unfixed code, then the fix was applied and the test ran GREEN. Each fix is one commit, committed by path and checked with `git show --stat HEAD`. Nothing was pushed, and nothing touched the production Supabase.

## Fixed Issues

### WR-01: A scheduled run that fails (or is stopped) cleanly read "Finished."

**Outcome:** fixed (logic: requires human verification)
**Files modified:** `backend/app/services/scheduler_service.py`, `backend/app/services/unattended_launch.py`, `backend/tests/unit/test_300_unattended_provider.py`, `backend/tests/unit/test_256_producer_shells.py`
**Commit:** edfba86b1
**Applied fix:**
- `OnFinish` is now `(status, run_id)`, and `_drive_run` passes the id of the run it drove.
- `_record_outcome` reads `SELECT status FROM workflow_runs WHERE id = $1`. It reads that run only, never the schedule's newest run.
- It records `paused` as `waiting`, and `failed` / `cancelled` as themselves, so each gets its D-15 sentence.
- A failed read still records `completed`.

**RED:** new tests for failed → `failed` and cancelled → `cancelled`, plus a by-id SQL assertion, all failed on the old code. The only other `on_finish` caller (a test fake in `test_256`) was widened to the new signature.

### WR-02: An unknown `SMTP_SECURITY` fell back to plaintext and sent the password

**Outcome:** fixed
**Files modified:** `backend/app/services/email_provider.py`, `backend/tests/unit/test_300_mailer.py`, `backend/.env.example`, `deploy/onebox.env.example`, `docs/OPERATOR.md`
**Commit:** 288bafcca
**Applied fix:**
- New `SMTP_SECURITY_VALUES = ("starttls", "ssl", "none")` and `smtp_security_problem()`.
- An unknown value (`tls`, `true`, `587`, …) fails before any socket opens, with the reason "SMTP_SECURITY must be starttls, ssl or none."
- `none` was already supported. It still works for a relay that needs no login. With a username set it is refused ("SMTP_SECURITY is none, so the login was not sent. Use starttls or ssl."), so credentials never cross a plaintext session.
- All three deploy docs now say this. `check-deploy-drift.sh`: PASS.

**RED:** 9 cases failed on the old code; the no-login `none` send is kept as a regression guard.

### WR-03: The drainer's lease could expire on rows still queued in its own batch

**Outcome:** fixed (logic: requires human verification)
**Files modified:** `backend/app/db/notifications.py`, `backend/app/services/notification_drainer.py`, `backend/tests/unit/test_300_notification_drainer.py`, `backend/tests/integration/test_300_drainer_once_live.py`
**Commit:** 23507f0d3
**Applied fix:**
- New `RENEW_LEASE_SQL` / `renew_delivery_lease(pool, delivery)`. It stamps `claimed_at = now()` `WHERE id = $1 AND status = 'sending' AND attempts = $2`.
- The drainer calls it after the still-waiting, opt-out and address re-checks, just before the send. If it gets no row back, the row is no longer this worker's: it is never sent and nothing is recorded over the other worker's outcome.
- The `attempts` match is the important part. A Resend row that another worker reclaimed *and* claimed again is `'sending'` again, one attempt later, and must not be POSTed by both workers.

**RED (live, local DB, under the lock):** with the drainer change temporarily reverted, 3 live tests failed:
- SMTP: reclaimed to `failed`, then sent anyway.
- Resend: re-sent by the first worker after the second worker had sent it.
- Resend: claimed again elsewhere, then sent concurrently.

All 12 live drainer tests pass with the fix.

### WR-04: The definer trigger's close-on-answer UPDATE was not scoped

**Outcome:** fixed
**Files modified:** `supabase/migrations/218_run_waiting_notifications.sql`, `supabase/full-schema.sql`, `backend/tests/integration/test_300_notice_triggers_live.py`
**Commit:** c5e28cacf
**Applied fix:**
- Migration 218 was amended in place, since it is not yet in cloud. `notify_on_ask_row()`'s close now also requires `n.run_id IN (SELECT wr.id FROM public.workflow_runs wr WHERE wr.thread_id = NEW.thread_id)`.
- The answer route (`row["thread_id"]`) and the engine's expiry row (`_tid`) both write into the run's own thread, so both still close the notice.
- Only the changed `CREATE OR REPLACE FUNCTION` was re-applied to the local DB, in one transaction. Afterwards the body is scoped, EXECUTE is held by postgres and service_role only, and PUBLIC execute is false (grants survive CREATE OR REPLACE, so `scripts/full-schema-supplement.sql` needed no change).
- `bash scripts/regenerate-full-schema.sh` was run with no `--reset`; the diff is just this function's 9 lines.

**RED:** the new live test failed on the old DB function, for both a deep-origin and a harness-origin foreign-thread answer. It passes after the re-apply. An expiry non-regression case was added too.

### WR-05: An invalid email address was dropped on Save, which then said "Saved"

**Outcome:** fixed
**Files modified:** `frontend/src/components/settings/EmailSettings.tsx`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/components/settings/__tests__/EmailSettings.test.tsx`
**Commit:** 909c2e0cf
**Applied fix:**
- The card's handle gains `invalid(): string | null`. When a changed from-address or test address is invalid, it shows that field's own "That isn't an email address." line (even if the field was never blurred) and returns one sentence.
- `handleSaveIntegrations` reads it first. If there is a sentence, it puts it in the page's existing error home and returns before the PUT. So `adopt()` never wipes the typed value.
- The delay clamp was left as UI-SPEC S3 specifies ("Clamped to 60..3600 on blur"). The field visibly shows the clamped value after blur.
- New user-visible sentence (Claude's-discretion words): "An email address in the Email card isn't valid. Fix it, then save again."

**RED:** 5 tests failed on the old code: 4 behavioural, plus the wiring pin (`emailSettingsRef` count 4 → 5, and the veto placed before `setSavingIntegrations(true)`). The `useState` count is unchanged at 49.

### IN-01: The invite dialog said "We emailed <invitee>" when the email went to the test address

**Outcome:** fixed
**Files modified:** `backend/app/services/email_provider.py`, `backend/app/api/org.py`, `backend/tests/unit/test_300_mailer.py`, `backend/tests/unit/test_300_invite_outcome.py`, `frontend/src/lib/api/org.ts`, `frontend/src/components/org/inviteDeliveryCopy.ts`, `frontend/src/components/org/InviteMemberDialog.tsx`, `frontend/src/components/org/InviteMemberDialog.test.tsx`
**Commit:** 07674aa80
**Applied fix:**
- `SendOutcome.redirected` is set (via `dataclasses.replace`) when the dev guard rewrote the recipient.
- The send and resend responses carry `email_to_test_address` (true only when the email was sent *and* redirected). The stored `email_delivery` and migration 218's CHECK constraint are unchanged.
- `sendInvitation` reads the field (`=== true`). The dialog gets one state and one arm: "Outside production, the email went to the test address set in Settings, not to {invitee}. Copy the link and send it yourself." These are Claude's-discretion words, kept in `inviteDeliveryCopy.ts`.
- `resendInvitation` is unchanged on the client, because the invitations list never names a recipient.

**RED:** backend collection errored and 2 frontend tests failed on the old code.

### IN-02: Every held-back non-production invite logged the recipient and the raw token

**Outcome:** fixed
**Files modified:** `backend/app/services/email_provider.py`, `backend/tests/unit/test_276_invite_email_brand.py`
**Commit:** e6548dd6a
**Applied fix:** the `invite link for …` INFO line now runs only when the outcome's provider is `none`, i.e. the offline flow from Phase 167. A dev-guard hold-back logs neither the link nor the address.

**RED:** the new test failed on the old code because the token was in the log. The existing `none`-provider log test still passes.

### IN-03: `resolve_owner_run_model` did not resolve the owner's model the way the in-app door does

**Outcome:** fixed (logic: requires human verification)
**Files modified:** `backend/app/services/run_model_resolution.py`, `backend/tests/unit/test_300_unattended_provider.py`
**Commit:** b7e03e417
**Applied fix:** the helper now walks the same chain as `threads.py`'s workflow kickoff:
1. `load_user_settings`
2. `apply_user_model_default(None, {"id": owner}, …)`, which applies the owner's per-user default (SEED-116) with its lock and allowed-set
3. `resolve_run_model(body=_NoOverrideBody())`, which derives the provider from the model and applies the D-149-10 disabled-model fallback
4. `resolve_workflow_ctx_model` on the aligned settings

`_NoOverrideBody` is a two-field pydantic model, because `_apply_fallback_to_request` calls `body.model_copy`. The helper still returns `(None, None)` on any failure instead of raising.

**RED:** the new chain test failed on the old code. A smoke run of the unmocked chain against the local DB, for a fresh owner, returned `('gpt-4o', 'openai')` with no warning.

The provider is now derived from the model, not taken from `active_provider`, and the four-axis cross-provider UAT (D-17) has not been re-run for this change.

### IN-04: The Email tile read "Ready" in production when no sender address was set

**Outcome:** fixed
**Files modified:** `backend/app/services/email_provider.py`, `backend/app/services/health_probe.py`, `backend/tests/unit/test_300_health_probe_email.py`, `frontend/src/components/admin/HealthSignals.tsx`, `frontend/src/components/admin/__tests__/HealthSignals.email.test.tsx`
**Commit:** a1a0d23c6
**Applied fix:**
- New `transport_config_problem(provider, app)` returns the mailer's own refusal sentences, in the order a send meets them: no sender address, no `RESEND_API_KEY`, no `SMTP_HOST`, a refused `SMTP_SECURITY`.
- `probe_email` runs it in live and test mode. A problem gives `state: down` with the new optional `config_problem` key, and the outbox is not read. Held back stays neutral, as before.
- The tile reads value "Can't send", sub-line `via {Provider}: {sentence}`, with the destructive dot.
- This is one tile state beyond UI-SPEC S5's table (Claude's-discretion words). The spec file itself was not edited.

**RED:** 8 backend and 1 frontend tests failed on the old code. An older backend's payload (no `config_problem`) renders exactly as before.

## Ledger bookkeeping

**Commit:** 308b35e08 (`CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`)

Nine FIRING hot files gained hunks: `scheduler_service.py`, `unattended_launch.py`, `run_model_resolution.py`, `email_provider.py`, `api/org.py`, `lib/api/org.ts`, `InviteMemberDialog.tsx`, `SettingsPage.tsx` and `HealthSignals.tsx`. For each one:
- the triple was re-derived from git;
- the CLAUDE.md cell (≤ 80 chars) and the scan-list cell (≤ 200) were updated;
- the replaced cells were moved verbatim into a new `— 300-REVIEW fixes (2026-10-29)` section.

`check-hot-file-ledger.cjs` reported "ledger gate OK" (753 rows, 72 subject files, 32 watched). `check-claude-md-size.cjs` reported OK at 104,434 chars before this commit; it was not re-run after this commit's +18/−18 edit to CLAUDE.md.

## Skipped Issues

### IN-05: The From header is not frozen across Resend retries

**File:** `backend/app/services/email_provider.py:311-321`
**Reason:** deferred, low impact, recorded (out of scope by instruction)
**Original issue:** `sender` is rebuilt from Settings on every attempt. A "Send from" edit between a timed-out-but-accepted Resend attempt and its retry would get a non-retryable 409 and record `failed` for a delivered email.

### IN-06: Overlapping refreshes in the schedule modal can land out of order

**File:** `frontend/src/components/workflows/WorkflowScheduleModal.tsx:207-234,381-409`
**Reason:** deferred, low impact, recorded (out of scope by instruction)
**Original issue:** Run now's trailing `refresh()` can overlap a toggle's or delete's. The last response wins, and a failed quiet refetch gives no signal.

## Gates (run once after all fixes; verbatim)

- **Backend unit baseline:** `69 failed, 10714 passed, 1 skipped, 2 xfailed, 2 xpassed, 61 warnings in 563.73s (0:09:23)`. That is under the 71 ceiling, and none of the 69 is in a suite this fix round touched. Run under the local-DB lock.
- **Phase 300 integration tests:** `test_300_drainer_once_live.py`, `test_300_notice_triggers_live.py` and `test_300_rls_anon_live.py` gave `74 passed, 1 warning in 8.02s`.
- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2`): `count gate OK — 573/573 pinned files present, no per-file decrease, 0 failing.` Total 13300, pinned total 12139. Per-file: `EmailSettings.test.tsx` 28 → 32, `HealthSignals.email.test.tsx` 11 → 13, `InviteMemberDialog.test.tsx` 7 → 9.
- **Frontend typecheck** (`npx tsc -p tsconfig.app.json --noEmit`): 61 errors, equal to base. The `SettingsPage.tsx` errors are the pre-existing ones, shifted by line.
- **`check-deploy-drift.sh`:** PASS.

## Owed before closing

- WR-04 changes migration 218's function body. Cloud parity is unchanged: 218 is pasted into cloud at deploy as a whole file, with per-action approval, followed by `get_advisors(security)`.
- The logic fixes (WR-01, WR-03, IN-03) are marked for human verification.

---

_Fixed: 2026-10-29_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
