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

### 4b. ⭐ THE CANVAS SURFACE — a connector is a NODE YOU DROP, not a form field

Operator, 2026-08-24, on the xyOps editor: *"the visual representation of this workflow is exactly
how I imagined it… this is exactly what I am concerned about especially with the connectors."*

xyOps puts `Send Email`, `Web Hook Discord` and `Create Ticket` on the canvas as **glyph nodes**
hanging off edge outcomes — a second, smaller node class beside the big work-step cards. That is the
shape Phase 206 should target, and it is captured in full with its two binding constraints (the D-14
no-new-executors red line, and our card's full badge budget) in **`SEED-199`**.

⚠ Their canvas is hand-built **jQuery + SVG with no flow library at all**, so the look is not tied to
their stack and is reachable in `@xyflow/react`, which we already ship.

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

## ⭐ AMENDED 2026-08-24 — ONE PHASE FOLDS BACK INTO v3.8. Phase 206 is REWRITTEN, not dropped.

Operator direction: *"assess what we can fold into this milestone rather than waiting for the next
milestone and going back and forth."* Assessed — **exactly one thing folds cleanly**, and it is the
highest-leverage item in this whole document.

### Phase 206 (rewritten): **MCP Connector Client — workflow-scoped**

| | Phase 206 as planned | Phase 206 rewritten |
|---|---|---|
| Capabilities | 2 write verbs (Jira, SMTP) | **every tool the connected MCP server exposes** |
| Reads | zero | **JQL search, CQL search, get issue, PR + code search** |
| Per-vendor adapter code | 2 | **none** |
| Validates the MCP-first verdict | no | yes — first implementation of a month-old decision |

**Why it does not need to wait for this milestone:**

- **Workflow-scoped, so the approval model is not a blocker.** Phase 189/190's outbound governance
  already lives on the canvas. **Chat** is what needs the approval model — and chat stays here.
- **No OAuth needed.** MCP servers carry their own auth; the OAuth work is for Google/Microsoft
  first-party APIs, which stay here.
- **Atlassian and GitHub already ship official MCP servers.** The proof costs no adapter.

**Scope:**
1. Provider-shaped connection row holding an **MCP server URL** + **per-tool grants** (§6 grain,
   committed once — this is the table-shape decision SEED-146 warns not to make twice)
2. **MCP client** in the backend; consciously retire `test_189_no_egress.py`'s fence in the same commit
3. **Tool discovery** from the server → the per-tool permission list
4. Drivable from the existing external-action workflow node
5. **Atlassian + GitHub** as the proof; no further breadth

**Explicitly NOT in the fold — these stay in this milestone:** chat surface + approval model · OAuth ·
Google / Microsoft first-party · drive auto-ingest · inbound API + MCP server · the Popular catalog IA.

⚠ **The fold's one real risk:** it commits the connection table shape. That is acceptable *only*
because it commits it to the **per-tool, provider-shaped** design this document already settled — the
shape the milestone wanted anyway. Committing the OLD action-shaped design would have been the
migration SEED-146 warns about.

## Sequencing

1. Close v3.8 — **204** (running), **205**, and **206 rewritten** (see the amendment above).
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

---

## ⚠ AMENDED 2026-08-25 — the operator SAW the MCP round trip work, and the reaction sharpened this milestone

Phase 206.2 shipped the MCP authoring door and it was demonstrated live in the browser on
2026-08-25: connection bound, tools discovered from `mcp.deepwiki.com`, one permission granted and
one denied. **Nothing was broken.** The operator's response was about the *shape of the product*,
and it is the clearest statement of this milestone's requirement anyone has written:

> *"I still see that it's a little bit complicated for the user to know how to call external
> actions… I did not see the real action. How it is really cool this MCP… on the connections tab we
> are still using this filter that is meaningless like Message or Ticket. This is very specific and
> it [isn't] reflecting the real purpose of the MCP connection… add specified each tool's logo and
> each tool's specific actions."*

### What that adds to the milestone, beyond what was written on 2026-08-24

**1. The unit of the catalog is a SERVICE, not a capability.** The 2026-08-24 direction already said
*"as many famous applications as we can"*. What the demo proved is **why the current model cannot
grow into that**: `capability` is a CHECK-constrained closed set of three verbs at migration 116, so
every new service either squeezes into `send_email` / `create_ticket` / `post_message` or becomes
invisible — to the filter, to the node face, to the picker. **The catalog cannot be built on
`capability`.** MCP already proved this by being the first thing that did not fit.

**2. "Very simple to use" now has a measurable meaning.** Today, calling an external action requires
a person to: know MCP exists → find the right tab → know a server URL → click Discover → know which
tool → hand-write a JSON argument object. **The target is: pick a service, pick a named action.**
No URL, no JSON.

**3. The reference designs are in `screenshots/` and they are the acceptance bar.**

| File | What it fixes |
|---|---|
| `Screenshot 2026-08-24 202011.png` — Claude.ai **Connectors** | Real service marks · a **Popular** row · `Connect` buttons · a filter about **state** (`All / Connected / Not connected`), ⚠ **never about what the connector can DO** — which is precisely where ours breaks |
| `Screenshot 2026-08-24 202036.png` — Claude.ai **Plugins directory** | The catalog shape: search, `Filter by`, `Sort by`, icon + name + one-line purpose per entry |
| `…workflow-edit.webp` — **xyOps** | ⭐ Nodes state their own identity on the face (`CATEGORY` / `PLUGIN` / `TARGETS` / `TAGS`), per-node glyphs, **typed edges** (`On Success` / `On Error` / `On Critical`), and named action nodes — **Send Email**, **Web Hook Discord**, **Create Ticket** — never a generic "reach outside" |

**4. Authentication is the gate the operator is waiting on.** *"When will we reach this phase of
authenticating [and] connecting to external actions"* — today the only credential shapes are D-03's
three static tokens plus an optional MCP bearer. **There is no OAuth anywhere in the product**, and
a catalog of famous services is not reachable without it. This milestone owns that; no scheduled
phase does.

### ⚠ What is deliberately NOT folded in here

The **small, immediate** half of the operator's complaint — the canvas node saying "Reach outside"
with an envelope, and the meaningless filter chips — is scoped as a **separate phase proposal**:
`.planning/PHASE-209-PROPOSAL-a-step-says-what-it-actually-does.md`. It is frontend-only and needs
no catalog, no OAuth and no schema change.

**Keeping them apart is the point.** Folding a two-day legibility fix into an unscheduled milestone
would leave the product saying "Reach outside" for however long the milestone waits — and folding
the milestone into a small phase is how a phase becomes six.

### Sequencing, stated plainly

Nothing currently on the ROADMAP addresses any of this. The remaining registered work is **206.3**
(a publish bug), **207** (`api.ts` split) and **208** (CLAUDE.md split) — one fix and two debts.
**The honest answer to "when do we reach it" is: not on the current plan.** It needs the operator to
either register Phase 209, open this milestone, or both.


---

## ⚠ 2026-08-25 — `SEED-202` IS THE REQUIREMENT THIS MILESTONE SHOULD BE SCOPED AGAINST

The operator described the outcome they want, in their own words, and it exposes a structural gap
none of this document previously named:

**`external_action` is WRITE-ONLY, and half the vision is READS.** *"Go to Slack and read whatever
other information, and add that up to what we saw in the knowledge base"* has **no shape in this
product at all** — the three capabilities are three verbs that all push, and the whole vocabulary
(*reaches outside*, *changes something outside*, *stops and asks you first*) assumes a write.

⚠ **MCP already broke that assumption unnoticed:** `read_wiki_structure`, driven live on 2026-08-25,
**is a read** — it took the write path, stopped for an approval it did not need, and the canvas told
the operator it changes something outside.

⚠ **AND THE RESEARCH THE OPERATOR ASKED FOR IS OWED AND UNDONE.** *"Leverage others' experience on
how they do it and how it should fit in our application."* The three `screenshots/` are reference
**designs**, not a study. `SEED-202` lists the four questions that must be answered — how the
leaders model a read, how they present a large catalog without a capability taxonomy, how
describe-to-build stays honest at that scale, and what OAuth costs — **before this milestone is
scoped.** Scoping it now would be scoping from three screenshots and one example.

Full statement, verbatim: `.planning/seeds/SEED-202-the-operators-vision-read-and-write-across-systems.md`
