# Phase 300: Told When a Run Waits (Backend and Mailer) - Research

**Researched:** 2026-10-29
**Domain:** Postgres triggers + transactional outbox, app-owned mailer (Resend REST / stdlib SMTP), scheduler launch correctness
**Confidence:** HIGH for codebase facts (all file:line verified this session); MEDIUM for Resend behaviour (official docs fetched); LOW for production email history (Supabase MCP not available to this researcher; see Open Question 1)

## Summary

The waiting state this phase must detect is **not** a `workflow_runs.status`. It is an
**unanswered `ask_user_prompt` row** in `messages` whose `tool_calls->0->>'run_id'` is a
`workflow_runs.id` and whose `origin = 'harness'`. While a human step waits in-process the run
stays `active`. It turns `paused` only after the step's timeout (`HumanInputTimeout` →
`PhaseOutcome("pause_run")`, `harness_engine.py:1070-1089`) or immediately for an engine ask
(`engine_ask.engine_pause` calls `pause_run` first, `engine_ask.py:1006`). A wait ends when an
`ask_user_response` row with the same `tool_call_id` is inserted: by the answer route
(`api/runs.py:1076-1093`) or by the terminal-run expiry writer (`harness_engine.py:290-310`, an
`expired: true` response row). So an AFTER INSERT trigger on `messages` sees both the start and the
end of every wait. A status trigger on `workflow_runs` is only a backstop for terminal states.

Both excluded pause kinds fall out by construction. A chat `ask_user` prompt
(`tools/agent_control.py:377-390`) has no `origin` (it defaults to `'deep'`) and its `run_id` is a
`runs.id`. The tool-round-cap pause writes no ask row, and **nothing in the backend ever writes
`workflow_runs.status = 'cap_paused'`** (the only status writers are
`db/workflows.py:2338,2383,2543`, `api/runs.py:660` and `harness/run_handoff.py:234`). The CHECK
allows the value, but no code writes it. Approval and question differ in exactly one field: since
Phase 295 every armed approval goes through `engine_pause(kind="action_risk")`
(`engine_ask.py:392-396`), so `tool_calls->0->'engine_pause'->>'kind' = 'action_risk'` means
**approval**, and anything else means **question**.

The mailer seam exists (`services/email_provider.py`, 105 lines), but its Resend path cannot work
anywhere. `resend` is absent from `backend/requirements.txt` **and from the dev venv too**
(`find_spec('resend') → False`, measured). The only test of it (`test_276_invite_email_brand.py`)
passes by putting a fake module into `sys.modules`, which is the exact "passes only because…"
failure the ROADMAP names. Resend over `httpx` is straightforward, but its `Idempotency-Key`
dedupes **only an identical payload**: a retry whose body says "waiting 5 minutes" instead of
"waiting 3 minutes" gets `409 invalid_idempotent_request`. So the email must be rendered once and
frozen on the outbox row. For D-24, a markdown renderer is already in the built image:
`markdown-it-py` 4.0.0 arrives transitively via `supabase → storage3 → pyiceberg → rich`. With the
`js-default` preset plus `breaks=True` it escapes raw HTML, refuses `javascript:` links and keeps
line breaks (measured).

FIX-05 is one function. `unattended_launch.launch_unattended_run` calls
`create_workflow_run(model=None)` with no `provider` (`unattended_launch.py:181-191`), and
`_drive_run` builds its first ctx from a dict that has no `model` or `metadata` either
(`:274-283`). The resume paths already read `wr.model, wr.metadata`
(`db/workflows.py:1705`, `api/runs.py:768-769`) and honour `metadata.provider`
(`harness_engine.py:2580-2603`). Both the schedule door and the key door go through this one
function, so recording `(model, provider)` there is the single helper call D-17 asks for.
FIX-04 mirrors the template refusal already in `scheduler_service.py:118-132`.

**Primary recommendation:** Notices come from two `SECURITY DEFINER` triggers (`messages` AFTER INSERT with a `WHEN` clause, and `workflow_runs` AFTER UPDATE OF status), each wrapped in `EXCEPTION WHEN OTHERS`. Each new notice also inserts one `pending` row into a deny-all outbox. A `SchedulerService`-shaped drainer runs in every worker and claims due rows with `FOR UPDATE SKIP LOCKED`. It freezes the rendered email on the first claim, re-checks "still waiting" and the opt-out right before sending, and sends through a three-provider mailer (none / Resend REST via `httpx` / `smtplib` in a threadpool) that the invite path also uses.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect "a run started/stopped waiting" | Database (triggers on `messages`, `workflow_runs`) | — | D-18: `harness_engine.py` is not edited; the ask rows are already the durable truth |
| Notice + outbox storage, RLS | Database (migration 218) | — | One open notice per recipient+run is a DB invariant (partial unique index) |
| Exactly-once delivery | Database (SKIP LOCKED claim, unique key) + API/Backend (drainer) | Resend (`Idempotency-Key`) | Multi-worker uvicorn (D-PRD-12) means only the DB can arbitrate |
| Render + send email | API/Backend (`services/mailer` seam) | — | Secrets live in env; non-secret knobs in `app_settings` |
| Opt-out, delay, from-address, redirect | Database (`app_settings`, `user_settings.preferences`) | Browser (Settings UI) | Settings-vs-env rule |
| Blank-input refusal | API/Backend (schedule create/patch + fire time) | Browser (already refuses client-side, 296-04) | Server must not trust the client |
| Resume on starting provider | API/Backend (`unattended_launch`) | Database (`workflow_runs.metadata.provider`) | The resume path already reads it |
| Invite failure visible | API/Backend (`org.py` response + persisted column) | Browser (dialog line, list chip) | D-11 |
| Email failure visible to operator | API/Backend (`health_probe`) | Browser (`HealthSignals`) | D-12 |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### The email itself (operator, interactive)
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

#### Who sets the delay (auto — recommended)
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

#### When a send fails (auto — recommended)
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

#### Blank-input refusal (auto — recommended)
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

#### Resume on the starting provider (FIX-05)
- **D-17: The unattended (schedule) and API-key launch paths record the launching owner's resolved
  provider in `workflow_runs.metadata.provider`**, exactly as the in-app door does since 296 (SEED-362),
  so a resume reads it. One resolution helper shared by the doors — no fourth copy. Driven across the full
  native roster + OpenRouter (four-axis rule).

#### Engine boundary (from ROADMAP flags — locked)
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

#### One sender (NOTE-06)
- **D-21: One app mailer seam** with three providers: `none` (log), `resend` (REST via existing `httpx`,
  **the `resend` SDK is dropped** — it is not in `backend/requirements*.txt`, which is exactly why a built
  image cannot send invite email today), `smtp` (stdlib `smtplib`, off the event loop via
  `run_in_threadpool`). Invite email and run-waiting email both go through it. A clean-image import test
  proves no dev-only package is needed.
- **D-22: HTML body + plain-text alternative** for every app email; every interpolated value
  HTML-escaped (WR-02 precedent in `email_provider.py`).

#### Folded: workflow email step honesty (BUG-260828-05, BUG-260828-06 — operator folded)
- **D-23: The SMTP step's receipt names the recipient(s)**, not the SMTP host: "Destination" answers
  "who was this sent to?" (host may follow as transport detail).
- **D-24: A workflow email step renders the agent's markdown** to an HTML body with a plain-text
  alternative that keeps its line breaks — no literal `##`/`**`, no flattening onto one line. A
  markdown renderer already in the backend is reused if one exists; otherwise the smallest safe renderer
  (escape first, allow-list tags) — no new package unless research proves none exists.

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

### Deferred Ideas (OUT OF SCOPE)
- In-app waiting list, badge, notice removal → Phase 301 (NOTE-01, NOTE-05).
- Per-user delay (rejected for one app-wide knob, D-07) — revisit only if users ask.
- Owner-facing "your email failed" surface → Phase 301's list if wanted.
- Reply-to an org admin (operator chose no-reply).
- 299 postponed UAT rows (G4-5a first) — not this phase; G4-4a gates 300's close.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTE-02 | One email after the delay; answering in time sends none; never twice across restart, deploy or a second worker | §Pattern 1 (trigger detection), §Pattern 2 (outbox + SKIP LOCKED + frozen payload + Idempotency-Key), Pitfalls 1-4 |
| NOTE-03 | Email contains only the workflow name, org, wait time and link | §Pattern 4 (renderer: escape, subject CR/LF strip, no prompt text read) |
| NOTE-04 | Per-user opt-out; the in-app notice stays | §Settings plumbing (`user_settings.preferences.notification_email_enabled`, read at send time) |
| NOTE-06 | Sends from a built image (Resend on cloud, SMTP on the one-box); secrets in env; invite uses the same sender; failure visible | §Pattern 3 (mailer), §Clean-image test, §Invite failure persistence, Package audit |
| FIX-04 | Scheduled run with a blank required input refused before launch, naming the input | §FIX-04 (create/patch 422 + fire-time refusal shaped like `scheduler_service.py:118-132`) |
| FIX-05 | Paused key/schedule run resumes on its starting provider | §FIX-05 (`unattended_launch.py:181` records model+provider; the drive dict carries them) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Python backend in `backend/venv`. Raw SDK/HTTP calls only (no LangChain). Pydantic for structured data.
- **Every table needs RLS.** Functions are granted `EXECUTE` to **PUBLIC** by default, so `REVOKE … FROM PUBLIC` comes first, then grant back only the roles that need it (the 215 precedent at `supabase/migrations/215_api_keys_and_run_origin.sql:165-170`).
- Migrations: `supabase/migrations/<digits>_name.sql`. **Next free is `218`** (verified: the tail is `217_org_item_move_audit.sql`). Apply locally by pasting into the SQL editor, or through venv asyncpg in one transaction as the 298-03 executor did, under the local-DB lock. Then run `bash scripts/regenerate-full-schema.sh` with **no `--reset`**. Never use `supabase db push` or `db reset`. Never hand-edit `full-schema.sql`.
- Blocking I/O (supabase-py, `smtplib`, `load_user_settings`) inside async code goes through `run_in_threadpool` (D-v2.5-01).
- Multi-worker uvicorn (`WORKER_COUNT=2`): anything that must happen once is DB-coordinated (D-PRD-12).
- Settings live in `app_settings` / `user_settings` and the Settings UI. Env is for secrets and infra only.
- **Deployment-artifact parity, same commit:** any new or changed env var updates `backend/.env.example`, `deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml` and `scripts/check-deploy-drift.sh` (`OMITTED_FROM_ONEBOX` for intentional omissions).
- Supabase MCP reads are free. **Writes need per-action operator approval.** Cloud migration paste plus `get_advisors(security)` happen at deploy, never from an executor.
- UAT scoreboard: four axes plus the **full native roster (8 rows)** for FIX-05. Rows go in VALIDATION.md / HUMAN-UAT.md, not in PLAN.md tasks.
- G-5: every non-test `backend/app` or `frontend/src` path in `files_modified` must have a ledger row. `node scripts/check-hot-file-ledger.cjs <phase-dir>` **fails on a missing row, new files included**.
- G-8: 3-5 plans. The verifier, TDD RED drives, security review and migration discipline are never cut.
- Backend unit baseline ceiling: **71 failed** (`node scripts/check-backend-unit-baseline.cjs`), with zero headroom.
- Vitest: `GSD_VITEST_MAX_WORKERS=2`. The frontend typecheck is `npx tsc -p tsconfig.app.json --noEmit` (the bare `tsc --noEmit` checks zero files).
- A reusable-seam claim must be verified as wirable and safe before it is relied on.

## Research Flag Answers (file:line evidence)

### Flag 1 — Status literals, waiting rows, excluded kinds

| Fact | Evidence |
|---|---|
| `workflow_runs.status` ∈ `active, paused, cap_paused, completed, failed, cancelled` | `supabase/full-schema.sql:4465`; `063_dual_mode_continue.sql:57` |
| Terminal = `completed, failed, cancelled` | the same CHECK; `pause_run` guards `NOT IN ('completed','failed','cancelled')` at `db/workflows.py:2338` |
| `workflow_runs.org_id` is `NOT NULL` (autofilled from the thread; unattended paths stamp the thread's org explicitly) | `full-schema.sql:4447,7302`; `unattended_launch.py:163-175` |
| `workflow_runs.user_id` is nullable (the owner) | `full-schema.sql:4454` (mig 064) |
| **Ask row** = `messages` with `role='system'`, `origin='harness'`, `tool_calls[0].kind='ask_user_prompt'`, `tool_calls[0].run_id=<workflow_run id>` | human step `harness/human_input.py:233-255`; engine ask `engine_ask.py:1013-1038`; author ask_user gate `engine_ask.py:459-478` |
| **Approval** = `tool_calls[0].engine_pause.kind = 'action_risk'` | `engine_ask.py:392-396` (armed approval is always `engine_pause(kind="action_risk")` since 295); payload built at `:983-989`, attached at `:1021` |
| Engine citation-gate asks: `engine_pause.kind ∈ {no_sources, no_markers}` → a **question** ("answer") | `engine_ask.py:366-370, 927-931` |
| **Answered** = `ask_user_response` row, same `tool_call_id`. The response carries **no `run_id`** | `api/runs.py:1076-1093`; documented at `db/workflows.py:1772-1779` |
| **Run ended** → the engine inserts an `expired: true` response row for each pending prompt | `harness_engine.py:236-310` |
| Status during a human-step wait: `active` (in-process block); `paused` after the timeout | `human_input.py:289-338`; `harness_engine.py:1070-1089` |
| Status during an engine ask: `paused` (written BEFORE the prompt row) | `engine_ask.py:1005-1006` |
| **Chat `ask_user` excluded:** no `origin` (defaults to `'deep'`, `full-schema.sql:3315,3318`), `run_id` is a `runs.id` | `tools/agent_control.py:377-390` |
| **Tool-round-cap pause excluded:** `cap_paused` is written only to `runs`, never to `workflow_runs`, and the cap writes no ask row | status writers enumerated: `db/workflows.py:2338,2383,2543`, `api/runs.py:660`, `harness/run_handoff.py:234`; cap writer `agent_loop.py:448-458` |
| **Golden runs** never write an ask row (auto-answer / `fail_run`) | `human_input.py:147-159`; `engine_ask.py:945-948` |
| "Unanswered prompt for this run" is already a canonical query | `db/workflows.py:1846-1892` `get_unanswered_ask_user` |

### Flag 2 — Per-type pause expiry (never state it)

- Human step: `timeout_seconds = min(phase.config.timeout_seconds (default 300), settings.ask_user_max_timeout_seconds)` (`human_input.py:140-142`, `models/harness.py:136`). On expiry the run **pauses and keeps waiting**. It does not end (`harness_engine.py:1070-1089`).
- Engine ask (citation gate, approval): `timeout_seconds: None`, so no deadline (`engine_ask.py:1017`). The armed approval waits indefinitely (`engine_ask.py:436-443`).
- Author ask_user gate: numeric timeout, same cap (`engine_ask.py:443-449`).
- **Conclusion:** expiry differs per kind and in most cases is not an end at all. The email states only the elapsed wait (D-06).

### Flag 3 — Has production ever sent an email?

- **Not verified against production.** The Supabase MCP tools were not exposed to this researcher subagent. The orchestrator (which has MCP read access) should run these free reads before planning closes:
  ```sql
  -- invites ever attempted in prod (audit rows; org.py:65 records them as 'settings.update')
  SELECT metadata->>'event' AS ev, count(*), max(created_at)
  FROM public.audit_log
  WHERE action_type = 'settings.update' AND metadata->>'event' IN ('invitation.send','invitation.resend')
  GROUP BY 1;
  SELECT status, count(*) FROM public.org_invitations GROUP BY 1;
  ```
- **What can be stated from code [VERIFIED: codebase]:** an app email has very likely never been delivered from a built image. `resend` is not in `backend/requirements.txt` (full list read). `backend/Dockerfile:32-34` installs `requirements.txt` minus `sentence-transformers` and nothing else. So `ResendProvider.send_invite` raises `ModuleNotFoundError` on `import resend` (`email_provider.py:70`), and `org.py:416-417` swallows it into `logger.error`. Memory `project_v48_milestone_started.md` also records the Coolify email secret as **still owed**. Supabase Auth's own emails (sign-up, magic link) go through Supabase's SMTP and are a separate system.
- `resend` is **absent from the local dev venv as well** (`importlib.util.find_spec('resend') is None`, measured), so the invite email has never worked locally either, except under the test's fake module.

### Flag 4 — Next migration number

`ls supabase/migrations | tail` reads `213 … 217_org_item_move_audit.sql`. **`218` is free** [VERIFIED].

### Flag 5 — FIX-04 and FIX-05 locations

**FIX-04**
- Predicate: `services/inbound_inputs.py:144-165` `missing_required(definition, inputs) -> list[str]` returns **keys**. Labels live on `DeclaredField.label` (`:58-63`) from `declared_fields(raw)`. Add a sibling in the same file, e.g. `missing_required_labels(definition, inputs) -> list[str]` (same loop, returning `field.label or field.key`), plus one sentence composer. Do not write a second predicate.
- In-app door shape to copy: `workflow_kickoff.py:265-268` (it names keys today; this phase's words use labels).
- Fire time: `scheduler_service.py:52-221` `launch_scheduled_run`. Add a block after the foreign-folder block (`:134-150`) and before the entitlement check, the same shape as the template refusal at `:118-132`: `record_schedule_outcome(pool, id, status=<sentence>)`, then `raise ScheduledLaunchRefused(sentence)`. `tick()` already skips a refused schedule without overwriting the sentence (`:280-282`). Run now already returns `outcome="refused"` with the sentence (`api/schedules.py:282-285`).
- Create door: `api/schedules.py:106-150`. `get_definition` is already loaded at `:121`. Check `missing_required` against `body.inputs` and return a 422 with the sentence.
- Patch door: `api/schedules.py:196-217`. **Only when `inputs` is in `exclude_unset` fields.** It must load the definition (`get_schedule` → `workflow_id` → `get_definition`). A pause/resume toggle must never be refused; fire time catches the rest.
- **Key door: already done.** `validate_inbound_inputs` refuses a missing required field with names (`inbound_inputs.py:168+`; called at `api/inbound.py:376-385`). No change.

**FIX-05**
- In-app door records the provider: `api/threads.py:2048-2104` → `create_workflow_run(..., model=_resolved_model, provider=_resolved_provider)` (`:2099-2100`). The writer puts `{"provider": …}` into `metadata` in the same INSERT: `db/workflows.py:545-552`.
- Schedule + key doors share ONE launcher: `services/unattended_launch.py:181-191` calls `create_workflow_run(model=None)` with no provider. `scheduler_service.py:202` and `api/inbound.py:391` both call it. **This is the single fix site.**
- Its first ctx: `_drive_run` → `_build_resume_context({run_id, thread_id, user_id, org_id, inputs})` (`unattended_launch.py:274-283`), with no `model` and no `metadata` in the dict.
- Resume reads: boot sweep `db/workflows.py:1703-1705` and answer re-drive `api/runs.py:768-769` both select `wr.model, wr.metadata`. `harness_engine.py:2580-2603` uses the recorded provider (switching the settings via `override_provider`) **only when both `run["model"]` and the provider are present** (`_ctx_model = run["model"] if run.get("model") and _run_provider …`).
- **Why it breaks today:** the unattended kickoff resolves `resolve_workflow_ctx_model(owner_settings)` from the owner's provider at launch time. A resume hours later re-resolves from whatever the owner's provider is then.
- **ONE helper (recommendation):** add `async def resolve_owner_run_model(owner_id) -> tuple[str | None, str | None]` beside `resolve_run_model` in `services/run_model_resolution.py` (3 commits / 2 phases / 308 lines, no ledger row yet). It loads the owner's effective settings off the loop (`run_in_threadpool(load_user_settings, str(owner_id))`) and returns `(resolve_workflow_ctx_model(s) or None, s.active_provider or None)`. This keeps exactly the model the unattended path runs on today, so nothing about first-launch behaviour changes. Call it once in `launch_unattended_run` and pass `model=`/`provider=` to `create_workflow_run`. Put `"model"` and `"metadata": {"provider": …}` into the `_drive_run` dict so first launch and resume take the same branch. On a failed load, keep today's behaviour (`None, None`, logged). The golden path (`publish_service.py:1710`) never resumes (the resume sweep excludes golden runs, `db/workflows.py:1709`), so it is out of scope.
- **`run_lifecycle.py` and `run_producer.py` are NOT on the FIX-05 path.** The ROADMAP's G-5 list named them preemptively. By this analysis neither needs editing, which saves two FIRING-file hunks.

### Flag 6 — Mailer seam, invite sites, SMTP connector, renderer, Resend

- `services/email_provider.py` (105 lines): `compose_invite_link` (`:34-45`), the `EmailProvider` Protocol with only `send_invite` (`:48-52`), `NoneLogProvider`, `ResendProvider` with lazy `import resend` (`:62-94`) and WR-02 escaping, and `get_email_provider()` (`:97-105`, unknown → none).
- Invite send sites: `api/org.py:409-417` (send) and `:525-532` (resend). Both are already `run_in_threadpool` and swallow the exception. **The response returns `link` but no delivery outcome** (`:430-441`, `:546-549`). The list select at `:457` returns `id, email, role, status, expires_at, invited_by, created_at` and nothing about email.
- `org_invitations` has no email-delivery column (`full-schema.sql:3545-3558`). Its grants are table-level (Supabase default) under RLS policies `:9738-9759`, so a new nullable column is readable by the existing SELECT policy with no grant change.
- `services/connectors/smtp_adapter.py`: `EmailMessage` composer guard (`:351-361`), `set_content(body)` plain-only (`:365`), `_deliver_blocking` through `run_in_threadpool` (`:380-388`), refused-recipient check (`:402-407`), `detail=f"accepted for delivery by {host}"` (`:420`). It has **no HTML part by explicit decision** (`:288-291` "D-32"). D-24 reverses that for the body only; the "no CC/BCC/attachment" stance stays.
- The receipt composer that prints `Destination: <host>`: `harness/phase_types.py:2281-2304` `_external_action_sent_body(capability, resolved, result, host)`, called at `:3102`. Its docstring says "the recipient and the credential are not named" (D-08 of 190). **D-23 overrules the recipient half by operator decision; the credential half stands.** The recipient is `args["to"]` (built at `:3053-3060` via `_adapter_args`).
- **Markdown renderer:** none in `backend/app` (grep: no `markdown_it` or `markdown` import). `markdown-it-py` 4.0.0 **is installed** (Required-by `rich` ← `pyiceberg` ← `storage3` ← `supabase`, measured with `pip show`). Measured behaviour:
  - `MarkdownIt("commonmark")` → `html=True`, which **passes `<script>` through**. Do not use it.
  - `MarkdownIt("js-default", {"breaks": True, "html": False})` → `<script>` escaped to `&lt;script&gt;`, `[l](javascript:…)` not linked, and `a\nb` becomes `a<br>\nb`.
- **Resend REST** [CITED: resend.com/docs/api-reference/emails/send-email, /errors, /introduction, /dashboard/emails/idempotency-keys]:
  - `POST https://api.resend.com/emails`, `Authorization: Bearer <key>`, JSON `{from, to, subject, html, text, headers?, tags?}`. `from` accepts `Name <addr>`. The response is `{"id": "<uuid>"}`.
  - **A `User-Agent` header is required** (403 otherwise). `httpx` sends one by default; set an explicit `Syrel/<ver>` anyway.
  - `Idempotency-Key` (1-256 chars) is kept **24 h**. Same key + same payload → the original response, no resend. Same key + **different payload** → `409 invalid_idempotent_request`. Concurrent same key → `409 concurrent_idempotent_requests` (retry later).
  - Retryable: `429 rate_limit_exceeded`, `429 daily_quota_exceeded` (next day), `500 application_error`, `503 service_unavailable`, `409 concurrent_idempotent_requests`. Not retryable: 400/401/403 (`validation_error`, unverified `from` domain, invalid key), 422.
  - Default rate limit is 10 req/s per team.
  - Error body shape `{"statusCode", "name", "message"}` is [ASSUMED] (the errors page did not show it). Parse defensively: `name` if present, else the HTTP status.

### Flag 7 — Drainer design inputs

- Background-loop template: `SchedulerService` (`scheduler_service.py:236-328`): `start()` creates the task, `_loop` waits on a stop `Event` with `wait_for` (not `sleep`), a failed tick never ends the loop, and the instance lives on `app_instance.state`. Lifespan wiring is at `main.py:513-534`; shutdown stop at `main.py:646-656`.
- Worker flag: `RUN_BOOT_SWEEPS` is a module global (`main.py:44`), set False by `tests/conftest.py:62` in `pytest_configure`, and checked as `if not _setup_mode and RUN_BOOT_SWEEPS:` (`main.py:415,439,495`). **Gate the drainer on the same expression.** A `TestClient` lifespan must never drain the shared local DB's outbox, and reusing the flag means no conftest change and no new env var.
- SKIP LOCKED precedents: `db/schedules.py:273-340` (with the doc note that the in-transaction advance is load-bearing), `db/ingestion_jobs.py:66-97` (claim plus stale-claim recovery), `db/retention.py:85-103`.
- Pool: `app.dependencies.get_pg_pool()` (asyncpg, connects as `postgres`, so RLS-bypassing; this is the pool every SKIP LOCKED claimer uses).
- Reading the recipient's address: `SELECT email FROM auth.users WHERE id = $1` through the pool (precedent `api/admin.py:898`).

### Flag 8 — Settings plumbing

- App-wide knob precedent (293 / migration 215 + 214): column with `DEFAULT` and `CHECK` bounds → `UserEffectiveSettings` field (`models/user_settings.py:305`) → `_val(row, key, None, default)` loader (`:1208`) → `api/settings.py` `_BOUNDED_SETTINGS_FIELDS` (`:44-57`), read model (`:118`), update body (`:357`), bounds check + `updates[...]` (`:832-849`) → frontend `lib/api/skills.ts:584,731` (`FullAppSettings` / update type) → leaf component `components/settings/ApiKeyLimits.tsx` with a `changes()`/`adopt()` ref → `SettingsPage.tsx:700,832-836,1629` (one ref, one spread, one adopt, one mount).
- **Per-user knob precedent:** `user_settings.preferences` JSONB (mig 011; table at `full-schema.sql:4344-4350`), written by an RLS-scoped `||` merge on `auth.uid()` in `api/me_preferences.py:97-115`, and surfaced in `components/settings/PreferencesSection.tsx` (39 lines, member-visible, "calls no gated endpoint" rule `:14-17`). **The opt-out needs no migration:** `preferences->>'notification_email_enabled'`, read with `coalesce(..., true)`.
- **Step-3 seed list conflict (see Open Question 2):** `docs/OPERATOR.md:316-322` states that a column-with-default knob is "schema, not a seed, and has no Step-3 entry". `scripts/check-deploy-drift.sh` counts **any** `NNN_name.sql` mention anywhere in OPERATOR.md as a listed seed (`OPERATOR.md:327-330`). Migration 214 says the same ("SCHEMA, NOT A SEED: no … docs/OPERATOR.md Step-3 entry").
- **Control Room "Email" line:** `GET /admin/backpressure` → `services/health_probe.probe_dependencies()` returns `{redis, supabase, sandbox}` (`health_probe.py:107-113`), and `HealthSignals.tsx:93-101` renders `DEP_ORDER`. Add an `email` key in `health_probe.py` (no edit to the FIRING `admin.py`): provider name, plus the last `failed` delivery's time and reason from `notification_deliveries`. Add one `DEP_ORDER` entry in `HealthSignals.tsx`.
- Production check: `app.api.api_docs.is_production_environment()` (`api_docs.py:82-86`, `production`/`prod`) is the one existing home and should be reused for D-10. Coolify must carry `ENVIRONMENT=production` (`docs/DEPLOYMENT-WORKFLOW.md:117,164`), and the one-box example sets it (`deploy/onebox.env.example:166`).

### Flag 9 — Frontend surfaces

- `WorkflowScheduleModal.tsx`:
  - The raw `last_status` is rendered at `:418-419` (`` ` · ${s.last_status}` ``). That is the BUG-261027-03 leak.
  - `onRunNow` (`:323-336`) wraps in `withBusy` (disables every row via `busy`) and then calls `refresh()`, which does `setLoading(true)` (`:185-205`), replacing the list with "Loading…" (`:385-386`). Fix: a quiet refresh that does not set `loading` once rows exist, and per-row busy keyed on `runningId` (already present, `:443`) instead of the global `busy`.
  - Client-side required refusal already exists (`:241-265`, `missingRequiredFields` / `requiredFieldsMessage` from 296-04).
- **The `last_status` vocabulary** must map: run terminals written by `on_finish` (`"completed"` / `"failed"`, `unattended_launch.py:357`), `launch_failed` (`scheduler_service.py:38`), `cadence_error` (`db/schedules.py:297-300`), and any free sentence (template / foreign-folder / kill-switch / the new blank-input sentence), which passes through verbatim. Pitfall 8 covers a related honesty gap.
- `InviteMemberDialog.tsx` (281 lines): link-first success panel `:147-188` with Copy link. Add the failure line when the response says the email did not send. `InvitationsTab.tsx` (290 lines): rows from `GET /org/invitations`. Add an "Email not sent" chip from the new column.

### Flag 10 — Deployment parity artifacts

| Artifact | Today | Owed |
|---|---|---|
| `backend/.env.example` | `:266-268` describes `EMAIL_PROVIDER=none|resend` + `pip install resend` | `none|resend|smtp`; remove the pip instruction; add the SMTP vars |
| `deploy/onebox.env.example` | `:254-258` `EMAIL_PROVIDER=none`, commented `RESEND_API_KEY`/`INVITE_FROM_EMAIL` | add commented SMTP vars; mark `INVITE_FROM_EMAIL` as a fallback superseded by Settings |
| `docker-compose.prod.yml` | `:60-65` passes the three vars | pass the SMTP vars through |
| `docs/OPERATOR.md` | `:415-425` "Opt-in: `pip install resend`" | rewrite: three providers, nothing to install; the delay/from/redirect knobs live in Settings; DNS (SPF, DKIM, DMARC `p=none`) as an operator action |
| `scripts/check-deploy-drift.sh` | `:103-106` lists `RESEND_API_KEY INVITE_FROM_EMAIL` in `OMITTED_FROM_ONEBOX` | add each new SMTP var either to the onebox file or to `OMITTED_FROM_ONEBOX` with a reason |

### Flag 11 — Hot-file ledger (re-derived 2026-10-29 with the CLAUDE.md recipe; the phase count excludes six-digit quick buckets)

| File (likely `files_modified`) | Triple (commits / phases / lines) | Ledger row? | Status |
|---|---|---|---|
| `backend/app/main.py` | 97 / 71 / 993 | yes | FIRING, one hunk (drainer start/stop) |
| `backend/app/config.py` | 95 / 54 / 1822 | yes | FIRING, one hunk (`email_provider` literal + SMTP fields) |
| `backend/app/models/user_settings.py` | 61 / 37 / 1776 | yes | FIRING, fields + `_val` lines only |
| `backend/app/api/settings.py` | 47 / 25 / 1301 | yes | FIRING, allow-list/bounds lines only |
| `frontend/src/pages/SettingsPage.tsx` | 62 / 30 / 1690 | yes | FIRING, one ref + spread + adopt + mount |
| `backend/app/services/harness/phase_types.py` | 66 / 33 / 3135 | yes | FIRING, "G-5 OWED". D-23: one parameter / one line in `_external_action_sent_body` |
| `backend/app/services/scheduler_service.py` | 13 / 8 / 332 | yes | FIRING, one block |
| `backend/app/api/schedules.py` | 5 / 5 / 303 | yes | FIRING, create + patch checks |
| `backend/app/api/inbound.py` | 10 / 3 / 719 | yes | likely untouched |
| `backend/app/services/unattended_launch.py` | 6 / 2 / 361 | yes | — |
| `backend/app/services/inbound_inputs.py` | 8 / 2 / 312 | yes | — |
| `frontend/src/components/workflows/WorkflowScheduleModal.tsx` | 5 / 4 / 723 | yes | FIRING |
| `frontend/src/lib/api/skills.ts` | 9 / 6 / 767 | yes | FIRING, optional fields |
| `frontend/src/lib/api/org.ts` | 11 / 8 / 629 | yes | FIRING, one optional field |
| `frontend/src/components/settings/PreferencesSection.tsx` | 1 / 1 / 39 | yes | one mount |
| `backend/app/api/org.py` | 11 / **3** / 1024 | **NO** | **FIRES with no row. Add a row** (ROADMAP-named) |
| `frontend/src/components/admin/HealthSignals.tsx` | 5 / **4** / 316 | **NO** | **FIRES with no row. Add a row** |
| `backend/app/services/email_provider.py` | 4 / 2 / 105 | yes | reaches 3 phases here |
| `backend/app/services/connectors/smtp_adapter.py` | 1 / 1 / 482 | **NO** | add a row |
| `backend/app/services/health_probe.py` | 1 / 1 / 116 | **NO** | add a row |
| `backend/app/api/me_preferences.py` | 1 / 1 / 120 | **NO** | add a row |
| `backend/app/services/run_model_resolution.py` | 3 / 2 / 308 | **NO** | add a row |
| `frontend/src/components/org/InviteMemberDialog.tsx` | 3 / 2 / 281 | **NO** | add a row |
| `frontend/src/components/org/InvitationsTab.tsx` | 3 / 2 / 290 | **NO** | add a row |
| **every NEW module** (e.g. `services/mailer.py`, `services/notification_drainer.py`, `db/notifications.py`, `services/run_waiting_email.py`, new `.tsx` leaves) | 0 / 0 / n | **NO** | the gate fails on new files too (`check-hot-file-ledger.cjs` watches all of `backend/app/` and `frontend/src/` minus tests). Add a row in the same commit as the PLAN.md |

`check-hot-file-ledger.cjs` EXEMPTs `supabase/migrations/`, `scripts/`, `deploy/`, `docs/`, and `.md/.sql/.json/.yml/.txt`, so `requirements.txt`, the migration, the drift script and the env examples need no row.

### Flag 12 — Test infrastructure

See `## Validation Architecture`. Key precedents:
- **anon-role:** `tests/integration/test_299_links_live.py:212-221` runs `SET LOCAL ROLE anon` inside a savepoint on asyncpg and expects zero rows or `asyncpg.InsufficientPrivilegeError`. Function privileges: `tests/integration/test_181_secdef_privileges.py` uses `has_function_privilege('anon', …)`, and its case 4 proves "triggers still fire without EXECUTE on the trigger function".
- DB-backed tests connect to `postgresql://postgres:postgres@127.0.0.1:54322/postgres` with `pytestmark = skipif(not _pg_available())`.
- `tests/unit/test_276_invite_email_brand.py:30-40` fakes `resend` into `sys.modules`. **It must be re-targeted to the REST provider, not deleted** (REG-09-style rule).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `httpx` | `>=0.28.0` (declared, `requirements.txt:38`) | Resend REST calls | Already a direct dependency; no SDK needed (D-21) |
| `smtplib` + `email.message.EmailMessage` | stdlib (Python 3.12) | One-box SMTP provider; MIME multipart/alternative | Zero dependencies; the `EmailMessage` header guard is already the project's injection defence (`smtp_adapter.py:351-361`) |
| `asyncpg` | `>=0.29` (declared) | Outbox claim (SKIP LOCKED), triggers' DB tests | Existing pool |
| `markdown-it-py` | 4.0.0 installed (4.2.0 latest on PyPI) | D-24 markdown → HTML for the workflow email step | Already in the built image transitively; preset `js-default` + `breaks=True`, `html=False` measured safe |
| `html` | stdlib | `html.escape` for every interpolated value (D-22) | WR-02 precedent |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fastapi.concurrency.run_in_threadpool` | (fastapi 0.115.6) | `smtplib` send, `load_user_settings` | Every blocking call in async code |
| `sys.stdlib_module_names` | stdlib | Clean-image test allow-list | The import-closure test |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend REST via `httpx` | the `resend` SDK | Rejected by D-21. It is not installed and would add a dependency for one POST |
| `markdown-it-py` | hand-rolled escape-then-allow-list renderer | D-24 prefers reuse when a renderer exists. A hand-rolled renderer is a parser with edge cases (nested lists, code fences) |
| `markdown-it-py` (declared explicitly) | relying on it transitively | **Declare it.** `pyiceberg` is an optional-ish storage3 dependency that can disappear in a minor bump, and the clean-image test should check declared requirements, not luck |
| LISTEN/NOTIFY to wake the drainer | polling | Polling every 15-30 s is fine against a 120 s minimum delay. NOTIFY adds a dedicated connection per worker |

**Installation:**
```bash
# backend/requirements.txt — ADD one line (already installed in venv and image; this makes it declared)
markdown-it-py>=4.0.0
# backend/requirements.txt — nothing to remove (resend was never there)
```

**Version verification:** `pip index versions markdown-it-py` → 4.2.0 latest; the venv has 4.0.0 (`pip show`). `httpx` is unchanged.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `markdown-it-py` | PyPI | releases since 0.1.0 (years) | very high (dependency of `rich`) [ASSUMED figure] | github.com/executablebooks/markdown-it-py [ASSUMED URL] | [OK] (`slopcheck scan markdown-it-py --pkg pypi --json` → `"status": "OK"`) | Approved (already installed transitively; declare it) |
| `resend` | PyPI | — | — | — | not run | **REMOVED from the design** by D-21. Never install it |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
No npm packages are added.

## Architecture Patterns

### System Architecture Diagram

```
 engine / answer route (UNCHANGED)                 DB (migration 218)                       every uvicorn worker
 ─────────────────────────────────                ───────────────────                       ─────────────────────
 human step / engine ask ──INSERT messages──▶ [trg messages AFTER INSERT  WHEN role='system'
   (ask_user_prompt, origin=harness,              AND tool_calls IS NOT NULL]
    run_id=workflow_run)                           │ ask_user_prompt + workflow run alive + not golden
                                                   ├─▶ notifications  (UPSERT open notice: recipient=run.user_id,
                                                   │                    org=run.org_id, kind=approval|question)
                                                   └─▶ notification_deliveries (one 'pending' row per notice,
                                                         due_at = created_at + app_settings delay)
 answer route / terminal expiry ─INSERT messages─▶ │ ask_user_response → close notice (answered / run_ended)
 status writers ─UPDATE workflow_runs.status──▶ [trg workflow_runs AFTER UPDATE OF status]
                                                   └─ terminal → close open notices (run_ended)
                                                   (every trigger body: EXCEPTION WHEN OTHERS → RAISE WARNING; RETURN)

                                                  NotificationDrainer.tick() (poll ~20 s)
                                                   1. BEGIN; SELECT … WHERE status IN (pending, retry) AND due_at<=now()
                                                      FOR UPDATE SKIP LOCKED; set status='sending', attempts+1,
                                                      claimed_at=now(); freeze rendered payload if absent; COMMIT
                                                   2. still waiting? (notice open + run active/paused + unanswered prompt)
                                                        no → skipped_answered
                                                   3. opt-out? preferences.notification_email_enabled=false → skipped_opted_out
                                                   4. dev guard: not production → rewrite to redirect | none → suppressed
                                                   5. mailer.send(frozen payload, idempotency_key='run-waiting/<delivery id>')
                                                        ├─ none   → log, outcome suppressed
                                                        ├─ resend → POST api.resend.com/emails (httpx, Idempotency-Key)
                                                        └─ smtp   → smtplib in run_in_threadpool
                                                   6. UPDATE outcome: sent | failed(+reason, retry_at) | suppressed
 Control Room /admin/backpressure ◀── health_probe.email (provider + last failed delivery time/reason)
 Invite (org.py) ──▶ mailer.send(invite payload) ──▶ org_invitations.email_delivery ──▶ dialog line / list chip
```

### Recommended Project Structure
```
backend/app/
├── services/email_provider.py      # becomes the ONE mailer seam: OutboundEmail, SendOutcome, None/Resend/Smtp providers,
│                                    #   sender resolution, dev-redirect guard, compose_invite_link (kept)
├── services/run_waiting_email.py   # NEW: pure renderer (subject/text/html) from {workflow, org, waited, run_id}
├── services/notification_drainer.py# NEW: NotificationDrainer (SchedulerService shape)
├── db/notifications.py             # NEW: claim_due_deliveries (SKIP LOCKED), still_waiting, record_outcome, last_failure
├── services/run_model_resolution.py# + resolve_owner_run_model (FIX-05 helper)
supabase/migrations/218_run_waiting_notifications.sql
backend/tests/unit/test_300_*.py, backend/tests/integration/test_300_*_live.py
frontend/src/components/settings/EmailNotificationSettings.tsx   # NEW operator leaf (ApiKeyLimits shape)
frontend/src/components/settings/NotificationEmailPreference.tsx # NEW per-user switch (ModelDefaultPreference shape)
frontend/src/components/workflows/scheduleOutcomeWords.ts        # NEW zero-import vocabulary leaf (D-15)
```

### Pattern 1: Trigger detection, fail-soft, SECURITY DEFINER
**What:** AFTER INSERT on `messages` (narrowed by `WHEN`) and AFTER UPDATE OF status on `workflow_runs`. Both are SECURITY DEFINER with `SET search_path = ''`, so they can write the deny-all tables whatever role inserted the message (the answer route uses a user-JWT client; the engine uses service-role). Each body is wrapped in `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING … END`, so the engine's prompt INSERT can never fail because of a notice. PL/pgSQL's exception block is a subtransaction: only the notice writes roll back, and the message row stands.
**Example (shape, not final SQL):**
```sql
-- Source: pattern of 215_api_keys_and_run_origin.sql:136-170 (search_path='', REVOKE FROM PUBLIC first)
CREATE OR REPLACE FUNCTION public.notify_on_ask_row() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE tc jsonb := NEW.tool_calls->0; r record; v_run uuid; v_nid uuid; v_delay int;
BEGIN
  BEGIN
    IF tc->>'kind' = 'ask_user_prompt' AND NEW.origin = 'harness'
       AND tc->>'run_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_run := (tc->>'run_id')::uuid;
      SELECT id, user_id, org_id, status, is_golden_run INTO r FROM public.workflow_runs WHERE id = v_run;
      IF FOUND AND r.user_id IS NOT NULL AND NOT coalesce(r.is_golden_run,false)
         AND r.status IN ('active','paused') THEN
        INSERT INTO public.notifications (recipient_id, org_id, run_id, kind, tool_call_id)
        VALUES (r.user_id, r.org_id, r.id,
                CASE WHEN tc->'engine_pause'->>'kind' = 'action_risk' THEN 'approval' ELSE 'question' END,
                tc->>'tool_call_id')
        ON CONFLICT (recipient_id, run_id) WHERE closed_at IS NULL
          DO UPDATE SET tool_call_id = EXCLUDED.tool_call_id, kind = EXCLUDED.kind   -- re-ask keeps ONE wait (Pitfall 5)
        RETURNING id INTO v_nid;
        SELECT coalesce(notification_email_delay_seconds, 120) INTO v_delay FROM public.app_settings LIMIT 1;
        INSERT INTO public.notification_deliveries (notification_id, due_at)
        VALUES (v_nid, now() + make_interval(secs => coalesce(v_delay,120)))
        ON CONFLICT (notification_id) DO NOTHING;
      END IF;
    ELSIF tc->>'kind' = 'ask_user_response' THEN
      UPDATE public.notifications
         SET closed_at = now(),
             closed_reason = CASE WHEN (tc->>'expired') = 'true' THEN 'run_ended' ELSE 'answered' END
       WHERE tool_call_id = tc->>'tool_call_id' AND closed_at IS NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_on_ask_row swallowed: %', SQLERRM;   -- never break the engine's insert
  END;
  RETURN NULL;  -- AFTER trigger
END $fn$;
CREATE TRIGGER messages_notify_on_ask AFTER INSERT ON public.messages FOR EACH ROW
  WHEN (NEW.role = 'system' AND NEW.tool_calls IS NOT NULL)
  EXECUTE FUNCTION public.notify_on_ask_row();
REVOKE EXECUTE ON FUNCTION public.notify_on_ask_row() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_ask_row() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_ask_row() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.notify_on_ask_row() TO service_role;
```
Note: `ON CONFLICT … WHERE closed_at IS NULL` needs the partial unique index `(recipient_id, run_id) WHERE closed_at IS NULL` to exist with that exact predicate.

### Pattern 2: Outbox drain, exactly once
- Claim inside one transaction: `SELECT … FOR UPDATE SKIP LOCKED LIMIT n`, then in the **same transaction** `UPDATE … SET status='sending', attempts=attempts+1, claimed_at=now()`, and on the first claim freeze `subject/text_body/html_body/waited_seconds` (render inside the tick and write before commit). The in-transaction state change is what stops worker B re-claiming after worker A commits (the `db/schedules.py:289-292` lesson).
- Send **outside** the transaction with `Idempotency-Key: run-waiting/<delivery_id>` (Resend) and the frozen payload, so a retry is byte-identical.
- **Stale `sending` rows** (worker died mid-send, lease older than ~10 min): for `resend`, re-send with the same key and frozen payload (Resend dedupes within 24 h). For `smtp`/`none`, **do not re-send**: mark `failed` with reason "interrupted — not retried to avoid a duplicate". SMTP has no idempotency key, so at-most-once is the honest choice under NOTE-02's "never twice".
- Retries: at most 3 attempts. Backoff such as 1 min then 5 min (discretion), retrying only retryable errors (429/5xx/network/`concurrent_idempotent_requests`). Each retry re-checks still-waiting.
- **The unique key per notice delivery is `notification_deliveries.notification_id UNIQUE`.** One notice means at most one delivery row, ever.

### Pattern 3: One mailer seam
```python
# Source: shape of email_provider.py:48-105 extended (D-21/D-22)
@dataclass(frozen=True)
class OutboundEmail:
    to: str; subject: str; text: str; html: str
@dataclass(frozen=True)
class SendOutcome:
    status: Literal["sent", "failed", "suppressed"]; reason: str | None = None
    provider: str = "none"; provider_id: str | None = None; retryable: bool = False

def send_email(msg: OutboundEmail, *, idempotency_key: str | None = None) -> SendOutcome: ...
# BLOCKING (httpx.Client / smtplib). Callers use run_in_threadpool. Never raises:
# a transport failure becomes SendOutcome(status="failed", reason=<words, never the key>).
```
- Sender: `"<from_name> <from_address>"` from `app_settings`, falling back to `settings.invite_from_email` (D-08). No `Reply-To` (D-03).
- Dev guard: `if not is_production_environment(): to = app_settings.email_dev_redirect_address or → SendOutcome("suppressed", "no redirect address in a non-production environment")`.
- Invite: `send_invite` is rebuilt on `send_email` (subject `You're invited to {org} on Syrel`, HTML escaped, plus a text alternative) and returns the `SendOutcome`. `org.py` stores it on `org_invitations` and returns `email_sent: bool` (or `email_delivery`) alongside `link`.

### Pattern 4: The run-waiting email (NOTE-03)
- Inputs: `workflow_definitions.name` (via `workflow_runs.definition_id`), `organizations.name` (via `notifications.org_id`), `waited_seconds` (now − `notifications.created_at` at first claim, frozen), `run_id`, `kind`. **The prompt text is never read.** Do not select `messages.content` or `tool_calls` anywhere in the drainer.
- Subject: `f"{name} is waiting on you"` with CR, LF and other control characters stripped (D-02). `EmailMessage` also refuses CR/LF in headers. Resend takes JSON, so strip explicitly there.
- Link: `f"{primary_frontend_origin()}/app/runs/{run_id}"`. Footer: `f"{primary_frontend_origin()}/app/settings"`. No query string anywhere. Both routes exist in `frontend/src/lib/appRoutes.ts:65,71,137`.
- Wait words: "3 minutes", "1 hour 5 minutes" (discretion; never seconds-precision noise).

### Anti-Patterns to Avoid
- **Detecting waiting from `workflow_runs.status = 'paused'`.** A human step waits while `active`, so a status-based notice would miss every in-process human wait and fire on timeouts instead.
- **Taking `org_id` from `messages.org_id`** (the `autofill_org_id_by_owner` `LIMIT 1` guess, `full-schema.sql:7050`). Read `workflow_runs.org_id`.
- **Rendering the email at each attempt.** The payload changes, and Resend returns 409 instead of deduping.
- **Holding the row lock across the HTTP/SMTP call.** It ties up a pooled connection for the whole send, and a crash re-queues an email that may already be delivered.
- **Adding a new env var for the drainer switch.** Reuse `RUN_BOOT_SWEEPS` (`main.py:37-44` explains why a module flag is preferred).
- **A trigger without `WHEN`.** `messages` takes every chat token flush. The `WHEN` clause keeps the function from even being called for `user`/`assistant` rows.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown → HTML | regex `##`→`<h2>` | `markdown-it-py` `js-default` + `breaks=True` | Nested lists, code fences, link schemes; measured safe |
| MIME multipart/alternative + header-injection guard | string-built MIME | `EmailMessage.set_content(text)` + `add_alternative(html, subtype="html")`; `msg[hdr] = v` raises on CR/LF | stdlib, already the project's guard |
| Distributed exactly-once | Redis lock / leader election | `FOR UPDATE SKIP LOCKED` + in-transaction state change | `scheduler_service.py:8-14` explains why leader election fails silently |
| Duplicate suppression at the vendor | own dedupe table | Resend `Idempotency-Key` | 24 h vendor-side dedupe |
| "Is this production?" | a new check | `app.api.api_docs.is_production_environment()` | One home, fail-closed semantics already reviewed |
| "Unanswered prompt for this run" | a new query | the `get_unanswered_ask_user` SQL (`db/workflows.py:1860-1880`) | Already run-scoped (WR-05/06) |
| Required-input check | a new predicate | `inbound_inputs.missing_required` (+ a label sibling) | The 296-06 one home; pinned to the browser by `launch_fields_cases.json` |

## Runtime State Inventory

Not a rename/refactor phase. One piece of runtime state matters, though:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Existing open ask rows (runs already waiting when 218 is applied) will **not** get notices, because the trigger fires only on new inserts | Decide: no backfill (recommended; a backfill would email people about old waits at deploy time), stated in the migration header |
| Live service config | Coolify backend env: `EMAIL_PROVIDER`, `RESEND_API_KEY` (owed); `ENVIRONMENT=production` must be set or every prod email is redirected/suppressed | Operator action at deploy |
| OS-registered state | None — verified (no scheduled tasks involved) | — |
| Secrets/env vars | `RESEND_API_KEY` (existing name), new `SMTP_*` names | Parity artifacts, same commit |
| Build artifacts | Backend image must rebuild for `markdown-it-py` declaration (no new download expected) | Normal deploy |

## Common Pitfalls

### Pitfall 1: Resend rejects a retry because the body changed
**What goes wrong:** attempt 1 times out after Resend accepted it. Attempt 2 renders "waiting 4 minutes", and Resend answers `409 invalid_idempotent_request`. The row is marked failed even though the email arrived.
**How to avoid:** freeze `subject/text/html` on the first claim and reuse them on every attempt. Treat `409 concurrent_idempotent_requests` as retryable. Treat `409 invalid_idempotent_request` as "already sent with a different body" and investigate. It must never occur with frozen payloads, so assert on it in tests.

### Pitfall 2: Two drainers, or a restart, send twice
**How to avoid:** SKIP LOCKED plus the in-transaction `status='sending'` flip, `UNIQUE(notification_id)`, the Resend key, and at-most-once handling of stale `sending` rows on SMTP. The DB-backed test runs two drainers with `asyncio.gather` against one due row and asserts one provider call.

### Pitfall 3: A trigger error breaks the engine's fail-closed prompt insert
**What goes wrong:** `engine_ask.py:1025-1038` treats a prompt-insert failure as fail-closed (D-50). A trigger that raises would turn every approval into a failed run.
**How to avoid:** an `EXCEPTION WHEN OTHERS` block around the whole body. Test it by making the notice insert fail on purpose (e.g. temporarily revoke, or plant a constraint violation inside a savepoint) and asserting the message row still lands.

### Pitfall 4: An email goes out after the question was answered
**How to avoid:** re-check right before sending, in this order: notice `closed_at IS NULL`; run status `IN ('active','paused')`; an unanswered `ask_user_prompt` exists for the run (the `get_unanswered_ask_user` query, not the exact `tool_call_id`, see Pitfall 5). Then read the opt-out. Do all of it on a fresh read after the claim commits.

### Pitfall 5: A re-ask under a new `tool_call_id` leaves a stale notice
**What goes wrong:** `human_input` mints a fresh `tool_call_id` every time the step re-enters (`human_input.py:161-170`). A boot re-drive can post a new prompt while the old notice (keyed on the old id) is still open. The partial unique index blocks the new notice. When the new id is answered, the old notice never closes, and Phase 301's list shows a ghost.
**How to avoid:** `ON CONFLICT … DO UPDATE SET tool_call_id = EXCLUDED.tool_call_id` keeps ONE open notice per run, carries the current id, and keeps `created_at` (the same wait). The terminal-status trigger is the backstop.

### Pitfall 6: Dev mail reaches a real inbox
**How to avoid:** the guard sits inside the mailer (both invite and run-waiting go through it), keyed on `is_production_environment()`. Two tests: non-production with no redirect → `suppressed` and the provider is never called; non-production with a redirect → `to` rewritten. In production the redirect is ignored. Note that the local `backend/.env` has `ENVIRONMENT` unset, which counts as non-production.

### Pitfall 7: The clean-image test passes only because the dev venv has the package
**How to avoid:** do not rely on importing in the venv. Walk the AST of the mailer and drainer modules, **including function-local imports**, and assert every top-level module name is in `sys.stdlib_module_names`, `app`, or the distribution set **declared in `requirements.txt` minus the Dockerfile filter** (`grep -ivE '^sentence-transformers'`), mapped import-name → dist (`markdown_it` → `markdown-it-py`, `httpx` → `httpx`, `fastapi`). Also assert that `resend` appears nowhere under `backend/app`. CI's Docker build stays the authoritative proof, since Docker is denied in the agent shell (memory `reference_shell_is_git_bash_and_docker_denied.md`).

### Pitfall 8: A schedule row says "completed" for a run that is waiting on someone
**What goes wrong:** `_drive_run` reports `"completed"` whenever `run_workflow` returns without raising (`unattended_launch.py:357`), and an engine pause returns normally. The SEED-281 04:19 run would read "Last ran · Finished" while it was waiting.
**How to avoid (within D-15):** in the scheduler's `_record_outcome`, read `workflow_runs.status` for the run before recording, and record `paused` when the run paused, so the vocabulary says "Waiting for someone to answer". It is one small read in the FIRING `scheduler_service.py`, so state it explicitly in the plan.

### Pitfall 9: The SMTP provider routes through the connector egress guard
**What goes wrong:** `open_pinned_smtp` (`smtp_adapter.py:368-374`) refuses private/loopback hosts, which is right for tenant-configured hosts. The one-box's operator relay may legitimately be local.
**How to avoid:** the app SMTP provider uses plain `smtplib.SMTP`/`SMTP_SSL` against the operator-configured env host (trusted infra), with a timeout, STARTTLS or implicit TLS stated by config, `send_message`, and the refused-recipients check. Reuse the adapter's patterns, not its egress binder.

### Pitfall 10: `workflow_runs.user_id` is NULL on old rows
**How to avoid:** the trigger skips a run with `user_id IS NULL` (no recipient). That is correct, and it is recorded in a comment.

## Code Examples

### FIX-04 fire-time block (mirror of `scheduler_service.py:118-132`)
```python
# after the foreign-folder block, before the entitlement check
from app.services.inbound_inputs import missing_required_labels  # sibling of missing_required (:144)
labels = missing_required_labels(definition, schedule.get("inputs") or {})
if labels:
    from app.db.schedules import record_schedule_outcome
    sentence = blank_required_sentence(labels)   # "Didn't run — Client name is required and has no value."
    await record_schedule_outcome(pool, _as_uuid(schedule["id"]), status=sentence)
    raise ScheduledLaunchRefused(sentence)
```

### FIX-05 (unattended_launch.py:181)
```python
from app.services.run_model_resolution import resolve_owner_run_model
_model, _provider = await resolve_owner_run_model(owner_id)          # one helper; logs + (None, None) on failure
run_id = await create_workflow_run(pool, ..., model=_model, provider=_provider, ...)
# and in the _drive_run dict: "model": _model, "metadata": {"provider": _provider} if _provider else None
```

### Resend call (httpx, blocking, run in threadpool)
```python
# Source: resend.com/docs/api-reference/emails/send-email (fetched 2026-10-29)
r = httpx.post("https://api.resend.com/emails", timeout=10.0,
    headers={"Authorization": f"Bearer {settings.resend_api_key}", "User-Agent": "Syrel-mailer/1",
             "Idempotency-Key": key},
    json={"from": sender, "to": [msg.to], "subject": msg.subject, "html": msg.html, "text": msg.text})
# 200 → {"id": ...}; 429/5xx/409 concurrent → retryable; 4xx else → failed, not retried. Never log the key.
```

### Markdown → HTML + text (D-24)
```python
from markdown_it import MarkdownIt
_MD = MarkdownIt("js-default", {"breaks": True, "html": False})  # measured: escapes <script>, no javascript: links
html_body = _MD.render(body_markdown)
message.set_content(body_markdown)                 # the plain-text part keeps the agent's line breaks
message.add_alternative(html_body, subtype="html")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `resend` SDK lazy import (Phase 167) | REST via `httpx` | this phase (D-21) | Built images can send; `test_276` is re-targeted |
| Invite failure only logged (`org.py:416-417`) | Outcome persisted + returned + shown | this phase (D-11) | NOTE-06 "failed send is visible" |
| SMTP step plain text only (`smtp_adapter.py:288-291`, D-32 of 190) | text + rendered HTML alternative | this phase (D-24) | No literal `##`/`**` |
| Receipt names the host (190 D-08) | receipt names the recipient (host optional) | this phase (D-23) | BUG-260828-05 |

**Deprecated/outdated:** `docs/OPERATOR.md:421-423` "`pip install resend`", `backend/.env.example:268` (same), `config.py:1717-1723` comment ("the `resend` package is an opt-in lazy import").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Resend's error body is `{statusCode, name, message}` | Flag 6 | Low. Parse defensively, fall back to the HTTP status |
| A2 | Cloud Coolify has `ENVIRONMENT=production` set | Pitfall 6, Runtime inventory | High. If unset, every prod email is redirected/suppressed. Covered by the existing deploy checklist row (`DEPLOYMENT-WORKFLOW.md:164`); verify at deploy |
| A3 | No production email has ever been delivered by the app | Flag 3 | Low for design, medium for the "first ever send" risk at G-4. The orchestrator should run the two SELECTs |
| A4 | SMTP host/port/username belong in env as "SMTP credentials" (infra), not in Settings | Open Question 3 | Medium. D-08 is ambiguous for non-secret SMTP fields |
| A5 | `markdown-it-py` download figure and repo URL | Package audit | Negligible. slopcheck OK |
| A6 | Not backfilling notices for runs already waiting at migration time is acceptable | Runtime inventory | Low. One-time gap at deploy |

## Open Questions

1. **Has production ever sent an email?** Not verified here (no MCP in this subagent). Recommendation: the orchestrator runs the two read-only SELECTs in Flag 3 before planning closes and records the answer in CONTEXT/STATE. The design does not depend on the answer.
2. **D-07 says "Seeded in the OPERATOR.md Step-3 seed list", but the repo's rule is that a column-default knob is schema, not a seed** (`OPERATOR.md:316-322`; mig 214 header). The drift script also counts any `NNN_name.sql` mention in OPERATOR.md as a seed. Recommendation: honour D-07's intent (deploy parity) by documenting the delay knob, its default (120 s) and bounds in OPERATOR.md's email section, and write **no Step-3 row and no `218_…sql` filename** in OPERATOR.md, because 218 carries no seed INSERT. Record this as a planner interpretation of D-07.
3. **Where do the non-secret SMTP fields live (host, port, username, TLS mode)?** D-08 lists only the delay, from-address, from-name and redirect for Settings, and "SMTP password/credentials" for env. Recommendation: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_SECURITY` (`starttls|ssl`) in env. They are infra plus secret, the one-box sets them once, and they sit beside `EMAIL_PROVIDER`. Each needs the parity artifacts.
4. **`GET /notifications`:** the ROADMAP's 301 entry says it depends on "Phase 300 (the notices and `GET /notifications`)", while CONTEXT says 300 only writes notices. Recommendation: 300 ships the table with an owner-SELECT RLS policy (so 301 can read it with the user's JWT) and **no route**. 301 owns the route. Note this in the 300 SUMMARY so 301's planner is not surprised.
5. **Approval vs question for an author's `ask_user` gate whose prompt reads like an approval.** By D-04 the kind comes from the pause kind only, so it is "answer". Accept.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Postgres (Supabase) | migration 218, trigger/outbox/anon tests | ✓ (127.0.0.1:54322 accepts TCP) | — | — |
| Redis | not required by this phase's tests | ✓ (6379) | — | — |
| Mailpit web UI | manual look at SMTP mail | ✓ (54324 web) | — | — |
| Mailpit SMTP port | live SMTP drive of the one-box provider | ✗ (54325 closed; no `supabase/config.toml` in repo) | — | Unit tests with a fake `smtplib.SMTP`; live SMTP drive is an operator/one-box UAT row |
| Docker CLI in the agent shell | clean-image build proof | ✗ (denied in agent shell, per memory) | — | AST/requirements closure test + CI Docker build |
| Resend account / key / verified `notify.<domain>` | live Resend send | ✗ (operator action owed) | — | `none` provider locally; G-4 row once the key exists |
| `markdown-it-py` | D-24 | ✓ | 4.0.0 | — |
| slopcheck | package audit | ✓ | — | — |

**Missing dependencies with no fallback:** a Resend key plus DNS for the live Resend G-4 row (operator).
**Missing dependencies with fallback:** Mailpit SMTP, Docker build (see the table).

## Validation Architecture

(`workflow.nyquist_validation` is `false` in `.planning/config.json`. This section was explicitly requested by the orchestrator and is included.)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8 + pytest-asyncio (`asyncio_mode = auto`, `backend/pytest.ini`); vitest (frontend) |
| Config file | `backend/pytest.ini`, `backend/tests/conftest.py` (sets `app.main.RUN_BOOT_SWEEPS = False`) |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/unit/test_300_*.py -q` |
| DB-backed run | `cd backend && venv/Scripts/python -m pytest tests/integration/test_300_*_live.py -q -rs` (skips if :54322 is down; **take the local-DB lock**) |
| Full backend gate | `node scripts/check-backend-unit-baseline.cjs` (ceiling 71 failed) |
| Frontend | `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run <files>`; `npx tsc -p tsconfig.app.json --noEmit` (set-diff vs base); `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` once per wave |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-04 | create/patch 422 names the label; patch toggle not refused | unit | `pytest tests/unit/test_300_schedule_required_inputs.py -x` | ❌ Wave 0 |
| FIX-04 | fire time records the sentence, raises Refused, tick does not overwrite | unit | same file (extends the `test_workflow_scheduler.py` fakes) | ❌ |
| FIX-05 | `launch_unattended_run` passes model+provider to `create_workflow_run` and the drive dict | unit | `pytest tests/unit/test_300_unattended_provider.py -x` | ❌ |
| FIX-05 | resume continues on the recorded provider (8-row roster) | manual UAT | HUMAN-UAT rows (key + schedule × roster) | ❌ |
| NOTE-02 | trigger: workflow ask → one notice + one pending delivery; chat ask → none; cap_paused → none; golden → none; answer closes; terminal closes; re-ask keeps one open notice | integration (DB) | `pytest tests/integration/test_300_notice_triggers_live.py` | ❌ |
| NOTE-02 | a trigger failure never blocks the message insert | integration (DB) | same file | ❌ |
| NOTE-02 | two drainers → one send; restart mid-send (stale `sending`) → no second SMTP send; Resend resend reuses key + frozen payload | integration (DB) + fake provider | `pytest tests/integration/test_300_drainer_once_live.py` | ❌ |
| NOTE-02 | answered before due → `skipped_answered`, provider not called | integration (DB) | same | ❌ |
| NOTE-02/D-19 | `anon` cannot SELECT/INSERT notifications or deliveries; another user cannot read a notice; trigger functions not executable by PUBLIC/anon/authenticated | integration (DB) | `pytest tests/integration/test_300_rls_anon_live.py` | ❌ |
| NOTE-03 | rendered email contains name (escaped), org, wait words, link; no prompt text, no `?`, no token; subject has no CR/LF | unit | `pytest tests/unit/test_300_run_waiting_email.py` | ❌ |
| NOTE-04 | opt-out false → `skipped_opted_out`, notice still present | integration (DB) | drainer file | ❌ |
| NOTE-06 | Resend provider: request shape, headers (Bearer, Idempotency-Key, User-Agent), error classification (`httpx.MockTransport`) | unit | `pytest tests/unit/test_300_mailer.py` | ❌ |
| NOTE-06 | SMTP provider via a fake `smtplib.SMTP`: multipart/alternative, refused recipient → failed, runs in threadpool | unit | same | ❌ |
| NOTE-06 | dev guard: non-prod no redirect → suppressed; redirect → rewritten; prod ignores redirect | unit | same | ❌ |
| NOTE-06 | clean-image import closure; `resend` absent from `backend/app` | unit | `pytest tests/unit/test_300_clean_image_imports.py` | ❌ |
| NOTE-06 | invite outcome persisted + returned; `test_276` re-targeted to REST | unit | `pytest tests/unit/test_276_invite_email_brand.py tests/unit/test_300_invite_outcome.py` | ⚠ exists, re-target |
| D-23/D-24 | receipt names the recipient; body HTML rendered, text keeps breaks, `<script>` escaped | unit | `pytest tests/unit/test_300_email_step_honesty.py tests/unit/test_190_smtp_header_injection.py` | ❌ / ✅ |
| D-15/D-16 | row words (no raw code), Run now busies one row, no "Loading…" swap | vitest | `npx vitest run src/components/workflows/__tests__/WorkflowScheduleModal.test.tsx` | ✅ extend |
| D-11 | dialog failure line; "Email not sent" chip | vitest | `InvitationsTab.test.tsx` + new dialog test | ✅ / ❌ |
| D-12 | HealthSignals Email row words | vitest | `HealthSignals.a11y.test.tsx` extend | ✅ |

### Sampling Rate
- **Per task commit:** the targeted `test_300_*` files for the task (plus the touched vitest file).
- **Per wave merge:** the backend unit baseline gate (under the local-DB lock), the vitest count gate and the typecheck set-diff.
- **Phase gate:** all `test_300_*` (unit + live) green; baseline ≤ 71; then `/gsd:verify-work`. The G-4 rows (live Resend send, signed-out link journey needing 299's G4-4a, FIX-05 roster) are human UAT.

### Wave 0 Gaps
- [ ] `backend/tests/integration/test_300_*_live.py`: fixtures that insert a thread + published definition + workflow_run (copy the `test_299_links_live.py` row builders) and clean up in a savepoint/rollback.
- [ ] A fake-provider hook in the mailer (injectable `send_email`) so the drainer test counts calls without the network.
- [ ] Migration 218 applied to local (venv asyncpg, one transaction, under the lock) before any live test.

## Security Domain

`security_enforcement: true`, so `/gsd:secure-phase` applies.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no new auth) | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | RLS: `notifications` owner-SELECT only; `notification_deliveries` deny-all (no policies, `REVOKE ALL FROM PUBLIC, anon, authenticated`); SECURITY DEFINER functions with `EXECUTE` revoked from PUBLIC; per-user opt-out written via `auth.uid()` merge |
| V5 Input Validation | yes | `html.escape` for every HTML value; subject CR/LF strip + the `EmailMessage` header guard; schedule input 422 |
| V6 Cryptography | no | — (no new crypto; secrets in env) |
| V7 Error/Logging | yes | Never log the API key or the SMTP password; never put tokens in a URL; log the delivery id, not the body |
| V8 Data Protection | yes | NOTE-03: no prompt or document content in the email (the drainer never reads `messages.content`/`tool_calls`) |
| V12/V13 (outbound) | yes | Fixed Resend URL; SMTP host from operator env only |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Header injection via the workflow name in the subject | Tampering | Strip `\r\n` and control chars; `EmailMessage` raises on CR/LF |
| HTML/content injection via workflow or org name | Tampering | `html.escape(value, quote=True)` (WR-02) |
| Document/prompt leakage by email | Information disclosure | The renderer's input set excludes prompt fields; a unit test asserts the prompt text is absent |
| `anon` reads notices or outbox (the BUG-260911-01 class) | Information disclosure | RLS + anon-role live test + `get_advisors(security)` on cloud at deploy |
| `search_path` hijack in a SECURITY DEFINER trigger | Elevation | `SET search_path = ''`, fully qualified names |
| Duplicate sends / mail bombing | DoS | Unique delivery per notice, SKIP LOCKED, max 3 attempts, one email per wait |
| Dev mail to real users | Information disclosure | Non-production redirect/suppress guard in the mailer |
| Invite link token in logs | Information disclosure | Keep `NoneLogProvider`'s behaviour (logs the link by design for the offline flow). Do not add new token logging |
| Trigger raising inside the engine's insert | DoS | `EXCEPTION WHEN OTHERS` swallow + test |

## Recommended Plan Split (G-8: 4 plans, 3 waves)

| Plan | Wave | Scope | Mutates local DB? |
|------|------|-------|-------------------|
| **300-01 Scheduler fixes first** | 1 | FIX-04 (label sibling + sentence in `inbound_inputs.py`; create/patch 422 in `api/schedules.py`; fire-time block + honest `paused` outcome in `scheduler_service.py`); FIX-05 (`resolve_owner_run_model` in `run_model_resolution.py`; one call in `unattended_launch.py` + drive dict); D-15/D-16 (`scheduleOutcomeWords.ts` leaf; `WorkflowScheduleModal.tsx` quiet refresh + per-row busy) | No (unit/vitest only) |
| **300-02 Migration 218 + triggers + settings data layer** | 1 | `218_run_waiting_notifications.sql`: `notifications`, `notification_deliveries`, two SECURITY DEFINER triggers, `app_settings` columns (delay 60-3600 default 120, from_address, from_name default 'Syrel', dev_redirect_address), `org_invitations.email_delivery` (+ `email_failed_at`/`email_failure`); `UserEffectiveSettings` fields + `_val` (`models/user_settings.py`); `api/settings.py` allow-list/bounds; regenerate `full-schema.sql`; live trigger + RLS/anon tests | **Yes** (holds the lock) |
| **300-03 One mailer + drainer + invite backend + deploy parity + email step** | 2 | `email_provider.py` → none/resend(httpx)/smtp + dev guard + `SendOutcome`; `run_waiting_email.py`; `db/notifications.py` + `notification_drainer.py`; `main.py` start/stop hunk gated on `RUN_BOOT_SWEEPS`; `config.py` (`email_provider` literal, SMTP fields); `health_probe.py` email key; `org.py` stores and returns the outcome; D-23 (`phase_types.py` one line) + D-24 (`smtp_adapter.py` HTML alternative); `requirements.txt` + `markdown-it-py`; re-target `test_276`; clean-image test; parity artifacts (`.env.example`, onebox, compose, OPERATOR.md, drift script); live two-drainers test | **Yes** (drainer live test) |
| **300-04 Settings + invite + health UI** | 2 (parallel with 03 against a contract written in both plans) | `me_preferences.py` GET/PUT for `notification_email_enabled`; `NotificationEmailPreference.tsx` in `PreferencesSection.tsx`; `EmailNotificationSettings.tsx` leaf + `SettingsPage.tsx` hunk; `lib/api/skills.ts`, `lib/api/settings.ts`/`org.ts` types; `InviteMemberDialog.tsx` failure line; `InvitationsTab.tsx` chip; `HealthSignals.tsx` Email row | No |

**Cannot share a worktree or run concurrently:** 300-02 and 300-03 both mutate the shared local Postgres (migration apply; live trigger/drainer tests). They are in different waves, and each takes `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock` (memory rule) against other sessions. 300-03 and 300-04 are file-disjoint (04 does not touch `main.py`, because `me_preferences.py` is already routed), so they may run in parallel. The contract both plans must state verbatim: `GET /admin/backpressure → dependencies.email = {state: "up"|"down"|"off", provider, last_failure_at, last_failure_reason}`; the invite responses gain `email_sent: boolean`; the invitations list rows gain `email_delivery: "sent"|"failed"|"not_sent"|null`.

**Operator actions (record in the plans, never executed by agents):** cloud paste of 218, then `get_advisors(security)` (approval-gated); Coolify `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`; `notify.<domain>` with SPF/DKIM/DMARC `p=none` at Hostinger; confirm Coolify `ENVIRONMENT=production`; the one-box VPS allows outbound SMTP. **Close gate:** 299's G4-4a (signed-out link journey) must run before 300 closes.

## Sources

### Primary (HIGH confidence)
- Codebase, read this session: `services/email_provider.py`; `api/org.py:380-560`; `services/connectors/smtp_adapter.py:284-425`; `services/harness/human_input.py:140-356`; `services/harness/engine_ask.py:350-500, 912-1040`; `services/harness_engine.py:236-310, 1057-1089, 2560-2620`; `db/workflows.py:500-580, 1695-1892, 2291-2385`; `api/runs.py:740-812, 990-1100`; `api/threads.py:2085-2104`; `services/run_model_resolution.py:217-260`; `services/unattended_launch.py:150-361`; `services/scheduler_service.py` (all); `api/schedules.py:97-303`; `services/inbound_inputs.py:58-190`; `main.py:30-50, 495-540`; `config.py:1300-1320, 1690-1730`; `api/settings.py:40-70`; `api/me_preferences.py`; `services/health_probe.py`; `supabase/full-schema.sql` (workflow_runs, messages, user_settings, org_invitations, triggers); `supabase/migrations/214, 215, 217`; `docs/OPERATOR.md:193-330, 410-425`; `scripts/check-deploy-drift.sh`; `scripts/check-hot-file-ledger.cjs`; frontend `WorkflowScheduleModal.tsx`, `PreferencesSection.tsx`, `appRoutes.ts`, `HealthSignals.tsx`
- Measurements: `pip show`/`find_spec` (resend absent, markdown-it-py 4.0.0 via rich←pyiceberg←storage3), markdown-it-py preset renders, ledger triples via the CLAUDE.md recipe, TCP probes 54322/6379/54324/54325

### Secondary (MEDIUM confidence)
- resend.com/docs/api-reference/emails/send-email; /api-reference/errors; /api-reference/introduction; /dashboard/emails/idempotency-keys (fetched 2026-10-29)

### Tertiary (LOW confidence)
- Resend error JSON field names (not shown on the fetched pages)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Everything is stdlib or already installed; one explicit declaration.
- Architecture: HIGH. The waiting signal, the close signal and the excluded kinds are all traced to writers.
- Pitfalls: HIGH for codebase pitfalls (5, 8, 9 found by reading). MEDIUM for Resend 409 semantics (official docs).
- Production email history: LOW (not queried).

**Research date:** 2026-10-29
**Valid until:** 2026-11-28 (codebase facts go stale on the next commit to a FIRING file; re-derive the line numbers before editing)
