# Agentic RAG — AI Agent Platform

## What This Is

A RAG-based AI agent platform where users organize documents into nested folders and interact with a customizable AI agent. The agent remembers preferences across threads, extracts tables and images from documents, shows confidence and citations, runs code in a sandbox, and can be taught new skills that persist. As of v2.7 the agent also keeps a per-thread workspace of versioned files, manages a todo list, can spawn sub-agents, and can pause to ask the user a question — all surfaced live in a collapsible right-side workspace panel. As of v2.8 the agent can also run inside a deterministic, locked workflow (Harness Mode) — ordered phases the model cannot escape, with per-phase tool whitelists, validation gates, and a live phase timeline — alongside today's free-form Deep Mode chat. The Deep Midnight visual design delivers a glassmorphic, mobile-responsive experience with knowledge health dashboards and user feedback loops. As of v3.0, documents are a first-class, metadata-driven surface: user-defined custom metadata with per-field confidence, metadata-driven saved views ("virtual folders"), typed document relationships, suggest-then-confirm auto-classification, a light governance-health view, and configurable multi-provider embeddings. As of v3.9 a **connection** is `{service identity, auth, discovered tools, per-tool grants}`, so adding a service adds rows rather than code. As of v4.0 the knowledge base **reads itself**: a source — Google Drive, OneDrive/SharePoint via Microsoft Graph, any MCP file server, or a mailbox — is connected once, previewed before it brings anything in, and then watched on the shipped scheduler, with one visibility per connection enforced in RLS and provenance riding every row.

## Core Value

The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.

---

## Current Milestone: v4.1 Ship It & Feel It

**Started:** 2026-09-11. Phase numbering continues at **242**.

**Goal:** v4.0 stops being code that exists and becomes a product in production — and the surface the
operator actually touches every day stops feeling busier than the bar it is aimed at.

⭐ **This is a CONSOLIDATION milestone, and the version number says so.** It is deliberately **v4.1,
not v5.0**: it opens no new capability axis. v5.0 is reserved for the next real one (Open Platform /
inbound — `SEED-013` / `SEED-195`, already named as its own milestone). Precedent: **v3.5 UX
Consolidation & Chat Polish**, 4 phases between two capability milestones, which worked.

**The reason it comes now rather than a capability milestone:**

1. ~~⛔ **v4.0 has never deployed.** Cloud is **15 migrations behind** (`153-156`, `166-176`).~~
   ⛔ **CORRECTED HOURS LATER, 2026-09-11 — struck through rather than deleted, because this
   sentence was copied out of `STATE.md`'s v4.0-close text and was already false when copied.**
   Measured: `production` sits at `e65610ac2`, containing `1f313670b "Merge master into
   production — deploy v4.0 Connected Knowledge"` (2026-09-10), and `git log production..develop`
   returns **2 commits, both v4.1 planning docs**. **v4.0 IS deployed.** What is genuinely unknown
   is whether cloud's data matches — the migrations are *claimed* applied by the deploy record and
   verified by no measurement. ⭐ **The milestone survives the correction:** its reason was never
   "push the button", it was *"v4.0 is code nobody has proven is running."* That is still true, and
   Phase 242 now proves it instead of performing it.
2. ⛔ **Chat carries 14 open bugs** — the largest single coherent cluster in the reported-bugs
   register, on the product's primary surface.
3. ⛔ **A `severity: blocking` bug reported 2026-09-10 makes Settings → Search unsaveable**
   (`BUG-260910-03`), which means the `QUEUE-06` recall remedy shipped by Phase 241 is **currently
   unreachable by an operator**. A cliff that cannot be climbed away from is worse than a cliff.

**Target features:**

- **Ship v4.0** — clear the blocking Settings→Search save, drive 241's **expiring** UAT row 5 on
  cloud *before* migration 176 lands there (after it, the arm it proves is unreproducible forever),
  apply the 15 migrations in numeric order, push to production with the parity checklist.
- **The thinking block** — reasoning renders as a calm, structured surface instead of a flat
  `whitespace-pre-wrap` blob repainted once per token, and it appears on pure-text replies too, not
  only tool-bearing turns.
- **The follow-scroll seam** — scrolling up during a tool call leaves you where you scrolled.
- **The chat shell** — chat scrolls inside chat (not the whole page), a cap-paused run leaves you a
  usable composer, approvals render in the thread, and a local file can be attached to a message.
- **The v4.0 verification debt** — 238's 9 credential-blocked rows and 233's 5 G-4 rows driven or
  explicitly retired with a reason; every phase closed without an independent review says so in its
  own record.
- **The recall cliff** — `QUEUE-06` honestly met out of the box, and the Settings screen made unable
  to display a search breadth that is not in effect.

**Decisions taken at scoping (2026-09-11, operator):**
- ⭐ **`OV-SOLO-01` continues: solo running, with a named substitute for the independent gate.** The
  dispatched code-review subagent becomes **mandatory** on any phase touching a trust boundary, and
  every phase closed under it must read **"self-verified"** in its own VERIFICATION.md, never
  "reviewed". It is not an independent gate. It is also **not worthless** — on Phase 239 exactly that
  arrangement returned 19 findings including 2 Criticals, one being a destructive tool bindable as
  the file *reader* and then called by the watch loop on every file, unattended.
  `/code-review ultra` stays ruled out on cost.
- ⭐ **`SURF-03`'s home is the app shell, not the Health tab.** It lands in the chat-shell phase,
  where the shell is already open. Closing it against the Health tab alone was already recorded as
  insufficient; this ends that as an open scoping question.
- **The blocking Settings→Search bug moves ahead of the production push**, so it is not deployed.
- **Register debt is worked, not swept.** The v4.0 close listed 161 planted seeds and 34 open bugs;
  this milestone folds the six seeds whose triggers are already true rather than re-deferring them.

**Binding constraints (not aspirations):**
- ⚠ **G-2 fires on the chat phases** — live UI, "feels like", a stated gold-standard comparison.
  `/gsd:sketch` before `/gsd:plan-phase`, and the operator-approved mockup is the acceptance bar.
- ⚠ **Order is forced at the front:** blocking-bug fix → 241 row 5 on cloud → migrations → push.
  Row 5 dies the moment migration 176 reaches cloud, so it cannot be re-sequenced for convenience.
- ⚠ **The chat files are hot but no longer un-enterable** — Phase 227 discharged G-5 on
  `MessageItem.tsx` and `ToolCallPanel.tsx`. `StreamsProvider.tsx` and `MessageList.tsx` still carry
  their rows; read `docs/HOT-FILE-LEDGER.md` before planning either.
- ⚠ **A bug report is a CLAIM about code, not the code.** `BUG-260718-02`'s part B was already fixed
  and the report still read `open` — found by opening `MessageItem.tsx:470`, not by reading the
  register. Drive every inherited claim before planning against it.
- ⚠ **`retrieval_service.py`'s G-5 extraction, owed since 231, is at its THIRD landing** if the
  recall phase touches it — the extraction must be proposed FIRST.

**Seeds folded (6):** `045` (UI/UX polish umbrella — its trigger is *"a dedicated UI/UX polish
milestone is scoped"*) · `029` (Continue-on-cap — the fix for `BUG-260904-05`, not a separate idea) ·
`032` (reasoning real-time UI parity) · `042` (ephemeral file attach — half of `BUG-260905-01`) ·
`268` (a shown breadth that is not in effect) · `049` (E2E revival — its trigger names *"a
chat-surface / streaming / RunCard phase"* verbatim).

**Deferred with triggers intact:** `SEED-013` / `SEED-195` (Open Platform — **this is v5.0**) ·
`SEED-211`'s BUILD (metadata-derived permissions) · `SEED-224` (document-space redesign) ·
`SEED-265` / `266` / `267` (the v4.0 recall-harness residue) · `SEED-004` (org / department /
role multi-tenancy — ⚠ department access has been owed since Phase 231).

**Known shape-risk, stated at scoping rather than discovered later:** **a consolidation milestone has
no natural stopping point.** Every register it opens contains more than it can close, and the failure
mode is Phase 235's — 17 plans for 4-6 plans of substance. **G-8 is the governor here more than on any
capability milestone:** 3-5 plans per phase, and a bug that is ≤ 1 file / ≤ 10 lines is `/gsd:fast`
under G-3, never a plan.

---

## Last Shipped: v4.0 Connected Knowledge (2026-09-10)

> ✅ **SHIPPED 2026-09-10, git tag `v4.0`.** 14 phases (228-241, no inserts), 62 plans, 571 commits,
> 6 days. **33/38 requirements delivered · 5 ⛔ not ticked.** Migrations 153-156 / 166-176.
> Archive: [`milestones/v4.0-ROADMAP.md`](milestones/v4.0-ROADMAP.md) · requirements:
> [`milestones/v4.0-REQUIREMENTS.md`](milestones/v4.0-REQUIREMENTS.md) · audit:
> [`milestones/v4.0-MILESTONE-AUDIT.md`](milestones/v4.0-MILESTONE-AUDIT.md).
>
> ⛔ **238, 240 and 241 closed WITHOUT an independent §6.3 review** — Gemini unavailable since
> 2026-09-09, `/code-review ultra` ruled out on cost. Their verdicts are the builder's own.
> ⛔ **Two UAT sets owed on credentials** (238: an Azure app registration · 241 row 5: a cloud DSN,
> ⚠ **and row 5 dies the moment migration 176 reaches cloud**). ⛔ **Cloud is 15 migrations behind.**
> &nbsp;
> ⚠ **CORRECTED 2026-09-13 (Phase 245) — the two lines above are preserved, not deleted.** The
> *238: an Azure app registration* half is **FALSE**: All nine of 238's M rows were **DRIVEN LIVE on 2026-09-07** (`238-VERIFICATION.md:213-231` — 7 full pass, 2 half at the time; **four defects found by driving and NONE by the 15-case unit suite**). The operator completed the Azure registration *hours after* `238-SUMMARY.md` was written.
> ✅ **Phase 245 closed that set** (`245-VERDICT.md` §SC#1). ⛔ The *241 row 5: a cloud DSN* half
> **remains true**, deadline included.
>
> The scoping text below is preserved as written at the milestone's open.

**Goal:** The knowledge base stops depending on somebody remembering to upload — a person connects a
source **once**, sees exactly what it would bring in **before** it brings anything, and the Library
keeps reading it on a schedule, safely and at a customer's scale.

**Started:** 2026-09-04. Phase numbering continues at **228**.

**Target features:**
- **The watch loop** — connect a source, map an external folder to a Library folder, watched on the
  **shipped** scheduler (never a new one). The preview splits three ways: *will be added* /
  *already here* (a `content_hash` lookup, not a guess) / *type not supported*, and **nothing is
  ingested until a person says so**. A source that has stopped reading says so, says when, and
  offers the one action that fixes it. (`LIB-08` / `LIB-09` / `LIB-10` — written into
  `REQUIREMENTS.md` for the FIRST time; they have lived only in a roadmap heading until now.)
- **Four source families as ADAPTERS over ONE contract** — Google Drive (proven OAuth at 215/221) ·
  OneDrive / SharePoint (Microsoft Graph) · any MCP server exposing a file surface · email / mailbox.
- **The inbound permission envelope** — **connection-scoped visibility** as the shipped v1, stated
  plainly in the UI; every source lifecycle event answered explicitly (deleted / unshared / moved /
  modified / source-disconnected).
- **Ingest at scale** — a durable ingestion job queue with cap, retry and resume; embed batching;
  embedding-provider fallback; filtered-vector recall at corpus scale.
- **Inbound content is untrusted** — the written anti-prompt-injection discipline actually attacked;
  PII/DLP over the ingested corpus; erasure and purge-on-disconnect.
- **One rule engine, not two** — the folder-watch rules and the classification splice designed
  together.
- **v3.9 closeout, first** — the owed UAT rows and G-4 operator drives, the resume-path bug cluster,
  `/code-review ultra` on the OAuth state rework, and the `app.<domain>` production move.

**Decisions taken at scoping (2026-09-04, operator):**
- ⭐ **The permission fork is ANSWERED: `SEED-210` Option 3 — connection-scoped visibility.**
  Everything from one connection inherits ONE visibility, and **the UI says so plainly**.
  `SEED-211`'s metadata-derived (M-Files) model is **DECIDED AND RECORDED with a migration path,
  NOT BUILT** this milestone. This satisfies `SEED-210`/`SEED-211`'s "must be decided together"
  requirement while capping the access-control surface so the sync actually ships. ⚠ The seed's own
  warning stands: *"Option 3 or 4 is a legitimate v1 — silence is not."* Silence is the one option
  with no defence, and it is now foreclosed.
- **All four source families are IN**, on the binding constraint below.
- **Meeting transcripts (`SEED-212`) are OUT**, trigger intact — they are EVENT-shaped, a source
  *shape* rather than a source *provider*.
- **v3.9's debt gets a phase number**, not a bullet in `STATE.md` — that is precisely how it survived
  the last close.

**Binding constraints (not aspirations):**
- ⭐ **A watched source must be DATA, not code** — the v3.9 lesson applied inbound. One generic
  `list → read → hash → splice` contract with Drive / Graph / MCP / mail as **thin adapters**. If each
  source family grows its own ingest path, this is four milestones wearing one name.
- ⚠ **THIS MILESTONE RETIRES A STANDING `CLAUDE.md` RULE** — *"Ingestion is manual file upload only
  — no connectors or automated pipelines"*, marked *dated, not permanent*, must be changed **in the
  same commit** as the first sync connector (`SEED-142`). ⭐ **And that same commit retires the reason
  our permission model was adequate**: every document in the corpus was until now deliberately placed
  by a person who could already read it, which is what made ownership-based RLS sound.
- ⚠ **Threat model MANDATORY** on the sync phase — untrusted external content enters the corpus the
  agent answers from, and a new credential scope is added.
- ⚠ **The screen says "checked every N minutes"** — never *"instantly"* or *"on change"*. There is no
  delta cursor and no webhook; when one lands, the sentence changes in the same commit.
- ⚠ **A file removed at the source is NOT removed from the Library** unless explicitly asked for. A
  revoked share must never silently delete knowledge the agent depends on.
- ⚠ **Write and delete grants are OFF by default** — they inherit Phase 213's approval model and
  invent nothing.

**Known shape-risk, stated at scoping rather than discovered later:** **email is a second SHAPE
smuggled in as a fourth provider.** Drive, OneDrive and MCP-file are all one shape — a file with a
path and a hash. A mailbox is threads, quoting, and attachments-as-children, with no stable document
boundary — the same class of problem as `SEED-212`, which this milestone deliberately deferred.
Expect it to behave like a shape decision, not an adapter.

**Depends on shipped work:** Phase 215 (OAuth — HARD) and Phase 216 (`ATTACH-01`, the deliberate
one-file pull this generalises into a standing sync). ⭐ **`ATTACH-01` stays shipped and is
deliberately unaffected** — a human picking ONE file dodges ACL mirroring, deletion propagation and
the sync loop entirely, which is why `SEED-213` was kept in v3.9 while its four siblings were deferred.

**Seeds folded (18):** `209` `210` `211` `142` (the carried foundation) · `077` `197` `076` `048`
(ingest at scale — ⭐ `076` and `077` each name *"the next milestone"* as their hard prerequisite in
their own text) · `188` `079` `072` (inbound content is untrusted) · `243` (one rule engine — the
deferred phase text says the two surfaces *"should be designed together rather than growing two rule
engines"*) · `014` `239` `060` `224` (loop reliability + surface) · `213` `242`.

**Deferred with triggers intact:** `SEED-212` (transcripts — re-open on any transcription connector
or a "what was decided in the meeting" query) · `SEED-013` / `SEED-195` (inbound / Open Platform —
its own milestone) · `SEED-211`'s BUILD (re-open when connection-scoped visibility is measured
insufficient by a real tenant).

---

## Last Shipped: v3.9 Connections — Any Service, Any Tool

**Shipped:** 2026-09-04 — 16 phases (210-217 CORE + inserts 214.1 / 217.1 + 220-227; **218 absorbed**
into 217.1; **219 deferred**), **111 plans**, 695 commits, migrations **127-129 / 140-141 / 150-152**,
git tag `v3.9`. **34 ✅ delivered · 3 ⚠ partial · 2 ⛔ shipped-but-never-driven, of 39 requirements.**
Full record: `.planning/MILESTONES.md` · archive: `.planning/milestones/v3.9-*`.

⚠ **Phase 219 (`A Connected Source Feeds the Library`) is DEFERRED to the Connected Knowledge
milestone** with `LIB-08/09/10` and `SEED-209/210/211/212` (operator, 2026-09-04). Its SC#1 —
*“watched on a schedule”* — is word for word v3.9's own binding re-open trigger for those four
security seeds. **The trigger did not fire; it was kept from firing by moving the feature.**

**The goal it was measured against, and met:**

**Goal:** A person connects a *service* — not a protocol — sees every tool it offers, grants each
one individually, and then uses it by name in chat and as a specific step on the canvas.

**Target features:**
- **Service-shaped connection model** — retire `capability` as the browse axis (`SEED-207`, PREREQUISITE)
- **MCP + custom-URL door** — a curated Popular set plus a paste-a-URL long tail; adding a service is DATA, not code
- **The catalog** — service marks, Popular row, `All / Connected / Not connected`
- **BYO OAuth** — client_id/secret the customer registers; refresh + expiry handled
- **Per-tool approval model** — built on Phase 085's `ask_user`; HARD PREREQUISITE for the chat surface
- **Chat surface** — add any connected service to a thread by name; the agent picks which granted tool to use
- **Specific steps, not generic ones** — the step names the service and tool, on canvas AND spine AND run surfaces
- **Argument satisfiability** — a send step can actually receive its arguments from every launch path
- **Human-initiated attach** from a connected source (`SEED-213`)

⭐ **NOTHING IS PER-VENDOR, and this is the architectural point.** A connection is
`{service identity, auth, discovered tools, per-tool grants}`. Three doors in, in cost order:
**(1) custom MCP URL** — paste an endpoint, we discover its tools, you grant them; ZERO engineering,
and this is what makes the menu unbounded. **(2) Popular catalog entry** — the same model plus a
stored mark, display name and starter prompts; a few strings. **(3) BYO OAuth** — only for
first-party APIs with no MCP server, and the cost is per AUTH FAMILY, not per product (one Google
connection serves Gmail, Drive, Calendar and Sheets).

**Decisions taken at scoping (2026-08-26, operator):**
- **OAuth: BYO first, we-own-the-app later.** A customer-registered client_id/secret works on EVERY
  deployment including self-hosted/on-prem; our own registered apps for a Popular set are a named
  later slice. ⚠ The trade is explicit — Claude.ai's 2-step Connect is NOT day one, because our
  redirect URI would point at our cloud and self-hosted installs could not use it.
- **Chat surface IS in scope, with the approval model as its prerequisite** — never an outbound
  capability in `_TOOL_REGISTRY` before the approval model exists.
- **Inbound (public REST API, webhooks, service accounts, us-as-an-MCP-server) is its OWN later
  milestone.** `SEED-013` / `SEED-195`. Both being called "Open Platform" is a naming coincidence,
  not a scope argument — hence this milestone is NOT named "& Open Platform".

**Reference designs — `screenshots/`, and they are the acceptance bar.** ⚠ **They are Claude.ai**
(verified 2026-08-26 by reading the images; earlier conversation attributed them to "Plot AI").
`202011` Connectors list → the catalog IA, and the **`Custom` badge on `Atlassian Rovo` / `GitHub_MCP`
IS the custom-URL door**. `202017` Rovo detail → prompt-suggestion chips + a connector-level
`Needs approval` default over **7 individually-switched tools, reads and writes in ONE list**.
`202036` / `202044` Plugins Directory → the long-tail catalog IA + "Try asking…" starters.
The sixth file is a `.webp` whose hex filename decodes to
`https://pixlcore.com/images/blog/xyops/workflow-edit.webp` — **xyOps**, the canvas reference
(named action nodes, per-node glyphs, typed edges).

**Seeds folded (12):** `SEED-202` `204` `205` `206` `207` `208` (the recorded scope order) +
`142` `144` `145` `146` `177` (the foundation) + `213` (human-initiated attach).

**Bugs folded (9):** the seven v3.8 connector/scheduler reports (`BUG-260826-01` … `-07`, of which
`-01` is BLOCKING) + `BUG-260810-01` (cloud Connections tab has no Add button) + `BUG-260815-05`
(BLOCKING — an embedding-provider 429 surfaces as "your documents returned nothing").

⚠ **DEFERRED WITH A BINDING RE-OPEN TRIGGER — `SEED-209` / `210` / `211` / `212`, the
connector→knowledge-base INGESTION axis.** `SEED-210` measures that synced documents flatten source
ACLs and source deletions never propagate; `SEED-211` is the M-Files metadata-permissions fork.
Shipping auto-ingest without them is not a gap, it is a **security defect**. → a **Connected
Knowledge** milestone. **Re-open trigger: the first AUTOMATIC or BACKGROUND sync from a connected
source.** `SEED-213` is deliberately kept IN because a human picking one file dodges every one of
those problems.

⚠ **A migration is owed before OAuth can store a single row:** mig 126 leaves
`CHECK (capability IS NOT NULL OR mcp_server_url IS NOT NULL)`, so an OAuth-authenticated service —
which has neither — is **refused by the database**.

⚠ **The three fixed verbs must NOT be deleted.** `SEED-207` measured it: `send_email` /
`create_ticket` / `post_message` are the only external path that works with **no MCP server**. They
become an ATTRIBUTE, never the organising axis.

✅ **MCP-first is already half-built** — `backend/app/services/mcp_client.py` (367 L) and Phase
206.2's per-tool grants both ship at HEAD. The `CONNECTIONS-MILESTONE-CANDIDATE.md` claim that "no
MCP client exists in the backend today" is **STALE**. OAuth genuinely is zero: one occurrence of the
string in all of `backend/app`, and it is a comment saying there is none.

## Last Shipped: v3.8 Document Intelligence, Automations & Connectors

**Shipped:** 2026-08-26 (12 phases [201, 202, 203, 204, 204.1, 205, 206, 206.1, 206.2, 206.3, 207, 208, 209], 17 plans, migrations 124-126, **11/11 requirements delivered**, git tag `v3.8`).
**Goal:** Structured tables and email became first-class ingestion; workflows run unattended with a brake that really stops work; a run can read its own prior run; and a workflow reaches any official MCP server with per-tool consent and **zero per-vendor adapter code**.
⚠ **Closed `gaps_closed_partial`, not `passed`** — three requirements are narrower than their wording (`{{prior_run.*}}` misses `llm_emit`; email thread dedup is stored and read by nothing; TAB-02 covers new ingests only). Carried with re-open triggers: `milestones/v3.8-MILESTONE-AUDIT.md`.

## Previously Shipped: v3.7 Workflow Product Completion

**Shipped:** 2026-08-24 (17 phases [192, 192.1, 192.2, 193, 193.1, 193.2, 194, 194.1, 195, 196, 197, 198, 199, 200, 200.1, 200.2, 200.3], 147 plans, 20/20 requirements satisfied).
**Goal:** Made the workflow product built across v2.8→v3.6 usable end to end — find it, understand the door, build it with the right vocabulary, stop it, test run it, and see what it produced.

## Previously Shipped: v3.0 Document Management

**Shipped:** 2026-06-21 (7 days, 11 phases [110, 111, 111.1, 112–119], 46 plans, 410 commits, +99,800 / −627 LOC; git tag v3.0).

**Goal:** Turned the product's incidental document-management capabilities into a first-class, metadata-driven surface (M-Files-aligned Tier A) — documents structured, related, and trustworthy enough to power both direct use and every cited workflow deliverable.

**Scope:** Requirements archived to `.planning/milestones/v3.0-REQUIREMENTS.md`. **24/24 functional REQ-IDs delivered** (DMF-01/02/03, META-01..05, EMBED-01..06, VIEW-01..07, REL-01..04, CLASS-01..03, DGOV-01/02) + UX-01/UX-02 cross-cutting. No formal milestone audit — substituted by per-phase rigor (every phase verify-work'd + secure-phase'd + validate-phase'd; live cross-provider UAT on the agent-tool / upload-path phases).

**Key deliverables:**
- DM foundations (110) — immutable audit-log enums for DM actions, owner-private RLS with a forward-compat nullable `org_id`, and a single default-on feature flag the future entitlement system plugs into
- Metadata enrichment (111/112) — user-defined custom metadata fields extracted on ingest, per-field confidence chips, manual audit-logged overrides, a larger extraction window, and an extraction model no longer pinned to `gpt-4o`
- Configurable multi-provider embeddings (111.1) — retires the OpenAI embedding SPOF (SEED-048): a provider picker (OpenAI / Google / Ollama / LM Studio / OpenAI-compatible) + a guarded RLS-scoped re-embed job
- Virtual folders / metadata-driven views (113/114/115) — a closed-registry filter-AST → parameterized-jsonb compiler (no raw DSL), a no-DSL condition builder (equals / one-of / contains / empty / numeric / date / relative-date + AND + folder-subtree scope), leak-safe global sharing, a saved-Views sidebar, and a `query_documents_by_view` agent tool
- Document relationships (116/117) — typed links (supersedes / amends / references / attached-to) over a leak-safe share-don't-fork core, a relationships panel on the detail view, removal, and a `get_related_documents` agent tool
- Auto-classification (118) — metadata-condition rules → a suggested folder on upload (never a silent auto-move); reversible accept/dismiss with an audit receipt
- Governance health (119) — a light read-only view surfacing broken relationships / unclassified docs / low-confidence metadata, each signal linking to the action that fixes it

**Seeds consumed / planted:** SEED-005 Tier A realized; SEED-048 (embedding SPOF) closed; SEED-040 (extraction/embedding model picker — light slice). Planted: SEED-091 (view-filter polish), SEED-092 (a11y follow-ups), and the Gemini multi-type-array schema trap (a 115 live-UAT find). Prior milestone v2.9 (Workflow Studio) shipped 2026-06-15 — see `milestones/v2.9-ROADMAP.md`.

## Previously Shipped: v2.9 Workflow Studio

**Shipped:** 2026-06-15 (8 days, 9 CORE phases [097-104, incl. inserted emission-layer 101.1], 57 plans, 418 commits, +88,561 / −514 LOC). STRETCH phases 105-109 deferred to backlog.

**Goal:** Turned the v2.8 harness into a capability a domain expert can **author, connect to their project's knowledge and skills, and run to produce a real deliverable** — with project management as the flagship demo (not hardcoded logic). ~80–90% composition of shipped harness primitives; net-new = authoring UX + a project/scope binding + ephemeral template upload + a small validation-gate library + the Workflows page. The red line held: Deep Mode stayed byte-identical, no new runtime.

**Scope:** Requirements archived to `.planning/milestones/v2.9-REQUIREMENTS.md`. **14/14 CORE REQ-IDs Validated** (PROJ-01/02, GOV-01, WFSKILL-01, TMPL-01/02/03, GATE-01, QUAL-01, WFAUTH-01/02/03/04, PM-01); 5/5 STRETCH deferred (SCHED-01, GRID-01, GOV-02, PLUG-01, ROLE-01). No formal milestone audit — substituted by per-phase rigor (every CORE phase verify-work'd + secure-phase'd + live cross-provider UAT'd).

**Key deliverables:**
- Project binding + server-side KB scope governance (098) — bind a workflow to a project folder+subtree; retrieval scope resolved server-side at run start, model-unwidenable (⊆ assert gated no-op when scope is None → Deep byte-identical)
- Workflow ↔ skill composition (099) — `skill_ref` pulls a project skill's judgment into a phase; skill version snapshotted into the locked definition (migration 067) so a later edit can't break a published workflow
- Ephemeral template upload + guaranteed cited template-fill + integrity (100/101/101.1) — one-run template upload (never KB-ingested); a shared `llm_emit` layer FORCES a cited field-map → deterministic no-model-code render; corrupt files can never reach the user as "done"; native-7-reliable
- Reusable validation-gate library + output-quality judge **hard-wall** (102) — `citations_required`/`freshness`/`structure_check`/`output_file_valid`/`llm_judge_rubric`; an `llm_judge` + publish-time golden run is a HARD publish blocker
- Workflows page + authoring API + NL authoring (103) — describe-in-NL → valid draft (auto-retry on validation error); read-only phase-spine graph; project-filtered library; run-from-thread; 8-stage publish gauntlet
- PM flagship content pack (104) — charter/status-report/risk-register templates + defs authored entirely on the generic primitives; headline template-fill demo green across a 7-model cross-provider sweep

**Seeds consumed / planted:** SEED-051 (NL→workflow authoring) realized. Planted/active: SEED-082 (emit-gate policy + model-fit routing), SEED-084 (starter workflow library), SEED-069 (living-document output re-ingestion). SEED-005 (Enhanced Document Structure) = operator-confirmed next milestone. Prior milestone v2.8 (Harness Engine & Workflow Mode) shipped 2026-06-07 — see `milestones/v2.8-ROADMAP.md`.

## Last Shipped: v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers

**Shipped:** 2026-06-28 (9 phases, 40 plans, 324 commits, 569 files +61,830/−914 LOC, 7 days; git tag v3.1). Full archive: `.planning/milestones/v3.1-ROADMAP.md`.

**Started:** 2026-06-21 (Option A — scope LOCKED + operator-approved via 2 research waves + a live DB forensic → `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md`).

**Goal:** Make the agent's skills + workflows trustworthy, legible, and reliably triggered across *all* providers — fix the live workflow↔skill collision (a confirmed, root-caused bug), lift cross-provider honesty to OpenAI-parity, add a Skill Trigger Tuner, and re-skin the Workflow Studio so each workflow's "soul" is obvious with a strict↔loose authoring/running split.

**Target features (CORE):**
- **Collision fix + context isolation** — run-scope the sandbox-output harvest (the live 2-files bug, Mechanism A), tag message origin so Deep & Harness stop replaying each other's history, and give workflows one front door (remove the composer Harness pill → 2-pill General/Explorer).
- **Cross-provider trust & honesty parity** — force→coerce retry ladder in `forced_emit`, doc-verified `emit_tier` cleanup (drop inert DeepSeek strict, keep GLM forcing), provider as a first-class eval axis (per-provider scoreboard), and descriptive task labels on every provider (OpenAI-parity).
- **Skill triggering quality** — a Skill Trigger Tuner (held-out should/should-not benchmark), description-quality lint at `save_skill`, and pinning loaded-skill instructions out of the trim window.
- **Workflow Studio UX** — surface the workflow's "soul" in 3 sizes (card / run-header / publish-summary) and a strict↔loose disclosure ("Describe & run" vs "Author & govern").

**STRETCH:** bounded human-in-the-loop *description-only* self-improve proposer (SI-02) · smart-dispatch relevance pre-filter (TRIG-02) · gauntlet pip-strip (WUX-03) · stream description live before tool_start (TDP-02) · MiniMax/OpenRouter arg repair (MP-04) · template_input resolver run-scope (COLL-02).

**Deferred → v3.2 "Skill Eval Studio (full) + Self-Improving":** the net-new eval+versioning backend — `skill_versions` + eval tables + `run_skill_eval` + grader/comparator/analyzer + review viewer + skill publish gate (SI-01) · frontmatter enforcement (STD-01) · executable skill bundles (DISC-01). **Own-slot/backlog:** rolling conversation compaction (CTX-02 / SEED-041) · CTX-04/05.

**Guardrails firing:** G-2 sketch-first on IA-01 + all WUX (live UI / "feels like"); G-5 hot files (`threads.py` firing → extraction due, `context_window.py`/`agent_loop.py` trim path, `PhaseTimeline.tsx`/`PhaseCard.tsx` shared with the live harness). **Red line:** never fork the shared path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

**Deferred / carried (not in v3.1):** DM Tier B (retention / check-in-out / approvals) → v3.5; v2.9 STRETCH 105–109; SEED-013/014 connectors (v3.3/v3.4); SEED-082 emit-gate policy; SEED-084 starter workflow library; open `surface: Agentic-RAG` run-honesty / provider-polish reports (roll into v3.1's UAT blast radius). Authoritative version map: `.planning/PRDs/SEQUENCE.md`.

## Last Shipped: v3.2 Skill Eval Studio + Self-Improving

**Shipped:** 2026-07-10 (16 phases, 81 plans, 656 commits, ~12 days; git tag v3.2). Full archive: `.planning/milestones/v3.2-ROADMAP.md` · requirements: `.planning/milestones/v3.2-REQUIREMENTS.md`. **Started:** 2026-06-28.

**Delivered:** Turned the v3.1 Skill Trigger Tuner into a full iterative **Skill Eval Studio** — persistent eval test cases + immutable skill versions, a with-skill-vs-without eval runner with a dual-arm LLM judge + honest per-provider verdicts + human ratings, a human-in-the-loop self-improvement loop, a publish gate, and the Evals·Triggering·Versions panel — plus a built-in read-only skill-creator, STRETCH honesty phases, the FND-01 run-lifecycle foundation (with the overdue `threads.py` G-5 extraction), and a curated Starter Workflow Library.

**Validated (16/17 requirements):** EVAL-01..05, VER-01, SI-01, GATE-01, PANEL-01, CREATE-01 (CORE); SI-02, TRIG-02, COLL-02, SRH-01, RUN-01, FND-01, WF-01 (STRETCH — description-only proposer, smart-dispatch skill pre-filter, run-scoped template resolver, non-Python skill honesty, run-end honesty, run-lifecycle foundation, curated Starter Workflow Library proven live end-to-end: fork → judge-approved publish gauntlet → cited `.docx`).

**Deferred → v3.3:** FILE-01 (Phase 144, Agent-Driven Skill File Attachment — gated STRETCH, not executed) + the workflow-file cluster SEED-110 (run-time template upload) / SEED-112 (per-workflow KB folder-scope). **Verification debt:** live UATs pending/partial on 140/141/142/143 (see `MILESTONES.md` → Known Gaps).

**No formal milestone audit** — substituted by per-phase rigor (verify-work + secure-phase; live SC#10 cross-provider UAT on the streaming/agent-loop phases; FND-01 passed live SC#10 6/6; WF-01's 3 starters proven live end-to-end).

## Last Shipped: v3.3 Operator UX

**Shipped:** 2026-07-18 (14 phases [146–159], 95 plans, 212 tasks, ~8 days; git tag v3.3). Full archive: `.planning/milestones/v3.3-ROADMAP.md` · requirements: `.planning/milestones/v3.3-REQUIREMENTS.md`. **Started:** 2026-07-10.

**Delivered:** Made the platform operable + configurable by a non-developer operator from the UI. A gated `/admin` Control Room behind a byte-identical-404 `require_operator` gate (no RLS backstop — app-layer isolation) + operator audit ledger: health, active-runs + Kill, fail-closed capability kill-switches, maintenance/read-only mode, audit browser, user roster, API-enforced feature visibility (146–148). A dynamic model-capability registry + live propose-only discovery (no restart, no silently-guessed capabilities) + add-model-by-ID/utility-filtered curation (149/159), and app-layer Fernet secrets-at-rest with env-fallback (150). `fetch_document_file` + `attach_skill_file` agent tools + Run-modal file-input/KB-scope/safe-delete (151/152). The Glean/Beam-informed trust & friendliness UX — per-claim inline citations keyed to the real retrieval set (153), an app-wide plain-language layer behind an advanced reveal (154), a WCAG-AA sweep (155), everyday nav/thread polish (156). Deployment presets + `OPERATOR.md` (157) and an idempotent first-run install wizard at `/setup` (158).

**Validated (20/20 requirements):** ADMIN-01/02/03, FLAG-01, VIS-01, MODEL-01/02, SEC-01, FILE-01/02, WFIN-01/02/03, CITE-01, LANG-01, A11Y-01 (CORE); POLISH-01, DEPLOY-01, DEPLOY-02, MODEL-03 (STRETCH). WFIN-02 carries one operator-accepted OpenRouter cross-provider-axis limitation (external BUG-260714-02).

**Security:** phases touching a trust boundary threat-secured — 146–150, 153, 154, 158, 159 each carry a verified SECURITY.md (`threats_open: 0`).

**Deferred / rolls forward:** 9 dormant seeds (v3.4+ backlog incl. SEED-004 org-multi-tenancy); open chat-surface bugs (BUG-260708-01/-02, 260714-01, 260718-02/-03/-04) → planned post-v3.3 chat-polish phase. **Cloud parity still owed at next production push:** migrations 099–103 + `SECRETS_ENCRYPTION_KEY`.

## Last Shipped: v3.5 UX Consolidation & Chat Polish

**Shipped:** 2026-07-23 (4 CORE phases [174–177], 17 plans, 37 tasks; git tag v3.5). Full archive: `.planning/milestones/v3.5-ROADMAP.md` · requirements: `.planning/milestones/v3.5-REQUIREMENTS.md`. **Started:** 2026-07-22.

**Delivered:** Cleared the parked chat-surface bug backlog and consolidated accumulated UI/UX rough edges — the lighter cleanup pass deliberately kept separate from the v3.6 Visual Workflow Studio build. Run-state & lifecycle honesty (174), cross-provider streaming fidelity at the gateway/adapter/sanitizer boundary (175), chat render correctness + execute-code reliability (176), and v3.4 org-surface polish onto 3 shared org-zone primitives (177) — all frontend/additive/D-14 byte-identical, no migration.

**Deferred → STRETCH carry-forward** (`.planning/v3.5-STRETCH-CARRYFORWARD.md`): 178 Chat UI/UX Polish Pass (POLISH-01…05), 179 Plain-Language Extensions (LANG-01), and **180 Agent-Loop Behavior Honesty (LOOP-01/02/03) = priority revive** if agent step-by-step / summary / over-iteration annoyances become recurring daily-use complaints. Numbers 178–180 are reserved (skipped in v3.6 numbering).

## Last Shipped: v3.6 Visual / No-Code Workflow Studio

**Shipped:** 2026-08-09 (13 phases — CORE 181-189 + STRETCH 190 + inserts 184.1/188.1/188.2 — **151 plans**, 1,064 commits over 18 days; git tag `v3.6`). **Started:** 2026-07-24. Full archive: `.planning/milestones/v3.6-ROADMAP.md` · requirements: `.planning/milestones/v3.6-REQUIREMENTS.md` · audit: `.planning/milestones/v3.6-MILESTONE-AUDIT.md`. Migrations 114-118.

**Delivered:** a drag-and-drop visual authoring + non-technical live-run-observability layer on top of the existing governed harness engine — **built ON what existed, never a rewrite**. The canvas is a pure projection of `WorkflowDefinition`; measured at close, the harness still has **7 executors, exactly as at open**. The D-14 red line held across all 13 phases.

**The differentiator shipped:** per-node **graded governance** — a node is *strict when KB-grounded* (the immutable `citations_required` coverage gate auto-attaches at RUN time to any KB-reading phase, derived structurally rather than declared by the author) and *flexible when open*, freely mixed in one workflow. The deep competitor crawl (Beam / Glean / n8n) confirmed **none of them grade strictness by KB-grounding**. Run-time enforcement is what makes it not author-loosenable-away.

**Operator HARD gates:** #1 preserve-v1 / revert-at-any-time ✅ (`visual_workflow_canvas` + `test_revert_byte_identical`, CI **and** live-close) · #2 study-and-beat ✅ (deep crawl → graded governance as the white-space answer) · #3 comprehensive connector story **⚠ CORE half ✅ / live half ⅓**.

**Requirements: 20/24 satisfied · 2 partial · 1 unsatisfied · 1 deferred.** CORE closed **19/21 satisfied with ZERO unsatisfied**.

⚠ **What did not land, stated plainly.** **CONN-02** is the milestone's one unsatisfied requirement: a real Slack message now sends through the full governed path (approval gate → six ordered guards → send → audit receipt), but **only 1 of 3 connectors is drivable from a workflow, and Slack works by coincidence** — `_adapter_args` supplies only each capability's `body_arg`, and Jira's `summary` / SMTP's `to`/`subject` have no author-facing field. Recorded `D-190-DEF-17`; it is a phase, not a patch, and its shape question is exactly what SEED-144/145/146 re-opened → **connections milestone**. **SCALE-01** was deferred because Phase 191's own conditional ship trigger never fired (real workflows are 5-50 phases against ~100-150-node thresholds) → `.planning/v3.6-STRETCH-CARRYFORWARD.md`.

⚠ **Debt carried out:** nine requirements ride on three missing `VERIFICATION.md` files (184, 188, 189 — all wired and UAT-backed; **documentation** debt, not engineering) · SEED-133 + SEED-134 accepted risks · four phases at `nyquist_compliant: false` (181-184) · **cloud parity owed at migrations 104 → 118, where 118 is SECURITY-BEARING** (until applied, cloud still carries the CR-01 credential exposure; 118 and the `connector_service.py` deploy must land in the same operation). **Security debt at close: zero** — all nine threat-modelled phases at `threats_open: 0`.

<details>
<summary>Original v3.6 scoping brief (2026-07-24, as written at kickoff — preserved)</summary>

**Started:** 2026-07-24 (operator-confirmed at v3.5-close — the recorded post-v3.4 sequencing: polish cluster shipped as v3.5, this ships as v3.6, run **research-first**). **Status:** defining requirements (research → requirements → roadmap).

**Goal:** Add a drag-and-drop, business-friendly **visual authoring + live-run observability layer** on top of the existing governed harness workflow engine — so a non-technical business user (Legal / HR / Finance) can *draw their own process* and watch it run, without losing the engine's governance rails. Build ON what exists (the read-only vertical phase-spine graph becomes editable; the visual canvas becomes a third, most-approachable authoring door alongside "Describe & run" / "Author & govern"). NOT an engine rewrite.

**Target features:**
- **Visual canvas editor** — draggable nodes = phases, connections = flow, side-panel node config, live in-canvas validation (the publish-gauntlet rules enforced *while building*, not only at publish — can't draw an invalid/unsafe workflow).
- **Business-friendly node vocabulary** — map phase-types / tools / gates onto plain business verbs ("Find documents", "Ask the AI", "Get approval", "Produce a report"), extending the v3.3 plain-language layer + SEED-085 terminology split.
- **Run observability for non-technical users** — a live, legible view of the workflow executing (active node, inputs/outputs, gate pass/fail), distinct from the developer timeline; extends the shipped run surface / phase timeline (094/095/103).
- **AI-seeded canvas** — NL authoring (SEED-051, realized in v2.9/103) seeds a draft canvas the user then edits (AI + visual, not either/or).
- **External-integration story (scope TBD by research)** — email / JIRA / other providers; ties to the Open Platform / connector track (SEED-013/031). Research decides whether v3.6 ships its own connector framework or sequences with Open Platform.

**Three operator HARD requirements (acceptance gates, verbatim from [[SEED-123]]):**
1. **Preserve v1 + revert-at-any-time** — the existing engine AND both current authoring doors stay untouched and **feature-flagged**; flip the flag → land back on exactly today's behavior. A tested acceptance gate, not a nice-to-have (extends the standing D-14 red line).
2. **Study best-in-class and beat them** — research **Glean AI + Beam AI + n8n** (operator-named) + the no-code class (Zapier / Make / Flowise / LangFlow) for how each reconciles easy drag-and-drop authoring with governed/safe/observable execution.
3. **Comprehensive external-integration story** — email / JIRA / other providers; **open research question the milestone MUST answer up front**: own connector framework vs sequence-with / depend-on Open Platform. Decide via research, not blind.

**Key context:**
- **Large net-new UX build** — the heart is a UX+product problem (easy visual authoring ↔ governed/safe/observable), NOT an engine rebuild. The engine's governance (locked phases, per-phase tool whitelists, validation gates, publish gauntlet) is expressed *visually*, never removed.
- **Research-first** (config `research: true` + SEED-123 mandate) — domain research on the named competitors + the connector-scope question precedes requirements. Connector scope = **research-decides** (operator lean at kickoff).
- **Multi-tenancy (v3.4) underneath** makes per-department visual authoring better (org/role model already shipped).
- **Guardrails:** G-2 sketch-first on the canvas / node model / run-viz surfaces (visual, "feels like"); G-5 hot-file audit at discuss-phase (the workflow Builder / phase-spine graph / run surface — `PhaseTimeline`/`PhaseCard`/`WorkspacePanel`); the `sketch-findings-agentic-rag` skill auto-loads on these surfaces.
- **Related seeds folding in / informing:** SEED-123 (anchor), SEED-051 (NL authoring — AI-seed half), SEED-086 (visual multi-agent representation — run-viz sibling), SEED-085 (terminology), SEED-052 (interactive HITL todo-driven execution), SEED-113 (profile/org authoring context), SEED-013/031 (Open Platform connectors — req #3). SEED-045 chat-polish (STRETCH 178) stays a SEPARATE track, not this build.
- **Standing cloud-parity debt:** migrations 099–113 + `SECRETS_ENCRYPTION_KEY` owed at the next production push (no new v3.6 migrations expected yet — research/requirements will size them). *(⚠ Superseded by measurement — the true queue at v3.6 close is **104 → 118**; v3.6 itself shipped 114-118. Run `bash scripts/pending-cloud-migrations.sh` rather than quoting any prose number.)*

</details>

## Shipped Milestone (historical scoping record): v3.7 Workflow Product Completion

**Goal:** Make the workflow product built across v2.8→v3.6 actually usable end to end — so an author
can find a workflow, understand the door they are walking through, build it with the right
vocabulary, stop it, and see what it produced.

**Why now (the honest reason).** v3.6 shipped 13 phases and 151 plans of *capability*. The operator's
own product review on 2026-08-10 — driving the app rather than reading a gate — found that the
flagship surface is not usable end to end: the library cannot be searched, a run cannot be stopped,
the deliverable is never shown, and the two authoring doors are indistinguishable. **Ten of the
fourteen findings were already planted as seeds by the same operator during earlier UAT and had never
been scheduled.** This milestone schedules them.

**Target features:**
- Workflows page information architecture — search, filter, card legibility, the Tweak-opens-edit confusion ([[SEED-136]])
- Stop a running workflow ([[SEED-140]])
- Show the deliverable — output files on the run surface ([[SEED-148]])
- Make the two authoring doors legible ([[SEED-147]])
- Non-AI utility nodes + a user-input/form node ([[SEED-141]])
- Guided authoring instead of one-shot describe ([[SEED-051]])
- Model picker sourced from the registry inside canvas nodes — the workflow half only ([[SEED-135]], [[SEED-040]], [[SEED-088]])
- Template-upload placement — the capability shipped in Phase 152 and the operator could not find it ([[SEED-110]], closed-as-shipped)

**Explicitly OUT of scope, with the sequencing reason:**
- **Ingestion / retrieval** ([[SEED-149]], [[SEED-150]], [[SEED-060]], [[SEED-087]]) → next milestone. Real, but a different subsystem.
- **Connections / integrations** ([[SEED-146]] umbrella, CONN-02) → after. **Deliberate ordering:** safe outbound writes need a stop control and a human-approval step, and both land here. Building the approval model against an unfinished authoring surface is how it gets built twice.
- **Phase 105 scheduling + budget caps** → next milestone's likely headline. Its hard prerequisite (SEED-140) lands in this milestone's CORE; its brake (spend-cap enforcement) does not exist yet. See `.planning/v2.9-STRETCH-CARRYFORWARD.md`.

**Key context:**
- Phase numbering continues from 190, but **191 is reserved** for the deferred canvas-scale phase (`.planning/v3.6-STRETCH-CARRYFORWARD.md`). This milestone starts at **192**.
- **G-2 fires on most of this milestone** — page IA, node vocabulary, doors, output display are all visual/"feels like" surfaces. Expect `/gsd:sketch` before spec/discuss on those phases, and the `sketch-findings-agentic-rag` skill auto-loads.
- **G-5 hot files:** `WorkflowCanvas.tsx` (1292 L), `PhaseNodeCard.tsx` (274 L after the 188.2 cut), `WorkflowBuilderPage.tsx`, `phase_types.py` (**fires — 35 commits / 14 phases**). Audit at discuss-phase before adding a second concern to any of them.
- **D-14 still binds:** seven harness executors, the canvas is a projection and never a second runtime. SEED-141's utility nodes must answer to this before anything is built.
- Standing cloud-parity debt: run `bash scripts/pending-cloud-migrations.sh` rather than quoting a number.

## Current State

**Shipped:** **v4.0 Connected Knowledge** — 2026-09-10 (14 phases, **62 plans**, 571 commits, 6 days; git tag `v4.0`). Four source families as thin adapters over ONE `browse / list / read / check` contract, and the contract was **tested rather than asserted** — 239 bound GitHub MCP through the UI alone, proven zero-code **by hash**, and 240 proved mail is a **shape, not a fourth adapter** (`sources/base.py` byte-identical). A file arrived by itself on the shipped scheduler; connection-scoped visibility is enforced at all four RLS sites; the anti-injection discipline was **actually attacked** (13/13 refused · 8/8 mutations caught · live drive refused by 8/8 native providers). ⚠ **241 measured a REAL recall defect at customer scale** — `recall@20` **0.040** at the shipped `ef_search = 40`, a **cliff not a slope** — and the remedy shipped as an operator setting with **the default unchanged**, which is why `QUEUE-06` is not ticked. 33/38 requirements delivered. Migrations 153-156 / 166-176. ⛔ **238, 240 and 241 have no independent §6.3 review.**

**Prior:** **v3.9 Connections: Any Service, Any Tool** — 2026-09-04 (16 phases, **111 plans**, 695 commits, 9 days; git tag `v3.9`). A connection became `{service identity, auth, discovered tools, per-tool grants}`, so **adding a service adds rows, not code** — Notion connects by OAuth with no developer console and returns 41 tools for zero lines of tool code; six Google applications sit under one token with 11/11 live writes. Per-tool grants, an approval moment that stops a real run, an audit receipt per outbound call, connections usable by name in chat, and the Library as one home for documents. 34/39 requirements delivered, 3 partial, 2 shipped-but-never-driven. Migrations 127-129 / 140-141 / 150-152.

**Current:** **no milestone active** — v4.0 closed 2026-09-10. Next: `/gsd:new-milestone`. ⚠ **Before scoping anything, three things are owed and none of them is new work on a feature:** (1) the **161 planted seeds** of 275 — CLAUDE.md's sweep rule says every `trigger_when` is read at `/gsd:new-milestone`, and at 161 that is a phase of work, not a step in a command; (2) the **two credential-blocked UAT sets**, one of which (241 row 5) **expires the moment migration 176 reaches cloud**; (3) an **independent review for 238, 240 and 241**, which cannot happen while no independent reviewer exists — that constraint is itself a scoping input, not a footnote.

<details>
<summary>Superseded Current entry (v4.0 open, 2026-09-04 — preserved)</summary>

**Current:** **milestone v4.0 Connected Knowledge — STARTED 2026-09-04.** Phase numbering continues at **228**. The knowledge base stops depending on somebody remembering to upload: a source is connected once, previewed before it brings anything, and then watched on the shipped scheduler. Four source families (Google Drive · OneDrive/SharePoint · any MCP file surface · email) as **thin adapters over ONE `list → read → hash → splice` contract** — a watched source must be data, not code. ⭐ **The `SEED-210` permission fork is answered: connection-scoped visibility, stated plainly in the UI**; the M-Files metadata-derived model (`SEED-211`) is decided and recorded with a migration path, not built. ⚠ This milestone **retires the standing manual-upload-only `CLAUDE.md` rule in the same commit as the first sync connector** — and that same commit retires the reason ownership-based RLS was adequate. 18 seeds folded; `SEED-212` (transcripts) deferred with its trigger intact.

</details>

⚠ **Armed for the next production push:** `SEED-242` moves the product to `app.<domain>` (seven steps across Vercel / Coolify / Supabase Auth / CORS — verify on a preview before promoting), and `/code-review ultra review-base-225` is owed on the OAuth state rework, skipped at Phase 225 only because credits were exhausted.

<details>
<summary>Prior Current State entry (v3.6-era, preserved)</summary>

**Shipped:** **v3.6 Visual / No-Code Workflow Studio** — 2026-08-09 (13 phases [181-190 + inserts 184.1/188.1/188.2], **151 plans**, 1,064 commits; git tag `v3.6`). Drag-and-drop visual authoring + non-technical live-run observability over the existing governed harness engine, with **graded per-node governance** as the category differentiator. 20/24 requirements satisfied; CORE 19/21 with **zero unsatisfied**. STRETCH 191 deferred (`.planning/v3.6-STRETCH-CARRYFORWARD.md`). Migrations 114-118. Prior: v3.5 — 2026-07-23 (14/14 CORE); v3.4 Multi-Tenancy — 2026-07-22 (22/22 CORE); v3.3 Operator UX — 2026-07-18 (20/20).

**Current:** **v3.7 Workflow Product Completion — opened 2026-08-10** (see the Current Milestone section above).

⚠ **The paragraph below is SUPERSEDED as the immediate next slot, and kept because its content is still correct.** At v3.6 close the sequenced next slot was recorded as connections. On 2026-08-10 the operator's product review re-ordered it: connections moves to *after* v3.7, because the stop control and human-approval step that make outbound writes safe are built in v3.7. Everything the paragraph says about connections remains true — only its position in the queue changed.

**The sequenced next slot is the connections / integrations milestone** — and it is not a fresh idea but a debt with four converging records. **`SEED-146` is the umbrella; read it first.** Its inputs: `SEED-144` (connections should be **provider-shaped**, not action-shaped) · `SEED-145` (connections are **platform assets usable in CHAT**, not workflow-only assets) · `SEED-142` (two-way connectors — read/pull/auto-ingest, which would amend CLAUDE.md's manual-upload-only rule) · and **`D-190-DEF-17`, the concrete unfinished edge**: only 1 of 3 shipped capabilities is drivable from a workflow. ⚠ Two standing warnings recorded with those seeds: **every capability shipped so far is a WRITE — no read/search/list exists at all**, and **no outbound capability may be added to `_TOOL_REGISTRY` before the approval model exists.** Sequence it with SEED-142 or Google gets connected twice.

Also open at close: v3.4 STRETCH (169-173) and v3.5 STRETCH (178-180, with **180 agent-loop honesty flagged priority-revive**) fold back in per their own triggers; 11 dormant seeds; the v3.6 verification-documentation debt (three `VERIFICATION.md` files carrying nine requirements).
**Phase 181 complete (2026-07-24):** Revert Foundation — **operator HARD gate #1** (REVERT-01, REVERT-02 → Validated), the FIRST v3.6 phase. 3 plans / 3 waves, sequential (worktrees off); reuses the v3.3 Phase-148 feature-visibility pattern (~95%). A governed `visual_workflow_canvas` feature with a NEW `"off"` audience (cold-default OFF for everyone incl. operators, resolved BEFORE the operator override — D-181-01), a `require_canvas()` **404-when-off** gate (never 403), a `GET /features` off-bypass, the operator **Off|On** control, `test_revert_byte_identical` on existing CI, and a reusable `scripts/check-181-scope-freeze.sh` (proves the two authoring doors + run surface + harness engine are ABSENT from the phase diff — D-181-08). **Red line D-14 held: flag-off byte-identical, NO migration, NO new package.** Operator live-close UAT approved (Claude-driven): no canvas nav when off, `/features` canvas=false for the operator, Off|On flip records audit receipts, `/canvas/ping` 404s off / 200 on. **Code review found + FIXED same-session 1 BLOCKER:** CR-01 (`b0e48fda`) — `require_canvas` depended on `get_current_user` (auto_error=True bearer), so an anonymous probe got 403/401 (leaking route existence) BEFORE the off-flag check → an off canvas route was distinguishable from an unbuilt one for unauthenticated callers; fix mirrors the `/admin` WR-02 pattern (dedicated `auto_error=False` scheme + flag-check-before-auth) so ALL callers get the byte-identical 404, with a pre-auth regression test. WR-01 (the `"off"` audience added to the global write-allowlist enum, not scoped to the canvas key) DEFERRED by operator decision → documented advisory in `181-REVIEW.md`. Verification **passed 12/12** (independently re-run: 22/22 backend + 7/7 vitest 181 suites, scope-freeze OK, zero net-new failures vs SEED-049/056 rot baseline). The tested off-switch every later v3.6 phase inherits. No cloud parity added (no migration). **Next:** Phase 182 (Server Validation Seam, VALID-01).
**Phase 176 complete (2026-07-23):** Chat Render Correctness + Exec Reliability (RENDER-01/02/03/04, EXEC-01 → Validated). 4 plans / 2 waves, sequential (worktrees off); frontend + `backend/app/services/tool_dispatcher.py`, **no migration**. RENDER-01/02 (176-01): the content-supersede guard drops the optimistic user temp so exactly one user bubble renders per send, and the mount/reconcile-path `onTerminal` un-folds a backgrounded run's final answer at a clean terminal keyed on `run.run_id` — no reload (closes BUG-260712-02 + the BUG-260707-03 residual). RENDER-04 (176-02): Skill Studio header `vN` + Versions LIVE badge refetch-on-promote (`refreshVersions` mirror of `refreshGate` + a `refreshNonce` into VersionsTab's fetch) — no reload after an approve (BUG-260706-01). EXEC-01 (176-03): `execute_code` declared install via same-interpreter `python -m pip` (exit-checked, retry ×1, never swallowed) + a run-scoped ModuleNotFound auto-heal (per-run Redis `heal_attempted:{run_id}` set, 1-per-module) + honest `install_failed` tool result (closes BUG-260708-02). RENDER-03 (176-04): no-silent-send-drop — the duplicate-guard non-dispatch early-return now stashes the draft in `failedSendDrafts` + a quiet `reconcileErrors` hint (composer prefill + "Couldn't send — tap to retry" banner, carried as `ApiError(400)` so the banner copy is honest) + a `pendingSendThreadsRef`/`markThreadPendingSend` race-tighten honored by the preserve-guard. **Code review found + FIXED same-session 1 Critical + 2 Warnings:** CR-01 (`7098cd0b`) — the new EXEC-01 auto-heal re-run + both pip installs ran via a bare uncancellable `run_in_threadpool` with NO wall-clock abort, re-opening the 096/SEED-063 40-min "zombie run" the primary path guards against → new `_run_bounded_sandbox` (`asyncio.wait` + container `kill_session` on overrun, `abandon_on_cancel=False`-safe) wraps the heal re-run + declared/heal installs with the same ceiling `settings.sandbox_exec_timeout_seconds`, returning an honest aborted `install_failed`; WR-01 (`b946cac8`) — RENDER-01 dedup compared a client-clock temp vs a server-clock persisted `created_at` with `>=` (duplicate bubble under clock skew) → now keys on `registeredUserMsgId` message_id identity; WR-02 (`41097139`) — the healed re-run showed pre-heal error text under a green success badge → a `healed` marker on the completion event makes the healed run's stdout/stderr the output of record. 4 Info deferred (advisory, `176-REVIEW.md`). Verification **5/5 must-haves** (goal-backward, all 3 fixes independently re-confirmed wired end-to-end; backend 31/31 + frontend touched 42/42; zero net-new failures vs the SEED-056 rot baseline). **`human_needed`** — the SC#10 4-axis live UAT scoreboard + 3 live checks roll forward as tracked debt in `176-HUMAN-UAT.md` (Phase-175 precedent). No cloud parity added (no migration). **Next:** Phase 177 (v3.4 Org-Surface Polish).
**Phase 175 complete (2026-07-22):** Cross-Provider Streaming Fidelity (XPROV-01/02/03; XPROV-04/BUG-260722-01 folded → Validated). 4 plans / 2 waves, backend-only / additive / D-14 byte-identical at the gateway/adapter/sanitizer boundary — no migration. Substrate (175-01): capability markers `reasoning_first` (3 gpt-5.6 rows) + `reasoning_off` (13-row docs-confirmed SAFE set) on `MODEL_CAPABILITIES` + the shared `provider_safe_utility_model` guard. Then: DeepSeek DSML stream-end flush + honest leak signal (175-02); the `reasoning_first` STRUCTURED routing gate + honest `reasoning_tools_unsupported` error kind (175-03); the provider-safe title/suggestion guard + per-MODEL reasoning-off title call (175-04). **Code review found + FIXED same-session 1 Critical + 2 Warnings:** CR-01 (`3d0b59eb`) — the DSML leak signal emitted a terminal `error` (api.ts stops the stream) while the run finalized `completed` with no notice persisted → now appends to `full_content` + emits `delta`, mirroring the provider-error path (the exact "silently incomplete" outcome XPROV-02b targeted); WR-02 (`070dc350`) — reasoning-tools 400 classify now requires the message signature, not `param=="reasoning_effort"` alone (reachable via XPROV-04's `reasoning_effort="none"` injection); WR-01 (`bbe8ee03`) — `provider_safe_utility_model` passes unrecognised ids through (fallback-bucket carve-out aligned with its sibling). WR-03 deferred → **SEED-127** (latent/pre-GA — forced-emission path on a reasoning_first model). Verification 15/15 automated must-haves (independently re-confirmed all 3 fixes in live code + cross-checked CR-01 against `api.ts`; 63/1370 pre-existing-rot baseline unchanged, scope = exactly the 18 declared files). **`human_needed`** — SC#10 4-axis live cross-provider UAT (real gpt-5.6 400-avoidance, real DeepSeek leak, real per-provider title quality) rolls forward as tracked debt in `175-HUMAN-UAT.md`. **SEED-040 trigger FIRED + strengthened:** model capabilities (incl. the new reasoning flags) still live hardcoded in `config.py` — the DB-override tier omits them and the routing seams bypass the DB entirely; the durable fix is Registry/UI-managed capabilities + inference-first (operator's "add a model from the UI, not in code" bar). **SEED-128 planted:** Claude.ai-style collapsible run/reasoning timeline (Phase 174 sketch input). No cloud parity added (no migration). **Next:** Phase 176 (Chat Render Correctness + Exec Reliability).
**Phase 164 complete (2026-07-20):** SECDEF Audit + Cross-Org Isolation Test Suite — **the milestone exit gate** (TEN-03, TEN-05, TEN-06, PRAG-01 → Validated). 5/5 plans. Migration 110 org-scopes the four `SECURITY DEFINER` retrieval/sharing functions in-body (`org_id = ANY(SELECT current_user_org_ids())` + owner branch on `auth.uid()`, never the spoofable `match_user_id`) + pins all four `search_path=''` with `OPERATOR(public.<=>)` (CVE-2018-1058) + keeps `is_system` universal (mig-109 FIX-A) + widens `document_chunks` SELECT RLS for PRAG-01. The load-bearing app half (164-04): producer retrieval RPCs + text-to-SQL/grep `query_user_documents` routed onto the Phase-163 asyncpg user-context (shared `_call_as_user` seam) so `auth.uid()` resolves in the detached producer — the two fragile regexes (`_inject_user_id`/`_inject_user_id_for_grep`) DELETED (RLS is the gate). SEED-091 (164-02): shared `_null_foreign_global_owner` nulls the seeding owner's `user_id` for non-owner readers across folders/skills/views. Exit gate `test_v3_4_org_isolation.py` = **22 passed / 1 xfailed**. **verify-work 2/2 PASS** (SC#10 4-axis cross-provider live + DB double-confirm; frontend null-owner UI Chrome-verified). **secure-phase SECURED — threats_open:0, ASVS L2** (8 mitigate + 1 accept verified vs source + live DB). **Deep review caught a Critical the exit-gate suite missed** (CR-01 — KB browse/read tools `ls`/`tree`/`read_document` leak cross-org via the org-blind service-role `folder_utils.py` helpers) + WR-01 (owner-nulling misses non-`is_global` descendants) → operator-**folded to Phase 165** (SEED-124), tracked live via an `xfail(strict)` marker; WR-02 (folder-scope SQL) fixed in-phase (164-05). **Cloud-parity owed at next production push:** migrations 099–110 + `SECRETS_ENCRYPTION_KEY` (in order). **Next:** Phase 165 (`is_global` retirement cleanup — MUST close CR-01/WR-01).
**Phase 163 complete (2026-07-20):** RLS Rewrite + Per-Request User-JWT Client Swap — **THE ATOMIC CRUX** (TEN-01, TEN-02, TEN-04 → Validated). The single load-bearing security transition of the milestone: membership-based Row-Level Security became the ENFORCED gate on every request path. Migrations 107 (TEN-04 org_id denormalize + index on document_chunks/skill_embeddings) + 108 (37-table membership-RLS rewrite) applied live; per-request user-JWT DB context on BOTH paths (supabase-py JWT-header swap + asyncpg `SET LOCAL ROLE authenticated` + claims); async writers routed to `get_service_role_supabase(org_id)` (refuses without an explicit org, D-05). 11/11 plans across 6 waves (the `threads.py` producer extraction was promoted to Phase 162.5 and landed Deep-byte-identical FIRST, per G-5/G-1). Live go/no-go (163-10): CONCUR-01 0.41s <1s, native-4 cross-provider round-trip, 95/95 isolation, Deep red-line EMPTY. **verify-work surfaced 1 regression** (Test 7: mig 108 org-gated the global/is_system OR-branch → solo-org topology hid the built-in skill-creator from 7/8 users) → **FIX-A gap closure (163-11, mig 109)**: platform/system content (is_system skill-creator + seeded is_global workflows) lifted OUT of the org-gate → universal (real skill-creator 1/8 → 8/8 live-confirmed); user-self-served is_global (folders/user skills) intentionally KEPT org-scoped until orgs gain members (166/167); FIX B (full pre-163 restore) REJECTED as cross-tenant broadcast. secure-phase **28/28 STRIDE CLOSED, threats_open:0** (added T-163-11 badge-spoof `is_system=false` WITH-CHECK + T-163-11b over-widening guard); verify-work re-run **8/8 pass, 0 issues**. **Cloud-parity owed at next production push:** migrations 099–109 + `SECRETS_ENCRYPTION_KEY` (in order). **Next:** Phase 164 (SECDEF Audit + Cross-Org Isolation Test Suite — the milestone exit gate).
**Phase 161 complete (2026-07-18):** Org/Dept/Role Schema (ORG-01, ORG-02 → Validated). Migration 104 authored + applied live: 8 org tables with membership-correct RLS from creation, the `current_user_org_ids()` SECDEF recursion-break (42P17-safe — proven live against the running DB), `current_user_has_permission()` + `create_org_with_default_dept()` helpers, the seeded 4-tier permission catalog (super-admin/org-admin/dept-admin/member), and a nullable `org_id` sweep across 23 user-facing tables. Additive / zero-behavior-change (Deep Mode byte-identical; empty tables + nullable columns). Verification passed 20/20 (independent live re-proof). Code review found 2 Critical → both fixed same-session (`07bf6a4e`): CR-01 the anon-callable SECDEF org-creation RPC locked to `service_role`; CR-02 org:manage→super-admin self-escalation blocked on org_members/dept_members write policies. WR-01 + 3 Info + the invited-role ceiling deferred → Phases 163/164/167 (`161-REVIEW.md`). **Next:** Phase 162 (Personal-Org Backfill). **Cloud-parity owed at next production push:** migrations 099–104 + `SECRETS_ENCRYPTION_KEY`.
**Phase 146 complete (2026-07-11):** Operator Foundation (ADMIN-01 → Validated). 6/6 plans, 4 waves. The v3.3 keystone: `operator_users` (org-agnostic system principal, deny-all RLS, one-way-door vs v3.4) + `operator_audit_log` + `org_id` stubs on the four owned roots (migrations 095+096, operator-applied live); router-level default-deny `require_operator` (byte-identical 404 — non-operators AND unauthenticated callers cannot distinguish real /admin routes from nonexistent ones) + per-action `operator_audit_floor`; `/admin/me`·`/admin/audit`·re-gated `/admin/backpressure`; startup seed from `OPERATOR_EMAILS` (idempotent, WORKER_COUNT=2-safe); probe-gated Control Room UI (5 sketch-061-B/062-A leaves + shell + amber-shield nav entry rendered OUTSIDE NAV_ITEMS, non-operator nav byte-identical + regression-locked). D-02 swap: `BACKPRESSURE_ADMIN_USER_IDS` + dev fail-open DELETED. Code review 2 Critical + 4 Warning → ALL fixed same-session (CR-01 audit envelope white-screen, CR-02 stale pool snapshot, WR-01 session-keyed probe, WR-02 unauthenticated 404 fold, WR-03 method-derived write verbs, WR-04 test seed guard); 9 Info deferred. Verification 24/24 automated + 3/3 live D-09 UAT operator-approved (invisible door proven by live curl: normal JWT + anon get identical 404s; operator 200). Cloud parity at promotion: paste 095+096 into cloud SQL editor; Coolify SET `OPERATOR_EMAILS`, REMOVE `BACKPRESSURE_ADMIN_USER_IDS`.
**Phase 147 complete (2026-07-11):** Operator Control Plane (ADMIN-02 + FLAG-01 → Validated). 9/9 plans, 3 waves (sequential — worktrees off). Builds on 146's operator gate: (1) ADMIN-02 read surface — additive Redis/Supabase/sandbox health probes on `/admin/backpressure` (3-state sandbox off≠down) + cross-user `GET /admin/runs` (D-Q1 no-migration kind derivation, server-derived `not_responding`); (2) operator Kill — `POST /admin/runs/{id}/kill` delegating to the SHARED `run_lifecycle._cancel_run_internals` extracted from `cancel_run` (owner path byte-equivalent), 404-non-discoverable, victim-blind self-cancel (D-03), 064-B honest zombie-heal wording; (3) FLAG-01 fail-closed capability kill-switches — two-layer HIDE (`openai_service.get_tools`) + REFUSE (`tool_dispatcher.dispatch_tool`, provider-UNIFORM — no `provider ==` fork) + proposer guard + D-05 workflow-launch block; migration 097 (3 `app_settings` booleans, operator-applied live) read through the 30s TTL cache with D-Q4 polarity (capability cold-read True, maintenance cold-read False, last-known-good on a blip); (4) maintenance/read-only — pure-ASGI `MaintenanceMiddleware` (off-switch-safe `/admin/*` allowlist, before-CORS, public `/health` flag) + end-user amber banner reading `/health` outside `/admin`. Control Plane recompose (D-08 promote 146 Overview, 063-B scroll, D-07 poll-with-visibility-pause). Code review 2 BLOCKERs → BOTH fixed same-session (CR-01 duplicate `ActiveRun` interface broke the real `tsc -b` build → renamed admin shape `AdminActiveRun`; CR-02 `PUT /admin/flags` reported success + wrote a false audit row on a swallowed DB write failure → `save_app_settings` returns bool, `set_flag` raises 500 with no false ledger); 4 Warning/Info deferred. 82 backend tests green; verification 8/8 code-level truths → human_needed → operator-approved live SC#10 UAT 8/8 (cross-provider Kill, multi-tool, parallel-thread isolation, not-responding tags, all-4-switches both directions, maintenance 503+banner, zombie-heal wording, poll/visit honesty). Cloud parity at promotion: paste migration 097 into cloud Supabase SQL editor (new `app_settings` columns).
**Phase 150 complete (2026-07-13):** Secrets at Rest (SEC-01 → delivered). 5/5 plans, 2 waves, sequential (worktrees off — `venv`/`node_modules`/`.env` are gitignored so fresh worktrees can't run verification; use_worktrees stays false). App-layer `cryptography` MultiFernet with an explicit `enc:v1:` envelope (`backend/app/security/secret_cipher.py`) — NOT pgsodium. Encryption wired at exactly two seams: encrypt-on-write in `save_app_settings` + decrypt-onto-a-copy in `_build_settings_from_row` (30s cache keeps ciphertext; an undecryptable column fails soft to env via the existing `_val` DB>env chain, zero new fallback code). Migration 100 added the 10 missing `app_settings` secret text columns (only `embedding_api_key`/`rerank_api_key` existed — D-150-08), applied live + full-schema regenerated. Boot lifespan validates the master key UN-wrapped (malformed ⇒ all WORKER_COUNT=2 workers refuse start; missing ⇒ loud warn + plaintext) then runs a best-effort idempotent sweep; `update_settings` now raises HTTP 500 on a failed save (D-150-07, closes the silent-success bug). Operator three-state encryption tile on the Control Plane board (encrypted=green / no-key=NEUTRAL grey / error=red). SC#1 (ciphertext at rest) + SC#2 (round-trip) proven. Code review found + FIXED same-session **1 Critical** (CR-01 SQL injection — unvalidated provider `id` spliced into the UPDATE column-name position → SQL-identifier allowlist guard at the write seam + 422 for unknown provider ids + injection tests) + 2 Warnings (WR-01 boot sweep aborting on one undecryptable column → per-column guard; WR-02 false-green tile on empty/failed row → honest `unknown` state), plus a prior-phase test-mock regression from D-150-07 (mock returned None). Verification 11/11 must-haves (goal-backward — live DB + full test suite re-run, fixes independently confirmed). **secure-phase (`/gsd:secure-phase 150`) still pending** (security_enforcement=true, no SECURITY.md). Cloud parity DEFERRED: migrations 099+100 + the `SECRETS_ENCRYPTION_KEY` Coolify env var must land before 150 ships live.
**Prior:** v3.1 (Workflow & Skill Studio) — 2026-06-28 (9 phases, 40 plans; git tag v3.1); v3.0 closed 2026-06-21 (24/24 functional requirements). v2.9 STRETCH 105–109 remain backlog carry-forwards.
**Phase 135 complete (2026-07-02):** Self-Improvement Loop (SI-01). 9 plans (7 build + 2 gap-closure) across 4 waves. The system now closes the loop: eval results + Tuner signal → `skill_proposer_service` drafts an instruction-body diff (migration 083 `skill_proposals`, owner-scoped RLS) → user reviews the diff in the SkillEvalSection proposal card and explicitly approves or rejects → approval creates a new immutable skill version and auto-re-evals it on the same provider+model → an honest promotion gate promotes or surfaces `not_promoted` with real gate counts, force-promotable with `override_forced=true` recorded (D-06). Never auto-applies — human in the loop everywhere. Pitfall #1 closed via the draft-instructions override seam (Deep byte-identical). Verification: third pass **passed 5/5** — gap wave fixed CR-01 (force-promote optional body), CR-02 (cross-worker reconcile liveness), CR-03 (approve launch-failure recovery); live SC#10 4-axis UAT U1-U11: 10 passed / 0 issues / 1 blocked (U4 OpenRouter third-party upstream; axis proven on OpenAI + Anthropic + Google), incl. U9 interrupted-run honesty + U10 failed-gate force-promote live. 2 minor non-blocking findings root-caused in 135-HUMAN-UAT.md (gate-count display undercount in total-provider-outage edge; eval model dropdown drift from MODEL_CAPABILITIES) → backlog candidates; U11 panel-density → Phase 137 design input. Secure-phase pending.
**Phase 124 complete (2026-06-26):** Workflow Studio UX — Soul + Strict↔Loose (WUX-01, WUX-02). 3 plans / 2 waves, pure-frontend re-skin (no migration, no backend, no new API). Wave 0 extracted the duplicated tier-derivation + 3 copies of the phase-glyph map into ONE shared `soulData.ts` (the consistency invariant — the three soul sizes can never disagree) + two net-new components: `WorkflowSoul` (the scale-keyed 5-atom soul: purpose hero · needs · glyph-dot spine · ONE tier chip glyph+WORD · honest output) and `PhaseSpine` (ribbon/index-free glyph-dot row). Wave 2 mounted the soul at card scale on every library card + the two-door `WorkflowDoorSwitch` ("Describe & run" loose / "Author & govern" strict, nothing removed, advanced one click away — D-01/D-05), and at run scale (additive harness-gated `PanelSection` in `WorkspacePanel`, Deep Mode byte-identical) + publish scale (soul block prepended above the untouched gauntlet ladder, D-06). **G-5 red line held:** `PhaseTimeline.tsx`/`PhaseCard.tsx` byte-identical (pinned blob hashes unchanged). Code review found 1 blocker (CR-01: the loose describe door silently dropped the user's typed requirement → dead-ended on an empty Builder; the plan's `onDescribeDraft` wiring was missed) — FIXED in `d60d04b9` by seeding the govern-door Builder with the typed text (`initialDescribe`) + auto-running the existing generate→draft flow once (`autoDraft`); plus WR-01 (live soul preview) + WR-02 (React key). Verify 4/4 must-haves + operator UAT 7/7 (sketch-match 046-A/047-A, A1 label, Deep-Mode byte-identical, SC#10 cross-provider smoke, mobile 375px). Frontend suite 326/326 in touched areas; the only full-suite failures are pre-existing rot (SEED-056), none in 124's surface.
**v3.0 Document Management — SHIPPED (2026-06-21):** Phases 110 (DM foundations) → 111/111.1 (metadata enrichment + configurable multi-provider embeddings) → 112 (doc detail panel + manual edit) → 113/114/115 (virtual folders — filter compiler, range/date + no-DSL builder + Views sidebar, agent tool) → 116/117 (document relationships — leak-safe backend + agent tool, panel UI) → 118 (auto-classification — suggest-then-confirm) → 119 (governance health). Net-new substrate: a closed-registry filter-AST → parameterized-jsonb compiler + two leak-safe share-don't-fork service cores (`document_view_resolver.py`, `document_relationship_service.py`). `threads.py` untouched across the whole milestone (G-5); near-zero new deps.
**Phase 069 complete (2026-05-14):** PdfExtractor abstraction scaffold shipped — `PdfExtractor` ABC + `LegacyExtractor` (today's pypdf + pdfplumber + python-docx pipeline rewrapped) + `get_extractor(mime)` dispatcher live in `backend/app/services/extraction_service.py`; `documents.py` upload + re-ingest paths routed through the seam; binding golden-fixture gate live (synthetic PDF + DOCX). Zero observable behavior change confirmed via golden gate; Q-v2.6-06 closed via D-PRD-07 appendix (PyMuPDF AGPL-3.0 fallback license posture locked). Phase 071 will plug Docling primary + PyMuPDF (subprocess-fenced) fallback behind the same dispatcher.
**Phase 071.1 complete-partial (2026-05-15):** Docling SC#1 retry — threadpool, timeouts, PyMuPDF fallback. Plan 01 shipped clean (4 commits): `/reextract` async handler now wraps 6 sync supabase calls in `run_in_threadpool` (D-v2.5-01 compliance), `asyncio.wait_for(timeout=EXTRACTOR_DOCLING_TIMEOUT_S + 10)` wraps the Docling extract step as Layer 2 wall-clock fail-safe, and PyMuPDF auto-fallback fires on Docling timeout only (narrow override of D-071-11). Three new env knobs (`EXTRACTOR_DOCLING_TIMEOUT_S` / `_DISABLE_TABLE_STRUCTURE` / `_IMAGES_SCALE`). 8 new tests + reset_docling_singleton fixture. Plan 02 live UAT against thesis pair: 4-min Docling stall **structurally eliminated** (thesis PDF that previously stalled indefinitely now completes in 125s; backend `/health` stayed responsive at 1-2s during in-flight extract vs frozen previously). The 20% binding gate per D-071.1-06 stays RED at 89.7% tables / 100% images delta — but the root cause has shifted from "Docling stalls" to "PDF and DOCX extraction quality differ structurally" (deeper PDF-vs-DOCX semantic gap, NOT a Plan 01 regression). User-decided disposition 2026-05-15: ACCEPT-DEGRADED, escalate the delta gap to Phase 071.2 (proposed) — PDF-side extraction quality (TableFormer A/B with `DISABLE_TABLE_STRUCTURE=1`, persisted-vs-telemetry accounting reconciliation, possible SEED-006 multimodal-quality promotion).
**Phase 071.2 complete (2026-05-15):** Ingestion plumbing + per-aspect extraction dispatcher. 5/5 plans shipped; 8/10 success criteria code-verified; 2 env-blocked (D-071.2-12 quality floor on the thesis PDF + PDF Form-XObject image lift) parked in `071.2-HUMAN-UAT.md` because **both Docling AND the PyMuPDF subprocess fallback crash on the thesis PDF in WSL** (Docling timeout 136s, PyMuPDF subprocess `MemoryError`). Code deliverables: (a) `/upload` returns 201 in ~1s via `_upload_pipeline` BackgroundTask helper (extract+chunk+multimodal moved off the request path); (b) all 6 `/upload` + 3 `/reingest` Supabase calls wrapped in `run_in_threadpool` (closes D-v2.5-01 on the last two foreground-extract routes); (c) chunker reads Docling's `full_markdown` instead of `export_to_text()` (closes the 95%-chunks-drop) + `do_formula_enrichment=True` for LaTeX equations; (d) `multimodal_service.extract_and_store_tables/_images` widened with `extracted_doc` kwarg precedence (closes the telemetry-vs-storage mismatch); (e) `/reextract` returns 404 (not 500) on `is_latest=False`; (f) **per-aspect extraction dispatcher** at `backend/app/services/extractors/aspects/{text,tables,images_pdf,images_docx,equations}.py` + `extract_composable(raw, mime, engines)` composer + `app_settings.extraction.*` columns (migration 045) + `?engines=` per-call hint on `/upload` and `/reextract` + backward-compat shim for legacy `get_extractor(engine=...)`; (g) `zip_xpath_docx` engine verbatim-ports Docling's `MsWordDocumentBackend` XPath (closes Phase 072 RAG-MM-LIFT-02 at the unit-test level); (h) SEED-017 (PyMuPDF4LLM AGPL), SEED-018 (Marker GPL), SEED-019 (PyMuPDF subprocess OOM + non-Docling engine evaluation) all planted. **User-decided pivot 2026-05-15** (see [[feedback-docling-skepticism]]): Docling repeatedly broke fast/light extraction without delivering on table/image recall. The per-aspect dispatcher is now the architectural deliverable — Docling stays available as an opt-in engine, but Phase 071.3 will diagnose the PyMuPDF subprocess OOM and benchmark non-Docling table/image engines (PyMuPDF in-process, Camelot, Tabula, PyMuPDF4LLM, Marker), then ship migration 046 flipping defaults to the benchmark winner. The "Docling-first" thesis from the v2.6 PRD is formally retired in favor of "swap-by-default optionality."
**Phase 072 complete (2026-05-17):** Multimodal Lift + DOCX Completeness. 5/5 plans shipped (Plans 01–05 including in-band gap closure for VERIFICATION.md Gap 2 + Gap 3 / BUG-260517-01). Plans 01–02: replaced `_MAX_VISION_CALLS` / `_MAX_B64_BYTES` hardcoded constants with `app_settings.multimodal_max_*` reads (defaults 100 / 4096 KB, migration 044); shared `_downscale_b64_for_vision` helper; persist-empty-rows contract for failed vision-LLM calls (D-072-03/04); DOCX `zip_xpath_docx` engine catches floating + header/footer images via `wp:anchor`/`related_parts` walk; content-hash dedup for both DOCX and PDF image paths; description-prefix labels for DOCX images (`[Image header]:`, `[Image inline]:`, `[Image floating]:`). Plan 03: `/reextract?retry_empty_descriptions_only=true` short-circuit path refills empty rows without delete-cascade. Plan 04 (gap closure for Gap 2): rewrote `_reextract_refill_empty_descriptions` to use `extract_composable` per-aspect dispatcher — legacy `extract_pdf_images` / `extract_docx_images` were inline-shapes-only and returned `[]` on operator's thesis DOCX (58 floating images). Plan 05 (gap closure for Gap 3 / BUG-260517-01): `/reingest` cascade widened from 2→3 deletes (chunks + tables + images, doc-id-scoped, children-before-parent) to eliminate orphan chunks after `/reextract → /reingest` sequence; `documents.chunk_count` semantics formally documented as TEXT-CHUNKS-ONLY. Both gap closures verified on production data (operator's thesis DOCX): **Gap 2 = 58/58 = 100% refill** (pre-fix 0/58 — wall time 108s for 58 vision-LLM calls); **Gap 3 = chunk count matches actual + idempotent on second `/reingest`**. `vision_sweep` engine + ≥80% recall target DEFERRED to SEED-021 spike-first path per user cost concern. RAG-MM-LIFT-01 + RAG-MM-LIFT-02 → Validated. Code review surfaced 3 warnings (0 critical): WR-01 (load-bearing test-only) — `test_reingest_reextract_orphans.py` patches `app.services.openai_service.embed_texts` but `multimodal_service` imports from `app.services.embedding_service`; orphan-count invariant still holds (chunk count is orthogonal to embeddings) but test likely hits real OpenAI API during live-Supabase runs. Tightening deferred to next polish bundle.
**Phase 075.4 complete (2026-05-23):** Cross-Provider Cleanup + Per-Thread State + E2E Backstop (inserted phase). 6/6 plans shipped across 3 waves; 26 commits; 10/10 ROADMAP Success Criteria code-verified; 22/22 D-075.4-* locked decisions honored; 8/8 behavioral spot-checks PASS. Closed 6 cross-provider bugs surfaced by operator UAT after 075.3 (per [[feedback_regressions_during_075_3_uat]]): **BUG-260523-01** (composer locked globally during any stream — lifted 5 cross-thread globals in `streamsStore.ts` to per-thread `Map<threadId, T>` / `Set<threadId>` + 4 new thread-scoped selectors; Phase 067.5 Branch D-3 `clearThreadBucket` guard preserved verbatim; per-thread composer disable at `ChatArea.tsx:222`); **BUG-260523-02** (Gemini-3 `thought_signature` missing — 3-stage wiring: capture in `_on_chunk_openai` + echo in `_reconstruct_history` + persist via conditional spread in `persisted_tool_calls`, all provider-gated on `active_provider_name == "google"`); **BUG-260523-03 + BUG-260522-02 + BUG-260521-02** (OpenRouter duplicate outputs + missing url + pinned-panel no download link — SHA-256 content-hash dedup with `supersedes` field in `harvest_output_files`; `OutputFileCard` `supersedes` UI affordance); **BUG-260522-01** (empty-response fallback misleading iter count — one-line `{iteration + 1}` fix). Streaming reliability: terminal-status race closed via inline `_emit('done')` removal + `_shielded_finalize` so `runs.status` UPDATE precedes terminal sentinel; sub-agent truncation warning + iteration-cap silent-drop guard both emit `system_warning` events (`kind='context_truncated'` / `kind='iteration_cap_dropped_tool_calls'`) AND persist as `messages` rows for reload-survival (gated on migration 048 — operator-applied 2026-05-23). Provider routing: `UnknownProviderError(ValueError)` raised at FastAPI lifespan startup (D-075.4-B1/B2/B3) — eliminates silent-ollama-fallback footgun; `get_model_capability()` registry-or-inference pattern from 075.3 extended to 6 hardcoded sites; `ModelCapability` extended with `uses_max_completion_tokens` + `supports_parallel_tools` optional fields populated on 14 model rows. Perf + UX + safety: `React.memo(MessageItem)` + `useMemo(MarkdownRenderer)` + `useCallback` stabilization in `ChatArea`; lazy `recharts` (~359 KB chunk-split); `save_override` sentinel allowlist guard (closes WR-02 footgun from 075.3); Settings 2-click bug closed via `flushSync` wrap (D-075.4-F3); `stderr` per-line badge in `ExecuteCodeBlock`. E2E backstop: Playwright + auth/db-teardown/langsmith fixtures + 6 scenarios mapping 1:1 to regression classes (parallel composers / Gemini-3 thought_signature / OpenRouter pptx / done-latency / unknown-model inference / iteration-parity-RED-by-design); `restart-backend.{sh,ps1}` (Windows orphan-worker aware); `/health` endpoint; `.github/workflows/frontend-tests.yml` CI workflow; `075.4-TEST-TRIAGE.md` categorizing 98 pre-existing backend failures with per-file owners (FK-violation cluster of 6 closed via AsyncMock; 92 remaining routed to Phase 076 ~80 + Phase 077 ~10). **Normative rule landed** in CLAUDE.md (SC#10): "Any phase touching streaming, agent loop, provider routing, or UI state MUST include UAT rows for cross-provider × multi-tool × parallel-thread × long-message scenarios." Operator UAT walkthrough 2026-05-23 dispositioned 5 items: migration 048 PASSED; Playwright substrate verified (live execution deferred to operator session block); Settings 2-click verified via unit test; CI dry-run deferred to first real PR. Code review (1 Critical / 7 Warning / 9 Info) — advisory only, CR-01 (auth.fixture.ts committed local-dev creds as fallback defaults) flagged but matches author rationale + `reference_local_dev_app.md` memory + T-075.4-07 mitigation. Migration 048 applied operator-side via Supabase Studio.
**Phase 085 complete (2026-05-28):** New LLM Tools — `write_todos`, `task` (sub-agent), `ask_user` (human-in-the-loop pause/resume). 5 plans shipped (4 + 1 in-band gap closure for BUG-260528-01 cross-provider sub-agent footgun). Migration 055 (`todos` table + `runs.parent_run_id` + `messages.tool_calls.kind` doc-comment). FIRST Redis pub/sub usage in the codebase via SUBSCRIBE-first ordering in `ask_user_service.py` + cancel-sentinel + lifespan shutdown broadcast. Sub-agent loop in `task_service.py` with per-run `asyncio.Semaphore(3)` + global Redis Lua-atomic counter (cap 20). Tool registry 21 → 24. D-085-16 sub_agent_service.py freeze preserved (0 diff lines). 124/124 Phase 085 tests GREEN. UAT operator-approved 2026-05-28; 5 manual operator rows roll forward (HUMAN-UAT.md). Code review: 14 advisory findings (1 Critical narrow-edge pubsub leak, 7 Warning, 6 Info).
**Phase 091 complete (2026-05-31):** Harness Engine + 5 Phase Types + Gates + Whitelist + Seeds. 8 plans (7 build + 1 gap-closure) across 6 waves; ~80% composition of shipped substrate, zero new deps. `harness_engine.run_workflow` is a hand-rolled async transition loop driving published `WorkflowDefinition`s through `phase_index` order over the Phase 090 tables, with the strict 2-phase write (mark-active → execute → atomic complete-with-output), publish-time reachability lint, and a `PHASE_TYPE_REGISTRY` dispatch seam filled by 5 thin executors (`programmatic`/`llm_single`/`llm_agent`/`llm_batch_agents`/`llm_human_input`) calling task_service/ask_user_service/tool_dispatcher — never reimplementing loops or editing byte-frozen provider paths. Validation gates (4 kinds, no-eval closed registries) + bounded retry ≤3 with consecutive-identical short-circuit + on_failure routing (fail_run/retry/skip_to_phase) + per-phase step & wall-clock caps. Per-phase tool whitelist (HARNESS-05) at the single `dispatch_tool()` guard + tool-count budget (TOOL-05) — both literal no-ops when `phase_whitelist is None` (Deep Mode byte-identical, Phase 089 invariant preserved). Resumability (HARNESS-03): startup sweep + `claim_run` CAS + ask_user subscribe-before-emit. Migration 061 ships 4 global/published/immutable seed templates covering all 5 phase types (operator-applied via SQL editor). **Code review found + closed 2 criticals + 4 warnings in gap-plan 091-08** (migration 062): CR-01 `claim_run` was a no-op self-transition → real `claimed_at` lease CAS (fixes WORKER_COUNT=2 double-execution); CR-02 >64KB output silently dropped → inline store; WR-04 TOOL-05 budget computed-then-discarded → wired to sub-agent schemas; WR-05/06 ask_user run-scoped; WR-03 same-validator routing. Harness suite 95/95 green, 0 skips, against live DB (migrations 060/061/062). WR-01/02 (resume ctx inputs/model rehydration) DEFERRED to Phase 092 (owns run-creation) as SEED-047, proof gate Phase 096. SC#10 4-axis cross-provider UAT persisted in 091-HUMAN-UAT.md, blocked on the 092 workflow-start trigger. Verification 6/6 automated must-haves, human_needed → operator-approved 2026-05-31.
**Phase 092 complete (2026-06-01, passed_with_overrides):** Dual-mode wiring + Continue button. `create_workflow_run` is the single live run-creation path (atomic INSERT workflow_runs + workflow_phases + threads anchor; persists inputs+model → SEED-047). MODE-01 (Deep/Harness switch + run creation), MODE-02 (server-side Harness→Deep authz lock, 409), CONT-01 (Continue) → Validated. F1–F8 closed across gap-plans 092-05/06/07 (harness_audit.user_id crash, wedged lock, producer_run_id vs workflow_run id FK routing). A Harness Research→Summarize workflow runs end-to-end + renders a grounded sources+confidence answer (live on OpenAI). F9 (harness cross-provider parity, OpenAI-only) + F10 (ask_user round-trip) → routed to Phase 093.
**Phase 092.5 complete (2026-06-01, passed_with_overrides):** Provider Gateway Extraction. `agent_loop.py`'s provider-streaming dispatch extracted into the new `provider_gateway/` package (events.py canonical schema + dispatcher.py `open_stream` returning `(stream, calling_mode)` + anthropic.py/google.py verbatim adapters + openai_compat.py for the entangled OpenAI/OpenRouter/Ollama+deepseek/moonshot/zhipu/minimax branch; the three `_on_chunk` callbacks unified into ONE shared consumer). `calling_mode` surfaced through the seam — the structural fix for the harness-OpenAI-only bug (Pitfall 3) that Phase 093 builds on. **Deep proven byte-identical on the native-7** (RED LINE held): Anthropic byte-identical (0 SSE skeleton edits); the other 6 providers' residuals confirmed pure LLM tool-path-count + chunk-cadence noise by TWO adversarial workflows (14 agents) — a shared-consumer regression would have hit Anthropic, which diffed to zero. Eval non-regressing (native-7 16/28 = 16/28). I1–I8 round-trip invariants named (092.5-06-SUMMARY.md). Code review 0 critical / 1 warning (WR-01 `emit_sse` schema-drift fixed inline) / 5 info deferred. SEED-048 planted (embeddings cross-provider SPOF — OpenAI-only embeddings break document search for ALL providers; surfaced when an OpenAI quota outage BLOCKed the gate). Playwright E2E backstop deferred (pre-existing stale `/login` assertions, unrelated to this backend refactor). Next: Phase 093 (Harness Cross-Provider Parity — consumes the gateway).
**Phase 099 complete (2026-06-10):** Workflow ↔ Skill Composition. 6 plans (4 build + 2 gap-closure) across 4 waves. An `llm_agent`/`llm_single`/`llm_batch_agents` phase can now carry an optional `skill_ref`; the skill's instructions + file manifest compose into the phase framing (`_skill_block` at 3 executor seams, instructions-only for `llm_single` per D-07), `read_skill_file` is auto-whitelisted, and the skill's content is snapshotted at first kickoff (D-03a) into the locked definition — instructions + files physically copied to a Storage prefix so editing/deleting the live skill cannot change a published workflow. Deep-mode chat byte-identical (snapshot gate is a literal no-op outside workflow skill phases). First verification found 2 mock-masked production blockers (CR-01: manifest read a nonexistent `skills.files` column → fixed to query `skill_files`; CR-02: `run_task_sub_agent` didn't propagate `skill_snapshot` onto `sub_ctx` — same class as the 096-02 `phase_whitelist` gap → one-line propagation + live-chain regression test that fails pre-fix). Re-verification 7/7 passed; post-merge 64 tests + 124-test regression sweep green. Post-fix code review 0 critical / 4 warning (3 carried, 1 new WR-04 global-workflow persist-back ownership) / 4 info — advisory. WFSKILL-01 → Complete. Security gate pending (`/gsd:secure-phase 099`).
**Phase 096 complete (2026-06-07):** Eval Harness + Cross-Provider Verification + Concurrency — the last v2.8 phase. 8 plans / 3 waves / 2 operator checkpoints. (1) D-02 eval seed: `eval_slow_step` programmatic fn (20s mid-`programmatic` kill window) + migration 066 `eval_coverage` published global workflow touching all 5 phase types (operator-applied, live-verified). (2) D-01 CI structural gate: `test_096_ci_workflow_regression.py` drives the REAL harness engine offline via a scripted fake gateway provider — caught + fixed a live security gap on first run (`phase_whitelist` never propagated to sub-agent ctx). (3) BUG-260605-01 closed both halves: INSERT-only ask_user expiry at 4 terminal sites + `/pending` dual-namespace liveness filter (backend); `ApiError` status propagation + PendingAskCard visible expired state + `created_at`-seeded countdown (frontend). (4) BUG-260530-01 closed: StreamsProvider thread-keyed LRU-3 stream pool (D-09/D-10/D-11). (5) Eval workflow rows per provider + D-04 capability table emitter (live OpenAI dry-run PASS; double-encoded jsonb root cause logged DI-096-06-A). (6) Operator measurement scripts: `restart_smoke.py` (3 kill points, human-is-the-restart) + `conc_probe.py` (N=10 fan-out / p95 / AnyIO budget). (7) D-05 full-registry model curation: live /models across 8 providers, 4 targets curated newest-first (operator-approved diff; CURATE_STALE=0 post-apply; o3/o4/deepseek-chat/-reasoner removed as not-served; claude-opus-4-8 + MiniMax-M3 + gpt-5.5-pro added). Code review 0 critical / 4 warning — ALL FIXED in-phase (WR-01 restart-smoke jsonb normalization, WR-02 resume-sweep None-guard, WR-03 tool_refused audit keyed to workflow_run_id, WR-04 conc_probe live bound). Net-new test failures vs phase base: 0 (62=62 byte-identical, baseline-worktree-proven). Verification human_needed → operator-approved; 5 live proofs persisted in 096-HUMAN-UAT.md (native-7 eval run, 3-kill-point restart smoke, 4-axis scoreboard, N=10 probe, WR-03 refusal-row spot-check). Security gate pending (`/gsd:secure-phase 096`).
**Stack:** React/Vite + FastAPI + Supabase (Postgres + pgvector + Storage) + Redis Streams (run-backed streaming)
**Codebase:** ~160K LOC (Python + TypeScript) post-v2.5; 531 files touched across the v2.5 window
**Phases shipped:** 73 phases across 7 milestones (v1.0–v2.5); 144+ plans executed
**Design system:** Aether Intelligence — Deep Midnight theme, glassmorphic cards, gradient accents, mobile-responsive
**Docker:** `llm-sandbox` container for code execution (`SANDBOX_ENABLED=true`); Redis container for run-backed streaming buffer
**Known tech debt going into next milestone:**
- Phase 064 (Validation Harness) — DEFERRED (intentional; scenarios E/F/H validated organically by 067.x UAT, G + multi-tab sync remain partially deferred)
- Carry-forward seeds: SEED-009 (claude-haiku max_tokens cap), SEED-010 (OpenRouter synthetic-timeout protocol), SEED-011 (test_059 fixture-teardown bug)
- Forward-looking seeds for next-milestone selection: SEED-002, SEED-012, SEED-013, SEED-014
- **Docling integration shipped stability, not quality (2026-05-15).** Phase 071.1 retry on the thesis pair confirmed Docling produces zero improvement in stored `document_tables` / `document_images` counts vs `pypdf-legacy` (same 4 tables / 2 images on PDF, same 39 / 0 on DOCX). PDF chunk count dropped 95% under Docling (~400 → 19) — suspected text-extraction regression. Docling is 25-100× slower on PDFs (~125s vs 1-5s legacy) and loads ~600 MB models + RapidOCR even when `do_ocr=False`. **`EXTRACTOR_PRIMARY=legacy` reverted in `backend/.env` 2026-05-15** for new uploads + `/reingest`; Docling/PyMuPDF remain opt-in per-doc via `/reextract`. 10 open investigations captured in `.planning/phases/071.1-.../071.1-CARRY-FORWARDS.md`; SEED-006 (multimodal extraction quality) retested + addendum added confirming the storage-layer bottleneck is unchanged since 2026-05-02. v2.6 PRD's "Docling-first" thesis is informally reversed pending Phase 071.2 wiring diagnostics + Phase 072 / SEED-006 multimodal lift.

</details>

## Requirements

### Validated

*Pre-existing (from prior modules):*

- ✓ Chat interface with SSE streaming — Module 1
- ✓ Document ingestion with multi-format support (PDF, DOCX, HTML, Markdown via pypdf + python-docx) — Module 5
- ✓ Hybrid search (keyword + vector with RRF fusion) — Module 6
- ✓ Document analysis sub-agent (loads full document into isolated context) — Module 8
- ✓ Tool calling framework (multi-tool dispatch loop) — Module 7
- ✓ Row-Level Security for per-user data isolation — Module 2
- ✓ Supabase Auth with JWT verification — Module 1
- ✓ Thread and message management — Module 1
- ✓ Real-time ingestion status via Supabase Realtime — Module 2
- ✓ Metadata extraction (LLM-structured JSON) — Module 4
- ✓ Record manager (deduplication via SHA-256) — Module 3
- ✓ Text-to-SQL tool (`query_documents`) — Module 7
- ✓ Web search fallback (Tavily) — Module 7

*v1.0 milestone:*

- ✓ Nested folder structure with unlimited depth — v1.0 Phase 1
- ✓ Global folders (shared across all users) and per-user folders (private) — v1.0 Phase 1
- ✓ Document-folder integration (folder_id FK on documents, move document, move folder) — v1.0 Phase 2
- ✓ Store full extracted markdown alongside chunks for grep/read operations — v1.0 Phase 2
- ✓ Folder CRUD in ingestion UI (create, rename, delete folders) — v1.0 Phase 3
- ✓ Upload files to selected folder in UI — v1.0 Phase 3
- ✓ `ls` tool — list files and subfolders in a given path — v1.0 Phase 4
- ✓ `tree` tool — hierarchical structure with depth limit and truncation — v1.0 Phase 4
- ✓ `grep` tool — regex search over document content, returns matching document names — v1.0 Phase 5
- ✓ `glob` tool — file pattern matching against document names — v1.0 Phase 5
- ✓ `read` tool — read full document or line range — v1.0 Phase 6
- ✓ Explorer sub-agent — orchestrates KB tools for synthesized exploration answers — v1.0 Phase 7
- ✓ Explorer mode selector in chat UI (General / Explorer toggle) — v1.0 Phase 7
- ✓ Visual indicator for global vs per-user folders — v1.0 Phase 8
- ✓ Global folder RLS: documents in global folders readable by all authenticated users — v1.0 Phase 8
- ✓ Folder-scoped chat threads: RAG retrieval auto-scoped to folder subtree — v1.0 Phase 8
- ✓ Folder detail info bar: compact stats in ingestion UI — v1.0 Phase 8

*v2.0 milestone:*

- ✓ Persistent Tool Memory — store tool results in JSONB, reconstruct full tool call history on conversation load — v2.0 Phase 9
- ✓ Agent Skills Core — skills table with CRUD, global/private ownership, RLS, Supabase Storage bucket — v2.0 Phase 10
- ✓ Skill File Attachments — upload/list/delete files on skills — v2.0 Phase 10
- ✓ Skill tool dispatch (`load_skill`, `save_skill`, `read_skill_file`) wired into LLM chat loop — v2.0 Phase 11
- ✓ Skill catalog injection into General Mode system prompt; Explorer Mode gated out — v2.0 Phase 11
- ✓ `skill_activated` SSE event emitted on tool dispatch; frontend Zap indicator — v2.0 Phase 11/12
- ✓ Skills UI — Skills tab with full CRUD, toggle, share, "Try in Chat" — v2.0 Phase 12
- ✓ Skill-creator seed skill pre-loaded as global skill — v2.0 Phase 12
- ✓ Skills Open Standard ZIP import/export (agentskills.io format) — v2.0 Phase 13
- ✓ Code Execution Sandbox (Docker/llm-sandbox, session persistence, SSE streaming) — v2.0 Phase 14
- ✓ Code Output UI — ExecuteCodeBlock with streaming terminal + file download cards — v2.0 Phase 15
- ✓ Skill File Management UI — upload/list/delete files on skills — v2.0 Phase 16

*v2.1 milestone:*

- ✓ Rolling context window trimming with atomic tool-pair removal — v2.1 Phase 18
- ✓ Inter-iteration trim: tool result messages removed atomically between agent loop iterations — v2.1 Phase 18
- ✓ Sub-agent content cap (600k chars) enforced before API call — v2.1 Phase 19
- ✓ Blank response guards: force-no-tools empty content fallback + finish_reason=length error event — v2.1 Phase 20
- ✓ Keyword search folder scope — v2.1 Phase 21
- ✓ Read document context capped at 3,000 chars with truncation note — v2.1 Phase 22
- ✓ Metadata case normalization (document_type/language) — v2.1 Phase 22
- ✓ System prompt confidence hedging + structured citation format guidance — v2.1 Phase 23
- ✓ Settings file TTL cache (5s) on `_load_override()` — v2.1 Phase 24
- ✓ Sentence boundary chunking fix — v2.1 Phase 24
- ✓ Sub-agent model auto-selection per provider — v2.1 Phase 25
- ✓ Provider-aware context budgets — v2.1 Phase 25

*v2.2 milestone:*

- ✓ F-01 Citations — collapsible passage cards with exact retrieved text — v2.2 Phases 26–27
- ✓ F-05 Confidence — High/Medium/Low badge with colour coding — v2.2 Phases 26–27
- ✓ F-02 Document versioning — upload new versions, view history, restore — v2.2 Phases 28–29
- ✓ F-06 Audit log — immutable action log with filter, paginate, CSV export — v2.2 Phases 30–31
- ✓ F-08 Suggested follow-up questions — 2–3 clickable pills after each response — v2.2 Phase 32

*v2.3 milestone:*

- ✓ F-03 Cross-Thread Memory — remember/recall tools with auto-injection — v2.3 Phases 33–34
- ✓ F-07 Multi-Modal Table & Image Extraction — pdfplumber tables, vision-LLM image descriptions, query_tables tool — v2.3 Phases 35–36
- ✓ F-09 Knowledge Health Dashboard — most-retrieved, never-retrieved, low-confidence, stale metrics with action hooks — v2.3 Phases 37–38
- ✓ F-10 User Feedback Loop — thumbs up/down with reason selector, feedback stats in Library Health — v2.3 Phases 39–40
- ✓ UI Deep Midnight Redesign — glassmorphic ToolCallPanel, gradient CitationCards, floating pill MessageInput, AppDock, 3-pane SkillsPage, mobile-responsive NavPanel — v2.3 Phases 41–43
- ✓ STREAM-01: Stop cancels SSE immediately — v2.4 Phase 44 *(KI-001: in-flight LLM runs to yield point)*
- ✓ STREAM-03: Partial responses persisted on stop (asyncio.shield) — v2.4 Phase 44+55
- ✓ CHAT-01: Thread delete confirmation dialog (AlertDialog) — v2.4 Phase 45
- ✓ CHAT-02: No ghost content after thread delete (clearMessages on switch) — v2.4 Phase 45
- ✓ CHAT-03: Folder selector on new chat creation — v2.4 Phase 45
- ✓ DOC-01/02/03: Version-aware document delete with cleanup and promotion — v2.4 Phase 46
- ✓ DOC-04/05/06: Root document visibility, specific upload errors, root upload — v2.4 Phase 47
- ✓ SETT-01/02: Web search toggle in Settings, tool excluded when off — v2.4 Phase 48
- ✓ NAV-01/02: Icon label alignment, logo visible when sidebar collapsed — v2.4 Phase 48
- ✓ HLTH-01/02/03/04: Paginated health dashboard, accurate labels, actionable empty states — v2.4 Phase 49
- ✓ CTX-01/02/03/04/05: Context-aware sub-agent routing, per-model settings, tiktoken estimation — v2.4 Phase 51
- ✓ MDL-01/02/03/04/05: Multi-provider model routing, fallback on 404, resolved model in Settings — v2.4 Phase 52
- ✓ TOOL-01: Cross-provider tool calling reliability (MODEL_CAPABILITIES, tool_parser.py) — v2.4 Phase 53
- ✓ GEN-01/02/04/05: Anthropic native SDK, no token reduction, generation mode disambiguation — v2.4 Phase 54

*v2.5 milestone (Deployment Strategy):*

- ✓ CONCUR-01: Backend SSE handler does not block concurrent requests during long agent loops — v2.5 Phase 058 (shipped 2026-05-01; cross-tab GET <1s during streaming, measured ~15ms)
- ✓ CONCUR-02: SSE architecture decouples handler lifetime from agent loop lifetime — v2.5 Phase 059 (shipped 2026-05-02; agent_runner producer + asyncio.Queue + sse-starlette)
- ✓ STREAM-02a: Frontend race conditions eliminated — v2.5 Phase 060 (shipped 2026-05-02; setViewingThread separation + AbortController + finally-block reload removed)
- ✓ STREAM-02b: Tab-switch / F5 mid-stream recover without breaking Stop or navigation — v2.5 (subsumed by STREAM-04; final reconcile fix landed in Phase 067.5)
- ✓ STREAM-04: Stream survives navigation, refresh, multi-tab access — Redis Streams + replay-and-tail API + frontend reconcile — v2.5 Phases 061 + 062 + 063 (shipped 2026-05-04 as a single feature branch per D-v2.5-11)
- ✓ STREAM-04-correctness: Run-backed streaming gap closures — v2.5 Phase 063.1 (shipped 2026-05-04; closed Gap-001..005)
- ✓ Gap-006 closed: Per-LLM-call timeout machinery + cancelled vs timed_out lifecycle distinction — v2.5 Phase 066 (shipped 2026-05-06; HUMAN-UAT green/approved)
- ✓ UX-067-01..05 closed: Empty-paint, "Saving response…" thrash, refresh-required first-paint, redis-consumer log noise, tool-call iteration boundary — v2.5 Phase 067 (shipped 2026-05-07)
- ✓ Gap-007 closed + agent behavior polish — v2.5 Phase 067.1 (shipped 2026-05-07; Track A drain-into-queue, multi-step pipeline system prompt, context-aware in-flight copy)
- ✓ STREAM-04-correctness-round2 closed: Per-thread message store + sandbox download via JS blob + model→provider router + suggestions emit + active-thread tool-stage + code-execution heartbeat — v2.5 Phases 067.2 / 067.3 / 067.4 (shipped 2026-05-09 via cross-phase chain)
- ✓ STREAM-04-correctness-round3 closed: Empty-thread-until-refresh reconcile fix — v2.5 Phase 067.5 (shipped 2026-05-09; Branch D-3 `clearMessages` guard, 5/5 lived-experience cycles GREEN)
- ✓ TEST-DEBT-059 closed: Skills test infrastructure repaired — v2.5 Phase 065 (shipped 2026-05-09; combined skills test run 26/26 pass)

### Validated (v2.6 — Foundation: RAG Quality + Multi-Worker + Polish)

24 REQ-IDs Validated across 35 phases (068–082). Full details in `.planning/PRDs/v2.6.md` §4.

- ✓ RAG-DOCLING-01: Docling formally retired; per-aspect dispatcher with camelot tables (53.5x recall) — Phases 069–071.4
- ✓ RAG-DOCLING-02: httpx conflict resolved via supabase-py 2.29.x upgrade — Phase 070
- ✓ RAG-MM-LIFT-01: Vision call limits lifted to app_settings; 100% figure refill on thesis DOCX — Phase 072
- ✓ RAG-MM-LIFT-02: DOCX floating shapes + headers/footers via related_parts walk — Phase 072
- ✓ RAG-RECAL-01: Confidence thresholds recalibrated 0.55/0.40 → 0.54/0.38 — Phase 076
- ✓ WORKER-LIFT-01: uvicorn --workers 2 validated (50-run harness) — Phase 077/079
- ✓ WORKER-LIFT-02: asyncpg pool in streaming hot paths — Phase 073
- ✓ WORKER-LIFT-03: D-PRD-12 ADR supersedes D-v2.5-02 — Phase 079
- ✓ WORKER-LIFT-04: GET /admin/backpressure endpoint — Phase 077
- ✓ STREAMS-PROVIDER-01: StreamsProvider Context lift + two-pane renders — Phase 068
- ✓ POLISH-SEED-008-01: Thread-switch snapshot endpoint — Phase 075
- ✓ POLISH-SEED-008-02: Sandbox stdout line-by-line SSE — Phase 075
- ✓ POLISH-SEED-009-01: claude-haiku max_tokens clamp — Phase 074
- ✓ POLISH-SEED-010-01: OpenRouter synthetic-timeout protocol — Phase 081
- ✓ POLISH-SEED-011-01: test_059 fixture teardown — Phase 074
- ✓ POLISH-TOOL-PROG-01: tool_args_progress SSE for large args — Phase 075.10
- ✓ CQ-SUPA-01: Supabase singleton aclose() on shutdown — Phase 078
- ✓ CQ-CTX-01: Protected-only overrun handling — Phase 078
- ✓ CQ-DEDUP-01: Concurrent upload dedup — Phase 078
- ✓ CQ-TITLE-01: Title-generation fallback — Phase 078
- ✓ TOKEN-COL-01: runs.input_tokens/output_tokens forward-fill — Phase 073

### Validated (v2.7 — Agent Workspace & Panel)

22 REQ-IDs Validated across 6 phases (083-088). Full details in `.planning/milestones/v2.7-REQUIREMENTS.md`.

- ✓ FOUND-01: Tool-dispatch chain extracted to registry-pattern `tool_dispatcher.py` (G-5) — Phase 083
- ✓ FOUND-02: 4 carried v2.6 bugs closed (final-output-files, kimi-thinking, timer-mid-cycle, title-gen*) — Phase 083
- ✓ WS-01..07: Per-thread workspace filesystem — write/read/list/delete/version/diff, hybrid storage, RLS, SSE — Phase 084
- ✓ TOOL-01..04: `write_todos`, `task` sub-agents, `ask_user` cross-worker pause/resume — Phase 085
- ✓ PANEL-05/06: StreamsProvider SSE demux to separate stores, zero chat re-renders — Phase 086
- ✓ PANEL-01/02/03/04/07: Workspace panel — shell, todos, file browser, ask_user surface, diff viewer — Phase 087
- ✓ A11Y-01/02: WCAG 2.1 AA on all panel surfaces, fully keyboard-navigable — Phase 088

*title-gen (BUG-260527-01) fix shipped in 083 but rolled forward to v2.8 for live cross-provider verification.

### Validated (v2.8 — Harness Engine & Workflow Mode)

25 REQ-IDs Validated across 10 phases (089-096). Full details in `.planning/milestones/v2.8-REQUIREMENTS.md`.

- ✓ FOUND-03 / CF-01: Agent loop extracted to byte-identical `agent_loop.py` + v2.7 carry-forward sweep — Phase 089
- ✓ HARNESS-01..07 + TOOL-05: 5-phase-type locked workflow engine, immutable-on-publish definitions, RLS audit trail, validation gates + bounded retry, per-phase tool whitelist, seed templates, tool-count budget — Phases 090-091
- ✓ MODE-01 / MODE-02 / CONT-01: Per-thread Deep/Harness dual-mode + server-enforced lock + Continue affordance — Phase 092
- ✓ GATEWAY-01: Shared provider gateway (Deep byte-identical) — Phase 092.5
- ✓ PARITY-02: Harness native-7 cross-provider parity by consuming the gateway — Phase 093
- ✓ PANEL-08 / PANEL-09 / A11Y-03: Live WCAG 2.1 AA phase-timeline, PANEL-06-isolated `phasesByThread` store — Phase 094
- ✓ CHAT-04: Unified chat tool-card frame — Phase 095
- ✓ WORKSPACE-PARITY / RUN-HONESTY / PROVIDER-ERR: Deterministic panel fill, model attribution + true reload timer + deliverable-aware Resume, gateway-boundary error classification — Phase 095.1
- ✓ EVAL-01 / EVAL-02 / CONC-01*: Cross-provider eval CI gate, 4-axis + restart-mid-workflow UAT, batch fan-out fairness + stream-cap — Phase 096 (*CONC-01 partial: cross-tab GET p95 2,958 ms; ~3 s residual → SEED-065-B)
- ~ PARITY-01: Deep-mode Anthropic polish — re-deferred (Deep is provider-robust on all 7; re-open on a focused Deep-UX phase or bug re-reproduction)

### Validated (v2.9 — Workflow Studio)

- ✓ PROJ-01 / PROJ-02 / GOV-01: Project=folder binding + server-side KB scope governance (model-unwidenable, ⊆ assert gated no-op when scope is None) — Phase 098
- ✓ WFSKILL-01: Workflow↔skill composition with first-kickoff version snapshot into the locked definition — Phase 099
- ✓ TMPL-01: Ephemeral template upload (one-run, workspace-only, never KB-ingested, never searchable) — Phase 100
- ✓ TMPL-02 / TMPL-03: Guaranteed cited template-fill via the `llm_emit` emission layer + integrity re-open gate (corrupt file can never reach the user as "done"); SSTI-contained render; native-7-reliable — Phase 101 / 101.1
- ✓ GATE-01 / QUAL-01: Reusable validation-gate library + an `llm_judge` output-quality gate + publish-time golden run as a HARD publish blocker — Phase 102
- ✓ WFAUTH-01 / WFAUTH-02 / WFAUTH-03 / WFAUTH-04: Workflows page + authoring API + NL→draft generation (auto-retry on validation error) + read-only phase-spine graph + run-from-thread; immutable-on-publish + versioned — Phase 103
- ✓ PM-01: PM flagship content pack authored entirely on the generic primitives (not PM-hardcoded) — Phase 104
- ~ STRETCH deferred to backlog: SCHED-01 (scheduled triggers + budget caps), GRID-01 (citation-traceable grid renderer), GOV-02 (per-run provenance receipt), PLUG-01 (plugin-contract lock), ROLE-01 (operator/admin role tier) — Phases 105-109 (never started; roadmap gated on budget)

### Validated (v3.0 — Document Management)

24 functional REQ-IDs Validated across 11 phases (110-119, incl. inserted 111.1). Full details in `.planning/milestones/v3.0-REQUIREMENTS.md`.

- ✓ DMF-01 / DMF-02 / DMF-03: DM-action audit enums, owner-private RLS with forward-compat nullable `org_id`, single default-on feature flag — Phase 110
- ✓ META-01 / META-03 / META-04: User-defined custom metadata fields, model-configurable extraction (un-pinned from `gpt-4o`), larger extraction window — Phase 111
- ✓ META-02 / META-05: Per-field confidence chips + manual audit-logged metadata override — Phase 112
- ✓ EMBED-01..06: Multi-provider embeddings (OpenAI/Google/Ollama/LM Studio/OpenAI-compatible) + auto-fill map + same-model chunk/query parity + guarded RLS-scoped re-embed job + destructive-change confirmation — Phase 111.1 (retires the OpenAI embedding SPOF, SEED-048)
- ✓ VIEW-01..06: Closed-registry filter-AST → parameterized-jsonb compiler, live saved views, equals/one-of/contains/empty/numeric/date + relative-date, AND combination, folder-subtree scope, leak-safe global sharing — Phases 113/114
- ✓ VIEW-07: `query_documents_by_view` agent tool over the shared leak-safe resolver — Phase 115
- ✓ REL-01 / REL-03 / REL-04: Typed document links + removal + `get_related_documents` agent tool over a leak-safe share-don't-fork core — Phase 116
- ✓ REL-02: Relationships panel section on the document detail view — Phase 117
- ✓ CLASS-01 / CLASS-02 / CLASS-03: Metadata-condition classification rules → suggest-then-confirm routing (never a silent auto-move) + accept/dismiss — Phase 118
- ✓ DGOV-01 / DGOV-02: Light governance-health view (broken relationships / unclassified / low-confidence) with per-signal link-to-fix — Phase 119
- ✓ UX-01 / UX-02: Deep Midnight + mobile + WCAG 2.1 AA on all DM surfaces via reused primitives; the 3 highest-risk net-new surfaces G-2-sketched + operator-approved — cross-cutting (112/114/117/118/119)

### Validated (v3.1 — Workflow & Skill Studio — Trust, Clarity & Triggers)

12/12 CORE REQ-IDs + STRETCH TDP-02/CTC-01..04/WUX-03/MP-04 delivered (2026-06-28).

- ✓ COLL-01: Run-scoped sandbox-output harvest baseline — closes the 2-files live collision (Mechanism A) — Phase 120
- ✓ CTX-01: messages.origin tag + asymmetric history filter — Deep/Harness never replay each other — Phase 120
- ✓ IA-01: 2-pill composer (General/Explorer), Workflows-page-only launch, lock/409/reconcile preserved — Phase 121
- ✓ MP-01: force→coerce→fail retry ladder in forced_emit (all 4 consumers) — Phase 122
- ✓ MP-02: emit_tier doc-verified per provider (55-model registry); inert DeepSeek strict removed — Phase 122
- ✓ MP-03: per-provider scoreboard (EASY+HARD × native-7, PASS/FAIL/DOCUMENTED) gates any tier flip — Phase 122
- ✓ TDP-01: ungated execute_code.description SYSTEM_PROMPT nudge + frontend label floor — Phase 122
- ✓ TRIG-01: Skill Trigger Tuner (held-out 60/40 benchmark, background job, N-column scoreboard, durable results, CandidateCard confirm) — Phases 123+123.1
- ✓ TRIG-03: save-time description-quality lint (warn-never-block, 3 hook points) — Phase 123
- ✓ CTX-03: load_skill trim-pin (third protected class, 1/3 budget, LRU evict + marker) — Phase 123
- ✓ WUX-01: WorkflowSoul in 3 sizes (card/run-header/publish) from shared soulData.ts — Phase 124
- ✓ WUX-02: WorkflowDoorSwitch strict↔loose ("Describe & run" / "Author & govern") — Phase 124
- ✓ WUX-03: Gauntlet pip-strip + worded verdict + raw-on-demand; quiet idle PhaseCards (code-verified; UAT partial) — Phase 127
- ✓ TDP-02: Live tool description before tool_start in ToolCallPanel — Phase 128
- ✓ CTC-01/02/03/04: Provider logos in RunCard; unified tool-card; StickyTimerBar removed; long-prompt Read-more — Phase 128
- ✓ MP-04: MiniMax arg-repair guard + OpenRouter require_parameters — Phase 129

### Validated (v3.2 — Skill Eval Studio + Self-Improving, in progress)

- ✓ VER-01: Immutable skill version snapshots on save — Phase 132 (2026-06-30)
- ✓ EVAL-01: Persistent, editable eval test cases per skill — Phase 132 (2026-06-30)
- ✓ EVAL-02: Eval runner — with-skill vs without-skill, two completions per case, persisted results, cross-provider routing fix proven live — Phase 133 (2026-06-30; secured 2026-07-01)
- ✓ EVAL-03: Honest per-provider pass/fail verdict + side-by-side with/without comparison — Phase 134 (2026-07-02; secured)
- ✓ EVAL-04: Inline thumbs up/down ratings accumulate a queryable human preference signal — Phase 134 (2026-07-02)
- ✓ SI-01: Self-improvement loop — eval + Tuner signal → proposed instruction-body diff → human reviews & approves → new immutable version → auto-re-eval gate before promotion; never auto-applies; failed gate is honest + force-promotable with recorded override — Phase 135 (2026-07-02; verified 5/5 + live SC#10 UAT U1-U11 on OpenAI/Anthropic/Google; secure-phase pending)
- ✓ GATE-01: Skill publish gate — server-side gate on global sharing (409 unless ≥1 eval passed on the current version); force-publish records an owner-visible override; unshare never gated, re-share re-gates; born-global side door closed — Phase 136 (2026-07-03; verified 16/16 + live UAT 4/4 via Chrome MCP; secured 8/8)
- ✓ PANEL-01: Sketch-gated consolidated Skill Evals panel — unified Evals·Triggering·Versions tabs (Trigger Tuner absorbed), lifecycle stepper, expandable honest run rows, immutable version table + compare — Phase 137 (2026-07-04; UAT 13/13; secured 7/7, threats_open 0)
- ✓ EVAL-05: Eval engine trustworthy for every provider — cross-provider engine smoke sweep + N-provider matrix runs (mean±σ/Δ aggregation + deterministic analyst notes) + determinate progress + advisory judge case_feedback (never a gate input) + per-arm duration + registry-only judge-model Settings knob + boot-time run reconciler (orphaned runs → interrupted, never fabricated); BUG-260701-01 (Claude prefill 400) + BUG-260702-02 (restart orphans) closed — Phase 137.1 (2026-07-05; secured 25/25 threats_open 0, validated Nyquist [backend 120 / frontend 60 green], UAT 9/9 incl. live kill-restart reconciliation)
- ✓ CREATE-01: Built-in, read-only, "Built-in"-badged skill-creator for every user (local + cloud) — migration 087 supersedes stale migration-018 seed; `is_system` output-only trust badge (unspoofable, pins to top of list); platform-native 7-step instructions (interview → RAG research → save_skill → propose evals → Skill Studio hand-off → evaluate → improve → publish); D-04 dev-account name-collision resolved live — Phase 137.2 (2026-07-05; code review 0 blockers/2 warnings [WR-01 fixed in-phase, WR-02 deferred SEED-102]; verified 9/9 incl. live SC#4 conversational UAT — 4 rounds across DeepSeek + OpenAI, 2 real gaps found and fixed via migrations 088/089, comprehensive file-attach capability deferred SEED-104)

CORE 132-137 + inserted 137.1 (EVAL-05) + inserted 137.2 (CREATE-01) all shipped. STRETCH gated behind CORE: Phases 138-143.

### Validated (v3.3 — Operator UX)

- ✓ ADMIN-01: Operator reaches a gated `/admin` surface no ordinary user can discover; every operator action recorded — Phase 146 (2026-07-11; secured)
- ✓ ADMIN-02: Operator watches health + active runs and can Kill a runaway run — Phase 147 (2026-07-11; secured)
- ✓ FLAG-01: Per-feature kill-switches + maintenance/read-only mode (fail-closed) — Phase 147 (2026-07-11; secured)
- ✓ ADMIN-03: Audit browser (filter / paginate / CSV) + user disable/enable — Phase 148 (2026-07-12; secured)
- ✓ VIS-01: API-enforced feature visibility (advanced features refused, not just UI-hidden) — Phase 148 (2026-07-12; secured)
- ✓ MODEL-01: Operator edits model capabilities from the admin shell, no restart — Phase 149 (2026-07-13; secured)
- ✓ MODEL-02: Live propose-only model discovery (never auto-enables un-returned capabilities) — Phase 149 (2026-07-13; secured)
- ✓ SEC-01: Provider API keys encrypted at rest (app-layer Fernet, env-fallback preserved) — Phase 150 (2026-07-13; secured)
- ✓ FILE-02: `fetch_document_file` — KB→sandbox read tool (owner-scoped, size-capped) — Phase 151 (2026-07-14)
- ✓ FILE-01: `attach_skill_file` — agent→skill write tool (owner-only) [the v3.2 carry-forward] — Phase 151 (2026-07-14)
- ✓ WFIN-01: Run-modal file input (untrusted `template_input` provenance, never routed to Jinja) — Phase 152 (2026-07-15)
- ✓ WFIN-02: Per-run KB folder-scope at launch, server-resolved — Phase 152 (2026-07-15; OpenRouter axis operator-accepted, ext. BUG-260714-02)
- ✓ WFIN-03: Safe workflow delete cascade — Phase 152 (2026-07-15)
- ✓ CITE-01: Per-claim inline citations keyed to the run's real retrieval set + click-through — Phase 153 (2026-07-15; secured 27/27)
- ✓ LANG-01: App-wide plain-language layer behind an advanced reveal (no contract breaks) — Phase 154 (2026-07-15; secured 4/4)
- ✓ A11Y-01: WCAG-AA sweep on every net-new surface + worst pre-existing offenders — Phase 155 (2026-07-16; secured 20/20)
- ✓ POLISH-01 (STRETCH): Collapsed-nav New Chat + thread-list search + date/folder grouping — Phase 156 (2026-07-16; secured 6/6)
- ✓ DEPLOY-01 (STRETCH): Solo/Team/Enterprise presets + `docker-compose.prod.yml` + `OPERATOR.md` — Phase 157 (2026-07-17)
- ✓ DEPLOY-02 (STRETCH): Idempotent first-run install wizard at `/setup`, lock-after-finalize — Phase 158 (2026-07-17; secured)
- ✓ MODEL-03 (STRETCH): Utility-filtered discovery + add-model-by-ID with capabilities — Phase 159 (2026-07-18; secured 14/14; live UAT 6/6)

All 20 v3.3 requirements delivered (16 CORE + 4 STRETCH).

### Validated (v3.6 — Visual / No-Code Workflow Studio)

- ✓ REVERT-01: One governed `visual_workflow_canvas` key turns the whole canvas layer on/off — Phase 181 (2026-07-24; verified 12/12)
- ✓ REVERT-02: Flag-off is provably byte-identical (`test_revert_byte_identical`, CI + live-close) — Phase 181 (2026-07-24) — **operator HARD gate #1**
- ⚠ VALID-01 (partial): `POST /workflows/validate` reuses `lint_workflow` **verbatim** — one source of validation truth, no client-side rule re-implementation — Phase 182 (2026-07-25). Partial: SC#3 404-uniqueness enumeration oracle **accepted** → SEED-134
- ✓ VALID-02: Live author-time STRUCTURAL validation — "you cannot draw an invalid workflow" — Phase 184 (2026-07-27; UAT 13/13)
- ✓ VALID-03: Per-node verdicts are server-authoritative, never a client-side guess — Phase 184 (2026-07-27)
- ✓ CANVAS-01: View a workflow as a faithful read-only `@xyflow/react` projection — Phase 183 (2026-07-26; verified 8/8 + live 7/7)
- ✓ CANVAS-02: Add/move/connect/delete nodes, round-tripping losslessly to `WorkflowDefinition`; layout stays OUT of the immutable JSONB — Phase 184 (2026-07-27)
- ✓ CANVAS-03: Side-panel node config on the existing `PhaseConfig` discriminated union (Pydantic stays authoritative) — Phase 184 (2026-07-27)
- ✓ CANVAS-04: Governance rendered as visible rails, graded per GOVERN — never removable — Phase 184 (2026-07-27)
- ✓ GOVERN-01: Per-node grounding mode — Grounded auto-attaches the immutable `citations_required` coverage gate; Open is ungated — Phase 185 (2026-07-31; secured 49/49) — **the milestone's headline differentiator**
- ✓ GOVERN-02: The canvas marks each node's governance state; rails apply graded, not blanket — Phase 185 (2026-07-31; secured)
- ✓ GOVERN-03: Orthogonal action-risk approval checkpoint on the existing `llm_human_input` substrate — Phase 185 (2026-07-31; secured)
- ✓ CONCUR-01: Autosave-in-place — a cosmetic drag never mints a version or re-arms the gauntlet — Phase 186 (2026-08-01; verified 9/9, secured)
- ✓ CONCUR-02: Two editors cannot silently clobber each other on an org-shared draft — Phase 186 (2026-08-01; secured)
- ✓ VOCAB-01: Plain-language node verbs + the ⌥ Technical-names reveal (swaps the subtitle, not the title) — Phase 187 (2026-08-04; secured 152/152)
- ⚠ VOCAB-02 (partial): NL description → safe seeded editable canvas draft; the response schema **is** the `extra="forbid"` union, so an unsafe node is structurally unemittable — Phase 187 (2026-08-04). Partial: `/workflows/generate` ignores `bundle.degraded`, so a registry outage yields a folder-blind draft presented as `ok:true` → **SEED-133** (accepted — `/validate` and the gauntlet both catch it downstream)
- ✓ VOCAB-03: Start-from-template via the shipped Starter Workflow Library — Phase 187 (2026-08-04)
- ✓ RUNVIZ-01: Watch a run on the canvas from the SAME `usePhases(threadId)` stream — one run stream, two views, no second demux — Phase 188 (2026-08-05; UAT 16 PASS)
- ✓ RUNVIZ-02: Node state is a total function over the full event set + reconcile-on-fetch (Realtime is a hint, not truth) — Phase 188 (2026-08-05)
- ✓ RUNVIZ-03: A run and its deliverable get **their own home** instead of being dumped into chat — Phase 188 (2026-08-05) *(added mid-milestone 2026-07-31 from the operator call after 185's UAT)*
- ✓ CONN-01: Governed external-action node whose capability **is** an `available_tools` whitelist entry, reusing 185's action-risk checkpoint — zero new governance concept, no live egress — Phase 189 (2026-08-08; secured) — **operator HARD gate #3, CORE half**
- ✓ CONN-03 (STRETCH): Every outbound secured — unconditional SSRF/egress guard **before and independently of any credential**, sandboxed expression eval, no arbitrary-code node, org-scoped Fernet credentials by reference, cross-org leak test that reproduced the leak before closing it — Phase 190 (2026-08-09; **`/gsd:secure-phase` returned `threats_open: 0`**, its own mandatory gate)
- ❌ **CONN-02 (STRETCH) — NOT satisfied.** 2-3 live connectors *runnable from a workflow*: **1 of 3**. A real Slack message sends through the full governed path, but `_adapter_args` fills only each capability's `body_arg`, so Jira's `summary` and SMTP's `to`/`subject` are unfillable — `D-190-DEF-17` → connections milestone
- ⏸ **SCALE-01 (STRETCH) — deferred, never built.** Phase 191's conditional ship trigger never fired → `.planning/v3.6-STRETCH-CARRYFORWARD.md`

**20 of 24 v3.6 requirements delivered** (19 of 21 CORE, with **zero CORE unsatisfied**), + 2 partial, 1 unsatisfied, 1 deferred.

> ⚠ **Known drift in this section, recorded rather than silently patched:** there is no `### Validated (v3.4 …)` or `### Validated (v3.5 …)` block — both milestones shipped without one, so the Validated list jumps v3.3 → v3.6. Their requirements are archived in `.planning/milestones/v3.4-REQUIREMENTS.md` and `v3.5-REQUIREMENTS.md`. Backfilling them was out of scope for the v3.6 close.

### Validated (v3.9 — Connections: Any Service, Any Tool)

- ✓ A connection is created against a **service**, its actions coming from that service's own advertised tools — CONN-04, v3.9 (Phase 211)
- ✓ The three legacy capability verbs keep working as one shape among many, organising no surface — CONN-05, v3.9 (Phase 211)
- ✓ A service is added by **pasting its MCP URL**, tools discovered and grantable with zero engineering — CONN-06, v3.9 (Phases 212 / 222; driven against four real servers)
- ✓ A connection's identity, auth and endpoint are editable without losing per-tool grants — CONN-07, v3.9 (Phase 212)
- ✓ An OAuth-authenticated service row is accepted by the database — CONN-08, v3.9 (Phase 211, migration 127)
- ✓ Connections browse as a searchable **catalog of services**, with a Popular row, filtered on connection STATE — CAT-01 / CAT-02 / CAT-03, v3.9 (Phase 212)
- ✓ A connected service shows starter prompt suggestions — CAT-04, v3.9 (Phase 216)
- ✓ OAuth authorization-code with a customer-registered client id/secret; silent lease-locked refresh; secrets and refresh tokens encrypted at rest and org-scoped — OAUTH-01 / OAUTH-02 / OAUTH-03, v3.9 (Phases 215 / 225)
- ✓ Each tool granted or denied individually with a connection-level default it inherits — GRANT-01 / GRANT-02, v3.9 (Phase 213, driven)
- ✓ A denied or ungranted tool is refused, naming the grant that would allow it — GRANT-04, v3.9 (Phase 213, both reasons and both shapes driven)
- ✓ Every outbound call writes an audit receipt, and a connection leaves a readable record — GRANT-05, v3.9 (Phases 213 / 223)
- ✓ Any connected service is added to a thread by name and the agent picks a granted tool; a chat tool call renders the service's mark and the tool's real name — CHAT-05 / CHAT-07, v3.9 (Phases 216 / 224)
- ✓ A step picks a service then a named action — no URL, no hand-written JSON (the raw-JSON surface was deleted) — STEP-01, v3.9 (Phase 214)
- ✓ Required arguments are author-fillable from every launch path, and a run supplies them — STEP-02, v3.9 (Phases 214 / 214.1, **operator-driven**)
- ✓ Publish refuses an unsatisfiable step, naming the step and the missing argument — STEP-03, v3.9 (Phase 214)
- ✓ Service mark + action name on the run spine and run surfaces; a failed external step reports its own reason; the describe door is bound to connected services and granted tools — STEP-04 / STEP-05 / STEP-06, v3.9 (Phase 214)
- ✓ One specific file is picked from a connected source and attached or ingested — ATTACH-01, v3.9 (Phase 216)
- ✓ The `live_connectors` kill-switch is visible and controllable in the Control Room — CONN-09, v3.9 (Phase 210, driven in-browser)
- ✓ An embedding-provider failure is reported as a provider failure, naming it — RAG-09, v3.9 (Phase 210; the roster failed 5 of 18 rows first, was fixed, and re-drove 18/18 honest)
- ✓ The document space is the **Library**: a real upload front door, the six stages the pipeline actually writes, and a detail panel showing text, tables, images, chunks and the queries that found it — LIB-01 / LIB-02 / LIB-03 / LIB-04, v3.9 (Phases 217 / 217.1)
- ✓ Library Health and Governance retired into the Library's Health tab with nothing lost; a search that **could not run** is its own analytics segment; per-hit relevance is recorded — LIB-05 / LIB-06 / LIB-07, v3.9 (Phase 217.1)

⚠ **Carried, not validated** — three requirements are narrower than their wording and two shipped without ever being driven:

- ⚠ `CAT-05` — Add-a-connection on a **cloud** install was never verified (`BUG-260810-01`, re-open trigger: the v3.9 production push)
- ⚠ `GRANT-03` — the run pauses and names the tool and arguments, but **never the service**
- ⚠ `CHAT-06` — the armed connector set is stored nowhere and does not survive a reload (`BUG-260902-03`)
- ⛔ `CONN-10` / `CONN-11` — code shipped, structurally undrivable on this install (0 schedule rows; the door gates on published provenance)

### Validated (v4.0 — Connected Knowledge)

- ✓ A folder from a connected source is mapped to a Library folder and checked on the **shipped** scheduler — LIB-08, v4.0 (Phase 234, driven: a file arrived by itself, `last_status=success`, items 0→6)
- ✓ Before the first import a person sees what it **would** add, and nothing is ingested until they confirm — LIB-09, v4.0 (Phase 233)
- ✓ A source that has stopped reading says so, says when, and offers the one action that fixes it — LIB-10, v4.0 (Phase 235)
- ✓ Every source family implements ONE `browse / list / read / check` contract; a family adds an adapter, not a pipeline — SRC-01, v4.0 (Phase 232, **measured** at 238 and 239)
- ✓ A person watches a **Google Drive** folder, with no new OAuth scope — SRC-02, v4.0 (Phase 232)
- ✓ A person watches a folder exposed by **any** connected MCP server — SRC-04, v4.0 (Phase 239; driven against GitHub MCP, **zero-code proven by hash**)
- ✓ A person watches a **mailbox**: one message is one document, `thread_key` groups, attachments are children — SRC-05, v4.0 (Phase 240, `sources/base.py` byte-identical)
- ✓ A `missing` verdict may be written **only** from a listing whose final page asserted completeness — SRC-06, v4.0 (Phase 234, `H-5`, fail-closed)
- ✓ The preview shows four honestly-labelled buckets over a two-tier identity, and **writes nothing** — PREV-01 / PREV-02 / PREV-03, v4.0 (Phase 233)
- ✓ One visibility per connection, enforced in **RLS at all four sites**, stated plainly on screen — VIS-01 / VIS-02, v4.0 (Phase 231)
- ✓ A file removed at the source is not removed from the Library; every remaining lifecycle event has a defined outcome; a disconnect **freezes** rather than deletes; a visibility-widening rule produces a **suggestion requiring human accept** — VIS-03 / VIS-04 / VIS-05 / VIS-06, v4.0 (Phase 234, driven)
- ✓ Ingestion runs through a durable queue with cap, retry and resume — proven on `/upload` **first** — QUEUE-01 / QUEUE-02, v4.0 (Phase 230)
- ✓ Two runs of the same watched source never overlap — QUEUE-03, v4.0 (Phase 234, a watch lease)
- ✓ Embedding calls batch inside real provider limits (including the 300,000-token-per-request ceiling), and a failure retries, fails over **same-vector-space**, then names itself — QUEUE-04 / QUEUE-05, v4.0 (Phase 230)
- ✓ There is **ONE ingest splice** — every producer mints the same row from the same bytes — TRUST-01, v4.0 (Phase 229, G-5 discharge on `documents.py`)
- ✓ The anti-injection discipline is **actually attacked** by a corpus that fails when a defence is removed — TRUST-02, v4.0 (Phase 236; 13/13 refused · 8/8 mutations caught · live drive refused by 8/8 native providers)
- ✓ Write-capable connector tools are fenced out of turns whose retrieval set contains connection-sourced content — TRUST-03, v4.0 (Phase 234, same phase as the first sync)
- ✓ A document carries whether it was machine-placed and from which connection, visible at retrieval and citation time — TRUST-04, v4.0 (Phase 231)
- ✓ Watch-routing and classification rules share ONE AST and ONE matcher discriminated by scope, with source facts as first-class filterable fields — RULES-01 / RULES-02, v4.0 (Phase 237)
- ✓ The screen says **"checked every N minutes"**, never "instantly" — SURF-01, v4.0 (Phase 234)
- ✓ A person can see what a sync actually did — a per-source run history with counts and errors — SURF-02, v4.0 (Phase 235)
- ✓ v3.9's owed verification driven or explicitly re-deferred; the resume-path bug cluster triaged together; the backend baseline honestly re-derived so it can gate again — DEBT-01 / DEBT-02 / DEBT-05, v4.0 (Phase 228)

⛔ **NOT validated — five requirements, named rather than rounded up:**

- ⛔ `SRC-03` — Microsoft Graph ships **structurally**; all nine live UAT rows are blocked on one Azure app registration (SharePoint separately on `SEED-256`)
  - ⚠ **CORRECTED 2026-09-13 (Phase 245) — the bullet above is preserved, not deleted.** *"all nine
    live UAT rows are blocked on one Azure app registration"* is **FALSE**: All nine of 238's M rows were **DRIVEN LIVE on 2026-09-07** (`238-VERIFICATION.md:213-231` — 7 full pass, 2 half at the time; **four defects found by driving and NONE by the 15-case unit suite**). The operator completed the Azure registration *hours after* `238-SUMMARY.md` was written.
    ✅ Phase 245 closed SC#1 — **8 PASS · 1 ⛔ BLOCKED (M-9) · 2 ⛔ RETIRED (S-1/S-2, `SEED-256`)**.
    ⛔ `SRC-03` itself is **not** thereby validated — that is a separate judgement for a milestone
    audit, and this correction changes only the **reason** given, never the verdict.
- ⛔ `QUEUE-06` — the defect was measured and the remedy shipped, but **the DEFAULT is unchanged**, so out of the box the requirement is still not met; cloud has no columns until migration 176 lands
- ⛔ `SURF-03` — a broken watch reaching someone not on the page: its **home is still an open scoping decision**; the Health tab alone does not satisfy it
- ⛔ `DEBT-03` — `/code-review ultra review-base-225`, ruled out by the operator on cost
- ⛔ `DEBT-04` — `app.<domain>`, gated on a production push (`SEED-242`)

### Active (current milestone)

*v4.0 Connected Knowledge SHIPPED (2026-09-10; git tag `v4.0`). **No milestone active.** Next: `/gsd:new-milestone`. ⚠ **Carried into scoping, and the first two are not features:** the **161 planted seeds** whose `trigger_when` the sweep rule says must each be read (at 161 that sweep is a phase, not a step); the **two credential-blocked UAT sets** — 238's nine Azure rows and 241's row 5, which **expires the moment migration 176 reaches cloud**; **three phases owing an independent §6.3 review** (238, 240, 241) with no independent reviewer in existence; **15 cloud migrations pending** before the next push; `SEED-242` still armed for `app.<domain>`; **34 open reported bugs**; `retrieval_service.py`'s G-5 extraction, owed since 231, where a **third** landing must propose the extraction first; and `SURF-03`'s open scoping decision, which is a product question rather than a build.*

<details>
<summary>Superseded Active note (v3.9-era, preserved)</summary>

*v3.9 Connections: Any Service, Any Tool SHIPPED (2026-09-04; git tag `v3.9`). **No milestone active.** Next: `/gsd:new-milestone` — the sequenced next slot is **Connected Knowledge**, carrying deferred **Phase 219**, `LIB-08/09/10` and `SEED-209/210/211/212` as one unit, because 219's* "watched on a schedule" *IS the security seeds' own re-open trigger. ⚠ `LIB-08/09/10` have never existed outside a roadmap heading and must be written into that milestone's `REQUIREMENTS.md`. Also carried: the five owed-verification sets (210's four undriven SC, 211's UAT + schema regen, 214's eight-row cross-provider roster and eight G-4 drives, 217's 16 UAT rows, `/code-review ultra review-base-225`); `SEED-242` armed for the next production push; 23 open reported bugs, six of which are probably one root cause in the resume path; 14 dormant seeds; and one honest re-derivation owed on the backend unit baseline before it can gate anything.*

</details>

<details>
<summary>Superseded Active note (v3.6-era, preserved)</summary>

*v3.6 Visual / No-Code Workflow Studio SHIPPED (2026-08-09; git tag `v3.6`). **No milestone active.** Next: `/gsd:new-milestone`. The sequenced next slot is the **connections / integrations** milestone — read **`SEED-146`** first (umbrella), with `SEED-144` (provider-shaped), `SEED-145` (usable in chat), `SEED-142` (two-way / auto-ingest) and the concrete unfinished edge `D-190-DEF-17` as its inputs. ⚠ Every capability shipped so far is a WRITE — no read/search/list exists — and **no outbound capability may join `_TOOL_REGISTRY` before the approval model exists**. Also carried forward: v3.4 STRETCH 169-173; v3.5 STRETCH 178-180 (**180 agent-loop honesty = priority revive**); 11 dormant seeds; v3.6's verification-documentation debt (three `VERIFICATION.md` files carrying nine requirements).*

</details>

<details>
<summary>Superseded Active note (v3.3-era, preserved)</summary>

*v3.3 Operator UX SHIPPED (2026-07-18). Next milestone not yet scoped — v3.4 Multi-tenancy is the sequenced next slot (the one-way RLS door) per `.planning/PRDs/SEQUENCE.md`; scope it via `/gsd:new-milestone`. Backlog carried forward: 9 dormant seeds (003 deploy-flexibility, 004 org-multi-tenancy, 040 model-registry-self-service, 041 conversation-compaction, 042 chat-input-modalities, 043 sandbox-package-mgmt, 045 ui-ux-polish, 046 library-health, 084 starter-workflow-library); v2.9 STRETCH 105-109; SEED-013/014 connectors (v3.5/v3.6); a planned post-v3.3 chat-polish phase for the open chat-surface bugs (BUG-260708-01/-02, 260714-01, 260718-02/-03/-04).*

</details>

### Out of Scope

| Feature | Reason |
|---------|--------|
| In-document PDF highlighting (F-01 v2) | Requires PDF renderer integration; citation cards sufficient for v2.2 |
| Citation export / cross-thread citation linking | Complexity vs. value; defer |
| Diff view between document versions | Nice-to-have; version history + restore covers core need |
| Per-claim confidence scoring | Too granular; response-level confidence sufficient |
| Organisation-level audit view / SIEM integration | Single-user audit sufficient; no multi-tenant yet |
| Suggestions in Explorer mode | Explorer is KB-focused tool mode; follow-ups add noise |
| Multi-tenancy / Org-level transform | Requires clarity on isolated vs co-tenant architecture and auth/billing model |
| Automatic local folder scanning/import | Phase II feature, adds complexity |
| Team-based folder sharing with access controls | Keep it simple: global or private only |
| Real-time collaboration on folders | Not needed for current use case |
| Folder-level permissions | Global folders visible to all, per-user folders private |
| Switching to Docling | Existing pypdf + python-docx pipeline is working |
| Nyquist VALIDATION.md compliance | Phase-level validation files in draft state; full compliance deferred |
| Comprehensive skills system overhaul | Planned for next milestone; this milestone only fixes dispatch relevance |

## Context

**Architecture:** React/Vite frontend + FastAPI backend + Supabase (Postgres with pgvector). Supabase can run locally via Docker or as a cloud instance.

**Schema (v2.3 shipped state):**
- `folders`: id, user_id, name, parent_id, is_global, created_at, updated_at — adjacency list with RLS
- `documents`: id, user_id, folder_id, filename, file_path, file_size, mime_type, status, full_markdown, chunk_count, content_hash, metadata, version_number, is_latest, created_at, updated_at
- `document_chunks`: id, document_id, user_id, content, chunk_index, embedding (vector), search_vector (tsvector), created_at
- `document_tables`: id, document_id, user_id, page, table_index, headers, rows, created_at
- `document_images`: id, document_id, user_id, page, image_index, description, created_at
- `threads`: id, user_id, folder_id (nullable FK), title, created_at
- `messages`: id, thread_id, role, content, tool_calls, citations, source_refs, confidence, suggestions, created_at
- `user_memory`: id, user_id, key, value, created_at, updated_at — UNIQUE(user_id, key) with upsert trigger
- `message_feedback`: id, message_id, user_id, rating, reason, created_at — UNIQUE(message_id, user_id), INSERT-only
- `skills`: id, user_id, name, description, instructions, is_enabled, is_global, created_at, updated_at
- `skill_files`: id, skill_id, user_id, filename, storage_path, file_size, mime_type, created_at
- `code_executions`: id, thread_id, user_id, code, exit_code, duration_ms, created_at
- `sandbox_files`: id, thread_id, user_id, filename, storage_path, file_size, signed_url, created_at
- `audit_log`: id, user_id, action_type, details, created_at — INSERT-only RLS
- `profiles`, `user_settings`, `app_settings`

**Agent modes:**
- General: default chat with 16 tools (search, query_documents, web_search, analyze_document, ls, tree, grep, glob, read_document, load_skill, save_skill, read_skill_file, execute_code, remember, recall, query_tables)
- Explorer: KB-focused mode with 6 KB tools, dedicated system prompt, max_iterations=8

**Known issues:**
- UAT verification gaps for phases 038–042 (require live browser testing) — carried from v2.3
- Human UAT pending for Phases 45, 46, 48 (delete dialog, ghost content, web search toggle, nav visual)
- Metadata ingest normalization covers only document_type/language
- Skill catalog injected in full for every request (SKILL-01/02 deferred to Skills Studio milestone)
- KI-001: In-flight LLM calls continue after SSE disconnect — GeneratorExit only fires at yield points; current call completes before iteration stops. See KNOWN-ISSUES.md.
- STREAM-02: Supabase Realtime INSERT timing unreliable for tab-switch and F5 scenarios — polling approach recommended for next milestone

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **D-v3.4-01**: Tenancy-Model ADR ratifies D-PRD-02 (co-tenant `org_id` + membership RLS default + isolation-via-deployment for enterprise) + the binding 4-tier deploy-flexibility contract | Ratify-not-relitigate — v3.3 already ~80% pre-shipped the posture; the one genuinely-new binding commitment is the solo-local / small-team-VPS / medium-SaaS / enterprise-BYO pure-env-var contract with per-phase enforcement (161-173) + SEED-120 forward-compat. Full ADR: `.planning/phases/160-tenancy-model-adr/160-ADR.md`; register pointer: DECISIONS.md `## D-v3.4-01` | ✓ Ratified in Phase 160 (2026-07-18) |
| Advisory judge signals (`case_feedback`) are schema-bound + excluded from the rollup denominator (137.1) | An advisory note must never silently flip a pass count; the only gate signal is `overall_passed`. Stored/read separately, truncated on persist, rendered as a violet "never blocks" advisory | ✓ Good — verified in code + live UAT (U8); a non-discriminating case shows the advisory with the pass count unchanged |
| Boot-time run reconciler flips orphaned runs → interrupted, never fabricated (137.1, EVAL-05g) | A backend restart mid-run must not leave runs stuck "running" or invent a verdict; predicate = non-terminal in Postgres AND absent from Redis `runs:active`, single-shot `SET NX` guard, best-effort non-blocking boot | ✓ Good — live-proven (U7): killed run → interrupted, exactly 1 interrupted / 19 completed, zero stuck 'running'; a fresh post-restart run survives |
| Provider request-shape fixes at the gateway/adapter boundary only (D-14, 137.1) | Cross-provider quirks (Claude assistant-prefill, DeepSeek `reasoning_content`) get a `MODEL_CAPABILITIES` flag + adapter strip, never a shared-loop branch; `agent_loop.py`/`threads.py` untouched, Deep byte-identical | ✓ Good — `supports_assistant_prefill` flag + `open_anthropic_stream` strip closed BUG-260701-01 (12/12 seam tests); live Claude-5 arms flipped from a deterministic 400 to graded |
| Engine smoke sweep measures ENGINE health, not model quality (137.1) | A trivial built-in synthetic case (answer 'PONG') that both arms trivially pass proves the provider path works end-to-end; a graded FAIL is still a healthy engine | ✓ Good — live UAT (U1); board shows per-provider ✓/✗ with verbatim errors, subtitle states the distinction |
| v2.9 composes the harness, never re-implements it (the red line) | Deep Mode must stay byte-identical; new capability is additive seams on `phase_types.py`/`models/harness.py`, never breaking the G-5 hot files | ✓ Good — Deep byte-identical across 097-104; ~80-90% composition |
| One shared `llm_emit` emission layer (D-101.1) | FORCE a cited field-map → deterministic no-model-code render is the generic home for any typed-artifact workflow, not a template-fill one-off | ✓ Good — native-7-reliable via capability-tiered forcing + narrated-JSON recovery; SEED-082 carried forward |
| Validation gates / judge walls MUST be driven live, not statically (102→104) | Mocks + static def-shape tests false-green real failures; the only proof is the real endpoint on a real golden run | ✓ Good — 102 found 6 mock-masked blockers driving the real publish endpoint; 104 found 2 blocking double-gate engine bugs static tests false-green'd. Lesson now extends to auditors + validation maps (hand-spot-check; re-run, don't trust labels) |
| NL authoring + form + read-only graph, NOT a drag-to-build canvas | The buyer is a domain expert, not an automation engineer; OpenAI sunsetting hosted Agent Builder confirmed the squeezed middle | ✓ Good — describe→draft→refine→publish shipped; read-only phase-spine graph |
| Output-quality judge as a HARD publish blocker (QUAL-01) | A structurally-lint-clean workflow that produces bad output must not publish | ✓ Good — judge hard-wall live cross-provider, grades prose AND template-fill |
| Cross-provider (SC#10 4-axis) as a first-class acceptance bar | Conventions don't transfer 1:1 between providers; provider-specific handling stays at the gateway/service boundary, the shared fill path never branches | ✓ Good — every workflow-run-bearing phase gated on the 4-axis scoreboard; honesty held on all 7 natives |
| Plugin Contract OFF the v2.9 critical path → STRETCH 108 | The KB-grounded flagship needs zero plugins to ship; lock the contract on real flagship telemetry (D-v2.8-01) | ✓ Good — v2.9 shipped without it; deferred cleanly to backlog |
| Store full markdown alongside chunks | Enables efficient grep/read without reconstruction from chunks | ✓ Good — implemented Phase 2, used by read/grep tools |
| Unlimited folder nesting depth | Flexibility like a real filesystem | ✓ Good — adjacency list with no depth limit |
| Global + per-user folders (no teams) | Avoids permission complexity while enabling shared content | ✓ Good — `is_global` flag + RLS |
| grep returns document names only | Keeps output lightweight; use read for content | ✓ Good — agents follow up with read when content needed |
| tree uses depth limit + truncation | Protects context window for large KBs | ✓ Good — `truncated=True` indicator on cut nodes |
| Keep pypdf + python-docx (not Docling) | Already working; avoids migration risk | ✓ Good — no issues encountered |
| ON DELETE SET NULL on folder_id FK | Deleting folder orphans documents to root, not destroys them | ✓ Good — safe default behavior |
| document_chunks RLS not updated | match_document_chunks RPC is SECURITY DEFINER — RAG queries bypass RLS correctly | ✓ Good — no change needed |
| Python-side subtree resolution | Preferred over SQL CTE for folder scoping — simpler, testable | ✓ Good — used in grep, glob, query_documents, system prompt |
| ON DELETE SET NULL on threads.folder_id | Thread history preserved when folder deleted | ✓ Good — no data loss on folder delete |
| tools_override=None signals default mode | No override → get_tools() used; default mode completely unchanged | ✓ Good — clean branching pattern |
| JSONB for tool_call_id persistence | Store alongside existing tool call data without schema migration | ✓ Good — non-breaking, reconstructs correctly |
| asyncio.Queue bridge for Docker SSE | Decouples Docker blocking I/O from FastAPI async SSE loop | ✓ Good — real-time streaming without blocking |
| SKILL.md frontmatter YAML + agentskills.io format | Open standard for skill portability | ✓ Good — ZIP round-trip works, path traversal rejected |
| chars/3 for JSON token estimation | JSON punctuation overhead means chars/4 underestimates tool call sizes | ✓ Good — existing trim tests pass |
| Provider-aware context budgets (hardcoded) | Dynamic context limit mapping adds complexity; hardcoded per-provider sufficient | ✓ Good — avoids tiktoken dependency |
| 3k char cap on read_document context injection | Large documents were flooding agent context; 3k + truncation note preserves usefulness | ✓ Good — agents follow up with start_line/end_line |
| User memory UNIQUE(user_id, key) upsert | Enables remember tool to update in-place; consistent with per-user scoping | ✓ Good — clean upsert-by-key pattern |
| asyncio.create_task for non-blocking writes | Memory writes, feedback posts, audit log entries never delay responses | ✓ Good — consistent fire-and-forget pattern across phases 30, 33, 39 |
| Vision LLM for image descriptions | Embedded images described and indexed for vector search | ✓ Good — enables MODAL-02 and MODAL-03 |
| Python-side JSONB aggregation for health metrics | Simpler than raw SQL with Supabase client for aggregation queries | ✓ Good — fast enough for 10k document libraries |
| Immutable feedback (INSERT-only RLS) | One rating per message per user; no modification allowed | ✓ Good — clean audit trail |
| Deep Midnight is additive CSS/Tailwind only | No logic changes to SSE parsing or state management | ✓ Good — zero regression risk |
| NavPanel collapses from Sidebar + AppDock | Single component with localStorage-persisted state replaces dual-component layout | ✓ Good — cleaner responsive breakpoint story |
| 5-tab SettingsPage | Per-tab scoped Save handlers fix KEY_PLACEHOLDER contamination | ✓ Good — WR-03/WR-04 resolved |
| System prompt Q&A vs Generation disambiguation (PROMPT-01) | Old prompt keyword-matched "report"/"summary" → triggered execute_code on Q&A queries. Fix: Generation mode only activates on explicit file-creation verbs. Default is always Q&A. | ✓ Good — eliminates false-positive .docx generation |
| Two tool calling modes (D-53-01/02) | Native (API tools param) for proven models in MODEL_CAPABILITIES, Structured (JSON-in-prompt) for everything else. No retries, one-shot deterministic. | ✓ Good — clean branching; tool_parser.py handles structured path reliably |
| OpenRouter strategy setting (D-53-03) | quality/native/xml — user-controllable. quality default uses :extended model IDs for better compliance. | ✓ Good — no hardcoded assumptions about OpenRouter model behavior |
| NATIVE_PROVIDERS bypass for token cap (v2.4) | Anthropic and Google bypass the _resolve_max_tokens cap; Settings hides irrelevant sliders for those providers. | ✓ Good — clean provider-conditional UI pattern |
| _announced_tools set[int] guard (D-056.1-01) | Guards tool_preparing SSE to emit exactly once per tool index in OpenAI path. Anthropic path has separate _announced_tools_ant guard. | ✓ Good — prevents duplicate preparing events on parallel same-name tool calls |
| loadMessages outside React state updater (v2.4 Phase 57) | Side effects (loadMessages, stoppedByUserRef reset) must be outside setMessages updater — Strict Mode double-invokes updaters and bail-out optimization can skip them entirely. | ✓ Good — structural correctness; documented for future hook maintainers |
| Realtime reconnect deferred (STREAM-02) | Supabase Realtime INSERT delivery timing unreliable for tab-switch and F5 scenarios. Use polling for F5 + visibilitychange for tab-switch in next attempt. Verify REPLICA IDENTITY on messages table first. | ⚠ Revisit — see 057-DEFERRAL.md |
| **D-v2.5-08**: Run-backed streaming via Redis Streams (not pgmq, not LISTEN/NOTIFY) | Redis Streams provide native replay-from-offset + live-tail (`XREAD` with cursor), trivial multi-consumer fan-out (each tab is an independent reader), one-line per-key TTL, and battle-tested for chat-streaming infra at scale. pgmq is a queue (consume-once) which fights the use case; LISTEN/NOTIFY hits 8KB payload limits and requires a separate events table for replay. Free Upstash tier covers this app's scale; Redis is a one-line add when deploying to Hostinger (SEED-003). | New — locked 2026-05-02 by user before /gsd:discuss-phase 061 |
| **D-v2.5-09**: LLM token cost shift on rescope | Run-backed streaming decouples generation from HTTP request lifetime, so navigating away no longer cancels the LLM call. Mitigations: explicit Stop button (cancel verb hits server, not just frontend abort), server-side hard timeout per generation (default 120s), abandoned-run TTL (no consumer for N minutes → cancel producer). Specific values to be locked in /gsd:discuss-phase 061. | New — flagged 2026-05-02 |
| **D-v2.5-10**: STREAM-02b absorbed by STREAM-04 (run-backed streaming) | The original Reconnect Handlers approach (visibilitychange + pageshow + reconcile-fetch + Resume button) was the right symptom-treating layer for the legacy POST-streams architecture. Run-backed streaming makes recovery automatic at the architecture level — STREAM-02b's success criteria (E, F, G recover without manual F5) are met as a side-effect. Resume button retained only for `failed` runs, preserving D-v2.5-05's "no auto-retry of paid LLM calls" principle. | New — locked 2026-05-02 |
| **D-v2.5-11**: v2.5 stream-architecture deployment + run history persistence | (a) Phases 061 + 062 + 063 ship as a single merge from a long-lived feature branch — no feature flags, no incremental rollout. Reason: dev-stage single-developer change, atomic architectural shift, feature-flag complexity outweighs benefit. (b) Run lifecycle metadata persists in a new `public.runs` Postgres table (`run_id`, `thread_id`, `user_id`, `message_id`, `status`, `model`, `provider`, `started_at`, `completed_at`, `input_tokens`, `output_tokens`, `error`) with full RLS — Redis Stream is the ephemeral event buffer (TTL ~10 min), Postgres `runs` is the durable record. Migration `035_runs_table.sql` lands in Phase 061 scope. Active-runs API (Phase 062) reads from Postgres; replay-and-tail reads from Redis. Useful for audit, debugging, future billing/usage UI, and validation-harness assertions (Phase 064). | New — locked 2026-05-02 |
| **D-v2.5-12**: Schema-restore — `messages.confidence_*` columns | The columns `confidence_level` (text), `confidence_avg_similarity` (double precision), and `confidence_disclaimer` (text) on `public.messages` were defined ONLY in the retired bootstrap file `supabase/migrations/000_full_schema.sql`. That file was moved out of the migration sequence in commit 197b53a (2026-05-02) when the regenerate-full-schema.sh pipeline was introduced. Because no sequenced migration ever created the columns, the regenerated `supabase/full-schema.sql` lost them and any DB rebuilt from migrations alone was missing them. Affected runtime: `threads.py:1027-1029` (writes), `knowledge_health.py:148-484` (reads for low-confidence dashboards), `models/message.py:25-27` (Pydantic). Restored via migration `037_messages_confidence_columns.sql` (idempotent `ADD COLUMN IF NOT EXISTS`). Audit: at-the-time only confidence_* was missing — `source_refs`, `tool_calls`, skills tables, and all other expected columns are intact. The new `documents.ingestion_step` + narrowed `documents.status` CHECK are intentional (commit a2b0a36). | New — locked 2026-05-03 |
| **D-v2.6-01**: Q-v2.6-01 resolution — path (a): supabase-py 2.10 → 2.29.x in-process upgrade | The httpx<0.28 (supabase 2.10) vs httpx>=0.28 (docling 2.x) conflict is resolved by upgrading supabase-py to 2.29.x, which drops the `gotrue`-inherited httpx constraint. Path (a) succeeded on the first attempt; paths (b) (pin docling back) and (c) (subprocess isolate) rejected — (b) falsified by PyPI metadata (no docling 2.x publishes httpx<0.28 wheels), (c) pro-forma per D-070-05 (subprocess overhead unjustified once in-process works; D-PRD-07 Appendix subprocess-fence precedent remains available as a future fallback). Pins locked: `supabase==2.29.0`, `httpx>=0.28.0,<0.29.0`, `docling>=2.93.0,<3.0.0`. Full backend pytest suite green post-upgrade; D-070-14 regression-guardrail comment block in `requirements.txt` names `backend/tests/integration/test_pdf_extractor_docling_compat.py` as the binding gate. Full matrix in `.planning/phases/070-docling-httpx-spike/070-SUMMARY.md`. | New — locked 2026-05-14 by Phase 070 spike; CI test green; closes RAG-DOCLING-02 |
| **D-v2.6-04**: Q-v2.6-04 LOCKED — opt-in re-extraction via `POST /documents/{id}/reextract` (per-document, explicit engine override) | Three options considered: (a) auto-re-extract all existing documents on deploy, (b) opt-in per-document via a new `/reextract` route, (c) defer the engine-swap story to v3.1. Path (a) rejected — would regenerate every chunk embedding + re-run every vision-LLM image description (cost-uncapped on the existing library; user-facing latency spike on first request after deploy; no UAT mechanism to validate the new engine's output BEFORE committing the user's library to it). Path (c) rejected — leaves the per-document fallback story unowned through v2.6→v3.0, and breaks Phase 076's extraction-comparison UAT plan (which needs `/reextract` to A/B Docling vs PyMuPDF vs Legacy on the same source bytes). Path (b) selected. Implementation (Phase 071 Plan 04): `POST /documents/{id}/reextract` body `{engine: Literal['docling','pymupdf','legacy']}` REQUIRED; owner-only RLS returning 404 (not 403) on cross-user miss (T-071-04-01 information-disclosure mitigation); hard-deletes existing `document_chunks` + `document_tables` + `document_images` before resetting `documents.status='pending'` + `extractor=NULL`; `version_number` NOT bumped (D-25 versioning contract preserved — engine swap is not a source-bytes change); BackgroundTask threads `engine_override=body.engine` into `ingest_document`. Migration 040 backfills `documents.extractor='pypdf-legacy'` for existing rows (so the engine lineage column is non-NULL on day-1 of v2.6 close); existing chunks/tables/images stay byte-identical until an operator opts a document into `/reextract`. New uploads default to `EXTRACTOR_PRIMARY='docling'`. See `.planning/phases/071-docling-primary-path/071-CONTEXT.md` D-071-13 + `backend/app/api/documents.py::reextract_document` + the 4 binding tests at `backend/tests/integration/test_documents.py::TestReextractDocument` (happy_path_returns_202 / invalid_engine_returns_422 / missing_engine_returns_422 / owner_only_returns_404). | New — locked 2026-05-14 by Phase 071 Plan 04 close; closes Q-v2.6-04 |
| **D-v2.6-05** (D-PRD-15): Docling demotion + camelot table default + PyMuPDF in-process posture (post-071.3) | Docling consistently failed to deliver on its table/image recall promise across Phases 070, 071, 071.1, 071.2 (4-min stalls, OOM, ~750 MB install with RapidOCR, `httpx<0.29` pin solely to accommodate Docling). User direction 2026-05-15 ([[feedback-docling-skepticism]]): "I believe we should neglect Docling completely... we still need to extract the correct tables and images." Phase 071.3 (`071.3-docling-demotion-table-engine-full-rip`) replaced Docling with **camelot** on the per-aspect dispatcher's tables registry (Plan 01 bench winner: 214 raw tables on user thesis vs pdfplumber's 4 = 53.5x; 15 vs pymupdf's 9 on `friendly_real.pdf`; gmft excluded due to transformers strict-dataclass break on TATR `dilation=None` config). Migration 047 sealed `app_settings.extraction_table_engine_pdf` default to `camelot` with CHECK constraint reducing allowed values to `{camelot, pdfplumber}`. Equation engine reduced to `none` (placeholder — no equation extraction in v2.6). Plan 04 hard-deleted Docling adapters + source file + AGPL subprocess fence (PyMuPDF in-process per Phase G PASS smoke test on `reference.pdf`); `httpx>=0.28.0` upper-bound removed (Phase F PASS — supabase-py's transitive `postgrest==2.29.0` still caps httpx at <0.29 but our requirements.txt no longer carries the policy constraint); EXTRACTOR_DOCLING_* env knobs + EXTRACTOR_PRIMARY env var all evicted. Plan 05 live UAT (3 fixtures): thesis 214 tables / 20 images / 461 chunks; friendly_real.pdf 15/1/65; reference.docx 1/1/2 — SC#6 ship floor (>=15 tables, camelot target) cleared by 14.3x. SEED-019 closed; SEED-020 (retrieval-quality audit) planted; SEED-021 (table/image recall lift) planted because thesis image axis tripped (20 < 45 per D-071.3-16). **Supersedes D-PRD-07 Appendix** (PyMuPDF AGPL subprocess fence policy — fence retired; AGPL in-process posture per D-PRD-07 main clause remains the authority for PyMuPDF specifically). Supersedes D-v2.6-01 partially (`docling>=2.93.0,<3.0.0` no longer in requirements; `httpx<0.29` cap removed; `supabase>=2.29.0` relaxed from `==2.29.0`). | New — locked 2026-05-16 by Phase 071.3 Plan 05 close; v2.6 PRD's "Docling-first" thesis formally retired in favor of per-aspect swap-by-default optionality |
| **D-PRD-12**: Multi-worker enablement — D-v2.5-02 formally superseded | Phase 077 proved --workers 2 safe (50-run load, cross-worker cancel, sandbox re-attach, singleton isolation); Phase 073 shipped asyncpg; WORKER_COUNT=2 default; revert via env var flip | New — locked 2026-05-27 by Phase 079; supersedes D-v2.5-02 |
| **D-083 (FOUND-01)**: Tool-dispatch extracted to registry-pattern `tool_dispatcher.py` | threads.py at ~3,800 LOC across 9+ phases (G-5 hot-file); tool-specific handling moved out so new tools register without re-touching the streaming handler | ✓ Good — v2.7 Phase 083; 16 tools migrated byte-identical; all new v2.7 tools register here |
| **D-085**: `ask_user` uses Redis pub/sub (not asyncio.Event) | asyncio.Event fails across workers; WORKER_COUNT=2 means the POST response can land on a different worker than the paused loop | ✓ Good — first Redis pub/sub in codebase; SUBSCRIBE-first + cancel sentinel + lifespan shutdown broadcast |
| **D-085**: `task` sub-agent — 1-level nesting cap + dual concurrency caps | unbounded sub-agent spawning is a cost / runaway risk | ✓ Good — per-run `Semaphore(3)` + global Redis Lua-atomic cap 20 |
| **PANEL-06**: panel SSE events route to dedicated Zustand keys, never chat `bucketsBySurface` | a shared store would re-render the chat message list on every panel update | ✓ Good — verified zero chat re-renders on `workspace_file_written` |
| **D-087**: chat\|panel split is one ChatLayout-level CSS grid + single nav-style in-panel toggle | self-referential aside-grid collapsed the panel to its min floor; two toggles + a hidden state confused reopen | ✓ Good — 087-06/087-08 closed 7 layout gaps; collapse-to-rail always reachable |
| **D-088 / SEED-034**: universal tool-use directive is TEXT-ONLY (no `tool_choice` forcing) | per-provider overlays / forced tool_choice risk shared-path regressions; weak models just need a prompt nudge | ✓ Good — FOLDED; 6-provider eval showed +3 fixes / 0 regressions; TASK_TOOL untouched |
| **D-17**: gemini-3 `thought_signature` echo (075.4 Stage-4 hotfix) confirmed at v2.7 close | Google rejects subsequent tool rounds (400 INVALID_ARGUMENT) unless the prior signature is echoed back | ✓ Good — closed-verified in Phase 088; deep-flow + multi-tool rounds zero 400 |
| **D-v2.8-01**: v2.8 = Harness Engine + dual-mode ONLY; Plugin Contract deferred to v2.9 | Six-dimension scoping analysis (bugs/seeds/planned-scope/trajectory/codebase-readiness/carry-forwards): codebase verified-ready (harness generalizes shipped `task`/`ask_user`/`tool_dispatcher` primitives), no downstream milestone hard-blocked, debt light (7 polish-only bugs, zero data/RLS/crash). Plugin contract is cross-milestone load-bearing (v3.0/v3.3/v3.4/v3.5+) and expensive to change wrong → lock it on harness telemetry, mirroring the v2.7 split. Riders (chat-card unification + Anthropic parity) + SEED-029/034/035/036a folded in. | New — locked 2026-05-30 by /gsd:new-milestone scoping |
| **GATEWAY-01 / D-092.5**: one shared provider gateway Deep AND the harness consume | the harness only worked on OpenAI because per-provider dispatch was entangled in the agent loop; one home for provider logic + reach parity by consuming, not re-implementing | ✓ Good — v2.8 Phase 092.5; Deep byte-identical native-7 (red line held); harness reached native-7 parity in 093 |
| **PARITY-02 over PARITY-01** (rescope discuss-093) | live UAT proved the parity gap was the *harness* path, not Deep (Deep is provider-robust on all 7); don't risk the shared path for non-reproducing Deep polish | ✓ Good — PARITY-02 Validated 093 (D-21 8/8); PARITY-01 re-deferred |
| **D-094-UNIFY**: the workspace panel is the single live-execution surface for BOTH Deep and Harness | one honest surface for mid-run state across modes; reverses the in-chat Run-Card for Deep | ✓ Good — v2.8 Phase 094; PANEL-06 zero chat re-renders preserved |
| **D-095.1**: run honesty = projection/classification over existing data; provider handling at the gateway boundary | no migration / no new SSE event / never break the shared path; conventions don't transfer 1:1 between providers | ✓ Good — v2.8 Phase 095.1; deterministic panel fill + true 429 classification across all 8 providers |
| **D-v3.0**: document management is a metadata-driven Tier-A surface, not a full M-Files vault | adopt M-Files metadata/relationships/classification basics; reject object-types/classes/value-lists (fights our folder+metadata model) and silent auto-filing (fights the audit/honesty positioning) | ✓ Good — v3.0; 24/24 delivered; suggest-then-confirm classification, no silent moves |
| **D-v3.0-COMPILER**: views compile a closed-registry filter-AST → parameterized `metadata @> $1::jsonb`, never a raw end-user DSL | a freeform query language is an injection + UX hazard; a guided condition builder over a closed operator/field registry is safe and testable | ✓ Good — Phase 113; leak-safe global sharing proven with live two-user tests |
| **D-v3.0-SHARE-DONT-FORK**: leak-safe read cores are extracted once and consumed by BOTH the agent tool and the REST route | a forked second copy can drift and silently re-open a cross-user leak | ✓ Good — `document_view_resolver.py` (115) + `document_relationship_service.py` (117); no fork-drift |
| **D-v3.0-GEMINI-SCHEMA**: agent-tool schemas avoid anyOf/oneOf AND multi-type `type:[...]` arrays | google-genai 400s on both; no-anyOf is necessary-but-not-sufficient for Gemini | ✓ Good — found live in 115 UAT (a multi-type array broke all Gemini Deep tool use); fixed + locked |
| **D-v3.0-EMBED-SPOF**: embeddings become provider-configurable (retire the OpenAI-only SPOF) | an OpenAI quota outage previously broke document search for ALL providers (SEED-048) | ✓ Good — Phase 111.1; provider picker + guarded RLS-scoped re-embed; closes SEED-048 |
| **D-v3.0-PER-PHASE-RIGOR**: substitute per-phase verify+secure+validate for a formal milestone audit | every v3.0 phase already cleared all three gates with live evidence; a formal audit adds ceremony without new signal (v2.9 precedent) | ✓ Good — 11/11 phases three-gate clear; 37 open artifacts triaged zero CORE blockers at close |
| **D-v4.0-CONTRACT**: four source families are thin adapters over ONE `browse / list / read / check` contract | a watched source must be **data, not code** — and the claim was tested twice by hash rather than asserted: 239 bound a server whose vocabulary shares nothing with the reference, 240 added mail with `sources/base.py` byte-identical | ✓ Good |
| **D-v4.0-VISIBILITY**: one visibility per **connection**, enforced in RLS at all four sites (`SEED-210` Option 3) | ownership-based RLS was only ever adequate because ingestion was manual; the commit that retires the manual-upload-only rule retires that reason too | ✓ Good |
| **D-v4.0-H5**: a `missing` verdict may be written only from a listing whose final page asserted completeness | fail-closed by construction — an incomplete listing can never delete a customer's documents, and no amount of care substitutes for the structural guarantee | ✓ Good |
| **D-v4.0-QUEUE-FIRST**: the durable queue's correctness is proven on the existing `/upload` route **before** any connector uses it | a queue debugged through a connector is two unknowns at once | ✓ Good |
| **D-v4.0-ATTACK**: the anti-injection discipline is verified by **mutation** — remove a defence and the suite must fail | an attack suite that passes with the defence deleted proves nothing; this is the only property that makes one worth keeping | ✓ Good |
| **D-v4.0-EF-DEFAULT**: `hnsw.ef_search` ships as an operator setting with the **default unchanged** | the remedy is measured and available, but changing a retrieval default across every install on one phase's evidence is a bigger claim than the evidence supports — ⚠ the cost is that `QUEUE-06` is honestly **not met out of the box** | — Pending |
| **D-v4.0-SELF-VERIFY**: 238, 240 and 241 closed on the builder's own verdict | no independent reviewer existed (Gemini unavailable, `/code-review ultra` ruled out on cost) and the operator directed the builds to proceed — recorded as a **decision**, never as a claim that they were reviewed | ⚠️ Revisit |
| **D-v4.0-DRIVE-IT**: a claim about the product is closed by **driving the product**, never by reading a register | measured three times in one hour: a file listing is not a review, a review is a claim ABOUT code, a summary is a claim about a moment — two CRITICALs were escalated as live when they had been fixed two days earlier in an ancestor of the auditing commit | ✓ Good |

## Constraints

- **Tech stack**: Must use existing Supabase infrastructure — no new databases or storage systems
- **Supabase deployment**: Agnostic — works with local Docker or cloud; all schema changes as numbered migration SQL files
- **Extraction**: Keep pypdf + python-docx pipeline — no Docling migration
- **Context window**: Tree/ls output must respect context limits — use depth limits and truncation
- **RLS**: All tools must respect Row-Level Security — users only see their folders/documents/skills (except global)
- **Ingestion dependency**: grep/glob/read only work on ingested content, not raw uploaded files
- **Sandbox**: Docker required for code execution; SANDBOX_ENABLED=false (default) disables all sandbox features safely

## Appendix

### Confidence Calibration (Phase 076, 2026-05-25)

**Extractor defaults at calibration time:** camelot (tables) + pymupdf_full (images) + legacy/pypdf (text) + none (equations)
**Embedding model:** text-embedding-3-small
**Sample size:** 121 queries (100 from audit_log + 21 synthetic)

| Metric | Value |
|--------|-------|
| Median avg_similarity | 0.4861 |
| P25 | 0.3807 |
| P75 | 0.5433 |
| P10 | 0.3010 |
| P90 | 0.5642 |
| Std dev | 0.1330 |

**Bucket proportions at prior thresholds (high >= 0.55 / medium >= 0.40):**
| Bucket | Proportion | Target |
|--------|------------|--------|
| High | 14.0% | ~30% |
| Medium | 53.7% | ~45% |
| Low | 32.2% | ~25% |

**Bucket proportions at new thresholds (high >= 0.54 / medium >= 0.38):**
| Bucket | Proportion | Target |
|--------|------------|--------|
| High | 30.6% | ~30% |
| Medium | 45.5% | ~45% |
| Low | 24.0% | ~25% |

**Verdict:** ADJUSTED from 0.55/0.40 to 0.54/0.38 -- post-071.3 extraction stack (camelot tables + pymupdf_full images) shifted the score distribution lower (median 0.4861). The prior 0.55 high threshold captured only 14% of queries as "high confidence" (target ~30%). Lowering to 0.54/0.38 restores D-04 target bucket balance within 1% tolerance.

**Telemetry:** pdf_extraction_runs.engine column exists and schema is correct; 0 recent rows because no extraction was triggered in the last 30 days. Column will be populated on next /upload or /reextract.

**Re-run:** `cd backend && venv/Scripts/python.exe ../scripts/calibrate_confidence.py`

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-10 — **milestone v4.0 Connected Knowledge COMPLETED** via /gsd:complete-milestone (git tag `v4.0`; 14 phases, 62 plans, 33/38 requirements, 5 named ⛔ not-ticked). Carried: two credential-blocked UAT sets (241 row 5 **expires when migration 176 reaches cloud**), three phases owing an independent §6.3 review, 15 pending cloud migrations, 161 planted seeds and 34 open reported bugs. Prior entry: 2026-09-04 — **milestone v4.0 STARTED** via /gsd:new-milestone. Scope set by operator at intake: `SEED-210` Option 3 (connection-scoped visibility) ships and `SEED-211`'s M-Files fork is decided-not-built; all four source families in; `SEED-212` transcripts out with trigger intact; v3.9's owed verification gets its own closeout phase rather than a `STATE.md` bullet. 18 seeds folded. Phase numbering continues at **228**. ⚠ `LIB-08/09/10` must be written into `REQUIREMENTS.md` — they have never existed outside a roadmap heading. Prior entry: 2026-09-04 when v3.9 completed.*
