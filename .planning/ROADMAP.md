# Roadmap: Agentic RAG

## Milestones

- ✅ **v1.0 Knowledge Base Explorer** — Phases 1-8 (shipped 2026-03-29)
- ✅ **v2.0 Agent Skills & Code Execution** — Phases 9-17 (shipped 2026-04-04)
- ✅ **v2.1 Stability & RAG Correctness** — Phases 18-25 (shipped 2026-04-11)
- ✅ **v2.2 Trust & Compliance** — Phases 26-32 (shipped 2026-04-16)
- ✅ **v2.3 Memory, Multimodal & Experience** — Phases 33-43 (shipped 2026-04-19)
- ✅ **v2.4 Stability, Polish & UX Fixes** — Phases 44-57 (shipped 2026-04-30)
- ✅ **v2.5 Deployment Strategy** — Phases 058-067.5 (shipped 2026-05-09)
- ✅ **v2.6 Foundation: RAG Quality + Multi-Worker + Polish** — Phases 068-082 (shipped 2026-05-27)
- ✅ **v2.7 Agent Workspace & Panel** — Phases 083-088 (shipped 2026-05-30)
- ✅ **v2.8 Harness Engine & Workflow Mode** — Phases 089-096 (shipped 2026-06-07)
- ✅ **v2.9 Workflow Studio** — Phases 097-104 CORE (shipped 2026-06-15); STRETCH 105-109 deferred
- ✅ **v3.0 Document Management** — Phases 110-119 (shipped 2026-06-21). SEED-005 Tier A as a first-class product surface: DM Foundations → metadata enrichment + multi-provider embeddings → metadata-driven views / "virtual folders" → document relationships → auto-classification → governance health. 24/24 functional requirements delivered.
- ✅ **v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers** — Phases 120-129 (CORE 120-124+123.1; STRETCH 127-129 shipped; 125/126/130/131 deferred) (shipped 2026-06-28). Collision fix + context isolation · cross-provider trust/honesty parity · Skill Trigger Tuner · Workflow Studio soul + strict↔loose · chat tool-card unification + provider logos · MiniMax/OpenRouter arg repair.
- ✅ **v3.2 Skill Eval Studio + Self-Improving** — Phases 132-145 (CORE 132-137 + inserts 134.1/137.1/137.2; STRETCH 138-143+145 shipped; 144/FILE-01 deferred → v3.3) (shipped 2026-07-10). Skill Eval Studio (eval persistence + versions + with-vs-without runner + honest verdicts + ratings + self-improve loop + publish gate + Evals panel) · built-in skill-creator · STRETCH honesty phases · run-lifecycle foundation (FND-01) · Starter Workflow Library (WF-01).
- ✅ **v3.3 Operator UX** — Phases 146-159 (shipped 2026-07-18). Operator/admin tier (gated /admin Control Room + governance) + dynamic model-registry/discovery + secrets-at-rest + workflow/agent file-inputs + inline citations + plain-language + WCAG-AA + deployment presets/install wizard. 20/20 requirements delivered.
- ✅ **v3.4 Multi-Tenancy & Org Access** — Phases 160-168 CORE (shipped 2026-07-22); STRETCH 169-173 deferred → carry-forward guide `.planning/v3.4-STRETCH-CARRYFORWARD.md`. The load-bearing **one-way RLS door**: membership-based tenancy (Tenancy ADR → org/dept/role schema → personal-org backfill → the atomic RLS + user-JWT-client-swap crux → SECDEF audit + two-org isolation suite → `is_global` retirement → org-admin shell/switcher → invitations/roles/greenlists → SAML SSO). Migrations 104-113.
- ✅ **v3.5 UX Consolidation & Chat Polish** — Phases 174-177 CORE (shipped 2026-07-23); STRETCH 178-180 deferred → carry-forward guide `.planning/v3.5-STRETCH-CARRYFORWARD.md`. Cleared the load-bearing chat-surface bug backlog + consolidated the accumulated UI/UX (incl. the new v3.4 org surfaces) into one coherent, honest experience: run-state & lifecycle honesty (174) · cross-provider streaming fidelity (175) · chat render correctness + exec reliability (176) · v3.4 org-surface family-cohesion polish (177). 14/14 CORE requirements delivered; no migration. Full detail archived: `.planning/milestones/v3.5-ROADMAP.md`.
- ✅ **v3.6 Visual / No-Code Workflow Studio** ([[SEED-123]]) — Phases **181-189 CORE + 190 STRETCH** (shipped 2026-08-09, git tag `v3.6`); STRETCH **191 deferred** → carry-forward guide `.planning/v3.6-STRETCH-CARRYFORWARD.md`. Inserts 184.1 / 188.1 / 188.2. A drag-and-drop node-canvas authoring + non-technical live-run-observability layer ON TOP of the existing governed harness engine (build-on-not-rewrite; `@xyflow/react` v12, the milestone's one net-new dep). **The differentiator shipped: graded governance** — strict-when-KB-grounded / flexible-when-open per node, structurally enforced at RUN time rather than authoring time, which is the category white-space the Beam/Glean/n8n deep crawl found none of them covering. **The D-14 red line held across all 13 phases — 7 harness executors at close, exactly as at open; the canvas never became a second runtime.** HARD gates: #1 revert-at-any-time ✅ (`test_revert_byte_identical`) · #2 study-and-beat ✅ · #3 connector story **⚠ CORE half ✅ (CONN-01), live half ⅓** — a real Slack message sends through the full governed path, but Jira and email are not drivable from a workflow (`D-190-DEF-17` → connections milestone, SEED-146). **20/24 requirements satisfied · 2 partial · 1 unsatisfied (CONN-02) · 1 deferred (SCALE-01);** CORE closed 19/21 satisfied with **zero unsatisfied**. Migrations 114-118. Full detail archived: `.planning/milestones/v3.6-ROADMAP.md`.
- ✅ **v3.7 Workflow Product Completion** — Phases **192-200.3** (shipped 2026-08-24). 17 phases (CORE 192-198 + inserts 192.1, 192.2, 193.1, 193.2, 194.1, 199, 200, 200.1, 200.2, 200.3), 147 plans, 20/20 requirements satisfied. Full archive in `.planning/v3.7-MILESTONE-AUDIT.md`.
- ✅ **v3.8 Document Intelligence, Automations & Connectors** — Phases **201-209** (shipped 2026-08-26, git tag `v3.8`). 12 phases, 17 plans, migrations 124-126, 3 days. **11/11 requirements delivered.** Structured tables and email became first-class ingestion; workflows run unattended on a schedule with a brake that really stops work; a run can read its own prior run; and a workflow reaches any official MCP server with per-tool consent and **zero per-vendor adapter code**. ⚠ Closed `gaps_closed_partial` — three requirements are narrower than their wording and are carried with re-open triggers ([`audit`](milestones/v3.8-MILESTONE-AUDIT.md)).
- ✅ **v3.9 Connections: Any Service, Any Tool** — Phases **210-227** (shipped 2026-09-04, git tag `v3.9`). 16 phases (210-217 CORE + inserts 214.1 / 217.1 + 220-227; **218 absorbed** into 217.1; **219 deferred**), **111 plans**, migrations **127-129 / 140-141 / 150-152**, 9 days. **34/39 requirements delivered · 3 partial · 2 shipped-but-never-driven.** A connection became `{service identity, auth, discovered tools, per-tool grants}` — so adding a service adds **rows, not code**: Notion connects by OAuth with no developer console and returns **41 tools for zero lines of tool code**, and six Google applications sit under one token with **11/11 live writes**. Per-tool grants, an approval moment that stops a real run, an audit receipt per outbound call, connections usable by name in chat, and the Library as one home for documents. ⚠ **Phase 219 DEFERRED to the Connected Knowledge milestone** with `LIB-08/09/10` and `SEED-209/210/211/212` — its SC#1 *“watched on a schedule”* IS this milestone's own binding security re-open trigger ([`audit`](milestones/v3.9-MILESTONE-AUDIT.md)).
- ✅ **v4.0 Connected Knowledge** — Phases **228-241** (shipped 2026-09-10, git tag `v4.0`). 14 phases, **62 plans**, migrations **153-156 / 166-176**, 6 days. **33/38 requirements delivered · 5 ⛔ not ticked** (`SRC-03` Azure-blocked · `QUEUE-06` remedy shipped but the DEFAULT is unchanged · `SURF-03` home still an open decision · `DEBT-03` ultra ruled out · `DEBT-04` gated on a production push). The knowledge base stopped depending on somebody remembering to upload: a source is connected **once**, previewed before it brings anything in, and then watched on the **shipped** scheduler. Four families as thin adapters over ONE contract — Google Drive · OneDrive/SharePoint via Graph · **any** MCP file server · mail — with **239 proving zero-code by HASH** against GitHub MCP and **240 proving mail is a SHAPE, not a fourth adapter** (`sources/base.py` byte-identical). Connection-scoped visibility at all four RLS sites, a durable queue with cap/retry/resume, and the anti-injection discipline **actually attacked** (13/13 refused · 8/8 mutations caught · live drive refused by 8/8 native providers). ⚠ **241 measured a REAL recall defect at customer scale** — `recall@20` **0.040** at the shipped `ef_search = 40`, a **cliff not a slope**. ⛔ **238, 240 and 241 closed WITHOUT an independent §6.3 review**; two UAT sets owed on credentials ([`audit`](milestones/v4.0-MILESTONE-AUDIT.md)).
- ✅ **v4.1 Ship It & Feel It** — Phases **242-246** (shipped 2026-09-13, git tag `v4.1`). 5 phases, **25 plans**, migrations **177-180**, 3 days. **18/19 requirements delivered · 1 ⛔ unmet BY MEASUREMENT.** A deliberate **CONSOLIDATION** milestone — no new capability axis; every requirement closed something already in a register. The ship claims closed against the **database and the branch** rather than the deploy record; the chat surface stopped getting in the way (follow-scroll driven with a **real wheel** — 0 px drift, closing `BUG-260823-01` after two fixes that had passed on synthetic events; all five `SHELL` criteria driven in a browser); and v4.0's verification debt got **written verdicts** plus a greppable marker so a self-verification can no longer read as a review. ⭐ **Its best work is the requirement it did NOT deliver:** 246 proved by `EXPLAIN (ANALYZE)` that no `hnsw_ef_search` value fixes the small-tenant recall cliff through the index — every index walk returns **ONE row**, every good recall figure is a **~1.1 s sequential scan** — so the 200 default was **refused and reverted to 40**, with `RECALL-01` left open on `SEED-273`. ⭐ 246 is also the **first peer-reviewed phase since `OV-SOLO-01` was re-armed**. ⚠ Migrations **179/180 are not in cloud** and `production` is **287 commits behind**, so v4.1's own output is undeployed ([`audit`](milestones/v4.1-MILESTONE-AUDIT.md)).
- ✅ **v4.2 The Connected Knowledge You Can Actually Run** — Phases **247-254** (shipped 2026-09-18, git tag `v4.2`). 8 phases (247-251 scoped; **252 / 253 / 254 inserted by audit**), **31 plans**, migration **181**, 6 days. **25/26 requirements satisfied · 1 ⛔ unsatisfied (`DEBT-06`).** Integration **19/19** · flows **3/3**. **26 requirements in 6 categories**, 25 mapped to the five scoped phases and `DEBT-06` held as a **milestone-wide standing gate** that ends the milestone **unmet, by measurement**. ⚠ **The bullet above is CORRECTED, not rewritten: its closing claim — *"migrations 179/180 are not in cloud and `production` is 287 commits behind, so v4.1's own output is undeployed"* — was true when written and is now FALSE.** Measured at this scoping: `production` moved `e65610ac2 → eebc4c42f` (**292 commits**), `production..develop` is **0**, migrations **179 and 180 are applied and verified in cloud** (177/178 measured **already present** — `scripts/pending-cloud-migrations.sh` diffs git refs, not the live database, and over-reported by two), and `get_advisors(security)` returns **zero ERROR findings**. **v4.1 IS deployed.** v4.2 is therefore the SECOND consecutive **consolidation** milestone — no new capability axis, every requirement closes something already in a register, and each was **DRIVEN against the tree on 2026-09-13 rather than read from a `status:` field**, a method that caught three wrong register entries (two stale toward *"still broken"*, one toward *"fine"*). Watch-loop honesty (247) · the credential boundary (248) · the model you actually run (249) · run-honesty residue (250) · register integrity (251) — then **three phases the audit added**: the four blockers five green verifications could not see (252) · the bootstrap artifact that shipped every function wide open (253) · the independent review of 249-253 (254). **v4.2 opened on deployed code for the first time in three milestones, and closed on it.**
- ✅ **v4.3 What You Can Actually Sell** — Phases **255-264** (shipped 2026-09-23, git tag `v4.3`). 10 phases (255-260 scoped; 261-264 added in-milestone), **39 plans**, migrations **182-192**, 6 days. **31/32 requirements delivered · PACK-05 carried to SEED-304 by decision.** Extension contract, token metering + USD, enforceable tiers, Experts as data.
- ✅ **v4.4 Experts That Actually Work** — Phases **265-269** (shipped 2026-09-29, git tag `v4.4`). 5 phases, **24 plans**, migrations **194-198**, 7 days. **17/17 requirements satisfied** (audit `tech_debt`, no blockers). A client installs an Expert and gets grounded answers from its own knowledge in their own org — proven by live drives as a real user, never by a mocked test. ✅ **DEPLOYED 2026-09-29** — production `82babd8d0`; migrations 195-198 applied to production (194 already was). Operator smoke test owed.
- ✅ **v4.5 Find It, Show It** — Phases **270-276** (shipped 2026-10-12, git tag `v4.5`). 7 phases, **38 plans**, migrations **199-206**, 14 days. **25/25 requirements satisfied** (audit `tech_debt`, no blockers). Find a document by what it IS and get the file back out, an agent that answers with interactive artifacts from a closed registry, thread-scoped attachments, retention with legal hold, and public docs. ✅ 270-274 + 276 **LIVE 2026-10-05** (prod `bd9e126c3`); ✅ **275 deployed 2026-10-12** (prod `784647e2d`, migrations 204-206).
- ✅ **v4.6 Pay It Down** — Phases **277-285** (shipped 2026-10-16, git tag `v4.6`). 9 phases, **34 plans**, migrations **207-209**, 5 days. **24/24 requirements satisfied** (audit `tech_debt`, no blockers). Repair only: 14 major-bug fixes, 5 v4.5 debt items, 3 G-5 extractions, 2 register-hygiene items. ✅ **DEPLOYED 2026-10-16** (prod `4e767a3a2`).
- ✅ **v4.7 Workflows You Can See and Start Anywhere** — Phases **286-296** (shipped 2026-10-27, git tag `v4.7`). 12 phases (292.1, 294, 295, 296 added in-milestone), **60 plans**, migrations **210-216**, 10 days. **21/21 requirements satisfied** (audit `tech_debt`, no blockers). Workflows start from a thread, a starter, a schedule or an API key; authoring finishes from your own files; a run shows what it did and on what evidence; runs pause instead of dead-ending. ✅ **DEPLOYED 2026-10-27** (prod `3ec36f998`).
- ✅ **v4.8 Every Page Has a Link** — Phases **297-302** (shipped 2026-10-30, git tag `v4.8`). 6 phases, **25 plans**, migrations **217-219**, 4 days. **28/28 requirements satisfied** (audit `tech_debt`, no blockers; integration 21/21 after two close fixes). Every view, thread, workflow, run and Expert has its own link that works across orgs and sign-in; lists follow the active org; a person is told in-app and by one content-free email when a run waits on them. ⚠ 297-300 LIVE (prod `31416d335`); 301, 302 and two fixes await an operator deploy (migration 219 first).
- 🚧 **v4.9 Use It From Your Own Tools** — Phases 303-309 (started 2026-10-30)

---

## v4.9 Use It From Your Own Tools — IN PROGRESS

**Started:** 2026-10-30. **Roadmap created:** 2026-10-30.
Requirements: [`REQUIREMENTS.md`](REQUIREMENTS.md). **29 v4.9 requirements, 29 mapped, 0 orphans** (7 KEY · 7 MCP · 4 OAUTH · 6 HOOK · 3 GUARD · 1 FIX · 1 REG). Research: [`research/SUMMARY.md`](research/SUMMARY.md).

**Goal:** A person can use their knowledge base, agent and workflows from an MCP client (Claude Code, Cursor, Claude.ai, Claude Desktop) and be told by webhook when something happens, without opening the app.

**Milestone rule (every phase):** a capability is proven by **driving it as a user** on the path the requirement names (a real MCP client, a real webhook receiver, a DB row, a request/response, a screenshot). A mocked test alone does not close a requirement. ⛔ Presence assertions cannot see content drift: where the words are the deliverable (a refusal sentence, a tool error, the consent page, a webhook payload, a redacted result), assert the **content**.
⛔ **Measure before building.** Every research figure (ledger triples, client timeouts, provider in-flight budgets, redactor false-positive rate) is a claim about the tree or the world on 2026-10-30. Re-measure at discuss.
⛔ **Outside callers read through the member, never the service role.** Every MCP read and every webhook visibility check goes through the acting-member RLS connection (`get_user_pg_connection(None, {"id": uid})`) narrowed to the credential's org. Every existing gate reads through the service role and nothing in the suite requests as `anon` (BUG-260911-01), so each new table gets an **anon-role test** and each cloud migration is followed by `get_advisors(security)`.

**Red line (every phase, the Extension Contract):** the closed core (**7 phase types / 1 emitter / 30 tools**) is re-counted against each phase's base commit with `test_259_closed_core_inventory.py`. **MCP tools are not engine tools**: they call services and never touch `_TOOL_REGISTRY`, `handle_search_documents` or `send_message`. No phase adds a tool, a phase type, an emitter or a validator kind. ⛔ **Do not touch** `backend/app/api/threads.py`, `backend/app/services/agent_loop.py`, `backend/app/services/provider_gateway/dispatcher.py` or `frontend/src/lib/api.ts` for this milestone's features (new client calls go in `frontend/src/lib/api/*.ts`). `harness_engine.py` and `StreamsProvider.tsx` are not edited unless a phase flags it and the operator approves.

**Baseline gates (every phase):** backend `pytest tests/unit -q --continue-on-collection-errors` at **<= 71 failed, 0 collection errors** (zero headroom); frontend `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` with no per-file decrease and 0 failing; frontend typecheck as `npx tsc -p tsconfig.app.json --noEmit` as a **set diff** against base; `node scripts/check-claude-md-size.cjs`, `node scripts/check-hot-file-ledger.cjs <phase>` and `node scripts/check-seeds-register.cjs` clear.

**Numbering:** Phases **303-309**. **Migrations resume at `220`** (`ls supabase/migrations | tail -1` reads `219_notifications_realtime.sql`). Research places 220 (key kind, origin columns, audit literals) and 221 (org narrowing, settings knobs) in 304, a grants table in 307 and the webhook tables in 308. **No number is pre-assigned:** whichever phase needs one takes the next free number after re-running `ls`. Each migration is pasted into the local SQL editor, then `bash scripts/regenerate-full-schema.sh` (no `--reset`). The cloud paste is an operator step before the code that needs it deploys (per-action approval; `assert_action_types_synced` refuses boot otherwise).

**Solo running:** Claude builds and reviews. Phases close `verification_mode: self-verified`; review runs as a fresh-context `/gsd:code-review`.

**Out of scope:** the versioned `/api/v1` REST surface (next milestone) · full-agent `ask_agent` (sandbox, web search, connector writes) · org-shared MCP keys · answering a paused run over MCP · full-content webhook payloads · Claude Connectors Directory listing (`SEED-294`) · Presidio / spaCy redaction · Supabase's OAuth 2.1 server · active-org scoping of in-app chat search (see REQUIREMENTS "Future").

### Phase Table

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 303 | Word Template Bare Tokens | A bare `{{ name }}` in a Word template fills in the value or fails the integrity check, instead of writing a cited record's dict text into the document | FIX-15 | 4 | independent · **repro through the real sandbox driver first** · may collapse to `/gsd:quick` (G-3) · G-5 (`render_template.py`) · no research |
| 304 | Personal MCP Keys That Act as You | A member mints, narrows, sees and revokes a key that acts exactly as them in one org; admins and the operator can switch MCP off; proven at the credential and data layer before any transport exists | KEY-01, KEY-02, KEY-03, KEY-04, KEY-05, KEY-06 | 5 | **trust root, no transport** · **headline: two-org parity test** · focused research (EXPLAIN + baseline for the org GUC) · migrations (220/221) · security_enforcement · anon test · **G-2 sketch** (key screen) · G-4 · G-5 (`dependencies.py`, `SettingsPage.tsx`) · UI hint |
| 305 | Connect Claude Code and Cursor | A member connects Claude Code or Cursor to one stable MCP URL with their key and searches, lists and reads their documents, every call audited, limited, counted in spend, and redacted when the org asks | MCP-01, MCP-02, MCP-03, MCP-07, KEY-07, GUARD-02, GUARD-03 | 5 | **research** · SDK bump + `test_059` retired under a `D-NN` · stateless on two workers · redaction choke point ships here · G-5 (`main.py`, `config.py`, `AdminSpendPage.tsx`) · ledger row owed (`middleware/maintenance.py`) · deploy parity · UI hint |
| 306 | Ask the Agent and Run Workflows | From an MCP client a member asks the agent and gets a cited answer, and starts and follows a published workflow, under admission limits that leave in-app users unaffected, with no path from an outside prompt to the sandbox, the web or a write | MCP-04, MCP-05, MCP-06, GUARD-01 | 5 | **research** · **8-row cross-provider roster** · four-axis UAT · `inbound.py` extraction FIRST (`key_run_read`) · ⛔ no edit to `threads.py` / `agent_loop.py` / `dispatcher.py` · security_enforcement · G-4 · UI hint |
| 307 | Sign In From Claude.ai and Claude Desktop | A member adds Syrel as a custom connector in Claude.ai or Claude Desktop, signs in on a Syrel consent page and uses the same tools under the same limits as a key, on cloud and the one-box | OAUTH-04, OAUTH-05, OAUTH-06, OAUTH-07 | 4 | **research spike** · own authorization server (decided) · **G-2 sketch** (consent page, connected apps) · G-4 · security_enforcement · migration (grants) · `.well-known` routing parity (`nginx.conf` FIRES) · operator: real Claude.ai connect · UI hint |
| 308 | Told by Webhook | A member's own systems receive one signed, thin event per endpoint when a run finishes, a run waits on a person, or a document is ingested, retried and logged, never to an internal address or about something the owner can no longer see | HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, HOOK-06 | 5 | parallel with 306/307 (serialize DB-mutating suites) · migration (webhooks) · RLS + anon test · `egress.py` one capability · ledger row owed (`ingestion_queue_service.py`) · **G-2 sketch** (webhook screen) · G-4 · security_enforcement · UI hint |
| 309 | Close-Out: Docs, Register, Deploy Parity | A person can connect any supported client from the public docs alone, and the register and the deploy checklist say what actually shipped | REG-10 | 3 | runs last · no research · no new capability |

**Dependency order:** 303 anywhere; 304 → 305 → 306; 307 after 305; 308 after 305 (beside 306 and 307); 309 last. The real constraints:

- **303 is independent.** It touches only the Word template path and can run in any gap, or as `/gsd:quick` if the repro shows a few-line fix.
- **304 comes before every MCP phase.** It is the only phase whose failure is a cross-org data leak, and every tool, the OAuth path and webhook visibility inherit its acting-member context and its one liveness predicate. It ships no transport so the trust root is reviewed alone.
- **305 after 304.** Reads before spend: the transport, auth, limits, result shape and the redaction choke point are proven on read tools before anything costs money or creates a thread.
- **306 after 305.** Start-type tools reuse 305's server, limits and guard; admission control lands with the first thing it protects.
- **307 after 305** (operator decision D2: OAuth is the fourth build phase, before webhooks). An OAuth grant is a key minted through a consent screen, so it swaps only the credential resolver behind 304's principal and needs 305's 401 challenge. It does not depend on 306.
- **308 after 305**, beside 306 and 307. It reuses 304's liveness re-check and 305's outbound guard and shares no files with 306/307 beyond the one-line `main.py` lifespan block. Worktree rule 4: suites that mutate the local database serialize across these phases.
- **309 last.** Its docs describe what 303-308 shipped.

### Phase Checklist

- [ ] **Phase 303: Word Template Bare Tokens**: reproduce BUG-261022-01 through the real sandbox driver, then a bare `{{ name }}` renders the value or fails the integrity check; `{{ name.value }}` keeps working (FIX-15)
- [x] **Phase 304: Personal MCP Keys That Act as You**: acting-member org narrowing, one key resolver and liveness predicate, the key screen with presets and snippets, narrowing, revoke, org and operator kill switches, proven by a two-org parity test (KEY-01..06)
- [x] **Phase 305: Connect Claude Code and Cursor**: stateless MCP server at one URL, `search_knowledge_base` / `list_documents` / `read_document`, tool labels and plain errors, maintenance behaviour, per-key audit and limits, spend attribution, fail-closed PII redaction (MCP-01, MCP-02, MCP-03, MCP-07, KEY-07, GUARD-02, GUARD-03) — **CLOSED 2026-10-31 by decision** (self-verified 4/5 SC; SC#1 client rows Cursor / cloud / one-box / Claude Desktop OWED to the operator; NOT deployed — deploys with 304)
- [x] **Phase 306: Ask the Agent and Run Workflows**: `ask_agent` / `get_answer` with a closed read-only tool set, MCP asks in thread history, `list_workflows` / `run_workflow` / `get_workflow_run`, admission control for MCP and `/inbound` starts (MCP-04, MCP-05, MCP-06, GUARD-01) — **CLOSED 2026-11-03 by decision** (self-verified 5/5 SC after quick 261101-4y9 fixed review CR-01/CR-02; 5 live UAT rows OWED in 306-HUMAN-UAT.md, run row 5 first; NOT deployed — cloud 220→223 owed)
- [x] **Phase 307: Sign In From Claude.ai and Claude Desktop**: own OAuth 2.1 authorization server per the MCP spec, consent page with org and narrowing, rotating refresh, connected apps with revoke (OAUTH-04..07) — **CLOSED 2026-11-04 by decision** (self-verified 4/4 SC in code; review 10 fixed, WR-05 deferred SEED-397; 8 human rows OWED in 307-HUMAN-UAT.md — operator postponed, run row 5 first; /gsd:secure-phase 307 owed; NOT deployed — cloud 220→224 owed)
- [ ] **Phase 308: Told by Webhook**: endpoints, event choice and test event, Standard Webhooks signing with rotation, exactly-once emission from triggers, retries and delivery log, visibility re-check and SSRF refusal, admin control (HOOK-01..06)
- [ ] **Phase 309: Close-Out: Docs, Register, Deploy Parity**: per-client quick starts, webhook verification, "Claude.ai needs OAuth", the register made true, the deploy-parity checklist (REG-10)

### Phase Details

#### Phase 303: Word Template Bare Tokens

**Goal**: A Word template that uses a bare `{{ name }}` against a cited record fills in the value, or the run stops at the integrity check with a reason, instead of writing the record's dict text into the document; templates that use `{{ name.value }}` keep working.
**Depends on**: Nothing (independent; can run in any gap).
**Requirements**: FIX-15
**Success Criteria** (what must be TRUE):

  1. Before any fix, the defect is reproduced through the real sandbox driver, not a unit-level mirror: a template with a bare `{{ name }}` filled from a cited-record context produces a document containing the record's dict text, and the evidence (template, run id, the produced document) is kept (FIX-15).
  2. After the fix, the same template produces a document whose body, headers, footers and nested tables show the value, or the run stops at the integrity check with a worded reason. No document with record text in it reaches the user (FIX-15).
  3. Templates using `{{ name.value }}`, `|default` and `score` produce the same output as before the fix, shown by re-running the existing golden runs (FIX-15).
  4. The sandbox driver and `template_render_service._replace_in_paragraph` behave the same on a bare token, pinned by one test that fails if the two copies diverge (FIX-15).

**How we'd know this failed**: the repro ran only through a mirror and the driver still writes record text; only one of the two rendering copies is fixed; `residual_tags_in` still cannot see a rendered repr; the fix blanks the token so the document reads empty where a value belongs; `{{ name.value }}` or `|default` output changes; the integrity check skips headers, footers or nested tables; `Dockerfile.sandbox` changes without a new image tag and `SANDBOX_IMAGE` in the same commit.
**Plans**: TBD
**Flags**: **The repro decides the size.** If the fix is a few lines in one file with no schema or API surface, run it as `/gsd:quick` (G-3), not a phase. **G-5**: `backend/app/services/tools/render_template.py` (`6 / 3 / 1163`, FIRES) — a minimal edit honoured by construction, or take its named seam first; read its section of `docs/HOT-FILE-LEDGER.md` at discuss. No image rebuild expected. No migration. No research. Folds `BUG-261022-01`.

#### Phase 304: Personal MCP Keys That Act as You

**Goal**: A member can mint a personal MCP key that acts exactly as them inside one org, narrow it, see its last use and revoke it; an org admin and the operator can switch MCP off; and all of it is proven at the credential and data layer, before any MCP transport exists.
**Depends on**: Nothing (first MCP phase; independent of 303).
**Requirements**: KEY-01, KEY-02, KEY-03, KEY-04, KEY-05, KEY-06
**Success Criteria** (what must be TRUE):

  1. A two-org parity test, run as a non-owner member through the acting-member RLS connection (never the service role), shows that every read a key can make (folders, documents, search, views, relationships, workflows) returns exactly what that member sees in the app with that org active, and nothing from their other org. Removing the membership makes the next resolution refuse (KEY-02).
  2. A member creates a key in Settings and sees the secret once. The new key defaults to read-only tools with an expiry; ask and run are unticked; connector-fed folders (mailbox, synced sources) are unticked. The screen gives a copy-ready snippet for Claude Code, Cursor and VS Code that reads the key from an environment variable, warns against pasting a personal key into Claude.ai's org-wide headers, and offers a Claude Desktop bridge snippet labelled as a workaround until OAuth ships (KEY-01, KEY-04).
  3. A member narrows a key to a folder set (subfolders included) and a tool subset. An empty folder set is refused at save. Narrowing only removes access: one driven test per read path (search, document read, list, views, relationships) shows a narrowed key reaches nothing outside its folders, and global folders are excluded unless ticked (KEY-03).
  4. The member sees each key's last use and can revoke it. A key that is revoked, expired, or whose owner left the org or was banned is refused on its next resolution, with the same refusal each time (KEY-05).
  5. An org admin lists and revokes every MCP key in the org and switches MCP off for the org; the operator switches it off for the whole deployment; each takes effect on the next resolution. A workflow API key never authenticates as an MCP key, and an MCP key never authenticates `/inbound` (KEY-06).

**How we'd know this failed**: any key read goes through the service role and re-implements visibility; the org narrowing loses the `current_user_org_ids()` initPlan shape under `EXPLAIN`, or the backend baseline rises above 71; behaviour with the org setting unset is not identical to today; an empty folder set means "no filter"; a second key resolver appears beside the extracted `authenticate_presented_key` (the W-1 drift class); the secret is stored unhashed or shown twice; a snippet puts the key in a URL; revocation waits for a cache to expire; a new table or column is readable by `anon` or another user, or `get_advisors(security)` shows a new ERROR; the parity test passes only for the org owner.
**Plans**: 6 plans in 4 waves

- [x] 304-01-PLAN.md — migrations 220/221, the GUC-narrowed current_user_org_ids(), the one dependencies.py edit, acting-member connection, EXPLAIN evidence + RLS live suite (wave 1, mutates local DB)
- [x] 304-02-PLAN.md — resolver core extracted (pure move first), mcp kind + srl_mcp_, principal_still_allowed, McpPrincipal, KeyScope, tool catalogue + mcp_url (wave 1)
- [x] 304-03-PLAN.md — narrowed reads + the headline two-org non-owner parity suite, negative arms, narrowed-key arms (wave 2, mutates local DB)
- [x] 304-04-PLAN.md — kind on the 293 key routes, pickable folders, org switch (audited) + operator flag, wire contract + OpenAPI (wave 2)
- [x] 304-05-PLAN.md — member key screen: kind choice, MCP draft, show-once snippets, MCP card, revoke facts (wave 3)
- [x] 304-06-PLAN.md — org switch card, admin list notice, audit words, Control Room switch; phase bookkeeping + full gates (wave 4)

**UI hint**: yes
**Flags**: **Headline must-have: the two-org parity integration test**, as a non-owner member, with the removed-membership negative arm. **Research (focused)**: the `EXPLAIN` check and a baseline-gate run for the org GUC narrowing in `current_user_org_ids()` (D4); fallback if `EXPLAIN` fails is explicit org predicates at each MCP read plus the same parity test. **Migrations** (research: 220 key `kind` / `folder_ids` / `tools` / `srl_mcp_` prefix, mig 215's `workflows >= 1` CHECK relaxed for `kind='mcp'`, `'mcp'` origin on `workflow_runs` / `threads` / `runs`, audit literals; 221 org narrowing + settings knobs) — next free numbers; any SECURITY DEFINER function has `EXECUTE` revoked from `PUBLIC`, not only `anon`. **security_enforcement** (`/gsd:secure-phase`). **G-2 sketch FIRST** for the key screen (create, show-once, presets, narrowing, snippets, warnings, last use, revoke) and the admin list. **G-4**. **G-5**: `backend/app/dependencies.py` (`24 / 12 / 1147`; the single sanctioned ~6-line edit for the org contextvar), `backend/app/services/audit_service.py` (lockstep literals), `backend/app/models/user_settings.py` (38) and `backend/app/api/settings.py` (26) for knobs, `frontend/src/pages/SettingsPage.tsx` (31; one mount), `frontend/src/components/org/OrgAdminShell.tsx` (6) for the admin list; extract `authenticate_presented_key` from `api_key_auth.py` before editing it. Reuse Phase 293's key, limiter and audit paths and `expert_scope` intersection semantics. Folds `SEED-195`; `SEED-013` in part.

#### Phase 305: Connect Claude Code and Cursor

**Goal**: A member connects Claude Code or Cursor to one stable MCP URL with their key and can search, list and read their documents; every call is audited, limited per key, counted in operator spend, and redacted when their org asks for it.
**Depends on**: Phase 304 (the key, the acting-member context and the liveness predicate).
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-07, KEY-07, GUARD-02, GUARD-03
**Success Criteria** (what must be TRUE):

  1. Claude Code and Cursor connect to one stable MCP URL with a key and show the tool list, on local, on the deployed two-worker cloud backend and on the one-box. Consecutive calls served by different workers succeed with no sticky session, and an app session JWT presented at the MCP URL is refused (MCP-01).
  2. `search_knowledge_base` returns ranked passages with document title, citation and an "Open in Syrel" link, with connector-fed passages marked external and quoted content delimited. `list_documents` and `read_document` page through folders and return a document's text in bounded chunks. A missing document and a forbidden one get the same refusal in words and shape, and a narrowed key gets nothing outside its folders from any of the three tools (MCP-02, MCP-03).
  3. Every tool is labelled read-only or not, every error comes back as a tool error with a plain sentence, and in maintenance mode reads still work while the MCP path answers starts with a JSON-RPC error carrying the maintenance sentence, never the HTML 503 (MCP-07).
  4. Every call writes an audit row naming the key, the tool and the outcome, and counts against per-key limits with cheap and expensive tools in separate buckets; a key over its limit gets an error the client's model can relay. A search-only session shows up in operator spend attributed to the org and the key (KEY-07, GUARD-02).
  5. With PII redaction turned on by an org admin (off by default), MCP results mask emails, phone numbers, card numbers, IBANs and secrets while citations, ids and links still work; when the redactor fails, the result is blocked, not sent unredacted. False-positive rate and latency are measured on real documents and recorded (GUARD-03).

**How we'd know this failed**: the server answers 421 in production only (host allowlist not derived from `BACKEND_PUBLIC_URL`) or advertises `http://` URLs; it works on one worker and fails on the other; the `test_059` fixture trips by surprise instead of being retired under a `D-NN`; tool narrowing holds at `tools/list` but not at `tools/call`; a forbidden document can be told apart from a missing one; tool descriptions change at runtime or contain user-authored text; retrieved markdown images are not defanged; redaction breaks a citation id or a link, or sends unredacted on error; search-only calls are missing from spend; `_TOOL_REGISTRY` changes from 30; maintenance mode returns HTML that clients report as "couldn't reach".
**Plans**: 4 plans (4 waves, serialized on the local-DB lock — every plan writes the local DB)

Plans:

- [x] 305-01-PLAN.md — SDK bump (httpx2 human-verified, installed once in main), test_059 retired under D-48, graceful shutdown, mig 222, stateless transport + key edge + maintenance, two-worker proof
- [x] 305-02-PLAN.md — search_knowledge_base / list_documents / read_document, result hygiene, identical refusal, narrowing at call, /app/library/<uuid> address
- [x] 305-03-PLAN.md — per-call audit, cheap/expensive per-key limits + searches knob, MCP activity on the key card, search usage in operator spend (mcp_usage leg)
- [x] 305-04-PLAN.md — outbound_guard + deterministic redactor (fail closed), org redaction switch + card, FP/latency + client-timeout measurement, 305-VALIDATION

**UI hint**: yes
**Flags**: **Research** (`/gsd:plan-phase --research-phase`): SDK `TokenVerifier` vs a pure-ASGI wrapper (D5 — either way it calls the one `authenticate_presented_key`); stateless behaviour on both workers with a 2025-11-25 client; static-bearer behaviour in Claude Code and Cursor; redactor false-positive rate and latency on the real corpus; host allowlist and proxy behaviour on cloud and one-box; the canonical MCP URL per topology (Q19 — refuse the mount if `BACKEND_PUBLIC_URL` is loopback in production). **Dependencies**: `mcp>=2.3.0,<3` + `sse-starlette>=3.0.3,<3.1`, no FastAPI upgrade; re-validate the SSE endpoints in `runs.py` and `skill_tuner.py` and retire the `test_059_disconnect` version fixture under a `D-NN`. **Redaction choke point** (`outbound_guard`) ships here behind a `Redactor` interface; webhooks reuse it in 308; names are not covered and the docs say so. **G-5**: `backend/app/main.py` (`99 / 73`; one mount + one lifespan block), `backend/app/config.py` (55), `frontend/src/pages/admin/AdminSpendPage.tsx` (FIRES, "extraction FIRST next" ⛔) — prefer showing MCP spend through the existing breakdown; if the page must change, take its seam first. ⚠ `backend/app/middleware/maintenance.py` has **no ledger row** — add it before any plan names it. **Deployment-artifact parity** (same commit) for any new env var. **security_enforcement**. **UAT**: Claude Code and Cursor on the deployed two-worker container; Claude Desktop only through the labelled bridge. Measure client timeouts here for 306. Folds `SEED-177`, `SEED-079`; `SEED-013` in part.

#### Phase 306: Ask the Agent and Run Workflows

**Goal**: From an MCP client, a member can ask the agent a question and get a cited answer, and can start a published workflow and follow it to its result, under admission limits that leave in-app users unaffected, with no path from an outside prompt to the sandbox, the web or any write.
**Depends on**: Phase 305 (the server, per-key limits, audit, spend attribution and the outbound guard).
**Requirements**: MCP-04, MCP-05, MCP-06, GUARD-01
**Success Criteria** (what must be TRUE):

  1. `ask_agent` returns an answer with citations and confidence within the wait budget (a Settings value, about 30 s by default). Past the budget it returns a handle that `get_answer` reads later, and a retry with the same idempotency key returns the same run, not a second one (MCP-04).
  2. Driven across the 8-row native roster plus OpenRouter, an MCP ask's audit shows only read-only tools: no `execute_code`, web search, connector write, memory save or skill save, even when the prompt asks for them. An ask that would need a person ends with "needs input in the app" and a link instead of waiting (MCP-04).
  3. The ask appears in the member's thread history in the app, marked as started from MCP (MCP-05).
  4. `list_workflows` lists only what the key may run; `run_workflow` returns a run id at once; `get_workflow_run` returns status and result. A paused run shows "waiting on <person>" with a link and cannot be answered over MCP. A key reads only the runs it started, and a workflow whose scope lies outside a narrowed key is refused (MCP-06).
  5. When an org, a credential or a provider is at its limit, MCP ask and run and `/inbound` starts get a plain "try again in N s" (a tool error over MCP, a 429 with `Retry-After` on `/inbound`), while an in-app chat started at the same moment is not slowed. With Redis unavailable, outside starts are refused and in-app use continues. Ask and run usage appears in operator spend by org and key (GUARD-01).

**How we'd know this failed**: a power tool appears in an MCP-origin run's audit on any provider; `threads.py`, `agent_loop.py` or `dispatcher.py` is edited to restrict the tool set; the outside prompt reaches the model without the TRUST-03 envelope; `run_workflow` blocks until the run ends; a retried ask creates a second run; `get_workflow_run` returns a run another credential started; a question is answered over MCP; admission slows in-app chats or fails open when Redis is down; the `key_run_read` extraction changes `/inbound` behaviour; an MCP ask is missing from thread history or unmarked; a workflow outside a narrowed key starts.
**Plans**: 5 plans (5 waves, serialized on the local-DB lock — every plan writes the local DB; G-8 D-24: five, not four, because the ask path splits into the run-path closure and the MCP surface)

Plans:

- [x] 306-01-PLAN.md — D-39 extractions first (inbound.py → key_run_read / key_run_start; search_documents_tool.py → search_vocabulary), mig 223 (threads.origin_* + freeze trigger, four app_settings knobs) applied locally
- [x] 306-02-PLAN.md — admission core (Redis ZSET leases by one Lua script) + idempotency claims, fail closed; /inbound 429 + Retry-After; the four knobs end to end in the limits card
- [x] 306-03-PLAN.md — tool-set closure (allow-list ContextVar, Seam A in search_vocabulary, Seam B in tool_dispatcher with the durable thread-origin check), TRUST-03 ask envelope, non-HTTP ask start/wait/read, two-org live proof
- [x] 306-04-PLAN.md — ask_agent / get_answer on /mcp (idempotency, admission, wait budget, refusals, start bucket); the mcp origin kind end to end + the history-row mark + the question bubble
- [x] 306-05-PLAN.md — list_workflows / run_workflow / get_workflow_run; spend by key through the runs leg; MCP key activity words; roster + burst scripts and 306-VALIDATION.md (UAT rows OWED)

**UI hint**: yes
**Flags**: **Research**: how the MCP-origin tool set can be closed through `run_producer` / `ThreadScoping` without editing `agent_loop.py` or `run_producer.py` (unverified — the gap to close first; start from `POWER_TOOLS` as the deny list plus every connector write); measured client timeouts from 305 before any default moves; provider in-flight budgets (`SEED-081` evidence table); idempotency design (Redis-deduped, bound to the credential). **Cross-provider UAT roster (CLAUDE.md, MANDATORY)**: the agent run path is touched, so the full 8-row board (OpenAI, Anthropic, Google, DeepSeek, Zhipu/GLM, MiniMax, Moonshot/Kimi, OpenRouter), derived from `MODEL_CAPABILITIES`, registry-backed ids, blocked rows recorded ⛔ with reason, never omitted. **Four-axis UAT**: multi-tool (search + read in one ask), parallel-thread (an in-app thread streams while an MCP ask runs), long-message (a ≥ 5 KB MCP prompt). **G-5**: `backend/app/api/inbound.py` (`10 / 3 / 719`, FIRES) — the `key_run_read` pure-move extraction is the first plan, proven behaviour-neutral; `backend/app/services/run_producer.py` (14) only if research shows no other path; `unattended_launch.py` (3), `workflow_kickoff.py` (12) one expression each. ⛔ No edit to `threads.py`, `agent_loop.py`, `dispatcher.py`, `lib/api.ts`. MCP-05 reuses Phase 293's thread origin field and its existing mark. **G-4** for the thread-history mark. **security_enforcement**. Folds `SEED-081`; `SEED-013` in part.

#### Phase 307: Sign In From Claude.ai and Claude Desktop

**Goal**: A member adds Syrel as a custom connector in Claude.ai or Claude Desktop, signs in on a Syrel consent page that names the client, picks the org and any narrowing, and then uses the same tools under the same limits and kill switches as a key, on cloud and on the one-box.
**Depends on**: Phase 304 (principal, narrowing, liveness predicate), Phase 305 (the MCP server and its 401 challenge). Not on 306.
**Requirements**: OAUTH-04, OAUTH-05, OAUTH-06, OAUTH-07
**Success Criteria** (what must be TRUE):

  1. A member adds Syrel as a custom connector in Claude.ai and in Claude Desktop, signs in, and uses the tools. The consent page names the client and its redirect host and lets the member pick the org and optional folder and tool narrowing. Claude Code signs in through a loopback redirect on any port (OAUTH-04).
  2. Sign-in follows the current MCP authorization spec: an unauthenticated call gets a 401 pointing at protected-resource metadata; S256 PKCE is required and `plain` is refused; dynamic client registration and client ID metadata documents are both advertised; tokens are bound to this server. The `.well-known` paths answer JSON, not the app page, on local, cloud and the one-box (OAUTH-05).
  3. An OAuth grant obeys the same narrowing, liveness checks and kill switches as a key, shown by a removal test per case (membership, ban, org switch-off, deployment switch-off). Its access token presented to the database API is refused. A refresh token rotates on use, and presenting an already-used one is refused (OAUTH-06).
  4. A member sees their connected apps and revokes each; an org admin revokes all of them in the org; the next call from a revoked app is refused (OAUTH-07).

**How we'd know this failed**: the access token is a Supabase user JWT that PostgREST accepts; redirect matching accepts an unregistered host (an open redirect) or rejects Claude's loopback on a new port; `.well-known` returns the SPA on Vercel or nginx; the client-metadata fetch bypasses `egress.py`; a second principal resolver appears beside 304's; the consent page does not name the client or the redirect host; refresh-token reuse goes undetected; it works locally and fails on cloud or the one-box; "Claude.ai works" is claimed without a real connect, refresh and revoke; an endpoint takes longer than 10 s.
**Plans**: 5 plans (4 waves; 307-04 writes no DB and runs beside 307-01, the other four serialize on the local-DB lock; G-8 D-43: five, not four, because the AS core splits into its data half and its protocol half by context budget)

Plans:
**Wave 1**

- [x] 307-01-PLAN.md — mig 224 (oauth_clients, oauth_tokens, api_keys.oauth_client_id, label index without grants, redirect-host allowlist) applied locally; token primitives + db layer incl. refresh rotation / 60 s grace / family revoke; the ONE resolver (key and access token share one admission tail)
- [x] 307-04-PLAN.md — routing parity: nginx .well-known proxy + consent anti-framing on all three layers pinned by the 297 suite with negative controls; operator docs (both Anthropic ranges, CIMD probe, mig 224 order, owed rows); Claude.ai and Desktop snippet tab by sign-in (bridge retired)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 307-02-PLAN.md — the authorization server: redirect / DCR / CIMD rules, client_metadata egress capability, OAuth limiter buckets, .well-known docs + 401 resource_metadata, Redis store, register / authorize / token / revoke; live round trip, per-case removal, PostgREST refusal

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 307-03-PLAN.md — consent: one narrowing validator shared with key create, /oauth/requests read / approve / deny, the consent page with every state + host-match and frame guards, one App.tsx branch, one appRoutes arm, one returnTo kind

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 307-05-PLAN.md — connected apps (member) + Disconnect, org connected apps + Disconnect all, Control Room return-address allowlist, audit words, live removal via routes; phase ledger + CLAUDE.md bookkeeping and full gates

**UI hint**: yes
**Flags**: **Research spike**: own authorization server (decided at intake, D1/Q9 — opaque, hashed, per-call-looked-up tokens that are MCP grants; Supabase OAuth is out of scope) vs the SDK's `OAuthAuthorizationServerProvider` as the fast path; Claude's DCR vs CIMD selection; port-agnostic loopback matching; refresh-rotation reuse detection; `.well-known` routing on Vercel, Coolify and the one-box; WAF reachability from Anthropic's egress range. **Migration** (the grants table; next free number); RLS, anon-role test, `get_advisors(security)` after the cloud paste. **security_enforcement**. **G-2 sketch FIRST** for the consent page and the connected-apps list. **G-4**. **Routing parity**: the Phase 297 three-layer suite (`frontend/devRouting.ts`, `frontend/vercel.json`, `frontend/nginx.conf` — `nginx.conf` FIRES) covers the consent route and `.well-known`. **G-5**: `backend/app/main.py` (one mount), `backend/app/security/egress.py` (one capability for the client-metadata fetch). **Deployment-artifact parity** for any new env var. **Operator actions**: a real Claude.ai connect, refresh and revoke on cloud; Claude callback hosts on the redirect allowlist. Until this phase ships, the milestone does not claim Claude.ai or Claude Desktop works.

#### Phase 308: Told by Webhook

**Goal**: A member's own systems receive a signed, thin event when a run finishes, a run waits on a person, or a document is ingested: exactly one per endpoint, retried and logged, never sent to an internal address or about an item the owner can no longer see.
**Depends on**: Phase 304 (the liveness predicate and acting-member visibility), Phase 305 (the outbound guard). Runs beside 306 and 307.
**Requirements**: HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, HOOK-06
**Success Criteria** (what must be TRUE):

  1. A member adds an https endpoint, chooses events (run finished, run waiting on a person, document ingested) and sends a test event that arrives and verifies with the `standardwebhooks` library. Rolling the secret leaves both signatures valid during the overlap. Payloads carry ids, status and a link, never document content, and pass through the redaction guard when the org has it on (HOOK-01, HOOK-02).
  2. Every path that finishes a run (in-app, scheduled, API key, MCP, cancelled, failed) and every path that completes a document ingest (upload, watched source, mail, re-ingest) produces exactly one event per subscribed endpoint with two backend workers running, and the `webhook-id` stays the same across retries (HOOK-03).
  3. A failing endpoint is retried with backoff. The member sees a delivery log with status and latency, never the response body, and can resend. An endpoint that keeps failing is disabled and its owner sees an in-app notice (HOOK-04).
  4. A delivery about an item the owner can no longer see at send time is not sent. Endpoints at private, internal, loopback or metadata addresses are refused when saved and again when sent, including through DNS changes and redirects (HOOK-05).
  5. An org admin lists, disables and deletes the org's webhook endpoints (HOOK-06).

**How we'd know this failed**: two workers send the same event twice; an ingest or finalization path emits nothing (document completion has 4+ writers); events are emitted from application code and a path is missed; a trigger error breaks run finalization or ingestion; a delivery bypasses `egress.py`; the log shows a response body; a payload carries document text; signing departs from Standard Webhooks; the secret is stored in plain text; a webhook table is readable by `anon` or another user, or `get_advisors(security)` shows a new ERROR; Redis is treated as the record; a removed member's endpoint keeps receiving events.
**Plans**: 6 plans in 4 waves (D-55: 01 ‖ 02 → 03 ‖ 04 → 05 → 06)

Plans:
- [x] 308-01-PLAN.md — migration 225 (deny-all tables, swallow-and-warn emit triggers, notifications widening, audit CHECK), db/webhooks.py, the notice read path
- [x] 308-02-PLAN.md — egress `webhook` capability + SSRF corpus, URL rules, typed text-free payloads through the guard, signer, sender
- [x] 308-03-PLAN.md — WebhookDrainer + outbox: fan-out with visibility/liveness, retries, auto-disable + notice, purge; emission matrix and two-drainer live proofs
- [x] 308-04-PLAN.md — member + admin routes, test/log/resend, rate limits, main.py wiring, OpenAPI flagging, docs stub
- [ ] 308-05-PLAN.md — Settings → Webhooks tab (cards, form, secret once, log, sheets) and its one mount
- [ ] 308-06-PLAN.md — org-admin Webhooks section, Waiting-on-you row, audit words, standardwebhooks interop (legitimacy checkpoint), bookkeeping + phase gates
**UI hint**: yes
**Flags**: Standard patterns, no research (Phase 300's trigger-fed outbox + per-worker drainer with `SKIP LOCKED`, lease, frozen payload, `next_attempt_at`; Phase 293's audit lockstep; a hand-rolled Standard Webhooks signer with the secret through `secret_cipher`; `standardwebhooks==1.1.0` test-only). **Migration** (webhook subscriptions + deliveries + swallow-and-warn triggers on `workflow_runs` and `documents` status; next free number); every table has RLS; SECURITY DEFINER functions have `EXECUTE` revoked from `PUBLIC`; an **anon-role test**; `get_advisors(security)` after the cloud paste. **security_enforcement** (SSRF refusal corpus at save and at delivery). **G-2 sketch FIRST** for the webhook screen (endpoint, events, test, secret roll, delivery log, resend) and the admin list. **G-4**. **G-5**: `backend/app/security/egress.py` (one closed `webhook` capability: https only, DNS-pinned, redirects refused), `backend/app/main.py` (one lifespan block for the drainer), `frontend/src/pages/SettingsPage.tsx` (one mount). ⚠ `backend/app/services/ingestion_queue_service.py` has **no ledger row** — add it before any plan names it. **Worktree rule 4**: DB-mutating suites serialize against 306/307 work. **Deployment-artifact parity** for any new env var.

#### Phase 309: Close-Out: Docs, Register, Deploy Parity

**Goal**: A person can connect any supported client and verify a webhook from the public docs alone, and every seed and bug this milestone took in, plus the deploy checklist, says what actually shipped.
**Depends on**: Phases 303-308.
**Requirements**: REG-10
**Success Criteria** (what must be TRUE):

  1. The public docs give a quick start for Claude Code, Cursor, VS Code, Claude.ai and Claude Desktop, webhook signature verification snippets, and the plain statement that Claude.ai needs OAuth because personal keys do not reach it. Each quick start is followed once from a clean client and connects (REG-10).
  2. `SEED-013`, `SEED-177`, `SEED-195`, `SEED-081`, `SEED-079` and `BUG-261022-01` read what actually shipped (status and where); items deferred during the milestone are planted as seeds with a structured trigger; `node scripts/check-seeds-register.cjs` is clear (REG-10).
  3. The deploy-parity checklist names every migration from 220 on (cloud paste with per-action approval, `get_advisors(security)` after each), every new env var, the `.well-known` and MCP routes per topology, and the Claude callback hosts, and `scripts/check-deploy-drift.sh` is green (REG-10).

**How we'd know this failed**: a doc tells Claude.ai users to paste a personal key; a quick start describes something never driven; landing or docs figures are typed in rather than derived from code; a seed reads `planted` for work that shipped; a gate is weakened to pass; the close-out adds a capability (that is a phase, not a close-out).
**Plans**: TBD
**Flags**: Runs last. No research. Landing facts (`frontend/src/landing/facts.ts`) data-only if touched. Ledger rows for every hot file the milestone touched are re-derived.

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 303. Word Template Bare Tokens | 0/TBD | Not started | - |
| 304. Personal MCP Keys That Act as You | 6/6 | Complete (self-verified 5/5; G-4 1-3 PASS; deploys WITH 305 — cloud 220/221 + D-41 owed) | 2026-10-31 |
| 305. Connect Claude Code and Cursor | 5/5 | Complete by decision (self-verified 4/5 SC; SC#1 client rows OWED; deploys WITH 304) | 2026-10-31 |
| 306. Ask the Agent and Run Workflows | 5/5 | Complete by decision (self-verified 5/5 SC; 5 live UAT rows OWED — row 5 first; cloud 220→223 owed) | 2026-11-03 |
| 307. Sign In From Claude.ai and Claude Desktop | 5/5 | Complete by decision (self-verified 4/4 SC; 8 human rows OWED — postponed by operator, row 5 first; secure-phase owed; cloud 220→224 owed) | 2026-11-04 |
| 308. Told by Webhook | 0/6 | Planned | - |
| 309. Close-Out: Docs, Register, Deploy Parity | 0/TBD | Not started | - |

---

## v4.8 Every Page Has a Link — SHIPPED 2026-10-30

**6 phases** (297-302), **25 plans**, migrations **217-219**, 4 days, git tag `v4.8`.
**28 / 28 requirements satisfied** (8 LINK · 6 ORG · 6 NOTE · 6 FIX · 2 REG). Audit `tech_debt`, no blockers; integration **21/21** (19 + W-1/W-2 fixed at close, `41198157b`), flows **4/4**. Closed core stays **7 phase types / 1 emitter / 30 tools**.
Full detail: [`milestones/v4.8-ROADMAP.md`](milestones/v4.8-ROADMAP.md) ·
requirements: [`milestones/v4.8-REQUIREMENTS.md`](milestones/v4.8-REQUIREMENTS.md) ·
audit: [`milestones/v4.8-MILESTONE-AUDIT.md`](milestones/v4.8-MILESTONE-AUDIT.md) ·
state at close: [`milestones/v4.8-STATE-at-close.md`](milestones/v4.8-STATE-at-close.md)

Every view has an `/app/...` address (297) · lists follow the active org, items elsewhere counted and movable (298) · links to threads, workflows, runs and Experts, with one "can't be opened" page and a switch prompt (299) · notices written by triggers and one content-free email after a delay (300) · the waiting-on-you list and badge across every org (301) · v4.7 close-out and a true register (302).
⚠ **PARTLY LIVE:** 297-300 live (prod `31416d335`, migrations 217-218 in cloud). **301, 302, the 298 chip fix `5f0eb2660` and the audit fix `41198157b` are NOT deployed**; migration 219 needs its cloud paste (per-action approval) and `get_advisors(security)` first. Owed: 300 G4-8 + real-provider G4-1 (no mail provider; Resend deferred), 299 G4-4b, Moonshot rows (BUG-261024-01).

---

## v4.7 Workflows You Can See and Start Anywhere — SHIPPED 2026-10-27

**12 phases** (286-296, 292.1 inserted), **60 plans** (+3 gap fixes in 295), migrations **210-216**, 10 days, git tag `v4.7`.
**21 / 21 requirements satisfied** (4 START · 3 AUTH · 4 VIS · 1 TRUST · 2 REG · 3 DEC · 4 RUN). Audit `tech_debt`, no blockers; integration **23/23** (14 + 9 added by 296). Closed core stays **7 phase types / 1 emitter / 30 tools**.
Full detail: [`milestones/v4.7-ROADMAP.md`](milestones/v4.7-ROADMAP.md) ·
requirements: [`milestones/v4.7-REQUIREMENTS.md`](milestones/v4.7-REQUIREMENTS.md) ·
audit: [`milestones/v4.7-MILESTONE-AUDIT.md`](milestones/v4.7-MILESTONE-AUDIT.md) ·
state at close: [`milestones/v4.7-STATE-at-close.md`](milestones/v4.7-STATE-at-close.md)

Seams first (286) · start from a thread, fork a starter (287) · drafts survive, pauses publish (288) · the run page and its evidence, confidence (289) · card chips and the team picture (290) · describe it from your own files (291) · diagram / comparison / timeline artifacts (292) · tool-limit Continue always fires (292.1) · API keys, `/inbound`, run origin, per-key limits (293) · rerank and citation check, off in cloud (294) · durable pauses instead of dead ends (295) · the v4.7 debt closed, 133 inventory rows (296).
✅ **LIVE 2026-10-27** (prod `3ec36f998`; 286-292, 294, 295 earlier). Owed (operator): OpenRouter top-up and Moonshot reinstatement for their roster rows; 294-ENV dev `.env` lines.

---

## v4.6 Pay It Down — SHIPPED 2026-10-16

**9 phases** (277-285), **34 plans**, migrations **207-209**, 5 days, git tag `v4.6`.
**24 / 24 requirements satisfied** (14 FIX · 5 DEBT · 3 SEAM · 2 REG). Audit `tech_debt`, no blockers; integration **9/9**. Repair only: closed core stays **7 phase types / 1 emitter / 30 tools**.
Full detail: [`milestones/v4.6-ROADMAP.md`](milestones/v4.6-ROADMAP.md) ·
requirements: [`milestones/v4.6-REQUIREMENTS.md`](milestones/v4.6-REQUIREMENTS.md) ·
audit: [`milestones/v4.6-MILESTONE-AUDIT.md`](milestones/v4.6-MILESTONE-AUDIT.md) ·
state at close: [`milestones/v4.6-STATE-at-close.md`](milestones/v4.6-STATE-at-close.md)

CLAUDE.md back under the warn band (277) · one home for tool handlers and filter vocabulary (278) · the expert-scope seam (279) · same-bytes upload and Graph adapter fixed, purge removes bytes (280) · a refusal names its cause (281) · per-model timeout reaches the provider and one `ask_user` input (282) · members reach their own Settings (283) · Library, Find and pickers page and count on the server, migrations 207 + 208 (284) · failed watch downloads retried, purge deletes only what the watch minted, stuck-pending uploads recover, migration 209 (285).
✅ **280-285 LIVE 2026-10-16** (prod `4e767a3a2`). Owed: Coolify rebuild confirmation + logged-in smoke; 282 G4-4/G4-6/A1; 281 G-4 rows A, C, D.

---

## v4.5 Find It, Show It — SHIPPED 2026-10-12

**7 phases** (270-276), **38 plans**, migrations **199-206**, 14 days, git tag `v4.5`.
**25 / 25 requirements satisfied** (FIND-07 qualified: SC#4 6/8 by decision). Integration **8/8** seams, flows **3/3**. Status `tech_debt` — no blockers.
Full detail: [`milestones/v4.5-ROADMAP.md`](milestones/v4.5-ROADMAP.md) ·
requirements: [`milestones/v4.5-REQUIREMENTS.md`](milestones/v4.5-REQUIREMENTS.md) ·
audit: [`milestones/v4.5-MILESTONE-AUDIT.md`](milestones/v4.5-MILESTONE-AUDIT.md) ·
state at close: [`milestones/v4.5-STATE-at-close.md`](milestones/v4.5-STATE-at-close.md)

Download the original file + file facts (270) · document-first Find beside RAG search, Filing rules in the Library (271) ·
the agent filters retrieval by date and dimension and fails closed on an empty filter (272) · interactive chart / table /
metric artifacts from a closed registry, `show_artifact` the one deliberate tool added (273; closed core 7 / 1 / 30) ·
chat attachments stay in their thread, explicit promote (274) · retention policies, legal hold, audited disposition with
dry run and typed-count confirm, archived out of retrieval but findable (275) · public `/docs`, Syrel API reference,
coverage gate, changelog, videos (276).
✅ **270-274 + 276 LIVE 2026-10-05** (prod `bd9e126c3`, cloud DB at migration 203). ✅ **275 DEPLOYED 2026-10-12** (prod `784647e2d`, migrations 204-206). ~~⛔ 275 NOT DEPLOYED — production
migrations **204 → 205 → 206** before the backend, `get_advisors(security)`, `RETENTION_SWEEP_ENABLED` stays false.~~ Sweep flag stays off.
Owed operator checks: 271 G-4 sign-off · 272 live re-drive of review fixes · 273 STRUCTURED-path drive · 275-UAT.md.

---

## v4.4 Experts That Actually Work — SHIPPED 2026-09-29

**5 phases** (265-269), **24 plans**, migrations **194-198**, 7 days, git tag `v4.4`.
**17 ✅ satisfied of 17 requirements.** Integration **6/6** seams wired. Status `tech_debt` — no blockers.
Full detail: [`milestones/v4.4-ROADMAP.md`](milestones/v4.4-ROADMAP.md) ·
requirements: [`milestones/v4.4-REQUIREMENTS.md`](milestones/v4.4-REQUIREMENTS.md) ·
audit: [`milestones/v4.4-MILESTONE-AUDIT.md`](milestones/v4.4-MILESTONE-AUDIT.md) ·
state at close: [`milestones/v4.4-STATE-at-close.md`](milestones/v4.4-STATE-at-close.md)

Owed v4.3 verification driven live (265) · per-org Expert install that copies and embeds the corpus in
the installing org (266; closes `PACK-05`) · an Expert only ADDS scope and states every cost (267) ·
per-Expert spend + mid-thread folder-scope change (268) · a five-Expert starter library, each with a
live grounded conversation (269). ⭐ **The closed core held** (no commits to phase_types / emitters /
programmatic). ⚠ **Verification mode is `self-verified` for 265-269** (Gemini out). ✅ **Deployed 2026-09-29** (migrations 194-198 + `464ec8354` in production); starter library visible to
enterprise-tier orgs only (D-269-P1, SEED-325). Open follow-ups: SEED-319/322-328.

---

## v4.3 What You Can Actually Sell — SHIPPED 2026-09-23

**10 phases** (255-260 scoped; **261-264 added in-milestone**), **39 plans**, migrations **182-192**,
6 days, git tag `v4.3`.
**31 ✅ satisfied · 1 ⛔ carried forward, of 32 requirements** (PACK-05 → `SEED-304`, by decision).
Integration **6/6** seams wired at re-audit. Status `tech_debt`.
Full detail: [`milestones/v4.3-ROADMAP.md`](milestones/v4.3-ROADMAP.md) ·
requirements: [`milestones/v4.3-REQUIREMENTS.md`](milestones/v4.3-REQUIREMENTS.md) ·
audit: [`milestones/v4.3-MILESTONE-AUDIT.md`](milestones/v4.3-MILESTONE-AUDIT.md) ·
state at close: [`milestones/v4.3-STATE-at-close.md`](milestones/v4.3-STATE-at-close.md) ·
phases: [`milestones/v4.3-phases/`](milestones/v4.3-phases/) (archived 2026-09-23)

The milestone that turned a product that works into one that can be **packaged, priced and
shipped**: a written extension contract with a guard, every token persisted and priced in dollars,
an enforceable tier, and Experts — authored, discovered, scoped and given their own skills — as
DATA over subsystems that already shipped. ⭐ **The closed core held: 7 phase types / 1 emitter /
29 tools at open and at close.** ⚠ The audit's independent verifiers found and closed six real gaps
at close (ungated execution + authoring writes, a 5-site cost formula, role grants that could never
match, no Disable, the folder wall's byte path). ⛔ **Deploy checklist:** migrations 183-192 to
production and a `subscription_tier` on BOTH production orgs **before** the backend ships.

---

## v4.2 The Connected Knowledge You Can Actually Run — SHIPPED 2026-09-18

**8 phases** (247-254 — 251 scoped, **252/253/254 inserted by audit**), **31 plans**, migration
**181**, 6 days, git tag `v4.2`.
**25 ✅ satisfied · 1 ⛔ unsatisfied, of 26 requirements.** Integration **19/19** · flows **3/3**.
Full detail: [`milestones/v4.2-ROADMAP.md`](milestones/v4.2-ROADMAP.md) ·
requirements: [`milestones/v4.2-REQUIREMENTS.md`](milestones/v4.2-REQUIREMENTS.md) ·
audit: [`milestones/v4.2-MILESTONE-AUDIT.md`](milestones/v4.2-MILESTONE-AUDIT.md)
(the superseded 2026-09-16 reading is preserved beside it at
[`v4.2-MILESTONE-AUDIT-260916.md`](milestones/v4.2-MILESTONE-AUDIT-260916.md)) ·
phases: [`milestones/v4.2-phases/`](milestones/v4.2-phases/) (archived 2026-09-23)

The **second consecutive consolidation** milestone, and the one that turned v4.0's capability and
v4.1's deployment into a surface you can **live on**. Every requirement closed something already in a
register, and each was **DRIVEN against the tree at scoping rather than read from a `status:` field**
— a method that immediately caught three wrong register entries, two stale toward *"still broken"*
and one toward *"fine"*.

**What shipped.** A watched source now tells the truth about itself — Drive/Graph paths stored whole
and actually used by classification, a card reporting the health of **the connection it rides** rather
than of its last run, a missing file saying **when** (247). A credential cannot come to rest where it
can be read: migration **181** revokes the default **`PUBLIC`** `EXECUTE` — never just `anon` — on all
13 `SECURITY DEFINER` functions, and a secret pasted into a non-secret field is **refused, not stored**
(248). The model you want to run **registers itself** from the UI with no code edit and no deploy, and
⭐ **13 of the operator's configured models were measured to lose tool calling silently** — the composer
now says so at pick time (249). A run stopped claiming what did not happen (250). And the registers
became an index you can trust: 8 duplicate seed ids resolved, a `TEMPLATE.md` contract written for the
first time, and an **executable** sweep wired at both GSD touchpoints — **297/297 · 0 duplicates** —
replacing a `grep` that was blind to **55%** of its own register (251).

⚠⚠ **THE MILESTONE'S REAL FINDING: five green phase verifications could not see what one cross-phase
read did.** 247-251 all closed with passing verifications, every gate green, the backend at its locked
baseline — and the milestone audit then found **four blockers and nine warnings**, every one of them a
**seam between two individually-correct things**. That is `DEBT-06`'s argument restated from the
outside, and it cost three unplanned phases: **252** closed the four blockers, **253** closed 252's own
code review, **254** was the review phase. ⭐ **The pattern repeated at every depth** — 253's
gap-closure round was itself reviewed and produced two more blockers, both the same vacuity class the
phase existed to kill.

⭐ **A greenfield database now has the same privileges as a migrated one (253).** `pg_dump
--no-privileges` structurally cannot carry a grant, so `supabase/full-schema.sql` had been shipping
every function to a new deployment wide open — migration 181 was **unreachable by a bootstrap**.
`scripts/full-schema-supplement.sql` now mirrors **61 REVOKEs**, gated at **133/133** by
`check-schema-acl-parity.cjs`, **tables included, not just functions**, and the gate was **driven RED**
against a real scratch database before it was trusted: stripping three REVOKEs makes it exit 1.
⚠ Its own first floor was vacuous — it counted migration FILES, not tuples PARSED, so neutering both
regexes printed `mirrored: 0/0 … OK`, exit 0.

⛔ **Open at close — accepted as documented debt, never as a claim the work was done:**

- **`DEBT-06`** is the one unsatisfied requirement: **8 of 14 rows** (239 · 241 · 242 · 244 · 245 ·
  251 · 252 · 253) read neither `independent_review: done` nor a written refusal, re-derived with
  `yaml.safe_load` rather than from a hand-typed list. **No plan can close it** — `done` needs Gemini
  answering `BUS-249`/`BUS-256`/`BUS-257`, `refused` needs an operator ruling (`REG-03`). Three
  refusal drafts are written and pending. ⛔ **A refusal is not a pass:** the accepted risk is that a
  builder read its own work, six closes running.

- **Four one-line register repairs** (`F-1`..`F-4`): `254`'s own verification frontmatter is
  **unparseable YAML** — *the exact defect `254` reported against `244`, the same week, caught by no
  gate* · two duplicate-id clusters in `.planning/reported-bugs/`, a register **no gate sweeps** ·
  `BUG-260915-01` fixed in code but never flipped to `closed` · `253-VERIFICATION.md` still reading
  `gaps_found` over a gap that is closed.

- **Undriven, not passing:** migration **181 is not in cloud** — `CRED-04` discharges at the next
  promotion, and its code half and SQL half must reach cloud in **one operation** · `MODEL-04`
  end-to-end needs a live self-hosted endpoint · 248's G-4 scenario **S2** (live BYO-OAuth) · the
  `schema-acl-parity` CI job.

- **Two live criticals triaged and unfixed** (`251-REVIEW.md` CR-01/CR-02): the seeds gate's own
  self-test has **no RED arm** for its missing-key check, and the `status:` enum's
  change-all-three rule has **zero executable enforcement**.

⚠ **G-8 held where v4.1's close predicted it would not.** The scoped five phases ran 4 · 4 · 4 · 3 · 4
plans — inside the 3-5 target every time. The overrun was **three extra PHASES found by audit**, not
plan inflation inside one, which is the failure mode the governor was written against.

---

## v4.1 Ship It & Feel It — SHIPPED 2026-09-13

**5 phases** (242-246, no inserts), **25 plans**, migrations **177-180**, 3 days, git tag `v4.1`.
**18 ✅ delivered · 1 ⛔ unmet BY MEASUREMENT, of 19 requirements.**
Full detail: [`milestones/v4.1-ROADMAP.md`](milestones/v4.1-ROADMAP.md) ·
requirements: [`milestones/v4.1-REQUIREMENTS.md`](milestones/v4.1-REQUIREMENTS.md) ·
audit: [`milestones/v4.1-MILESTONE-AUDIT.md`](milestones/v4.1-MILESTONE-AUDIT.md) ·
phases: [`milestones/v4.1-phases/`](milestones/v4.1-phases/)

A deliberate **consolidation** milestone — no new capability axis; every requirement closed something
already sitting in a register. **The ship claims stopped being claims**: all four `SHIP` items closed
against the database and the branch rather than the deploy record (20/20 migration checks measured in
cloud; `SHIP-04` confirmed already landed; `SHIP-02` **retired in writing** because the shape its
drive needed exists nowhere). **The chat surface stopped getting in the way**: one unconditional
thinking renderer, a 60 ms coalescer, and a follow-scroll finally driven with a **real wheel** —
0 px drift, 0 app scrolls, closing `BUG-260823-01` after two prior fixes that had passed on synthetic
events. All five `SHELL` criteria were **driven in a browser**, `SHELL-03` only on the second attempt
after being driven FALSE. **v4.0's verification debt got verdicts**: rows discharged or retired in
writing, and a greppable `verification_mode` marker shipped **with zero prose deleted**, so a
self-verification can no longer read as a review.

⭐ **The milestone's best work is a requirement it did NOT deliver.** Phase 246 set out to fix the
small-tenant recall cliff by raising `hnsw_ef_search` to 200 and proved by `EXPLAIN (ANALYZE)` that
**no value fixes it through the index**: 40/60/80 walk the index and return **ONE row** (~0.05 recall,
~4 ms); 100/150/200 reach recall 1.000 by **sequential scan** (~1,100 ms). Shipping 200 would have
cost **every** tenant ~1.1 s a query to cure a cliff only small tenants have. Default reverted to 40;
`RECALL-01` left open with `SEED-273` (`hnsw.iterative_scan`) as the remaining path. ⚠ Phase 241's
contrary conclusion **never inspected an execution plan**.

⭐ **Two-agent separation returned.** 246 is the **first phase since `OV-SOLO-01` was re-armed** to
carry `verification_mode: peer-reviewed` (gemini built, claude reviewed at three gates); the one
commit inside it authored by the reviewer is **named** self-verified rather than folded into the
headline — and the close audit then found `INT-01` inside exactly that commit.

⛔ **Open at close:** `RECALL-01` (above) · migrations **179 and 180 are NOT in cloud** (measured) ·
`origin/production` **287 commits behind `develop`**, so v4.1's own output is undeployed — the state
v4.1 was opened to end for v4.0 · 245's four named residues, including the independent §6.3 review
still owed by 238 / 240 / 241 · `SEED-172`, whose trigger **fired at this close** (local models still
cannot be registered, timed out or given a context window through the UI) · `SEED-272`.

⚠⚠ **THE CLOSE'S OWN FINDING, recorded because it recurred one milestone after being corrected:**
the Progress table in this file read **`0 / 5 phases complete · 0 / 19 requirements delivered`** with
all five phases closed and fourteen boxes ticked — and that is the register the close reads to build
the archive. Drift ran in **both** directions: `SHIP-02/03/04` unchecked while their traceability rows
carried full closing evidence; `SHELL-04/05` and `RECALL-02` ticked while their rows read *"Pending"*.
**A coverage check run against the wrong denominator is how a requirement survives a milestone
unnoticed** — v4.0 shipped with that defect in the requirement COUNT, v4.1 nearly shipped with it in
the phase STATUS. Re-derive from the phase directories, never from a summary line.

## v4.0 Connected Knowledge — SHIPPED 2026-09-10

**14 phases** (228-241, no inserts), **62 plans**, migrations **153-156 / 166-176** (15 files; **157-165 unused**, 171 reserved), 6 days, git tag `v4.0`.
**33 ✅ delivered · 5 ⛔ not ticked, of 38 requirements.**
Full detail: [`milestones/v4.0-ROADMAP.md`](milestones/v4.0-ROADMAP.md) ·
requirements: [`milestones/v4.0-REQUIREMENTS.md`](milestones/v4.0-REQUIREMENTS.md) ·
audit: [`milestones/v4.0-MILESTONE-AUDIT.md`](milestones/v4.0-MILESTONE-AUDIT.md) ·
state at close: [`milestones/v4.0-STATE-at-close.md`](milestones/v4.0-STATE-at-close.md) ·
phases: `milestones/v4.0-phases/`

⭐ **The premise came true: a source is connected once and then read by itself.** Four families —
Google Drive, OneDrive/SharePoint via Microsoft Graph, **any** MCP file server, and mail — sit on
ONE `browse / list / read / check` contract. The contract was then *tested* rather than asserted:
**239 bound GitHub MCP as a second file server entirely through the UI, proven zero-code by HASH**
(HEAD identical before and after), and **240 proved mail is a SHAPE, not a fourth adapter** —
`sources/base.py` byte-identical, no registry key, delegation `+35/-0`.

⭐ **Connection-scoped visibility is enforced in RLS at all four sites**, provenance rides every row
from the first write, a disconnect **freezes** rather than deletes, and a `missing` verdict may be
written only from a listing whose final page asserted completeness (`H-5`) — so an incomplete
listing can never delete a customer's documents.

⭐ **The anti-injection discipline was ACTUALLY ATTACKED, and it held.** 13/13 taxonomy attacks
refused offline, **8/8 mutations caught loudly at the point of use**, and the live drive planted the
payload in a really-synced Drive document: **all 8 native-roster providers refused it with zero
write-tool invocations**, three surfacing the injection to the user unprompted.

⚠ **THE MILESTONE'S SHARPEST FINDING IS A DEFECT IT FOUND IN ITSELF.** Phase 241 measured filtered
vector recall at customer scale and it was **REAL**: at the shipped `hnsw.ef_search = 40`, a tenant
owning 0.2% of a 100,000-chunk corpus scores `recall@20` **0.040**, and three named documents
silently stop being found. `ef_search = 200` restores **1.000**. ⛔ **The knobs ship as operator
settings but the DEFAULT is unchanged, so `QUEUE-06` is NOT ticked** — out of the box the
requirement is still not met. ⚠ The degradation is a **cliff, not a slope** (the "control" rows ran
on a SEQ SCAN), so an install can cross it with **no deploy and no setting change**.

⚠ **THE PREMISE OF PHASE 241 WAS REFUTED BEFORE IT STARTED, AND THAT IS THE LESSON.** There was no
Phase 230 baseline: `scripts/measure-recall.py` ran `content ILIKE`, never touched the vector path,
scored every miss `rank = 1` and printed **`MRR 1.000`** on the live corpus. **A harness that cannot
report a failure had been reporting success.**

⛔ **THREE PHASES CLOSED WITHOUT AN INDEPENDENT §6.3 REVIEW — 238, 240, 241.** Gemini has been
unavailable since 2026-09-09 and `/code-review ultra` is ruled out on cost, so their verdicts are
the builder's own. **A self-verification is not a review, and this milestone contains three.**

⛔ **TWO UAT SETS ARE OWED AND CREDENTIAL-BLOCKED, not skipped** — 238's nine live rows need one
Azure app registration; 241's row 5 needs a read-capable cloud DSN. ⚠⚠ **241's row 5 has a
DEADLINE: it dies the moment migration 176 reaches cloud.** ⛔ **Cloud is 15 migrations behind**
(`153-156`, `166-176`); v4.0 has not deployed.

⚠ **CORRECTED 2026-09-13 (Phase 245) — the paragraph above is preserved, not deleted, because the
rot being visible IS the finding.** The "238's nine live rows need one Azure app registration" half
is **FALSE, and was false when written.** All nine of 238's M rows were **DRIVEN LIVE on 2026-09-07** (`238-VERIFICATION.md:213-231` — 7 full pass, 2 half at the time; **four defects found by driving and NONE by the 15-case unit suite**). The operator completed the Azure registration *hours after* `238-SUMMARY.md` was written. **The blocker was
discharged six days before six live registers stopped saying so.** ⛔ 241's row 5 half **remains
true** — it still needs a read-capable cloud DSN, and it still dies when migration 176 reaches cloud.

⭐ **The method failure worth carrying forward, committed three times in one hour by the audit
written to catch it:** a file listing is not a review; a review is a claim ABOUT code; a summary is a
claim about a moment. **Each register only knows the one below it, and the code is the bottom.**
Two Phase-239 CRITICALs were escalated as live and open when they had been fixed two days earlier,
in an ancestor of the auditing commit. **Drive it, or do not report it.**

---

## v3.9 Connections: Any Service, Any Tool — SHIPPED 2026-09-04

**16 phases** (210-217 CORE + inserts 214.1 / 217.1 + 220-227; 218 ABSORBED into 217.1; **219
DEFERRED**), **111 plans**, migrations **127-129 / 140-141 / 150-152**, 9 days, git tag `v3.9`.
**34 ✅ delivered · 3 ⚠ partial · 2 ⛔ never-driven, of 39 requirements.**
Full detail: [`milestones/v3.9-ROADMAP.md`](milestones/v3.9-ROADMAP.md) ·
requirements: [`milestones/v3.9-REQUIREMENTS.md`](milestones/v3.9-REQUIREMENTS.md) ·
audit: [`milestones/v3.9-MILESTONE-AUDIT.md`](milestones/v3.9-MILESTONE-AUDIT.md) ·
phases: `milestones/v3.9-phases/`

⭐ **The one sentence it was measured against came true.** A person connects a **service** — not a
protocol — sees every tool it offers, grants each one individually, and uses it by name in chat and
as a specific step on the canvas. **Nothing is per-vendor:** Notion connects by OAuth with no
developer console and returns 41 tools for zero lines of tool code; six Google applications sit
under one token with 11/11 live writes.

⚠ **Phase 219 (`A Connected Source Feeds the Library`) is DEFERRED, not dropped** — operator
decision 2026-09-04, carried into the **Connected Knowledge** milestone with `LIB-08/09/10` and
`SEED-209/210/211/212`. Its SC#1 (*"watched on a schedule"*) is word for word v3.9's own binding
re-open trigger for those four security seeds, whose scope text reads: shipping auto-ingest without
them *"is not a gap, it is a security defect."* **The trigger did not fire — it was kept from firing
by moving the feature.**

⚠ **Two phases shipped with their headline feature ABSENT at HEAD while every gate was green** —
213 (the approval moment: Gate 5.5 fell through on `ask`, so the whole ask/refusal vocabulary was
consumed by nothing) and 216 (the chat wiring dead inside an `except` arm, invisible to 6,929 green
tests). Both found by driving, neither by a suite.

## v3.8 Document Intelligence, Automations & Connectors — SHIPPED 2026-08-26

**12 phases** (201-206 CORE + inserts 204.1 / 206.1 / 206.2 / 206.3 + guardrail debt 207 / 208 + 209),
17 plans, migrations 124-126, 3 days. **11/11 requirements delivered.**
Full detail: [`milestones/v3.8-ROADMAP.md`](milestones/v3.8-ROADMAP.md) ·
requirements: [`milestones/v3.8-REQUIREMENTS.md`](milestones/v3.8-REQUIREMENTS.md) ·
audit: [`milestones/v3.8-MILESTONE-AUDIT.md`](milestones/v3.8-MILESTONE-AUDIT.md) ·
phases: `milestones/v3.8-phases/`

⚠ **Closed `gaps_closed_partial`, not `passed`.** The audit found a **blocker** (a shipped Check
button that 500'd on MCP rows — fixed) and **three requirements narrower than their wording**:
`{{prior_run.*}}` never reaches `llm_emit` (the only path producing a typed deliverable), email
thread dedup is parsed and stored but read by nothing, and TAB-02 covers new ingests only. All
carried forward with re-open triggers rather than closed silently.

⚠ **Seven of twelve phases had no `VERIFICATION.md`** and `REQUIREMENTS.md` had been stale since
day one of the milestone. Both repaired at the audit; both are the SECOND consecutive milestone to
close this way.

## Prior Milestone Archive: v3.7 Workflow Product Completion — SHIPPED 2026-08-24

17 phases, 145 plans, migrations 119-123, git tag `v3.7`. 20/20 requirements satisfied.
Full detail: [`milestones/v3.7-ROADMAP.md`](milestones/v3.7-ROADMAP.md) ·
audit: [`milestones/v3.7-MILESTONE-AUDIT.md`](milestones/v3.7-MILESTONE-AUDIT.md)

⚠ **Collapsed at v3.8's close, not at its own** — this section carried 1,305 lines that were
already byte-for-byte in `milestones/v3.8-ROADMAP.md`'s sibling archive. The duplicate is exactly
the context cost the archive step exists to prevent, and it survived one whole milestone.

## v3.5 UX Consolidation & Chat Polish — ✅ SHIPPED 2026-07-23 (CORE); STRETCH deferred

**Started:** 2026-07-22 (operator-confirmed UX-track sequencing at v3.4-close: the polish cluster now, Visual Workflow Studio next as v3.6). **Roadmap created:** 2026-07-22. **Shipped:** 2026-07-23 (git tag `v3.5`; CORE 174-177; STRETCH 178-180 deferred → `.planning/v3.5-STRETCH-CARRYFORWARD.md`). Full detail archived → `.planning/milestones/v3.5-ROADMAP.md`.

**Goal:** Clear the parked `surface: Agentic-RAG` chat-surface bug backlog and consolidate the accumulated UI/UX rough edges — including the brand-new v3.4 org surfaces — into one coherent, polished, honest experience, before the large v3.6 Visual Workflow Studio build. A **Medium cleanup milestone**: mostly bug-fix + polish, no large net-new build; deliberately kept **separate** from v3.6.

**Red line (every phase):** never fork the shared Deep/agent-loop/provider path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

**Numbering:** CORE **Phases 174-177**, STRETCH **Phases 178-180**. **Phases 169-173 are RESERVED** for the deferred v3.4 STRETCH carry-forwards (Dept-Admin, Entitlements, Permission-Aware Citations, OIDC SSO, Dept-Skills — `.planning/v3.4-STRETCH-CARRYFORWARD.md`) and are NOT reused here. Migrations: this is a cleanup milestone — prefer app-layer fixes; the head at v3.5's close was **113**, **next free slot = 114 reserved ONLY if a specific bug fix genuinely needs schema** (none expected). ⚠ *HISTORICAL — accurate when v3.5 shipped 2026-07-23. The live head is **115** as of 2026-08-07; see the v3.6 migrations bullet.*

**Scope source:** `.planning/REQUIREMENTS.md` (14 CORE + 9 STRETCH = 23 reqs). **Reported-bugs mandate:** this milestone IS the home of the parked backlog — at every `/gsd:discuss-phase`, re-list open/deferred `surface: Agentic-RAG` reports and fold the matching ones explicitly (some "open" reports may already be fixed-pending-verification — triage fix-vs-verify).

### Phase Table (CORE — Phases 174-177)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 174 | Run-State & Lifecycle Honesty | Every run's lifecycle (setup → stream → stop/cancel/kill → navigation) is honestly reflected — no empty bubbles, no lost stop indicators, no hidden setup activity, no timer/avatar glitches | STATE-01, STATE-02, STATE-03, STATE-04 | 5 | **SC#10**; **G-2 sketch** (honest run-state "feels like"); **G-5** (`MessageItem.tsx`/`StreamsProvider.tsx`/`useMessages.ts`/`threads.py`); reported-bugs fold (5); UI hint; no threat model; no migration |
| 175 | Cross-Provider Streaming Fidelity | Newer reasoning models + non-OpenAI providers stream cleanly — correct params (no 400s), no tool-markup leak, honest title-gen fallback — all at the adapter/sanitizer boundary | XPROV-01, XPROV-02, XPROV-03 | 4 | **SC#10**; **G-5** (gateway/adapter/sanitizer boundary); **red line D-14**; reported-bugs fold (4); OpenRouter-400s OUT; no threat model; no migration |
| 176 | Chat Render Correctness + Exec Reliability | The transcript renders each message once, un-folded at a clean terminal, with honest send outcomes + live version-pointer updates; `execute_code` installs requested libraries reliably | RENDER-01, RENDER-02, RENDER-03, RENDER-04, EXEC-01 | 5 | **SC#10**; **G-2 sketch** (render visual); **G-5** (`MessageItem.tsx`/`useMessages.ts`/`StreamsProvider.tsx`; EXEC → `sandbox_service.py`/`tool_dispatcher.py`); reported-bugs fold (4 + 2 minor); UI hint; no threat model; migration only if RENDER-04 truly needs (unlikely) |
| 177 | v3.4 Org-Surface Polish | The new v3.4 org surfaces (admin shell, switcher, profile anchor, invitations, SSO sign-in) are polished + error-honest across every state — without widening the already-secured 166-168 authz | ORGUX-01, ORGUX-02 | 3 | **G-2 sketch** (org-surface "feels like"); **G-5 light** (`StreamsProvider.tsx` — keep `<OrgContext>` OUTSIDE the stream path, 067.5 Branch-D3 guard); rolls in 166/167/168 live-UAT status-lag; UI hint; **no SC#10**; **no threat model** (polish over secured surfaces, not new authz); no migration |

### Phase Table (STRETCH — gated behind CORE — Phases 178-180)

Committed as gated phases (ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 / v3.3 156-159 / v3.4 169-173 precedent).

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 178 | Chat UI/UX Polish Pass (SEED-045 umbrella) | Sweep the collected chat/nav polish seeds into one coherent pass — SEED-045 remainder, provider-logo/nav consistency, a legible cited-vs-retrieved citation footer, run-state-aware todos, workspace-panel reliability | POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05 | 4 | — (SEED-045 anchors shipped in 156); **SC#10** (run-state todos + workspace panel + provider logos touch live state); **G-2 sketch**; **G-5** (`ToolCallPanel.tsx`/`MessageItem.tsx`/workspace panel/`useMessages.ts`/`providerLogo.tsx`); SEED-098 = verify/close only; UI hint |
| 179 | Plain-Language / Terminology Extensions | Extend the shipped v3.3 plain-language layer (`termMap`) onto the new org + chat surfaces so jargon doesn't creep back in | LANG-01 | 2 | — (extends Phase-154; best after 177 so org labels exist); label layer — **no SC#10, no G-2, no G-5**; red line (no enum/API/audit break, Deep byte-identical); UI hint |
| 180 | Agent-Loop Behavior Honesty | The agent honors explicit step-by-step / todo-loop requests, Anthropic's end-of-cycle output shows a user-facing summary (not a raw action list), and excessive tool iterations are bounded + honest | LOOP-01, LOOP-02, LOOP-03 | 4 | — (touches the agent loop — most careful STRETCH); **SC#10**; **G-5** (`agent_loop.py`/`anthropic_service.py` — both hot-file rows); **red line D-14**; reported-bugs fold (3 deferred majors + BUG-260626-02/-03); may warrant careful decomposition |

### Phase Checklist

- [x] **Phase 174: Run-State & Lifecycle Honesty** — no empty/orphaned cancel-kill bubbles, stop indicator survives nav+reload, "setting up agent" shows live activity, workflow-run timers/avatars stay accurate on nav (STATE-01..04) — COMPLETE 2026-07-22 (5/5 reqs; live UAT passed; STATE-01b resolved via Run-window surface)
- [ ] **Phase 175: Cross-Provider Streaming Fidelity** — gpt-5.6-class correct params (no 400), DeepSeek tool-markup strip holds on long turns, honest title-gen fallback (XPROV-01..03)
- [x] **Phase 176: Chat Render Correctness + Exec Reliability** — one user bubble, un-folded final answer, no silent send-drop, live version-pointer, reliable `execute_code` library install (RENDER-01..04, EXEC-01) — COMPLETE 2026-07-23 (4/4 plans; verify 5/5 must-haves; code-review CR-01/WR-01/WR-02 fixed; SC#10 live UAT rolling forward)
- [ ] **Phase 177: v3.4 Org-Surface Polish** — org-admin shell / switcher / profile anchor + invitations/SSO surfaces polished + error-honest across states (ORGUX-01, ORGUX-02)
- [ ] **Phase 178 (STRETCH): Chat UI/UX Polish Pass** — SEED-045 remainder + provider logos + citation-footer superset + run-state-aware todos + workspace-panel polish (POLISH-01..05)
- [ ] **Phase 179 (STRETCH): Plain-Language / Terminology Extensions** — extend the `termMap` reveal onto the new org + chat surfaces (LANG-01)
- [ ] **Phase 180 (STRETCH): Agent-Loop Behavior Honesty** — honor step-by-step/todo-loop, Anthropic user-facing end summary, bounded tool iterations (LOOP-01..03)

### Phase Details

#### Phase 174: Run-State & Lifecycle Honesty

**Goal**: Every run's lifecycle — setting up, streaming, stopping, cancelling, being killed, and navigating away-and-back — is honestly reflected in the chat surface, so a user is never left staring at an empty bubble, a lost stop indicator, a hidden model, or a glitched timer/avatar.
**Depends on**: Nothing (first phase — stabilizes the run-lifecycle surface the later chat phases render on).
**Requirements**: STATE-01, STATE-02, STATE-03, STATE-04
**Success Criteria** (what must be TRUE):

  1. A cancelled or killed run leaves no empty chat bubble and no orphaned run card — the surface honestly shows "cancelled — no output yet" (STATE-01).
  2. The "Response stopped" / stop indicator survives navigating away-and-back AND a full page reload (STATE-02) — read from the authoritative `runs.status` (FND-01/145), no new persistence needed.
  3. During "Setting up agent…", the user sees live model activity instead of a state that hides the model working (STATE-03).
  4. Run timers stay accurate when navigating to a workflow run — no timer reset, no duplicate avatar (STATE-04).
  5. All four hold across providers, multi-tool prompts, parallel threads, and long histories with Deep Mode byte-identical (SC#10).

**Plans**: 4 plans (3 waves)

- [x] 174-01-PLAN.md — STATE-03 pre-answer reasoning honesty (`outerBannerLabel` reasoningActive → "Reasoning…") [Wave 1]
- [x] 174-02-PLAN.md — STATE-01a + STATE-02 verify-and-close (cancelled-no-output + stop-indicator reload-derive) [Wave 1]
- [x] 174-03-PLAN.md — STATE-01b killed-workflow amber block (403 catch branch + composer unlock) [Wave 2]
- [x] 174-04-PLAN.md — STATE-04 workflow-run timer anchor + single avatar (startedAt stamp + pre-runId dedup) [Wave 3]

**UI hint**: yes
**Flags**: SC#10; G-2 sketch (honest run-state "feels like"); G-5 (`MessageItem.tsx`, `StreamsProvider.tsx`, `useMessages.ts`, `threads.py` run-lifecycle — audit at discuss); reported-bugs fold (`cancelled-run-empty-bubble-early-cancel`, `killed-workflow-empty-chat-card`, `cancelled-run-stop-indicator-lost-on-navigation`, `setting-up-agent-hides-model-activity`, `BUG-260610-01`); no threat model; no migration.

#### Phase 175: Cross-Provider Streaming Fidelity

**Goal**: Newer reasoning models and non-OpenAI providers stream cleanly — correct request params (no 400s), no tool-call markup leaking into visible content, and honest title-generation fallback — all handled at the gateway/adapter/sanitizer boundary with the shared path unforked.
**Depends on**: Phase 174 (lands after run-state honesty so the cross-provider streaming blast radius is clean).
**Requirements**: XPROV-01, XPROV-02, XPROV-03
**Success Criteria** (what must be TRUE):

  1. Newer reasoning models (gpt-5.6 class) send correct request params — no model-parameter 400 on chat or with tools (XPROV-01).
  2. DeepSeek tool-call markup never leaks into visible chat content; the re-parse/strip guard holds on long turns (XPROV-02).
  3. Title-generation cross-provider fallback is honest — no misleading fallback banner when a provider actually succeeds (XPROV-03).
  4. All three hold across the native providers with Deep Mode byte-identical — provider handling stays at the adapter/sanitizer boundary, no shared-path fork (SC#10 / D-14).

**Plans**: 4 plans (2 waves) — XPROV-04 (BUG-260722-01) folded in per D-05.

- [x] 175-01-PLAN.md — Foundation: capability markers (reasoning_first + reasoning_off SAFE list) + shared provider-safe utility-model guard (XPROV-01/03/04 substrate) [Wave 1]
- [x] 175-02-PLAN.md — XPROV-02: DSML strip stream-end flush + honest-incomplete leak signal (Option-B post-drain, existing `error` event) [Wave 1]
- [x] 175-03-PLAN.md — XPROV-01: reasoning_first STRUCTURED gate in resolve_calling_mode + honest reasoning-tools-unsupported error copy [Wave 2]
- [x] 175-04-PLAN.md — XPROV-03/04: provider-safe guard at title-gen + suggestion + per-MODEL reasoning-off title call [Wave 2]

**Flags**: SC#10; G-5 (gateway/adapter/sanitizer boundary — `openai_compat.py` DeepSeek strip, the `openai_service` param builder, `thread_title.py`; audit at discuss); red line D-14 (adapter boundary only); reported-bugs fold (`BUG-260714-01`, `BUG-260711-02` [deferred — triage fix-vs-verify], `BUG-260708-01`, `BUG-260623-01`, `BUG-260722-01` → XPROV-04); OpenRouter-specific 400s stay OUT (experimental — fix only if native-safe + low-complexity); no threat model; no migration.

#### Phase 176: Chat Render Correctness + Exec Reliability

**Goal**: The chat transcript renders each message exactly once, un-folded at a clean terminal, with honest send outcomes and live version-pointer updates — and the `execute_code` tool installs requested libraries reliably instead of silently no-op'ing.
**Depends on**: Phase 174 (shares the chat-render/streaming surface the run-state phase stabilizes).
**Requirements**: RENDER-01, RENDER-02, RENDER-03, RENDER-04, EXEC-01
**Success Criteria** (what must be TRUE):

  1. No duplicate user bubble — the optimistic temp row and the persisted row reconcile to exactly one (RENDER-01).
  2. The final answer renders un-folded at a clean terminal — no reload required to lift it out of the narration fold (RENDER-02).
  3. A submitted general-chat message always sends or surfaces an honest failure — no intermittent silent send-drop (RENDER-03).
  4. An approved skill/description version pointer updates in the UI without a reload (RENDER-04).
  5. The `execute_code` `libraries` parameter installs the requested packages reliably — no silent no-op, no wasted retry rounds (EXEC-01).

**Plans**: 4 plans (2 waves) — created 2026-07-22

- [x] 176-01-PLAN.md — RENDER-01 + RENDER-02: StreamsProvider reconcile correctness (user-bubble content-supersede drop + mount-path onTerminal un-fold by run.run_id) [Wave 1]
- [x] 176-02-PLAN.md — RENDER-04: Skill-Studio live version pointer (refreshVersions mirror of refreshGate + VersionsTab refreshNonce) [Wave 1]
- [x] 176-03-PLAN.md — EXEC-01: reliable execute_code install (python -m pip same-interpreter, retry x1) + bounded ModuleNotFound auto-heal + honest tool result [Wave 1]
- [x] 176-04-PLAN.md — RENDER-03: honest send-drop (non-dispatch → failedSendDrafts/reconcileErrors seam) + fresh-thread pending-send ordering [Wave 2, depends 176-01]

**UI hint**: yes
**Flags**: SC#10 (chat UI state + agent loop); G-2 sketch (render visual — D-13: NO fresh sketch, sketch 014 + StreamingNarration are the anchor); G-5 (`StreamsProvider.tsx` render-layer only — additive reconcile at existing seams, no refactor-first; EXEC-01 → `tool_dispatcher.py` only, sandbox_service unchanged); reported-bugs fold (`BUG-260712-02`, `BUG-260707-03`, `general-chat-intermittent-silent-send-drop`, `BUG-260706-01`, `BUG-260708-02`; minor `BUG-260609-02`/`-04` deferred → Phase 178); honest threat model (no new trust boundary — all `accept`); no migration (D-16 — all app-layer).

#### Phase 177: v3.4 Org-Surface Polish

**Goal**: The brand-new v3.4 org surfaces — org-admin shell, org switcher, profile-menu identity anchor, invitations, and SSO sign-in — are polished and error-honest across every state (member vs org-admin, 1-org vs multi-org, success vs failure), while the polish keeps the already-secured 166–168 authz intact.
**Depends on**: Nothing hard (an independent org surface); sequenced after Phase 174 so the shared nav/profile shell is stable first.
**Requirements**: ORGUX-01, ORGUX-02
**Success Criteria** (what must be TRUE):

  1. The org-admin shell, org switcher, and profile-menu identity anchor read correctly and honestly across states — member vs org-admin, single-org vs multi-org (ORGUX-01).
  2. The invitations and SSO surfaces (invite dialog, invitations tab, `/invite` landing, SSO tab, identifier-first sign-in) are polished and surface honest errors instead of dead-ends (ORGUX-02).
  3. The polish preserves the already-secured 166–168 authz — no widening of org-admin capability, no cross-org leak, no new trust boundary.

**Plans**: 5 plans (2 waves) — created 2026-07-23

- [x] 177-01-PLAN.md — Wave 0: extract the 3 shared org-zone primitives — `StatusChip` (D-08) · `RoleBadge`/`OrgIdentity` (D-04) · `HonestNotice` (D-11) + co-located tests [Wave 1]
- [x] 177-02-PLAN.md — Identity cohesion: OrgBand + ProfileMenu → shared RoleBadge; per-org-role / honest-absent / indigo-vs-amber-zone audit-and-lock (ORGUX-01, D-04/05/06/07) [Wave 2]
- [x] 177-03-PLAN.md — Management chips: InvitationsTab + SsoTab → shared StatusChip, RETIRE the UPPERCASE off-grid fork + snap to the 4px grid; link-first + victim-naming preserved (ORGUX-02, D-08/09/10) [Wave 2]
- [x] 177-04-PLAN.md — Roster + invite dialog: OrgMembersTab + InviteMemberDialog → shared RoleBadge/StatusChip/OrgAvatar + 4px grid; roster stays a pure read leaf (ORGUX-01/02, D-04/08/09/10) [Wave 2]
- [x] 177-05-PLAN.md — Entry/failure honesty: one AuthCardShell + HonestNotice across SignInForm + AcceptInvitePage; recoverable dead-ends → calm; legible fail-open note (ORGUX-02, D-11/12/13/14) [Wave 2]

**UI hint**: yes
**Flags**: G-2 sketch (org-surface polish — "feels like"); G-5 light (`StreamsProvider.tsx` — keep `<OrgContext>` OUTSIDE the stream path, preserve the 067.5 Branch-D3 clear guard); rolls in the 166/167/168 live-UAT status-lag (cross-provider SC#10 + SSO round-trip); no SC#10 (not streamed state); no threat model (polish over already-secured surfaces, not new authz); no migration. Fold the LANG-01 relabel here if Phase 179 hasn't run yet.

#### Phase 178: Chat UI/UX Polish Pass (SEED-045 umbrella) — STRETCH

**Goal**: Sweep the collected chat/nav polish seeds into one coherent pass — the SEED-045 remainder, provider-logo/nav-presence consistency, a legibly-superset citation footer, run-state-aware todos, and workspace-panel reliability — so the accumulated minor rough edges land as one polished surface rather than scattered inserts.
**Depends on**: — (gated behind CORE completion; the SEED-045 rail/chat-list anchors already shipped in Phase 156, so this is the remainder).
**Requirements**: POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05
**Success Criteria** (what must be TRUE):

  1. The SEED-045 remainder minor-enhancement items land as one coherent polish pass (POLISH-01).
  2. Provider logos / nav-presence are consistent across the chat surface (POLISH-02 / SEED-058).
  3. The citation footer legibly reads as a superset of the inline `[n]` markers — cited-vs-retrieved is clear (POLISH-03 / SEED-119).
  4. The todos panel reflects the live run's state honestly (POLISH-04 / SEED-105) and the workspace panel is reliable + polished across run states (POLISH-05 / SEED-039).

**Plans**: TBD
**UI hint**: yes
**Flags**: SC#10 (run-state-aware todos + workspace panel + provider logos touch live-run / provider state); G-2 sketch (visual polish); G-5 (`ToolCallPanel.tsx`, `MessageItem.tsx`, the workspace panel, `useMessages.ts`, `providerLogo.tsx` — audit at discuss). **SEED-098 (tool-card dedup) = verify/close only** — already largely shipped via quick-task 260630-226; NOT a fresh build. No threat model; no migration.

#### Phase 179: Plain-Language / Terminology Extensions — STRETCH

**Goal**: Extend the shipped v3.3 plain-language layer (LANG-01 / `termMap`) onto the new v3.4 org surfaces and chat surfaces so jargon doesn't creep back in — purely a label layer behind the existing advanced reveal.
**Depends on**: — (gated behind CORE completion; extends the shipped Phase-154 plain-language reveal; best sequenced after Phase 177 so the org-surface labels exist to relabel).
**Requirements**: LANG-01
**Success Criteria** (what must be TRUE):

  1. The v3.3 plain-language reveal covers the new org + chat surfaces — jargon terms map to plain language behind the existing advanced reveal (LANG-01 / SEED-085).
  2. The relabel is additive — no enum/API/audit break, Deep Mode byte-identical (Phase-154 Pitfall-15 precedent).

**Plans**: TBD
**UI hint**: yes
**Flags**: no SC#10 (label layer); no G-2 (label pass, not net-new visual — Phase-154 precedent); no G-5 (additive term map); red line (no shared-path / enum break); no threat model; no migration.

#### Phase 180: Agent-Loop Behavior Honesty — STRETCH

**Goal**: The agent honors an explicit step-by-step / todo-loop request instead of collapsing it into one turn, Anthropic's end-of-cycle output shows a user-facing summary (not a raw action list), and excessive tool iterations on multi-step tasks are bounded and honest — all at the agent-loop / adapter boundary with Deep Mode byte-identical.
**Depends on**: — (gated behind CORE completion; touches the agent loop, so it is the most careful STRETCH — sequence after CORE lands clean).
**Requirements**: LOOP-01, LOOP-02, LOOP-03
**Success Criteria** (what must be TRUE):

  1. The agent honors an explicit step-by-step / todo-loop request instead of collapsing it into one turn (LOOP-01).
  2. Anthropic's end-of-cycle output shows a user-facing summary, not a raw action list (LOOP-02).
  3. Excessive tool iterations on multi-step tasks are reduced — bounded and honest — without regressing legitimate multi-step work (LOOP-03).
  4. All three hold across providers with Deep Mode byte-identical — provider-specific behavior stays at the adapter boundary, no shared-path fork (SC#10 / D-14).

**Plans**: TBD
**Flags**: SC#10; G-5 (`agent_loop.py` + `anthropic_service.py` — both on the hot-file ledger; audit at discuss); red line D-14; reported-bugs fold (`agent-ignores-step-by-step-request-no-todo-loop`, `anthropic-end-of-cycle-shows-actions-not-summary`, `anthropic-excessive-tool-iterations-on-multi-step-tasks`; related deferred `BUG-260626-02` baseline-leak-into-final-emit, `BUG-260626-03` run-end todo finalizer); may warrant its own careful decomposition at discuss-phase.

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 174. Run-State & Lifecycle Honesty | 0/? | Not started | - |
| 175. Cross-Provider Streaming Fidelity | 4/4 | Executed — ready for verification | 2026-07-22 |
| 176. Chat Render Correctness + Exec Reliability | 4/4 | Complete (SC#10 live-UAT rolling) | 2026-07-23 |
| 177. v3.4 Org-Surface Polish | 0/5 | Planned (5 plans / 2 waves) | - |
| 178 (STRETCH). Chat UI/UX Polish Pass | 0/? | Gated (behind CORE) | - |
| 179 (STRETCH). Plain-Language / Terminology Extensions | 0/? | Gated (behind CORE) | - |
| 180 (STRETCH). Agent-Loop Behavior Honesty | 0/? | Gated (behind CORE) | - |

**Guardrails firing (v3.5):**

- **G-2 sketch-first** on Phase 174 (honest run-state "feels like"), Phase 176 (render visual work), Phase 177 (org-surface polish), Phase 178 (chat polish seeds) — all live-UI / "feels like" surfaces. `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`. Phase 179 (label layer) needs no sketch (Phase-154 precedent).
- **G-5 hot files (audit at discuss-phase):** `MessageItem.tsx` / `StreamsProvider.tsx` / `useMessages.ts` (174, 176, 178), `ToolCallPanel.tsx` + workspace panel (178), `threads.py` (174 run-lifecycle — producer extraction paid down in 162.5 but the file stays hot), `agent_loop.py` + `anthropic_service.py` (180 — both hot-file ledger rows), the gateway/adapter/sanitizer boundary (175).
- **SC#10 (cross-provider mandate):** 174, 175, 176 (CORE chat surface) + 178 (run-state todos / workspace panel / provider logos touch live state) + 180 (agent loop). ORGUX (177) + LANG (179) deliberately NOT flagged — neither touches streamed state.
- **Reported-bugs mandate:** this milestone IS the parked chat-surface backlog's home — cross-check `.planning/reported-bugs/` (`surface: Agentic-RAG`, status open/deferred) at each `/gsd:discuss-phase` and fold matching reports; some "open" reports may be already-fixed-pending-verification (triage fix-vs-verify).
- **Threat models:** NONE this milestone — UI/bug-fix cleanup; ORGUX (177) is polish over the already-secured 166–168 surfaces, not new authz. Flag one only if a discuss-phase surfaces a real trust boundary.
- **Red line (D-14):** never fork the shared path — provider differences stay at the gateway/adapter/sanitizer boundary. Deep Mode byte-identical; no new runtime.
- **Cloud parity owed:** migrations 099–113 + `SECRETS_ENCRYPTION_KEY` still owed at the next production push (no new v3.5 migrations expected).

---

## v3.4 Multi-Tenancy & Org Access — ✅ SHIPPED 2026-07-22 (CORE); STRETCH deferred

Full detail archived → **`.planning/milestones/v3.4-ROADMAP.md`** · requirements → **`.planning/milestones/v3.4-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`** · STRETCH carry-forward guide → **`.planning/v3.4-STRETCH-CARRYFORWARD.md`**.

CORE Phases 160-168 (10 phases incl. the 162.5 `threads.py` refactor; 56 plans, 121 tasks) — the load-bearing **one-way RLS door** that turns Agentic RAG from a per-user app into an org-aware multi-tenant platform. **Tenancy foundation (160-162):** a ratify-not-relitigate Tenancy ADR (D-v3.4-01), the 8-table org/dept/role schema with correct-from-birth membership RLS + `current_user_org_ids()` (mig 104), and personal-org backfill across 35 tables (migs 105/106). **The atomic crux (162.5-164):** the `threads.py` producer extraction (2444→1214 LOC, `agent_loop` byte-identical) then the RLS rewrite + per-request user-JWT client swap (migs 107/108, FIX-A 109) so membership RLS is ENFORCED on every request path, then the SECDEF audit + `document_chunks`/`skill_embeddings` org-scoping + the two-org isolation exit-gate suite (mig 110). **Cleanup + surfaces (165-168):** `is_global` semantic retirement (mig 111 → `is_org_shared` / `is_system_global`), the org-admin shell/switcher/profile/audit + Settings split, invitations/roles/greenlists/JIT/per-user-prefs, and SAML SSO self-service (mig 113 — Supabase is the SAML SP, 0 new hard deps). 22/22 CORE requirements delivered + threat-secured (`threats_open: 0` across the isolation cluster + 166/167/168; SEED-124 + SEED-125 cross-org leaks closed). **Owed on cloud:** migrations 104-113 + `SECRETS_ENCRYPTION_KEY`. Live UAT (cross-provider SC#10 + the SSO round-trip, which needs cloud + a real IdP) rolls forward. **STRETCH 169-173** (Dept-Admin shell, entitlement/retention footholds, permission-aware citations, OIDC SSO, dept-targeted skills) deferred with concrete re-open triggers → the carry-forward guide.

---

## v3.3 Operator UX — ✅ SHIPPED 2026-07-18

Full detail archived → **`.planning/milestones/v3.3-ROADMAP.md`** · requirements → **`.planning/milestones/v3.3-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

14 phases (146–159), 95 plans, 212 tasks. Made the platform operable + configurable by a non-developer operator from the UI. **Operator tier (146–148):** a gated `/admin` Control Room behind a byte-identical-404 `require_operator` gate (no RLS backstop — app-layer isolation) + operator audit ledger — health, active-runs + Kill, fail-closed capability kill-switches, maintenance/read-only mode, audit browser, user roster, API-enforced feature visibility. **Model & secrets (149–150, 159):** a dynamic model-capability registry + live propose-only discovery (no restart, no silently-guessed capabilities), add-model-by-ID + utility-filtered discovery curation (159), and app-layer Fernet secrets-at-rest with env-fallback. **Files & workflows (151–152):** `fetch_document_file` + `attach_skill_file` agent tools, Run-modal file-input + per-run KB-folder scope + safe workflow delete. **Trust & friendliness UX (153–156):** per-claim inline citations keyed to the run's real retrieval set, an app-wide plain-language layer behind an advanced reveal, a WCAG-AA sweep, everyday nav/thread polish. **Deployment (157–158):** Solo/Team/Enterprise presets + `docker-compose.prod.yml` + `OPERATOR.md`, and an idempotent lock-after-finalize install wizard at `/setup`. 20/20 requirements (16 CORE + 4 STRETCH); WFIN-02 one operator-accepted OpenRouter-axis limitation (external BUG-260714-02). Migrations 095–103; `SECRETS_ENCRYPTION_KEY` env. Threat-secured across 146–150 / 153 / 154 / 158 / 159 (`threats_open: 0`).

---

## v3.2 Skill Eval Studio + Self-Improving — ✅ SHIPPED 2026-07-10

Full detail archived → **`.planning/milestones/v3.2-ROADMAP.md`** · requirements → **`.planning/milestones/v3.2-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

16 phases (132, 133, 134, 134.1, 135, 136, 137, 137.1, 137.2, 138, 139, 140, 141, 142, 143, 145), 81 plans. Turned the v3.1 Skill Trigger Tuner into a full **Skill Eval Studio**: persistent eval test cases + immutable skill versions, a with-skill-vs-without eval runner with a dual-arm LLM judge + honest per-provider verdicts + human ratings, a human-in-the-loop self-improvement loop, a publish gate, and the Evals·Triggering·Versions panel — plus a built-in skill-creator (every user, read-only + protected), STRETCH honesty phases (run-end honesty, smart-dispatch skill pre-filter, run-scoped template resolver, non-Python skill-script honesty), the FND-01 run-lifecycle foundation (`runs.status` authoritative + `threads.py` G-5 extraction, live SC#10 UAT 6/6), and a curated **Starter Workflow Library** (WF-01 — 3 KB→document starters proven live end-to-end: fork → judge-approved publish gauntlet → cited `.docx`).

**Deferred → v3.3:** FILE-01 (Phase 144, Agent-Driven Skill File Attachment — gated STRETCH, not executed; rolls forward with the workflow-file cluster SEED-110/112). **Verification debt:** live UATs pending/partial on 140/141/142/143 (see MILESTONES.md → Known Gaps).

**Next:** v3.3 Operator UX (authoritative map: `PRDs/SEQUENCE.md`).

---

## v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers — ✅ SHIPPED 2026-06-28

**Started:** 2026-06-21 (Option A — scope LOCKED + operator-approved). Numbering continues from v3.0's last phase (119) → **CORE Phases 120-124**, then **STRETCH Phases 125-131** (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 precedent). *Phase 131 (SRH-01, non-Python skill-script honesty) folded in 2026-06-22 after a JS-skill-import investigation — SEED-044 Layer 1; the full Node-execution capability stays v3.2 DISC-01.*

**Goal:** Make the agent's skills + workflows trustworthy, legible, and reliably triggered across *all* providers — fix the live workflow↔skill collision (a confirmed, root-caused bug), lift cross-provider honesty to OpenAI-parity, add a Skill Trigger Tuner, and re-skin the Workflow Studio so each workflow's "soul" is obvious with a strict↔loose authoring/running split.

**Red line (every phase):** never fork the shared Deep/agent-loop/provider path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

**Scope source:** `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md` (LOCKED). Operator pressures: `.planning/research/v3.1-skills-eval/OPERATOR-INPUTS.md`.

### Phase Table (CORE)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 120 | Collision Fix + Context Isolation | A skill saving one file in a workflow-touched thread emits exactly that file, and Deep/Harness stop replaying each other's history | COLL-01, CTX-01 | 4 | G-5 (`threads.py` firing → extraction due, `agent_loop.py` `_reconstruct_history`); SC#10 |
| 121 | One Front Door for Workflows (IA) | Workflows launch from a single front door; the chat composer drops to 2-pill General/Explorer while the lock/409/reconcile is preserved | IA-01 | 3 | G-2 sketch-gated; UI hint; SC#10 |
| 122 | Cross-Provider Trust & Honesty Parity | Cross-provider emission is recovered-or-honest, doc-verified per provider, measured on a per-provider scoreboard, and task labels are concrete on every provider | MP-01, MP-02, MP-03, TDP-01 | 5 | G-5 (gateway/adapter boundary, `agent_loop.py`); SC#10 (cross-provider = EVAL axis, MP-03) |
| 123 | Skill Triggering Quality | A skill author can tune a description against a held-out benchmark, weak descriptions are flagged at save, and loaded skills don't fall out of context mid-session | TRIG-01, TRIG-03, CTX-03 | 5 | G-5 (`context_window.py`/`agent_loop.py` trim path for CTX-03); SC#10 (TRIG-01 cross-provider) |
| 123.1 (INSERTED) | Skill Trigger Tuner — Design Fidelity & UX Polish | The Trigger Tuner result surface reads cleanly at the org's real provider count, the seeded benchmark is visible/editable before running, a completed result survives refresh, and the builder model is choosable from configured models | TRIG-01 (gap-closure, BUG-260624-01) | TBD | G-2 sketch-gated (sketches 041–044 exist); frontend-heavy; SC#10 (cross-provider legibility) |
| 124 | Workflow Studio UX — Soul + Strict↔Loose | A user sees a workflow's "soul" at a glance in 3 sizes and meets a clear strict↔loose split ("Describe & run" vs "Author & govern") | WUX-01, WUX-02 | 4 | G-2 sketch-gated (both); UI hint; G-5 (`PhaseTimeline.tsx`/`PhaseCard.tsx`) |

### Phase Table (STRETCH — gated behind CORE)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 125 | Self-Improve Proposer (description-only) | A bounded, human-in-the-loop description-only proposer drafts a description diff → human approves → new immutable version; never auto-publishes | SI-02 (STRETCH) | 3 | SC#10 (judge-as-gate cross-provider); depends on 122 + 123 |
| 126 | Smart-Dispatch Relevance Pre-Filter | Only plausibly-relevant skills are surfaced to the model and the catalog stays within a token budget | TRIG-02 (STRETCH) | 3 | G-5 (catalog injection path); SC#10; depends on 123 |
| 127 | Gauntlet Pip-Strip + Quiet Idle Cards | The publish gauntlet renders as a pip-strip + worded verdict with raw-on-demand; idle PhaseCards stay quiet | WUX-03 (STRETCH) | 2 | G-2 sketch-gated; UI hint; G-5 (`PhaseCard.tsx`); depends on 124 |
| 128 | Chat Tool-Card Unification + Chat-Area Reclaim | One honest, unified, space-efficient chat surface across every provider: live description before `tool_start` + provider logos in the tool-card header + a tool card that uniformly carries all run info + removing the redundant sticky composer timer + Read-more on long prompts | TDP-02, CTC-01, CTC-02, CTC-03, CTC-04 (STRETCH) | 5 | **G-2 sketch-gated** (now visual); SC#10 (cross-provider tool-card parity); **G-5** (`ToolCallPanel.tsx`/`MessageItem.tsx`/`ChatArea.tsx` — audit refactor-vs-feature at discuss); depends on 122 |
| 129 | MiniMax/OpenRouter Arg Repair | MiniMax malformed-args boundary repair + OpenRouter `require_parameters` for broader provider robustness | MP-04 (STRETCH) | 2 | G-5 (gateway/adapter boundary); SC#10; depends on 122 |
| 130 | template_input Resolver Run-Scope | The `template_input` resolver is run-scoped too — defense-in-depth for the `render_template` path alongside COLL-01 | COLL-02 (STRETCH) | 2 | depends on 120 |
| 131 | Non-Python Skill-Script Honesty | A user importing/running a skill with a non-Python script (e.g. `.js`) gets an honest message instead of a silent failure; instructions still work | SRH-01 (STRETCH) | 3 | additive, OFF the COLL-01 seam; SEED-044 Layer 1; precursor to v3.2 DISC-01 |

### Phase Checklist

- [x] **Phase 120: Collision Fix + Context Isolation** — run-scope the sandbox harvest baseline (kills the live 2-files bug) + tag `messages.origin` so Deep/Harness stop replaying each other (COLL-01, CTX-01) ✓ 2026-06-22
- [x] **Phase 121: One Front Door for Workflows (IA)** — remove the composer Harness pill → 2-pill General/Explorer, keep the lock/409/reconcile (IA-01) ✓ 2026-06-23
- [x] **Phase 122: Cross-Provider Trust & Honesty Parity** — force→coerce retry ladder, doc-verified `emit_tier`, per-provider scoreboard, OpenAI-parity task labels (MP-01, MP-02, MP-03, TDP-01) ✓ 2026-06-23
- [x] **Phase 123: Skill Triggering Quality** — Skill Trigger Tuner, save-time description lint, pin loaded skills out of trim (TRIG-01, TRIG-03, CTX-03) ✓ 2026-06-26 (all 3 gates: secure 29/29 · validate NYQUIST 12/12 · verify 12/12 + SC#10 4-axis live UAT 4/4 PASS)
- [x] **Phase 123.1 (INSERTED): Skill Trigger Tuner — Design Fidelity & UX Polish** — fix the cramped N-provider scoreboard, show/edit seeded cases, persist results across refresh, builder-model = configured models, restore dropped sketch elements (gap-closure for 123, BUG-260624-01)
 (completed 2026-06-25)

- [x] **Phase 124: Workflow Studio UX — Soul + Strict↔Loose** — soul in 3 sizes + strict↔loose disclosure (WUX-01, WUX-02) — 3 plans ✓ 2026-06-26 (code-review CR-01 fixed · verify 4/4 + operator UAT 7/7 PASS · CORE complete)
- [ ] **Phase 125 (STRETCH): Self-Improve Proposer (description-only)** — bounded human-in-the-loop description proposer (SI-02)
- [ ] **Phase 126 (STRETCH): Smart-Dispatch Relevance Pre-Filter** — relevance pre-filter + catalog token budget (TRIG-02)
- [x] **Phase 127 (STRETCH): Gauntlet Pip-Strip + Quiet Idle Cards** — pip-strip + worded verdict, quiet idle cards (WUX-03) — 3 plans (executed + code-verified 2026-06-27; manual UAT pending)
- [ ] **Phase 128 (STRETCH): Chat Tool-Card Unification + Chat-Area Reclaim** — live description before `tool_start` + provider logos in the tool-card header + uniform cross-provider tool card + remove the redundant sticky composer timer + Read-more on long prompts (TDP-02, CTC-01..04)
- [x] **Phase 129 (STRETCH): MiniMax/OpenRouter Arg Repair** — MiniMax-gated arg-repair guard (single-shot re-ask → recover or honest-fail) + OpenRouter `require_parameters` in the quality strategy (MP-04) — 3 plans ✓ 2026-06-27 (verify 11/11 · 12 unit tests green · SC#10 live 7/9 rows PASS, both load-bearing changes live-verified — OpenRouter API accepts `require_parameters` (R9), no regression on OpenAI/Anthropic/Google/MiniMax; repair rungs unit-proven, truncation trigger now dormant (cap moved 8192→9987+); BUG-260607-03 folded)
- [ ] **Phase 130 (STRETCH): template_input Resolver Run-Scope** — run-scope the render_template resolver (COLL-02)
- [ ] **Phase 131 (STRETCH): Non-Python Skill-Script Honesty** — honest import/exec message when a skill bundles a non-Python script the sandbox can't run; optional read-as-text for `.js` (SRH-01)

### Phase Details

#### Phase 120: Collision Fix + Context Isolation

**Goal**: A skill that runs in a thread that previously ran a workflow emits only its own output, and a subsequent Deep turn never replays the workflow's history — the live, root-caused collision (Mechanism A) is closed at the harvest baseline and the history-reconstruction filter.
**Depends on**: Nothing (first phase; sequenced EARLY because COLL-01 is a confirmed live bug)
**Requirements**: COLL-01, CTX-01
**Success Criteria** (what must be TRUE):

  1. A skill `execute_code` that saves exactly one file in a thread that previously ran a workflow emits exactly that one file — the prior workflow's leftover `/sandbox/output/` artifact is never re-emitted (the confirmed 2-files bug is gone).
  2. The sandbox-output harvest is run-scoped to its own run's baseline, so any file present before the run starts is excluded from that run's emitted outputs.
  3. When Deep chat and a workflow share a thread, a Deep turn's history reconstruction replays only `messages.origin = deep` rows, and a workflow phase replays only its `harness` rows — workflow context never bleeds into a subsequent Deep turn.
  4. The collision fix holds across providers, multi-tool prompts, parallel threads, and long (≥50-message) histories — Deep Mode stays byte-identical on the native-7 (no shared-path fork; SC#10).

**Plans**: 3 plans

- [x] 120-01-PLAN.md — COLL-01: run-scope the sandbox-output harvest (snapshot+hash baseline seed) + headline live-repro regression test
- [x] 120-02-PLAN.md — CTX-01: author migration 076 (messages.origin) + tag every harness insert site + asymmetric origin filter at agent_loop.py:1024
- [x] 120-03-PLAN.md — [BLOCKING] apply migration 076 to live DB (SQL-editor paste) + regenerate full-schema.sql + live-DB integration test

#### Phase 121: One Front Door for Workflows (IA)

**Goal**: A user launches workflows from a single, obvious front door (the Workflows page); the chat composer is simplified to a 2-pill General/Explorer control with the Harness pill and in-chat workflow selector removed, while the existing Harness↔Deep lock / 409 / reconcile behavior is preserved exactly.
**Depends on**: Phase 120 (context isolation is the actual collision fix; IA-01 is the clarity win that rides on top — and they touch overlapping thread/composer surfaces)
**Requirements**: IA-01
**Success Criteria** (what must be TRUE):

  1. The chat composer shows exactly two mode pills (General / Explorer) — the Harness pill and the in-chat workflow selector are gone, and the only place to launch a workflow is the Workflows page.
  2. Launching a workflow still works as an explicit "launch-in-context" action (the capability is not removed), and a launched workflow's thread still toggles into Harness mode and Continues correctly.
  3. The server-side Harness↔Deep lock still returns a 409 on an illegal switch, and the lock/reconcile behavior is unchanged from before the composer change.
  4. Behavior holds across providers and parallel threads with no Deep-mode regression (SC#10).

**Plans**: 2 plans

- [x] 121-01-PLAN.md — remove the Deep/Harness toggle + in-chat workflow picker (2-pill composer); preserve lock/409/reconcile + composer-stop Cancel (SC#1/SC#3)
- [x] 121-02-PLAN.md — rewrite ChatAreaMode + extend ChatAreaBanner + new ChatLayout launch test (SC#1/SC#2/SC#3 oracles)

**UI hint**: yes

#### Phase 122: Cross-Provider Trust & Honesty Parity

**Goal**: Structured emission is recovered-or-honest on every provider, each provider uses the emission path it actually supports (doc-verified, not guessed), cross-provider reliability is measured on a per-provider scoreboard that gates any tier change, and task/step labels are concrete on every provider (OpenAI-parity) — all at the gateway/adapter boundary, never the shared path.
**Depends on**: Phase 120 (lands after the collision fix so the cross-provider blast radius is clean)
**Requirements**: MP-01, MP-02, MP-03, TDP-01
**Success Criteria** (what must be TRUE):

  1. A model that silently fails a forced structured emit (e.g. the default model's no-metadata 400) is recovered by a force→coerce retry ladder in `forced_emit`, so a typed-artifact phase produces its emission instead of a silent empty result.
  2. Each provider's forcing/strict behavior is honest and doc-verified — an explicit `emit_tier` field replaces guesswork, the inert DeepSeek function-level `strict` is dropped, and GLM forcing is kept (intentional, live-verified).
  3. The eval treats provider as a first-class axis with a per-provider scoreboard (trigger / force / recovery / honest-fail), pass-OR-documented, and any `emit_tier` change is gated on that scoreboard (no silent tier flip).
  4. Task/todo/workflow-step labels are concrete on every provider (OpenAI-parity), not the bare tool name — an ungated prompt nudge fills `execute_code.description` and a deterministic frontend summarizer floor backstops providers that don't, without regressing providers that already do.
  5. The 4-axis SC#10 scoreboard (cross-provider × multi-tool × parallel-thread × long-message) passes as an EVAL axis (per MP-03), and Deep Mode stays byte-identical (no shared-path fork).

**Plans**: 4 plans

- [x] 122-01-PLAN.md — MP-02: explicit emit_tier field + 55-row registry migration (14/2/34/5) + remove the provider=="openai" gate + inert DeepSeek strict
- [x] 122-02-PLAN.md — MP-01: the ordered force_strict→non-strict→coerce→fail rung ladder inside forced_emit (reads emit_tier) + emit_rung telemetry
- [x] 122-03-PLAN.md — MP-03: --forced-emit scoreboard matrix (EASY+HARD × native-7, 4 axes PASS/FAIL/DOCUMENTED) + dated artifact + README grep ritual
- [x] 122-04-PLAN.md — TDP-01: ungated execute_code.description SYSTEM_PROMPT nudge + verified frontend label floor

#### Phase 123: Skill Triggering Quality

**Goal**: A skill author can measurably tune a skill's trigger description, the system flags weak trigger descriptions before a skill is saved, and a loaded skill's instructions stay available for the rest of the session instead of silently falling out of context.
**Depends on**: Phase 122 (the Trigger Tuner measures cross-provider on production model-ids; it reuses the per-provider scoreboard substrate landed in 122)
**Requirements**: TRIG-01, TRIG-03, CTX-03
**Success Criteria** (what must be TRUE):

  1. A skill author can run a description against a held-out should-trigger / should-not-trigger benchmark (Skill Trigger Tuner) and pick the winning description by held-out score, measured cross-provider on production model-ids.
  2. The Trigger Tuner reports a concrete trigger/should-not score per candidate description so the author can see one description beat another, not just a pass/fail.
  3. At `save_skill` (and in the skill-creator loop) a description-quality lint flags a weak or ambiguous trigger description before the skill is saved.
  4. A skill loaded mid-conversation stays in context for the rest of the session — its instructions are pinned out of the rolling trim window and don't silently disappear after the window rolls.
  5. Trigger measurement and the pinned-instruction behavior hold across providers and long histories (SC#10) with no shared-path fork on the trim path.

**Plans**: 6 plans

- [x] 123-01-PLAN.md — TRIG-03 deterministic save-time lint (3 hook points, warn-never-block) + D-01 catalog-note relaxation (shared LOAD_SKILL_POLICY)
- [x] 123-02-PLAN.md — CTX-03 trim-pin: load_skill tool-result as a third protected class in trim_messages_to_fit (de-dupe, 1/3 budget, LRU evict + marker) + reconstruct tag (G-5 RED LINE)
- [x] 123-03-PLAN.md — TRIG-01 core: D-08 builder-model knob + skill_tuner_service (candidates, policy-faithful classification, 60/40 held-out scoring, N-column adaptivity, owner-scoped auto-seed)
- [x] 123-04-PLAN.md — TRIG-01 routes: owner-scoped skill_tuner router (bounded background job over the run-buffer + tuner-specific SSE + held-out scoreboard)
- [x] 123-05-PLAN.md — TRIG-01 UI: focused full-surface Trigger Tuner (reachability triad) — case editor, N-column scoreboard (fires/no-false), candidate cards, live-run card, author-confirm diff (041-A/042-A/043-A)
- [x] 123-06-PLAN.md — TRIG-03 UI loop: inline never-block lint warning + "Tune this" handoff + the D-08 builder-model Settings picker (044-A)

### Phase 123.1: Skill Trigger Tuner — design fidelity and UX polish (INSERTED)

**Goal:** The Skill Trigger Tuner reads cleanly at the org's real provider count, makes the benchmark visible/editable before a run, makes a completed result durable across refresh/restart, and lets the builder model be chosen from configured models — closing the live-UAT design-fidelity + UX gaps in BUG-260624-01 (HIGH + MED) without changing the scoring core, the agent loop, the shared chat path, or the CTX-03 trim-pin.
**Requirements**: TBD (scope contract = the 12 locked decisions D-01..D-12 in 123.1-CONTEXT.md + the live-UAT audit backlog TT-05/07/08/09/10/11/12/14/15/16 in 123.1-AUDIT-BACKLOG.md; each is covered by >=1 plan)
**Depends on:** Phase 123
**Plans:** 10/10 plans complete

Plans:

- [x] 123.1-01-PLAN.md — Backend seam: tuner_runs table (migration 077) + durable latest-result upsert + GET-latest + seeded-cases GET + frontend wire (D-01/D-05/D-07/D-08)
- [x] 123.1-02-PLAN.md — Scoreboard polish: ProviderScoreboard vertical rows + magnitude bar + combined score; CandidateCard line-clamp/expand (D-02/D-04/D-11/D-12)
- [x] 123.1-03-PLAN.md — Settings builder-model picker from configured models + soft hint; remove IN-02 placeholders (D-09/D-10)
- [x] 123.1-04-PLAN.md — Page integration: full-width results, seeded-case hydrate/edit, standalone live-description scoreboard, result rehydration, pre-run cost preview + attribution (D-03/D-05/D-06/D-07/D-12)
- [x] 123.1-05-PLAN.md — [Wave 1] Editor-wall fix (sketch 045-B): backend seed-cap (MAX_SEEDED_SHOULD_NOT) + seeded GET `total` + legible/bounded CaseEditor + full-width pre-run stack (BUG-260624-01; seed-cap now load-bearing for RUN TIME per backlog section 5)
- [x] 123.1-06-PLAN.md — [Wave 2] Backend honesty: empty axis -> n/a not 1.0 (TT-05); all-error column -> unmeasured, excluded from target_count (TT-12); single-source cell_score (TT-15)
- [x] 123.1-07-PLAN.md — [Wave 3] Run UX: emit stage=provider_start so lanes flip queued->running (TT-07); real owner-scoped + run<->skill-bound DELETE cancel route + job checkpoint + claim release (TT-08)
- [x] 123.1-08-PLAN.md — [Wave 4] Run resilience: honest seeded-fetch note (TT-09); unmeasured-cell render (TT-12 render half); reconciling sub-state no-flash (TT-14); durable-poll reconnect honesty (TT-16)
- [x] 123.1-09-PLAN.md — [Wave 5] Layout: delete both decorative bg-sidebar deco-rails on SkillsPage + SkillTunerPage (TT-11)
- [x] 123.1-10-PLAN.md — [Wave 1] Observability: silence the LangSmith 429 uploader flood to ERROR + document LANGSMITH_TRACING_SAMPLING_RATE (TT-10)

#### Phase 124: Workflow Studio UX — Soul + Strict↔Loose

**Goal**: A user immediately sees the "soul" of a workflow (its purpose, what it needs, its phase spine, its tier, its output) in three consistent sizes, and meets a clear strict↔loose disclosure that offers two doors ("Describe & run" vs "Author & govern") without removing any control — accuracy and governance preserved, complexity demoted one click.
**Depends on**: Phase 121 (the Workflows page is now the single front door; the soul re-skin builds on that consolidated surface)
**Requirements**: WUX-01, WUX-02
**Success Criteria** (what must be TRUE):

  1. A user sees a workflow's "soul" at a glance in three sizes (library card / run header / publish summary): its purpose (`business_requirement`), what it needs, a glyph-dot phase spine (no type ribbons/index noise), one tier chip, and its output line.
  2. The library card / run header / publish summary all show the same soul object consistently — a user recognizes a workflow by the same essence in all three places.
  3. Authoring and running expose a strict↔loose disclosure keyed off `deriveTier` — two clear doors ("Describe & run" vs "Author & govern") — where nothing is removed and advanced controls are demoted exactly one click.
  4. The strict↔loose split preserves accuracy and control — a power user can still reach every advanced control, and a loose user can describe-and-run without meeting governance complexity (sketch-approved mockup is the acceptance bar).

**Plans**: 3 plans

- [x] 124-01-PLAN.md — Wave 0 foundation: extract shared soulData (tierForDefinition + PHASE_GLYPHS + needs/deliverable) + net-new WorkflowSoul (3 sizes) + glyph-dot PhaseSpine (WUX-01)
- [x] 124-02-PLAN.md — card-scale soul on library cards + the two-door fork (Describe & run / Author & govern) at the Studio authoring entry; library-card Run preserved (WUX-01, WUX-02)
- [x] 124-03-PLAN.md — run-surface soul as a G-5 additive sibling in WorkspacePanel + publish-summary soul block prepend (D-06 ladder untouched) (WUX-01)

**UI hint**: yes

#### Phase 125: Self-Improve Proposer (description-only)

**Goal**: A bounded, human-in-the-loop, description-only self-improvement proposer: eval surfaces a weak description → proposes a description diff → DRAFT → human approves → a new immutable version; it never auto-publishes, uses held-out selection, and uses the Phase-102 judge as a gate.
**Depends on**: Phase 122 + Phase 123 (reuses the cross-provider scoreboard, the Trigger Tuner's held-out selection, and the judge gate); gated behind CORE completion
**Requirements**: SI-02 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. The proposer can take an eval signal on a weak description and produce a proposed description diff as a DRAFT — it never edits a live skill description and never auto-publishes.
  2. A human reviews the proposed diff and, on approval, the proposal becomes a new immutable version; on rejection nothing changes.
  3. A proposed description is selected by held-out score and must clear the Phase-102 judge gate before it can be presented as a recommendation.

**Plans**: TBD
**UI hint**: yes

#### Phase 126: Smart-Dispatch Relevance Pre-Filter

**Goal**: Only plausibly-relevant skills are surfaced to the model and the skill catalog stays within a token budget, so the model isn't flooded with irrelevant skills and the catalog doesn't blow the context budget.
**Depends on**: Phase 123 (builds on the skill-triggering work); gated behind CORE completion
**Requirements**: TRIG-02 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. For a given user turn, only skills that pass a relevance pre-filter are surfaced to the model — clearly-irrelevant skills are not injected.
  2. The injected skill catalog stays within a defined token budget even as the user's skill count grows.
  3. The pre-filter never starves a genuinely-relevant skill (a should-trigger skill still reaches the model), verified cross-provider (SC#10).

**Plans**: TBD

#### Phase 127: Gauntlet Pip-Strip + Quiet Idle Cards

**Goal**: The publish gauntlet reads at a glance as a pip-strip + worded verdict with raw detail on demand, and idle PhaseCards stay visually quiet instead of competing for attention.
**Depends on**: Phase 124 (rides on the Workflow Studio UX re-skin); gated behind CORE completion
**Requirements**: WUX-03 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. The publish gauntlet renders as a pip-strip + a worded verdict, with the raw gauntlet detail available on demand (not shown by default).
  2. An idle PhaseCard stays quiet (no noisy animation/placeholder) and only animates when its phase is actually active (sketch-approved mockup is the acceptance bar).

**Plans**: 3 plans (planned 2026-06-27)

- [x] 127-01-PLAN.md — Icon foundation: build-time 3D-icon mechanism (unplugin-icons) + shared PHASE_GLYPHS 3D swap + PhaseSpine test migration
- [x] 127-02-PLAN.md — Publish gauntlet re-skin: energy-spine + worded verdict + raw-on-demand + golden-run hero (honesty contracts intact)
- [x] 127-03-PLAN.md — Living step-flow re-skin: quiet idle / bloomed active (activity line + engine chip) / folded done (G-5 PhaseCard/PhaseTimeline)

**UI hint**: yes

#### Phase 128: Chat Tool-Card Unification + Chat-Area Reclaim

**Goal**: One honest, unified, space-efficient chat surface across every provider — the tool card becomes the single canonical place for live run info, it reads identically on all providers, redundant chrome is removed, and every pixel of the chat area earns its place.
**Depends on**: Phase 122 (extends the task-label parity / tool-card honesty work); gated behind CORE completion
**Requirements**: TDP-02, CTC-01, CTC-02, CTC-03, CTC-04 (STRETCH)
**Reframed** 2026-06-27 (operator): the original narrow "Live Description Before tool_start" (TDP-02) was bundled with four operator-raised chat-surface improvements (CTC-01..04) because they share the same surface + G-5 hot files (`ToolCallPanel.tsx` / `MessageItem.tsx` / `ChatArea.tsx`) and one coherent vision — better as one sketched pass than five scattered inserts.
**Success Criteria** (what must be TRUE):

  1. A tool's `description` appears in the preparing window before the `tool_start` event fires (TDP-02), so the user sees what the agent is about to do during the prep gap — across providers, no Deep-mode regression, no shared-path fork (SC#10).
  2. The tool-card header shows the actual provider's logo per-provider, replacing the generic brand-pulse "spot" avatar (CTC-01).
  3. The tool card carries a unified content/layout across ALL providers — the single canonical, complete surface for live run info (status, elapsed, step/file counts, description), with no per-provider gaps (CTC-02; provider-docs-first / SC#10 — verified uniform before relying on it).
  4. The redundant sticky elapsed timer above the composer (`ChatArea.tsx` 076.1 D-03; today inconsistent across providers) is removed once CTC-02 holds, reclaiming chat-area space (CTC-03).
  5. Long user prompts collapse to a clamped preview with a "Read more" expander instead of rendering full-height (CTC-04).
  6. The unified surface is sketch-approved (G-2) before planning — the operator-approved mockup is the acceptance bar.

**Plans**: 6 plans

- [x] 128-01-PLAN.md — Install @lobehub/icons (supply-chain checkpoint) [D-08]
- [x] 128-02-PLAN.md — CTC-04 long-prompt clamp + gradient fade + Read-more (independent) [D-03]
- [x] 128-03-PLAN.md — providerLogo.tsx shared helper (logo map + preparingDescription) + Wave-0 unit tests [D-05]
- [x] 128-04-PLAN.md — CTC-01 RunCard logo + TDP-02 ToolCallPanel description = the unified card (CTC-02) [D-01/D-04]
- [x] 128-05-PLAN.md — D-06 LIVE native-7+OpenRouter cross-provider scoreboard (operator-run) [D-06]
- [x] 128-06-PLAN.md — CTC-03 StickyTimerBar deletion (LAST, gated on the D-06 proof) [D-02/D-07]

**UI hint**: yes

#### Phase 129: MiniMax/OpenRouter Arg Repair

> **STRETCH-origin** — promoted to active 2026-06-26 after v3.1 CORE (120–124) shipped clean; selected as a highest-value STRETCH (the only one closing a live open bug).

**Goal**: Broader provider robustness — MiniMax malformed tool-args are repaired at the adapter boundary, and OpenRouter requests set `require_parameters` so a wider set of routed providers honor the tool schema.
**Depends on**: Phase 122 (extends the cross-provider trust cluster at the gateway/adapter boundary); CORE complete (gate lifted)
**Requirements**: MP-04 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. A MiniMax malformed-args response is repaired at the adapter boundary so the tool call still dispatches instead of failing (closes the `minimax-m3-invalid-tool-args-400` class).
  2. OpenRouter requests carry `require_parameters`, and the change improves tool-schema honoring without regressing other providers (SC#10), with provider handling staying at the adapter boundary (no shared-path fork).

**Plans**: 3 plans

- [ ] 129-01-PLAN.md — OpenRouter `require_parameters` wired into the quality strategy (D-02) + unit test
- [ ] 129-02-PLAN.md — MiniMax-gated arg-validity guard + bounded re-ask + recovered signal / honest-fail (D-01/D-03); folds BUG-260607-03 + unit tests
- [ ] 129-03-PLAN.md — SC#10 4-axis live cross-provider scoreboard (authored in VALIDATION.md + operator-run)

#### Phase 130: template_input Resolver Run-Scope

**Goal**: Defense-in-depth for the collision — the `template_input` resolver is run-scoped too, so the `render_template` path can't re-introduce a cross-run leak alongside the COLL-01 harvest fix.
**Depends on**: Phase 120 (pairs with COLL-01 on the same collision/harvest surface); gated behind CORE completion
**Requirements**: COLL-02 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. The `template_input` resolver only resolves inputs scoped to the current run — a prior run's template inputs in the shared workspace are never picked up by a later run's `render_template`.
  2. The render_template path produces the same output it did before for in-scope inputs (no regression on the happy path).

**Plans**: TBD

#### Phase 131: Non-Python Skill-Script Honesty

**Goal**: A user who imports or runs a market skill that bundles a non-Python script the Python-only sandbox can't execute (e.g. `.js`) gets an honest, specific signal instead of a silent/confusing failure — closing the trust gap from the 2026-05-31 JS-skill-import incident (SEED-044 Layer 1). This is the honesty precursor to v3.2's DISC-01 (the full Node-execution capability); it is purely additive and stays OFF the COLL-01 sandbox-injection seam.
**Depends on**: Nothing hard; sequence after Phase 120 only to avoid touching the COLL-01 harvest/execution seam concurrently. Gated behind CORE completion. Lightweight (G-3-adjacent — import-boundary detection + an execution pre-check + message; no Node runtime, no image rebuild, no shared-path fork).
**Requirements**: SRH-01 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. Importing a skill that bundles a non-Python script (e.g. `.js`) still succeeds, and the user sees an honest message that the skill includes a step the sandbox can't run yet while its instructions still work.
  2. When the agent would run a non-Python skill script, it fails cleanly with a specific message instead of silently running JS as Python and dying on a Python `SyntaxError`.
  3. (Optional) `read_skill_file` can return a bundled `.js` as reference text so the model can read/reason about it, without implying it can be executed.

**Plans**: TBD
**Note**: Real multi-language execution (Node in the image + language routing) is explicitly NOT this phase — that's v3.2 DISC-01, which must sequence after COLL-01.

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 120. Collision Fix + Context Isolation | 3/3 | Complete | 2026-06-22 |
| 121. One Front Door for Workflows (IA) | 2/2 | Complete | 2026-06-23 |
| 122. Cross-Provider Trust & Honesty Parity | 4/4 | Complete | 2026-06-23 |
| 123. Skill Triggering Quality | 6/6 | Complete (secure 29/29 · validate 12/12 · verify 12/12 + SC#10 4-axis UAT 4/4) | 2026-06-26 |
| 123.1 (INSERTED). Skill Trigger Tuner — Design Fidelity & UX Polish | 10/10 | Complete (verify 22/22 + UAT 8/8 · secure 34/34 · validate 9/9) | 2026-06-25 |
| 124. Workflow Studio UX — Soul + Strict↔Loose | 3/3 | Complete (code-review CR-01 fixed · verify 4/4 + operator UAT 7/7 · CORE complete) | 2026-06-26 |
| 125 (STRETCH). Self-Improve Proposer (description-only) | 0/? | Gated (behind CORE) | - |
| 126 (STRETCH). Smart-Dispatch Relevance Pre-Filter | 0/? | Gated (behind CORE) | - |
| 127 (STRETCH). Gauntlet Pip-Strip + Quiet Idle Cards | 3/3 | Code-verified (11/11 truths); manual UAT pending | 2026-06-27 |
| 128 (STRETCH). Chat Tool-Card Unification + Chat-Area Reclaim | 6/6 | Complete (verify 5/6 code truths · D-06 scoreboard PARTIAL — logos confirmed live both themes, exhaustive sweep deferred · 3 live-UAT carried · white-chip + lmstudio logo fixes) | 2026-06-27 |
| 129 (STRETCH). MiniMax/OpenRouter Arg Repair | 0/? | Gated (behind CORE) | - |
| 130 (STRETCH). template_input Resolver Run-Scope | 0/? | Gated (behind CORE) | - |
| 131 (STRETCH). Non-Python Skill-Script Honesty | 0/? | Gated (behind CORE) | - |

**Guardrails firing (v3.1):**

- **G-2 sketch-first** on Phase 121 (IA-01), Phase 124 (WUX-01/02), Phase 127 (WUX-03), Phase 128 (CTC-01..04 — reframed 2026-06-27 from a non-visual TDP-02 into a visual chat-surface bundle) — all live UI / "feels like" surfaces. `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`. `sketch-findings-agentic-rag` already names the workflow run surface, the Workflows page, the phase timeline, and the composer.
- **G-5 hot files:** `backend/app/api/threads.py` (firing → extraction due — do NOT grow it; 120/121 touch its thread/composer surface), `context_window.py`/`agent_loop.py` trim path (CTX-01 origin filter in `_reconstruct_history`, CTX-03 trim-pin), `PhaseTimeline.tsx`/`PhaseCard.tsx` (shared with the live harness — re-run replay tests in 124/127), the gateway/adapter boundary (122/128/129).
- **SC#10 cross-provider** is an EVAL axis here (MP-03), not just manual UAT — flagged on every phase touching streaming / agent loop / provider routing / UI state (120, 121, 122, 123, 124, and the dependent STRETCH phases).
- **Red line:** never fork the shared path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

---

## v3.0 Document Management — ✅ SHIPPED 2026-06-21

Full detail archived → **`.planning/milestones/v3.0-ROADMAP.md`** · requirements → **`.planning/milestones/v3.0-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

11 phases (110, 111, 111.1, 112–119; incl. inserted embeddings phase 111.1), 46 plans, shipped + validated — **every phase passed verify-work + secure-phase + validate-phase** (live cross-provider UAT on the agent-tool / upload-path phases; no formal milestone audit). Turned the product's incidental document handling into a first-class, metadata-driven surface (M-Files Tier A): user-defined custom metadata with per-field confidence + audited manual override, configurable multi-provider embeddings (retires the OpenAI SPOF), metadata-driven "virtual folders" (a closed-registry filter-AST → parameterized-jsonb compiler + a no-DSL builder + an agent tool), typed document relationships (a leak-safe share-don't-fork core + panel + agent tool), suggest-then-confirm auto-classification, and a light governance-health view. 24/24 functional requirements delivered; `threads.py` untouched all milestone (G-5); near-zero new deps.

**Next:** v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers (active above; decided scope in `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md`).

---

## v2.9 Workflow Studio — ✅ SHIPPED 2026-06-15

Full detail archived → **`.planning/milestones/v2.9-ROADMAP.md`** · requirements → **`.planning/milestones/v2.9-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

CORE phases 097–104 (9 phases incl. inserted 101.1, 57 plans) shipped + validated — every CORE phase passed verify-work + secure-phase + live cross-provider UAT. Turned the v2.8 harness into an authorable capability: project/scope binding + server-side KB governance, workflow↔skill composition, ephemeral template upload + guaranteed cited template-fill with integrity gates, a reusable validation-gate library + an output-quality judge **hard-wall**, a Workflows page with NL authoring + read-only graph + 8-stage publish gauntlet, and a PM flagship content pack on the generic primitives.

**STRETCH 105–109 deferred to backlog** (never started — roadmap gated them on "ship only if CORE lands clean and budget remains"): SCHED-01 (scheduled triggers + budget caps), GRID-01 (citation-traceable grid renderer), GOV-02 (per-run provenance receipt), PLUG-01 (plugin-contract lock), ROLE-01 (operator/admin role tier). They roll forward as next-milestone candidates.

## Shipped Milestones

<details>
<summary>v3.2 Skill Eval Studio + Self-Improving (Phases 132-145) — SHIPPED 2026-07-10</summary>

CORE 132-137 (+ inserts 134.1, 137.1, 137.2): eval test-case persistence + immutable versions + with-skill-vs-without runner + honest per-provider verdicts + ratings + self-improve loop (SI-01) + publish gate + Evals panel + eval production-clean + built-in skill-creator. STRETCH shipped: 138 Run-End Honesty · 139 Self-Improve Proposer (description-only) · 140 Smart-Dispatch Relevance Pre-Filter · 141 template_input Resolver Run-Scope · 142 Non-Python Skill-Script Honesty · 143 Starter Workflow Library · 145 Run-Lifecycle Honesty + threads.py Extraction (FND-01). STRETCH deferred: 144 (FILE-01) → v3.3. 81 plans total. Full details: `.planning/milestones/v3.2-ROADMAP.md`.

- [x] Phase 132: Skill Versioning + Eval Test-Case Persistence (3/3 plans) — completed 2026-06-30
- [x] Phase 133: Eval Runner — With-Skill vs Without-Skill (5/5 plans) — completed 2026-06-30
- [x] Phase 134: Eval Results, Honest Verdict + Ratings (4/4 plans) — completed 2026-07-02
- [x] Phase 134.1: Evals Run Silently (bug fix — inserted during 134 UAT) (1/1 plans) — completed 2026-07-02
- [x] Phase 135: Self-Improvement Loop (SI-01) (9/9 plans) — completed 2026-07-02
- [x] Phase 136: Skill Publish Gate (GATE-01) (4/4 plans) — completed 2026-07-03
- [x] Phase 137: Skill Evals Panel UI (PANEL-01) (7/7 plans) — completed 2026-07-04
- [x] Phase 137.1: Skill Eval Production-Clean (10/10 plans) — completed 2026-07-04
- [x] Phase 137.2: Skill Creator Reborn — Built-in + Protected (4/4 plans) — completed 2026-07-04
- [x] Phase 138: Run-End Honesty (STRETCH) (5/5 plans) — completed 2026-07-06
- [x] Phase 139: Self-Improve Proposer — Description-Only (STRETCH) (5/5 plans) — completed 2026-07-06
- [x] Phase 140: Smart-Dispatch Relevance Pre-Filter (STRETCH) (5/5 plans) — completed 2026-07-07
- [x] Phase 141: template_input Resolver Run-Scope (STRETCH) (3/3 plans) — completed 2026-07-07
- [x] Phase 142: Non-Python Skill-Script Honesty (STRETCH) (5/5 plans) — completed 2026-07-08
- [x] Phase 143: Starter Workflow Library (STRETCH) (5/5 plans; core UAT proven live, A1+empty-folder deferred) — completed 2026-07-10
- [x] Phase 145: Run-Lifecycle Honesty + threads.py Extraction (STRETCH · FOUNDATION) (6/6 plans; SC#10 UAT 6/6) — completed 2026-07-10
- [ ] Phase 144: Agent-Driven Skill File Attachment (FILE-01) — DEFERRED → v3.3 (not executed)

</details>

<details>
<summary>v3.1 Workflow &amp; Skill Studio — Trust, Clarity &amp; Triggers (Phases 120-129) — SHIPPED 2026-06-28</summary>

CORE (6 phases + inserted 123.1): 120 Collision Fix + Context Isolation · 121 One Front Door · 122 Cross-Provider Trust & Honesty · 123 Skill Triggering Quality · 123.1 Trigger Tuner UX Polish · 124 Workflow Studio UX Soul + Strict↔Loose. STRETCH shipped: 127 Gauntlet Pip-Strip (code-verified/UAT partial) · 128 Chat Tool-Card Unification + Provider Logos · 129 MiniMax/OpenRouter Arg Repair. STRETCH deferred: 125/126/130/131. 40 plans total. Full details: `.planning/milestones/v3.1-ROADMAP.md`.

- [x] Phase 120: Collision Fix + Context Isolation (3/3 plans) — completed 2026-06-22
- [x] Phase 121: One Front Door for Workflows (IA) (2/2 plans) — completed 2026-06-23
- [x] Phase 122: Cross-Provider Trust & Honesty Parity (4/4 plans) — completed 2026-06-23
- [x] Phase 123: Skill Triggering Quality (6/6 plans) — completed 2026-06-26
- [x] Phase 123.1: Skill Trigger Tuner — Design Fidelity & UX Polish (10/10 plans) — completed 2026-06-25
- [x] Phase 124: Workflow Studio UX — Soul + Strict↔Loose (3/3 plans) — completed 2026-06-26
- [x] Phase 127: Gauntlet Pip-Strip + Quiet Idle Cards (3/3 plans) — code-verified 2026-06-27
- [x] Phase 128: Chat Tool-Card Unification + Chat-Area Reclaim (6/6 plans) — completed 2026-06-27
- [x] Phase 129: MiniMax/OpenRouter Arg Repair (3/3 plans) — completed 2026-06-27

</details>

<details>
<summary>v3.0 Document Management (Phases 110-119) -- SHIPPED 2026-06-21</summary>

- [x] Phase 110: DM Foundations (2/2 plans) -- completed 2026-06-15
- [x] Phase 111: Metadata Enrichment — Extraction Backend (5/5 plans) -- completed 2026-06-16
- [x] Phase 111.1: Configurable / Multi-Provider Embeddings (6/6 plans) -- completed 2026-06-17
- [x] Phase 112: Metadata Enrichment — Detail Panel + Manual Edit (4/4 plans) -- completed 2026-06-18
- [x] Phase 113: Virtual Folders — Filter Compiler + Equality (Backend) (3/3 plans) -- completed 2026-06-18
- [x] Phase 114: Virtual Folders — Range/Date + Builder + Sidebar (6/6 plans) -- completed 2026-06-19
- [x] Phase 115: Virtual Folders — Agent Tool (3/3 plans) -- completed 2026-06-20
- [x] Phase 116: Document Relationships — Backend + Agent Tool (5/5 plans) -- completed 2026-06-20
- [x] Phase 117: Document Relationships — Panel UI (4/4 plans) -- completed 2026-06-20
- [x] Phase 118: Auto-Classification (6/6 plans) -- completed 2026-06-21
- [x] Phase 119: Document Governance Health (2/2 plans) -- completed 2026-06-21

</details>

<details>
<summary>v2.9 Workflow Studio (Phases 097-104 CORE) -- SHIPPED 2026-06-15</summary>

- [x] Phase 097: Spike — Risk-Register Template-Fill + Authoring Feel (5/5 plans) -- completed 2026-06-08
- [x] Phase 098: Project Binding + Server-Side KB Scope Governance (5/5 plans) -- completed 2026-06-09
- [x] Phase 099: Workflow ↔ Skill Composition (6/6 plans) -- completed 2026-06-10
- [x] Phase 100: Ephemeral Template Upload (6/6 plans) -- completed 2026-06-10
- [x] Phase 101: Template-Fill + Integrity Validation (5/5 plans, via 101.1) -- completed 2026-06-12
- [x] Phase 101.1: Guaranteed Structured Emission Layer (10/10 plans; verify-work 19/19 + secure 36/36) -- completed 2026-06-12
- [x] Phase 102: Reusable Validation-Gate Library + Output-Quality Gate (9/9 plans; verify-work 7/7 + secure 34/34) -- completed 2026-06-13
- [x] Phase 103: Workflows Page + Authoring API + NL Authoring (6/6 plans; secured 32 threats/0 open) -- completed 2026-06-14
- [x] Phase 104: PM Flagship Content Pack (3/3 plans; secured 15/0 + nyquist + live UAT 5/5) -- completed 2026-06-15

STRETCH (deferred to backlog, never started): 105 Scheduled Triggers + Budget Caps · 106 Citation-Traceable Grid Renderer · 107 Per-Run Provenance Receipt · 108 Plugin Contract Lock · 109 Operator/Admin Role Tier.

</details>

<details>
<summary>v1.0 Knowledge Base Explorer (Phases 1-8) -- SHIPPED 2026-03-29</summary>

- [X] Phase 1: Folder Schema & Core APIs (2/2 plans) -- completed 2026-03-21
- [X] Phase 2: Document-Folder Integration (2/2 plans) -- completed 2026-03-21
- [X] Phase 3: Ingestion UI (3/3 plans) -- completed 2026-03-21
- [X] Phase 4: Navigation Tools (2/2 plans) -- completed 2026-03-22
- [X] Phase 5: Search Tools (2/2 plans) -- completed 2026-03-21
- [X] Phase 6: Read Tool (2/2 plans) -- completed 2026-03-22
- [X] Phase 7: Explorer Sub-Agent (2/2 plans) -- completed 2026-03-22
- [X] Phase 8: Folder System Enhancements (3/3 plans) -- completed 2026-03-28

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>v2.0 Agent Skills & Code Execution (Phases 9-17) -- SHIPPED 2026-04-04</summary>

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>v2.1 Stability & RAG Correctness (Phases 18-25) -- SHIPPED 2026-04-11</summary>

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

<details>
<summary>v2.2 Trust & Compliance (Phases 26-32) -- SHIPPED 2026-04-16</summary>

Full details: `.planning/milestones/v2.2-ROADMAP.md`

</details>

<details>
<summary>v2.3 Memory, Multimodal & Experience (Phases 33-43) -- SHIPPED 2026-04-19</summary>

Full details: `.planning/milestones/v2.3-ROADMAP.md`

</details>

<details>
<summary>v2.4 Stability, Polish & UX Fixes (Phases 44-57) -- SHIPPED 2026-04-30</summary>

Full details: `.planning/milestones/v2.4-ROADMAP.md`

</details>

<details>
<summary>v2.5 Deployment Strategy (Phases 058-067.5) -- SHIPPED 2026-05-09</summary>

Full details: `.planning/milestones/v2.5-ROADMAP.md`

</details>

<details>
<summary>v2.6 Foundation: RAG Quality + Multi-Worker + Polish (Phases 068-082) -- SHIPPED 2026-05-27</summary>

35 phases (068-082 including inserts), 91 plans complete. See `.planning/milestones/v2.6-phases/` for archived phase directories and `.planning/MILESTONES.md` for the full close-out narrative.

</details>

<details>
<summary>v2.7 Agent Workspace & Panel (Phases 083-088) -- SHIPPED 2026-05-30</summary>

6 phases (083-088), 28 plans, 50 tasks complete. Per-thread workspace filesystem (write/read/list/delete/version/diff, hybrid inline/Storage), 3 new agent tools (`write_todos`, `task` sub-agents, `ask_user` pause/resume via Redis pub/sub), the right-side collapsible workspace panel (todos · file browser · version diff · ask_user seam), and WCAG 2.1 AA across all panel surfaces. Full phase details: `.planning/milestones/v2.7-ROADMAP.md`. Close-out narrative + decisions: `.planning/MILESTONES.md`.

- [x] Phase 083: Foundation -- Tool-Dispatch Extraction + Bug Fixes (3/3 plans) -- completed 2026-05-27
- [x] Phase 084: Workspace Filesystem Backend (5/5 plans) -- completed 2026-05-28
- [x] Phase 085: New LLM Tools (5/5 plans) -- completed 2026-05-28
- [x] Phase 086: StreamsProvider Extension + Panel Hooks (2/2 plans) -- completed 2026-05-29
- [x] Phase 087: Panel UI (8/8 plans) -- completed 2026-05-29
- [x] Phase 088: Cross-Cutting Verification + Accessibility (5/5 plans) -- completed 2026-05-30

</details>

<details>
<summary>v2.8 Harness Engine & Workflow Mode (Phases 089-096) -- SHIPPED 2026-06-07</summary>

10 phases (089-096, incl. inserted refactor 092.5 + inserted live-UAT phase 095.1), 67 plans complete. A deterministic, auditable workflow runtime -- locked ordered phases + dispatcher-enforced per-phase tool whitelists + validation gates with bounded retry + Postgres-resumable phase state, plus a per-thread Deep/Harness dual-mode toggle and a live WCAG 2.1 AA phase-timeline in the workspace panel. The harness is ~80% composition of shipped primitives with zero new deps; Deep Mode stayed byte-identical (the red line). Mid-milestone rescope (discuss-093) inserted 092.5 (provider-gateway extraction) + 095.1 (cross-provider run honesty). Full details: `.planning/milestones/v2.8-ROADMAP.md`. Close-out narrative + decisions: `.planning/MILESTONES.md`.

- [x] Phase 089: Agent-Loop Extraction (G-5) + Kickoff UAT (4/4 plans) -- completed 2026-05-30
- [x] Phase 090: Harness Schema + RLS + Config Models (3/3 plans) -- completed 2026-05-31
- [x] Phase 091: Harness Engine + 5 Phase Types + Gates + Whitelist (8/8 plans) -- completed 2026-05-31
- [x] Phase 092: Dual-Mode Wiring + Continue Button (7/7 plans) -- completed 2026-06-01
- [x] Phase 092.5: Provider Gateway Extraction (6/6 plans) -- completed 2026-06-01
- [x] Phase 093: Harness Cross-Provider Parity + Phase-Type Hardening (9/9 plans) -- completed 2026-06-03
- [x] Phase 094: Workflow Legibility + Mode Clarity (5/5 plans) -- completed 2026-06-04
- [x] Phase 095: Chat Tool-Card Unification (9/9 plans) -- completed 2026-06-06
- [x] Phase 095.1: Cross-Provider Run Honesty & Workspace Parity (7/7 plans) -- completed 2026-06-06
- [x] Phase 096: Eval Harness + Cross-Provider Verification + Concurrency (9/9 plans) -- completed 2026-06-07

</details>
