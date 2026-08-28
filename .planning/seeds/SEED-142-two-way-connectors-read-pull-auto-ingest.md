---
id: SEED-142
title: Connectors must be TWO-WAY — read/pull from external systems inside a workflow, and auto-ingest from a connected drive; today every planned connector is send-only
status: open
planted: 2026-08-08
corrected: 2026-08-28 — four of the five auto-ingest blockers have since shipped; see the CORRECTION section
planted_by: Operator, immediately after the Phase 190 context lock (2026-08-08) — "of course we need to integrate with other applications through MCP or whatever and it should be a two way communication… we might connect with one drive that whenever there's a document it will auto ingest… also we need the ability to read write to pull something from Jira from email from Slack from anything"
surface: Agentic-RAG
severity: info
category: product / connector direction + ingestion policy
priority: high
scope: Large — spans a platform milestone (Open Platform, SEED-013) AND a standing product rule (manual-upload-only ingestion)
affected_areas: [connectors, workflow-canvas, harness-engine, external-action-node, ingestion, documents, knowledge-base, credentials, egress-guard]
related_seeds: [SEED-013, SEED-014, SEED-005, SEED-141]
re_open_trigger: >
  Re-open when ANY of these is true: (1) the Open Platform milestone (SEED-013 / SEED-014) gets a
  phase number on .planning/ROADMAP.md — this seed is a required input to its scope, not a follow-on;
  (2) a user or workflow author asks for a step that READS from an external system ("pull the ticket
  description", "find the last message in that channel", "check if that email arrived") and the only
  answer is "paste it in by hand"; (3) anyone proposes a 4th outbound capability for the Phase 190
  connector set — stop and ask whether the real need is a read, not another write; (4) a
  drive/cloud-storage sync is requested for the knowledge base, which fires the CLAUDE.md
  manual-upload-only rule below; (5) the app becomes an MCP CLIENT for any reason, since a read tool
  is the first thing an MCP server offers.
---

# SEED-142 — connectors are one-way today; the operator's direction is two-way

## The direction (operator, 2026-08-08)

Recorded verbatim, at the moment Phase 190's context was locked:

> "of course we need to integrate with other applications through MCP or whatever and it should be a
> two way communication… we might connect with one drive that whenever there's a document it will
> auto ingest, maybe during the workflow also… we need the ability to read write to pull something
> from Jira from email from Slack from anything. And also to send."

The operator explicitly did **not** ask for this inside Phase 190 ("I'm not forcing to have it in this
phase — I'm just asking where and when is the best place"). This seed is the *where and when*.

## The gap, measured

Everything planned or shipped on the connector track is **outbound-only**, and that is by
construction rather than oversight:

| Surface | Direction today | Source |
|---|---|---|
| Phase 189 `external_action` node | records an intended action, sends nothing | `docs/CONNECTOR-ARCHITECTURE.md` |
| Phase 190 capability set `{send_email, create_ticket, post_message}` | three **writes**, closed set, "no 4th capability in 190" | `190-CONTEXT.md` D-02 |
| SMTP / Jira `POST /issue` / Slack `chat.postMessage` | all three transports are send-only calls | `190-CONTEXT.md` D-02 |
| Knowledge-base ingestion | manual file upload only — "no connectors or automated pipelines" | `CLAUDE.md`, standing rule |
| Inbound webhooks, public API, service accounts, MCP client | explicitly out of Phase 190 | `190-CONTEXT.md` §Phase Boundary |

So there is no path today by which a workflow step **reads** anything from an external system, and no
path by which a document arrives in the KB without a human uploading it.

## The two halves — they are different problems and should not be planned as one

### Half 1 — READ inside a workflow (pull from Jira / email / Slack / anything)

A workflow step that fetches external data and feeds it to the next step. Shape-wise this is the
*mirror* of the Phase 190 adapter: same `ConnectorAdapter` protocol, same org-scoped Fernet
credential store, same egress guard — with a returned payload instead of a receipt.

What genuinely differs, and is the real cost:

- **The governance model inverts.** Phase 190's checkpoint exists because an outbound action is
  irreversible and visible to third parties. A read is reversible and invisible — but it pulls
  *untrusted external text into the model's context*, which is the prompt-injection surface. The
  185 action-risk checkpoint is the wrong instrument; a read needs provenance marking, not approval.
- **Auth gets harder.** Phase 190 ships static tokens, no OAuth (D-lock). Reading a user's mailbox or
  private Slack history is exactly where OAuth authorization-code flows, scopes and token refresh
  become unavoidable.
- **Read scope is a permission question.** "Pull from email" means *whose* email, and RLS does not
  reach into a third-party system. Cross-org leak precedents SEED-124 / mig 110 and SEED-125 /
  mig 112 apply with a new twist: the leak would be *inbound*.
- **It needs somewhere for the data to go.** SEED-141's deterministic utility nodes are the natural
  companion — a read with no field-map step in front of the next node just moves the problem.

### Half 2 — AUTO-INGEST from a connected drive (OneDrive / SharePoint / Google Drive)

"Whenever there's a document, it auto-ingests." This is **not** a workflow feature — it is a
standing background sync into the knowledge base, and it collides head-on with a standing project
rule:

> `CLAUDE.md`: *"Ingestion is manual file upload only — no connectors or automated pipelines."*

That rule is not wrong; it kept v1–v3 honest about a manual, inspectable ingestion path. But it is
now a **dated** constraint rather than a permanent one, and this seed is its re-open trigger. Whoever
schedules this must change the rule in `CLAUDE.md` in the same commit as the first sync connector —
never leave the rule standing while the code contradicts it.

What it drags in, none of which exists today: source-side change detection (delta/cursor or webhook),
per-file dedup and re-ingest-on-change semantics against the existing version model, a scheduler
(none exists — SEED-014 owns automations), ingestion-failure surfaces for documents nobody chose to
upload, and per-folder mapping from an external tree onto our folder model (cross-ref SEED-005).

## Where this belongs

**The Open Platform milestone (SEED-013 + SEED-014).** That milestone already owns the substrate both
halves need: service accounts, per-consumer auth, quotas, webhooks in both directions, and the MCP
story. Two-way is not a follow-on to it — it is an **input to its scope**, and SEED-013's own
consumer-mode list should be read as incomplete until this seed is folded in:

- SEED-013 lists three consumer modes, all of which are about *others calling us* (REST API in, us as
  MCP **server**, webhooks). **The mode this seed adds is us as MCP CLIENT — us calling out and
  reading back.** That is the fourth mode and it is currently unwritten anywhere.
- SEED-014 (Automations & Routines) owns the trigger/scheduler half that auto-ingest needs.

**Not Phase 190.** 190 is gated on `threats_open: 0` and its whole deliverable is the outbound
security envelope. Adding a read direction there means OAuth, token refresh, inbound provenance and a
scheduler inside a security phase — the exact capability-smuggling shape G-7 exists to stop. 190 also
*builds the prerequisites*: the credential store (`connector_connections`, mig 116), the egress guard,
and the `ConnectorAdapter` seam. Read adapters register through that same seam.

## What Phase 190 should NOT do differently because of this seed

Stated so a future planner does not "helpfully" widen 190:

- Do not generalise the `ConnectorAdapter` protocol for reads now. It is already MCP-shaped (named
  capability, JSON args, structured result, declared input schema) — that shape accommodates a read
  return value without being changed today.
- Do not add a 4th capability, an OAuth flow, or a scheduler to 190.
- Do keep `recorded_not_sent` and the armed checkpoint exactly as specified — a read-capable future
  does not retire either.

## The honest summary

The direction is recorded and it is binding on the Open Platform milestone's scope: **connectors are
two-way — the app both sends and pulls, and a connected drive can feed the knowledge base without a
human upload.** Nothing about that is buildable inside v3.6, and nothing in v3.6 blocks it.


---

## ROUTED 2026-08-24 — Connections & Open Platform milestone

Operator decision: *"open a connections milestone from SEED-146 instead of 206."* Phase 206
(Outbound Action Connectors) is RETIRED from the v3.8 roadmap; this seed is a source for the
milestone instead. Scope, the binding one-provider-many-capabilities constraint, and the open
questions: `.planning/CONNECTIONS-MILESTONE-CANDIDATE.md`.

Status stays `planted` deliberately — the milestone is a CANDIDATE, not opened. It opens after
v3.8 closes (204 running, 205 planned).

---

## ⚠ CORRECTION 2026-08-28 — FOUR OF THIS SEED'S FIVE BLOCKERS HAVE SINCE SHIPPED

**The original text above is preserved rather than edited, because the point is that it went stale
without anyone noticing.** It was written 2026-08-08, *before* v3.8 shipped and *before* v3.9 opened.
Re-measured against the tree on 2026-08-28, during the `SEED-224` document-space design
(`.planning/sketches/218-the-library-and-its-tabs/`, drive §E — every row below is an executable
assertion, not a claim):

| what Half 2 (auto-ingest) needs | this seed says | measured 2026-08-28 |
|---|---|---|
| a scheduler | *"a scheduler (none exists — SEED-014 owns automations)"* | ✅ **SHIPPED** — `backend/app/services/scheduler_service.py` + `workflow_schedules` (cron_expression, interval_seconds, timezone, is_active, per-run token + duration budgets) |
| OAuth | *"exactly where OAuth … become unavoidable"*, deferred to Open Platform | ✅ **IN THE ACTIVE MILESTONE** — v3.9 Phase **215 · BYO OAuth** (token / refresh / expiry / scope / account identity) |
| a read capability | *"no path today by which a workflow step reads anything"* | ✅ **SHIPPED (v3.8)** — MCP client, any official server, per-tool consent, **zero per-vendor adapter code** |
| per-tool permission | *"read scope is a permission question"* | ✅ **THE ACTIVE MILESTONE'S THESIS** — a connection is `{service identity, auth, discovered tools, per-tool grants}` |
| per-file dedup + re-ingest-on-change | *"none of which exists today"* | ✅ **SHIPPED** — `documents.content_hash` plus the `version_number` / `is_latest` model |
| a failure surface for documents nobody chose to upload | *"none of which exists today"* | ✅ **designed** — sketch 218's *Needs attention* list + the per-source state row |
| **source-side change detection (delta cursor / webhook)** | listed | ⛔ **STILL MISSING — the real remaining gap** |
| **external folder → our folder mapping** | listed | ⛔ still missing (net-new config) |

### ⚠ What this changes about this seed's verdict

Its closing line reads *"Nothing about that is buildable inside v3.6"* — true when written, and
**materially misleading now**. A planner reading this seed today would defer work whose substrate has
mostly already landed. **The remaining gap is change detection and folder mapping, not the platform.**

⚠ It also says *"Not Phase 190"* and routes both halves to the Open Platform milestone. **Half 1
(read inside a workflow) effectively arrived via the v3.8 MCP client**, which the seed could not have
anticipated. Half 2 is what is left, and it is now much smaller than described.

### ⚠ The standing rule this still fires, unchanged

`CLAUDE.md` continues to read *"Ingestion is manual file upload only — no connectors or automated
pipelines"*, marked **dated, not permanent**, with the explicit instruction that **whoever ships the
first sync connector changes that rule in the same commit**. That obligation is untouched by this
correction — it becomes *more* live, not less.

**Design already done:** the connected-source surface (sources list, first-read dry run with
content-hash dedupe, per-tool grants with write/delete off by default, polling language rather than
"instant", and a stopped-source state that names when it stopped) is drawn in sketch 218's
**sources** tab and fenced by 190 assertions.
