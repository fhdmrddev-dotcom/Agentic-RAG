---
seed_id: SEED-145
title: Connections are PLATFORM assets, not workflow assets — the agent should be able to call Slack / email / Jira from inside a chat thread
created: 2026-08-10
planted_during: Phase 190 UAT preparation (operator observation, same session as SEED-144)
status: planted
priority: high
relates_to:
  - SEED-144 (provider-shaped connections + OAuth) — THE SAME UNDERLYING CORRECTION, seen from a second angle. 144 says a connection belongs to a PROVIDER not an action; 145 says it belongs to the ORG not a surface. Both are "a connection is a platform asset". They should be scoped together; solving either alone leaves the model half-right.
  - SEED-013 (External Integrations — public API, MCP, webhooks) — the INBOUND twin; MCP-as-a-server lives there, MCP-as-a-client is discussed here
  - SEED-142 (connected-drive auto-ingest) — a third consumer of the same connection. Drive ingest, chat, and workflows are three surfaces over ONE Google account.
  - SEED-014 (Automations / Routines) — a fourth surface. Every surface added without a shared connection model multiplies the problem.
  - Phase 085 (`ask_user`) — the EXISTING chat pause/approval primitive this seed would build on
  - Phase 189 / 190 (governed external action node) — where the outbound governance model lives today, and why it does not transfer to chat for free
trigger_when:
  - Anyone asks "can the assistant email me this answer?" / "post this to the team channel?" / "open a ticket for this?" mid-conversation — the single most likely inbound request once connectors are visible in Settings
  - SEED-144 is picked up — decide the surface question BEFORE the table split, because the answer changes whether `connection_id` belongs on a workflow step config at all
  - SEED-142 (drive ingest) or SEED-014 (automations) is scoped — each adds a surface
  - A competitor comparison is run on "connectors" / "apps" / "integrations" — the industry shape is account-level, surface-agnostic
  - Any proposal to add an outbound capability to the chat tool registry — that proposal MUST answer the governance question in this seed first
---

# SEED-145: Connections are platform assets, not workflow assets

## The observation (operator, 2026-08-10)

> *"The integration with other applications is not specifically only linked to workflows.
> We should consider that we can link it to chats or threads. For example, in a thread add a
> connection, then when needed be able to call those APIs — from Slack, from email, from
> whatever application we're integrating with. To have the capability inside the thread to
> call external applications."*

## Measured state (2026-08-10, at Phase 190 close)

- `backend/app/services/tool_dispatcher.py` contains **zero** occurrences of `connector`,
  `external_action`, `send_email`, `create_ticket` or `post_message`.
- The chat agent has **18 tools**: `ls`, `tree`, `grep`, `glob`, `read_document`,
  `search_documents`, `query_documents`, `web_search`, `analyze_document`, `load_skill`,
  `save_skill`, `read_skill_file`, `execute_code`, `remember`, `recall`, `query_tables`,
  `workspace_write`, `workspace_read`, `workspace_list`, `workspace_delete`.
  **Not one of them reaches outside the application.**
- Connectors appear only under `services/harness/` (the workflow engine), `connector_service`
  and `services/connectors/`.

So today: a user who has connected Slack can use it in a *workflow* and nowhere else. The
assistant they actually talk to cannot touch it.

## Why this is the right direction

This is what the category does. Claude.ai exposes connectors (MCP) at the **account/org**
level and they become available inside any conversation; ChatGPT's apps/actions behave the
same way; so do Copilot extensions. **Nobody scopes a connected account to one surface**,
because users do not think "my Slack-for-workflows" — they think "my Slack".

It also compounds correctly with the surfaces already planned: chat, workflows,
automations (SEED-014), drive ingest (SEED-142). Four surfaces, one account.

## ⚠ THE HARD PART — and it is not the plumbing

**Every safety mechanism Phases 189 and 190 built for outbound actions is a CANVAS
construct, and none of it transfers to chat for free.**

- `action_risk_armed` — a property of a workflow *phase*, enforced in `harness/grounding.py`.
- **D-19: "the send happens AFTER the armed checkpoint"** — the checkpoint is a workflow-run
  pause; the harness executor owns no waiting.
- **D-16: the golden-run gate** — publishing a workflow must not send. Chat has no publish.
- The four run outcomes and `recorded_not_sent` — `workflow_phases` vocabulary.

A chat thread has **none** of these. Wiring `send_email` into `_TOOL_REGISTRY` as an
ordinary tool would let a streaming agent loop send mail on its own judgement, with no
approval, no arming, and no receipt — which is precisely the *"authenticated ≠ safe"* class
that CONN-03 SC#3 exists to close, reintroduced through a different door. **The egress guard
would still hold** (it is transport-level and surface-agnostic, which is the good news), but
"we only sent to allowed hosts" is not the same promise as "a human agreed to this send."

**The good news: chat already has the primitive.** Phase 085 shipped `ask_user` — a tool call
that PAUSES on Redis pub/sub (`ask_user:{run_id}:{tool_call_id}`) awaiting a human answer.
That is structurally the same shape as an armed checkpoint. A chat-side approval gate is an
adaptation of something shipped and tested, not a new invention.

## What the design must decide (open questions, not answers)

1. **Where does approval live per surface?** Workflow = armed checkpoint at author time.
   Chat = ? (per-send confirm · per-thread grant · per-connection "always ask" policy ·
   operator-set risk tiers). Probably a per-connection policy the user sets ONCE, since a
   confirm-on-every-send makes the feature unusable and confirm-never makes it unsafe.
2. **Does the adapter layer fork?** It must NOT. `ConnectorAdapter` + the registry + the
   pinned binders in `egress.py` are surface-agnostic by construction (D-04/D-05) and that is
   the asset to protect. What differs per surface is the GOVERNANCE wrapper above it.
3. **Does D-14 (no second runtime) bind?** Sharing adapters is not a second runtime — the
   agent loop and the harness engine already coexist. But an outbound call from the agent loop
   is genuinely new behaviour for that loop and should be reviewed against D-14 explicitly
   rather than assumed fine.
4. **MCP-as-client, revisited for chat.** D-01 refused an MCP client for workflows on a
   MEASURED ground: a remote MCP server makes the outbound call inside its own process, so
   CONN-03's unconditional egress guard is unprovable through it. **That reasoning is
   surface-independent and still applies** — but the trade-off may be judged differently for
   chat, where the ecosystem value of MCP is highest. Re-open it deliberately, with the same
   measurement, rather than letting "chat is different" become a loophole.
5. **Does `connection_id` still belong on a workflow step config (D-13)?** If connections are
   platform assets, the binding may want to live somewhere both surfaces can read. Decide this
   BEFORE SEED-144's table split, not after.
6. **Audit.** Migration 117 added `external_action_sent` to `harness_audit` — a
   HARNESS-scoped ledger. A send from chat needs a receipt too, and `harness_audit` may be the
   wrong home for it.

> **↑ This seed is ONE DIMENSION of [`SEED-146`](SEED-146-integration-capability-surface.md)**,
> the umbrella map of the whole integration capability surface. Read 146 before scoping this
> one — the largest gap it names is that **every capability here is a WRITE and the app has no
> READ capability at all**, which changes what "first cut" should mean.

## Recommendation

Treat SEED-144 and SEED-145 as **one milestone, not two phases**: "Connections as a platform
capability" — provider-shaped accounts, OAuth, and surface-agnostic capability exposure with
a per-surface governance model. Scoping them separately will produce a table split that then
has to be redone once chat is added.

**Do not wire any outbound capability into `_TOOL_REGISTRY` before the approval model is
decided.** That single change is the cheapest possible way to undo everything CONN-03 bought.
