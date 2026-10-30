---
status: complete-by-decision
phase: 300-told-when-a-run-waits-backend-and-mailer
source: [300-VERIFICATION.md, 300-VALIDATION.md]
started: 2026-10-29
updated: 2026-10-29
rows_total: 15
rows_run: 14
rows_blocked: 1  # G4-8 (real mailbox; Resend deferred)
driver: operator (Claude can drive the API/DB rows on request)
---

# Phase 300 — Human UAT (closed 2026-10-30 by decision)

**14 of 15 rows PASS; G4-8 ⛔ owed by decision.** The phase is closed under the operator's 2026-10-30 mandate ("continue autonomously until you finish this phase"). G4-8 and the real-provider half of G4-1 need a real mail provider, which the operator deferred (2026-10-29), and sending a real email needs an explicit OK. Re-open trigger: the day a mail provider is configured, run G4-8 and the real-provider half of G4-1, then close BUG-260828-05/06.

Verification returned `human_needed` (`300-VERIFICATION.md`): **5/5 ROADMAP success criteria and 6/6 requirements
(NOTE-02, NOTE-03, NOTE-04, NOTE-06, FIX-04, FIX-05) are verified in code and tests**, with no gaps. What is left
needs a real mail provider, a signed-out browser, the cross-provider roster, or an operator decision.

Full row text (steps, pass line, failure line) lives in `300-VALIDATION.md`. Fill the Verdict + Evidence cells there.

⚠ **Close gate:** G4-6 needs Phase 299's sign-in return, whose row **G4-4a was postponed 2026-10-29**. Run 299 G4-4a
before G4-6; Phase 300 cannot close until both have run.

## Rows

| Row | What | Who can drive it | Run order |
|---|---|---|---|
| G4-5 | Schedule row names the blank input; Run now busies only its row | Claude (Chrome, local) | 1 |
| G4-7 | Control Room Email tile: Held back / Test mode / Last send failed / Can't send | Claude (Chrome, local) | 2 |
| G4-2 | Answering within the delay sends none (`skipped_answered`) | Claude (API + DB, local) | 3 |
| G4-3 | Opt-out: switch Off survives reload; no email, notice still written | Claude (Chrome + DB, local) | 4 |
| G4-4 | Invite failure line + Copy link focused; "Email not sent" chip | Claude (local, forced failure) | 5 |
| FIX-05 | Paused key- and schedule-launched run resumes on its starting provider, full native roster + OpenRouter (8 rows, derived from `MODEL_CAPABILITIES`); **re-run because IN-03 (`b7e03e417`) changed provider derivation after planning** | Claude (API, local) | 6 |
| MT-1 | Multi-tool scheduled run then approval: one notice + one delivery | Claude (API, local) | 7 |
| PT-1 | Thread A streaming while scheduled run B reaches approval | Claude (Chrome, local) | 8 |
| LM-1 | ≥ 5 KB kickoff + long question prompt: email body carries none of it | Claude (API + rendered email, local) | 9 |
| G4-1 | **A real email arrives once after the delay** — Resend (cloud) or SMTP (one-box) from a built image | Operator (needs a real key / mailbox) | 10 |
| G4-8 | Email step: rendered markdown with line breaks; receipt names the recipient | Operator (real mailbox) | 11 |
| G4-6 | Signed-out email link → sign in → lands on `/app/runs/<id>` | Operator (signed-out browser) — **after 299 G4-4a** | 12 |
| COPY | Approve or change three un-specced strings the review fixer wrote: WR-05 save veto ("An email address in the Email card isn't valid. Fix it, then save again."), IN-01 test-address invite line ("Outside production, the email went to the test address set in Settings, not to {invitee}. Copy the link and send it yourself."), IN-04 tile state "Can't send" | Operator decision | any |
| DEPLOY | Paste migration 218 (incl. WR-04 + UF-1 amendments) into cloud SQL editor → `get_advisors(security)`; Coolify `EMAIL_PROVIDER`, `RESEND_API_KEY`, `ENVIRONMENT=production`; Resend sender on `notify.<domain>` + SPF/DKIM/DMARC at Hostinger; one-box outbound SMTP; CI image build | Operator, only on "deploy" (each cloud write needs per-action approval) | at deploy |

⏸ **Resend DEFERRED by operator (2026-10-29: "I want to defer resend for now").** 299 + 300 may deploy with `EMAIL_PROVIDER` unset/`none`: notices are still written, deliveries record `suppressed` ("Email is not set up on this server."), invites fall back to Copy link. Migration 218 still goes first (the drainer and triggers need it). G4-8 and the real-mailbox half of G4-1 stay owed until a provider is configured (Resend on cloud, or SMTP on the one-box).

✅ **DEPLOYED 2026-10-29** — production `31416d335` (master `f73dc7cb5`), 299 + 300 together; new backend up 19:26:45 UTC (`/links` 404 → 401), frontend bundle carries 299 copy. Cloud has 0 notices so far.

✅ **Migration 218 applied to cloud 2026-10-29** (Supabase MCP, operator "apply 218"): verify query PASS; app_settings 4 email columns (delay 120), org_invitations 3; `get_advisors(security)` 0 ERROR — the only new lint is INFO `rls_enabled_no_policy` on `notification_deliveries` (deny-all by design, D-19); the two new definer functions are not flagged (EXECUTE revoked). Supabase Auth Redirect URLs added by the operator (cloud).

## Results (2026-10-29, Claude, local)

Driven in Chrome as `fhdmrd.dev@gmail.com` (active org `c1f18150…`, "fhdmrd.dev@gmail.com's Organization"),
backend `:8000` reloaded 12:50 local with 300 code; local mailer `EMAIL_PROVIDER=none` (probe: `mode off`).
Fixture: workflow `300 G4-5 schedule rows` (`8d99d53c…`, note → "Approve the note?" ask, 300 s
inline wait → required input "Client name"), three schedules seeded in the local DB (Row 1 with blank
inputs, as a pre-300 schedule; Rows 2-3 filled).

| Row | Verdict | Evidence |
|---|---|---|
| G4-5 | ✅ PASS (1 finding) | Run now on Row 1 → amber "Didn't run — Client name is required and has no value. Add a new schedule with it filled in, then delete this one."; `last_status` holds the sentence, never `launch_failed`. Run now on Row 2 → only Row 2's buttons disabled, list never "Loading…", Row 1's line stayed; Row 2 → "✓ Started…". Run `beb2a281…` paused at 13:54:12 UTC → `last_status = waiting` → reopened dialog reads "Waiting on you — answer in the run." Screenshot: `screenshot-1793282084136-0.jpg` (Chrome temp). **Finding F-1:** right after Run now on Row 1 the same refusal sentence shows TWICE (outcome line + Run-now result line, S6a + S6d both fire). Gone on reopen. ≤ 10-line fix → `/gsd:fast` |
| G4-2 | ✅ PASS | Run `a95db6a5…`: notice opened 13:56:18, answered "Yes" on the run page 13:56:51 → `closed_reason = answered`; delivery due 13:58:18, claimed 13:58:29 → `skipped_answered`. (Mail is off locally, so "no email" is also trivially true; the status proves the answer check ran first.) |
| G4-3 | ✅ PASS | Settings → Preferences: switch read On (with "Email isn't set up on this server yet, so nothing is sent for now."); flipped Off → still Off after reload; `user_settings.preferences.notification_email_enabled = 'false'`. Run `4f1cf5f8…`: notice row exists (open), delivery `skipped_opted_out` at 14:00:09; run page still shows "Waiting on … (you) to answer". Switch restored to On afterwards via the PUT. |
| LM-1 | ✅ PASS (stored render) | Schedule "Row 4 — LM-1 big input" with a 6,640-byte `client_name` (marker `LM1MARKER` + repeated "Confidential clause about the Globex merger terms."). Run `c198fda6…` → delivery rendered and frozen: subject "300 G4-5 schedule rows is waiting on you"; subject / text / HTML contain neither the marker, nor "Globex merger", nor the ask prompt "Approve the note". Status `suppressed` (no provider), so the frozen render was checked, not a received mail; the "[Test]" prefix is the redirect path's and is owed with G4-1 |
| G4-7 | ✅ PASS (probe, tile unseen) | Round 2 (operator set `EMAIL_PROVIDER=smtp`, `SMTP_HOST=127.0.0.1`, `SMTP_PORT=2525`, `SMTP_SECURITY=none`, restarted 18:20 local; Claude ran a local SMTP catcher on 2525). Probe, in order: no test address → `mode held_back, state off`; test address set, no sender → `state down, config_problem "No sender address is set."` (the IN-04 "Can't send" arm); sender set → `mode test, state up`; after G4-1's send → `last_sent_at` 14:24:08; catcher stopped + a run-waiting delivery retried at +60 s and +300 s → `failed` 14:35:15 → `state down`, reason "The mail server could not be reached." (no address). ⚠ The browser account is not an operator, so the TILE itself was not seen; the label mapping is covered by `HealthSignals` tests only. **Finding F-3:** the tile reads `notification_deliveries` only, so the G4-4 INVITE failure left it `up`, though the probe's docstring says it covers "the run-waiting / invitation mailer". |
| G4-1 | ✅ PASS (local catcher; real provider owed) | Run `0ba2637b…` waited unanswered: notice 14:22:06, due 14:24:06, sent 14:24:08 (`attempts 1`, `provider smtp`), exactly ONE message caught. To/RCPT `uat-inbox@example.test` (the test address); From `Syrel <notify@notify.example.test>`; no Reply-To; Subject "[Test] 300 G4-5 schedule rows is waiting on you"; text and HTML both name the workflow, the org, "2 minutes", "your answer"; link `http://localhost:5173/app/runs/0ba2637b…` (no `?`, no token); Settings footer. **Finding F-2 (low):** no `Message-ID` header (smtplib does not add one; Resend sets its own) — spam-score risk on the one-box SMTP path. Owed: a real mailbox via Resend/one-box, and the backend-restart-mid-wait check (operator restart) |
| G4-4 | ✅ PASS (1 finding) | Catcher stopped → invited `uat-invitee-300@example.test` → dialog "Invitation created" + "Invitation created, but the email didn't send. Copy the link and send it yourself.", `document.activeElement` = the Copy link button; row chip "Email not sent"; DB `email_delivery failed`, `email_failure "The mail server could not be reached."`. Catcher restarted → Resend → chip gone, DB `sent`, mail caught at the TEST address with "[Test] You're invited to …". Screenshot `screenshot-1793283971683-1.jpg`. **Finding F-4 (low):** after a Resend in test mode the list shows only the fresh link, with no "went to the test address, not to {invitee}" line (IN-01's line is in the create dialog only) |
| MT-1 | ✅ PASS (round 3, OpenAI key topped up) | Schedule `c3045084…` → run `89a4497b…` (DeepSeek `deepseek-v4-flash`, `metadata.provider = deepseek`). Research step: ONE sub-run used both tools — `search_documents` (22 sources, `retrieval_error null`) and `execute_code` (sandbox, exit 0, printed "Word count … 164"). The ask wrote exactly ONE notice (`6580338d…`, kind `question`) and ONE delivery (`fab19b4d…`), due 18:04:42, claimed 18:04:49 → `suppressed` (no provider/test address set locally), frozen subject "300 MT-1 multi-tool then ask is waiting on you", no question text. The 600 s inline wait ran out → `paused` → still one notice + one delivery. Answered "Yes" while the org default was switched to MiniMax → run `completed`; the wrap step quotes "Yes". (The resumed wrap is `llm_single` and writes no `runs` row; the resume-provider proof is FIX-05's, same code path.) |
| FIX-05 | ✅ PASS 8/8 provider (2 env ⛔ on model calls; **finding F-5**) | Fixture "300 FIX-05 resume provider" (`635a9c8a…`): agent step → ask (20 s inline, then pause) → agent step; each agent step writes a `runs` row with its provider. Per row: owner `preferences.default_model` set to the row's id (MiniMax: org default, since `MiniMax-M3` has no override row and so cannot be a user default), then ONE schedule Run now + ONE API-key `POST /inbound/workflows/…/runs` (key "UAT 300 FIX-05 (local)"). All 16 runs recorded the right pair at launch (`model` + `metadata.provider`): openai/gpt-5.4-mini, anthropic/claude-sonnet-5-5, google/gemini-3.5-flash, deepseek/deepseek-v4-pro, zhipu/glm-5.3, moonshot/kimi-k2.6, openrouter/deepseek/deepseek-v4.1-flash, minimax/MiniMax-M3. All 16 paused; then the owner's active provider was switched (preference cleared + org default → MiniMax; for the MiniMax rows org default → DeepSeek) and each was answered. **Every resumed step ran on the STARTING provider** (16/16 step-3 sub-runs: the same provider as step 1); 16/16 `completed`; 16 notices for 16 waits. ⛔ env: Moonshot — both rows' model calls 429 "account … suspended due to insufficient balance" (routing still `moonshot`); Zhipu key row — 429 "Rate limit reached" on both steps (schedule row fine). **F-5:** agent steps do not use the run's recorded MODEL, only its provider. Sub-agents resolve from the owner's CURRENT settings: Anthropic ran `claude-haiku-4-5-20251001`, Zhipu `glm-5-turbo`, DeepSeek-pro rows `deepseek-v4-flash` (provider fallback defaults). On **OpenRouter the current org default id leaks through**: step 1 ran `deepseek-v4-flash` (org default at launch), the resumed step ran `MiniMax-M3` (org default at answer time), never `deepseek/deepseek-v4.1-flash`. Provider held; model drifts across a pause. |
| PT-1 | ✅ PASS | Thread A (`bc0d3254…`, DeepSeek) streamed a 1,200-word prompt 18:26:13 → 18:26:40 (`runs` `20fac27f…` completed, `error null`; 1,462 words, ends "END-OF-PT1", page shows it with no error text). Run B (FIX-05 schedule, `feee20fb…`) launched 18:26:15 and wrote its ONE notice at 18:26:18 — mid-stream — then paused; ONE delivery, due 18:28:18, claimed 18:28:32 → `suppressed` (no provider locally). Then in A the agent called `ask_user` ("Fresnel or catadioptric?", chat run `fc535ed9…`): the NEEDS YOU card rendered, answered Fresnel in the UI, run completed — **0 notices** written by the chat ask (excluded kind). Note: two scripted `.click()`s toggled the option off again before Send; real mouse clicks worked (driver artefact, not a defect). |
| COPY | ✅ APPROVED (operator, 2026-10-29) | Operator: "approve all three strings". Kept verbatim: WR-05 "An email address in the Email card isn't valid. Fix it, then save again."; IN-01 "Outside production, the email went to the test address set in Settings, not to {invitee}. Copy the link and send it yourself."; IN-04 tile state "Can't send". |
| G4-6 | ✅ PASS (local; real-mail click owed with G4-1) | Same pass as 299 G4-4a, using the link from the caught G4-1 email (`scratchpad/mail/20261029-182408-633.eml`). Signed out (operator) → opened the email link `/app/runs/0ba2637b-762d-4e21-bdb8-cd10b8bd69e0`: address kept, no auth token, sign-in form with "After you sign in, you'll go to a workflow run." (no title). Operator signed in by password as `fhdmrd.dev@gmail.com` → landed on `/app/runs/0ba2637b…` ("300 G4-5 schedule rows" run record), not chat home. The run was then answered on that page (notice `closed_reason answered` 18:41:15) and completed. |
| G4-8 | ⛔ owed (operator) | The native email step needs an SMTP connection with credentials; the local catcher speaks no TLS, and a real mailbox is the row's point |

Also observed (no verdict): with no provider, the G4-5 run's delivery recorded `suppressed`, reason "Email is not set
up on this server.", at 13:51:09 (due 13:51:03) — the drainer runs. The frozen body named the workflow, the org,
"2 minutes", "your answer", `/app/runs/<id>` and the Settings footer, with no question text. ⚠ **Observation O-1:**
the email (2-minute delay) is due before the schedule row can say "Waiting on you". The ask step waits inline for
up to `timeout_seconds` (300 here) with the run `active`, and D-26 records `waiting` only when the drive returns.

## Deferred / accepted (not rows)

- IN-05 (From header not frozen across Resend retries), IN-06 (schedule-modal refresh ordering) — deferred, low impact (`300-REVIEW-FIX.md`).
- SEED-396 — the `messages` INSERT policy has no thread-ownership / origin check (same-org residual of UF-1).
- `test_181_secdef_privileges.py` — 4 failures that predate 300 (stale function signatures); inside the 69 baseline.

## At close (after the rows pass)

- REQUIREMENTS.md: NOTE-02/03/04/06, FIX-04, FIX-05 → checked; traceability rows → Complete.
- BUG-261027-03/04/05, BUG-260828-05/06 → `closed` (only when their rows pass); SEED-281 stays `folded` until 301 ships.
- Tick the ROADMAP `[ ] Phase 300` checkbox; hand-update STATE.md.
