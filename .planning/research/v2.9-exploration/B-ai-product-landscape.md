# B — AI Product Landscape: Knowledge-Grounded Domain Workflows & Agentic Playbooks

**Research date:** 2026-06-08
**Scope:** How shipping products implement KB-grounded, project/workspace-scoped, recurring domain workflows — and what that means for Agentic RAG v2.9 (make workflows REAL and domain-grounded; project = folder owns a workflow library; template-fill from KB; PM as flagship demo).
**Method:** ~16 web searches + targeted doc fetches across product docs, changelogs, and reviews. All claims cited inline.

---

## Headline

Every serious "Work AI" product has converged on the **same authoring spine**: *describe the agent/workflow in natural language → the platform drafts steps/instructions + recommends knowledge sources & tools → you refine on a visual canvas or in fields → publish → it runs on triggers (manual / scheduled / event)*. Knowledge is **bound by a scope object** (workspace / Space / teamspace / folder / data-source set) that is **permission-aware**, and the strongest products separate a **deterministic, locked flow** from an **agentic reasoning** step inside it. Agentic RAG already owns the two hardest primitives in this stack — a **deterministic locked harness** and a **scoped KB with hybrid retrieval** — that most competitors bolt on awkwardly. The net-new v2.9 work is mostly **authoring UX, a project/scope object, the skills↔workflow wire, scheduled triggers, and true template-fill** — not new runtime.

---

## Per-product survey

For each: **AUTHOR** (how a workflow is created) · **KB BINDING** (how it's scoped to knowledge) · **DELIVERABLE** (structured output shape) · **RECURRING** (scheduling/triggers) · **HITL** (human-in-the-loop).

### Glean — Agents / Agent Builder (the closest analog to our goal)
- **AUTHOR:** Unified builder that **combines graph-based (visual steps) and conversational (NL) creation**; you can switch between them freely. Describe the agent's purpose in plain language → it auto-generates steps; then take "precise control over any step's configuration, models, or triggers." Every agent = **a trigger + a sequence of steps**; each step performs an **action**, applies **flow logic** (branch/loop/sub-agent call), or calls **another agent**. ([how-agents-work](https://docs.glean.com/agents/how-agents-work), [agent-builder concept](https://docs.glean.com/agents/concepts/agent-builder), [create-agent-natural-language](https://docs.glean.com/agents/create-agent-natural-language))
- **KB BINDING:** Agents run on **live, permission-aware company knowledge** spanning 100+ connected apps; "every output stays grounded, accurate, and secure." A **library of actions** (read/write across systems) plus the retrieval engine is the substrate. ([agent-builder product](https://www.glean.com/product/agent-builder), [agents launch](https://www.glean.com/blog/glean-agents-launch-blog))
- **DELIVERABLE:** Reports, drafted emails, messages, data writes back to source systems — output shape is action-defined, not a single canvas.
- **RECURRING:** **Scheduled triggers** with frequency/time/timezone; also manual (from Library) and **content/system-update** triggers. **Cap: 10 active background scheduled agents per user.** ([schedule-triggers](https://docs.glean.com/agents/concepts/schedule-triggers))
- **HITL:** Memory log per run; steps can request input. Orchestration emphasizes governance/control framework over agents. ([nojitter coverage](https://www.nojitter.com/ai-automation/glean-unveils-framework-for-controlling-ai-agents))
- **Memory model worth stealing:** by default "each step inherits only the output of the one immediately preceding it," and you use `[[ ]]` syntax to reference a specific earlier step's output — explicit, bounded context passing instead of dumping full history.

### Microsoft Copilot Studio — Agent flows & Workflows (+ M365 Copilot declarative agents)
- **AUTHOR:** **Two creation paths**: (1) **Natural language** — "describe what you need… Copilot Studio interprets your intent and creates an agent flow," then edit in the designer; (2) **Designer** — drag-and-drop nodes on a visual canvas with actions, conditions, loops, expressions. New **Workflows** (public preview) add "native AI actions, agent handoffs, and node-level testing." ([flows-overview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-overview))
- **KEY DISTINCTION (directly relevant to our harness):** Agent flows/workflows are **deterministic** — "they execute actions following a rule-based path. The same input always produces the same output." You **embed an agent at a prescribed step** so the workflow can "delegate reasoning, decisions, or output generation to an agent at any prescribed step." This is *exactly* our locked-harness-with-an-`llm_agent`-phase model. ([flows-overview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-overview), [April 2026 blog](https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/new-and-improved-agent-governance-intelligent-workflows-and-connected-app-experiences/))
- **KB BINDING:** Knowledge sources = SharePoint, Dataverse/Dynamics, websites, files, **People** (directory). **Hard limits: max 500 knowledge objects per agent, only 5 active sources at a time.** URL **variables** dynamically scope which content is grounded at runtime. "Work IQ" toggle for better SharePoint retrieval. ([knowledge summary](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-copilot-studio), [add SharePoint](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-add-sharepoint))
- **DELIVERABLE:** AI actions can "generate text, process documents, run a prompt on a model… **and natural language file generation**" (Ignite 2025). Connectors write to M365/3rd-party systems. ([Nov 2025 update](https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/whats-new-in-microsoft-copilot-studio-november-2025/))
- **RECURRING:** Triggers = **instant (manual) / scheduled / event-driven**; **autonomous agents** "wait for specific events and execute actions when that event happens." Flows can be added as **tools inside other agents** ("When an agent calls the flow"). ([flows-overview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-overview))
- **HITL:** First-class **"Human in the loop" action type** — "approval requests or providing information" as explicit nodes. ([flows-overview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-overview))
- **LIFECYCLE:** Flows live in **solutions** with **drafts + versioning + export/import** — and capacity is metered per action (governance + cost surface). ([flows-overview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-overview))

### Microsoft Planner — Project Manager agent (PM flagship in the wild)
- **AUTHOR:** No authoring — it's a **prebuilt domain agent**. You give it a **goal**; it "automatically breaks them down into actionable tasks" and "can execute these tasks on your behalf." ([Planner agents blog](https://techcommunity.microsoft.com/blog/plannerblog/unleashing-the-power-of-agents-in-microsoft-planner/4304794))
- **DELIVERABLE (the PM-structured-output proof point):** "generate a **comprehensive plan with structure** — **hierarchy and organization, with goals to group related work, plus buckets and notes**." This is the market validating that *AI-generated structured PM artifacts (WBS-like hierarchies, grouped goals)* is a real, shipping deliverable shape. ([next chapter blog](https://techcommunity.microsoft.com/blog/plannerblog/the-next-chapter-for-ai-powered-work-management-in-microsoft-planner/4469796))
- Requires a **Copilot license**; rolled out from Aug 2025. ([MC1117098](https://mc.merill.net/message/MC1117098))

### Notion — 3.0 / 3.3 Agents & Custom Agents
- **AUTHOR:** **Custom Agents** authored via **natural-language instructions** that serve as "the agent's operating manual… stored on a Notion page (essentially its system prompt)." Personal **Notion Agent** is on-demand chat; **Custom Agents** are "team-wide AI teammates that run automatically on schedules or triggers." ([custom agents help](https://www.notion.com/help/custom-agents), [3.3 release](https://www.notion.com/releases/2026-02-24))
- **KB BINDING (best-in-class least-privilege model):** "Agents act **only on the pages, databases, and external apps you explicitly grant access to**, and **never have full workspace access by default**." Recommended pattern: "start the agent in a **dedicated teamspace with restricted scope**." This is essentially **our "project = folder owns workflows + scoped KB" idea, already shipped**. ([build first custom agent](https://www.notion.com/help/guides/build-your-first-custom-agent), [granular permissions](https://notioners.com/notion-30-the-era-of-custom-agents-and-granular-permissions))
- **DELIVERABLE:** Creates/edits **pages and databases at scale** ("updating or creating hundreds of pages at once") + drafts docs. Output is native Notion objects (the workspace *is* the canvas). ([2025-09-18 release](https://www.notion.com/releases/2025-09-18))
- **RECURRING:** **Recurring trigger** in agent Settings → Triggers; frequency every day/week/month/year + time + timezone. ([custom agents help](https://www.notion.com/help/custom-agents))
- **HITL:** Least-privilege scoping is the safety model; agents request access rather than assume it.

### Asana — AI Studio (Smart Workflows)
- **AUTHOR:** **No-code builder** modeled on Asana's existing **rules engine: triggers → conditions → actions**, but you "provide instructions to Asana AI **in natural language and via reference materials**" for steps needing complex logic. Build from scratch **or** start from a **Smart Template gallery**. ([AI Studio product](https://asana.com/product/ai/ai-studio), [smart workflows help](https://help.asana.com/s/article/ai-studio-smart-workflows))
- **KB BINDING:** Grounded in Asana's **Work Graph** ("who is doing what work, by when, how, and why") + attached reference materials. Scope = the project/portfolio the workflow lives in.
- **DELIVERABLE:** Tasks created/triaged, fields set, recommendations, discovery questions, summaries — written into Asana objects. Example: auto-evaluate new project requests, score priority, recommend resources. ([Asana announcement](https://investors.asana.com/news-releases/news-release-details/asana-announces-ai-studio-no-code-builder-designing-and))
- **RECURRING:** Trigger-driven (new request, status change, schedule) via the rules engine.
- **HITL:** Human steps via the rules/approval model; AI steps embedded between human checkpoints.

### Monday.com — AI Blocks / Agent Builder / "Digital Workforce"
- **AUTHOR:** **Agent Builder** — "build any agent **from a prompt**"; also **bring your own external agents** (Claude/ChatGPT/Copilot/Gemini). Composability via **"AI Blocks"** (modular AI steps dropped into automations). ([monday AI info](https://monday.com/w/ai-info), [VentureBeat](https://venturebeat.com/ai/inside-mondays-ai-pivot-building-digital-workforces-through-modular-ai))
- **KB BINDING:** Scoped to boards/workspaces; agents read board data and docs.
- **DELIVERABLE:** Status updates, risk analysis, surfaced stuck items, drafted updates — written into board items.
- **RECURRING:** "Digital Workforce… designed to work around the clock"; automation recipes + scheduled/event triggers.
- **HITL:** Embedded in monday's automation recipe model (approvals/assignments).

### ClickUp — Brain / Autopilot Agents / Super Agents
- **AUTHOR:** **Autopilot Agents** = "customizable, no-code AI bots" configured with **Instruction + Knowledge + Tools** and **triggers/conditions**; the catch-all action is **"Do anything with AI."** **Super Agents** are multi-step workspace teammates. (Notably, **prebuilt Autopilot Agents were deprecated Dec 2025** in favor of custom + Ambient Answers — a signal that *rigid prebuilt templates underperformed customizable ones*.) ([create autopilot agents](https://help.clickup.com/hc/en-us/articles/31012020810775-Create-and-configure-Autopilot-Agents), [what are autopilot agents](https://help.clickup.com/hc/en-us/articles/37045015737111-What-are-Autopilot-Agents))
- **KB BINDING:** Per-agent **Knowledge** = "Add from Spaces," specific tasks/Docs/Chats, plus external apps via toggles; **permissions-aware** real-time syncing. ([what is ClickUp Brain](https://help.clickup.com/hc/en-us/articles/12578085238039-What-is-ClickUp-Brain))
- **DELIVERABLE:** Tasks created, statuses updated, client emails, meeting-notes→tasks.
- **RECURRING:** Trigger + condition driven; scheduled & event triggers.
- **HITL:** Configurable per agent.

### Dust.tt — Agent Builder + Spaces (the cleanest scope model)
- **AUTHOR:** Builder with **five sections** (Instructions, Tools & Knowledge, Capabilities, Triggers, model). **Instructions** are the NL core (role, process, output format, constraints). **Sidekick** = in-builder AI helper that "turns building agents into a guided conversation," drafting instructions and **recommending tools/knowledge sources/model** from your NL goal. ([quickstart](https://docs.dust.tt/docs/quickstart-agent), [first agent academy](https://dust.tt/academy/build-your-agents/chapter/first-agent))
- **KB BINDING (model to copy):** **Spaces** = permission boundary. "**Each agent belongs to exactly one Space and can only access data from that Space.**" Spaces are **open** (all members) or **restricted**; a default **"Company Data"** space exists. "A user can only invoke an agent if they have access to **all** of its referenced Spaces." **Agent permissions are managed independently from user permissions.** This is the canonical answer to *"project = folder owns a library of workflows + scoped KB."* ([access controls](https://docs.dust.tt/docs/access-controls-and-permissions), [creating spaces](https://docs.dust.tt/docs/data))
- **DELIVERABLE:** Chat answers + tool actions (draft emails, update CRM, browse web, run code).
- **RECURRING:** **Triggers** "determine when an agent is called automatically" (schedule + events).
- **HITL:** Publish gate (published = visible to all with data access; unpublished = editors only); capability-level guarding.
- **Skills note:** Dust also has a **"Skills"** concept ([docs/skills](https://docs.dust.tt/docs/skills)) — confirming the industry is converging on the *skills-as-reusable-capability* primitive we already ship.

### Hebbia — Matrix (agentic spreadsheet; the deliverable-shape standout)
- **AUTHOR:** Build **templates + workflows** specific to your needs and **share across teams**; the unit of work is a **Matrix** (rows = documents, columns = questions). Multi-agent: a Matrix Agent does **Document Retrieval + Column Generation (decompose request into fields) + Information Synthesis (produce well-formatted outputs)**. ([multi-agent redesign](https://www.hebbia.com/blog/divide-and-conquer-hebbias-multi-agent-redesign), [techtimes](https://www.techtimes.com/articles/311222/20250707/hebbia-matrix-transforms-knowledge-work-how-financial-giants-process-millions-documents-minutes.htm))
- **KB BINDING:** Runs LLMs "at scale over a **near-unlimited corpus of documents**"; the matrix's row-set *is* the scope.
- **DELIVERABLE (differentiator):** **A spreadsheet/grid is the deliverable** — every cell is an agent-filled, **citation-traceable** answer ("every insight can be traced back to its source documents"). For PM, this maps near-perfectly to a **risk register / RTM / stakeholder matrix** as a grid of (item × attribute) cells.
- **RECURRING:** Templates re-runnable over new document sets.
- **HITL:** Transparency-first (step decomposition visible, citations clickable) rather than approval gates.

### Workflow/iPaaS-AI tier — Gumloop, Relay.app, n8n
- **Gumloop:** **Node-based drag-and-drop canvas**; nodes = fetch/extract/LLM-reason/Python/browser-agent. **"Gummie"** AI assistant generates nodes from NL. Triggers: **manual / schedule / webhook**; cloud execution with **per-node run history** for debugging. ([Zapier explainer](https://zapier.com/blog/what-is-gumloop/), [DataCamp tutorial](https://www.datacamp.com/tutorial/gumloop-tutorial))
- **Relay.app (best HITL model):** Automated steps **+ explicit human gates**. "Turn on human review for **any AI step with a single toggle**" → output routed to email/Slack to **approve / revise / send back**, then the run continues. HITL step types: **Approval, Get Data Input (form), Complete a Task, Path selection** — all actionable from Slack. ([HITL feature](https://www.relay.app/features/human-in-the-loop), [how it works](https://www.relay.app/how-it-works))
- **n8n:** **Visual node canvas**; **AI Agent node** (LangChain-powered) takes a chat model + optional **vector store** + tool sub-nodes; memory via window-buffer/summary/Postgres-by-session. Triggers: **Webhook / Schedule** (e.g., daily 9 AM). 70+ AI nodes. ([AI Agent node docs](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/), [advanced AI](https://docs.n8n.io/advanced-ai/))

### Sana (now Workday) — enterprise knowledge agents
- **AUTHOR:** **No-code, multi-step** agent/workflow builder; Find/Answer → Act → Automate. Reasoning "in multiple steps about what knowledge sources are relevant, how they combine, and what action to take." ([Sana product](https://sanalabs.com/products/sana/), [Workday intro](https://newsroom.workday.com/2026-03-17-Introducing-Sana-from-Workday...))
- **KB BINDING:** Connects 100+ apps, **respects native permissions**, unifies company data securely.
- **DELIVERABLE:** Answers, drafted documents, multi-step automations across connected systems.
- **HITL/RECURRING:** Behind-the-scenes automation + assistant; permission-grounded action.

### Template-fill specialist — TurboDocx (the exact "fill THIS template from KB" mechanic)
- **AUTHOR:** Upload a **DOCX/PPTX template** with **`{Variable}` placeholders** (single fields like `{CustomerName}` or whole sections like `{Scope}`). ([templating product](https://www.turbodocx.com/products/turbodocx-templating), [how to create template](https://docs.turbodocx.com/docs/TurboDocx%20Templating/How%20to%20Create%20a%20Document%20Template/))
- **KB BINDING:** "If the variable has the **same name as something in your Knowledge base, TurboDocx will use the info from the Knowledge base to fill in the corresponding Variable**." Plus a **Lookup** picker for pre-approved content and an **AI Variable Generation API** that analyzes uploaded files to synthesize variable content. ([AI variable generation](https://docs.turbodocx.com/docs/TurboDocx%20Templating/ai-variable-generation/))
- **DELIVERABLE:** The **exact uploaded template, filled** — DOCX/PPTX/PDF export. This is precisely v2.9's "upload a template temporarily → fill it from KB." Our Docker sandbox already has `python-docx`/`python-pptx`/`openpyxl`/`reportlab` to do this.

---

## Cross-cutting patterns (what "everyone" converged on)

| Dimension | Dominant pattern across products |
|---|---|
| **Authoring** | **NL-first draft → visual/field refine**, hybrid and reversible. NL alone is the on-ramp; a canvas/fields is the precision layer. Glean, Copilot Studio, Dust (Sidekick), monday, Gumloop (Gummie) all ship this exact pair. |
| **Templates** | A **template/gallery** of pre-built workflows is table stakes — but **rigid prebuilt agents are being deprecated** (ClickUp Dec 2025) in favor of **customizable** ones seeded from templates. |
| **KB binding** | A **named scope object** (Space / teamspace / workspace / board / folder) that is **permission-aware**, with **least-privilege default** (Notion, Dust). Agent permissions often **decoupled from user permissions**. |
| **Determinism** | The mature products **separate a deterministic rule-based flow from an embedded agentic step** (Copilot Studio is explicit: "same input → same output," with an agent delegated at a "prescribed step"). |
| **Deliverables** | Three shapes dominate: **(a) native objects** (tasks/pages/db rows — Notion/Asana/ClickUp/monday), **(b) a citation-traceable grid** (Hebbia), **(c) a filled document/file** (Copilot file-gen, TurboDocx). |
| **Recurring** | **Manual / scheduled (freq+time+timezone) / event-driven** triggers are universal; per-user scheduled-agent caps are common (Glean: 10). |
| **HITL** | **Approval + data-input + task-completion** checkpoints as explicit steps, routed to chat/email with approve/revise/reject, run pauses & resumes (Relay.app is the gold standard; Copilot Studio has a HITL action type). |
| **Run honesty** | **Per-step run history / node-level testing / clickable citations** for trust (Gumloop per-node outputs, Copilot node-level testing, Hebbia citations). |

---

## TABLE STAKES (must-have to be credible in this category)

1. **NL-to-draft authoring** — user describes the workflow in plain language; system drafts the steps + suggests tools/knowledge. (Glean, Copilot, Dust, monday, Asana, Gumloop, Notion.)
2. **A starter template gallery** for the domain — but **fully editable**, never locked-prebuilt-only.
3. **A permission-aware knowledge scope object** the workflow is bound to (workspace/Space/teamspace/folder). Least-privilege by default.
4. **Trigger model: manual + scheduled (freq/time/timezone) + event.** Scheduling is expected, not premium.
5. **Structured deliverables** beyond chat text — write into native objects, a grid, or a generated file.
6. **HITL approval checkpoints** — pause for approve/revise/reject; resume.
7. **Run history / observability** — per-step inputs/outputs, status, and (for KB) **citations to source**.
8. **Reusable, shareable workflow definitions** with publish + versioning, scoped to a team.

## DIFFERENTIATORS (what stands out / where to win)

1. **Deterministic locked harness with an agentic phase inside it.** Copilot Studio markets "same input → same output" + "delegate reasoning to an agent at a prescribed step" as a *premium enterprise* capability. **We already have this as our core runtime** (5 phase types, validation gates, caps, immutable-on-publish, Postgres-resumable). Most competitors are *adding* determinism to an agent; we *start* deterministic and add agency — the stronger position for compliance-sensitive domains (PM, legal, finance).
2. **True template-fill of an uploaded artifact.** TurboDocx is a whole product around `{Variable}`→KB matching. Few "Work AI" platforms fill *your exact DOCX/PPTX*; most generate a new doc from scratch. We have the sandbox + libraries to do real template-fill — a sharp, demoable wedge.
3. **Citation-traceable grid deliverable (Hebbia-style) for PM matrices.** A risk register / RTM / stakeholder matrix rendered as an (item × attribute) grid where each cell cites the KB source is a differentiated, trust-building output our hybrid retrieval can ground.
4. **Skills wired to workflows.** Anthropic-style **Agent Skills = portable procedural playbooks** ("turn instructions into reusable playbooks Claude calls when needed"). We already ship a skills system; **connecting skills → workflow phases → project scope** is a coherent story almost nobody has cleanly assembled. (Dust is the only one with a parallel "Skills" concept.)
5. **One scope object that co-owns documents + workflows + skills** (a "project" = folder + subfolders). Dust binds agents to Spaces and Notion binds agents to teamspaces, but neither cleanly unifies *KB + workflow library + skills* under one project boundary the way our folder model could.
6. **Per-step bounded context passing** (Glean's `[[ ]]` reference + "inherit only previous step output") — a clean, debuggable alternative to dumping full history; cheap to adopt in our harness.

## ANTI-FEATURES (over-engineered traps to avoid)

1. **A full visual node-graph editor for end users.** n8n/Gumloop power is real but the reviews flag **steep complexity**. Our buyer is a *domain expert*, not an automation engineer. **NL-authoring + a readable linear/phase view** beats a free-form DAG canvas for v2.9. Don't build a general iPaaS.
2. **Rigid prebuilt-only agents.** ClickUp **deprecated prebuilt Autopilot Agents (Dec 2025)** because customizable ones won. Ship templates as **editable seeds**, not as the product.
3. **Per-action metered-capacity billing surfaced to authors.** Copilot Studio's "agents rack up pay-as-you-go charges before IT knows," "no single dashboard," "governance nightmares" are its loudest complaints. Don't make cost/credits a thing the author has to reason about mid-build.
4. **Becoming a 100+ connector iPaaS.** Glean/Sana/Notion lean on huge connector catalogs — that's a multi-year integrations org, not a v2.9 milestone. Our CLAUDE.md already forbids connectors; **stay KB + sandbox + template-fill scoped.**
5. **Unbounded autonomy / "20-minute multi-step" agent theater.** Notion markets 20-min autonomous runs; for a deterministic-harness product the value is **reliability and auditability**, not max autonomy. Resist the autonomy arms race.
6. **Heavy ALM/solutions packaging (export/import/managed-solution layers).** Copilot Studio's solution/ALM machinery is a top pain point. Keep publish/version **simple** (we already have immutable-on-publish + INSERT-only audit — don't gold-plate it).
7. **5-source / 500-object artificial caps** (Copilot Studio). Our pgvector KB has no such ceiling — don't import arbitrary limits; folder-scope naturally bounds retrieval.

---

## Maps to OUR primitives vs net-new

### Already owned (do NOT rebuild — leverage/expose)
| Market capability | Our existing primitive |
|---|---|
| Deterministic locked flow + agentic step | **Harness Engine** (5 phase types incl. `llm_agent`, `llm_human_input`; validation gates + caps; immutable-on-publish; Postgres-resumable) |
| Per-phase tool whitelist / capability guarding | **Per-phase tool whitelist** |
| HITL approval/data-input checkpoint | **`llm_human_input` (ask_user pause/resume)** — already the Relay.app/Copilot "Human in the loop" node |
| Permission-aware knowledge scope | **Folders + RLS + folder-scoped chat/retrieval** (global + per-user) |
| Citation-grounded retrieval | **Hybrid search (keyword+vector, RRF) + query_tables** |
| Generated-file / template-fill execution | **Per-thread workspace + Docker sandbox** (python-docx/pptx/openpyxl/reportlab/pandas) |
| Reusable procedural playbooks | **Skills system** (catalog injection, load/save/read, ZIP import/export) |
| Audit/run honesty | **INSERT-only audit trail** + existing run-status UI |
| Sub-agent fan-out (Hebbia-style parallel cells) | **`llm_batch_agents` (N-way fan-out)** + `task` sub-agents |

### Net-new for v2.9 (the actual build surface)
1. **Project = folder-scoped workflow library** — a scope object that **co-owns** a folder's KB **+ a library of workflows + the skills** available to them. (Net-new association/UI; reuses folders, harness, skills, RLS. Model after **Dust Spaces** / **Notion teamspace least-privilege**.)
2. **Workflow authoring UX** — currently SQL-seed/prompt only. Build the **NL-to-draft → editable phase view** on-ramp (the universal pattern). Spike-first per the deferred plan; **avoid a node-graph canvas** (anti-feature).
3. **Skills↔workflow wire** — let a workflow phase declare which skill(s) it loads; bind skill availability to project scope. (Net-new wiring; primitives exist.)
4. **Ephemeral template upload + template-fill phase** — a temporary (non-ingested) DOCX/PPTX/XLSX upload + a phase that **retrieves from the project KB and fills that exact template** (TurboDocx `{Variable}`→KB pattern, executed in our sandbox). No persistent ingestion; this is the missing "temporary upload" flow called out in v2.9.
5. **Scheduled / recurring triggers** — harness runs are currently manual/prompted. Add **scheduled triggers (freq/time/timezone)** + likely event triggers. (Net-new scheduler; the runtime already resumes from Postgres. Consider per-user active-schedule caps à la Glean's 10.)
6. **Grid/matrix deliverable renderer** (optional differentiator) — a Hebbia-style **(item × attribute) citation-traceable grid** for PM matrices (risk register, RTM, stakeholder), backed by `llm_batch_agents` + retrieval. Net-new UI; runtime exists.
7. **A Workflows page** — the deferred "Workflows PAGE + authoring still unbuilt" gap; the home for the project's workflow library, run history, and schedules.

### Deferred-but-confirmed-relevant (validated by the landscape, not v2.9 core)
- **6-type Plugin Contract** — the market's `phase_type` / `panel_renderer` / `data_source` / `file_preview` extension points map to Glean's "library of actions" and Copilot's connector/AI-action model. Real, but a platform-extensibility milestone, not the v2.9 domain-grounding milestone.
- **Operator/admin role tier** — mirrors Dust's *agent-permissions-independent-from-user-permissions* and Notion's least-privilege grants; needed when projects are shared org-wide. Pair it with the project scope object when multi-tenant sharing lands.

---

## Implications for v2.9 scope decisions (bottom line)

- **Don't rebuild runtime.** The deterministic-harness-with-agentic-phase that Copilot Studio sells as premium is our *foundation*. v2.9 is **authoring + scope + scheduling + template-fill + the Workflows page**, not a new engine.
- **The unifying object is "project = folder."** Bind KB + workflow library + skills under one permission-aware folder scope (Dust Spaces / Notion teamspace as the reference models). This single object resolves requirements (1) and (2) at once.
- **Template-fill is the demoable wedge.** TurboDocx proves the mechanic; we have the sandbox + libraries; nobody in the "Work AI" tier fills *your exact uploaded artifact* well. Build the **ephemeral upload + fill-this-template phase**.
- **Author via NL, refine in a readable phase view — never a node graph.** Match the universal NL-first on-ramp; dodge n8n/Gumloop complexity and Copilot Studio's governance/cost trap.
- **PM as flagship, not hardcoded.** Planner's Project Manager agent (goals→hierarchy/buckets) and Hebbia's grids prove PM artifacts (WBS, risk register, RTM, stakeholder matrix) are real AI deliverables. Build them as **example workflow templates + a grid renderer**, authored on the same generic primitives any domain expert can use.
- **Scheduling is table stakes, scoped is easy.** Add freq/time/timezone triggers (+ optional event); the Postgres-resumable harness already supports the hard part. Consider a per-user active-schedule cap.

---

## Sources

**Glean:** [how-agents-work](https://docs.glean.com/agents/how-agents-work) · [agent-builder concept](https://docs.glean.com/agents/concepts/agent-builder) · [schedule-triggers](https://docs.glean.com/agents/concepts/schedule-triggers) · [create-agent-natural-language](https://docs.glean.com/agents/create-agent-natural-language) · [agent-builder product](https://www.glean.com/product/agent-builder) · [agents launch blog](https://www.glean.com/blog/glean-agents-launch-blog) · [press: Glean Agents](https://www.glean.com/press/glean-makes-horizontal-ai-agents-for-enterprises-expands-work-ai-with-glean-agents)
**Microsoft Copilot Studio / Planner:** [flows-overview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-overview) · [knowledge summary](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-copilot-studio) · [add SharePoint](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-add-sharepoint) · [Nov 2025 update](https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/whats-new-in-microsoft-copilot-studio-november-2025/) · [April 2026 governance/workflows](https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/new-and-improved-agent-governance-intelligent-workflows-and-connected-app-experiences/) · [Planner agents](https://techcommunity.microsoft.com/blog/plannerblog/unleashing-the-power-of-agents-in-microsoft-planner/4304794) · [Planner next chapter](https://techcommunity.microsoft.com/blog/plannerblog/the-next-chapter-for-ai-powered-work-management-in-microsoft-planner/4469796) · [PM agent preview MC1117098](https://mc.merill.net/message/MC1117098) · [Copilot Studio honest review](https://ragnarheil.de/the-good-the-bad-and-the-ugly-of-copilot-studio-a-brutally-honest-review-going-into-late-2025/) · [licensing guide](https://samexpert.com/copilot-studio-licensing-guide/)
**Notion:** [3.0 release](https://www.notion.com/releases/2025-09-18) · [3.3 custom agents](https://www.notion.com/releases/2026-02-24) · [custom agents help](https://www.notion.com/help/custom-agents) · [build first custom agent](https://www.notion.com/help/guides/build-your-first-custom-agent) · [granular permissions](https://notioners.com/notion-30-the-era-of-custom-agents-and-granular-permissions) · [TechCrunch](https://techcrunch.com/2026/05/13/notion-just-turned-its-workspace-into-a-hub-for-ai-agents/)
**Asana:** [AI Studio product](https://asana.com/product/ai/ai-studio) · [smart workflows help](https://help.asana.com/s/article/ai-studio-smart-workflows) · [announcement](https://investors.asana.com/news-releases/news-release-details/asana-announces-ai-studio-no-code-builder-designing-and)
**Monday:** [AI info](https://monday.com/w/ai-info) · [VentureBeat AI pivot](https://venturebeat.com/ai/inside-mondays-ai-pivot-building-digital-workforces-through-modular-ai)
**ClickUp:** [create autopilot agents](https://help.clickup.com/hc/en-us/articles/31012020810775-Create-and-configure-Autopilot-Agents) · [what are autopilot agents](https://help.clickup.com/hc/en-us/articles/37045015737111-What-are-Autopilot-Agents) · [what is ClickUp Brain](https://help.clickup.com/hc/en-us/articles/12578085238039-What-is-ClickUp-Brain) · [Super Agents](https://clickup.com/brain/agents)
**Dust:** [quickstart](https://docs.dust.tt/docs/quickstart-agent) · [first agent academy](https://dust.tt/academy/build-your-agents/chapter/first-agent) · [access controls](https://docs.dust.tt/docs/access-controls-and-permissions) · [creating spaces](https://docs.dust.tt/docs/data) · [skills](https://docs.dust.tt/docs/skills) · [tools](https://docs.dust.tt/docs/tools)
**Hebbia:** [multi-agent redesign](https://www.hebbia.com/blog/divide-and-conquer-hebbias-multi-agent-redesign) · [TechTimes](https://www.techtimes.com/articles/311222/20250707/hebbia-matrix-transforms-knowledge-work-how-financial-giants-process-millions-documents-minutes.htm) · [Medium: system of record](https://medium.com/@takafumi.endo/hebbias-edge-building-a-system-of-record-for-enterprise-reasoning-1264ab76ec6b)
**Gumloop / Relay / n8n:** [Gumloop via Zapier](https://zapier.com/blog/what-is-gumloop/) · [Gumloop DataCamp](https://www.datacamp.com/tutorial/gumloop-tutorial) · [Relay HITL](https://www.relay.app/features/human-in-the-loop) · [Relay how-it-works](https://www.relay.app/how-it-works) · [n8n AI Agent node](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/) · [n8n advanced AI](https://docs.n8n.io/advanced-ai/)
**Sana:** [product](https://sanalabs.com/products/sana/) · [Workday intro](https://newsroom.workday.com/2026-03-17-Introducing-Sana-from-Workday-Superintelligence-for-Work-That-Finds-Answers,-Takes-Action,-and-Automates-Workflows)
**Template-fill:** [TurboDocx templating](https://www.turbodocx.com/products/turbodocx-templating) · [TurboDocx template how-to](https://docs.turbodocx.com/docs/TurboDocx%20Templating/How%20to%20Create%20a%20Document%20Template/) · [TurboDocx AI variable generation](https://docs.turbodocx.com/docs/TurboDocx%20Templating/ai-variable-generation/)
**Skills-as-playbooks:** [Anthropic Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) · [Claude Agent Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
**PM artifacts (RAID/risk/WBS):** [monday risk register](https://monday.com/blog/project-management/risk-register/) · [Asana RAID log](https://asana.com/resources/raid-log) · [RAIDLOG AI](https://raidlog.com/ai/)
