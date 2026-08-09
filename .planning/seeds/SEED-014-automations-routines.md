---
seed_id: SEED-014
title: Automations & Routines — scheduled, triggered, and reactive agent runs
created: 2026-05-09
planted_during: v2.5 close-out
status: planted
priority: high
relates_to:
  - SEED-002 (Skill Studio Milestone Prep) — automations are scheduled or triggered SKILL runs; Skill Studio is the natural foundation. **Do not plan automations as a separate primitive — plan them as a runtime mode for skills.**
  - SEED-004 (Org / Department / Role) — automation availability mirrors skill availability (private / dept / org). SEED-004 item 5 already names "automations (whatever shape they take by then — likely scheduled or trigger-based skill runs) inherit the same availability model" — this seed is what that line refers to.
  - SEED-005 (Document Management Capabilities) — many high-value automations are document-lifecycle triggered: "new contract uploaded → run review skill → notify legal". The DM seed's lifecycle hooks (lock, version, retention) are natural automation triggers.
  - SEED-008 (Streaming UX Polish) — automation status surface (running / queued / failed / scheduled-next) needs UX consideration aligned with the streaming-feel work in 067.x
  - SEED-012 (Admin / Operator UI) — automation health, queue depth, retry policy, and per-automation observability live in the admin UI
  - SEED-013 (External Integrations) — webhook-triggered automations are the reactive mode of this seed; outgoing webhooks notify other apps when an automation completes
trigger_when:
  - First user request for "schedule this prompt" / "run this every Monday" / "alert me when X"
  - Skill Studio milestone (SEED-002) is in flight or complete — automations build on top of it
  - First B2B / enterprise customer asks about workflow automation, ETL, or document-lifecycle triggers
  - Competitive pressure from ChatGPT Tasks, Claude scheduled actions, Copilot Studio, n8n, or Glean Workflows
  - Planning a milestone scoped to "automation", "routines", "schedules", "workflow", "trigger", "reactive", "ETL", or "scheduled run"
  - First request for **confidence-gated escalation / human-in-the-loop (HITL)** — e.g. "when the agent isn't sure, send it to a human", "route low-confidence answers to a review queue", "auto-reply only when confident, else escalate". Especially via **n8n + customer-support ticket triage** (see `## Update 2026-05-31`); cross-ref SEED-013 for the API/MCP surface that exposes the answer+confidence the escalation gates on
---

# SEED-014: Automations & Routines

## The principle

> "Maybe creating automation and routines, how this could be shaped? what can we build on top of our app architecture and what is the best practices with other top-tier similar apps and what competitive advantage we should focus on to beat them?"
> — user, 2026-05-09

Today the app's only execution mode is **synchronous, user-initiated chat**. The user types, the agent responds, the conversation ends. Every other thing the agent could do for the user — checking a folder for new documents, summarizing yesterday's research, monitoring an RSS feed, watching for low-confidence retrievals — requires the user to remember to ask, type the prompt, and wait.

This seed proposes the third execution mode: **the agent acts on its own, on a schedule or in reaction to an event, against the user's KB and skills, and surfaces results in the chat history.**

## Three automation modes worth designing for

1. **Scheduled** — "every Monday at 9am, check the Legal/Contracts folder for documents added in the last week, run the contract-review skill on each, post a summary to my chat history."
2. **Triggered (reactive)** — "when a new document lands in folder X, extract metadata, classify against the document-type taxonomy, and notify the owner if it's a contract expiring within 30 days." Triggered automations need event hooks: `document.ingested`, `confidence.low`, `skill.executed`, `run.failed`, `feedback.thumbs-down`, etc.
3. **Long-running monitors** — "watch this RSS feed; for every new article, ingest it; when an ingested article scores >0.85 against my saved-interest embeddings, surface it in chat with a summary." Long-running monitors are scheduled triggers with a watermark / cursor.

The architectural surfaces involved are largely the same: a **trigger** (cron / event), an **action** (skill execution OR raw prompt), an **output** (chat insertion / notification / webhook), an **error policy** (retry / skip / alert), and an **observability surface** (last-run, next-run, failure count).

## Why the existing architecture is unusually well-suited

This is the part the user explicitly asked: "what can we build on top of our app architecture?"

**Existing pieces (already shipped) that compose into automation primitives:**

- **Skills system** — composable, persistent agent behaviors. Skills already accept inputs and return outputs; they are the natural unit of automation. *"Schedule a skill run"* is fundamentally simpler than *"schedule a freeform prompt"* because the skill defines the I/O contract.
- **Run-backed streaming (Phase 061+)** — `run:{run_id}` Redis Streams + `runs_by_thread:{tid}` ZSET + `runs:active` ZSET. Every agent execution is already a durable run with replay-and-tail. Automation runs piggyback on this — same lifecycle, same observability, same Resume affordance.
- **Per-LLM-call timeout machinery (Phase 066)** — `LLM_CALL_TIMEOUT_OVERRIDES` lets long-running automations cap individual LLM calls. Critical for unattended runs that mustn't drain budget on a stuck call.
- **Multi-provider LLM router (Phase 067.3 N-01)** — `MODEL_CAPABILITIES[model]['provider']`. Automations can route cheap-batch work to cheap models (Haiku, Kimi, MiniMax) and reserve expensive models for synthesis. This is a real cost lever.
- **Sandbox code execution** — automations can DO things end-to-end, not just "tell you what they would do". A "weekly competitor analysis" automation can scrape, analyze, build a chart, and post the result — all in one run.
- **Knowledge Health Dashboard data** — most-retrieved, never-retrieved, low-confidence, stale. These are *natural triggers* for automation: "every Friday, surface the 5 most-retrieved low-confidence documents and ask me to label them."
- **Audit log** — automations write to the audit log like any other run. Operator gets full traceability for free.
- **Realtime as best-effort hint** (D-v2.5-03) — Realtime can deliver "your scheduled automation just completed" notifications without becoming critical-path.

**The thing that genuinely doesn't exist yet:**
- A scheduler. Today nothing in the codebase is responsible for "wake up at time T and run thing X". Need either a cron-driven worker process (simple), Celery beat + worker (heavy), Postgres-backed job queue (e.g., `pg_cron` or a `scheduled_runs` table polled by the API), or BullMQ on Redis. Scoping this is the hard architectural decision in this seed.
- An event bus. Today there's no abstraction for "fire `document.ingested` and let any number of subscribers react". Phase 061's Redis Streams are per-run, not per-event-type. A general event bus on top of Redis Streams (or a dedicated `events:*` stream) would be the foundation.

## Competitive landscape & differentiation

Top-tier comparables and where the opportunity is:

- **ChatGPT Tasks** — scheduled prompts. No KB context, no skills, no code execution, no triggers (only schedules). Output goes to the conversation. Closed-source. Single-user.
- **Claude scheduled actions** *(emerging as of 2026)* — similar to ChatGPT Tasks. Closed.
- **Microsoft Copilot Studio + Power Automate** — agent + automation, but Microsoft-stack-locked, enterprise-heavy, slow to set up, expensive.
- **Glean Workflows** — RAG + automation, enterprise-only, closed-source, opaque pricing.
- **n8n / Zapier / Make.com** — generic automation, AI bolt-on, no native RAG / KB / skill system. The user has to assemble agent capabilities from primitives.
- **Airflow / Prefect / Dagster** — workflow orchestrators for data pipelines. Devs only. Not designed for AI-native flows.
- **AutoGPT / autonomous-agent frameworks** — autonomous, but weak on document grounding and don't have a clean "schedule + run" UX.

**Differentiation thesis:** the closed agent platforms (ChatGPT, Claude, Glean, Copilot) make scheduling trivial but lock you into their KB and their model. The open automation platforms (n8n, Zapier) lock you out of agent capabilities. The open AI frameworks (LangChain, AutoGPT) make you build the platform yourself.

Our position: *open-source, self-hostable, agentic automation with first-class KB grounding, persistent skills, multi-provider routing, and code execution — your data, your agent, your skills, your schedule, on your infra.*

The combination of:
1. Bring-your-own-LLM (Phase 067.3 multi-provider router)
2. Bring-your-own-data (self-hosted Supabase + your KB)
3. Bring-your-own-skills (Skill Studio, SEED-002)
4. Bring-your-own-trigger (this seed)
5. Bring-your-own-deploy (SEED-003)

is genuinely unique among open-source-AI products as of v2.5 ship.

## Scope (when triggered)

Suggested phasing:

### Phase 1: Scheduled skill runs (~2 weeks — minimum viable automation)

1. **`scheduled_runs` table** — `(id, user_id, skill_id, schedule_cron, inputs_json, last_run_at, next_run_at, status, error)`. Pairs naturally with SEED-004 by adding `org_id` / `dept_id` later.
2. **Scheduler worker** — a small Python process (separate from uvicorn) that polls `scheduled_runs` every minute, kicks off due runs, updates next_run_at. Scoping decision: in-process (simplest) vs separate process (cleaner). Recommend separate process — keeps uvicorn worker pool free of long-running tasks (parallels D-v2.5-02 single-worker rule).
3. **UI surface** — `/automations` page. List user's automations, "Run now" affordance, edit schedule, see last-run output, see next-run-at countdown. Pairs with SEED-012 (admin observability) for org-wide view.
4. **Output routing** — automation result lands in a designated thread (e.g., "Automations > Weekly Contract Review"). User sees results in chat history alongside their conversations.

### Phase 2: Event-triggered runs (~2 weeks)

1. **Event bus abstraction** — Redis Stream `events:*` per event type. Producers: ingestion pipeline (`document.ingested`), feedback (`feedback.thumbs-down`), runs (`run.failed`, `confidence.low`). Consumers: registered automation subscribers.
2. **`triggered_runs` table** — `(id, user_id, skill_id, event_type, filter_json, ...)`. Filter is a small JSON expression: `{"folder_id": "uuid", "document_type": "contract"}`.
3. **Subscriber worker** — same scheduler process, additional polling on event streams. Or split into a dedicated "automation runner" if scheduler grows.
4. **UI surface** — extend `/automations` page with event-trigger creation: event type picker + filter builder + skill picker.

### Phase 3: Long-running monitors + watermarks (~1.5 weeks)

1. **Watermark column** — `last_processed_cursor` per scheduled run. Lets a "watch this RSS feed" automation pick up where it left off.
2. **Idempotency** — automations declare an idempotency key per run (e.g., document URL hash) so retries don't double-process.
3. **Cancellation** — `runs.status = 'cancelled'` already exists from Phase 066 lifecycle work. Apply to automations: user can cancel a long-running monitor without restarting the worker.

### Phase 4: Cross-cutting observability + admin (~1 week, pairs with SEED-012)

1. Admin dashboard: "all automations across users" view, queue depth, error rate, average runtime per skill, cost per skill.
2. Per-automation alerting: "notify me if this automation fails N consecutive times".
3. LangSmith integration: each automation run has a LangSmith trace deep-link.

### Phase 5: Marketplace patterns (~1–2 weeks, optional)

1. Pre-built automation templates the user can clone: "Weekly contract review", "Monitor my RSS feeds", "Re-embed stale documents nightly".
2. Pairs with Skill Studio's marketplace direction (SEED-002).

## Architectural notes & risks

- **Scheduler choice is the hardest decision.** Options:
  - In-process `asyncio.create_task` + sleep — simplest, dies with uvicorn.
  - Separate Python process polling Postgres — clean, simple, scales OK for most installs.
  - `pg_cron` extension — lives in Postgres, no extra process, but harder to debug and limited expressiveness.
  - Celery / Dramatiq + Redis — battle-tested, heavy, adds a dependency.
  - BullMQ — Node-shaped, doesn't fit the Python backend.
  - Recommend the *separate Python process* path — minimal new tech, decoupled from web tier, easy to debug.
- **Multi-worker safety** — once SEED-001 (multi-worker uvicorn) lands, the scheduler must be single-instance OR use leader election to avoid duplicate runs. A separate process avoids this entirely.
- **Cost runaway** — a misconfigured automation that loops every minute against an expensive model can drain budget fast. Hard limits: max-runs-per-hour per automation; circuit breaker after N consecutive failures; admin-set per-org spend cap.
- **Permissions surface** — automations run unattended. They need their own auth model: "run as the user who created me" with the user's full permission set, or "run as a service account with explicit scopes" (cleaner; pairs with SEED-013).
- **Failure UX** — when an automation fails at 3am, the user finds out at 9am. Default to: log to audit log, attach to a "failed automation runs" queue surfaced on the dashboard, optional email / webhook on N consecutive failures.
- **Privacy / RLS sanity** — automations execute under their owner's RLS; they cannot escape the user's data scope. Test this before any cross-tenant work (pairs with SEED-004).

## Cost estimate

Full scope is a 5–7 phase milestone. Phase 1 (scheduled skill runs) is the minimum viable automation surface — about 2 weeks of focused work. Useful even without Phases 2–5, because scheduled runs alone unlock most of the high-value automations users will ask for first.

## Reference paths (current state, for future planner)

- `backend/app/api/skills.py` — skill catalog + execution; foundation for "skill as automation unit"
- `backend/app/api/runs.py` — run lifecycle; automation runs piggyback on this
- `backend/app/api/threads.py` — message persistence; automation output routing
- `backend/app/services/openai_service.py` — `LLM_CALL_TIMEOUT_OVERRIDES` machinery (Phase 066)
- Phase 061 RESEARCH / SUMMARY files — Redis Stream patterns reusable for `events:*` bus
- `frontend/src/pages/SkillsPage.tsx` — natural place for the "schedule this skill" entry point
- Memory: `project_target_scale.md` — scale-ready defaults; automation scheduler must respect "few to thousands of users"

## Differentiation in plain language (for product positioning)

The other agent products are *reactive chat surfaces*. The other automation products are *generic plumbing with AI bolted on*. Our app, with this seed shipped, becomes the open-source agentic platform where *your skills run themselves* — grounded in your KB, on the LLM you choose, with the persistence and observability of a serious system, on infra you own. None of the closed-source competitors can offer all five of those at once. None of the open-source competitors can offer the combined depth.

## Update 2026-05-31 — Target scenario: n8n + confidence-gated escalation + customer-support ticket triage with human-in-the-loop (HITL)

Surfaced during Phase 090 operator-testing-notes triage. This seed already names **n8n** in its competitive landscape and already lists **`confidence.low`** as a triggered-run event (see "Three automation modes" → Triggered, and Phase 2 event-bus producers). But the *closed-loop* pattern those two pieces add up to — **when the answer is unsatisfactory / confidence is low, route it to a human queue instead of acting on it** — was never spelled out as a concrete target scenario. This update spells it out so a future planner treats HITL escalation as a first-class flow, not an afterthought.

### The scenario (plain language): support-ticket triage with a human safety net

A company runs customer support on a ticketing tool. **n8n** sits in front and, for every new ticket, asks our app for an answer. Our app answers and — critically — hands back a **confidence verdict** alongside the answer (this is the SEED-013 public API/MCP surface; the field already exists today at `backend/app/models/message.py:25-27` as `confidence_level` / `confidence_avg_similarity` / `confidence_disclaimer`).

The automation then **gates on confidence**:

- **High confidence** → auto-draft (and optionally auto-send) the reply to the customer. Fully automated, no human touch.
- **Low confidence** (or a `confidence_disclaimer` is present, or the retrieval came back thin) → **DO NOT auto-reply.** Instead:
  1. Open / update a ticket in a **human review queue** with the agent's draft attached as a *suggestion*, not a sent reply.
  2. Notify the human agent (Slack / email / dashboard badge).
  3. Wait for the human to approve, edit, or reject — the **human-in-the-loop (HITL)** step.
  4. Optionally feed the human's correction back as a `feedback.thumbs-down` + corrected answer, which is itself a trigger this seed already lists (closing the learning loop — re-label / re-embed the gap so confidence improves next time).

This is the "agent acts on its own, but knows when to ask for help" pattern. The differentiator vs. closed competitors: the confidence number is *real* (grounded in retrieval similarity over the customer's own KB), the escalation policy is *operator-owned*, and the whole loop runs on infra the operator controls.

### Two ways to wire it — and which part is THIS seed

There are two architectural homes for the gating logic, and the planner should be explicit about which one a given milestone is building:

1. **External orchestration (n8n owns the branch).** Our app is a stateless "answer + confidence" endpoint; n8n reads the JSON and does the if/else (auto-reply vs. open-human-ticket) entirely in its own workflow. In this mode, **SEED-013 does all the app-side work** (expose the fields) and SEED-014 contributes *nothing new* — n8n is the automation engine. This is the cheapest path to the scenario and is likely the v3.3 deliverable.

2. **Internal reactive automation (our app owns the branch).** A `confidence.low` event fires on our own event bus (Phase 2 of this seed), a registered triggered-run reacts, and the escalation/ticketing action (open a review-queue item, notify, await approval) runs *inside our platform*. This is the SEED-014 / v3.4 deliverable — it requires the event bus + triggered_runs table + a "human approval" run state + an outgoing webhook/notification to the human. The HITL "await approval" step is a genuinely new run lifecycle state (a run that pauses pending a human decision) and should be scoped carefully.

**Plain-language split (mirrors SEED-013):** *SEED-013 hands back the confidence number; SEED-014 is what decides — inside our app — to escalate to a human when that number is low.* If the operator is happy letting n8n branch, they may never need the SEED-014 internal path for this specific scenario — but the HITL "await human approval" run state is reusable for many other reactive automations, so it earns its place in this seed.

### New architectural surface this scenario adds

Beyond what Phases 1–3 already cover, HITL escalation introduces:

- **A "pending human approval" run state** — a run that has produced a draft but is *suspended* waiting on a human verdict, then resumes (send / discard / edit-and-send). This is more than `cancelled`; it's a pause-and-await. Relates to the run lifecycle in `backend/app/api/runs.py` and the `runs.status` enum (Phase 066).
- **A human-review queue surface** — UI + data model for "drafts awaiting approval", with approve/edit/reject. Pairs with SEED-012 (admin/operator UI) and the `/automations` page.
- **An escalation/ticketing action type** — a new automation action that, instead of (or in addition to) posting to chat, creates an external ticket or an internal queue item. For external ticketing, the outgoing-webhook mechanism in SEED-013 Phase 3 is the delivery channel.

### Cross-refs

- **SEED-013 (External Integrations — API + MCP + Webhooks)** — owns the public surface that exposes `answer + confidence_* + scope + source_refs` (the inputs the gate reads) and the outgoing webhooks that deliver escalations. See SEED-013's matching `## Update 2026-05-31` section.
- **v3.3** — the public API/MCP schemas (SEED-013 Theme A) that make the *external-orchestration* path (n8n owns the branch) possible.
- **v3.4** — the *internal reactive automation* path (this seed): event bus + triggered runs + the pending-human-approval run state + human-review queue.
- Existing in-seed pieces this builds on: `confidence.low` triggered-run event (Phase 2 event-bus producers) and `feedback.thumbs-down` (the learning-loop close-out).

## Update 2026-07-31 — workflows are a missing trigger target, and the output-routing paragraph is RETRACTED

Surfaced during Phase 185 operator UAT (2026-07-30/31), mid-v3.6 Workflow Studio. Two changes to this
seed: one addition, one retraction. Neither is a new seed — both correct THIS seed's Phase 1.

### A. `workflow_id` must be a first-class trigger target alongside `skill_id`

**Verified: every schema this seed and its PRD propose is skill-keyed, with no workflow slot.**

- This seed, §Scope Phase 1 item 1, verbatim: *"**`scheduled_runs` table** — `(id, user_id, skill_id,
  schedule_cron, inputs_json, last_run_at, next_run_at, status, error)`."*
- `.planning/PRDs/v3.5-automations.md:42`, verbatim: *"New `scheduled_runs` table with cron-shaped trigger
  (`cron_expression text`, `timezone text`, `next_run_at timestamptz`, `last_run_at timestamptz`, `org_id
  uuid`, `owner_user_id uuid`, **`skill_id uuid` FK**, `inputs_json jsonb`, `status text`, `error text`)."*
- Same PRD line 50: `routine_definitions … action_skill_id uuid fk`; line 224: *"Routine action = Skill
  execution … `routine_definitions.action_skill_id uuid fk skills(id)`"*. The action unit is exclusively
  a skill, at every layer.
- This seed's own framing reinforces it (`relates_to` SEED-002): *"Do not plan automations as a separate
  primitive — plan them as a runtime mode for skills."* That was right in v2.5. It is now incomplete.

**Nothing has been built yet** — `grep -r scheduled_runs supabase/migrations/` returns zero hits; the only
occurrences repo-wide are this seed, the v3.5 PRD, and `MIGRATION-RESERVATIONS.md`. So this is a free
change today and an expensive migration later.

**Why workflows are now the better-shaped automation unit than skills.** Since this seed was planted,
`workflow_definitions` shipped (`supabase/migrations/056_workflow_definitions.sql`, versioned by a
`(slug, version)` unique constraint) and v3.6 is building the Studio on top of it. A published workflow
already has: a versioned definition, a phase spine, a lint/validate seam, an 8-stage publish gauntlet with
a judge hard-wall, and a run surface. A skill has an instruction body. For "every Monday, run the contract
obligation review," the workflow is the thing an operator would actually schedule.

**Shape when planned:** make the action a **discriminated target on ONE column pair** —
`action_kind text CHECK (action_kind IN ('skill','workflow'))` plus `action_skill_id` /
`action_workflow_definition_id` — not a second `scheduled_workflow_runs` table bolted on a milestone
later. Version-pinning applies to both (`routine_definitions.action_skill_version_id` per the PRD's
Q-v3.4-07 already has an exact workflow analog: pin `workflow_definitions.version` at routine publish).

### B. RETRACTED — Phase 1 item 4 "Output routing" (result lands in a designated chat thread)

**Status: SUPERSEDED-PENDING as of 2026-07-31. The text stays above for the audit trail. Do NOT build it
as written.**

The retracted text is §Scope Phase 1 item 4, verbatim: *"**Output routing** — automation result lands in a
designated thread (e.g., 'Automations > Weekly Contract Review'). User sees results in chat history
alongside their conversations."* The PRD's `output_thread_id` column
(`.planning/PRDs/v3.5-automations.md:45`, and AUTOM-SCHED-01 which *verifies* on it) inherits the same
retraction.

**Why.** The operator explicitly rejected workflow output being dumped into chat on 2026-07-31. This is
not a preference expressed in the abstract — it is a live defect the project is already paying to remove:
memory `project_workflow_runs_leak_into_chat` records that launching a workflow today creates a thread and
redirects into Chat, the fix is owned by **Phase 188**, and sketch 145 validates a dedicated run surface
with **no message list and no composer**. Built as written, this paragraph would re-create the exact leak
Phase 188 is deleting — on a brand-new code path, at automation scale, unattended. It deepens the problem
being fixed.

**What should replace it (decided by the automations phase, not settled here):** the routine's result is a
**run** on the workflow/run surface — the durable `runs` row + run-backed streaming this seed already
leans on (§Why the existing architecture is unusually well-suited) is the record. Delivery to a human is a
separate, explicit channel: Realtime as a best-effort hint (D-v2.5-03), an outgoing webhook (SEED-013
Phase 3), or a digest. Chat insertion, if it survives at all, is an **opt-in per-routine setting and never
the default**.

**Re-open condition for the retracted text:** only if Phase 188 ships the dedicated run surface AND the
operator subsequently asks for a chat mirror of routine results. Absent both, the paragraph stays dead.
