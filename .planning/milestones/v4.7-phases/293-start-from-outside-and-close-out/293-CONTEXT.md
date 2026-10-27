# Phase 293: Start From Outside, and Close Out - Context

**Gathered:** 2026-10-24
**Status:** Ready for planning (sketch of the key screen first, see D-21)

<domain>
## Phase Boundary

An outside system (n8n, a script, a cron job elsewhere) starts a **published** workflow with an
**API key** and reads the run's status and result back (START-02). Every run records and shows how
it was started, and a scheduled workflow's card shows its next run time (START-04). The seed
register is corrected to match what shipped (REG-06).

**Measured at intake (2026-10-24):**
- **The app has no API keys of any kind today.** The public API docs say so in plain words
  (`scripts/build-public-openapi.cjs` DESCRIPTION; `docs/public/api/concepts/authentication.md`).
  This phase adds the first non-login credential.
- **Schedules already store `last_run_at` / `next_run_at`** (`backend/app/db/schedules.py`,
  computed by `compute_next_run_at`). The card (`automationFacts.ts`) shows the cadence words only;
  the schedule modal shows the time.
- **A scheduled run stamps `_schedule_id` into its inputs** (`scheduler_service.py:199`), and
  nothing reads it. No run records its origin as a field.

**Not this phase:** answering a paused run through the API, callback/webhook on completion, file
uploads through a key, an org service-account identity, Open Platform (`SEED-013`), MCP inbound
(`SEED-177` "be connected" half), live updates of an open thread (`SEED-367`).

</domain>

<decisions>
## Implementation Decisions

### The key (credential)
- **D-01 (a key is one person in one org, and a run acts as them).** A key belongs to the member
  who made it, in one organisation. A run it starts runs as that person, with their folder and
  knowledge access, exactly as a scheduled run runs as its schedule's owner (Phase 204). No new
  identity type. *Why:* no service-account concept exists, and "what may an org robot search" has
  no answer today.
- **D-02 (the key lists the workflows it may start).** Chosen at creation: one or more published
  workflows. A start for any other workflow is refused. *Why:* SEED-195: an outside caller is not a
  session and must not get the whole toolbox.
- **D-03 (any member makes keys for their own runs; admins see and revoke all).** Uses the two
  access levels the org model has (member / admin, memory `project_org_model_flat_with_inert_departments`).
- **D-04 (expiry chosen at creation).** 30 / 90 / 365 days / never; default 90. Revoke works at
  any time and takes effect on the next call.
- **D-05 (every call re-checks the live state).** On each call: key not revoked, not expired, the
  person is still a member of the key's org, the workflow is still published and still on the
  key's list, and the person can still run it. Any failure is a refusal. The org entitlement check
  applies exactly as it does to scheduled runs (258 F-2 / TIER-01: a run is execution).
- **D-06 (cross-org and unauthenticated calls are refused without confirming anything).** No key,
  a bad key, a key from another org, or a workflow id outside the key's org: refused, and the
  response must not reveal whether the workflow or run exists (404 for unknown or foreign ids,
  401 for a missing or invalid key). Driven live (SC#2), including with the dev account's second
  org (memory `reference_dev_account_is_in_two_orgs`).

### The call and its answer
- **D-07 (start returns a run id; the caller polls).** No held-open call, no wait parameter, no
  callback. The id is the run's UUID; it is never the only thing protecting a read (D-12).
- **D-08 (status read returns state + final output + file links + per-step state).** Status
  (including "waiting for a person"), the final output text, short-lived signed download links for
  output files, and each step's name and state. Not the full 289 evidence payload.
- **D-09 (each inbound run gets its own thread in the key owner's history).** Same as a scheduled
  run (one thread per run), so the run page and panel work unchanged.
- **D-10 (a paused run reads "waiting for a person" and names who; it is answered in the app).**
  The 295 durable pause holds the run; the caller keeps polling. No answering through the key.
  *Why:* an outside system approving its own risky action defeats the approval.
- **D-11 (inputs are the declared launch fields, text values only).** Unknown field names are
  refused, naming them. Required fields are enforced as the launch form does (287-01). A workflow
  whose launch form needs a file upload is refused in this phase with a worded reason.
- **D-12 (only the key that started a run can read it).** Any other key, including the same
  person's, gets 404.
- **D-13 (inbound text is untrusted data).** Input values are passed as data, fenced the way
  TRUST-03 fences connector content. They can never change the workflow's tools, grants, steps,
  model or scope; those come only from the published definition. SC#4 is driven with a payload
  that contains instructions, and the result must show no change to tools or grants.

### Rate limit and audit
- **D-14 (per-key limits, operator-set).** Defaults: 10 starts per minute and 120 status reads
  per minute per key. Stored in `app_settings` with a Settings control (memory
  `feedback_everything_in_ui_except_secrets`). Over the limit: 429, a `Retry-After` header, and a
  sentence naming which limit was hit.
- **D-15 (the limiter is shared across workers).** Redis-backed, because uvicorn runs 2 workers
  (D-PRD-12); an in-process counter would allow double the limit.
- **D-16 (every call writes an audit row).** Starts, reads and refusals, naming the key (its id
  and label, never the secret) and the run where there is one. New audit action types need the
  CHECK constraint synced (`audit_service.assert_action_types_synced`).
- **D-17 (each key shows its own activity).** "Last used" plus its recent calls: time, start or
  read, workflow, run link, ok or refused and why. The admin audit browser shows the same rows.

### Key management (UI)
- **D-18 (one home: an "API keys" tab in Settings).** Create (label, workflows, expiry), list,
  revoke. The workflow card's ⋯ menu gets an item that opens this tab with that workflow
  pre-picked. Admins get an org-wide list (all members' keys, revoke) in the org admin area.
- **D-19 (the secret is shown once, with a copy-ready example).** After creation: the secret,
  plus `curl` for start and for status with the chosen workflow's launch fields filled in. The
  secret is never shown again; storage is a one-way hash (it never needs to be read back, so
  `secret_cipher.py` encryption is not the right tool; research confirms).
- **D-20 (the public docs stop saying "no API keys").** The sentence in
  `scripts/build-public-openapi.cjs` and `docs/public/api/concepts/authentication.md` is replaced,
  and the docs get a "Start a workflow from outside" guide next to `chat-from-a-script.md`.
- **D-21 (G-2: sketch the key screen only).** `/gsd:sketch` of the API keys tab (create form,
  show-once secret + example, list with last-used, revoke, admin list) runs before
  `/gsd:plan-phase 293`; the operator-approved mockup is the acceptance bar. The origin line and
  next-run time are one text line each in existing rows, specified in UI-SPEC, not sketched.

### How a run says how it started (START-04)
- **D-22 (origin is recorded once, at start: app, schedule or key, plus a name).** Wording shape:
  "Started in the app by Sam" / "Started by schedule Every Monday 09:00" / "Started by key
  n8n-prod". Stamped by the start path, never inferred later.
- **D-23 (old runs claim only what was recorded).** Runs with `_schedule_id` in their inputs are
  backfilled as schedule runs. Every other old run shows **no** origin line. An unknown origin is
  never shown as "app" or "manual" (the roadmap's named failure).
- **D-24 (the origin line shows in four places).** The run page header (live and finished), the
  289 evidence report and its export, the workflow run log rows (`RunLogPanel`), and the chat run
  card. G-5: one mount or prop per hot file (`WorkflowRunPage.tsx`, `RunCard.tsx`).
- **D-25 (the card shows the next run time beside the cadence).** "Every Monday · next Mon 27 Oct,
  09:00", from the server's `next_run_at`, never computed in the browser. Silent on unscheduled
  rows, as today. Last run stays as today ("Worked 4 days ago").

### Seed close-out (REG-06)
- **D-26 (SEED-163 → `shipped`).** The status enum has no `delivered`; `shipped` is the word used
  for SEED-232 and SEED-084. `status_note` says: delivered in 193.2; the visible-mark sliver stays
  owed, as the seed's own body records.
- **D-27 (every seed folded at intake carries its real status).** The 12 listed in
  REQUIREMENTS.md line 7 are each checked and set to what shipped, with `folded_into` / a
  `status_note` saying where it went. SEED-195 and SEED-014 are flipped by this phase's own
  result (SEED-014 likely `partially-answered`: scheduled + inbound shipped, event-triggered and
  monitors not). Hand-edited frontmatter, bodies unchanged.
- **D-28 (the gate proves it).** `node scripts/check-seeds-register.cjs` passes, and no seed
  folded into a v4.7 phase still reads `planted`. If the gate cannot report that, the plan adds
  the smallest check that can (research decides).

### Process
- **D-29 (security_enforcement is on).** Threat model in every plan that touches the key, the
  endpoints or the inputs; `/gsd:secure-phase 293` before close.
- **D-30 (migration discipline).** Next free number is **215**. Apply by the SQL editor,
  regenerate `full-schema.sql`, RLS on every new table, revoke from `PUBLIC` on any new function,
  `get_advisors(security)` at the cloud apply. Deploy-artifact parity rules apply to any new env
  var (none expected: limits live in `app_settings`).
- **D-31 (G-4 scenarios, operator-recognisable).** (1) A curl with a fresh key starts a run, and
  polling returns its final output and a working file link. (2) The same curl with a revoked key,
  with a key from the other org, and against an unpublished workflow is refused each time. (3)
  The run page and the chat run card of that run say "Started by key <label>"; a scheduled run
  says "Started by schedule …"; the card shows the next run time.
- **D-32 (SC#10 axes for the run-start path).** Full native roster + OpenRouter, multi-tool,
  parallel-thread, long-message rows in VALIDATION.md; blocked rows recorded with reasons
  (Moonshot account suspended; OpenRouter credits, as of 292.1).
- **D-33 (plan count 4-5, G-8).** Suggested shape: (1) key storage + migration + auth dependency
  + limiter + audit; (2) start and status endpoints + input fencing; (3) origin stamping +
  backfill + the four origin lines + card next-run; (4) API keys tab + admin list + docs; (5)
  live proof + seed close-out.

### Claude's Discretion
- Key format (a recognisable prefix is suggested), hash choice, header name (`Authorization:
  Bearer` vs a dedicated header), endpoint paths, signed-link lifetime.
- Whether the origin is a column on `workflow_runs` or on `runs` (research reads both).
- The exact refusal sentences, following the house voice of existing refusals.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §"Phase 293" — goal, SC#1-6, failure modes, flags
- `.planning/REQUIREMENTS.md` — START-02, START-04, REG-06; line 7 lists the seeds folded at intake
- `.planning/seeds/SEED-195-n8n-fit-is-inbound-the-app-as-a-callable-surface.md` — the inbound surface, scoped credentials
- `.planning/seeds/SEED-014-automations-routines.md` — scheduled / triggered / last-run next-run
- `.planning/seeds/SEED-163-authoring-does-not-propose-the-business-requirement.md` — REG-06 flip (body records the owed sliver)
- `.planning/seeds/TEMPLATE.md` — status enum (no `delivered`)

### Security
- `docs/CONNECTOR-ARCHITECTURE.md` — MCP-first verdict; this phase is the inbound half, not SEED-013
- `backend/app/security/egress.py` — outbound rules (no outbound added here)
- `backend/app/security/secret_cipher.py` — reversible secrets; see D-19 for why a key is hashed instead
- `backend/app/api/setup.py` — the existing token-verify rate limit + constant-time compare pattern
- `backend/app/services/audit_service.py` — `write_audit_entry`, action-type CHECK sync

### Run start and schedules
- `backend/app/services/scheduler_service.py` — the unattended launch path to mirror (own thread, runs as owner, entitlement, `_schedule_id`)
- `backend/app/services/workflow_kickoff.py` — preflight and run context
- `backend/app/api/workflow_runs.py`, `backend/app/api/schedules.py`, `backend/app/db/schedules.py`, `backend/app/models/schedule.py`
- `.planning/phases/289-the-run-page-and-its-evidence/289-CONTEXT.md` — D-01..D-06 (evidence view, org access, 404 rule)
- `.planning/phases/287-start-from-a-thread-fork-a-starter/` — launch form required-field enforcement

### UI surfaces
- `frontend/src/pages/WorkflowRunPage.tsx`, `frontend/src/components/chat/RunCard.tsx`, `frontend/src/components/workflows/RunReceipt.tsx`, `frontend/src/components/workflows/history/RunLogPanel.tsx`
- `frontend/src/components/workflows/library/automationFacts.ts`, `WorkflowCard.tsx`, `frontend/src/components/workflows/WorkflowScheduleModal.tsx`
- `frontend/src/pages/SettingsPage.tsx`, `frontend/src/components/org/OrgAdminShell.tsx`
- `docs/HOT-FILE-LEDGER.md` — read each hot file's section before planning (G-5)

### Docs
- `scripts/build-public-openapi.cjs` — DESCRIPTION's "no API keys" sentence
- `docs/public/api/concepts/authentication.md`, `docs/public/api/guides/chat-from-a-script.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `launch_scheduled_run` (`scheduler_service.py`): the unattended start (own thread, owner identity, entitlement check, fill-step refusal). The inbound start should share it or its core, not copy it.
- `compute_next_run_at` + `next_run_at` on schedules: already the server's answer; the card only needs to render it.
- `automationFacts()` already receives `nextScheduleAt`; D-25 is a rendering change in that leaf.
- Redis (run buffers) is already a dependency; the limiter can use it.
- `write_audit_entry` + the Control Room audit browser.

### Established Patterns
- Owner-scoped reads; other org → 404, never 403 (289 D-05).
- Settings values live in `app_settings` with a UI control.
- Realtime is a hint, never truth (D-v2.5-03); polling is the contract here.
- Constant-time secret compare + 429 brute-force limit (`setup.py`).

### Integration Points
- New: key table (migration 215), an auth dependency for key calls, two endpoints, a Settings tab, an admin list, a ⋯ menu item.
- Changed: start paths stamp an origin; run read payloads carry it; four UI surfaces render one line.

</code_context>

<specifics>
## Specific Ideas

- Origin wording: "Started in the app by Sam" / "Started by schedule Every Monday 09:00" / "Started by key n8n-prod".
- Card wording: "Every Monday · next Mon 27 Oct, 09:00".
- The show-once screen carries ready `curl` lines for start and status with the workflow's fields filled in.

</specifics>

<deferred>
## Deferred Ideas

- **Callback URL on completion** — outbound egress (`egress.py`, SSRF rules); a later phase with its own threat model.
- **Start with "wait up to N seconds"** — convenience for short flows.
- **File uploads through a key** — size/type limits and storage writes via an outside caller.
- **Org service-account keys** — needs a defined knowledge scope for a non-person.
- **Per-org ceiling across all keys** — offered, not chosen; revisit if one org floods.
- **Answering a paused run through the API** — rejected for now: an outside system approving its own action defeats the approval.
- **SEED-367** (an open thread does not see a run started elsewhere) — related, own phase; its trigger is a phase adding polling/Realtime for runs.

### Reviewed (not folded)
- Open reported bugs: none overlap this phase's surfaces. `BUG-261020-03` (LangSmith traces carry provider keys) is security but observability, not the inbound door.
- Seeds sweep: 0 matched (no plans yet); re-run at `/gsd:plan-phase` once `files_modified` exists.

</deferred>

---

*Phase: 293-start-from-outside-and-close-out*
*Context gathered: 2026-10-24*
