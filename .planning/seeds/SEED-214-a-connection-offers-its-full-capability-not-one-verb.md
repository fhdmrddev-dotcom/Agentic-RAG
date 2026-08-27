---
id: SEED-214
title: A connection offers the FULL capability the service publishes, not one hand-written verb — break the 1:1 lock between a connection and its single action
status: planted
planted: 2026-08-27
planted_by: Claude, 2026-08-27, from the operator's question at Phase 212's close — "each connection that we are going to have the full capability that it is offering, how to achieve this"
surface: Agentic-RAG
severity: major
category: product / connector architecture — the breadth dimension
priority: high
scope: >
  The UNLOCK is small and additive (one function, one writer, no retirement). FILLING the lists is
  open-ended and is deliberately a separate axis: MCP is free per action, a first-party adapter is
  real work per action, and an OpenAPI ingester is a build-once.
affected_areas: [connectors, backend/connectors, backend/harness, frontend/settings, workflows/steps]
related_seeds: [SEED-146, SEED-177, SEED-202, SEED-205, SEED-207]
related_bugs: [BUG-260827-02]
re_open_trigger: >
  ⚠ THE FIRST TRIGGER IS ALREADY TRUE AT PLANTING: Phase 213's SC#1 reads "a user sees every tool a
  connection offers in ONE LIST — a search and a create side by side — and switches each on or off
  independently", and that sentence is UNSATISFIABLE for slack / jira / smtp while each holds exactly
  one action. 213 either takes the unlock or ships a grant screen with a single row on three of the
  operator's connections. Also re-open when: (2) any first-party adapter gains a second action;
  (3) an MCP server is adopted for a service that today has a thin adapter (Phase 215 / OAuth makes
  Atlassian Rovo reachable); (4) a generic OpenAPI/REST tool ingester is proposed — this seed is its
  prerequisite, not its sibling.
---

# SEED-214 — a connection should offer everything the service does

## The operator's question, verbatim

> *"each tool that — or connection that — we are going to have the full capability that it is
> offering. How to achieve this?"*

Asked while driving Phase 212's connections surface and seeing **GitHub list 44 actions while Slack,
Jira and Email listed one each.**

## ⚠ The constraint, named — it is a schema lock, not a lazy adapter

`connector_connections.capability` is a **single `text` column** with
`CHECK (capability IN ('send_email','create_ticket','post_message'))` (migration 116). A first-party
connection therefore **structurally holds exactly one action**. There is nowhere to put a second.

That is the entire reason Slack shows one tool. It is not that the adapter is thin by neglect — the
row cannot express anything else.

**The MCP shape already escaped this lock, and that is the proof the fix is small.** Migration 126
made `capability` NULLABLE precisely so *"provider-shaped MCP connections are not restricted to the
legacy 3-action set"*. An MCP row has **no** capability and holds its actions in `discovered_tools`,
a `jsonb` array — which is how one GitHub row holds 44.

So **the mechanism for full capability already exists and already ships.** `discovered_tools` is it.
Capability rows only ever put one thing in it because of one line
(`backend/app/services/connectors/descriptors.py`):

```python
def static_descriptors_for_capability(capability: str) -> list[dict[str, Any]]:
    """One element, always."""
    return [descriptor_for(capability)]
```

⚠ **And `SEED-207` asked for exactly that**, in these words: *"present a native connection as a
connection with exactly ONE available tool."* That was the right call **for the goal it had** — it
made a legacy connection *presentable as a service* when it previously could not describe itself at
all. This seed does not overturn it; it takes the next step the same reasoning leads to. Recorded
here so the two are not read as contradicting each other.

## ⚠ And the correction the operator's question forced

A first answer to them claimed *"email is one action, permanently — SMTP is a wire protocol, not an
API."* **That is wrong and is kept here rather than quietly dropped.** SMTP-the-protocol only sends;
**Email-the-service reads too.** IMAP/JMAP publish list, search, fetch-thread, attachments and
folders. We implemented the send half and mistook it for the whole.

A realistic email connection is roughly:

| action | protocol | today |
|---|---|---|
| `send_email` | SMTP | ✅ shipped |
| `list_messages` · `search_messages` · `read_message` | IMAP / JMAP | ❌ never built |
| `list_folders` · `get_attachment` | IMAP / JMAP | ❌ never built |

**The lesson generalises past email:** *"this service only does one thing"* was in every case a
statement about **our adapter**, never about the service. Slack has dozens of operations; Jira has
an entire issue-tracking API.

## The unlock — one change, additive, nothing retires

> **Let a SERVICE map to MANY descriptors, written into `discovered_tools` exactly the way MCP does.**

- `capability` **stays** as the row's primary identity. No connection breaks, no workflow step bound
  to `post_message` breaks, the `CHECK` constraint is untouched.
- `service → [actions]` replaces `capability → [one action]` as what `discover_connection_tools`
  writes for the capability arm.
- Both shapes then present **identically**: *a service with N named actions.* Every downstream reader
  — the grant list, the step picker, the audit ledger — reads one field for everything and stops
  needing to know which shape produced it.

⚠ **The operator was explicit that they did NOT ask for a retirement**, and this is why the seed is
written as an unlock rather than a rebuild: *"I did not mean retire, to make any architectural risks
or changes."* Nothing is deleted. `EXTERNAL_ACTION_CAPABILITIES` grows or is bypassed for the list;
it is not emptied.

## Then the lists get filled — three routes, and the cost differs by an order of magnitude

| route | cost per action | fits |
|---|---|---|
| **An MCP server the vendor publishes** | **zero** — they did the work | GitHub (44 today), Notion, Atlassian Rovo, Linear, Sentry, Figma |
| **Grow a first-party adapter** | real: a wire call + `INPUT_SCHEMA` + tests, each | Email (SMTP send **+ IMAP reads**), and anything with no MCP server |
| **Generic OpenAPI / REST ingestion** | build once, then near-zero per service | the ONLY route that scales to a broad catalog — a build in its own right |

This is the `docs/CONNECTOR-ARCHITECTURE.md` **MCP-first, first-party-thin** verdict doing its job:
*thin* is correct for the adapters precisely because MCP is meant to carry the breadth. The defect
was never that the adapters are thin — it is that **nothing else was carrying the breadth for the
services those adapters cover.**

⚠ **Sequencing bite, measured:** Atlassian Rovo MCP is OAuth-only (confirmed directly — it is the
screenshot the operator extracted, and it authenticates by OAuth), and OAuth is **Phase 215**. So
moving Jira onto MCP is gated behind 215. GitHub worked at today's credential shape because a
personal access token sufficed. ⚠ **An official first-party Slack MCP server is NOT confirmed** —
asserted nowhere, and it must be verified before anything is planned around it.

## ⚠ HARD PREREQUISITE — do not ship the unlock before the grant gate closes

**`BUG-260827-02`: a capability connection bypasses the tool-grant gate entirely.** Gate 6
(`phase_types.py:2511`) is nested inside `if connection.mcp_server_url:`, so `tool_grants` is
enforced for MCP rows only.

Today that is survivable *because of this very lock*: a capability connection holds one action, so
"grant the connection" and "grant the action" coincide. **The moment a connection can hold many
actions, an ungated capability row means every action it holds is armed by the connection merely
existing.**

> **The unlock and the gate must land together, and the gate must land first if they are split.**
> This is the standing rule — *never an outbound capability before the approval model exists* — read
> from the other side.

## Suggested routing

**Fold the UNLOCK into Phase 213**, and keep the FILLING as separate follow-on work.

Reasons, in order of weight:

1. **213's SC#1 is unsatisfiable without it** (see `re_open_trigger` — the trigger is already true).
2. **213 already owns the migration** that turns `tool_grants` from `dict[str, bool]` into a posture,
   and already owns the detail screen the list lives on. Doing the unlock there costs a function and
   a writer; doing it anywhere else duplicates 213's own work.
3. **213 is where `BUG-260827-02` closes** (GRANT-04), which is the unlock's hard prerequisite. Same
   phase, correct order, one review.
4. ⚠ **G-1 / G-5**: 213 is already flagged as *the second consecutive phase* on
   `ConnectionFormPanel.tsx` / `ConnectionsTab.tsx` with the instruction *"if Phase 212 did not take
   the seam, this phase must."* Adding the unlock does not add a third pass — it is the same pass.

**Explicitly NOT in 213:** growing any adapter's action set, adopting any new MCP server, and the
OpenAPI ingester. Those are per-service work that must follow the approval model, never accompany it.

## Why this is worth a seed and not just a phase note

The **filling** axis outlives 213 by several phases and has no natural home: it is a standing product
posture (*"a connection offers what the service offers"*), a per-service backlog, and a build
decision (the OpenAPI ingester) all at once. A phase note would be archived with 213 and the posture
would be lost — which is the failure mode `.planning/seeds/` exists to prevent, and which
`reference_seeds_register_swept_by_nothing` records happening before.
