---
seed_id: SEED-144
title: Outbound connections should be PROVIDER-shaped, not ACTION-shaped — one Slack/Google/Jira account, many capabilities, OAuth not pasted tokens
created: 2026-08-10
planted_during: Phase 190 UAT preparation (operator observation)
status: planted
priority: high
relates_to:
  - SEED-013 (External Integrations — public API, MCP, webhooks, service accounts) — the INBOUND twin. SEED-013 is "others call US"; this seed is "WE call others". They are frequently conflated because both say "integrations", and `docs/CONNECTOR-ARCHITECTURE.md` defers breadth to SEED-013's Open Platform milestone — which does NOT actually cover the outbound connection shape. That conflation is why this gap survived Phase 190's whole discuss→plan→execute chain.
  - SEED-142 (connected-drive auto-ingest — OneDrive / SharePoint / Google Drive) — SAME PROBLEM, other direction. A "connect Google Drive" connection and a "send Gmail" connection are the same Google account. If SEED-142 lands on a separate credential store, the user connects Google TWICE. These two seeds must share one provider-connection model or they will fight.
  - SEED-014 (Automations / Routines) — an automation firing an outbound action needs a connection that outlives the authoring session; refresh-token handling is this seed's, not SEED-014's.
trigger_when:
  - A SECOND capability is wanted for a provider already connected (e.g. Slack `upload_file` or `read_channel` alongside `post_message`) — the moment the operator would have to paste the same token twice
  - Any request for Google / Microsoft / Outlook / Gmail / Drive / Teams connectivity — these are OAuth-only in practice; a pasted static token is not an option the vendor offers
  - A 4th capability is proposed (D-32 fenced this in Phase 190 — that fence expires with this seed)
  - Credential rotation is raised: today rotating one Slack token means editing N rows by hand
  - SEED-142 (connected-drive ingest) is picked up — do NOT let it build a second credential store
  - Any customer/partner asks "which apps do you integrate with?" — the answer's SHAPE is this seed
---

# SEED-144: Outbound connections are ACTION-shaped and should be PROVIDER-shaped

## The observation (operator, 2026-08-10, during Phase 190 UAT setup)

> *"Adding connections like this, only one action per app, is not the correct way. For any
> product I need a connection, it should be per provider, not per action. The connection
> should be 'add Slack', then inside Slack we configure the capabilities. Connect with Jira,
> connect with Microsoft Outlook, connect with Google."*

This is correct, and the schema proves it rather than merely suggesting it.

## What shipped in Phase 190, measured

`supabase/migrations/116_connector_connections.sql` puts **`capability` on the connection row**:

```sql
capability text NOT NULL CHECK (capability IN ('send_email','create_ticket','post_message')),
```

with the uniqueness key `(org_id, capability, name)` and a capability-scoped read index
(`idx_connector_connections_org_capability`), because the picker's read is always
`GET /connectors/connections?capability=…`.

**Consequence:** a connection IS an action. Wanting Slack to post a message *and* upload a
file means **two rows holding two copies of the same `xoxb-` token** — two things to rotate,
two things to revoke, two things to audit, and a Settings table that lists actions where the
user is thinking about accounts.

## Why this is not a Phase 190 defect

It was a deliberate, recorded scoping decision. D-32 explicitly fenced OAuth
authorization-code flow, service accounts, a broad catalog, and a 4th capability out of 190,
and D-02/D-03 chose static per-capability secrets to keep the first outbound slice thin. The
phase shipped what it said it would.

**What was NOT recorded is the trade-off itself** — that putting `capability` on the row is a
data-model commitment which costs a migration to undo, and that the industry-standard shape
(Zapier, n8n, Make, Retool, and every vendor's own docs) is provider-shaped. No decision
record weighed action-shaped against provider-shaped; the shape was inherited from the
"three thin capabilities" framing without ever being posed as a question.

## The target shape

| Today | Target |
|---|---|
| `connector_connections(capability, config, secret)` | `connector_accounts(provider, auth_kind, tokens…)` + `connector_grants(account_id, capability, config)` |
| One row per action | One account, many capabilities |
| Pasted static token | **OAuth authorization-code** for Google / Microsoft / Slack / Jira; static token only as a fallback |
| No refresh | Refresh-token rotation, expiry, re-consent |
| "Slack — post a message" | "Slack — Acme Corp workspace" → capabilities listed inside |
| Rotation = edit N rows | Rotation = re-auth once |

Provider identity (workspace name, account email, avatar) becomes a first-class fact — which
is also what makes the Settings table readable at 20 connections instead of a list of verbs.

## Migration cost from here — the honest estimate

Phase 190's outbound path is well-fenced, which makes this cheaper than it looks:

- **Cheap:** `egress.py` (the guard and both pinned transports) is capability-agnostic and
  survives untouched. The `ConnectorAdapter` protocol + registry (D-04/D-05) already separate
  "which adapter" from "which credential".
- **Moderate:** a migration splitting the table; `connector_service.resolve_connection` gains
  an account hop; `ConnectionPicker` lists accounts-then-capabilities; Settings → Connections
  regroups. `phase_types._exec_external_action`'s ordered gates are unaffected in ORDER, only
  in what the resolver returns.
- **Expensive and genuinely new:** the OAuth authorization-code flow — redirect URI, callback
  route, state/PKCE, per-provider app registration, refresh rotation, re-consent UX, and
  encrypted refresh tokens. **This is the real cost and it is a phase of its own.** Note D-32
  fenced it for exactly that reason.
- **⚠ Watch:** `workflow_definitions.definition` stores `connection_id` inside step configs
  (D-13). A split must either keep those ids stable or migrate every published definition —
  and published definitions are immutable versions. Decide this BEFORE the migration, not
  during it.

## ⚠ Related gap found in the same session: connectors can send TEXT ONLY

Measured 2026-08-10, during the first successful live Slack run. The workflow's `emit` phase
produced a real deliverable — `/weekly-status-report.docx`, 37,515 bytes — and **the connector
standing next to it could not attach it.**

- `post_message` INPUT_SCHEMA: `required: ["text"]`, exactly one property, and `send()` rejects
  unknown args (`unknown = set(args) - set(INPUT_SCHEMA["properties"])`).
- The same is true of `send_email` (no attachment) and `create_ticket` (no attachment).

So the single most natural use of this whole feature — *"run the report and send me the
file"* — is structurally impossible. Every capability is a text-only verb.

Each vendor treats attachments as a **separate API with a separate scope**, which is why this is
not a small addition and why D-32 fenced it:

| Capability | Attachment path | Extra scope |
|---|---|---|
| `post_message` | `files.getUploadURLExternal` + `completeUploadExternal` (NOT `chat.postMessage`) | `files:write` |
| `send_email` | MIME multipart — the message shape changes, not just a field | — |
| `create_ticket` | a SECOND call to `/rest/api/3/issue/{key}/attachments` after the issue exists | — |

**Design note for whoever picks this up:** attachment support argues for the same
account/grant split this seed proposes, because "can post" and "can upload files" are
**different OAuth scopes on one account** — which is precisely the distinction an
action-shaped connection cannot express. It also interacts with D-18 (at-most-once): a ticket
plus a failed attachment upload is a partial success with no retry, and the outcome vocabulary
(D-17) has no word for it today.

**Also relevant to ordering** (asked in the same session): nothing forces `emit` to be the last
phase — the only rules are `phase_index` contiguity and reachability. But the LAST phase's text
becomes the assistant message and the last phase with output "wins" as the deliverable
(`publish_service.py:901`), so a connector-last workflow reports *"Sent."* as its headline
output rather than the artefact. Worth a deliberate decision rather than a default.

> **↑ This seed is ONE DIMENSION of [`SEED-146`](SEED-146-integration-capability-surface.md)**,
> the umbrella map of the whole integration capability surface. Read 146 before scoping this
> one — the largest gap it names is that **every capability here is a WRITE and the app has no
> READ capability at all**, which changes what "first cut" should mean.

## Recommendation

Do **not** fold this into a gap-closure round on 190 (G-7 forbids a closure round adding a
capability, and this is a capability plus a data-model change). Scope it as its own phase or
small milestone, sequenced with **SEED-142** so Google is connected once rather than twice.

The cheapest honest interim, if a second Slack capability is wanted before this lands: allow
one connection row to declare MULTIPLE capabilities (`capability text[]` or a join table)
WITHOUT touching auth. That removes the duplicate-token problem — the sharpest edge — for one
migration and no OAuth work, and it is forward-compatible with the account/grant split above.
