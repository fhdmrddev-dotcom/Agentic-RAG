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
- 🚧 **v2.9 Workflow Studio** — Phases 097-109 (in progress; 097-104 CORE committed, 105-109 STRETCH optional)

---

## v2.9 Workflow Studio (Phases 097–109) — IN PROGRESS

**Milestone goal:** Turn the v2.8 harness into a capability a domain expert can author, connect to their project's knowledge and skills, and run to produce a real deliverable — making workflows genuinely useful, with project management as the flagship demo (not hardcoded logic). The milestone is ~80–90% composition of shipped harness primitives; the net-new is authoring UX + a project/scope binding + ephemeral template upload + a small validation-gate library + the Workflows page.

**Granularity:** standard (config has no explicit granularity; 8 CORE phases incl. the spike). **Coverage:** 14/14 CORE requirements + 5/5 STRETCH requirements mapped (100%, no orphans).

### Build order (locked 2026-06-08) — why the phases sit in this order

1. **Phase 097 is a SPIKE first (SEED-051).** Fill a Risk Register from a KB folder end-to-end on ONE provider. It answers the 4 unknowns that BECOME the schema. **NO production schema (`inputs`/`assets`/`folder_scope`) is locked before this spike.**
2. **Phase 103 (Workflows page / NL form editor / live graph) is sketch-gated (G-2 FIRES).** Run `/gsd:sketch` before `/gsd:spec-phase`. `sketch-findings-agentic-rag` already names these surfaces (sketches 012 workflows-page + 013 workflow-builder processed).
3. **CORE then sequences so dependencies resolve:** project=folder binding + server-side scope governance (098) → workflow↔skill (099) → ephemeral template upload (100, *upload before fill*) → template-fill capability (101) → reusable validation-gate library + output-quality judge gate (102, *gates+lint exist before NL-authoring can publish*) → authoring API + Workflows page + NL authoring (103) → PM flagship content pack (104, authored ON the finished primitives, last).
4. **STRETCH phases (105-109) ship LAST and only if CORE lands clean + budget remains.** SCHED-01 carries a HARD prerequisite (a spend meter — *no schedule without a budget*).

### Red line & guardrails (apply to every v2.9 phase)

- **The red line:** workflows **COMPOSE** the shipped harness / agent-loop / provider-gateway — they never re-implement them. Deep Mode stays **byte-identical**. No new runtime.
- **Greenfield, off the hot files (G-1/G-5):** authoring is a new Workflows page + new API router + **additive OPTIONAL fields** on `WorkflowDefinition` (`backend/app/models/harness.py`). It must NOT pile onto the G-5-firing hot files (`backend/app/api/threads.py`, `backend/app/services/anthropic_service.py`). Engine additions are additive seams on `backend/app/services/harness/phase_types.py` + `models/harness.py`. Immutability = "no-edit-published," NOT "no-grow-format."
- **G-6 (failure criteria upfront):** every SPEC carries a `## How we'd know this failed` section. Template-fill failure modes (docx run-split silent miss, unescaped XML corruption, pptx variable-row table can't grow, xlsx chart/image strip, merged-cell mis-write, produced-file-won't-open) are pre-named UAT rows at spec time.
- **SC#10 (cross-provider mandate):** any phase touching streaming, the agent loop, provider routing, or UI state MUST author VALIDATION rows for cross-provider × multi-tool × parallel-thread × long-message scenarios. The workflow-run-bearing phases (098/099/101/102/103/104) qualify — flagged per phase below.
- **Spec-phase re-confirmations** (against live harness code): (a) are gate verdicts-with-evidence already persisted to the run log? (b) does in-workflow retrieval already take a *bound* folder-scope parameter vs a prompt hint? (c) does the shared gateway uniformly capture token usage across all 7 providers (the spend-meter prerequisite for SCHED-01)?

### Phases

**CORE (committed — 097–104):**

- [ ] **Phase 097: Spike — Risk-Register Template-Fill + Authoring Feel** - De-risk the milestone end-to-end on one provider; answer the 4 schema-shaping unknowns before any schema locks (SEED-051)
- [x] **Phase 098: Project Binding + Server-Side KB Scope Governance** ✓ COMPLETE (2026-06-10) - Bind a workflow to a project (folder + subtree); resolve retrieval scope server-side so the model cannot widen it
- [x] **Phase 099: Workflow ↔ Skill Composition** ✓ COMPLETE (2026-06-10) - A phase can pull a project skill's judgment via `skill_ref` with a version snapshot; Deep path byte-identical
- [x] **Phase 100: Ephemeral Template Upload** ✓ COMPLETE (2026-06-10) - Upload a docx/pptx/xlsx for one run, workspace-only, TTL + sweep, never ingested, never in search
- [x] **Phase 101: Template-Fill + Integrity Validation** ✓ COMPLETE via Phase 101.1 (2026-06-12) — SUPERSEDED: the 101 build executed + gap-closed but LIVE UAT found it non-functional (0 .docx, GAP-A..D); the capability was delivered by the 101.1 emission-layer gap-closure. Fill that exact template from project-KB content via a cited field-map; re-open to assert integrity; SSTI contained
- [x] **Phase 101.1: Guaranteed Structured Emission Layer (Template-Fill Gap-Closure)** ✓ COMPLETE (2026-06-12) — verify-work 19/19 LIVE + secure-phase 36/36 threats closed (threats_open: 0). Shared forced-emission primitive (`llm_emit` + emitter registry + capability-tiered gateway forcing + native-path recovery + audit receipt) so ANY deliverable phase works cross-provider with the no-model-code/cited/reproducible guarantee; template-fill is its first instance, closing the GAP-A..D live 0-docx failure
- [x] **Phase 102: Reusable Validation-Gate Library + Output-Quality Gate** ✓ COMPLETE (2026-06-13) - A library of validator kinds for any phase + a HARD publish-blocking output-quality judge gate (verify-work 7/7 LIVE + secure-phase 34/34 threats closed, threats_open: 0)
- [x] **Phase 103: Workflows Page + Authoring API + NL Authoring** ✅ 2026-06-14 (live-UAT-hardened: full describe→draft→refine→publish→run journey verified in a live Chrome session; 9 real bugs found+fixed; open/tweak-loads-existing + Save + plain-language Builder added; secure-phase pending before milestone close) - Describe → draft → refine in a form → read-only graph → publish → run from a thread (no drag canvas)
- [ ] **Phase 104: PM Flagship Content Pack** - PM templates + workflow defs + register schemas authored on the generic primitives; headline single template-fill demo

**STRETCH (optional — 105–109; ship only if CORE lands clean and budget remains):**

- [ ] **Phase 105: Scheduled/Recurring Triggers + Budget Caps (STRETCH)** - Run on a schedule, but only behind a per-run token ceiling + per-workflow daily cap (no schedule without a budget)
- [ ] **Phase 106: Citation-Traceable Grid Renderer (STRETCH)** - Risk register / RTM / stakeholder matrix as a grid where every cell is agent-filled + source-cited
- [ ] **Phase 107: Per-Run Provenance Receipt View (STRETCH)** - Surface the already-recorded provenance chain as an auditable receipt (EU AI Act Art. 12 shape)
- [ ] **Phase 108: Plugin Contract Lock — phase_type + file_preview (STRETCH)** - Lock the first two contract types on real flagship telemetry; design (not lock) data_source/secrets_adapter
- [ ] **Phase 109: Operator/Admin Role Tier (STRETCH)** - Self-serve global workflow publish behind an operator role — only if global sharing becomes a v2.9 headline

## Phase Details

### Phase 097: Spike — Risk-Register Template-Fill + Authoring Feel
**Goal**: De-risk the entire milestone — fill a Risk Register from a real KB folder end-to-end on ONE provider, answering the 4 schema-shaping unknowns BEFORE any production schema is locked. This is a throwaway spike (SEED-051), not production code.
**Depends on**: Nothing (first v2.9 phase; builds only on shipped v2.8 harness + sandbox)
**Requirements**: None closed — spike precedes schema lock; informs PROJ, TMPL, WFAUTH
**Success Criteria** (what must be TRUE):
  1. A throwaway end-to-end run fills a risk-register template from a real KB folder and produces an openable artifact on one provider — evidence captured (clean / corrupt / where it broke).
  2. Each of the 4 unknowns has a written answer: (a) can a model derive input fields from a template? (b) does KB-grounded docx fill produce a clean artifact? (c) what does authoring-time grounding need? (d) does describe→refine→publish *feel* good?
  3. A written go/no-go on the `docxtpl` fill path plus a recommended `inputs` / `assets` / `folder_scope` schema shape — the spike's output BECOMES the locked schema; nothing is committed before this.
  4. Failure modes observed in the spike (run-split miss, XML corruption, won't-open) are logged as pre-named UAT rows for Phase 101.
**Plans**: 5 plans (4 waves) — planned 2026-06-08
- [x] 097-01-PLAN.md — Wave 0: scaffold scripts/spike-097/ + docxtpl venv install + {%tr %} risk-register.docx template + confirm a real risk-content KB folder (out/spike-config.json) — DONE 2026-06-08 (folder 75755ec9… "Project Meridian — Risks" confirmed; synthetic corpus ingested)
- [x] 097-02-PLAN.md — Wave 1: unknown (a) — cited Pydantic field-map + bound-scope retrieval + forced-tool emission + coverage/citation check (out/field-map.json, unknown-a.md) — DONE 2026-06-08 (verdict YES; 6 KB-grounded rows, 100% citation coverage, 11% decline-rate, 0 invented citations; Anthropic forced-tool held — no OpenAI-strict pivot)
- [x] 097-03-PLAN.md — Wave 2: unknown (b) — docxtpl end-to-end fill + SSTI-contained render + integrity re-open + 1/5/20-row growth + Pitfall 1–6 log (out/risk-register-filled.docx, corruption.log, unknown-b.md) — DONE 2026-06-09 (verdict YES/GO; {%tr %} grew 1/5/20 → 2/6/21, autoescape contained &<>, SandboxedEnvironment SSTI containment wired, all 6 pitfalls clean; **operator-confirmed clean real-editor open — NO repair banner, 6 grown risk rows, scalar tags filled**; Phase 101 carry-forwards = worded P/I → numeric Score mapping + coarse-table chunking + pptx/xlsx unexercised)
- [x] 097-04-PLAN.md — Wave 1: unknowns (c)+(d) — grounded one-shot WorkflowDefinition generation + refine loop + feel verdict (out/transcript.md, unknown-c.md, unknown-d.md) — DONE 2026-06-09 (unknown (c): folder tree + tool names + template placeholders = MUST-HAVE grounding, skill registry nice-to-have, PROJ-02 bound folder_scope gap surfaced; unknown (d): feel = MIXED — clarify-as-you-go grey-area validation loop + tweak-to-new-version are Phase 103 conditions for GOOD). Wave 1 fully complete (097-02 + 097-04).
- [x] 097-05-PLAN.md — Wave 3: conclusion — go/no-go + recommended inputs/assets/folder_scope schema shape + Phase 101 UAT seed (scripts/spike-097/CONCLUSION.md) — DONE 2026-06-09 (operator-confirmed **DECISION: GO** / `go-conditional` w/ 8 conditions: Cond 7 = FULL-native-roster cross-provider validation [all 7 natives + OpenRouter, NOT SC#10 big-4; GLM/MiniMax tool-use-drop + DeepSeek/Moonshot reasoning-truncation traps]; Cond 8 = living-document feedback loop → **SEED-069**; schema candidate extended with an OUTPUT-side dimension [output_target_folder/reingest_output/version_policy/provenance], additive-optional zero-migration = Phase 098 lock candidate; 6-pitfall Phase 101 UAT seed). All 5 plans complete — phase awaits verification.
**Note**: Spike-first per SEED-051 + build-notes. Stack addition surfaced here: only `docxtpl` is new — add to `backend/Dockerfile.sandbox`, bump `SANDBOX_IMAGE` tag.

### Phase 098: Project Binding + Server-Side KB Scope Governance
**Goal**: A workflow can be bound to a project (a folder + its subtree); its KB retrieval scope is resolved server-side from that binding at run start and the model cannot widen it.
**Depends on**: Phase 097 (schema shape confirmed)
**Requirements**: PROJ-01, PROJ-02, GOV-01
**Success Criteria** (what must be TRUE):
  1. A workflow can be bound to a project folder (optional `project_folder_id`) and the Workflows library can be filtered to that project; old unbound workflows still validate and run unchanged (zero-migration, additive).
  2. A bound workflow's retrieval defaults to its project-folder subtree, and an optional per-phase `folder_scope` narrows retrieval for that phase — scope comes from the binding, not a prompt hint.
  3. Retrieval scope (`scope_folder_ids`) is resolved server-side from the user's RLS context at run start and bound to every retrieval call as a parameter the model cannot override; retrieved `folder_id`s are asserted ⊆ scope (RLS as backstop).
  4. A model attempt to retrieve outside its bound scope is rejected/clipped to scope and observable in the run log.
**Plans**: 5 plans (3 waves)
- [x] 098-01-PLAN.md - Schema lock: project_folder_id + per-phase folder_scope + output-side shapes (Wave 1)
- [x] 098-02-PLAN.md - Workflows-library project filter (JSONB-path, zero-migration) (Wave 1)
- [x] 098-03-PLAN.md - Shared scope resolver + DB narrow-only subset validator + governance test suite (Wave 2)
- [x] 098-04-PLAN.md - Run-start scope resolution at all 3 ctx-build sites: kickoff/resume/Continue (Wave 3)
- [x] 098-05-PLAN.md - Subset clip + scope_violation emit + folder_id enrich + D-13 preserve (Wave 3)
**VALIDATION (SC#10)**: changes in-run retrieval scope across providers — author cross-provider × multi-tool × parallel-thread × long-message rows. Spec re-confirm (b): does in-workflow retrieval already take a *bound* folder-scope parameter vs a prompt hint?

### Phase 099: Workflow ↔ Skill Composition
**Goal**: An authored workflow phase can pull in a project skill's judgment without breaking the locked, immutable definition or the Deep path.
**Depends on**: Phase 098 (project/skill scope established)
**Requirements**: WFSKILL-01
**Success Criteria** (what must be TRUE):
  1. An `llm_agent` / `llm_single` phase can reference a skill (optional `skill_ref`); the skill's instructions + referenced files compose into the phase framing and `read_skill_file` is auto-whitelisted for that phase.
  2. The referenced skill's version is snapshotted into the locked definition, so editing or deleting the skill later cannot change or break an already-published workflow.
  3. Deep-mode chat behavior is byte-identical — the `skill_ref` path is a literal no-op outside workflow phases.
**Plans**: 8 plans (4 build + 4 gap-closure) across 4 waves
  - [x] 099-01-PLAN.md — schema contract (skill_ref + SkillSnapshot on 3 LLM configs) + ToolContext.skill_snapshot field + Wave 0 test stubs
  - [x] 099-02-PLAN.md — skill-block framing compose at the system_prompt seam + read_skill_file auto-whitelist + snapshot ctx attach (phase_types.py)
  - [x] 099-03-PLAN.md — harness/skill_snapshot.py (D-10 publish gate + materialize) + gated snapshot-routed read in _handle_read_skill_file (the red line)
  - [x] 099-04-PLAN.md — kickoff host: validate_skill_refs (ValueError→400) + first-run lazy materialize wired into threads.py (G-5 one-liner)
  - [x] 099-05-PLAN.md — GAP CR-01: source the snapshot file manifest from the skill_files table (not a nonexistent skills.files column) + de-mock test fakes to the real two-table shape
  - [x] 099-06-PLAN.md — GAP CR-02: propagate parent_ctx.skill_snapshot onto sub_ctx in run_task_sub_agent (snapshot gate reachable on live path) + live-chain regression test
  - [ ] 099-07-PLAN.md — GAP (UAT Test 1 blocker): migration 067 sibling skill_snapshots column + amended 056 trigger (authored-cols-only immutability); persist-back to the sibling column with CAS guard + graft helper; read-point grafts (kickoff + _load_run_definition); structured kickoff 500; de-mock the published-trigger collision class
  - [ ] 099-08-PLAN.md — GAP (UAT Test 10): surface kickoff refusals in the UI — postMessage passes through the server {detail}; StreamsProvider non-409 ApiError branch rolls back both temps + sets the per-thread banner + stashes the prompt; ChatArea shows the server message (no Retry for gate statuses) + feeds the prompt back via the prefill seam (frontend-only; 409 + Deep success byte-equivalent)
**VALIDATION (SC#10)**: changes phase framing inside runs across providers — author the 4-axis cross-provider rows. Additive seam on `phase_types.py` (`_exec_llm_agent`); Deep path untouched (the red line).

### Phase 100: Ephemeral Template Upload
**Goal**: A user can hand the workflow a template file for one run without it ever entering the knowledge base.
**Depends on**: Phase 097 (lifecycle shape confirmed)
**Requirements**: TMPL-01
**Success Criteria** (what must be TRUE):
  1. A user can upload a docx/pptx/xlsx into a thread temporarily (workspace-only via `POST /threads/{tid}/workspace/files`, `kind='template_input'`, RLS-scoped to the owner).
  2. The uploaded template is never ingested, never embedded, and never appears in KB search results — closing the injection-via-uploaded-doc vector.
  3. The uploaded template expires via TTL (`expires_at`) + a cron sweep and is no longer retrievable after expiry.
**Plans**: 6 plans (4 waves)
Plans:
- [x] 100-01-PLAN.md (Wave 0) — TDD test scaffold: OOXML fixtures + 12 backend stubs + FilesSection render stubs — DONE 2026-06-10
- [x] 100-02-PLAN.md (Wave 1) — Migration 068 (kind + expires_at + partial index + app_settings.template_ttl_hours) + [BLOCKING] live apply + full-schema regen + harness.py co-lock repoint — DONE 2026-06-10 (applied live via psycopg2, no reset)
- [x] 100-03-PLAN.md (Wave 2) — asyncpg data layer: gate the 2 tool read seams (D-06/D-11), is_expired flag (D-10), write_file kind/expires_at, OOXML binary-MIME hygiene — DONE 2026-06-10
- [x] 100-04-PLAN.md (Wave 3) — POST upload route + OOXML magic-byte validation (D-12) + 4 gated REST GET routes (signed-URL bypass closed) + template_ttl_hours settings field (D-05) — DONE 2026-06-10
- [x] 100-05-PLAN.md (Wave 3) — template_service (idempotent sweep D-07 + GREATEST-only run-pin D-09) + main.py lifespan sweep + thin threads.py kickoff pin (G-5) + D-10 tool error — DONE 2026-06-10
- [x] 100-06-PLAN.md (Wave 4) — panel upload affordance (D-01) + Template badge/countdown/amber/per-ext card (D-02) + reconcile; agent files byte-identical (D-11) — DONE 2026-06-10
**UI hint**: yes
**Note**: The one genuinely net-new plumbing piece (reuses the v2.7 per-thread workspace table additively; low blast radius).

### Phase 101: Template-Fill + Integrity Validation
**Goal**: A workflow fills that exact uploaded/library template from project-KB content into a real, openable deliverable — every value cited, and a corrupt file can never reach the user as "done."
**Depends on**: Phase 100 (upload exists), Phase 098 (scoped retrieval)
**Requirements**: TMPL-02, TMPL-03
**Success Criteria** (what must be TRUE):
  1. A workflow fills a template from project-KB content via a cited Pydantic field-map (each field nullable, carrying source chunk/page), rendered deterministically by pinned sandbox code — BOTH the trusted library path (`docxtpl`/Jinja) and the arbitrary-upload path (non-Jinja run-replace) work.
  2. A filled template is re-opened with the same library to assert integrity before delivery — a corrupt or unopenable file is caught and never delivered.
  3. Rendering runs inside the sealed, network-less sandbox with `jinja2.sandbox.SandboxedEnvironment` — an untrusted template cannot execute server-side (SSTI contained).
  4. The named failure modes (run-split miss, XML corruption, pptx variable-row table, xlsx chart strip, merged-cell mis-write, won't-open) are each exercised as a UAT row and pass or are documented.
**Plans**: 5 plans (4 waves) — planned 2026-06-10
- [x] 101-01-PLAN.md (Wave 0) — TDD scaffold: 2 cross-plan test files (9 named xfail tests) + 4 OOXML fixtures + make_fixtures.py + docxtpl==0.20.2 Dockerfile.sandbox add + seeded library-asset fixture (D-09) → uat_fixture_ids.json — DONE 2026-06-10 (4 commits 1d078221/315cbe57/3c70fc10/dbb50152; suite exit-0, 11 xfailed; seed idempotent, no 23514 trip)
- [x] 101-02-PLAN.md (Wave 1) — deterministic core (template_render_service.py): generic cited field-map + coverage/citation gate + truncation guard + docxtpl render + run-merge + universal integrity re-open + engine-by-provenance — DONE 2026-06-11 (commit f0549733; 686-line pure core, 9 Wave-0 stubs flipped GREEN/11 passed; run_replace AST-verified Jinja-free; heavy-lib imports function-local; net-new failures = 0 vs SEED-056 rot baseline)
- [x] 101-03-PLAN.md (Wave 1) — template byte resolution by provenance (template_asset_service.resolve_template_source: AssetRef→Storage / template_input→workspace) + harness.py assets[] co-lock comment (D-09) — DONE 2026-06-11 (commits 60e0da5d/18d70589; library branch reuses _read_from_storage run_in_threadpool, ephemeral branch newest-wins user-scoped on created_by + expiry-gated, clean relay-able errors never raw-404/cross-user; no template_render_service import, no threads.py growth G-5; net-new failures = 0 vs SEED-056 rot baseline)
- [x] 101-04-PLAN.md (Wave 2) — render_template agent tool (tool_dispatcher.py + one registry line, G-5): resolve + citation-gate-before-render + sealed-sandbox render driver + integrity-gate-after-render + persist/SSE + D-08 two-failure-class fallback — DONE 2026-06-10 (commit 8e12744e; _handle_render_template + _RENDER_DRIVER_SRC + one registry line; threads.py byte-untouched + dispatch_tool whitelist guard byte-unchanged G-5; no docxtpl in backend/app/** Pitfall 4; 3 offline gate/driver tests GREEN [14/14 template-render+integrity]; registry count test 24→25 Rule-1; net-new failures = 0 vs SEED-056 rot baseline)
- [x] 101-05-PLAN.md (Wave 3) — admit render_template to a fill phase via the 099 whitelist pattern (phase_types.py); field-map emission rides the unmodified gateway (D-14, no per-provider branch); Deep byte-identical — DONE 2026-06-10 (commit abb1c18c; the 099 never-drop `_effective_tools` already admits a DECLARED render_template on both layers with zero new code — documenting comment only + 3 offline tests [fill-phase admits / non-fill excludes / Deep phase_whitelist=None no-op]; NO auto-injection, NO Deep widening; RED LINE held — no provider/gateway file touched; net-new failures = 0 vs SEED-056 rot baseline).
- [x] 101-06 (GAP CLOSURE) — fix the 5 confirmed code-review findings (101-REVIEW.md: 1 critical + 4 warnings) that made render_template non-functional end-to-end + carried a command-injection — DONE 2026-06-11 (6 commits 6c5424d2/1cd8fb21/037280e5/19aefacb/cc0a59ff/bade0db2): **WR-01** added RENDER_TEMPLATE_TOOL schema + `_phase_tools_override` harness injection (Deep get_tools() byte-unchanged); **CR-01** out_filename strict-basename allow-list + shlex-quoted argv; **WR-02** leading-slash workspace persist path; **WR-03** integrity gate consults residual_clean (blocks silent half-fills); **WR-04** driver `_replace_in_paragraph` mirrors the audited production touched-logic (IR-01 unify); seed fixture declares available_tools + re-run live; 6 happy-path/visibility tests added. RED LINES held (Deep byte-identical, gateway not branched, Pitfall 4, threads.py untouched); net-new failures = 0 vs SEED-056 rot baseline. **All 5 plans + gap-closure complete — phase awaits /gsd:verify-work 101 + cross-provider live UAT.**
**UI hint**: yes
**VALIDATION (SC#10)**: workflow-run-bearing + produces files across providers — author the full 4-axis cross-provider scoreboard. **G-6**: the SC#4 failure modes are the pre-named "How we'd know this failed" UAT rows.

### Phase 101.1: Guaranteed Structured Emission Layer (Template-Fill Gap-Closure)
**Goal**: Introduce ONE shared "guaranteed structured emission" engine layer — a generic `llm_emit` phase type that FORCES the model to emit cited DATA against a strict schema, which a pinned deterministic no-model-code driver renders into the deliverable — so any workflow that must produce a typed artifact works reliably across the native-7 with the safety/audit guarantees intact. Template-fill is its first instance, closing the GAP-A..D live 0-docx failure end-to-end.
**Depends on**: Phase 101 (deterministic driver + citation gate + integrity re-open already shipped — 101.1 changes only HOW the model is asked to produce the field-map), Phase 100 (upload), Phase 098 (scoped retrieval). Unblocks Phase 101's live goal (TMPL-02/TMPL-03).
**Requirements**: TMPL-02, TMPL-03 (closes them live — Phase 101 left them OPEN); foundational for GATE-01/QUAL-01 (102), WFAUTH-02 (103), GRID-01 (106), GOV-02 (107).
**Success Criteria** (what must be TRUE):
  1. A new generic `llm_emit` phase type (6th in `PHASE_TYPE_REGISTRY`, additive-optional, Deep byte-identical) forces a single isolated structured emission; `render_template` is demoted to the first entry of a closed `EMITTER_REGISTRY`.
  2. Capability-tiered forcing at the gateway service boundary: TIER-FORCE (OpenAI/Gemini/DeepSeek/GLM/MiniMax/OpenRouter native `required`/named), TIER-FORCE-NOTHINK (Anthropic, thinking off for the emit call), TIER-COERCE (Kimi/Moonshot directive + `finish_reason` hard-validate + retry) — shared SSE/chunk path untouched + a guard test prevents provider-branch leakage.
  3. NATIVE-path narrated-JSON recovery + `finish_reason` guard closes the silent-drop on reasoning-natives; no emission is ever silently dropped.
  4. The bound library template AssetRef is resolved server-side and injected into emit args at phase-build time (GAP-B); the FILL phase produces a real openable .docx on every forceable provider attempt-1, and an honest receipt-bearing failure (never silent 0-docx, never Markdown stand-in) where a tier can't land (GAP-A/GAP-D).
  5. Emit-moment run honesty: discrete `forcing → emitting → rendering → validating` sub-events with distinguishable failure states (GAP-C). Every transition writes an INSERT-only `harness_audit` row keyed to `run_id` + `definition@version` (the Phase 107 receipt substrate).
**Plans**: 10 plans (5 build + 5 gap-closure). G-5 routing decided: tightly-scoped additive gateway seam, not an anthropic_service.py extraction — D-14 guard test shipped in Plan 02. Gap-closure 07-10 from the live UAT (6 diagnosed gaps).
- [x] 101.1-01-PLAN.md — Foundation: flat EmitFieldMap + closed EMITTER_REGISTRY + LlmEmitPhaseConfig (6th union member) + default-SAFE MODEL_CAPABILITIES flags + migration 069 (ALTER harness_audit) + Wave 0 test stubs ✅ 2026-06-11 (e4f93251/23375e20/d2905b2f)
- [x] 101.1-02-PLAN.md — Cross-provider core: capability-tiered forcing at the gateway boundary (D-05) + forced_emit substrate with D-06 NATIVE narrated-JSON recovery + the D-14 shared-path guard test ✅ 2026-06-11 (ab306330/6672626e/47cbe58b/183ae315)
- [x] 101.1-03-PLAN.md — The _exec_llm_emit executor: sealed forced shot (never the open loop) + GAP-B server-side AssetRef inject + the D-08 6-layer no-fail ladder + per-transition audit receipt; render_template demoted to the EMITTER_REGISTRY post_processor ✅ 2026-06-11 (c203c277/0073f238/9f2e29b9/827dc068/eb8958aa)
- [x] 101.1-04-PLAN.md — GAP-C run honesty: phase_substep sub-events + 5 failure states on the existing PhaseCard rail (no new UI) + the flat-map ↔ citation-gate/docxtpl-driver re-touch with parity tests ✅ 2026-06-11 (267870e7/624e4b18/409f6bc2/65eeb935/b34020a5/f31fedf7)
- [x] 101.1-05-PLAN.md — Finalize for live UAT: 069 applied + full-schema regen (`77b37b34`); idempotent D-13 seeder (`09f27f74`); live re-seed landed (`dd164d90`, 4 GAP-A runs cleared, receipts preserved, 4-lens adversarial verify clean); smoke bar MET via 101.1-06 ✅ 2026-06-11
- [x] 101.1-06-PLAN.md (gap closure) — **The live success path: openable cited .docx PRODUCED on gpt-5.4-mini (run `4d035a65`, 37,636 B, 36/36 cited 100%, table grown 5 rows, zero residual).** Five live-only layers peeled: citation-id namespace spotlight (`47a1f4bd`) + bounded retry w/ named-leaf feedback (`df493f7d`) + placeholder oracle (`24724838`) + column oracle (`44232912`) + os.path.join harvest (`dba4e906`) ✅ 2026-06-11
- [ ] 101.1-07-PLAN.md (gap closure) — Backend reliability: DeepSeek FORCE-NOTHINK (gap 1a — disable thinking on a forced emit) + the D-08 layer-6 catch-all backstop in forced_emit + _exec_llm_emit (gap 1b — any raise → honest receipt + one surfaced message + flipped phase, threads.py NOT touched) + single-owner failure persist (gap 2)
- [ ] 101.1-08-PLAN.md (gap closure) — Persist + path + snapshot durability: skip the binary version-diff (gap 5a — docx NUL → JSONB crash) + distinct ephemeral output filename (gap 5b — never overwrite the uploaded template) + snapshot 'no such key' degrade not 503 (gap 4 backend, G-5 behavior-only)
- [ ] 101.1-09-PLAN.md (gap closure) — Frontend delivery: downloadWorkspaceFile + raw-bytes route + wire the panel Download (gap 3) + the panel-only phase_substep demux → Phase.emitSubStep/emitFailure (gap 6, additive, Deep byte-identical) + terminal refetch (gap 4 frontend). Checkpoint ratifies the gap-6 scope (ship vs re-scope to run-legibility)
- [ ] 101.1-10-PLAN.md (gap closure) — One-off repair of the 3 dirty workflow_phases rows (575e7345/a7f415ad/4ea9bc56 active→failed) + LIVE re-verification (DeepSeek v4-pro openable-or-honest, ephemeral fill persists+downloads, emit sub-steps on the rail, blocked Tests 6-8 re-run, cross-provider render column) via the smoke harness — checkpoint:human-verify
**UI hint**: yes (GAP-C emit-moment honesty)
**VALIDATION (SC#10)**: workflow-run-bearing + produces files + touches provider routing across all 7 natives + OpenRouter — author the full 4-axis cross-provider scoreboard; re-run the 8 rows of `101-HUMAN-UAT.md`. **G-5 FIRES** on `anthropic_service.py` (forcing seam) — plan-phase decides adapter audit vs scoped additive seam. **G-6**: failure modes = silent 0-docx / narrated-not-emitted / uncited-not-rejected / won't-open are the pre-named "how we'd know this failed" rows. Full discussed context: `.planning/phases/101.1-guaranteed-emission-layer/101.1-CONTEXT.md`.

### Phase 102: Reusable Validation-Gate Library + Output-Quality Gate
**Goal**: Any phase can attach a reusable validator, and a workflow cannot publish unless it provably produces good output for its one declared business requirement.
**Depends on**: Phase 101 (`output_file_valid` / `citations_required` exercised concretely first)
**Requirements**: GATE-01, QUAL-01
**Success Criteria** (what must be TRUE):
  1. A reusable library of validator kinds — `citations_required`, `freshness` ("check the date first"), `structure_check`, `output_file_valid`, `llm_judge_rubric` — is available to any phase and rides the existing gate + bounded-retry loop.
  2. The `freshness` validator guarantees a "check the date first" preflight that branches to `ask_user` on stale/multiple versions; `citations_required` deterministically rejects uncited register rows before any judge call.
  3. A workflow declares exactly one `business_requirement`; an `llm_judge` output-quality gate plus a publish-time golden run are a HARD publish blocker — a structurally lint-clean workflow that produces bad output cannot publish.
**Plans**: 9 plans (7 waves) — 5 planned 2026-06-12; gaps-only 06-09 added 2026-06-13 (gaps_found 1/3 → CR-01/WR-01/CR-02 + folded warnings)
- [x] 102-01-PLAN.md (Wave 1) — Foundation: additive-optional model fields (ValidatorSpec 5 kinds + timing, LlmEmitPhaseConfig citation_policy/integrity_policy, WorkflowDefinition business_requirement) + harness_judge_model setting + migration 070 (CHECK ALTER + workflow_runs.is_golden_run) + _AUDIT_EVENT_TYPES lockstep (16->22) + 8 Wave-0 test stubs — COMPLETE 2026-06-12 (d8354dd6/ee8ae7af/c293fd49)
- [x] 102-02-PLAN.md (Wave 2) — [BLOCKING] apply migration 070 to :54322 (psycopg2-direct, no reset) + regenerate full-schema (autonomous:false — may need the operator to start the stack) — COMPLETE 2026-06-12 (990a3bcc; checkpoint:human-verify APPROVED on independent psycopg2 read-back: CHECK accepts all 22 kinds incl. the 6 new 102 receipts + workflow_runs.is_golden_run live; full-schema regenerated)
- [x] 102-03-PLAN.md (Wave 3) — the 5 first-class validator kinds (D-12): citations_required/output_file_valid/structure_check/llm_judge_rubric wrap shipped primitives + net-new freshness deterministic KB queries + run_gates timing filter (D-10 back-compat half)
- [x] 102-04-PLAN.md (Wave 3) — engine seams: timing:pre pre-gate pass + ask_user 4th on_failure disposition (D-10/D-11, the 085 pause) + citation_policy post-verdict disposition in _exec_llm_emit (D-01, strict byte-identical)
- [x] 102-05-PLAN.md (Wave 4) — the QUAL-01 publish path: POST /workflows/{id}/publish (api/workflows.py, G-5) -> publish_service.publish (business_requirement -> lint -> real golden run -> judge -> flip) + db get_definition/is_golden_run/publish-flip; the HARD publish blocker
- [ ] 102-06-PLAN.md (Wave 5, gaps-only) — CR-01 judge wiring KEYSTONE (GATE-01+QUAL-01): forced_emit additive schema_model seam (default=EmitFieldMap byte-identical) + both judge callers pass schema_model=JudgeVerdict + WR-05 shared resolve_judge_model helper + IN-01/IN-04; un-mocked forced_emit JudgeVerdict integration test
- [ ] 102-07-PLAN.md (Wave 6, gaps-only, depends 06) — GATE-01 validator live-paths: WR-01 freshness folder_subtree_ids fallback + WR-07 output_file_valid workspace-scope the config[path] oracle + WR-08 honest version-ambiguity ask_user choices; live-shape freshness test + path-oracle refusal test + choice-set test
- [ ] 102-08-PLAN.md (Wave 6, gaps-only) — CR-02 citation_policy non-strict delivery (GATE-01): policy-aware render gate across phase_types/emitters/tool_dispatcher + WR-06 emit_policy invented+full-leaf match/strict-fallback + IN-03 single honest surface; un-mocked render round-trip test
- [ ] 102-09-PLAN.md (Wave 7, gaps-only, depends 06) — publish-path security/robustness (QUAL-01): WR-02 owner-only publish read + WR-03 concurrent-publish sentinel block + WR-04 deadline + interactive-phase pre-block + IN-02; non-owner-refused/sentinel/timeout/interactive tests (full background-job rework deferred to Phase 103)
**VALIDATION (SC#10)**: gates call providers during runs (`llm_judge`) — author the 4-axis cross-provider rows. Spec re-confirm (a): are gate verdicts-with-evidence already persisted to the run log? **NL-authoring (103) MUST NOT ship without QUAL-01.**

### Phase 103: Workflows Page + Authoring API + NL Authoring
**Goal**: A domain expert can describe a workflow in plain language, refine it in a form, see it as a graph, publish it, and run it from a thread — with no drag-to-build canvas.
**Depends on**: Phase 102 (lint + quality gate exist before publish), Phase 098 (project filter), Phase 099 (skill_ref in editor), Phase 100/101 (template asset in grounding)
**Requirements**: WFAUTH-01, WFAUTH-02, WFAUTH-03, WFAUTH-04
**Success Criteria** (what must be TRUE):
  1. A user can create/edit a workflow as a draft (CRUD) on a new Workflows page, with publish-time structural lint (reachable, terminal, satisfiable inputs) blocking invalid publishes.
  2. A user can describe a workflow in natural language and receive a valid draft definition — one-shot structured generation over the strict `WorkflowDefinition` schema, grounded in the project folder tree + tool/skill registry + any uploaded template, with invalid generations auto-retrying against the validation error.
  3. The Workflows page renders a read-only live graph of a workflow's phases/edges (view, not drag-to-build).
  4. A published workflow can be browsed in a project-filtered library and run from a thread (the thread enters workflow mode; Deep is the resting default); definitions are immutable-on-publish + versioned.
**Plans**: 6 plans in 3 waves
Plans:
- [x] 103-01-PLAN.md — Backend foundation: additive PhaseSpec.name + harness_authoring_model knob + draft-CRUD DB fns/routes (23514->409) + Wave-0 tests (REQ-1, REQ-3) [Wave 1] ✅ 2026-06-14 (WFAUTH-01)
- [x] 103-02-PLAN.md — NL-gen backend: additive strict override on forced_emit + workflow_authoring service + POST /workflows/generate (REQ-2) [Wave 2] ✅ 2026-06-14 (WFAUTH-02)
- [x] 103-03-PLAN.md — Frontend foundation: api.ts authoring fns/types + deriveTier()/TIERS + shared NAV_ITEMS + ActiveView + AppDock deletion (REQ-7 wiring) [Wave 2] ✅ 2026-06-14 (WFAUTH-04 wiring)
- [x] 103-04-PLAN.md — Builder + read-only PhaseSpineGraph + 400px form panel (REQ-4, REQ-5) [Wave 3] ✅ 2026-06-14 (WFAUTH-01/02/03 — describe-first Builder, read-only vertical spine, 6 phase_type forms; 29 vitest GREEN, net-new failures 0, no router/graph-lib/drag-canvas)
- [x] 103-05-PLAN.md — Publish-gauntlet UI client: verbatim PublishVerdict + key-detection + judge hard wall (REQ-6) [Wave 3] ✅ 2026-06-14 (WFAUTH-01 — golden_input form + 8 server-fixed stages + 5 fields verbatim + 4 HTTP outcomes + named_failures key-detection + judge hard-wall no-override; 12 vitest GREEN, net-new failures 0, mounts into Plan-04 renderPublish? seam)
- [x] 103-06-PLAN.md — Workflows page: filter rail + drafts shelf + Run launch + Tweak v(N+1) fork + ChatLayout render branch (REQ-7) [Wave 3] ✅ 2026-06-14 (WFAUTH-04 — project ?project_folder_id= filter rail + drafts-above-published shelves + dashed Build-card + client-derived deriveTier badge + Run modal reusing the existing kickoff (no bespoke route, threads.py byte-identical) + Tweak v(N+1) INSERT + auto-return-with-Run-CTA + shared NAV_ITEMS drawer; 11 vitest GREEN, net-new failures 0, no router)
**UI hint**: yes
**G-2 (sketch-before-plan FIRES)**: run `/gsd:sketch` BEFORE `/gsd:spec-phase` — confirm/extend `sketch-findings-agentic-rag` sketches 012 (workflows-page) + 013 (workflow-builder) for the NL-form-editor + live-graph surfaces.
**VALIDATION (SC#10)**: NL-gen calls a provider, runs stream, UI state changes — author the 4-axis cross-provider rows. **Greenfield**: new page + new API router; does NOT touch `threads.py` / `anthropic_service.py`.

### Phase 104: PM Flagship Content Pack
**Goal**: Ship project-management workflows as authored content on the generic primitives, proving the studio is domain-author-driven, not PM-hardcoded.
**Depends on**: Phase 103 (authoring), Phase 101 (template-fill), Phase 102 (gates)
**Requirements**: PM-01
**Success Criteria** (what must be TRUE):
  1. A PM flagship content pack ships — example templates (project charter / weekly status report / risk register) + workflow definitions + register schemas — authored entirely on the generic primitives (no PM-specific engine code).
  2. The headline demo runs end-to-end: a single template-fill produces a weekly status report from the project KB, cited and integrity-checked.
  3. A domain author can re-author or extend a pack workflow through the Workflows page without code changes.
**Plans**: 3 plans
Plans:
- [ ] 104-01-PLAN.md — Content artifacts: 2 docxtpl templates (status scalars + risk 9-col with inline P×I score) + 5-doc synthetic corpus + template-shape test [Wave 1]
- [ ] 104-02-PLAN.md — Seed/provisioning script: corpus ingest + template upload + 2-phase published def JSONB (DELETE-then-INSERT, is_global=false) + seed-smoke/RLS/immutability test [Wave 2]
- [ ] 104-03-PLAN.md — Live proof orchestration: cross-provider kickoff harness + finalized SC#10 scoreboard (VALIDATION.md) + HUMAN-UAT runbook + the human-verify SC#2/SC#1/SC#3/SC#10 checkpoint [Wave 3]
**VALIDATION (SC#10)**: the flagship runs cross-provider — the 4-axis scoreboard is the acceptance bar for the demo.

### Phase 105: Scheduled/Recurring Triggers + Budget Caps (STRETCH)
**Goal**: A published workflow can run on a schedule — but only behind a spend ceiling.
**Depends on**: Phase 104; **HARD prerequisite — a gateway spend meter** (REJECT-semantics per-run token ceilings + per-workflow daily caps); confirm spec re-confirm (c) first.
**Requirements**: SCHED-01
**Success Criteria** (what must be TRUE):
  1. A workflow can be given a schedule (frequency / time / timezone) and fires automatically.
  2. Scheduling is disabled unless a budget is set — a REJECT-semantics per-run token ceiling and a per-workflow daily cap; a run that would exceed the cap is rejected, not silently overrun. (Disabled-by-default; no schedule without a budget.)
  3. An operator can see and cancel active schedules (consider a per-user active-schedule cap).
**Plans**: TBD
**Note**: STRETCH — ship only if CORE lands clean AND the spend meter exists. This is the one stretch item with a hard, named prerequisite.

### Phase 106: Citation-Traceable Grid Renderer (STRETCH)
**Goal**: PM matrices render as a grid where every cell is agent-filled and source-cited.
**Depends on**: Phase 104
**Requirements**: GRID-01
**Success Criteria** (what must be TRUE):
  1. A risk register / RTM / stakeholder matrix renders as a grid (rows = items, cols = attributes), backed by `llm_batch_agents` + retrieval.
  2. Every cell carries a citation to its source span; uncited cells are visibly flagged.
**Plans**: TBD
**UI hint**: yes
**VALIDATION (SC#10)**: `llm_batch_agents` fan-out runs across providers — author the 4-axis rows. STRETCH.

### Phase 107: Per-Run Provenance Receipt View (STRETCH)
**Goal**: Surface the already-recorded provenance chain for any run as an auditable receipt.
**Depends on**: Phase 104
**Requirements**: GOV-02
**Success Criteria** (what must be TRUE):
  1. A per-run provenance-receipt view surfaces the recorded chain — definition@version + INSERT-only run log + gate verdicts + cited sources (EU AI Act Art. 12 traceability shape).
  2. The receipt is read-only and reconstructs from already-persisted data (no new runtime writes, no migration).
**Plans**: TBD
**UI hint**: yes
**Note**: STRETCH — governance is mostly *surfacing*, not building (the chain is already recorded).

### Phase 108: Plugin Contract Lock — phase_type + file_preview (STRETCH)
**Goal**: Lock the first two Plugin Contract types on real flagship telemetry.
**Depends on**: Phase 104 (flagship telemetry generated)
**Requirements**: PLUG-01
**Success Criteria** (what must be TRUE):
  1. The `phase_type` contract is locked via a first-class `fill_template` phase plugin, and the `file_preview` contract via an office/PPTX in-panel preview reference plugin (closes the SEED-037 office-viewer gap).
  2. The `data_source` / `secrets_adapter` seams are designed (named) but explicitly NOT locked.
**Plans**: TBD
**UI hint**: yes
**Note**: STRETCH — the KB-grounded flagship needs zero plugins to ship; this locks the contract on real telemetry per D-v2.8-01.

### Phase 109: Operator/Admin Role Tier (STRETCH)
**Goal**: Enable self-serve global workflow publishing behind an operator role — only if global sharing becomes a v2.9 headline.
**Depends on**: Phase 103
**Requirements**: ROLE-01
**Success Criteria** (what must be TRUE):
  1. An operator/admin role tier enables self-serve global workflow publish (relaxes the `is_global=false` INSERT check).
  2. Without the role, drafts + per-user publish remain the default (RLS unchanged).
**Plans**: TBD
**Note**: STRETCH/conditional — otherwise drafts + per-user publish suffice. Pairs with deferred multi-tenancy questions.

## Progress

**Execution Order:** Phases execute in numeric order: 097 → 098 → 099 → 100 → 101 → 101.1 → 102 → 103 → 104 → (STRETCH) 105 → 106 → 107 → 108 → 109

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 097. Spike — Risk-Register Template-Fill + Authoring Feel | 5/5 | Complete    | 2026-06-08 |
| 098. Project Binding + Server-Side KB Scope Governance | 5/5 | Complete    | 2026-06-09 |
| 099. Workflow ↔ Skill Composition | 6/6 | Complete    | 2026-06-10 |
| 100. Ephemeral Template Upload | 6/6 | Complete    | 2026-06-10 |
| 101. Template-Fill + Integrity Validation | 5/5 | Blocked (live UAT) → 101.1 | - |
| 101.1. Guaranteed Structured Emission Layer | 6/10 (build 01-05 + gap 06 done; gap-closure 07-10 planned from the live UAT) | Executing (gap closure) | - |
| 102. Reusable Validation-Gate Library + Output-Quality Gate | 4/5 | Executing (2026-06-12) | - |
| 103. Workflows Page + Authoring API + NL Authoring | 6/6 | Complete    | 2026-06-14 |
| 104. PM Flagship Content Pack | 0/TBD | Not started | - |
| 105. Scheduled/Recurring Triggers + Budget Caps (STRETCH) | 0/TBD | Not started | - |
| 106. Citation-Traceable Grid Renderer (STRETCH) | 0/TBD | Not started | - |
| 107. Per-Run Provenance Receipt View (STRETCH) | 0/TBD | Not started | - |
| 108. Plugin Contract Lock — phase_type + file_preview (STRETCH) | 0/TBD | Not started | - |
| 109. Operator/Admin Role Tier (STRETCH) | 0/TBD | Not started | - |

---

## Shipped Milestones

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


---

*Milestones v1.0–v2.8 shipped and archived under `.planning/milestones/`. Active milestone: **v2.9 Workflow Studio** (Phases 097-109) — roadmap created 2026-06-08; next: `/gsd:plan-phase 097` (spike-first, SEED-051).*
