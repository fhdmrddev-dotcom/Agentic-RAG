---
type: research
title: "Connections & Open Platform — competitor study. The four questions SEED-202 names as OWED."
created: 2026-08-25
researched_by: gsd-project-researcher
answers: SEED-202 Q1-Q4
scopes: .planning/CONNECTIONS-MILESTONE-CANDIDATE.md
method: provider-docs-first (each product's own documentation; every claim carries a URL)
confidence: HIGH on Q1/Q2/Q4 · MEDIUM on Q3 (vendors document the happy path and are quiet about failure)
---

# Connections & Open Platform — what the leaders actually do

**Brief:** `SEED-202` — *"leverage others' experience on how they do it and how it should fit in our
application."* Four questions, answered from primary documentation, cross-checked against what
`external_action` can actually express at HEAD.

---

## ⭐ VERDICT — one page

### THREE THINGS THE BRIEF GETS WRONG, and they change the shape of the milestone

**⚠ CORRECTION 1 — "the leaders split trigger / read / write" is FALSE, and the one place a
read/write axis really exists is MCP, which we already chose.**

Nobody splits reads from writes as a *governance* axis. What every workflow engine splits is
**trigger vs. everything-after-the-trigger**. Two products (Zapier, Make) additionally split
**searches** out of actions — but read their own docs and the reason is **data flow, not safety**:
a search returns *0..N* records and must be pairable with *"create it if it wasn't found"*
([Zapier][z-search], [Make][mk-mod]). n8n and Activepieces do not split at all — one node/piece
holds `Send`, `Search`, `History` and `Archive` side by side ([n8n Slack node][n8n-slack]).

The **only** ecosystem in this study that carries a declared read/write property per operation is
**MCP**, via `ToolAnnotations.readOnlyHint` ([spec schema][mcp-schema]). Our recorded MCP-first
verdict is therefore *strengthened*, not weakened, by this research — and the "direction" concept
SEED-202 wants is **already on the wire from every compliant MCP server**.

**⚠ CORRECTION 2 — `external_action` is NOT read-incapable. Measured at HEAD: the MCP arm already
returns the tool's content to later steps.**

`phase_types.py:2542` — the MCP success path returns `{"text": tool_result.get("text", "")}`. That
lands in the phase output and in `accumulated_outputs`, which is exactly what a downstream
`llm_single` step consumes. **Step 2 of the operator's example — *go to Slack and read* — is
executable at HEAD today** against any MCP server that exposes a Slack read tool. What is missing is
**not the data path**. It is (a) a first-party read path that needs no MCP server, (b) *direction*
anywhere in the model or the vocabulary, and (c) — see below — the annotation we are throwing away.

**⚠ CORRECTION 3 — "it stopped for an approval it did not need" is only half right, and MCP agrees
with our old behaviour, not with the complaint.**

`readOnlyHint` **defaults to `false`** and `destructiveHint` **defaults to `true`**
([spec schema][mcp-schema]). An unannotated tool is *specified* to be treated as destructive. So
gating `read_wiki_structure` was the correct default; the defect is that we never **read the hint**,
so we can never *stop* gating a tool that declares itself read-only. The fix is "read the hint and
soften only on an explicit `true`", never "assume reads are safe". SEED-146 already names the other
half: a read is safer *outbound* and introduces **prompt-injection** surface *inbound*.

### ⭐ THE SINGLE CHEAPEST FINDING IN THIS STUDY

`backend/app/services/mcp_client.py:280-296` sanitizes every discovered tool down to a **three-key
allow-list**:

```python
sanitized_tools.append({"name": name, "description": description, "inputSchema": input_schema})
```

**`annotations` is dropped. `title` is dropped. `outputSchema` is dropped.** Those three keys are,
respectively, SEED-202's Q1 direction answer, Q2's human-readable catalog label, and Q1's
*"how is a read's output shape described so a later step can consume it"* answer. They arrive on
every `tools/list` response from a spec-compliant server and we discard them in a projection nobody
has revisited. **Widening that dict is a one-line change; the governance built on top of it is the
real work — but the data is already at the door.**

### WHAT TO COPY

| From | Copy | Why |
|---|---|---|
| **MCP** | `readOnlyHint` as the direction axis, **fail-closed** on absence | The only vendor-neutral, per-operation read/write declaration that exists. Costs us nothing to receive |
| **MCP** | `outputSchema` + `structuredContent` | Answers *"what shape does the read hand the next step"* without us inventing a schema language |
| **Claude.ai connectors** (screenshot) | **Per-tool** grants, reads and writes in ONE list, connector-level default `Needs approval` | ✅ We already shipped this grain at 206.2 (`tool_grants`). It is the industry's most advanced permission model and we have it. **Do not regress it.** |
| **Zapier / Make / Claude.ai** | The catalog unit is a **SERVICE**, browsed by **state** and searched by **name** | Confirms the milestone amendment. Nobody browses by "capability" |
| **n8n / Make** | Inside a service: **resource + operation** (`Message > Search`) | This is the replacement for `capability`, and it is two free-text fields, not a closed set |
| **n8n** | *Send and Wait for Response* as an **explicit step**, not a property | Approval is a step the author places. We already have `llm_human_input` — this is the same idea |
| **Make** | `Universal module` — a raw API-call escape hatch per service | Our `Custom MCP URL` is the better version of the same door |

### WHAT TO REJECT

- **Gumloop's Custom Node Builder** — *"describe what you want in plain language, Gumloop generates
  the code"* ([Gumloop][gum-node]). That is an AI-authored arbitrary-code connector: precisely the
  supply-chain surface `docs/CONNECTOR-ARCHITECTURE.md` excludes **by construction**. It is the most
  seductive answer to Q3 and it is the one we must not take.
- **Zapier Copilot's auto-build mode.** Its own best-practices page warns that Copilot *"may suggest
  workflows that require premium apps, higher plan tiers, or features that are unavailable"*
  ([Zapier][z-best]). An engine that can propose a step it cannot execute is exactly the honesty
  failure SEED-202 fears.
- **A fourth filter chip.** Phase 209's own *How we'd know this failed* already names it. Every
  product in this study filters the catalog by **state**, never by verb.
- **⚠ The milestone's own Tier-1 recommendation: "Google + Microsoft first."** See Q4 — those are the
  only two providers in the operator's list that **cannot** be reached without OAuth. Leading with
  them front-loads 100% of the auth cost before a single read has shipped.

---

## Q1 — HOW DO THE LEADERS MODEL A *READ*?

### The taxonomies, from each product's own documentation

**Zapier — three platform primitives: Trigger, Create, Search.**
A search action is *"typically with a verb such as **Find** or **Search** followed by the name of the
item this action will find"* ([Zapier platform][z-search]). Two details matter and both are about
data, not safety:
- *"If no matches are found, an **empty array must be returned** — even if the API responds with a
  `404` status."* A miss is a **successful step with no rows**, never a failure.
- **"Search or create"** pairs a search with a create so the Zap makes the record when the search
  misses. Zapier's create docs even say a create action may exist *"solely to pair with a search
  action"* and be hidden otherwise ([Zapier][z-create]).

**Make — Triggers · Searches · Actions · Universal · Tools**, and the split is explicitly about
**bundle cardinality** ([Make][mk-mod]):
- *"A search module helps you to get specific data from a service"*; **search/list modules return
  MULTIPLE bundles**.
- *"An action module processes the data retrieved from a service"* — subtypes **get / create /
  update / delete**; a **get** module *"always return[s] a single object, which means only one
  bundle."*
- ⚠ Note where `get` lives: **inside Actions**, not inside Searches. So even Make's split is not
  read-vs-write — it is *one row vs many rows*.
- Triggers split again into **polling** (*"checks for new data … since the last run"*, named
  `watch …`) and **instant** (webhook).
- **Universal module**: *"allows you to make a custom API call to a service when [it] doesn't provide
  a pre-built module."*

**n8n — Trigger nodes vs Action nodes, and NO read/write split inside the action node**
([n8n][n8n-types]). Action nodes are *"operations that represent specific tasks … manipulate data,
perform operations on external systems, and trigger events in other systems."* The Slack node
([n8n][n8n-slack]) is the proof: one node, resources `Channel · File · Message · Reaction · Star ·
User · User Group`, and inside `Message` the operations are **Delete · Get Permalink · Search · Send
· Send and Wait for Response · Update** — a destructive delete, a pure search and a send, in one flat
list with no grading between them. ⚠ n8n's glossary does not even define "action node", "resource" or
"operation" as terms ([n8n glossary][n8n-gloss]); the resource/operation pattern is a *convention*
visible in every app node's docs rather than a declared model.

**Activepieces — a `piece` = `auth` + `actions[]` + `triggers[]`.** Triggers declare
`TriggerStrategy.POLLING | WEBHOOK`; actions declare `name / displayName / description / props / run`
and an optional `requireAuth: false`. **There is no read/write or risk field on an action**
([Activepieces][ap-trigger]). *(MEDIUM confidence — the docs pages 404 at several published paths;
this is assembled from the pages that resolved.)*

**Windmill — the unit is a `resource` typed by a `resource_type`**, i.e. the *connection* is the
first-class object and the *script* does whatever it does. Read/write is not modelled at all
([Windmill][wm-res]).

**MCP — the one real read/write axis in the industry.** `ToolAnnotations`, verbatim
([spec schema][mcp-schema]):

```typescript
readOnlyHint?:    boolean;  // If true, the tool does not modify its environment.  Default: false
destructiveHint?: boolean;  // may perform destructive updates … meaningful only when
                            // readOnlyHint == false                               Default: true
idempotentHint?:  boolean;  // repeated calls have no additional effect            Default: false
openWorldHint?:   boolean;  // may interact with an "open world" of external entities. Default: true
```

⚠ And the normative caveat, which is the governance rule we must encode: *"all properties in
ToolAnnotations are **hints** … Clients should never make tool use decisions based on ToolAnnotations
received from **untrusted servers**"* — restated in the spec proper as *"clients **MUST** consider
tool annotations to be untrusted unless they come from trusted servers"* ([spec][mcp-tools]).

### Where does the approval gate sit when a step only READS?

**In the workflow engines: nowhere.** Zapier, Make, Activepieces and Windmill have no runtime
per-step human gate at all — a published Zap/scenario just runs. n8n's answer is an **explicit
step**: `Message > Send and Wait for Response` ([n8n][n8n-slack]) — the author *places* a wait; it is
never a property the engine infers. **This is a genuine divergence and we should know it: our armed
action-risk checkpoint (D-19) is more careful than any workflow engine in this study.**

**In the agent clients: per-tool, and reads sit in the same list as writes.** The operator's own
reference screenshot (`Screenshot 2026-08-24 202011.png`, and the Atlassian Rovo detail recorded in
the milestone doc) shows one list containing *Create issue · Update issue · Get issue · Retrieve
Confluence page · Search Confluence with CQL · Search with JQL* under a connector-level default
reading **"Needs approval"**. Reads and writes in one list is what lets a user grant `Search with
JQL` freely while holding `Create issue`. The MCP spec asks for exactly this: *"Permission settings
for **pre-approving certain safe operations**"* ([MCP][mcp-concepts]).

⚠ **So the answer to "where does the gate sit for a read" is: at GRANT time, not at RUN time.** A
read is approved once, by a human, when the tool is granted — and then it runs unattended. **We
already built that** (`tool_grants`, 206.2). The run-time armed checkpoint is a *second*, stricter
gate, and it is the one that should key on direction.

### How is a read's OUTPUT SHAPE described so a later step can consume it?

| Product | Mechanism |
|---|---|
| Zapier | **Sample data + output fields**, declared by the integration author; the Zap editor maps fields from them ([Zapier][z-search]) |
| Make | **Bundles** with a per-module output interface; searches emit N bundles, gets emit 1 ([Make][mk-mod]) |
| n8n | Items array + the node's documented output; expressions reference upstream nodes by name |
| MCP | **`outputSchema`** (JSON Schema) + **`structuredContent`**. *"If an output schema is provided: Servers **MUST** provide structured results that conform to this schema. Clients **SHOULD** validate structured results against this schema."* ([MCP][mcp-tools]) |

⚠ **Ours today is a single `text` string** (`{"text": tool_result.get("text","")}`) and we discard
`outputSchema` at discovery. That works for *"hand it to an LLM"* — which is, to be fair, the
operator's exact use case (*"add that up to what we saw in the knowledge base"*) — and it is
inadequate for anything that needs a field.

---

## Q2 — A CATALOG OF HUNDREDS OF SERVICES WITHOUT A "CAPABILITY" TAXONOMY

### The unit is a SERVICE. Universally. And what it contains is a two-level tree.

| Product | Unit | Contains |
|---|---|---|
| Zapier | **App** | triggers · creates · searches ([Zapier][z-create]) |
| Make | **App** | modules, typed trigger/search/action(+get/create/update/delete)/universal ([Make][mk-mod]) |
| n8n | **Node** (one per app, + a separate Trigger node) | **resources × operations** ([n8n][n8n-slack]) |
| Activepieces | **Piece** | `auth` + `actions[]` + `triggers[]` ([Activepieces][ap-trigger]) |
| Windmill | **Resource type** + hub scripts | connection first, script second ([Windmill][wm-res]) |
| Claude.ai | **Connector** | a per-tool list with per-tool permission (screenshot) |
| Gumloop | **Node** / MCP integration | *"MCP is currently available with Slack, Gmail, Google Calendar, Google Docs, Jira, Salesforce, Reddit and Github"* ([Gumloop][gum-mcp]) |

⭐ **The closest thing anyone has to our `capability` is Make's module SUBTYPE (`get/create/update/
delete/search/list`) — and it is an ATTRIBUTE OF A MODULE INSIDE AN APP, never the axis you browse
by.** That is our bug stated precisely: **we promoted an attribute to be the browse axis.** Migration
116's `CHECK (capability IN ('send_email','create_ticket','post_message'))` makes a *verb* the
identity of a *connection*, so a service that is not one of three verbs is unnameable, unfilterable
and invisible — exactly what the operator saw when DeepWiki vanished from every chip.

### How it is browsed

Every catalog in this study, including both operator screenshots, uses the same three controls:
**free-text search · filter by STATE · sort**. Claude.ai's Connectors pane: a **Popular** row of
three one-click connects, then `All / Connected / Not connected`, then a table of `Connector · Type ·
Status`. Its Plugins directory: `Search plugins…`, `Anthropic | Partners`, `Filter by`, `Sort by`,
each entry an **icon + name + one-line purpose**.

⚠ **Not one of them filters by what the connector can DO.** The `Type: Web` column with a `Custom`
badge on `Atlassian Rovo` and `GitHub_MCP` is a fact about *how it was added* (a pasted endpoint),
not about what it does — and it is the same *curated set + paste-a-URL door* pattern the milestone
already records.

### From "I want Slack" to a working connection — counted

| Path | Steps | Who owns the OAuth app |
|---|---|---|
| **Claude.ai Popular row** | **2** — click `Connect`, approve consent | Anthropic, once, for everyone |
| **Zapier** | **3** — pick app in the editor, `Connect a new account`, approve popup | Zapier, once, for everyone |
| **Self-hosted n8n + Google** | **≥ 8** — create GCP project → enable each API → configure consent screen → create Web-application client → copy id/secret → set redirect URI → paste scopes → authenticate ([n8n][n8n-google]) | **The operator, per instance, per provider** |
| **Self-hosted Windmill** | comparable — add the OAuth client under *Superadmin → Instance Settings → SSO/OAuth*, provider config in `oauth_connect.json` with `auth_url`/`token_url`/`scopes`/`extra_params` ([Windmill][wm-oauth]) | **The operator, per instance** |
| **Ours today (MCP)** | **6+** — know MCP exists → find the tab → obtain a server URL → paste it → Discover → grant tools → then hand-write a JSON argument object at the node | n/a |

⭐ **The 2-step and the 8-step versions are the same protocol.** The entire difference is *who
registered the OAuth application*. That is the Q4 headline and it is a product decision, not an
engineering one — see below.

---

## Q3 — DOES DESCRIBE-TO-BUILD STAY HONEST AT CATALOG SCALE?

**Confidence: MEDIUM.** Every vendor documents the happy path in detail and is close to silent about
the failure case. That silence is itself the finding: **no product in this study documents a refusal.**

**n8n AI Workflow Builder** — *"enables you to create, refine, and debug workflows using natural
language descriptions of your goals"* and *"handles the entire workflow construction process,
including node selection, placement, and configuration"* ([n8n][n8n-aiwb]). It sends *"node
definitions, parameters, and connections"* to the model and explicitly does **not** send credentials.
After generation the user must *"review required credentials and other parameters."* ⚠ **The page has
no Limitations section**; it does not say what happens when the named app has no node.

**Zapier Copilot** — produces *"a trigger event, one or more action steps, pre-populated apps,
accounts, and field mappings (when available)"* ([Zapier][z-ai]). Two documented behaviours matter:
- *"If no app connection matches …, Zapier Copilot will **prompt you to connect your app account**."*
  — a missing *connection* is handled by asking.
- ⚠ *"Copilot may suggest workflows that require premium apps, higher plan tiers, or **features that
  are unavailable in your current plan**"* and *"testing each step yourself helps you catch issues
  before your Zap goes live"* ([Zapier][z-best]). **The vendor's own guidance is: verify it, because
  it may propose what it cannot run.** Copilot offers `auto-build` and `ask as you build`, and
  recommends the latter *"for sensitive data or complex workflows."*

**Gumloop** answers the unknown-service case by **generating a node**: *"create your own reusable
Gumloop nodes using AI by describing what you want in plain language, and Gumloop generates the code
for you"*, with secrets read via `os.getenv()` ([Gumloop][gum-node]). It also ships MCP nodes for a
named short list of services ([Gumloop][gum-mcp]).

### The honest reading

Three strategies exist, and only two are available to us:

1. **Generate code for the missing service** (Gumloop) — **excluded by our architecture verdict.**
2. **Propose it anyway and put the burden on the human** (Zapier, with a documented warning) — this
   is what a describe-to-build door does *by default* when nothing constrains the vocabulary.
3. **Constrain the model to the registry** — nobody documents doing this, but it is the only
   strategy compatible with our engine, and **we already have the primitive**: `phase_types.py`'s
   closed registries (`PROGRAMMATIC_PHASE_REGISTRY`, `_TOOL_REGISTRY`) raise a `KeyError` at a named
   site on an unknown key rather than dispatching dynamically. The authoring path needs the same
   posture: **the draft-it-for-me door must be handed the connected services + their granted tools as
   its vocabulary, and a named-but-absent service must produce a stated refusal with a next action**
   (*"connect Slack"* / *"no read tool is granted on this connection"*), never a step that validates
   and fails at 03:00.

⚠ **Precedent already in this repo:** `DESCRIBE_REFUSAL` in `doorVocabulary.ts` (Phase 199) — the
describe box already knows how to refuse in a governed vocabulary. The catalog case is the same
control with a different reason string.

---

## Q4 — WHAT DOES OAUTH ACTUALLY COST US?

### Measured baseline, from our own source

`backend/app/models/connector.py` states it in its own docblock: *"There is **no** OAuth
authorization-code flow anywhere in this module — no redirect URI, no callback, no refresh token, no
consent surface. `secret` is a single opaque string in every case."* The four shapes are: Slack bot
token · Jira account-email + API token · SMTP username + password · MCP bearer (`McpConfig.headers`).

### What adding authorization-code + refresh actually requires here

| Piece | Cost against our tree | Notes |
|---|---|---|
| **Per-provider app registration** | ⚠ **The real cost, and it is not code.** Microsoft: register in Entra, get Application ID, **Redirect URI**, client secret/certificate, choose delegated vs application permissions, and some permissions *"require administrator privileges to grant consent"* ([MS Graph][ms-auth]). Google: GCP project → **enable each API separately** → consent screen → Web-application client → scopes ([n8n's own Google guide][n8n-google], [Google][g-creds]) | Repeated **per provider**, and for Google partly **per API** |
| **Redirect handling** | New public callback route + `state` CSRF param + per-org binding. We have no URL router in the frontend (`SEED-185`) and the backend has no OAuth surface | New surface, not an extension |
| **Storage** | `secret` is one opaque string today. OAuth needs **access token + refresh token + expiry + scope set + provider account identity**, all encrypted | The `enc:v1:` envelope generalises; the **column shape does not**. This is the migration SEED-146 warns about |
| **Refresh scheduling** | A background refresher, or refresh-on-use with a lock. ⚠ We now have a scheduler (Phase 204, `main.py` lifespan, `WORKER_COUNT=2`, no leader) — a refresh must be **claim-based** or two workers race and one rotation invalidates the other's token | Exists as a pattern; must not be re-invented |
| **Revocation / re-consent** | A revoked or expired grant must degrade to a *stated* connection state, not a run failure. `last_check_verdict` is the existing seam | Cheap, if designed in |
| **Multi-tenant scoping** | Already right: org-scoped RLS + `ConnectorConnectionResponse` has no secret field and is `extra='forbid'` | ✅ nothing new |
| **Self-host vs cloud** | ⭐ **THE UNNAMED DECISION.** Zapier/Claude.ai are 2-3 clicks because *they* registered the app once for everyone. n8n and Windmill push registration onto every self-hosted operator (8+ steps, per provider). **We ship a self-hostable one-box (`deploy/onebox.env.example`, `docs/OPERATOR.md`) — so by default we inherit n8n's cost, not Zapier's**, unless the milestone decides to run a hosted OAuth broker | Product decision. Nobody has stated it |

### ⚠ WHICH OF THE OPERATOR'S SERVICES NEED OAUTH — and the answer inverts the milestone's own tiering

| Operator's service | Reachable WITHOUT OAuth? | Evidence |
|---|---|---|
| **Slack** | ✅ **Yes** — static `xoxb-` bot token, non-expiring | Shipped and working in our tree (`slack_adapter.py`) |
| **Jira / Confluence** | ✅ **Yes** — account email + API token (basic auth) | Shipped and working (`jira_adapter.py`) |
| **Email (SMTP/IMAP)** | ✅ **Yes** — username + password | Shipped (`smtp_adapter.py`); IMAP is the symmetric read |
| **ClickUp** | ✅ **Yes** — personal token, *"Personal tokens begin with `pk_`"*, never expire. OAuth only *"to allow others to use your app"* | [ClickUp][cu-auth] |
| **GitHub / Notion / Linear** | ✅ Yes — PAT / internal integration token / API key | (not re-verified in this pass — see Open questions) |
| **Any MCP server** | ✅ Yes — bearer header; we already do this | `McpConfig.headers`, 206.2 |
| **Google (Gmail/Drive/Calendar/Sheets)** | ⛔ **No.** API keys *"Access publicly available data anonymously"* — they do not reach user data. User data needs an **OAuth client ID**; the only non-interactive route is a **service account with domain-wide delegation**, which is Workspace-admin-gated | [Google][g-creds] |
| **Microsoft (Outlook/OneDrive/SharePoint/Teams)** | ⛔ **No.** Graph is *"protected by the Microsoft identity platform"*; there is no static-token path. App registration is mandatory; delegated **or** app-only, and higher-impact permissions need admin consent | [MS Graph][ms-auth] |

⭐ **So six of the eight named services are reachable at TODAY's credential shape, and exactly two are
not — and those two are the milestone's proposed Tier 1.** Leading with Google + Microsoft pays the
entire auth bill before a single read ships. **A staged answer is not a compromise here; it is
strictly better**, and it lets *"go to Slack and read"* — the operator's literal sentence — ship
against a credential shape that already exists in this repository.

### Is there a credible MCP-first path that defers OAuth? — TESTING our own verdict

**The evidence supports the recorded verdict, with one correction and one new risk.**

**For:** Atlassian and GitHub ship official MCP servers, so breadth arrives with **zero adapter
code**. MCP carries `readOnlyHint` — the direction axis nothing else has. Our `tool_grants` per-tool
grain already matches the best-in-class permission model. Gumloop, an independent product, reached
the same conclusion and shipped MCP nodes for Slack/Gmail/Calendar/Docs/Jira/Salesforce/Reddit/GitHub
([Gumloop][gum-mcp]).

**⚠ Correction — MCP defers OAuth, it does not remove it.** An MCP server that fronts Google or
Microsoft still has to authenticate *to them*, so someone registers an OAuth app; MCP moves that cost
off us and onto the server operator. For a **self-hosted** customer wanting Gmail with no third
party, MCP-first buys nothing. ⚠ And a remote MCP server holding a live Google grant is a **credential
concentration** we do not control — a governance question our egress guard does not answer.

**⚠ New risk the verdict does not mention: prompt injection.** Every MCP read lands untrusted text in
a model's context. SEED-146 names this class; the tree has never faced it, because until 206.2 every
connector was a write. **A read-capable milestone must design for it, not discover it.**

**Verdict: MCP-first HOLDS.** It is the cheapest path to breadth *and* the only path that carries
direction. It is not a path to Google/Microsoft first-party — but that is fine, because those two
should not be first.

---

## COMPARISON TABLE — the axes that matter to us

| | **Read/write split** | **Catalog unit** | **Auth model** | **NL build** | **Approval gate** |
|---|---|---|---|---|---|
| **Zapier** | Trigger / Create / **Search** — split for *cardinality + search-or-create*, not safety | **App** | Vendor owns OAuth app; user clicks Connect (3 steps) | **Copilot** — auto-build or ask-as-you-build; docs warn it may propose unavailable features | **None at run time**; `ask as you build` is authoring-time |
| **Make** | Trigger(poll/instant) / **Search·List** / Action(get·create·update·delete) / Universal | **App** → modules | Vendor-owned OAuth | AI assistant (not examined) | None documented |
| **n8n** | **None** — one node, resources × operations, `Search` beside `Delete` | **Node** | ⚠ **Self-hosted registers its own OAuth app** — 8+ steps for Google | **AI Workflow Builder** — full node selection + config; **no documented limitations** | **An explicit step**: `Send and Wait for Response` |
| **Activepieces** | **None** — `actions[]` + `triggers[]`, no risk field | **Piece** | Piece-declared `auth`; OAuth or key | not examined | None documented |
| **Windmill** | **None** — read/write not modelled | **Resource type** | ⚠ Self-hosted registers its own OAuth clients | not examined | Approval steps exist as flow steps (not verified here) |
| **Gumloop** | Not modelled | **Node** / MCP integration | Credentials + secrets store | ⚠ **Generates node CODE for unknown services** | not documented |
| **Claude.ai** | Reads and writes in **one per-tool list** | **Connector** (`Web`, `Custom`) | Vendor-owned OAuth; **2 clicks**; custom-MCP-URL door | n/a | ⭐ **Per-tool grant + connector default `Needs approval`** |
| **MCP (spec)** | ⭐ **`readOnlyHint`** (default `false`), `destructiveHint` (default `true`), `idempotentHint`, `openWorldHint` — **hints, untrusted from untrusted servers** | Server → tools | Server's own (bearer / its own OAuth) | n/a | *"SHOULD always be a human in the loop with the ability to deny tool invocations"* |
| **⚑ US at HEAD** | ⛔ 3 write verbs, closed by SQL CHECK + a Pydantic Literal · MCP arm has **no** direction | ⛔ **`capability`** — a verb used as the browse axis | 4 static shapes, **no OAuth** | *Draft it for me* — vocabulary-bound | ⭐ **Per-tool grants (206.2) + an ARMED run-time checkpoint (D-19)** — stricter than any engine here |

---

## WHAT THIS MEANS FOR OUR ENGINE — named against real files

**1 · `mcp_client.list_tools` must stop discarding the answer.** `mcp_client.py:293-296` is a
three-key allow-list. `annotations` (→ `readOnlyHint`), `title` (→ the human label the catalog needs)
and `outputSchema` (→ how a later step consumes the read) are all dropped. ⚠ The allow-list posture
is *correct* — a raw passthrough would put server-controlled keys into `discovered_tools` JSONB.
**Widen the list; do not remove it.**

**2 · Direction belongs on the resolved step, computed, never authored.** The precedent is already in
this tree: `ExternalActionPhaseConfig` **derives** `available_tools` from `capability`/`tool_name` and
discards what the author sent (D-03: *"ONE fact, ONE derivation"*). Direction is the same shape —
derived from the granted tool's annotation, defaulting to *writes* on absence, exactly as MCP
specifies. ⚠ **And the MCP untrusted-hint rule says a hint may never WIDEN a permission**: a server
claiming `readOnlyHint: true` may soften the *banner*, and must not by itself disarm D-19's
checkpoint on a tool the user granted as a write.

**3 · The capability closed-set is now a scaling wall in FOUR places, not one.** `capability` is
spelled in: migration 116's `CHECK`, `grounding.EXTERNAL_ACTION_CAPABILITIES` (the runtime home),
`models/connector.ConnectorCapability`, and `ExternalActionPhaseConfig.capability` — held in
agreement by two module-scope `assert`s. That machinery is *good engineering of the wrong model*.
⚠ **Do not add a fourth verb.** The industry's replacement is **service → (resource, operation)** as
two free-text fields on the connection's discovered tool list, with the *closed set* moving to the
place a closed set belongs: **the per-tool GRANT**, which is data, per connection, and already ships.

**4 · The read data path exists; the read VOCABULARY does not.** `_exec_external_action` already
returns text into `accumulated_outputs`. ⚠ What has no shape: `nodeEffectBanner.ts` keys on the phase
*type*; `nodeVocabulary.ts` and `canvasModel.ts` have **zero** `tool_name` hits (Phase 209's own
measurement); `connectionsCopy.ts:154-156` binds chips to the three verbs. **A read is expressible in
the engine and inexpressible in the language.** That is Phase 209's job for the label — and it should
be handed *direction* as an input, not left to infer it.

**5 · A first-party read needs no new executor.** The D-14 red line holds: `external_action` already
takes two shapes (capability, MCP tool) through one executor. A native `read` is a third shape on the
same executor, and `SEED-199`'s connector-as-node grammar is where it renders.

**6 · Approval: keep both gates, and let them differ.** Grant-time (per-tool, `tool_grants`) is where
the industry puts a read's approval. Run-time (D-19 armed checkpoint) is ours and is stricter than
any engine studied. ⚠ **The run-time gate is the one that should key on direction — and the grant-time
gate must NOT**, because a read is exactly where prompt injection enters.

**7 · The describe-to-build door must be handed a vocabulary, and must refuse outside it.**
`DESCRIBE_REFUSAL` (`doorVocabulary.ts`) is the existing control. ⚠ **A refusal is only honest if it
names the next action** — *"Slack is not connected"* is useful; *"I can't do that"* is not.

**8 · Sequence by AUTH FAMILY — but invert the tiers.** Slack · Jira/Confluence · SMTP/IMAP · ClickUp
· MCP are all reachable at today's credential shape. **Google and Microsoft are the only two that are
not, and they are exactly the two the milestone proposes first.** Ship reads on the six, then pay for
OAuth once the read model is proven.

---

## OPEN QUESTIONS — not settled by the documentation

1. **Does any workflow engine gate a step at RUN time on a human approval, other than n8n's explicit
   wait step?** Windmill has approval steps in flows; I did not verify them from primary docs. If
   Windmill's approval step is *properties-based* rather than *placed*, that changes the D-19 story.
2. **What does n8n's AI Workflow Builder actually do with an app it has no node for?** Its docs have
   no limitations section and no failure case. Only an empirical test would settle it — **it is the
   single most valuable unanswered question in this study**, because it is our Q3 verbatim.
3. **Activepieces' piece framework** — the published doc paths 404'd repeatedly; the `createAction` /
   `createTrigger` field lists here are MEDIUM confidence, assembled from resolving pages. The
   `pieces-framework` source on GitHub would settle it.
4. **GitHub / Notion / Linear static-credential claims** in the Q4 table were not re-verified from
   primary docs in this pass (they are well-known, hence LOW-MEDIUM confidence as stated). Verify
   before they enter a tier.
5. **Do the official Atlassian and GitHub MCP servers actually SET `readOnlyHint`?** The whole
   direction design depends on real servers populating the annotation. ⚠ **This is empirically
   checkable in one call against a live server and should be, before direction is designed on it.**
   `mcp.deepwiki.com` (already bound in our tree) is a free first data point.
6. **Hosted OAuth broker vs. per-operator registration** — a product decision this study can only
   frame. It is the difference between a 2-step and an 8-step connect, and it interacts with the
   one-box self-host story.
7. **Prompt injection on read content** — no vendor in this study documents a defence. That is not
   evidence that none exists; it is evidence the ecosystem is quiet about it. Treat as unsolved.
8. **Rate limits, pagination, idempotency** on the read path — SEED-146 §6 lists them; no product doc
   read here explains how they surface to an *author*. Unaddressed.

---

## SOURCES

[mcp-tools]: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
[mcp-schema]: https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/2025-06-18/schema.ts
[mcp-concepts]: https://modelcontextprotocol.io/docs/learn/server-concepts
[z-search]: https://docs.zapier.com/platform/build/search
[z-create]: https://docs.zapier.com/platform/build/create
[z-ai]: https://help.zapier.com/hc/en-us/articles/15703650952077-Use-the-power-of-AI-to-generate-Zaps
[z-best]: https://help.zapier.com/hc/en-us/articles/45327353705997-Best-practices-for-using-Zapier-Copilot
[mk-mod]: https://help.make.com/types-of-modules
[n8n-types]: https://docs.n8n.io/integrations/builtin/node-types/
[n8n-slack]: https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.slack/
[n8n-gloss]: https://docs.n8n.io/key-concept-glossary.md
[n8n-google]: https://docs.n8n.io/integrations/builtin/credentials/google/oauth-generic/
[n8n-aiwb]: https://docs.n8n.io/build/ways-of-building-workflows/ai-workflow-builder
[ap-trigger]: https://www.activepieces.com/docs/developers/building-pieces/create-trigger
[wm-res]: https://www.windmill.dev/docs/core_concepts/resources_and_types
[wm-oauth]: https://www.windmill.dev/docs/misc/setup_oauth
[ms-auth]: https://learn.microsoft.com/en-us/graph/auth/auth-concepts
[g-creds]: https://developers.google.com/workspace/guides/create-credentials
[cu-auth]: https://developer.clickup.com/docs/authentication
[gum-node]: https://docs.gumloop.com/nodes/custom_node_details
[gum-mcp]: https://www.gumloop.com/blog/introducing-mcp-workflows

| Source | Confidence | Note |
|---|---|---|
| [MCP tools spec][mcp-tools] · [schema.ts][mcp-schema] | **HIGH** | Normative spec + the canonical schema, quoted verbatim |
| [MCP server concepts][mcp-concepts] | **HIGH** | Official |
| [Zapier platform: search][z-search] · [create][z-create] | **HIGH** | Vendor developer docs |
| [Zapier Copilot: generate][z-ai] · [best practices][z-best] | **HIGH** | Vendor help centre; the limitation quote is the vendor's own |
| [Make module types][mk-mod] | **HIGH** | Vendor help centre |
| [n8n node types][n8n-types] · [Slack node][n8n-slack] · [glossary][n8n-gloss] · [Google OAuth][n8n-google] · [AI builder][n8n-aiwb] | **HIGH** | Vendor docs |
| [Microsoft Graph auth][ms-auth] | **HIGH** | Microsoft Learn, quoted |
| [Google Workspace credentials][g-creds] | **HIGH** | Google developer docs |
| [ClickUp authentication][cu-auth] | **HIGH** | Vendor developer docs |
| [Activepieces createTrigger][ap-trigger] | **MEDIUM** | ⚠ Several doc paths 404'd; assembled from resolving pages + vendor-domain search snippets |
| [Windmill resources][wm-res] · [OAuth setup][wm-oauth] | **MEDIUM** | ⚠ Reached via vendor-domain search, not direct fetch |
| [Gumloop custom nodes][gum-node] · [MCP workflows][gum-mcp] | **MEDIUM** | ⚠ Docs 404'd at several paths; the code-generation claim comes from a vendor-domain snippet + vendor blog, not a fetched docs page |
| `screenshots/Screenshot 2026-08-24 202011.png` · `…202036.png` | **HIGH** | Read directly; operator-supplied reference designs |
| Our own tree: `models/connector.py` · `models/harness.py` · `harness/phase_types.py` · `services/mcp_client.py` | **HIGH** | Read at HEAD, line numbers cited |


---

## ⚠ THE OPEN QUESTION IS ANSWERED — LIVE, 2026-08-25 — AND `readOnlyHint` CANNOT CARRY THE DESIGN

The study closed with one question it called the thing *"the whole direction design rests on"*:
**do real MCP servers actually set `readOnlyHint`?** A raw `tools/list` was driven against three.

| Server | Result | `annotations` | `title` | `outputSchema` |
|---|---|---|---|---|
| **DeepWiki** (`mcp.deepwiki.com/mcp`) | HTTP 200 · 3 tools | ⛔ **ABSENT on all 3** | ⛔ ABSENT on all 3 | ✅ **PRESENT on all 3** |
| **Atlassian** (`mcp.atlassian.com/v1/sse`) | **401 `invalid_token`** | not reachable | — | — |
| **GitHub** (`api.githubcopilot.com/mcp/`) | non-JSON (gated) | not reachable | — | — |

### ⭐ The finding

**`read_wiki_structure` — a tool whose NAME BEGINS WITH "read" — ships no `readOnlyHint` at all.**
Under MCP's own defaults (`readOnlyHint: false`, `destructiveHint: true`) it is therefore
*specified* to be treated as destructive, which means **our approval gate is behaving exactly as the
spec instructs.** That half of the earlier correction is confirmed again, from the wire.

**But the consequence for the design is the opposite of what was hoped:**

1. ⛔ **`readOnlyHint` CANNOT be the primary direction signal.** It is OPTIONAL in the spec and it is
   **absent in the wild on the one server we can actually reach.** A design that reads direction
   from the annotation has **no signal at all** against DeepWiki. It can be an OPTIMISATION when
   present — never the mechanism.
2. ✅ **The `outputSchema` half of the sanitizer finding is STRENGTHENED.** It is present on **every**
   tool here, and `mcp_client.py:293-296` discards it. That is the Q1 output-shape answer arriving
   from a real server today and being thrown away — and unlike `annotations`, it is actually there.
3. ⚠ **Two of the three servers are unreachable without OAuth — MEASURED, not predicted.** This is
   Q4 landing in practice, and it supports the study's sequencing correction: **start with the six
   services that work on static credentials**, not with the two that cannot be reached at all.

### What is still open, stated honestly

Atlassian and GitHub remain **untested** — not because the question changed, but because we cannot
authenticate to them. ⚠ **Do not record their behaviour as unknown-but-probably-fine.** If either
turns out to annotate, that is an argument for reading the hint *opportunistically*; it is not an
argument for building the direction model on it, because DeepWiki has already proved the signal can
be missing. **A mechanism that works only on servers that opt in is not a mechanism.**
