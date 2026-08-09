# Deep Dive: n8n — the open-source node-canvas reference

**For:** v3.6 Visual / No-Code Workflow Studio (SEED-123 hard-req #2 — "study best-in-class and beat them")
**Researched:** 2026-07-24
**Method:** docs.n8n.io tree (the `/build/integrate-ai/...`, `/build/understand-workflows/...`, `/administer/...`, `/integrations/...` `.md` pages), n8n.io landing + integrations directory, the security CVE writeups (Upwind + GitHub issue #28218), plus independent community/analysis corroboration via web search.
**Overall confidence:** HIGH on the governance/grounding answer (Q2), the CVE lessons (Q5), and the RBAC/credential model (Q5); HIGH on the complexity trap (Q1) and MCP (Q4); MEDIUM on exact connector counts (marketing vs directory discrepancy — see Q4).

> **Headline for the orchestrator.** Two findings dominate. **(Q2)** n8n has **no governance grading by grounding — none.** RAG in n8n is composed by *wiring* a vector-store/retriever into an Agent-as-tool or a Q&A Chain; there is **zero** grounding-confidence gate, **zero** citation-required enforcement, **zero** similarity-threshold cut-off, and **no structural way to tell a "grounded" step from an "open" step.** Any strictness at all (a Guardrails node, an Evaluations run) is an *optional node the user must manually drop on the canvas*, is *content-safety or offline-testing*, and is *never* author-time structural grounding. **Our graded-strict engine — strict-when-retrieving-from-KB, flexible-for-open-agentic, enforced structurally at author-time — is a category differentiator n8n cannot copy without rebuilding its model.** **(Q5)** The n8n CVE class is a gift-wrapped anti-pattern list for CONN-03: the SSRF guard *lived inside the credential-validation path*, so it only fired **when a credential was attached** — a bare HTTP node hit `169.254.169.254` unchallenged. The lesson is exact: **SSRF/egress guards must be unconditional, decoupled from credentials, applied to every outbound fetch.**

---

## Q1 — Canvas / authoring UI mechanics (the drag-and-drop reference)

### The node-and-edge model

n8n's canvas is an **infinite 2-D pane** where **each node = one action** and **connections carry data left→right** (n8n.io: *"Build visually, go deep with code, connect to anything"*; docs: *"a connection between two nodes passes data from one node's output to another node's input"*). **Confidence: HIGH.**

- **Adding a node:** click the `+` (top-right or the grey `Add node` handle on any node), search the node palette (1,900+ entries — see Q4), pick it; it drops on the canvas already wired to the previous node's main output.
- **Connecting:** *"select the grey dot or Add node on the right side of a node and slide the arrow to the grey rectangle on the left side"* of the target. **Left = input port, right = output port.** Deleting = hover the wire → Delete.
- **Configuring:** double-click a node → a **right-hand parameter panel** (the "NDV" — node detail view) opens with that node's fields, an **input-data pane (left)** and **output-data pane (right)** inside the modal, so you configure a node while *seeing the real data flowing into it*. This is n8n's single strongest UX idea: config and live data preview are the same surface.
- **A trigger node starts every workflow** (webhook, schedule, chat, form, manual). Regular nodes can't run without an upstream trigger.

### The distinctive part — AI "cluster nodes" and sub-node ports

n8n's AI canvas is **not** the same left→right main-flow model. An **AI Agent (or Chain) node exposes *downward* ports** for typed **sub-node** connections: **Chat Model**, **Memory**, **Tool**, **Output Parser** each snap onto a labelled port *below* the agent (docs: *"you must connect at least one tool sub-node to an AI Agent node"*; chat model required). So a RAG agent is visually a **root node with a fan of sub-nodes hanging off it** (model + memory + a Vector Store tool + a few other tools), while the *main* left→right flow carries the business data. **Confidence: HIGH.** This two-axis model (horizontal data-flow + vertical capability-attach) is powerful but is exactly where legibility starts to fray.

### Supporting authoring affordances

- **Sticky Notes** — free-text annotation boxes on the canvas (docs: `add-notes-and-documentation`); the primary "explain this to a human" tool. **Confidence: HIGH.**
- **Canvas Groups / sections** — visually group related nodes (`canvas-groups`). **Confidence: HIGH.**
- **Sub-workflows** — the *official* answer to canvas crowding: extract a chunk into an "Execute Sub-workflow" node so the parent shows high-level orchestration and detail lives elsewhere (docs: `break-workflows-into-smaller-parts`, `convert-to-sub-workflows`). **Confidence: HIGH.**
- **Templates** — a large public template gallery (n8n.io/workflows) seeds a canvas from a shared JSON.
- **AI-assist authoring** — **AI Workflow Builder (Beta, launched 2025-10-13)** + the newer **n8n AI Assistant**: describe a workflow in natural language → it *selects, places, configures, and connects* nodes into a draft you then refine; can also create/edit/test/troubleshoot from chat. This is the *same* "describe → draft → edit" pattern we already own (SEED-051/Phase 103). **Confidence: HIGH** (docs + community launch posts corroborate; exact model list MEDIUM).

### ★ The open-canvas complexity trap (get specifics — this is our top anti-feature validator)

The free-form canvas is n8n's power *and* its documented failure mode. Concrete, independently-reported thresholds (**Confidence: MEDIUM-HIGH** — community + multiple analyses, not a single marketing source):

- *"For workflows beyond **20–30 nodes**, users face challenges with debugging errors taking time, **non-technical teammates struggling to follow the flow**, and scaling workflows introducing brittle points."*
- *"Monolithic workflow design with everything crammed into one canvas with **50+ nodes** can become difficult to debug when something breaks."*
- *"A **200-node** workflow has become **impossible to maintain, debug, or explain to anyone**, with every change risking breaking something else."*
- The community's own mitigations — **modularity, sub-workflows, naming conventions, architecture-planning-before-building** — are all *manual discipline the tool doesn't enforce.* n8n gives you a blank infinite canvas and *hopes* you keep it clean.

**Two structural drivers of the crowding** (worth naming for our design):
1. **One node = one action**, so any real business process is dozens of nodes; there is no higher-level "phase" primitive that collapses a step's internals.
2. **The two-axis AI model** (horizontal data + vertical sub-node fans) multiplies visual density — a single agent step can carry 5–8 sub-nodes.

**Design implication for us (informs how we CONSTRAIN our canvas):** the trap is not "too many features," it's **an unconstrained grammar with no first-class unit of meaning above the raw node.** Our engine already *has* that unit — the **phase** (a governed, collapsible step with its own tool-whitelist and gate). A phase-spine canvas is inherently crowd-resistant because the atom is a business step, not a wire-level action, and because the grammar (ordered phases + one `skip_to_phase` branch) refuses the drag-anything-to-anything topology that produces 200-node spaghetti. **The complexity trap is simultaneously the anti-feature to reject and the argument for the constrained phase-spine.**

---

## Q2 — ★ GRADED GOVERNANCE (the operator's key question) — answered concretely

**Question restated:** In one n8n workflow, how is a **RAG/retrieval step** composed vs an **open AI-Agent/tool step**? Is there *any* grounding-confidence / citation-required / validation gating on a retrieval step? Can you tell which steps are grounded vs open, and does n8n enforce trust on the grounded ones?

### How n8n composes a retrieval (RAG) step — two ways, both free-form

**Confidence: HIGH** (read directly from `retrieve-relevant-context.md`, `what-agents-do.md`, `what-chains-do.md`, `how-tools-work.md`).

1. **Agent-with-vector-store-as-a-tool.** You build an **AI Agent** node and attach a **Vector Store** (e.g. "Simple Vector Store" / an external Pinecone/Qdrant node) as one of its **Tool** sub-nodes (often via a "Vector Store Question Answer tool" to save tokens). The agent *decides at runtime* whether to call the retrieval tool at all. Docs, verbatim on the retrieval methods: *"Uses an agent with the vector store as a tool"* and *"Uses the vector store node with 'Get Many' operation."*
2. **Question and Answer Chain.** A deterministic **chain** node wired to a **Retriever** (Vector Store Retriever *or* a Workflow Retriever). The chain *always* retrieves-then-answers in a fixed sequence — no LLM decision about whether to ground.

The **ingest half** is a separate wiring: a **Vector Store** node in "insert" mode + a **Default Data Loader** + a **Text Splitter** + an **Embeddings** sub-node.

### An "open" agent step is the *same node type*, minus the retrieval tool

An open agentic step is just an **AI Agent** node whose tools are *not* a vector store — Wikipedia, SerpAPI, HTTP Request Tool, Code Tool, Call-n8n-Workflow Tool, an MCP Client tool, etc. Docs: the agent is *"a chain that knows how to make decisions,"* it *"tries to choose the best tools to use to answer,"* running **iteratively** (plan → call tool → evaluate → repeat). **There is no node-type, flag, badge, or property that marks a step as "grounded" vs "open."** Grounded-vs-open is purely *whether the author happened to wire a vector store into the tool fan* — invisible at the workflow level, indistinguishable to a reviewer, unenforced. **Confidence: HIGH.**

### Is there ANY grounding-confidence / citation / validation gate on retrieval? — **NO.**

Read verbatim from the RAG doc (`retrieve-relevant-context.md`), **Confidence: HIGH**:

> **"The documentation contains no mention of grounding-confidence scores, citation enforcement, similarity thresholds, or validation gates on retrieval output."**

The doc *defines* groundedness as a concept (*"groundedness … measures … how much a model's responses accurately reflect source information"*) but ships **no mechanism** to measure or enforce it. There is:
- **No citation-required gate** — retrieved chunks are handed to the LLM as context; nothing forces the answer to cite them, and nothing blocks an uncited answer.
- **No confidence/similarity threshold gate** — retrieval returns top-k; there is no "if best-match score < X, refuse / escalate."
- **No structural distinction** — the workflow cannot express "this step MUST be grounded."

### The *only* strictness n8n has — and why it isn't graded governance

n8n *has recently added two safety-adjacent features*, but neither is grounding-graded governance, and **both are optional nodes the author must manually place** (**Confidence: HIGH** — docs + template gallery):

| Feature | What it actually is | Why it's NOT graded grounding governance |
|---|---|---|
| **Guardrails node** (`n8n-nodes-langchain.guardrails`) | A node you wire *between* generation and output that checks text for **PII / NSFW / jailbreak / secret-keys / unsafe-URLs / keyword / topical-misalignment**; the model scores on a **0–1 confidence scale, default threshold 0.7**, and classifies PASS/VIOLATION. | **Content-safety**, not grounding. Checks *toxicity/PII/injection*, never "is this answer supported by the retrieved sources / does it meet a confidence bar." **Opt-in and manually wired** — nothing forces it onto a retrieval step, and it's absent unless the author adds it. Same shape as Zapier's AI Guardrails. |
| **Evaluations** (AI eval framework) | An **offline dataset-based test harness** — run structured test cases against an AI workflow, compute accuracy metrics, produce reports (n8n blog "Production AI Playbook"). | **Offline testing / monitoring**, not a **runtime gate**. It scores a workflow *in a lab*; it does **not** block a *live* retrieval step that returns low-confidence or uncited output. No relationship to author-time structure. |

**Bottom line (Confidence: HIGH):** n8n governance is **access-control + optional content-safety + offline eval, all bolted on at run-time or test-time.** There is **no author-time, structural, grounding-aware strictness**, and **no graded model** where one step is strict-because-it-touches-the-KB and another is deliberately flexible-because-it's-open. **The operator's hypothesis is confirmed: n8n does not grade governance by grounding. Everything is free-form; trust on a grounded step is entirely the author's manual responsibility, invisible and unenforced.**

### Why this is our differentiator (carry into requirements)

Our engine already owns exactly what n8n lacks: a **phase** can be `citations_required` / `citations_optional`, a validation-gate library (`citations_required`, `freshness`, `structure_check`, `output_file_valid`, `llm_judge_rubric`) gates each step, folder-scope binds retrieval to a KB subtree server-side, and the publish gauntlet + `llm_judge` hard-wall block an ungrounded deliverable. **The v3.6 canvas can render, per node, whether that step is grounded (strict — cite-or-fail) or open (flexible — free agentic), with the strictness enforced structurally and un-loosenable by the business author.** That is the "all types of agentic AI workflows, strict where it touches the knowledge base, flexible where it's open" the operator asked for — and it is precisely the axis n8n has nothing on. **Recommend a new graded-governance requirement**: every canvas node declares a *grounding mode* (Grounded/strict ↔ Open/flexible), the Grounded mode auto-attaches the `citations_required` (+ confidence/freshness) gate the author cannot remove, and the run-viz shows a "grounded ✓ cited" vs "open" badge per step.

---

## Q3 — Run observability (developer-grade vs business-legible)

**Confidence: HIGH** (docs `understand-executions`, `debug-executions`, `pin-and-mock-data`, community corroboration).

n8n's observability is **deep, per-node, and firmly developer-grade** — it is the field's *best* run-inspection and simultaneously *least* business-legible:

- **Executions list** — two views: per-workflow and **all-executions**. Each row: **status, start time, duration/timing, mode, node names.** Statuses include **success / error / running / waiting** (waiting = a paused/`Wait`/HITL node). Custom data can be attached to executions.
- **Per-node execution data** — click any node in a finished execution and see its **exact input JSON and exact output JSON** — the literal data that flowed through, step by step. This is n8n's superpower for debugging and its wall for non-technical users (raw JSON per node).
- **Replay / re-run into the editor** — for a **failed** execution: *"Debug in editor"* copies the execution's data back into the canvas and **pins it into the first node**, so you fix + re-run against the exact failing data without re-hitting live APIs. For a **successful** one: *"Copy to editor."*
- **Partial executions** — select a node → *"Execute step"* runs *that node plus only the upstream nodes needed to fill its input.* Node-level replay.
- **Pinned & mock data** — pin a node's output so future runs use the saved data instead of re-fetching; you can **edit pinned data** to simulate scenarios (flip "success"→"fail" without an API call). *Not available for production executions.*
- **Error handling** — a dedicated **Error Trigger** node + error-workflow wiring (`handle-errors-gracefully`) for graceful failure routing.

**Design implication for us:** n8n proves the *value* of exact per-step I/O replay (worth stealing for a **developer/advanced** reveal) but also proves the **business-legibility gap** the milestone targets — raw per-node JSON is not "watch your process run" for a Legal/HR user. n8n has **no plain-language, gate-pass/fail, "which step is active" business view.** That blind spot is ours to own (our Pitfall-4 total-function-over-full-event-set business run-view + the honest gate-failed rendering). Note n8n's `waiting` status maps cleanly onto our `waiting-for-you` HITL state.

---

## Q4 — Integrations / connectors (catalog + node model + credentials + community + MCP)

### Catalog size — a real discrepancy to flag

**Confidence: MEDIUM** on the exact number (marketing vs directory disagree — flagged):
- The **n8n.io landing** claims **"over 500 integrations."**
- The **integrations directory** header reports **"1965 integrations."**
- The gap: **500+** is the round marketing number for *app connectors*; **~1965** is the **total node count in the directory** including AI sub-nodes, triggers, and core/utility nodes. Prior first-pass FEATURES.md said "400+" — all three are the same order of magnitude; treat as **"hundreds of app connectors + ~1,900 total nodes."** (Independent analyses commonly cite "400+"/"500+".)

### The node/connector model

**Confidence: HIGH.** Integrations are **nodes**, typed **Regular / Trigger / Core**, organized into ~14 top-level categories (AI, Analytics, Communication, Cybersecurity, Data & Storage, Developer Tools, Development, Finance & Accounting, **HITL**, Marketing, Miscellaneous, Productivity, Sales, Utility). The **AI** category alone has **12 sub-categories**: Agents, Chains, Document Loaders, Embeddings, Language Models, Memory, Output Parsers, Retrievers, Text Splitters, Tools, Vector Stores, **Model Context Protocol**, plus Rerankers. A generic **HTTP Request** node covers anything without a first-party node.

### Credential system (directly relevant to our CONN-03 credential model)

**Confidence: HIGH** (`create-and-edit-credentials`):
- Credentials are **separate, reusable objects** — created once, selected from a dropdown, **reused across nodes and workflows** (not re-entered per node).
- **Project-scoped** on instances that support projects: create a credential *"inside your personal space or a specific project you have access to."* Community edition = personal space only.
- **OAuth two modes:** **Fixed** (same credential regardless of who runs it) vs **End-user** (*"each user's credential is used at runtime, and can only be seen and used by that user"* — Enterprise only).
- **Dynamic credentials** — expressions can pick a credential at runtime from workflow data. *(Note: this is powerful and a footgun — data-driven credential selection is an injection surface.)*
- **`Allowed HTTP Request Domains`** on a credential — *"controls which domains the credential is permitted to be used against when the credential is selected in an HTTP Request node."* **This is the exact mechanism at the heart of the SSRF CVE (Q5): the domain allow-list is a *property of the credential*, so it only constrains requests *that use that credential*.**

### Community nodes (a security-relevant extension model)

**Confidence: HIGH** (`community-nodes/risks`, `verified-install`):
- **Verified** community nodes — manually vetted for quality/security, shield-icon, installable on Cloud + self-hosted; verification requires **MIT license, zero external dependencies, English-only, linter-clean.**
- **Unverified** community nodes — installed from **npm**, **self-hosted only**, and the user must tick *"I understand the risks of installing unverified code from a public source."* Docs, verbatim: community nodes *"have full access to the machine running n8n, and … access to data passing through the workflow."*
- n8n maintains a **blocklist** of known-malicious packages.

**Implication for us:** the community-node model is n8n's supply-chain attack surface (arbitrary npm → full host access) and a direct argument for our **MCP-substrate + first-party-thin + no arbitrary-code-node** connector strategy (already the FEATURES.md verdict). We should never ship an "install a third-party node from npm" affordance on a business canvas.

### MCP support (answers connector hard-req #3 substrate question)

**Confidence: HIGH** (`mcpclient`, `mcptrigger`, `toolmcp` docs + `connect-to-n8n-mcp-server`):
- **MCP Client Tool** (`n8n-nodes-langchain.toolmcp`) — an agent sub-node that lets an n8n agent **call tools exposed by an external MCP server.**
- **MCP Server Trigger** (`n8n-nodes-langchain.mcptrigger`) — makes n8n **act as an MCP server**, exposing its tools/workflows to external MCP clients; *"unlike conventional trigger nodes … only connects to and executes tool nodes."*
- **Instance-level native MCP server** (**Public Preview since ~April 2026**) — Claude Desktop / ChatGPT / Cursor can build, test, and publish n8n workflows directly, no JSON copy-paste.

**Implication for us:** n8n treats MCP as **both directions** (be-a-client and be-a-server). This directly validates the SEED-013 "MCP substrate + let n8n/Zapier call *us*" pattern — n8n's MCP Server Trigger is literally the outbound-pipe-that-calls-you model. **Adopt MCP as the connector substrate; expose our governed workflows as MCP tools; do not hand-build a 500-app catalog.**

---

## Q5 — Governance / safety + the SECURITY lessons (the highest-value output for CONN-03)

### Access-control governance (what n8n *does* have)

**Confidence: HIGH** (`understand-instance-roles`, `rbac/projects`, `rbac/custom-roles`):
- **Two-tier RBAC.** Instance roles: **Owner / Admin / Member** (Admin = Pro+Enterprise). Project roles: **Project Admin / Editor / Viewer** (Viewer = Enterprise only).
- **Projects** scope workflows + credentials + executions together; membership governs who can see/edit each.
- **Custom project roles** — granular permission sets (Enterprise).
- Enterprise also: **audit logging, source-control (git) of workflows, environments, SSO/SAML provisioning.**
- This is **access-control-centric** governance — *who can edit/run* — **not** *what a workflow is structurally allowed to do.* It says nothing about grounding, citations, or per-step safety (Q2). Governance-of-the-artifact-shape is absent.

### ★ The connector-security CVE lessons (actionable for CONN-03)

Between **Jan–Mar 2026**, six n8n CVEs landed in one disclosure wave (Upwind, The Register, Rapid7), plus the standalone **SSRF issue #28218**. These are a ready-made anti-pattern checklist. **Confidence: HIGH** (multiple independent security writeups + the GitHub issue).

**The SSRF one — the exact trap we must not repeat (issue #28218):**
- **What went wrong:** SSRF protection via `allowedDomains` was **enforced *only* when credentials were attached** to the HTTP Request node. The `allowedDomains` check *lives inside the credential-validation logic*, not as a universal request filter (this ties straight to the Q4 credential model — the allow-list is a *credential property*).
- **The exploit:** an HTTP Request node **without credentials** → target `http://169.254.169.254/latest/meta-data/` (cloud metadata) or `http://127.0.0.1:*` / internal services → the **server fetches it unchallenged** with server-side network position. Cloud-credential theft, internal enumeration.
- **Root cause (verbatim):** *"protection activates conditionally based on credential presence, not request characteristics."*
- **The prescribed fix:** *"decoupling SSRF protection from credential dependency"* — apply domain restrictions **universally regardless of credential attachment**, add global SSRF config, and **proactively block internal IP ranges.**

**The other five (the systemic pattern):**

| CVE | Class | CVSS | Root cause | Lesson for us |
|---|---|---|---|---|
| CVE-2026-21893 | Command Injection | 9.4 | User input interpolated into system commands during community-package install | Extension installs must isolate command construction — never interpolate untrusted input into a shell |
| CVE-2026-25049 | RCE | 9.4 | Crafted **expressions** evaluated in a privileged context without isolation | **Expression/templating engines are an attack surface** — sandbox all evaluation (relevant to our template/expression fill) |
| CVE-2026-25051 | XSS | 8.5 | CSP not consistently applied to webhook/HTML responses | Uniform CSP on every response handler |
| CVE-2026-25052 | Arbitrary File Read | 9.4 | *"Insufficient permission checks on internal APIs … exposed to authenticated users"* | **Authenticated ≠ authorized** — per-resource authz, not blanket authenticated access (mirrors our RLS discipline) |
| CVE-2026-25053 | RCE / File Access | 9.4 | Git node executes untrusted input without sandboxing | Specialized action nodes need **hermetic execution** — no subprocess spawn from untrusted data (mirrors our sandboxed `execute_code` boundary) |

**The meta-pattern (Upwind, verbatim):** *"Authenticated functionality is implicitly trusted; workflow logic bleeds into privileged execution; input validation failures recur across features; isolation boundaries collapse under real-world usage."* And: *"Authenticated does not mean safe."*

### What we must do differently for CONN-03 (concrete, sourced)

1. **Unconditional egress/SSRF guard on EVERY outbound fetch** — resolve the target host; block RFC-1918 / link-local / loopback / `169.254.169.254` metadata; block redirects to them; enforce an **operator-managed per-org destination allow-list.** **The guard must NOT live in the credential path** and must fire **whether or not a credential is attached** (the #28218 lesson, exactly). This already matches our PITFALLS.md Pitfall-6 prescription — the CVE *confirms* it.
2. **Credentials org-scoped, Fernet-encrypted (`enc:v1:`), resolved server-side by reference** — never in the definition JSONB, never returned to the client (extends Phase-150). Note n8n's *dynamic/expression-selected* credentials as a footgun to **not** replicate on a business canvas — a business author should never pick a credential by data-driven expression.
3. **Authenticated ≠ authorized** — every connector CRUD + credential read goes through the org-requiring service-role path (`get_service_role_supabase` refuses without an org); per-resource authz + a dedicated **cross-org leak test** (SEED-124/125 precedent). CVE-2026-25052 is the negative example.
4. **No arbitrary-code / raw-shell / npm-install node on the business canvas** — CVE-2026-21893/25049/25053 are all "untrusted input reached a privileged executor." Keep code inside the sandboxed `execute_code` phase; never expose a Git/shell/community-node-install affordance.
5. **Sandbox any expression/template evaluation** — CVE-2026-25049 says the expression engine itself is RCE surface; our `render_template`/`llm_emit` fill path must never `eval` author-supplied expressions in a privileged context.
6. **Secrets never touch logs / audit / the friendly run-view** — a redaction pass at the egress boundary (the DeepSeek-DSML-strip precedent).
7. **Rate-limit per org/connector** (Redis token bucket — SEED-013) so one workflow can't ban an account or run up a bill.
8. **Every connector-touching phase gets `/gsd:secure-phase` with `threats_open: 0`** — the established bar (146–150/153/154/158/159).

---

## Q6 — Steal / beat

### Steal (adopt these n8n patterns)

1. **Config-with-live-data-preview** — the node modal showing *input data ← config → output data* together. Our side-panel node config should preview the real grounding bundle / prior-step output, not just abstract fields. **(HIGH value, MEDIUM effort.)**
2. **Sticky notes + canvas groups** — cheap, high-legibility annotation. Add note affordances to our canvas.
3. **"Debug/Copy to editor" replay** — re-run a failed run against its exact data. Maps onto our run-viz + a "re-run this workflow" affordance; steal the *pin-the-failing-data* idea for developers.
4. **`waiting` execution status** — directly maps onto our HITL `waiting-for-you` node state; adopt the vocabulary.
5. **AI-assist "describe → draft → refine"** — table stakes; we already have the generator (SEED-051), point it at the canvas.
6. **MCP both-directions** — expose our governed workflows *as* MCP tools (n8n's MCP Server Trigger pattern), so n8n/Zapier/Claude call *us*. The cleanest answer to hard-req #3's outbound story.
7. **Verified-vs-unverified node tiers** — if we ever allow extensions, copy the "verified = vetted, MIT, zero-dep, shield-icon" bar + a blocklist; never allow raw npm on a business surface.

### Beat / deliberately reject

1. **REJECT the free-form drag-anything-to-anything DAG** — the documented 20/50/200-node complexity cliff (*"impossible to maintain, debug, or explain to anyone"*). Our constrained phase-spine (ordered phases + one `skip_to_phase`) is crowd-resistant *by grammar.* **This is our top anti-feature.**
2. **BEAT on graded, author-time, structural governance (Q2)** — n8n has **none**; grounding is invisible and unenforced. We render per-node **Grounded/strict ↔ Open/flexible**, auto-attach the un-removable `citations_required` gate on grounded steps, and block an ungrounded deliverable at publish. *No competitor can copy this without rebuilding their model.*
3. **BEAT on business-legible run-viz** — n8n's per-node raw-JSON replay is developer-grade; nobody ships a plain-language "watch your process run" view. Ours = a total function over the full event set with honest gate pass/fail (Pitfall-4).
4. **BEAT on cited deliverables** — n8n RAG outputs are ungrounded/uncited; ours are per-claim cited to the real retrieval set (CITE-01).
5. **BEAT on connector security by construction** — n8n's SSRF-only-when-credential-attached is the exact trap; our unconditional egress guard + org-scoped-by-reference credentials + no-arbitrary-code + MCP-substrate is the corrected posture (Q5). We threat-model egress *once*, on the MCP/Open-Platform substrate, not per-node.
6. **BEAT on safe-by-construction AI-seed** — n8n's AI Builder can (and does) emit broken/unsafe drafts; ours *can't*, because the generator's response schema **is** the `extra="forbid"` discriminated union.

---

## Sources (per-source confidence)

**n8n official docs (HIGH — authoritative primary):**
- AI components: [`retrieve-relevant-context`](https://docs.n8n.io/build/integrate-ai/understand-ai-components/retrieve-relevant-context) (RAG — **no grounding/citation/confidence gate**), [`what-agents-do`](https://docs.n8n.io/build/integrate-ai/understand-ai-components/what-agents-do), [`what-chains-do`](https://docs.n8n.io/build/integrate-ai/understand-ai-components/what-chains-do), [`how-tools-work`](https://docs.n8n.io/build/integrate-ai/understand-ai-components/how-tools-work), [`store-and-search-data-with-vectors`](https://docs.n8n.io/build/integrate-ai/understand-ai-components/store-and-search-data-with-vectors)
- AI Agent node: [`n8n-nodes-langchain.agent`](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/); Guardrails node: [`n8n-nodes-langchain.guardrails`](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.guardrails)
- Canvas / workflow components: [`connect-nodes-together`](https://docs.n8n.io/build/understand-workflows/workflow-components/connect-nodes-together.md), [`work-with-nodes`](https://docs.n8n.io/build/understand-workflows/workflow-components/work-with-nodes.md), [`add-notes-and-documentation`](https://docs.n8n.io/build/understand-workflows/workflow-components/add-notes-and-documentation.md) (sticky notes), [`canvas-groups`](https://docs.n8n.io/build/understand-workflows/workflow-components/canvas-groups.md), sub-workflows [`break-workflows-into-smaller-parts`](https://docs.n8n.io/build/flow-logic/break-workflows-into-smaller-parts.md)
- Executions/observability: [`understand-executions`](https://docs.n8n.io/build/understand-workflows/understand-executions.md), [`debug-executions`](https://docs.n8n.io/build/understand-workflows/understand-executions/debug-executions), [`debug`](https://docs.n8n.io/workflows/executions/debug/), pin/mock [`pin-and-mock-data`](https://docs.n8n.io/build/work-with-data/pin-and-mock-data)
- MCP: [`MCP Server Trigger`](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcptrigger), [`MCP Client Tool`](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolmcp), [`connect-to-n8n-mcp-server`](https://docs.n8n.io/build/ways-of-building-workflows/connect-to-n8n-mcp-server)
- RBAC/credentials/community-nodes: [`understand-instance-roles`](https://docs.n8n.io/administer/manage-users-and-access/understand-instance-roles), [`rbac/projects`](https://docs.n8n.io/user-management/rbac/projects/), [`rbac/custom-roles`](https://docs.n8n.io/user-management/rbac/custom-roles/), [`create-and-edit-credentials`](https://docs.n8n.io/build/understand-workflows/create-and-edit-credentials.md), [`community-nodes/risks`](https://docs.n8n.io/integrations/community-nodes/risks), [`verified-install`](https://docs.n8n.io/integrations/community-nodes/installation/verified-install/)
- Product positioning + catalog: [n8n.io](https://n8n.io/) ("500+ integrations"; "AI agents you can see and control"; "Human-in-the-loop, guardrails, evaluations"), [n8n.io/integrations](https://n8n.io/integrations/) ("1965 integrations"; 14 categories; AI 12 sub-cats + MCP)
- AI Workflow Builder: [`advanced-ai/ai-workflow-builder`](https://docs.n8n.io/advanced-ai/ai-workflow-builder/), [`ai-workflow-builder`](https://docs.n8n.io/build/ways-of-building-workflows/ai-workflow-builder)

**Security CVE writeups (HIGH — multi-source corroborated):**
- [Upwind — "Six n8n CVEs Disclosed in One Day"](https://www.upwind.io/feed/six-n8n-cves-one-day-workflow-security) (the six CVEs + the "authenticated ≠ safe" meta-pattern)
- [GitHub issue #28218 — "SSRF Protection Only When Credential Attached"](https://github.com/n8n-io/n8n/issues/28218) (root cause + fix)
- [The Register — "n8n security woes roll on"](https://www.theregister.com/2026/02/05/n8n_security_woes_roll_on/), [Rapid7 — Ni8mare/N8scape flaws](https://www.rapid7.com/blog/post/etr-ni8mare-n8scape-flaws-multiple-critical-vulnerabilities-affecting-n8n/), [SonicWall CVE-2025-68613](https://www.sonicwall.com/blog/n8n-ai-workflow-automation-remote-code-execution-vulnerability-cve-2025-68613-), [Aikido CVE-2026-21858 RCE](https://www.aikido.dev/blog/n8n-rce-vulnerability-cve-2026-21858)

**Independent analyses (MEDIUM — community/blog, corroborated across sources):**
- Complexity trap: [hostitsmart n8n best practices](https://www.hostitsmart.com/blog/best-practices-for-n8n-workflows/), [n8n community — structuring for scale](https://community.n8n.io/t/best-practices-for-structuring-n8n-workflows-for-scale-and-long-term-maintainability/248671), [logicworkflow sub-workflow node](https://logicworkflow.com/nodes/execute-sub-workflow-node/)
- Guardrails/Evaluations: [n8n blog — Production AI Playbook: Evaluation and Monitoring](https://blog.n8n.io/production-ai-playbook-evaluation-and-monitoring/), [ryanandmattdatascience n8n Guardrails](https://ryanandmattdatascience.com/n8n-guardrails/), [n8n content-safety benchmark template](https://n8n.io/workflows/10729-benchmark-content-safety-guardrails-with-automated-test-suite-and-reports/)
- MCP/AI-builder context: [generect n8n MCP guide](https://generect.com/blog/n8n-mcp/), [n8n community — AI Workflow Builder beta](https://community.n8n.io/t/introducing-ai-workflow-builder-beta/204919), [hatchworks n8n guide 2026](https://hatchworks.com/blog/ai-agents/n8n-guide/)

**Unreachable / flagged:**
- Old doc paths `docs.n8n.io/advanced-ai/` and `/advanced-ai/rag-in-n8n/` returned **404** (docs restructured to `/build/integrate-ai/...`); recovered the content via the current paths above.
- `n8n.io/blog/*` and the GitHub README were **not crawled page-by-page**; blog/architecture content was obtained via search + the docs tree. Architecture (queue-mode workers, task-runners) not deeply verified — **not load-bearing for this milestone.**
- **Connector-count discrepancy** (500+ marketing vs 1965 directory) flagged in Q4 — **MEDIUM** confidence on the exact figure; both are the same order of magnitude.

---
*Deep-dive for: v3.6 Visual / No-Code Workflow Studio — n8n competitor crawl*
*Researched: 2026-07-24*
