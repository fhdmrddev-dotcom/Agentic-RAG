# Phase 308: Told by Webhook - Context

**Gathered:** 2026-11-04 (auto mode — operator: "continue autonomously end to end")
**Status:** Ready for planning (G-2 sketch first — see D-35)

<domain>
## Phase Boundary

A member adds an **https webhook endpoint** in Settings, picks events (**run finished**, **run waiting
on a person**, **document ingested**), sends a **test event**, and from then on their own systems get a
**signed, thin** event (Standard Webhooks) — ids, status and a link, never content — **exactly once per
endpoint**, retried with backoff, logged (status and latency, never a response body), resendable, and
**never sent to an internal address or about an item the owner can no longer see**. An endpoint that
keeps failing is turned off and its owner told in-app. An org admin lists, disables and deletes the
org's endpoints (HOOK-01..06).

Delivered: migration **225** (endpoints, events, deliveries, attempts; swallow-and-warn triggers on
`workflow_runs` and `documents` status; the in-app notice kind; audit literals), one closed `webhook`
capability in `egress.py`, a hand-rolled Standard Webhooks signer with encrypted secrets and overlap
rotation, a `WebhookDrainer` in every worker, member routes + admin routes, a Settings "Webhooks" tab
and an org-admin "Webhooks" section.

**Not in this phase:** org-owned endpoints, replay-since-date, ed25519, a failed-ingest event, an
operator or org kill switch for webhooks, public docs (309), the cloud migration paste and deploy
(operator-gated).

</domain>

<decisions>
## Implementation Decisions

### Event catalogue and who receives what (HOOK-01; intake Q6 / Q17 carried forward)
- **D-01:** Three subscribable types plus a test type:
  - `run.finished` — a `workflow_runs` row **enters** `completed`, `failed` or `cancelled` from a non-terminal status (`data.status` says which).
  - `run.waiting` — a `workflow_runs` row **enters** `paused` or `cap_paused` from a different status (both need a person in the app; Q17).
  - `document.ingested` — a `documents` row **enters** `completed` from a non-`completed` status, ~~**or is inserted already `completed`** (`ingest_splice.py` inserts completed rows).~~ *(refuted by research — see D-47)* A re-ingest that goes `processing → completed` is a new event by design.
  - `webhook.test` — sent only by the Test button; never subscribable.
- **D-02:** "Run" means **workflow runs** only. Chat turns (the `runs` table, including MCP `ask_agent` threads) are not runs here. SC#2's origins (in-app, scheduled, API key, MCP) are exactly `workflow_runs.origin_kind` (`app` / `schedule` / `key` / `mcp`).
- **D-03:** Recipients:
  - Run events → subscribed, enabled endpoints **owned by the run's `user_id` in the run's `org_id`** ("your runs"). A run with no `user_id` emits nothing (research confirms which origins can leave it null).
  - `document.ingested` → every subscribed, enabled endpoint **in the document's `org_id` whose owner can see the document** (D-23 decides, at fan-out). A delivery row is never created for an item the owner cannot see, so the log can never reveal one.
- **D-04:** Endpoints are **member-owned** (Q6): `user_id` + `org_id` (the active org at creation, via `X-Org-Id`). An endpoint never receives events from another org.

### Emission and exactly-once (HOOK-03)
- **D-05:** **Emission is from database triggers, never application code** (document completion has 4+ writers). `AFTER INSERT OR UPDATE OF status` on `workflow_runs` and `documents`; transition-guarded (`OLD.status IS DISTINCT FROM NEW.status` plus the D-01 sets). Each trigger writes **one** `webhook_events` row and nothing else — no fan-out, no HTTP. It skips the insert when no enabled endpoint in that org subscribes to that type (one cheap `EXISTS`).
- **D-06:** **Swallow-and-warn** exactly like migration 218: the body sits in `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING … END`, so a trigger error never breaks run finalization or ingestion. `SECURITY DEFINER`, `SET search_path = ''`, `EXECUTE` **revoked from `PUBLIC`** (then anon, authenticated) — CLAUDE.md's PUBLIC-grant trap.
- **D-07:** Exactly-once is structural, in three places: (1) one event per status transition, written inside the row's own transaction; a partial `UNIQUE (type, item_id)` for `run.finished` so a terminal run can never emit twice; (2) fan-out inserts deliveries with `UNIQUE (endpoint_id, event_id)` and `ON CONFLICT DO NOTHING`; (3) deliveries are claimed `FOR UPDATE OF d SKIP LOCKED` with the `'sending'` flip, attempt count and lease stamp **inside the claiming transaction**, and the HTTP send happens **outside** it (the `db/notifications.py` shape, including lease renew before send and stale-`sending` reclaim). Redis is not the record; it is not needed at all.
- **D-08:** Proof is two driven tests, not reasoning: (a) a **two-drainer live test** on the local DB (the `tests/integration/test_300_drainer_once_live.py` shape) showing one send per (endpoint, event); (b) an **emission matrix**: every run-finishing path (origins app / schedule / key / mcp × completed / failed / cancelled) and every ingest-completing path (upload, watched source, mail, re-ingest, dedup insert) produces exactly one event. Research enumerates the writers by grep; the matrix is the evidence.
- **D-09:** **`webhook-id` = `msg_` + the event id** — identical across retries and resends to that endpoint. A test event gets its own event id.
- **D-10:** `WebhookDrainer` runs in **every** worker (the `NotificationDrainer` / `SchedulerService` shape, no leader), started by **one lifespan block** in `backend/app/main.py` (G-5). Two loops in it: fan-out (claim undelivered events → create deliveries) and send (claim due deliveries → send → record). Maintenance mode does not stop deliveries.

### Signing, secrets and payloads (HOOK-02)
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

### Retries, delivery log, resend, auto-disable (HOOK-04)
- **D-17:** Schedule: attempt 1 at once, then +30 s, +5 min, +30 min, +2 h, +8 h (6 attempts, about 10.5 h), then `failed`. Retried: network error, timeout, 408, 429 (`Retry-After` honoured up to the next step's cap), 5xx. Not retried: other 4xx and any 3xx (redirects are refused, D-20). **410 Gone disables the endpoint at once** (reason `gone`). Constants in code beside the drainer (the 300 `RETRY_BACKOFF_SECONDS` precedent).
- **D-18:** **Auto-disable:** each endpoint keeps a `consecutive_failures` count of deliveries that ended `failed`; any 2xx resets it; at **5** the endpoint is disabled with reason `failing`, its pending deliveries become `skipped_disabled`, and the owner gets an in-app notice (D-19).
- **D-19:** **In-app notice through the one existing home** — Phase 300/301's `notifications` and the "Waiting on you" list: a new kind `webhook_disabled` with an `endpoint_id`, `run_id` made nullable under a CHECK (question / approval → `run_id` required; webhook_disabled → `endpoint_id` required). The row opens the Webhooks tab and closes when the owner re-enables or deletes the endpoint. **The 300 email drainer must never email it** (its deliveries are created only by `notify_on_ask_row`; research verifies every 300/301 reader tolerates a null `run_id` and a test pins it). If research finds this unsafe, the alternative is a new `D-NN`, never silent.
- **D-20 (log):** Per endpoint, newest first, paged: event type, item link, status (`pending` / `retrying` / `sent` / `failed` / `skipped_*`), attempts, last HTTP status code, last latency (ms), times. A separate attempts table records status code, latency and an error word per attempt. **No column holds a response body, response headers or the request body**; a scan test over every SQL constant enforces it (the `test_300_notification_drainer.py` scan).
- **D-21:** **Resend** a `sent` or `failed` delivery → back to `pending` with a fresh schedule, **same `webhook-id`**. Not on a disabled endpoint. Rate-limited per member (a `rate_limit.py` bucket).
- **D-22:** *(superseded by D-44)* ~~Retention: events, deliveries and attempts older than **30 days** are purged by the existing retention sweeper (`backend/app/db/retention.py`) if it fits cleanly; otherwise plant a seed with a trigger. Research decides which.~~

### Visibility re-check and SSRF refusal (HOOK-05)
- **D-23:** **One new closed capability `webhook` in `egress.py`**: https only, `_CALLER` host match (the endpoint's own host passed as `allowed_host` — the `send_email` / `client_metadata` arm), public addresses only, DNS-pinned, redirects refused. Validated **at save** (`validate_destination`, off the event loop) and **at every send** (`send_pinned_http` re-resolves and re-validates, so a DNS change is caught). No delivery bypasses `egress.py`. ~~`test_190` is amended on purpose (P-1), as 307 did.~~ *(not needed — see D-45)*
- **D-24:** An **SSRF refusal corpus**, driven at save and at send: `http://`, `localhost`, `127.0.0.1`, `[::1]`, 10/8, 172.16/12, 192.168/16, 100.64/10, `169.254.169.254`, `metadata.google.internal`, IPv4-mapped IPv6, decimal / octal / hex IP spellings, userinfo in the URL, a public name resolving to a private address (resolver seam), a 302 to an internal host (transport seam). The save refusal is one plain sentence: *"That address can't be reached from the internet, so Syrel won't send to it."* No dev bypass — local testing uses a public receiver or the seams.
- **D-25:** **Owner liveness** at fan-out and at send through the **one** liveness predicate (`backend/app/security/principal_liveness.py`; an adapter or its pure core — a second predicate fails review): owner still a member of the endpoint's org, not banned. Failure → delivery `skipped_owner_gone` and the endpoint disabled with reason `owner_removed` (no notice to a removed person).
- **D-26:** **Item visibility at send** (and at document fan-out, D-03) through `acting_member_connection(user_id=owner, org_id=endpoint.org_id)` (`backend/app/security/acting_member.py`): `SELECT 1` on the run or document under the same RLS the app uses. Not visible → `skipped_not_visible`, nothing sent. No service-role re-implementation of visibility.

### Endpoint model and the member screen (HOOK-01; G-2 / G-4)
- **D-27:** Endpoint fields: `url`, optional `description` (≤ 100 chars, untrusted text, never rendered as HTML), event types (≥ 1 required), `enabled`, `disabled_reason` (`failing` / `gone` / `admin` / `owner_removed`), times, last success. URL: https, ≤ 2048 chars, no userinfo, no fragment, query allowed. **Cap 10 endpoints per member per org.**
- **D-28:** The member screen is a **new Settings tab "Webhooks"** — one `TabsTrigger` + one `TabsContent` on `SettingsPage.tsx` (G-5 "one mount"); everything else lives in a new `frontend/src/components/settings/webhooks/` folder: endpoint list, add/edit form (URL, event checkboxes, description), secret-once panel with a short verify snippet (Python and Node, `standardwebhooks`), **Send test**, **Roll secret** (confirm sheet naming the 24 h overlap), Disable / Enable, **Delete** (victim-naming confirm), delivery log with **Resend**. Words live in a copy module (the `apiKeysCopy.ts` pattern). Available to every member; no tier gate.
- **D-29:** **Test is synchronous**: same signer and same egress path, recorded in the log as a `webhook.test` delivery, not retried, rate-limited; the UI shows status code, latency and a plain verdict sentence.

### Org admin (HOOK-06)
- **D-30:** An org-admin **"Webhooks" section mounted once inside `OrgApiKeysTab.tsx`** (the 307 `OrgConnectedApps` precedent; no new tab on the FIRING `OrgAdminShell.tsx`). Lists every endpoint in the org: owner, host + path (**query hidden** — it may hold a receiver token), events, status, last success, failure count. Actions: **Disable** (reason `admin`) and **Delete** (victim-naming confirm). An admin-disabled endpoint shows the owner "Turned off by an org admin" and **only an admin can re-enable it**.
- **D-31:** **Audit lockstep (293):** `webhook.endpoint.created / updated / deleted / enabled / disabled / secret_rolled / test_sent / delivery_resent / auto_disabled` — actor, endpoint id and host only (never a query string or a secret). The migration CHECK and `backend/app/services/audit_service.py`'s literal list change in the **same commit**; the org audit tab and the operator audit tab get labels.

### Data, security and deploy
- **D-32:** **Migration `225_webhooks.sql`** (next free number; 224 is 307's). RLS **on** for every new table; **anon gets nothing**; `authenticated` never reads another member's rows and **never the secret ciphertext** (the simplest shape: no authenticated grant at all, every read through the backend with explicit owner / admin checks, as `notification_deliveries`). An **anon-role test** (nothing in the suite requests as `anon`); `get_advisors(security)` against local after apply. Applied locally via the SQL editor, then `bash scripts/regenerate-full-schema.sh` (no reset); `scripts/full-schema-supplement.sql` if grants need it.
- **D-33:** Cloud: 225 is pasted after 220 → 224, **per-action operator approval**, then `get_advisors(security)` — recorded as **owed**, never done by this phase.
- **D-34:** No new env var is expected. If one appears, deploy-artifact parity in the same commit (`deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml`, `scripts/check-deploy-drift.sh`).

### Process and guardrails
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

### Added after research (2026-11-04, orchestrator, auto mode) — `308-RESEARCH.md` evidence
Research refuted three sentences above; the originals stand and these decisions override them.
- **D-41 (overrides D-15's mechanics):** payloads are **typed Pydantic models** (envelope + one `data` model per type, typed non-text fields). `outbound_guard.guard()` gains ONE keyword-only opt-in `textless_ok: bool = False`; when True and the model's tree declares no `RedactableText`, the model comes back unchanged instead of `WITHHELD`. MCP never passes it (305 behaviour byte-identical, pinned). Webhooks pass `textless_ok=True`. Test: with the org switch ON the frozen bytes equal the switch-OFF bytes; a guard raise → `redaction_failed`. *(Why: the shipped guard withholds every text-free model and every dict, `outbound_guard.py:128-133, 178-182` — D-15 as written would block 100 % of deliveries.)*
- **D-42:** golden runs (`is_golden_run = true`) emit nothing (218 precedent; matrix row "golden run → 0 events").
- **D-43:** `run.waiting` keeps `cap_paused` in the trigger set for forward compatibility; nothing writes `cap_paused` to `workflow_runs` today, so the matrix drives `paused` only and a test pins the set.
- **D-44 (overrides D-22):** retention is an **hourly purge tick in `WebhookDrainer`** — bounded-batch `DELETE` of events older than 30 days, deliveries and attempts cascading; idempotent across workers. `db/retention.py` is not used (it is the off-by-default document-policy sweep). No seed.
- **D-45 (overrides D-23's last sentence):** `test_190` is **not** amended (it already admits an empty-tuple `_CALLER` key since 307); a 308 pin test asserts `webhook` is in all three egress tables.
- **D-46:** URL rules (https, no userinfo, no fragment, ≤ 2048) are enforced in the route/model validator **and** re-asserted by the sender before every send. *(Measured: egress allows `https://user:pw@host/`, and httpx would send Basic auth.)*
- **D-47 (overrides D-01's "inserted already completed" and D-05's single trigger):** `document.ingested` uses **two triggers on one function** — `AFTER INSERT … WHEN (NEW.status = 'completed')` (defence only; no writer inserts completed today) and `AFTER UPDATE OF status … WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')`. The `workflow_runs` trigger is UPDATE-only (runs are always inserted `active`). *(Measured: Postgres rejects `OLD` in the WHEN of an INSERT-including trigger.)*
- **D-48 (extends D-19):** the `webhook_disabled` notice is written for `failing` **and** `gone`; not for `admin` or `owner_removed`. `LIST_OPEN_SQL` in `db/notifications.py` becomes LEFT JOINs with a kind-aware WHERE (the inner join on `workflow_runs` would drop the row); `WaitingNotice` model + frontend type, kind / `closed_reason` CHECKs, a shape CHECK, and a partial unique index per open endpoint notice all change in the same plan.
- **D-49:** plans adding the router and the Settings tab add a **stub** public docs page `docs/public/administer/settings/webhooks.md` (`status: stub`, `covers: [settings-tab:webhooks, router:webhooks]`) and its `docs/public/sections.json` entry, so `check-docs-coverage.cjs` stays green; Phase 309 writes the content. `frontend/src/landing/facts.ts` gets "Webhooks" in `SURFACE_TABS.settings` (data only).
- **D-50 (refines D-10 / D-37):** `main.py` takes **four** small hunks — router import, `include_router(webhooks.router)`, lifespan start block (gated like 300's: `if not _setup_mode and RUN_BOOT_SWEEPS:`), lifespan stop block.
- **D-51 (answers research open Q1; refines D-30):** the admin list shows **host and path with any path segment of 16+ characters masked** (`…`), query never sent — Zapier / Slack-style hook URLs carry their token in the path. The member's own card shows the full URL.
- **D-52 (Q2):** the `webhooks` OpenAPI tag is **UI-internal** (FLAGGED like `/notifications` in `scripts/build-public-openapi.cjs`), not part of the public API surface.
- **D-53 (Q3; refines D-12):** the plan that adds endpoint creation runs a one-line `get_cipher()` probe against the local backend env and records the result; if no cipher is configured locally, the executor stops and records it as an operator action — never stores a plaintext secret and never adds a fallback.
- **D-54:** `standardwebhooks==1.1.0` goes into a new `backend/requirements-dev.txt` (zero runtime deps, never the prod image), installed into the local venv and CI **in the same plan as its test**, so the interop test can never become a collection error against the baseline 71. The install is a recorded step (package-legitimacy check unavailable — slopcheck blocked).
- **Also from research (no decision change):** every new non-test source file (`db/webhooks.py`, `services/webhook_drainer.py`, …) needs a hot-file ledger row + section in the commit that creates it (the gate fails on new files); `OrgApiKeysTab.tsx` now FIRES (3 / 3) — honoured by construction with one mount. Audit literals: 225 restates mig 217's 40 action types + the 9 new ones; boot refuses until 225 is applied, so in cloud 225 is pasted **before** the deploy. Signing timestamp and signature are computed per attempt (5-min tolerance); only the body bytes are frozen. `send_pinned_http` returns no timing (measure around it) and raises on an oversized / undecodable 2xx body → classify `failed`, not retried, 64 KiB cap. Liveness adapter: `principal_still_allowed(pool, key_row={"org_id", "user_id", "kind": "webhook"})`. Visibility: one acting-member connection per (owner, org) group per drain pass.

### Claude's Discretion
- Drainer poll intervals, batch size, lease length (the 300 values are the default).
- Table and column names, index shapes, the exact error-word vocabulary.
- Whether the attempts table is a child table or a JSON column (no body either way).
- UI layout details, settled by the sketch and UI-SPEC.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` § "Phase 308: Told by Webhook" — goal, 5 success criteria, failure list, flags
- `.planning/REQUIREMENTS.md` — HOOK-01..06; Out of Scope (full-content payloads); Future (org-owned endpoints, replay, ed25519)
- `.planning/research/SUMMARY.md` — webhook stack line, Q6 (member-owned), Q17 (`run.waiting`), pitfalls list
- `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md` — webhook sections

### The outbox pattern to copy (Phase 300 / 301)
- `supabase/migrations/218_run_waiting_notifications.sql` — swallow-and-warn triggers, REVOKE-from-PUBLIC, `notifications` table
- `backend/app/db/notifications.py` — SKIP LOCKED claim, lease, renew, stale reclaim
- `backend/app/services/notification_drainer.py` — per-worker drainer shape
- `backend/tests/integration/test_300_drainer_once_live.py` — the exactly-once live test shape
- `backend/app/api/notifications.py`, `frontend/src/components/layout/WaitingOnYouList.tsx`, `frontend/src/components/layout/waitingVocabulary.ts` — the in-app notice home (D-19)

### Security seams to reuse
- `backend/app/security/egress.py` — `validate_destination`, `send_pinned_http`, the capability dicts, the `_CALLER` arm
- `backend/app/security/secret_cipher.py` — `encrypt_secret` / `decrypt_secret`
- `backend/app/security/principal_liveness.py` — the one liveness predicate
- `backend/app/security/acting_member.py` — `acting_member_connection`
- `backend/app/services/outbound_guard.py`, `backend/app/services/pii_redactor.py` — redaction (305)
- `backend/app/mcp/results.py` — `doc_link`, `run_link`
- `backend/app/services/audit_service.py` — audit literal lockstep (293)
- `backend/app/services/rate_limit.py` — buckets

### UI precedents
- `frontend/src/components/settings/apiKeys/` — tab, secret-once panel, copy module, revoke sheet (304/307)
- `frontend/src/components/org/OrgApiKeysTab.tsx`, `frontend/src/components/org/OrgConnectedApps.tsx` — the admin-section mount (307)
- `frontend/src/pages/SettingsPage.tsx` — tab registry (one mount)
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — Control Room confirm-sheet / receipt vocabulary, graded action guards

### Project rules
- `CLAUDE.md` — migrations via SQL editor, PUBLIC-grant trap, G-2/G-4/G-5/G-8, worktree rules, deploy parity, baseline 71
- `docs/HOT-FILE-LEDGER.md` — sections for `egress.py`, `main.py`, `SettingsPage.tsx`, `OrgApiKeysTab.tsx`, `audit_service.py`
- `.planning/phases/307-sign-in-from-claude-ai-and-claude-desktop/307-CONTEXT.md` — the immediately prior decisions (egress capability precedent, admin-section mount)

### External
- Standard Webhooks specification (standardwebhooks.com, github.com/standard-webhooks) — headers, signature, secret format, multi-signature rotation
- `standardwebhooks` 1.1.0 on PyPI — test-only interop verifier

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `db/notifications.py` + `notification_drainer.py`: the complete claim / lease / send-outside-txn / record loop to mirror.
- `egress.send_pinned_http(capability, "POST", url, content=..., headers=..., timeout=..., max_bytes=..., allowed_host=...)`: validated, pinned, redirect-refusing, size-capped send with resolver and transport test seams.
- `secret_cipher` MultiFernet: reversible encryption for the signing secret.
- `principal_still_allowed` / `recheck_principal`: liveness; `acting_member_connection`: RLS-true visibility.
- `results.doc_link` / `run_link`: the "Open in Syrel" links.
- 304/307 key UI: secret-once panel, copy module, victim-naming sheets, admin section pattern.

### Established Patterns
- Triggers are swallow-and-warn, `SECURITY DEFINER`, `search_path = ''`, EXECUTE revoked from PUBLIC.
- Outbox tables are service-role only; reads go through the backend with explicit checks.
- Audit literal changes ship with the migration CHECK in one commit.
- Blocking I/O in async handlers goes through `run_in_threadpool` (D-v2.5-01); egress validation already does.

### Integration Points
- `workflow_runs.status` (`active / paused / cap_paused / completed / failed / cancelled`) and `documents.status` (`pending / processing / completed / failed`) — trigger targets.
- `workflow_runs.origin_kind` (`app / schedule / key / mcp`) — the SC#2 origin set.
- `main.py` lifespan — one block for the drainer.
- `SettingsPage.tsx` — one tab mount; `OrgApiKeysTab.tsx` — one section mount.
- `notifications` (mig 218) — new kind, nullable `run_id`.

</code_context>

<specifics>
## Specific Ideas

- The webhook-id must survive retries and resends; receivers dedupe on it.
- "Thin" is literal: if a field could carry a person's words, it is not in the payload.
- The save-time SSRF sentence is the same words every time; no internal reason codes on screen.

</specifics>

<deferred>
## Deferred Ideas

- `document.failed` (ingest failure) event — useful, not in HOOK-01's list.
- An operator deployment kill switch and an org switch for webhooks (the `mcp_enabled` pattern).
- Org-owned endpoints; replay since a date; ed25519 signatures (REQUIREMENTS Future).
- Event filters by folder or workflow; custom request headers; batching.
- Operator-tunable retry schedule and overlap length (constants in v1).
- Revealing a secret after creation (v1 is show-once + roll).
- An email when an endpoint is auto-disabled (v1 is in-app only).

### Reviewed, not folded
- Seeds whose text mentions webhooks — `SEED-013` (already folded into v4.9; its flip is Phase 309's REG-10 work), `SEED-014`, `SEED-062`, `SEED-142`, `SEED-144`, `SEED-145`, `SEED-146`, `SEED-177`, `SEED-209`, `SEED-213`, `SEED-246` — all concern inbound connectors, sandbox egress or automations, not outbound event delivery. The structured sweep (`check-seeds-register.cjs --phase 308`) matched 0 (no plans yet); re-run at plan-phase.
- `BUG-260923-01` (settings surfaces crowd the nav rail) — a ninth Settings tab adds to it; left open, noted for the UI-SPEC to keep the tab label short.

</deferred>

---

*Phase: 308-told-by-webhook*
*Context gathered: 2026-11-04*
