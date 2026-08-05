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
- ✅ **v2.9 Workflow Studio** — Phases 097-104 CORE (shipped 2026-06-15); STRETCH 105-109 deferred
- ✅ **v3.0 Document Management** — Phases 110-119 (shipped 2026-06-21). SEED-005 Tier A as a first-class product surface: DM Foundations → metadata enrichment + multi-provider embeddings → metadata-driven views / "virtual folders" → document relationships → auto-classification → governance health. 24/24 functional requirements delivered.
- ✅ **v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers** — Phases 120-129 (CORE 120-124+123.1; STRETCH 127-129 shipped; 125/126/130/131 deferred) (shipped 2026-06-28). Collision fix + context isolation · cross-provider trust/honesty parity · Skill Trigger Tuner · Workflow Studio soul + strict↔loose · chat tool-card unification + provider logos · MiniMax/OpenRouter arg repair.
- ✅ **v3.2 Skill Eval Studio + Self-Improving** — Phases 132-145 (CORE 132-137 + inserts 134.1/137.1/137.2; STRETCH 138-143+145 shipped; 144/FILE-01 deferred → v3.3) (shipped 2026-07-10). Skill Eval Studio (eval persistence + versions + with-vs-without runner + honest verdicts + ratings + self-improve loop + publish gate + Evals panel) · built-in skill-creator · STRETCH honesty phases · run-lifecycle foundation (FND-01) · Starter Workflow Library (WF-01).
- ✅ **v3.3 Operator UX** — Phases 146-159 (shipped 2026-07-18). Operator/admin tier (gated /admin Control Room + governance) + dynamic model-registry/discovery + secrets-at-rest + workflow/agent file-inputs + inline citations + plain-language + WCAG-AA + deployment presets/install wizard. 20/20 requirements delivered.
- ✅ **v3.4 Multi-Tenancy & Org Access** — Phases 160-168 CORE (shipped 2026-07-22); STRETCH 169-173 deferred → carry-forward guide `.planning/v3.4-STRETCH-CARRYFORWARD.md`. The load-bearing **one-way RLS door**: membership-based tenancy (Tenancy ADR → org/dept/role schema → personal-org backfill → the atomic RLS + user-JWT-client-swap crux → SECDEF audit + two-org isolation suite → `is_global` retirement → org-admin shell/switcher → invitations/roles/greenlists → SAML SSO). Migrations 104-113.
- ✅ **v3.5 UX Consolidation & Chat Polish** — Phases 174-177 CORE (shipped 2026-07-23); STRETCH 178-180 deferred → carry-forward guide `.planning/v3.5-STRETCH-CARRYFORWARD.md`. Cleared the load-bearing chat-surface bug backlog + consolidated the accumulated UI/UX (incl. the new v3.4 org surfaces) into one coherent, honest experience: run-state & lifecycle honesty (174) · cross-provider streaming fidelity (175) · chat render correctness + exec reliability (176) · v3.4 org-surface family-cohesion polish (177). 14/14 CORE requirements delivered; no migration. Full detail archived: `.planning/milestones/v3.5-ROADMAP.md`.
- 🚧 **v3.6 Visual / No-Code Workflow Studio** ([[SEED-123]]) — 🚧 ACTIVE (roadmap created 2026-07-24). CORE **Phases 181-189** + STRETCH **190-191** (178-180 reserved for the v3.5 STRETCH carry-forwards, NOT reused). A drag-and-drop node-canvas authoring + non-technical live-run-observability layer ON TOP of the existing governed harness engine (build-on-not-rewrite). Headline differentiator from the deep competitor crawl (Beam/Glean/n8n): **graded governance** — strict-when-KB-grounded / flexible-when-open per node (the category white-space no competitor covers, CORE Phase 185). 3 operator HARD gates: preserve-v1 / revert-at-any-time (feature-flagged, tested byte-identical) · study + beat Glean/Beam/n8n · comprehensive email/JIRA connector story (MCP-first; own-vs-Open-Platform decided by research). One net-new dep — `@xyflow/react` v12 (MIT). The enterprise-GTM track (Open Platform API/MCP + connectors SEED-013/014, config-consolidation SEED-117 §1/§3) sequences after. **Authoritative map: `PRDs/SEQUENCE.md`.**

---

## v3.6 Visual / No-Code Workflow Studio — 🚧 ACTIVE (started 2026-07-24)

**Started:** 2026-07-24 (operator-confirmed at v3.5-close — the recorded post-v3.4 sequencing: the polish cluster shipped as v3.5, this ships as v3.6, run **research-first**). **Roadmap created:** 2026-07-24 (after the research-first domain study — 4 dimensions + synthesis; `.planning/research/SUMMARY.md`, confidence HIGH). **Revised:** 2026-07-24 — a deep competitor crawl (Beam / Glean / n8n, `.planning/research/deep-dive/`) confirmed **NONE grade governance by KB-grounding**, so a first-class **GOVERN** category (per-node grounding-strictness + action-risk dials) was added as a dedicated CORE phase (185); the tail renumbered (CORE 181-189, STRETCH 190-191).

**Goal:** Add a drag-and-drop, business-friendly **visual authoring + live-run observability layer** on top of the existing governed harness workflow engine — so a non-technical business user (Legal / HR / Finance) can *draw their own process* and watch it run, without losing the engine's governance rails. Build ON what exists (the read-only vertical phase-spine graph becomes editable; the visual canvas becomes a third, most-approachable authoring door alongside "Describe & run" / "Author & govern"). **NOT an engine rewrite** — the heart is a UX + integration problem over a governed engine that already exists and is trusted.

**The headline differentiator (the deep-crawl white-space):** no competitor grades strictness by KB-grounding. Our category-level win is **graded governance** — a node is *strict when grounded* (must cite retrieved knowledge above a confidence threshold) and *flexible when open* (an exploratory agentic step), freely mixed in one workflow, with the strict gate structurally enforced and not author-loosenable-away. Governance is the shape of the artifact, not a bolted-on run-time check.

**Red line (every phase — D-14, load-bearing):** the canvas is a pure **projection** of `WorkflowDefinition`, never a second source of truth and never a second runtime; the harness engine stays the ONLY executor; every new route is flag/404-gated at every layer; Deep Mode stays byte-identical; provider differences stay at the gateway/adapter/sanitizer boundary. Operator HARD gate #1 (`test_revert_byte_identical`) makes flag-off provably byte-identical.

**Numbering:** CORE **Phases 181-189**, STRETCH **Phases 190-191**. **Phases 178-180 are RESERVED** for the deferred v3.5 STRETCH carry-forwards (Chat UI/UX Polish, Plain-Language Extensions, Agent-Loop Honesty — `.planning/v3.5-STRETCH-CARRYFORWARD.md`) and are NOT reused here (exactly as v3.5 skipped the reserved 169-173). **Stack:** one net-new dep — `@xyflow/react` v12 (^12.11.2, MIT, React-19-compatible, uses the app's existing zustand internally); `zundo` for undo/redo (Phase 184). The app is on React 19.2.4 (not 18). **Migrations:** live head = 113; **next free slot = 114 reserved ONLY IF** the nullable `workflow_layouts` side table (CANVAS-02 / OPEN-05) is confirmed needed at the Phase-184 sketch — otherwise deterministic auto-layout = ZERO migrations. Graded governance (185) is a ZERO-migration additive optional field in the definition JSONB. Phase 190 (connectors, STRETCH) likely adds an org-scoped connector-credentials table (sized at sketch; reuses `SECRETS_ENCRYPTION_KEY`, no new key).

**Scope source:** `.planning/REQUIREMENTS.md` (21 CORE + 3 STRETCH = 24 reqs — RUNVIZ-03 added to Phase 188 on 2026-07-31 from the post-185-UAT operator call; no phase renumbered). **Reported-bugs mandate:** the open `surface: Agentic-RAG` chat-surface backlog stays OUT (it is the v3.5 STRETCH 178-180 chat-polish track, SEED-045 — a SEPARATE track, not this build); cross-check `.planning/reported-bugs/` at each `/gsd:discuss-phase` and fold only a report whose `affected_areas` genuinely overlaps a canvas / validate / governance / run-viz / connector surface.

### Phase Table (CORE — Phases 181-189)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 181 | Revert Foundation | The entire visual canvas layer flips on/off via one governed feature flag, and with it off the product is provably byte-identical to today (HARD gate #1) | REVERT-01, REVERT-02 | 4 | **HARD gate #1** (preserve-v1/revert); **red line D-14**; reuse-heavy (v3.3 `skill_studio` feature-flag pattern); `test_revert_byte_identical` CI + live-close gate; additive-nullable-only; **no threat model**; no migration; UI hint |
| 182 | Server Validation Seam | The server exposes one source of validation truth (`POST /workflows/validate`) the canvas can call, reusing `lint_workflow` verbatim so the canvas can never drift from the publish gauntlet | VALID-01 | 4 | backend-only reuse (anti-drift seam, Pitfall 1); flag-gated 404 (inherits 181); **red line D-14**; **no SC#10**; no threat model; no migration; no `@xyflow` yet |
| 183 | Read-Only Canvas | A user can view an existing workflow as a faithful read-only node canvas — proving the projection model before any write complexity | CANVAS-01 | 4 | **G-2 sketch**; **stack: `@xyflow/react` v12 introduced here**; **G-5 ledger** (`WorkflowCanvas.tsx`/`canvasModel.ts`/`PhaseNode.tsx` mirror `PhaseSpineGraph.tsx` — proactive glyph/parse extraction, 1st touch); pure projection (layout computed, not persisted — Pitfall 3); **red line D-14**; no SC#10; no threat model; no migration; UI hint |
| 184 | Editable Canvas + Live Structural Validation (Round-Trip) | A user can visually author a workflow — add / move / connect / configure / delete nodes — with edits round-tripping losslessly to the definition and live server validation preventing a **structurally** invalid flow (the core deliverable; per-node grounding *strictness* is layered on by 185, not baked here) | CANVAS-02, CANVAS-03, CANVAS-04, VALID-02, VALID-03 | 5 | **CORE deliverable** (VALID-02 author-time STRUCTURAL validation — reachability/whitelist/gate-wiring); **G-2 sketch**; **stack: `zundo`**; one-serializer round-trip → EXISTING draft CRUD, layout OUT of JSONB (Pitfall 3); server-authoritative per-node badges (VALID-03); **G-5 ledger** (`WorkflowBuilderPage.tsx` = 3rd door; `PhaseNode.tsx` 2nd touch); CANVAS-04 rails are **graded per GOVERN (185)**; **migration SKETCH-CONDITIONAL** (slot 114 ONLY IF `workflow_layouts` confirmed, else ZERO); **red line D-14**; no SC#10; no threat model unless discuss surfaces one; UI hint |
| 185 | **Graded Governance: Per-Node Grounding Mode + Action-Risk Dial** | Each node carries a grounding mode (Grounded/strict auto-attaches the immutable `citations_required` + confidence gate; Open/flexible is ungated) and an orthogonal action-risk approval checkpoint — the milestone's headline differentiator, on a working canvas | GOVERN-01, GOVERN-02, GOVERN-03 | 5 | **HEADLINE differentiator** (no competitor grades by grounding — deep-crawl white-space); ENGINE-ADDITIVE (optional `grounding_mode` field AUTO-ATTACHES the EXISTING immutable `citations_required` + confidence gate on grounded nodes; open nodes ungated); GOVERN-03 reuses the existing `llm_human_input` phase-type for the approval checkpoint; **Deep byte-identical when unset — D-14 load-bearing**; **G-2 sketch** (grounded-strict vs open-flexible badges + mode toggle "feels like"); **SC#10** (grounded citation/confidence enforcement rides the provider-sensitive retrieval/agent path — verify graded strictness holds cross-provider); **G-5 ledger** (`PhaseNode.tsx` ~3rd touch → refactor-before-3rd-touch PROACTIVELY + the validation seam); **no full threat model** (reuses the enforced gate library; the structural "not author-loosenable-away" property verified in-phase); ~~**NO migration** (additive optional field in the WorkflowDefinition JSONB, not a column)~~ **AMENDED 2026-07-31 (operator decision, plan `185-13`) → EXACTLY ONE migration: `114_harness_audit_action_risk_pending.sql`**, adding one literal (`action_risk_pending`, 22 → 23) to the `harness_audit` event_type CHECK and nothing else. The superseded wording is preserved, not deleted. **Reason: the zero-migration promise was a scoping convenience; the honest-pause vocabulary is a correctness property, and the alternative knowingly ships the defect the phase existed to fix** (BUG-260731-02 — the armed action-risk checkpoint kills the run). The grounding field + action-risk dial themselves remain additive-optional JSONB, not columns; UI hint |
| 186 | Concurrency & Autosave | Continuous canvas autosave is safe on org-shared workflows — a cosmetic drag never mints a version or re-arms the gauntlet, and two editors cannot silently clobber each other | CONCUR-01, CONCUR-02 | 4 | autosave-in-place (CONCUR-01); soft-lock / optimistic-token co-edit guard (mirrors `publish_definition` WR-03); **parallel-editor UAT row (SC#10 parallel axis)**; mechanism (block vs warn vs merge) = sketch/discuss call; **red line D-14**; **no full SC#10**; no threat model (v3.4 org RLS enforces the share boundary); no migration; UI hint |
| 187 | Business Vocabulary + AI-Seeded Canvas | A business user sees plain-language node verbs and can describe a workflow in natural language to get a safe, editable seeded canvas draft — the AI seed respects grounding mode (a seeded grounded node auto-gets its citation/confidence gate — safe-by-construction) | VOCAB-01, VOCAB-02, VOCAB-03 | 5 | **G-2 sketch**; **SC#10** (VOCAB-02 AI-seed rides the provider-routed `POST /generate` NL generator); extends v3.3 LANG-01 + SEED-085 + Technical-names reveal; AI-seed structurally-safe (schema IS `extra="forbid"` union — Pitfall 7) + **respects grounding mode (185)**; reuses Starter Workflow Library; acceptance bar = PM pack + Starter Library + 4 canonical seed shapes; **G-5 ledger** (`PhaseNode.tsx` + NL-seed into `WorkflowBuilderPage.tsx`); **red line D-14**; ~~no threat model~~ **AMENDED 2026-07-31 (operator: "plan it ahead, any phase before 188") → [[SEED-137]] FOLDED IN as SC#6** — an armed action-risk checkpoint can today be preempted by an author-declared `timing="pre"` validator (`run_gates` returns the first failure; an ask_user Proceed skips the remaining pre-gates), so the gate is never asked and the step runs unapproved. Folded HERE because SC#3's "safe-by-construction" claim is exactly what this falsifies; **carries a threat-model item** (the fix touches the D-185-05 attachment seam); no migration; UI hint |
| 188 | Non-Technical Run Observability | A non-technical user can watch a workflow run on the canvas with honest, legible per-node state — including each node's grounded-cited vs open state — a business view distinct from the developer timeline, painted from the same run stream | RUNVIZ-01, RUNVIZ-02 | 5 | **G-2 sketch**; **SC#10** (live run state, all providers); one run stream / two views — `CanvasRunView` reads the SAME `usePhases(threadId)` slice `PhaseTimeline` uses (no new Redis events, no new demux); shows **grounded-cited vs open** per node (185); node state = total function over the FULL event set (Pitfall 4); reconcile-on-fetch (D-v2.5-03); **G-5 ledger** (`PhaseTimeline.tsx`/`PhaseCard.tsx`/`StreamsProvider.tsx` — hottest cluster; proactive shared phase-state extraction); `elkjs` deferred (→ 191); **red line D-14**; no threat model; no migration; UI hint |
| 189 | Governed External-Action Node Model | A user can place a governed external-action node on the canvas whose capabilities ride the existing per-phase tool-whitelist + the 185 action-risk checkpoint — and the milestone records the own-vs-Open-Platform decision — without any live outbound egress (HARD gate #3, CORE half) | CONN-01 | 4 | **HARD gate #3 (CORE half)** — governed node vocabulary + recorded own-vs-Open-Platform decision (MCP-first, first-party-thin, Open-Platform-sequenced SEED-013/014); **NO live egress** (→ 190, STRETCH); MCP-backed node rides the EXISTING per-phase tool whitelist + reuses the 185 action-risk (GOVERN-03) approval checkpoint (zero new governance concept); **red line D-14**; no SC#10; **no threat model** (no egress yet — lands WITH 190); no migration; UI hint |

### Phase Table (STRETCH — gated behind CORE — Phases 190-191)

Committed as gated phases (ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 / v3.3 156-159 / v3.4 169-173 / v3.5 178-180 precedent). Connectors LAST by design — the highest new security surface.

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 190 | Live Connector Slice + Connector Security | A user can run 2-3 first-party live connectors from a workflow (email out, JIRA/ticket create, Slack notify), with every outbound secured against SSRF, credential leakage, and cross-tenant bleed (HARD gate #3, live-proof half) | CONN-02, CONN-03 | 5 | 189 — **HARD gate #3 (live-proof half)**; **threat model / mandatory `/gsd:secure-phase` (`threats_open: 0`)**: unconditional SSRF / egress allow-list regardless of credential state (n8n CVE class), the sibling "authenticated ≠ safe" RCE class → sandbox all expression/template evaluation, NO arbitrary-code node on the business canvas, org-scoped Fernet `enc:v1:` credentials by reference (never in JSONB/client), dedicated cross-org leak test (SEED-124/125 precedent); **SC#10** (live connector slice); 2-3 first-party (email/JIRA/Slack) — broad catalog/webhooks/API stay with Open Platform (SEED-013); **migration likely** (org-scoped connector-credentials table; reuses `SECRETS_ENCRYPTION_KEY`); MCP spec-version pin; **red line D-14** |
| 191 | Conditional Canvas Scale Hardening | The canvas stays responsive at scale — but only if a real workflow or org fan-out exceeds the expected small scale | SCALE-01 | 4 | 184 + 188 — **conditional: ship ONLY if a real workflow / org fan-out exceeds small scale** (workflows typically 5-50 phases); React Flow `onlyRenderVisibleElements` + node memoization (>~100-150 nodes); `elkjs` auto-layout only if run-viz must depict `llm_batch_agents` fan-out as branching; indexed org-scoped Workflows-list reads; **red line D-14**; no threat model; migration only if an index needs one |

### Phase Checklist

- [ ] **Phase 181: Revert Foundation** — governed `visual_workflow_canvas` flag (default off) + gated nav/routes + `test_revert_byte_identical` CI/live-close gate; flag-off provably byte-identical (REVERT-01, REVERT-02)
- [x] **Phase 182: Server Validation Seam** — `POST /workflows/validate` reusing `reachability.lint_workflow` + grounding-fidelity verbatim; single source of validation truth, flag-gated 404 (VALID-01) — completed 2026-07-25 (12 plans + a round-3 closure pass; SC#3 404-uniqueness accepted as a documented risk → SEED-134)
- [x] **Phase 183: Read-Only Canvas** — view an existing workflow as an `@xyflow/react` node canvas; pure projection (`canvasModel.toCanvas`), node id = phase.slug, layout computed not persisted (CANVAS-01) — **verify: `passed` 2026-07-26** (4/4 code truths + all 5 live-UAT rows, `183-HUMAN-UAT.md` / `65e6ff5d`). Follow-on `183-09` planned for 3 confirmed non-blocking defects (panel-close — pre-existing Spine debt; `event.repeat` guard; end-cap `aria-describedby`)
- [ ] **Phase 184: Editable Canvas + Live Structural Validation** — add/move/connect/configure/delete nodes → one-serializer round-trip → existing draft CRUD; live per-node STRUCTURAL validation ("can't draw an invalid workflow") + governance rails (CANVAS-02..04, VALID-02/03)
- [ ] **Phase 185: Graded Governance — Per-Node Grounding Mode + Action-Risk Dial** — grounding mode (Grounded/strict auto-attaches `citations_required`+confidence gate vs Open/flexible ungated) + action-risk approval checkpoint on `llm_human_input`; strict gate not author-loosenable-away (GOVERN-01, GOVERN-02, GOVERN-03)
- [x] **Phase 186: Concurrency & Autosave** — autosave-in-place (no version mint / no gauntlet re-arm) + soft-lock/optimistic-token co-edit guard + dirty-draft-guarded publish (CONCUR-01, CONCUR-02)
- [x] **Phase 187: Business Vocabulary + AI-Seeded Canvas** — plain-language node verbs + Technical-names reveal; NL-described → safe seeded editable canvas draft (respects grounding mode); start-from-template (VOCAB-01..03) — completed 2026-08-04
- [ ] **Phase 188: Non-Technical Run Observability** — watch a run on the canvas (pending/active/passed/failed/skipped/waiting-for-you + grounded-cited vs open) from the same `usePhases` stream; honest total-function state + reconcile-on-fetch; **a run and its deliverable get their own home instead of being dumped into chat** (RUNVIZ-01, RUNVIZ-02, RUNVIZ-03)
- [ ] **Phase 189: Governed External-Action Node Model** — governed MCP-backed external-action node riding the existing tool whitelist + the 185 action-risk checkpoint + recorded own-vs-Open-Platform decision; NO live egress (CONN-01)
- [ ] **Phase 190 (STRETCH): Live Connector Slice + Connector Security** — 2-3 live first-party connectors (email/JIRA/Slack) + unconditional SSRF guard + sandboxed expression eval + org-scoped Fernet credentials by reference + cross-org leak test (CONN-02, CONN-03)
- [ ] **Phase 191 (STRETCH): Conditional Canvas Scale Hardening** — visible-element virtualization + node memoization + optional elkjs + indexed org-scoped reads, ONLY if real scale exceeds the small default (SCALE-01)

### Phase Details

#### Phase 181: Revert Foundation

**Goal**: The entire visual canvas layer can be turned on/off by an operator via a governed feature flag, and with the flag off the product is provably byte-identical to today — the tested off-switch every later phase inherits (operator HARD gate #1).
**Depends on**: Nothing (first phase — the revert gate must be provably true before any feature work lands on top of it).
**Requirements**: REVERT-01, REVERT-02
**Success Criteria** (what must be TRUE):

  1. An operator can turn the visual canvas layer on/off via a new governed feature key (`visual_workflow_canvas`, default off) — the nav entry and every canvas route are gated (the shipped v3.3 `skill_studio` / feature-visibility pattern) (REVERT-01).
  2. With the flag off, both existing authoring doors ("Describe & run" / "Author & govern") and the run surface are unchanged — no altered behavior (REVERT-01/02).
  3. A `test_revert_byte_identical` gate runs in CI and at live milestone-close, asserting the flag-off product is byte-identical to today — revertibility is a tested acceptance gate, not a prose claim (REVERT-02).
  4. Any schema the milestone introduces is additive-nullable-only and every new route is flag/404-gated at every layer, so the off-switch can never leave a non-revertible remnant (Pitfall 2).

**Plans**: 3 plans

- [x] 181-01-PLAN.md — Backend off-switch: the "off" audience + 404 require_canvas gate + temporary canary route + backend byte-identical test gate (Wave 1)
- [x] 181-02-PLAN.md — Frontend feature wiring + operator Off|On FeatureVisibility card + frontend nav byte-identical test (Wave 2)
- [x] 181-03-PLAN.md — Scope-freeze script (doors/run-surface/harness frozen) + full-suite green + operator live-close UAT (Wave 3)

**UI hint**: yes
**Flags**: HARD gate #1 (preserve-v1/revert); red line D-14 (flag-off byte-identical, no new runtime); reuse-heavy (v3.3 `skill_studio` feature-flag pattern — known-good, repeat it); `test_revert_byte_identical` CI + live-close gate; additive-nullable-only schema; no threat model (tested-revert gate, not a trust boundary); no migration (flag key in `_GOVERNED_FEATURES`; `app_settings.feature_visibility` already exists).

#### Phase 182: Server Validation Seam

**Goal**: The server exposes a single source of validation truth the canvas can call, reusing the existing lint verbatim so the canvas can never drift from the publish gauntlet it must ultimately pass.
**Depends on**: Phase 181 (the new route is flag-gated behind `visual_workflow_canvas`).
**Requirements**: VALID-01
**Success Criteria** (what must be TRUE):

  1. `POST /workflows/validate` accepts a `WorkflowDefinition` and returns structural / reachability / tool-whitelist / gate verdicts by reusing `reachability.lint_workflow` + the grounding-fidelity checks verbatim (VALID-01).
  2. The validation route is the SINGLE source of validation truth — no lint rule is re-implemented client-side; grounding lists (tools / folders / skills) come from a server-provided bundle, never a frontend constant (Pitfall 1).
  3. The route is flag-gated behind `visual_workflow_canvas` and returns a byte-identical 404 when the flag is off (inherits Phase 181's off-switch).
  4. The verdict shape is consumable per-node (each verdict maps to a phase / node id) so a later canvas can paint per-node badges from it — and later carry the GOVERN grounding verdict (185).

**Plans**: 12 plans (3 shipped + 4 gap closure round 1 + 5 gap closure round 2)

- [x] 182-01-PLAN.md — Extract grounding into one shared `harness/grounding.py` source + thin delegates + extraction-parity/count-guard (Wave 1)
- [x] 182-02-PLAN.md — `POST /workflows/validate` (full static gauntlet, severity verdicts) + `GET /workflows/grounding-bundle` palette + unit/integration tests (Wave 2)
- [x] 182-03-PLAN.md — Retire the 181 `/canvas/ping` canary + repoint BOTH `test_revert_byte_identical.py` and `test_181_flip_on.py` onto the real routes (Wave 3)
- [x] 182-04-PLAN.md — GAP (SC#4 blocker): thread the offending phase slug structurally out of `assert_folder_scopes_subset` so the `folder_scope` verdict is keyed per-node instead of `phase: None` (Wave 1)
- [x] 182-05-PLAN.md — GAP (bookkeeping): plant SEED-130/131/132 for the deferred WR-03/04/07 findings + record WR-08 as a REJECTED finding answered by D-182-05 (Wave 1)
- [x] 182-06-PLAN.md — GAP (phase-goal fidelity): enforce grounding fidelity at publish via the SAME shared `grounding_verdicts` collector + correct the two false parity claims + `/validate`-vs-publish agreement test (Wave 2)
- [x] 182-07-PLAN.md — GAP (WR-05): derive the severity classifier's known-code set from the owning modules + fail LOUD on an unrecognised code + drift detector (Wave 3)
- [x] 182-08-PLAN.md — GAP r2 (SC#3 BLOCKER, D-182-R2-01/02): pure-ASGI `CanvasGateMiddleware` deciding the flag BEFORE routing/body-decode + a dynamic flag-aware `app.openapi()` filter (cache trap handled) + retire both tautological assertions (Wave 1)
- [x] 182-09-PLAN.md — GAP r2 (WR-08): resolve the canvas caller ONCE via a `request.state` hand-off instead of re-running `get_current_user`, and threadpool-wrap the blocking canvas auth read (D-v2.5-01) (Wave 1)
- [x] 182-10-PLAN.md — GAP r2 (WR-04): one non-raising ⊆ collector in `scope.py` so EVERY out-of-subtree phase gets its own keyed `folder_scope` verdict, with the raising form as a byte-identical presentation (Wave 2)
- [x] 182-11-PLAN.md — GAP r2 (fail-honesty trio WR-01/02/07): `GroundingBundle.degraded` + a sealed `/validate` grounding section + a truncation-aware folders read, so a registry blip reports `grounding_unavailable` instead of a false `unregistered_skill` / 500 / false `folder_scope` (Wave 3)
- [x] 182-12-PLAN.md — GAP r2 (WR-05 + WR-06): scope publish's grounding gate to the DEFINITION's `org_id` instead of the publisher's org union, and correct SEED-130's wrong "not a security issue" verdict + annotate its Option B unsafe-as-written (Wave 4)

**Flags**: backend-only reuse (`reachability.lint_workflow` + `_check_grounding_fidelity` verbatim — the anti-drift seam, Pitfall 1); flag-gated 404 (inherits 181); red line D-14; no SC#10 (pure backend, no streaming/provider); no migration; no `@xyflow/react` required yet. **Gap-closure amendment (2026-07-25):** the original "no threat model (no new authz)" flag no longer holds — plan 182-06 converts publish from advisory to ENFORCING for grounding fidelity and builds an org-scoped service-role client on that path, so all four gap-closure plans carry a `<threat_model>` block (T-182-08..23). **Round-2 gap-closure amendment (2026-07-25):** the round-2 verification confirmed SC#3 FAILED (a malformed body returned 422 and `/openapi.json` advertised both routes + all 5 schemas to an anonymous caller with the flag off), so plans 182-08..12 close it plus four operator-selected round-2 review findings (WR-08, WR-01/02/07, WR-04, WR-05+WR-06); all five carry a `<threat_model>` block (T-182-24..58).

#### Phase 183: Read-Only Canvas

**Goal**: A user can view an existing workflow as a visual node canvas — a faithful read-only projection of its definition — proving the projection model cheaply before any write / persistence complexity.
**Depends on**: Phase 181 (flag). Phase 182 seam available (not strictly needed for read-only).
**Requirements**: CANVAS-01
**Success Criteria** (what must be TRUE):

  1. A user can open an existing workflow and see it rendered as a node canvas — nodes = phases, edges = flow + `skip_to_phase` branches — via `@xyflow/react` (CANVAS-01).
  2. The canvas is a pure projection of the `WorkflowDefinition` (`canvasModel.toCanvas`) — node layout is computed deterministically at render, never persisted into the definition JSONB (Pitfall 3).
  3. The canvas is read-only (nodes not draggable) and each node id equals its `phase.slug` — the identity the later run-viz paints onto.
  4. The projection renders every one of the 4 canonical seed shapes + the PM pack faithfully — no dropped phase, no phantom edge.

**Plans**: 9 plans (4 waves + 2 gap-closure waves)

- [x] 183-01-PLAN.md — Toolchain + jsdom harness: install `@xyflow/react@^12.11.2`, prove `tsc -b` + `vite build` (A4), the mandatory stylesheet at `index.css:1` (Pitfall 2/F-4), the file-local `mockReactFlow` helper, and the A1 handle spike (Wave 1)
- [x] 183-02-PLAN.md — The ONE shared `phaseVocabulary.ts` (plain-language sentences, node titles, grounding derivation, moved read shapes) + `parseSkipTarget` corrected to backend semantics, pinned by a SHARED case table read by both a vitest suite and a pytest suite (C-1, D-183-15 amendment) (Wave 1)
- [x] 183-03-PLAN.md — `EffectiveFeaturesProvider`: broadcast the existing single `GET /features` map through one context so the Builder can gate the toggle without a second fetch; fail-closed semantics and the 181 gate untouched (OP-2/F-2) (Wave 1)
- [x] 183-04-PLAN.md — The D-183-13 HARD CUT: delete `PhaseSpineGraph`'s private glyph map / parse / labels / read shapes, repoint all FIVE importers in one commit with no shim, land the 3D marks on the Spine, delete four stale in-code claims, fix the pre-existing `soulData.test.ts` RED (Wave 2)
- [x] 183-05-PLAN.md — `canvasModel.toCanvas`: the pure projection with `phase_index + 1` LOOKUP edges (C-2, no phantom edge) + the honest broken-reference stub (D-183-10) + the 14-fixture SC#4 corpus transcribed from migrations 061/066/094 + the purity/G-6 tripwire (Wave 2)
- [x] 183-06-PLAN.md — `PhaseNode` + `WorkflowCanvas`: the 137-D frosted node, the broken-reference marker, the `○ end` cap, and the read-only `<ReactFlow>` shell (`showInteractive={false}`, six opt-out flags, no-chrome empty state, app-wide ⌥ reveal) (Wave 3)
- [x] 183-07-PLAN.md — The door: the flag-gated `[≣ Spine] [⬡ Canvas]` in-Builder toggle (Spine default, session-only), the lazy-split canvas mount, the 5-variant flag-off VANISH proof, and the last stale-comment correction (Wave 4)
- [x] 183-08-PLAN.md — GAP CLOSURE: keyboard activation of a canvas node (Enter/Space → `onSelectNode`, CR-01/SC#3) installed RED-first, the honest `ariaLabelConfig` replacing React Flow's delete/arrow-key promise (WR-06), `groundingFor("partial")` aligned to `deriveTier`'s MIDDLE tier and pinned cross-module (WR-01), and `PhaseNode.tsx` lint cleared (WR-05)
- [x] 183-09-PLAN.md — GAP CLOSURE (post-live-UAT): a discoverable close for the step detail panel — a ✕ in the `PhaseFormPanel` header + Escape + canvas pane-click, landed for BOTH the Spine and the Canvas view because the defect is pre-existing shared-`handleSelectNode` debt the canvas inherited (GAP-1, operator-reported); the `event.repeat` guard so a held Enter/Space activates once instead of rapid-toggling (WR-08-01, confirmed live); and `domAttributes` clearing the inherited `aria-describedby` on the end cap + unresolved-skip stub so two inert nodes stop announcing an activation they cannot honour (WR-08-04, confirmed live)

**UI hint**: yes
**Flags**: G-2 sketch **SATISFIED** (134-137 shipped; **137-D is the locked acceptance bar**; no UI-SPEC by operator decision — the sketch READMEs are the design contract); stack — net-new dep `@xyflow/react` v12 (MIT, React-19) introduced here (never the frozen `reactflow` v11 name); G-5 ledger (new `WorkflowCanvas.tsx`/`canvasModel.ts`/`PhaseNode.tsx` mirror `PhaseSpineGraph.tsx` glyph/parse — proactively extract a shared glyph/parse module before the 3rd consumer, 1st touch); pure projection (layout computed, not persisted — Pitfall 3); red line D-14 (projection, never a runtime); no SC#10 (static projection); no migration; FRONTEND-ONLY (the one permitted backend file is a TEST: `backend/tests/unit/test_183_skip_parse_parity.py`). **Planning amendment (2026-07-25):** the "no threat model" flag is honoured as a CONCLUSION, not an omission — every plan carries a `<threat_model>` block recording the full ASVS-L1 walk and the STRIDE register (T-183-01..12 + T-183-SC), voided if any plan grows a backend SOURCE touch. Two operator decisions post-date CONTEXT.md: **OP-1** aligns the client `skip_to_phase` parse to the BACKEND (correction C-1 — `skip_to_phase:a:b` resolves to `a:b`, not `b`), and **OP-2** promotes `useEffectiveFeatures` to a context provider rather than a second `GET /features`.

#### Phase 184: Editable Canvas + Live Structural Validation (Round-Trip)

**Goal**: A user can visually author a workflow — add, move, connect, configure, and delete phase-nodes — with edits round-tripping losslessly to the definition and live server validation preventing a **structurally** invalid flow. The core deliverable; per-node grounding *strictness* is layered on top by Phase 185 (GOVERN), not baked in here.
**Depends on**: Phase 182 (validate seam) + Phase 183 (projection) — only after both are proven so drift can't sneak in.
**Requirements**: CANVAS-02, CANVAS-03, CANVAS-04, VALID-02, VALID-03
**Success Criteria** (what must be TRUE):

  1. A user can add, move, connect, and delete phase-nodes and configure a selected node in a side panel backed by the existing `PhaseConfig` discriminated-union schema — Pydantic stays authoritative (CANVAS-02, CANVAS-03).
  2. Edits round-trip losslessly back to `WorkflowDefinition` via one client serializer (`canvasModel.fromCanvas`) and save through the EXISTING draft CRUD (create-once-then-PATCH); node layout / positions stay OUT of the immutable definition JSONB (CANVAS-02, Pitfall 3).
  3. As the canvas is built, **structural** violations (reachability / tool-whitelist / gate-wiring) surface live from the server validate route — the user cannot draw a structurally invalid workflow (VALID-02); per-node grounding strictness is graded on top by Phase 185.
  4. Each node shows a per-node validation status (badge / inline error) derived from the server verdict, never a client-side guess (VALID-03).
  5. Governance is rendered as visible rails — locked phase order, per-phase tool whitelists, and validation gates the user cannot wire around; the rails are **graded** per GOVERN (185 — strict on grounded nodes, flexible on open) (CANVAS-04).

**Plans**: 13 plans in 9 waves

Plans:
**Wave 1**

- [x] 184-01-PLAN.md — D-184-07 icon swap (compass + handshake), own atomic commit at the head of Wave 0

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 184-02-PLAN.md — Wave 0: the D-184-08 count gate + pure `definitionOps` (ops, both refusals, slug, drag resolver)
- [x] 184-03-PLAN.md — Wave 0: `PhaseNode` splits into `nodePresentation` + zero-@xyflow `PhaseNodeCard` + adapter

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 184-04-PLAN.md — Wave 0: `zundo` per-mount builder store + Builder page rewire (persistence untouched)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 184-05-PLAN.md — `fromCanvas` carry-through serializer + corpus dump + shape generator + the R2 round-trip property
- [x] 184-06-PLAN.md — `/validate` + `/grounding-bundle` clients + `useLiveValidation` (debounce, abort, sequence, degraded)
- [x] 184-07-PLAN.md — browser-local `canvasNudge` (zero migration) + the plain-language `StepTypePicker`

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 184-08-PLAN.md — `verdictModel` + the two node marks + the problems tray (server-only verdicts)
- [x] 184-09-PLAN.md — `useGroundingBundle` + `PhaseFormPanel`'s optional governance rails (absent = today)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 184-10-PLAN.md — canvas editing gestures: drag axis split, cosmetic nudge, ⌥←/⌥→ reorder, verdict marks

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 184-11-PLAN.md — session composition: live loop + rails wiring, publish handoff, leave guard, 409, WR-09

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 184-12-PLAN.md — the ＋ insert / ✕ delete affordances, both refusals in the UI, empty-draft invitation

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 184-13-PLAN.md — the one bottom region: canvas toolbar + tray composition + the D-184-04 key bindings

**UI hint**: yes
**Flags**: CORE deliverable (VALID-02 author-time STRUCTURAL validation); G-2 sketch (editable canvas + node config + the `workflow_layouts`-vs-auto-layout UX call); stack — `zundo` undo/redo; one-serializer round-trip → existing draft CRUD, layout OUT of JSONB (Pitfall 3 — tested byte-identical across the 4 canonical seeds + PM pack); server-authoritative per-node badges (VALID-03, never client-guess); CANVAS-04 rails graded per GOVERN (185); G-5 ledger (`WorkflowBuilderPage.tsx` = the 3rd authoring door; `PhaseNode.tsx` 2nd touch on the glyph/parse logic); migration SKETCH-CONDITIONAL — slot 114 reserved ONLY IF the nullable `workflow_layouts` side table is confirmed at sketch (OPEN-05), else ZERO migration; red line D-14; no SC#10 (authoring, no run stream); no threat model unless discuss surfaces one.

#### Phase 184.1: Builder Header Consolidation

**Goal**: The Builder header collapses from three stacked bands into ONE row when the canvas flag is on, reclaiming vertical space for the canvas. The flag-off surface keeps today's three bands **by construction**, not by a test — because no test currently pins the Builder header at all. **MEASURED at phase-184 verification (2026-07-28), superseding the ~90px estimate this goal was written with:** the merged row is **61px** shorter than the three-band stack at a 900px viewport (146px → 85px), and the canvas graph surface starts **79px** higher than the flag-off content did. The 146px baseline was exact; the plan's ~56px *target* for the merged row is what missed (it ships at 85px), so the shortfall is in the replacement, not in the problem. On the Spine view the net is only 13px — the new Spine/Canvas tablist reinvests most of the saving — so the gain belongs to the Canvas view. Width-dependent: the original ~90px came from a 639px observation. Detail: `184-UAT-RESULTS.md` § Measured.
**Depends on**: Phase 184 (the canvas this reclaims space for)
**Requirements**: none — new scope from Phase 184 live UAT, not one of its 12 locked SPEC requirements
**Success Criteria** (what must be TRUE):

  1. With the canvas flag ON, the Builder renders exactly ONE header band containing every control from today's three; measured height materially below the 146px it replaces.
  2. With the canvas flag OFF, the Builder renders today's three separate bands, and `revertByteIdentical.test.tsx` + `WorkflowBuilderPage.canvas.test.tsx` pass with ZERO assertion edits.
  3. A test pins the flag-off header structure — the first one to ever do so (D-181-01's Builder-header half was previously unguarded).
  4. Nothing is removed: every control, badge and label from the three bands survives the re-flow and stays reachable by accessible name.

**Plans**: 1 of 1 complete
**Source**: `.planning/phases/184-editable-canvas-live-structural-validation-round-trip/184-HEADER-PLAN.md` (Option A, operator-selected)
**Flags**: FE-only, no backend, no migration, no new dependency; touches the D-181-01 flag-off surface so the flag gate is the load-bearing decision; G-1 satisfied (no prior 184.x)

Plans:

- [x] 184.1-01-PLAN.md — the flag-off header pin (written FIRST), the flag-gated merged row, and the band-count budget + one-definition gate guard

#### Phase 185: Graded Governance — Per-Node Grounding Mode + Action-Risk Dial

**Goal**: Each node carries a **grounding mode** — *Grounded / strict* auto-attaches the immutable `citations_required` + confidence gate (must cite retrieved knowledge above the confidence threshold, else fail / route to HITL) vs *Open / flexible* (an ungated agentic / reasoning / tool step) — plus an orthogonal **action-risk** approval checkpoint on outbound / write nodes. A single workflow freely mixes strict-grounded and open nodes; the strict gate is structurally enforced and NOT author-loosenable-away. The milestone's headline differentiator (the deep-crawl white-space no competitor covers), sequenced right after the editable canvas so it lands on a working canvas.
**Depends on**: Phase 184 (a working editable canvas + the per-node side-panel config to attach the dials to) + Phase 182 (the validate seam that now also reports the grounding verdict).
**Requirements**: GOVERN-01, GOVERN-02, GOVERN-03
**Success Criteria** (what must be TRUE):

  1. Each node carries a grounding mode: *Grounded / strict* auto-attaches the immutable `citations_required` + confidence gate (reusing the shipped validation-gate library); *Open / flexible* is NOT gated on KB citation (GOVERN-01).
  2. A single workflow can freely MIX strict-grounded and open nodes; on a grounded node the strict gate is structurally enforced and NOT author-loosenable-away (GOVERN-01) — Deep byte-identical when the field is unset (D-14).
  3. The canvas visibly marks each node's governance state (grounded-strict-cited vs open-flexible), so a business user can see which steps are trustworthy/cited vs exploratory; the "can't draw an unsafe workflow" rails apply **graded** — enforced on grounded nodes, relaxed on open ones (GOVERN-02).
  4. Each node can carry an **action-risk** checkpoint — an outbound / write / external-action node gets an approval / human-in-the-loop gate before it executes, built on the existing `llm_human_input` phase-type substrate (GOVERN-03).
  5. Graded strictness holds across providers — a grounded node's citation/confidence enforcement rides the provider-sensitive retrieval/agent path uniformly, Deep byte-identical when unset (SC#10 / D-14).

**Plans**: 11 plans in 6 waves

Plans:
**Wave 1**

- [x] 185-01-PLAN.md — the 137-D → 137-B card-geometry rebuild (D-185-17), standalone, before any governance mark lands
- [x] 185-02-PLAN.md — the two additive-optional PhaseSpec booleans, KB_TOOLS + the pure grounding_cause derivation, and kb_tools on the palette route

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 185-03-PLAN.md — the retrieved_and_cited mode, the action_risk_approval kind, effective_phase, and the spec_by_slug enforcement seam
- [x] 185-06-PLAN.md — the client's data half: kbTools on the palette hook, the two booleans on PhaseSpecJSON, the caller-owned write chain and the governance copy constants

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 185-04-PLAN.md — the fail-closed armed wait: indefinite subscribe, an explicit decline mapping, a verbatim prompt, a survivable shutdown
- [x] 185-07-PLAN.md — GovernanceSection: the dial that visibly refuses, and the PhaseFormPanel mount point (G-5 honoured by construction)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 185-05-PLAN.md — the honest wait end-to-end: action_risk_pending vocabulary, the armed resume sweep, a no-deadline prompt card
- [x] 185-08-PLAN.md — delete the 3-face word-badge, synthesize the locked gate row client-side (D-185-19), thread grounded/armed, re-measure the count-gate pins

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 185-09-PLAN.md — the corner seal at the CLAIMED top-right, never conditional on run state, with a props fence and a four-mark zone check
- [x] 185-10-PLAN.md — the detour edge: FlowEdge, the net-new edgeTypes map, edge.type on flow edges, and a no-visible-change guard on ordinary edges (D-185-18)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 185-11-PLAN.md — the vocabulary sweep as a test, the four phase-level fences, the G-5 / D-185-17 / publish-behaviour records, and the G-4 + SC#10 gate

**Wave 7** *(gap closure — found by operator UAT, blocks 185-11 Task 3)*

- [x] 185-12-PLAN.md — BUG-260730-01: the auto-attached citation gate demanded inline markers nothing asked the model to write; state the format in one home, tell the producer on both agent paths, keep the gate strict

**Wave 8** *(gap closure — found by the SC#10 scoreboard; blocks G-4 #3 and the parallel-thread row)*

- [x] 185-13-PLAN.md — BUG-260731-02: the armed action-risk checkpoint CRASHES the run (`action_risk_pending` is emitted but unregistered in BOTH the Python allow-list and the Postgres CHECK). **Migration 114** + registration + a Python-set == SQL-CHECK-set guard; **amends this phase's zero-migration contract in the open** (operator decision, 2026-07-31)

**UI hint**: yes
**Flags**: HEADLINE differentiator (no competitor grades by KB-grounding — the Beam/Glean/n8n deep-crawl white-space; `.planning/research/deep-dive/`); ENGINE-ADDITIVE (an optional per-node `grounding_mode` field on the phase-config model that AUTO-ATTACHES the EXISTING immutable `citations_required` + confidence gate on grounded nodes — reuses the shipped validation-gate library; open nodes ungated); GOVERN-03 reuses the existing `llm_human_input` phase-type for the action-risk/approval checkpoint; Deep byte-identical when unset (D-14 load-bearing); G-2 sketch (governance state on the canvas — grounded-strict vs open-flexible badges + the mode toggle — is a "feels like" surface); SC#10 (a grounded node's citation/confidence enforcement rides the provider-sensitive retrieval/agent path — verify graded strictness holds cross-provider); G-5 ledger (`PhaseNode.tsx` node model, ~3rd touch after 183/184 → apply refactor-before-3rd-touch PROACTIVELY + the validation seam); no full threat model (reuses the enforced gate library; the structural "not author-loosenable-away" property is verified in-phase; the connector threat model lands at 190); ~~NO migration (additive optional field in the WorkflowDefinition JSONB, not a column)~~ — AMENDED 2026-07-31 (operator decision, plan `185-13`): EXACTLY ONE migration, `114_harness_audit_action_risk_pending.sql`, adding one literal (`action_risk_pending`, 22 → 23) to the `harness_audit` event_type CHECK and no other schema object; superseded wording preserved, not deleted. Reason: the zero-migration promise was a scoping convenience; the honest-pause vocabulary is a correctness property, and the alternative knowingly ships the defect the phase existed to fix (BUG-260731-02). The grounding field + action-risk dial themselves stay additive-optional JSONB, not columns.

#### Phase 186: Concurrency & Autosave

**Goal**: Continuous canvas autosave is safe on org-shared workflows — a cosmetic drag never mints a definition version or re-arms the golden-run gauntlet, and two editors cannot silently clobber each other. Closed before real usage, not discovered live (v3.4 made workflows org-shareable).
**Depends on**: Phase 184 (the editable canvas + draft CRUD it autosaves through).
**Requirements**: CONCUR-01, CONCUR-02
**Success Criteria** (what must be TRUE):

  1. Editing a draft on the canvas autosaves by updating the draft row in place — a cosmetic node drag never mints a new definition version or re-arms the golden-run gauntlet (CONCUR-01).
  2. Two people editing the same org-shared workflow cannot silently clobber each other — a concurrency guard (soft-lock / optimistic-concurrency token) protects the shared draft (CONCUR-02).
  3. Publish is guarded against reading a dirty draft (mirrors the shipped `publish_definition` WR-03 draft-status guard).
  4. The two-editor / parallel path is exercised in UAT (SC#10 parallel axis) — a second editor gets an honest read-only banner or a merge-safe outcome, never a silent overwrite.

**Plans**: 20 plans in 12 waves (8 shipped + 5 gap-closure from the first `186-VERIFICATION.md` + 4 gap-closure from the first 2026-08-01 re-verification + 3 gap-closure from the waves-9-10 re-verification)

Plans:

**Wave 1** *(no shared files — run in parallel)*

- [x] 186-01-PLAN.md — the optimistic-concurrency token in SQL (`CONCURRENCY_TOKEN_SQL` over `updated_at`), the guarded UPDATE, and the honest three-way refusal (404 / 409 `already_published` / 409 `stale_token`). Fixes the wire contract every later plan builds against. **Zero migrations** — head stays 114
- [x] 186-04-PLAN.md — `builderStore`: retire the unread `saveState` slot (the call 184-13 handed to 186), add `setProjectFolder` so a `meta`-only KB edit arms `dirty` (F14), and correct the two docblocks that would otherwise lie about where the write lives

**Wave 2**

- [x] 186-02-PLAN.md — carry the stage-0 token through the gauntlet and refuse on drift: `publish_definition` gains the `-2` sentinel, `publish_service` gains the `draft_changed` block, and the golden-run receipt survives by construction (SC#3)
- [x] 186-03-PLAN.md — the transport client: `token` on the draft wire types, `If-Match` on the PATCH, and the two named refusals the 409 arm has always thrown away (`WorkflowStaleTokenError`, `WorkflowDraftUnreadableError`)

**Wave 3**

- [x] 186-05-PLAN.md — the publish spine's fail-open: an unrecognised `blocked_stage` currently paints all 8 stages green under a refusal headline. Fix the PROPERTY (both `-1` reads), add the 9th `Commit` stage, and word the verdict. **F7 is the highest-value single test in the phase**
- [x] 186-06-PLAN.md — `useDraftPersistence`: the whole persistence seam D-184-05 pre-authorised — debounce, single-flight token chain, one hold mechanism with two sentences, and a conflict that halts writing and offers Reload then Overwrite

**Wave 4**

- [x] 186-07-PLAN.md — compose the hook into the page: the token reaches all four Builder entry paths, the quiet status line and the conflict banner mount in the header, and `WorkflowBuilderPage.tsx` is measurably smaller (G-5 honoured by construction)

**Wave 5**

- [x] 186-08-PLAN.md — the folded `BUG-260731-03` **control** half: the display-only header chip promoted into the existing picker, with a neutral unbound invitation and no verdict. The `/validate` verdict half stays in Phase 187

**Wave 6** *(gap closure — `/gsd:verify-work 186` returned gaps_found 4/7; no shared files, run in parallel)*

- [x] 186-09-PLAN.md — GAP-1 / CR-01: the receipt becomes a property of WHAT WAS WRITTEN. `performWrite` captures the payload's `phases`+`meta` identity at snapshot time and refuses `markSaved()` unless the store still holds it, closing the silent-loss-with-false-receipt on the common type→pause→resume interleaving
- [x] 186-10-PLAN.md — WR-02: the gauntlet spine gains the missing `grounding_fidelity` row at its real pipeline position, the running-node index is derived rather than hard-coded, and a test sourced from `publish_service.py` pins the table to the server's own emission list
- [x] 186-11-PLAN.md — WR-06: the live-Postgres skip moves off the module and onto the tests that need a database, so the phase's headline backend invariant (`draft_changed` instead of a false `publish_succeeded`) has DB-free CI coverage

**Wave 7** *(blocked on Wave 6 — shares `useDraftPersistence.ts` with 186-09)*

- [x] 186-12-PLAN.md — GAP-2 / WR-01: single-flight becomes a property of the WRITER rather than of each caller; `overwrite`/`reload` gain a re-entrancy guard, and the conflict banner survives its own resolution with both controls disabled

**Wave 8** *(blocked on Wave 7 — shares `useDraftPersistence.ts` and `BuilderSaveRegion.tsx` with 186-12)*

- [x] 186-13-PLAN.md — GAP-3 / WR-03 (+ WR-04, WR-05): the hold-release effect obeys `enabled`, closing the flag-off automatic-PATCH leak against D-181-01; the publish hold sentence stops promising a save the loop will not perform and renders on both surfaces; a 404 on a deleted draft halts the loop instead of retrying forever

**Wave 9** *(gap closure — the 2026-08-01 re-verification returned `gaps_found` 6/8 with one BLOCKER; no shared files, run in parallel)*

- [x] 186-14-PLAN.md *(executed 2026-08-01 — `ae19e5ca`, `67032b38`, `4f4574d0`, SUMMARY `293f1176`; hook suite 40 → 46, `BuilderSaveRegion` 8 → 11, 6-suite aggregate 244/244, `vite build` 0, zero migrations)* — **GAP-4 / CR-02 (BLOCKER)** + WR-07: a failed `reload()` no longer strands the draft — the catch RESTORES the conflict (both exits stay on screen) and the banner gains an extra line saying why the exit failed; and a published-row 409 becomes terminal, so a frozen draft stops re-issuing doomed PATCHes for the life of the session
- [x] 186-15-PLAN.md *(executed 2026-08-01 — `165b3e0e`, `03841bd0`, `c4870806`, SUMMARY `19329bf2`; two test files only, `backend/tests/unit/test_186_concurrent_patch.py` 4 → 13 passed live and 0 → 9 passed with no Postgres, collection 3465 → 3474, full suite 211 failed before AND after, zero migrations)* — **WR-11 + WR-06 residue**: the pane-click row measures the DISMISSAL (a call-count delta with its own in-row positive control, siblings untouched) instead of an absolute count over an interval that outruns the debounce; and the `stale_token` 409 wire shape gains DB-free coverage at both the route and the db tier, each arm falsified against real source with no database. ⚠ **The plan's required RED did not reproduce** — the row passed 6/6 here — so the failure MECHANISM was injected instead (a 1500 ms pause), reproducing the verifier's exact 22 + 1 signature. Both measurements are recorded; the 186-12/13 "passes in isolation" claim is false *as stated* because it described the machine, not the row
- [x] 186-16-PLAN.md *(executed 2026-08-01 — `e7b2b237`, `3f06d112`, SUMMARY `f0384214`; `PublishGauntlet.test.tsx` 41 → 46 in isolation, canvas+header pair 111 → 114, 4-file acceptance set 183/183, `vite build` 0, `WorkflowBuilderPage.tsx` +25 insertions at the plan's cap, zero migrations)* — **WR-10**: a gauntlet can no longer start on top of an outstanding autosave write. `persistState.kind === "saving"` becomes a `blockedReason` branch ranked ahead of the validation ones, and the INNER Publish button — the click that actually spends money, previously gated on nothing but the textarea and `loading` — reads the same derived `blocked`, with the reason rendered INSIDE the modal (R12: the trigger's sits behind the backdrop). The gate was **falsified** by removing `&& !blocked` (exactly the 3 gate rows red). The `flushPendingWrites()` alternative is rejected on D-181-01 grounds — the gauntlet mounts on both branches of the flag gate — and recorded in `deferred-items.md` with the residual `conflict`/`error` case. ⚠ Four plan claims refuted by measurement (no R12 cases in the gauntlet suite; the canvas-pair baseline is 111, not 141)

**Wave 10** *(blocked on Wave 9 — shares `useDraftPersistence.ts` with 186-14)*

- [x] 186-17-PLAN.md *(executed 2026-08-01 — `4b02ed18`, `fa6c1a03`, SUMMARY `83b97669`; hook suite 46 → 53 in isolation, 7-suite consumer set 270 → 277 with zero failures, `vite build` 0, zero migrations, `BuilderSaveRegion.tsx` diff empty)* — **WR-08 + WR-09**: the drain now asks **two** questions instead of using one answer twice — payload identity alone gates the RECEIPT (CR-01 preserved verbatim), `pendingRef` alone gates IMMEDIATE RE-ENTRY, and a supersession with a live debounce timer behind it BREAKS after resolving `{kind:"saving"}` → `idle`. **Falsified: 11 PATCHes across 3 s of typing became 1** (F22a), and an explicit Save with nothing changed stopped minting a redundant token-bumping PATCH (F22d, 2 → 1). The hold's reading now resolves UNCONDITIONALLY on the non-null → null transition, above all three gates and **functionally** (so a `conflict` — the only reading carrying Reload/Overwrite — is untouched, F20h); `heldPendingRef` on the flag-off path is set to the store's own `dirty`, so it can neither claim unsent work that does not exist (F20f RED: a PATCH carrying the untouched 2-phase draft) nor lose work that does. D-181-01 intact — the four `performWrite()` call sites and their gates match 186-13's enumeration exactly. ⚠ Six plan claims refuted by measurement (the "3 arming sites" are one statement + three call paths since 186-12; the consumer-set baseline is 270/270, not 233+1; F22a's RED is parameter-dependent — 5 or 11 — and both are recorded)

**Wave 11** *(gap closure — the waves-9-10 re-verification returned `gaps_found` 7/9 with one BLOCKER; no shared files, run in parallel)*

- [x] 186-18-PLAN.md — **CR-03 (BLOCKER)**: 186-16's publish guard is dead code with the canvas flag off. `blockedReason`'s `!canvasEnabled || builderPhase !== "drafted"` short-circuit is evaluated ABOVE the `persistState.kind === "saving"` branch, while `saveNow` is deliberately ungated on the flag (D-186-03) and `actionGroup` mounts BOTH the Save button and `renderPublish` on both header branches — so a chosen Save on the flag-off Builder can be followed by a Publish that nothing refuses, burning a golden run for a publish that can only end in `draft_changed`. Fix = lift the outstanding-write branch above the flag/phase gate (a fact about THIS client, not a verdict about the workflow), pinned by a new canvas row that presses `builder-save-draft` flag-off against a deferred PATCH, with the D-181-01 markup pin re-measured rather than assumed, and the CR-03 live row added to `186-VALIDATION.md`
- [x] 186-19-PLAN.md — **WR-12 + WR-13**: the two residual holes in 186-17's hold-release repair. Flag-off, the release resolves to a bare `{kind:"idle"}` — erasing *"press Save draft again when it finishes"* at the instant it becomes actionable and leaving unsent work with zero on-screen indication (WR-12); and `heldPendingRef` can outlive a halt through `overwrite()` (which, unlike `reload()`'s success path, never clears it), so a later clean hold cycle flushes a no-op PATCH that mints a fresh token — manufacturing the very conflict this phase exists to prevent (WR-13). Both closed in the hook alone: `BuilderSaveRegion` already renders `held` on every surface (186-13 / WR-04), so no component changes

**Wave 12** *(blocked on Wave 11 — re-edits `186-VALIDATION.md`, and its deferral entries must describe the tree AS SHIPPED)*

- [x] 186-20-PLAN.md — **WR-14..WR-18 recorded, not dropped**: five deferrals with concrete re-open triggers (the reason rank + the free-click disable, the unbounded `saving` block, `reload()`'s over-wide catch scope, a second Reload's stale note, and `overwrite()`'s null-token degradation), each a product decision rather than a race fix — including the honest record that 186-18's reorder WIDENS WR-14 to the flag-off surface. Plus the round's measured gate (phase-186 frontend consumer set + backend files + `tsc`), written into `186-VALIDATION.md` with counts required to be non-decreasing. `**Approval:** pending` and all eight Manual-Only rows stay untouched — SC#4 is operator-only (G-4)

**UI hint**: yes
**Flags**: autosave-in-place (never mint a version / re-arm the gauntlet — CONCUR-01, the autosave version-explosion trap); soft-lock / optimistic-token co-edit guard (mirrors `publish_definition` WR-03); parallel-editor UAT row (SC#10 parallel axis) — the two-editor org-shared clobber; concurrency mechanism (block vs warn vs merge) = sketch/discuss call (research left it open); red line D-14; no full SC#10 (not cross-provider streamed); no threat model (v3.4 org RLS already enforces the share boundary); no migration.

#### Phase 187: Business Vocabulary + AI-Seeded Canvas

**Goal**: A business user sees plain-language node verbs and can describe a workflow in natural language to get a safe, editable seeded canvas draft (AI + visual, not either/or) — and the AI seed respects grounding mode (a seeded grounded node auto-gets its citation/confidence gate — safe-by-construction). Vocabulary work sits on the validated + graded model from Phases 182-185.
**Depends on**: Phase 185 (the AI seed must respect grounding mode) + Phase 184 (the validated round-trip model).
**Requirements**: VOCAB-01, VOCAB-02, VOCAB-03
**Success Criteria** (what must be TRUE):

  1. A business user sees plain-language node names / verbs ("Find documents", "Ask the AI", "Get approval", "Produce a report") with a Technical-names reveal — extending the v3.3 LANG-01 layer + SEED-085 terminology split (VOCAB-01).
  2. A user can describe a workflow in natural language and get a seeded, editable canvas draft (wires the existing `POST /generate` NL generator, SEED-051, into `toCanvas`) (VOCAB-02).
  3. The AI seed structurally cannot emit an unsafe node — the response schema IS the `extra="forbid"` union, the seeded draft passes the same server validate route, and a seeded grounded node auto-gets its citation/confidence gate (respects grounding mode, 185 — safe-by-construction) (VOCAB-02).
  4. A user can start from a template / starter flow on the canvas (reuses the shipped Starter Workflow Library) (VOCAB-03).
  5. Vocabulary expressiveness is validated against the PM pack + Starter Library + all 4 canonical seed shapes as the acceptance bar — no jargon leak, no over-simplification (not a toy demo).
  6. **An armed action-risk checkpoint is ALWAYS asked, regardless of what else the phase declares — the guarantee is structural, not positional (SEED-137, folded 2026-07-31).** Today the engine APPENDS the armed spec (`grounding.py:951-953`), `run_gates` returns on the FIRST failure (`validators.py:230`), and an ask_user Proceed falls through to the body without re-running the remaining pre-gates (`harness_engine.py:737-739`) — so an author-declared `timing="pre"` / `on_failure="ask_user"` validator preempts the armed gate, the person is shown the wrong choices, `action_risk_pending` is never emitted, and the step runs unapproved. **This is SC#3's counterexample: "safe-by-construction" cannot ship while a governance gate can be silently skipped.** Fenced today only by `publish_service.py:464-503` refusing author-declared `ask_user` validators — a fence explicitly slated for removal by the deferred Phase-103 background-job publish (`publish_service.py:478-479`).

**Plans**: 29 plans in 16 waves (15 shipped + 4 gap closure round 2 + 2 gap closure round 3 + 4 gap closure round 4 + 4 gap closure round 5)

Plans:
**Wave 1**

- [x] 187-01-PLAN.md — SC#6 property test over author-declared validator sets, observed RED on HEAD (wave 1)
- [x] 187-02-PLAN.md — per-step `name` in AUTHORING_SYSTEM_PROMPT + the additive-optional provenance marker on PhaseSpec (wave 1)
- [x] 187-03-PLAN.md — D-187-11: the `unbound_retrieval` `incomplete` verdict in /validate + BUG-260731-03 frontmatter (wave 1)
- [x] 187-04-PLAN.md — the config-derived node-face tier in phaseVocabulary.ts (D-187-04 / D-187-05) (wave 1)
- [x] 187-05-PLAN.md — the D-181-01 flag-OFF describe-screen markup pin, captured before the template door (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 187-06-PLAN.md — SC#6 fix shape C: the hoisted pre-body armed checkpoint + the closed Pitfall-4 fail-open (wave 2)
- [x] 187-07-PLAN.md — SC#10: the 8-provider authoring roster derived from MODEL_CAPABILITIES (wave 2)
- [x] 187-08-PLAN.md — thread the name context through toCanvas + WorkflowCanvas (wave 2)
- [x] 187-09-PLAN.md — Req 4: the reveal swaps the canvas subtitle; the spine keeps its plain title (wave 2)
- [x] 187-10-PLAN.md — Req 3 demote-on-identity-edit + the receipt/door copy constants in definitionOps (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 187-11-PLAN.md — the SC#6 test census re-shape, the green property and the observed falsification (wave 3)
- [x] 187-12-PLAN.md — SC#5 checks 1 and 2 as pure-function sweeps over the shipped corpus (wave 3)
- [x] 187-13-PLAN.md — Req 5: the post-draft seed receipt (wave 3)
- [x] 187-14-PLAN.md — Req 6: the starter template door that seeds the describe box (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 187-15-PLAN.md — the two gated page mounts, the name-context thread and the phase gates (wave 4)

**Wave 5** *(gap closure — `/gsd:verify-work 187` returned `gaps_found` 9/11 with one BLOCKER; operator-scoped to CR-01/CR-02 + the two folded Warnings; no shared files, run in parallel)*

- [x] 187-16-PLAN.md — **CR-01 (BLOCKER) + CR-02**: the seed receipt stops claiming the AI applied a gate the author's own `citation_policy` applied. The "so I set them to must prove it" lead and the one-way rule count ONLY `detected` steps; `already-set` and `escalated` steps keep their row and gain their own authorship-free sentence, so no ⛨ seal on the canvas is left unexplained (the sketch's own rule — filtering the list would have traded a false sentence for a silent mark). The suite's `citation_policy: "loose"` fixtures — a value the backend `Literal` forbids — become the real default `"strict"`, which is what makes the regression visible at all (wave 5)
- [x] 187-17-PLAN.md — **WR-02**: `derivedFace`'s folder tier is gated on the shipped `GROUNDING_DIAL_TYPES`, so a step type that cannot search never renders "Search {folder}". `llm_emit` is deliberately EXCLUDED on measured evidence — `_exec_llm_emit` is a sealed forced emit that builds no phase tool context and never reads `folder_scope`, refuting `LlmEmitPhaseConfig`'s plan-era docblock claim. Closes the test blind spot where every folder case used `llm_agent` (wave 5)
- [x] 187-18-PLAN.md — **WR-03**: the `＋` menu row stops reading `PHASE_TYPE_SENTENCES` directly and asks `nodeTitle` over the phase `minimalPhaseFor` will build, so the row and the card can never say two things one click apart. Fix (a), not (b): sketch 148-C keeps BOTH strings, so editing the locked map or deleting derived tier (4) would change the design to hide a consumer bug. Five of six rows proved byte-identical (wave 5)

**Wave 6** *(blocked on Wave 5 — records what Wave 5 measured)*

- [x] 187-19-PLAN.md — G-4 closure: `187-VALIDATION.md` gains the six closure task rows, four new lived-experience rows (receipt honesty on a real `llm_agent → llm_emit` draft, the zero-detected arrival, the non-retrieval node face, the picker→card agreement), and **M3 is unblocked** — the row the BLOCKER was holding, since the operator would otherwise have been confirming a receipt that lies. Re-measures the zero-migration gate and the D-187-14 mount cap with raw output (wave 6)

**Wave 7** *(gap closure round 3 — `/gsd:verify-work 187` re-verified `gaps_found` 10/11; the round-2 fix for CR-01 introduced its own unguarded sentence; operator-scoped to CR-03 + WR-09 ONLY)*

- [x] 187-20-PLAN.md — **CR-03 (BLOCKER) + WR-09**: the seed receipt's carried paragraph (`seed-receipt-carried`) gains the rendered coverage its sibling already has — presence, count, character-identity against `seedReceiptCarriedLead`, and the zero case — and the sentence itself stops attributing the seal to a cause it cannot know. Measured at HEAD: `grep -rn "seed-receipt-carried" frontend/src/` returns ONE hit, the component's own attribute, so the paragraph could be deleted, print the wrong number or drift from its formatter with all 452 tests green. WR-09 fix shape (a) — cause-agnostic by DELETING the false ` by its own settings` clause, not the reviewer's suggested replacement: "more" is an antecedent word and the paragraph renders ALONE on the typical non-KB draft, which `definitionOps.ts`'s own docblock property 3 forbids (note: the existing `definitionOps.test.ts` regex is start-anchored and would NOT have caught it — the objection rests on the declared property, and on the independently sufficient point that `before I started` is not reliably true of `grounding_escalated`). Four falsification probes (delete the paragraph / corrupt the count / drift the text / blind the guard) are each observed RED and reverted — the property, not the patch (wave 7)

**Wave 8** *(blocked on Wave 7 — records what Wave 7 measured)*

- [x] 187-21-PLAN.md — G-4 closure for round 3: `187-VALIDATION.md` gains the three task rows, the four probe records, the before/after testid-coverage sweep and every re-measured gate with raw output. **M3 and M9's notes are repaired** — both currently warn the operator to expect an internally-contradictory card on an escalated draft, which stops being true once 187-20 lands — and a new **M13** covers the escalated-only draft head-on, the exact case WR-09 broke and no shipped row tests directly. WR-08 is named as rolled into Phase 188, never as closed. Nothing is ticked (wave 8)

**Wave 9** *(gap closure round 4 — `/gsd:verify-work 187` re-verified `gaps_found` 10/11 with a NEW BLOCKER; operator-scoped to CR-04 + all six warnings WR-11..WR-16; IN-11..IN-14 explicitly OUT, WR-08 stays routed to Phase 188)*

- [x] 187-22-PLAN.md — **CR-04 (BLOCKER)**: the receipt narrates the arrival but renders LIVE store state. `phases` is a `useStore` selector (`WorkflowBuilderPage.tsx:573`) handed straight into the card; `showReceipt` is cleared only by the dismiss button; and `PhaseFormPanel` sits on the same screen writing the exact field (`available_tools`) the receipt's classification reads. So a post-arrival edit re-produces CR-01's sentence over the user's own act — the same failure shape a third time, reached through a data-flow path neither prior round examined. Fixed by snapshotting `def.phases` beside `setDrafted` (D-187-14: a `useState`, a setter and a one-identifier prop swap, ≤ 15 insertions measured). All THREE input paths closed by the one mechanism (`available_tools`, `phases.length` via ＋, the grounding dial via `setPhaseGovernance`). **Note the planner correction recorded in the plan:** the review's own proposed component-level `rerender` test cannot pass under the review's own caller-side fix, so the falsifying fence lives at the page level and `rerender(` lands in `SeedReceipt.test.tsx` carrying the two properties the leaf genuinely owns — including the fence that forbids "fixing" CR-04 by caching inside the component. RED observed before, GREEN after, both raw (wave 9)

**Wave 10** *(blocked on Wave 9 — shares `SeedReceipt.test.tsx`)*

- [x] 187-23-PLAN.md — **WR-11 + WR-15**: `seedReceiptStepReason("escalated")` returns "you turned this on by hand" from a bit that carries no actor — `grounding_escalated` is an ordinary `PhaseSpec` field and the emit tool's schema is the whole `WorkflowDefinition`, so a model emission can reach this card and tell a user who clicked nothing that they turned a lock on. The review recorded that path as reachable-by-schema and NOT observed; the plan makes resolving it a deliverable rather than inheriting it. Same function: the `default:` arm swallows every future `GroundingCause` member and returns `""`, which the row renders as a face and a dangling em-dash — closed with the `never` guard `requiredConfigFor` already establishes 180 lines down, plus a DOM invariant that no rendered reason is ever empty. Three falsifications observed and reverted (wave 10)

**Wave 11** *(blocked on Wave 10 — shares `SeedReceipt.test.tsx` and `definitionOps.test.ts`)*

- [x] 187-24-PLAN.md — **WR-12 + WR-13 + WR-14**: round 3's own two guards shipped without the controls their own files mandate. The WR-09 fence is a deny-list of the exact deleted clause — measured, every needle now matches nothing in the product — so it gains a positive control over its own needles and a word-class property assertion (the Phase-185 lesson: a deny-list cannot be made fail-closed by extension). The testid sweep is satisfiable by a comment, blind to two JSX spellings and to the whole `data-*` class `data-carried-count` belongs to — widened, comment-stripped, and given the planted literal every other fence in its block has, proved by five probes. And `SeedReceipt.tsx`'s docblock claims "there is no second derivation to drift" while the file re-implements the `available_tools ∩ kbTools` predicate `groundingCause` owns — the predicate MOVES to `phaseVocabulary.ts` (one home per rule), making the claim true by construction rather than by coincidence (wave 11)

**Wave 12** *(blocked on Wave 11 — a pin read from the gate's own output after every test-adding plan has landed; records what Waves 9-11 measured)*

- [x] 187-25-PLAN.md — **WR-16** + the round-4 record: neither reviewed suite is in `vitest-count-gate.cjs`'s `BASELINE`, so the 13 tests closing CR-03 and every fence this round adds can be deleted with the gate green — verbatim the Phase-177 lesson the script's own header cites as its reason for existing. Both suites pinned from the script's printed `actual` column (never hand-counted: `definitionOps.test.ts` declares ~118 `it(` literals and runs 228 cases), each pin observed catching a deletion, and `SeedReceipt.test.tsx`'s docblock instruction NOT to pin it repaired in the same commit. The known `PublishGauntlet.test.tsx` parallel flake (`D-ITEM-187-20-01`) is re-run in isolation and never re-pinned downward. Then `187-VALIDATION.md` gains the round-4 section: per-task rows, every falsification probe with its observed RED and revert, five re-measured gates, **M3/M9's CR-04 notes repaired to describe the post-fix expectation**, and a new **M14** for the property this round built. Nothing is ticked (wave 12)

**Wave 13** *(gap closure round 5 — the operator's live UAT session found THREE findings that are ONE causal chain; base `15339441`)*

- [x] 187-26-PLAN.md — **GAP A, the root cause**: the loose "Describe & run" door has NO knowledge-base picker, so an author cannot bind a folder before the AI generates. Measured live: `project-folder-picker` absent at 1.5 s / 3 s / 5 s and ZERO `/folders` requests on that screen, because the describe door renders its OWN composer and never mounts `WorkflowBuilderPage` — then "Draft the workflow" hands off with `autoDraft`, which generates IMMEDIATELY on mount, so the Builder's own picker never gets a frame either. **Every fast-path workflow is therefore born unbound**, which is why `unbound_retrieval` fires routinely and Publish is disabled for a reason the author was never asked about. **Design settled in the plan, not by the executor: shape (i) — a picker on the door, threaded through the existing handoff — and NOT shape (ii), a gate on `autoDraft`**, which would delay the draft without ever letting the author bind and would blunt the sketch-approved fast path's only promise. The surface lands as its own component file (`DescribeKbPicker.tsx`, the `StarterTemplatePicker` shape: one api symbol, no invented row, "there are none" kept apart from "we could not ask"); the hot page spends **6 insertions / 1 deletion** on one additive-optional prop and **zero render-body change** (D-187-14) (wave 13)

**Wave 14** *(blocked on Wave 13 — shares `WorkflowBuilderPage.tsx`)*

- [x] 187-27-PLAN.md — **GAP B**: opening an existing draft into the canvas issues ZERO `POST /workflows/validate` calls (measured `validateCallsMade: 0` with a fetch hook installed before the card was opened), yet the tray renders *"Nothing to fix — the static checks pass · checked by the server"* and Publish stays ENABLED — for a definition the server marks `ok:false` the moment it IS asked. This is verbatim the fail-open the page's own docblock forbids (*"A check that did NOT RUN must never unblock a publish"*, D-184-14) — the shipped rule covers `degraded` and not **never-ran**. The polling is 184-era (VALID-02), **not** authored by 187; 187 is what makes it bite. **Both halves of the UAT's fork ship together, because either alone is wrong**: fail-closed alone leaves every opened draft permanently unpublishable, validate-on-open alone leaves the in-flight window still lying. Never-ran rides the EXISTING `degraded` channel (the hook's own docblock defines it as *"the check did not run"*), which fixes all three lying sites in `ProblemsTray` with zero new props; the union is widened in `verdictModel.ts` so the hook's type never admits a member it cannot emit (the WR-14 drift class). `enabled` becomes `hasEdited || (canvasEnabled && phases.length > 0)` — `phases.length > 0` preserves D-184-15's stated reason exactly, `canvasEnabled &&` preserves D-181-01 and gets its own falsification (wave 14)

**Wave 15** *(blocked on Wave 14 — shares `WorkflowBuilderPage.canvas.test.tsx`, and its client fence asserts over the `blockedReason` shape 187-27 leaves)*

- [x] 187-28-PLAN.md — **GAP C (minor, doc-only; operator has decided the disposition)**: `backend/app/api/workflows.py`'s comment claims the three route-assigned codes are *"canvas-only"* and that *"Phase 187 is not scoped to change what publishes"*. Measured false end-to-end — a draft whose SOLE verdict is `unbound_retrieval` produces `publish-trigger.disabled === true` with the message verbatim beside it. **The BEHAVIOUR is correct and stays** (blocking an unbound retrieval workflow is what `BUG-260731-03` asked for); the CLAIM is stale. Same defect class as WR-14, which 187-24 closed hours earlier. Both halves of the corrected sentence get a behavioural fence: the TRUE half (route-assigned codes never reach the shared `grounding_verdicts` collector, so the SERVER publish gate is genuinely unchanged) quantified over the whole set, and the FALSE half (an `incomplete`-only `ok:false` DOES gate the client's Publish control) pinned verbatim with two controls. The source grep is ranked **beneath** the property as a regression pin, never as the fence — the Phase-185 lesson (wave 15)

**Wave 16** *(blocked on Waves 13-15 — a pin's number comes from the gate's own output after every test-adding plan has landed)*

- [x] 187-29-PLAN.md — **WR-16 applied to round 5** + the round-5 record. Three suites now carry the round's honesty estate and none is in `vitest-count-gate.cjs`'s `BASELINE` — `DescribeKbPicker.test.tsx` (the born-bound round trip), `ProblemsTray.test.tsx` (the fence that the all-clear cannot render before a check ran) and `verdictModel.test.ts` (the sentence's word-class property) — so every guard round 5 adds could be deleted with the gate green. All three pinned from the script's printed `actual` column (never hand-counted), each pin **observed producing a `[count-decrease]`** on a genuinely deleted `it(` block. Then `187-VALIDATION.md` gains the round-5 section: per-task rows, ten probes with their observed REDs and proved reverts, the re-measured mount cap (≤ 15 ins / ≤ 3 del, with the **third deletion recorded as a NAMED spend** and the stronger render-body-unchanged property proved), the zero-migration gate three ways, and three new manual rows — **M15** (bind before the AI drafts), **M16** (a freshly-opened draft claims no check nobody ran — watch the FIRST SECOND), **M17** (the fast path is still one click). The operator's seeded-rows caveat is recorded as **binding on every new row**: the 73 drafts / 68 published rows are test data of unknown vintage, so every row must ALSO be performed against a FRESHLY generated draft. Nothing is ticked (wave 16)

**Cross-cutting constraints:**

- ZERO migration files are added

**UI hint**: yes
**Flags**: G-2 sketch (node vocabulary "feels like"); SC#10 (VOCAB-02 AI-seed rides the provider-routed `POST /generate` NL generator — cross-provider); extends v3.3 LANG-01 + SEED-085 + Technical-names reveal; AI-seed structurally-safe (response schema IS the `extra="forbid"` union — Pitfall 7) + respects grounding mode (185); reuses the Starter Workflow Library; acceptance bar = PM pack + Starter Library + 4 canonical seed shapes; G-5 ledger (`PhaseNode.tsx` + NL-seed wiring into `WorkflowBuilderPage.tsx`); red line D-14; **SEED-137 folded → SC#6 (armed-gate precedence); this phase DOES now carry a threat-model item — the fix touches the D-185-05 attachment seam and must keep `test_185_engine_attachment.py:153-165` green or visibly re-shape it with reasoning recorded**; no migration.

**SEED-137 scoping note (written at fold time, 2026-07-31 — read before planning):** the three candidate fix shapes are NOT equivalent and the choice is a discuss-phase decision, not an executor's. **(A)** graft the armed spec at index 0 (`[*extra, *phase.validators]`) — cheapest, but INVERTS D-185-05's ordering guarantee for the *grounding* gate, whose append-at-end position is load-bearing for T-185-03-01 (a weak author spec passes at index 0 and the real gate still runs at index N). The two appended specs may need *different* positions, which means the attachment seam stops being one uniform append — decide that deliberately. **(B)** re-run the remaining pre-gates after an ask_user Proceed — more faithful to "every declared gate is asked", but changes control flow on a path shared with non-armed workflows and needs a re-entrancy story (a validator that already paused must not pause twice). **(C)** hoist the armed check out of the validator list into an explicit pre-body checkpoint keyed on `spec.action_risk_armed`, leaving the validator only as the finding producer — most structural, most work. Also confirm whether `validator_index` accounting stays correct (T-185-03-03 accepted a doubled gate row on the arithmetic that re-ordering would change), and whether the same hazard applies to the appended `citations_required` gate (it is `timing="post"`, so probably not — confirm, do not assume).

#### Phase 188: Non-Technical Run Observability

**Goal**: A non-technical user can watch a workflow run on the canvas with honest, legible per-node state — including each node's grounded-cited vs open state — a business view distinct from the developer timeline, painted from the same run stream (one run stream, two views). The field's blind spot: n8n/Flowise are developer-grade, Beam is shallow. **And that view has somewhere to live**: a workflow run and its finished deliverable get their own home — launching stops redirecting into Chat, a finished run is retrievable after the fact, and the artefact is reachable from the run rather than only from a live panel (RUNVIZ-03, operator call 2026-07-31 after Phase 185 UAT: *"a workflow that is RUNNING, and its output, should have their own place — not be dumped into chat."*).
**Depends on**: Phase 185 (to display each node's grounded-cited vs open governance state) + Phase 184 (the node id = `phase.slug` identity).
**Requirements**: RUNVIZ-01, RUNVIZ-02, RUNVIZ-03
**Success Criteria** (what must be TRUE):

  1. A non-technical user can watch a workflow run on the canvas — each node shows live state (pending / active / passed / failed / skipped / waiting-for-you), and its grounded-cited vs open governance state (RUNVIZ-01, GOVERN-02).
  2. The run view paints from the same `usePhases(threadId)` run stream the developer `PhaseTimeline` uses — one run stream, two views; no new Redis events, no new demux (RUNVIZ-01).
  3. Node state is a total function over the FULL event set — it never shows "done" on a `gate_failed` / `run_failed`; success is never inferred from the absence of an event (RUNVIZ-02, Pitfall 4).
  4. The run view reconciles-on-fetch at every reconnect — Realtime is a hint, not truth (D-v2.5-03) (RUNVIZ-02).
  5. Launching a published workflow lands the user on the run's own surface, NOT redirected into the chat message list — today `WorkflowsPage.tsx` delegates to `ChatLayout.doRun` (`ChatLayout.tsx:233`), which creates a thread and redirects into Chat (`WorkflowsPage.tsx:9-13`); that redirect is what this criterion removes (RUNVIZ-03).
  6. A run is retrievable **after it finishes** — a completed run can be re-opened and read (state + phase spine) without it having to still be streaming, and its finished deliverable is reachable **from the run** rather than only from a live panel (RUNVIZ-03).
  7. All of the above hold across providers and live run states with Deep Mode byte-identical (SC#10).

**Plans**: 13 plans in 10 waves

**Wave 1** *(Wave 0 in effect — the pre-edit baselines must be measured against an unmodified tree)*

- [x] 188-01-PLAN.md — Wave 0 harness: extend the count gate's `TARGETS` so the panel reconcile suites RUN, pin the two running-but-unpinned node suites, and record the six pre-edit baselines (frontend gate, `tsc -p tsconfig.app.json` = 33, the backend 211-failure baseline, the canvas/gate 12-pass, and the pre-existing `test_thread_workflow_endpoint.py` 1-of-7 RED) before any production edit (wave 1)

**Wave 2** *(blocked on 188-01 so the baselines are recorded first; these two share no files and run in parallel)*

- [x] 188-02-PLAN.md — **TWO fail-opens, both observed RED first**: the SPEC named `?? "done"` (unreachable); RESEARCH found the REACHABLE one — `finalizeAllPhasesForThread` sweeps `pending` → `done`, and `skip_to_phase` leaves jumped-over phases `pending` forever, so a step that never ran paints Complete live and Not started after a refresh. Narrows the predicate, widens `Phase["status"]` with `"unknown"` and takes the compiler-forced `STATUS_META` entry (wave 2)
- [x] 188-03-PLAN.md — `GET /workflow-runs/{workflow_run_id}` (D-188-15, NOT `/runs/{id}`): ownership-gated FIRST with 404-on-miss through the user-JWT client, `require_canvas()` alone, the path template added to `CANVAS_GATED_PATHS`, and BOTH shipped gate fences updated in the same commit (wave 2)


**Wave 3** *(blocked on 188-02 — same reducer)*

- [x] 188-04-PLAN.md — **BUG-260609-04 closed at its root**: `reconcilePhases`' live branch overlays real `slug` + `phaseType` from `wf.phases` by `phase_index` (measured: the rows are fully populated at run creation). Identity ONLY — the positional status derivation stays byte-identical so the shipped forward-only floor cannot move backward (wave 3)


**Wave 4** *(blocked on 188-04)*

- [x] 188-05-PLAN.md — **the G-5 extraction the milestone's own ledger names**: `frontend/src/lib/phaseState.ts` holds the ONE derivation (`phaseStatusFromDb` total, `canvasReading` collapsing `retrying` in one named place, `TERMINAL_RUN_STATUSES` carried forward with the `timed_out` measurement recorded). Both shipped views rewired; a `?raw` fence with positive controls proves zero local re-derivations (wave 4)


**Wave 5** *(blocked on 188-05 — needs `CanvasReading`)*

- [x] 188-06-PLAN.md — the canvas business-word table (`runVocabulary.ts`) and the status ring: seven readings as seven distinct arc geometries, gaps placed with `stroke-dashoffset` and every number computed from `offset = (D + G/2) − p`, zero net-new glyphs, the run line as one budget with `technicalLine` DECLINED, and the ⛨ seal guard widened from four run states to seven (wave 5)


**Wave 6** *(blocked on 188-06)*

- [x] 188-07-PLAN.md — the `PhaseNode` adapter and the **capped** `WorkflowCanvas` pass-through: a prop mirroring the shipped `marks?:` plus one `ariaLabel` append, inside a pinned **≤ 15 insertions / ≤ 4 deletions** `git diff --numstat`. Req 2's no-harness-vocabulary fence and Req 5's string separation land here (wave 6)


**Wave 7** *(blocked on 188-03 + 188-05 + 188-07)*

- [x] 188-08-PLAN.md — `getWorkflowRun` and `WorkflowRunPage`: the header, the one-line run band (total over `workflow_runs.status` — an unrecognised value reads *State unknown*, never *Complete*), the `claimed_at`-anchored elapsed label with no clock at all when it is null, and the **page-owned `phase_index` join** that keeps `phase_index` out of the canvas (wave 7)


**Wave 8** *(blocked on 188-08)*

- [x] 188-09-PLAN.md — the fourth home: `ActiveView` 11 → 12, a render branch immediately BEFORE the trailing positional-fallback `<KnowledgeHealthPage />`, and `doRun`'s tail retargeted to the run — resolved via `active_workflow_run_id`, never `PostMessageResponse.run_id`. `createThread` / `postMessage` / the WR-04 cleanup all survive verbatim; `threads.py` is not touched (wave 8)


**Wave 9** *(blocked on 188-09)*

- [x] 188-10-PLAN.md — the deliverable region (`useWorkspaceFiles(run.thread_id)` + `downloadWorkspaceFile`, zero net-new backend wire, no promised preview) and the reciprocal `Open the run` seam on the thread — D-188-13's other half, and the only route back to a finished run while `GET /runs` is deferred (wave 9)


**Wave 10** *(blocked on 188-10; the two plans share no files and run in parallel)*

- [x] 188-11-PLAN.md — the SC#10 board: `scripts/sc10_188_run_board.py` derives the 8-provider roster by executing `MODEL_CAPABILITIES`, probes API keys FIRST (a keyless row silently looks like a pass), reads the EFFECTIVE provider back from `runs`, and `188-UAT.md` is authored with every row present and none pre-marked (wave 10)
- [x] 188-12-PLAN.md — final pins + phase gates: every suite this phase authored moves from `TARGETS` into `BASELINE` at its measured count, one pin is watched producing `[count-decrease]`, and nine gates are recorded — including the WHOLE-PHASE `WorkflowCanvas.tsx` numstat, zero migrations, and backend non-attribution proved by DIFFING the failure set (wave 10)


**Wave 11** *(blocked on 188-11 + 188-12 — the operator gate)*

- [ ] 188-13-PLAN.md — the G-4 lived-experience gate: eight operator-driven scenarios (watch a real run, refresh mid-run, the skip case in the wild, **colour off**, the `🕐 Tomorrow` journey, the `.docx` download, the anchored clock, and the live single-phase run that is BUG-260609-04's own closure condition), plus the executed SC#10 board. Owed rows are recorded as a DECISION, never as a claim that everything ran (wave 11)

**UI hint**: yes
**Flags**: G-2 sketch (live run "feels like"); SC#10 (live run state, all providers); one run stream / two views — `CanvasRunView` reads the SAME `usePhases(threadId)` slice `PhaseTimeline` uses (no new Redis events, no new demux); shows grounded-cited vs open per node (185); node state = total function over the FULL event set (Pitfall 4); reconcile-on-fetch on reconnect (D-v2.5-03); G-5 ledger (`PhaseTimeline.tsx`/`PhaseCard.tsx`/`StreamsProvider.tsx` — the hottest cluster; proactively extract a shared phase-state module; keep the canvas OUTSIDE the stream path per the 067.5 Branch-D3 guard); `elkjs` deferred (→ Phase 191 only if `llm_batch_agents` fan-out needs a branching layout); red line D-14; no threat model; no migration. **RUNVIZ-03 (added 2026-07-31)**: the run gets its own home — G-2 sketch input already exists (`.planning/sketches/145-the-review-moment/README.md` — own header, own spine, no message list, no composer; the sketch explicitly disclaims being a commitment, so it is evidence, not a decision). Landmine: D-14 forbids a second *runtime*, NOT a second *view* — the harness engine stays the only executor and the run stays thread-backed (`active_workflow_run_id`); what changes is where the user stands and how a finished run + its artefact are reached. Two seed positions are now overridden and must not be re-inherited: SEED-051's "Execution = in a thread … NO separate execution route" (superseded 2026-07-31) and D-094-UNIFY's "artefacts live in the chat-thread panel FILES section, NOT a separate place" (re-opened, workflow-run-scoped) — both carry dated notes.

#### Phase 189: Governed External-Action Node Model

**Goal**: A user can place a governed external-action node on the canvas whose capabilities ride the existing per-phase tool-whitelist + the Phase-185 action-risk (GOVERN-03) approval checkpoint — and the milestone records the own-framework-vs-Open-Platform decision — without any live outbound egress (operator HARD gate #3, CORE half).
**Depends on**: Phase 187 (the business node vocabulary the external-action node extends) + Phase 185 (the action-risk checkpoint it reuses).
**Requirements**: CONN-01
**Success Criteria** (what must be TRUE):

  1. A user can place a governed external-action node on the canvas whose capabilities ride the existing per-phase tool-whitelist guard (an MCP-backed node model — zero new governance concept) (CONN-01).
  2. The external-action node is expressed in the same business vocabulary + governance rails as every other node — it cannot be wired around a gate or a whitelist, and it carries the Phase-185 action-risk approval checkpoint by default.
  3. The milestone records the own-framework-vs-Open-Platform decision durably (research verdict: MCP-first, first-party-thin, broad catalog sequenced with Open Platform SEED-013/014) (CONN-01).
  4. No live outbound egress ships in this phase — CORE delivers the governed node vocabulary + the recorded decision only (live connectors are Phase 190, STRETCH).

**Plans**: TBD
**UI hint**: yes
**Flags**: HARD gate #3 (CORE half) — governed node vocabulary + recorded own-vs-Open-Platform decision (MCP-first, first-party-thin, Open-Platform-sequenced SEED-013/014; note SEED-031 is the LLM-provider seed, NOT connectors — the real track is SEED-013 + sibling SEED-014); NO live egress (→ 190, STRETCH); MCP-backed node rides the EXISTING per-phase tool whitelist + reuses the 185 action-risk (GOVERN-03) checkpoint (zero new governance concept); red line D-14; no SC#10 (design / vocabulary, no live stream); no threat model (no outbound egress yet — the threat model lands WITH Phase 190); no migration.

#### Phase 190: Live Connector Slice + Connector Security — STRETCH

**Goal**: A user can run 2-3 first-party live connectors from a workflow (email out, JIRA/ticket create, Slack notify), with every outbound secured against SSRF, credential leakage, and cross-tenant bleed (operator HARD gate #3, live-proof half). LAST by design — the app's first outbound-to-arbitrary-destination capability and the highest new security surface.
**Depends on**: Phase 189 (the governed node model) — gated behind CORE completion.
**Requirements**: CONN-02, CONN-03
**Success Criteria** (what must be TRUE):

  1. A user can run 2-3 first-party live connectors from a workflow — email out, JIRA/ticket create, Slack notify — as the demo-able external-integration proof (MCP-backed action nodes) (CONN-02).
  2. Every connector outbound passes an unconditional SSRF / egress allow-list guard regardless of credential state — avoiding the n8n "guarded only when a credential is attached" CVE class (CONN-03).
  3. The sibling "authenticated ≠ safe" RCE class is closed — all expression / template evaluation is sandboxed and there is NO arbitrary-code node on the business canvas (CONN-03).
  4. Connector credentials are org-scoped, Fernet-encrypted (`enc:v1:` reuse), resolved server-side by reference — never in the definition JSONB or the client (CONN-03).
  5. A dedicated cross-org credential-leak test passes (the SEED-124/125 precedent); the phase carries a verified SECURITY.md (`threats_open: 0`) (CONN-03). Broad catalog / inbound webhooks / public API are explicitly NOT built here — they sequence with Open Platform (SEED-013) (CONN-02).

**Plans**: TBD
**UI hint**: yes
**Flags**: HARD gate #3 (live-proof half); threat model / mandatory `/gsd:secure-phase` (`threats_open: 0`) — unconditional SSRF / egress allow-list regardless of credential state (n8n CVE class, Pitfall 5), the sibling "authenticated ≠ safe" RCE class → sandbox all expression/template evaluation + NO arbitrary-code node, org-scoped Fernet `enc:v1:` credentials resolved server-side by reference (never in JSONB/client), a dedicated cross-org leak test (SEED-124/125 precedent); SC#10 (live connector slice, cross-provider run); 2-3 first-party connectors (email/JIRA/Slack) — broad catalog / inbound webhooks / public API sequence with Open Platform (SEED-013), NOT forked here; migration likely (org-scoped connector-credentials table — sized at discuss/sketch; reuses `SECRETS_ENCRYPTION_KEY`, no new key); MCP spec-version pin + deprecation cycle (research Gap); red line D-14 (action node, still no second runtime).

#### Phase 191: Conditional Canvas Scale Hardening — STRETCH

**Goal**: The canvas stays responsive at scale — but only if a real workflow or a real org fan-out exceeds the expected small scale (harness workflows are typically 5-50 phases).
**Depends on**: Phase 184 + Phase 188 (the editable canvas + run-viz) — gated behind CORE, conditional.
**Requirements**: SCALE-01
**Success Criteria** (what must be TRUE):

  1. If node counts exceed ~100-150, the canvas applies React Flow `onlyRenderVisibleElements` + node memoization and stays responsive (SCALE-01).
  2. If run-viz must depict `llm_batch_agents` fan-out as a branching layout, `elkjs` auto-layout is added (only then) (SCALE-01).
  3. Workflows-list reads stay fast at many-orgs × many-workflows scale via indexed org-scoped reads (SCALE-01).
  4. This phase ships ONLY if a real workflow or org fan-out exceeds the expected small scale — otherwise it is not built.

**Plans**: TBD
**UI hint**: yes
**Flags**: conditional — ship ONLY if a real workflow / org fan-out exceeds the expected small scale; React Flow `onlyRenderVisibleElements` + node memoization (>~100-150 nodes); `elkjs` auto-layout only if run-viz must depict `llm_batch_agents` fan-out as branching (prefer over the unmaintained dagre); indexed org-scoped Workflows-list reads at many-orgs × many-workflows; depends 184 + 188; red line D-14; no threat model; migration only if the index needs one.

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 181. Revert Foundation | 3/3 | Complete (awaiting verify) | 2026-07-24 |
| 182. Server Validation Seam | 12/12 | Complete (SC#3 accepted risk — SEED-134) | 2026-07-25 |
| 183. Read-Only Canvas | 9/9 | **COMPLETE** — verify `passed`; `183-09` closed all 3 live-confirmed defects, live gate closed 7/7 (U-5 canvas findability + U-6 spine flag-off) | 2026-07-26 |
| 184. Editable Canvas + Live Structural Validation | 1/13 | In Progress — Wave 0: count gate + D-184-07 glyph swap shipped (`4a019bd8`, `ffb3e9cf`) | - |
| 185. Graded Governance — Grounding Mode + Action-Risk Dial | 13/13 | **COMPLETE — verified 12/12 (`0edb3920`), operator gate PASSED (`3713a716`), SECURED 49/49 (`a00b1cc5`, 2026-07-31).** GOVERN-01/02/03 all **Complete** in REQUIREMENTS.md; `nyquist_compliant` **true**. The security audit found one real fail-open BLOCKER — T-185-04-01, a **typed** refusal on an armed checkpoint ran the step and wrote a false approval receipt (the shipped invariant guard was green but scoped to the BUTTON labels, while `PendingAskCard`'s free-text box is unconditional). Fixed server-side by an allow-list in quick task `260731-3y4` (`417728bd`), re-audited `## SECURED`. Adjacent finding [[SEED-137]] (armed-gate precedence bypass) recorded, NOT folded here — folded into **Phase 187 SC#6**. *(Historical, superseded — the wave-by-wave detail below was accurate when written and is preserved rather than deleted:)* Waves 0–5 shipped: detection + the biting gate + the honest armed wait + the client governance data + the panel dial + the word-badge deletion + the 137-B rebuild + **185-09's corner seal** (`6bdc658a`, `59c54ba0`) + **185-10's detour edge** (`94a89425`, `6badaa6e`, `7c3f8b7c`) — `FlowEdge.tsx` is the first custom `@xyflow/react` edge in this tree (D-185-18 held: four net-new pieces). **Wave 6 `185-11` is PART-DONE and deliberately NOT counted:** tasks 1-2 shipped (`3864d962` the vocabulary sweep as a 30-test parser-scoped source sweep; the four phase-level fences recorded verbatim in `185-VALIDATION.md` — migrations **0**, the D-14 Deep path **0**, `phase_types.py` **0**, `PhaseFormPanel.tsx` 23/6 with only **4** insertions in the render body, retired grounding symbols **0**), but **task 3 is a blocking `checkpoint:human-verify` that has NOT run**. **BLOCKED ON THE OPERATOR:** the 4 G-4 lived-experience scenarios + the greyscale and ordinary-edge screenshot rows + the 8-row SC#10 scoreboard, all authored in `185-VALIDATION.md`. GOVERN-01/02/03 all still `Pending`; `nyquist_compliant` deliberately still `false` | - |
| 186. Concurrency & Autosave | 20/20 | **COMPLETE — verified 9/9 `passed`, operator UAT PASSED (6 passed, 0 issues, 2 skipped-with-reason, `4d446670`), SECURED 112/112 with 0 open (`74ccd224`, 2026-08-01).** CONCUR-01/02 both **Complete** in REQUIREMENTS.md; `nyquist_compliant` **true** on a measured re-run (frontend 443/443, backend 46/46 — the 20-row per-task map had sat at `pending` all phase and was flipped on measurement, not on assumption; the one parallel-run failure is a named 5s-timeout flake that passes 46/46 under `--fileParallelism=false`, and `pytest -rs` proves the live-DB rows ran 17/17 with 0 skipped). **CR-03 was REFUTED, not worked around** — plan `186-18` shipped the ordering fix, so `blockedReason`'s `saving` check now sits ABOVE the flag gate (`WorkflowBuilderPage.tsx:1094` vs `:1095`) and the guard is reachable on the flag-off surface; UAT row 8 drove exactly that surface live. Two skipped UAT rows are unreachable-by-design (the publish modal pins the Builder, so no in-tab mid-publish edit exists; and a live 422 is not producible because draft PATCH is permissive by design — the gauntlet is the enforcement point). *Open residuals, non-blocking:* **WR-19/WR-20** — hold-release honesty gaps only (`markSaved` uncalled, `dirty` stays true, so no false receipt is possible); they still owe `deferred-items.md` entries with re-open triggers. *Observation for a later phase:* the draft PATCH accepts a negative `max_steps` (200 + persisted) — wants a server-side sanity clamp; not a 186 defect, draft validation shipped in 183/184 | - |
| 187. Business Vocabulary + AI-Seeded Canvas | 29/29 | **COMPLETE 2026-08-04.** Plans 01-25 shipped across rounds 1-4; round 5 (`187-26`..`187-29`) closed GAP A/B/C and pinned its own guards. Verification `passed` at **13/14** must-haves. The two gaps round-5 verification opened were closed by DIRECT FIX rather than a round 6 (operator decision) — both lived in code round 5 had authored the same day, so a round 6 would have been 100% cleanup of round 5 while every ROADMAP success criterion was already verified: `12069204`/`f2a43fc9` CR-R5-01 (the describe-door picker surrenders a folder id it cannot show, so a dead id can no longer suppress `unbound_retrieval` and unblock Publish — fenced on the REQUEST, not just the component), `e854a505` truth 14 (TARGETS and BASELINE are two knobs; `WorkflowBuilderPage.describe.test.tsx` was never even RUN by the gate — now run and pinned; DoorSwitch 13→23, canvas 22→128, picker 30→37, total 804→946), `5d9ba921` the `PublishGauntlet` load flake (D-ITEM-187-20-01). Gates at close: count gate exit 0 (2196 tests, failed 0, 22/22 pinned), `tsc -p tsconfig.app.json` 33 unchanged with ZERO in the touched tree, `vite build` exit 0. **MANUAL DEBT CARRIED FORWARD:** `187-UAT.md` is 6 passed / 1 blocked / 7 pending and VERIFICATION lists 12 `human_verification` items — VOCAB-01/02/03 are marked Complete on the strength of code + live operator passes on rows 1/2/3/9, NOT because every row ran. Run M15b first (the browser falsification of CR-R5-01). See D-ITEM-187-CLOSE-01/02 | - |
| 188. Non-Technical Run Observability | 0/13 | Planned — 13 plans in 10 waves (`/gsd:plan-phase 188`, 2026-08-05). Wave 1 is three parallel plans: the count-gate harness + measured baselines, the TWO fail-opens observed RED first (the SPEC named the unreachable `?? "done"`; RESEARCH found the REACHABLE `finalizeAllPhasesForThread` sweep), and the ownership-gated `GET /workflow-runs/{id}`. `WorkflowCanvas.tsx` is capped at **≤ 15 ins / ≤ 4 del** measured over the whole phase (G-5 honoured by scope + the shared `lib/phaseState.ts` extraction the ledger's own 188 row names; the `PlaneEditingLayer` lift stays OWED). Zero migrations. BUG-260609-04 folded — code closure in 188-04, flip to `closed` only on the live single-phase run in 188-13 | - |
| 189. Governed External-Action Node Model | 0/? | Not started | - |
| 190 (STRETCH). Live Connector Slice + Connector Security | 0/? | Gated (behind CORE) | - |
| 191 (STRETCH). Conditional Canvas Scale Hardening | 0/? | Gated (behind CORE) | - |

**Guardrails firing (v3.6):**

- **G-2 sketch-first** on Phase 183 (read-only canvas), Phase 184 (editable canvas + node config), Phase 185 (graded-governance state on the canvas — grounded-strict vs open-flexible badges + mode toggle), Phase 187 (node vocabulary "feels like"), Phase 188 (live run "feels like") — all visual / "feels like" surfaces. `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`. The `sketch-findings-agentic-rag` skill auto-loads on all canvas / phase-spine / run-surface work. The backend/flag phases (181, 182) and the design/decision phase (189) do not fire G-2.
- **G-5 workflow-studio hot-file ledger (the synthesizer's explicit WATCH ITEM — track from phase 1, apply refactor-before-3rd-touch PROACTIVELY):** this milestone puts 6+ phases through the same hot-file class that triggered the 075.x chat-surface G-5 cascade. `PhaseNode.tsx` (183 read-only + 184 editable + **185 graded-governance dials = ~3rd touch → refactor-before-3rd-touch PROACTIVELY**), `PhaseSpineGraph.tsx` (183/184 reuse its glyph/parse → extract a shared glyph/parse module before the 3rd consumer), `WorkflowBuilderPage.tsx` (184 = the 3rd authoring door; 187 NL-seed), `PhaseTimeline.tsx`/`PhaseCard.tsx` (188 `CanvasRunView` reuses their phase-state derivation → extract a shared phase-state module), `StreamsProvider.tsx` (188 run stream — keep `<OrgContext>`/canvas OUTSIDE the stream path per the 067.5 Branch-D3 guard). Audit each phase's `files_modified` at discuss-phase; a match on a firing row means discuss produces a refactor recommendation FIRST.
- **SC#10 (cross-provider mandate):** 185 (graded strictness — a grounded node's citation/confidence enforcement rides the provider-sensitive retrieval/agent path), 187 (VOCAB-02 AI-seed rides the provider-routed NL generator), 188 (RUNVIZ live run state), 190 (CONN live slice). Pure backend-reuse / flag phases (181, 182) + pure-authoring/projection phases (183, 184) are NOT flagged. Phase 186 (Concurrency) carries the SC#10 **parallel axis** (two-editor UAT row) but not full cross-provider streaming.
- **Threat models (secure-phase):** Phase 190 (CONN-02/03 — SSRF / "authenticated ≠ safe" RCE / org-scoped credentials / cross-tenant leak; the app's first user-supplied-destination egress surface; SEED-124/125 cross-org-leak-test precedent; `threats_open: 0`). REVERT-02 (181) is a tested-revert gate, not a threat model. Phase 185 (Graded Governance) has **no full threat model** — it reuses the enforced validation-gate library; the structural "not author-loosenable-away" property is verified in-phase. NO threat model on the other pure-UX CORE canvas phases (183, 184, 186-189) unless a discuss-phase surfaces a real trust boundary. CONN-01 (189) has no live egress → its threat model lands with 190.
- **Red line (D-14, load-bearing every phase):** the canvas is a pure projection, never a second source of truth and never a second runtime; the harness engine stays the ONLY executor; every new route flag/404-gated at every layer; Deep Mode byte-identical (graded governance is byte-identical when `grounding_mode` is unset); provider differences at the boundary. `test_revert_byte_identical` (REVERT-02) makes flag-off provably byte-identical.
- **Migrations:** live head = 113; next free slot = 114 reserved ONLY IF the nullable `workflow_layouts` side table (OPEN-05) is confirmed at the Phase-184 sketch — otherwise deterministic auto-layout = ZERO migrations (don't manufacture one). Graded governance (185) is ZERO-migration (additive optional `grounding_mode` in the definition JSONB, not a column). Phase 190 (STRETCH) likely adds an org-scoped connector-credentials table (sized at sketch; reuses `SECRETS_ENCRYPTION_KEY`, no new key).
- **Cloud parity owed:** migrations 099-113 + `SECRETS_ENCRYPTION_KEY` still owed at the next production push (pre-existing debt, not new v3.6 work). Any v3.6 migration rides the same next-push parity checklist.

---

## v3.5 UX Consolidation & Chat Polish — ✅ SHIPPED 2026-07-23 (CORE); STRETCH deferred

**Started:** 2026-07-22 (operator-confirmed UX-track sequencing at v3.4-close: the polish cluster now, Visual Workflow Studio next as v3.6). **Roadmap created:** 2026-07-22. **Shipped:** 2026-07-23 (git tag `v3.5`; CORE 174-177; STRETCH 178-180 deferred → `.planning/v3.5-STRETCH-CARRYFORWARD.md`). Full detail archived → `.planning/milestones/v3.5-ROADMAP.md`.

**Goal:** Clear the parked `surface: Agentic-RAG` chat-surface bug backlog and consolidate the accumulated UI/UX rough edges — including the brand-new v3.4 org surfaces — into one coherent, polished, honest experience, before the large v3.6 Visual Workflow Studio build. A **Medium cleanup milestone**: mostly bug-fix + polish, no large net-new build; deliberately kept **separate** from v3.6.

**Red line (every phase):** never fork the shared Deep/agent-loop/provider path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

**Numbering:** CORE **Phases 174-177**, STRETCH **Phases 178-180**. **Phases 169-173 are RESERVED** for the deferred v3.4 STRETCH carry-forwards (Dept-Admin, Entitlements, Permission-Aware Citations, OIDC SSO, Dept-Skills — `.planning/v3.4-STRETCH-CARRYFORWARD.md`) and are NOT reused here. Migrations: this is a cleanup milestone — prefer app-layer fixes; live head = 113, **next free slot = 114 reserved ONLY if a specific bug fix genuinely needs schema** (none expected).

**Scope source:** `.planning/REQUIREMENTS.md` (14 CORE + 9 STRETCH = 23 reqs). **Reported-bugs mandate:** this milestone IS the home of the parked backlog — at every `/gsd:discuss-phase`, re-list open/deferred `surface: Agentic-RAG` reports and fold the matching ones explicitly (some "open" reports may already be fixed-pending-verification — triage fix-vs-verify).

### Phase Table (CORE — Phases 174-177)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 174 | Run-State & Lifecycle Honesty | Every run's lifecycle (setup → stream → stop/cancel/kill → navigation) is honestly reflected — no empty bubbles, no lost stop indicators, no hidden setup activity, no timer/avatar glitches | STATE-01, STATE-02, STATE-03, STATE-04 | 5 | **SC#10**; **G-2 sketch** (honest run-state "feels like"); **G-5** (`MessageItem.tsx`/`StreamsProvider.tsx`/`useMessages.ts`/`threads.py`); reported-bugs fold (5); UI hint; no threat model; no migration |
| 175 | Cross-Provider Streaming Fidelity | Newer reasoning models + non-OpenAI providers stream cleanly — correct params (no 400s), no tool-markup leak, honest title-gen fallback — all at the adapter/sanitizer boundary | XPROV-01, XPROV-02, XPROV-03 | 4 | **SC#10**; **G-5** (gateway/adapter/sanitizer boundary); **red line D-14**; reported-bugs fold (4); OpenRouter-400s OUT; no threat model; no migration |
| 176 | Chat Render Correctness + Exec Reliability | The transcript renders each message once, un-folded at a clean terminal, with honest send outcomes + live version-pointer updates; `execute_code` installs requested libraries reliably | RENDER-01, RENDER-02, RENDER-03, RENDER-04, EXEC-01 | 5 | **SC#10**; **G-2 sketch** (render visual); **G-5** (`MessageItem.tsx`/`useMessages.ts`/`StreamsProvider.tsx`; EXEC → `sandbox_service.py`/`tool_dispatcher.py`); reported-bugs fold (4 + 2 minor); UI hint; no threat model; migration only if RENDER-04 truly needs (unlikely) |
| 177 | v3.4 Org-Surface Polish | The new v3.4 org surfaces (admin shell, switcher, profile anchor, invitations, SSO sign-in) are polished + error-honest across every state — without widening the already-secured 166-168 authz | ORGUX-01, ORGUX-02 | 3 | **G-2 sketch** (org-surface "feels like"); **G-5 light** (`StreamsProvider.tsx` — keep `<OrgContext>` OUTSIDE the stream path, 067.5 Branch-D3 guard); rolls in 166/167/168 live-UAT status-lag; UI hint; **no SC#10**; **no threat model** (polish over secured surfaces, not new authz); no migration |

### Phase Table (STRETCH — gated behind CORE — Phases 178-180)

Committed as gated phases (ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 / v3.3 156-159 / v3.4 169-173 precedent).

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 178 | Chat UI/UX Polish Pass (SEED-045 umbrella) | Sweep the collected chat/nav polish seeds into one coherent pass — SEED-045 remainder, provider-logo/nav consistency, a legible cited-vs-retrieved citation footer, run-state-aware todos, workspace-panel reliability | POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05 | 4 | — (SEED-045 anchors shipped in 156); **SC#10** (run-state todos + workspace panel + provider logos touch live state); **G-2 sketch**; **G-5** (`ToolCallPanel.tsx`/`MessageItem.tsx`/workspace panel/`useMessages.ts`/`providerLogo.tsx`); SEED-098 = verify/close only; UI hint |
| 179 | Plain-Language / Terminology Extensions | Extend the shipped v3.3 plain-language layer (`termMap`) onto the new org + chat surfaces so jargon doesn't creep back in | LANG-01 | 2 | — (extends Phase-154; best after 177 so org labels exist); label layer — **no SC#10, no G-2, no G-5**; red line (no enum/API/audit break, Deep byte-identical); UI hint |
| 180 | Agent-Loop Behavior Honesty | The agent honors explicit step-by-step / todo-loop requests, Anthropic's end-of-cycle output shows a user-facing summary (not a raw action list), and excessive tool iterations are bounded + honest | LOOP-01, LOOP-02, LOOP-03 | 4 | — (touches the agent loop — most careful STRETCH); **SC#10**; **G-5** (`agent_loop.py`/`anthropic_service.py` — both hot-file rows); **red line D-14**; reported-bugs fold (3 deferred majors + BUG-260626-02/-03); may warrant careful decomposition |

### Phase Checklist

- [x] **Phase 174: Run-State & Lifecycle Honesty** — no empty/orphaned cancel-kill bubbles, stop indicator survives nav+reload, "setting up agent" shows live activity, workflow-run timers/avatars stay accurate on nav (STATE-01..04) — COMPLETE 2026-07-22 (5/5 reqs; live UAT passed; STATE-01b resolved via Run-window surface)
- [ ] **Phase 175: Cross-Provider Streaming Fidelity** — gpt-5.6-class correct params (no 400), DeepSeek tool-markup strip holds on long turns, honest title-gen fallback (XPROV-01..03)
- [x] **Phase 176: Chat Render Correctness + Exec Reliability** — one user bubble, un-folded final answer, no silent send-drop, live version-pointer, reliable `execute_code` library install (RENDER-01..04, EXEC-01) — COMPLETE 2026-07-23 (4/4 plans; verify 5/5 must-haves; code-review CR-01/WR-01/WR-02 fixed; SC#10 live UAT rolling forward)
- [ ] **Phase 177: v3.4 Org-Surface Polish** — org-admin shell / switcher / profile anchor + invitations/SSO surfaces polished + error-honest across states (ORGUX-01, ORGUX-02)
- [ ] **Phase 178 (STRETCH): Chat UI/UX Polish Pass** — SEED-045 remainder + provider logos + citation-footer superset + run-state-aware todos + workspace-panel polish (POLISH-01..05)
- [ ] **Phase 179 (STRETCH): Plain-Language / Terminology Extensions** — extend the `termMap` reveal onto the new org + chat surfaces (LANG-01)
- [ ] **Phase 180 (STRETCH): Agent-Loop Behavior Honesty** — honor step-by-step/todo-loop, Anthropic user-facing end summary, bounded tool iterations (LOOP-01..03)

### Phase Details

#### Phase 174: Run-State & Lifecycle Honesty

**Goal**: Every run's lifecycle — setting up, streaming, stopping, cancelling, being killed, and navigating away-and-back — is honestly reflected in the chat surface, so a user is never left staring at an empty bubble, a lost stop indicator, a hidden model, or a glitched timer/avatar.
**Depends on**: Nothing (first phase — stabilizes the run-lifecycle surface the later chat phases render on).
**Requirements**: STATE-01, STATE-02, STATE-03, STATE-04
**Success Criteria** (what must be TRUE):

  1. A cancelled or killed run leaves no empty chat bubble and no orphaned run card — the surface honestly shows "cancelled — no output yet" (STATE-01).
  2. The "Response stopped" / stop indicator survives navigating away-and-back AND a full page reload (STATE-02) — read from the authoritative `runs.status` (FND-01/145), no new persistence needed.
  3. During "Setting up agent…", the user sees live model activity instead of a state that hides the model working (STATE-03).
  4. Run timers stay accurate when navigating to a workflow run — no timer reset, no duplicate avatar (STATE-04).
  5. All four hold across providers, multi-tool prompts, parallel threads, and long histories with Deep Mode byte-identical (SC#10).

**Plans**: 4 plans (3 waves)

- [x] 174-01-PLAN.md — STATE-03 pre-answer reasoning honesty (`outerBannerLabel` reasoningActive → "Reasoning…") [Wave 1]
- [x] 174-02-PLAN.md — STATE-01a + STATE-02 verify-and-close (cancelled-no-output + stop-indicator reload-derive) [Wave 1]
- [x] 174-03-PLAN.md — STATE-01b killed-workflow amber block (403 catch branch + composer unlock) [Wave 2]
- [x] 174-04-PLAN.md — STATE-04 workflow-run timer anchor + single avatar (startedAt stamp + pre-runId dedup) [Wave 3]

**UI hint**: yes
**Flags**: SC#10; G-2 sketch (honest run-state "feels like"); G-5 (`MessageItem.tsx`, `StreamsProvider.tsx`, `useMessages.ts`, `threads.py` run-lifecycle — audit at discuss); reported-bugs fold (`cancelled-run-empty-bubble-early-cancel`, `killed-workflow-empty-chat-card`, `cancelled-run-stop-indicator-lost-on-navigation`, `setting-up-agent-hides-model-activity`, `BUG-260610-01`); no threat model; no migration.

#### Phase 175: Cross-Provider Streaming Fidelity

**Goal**: Newer reasoning models and non-OpenAI providers stream cleanly — correct request params (no 400s), no tool-call markup leaking into visible content, and honest title-generation fallback — all handled at the gateway/adapter/sanitizer boundary with the shared path unforked.
**Depends on**: Phase 174 (lands after run-state honesty so the cross-provider streaming blast radius is clean).
**Requirements**: XPROV-01, XPROV-02, XPROV-03
**Success Criteria** (what must be TRUE):

  1. Newer reasoning models (gpt-5.6 class) send correct request params — no model-parameter 400 on chat or with tools (XPROV-01).
  2. DeepSeek tool-call markup never leaks into visible chat content; the re-parse/strip guard holds on long turns (XPROV-02).
  3. Title-generation cross-provider fallback is honest — no misleading fallback banner when a provider actually succeeds (XPROV-03).
  4. All three hold across the native providers with Deep Mode byte-identical — provider handling stays at the adapter/sanitizer boundary, no shared-path fork (SC#10 / D-14).

**Plans**: 4 plans (2 waves) — XPROV-04 (BUG-260722-01) folded in per D-05.

- [x] 175-01-PLAN.md — Foundation: capability markers (reasoning_first + reasoning_off SAFE list) + shared provider-safe utility-model guard (XPROV-01/03/04 substrate) [Wave 1]
- [x] 175-02-PLAN.md — XPROV-02: DSML strip stream-end flush + honest-incomplete leak signal (Option-B post-drain, existing `error` event) [Wave 1]
- [x] 175-03-PLAN.md — XPROV-01: reasoning_first STRUCTURED gate in resolve_calling_mode + honest reasoning-tools-unsupported error copy [Wave 2]
- [x] 175-04-PLAN.md — XPROV-03/04: provider-safe guard at title-gen + suggestion + per-MODEL reasoning-off title call [Wave 2]

**Flags**: SC#10; G-5 (gateway/adapter/sanitizer boundary — `openai_compat.py` DeepSeek strip, the `openai_service` param builder, `thread_title.py`; audit at discuss); red line D-14 (adapter boundary only); reported-bugs fold (`BUG-260714-01`, `BUG-260711-02` [deferred — triage fix-vs-verify], `BUG-260708-01`, `BUG-260623-01`, `BUG-260722-01` → XPROV-04); OpenRouter-specific 400s stay OUT (experimental — fix only if native-safe + low-complexity); no threat model; no migration.

#### Phase 176: Chat Render Correctness + Exec Reliability

**Goal**: The chat transcript renders each message exactly once, un-folded at a clean terminal, with honest send outcomes and live version-pointer updates — and the `execute_code` tool installs requested libraries reliably instead of silently no-op'ing.
**Depends on**: Phase 174 (shares the chat-render/streaming surface the run-state phase stabilizes).
**Requirements**: RENDER-01, RENDER-02, RENDER-03, RENDER-04, EXEC-01
**Success Criteria** (what must be TRUE):

  1. No duplicate user bubble — the optimistic temp row and the persisted row reconcile to exactly one (RENDER-01).
  2. The final answer renders un-folded at a clean terminal — no reload required to lift it out of the narration fold (RENDER-02).
  3. A submitted general-chat message always sends or surfaces an honest failure — no intermittent silent send-drop (RENDER-03).
  4. An approved skill/description version pointer updates in the UI without a reload (RENDER-04).
  5. The `execute_code` `libraries` parameter installs the requested packages reliably — no silent no-op, no wasted retry rounds (EXEC-01).

**Plans**: 4 plans (2 waves) — created 2026-07-22

- [x] 176-01-PLAN.md — RENDER-01 + RENDER-02: StreamsProvider reconcile correctness (user-bubble content-supersede drop + mount-path onTerminal un-fold by run.run_id) [Wave 1]
- [x] 176-02-PLAN.md — RENDER-04: Skill-Studio live version pointer (refreshVersions mirror of refreshGate + VersionsTab refreshNonce) [Wave 1]
- [x] 176-03-PLAN.md — EXEC-01: reliable execute_code install (python -m pip same-interpreter, retry x1) + bounded ModuleNotFound auto-heal + honest tool result [Wave 1]
- [x] 176-04-PLAN.md — RENDER-03: honest send-drop (non-dispatch → failedSendDrafts/reconcileErrors seam) + fresh-thread pending-send ordering [Wave 2, depends 176-01]

**UI hint**: yes
**Flags**: SC#10 (chat UI state + agent loop); G-2 sketch (render visual — D-13: NO fresh sketch, sketch 014 + StreamingNarration are the anchor); G-5 (`StreamsProvider.tsx` render-layer only — additive reconcile at existing seams, no refactor-first; EXEC-01 → `tool_dispatcher.py` only, sandbox_service unchanged); reported-bugs fold (`BUG-260712-02`, `BUG-260707-03`, `general-chat-intermittent-silent-send-drop`, `BUG-260706-01`, `BUG-260708-02`; minor `BUG-260609-02`/`-04` deferred → Phase 178); honest threat model (no new trust boundary — all `accept`); no migration (D-16 — all app-layer).

#### Phase 177: v3.4 Org-Surface Polish

**Goal**: The brand-new v3.4 org surfaces — org-admin shell, org switcher, profile-menu identity anchor, invitations, and SSO sign-in — are polished and error-honest across every state (member vs org-admin, 1-org vs multi-org, success vs failure), while the polish keeps the already-secured 166–168 authz intact.
**Depends on**: Nothing hard (an independent org surface); sequenced after Phase 174 so the shared nav/profile shell is stable first.
**Requirements**: ORGUX-01, ORGUX-02
**Success Criteria** (what must be TRUE):

  1. The org-admin shell, org switcher, and profile-menu identity anchor read correctly and honestly across states — member vs org-admin, single-org vs multi-org (ORGUX-01).
  2. The invitations and SSO surfaces (invite dialog, invitations tab, `/invite` landing, SSO tab, identifier-first sign-in) are polished and surface honest errors instead of dead-ends (ORGUX-02).
  3. The polish preserves the already-secured 166–168 authz — no widening of org-admin capability, no cross-org leak, no new trust boundary.

**Plans**: 5 plans (2 waves) — created 2026-07-23

- [x] 177-01-PLAN.md — Wave 0: extract the 3 shared org-zone primitives — `StatusChip` (D-08) · `RoleBadge`/`OrgIdentity` (D-04) · `HonestNotice` (D-11) + co-located tests [Wave 1]
- [x] 177-02-PLAN.md — Identity cohesion: OrgBand + ProfileMenu → shared RoleBadge; per-org-role / honest-absent / indigo-vs-amber-zone audit-and-lock (ORGUX-01, D-04/05/06/07) [Wave 2]
- [x] 177-03-PLAN.md — Management chips: InvitationsTab + SsoTab → shared StatusChip, RETIRE the UPPERCASE off-grid fork + snap to the 4px grid; link-first + victim-naming preserved (ORGUX-02, D-08/09/10) [Wave 2]
- [x] 177-04-PLAN.md — Roster + invite dialog: OrgMembersTab + InviteMemberDialog → shared RoleBadge/StatusChip/OrgAvatar + 4px grid; roster stays a pure read leaf (ORGUX-01/02, D-04/08/09/10) [Wave 2]
- [x] 177-05-PLAN.md — Entry/failure honesty: one AuthCardShell + HonestNotice across SignInForm + AcceptInvitePage; recoverable dead-ends → calm; legible fail-open note (ORGUX-02, D-11/12/13/14) [Wave 2]

**UI hint**: yes
**Flags**: G-2 sketch (org-surface polish — "feels like"); G-5 light (`StreamsProvider.tsx` — keep `<OrgContext>` OUTSIDE the stream path, preserve the 067.5 Branch-D3 clear guard); rolls in the 166/167/168 live-UAT status-lag (cross-provider SC#10 + SSO round-trip); no SC#10 (not streamed state); no threat model (polish over already-secured surfaces, not new authz); no migration. Fold the LANG-01 relabel here if Phase 179 hasn't run yet.

#### Phase 178: Chat UI/UX Polish Pass (SEED-045 umbrella) — STRETCH

**Goal**: Sweep the collected chat/nav polish seeds into one coherent pass — the SEED-045 remainder, provider-logo/nav-presence consistency, a legibly-superset citation footer, run-state-aware todos, and workspace-panel reliability — so the accumulated minor rough edges land as one polished surface rather than scattered inserts.
**Depends on**: — (gated behind CORE completion; the SEED-045 rail/chat-list anchors already shipped in Phase 156, so this is the remainder).
**Requirements**: POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05
**Success Criteria** (what must be TRUE):

  1. The SEED-045 remainder minor-enhancement items land as one coherent polish pass (POLISH-01).
  2. Provider logos / nav-presence are consistent across the chat surface (POLISH-02 / SEED-058).
  3. The citation footer legibly reads as a superset of the inline `[n]` markers — cited-vs-retrieved is clear (POLISH-03 / SEED-119).
  4. The todos panel reflects the live run's state honestly (POLISH-04 / SEED-105) and the workspace panel is reliable + polished across run states (POLISH-05 / SEED-039).

**Plans**: TBD
**UI hint**: yes
**Flags**: SC#10 (run-state-aware todos + workspace panel + provider logos touch live-run / provider state); G-2 sketch (visual polish); G-5 (`ToolCallPanel.tsx`, `MessageItem.tsx`, the workspace panel, `useMessages.ts`, `providerLogo.tsx` — audit at discuss). **SEED-098 (tool-card dedup) = verify/close only** — already largely shipped via quick-task 260630-226; NOT a fresh build. No threat model; no migration.

#### Phase 179: Plain-Language / Terminology Extensions — STRETCH

**Goal**: Extend the shipped v3.3 plain-language layer (LANG-01 / `termMap`) onto the new v3.4 org surfaces and chat surfaces so jargon doesn't creep back in — purely a label layer behind the existing advanced reveal.
**Depends on**: — (gated behind CORE completion; extends the shipped Phase-154 plain-language reveal; best sequenced after Phase 177 so the org-surface labels exist to relabel).
**Requirements**: LANG-01
**Success Criteria** (what must be TRUE):

  1. The v3.3 plain-language reveal covers the new org + chat surfaces — jargon terms map to plain language behind the existing advanced reveal (LANG-01 / SEED-085).
  2. The relabel is additive — no enum/API/audit break, Deep Mode byte-identical (Phase-154 Pitfall-15 precedent).

**Plans**: TBD
**UI hint**: yes
**Flags**: no SC#10 (label layer); no G-2 (label pass, not net-new visual — Phase-154 precedent); no G-5 (additive term map); red line (no shared-path / enum break); no threat model; no migration.

#### Phase 180: Agent-Loop Behavior Honesty — STRETCH

**Goal**: The agent honors an explicit step-by-step / todo-loop request instead of collapsing it into one turn, Anthropic's end-of-cycle output shows a user-facing summary (not a raw action list), and excessive tool iterations on multi-step tasks are bounded and honest — all at the agent-loop / adapter boundary with Deep Mode byte-identical.
**Depends on**: — (gated behind CORE completion; touches the agent loop, so it is the most careful STRETCH — sequence after CORE lands clean).
**Requirements**: LOOP-01, LOOP-02, LOOP-03
**Success Criteria** (what must be TRUE):

  1. The agent honors an explicit step-by-step / todo-loop request instead of collapsing it into one turn (LOOP-01).
  2. Anthropic's end-of-cycle output shows a user-facing summary, not a raw action list (LOOP-02).
  3. Excessive tool iterations on multi-step tasks are reduced — bounded and honest — without regressing legitimate multi-step work (LOOP-03).
  4. All three hold across providers with Deep Mode byte-identical — provider-specific behavior stays at the adapter boundary, no shared-path fork (SC#10 / D-14).

**Plans**: TBD
**Flags**: SC#10; G-5 (`agent_loop.py` + `anthropic_service.py` — both on the hot-file ledger; audit at discuss); red line D-14; reported-bugs fold (`agent-ignores-step-by-step-request-no-todo-loop`, `anthropic-end-of-cycle-shows-actions-not-summary`, `anthropic-excessive-tool-iterations-on-multi-step-tasks`; related deferred `BUG-260626-02` baseline-leak-into-final-emit, `BUG-260626-03` run-end todo finalizer); may warrant its own careful decomposition at discuss-phase.

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 174. Run-State & Lifecycle Honesty | 0/? | Not started | - |
| 175. Cross-Provider Streaming Fidelity | 4/4 | Executed — ready for verification | 2026-07-22 |
| 176. Chat Render Correctness + Exec Reliability | 4/4 | Complete (SC#10 live-UAT rolling) | 2026-07-23 |
| 177. v3.4 Org-Surface Polish | 0/5 | Planned (5 plans / 2 waves) | - |
| 178 (STRETCH). Chat UI/UX Polish Pass | 0/? | Gated (behind CORE) | - |
| 179 (STRETCH). Plain-Language / Terminology Extensions | 0/? | Gated (behind CORE) | - |
| 180 (STRETCH). Agent-Loop Behavior Honesty | 0/? | Gated (behind CORE) | - |

**Guardrails firing (v3.5):**

- **G-2 sketch-first** on Phase 174 (honest run-state "feels like"), Phase 176 (render visual work), Phase 177 (org-surface polish), Phase 178 (chat polish seeds) — all live-UI / "feels like" surfaces. `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`. Phase 179 (label layer) needs no sketch (Phase-154 precedent).
- **G-5 hot files (audit at discuss-phase):** `MessageItem.tsx` / `StreamsProvider.tsx` / `useMessages.ts` (174, 176, 178), `ToolCallPanel.tsx` + workspace panel (178), `threads.py` (174 run-lifecycle — producer extraction paid down in 162.5 but the file stays hot), `agent_loop.py` + `anthropic_service.py` (180 — both hot-file ledger rows), the gateway/adapter/sanitizer boundary (175).
- **SC#10 (cross-provider mandate):** 174, 175, 176 (CORE chat surface) + 178 (run-state todos / workspace panel / provider logos touch live state) + 180 (agent loop). ORGUX (177) + LANG (179) deliberately NOT flagged — neither touches streamed state.
- **Reported-bugs mandate:** this milestone IS the parked chat-surface backlog's home — cross-check `.planning/reported-bugs/` (`surface: Agentic-RAG`, status open/deferred) at each `/gsd:discuss-phase` and fold matching reports; some "open" reports may be already-fixed-pending-verification (triage fix-vs-verify).
- **Threat models:** NONE this milestone — UI/bug-fix cleanup; ORGUX (177) is polish over the already-secured 166–168 surfaces, not new authz. Flag one only if a discuss-phase surfaces a real trust boundary.
- **Red line (D-14):** never fork the shared path — provider differences stay at the gateway/adapter/sanitizer boundary. Deep Mode byte-identical; no new runtime.
- **Cloud parity owed:** migrations 099–113 + `SECRETS_ENCRYPTION_KEY` still owed at the next production push (no new v3.5 migrations expected).

---

## v3.4 Multi-Tenancy & Org Access — ✅ SHIPPED 2026-07-22 (CORE); STRETCH deferred

Full detail archived → **`.planning/milestones/v3.4-ROADMAP.md`** · requirements → **`.planning/milestones/v3.4-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`** · STRETCH carry-forward guide → **`.planning/v3.4-STRETCH-CARRYFORWARD.md`**.

CORE Phases 160-168 (10 phases incl. the 162.5 `threads.py` refactor; 56 plans, 121 tasks) — the load-bearing **one-way RLS door** that turns Agentic RAG from a per-user app into an org-aware multi-tenant platform. **Tenancy foundation (160-162):** a ratify-not-relitigate Tenancy ADR (D-v3.4-01), the 8-table org/dept/role schema with correct-from-birth membership RLS + `current_user_org_ids()` (mig 104), and personal-org backfill across 35 tables (migs 105/106). **The atomic crux (162.5-164):** the `threads.py` producer extraction (2444→1214 LOC, `agent_loop` byte-identical) then the RLS rewrite + per-request user-JWT client swap (migs 107/108, FIX-A 109) so membership RLS is ENFORCED on every request path, then the SECDEF audit + `document_chunks`/`skill_embeddings` org-scoping + the two-org isolation exit-gate suite (mig 110). **Cleanup + surfaces (165-168):** `is_global` semantic retirement (mig 111 → `is_org_shared` / `is_system_global`), the org-admin shell/switcher/profile/audit + Settings split, invitations/roles/greenlists/JIT/per-user-prefs, and SAML SSO self-service (mig 113 — Supabase is the SAML SP, 0 new hard deps). 22/22 CORE requirements delivered + threat-secured (`threats_open: 0` across the isolation cluster + 166/167/168; SEED-124 + SEED-125 cross-org leaks closed). **Owed on cloud:** migrations 104-113 + `SECRETS_ENCRYPTION_KEY`. Live UAT (cross-provider SC#10 + the SSO round-trip, which needs cloud + a real IdP) rolls forward. **STRETCH 169-173** (Dept-Admin shell, entitlement/retention footholds, permission-aware citations, OIDC SSO, dept-targeted skills) deferred with concrete re-open triggers → the carry-forward guide.

---

## v3.3 Operator UX — ✅ SHIPPED 2026-07-18

Full detail archived → **`.planning/milestones/v3.3-ROADMAP.md`** · requirements → **`.planning/milestones/v3.3-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

14 phases (146–159), 95 plans, 212 tasks. Made the platform operable + configurable by a non-developer operator from the UI. **Operator tier (146–148):** a gated `/admin` Control Room behind a byte-identical-404 `require_operator` gate (no RLS backstop — app-layer isolation) + operator audit ledger — health, active-runs + Kill, fail-closed capability kill-switches, maintenance/read-only mode, audit browser, user roster, API-enforced feature visibility. **Model & secrets (149–150, 159):** a dynamic model-capability registry + live propose-only discovery (no restart, no silently-guessed capabilities), add-model-by-ID + utility-filtered discovery curation (159), and app-layer Fernet secrets-at-rest with env-fallback. **Files & workflows (151–152):** `fetch_document_file` + `attach_skill_file` agent tools, Run-modal file-input + per-run KB-folder scope + safe workflow delete. **Trust & friendliness UX (153–156):** per-claim inline citations keyed to the run's real retrieval set, an app-wide plain-language layer behind an advanced reveal, a WCAG-AA sweep, everyday nav/thread polish. **Deployment (157–158):** Solo/Team/Enterprise presets + `docker-compose.prod.yml` + `OPERATOR.md`, and an idempotent lock-after-finalize install wizard at `/setup`. 20/20 requirements (16 CORE + 4 STRETCH); WFIN-02 one operator-accepted OpenRouter-axis limitation (external BUG-260714-02). Migrations 095–103; `SECRETS_ENCRYPTION_KEY` env. Threat-secured across 146–150 / 153 / 154 / 158 / 159 (`threats_open: 0`).

---

## v3.2 Skill Eval Studio + Self-Improving — ✅ SHIPPED 2026-07-10

Full detail archived → **`.planning/milestones/v3.2-ROADMAP.md`** · requirements → **`.planning/milestones/v3.2-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

16 phases (132, 133, 134, 134.1, 135, 136, 137, 137.1, 137.2, 138, 139, 140, 141, 142, 143, 145), 81 plans. Turned the v3.1 Skill Trigger Tuner into a full **Skill Eval Studio**: persistent eval test cases + immutable skill versions, a with-skill-vs-without eval runner with a dual-arm LLM judge + honest per-provider verdicts + human ratings, a human-in-the-loop self-improvement loop, a publish gate, and the Evals·Triggering·Versions panel — plus a built-in skill-creator (every user, read-only + protected), STRETCH honesty phases (run-end honesty, smart-dispatch skill pre-filter, run-scoped template resolver, non-Python skill-script honesty), the FND-01 run-lifecycle foundation (`runs.status` authoritative + `threads.py` G-5 extraction, live SC#10 UAT 6/6), and a curated **Starter Workflow Library** (WF-01 — 3 KB→document starters proven live end-to-end: fork → judge-approved publish gauntlet → cited `.docx`).

**Deferred → v3.3:** FILE-01 (Phase 144, Agent-Driven Skill File Attachment — gated STRETCH, not executed; rolls forward with the workflow-file cluster SEED-110/112). **Verification debt:** live UATs pending/partial on 140/141/142/143 (see MILESTONES.md → Known Gaps).

**Next:** v3.3 Operator UX (authoritative map: `PRDs/SEQUENCE.md`).

---

## v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers — ✅ SHIPPED 2026-06-28

**Started:** 2026-06-21 (Option A — scope LOCKED + operator-approved). Numbering continues from v3.0's last phase (119) → **CORE Phases 120-124**, then **STRETCH Phases 125-131** (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 precedent). *Phase 131 (SRH-01, non-Python skill-script honesty) folded in 2026-06-22 after a JS-skill-import investigation — SEED-044 Layer 1; the full Node-execution capability stays v3.2 DISC-01.*

**Goal:** Make the agent's skills + workflows trustworthy, legible, and reliably triggered across *all* providers — fix the live workflow↔skill collision (a confirmed, root-caused bug), lift cross-provider honesty to OpenAI-parity, add a Skill Trigger Tuner, and re-skin the Workflow Studio so each workflow's "soul" is obvious with a strict↔loose authoring/running split.

**Red line (every phase):** never fork the shared Deep/agent-loop/provider path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

**Scope source:** `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md` (LOCKED). Operator pressures: `.planning/research/v3.1-skills-eval/OPERATOR-INPUTS.md`.

### Phase Table (CORE)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 120 | Collision Fix + Context Isolation | A skill saving one file in a workflow-touched thread emits exactly that file, and Deep/Harness stop replaying each other's history | COLL-01, CTX-01 | 4 | G-5 (`threads.py` firing → extraction due, `agent_loop.py` `_reconstruct_history`); SC#10 |
| 121 | One Front Door for Workflows (IA) | Workflows launch from a single front door; the chat composer drops to 2-pill General/Explorer while the lock/409/reconcile is preserved | IA-01 | 3 | G-2 sketch-gated; UI hint; SC#10 |
| 122 | Cross-Provider Trust & Honesty Parity | Cross-provider emission is recovered-or-honest, doc-verified per provider, measured on a per-provider scoreboard, and task labels are concrete on every provider | MP-01, MP-02, MP-03, TDP-01 | 5 | G-5 (gateway/adapter boundary, `agent_loop.py`); SC#10 (cross-provider = EVAL axis, MP-03) |
| 123 | Skill Triggering Quality | A skill author can tune a description against a held-out benchmark, weak descriptions are flagged at save, and loaded skills don't fall out of context mid-session | TRIG-01, TRIG-03, CTX-03 | 5 | G-5 (`context_window.py`/`agent_loop.py` trim path for CTX-03); SC#10 (TRIG-01 cross-provider) |
| 123.1 (INSERTED) | Skill Trigger Tuner — Design Fidelity & UX Polish | The Trigger Tuner result surface reads cleanly at the org's real provider count, the seeded benchmark is visible/editable before running, a completed result survives refresh, and the builder model is choosable from configured models | TRIG-01 (gap-closure, BUG-260624-01) | TBD | G-2 sketch-gated (sketches 041–044 exist); frontend-heavy; SC#10 (cross-provider legibility) |
| 124 | Workflow Studio UX — Soul + Strict↔Loose | A user sees a workflow's "soul" at a glance in 3 sizes and meets a clear strict↔loose split ("Describe & run" vs "Author & govern") | WUX-01, WUX-02 | 4 | G-2 sketch-gated (both); UI hint; G-5 (`PhaseTimeline.tsx`/`PhaseCard.tsx`) |

### Phase Table (STRETCH — gated behind CORE)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 125 | Self-Improve Proposer (description-only) | A bounded, human-in-the-loop description-only proposer drafts a description diff → human approves → new immutable version; never auto-publishes | SI-02 (STRETCH) | 3 | SC#10 (judge-as-gate cross-provider); depends on 122 + 123 |
| 126 | Smart-Dispatch Relevance Pre-Filter | Only plausibly-relevant skills are surfaced to the model and the catalog stays within a token budget | TRIG-02 (STRETCH) | 3 | G-5 (catalog injection path); SC#10; depends on 123 |
| 127 | Gauntlet Pip-Strip + Quiet Idle Cards | The publish gauntlet renders as a pip-strip + worded verdict with raw-on-demand; idle PhaseCards stay quiet | WUX-03 (STRETCH) | 2 | G-2 sketch-gated; UI hint; G-5 (`PhaseCard.tsx`); depends on 124 |
| 128 | Chat Tool-Card Unification + Chat-Area Reclaim | One honest, unified, space-efficient chat surface across every provider: live description before `tool_start` + provider logos in the tool-card header + a tool card that uniformly carries all run info + removing the redundant sticky composer timer + Read-more on long prompts | TDP-02, CTC-01, CTC-02, CTC-03, CTC-04 (STRETCH) | 5 | **G-2 sketch-gated** (now visual); SC#10 (cross-provider tool-card parity); **G-5** (`ToolCallPanel.tsx`/`MessageItem.tsx`/`ChatArea.tsx` — audit refactor-vs-feature at discuss); depends on 122 |
| 129 | MiniMax/OpenRouter Arg Repair | MiniMax malformed-args boundary repair + OpenRouter `require_parameters` for broader provider robustness | MP-04 (STRETCH) | 2 | G-5 (gateway/adapter boundary); SC#10; depends on 122 |
| 130 | template_input Resolver Run-Scope | The `template_input` resolver is run-scoped too — defense-in-depth for the `render_template` path alongside COLL-01 | COLL-02 (STRETCH) | 2 | depends on 120 |
| 131 | Non-Python Skill-Script Honesty | A user importing/running a skill with a non-Python script (e.g. `.js`) gets an honest message instead of a silent failure; instructions still work | SRH-01 (STRETCH) | 3 | additive, OFF the COLL-01 seam; SEED-044 Layer 1; precursor to v3.2 DISC-01 |

### Phase Checklist

- [x] **Phase 120: Collision Fix + Context Isolation** — run-scope the sandbox harvest baseline (kills the live 2-files bug) + tag `messages.origin` so Deep/Harness stop replaying each other (COLL-01, CTX-01) ✓ 2026-06-22
- [x] **Phase 121: One Front Door for Workflows (IA)** — remove the composer Harness pill → 2-pill General/Explorer, keep the lock/409/reconcile (IA-01) ✓ 2026-06-23
- [x] **Phase 122: Cross-Provider Trust & Honesty Parity** — force→coerce retry ladder, doc-verified `emit_tier`, per-provider scoreboard, OpenAI-parity task labels (MP-01, MP-02, MP-03, TDP-01) ✓ 2026-06-23
- [x] **Phase 123: Skill Triggering Quality** — Skill Trigger Tuner, save-time description lint, pin loaded skills out of trim (TRIG-01, TRIG-03, CTX-03) ✓ 2026-06-26 (all 3 gates: secure 29/29 · validate NYQUIST 12/12 · verify 12/12 + SC#10 4-axis live UAT 4/4 PASS)
- [x] **Phase 123.1 (INSERTED): Skill Trigger Tuner — Design Fidelity & UX Polish** — fix the cramped N-provider scoreboard, show/edit seeded cases, persist results across refresh, builder-model = configured models, restore dropped sketch elements (gap-closure for 123, BUG-260624-01)
 (completed 2026-06-25)

- [x] **Phase 124: Workflow Studio UX — Soul + Strict↔Loose** — soul in 3 sizes + strict↔loose disclosure (WUX-01, WUX-02) — 3 plans ✓ 2026-06-26 (code-review CR-01 fixed · verify 4/4 + operator UAT 7/7 PASS · CORE complete)
- [ ] **Phase 125 (STRETCH): Self-Improve Proposer (description-only)** — bounded human-in-the-loop description proposer (SI-02)
- [ ] **Phase 126 (STRETCH): Smart-Dispatch Relevance Pre-Filter** — relevance pre-filter + catalog token budget (TRIG-02)
- [x] **Phase 127 (STRETCH): Gauntlet Pip-Strip + Quiet Idle Cards** — pip-strip + worded verdict, quiet idle cards (WUX-03) — 3 plans (executed + code-verified 2026-06-27; manual UAT pending)
- [ ] **Phase 128 (STRETCH): Chat Tool-Card Unification + Chat-Area Reclaim** — live description before `tool_start` + provider logos in the tool-card header + uniform cross-provider tool card + remove the redundant sticky composer timer + Read-more on long prompts (TDP-02, CTC-01..04)
- [x] **Phase 129 (STRETCH): MiniMax/OpenRouter Arg Repair** — MiniMax-gated arg-repair guard (single-shot re-ask → recover or honest-fail) + OpenRouter `require_parameters` in the quality strategy (MP-04) — 3 plans ✓ 2026-06-27 (verify 11/11 · 12 unit tests green · SC#10 live 7/9 rows PASS, both load-bearing changes live-verified — OpenRouter API accepts `require_parameters` (R9), no regression on OpenAI/Anthropic/Google/MiniMax; repair rungs unit-proven, truncation trigger now dormant (cap moved 8192→9987+); BUG-260607-03 folded)
- [ ] **Phase 130 (STRETCH): template_input Resolver Run-Scope** — run-scope the render_template resolver (COLL-02)
- [ ] **Phase 131 (STRETCH): Non-Python Skill-Script Honesty** — honest import/exec message when a skill bundles a non-Python script the sandbox can't run; optional read-as-text for `.js` (SRH-01)

### Phase Details

#### Phase 120: Collision Fix + Context Isolation

**Goal**: A skill that runs in a thread that previously ran a workflow emits only its own output, and a subsequent Deep turn never replays the workflow's history — the live, root-caused collision (Mechanism A) is closed at the harvest baseline and the history-reconstruction filter.
**Depends on**: Nothing (first phase; sequenced EARLY because COLL-01 is a confirmed live bug)
**Requirements**: COLL-01, CTX-01
**Success Criteria** (what must be TRUE):

  1. A skill `execute_code` that saves exactly one file in a thread that previously ran a workflow emits exactly that one file — the prior workflow's leftover `/sandbox/output/` artifact is never re-emitted (the confirmed 2-files bug is gone).
  2. The sandbox-output harvest is run-scoped to its own run's baseline, so any file present before the run starts is excluded from that run's emitted outputs.
  3. When Deep chat and a workflow share a thread, a Deep turn's history reconstruction replays only `messages.origin = deep` rows, and a workflow phase replays only its `harness` rows — workflow context never bleeds into a subsequent Deep turn.
  4. The collision fix holds across providers, multi-tool prompts, parallel threads, and long (≥50-message) histories — Deep Mode stays byte-identical on the native-7 (no shared-path fork; SC#10).

**Plans**: 3 plans

- [x] 120-01-PLAN.md — COLL-01: run-scope the sandbox-output harvest (snapshot+hash baseline seed) + headline live-repro regression test
- [x] 120-02-PLAN.md — CTX-01: author migration 076 (messages.origin) + tag every harness insert site + asymmetric origin filter at agent_loop.py:1024
- [x] 120-03-PLAN.md — [BLOCKING] apply migration 076 to live DB (SQL-editor paste) + regenerate full-schema.sql + live-DB integration test

#### Phase 121: One Front Door for Workflows (IA)

**Goal**: A user launches workflows from a single, obvious front door (the Workflows page); the chat composer is simplified to a 2-pill General/Explorer control with the Harness pill and in-chat workflow selector removed, while the existing Harness↔Deep lock / 409 / reconcile behavior is preserved exactly.
**Depends on**: Phase 120 (context isolation is the actual collision fix; IA-01 is the clarity win that rides on top — and they touch overlapping thread/composer surfaces)
**Requirements**: IA-01
**Success Criteria** (what must be TRUE):

  1. The chat composer shows exactly two mode pills (General / Explorer) — the Harness pill and the in-chat workflow selector are gone, and the only place to launch a workflow is the Workflows page.
  2. Launching a workflow still works as an explicit "launch-in-context" action (the capability is not removed), and a launched workflow's thread still toggles into Harness mode and Continues correctly.
  3. The server-side Harness↔Deep lock still returns a 409 on an illegal switch, and the lock/reconcile behavior is unchanged from before the composer change.
  4. Behavior holds across providers and parallel threads with no Deep-mode regression (SC#10).

**Plans**: 2 plans

- [x] 121-01-PLAN.md — remove the Deep/Harness toggle + in-chat workflow picker (2-pill composer); preserve lock/409/reconcile + composer-stop Cancel (SC#1/SC#3)
- [x] 121-02-PLAN.md — rewrite ChatAreaMode + extend ChatAreaBanner + new ChatLayout launch test (SC#1/SC#2/SC#3 oracles)

**UI hint**: yes

#### Phase 122: Cross-Provider Trust & Honesty Parity

**Goal**: Structured emission is recovered-or-honest on every provider, each provider uses the emission path it actually supports (doc-verified, not guessed), cross-provider reliability is measured on a per-provider scoreboard that gates any tier change, and task/step labels are concrete on every provider (OpenAI-parity) — all at the gateway/adapter boundary, never the shared path.
**Depends on**: Phase 120 (lands after the collision fix so the cross-provider blast radius is clean)
**Requirements**: MP-01, MP-02, MP-03, TDP-01
**Success Criteria** (what must be TRUE):

  1. A model that silently fails a forced structured emit (e.g. the default model's no-metadata 400) is recovered by a force→coerce retry ladder in `forced_emit`, so a typed-artifact phase produces its emission instead of a silent empty result.
  2. Each provider's forcing/strict behavior is honest and doc-verified — an explicit `emit_tier` field replaces guesswork, the inert DeepSeek function-level `strict` is dropped, and GLM forcing is kept (intentional, live-verified).
  3. The eval treats provider as a first-class axis with a per-provider scoreboard (trigger / force / recovery / honest-fail), pass-OR-documented, and any `emit_tier` change is gated on that scoreboard (no silent tier flip).
  4. Task/todo/workflow-step labels are concrete on every provider (OpenAI-parity), not the bare tool name — an ungated prompt nudge fills `execute_code.description` and a deterministic frontend summarizer floor backstops providers that don't, without regressing providers that already do.
  5. The 4-axis SC#10 scoreboard (cross-provider × multi-tool × parallel-thread × long-message) passes as an EVAL axis (per MP-03), and Deep Mode stays byte-identical (no shared-path fork).

**Plans**: 4 plans

- [x] 122-01-PLAN.md — MP-02: explicit emit_tier field + 55-row registry migration (14/2/34/5) + remove the provider=="openai" gate + inert DeepSeek strict
- [x] 122-02-PLAN.md — MP-01: the ordered force_strict→non-strict→coerce→fail rung ladder inside forced_emit (reads emit_tier) + emit_rung telemetry
- [x] 122-03-PLAN.md — MP-03: --forced-emit scoreboard matrix (EASY+HARD × native-7, 4 axes PASS/FAIL/DOCUMENTED) + dated artifact + README grep ritual
- [x] 122-04-PLAN.md — TDP-01: ungated execute_code.description SYSTEM_PROMPT nudge + verified frontend label floor

#### Phase 123: Skill Triggering Quality

**Goal**: A skill author can measurably tune a skill's trigger description, the system flags weak trigger descriptions before a skill is saved, and a loaded skill's instructions stay available for the rest of the session instead of silently falling out of context.
**Depends on**: Phase 122 (the Trigger Tuner measures cross-provider on production model-ids; it reuses the per-provider scoreboard substrate landed in 122)
**Requirements**: TRIG-01, TRIG-03, CTX-03
**Success Criteria** (what must be TRUE):

  1. A skill author can run a description against a held-out should-trigger / should-not-trigger benchmark (Skill Trigger Tuner) and pick the winning description by held-out score, measured cross-provider on production model-ids.
  2. The Trigger Tuner reports a concrete trigger/should-not score per candidate description so the author can see one description beat another, not just a pass/fail.
  3. At `save_skill` (and in the skill-creator loop) a description-quality lint flags a weak or ambiguous trigger description before the skill is saved.
  4. A skill loaded mid-conversation stays in context for the rest of the session — its instructions are pinned out of the rolling trim window and don't silently disappear after the window rolls.
  5. Trigger measurement and the pinned-instruction behavior hold across providers and long histories (SC#10) with no shared-path fork on the trim path.

**Plans**: 6 plans

- [x] 123-01-PLAN.md — TRIG-03 deterministic save-time lint (3 hook points, warn-never-block) + D-01 catalog-note relaxation (shared LOAD_SKILL_POLICY)
- [x] 123-02-PLAN.md — CTX-03 trim-pin: load_skill tool-result as a third protected class in trim_messages_to_fit (de-dupe, 1/3 budget, LRU evict + marker) + reconstruct tag (G-5 RED LINE)
- [x] 123-03-PLAN.md — TRIG-01 core: D-08 builder-model knob + skill_tuner_service (candidates, policy-faithful classification, 60/40 held-out scoring, N-column adaptivity, owner-scoped auto-seed)
- [x] 123-04-PLAN.md — TRIG-01 routes: owner-scoped skill_tuner router (bounded background job over the run-buffer + tuner-specific SSE + held-out scoreboard)
- [x] 123-05-PLAN.md — TRIG-01 UI: focused full-surface Trigger Tuner (reachability triad) — case editor, N-column scoreboard (fires/no-false), candidate cards, live-run card, author-confirm diff (041-A/042-A/043-A)
- [x] 123-06-PLAN.md — TRIG-03 UI loop: inline never-block lint warning + "Tune this" handoff + the D-08 builder-model Settings picker (044-A)

### Phase 123.1: Skill Trigger Tuner — design fidelity and UX polish (INSERTED)

**Goal:** The Skill Trigger Tuner reads cleanly at the org's real provider count, makes the benchmark visible/editable before a run, makes a completed result durable across refresh/restart, and lets the builder model be chosen from configured models — closing the live-UAT design-fidelity + UX gaps in BUG-260624-01 (HIGH + MED) without changing the scoring core, the agent loop, the shared chat path, or the CTX-03 trim-pin.
**Requirements**: TBD (scope contract = the 12 locked decisions D-01..D-12 in 123.1-CONTEXT.md + the live-UAT audit backlog TT-05/07/08/09/10/11/12/14/15/16 in 123.1-AUDIT-BACKLOG.md; each is covered by >=1 plan)
**Depends on:** Phase 123
**Plans:** 10/10 plans complete

Plans:

- [x] 123.1-01-PLAN.md — Backend seam: tuner_runs table (migration 077) + durable latest-result upsert + GET-latest + seeded-cases GET + frontend wire (D-01/D-05/D-07/D-08)
- [x] 123.1-02-PLAN.md — Scoreboard polish: ProviderScoreboard vertical rows + magnitude bar + combined score; CandidateCard line-clamp/expand (D-02/D-04/D-11/D-12)
- [x] 123.1-03-PLAN.md — Settings builder-model picker from configured models + soft hint; remove IN-02 placeholders (D-09/D-10)
- [x] 123.1-04-PLAN.md — Page integration: full-width results, seeded-case hydrate/edit, standalone live-description scoreboard, result rehydration, pre-run cost preview + attribution (D-03/D-05/D-06/D-07/D-12)
- [x] 123.1-05-PLAN.md — [Wave 1] Editor-wall fix (sketch 045-B): backend seed-cap (MAX_SEEDED_SHOULD_NOT) + seeded GET `total` + legible/bounded CaseEditor + full-width pre-run stack (BUG-260624-01; seed-cap now load-bearing for RUN TIME per backlog section 5)
- [x] 123.1-06-PLAN.md — [Wave 2] Backend honesty: empty axis -> n/a not 1.0 (TT-05); all-error column -> unmeasured, excluded from target_count (TT-12); single-source cell_score (TT-15)
- [x] 123.1-07-PLAN.md — [Wave 3] Run UX: emit stage=provider_start so lanes flip queued->running (TT-07); real owner-scoped + run<->skill-bound DELETE cancel route + job checkpoint + claim release (TT-08)
- [x] 123.1-08-PLAN.md — [Wave 4] Run resilience: honest seeded-fetch note (TT-09); unmeasured-cell render (TT-12 render half); reconciling sub-state no-flash (TT-14); durable-poll reconnect honesty (TT-16)
- [x] 123.1-09-PLAN.md — [Wave 5] Layout: delete both decorative bg-sidebar deco-rails on SkillsPage + SkillTunerPage (TT-11)
- [x] 123.1-10-PLAN.md — [Wave 1] Observability: silence the LangSmith 429 uploader flood to ERROR + document LANGSMITH_TRACING_SAMPLING_RATE (TT-10)

#### Phase 124: Workflow Studio UX — Soul + Strict↔Loose

**Goal**: A user immediately sees the "soul" of a workflow (its purpose, what it needs, its phase spine, its tier, its output) in three consistent sizes, and meets a clear strict↔loose disclosure that offers two doors ("Describe & run" vs "Author & govern") without removing any control — accuracy and governance preserved, complexity demoted one click.
**Depends on**: Phase 121 (the Workflows page is now the single front door; the soul re-skin builds on that consolidated surface)
**Requirements**: WUX-01, WUX-02
**Success Criteria** (what must be TRUE):

  1. A user sees a workflow's "soul" at a glance in three sizes (library card / run header / publish summary): its purpose (`business_requirement`), what it needs, a glyph-dot phase spine (no type ribbons/index noise), one tier chip, and its output line.
  2. The library card / run header / publish summary all show the same soul object consistently — a user recognizes a workflow by the same essence in all three places.
  3. Authoring and running expose a strict↔loose disclosure keyed off `deriveTier` — two clear doors ("Describe & run" vs "Author & govern") — where nothing is removed and advanced controls are demoted exactly one click.
  4. The strict↔loose split preserves accuracy and control — a power user can still reach every advanced control, and a loose user can describe-and-run without meeting governance complexity (sketch-approved mockup is the acceptance bar).

**Plans**: 3 plans

- [x] 124-01-PLAN.md — Wave 0 foundation: extract shared soulData (tierForDefinition + PHASE_GLYPHS + needs/deliverable) + net-new WorkflowSoul (3 sizes) + glyph-dot PhaseSpine (WUX-01)
- [x] 124-02-PLAN.md — card-scale soul on library cards + the two-door fork (Describe & run / Author & govern) at the Studio authoring entry; library-card Run preserved (WUX-01, WUX-02)
- [x] 124-03-PLAN.md — run-surface soul as a G-5 additive sibling in WorkspacePanel + publish-summary soul block prepend (D-06 ladder untouched) (WUX-01)

**UI hint**: yes

#### Phase 125: Self-Improve Proposer (description-only)

**Goal**: A bounded, human-in-the-loop, description-only self-improvement proposer: eval surfaces a weak description → proposes a description diff → DRAFT → human approves → a new immutable version; it never auto-publishes, uses held-out selection, and uses the Phase-102 judge as a gate.
**Depends on**: Phase 122 + Phase 123 (reuses the cross-provider scoreboard, the Trigger Tuner's held-out selection, and the judge gate); gated behind CORE completion
**Requirements**: SI-02 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. The proposer can take an eval signal on a weak description and produce a proposed description diff as a DRAFT — it never edits a live skill description and never auto-publishes.
  2. A human reviews the proposed diff and, on approval, the proposal becomes a new immutable version; on rejection nothing changes.
  3. A proposed description is selected by held-out score and must clear the Phase-102 judge gate before it can be presented as a recommendation.

**Plans**: TBD
**UI hint**: yes

#### Phase 126: Smart-Dispatch Relevance Pre-Filter

**Goal**: Only plausibly-relevant skills are surfaced to the model and the skill catalog stays within a token budget, so the model isn't flooded with irrelevant skills and the catalog doesn't blow the context budget.
**Depends on**: Phase 123 (builds on the skill-triggering work); gated behind CORE completion
**Requirements**: TRIG-02 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. For a given user turn, only skills that pass a relevance pre-filter are surfaced to the model — clearly-irrelevant skills are not injected.
  2. The injected skill catalog stays within a defined token budget even as the user's skill count grows.
  3. The pre-filter never starves a genuinely-relevant skill (a should-trigger skill still reaches the model), verified cross-provider (SC#10).

**Plans**: TBD

#### Phase 127: Gauntlet Pip-Strip + Quiet Idle Cards

**Goal**: The publish gauntlet reads at a glance as a pip-strip + worded verdict with raw detail on demand, and idle PhaseCards stay visually quiet instead of competing for attention.
**Depends on**: Phase 124 (rides on the Workflow Studio UX re-skin); gated behind CORE completion
**Requirements**: WUX-03 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. The publish gauntlet renders as a pip-strip + a worded verdict, with the raw gauntlet detail available on demand (not shown by default).
  2. An idle PhaseCard stays quiet (no noisy animation/placeholder) and only animates when its phase is actually active (sketch-approved mockup is the acceptance bar).

**Plans**: 3 plans (planned 2026-06-27)

- [x] 127-01-PLAN.md — Icon foundation: build-time 3D-icon mechanism (unplugin-icons) + shared PHASE_GLYPHS 3D swap + PhaseSpine test migration
- [x] 127-02-PLAN.md — Publish gauntlet re-skin: energy-spine + worded verdict + raw-on-demand + golden-run hero (honesty contracts intact)
- [x] 127-03-PLAN.md — Living step-flow re-skin: quiet idle / bloomed active (activity line + engine chip) / folded done (G-5 PhaseCard/PhaseTimeline)

**UI hint**: yes

#### Phase 128: Chat Tool-Card Unification + Chat-Area Reclaim

**Goal**: One honest, unified, space-efficient chat surface across every provider — the tool card becomes the single canonical place for live run info, it reads identically on all providers, redundant chrome is removed, and every pixel of the chat area earns its place.
**Depends on**: Phase 122 (extends the task-label parity / tool-card honesty work); gated behind CORE completion
**Requirements**: TDP-02, CTC-01, CTC-02, CTC-03, CTC-04 (STRETCH)
**Reframed** 2026-06-27 (operator): the original narrow "Live Description Before tool_start" (TDP-02) was bundled with four operator-raised chat-surface improvements (CTC-01..04) because they share the same surface + G-5 hot files (`ToolCallPanel.tsx` / `MessageItem.tsx` / `ChatArea.tsx`) and one coherent vision — better as one sketched pass than five scattered inserts.
**Success Criteria** (what must be TRUE):

  1. A tool's `description` appears in the preparing window before the `tool_start` event fires (TDP-02), so the user sees what the agent is about to do during the prep gap — across providers, no Deep-mode regression, no shared-path fork (SC#10).
  2. The tool-card header shows the actual provider's logo per-provider, replacing the generic brand-pulse "spot" avatar (CTC-01).
  3. The tool card carries a unified content/layout across ALL providers — the single canonical, complete surface for live run info (status, elapsed, step/file counts, description), with no per-provider gaps (CTC-02; provider-docs-first / SC#10 — verified uniform before relying on it).
  4. The redundant sticky elapsed timer above the composer (`ChatArea.tsx` 076.1 D-03; today inconsistent across providers) is removed once CTC-02 holds, reclaiming chat-area space (CTC-03).
  5. Long user prompts collapse to a clamped preview with a "Read more" expander instead of rendering full-height (CTC-04).
  6. The unified surface is sketch-approved (G-2) before planning — the operator-approved mockup is the acceptance bar.

**Plans**: 6 plans

- [x] 128-01-PLAN.md — Install @lobehub/icons (supply-chain checkpoint) [D-08]
- [x] 128-02-PLAN.md — CTC-04 long-prompt clamp + gradient fade + Read-more (independent) [D-03]
- [x] 128-03-PLAN.md — providerLogo.tsx shared helper (logo map + preparingDescription) + Wave-0 unit tests [D-05]
- [x] 128-04-PLAN.md — CTC-01 RunCard logo + TDP-02 ToolCallPanel description = the unified card (CTC-02) [D-01/D-04]
- [x] 128-05-PLAN.md — D-06 LIVE native-7+OpenRouter cross-provider scoreboard (operator-run) [D-06]
- [x] 128-06-PLAN.md — CTC-03 StickyTimerBar deletion (LAST, gated on the D-06 proof) [D-02/D-07]

**UI hint**: yes

#### Phase 129: MiniMax/OpenRouter Arg Repair

> **STRETCH-origin** — promoted to active 2026-06-26 after v3.1 CORE (120–124) shipped clean; selected as a highest-value STRETCH (the only one closing a live open bug).

**Goal**: Broader provider robustness — MiniMax malformed tool-args are repaired at the adapter boundary, and OpenRouter requests set `require_parameters` so a wider set of routed providers honor the tool schema.
**Depends on**: Phase 122 (extends the cross-provider trust cluster at the gateway/adapter boundary); CORE complete (gate lifted)
**Requirements**: MP-04 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. A MiniMax malformed-args response is repaired at the adapter boundary so the tool call still dispatches instead of failing (closes the `minimax-m3-invalid-tool-args-400` class).
  2. OpenRouter requests carry `require_parameters`, and the change improves tool-schema honoring without regressing other providers (SC#10), with provider handling staying at the adapter boundary (no shared-path fork).

**Plans**: 3 plans

- [ ] 129-01-PLAN.md — OpenRouter `require_parameters` wired into the quality strategy (D-02) + unit test
- [ ] 129-02-PLAN.md — MiniMax-gated arg-validity guard + bounded re-ask + recovered signal / honest-fail (D-01/D-03); folds BUG-260607-03 + unit tests
- [ ] 129-03-PLAN.md — SC#10 4-axis live cross-provider scoreboard (authored in VALIDATION.md + operator-run)

#### Phase 130: template_input Resolver Run-Scope

**Goal**: Defense-in-depth for the collision — the `template_input` resolver is run-scoped too, so the `render_template` path can't re-introduce a cross-run leak alongside the COLL-01 harvest fix.
**Depends on**: Phase 120 (pairs with COLL-01 on the same collision/harvest surface); gated behind CORE completion
**Requirements**: COLL-02 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. The `template_input` resolver only resolves inputs scoped to the current run — a prior run's template inputs in the shared workspace are never picked up by a later run's `render_template`.
  2. The render_template path produces the same output it did before for in-scope inputs (no regression on the happy path).

**Plans**: TBD

#### Phase 131: Non-Python Skill-Script Honesty

**Goal**: A user who imports or runs a market skill that bundles a non-Python script the Python-only sandbox can't execute (e.g. `.js`) gets an honest, specific signal instead of a silent/confusing failure — closing the trust gap from the 2026-05-31 JS-skill-import incident (SEED-044 Layer 1). This is the honesty precursor to v3.2's DISC-01 (the full Node-execution capability); it is purely additive and stays OFF the COLL-01 sandbox-injection seam.
**Depends on**: Nothing hard; sequence after Phase 120 only to avoid touching the COLL-01 harvest/execution seam concurrently. Gated behind CORE completion. Lightweight (G-3-adjacent — import-boundary detection + an execution pre-check + message; no Node runtime, no image rebuild, no shared-path fork).
**Requirements**: SRH-01 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. Importing a skill that bundles a non-Python script (e.g. `.js`) still succeeds, and the user sees an honest message that the skill includes a step the sandbox can't run yet while its instructions still work.
  2. When the agent would run a non-Python skill script, it fails cleanly with a specific message instead of silently running JS as Python and dying on a Python `SyntaxError`.
  3. (Optional) `read_skill_file` can return a bundled `.js` as reference text so the model can read/reason about it, without implying it can be executed.

**Plans**: TBD
**Note**: Real multi-language execution (Node in the image + language routing) is explicitly NOT this phase — that's v3.2 DISC-01, which must sequence after COLL-01.

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 120. Collision Fix + Context Isolation | 3/3 | Complete | 2026-06-22 |
| 121. One Front Door for Workflows (IA) | 2/2 | Complete | 2026-06-23 |
| 122. Cross-Provider Trust & Honesty Parity | 4/4 | Complete | 2026-06-23 |
| 123. Skill Triggering Quality | 6/6 | Complete (secure 29/29 · validate 12/12 · verify 12/12 + SC#10 4-axis UAT 4/4) | 2026-06-26 |
| 123.1 (INSERTED). Skill Trigger Tuner — Design Fidelity & UX Polish | 10/10 | Complete (verify 22/22 + UAT 8/8 · secure 34/34 · validate 9/9) | 2026-06-25 |
| 124. Workflow Studio UX — Soul + Strict↔Loose | 3/3 | Complete (code-review CR-01 fixed · verify 4/4 + operator UAT 7/7 · CORE complete) | 2026-06-26 |
| 125 (STRETCH). Self-Improve Proposer (description-only) | 0/? | Gated (behind CORE) | - |
| 126 (STRETCH). Smart-Dispatch Relevance Pre-Filter | 0/? | Gated (behind CORE) | - |
| 127 (STRETCH). Gauntlet Pip-Strip + Quiet Idle Cards | 3/3 | Code-verified (11/11 truths); manual UAT pending | 2026-06-27 |
| 128 (STRETCH). Chat Tool-Card Unification + Chat-Area Reclaim | 6/6 | Complete (verify 5/6 code truths · D-06 scoreboard PARTIAL — logos confirmed live both themes, exhaustive sweep deferred · 3 live-UAT carried · white-chip + lmstudio logo fixes) | 2026-06-27 |
| 129 (STRETCH). MiniMax/OpenRouter Arg Repair | 0/? | Gated (behind CORE) | - |
| 130 (STRETCH). template_input Resolver Run-Scope | 0/? | Gated (behind CORE) | - |
| 131 (STRETCH). Non-Python Skill-Script Honesty | 0/? | Gated (behind CORE) | - |

**Guardrails firing (v3.1):**

- **G-2 sketch-first** on Phase 121 (IA-01), Phase 124 (WUX-01/02), Phase 127 (WUX-03), Phase 128 (CTC-01..04 — reframed 2026-06-27 from a non-visual TDP-02 into a visual chat-surface bundle) — all live UI / "feels like" surfaces. `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`. `sketch-findings-agentic-rag` already names the workflow run surface, the Workflows page, the phase timeline, and the composer.
- **G-5 hot files:** `backend/app/api/threads.py` (firing → extraction due — do NOT grow it; 120/121 touch its thread/composer surface), `context_window.py`/`agent_loop.py` trim path (CTX-01 origin filter in `_reconstruct_history`, CTX-03 trim-pin), `PhaseTimeline.tsx`/`PhaseCard.tsx` (shared with the live harness — re-run replay tests in 124/127), the gateway/adapter boundary (122/128/129).
- **SC#10 cross-provider** is an EVAL axis here (MP-03), not just manual UAT — flagged on every phase touching streaming / agent loop / provider routing / UI state (120, 121, 122, 123, 124, and the dependent STRETCH phases).
- **Red line:** never fork the shared path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

---

## v3.0 Document Management — ✅ SHIPPED 2026-06-21

Full detail archived → **`.planning/milestones/v3.0-ROADMAP.md`** · requirements → **`.planning/milestones/v3.0-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

11 phases (110, 111, 111.1, 112–119; incl. inserted embeddings phase 111.1), 46 plans, shipped + validated — **every phase passed verify-work + secure-phase + validate-phase** (live cross-provider UAT on the agent-tool / upload-path phases; no formal milestone audit). Turned the product's incidental document handling into a first-class, metadata-driven surface (M-Files Tier A): user-defined custom metadata with per-field confidence + audited manual override, configurable multi-provider embeddings (retires the OpenAI SPOF), metadata-driven "virtual folders" (a closed-registry filter-AST → parameterized-jsonb compiler + a no-DSL builder + an agent tool), typed document relationships (a leak-safe share-don't-fork core + panel + agent tool), suggest-then-confirm auto-classification, and a light governance-health view. 24/24 functional requirements delivered; `threads.py` untouched all milestone (G-5); near-zero new deps.

**Next:** v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers (active above; decided scope in `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md`).

---

## v2.9 Workflow Studio — ✅ SHIPPED 2026-06-15

Full detail archived → **`.planning/milestones/v2.9-ROADMAP.md`** · requirements → **`.planning/milestones/v2.9-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

CORE phases 097–104 (9 phases incl. inserted 101.1, 57 plans) shipped + validated — every CORE phase passed verify-work + secure-phase + live cross-provider UAT. Turned the v2.8 harness into an authorable capability: project/scope binding + server-side KB governance, workflow↔skill composition, ephemeral template upload + guaranteed cited template-fill with integrity gates, a reusable validation-gate library + an output-quality judge **hard-wall**, a Workflows page with NL authoring + read-only graph + 8-stage publish gauntlet, and a PM flagship content pack on the generic primitives.

**STRETCH 105–109 deferred to backlog** (never started — roadmap gated them on "ship only if CORE lands clean and budget remains"): SCHED-01 (scheduled triggers + budget caps), GRID-01 (citation-traceable grid renderer), GOV-02 (per-run provenance receipt), PLUG-01 (plugin-contract lock), ROLE-01 (operator/admin role tier). They roll forward as next-milestone candidates.

---

## Shipped Milestones

<details>
<summary>v3.2 Skill Eval Studio + Self-Improving (Phases 132-145) — SHIPPED 2026-07-10</summary>

CORE 132-137 (+ inserts 134.1, 137.1, 137.2): eval test-case persistence + immutable versions + with-skill-vs-without runner + honest per-provider verdicts + ratings + self-improve loop (SI-01) + publish gate + Evals panel + eval production-clean + built-in skill-creator. STRETCH shipped: 138 Run-End Honesty · 139 Self-Improve Proposer (description-only) · 140 Smart-Dispatch Relevance Pre-Filter · 141 template_input Resolver Run-Scope · 142 Non-Python Skill-Script Honesty · 143 Starter Workflow Library · 145 Run-Lifecycle Honesty + threads.py Extraction (FND-01). STRETCH deferred: 144 (FILE-01) → v3.3. 81 plans total. Full details: `.planning/milestones/v3.2-ROADMAP.md`.

- [x] Phase 132: Skill Versioning + Eval Test-Case Persistence (3/3 plans) — completed 2026-06-30
- [x] Phase 133: Eval Runner — With-Skill vs Without-Skill (5/5 plans) — completed 2026-06-30
- [x] Phase 134: Eval Results, Honest Verdict + Ratings (4/4 plans) — completed 2026-07-02
- [x] Phase 134.1: Evals Run Silently (bug fix — inserted during 134 UAT) (1/1 plans) — completed 2026-07-02
- [x] Phase 135: Self-Improvement Loop (SI-01) (9/9 plans) — completed 2026-07-02
- [x] Phase 136: Skill Publish Gate (GATE-01) (4/4 plans) — completed 2026-07-03
- [x] Phase 137: Skill Evals Panel UI (PANEL-01) (7/7 plans) — completed 2026-07-04
- [x] Phase 137.1: Skill Eval Production-Clean (10/10 plans) — completed 2026-07-04
- [x] Phase 137.2: Skill Creator Reborn — Built-in + Protected (4/4 plans) — completed 2026-07-04
- [x] Phase 138: Run-End Honesty (STRETCH) (5/5 plans) — completed 2026-07-06
- [x] Phase 139: Self-Improve Proposer — Description-Only (STRETCH) (5/5 plans) — completed 2026-07-06
- [x] Phase 140: Smart-Dispatch Relevance Pre-Filter (STRETCH) (5/5 plans) — completed 2026-07-07
- [x] Phase 141: template_input Resolver Run-Scope (STRETCH) (3/3 plans) — completed 2026-07-07
- [x] Phase 142: Non-Python Skill-Script Honesty (STRETCH) (5/5 plans) — completed 2026-07-08
- [x] Phase 143: Starter Workflow Library (STRETCH) (5/5 plans; core UAT proven live, A1+empty-folder deferred) — completed 2026-07-10
- [x] Phase 145: Run-Lifecycle Honesty + threads.py Extraction (STRETCH · FOUNDATION) (6/6 plans; SC#10 UAT 6/6) — completed 2026-07-10
- [ ] Phase 144: Agent-Driven Skill File Attachment (FILE-01) — DEFERRED → v3.3 (not executed)

</details>

<details>
<summary>v3.1 Workflow &amp; Skill Studio — Trust, Clarity &amp; Triggers (Phases 120-129) — SHIPPED 2026-06-28</summary>

CORE (6 phases + inserted 123.1): 120 Collision Fix + Context Isolation · 121 One Front Door · 122 Cross-Provider Trust & Honesty · 123 Skill Triggering Quality · 123.1 Trigger Tuner UX Polish · 124 Workflow Studio UX Soul + Strict↔Loose. STRETCH shipped: 127 Gauntlet Pip-Strip (code-verified/UAT partial) · 128 Chat Tool-Card Unification + Provider Logos · 129 MiniMax/OpenRouter Arg Repair. STRETCH deferred: 125/126/130/131. 40 plans total. Full details: `.planning/milestones/v3.1-ROADMAP.md`.

- [x] Phase 120: Collision Fix + Context Isolation (3/3 plans) — completed 2026-06-22
- [x] Phase 121: One Front Door for Workflows (IA) (2/2 plans) — completed 2026-06-23
- [x] Phase 122: Cross-Provider Trust & Honesty Parity (4/4 plans) — completed 2026-06-23
- [x] Phase 123: Skill Triggering Quality (6/6 plans) — completed 2026-06-26
- [x] Phase 123.1: Skill Trigger Tuner — Design Fidelity & UX Polish (10/10 plans) — completed 2026-06-25
- [x] Phase 124: Workflow Studio UX — Soul + Strict↔Loose (3/3 plans) — completed 2026-06-26
- [x] Phase 127: Gauntlet Pip-Strip + Quiet Idle Cards (3/3 plans) — code-verified 2026-06-27
- [x] Phase 128: Chat Tool-Card Unification + Chat-Area Reclaim (6/6 plans) — completed 2026-06-27
- [x] Phase 129: MiniMax/OpenRouter Arg Repair (3/3 plans) — completed 2026-06-27

</details>

<details>
<summary>v3.0 Document Management (Phases 110-119) -- SHIPPED 2026-06-21</summary>

- [x] Phase 110: DM Foundations (2/2 plans) -- completed 2026-06-15
- [x] Phase 111: Metadata Enrichment — Extraction Backend (5/5 plans) -- completed 2026-06-16
- [x] Phase 111.1: Configurable / Multi-Provider Embeddings (6/6 plans) -- completed 2026-06-17
- [x] Phase 112: Metadata Enrichment — Detail Panel + Manual Edit (4/4 plans) -- completed 2026-06-18
- [x] Phase 113: Virtual Folders — Filter Compiler + Equality (Backend) (3/3 plans) -- completed 2026-06-18
- [x] Phase 114: Virtual Folders — Range/Date + Builder + Sidebar (6/6 plans) -- completed 2026-06-19
- [x] Phase 115: Virtual Folders — Agent Tool (3/3 plans) -- completed 2026-06-20
- [x] Phase 116: Document Relationships — Backend + Agent Tool (5/5 plans) -- completed 2026-06-20
- [x] Phase 117: Document Relationships — Panel UI (4/4 plans) -- completed 2026-06-20
- [x] Phase 118: Auto-Classification (6/6 plans) -- completed 2026-06-21
- [x] Phase 119: Document Governance Health (2/2 plans) -- completed 2026-06-21

</details>

<details>
<summary>v2.9 Workflow Studio (Phases 097-104 CORE) -- SHIPPED 2026-06-15</summary>

- [x] Phase 097: Spike — Risk-Register Template-Fill + Authoring Feel (5/5 plans) -- completed 2026-06-08
- [x] Phase 098: Project Binding + Server-Side KB Scope Governance (5/5 plans) -- completed 2026-06-09
- [x] Phase 099: Workflow ↔ Skill Composition (6/6 plans) -- completed 2026-06-10
- [x] Phase 100: Ephemeral Template Upload (6/6 plans) -- completed 2026-06-10
- [x] Phase 101: Template-Fill + Integrity Validation (5/5 plans, via 101.1) -- completed 2026-06-12
- [x] Phase 101.1: Guaranteed Structured Emission Layer (10/10 plans; verify-work 19/19 + secure 36/36) -- completed 2026-06-12
- [x] Phase 102: Reusable Validation-Gate Library + Output-Quality Gate (9/9 plans; verify-work 7/7 + secure 34/34) -- completed 2026-06-13
- [x] Phase 103: Workflows Page + Authoring API + NL Authoring (6/6 plans; secured 32 threats/0 open) -- completed 2026-06-14
- [x] Phase 104: PM Flagship Content Pack (3/3 plans; secured 15/0 + nyquist + live UAT 5/5) -- completed 2026-06-15

STRETCH (deferred to backlog, never started): 105 Scheduled Triggers + Budget Caps · 106 Citation-Traceable Grid Renderer · 107 Per-Run Provenance Receipt · 108 Plugin Contract Lock · 109 Operator/Admin Role Tier.

</details>

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

*Milestones v1.0–v3.1 shipped and archived under `.planning/milestones/`. **Next milestone: v3.2** — run `/gsd:new-milestone` to define scope. Re-sequenced PRD roadmap: see `.planning/PRDs/SEQUENCE.md`. v2.9 STRETCH 105–109 + v3.1 STRETCH 125/126/130/131 remain backlog carry-forwards.*
