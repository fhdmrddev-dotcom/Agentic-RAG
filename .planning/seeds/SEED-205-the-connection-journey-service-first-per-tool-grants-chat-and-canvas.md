---
seed_id: SEED-205
title: "The connection JOURNEY, in the operator's own words: add a service → authenticate → see every tool it offers, read and write → grant each tool individually → then use it by NAME in chat, where the agent picks the tool, and as a SPECIFIC step on the canvas, never a generic one."
created: 2026-08-26
planted_during: conversation with the operator, 2026-08-26, while Gemini executed Phase 209 — unprompted, in answer to nothing
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-202 — WHAT a workflow should do (read + write across systems). This seed is the JOURNEY half.
  - SEED-204 — the three PATHS in (OAuth / MCP / plain API). This seed says what the path leads TO.
  - SEED-146 / SEED-145 — connections as platform assets, usable from chat
  - SEED-199 — the xyOps canvas grammar; connectors as glyph nodes
  - Phase 206.2 — per-tool grants, SHIPPED. Half of this seed already exists.
  - Phase 209 — "a step says what it actually does", the canvas half, in flight
  - .planning/CONNECTIONS-MILESTONE-CANDIDATE.md — the milestone this scopes into
  - screenshots/ — Claude.ai Connectors, the per-connector tool list with per-tool switches
trigger_when: >
  Before the Connections & Open Platform milestone is SCOPED. This seed ANSWERS the question the
  orientation map and the competitor study both left open and both called the one the direction
  rests on — "how does a person pick a service and an action without knowing what MCP is?" The
  operator answered it unprompted: they pick the SERVICE, not the protocol. Scope the milestone
  against SEED-202 (what) + SEED-204 (how we reach it) + THIS (what the person actually does).
---

# SEED-205 — the connection journey, in the operator's own words

## Recorded VERBATIM, 2026-08-26

> *"For the connection, how I imagine it: if I added a connection — suppose one tool, Xero, or
> let's say ClickUp — I add connection, I go to ClickUp, I authenticate, and then once we
> authenticate, under this connection I will click Xero or ClickUp, then it will show me all the
> available tools — read, write, whatever — and each tool I can do also the permission, similar
> to the screenshots in the screenshots folder of this project. This is how I imagine connection.
> And how to integrate in the chat: I can add in the chat Xero, then it will decide whichever
> tool it will use. And in the workflow it is the same. The step should be specific to that tool,
> not generic, and based on the available actions it will be integrated inside the workflow to
> complement it."*

## ⭐ WHY THIS SEED MATTERS MORE THAN ITS SIZE SUGGESTS

`.planning/ORIENTATION-260825-connections-and-canvas.md` closes with a section titled
**"The product decision nobody has made yet"**, and states that everything — the catalog, the
describe-to-build flow, the connector-as-glyph-node — waits behind one question:

> *"How does a person pick a service and an action without knowing what MCP is?"*

**The operator answered it above, unprompted.** The answer is: **they never pick a protocol at
all.** They pick a SERVICE by name, authenticate to it, and are then shown that service's own
tools. MCP is an implementation detail of how we reach ClickUp — it is not a thing the person
selects, names, or is filtered by. That reframing is the whole seed.

## Six claims, each checked against HEAD rather than assumed

| # | The operator's step | State at HEAD 2026-08-26 |
|---|---|---|
| 1 | "I add connection… I go to ClickUp, **I authenticate**" | ⛔ **NOT BUILT.** No OAuth anywhere. Connections carry static credentials. `SEED-204` — a gap to fill, never a boundary |
| 2 | "under this connection I will click ClickUp" | ⛔ **NOT BUILT.** There is no service-first object. A connection is created by PASTING AN MCP SERVER URL |
| 3 | "it will show me all the available tools — read, write, whatever" | ✅ **SHIPPED (206.2).** `discoverConnectorTools` → live `tools/list`. ⚠ But READ vs WRITE is invisible: `mcp_client.py:279-296` DROPS `annotations`, so `readOnlyHint` never reaches us — the Phase 209 SC#2 problem |
| 4 | "each tool I can do also the permission" | ✅ **SHIPPED (206.2).** `tool_grants: dict[str, bool]`, `McpToolPicker`, a MISSING KEY DENIES. Driven live: grant OFF ⇒ `tool_refused`; ON ⇒ real data |
| 5 | "in the chat I can add ClickUp, then **it will decide** whichever tool it will use" | ⛔ **NOT BUILT, and structurally so.** `tool_dispatcher._TOOL_REGISTRY` holds **20 tools and ZERO connector tools**. Chat cannot reach any connection |
| 6 | "in the workflow… the step should be **specific to that tool**, not generic" | 🔄 **PHASE 209, IN FLIGHT** — exactly its item 1 |

**So the journey is roughly half built, and the built half is the half people usually get wrong.**
Per-tool consent already ships and already fails closed. What is missing is the FRONT (a service,
authenticated) and the REACH (chat).

## ⚠ The prerequisite that is not negotiable

`CLAUDE.md` and `SEED-146` carry a standing rule: **never add an outbound capability to
`_TOOL_REGISTRY` before the approval model exists. Every capability is a WRITE.** Claim 5 —
"in the chat I can add ClickUp and it will decide" — is precisely that addition, and it hands
tool CHOICE to the model on a live connection.

The operator's own claim 4 is the mitigation, and it already exists: per-tool grants, default
deny. So the sequencing that satisfies both is:

> **Per-tool grants gate the chat surface exactly as they gate the canvas step** — the same
> `tool_grants` map, the same missing-key-denies rule, the same `tool_refused`. Chat does not get
> a second, weaker consent model. Anything beyond a granted read needs the approval checkpoint
> (Phase 185 vocabulary), not a new one invented for chat.

## What this does NOT decide

- Whether "add ClickUp in chat" is an `@`-mention, a slash command, or a picker — a design
  question, and G-2 says sketch it against the `screenshots/` Claude.ai reference.
- Whether the catalog is curated (a "famous applications" list) or open (paste anything).
  `SEED-204` path 3 (a plain API) and `SEED-186/187/188` (community catalog scale) both bear on it.
- The service MARK for an arbitrary service. `connectionMark.tsx` is total and falls back to a
  NAMED neutral; a catalog of hundreds needs an answer better than "everything is a plug", and the
  icon convention forbids drawing one by hand.

---

## ⚠ AMENDMENT, 2026-08-26 — THE NAMED SERVICES WERE EXAMPLES. THE REQUIREMENT IS GENERIC.

Recorded verbatim, immediately after the above:

> *"I said ClickUp or Jira or anything else as example — this should be GENERIC. Any connection
> that is supported should be added and naturally digest it into the chat or the workflow. So to
> sum it up: I need it as per Claude.ai exactly, but also synthesizing it to our application and
> the research you did before."*

**Read this as a fence against the obvious wrong build:** a per-vendor ClickUp integration, then a
per-vendor Jira one. That is the shape Phase 206 already refused for MCP ("no per-vendor code"),
and it must survive contact with OAuth and with a catalog.

### The research already agrees, and states our bug more precisely than we did

`.planning/research/connections-competitor-study.md` §Q2 surveyed seven products. **The unit is a
SERVICE, universally**, containing a two-level tree (Zapier *App* → triggers/creates/searches;
n8n *Node* → resources × operations; Claude.ai *Connector* → per-tool list with per-tool
permission). And:

> ⭐ *"The closest thing anyone has to our `capability` is Make's module SUBTYPE — and it is an
> ATTRIBUTE OF A MODULE INSIDE AN APP, never the axis you browse by. That is our bug stated
> precisely: **we promoted an attribute to be the browse axis.**"*

⚠ **Not one of the seven filters by what a connector can DO.** All three catalogs use the same
controls: **free-text search · filter by STATE · sort**. That is why Phase 209 item 3 is right to
kill the verb chips rather than add a fourth.

### ⚠ MEASURED BLOCKER — the table can represent exactly TWO shapes, and generic needs at least FOUR

Migration 116 pinned `capability text NOT NULL CHECK (capability IN ('send_email','create_ticket',
'post_message'))`. Migration 126 relaxed it — `capability` is now NULLABLE — but added:

```sql
CHECK (capability IS NOT NULL OR mcp_server_url IS NOT NULL)
```

So a row must be **either** a legacy capability **or** an MCP server. **An OAuth-authenticated
service with neither would be REFUSED BY THE DATABASE**, and so would a plain-API connection
(`SEED-204` path 3). The generic vision is blocked at the schema, not merely at the UI — and that
blocker is invisible from the frontend, which is where Phase 209 is working. **A migration is
owed before path 1 or path 3 can store a single row.**

### ⚠ AND "GENERIC" IS NOT FREE IN THE SAME WAY TWICE — the honest split

| Layer | Generic? |
|---|---|
| **MCP reach** | ✅ **Free.** Proven at Phase 206 — zero per-vendor code, any server with `tools/list` |
| **Per-tool grants** | ✅ **Free.** `tool_grants` is a string→bool map; it never knew the vendor |
| **The MECHANISM of OAuth** | ✅ generic — one authorization-code + refresh implementation serves every provider |
| **The REGISTRATION for OAuth** | ⛔ **PER VENDOR, unavoidably.** Someone registers an OAuth app, per provider, and holds its client id/secret and scopes |
| **The service MARK + catalog entry** | ⛔ per vendor — and `connectionMark.tsx` currently maps THREE, falling back to a named neutral |

⭐ **The study's Q2 headline is the decision hiding inside "exactly like Claude.ai":** getting to a
working Slack connection is **2 steps on Claude.ai** and **≥ 8 self-hosted on n8n** — *"the same
protocol. The entire difference is who registered the OAuth application."* Claude.ai is 2 steps
because **Anthropic registered it once, for everyone.**

> **So "as per Claude.ai exactly" is a request to become the OAuth app owner for every service we
> ship.** That is a product and business commitment — per-provider registration, secret custody,
> scope review, and a review process with each vendor — not an engineering task. It is the single
> largest decision in the Connections milestone and it is NOT YET MADE.
>
> The alternative, which the study also documents, is the self-hosted shape: the OPERATOR supplies
> the OAuth client per instance. Cheaper for us, 8 steps for them. **A middle path exists — we own
> the apps for a curated popular set, and a paste-your-own door covers the tail** — and that is the
> `curated set + paste-a-URL` pattern both Claude.ai screenshots actually show.

### What this amendment does NOT change

Everything in the six-claim table above still stands. This narrows HOW, not WHAT: **one connection
object, service-shaped, consumed identically by chat and by the canvas** — and no vendor's name
appearing in a code path anywhere.
