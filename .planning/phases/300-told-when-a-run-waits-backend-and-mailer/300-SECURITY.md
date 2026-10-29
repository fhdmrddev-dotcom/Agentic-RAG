---
phase: 300
slug: told-when-a-run-waits-backend-and-mailer
status: verified
threats_total: 41
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-10-29
audited_at_head: 2485bd725
uf1_closed: 2026-10-29 (cross-thread variant fixed in 218; same-org residual → SEED-396)
---

# Phase 300 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> The register is the union of the five plan-time `<threat_model>` blocks (300-01..05, T-300-01..41).
> Each threat was checked against the code at HEAD `2485bd725`, after the 300-REVIEW fix pass (WR-01..05, IN-01..04). The check used the code itself, not SUMMARY prose.
> Evidence runs from this audit: `pytest tests/unit/test_300_*.py` gave **287 passed**. The three live suites (`test_300_rls_anon_live.py`, `test_300_notice_triggers_live.py`, `test_300_drainer_once_live.py`) gave **74 passed** against the local Postgres, run under the local-DB lock (taken with noclobber and released).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → `/schedules` create / patch | Author-supplied inputs and toggles. The client pre-check is advisory only | Schedule inputs (untrusted) |
| scheduler tick → launch | A stored schedule's inputs meet a definition that may have changed since the schedule was saved | Declared inputs |
| unattended launch → resume | The provider a run started on must survive until a resume hours later | (model, provider) pair |
| engine / answer route → `messages` INSERT → definer trigger | `notify_on_ask_row` runs inside the engine's fail-closed prompt insert | `tool_calls` JSON (run_id, tool_call_id) |
| PostgREST (anon / authenticated) → `notifications`, `notification_deliveries` | Client roles must never read another user's notice, or any outbox row | Notices; frozen email bodies |
| SECURITY DEFINER functions → deny-all tables | Elevated writes must not be reachable by clients or hijackable through `search_path` | Notice / delivery rows |
| app → Resend API (internet) / operator SMTP relay | The API key, SMTP credentials and the email payload leave the process | Secrets (high); the recipient address |
| tenant-controlled names → email headers and HTML | Workflow names, org names, the email step's markdown body | Markup / header-injection surface |
| non-production → real inboxes | Dev and staging must never mail real people | Recipient address |
| worker A ‖ worker B ‖ restarted worker → outbox | Concurrent claimers over one row | Delivery state |
| `GET /admin/backpressure` → operator browser | Failure reasons from every org reach one operator screen | Reasons (must be address-free) |
| member browser → `/me/preferences` | Ungated per-user write. It must only ever touch the caller's own row | Opt-out flag |
| operator browser → `/settings` | Gated singleton write of the mail knobs | Sender identity, test address, delay |
| server → browser (settings read, invite results) | Must never carry a secret, a provider error or another user's data | Provider name, delivery word |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|-----------------------|--------|
| T-300-01 | Tampering | `api/schedules.py` create / patch | mitigate | `_refuse_blank_required` (`schedules.py:92-106`) calls the shared `missing_required_labels` (`inbound_inputs.py:180-183`) and raises 422 before any write. Create: `:157`, before `create_schedule` `:159`. Patch: `:238-246`, before `update_schedule` `:247`. Fire time also re-checks (`scheduler_service.py:157-170`). Tests: `test_300_schedule_required_inputs.py:144,154,209,217,281`. | closed |
| T-300-02 | Information disclosure | patch door existence | mitigate | `schedules.py:239-240`: the check runs only when the owner-scoped `get_schedule(..., user_id=)` returns a row. Otherwise control falls to the unchanged 404 at `:253-254`. Test: `test_300_schedule_required_inputs.py:239` (a foreign schedule gets the existing 404, with no check). | closed |
| T-300-03 | Information disclosure | scheduler logs | mitigate | `scheduler_service.py:164-168` logs the schedule id and `len(labels)` only. The stored outcome carries labels, never values. | closed |
| T-300-04 | Elevation / integrity | unattended resume provider | mitigate | `unattended_launch.py:189-200` calls `resolve_owner_run_model(owner_id)` once and records `model` / `provider` on the INSERT (`:302` writes `metadata.provider`) and in the first drive's ctx (`:254-255`). IN-03 (`b7e03e417`) now walks the in-app door's chain (`run_model_resolution.py:336-344`). Tests: `test_300_unattended_provider.py:39,121,162`. | closed |
| T-300-05 | Denial of service | `resolve_owner_run_model` | mitigate | `run_model_resolution.py:336` runs `load_user_settings` through `run_in_threadpool`. `:345-352`: any exception logs identifiers only and returns `(None, None)`. Tests: `test_300_unattended_provider.py:78` (a failed load gives `(None, None)` and never raises) and `:131`. | closed |
| T-300-06 | Repudiation / honesty | schedule `last_status` | mitigate | `scheduler_service.py:216-243` (WR-01 `edfba86b1`) reads this drive's run by id: `paused` → `waiting`, and `failed` / `cancelled` are recorded as themselves. The words come from one leaf (`scheduleOutcomeVocabulary.ts:33-67`, where a server sentence is used verbatim at `:60-62`). Migration 218 `notify_on_run_status` (`:299-316`) flips `waiting` to the terminal status. Tests: `test_300_unattended_provider.py:225,238,246`; live `test_300_notice_triggers_live.py:530,539`. | closed |
| T-300-07 | Spoofing (UI) | schedule row rendering | mitigate | `WorkflowScheduleModal.tsx:477` renders `scheduleOutcomeLine(...)` as React text. There is no `dangerouslySetInnerHTML` in the modal (grep: 0). An unknown single token reads `UNDESCRIBED` (`scheduleOutcomeVocabulary.ts:47-50,66`), never the token. Test: `__tests__/scheduleOutcomeVocabulary.test.ts`. | closed |
| T-300-08 | Denial of service | `notify_on_ask_row` inside the engine's insert | mitigate | `218_run_waiting_notifications.sql:214-265`: the whole body, including the `tool_calls->0` read (moved inside per the 300-02 deviation), sits in `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING … END`. The same holds for `notify_on_run_status` `:292-319`. Live: `test_300_notice_triggers_live.py:464` (a planted failing CHECK, and the message still lands) and `:475`. | closed |
| T-300-09 | Information disclosure | `notifications` / `notification_deliveries` | mitigate | `218:86-98`: RLS on, then REVOKE ALL from PUBLIC / anon / authenticated / service_role, then `GRANT SELECT` to authenticated, plus one `recipient_id = (SELECT auth.uid())` SELECT policy. `:140-148`: the outbox has RLS on, every client revoked, and no policy. Mirrored into `scripts/full-schema-supplement.sql:868-878`, because `pg_dump --no-privileges` drops grants. Live: `test_300_rls_anon_live.py:70,87,103,126,144,171,196,236,241`. | closed |
| T-300-10 | Elevation of privilege | SECURITY DEFINER functions | mitigate | `218:204-205,286-287`: `SECURITY DEFINER SET search_path = ''`, with every name `public.`-qualified. `:277-280,331-334`: EXECUTE revoked FROM PUBLIC (not only anon) and granted to service_role. Mirrored at `full-schema-supplement.sql:881-888`. Live: `test_300_rls_anon_live.py:216` (`has_function_privilege` is false for public / anon / authenticated) and `:224`. | closed |
| T-300-11 | Spoofing / tampering | notice org | mitigate | `218:219-230`: `org_id` comes from `workflow_runs.org_id` (`r.org_id`). Nothing in the function reads `NEW.org_id`. Unit: `test_300_migration_218_shape.py:197`. Live: `test_300_notice_triggers_live.py:243-245` (the message carries org B and the notice gets org A, with a non-vacuity check). | closed |
| T-300-12 | DoS / duplicate sends | outbox | mitigate | `218:106` makes `notification_id` UNIQUE, and `:77-78` adds a partial unique index `(recipient_id, run_id) WHERE closed_at IS NULL`. `:235-246` uses `ON CONFLICT … DO UPDATE` / `DO NOTHING`. Tests: `test_300_migration_218_shape.py:129,146`; live `test_300_notice_triggers_live.py:425` (a re-ask keeps one open notice). | closed |
| T-300-13 | Tampering | `run_id` cast in the trigger | mitigate | `218:218`: a UUID regex (`~*`) guard runs before the `::uuid` cast at `:222`, and the same guard protects `_schedule_id` at `:299`. Live: `test_300_notice_triggers_live.py:320` (`not-a-uuid'; DROP TABLE x; --` writes nothing and the message lands) and `:559`. | closed |
| T-300-14 | Information disclosure | excluded pause kinds | mitigate | `218:217` requires `NEW.origin = 'harness'`. `:219-226` requires that the run is found in `workflow_runs`, has an owner, is not golden, and has `status IN ('active','paused')`. Live: `test_300_notice_triggers_live.py:285` (a deep-origin prompt naming a real run), `:298` (golden), `:305` (ownerless), `:312-313` (completed / failed / cancelled / **cap_paused**). See R-4: the status gate is what excludes `cap_paused`, not the register's claim that it is never written. | closed |
| T-300-15 | Repudiation | cloud parity | accept | AR-01. Recorded in `300-VALIDATION.md:98-99` (paste 218 into cloud, then `get_advisors(security)`) and in `300-02-SUMMARY.md` "Operator actions (deploy)". | closed |
| T-300-16 | Tampering | subject / From name header injection | mitigate | `email_provider.py:67-70,105-107`: `one_line` turns every C0 control, DEL, NEL, LS and PS into a space. It is applied to the subject `:342`, the from-address `:357`, the from-name `:360` and the invite subject `:403`. SMTP path: `EmailMessage` assignment refuses CR/LF (`:275-280`). Resend takes JSON (`:183`). Step email: `smtp_adapter.py:95,252`. Tests: `test_300_mailer.py:420-428` (planted `\r\nBcc:`, with `parsed["Bcc"] is None`), `:431`; `test_300_run_waiting_email.py:89`. | closed |
| T-300-17 | Tampering (XSS in mail clients) | run-waiting / invite HTML | mitigate | `run_waiting_email.py:101-113`: `html.escape` on the name, org and duration, and `quote=True` on both hrefs. `email_provider.py:137` escapes the logo URL. `:391-392` escapes the org and the link (WR-02). Tests: `test_300_run_waiting_email.py:105,158`; `test_300_mailer.py:449`. | closed |
| T-300-18 | Tampering (XSS) | workflow email step markdown | mitigate | `smtp_adapter.py:104-106`: `MarkdownIt("js-default", {"html": False}).disable(["image","table","strikethrough","hr"])`. `:110-120` caps headings at h3. `:116-121` makes `validateLink` allow http / https / mailto only, which is narrower than the plan's default. Tests: `test_300_email_step_honesty.py:169,175,180,186,196` (no `commonmark`). | closed |
| T-300-19 | Information disclosure | run-waiting email content | mitigate | `run_waiting_email.py:63-70`: the keyword-only signature takes exactly `workflow_name, org_name, waited_seconds, run_id, kind`. Links are `{origin}/app/runs/{id}` and `{origin}/app/settings`, with no query and no token (`:83-84`). Tests: `test_300_run_waiting_email.py:150` (no prompt / content parameter) and `:119`; `test_300_notification_drainer.py:361`. | closed |
| T-300-20 | Information disclosure | logs and stored reasons | mitigate | Resend: the body is never logged, and only the status plus an enum-guarded `name` is (`email_provider.py:160-168,207-215`). SMTP logs codes only (`:297-315`), and the password goes only to `session.login` `:295`. Reasons are fixed sentences without the address (`:363`). The invite failure log names the invitation id (`org.py:75,85-88,446-447`). Tests: `test_300_mailer.py:221-247,343-368` (caplog with `SECRET_MARKER` / `SMTP_PASSWORD_MARKER`); `test_300_notification_drainer.py:494`. See R-2. | closed |
| T-300-21 | Information disclosure | dev mail reaching real inboxes | mitigate | `email_provider.py:344-355`: when `not is_production_environment()`, mail is redirected to the Settings test address with a `[Test] ` subject, or suppressed when no test address is set. Production ignores the redirect. IN-01 adds `redirected` (`:92,369`) so the UI never claims the invitee was mailed. Tests: `test_300_mailer.py:130,141,159`; `test_300_invite_outcome.py:116,126`. | closed |
| T-300-22 | Repudiation | invite email failure only logged | mitigate | `org.py:64-88` `_record_invite_delivery` writes `email_delivery` / `email_failed_at` / `email_failure` on the caller's RLS connection, and is called at `:450` (send) and on resend. The response carries `email_delivery` (`:476`), and the list projects it (`:497,519`). The CHECK is at `218:188-190`. Tests: `test_300_invite_outcome.py:91,135,152,179,205`. | closed |
| T-300-23 | Tampering (supply chain) | `requirements.txt` | mitigate | `requirements.txt:81-84` declares `markdown-it-py>=4.0.0`, which was already transitive. There is no `resend` line, and no `import resend` under `app/` (grep: 0). Tests: `test_300_clean_image_imports.py:87,106,110`. | closed |
| T-300-24 | Spoofing | sender identity | accept | AR-02. Documented in `docs/OPERATOR.md:460` (SPF, DKIM, DMARC at `p=none`). | closed |
| T-300-25 | Denial of service | blocking SMTP / HTTP calls | mitigate | `send_email` is documented as blocking (`email_provider.py:373`). Every caller goes through `run_in_threadpool`: `org.py:444,573` and `notification_drainer.py:135`. The step adapter does too (`smtp_adapter.py:493,563`). Timeouts: `RESEND_TIMEOUT_SECONDS = 10.0` (`:64,185`) and `SMTP_TIMEOUT_SECONDS = 15.0` (`:65,288,290`). | closed |
| T-300-26 | DoS / duplicate sends | `claim_due_deliveries` | mitigate | `db/notifications.py:51-69`: `FOR UPDATE OF d SKIP LOCKED`. `:71-83,225-259`: the flip to `'sending'` runs inside the same transaction. Migration UNIQUE as T-300-12. `Idempotency-Key: run-waiting/{id}` (`notification_drainer.py:135`, `email_provider.py:181-182`). WR-03 lease renewal matches on `attempts` (`notifications.py:156-163`, drainer `:130-132`). Live: `test_300_drainer_once_live.py:185` (two drainers, one send), `:315,355,373`. | closed |
| T-300-27 | Tampering (integrity) | retries | mitigate | `notifications.py:77-80`: `subject/text/html = COALESCE(existing, new)`, and a frozen row is never re-rendered (`:231`). `MAX_ATTEMPTS = 3` (`:44`) is enforced in `CLAIM_SQL` `:64` and in the drainer `:153`. The key is stable per delivery id. Tests: `test_300_notification_drainer.py:238,439,504`; live `test_300_drainer_once_live.py:254`. See R-1 (IN-05: the From header is not frozen). | closed |
| T-300-28 | Information disclosure | email after the answer | mitigate | `notification_drainer.py:113-116` calls `still_waiting` before every send. `notifications.py:111-137` requires the notice open, the run active or paused, and an unanswered harness prompt for the run in the run's own thread. Tests: `test_300_notification_drainer.py:200,258`; live `test_300_drainer_once_live.py:217,229`. | closed |
| T-300-29 | Information disclosure | opt-out | mitigate | `notification_drainer.py:117-120` reads the opt-out at send time (`OPTED_IN_SQL`, `notifications.py:140-146`). It records `skipped_opted_out` and the notice stays. Tests: `test_300_notification_drainer.py:214`; live `test_300_drainer_once_live.py:242`. | closed |
| T-300-30 | Information disclosure | prompt / document text in email | mitigate | `CLAIM_SQL` (`notifications.py:52-57`) selects ids, the workflow name, the org name and the waited seconds. It selects no `content` and no prompt JSON. The render receives five facts (`:233-239`). Tests: `test_300_notification_drainer.py:471,476` (a scan over the SQL constants) and `:361`. | closed |
| T-300-31 | Denial of service | crash mid-send on SMTP | mitigate | `RECLAIM_SQL` (`notifications.py:91-109`): a stale `'sending'` row is re-queued only when it is Resend, Resend is still configured, and attempts remain. Otherwise it is `failed` with `INTERRUPTED_REASON` (`:47`). Live: `test_300_drainer_once_live.py:282`. | closed |
| T-300-32 | Denial of service | test isolation | mitigate | `main.py:542-552` builds the drainer only under `if not _setup_mode and RUN_BOOT_SWEEPS`, and shutdown is at `:679`. `tests/conftest.py:62` sets `RUN_BOOT_SWEEPS = False`. Tests: `test_300_drainer_wiring.py:41,110,118`. | closed |
| T-300-33 | Information disclosure | Control Room reason | mitigate | `health_probe.py:131-180` `probe_email` returns the state, the mode, timestamps, `last_failure_reason` (the mailer's fixed, address-free sentences) and `config_problem` (IN-04). It never returns a recipient, a subject or a link. `FACTS_SQL` (`notifications.py:177-190`) reads `sent_at`, `updated_at` and `reason` only. Tests: `test_300_health_probe_email.py:97,153,183`. | closed |
| T-300-34 | Repudiation | failures only logged | mitigate | `RECORD_SQL` (`notifications.py:165-175`) stores the status, reason, provider and message id on the row. Every drainer arm records an outcome (`notification_drainer.py:113-180`). The Email tile reads it (`latest_delivery_facts` `:321`). Tests: `test_300_notification_drainer.py:126-226`; `test_300_health_probe_email.py:97-121`. | closed |
| T-300-35 | Elevation of privilege | `PUT /me/preferences/notification-email` | mitigate | `me_preferences.py:169-190`: `get_user_pg_connection` runs one statement, `INSERT … VALUES (auth.uid(), …) ON CONFLICT … preferences \|\| $1`. The body is `{enabled: bool}` only (`:55-57`). Only `get_current_user` is required, with no `model_management` dependency. Tests: `test_300_me_preferences_email.py:138,180,218,231` (no token gives 401/403, equal to the sibling GET). | closed |
| T-300-36 | Tampering | the switch clearing `default_model` | mitigate | A separate route with its own body (`me_preferences.py:55-57,169`). The default-model PUT is unchanged. Tests: `test_300_me_preferences_email.py:184` (a byte-identical hash pin against the plan base), `:189`, and `:138` (recorded SQL). | closed |
| T-300-37 | Information disclosure | `GET /settings` | mitigate | `settings.py:128-132,477-481`: the response carries `email_provider=configured_provider()` (the name only). No `resend_api_key` or `smtp_*` field exists in the model. Tests: `test_300_settings_email_knobs.py:105` (no mail secret is a response field), `:114,118` (the provider is never writable). | closed |
| T-300-38 | Tampering (header injection) | `email_from_name` / addresses | mitigate | `settings.py:658-674` `_is_single_email_address` refuses whitespace, controls, `,` / `;`, display names and parser rewrites. `:942-952` returns 400 for anything else. `:955-965`: the name must be 1-60 characters with no control characters (400). The mailer's `one_line` is the second wall (T-300-16). Tests: `test_300_settings_email_knobs.py:200,217,225`. | closed |
| T-300-39 | Denial of service | delay knob | mitigate | `settings.py:920-937`: `60 <= v <= 3600`, else 400 through `_range_refusal_detail`. `218:166-168` adds a CHECK as the backstop. Client clamp: `EmailSettings.tsx:65,79`. Tests: `test_300_settings_email_knobs.py:135,145,164`; `test_300_migration_218_shape.py:275`; live `test_300_notice_triggers_live.py:502`; `__tests__/EmailSettings.test.tsx`. | closed |
| T-300-40 | Information disclosure | invite dialog copy | mitigate | `inviteDeliveryCopy.ts` is a zero-import leaf with no provider, code or retry. `InviteMemberDialog.tsx:173-189` and `InvitationsTab.tsx:239,304` render only `INVITE_DELIVERY.*`. The list endpoint projects `email_delivery` but not `email_failure` (`org.py:497`). Test: `InviteMemberDialog.test.tsx` (the word check excludes Resend, SMTP, 500, "error code" and "try again"). | closed |
| T-300-41 | Spoofing (UI) | rendered names | mitigate | Grep for `dangerouslySetInnerHTML` / `innerHTML` returns 0 in `EmailSettings.tsx`, `EmailNotificationPreference.tsx`, `InviteMemberDialog.tsx`, `InvitationsTab.tsx`, `inviteDeliveryCopy.ts`, `HealthSignals.tsx` and `WorkflowScheduleModal.tsx`. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Counts:** 41 total = 39 mitigate + 2 accept + 0 transfer. Open: 0.

### Residual observations (non-blocking; recorded, not mitigation gaps)

| ID | Threat Ref | Observation | Severity |
|----|------------|-------------|----------|
| R-1 | T-300-27 | 300-REVIEW IN-05, deferred. `email_provider.py:357-361` rebuilds `sender` from Settings on every attempt, so the From header is not part of the frozen payload. The subject and both bodies ARE frozen, so the declared mitigation holds. If an operator edits "Send from" between a timed-out-but-accepted Resend attempt and its retry, the retry gets a 409 and is recorded `failed` for a delivered email. This is an integrity-of-record defect, not a disclosure. | low |
| R-2 | T-300-20 | When `EMAIL_PROVIDER=none`, `send_invite` still logs the recipient and the raw-token link at INFO (`email_provider.py:407-412`). This is the shipped Phase 167 offline flow, kept deliberately. IN-02 (`e6548dd6a`) narrowed it to that provider only, so dev-guard hold-backs no longer log it. Pinned by `test_276_invite_email_brand.py:87,97`. | low |
| R-3 | T-300-04 | IN-03 (`b7e03e417`) now derives the provider from the owner's resolved model, not from `active_provider`. The fix report marks it "requires human verification", and the D-17 cross-provider UAT has not been re-run for it. The security property (a pair recorded at launch from the OWNER's settings) holds. Whether the pair is the right one is owed UAT. | low |
| R-4 | T-300-14 | The register says "cap_paused is never written to workflow_runs". The CHECK `workflow_runs_status_check` (`supabase/full-schema.sql:4727`) does allow it, and `threads.py:2345` reads it from `workflow_runs`. The control that excludes it is the trigger's `r.status IN ('active','paused')` gate (`218:226`), pinned live at `test_300_notice_triggers_live.py:312`. The mitigation holds; the rationale was imprecise. | info |
| R-5 | T-300-09 / T-300-10 | `tests/integration/test_181_secdef_privileges.py` has 4 inherited failures. Two RPC signatures were stale before 218 (300-02 SUMMARY "Deferred Issues"). That suite is not evidence for this phase. Every 218 privilege assertion lives in `test_300_rls_anon_live.py`, which passed here. | info |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-300-15 | Migration 218 reaches cloud only by an operator paste into the cloud SQL editor, with per-action approval, followed by `get_advisors(security)`. That is the CLAUDE.md Supabase MCP write rule. A phase executor never writes to production. The step is recorded in `300-VALIDATION.md:98-99` and `300-02-SUMMARY.md` and remains owed at deploy. The drainer depends on 218, so 218 must land before the backend deploy (`300-04-SUMMARY.md` "Operator notes"). | plan 300-02 threat register (plan-time) | 2026-10-29 |
| AR-02 | T-300-24 | Sender authentication (SPF, DKIM, DMARC `p=none` on the sending domain) is an operator DNS action outside the codebase. It is documented in `docs/OPERATOR.md:460`. | plan 300-03 threat register (plan-time) | 2026-10-29 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

All five SUMMARY threat sections say "None", or map every item to T-300-01..41. 300-02 has "Threat model coverage" and 300-05 has "Threat surface" in place of a `## Threat Flags` heading. The 300-REVIEW security-relevant findings each map to a registered threat, and each was verified fixed at HEAD:

- **WR-02** (an unknown `SMTP_SECURITY` sent the password in plaintext) maps to T-300-20. Fixed in `288bafcca`: `email_provider.py:228-242,266-269,293-295`. Pinned by `test_300_mailer.py:343,356,371`.
- **WR-03** (the lease could expire on rows queued in the same batch) maps to T-300-26 / T-300-31. Fixed in `23507f0d3`: `notifications.py:156-163`, drainer `:130-132`. Pinned live by `test_300_drainer_once_live.py:315,355,373`.
- **WR-04** (the definer close-on-answer was unscoped) maps to T-300-10. Fixed in `c5e28cacf`: `218:254-261`, also in `supabase/full-schema.sql:882`. Pinned live by `test_300_notice_triggers_live.py:352,380`.
- **WR-01** maps to T-300-06, **IN-01** to T-300-21 / T-300-40, **IN-02** to T-300-20, **IN-03** to T-300-04, and **IN-04** to T-300-33. All are verified above.

**One unregistered flag (WARNING, not a blocker).**

| ID | Surface | Observation | Severity |
|----|---------|-------------|----------|
| UF-1 | client-written ask rows reach the definer trigger | The register's boundary assumes only the engine and the answer route write `role='system'` ask rows. But `"Users can insert their own messages"` (`supabase/full-schema.sql:9156`) checks only `user_id = auth.uid()` and the caller's org. It does not check thread ownership or `origin`. So an authenticated user can insert a harness-origin `ask_user_prompt` row whose `run_id` names someone else's active or paused workflow run. The SECURITY DEFINER `notify_on_ask_row` then writes or re-points that owner's open notice (`218:227-237`, where `ON CONFLICT DO UPDATE SET tool_call_id`). That stale notice is what Phase 301 will list. Placed in the victim's own thread, the same row also satisfies `STILL_WAITING_SQL`, so the victim can be emailed. A forged `ask_user_response` in that thread can likewise close the notice or suppress the email. **Bounds:** the attacker must already know the victim's run UUID, plus the thread UUID and tool_call_id for the email and suppression variants. The email content is fixed (the victim's own workflow and org name, plus the run link). Nothing is disclosed to the attacker. The underlying policy gap is pre-existing and not introduced by 300. **Not driven live** (that would need writes to the local DB); this is derived from the policy and function text. Suggested route: Phase 301, which reads notices, should ignore notices whose prompt row is not in the run's own thread, or 218/301 should gate the trigger on `NEW.thread_id = wr.thread_id`. The `messages` INSERT policy gap belongs in its own seed. | low |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-29 | 41 | 41 | 0 | gsd-security-auditor (Claude), HEAD `2485bd725`. Unit 287 passed; live 74 passed under the local-DB lock |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-29. Two items are owed outside this audit: AR-01 (the cloud paste of 218 plus `get_advisors(security)`) at deploy, and R-3's cross-provider UAT.

## UF-1 follow-up (orchestrator, 2026-10-29)

| Item | Result |
|---|---|
| Cross-thread forged prompt (the row in the attacker's own thread names the victim's run) | **CLOSED.** `notify_on_ask_row()` now reads the run only when `wr.thread_id = NEW.thread_id` (`218_run_waiting_notifications.sql`, the ask-prompt SELECT). Migration 218 was amended in place (not yet in cloud), the function re-applied to the local DB in one transaction (EXECUTE still revoked from anon), and `full-schema.sql` regenerated without `--reset`. RED first: `test_a_prompt_outside_the_runs_thread_writes_no_notice` failed on the old function, then passed; the three live suites read **75 passed**. |
| Cross-thread forged answer | Already CLOSED by 300-REVIEW WR-04 (close scoped to the answer's thread). |
| Same-org forged row written INTO the victim's own thread (needs thread UUID + run UUID) | **ACCEPTED residual, routed.** The root cause is the pre-existing `messages` INSERT policy (no thread-ownership / origin check). Planted as **SEED-396** with a trigger on the next phase touching messages RLS, the answer route or notice readers (Phase 301). Bounds: same org, random UUIDs, fixed email content, no disclosure. |

