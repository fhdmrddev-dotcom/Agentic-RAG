# Feature Research — v3.6 Visual / No-Code Workflow Studio

**Domain:** Visual / no-code workflow + agent builder for NON-technical business users (Legal / HR / Finance), layered ON an existing GOVERNED harness workflow engine
**Researched:** 2026-07-24
**Confidence:** MEDIUM-HIGH (competitor patterns cross-corroborated across 4+ sources each; some marketing-page inflation discounted; our-engine mapping is HIGH from internal docs)

> **This file supersedes the v3.4 Multi-Tenancy FEATURES.md** that occupied this slot (prior content preserved in git history). It refocuses the competitor study (Glean / Beam / n8n + the no-code class) on the visual-authoring + run-observability lens for v3.6.

> **Read this first — the one design axis everything hangs on.** Every finding below is scored against the milestone's hard question: *reconcile easy visual drag-and-drop authoring ↔ governed / safe / observable execution.* Our engine already owns the governed/safe/observable half (locked ordered phases, per-phase tool whitelists, validation gates, an 8-stage publish gauntlet with a judge hard-wall). The competitors own the easy-authoring half. **The market gap is the intersection — nobody enforces governance STRUCTURALLY at author-time; they bolt guardrails on at run-time.** That intersection is our whole differentiator.

---

## Part 1 — Competitor Deep-Dive (the three named + the no-code class)

### Head-to-head: how each reconciles EASY authoring ↔ GOVERNED/safe/observable execution

This is the milestone's heart (quality-gate requirement). The columns are the five axes the operator asked for. **Read the "Governance mechanism" and "When is safety enforced" rows first — that is where we win.**

| Axis | **Glean AI** (D-PRD-05 primary) | **Beam AI** | **n8n** | Zapier | Flowise / LangFlow |
|---|---|---|---|---|---|
| **Authoring canvas** | Unified no-code builder = visual drag-and-drop canvas **+** natural-language conversation in one surface. Four-step loop **Describe → Connect → Refine → Deploy**. Five concepts: **triggers, steps, actions, flow, memory**. Each step = run a tool / make a decision / call a sub-agent. Branching + looping. Right-side step-config panel; per-step model choice; templates + plain-English start. | Library of **pre-trained domain agents** ("start in minutes"); marketing claims a drag-and-drop builder for non-technical teams. Author by defining goals, allowed actions, tool access, escalation paths; "train on your SOPs". Authoring-UI mechanics are thin in public docs. | **Infinite canvas**; node = one action; connect nodes, data flows **left→right**; trigger node starts. 400+ app nodes + 70+ AI nodes. **AI Workflow Builder (beta):** NL prompt → auto-selects/places/configures/connects nodes → draft you refine (multi-turn). | Linear **trigger → actions** + **Paths** (branch) + **Filters**. NL → draft Zap (AI Builder, paid plans). | Drag nodes (model / prompt / tool / memory / data-source) on a canvas. Flowise: Assistant / Chatflow / **Agentflow** builders. LangFlow: Python components + custom-Python expressions. |
| **Build-time validation** | Test/Refine step before Deploy; **not a hard build-time flow-blocker** — you validate by running. Versioning-heavy. | Not detailed publicly. | **NODE-level only** — red icon = missing/bad credential or misconfigured param; green check = ran OK. **Does NOT validate the FLOW at build time** — you discover flow problems at run. | Filters/Paths route, but invalid logic surfaces at run/test. AI Guardrails checks are runtime. | Visual debugging + execution logs; validation is effectively "run it and read the trace". |
| **Governance mechanism** (THE axis) | **Permission-inheritance**: an agent can only touch data the *running user* is already authorized to see; permission changes sync in real time; least-privilege. Admin sets per-agent **sharing rules** + "how broadly can this be shared" (anti-**sprawl**). **Glean Protect / AWARE**: enforce permissions on every request, scan + remediate over-shared data. Drafts + versioning + rollback. | **Autonomy dial + HITL**: "tune autonomy levels and human handoffs to match your risk profile"; approval gates; escalation paths; **self-healing outputs** (catch errors before they propagate); policies + guardrails; audit-ready traces. Behavior/risk-centric. | **RBAC + projects**: instance roles (Owner/Admin/Member) + project roles (Project Admin/Editor/Viewer) + **Custom Project Roles** (enterprise); projects scope workflows+credentials; **audit log** ties each run to who-triggered/who-approved; SSO provisioning; **git source-control** of workflows. Access-control-centric. | **AI Guardrails** app: detect PII / prompt-injection / jailbreak / toxicity → structured verdict → **route / block / redact / escalate** via Paths. Approval-process automation. Versioning + rollback + audit log. Content-safety-centric. | Minimal in OSS core; enterprise tiers add SSO/RBAC. Governance is not the selling point. |
| **When is safety enforced** | Run-time (permission check per request) + deploy-time (admin sharing rules). | Run-time (autonomy level + approval gates + self-heal). | Run-time (a bad flow runs until it errors); access governed by RBAC at edit/run. | Run-time (guardrail app inside the Zap). | Run-time (trace/debug). |
| **Run observability** | Persistent **memory log** — every step writes outputs into shared memory; context settings control what each step can see. Non-technical run view is thin. | **Central command-center dashboard** — supervise a "team" of agents: historical data, current assignments, usage analytics, audit-ready traces; notifications to fix missing integrations + re-run. Supervisor-grade, not per-step-technical. | **Executions tab** — read-only replay of each node's **exact input + output data**, step-by-step record, pinpoint where it failed. **Developer-grade, deep, per-node.** | Zap history + run logs + error notifications. | Execution logs + step-by-step reasoning traces; visual debugging. Developer-grade. |
| **Non-tech vs dev legibility** | Business users author in plain language; run-legibility skews technical (memory log). | **Most supervisor-oriented** (dashboard framing = "manage your AI workforce"). | Firmly **developer**-grade — powerful but the canvas "becomes confusing" as logic grows. | Approachable for simple Zaps; complex Paths get hard. | Developer / researcher grade. |
| **External connectors + credential model** | **275+ native + MCP-based** connectors; 100+ native actions; **build your own via MCP + OpenAPI**; permissions-enforced. | Airtable/Aircall/ServiceNow/Copper/Asana/Sage/ClickUp; "hundreds, new daily"; read/write/act on DBs, SaaS, internal services; cloud or on-prem. | **400+ apps**; per-node **credential store** (guided OAuth), credentials reusable across nodes/workflows; community nodes. | 6,000+ apps (largest catalog); per-connection OAuth. | Narrower, **deeper LLM focus** (models/embeddings/retrieval/vector stores); LangFlow is MCP client+server. |

### The five cross-cutting patterns (what the whole field agrees on)

1. **AI-to-workflow (describe → draft → edit) is now TABLE STAKES.** Glean, n8n, and Zapier all ship "type a sentence, get a first-draft flow you then refine." **We already have this** (SEED-051 realized in v2.9 / Phase 103 NL authoring). Our job is to point that generator at *the canvas* instead of a form. This is a "we already own the hard part" advantage, not a net-new build.

2. **The open-canvas complexity trap is the field's recurring failure mode.** Independent comparisons say it plainly: "as soon as agent logic becomes non-trivial — multi-stage orchestration, conditional branches, dynamic self-routing — the visual graph becomes confusing" and "as projects get more complex, the canvas gets too crowded." This validates our constrained, linear/branching phase-spine over a free-form DAG — **and it's simultaneously the anti-feature and the governance argument** (a crowded free-form canvas is both unusable *and* ungovernable).

3. **Build-time FLOW validation is a genuine market gap.** n8n validates *node config* (red/green badges for creds/params) but does not stop you drawing an invalid or unsafe *flow* — you find out at run. **Nobody enforces the flow's safety while you draw it.** Our `reachability.py` lint + the 8-stage publish gauntlet already do this at publish; surfacing them *live in the canvas* ("you cannot draw an invalid/unsafe workflow") is our headline differentiator.

4. **Governance is bolted on at RUN-time everywhere.** Glean = access-inheritance check per request; Beam = autonomy dial + approval gate; Zapier = a guardrail app inside the Zap; n8n = RBAC + audit. **None enforce governance STRUCTURALLY at author-time.** Our engine is the only one where governance is the *shape of the artifact itself* (locked ordered phases, per-phase tool whitelists, gates, judge hard-wall). Rendering those rails visually — as things you literally cannot draw around — is a category difference, not a feature race.

5. **MCP is the 2026 connector standard.** 500-1,000+ public MCP servers; adopted by Anthropic/OpenAI/Google; solves the N×M connector problem. Glean already exposes "build your own connector via MCP + OpenAPI"; LangFlow is an MCP client+server. **This directly answers hard-requirement #3** (own connector framework vs Open Platform): don't hand-build a 275-app catalog — adopt MCP as the connector substrate, ship a few first-party high-value connectors (email / JIRA / Slack), and let n8n/Zapier be the outbound pipe that *calls us* (the exact pattern SEED-013 already sketches). Sequence with Open Platform (SEED-013/031); do not fork it.

---

## Part 2 — Feature Landscape

### Table Stakes (a credible visual builder must have these)

Missing any of these and the canvas doesn't read as competitive with Glean/n8n. Complexity is scored as *incremental* over what already exists.

| Feature | Why Expected | Complexity | Dependency on existing engine |
|---------|--------------|------------|-------------------------------|
| **Editable node canvas** — draggable nodes = phases, connections = flow (the read-only phase-spine made editable) | Every named competitor is a node canvas; this IS the milestone | **HIGH** | Read-only phase-spine graph (103) + `reachability.py` already emits nodes+edges — reuse, don't re-derive (SEED-051, SEED-086) |
| **Side-panel node configuration** | Glean/n8n both configure the selected node in a right panel | **MEDIUM** | The discriminated-union `PhaseConfig` (`extra="forbid"`) **IS** the form schema; Phase 103 already built the guided form editor |
| **Business-friendly node vocabulary** ("Find documents", "Ask the AI", "Get approval", "Produce a report") | Non-technical users can't parse `phase_type` / `available_tools` / `citation_policy` | **MEDIUM** | v3.3 plain-language layer (LANG-01) + SEED-085 term-map (friendly label ↔ schema field ↔ helper). Reuse the two-audience contract |
| **AI-seeded canvas** (describe → draft → edit) | Table stakes as of 2026 — Glean, n8n, Zapier all ship it | **LOW-MEDIUM** | **We already have the generator** (SEED-051 / Phase 103 NL authoring → strict-parse → draft). Wire it to emit onto the canvas, not a form |
| **Templates / starter flows** | Glean + Beam both lead with template galleries | **LOW** | Curated Starter Workflow Library already shipped (WF-01, v3.2) + PM content pack (Phase 104) |
| **Node-level validation badges on canvas** (red = broken, green = OK) | n8n's red/green is the baseline mental model | **MEDIUM** | `lint_workflow` / `reachability.py` (orphans, unsatisfiable skips, `INPUT_UNSATISFIED`) — surface its output as per-node badges |
| **Live run observability** — active node highlight, per-step status | n8n executions view + Beam dashboard set the bar | **MEDIUM** | Run surface / `PhaseTimeline` / `PhaseCard` (094/095/103) + run SSE (Phase 061+). Extend, don't rebuild (G-5 hot files) |
| **Versioning + drafts + revert** | Glean's "versioned, roll back without interrupting live" is a headline | **LOW** | Immutable-on-publish trigger + `UNIQUE(slug, version)` + version snapshotting already exist (migrations 056 / 067) |
| **Human-in-the-loop approval as a visible node** | n8n "Send & Wait", Beam approval gates, Zapier approval flows | **LOW-MEDIUM** | `llm_human_input` phase type is already first-class; it just needs a canvas face. Pairs with SEED-052 (ask→mark→advance) |
| **Some external-action node** (send email / update a ticket) | A no-code builder that can't touch the outside world reads as a toy | **HIGH** | Net-new; the connector question (hard-req #3) — see Part 3 |

### Differentiators (where we beat Glean / Beam / n8n given our engine)

Each is anchored to a capability we *already have* that the competitors structurally lack.

| Feature | Value Proposition (why we win) | Complexity | Notes |
|---------|-------------------------------|------------|-------|
| **Build-time FLOW governance** — "you cannot draw an invalid/unsafe workflow" | **THE headline.** The gauntlet rules + reachability lint enforced *live while drawing* — invalid edges refused, orphan phases flagged, tool-whitelist violations blocked at author-time. n8n/Zapier only validate node-config at run; nobody blocks unsafe *flows* at build. | **MEDIUM-HIGH** | Reuse `lint_workflow` incrementally on every canvas edit (debounced). The engine is the moat; the work is surfacing it |
| **Structural governance rendered visually** — locked phase order, per-phase tool whitelists, gates, judge hard-wall shown as *rails you can't draw around* | Beats Beam's runtime autonomy-dial and Glean's access-inheritance because governance is the *shape of the artifact*, decided once at author-time, not re-checked per run. A business user physically cannot compose an ungoverned flow | **MEDIUM** | The rails already exist in the schema; render them as fixed canvas affordances (add-only-valid-node, no rewiring past a gate) |
| **Per-claim cited deliverables** | Every workflow output is KB-grounded + cited to the real retrieval set (CITE-01). **No no-code builder produces grounded-cited business documents** — Zapier/n8n outputs are ungrounded | **LOW** (exists) | The `llm_emit` cited field-map + `citations_required` gate already force this; expose "this report is cited" on the run-viz |
| **Cross-provider per-step model choice** | Glean pins you to their stack; we route each node across OpenAI / Anthropic / Google / OpenRouter (MODEL_CAPABILITIES registry) | **MEDIUM** | Per-node model picker on the config panel; the registry + routing already exist |
| **Multi-tenant per-department authoring** | Legal / HR / Finance each author + share *within their org scope*, RLS-enforced leak-safe. Matches Glean's admin sharing-rules but with DB-enforced isolation, not app-layer trust | **MEDIUM** | org/role model + membership RLS shipped in v3.4 — the substrate is done; the canvas inherits it |
| **A genuinely NON-technical run-observability view** — "watch your process run" in plain verbs, gates as friendly checkpoints, distinct from the developer `PhaseTimeline` | **The field's blind spot.** n8n/Flowise run-views are developer-grade (raw per-node I/O); Beam's dashboard is supervisor-grade but shallow. Nobody nails a legible business run-view. SEED-086's "control room / team" metaphor lives here | **MEDIUM-HIGH** | Two run surfaces from one run stream: business view (plain) + technical timeline (existing, behind the SEED-085 advanced reveal) |
| **AI-seed that CAN'T emit an unsafe node** | Because the generator's response schema **IS** the `extra="forbid"` discriminated union, the AI literally cannot produce an out-of-governance node. Open-canvas AI builders (n8n/Zapier) can and do generate broken/unsafe drafts | **LOW** (exists) | Safe-by-construction — SEED-051's key architectural property; make it visible as a selling point |

### Anti-Features (commonly requested, actively harmful for a GOVERNED non-technical builder)

| Anti-Feature | Why Requested | Why Problematic | What to build instead |
|---|---|---|---|
| **Fully-open drag-anything-to-anything DAG canvas** | "Real builders let you connect any node to any node" | Every competitor's canvas "becomes confusing / too crowded" at non-trivial logic (independently reported) **and** it lets a business user compose an ungoverned/unsafe flow — defeats the milestone's whole point | **Constrained canvas**: the linear/branching phase-spine made editable; nodes snap to *valid* connections only; invalid edges refused live. Governance rails are drawn, not optional |
| **Build our own 275/400-app connector catalog from scratch** | "Glean/n8n have hundreds of integrations, we need parity" | A forever-maintenance job (SEED-013: "MCP tool surface expansion is a forever job"); years of head-start to catch; dilutes focus from the governed-authoring differentiator | **Adopt MCP as the connector substrate** (2026 standard) + a handful of first-party high-value connectors (email / JIRA / Slack) + let n8n/Zapier call *us* (SEED-013 "n8n is the pipe" pattern). Sequence with Open Platform (SEED-013/031) |
| **Raw code / custom-script node on the business canvas** | "LangFlow/n8n let you drop in a code node for power" | Ungoverned arbitrary logic on a surface aimed at non-technical users — the exact safety hole the engine exists to close | Keep code inside the **sandboxed `execute_code` phase** with its wall-clock + whitelist guardrails; never expose a raw code node on the business canvas |
| **A user-facing "autonomy level" slider that loosens governance** | Beam ships one; "let users decide how strict to be" | For a *governed* builder aimed at *non-technical* users, a "make it less governed" knob is a footgun that undoes the safety guarantee | Governance is **structural, not user-tunable**. An *operator/admin* configures allowed-sets (the v3.3 two-layer pattern); the business author can never loosen the rails |
| **A separate parallel run-execution route / new runtime for the visual layer** | "The visual workflows feel like they need their own engine" | Violates the standing D-14 red line + SEED-051's "execution stays thread-bound, no separate runtime"; doubles the surface to maintain | **Render the existing run** — the canvas is an authoring + observability skin over the one engine. No new runtime (hard-req #1) |
| **Replacing / merging the two existing authoring doors** | "Simplify to one builder" | Hard-requirement #1: preserve v1 + both doors, feature-flagged, revert-at-any-time (tested acceptance gate) | The canvas is a **THIRD, most-approachable door** alongside "Describe & run" / "Author & govern". Flip the flag → land on exactly today's behavior |
| **Real-time collaborative multi-cursor canvas editing** | "Figma-style co-editing is table stakes now" | Heavy (CRDT/presence infra); not table stakes for workflow builders; none of the three named competitors lead with it | Defer. Single-author drafts + versioning + org-sharing (already have) cover the real need |

---

## Part 3 — The connector decision (hard-requirement #3, research verdict)

**Question the milestone must answer up front:** own connector framework vs sequence-with / depend-on Open Platform (SEED-013/031)?

**Research verdict: MCP-first, first-party-thin, Open-Platform-sequenced. Do NOT build a bespoke connector catalog inside v3.6.**

Evidence:
- **MCP is the settled 2026 standard** (500-1,000+ servers; Anthropic/OpenAI/Google adoption; solves N×M). Building a proprietary connector model now would be swimming against the current.
- **Glean itself** — our primary competitor — exposes "build your own connector via **MCP + OpenAPI**" rather than forcing everything native. The market leader treats MCP as the extension path.
- **SEED-013 already leans this way**: MCP server + service accounts + the "n8n POSTs a ticket to our `/api/v1/answer`, branches on our confidence + citations" pattern. The most valuable outbound story is *being called by* n8n/Zapier, not out-connecting to 400 apps ourselves.
- **The engine seam already exists**: an outbound "send" is just another governed phase with a tool whitelist. A connector = an MCP-backed tool the phase is allowed to call. This fits the existing per-phase-tool-whitelist model with zero governance rework.

**Recommended v3.6 connector scope (minimal, safe, sequenced):**
1. Model a connector as an **MCP-backed action node** governed by the existing per-phase tool whitelist (no new governance concept).
2. Ship **2-3 first-party high-value connectors** (email out, JIRA/ticket create, Slack notify) as the demo-able external-action story.
3. **Credential model**: reuse the v3.3 Fernet secrets-at-rest + `app_settings`/`user_settings` scoping + org-RLS; a connector's credentials are org-scoped, operator-provisioned — never author-entered plaintext.
4. Everything broader (the full catalog, inbound webhooks, service accounts, the public API) is **Open Platform (SEED-013/031)** — sequence after, don't fork into v3.6.

---

## Feature Dependencies (for roadmap phase ordering)

```
Editable node canvas
    └──requires──> read-only phase-spine graph (Phase 103)  [EXISTS]
    └──requires──> reachability.py nodes+edges + lint_workflow  [EXISTS]

Side-panel node config
    └──requires──> discriminated-union PhaseConfig form (Phase 103)  [EXISTS]
    └──requires──> SEED-085 term-map / v3.3 plain-language layer  [EXISTS]

Business node vocabulary ──enhances──> AI-seeded canvas (friendly draft)

AI-seeded canvas
    └──requires──> NL authoring generator (SEED-051 / Phase 103)  [EXISTS]

Build-time flow governance (THE differentiator)
    └──requires──> lint_workflow run live on canvas edits  [EXISTS, needs live wiring]
    └──requires──> publish gauntlet rules (Phase 102)  [EXISTS]

Non-technical run-viz
    └──requires──> run surface / PhaseTimeline (094/095/103) + run SSE  [EXISTS]
    └──requires──> SEED-085 two-audience reveal (business vs technical view)

HITL approval node ──requires──> llm_human_input phase type  [EXISTS]  + SEED-052 loop

External-action node
    └──requires──> MCP connector substrate + Open Platform seam (SEED-013/031)  [NET-NEW]

Multi-tenant authoring ──requires──> org/role membership RLS (v3.4)  [EXISTS]

Preserve-v1 / revert ──requires──> feature flag (D-14 red line)  [PATTERN EXISTS]

Constrained canvas ──conflicts──> fully-open DAG canvas (anti-feature)
Structural governance ──conflicts──> user-facing autonomy slider (anti-feature)
```

**Ordering implication for the roadmap:** almost every table-stakes feature depends on something that *already exists* — the milestone is overwhelmingly a UX+wiring build over a done engine, exactly as scoped. The only genuinely net-new backend surface is the **external-action / connector node**, which should be the *last* and *thinnest* slice (MCP-backed, first-party-few, Open-Platform-sequenced) — not the foundation.

---

## MVP Definition

### Launch With (v3.6 core)
- [ ] **Editable node canvas** (phase-spine → constrained editable) — the milestone doesn't exist without it
- [ ] **Side-panel node config** reusing the 103 form schema — how you configure a node
- [ ] **Business-friendly node vocabulary** (SEED-085 term-map) — the "non-technical" in the milestone title
- [ ] **Build-time flow validation live on canvas** ("can't draw an invalid/unsafe flow") — **the headline differentiator; must be in v1 or we're just another n8n**
- [ ] **AI-seeded canvas** (wire the existing NL generator to the canvas) — table stakes, mostly reuse
- [ ] **Non-technical run-observability view** distinct from the developer timeline — the other half of the operator's ask ("watch it run")
- [ ] **Preserve-v1 feature flag + revert** (hard-req #1, tested acceptance gate) — non-negotiable gate

### Add After Validation (v3.6.x)
- [ ] **HITL approval node** face on the canvas (`llm_human_input` already exists) — trigger: first authored flow that needs a sign-off step
- [ ] **Templates gallery** surfaced in the canvas (Starter Library exists) — trigger: users start from blank too often
- [ ] **Per-node cross-provider model picker** — trigger: users ask to route steps to different models

### Future / Sequence with Open Platform (v3.7+)
- [ ] **MCP connector substrate + first-party email/JIRA/Slack nodes** — trigger: the external-integration story graduates from demo to depended-on; sequence with SEED-013/031
- [ ] **Inbound webhooks / service accounts / public API** — SEED-013 Open Platform, its own milestone
- [ ] **Collaborative multi-cursor editing** — defer until real co-authoring demand

## Feature Prioritization Matrix

| Feature | User Value | Incremental Cost | Priority |
|---------|-----------|------------------|----------|
| Editable node canvas | HIGH | HIGH | **P1** |
| Build-time flow governance (headline) | HIGH | MEDIUM | **P1** |
| Business node vocabulary | HIGH | MEDIUM | **P1** |
| Non-technical run-viz | HIGH | MEDIUM-HIGH | **P1** |
| AI-seeded canvas | HIGH | LOW-MEDIUM (reuse) | **P1** |
| Preserve-v1 flag + revert | HIGH (gate) | LOW-MEDIUM | **P1** |
| Side-panel node config | HIGH | MEDIUM (reuse) | **P1** |
| Per-claim cited deliverables | HIGH | LOW (exists) | **P1** (expose) |
| HITL approval node | MEDIUM | LOW-MEDIUM | **P2** |
| Templates gallery | MEDIUM | LOW (exists) | **P2** |
| Cross-provider per-step model | MEDIUM | MEDIUM | **P2** |
| Multi-tenant per-dept authoring | MEDIUM | LOW (exists) | **P2** (inherit) |
| MCP connector + first-party nodes | HIGH (eventually) | HIGH | **P3** (sequence w/ Open Platform) |
| Collaborative editing | LOW | HIGH | **P3** (defer) |

## Competitor Feature Analysis (our approach column)

| Feature | Glean AI | Beam AI | n8n | **Our Approach** |
|---------|----------|---------|-----|------------------|
| Canvas model | Visual + NL unified, sub-agents, branch/loop | Templates + goal/action config | Free-form left→right node graph | **Constrained editable phase-spine** — a canvas that can't express an ungoverned flow |
| Build-time flow validation | Test-then-deploy (soft) | n/a | Node-config only (red/green) | **Live flow-lint in canvas** — invalid/unsafe edges refused as you draw (headline) |
| Governance | Permission-inheritance + sharing rules (run-time) | Autonomy dial + approval gates (run-time) | RBAC + audit (edit/run-time) | **Structural, author-time** — locked phases + tool whitelists + gates + judge, rendered as rails |
| Run-viz for non-tech | Memory log (thin) | Command-center dashboard (shallow) | Per-node I/O replay (developer) | **Two views from one stream** — plain business view + technical timeline behind advanced reveal |
| Cited outputs | Enterprise search citations | none | none | **Per-claim citations on every deliverable** (CITE-01) — nobody else grounds business docs |
| Cross-provider | Locked to Glean stack | their models | AI nodes | **Per-step model across OpenAI/Anthropic/Google/OpenRouter** |
| AI-to-workflow | Describe → build | template-first | AI Workflow Builder (beta) | **AI-seed that can't emit an unsafe node** (schema = extra=forbid union) |
| Connectors | 275+ native + MCP | hundreds | 400+ + community | **MCP substrate + first-party few** — don't out-connect, be called (SEED-013) |

## Sources

- Glean Agent Builder / product / docs: glean.com/product/agent-builder, glean.com/ai-agent-builder, docs.glean.com/agents/how-agents-work, docs.glean.com/agents/create-agents/create-your-first-agent — canvas (triggers/steps/actions/flow/memory), Describe→Connect→Refine→Deploy, sub-agents, branch/loop, 275+ connectors
- Glean governance: glean.com/product/agent-governance, glean.com/security, docs.glean.com/administration/protect/overview, glean.com/blog/secure-generative-ai-...-permissions-structure — permission-inheritance, Protect/AWARE, sharing rules, anti-sprawl, versioning/rollback
- Glean connectors + MCP: glean.com/connectors, glean.com/product/api — 275+ native + MCP + OpenAPI, 100+ native actions
- Beam AI: beam.ai/platform, beam.ai/ai-agents, beam.ai/agentic-workflows — pre-trained agents, autonomy levels + HITL + escalation + self-healing, command-center dashboard, SOPs, connector list, SOC2/ISO/GDPR
- n8n: docs.n8n.io (courses level-one/level-two, build/understand-workflows, executions, RBAC/projects), blog.n8n.io custom-project-roles, docs.n8n.io/advanced-ai/ai-workflow-builder, docs.n8n.io Slack node (send-and-wait) — node canvas, red/green node validation, executions replay, RBAC + custom project roles + audit + source-control, HITL send-and-wait, AI Workflow Builder beta
- Zapier: zapier.com/blog/february-2026-product-updates (AI Guardrails), zapier.com/automation/workflow-automation/approval-process, kriv.ai Zapier change-control — AI Guardrails (PII/injection/toxicity → route/block/redact/escalate), approval automation, versioning/rollback/audit
- Flowise vs LangFlow vs n8n: blckalpaca.at langflow-vs-flowise-vs-n8n, huggingface.co/blog n8n-vs-flowise-vs-langflow, leanware.co, zenml.io/blog/langflow-alternatives — canvas-crowding-at-complexity, execution logs/traces, n8n 400+ vs LLM-focused-narrow, developer-grade observability
- MCP as 2026 connector standard: workos.com/blog/everything...mcp-in-2026, dev.to MCP-tools-2026, generect.com/blog/what-is-mcp — 500-1,000+ servers, N×M solved, Anthropic/OpenAI/Google adoption
- Internal substrate: SEED-123 (anchor), SEED-051 (NL authoring realized), SEED-085 (terminology), SEED-086 (run-viz metaphor), SEED-052 (HITL), SEED-013 (Open Platform / MCP / "n8n calls us"), PROJECT.md v3.6 section, D-PRD-05 (Glean primary)

---
*Feature research for: v3.6 Visual / No-Code Workflow Studio*
*Researched: 2026-07-24*
