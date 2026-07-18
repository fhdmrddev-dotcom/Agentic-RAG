# Feature Research — v3.3 Operator UX

**Domain:** Enterprise Agentic-RAG platform (workflow inputs + KB scoping · admin/operator console · model registry · inline citations · plain-language UX)
**Researched:** 2026-07-10
**Confidence:** MEDIUM-HIGH (competitor claims sourced from their OWN current 2026 docs/marketing + third-party reviews via WebSearch/WebFetch; marketing-glossy claims marked MEDIUM. Existing-app facts from milestone context = HIGH.)

> This file supersedes a stale v2.8 FEATURES.md (2026-05-30, Harness milestone) that occupied this slot — prior content preserved in git history.

**Operator directive answered:** the Glean + Beam AI study (sub-questions a–f) is the headline section below, ahead of the standard landscape, because requirements definition needs the competitor patterns FIRST. Lighter cross-checks against Perplexity Enterprise, Microsoft Copilot, Dust, and Onyx (open-source Danswer) are woven in where they beat or clarify the two named competitors.

---

## PART 1 — GLEAN & BEAM AI FINDINGS (operator directive)

> North star (operator, restated in SEED-112): *enhance UX / simplify while keeping workflows accurate, smooth, error-free.* For each sub-question: what they do, the concrete flow, and the takeaway for us.

### Who these two actually are (don't conflate)

- **Glean** — enterprise search + "Work AI" assistant + agent builder. Permissions-enforced RAG over 100+ connectors. Closest analog to *our* product (KB-grounded chat + agents + admin governance). This is the primary pattern source. Confidence HIGH — rich public docs at docs.glean.com.
- **Beam AI** (beam.ai) — agentic *process automation* ("AI workforce"): long multi-step agents that act on CRM/ERP/tickets, human-in-the-loop review, an "AI Agent Hub" operator console. Less KB-RAG, more workflow-ops + governance. Note: NOT `beam.cloud` (a separate serverless-Python infra company) — I filtered those results out. Confidence MEDIUM — mostly marketing pages, thinner public docs.

---

### (a) How they let a user point a workflow/agent at a SUBSET of the knowledge base

**Glean — knowledge sources are a first-class, attachable object.** An agent (or a step, or a tool) attaches a mix of three categories:
1. **Connectors** — a whole system (Confluence, Google Drive, Salesforce…)
2. **Containers** — "like folders: they contain other containers or documents" (spaces, workspaces, drives). *Nested* containers supported for only 4 connectors (Confluence, Google Drive, OneDrive, SharePoint).
3. **Documents** — individual pinned files/pages.

Flow (Agent builder): **Auto mode proposes** knowledge sources from the agent's described purpose; **the user then chooses which to include** ("Auto mode may propose knowledge sources, although you choose which ones to include"). Scope can be set **per step** — a Read/Think/Respond step can link specific documents, or use natural-language instructions when exact sources aren't known at build time. At query time, **filters** (connector, container, date, status, assignee) narrow the result set before the agent iterates.

**Dust — "Spaces" are the scope primitive.** Each agent sees only what its space exposes: *public* spaces = company-wide, *private* spaces = specific teams/roles. At build time you "select specific channels, folders, or repositories" per data source so agents "only access relevant information."

**Perplexity Enterprise — cleanest RUN-TIME scope toggle.** A *Space* holds uploaded files/connectors; threads in that Space use them as sources. Per query the user toggles: **deselect Web** → files-only, **deselect Org Files** → web-only, **deselect both** → no external sources. This 3-way source switch is the simplest run-time scope UX seen.

**Onyx (open-source) — "Document Sets."** Curators group connectors/docs into named sets and bind them to Assistants; document permissions mirror the source system.

**Takeaway for us (SEED-112):** the universal pattern is *scope = a named, attachable knowledge object chosen from folders/containers*, with an optional per-run override. We already have the substrate (per-thread folder-scope dropdown + server-side bound-folder resolution from v2.9 Phase 098). The gap is purely **making the workflow's bound-folder user-selectable** (author-time default + run-time override) rather than a read-only chip. Perplexity's "sources: [Web] [Org files] [This folder]" toggle is the model to copy for the Run modal. **Do NOT invent a second retrieval path** — reuse Phase 098's ⊆-asserted scope resolver.

---

### (b) How they take RUN INPUTS, including file uploads

**Glean — two distinct input models depending on agent shape:**
- **Task/workflow agents** declare **typed input fields** at build time: *"anything that you need the user to provide should become an input field."* At run, the user fills those fields (Library run form or a shared link). This is the exact model SEED-110 needs.
- **Conversational agents** auto-ingest attachments: *"any documents in the user message are automatically read into memory."*
- **Chat file upload** is a real, admin-gated feature: upload files "for context"; `@filename` attaches a local file (CLI); **zip/archive analysis** runs in an *Agent Sandbox* (Thinking mode only, may be usage-priced); OCR toggle for scanned PDFs; uploads follow chat-history retention (no separate retention policy).

**Beam AI — inputs arrive via triggers + documents.** Agents sit in standby until a trigger fires (webhook, schedule, queue message, manual run). Data-extraction agents "pull values from task inputs and documents." Inputs are less "user fills a form," more "a system/document hands the agent a payload."

**Perplexity — file upload to a Space + connectors** (Google Drive etc.) so org data is available "without repeated manual uploads."

**Takeaway for us (SEED-110 + FILE-01):** the table-stakes pattern is (1) **declared typed inputs** rendered as a run form, plus (2) **a file-attach affordance on the run** that lands in owner-scoped storage with a size/MIME allowlist. Glean's "input fields" concept maps 1:1 onto our workflow definition — a workflow declares inputs, the Run modal renders them, and a `file` input type wires the uploaded artifact into the whitelist-gated `render_template` path. Glean's sandbox-gated archive handling is a good precedent for *threat-modeling* untrusted uploads (isolate + limit + usage-gate).

---

### (c) Their ADMIN / OPERATOR consoles (model mgmt, user mgmt, governance)

**Glean Admin Console — the reference implementation.** Distinct, self-serve sections:

| Section | What the admin does |
|---|---|
| **Data sources / Connectors** | add/remove connectors, adjust permissions + access levels, monitor sync |
| **People / Users** | see adoption stages (not-yet-invited / pending / active), invite, manage |
| **Roles & Permissions (RBAC)** | three admin tiers — **Setup Admin · Admin · Super Admin**; content-moderator grant; **group-based permissions inherited from IdP groups**; **feature greenlists** (gate feature access per group) |
| **Model management** | configure supported LLMs, **control model availability + deprecation**; Glean-hosted model choice surfaced to users where enabled (e.g. Claude Opus 4.8) |
| **Search governance** | check whether a user can access a doc; **hide documents** from results |
| **Feature config** | toggle GenAI features (chat/answers/summarization), SSO/IdP auth |
| **Insights / Analytics** | usage dashboards, active-user + deployment metrics |
| **Agent governance** | define how broadly agents can be shared; **per-request permission checks** ("returns only what the user can access"); **agent alignment models** score each action vs the agent's declared purpose; agent access policies; security controls for scheduled/background agents |

**Beam AI — "AI Agent Hub" = operator command center.** Central dashboard to *manage the AI workforce*: review history, monitor current tasks, plan future work. Standout operator affordances:
- **Jump-to-attention**: "jump straight to the parts of your agent that need attention directly from the dashboard"; **alerts** prompt the operator to connect a missing integration and **re-run** the workflow.
- **Lifecycle control**: **agent versioning + controlled rollouts + rollback**; tune **autonomy levels + human handoffs** to a risk profile.
- **Governance stack shipped as standard**: **RBAC, OAuth-scoped tool access, immutable audit trails for every agent action**, token-usage + cost attribution by workflow, "which agent accessed which data, when, at what cost."
- **Self-healing**: on a failed eval, auto-retry with an improved prompt (recovers without manual intervention).

**Onyx / Dust cross-check:** Onyx ships admin/curator/basic roles + doc-permission mirroring out of the box (MIT, self-host). Dust configures tools at the Admin level and gates them into spaces.

**Takeaway for us (admin shell — SEED-012/095/099/078):** the competitor consoles converge on **six operator surfaces**: (1) data/connectors, (2) users + roles (RBAC + IdP groups), (3) model management, (4) usage/analytics, (5) governance/audit browser, (6) **active-runs monitoring with jump-to-attention + re-run + disable**. Two patterns worth stealing directly: Glean's **feature greenlists** (this IS SEED-099 role-gated visibility — advanced features rendered per group) and Beam's **jump-to-attention + alert + re-run** operator loop. Note: **neither competitor markets a "kill-switch / maintenance mode"** — that's an ops-hygiene feature (ours), whereas they express control as *disable-agent / rollback-version / autonomy-throttle*. Frame our kill-switch as "pause all runs / maintenance mode," and add per-run kill (which Beam's active-task monitor implies).

---

### (d) Their CITATION / attribution UX

**Glean — sentence-fragment-level inline markers + a sources panel.** Concrete behavior:
- Inline citation chips sit **immediately after the statement**, attached to *specific sentence fragments*, not whole paragraphs — "every factual claim links back to a specific document."
- A **"View sources" section** lists all sources used.
- **Hover** → passage preview with surrounding context (cited text highlighted).
- **Click** → a preview interface to confirm, then open in the native app (Drive/Confluence/SharePoint).
- **Deep-linked citations** (admin-enabled) jump to the *exact passage* — page number shown, or the specific slide for decks.
- **Grounded-vs-ungrounded is signalled by presence/absence only:** citations appear when the answer used enterprise or web sources; when the model decides a query is "generic enough to answer without searching," it uses pre-trained knowledge and **has no citations to show.** *No explicit "from your docs / general knowledge" label.*

**Cross-checks (validate the universal pattern):**
- **Perplexity Enterprise** — numbered inline `[1]` per-claim markers for internal files; "you know exactly where the information is coming from."
- **Microsoft Copilot** — citation pills with source links + an **"Allow ungrounded responses" toggle** (org can block ungrounded answers entirely).
- **NotebookLM** — inline `[n]`, click navigates to the source passage.

**Takeaway for us (SEED-033):** the industry has fully converged and it exactly matches SEED-033's plan — **inline per-claim/sentence markers + a sources panel + hover preview + click-to-exact-passage; the ABSENCE of a marker IS the "general knowledge" signal (no explicit label).** We already ship citations as collapsible passage cards *below* the answer (v2.2) — the v3.3 upgrade is **moving markers INLINE, per-claim**, and letting absence-of-marker distinguish org-sourced from model-knowledge claims *within* a mixed answer (the exact Phase-081 gap that planted SEED-033). Copilot's "block ungrounded" toggle is an optional admin differentiator worth noting for the governance track. **Anti-pattern warning (Glean's own research + arXiv 2605.06635 "Cited but Not Verified"):** bad/hallucinated citations damage trust more than none — precision > coverage; prefer generation-time markers the model actually grounds, verified against retrieved chunk IDs.

---

### (e) What makes them feel SIMPLE / user-friendly

**Glean:** one everyday surface — **Assistant** (a single ask box) — kept separate from the admin console and the agent builder. **Auto mode** proposes agent config; an **"Enhance prompt"** button improves instruction reliability. End users never see schema.

**Beam AI:** markets a **"clutter-free, easy-to-navigate"** workspace; a **no/low-code visual workflow builder for non-technical users**; **pre-built agent templates** ("get started in minutes"); optional API/SDK reserved for advanced users. Autonomy is a *slider*, not a config file.

**Dust:** progressive disclosure in the agent builder — "more accessible for new builders while providing power users with advanced capabilities"; improved tool-selection dialog.

**Perplexity:** one search box; sources toggled on/off with a click.

**Takeaway for us (SEED-085 + SEED-099):** three reinforcing moves — (1) **separate the everyday surface (chat / run) from authoring + admin**; (2) **templates + auto/enhance to kill the blank-page problem** (we already have the Starter Workflow Library + NL authoring + Trigger Tuner — parity here); (3) **progressive disclosure** — simple default, advanced one click away. Our Workflow Studio's **strict↔loose two-door** ("Describe & run" / "Author & govern", Phase 124) is *already* this pattern and is genuinely competitive — extend it app-wide as the SEED-085 two-audience contract. **No competitor exposes schema jargon to end users** — that validates SEED-085 (plain labels + on-demand technical reveal) and SEED-099 (advanced features like eval are admin-gated, not on end-user surfaces).

---

### (f) Business packaging (tiers, personas: end-user vs admin)

**Glean:** opaque, sales-led pricing (~$40–75/user/mo, **~100-user minimum**, annual/multi-year; SaaS-hosted vs customer-hosted). **"Enterprise Flex"** adds pooled **FlexCredits** for pay-per-use advanced capabilities across the org. Personas map to roles: **end-user (Assistant) · builder (agent builder) · admin (Setup/Admin/Super Admin)**; feature greenlists gate capabilities per group.

**Beam AI:** Free trial / **Starter (custom)** / **Enterprise (custom)**; outcome/agent-oriented framing ("AI workforce," agents-as-employees); template marketplace as an on-ramp.

**Onyx:** **MIT open-source Community Edition** (self-host, "you own the deployment, your data stays yours") + cloud/enterprise tiers — the relevant model for our hybrid-SaaS + licensing-TBD posture and our local↔cloud env-var switch.

**Dust:** per-seat workspace pricing; **builder vs member** roles; spaces as the team/access unit.

**Takeaway for us:** every serious player runs a **three-persona model — end-user (runs/chats) · builder (authors) · admin/operator (configures org, models, users, governance)** — with advanced features gated to the admin tier. This is exactly SEED-099 + the deferred ROLE-01 tier. For v3.3 we only need the **operator role + end-user default** split (multi-tenant/billing stays at v3.4); the persona vocabulary above should drive the role model. Onyx's self-host-and-own-your-data framing is a differentiator we already have structurally (env-var local/cloud switch, RLS) and should market.

---

## PART 2 — "BEAT THEM" GAP TABLES

### They have it, we lack it (adopt in v3.3)

| Capability | Glean | Beam AI | Others | Our status | v3.3 action |
|---|---|---|---|---|---|
| **User-selectable per-workflow/per-run KB scope** | ✅ attachable knowledge sources per agent/step | partial (system-fed) | Perplexity 3-way toggle; Dust spaces; Onyx doc-sets | Read-only bound-folder chip only | **CORE** — SEED-112 make it selectable (author default + run override) |
| **Declared typed run inputs (form fields)** | ✅ input fields | ✅ task inputs | — | Kickoff textarea only | **CORE** — SEED-110/FILE-01 add typed inputs incl. `file` |
| **Run-time file upload as input** | ✅ chat upload + sandbox archive | ✅ docs into agents | Perplexity Space upload | None on Run modal | **CORE** — SEED-110 |
| **Admin console (users/roles/connectors/models/usage)** | ✅ full self-serve console | ✅ AI Agent Hub | Onyx admin/curator | Per-user Settings only, no `/admin` | **CORE** — admin shell |
| **Active-runs monitor + kill/re-run + jump-to-attention** | ✅ agent governance | ✅ AI Agent Hub alerts+re-run | — | No operator run view | **CORE** — admin health/backpressure/active-runs |
| **Model management UI (availability/deprecation)** | ✅ | ✅ swap models | — | `model_capabilities_overrides` table + read path live (mig 053); **write UI missing** | **CORE** — thin UI over existing table |
| **Role-gated feature visibility (greenlists)** | ✅ feature greenlists | ✅ RBAC | Dust spaces | None (all features visible) | **CORE** — SEED-099 |
| **Inline per-claim citation markers** | ✅ sentence-fragment | — | Perplexity/NotebookLM/Copilot | Passage cards *below* answer | **CORE** — SEED-033 move inline |
| **Deep-link citation to exact passage** | ✅ (admin-enabled) | — | NotebookLM | Passage card shows retrieved text | STRETCH — we have the chunk; add jump |
| **IdP/SSO group-based permissions** | ✅ | ✅ OAuth-scoped | Onyx | Supabase Auth (JWT), no IdP groups | DEFER → v3.4 (multi-tenant) |
| **Block-ungrounded-answers toggle** | — | — | Copilot | None | STRETCH (governance track) |
| **Immutable audit trail browser (admin UI)** | ✅ search governance | ✅ audit-ready traces | Onyx | Audit-log *table* exists (v2.2 F-06); no admin browser | CORE-lite — admin audit browser over existing log |

### We have it, they (mostly) lack it (defend + market)

| Our capability | Why it's an edge | Glean/Beam |
|---|---|---|
| **Sandboxed code execution the agent drives** (Docker, matplotlib/pandas/pptx/docx…) | Agent computes + produces real deliverables, not just retrieves | Glean has an Agent Sandbox for *archive analysis* only; Beam runs tools, not general code |
| **Skill Eval Studio (A/B with-vs-without, dual-arm judge, per-provider scoreboard, versioning, self-improve loop)** | Rigorous, honest, iterative skill quality — genuinely ahead | Neither markets a comparable eval+versioning studio |
| **8-provider routing via MODEL_CAPABILITIES + cross-provider honesty parity** | Provider-agnostic; no lock-in; native SDKs | Glean picks hosted models; Beam swaps but not 8-native-provider-parity |
| **Teachable skills that persist + share (open ZIP standard)** | Users extend the agent's behavior durably | Beam has templates; neither has an agentskills.io-style portable skill bundle |
| **Deterministic locked Harness + publish gauntlet with judge hard-wall** | Accuracy/error-free guarantee the operator's north star demands | Beam has retries/self-heal; neither markets a publish-blocking golden-run judge |
| **Self-host, own-your-data, pure env-var local↔cloud switch + RLS** | Data-sovereignty story (Onyx-like) without Glean's price floor | Glean SaaS/customer-hosted but ~100-seat, ~$50/user floor |
| **Workflow Studio strict↔loose two-door + NL authoring + Trigger Tuner** | Progressive disclosure already shipped | Dust/Beam have builders; two-door disclosure is ours |

### Patterns worth copying verbatim (design adoption)

1. **Glean "input fields"** → declared typed workflow inputs rendered as a run form (incl. a `file` type). *(SEED-110/FILE-01)*
2. **Perplexity 3-way source toggle** `[Web] [Org files] [This folder]` → the cleanest Run-modal scope control. *(SEED-112)*
3. **Glean "Auto mode proposes, user confirms"** → for scope + inputs, pre-fill smart defaults, let the user accept/edit (reduces blank-page). *(SEED-051 authoring)*
4. **Beam "jump-to-attention + alert + re-run"** → the operator active-runs loop. *(admin shell)*
5. **Glean feature greenlists** → role-gated feature visibility map. *(SEED-099)*
6. **Glean "Enhance prompt"** → a one-click instruction-improver (we already have NL authoring; add an enhance affordance).
7. **Progressive disclosure everywhere** (Dust/Beam) → plain default + "advanced" one click away = the SEED-085 two-audience contract, extending our Phase-124 two-door.

---

## PART 3 — FEATURE LANDSCAPE (per v3.3 track)

### Track 1 — Workflow run inputs + KB scoping

**Table stakes**

| Feature | Why expected | Complexity | Dependencies (existing) |
|---|---|---|---|
| User-selectable KB scope on a workflow (author default + run override) | Every competitor scopes retrieval to a chosen subset; operator explicitly asked | MEDIUM | Reuse Phase 098 server-side ⊆-asserted scope resolver + chat folder-scope path; needs SC#10 cross-provider proof |
| Declared typed run inputs rendered in the Run modal | Glean/Beam both declare inputs; kickoff textarea alone is below par | MEDIUM | Workflow definition schema + Run modal (`WorkflowsPage → RunModal`) |
| Run-time file upload as an input (template-fill) | Table-stakes for "fill this DOCX" class; no home today | MEDIUM-HIGH | Storage bucket + owner-scoped RLS + size/MIME allowlist; wire into whitelist-gated `render_template`; threat model |
| Absent scope = whole-KB (starters stay unscoped) | Preserve D-143-4b starter behavior | LOW | Optional field, default None (no-op) |

**Differentiators**

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| 3-way source toggle (KB folder / whole-KB / web) on the run | Perplexity-clean simplicity; matches our Tavily web-search tool | MEDIUM | Compose scope + existing web_search |
| RAG↔sandbox original-bytes bridge (SEED-108) | Agent operates on a KB doc's ORIGINAL file, not just chunks — unlocks true document ops (fill/transform the real file) | HIGH | Storage read + sandbox mount; genuinely ahead of Glean/Beam |
| Agent-driven skill file attachment (FILE-01) | Author attaches files to a skill mid-authoring | MEDIUM | Shared upload/storage/threat pattern with SEED-110 |

**Anti-features**

| Feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| Ingesting run-upload templates into the KB | "Keep the file" | Pollutes KB with one-off templates; retention/permission mess (Glean keeps chat uploads ephemeral) | Ephemeral run-scoped storage, never KB-ingested (matches existing 101.1 ephemeral-template design) |
| Free-text DSL for scope/filters | "Power users want it" | Reintroduces the jargon we removed; injection surface | Reuse the closed-registry filter-AST + no-DSL builder from v3.0 virtual folders |
| A second retrieval path for scoped runs | "Simpler to bolt on" | Divergence from chat scope = cross-provider drift | Reuse the ONE Phase-098 resolver |

### Track 2 — Admin / operator console

**Table stakes**

| Feature | Why expected | Complexity | Dependencies |
|---|---|---|---|
| Operator role tier (end-user vs operator) | Every competitor has an admin persona; prerequisite for everything else in this track | MEDIUM | New role model; keep `org_id` stub for v3.4; RLS-safe |
| `/admin` surface: health + active runs + kill | Beam/Glean both monitor + control runs | MEDIUM | `runs`/`runs:active` Redis sets + `workflow_runs` already track state |
| User management (list/invite/role-assign) | Glean People + Onyx roles | MEDIUM | Supabase Auth users |
| Audit browser (admin UI over existing log) | Glean search-governance / Beam audit traces | LOW-MEDIUM | Audit-log table already exists (F-06); add operator view + filters |
| Role-gated feature visibility (greenlists) | Glean greenlists; SEED-099 (hide eval etc. from end users) | MEDIUM | Role model + per-feature map; Phase 137 eval surface is first consumer |

**Differentiators**

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Kill-switch / maintenance mode | Ops safety valve neither competitor markets | LOW-MEDIUM | Global flag → block new runs, drain active |
| Backpressure / worker-health view | Ties to WORKER_COUNT multi-worker model; operator-scale story | MEDIUM | `runs:active`, Redis stream depth |
| Jump-to-attention + re-run failed run (Beam pattern) | Operator recovers stuck/failed runs fast | MEDIUM | Run status + existing resume/claim CAS |

**Anti-features**

| Feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| Full multi-tenant org/billing in v3.3 | "Do it once" | One-way door; explicitly v3.4; would fight the RLS rewrite | Ship operator role + `org_id` stub only |
| Per-user granular ACL matrix UI | "Enterprise wants it" | Huge surface; premature before IdP groups | Coarse role tiers now; IdP groups at v3.4 |
| Live infra dashboards (Grafana-in-app) | "Observability" | Rebuilds LangSmith/ops tooling badly | Link out to LangSmith; keep admin to app-level health |

### Track 3 — Model & settings management

**Table stakes**

| Feature | Why expected | Complexity | Dependencies |
|---|---|---|---|
| Model management UI (enable/disable, capabilities) | Glean/Beam both let admins control model availability | LOW-MEDIUM | **`model_capabilities_overrides` table + read path already live since mig 053 — only the write UI is missing** (biggest ROI, lowest cost) |
| Live `/models` discovery per provider | Keep the registry current without code edits | MEDIUM | Provider `/models` endpoints; curation flow exists (Phase 096 D-05) |
| Settings unification (one coherent home) | SEED-024; 5-tab settings + scattered app_settings need consolidation | MEDIUM | Existing Settings page + `app_settings`/`user_settings` |

**Differentiators**

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Secrets management UI (off plain-text disk) | SEED-024; security posture | MEDIUM-HIGH | Careful threat model; env still holds infra secrets |
| Per-model cost/rate registry (SEED-073) | Cost attribution like Beam's per-workflow cost | MEDIUM | New registry table |
| Newest-first model curation w/ live validation | Matches operator's "prioritize newest models" memory | LOW | Reuse Phase 096 curation script |

**Anti-features**

| Feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| Install wizard + Solo/Team/Enterprise presets (SEED-003) | "One-click deploy" | Biggest lift in the milestone; natural STRETCH/defer | Defer; document presets as env-var bundles |
| Moving ALL secrets to DB | "Central management" | Some infra secrets must stay in env (bootstrap) | Hybrid: app secrets in UI/vault, infra secrets in env |

### Track 4 — Inline citations + plain-language UX

**Table stakes**

| Feature | Why expected | Complexity | Dependencies |
|---|---|---|---|
| Inline per-claim/sentence citation markers | Universal across Glean/Perplexity/Copilot/NotebookLM | MEDIUM-HIGH | Message schema (`citations` JSONB), agent prompt, streaming pipeline, MessageItem; stable post-075.x stream |
| Absence-of-marker = general knowledge (implicit) | Universal convention; no explicit label | LOW | Convention only; no UI for uncited text |
| Sources panel + hover preview + click-through | We already have passage cards; upgrade to hover + inline linkage | MEDIUM | Reuse v2.2 CitationCards; link markers→cards |
| Plain-language default labels (two-audience) | No competitor shows schema to end users | MEDIUM | SEED-085 glossary/term-map; extend Phase-124 two-door app-wide |
| WCAG AA pass | Baseline accessibility; SEED-092 | MEDIUM | App-wide audit |

**Differentiators**

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Deep-link citation to exact passage/page | Glean's admin-gated feature; we already store the chunk | MEDIUM | Add jump-to-chunk from marker |
| Admin "block ungrounded answers" toggle | Copilot parity; governance track | LOW-MEDIUM | Policy flag on the agent loop |
| Technical-reveal (ⓘ / admin toggle) on plain labels | SEED-085 two-audience contract done right | MEDIUM | Term-map single source of truth |

**Anti-features**

| Feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| Explicit "From your docs / General knowledge" labels | "Be transparent" | **No major platform does this** — noisy, and the marker's presence already signals it (SEED-033) | Presence/absence of inline marker IS the signal |
| Post-hoc semantic citation matching for coverage | "Cite everything" | Heavier + raises hallucinated-citation risk (11–57% rates; "bad citations hurt more than none") | Generation-time markers verified against retrieved chunk IDs; precision > coverage |
| Per-user free-form terminology overrides | "Let users rename things" | Drift; support nightmare | One curated glossary, two audiences (plain / technical) |

---

## PART 4 — FEATURE DEPENDENCIES

```
Operator role tier (Track 2)
    └──enables──> /admin surface (health, users, audit, kill-switch)
    └──enables──> Role-gated feature visibility / greenlists (SEED-099)
                      └──first consumer──> hide eval/model-mgmt from end users

Model management UI (Track 3)
    └──rides on──> model_capabilities_overrides table (LIVE, mig 053)   [write UI only]
    └──rides on──> live /models curation flow (Phase 096 D-05)

User-selectable KB scope (Track 1, SEED-112)
    └──reuses──> Phase 098 server-side ⊆-asserted scope resolver
    └──reuses──> chat per-thread folder-scope path
    └──reuses──> v3.0 closed-registry filter-AST (no-DSL)

Typed run inputs + file upload (Track 1, SEED-110/FILE-01)
    └──reuses──> whitelist-gated render_template fill engine (no new fill runtime)
    └──needs────> owner-scoped Storage bucket + size/MIME allowlist + threat model
    └──shares───> upload/storage pattern with FILE-01 (skill file attach)

RAG↔sandbox bridge (Track 1, SEED-108)
    └──needs────> Storage read of original bytes + sandbox mount

Inline citations (Track 4, SEED-033)
    └──requires──> messages.citations JSONB column
    └──requires──> stable streaming pipeline (post-075.x)  [SATISFIED]
    └──enhances──> existing v2.2 passage cards (link markers → cards)

Plain-language two-audience layer (Track 4, SEED-085)
    └──requires──> role tier (technical reveal = operator/admin)  [ties Track 2]
    └──extends──> Phase-124 strict↔loose two-door
    └──single-source──> glossary/term-map (friendly ↔ schema ↔ helper)
```

**Critical ordering for the roadmap:** the **operator role tier is the keystone** — role-gated visibility (SEED-099), the technical-reveal half of SEED-085, and the whole admin shell all depend on it. Sequence it first in Track 2. The **model-management UI is the cheapest high-ROI win** (table + read path already live — write UI only). SEED-110 and FILE-01 **share one upload/storage/threat-model** — plan them together. Inline citations (SEED-033) is the **largest single-feature lift** (streaming + schema + prompt + frontend) and touches the G-5 hot files (`threads.py`, `MessageItem.tsx`, `StreamsProvider.tsx`) — flag for deeper phase research + the refactor-first guardrail check.

---

## PART 5 — MVP / SCOPE RECOMMENDATION

The milestone context flags ~2–3 milestones of matched work → requirements must trim to CORE vs STRETCH. Recommended cut:

### CORE (v3.3 launch)

- [ ] **Operator role tier + `/admin` shell** (health, active runs + kill, user list, audit browser) — keystone; unblocks the rest
- [ ] **Role-gated feature visibility** (SEED-099) — hide eval/model-mgmt/advanced from end users (Glean greenlists pattern)
- [ ] **Model-management write UI** over the live `model_capabilities_overrides` table — highest ROI/lowest cost
- [ ] **User-selectable KB scope** on workflows (SEED-112) — the operator's headline ask; reuse Phase 098
- [ ] **Typed run inputs + run-time file upload** (SEED-110 + FILE-01, shared upload/threat pattern)
- [ ] **Inline per-claim citations** (SEED-033) — universal table-stakes; the one big lift (deeper research + G-5 check)
- [ ] **Plain-language two-audience labels** (SEED-085) — extend the Phase-124 two-door app-wide

### STRETCH (add if capacity)

- [ ] Kill-switch / maintenance mode + backpressure view
- [ ] RAG↔sandbox original-bytes bridge (SEED-108) — differentiator, HIGH complexity
- [ ] Deep-link citation to exact passage
- [ ] Secrets-management UI (SEED-024) + per-model cost registry (SEED-073)
- [ ] Block-ungrounded-answers admin toggle
- [ ] Live `/models` discovery (curation flow exists; auto-discovery UI is the add)
- [ ] WCAG AA app-wide pass (SEED-092)

### DEFER → v3.4+

- [ ] Install wizard + Solo/Team/Enterprise presets (SEED-003) — biggest lift
- [ ] IdP/SSO group-based permissions + multi-tenant org model (one-way door, v3.4)
- [ ] Per-user granular ACL matrix

---

## PART 6 — FEATURE PRIORITIZATION MATRIX

| Feature | User Value | Impl. Cost | Priority |
|---|---|---|---|
| Operator role + `/admin` shell | HIGH | MEDIUM | P1 |
| Model-management write UI (table live) | HIGH | LOW | P1 |
| User-selectable KB scope (SEED-112) | HIGH | MEDIUM | P1 |
| Typed run inputs + file upload (SEED-110/FILE-01) | HIGH | MEDIUM-HIGH | P1 |
| Role-gated feature visibility (SEED-099) | MEDIUM | MEDIUM | P1 |
| Inline citations (SEED-033) | HIGH | HIGH | P1 (deeper research) |
| Plain-language two-audience (SEED-085) | HIGH | MEDIUM | P1 |
| Audit browser (log exists) | MEDIUM | LOW-MEDIUM | P2 |
| Kill-switch / maintenance mode | MEDIUM | LOW-MEDIUM | P2 |
| RAG↔sandbox bridge (SEED-108) | HIGH | HIGH | P2 |
| Deep-link citation | MEDIUM | MEDIUM | P2 |
| Secrets UI (SEED-024) | MEDIUM | MEDIUM-HIGH | P2 |
| WCAG AA (SEED-092) | MEDIUM | MEDIUM | P2 |
| Install wizard / presets (SEED-003) | MEDIUM | HIGH | P3 |
| IdP groups / multi-tenant | HIGH | HIGH | P3 (v3.4) |

---

## PART 7 — COMPETITOR FEATURE ANALYSIS (summary matrix)

| Feature | Glean | Beam AI | Perplexity Ent. | Dust | Onyx (OSS) | Our approach |
|---|---|---|---|---|---|---|
| KB scope selection | Attachable knowledge sources per agent/step | System-fed inputs | 3-way source toggle | Spaces (public/private) | Document Sets | Selectable folder scope reusing Phase 098 resolver + Perplexity-style toggle |
| Run inputs / file upload | Typed input fields + chat upload + sandbox archive | Task inputs + docs | Space upload + connectors | Data-source attach | Connector sync | Typed inputs incl. `file`; ephemeral run-scoped storage |
| Admin console | Full self-serve (users/roles/models/gov/insights) | AI Agent Hub (monitor/version/rollback/audit) | Enterprise admin | Admin tool/space config | admin/curator/basic | `/admin` shell: health, runs, users, audit, kill-switch |
| Model management | Availability + deprecation, hosted model choice | Swap models per job | Managed | Managed | Bring-your-LLM | Write UI over live `model_capabilities_overrides` |
| Role-gated visibility | Feature greenlists | RBAC + OAuth scopes | Role-based | Spaces | Role tiers | SEED-099 per-feature visibility map |
| Inline citations | Sentence-fragment markers + View sources + deep-link | (ops traces, not chat) | Numbered `[n]` per-claim | Cite-consulted-docs | Cited answers | Inline per-claim markers; absence = general knowledge |
| Grounded/ungrounded signal | Presence/absence (no label) | n/a | Presence | Presence | Presence | Presence/absence (SEED-033 — no explicit label) |
| Simplicity approach | Assistant box + Auto mode + Enhance prompt | Clutter-free + templates + autonomy slider | One box + toggles | Progressive-disclosure builder | Chat UI | Two-door + templates + NL authoring (have); extend two-audience |
| Personas / packaging | end-user/builder/admin; ~$50/user, 100-seat min; Flex credits | Free/Starter/Enterprise; AI-workforce | Pro/Enterprise Pro | Per-seat + roles | MIT OSS + cloud | Operator + end-user roles now; self-host/own-data edge |
| Self-host / data ownership | SaaS or customer-hosted | SaaS | SaaS | SaaS | ✅ MIT self-host | ✅ env-var local↔cloud + RLS (edge) |

---

## Sources

**Glean (primary — own docs, current 2026):**
- [How agents work](https://docs.glean.com/agents/how-agents-work) · [Create a more powerful agent](https://docs.glean.com/agents/create-powerful-agent) · [Knowledge Source Types](https://docs.glean.com/agents/knowledge-source-types) · [Company Search](https://docs.glean.com/tools/glean/company-search) · [Advanced search filters](https://docs.glean.com/user-guide/advanced/advanced-search-filter)
- [About the Admin Console](https://docs.glean.com/administration/about) · [Administrator Roles](https://docs.glean.com/administration/identity/roles/admin-roles) · [Group-based permissions](https://docs.glean.com/administration/identity/roles/group-based-permissions) · [Agent access policies](https://docs.glean.com/administration/protect/ai-security/agent-access-policies) · [Agent Governance](https://www.glean.com/product/agent-governance)
- [Citations (Help Center)](https://docs.glean.com/user-guide/assistant/glean-chat/glean-chat-citations/glean-citations) · [File upload](https://docs.glean.com/administration/assistant/features/file-upload) · [Top AI assistants for accurate source citations](https://www.glean.com/perspectives/top-ai-assistants-for-accurate-source-citations)
- [Glean Enterprise Flex pricing](https://docs.glean.com/glean-enterprise-flex-pricing) · [Glean pricing explained (gosearch)](https://www.gosearch.ai/blog/glean-pricing-explained/) — MEDIUM (third-party)

**Beam AI (own marketing + reviews — MEDIUM):**
- [Platform](https://beam.ai/platform) · [Agentic Workflows](https://beam.ai/agentic-workflows) · [AI Agents](https://beam.ai/ai-agents) · [Changelog](https://beam.ai/resources/changelog) · [How to audit AI agents](https://beam.ai/agentic-insights/how-to-audit-ai-agents-before-enterprise-security-review)
- [Beam AI 2025 guide (skywork)](https://skywork.ai/skypage/en/Beam-AI-In-Depth:-Your-2025-Guide-to-Agentic-Process-Automation/1975589906492878848) · [Capterra pricing](https://www.capterra.com/p/10017154/Beam-AI/) — MEDIUM (third-party)

**Cross-checks:**
- Perplexity Enterprise — [Internal Knowledge Search & Spaces](https://www.perplexity.ai/hub/blog/introducing-internal-knowledge-search-and-spaces) · [What is Internal Knowledge Search](https://www.perplexity.ai/help-center/en/articles/10352914-what-is-internal-knowledge-search)
- Dust — [Managing datasources](https://docs.dust.tt/docs/managing-datasources) · [2025 product recap](https://dust.tt/blog/2025-dust-product-update-recap)
- Onyx (Danswer, OSS) — [GitHub](https://github.com/onyx-dot-app/onyx) · [Docs](https://docs.onyx.app/welcome)
- Microsoft Copilot grounding toggle + NotebookLM — via SEED-033 domain table (2026-05-27), re-confirmed by [AI citation UI patterns 2026 (AYDesign)](https://www.aydesign.ai/blog/ai-citation-source-ui-patterns-2026)
- Citation-precision caution — [arXiv 2605.06635 "Cited but Not Verified"](https://arxiv.org/html/2605.06635v1)

**Internal (existing app — HIGH):** milestone context; SEED-033/085/099/110/112; PROJECT.md; CLAUDE.md (mig 053 `model_capabilities_overrides`, Phase 098 scope resolver, Phase 124 two-door, v2.2 F-06 audit log + citations).

---
*Feature research for: v3.3 Operator UX (Agentic-RAG platform)*
*Researched: 2026-07-10*
