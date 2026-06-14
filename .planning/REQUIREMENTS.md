# Requirements — v2.9 Workflow Studio

**Milestone:** v2.9 Workflow Studio
**Defined:** 2026-06-08
**Goal:** Turn the v2.8 harness into a capability a domain expert can author, connect to their project's knowledge and skills, and run to produce a real deliverable. PM is the flagship demo, not hardcoded logic.
**Research brief:** `.planning/research/v2.9-EXPLORATION.md` (6 dimension reports A–F + adversarial verification)
**Through-line:** ~80–90% composition of shipped v2.8 harness primitives. Net-new = authoring UX + a project/scope binding + ephemeral template upload + a small validation-gate library + the Workflows page. NOT a new runtime; NOT the Plugin Contract.

---

## CORE Requirements (the milestone is incomplete without these)

### PROJ — Project & scope binding
- [x] **PROJ-01**: A workflow can be bound to a project (= a folder + its subtree) via an optional `project_folder_id`; the Workflows library can be filtered to a project. *(Additive optional field on `WorkflowDefinition`; zero-migration, old workflows still validate.)*
- [x] **PROJ-02**: A bound workflow's KB retrieval scope defaults to its project folder subtree; an optional per-phase `folder_scope` narrows retrieval for that phase. Scope comes from the binding, not a prompt hint.

### WFSKILL — Skill ↔ workflow composition
- [x] **WFSKILL-01

**: An `llm_agent` / `llm_single` phase can reference a skill via an optional `skill_ref`; the skill's instructions + referenced files compose into the phase framing and `read_skill_file` is auto-whitelisted. The skill version is snapshotted into the locked definition so a later edit/delete can't break a published workflow. *(Deep path byte-identical.)*

### TMPL — Template-fill
- [x] **TMPL-01**: A user can upload a template (docx/pptx/xlsx) into a thread **temporarily** — workspace-only, TTL + cron sweep, RLS-scoped, **never ingested into the KB and never appearing in search**. *(Also closes the injection-via-uploaded-doc vector.)*
- [x] **TMPL-02**: A workflow can fill a template from project-KB content — the LLM emits a **cited** Pydantic field-map (each field nullable, carrying source chunk/page), and pinned sandbox code renders the file deterministically. **Both** the trusted path (library templates, `docxtpl`/Jinja) and the arbitrary-upload path (non-Jinja run-replace) are supported.
- [x] **TMPL-03**: A filled template is validated before delivery — **re-opened with the same library to assert integrity** (a corrupt file can never reach the user as "done") — and rendering runs inside the sealed sandbox with `jinja2.sandbox.SandboxedEnvironment` (SSTI contained).

### WFAUTH — Workflow authoring & the Workflows page
- [x] **WFAUTH-01
**: A user can create/edit a workflow as a draft (CRUD) via a new API + the new **Workflows page**, with publish-time structural lint (reachable, terminal, satisfiable inputs) blocking invalid publishes.
- [x] **WFAUTH-02
**: A user can **describe a workflow in natural language** and receive a valid draft definition — one-shot structured generation over the strict `WorkflowDefinition` schema, grounded in the project folder tree + tool/skill registry + any uploaded template; invalid generations auto-retry against the validation error.
- [ ] **WFAUTH-03**: The Workflows page renders a **read-only live graph** of a workflow's phases/edges (view, not drag-to-build).
- [ ] **WFAUTH-04**: A published workflow can be browsed in a project-filtered library and **run from a thread** (the thread enters workflow mode; Deep is the resting default). Definitions are immutable-on-publish + versioned.

### QUAL — Output-quality / strict adherence
- [ ] **QUAL-01**: A workflow declares exactly **one `business_requirement`**; an `llm_judge` output-quality gate + a publish-time **golden run** are a **HARD publish blocker** — a structurally-lint-clean workflow that produces bad output cannot publish. *(NL-authoring MUST NOT ship without this.)*

### GATE — Reusable validation-gate library
- [ ] **GATE-01**: A reusable library of validator kinds is available to any phase, each riding the existing gate + bounded-retry loop: `citations_required` (deterministically reject uncited register rows before any judge call), `freshness` (a guaranteed-first "check the date first" preflight that branches to `ask_user` on stale/multiple versions), `structure_check`, `output_file_valid` (re-open the produced file), `llm_judge_rubric`.

### GOV — Governance / safety
- [x] **GOV-01**: Retrieval scope (`scope_folder_ids`) is resolved **server-side from the user's RLS context** at run start and bound to every retrieval call as a parameter the model cannot widen; retrieved `folder_id`s are asserted ⊆ scope (RLS as backstop). Read-untrusted-content and act/export stay separable across phases via the per-phase tool whitelist.

### PM — Flagship content pack
- [ ] **PM-01**: A PM flagship content pack ships — example templates (project charter / weekly status report / risk register) + workflow definitions + register schemas — authored **entirely on the generic primitives** (domain-author-driven, NOT PM-hardcoded). Headline demo: a single template-fill (status report from the project KB).

---

## STRETCH Requirements (ship only if CORE lands clean and budget remains)

- [ ] **SCHED-01**: Scheduled/recurring workflow triggers (frequency / time / timezone). **Hard prerequisite:** REJECT-semantics per-run token ceilings + per-workflow daily caps, disabled-by-default — *no schedule without a budget*. (Depends on a spend meter that doesn't exist yet.)
- [ ] **GRID-01**: A **citation-traceable grid renderer** (rows = items, cols = attributes, every cell agent-filled + source-cited) for the risk register / RTM / stakeholder matrix, backed by `llm_batch_agents` + retrieval.
- [ ] **GOV-02**: A per-run **provenance-receipt view** surfacing the already-recorded chain (definition@version + INSERT-only run log + gate verdicts + cited sources) — EU AI Act Art. 12 traceability shape.
- [ ] **PLUG-01**: Lock the `phase_type` + `file_preview` Plugin Contract types on the flagship telemetry (a `fill_template` phase + an office/PPTX in-panel preview reference plugin); **design but do not lock** the `data_source` / `secrets_adapter` seams.
- [ ] **ROLE-01**: An operator/admin role tier enabling self-serve **global** workflow publish (relaxes the `is_global=false` INSERT check) — only if global sharing becomes a v2.9 headline. Otherwise drafts + per-user publish suffice.

---

## Future Requirements (deferred to later milestones, with re-open triggers)

- **Inbound connectors** (email / OneDrive / GDrive → KB auto-ingestion) → **SEED-013** (v3.3 webhook/API substrate). *Re-open:* first `data_source` plugin design — first reference data_source = read-only GDrive/OneDrive folder→KB sync.
- **Scheduled / triggered ingestion** (watch a folder/feed → ingest) → **SEED-014** (v3.4 automations). *Re-open:* first request to auto-pull a Drive/IMAP source on a schedule.
- **Outbound "send the filled artifact"** (email / DocuSign / Drive upload) → **SEED-051 plugin send-seam** + `data_source`/`secrets_adapter`. Name the seam in v2.9; build after the contract locks.
- **Enhanced Document Structure** (M-Files/Doxis basics — metadata-driven views / "virtual folders", document relationships, custom metadata + per-field confidence, auto-classification, extraction-model flexibility) → **SEED-005, the NEXT milestone after v2.9** (operator-confirmed 2026-06-08).
- **Word content controls / SDT** markers (.NET-vs-Python toolchain gap); **Google Docs `replaceAllText`** fill (arrives with the Google connector); **CPM/float + EVM/cost** compute engine as a `phase_type` plugin (compute-not-LLM — PM math never in core LLM phases).
- **Full Plugin Contract 6-type lock + `super_admin`/operator tier** → later v3.x milestones (per D-v2.8-01, now incremental rather than one milestone).

---

## Out of Scope (explicit exclusions for v2.9)

| Excluded | Reason |
|---|---|
| Drag-to-build visual node-graph editor | Anti-feature; our buyer is a domain expert, not an automation engineer. OpenAI sunsetting its hosted Agent Builder (full shutdown 2026-11-30) confirms the squeezed middle. NL + form + read-only graph instead. |
| Becoming a connector / iPaaS platform | CLAUDE.md forbids connectors; stay KB + sandbox + template-fill scoped. Connectors are v3.3/v3.4 (SEED-013/014). |
| Multi-tenancy / org-department scoping | v3.2 territory. |
| Recurring execution without budget caps | No schedule without a spend ceiling (SCHED-01 prerequisite). |
| DM Tier A/B document-management features | SEED-005, the next milestone (Enhanced Document Structure). |
| New runtime / re-implementing the harness loop, agent loop, or provider gateway | v2.9 composes shipped primitives; Deep path stays byte-identical (the red line). |

---

## Open reported-bug sweep (2026-06-08, /gsd:new-milestone mandate)

3 open `surface: Agentic-RAG` reports swept; **none folded into v2.9 CORE** (all Deep-mode chat / provider / live-execution polish, outside the Workflow Studio authoring domain). They sit in the SC#10 cross-provider blast radius (workflows run in a thread, share the composer + live-execution panel) → v2.9 UAT must not regress them.

| Report | Severity | Disposition |
|---|---|---|
| `general-chat-intermittent-silent-send-drop` | minor | leave open — tracked as SEED-055 residual |
| `minimax-m3-invalid-tool-args-400` | minor | leave open — provider-specific; MiniMax low-priority; re-open trigger: cross-provider workflow UAT surfaces it |
| `setting-up-agent-hides-model-activity` | major | leave open — Deep-mode dispatch-latency banner; candidate for a focused Deep-UX polish phase |

---

## Build notes (carried into roadmap)

- **Spike-first (SEED-051):** the first build step is a spike — fill a Risk Register from a KB folder — answering the 4 unknowns that BECOME the schema (can a model derive input fields from a template? does KB-grounded docx fill produce a clean artifact? what does authoring-time grounding need? does describe→refine→publish *feel* good?). **Do NOT pre-commit the `inputs`/`assets`/`folder_scope` schema before this.** → **Phase 097.**
- **Sketch-first (G-2):** the Workflows page / NL-form editor / live graph go through `/gsd:sketch` before spec/plan. `sketch-findings-agentic-rag` already names these surfaces. → **Phase 103** (run `/gsd:sketch` before `/gsd:spec-phase`).
- **Failure criteria upfront (G-6):** template-fill known failure modes (docx run-split silent miss, unescaped XML corruption, pptx variable-row table can't grow, xlsx chart/image stripping, merged-cell mis-write, produced-file-won't-open) become UAT rows at spec time. → **Phase 101.**
- **Stack additions:** only `docxtpl` is new (python-docx/pptx/openpyxl/reportlab already in the sandbox). Add it to `backend/Dockerfile.sandbox` and bump the `SANDBOX_IMAGE` tag. → surfaced in **Phase 097**, locked in **Phase 101**.
- **Spec-phase re-confirmations** (against live harness code): (a) are gate verdicts-with-evidence already persisted to the run log? [Phase 102] (b) does in-workflow retrieval already take a *bound* folder-scope parameter vs a prompt hint? [Phase 098] (c) does the shared gateway uniformly capture token usage across all 7 providers (the spend-meter prerequisite for SCHED-01)? [Phase 105].

---

## Traceability

| REQ-ID | Phase(s) | Status |
|--------|----------|--------|
| PROJ-01 | Phase 098 | Complete |
| PROJ-02 | Phase 098 | Complete |
| GOV-01 | Phase 098 | Complete |
| WFSKILL-01 | Phase 099 | Complete |
| TMPL-01 | Phase 100 | Complete |
| TMPL-02 | Phase 101 / 101.1 | Complete (2026-06-12, 101.1 live verify) |
| TMPL-03 | Phase 101 / 101.1 | Complete (2026-06-12, 101.1 live verify) |
| GATE-01 | Phase 102 | Pending |
| QUAL-01 | Phase 102 | Pending |
| WFAUTH-01 | Phase 103 | Pending |
| WFAUTH-02 | Phase 103 | Pending |
| WFAUTH-03 | Phase 103 | Pending |
| WFAUTH-04 | Phase 103 | Pending |
| PM-01 | Phase 104 | Pending |
| SCHED-01 (STRETCH) | Phase 105 | Pending |
| GRID-01 (STRETCH) | Phase 106 | Pending |
| GOV-02 (STRETCH) | Phase 107 | Pending |
| PLUG-01 (STRETCH) | Phase 108 | Pending |
| ROLE-01 (STRETCH) | Phase 109 | Pending |

**Spike note:** Phase 097 (SEED-051 spike) closes no REQ-ID directly — it precedes the schema lock and informs PROJ / TMPL / WFAUTH. Its output BECOMES the `inputs`/`assets`/`folder_scope` schema shape.

**Coverage:** 14/14 CORE requirements mapped (each to exactly one phase) + 5/5 STRETCH requirements mapped. No orphans, no duplicates.
