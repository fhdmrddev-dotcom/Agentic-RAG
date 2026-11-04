# Phase 308: Told by Webhook - Research

**Researched:** 2026-11-04
**Domain:** Transactional outbox (Postgres triggers + per-worker SKIP LOCKED drainer), Standard Webhooks signing, SSRF-safe egress, RLS-true visibility re-check
**Confidence:** HIGH (every seam read at file:line; four facts measured live on the local DB / this box)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Event catalogue and who receives what (HOOK-01; intake Q6 / Q17 carried forward)
- **D-01:** Three subscribable types plus a test type:
  - `run.finished` — a `workflow_runs` row **enters** `completed`, `failed` or `cancelled` from a non-terminal status (`data.status` says which).
  - `run.waiting` — a `workflow_runs` row **enters** `paused` or `cap_paused` from a different status (both need a person in the app; Q17).
  - `document.ingested` — a `documents` row **enters** `completed` from a non-`completed` status, **or is inserted already `completed`** (`ingest_splice.py` inserts completed rows). A re-ingest that goes `processing → completed` is a new event by design.
  - `webhook.test` — sent only by the Test button; never subscribable.
- **D-02:** "Run" means **workflow runs** only. Chat turns (the `runs` table, including MCP `ask_agent` threads) are not runs here. SC#2's origins (in-app, scheduled, API key, MCP) are exactly `workflow_runs.origin_kind` (`app` / `schedule` / `key` / `mcp`).
- **D-03:** Recipients:
  - Run events → subscribed, enabled endpoints **owned by the run's `user_id` in the run's `org_id`** ("your runs"). A run with no `user_id` emits nothing (research confirms which origins can leave it null).
  - `document.ingested` → every subscribed, enabled endpoint **in the document's `org_id` whose owner can see the document** (D-23 decides, at fan-out). A delivery row is never created for an item the owner cannot see, so the log can never reveal one.
- **D-04:** Endpoints are **member-owned** (Q6): `user_id` + `org_id` (the active org at creation, via `X-Org-Id`). An endpoint never receives events from another org.

#### Emission and exactly-once (HOOK-03)
- **D-05:** **Emission is from database triggers, never application code** (document completion has 4+ writers). `AFTER INSERT OR UPDATE OF status` on `workflow_runs` and `documents`; transition-guarded (`OLD.status IS DISTINCT FROM NEW.status` plus the D-01 sets). Each trigger writes **one** `webhook_events` row and nothing else — no fan-out, no HTTP. It skips the insert when no enabled endpoint in that org subscribes to that type (one cheap `EXISTS`).
- **D-06:** **Swallow-and-warn** exactly like migration 218: the body sits in `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING … END`, so a trigger error never breaks run finalization or ingestion. `SECURITY DEFINER`, `SET search_path = ''`, `EXECUTE` **revoked from `PUBLIC`** (then anon, authenticated) — CLAUDE.md's PUBLIC-grant trap.
- **D-07:** Exactly-once is structural, in three places: (1) one event per status transition, written inside the row's own transaction; a partial `UNIQUE (type, item_id)` for `run.finished` so a terminal run can never emit twice; (2) fan-out inserts deliveries with `UNIQUE (endpoint_id, event_id)` and `ON CONFLICT DO NOTHING`; (3) deliveries are claimed `FOR UPDATE OF d SKIP LOCKED` with the `'sending'` flip, attempt count and lease stamp **inside the claiming transaction**, and the HTTP send happens **outside** it (the `db/notifications.py` shape, including lease renew before send and stale-`sending` reclaim). Redis is not the record; it is not needed at all.
- **D-08:** Proof is two driven tests, not reasoning: (a) a **two-drainer live test** on the local DB (the `tests/integration/test_300_drainer_once_live.py` shape) showing one send per (endpoint, event); (b) an **emission matrix**: every run-finishing path (origins app / schedule / key / mcp × completed / failed / cancelled) and every ingest-completing path (upload, watched source, mail, re-ingest, dedup insert) produces exactly one event. Research enumerates the writers by grep; the matrix is the evidence.
- **D-09:** **`webhook-id` = `msg_` + the event id** — identical across retries and resends to that endpoint. A test event gets its own event id.
- **D-10:** `WebhookDrainer` runs in **every** worker (the `NotificationDrainer` / `SchedulerService` shape, no leader), started by **one lifespan block** in `backend/app/main.py` (G-5). Two loops in it: fan-out (claim undelivered events → create deliveries) and send (claim due deliveries → send → record). Maintenance mode does not stop deliveries.

#### Signing, secrets and payloads (HOOK-02)
- **D-11:** **Hand-rolled Standard Webhooks signer**: headers `webhook-id`, `webhook-timestamp` (unix seconds), `webhook-signature: v1,<base64 HMAC-SHA256(key, "{id}.{timestamp}.{body}")>`; the secret is `whsec_` + base64 of 32 random bytes and the HMAC key is the decoded bytes. The body is serialized **once** and the exact bytes are signed and sent. `standardwebhooks==1.1.0` is a **test-only** dependency (dev requirements, never the runtime image) that verifies interop in a test.
- **D-12:** Secrets are stored **only encrypted** through `backend/app/security/secret_cipher.py` (`encrypt_secret` / `decrypt_secret`). With no cipher configured, creating an endpoint is refused with a plain sentence (fail closed); never plaintext at rest. The secret is **shown once** — at creation and at each roll (the 304 key pattern); no reveal.
- **D-13:** **Roll with overlap:** a roll makes a new current secret and keeps the previous one for **24 hours**; during the overlap every delivery carries **both** signatures, space-separated (`v1,<new> v1,<old>`). Only one previous secret is kept; a second roll inside the window ends the first overlap early, and the confirm sheet says so. After the window the old ciphertext is erased.
- **D-14:** Payload, Standard Webhooks shape `{"type", "timestamp", "data"}`:
  - run: `run_id`, `workflow_id`, `org_id`, `status`, `origin_kind`, `link` (`run_link()` — `/app/runs/<id>`);
  - document: `document_id`, `folder_id`, `org_id`, `status`, `link` (`doc_link()` — `/app/library/<id>`);
  - test: `endpoint_id`, `message`.
  **No names, titles, filenames, inputs, outputs or error text.** Links come from the existing helpers in `backend/app/mcp/results.py` (move or import; research picks, no third copy). The payload is **frozen at fan-out**.
- **D-15:** When the org's PII redaction is on (305, GUARD-03), the payload goes through the **existing** `backend/app/services/outbound_guard.py` / `pii_redactor.py` before it is frozen. Failure → the delivery is `failed` with reason `redaction_failed` and **nothing is sent**. A test asserts an id-and-link payload comes out byte-identical (redaction must not break ids).
- **D-16:** Request: `POST`, `Content-Type: application/json`, `User-Agent: Syrel-Webhooks/1`, 10 s timeout, response read under a small cap and **discarded**. Success = any 2xx.

#### Retries, delivery log, resend, auto-disable (HOOK-04)
- **D-17:** Schedule: attempt 1 at once, then +30 s, +5 min, +30 min, +2 h, +8 h (6 attempts, about 10.5 h), then `failed`. Retried: network error, timeout, 408, 429 (`Retry-After` honoured up to the next step's cap), 5xx. Not retried: other 4xx and any 3xx (redirects are refused, D-20). **410 Gone disables the endpoint at once** (reason `gone`). Constants in code beside the drainer (the 300 `RETRY_BACKOFF_SECONDS` precedent).
- **D-18:** **Auto-disable:** each endpoint keeps a `consecutive_failures` count of deliveries that ended `failed`; any 2xx resets it; at **5** the endpoint is disabled with reason `failing`, its pending deliveries become `skipped_disabled`, and the owner gets an in-app notice (D-19).
- **D-19:** **In-app notice through the one existing home** — Phase 300/301's `notifications` and the "Waiting on you" list: a new kind `webhook_disabled` with an `endpoint_id`, `run_id` made nullable under a CHECK (question / approval → `run_id` required; webhook_disabled → `endpoint_id` required). The row opens the Webhooks tab and closes when the owner re-enables or deletes the endpoint. **The 300 email drainer must never email it** (its deliveries are created only by `notify_on_ask_row`; research verifies every 300/301 reader tolerates a null `run_id` and a test pins it). If research finds this unsafe, the alternative is a new `D-NN`, never silent.
- **D-20 (log):** Per endpoint, newest first, paged: event type, item link, status (`pending` / `retrying` / `sent` / `failed` / `skipped_*`), attempts, last HTTP status code, last latency (ms), times. A separate attempts table records status code, latency and an error word per attempt. **No column holds a response body, response headers or the request body**; a scan test over every SQL constant enforces it (the `test_300_notification_drainer.py` scan).
- **D-21:** **Resend** a `sent` or `failed` delivery → back to `pending` with a fresh schedule, **same `webhook-id`**. Not on a disabled endpoint. Rate-limited per member (a `rate_limit.py` bucket).
- **D-22:** Retention: events, deliveries and attempts older than **30 days** are purged by the existing retention sweeper (`backend/app/db/retention.py`) if it fits cleanly; otherwise plant a seed with a trigger. Research decides which.

#### Visibility re-check and SSRF refusal (HOOK-05)
- **D-23:** **One new closed capability `webhook` in `egress.py`**: https only, `_CALLER` host match (the endpoint's own host passed as `allowed_host` — the `send_email` / `client_metadata` arm), public addresses only, DNS-pinned, redirects refused. Validated **at save** (`validate_destination`, off the event loop) and **at every send** (`send_pinned_http` re-resolves and re-validates, so a DNS change is caught). No delivery bypasses `egress.py`. `test_190` is amended on purpose (P-1), as 307 did.
- **D-24:** An **SSRF refusal corpus**, driven at save and at send: `http://`, `localhost`, `127.0.0.1`, `[::1]`, 10/8, 172.16/12, 192.168/16, 100.64/10, `169.254.169.254`, `metadata.google.internal`, IPv4-mapped IPv6, decimal / octal / hex IP spellings, userinfo in the URL, a public name resolving to a private address (resolver seam), a 302 to an internal host (transport seam). The save refusal is one plain sentence: *"That address can't be reached from the internet, so Syrel won't send to it."* No dev bypass — local testing uses a public receiver or the seams.
- **D-25:** **Owner liveness** at fan-out and at send through the **one** liveness predicate (`backend/app/security/principal_liveness.py`; an adapter or its pure core — a second predicate fails review): owner still a member of the endpoint's org, not banned. Failure → delivery `skipped_owner_gone` and the endpoint disabled with reason `owner_removed` (no notice to a removed person).
- **D-26:** **Item visibility at send** (and at document fan-out, D-03) through `acting_member_connection(user_id=owner, org_id=endpoint.org_id)` (`backend/app/security/acting_member.py`): `SELECT 1` on the run or document under the same RLS the app uses. Not visible → `skipped_not_visible`, nothing sent. No service-role re-implementation of visibility.

#### Endpoint model and the member screen (HOOK-01; G-2 / G-4)
- **D-27:** Endpoint fields: `url`, optional `description` (≤ 100 chars, untrusted text, never rendered as HTML), event types (≥ 1 required), `enabled`, `disabled_reason` (`failing` / `gone` / `admin` / `owner_removed`), times, last success. URL: https, ≤ 2048 chars, no userinfo, no fragment, query allowed. **Cap 10 endpoints per member per org.**
- **D-28:** The member screen is a **new Settings tab "Webhooks"** — one `TabsTrigger` + one `TabsContent` on `SettingsPage.tsx` (G-5 "one mount"); everything else lives in a new `frontend/src/components/settings/webhooks/` folder: endpoint list, add/edit form (URL, event checkboxes, description), secret-once panel with a short verify snippet (Python and Node, `standardwebhooks`), **Send test**, **Roll secret** (confirm sheet naming the 24 h overlap), Disable / Enable, **Delete** (victim-naming confirm), delivery log with **Resend**. Words live in a copy module (the `apiKeysCopy.ts` pattern). Available to every member; no tier gate.
- **D-29:** **Test is synchronous**: same signer and same egress path, recorded in the log as a `webhook.test` delivery, not retried, rate-limited; the UI shows status code, latency and a plain verdict sentence.

#### Org admin (HOOK-06)
- **D-30:** An org-admin **"Webhooks" section mounted once inside `OrgApiKeysTab.tsx`** (the 307 `OrgConnectedApps` precedent; no new tab on the FIRING `OrgAdminShell.tsx`). Lists every endpoint in the org: owner, host + path (**query hidden** — it may hold a receiver token), events, status, last success, failure count. Actions: **Disable** (reason `admin`) and **Delete** (victim-naming confirm). An admin-disabled endpoint shows the owner "Turned off by an org admin" and **only an admin can re-enable it**.
- **D-31:** **Audit lockstep (293):** `webhook.endpoint.created / updated / deleted / enabled / disabled / secret_rolled / test_sent / delivery_resent / auto_disabled` — actor, endpoint id and host only (never a query string or a secret). The migration CHECK and `backend/app/services/audit_service.py`'s literal list change in the **same commit**; the org audit tab and the operator audit tab get labels.

#### Data, security and deploy
- **D-32:** **Migration `225_webhooks.sql`** (next free number; 224 is 307's). RLS **on** for every new table; **anon gets nothing**; `authenticated` never reads another member's rows and **never the secret ciphertext** (the simplest shape: no authenticated grant at all, every read through the backend with explicit owner / admin checks, as `notification_deliveries`). An **anon-role test** (nothing in the suite requests as `anon`); `get_advisors(security)` against local after apply. Applied locally via the SQL editor, then `bash scripts/regenerate-full-schema.sh` (no reset); `scripts/full-schema-supplement.sql` if grants need it.
- **D-33:** Cloud: 225 is pasted after 220 → 224, **per-action operator approval**, then `get_advisors(security)` — recorded as **owed**, never done by this phase.
- **D-34:** No new env var is expected. If one appears, deploy-artifact parity in the same commit (`deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml`, `scripts/check-deploy-drift.sh`).

#### Process and guardrails
- **D-35 (G-2):** The Webhooks tab and the admin section are **new surfaces** (the 307 situation, not 304-306's extensions). Claude builds the sketch and self-approves it because the operator delegated end to end; recorded as a guardrail override in `STATE.md`. Order: sketch → UI-SPEC → plan. Re-open: the operator asks to see the sketch.
- **D-36 (G-8):** Target **5 plans**: (1) migration 225 + triggers + db layer + anon test (wave 1, DB-mutating); (2) egress `webhook` capability + signer + sender + SSRF corpus (wave 1); (3) drainer: fan-out, visibility / liveness, retries, auto-disable, notice, two-drainer live test, emission matrix (wave 2, DB-mutating); (4) member + admin routes, audit, rate limits, OpenAPI (wave 2); (5) Settings tab + admin section (wave 3). Targeted suites per task, full gates once per wave.
- **D-37 (G-5):** Minimal edits on FIRING files: `egress.py` (one capability, three dict entries), `main.py` (one lifespan block), `SettingsPage.tsx` (one mount), `OrgApiKeysTab.tsx` (one mount), `audit_service.py` (literals), `rate_limit.py` (buckets), `full-schema-supplement.sql`. `ingestion_queue_service.py` **should not be touched** (emission is in triggers); if a plan names it, add its ledger row first. Run `node scripts/check-hot-file-ledger.cjs` on the plans.
- **D-38:** Worktree rule 4: plans 1 and 3 mutate the local DB and serialize. Backend ceiling **71** holds; vitest gate run per CLAUDE.md.
- **D-39 (G-4)** — operator "I'd recognise failure here" rows, driven by Claude through Chrome MCP:
  1. Add an endpoint at a public receiver → Send test → it arrives and verifies with `standardwebhooks`.
  2. Finish a workflow run and ingest a document → **exactly one** delivery each in the log, with a working link.
  3. A receiver answering 500 → retries visible in the log → disabled after 5 → a notice in "Waiting on you".
  4. Save `http://169.254.169.254/` or an internal host → refused with the sentence.
  5. An org admin disables a member's endpoint → the member sees "Turned off by an org admin" and cannot re-enable it.
- **D-40:** Cross-provider UAT axis: webhooks are provider-independent (the trigger sees a status, not a model), so the 8-row roster is **not applicable**; one row finishes a run on a non-default provider to show it. Recorded as a decision, not an omission.

### Claude's Discretion
- Drainer poll intervals, batch size, lease length (the 300 values are the default).
- Table and column names, index shapes, the exact error-word vocabulary.
- Whether the attempts table is a child table or a JSON column (no body either way).
- UI layout details, settled by the sketch and UI-SPEC.

### Deferred Ideas (OUT OF SCOPE)
- `document.failed` (ingest failure) event — useful, not in HOOK-01's list.
- An operator deployment kill switch and an org switch for webhooks (the `mcp_enabled` pattern).
- Org-owned endpoints; replay since a date; ed25519 signatures (REQUIREMENTS Future).
- Event filters by folder or workflow; custom request headers; batching.
- Operator-tunable retry schedule and overlap length (constants in v1).
- Revealing a secret after creation (v1 is show-once + roll).
- An email when an endpoint is auto-disabled (v1 is in-app only).

#### Reviewed, not folded
- Seeds whose text mentions webhooks — `SEED-013` (already folded into v4.9; its flip is Phase 309's REG-10 work), `SEED-014`, `SEED-062`, `SEED-142`, `SEED-144`, `SEED-145`, `SEED-146`, `SEED-177`, `SEED-209`, `SEED-213`, `SEED-246` — all concern inbound connectors, sandbox egress or automations, not outbound event delivery. The structured sweep (`check-seeds-register.cjs --phase 308`) matched 0 (no plans yet); re-run at plan-phase.
- `BUG-260923-01` (settings surfaces crowd the nav rail) — a ninth Settings tab adds to it; left open, noted for the UI-SPEC to keep the tab label short.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOOK-01 | Add an https endpoint, choose events, send a test event | §Q6 (egress at save, measured userinfo gap), §Q13 (docs/landing gates a ninth tab trips), §Q11 (rate buckets, link helpers), Validation map |
| HOOK-02 | Standard Webhooks signing, roll with overlap; thin payload; redaction | §Q7 (spec + `standardwebhooks` 1.1.0 source read: per-attempt timestamp), §Q8 (**the shipped guard WITHHOLDS a text-free payload — D-41 needed**), §Q12 secret_cipher |
| HOOK-03 | Every finish / ingest path → exactly one event per endpoint, two workers | §Q1 (all run writers, terminal guard, golden runs), §Q2 (all ingest writers, **no writer inserts `completed`**), trigger shape (**PG rejects `OLD` in an INSERT-including WHEN — measured**), two-drainer test §Q14 |
| HOOK-04 | Retries/backoff, delivery log (no body), resend, auto-disable + in-app notice | §Q3 (**`LIST_OPEN_SQL` inner-joins the run — a webhook notice is invisible without a rewrite**), §Q9 retention, `send_pinned_http` raises on oversize bodies |
| HOOK-05 | Owner can still see the item at send; private/internal refused at save and send | §Q4 (liveness adapter, no second predicate), §Q5 (acting connection works with no request; RLS mapping), §Q6 (SSRF corpus measured on this box) |
| HOOK-06 | Org admin lists / disables / deletes endpoints | `require_org_manage` (`app/api/api_keys.py:63`), OrgApiKeysTab mount (FIRES), §Security (path may carry a receiver token) |
</phase_requirements>

## Summary

Every seam this phase reuses exists and was read at the line. The outbox shape (218 + `db/notifications.py` + `notification_drainer.py`), the egress binder, the liveness predicate, the acting-member connection and the cipher all fit with **small adapters and no second copy of anything**. Four findings change the plan, though, and three of them contradict a sentence in CONTEXT.md, so each needs a recorded decision rather than a silent fix:

1. **The redaction guard as shipped would block every webhook in an org that has redaction on.** `outbound_guard.guard()` returns `WITHHELD` for any model whose type tree declares no `RedactableText` field (`backend/app/services/outbound_guard.py:130-133`). D-14's payload carries no text at all, so with the switch on, D-15 would mark every delivery `redaction_failed` and send nothing. See D-41 below.
2. **No code path inserts a `documents` row already `completed`.** The only insert is `ingest_splice.py:394`, with `status: "pending"` at `:370`. The dedup path returns the existing row without inserting anything. The INSERT arm is still worth keeping as a defence, but Postgres **refuses `OLD` in the WHEN of a trigger that includes INSERT** (measured: `INSERT trigger's WHEN condition cannot reference OLD values`). So it must be two triggers sharing one function.
3. **A `webhook_disabled` notice would never appear in "Waiting on you".** `LIST_OPEN_SQL` (`backend/app/db/notifications.py`, the Phase 301 read) does `JOIN public.workflow_runs wr ON wr.id = n.run_id AND wr.status IN ('active','paused')`. A null `run_id` drops the row and `total` does not count it. The rest of the D-19 plan is safe: the email drainer only sees rows with a `notification_deliveries` row, which only `notify_on_ask_row` creates; `notify_on_run_status` matches on `run_id = NEW.id`; and the partial unique index treats NULLs as distinct. The list query, the `WaitingNotice` model and the frontend type all have to change.
4. **Golden runs (publish-time validation runs) would fire `run.finished`.** Measured locally: 73 `is_golden_run = true` rows with `origin_kind` NULL. 218 excludes them, and the trigger must too.

Smaller corrections: `test_190` needs **no amendment**, because 307 already made an empty-tuple `_CALLER` key legal (`tests/unit/test_190_egress.py:578-597`), so `webhook` passes as-is. `retention.py` does **not** fit a log purge; it is a per-org, policy-driven document sweep that is off by default. Nothing writes `cap_paused` into `workflow_runs`, so `run.waiting` fires only on `paused` today. `egress.validate_destination` **accepts userinfo** (measured ALLOWED, and httpx would turn it into Basic auth), so the route must refuse it. A new router and a ninth tab both trip `check-docs-coverage.cjs` **at edit time** through its PostToolUse hook, so plan 4/5 must add a stub docs page.

**Primary recommendation:** Copy the 218/300 outbox exactly: trigger, then event row, then fan-out, then delivery rows, then a SKIP LOCKED claim with the send outside the transaction. Add the one `webhook` `_CALLER` capability, and record D-41..D-50 below before planning.

## Proposed new decisions (research findings that change a locked sentence — record before planning)

| # | Decision | Why (evidence) |
|---|----------|----------------|
| **D-41** | Payload models are Pydantic. `outbound_guard.guard()` gains ONE keyword-only opt-in, `textless_ok: bool = False`: when it is True and the model is a `BaseModel` whose tree declares no `RedactableText`, the model comes back unchanged instead of `WITHHELD`. MCP never passes it (the default keeps 305 byte-identical; a 305 pin asserts the default). The webhook call passes `textless_ok=True`. The D-15 test then reads: with the switch on, the frozen bytes equal the switch-off bytes, and a walker raise is `redaction_failed`. | `outbound_guard.py:128-133` withholds every text-free model when the switch is on. *Rejected alternative:* a phantom `RedactableText \| None = None` field on the envelope keeps 305 untouched but is a misleading type. *Also rejected:* skipping the guard, which contradicts ROADMAP SC#1 ("pass through the redaction guard"). |
| **D-42** | Golden runs (`is_golden_run = true`) emit nothing. | 218's `notify_on_ask_row` excludes them; local DB: 73 golden rows. They are publish validation runs, excluded from run history. |
| **D-43** | The `run.waiting` trigger keeps `cap_paused` in its set for forward compatibility, but the emission matrix drives `paused` only. A test pins that `cap_paused` is in the trigger's set. | No writer: `grep` finds no `cap_paused` write into `workflow_runs`; 218 header says the same (`218_run_waiting_notifications.sql:20-21`); local DB has 0 such rows. Every pause writer is `db/workflows.py:2338 pause_run`. |
| **D-44** | Retention: `db/retention.py` does not fit. The `WebhookDrainer` runs an hourly purge tick: `DELETE FROM webhook_events WHERE created_at < now() - interval '30 days'` in bounded batches, with deliveries and attempts cascading. It is idempotent across workers. No seed. | `retention.py` is the Phase 275 per-org, lease-based **document-policy** sweep, gated by `retention_sweep_enabled` and **off by default** (`main.py:608-621`). Attaching a log purge to it would make purging depend on a governance switch. |
| **D-45** | `test_190` is **not** amended; a 308 pin (`test_webhook_is_wired_in_all_three_tables`, the `test_307_cimd_fetch.py:159` shape) is added instead. | `test_190_egress.py:578-597` already admits an empty-tuple `_CALLER` key (307 amendment). Amending a passing fence for show is churn. |
| **D-46** | The URL rules in D-27 (no userinfo, no fragment, https, ≤ 2048) are enforced in the **route/model validator**, and are re-asserted by the sender before every send. | Measured: `validate_destination('…', 'https://user:pw@example.com/x?y=1#f')` → **ALLOWED** (egress reads `.host` only, `egress.py:28-31`). `send_pinned_http` copies the URL with only the host replaced (`:793`), so httpx would send `Authorization: Basic …`. |
| **D-47** | `document.ingested` uses **two** triggers on one function: `AFTER INSERT … WHEN (NEW.status = 'completed')` and `AFTER UPDATE OF status … WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')`. The workflow_runs trigger is UPDATE-only, because runs are always inserted `active` (`db/workflows.py:543-545`). | Measured: the combined form errors. D-01's "ingest_splice inserts completed rows" is refuted (`ingest_splice.py:370`); the INSERT arm is a defence only. |
| **D-48** | The `webhook_disabled` notice is written for both `failing` **and** `gone`. It is not written for `admin` (the admin acted on purpose and the owner sees the card state) or for `owner_removed` (D-25). | UI-SPEC §Surface 3 already carries words for `gone`; a 410 silently turning an integration off is the PITFALLS "auto-disabled quietly" failure (`.planning/research/PITFALLS.md:491`). |
| **D-49** | Plans 4 and 5 add a **stub** docs page `docs/public/administer/settings/webhooks.md` (`status: stub`, `covers: [settings-tab:webhooks, router:webhooks]`), plus its entry in `docs/public/sections.json`. Phase 309 writes the content. | `check-docs-coverage.cjs` derives `router:` keys from `app.include_router(x.router)` in `main.py` and `settings-tab:` keys from the literal `<TabsTrigger>` labels (`scripts/lib/docs-content.cjs:660-735`). Both new keys are `[uncovered]` without a page, and the guard hook fires in the editing turn. |
| **D-50** | `main.py` takes **four** small hunks, not one block: the router import name, `app.include_router(webhooks.router)`, the lifespan start block, and the lifespan stop block. | The 300 precedent added both start (`main.py:536-552`) and stop (`:676-683`); the 301 precedent added the import plus `include_router` (`:915`, `:970`). Routes cannot exist otherwise. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Event emission (run finished / waiting, doc ingested) | Database (triggers) | — | 4+ writers per item; only the row's own transaction sees every one (D-05) |
| Fan-out, visibility, liveness, signing, sending, retry | API/Backend (WebhookDrainer, every worker) | Database (SKIP LOCKED claim) | The DB arbitrates ownership of a row; the backend does the HTTP outside the transaction (D-07) |
| SSRF refusal / DNS pin / redirect refusal | API/Backend (`egress.py`) | — | The one socket choke point (`egress.py:44-47`) |
| Item visibility | Database (RLS via acting connection) | Backend (calls it) | D-26: no service-role re-implementation |
| Secret at rest | Backend (`secret_cipher`) | Database (ciphertext column, no client grant) | D-12 / D-32 |
| Endpoint CRUD, test, roll, resend, admin | API/Backend (new `api/webhooks.py`) | — | Every read goes through explicit owner/admin checks (no authenticated grant) |
| Webhooks tab, admin section, Waiting row | Browser | API | Never optimistic (UI-SPEC) |

## Project Constraints (from CLAUDE.md)

- Python backend in `backend/venv`; raw SDK calls; Pydantic for structured shapes.
- Every table has RLS; users see only their own data. **Revoke EXECUTE from `PUBLIC` first**; a `REVOKE … FROM anon` alone is a no-op.
- Migrations are numbered SQL under `supabase/migrations/`, pasted into the **local SQL editor**, then `bash scripts/regenerate-full-schema.sh` (no `--reset`). Never `db push`/`db reset`. `full-schema.sql` is never hand-edited.
- Blocking I/O never runs directly in async handlers (`run_in_threadpool`, D-v2.5-01). `validate_destination` does a blocking `getaddrinfo`, so save-time validation goes through `run_in_threadpool`.
- `WORKER_COUNT=2`: every singleton/loop must be safe with two workers (the drainer is, by DB arbitration).
- Settings belong in the UI and `app_settings`; env vars are for secrets and infra only (D-34: no new env var).
- Supabase MCP points at **production**. Reads are free; **writes need per-action approval**. Cloud paste of 225 is owed (D-33), and `get_advisors(security)` is cloud-only.
- G-5 hot-file ledger: `node scripts/check-hot-file-ledger.cjs <phase>` fails on any `files_modified` source file with **no row, including NEW files** (measured: the gate flagged the not-yet-existing `backend/app/db/webhooks.py` and `backend/app/services/webhook_drainer.py`). Add a "young (created 308-0N)" row and its section in the same commit.
- G-8: 3-5 plans; targeted suites per task, full gates once per wave.
- Backend unit baseline: **71 failed / 3497 passed / 2 xfailed / 2 xpassed / 0 collection errors**. A test-only import that is missing locally becomes a **collection error** and breaks the gate.
- Vitest: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root; frontend typecheck is `npx tsc -p tsconfig.app.json --noEmit` (plain `tsc --noEmit` checks zero files). New suites need first pins in `scripts/vitest-count-gate.cjs` (the 307-05 precedent).
- Deployment-artifact parity applies only if an env var appears (D-34: none expected).
- Worktree rule 4: DB-mutating plans (1, 3) serialize. Use the local-DB lock between sessions (memory: noclobber lock).

## Findings by open question (evidence at file:line)

### Q1 — Every writer of `workflow_runs.status`

All four origins create runs through **one** function, `db/workflows.py:543-545` (`create_workflow_run`, INSERT with `status = 'active'` hard-coded). Callers: `api/threads.py:2048` (`origin_kind="app"`, `:2104`), `services/unattended_launch.py:195` (schedule `scheduler_service.py:261`, key `api/inbound.py:339`, mcp `mcp/run_tools.py:238`), and `harness/publish_service.py:1715` (golden, `origin_kind` NULL). **No path inserts a terminal run.**

| Writer | Transition | Used by |
|---|---|---|
| `db/workflows.py:2338` `pause_run` | non-terminal → `paused` | `harness_engine.py:1949, 2743, 2779`; `harness/engine_ask.py:1006` |
| `db/workflows.py:2383` | `paused` → `active` | resume (not an event) |
| `db/workflows.py:2543` `finish_run` | → `completed` / `failed` / `cancelled`; **guarded**: `WHERE status IS NULL OR status NOT IN (terminal) OR status = $2` | `harness_engine.py:2314` (completed), `:1969, :2010` (failed), `api/workflows.py:1613` (delete cascade, cancelled), `run_lifecycle.py:573` (Stop, cancelled), `api/runs.py:670`, `run_handoff.py:275` |
| `harness/run_handoff.py:234` `_GUARDED_TERMINAL_SQL` | `WHERE status = ANY($3)` from live statuses → terminal | `run_handoff.py:268, 294, 378, 433`; `run_reconciler.py:335` (boot sweep, from `active` only) |
| `api/runs.py:660` | `active`/listed → `failed` (guarded `= ANY($2)`) | ask-answer re-drive failure |

- **Out of terminal?** No. `finish_run`'s guard refuses a different terminal value (`:2543-2548`), `claim_run` never touches status (`:2604`), and the only `→ active` write is from `paused` (`:2383`). A same-value re-write (`completed → completed`) fires `UPDATE OF status` but fails `OLD IS DISTINCT FROM NEW`, so it emits nothing. The partial `UNIQUE (type, item_id) WHERE type = 'run.finished'` is a second wall.
- **Other writers:** the supabase-py calls on `workflow_runs` are reads plus one `continues_used` update (`api/runs.py:1376`). `full-schema.sql` has no SQL function that updates either table's status.
- **NULL `user_id`:** the column is nullable (mig 064) but `create_workflow_run` takes `user_id: UUID` (`db/workflows.py:408`). Measured locally: **0 rows** with NULL `user_id`. No origin leaves it null today; the trigger's `user_id IS NOT NULL` guard is a defence.
- **`cap_paused`:** zero writers into `workflow_runs` (see D-43).
- **Golden runs:** must be excluded (D-42).

### Q2 — Every writer of `documents.status = 'completed'`

| Writer | Path(s) | Form |
|---|---|---|
| `services/ingest_splice.py:1125` | queue path: **upload**, **watched source** (`watch_service.py:50` → mint → queue), **mail** (Phase 240 mailbox via watches) | supabase-py `.update({"status": "completed", …}).eq("id", …)` |
| `api/documents.py:2676` (`ingest_document`) | **re-ingest** routes (`documents.py:1438`, `:1971`), **email attachments** (`email_attachments.py:443`), splice delegation (`ingest_splice.py:864`) | supabase-py update |
| `db/ingestion_jobs.py:256` | stuck-`processing` sweep: **set-based bulk UPDATE** `SET status = CASE WHEN has_chunks THEN 'completed' ELSE 'failed' END … WHERE d.status = 'processing'` | asyncpg |

- The only INSERT is `ingest_splice.py:394`, with `status: "pending"` (`:370`). The dedup hit returns `MintResult(is_duplicate=True)` **without inserting** (`:146-165`), so a duplicate upload is correctly *not* a new ingest. **D-01's "inserted already completed" premise is refuted**; the matrix row "dedup insert" becomes "dedup produces **zero** events".
- **Re-ingest:** `completed → pending` (`documents.py:1513`, `:1896`; also `expert_install_service.py:484`), then `pending → processing` (`:2466`), then `processing → completed`. That is one new event per re-ingest, as D-01 intends. Re-**embed** (`reembed_service.py`) rewrites chunk vectors only and never touches `documents.status`, so there is no storm on an embedding switch.
- **Trigger coverage:** a `FOR EACH ROW` trigger fires once per affected row of a set-based UPDATE (`ingestion_jobs.py:256`), and PostgREST updates fire triggers like any SQL. Every writer names `status` in its SET list, so `UPDATE OF status` catches all of them. The user-JWT re-ingest path (`authenticated`) fires a `SECURITY DEFINER` trigger without holding EXECUTE (the test_181 fact cited in `218:46`).
- `documents.org_id` is `NOT NULL` (`full-schema.sql:2517`), so the EXISTS can key on it.

### Q3 — D-19 safety: every reader of `public.notifications`

| Reader | Null `run_id` / new kind safe? | Change needed |
|---|---|---|
| `db/notifications.py` `CLAIM_SQL` (email drainer) | Yes: it drives from `notification_deliveries`; only `notify_on_ask_row` inserts deliveries (`218:249-251`) | none, plus a pin test: a `webhook_disabled` notice has no delivery and the drainer sends nothing |
| `STILL_WAITING_SQL` | only called per claimed delivery | none |
| `LIST_OPEN_SQL` (301, `GET /notifications`) | **No.** `JOIN workflow_runs wr ON wr.id = n.run_id AND wr.status IN (…)` drops the row and the `total` | **rewrite**: `LEFT JOIN` runs, definitions and `webhook_endpoints`; `WHERE n.recipient_id = $1 AND n.closed_at IS NULL AND ((n.kind IN ('question','approval') AND wr.status IN ('active','paused')) OR (n.kind = 'webhook_disabled' AND e.user_id = $1 AND NOT e.enabled AND e.disabled_reason IN ('failing','gone')))` |
| `api/notifications.py` `WaitingNotice` | **No**: `run_id: UUID`, `kind: Literal["question","approval"]`, `workflow_name: str` | `run_id: UUID \| None`, kind adds `"webhook_disabled"`, add `endpoint_id`, `reason`, `title` (`workflow_name` optional) |
| `218 notify_on_run_status` | Yes: `WHERE n.run_id = NEW.id` never matches NULL | none |
| `218 notify_on_ask_row` `ON CONFLICT (recipient_id, run_id) WHERE closed_at IS NULL` | Yes: the index predicate is unchanged; NULL `run_id` values are distinct, so they never conflict | none |
| `notifications_one_open_per_recipient_run` | unaffected (as above) | add `UNIQUE (endpoint_id) WHERE closed_at IS NULL AND kind = 'webhook_disabled'` |
| Realtime publication (mig 219) + `useWaitingNotices.ts:221` (`event: "*"`, `recipient_id=eq.uid`) | Yes: it only triggers a refetch | none |
| `frontend/src/lib/api/notifications.ts` `WaitingNotice` type | **No** | widen the type as above |
| `attentionConditions.ts:335-340` (`openRun(notice.run_id)`, `runId: notice.run_id`) | **No**: assumes a run | the webhook arm per UI-SPEC §Surface 3 |
| `WaitingOnYouList.tsx:93,116`, `waitingVocabulary.ts:39-41` | glyph/words default to run words | one arm each (UI-SPEC) |
| `health_probe.py:39` (`latest_delivery_facts`) | reads deliveries only | none |

Migration changes to `notifications`: `ALTER COLUMN run_id DROP NOT NULL`; add `endpoint_id uuid NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE` (a delete removes the notice, and Realtime DELETE triggers a refetch). The kind CHECK becomes `IN ('question','approval','webhook_disabled')`. Add the shape CHECK: `(kind IN ('question','approval') AND run_id IS NOT NULL AND endpoint_id IS NULL) OR (kind = 'webhook_disabled' AND endpoint_id IS NOT NULL AND run_id IS NULL)`. The `closed_reason` CHECK gains `'endpoint_enabled'`. **Verdict: D-19 is safe with these changes**, and no alternative D-NN is needed.

### Q4 — Liveness reuse (D-25)

`principal_still_allowed(pool, *, key_row)` (`security/principal_liveness.py:58-89`) reads `revoked_at`, `expires_at`, `org_id`, `user_id` and `kind`. Absent keys skip the revoke and expiry checks, and `kind != "mcp"` returns after membership + ban (`:76-77`). **Adapter, no second predicate:**

```python
# backend/app/services/webhook_liveness.py (or inside the drainer module)
from app.security.principal_liveness import principal_still_allowed

async def endpoint_owner_allowed(pool, endpoint) -> bool:
    # The ONE predicate (D-25): membership of the endpoint's org, then ban. kind="webhook" never
    # reads the MCP switches (principal_liveness.py:79-80).
    refusal = await principal_still_allowed(
        pool, key_row={"org_id": endpoint["org_id"], "user_id": endpoint["user_id"], "kind": "webhook"}
    )
    return refusal is None
```

Cost: two point reads (`org_members` via `db/api_keys.py:305-313`, `auth.users.banned_until` via `dependencies.py:243-262`). `_is_banned` fails **open** on a DB error; that is safe because membership fails closed (`principal_liveness.py:31-32`).

### Q5 — Visibility (D-26)

- `acting_member_connection(user_id=, org_id=)` (`security/acting_member.py:58-63`) calls `get_user_pg_connection(None, {"id": user_id})` (`dependencies.py:169-187`). `request` is unused, so **it works from a background drainer**. It is one pool acquire plus a transaction plus four `SET`/`set_config` statements (`dependencies.py:155-165`), then the SELECT.
- **Batch:** group the claimed deliveries by `(owner, org)` and open **one** acting connection per group, using `SELECT id FROM public.documents WHERE id = ANY($1)` (or `workflow_runs`) and treating ids not returned as not visible. Do not open one connection per delivery. **ContextVar hazard** (`acting_member.py:20-24`): spawn no task inside the scope.
- **RLS mapping:**
  - `workflow_runs_select_own` = `org_id IN current_user_org_ids() AND auth.uid() = threads.user_id` (`full-schema.sql:11061`). `current_user_org_ids()` intersects membership with the `app.acting_org_id` GUC (`:253-261`), so "visible" means *the owner is still a member of that org AND owns the run's thread*. That is exactly the in-app rule.
  - `documents`: own, OR an org-shared folder, OR a connection-visible doc (`:9828`). The RESTRICTIVE `documents_agent_read_retrievable` only bites when the GUC `app.agent_read = 'on'` (`:10279`), which the acting connection never sets. This matches the app's library view.
  - A document moved to another org (`org_move.py:1125`) becomes invisible under the endpoint's org, so it is `skipped_not_visible`. That is correct.

### Q6 — Egress (D-23)

**Exact edit, three entries, after `client_metadata` (`egress.py:335`, `:356`, `:379`):**
```python
# ALLOWED_HOST_SUFFIXES
    "webhook": (),   # 308 D-23: the endpoint URL's own host, per call (_CALLER); empty on purpose
# _HOST_MATCH
    "webhook": _CALLER,
# _TLS_SCHEMES
    "webhook": frozenset({"https"}),
```
- **test_190:** no amendment needed (D-45). `test_190_egress.py:587-597` already lets a `_CALLER` key carry an empty tuple. `test_google_round1.py:349-362` and `test_221_application_grouping.py:390-398` iterate Google tool keys only, so they are unaffected.
- **`send_pinned_http`** (`egress.py:695-874`): validates off-loop (`:768-771`), rewrites to the IP (`:775`) and keeps the **port** (measured: `https://example.com:8443/hook` gives a pin with `port=8443`). It returns `PinnedResponse(status_code, headers, body)` (`:626-638`) **with no timing**: measure latency with `time.monotonic()` around the call. `Retry-After` is in `headers`.
- **3xx** raises `EgressRefused(reason_code="redirected")` (`:826-839`), and the body is never returned. Classify it as not retried, error word `redirect`.
- ⚠ **An oversized or undecodable 2xx body raises** `EgressResponseTooLarge` (`:843-860`) or `EgressResponseUndecodable` (`:618`). The status code is lost, but the receiver probably processed the request. Recommendation: `max_bytes = 65536`, classify these as `failed`, error word `response_too_large`, **not retried** (retrying risks a duplicate). Pin it in a test.
- ⚠ The `Host` header is `pinned.hostname` without the port (`:789`). On a non-443 port this departs from RFC 9110's `host:port`. Most servers tolerate it; note it and leave it (a change would touch a FIRING file beyond D-37's budget).
- **SSRF corpus measured on this box (Windows, httpx 0.28.1):** `2130706433` → `unresolvable`; `0x7f000001` → `unresolvable`; `127.1` → `unresolvable`; `0177.0.0.1` → `httpx.InvalidURL` (refuse as unparseable); `[::ffff:127.0.0.1]` → `address_not_public`; `localhost` → `address_not_public`; `metadata.google.internal` → `unresolvable` locally. On Linux (glibc `inet_aton`) the decimal/hex spellings will resolve to 127.0.0.1 and refuse as `address_not_public`. **Assert "refused (any code)" with the default resolver, and assert the exact code through the resolver seam.** **Userinfo is ALLOWED by egress** (D-46).
- The logs carry capability, host and reason only (`egress.py:428-445`). The drainer must log endpoint and delivery ids, **never the URL** (a receiver token can sit in the path or query).

### Q7 — Standard Webhooks signer

- Spec ([CITED: github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md]): headers `webhook-id`, `webhook-timestamp`, `webhook-signature`. The signed content is `msg_id.timestamp.payload`. Format `v1,<base64>`, with multiple signatures **space-delimited** for rotation. Secrets are `whsec_` + base64 of **24-64** random bytes (32 fits). Payload `{type, timestamp (ISO 8601), data}`, kept under ~20 KB. 2xx = success, 3xx = failure (do not follow), 410 = disable, 429/502/504 = throttle. Use `webhook-id` as the idempotency key. Tolerance is "some allowable tolerance".
- **`standardwebhooks` 1.1.0, source read from the wheel:** `from standardwebhooks import Webhook, WebhookVerificationError`; `Webhook(secret)` strips `whsec_` and base64-decodes; `wh.verify(data: bytes | str, headers: dict) -> parsed JSON`. It lower-cases header names, splits the signature header on `" "` then `","`, checks only `v1`, compares with `hmac.compare_digest`, and enforces a **±5-minute** timestamp window. It does `data.decode()` (UTF-8) before signing.
- ⚠ **Pitfall:** because of the 5-minute window, `webhook-timestamp` and the signature must be computed **at each attempt** (and each resend). Only the **body bytes** are frozen. A resend days later with the original timestamp would fail verification.
- Serialize the body with `json.dumps(payload, separators=(",", ":"), ensure_ascii=True, sort_keys=True).encode()`: ASCII bytes, so the library's `decode()` can never change them.
- **Runtime deps: none.** Wheel METADATA has no `Requires-Dist`; the official `libraries/python/pyproject.toml` has `dependencies = []`. **There is no dev-requirements file today**: the Dockerfile installs `requirements.txt` (`backend/Dockerfile:32-34`), which already includes pytest. Recommendation: create `backend/requirements-dev.txt` (`standardwebhooks==1.1.0`), add `pip install -r requirements-dev.txt` to `.github/workflows/backend-tests.yml` (the psycopg2 precedent, `:49-54`), and **install it into the local venv in the same task**, or the interop test becomes a collection error that breaks the 71 gate. The interop test does a hard import, not an `importorskip` (a skip would hide the proof).

### Q8 — Redaction (D-15)

- Call shape: `await outbound_guard.guard(model, org_id=str(org_id), is_on=lambda o: outbound_policy.pii_redaction_enabled(pool, o))`. The switch reader is `db/outbound_policy.py:25-31` (`organizations.pii_redaction_enabled`); `mcp/dispatch.py:190` is the precedent. A switch read that raises fails **safe** (it redacts, `outbound_guard.py:126-129`).
- **Blocking finding:** a dict is withheld (`_walk` raises `_Unreadable` on dict, `:178-182`), and a model with no `RedactableText` is withheld (`:130-133`). The payload must be nested Pydantic models (envelope and `data` per type) with **typed non-text fields** (`UUID`, `Literal`, `datetime`, `str` link), plus D-41's opt-in. A type-fence test asserts `redactable_fields(...) == set()` for every payload model **and** that the guarded bytes equal the unguarded bytes.

### Q9 — Retention (D-22)

`db/retention.py` (412 lines) is policy storage, receipts and per-org sweep leases for document dispositions. The sweeper is `services/retention/sweep_service.py`, started only when `retention_sweep_enabled` (`main.py:608-621`), which is off by default. **No clean place.** Go with D-44 (a drainer purge tick). Shape:
```sql
DELETE FROM public.webhook_events e
 WHERE e.id IN (SELECT id FROM public.webhook_events
                 WHERE created_at < now() - interval '30 days'
                 ORDER BY created_at LIMIT 1000)
-- deliveries and attempts: ON DELETE CASCADE from webhook_events
```
Never purge a delivery in `sending`; after 30 days none exist, because the longest schedule is about 10.5 h. Two workers deleting the same set is idempotent.

### Q10 — Migration 225 shape

- **Next number 225** confirmed (`ls supabase/migrations` ends at `224_mcp_oauth_grants.sql`).
- **Grants:** copy the 218 `notification_deliveries` block (`218:140-148`) for every new table: RLS on, **no policy**, revoke ALL from PUBLIC/anon/authenticated/service_role, then `GRANT ALL … TO service_role`. Trigger functions follow the 218 Group-A shape (`218:282-285`). Mirror every ACL line into `scripts/full-schema-supplement.sql` after the 224 block (`:930-942`); the `-- migration 224 —` comment shape is the template.
- **Audit lockstep:** the CHECK was last re-stated by **217** (`217_org_item_move_audit.sql:32-54`, 40 literals). 220/222/223/224 each say "not touched". 225 must `DROP CONSTRAINT IF EXISTS audit_log_action_type_check; ADD CONSTRAINT … CHECK (action_type = ANY (ARRAY[<all 40 from 217>, <9 webhook.endpoint.*>]))`. `VALID_ACTION_TYPES` (`audit_service.py:13-39`) gains the same nine in the same commit. Pin it with a `test_308_migration_225_static.py` copied from `test_298_migration_217_shape.py:74-92` (it derives "the last migration before this one that re-stated the CHECK" by scanning, so the 40 are never retyped by hand).
- **`assert_action_types_synced`** (`audit_service.py:42-67`, called hard-fail at boot `main.py:391-392`): it checks **`VALID_ACTION_TYPES ⊆ live CHECK`**. A backend carrying the nine literals **refuses to boot** against a database without 225. Local: apply 225 before restarting the backend on the new code. Cloud: paste 225 **before** the backend deploy (the 217 D-35 order). Write this into the deploy-parity checklist.
- Labels: `frontend/src/components/admin/AuditTab.tsx:85` and `OrgAuditTab.tsx:55` maps (group "Webhooks").

**Recommended table shape** (names are Claude's discretion):
```sql
webhook_endpoints(id uuid pk, user_id uuid not null fk auth.users on delete cascade,
  org_id uuid not null fk organizations on delete cascade, url text not null check (length(url) <= 2048 and url like 'https://%'),
  description text null check (description is null or char_length(description) <= 100),
  event_types text[] not null check (cardinality(event_types) >= 1 and event_types <@ array['run.finished','run.waiting','document.ingested']),
  enabled bool not null default true, disabled_reason text null check (disabled_reason in ('failing','gone','admin','owner_removed')),
  disabled_at timestamptz, secret_ciphertext text not null check (secret_ciphertext like 'enc:v1:%'),
  previous_secret_ciphertext text null, previous_secret_expires_at timestamptz null,
  consecutive_failures int not null default 0, last_success_at timestamptz, created_at, updated_at)
  -- index (org_id) where enabled; index (user_id, org_id)
webhook_events(id uuid pk, type text not null check (type in (...4 incl webhook.test)), org_id uuid not null fk cascade,
  item_id uuid null, owner_id uuid null, status text null, origin_kind text null, definition_id uuid null, folder_id uuid null,
  endpoint_id uuid null /* test only */, payload jsonb null /* frozen at fan-out */, fanned_out_at timestamptz null, created_at)
  -- UNIQUE (item_id) WHERE type = 'run.finished'; index (created_at) WHERE fanned_out_at IS NULL
webhook_deliveries(id uuid pk, endpoint_id fk cascade, event_id fk webhook_events cascade, status text check (pending|retrying|sending|sent|failed|skipped_not_visible|skipped_owner_gone|skipped_disabled),
  reason text null, attempts int default 0, next_attempt_at timestamptz, claimed_at timestamptz,
  last_status_code int, last_latency_ms int, last_error text check (word list), last_attempt_at, sent_at, created_at, updated_at,
  UNIQUE (endpoint_id, event_id))
webhook_delivery_attempts(id, delivery_id fk cascade, attempt int, status_code int null, latency_ms int null, error text null, created_at)
```
⚠ The `secret_ciphertext like 'enc:v1:%'` CHECK makes "never plaintext at rest" structural. A `webhook.test` event needs `endpoint_id` and no item. Store `payload` on the event (one per event; identical bytes for every endpoint).

**Trigger sketch (D-05/D-06/D-07/D-42/D-47):**
```sql
CREATE OR REPLACE FUNCTION public.webhook_emit_run_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_type text;
BEGIN
  BEGIN
    IF NEW.user_id IS NULL OR coalesce(NEW.is_golden_run, false) THEN RETURN NULL; END IF;
    v_type := CASE WHEN NEW.status IN ('completed','failed','cancelled') THEN 'run.finished'
                   WHEN NEW.status IN ('paused','cap_paused') THEN 'run.waiting' END;
    IF v_type IS NULL THEN RETURN NULL; END IF;
    IF v_type = 'run.finished' AND OLD.status IN ('completed','failed','cancelled') THEN RETURN NULL; END IF;
    IF EXISTS (SELECT 1 FROM public.webhook_endpoints e
                WHERE e.org_id = NEW.org_id AND e.user_id = NEW.user_id AND e.enabled
                  AND v_type = ANY (e.event_types)) THEN
      INSERT INTO public.webhook_events (type, org_id, item_id, owner_id, status, origin_kind, definition_id)
      VALUES (v_type, NEW.org_id, NEW.id, NEW.user_id, NEW.status, NEW.origin_kind, NEW.definition_id)
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'webhook_emit_run_event swallowed: %', SQLERRM;
  END;
  RETURN NULL;
END $fn$;
CREATE TRIGGER workflow_runs_webhook_emit AFTER UPDATE OF status ON public.workflow_runs
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status
                     AND NEW.status IN ('completed','failed','cancelled','paused','cap_paused'))
  EXECUTE FUNCTION public.webhook_emit_run_event();
-- documents: ONE function, TWO triggers (AFTER INSERT WHEN (NEW.status='completed');
-- AFTER UPDATE OF status WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status='completed')).
-- REVOKE EXECUTE … FROM PUBLIC; FROM anon; FROM authenticated; GRANT … TO service_role.
```
`ON CONFLICT DO NOTHING` with no target works against the partial unique index and avoids a swallowed 23505 WARNING on the (impossible) second terminal write.

### Q11 — Drainer wiring, rate limits, links

- **Lifespan:** copy `main.py:536-552` (start, gated `if not _setup_mode and RUN_BOOT_SWEEPS:`, which keeps test lifespans from draining the shared local outbox, T-300-32) and `:676-683` (stop). The router goes into the `main.py:915` import list and gets an `app.include_router(webhooks.router)` line near `:970`. That makes four hunks (D-50).
- **Drainer constants (discretion; the 300 defaults):** poll 20 s, claim batch 20, lease 600 s (`notification_drainer.py:62-71`). Add `RETRY_SCHEDULE_SECONDS = (0, 30, 300, 1800, 7200, 28800)` (D-17), `MAX_ATTEMPTS = 6`, `AUTO_DISABLE_AFTER = 5`, `PURGE_EVERY_SECONDS = 3600`, `RETENTION_DAYS = 30`. Add jitter of ±10% on retries (spec guidance; discretion).
- **Rate limits:** add `Kind` members `"webhook_test"` and `"webhook_resend"` (`rate_limit.py:28-31`) and a `enforce_user_webhook_limit(redis, *, user_id, kind)` cloned from `enforce_user_citation_limit` (`:122-142`: fixed window, fails **closed** with 503). Constants e.g. `WEBHOOK_TESTS_PER_MINUTE = 5`, `WEBHOOK_RESENDS_PER_MINUTE = 20`. No env var.
- **Links:** `doc_link` / `run_link` (`mcp/results.py:357-364`) depend only on `app.config.primary_frontend_origin()`. **Import them; do not move them** (no third copy, no edit to `results.py`). ⚠ Importing `app.mcp.results` runs `app/mcp/__init__.py`, which loads the whole MCP server graph (measured: about 200 `app.*` modules, no cycle). `outbound_guard` already does this (`outbound_guard.py:44`), so the drainer pays the cost once either way. Import lazily inside the payload builder if a test wants a light import.
- **Org admin dependency:** `require_org_manage` (`app/api/api_keys.py:58-63`); active org via `get_active_org_id` (`dependencies.py:909`).
- **Audit writer:** `write_audit_entry(user_id, action_type, metadata, supabase, org_id=…)` (`audit_service.py:70-100`). It swallows errors; pass `org_id` explicitly. For `auto_disabled` (no human actor), use the endpoint owner as `user_id` with `metadata.actor = "syrel"`.

### Q12 — Hot-file ledger

Measured with `node scripts/check-hot-file-ledger.cjs --files …`. Rows exist unless marked **NO ROW**.

| File | Ledger | Allowed change |
|---|---|---|
| `backend/app/security/egress.py` | **FIRES** (14/6/991) | three dict entries (D-23) |
| `backend/app/main.py` | **FIRES** (100/74) | four hunks (D-50) |
| `backend/app/services/audit_service.py` | **FIRES** (10/10) | nine literals |
| `backend/app/services/rate_limit.py` | **FIRES** (8/5) | two `Kind` members + one function + constants |
| `scripts/full-schema-supplement.sql` | **FIRES** | one 225 block |
| `scripts/build-public-openapi.cjs` | **FIRES** | add tag `webhooks` to a `TAG_GROUPS` group ("Automation" or "Account & org", `:113-133`); decide FLAGGED (UI-internal, the `/notifications` precedent `:87`) |
| `scripts/vitest-count-gate.cjs` | **FIRES** | first pins for new suites |
| `frontend/src/pages/SettingsPage.tsx` | **FIRES** | one trigger + one content + import (UI-SPEC) |
| `frontend/src/components/org/OrgApiKeysTab.tsx` | **FIRES** (3/3/150; the UI-SPEC says "young", which is stale) | one mount after `:96` |
| `frontend/src/components/layout/attentionConditions.ts` | **FIRES ⛔** | one kind arm + optional door |
| `frontend/src/components/layout/ChatLayout.tsx` | **FIRES ⛔** | one memoised callback |
| `frontend/src/components/admin/AuditTab.tsx`, `org/OrgAuditTab.tsx` | **FIRES** | nine labels each |
| `frontend/src/landing/facts.ts` | **FIRES** | `"Webhooks"` appended to `SURFACE_TABS.settings` (`:195`) |
| `backend/app/db/notifications.py` | young (3/2) | `LIST_OPEN_SQL` rewrite |
| `backend/app/api/notifications.py` | young (2/2) | `WaitingNotice` widening |
| `backend/app/services/outbound_guard.py` | young (2/1) | D-41 opt-in kwarg |
| `frontend/src/components/settings/settingsTabs.ts`, `layout/WaitingOnYouList.tsx`, `layout/waitingVocabulary.ts`, `lib/api/notifications.ts` | young | per UI-SPEC |
| `.github/workflows/backend-tests.yml` | row (4/2) | one install line |
| `backend/app/security/principal_liveness.py`, `acting_member.py`, `mcp/results.py`, `db/outbound_policy.py`, `notification_drainer.py` | young, **read-only here** | none |
| **NEW** `backend/app/db/webhooks.py`, `services/webhook_drainer.py`, `services/webhook_signer.py`, `services/webhook_sender.py`, `api/webhooks.py`, `models/webhook.py`, frontend `components/settings/webhooks/*`, `org/OrgWebhooks.tsx`, `lib/api/webhooks.ts` | **NO ROW (gate fails on new files)** | add a "young (created 308-0N)" row + section in the same commit |
| `backend/app/services/ingestion_queue_service.py` | **NO ROW** | do not touch (D-37); the research found no reason to |

### Q13 — Docs and landing gates for a ninth tab and a new router

- `scripts/check-docs-coverage.cjs`: the code keys `settings-tab:webhooks` (slugified literal `<TabsTrigger>` label, `docs-content.cjs:726-735`) and `router:webhooks` (`app.include_router(webhooks.router)`, `:722-723`) each need a page with that key in `covers:`. **A stub counts** (`status: stub`, the `administer/control-room/audit.md` shape). The page must also be listed in `docs/public/sections.json` (`[unlisted-page]` otherwise). The gate passes clean today (121 code keys).
- `scripts/check-landing-drift.cjs:240-252` compares the literal `<TabsTrigger>` labels with `facts.ts` `SURFACE_TABS.settings`, so append `"Webhooks"`. `orgAdmin` is unchanged (a section, not a tab, `:229-235`).
- OpenAPI: the snapshot is regenerated by the builder, and the new tag must sit in a `TAG_GROUPS` group.

### Q14 — The two-worker exactly-once live test

`backend/tests/integration/test_300_drainer_once_live.py`. Guards: `requires_pg` (`tests/integration/_rls_harness.py:39-73`, DSN `postgresql://postgres:postgres@127.0.0.1:54322/postgres`) and a `requires_218`-style applied check (`test_300_notice_triggers_live.py:64-70`). Rows are **committed** (two connections must see them), created with known ids and deleted in `finally`, and every tick is **pinned to the year 2000** so a pinned tick can never claim a real dev row (`:13-16`). The race is `asyncio.gather(a.tick(now=NOW), b.tick(now=NOW))` then `assert len(send.calls) == 1` (`:185-197`). Run with `-rs`, because a silent skip reads as green. It sits outside `tests/unit`, so the 71 baseline never runs it; the verifier must run it explicitly. Copy this for `test_308_drainer_once_live.py`, injecting a counting fake `send` (a `transport=` seam on `send_pinned_http`, or a `send` callable on the drainer).

## Standard Stack

### Core (all already in the app; nothing new at runtime)
| Library | Version (measured) | Purpose | Why |
|---------|---------|---------|-----|
| asyncpg | 0.31.0 | outbox claim/lease, triggers' consumer | the `db/notifications.py` shape |
| httpx (via `egress.send_pinned_http`) | 0.28.1 | the one HTTP send | pinned, redirect-refusing, size-capped |
| cryptography (MultiFernet via `secret_cipher`) | 46.0.7 | secret at rest | D-12 |
| stdlib `hmac`/`hashlib`/`base64`/`secrets` | Py 3.12.6 | the signer | D-11, hand-rolled (about 20 lines) |
| Postgres | 17.6 (local) | triggers, SKIP LOCKED, partial unique | — |

### Supporting (test-only)
| Library | Version | Purpose | When |
|---------|---------|---------|------|
| standardwebhooks | 1.1.0 (PyPI, uploaded 2026-07-21; 0 runtime deps) | interop verifier in one test | `backend/requirements-dev.txt` + CI + local venv |

**Not added:** no Python webhook-sending library (hand-rolled per D-11), and no npm package (the Node snippet is display text; npm `standardwebhooks` 1.1.1 exists under the official repo, for the snippet's `import { Webhook } from "standardwebhooks"`).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| standardwebhooks | PyPI | 1.0.0 2024-01-12; 1.1.0 2026-07-21 | not measured | github.com/standard-webhooks/standard-webhooks (`libraries/python/pyproject.toml` name `standardwebhooks`, `dependencies = []`, [CITED]) | unavailable (install denied by the auto-mode classifier) | **[ASSUMED]**: test-only; planner gates the install behind `checkpoint:human-verify` |

I read the wheel's source myself (from `pip download`, never executed): `webhooks.py` uses only stdlib (`base64`, `hashlib`, `hmac`, `json`, `datetime`), with no network calls and no install hooks (it is a pure wheel). **Packages removed:** none. **Packages flagged [SUS]:** none. slopcheck could not run, so the standing rule applies (checkpoint before install).

## Architecture Patterns

### System Architecture Diagram

```
 status write (any of 8 writers, any origin)           Settings → Webhooks / Test / Resend
   │ workflow_runs UPDATE OF status                      │ (api/webhooks.py, X-Org-Id)
   │ documents INSERT | UPDATE OF status                 │   validate URL (D-46) → egress.validate_destination
   ▼                                                     │   (run_in_threadpool) → encrypt secret → insert
 [trigger, SECURITY DEFINER, swallow-and-warn]           │   Test: build test event+delivery → SEND (same path, sync)
   │ transition + golden/user guards; EXISTS(endpoint)   ▼
   ▼                                                  webhook_endpoints (service-role only)
 webhook_events (1 row; UNIQUE item WHERE run.finished)
   │
   ▼ WebhookDrainer (every worker) — FAN-OUT loop
 claim events WHERE fanned_out_at IS NULL FOR UPDATE SKIP LOCKED
   │ for each subscribed, enabled endpoint (created_at ≤ event) in event.org
   │   run: owner == event.owner │ doc: acting_member_connection(owner, org) SELECT doc → visible?
   │   liveness: principal_still_allowed(kind='webhook') → else skipped_owner_gone + disable(owner_removed)
   │ build payload model → outbound_guard.guard(textless_ok) → freeze bytes on event
   │ INSERT deliveries ON CONFLICT (endpoint_id,event_id) DO NOTHING; stamp fanned_out_at
   ▼
 webhook_deliveries ── SEND loop: reclaim stale 'sending' → claim due FOR UPDATE OF d SKIP LOCKED
   │                    ('sending', attempts+1, claimed_at) in-txn → commit
   │ per row: endpoint still enabled? liveness? visibility (batched acting conn) → skipped_*
   │ renew lease (status='sending' AND attempts=$n) → lost? never send
   │ decrypt secret(s) → sign(id=msg_<event>, ts=now, frozen body) [+ old sig in overlap]
   ▼
 egress.send_pinned_http("webhook", POST, url, content=bytes, allowed_host=host, timeout=10, max_bytes=64K)
   │ re-resolve + re-validate + pin + refuse 3xx  ──► receiver
   ▼
 record: attempt row (code, latency, error word) + delivery status/next_attempt_at
   │ 2xx → sent, endpoint.consecutive_failures = 0, last_success_at
   │ 410 → disable(gone) + notice │ retryable & attempts<6 → retrying @ schedule │ else failed
   │ failed → consecutive_failures+1 RETURNING → ≥5 → UPDATE … WHERE enabled RETURNING (one winner)
   │          → disable(failing), pending→skipped_disabled, notifications(kind=webhook_disabled), audit
   ▼
 GET /notifications (LIST_OPEN_SQL rewrite) → "Waiting on you" row → Settings tab "8"
 Hourly: purge events > 30 days (cascade)
```

### Recommended Project Structure
```
backend/app/
├── api/webhooks.py              # member + admin routes (require_org_manage), test, roll, resend
├── db/webhooks.py               # every *_SQL constant (scanned for body columns), claim/lease/record
├── models/webhook.py            # request/response models + payload models (typed, no text)
├── services/webhook_signer.py   # whsec_ generate/decode, sign(), header builder — pure
├── services/webhook_sender.py   # one send: egress call, timing, outcome classification — pure-ish
└── services/webhook_drainer.py  # fan-out loop, send loop, purge tick, auto-disable, notice
supabase/migrations/225_webhooks.sql
backend/requirements-dev.txt     # standardwebhooks==1.1.0
docs/public/administer/settings/webhooks.md   # stub (D-49)
```

### Pattern: the classification table (the sender's single source of truth)
| Outcome | Retried | Delivery status | Error word |
|---|---|---|---|
| 2xx | — | `sent` | — |
| 408, 429 (honour `Retry-After` ≤ next step), 5xx | yes (attempts < 6) | `retrying` → `failed` | `http_status` |
| `httpx.TimeoutException` | yes | same | `timeout` |
| `httpx.ConnectError` / `NetworkError` | yes | same | `connect` |
| TLS (`ssl.SSLError` inside ConnectError) | yes | same | `tls` |
| `EgressRefused("redirected")` | no | `failed` | `redirect` |
| `EgressRefused(other)` at send (DNS changed) | no | `failed` | `refused_address` |
| `EgressResponseTooLarge` / `Undecodable` | no | `failed` | `response_too_large` |
| 410 | no | `failed` + endpoint off (`gone`) | `gone` |
| other 4xx | no | `failed` | `http_status` |

### Anti-Patterns to Avoid
- **Emitting from app code** (`create_task` after commit): a path gets missed and restarts lose events (PITFALLS `:439`).
- **Holding a row lock across HTTP:** always claim, commit, then send.
- **`httpx.AsyncClient` in a webhook module:** PITFALLS 13's warning sign. `egress.send_pinned_http` is the only door.
- **Re-using the original `webhook-timestamp` on retry or resend:** the receiver's 5-minute window rejects it.
- **Logging the URL:** path and query carry receiver tokens (PITFALLS `:284`, `:457`).
- **A second membership query** in the drainer: use the `principal_still_allowed` adapter.
- **One acting connection per delivery:** batch per (owner, org).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSRF validation, DNS pin, redirect refusal, body cap | a webhook HTTP client | `egress.send_pinned_http` + `validate_destination` | 29-address corpus, unwrap clauses, SNI restore, rebinding fix (`egress.py`) |
| Encryption at rest | AES/Fernet calls | `secret_cipher.encrypt_secret/decrypt_secret` | MultiFernet key rotation, envelope prefix |
| Membership + ban liveness | a SQL join | `principal_still_allowed` (adapter) | one predicate (D-25, PITFALLS `:197-199`) |
| "Can the owner see it" | a service-role query mirroring RLS | `acting_member_connection` | RLS drift is the cross-org leak class |
| Exactly-once claim | Redis locks, a leader | `FOR UPDATE OF d SKIP LOCKED` + the in-transaction flip + lease renew + stale reclaim | the `db/notifications.py` proof |
| Redaction | regexes in the drainer | `outbound_guard.guard` (+ D-41) | one outbound choke point |
| Rate limiting | in-process dict | `rate_limit.hit` (Redis, fails closed) | two workers |
| Verifying our own signer | a second HMAC in the test | `standardwebhooks.Webhook.verify` | interop is the claim |

The signer itself is the **one** deliberate hand-roll (D-11): about 20 lines of stdlib, verified against the official library.

## Common Pitfalls

### Pitfall 1: The guard withholds every webhook in a redaction org
**What goes wrong:** with the switch on, 100% of deliveries end `redaction_failed`. **Why:** `outbound_guard.py:130-133`. **Avoid:** D-41, plus a live test with the switch ON (`test_305_pii_switch_live.py` shape). **Warning sign:** a D-15 test that only runs with the switch off.

### Pitfall 2: A webhook notice invisible in "Waiting on you"
**What goes wrong:** the notice row exists, but the pill and list never show it. **Why:** `LIST_OPEN_SQL` inner-joins `workflow_runs`. **Avoid:** the rewrite in Q3, plus a live test through `GET /notifications` that asserts `total` counts the webhook row.

### Pitfall 3: Stale signature on retries and resends
**What goes wrong:** retries after 5 minutes fail verification. **Avoid:** sign at send time; a test resends a delivery whose first attempt is more than 5 minutes old and verifies it with `standardwebhooks`.

### Pitfall 4: Combined INSERT-OR-UPDATE trigger with `OLD` in WHEN
**What goes wrong:** the migration errors at apply. **Avoid:** two triggers (D-47). Measured.

### Pitfall 5: Boot refuses after merge
**What goes wrong:** the backend will not start (`assert_action_types_synced`) because 225 is not applied. **Avoid:** apply 225 locally before restarting; in cloud, migration first, then deploy (deploy-parity checklist).

### Pitfall 6: Golden runs fire `run.finished`
**What goes wrong:** every publish validation run pings the author's endpoint. **Avoid:** D-42, plus a matrix row "golden run → 0 events".

### Pitfall 7: Userinfo passes egress
**What goes wrong:** `https://u:p@host/` is allowed, and httpx sends Basic auth. **Avoid:** D-46 (route plus send-time check).

### Pitfall 8: Test-only dependency missing in the venv
**What goes wrong:** a collection error, so the baseline gate goes red (0 collection errors is part of the ceiling). **Avoid:** install `requirements-dev.txt` into `backend/venv` in the plan task that adds the test, and add it to CI.

### Pitfall 9: The auto-disable race between two workers
**What goes wrong:** two notices, or two audits. **Avoid:** an atomic `UPDATE … SET consecutive_failures = consecutive_failures + 1 … RETURNING`, then `UPDATE … SET enabled = false … WHERE id = $1 AND enabled RETURNING id`; only the winner writes the notice (also guarded by the partial unique index) and the audit.

### Pitfall 10: Fan-out to an endpoint created after the event
**Avoid:** fan-out filters `endpoint.created_at <= event.created_at`.

### Pitfall 11: The G-4 row 3 timeline is 10.5 h × 5
**What goes wrong:** "disabled after 5" cannot be driven in real time (6 attempts over about 10.5 h per delivery). **Avoid:** drive it with the drainer's `now=` pin or by advancing `next_attempt_at` through SQL in the UAT script; record the method in VALIDATION.

### Pitfall 12: The docs-coverage hook fires mid-edit
**Avoid:** add the stub page in the same task that adds the tab and the router (D-49).

## Code Examples

### Signer (hand-rolled, D-11; verified against the library's algorithm read from source)
```python
# Source: Standard Webhooks spec (msg_id.timestamp.payload, v1,<b64>); standardwebhooks 1.1.0 webhooks.py
import base64, hashlib, hmac, secrets

PREFIX = "whsec_"

def new_secret() -> str:
    return PREFIX + base64.b64encode(secrets.token_bytes(32)).decode()

def _key(secret: str) -> bytes:
    raw = secret[len(PREFIX):] if secret.startswith(PREFIX) else secret
    return base64.b64decode(raw)

def sign(secret: str, msg_id: str, timestamp: int, body: bytes) -> str:
    mac = hmac.new(_key(secret), f"{msg_id}.{timestamp}.".encode() + body, hashlib.sha256).digest()
    return "v1," + base64.b64encode(mac).decode()

def headers(msg_id: str, timestamp: int, body: bytes, current: str, previous: str | None) -> dict:
    sigs = [sign(current, msg_id, timestamp, body)]
    if previous:
        sigs.append(sign(previous, msg_id, timestamp, body))
    return {"webhook-id": msg_id, "webhook-timestamp": str(timestamp),
            "webhook-signature": " ".join(sigs),
            "content-type": "application/json", "user-agent": "Syrel-Webhooks/1"}
```

### Interop test (test-only dependency)
```python
from standardwebhooks import Webhook  # hard import: the proof, never importorskip
def test_our_signature_verifies_with_the_reference_library():
    s = new_secret(); body = b'{"data":{},"type":"webhook.test"}'
    h = headers("msg_x", int(time.time()), body, s, None)
    assert Webhook(s).verify(body, h) == {"data": {}, "type": "webhook.test"}
```

### Send through egress (one call, timing measured around it)
```python
t0 = time.monotonic()
resp = await egress.send_pinned_http(
    "webhook", "POST", url, content=body, headers=hdrs, timeout=10.0, max_bytes=65_536,
    allowed_host=httpx.URL(url).host,
)
latency_ms = int((time.monotonic() - t0) * 1000)
# resp.body and resp.headers are DISCARDED (read Retry-After only); nothing is stored.
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Emit webhooks from app code | Transactional outbox via triggers | no missed writer, no lost event on restart |
| One shared secret, no rotation | Space-delimited multi-signature during overlap (Standard Webhooks) | zero-downtime roll |
| Follow redirects | Refuse 3xx; the endpoint URL is updated by the owner | closes the post-validation SSRF bypass |

Standard Webhooks also defines `v1a` (ed25519), deferred by REQUIREMENTS.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `standardwebhooks` 1.1.0 on PyPI is the official package (slopcheck could not run) | Stack / Audit | Low: the source was read and is stdlib-only; it is test-only. Gate the install behind a checkpoint |
| A2 | On Linux prod, the decimal/hex IP spellings resolve and refuse as `address_not_public` (measured `unresolvable` on Windows) | Q6 | None for safety (both refuse); the corpus asserts "refused" |
| A3 | Most receivers tolerate a `Host` header without the port on non-443 ports | Q6 | A receiver on a custom port could 400; the owner sees it in the log |
| A4 | npm `standardwebhooks` exposes `Webhook#verify(payload, headers)` for the Node snippet | Q7 | Snippet text wrong; verify against the official JS README when writing `webhookSnippets.ts` |
| A5 | 64 KiB is enough of a response cap for real receivers | Pitfalls | A receiver with a big 2xx body logs `response_too_large` and is not retried |

## Open Questions

1. **Admin sees host + path, and the path can carry the receiver's token** (Zapier `hooks.zapier.com/hooks/catch/<id>/<token>/`, Slack `hooks.slack.com/services/T…/B…/<token>`; PITFALLS `:284`).
   - Known: D-30 hides only the query.
   - Unclear: whether showing the path to an org admin is acceptable.
   - Recommendation: the admin view and the audit metadata show **host only**, plus the owner's description. If the path stays, mask any path segment of 16 or more characters. Record as D-NN in the planner, the UI-SPEC amendment it needs is one cell.
2. **Is `webhook` a FLAGGED (UI-internal) OpenAPI tag or public?** Recommendation: FLAGGED, like `/notifications`. These routes serve Syrel's own screen, and a public contract is Phase 309's call.
3. **Is `SECRETS_ENCRYPTION_KEY` set locally?** Reading `backend/.env` is denied here. The plan must prove it with `venv/Scripts/python -c "from app.security.secret_cipher import get_cipher; print(get_cipher() is not None)"` before the G-4 rows. With no key, endpoint creation is refused by design (D-12).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Postgres (Supabase) :54322 | migration, live tests | ✓ | 17.6 | — |
| Redis :6379 | rate-limit buckets | ✓ (port open) | — | limiter fails closed (503) |
| Python venv | backend | ✓ | 3.12.6 | — |
| Node | gates, vitest | ✓ | 24.19.0 | — |
| `standardwebhooks` in venv | interop test | ✗ (not installed) | — | install in plan 2 (checkpoint) |
| `SECRETS_ENCRYPTION_KEY` | endpoint create | unknown (`.env` read denied) | — | none: create is refused by design; operator sets the key |
| Public https receiver | G-4 rows 1-3 | not checked | — | the transport seam for automated tests; G-4 needs a real receiver |
| slopcheck | package audit | ✗ (install denied) | — | `[ASSUMED]` + checkpoint |

## Validation Architecture

> `.planning/config.json` has `nyquist_validation: false`; this section is included because the orchestrator asked for it.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9 + pytest-asyncio (backend); vitest (frontend) |
| Config file | `backend/pytest.ini`; `frontend/vitest.config.*` |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/unit/test_308_*.py -q` |
| Live (DB-mutating) | `cd backend && venv/Scripts/python -m pytest tests/integration/test_308_*_live.py -q -rs` (under the local-DB lock) |
| Full suite command | `node scripts/check-backend-unit-baseline.cjs` (71 ceiling); `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`; `npx tsc -p tsconfig.app.json --noEmit` (set diff vs base) |

### Phase Requirements → Test Map
| Req ID | Behavior | Type | Automated Command | File Exists? |
|--------|----------|------|-------------------|-------------|
| HOOK-01 | create/validate (https, ≤2048, no userinfo/fragment, ≥1 event, ≤100 desc, cap 10), refusal sentence, test route sync + recorded | unit | `pytest tests/unit/test_308_routes.py -q` | ❌ Wave 0 |
| HOOK-01 | Settings tab / form / test verdict / copy fence | vitest | `npx vitest run src/components/settings/webhooks` | ❌ |
| HOOK-02 | signer vector + **interop with `standardwebhooks`**, overlap: both sigs verify with old and new, second roll ends overlap | unit | `pytest tests/unit/test_308_signer.py -q` | ❌ |
| HOOK-02 | secret at rest is `enc:v1:` (CHECK + live read), never in any response | unit + live | `pytest tests/integration/test_308_db_live.py -rs` | ❌ |
| HOOK-02 | payload type fence (no text field), guarded bytes == unguarded bytes with switch on; walker raise → `redaction_failed` | unit | `pytest tests/unit/test_308_payload.py -q` | ❌ |
| HOOK-03 | **emission matrix**: app/schedule/key/mcp × completed/failed/cancelled via `finish_run`, `_claim_terminal`, `runs.py:660`, `run_reconciler` → 1 event; same-value re-write → 0; golden → 0; paused → 1 `run.waiting`; upload/watch/mail splice update, `ingest_document` update, `ingestion_jobs` bulk sweep → 1 each; dedup → 0; re-ingest → +1; no subscriber → 0; trigger error swallowed (finalization still commits) | live | `pytest tests/integration/test_308_emission_matrix_live.py -rs` | ❌ |
| HOOK-03 | two drainers, one event → one send per endpoint; `webhook-id` identical across retry and resend | live | `pytest tests/integration/test_308_drainer_once_live.py -rs` | ❌ |
| HOOK-04 | classification table, schedule constants, `Retry-After` cap, 410 → gone, auto-disable at 5 (one winner), pending → `skipped_disabled`, resend rules + rate limit | unit | `pytest tests/unit/test_308_drainer.py -q` | ❌ |
| HOOK-04 | **no body column**: scan every `*_SQL` in `db/webhooks.py` and the 225 DDL for `body`/`response`/`headers` columns | unit | `pytest tests/unit/test_308_no_body_scan.py -q` | ❌ |
| HOOK-04 | notice: appears in `GET /notifications` (`total` counts it), email drainer sends nothing for it, closes on enable, cascades on delete; 301 readers tolerate null `run_id` | live + vitest | `pytest tests/integration/test_308_notice_live.py -rs`; `npx vitest run src/components/layout` | ❌ |
| HOOK-05 | SSRF corpus at save (route) and at send (resolver + transport seams): every D-24 entry + DNS change between save and send + 302-to-internal | unit | `pytest tests/unit/test_308_ssrf_corpus.py -q` | ❌ |
| HOOK-05 | owner removed → `skipped_owner_gone` + disabled; item not visible (doc moved org / other member's private doc) → `skipped_not_visible`, no delivery row at doc fan-out | live | `pytest tests/integration/test_308_visibility_live.py -rs` | ❌ |
| HOOK-06 | admin list (no query), admin disable → member cannot re-enable, admin delete; non-admin 403 | unit + vitest | `pytest tests/unit/test_308_admin_routes.py -q` | ❌ |
| D-32 | anon gets nothing on any 225 table or function; authenticated reads nothing; EXECUTE revoked from PUBLIC | live | `pytest tests/integration/test_308_rls_anon_live.py -rs` (the `test_300_rls_anon_live.py` / `test_307_schema_privileges_live.py` shape) | ❌ |
| D-31 | 225 CHECK = 217's 40 + 9 (scanned, not retyped); `VALID_ACTION_TYPES` lockstep | unit | `pytest tests/unit/test_308_migration_225_static.py -q` | ❌ |
| D-23 | `webhook` wired in all three egress tables, `_CALLER`, https | unit | `pytest tests/unit/test_308_egress_capability.py -q` | ❌ |

**DB-mutating suites (serialize, worktree rule 4, local-DB lock):** every `tests/integration/test_308_*_live.py`. Plans 1 and 3 own them; plan 4's admin routes stay on stubbed units.

### Sampling Rate
- **Per task commit:** the task's `test_308_*` unit file(s) only.
- **Per wave merge:** backend baseline gate + vitest count gate + `tsc -p tsconfig.app.json` set diff; the wave's live files with `-rs`.
- **Phase gate:** all of the above + `check-hot-file-ledger.cjs 308` + `check-docs-coverage.cjs` + `check-landing-drift.cjs` + `check-claude-md-size.cjs`.

### Wave 0 Gaps
- [ ] `backend/requirements-dev.txt` + venv install + CI line (standardwebhooks, behind a checkpoint)
- [ ] The test files in the table above (all new)
- [ ] `vitest-count-gate.cjs` first pins for every new frontend suite

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (routes) | `get_current_user` (JWT) |
| V3 Session Management | no | — |
| V4 Access Control | yes | explicit owner check on every member route (`user_id` + active org); `require_org_manage` for admin; admin-off re-enable is admin-only; acting-connection RLS for item visibility |
| V5 Input Validation | yes | Pydantic models: URL rules (D-27/D-46), description ≤ 100 rendered as text, event-type enum |
| V6 Cryptography | yes | `secret_cipher` (MultiFernet); HMAC-SHA256 via stdlib `hmac`; `secrets.token_bytes(32)`; `hmac.compare_digest` in tests |
| V9/V10 Communications / SSRF | yes | `egress.py` `webhook` capability: https, pinned, redirects refused, re-validated per send |
| V7 Logging | yes | ids + outcome words only; never URL, secret, body |

### Known Threat Patterns (for the planner's threat_model blocks)

| ID | Pattern | STRIDE | Mitigation |
|----|---------|--------|------------|
| T-308-01 | SSRF to internal / metadata addresses at save | Tampering / Info disclosure | `validate_destination("webhook", …)` in threadpool; D-24 corpus |
| T-308-02 | DNS rebinding between save and send | Tampering | `send_pinned_http` re-resolves, re-validates, pins IP; test: resolver seam flips public → private |
| T-308-03 | 302 redirect to internal host | Tampering | `follow_redirects=False` + `redirected` refusal (`egress.py:826`) |
| T-308-04 | Userinfo smuggling / Basic auth leak | Info disclosure | D-46 refusal at save + send |
| T-308-05 | Forged or replayed deliveries at the receiver | Spoofing | Standard Webhooks HMAC, per-attempt timestamp, stable `webhook-id` for dedupe; interop test |
| T-308-06 | Secret at rest in plaintext / leaked by API | Info disclosure | `enc:v1:` CHECK; no authenticated grant; show-once; responses never carry ciphertext; fail closed without a cipher |
| T-308-07 | Old secret lives forever after roll | Elevation | 24 h expiry; erase ciphertext after the window (drainer or roll route) |
| T-308-08 | Cross-org leak: an event for an item the owner cannot see | Info disclosure | doc fan-out visibility via the acting connection (no delivery row created); send-time re-check; org-scoped recipient rules (D-03/D-04) |
| T-308-09 | Ex-member keeps receiving | Elevation | `principal_still_allowed` adapter at fan-out and send → `owner_removed` |
| T-308-10 | anon / another member reads endpoints, deliveries, secrets | Info disclosure | RLS on, no policy, revoke from PUBLIC first; anon live test; `get_advisors(security)` after the cloud paste (owed) |
| T-308-11 | SECURITY DEFINER trigger callable by clients | Elevation | `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` (the PUBLIC trap); verify in the live privileges test |
| T-308-12 | Trigger error breaks run finalization / ingestion | DoS | swallow-and-warn subtransaction (D-06); matrix test plants a failure (e.g. a temporarily broken endpoint row) and asserts the status write commits |
| T-308-13 | Response body / headers stored or logged (SSRF read oracle) | Info disclosure | discard `PinnedResponse.body/headers`; no-body scan test; log ids only |
| T-308-14 | Payload carries content / PII | Info disclosure | typed text-free payload models + guard (D-41) |
| T-308-15 | Receiver-token exposure to admins via path / query | Info disclosure | query hidden (D-30); Open Question 1 (host only / mask path) |
| T-308-16 | Abuse of Test / Resend to hammer a third party | DoS | per-member Redis buckets, fail closed; cap 10 endpoints |
| T-308-17 | Duplicate sends across two workers | Tampering (integrity) | SKIP LOCKED + in-transaction flip + lease renew + `UNIQUE (endpoint_id, event_id)`; two-drainer live test |
| T-308-18 | Audit row leaks query / secret | Info disclosure | metadata = actor, endpoint id, host only (D-31) |
| T-308-19 | Event storm from bulk sweep / mass watch import | DoS | EXISTS gate (no subscriber, no row); bounded claim batch; auto-disable on failure |

## Sources

### Primary (HIGH confidence)
- Codebase, read at file:line: `supabase/migrations/218_run_waiting_notifications.sql`, `217_org_item_move_audit.sql`, `063_dual_mode_continue.sql`; `backend/app/db/notifications.py`, `db/workflows.py`, `db/ingestion_jobs.py`, `db/retention.py`, `db/outbound_policy.py`, `db/api_keys.py`; `backend/app/services/notification_drainer.py`, `outbound_guard.py`, `audit_service.py`, `rate_limit.py`, `ingest_splice.py`, `email_attachments.py`, `harness/run_handoff.py`; `backend/app/security/egress.py`, `principal_liveness.py`, `acting_member.py`, `secret_cipher.py`; `backend/app/api/notifications.py`, `api/runs.py`, `api/documents.py`, `api/api_keys.py`; `backend/app/mcp/results.py`; `backend/app/main.py`; `backend/app/dependencies.py`; `supabase/full-schema.sql` (RLS policies, `current_user_org_ids`); `scripts/check-docs-coverage.cjs`, `scripts/lib/docs-content.cjs`, `scripts/check-landing-drift.cjs`, `scripts/build-public-openapi.cjs`, `scripts/full-schema-supplement.sql`, `scripts/check-hot-file-ledger.cjs`; `backend/tests/unit/test_190_egress.py`, `tests/integration/test_300_drainer_once_live.py`.
- Measured: local DB (`user_id IS NULL` = 0; statuses; 73 golden; PG 17.6); PG trigger WHEN restriction (rolled-back temp table); egress SSRF spellings; `standardwebhooks` 1.1.0 wheel source + METADATA.
- Standard Webhooks spec — https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
- Official Python lib manifest — https://raw.githubusercontent.com/standard-webhooks/standard-webhooks/main/libraries/python/pyproject.toml

### Secondary (MEDIUM confidence)
- PyPI JSON for `standardwebhooks` (release dates); `npm view standardwebhooks` (1.1.1, official repo URL).
- `.planning/research/PITFALLS.md` (milestone research, webhook pitfalls 13-15).

### Tertiary (LOW confidence)
- None relied upon.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new runtime dependency; the test-only lib's source was read.
- Architecture: HIGH. A direct copy of the shipped 218/300 outbox; every seam was read.
- Pitfalls: HIGH. Four were measured (PG trigger rule, userinfo, SSRF spellings, golden rows) and the rest were read in code.

**Research date:** 2026-11-04
**Valid until:** 2026-12-04 (stable internal seams; re-check if `egress.py`, `outbound_guard.py` or `db/notifications.py` change first)

## RESEARCH COMPLETE
