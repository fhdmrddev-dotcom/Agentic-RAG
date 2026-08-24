---
seed_id: SEED-146
title: The FULL integration capability surface — reads as well as writes, triggers, payloads, auth, ops and catalog. The umbrella the other connector seeds hang from.
created: 2026-08-10
planted_during: Phase 190 live UAT (operator direction — "be comprehensive, don't cover one task per app and neglect every other capability")
status: planted
priority: high
relates_to:
  - SEED-144 (provider-shaped connections + OAuth) — the SHAPE dimension of this umbrella
  - SEED-145 (connections are platform assets, usable from chat) — the SURFACE dimension
  - SEED-142 (connected-drive auto-ingest — OneDrive / SharePoint / Google Drive) — the INGEST consumer; it is a READ integration, which is precisely the class this app has none of
  - SEED-013 (External Integrations — public API, MCP server, webhooks, service accounts) — the INBOUND twin (others calling us)
  - SEED-014 (Automations / Routines) — the TRIGGER consumer
  - D-190-DEF-17 (only 1 of 3 capabilities is drivable from a workflow) — the concrete blocker that exposed how thin the surface is
trigger_when:
  - Any request to READ from an external system ("what's the status of that ticket?", "summarise the last 20 messages in #ops", "pull the rows from that sheet") — this app can do NONE of it today
  - Scoping SEED-142, SEED-144, SEED-145 or SEED-014 — each is one dimension of this matrix and should be cut against it rather than in isolation
  - A second capability is wanted for any already-connected provider
  - Any "which apps do you integrate with?" conversation — the honest answer today is "three write verbs"
  - Before committing to the `connector_connections` table shape a second time — the migration cost compounds
---

# SEED-146: The full integration capability surface

## Why this seed exists

> *"When we say connection and integration with other applications we should be comprehensive
> to cover everything, not just a small thing where we do one task for one app and neglect all
> the other possible capabilities."* — operator, 2026-08-10, at the close of Phase 190's live UAT

SEED-144 and SEED-145 each capture one dimension (shape; surface). Phase 190 shipped a
deliberately thin slice and shipped it well. **This seed exists so the thinness is visible as a
MAP rather than as a series of separate surprises** — three of which turned up in a single
evening of UAT.

## The measured starting point (2026-08-10)

| Dimension | Today | Notes |
|---|---|---|
| Providers | **3** | SMTP · Jira Cloud · Slack |
| Capabilities | **3, all WRITES** | `send_email`, `create_ticket`, `post_message` |
| **Read capabilities** | **ZERO** | ⚠ see below — the largest single gap |
| Drivable from a workflow | **1 of 3** | D-190-DEF-17 — Jira and email cannot be run at all |
| Usable from chat | **0** | SEED-145 — `tool_dispatcher` has no connector reference |
| Payloads | **text only** | no attachments; the `.docx` a run produces cannot be sent |
| Auth | **static secret** | no OAuth, no refresh, no expiry handling |
| Capability set | **closed frozenset + SQL CHECK** | adding #4 touches ~41 files + a migration |
| Triggers | **none** | nothing external can start anything |
| Catalog / discovery | **none** | three hard-coded verbs |

## ⭐ THE BIGGEST GAP: everything is a WRITE

`send_email`, `create_ticket`, `post_message` — three verbs, all outbound mutations. There is no
capability to **read** anything from a connected system. Today this app cannot:

* read a Jira issue's status, or search issues by JQL
* read the last N messages of a Slack channel, or search them
* list channels, projects, folders, or mailboxes — even to help an author pick one
* fetch a row from a sheet, a record from a CRM, a file's metadata

**For a retrieval-augmented product this is the wrong half to have built first.** The app's whole
value proposition is answering from knowledge; a connector that can only *emit* cannot bring
anything back to reason over. SEED-142 (drive ingest) is blocked on exactly this class.

Reads are also **materially easier and safer** than writes: idempotent, reversible, no D-18
at-most-once problem, no approval checkpoint strictly required, and the SSRF/egress guard already
built covers them unchanged. **A read-capable connector is cheaper than the write path already
shipped** — and it is worth asking whether reads should have come first.

Note the governance asymmetry cuts the other way, and honestly: a read is safer *outbound* but
introduces **prompt-injection surface inbound** — content fetched from Slack or Jira lands in a
model's context. That is a real threat class this app has never faced and it must be designed for,
not discovered.

## The full matrix — the map this seed exists to make visible

**1 · Interaction patterns**
`write/create` (shipped) · **`read/fetch`** · **`search/query`** · `update` · `delete` ·
`list/enumerate` (needed just to populate author pickers) · `subscribe/stream`

**2 · Direction**
outbound (shipped, thin) · inbound webhooks (SEED-013) · bidirectional sync (SEED-142) ·
event triggers (SEED-014)

**3 · Surfaces** — see SEED-145
workflows (shipped) · chat threads · automations/schedules · ingestion · the public API

**4 · Payloads**
plain text (shipped) · **attachments/files** · rich formats (Slack blocks, Jira ADF, HTML mail) ·
structured records · templates

**5 · Auth** — see SEED-144
static token (shipped) · OAuth authorization-code + refresh + expiry + re-consent ·
service accounts · per-user delegated vs per-org app-level · **scope granularity** (a Slack
account that may post but not read is a different grant, not a different account)

**6 · Operational reality — none of this exists today**
rate limits + backoff · pagination · idempotency keys (D-18 forbids retries partly *because*
there are none) · vendor error taxonomies · webhook signature verification · credential
rotation/revocation · per-connection health + last-error · quota/cost visibility

**7 · Catalog & discovery** — the 50-integration question
searchable/browsable app catalog · per-app action lists · **input forms GENERATED from each
action's schema** (the adapters' `INPUT_SCHEMA` is already the right primitive, and D-190-DEF-17
is the proof it is needed) · MCP tool discovery, where a server advertises its own tools

**8 · Governance — per surface, per capability**
approval model (D-19's armed checkpoint is workflow-only) · read vs write risk grading ·
audit receipts (`harness_audit` is harness-scoped; a chat send needs a home) · kill switches ·
**prompt-injection handling for fetched content**

## What this seed is NOT asking for

Not "build all of it". Phase 190's thin slice was the right call and its security envelope —
org-scoped credentials, unconditional egress guard, DNS pinning, redirect refusal, the vendor
`ok:false` trap — is genuine, proven infrastructure that all of the above inherits unchanged.

What it asks is that the next connector milestone is **cut against this matrix** rather than
against whichever capability is nearest. Concretely: decide deliberately where each dimension
lands, and record the ones deferred, so the next evening of UAT surfaces no more "oh, that
whole class doesn't exist" moments.

## Recommended first cut, if this becomes a milestone

1. **Schema-driven input forms** — closes D-190-DEF-17, unblocks Jira + email, and is the same
   primitive a catalog needs. Highest value per unit of work by a wide margin.
2. **One READ capability**, end to end (e.g. Slack `conversations.history` or Jira issue-get) —
   proves the read path, the pagination shape, and forces the prompt-injection question early
   while the blast radius is one channel.
3. **Provider-shaped accounts + OAuth** (SEED-144) — before the connection count grows.
4. **Attachments** — the `.docx` problem, which is the most-requested thing a report workflow needs.
5. Chat surface (SEED-145), then triggers (SEED-014), then catalog breadth.

Reads before breadth; forms before both.


---

## ROUTED 2026-08-24 — Connections & Open Platform milestone

Operator decision: *"open a connections milestone from SEED-146 instead of 206."* Phase 206
(Outbound Action Connectors) is RETIRED from the v3.8 roadmap; this seed is a source for the
milestone instead. Scope, the binding one-provider-many-capabilities constraint, and the open
questions: `.planning/CONNECTIONS-MILESTONE-CANDIDATE.md`.

Status stays `planted` deliberately — the milestone is a CANDIDATE, not opened. It opens after
v3.8 closes (204 running, 205 planned).
