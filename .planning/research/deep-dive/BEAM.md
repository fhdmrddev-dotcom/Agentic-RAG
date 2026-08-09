# Beam AI — Deep-Dive Competitor Crawl (v3.6 Visual / No-Code Workflow Studio)

**Researched:** 2026-07-24
**Depth:** Full-site crawl — beam.ai marketing (platform/ai-agents, /platform/agentic-workflows, /platform/studio, /platform/databases, /integrations, /legal/security, /resources/changelog) **+ the entire `docs.beam.ai` Academy tree** (core-concepts, creating-agents, flow-configuration, automation-modes, evaluation-framework, task-executions, integrations, the `llms.txt` master index, and the public API reference for the Agent Graph) **+ independent sources** (G2, agent-finder, techharry, WebSearch corroboration of the graph/node model).
**Overall confidence on the flagged gap (Q1 authoring):** raised from MEDIUM (marketing-level) to **HIGH** — the docs expose the actual builder mechanics *and* a public "Agent Graph" API whose verbs (Add Node / Add Edge / Publish Graph / Test Graph Node) prove the model, and three independent reviews corroborate the drag-and-drop node canvas.
**Overall confidence on the crux (Q2 graded governance):** **HIGH** — answered from primary docs (automation-modes, evaluation-framework, databases) with independent corroboration.

**Reachability note:** Every requested page resolved — nothing was auth-walled or 404. The operator's target list named a few paths that don't match Beam's current IA (`/platform/agent-setup`, `/platform/agentic-automation`, `/platform/integrations`); the live equivalents are `/platform/ai-agents`, `/platform/agentic-workflows`, `/platform/databases`, `/integrations` (root), `/skills` (root), and `/platform/studio` (which **does** exist). The Academy docs (`docs.beam.ai`) were the richest source — marketing pages were thin/inflated exactly as the first pass warned, so the confidence below leans on docs + independent sources, not landing copy.

---

## TL;DR for the roadmap (read this first)

1. **Q2 verdict (the crux): Beam has NO grounding-graded governance, NO citations, and NO retrieval-confidence gate.** Its "confidence thresholds" are **behavioral output-accuracy** scores from an Evaluation Framework (rubric/field-validation), and a low score triggers **auto-retry (self-heal) or HITL escalation** — never a citation-required or KB-grounding block. Beam **does** grade governance per-node, but on the **action-RISK axis** (consent/approval nodes gate "send email / update record / make payment"), **not** on the grounded-vs-open axis the operator cares about. **Our grounded→strict-cited / open→flexible axis is a genuine, unfilled market gap. Beam does not do it; nobody in the study does.** [HIGH]

2. **Q1 verdict: Beam's builder is a free-form node/edge DAG canvas ("Agent Graph") in a product called "Agent Studio"** — click `+` to add a node, draw edges, branches/merges/exits, configure the selected node in a right side-panel, with three on-ramps (Templates / Chat-based NL→flow / Empty-canvas Custom). It has draft-vs-published versioning. **This is n8n-shaped, not phase-spine-shaped** — which independently validates our constrained-canvas thesis (reviewers report a "learning curve for advanced workflows"). [HIGH]

3. **Beam is genuinely ahead of us on two things worth stealing:** (a) **per-node graded autonomy** (consent-node / input-node / autonomous — a real "different steps, different strictness" model, just on the risk axis) and (b) a **just-shipped (Jul 2026) flow-builder redesign** whose lessons are directly reusable (sidebar config, *save incomplete steps*, non-blocking validation, show-which-fields-are-required, tool-visibility-tied-to-connection-status). We beat them on citations, build-time flow governance, structural/author-time safety, constrained canvas, and DB-enforced multi-tenancy.

---

## Q1 — Authoring / Canvas UI mechanics (the flagged gap → raised to HIGH)

**Product name:** the builder is **"Agent Studio"** (`beam.ai/platform/studio` — page exists). The underlying artifact is an **"Agent Graph"** (nodes + edges), confirmed by both the Academy docs and a **public REST API** whose endpoints are literally `Add Node to Graph`, `Add Edge to Graph`, `Create Complete Agent Graph`, `Get Agent Graph with Nodes`, `Publish Agent Graph`, `Test Graph Node`, `Update Edge in Graph`, `Update Graph Node`, `Update Input/Output Parameters`, `Update Tool Prompt`. [HIGH — API verbs are self-documenting]

**Canvas model — free-form DAG, not a constrained spine.** [HIGH]
- You **click a `+` icon on the canvas to create a node**; each node = one discrete action bound to a **tool** plus an **objective** (a plain-language "what this step does").
- Nodes are wired by **edges** ("after this node, go to that one"). A graph must have **at least one entry node** (`isEntryNode: true`) and **exit conditions** (success or escalation endpoints).
- **Branching:** after any node you add multiple branches, each with an **edge selection criterion** — either **condition-based** (boolean / string-match / numeric-range comparisons) or **AI-powered** (semantic classification / intent detection). Branches evaluate in order, first-match wins, and **a fallback branch is required**. Branches **reconverge at merge nodes**.
- Marketing claims "branching, loops, parallel execution" without code; "one execution = one branch path followed."
- **This is a directed graph a user can freely wire — the docs describe no structural constraint preventing an invalid/unsafe flow shape** (see Q5). It is the n8n/Flowise family, not our locked linear phase-spine.

**Three authoring on-ramps (verbatim from docs):** [HIGH]
| Path | Time | Mechanics | Jargon exposure |
|---|---|---|---|
| **Templates** | 5–15 min | Pick a pre-built agent; the canvas opens with "all nodes already connected"; customize. Gallery covers customer service, invoice processing, sales ops, data extraction. | **Low** — complexity hidden. |
| **Chat-based (NL→flow)** | 10–30 min | "Describe your automation need in natural language"; Beam "automatically generates a complete flow with connected nodes" + suggests tools; refine in place. | **Low** — this is their table-stakes AI-seed. |
| **Custom (empty canvas)** | 30–90 min | Blank canvas, click `+`, define objectives, pick/generate tools, wire edges. Docs flag this as "intermediate-to-advanced skill." | **High** — exposes `task_query`, "Linked variable fill," branch criteria. |

**Node configuration = right-hand side panel.** [HIGH] Select a node → side panel to (a) **choose a tool** three ways: *match* (system suggests), *AI-generate* a custom tool ("Custom GPT tool"), or *browse* the 1,500+ connector catalog; (b) map each input parameter via **five "fill methods"**: **Linked Variables** (`${previous_node.output_field}`), **AI Fill** (LLM constructs the value from context + the parameter description), **Static**, **User Fill** (runtime prompt), **From Memory**. Triggers are configured on a **separate tab** (manual / schedule / webhook / email). Reference files for memory are uploaded per-agent.

**Versioning:** creating an agent yields **both an active/published graph and a draft graph** — so drafts + publish is a first-class concept (parity with our immutable-on-publish, though Beam's immutability/gauntlet story is far thinner). [HIGH]

**Jargon-for-business-user assessment:** Templates and Chat-based paths are genuinely non-technical; the **Custom path leaks developer concepts** (fill methods, `task_query`, branch criteria, variable mapping). Independent reviews agree: *"non-technical users can set up basic workflows, though complex multi-step processes still benefit from someone with integration experience"* and *"the drag-and-drop builder is powerful, though there is a learning curve for advanced workflows."* [HIGH — three independent sources: G2, agent-finder, techharry] **This is the exact complexity-trap our constrained phase-spine + business-verb vocabulary is designed to avoid.**

**Recency signal — the builder is actively being reworked (very relevant to our timing):** [HIGH — Beam changelog]
- **Jul 21 2026 — "Flow Builder Redesign":** sidebar-based node configuration, **ability to save incomplete steps**, **non-blocking workflows**, and **the UI now shows exactly which fields require input and their status.** (i.e., they just moved *toward* our side-panel + per-node field-validation direction.)
- **Jul 7 2026 — "AI-Powered Agent Building":** describe outcome → auto-build the full flow (steps + tools + integrations), refine in place without restarting or re-copying credentials.
- Also 2026: real-time task **abort**, auto-collapse long steps, **tool visibility tied to integration connection status**, incremental **live run streaming**.

---

## Q2 — ★ GRADED GOVERNANCE (the crux) — answered concretely

**Direct answer to each sub-question:**

**"Does Beam vary strictness depending on whether a step is grounded in retrieved knowledge vs an open reasoning/tool step?"** → **NO.** [HIGH] There is no grounded-vs-open distinction anywhere in Beam's governance model. Strictness varies by **action risk** and by a **behavioral accuracy score**, never by retrieval-grounding.

**"Can an author MIX a strict, cited, KB-grounded step with a looser open agentic step in the same workflow?"** → **Partially, but on the wrong axis.** [HIGH] You *can* mix strict and loose steps: autonomy is configured **per node** (docs: *"Autonomy is configured at the workflow node level… different steps have different strictness"*), and you insert **Consent nodes** (pause before sensitive actions) and **Input-request nodes** (pause when a variable is uncertain) exactly where you want them. **But** "strict" here means *"requires a human OK / paused for input,"* **not** *"must cite the KB and clear a retrieval-confidence bar."* There is **no cited/KB-grounded step type** to mix in.

**"Is there any notion of RAG grounding / citation-required / confidence-gating at all?"** →
- **RAG grounding: YES, but implicit and un-cited.** [HIGH] Beam has a **"Databases"** primitive — upload any docs (PDFs, spreadsheets, unstructured text, multimedia); agents use **"Agentic Retrieval Augmented Generation"** with "state-of-the-art retrieval algorithms" plus a 4-type **Memory** system (short/long/working/episodic) over **vector embeddings**. So the agent *does* retrieve from your knowledge sources.
- **Citations / source attribution: NO.** [HIGH — explicit negative, verified across core-concepts, databases, and evaluation-framework pages] Beam surfaces **no citations, no source attribution, no "this claim came from document X."** The databases page describes "autonomous recall" and "adaptive knowledge" but **"does not explicitly mention… confidence scores or citation mechanisms."** Grounding is a black box — trust-the-agent, not show-your-sources.
- **Confidence-gating: YES, but it's the WRONG confidence.** [HIGH] Beam's "confidence thresholds" live in the **Evaluation Framework** and score **output/behavioral accuracy** (field validation, format, business-rule correctness, rubric scoring — "automatically validating outputs against defined criteria, scoring accuracy"). A score **below threshold (typ. 70–80%) triggers automatic retry** (self-heal, 2–3 attempts) and/or **routes to HITL**. This is **calibration-of-the-agent's-own-answer**, **not** retrieval-grounding confidence and **not** citation coverage.

**"Is governance all-or-nothing or graded?"** → **Graded — but on the action-risk / behavioral-accuracy axes, never the grounding axis.** [HIGH]

### The precise shape of Beam's governance (so we can position against it)

Beam offers **two independent graded dials, both run-time, both behavioral:**

1. **Autonomy mode (per node):** *Fully Autonomous* ↔ *Human-in-the-Loop* ↔ *Hybrid*. Implemented as **Consent nodes** ("present steps-so-far + proposed action for a human decision" before emails/DB-updates/payments/publishing) and **Input-request nodes** ("agent can't reliably determine a variable → ask a human"). Enforced when execution reaches that node.
2. **Accuracy threshold (per node, Evaluation Framework):** score the node's output; below-threshold → auto-retry → escalate to HITL. Optionally "**Set confidence thresholds triggering HITL requests**."

### Why this matters for our requirement (the highest-value takeaway)

- **The operator's axis — "grounded step → strict/cited/confidence-gated; open agentic step → flexible" — is NOT what Beam (or any studied competitor) implements.** Beam grades by *how risky the action is* and *how confident the model is in its own answer*. It never asks *"is this step standing on retrieved evidence, and if so, is the evidence strong enough and cited?"* **That grounded-vs-open governance axis is ours to own.**
- **Beam nonetheless validates the operator's core instinct that governance should be graded and per-step, not all-or-nothing.** The design pattern to **steal** is *per-node governance nodes as first-class canvas citizens* (consent-node, input-node). The design axis to **add on top** (and beat them with) is *grounding-graded strictness*: a KB-retrieval step auto-inherits citation-required + confidence-gate; an open reasoning/tool step doesn't — mixable in one workflow, enforced structurally at author-time.
- **Concrete implication for a new v3.6 requirement:** model **two orthogonal per-node governance dials** — (1) *grounding strictness* (auto-strict when the node reads the KB: cite + confidence-gate; relaxed when it's open) and (2) *action risk* (approval/HITL when the node writes to the outside world). Beam ships #2. **#1 is our differentiator, and #2 is a pattern we should also adopt** (our `llm_human_input` phase already gives us the substrate for it). Keeping external integration in the picture is native to this: an outbound connector node is exactly a high-risk node that should default to approval (#2) while remaining an "open" node for grounding purposes (#1).

---

## Q3 — Run Observability

**Two surfaces, both real:** [HIGH]

**A. Overview Analytics dashboard (supervisor/business-facing).** Real-time gauges + counters: tasks completed / failed, **task approval rate** (for HITL flows), average & total runtime, **completion-rate %**, **average evaluation score** (mean accuracy across evaluated nodes), **feedback score** (thumbs up/down counts). Date filters (7d / 30d / 3mo). This is manager-grade "how is my agent fleet doing," analogous to what the first pass called Beam's "command-center."

**B. Task Executions (per-run, step-by-step) — richer than the first pass credited.** [HIGH]
- A run renders as a **"visual flowchart of all workflow steps,"** each node showing **name, tool used, accuracy score, and a status icon**: ✅ passed-all-evals / ❌ failed-validation-or-error / ⚠️ completed-but-flagged-for-review / 🔄 currently-executing.
- **Per-node inputs and outputs are inspectable** (variables, previous-node outputs, static values in; extracted data / API responses / structured JSON out).
- **Live active-run view exists:** "real-time updates as nodes complete," a spinner on the executing node, and a header **progress counter (e.g., "2/6 steps")**. The **Jul 2026 changelog** added incremental live-run streaming for "smoother real-time progress." There's also an SSE API (`Get Task Updates (SSE)`).
- **Branch visualization** shows selected vs unselected paths. **Rerun/backtest** and **Debug Tools** (step-by-step execution logs, error diagnosis) round it out. No explicit animated "replay/playback" of a completed run.

**Non-tech vs developer legibility:** [HIGH] Beam splits the audience the way we do — a **business layer** (status icons, auto-generated step descriptions, high-level gauges) over a **developer layer** (JSON payloads, tool-reasoning, per-node eval metrics, debug logs). It is **more legible than n8n's raw per-node I/O**, but it is still fundamentally a *flowchart-with-status-icons + analytics*, **not** a purpose-built plain-verb narrative ("Finding your documents… Asking the AI… Waiting for your approval…"). **The genuinely-non-technical, plain-language run story remains the field's blind spot — Beam narrows it but doesn't close it**, so our "watch your process run in plain English" view is still a differentiator (now a *smaller* gap than the first pass implied — Beam's per-step status flowchart is real and good).

---

## Q4 — Integrations / Connectors

- **Catalog:** **1,500+ pre-built integrations** across ~12 categories — named examples: **Salesforce, Gmail, Slack, HubSpot, Notion, Stripe, Zendesk, Shopify, Airtable, Google Sheets, SAP, Workday** (CRM, comms, productivity, email, docs, storage, marketing, ops, commerce, analytics, dev, AI/ML). (The "1,500+" is marketing-stated; the *shape* — that a connector is a node — is doc-confirmed.) [catalog size: MEDIUM; model: HIGH] Note: JIRA specifically wasn't name-confirmed in what I could reach, but ticketing/ITSM-class tools are clearly in scope; treat "JIRA present" as LIKELY, not verified. [LOW on JIRA specifically]
- **How a connector is modeled:** a connector is an **"integration action" = a node/tool inside the Agent Graph.** You add it via the node's tool-selection panel, then bind its parameters with the same five fill methods (Linked / AI Fill / Static / User Fill / From Memory). No separate connector concept — it's just a tool a node calls. **This exactly matches the first-pass thesis and our model** ("a connector = a tool a governed node is allowed to call"). [HIGH]
- **Credential/auth model:** **OAuth + API keys.** Credentials are connection-scoped; troubleshooting docs reference OAuth re-auth and scope-matching. The **Jul 2026 changelog** hardened this: **tools auto-hide when their integration disconnects**, plus access-token-persistence fixes — i.e., node availability is gated on live credential status. **Org-scoping of credentials was not documented on the pages I could reach** [gap — MEDIUM]; enterprise SSO (Azure) + SOC2 imply tenant isolation but the credential-tenancy model isn't spelled out publicly.
- **MCP support: YES — bidirectional.** [HIGH] (a) Beam **consumes MCP** as a connector substrate — a Beam thought-leadership piece states Beam "has been using MCP to build agents… orchestrate complex processes across multiple business systems… without custom integration code," framing MCP as the N×M solver. (b) Beam **exposes an MCP server** — the API reference has an **"MCP Connection: Connect to Beam AI using the Model Context Protocol"** endpoint (so external AI assistants can drive Beam). **This corroborates our hard-req-#3 verdict: MCP is the right connector substrate, and being *callable via MCP* is a first-class pattern.** (Note: docs *integrations* page itself never mentions MCP — the MCP story lives in the API reference + insights blog, not the business-user connector UI.)

---

## Q5 — Governance / Safety enforcement point

**Enforcement is overwhelmingly RUN-TIME + behavioral. There is essentially NO structural author-time flow governance.** [HIGH]

| Mechanism | Where enforced | What it does |
|---|---|---|
| **Consent nodes** | Author-time *insertion*, **run-time activation** | Pause before sensitive external actions (email/DB/payment/publish) for human approve/reject. |
| **Input-request nodes** | Author-time insertion, run-time activation | Pause to ask a human for an uncertain variable. |
| **Autonomy mode (autonomous/HITL/hybrid, per node)** | **Run-time** | How much the node acts without oversight. |
| **Evaluation Framework thresholds** | Criteria at author-time, **scoring/retry at run-time** | Below-accuracy-threshold → auto-retry → escalate. |
| **Exception queue** | **Run-time** | Flagged runs land in a queue with "why"; human resolves; **agent learns from the correction** (exception rate drops over time). [independent: agent-finder, techharry] |
| **Policies** | Run-time | "Govern cost, latency, accuracy" optimization policies. |
| **Field-completeness validation** | **Author-time (new, Jul 2026)** | Node config now flags which required fields are missing — but **only node-config validity, not flow validity**. |
| **Node config validation** | Author-time | Red/incomplete node indicators. |

- **Author-time / "can't build something unsafe": essentially absent.** The flow-configuration docs describe **no build-time flow validation, no invalid-flow detection, no constraint preventing a malformed/unsafe graph.** The only author-time checks are **per-node field completeness** (the Jul 2026 addition) and required-fallback-branch. **Beam cannot stop you *drawing* an unsafe flow — it catches problems by running, evaluating, retrying, and escalating.** This is precisely the market gap our live in-canvas `lint_workflow` + gauntlet-while-drawing closes.
- **Autonomy is user-tunable** ("tune autonomy levels to match your risk profile") — the exact **anti-feature** our FEATURES.md flags: a "make it less governed" knob. In Beam the *author* loosens the rails; in ours the *operator/admin* sets a locked allowed-set and the business author physically cannot loosen it.
- **Platform trust:** SOC 2 Type II, GDPR, HIPAA; AES-256 + TLS; third-party pen-testing; 30-day backups; SSO (Azure documented). **RBAC/roles, audit-trail, and multi-tenancy architecture were NOT documented on the reachable trust pages** (the trust center `security.beam.ai` likely holds more, but it wasn't crawlable in detail here) [gap — MEDIUM]. Team/workspace + member-invite exist (a workspace-setup concept), implying roles, but the model isn't public.

---

## Q6 — Steal / Beat

### Steal (adopt these patterns)
1. **Per-node graded governance as first-class canvas nodes** — Beam's **Consent node** and **Input-request node** are clean, legible, business-friendly primitives. Our `llm_human_input` phase already gives us the substrate; give it a **canvas face** and add a *consent/approval* variant. This is the operator's "different steps, different strictness" made concrete — steal the UX, then **extend the axis to grounding** (our differentiator). [HIGH value]
2. **Three on-ramps, one canvas** — Templates / Chat-based NL→flow / Empty-canvas, all landing on the *same* editable canvas with in-place refine. We already have the pieces (Starter Library, SEED-051 NL authoring, the phase-spine); Beam proves the **"describe → get a connected flow → refine in place without restarting"** loop is the expected default. Match it.
3. **The Jul 2026 flow-builder redesign lessons (fresh, hard-won):** **sidebar node config**, **let users save incomplete steps** (don't block partial drafts), **non-blocking validation** (warn, don't wall, mid-draft), **explicitly show which fields are required and their status**, and **tie tool/connector visibility to live connection status** (hide a node's tool when its integration is disconnected). These are directly portable to our canvas side-panel + live-validate design and will save us the same iteration Beam just paid for.
4. **Exception-queue → human-correct → agent-learns loop** — flagged runs land in a queue with the "why," a human fixes it, and the correction feeds back. A compelling HITL pattern that pairs with SEED-052.
5. **Real-time testing environment with node-level output inspection** before deploy — "run it and inspect each node's output" as a design-time affordance.
6. **MCP as the connector substrate (both directions)** — Beam both consumes MCP and exposes an MCP server. Confirms our hard-req-#3 verdict: adopt MCP, and make *being callable via MCP* a first-class story (the "n8n calls us" pattern, SEED-013).
7. **Workflow-analysis to surface automation opportunities** (bottlenecks/exception-rates/volume) — a nice on-ramp that tells a business user *what* to automate first. Future/optional.

### Beat (where our governed engine already wins — sharpen these as the pitch)
1. **★ Grounding-graded governance (citations + KB-retrieval-confidence gating).** Beam has Agentic RAG but **zero citations, zero source attribution, zero retrieval-confidence gate.** We have per-claim citations (CITE-01), `citations_required` gates, and grounding-confidence. **The operator's grounded→strict-cited / open→flexible axis is unfilled by Beam and the whole field — it's our category-defining differentiator.** [HIGH]
2. **Build-time FLOW governance ("you cannot draw an invalid/unsafe workflow").** Beam validates *node config* (and only *just* added required-field hints) but **never validates the flow's safety while you draw** — you find out by running. Our live in-canvas `lint_workflow` + gauntlet-while-drawing is exactly the gap. [HIGH]
3. **Structural, author-time, operator-locked governance** vs Beam's **run-time, user-tunable** guardrails. Governance is the *shape of our artifact* (locked order, per-phase tool whitelists, gates, judge hard-wall), decided once and un-loosenable by the business author. Beam's autonomy dial is a footgun a non-technical author can turn down. [HIGH]
4. **Constrained canvas vs free-form DAG.** Beam is a free graph with branches/merges/exits — independently reported to have a "learning curve for advanced workflows." Our linear/branching phase-spine is *deliberately* less expressive and therefore more legible + more governable. [HIGH — corroborated by 3 independent reviews + the field-wide "canvas gets confusing" finding]
5. **Publish gauntlet with a judge hard-wall.** Beam's publish is draft→published with per-node evals + retries; there is **no evidence of a publish-blocking golden-run + judge hard-wall.** Our 8-stage gauntlet is a stronger pre-production gate. [HIGH on ours; MEDIUM that Beam lacks it — absence of evidence]
6. **DB-enforced multi-tenant isolation (v3.4 RLS)** vs Beam's undocumented (likely app-layer) tenancy. [MEDIUM — Beam's model isn't public]
7. **Cross-provider per-node model choice** (OpenAI/Anthropic/Google/OpenRouter via MODEL_CAPABILITIES). Beam has a `Get Preferred Models` / model-selection concept but positions its own stack; our open cross-provider routing is a differentiator. [MEDIUM]

### One reframe for the roadmap
The first pass scored Beam's run-viz as "shallow/supervisor-grade." **Correction: Beam's per-run Task-Executions flowchart (status icons + per-node I/O + live progress) is real and reasonably legible** — our run-viz edge is *narrower* than assumed. Where we still clearly win on observability is **honesty + grounding**: a run view that shows *citations behind each produced claim* and *distinguishes a grounded-and-cited output from an open one* — which Beam structurally cannot show because it has no citations.

---

## Confidence-labeled claim ledger

| Claim | Confidence | Basis |
|---|---|---|
| Builder is a free-form node/edge DAG ("Agent Graph") in "Agent Studio" | **HIGH** | docs (flow-configuration, creating-agents), public Agent-Graph API verbs, `/platform/studio`, 3 independent reviews |
| Three on-ramps: Templates / Chat-NL / Empty-canvas; side-panel config; 5 fill methods | **HIGH** | docs creating-agents + integrations + `/platform/studio` |
| Draft-vs-published graph versioning | **HIGH** | docs + API (`Publish Agent Graph`, "active + draft graph") |
| **No citations / no source attribution / no retrieval-confidence gate** | **HIGH** | explicit negatives across core-concepts, databases, evaluation-framework |
| "Confidence thresholds" = behavioral/output-accuracy → auto-retry/HITL, not grounding | **HIGH** | evaluation-framework + automation-modes docs |
| Governance graded per-node on **risk/autonomy** axis (consent/input nodes), not grounding | **HIGH** | automation-modes docs |
| Agentic RAG exists (Databases primitive + 4-type Memory + vector embeddings), grounding implicit/un-cited | **HIGH** | `/platform/databases`, core-concepts |
| Run-viz: analytics dashboard + per-run status-icon flowchart + live progress + per-node I/O + SSE | **HIGH** | overview-analytics + task-executions docs + changelog |
| 1,500+ connectors as nodes; OAuth + API keys; tools hide on disconnect | model **HIGH**, count **MEDIUM** | docs integrations + changelog (count is marketing-stated) |
| MCP: Beam both consumes MCP and exposes an MCP server | **HIGH** | API reference (MCP Connection) + Beam MCP insights article |
| No structural author-time flow validation (only node-config/required-field, Jul 2026) | **HIGH** | flow-configuration + changelog (absence + what was newly added) |
| SOC2 Type II / GDPR / HIPAA / AES-256 / TLS / Azure SSO | **HIGH** | `/legal/security` |
| RBAC / audit-trail / multi-tenancy architecture | **MEDIUM (gap)** | not documented on reachable trust pages |
| Autonomy is user-tunable ("tune to your risk profile") | **HIGH** | `/platform/ai-agents`, automation-modes |
| JIRA specifically in the catalog | **LOW** | not name-verified; ITSM-class clearly in scope |
| Independent "learning curve for advanced workflows / non-tech OK for basic only" | **HIGH** | G2, agent-finder, techharry (3 sources) |
| Exception-queue → human-correct → agent-learns loop | **MEDIUM-HIGH** | agent-finder + techharry (independent), consistent with self-learning marketing |
| No publish-blocking judge hard-wall | **MEDIUM** | absence of evidence, not a stated negative |

---

## Sources (with per-source confidence)

**Primary — Beam docs (`docs.beam.ai`), HIGH:**
- `/llms.txt` master index (full doc + API map) — HIGH
- `/01-getting-started/core-concepts/core-concepts` (agents/flows/nodes/edges/tools/tasks/triggers/memory) — HIGH
- `/02-building-agents/agent-fundamentals/creating-agents/creating-agents` (three on-ramps, custom canvas) — HIGH
- `/02-building-agents/agent-fundamentals/flow-configuration/flow-configuration` (canvas `+`, edges, branches/merges/exits, fill methods; no build-time flow validation) — HIGH
- `/02-building-agents/agent-configuration/integrations/integrations` (connector = node, OAuth/API keys, fill methods; no MCP in the UI docs) — HIGH
- `/03-running-operations/task-management/automation-modes/automation-modes` (autonomous/HITL/hybrid per-node, consent & input nodes, run-time enforcement) — HIGH
- `/03-running-operations/task-management/task-executions/task-executions` (per-run flowchart, status icons, per-node I/O, live progress) — HIGH
- `/04-observability-analytics/overview-analytics/overview-analytics` (dashboard gauges/metrics) — HIGH
- `/04-observability-analytics/evaluation-framework/evaluation-framework` (behavioral accuracy scoring, thresholds → retry/HITL, no grounding/citation) — HIGH
- API reference (Agent Graph verbs: Add Node/Edge, Publish, Test Graph Node; Task Management: Approve/Reject/SSE; **MCP Connection**) — HIGH

**Primary — Beam marketing (`beam.ai`), MEDIUM (inflation-discounted):**
- `/platform/studio` (Agent Studio: drag-and-drop nodes, side panels, 3 paths, branching/loops/parallel) — HIGH on mechanics, MEDIUM on claims
- `/platform/ai-agents` (agentic RAG, memory, autonomy levels, HITL, gate-risky-steps) — MEDIUM
- `/platform/agentic-workflows` (no-code visual, multi-agent, triggers, approvals, policies) — MEDIUM
- `/platform/databases` (upload any docs, Agentic RAG, autonomous recall; **no citations/confidence**) — HIGH on the negative, MEDIUM on capability
- `/integrations` (catalog scope) — MEDIUM (count marketing-stated)
- `/legal/security` (SOC2 Type II / GDPR / HIPAA / AES-256 / TLS; RBAC/audit/tenancy NOT covered) — HIGH on certs, gap noted
- `/resources/changelog` (Jul 21 2026 Flow Builder redesign; Jul 7 2026 AI-Powered Agent Building; live-run streaming; tool-hide-on-disconnect) — HIGH (dated primary)
- `/agentic-insights/what-is-mcp…` (Beam uses MCP as connector substrate) — MEDIUM

**Independent / third-party, MEDIUM-HIGH (corroboration):**
- G2 `beam.ai/reviews` — "drag-and-drop builder is powerful; learning curve for advanced workflows; pricing jumps between tiers" — MEDIUM-HIGH
- agent-finder.co/reviews/beam-ai — "Agent Studio is a visual builder; non-technical OK for basic, complex needs integration experience; exception queue → human review → agent learns" — MEDIUM-HIGH
- techharry.com Beam AI review 2026 — corroborates studio + drag-and-drop + learning curve — MEDIUM
- WebSearch synthesis of the Agent-Graph model (entry node, edges as routing, draft+published graph, low-code drag-drop) — MEDIUM-HIGH (multi-source)

**Unreached / gaps (flagged, not guessed):**
- `security.beam.ai` trust-center detail (RBAC/audit/tenancy model) — not crawlable in depth here.
- Credential **org-scoping / multi-tenancy architecture** — not in reachable docs.
- JIRA-specific catalog presence — not name-verified.
- Whether Beam has any publish-blocking judge/golden-run gate — no evidence either way (absence, not confirmed negative).

---
*Deep-dive for: v3.6 Visual / No-Code Workflow Studio — Beam AI portion (deepens FEATURES.md). Crux (Q2) answer: Beam grades governance by action-risk + behavioral-accuracy, never by KB-grounding; no citations, no retrieval-confidence gate. The grounded→strict-cited / open→flexible axis is unfilled by Beam and is our differentiator.*
*Researched: 2026-07-24*
