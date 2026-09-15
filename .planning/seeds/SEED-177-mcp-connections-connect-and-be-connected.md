---
seed_id: SEED-177
title: MCP connections both ways — user-level "just connect" integrations usable in chat AND workflows, plus the open-source leverage around them. Breadth is now asked for; re-open trigger #3 has fired.
created: 2026-08-18
planted_during: Operator direction, after a live test of n8n's MCP server and a scoping conversation about competitor connector breadth (Beam, Glean)
status: partially-answered
status_note: |
  ORIGINAL `status:` line, verbatim — displaced by Phase 251's frontmatter migration (D-10):
  status: partially-answered  # trigger #2 ANSWERED by Phase 206 (2026-08-25); triggers #1 and #4 have NOT fired

  The prose that followed the token, byte-for-byte:
  # trigger #2 ANSWERED by Phase 206 (2026-08-25); triggers #1 and #4 have NOT fired

  Mapped `partially-answered` -> `partially-answered`. Reason: clean 1:1 — a first-class enum member, NOT the partially-* family.
priority: high
relates_to:
  - SEED-013 (External Integrations — public API, MCP server, webhooks) — the INBOUND twin; "expose us" is its second consumer mode
  - SEED-014 (Automations / Routines) — the TRIGGER consumer
  - SEED-142 (two-way connectors, read/pull, connected-drive auto-ingest) — the READ half
  - SEED-144 (provider-shaped connections + OAuth) — ⚠ its premise needs correcting, see "The correction" below
  - SEED-145 (connections are platform assets, usable from chat) — the SURFACE this seed lands on
  - SEED-146 (the full integration capability surface) — the umbrella
  - D-v3.6-01 / D-v3.6-02 (docs/CONNECTOR-ARCHITECTURE.md) — the verdict whose breadth clause this re-opens
trigger_when:
  - SEED-013 / Open Platform gets a phase number on .planning/ROADMAP.md (measured 2026-08-18 — 0 hits, still unscheduled)
  - Anyone proposes adding an MCP client to backend/app — retire the test_189_no_egress fence DELIBERATELY, never trip it by surprise
  - A user asks to pull from Slack / Jira / Monday / ClickUp / email / OneDrive
  - Anyone estimates connector work using the "OAuth is the hard part, once per vendor" framing — that framing is WRONG, see below
trigger_paths:
  - ".planning/ROADMAP.md"
  - "backend/app/**"
surface: Agentic-RAG
---

# SEED-177 — connect, and be connected

## ⚠ STATUS FLIP 2026-09-07 — trigger #2 answered, the seed is NOT discharged

Flipped `planted` → `partially-answered` on operator instruction, at the honest granularity
rather than at the seed level, because **this seed has two halves and only the outbound one
has been touched.**

**ANSWERED — trigger #2**, verbatim: *"Anyone proposes adding an MCP client to backend/app —
retire the `test_189_no_egress` fence DELIBERATELY, never trip it by surprise."*

- `backend/app/services/mcp_client.py` exists: **480 lines / 7 commits / 5 phases**, added at
  `a1aa25c48` (**Phase 206, 2026-08-25**).
- The fence was retired **exactly as this trigger demanded** — `test_189_no_egress.py`'s Case A
  source fence carries a written `D-206-07` retirement note in the test body, and it is **not**
  in the 71-failure backend baseline. ⭐ **The trigger did its job.** What failed was the
  paperwork: CLAUDE.md line 40 still read *"No MCP client exists in the backend today"* for
  **thirteen days** (corrected `a7284fcd7`), and this seed still read `planted`.
- Partially also **trigger #3** (*"a user asks to pull from Slack / Jira / Monday / ClickUp /
  email / OneDrive"*) — Drive landed at Phase 234, OneDrive/SharePoint at Phase 238.

**STILL LIVE — the "be connected" half, which is the operator direction this seed was planted
for.** The 2026-08-18 direction quoted below asks to *"expose our app as MCP"* **and** to call
out to others. Only the calling-out half exists.

- **Trigger #1 has NOT fired.** Measured 2026-09-07: `.planning/ROADMAP.md` contains **no phase
  for SEED-013 / Open Platform** — inbound MCP-server exposure is unscheduled, exactly as it was
  when this seed was planted.
- **Trigger #4 has NOT fired** — the *"OAuth is the hard part, once per vendor"* correction stands
  unconsumed.
- ⚠ **Phase 239 is NOT this seed.** It makes a file-serving MCP server a *watchable source*
  (SRC-04) — more of the outbound half. It does not expose this app to anyone.

**Re-open is therefore automatic, not conditional:** triggers #1 and #4 are unchanged and still
armed. Do not read `partially-answered` as `closed`.


## The direction (operator, 2026-08-18)

> "expose our app as MCP and also to call other applications through MCP — I need to pull
> information from Slack or Jira or Monday or ClickUp or whatever, email, OneDrive… similar to
> competitors like Beam or Glean… where it fits should be in the chat, where it can call tools and
> inspect external environments, as well as in the workflow."

And, on scope, correcting an over-engineered reading:

> "my point is not to over-complicate. We have the ability to connect simply — just authenticate and
> connect at user level, similar to what we do in Claude AI: go to MCP, connect to another
> application, and then it's used in the chat or project or any other place. What I meant by hundreds
> is at least to have a connection with the suitable applications that work side by side with our RAG."

This **reaffirms** the 2026-08-08 two-way direction already recorded in
`docs/CONNECTOR-ARCHITECTURE.md` and SEED-142. It is not a new decision — it is the same decision,
still unscheduled, now with breadth attached.

## Procedurally: this fires re-open trigger #3, not #2

`docs/CONNECTOR-ARCHITECTURE.md` lists three re-open triggers. The one firing is **#3** — *"Open
Platform slips past the point where breadth is commercially needed. Observable: connector breadth
blocks a real deal or a real user while the Open Platform milestone still has no phase number."*
Measured 2026-08-18: `grep -niE "seed-013|open platform" .planning/ROADMAP.md` → **0 hits.**

⚠ It is **not** trigger #2 ("a real connector need that no MCP server covers") — every app named has a
maintained MCP server. Recording which trigger fired matters, because #2 would re-open
*first-party-thin* while #3 re-opens *breadth sequencing*, and they have different answers.

Re-opening means amending that doc and adding a superseding `D-vX.Y-NN` entry — never editing the
verdict in place.

## ⚠ THE CORRECTION — MCP DOES standardize authorization; "OAuth per vendor" is wrong

Stated wrongly during this very conversation and corrected the same session, recorded here because it
would otherwise be inherited and inflate every future estimate:

> ✗ *"MCP standardizes how a tool is called; it standardizes nothing about how you got the token."*

**False for remote MCP servers.** The MCP authorization spec requires OAuth 2.1 (Authorization Code +
PKCE) and RFC 9728 Protected Resource Metadata for auth-server discovery; clients discover the
authorization server from the resource itself. Registration is via Client ID Metadata Documents
(recommended), Dynamic Client Registration (RFC 7591, deprecated but supported), or manual
pre-registration.

**Consequence:** we implement the OAuth client **once, generically**, and every compliant remote MCP
server works. This is precisely why Claude.ai's connector UX is "paste a URL, log in, done."
**SEED-144's per-vendor-OAuth premise should be re-read against this** — the work is far smaller than
that seed implies for any vendor that ships a compliant remote MCP server.

## The shape — deliberately small

| Piece | Size |
|---|---|
| Generic MCP OAuth client (discovery + PKCE + refresh) | Built **once**; serves every compliant server |
| `connections` table — user-level, encrypted tokens | Small — reuse existing Fernet + RLS patterns |
| Connections settings page — list / Connect / Disconnect | Small |
| Tool resolution = static registry + connected servers' tools | Moderate — **the one real change**, see below |
| Per-call approval in chat: *"Allow this tool? Once / Always"* | Small — and it IS the chat governance rail |

**The per-call confirm is the whole approval model for chat.** An earlier framing in this
conversation demanded the canvas's armed-checkpoint machinery on the chat surface; that is
disproportionate. Allow-once / allow-always is what the industry ships and it satisfies the standing
*"every connector capability is a WRITE"* rule without a governance build.

## The one genuinely structural finding — the tool registry is CLOSED BY DESIGN

Measured in `backend/app/models/connector.py:155` and `backend/app/models/harness.py:196`: the
`_TOOL_REGISTRY` / `PROGRAMMATIC_PHASE_REGISTRY` rule is that **an unknown key is a KeyError**,
deliberately, as a safety property. Connections require **dynamic tool registration** scoped to
whichever connections an org/user has enabled. That is a change to how tools are *resolved*, not a
feature bolted on top, and it is the piece most likely to be discovered late and expensively.

Tool-count explosion is **not** a blocker at the asked-for scale: a user connects 5–10 apps (~50
tools), not hundreds. Progressive disclosure (per-connection enablement, the harness's existing
`available_tools` whitelist concept) covers it; dynamic tool retrieval is a later optimisation.

## The "suitable" catalog — ~15 covers the 80%

Breadth is a curation job once the client exists, not engineering. The set that sits beside a
knowledge base:

- **Docs & drives** — Google Drive, OneDrive/SharePoint, Notion, Confluence
- **Work & tickets** — Jira, Linear, ClickUp, Monday, Asana
- **Comms** — Slack, Gmail/Outlook, Teams
- **Dev** — GitHub
- **CRM** — HubSpot, Salesforce

Adding the fifteenth should cost roughly what the second did. If it does not, the seam is wrong.

## Suggested phase split

1. **Connections (client) FIRST** — generic MCP OAuth client + user-level connections + settings page
   + per-call approval + the curated catalog. This is what users see and what competitors are judged on.
2. **Expose us (server)** — mount an MCP server (the SDK's `streamable-http` mounts into FastAPI) plus
   an **OpenAI-compatible `/v1/chat/completions` shim**. MCP reaches Claude Desktop/Code, Cursor,
   Cline, ChatGPT and n8n; the shim reaches Open WebUI, LibreChat, Continue and everything else that
   speaks OpenAI. Two small surfaces, large reach.
3. **Reads into retrieval** — the Glean-shaped slice: cite Jira / Slack / Drive / email *alongside*
   the knowledge base. Needs no approval model, and lands on our actual differentiator rather than
   beside it.

## n8n specifically — BYO, never bundled

n8n's MCP server was tested live and works (see memory note `reference_n8n_mcp_server_tested`), but:

- It is an **authoring** server. 34 tools, of which the entire execution surface is two:
  `execute_workflow` (async, returns an id) + `get_workflow_execution`. The unit of integration is
  *a published n8n workflow*, not *a Slack node*. Per-workflow `availableInMCP` requires the workflow
  to be **published** and to contain a webhook / form / schedule / chat trigger.
- ⚠ **n8n is fair-code, NOT open source** (Sustainable Use License). A client running their own n8n
  is fine; **shipping n8n inside our product, or hosting clients' workflows and credentials on an
  instance we operate, requires a paid Embed License.** Consulting/building workflows for clients is
  expressly permitted.
- Bundling it also adds a second runtime (its own Postgres + queue + workers, against red line D-14),
  a second identity and credential store that **our RLS does not reach**, and its CVE patch cadence.

**Verdict: bring-your-own n8n, connected over MCP like any other server.** Zero licensing exposure,
credentials and patching stay with the client, our one-box stays lean, and "works with the n8n you
already run" is a better line than "we bundle a workflow engine."

## Open-source leverage worth taking

- **Official MCP Python SDK** — client *and* server in one dependency.
- **Cross-encoder reranker** (BGE / Jina) over pgvector — highest accuracy-per-effort change
  available; no schema change.
- **Self-hosted embeddings** (HF TEI / Infinity) — retires the recorded OpenAI embeddings SPOF.
- **RAGAS** — retrieval-quality evals. The actual guardrail behind "without compromising accuracy":
  without a score, "we didn't regress" is an opinion.

**Deliberately skipped:** Flowise (duplicates the v3.6 Workflow Studio — forks our differentiator);
Langfuse (LangSmith already ships); Airbyte (bulk ELT, not agent-shaped — revisit only if OneDrive
*bulk* auto-ingest becomes the driver); Docling (recorded skepticism on file).

## The blocker to retire deliberately

`backend/tests/unit/test_189_no_egress.py::test_no_mcp_identifiers_in_backend_app` **fails on ANY MCP
identifier under `backend/app`**. It is hardened — its positive control already caught a weaker
`\bmcp\b` matcher missing `MCPClient`. The first phase to build an MCP client retires this fence as
an explicit, recorded act.
