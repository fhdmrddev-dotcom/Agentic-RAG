---
status: partial
phase: 300-told-when-a-run-waits-backend-and-mailer
source: [300-VERIFICATION.md, 300-VALIDATION.md]
started: 2026-10-29
updated: 2026-10-29
rows_total: 15
rows_run: 3
rows_blocked: 1
driver: operator (Claude can drive the API/DB rows on request)
---

# Phase 300 — Human UAT (owed)

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
| G4-7 | ⛔ BLOCKED (partial) | Probe in-process: `{state: off, mode: off, provider: none}` — correct for this box. "Held back" / "Test mode" / "Last send failed" need `EMAIL_PROVIDER` set and a backend restart (operator; `backend/.env` is never edited by Claude). Also the browser account is not an operator, so the tile itself was not seen. |

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
