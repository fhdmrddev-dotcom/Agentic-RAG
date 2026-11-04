---
phase: 300-told-when-a-run-waits-backend-and-mailer
reviewed: 2026-10-29T08:03:23Z
depth: standard
files_reviewed: 40
files_reviewed_list:
  - backend/app/api/me_preferences.py
  - backend/app/api/org.py
  - backend/app/api/schedules.py
  - backend/app/api/settings.py
  - backend/app/config.py
  - backend/app/db/notifications.py
  - backend/app/main.py
  - backend/app/models/user_settings.py
  - backend/app/services/connectors/smtp_adapter.py
  - backend/app/services/email_provider.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/health_probe.py
  - backend/app/services/inbound_inputs.py
  - backend/app/services/notification_drainer.py
  - backend/app/services/run_model_resolution.py
  - backend/app/services/run_waiting_email.py
  - backend/app/services/scheduler_service.py
  - backend/app/services/unattended_launch.py
  - supabase/migrations/218_run_waiting_notifications.sql
  - scripts/full-schema-supplement.sql
  - frontend/src/components/admin/HealthSignals.tsx
  - frontend/src/components/org/InvitationsTab.tsx
  - frontend/src/components/org/InviteMemberDialog.tsx
  - frontend/src/components/org/inviteDeliveryCopy.ts
  - frontend/src/components/settings/EmailNotificationPreference.tsx
  - frontend/src/components/settings/EmailSettings.tsx
  - frontend/src/components/settings/PreferencesSection.tsx
  - frontend/src/components/workflows/WorkflowScheduleModal.tsx
  - frontend/src/components/workflows/scheduleOutcomeVocabulary.ts
  - frontend/src/lib/api/org.ts
  - frontend/src/lib/api/schedules.ts
  - frontend/src/lib/api/settings.ts
  - frontend/src/lib/api/skills.ts
  - frontend/src/pages/SettingsPage.tsx
  - backend/requirements.txt
  - backend/.env.example
  - deploy/onebox.env.example
  - docker-compose.prod.yml
  - docs/OPERATOR.md
  - scripts/check-deploy-drift.sh
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 300: Code Review Report

**Reviewed:** 2026-10-29T08:03:23Z
**Depth:** standard (only the hunks this phase added, via `git diff 42421f359..HEAD`; new files read in full)
**Files Reviewed:** 40
**Status:** issues_found

## Summary

I checked each focus area from ROADMAP's "How we'd know this failed" against the code. I traced callers where it mattered: `engine_ask.py` and `human_input.py` for the prompt rows, the answer route in `api/runs.py`, the `harness_engine.run_workflow` fail arm, and the `_build_resume_context` provider path.

**Focus areas that hold up when traced:**
- **Exactly-once.** The claim selects `FOR UPDATE OF d SKIP LOCKED` and flips the row to `sending` in the same transaction. `notification_id` is UNIQUE. The payload is frozen at first claim, and the Resend `Idempotency-Key` is `run-waiting/<delivery id>`. A stale SMTP row is marked `failed`, never re-sent.
- **No email after an answer.** `still_waiting` is re-read after the claim commits. The answer and expiry rows close the notice through the trigger.
- **No content in the email.** The renderer takes five keyword-only facts. Neither `CLAIM_SQL` nor the renderer reads prompt text, and no URL carries a token.
- **Header injection.** `one_line` runs on every header value. `formataddr` builds the sender. `_usable_address` refuses a comma or second `@` in the recipient. Settings refuses control characters in the name and accepts only a single bare address.
- **Engine safety and org source.** Both trigger bodies run inside their own exception block, so an error never breaks the engine's fail-closed insert. The org comes from `workflow_runs.org_id`.
- **Grants.** RLS is on for both tables. The outbox has no policy at all. EXECUTE on both definer functions is revoked from PUBLIC, anon and authenticated (the PUBLIC trap is handled), and the supplement copies the grants.
- **Dev guard and failure visibility.** The dev guard sits inside the mailer seam, with redirect and suppress arms. Production ignores the redirect. A failed send is stored on the outbox and invitation rows and shown on the Email tile.
- **No secrets in logs.** The Resend key, SMTP password and response bodies are never logged.
- **Markdown renderer.** It uses `js-default` with `html=False`. Links are allow-listed to http, https and mailto, and images are disabled.
- **Blocking I/O.** Every blocking call (`send_email`, `load_app_settings`, `load_user_settings`) goes through `run_in_threadpool`.
- **FIX-04 and the opt-out.** The fire-time check gets the raw `row["definition"]`, never the parsed model. The opt-out PUT is a single-key `||` merge on its own route.

**What is wrong:**
- **WR-01: the schedule row lies after a clean failure.** A scheduled run that fails through the engine's `fail_run` arm still reads "Finished.", even though the new hunk already reads the run's status.
- **WR-02: SMTP can fall back to plaintext.** A misspelt `SMTP_SECURITY` value sends `SMTP_PASSWORD` unencrypted.
- **WR-03: the drainer's lease is shorter than a slow batch.** On a slow SMTP server, another worker can mark a row `failed` while the first worker is still sending it.
- **WR-04: the answer close is not scoped.** The definer trigger's close-on-answer UPDATE is not limited to the answer's run.
- **WR-05: an invalid address is lost on Save.** The Email Settings card silently drops an invalid address, then shows "Saved" and wipes what was typed.

No BLOCKERs: none of these sends a duplicate email, leaks content, or breaks the engine's prompt insert.

## Warnings

### WR-01: A scheduled run that FAILS (or is stopped) cleanly still reads "Finished." on its schedule row

**File:** `backend/app/services/scheduler_service.py:225-240` (with `backend/app/services/unattended_launch.py:325,375` and `backend/app/services/harness_engine.py:1965-1990`)

**Issue:** `_drive_run` reports `"failed"` only when `run_workflow` RAISES. The engine's `fail_run` arm does not raise. It calls `finish_run(pool, run_id, "failed")` and then `return`s (harness_engine.py:1969, 1990). The same holds for the missing-skip-target guard at :2010. So `on_finish("completed")` runs for a run that failed.

The new D-26 hunk reads the schedule's newest run status, but it remaps only `paused`. So the run row says `failed` while `last_status` is written as `completed`, and `scheduleOutcomeVocabulary.ts` renders "Finished.". The vocabulary's `failed` sentence ("Started, but the run failed.") can never be reached for a clean failure.

The trigger cannot repair this. `notify_on_run_status` acts only while `last_status = 'waiting'`, and it fires at `finish_run`, before `on_finish` writes `completed`.

The same applies to a run that ends `cancelled` without raising out of `_drive_run`. D-15 ("every last_outcome maps to a sentence") and D-26 ("the recorded outcome distinguishes waiting from finished") are only half met.

Concrete input: schedule a workflow whose KB step finds nothing on a step set to "Must prove it". `engine_pause` returns `fail_run` with `_ONLY_STOP_LEFT`. Then `workflow_runs.status = 'failed'`, `workflow_schedules.last_status = 'completed'`, and the row reads "Finished.".

Secondary: the read takes the schedule's NEWEST run (`ORDER BY created_at DESC LIMIT 1`), not the run this drive launched. An overlapping Run-now or a quick re-fire can attribute another run's status to this one.

**Fix:** pass the launched `run_id` to `on_finish` (or close over it), and map every terminal status the row actually holds:
```python
if status == "completed":
    latest = await pool.fetchval(
        "SELECT status FROM workflow_runs WHERE id = $1", run_id)
    if latest == "paused":
        status = "waiting"
    elif latest in ("failed", "cancelled"):
        status = latest
```

### WR-02: An unrecognised `SMTP_SECURITY` value silently downgrades to plaintext and sends the SMTP password unencrypted

**File:** `backend/app/services/email_provider.py:228-251`

**Issue:** The code checks `security == "ssl"`. For every other value it opens plain `smtplib.SMTP(...)`, and STARTTLS runs only when the value is exactly `"starttls"`. Any other value gets no encryption, and then `session.login(username, settings.smtp_password)` runs if a username is set. That covers `tls`, `true`, `yes`, `on`, `STARTTLS/TLS` and `587`.

Many mail providers label port-587 STARTTLS as "TLS", so `SMTP_SECURITY=tls` is a likely operator value. With it, the password crosses the network unencrypted. `smtplib` does not refuse AUTH on an unencrypted session, and relays that allow it accept the login. Nothing is logged and the send "works", so the operator is never told.

The documented values (`starttls | ssl | none`) are not validated anywhere: not in `config.py:1735`, not in the Settings response, and not in the probe.

**Fix:** fail closed on unknown values, and keep the cleartext login an explicit choice:
```python
security = (settings.smtp_security or "starttls").strip().lower()
if security not in ("starttls", "ssl", "none"):
    return SendOutcome("failed", provider="smtp",
                       reason="SMTP_SECURITY must be starttls, ssl or none.")
```
Also log one WARNING at startup when `security == "none"` and `smtp_username` is set.

### WR-03: The drainer's 600 s lease can expire on rows still queued in its own batch. A slow SMTP server then gives "sent but recorded failed" (SMTP) or concurrent double sends (Resend)

**File:** `backend/app/services/notification_drainer.py:61-109`, `backend/app/db/notifications.py:71-109,150-160`

**Issue:** `claim_due_deliveries` flips up to `max_claims_per_tick=20` rows to `sending`, all with one `claimed_at = now()`. `tick` then sends them ONE AT A TIME. Each SMTP send makes several blocking socket operations (connect, EHLO, STARTTLS, AUTH, DATA, QUIT), and each has `SMTP_TIMEOUT_SECONDS = 15`. One send can take well over 30 s against a degraded relay. Twenty of them pass `lease_seconds=600` before the last rows are tried.

At that point another worker's `reclaim_stale_sending` (it runs at the top of every tick, in every worker) takes the rows still waiting in the first worker's queue:
- **SMTP or none:** the rows are flipped to `failed` with `INTERRUPTED_REASON`. The first worker then sends them anyway, because `_process` never re-checks the row's status. Its `RECORD_SQL ... AND status = 'sending'` matches nothing, so the person gets the email while the outbox says `failed` and the Email tile goes red with "Interrupted while sending".
- **Resend:** the row goes back to `retry` and is claimed by the second worker. Both workers then POST under the same key at about the same time. Resend usually dedupes this, or answers `409 concurrent_idempotent_requests`. That 409 is retryable here, so it burns attempts and can end `failed` for an email that was delivered.

The shared `claimed_at` is what lets the lease expire for a row nobody has started sending yet. The guarantee in the docstring ("SMTP is at-most-once ... never re-sent") still holds. The RECORD of the outcome does not.

**Fix:** stamp the lease when each row's send STARTS, not when the batch is claimed. Either claim one row per transaction in the loop, or touch the row just before sending and skip it if it is no longer yours:
```python
ok = await pool.fetchval(
    "UPDATE public.notification_deliveries SET claimed_at = now() "
    "WHERE id = $1 AND status = 'sending' RETURNING true", row.id)
if not ok:
    return False  # reclaimed by another worker; never send
```
Alternatively, size the lease from the batch: `lease_seconds > max_claims_per_tick × worst-case send time`.

### WR-04: The definer trigger's close-on-answer UPDATE is not scoped to the answering run or recipient

**File:** `supabase/migrations/218_run_waiting_notifications.sql:248-253`

**Issue:** For any `ask_user_response` row, `notify_on_ask_row()` runs:
`UPDATE public.notifications n SET closed_at = now() ... WHERE n.tool_call_id = tc->>'tool_call_id' AND n.closed_at IS NULL`

The function is `SECURITY DEFINER`, so it bypasses RLS. The UPDATE matches on the client-supplied `tool_call_id` alone. It is not limited to the thread or run the answer was written to, nor to the answering user.

The answer route validates `tool_call_id` only on the harness branch (`api/runs.py:1060`, `if _origin == "harness" and not await _is_current_question(...)`). A deep-origin answer row is inserted with whatever `tool_call_id` the body carries (`api/runs.py:1087-1093`). So a user who learns another user's open prompt id can post it as a deep answer in their OWN thread and close the other user's notice. The result: that user's email becomes `skipped_answered`, and the notice drops from Phase 301's list.

Exploitability is low, because ids are `uuid4().hex` and visible only to the prompt's owner. But this is a cross-user write path through a definer function, and the fix costs one predicate. It matters more because 301 will make this table a user-facing list.

**Fix:** match the answer to a run in the same thread:
```sql
UPDATE public.notifications n
   SET closed_at = now(), closed_reason = ...
 WHERE n.tool_call_id = tc->>'tool_call_id'
   AND n.closed_at IS NULL
   AND n.run_id IN (SELECT wr.id FROM public.workflow_runs wr
                     WHERE wr.thread_id = NEW.thread_id);
```
Re-run `bash scripts/regenerate-full-schema.sh` and extend `test_300_notice_triggers_live.py` with a foreign-thread answer that must NOT close the notice.

### WR-05: Email Settings silently drops an invalid address on Save, shows "Saved", then wipes the typed value and its error

**File:** `frontend/src/components/settings/EmailSettings.tsx:199-223`, `frontend/src/pages/SettingsPage.tsx:833-842`

**Issue:** `changes()` leaves an invalid `fromDraft` or `testDraft` out of the PUT (`&& addressOk(fromDraft)`). The Integrations save then succeeds with the other fields and shows "Saved". `adopt(updated)` calls `show(...)`, which resets `fromDraft` and `testDraft` to the server values and clears `touched`. The inline "That isn't an email address." line and the typed value both disappear.

Concrete input: type `notify@` into "Send from (address)", blur (the error shows), click Save Integrations. "Saved" appears and the field reverts to the old address. The operator reasonably believes the sender is set. The same happens with the delay: `30` is clamped to `60` and saved with no word.

For the test address this is safety-relevant. An operator who mistypes it believes test mail now goes to their inbox, but every non-production email stays held back.

**Fix:** let the card veto the save instead of silently omitting the field. For example, have the handle expose `invalid(): string | null`. `handleSaveIntegrations` returns early with that sentence in its error home when it is non-null, and `adopt` skips fields that were invalid at save time. Alternatively, send the invalid value and let the server's 400 sentence surface where the other refusals do.

## Info

### IN-01: The invite dialog says "We emailed an invitation to <invitee>" when the email went to the test address

**File:** `backend/app/api/org.py:60` (`_EMAIL_DELIVERY`), `backend/app/services/email_provider.py:299-309`, `frontend/src/components/org/InviteMemberDialog.tsx:167-172`

**Issue:** Outside production with a test address set, `_send` rewrites `to` and returns `sent`. `org.py` maps that to `email_delivery = "sent"`, and the dialog bolds the invitee's address. Only staging and dev are affected. A `SendOutcome` flag such as `redirected=True` would let the dialog say "Sent to the test address".

### IN-02: Every non-production held-back invite logs the recipient and the raw invite token at INFO

**File:** `backend/app/services/email_provider.py:359-361`

**Issue:** `logger.info("invite link for %s (org=%s): %s", to, org_name, link)` runs on every `suppressed` outcome. Before 300 that meant only `EMAIL_PROVIDER=none`. It now also covers every staging/dev send held back by the dev guard. The link carries the raw join token, and the module docstring promises that reasons never carry the recipient or a link. This is pre-existing for `none`; the scope widened. Consider logging the link only when `provider == "none"`.

### IN-03: `resolve_owner_run_model` does not resolve the OWNER's model the way the in-app door does

**File:** `backend/app/services/run_model_resolution.py:302-334`

**Issue:** The docstring says it reads "the OWNER's effective settings". But `load_user_settings(user_id)` ignores `user_id` and returns `load_app_settings()` (`models/user_settings.py:1320-1321`). The per-user default model (SEED-116, `apply_user_model_default`) that the in-app door applies is not applied here.

This is consistent with what the first drive actually runs on, and with how the resume reads it, so FIX-05's "resume on the starting provider" holds. D-17's "exactly as the in-app door does" does not. Correct the docstring, or apply the owner's `default_model` and derive the provider from it.

### IN-04: The Email tile reads "Ready" in production when no sender address is set, though every send will fail

**File:** `backend/app/services/health_probe.py:166-176`

**Issue:** When the provider is `resend` or `smtp` and no `email_from_address` / `INVITE_FROM_EMAIL` is set, the probe reads `up` ("Ready, nothing sent yet"). The first real send then fails with "No sender address is set.". A config check in `probe_email` would show the problem before the first waiting run instead of after it.

### IN-05: The From header is not frozen, so a Settings edit between Resend retries changes the idempotent request

**File:** `backend/app/services/email_provider.py:311-321`

**Issue:** D-31 freezes subject, text and html, but `sender` is rebuilt from Settings on every attempt. Consider an attempt that timed out after Resend had in fact accepted it. If the operator then edits "Send from", the retry under the same key gets `409 invalid_idempotent_request`. That is non-retryable, so the delivery is recorded `failed` for an email that was delivered. This is a narrow window. Freeze the sender on the row at first claim, or document it.

### IN-06: Overlapping refreshes in the schedule modal can land out of order

**File:** `frontend/src/components/workflows/WorkflowScheduleModal.tsx:207-234,381-409`

**Issue:** Run now no longer takes the `busy` guard (D-16), so its trailing `refresh()` can overlap a toggle's or delete's `refresh()`. Whichever response resolves last wins, so the list can briefly show a stale `is_active` or a deleted row. A failed QUIET refetch also gives no signal (`if (!quiet) setLoadFailed(true)`). A request-sequence counter that ignores stale responses fixes both.

---

_Reviewed: 2026-10-29T08:03:23Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
