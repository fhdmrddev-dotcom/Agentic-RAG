# Agentic-RAG: platform architecture, plugin strategy and work qualification

**Date:** 2026-09-18
**Prepared by:** Claude (chat surface), reading the repo through the GitHub connector
**For:** commercial and roadmap decisions, and as input to the next milestone (phases resume at 247)
**Covers:** architecture (§1), challenges (§2), opportunities (§3), plugin catalogue (§4), work
qualification (§5), licensing (§6), sequencing (§7), the public-sector route and what it demands
(§9 to §11)
**Repo state read:** `main` as published 2026-09-18. Milestone v4.1 closed and archived 2026-09-13.

---

## 0. Method and confidence

This is an outside read. No working tree, nothing executed, no frontend inspected.

**Read in full this pass:** `.planning/STATE.md` (v4.1 close), directory listings for
`backend/app/services/`, `backend/app/services/connectors/`, `backend/app/services/harness/`,
`backend/app/models/`. **Read in an earlier pass, against a v3.6-era tree and therefore possibly
stale:** `backend/app/models/harness.py`, `services/SEAM.md`, `harness/programmatic.py`,
`SEED-013`, `SEED-141`, `SEED-145`, `SEED-146`, `SEED-136`, `backend/.env.example`.

**Not read:** `PROJECT.md` (174 KB), `ROADMAP.md`, `MILESTONES.md`, the whole frontend, every
service body. Anything about current sequencing is therefore a proposal to slot into your plan,
never a replacement for it.

Markers used below: **[VERIFIED]** read directly. **[INFERRED]** deduced from two or more sources.
**[UNVERIFIED]** plausible, check first.

---

## 1. The architecture as it actually stands

### 1.1 The layer map

Reading the service listing rather than the documentation, the system already separates into layers.
This is the map a plugin strategy has to respect.

| Layer | What is in it | Extension posture today |
|---|---|---|
| **Model access** | `model_registry`, `model_discovery_service`, `provider_gateway/`, `openai_service`, `anthropic_service`, `run_model_resolution`, `sub_agent_models` | **Open.** 8 cloud providers plus Ollama and LM Studio |
| **Knowledge** | `embedding_service`, `retrieval_service`, `retrieval_tuning`, `rerank_service`, `ingest_enrich`, `ingest_splice`, `ingestion_queue_service`, `extractors/`, `multimodal_service`, `reembed_service` | **Semi-open.** Extractors are a directory; retrieval is configured, not extended |
| **Sources** | `sources/`, `watch_service`, `google/`, `email_extraction_service`, `email_attachments` | **Open by family.** v4.0 unified Drive, Graph, MCP file servers and mail on one browse/list/read/check contract |
| **Connections** | `connector_service` (89 KB), `connectors/` with `registry`, `protocol`, `descriptors`, `grants`, `org_scope`, `chat_tools`, `service_tools`, plus `jira`/`slack`/`smtp` adapters | **Open by adapter.** A protocol and registry exist |
| **MCP** | `mcp_client`, `mcp_auth_discovery`, `mcp_oauth`, `mcp_token` | **Open.** Client side built |
| **Agent** | `agent_loop` (192 KB), `tool_dispatcher` (256 KB), `context_window`, `sub_agent_service`, `ask_user_service` | **Closed.** Tool registry resolved at import |
| **Workflow** | `harness_engine` (180 KB), `harness/` with `phase_types`, `validators`, `validator_kinds`, `grounding`, `emitters`, `emit_policy`, `programmatic`, `scope`, `reachability`, `publish_service`, `skill_snapshot`, plus `workflow_authoring`, `workflow_kickoff` | **Deliberately closed.** Seven executors, held across thirteen phases |
| **Skills** | `skill_catalog_filter`, `skill_embedding_service`, `skill_lint`, `skill_proposer_service`, `skill_tuner_service` | **Open, and user-facing.** Teachable, persistent, shareable |
| **Execution** | `sandbox_service`, pinned `agentic-rag-sandbox` image | **Open, isolated.** |
| **Governance** | `governance_service`, `publish_gate_service`, `audit_service`, `harness/grounding`, `citation_markers`, `forced_emit` | **Closed.** The product claim lives here |
| **Assurance** | `eval_runner_service` (45 KB), `eval_aggregation`, `recall_eval` (47 KB) | **Built, under-exploited commercially** |
| **Orchestration** | `scheduler_service`, `run_lifecycle`, `run_producer`, `run_reconciler`, `run_transport`, `task_service`, `circuit_breaker` | **Closed.** |
| **Tenancy and identity** | `workspace_service`, `operator_service`, `invitation_service`, `sso_provider_service`, `sso_domain_blocklist`, `oauth_*` | **Partial.** SAML SSO present, org multi-tenancy dormant |
| **Setup and operations** | `setup_service`, `setup_store`, `health_probe`, `logging_sink`, `settings_broadcast` | **Present** |

**[VERIFIED]** from the listing. Sizes are from the same listing.

### 1.2 The finding that matters most for a plugin strategy

**You already run two extension philosophies, and the split is coherent.**

- **Open at the edges.** Providers, source families, connector adapters, MCP servers, skills,
  extractors. Each has a registry, a protocol or a directory, and new members arrive without
  engine changes.
- **Closed at the core.** Workflow executors, emitters, validators, programmatic functions, agent
  tools. Names resolve against dictionaries fixed at import. Nothing is evaluated dynamically.

The closed core is not a limitation to be engineered away. **It is the product claim.** `STATE.md`
records graded per-node governance, enforced at run time so it cannot be loosened by whoever
authors the content, as the differentiator, and reports that a competitive crawl of Beam, Glean and
n8n found none of them grading strictness by grounding.

The moment a third party can register an executor, an emitter or a validator, that claim is gone.
Not weakened. Gone, because it was a claim about what is structurally impossible.

### 1.3 The rule I would put at the centre of the plugin strategy

> **A plugin is data, an external process, or sandboxed code. Never engine code.**

All three mechanisms are already built:

| Mechanism | Already exists as | What a plugin can be |
|---|---|---|
| **Data** | skills, workflow definitions, templates, metadata schemas, classification rules, view filters | Vertical packs, prompt sets, starter workflows, document schemas, report templates |
| **External process** | MCP client, with `skill_snapshot` as the precedent for pinning a schema at publish | Any third-party tool surface, versioned and drift-checked |
| **Sandboxed code** | `sandbox_service`, pinned image | Customer transforms, parsers, calculations |

A plugin system built only on those three adds a commercial surface without touching the trust
boundary. That is the whole strategy in one line, and it is available to you now.

### 1.4 Three files are the obstacle

`tool_dispatcher.py` at 256 KB, `agent_loop.py` at 192 KB, `harness_engine.py` at 180 KB. Also
`openai_service.py` at 110 KB and `connector_service.py` at 89 KB.

A core-plus-layers product needs a core you can name, version and license separately. **You cannot
draw a boundary through a 256 KB module.** `STATE.md` also records that `retrieval_service.py`'s
G-5 extraction has been owed since Phase 231 and deliberately landed twice without it, and that
`connectors.py` took a fifth landing with the split proposed and declined again, with the note that
a sixth propose-and-decline is the pattern deferral exists to stop.

**[INFERRED]** This is the single biggest technical obstacle between where you are and a
licensable core. It is also the least glamorous item in this document.

---

## 2. Challenges

Ordered by how much they constrain the commercial plan.

### C1. Deployment. **[VERIFIED]**

`origin/production` is 287 commits behind `develop`. The entire output of v4.1 is undeployed, and
`STATE.md` names this as the state v4.1 was opened to end for v4.0. So it has now happened at two
consecutive closes. Migrations 179 and 180 are measured absent from cloud, with the note that a
promotion carrying the code without them breaks on arrival. Non-code deploy parity is also owed
from Phase 242.

**Commercial consequence:** a plugin or pack strategy multiplies what must ship correctly. Adding
an extension surface on top of a pipeline that has not promoted in two milestones makes the next
promotion worse. **This gates everything below it.**

### C2. Multi-tenancy. **[VERIFIED]**

`SEED-004` is dormant, and has been for two milestones. Against it sit `SEED-124`, `SEED-125`,
`SEED-129` and `SEED-091`, each describing service-role reads that bypass org scoping. Four
discoveries of one shape is one architectural gap, not four bugs.

`connectors/org_scope.py` exists, which is encouraging and suggests the connector layer was built
with scoping in mind. Whether that discipline is systemic is **[UNVERIFIED]**.

**Commercial consequence:** you cannot license per-org packs, run a hosted multi-tenant offering,
or pass an enterprise security review until this is settled. It is also the failure that ends a
company rather than costing a sprint.

### C3. No metering, so no pricing. **[VERIFIED from seed titles]**

`SEED-073` (token-to-USD cost registry), `SEED-074` (harness token rollup), `SEED-080` (entitlement
gating), `SEED-083` (capability tier packaging), `SEED-120` (per-org BYO provider keys). None built.

**Commercial consequence:** tiers and packs are unpriceable and unenforceable. Retrofitting cost
attribution across a shipped plugin surface is far harder than building it in. Entitlement gating
is also the mechanism by which a pack is a pack rather than a folder of files.

### C4. Register integrity. **[VERIFIED]**

`STATE.md` calls this the recurring defect, now twice in consecutive milestones: a ROADMAP table
reading zero of five phases complete with all five closed, and the same class in v4.0's requirement
count. Eight duplicate seed IDs across 280 seeds, so a reference by ID cannot be resolved. 161
planted seeds, with the note that at that number the `trigger_when` sweep is a phase of work rather
than a step in a command.

**Commercial consequence:** indirect but real. A partner ecosystem needs a stable reference
vocabulary. If your own IDs do not resolve, a published extension API will inherit that.

### C5. Verification debt and the solo-run history. **[VERIFIED]**

Independent §6.3 review owed by 238, 240 and 241. `OV-SOLO-01` re-armed 2026-09-13 now that Gemini
is available, with the explicit note that re-arming does not retro-review anything and those phases
stay self-verified with review owed. Backend unit tests sit at a ceiling of 71 failed against 4491
passed.

**Commercial consequence:** enterprise procurement asks how you assure your own releases. A
solo-developed product needs a better answer than "the builder reviewed it".

### C6. The monoliths. **[VERIFIED]**

See 1.4. Three files over 180 KB, with two extraction debts recorded and repeatedly declined.

### C7. Retrieval recall at small-tenant scale. **[VERIFIED]**

`RECALL-01` is unmet and recorded as a finished decision. Phase 246 proved by query plan that no
`hnsw_ef_search` value fixes the cliff through the index: 40, 60 and 80 give an index scan
returning one row at roughly 0.05 recall in about 4 ms; 100, 150 and 200 fall to a sequential scan
with recall 1.000 at roughly 1,100 ms. Default reverted to 40. Re-open path is `SEED-273`
(`hnsw.iterative_scan`).

**Commercial consequence:** a small tenant in a large shared corpus gets bad retrieval, and the
degradation is a cliff rather than a slope, crossable with no deploy and no setting change. For a
multi-tenant offering this is a correctness problem wearing a performance costume.

### C8. Operational honesty in the connection surface. **[VERIFIED by live inspection, 2026-09-18]**

A Google Workspace connection row showed `status = active`, `last_check_verdict = not_checked`,
displayed "Credential OAuth connected" in the UI, and had a null `secret_ciphertext`. Twenty-seven
tools were discovered against a token that was never persisted. Separately, an input in the
connection panel appears to serve as both an identity display and a filter over the action list,
and an empty action list gives no indication whether it is genuinely empty or filtered.

**Commercial consequence:** the third item cost two people with database access several rounds to
diagnose. A customer would report the feature as broken. For a product sold on trustworthy
behaviour, a connection that reports healthy while unusable is the worst available bug class.

### C9. Local model handling is manual. **[VERIFIED]**

`SEED-172` fired at the v4.1 close from lived friction: a local Ollama or LM Studio model must be
added by hand, with timeout and context window configured by hand, because `POST /admin/models`
validates its provider argument against the eight-cloud SSRF discovery allowlist rather than the
routing roster. Skipping the manual step is not cosmetic, because an id absent from
`MODEL_CAPABILITIES` resolves `capability_source = inferred` and silently loses `native_tools`,
which short-circuits above every tool gate.

**Commercial consequence:** this is the sovereign and on-premise story, which is the strongest
regional angle available. It currently has a manual step with a silent failure mode.

---

## 3. Opportunities

### 3.1 What the market signal says

From the AI Everything Abu Dhabi innovation showcase, 6 and 7 October 2026, ADNEC. Treat the copy
as marketing and the award lists as unverified, but the categories are informative.

**Airia is the closest competitor and should be added to your competitive record.** Described as a
unified enterprise platform for discovering, governing, securing and orchestrating AI models, tools
and agents, with runtime guardrails, policy enforcement and audit-ready governance. Reported
winners of the Gold Globee for Best Agentic Workflow Orchestration Platform and a Globee for Best
Data Management and Governance Platform. **`STATE.md`'s crawl covered Beam, Glean and n8n. Airia was
not in it, and Airia is the one making your claim.**

**NENNA.AI** sells a GDPR-compliant layer that masks sensitive information before it reaches a
model. That is a pre-model filter, which is a plugin seam, and `SEED-079` covers the same ground
unbuilt.

**KnowGuard EMOS** is a model-agnostic memory and reasoning layer over contracts, invoices and
operational data that identifies financial leakage while preserving evidence and provenance, with a
reported MVP finding 8 million dollars of recoverable leakage across 401 million in invoice data
in 24 hours. Provenance is your citation model. **This is your review-against-a-standard shape,
packaged for one vertical, with a number attached.** It is the clearest proof that vertical packs
sell better than horizontal platforms.

**ASUS Ascent GX10** moves demanding workloads off cloud servers into a secure private local
environment, purpose-built to run, fine-tune and deploy large models and long-running agents
locally. Confirms sovereign and on-premise appetite, which is where `SEED-172`, `SEED-003` and
your local-model work all point.

**OCR Studio ID-Verify** confirms document understanding and identity extraction as a paid
category.

**Crane AI Labs** made the list with compact models fine-tuned for Swahili and Luganda. Language
and cultural fit is a recognised differentiator, and **AI Government is a whole sector track at
this show**.

### 3.2 The structural opportunities

**O1. Governed extensibility is an unoccupied position.** Everyone sells orchestration. Airia
sells governance over models and agents. Nobody visible sells a platform where the extension
surface is deliberately incapable of loosening policy. Your closed core plus open edges is a
marketing story as well as an architecture, and it is true today.

**O2. Assurance is unsold.** You have `eval_runner_service`, `eval_aggregation` and `recall_eval`,
which is roughly 106 KB of evaluation machinery. Nothing in that showcase sells proof that the
deployed AI works. For government procurement that is a requirement, not a feature.

**O3. Vertical packs are almost entirely data.** Starter workflow definitions, emitters chosen from
the existing registry, validators from the existing kinds, a metadata schema, templates. That means
**partners could build them without touching your code**, which is the whole point of a plugin
economy.

**O4. Sovereign and Arabic.** Self-hosting plus local models plus bilingual output plus a
government sector track in your own region. This is a combination very few competitors have.

**O5. Two MCP directions is a distribution story.** Client side is built. Server side turns every
MCP-aware tool into a surface for your knowledge base without you building a client.

---

## 4. Plugin and pack catalogue

Every candidate below is classified by the 1.3 rule: **D** data, **X** external process, **S**
sandboxed code, **E** requires engine work.

| # | Candidate | Type | Rests on | Note |
|---|---|---|---|---|
| P1 | **Vertical pack format** (workflows, templates, schema, validators as one installable unit) | D | publish, entitlement | The SKU everything else hangs from |
| P2 | Finance close and reporting pack | D | P1, period filtering | Needs the filter-not-prompt rule below |
| P3 | Contract and playbook review pack | D | P1, eval runner | Measured on recall, not output quality |
| P4 | RFP and security questionnaire pack | D | P1, attachments | Strongest commercial profile, see 5.2 |
| P5 | Tender and procurement pack (regional) | D | P1 | Government track fit |
| P6 | Privacy and redaction layer | E | pre-model hook | `SEED-079`. NENNA shape |
| P7 | OCR and document understanding | S or X | extractors | Fits the extractors directory |
| P8 | Assurance and evidence pack | D + E | eval runner, export | O2. Export is the missing half |
| P9 | Sovereign deployment pack | E | `SEED-003`, `SEED-172` | Install UX plus local models |
| P10 | Arabic and bilingual pack | D | templates, emitters | Regional differentiator |
| P11 | Partner MCP directory | X | snapshot at publish | Zero engine risk, real breadth |
| P12 | Connector adapter SDK (third-party adapters) | E | `connectors/protocol.py` | The protocol already exists |
| P13 | Notification and attention surface | E | `SURF-03` | Recorded as an open product question |
| P14 | Report and deliverable distribution (attachments) | E | payload path | Blocks P2 and P4 |

---

## 5. Qualification

### 5.1 Quick wins

Small, mostly bounded, and each unblocks something larger.

| Item | Why it qualifies | Rests on |
|---|---|---|
| **Fix the connection honesty bugs (C8)** | Three defects found live in one session. The empty-state feedback one is hours of work and removes a whole support category | Nothing |
| **Add Airia to the competitive record** | One paragraph. Your differentiator claim currently rests on a crawl that missed the company making the same claim | Nothing |
| **`SEED-172`: accept local models in the admin endpoint** | Validate against the routing roster rather than the SSRF discovery allowlist. Already named leading candidate for the next milestone. Removes a manual step with a silent capability loss | Nothing |
| **Resolve the 8 duplicate seed IDs** | Mechanical. Makes every ID reference in every document resolvable | Nothing |
| **Name the architecture publicly** (open edges, closed core) | Documentation and positioning, not code. It is already true | Nothing |
| **Group the action-grant surface by application** | Google discovery already tags each tool with its app. 27 Google plus 40 Notion tools in a flat list is unusable | Nothing |

### 5.2 Low-hanging fruit

Real work, but short, and each is worth more than its size.

| Item | Why it qualifies | Rests on |
|---|---|---|
| **Attachments on outbound payloads (P14)** | Payloads are text only, so a workflow that produces a document cannot deliver it. Two of your seven use-case shapes have no ending without this | Payload path |
| **Metering: `SEED-073` plus `SEED-074`** | Weeks, not months, and nothing can be priced until it exists. Cheapest now, hardest later | Nothing |
| **Vertical pack format (P1)** | Mostly a manifest, an installer and an entitlement check over things that already exist. Turns your content into SKUs | Entitlement |
| **Assurance export (P8)** | The evaluation machinery exists. What is missing is an evidence artifact a buyer can put in a procurement file | Eval runner |
| **Period and version filtering discipline** | Where a dimension has the property that close means wrong, it must be a structured filter and an empty result must fail the phase. Blocks P2 | Metadata, views |
| **RFP and questionnaire pack (P4)** | Once attachments land. Acute pain, existing budget line, and every answer needing a citation is your architecture rather than a feature to add | P14, P1 |

### 5.3 Future roadmap

Milestone-sized, sequenced, each with a real prerequisite.

| Item | Why it is here | Gate |
|---|---|---|
| **Close the deployment gap permanently (C1)** | 287 commits, two consecutive closes. Arguably the whole next milestone | First |
| **Org multi-tenancy with a mechanical fence (C2)** | One rule and a test fence, in the shape `harness.py` already uses for tool disjointness, rather than four individual fixes | Before any hosted offering |
| **Entitlement and tier packaging (`SEED-080`, `SEED-083`)** | The mechanism that makes a pack a pack | After metering |
| **Per-org BYO provider keys (`SEED-120`)** | Enterprise buyers ask for it by name, and it shifts model cost to the customer | After multi-tenancy |
| **Connector adapter SDK (P12)** | The protocol and registry exist. Publishing them is a support and versioning commitment, not just a doc | After multi-tenancy |
| **Privacy and redaction layer (P6)** | Genuine engine work at a real seam. Sellable as a compliance add-on | After the core split |
| **Sovereign deployment pack (P9)** | Install UX, backup and restore, air-gap. Strongest regional angle, largest surface | After deployment is solved |
| **Extract the monoliths (C6)** | 256 KB, 192 KB and 180 KB. Prerequisite to licensing a core separately. Do it incrementally under the existing propose-first rule | Ongoing |
| **Notification surface (`SURF-03`, P13)** | Recorded as an open scoping decision. Needed by triage and monitoring use cases | Product decision first |
| **Partner MCP directory (P11)** | Snapshot schemas at publish, mirroring `skill_snapshot`. Breadth without engine risk | After the snapshot decision |

### 5.4 Out of scope

Say these out loud so they stop consuming attention.

| Item | Why it is out |
|---|---|
| **Third-party executors, emitters or validators** | Destroys the governance claim by construction. The three legitimate mechanisms in 1.3 cover the real need |
| **A generic HTTP egress node** | The architecture exists to make arbitrary egress unrepresentable. If it ever arrives it is a separate phase type with its own gate story, never a fourth capability name |
| **Branching and looping workflow graphs** | Milestone-sized, breaks resumability, reachability and the publish gate. Forward-only jumps are the minimal move if it is ever revisited. Not now |
| **Building your own models** | Crane AI Labs is a model company. You are a platform. Fine-tuning is a partner's job |
| **Exhibiting at AI Everything on 6 October** | Under three weeks out. Walking it and talking to Airia and KnowGuard is worth more than a rushed pod |
| **Chasing `RECALL-01` through `hnsw_ef_search`** | Settled by query plan in Phase 246. Re-open only via `SEED-273` (`hnsw.iterative_scan`), and only by inspecting a plan rather than a recall number |
| **A public API before `SEED-001`** | `SEED-013` warns a public API amplifies every backend bug and that one misbehaving consumer can trivially DoS a single-worker backend |
| **Retro-reviewing phases closed under solo running** | `STATE.md` settles this. Those debts stay owed and listed. Re-arming the rule does not retro-review anything |

---

## 6. Licensing and packaging

A proposal, not a recommendation. Every line depends on C2 and C3.

**Core**, licensed as the base: agent, knowledge base, retrieval, harness, governance, skills,
sandbox, the built-in connector families.

**Capability tiers**, gated by `SEED-080`: number of connections, workflow runs, scheduled runs,
sub-agent fan-out, evaluation runs.

**Packs**, licensed individually: the verticals in P2 through P5, plus P10. Mostly data, which is
what makes them cheap to produce and possible for partners to build.

**Layers**, licensed as add-ons: privacy and redaction, assurance and evidence, OCR, sovereign
deployment. These are engine work and stay yours.

**Partner surface**, unpriced at first: MCP directory and the connector adapter SDK. Breadth is
worth more than revenue early.

**Deployment models:** hosted multi-tenant, which needs C2 settled; single-tenant managed; and
self-hosted or air-gapped, which is the sovereign pack and probably your highest-value segment
regionally.

Two things to decide early because they are expensive to reverse. Whether the number of Projects,
connections or runs becomes the pricing metric, since `STATE.md` shows metrics get chosen by
accident otherwise. And whether packs are versioned independently of the core, because a pack that
must match a core version is not really a plugin.

---

## 7. Suggested sequencing

Offered to slot into your plan, not to replace it. `ROADMAP.md` and `MILESTONES.md` were not read.

1. **Deployment** (C1). It has blocked two consecutive closes and it gates everything here.
2. **Quick wins from 5.1** alongside it. Independent, small, and `SEED-172` is already a named
   candidate for the next milestone.
3. **Metering** (C3). Before any pricing surface exists.
4. **Org scoping with a mechanical fence** (C2). Before any hosted or per-org offering.
5. **Attachments, then the pack format, then one pack** (P14, P1, P4). The first commercial proof.
6. **Assurance export** (P8). The procurement differentiator nobody else is selling.
7. **Sovereign pack and the partner surfaces**. The regional play, once the base is deployable.

Two standing constraints carried from `STATE.md`, easy to lose in a large milestone: no outbound
capability may be added to `_TOOL_REGISTRY` before the approval model exists, and migrations 179 and
180 must land with the code that needs them.

---

## 9. The public-sector route, and what it demands of the engineering

Added 2026-09-18 at operator direction. **This section exists to convert a market position into
engineering requirements.** The commercial detail is here so the technical items in §10 can be
traced to a reason, not because the roadmap should be driven by marketing.

All market claims below are **[UNVERIFIED]** web-sourced as of 2026-09-18 and should be confirmed
against primary sources before anything is committed to a milestone.

### 9.1 The demand is mandated, with a deadline

- **Federal, April 2026:** a UAE Cabinet plan to migrate **50% of federal government services to
  autonomous AI systems within two years.**
- **Dubai:** a mandate to integrate government services into a single AI-powered digital ecosystem
  **within one year**, covering finance, HR, payroll, procurement, contracts, asset management and
  maintenance.
- **Abu Dhabi:** the Government Digital Strategy 2025 to 2027, **AED 13 billion** in deployment
  funding, targeting the world's first fully AI-native government.
- **Procurement is being primed:** Digital Dubai's AI+ Program ran a leadership track for
  procurement directors across **44 Dubai government entities**.

**What this means for engineering:** dozens of entities must buy agentic systems before they are
comfortable doing so. The winning property is not capability. It is **provable restraint** under
audit. That is the product this codebase already is.

### 9.2 Why this architecture fits this buyer specifically

Public commentary on the Dubai mandate makes the gap explicit: deploying agentic AI requires the
data architecture, API integrations, security frameworks and monitoring systems that let agents
operate safely inside existing business processes, and most organisations have not built that.

Four properties already in the tree answer that directly:

| Property | Where it lives | What it answers for a government buyer |
|---|---|---|
| Governance that content authors cannot loosen | `harness/grounding`, `governance_service`, `publish_gate_service` | "How do we know an agent will not exceed its remit?" |
| Citation and confidence on every claim | `citation_markers`, `forced_emit`, `models/message.py` | "How is an automated answer defensible after the fact?" |
| Self-hosting and local models | `SEED-003`, `SEED-172`, Ollama and LM Studio support | "Our records cannot go to a cloud model." |
| Evaluation and recall measurement | `eval_runner_service`, `recall_eval`, `eval_aggregation` | "Prove it works before we deploy it." |

**The strategic observation:** the published guidance for founders approaching UAE government
customers lists data protection, cybersecurity, procurement requirements, hosting arrangements,
human oversight and the appropriate level of autonomy. **Every one of those maps to an existing
seed.** The procurement checklist and this roadmap are close to the same document, which means
selling into this segment does not require a detour from the engineering plan.

### 9.3 Routes in (operator actions, not engineering)

| Route | Why it fits | Note |
|---|---|---|
| **Dubai Future Foundation / Area 2071** | Hosts startups and government entities together; Dubai Future Accelerators has connected startups with entities to co-develop and pilot public-sector solutions | Closest fit. A pilot with a named entity beats any grant, because it produces a reference customer |
| **MBRIF** | Government-focused businesses gain commercial advantage through its public-sector relationships | Second |
| **Hub71 (Abu Dhabi)** | Zero-equity package; Hub71+ AI backed by AWS, Google for Startups, AI71 and Core42 with compute access | Compute matters for the local-model direction. Requires Abu Dhabi presence |
| **ADIO** | Payroll and high-tech capex rebates from an AED 2 billion pool | Growth stage, later |
| **Dubai AI Campus (DIFC)** | Highest AI founder density | Ecosystem, not funding |
| **AI Everything / AI StartX / Supernova** | The innovation showcase route | An exhibitor route, not a government endorsement. Not in three weeks |

⚠ Cash grants from bodies such as Khalifa Fund largely prioritise Emirati founders. Non-Emirati
founders route through incubators and incentive programmes instead.

### 9.4 ⛔ Two operator blockers that precede all engineering

**These are not Claude Code's to action. They are recorded here because they gate the value of
everything in §10.**

1. ⛔ **No legal entity exists.** Every programme requires UAE registration, mainland or a free zone
   such as ADGM or DIFC, and many assess In-Country Value. Nothing in §9.3 is reachable without it.
2. ⛔ **The employment and IP position is unsettled.** The operator works in Digital Transformation
   at a firm delivering government projects to the same buyer set, in the same category, in the same
   emirate. Ownership of this code under the employment contract, permission to commercialise it,
   and handling of customer overlap all need written certainty **before** any government entity or
   accelerator is approached. This requires a lawyer. It is the single item most likely to end the
   plan after significant investment, and it becomes harder to unwind over time.

---

## 10. Procurement readiness, mapped to existing work

**This is the actionable half of §9.** Each row is a question a government security or procurement
review will ask, mapped to what already exists and what is missing. Nothing here is new scope: it
is the §5 work, re-ordered by what a public-sector buyer blocks on.

| Review question | Exists | Missing | Seeds |
|---|---|---|---|
| Is one tenant's data reachable from another? | `connectors/org_scope.py`, RLS at the v4.0 source sites | Systemic audit; four service-role leak findings open | `SEED-004`, `SEED-124`, `SEED-125`, `SEED-129`, `SEED-091` |
| Can this run on our infrastructure, air-gapped? | Self-host, Docker, Ollama and LM Studio | Install UX, local-model admission, backup and restore | `SEED-003`, `SEED-172`, `SEED-075` |
| Where does our data go, and does it leave? | Closed capability set, `_TOOL_REGISTRY` discipline, approval postures | Egress statement as a document; DLP | `SEED-079` |
| Is personal data protected (PDPL)? | Secrets encrypted at rest | Redaction, data subject rights, retention | `SEED-079`, `SEED-072` |
| How do we know the AI is right? | `eval_runner_service`, `recall_eval`, citation policy | An evidence artifact a buyer can file | P8 in §4 |
| Who approved what the agent did? | `audit_service`, `default_approval_posture`, `tool_grants` | Exportable audit trail | — |
| Can a person stay in the loop? | `ask_user_service`, approval arming | Notification surface | `SURF-03` |
| Does retrieval degrade at our scale? | Measured | `RECALL-01` unmet; cliff not slope | `SEED-273` |
| Can you bill and report usage per entity? | — | Metering, entitlement | `SEED-073`, `SEED-074`, `SEED-080`, `SEED-083` |
| Can we use our own model keys? | — | Per-org BYO | `SEED-120` |
| Is it in our language? | Bilingual templates exist in adjacent work | Arabic pack, RTL output | P10 in §4 |

⛔ **The ordering consequence: `SEED-004` moves from dormant to first.** A cross-tenant read found
during a government security review does not produce a bug report, it produces a rejected vendor.
It is already the most-repeated defect shape in the register.

---

## 11. Proposed milestone shapes

**Offered as candidates for `/gsd:new-milestone`, phases resuming at 247.** `ROADMAP.md` and
`MILESTONES.md` were not read this pass, so any of these may already be scoped. **The existing plan
wins every conflict.**

### M-A. "Ship What We Built" — deployment and the honest surface

Closes the condition that has now carried across two consecutive milestone closes.

- The 287-commit promotion, with migrations 179 and 180 landing alongside the code that needs them
- The non-code deploy parity half owed from 242, plus 242's UAT row 5
- The connection honesty defects from §C8: a connection that stores no credential must not report
  `active`; an empty action list must say whether it is empty or filtered; the identity display and
  the list filter must stop sharing one input
- `SEED-172`: admit local models against the routing roster rather than the SSRF discovery allowlist
- The eight duplicate seed IDs

**Why first:** every other milestone ships into the same pipeline. **Candidate for smallest
milestone with the largest unblocking effect.**

### M-B. "One Tenant, Provably" — isolation as a mechanical fence

- `SEED-004` promoted from dormant
- `SEED-124`, `SEED-125`, `SEED-129`, `SEED-091` treated as **one root cause**, not four fixes
- The deliverable is **a rule plus a test fence**, in the shape `harness.py` already uses for
  `KB_TOOLS` disjointness, so the invariant is mechanical rather than remembered
- A decision, recorded: is a hosted multi-tenant offering in scope, or is single-tenant self-host
  the product? `SEED-013` offers scoping to single-org installs as a legitimate posture, but it must
  be **stated**, because it determines whether §9.3 is reachable at all

**Why second:** it gates the hosted offering, the government route and every per-org plugin.

### M-C. "Priceable" — metering and the pack format

- `SEED-073` and `SEED-074`: cost attribution before any billing surface exists
- `SEED-080` and `SEED-083`: the entitlement primitive that makes a pack a pack
- P1: the vertical pack format, mostly a manifest, an installer and an entitlement check over
  artefacts that already exist
- P14: attachments on outbound payloads, which currently leave two of the seven use-case shapes
  with no ending

**Why third:** retrofitting cost attribution across a shipped plugin surface is materially harder
than building it in.

### M-D. "Sovereign" — the public-sector pack

- `SEED-003` install UX, `SEED-075` backup and restore, air-gapped mode
- `SEED-079` redaction and DLP, `SEED-072` data subject rights
- The assurance export (P8): the evidence artifact a buyer can file
- `SURF-03`: the notification surface, **after** the product decision it is waiting on
- The Arabic and bilingual pack (P10)

**Why fourth:** this is the §10 table shipped as a product. It is also the largest surface, and it
is worth little until M-A and M-B are done.

### Carried constraints for any of the above

- ⛔ No outbound capability enters `_TOOL_REGISTRY` before the approval model exists
- ⛔ The D-14 red line: adding an executor should trigger "is this actually a utility node?"
- ⛔ `OV-SOLO-01` is re-armed as of 2026-09-13. A phase's builder may not be its reviewer
- ⚠ The independent §6.3 review owed by 238, 240 and 241 is still owed and is not retro-closed
- ⚠ Register integrity: re-derive from phase directories, never from a summary line

---

## 12. What a second pass should read

1. `ROADMAP.md` and `MILESTONES.md`. Everything in section 7 is provisional without them
2. `PROJECT.md` `## Key Decisions`. The decision log constrains most of section 4
3. `backend/app/services/connectors/protocol.py` and `registry.py`. Whether P12 is publishable
4. `backend/app/services/connectors/org_scope.py`. Whether C2's discipline is systemic or local
5. `backend/app/services/harness/grounding.py`. Whether external live content has a grounding
   category, which governs P6 and every read capability
6. `SEED-079`, `SEED-080`, `SEED-083`, `SEED-073`, `SEED-074`. The commercial primitives
7. `SEED-003`. The sovereign pack's actual scope
8. The frontend connection and action-grant surface. C8 and the 5.1 grouping item were assessed
   from screenshots only

Added by §§9 to 11, and ahead of items 5 to 8 if the public-sector route is taken:

9. `.planning/seeds/SEED-004` and the four leak seeds (`124`, `125`, `129`, `091`) read **together**.
   Whether they share one root cause decides whether M-B is a rule or a list of fixes
10. `.planning/seeds/SEED-003` and `SEED-075`. The sovereign pack's real scope
11. `.planning/seeds/SEED-079` and `SEED-072`. The PDPL and data-rights half of §10
12. `.planning/seeds/SEED-172`. Already the named candidate for the next milestone
13. `ROADMAP.md` and `MILESTONES.md` **before acting on §11 at all**. Those milestone shapes were
    proposed without reading either, and the existing plan wins every conflict
