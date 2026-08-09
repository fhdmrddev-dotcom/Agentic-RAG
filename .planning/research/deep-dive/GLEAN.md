# Deep Dive — Glean AI (Agent Builder + Governance)

**Competitor:** Glean AI — the D-PRD-05 primary competitor for v3.6 Visual / No-Code Workflow Studio
**Research type:** DEEP crawl (product pages + docs tree + blog + independent sources)
**Researched:** 2026-07-24
**Overall confidence:** HIGH on authoring mechanics, connectors, observability, and governance enforcement point; MEDIUM-HIGH on the crux graded-governance question (Q2 — the answer rests partly on a *negative* claim, flagged inline).

> **Purpose:** Deepen the first-pass Glean findings in `.planning/research/FEATURES.md`. The highest-value output is **Q2 (graded governance)** — the operator's key question. Glean is the competitor most likely to already grade governance by grounding/permission; this dig determines exactly how, and whether it matches or falls short of our operator's model (*strict citation+confidence gating when a step retrieves from the KB, flexible for open agentic steps*).

> **Tooling note (transparency):** firecrawl/exa/Brave MCP tooling was NOT reachable in this agent's environment (`BRAVE_API_KEY not set`; no firecrawl/exa MCP tools bound — the known `tools:`-frontmatter MCP-strip). Crawl was done with built-in WebFetch + WebSearch. `docs.glean.com` is a JS SPA — most doc pages rendered fine through WebFetch, but a few returned empty/404 (flagged per-page in Sources). `dust.tt/blog/glean-agents` never rendered via WebFetch; its findings below come from two WebSearch result snippets (MEDIUM confidence), not a full-page read.

---

## TL;DR (the six answers in one paragraph each)

1. **Authoring (HIGH):** Glean's Agent Builder is a **visual canvas + right-hand step-configuration panel**, no-code, with **drag-and-drop step reordering** and a **five-concept model: triggers, steps, actions, flow, memory**. Two authoring doors: **"Build with Natural Language"** (describe → Glean generates steps) and **"Start from Scratch"** (manual). Templates (Agent Library), Preview-with-step-highlighting, and auto-versioning round it out. A non-technical user genuinely can compose a working agent.

2. **★ Graded governance (MEDIUM-HIGH):** **Glean does NOT implement the operator's exact model of a graded, ENFORCED strictness dial.** Its governance splits into two axes that are each *blanket*, not per-step-gradable: (a) **permission enforcement is universal** — every step/action checks the running user's ACLs on every request, and there is no per-step "loosen this" knob; (b) **grounding/citation is emergent from step-TYPE, not a gate** — retrieval steps (company search, connector tools) return permission-scoped, citable results while reasoning steps (plan-and-execute, analyze-and-respond) run open on memory. So an author *does* naturally **mix a grounded cited-retrieval step with a looser open reasoning step in one agent** — but that mix is a consequence of the step menu, **not** a configurable "strict-when-grounded / flexible-when-open" governance setting. Critically, **there is no per-step `citations_required` / confidence-threshold hard-wall that blocks output** (absent from Glean's per-step config docs and from Glean's own 7-guardrails taxonomy). An independent security analysis (Knostic) pinpoints the resulting gap: Glean enforces permissions at *retrieval/query time* but not at *answer-synthesis time*. **This is exactly where our engine's author-time citation/confidence gate + judge hard-wall is genuinely ahead.**

3. **Run observability (HIGH facts / MEDIUM inference):** Author-time **Preview** highlights the currently-executing step. Run-time gives **OpenTelemetry-backed traces (stored in Tempo), a "View run history", trace graphs, per-step input/output logs, and step-level visibility** — plus admin audit logs of runs/traces/action-calls exportable to CSV/SIEM. This is **developer-grade**; the legible *non-technical* run view remains Glean's blind spot (inference — no evidence of a plain-verb business run view).

4. **Connectors (HIGH):** **275+ out-of-the-box connectors**, represented by **connection type: Native / MCP / Push API / Web History**. Extend via **Indexing SDK (custom connectors)**, **OpenAPI specs (custom actions)**, and **MCP-enabled servers**. Permissions are **inherited and strictly enforced from the source system, synced in real time**. Actions are **invoked in natural language**, combinable with triggers, with **human-in-the-loop approval checkpoints**.

5. **Governance enforcement point (HIGH):** **Both author-time and run-time, but weighted to run-time.** Author-time = role-based controls on **who can build/deploy agents and what actions they may take** + admin **sharing rules** (anti-sprawl). Run-time = **agent alignment models pre-scan every write action before it runs**, **real-time risk scoring & blocking**, prompt-injection/content-safety blocking "the moment they occur", and a **permission check on every request**. Each agent has its own **Agent Identity**; every action lands in the audit trail under that identity with the triggering person/schedule recorded. **Governance is behavioral + permission + content-safety — applied blanket, not structurally baked into the artifact's shape at author-time.**

6. **Steal / beat:** **Steal** — the NL+visual unified canvas, the five-concept vocabulary, per-step memory-scope and per-step model choice, Preview step-highlighting, auto-versioning, and MCP+OpenAPI as the connector substrate. **Beat** — our author-time **structural** governance (governance is the *shape* of the artifact, not a runtime check), our **graded KB-strictness** (a real `citations_required`/confidence gate that Glean lacks), **per-claim cited deliverables**, **cross-provider** per-step routing, and **DB-enforced multi-tenant RLS** (vs Glean's app-layer permission-inheritance). **Where Glean is genuinely ahead:** connector breadth (275+ live today vs our ~0), production run-trace maturity (OpenTelemetry/Tempo), the AWARE "pre-scan every write action" runtime safety layer, real-time permission delta-sync from source systems, and Agent Identity as a first-class audited principal.

---

## Q1 — Authoring / builder UI mechanics

**Confidence: HIGH** (docs `create-your-first-agent` + `glean.com/ai-agent-builder` marketing + `agent-governance` marketing + multiple WebSearch corroborations all agree).

**It is a visual canvas with a right-hand config panel — not a pure form, not a free DAG.** From the docs, the three primary surfaces are:
- **Canvas** for the trigger-and-steps flow
- **Step configuration panel on the right** for a step's inputs and instructions
- **Agent settings (gear icon)** for name, description, goal, and default models

**The five core concepts** (consistent across `how-agents-work`, the marketing pages, and independent reviews):
- **Triggers** — what starts the agent: run **manually from the Library**, on a **schedule**, or in response to **content / system updates** (external events).
- **Steps** — a single unit of work, run **one by one in sequence**. Each step either **performs a tool** (search the KB, analyze data, send a message) **or uses flow logic** to branch.
- **Actions / Tools** — concrete tasks: **reading data** (documents, tickets, records, calendars), **writing to connectors** (updating tickets, logging notes), **drafting content** (emails, summaries, reports).
- **Flow** — branching on conditions + **sub-agent** calls for delegated work.
- **Memory** — a persistent log; each step writes outputs into shared memory that later steps can read. (Per-step control over memory visibility — see Q2.)

**Two authoring doors (this maps directly onto our "third door" plan):**
- **"Build with Natural Language"** — *"describe your agent in plain language and let Glean generate steps automatically"* / *"business users describe a workflow and the builder proposes steps automatically."* You can also **"Open Panel"** in the upper-left to make **conversational edits** to the whole workflow graph.
- **"Start from Scratch"** — *"configure each step yourself using the visual builder."*
- Independent review (Coworker AI) frames it as *"a unified no-code visual interface in which users start with natural-language descriptions or templates and refine agents through drag-and-drop steps, sub-agents, decision nodes, and branching logic."*

**Drag-and-drop is real but scoped to reordering:** *"Agent Builder lets you reorder steps using drag and drop directly in the flow."* (Note: the evidence describes **drag to reorder steps**, not free-form drag-anything-to-anything DAG wiring — the canvas is closer to a reorderable, branchable spine than an open graph. This *validates* our constrained-spine bet.)

**Templates:** start from **Agent Library** pre-built agents ("customize pre-built agents or create new ones").

**Test / iterate:** **Preview** confirms behavior with the **currently-executing step highlighted** in the flow. Each save **creates a new restorable version** (auto-versioning: *"every configuration change — prompts, logic, model choice — is versioned automatically"* + *"drafts, test runs, version history, and safe rollback"*).

**What a non-technical business user sees:** a describe-or-template start, a small set of plain-verb step types on a canvas, a right-panel form to fill in instructions, a Preview button, and safe versioning. This is a credible, genuinely no-code experience — the bar we must meet on ease-of-authoring.

**Step-type taxonomy (from `limits-and-best-practices` + `plan-execute` search snippet):**
- **Company search step** — KB retrieval; configured with *"how many results to retrieve per search"* (best practice: start low, raise only if answers miss context).
- **Native connector tools** — exhaustive structured retrieval (Jira JQL, Salesforce SOQL, Databricks SQL).
  - Docs are explicit: *"Agents have two broad ways to retrieve data: **company search** and **native connector tools**."*
- **Plan & execute step** — agentic reasoning: *"uses agentic reasoning to follow your guidance to decide what to do, what actions to take, and how to respond. You configure this step with a set of actions it can choose from as well as natural language instructions."* → **the reasoning step carries a per-step action allowlist** (relevant to Q2/Q5).
- **Analyze data and respond step** — downstream summarization/processing over memory.
- **Sub-agents** — delegated specialized flows; **have their own memory**; only the output of `respond` steps in a sub-agent bubbles up to the parent agent's memory.

---

## Q2 — ★ Graded governance (the operator's key question)

**Confidence: MEDIUM-HIGH.** Positive claims (blanket permission, step-type mix, per-step memory/model) are HIGH. The pivotal claim — *no per-step citation/confidence gate* — is a **negative claim** grounded in the *absence* of such controls in Glean's own per-step-config docs and its own 7-guardrails taxonomy, plus one independent security analysis. Flagged accordingly.

### The question restated
Our engine today is **strict and gated on retrieved-KB confidence** (citations required + confidence threshold + gates). The operator wants the visual builder to also allow **all types of agentic AI workflows** — *strict when a step retrieves from the knowledge base, flexible for open agentic steps*, integration preserved. Does Glean vary governance/strictness by whether a step is grounded in retrieved (permission-scoped) knowledge vs an open reasoning/tool/action step? Do citation/permission constraints apply per-step? Can an author mix a strict cited-retrieval step with a looser agentic/action step in one agent? Is grounding/citation enforcement graded or blanket?

### The answer, decomposed on the two axes Glean actually has

**Axis A — Permission enforcement: BLANKET, universal, NOT gradable.**
- *"Glean Protect enforces permissions on every request"* / *"permission rules and policies apply on every request."*
- *"Agents check data permissions on every request, returning only what users have access to."*
- *"agents only see data users can already access, and permission changes sync in real time."*
- ACLs are enforced **at both index and query time** (Knostic), inherited from source systems via delta-sync.
- **There is no per-step knob to loosen permission scope.** Every step, whether a search, a connector call, or a write action, runs under the same running-user ACL. This is *structural at the data layer* but it is **not** the operator's "grade strictness by step type" — it's "always on, everywhere."

**Axis B — Grounding / citation: EMERGENT from step TYPE, NOT an enforced gate.**
- **Retrieval steps** (company search, native connector tools) are inherently grounded and permission-scoped, and Glean *"surfaces citations (deep links) so users can open sources and verify."*
- **Reasoning steps** (plan-and-execute, analyze-and-respond) operate on **memory**, i.e. whatever prior steps produced — they are inherently "open."
- **So the mix the operator describes DOES occur in a Glean agent** — a grounded cited company-search step feeding a looser open plan-and-execute step is the *normal* composition. **BUT this is a byproduct of the step-type menu, not a configurable governance setting.**
- **The decisive finding — what Glean does NOT have:** a per-step control to **require citations** or **enforce a confidence threshold that blocks/gates output**. Glean's per-step configuration surface (per the `create-powerful-agent` doc) exposes exactly three per-step knobs — **memory scope** (all previous outputs / only the immediately previous / none), **model choice** (LLM dropdown), and (for reasoning steps) **an action allowlist + NL instructions**. It does **not** expose per-step citation-required, confidence-threshold, grounding-enforcement, or knowledge-source-gating controls.
- Glean's own **"7 essential guardrail decisions"** taxonomy (model choice · decision architecture/RAG · tool permissions/RBAC · human-in-the-loop/risk tiers · observability/audit · input/output validation & content safety · cost controls) **contains no grounding-strictness-grading guardrail.** RAG is used to *reduce* hallucination ("grounding outputs in verified internal knowledge") but is **not** offered as a configurable strict/loose gate.

**Axis C — Behavioral governance (AWARE / Protect / alignment): BLANKET.**
- **Agent alignment models** *"check what an agent plans to do before allowing it to proceed. These checks pre-scan every write action before it runs"* — applied to **every** write, uniformly, regardless of grounding.
- Real-time risk scoring & blocking, prompt-injection/content-safety blocking — all uniform, not graded by whether the step was KB-grounded.

### The verdict for the operator
- **Does Glean grade governance by grounding/permission?** **Partially, and only implicitly.** It grades by *step type* (retrieval steps are grounded+cited+permission-scoped; reasoning/action steps are open) — but it does **not** expose a *configurable, enforced* strictness gate the way the operator wants. There is **no `citations_required` gate, no confidence-threshold hard-wall, no "block output unless grounded" control.**
- **Is it per-step or blanket?** **Permission = blanket. Grounding = emergent-per-step-type (not enforced). Behavioral safety = blanket.**
- **Can an author mix a strict cited-retrieval step with a looser agentic step in one agent?** **Yes** — that's the default composition — but "strict" here means *"this step happens to retrieve with permissions + citations,"* not *"this step is gated on confidence and will refuse to emit uncited claims."*
- **Independent corroboration of the gap (Knostic, MEDIUM):** *"By combining sources without verifying permissions at the time of answer creation, they create opportunities for unauthorized content leakage."* i.e. Glean enforces permissions at **retrieval**, but the **answer-synthesis** step is not itself permission-/grounding-gated. This is the precise seam where our **output-gated** model (citation field-map forced at emit + `citations_required` gate + `llm_judge` publish hard-wall) is stronger.

### Direct implication for v3.6
The operator's desired model — **graded strictness: hard citation/confidence gating on KB-retrieval steps, flexible governance on open agentic steps, all in one canvas** — is **a genuine white-space that Glean does not fill.** Glean gives you a step menu where some steps are grounded and some aren't; **we can give you a per-node governance *contract* that is *enforced* (a grounded node literally cannot emit uncited/low-confidence output; an open node is explicitly allowed to reason freely).** Rendering *that graded contract* visually on the canvas — "this node is a strict cited-knowledge node (padlock + citation badge), this node is an open reasoning node (clearly marked ungrounded)" — is a category-level differentiator, not a feature-race item. Recommend this becomes a **first-class v3.6 requirement** (a per-node grounding-mode: `strict-cited` vs `open-agentic`, with the strict mode wiring the existing `citations_required` + confidence gate, the open mode explicitly un-gated).

---

## Q3 — Run observability

**Confidence: HIGH on the developer-grade facts; MEDIUM on the "non-technical view is a blind spot" inference.**

**Author-time (preview):** Preview runs the agent with the **currently-executing step highlighted** in the canvas flow — a legible build-time trace.

**Run-time (production):**
- **Run history** — *"Agent run history and traces are visible for executions"* via a **"View run history"** surface in Builder/Triggers.
- **Traces** — *"OpenTelemetry-backed traces"*, *"trace graphs, input/output logs, and step-level visibility"*, *"detailed visibility into agent behavior at each step of execution."* Traces are **instrumented with OpenTelemetry and stored in Tempo** to debug multi-step runs.
- **Audit** — **Admin Audit Logs record agent subscriptions, workflow runs, workflow traces, and action executions**; every action lands in the audit trail **under the agent's own account (Agent Identity)**, with the triggering person or schedule recorded alongside; exportable to **CSV** and streamable to **SIEM**.

**Legibility read:** the production run surface is **developer/operator-grade** — OpenTelemetry trace graphs, per-step raw input/output, Tempo storage, SIEM export. There is **no evidence of a plain-verb, non-technical "watch your process run" business view** distinct from the trace UI. This **corroborates the FEATURES.md finding** that a genuinely non-technical run-observability view is the field's blind spot — **Glean included.** (This is our Phase-7 "two views from one stream" differentiator.)

---

## Q4 — Integrations / connectors

**Confidence: HIGH** (`glean.com/connectors` rendered fully).

- **Catalog breadth:** **275+ out-of-the-box connectors** across categories (Sales & Marketing, Engineering & Analytics, etc.), each with a logo, name, and dedicated connector page.
- **Connector representation / connection types:** **Native** (Glean-built direct integration) · **MCP** (Model Context Protocol) · **Push API** (data pushed into Glean) · **Web History** (browser-collected).
- **Actions model:** connectors let agents **"invoke actions using natural language"** and **"automate work by combining triggers with actions,"** with **"human-in-the-loop approval checkpoints."** 100+ native actions (from first-pass FEATURES.md, MEDIUM).
- **Auth / permission model:** **"all data permissions are inherited and strictly enforced, so users only see what they're allowed to"**; permissioning rules **sync in real time** and are **"reflected immediately in results."** This is Glean's signature **permission-inheritance** — the agent can only touch what the running user already can.
- **Extensibility (directly answers our hard-req #3 substrate question):** build custom connectors via **Indexing SDK**, define **custom actions using OpenAPI specs**, or connect **MCP-enabled servers**. Developer pathways also include Direct API, LangChain retrievers/tools, MCP, and the **Glean Agent Toolkit** (enterprise search, employee lookup, calendar access) usable across frameworks.
- **Takeaway for us:** **the market leader treats MCP + OpenAPI as the connector extension path** — strong confirmation of our research verdict (MCP-first substrate, don't hand-build a 275-app catalog). Glean's 275+ live catalog is where it is **genuinely ahead of us today** (we have ~0 outbound connectors); the strategic answer is not to catch up on count but to be **called by** n8n/Zapier and adopt MCP (SEED-013).

---

## Q5 — Governance / safety enforcement point

**Confidence: HIGH.**

**Enforcement is split author-time + run-time, weighted to run-time:**

**Author-time (build/deploy controls):**
- Role-based **"controls on who can build and deploy agents and limits on the actions they can take."**
- Admin **sharing rules**: *"Admins can define how broadly agents can be shared, while builders choose whether to share with individuals, teams, or the whole company based on those rules"* — the **anti-sprawl** mechanism.

**Run-time (per-request / per-action):**
- **Permission check on every request** (Axis A above) — blanket.
- **Agent alignment models** — *"check what an agent plans to do before allowing it to proceed. These checks pre-scan every write action before it runs"* (catches e.g. posting performance notes to a public channel). This is a **runtime pre-execution gate on write actions**, model-based, not structural.
- **Real-time risk scoring & blocking** — rapid-access-pattern / unexpected-API-call detection.
- **Runtime content safety** — blocks prompt injection, malicious code, toxic content **"the moment they occur."**

**Cross-cutting:**
- **Agent Identity** — each agent is a first-class audited principal with its own account; actions are attributed to the agent + the triggering human/schedule.
- **AWARE / Glean Protect** — *"active governance flags and remediates accidentally overshared sensitive data,"* scanning and remediating over-shared data at scale.
- **Data-scoping** — inherited source-system permissions, delta-synced in real time (a user who leaves a project loses agent-mediated access immediately).

**The structural contrast that matters for us:** Glean's governance is **behavioral + permission + content-safety, checked at run-time on every request/action.** It is **not baked into the shape of the authored artifact** — a Glean author does not draw a workflow whose *structure* makes an unsafe flow impossible; instead Glean *watches* the running agent and blocks bad actions as they occur. **Our engine's governance is the artifact's shape** (locked ordered phases, per-phase tool whitelists, validation gates, publish gauntlet + judge hard-wall) — decided once at author-time, un-loosenable at run-time. **That author-time structural model is our moat and Glean cannot copy it without changing what an "agent" is in their product.**

---

## Q6 — Steal / beat

### Steal (adopt into v3.6)
| Pattern | Why | Source confidence |
|---|---|---|
| **Unified NL + visual canvas with a right-hand step-config panel** | Exactly our "third door" — describe-to-seed then edit visually; the panel = our discriminated-union PhaseConfig form | HIGH |
| **Five-concept plain vocabulary (triggers/steps/actions/flow/memory)** | A proven non-technical mental model; informs our SEED-085 business-verb map | HIGH |
| **Per-step memory-scope control** (all / previous-only / none) | We don't expose this; it's a clean legible knob for controlling context bleed between phases | HIGH |
| **Per-step model choice** | We already have MODEL_CAPABILITIES routing — surface it per-node like Glean does | HIGH |
| **Preview with currently-executing-step highlight** | Cheap author-time confidence; we have the run stream to drive it | HIGH |
| **Auto-versioning on every save + safe rollback** | We already have immutable-on-publish + UNIQUE(slug,version); match Glean's "every change versioned" polish | HIGH |
| **MCP + OpenAPI as the connector substrate** | The market leader's own extension path — validates our MCP-first verdict; don't hand-build a catalog | HIGH |
| **Agent Identity as an audited principal** | Attributing each action to an agent-account + triggering human is a clean audit model; pairs with our v3.3 operator audit ledger | MEDIUM |
| **HITL approval checkpoints on write actions** | Confirms our `llm_human_input`-as-a-node plan is table stakes | HIGH |

### Beat (where we match or exceed Glean)
| Our capability | How it beats Glean | Confidence |
|---|---|---|
| **Author-time STRUCTURAL governance** — locked phases, per-phase tool whitelists, gates, judge hard-wall as the *shape* of the artifact | Glean governs behaviorally at **run-time** (alignment models pre-scan actions). We make an unsafe flow **undrawable**; Glean makes it *catchable*. Category difference. | HIGH |
| **Graded KB-strictness with a REAL enforced gate** (`citations_required` + confidence threshold + emit field-map + judge hard-wall on OUTPUT) | **Glean has no per-step citation/confidence gate** (Q2). Its grounding is emergent, not enforced; Knostic shows synthesis-time is un-gated. Our per-node `strict-cited` vs `open-agentic` mode is exactly the operator's ask and Glean's white-space. | MEDIUM-HIGH |
| **Per-claim cited business deliverables** (CITE-01 + forced emit) | Glean surfaces citations for *verification* but doesn't force outputs to be per-claim grounded; no cited `.docx`-class deliverable | HIGH |
| **Cross-provider per-step routing** (OpenAI/Anthropic/Google/OpenRouter) | Glean pins you to its stack; we route each node to best-fit | HIGH |
| **DB-enforced multi-tenant RLS** (v3.4 membership RLS) | Glean's isolation is app-layer permission-inheritance; ours is Postgres-RLS-enforced — leak-safe by construction | MEDIUM (Glean is app-layer per public evidence; not independently audited here) |
| **Live build-time FLOW validation** ("can't draw an invalid/unsafe workflow") | Glean validates by **running Preview** (soft); our reachability lint + gauntlet run live on canvas edits | MEDIUM-HIGH |
| **Genuinely non-technical run view** (two views from one stream) | Glean's run view is OpenTelemetry/Tempo developer-grade; no plain-verb business view (Q3) | MEDIUM |

### Where Glean is genuinely ahead (be honest — it's the primary competitor)
1. **Connector breadth — 275+ live today** vs our ~0 outbound. This is a multi-year head-start; our counter is "be called, don't out-connect" + MCP, not parity.
2. **Production run-trace maturity** — OpenTelemetry + Tempo + trace graphs + SIEM export is a mature observability stack; ours is Redis-run-stream + phase timeline.
3. **AWARE runtime safety layer** — "pre-scan every write action before it runs" + real-time risk scoring is a sophisticated *runtime* defense-in-depth we don't have (we rely on author-time structure + tool whitelists instead — a different, arguably complementary, philosophy).
4. **Real-time permission delta-sync from source systems** — Glean's ACL inheritance auto-revokes on source-system changes; our permission model is our own RLS, not synced from 275 external systems (because we're KB-first, not enterprise-search-first — a different scope).
5. **Scale + brand + Agent Library breadth** — a large template gallery and enterprise deployment track record.
6. **Independent-analysis caveat on positioning (Dust, MEDIUM):** Glean is *"optimized for retrieval over complex orchestration"* and *"may need technical support for custom actions"*; teams *"look elsewhere when automation is the primary goal rather than enterprise search, or when workflows need flexible deployment, cross-system orchestration, and no-code customization."* → **Glean's orchestration/automation depth is a relative weakness** — which is precisely the governed-orchestration space our engine already owns. Our opening is: **Glean-grade authoring ease + deeper governed orchestration + enforced graded grounding.**

---

## Consolidated implications for the v3.6 roadmap

1. **Q2 warrants a NEW requirement.** The operator's graded-governance model (per-node `strict-cited` vs `open-agentic`, the strict mode enforcing `citations_required` + confidence, the open mode explicitly un-gated) is a **white-space Glean does not fill** and is directly buildable on our existing gate library. Recommend the orchestrator fold a **"graded per-node grounding mode"** requirement into FEATURES.md and the roadmap — rendered visibly on the canvas (padlock/citation badge on strict nodes; clearly-marked open nodes). This is the sharpest competitive edge in the whole milestone.
2. **Authoring parity is achievable and mostly-reuse.** Glean's canvas + right-panel + NL-seed + templates + preview + versioning maps almost 1:1 onto capabilities we already have (Phase 103 form editor, SEED-051 NL authoring, Starter Library, immutable-on-publish versioning). The net-new is the editable canvas skin + per-step memory-scope knob.
3. **Adopt Glean's per-step knobs** (memory-scope, model choice) as node-config fields — small, high-legibility wins.
4. **MCP + OpenAPI connector verdict confirmed** by the market leader's own extension model — do not build a bespoke catalog; sequence with Open Platform (SEED-013).
5. **The non-technical run view is a shared blind spot** — Glean's is developer-grade too. Our Phase-7 "two views from one stream" is a real differentiator, not a catch-up.
6. **Honesty check:** don't claim to beat Glean on connectors, run-trace maturity, or runtime AWARE-style safety — we win on *author-time structural governance*, *enforced graded grounding*, *cross-provider*, and *RLS isolation*. Frame the pitch as "governed orchestration Glean's retrieval-first design doesn't reach," not "a better Glean."

---

## Sources (per-source confidence + reachability)

**Glean official — product/marketing (MEDIUM: authoritative on features, discount inflation):**
- `glean.com/product/agents` — "security, compliance, governance... built into every step"; reasoning-agents + complex-workflows framing. Reached (thin).
- `glean.com/product/agent-governance` — sharing rules, permission-per-request, agent alignment models. Reached.
- `glean.com/ai-agent-builder` — "plain-language instructions, templates, and a drag-and-drop canvas"; "business users describe a workflow and the builder proposes steps"; per-request permission; auto-versioning. Reached (HIGH-value marketing).
- `glean.com/connectors` — **275+ connectors; Native/MCP/Push API/Web History; Indexing SDK + OpenAPI actions + MCP servers; permission inheritance**. Reached (HIGH).
- `glean.com/blog/agentic-security-aware` — AWARE/Protect: author-time role controls + runtime pre-scan of every write action + real-time risk scoring/blocking. Reached (HIGH for Q5).
- `glean.com/blog/7-essential-guardrail-decisions...` — Glean's own 7-guardrail taxonomy; **no grounding-strictness-grading guardrail** (key negative-claim support). Reached (HIGH for Q2 negative).

**Glean official — docs (HIGH where reached; JS-SPA, some pages empty/404):**
- `docs.glean.com/agents/how-agents-work` — five concepts (triggers/steps/actions/flow/memory); steps run sequentially; add/reorder/condition steps. Reached (HIGH).
- `docs.glean.com/agents/create-agents/create-your-first-agent` — **canvas + right config panel + gear settings; drag-drop reorder; Build-with-NL vs Start-from-Scratch; Open Panel conversational edits; Preview step-highlight; save = new version**. Reached (HIGH — primary Q1 source).
- `docs.glean.com/agents/create-powerful-agent` — **per-step knobs: memory-scope (all/previous/none), model dropdown, sub-agent memory; NO per-step citation/confidence/grounding control** (key negative-claim support). Reached (HIGH for Q2).
- `docs.glean.com/agents/concepts/limits-and-best-practices` — "two broad ways to retrieve: company search + native connector tools"; result-count config. Reached (HIGH).
- `docs.glean.com/actions/glean/plan-execute` (+ `/agents/actions/glean/plan-execute`) — plan-and-execute reasoning step: agentic reasoning + configurable action allowlist + NL instructions. **Full page returned EMPTY via WebFetch; content captured from WebSearch snippet** (MEDIUM).
- `docs.glean.com/administration/management/audit-logs/admin-audit-logs` + `docs.glean.com/security/agents/background-agents` — audit logs of runs/traces/action-calls; OpenTelemetry/Tempo; Agent Identity; CSV/SIEM export. Via WebSearch synthesis (MEDIUM-HIGH).
- `docs.glean.com/agents/overview` — **404**. Flagged unreachable.
- `docs.glean.com/agents/concepts/agent-builder` — reached but thin (tool selector; org-admin-gated tools).

**Independent / third-party (MEDIUM — corroboration & criticism):**
- `coworker.ai/blog/glean-agent-builder` — "unified no-code visual interface... drag-and-drop steps, sub-agents, decision nodes, branching logic"; Protect layer; 100+ connected apps; retrieval-first architecture note. Reached (MEDIUM).
- `knostic.ai/blog/glean-data-security` — **ACLs at index+query time; permission enforced at retrieval NOT at answer-synthesis** (the key Q2 gap corroboration). Reached (MEDIUM — security-vendor POV).
- `dust.tt/blog/glean-agents` — "optimized for retrieval over complex orchestration"; "may need technical support for custom actions"; teams look elsewhere for automation-first / cross-system orchestration / no-code customization. **WebFetch returned EMPTY (JS SPA); findings from two WebSearch snippets** (MEDIUM — competitor's blog, discount bias).
- `rmax.ai` enterprise-AI-agents note — search-first vs pre-synthesized-model framing. Via WebSearch (LOW-MEDIUM).

**Cross-checked against internal:** `.planning/research/FEATURES.md` (first-pass Glean row — this deepens & corroborates it), `.planning/research/SUMMARY.md` (graded-governance framing), SEED-123, SEED-013 (MCP/connector verdict), SEED-051/085/086 (authoring reuse).

---
*Deep dive for: v3.6 Visual / No-Code Workflow Studio — competitor Glean AI*
*Researched: 2026-07-24 · Author-mechanics HIGH · Q2 graded-governance MEDIUM-HIGH (rests partly on a documented negative claim, flagged) · connectors/observability/enforcement HIGH*
