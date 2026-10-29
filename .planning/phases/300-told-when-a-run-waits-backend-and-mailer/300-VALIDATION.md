---
phase: 300
slug: told-when-a-run-waits-backend-and-mailer
status: planned
created: 2026-10-29
nyquist_validation: false   # config.json; this file holds the UAT rows the CLAUDE.md scoreboard rule requires
close_gate: "299 G4-4a (signed-out link → sign in → land on the run) must run before 300 can CLOSE"
---

# Phase 300 — Validation: automated map, four-axis UAT, G-4 lived experience

The automated tests live in the plans (`300-01` … `300-05`). This file holds what code cannot prove:
the four-axis UAT rows (CLAUDE.md "UAT scoreboard recipe"), the FIX-05 cross-provider roster, and the
operator-recognisable G-4 scenarios. **A row may be blocked (⛔ with the reason and the blocking id), but
never silently omitted.**

## 1. Automated coverage (where each requirement is proven in code)

| Req | Proven by | Plan |
|-----|-----------|------|
| FIX-04 | `test_300_schedule_required_inputs.py` (create / patch / resume 422 by label; fire-time refusal recorded; tick does not overwrite) | 300-01 |
| FIX-05 | `test_300_unattended_provider.py` (model + provider recorded at launch and in the first ctx; one helper) | 300-01 |
| NOTE-02 | `test_300_notice_triggers_live.py` (one notice + one delivery per wait; answer/terminal close; re-ask keeps one; fail-soft), `test_300_drainer_once_live.py` (two drainers → one send; answered → skipped), `test_300_notification_drainer.py` (frozen payload, retries, stale sending) | 300-02, 300-04 |
| NOTE-03 | `test_300_run_waiting_email.py` (only name/org/wait/kind/links; escaping; no token, no query; signature), drainer SQL-constant assertion | 300-03, 300-04 |
| NOTE-04 | drainer opt-out cases (`skipped_opted_out`, notice kept), `test_300_me_preferences_email.py`, `EmailNotificationPreference.test.tsx` | 300-04, 300-05 |
| NOTE-06 | `test_300_mailer.py`, `test_276_invite_email_brand.py` (re-pointed, D-34), `test_300_clean_image_imports.py`, `test_300_invite_outcome.py`, `InviteMemberDialog.test.tsx`, `InvitationsTab.test.tsx`, `check-deploy-drift.sh` | 300-03, 300-05 |
| D-19 security | `test_300_rls_anon_live.py`, `test_300_migration_218_shape.py`, `test_181_secdef_privileges.py` | 300-02 |
| D-23 / D-24 | `test_300_email_step_honesty.py` | 300-03 |
| D-12 | `test_300_health_probe_email.py`, `HealthSignals.email.test.tsx` | 300-04 |
| D-15 / D-16 / D-26 | `scheduleOutcomeVocabulary.test.ts`, `WorkflowScheduleModal.test.tsx`, the D-26 trigger cases | 300-01, 300-02 |

⚠ **The clean-image test is an AST/requirements closure, not a Docker build** (Docker is denied in the agent
shell). CI's image build remains the authoritative proof; record its result at deploy.

## 2. Four-axis UAT (CLAUDE.md scoreboard rule — this phase touches the agent loop's resume and provider routing)

Method (Phase 185 recipe): drive each row as a real run with a per-request `model` + `provider`, read
verdicts from `workflow_runs` / `workflow_phases` / `notifications` / `notification_deliveries` /
`harness_audit`, mutating no global setting. The dev account is in TWO orgs — prove the active org first.

### 2a. Cross-provider — FIX-05 resume on the starting provider (full native roster + OpenRouter, 8 rows)

Roster **derived from `MODEL_CAPABILITIES` on 2026-10-29** (group by `provider`, newest registry-backed id;
re-derive at run time — never trust this list over the registry):

| # | Provider | Representative id (re-derive) | Row: key-launched run with an approval step → pause → owner switches their active provider to a DIFFERENT one → answer → resume | Expected |
|---|----------|-------------------------------|----------|----------|
| 1 | OpenAI | gpt-5.6-* (newest in registry) | | resumed phases' `workflow_phases` / ctx show the STARTING provider; `workflow_runs.metadata.provider` = starting provider |
| 2 | Anthropic | claude-sonnet-4-6 | | same |
| 3 | Google | gemini-3.5-flash / gemini-3.1-pro-preview | | same (highest-risk row for tool-call emission) |
| 4 | DeepSeek | deepseek-v4-pro | | same (`strict_json_schema` inert) |
| 5 | Zhipu / GLM | glm-5.2 | | same |
| 6 | MiniMax | MiniMax-M3 | | same |
| 7 | Moonshot / Kimi | kimi-k2.6 | | same (`emit_tier: coerce`; rate-limited at 299 X-7 — record ⛔ with the reason if it recurs) |
| 8 | OpenRouter | deepseek/deepseek-v4-pro (or newest) | | same (`native_tools: False` path) |

Each row is run twice: once from an **API-key** launch (`POST` inbound), once from a **schedule** (Run now).
A row without a configured key is ⛔ with the reason, never dropped.

### 2b. Multi-tool

| Row | Steps | Expected |
|-----|-------|----------|
| MT-1 | A scheduled workflow whose agent step uses `search_documents` + `execute_code`, then an approval step | the approval writes exactly one notice + one delivery; after the delay one email (redirected to the dev test address) arrives; the run resumes on its starting provider after approval |

### 2c. Parallel-thread

| Row | Steps | Expected |
|-----|-------|----------|
| PT-1 | Thread A streams a long chat while run B (scheduled, in thread B's own run thread) reaches its approval step | B gets one notice and, after the delay, one email; A's stream is unaffected; a chat `ask_user` in A (if the agent asks) produces NO notice (excluded kind) |

### 2d. Long-message

| Row | Steps | Expected |
|-----|-------|----------|
| LM-1 | A workflow whose kickoff carries a ≥ 5 KB input and whose question step prompt is long | the email body contains none of the prompt text and none of the input (NOTE-03); subject is "{name} is waiting on you" (or "[Test] …" on dev) |

## 3. G-4 lived-experience scenarios (operator-recognisable — Claude drives Chrome + the mail capture)

The dev account's active org is proven first. On dev, mail goes to the Settings **Test address** (D-10) —
set one in Settings → Integrations → Email before rows 1-3.

| # | Scenario | "I'd recognise failure here" |
|---|----------|------------------------------|
| G4-1 | **Email arrives once after the delay.** A scheduled run asks for approval and is left waiting past the delay (default 2 minutes). Exactly one email arrives (subject "[Test] {Workflow} is waiting on you"), naming the workflow, the org, "{n} minutes" and "approval", with "Open the run" → `/app/runs/<id>` and the Settings footer; HTML and plain text both read correctly; restarting the backend (both workers) during the wait still yields ONE email; `notification_deliveries.status = 'sent'` | two emails; an email before the delay; question text in the body; a link with `?` or a token; a comma-joined origin |
| G4-2 | **Answering in time sends none.** A second run is approved within the delay → no email; its delivery row reads `skipped_answered` | any email arrives |
| G4-3 | **Opt-out stops email, notice stays.** Settings → Preferences: the switch reads On; flip Off → still Off after a reload; a third waiting run sends no email, its delivery reads `skipped_opted_out`, the `notifications` row exists, and the run page still shows the wait | an email arrives; the notice row is missing; the switch shows On before its read answers |
| G4-4 | **Invite failure line in the dialog.** With the mail provider made to fail (e.g. a bad `RESEND_API_KEY` in production mode on a throwaway env, or SMTP pointed at a closed port), invite a member → "Invitation created" + "Invitation created, but the email didn't send. Copy the link and send it yourself.", Copy link focused and working; the row shows "Email not sent"; a Resend after fixing the provider removes the chip | the invite is not created; "Please try again"; a provider name or error code on screen; the chip on a not-configured install |
| G4-5 | **Schedule row names the blank input.** Schedules dialog with three rows: one row reads "Didn't run — Client name is required and has no value. Add a new schedule with it filled in, then delete this one." (amber), never `launch_failed`; a paused-for-approval row reads "Waiting on you — answer in the run."; Run now on row 2 spins only row 2, the list never reads "Loading…", row 2's result lands under row 2 while row 1's stays | a raw token on screen; a truncated refusal; the list swapped for "Loading…"; every row disabled |
| G4-6 | **Signed-out link → sign in → the run.** Open the G4-1 email's "Open the run" link in a signed-out browser → sign-in → lands on `/app/runs/<id>` showing the wait. ⚠ **Depends on Phase 299's postponed G4-4a** (the sign-in return); run G4-4a first, then this row | landing on `/app` home; a "can't be opened" card for the owner |
| G4-7 | **Control Room Email tile.** On dev without a test address → "Held back"; with one → "Test mode"; after the G4-4 forced failure → "Last send failed" with a time and a reason that names no address | the tile is red for Off / Held back / Test mode / a skipped send; the reason shows a recipient |
| G4-8 | **Email step honesty.** A workflow email step sends a markdown body with a heading, bold, a list and line breaks → the received mail shows rendered HTML (no literal `##` / `**`) and the text part keeps its lines; the step receipt reads "Destination: {to} (via {host})" | one flattened line of raw markdown; "Destination: smtp.gmail.com" alone |

Run order: G4-5 (no mail needed) → G4-1 → G4-2 → G4-3 → G4-7 → G4-4 → G4-8 → G4-6 (after 299's G4-4a).

## 4. Operator actions (never executed by an agent; each cloud write needs its own approval)

1. Paste `supabase/migrations/218_run_waiting_notifications.sql` into the **cloud** SQL editor, then read
   `get_advisors(security)` — expect no new ERROR (the two tables have RLS; the two functions are not
   executable by PUBLIC/anon).
2. Coolify backend env: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and confirm **`ENVIRONMENT=production`**
   (D-30 — otherwise every cloud email is redirected or held back).
3. Resend: add and verify `notify.<domain>`; Hostinger DNS: SPF, DKIM, DMARC `p=none` (D-03).
4. Settings → Integrations → Email on cloud: Send from (address) `notify@notify.<domain>`, name "Syrel".
5. One-box: `EMAIL_PROVIDER=smtp` + `SMTP_*`; confirm the VPS allows outbound SMTP on the chosen port.
6. Production has never sent an app email (D-25, measured 2026-10-29: 0 `org_invitations`, 0 invitation
   audit events) — the first real send is G4-1 on cloud after deploy; watch the Email tile.

## 5. Register routing at close

- BUG-261027-03 / -04 / -05, BUG-260828-05 / -06 → `closed` only when their G-4 rows pass (G4-5, 2a, G4-8).
- SEED-281 stays `folded` until Phase 301 ships the in-app half.
- 300 SUMMARY must tell 301's planner: no `GET /notifications` route exists (D-29); `notifications` has an
  owner-only SELECT policy and the partial unique index `(recipient_id, run_id) WHERE closed_at IS NULL`.
