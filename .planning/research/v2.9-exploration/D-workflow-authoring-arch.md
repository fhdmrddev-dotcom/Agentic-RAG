# D — Workflow Authoring Architecture (v2.9 exploration)

**Dimension:** Letting domain experts author domain-specific workflows declaratively, and binding
workflow ↔ project-scope ↔ skill ↔ KB-retrieval-scope as **first-class config, not prompt glue** —
with strict business-requirement adherence.

**Method:** Read the shipped harness primitives (`backend/app/models/harness.py`,
`services/harness/{reachability,phase_types,validators,programmatic}.py`, `threads.py` workflow path,
migration `056`); read SEED-050/051, the D-092 Workflow & Composer UX Strategy Brief, and
`.planning/research/questions.md` (8 pre-decided open questions). Cross-checked against external
evidence: Anthropic *Building Effective Agents* (the 5 patterns + evaluator-optimizer), Anthropic
*Agent Skills* (progressive disclosure, open standard), OpenAI AgentKit / Agent Builder (+ its
deprecation), n8n / Flowise / Langflow / Gumloop / LangGraph authoring surfaces, and the 2026
LLM-as-judge / structured-output reliability literature.

**Headline:** We are **roughly one thin authoring router + a handful of *additive, optional*
`WorkflowDefinition` fields away** from user-authored, project-scoped, skill-composed,
template-filling workflows. The strict Pydantic union + reachability lint + immutable-on-publish +
RLS that shipped in v2.8 are *already the back half of a workflow builder* — and the 2026 market
(OpenAI sunsetting its hosted visual Agent Builder on **2026-11-30**, barely a year after launch)
confirms the strategic call to **NOT build a visual drag canvas**. Compose; don't rebuild.

---

## 0. The substrate we are composing onto (do NOT re-derive)

| Primitive | Where | What it already gives us |
|---|---|---|
| `WorkflowDefinition` → `PhaseSpec[]` → discriminated-union `PhaseConfig` over 5 phase types, **every model `extra="forbid"`** | `backend/app/models/harness.py` | The strict-parse model **IS the NL-generation response schema** (safe-by-construction: a hallucinated/injected key raises `ValidationError`). |
| 5 phase types: `programmatic`, `llm_single`, `llm_agent`, `llm_batch_agents`, `llm_human_input` | same | Cover **4 of Anthropic's 5 workflow patterns** (see §3). Per-phase tool whitelist on the agent types (`available_tools`, D-05 wired on both layers). |
| `ValidatorSpec` — 4 gate kinds (`json_schema`, `regex_match`, `workspace_file_exists`, `programmatic`) + `on_failure` (`fail_run`\|`retry`\|`skip_to_phase:<slug>`) + `max_retries` | `models/harness.py:102` | The validation-gate + bounded-retry + skip-routing machinery already exists and runs. **The judge gate (§6) is a 5th kind, not new infra.** |
| `lint_workflow` — pure publish-time reachability lint (orphans, dangling skips, no-terminal, bad-index, `INPUT_UNSATISFIED`) | `services/harness/reachability.py` | Kills structurally-broken graphs **before** publish. Written for a publish endpoint deferred to v2.9. |
| Immutable-on-publish trigger + `UNIQUE(slug, version)` + owner/global RLS | migration `056` | Versioning + authz already shipped. **Crucially: immutability = "no-edit-published", NOT "no-grow-format"** — adding *optional* fields does not break old published rows (SEED-051). |
| Per-phase folder scope **already threaded** into the run ctx (`folder_subtree_ids`, `scoped_folder_path`) | `threads.py:1192-1288`, `phase_types._build_phase_tool_context` | KB-retrieval scope is **already plumbed** — but resolved from the *thread's* folder, not the *workflow's*. This is the seam §2 widens. |
| Sandbox ships `python-docx` + `python-pptx` + `openpyxl` + `reportlab` + `pandas` | `Dockerfile.sandbox` | **Template-fill (docx/pptx/xlsx) is already possible TODAY** via an `execute_code` / `programmatic` phase. No plugin needed for fill. |
| Skills: `skills` table (global/private RLS), `load_skill`/`save_skill`/`read_skill_file` tools, catalog injected into system prompt, ZIP import/export | migration `017`, skills service | Reusable model-pulled capability — **not yet connected to workflows or folder scope.** |

**Load-bearing fact for everything below:** because `WorkflowDefinition` is a JSONB column parsed by
a Pydantic model, **adding new *optional* fields is a zero-migration, non-breaking change.** Old
published rows simply don't carry them and still `model_validate()` cleanly. This is what makes the
v2.9 "make workflows real" scope cheap.

---

## 1. Sub-question 1 — Bind workflow ↔ project-scope ↔ skills ↔ KB-scope as first-class config

### Current state (the gap)
Today a workflow has **no binding of its own**. KB scope is derived at run time from *the thread's*
`folder_id` (`threads.py:1192`). Skills are never connected to workflows. There is no notion of a
"project" owning a library. Everything domain-specific lives in the phase **`prompt` strings** — i.e.
exactly the "prompt glue" the operator wants to replace.

### Recommended design — four additive, optional fields (no migration break)
All four are *config on the definition / phase*, parsed by the strict models, locked on publish:

1. **Project binding → `project_folder_id` on `WorkflowDefinition`** (nullable UUID).
   A "project" = a folder + subtree. The Workflows page (§4) filters the library by this folder, so a
   project owns its workflows. Run-time default KB scope = this folder's subtree (overriding the
   thread-derived default when present). This is the cleanest "project owns a library of workflows"
   primitive and reuses the existing `folders` table + RLS. *(Optionally a separate column rather than
   a JSONB field, since the library page queries on it — see §4.)*

2. **Per-phase KB scope → `folder_scope` on the phase configs** (nullable folder id/path).
   The reliability-from-grounding lever (SEED-051 sharpening #4; questions.md Q7). The mechanism is
   **already built** — `_build_phase_tool_context` forwards `folder_subtree_ids`/`scoped_folder_path`
   into the phase `ToolContext`, and every Supabase tool (`search_documents`, `ls`, `tree`, `grep`)
   honors it. The only change: resolve `folder_subtree_ids` **per phase** from `phase.config.folder_scope`
   (falling back to the run-level scope) instead of once from the thread. ~15 lines, no schema, no new
   tool. *Pin "Risk register" phase → /Projects/Acme/Risk; "Stakeholders" phase → /Projects/Acme/People.*

3. **Skill composition → `skill_ref` on `llm_agent`/`llm_single` configs** (nullable skill slug).
   A phase whose system framing = a loaded skill gives a consistent **per-step quality bar** (industry
   best practice — see §5). Wire it additively to the phase prompt (load the skill's SKILL.md +
   referenced files, prepend/compose with `phase.config.prompt`). questions.md Q4 already recommends
   **"design the field now, wire in v2.9"** — like `output_keys` already is a designed-but-thin seam.

4. **Workflow-owned assets → `assets` on `WorkflowDefinition`** (list of Storage refs).
   A workflow *owns* its template(s)/form(s)/reference docs as attached files (SEED-051 sharpening #1).
   A fill phase (`execute_code`/`programmatic`) reads the asset + KB data → writes the artifact to the
   v2.7 workspace. **Distinguish from a *run-time* uploaded template** (see §3 template-fill): the
   workflow-owned asset is durable + RLS'd in Storage; the ephemeral in-chat upload is a **run input**
   (an `assets`-typed field in the inputs schema), and *no ephemeral in-chat upload path exists yet* —
   that's net-new run-input plumbing, the one genuinely-new piece on this axis.

### Why config, not prompt glue
Encoding scope/skills/assets as **typed fields parsed by `extra="forbid"` models** means: (a) the
generator can't smuggle them in as free text the engine ignores; (b) they're inspectable/editable in
the form editor (§3); (c) they **lock on publish** with the rest of the definition; (d) the lint can
be extended to validate them (e.g. `folder_scope` references a real folder, `skill_ref` resolves).
That is the difference between "binding" and "a paragraph in a prompt hoping the model complies."

---

## 2. Sub-question 2 — How users AUTHOR (NL→workflow vs visual builders vs templates)

### Market survey (with the load-bearing 2026 signal)
- **Anthropic *Building Effective Agents*** — the canonical taxonomy: workflows = "LLMs and tools
  orchestrated through **predefined code paths**"; agents = "LLMs **dynamically direct** their own
  processes." Our harness is squarely the *workflow* side (backend owns sequencing), which is the whole
  determinism/consistency story. [1]
- **OpenAI AgentKit / Agent Builder** — a visual drag-and-drop canvas (agent/tool/logic nodes),
  versioning, preview runs, inline evals, Guardrails layer, Connector Registry for data sources,
  ChatKit embed. **Decisive signal: OpenAI is winding the hosted visual Agent Builder DOWN — read-only
  evals 2026-10-31, full shutdown 2026-11-30 — and explicitly recommends the *code-defined* Agents SDK
  for durable workflows and NL prompting for the rest.** [2][3] The biggest vendor tried the hosted
  visual canvas and is retreating to **code + NL** within ~13 months.
- **n8n / Flowise / Langflow / Sim / Dify** — node canvases. Powerful, broad connector ecosystems,
  but "blank-canvas paralysis," and the canvas "doesn't scale past a few branches." [4][5]
- **Gumloop / Sim / n8n** — **"describe it → AI drafts the flow"** NL-to-flow generation is the
  strongest 2025-26 entry pattern; the draft must remain **editable + inspectable**, not a black box. [6]
- **LangGraph / CrewAI / OpenAI Agents SDK** — code-first graph/role/handoff definitions; maximal
  control, 1–2 week learning curve. LangGraph's own blog argues *against* "just another workflow
  builder." [7]

### The strategic thesis (confirmed twice over)
Visual builders are **squeezed from both ends**: modern LLMs handle simple logic conversationally (no
canvas needed) and AI-assisted coding lets non-engineers co-write real code for the hard 20% — leaving
the canvas "too constrained for engineers and too complex for non-coders." OpenAI's sunset is the
strongest possible corroboration. **Do NOT build a generic visual drag-to-build canvas** (D-092-AUTHOR
already locked this; this research re-confirms with fresh evidence).

### Recommended authoring loop: **NL-describe → strict-parse → form-edit → lint-on-publish, with a live read-only graph**
This is D-092-AUTHOR Phases B/C, generalized + asset-driven + AI-derived-inputs (SEED-051):

1. **Generate (Phase B).** One-shot structured call: `generate_workflow_definition(nl_description, +
   authoring-time grounding)` using **`WorkflowDefinition` as the response schema** over our own
   provider layer. `extra="forbid"` rejects hallucinated fields; `lint_workflow` rejects unreachable
   graphs; on failure, auto-retry with the validation error fed back. The 2026 structured-output
   literature backs this: native structured output / constrained decoding now gives <0.1% format-failure
   on the strict providers, and the Pydantic-model-as-schema + Instructor-style retry + (optional)
   constrained-decoding is the standard three-layer reliability stack. [8] **Recommend (a) one-shot
   structured call as baseline** (questions.md Q3) — provider-uniform, no LangChain, we own the layer.
   *Authoring-time grounding* = feed the generator the KB **folder tree** + the **tool/skill registry**
   + the **uploaded template** so it proposes correct fields/tools/scoping (SEED-051's two-grounding-
   moments distinction; the generator is grounded at *design* time, each phase is grounded at *run* time).
2. **AI-derive inputs (SEED-051 #2).** The generator infers the input fields from the description +
   uploaded template; **dynamic at design time, fixed at run time** ("same steps" = the operator's
   chosen definition of consistency). New optional `inputs` schema field on `WorkflowDefinition`.
3. **Refine as a form (Phase C).** The discriminated union **IS the form schema** — pick `phase_type`
   → reveal that variant's fields; whitelist = multiselect of registered tool names; validators =
   kind+config sub-form. Editing stays **describe + form-tweak + approve** (HITL), never auto-publish.
   **G-2 sketch-before-plan fires** (live UI).
4. **Live read-only graph (Phase D, optional).** A diagram that updates **as the AI proposes phases** —
   phase cards in sequence, tools/folder-scope/template attached, data-flow arrows; **steered by talking,
   not wiring.** Cheap: it renders the `WorkflowDefinition` + the reachability graph
   (`reachability.py` already computes nodes+edges). View, not drag-to-build (preserves the squeezed-
   middle rejection).

### What makes an authored workflow STRICTLY ADHERENT to one business requirement
A four-layer adherence stack — each layer already has a home:
- **Structural adherence → `lint_workflow`** (shipped). Reachable, terminal, satisfiable inputs.
- **Shape adherence → `extra="forbid"` + discriminated union** (shipped). Can't emit a key the engine
  doesn't honor; can't mix phase-type fields.
- **Quality / acceptance adherence → per-phase validators incl. the new `llm_judge` gate** (§6) +
  the G-6 "## How we'd know this failed" rubric encoded as the judge criteria. This is where "ONE
  business requirement" becomes enforceable: the requirement's acceptance criteria *are* the judge
  rubric + the deterministic validators.
- **Immutability adherence → locked-on-publish trigger** (shipped). Once published, the steps can't
  drift; a change = a new version.

The model literally **cannot publish a runnable-but-broken workflow** — safe by construction. The only
thing it CAN do is publish a structurally-valid workflow that produces *bad output* — which is exactly
why §6 (the judge gate) is a **hard publish-blocking dependency**, not a nice-to-have.

---

## 3. Sub-question 3 — The "workflow library" surface (browse / instantiate / parameterize / version / share)

### Patterns observed
- **n8n template library / marketplace** — metadata-for-browse wrapping an importable definition;
  community submission + a creator/marketplace program; import-then-customize. [9]
- **AgentKit** — publish generates a workflow ID; full versioning with rollback + side-by-side; preview
  before deploy. [2]
- **Lindy / Gems / Custom GPTs / Projects** — **template-fork + a dedicated build surface separate from
  the running chat.** The universal pattern: **authoring/library is a PAGE; running is in a thread.**

### Map to our primitives (almost entirely shipped)
| Library capability | Our mechanism | Status |
|---|---|---|
| **Browse** (drafts + published + shared/global) | `list_published_workflows` + a draft list, filtered by `project_folder_id` (§2) and `created_by`/`is_global` RLS | RLS shipped; needs the **Workflows page** (SEED-051) + a list endpoint |
| **Instantiate** | `create_workflow_run(definition, inputs)` → opens a normal thread, streams via the shared `run:{run_id}` SSE | shipped (runs are thread-bound) |
| **Parameterize** | the AI-derived **`inputs` schema** collected at launch (some inputs KB-auto-fillable) | net-new (`inputs` field + a launch form) |
| **Version** | `UNIQUE(slug, version)` + immutable-on-publish trigger; publish a new version, never mutate | shipped |
| **Share / global** | `is_global` + owner/global RLS (skills ownership model) | shipped — **but INSERT `WITH CHECK (is_global=false)` reserves global publish to seed migrations**; self-serve global needs the **operator tier** (deferred, D-v2.8-01) |

**Surface decision (SEED-051, resolves the page-vs-panel tension):** Workflows = a **first-class PAGE**
in the nav (like Skills) — library + builder + launch live there; **execution happens in a thread**
(Run → opens/redirects to a normal chat thread, shares run SSE/lock/anchor). No separate execution
route (that would fight the 068/075.x reconciliation work). You never "switch to Harness" — you Run a
workflow from the page, which puts *that thread* into workflow mode; Deep is the resting default
(`active_workflow_run_id IS NULL`, verified `threads.py`).

**The one authz gap:** self-serve **global** sharing requires relaxing the `is_global=false` INSERT
check, which is exactly what the deferred **operator/admin role tier** unlocks. Recommend: keep
self-serve **drafts-only + per-user publish** in v2.9 (RLS already enforces it safely, questions.md Q2
option (b)); gate **global** publishing behind the operator tier when it lands. This is a clean,
already-enforced security boundary — no new RLS logic, just a role check to relax it later.

---

## 4. Sub-question 4 — How "skills as reusable capability" compose into workflows elsewhere

### Evidence
- **Anthropic Agent Skills** — a skill = a directory with a `SKILL.md` (YAML frontmatter: name +
  description) + optional bundled reference files + optional executable scripts. **Progressive
  disclosure** is the core design: only name+description load at startup (~30-50 tokens), the full
  SKILL.md loads when triggered, reference files load only when needed. Skills are **model-pulled**
  (the agent *chooses* relevance) and can bundle code the agent runs as tools. **Now an open standard**
  adopted across Claude, OpenAI, and Google tooling. [10][11]
- **Subagents (Claude Agent SDK)** — reusable, isolated-context workers an orchestrator delegates to via
  the Agent tool, staying in control; parallelizable. **CrewAI** = role/goal/backstory personas + tasks.
  **OpenAI Agents SDK** = explicit handoffs (one agent transfers control + context to another).
  **LangGraph** = directed graph with conditional edges. Different couplings of the same idea:
  *a reusable unit of capability slotted into an orchestrated flow.* [12]

### The crisp distinction to preserve (SEED-051)
- **Skill = optional, model-pulled *judgment*** — reusable instructions/assets the model loads when it
  judges them relevant. Adds **method, not control.** Non-deterministic activation.
- **Workflow = author-locked *orchestration*** — same steps every run; the backend (not the LLM) owns
  the order. Adds **control, not judgment.** Deterministic activation.
- **They compose; they don't compete.** Skills already work identically in Deep and Harness mode.

### Recommendation: composition via `skill_ref` on a phase (design the seam now, wire in v2.9)
Map the industry "skill-as-a-step / role-as-a-step / subagent-as-a-node" pattern onto **our** model:
a phase carries an optional `skill_ref`; at run time the engine loads that skill (progressive-disclosure
SKILL.md + referenced files) and composes it into the phase's system framing — giving a **consistent
per-step quality bar** without coupling the *whole* workflow to the skills registry. This is the direct
analog of CrewAI giving a task a persona, or AgentKit slotting a configured agent node — but grounded
in our KB and locked on publish. Our `llm_agent` phase already supports a per-phase tool whitelist; a
skill is the *judgment* counterpart to that *capability* whitelist. **Honest coupling note:** `skill_ref`
binds a workflow's contract to the skills registry (a deleted/renamed skill breaks an old definition) —
mitigate by snapshotting the skill version into the locked definition, same immutability logic as the
rest. Also name the reverse seam consciously: **can a skill *trigger* a workflow?** (deferred — it's a
plugin-contract `tool`-type concern, §7).

---

## 5. Sub-question 5 — The llm_judge / evaluator-optimizer gate (enforce quality)

### Evidence
- **Anthropic evaluator-optimizer** — one LLM generates, another evaluates + gives feedback in an
  iterative loop. Use it "when we have **clear evaluation criteria** and when iterative refinement
  provides measurable value." Reliability comes from clear criteria + **stopping conditions to prevent
  infinite loops.** [1]
- **2026 LLM-as-judge / rubric literature** — judge against an explicit **rubric**; return a
  **structured score + reasoning** (numeric/categorical/**boolean for binary gate decisions**). Best
  practice: **deterministic acceptance gate FIRST** (e.g. valid JSON / non-empty / file exists), then
  subjective rubric scoring only if the structural gate passes. **Calibrate** the judge prompt against
  ~50 expert-graded real failures; validate to **75–90% agreement** with human labels before scaling;
  gate deployment on the metric matching your **most expensive failure mode.** A calibrated judge
  agrees with humans ~85% — higher than two humans agree with each other. [13][14]

### Map to our primitives — it's a **5th ValidatorSpec kind**, not new infra
Add `kind: "llm_judge"` to `ValidatorSpec` with `config = {rubric, threshold, model, pass_is_boolean}`.
It composes the **existing** gate machinery verbatim: `on_failure` (`fail_run`/`retry`/`skip_to_phase`)
+ bounded `max_retries` give you the evaluator-optimizer loop **with a built-in stopping condition**
(`max_retries` is the loop bound Anthropic warns you need). The retry-feedback producer/consumer pair
already exists (`ctx.retry_feedback` set by the gate-retry loop, consumed by `_retry_suffix` in
`phase_types.py`) — so the judge's critique is *already* threaded back into the re-run prompt. This is
literally the evaluator-optimizer pattern using parts we shipped in v2.8.

**Layering (follow the 2026 best practice):** keep the cheap deterministic validators
(`json_schema`/`regex_match`/`workspace_file_exists`/`programmatic`) as the **first gate**; run the
`llm_judge` only if they pass. Cheaper, less gameable than a judge alone. (Note 093 already found the
old `plan_execute_verify` "VERIFIED token" gate is *theatrical/gameable* — the judge with a real rubric
is the fix.)

### This is SEED-050, restated at authoring time — and it is a HARD dependency
A generated workflow can pass `lint_workflow` and still emit garbage (questions.md Q1 calls this "the
single biggest latent risk"). **NL-authoring MUST NOT ship without an output-quality gate.** Two
complementary forms, both owned by SEED-050 → Phase 096 eval, consumed here at publish:
- **Per-run judge gate** (the `llm_judge` ValidatorSpec above) — runs every execution.
- **Publish-time "golden run"** — run the candidate workflow on a representative input, score the
  output with the rubric, **block publish if below threshold.** This is the authoring-time analog of
  the per-run gate and the concrete realization of "strictly adherent to ONE business requirement."

---

## 6. Plugin Contract — genuinely required vs nice-to-have

The 6-type contract (tool, panel_renderer, phase_type, file_preview, data_source, secrets_adapter) is
deferred-but-related. Verdict per type for *this* milestone's workflow-authoring scope:

| Plugin type | Needed for v2.9 authoring? | Reasoning |
|---|---|---|
| **`phase_type`** | **Nice-to-have / NOT required.** | The 5 shipped types cover 4 of Anthropic's 5 patterns. The missing one (**orchestrator-workers** = LLM creating subtasks at runtime) is **deliberately excluded** (questions.md Q8) — it trades away the determinism that IS the consistency story. The `programmatic` registry already gives fixed-phase fan-out (`split_topic`). Don't add runtime-dynamic phases. |
| **`data_source`** | **Required ONLY for external connectors** (the "send/integrate with other apps" phase). | KB-grounded retrieval + template-fill need **zero** new data-source plugin — `search_documents`/`query_tables` + Storage assets + the sandbox already do it. The plugin is needed the moment a workflow's final phase must push to email/Slack/GDrive/Jira (the AgentKit Connector Registry analog). **Cross-link seam (SEED-051):** the Plugin Contract and the workflow engine meet at the **"send" phase** — name it now, build it when an outbound integration is actually scoped. |
| **`secrets_adapter`** | **Required only alongside connectors** (OAuth/API-key storage for the "send" phase). | No connectors → no secrets to adapt. Pairs 1:1 with `data_source`. |
| **`panel_renderer`** | **Nice-to-have.** | The live read-only graph (§3 Phase D) renders from existing data (`WorkflowDefinition` + `reachability.py` nodes/edges) — no plugin. A plugin only earns its keep for *third-party* custom phase visualizations later. |
| **`file_preview`** | **Nice-to-have.** | Template/artifact preview (docx/pptx/xlsx) is a workspace-panel concern (SEED-037), independent of authoring. |
| **`tool`** | **Nice-to-have for authoring; the seam for skill↔workflow triggering.** | Per-phase whitelists already select from the *registered* tool set. A `tool` plugin formalizes the `PROGRAMMATIC_PHASE_REGISTRY` / tool registry as a user-extensible seam (D-092 calls it "the seam the v2.9 Plugin Contract will formalize"). Also the home for "**a skill triggers a workflow**" (§5 reverse seam). Treat the registry as a **curated-list field** now; formalize as a plugin only when external tool authoring is demanded. |

**Net:** v2.9 workflow-authoring + project-binding + skill-composition + template-fill + judge-gate
needs **NO plugin contract at all** for the KB-grounded, in-platform flagship demo (project management).
The Plugin Contract becomes load-bearing **only** when workflows must reach **outside** the platform
(the `data_source` + `secrets_adapter` pair at the "send" phase). Recommend: **decouple the Plugin
Contract from the authoring milestone**; name the "send-phase" seam; build the connector pair as its
own scoped milestone when an outbound requirement is concrete.

---

## 7. Risks, open decisions, and recommended sequencing

### Top risks
1. **Structural validity ≠ output quality** (SEED-050). A lint-clean workflow can emit garbage. The
   `llm_judge` gate + publish-time golden run are the **mandatory** mitigation; **do not ship
   NL-authoring without them.**
2. **Template-fill robustness is unproven *here*.** The sandbox *has* the libraries, but "KB-grounded
   fill of an exact docx/pptx/xlsx" hasn't been demonstrated end-to-end. **Spike it first** (SEED-051
   recommends spike-first) before deciding whether fill is a first-class capability vs an `execute_code`
   phase.
3. **AI-deriving input fields from a template is novel** — reliability unknown. Spike answers the
   `inputs` schema shape (questions.md Q5).
4. **`skill_ref` couples the workflow contract to the skills registry** — snapshot the skill into the
   locked definition (immutability logic reused).
5. **Cascading multi-step failure** (even 85%/step → ~20% over 10 steps). Mitigations are already in
   hand: KB **grounding** (retrieval-check) + sandbox **execution** (run/validate) + the judge gate.

### Spike-first plan (SEED-051, operator-agreed) — answers the schema before committing
A throwaway spike on **one real project-management case** (e.g. fill a Risk Register template from a KB
folder) answers all four unknowns cheaply, and its output **becomes** the `inputs` + `assets` + `folder_scope`
schema design (evidence-first): (a) can a model reliably derive input fields from description + template?
(b) does KB-grounded docx/pdf fill produce a clean artifact reliably? (c) what does authoring-time
grounding (folder tree + tool/skill registry fed to the generator) need? (d) does describe→refine→publish
*feel* good with a human in the loop? **First v2.9 move = this spike**, then plan Authoring Phase B/C on
the evidence.

### Decisions to lock at v2.9 discuss-phase (defaults already drafted in questions.md)
- Q1 Output-quality gate is a **hard publish blocker** (judge + golden run). **Recommend: yes.**
- Q2 Authorship = **drafts self-serve + per-user publish; global publish behind operator tier.**
- Q3 Generator = **one-shot structured call** (`WorkflowDefinition` schema + lint + auto-retry).
- Q4 `skill_ref` = **design the field now, wire in v2.9.**
- Q5 `inputs` = **AI-derived dynamic-at-design, locked-at-run** (spike answers the shape).
- Q6 `assets` = **Storage-backed, RLS'd, referenced in the definition**; fill mechanism (spike decides
  first-class vs `execute_code`).
- Q7 `folder_scope` per phase = **add the field; `search_documents` honors it via the existing ctx
  plumbing.**
- Q8 Orchestrator-workers (runtime-dynamic phases) = **explicitly DON'T add** — preserve determinism.

---

## 8. Implications for v2.9 scope (compose-over-build summary)

- **~90% of "make workflows real" composes shipped primitives.** Net-new = (1) an authoring router
  (`POST /workflows`, `PUT /workflows/{id}` draft-only, `POST .../publish` = validate+lint+gate); (2) a
  one-shot NL generator over the strict schema; (3) the **Workflows page** + form editor + live graph;
  (4) four *additive optional* fields (`project_folder_id`, `folder_scope`, `skill_ref`, `inputs`/`assets`);
  (5) the `llm_judge` ValidatorSpec kind; (6) ephemeral run-input file upload (the one missing
  plumbing). **Zero of these break old published rows** (immutability = no-edit, not no-grow).
- **Don't build a visual drag canvas** — OpenAI's hosted Agent Builder sunset (2026-11-30) is fresh,
  decisive market evidence; our differentiated form is NL→strict-parse→form-edit→lint-on-publish + a
  read-only live graph.
- **The judge gate is the gating dependency**, not a polish item — it is what turns "structurally valid"
  into "strictly adherent to ONE business requirement," and SEED-050 owns it.
- **The Plugin Contract is NOT on the critical path** for the KB-grounded flagship demo; it becomes
  load-bearing only at the outbound "send" phase (`data_source` + `secrets_adapter`). Decouple it.
- **Skills compose into workflows via `skill_ref`** (per-step judgment), preserving the skill(judgment)
  vs workflow(control) distinction — both already work in Deep and Harness mode.

---

## Sources
[1] Anthropic — *Building Effective Agents* (5 workflow patterns + evaluator-optimizer + agent/workflow
distinction): https://www.anthropic.com/research/building-effective-agents
[2] OpenAI — *Introducing AgentKit* (Agent Builder canvas, versioning, Connector Registry, ChatKit,
Guardrails): https://openai.com/index/introducing-agentkit/
[3] OpenAI — Agent Builder deprecation (read-only evals 2026-10-31, shutdown 2026-11-30; recommends
Agents SDK / NL): https://developers.openai.com/api/docs/deprecations ·
https://community.openai.com/t/deprecation-notice-agent-builder/1382650
[4] Flowise vs Langflow vs n8n vs Sim — visual agent builder comparison 2026:
https://madappgang.com/blog/open-source-visual-agent-builders-compared-flowise-vs-langflow-vs-n8n-vs-sim-studio-in-2026/
[5] index.dev — Flowise vs LangGraph vs n8n framework comparison 2026:
https://www.index.dev/skill-vs-skill/ai-langgraph-vs-n8n-vs-flowise
[6] Gumloop — *How to build agentic AI workflows in 2026 (without coding)* (describe→AI-drafts-flow):
https://www.gumloop.com/blog/how-to-build-agentic-ai-workflows
[7] LangChain — *Not Another Workflow Builder*: https://www.langchain.com/blog/not-another-workflow-builder
[8] TECHSY — *Reliable JSON from Any LLM: Pydantic + Zod (2026)* / BetterLink — structured-output
constrained decoding: https://techsy.io/en/blog/llm-structured-outputs-guide ·
https://eastondev.com/blog/en/posts/ai/20260506-llm-structured-output/
[9] n8n — Templates docs + community template library/marketplace: https://docs.n8n.io/workflows/templates/ ·
https://n8n.io/workflows/
[10] Anthropic — *Equipping agents for the real world with Agent Skills* (progressive disclosure):
https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
[11] MindStudio — *Agent Skills as an open standard* (Claude/OpenAI/Google adoption):
https://www.mindstudio.ai/blog/agent-skills-open-standard-claude-openai-google
[12] Anthropic — *Building agents with the Claude Agent SDK* (subagents) + 2026 framework comparison
(CrewAI roles, OpenAI handoffs, LangGraph graph): https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk ·
https://qubittool.com/blog/ai-agent-framework-comparison-2026
[13] Medium (Adnan Masood) — *Rubric-Based Evals & LLM-as-a-Judge* (2026):
https://medium.com/@adnanmasood/rubric-based-evals-llm-as-a-judge-methodologies-and-empirical-validation-in-domain-context-71936b989e80
[14] Evidently AI — *LLM-as-a-judge: complete guide* (calibration, agreement, gate design):
https://www.evidentlyai.com/llm-guide/llm-as-a-judge

### Internal cross-refs
SEED-050 (workflow result-quality — owns the judge gate), SEED-051 (generalized NL→workflow authoring),
`.planning/research/questions.md` (8 open decisions + drafted defaults), D-092 Workflow & Composer UX
Strategy Brief (`.planning/milestones/v2.8-phases/092-dual-mode-wiring-continue-button/092-WORKFLOW-UX-STRATEGY-BRIEF.md`),
`backend/app/models/harness.py`, `backend/app/services/harness/{reachability,phase_types}.py`,
`backend/app/api/threads.py:1180-1290` (folder-scope binding), migration `056_workflow_definitions.sql`.
