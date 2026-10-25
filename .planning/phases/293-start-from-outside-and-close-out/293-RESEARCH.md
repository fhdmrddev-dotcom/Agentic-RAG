# Phase 293: Start From Outside, and Close Out - Research

**Researched:** 2026-10-25
**Domain:** inbound credential (API key) + unattended run start/read, run-origin provenance, seed-register close-out
**Confidence:** HIGH for code facts (every claim names file:line); MEDIUM for the hash-choice citation; the gates could NOT be run this session (see Environment).

## Summary

Everything this phase needs already exists as a seam except three things: the credential, a shared
limiter, and a place to record where a run came from. The unattended start is `launch_scheduled_run`
(`backend/app/services/scheduler_service.py:65-260`): load definition → lint refusal → entitlement →
own thread → `create_workflow_run` → `arm_run_budget` → `create_task(_drive_run)`. Every workflow run in
the product is inserted by ONE function, `create_workflow_run` (`backend/app/db/workflows.py:396`,
INSERT at :523), called from exactly three places: the app kickoff (`backend/app/api/threads.py:1997`),
the scheduler (`scheduler_service.py:204`) and the publish golden run (`harness/publish_service.py:1659`).
That single writer is where origin is stamped, so "recorded once, at start, never inferred" is true by
construction.

Five findings change the plan shape: (1) **most output files cannot get a Supabase Storage signed URL**:
files under 256 KB are stored inline as `bytea` (`workspace_service.py:35`, `api/workspace.py:671`), so a
"short-lived link" must be our own (a Redis one-time token served by a key-scoped download route).
(2) **`get_definition` returns the owner's DRAFTS** (`db/workflows.py:913`), and the scheduler uses it, so
the inbound path must add `status = 'published'` itself. (3) **A thread insert with no `org_id` lands in
the owner's arbitrary first org** (`threads_autofill_org_id`, full-schema.sql:7048, and `workflow_runs`
inherits the thread's org, :7132). The scheduler inserts without `org_id` (`scheduler_service.py:181`), which
is a latent bug for two-org users. The inbound path must stamp the key's org explicitly. (4) **The seeds
gate never reads `folded_into`** (`scripts/check-seeds-register.cjs`, no occurrence), and a generic
"folded but planted" check would fire on SEED-197 and SEED-297 today, so D-28 needs a SCOPED check.
(5) **Nothing in this codebase can "unpublish" a workflow**: published rows are immutable and only a
cascade delete removes them (`api/workflows.py:1398`, `:1464-1490`). SC#2's "call to an unpublished
workflow" has to be driven with a draft id, or a deleted workflow.

**Primary recommendation:** Origin goes in three typed columns on `workflow_runs` (`origin_kind`,
`origin_label`, `origin_ref`), written by `create_workflow_run`, protected by an immutability trigger, and
backfilled from `inputs->>'_schedule_id'`. The key is `srl_live_` + `secrets.token_urlsafe(32)`, stored as a
SHA-256 hex digest, sent as `Authorization: Bearer`. It is resolved by its own dependency module that never
touches `get_current_user`. Limits are enforced by a Redis fixed-window counter keyed per key, kind and
minute. The inbound start shares the scheduler's core through an extracted `launch_unattended_run` (the
G-5 named seam "split cadence claiming from job execution").

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Key mint, hash, revoke, expiry | API / Backend | Database (`api_keys`, RLS + column grants) | secret exists only in the create response; DB holds a digest |
| Key authentication on inbound calls | API / Backend (own dependency module) | Database (live checks per call) | must not reuse the Supabase-JWT path (`dependencies.py:300`) |
| Rate limit | Redis (shared) | API | 2 uvicorn workers (D-15); in-process counters double the limit |
| Inbound start | API → `launch_unattended_run` service | Database | same core as schedules; owner identity |
| Status read + file links | API (pure reads on pool) | Redis (one-time download tokens) | inline files need our own link |
| Origin record | Database (`workflow_runs` columns, trigger) | API (one wire helper) | single writer `create_workflow_run` |
| Origin line, next-run text | Browser (pure leaves + one mount per hot file) | — | server sends facts, client formats words |
| API keys tab / admin list | Browser | API (`/api-keys`, `/org/api-keys`) | UI-SPEC variant C |
| Audit | API (fire-and-forget) | Database (`audit_log` CHECK) | `audit_service.write_audit_entry` |
| Seed close-out | Planning files + `scripts/check-seeds-register.cjs` | — | hand-edited frontmatter, gate proves it |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**The key (credential)**
- **D-01 (a key is one person in one org, and a run acts as them).** A key belongs to the member who made it, in one organisation. A run it starts runs as that person, with their folder and knowledge access, exactly as a scheduled run runs as its schedule's owner (Phase 204). No new identity type. *Why:* no service-account concept exists, and "what may an org robot search" has no answer today.
- **D-02 (the key lists the workflows it may start).** Chosen at creation: one or more published workflows. A start for any other workflow is refused. *Why:* SEED-195: an outside caller is not a session and must not get the whole toolbox.
- **D-03 (any member makes keys for their own runs; admins see and revoke all).** Uses the two access levels the org model has (member / admin, memory `project_org_model_flat_with_inert_departments`).
- **D-04 (expiry chosen at creation).** 30 / 90 / 365 days / never; default 90. Revoke works at any time and takes effect on the next call.
- **D-05 (every call re-checks the live state).** On each call: key not revoked, not expired, the person is still a member of the key's org, the workflow is still published and still on the key's list, and the person can still run it. Any failure is a refusal. The org entitlement check applies exactly as it does to scheduled runs (258 F-2 / TIER-01: a run is execution).
- **D-06 (cross-org and unauthenticated calls are refused without confirming anything).** No key, a bad key, a key from another org, or a workflow id outside the key's org: refused, and the response must not reveal whether the workflow or run exists (404 for unknown or foreign ids, 401 for a missing or invalid key). Driven live (SC#2), including with the dev account's second org (memory `reference_dev_account_is_in_two_orgs`).

**The call and its answer**
- **D-07 (start returns a run id; the caller polls).** No held-open call, no wait parameter, no callback. The id is the run's UUID; it is never the only thing protecting a read (D-12).
- **D-08 (status read returns state + final output + file links + per-step state).** Status (including "waiting for a person"), the final output text, short-lived signed download links for output files, and each step's name and state. Not the full 289 evidence payload.
- **D-09 (each inbound run gets its own thread in the key owner's history).** Same as a scheduled run (one thread per run), so the run page and panel work unchanged.
- **D-10 (a paused run reads "waiting for a person" and names who; it is answered in the app).** The 295 durable pause holds the run; the caller keeps polling. No answering through the key. *Why:* an outside system approving its own risky action defeats the approval.
- **D-11 (inputs are the declared launch fields, text values only).** Unknown field names are refused, naming them. Required fields are enforced as the launch form does (287-01). A workflow whose launch form needs a file upload is refused in this phase with a worded reason.
- **D-12 (only the key that started a run can read it).** Any other key, including the same person's, gets 404.
- **D-13 (inbound text is untrusted data).** Input values are passed as data, fenced the way TRUST-03 fences connector content. They can never change the workflow's tools, grants, steps, model or scope; those come only from the published definition. SC#4 is driven with a payload that contains instructions, and the result must show no change to tools or grants.

**Rate limit and audit**
- **D-14 (per-key limits, operator-set).** Defaults: 10 starts per minute and 120 status reads per minute per key. Stored in `app_settings` with a Settings control (memory `feedback_everything_in_ui_except_secrets`). Over the limit: 429, a `Retry-After` header, and a sentence naming which limit was hit.
- **D-15 (the limiter is shared across workers).** Redis-backed, because uvicorn runs 2 workers (D-PRD-12); an in-process counter would allow double the limit.
- **D-16 (every call writes an audit row).** Starts, reads and refusals, naming the key (its id and label, never the secret) and the run where there is one. New audit action types need the CHECK constraint synced (`audit_service.assert_action_types_synced`).
- **D-17 (each key shows its own activity).** "Last used" plus its recent calls: time, start or read, workflow, run link, ok or refused and why. The admin audit browser shows the same rows.

**Key management (UI)**
- **D-18 (one home: an "API keys" tab in Settings).** Create (label, workflows, expiry), list, revoke. The workflow card's ⋯ menu gets an item that opens this tab with that workflow pre-picked. Admins get an org-wide list (all members' keys, revoke) in the org admin area.
- **D-19 (the secret is shown once, with a copy-ready example).** After creation: the secret, plus `curl` for start and for status with the chosen workflow's launch fields filled in. The secret is never shown again; storage is a one-way hash (it never needs to be read back, so `secret_cipher.py` encryption is not the right tool; research confirms).
- **D-20 (the public docs stop saying "no API keys").** The sentence in `scripts/build-public-openapi.cjs` and `docs/public/api/concepts/authentication.md` is replaced, and the docs get a "Start a workflow from outside" guide next to `chat-from-a-script.md`.
- **D-21 (G-2: sketch the key screen only).** `/gsd:sketch` of the API keys tab (create form, show-once secret + example, list with last-used, revoke, admin list) runs before `/gsd:plan-phase 293`; the operator-approved mockup is the acceptance bar. The origin line and next-run time are one text line each in existing rows, specified in UI-SPEC, not sketched.

**How a run says how it started (START-04)**
- **D-22 (origin is recorded once, at start: app, schedule or key, plus a name).** Wording shape: "Started in the app by Sam" / "Started by schedule Every Monday 09:00" / "Started by key n8n-prod". Stamped by the start path, never inferred later.
- **D-23 (old runs claim only what was recorded).** Runs with `_schedule_id` in their inputs are backfilled as schedule runs. Every other old run shows **no** origin line. An unknown origin is never shown as "app" or "manual" (the roadmap's named failure).
- **D-24 (the origin line shows in four places).** The run page header (live and finished), the 289 evidence report and its export, the workflow run log rows (`RunLogPanel`), and the chat run card. G-5: one mount or prop per hot file (`WorkflowRunPage.tsx`, `RunCard.tsx`).
- **D-25 (the card shows the next run time beside the cadence).** "Every Monday · next Mon 27 Oct, 09:00", from the server's `next_run_at`, never computed in the browser. Silent on unscheduled rows, as today. Last run stays as today ("Worked 4 days ago").

**Seed close-out (REG-06)**
- **D-26 (SEED-163 → `shipped`).** The status enum has no `delivered`; `shipped` is the word used for SEED-232 and SEED-084. `status_note` says: delivered in 193.2; the visible-mark sliver stays owed, as the seed's own body records.
- **D-27 (every seed folded at intake carries its real status).** The 12 listed in REQUIREMENTS.md line 7 are each checked and set to what shipped, with `folded_into` / a `status_note` saying where it went. SEED-195 and SEED-014 are flipped by this phase's own result (SEED-014 likely `partially-answered`: scheduled + inbound shipped, event-triggered and monitors not). Hand-edited frontmatter, bodies unchanged.
- **D-28 (the gate proves it).** `node scripts/check-seeds-register.cjs` passes, and no seed folded into a v4.7 phase still reads `planted`. If the gate cannot report that, the plan adds the smallest check that can (research decides).

**Process**
- **D-29 (security_enforcement is on).** Threat model in every plan that touches the key, the endpoints or the inputs; `/gsd:secure-phase 293` before close.
- **D-30 (migration discipline).** Next free number is **215**. Apply by the SQL editor, regenerate `full-schema.sql`, RLS on every new table, revoke from `PUBLIC` on any new function, `get_advisors(security)` at the cloud apply. Deploy-artifact parity rules apply to any new env var (none expected: limits live in `app_settings`).
- **D-31 (G-4 scenarios, operator-recognisable).** (1) A curl with a fresh key starts a run, and polling returns its final output and a working file link. (2) The same curl with a revoked key, with a key from the other org, and against an unpublished workflow is refused each time. (3) The run page and the chat run card of that run say "Started by key <label>"; a scheduled run says "Started by schedule …"; the card shows the next run time.
- **D-32 (SC#10 axes for the run-start path).** Full native roster + OpenRouter, multi-tool, parallel-thread, long-message rows in VALIDATION.md; blocked rows recorded with reasons (Moonshot account suspended; OpenRouter credits, as of 292.1).
- **D-33 (plan count 4-5, G-8).** Suggested shape: (1) key storage + migration + auth dependency + limiter + audit; (2) start and status endpoints + input fencing; (3) origin stamping + backfill + the four origin lines + card next-run; (4) API keys tab + admin list + docs; (5) live proof + seed close-out.

### Claude's Discretion
- Key format (a recognisable prefix is suggested), hash choice, header name (`Authorization: Bearer` vs a dedicated header), endpoint paths, signed-link lifetime.
- Whether the origin is a column on `workflow_runs` or on `runs` (research reads both).
- The exact refusal sentences, following the house voice of existing refusals.

### Deferred Ideas (OUT OF SCOPE)
- **Callback URL on completion** — outbound egress (`egress.py`, SSRF rules); a later phase with its own threat model.
- **Start with "wait up to N seconds"** — convenience for short flows.
- **File uploads through a key** — size/type limits and storage writes via an outside caller.
- **Org service-account keys** — needs a defined knowledge scope for a non-person.
- **Per-org ceiling across all keys** — offered, not chosen; revisit if one org floods.
- **Answering a paused run through the API** — rejected for now: an outside system approving its own action defeats the approval.
- **SEED-367** (an open thread does not see a run started elsewhere) — related, own phase; its trigger is a phase adding polling/Realtime for runs.
- Reviewed (not folded): open reported bugs none overlap; `BUG-261020-03` is observability, not the inbound door. Seeds sweep: 0 matched (re-run at plan-phase once `files_modified` exists).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| START-02 | External system starts a workflow run via authenticated inbound call and reads the result. Org-scoped, rate-limited, audited. | §Key design, §Inbound start (shared seam), §Status read, §Rate limiter, §Audit, §Input fencing, §Security |
| START-04 | A run started by a schedule or inbound call shows how it was started; last and next run visible. | §Origin record (columns, single writer, backfill, trigger), §Origin on the four surfaces, §Next run |
| REG-06 | Seed statuses match reality: SEED-163 flipped, each seed this milestone folds is updated. | §REG-06 seed table, §Gate gap and smallest check |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Python backend in `backend/venv`; raw SDK only, no LangChain/LangGraph; Pydantic for structured outputs.
- **Every table has RLS**, users see only their own data. **Revoke from `PUBLIC` first**, then grant back (the function EXECUTE trap; also table defaults: mig 211 shows the 4-line REVOKE pattern, `supabase/migrations/211_message_citation_checks.sql:93-98`).
- Migrations: `supabase/migrations/<digits>_name.sql`. Apply via the SQL editor, never `db push`/`db reset`. Then `bash scripts/regenerate-full-schema.sh` (no `--reset`). Mirror any privilege narrowing in `scripts/full-schema-supplement.sql`, because pg_dump runs `--no-privileges` (supplement header :34-56). Guards: `node scripts/check-schema-acl-parity.cjs` (functions), `backend/venv/Scripts/python scripts/check-greenfield-privileges.py` (tables).
- No blocking supabase-py calls in async handlers: wrap with `run_in_threadpool` / `aexec` (D-v2.5-01).
- Multi-worker uvicorn (`WORKER_COUNT=2`): no process-local state for limits or tokens (D-PRD-12).
- Settings in `app_settings` + Settings UI; env vars only for secrets/infra. No new env var is expected; if one appears, the deploy-artifact parity rule applies (`scripts/check-deploy-drift.sh`).
- Realtime is a hint; polling/fetch is truth (D-v2.5-03).
- Supabase MCP: reads free; every WRITE needs explicit per-action operator approval. Run `get_advisors(security)` at cloud apply.
- Backend unit gate: `pytest tests/unit -q --continue-on-collection-errors` ceiling **71 failed** (zero headroom). Vitest: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from repo root. Typecheck with `npx tsc -p tsconfig.app.json --noEmit` (the bare form checks zero files).
- Worktrees: bootstrap first (`bash scripts/bootstrap-worktree.sh "$(pwd)"`), tear down with `scripts/teardown-worktree.sh`. **Serialize plans whose tests mutate the local DB** (rule 4).
- G-5: a PLAN's `files_modified` naming a file with no ledger row fails `node scripts/check-hot-file-ledger.cjs <phase>`. G-8: 3-5 plans. G-4: Chrome-driven lived UAT. SC#10: 8-row roster.
- Extension Contract: no new tool, phase type, emitter or executor. This phase adds none: it is routes plus data.
- Reported-bugs / seeds sweeps at plan-phase: `node scripts/check-seeds-register.cjs --phase 293`.

## Standard Stack

No new third-party package is needed. Everything uses the stdlib or dependencies already pinned.

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `secrets` (stdlib) | py3.12 | `token_urlsafe(32)` for key secrets and download tokens | CSPRNG, 256-bit [CITED: docs.python.org/3/library/secrets] |
| `hashlib` / `hmac` (stdlib) | py3.12 | SHA-256 digest; `hmac.compare_digest` | the `setup.py` constant-time precedent (`api/setup.py:23`) |
| `redis` (async) | 5.3.1 installed, `redis>=5.2,<6` (`backend/requirements.txt:29`) | limiter + download tokens | already a dependency (`dependencies.py:36-58`) [VERIFIED: installed version read by a venv import at research start] |
| FastAPI `HTTPBearer(auto_error=False)` | existing | read `Authorization: Bearer` without auto-403 | precedent `_admin_bearer_scheme` (`dependencies.py:416`), `_canvas_bearer_scheme` (:693) |
| asyncpg pool | existing | all key/inbound DB reads (service role, explicit predicates) | `get_pg_pool` (`dependencies.py:84`) |

**Package Legitimacy Audit:** not applicable: the phase installs **no** external package (npm or PyPI). slopcheck was not run because there is nothing to check.

## Architecture Patterns

### System Architecture Diagram

```
 outside caller (n8n / curl)
   │  Authorization: Bearer srl_live_…
   ▼
 [Maintenance MW] [Setup MW] [CORS] [CanvasGate: path list only, /inbound not in it]
   │
   ▼
 api_key_auth.resolve_key ──► sha256(secret) ─► api_keys row? ──no──► 401 (+no audit: no key id)
   │                                              │yes
   │                         revoked/expired/not-member/banned ──► 401 + audit(refused)
   ▼
 rate_limit.check(key, kind) ── Redis INCR apikey:rl:{kind}:{key}:{minute} ──► over ► 429 Retry-After + audit
   │
   ├── POST /inbound/workflows/{id}/runs
   │      id ∈ key.workflows? ─no─► 404 "Not found." (+audit)
   │      definition published ∧ visible to owner ∧ same org? ─► 404 / 409 / 403 (+audit)
   │      enforce_entitlement(org,"workflows") ─► 403/503 (+audit)
   │      validate inputs vs declared launch fields ─► 422 (+audit)
   │      launch_unattended_run(owner, key.org, def, inputs, origin=key) ──► thread(org stamped)
   │            └► create_workflow_run(origin_*) ► arm_run_budget ► create_task(_drive_run ► run_workflow)
   │      201 {run_id} (+audit start)
   │
   └── GET /inbound/runs/{run_id}
          workflow_runs WHERE id ∧ origin_kind='key' ∧ origin_ref=key.id ─miss─► 404 (+audit)
          phases + definition_snapshot ► steps; waiting_on (person name); final text;
          workspace_files(thread) ► Redis one-time token per file ► /inbound/files/{token}
          200 (+audit read)

 app (browser) ── /api-keys (own) · /org/api-keys (admin, require_org_manage) · GET /settings (limits)
 run surfaces ── WorkflowRunRead.origin · WorkflowRunListItem.origin · RunEvidenceRun.origin · MessageResponse.run_origin
```

### Recommended file layout (new files; avoids growing hot files)

```
backend/app/
├── security/api_key_auth.py        # mint/hash/parse + resolve_key dependency (NOT in dependencies.py: 24/12/1147, FIRES)
├── services/rate_limit.py          # Redis fixed-window limiter, Retry-After
├── services/unattended_launch.py   # extracted core of launch_scheduled_run + _drive_run (G-5 seam)
├── services/inbound_inputs.py      # declared-launch-field twin of soulData.launchInputFields + validation
├── db/api_keys.py                  # api_keys CRUD on the pool
├── api/api_keys.py                 # /api-keys (own) + /org/api-keys (admin)
└── api/inbound.py                  # /inbound/workflows/{id}/runs, /inbound/runs/{id}, /inbound/files/{token}
backend/app/services/harness/run_read_words.py   # waiting_who / compose_waiting_on moved out of api/workflow_runs.py (its named seam)
supabase/migrations/215_api_keys_and_run_origin.sql
```

### Pattern 1: Origin = three columns on `workflow_runs`, one writer

**Where it belongs:** `workflow_runs`, not `runs`. A `workflow_runs` row is created once per start. `runs`
rows are producer shells, and one workflow run has several of them (resume, Continue, segments:
`harness_engine.py:2620` mints one per resume, `scheduler_service.py:311-313`). Every origin surface except
the chat card reads `workflow_runs`: the run page (`api/workflow_runs.py:1062-1083`), the run log
(`:708-722`) and the evidence report (`api/workflow_run_evidence.py:186-196`).

**Columns:** `origin_kind text NULL CHECK (origin_kind IN ('app','schedule','key'))`, `origin_label text
NULL` (the schedule name or key label, snapshot at start), and `origin_ref uuid NULL` (the schedule id or
key id). `origin_ref` also enforces **D-12** in the row itself: the status read is
`WHERE id=$1 AND origin_kind='key' AND origin_ref=$2`. Do not name a column bare `origin`:
`messages.origin` already exists with values deep/harness (full-schema.sql:3221,3224). The wire field
`run_origin` on messages (UI-SPEC) avoids that collision.

**Actor name ("…in the app by Sam")** is resolved at read time from `user_id` → `profiles.display_name`.
The existing `started_by` / `waiting_who` privacy rules already do this (`run_evidence.py:489`,
`workflow_runs.py:828`). Only the label is snapshotted (UI-SPEC Surface 4: "renaming later never
rewrites history").

**Stamp sites (all three go through `create_workflow_run`):**

| Path | Site | Origin |
|---|---|---|
| App kickoff: RunModal, chat launch form, thread-start 287, Test Run | `api/threads.py:1997` | `app`, label NULL, ref NULL |
| Scheduler tick + "Run now" (`api/schedules.py:263-270` calls `launch_scheduled_run`) | `scheduler_service.py:204` | `schedule`, label = `schedule.name`, ref = schedule id |
| Inbound key start | new `unattended_launch` call | `key`, label = key label, ref = key id |
| Publish golden run | `publish_service.py:1659` | **leave NULL**: a validation run, not a start; D-23 says no line |
| Fork (287) | creates a draft, not a run | none |

Add `origin_kind/label/ref` as keyword-only kwargs defaulting to `None` on `create_workflow_run`, which
keeps every existing caller byte-identical (the `is_golden_run` precedent, `db/workflows.py:405,435-441`).

**Tamper guard:** `workflow_runs` has an owner **UPDATE** policy for `authenticated`
(full-schema.sql:10042), so a new column there is client-writable. This is the same T-294-14 reasoning that
moved citation verdicts off `messages` (`211_…sql:12-18`). Add `BEFORE UPDATE` trigger
`workflow_runs_origin_immutable`, which sets `NEW.origin_* := OLD.origin_*`. Create it AFTER the backfill
UPDATE in the same migration. Its function needs `REVOKE EXECUTE … FROM PUBLIC` and a mirror in the
supplement's §6 (`check-schema-acl-parity.cjs`).

**Backfill (D-23):**
```sql
UPDATE public.workflow_runs wr
   SET origin_kind = 'schedule',
       origin_ref  = (wr.inputs->>'_schedule_id')::uuid,
       origin_label = (SELECT s.name FROM public.workflow_schedules s WHERE s.id = (wr.inputs->>'_schedule_id')::uuid)
 WHERE wr.origin_kind IS NULL
   AND wr.inputs ? '_schedule_id'
   AND wr.inputs->>'_schedule_id' ~* '^[0-9a-f-]{36}$';
```
A deleted schedule leaves `origin_label` NULL, which renders "Started by a schedule" (UI-SPEC). Every other
old row stays NULL and renders nothing.

### Pattern 2: The shared unattended launch (D-09, "share, not copy")

`launch_scheduled_run` mixes schedule-only facts (`_schedule_*` input keys :197-202, cap normalisation
:190-195, `record_schedule_outcome` in `_drive_run` :370) with the generic core. The seam the ledger names
for this FIRING file (`docs/HOT-FILE-LEDGER.md:9532-9536`, "split cadence claiming from job execution"):

```python
# backend/app/services/unattended_launch.py  (moved, not rewritten)
async def launch_unattended_run(*, owner_id, org_id, workflow_id, definition, inputs, title,
                                max_tokens, max_duration, origin: RunOrigin, pool, redis,
                                on_finish=None) -> UUID: ...
async def _drive_run(..., on_finish) -> None: ...   # the finalize-on-every-exit block, unchanged
```
`launch_scheduled_run` stays in `scheduler_service.py` as a thin mapper: load, lint, entitlement, then
call the core, and `on_finish=record_schedule_outcome`.

⚠ **Source fences read `scheduler_service.py`'s text** and assert it CALLS `arm_run_budget` and
`mirror_run_active` (`tests/unit/test_scheduler_breaker_seam.py:35,101,307`;
`tests/unit/test_256_producer_shells.py:73`). Moving the core trips them. Retarget them **deliberately, with
the reason in the test body** (the D-206-07 / SEED-177 "retire a fence on purpose" rule), never by
surprise. Tests that patch `scheduler_service._drive_run` (`test_scheduler_string_guard.py:88,148`,
`test_256_producer_shells.py:14`) must follow the move. **Fallback** if the planner rejects the move: keep
the core in `scheduler_service.py` behind a new `launch_unattended_run` def. The fences stay green, and the
FIRING file grows by about 40 lines. The ledger forbids that without an explicit "honoured by
construction" argument.

**The core must stamp `org_id` on the thread insert** (`"org_id": org_id` at `scheduler_service.py:179-183`).
Without it, the thread and therefore the workflow run land in the owner's arbitrary first org
(`threads_autofill_org_id` → `autofill_org_id_by_owner('user_id')`, full-schema.sql:7048; `workflow_runs`
inherits from the thread, :7132). That is fatal for D-06 with the dev account's two orgs. It also fixes
the same latent bug for schedules.

**Spend caps:** the scheduler arms `arm_run_budget` with defaults 500 000 tokens / 1 800 s
(:190-195, :231-244). An inbound run is equally unattended. **Arm the same defaults.** Otherwise a key
can start 10 uncapped runs a minute. [ASSUMED: operator has not ruled; flag for confirmation]

### Pattern 3: Key authentication dependency (separate from the JWT path)

- `get_current_user` (`dependencies.py:300-376`) sends the bearer to GoTrue. A key sent there gets 401
  "Invalid or expired token" and a fingerprint log line (`_log_rejected_token_once`, :260; logs
  `sha256[:12]` only, never the secret). So the inbound routes must declare **only** the key dependency.
- Path prefix `/inbound/*`. It must not start with `/auth`, `/admin` (maintenance allowlist,
  `middleware/maintenance.py:45`) or `/setup` (`middleware/setup.py:33`). It must not live under `/runs/{id}`
  (taken by `runs.py`; collision documented at `workflow_runs.py:11-16`). CanvasGate matches an explicit
  path set (`middleware/canvas_gate.py:88-112`), so `/inbound/*` is ungated unless added. **Recommendation:
  ungated**: it is not a canvas surface, and chat-started runs are not canvas-gated either.
- Resolution order per call (D-05): parse → digest → `api_keys` row by `key_hash` (unique index) →
  `revoked_at IS NULL` → `expires_at IS NULL OR > now()` → `org_members(org_id,user_id)` exists →
  `NOT _is_banned(user_id)` (`dependencies.py:233`; fails OPEN by design) → limiter → route checks.
  The first five failures all return the same 401 body (UI-SPEC "This API key is not valid…").
- Membership, published state, list membership and entitlement are read **per call**, with no cache (the
  T-289-16 "removed member loses access on next read" posture, `workflow_run_evidence.py:179-182`).

### Pattern 4: Status read composed from existing pure helpers (D-08)

| Field | Source |
|---|---|
| `status` | `workflow_runs.status` (CHECK: active, paused, cap_paused, completed, failed, cancelled; full-schema.sql:4369). Map `paused` + an unanswered prompt to `waiting_for_person` |
| `waiting_on` (who) | `db/workflows.get_unanswered_ask_user(pool, run_id)` + `waiting_who(is_owner=False, display_name=…)` (`workflow_runs.py:828-841`, :894-958). Owner-less wording gives the name and withholds the prompt line |
| `steps[]` | `workflow_phases` rows (`_PHASES_SQL`, `workflow_run_evidence.py:184-189`) + names from `definition_snapshot` (`run_evidence._name_by_slug` :108, `compose_definition` :126) |
| `output_text` | last completed phase text (`run_evidence._completed_objects` :450). Add a public `final_output_text(rows)` beside `compose_deliverable` (:469) |
| `end_reason` | `resolve_end_reason` (`harness/run_read_wire.py`) as the evidence read uses it (:327-336) |
| `files[]` | `workspace_files` of the run's own thread (one thread per run, D-09), `kind` ≠ `template_input` (CHECK at full-schema.sql:4558), not expired |
| file `url` | **our own one-time link**: Redis `SET apikey:dl:{token} {key_id,run_id,file_id} EX 300`; `GET /inbound/files/{token}` re-checks the key is live and `origin_ref`, then streams bytes via `db/workspace.get_file_by_id` (:165) + `workspace_service._get_file_content` (:176) |

Why not Supabase Storage signed URLs: files under `DEFAULT_INLINE_THRESHOLD = 256 KB` are inline `bytea`
with no storage object (`workspace_service.py:35`, `api/workspace.py:667-673`: "a produced docx/pptx/xlsx
deliverable is stored INLINE"). Lifetime recommendation: **300 s**, regenerated on every read (the
document-download precedent is a 60 s setting, `user_settings.py:366`). [ASSUMED: lifetime is discretion]

Move `waiting_who` / `compose_waiting_on` / `unsourced_who` into `harness/run_read_words.py` **first**,
move-only. That is the seam the ledger names for `api/workflow_runs.py` (`HOT-FILE-LEDGER.md:1010`:
"move the viewer-aware wording … beside `run_read_wire.py`, before any feature lands here"). The inbound
read then imports it without importing a FIRING route module.

### Pattern 5: Redis fixed-window limiter (D-14, D-15)

No Redis limiter exists. A grep of `backend/app` finds `.incr(` nowhere. The only limiter is
`setup.py`'s **in-process** dict (`api/setup.py:85-109`), which is per-worker and is the wrong model.

```python
# services/rate_limit.py
async def hit(redis, *, key_id: str, kind: Literal["start","read"], limit: int) -> int | None:
    """Return None if allowed, else seconds until the window resets (Retry-After)."""
    now = int(time.time()); window = now // 60
    k = f"apikey:rl:{kind}:{key_id}:{window}"
    async with redis.pipeline(transaction=True) as p:
        p.incr(k); p.expire(k, 120)
        count, _ = await p.execute()
    return None if count <= limit else 60 - (now % 60) or 1
```
`MULTI/EXEC` makes INCR+EXPIRE atomic across workers. A per-minute bucket key needs no `EXPIRE NX`, so it
works on any Redis 5+ including Upstash (`rediss://`). **Fail closed** if Redis raises: return 503, and
never admit uncounted. Limits come from `app_settings` via the 30 s async settings cache
(`user_settings.py:378-409`), so a saved change reaches the other worker within 30 s. Say so in the Settings
footer, or accept it.

### Pattern 6: Input validation and fencing (D-11, D-13)

- **Declared fields:** a Python twin of `soulData.launchInputFields`
  (`frontend/src/components/workflows/soulData.ts:245-336`). Precedence: legacy `input_keys` → `inputs[]`;
  drop `RESERVED_RUN_INPUT_KEYS` (`models/message.py:27`: `kickoff_prompt`, `folder_id`); drop
  `source == "kb_auto"`. Pin the twin with a shared fixture (the 214 MIRROR precedent, `threads.py:2030-2034`).
- **Required:** `required` defaults True (`models/harness.py:657`), and a value is missing when
  `str(v).strip() == ""` (`soulData.ts:221-226`). **Server-side enforcement is new**: today only the browser
  enforces it (287-01).
- **Refusals:** unknown key → 422 naming them. Any declared `type == "file"` → 422. A fill step with no
  template is refused by the same `lint_workflow(...).code == "no_template_bound"` the scheduler uses
  (`scheduler_service.py:136-149`). Values must be `str`. Add a per-value cap (e.g. 8 000 chars) and a
  body cap. [ASSUMED: sizes]
- **Also strip** every key starting with `_` (e.g. `_schedule_*`, which feed `arm_run_budget` on the
  schedule path, :197-202) so a caller cannot set caps.
- **kickoff_prompt** for an inbound run is server-composed, `f"Run {definition.name}"`. That is the exact
  text the in-thread start sends (`useStartWorkflowInThread.ts:57`), so LLM-visible behaviour matches the
  app.
- **Where launch values reach a model today:** an `llm_emit` phase never sees launch inputs
  (`harness/form_inputs.py:3`). Values reach (a) programmatic fns via `config.input_keys`
  (`phase_types.py:744-755`, e.g. `split_topic`'s `topic` → batch sub-questions, `programmatic.py:95`),
  (b) the form overlay as data with a server-minted citation (`form_inputs.py`), and (c) external-action
  arguments, which are structurally approval-armed (`models/harness.py:633-642`).
- **What cannot change:** tools, grants, steps and model come from the `definition` object
  `create_workflow_run` receives and snapshots (`db/workflows.py:443-453`). `model=None` (the scheduler
  passes None, :210). Folder scope comes from `project_folder_id`, and `folder_id` is stripped. **This
  structural property is the enforcement; the fence is mitigation.** The same framing is in
  `thread_handoff.py:128-129`: "per-tool grants remain the enforcement".
- **The TRUST-03 fence:** the shipped envelope is `wrap_untrusted_tool_result`
  (`services/connectors/chat_tools.py:71-79`, `<external_tool_result …>` + "[SYSTEM NOTICE: … untrusted …]").
  Recommended minimal application: when a run's `origin_kind == 'key'`, wrap the declared-input-derived
  text at the one LLM-visible path, `split_topic` sub-questions (or the `topic` value). Keep raw values for
  data paths (form overlay, action args), because wrapping them would corrupt the deliverable. Mark the
  run untrusted with a `ctx` flag analogous to `ToolContext.has_connection_retrieval`
  (`services/tools/base.py:134-136`). [ASSUMED: fence site; planner confirms with a live SC#4 drive]

### Pattern 7: Audit

- **5 new action types:** `api_key.create`, `api_key.revoke`, `api_key.start`, `api_key.read`,
  `api_key.refused`. The same commit adds them to `VALID_ACTION_TYPES` (`services/audit_service.py:13-35`)
  and recreates `audit_log_action_type_check` with the full list (the pattern at
  `supabase/migrations/204_retention_and_legal_hold.sql:707-725`).
- ⛔ **Boot hard-fails** when the frozenset has a type missing from the live CHECK (`audit_service.py:38-63`,
  called in the `main.py` lifespan). Apply migration 215 **before** any process imports the new constant
  (local uvicorn, worktree test runs that boot the app, and production deploy).
- `write_audit_entry` writes through a supabase client and swallows errors (:66-96). Call it
  fire-and-forget (BackgroundTasks) with `get_service_role_supabase(org_id)` and an **explicit `org_id`**,
  otherwise the autofill trigger picks the user's first org (:77-85).
- Metadata: `{api_key_id, api_key_label, workflow_id?, run_id?, outcome, reason?}`. Never the secret, never
  the digest.
- A missing/garbage key has no `user_id`, and `audit_log.user_id` is NOT NULL (full-schema.sql:1419). Those
  401s are **logged, not audited** (state this in the threat model). Revoked/expired keys are known, so they
  are audited.
- D-17 activity read: add an expression index
  `CREATE INDEX … ON audit_log ((metadata->>'api_key_id')) WHERE action_type LIKE 'api_key.%'`.
- Volume note: 120 reads/min per key means up to 120 audit rows/min per polling key (D-16 is locked;
  record it as accepted).

### Anti-Patterns to Avoid
- **Resolving the key through `get_current_user`**: it costs a GoTrue round-trip and returns a misleading 401.
- **`get_definition` alone for "can run"**: it admits the owner's drafts (`db/workflows.py:913`). Add `status='published'`.
- **A thread insert without `org_id`**: the cross-org misfile described in Pattern 2.
- **Storage signed URLs for workspace files**: they are null for inline files.
- **A bare `origin` column**: collides with `messages.origin`.
- **An in-process limiter dict**: the `setup.py` model doubles the limit under 2 workers.
- **Printing a default origin** ("app"/"manual") for NULL. D-23 and UI-SPEC Surface 4 forbid it.
- **Computing next run in the browser**: D-25 forbids it. `automationFacts` already receives the server's `nextScheduleAt` (`automationFacts.ts:78-95`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unattended run start | a fourth ctx bag | `launch_unattended_run` (extracted) + `_build_resume_context` | three ctx builders already drifted (`scheduler_service.py:16-22`) |
| Producer-shell cleanup | new finalize | `finalize_run_terminal` in `_drive_run`'s `finally` (:325-369) | ghost "active" runs otherwise |
| Entitlement | tier lookups | `enforce_entitlement(pool, org_id, "workflows")` (`entitlement_service.py:110-129`) | 403 body + 503 on DB error already shaped |
| Org admin gate | role string checks | `require_org_manage` (`dependencies.py:1072`) | runs `current_user_has_permission` as the caller |
| Waiting-on wording | new sentence | `waiting_who` / `compose_waiting_on` (moved to `run_read_words.py`) | one name chain |
| Step names / final text | new parse | `run_evidence` helpers + `phase_output_object` | jsonb string-scalar trap (`workflow_runs.py:69-75`) |
| File bytes | storage-only fetch | `get_file_by_id` + `_get_file_content` | inline bytea round-trip is byte-exact |
| Constant-time compare | `==` | `hmac.compare_digest` | `setup.py` precedent |
| Untrusted envelope | new wording | `wrap_untrusted_tool_result` shape | TRUST-03 consistency |
| Bounded setting | ad-hoc checks | `_range_refusal_detail` + CHECK + UI clamp (mig 214 pattern, `api/settings.py:782-798`) | three places that agree |
| Leaf ref save | own Save button | `AgentRoundLimits` `changes()`/`adopt()` (ledger :24565-24571) | "one save per section" |

## Key design (Claude's discretion, decided)

| Item | Recommendation | Reason |
|---|---|---|
| Format | `srl_live_` + `secrets.token_urlsafe(32)` (~52 chars) | recognisable for log/secret scanning; 256-bit entropy |
| Stored | `key_hash = sha256(full_secret).hexdigest()` UNIQUE; `key_prefix` = first 13 chars for display (`srl_live_8Hq2`) | high-entropy random keys need no slow KDF. bcrypt/argon2 add per-call CPU (120 reads/min/key) and a salted hash cannot be an index lookup. Slow KDFs protect low-entropy passwords [CITED: zuplo.com/learning-center/how-to-implement-api-key-authentication; docs.sso.earthobservation.vam.wfp.org ADR-0008] (MEDIUM, vendor/ADR sources; OWASP's own API-token wording was not retrieved) |
| Not `secret_cipher.py` | confirmed | it is reversible Fernet over `SECRETS_ENCRYPTION_KEY` (`security/secret_cipher.py:6,66-101`); a key never needs reading back (D-19) |
| Header | `Authorization: Bearer <key>` | what n8n "Bearer Auth"/curl send by default; the route never shares a dependency with the JWT path |
| Paths | `POST /inbound/workflows/{workflow_id}/runs` → 201 `{run_id, status}` · `GET /inbound/runs/{run_id}` · `GET /inbound/files/{token}` | distinct prefix (see Pattern 3) |
| Management | `GET/POST /api-keys`, `POST /api-keys/{id}/revoke`, `GET /org/api-keys`, `POST /org/api-keys/{id}/revoke` | `get_current_user` + strict `get_active_org_id` (:899) / `require_org_manage` |
| Create also gated | `require_capability("workflows")` on create | an unentitled org gets no keys [ASSUMED] |

### `api_keys` table (migration 215)

`id uuid pk default gen_random_uuid()`, `org_id uuid not null`, `user_id uuid not null references
auth.users on delete cascade`, `label text not null check (char_length(btrim(label)) between 1 and 60)`,
`key_prefix text not null`, `key_hash text not null unique`, `workflows jsonb not null` (snapshot
`[{id,name}]`, with `jsonb_array_length >= 1`), `expires_at timestamptz null`, `revoked_at timestamptz`,
`revoked_by uuid`, `last_used_at timestamptz`, `created_at timestamptz default now()`. Unique index on
`(org_id, user_id, lower(btrim(label))) WHERE revoked_at IS NULL`. The `workflows` snapshot has **no FK**:
a deleted workflow must still render as the "deleted" chip (UI-SPEC), and the cascade delete removes every
version (`api/workflows.py:1476-1489`). Privileges: the 211 pattern, `REVOKE ALL … FROM PUBLIC, anon,
authenticated, service_role`. Then **column-level** `GRANT SELECT (id, org_id, user_id, label, key_prefix,
workflows, expires_at, revoked_at, revoked_by, last_used_at, created_at) TO authenticated` with an
owner SELECT policy (`org_id IN current_user_org_ids() AND auth.uid() = user_id`), and `GRANT ALL TO
service_role`. **`key_hash` is never granted to a client role.** Writes happen only through the pool. Mirror
in the supplement as a new §5x and add expectations to `check-greenfield-privileges.py`. Throttle the
`last_used_at` write: `… WHERE last_used_at IS NULL OR last_used_at < now() - interval '30 seconds'`.

### `app_settings` limits (migration 215)

`api_key_starts_per_minute integer NOT NULL DEFAULT 10 CHECK 1..60`,
`api_key_reads_per_minute integer NOT NULL DEFAULT 120 CHECK 10..600` (UI-SPEC Surface 6 bounds). This is
schema, not a seed, so there is no OPERATOR.md Step-3 entry (the 214 header reasoning,
`214_app_settings_round_caps.sql:9-11`). Python: `_val(row, …, None, 10/120)` in `user_settings.py`
(the :1200-1202 pattern), plus the allow-list and bounds in `api/settings.py` (:51, :112, :349, :782-798).
Members read effective values from the keys list response, not from `GET /settings` (UI-SPEC Surface 6).

## Origin on the four surfaces (START-04)

| Surface | Payload it reads | Change |
|---|---|---|
| Run page header | `GET /workflow-runs/{id}` → `WorkflowRunRead` (`workflow_runs.py:257-327`, select :1062-1083) | add `origin` to the select list (explicit columns: `test_214_failure_reason_seam.py` counts the star-select literal; never type it) + field |
| Evidence report + export | `GET /workflow-runs/{id}/evidence` → `RunEvidenceRun` (`workflow_run_evidence.py:76-91`, `_ACCESS_SQL` :176-182) | add the columns to `_ACCESS_SQL` + `origin` field; the export is the payload, unchanged |
| Run log rows | `GET /workflow-runs` → `WorkflowRunListItem` (:573-621, select :711) | add the columns + `origin`; `runLogRow.ts` appends the sentence atom |
| Chat RunCard | `/threads/{id}/messages` and `/snapshot` → `_enrich_messages_with_runs` reads **`runs`** (`threads.py:336-388`) | `runs` has no link to a workflow run. Resolve by thread: one batched `workflow_runs` select per thread; stamp `run_origin` **only when every workflow run of that thread has the same (kind,label)**, otherwise omit (fail silent, never guess). Key/schedule threads are one-run threads by construction (D-09); a later in-thread app start makes the thread ambiguous and the card goes silent while the run page still shows origin. `MessageResponse` must declare `run_origin` (`models/message.py:126-167`: `response_model` drops undeclared keys silently) |

One pure helper `origin_for_wire(row) -> {kind,label,actor_name}|None` in `harness/run_read_wire.py`
(the 295 "pure leaf every run read shares", `workflow_runs.py:93-100`). It returns None on NULL or an
unknown kind.

⚠ **RunCard only mounts for tool-bearing turns** (`MessageItem.tsx:568-570`:
`message.tool_calls && message.tool_calls.length > 0`). Whether a workflow run's assistant message carries
`tool_calls` was **not verified** this session. If it does not, the "chat run card" placement shows
nothing. G-4 row 3 must check it in Chrome. Open Question 2.

## Next run (D-25)

`automationFacts(row)` already receives `nextScheduleAt` (`automationFacts.ts:78-95`) and returns
`{phrase, more}`. Add `next: string | null` formatted from `nextScheduleAt` (en-GB parts, local zone, year
when it differs, "next was due" when past; UI-SPEC Surface 5). Words go in `libraryVocabulary.ts`. The card
renders one `<span data-testid="row-automation-next">` (UI-SPEC G-5 budget). Last run is unchanged. The
source is `db/schedules.compute_next_run_at`, written at create/update/claim (`db/schedules.py:67-99,
194-231, 314-338`).

## REG-06 seed table (frontmatter read 2026-10-25)

| Seed | Status now | Intake req / phase | Target |
|---|---|---|---|
| SEED-163 | `planted` (migration default, `:4-8`) | REG-06 | `shipped`, status_note "delivered in 193.2; visible-mark sliver owed" (D-26), folded_into "193.2" |
| SEED-232 | `shipped` (287) | START-01 | add `folded_into: "287"` |
| SEED-195 | `planted` | START-02 | this phase's result: `shipped` or `partially-answered` (scoped tool subset/folder scope per its body `:57-59` NOT shipped; recommend `partially-answered`), folded_into "293" |
| SEED-014 | `planted` | START-04 | `partially-answered` (scheduled + inbound shipped; event/monitor triggers open), folded_into "204, 293" |
| SEED-084 | `shipped` (287) | START-03 | add `folded_into: "287"` |
| SEED-164 | `partially-answered`, no folded_into | AUTH-01 / 288 | add `folded_into: "288"` (verify note) |
| SEED-051 | `partially-answered`, folded_into 291 | AUTH-02 | ok |
| SEED-183 | `answered`, no folded_into | AUTH-03 / 288 | add `folded_into: "288"` |
| SEED-086 | `folded` (290), but 290 is CLOSED | VIS-01 | `partially-answered` (authoring picture shipped; live view open, its own note) |
| SEED-337 | `partially-answered`, 292 | VIS-02 | ok |
| SEED-348 | `answered`, 289 | VIS-03 | ok |
| SEED-155 | `folded` (290), 290 CLOSED | VIS-04 | `partially-answered` (card half shipped; toolbar/counter open) |
| SEED-152 | `answered`, 289 | TRUST-01 | ok |

**Gate gap (D-28):** `check-seeds-register.cjs` validates `REQUIRED_KEYS`
(`seed_id,title,status,surface,trigger_when`, :339) and `STATUS_ENUM` (:350-354). It has **no reference
to `folded_into`**. A generic `[folded-but-planted]` arm (`folded_into` set ∧ status planted) would FAIL
today on SEED-197 (`folded_into: 241`, planted) and SEED-297 (`folded_into: "268 (trigger (d) only…)"`,
planted). Both are deliberately partial folds. **Smallest check:** a scoped flag
`--require-settled <SEED-id,…>` that exits 1 with `[still-planted]` for any listed seed whose status is in
`{planted, dormant, open, folded}`, and `[no-destination]` when neither `folded_into` nor `status_note` is
set. Add a `--self-test` arm driven RED against a planted fixture (the file's own arm style, :734-816).
The plan runs it with the 13 ids above. No enum change, so the TEMPLATE/gate/plant-seed triple-sync rule
(`TEMPLATE.md:57-62`) is not triggered. ⚠ **The gate was not run this session** (shell unavailable). The
plan must record its current verdict before editing.

## Public docs (D-20) — more homes than UI-SPEC lists

The "no API keys" claim lives in: `scripts/build-public-openapi.cjs:52-54` (DESCRIPTION);
`docs/public/api/concepts/authentication.md:10-11,17`; `docs/public/api/overview.md:12`;
`docs/public/api/guides/chat-from-a-script.md:12`; `docs/public/api/roadmap-open-platform.md:2,10`;
`docs/public/get-started/overview.md:49`; `docs/public/security/egress-controls.md:56`;
`frontend/src/docs/pages/ApiReference.tsx:108-109`; and the author rule `docs/public/README.md:83`. Two
tests **pin the old copy** and must be changed in the same commit: `frontend/src/docs/__tests__/ApiReference.test.tsx:35`
("No API keys today.") and `frontend/src/docs/__tests__/publicOpenapi.test.ts:66` (`toContain("no API keys")`).
New router tags must join `TAG_GROUPS` (`build-public-openapi.cjs:98-130`), or the build exits 1
`[ungrouped-tag]`. Put `inbound` and `api-keys` under "Automation" / "Account & org". The snapshot
`docs/public/api/openapi.snapshot.json` is regenerated by `scripts/export-openapi.py` and freshness-tested by
`test_276_openapi_snapshot_fresh.py`, then `node scripts/build-public-openapi.cjs` (and `--check`). Add a
`bearerAuth` scheme note for key routes. `docs/public/security/secrets.md` should state "API keys are
stored as a one-way digest". New guide: `docs/public/api/guides/start-a-workflow-from-outside.md`.

## Runtime State Inventory

Not a rename phase. The one data migration is the D-23 backfill (Pattern 1). Stored data: existing
`workflow_runs` with `_schedule_id` → backfilled. Live service config: none. OS-registered state: none.
Secrets/env vars: **none added** (limits live in `app_settings`; key digests live in the DB). Build
artifacts: the public OpenAPI snapshot + public spec + `full-schema.sql` are regenerated.

## Common Pitfalls

1. **Boot dies after the code lands but before migration 215.** `assert_action_types_synced` hard-fails
   (`audit_service.py:38-63`). Apply 215 locally first. In production, apply 215 in cloud before the backend
   deploys (the 211/214 header rule).
2. **Drafts startable.** Covered in Pattern 2 / Anti-patterns.
3. **Wrong-org thread.** Covered in Pattern 2. Drive SC#2 with the two-org dev account.
4. **No published → unpublished transition exists.** The immutability trigger blocks an UPDATE of a
   published row (`api/workflows.py:1327,1398`). Drive "unpublished" with a draft id (refused as not on the
   key, 404), or with a key whose workflow was cascade-deleted (refused). The UI's "no longer published"
   chip is reachable only via deletion. [VERIFIED: grep found no unpublish route]
5. **Versions pin by row id.** Schedules pin `workflow_id` (a definition row, full-schema.sql:4463), and
   versions share a slug. A key pinned to a row id keeps starting that version even after a newer one is
   published. Mirror schedules (pin the id), and say so in the guide. Open Question 1. [ASSUMED: new
   versions are new rows; inferred from `_SAME_SLUG_VERSIONS_SQL`, `workflow_run_evidence.py:197`]
6. **Hot fences on copy.** The two pinned docs tests above, and the source fences on `scheduler_service.py`.
7. **Vitest suites that run nowhere.** `src/components/settings` and `src/components/org` are **not**
   directory entries in TARGETS (`vitest-count-gate.cjs:3882,4321,5134-5179`). Every new suite there must be
   adopted FILE-LEVEL into TARGETS **and** BASELINE (the two-knob rule). `src/components/workflows` is a
   directory entry (:4770).
8. **response_model drops new keys silently.** Declare `origin` on `WorkflowRunRead`,
   `WorkflowRunListItem`, `RunEvidenceRun`, and `run_origin` on `MessageResponse`
   (`models/message.py:151-156`).
9. **Settings cache staleness.** Up to 30 s per worker (Pattern 5).
10. **Audit org misattribution.** Pass `org_id` explicitly (`audit_service.py:77-85`).
11. **`_is_banned` fails open.** It is acceptable here only because membership is also checked. Do not make
    banned the only gate.

## Code Examples

```python
# security/api_key_auth.py — mint + digest (stdlib only)
import hashlib, hmac, secrets
PREFIX = "srl_live_"
def mint() -> tuple[str, str, str]:
    secret = PREFIX + secrets.token_urlsafe(32)
    return secret, hashlib.sha256(secret.encode()).hexdigest(), secret[:13]
def digest(presented: str) -> str | None:
    if not presented.startswith(PREFIX) or len(presented) > 128:
        return None
    return hashlib.sha256(presented.encode()).hexdigest()
```

```python
# the D-12 read is one predicate on the run row
row = await pool.fetchrow(
    "SELECT id, thread_id, status, user_id, definition_snapshot, origin_kind, origin_label "
    "FROM workflow_runs WHERE id = $1 AND origin_kind = 'key' AND origin_ref = $2",
    run_id, key["id"])
if row is None:
    raise HTTPException(404, "Not found.")   # byte-identical for every cause (D-06)
```

## State of the Art

| Old | Current | Impact |
|---|---|---|
| "no API keys" (public docs, ApiReference) | first non-login credential | 9 copy homes + 2 pinned tests change together |
| run origin inferred nowhere (`_schedule_id` unread, `scheduler_service.py:199`) | recorded columns + backfill | D-23 honesty |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Inbound runs get the scheduler's default caps (500k tokens / 1800 s) | Pattern 2 | uncapped unattended spend, or caps the operator does not want |
| A2 | Download-link lifetime 300 s via a Redis one-time token | Pattern 4 | a link expiring too fast for slow pollers |
| A3 | The TRUST-03 envelope site is `split_topic`/`topic` for key-origin runs | Pattern 6 | a missed LLM-visible path; SC#4 drive must probe |
| A4 | Input size caps (8 000 chars per value) | Pattern 6 | rejecting a legit payload |
| A5 | Key creation also requires the `workflows` capability | Key design | blocks unentitled members from creating useless keys (likely desired) |
| A6 | "Run now" from the schedule modal is recorded as `schedule` origin | Pattern 1 | operator may want "app by Sam" for a click |
| A7 | Publishing a new version creates a new definition row, so keys pin a version | Pitfall 5 | a key silently running an old version |
| A8 | The chat card is silent on threads whose runs differ in origin | Origin table | a card without a line where the operator expects one |

## Open Questions

1. **Version pinning.** Does a key start "the workflow" (latest published version of the slug) or "this
   version"? Schedules pin the row. Recommend matching schedules, plus one sentence in the guide; ask the
   operator if it matters.
2. **Does a workflow run's assistant turn render a `RunCard`?** Mount condition `MessageItem.tsx:568`. If
   not, the fourth placement needs a different home (e.g. the run receipt). Verify in plan 3 with one
   fixture read before building.
3. **Should `/inbound/*` be canvas-gated?** Recommend no (Pattern 3). The canvas flag is ON for everyone
   in prod (memory `reference_canvas_flag_is_on`).
4. **SEED-195 target status:** `shipped` vs `partially-answered`. Its body asks for folder-scope and
   tool-subset credentials (`:57-59`), and D-01 chose owner scope instead. Recommend `partially-answered`.

## Environment Availability

⚠ **The shell tool was unavailable for most of this session** (repeated "classifier gave no verdict").
`node scripts/check-seeds-register.cjs`, `node scripts/check-hot-file-ledger.cjs --files …` and the live
probes **were not run**. Availability below comes from CLAUDE.md and one venv import at research start.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis | limiter, download tokens | per CLAUDE.md (docker-compose.dev.yml, `redis:7-alpine`) | 7 | none: fail closed 503 |
| redis-py | limiter | ✓ (venv import) | 5.3.1 | — |
| Local Supabase (54322) | migration 215, live tests | per CLAUDE.md; watch the port-reservation trap | — | `scripts/start-local-infra.ps1` |
| Two-org dev account | SC#2 cross-org | per memory `reference_dev_account_is_in_two_orgs` | — | create a second org |
| Provider keys | SC#10 roster | Moonshot suspended, OpenRouter credits (D-32) | — | ⛔ rows with reasons |

## Validation Architecture

(`workflow.nyquist_validation` is `false` in `.planning/config.json`. This section is kept short as the
SC test map the CONTEXT asked for. UAT rows go in VALIDATION.md, not PLAN.md, per CLAUDE.md.)

| Property | Value |
|---|---|
| Backend | pytest; `cd backend && venv/Scripts/python -m pytest tests/unit/test_293_*.py -q` (targeted); full gate once per wave: `node scripts/check-backend-unit-baseline.cjs` (ceiling 71) |
| Frontend | vitest; targeted `npx vitest run <files>`; wave gate `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root); `npx tsc -p tsconfig.app.json --noEmit` set-diff vs base |
| Gates | `node scripts/check-hot-file-ledger.cjs 293`, `node scripts/check-seeds-register.cjs [--require-settled …]`, `node scripts/build-public-openapi.cjs --check`, `node scripts/check-schema-acl-parity.cjs`, `backend/venv/Scripts/python scripts/check-greenfield-privileges.py`, `node scripts/check-claude-md-size.cjs` |

| SC | Behaviour | Type | Test |
|---|---|---|---|
| SC#1 | start → 201 run_id; read → status/output/steps/files; file link streams bytes | unit (stubbed pool/redis) + live | `test_293_inbound_start.py`, `test_293_inbound_status.py`; live curl (G-4 row 1) |
| SC#2 | no key 401; bad/revoked/expired 401 same body; other-org key → 404; workflow not on key / draft / deleted → 404/409; other key reading run → 404; byte-identical 404 bodies | unit + live two-org | `test_293_key_auth.py` (each arm driven RED), G-4 row 2 |
| SC#3 | 11th start in a minute → 429 + Retry-After + sentence; shared across 2 workers (two clients on one Redis); audit row per call with key id+label, never secret | unit (fakeredis or real local Redis) + live | `test_293_rate_limit.py`, `test_293_audit_rows.py`; `test_110_audit_drift_guard.py` live |
| SC#4 | payload with instructions → definition snapshot tools/grants unchanged; reserved/underscore keys stripped; unknown key 422; file workflow 422 | unit + live | `test_293_input_validation.py`; live drive comparing `workflow_runs.definition_snapshot` to the published definition + harness_audit |
| SC#5 | origin stamped at three sites; NULL renders nothing; backfill; trigger blocks UPDATE; four surfaces word one run identically; next-run text equals modal "Next:" | unit (py + vitest) + G-4 | `test_293_origin_stamp.py`, `RunOriginLine.test.tsx`, `runOriginVocabulary.test.ts`, `automationFacts.test.ts`, `runLogRow.test.ts` |
| SC#6 | listed seeds settled; gate passes | script | `node scripts/check-seeds-register.cjs --require-settled …` + `--self-test` |

SC#10 roster (D-32): 8 provider rows on the inbound start path, driven with the cheapest honest method: a
key start of a one-LLM-step published workflow per provider (the workflow's model per row), verdict from
`workflow_runs`/`workflow_phases`; multi-tool, parallel-thread (two keys starting at once while a chat
streams), and long-message (≥ 5 KB input value) rows. Blocked rows are recorded ⛔ with reasons.

## Security Domain

| ASVS | Applies | Control |
|---|---|---|
| V2 Authentication | yes | 256-bit random key, SHA-256 digest, constant-time compare, expiry, revoke, per-call live checks |
| V3 Session | n/a (stateless key) | — |
| V4 Access control | yes | key → owner+org; workflow allow-list; D-12 `origin_ref`; admin via `require_org_manage`; RLS + column grants (no `key_hash` to clients) |
| V5 Input validation | yes | declared-field allow-list, type=str, size caps, reserved/underscore strip, Pydantic bodies |
| V6 Cryptography | yes | stdlib `secrets` + `hashlib`; no hand-rolled crypto |
| V7 Logging | yes | audit every authenticated call; never log secret/digest |
| V11 Business logic / rate | yes | Redis per-key limits, fail closed |

| Threat (STRIDE) | Pattern | Mitigation |
|---|---|---|
| S: guessed/stolen key | brute force, leaked logs | 256-bit entropy; digest-only storage; prefix shown; revoke; expiry; fingerprint-only JWT log |
| S: key replay after owner leaves org | stale membership | `org_members` read per call |
| T: rewrite a run's origin to read it with a key | owner UPDATE policy on workflow_runs | immutability trigger on `origin_*` |
| T: inputs override caps/folder/kickoff | `_schedule_*`, `folder_id`, `kickoff_prompt` keys | strip reserved + `_`-prefixed keys; server-composed kickoff |
| T/E: prompt injection via inputs | instructions in text values | tools/grants/model from definition snapshot; external actions approval-armed; no API answer to pauses (D-10); TRUST-03 envelope on LLM-visible path |
| R: denial of having called | missing audit | `api_key.*` rows with key id/label/run |
| I: run/workflow existence oracle | different 404/403 bodies | byte-identical 404 "Not found." for every unknown/foreign/not-on-key id |
| I: file link leaks | long-lived URLs | 300 s Redis token, rechecks key + origin on use |
| I: secret exposure in UI | cache/storage | shown once, memory only (UI-SPEC failure list 1) |
| D: start flood / runaway spend | 10/min/key uncapped runs | Redis limiter + default run budget (A1) |
| E: cross-org start | wrong-org thread | explicit `org_id` on thread insert; definition `org_id = key.org_id` or system-global published |

## Suggested Plan Split (D-33, G-8: 5 plans)

| Plan | Wave | Content | Mutates local DB? |
|---|---|---|---|
| 293-01 Credential core | 1 | migration 215 (api_keys, workflow_runs origin cols + backfill + trigger, audit CHECK +5, app_settings 2 cols, audit index); supplement mirror + full-schema regen + ACL/greenfield gates; `VALID_ACTION_TYPES`; `security/api_key_auth.py`; `services/rate_limit.py`; `db/api_keys.py`; `api/api_keys.py` (own + admin); settings allow-list/bounds; main.py one include | **YES**: serialize |
| 293-02 Start + read | 2 | move-only seams first (`unattended_launch.py` with fence retargets; `run_read_words.py`); `create_workflow_run` origin kwargs; stamp in threads.py / scheduler; `inbound_inputs.py`; `api/inbound.py` (start/status/files); origin on the 3 run reads + `run_origin` enrich; TRUST-03 flag; OpenAPI snapshot + TAG_GROUPS | live tests yes: serialize after 01 |
| 293-03 Origin + next-run UI | 2 (parallel with 02 on frontend files only; wire contract fixed here) | `RunOriginLine`, `runOriginVocabulary`, 4 placements (WorkflowRunPage, RunEvidenceReport, runLogRow, RunCard), types, `automationFacts.next` + vocabulary + WorkflowCard span | no |
| 293-04 Keys UI + docs | 3 | Settings tab "7" + apiKeys leaves, `ApiKeyLimits`, OrgAdminShell **extract-first** (`orgAdminTabs.ts`) + tab, WorkflowCardMenu item + WorkflowCard `onApiKey` + WorkflowsPage/ChatLayout wiring, `lib/api/apiKeys.ts`, all 9 docs homes + 2 pinned tests + new guide | no |
| 293-05 Live proof + REG-06 | 4 | G-4 rows 1-3 (Chrome), SC#2 two-org drive, SC#4 injection drive, SC#10 roster in VALIDATION.md; `--require-settled` gate arm + self-test; seed frontmatter edits; ledger rows | **YES**: serialize |

Plans 03 and 04 both touch `WorkflowCard.tsx` and `types/index.ts`. Keep them in different waves, or give
04 its own `lib/api/apiKeys.ts` types, as recommended. **Ledger rows to add at planning** (no row today; the
gate will fail): `backend/app/api/schedules.py`, `frontend/src/components/workflows/library/automationFacts.ts`,
`frontend/src/components/workflows/history/runLogRow.ts`, `scripts/check-seeds-register.cjs`, plus every
new file. FIRING files touched (ledger section must be read; seam/invariant): `scheduler_service.py`
(seam: split claiming/execution; 4 invariants `HOT-FILE-LEDGER.md:9525-9530`), `api/workflow_runs.py`
(seam: move viewer wording, :1010), `db/workflows.py` (extraction OWED; one kwarg), `api/threads.py`
(one kwarg; `run_is_cap_paused` invariant :24553 untouched), `main.py` (one include), `models/message.py`
(one field), `audit_service.py` (⊆ live CHECK), `api/settings.py` / `models/user_settings.py` (bounded-setting
pattern), `WorkflowRunPage.tsx` (one mount; 2 seams still owed, :22540), `RunCard.tsx` (props unchanged),
`WorkflowCard.tsx` (useState stays 0), `OrgAdminShell.tsx` (⛔ extract first, :11433), `SettingsPage.tsx`
(one tab + one ref), `types/index.ts`, `lib/api/threads.ts`, `build-public-openapi.cjs`,
`full-schema-supplement.sql`.

## Sources

### Primary (HIGH: code read this session)
- `backend/app/services/scheduler_service.py`, `db/workflows.py:396-560,880-917`, `api/threads.py:298-388,1900-2075`, `api/workflow_runs.py`, `api/workflow_run_evidence.py`, `services/run_evidence.py`, `dependencies.py:219-376,858-951`, `services/audit_service.py`, `services/entitlement_service.py`, `middleware/canvas_gate.py`, `middleware/maintenance.py`, `api/setup.py`, `api/workspace.py:565-700`, `services/harness/{phase_types,form_inputs,programmatic}.py`, `models/{harness,message}.py`, `services/connectors/chat_tools.py`
- `supabase/full-schema.sql` (runs, workflow_runs, messages, threads, org_members, workflow_definitions, workflow_schedules, workspace_files, audit_log, triggers), migrations 186, 204, 211, 214
- `docs/HOT-FILE-LEDGER.md` sections cited; `scripts/check-hot-file-ledger.cjs`, `scripts/check-seeds-register.cjs`, `scripts/build-public-openapi.cjs`, `scripts/vitest-count-gate.cjs`
- `.planning/seeds/*` frontmatter for the 13 seeds; `.planning/REQUIREMENTS.md`
### Secondary (MEDIUM)
- [Zuplo: how to implement API key authentication](https://zuplo.com/learning-center/how-to-implement-api-key-authentication.md)
- [WFP SSO ADR 0008: API key hashing](https://docs.sso.earthobservation.vam.wfp.org/architecture/decisions/adrs/0008-api-key-hashing)
- [Why bcrypt will kill your API performance](https://www.cybersierra.co/blog/bcrypt-performance-issues-api)

## Metadata
**Confidence:** stack HIGH (no new deps); architecture HIGH (single writer, seams located); pitfalls HIGH (each with file:line); hash choice MEDIUM (vendor sources); gate verdicts UNVERIFIED (not run).
**Research date:** 2026-10-25 · **Valid until:** 2026-11-08 (hot files move fast; re-derive triples at planning).
