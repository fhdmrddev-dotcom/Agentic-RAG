---
type: milestone-candidate
name: Connections & Open Platform
created: 2026-08-24
decided_by: operator, 2026-08-24 — "open a connections milestone from SEED-146 instead of 206"
supersedes: Phase 206 (Outbound Action Connectors) in the v3.8 roadmap
status: candidate — NOT yet opened; v3.8 (204, 205) must close first
source_seeds: [SEED-146, SEED-144, SEED-145, SEED-142, SEED-013, SEED-014]
deliberately_excluded_seeds: [SEED-193, SEED-194]
---

# Connections & Open Platform — milestone candidate

**The operator's direction (2026-08-24):** integrate with *as many famous applications as we can* —
not only Jira. Email, Microsoft, ClickUp, Google products, and the providers a competitor would
list. It must be **very simple** to use. Connectors include **MCP and API**. The model should be
able to **call an external API from chat** and decide to do so itself.

## Why Phase 206 was retired rather than executed

Phase 206 (CONN-02 / CONN-03) would have delivered two more **write** verbs (Jira, SMTP) drivable
from a workflow node, plus org-level credential storage. Measured against the direction above it
misses on four axes at once, and every one of them is structural rather than a matter of scope:

| Axis | Phase 206 | The direction |
|---|---|---|
| Read from an external system | **zero** | "read/pull from Jira, email, Slack, anything" (SEED-142) |
| Usable from chat | **no** — workflow nodes only | "call an external API in the chat, the model decides" |
| Auth | static pasted secret | OAuth — **the only option Google/Microsoft offer** (SEED-144) |
| MCP | none in the backend | MCP-first is the *recorded* verdict with no code behind it |

Shipping 206 would also **commit the `connector_connections` table shape a second time**, which
SEED-146 names as an explicit trigger to stop: the migration cost compounds.

## THE ONE ARCHITECTURAL CONSTRAINT THAT BINDS THE WHOLE MILESTONE

From SEED-144, and it is the reason these seeds cannot be cut separately:

> A "connect Google Drive" connection and a "send Gmail" connection are **the same Google account.**

Today's model is ACTION-shaped: one row per capability, one pasted secret per row. If drive
auto-ingest (SEED-142) lands on its own credential store while chat (SEED-145) lands on another,
**the user connects Google three times.**

**So: one PROVIDER-shaped connection, many capabilities, many surfaces.** The user connects Google
*once*; drive ingest, chat, and workflows are three consumers of that one connection. Getting this
wrong is not a polish issue — it is a migration.

## Scope

### 1. Connection model — the foundation everything else depends on
- Provider-shaped connections replacing the action-shaped `connector_connections` rows
- **OAuth** with refresh-token and expiry handling, not pasted static secrets
- Org-level platform assets in Settings, encrypted at rest, cross-tenant isolated (this is CONN-03,
  carried forward from 206 — the one part of 206 that survives intact)
- One connection, N capabilities — adding capability #4 must not touch ~41 files and a migration

### 2. Reads, not just writes — the largest single gap
Today: 3 capabilities, **all writes, zero reads.** The app cannot read a Jira issue's status, search
by JQL, read the last N messages of a Slack channel, or list channels / projects / mailboxes — not
even to help an author pick one from a dropdown.

### 3. Breadth — the "famous applications" set

**The initial list, deliberately expandable.** Sequenced by **auth family**, because the OAuth app is
what actually costs — once Google is connected, Gmail / Drive / Calendar / Sheets are four
capabilities on one connection, not four integrations.

| Tier | Provider | Capabilities wanted | Why this tier |
|---|---|---|---|
| **1** | **Google** | Gmail, Drive, Calendar, Sheets | One OAuth app, four surfaces. Also the SEED-142 drive-ingest consumer |
| **1** | **Microsoft** | Outlook, OneDrive, SharePoint, Teams | One OAuth app (Graph). ⚠ Operator-named and **absent from the competitor's own catalog** — a differentiator, not a catch-up |
| **1** | **Atlassian** | Jira, Confluence — create/update/get issue, JQL + CQL search | **Ships an official MCP server** (`https://mcp.atlassian.com/v1/mcp`) — we write no adapter |
| **1** | **Slack** | post, read channel, search, list channels | Already half-built (the one capability that works today) |
| **2** | **ClickUp** | tasks, lists, docs | Operator-named |
| **2** | **GitHub** | issues, PRs, code search | **Ships an official MCP server** |
| **2** | **Notion / Linear** | pages, issues | Common in the same buyer's stack |
| **3** | **HubSpot / Salesforce** | CRM records | B2B org-scale (SEED target scale) |
| **3** | **Figma** | file/comment read | Design-adjacent; low cost via MCP |
| **any** | **Generic SMTP / IMAP** | send / read mail | The escape hatch for everything unlisted |
| **any** | **Custom MCP URL** | whatever that server exposes | ⭐ **This is what makes the list expandable without us shipping code** |

⭐ **THE EXPANDABILITY ANSWER IS "CUSTOM MCP URL", AND IT IS NOT A COMPROMISE.** The competitor's own
catalog (screenshots, 2026-08-24) shows a `Type: Web` column with a **`Custom`** badge on exactly the
entries that are pasted MCP endpoints — Atlassian Rovo and GitHub_MCP among them. So the pattern is:
a curated Popular set for the common cases, **plus a paste-a-URL door** for the long tail. The user
adds a provider we have never heard of and it works. That is how the list stays expandable and
flexible without a per-vendor adapter treadmill, and it is the concrete cash-out of the MCP-first
verdict this repo recorded a month ago and never implemented.

### 4. MCP — both directions
- **MCP client** — this app consumes MCP servers, which is how breadth arrives without hand-writing
  every vendor adapter. **No MCP client exists in the backend today.** The MCP-first verdict in
  `docs/CONNECTOR-ARCHITECTURE.md` is a decision with no implementation behind it.
- **MCP server** — this app callable *by* Claude Desktop / Cursor / Cline (SEED-013)
- `backend/tests/test_189_no_egress.py` **fails on any MCP identifier in `backend/app`** — that
  fence must be consciously retired in the same commit that adds the client, never worked around.

### 5. Surfaces — connections are platform assets
The same connection usable from **chat**, **workflows**, and **ingestion**. Chat is the one that
does not come for free: Phase 189/190's outbound governance lives on the workflow canvas and does
**not** transfer to chat.

### 6. The approval model is a HARD PREREQUISITE, not a feature
**Every connector capability today is a write.** The standing rule, already on record: *never add an
outbound capability to `_TOOL_REGISTRY` before the approval model exists.* Otherwise the chat agent
can send an email or create a ticket with nobody confirming it. Phase 085's `ask_user` is the
existing pause/approve primitive to build on.

⭐ **THE SHAPE IS SETTLED BY EVIDENCE — the competitor's connector detail screen (screenshot,
2026-08-24) is exactly this control and we should copy its grain:**

- A **per-tool** list, not a per-connector switch — Atlassian Rovo shows its 7 tools individually:
  *Create issue · Update issue · Get issue · Retrieve Confluence page · Search Confluence with CQL ·
  Search with JQL*.
- A connector-level default dropdown reading **"Needs approval"**, with the caption *"Choose when
  Claude is allowed to use these tools."*
- Reads and writes sit in the **same** list, which is what lets a user grant search freely and hold
  `Create issue` behind a confirm. **A connector-level toggle cannot express that**, and a
  connector-level toggle is what we would have built by default.

**Consequence for the connection model (§1):** the capability record must be per-tool from the start,
because retrofitting per-tool permissions onto a per-connector grant is a migration.

### 6b. Per-connector prompt suggestions — small, cheap, and the onboarding answer
The same screen carries starter chips (*"Show what's on my plate"*, *"Find my stuck issues"*, *"Write
my status update"*). A freshly connected system is otherwise a capability with no visible way in.
This is a few strings per connector and it is how "very simple" gets delivered concretely rather than
aspired to. It is also the same affordance SEED-198's Experts need, so build it once.

### 6c. Catalog IA, taken from the same screenshots
A **Popular** row of 3 one-click connects · an **All / Connected / Not connected** filter · a table of
*Connector · Type · Status* · an **Add** menu carrying the custom-MCP-URL door. Recorded so the
milestone does not re-derive an information architecture that has already been shown to work.

Also carried forward from the architecture verdict: **no arbitrary-code / community-node connector,
ever.** That is a supply-chain surface, excluded by construction rather than by omission.

### 7. Inbound (Open Platform, SEED-013) — may split into its own milestone
Public REST API, webhooks, service accounts, per-org quotas. Sequence after the outbound model; it
amplifies concurrent load (SEED-001).

## Deliberately NOT in this milestone

**SEED-193 (A2UI / agent-authored interactive artifacts) and SEED-194 (image generation).** The
operator named both in the same conversation, so this section records that they were considered and
separated on purpose.

They are a different milestone: connections are about **reaching other systems**; artifacts are
about **what the agent produces**. An image the model generates is not a connector. SEED-193's own
`trigger_when` already says *"milestone-shaped, not phase-shaped"* and asks to be re-opened as a
candidate milestone theme in its own right.

**The one genuine seam** — *"call an external API in chat, the model decides, it generates an image
and puts it in the artifact"* — crosses both. It is an ARTIFACT concern that needs a connection.
Sequence: Connections first (the call), Artifacts second (the render). Building the render first
gets a one-off image card, which SEED-194 explicitly warns *pre-empts SEED-193 with a worse version
of itself*.

**SEED-194's blocker is not the render.** `ModelCapability` (`backend/app/config.py:151`) is
entirely chat-shaped and has **no modality dimension**, so any image model id resolves
`capability_source=inferred` and silently loses its capabilities. That is model-registry work,
unrelated to connectors.

**SEED-198 (Experts) — adjacent, and it DEPENDS on this milestone rather than belonging to it.**
An Expert (Financial Analyzer, Strategy Writer) is a bundle of skills + connections + knowledge
scope + prompt suggestions. It needs the connection model to exist first, or it is a prompt pack.
Two things it shares with this milestone, so they are built once and not twice: the **per-tool
permission grain** (§6) and the **prompt-suggestion chips** (§6b).

## Sequencing

1. Close v3.8 — **204** (running) and **205**. Drop 206.
2. Open **Connections & Open Platform**: connection model + OAuth → reads → breadth by auth family →
   MCP client → chat surface behind the approval model.
3. Then **Artifacts** (SEED-193 + 194 + data-formulator). SEED-193 notes an artifact worth building
   is worth linking to, and **this app has no URL router** (SEED-185) — sequence after it, or accept
   that artifacts cannot be shared.

## Open questions for the operator at `/gsd:new-milestone`

1. **Does inbound (public API / MCP server) belong here, or in its own milestone?** Both are "Open
   Platform"; together they are large.
2. **How many providers in the first cut?** Recommendation: Google + Microsoft first — they unlock
   the most surface per OAuth app, and they are the two where pasted tokens are not offered at all.
3. **Does chat-side outbound ship in this milestone or wait?** It needs the approval model, which is
   real work in its own right.
