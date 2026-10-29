# Phase 300: Told When a Run Waits (Backend and Mailer) - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning
**Mode:** interactive for area 1 (the email itself — operator answered all four questions), then `--auto`
from the operator's mid-discussion instruction *"continue autonomously end to end for this phase"*: areas
2-4 resolved with the recommended option, each logged in `300-DISCUSSION-LOG.md`. Bug routing was answered
by the operator (fold all five).

<domain>
## Phase Boundary

When a workflow run starts waiting on a person (a question or an approval, including scheduled and
API-key runs), the system records one notice for the run's owner and, if the run is still waiting after
the delay, sends exactly one content-free email linking to `/app/runs/<id>`, through an app-owned sender
that works from a built image (Resend on cloud, SMTP on the one-box). Invite email moves onto the same
sender, and a failed send is visible. First, the two scheduler defects: a scheduled run with a blank
required input is refused and the refusal names the input (FIX-04); a paused key/schedule run resumes on
the provider it started on (FIX-05).

Requirements: NOTE-02, NOTE-03, NOTE-04, NOTE-06, FIX-04, FIX-05.

Out of scope (owned elsewhere): the in-app "waiting on you" list and badge, and removing a notice from
them (NOTE-01, NOTE-05 → Phase 301 — this phase only WRITES the notice rows 301 reads); bounded retries
of a provider outage; digest emails; any email for a tool-round-cap pause or a chat `ask_user` (excluded
pause kinds, recorded by REG-08); push/SMS/Slack channels.

⚠ **Close dependency:** the live proof of the signed-out email journey (click the link while signed out →
sign in → land on the run) needs Phase 299's sign-in return, whose UAT row **G4-4a was postponed
2026-10-29**. Phase 300 can execute and verify in code now; it cannot be CLOSED until G4-4a has run.
</domain>

<decisions>
## Implementation Decisions

### The email itself (operator, interactive)
- **D-01: One email per wait, not per run.** Each question/approval that is still waiting after the
  delay gets exactly one email. A run that asks, is answered, and asks again later gets a second email for
  the second wait. Answering within the delay sends none. This matches "one OPEN notice per recipient and
  run" (partial unique index): a new open notice after the previous one closed is a new wait.
- **D-02: Subject = `<Workflow name> is waiting on you`.** Plain text (the subject is not HTML; never
  HTML-escape it, but strip CR/LF so a workflow name cannot inject headers).
- **D-03: Sender = `Syrel <notify@notify.<domain>>`, no reply path.** No `Reply-To`. The from-address is
  a Settings value (D-08), not hardcoded; the display name is the product name.
- **D-04: Two extras beyond NOTE-03's four items, both chosen by the operator:**
  1. The kind word: "…is waiting for your **answer**" (a question) vs "…for your **approval**" (an
     approval). Derived from the pause kind only — never the question text, never document content.
  2. A footer line linking to the user's own Settings (`/app/settings`, no token, no query string):
     "Don't want these emails? Turn them off in Settings."
  Everything else stays exactly NOTE-03: escaped workflow name, org name, how long it has waited, the
  link. No question text, no document text, no token anywhere in any URL.
- **D-05: The link is `/app/runs/<run_id>`** on `primary_frontend_origin()` (BUG-260904-04: never the raw
  comma-separated `frontend_url`). Opening it signed-out goes through 299's sign-in return.
- **D-06: Wait-time words** are written at send time from the notice's `created_at` ("has been waiting
  3 minutes"), never a pause expiry (research flag: per-type expiry is not stated in the email).

### Who sets the delay (auto — recommended)
- **D-07: The delay is ONE app-wide operator knob in `app_settings`**, default **120 s**, bounded
  (60-3600 s), shown in the operator's Settings. Not per-user: one value per deployment keeps the outbox
  "due at" computation in one place. Seeded in `docs/OPERATOR.md` Step-3 seed list (deploy parity).
- **D-08: Every non-secret mail knob lives in Settings (`app_settings`)**: delay, from-address, from-name,
  dev redirect address. The env keeps only `EMAIL_PROVIDER` (infra switch: `none` | `resend` | `smtp`),
  `RESEND_API_KEY` and the SMTP password/credentials (secrets). `INVITE_FROM_EMAIL` stays readable as a
  fallback so an existing install keeps sending, then is superseded by the Settings value.
- **D-09: The opt-out is per-user in `user_settings`** (`notification_email_enabled`, default **on**),
  a switch in the user's own Settings. Off = no email, notice still written (NOTE-04). Read at send time,
  not enqueue time, so turning it off stops an email already queued.
- **D-10: Dev mail can never reach a real inbox.** When the environment is not production, every send is
  rewritten to the Settings redirect address; if none is set, the send is recorded as `suppressed` and only
  logged. Production ignores the redirect. A test pins both arms. The local default `EMAIL_PROVIDER=none`
  stays the log-only provider.

### When a send fails (auto — recommended)
- **D-11: Invite email failure is shown in the invite dialog**, inline: "Invitation created, but the email
  didn't send. Copy the link and send it yourself." with the existing Copy link (167 already returns the
  link). The invitations list marks that row "Email not sent". The invite itself is still created — a
  mail outage must not block inviting.
- **D-12: Run-waiting delivery outcome is stored on the outbox row** (`sent` / `failed` / `suppressed` /
  `skipped_opted_out` / `skipped_answered` + reason), with bounded retries (3 attempts, backoff) while the
  run is still waiting. A failed delivery is shown to the operator as one "Email" line in the Control
  Room's dependency health (provider + last failure time + reason) — not only logged. The owner's own
  surface for a waiting run is Phase 301's in-app list, so no owner-facing failure UI here.
- **D-13: "Still waiting" is re-checked immediately before each send** (and the opt-out read, D-09);
  answered or ended → `skipped_answered`, nothing sent.

### Blank-input refusal (auto — recommended)
- **D-14: Refuse at BOTH doors.** Creating or editing a schedule whose required input has no value is a
  worded 422 naming the input by its label (same `missing_required` predicate 296-06 made the one home,
  `services/inbound_inputs.py:144`). At fire time the scheduler calls the same predicate (a workflow can
  gain a required input after the schedule was saved): it does not launch, and records the outcome with
  the input names.
- **D-15: The schedule row speaks words, never a wire value** (folds BUG-261027-03): every `last_outcome`
  maps to a sentence through one vocabulary entry, e.g. "Didn't run — *Client name* is required and has no
  value." `launch_failed` and every other raw status word never reach the screen.
- **D-16: Run now marks only its own row busy** (BUG-261027-03's second half); the list is not replaced by
  "Loading…". Its result lands in that row (296-04's row-local result).

### Resume on the starting provider (FIX-05)
- **D-17: The unattended (schedule) and API-key launch paths record the launching owner's resolved
  provider in `workflow_runs.metadata.provider`**, exactly as the in-app door does since 296 (SEED-362),
  so a resume reads it. One resolution helper shared by the doors — no fourth copy. Driven across the full
  native roster + OpenRouter (four-axis rule).

### Engine boundary (from ROADMAP flags — locked)
- **D-18: Notices are written by DB triggers** on the `messages` ask rows and on `workflow_runs` status —
  `harness_engine.py` is NOT edited to emit notices. Trigger bodies swallow their own errors so the
  engine's fail-closed prompt insert can never break. The notice's org comes from `workflow_runs.org_id`
  (299 added it), never from `messages.org_id` (the `LIMIT 1` autofill).
- **D-19: Migration is `218`** (ROADMAP's "217" is stale — 217 is 298's `org_item_move_audit`).
  Tables `notifications` (one open notice per recipient+run, partial unique index) and
  `notification_deliveries` (outbox, RLS deny-all to clients). RLS on every table; any SECURITY DEFINER
  function has EXECUTE revoked from `PUBLIC`; an **anon-role test**; local apply via SQL editor then
  `bash scripts/regenerate-full-schema.sh` (no `--reset`); cloud paste + `get_advisors(security)` only at
  deploy, with per-action approval.
- **D-20: Exactly-once delivery:** outbox drained in every worker with `FOR UPDATE SKIP LOCKED`, a unique
  key per (notice) delivery, and Resend's `Idempotency-Key` header. Drainer start-up respects the
  `RUN_BOOT_SWEEPS`-style worker flag pattern in `main.py`. A DB-backed test proves two drainers send once.

### One sender (NOTE-06)
- **D-21: One app mailer seam** with three providers: `none` (log), `resend` (REST via existing `httpx`,
  **the `resend` SDK is dropped** — it is not in `backend/requirements*.txt`, which is exactly why a built
  image cannot send invite email today), `smtp` (stdlib `smtplib`, off the event loop via
  `run_in_threadpool`). Invite email and run-waiting email both go through it. A clean-image import test
  proves no dev-only package is needed.
- **D-22: HTML body + plain-text alternative** for every app email; every interpolated value
  HTML-escaped (WR-02 precedent in `email_provider.py`).

### Folded: workflow email step honesty (BUG-260828-05, BUG-260828-06 — operator folded)
- **D-23: The SMTP step's receipt names the recipient(s)**, not the SMTP host: "Destination" answers
  "who was this sent to?" (host may follow as transport detail).
- **D-24: A workflow email step renders the agent's markdown** to an HTML body with a plain-text
  alternative that keeps its line breaks — no literal `##`/`**`, no flattening onto one line. A
  markdown renderer already in the backend is reused if one exists; otherwise the smallest safe renderer
  (escape first, allow-list tags) — no new package unless research proves none exists.

### Addendum after research (auto, 2026-10-29) — resolves 300-RESEARCH.md open questions
- **D-25: Production has never sent an app email.** Measured read-only on prod 2026-10-29: `org_invitations`
  has 0 rows and `audit_log` has 0 `invitation.send`/`invitation.resend` events. The first real send is this
  phase's G-4 / deploy; there is no history to stay compatible with.
- **D-26: A scheduled run that pauses for a person must not read "Finished" on its schedule row.**
  `unattended_launch.py:357` records `completed` for a run that is waiting (research finding). The row
  shows a waiting sentence ("Waiting on you — answer in the run") from the same D-15 vocabulary; the
  recorded outcome distinguishes waiting from finished. In scope as part of D-15 (the row's words), not a
  new capability.
- **D-27: The delay knob is documented in `docs/OPERATOR.md`'s email section, with NO Step-3 seed row and
  no migration filename** — a column-default setting is schema, not a seed (house rule from mig 214;
  `check-deploy-drift.sh` counts any `NNN_name.sql` named in OPERATOR.md as a seed). This overrides D-07's
  "Step-3 seed list" wording.
- **D-28: SMTP host, port, username, password and TLS mode are env vars (`SMTP_*`)** — infrastructure
  credentials, like `RESEND_API_KEY`; every Phase-157 parity artifact updated in the same commit.
  The from-address/from-name/delay/redirect stay in Settings (D-08).
- **D-29: 300 ships NO `GET /notifications` route.** `notifications` gets an owner-only SELECT policy so 301
  can read it; the route and list are 301's (NOTE-01). ROADMAP's 301 "depends on GET /notifications"
  line is satisfied by 301 itself.
- **D-30: The dev guard keys on `ENVIRONMENT`.** Coolify must carry `ENVIRONMENT=production` or every cloud
  email is redirected/suppressed — an operator deploy-checklist item, written into `docs/OPERATOR.md`.
- **D-31: Resend body is rendered ONCE at first claim and stored on the outbox row**, so a retry resends the
  identical payload under the same `Idempotency-Key` (Resend returns 409 on a changed body). Every request
  sends a `User-Agent`. SMTP is at-most-once: a delivery stuck mid-send after a crash is marked `failed`,
  never re-sent.
- **D-32: D-24's renderer is `markdown-it-py` (`js-default` preset, `html=False`, `breaks=True`)**, already
  in the built image transitively; declare it in `backend/requirements.txt`. The `commonmark` preset is
  forbidden (passes `<script>`).
- **D-33: FIX-05 is one helper** `resolve_owner_run_model(owner_id)` in `run_model_resolution.py`, called once
  in `unattended_launch.launch_unattended_run`, recording model + provider at launch and in the first drive
  ctx. `run_lifecycle.py` / `run_producer.py` are NOT touched.
- **D-34: Re-point, never delete, `test_276_invite_email_brand.py`** — it passes today only by stubbing a
  `resend` module that is not installed anywhere; it moves onto the REST provider.

### Claude's Discretion
- Exact wording of the email body sentences, the Settings switch labels and the dependency-health line
  (words-first rule; no raw status words).
- Retry backoff shape inside D-12's bound; drainer poll interval.
- Plan split (G-8 target 3-5 plans; suggested: scheduler fixes + row words → migration + triggers + outbox
  → mailer + invite + deploy artifacts + workflow email step → Settings UI).

### Folded Bugs
- **BUG-261027-04** (scheduled run launches with a blank required input) → D-14. Named by ROADMAP (FIX-04).
- **BUG-261027-05** (key/schedule runs resume on the owner's current provider) → D-17. Named by ROADMAP (FIX-05).
- **BUG-261027-03** (schedule row shows raw `launch_failed`; Run now reloads the whole list) → D-15, D-16.
- **BUG-260828-05** (send receipt names the SMTP host, not the recipient) → D-23.
- **BUG-260828-06** (email body delivered as flattened raw markdown) → D-24.
- **SEED-281** (nobody is told an approval is waiting) — run-waiting EMAIL half folded here; the in-app
  half is 301's. Stays `folded` until 301 ships.
- The pre-existing "built images cannot send invite email" defect → D-21 (REG-08 files it formally).

### Guardrails applied
- **G-2 (UI hint: Settings switch + delay knob, invite-dialog failure line, schedule row words):** small
  surfaces inside existing components; UI-SPEC self-approved under the autonomous mandate as in 298/299,
  recorded in STATE.md → Guardrail overrides; operator sees it at G-4.
- **G-5:** FIRING files named in ROADMAP flags (`main.py`, `config.py`, `models/user_settings.py`,
  `api/settings.py`, `SettingsPage.tsx`, `scheduler_service.py`, `workflow_kickoff.py`, `run_lifecycle.py`,
  `run_producer.py`) are touched **honoured by construction** (one small hunk each, new logic in new
  modules). `backend/app/api/org.py` and any other file with no ledger row gets a row at planning
  (`node scripts/check-hot-file-ledger.cjs`).
- **G-8:** 3-5 plans.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` §"Phase 300" — goal, 5 success criteria, "How we'd know this failed", Flags (migration, mailer, parity, G-5, operator actions)
- `.planning/REQUIREMENTS.md` — NOTE-02, NOTE-03, NOTE-04, NOTE-06, FIX-04, FIX-05 (and NOTE-01/05 for the 301 boundary)
- `.planning/seeds/SEED-281-nobody-is-told-an-approval-is-waiting.md` — the origin and register of notification needs

### Folded bugs
- `.planning/reported-bugs/BUG-261027-04-scheduled-run-launches-with-a-blank-required-input.md`
- `.planning/reported-bugs/BUG-261027-05-key-and-schedule-runs-resume-on-the-owners-current-provider.md`
- `.planning/reported-bugs/BUG-261027-03-schedule-row-shows-raw-launch-failed-and-list-reloads.md`
- `.planning/reported-bugs/BUG-260828-05-send-receipt-names-the-smtp-host-not-the-recipient.md`
- `.planning/reported-bugs/BUG-260828-06-email-body-delivered-as-flattened-raw-markdown.md`

### Prior phases this builds on
- `.planning/phases/299-links-to-the-thing-itself/299-CONTEXT.md` — `/app/runs/<id>` address, sign-in return, `workflow_runs.org_id` (D-10)
- `.planning/phases/299-links-to-the-thing-itself/299-HUMAN-UAT.md` — G4-4a postponed (blocks 300's close)
- `.planning/milestones/v4.7-phases/296-close-v4-7-debt/` — 296-06 `missing_required` one home; SEED-362 provider-at-kickoff

### Project rules
- `CLAUDE.md` — migrations via SQL editor + `regenerate-full-schema.sh`; Supabase MCP writes approval-gated; `REVOKE … FROM PUBLIC` trap; deployment-artifact parity same-commit rule; settings vs env rule; UAT scoreboard (four-axis, full roster)
- `docs/DEPLOYMENT-WORKFLOW.md`, `docs/OPERATOR.md` (Step-3 seed list), `deploy/onebox.env.example`, `docker-compose.prod.yml`, `scripts/check-deploy-drift.sh`
- `docs/HOT-FILE-LEDGER.md` — sections for every FIRING file touched
- `docs/PLANNING-PROPORTION.md` — G-8
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/email_provider.py` (105 lines): `EmailProvider` protocol, `NoneLogProvider`, `ResendProvider` (lazy `import resend` — the package is NOT in requirements, so it fails in a built image), `compose_invite_link` on `primary_frontend_origin()`, WR-02 HTML escaping. The seam to extend, not replace.
- `backend/app/services/connectors/smtp_adapter.py` (482 lines): validated envelope recipients, header-injection refusal, `_quit_quietly`, typed `Smtp*` errors — the patterns the app SMTP provider reuses; also the file for D-23/D-24.
- `backend/app/services/inbound_inputs.py:144` `missing_required` — the one blank-required-input predicate (D-14).
- `backend/app/services/workflow_kickoff.py:268` — the in-app door's refusal, the shape to copy at the schedule door.
- `backend/app/api/org.py:409,532` — invite send sites, already `run_in_threadpool`.
- `frontend/src/components/org/InviteMemberDialog.tsx`, `InvitationsTab.tsx` — D-11 surfaces.
- `frontend/src/components/workflows/WorkflowScheduleModal.tsx` — schedule rows, row-local Run now (296-04) — D-15/D-16.

### Established Patterns
- Blocking I/O inside async handlers goes through `run_in_threadpool` (D-v2.5-01).
- Multi-worker uvicorn (`WORKER_COUNT=2`): anything singleton must be DB-coordinated (D-PRD-12) — hence SKIP LOCKED.
- Realtime is a hint, never truth (D-v2.5-03) — 301 reads notices by fetch.
- Secrets in env, every other knob in `app_settings`/`user_settings` + Settings UI.

### Integration Points
- `backend/app/main.py` lifespan — drainer start-up (one hunk).
- `backend/app/services/scheduler_service.py` — fire-time `missing_required` + outcome; provider recording (D-17).
- `workflow_runs.metadata.provider` — read on resume (`harness_engine.py` resume settings, 296 CR-01).
- `backend/app/config.py:1724-1726` — `email_provider`, `resend_api_key`, `invite_from_email`.
</code_context>

<specifics>
## Specific Ideas

- Subject: `Compliance Gap Report is waiting on you`.
- Body, in spirit: "**Compliance Gap Report** in **Acme** has been waiting 3 minutes for your approval.
  [Open the run]" + footer "Don't want these emails? Turn them off in Settings."
- Sender: `Syrel <notify@notify.<domain>>`; DNS (SPF, DKIM, DMARC `p=none`) at Hostinger is an operator action.
</specifics>

<deferred>
## Deferred Ideas

- In-app waiting list, badge, notice removal → Phase 301 (NOTE-01, NOTE-05).
- Per-user delay (rejected for one app-wide knob, D-07) — revisit only if users ask.
- Owner-facing "your email failed" surface → Phase 301's list if wanted.
- Reply-to an org admin (operator chose no-reply).
- 299 postponed UAT rows (G4-5a first) — not this phase; G4-4a gates 300's close.
</deferred>

---

*Phase: 300-told-when-a-run-waits-backend-and-mailer*
*Context gathered: 2026-10-29*
